// Legge un DST e lo MISURA: quanti salti, quanto lunghi, quanti cambi-colore, quanto filo.
//
// Serve a rispondere coi numeri a una cosa che Lorenzo ha visto in macchina: *«non ci sono i
// passaggi ma ci sono un sacco di blocchi non uniti che il dst ha messo con rasafilo»*. Un salto
// lungo, in macchina, è un taglio del filo e una ripresa — cioè tempo, e un capo da fissare. Fin
// qui li avevo contati sulle corse; qui si contano sul file che è andato davvero in macchina.
//
// La decodifica è l'inverso esatto di `buildDst` (`packages/core/src/dst.ts`), tabella dei bit
// compresa: se una delle due cambia, i numeri smettono di tornare e si vede.
//
//   npx esbuild apps/pittorico/scripts/leggidst.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/leggidst.mjs
//   node apps/pittorico/scripts/leggidst.mjs <file.dst>

import { readFileSync } from 'node:fs';
import { readDstMetadata } from '@rg/core';

const BIT_X: Array<[number, number, number]> = [
  [0, 0, 1], [0, 1, -1], [0, 2, 9], [0, 3, -9],
  [1, 0, 3], [1, 1, -3], [1, 2, 27], [1, 3, -27], [2, 2, 81], [2, 3, -81],
];
const BIT_Y: Array<[number, number, number]> = [
  [0, 7, 1], [0, 6, -1], [0, 5, 9], [0, 4, -9],
  [1, 7, 3], [1, 6, -3], [1, 5, 27], [1, 4, -27], [2, 5, 81], [2, 4, -81],
];

interface Passo { dx: number; dy: number; tipo: 'punto' | 'salto' | 'cambio'; }

function leggi(bytes: Uint8Array): Passo[] {
  // l'intestazione DST è 512 byte
  const out: Passo[] = [];
  for (let i = 512; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    if ((b2 & 0xf3) === 0xf3) break;                    // record di fine
    let dx = 0, dy = 0;
    for (const [b, bit, peso] of BIT_X) if ([b0, b1, b2][b] & (1 << bit)) dx += peso;
    for (const [b, bit, peso] of BIT_Y) if ([b0, b1, b2][b] & (1 << bit)) dy += peso;
    const cambio = (b2 & 0xc0) === 0xc0;
    const salto = !cambio && (b2 & 0x80) !== 0;
    out.push({ dx, dy, tipo: cambio ? 'cambio' : salto ? 'salto' : 'punto' });
  }
  return out;
}

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node leggidst.mjs <file.dst>'); process.exit(1); }
const bytes = new Uint8Array(readFileSync(percorso));
const passi = leggi(bytes);

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);

console.log('');
console.log(`DST: ${percorso}`);
console.log(`${(bytes.length / 1024).toFixed(0)} kB · ${passi.length} record`);
const meta = readDstMetadata(bytes);
console.log(`viene dalla suite: ${meta ? `sì (${meta.rgProject})` : 'no, o senza parametri'}`);

// i salti si accorpano: la macchina spezza un salto lungo in più record da 12,1 mm al massimo
interface Salto { mm: number; }
const salti: Salto[] = [];
let cambi = 0, punti = 0, filoMm = 0;
let saltoInCorso: { dx: number; dy: number } | null = null;
const chiudiSalto = (): void => {
  if (!saltoInCorso) return;
  salti.push({ mm: Math.hypot(saltoInCorso.dx, saltoInCorso.dy) / 10 });
  saltoInCorso = null;
};
for (const p of passi) {
  if (p.tipo === 'cambio') { chiudiSalto(); cambi++; continue; }
  if (p.tipo === 'salto') {
    saltoInCorso = saltoInCorso
      ? { dx: saltoInCorso.dx + p.dx, dy: saltoInCorso.dy + p.dy }
      : { dx: p.dx, dy: p.dy };
    continue;
  }
  chiudiSalto();
  punti++;
  filoMm += Math.hypot(p.dx, p.dy) / 10;
}
chiudiSalto();

console.log('');
console.log(`punti cuciti  ${punti}`);
console.log(`cambi colore  ${cambi}  (aghi: ${cambi + 1})`);
console.log(`filo          ${(filoMm / 1000).toFixed(1)} m`);
console.log('');
console.log(`SALTI         ${salti.length}`);
if (salti.length) {
  const o = salti.map((s) => s.mm).sort((a, b) => a - b);
  const q = (t: number): number => o[Math.min(o.length - 1, Math.round(t * (o.length - 1)))];
  const tot = o.reduce((s, v) => s + v, 0);
  console.log(`  lunghezza   mediana ${n2(q(0.5))} mm · p90 ${n2(q(0.9))} · massimo ${n2(q(1))} mm`);
  console.log(`  in totale   ${(tot / 1000).toFixed(1)} m di spostamenti a vuoto (${((tot / filoMm) * 100).toFixed(0)}% del filo cucito)`);
  // La soglia del rasafilo la decide la macchina, di solito fra 5 e 10 mm: sopra taglia e riprende.
  for (const soglia of [5, 8, 10, 15]) {
    const n = o.filter((v) => v > soglia).length;
    console.log(`  oltre ${String(soglia).padStart(2)} mm  ${String(n).padStart(6)} salti  → altrettanti tagli e riprese se la macchina rasa a ${soglia} mm`);
  }
}
console.log('');

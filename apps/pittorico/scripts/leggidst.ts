// Legge un DST e lo MISURA: quanti salti, quanto lunghi, quanti cambi-colore, quanto filo.
//
// Serve a rispondere coi numeri a una cosa che Lorenzo ha visto in macchina: *«non ci sono i
// passaggi ma ci sono un sacco di blocchi non uniti che il dst ha messo con rasafilo»*. Un salto
// lungo, in macchina, è un taglio del filo e una ripresa — cioè tempo, e un capo da fissare. Fin
// qui li avevo contati sulle corse; qui si contano sul file che è andato davvero in macchina.
//
// La decodifica NON è più qui: è `readDst` in `@rg/core`, l'inverso di `buildDst`, con l'andata e
// ritorno bloccata da un test. Prima questo script aveva la sua copia delle tabelle dei bit, e ne
// esisteva una terza in `vedidst.ts`: tre risposte alla stessa domanda, che è ciò che R28 vieta.
//
//   npx esbuild apps/pittorico/scripts/leggidst.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/leggidst.mjs
//   node apps/pittorico/scripts/leggidst.mjs <file.dst>

import { readFileSync } from 'node:fs';
import { readDst } from '@rg/core';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node leggidst.mjs <file.dst>'); process.exit(1); }
const bytes = new Uint8Array(readFileSync(percorso));
const letto = readDst(bytes);

const n2 = (v: number): string => v.toFixed(2);

console.log('');
console.log(`DST: ${percorso}`);
console.log(`${(bytes.length / 1024).toFixed(0)} kB · ${letto.recordCount} record`);
const meta = letto.metadata;
console.log(`viene dalla suite: ${meta ? `sì (${meta.rgProject})` : 'no, o senza parametri'}`);

// i salti li accorpa già `readDst` (la macchina spezza un salto lungo in più record da 12,1 mm)
const salti = letto.jumps.map((j) => Math.hypot(j.to[0] - j.from[0], j.to[1] - j.from[1]));
const cambi = letto.colorChanges;
const punti = letto.stitchCount;
let filoMm = 0;
for (const b of letto.blocks) for (let i = 1; i < b.points_mm.length; i++) {
  filoMm += Math.hypot(b.points_mm[i][0] - b.points_mm[i - 1][0], b.points_mm[i][1] - b.points_mm[i - 1][1]);
}

console.log('');
console.log(`punti cuciti  ${punti}`);
console.log(`cambi colore  ${cambi}  (aghi: ${cambi + 1})`);
console.log(`filo          ${(filoMm / 1000).toFixed(1)} m`);
console.log('');
console.log(`SALTI         ${salti.length}`);
if (salti.length) {
  const o = salti.slice().sort((a, b) => a - b);
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

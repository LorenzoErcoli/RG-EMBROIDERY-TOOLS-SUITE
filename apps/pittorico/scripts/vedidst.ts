// LEGGERE UN DST FATTO A MANO — il riferimento che dice come si fa davvero.
//
// Lorenzo ha tracciato il disegno a mano in Stilista, ha messo il raso sulle macchie e ne ha
// regolato gli orientamenti: «piu' o meno e' quello che mi aspetterei tu sia in grado di fare». E'
// la definizione operativa dell'obiettivo, e va letta prima di scrivere altro codice: come ha
// diviso le aree, quante direzioni ha usato, che spaziatura, dove ha messo le cuciture fra un
// blocco e l'altro.
//
// Si decodifica il DST con `readDst` di `@rg/core` (l'inverso di `buildDst`, bloccato da un test di
// andata e ritorno), si prendono i blocchi cuciti — le sequenze di punti fra un salto e l'altro — e si
// misurano e si disegnano. La copia locale delle tabelle dei bit è stata tolta: era la terza (R28).
//
// I blocchi qui sono 62 e non 42 come la prima volta: la decodifica di prima perdeva il punto da cui
// parte ogni blocco — quello dove il salto porta l'ago — e così le venti FERMATURE da un punto solo
// (~11 mm, quelle che Stilista mette prima del taglio) restavano lunghe 1 e cadevano. I rasi veri
// sono sempre 42.
//
//   npx esbuild apps/pittorico/scripts/vedidst.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/vedidst.mjs
//   node apps/pittorico/scripts/vedidst.mjs <file.dst> [px/mm]

import { readFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { readDst, type Point, type Polyline } from '@rg/core';
import { Tela } from '../../../packages/testkit/src/png.ts';

interface Blocco { colore: number; punti: Point[] }

/** Dal DST ai blocchi: una polilinea per ogni tratto cucito senza salti, col suo ago. */
function decodifica(bytes: Uint8Array): { blocchi: Blocco[]; salti: number; cambi: number } {
  const letto = readDst(bytes);                          // coordinate 'svg': y verso il basso
  const blocchi = letto.blocks.map((b) => ({ colore: b.needle - 1, punti: b.points_mm.map(([x, y]) => ({ x, y })) }));
  return { blocchi, salti: letto.jumps.length, cambi: letto.colorChanges };
}

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node vedidst.mjs <file.dst> [px/mm]'); process.exit(1); }
const PX = Number(process.argv[3] ?? 6);
const { blocchi, salti, cambi } = decodifica(new Uint8Array(readFileSync(percorso)));

// l'ingombro, e tutto riportato all'origine
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const b of blocchi) for (const p of b.punti) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
for (const b of blocchi) b.punti = b.punti.map((p) => ({ x: p.x - minX, y: p.y - minY }));
const W = maxX - minX, H = maxY - minY;

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);
const q = (v: number[], f: number): number => (v.length ? v[Math.min(v.length - 1, Math.round(f * (v.length - 1)))] : 0);

console.log('');
console.log(`DST A MANO: ${basename(percorso)} · ${n1(W)} × ${n1(H)} mm · ${blocchi.length} blocchi · ${salti} salti · ${cambi} cambi colore (${cambi + 1} aghi)`);

// per ago: punti, filo, lunghezza dei punti, e le DIREZIONI usate
const aghi = cambi + 1;
for (let c = 0; c < aghi; c++) {
  const miei = blocchi.filter((b) => b.colore === c);
  if (!miei.length) continue;
  const lung: number[] = [];
  const ang = new Array<number>(18).fill(0);            // istogramma a 10 gradi, modulo 180
  let filo = 0, punti = 0;
  for (const b of miei) {
    for (let i = 1; i < b.punti.length; i++) {
      const dx = b.punti[i].x - b.punti[i - 1].x, dy = b.punti[i].y - b.punti[i - 1].y;
      const l = Math.hypot(dx, dy);
      lung.push(l); filo += l; punti++;
      // solo i punti lunghi contano come direzione del raso: i corti sono il giro in fondo
      if (l > 1.5) {
        let a = (Math.atan2(dy, dx) * 180) / Math.PI; if (a < 0) a += 180; if (a >= 180) a -= 180;
        ang[Math.min(17, Math.floor(a / 10))] += l;
      }
    }
  }
  lung.sort((a, b) => a - b);
  const totAng = ang.reduce((s, v) => s + v, 0) || 1;
  const istogramma = ang.map((v) => (v / totAng > 0.02 ? String(Math.round((v / totAng) * 100)).padStart(2) : ' .')).join(' ');
  const blocchiLunghi = miei.filter((b) => b.punti.length > 20).length;
  console.log(`  ago ${c + 1}: ${miei.length} blocchi (${blocchiLunghi} con piu' di 20 punti) · ${punti} punti · ${n1(filo / 1000)} m`);
  console.log(`         punto: mediana ${n2(q(lung, 0.5))} mm · p10 ${n2(q(lung, 0.1))} · p90 ${n2(q(lung, 0.9))} · massimo ${n2(q(lung, 1))}`);
  console.log(`         direzioni (% del filo lungo, ogni 10°, 0→170): ${istogramma}`);
}

// la densita', come in densita.ts: celle da 2 mm, solo il filo
const CELLA = 2;
const cols = Math.ceil(W / CELLA) + 1, rows = Math.ceil(H / CELLA) + 1;
const filoCella = new Float64Array(cols * rows);
for (const b of blocchi) {
  for (let i = 1; i < b.punti.length; i++) {
    const a = b.punti[i - 1], c = b.punti[i];
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    const n = Math.max(1, Math.ceil(d / (CELLA * 0.5)));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const cx = Math.floor((a.x + (c.x - a.x) * t) / CELLA), cy = Math.floor((a.y + (c.y - a.y) * t) / CELLA);
      if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) filoCella[cy * cols + cx] += d / n;
    }
  }
}
// contano le celle piene: quelle con almeno un quarto della densita' mediana delle celle ricamate
const tutte = Array.from(filoCella).filter((v) => v > 0).map((v) => v / (CELLA * CELLA)).sort((a, b) => a - b);
const soglia = q(tutte, 0.5) * 0.35;
const piene = tutte.filter((v) => v >= soglia);
console.log('');
console.log(`DENSITÀ (celle da ${CELLA} mm, ${piene.length} celle piene): p5 ${n2(q(piene, 0.05))} · mediana ${n2(q(piene, 0.5))} · p95 ${n2(q(piene, 0.95))} mm di filo per mm² · p95/p5 ${(q(piene, 0.95) / Math.max(1e-9, q(piene, 0.05))).toFixed(1)}×`);
console.log(`  → spaziatura equivalente ${n2(1 / q(piene, 0.5))} mm · celle sopra il 150% della mediana: ${((piene.filter((v) => v > q(piene, 0.5) * 1.5).length / piene.length) * 100).toFixed(0)}%`);

// i disegni: tutto insieme, e uno per ago
const dir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const nome = basename(percorso).replace(/\.dst$/i, '');
const tinte: Array<[number, number, number]> = [[3, 34, 79], [28, 67, 102], [115, 145, 160], [170, 170, 150], [200, 120, 60], [60, 160, 90]];
const tutto = new Tela(W, H, PX);
for (const b of blocchi) { const [r, g, bl] = tinte[b.colore % tinte.length]; tutto.linea(b.punti as Polyline, r, g, bl); }
tutto.salva(`${dir}${nome}.png`);
for (let c = 0; c < aghi; c++) {
  const sola = new Tela(W, H, PX);
  for (const b of blocchi.filter((x) => x.colore === c)) sola.linea(b.punti as Polyline, 20, 40, 120);
  sola.salva(`${dir}${nome}-ago-${c + 1}.png`);
}
console.log(`→ ${dir}${nome}.png e ${nome}-ago-N.png (${PX} px/mm)`);
console.log('');

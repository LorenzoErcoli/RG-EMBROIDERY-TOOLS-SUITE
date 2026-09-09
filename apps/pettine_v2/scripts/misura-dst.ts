// I PARAMETRI DI UN DST GIA' FATTO, misurati dal filo.
//
// Serve quando un file e' uscito dal tool e non si sa piu' con che numeri: il DST non porta ancora
// dentro il progetto (R9/R27 — la riapertura e' da fare), ma il ricamo e' fatto di quei numeri e
// quindi li si puo' rileggere dal filo. Cosa si misura, e come:
//   * i DENTI si riconoscono perche' il filo torna dov'era: tre punti a-b-a con |a-b| che e' la
//     lunghezza del dente. Min, mediana e massimo dicono «lunghezza punto».
//   * l'INTERLINEA e' la distanza fra le radici di due denti consecutivi lungo la stessa riga.
//   * la DISTANZA FRA LE RIGHE si misura da ogni radice alla radice piu' vicina che NON sia una
//     delle sue vicine di riga: e' la riga accanto.
//   * l'APERTURA e' quanto i denti si scostano, in gradi, dalla direzione media dei denti attorno.
//   * il RITAGLIO e' l'ingombro del ricamo (il DST parte dall'angolo dello swatch).
//
//   npx esbuild apps/pettine_v2/scripts/misura-dst.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine_v2/scripts/misura-dst.mjs
//   node apps/pettine_v2/scripts/misura-dst.mjs <file.dst>

import { readFileSync } from 'node:fs';
import { readDst, readDstMetadata, type Point } from '@rg/core';

const file = process.argv[2];
if (!file) { console.error('uso: node misura-dst.mjs <file.dst>'); process.exit(1); }
const bytes = new Uint8Array(readFileSync(file));
const letto = readDst(bytes);
const meta = readDstMetadata(bytes);

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const mediana = (v: number[]): number => (v.length ? [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)] : 0);
const perc = (v: number[], p: number): number => (v.length ? [...v].sort((x, y) => x - y)[Math.min(v.length - 1, Math.floor(v.length * p))] : 0);
const n2 = (v: number): string => v.toFixed(2).replace('.', ',');

console.log(`\n${file}`);
console.log(`etichetta «${letto.label}» · ${letto.blocks.length} blocchi · ${letto.recordCount} record · ${bytes.length} byte`);
if (meta) console.log(`progetto dentro il file: ${JSON.stringify(meta).slice(0, 400)}`);
else console.log('progetto dentro il file: NON C\'E\' (i parametri qui sotto sono misurati dal filo)');

// --- l'ingombro, cioe' il ritaglio -------------------------------------------------------------------
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, punti = 0, filo = 0;
const aghi = new Set<number>();
for (const b of letto.blocks) {
  aghi.add(b.needle);
  for (let i = 0; i < b.points_mm.length; i++) {
    const [x, y] = b.points_mm[i];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    punti++;
    if (i) filo += Math.hypot(x - b.points_mm[i - 1][0], y - b.points_mm[i - 1][1]);
  }
}
console.log(`\nINGOMBRO ${n2(x1 - x0)} × ${n2(y1 - y0)} mm · ${punti} punti · ${n2(filo / 1000)} m di filo · ${aghi.size} aghi`);

// --- i punti lunghi: un punto cucito da 15 mm attraversa il ricamo e si vede ------------------------
{
  const lunghi: Array<{ da: Point; a: Point; mm: number; ago: number; blocco: number; dove: number }> = [];
  letto.blocks.forEach((b, bi) => {
    for (let i = 1; i < b.points_mm.length; i++) {
      const a2 = { x: b.points_mm[i - 1][0], y: b.points_mm[i - 1][1] }, b2 = { x: b.points_mm[i][0], y: b.points_mm[i][1] };
      const d = dist(a2, b2);
      if (d >= 12) lunghi.push({ da: a2, a: b2, mm: d, ago: b.needle, blocco: bi, dove: i });
    }
  });
  console.log(`
PUNTI LUNGHI (12 mm e oltre, la macchina li spezza ma restano dritti): ${lunghi.length}`);
  for (const l of lunghi.sort((x, y) => y.mm - x.mm).slice(0, 15)) {
    console.log(`  ${n2(l.mm)} mm · ago ${l.ago} · blocco ${l.blocco} punto ${l.dove} · da (${n2(l.da.x)},${n2(l.da.y)}) a (${n2(l.a.x)},${n2(l.a.y)})`);
  }
}

// --- i denti: tre punti a-b-a -------------------------------------------------------------------------
interface Dente { radice: Point; punta: Point; ago: number; blocco: number }
const denti: Dente[] = [];
letto.blocks.forEach((b, bi) => {
  const p = b.points_mm.map(([x, y]) => ({ x, y }));
  for (let i = 1; i + 1 < p.length; i++) {
    if (dist(p[i - 1], p[i + 1]) < 0.25 && dist(p[i - 1], p[i]) > 0.8) denti.push({ radice: p[i - 1], punta: p[i], ago: b.needle, blocco: bi });
  }
});
const lung = denti.map((d) => dist(d.radice, d.punta));
console.log(`\nDENTI ${denti.length} · lunghezza da ${n2(Math.min(...lung))} a ${n2(Math.max(...lung))} mm`);
console.log(`  il 5° percentile e' ${n2(perc(lung, 0.05))} e il 95° ${n2(perc(lung, 0.95))}: «lunghezza punto» stava fra ${Math.round(perc(lung, 0.05))} e ${Math.round(perc(lung, 0.95))} mm`);

// --- l'interlinea: da una radice alla successiva sulla stessa riga --------------------------------------
const passi: number[] = [];
for (let i = 1; i < denti.length; i++) {
  if (denti[i].blocco !== denti[i - 1].blocco) continue;
  const d = dist(denti[i - 1].radice, denti[i].radice);
  if (d > 0.2 && d < 12) passi.push(d);
}
console.log(`\nINTERLINEA (densita' del pettine) mediana ${n2(mediana(passi))} mm · fra ${n2(perc(passi, 0.1))} e ${n2(perc(passi, 0.9))}`);

// --- la distanza fra le righe: la radice piu' vicina che non e' di questa riga ---------------------------
// griglia per non confrontare tutti con tutti
const CELL = 8;
const cellaDi = (p: Point): string => `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
const mappa = new Map<string, number[]>();
denti.forEach((d, i) => { const k = cellaDi(d.radice); const l = mappa.get(k) ?? []; l.push(i); mappa.set(k, l); });
const righe: number[] = [];
for (let i = 0; i < denti.length; i += 3) {
  const a = denti[i];
  let best = Infinity;
  const cx = Math.floor(a.radice.x / CELL), cy = Math.floor(a.radice.y / CELL);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    for (const j of mappa.get(`${cx + dx},${cy + dy}`) ?? []) {
      if (j === i || denti[j].ago !== a.ago) continue;
      // vicini di riga: quelli a meno di due interlinee lungo la riga
      if (Math.abs(j - i) <= 2 && denti[j].blocco === a.blocco) continue;
      const d = dist(a.radice, denti[j].radice);
      if (d > 0.3 && d < best) best = d;
    }
  }
  if (best < 20) righe.push(best);
}
console.log(`DISTANZA FRA LE RIGHE mediana ${n2(mediana(righe))} mm · fra ${n2(perc(righe, 0.15))} e ${n2(perc(righe, 0.85))}`);

// --- l'apertura: quanto ogni dente si scosta dalla direzione media dei denti vicini ---------------------
const gradi: number[] = [];
for (let i = 2; i + 2 < denti.length; i++) {
  if (denti[i - 2].blocco !== denti[i + 2].blocco) continue;
  let sx = 0, sy = 0;
  for (const k of [i - 2, i - 1, i + 1, i + 2]) {
    const v = { x: denti[k].punta.x - denti[k].radice.x, y: denti[k].punta.y - denti[k].radice.y };
    const l = Math.hypot(v.x, v.y) || 1; sx += v.x / l; sy += v.y / l;
  }
  const lm = Math.hypot(sx, sy) || 1; sx /= lm; sy /= lm;
  const v = { x: denti[i].punta.x - denti[i].radice.x, y: denti[i].punta.y - denti[i].radice.y };
  const l = Math.hypot(v.x, v.y) || 1;
  const cos = Math.max(-1, Math.min(1, (v.x * sx + v.y * sy) / l));
  gradi.push((Math.acos(cos) * 180) / Math.PI);
}
console.log(`APERTURA scarto mediano ${n2(mediana(gradi))}° · 90° dei denti entro ${n2(perc(gradi, 0.9))}°: il parametro valeva circa ${Math.round(perc(gradi, 0.97))}°`);

// --- l'ordine e i passaggi -----------------------------------------------------------------------------
let saltiMm = 0;
for (let i = 1; i < letto.blocks.length; i++) {
  const a = letto.blocks[i - 1].points_mm[letto.blocks[i - 1].points_mm.length - 1];
  const b = letto.blocks[i].points_mm[0];
  saltiMm += Math.hypot(a[0] - b[0], a[1] - b[1]);
}
console.log(`\nSALTI ${letto.blocks.length - 1} per ${n2(saltiMm / 1000)} m · punti sotto il millimetro: ${(() => {
  let n = 0;
  for (const b of letto.blocks) for (let i = 1; i < b.points_mm.length; i++) {
    const d = Math.hypot(b.points_mm[i][0] - b.points_mm[i - 1][0], b.points_mm[i][1] - b.points_mm[i - 1][1]);
    if (d < 1 && d > 0.01) n++;
  }
  return n;
})()}`);

// LA SFRANGIATURA, MISURATA sul ricamo vero: cosa cambia, e soprattutto cosa NON cambia.
//
//   npx esbuild apps/sfrangiatura/scripts/prova.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/sfrangiatura/scripts/prova.mjs
//   node apps/sfrangiatura/scripts/prova.mjs BRIEFING-RASO-OMOGENEO/riferimento-a-mano.dst
import { readFileSync } from 'node:fs';
import { readDst, buildDst, dstProgramFromBlocks, type Point } from '@rg/core';
import { sfrangia } from '../src/frange.ts';

const n2 = (v: number): string => v.toFixed(2);
const percorso = process.argv[2];
const letto = readDst(new Uint8Array(readFileSync(percorso)));

// ingombro, per ritagliare una zona di prova dove due fasce si affacciano
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const b of letto.blocks) for (const [x, y] of b.points_mm) {
  if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
}
console.log(`\n${percorso}\n${letto.blocks.length} blocchi · ${letto.stitchCount} punti · ${n2(maxX - minX)} x ${n2(maxY - minY)} mm`);

const rett = (x0: number, y0: number, x1: number, y1: number): Point[] =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

const params = { minMm: 1, maxMm: 5, virataDeg: 8, seme: 1 };
const puntoPiuLungo = (bs: Array<{ points_mm: Array<[number, number]> }>): number => {
  let m = 0;
  for (const b of bs) for (let i = 1; i < b.points_mm.length; i++) {
    const l = Math.hypot(b.points_mm[i][0] - b.points_mm[i - 1][0], b.points_mm[i][1] - b.points_mm[i - 1][1]);
    if (l > m) m = l;
  }
  return m;
};
const uguali = (a: Array<{ points_mm: Array<[number, number]> }>, b: Array<{ points_mm: Array<[number, number]> }>): number => {
  let diversi = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].points_mm.length; j++) {
    if (a[i].points_mm[j][0] !== b[i].points_mm[j][0] || a[i].points_mm[j][1] !== b[i].points_mm[j][1]) diversi++;
  }
  return diversi;
};

// 1. nessuna zona marcata: il file non deve cambiare di un byte
const vuoto = sfrangia(letto.blocks, [], params);
const byteA = buildDst(dstProgramFromBlocks(letto.blocks, { label: letto.label }));
const byteB = buildDst(dstProgramFromBlocks(vuoto.blocchi, { label: letto.label }));
console.log(`\nZONA VUOTA  → capi allungati ${vuoto.allungati} · byte identici: ${byteA.length === byteB.length && byteA.every((v, i) => v === byteB[i])}`);

// 2. una striscia in mezzo al disegno
const y0 = minY + (maxY - minY) * 0.42, y1 = y0 + 8;
const zona = [rett(minX, y0, maxX, y1)];
const uno = sfrangia(letto.blocks, zona, params);
console.log(`\nSTRISCIA di 8 mm (y ${n2(y0)}..${n2(y1)})`);
console.log(`  capi allungati        ${uno.allungati}`);
console.log(`  frangia media         ${n2(uno.frangiaMediaMm)} mm (chiesta fra ${params.minMm} e ${params.maxMm})`);
console.log(`  saltati               attacco/stacco ${uno.saltati.attaccoOStacco} · fila corta ${uno.saltati.filaCorta} · senza direzione ${uno.saltati.fuoriRaso}`);
console.log(`  accorciati dal limite ${uno.limitate}`);
console.log(`  punti diversi         ${uguali(letto.blocks, uno.blocchi)} su ${letto.stitchCount} (devono essere esattamente i capi allungati)`);
console.log(`  punto piu' lungo      prima ${n2(puntoPiuLungo(letto.blocks))} mm → dopo ${n2(puntoPiuLungo(uno.blocchi))} mm`);

// 3. determinismo: stesso seme = stesso ricamo, seme diverso = ricamo diverso
const bis = sfrangia(letto.blocks, zona, params);
const altro = sfrangia(letto.blocks, zona, { ...params, seme: 2 });
console.log(`\n  stesso seme → punti diversi: ${uguali(uno.blocchi, bis.blocchi)} (deve essere 0)`);
console.log(`  seme 2      → punti diversi: ${uguali(uno.blocchi, altro.blocchi)} (deve essere > 0)`);

// 4. e la stessa striscia marcata due volte non raddoppia la frangia (si riparte sempre dall'originale)
const lung: number[] = [];
for (let i = 0; i < uno.blocchi.length; i++) for (let j = 0; j < uno.blocchi[i].points_mm.length; j++) {
  const a = letto.blocks[i].points_mm[j], b = uno.blocchi[i].points_mm[j];
  if (a[0] !== b[0] || a[1] !== b[1]) lung.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
}
lung.sort((a, b) => a - b);
if (lung.length) {
  const q = (t: number): number => lung[Math.min(lung.length - 1, Math.round(t * (lung.length - 1)))];
  console.log(`\n  spostamento dei capi: minimo ${n2(lung[0])} · mediana ${n2(q(0.5))} · massimo ${n2(q(1))} mm`);
}

// --- 5. l'INTRECCIO: quante frange vicine si incrociano davvero, al variare dell'apertura
console.log('\nINCROCI (le X) — apertura in gradi → coppie di frange vicine che si tagliano');
for (const g of [0, 5, 10, 15, 25, 40, 55]) {
  const e = sfrangia(letto.blocks, zona, { ...params, incrocioDeg: g });
  console.log(`  ${String(g).padStart(3)}°  ${String(e.incroci).padStart(5)} incroci · ${n2(e.incrociPerFrangia)} per frangia · frangia media ${n2(e.frangiaMediaMm)} mm`);
}

// --- 6. e quanto costa la varieta' delle lunghezze? Due frange di lunghezza molto diversa non
// arrivano a tagliarsi: e' un compromesso fra "irregolare" e "incrociato", e va misurato.
console.log('\nLUNGHEZZA vs INCROCI (apertura 25°)');
for (const [a, b] of [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [1, 3], [3, 8]] as Array<[number, number]>) {
  const e = sfrangia(letto.blocks, zona, { ...params, minMm: a, maxMm: b, incrocioDeg: 25 });
  console.log(`  ${a}–${b} mm   ${String(e.incroci).padStart(5)} incroci · ${n2(e.incrociPerFrangia)} per frangia · media ${n2(e.frangiaMediaMm)} mm`);
}

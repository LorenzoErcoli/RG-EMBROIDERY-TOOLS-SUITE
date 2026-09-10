// Taratura dei numeri del metodo, misurata invece che ereditata.
//
// Jobard & Lefer propongono `d_test = 0.5 · d_sep` — ma il loro problema era **guardare** un campo
// vettoriale, dove qualche fila in più o in meno non cambia niente. Qui la stessa scelta diventa
// filo: `d_test` è quanto una fila può avvicinarsi a un'altra prima di fermarsi, cioè *quanto si
// può ingrossare il ricamo*; `seedRatio` è quanto dev'essere largo il vuoto perché nasca una fila
// nuova, cioè *quanto si può aprire*. Sono le due facce della densità e vanno decise col metro
// (R30: una divergenza numerica è una decisione, non un dettaglio).
//
// La colonna che comanda è **media/nom**: se l'utente chiede 0,4 mm di passo, il riempimento deve
// consegnare 2,5 mm di filo per mm². Un CV basso su una densità sbagliata è un ricamo uniformemente
// sbagliato.
//
//   npx esbuild apps/pittorico/scripts/taratura.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/taratura.mjs
//   node apps/pittorico/scripts/taratura.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fillThreadMm } from '@rg/core';
import { regioniDiProva } from '../src/sample.ts';
import { harmonicField, radialField, type DirectionField } from '../src/field.ts';
import { buildCurvedFill, type CurvedFillOptions } from '../src/curved-fill.ts';
import { coverageStats, neighbourSpacing } from '../src/coverage.ts';
import { regionBounds, type Region } from '@rg/core';

const SPACING_MM = 0.4;
const MAX_STITCH_MM = 3.0;
const NOM = 1 / SPACING_MM;

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const n2 = (v: number): string => v.toFixed(2);
const n3 = (v: number): string => v.toFixed(3);

const INTESTAZIONE = [
  'variante'.padEnd(22), 'file'.padStart(5), 'filo m'.padStart(7),
  'media/nom'.padStart(9), 'p50/nom'.padStart(8), 'CV'.padStart(7),
  'p05–p95/nom'.padStart(12), 'passo p05–p95'.padStart(14), 'max'.padStart(6), 'tempo'.padStart(7),
].join(' ');

function prova(etichetta: string, region: Region, field: DirectionField, opts: CurvedFillOptions): void {
  const t = Date.now();
  const r = buildCurvedFill(region, field, opts);
  const ms = Date.now() - t;
  const cov = coverageStats(r.runs, region, SPACING_MM);
  const sp = neighbourSpacing(r.runs, SPACING_MM);
  console.log(`   ${etichetta.padEnd(22)} ${String(r.runs.length).padStart(5)} ${n2(fillThreadMm(r.runs) / 1000).padStart(7)} ${n2(cov.media / NOM).padStart(9)} ${n2(cov.p50 / NOM).padStart(8)} ${pct(cov.cv).padStart(7)} ${`${n2(cov.p05 / NOM)}–${n2(cov.p95 / NOM)}`.padStart(12)} ${`${n3(sp.p05)}–${n3(sp.p95)}`.padStart(14)} ${n3(sp.max).padStart(6)} ${`${ms}ms`.padStart(7)}`);
}

for (const caso of regioniDiProva()) {
  const { region } = caso;
  const field: DirectionField = caso.campo.tipo === 'radiale'
    ? radialField(caso.campo.centro)
    : harmonicField(region, { cellMm: 1, levels: 4, sweeps: 300 });

  console.log(`\n── ${caso.id} — ${caso.descrizione}`);
  console.log(`   ${INTESTAZIONE}`);

  console.log('   · quanto una fila può AVVICINARSI (d_test / d_sep), seed 0.95');
  for (const testRatio of [0.4, 0.5, 0.6, 0.65, 0.7, 0.8]) {
    prova(`d_test ${n2(testRatio)}`, region, field,
      { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, testRatio, seedRatio: 0.95 });
  }

  console.log('   · quanto dev\'essere largo il vuoto perché nasca una fila (seed), d_test 0.65');
  for (const seedRatio of [0.7, 0.8, 0.9, 0.95, 1.0]) {
    prova(`seed ${n2(seedRatio)}`, region, field,
      { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, testRatio: 0.65, seedRatio });
  }

  console.log('   · passo di integrazione: la distanza fra file si misura sui PUNTI, quindi il passo è la sua risoluzione');
  for (const div of [2, 3, 4, 6, 8]) {
    prova(`step d_sep/${div}`, region, field,
      { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, testRatio: 0.65, seedRatio: 0.95, stepMm: SPACING_MM / div });
  }

  console.log("   · il PUNTO-AGO contro la densità: la corda taglia la curva e si posa sulla fila vicina");
  console.log(`   ${'variante'.padEnd(22)} ${'punti'.padStart(7)} ${'passo min'.padStart(10)} ${'x passo'.padStart(8)} ${'sotto mezzo passo'.padStart(18)}`);
  for (const pm of [0, 1, 2, 3, 5]) {
    const g = buildCurvedFill(region, field, { spacingMm: SPACING_MM, maxStitchMm: pm });
    const sp = neighbourSpacing(g.runs, SPACING_MM);
    console.log(`   ${(pm === 0 ? 'senza punti (geometria)' : `punto max ${pm} mm`).padEnd(22)} ${String(g.runs.reduce((a, r) => a + r.length, 0)).padStart(7)} ${n3(sp.min).padStart(10)} ${n2(sp.min / SPACING_MM).padStart(8)} ${pct(sp.quotaSottoMezzoPasso).padStart(18)}`);
  }

  console.log("   · quanto la corda può scostarsi dalla curva (punto massimo 3 mm)");
  for (const q of [0, 1 / 16, 1 / 8, 1 / 4, 1 / 2]) {
    const g = buildCurvedFill(region, field, { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, maxSagittaMm: q === 0 ? 0 : SPACING_MM * q });
    const sp = neighbourSpacing(g.runs, SPACING_MM);
    console.log(`   ${(q === 0 ? 'corda libera' : `corda d_sep/${(1 / q).toFixed(0)}`).padEnd(22)} ${String(g.runs.reduce((a, r) => a + r.length, 0)).padStart(7)} ${n3(sp.min).padStart(10)} ${n2(sp.min / SPACING_MM).padStart(8)} ${pct(sp.quotaSottoMezzoPasso).padStart(18)}`);
  }

  console.log('   · disturbo sulla soglia di arresto: contro gli anelli concentrici (CV a celle 2/4/8 mm)');
  for (const jitterRatio of [0, 0.1, 0.2, 0.3, 0.5]) {
    const r = buildCurvedFill(region, field, { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, jitterRatio });
    const c2 = coverageStats(r.runs, region, SPACING_MM, 2);
    const c4 = coverageStats(r.runs, region, SPACING_MM, 4);
    const c8 = coverageStats(r.runs, region, SPACING_MM, 8);
    console.log(`   ${`jitter ${n2(jitterRatio)}`.padEnd(22)} ${String(r.runs.length).padStart(5)} ${n2(fillThreadMm(r.runs) / 1000).padStart(7)} ${n2(c2.media / NOM).padStart(9)} ${'-'.padStart(8)} ${pct(c2.cv).padStart(7)} ${`${pct(c4.cv)} / ${pct(c8.cv)}`.padStart(12)}`);
  }
}
console.log('');

// Il confronto da GUARDARE, non da leggere: gli anelli concentrici ci sono o no?
{
  const caso = regioniDiProva().find((r) => r.id === 'ventaglio');
  if (caso && caso.campo.tipo === 'radiale') {
    const field = radialField(caso.campo.centro);
    const varianti = [0, 0.3].map((jitterRatio) => ({
      jitterRatio,
      runs: buildCurvedFill(caso.region, field, { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, jitterRatio }).runs,
    }));
    const bb = regionBounds(caso.region);
    const m = 8, gap = 6;
    const panH = bb.maxY - bb.minY + 2 * m + 12;
    const totW = bb.maxX - bb.minX + 2 * m;
    const pannelli = varianti.map((v, i) => {
      const dx = -bb.minX + m, dy = i * (panH + gap) - bb.minY + m + 12;
      const filo = v.runs.map((r) => `<polyline points="${r.map((p) => `${(p.x + dx).toFixed(3)},${(p.y + dy).toFixed(3)}`).join(' ')}" />`).join('');
      const cv = coverageStats(v.runs, caso.region, SPACING_MM, 2).cv;
      return `  <g>
    <text x="${m}" y="${i * (panH + gap) + 8}" font-family="monospace" font-size="4">disturbo ${n2(v.jitterRatio)} · ${v.runs.length} file · CV ${pct(cv)}</text>
    <g fill="none" stroke="#111111" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">${filo}</g>
  </g>`;
    }).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totW.toFixed(2)}mm" height="${(panH * 2 + gap).toFixed(2)}mm" viewBox="0 0 ${totW.toFixed(2)} ${(panH * 2 + gap).toFixed(2)}">\n${pannelli}\n</svg>\n`;
    const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).replace(/\/?$/, '/');
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}ventaglio-disturbo.svg`, svg);
    console.log(`confronto anelli → ${dir}ventaglio-disturbo.svg`);
  }
}

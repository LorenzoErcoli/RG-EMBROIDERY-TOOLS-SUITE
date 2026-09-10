// Punto 1 del piano — il PROTOTIPO HEADLESS, e la misura che decide se il tool sta in piedi.
//
// Su ogni regione di prova si riempie tre volte, con lo stesso passo:
//   A. **rettilineo** — `buildParallelFill` del core (R24), all'angolo medio del campo. È il
//      termine di paragone: il passo lì è costante per costruzione, quindi la sua dispersione è il
//      rumore di fondo della misura, non un difetto del riempimento.
//   B. **curvo ingenuo** — file seminate a passo costante su una retta e lasciate correre. Serve a
//      far vedere che il problema esiste davvero.
//   C. **curvo a distanza costante** — Jobard & Lefer: le file nascono e muoiono da sole.
//
// Si esegue così, dalla radice del repo:
//   npx esbuild apps/pittorico/scripts/misura.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/misura.mjs
//   node apps/pittorico/scripts/misura.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { buildParallelFill, fillThreadMm, type Polyline } from '@rg/core';
import { regioniDiProva } from '../src/sample.ts';
import { harmonicField, radialField, meanFieldAngleDeg, type DirectionField } from '../src/field.ts';
import { buildCurvedFill, buildNaiveCurvedFill } from '../src/curved-fill.ts';
import { coverageStats, neighbourSpacing, containment } from '../src/coverage.ts';
import { regionBounds, type Region } from '@rg/core';

const SPACING_MM = 0.4;      // R22 `densitySpacingMm` — passo fra due file vicine
const MAX_STITCH_MM = 3.0;   // R4
const THREAD_STROKE_MM = 0.1;  // R15
const SHAPE_STROKE_MM = 0.15;  // R15

const outDir = process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(outDir, { recursive: true });

const n2 = (v: number): string => v.toFixed(2);
const n3 = (v: number): string => v.toFixed(3);
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

interface Esito {
  nome: string;
  runs: Polyline[];
  puntiTotali: number;
  filoM: number;
  cv: number;
  p05: number; p95: number; fuoriBanda: number;
  passoMin: number; passoP05: number; passoP50: number; passoP95: number; passoMax: number;
  fuori: number; fuoriMaxMm: number; neiVuoti: number; vuotoMaxMm: number;
  ms: number;
}

function misura(nome: string, runs: Polyline[], region: Region, ms: number): Esito {
  const cov = coverageStats(runs, region, SPACING_MM);
  const sp = neighbourSpacing(runs, SPACING_MM);
  const con = containment(runs, region);
  return {
    nome, runs,
    puntiTotali: runs.reduce((s, r) => s + r.length, 0),
    filoM: fillThreadMm(runs) / 1000,
    cv: cov.cv, p05: cov.p05, p95: cov.p95, fuoriBanda: cov.fuoriBanda,
    passoMin: sp.min, passoP05: sp.p05, passoP50: sp.p50, passoP95: sp.p95, passoMax: sp.max,
    fuori: con.fuori, fuoriMaxMm: con.fuoriMaxMm, neiVuoti: con.neiVuoti, vuotoMaxMm: con.vuotoMaxMm,
    ms,
  };
}

function riga(e: Esito): string {
  const nominale = 1 / SPACING_MM;
  return [
    e.nome.padEnd(26),
    String(e.runs.length).padStart(5),
    n2(e.filoM).padStart(7),
    String(e.puntiTotali).padStart(7),
    pct(e.cv).padStart(8),
    `${n2(e.p05 / nominale)}–${n2(e.p95 / nominale)}`.padStart(12),
    pct(e.fuoriBanda).padStart(8),
    `${n2(e.passoP05)}–${n2(e.passoP95)}`.padStart(12),
    n2(e.passoMax).padStart(7),
    `${e.fuori}/${n2(e.fuoriMaxMm)}`.padStart(11),
    `${Math.round(e.ms)}ms`.padStart(8),
  ].join(' ');
}

const INTESTAZIONE = [
  'riempimento'.padEnd(26),
  'file'.padStart(5),
  'filo m'.padStart(7),
  'punti'.padStart(7),
  'CV cop.'.padStart(8),
  'p05–p95/nom'.padStart(12),
  'fuori±20%'.padStart(8),
  'passo p05–p95'.padStart(12),
  'passo max'.padStart(7),
  'fuori/mm'.padStart(11),
  'tempo'.padStart(8),
].join(' ');

function svgProve(region: Region, esiti: Esito[], titolo: string): string {
  const bb = regionBounds(region);
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
  const m = 8, gap = 6;
  const panH = h + 2 * m + 12;
  const totW = w + 2 * m;
  const totH = panH * esiti.length + gap * (esiti.length - 1);
  const poly = (pl: Polyline, dx: number, dy: number, chiuso: boolean): string =>
    `<${chiuso ? 'polygon' : 'polyline'} points="${pl.map((p) => `${(p.x + dx).toFixed(3)},${(p.y + dy).toFixed(3)}`).join(' ')}" />`;

  const pannelli = esiti.map((e, i) => {
    const dx = -bb.minX + m;
    const dy = i * (panH + gap) - bb.minY + m + 12;
    const forma = [region.outer, ...region.holes].map((r) => poly(r, dx, dy, true)).join('');
    const filo = e.runs.map((r) => poly(r, dx, dy, false)).join('');
    return `  <g>
    <text x="${m.toFixed(2)}" y="${(i * (panH + gap) + 8).toFixed(2)}" font-family="monospace" font-size="4">${e.nome} · CV ${pct(e.cv)} · ${n2(e.filoM)} m</text>
    <g fill="none" stroke="#bbbbbb" stroke-width="${SHAPE_STROKE_MM}">${forma}</g>
    <g fill="none" stroke="#111111" stroke-width="${THREAD_STROKE_MM}" stroke-linejoin="round" stroke-linecap="round">${filo}</g>
  </g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totW.toFixed(2)}mm" height="${totH.toFixed(2)}mm" viewBox="0 0 ${totW.toFixed(2)} ${totH.toFixed(2)}">
  <title>${titolo}</title>
${pannelli}
</svg>
`;
}

console.log(`\nPUNTO PITTORICO — prototipo del riempimento curvo`);
console.log(`passo ${SPACING_MM} mm · punto massimo ${MAX_STITCH_MM} mm · nominale ${(1 / SPACING_MM).toFixed(1)} mm di filo per mm²\n`);

const sommario: Array<{ id: string; region: Region; a: Esito; b: Esito; c: Esito }> = [];

for (const prova of regioniDiProva()) {
  const { region } = prova;
  const t0 = Date.now();
  const field: DirectionField = prova.campo.tipo === 'radiale'
    ? radialField(prova.campo.centro)
    : harmonicField(region, { cellMm: 1, levels: 4, sweeps: 300 });
  const tCampo = Date.now() - t0;
  const angolo = meanFieldAngleDeg(field, region);

  console.log(`── ${prova.id} — ${prova.descrizione}`);
  console.log(`   area ${region.areaMm2.toFixed(0)} mm² · campo ${prova.campo.tipo} in ${tCampo}ms · angolo medio ${angolo.toFixed(1)}°`);
  if ('sweepsUsed' in field) console.log(`   passate per livello: ${(field as { sweepsUsed: number[] }).sweepsUsed.join(', ')}`);

  const t1 = Date.now();
  const rettilineo = buildParallelFill(region.outer, region.holes, {
    angleDeg: angolo, spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM, mode: 'serpentine',
  });
  const a = misura('A · rettilineo (core)', rettilineo, region, Date.now() - t1);

  const t2 = Date.now();
  const ingenuo = buildNaiveCurvedFill(region, field, { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM });
  const b = misura('B · curvo ingenuo', ingenuo.runs, region, Date.now() - t2);

  const t3 = Date.now();
  const curvo = buildCurvedFill(region, field, { spacingMm: SPACING_MM, maxStitchMm: MAX_STITCH_MM });
  const c = misura('C · curvo a distanza cost.', curvo.runs, region, Date.now() - t3);

  console.log(`   ${INTESTAZIONE}`);
  for (const e of [a, b, c]) console.log(`   ${riga(e)}`);
  console.log(`   C: semi provati ${curvo.seedsTried}, corse buttate perché corte ${curvo.discardedShort}, punti di controllo ${curvo.integrationPoints}`);
  if (region.holes.length) {
    console.log(`   R5 — punti dentro il vuoto (oltre 0,05 mm):  A ${a.neiVuoti} (max ${n3(a.vuotoMaxMm)} mm) · B ${b.neiVuoti} (max ${n3(b.vuotoMaxMm)}) · C ${c.neiVuoti} (max ${n3(c.vuotoMaxMm)})`);
  }
  const dir = outDir.replace(/\/?$/, '/');
  writeFileSync(`${dir}${prova.id}.svg`, svgProve(region, [a, b, c], prova.id));
  writeFileSync(`${dir}${prova.id}-curvo.svg`, svgProve(region, [c], `${prova.id} — curvo a distanza costante`));
  console.log(`   anteprima → ${dir}${prova.id}.svg  (e ${prova.id}-curvo.svg, il solo C)\n`);
  sommario.push({ id: prova.id, region, a, b, c });
}

console.log('══ LA MISURA CHE DECIDE — dispersione della copertura, curvo contro rettilineo');
console.log(`   ${'regione'.padEnd(24)} ${'A rettil.'.padStart(10)} ${'B ingenuo'.padStart(10)} ${'C distanza cost.'.padStart(17)} ${'C/A'.padStart(6)} ${'B/A'.padStart(6)}`);
for (const s of sommario) {
  console.log(`   ${s.id.padEnd(24)} ${pct(s.a.cv).padStart(10)} ${pct(s.b.cv).padStart(10)} ${pct(s.c.cv).padStart(17)} ${n2(s.c.cv / s.a.cv).padStart(6)} ${n2(s.b.cv / s.a.cv).padStart(6)}`);
}
console.log('\n══ DISTANZA FRA FILE VICINE (mm) — deve stare in un intervallo dichiarabile');
console.log(`   ${'regione'.padEnd(24)} ${'A p05–p95'.padStart(14)} ${'B p05–p95'.padStart(14)} ${'C p05–p95'.padStart(14)} ${'B max'.padStart(7)} ${'C max'.padStart(7)}`);
for (const s of sommario) {
  console.log(`   ${s.id.padEnd(24)} ${`${n3(s.a.passoP05)}–${n3(s.a.passoP95)}`.padStart(14)} ${`${n3(s.b.passoP05)}–${n3(s.b.passoP95)}`.padStart(14)} ${`${n3(s.c.passoP05)}–${n3(s.c.passoP95)}`.padStart(14)} ${n2(s.b.passoMax).padStart(7)} ${n2(s.c.passoMax).padStart(7)}`);
}

// A che SCALA vive la variazione residua. Una dispersione misurata su celle da 1 mm è grana fine —
// il filo la nasconde; la stessa cifra su celle da 8 mm sarebbe una macchia, e si vedrebbe.
console.log('');
console.log('══ A CHE SCALA VIVE LA VARIAZIONE — CV della copertura al variare della cella di misura');
const CELLE = [1, 2, 4, 8];
console.log(`   ${'regione'.padEnd(24)} ${CELLE.map((c) => `${c}mm A/C`.padStart(13)).join(' ')}`);
for (const s of sommario) {
  const celle = CELLE.map((c) => {
    const a = coverageStats(s.a.runs, s.region, SPACING_MM, c).cv;
    const cc = coverageStats(s.c.runs, s.region, SPACING_MM, c).cv;
    return `${pct(a)}/${pct(cc)}`.padStart(13);
  });
  console.log(`   ${s.id.padEnd(24)} ${celle.join(' ')}`);
}
console.log('');

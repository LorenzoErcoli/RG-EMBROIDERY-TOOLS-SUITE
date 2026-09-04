// L'ORDINE DEL FILO, misurato — riempimento a distanza costante contro riempimento dalla rotaia.
//
// Nasce dalla critica di Lorenzo: *«mi aspetto che il riempimento sia molto preciso, con densità
// costanti dove possibile e accorgimenti quando la densità cambia. Ora vedo tante linee non
// ordinate»*. «Ordinato» sembra un giudizio e invece si misura, e la misura giusta è questa:
//
//   **quanti capi di punto finiscono SUL BORDO invece che a mezz'aria.**
//
// In un pettine ogni punto va da un bordo all'altro, quindi tutti i capi stanno sul bordo. Nel
// posizionamento a distanza costante le file si fermano quando incontrano una vicina, quindi i capi
// cadono in mezzo alla forma: è esattamente quello che si vede come «linee non ordinate».
//
// Le altre due misure che contano sono la **lunghezza dei punti** (in un pettine si somigliano
// tutti, nell'erba no) e naturalmente la **densità**, che non deve peggiorare per avere l'ordine.
//
//   npx esbuild apps/pittorico/scripts/ordine.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/ordine.mjs
//   node apps/pittorico/scripts/ordine.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { type Polyline, type Point } from '@rg/core';
import { regioniDiProva } from '../src/sample.ts';
import { harmonicField } from '../src/field.ts';
import { buildCurvedFill } from '../src/curved-fill.ts';
import { buildRailFill } from '../src/rail-fill.ts';
import { coverageStats, neighbourSpacing } from '../src/coverage.ts';
import { BoundaryIndex, regionRings, type Region } from '../src/region.ts';

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);
const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

const PASSO = 0.3;          // la densità scelta da Lorenzo sui provini
const PUNTO_MAX = 3;

const lung = (l: Polyline): number => {
  let mm = 0;
  for (let i = 1; i < l.length; i++) mm += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y);
  return mm;
};

interface Ordine {
  corse: number;
  capiSulBordo: number;      // quota di capi che finiscono sul bordo della forma
  lungMediana: number;
  lungP10: number;
  lungP90: number;
  filoM: number;
}

/** Quanto è ordinato un riempimento: i capi stanno sul bordo? i punti si somigliano? */
function ordine(runs: Polyline[], region: Region, tolMm: number): Ordine {
  const bordo = new BoundaryIndex(regionRings(region), 4);
  let capi = 0, sulBordo = 0;
  const lunghezze: number[] = [];
  for (const r of runs) {
    if (r.length < 2) continue;
    lunghezze.push(lung(r));
    for (const p of [r[0], r[r.length - 1]]) {
      capi++;
      if (bordo.nearest(p).distMm <= tolMm) sulBordo++;
    }
  }
  const o = lunghezze.slice().sort((a, b) => a - b);
  const q = (t: number): number => (o.length ? o[Math.min(o.length - 1, Math.round(t * (o.length - 1)))] : 0);
  return {
    corse: runs.length,
    capiSulBordo: capi ? sulBordo / capi : 0,
    lungMediana: q(0.5), lungP10: q(0.1), lungP90: q(0.9),
    filoM: lunghezze.reduce((s, v) => s + v, 0) / 1000,
  };
}

console.log('');
console.log('PUNTO PITTORICO — l\'ordine del filo, misurato');
console.log(`passo ${PASSO} mm (la densità scelta da Lorenzo sui provini)`);
console.log('');
console.log(`   ${'forma / metodo'.padEnd(34)} ${'corse'.padStart(6)} ${'capi sul bordo'.padStart(14)} ${'punto p10–p90'.padStart(15)} ${'filo m'.padStart(7)} ${'CV cop.'.padStart(8)} ${'passo p95'.padStart(10)}`);

const disegni: Array<{ nome: string; region: Region; runs: Polyline[] }> = [];

for (const prova of regioniDiProva()) {
  if (prova.campo.tipo !== 'armonico') continue;      // la rotaia ha senso su una fascia
  const { region } = prova;
  const campo = harmonicField(region, { cellMm: 1, levels: 4, sweeps: 300 });

  // La rotaia: metà del contorno di una banda è un fianco. Le regioni di prova sono costruite
  // come «lato sinistro + lato destro rovesciato», quindi la prima metà è una rotaia buona.
  const meta = Math.floor(region.outer.length / 2);
  const rotaia: Polyline = region.outer.slice(0, meta);

  const curvo = buildCurvedFill(region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX }).runs;
  const railAllineato = buildRailFill(region, campo, rotaia, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX, sfalsaCunei: 0 });
  const rail = buildRailFill(region, campo, rotaia, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX });

  for (const [nome, runs] of [
    ['a distanza costante', curvo],
    ['dalla rotaia, cunei allineati', railAllineato.runs],
    ['dalla rotaia, cunei sfalsati', rail.runs],
  ] as Array<[string, Polyline[]]>) {
    const o = ordine(runs, region, 0.35);
    const cov = coverageStats(runs, region, PASSO);
    const sp = neighbourSpacing(runs, PASSO);
    // le celle VUOTE: sono i buchi veri, e vanno contate a parte dalla dispersione — una zona
    // scoperta e una zona rada danno lo stesso CV ma non sono la stessa cosa sul ricamo
    const cov1 = coverageStats(runs, region, PASSO, 2);
    const vuote = cov1.min <= 1e-9 ? '≥1' : '0';
    console.log(`   ${`${prova.id} · ${nome}`.padEnd(34)} ${String(o.corse).padStart(6)} ${pct(o.capiSulBordo).padStart(14)} ${`${n1(o.lungP10)}–${n1(o.lungP90)}`.padStart(15)} ${n2(o.filoM).padStart(7)} ${pct(cov.cv).padStart(8)} ${n2(sp.p95).padStart(10)} ${`celle vuote ${vuote} · p05 ${n2(cov1.p05 / (1 / PASSO))}`.padStart(28)}`);
    disegni.push({ nome: `${prova.id} · ${nome}`, region, runs });
  }
  console.log(`   ${''.padEnd(34)} cunei per giro: allineati ${railAllineato.cuneiPerGiro.join('+')} · sfalsati ${rail.cuneiPerGiro.join('+')} (su ${rail.semi} semi)`);
  // a che SCALA vive la variazione: un fronte di cunei allineati si vede da lontano, una grana no
  for (const [nome, runs] of [['allineati', railAllineato.runs], ['sfalsati', rail.runs]] as Array<[string, Polyline[]]>) {
    const cv = [1, 2, 4, 8].map((c) => pct(coverageStats(runs, region, PASSO, c).cv)).join(' / ');
    console.log(`   ${''.padEnd(34)} CV a celle 1/2/4/8 mm, cunei ${nome.padEnd(10)} ${cv}`);
  }
}

console.log('');
console.log('   «capi sul bordo» è la misura dell\'ordine: in un pettine ogni punto va da un bordo');
console.log('   all\'altro, quindi tende al 100%. I capi che cadono in mezzo alla forma sono le file');
console.log('   che si sono fermate contro una vicina — ed è quello che si vede come disordine.');

// --------------------------------------------------------------------------------------------
const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });
{
  const gap = 6;
  const bb = disegni[0] ? disegni[0].region : null;
  if (bb) {
    const larghezze = disegni.map((d) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of d.region.outer) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      return { minX, maxX, minY, maxY };
    });
    const W = larghezze.reduce((s, b, i) => s + (b.maxX - b.minX) + (i ? gap : 0), 0) + 8;
    const H = Math.max(...larghezze.map((b) => b.maxY - b.minY)) + 14;
    let x = 4;
    const pezzi = disegni.map((d, i) => {
      const b = larghezze[i];
      const dx = x - b.minX, dy = 10 - b.minY;
      x += (b.maxX - b.minX) + gap;
      const poly = (l: Polyline, chiuso: boolean): string =>
        `<${chiuso ? 'polygon' : 'polyline'} points="${l.map((p: Point) => `${(p.x + dx).toFixed(1)},${(p.y + dy).toFixed(1)}`).join(' ')}" />`;
      return `  <g>
    <text x="${(x - (b.maxX - b.minX) - gap).toFixed(1)}" y="6" font-family="monospace" font-size="3.4" fill="#0d2340">${d.nome}</text>
    <g fill="none" stroke="#bbb2a0" stroke-width="0.2">${[d.region.outer, ...d.region.holes].map((l) => poly(l, true)).join('')}</g>
    <g fill="none" stroke="#0d2340" stroke-width="0.12" stroke-linecap="round">${d.runs.map((l) => poly(l, false)).join('')}</g>
  </g>`;
    }).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">
  <rect x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#efe8d8" />
${pezzi}
</svg>
`;
    writeFileSync(`${dir}ordine.svg`, svg);
    console.log('');
    console.log(`confronto → ${dir}ordine.svg  (${(svg.length / 1024).toFixed(0)} kB)`);
  }
}
console.log('');

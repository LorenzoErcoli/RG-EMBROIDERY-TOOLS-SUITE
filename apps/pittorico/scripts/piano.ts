// La catena intera su un ritaglio della cianotipia: da immagine a livelli d'esportazione.
//
//   npx esbuild apps/pittorico/scripts/piano.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/piano.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/piano.mjs <cianotipia.bmp>

import { writeFileSync, mkdirSync } from 'node:fs';
import { buildSvg, dstFromExportLayers, readDstMetadata, bounds, type Point } from '@rg/core';
import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';
import { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams } from '../src/pipeline.ts';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node piano.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
const intera = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / intera.width;

// un ritaglio: la catena intera sul disegno da 42 cm è un ricamo da centinaia di metri
// `RG_LATO_MM=0` prende il disegno intero: serve a confrontarsi col DST che è andato in macchina
const LATO_MM = Number(process.env.RG_LATO_MM ?? 90);
const LATO = LATO_MM > 0 ? Math.round(LATO_MM / MM_PER_PX) : Math.min(intera.width, intera.height);
const x0 = LATO_MM > 0 ? Math.round(intera.width * 0.52) : 0;
const y0 = LATO_MM > 0 ? Math.round(intera.height * 0.18) : 0;
const rgba = new Uint8ClampedArray(LATO * LATO * 4);
for (let y = 0; y < LATO; y++) {
  for (let x = 0; x < LATO; x++) {
    const s = ((y0 + y) * intera.width + (x0 + x)) * 4, d = (y * LATO + x) * 4;
    rgba[d] = intera.rgba[s]; rgba[d + 1] = intera.rgba[s + 1];
    rgba[d + 2] = intera.rgba[s + 2]; rgba[d + 3] = 255;
  }
}
const img = { rgba, width: LATO, height: LATO };

console.log('');
console.log(`PUNTO PITTORICO — la catena intera, su ${LATO_MM > 0 ? `un ritaglio di ${LATO_MM} mm` : 'tutto il disegno'}`);
const t0 = Date.now();
const plan = buildPittoricoPlan(img, {
  ...defaultPittoricoParams,
  realWidthMm: LATO * MM_PER_PX,
  metodoRiempimento: (process.env.RG_METODO as 'colonne' | 'fasce' | 'iso' | 'tracciato') ?? defaultPittoricoParams.metodoRiempimento,
  frangiaMm: process.env.RG_FRANGIA !== undefined ? Number(process.env.RG_FRANGIA) : defaultPittoricoParams.frangiaMm,
});
const ms = Date.now() - t0;

console.log(`${plan.larghezzaMm.toFixed(1)} x ${plan.altezzaMm.toFixed(1)} mm · ${ms} ms`);
console.log(`tinte ${plan.palette.length}, ordine di cucitura ${plan.ordine.join(' → ')}`);
console.log(`bordi: ${plan.bordiSfumati} sfumati su ${plan.bordiTotali} (${((plan.bordiSfumati / plan.bordiTotali) * 100).toFixed(0)}%)`);
console.log(`macchie ${plan.macchie.length} — dalla rotaia ${plan.macchie.filter((m) => m.metodo === 'rotaia').length}, a distanza costante ${plan.macchie.filter((m) => m.metodo === 'distanza').length}`);
console.log(`filo ${(plan.filoMm / 1000).toFixed(1)} m · ${plan.punti} punti`);
console.log(`salti ${plan.salti} · ${(plan.saltoMm / 1000).toFixed(2)} m in tutto (${((plan.saltoMm / plan.filoMm) * 100).toFixed(1)}% del filo) · il più lungo ${plan.saltoMassimoMm.toFixed(1)} mm`);
console.log('');
console.log('i passaggi, ago per ago (R16 — quanto filo per andare, e quanto se ne vede):');
for (const a of plan.passaggiPerAgo) {
  const q = a.passaggiMm > 0 ? (a.passaggiCopertiMm / a.passaggiMm) * 100 : 100;
  console.log(`   tinta ${a.tinta}  ${String(a.corse).padStart(6)} corse · `
    + `riempimento ${(a.riempimentoMm / 1000).toFixed(1)} m · passaggi ${(a.passaggiMm / 1000).toFixed(1)} m `
    + `(${((a.passaggiMm / a.riempimentoMm) * 100).toFixed(0)}% del riempimento, ${q.toFixed(0)}% nascosti) · `
    + `${a.stacchi} stacchi`);
  const c = a.perCaso;
  console.log(`            dritto ${c.dritto.volte}× ${(c.dritto.mm / 1000).toFixed(1)} m · `
    + `dentro ${c.interno.volte}× ${(c.interno.mm / 1000).toFixed(1)} m · `
    + `SUL CONTORNO ${c.contorno.volte}× ${(c.contorno.mm / 1000).toFixed(1)} m`);
}

const layers = pittoricoExportLayers(plan);
console.log('');
console.log('livelli d\'esportazione (uno per ago):');
for (const l of layers) console.log(`   ${l.id.padEnd(22)} ${l.color}  ${String(l.polylines.length).padStart(5)} corse`);

const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });
const tutti: Point[] = layers.flatMap((l) => l.polylines.flat());
const svg = buildSvg(layers, { bounds: bounds(tutti), marginMm: 4, metadata: { rgProject: 'pittorico', params: defaultPittoricoParams } });
writeFileSync(`${dir}piano.svg`, svg);
const dst = dstFromExportLayers(layers, { label: 'PITTORICO', metadata: { rgProject: 'pittorico', params: defaultPittoricoParams } });
writeFileSync(`${dir}piano.dst`, dst);
console.log('');
console.log(`SVG → ${dir}piano.svg  (${(svg.length / 1024).toFixed(0)} kB)`);
console.log(`DST → ${dir}piano.dst  (${(dst.length / 1024).toFixed(0)} kB) · si riapre: ${readDstMetadata(dst)?.rgProject}`);
console.log('');

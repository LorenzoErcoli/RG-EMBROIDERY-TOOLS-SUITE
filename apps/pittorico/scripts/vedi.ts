// VEDERE IL RICAMO — un PNG per ogni tinta, e uno con tutto, dal ritaglio di prova.
//
// Serve a chi lavora dal terminale: la misura dice QUANTO, l'immagine dice DOVE e COME. Dopo il
// riempimento a fasce e' diventato indispensabile — una densita' al 47% puo' essere «meta' delle
// corse mancano» o «le corse ci sono ma finiscono a meta' strada», e sono due bachi diversi.
//
//   npx esbuild apps/pittorico/scripts/vedi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/vedi.mjs
//   RG_METODO=fasce RG_FRANGIA=0 node --max-old-space-size=4096 apps/pittorico/scripts/vedi.mjs <bmp>

import { mkdirSync } from 'node:fs';
import { leggiBmp } from './bmp.ts';
import { Tela } from './png.ts';
import { buildPittoricoPlan, defaultPittoricoParams } from '../src/pipeline.ts';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node vedi.mjs <percorso.bmp>'); process.exit(1); }
const intera = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / intera.width;
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
const img = { width: LATO, height: LATO, rgba };
const plan = buildPittoricoPlan(img, {
  ...defaultPittoricoParams,
  realWidthMm: LATO * MM_PER_PX,
  metodoRiempimento: (process.env.RG_METODO as 'fasce' | 'iso' | 'tracciato') ?? defaultPittoricoParams.metodoRiempimento,
  derivaMassima: Number(process.env.RG_DERIVA ?? defaultPittoricoParams.derivaMassima),
  fasciaMm: Number(process.env.RG_FASCIA_MM ?? defaultPittoricoParams.fasciaMm),
  frangiaMm: process.env.RG_FRANGIA !== undefined ? Number(process.env.RG_FRANGIA) : defaultPittoricoParams.frangiaMm,
  cuciPassaggi: process.env.RG_SENZA_PASSAGGI !== '1',
});

const PX_PER_MM = Number(process.env.RG_PX_PER_MM ?? 8);
// una FINESTRA sul disegno, in mm: `RG_FINESTRA=x,y,lato`. Sul disegno intero a bassa
// risoluzione il ricamo e' un blocco pieno e la tessitura non si vede; una finestra da 60 mm a
// 8 px/mm e' quello che Lorenzo vede a schermo.
const finestra = process.env.RG_FINESTRA ? process.env.RG_FINESTRA.split(',').map(Number) : null;
const FX = finestra ? finestra[0] : 0, FY = finestra ? finestra[1] : 0;
const FW = finestra ? finestra[2] : plan.larghezzaMm, FH = finestra ? finestra[2] : plan.altezzaMm;
const sposta = (l: { x: number; y: number }[]): { x: number; y: number }[] =>
  finestra ? l.map((q) => ({ x: q.x - FX, y: q.y - FY })) : l;
const dir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const nome = process.env.RG_NOME ?? 'vedi';

// tutto insieme, ogni tinta col suo colore vero
const tutto = new Tela(FW, FH, PX_PER_MM);
// e i contorni delle macchie, in grigio, sotto
for (const m of plan.macchie) {
  for (const anello of [m.region.outer, ...m.region.holes]) tutto.linea(sposta([...anello, anello[0]]), 200, 200, 200);
}
for (const t of plan.ordine) {
  const [r, g, b] = plan.palette[t];
  const sola = new Tela(FW, FH, PX_PER_MM);
  for (const m of plan.macchie) {
    for (const anello of [m.region.outer, ...m.region.holes]) sola.linea(sposta([...anello, anello[0]]), 210, 210, 210);
  }
  for (const m of plan.macchie.filter((x) => x.tinta === t)) {
    for (const c of m.corse) { sola.linea(sposta(c), 20, 40, 120); tutto.linea(sposta(c), r, g, b); }
  }
  sola.salva(`${dir}${nome}-tinta-${t}.png`);
}
// il filo di passaggio, in rosso, sopra tutto
for (const a of plan.passaggiPerAgo) for (const v of a.vie) tutto.linea(sposta(v), 224, 36, 94);
tutto.salva(`${dir}${nome}.png`);
console.log(`→ ${dir}${nome}.png e ${dir}${nome}-tinta-N.png  (${tutto.w}×${tutto.h} px, ${PX_PER_MM} px/mm)`);
for (const m of plan.macchie) {
  if (m.metodo === 'fasce') console.log(`  tinta ${m.tinta} · ${m.region.areaMm2.toFixed(0)} mm² · ${m.rotaie} rotaie, ${m.fasce} fronti · ${m.chiusure} corse dal setaccio`);
}
console.log(`  macchie per metodo: ${['fasce', 'iso', 'rotaia', 'distanza'].map((m) => `${m} ${plan.macchie.filter((x) => x.metodo === m).length}`).join(' · ')}`);

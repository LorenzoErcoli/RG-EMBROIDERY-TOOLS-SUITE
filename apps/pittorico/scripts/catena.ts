// LA CATENA, IN UNA PAGINA: come il sistema divide in colori, e poi come ci cuce sopra.
//
// Lorenzo: «dammi le visualizzazioni che mi davi nel broccato, per capire come il sistema divide in
// colori e poi fa il ricamo con i passaggi». Nel tool ci sono cinque viste e si cambiano con un
// clic; questa e' la stessa cosa senza aprire l'app — quattro tappe una sotto l'altra, sullo stesso
// ritaglio e alla stessa inquadratura, cosi' si confrontano guardando invece di ricordando.
//
// Le viste NON sono ridisegnate qui: vengono da `src/viste.ts`, le stesse identiche che usa il tool.
// Se una cambia, cambiano tutte e due.
//
//   npx esbuild apps/pittorico/scripts/catena.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/catena.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/catena.mjs <cianotipia.bmp> [larghezzaMm]

import { writeFileSync, mkdirSync } from 'node:fs';
import { leggiBmp } from './bmp.ts';
import { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams } from '../src/pipeline.ts';
import { svgMacchie, svgRicamo, svgPassaggi, pixelDeiColori, foglio, COLORE_PASSAGGI } from '../src/viste.ts';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node catena.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
const intera = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / intera.width;

// un ritaglio, come negli altri script: la catena intera sul disegno da 42 cm sono minuti di calcolo
// e una pagina da decine di megabyte. `RG_LATO_MM=0` prende tutto.
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
const t0 = Date.now();
const plan = buildPittoricoPlan(img, { ...defaultPittoricoParams, realWidthMm: LATO * MM_PER_PX });
const strati = pittoricoExportLayers(plan);

/**
 * Una mappa di pixel dentro un SVG, senza librerie e senza file d'appoggio: si scrive un BMP a 24
 * bit (il formato piu' semplice che esista, ed e' lo stesso che questi script gia' leggono) e lo si
 * infila come data URI. Il browser i BMP li apre.
 */
function bmpDataUri(pixel: Uint8ClampedArray, w: number, h: number): string {
  const rigaVera = w * 3;
  const riga = (rigaVera + 3) & ~3;            // ogni riga BMP e' allineata a 4 byte
  const dati = riga * h;
  const b = new Uint8Array(54 + dati);
  const u32 = (off: number, v: number): void => {
    b[off] = v & 255; b[off + 1] = (v >> 8) & 255; b[off + 2] = (v >> 16) & 255; b[off + 3] = (v >> 24) & 255;
  };
  b[0] = 0x42; b[1] = 0x4d;                    // "BM"
  u32(2, b.length); u32(10, 54); u32(14, 40);
  u32(18, w); u32(22, h); b[26] = 1; b[28] = 24;
  u32(34, dati);
  for (let y = 0; y < h; y++) {
    // il BMP conta le righe dal basso
    const dst = 54 + (h - 1 - y) * riga;
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4, o = dst + x * 3;
      b[o] = pixel[src + 2]; b[o + 1] = pixel[src + 1]; b[o + 2] = pixel[src];
    }
  }
  return `data:image/bmp;base64,${Buffer.from(b).toString('base64')}`;
}

const immagineNelFoglio = (uri: string): string =>
  foglio(plan, `<image href="${uri}" x="0" y="0" width="${plan.larghezzaMm.toFixed(1)}" `
    + `height="${plan.altezzaMm.toFixed(1)}" style="image-rendering:pixelated" />`);

const n1 = (v: number): string => v.toFixed(1);
const perAgo = plan.passaggiPerAgo.map((a) => {
  const q = a.passaggiMm > 0 ? (a.passaggiCopertiMm / a.passaggiMm) * 100 : 100;
  return `<tr><td>tinta ${a.tinta}</td><td>${a.corse.toLocaleString('it-IT')}</td>`
    + `<td>${n1(a.riempimentoMm / 1000)} m</td><td>${n1(a.passaggiMm / 1000)} m</td>`
    + `<td>${q.toFixed(0)}%</td><td>${a.stacchi}</td>`
    + `<td>${a.perCaso.contorno.volte} · ${n1(a.perCaso.contorno.mm / 1000)} m</td></tr>`;
}).join('');

const pannelli: Array<[string, string, string]> = [
  ['Originale', 'il ritaglio com’è entrato: nessun vettore, solo pixel.',
    immagineNelFoglio(bmpDataUri(rgba, LATO, LATO))],
  ['Colori', 'la divisione in tinte, pixel per pixel. È il primo passo e decide tutto il resto: '
    + 'se qui una linea netta non c’è, non ci sarà nemmeno nel ricamo.',
    immagineNelFoglio(bmpDataUri(pixelDeiColori(plan), plan.larghezzaPx, plan.altezzaPx))],
  ['Macchie', 'le forme che il ricamo cucirà davvero, col loro contorno e i loro fori. Qui si '
    + 'vede cosa la tracciatura ha tenuto e cosa ha buttato.', svgMacchie(plan)],
  ['Ricamo', 'il filo com’è, un gruppo per ago nell’ordine di cucitura, disegnato a '
    + '0,1 mm (R15): mai una linea grassa che mente sulla copertura.', svgRicamo(plan, strati)],
  ['Passaggi', 'il ricamo smorzato, e sopra <b>solo il filo di collegamento</b>, in rosso. '
    + 'È la vista che mancava: se il rosso corre sul bordo, quella è la linea di contorno '
    + 'che mangia il degradé.', svgPassaggi(plan, strati)],
];

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Punto Pittorico — la catena</title>
<style>
  :root { color-scheme: light dark; --carta:#faf9f7; --inchiostro:#141414; --tenue:#6b6b6b; --linea:#dcdad5; }
  @media (prefers-color-scheme: dark) { :root { --carta:#141414; --inchiostro:#f2f0ec; --tenue:#9a9a9a; --linea:#333; } }
  body { margin:0; padding:2rem clamp(1rem,4vw,4rem); background:var(--carta); color:var(--inchiostro);
         font:15px/1.55 ui-sans-serif,system-ui,'Segoe UI',sans-serif; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  .sotto { color:var(--tenue); margin:0 0 2rem; max-width:62ch; }
  .griglia { display:grid; gap:2rem; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); }
  figure { margin:0; }
  figcaption { margin-bottom:.6rem; }
  figcaption b { display:block; font-size:1.05rem; }
  figcaption span { color:var(--tenue); font-size:.9rem; }
  .telaio { border:1px solid var(--linea); background:#fff; padding:.5rem; overflow:auto; }
  .telaio svg { display:block; width:100%; height:auto; }
  table { border-collapse:collapse; margin-top:2.5rem; font-size:.9rem; }
  th,td { border-bottom:1px solid var(--linea); padding:.35rem .8rem .35rem 0; text-align:left;
          font-variant-numeric:tabular-nums; }
  th { color:var(--tenue); font-weight:600; }
  .rosso { color:${COLORE_PASSAGGI}; }
</style></head><body>
<h1>Punto Pittorico — la catena, in una pagina</h1>
<p class="sotto">Lo stesso ritaglio di ${n1(plan.larghezzaMm)} × ${n1(plan.altezzaMm)} mm, quattro
tappe più l'originale. Si legge da sinistra a destra: prima l'immagine si divide in tinte, poi le
tinte diventano macchie cucibili, poi ci si cuce dentro, e alla fine si guarda
<span class="rosso">dove passa il filo</span> per andare da una corsa all'altra.</p>
<div class="griglia">
${pannelli.map(([t, d, svg]) => `<figure><figcaption><b>${t}</b><span>${d}</span></figcaption>`
    + `<div class="telaio">${svg}</div></figure>`).join('\n')}
</div>
<table>
<caption style="text-align:left;color:var(--tenue);padding-bottom:.5rem">I passaggi, ago per ago (R16)</caption>
<tr><th>ago</th><th>corse</th><th>riempimento</th><th>passaggi</th><th>nascosti</th><th>stacchi</th><th>giri sul contorno</th></tr>
${perAgo}
</table>
<p class="sotto" style="margin-top:1.5rem">In tutto: ${n1(plan.filoMm / 1000)} m di filo,
${plan.punti.toLocaleString('it-IT')} punti, ${plan.salti} salti, ${plan.macchie.length} macchie.
Calcolato in ${((Date.now() - t0) / 1000).toFixed(1)} s.</p>
</body></html>`;

const dir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const fuori = `${dir}catena.html`;
writeFileSync(fuori, html, 'utf8');
console.log('');
console.log(`LA CATENA — ${n1(plan.larghezzaMm)} × ${n1(plan.altezzaMm)} mm`);
console.log(`${plan.macchie.length} macchie · ${plan.ordine.length} aghi · ${n1(plan.filoMm / 1000)} m di filo`);
console.log(`→ ${fuori}  (${(html.length / 1024).toFixed(0)} kB)`);
console.log('');

// La prova sull'IMMAGINE VERA di Lorenzo — la cianotipia "Brave New World".
//
// Perché serve, dopo aver già misurato tutto contro verità nota: sui cerchi che rasterizzo io la
// scalinata è pulita, un pixel dentro o fuori e basta. Su una cianotipia c'è la **grana** — è una
// stampa, non una grafica — e il bordo non è una scalinata netta ma una frangia di pixel incerti.
// La regola del pavimento (la tolleranza vale almeno un pixel) va verificata lì, non solo in
// laboratorio: è la differenza fra un numero misurato e un numero sperato (R30).
//
// Come ci arrivano i pixel. Il decoder JPEG non ce l'ha né Node né il core — nella suite le
// immagini le decodifica il **canvas del browser** (`apps/bitmap`, `apps/broccato`), e va bene
// così. Per la prova headless il file si converte una volta in BMP a 24 bit, che è un formato
// senza compressione e si legge in venti righe:
//
//   powershell -c "Add-Type -AssemblyName System.Drawing; ..."   (vedi STATO)
//
//   npx esbuild apps/pittorico/scripts/immagine.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/immagine.mjs
//   node apps/pittorico/scripts/immagine.mjs <percorso.bmp>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { traceRegions, NO_COLOR, type Polyline } from '@rg/core';
import { regolarizzaAnello, fitCerchio } from '../src/primitives.ts';

const n1 = (v: number): string => v.toFixed(1);
const n3 = (v: number): string => v.toFixed(3);

// ---------------------------------------------------------------------------------------------
// Lettura BMP 24 bit senza compressione: header a offset fisso, righe dal basso, padding a 4 byte.
// ---------------------------------------------------------------------------------------------
interface Immagine { W: number; H: number; rgb: Uint8Array; }

function leggiBmp(percorso: string): Immagine {
  const b = readFileSync(percorso);
  if (b[0] !== 0x42 || b[1] !== 0x4d) throw new Error('non è un BMP');
  const dati = b.readUInt32LE(10);
  const W = b.readInt32LE(18);
  const altezza = b.readInt32LE(22);
  const bpp = b.readUInt16LE(28);
  if (bpp !== 24) throw new Error(`servono 24 bit per pixel, questo ne ha ${bpp}`);
  const H = Math.abs(altezza);
  const dalBasso = altezza > 0;
  const passo = Math.ceil((W * 3) / 4) * 4;
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const riga = dati + (dalBasso ? H - 1 - y : y) * passo;
    for (let x = 0; x < W; x++) {
      const s = riga + x * 3, d = (y * W + x) * 3;
      rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s];   // BMP è BGR
    }
  }
  return { W, H, rgb };
}

const luminanza = (img: Immagine, i: number): number =>
  0.2126 * img.rgb[i * 3] + 0.7152 * img.rgb[i * 3 + 1] + 0.0722 * img.rgb[i * 3 + 2];

/** Soglia di Otsu: la separazione fra chiaro e scuro decisa dall'istogramma, non a occhio. */
function otsu(img: Immagine): number {
  const isto = new Float64Array(256);
  const n = img.W * img.H;
  for (let i = 0; i < n; i++) isto[Math.min(255, Math.max(0, Math.round(luminanza(img, i))))]++;
  let somma = 0;
  for (let t = 0; t < 256; t++) somma += t * isto[t];
  let sommaB = 0, pesoB = 0, migliore = 0, soglia = 128;
  for (let t = 0; t < 256; t++) {
    pesoB += isto[t];
    if (pesoB === 0) continue;
    const pesoF = n - pesoB;
    if (pesoF === 0) break;
    sommaB += t * isto[t];
    const mB = sommaB / pesoB, mF = (somma - sommaB) / pesoF;
    const fra = pesoB * pesoF * (mB - mF) * (mB - mF);
    if (fra > migliore) { migliore = fra; soglia = t; }
  }
  return soglia;
}

/** Ritaglio, per lavorare su un pezzo alla volta come suggerito da Lorenzo. */
function ritaglia(img: Immagine, x0: number, y0: number, w: number, h: number): Immagine {
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * img.W + (x0 + x)) * 3, d = (y * w + x) * 3;
      rgb[d] = img.rgb[s]; rgb[d + 1] = img.rgb[s + 1]; rgb[d + 2] = img.rgb[s + 2];
    }
  }
  return { W: w, H: h, rgb };
}

/** Mappa di indici per `traceRegions`: 0 = scuro, 1 = chiaro, sopra/sotto la soglia. */
function maschera(img: Immagine, soglia: number): Uint8Array {
  const n = img.W * img.H;
  const idx = new Uint8Array(n).fill(NO_COLOR);
  for (let i = 0; i < n; i++) idx[i] = luminanza(img, i) >= soglia ? 1 : 0;
  return idx;
}

const scostaDaCerchio = (ring: Polyline, cx: number, cy: number, r: number): number =>
  ring.reduce((m, p) => Math.max(m, Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)), 0);

// ---------------------------------------------------------------------------------------------

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node immagine.mjs <percorso.bmp>'); process.exit(1); }
const img = leggiBmp(percorso);
const soglia = otsu(img);

console.log('');
console.log('PUNTO PITTORICO — la prova sull\'immagine vera (cianotipia "Brave New World")');
console.log(`immagine ${img.W} x ${img.H} px · soglia chiaro/scuro (Otsu) ${soglia} su 255`);
console.log('le misure sono in PIXEL: la larghezza reale in mm la deve dire Lorenzo (R11)');

// 1 px = 1 unità: si traccia a scala unitaria, così i numeri si leggono in pixel
const UNO = 1;

console.log('');
console.log('1. LE MACCHIE DELL\'IMMAGINE INTERA');
const idx = maschera(img, soglia);
for (const [nome, colore] of [['chiaro (le fasce)', 1], ['scuro (il fondo)', 0]] as Array<[string, number]>) {
  const regioni = traceRegions(idx, img.W, img.H, colore, UNO, { simplifyMm: 0.1, minAreaMm2: 200 });
  const aree = regioni.slice(0, 5).map((r) => Math.round(r.areaMm2));
  console.log(`   ${nome.padEnd(18)} ${String(regioni.length).padStart(3)} macchie sopra 200 px² · le più grandi: ${aree.join(', ')} px² · fori nella prima: ${regioni[0]?.holes.length ?? 0}`);
}

console.log('');
console.log('2. LA SFERA — il cerchio che deve tornare un cerchio');
console.log('   si cerca, fra le macchie scure, quella il cui contorno sta meglio su una circonferenza');
{
  const regioni = traceRegions(idx, img.W, img.H, 0, UNO, { simplifyMm: 0.1, minAreaMm2: 5000 });
  const candidati = regioni
    .map((r) => {
      const c = fitCerchio(r.outer);
      if (!c) return null;
      // quanto è "rotonda": area del cerchio contro area della macchia, e scarto del contorno
      const rapporto = r.areaMm2 / (Math.PI * c.r * c.r);
      return { r, c, rapporto, scarto: scostaDaCerchio(r.outer, c.cx, c.cy, c.r) };
    })
    .filter((v): v is NonNullable<typeof v> => !!v && v.rapporto > 0.6 && v.rapporto < 1.4)
    .sort((a, b) => a.scarto - b.scarto);

  if (!candidati.length) console.log('   nessuna macchia scura abbastanza rotonda');
  for (const cand of candidati.slice(0, 3)) {
    console.log(`   centro ${n1(cand.c.cx)},${n1(cand.c.cy)} · raggio ${n1(cand.c.r)} px · area ${Math.round(cand.r.areaMm2)} px² (${n3(cand.rapporto)} del cerchio) · il contorno si scosta al peggio di ${n1(cand.scarto)} px`);
  }
}

console.log('');
console.log('3. IL PAVIMENTO DELLA TOLLERANZA, SULLA GRANA VERA');
console.log('   quanto deve valere la tolleranza perché un arco della sfera venga riconosciuto?');
{
  const regioni = traceRegions(idx, img.W, img.H, 0, UNO, { simplifyMm: 0.1, minAreaMm2: 5000 });
  const grande = regioni[0];
  if (grande) {
    console.log(`   macchia scura più grande: ${Math.round(grande.areaMm2)} px², contorno ${grande.outer.length} punti`);
    console.log(`   ${'tolleranza'.padStart(11)} ${'pezzi'.padStart(6)} ${'archi'.padStart(6)} ${'segmenti'.padStart(9)} ${'scostamento'.padStart(12)}`);
    for (const tol of [0.5, 1, 1.5, 2, 3, 5, 8]) {
      const reg = regolarizzaAnello(grande.outer, { tolMm: tol });
      const archi = reg.pezzi.filter((p) => p.tipo === 'arco' || p.tipo === 'cerchio').length;
      const segmenti = reg.pezzi.filter((p) => p.tipo === 'segmento').length;
      console.log(`   ${`${tol} px`.padStart(11)} ${String(reg.pezzi.length).padStart(6)} ${String(archi).padStart(6)} ${String(segmenti).padStart(9)} ${`${n1(reg.scostamentoMm)} px`.padStart(12)}`);
    }
  }
}

console.log('');
console.log('4. LA GRANA — quanto del contorno è forma e quanto è stampa');
console.log('   la cianotipia è una STAMPA: il bordo non è una scalinata, è una frangia di pixel');
console.log('   incerti. Prima di chiedersi che forma sia, bisogna sapere quanto rumore c\'è sopra.');
{
  /** Voto di maggioranza su 3x3: il pixel prende il colore che hanno i suoi vicini. */
  const maggioranza = (src: Uint8Array, W: number, H: number): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let chiari = 0, totali = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            totali++; if (src[ny * W + nx] === 1) chiari++;
          }
        }
        out[y * W + x] = chiari * 2 > totali ? 1 : 0;
      }
    }
    return out;
  };

  console.log(`   ${'passate'.padStart(8)} ${'macchie chiare'.padStart(15)} ${'fori nella 1a scura'.padStart(20)} ${'punti contorno'.padStart(15)} ${'pezzi a tol 1px'.padStart(16)}`);
  let corrente = idx;
  for (const passate of [0, 1, 2, 3]) {
    if (passate > 0) corrente = maggioranza(corrente, img.W, img.H);
    const chiare = traceRegions(corrente, img.W, img.H, 1, UNO, { simplifyMm: 0.1, minAreaMm2: 200 });
    const scure = traceRegions(corrente, img.W, img.H, 0, UNO, { simplifyMm: 0.1, minAreaMm2: 200 });
    const prima = scure[0];
    const pezzi = prima ? regolarizzaAnello(prima.outer, { tolMm: 1 }).pezzi.length : 0;
    console.log(`   ${String(passate).padStart(8)} ${String(chiare.length).padStart(15)} ${String(prima?.holes.length ?? 0).padStart(20)} ${String(prima?.outer.length ?? 0).padStart(15)} ${String(pezzi).padStart(16)}`);
  }
}

// un ritaglio della sfera, salvato come SVG, per guardarlo invece di leggerlo
const fuori = process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(fuori, { recursive: true });
{
  const regioni = traceRegions(idx, img.W, img.H, 0, UNO, { simplifyMm: 0.1, minAreaMm2: 5000 });
  const linee = regioni.slice(0, 8).flatMap((r) => [r.outer, ...r.holes]);
  const d = linee.map((l) => `<polygon points="${l.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" />`).join('\n    ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.W}" height="${img.H}" viewBox="0 0 ${img.W} ${img.H}">
  <g fill="none" stroke="#111111" stroke-width="1">
    ${d}
  </g>
</svg>
`;
  writeFileSync(`${fuori.replace(/\/?$/, '/')}cianotipia-contorni.svg`, svg);
  console.log('');
  console.log(`contorni tracciati → ${fuori.replace(/\/?$/, '/')}cianotipia-contorni.svg`);
}
console.log('');

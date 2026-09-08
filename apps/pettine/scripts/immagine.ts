// DALL'IMMAGINE: N tinte, il sormonto fra i colori, e il pettine pieno.
//
// Lorenzo: «mettimi il sormonto regolabile, ma soprattutto il sormonto tra diversi colori. Oltre che
// la gestione della quantità di colori: tu qui ne prendi 4 ma io ne avrò bisogno di 6. E deve
// essere sfumatura molto fedele all'immagine».
//
// Con sei tinte il vettoriale a quattro non basta più: si parte dalla FOTO. E la strada esiste già,
// tutta nel core o nel Punto Pittorico, promossa lì per lo stesso disegno:
//
//   * `reduceStable`      la foto ridotta a N tinte stabili (pareggio della luce, grana attenuata,
//                         palette affinata, isole assorbite);
//   * `cresciVersoISuccessivi`  IL SORMONTO: ogni tinta si allarga sotto quelle cucite dopo di lei —
//                         di poco dove il bordo stacca (`sormontoNetto`), di molto dove sfuma
//                         (`sormontoSfumato`). È una decisione di Lorenzo già presa nel Pittorico:
//                         «far sormontare il sopra rispetto al sotto, e quindi il sotto farlo più
//                         grande». Il bordo resta netto perché a definirlo è il colore che va sopra;
//   * `larghezzaTransizione`    dove il bordo stacca e dove sfuma, misurato sulla foto.
//
// Sopra a questo, il modello del pettine pieno (`pieno.ts`): un'area una direzione, la più chiara
// verso dentro, l'ordine dal chiaro allo scuro, il dente fermato ai bordi netti.
//
// Tutto è in millimetri veri: 419,45 mm di larghezza, dichiarata da Lorenzo per questo disegno.
//
//   npx esbuild apps/pettine/scripts/immagine.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/immagine.mjs
//   node --max-old-space-size=4096 apps/pettine/scripts/immagine.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato]

import { mkdirSync, writeFileSync } from 'node:fs';
import { type Point, reduceStable, rgbToHex } from '@rg/core';
import { livello, incatena } from '../../pittorico/src/iso-fill.ts';
import { larghezzaTransizione, cresciVersoISuccessivi } from '../../pittorico/src/borders.ts';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';

const LARGHEZZA_REALE_MM = 419.45;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const foto = process.argv[2];
const TINTE = Math.max(2, Math.round(num(3, 6)));
const BASI_MM = num(4, 2);
const PASSO_MM = Math.max(1, num(5, 1.5));
const DENTE_MIN = num(6, 2), DENTE_MAX = num(7, 5);
const INCL = num(8, 40);
const NETTO_MM = num(9, 2.5);           // sotto questa larghezza di passaggio il bordo è uno stacco
const SORM_NETTO = num(10, 0.8);        // quanto una tinta entra sotto la successiva a un bordo netto
const SORM_SFUMATO = num(11, 4);        // ...e a un bordo sfumato
if (!foto) { console.error('uso: node immagine.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato]'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- 1. la foto ridotta a N tinte -----------------------------------------------------------------
const img = leggiBmp(foto);
const mmPerPx = LARGHEZZA_REALE_MM / img.width;
const t0 = Date.now();
const rid = reduceStable(img, { colorCount: TINTE, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: 400, mmPerPx });
const W = img.width, H = img.height, N = W * H;
const lum = (c: [number, number, number]): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
// l'ordine delle tinte è quello della luce, dal chiaro allo scuro; l'indice viene rimappato a quel rango
const ordine = rid.palette.map((c, i) => i).sort((a, b) => lum(rid.palette[b]) - lum(rid.palette[a]));
const rango = new Int8Array(rid.palette.length);
ordine.forEach((t, r) => { rango[t] = r; });
const tinta = new Int8Array(N);
for (let i = 0; i < N; i++) tinta[i] = rid.index[i] < rid.palette.length ? rango[rid.index[i]] : -1;
const colori = ordine.map((t) => rgbToHex(rid.palette[t]));
console.log(`\n${foto}\n${W} × ${H} px · ${(W * mmPerPx).toFixed(1)} × ${(H * mmPerPx).toFixed(1)} mm · ${TINTE} tinte in ${Date.now() - t0} ms`);
console.log(`dal chiaro allo scuro: ${colori.map((c, r) => `${c} (${(ordine.map((t) => rid.counts[t])[r] * mmPerPx * mmPerPx).toFixed(0)} mm²)`).join(' · ')}`);

// --- 2. dove il bordo sfuma, misurato sulla foto ----------------------------------------------------
// Per ogni pixel di confine fra due tinte si misura la larghezza del passaggio di luce lungo la
// direzione che attraversa il confine. La maschera che ne esce serve a due cose: al sormonto (che
// deve essere largo solo dove sfuma) e ai denti (che si fermano dove stacca).
const sfuma = new Uint8Array(N);
const netto = new Uint8Array(N);
{
  let misure = 0, misureSfumate = 0;
  for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
    const i = y * W + x;
    if (tinta[i] < 0) continue;
    let nx = 0, ny = 0;
    if (tinta[i + 1] !== tinta[i] && tinta[i + 1] >= 0) nx += 1;
    if (tinta[i - 1] !== tinta[i] && tinta[i - 1] >= 0) nx -= 1;
    if (tinta[i + W] !== tinta[i] && tinta[i + W] >= 0) ny += 1;
    if (tinta[i - W] !== tinta[i] && tinta[i - W] >= 0) ny -= 1;
    if (nx === 0 && ny === 0) continue;
    // si misura un pixel su tre: il bordo è continuo e la larghezza non cambia da un pixel all'altro
    if ((x + y) % 3 !== 0) continue;
    const l = Math.hypot(nx, ny);
    const tr = larghezzaTransizione(img, mmPerPx, { x: x * mmPerPx, y: y * mmPerPx }, { x: nx / l, y: ny / l }, { raggioMm: 6 });
    misure++;
    const s = tr !== null && tr.larghezzaMm >= NETTO_MM;
    if (s) misureSfumate++;
    // si segna un intorno di 3 pixel, così anche i pixel di confine non misurati hanno una risposta
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const j = (y + dy) * W + (x + dx);
      if (j < 0 || j >= N) continue;
      if (s) sfuma[j] = 1; else netto[j] = 1;
    }
  }
  console.log(`bordi misurati sulla foto: ${misure} punti, ${((misureSfumate / Math.max(1, misure)) * 100).toFixed(0)}% sfumati (passaggio ≥ ${NETTO_MM} mm)`);
}

// --- 3. per ogni tinta: la sua maschera ALLARGATA sotto le successive (il sormonto) ---------------
// `cresciVersoISuccessivi` lavora sull'indice originale e sull'ordine di cucitura: ogni tinta cresce
// dentro quelle che vengono dopo — di `SORM_SFUMATO` dove il bordo sfuma, di `SORM_NETTO` dove stacca.
const indiceOrdinato = new Uint8Array(N);
for (let i = 0; i < N; i++) indiceOrdinato[i] = tinta[i] < 0 ? 255 : tinta[i];
const ordineRanghi = colori.map((_, r) => r);

// --- 4. il pettine, tinta per tinta, area per area --------------------------------------------------
const CELLA = mmPerPx;
const perTinta: string[][] = colori.map(() => []);
let denti = 0, filoMm = 0, basiTot = 0, fermati = 0, attraversano = 0, areeTot = 0;

const cellaDi = (p: Point): number => {
  const c = Math.min(W - 2, Math.max(1, Math.round(p.x / CELLA)));
  const r = Math.min(H - 2, Math.max(1, Math.round(p.y / CELLA)));
  return r * W + c;
};

for (let t = 0; t < colori.length; t++) {
  const mia = cresciVersoISuccessivi(indiceOrdinato, W, H, t, ordineRanghi, mmPerPx, {
    crescitaMm: SORM_SFUMATO, sormontoMm: SORM_NETTO, sfuma,
  });

  // le aree: macchie connesse della maschera allargata
  const areaDi = new Int32Array(N).fill(-1);
  const aree: Array<{ id: number; celle: number }> = [];
  for (let s = 0; s < N; s++) {
    if (!mia[s] || areaDi[s] !== -1) continue;
    const id = aree.length;
    const coda = [s]; areaDi[s] = id; let celle = 0;
    while (coda.length) {
      const i = coda.pop()!; celle++;
      const x = i % W;
      if (x > 0 && mia[i - 1] && areaDi[i - 1] === -1) { areaDi[i - 1] = id; coda.push(i - 1); }
      if (x + 1 < W && mia[i + 1] && areaDi[i + 1] === -1) { areaDi[i + 1] = id; coda.push(i + 1); }
      if (i >= W && mia[i - W] && areaDi[i - W] === -1) { areaDi[i - W] = id; coda.push(i - W); }
      if (i + W < N && mia[i + W] && areaDi[i + W] === -1) { areaDi[i + W] = id; coda.push(i + W); }
    }
    aree.push({ id, celle });
  }

  for (const a of aree) {
    if (a.celle * CELLA * CELLA < 15) continue;          // sotto 15 mm² non c'è posto per un pettine
    areeTot++;
    // I SEMI: il lato dell'area che tocca una tinta PIÙ CHIARA (sull'indice originale, non allargato:
    // il sormonto sta sotto, non conta). Se i lati sono più d'uno, si tiene il gruppo più grande.
    // La più chiara, o un'area senza vicini chiari, ha per semi tutto il suo bordo e va verso dentro.
    const bordo = new Uint8Array(N), chiaro = new Uint8Array(N);
    for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
      const i = y * W + x;
      if (areaDi[i] !== a.id) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (areaDi[j] === a.id) continue;
        bordo[i] = 1;
        if (tinta[j] >= 0 && tinta[j] < t) chiaro[i] = 1;
      }
    }
    let semi = bordo, versoDentro = true;
    if (t > 0) {
      const gruppo = new Int32Array(N).fill(-1);
      let migliore = -1, peso = 0, ng = 0;
      for (let s = 0; s < N; s++) {
        if (!chiaro[s] || gruppo[s] !== -1) continue;
        const coda = [s]; gruppo[s] = ng; let n = 0;
        while (coda.length) {
          const i = coda.pop()!; n++;
          for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
            if (j < 0 || j >= N || !chiaro[j] || gruppo[j] !== -1) continue;
            gruppo[j] = ng; coda.push(j);
          }
        }
        if (n > peso) { peso = n; migliore = ng; }
        ng++;
      }
      if (migliore !== -1) {
        semi = new Uint8Array(N);
        for (let i = 0; i < N; i++) if (chiaro[i] && gruppo[i] === migliore) semi[i] = 1;
        versoDentro = false;
      }
    }

    // la distanza dai semi, dentro l'area sola
    const INF = 1e9;
    const D = new Float32Array(N).fill(INF);
    for (let i = 0; i < N; i++) if (semi[i]) D[i] = 0;
    const a1 = CELLA, a2 = CELLA * Math.SQRT2;
    for (let giro = 0; giro < 3; giro++) {
      for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
        const i = y * W + x;
        if (areaDi[i] !== a.id) continue;
        let v = D[i];
        if (areaDi[i - 1] === a.id) v = Math.min(v, D[i - 1] + a1);
        if (areaDi[i - W] === a.id) v = Math.min(v, D[i - W] + a1);
        if (areaDi[i - W - 1] === a.id) v = Math.min(v, D[i - W - 1] + a2);
        if (areaDi[i - W + 1] === a.id) v = Math.min(v, D[i - W + 1] + a2);
        D[i] = v;
      }
      for (let y = H - 2; y >= 1; y--) for (let x = W - 2; x >= 1; x--) {
        const i = y * W + x;
        if (areaDi[i] !== a.id) continue;
        let v = D[i];
        if (areaDi[i + 1] === a.id) v = Math.min(v, D[i + 1] + a1);
        if (areaDi[i + W] === a.id) v = Math.min(v, D[i + W] + a1);
        if (areaDi[i + W + 1] === a.id) v = Math.min(v, D[i + W + 1] + a2);
        if (areaDi[i + W - 1] === a.id) v = Math.min(v, D[i + W - 1] + a2);
        D[i] = v;
      }
    }
    const dentro = new Uint8Array(N);
    let maxD = 0;
    for (let i = 0; i < N; i++) if (areaDi[i] === a.id) { dentro[i] = 1; if (D[i] < INF && D[i] > maxD) maxD = D[i]; }
    const segno = versoDentro ? 1 : -1;

    for (let v = BASI_MM / 2; v < maxD; v += BASI_MM) {
      for (const linea of incatena(livello(D, dentro, W, H, 0, 0, CELLA, v), CELLA * 2)) {
        if (linea.length < 3) continue;
        basiTot++;
        let tot = 0;
        const cum: number[] = [0];
        for (let i = 1; i < linea.length; i++) {
          tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y);
          cum.push(tot);
        }
        const punti: Point[] = [];
        let k = 0;
        for (let d = 0; d <= tot; d += PASSO_MM, k++) {
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
          const pa = linea[i - 1], pb = linea[i];
          const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
          const ci = cellaDi(p);
          const gx = (D[ci + 1] - D[ci - 1]) / (2 * CELLA), gy = (D[ci + W] - D[ci - W]) / (2 * CELLA);
          const gl = Math.hypot(gx, gy);
          if (!(gl > 1e-6) || !Number.isFinite(gl)) continue;
          const r1 = caso(a.id * 7919 + t * 31 + Math.round(v * 10), k * 2);
          const r2 = caso(a.id * 104729 + t * 31 + Math.round(v * 10), k * 2 + 1);
          let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
          const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
          const bx = (segno * gx) / gl, by = (segno * gy) / gl;
          const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);
          // NETTO O SFUMATO, sulla maschera misurata al passo 2: dove il dente esce dall'area, se lì il
          // bordo stacca si ferma; se sfuma attraversa.
          for (let s = CELLA; s <= lung; s += CELLA) {
            const j = cellaDi({ x: p.x + ux * s, y: p.y + uy * s });
            if (areaDi[j] === a.id) continue;
            if (netto[j] && !sfuma[j]) { lung = Math.max(0.5, s - CELLA / 2); fermati++; }
            else attraversano++;
            break;
          }
          punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
        }
        if (punti.length < 3) continue;
        denti += Math.floor(punti.length / 3);
        for (let i = 1; i < punti.length; i++) filoMm += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
        perTinta[t].push(punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
      }
    }
  }
}

// --- 5. il disegno: dal chiaro allo scuro, la più chiara in grigio ---------------------------------
const WM = W * mmPerPx, HM = H * mmPerPx;
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (!perTinta[t].length) return;
  pezzi.push(`<path d="${perTinta[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.1"/>`);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `immagine-t${TINTE}-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-s${SORM_NETTO}_${SORM_SFUMATO}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, svg, 'utf8');
console.log(`${areeTot} aree · ${basiTot} linee di base · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`denti al bordo: ${fermati} fermati (netto) · ${attraversano} attraversano (sfumato)`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

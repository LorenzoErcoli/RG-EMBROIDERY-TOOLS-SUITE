// Punto ② — la RIDUZIONE STABILE: da una foto di tessuto a 4-8 tinte, in modo che lo stesso motivo
// ripetuto in due punti diversi finisca sugli STESSI aghi.
//
// Il problema, detto da Lorenzo e confermato dai numeri: su un tessuto fotografato lo stesso fiore
// in alto a sinistra e in basso a destra ha un tono diverso (luce, sporco, usura). Quantizzando
// l'immagine com'è, quei due fiori cadono su tinte diverse → la ripetizione non si somiglia. Il
// colpevole non è la palette: è la variazione LOCALE di tono.
//
// La catena, in quest'ordine (l'ordine conta):
//   1. PAREGGIO DELLA LUCE — si stima la variazione lenta di tono e si toglie. Restano le
//      differenze di disegno, spariscono quelle di posizione.
//   2. ATTENUAZIONE DELLA GRANA — mediana ripetuta: spiana il tratteggio fine senza sbavare i
//      contorni (la mediana non inventa colori intermedi, sceglie fra quelli che ci sono già).
//   3. PALETTE — median-cut del core (deterministico) + affinamento, che toglie le tinte a cui non
//      finisce nessun pixel.
//   4. AREA MINIMA — i frammenti troppo piccoli per essere ricamati vanno al colore del vicino.
//
// Resta locale all'app (ARCHITETTURA, regola di crescita 2): si promuove nel core quando un secondo
// tool la chiederà davvero. Nessun DOM: si prova in Node dallo smoke test.

import { type Rgb, nearestPaletteIndex, medianCutPalette } from '@rg/core';
import type { PixelImage } from './engine';

/** Nessun colore assegnato. */
export const NO_COLOR = 0xff;

// ------------------------------------------------------------
// 1. Pareggio della luce
// ------------------------------------------------------------

/** Media mobile separabile su un canale. Tre passate ≈ una gaussiana, e resta O(pixel). */
function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 3): Float32Array {
  if (r < 1) return src.slice();
  let cur = src.slice();
  const tmp = new Float32Array(cur.length);
  for (let p = 0; p < passes; p++) {
    // orizzontale
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += cur[row + Math.min(w - 1, Math.max(0, x))];
      const n = 2 * r + 1;
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / n;
        acc -= cur[row + Math.min(w - 1, Math.max(0, x - r))];
        acc += cur[row + Math.min(w - 1, Math.max(0, x + r + 1))];
      }
    }
    // verticale
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      const n = 2 * r + 1;
      for (let y = 0; y < h; y++) {
        cur[y * w + x] = acc / n;
        acc -= tmp[Math.min(h - 1, Math.max(0, y - r)) * w + x];
        acc += tmp[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x];
      }
    }
  }
  return cur;
}

/**
 * Toglie la variazione LENTA di tono: si sfoca l'immagine finché non resta che la luce di fondo,
 * e la si sottrae rimettendo la media generale.
 *
 * **Il raggio si sceglie su DUE misure, non su una.** La prima è la somiglianza fra due
 * ripetizioni dello stesso motivo sotto luce diversa: lì vince un raggio piccolo (2-3 mm porta dal
 * 33-42% al 93-96%, e sui raggi grandi si scende all'80-86%). Ma guardando solo quella si finisce
 * in trappola: un raggio piccolo toglie la luce **e anche il colore**, e una campitura piena si
 * svuota al centro. Misurato su cerchi pieni da 10, 25 e 45 mm — quanta parte dell'interno resta
 * di una tinta sola:
 *
 *     raggio   2 mm → 85 / 45 / 56 %      raggio  15 mm → 100 / 100 / 100 %
 *     raggio   5 mm → 100 / 60 / 49 %     raggio  25 mm → 100 / 100 / 100 %
 *     raggio  12 mm → 100 / 100 / 78 %
 *
 * Quindi la regola è: **il raggio dev'essere grande abbastanza da non svuotare la campitura piena
 * più grande che si vuole tenere intera** — attorno a un terzo del suo diametro — e fra i raggi che
 * la rispettano si prende il più piccolo, perché la somiglianza cala piano al crescere del raggio.
 * A 15 mm tutte e tre le campiture reggono al 100% e la somiglianza resta all'85-98%.
 */
export function flattenLight(img: PixelImage, radiusPx: number): PixelImage {
  const { width: w, height: h, rgba } = img;
  const r = Math.round(radiusPx);
  if (r < 1) return { width: w, height: h, rgba: Uint8ClampedArray.from(rgba) };

  const n = w * h;
  const out = new Uint8ClampedArray(n * 4);
  const ch = new Float32Array(n);
  for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let i = 0; i < n; i++) { const v = rgba[i * 4 + c]; ch[i] = v; sum += v; }
    const media = sum / n;
    const fondo = boxBlur(ch, w, h, r);
    for (let i = 0; i < n; i++) out[i * 4 + c] = ch[i] - fondo[i] + media;
  }
  for (let i = 0; i < n; i++) out[i * 4 + 3] = rgba[i * 4 + 3];
  return { width: w, height: h, rgba: out };
}

// ------------------------------------------------------------
// 2. Attenuazione della grana
// ------------------------------------------------------------

/**
 * Mediana di 9 valori con la rete di confronti classica (19 scambi condizionati).
 * Scritta su variabili locali e senza closure di appoggio: è il pezzo più caldo del punto ② — su
 * 900×800 l'attenuazione della grana pesava mezzo secondo, e la maggior parte non se ne andava nei
 * confronti ma nell'allocare una funzione per ogni pixel-canale.
 */
function median9(
  a0: number, a1: number, a2: number, a3: number, a4: number,
  a5: number, a6: number, a7: number, a8: number,
): number {
  let t: number;
  if (a2 < a1) { t = a1; a1 = a2; a2 = t; }
  if (a5 < a4) { t = a4; a4 = a5; a5 = t; }
  if (a8 < a7) { t = a7; a7 = a8; a8 = t; }
  if (a1 < a0) { t = a0; a0 = a1; a1 = t; }
  if (a4 < a3) { t = a3; a3 = a4; a4 = t; }
  if (a7 < a6) { t = a6; a6 = a7; a7 = t; }
  if (a2 < a1) { t = a1; a1 = a2; a2 = t; }
  if (a5 < a4) { t = a4; a4 = a5; a5 = t; }
  if (a8 < a7) { t = a7; a7 = a8; a8 = t; }
  if (a3 < a0) { t = a0; a0 = a3; a3 = t; }
  if (a8 < a5) { t = a5; a5 = a8; a8 = t; }
  if (a7 < a4) { t = a4; a4 = a7; a7 = t; }
  if (a6 < a3) { t = a3; a3 = a6; a6 = t; }
  if (a4 < a1) { t = a1; a1 = a4; a4 = t; }
  if (a5 < a2) { t = a2; a2 = a5; a5 = t; }
  if (a7 < a4) { t = a4; a4 = a7; a7 = t; }
  if (a2 < a4) { t = a4; a4 = a2; a2 = t; }
  if (a4 < a6) { t = a6; a6 = a4; a4 = t; }
  if (a2 < a4) { t = a4; a4 = a2; a2 = t; }
  return a4;
}

/**
 * Mediana 3×3 ripetuta `passes` volte. Contro la grana (rumore a sale e pepe) è lo strumento
 * giusto: toglie i punti isolati e **lascia i bordi dove sono**, perché non fa medie — sceglie
 * sempre un valore che nell'intorno c'era già.
 *
 * Lavora su tre piani separati invece che sul RGBA intrecciato: così i nove campioni si leggono a
 * passo 1 e non a passo 4, che su queste dimensioni è la differenza fra scorrere la memoria e
 * saltarci dentro.
 */
export function despeckle(img: PixelImage, passes: number): PixelImage {
  const { width: w, height: h } = img;
  const n = w * h;
  const p = Math.max(0, Math.min(6, Math.round(passes)));
  if (p === 0 || w < 3 || h < 3) return { width: w, height: h, rgba: Uint8ClampedArray.from(img.rgba) };

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) out[i * 4 + 3] = img.rgba[i * 4 + 3];

  let src = new Uint8Array(n);
  let dst = new Uint8Array(n);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < n; i++) src[i] = img.rgba[i * 4 + c];
    for (let k = 0; k < p; k++) {
      // interno: indici diretti, è il 99% dei pixel
      for (let y = 1; y < h - 1; y++) {
        const r0 = (y - 1) * w, r1 = y * w, r2 = (y + 1) * w;
        for (let x = 1; x < w - 1; x++) {
          dst[r1 + x] = median9(
            src[r0 + x - 1], src[r0 + x], src[r0 + x + 1],
            src[r1 + x - 1], src[r1 + x], src[r1 + x + 1],
            src[r2 + x - 1], src[r2 + x], src[r2 + x + 1],
          );
        }
      }
      // cornice: stessa mediana, ma l'intorno si ferma al bordo invece di uscirne.
      // Saltarla lascerebbe una riga di grana tutt'attorno — trovato con un test che contava i
      // punti isolati rimasti: erano 2, ed erano esattamente in [0,0] e sull'ultima riga.
      const at = (yy: number, xx: number): number =>
        src[(yy < 0 ? 0 : yy > h - 1 ? h - 1 : yy) * w + (xx < 0 ? 0 : xx > w - 1 ? w - 1 : xx)];
      const bordo = (y: number, x: number): void => {
        dst[y * w + x] = median9(
          at(y - 1, x - 1), at(y - 1, x), at(y - 1, x + 1),
          at(y, x - 1), at(y, x), at(y, x + 1),
          at(y + 1, x - 1), at(y + 1, x), at(y + 1, x + 1),
        );
      };
      for (let x = 0; x < w; x++) { bordo(0, x); bordo(h - 1, x); }
      for (let y = 1; y < h - 1; y++) { bordo(y, 0); bordo(y, w - 1); }

      const swap = src; src = dst; dst = swap;
    }
    for (let i = 0; i < n; i++) out[i * 4 + c] = src[i];
  }
  return { width: w, height: h, rgba: out };
}

// ------------------------------------------------------------
// 3. Palette: median-cut + affinamento
// ------------------------------------------------------------

/**
 * Affina la palette con qualche giro di Lloyd (k-means): ogni tinta si sposta sulla media dei pixel
 * che le sono finiti addosso. Deterministico, perché parte dal median-cut e non da un caso.
 *
 * Serve a un difetto concreto e visibile: il median-cut taglia per NUMERO di pixel, quindi su un
 * fondo dominante spende più aghi a suddividere la stessa tinta, e può restituire una tinta a cui
 * **non finisce nemmeno un pixel** (misurato sulla demo: 3 beige su 6 aghi, uno allo 0%). Le tinte
 * rimaste vuote qui vengono **riseminate** dove i colori sono più dispersi, così nessun ago si spreca.
 */
export function refinePalette(
  rgba: Uint8ClampedArray | number[],
  palette: Rgb[],
  iterations = 4,
  stride = 1,
): Rgb[] {
  if (!palette.length) return palette;
  const k = palette.length;
  const n = Math.floor(rgba.length / 4);
  let pal = palette.map((c) => [...c] as Rgb);

  for (let it = 0; it < iterations; it++) {
    const acc = new Float64Array(k * 3);
    const cnt = new Float64Array(k);
    // scarto quadratico per gruppo: serve a scegliere dove riseminare una tinta rimasta vuota
    const spread = new Float64Array(k);
    for (let i = 0; i < n; i += stride) {
      const o = i * 4;
      const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      const j = nearestPaletteIndex(r, g, b, pal);
      if (j < 0) continue;
      acc[j * 3] += r; acc[j * 3 + 1] += g; acc[j * 3 + 2] += b;
      cnt[j]++;
      const dr = r - pal[j][0], dg = g - pal[j][1], db = b - pal[j][2];
      spread[j] += dr * dr + dg * dg + db * db;
    }
    const next = pal.map((c) => [...c] as Rgb);
    for (let j = 0; j < k; j++) {
      if (cnt[j] > 0) {
        next[j] = [acc[j * 3] / cnt[j], acc[j * 3 + 1] / cnt[j], acc[j * 3 + 2] / cnt[j]];
      } else {
        // tinta vuota: la rimetto nel gruppo più disperso, spostata verso il suo pixel più lontano
        let worst = 0;
        for (let m = 1; m < k; m++) if (spread[m] > spread[worst]) worst = m;
        let far: Rgb = next[worst], farD = -1;
        for (let i = 0; i < n; i += Math.max(1, stride * 7)) {
          const o = i * 4;
          const dr = rgba[o] - next[worst][0], dg = rgba[o + 1] - next[worst][1], db = rgba[o + 2] - next[worst][2];
          const d = dr * dr + dg * dg + db * db;
          if (d > farD) { farD = d; far = [rgba[o], rgba[o + 1], rgba[o + 2]]; }
        }
        next[j] = far;
        spread[worst] = 0;                       // una risemina per giro e per gruppo
      }
    }
    pal = next;
  }
  return pal.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as Rgb);
}

// ------------------------------------------------------------
// 4. Area minima
// ------------------------------------------------------------

/** Una passata sola: assorbe ogni isola sotto soglia nel colore che le sta più attorno. */
function absorbPass(
  out: Uint8Array,
  width: number,
  height: number,
  minCells: number,
): number {
  const seen = new Uint8Array(out.length);
  const stack = new Int32Array(out.length);
  const blob = new Int32Array(out.length);
  let removed = 0;

  for (let start = 0; start < out.length; start++) {
    if (seen[start]) continue;
    const col = out[start];
    if (col === NO_COLOR) { seen[start] = 1; continue; }

    let sp = 0, bn = 0;
    stack[sp++] = start; seen[start] = 1;
    const bordo = new Map<number, number>();       // colore vicino → quante celle di confine
    while (sp > 0) {
      const i = stack[--sp];
      blob[bn++] = i;
      const x = i % width, y = (i / width) | 0;
      const vicini = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const j of vicini) {
        if (j < 0) continue;
        if (out[j] === col) { if (!seen[j]) { seen[j] = 1; stack[sp++] = j; } }
        else bordo.set(out[j], (bordo.get(out[j]) ?? 0) + 1);
      }
    }

    if (bn >= minCells || bordo.size === 0) continue;
    // il vicino più presente sul confine; a parità vince l'indice più basso (deterministico)
    let best = NO_COLOR, bestN = -1;
    for (const [c, n] of [...bordo.entries()].sort((a, b) => a[0] - b[0])) {
      if (c === NO_COLOR) continue;
      if (n > bestN) { bestN = n; best = c; }
    }
    if (best === NO_COLOR) continue;
    for (let t = 0; t < bn; t++) out[blob[t]] = best;
    removed++;
  }
  return removed;
}

/**
 * Toglie i frammenti troppo piccoli: ogni isola di colore sotto `minCells` viene assegnata al
 * colore che le sta più attorno. Su un tessuto materico è ciò che rende il disegno ricamabile —
 * senza, la quantizzazione produce migliaia di schegge da mezzo millimetro.
 *
 * **Va fatto a passate ripetute, non una volta sola.** Assorbire un'isola cambia il vicinato di
 * quelle accanto, e può lasciarne di nuove sotto soglia che una passata sola non rivedrebbe più:
 * misurato sull'immagine di prova, con una passata sola a 20 mm² restavano **80 isole sotto
 * soglia** su 108. Si ripete finché non si assorbe più niente (o al massimo `maxPasses`).
 *
 * Restituisce la mappa ripulita, quante isole ha tolto in tutto e quante passate ha fatto.
 */
export function removeSmallBlobs(
  index: Uint8Array,
  width: number,
  height: number,
  minCells: number,
  maxPasses = 6,
): { index: Uint8Array; removed: number; passes: number } {
  const out = new Uint8Array(index.length);
  out.set(index);
  if (minCells <= 1) return { index: out, removed: 0, passes: 0 };

  let removed = 0, passes = 0;
  for (let p = 0; p < maxPasses; p++) {
    const n = absorbPass(out, width, height, minCells);
    passes++;
    removed += n;
    if (n === 0) break;
  }
  return { index: out, removed, passes };
}

// ------------------------------------------------------------
// La catena intera
// ------------------------------------------------------------

export interface ReduceOptions {
  colorCount: number;
  /** Raggio del pareggio della luce, in mm (0 = spento). Va tenuto più grande del motivo. */
  flattenLightMm: number;
  /** Raggio dell'attenuazione della grana, in mm (0 = spenta). */
  smoothMm: number;
  /** Area minima di una macchia, in mm² (0 = nessuna pulizia). */
  minBlobMm2: number;
  mmPerPx: number;
  /** Se data, si usa questa palette invece di catturarne una nuova (le tinte scelte a mano). */
  palette?: Rgb[];
  /** Giri di affinamento della palette. 0 = solo median-cut. */
  refineIterations?: number;
}

export interface ReduceResult {
  /** L'immagine dopo pareggio e attenuazione: è quella su cui si è deciso. */
  prepared: PixelImage;
  palette: Rgb[];
  /** Un indice di palette per pixel (`NO_COLOR` = nessuno). */
  index: Uint8Array;
  counts: number[];
  /** Quante isole sotto l'area minima sono state assorbite. */
  removedBlobs: number;
  /** Quante passate di pulizia sono servite per arrivare a stabilita'. */
  cleanPasses: number;
}

/** Prepara l'immagine: pareggio della luce, poi attenuazione della grana. */
export function prepareImage(img: PixelImage, o: Pick<ReduceOptions, 'flattenLightMm' | 'smoothMm' | 'mmPerPx'>): PixelImage {
  const mmPerPx = o.mmPerPx > 0 ? o.mmPerPx : 1;
  const rLuce = o.flattenLightMm > 0 ? o.flattenLightMm / mmPerPx : 0;
  const passate = o.smoothMm > 0 ? o.smoothMm / mmPerPx : 0;
  let out = img;
  if (rLuce >= 1) out = flattenLight(out, rLuce);
  if (passate >= 1) out = despeckle(out, passate);
  return out;
}

/** La catena intera: immagine → tinte → mappa dei colori pulita. */
export function reduceStable(img: PixelImage, o: ReduceOptions): ReduceResult {
  const prepared = prepareImage(img, o);

  let palette: Rgb[];
  if (o.palette && o.palette.length) {
    palette = o.palette;
  } else {
    palette = medianCutPalette(prepared.rgba, null, o.colorCount);
    const giri = o.refineIterations ?? 4;
    if (giri > 0) palette = refinePalette(prepared.rgba, palette, giri);
  }

  const n = prepared.width * prepared.height;
  let index: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o4 = i * 4;
    index[i] = prepared.rgba[o4 + 3] < 8
      ? NO_COLOR
      : nearestPaletteIndex(prepared.rgba[o4], prepared.rgba[o4 + 1], prepared.rgba[o4 + 2], palette);
  }

  let removedBlobs = 0, cleanPasses = 0;
  const areaCella = (o.mmPerPx > 0 ? o.mmPerPx : 1) ** 2;
  const minCells = o.minBlobMm2 > 0 ? Math.round(o.minBlobMm2 / areaCella) : 0;
  if (minCells > 1) {
    const pulito = removeSmallBlobs(index, prepared.width, prepared.height, minCells);
    index = pulito.index;
    removedBlobs = pulito.removed;
    cleanPasses = pulito.passes;
  }

  const counts = new Array(palette.length).fill(0);
  for (let i = 0; i < index.length; i++) if (index[i] < palette.length) counts[index[i]]++;

  return { prepared, palette, index, counts, removedBlobs, cleanPasses };
}

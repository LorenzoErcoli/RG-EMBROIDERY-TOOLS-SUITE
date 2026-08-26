// Riduzione di un'immagine a poche tinte: palette + assegnazione dei pixel.
//
// Perché sta nel core (ARCHITETTURA, regola di crescita 1): la stessa domanda — "quali sono gli N
// colori di questa immagine?" — aveva già DUE risposte diverse nel repo, il median-cut nel motore di
// `apps/bitmap` e un k-means dentro `apps/interlace/src/tool.ts`. Con `apps/broccato` è il terzo tool
// a chiederla: si estrae, invece di scriverne una terza (regola 6/7 — le divergenze non si vedono,
// vanno cercate).
//
// Il porting da `apps/bitmap` è FEDELE: stesso campionamento, stesso criterio di taglio, stesso
// ordine di uscita. `test/smoke.mjs` confronta le due funzioni sullo stesso ingresso e pretende
// palette identiche, così la promozione non cambia il ricamo di nessuno.

/** Colore in componenti 0–255. */
export type Rgb = [number, number, number];

/** `[12, 250, 7]` → `#0cfa07`. Sempre minuscolo e a 6 cifre, come `normalizeColor` (R12). */
export function rgbToHex(c: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

/** `#0cfa07` o `#0fa` → `[12, 250, 7]`. `null` se non è un esadecimale valido. */
export function hexToRgb(hex: string): Rgb | null {
  const s = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  return null;
}

/**
 * Palette di `count` tinte con il **median-cut**: si parte da una scatola con tutti i pixel e si
 * taglia sempre quella col canale più esteso, a metà dei pixel ordinati su quel canale; ogni scatola
 * finale dà il suo colore medio.
 *
 * Deterministico: il campionamento è uniforme sull'ordine dei pixel (nessun caso), quindi la stessa
 * immagine dà sempre la stessa palette. È il requisito che rende ripetibile il ricamo di un motivo.
 *
 * `mask` (facoltativa, un byte per pixel) limita il conteggio ai pixel selezionati; senza, valgono tutti.
 */
export function medianCutPalette(
  rgba: Uint8ClampedArray | number[],
  mask: Uint8Array | null,
  count: number,
  maxSample = 120000,
): Rgb[] {
  const idx: number[] = [];
  const nPixels = mask ? mask.length : Math.floor(rgba.length / 4);
  for (let i = 0; i < nPixels; i++) if (!mask || mask[i]) idx.push(i);
  if (idx.length === 0) return [];
  const target = Math.max(1, Math.floor(count));

  // Campionamento uniforme sull'ordine (linspace), deterministico.
  let sampleIdx = idx;
  if (idx.length > maxSample) {
    sampleIdx = new Array(maxSample);
    for (let k = 0; k < maxSample; k++) sampleIdx[k] = idx[Math.floor((k * (idx.length - 1)) / (maxSample - 1))];
  }
  const px: Rgb[] = sampleIdx.map((i) => { const o = i * 4; return [rgba[o], rgba[o + 1], rgba[o + 2]] as Rgb; });

  const rangeOf = (pts: Rgb[]): { ch: number; span: number } => {
    const min = [255, 255, 255], max = [0, 0, 0];
    for (const p of pts) for (let c = 0; c < 3; c++) { if (p[c] < min[c]) min[c] = p[c]; if (p[c] > max[c]) max[c] = p[c]; }
    let ch = 0, span = -1;
    for (let c = 0; c < 3; c++) { const s = max[c] - min[c]; if (s > span) { span = s; ch = c; } }
    return { ch, span };
  };

  let boxes: Array<{ pts: Rgb[] }> = [{ pts: px }];
  while (boxes.length < target) {
    let bi = -1, bestSpan = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pts.length < 2) continue;
      const { span } = rangeOf(boxes[i].pts);
      if (span > bestSpan) { bestSpan = span; bi = i; }
    }
    if (bi < 0 || bestSpan <= 0) break;                    // niente più da tagliare
    const box = boxes[bi];
    const { ch } = rangeOf(box.pts);
    const sorted = box.pts.slice().sort((a, b) => a[ch] - b[ch]);
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, { pts: sorted.slice(0, mid) }, { pts: sorted.slice(mid) });
  }

  const palette: Rgb[] = [];
  const seen = new Set<string>();
  for (const box of boxes) {
    if (!box.pts.length) continue;
    const acc = [0, 0, 0];
    for (const p of box.pts) { acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; }
    const avg: Rgb = [acc[0] / box.pts.length, acc[1] / box.pts.length, acc[2] / box.pts.length];
    const key = rgbToHex(avg);
    if (seen.has(key)) continue;
    seen.add(key);
    palette.push([Math.round(avg[0]), Math.round(avg[1]), Math.round(avg[2])]);
  }
  return palette;
}

/** Indice del colore di palette più vicino in RGB (distanza euclidea al quadrato). −1 se la palette è vuota. */
export function nearestPaletteIndex(r: number, g: number, b: number, palette: Rgb[]): number {
  let best = -1, bestD = Infinity;
  for (let p = 0; p < palette.length; p++) {
    const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Assegna ogni pixel al colore di palette più vicino → una mappa di indici, un byte per pixel.
 * I pixel esclusi dalla `mask` (e quelli trasparenti, alpha < `alphaMin`) valgono `0xff` = nessuno.
 */
export function mapToPalette(
  rgba: Uint8ClampedArray | number[],
  palette: Rgb[],
  opts: { mask?: Uint8Array | null; alphaMin?: number } = {},
): Uint8Array {
  const n = Math.floor(rgba.length / 4);
  const out = new Uint8Array(n).fill(0xff);
  if (!palette.length) return out;
  const { mask = null, alphaMin = 8 } = opts;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    const o = i * 4;
    if (rgba[o + 3] < alphaMin) continue;
    out[i] = nearestPaletteIndex(rgba[o], rgba[o + 1], rgba[o + 2], palette);
  }
  return out;
}

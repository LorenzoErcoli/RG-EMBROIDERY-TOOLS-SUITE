// Motore Bitmap → Stitch — PORTING della logica di `bitmap_to_stitch` (web/app.py) in TypeScript PURO.
// Nessuna dipendenza dal DOM: lavora su un buffer RGBA già estratto (lo estrae tool.ts via <canvas>),
// così questo file è testabile in Node come l'engine di interlace (smoke.mjs lo bundla con esbuild).
//
// Allineamenti alla suite (decisi con Lorenzo, R30):
//  - la DENSITÀ è `densitySpacingMm` = spaziatura fra le file (R22): collassa i pixel su una griglia
//    METRICA di quel lato → cella piccola = fitto, grande = rado. È la manopola unica (le 5 di bitmap
//    — grid-cell/analysis-cell/min-dist/densità%/max-points — sono ricondotte a questa + minStitch + tetto).
//  - il PUNTO MINIMO è `minStitchMm`, applicato DOPO l'ordinamento (R3), con standby + reinserimento.
//  - la scala mm↔px la decide `realWidthMm` (fonte di verità, R11): il chiamante passa `mmPerPx`.
//
// L'engine lavora in PIXEL; la conversione a mm (1 unità = 1 mm, R1) la fa pipeline.ts moltiplicando per mmPerPx.

export interface PtPx { x: number; y: number; }

export interface BitmapParams {
  // --- 01 selezione dei pixel ---
  coverage: 'selected' | 'all';    // 'selected' = soglia/sfondo; 'all' = puncia TUTTA l'immagine in N colori
  threshold: number;               // luminanza 0–255: un pixel è "scelto" se L ≤ soglia
  sampleColors: string[];          // colori campionati (hex): SI AGGIUNGONO alla selezione di soglia
  sampleToleranceRgb: number;      // tolleranza colore (distanza RGB euclidea)
  excludeBackground: boolean;
  backgroundColors: string[];      // colori di sfondo da togliere dalla selezione
  backgroundToleranceRgb: number;
  colorCount: number;              // numero di colori (stop/cambi-ago), usato solo con paletteMode 'auto'
  paletteMode: 'auto' | 'manual';  // 'auto' = median-cut; 'manual' = i colori li scegli tu (contagocce)
  manualColors: string[];          // palette manuale (hex): i colori-livello scelti dall'utente
  manualTolerances: number[];      // tolleranza per-colore (parallela a manualColors), distanza RGB, def 30

  // --- densità e punto (R22 / R3) ---
  densitySpacingMm: number;        // spaziatura fra le file di filo: griglia metrica (0 = nessuna)
  minStitchMm: number;             // punto minimo, applicato dopo l'ordinamento (R3)
  reinsertionRounds: number;       // tentativi di reinserire i punti troppo vicini

  // --- stile e ordinamento ---
  style: 'carpet' | 'degrade';     // carpet = distribuzione regolare; degrade = scarto + jitter casuali
  degradeDrop: number;             // 0–1: probabilità di scartare ciascun punto (solo degrade)
  degradeJitterMm: number;         // ampiezza massima dello spostamento casuale (solo degrade)
  seed: number;                    // variante deterministica per degrade (stesso seed = stesso risultato)
  ordering: 'scanline' | 'nearest';
  scanlineBandMm: number;          // altezza della banda scanline (mm)
  serpentine: boolean;             // scanline: alterna il verso riga per riga (meno salti lunghi)

  // --- tetto punti opzionale (le vecchie densità%/max-points) ---
  maxPoints: number;               // tetto globale di punti (0 = nessun tetto)
  targetDensityPct: number;        // 0–100: usa questa % dei punti disponibili (0 = off)

  // --- scala / import / export ---
  realWidthMm: number;             // larghezza reale della sagoma (0 = usa la stima, R11)
  dpiEstimate: number;             // DPI di stima quando realWidthMm = 0 (§3.4 dpiDefault = 96)
  maxWidthPx: number;              // ridimensiona l'immagine a questa larghezza per performance (0 = nessuno)
  chunkSize: number;               // punti massimi per <path> nell'export (R6, 0 = nessun taglio)
}

export const defaultBitmapParams: BitmapParams = {
  coverage: 'selected',
  threshold: 200,
  sampleColors: [],
  sampleToleranceRgb: 24,
  excludeBackground: true,
  backgroundColors: ['#FFFFFF'],
  backgroundToleranceRgb: 30,
  paletteMode: 'auto',
  manualColors: [],
  manualTolerances: [],
  colorCount: 2,
  densitySpacingMm: 1.2,
  minStitchMm: 1.0,
  reinsertionRounds: 1,
  style: 'carpet',
  degradeDrop: 0.3,
  degradeJitterMm: 0.4,
  seed: 1,
  ordering: 'scanline',
  scanlineBandMm: 1.6,
  serpentine: true,
  maxPoints: 0,
  targetDensityPct: 0,
  realWidthMm: 0,
  dpiEstimate: 96,
  maxWidthPx: 1000,
  chunkSize: 5000,
};

export interface StitchColor {
  color: string;            // hex del colore quantizzato (= uno stop/cambio-ago)
  points: PtPx[];           // percorso ordinato (in pixel)
  initialPoints: number;
  finalPoints: number;
  discarded: number;
}

export interface StitchResult {
  widthPx: number;
  heightPx: number;
  colors: StitchColor[];    // ordinati per hex (deterministico)
}

// ------------------------------------------------------------
// Colore
// ------------------------------------------------------------

type RGB = [number, number, number];

/** Parse di un colore esadecimale (#RGB o #RRGGBB) → [r,g,b], o null se non valido. */
export function parseHexColor(text: string): RGB | null {
  let s = String(text).trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function hexOf([r, g, b]: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function parseColorList(list: string[]): RGB[] {
  const out: RGB[] = [];
  for (const c of list) { const p = parseHexColor(c); if (p) out.push(p); }
  return out;
}

// ------------------------------------------------------------
// PRNG deterministico (mulberry32) — per lo stile "degrade" riproducibile (stesso seed → stesso risultato)
// ------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------
// 1. Maschera di selezione dei pixel (soglia luminanza + colori campionati + sfondo escluso + alpha)
// ------------------------------------------------------------

/** Luminanza ITU-R 601-2, come la conversione "L" di PIL usata da bitmap. */
function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Costruisce la maschera booleana dei pixel selezionati.
 * `rgba` è il buffer del canvas (4 byte per pixel, riga per riga).
 */
export function buildSelectionMask(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
): Uint8Array {
  const n = width * height;
  const mask = new Uint8Array(n);

  // Modalità "tutta l'immagine": ogni pixel opaco è selezionato (soglia e sfondo NON si applicano) →
  // la quantizzazione poi riduce TUTTO a N colori → copertura piena.
  if (params.coverage === 'all') {
    for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] > 0) mask[i] = 1;
    return mask;
  }

  // Palette MANUALE + "solo i colori scelti": la selezione è per VICINANZA ai colori scelti, ognuno con la
  // sua tolleranza (default 30). Sostituisce "Colori da includere" e la soglia: è selezione E palette in uno.
  if (params.paletteMode === 'manual') {
    const manual = parseColorList(params.manualColors);
    if (manual.length) {
      const tols = params.manualTolerances || [];
      const tol2 = manual.map((_, i) => { const t = Math.max(0, tols[i] ?? 30); return t * t; });
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (rgba[o + 3] === 0) continue;
        const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
        for (let c = 0; c < manual.length; c++) {
          const dr = r - manual[c][0], dg = g - manual[c][1], db = b - manual[c][2];
          if (dr * dr + dg * dg + db * db <= tol2[c]) { mask[i] = 1; break; }
        }
      }
      return mask;
    }
  }

  const thr = params.threshold;
  const samples = parseColorList(params.sampleColors);
  const sampleTol2 = Math.max(0, params.sampleToleranceRgb) ** 2;
  const bg = params.excludeBackground ? parseColorList(params.backgroundColors) : [];
  const bgTol2 = Math.max(0, params.backgroundToleranceRgb) ** 2;

  const near = (r: number, g: number, b: number, list: RGB[], tol2: number): boolean => {
    for (const [tr, tg, tb] of list) {
      const dr = r - tr, dg = g - tg, db = b - tb;
      if (dr * dr + dg * dg + db * db <= tol2) return true;
    }
    return false;
  };

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2], a = rgba[o + 3];
    if (a === 0) continue;                                   // pixel trasparente = non selezionato
    const bySample = samples.length > 0 && near(r, g, b, samples, sampleTol2);
    let sel = luminance(r, g, b) <= thr || bySample;          // soglia OPPURE colore campionato (additivo)
    if (sel && bg.length) {
      // lo sfondo si toglie, ma un colore campionato lo protegge (non lo si esclude)
      if (near(r, g, b, bg, bgTol2) && !bySample) sel = false;
    }
    if (sel) mask[i] = 1;
  }
  return mask;
}

// ------------------------------------------------------------
// 2. Quantizzazione colore (median-cut) — sostituisce PIL ADAPTIVE, in TS puro
// ------------------------------------------------------------

/**
 * Median-cut deterministico sui pixel selezionati → `count` colori rappresentativi.
 * Campiona al più `maxSample` pixel per costruire la palette (come bitmap campiona 200k).
 */
export function buildPalette(
  rgba: Uint8ClampedArray | number[],
  mask: Uint8Array,
  count: number,
  maxSample = 120000,
): RGB[] {
  const idx: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) idx.push(i);
  if (idx.length === 0) return [];
  const target = Math.max(1, Math.floor(count));

  // campionamento uniforme sull'ordine (linspace), deterministico
  let sampleIdx = idx;
  if (idx.length > maxSample) {
    sampleIdx = new Array(maxSample);
    for (let k = 0; k < maxSample; k++) sampleIdx[k] = idx[Math.floor((k * (idx.length - 1)) / (maxSample - 1))];
  }
  const px: RGB[] = sampleIdx.map((i) => { const o = i * 4; return [rgba[o], rgba[o + 1], rgba[o + 2]] as RGB; });

  interface Box { pts: RGB[]; }
  const rangeOf = (pts: RGB[]): { ch: number; span: number } => {
    let min = [255, 255, 255], max = [0, 0, 0];
    for (const p of pts) for (let c = 0; c < 3; c++) { if (p[c] < min[c]) min[c] = p[c]; if (p[c] > max[c]) max[c] = p[c]; }
    let ch = 0, span = -1;
    for (let c = 0; c < 3; c++) { const s = max[c] - min[c]; if (s > span) { span = s; ch = c; } }
    return { ch, span };
  };

  let boxes: Box[] = [{ pts: px }];
  while (boxes.length < target) {
    // scegli la scatola con il range più ampio su un canale
    let bi = -1, bestSpan = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pts.length < 2) continue;
      const { span } = rangeOf(boxes[i].pts);
      if (span > bestSpan) { bestSpan = span; bi = i; }
    }
    if (bi < 0 || bestSpan <= 0) break;                      // niente più da tagliare
    const box = boxes[bi];
    const { ch } = rangeOf(box.pts);
    const sorted = box.pts.slice().sort((a, b) => a[ch] - b[ch]);
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, { pts: sorted.slice(0, mid) }, { pts: sorted.slice(mid) });
  }

  const palette: RGB[] = [];
  const seen = new Set<string>();
  for (const box of boxes) {
    if (!box.pts.length) continue;
    const acc = [0, 0, 0];
    for (const p of box.pts) { acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; }
    const avg: RGB = [acc[0] / box.pts.length, acc[1] / box.pts.length, acc[2] / box.pts.length];
    const key = hexOf(avg);
    if (seen.has(key)) continue;
    seen.add(key);
    palette.push([Math.round(avg[0]), Math.round(avg[1]), Math.round(avg[2])]);
  }
  return palette;
}

/** Assegna ogni pixel selezionato al colore di palette più vicino (RGB euclideo) → gruppi di punti. */
export function groupByPalette(
  rgba: Uint8ClampedArray | number[],
  mask: Uint8Array,
  width: number,
  palette: RGB[],
): Map<string, PtPx[]> {
  const groups = new Map<string, PtPx[]>();
  if (!palette.length) return groups;
  const keys = palette.map(hexOf);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    let best = 0, bestD = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    const key = keys[best];
    const x = i % width, y = (i / width) | 0;
    const arr = groups.get(key);
    if (arr) arr.push({ x, y }); else groups.set(key, [{ x, y }]);
  }
  return groups;
}

// ------------------------------------------------------------
// 3. Trasformazioni dei punti (griglia, degrade, subsample) — porting fedele
// ------------------------------------------------------------

/** Collassa i punti su una griglia di lato `cellPx`: un punto al centro di ogni cella occupata (R22). */
export function regularizeOnGrid(points: PtPx[], cellPx: number): PtPx[] {
  const cs = cellPx;
  if (cs <= 1 || !points.length) return points;
  const buckets = new Map<string, boolean>();
  for (const p of points) {
    const gx = Math.floor(p.x / cs), gy = Math.floor(p.y / cs);
    buckets.set(gx + ',' + gy, true);
  }
  const cells = [...buckets.keys()].map((k) => { const [gx, gy] = k.split(',').map(Number); return { gx, gy }; });
  cells.sort((a, b) => (a.gy - b.gy) || (a.gx - b.gx));      // ordine riga per riga (deterministico)
  const half = cs / 2;
  return cells.map(({ gx, gy }) => ({ x: gx * cs + half, y: gy * cs + half }));
}

/** Stile degrade: scarta casualmente e sposta (jitter) i punti; RNG seminato → riproducibile. */
export function applyDegrade(
  points: PtPx[], dropProb: number, jitterPx: number, width: number, height: number, seed: number,
): PtPx[] {
  if (!points.length) return points;
  const drop = Math.max(0, Math.min(1, dropProb));
  const jit = Math.max(0, jitterPx);
  if (drop <= 0 && jit <= 0) return points;
  const rnd = mulberry32(seed);
  const out: PtPx[] = [];
  for (const p of points) {
    if (drop > 0 && rnd() < drop) continue;
    let nx = p.x, ny = p.y;
    if (jit > 0) {
      nx = Math.max(0, Math.min(width - 1, p.x + (rnd() * 2 - 1) * jit));
      ny = Math.max(0, Math.min(height - 1, p.y + (rnd() * 2 - 1) * jit));
    }
    out.push({ x: nx, y: ny });
  }
  return out;
}

/** Riduce la lista a `maxPoints` distribuiti uniformemente sull'ordine attuale (limite di sicurezza). */
export function subsample(points: PtPx[], maxPoints: number): PtPx[] {
  const n = points.length;
  if (!maxPoints || maxPoints <= 0 || maxPoints >= n) return points;
  const out: PtPx[] = new Array(maxPoints);
  for (let k = 0; k < maxPoints; k++) out[k] = points[Math.floor((k * (n - 1)) / (maxPoints - 1))];
  return out;
}

// ------------------------------------------------------------
// 4. Ordinamento (scanline serpentina / nearest-neighbor)
// ------------------------------------------------------------

export function orderScanline(points: PtPx[], bandPx: number, serpentine: boolean): PtPx[] {
  if (!points.length) return [];
  const bh = Math.max(1, Math.floor(bandPx));
  const buckets = new Map<number, PtPx[]>();
  for (const p of points) {
    const band = Math.floor(p.y / bh);
    const arr = buckets.get(band);
    if (arr) arr.push(p); else buckets.set(band, [p]);
  }
  const ordered: PtPx[] = [];
  const bands = [...buckets.keys()].sort((a, b) => a - b);
  bands.forEach((band, i) => {
    const row = buckets.get(band)!.slice().sort((a, b) => a.x - b.x);
    if (serpentine && i % 2 === 1) row.reverse();
    ordered.push(...row);
  });
  return ordered;
}

/** Ogni quanti punti il nearest-neighbor si fa vivo: ~100ms fra un segnale e l'altro sui casi grossi. */
const NN_TICK = 512;

/**
 * Ogni quanti punti in attesa il reinserimento si fa vivo. Serve quanto NN_TICK: reinserire è
 * O(in attesa × percorso), e con la piena risoluzione quasi tutti i punti finiscono in attesa —
 * misurato nel browser, la fase "Punto minimo" restava muta per 11 secondi di fila.
 */
const REINSERT_TICK = 256;

/**
 * Quanta parte del lavoro di un colore vale l'ordinamento rispetto al punto minimo. È una STIMA
 * per far avanzare la barra in modo monotòno, non una misura: le due fasi non hanno un costo
 * confrontabile a priori.
 */
const PESO_ORDINAMENTO = 0.7;

/** Lo stato del nearest-neighbor fra un pezzo di lavoro e il successivo. */
interface NNState { pts: PtPx[]; used: Uint8Array; ordered: PtPx[]; cur: number; s: number; n: number; done: boolean; }

/** Prepara lo stato: punto di partenza = il più a sinistra, come da sempre. */
function nnStart(pts: PtPx[]): NNState {
  const n = pts.length;
  const st: NNState = { pts, used: new Uint8Array(n), ordered: [], cur: 0, s: 1, n, done: n <= 1 };
  if (n === 0) return st;
  let start = 0;
  for (let i = 1; i < n; i++) if (pts[i].x < pts[start].x) start = i;
  st.ordered.push(pts[start]);
  st.used[start] = 1;
  st.cur = start;
  return st;
}

/**
 * Fa avanzare il nearest-neighbor di al più `budget` punti; ritorna `true` quando ha finito.
 *
 * È una funzione NORMALE, non un generatore: il ciclo caldo O(n²) sta qui, dove il motore JS lo
 * ottimizza come ha sempre fatto, e il generatore lì sotto si limita a scandire i pezzi. Il costo
 * di questa struttura è stato misurato contro il codice di partenza sugli stessi 62.500 punti:
 * 4,4–4,6s contro 4,4–4,5s, cioè nessuna differenza fuori dal rumore.
 */
function nnAdvance(st: NNState, budget: number): boolean {
  if (st.done) return true;
  const pts = st.pts, used = st.used, ordered = st.ordered, n = st.n;
  let cur = st.cur, s = st.s, k = 0;
  for (; s < n && k < budget; s++, k++) {
    const cx = pts[cur].x, cy = pts[cur].y;
    let best = -1, bestD = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const dx = cx - pts[j].x, dy = cy - pts[j].y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best < 0) { st.done = true; break; }
    used[best] = 1;
    ordered.push(pts[best]);
    cur = best;
  }
  st.cur = cur; st.s = s;
  if (s >= n) st.done = true;
  return st.done;
}

/**
 * Nearest-neighbor O(n²) a pezzi: parte dal punto più a sinistra, non scarta nulla (come bitmap).
 * Emette quanti punti ha sistemato, così chi lo consuma può mostrare l'avanzamento e lasciar
 * respirare il browser. Il calcolo è tutto in `nnAdvance`: una sola strada, nessuna divergenza.
 */
export function* nearestNeighborSteps(points: PtPx[]): Generator<number, PtPx[], void> {
  const st = nnStart(points);
  while (!nnAdvance(st, NN_TICK)) yield st.ordered.length;
  return st.ordered;
}

/** Nearest-neighbor in un colpo solo (senza avanzamento): stesso motore, budget illimitato. */
export function orderNearestNeighbor(points: PtPx[]): PtPx[] {
  const st = nnStart(points);
  nnAdvance(st, Infinity);
  return st.ordered;
}

// ------------------------------------------------------------
// 5. Punto minimo (R3): filtro min-dist con standby + reinserimento
// ------------------------------------------------------------

export function filterMinDist(points: PtPx[], minDistPx: number): { path: PtPx[]; standby: PtPx[] } {
  if (!points.length || minDistPx <= 0) return { path: points.slice(), standby: [] };
  const path = [points[0]];
  const standby: PtPx[] = [];
  let lx = points[0].x, ly = points[0].y;
  const min2 = minDistPx * minDistPx;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const dx = p.x - lx, dy = p.y - ly;
    if (dx * dx + dy * dy >= min2) { path.push(p); lx = p.x; ly = p.y; }
    else standby.push(p);
  }
  return { path, standby };
}

export function reinsertPoints(path: PtPx[], standby: PtPx[], minDistPx: number): { path: PtPx[]; leftover: PtPx[] } {
  if (!standby.length || !path.length) return { path, leftover: standby };
  const min2 = minDistPx * minDistPx;
  const np = path.slice();
  const leftover: PtPx[] = [];
  const hyp = (a: PtPx, b: PtPx) => Math.hypot(a.x - b.x, a.y - b.y);
  const okBetween = (prev: PtPx | null, s: PtPx, next: PtPx | null): boolean => {
    if (prev) { const dx = s.x - prev.x, dy = s.y - prev.y; if (dx * dx + dy * dy < min2) return false; }
    if (next) { const dx = s.x - next.x, dy = s.y - next.y; if (dx * dx + dy * dy < min2) return false; }
    return true;
  };
  const extra = (s: PtPx, pos: number): number => {
    if (np.length === 0) return 0;
    if (pos === 0) return hyp(s, np[0]);
    if (pos === np.length) return hyp(np[np.length - 1], s);
    const a = np[pos - 1], b = np[pos];
    return hyp(s, a) + hyp(b, s) - hyp(a, b);
  };
  for (const s of standby) {
    let bestPos = -1, bestExtra = Infinity;
    const cand = np.length === 1 ? [0, 1] : range(0, np.length + 1);
    for (const pos of cand) {
      const prev = pos === 0 ? null : np[pos - 1];
      const next = pos === np.length ? null : np[pos];
      if (!okBetween(prev, s, next)) continue;
      const e = extra(s, pos);
      if (e < bestExtra) { bestExtra = e; bestPos = pos; }
    }
    if (bestPos >= 0) np.splice(bestPos, 0, s);
    else leftover.push(s);
  }
  return { path: np, leftover };
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}

// ------------------------------------------------------------
// 6. Budget punti (densità% / max-points) → tetto globale + ripartizione per colore (porting fedele)
// ------------------------------------------------------------

export function resolveGlobalBudget(groups: Map<string, PtPx[]>, maxPoints: number, targetDensityPct: number): number {
  let total = 0;
  for (const pts of groups.values()) total += pts.length;
  const density = Math.max(0, Math.min(100, targetDensityPct || 0));
  let fromDensity = 0;
  if (density > 0 && total > 0) fromDensity = Math.min(total, Math.ceil(total * (density / 100)));
  const mp = Math.max(0, Math.floor(maxPoints || 0));
  if (fromDensity > 0 && mp > 0) return Math.min(mp, fromDensity);
  if (fromDensity > 0) return fromDensity;
  return mp;
}

/** Ripartisce il tetto globale sui colori proporzionalmente alla loro disponibilità (min 1 a colore). */
export function allocateByColor(groups: Map<string, PtPx[]>, globalMax: number): Map<string, number> {
  const quotas = new Map<string, number>();
  for (const [k, pts] of groups) quotas.set(k, pts.length);
  if (!globalMax || globalMax <= 0) return quotas;

  const avail = new Map<string, number>();
  for (const [k, pts] of groups) if (pts.length) avail.set(k, pts.length);
  if (!avail.size) return quotas;
  let totalAvail = 0; for (const v of avail.values()) totalAvail += v;
  const budget = Math.min(globalMax, totalAvail);
  if (budget >= totalAvail) return quotas;

  for (const k of quotas.keys()) quotas.set(k, 0);
  const order = [...avail.keys()].sort((a, b) => avail.get(b)! - avail.get(a)!);
  if (budget < order.length) { for (const k of order.slice(0, budget)) quotas.set(k, 1); return quotas; }

  for (const k of order) quotas.set(k, 1);
  let remaining = budget - order.length;
  if (remaining <= 0) return quotas;

  const residual = new Map<string, number>();
  let residualTotal = 0;
  for (const k of order) { const r = Math.max(0, avail.get(k)! - quotas.get(k)!); residual.set(k, r); residualTotal += r; }
  if (residualTotal <= 0) return quotas;

  const remainders: { frac: number; k: string }[] = [];
  let distributed = 0;
  for (const k of order) {
    const share = remaining * (residual.get(k)! / residualTotal);
    let add = Math.min(Math.floor(share), residual.get(k)!);
    quotas.set(k, quotas.get(k)! + add);
    distributed += add;
    remainders.push({ frac: share - add, k });
  }
  let leftover = remaining - distributed;
  remainders.sort((a, b) => b.frac - a.frac);
  for (const { k } of remainders) {
    if (leftover <= 0) break;
    if (avail.get(k)! - quotas.get(k)! <= 0) continue;
    quotas.set(k, quotas.get(k)! + 1);
    leftover--;
  }
  return quotas;
}

// ------------------------------------------------------------
// 7. Selezione + preparazione condivise (fase LEGGERA: niente ordinamento)
// ------------------------------------------------------------

/** Un colore quantizzato con i suoi punti già preparati (griglia/degrade/tetto), PRIMA dell'ordinamento. */
interface PreparedColor { color: string; rawCount: number; points: PtPx[]; }

interface SelectionMeta { totalPixels: number; selectedPixels: number; }

/** Etichetta ogni pixel selezionato col colore di palette più vicino → coordinate + etichetta. */
function labelSelected(
  rgba: Uint8ClampedArray | number[], mask: Uint8Array, width: number, palette: RGB[],
): { xs: number[]; ys: number[]; labels: number[] } {
  const xs: number[] = [], ys: number[] = [], labels: number[] = [];
  if (!palette.length) return { xs, ys, labels };
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    let best = 0, bestD = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    xs.push(i % width); ys.push((i / width) | 0); labels.push(best);
  }
  return { xs, ys, labels };
}

/**
 * Hash deterministico di una coordinata di cella → u in [0,1). Indipendente dal seed (stabile).
 * Finalizer stile murmur: celle adiacenti danno valori BEN dispersi (niente correlazione col reticolo),
 * così in una zona mista i colori escono davvero proporzionali, non tutti uguali a righe.
 */
function cellHash(gx: number, gy: number): number {
  let h = (Math.imul(gx | 0, 0x27d4eb2d) ^ Math.imul(gy | 0, 0x165667b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * DENSITÀ (R22): una griglia metrica UNICA. Ogni cella occupata = UN punto di UN SOLO colore, scelto in
 * modo PROPORZIONALE alla composizione della cella (dither deterministico via `cellHash`). Conseguenze:
 *  - **niente due colori sullo stesso punto** (tecnicamente corretto: un punto = un filo);
 *  - nelle zone miste (bordi sfumati, dither della foto) i colori si distribuiscono **proporzionalmente**
 *    → niente buchi (difetto del voto di maggioranza) né colori che spariscono;
 *  - indipendente dai DPI (cella in mm). Ritorna i punti per etichetta di palette.
 */
function gridProportionalByColor(
  xs: number[], ys: number[], labels: number[], paletteLen: number, cellPx: number,
): PtPx[][] {
  const cs = cellPx;
  let maxGx = 0;
  for (const x of xs) { const gx = Math.floor(x / cs); if (gx > maxGx) maxGx = gx; }
  const stride = maxGx + 2;
  const cells = new Map<number, { gx: number; gy: number; counts: Uint32Array }>();
  for (let i = 0; i < xs.length; i++) {
    const gx = Math.floor(xs[i] / cs), gy = Math.floor(ys[i] / cs);
    const key = gy * stride + gx;
    let cell = cells.get(key);
    if (!cell) { cell = { gx, gy, counts: new Uint32Array(paletteLen) }; cells.set(key, cell); }
    cell.counts[labels[i]]++;
  }
  const out: PtPx[][] = Array.from({ length: paletteLen }, () => []);
  const half = cs / 2;
  const ordered = [...cells.values()].sort((a, b) => (a.gy - b.gy) || (a.gx - b.gx));  // deterministico
  for (const c of ordered) {
    let total = 0;
    for (let l = 0; l < paletteLen; l++) total += c.counts[l];
    const u = cellHash(c.gx, c.gy) * total;          // scelta proporzionale alla composizione
    let acc = 0, pick = 0;
    for (let l = 0; l < paletteLen; l++) { acc += c.counts[l]; if (u < acc) { pick = l; break; } pick = l; }
    out[pick].push({ x: c.gx * cs + half, y: c.gy * cs + half });
  }
  return out;
}

/** Palette dei colori-livello: manuale (contagocce) se scelta e non vuota, altrimenti auto (median-cut). */
function resolvePalette(rgba: Uint8ClampedArray | number[], mask: Uint8Array, params: BitmapParams): RGB[] {
  if (params.paletteMode === 'manual') {
    const manual: RGB[] = [];
    for (const c of params.manualColors) { const p = parseHexColor(c); if (p) manual.push(p); }
    if (manual.length) return manual;   // se vuota, ripiega su auto per non lasciare l'anteprima vuota
  }
  return buildPalette(rgba, mask, params.colorCount);
}

/**
 * Fase LEGGERA condivisa da `analyzeBitmap` (preview) e `generateStitch` (output):
 * maschera → quantizzazione → densità (griglia unica, un colore per cella, proporzionale) → degrade/tetto.
 * NON ordina e NON applica il punto minimo (le parti pesanti) — così la preview è veloce.
 */
function selectAndPrepare(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
): { prepared: PreparedColor[]; meta: SelectionMeta } {
  const mm2px = (mm: number) => (mmPerPx > 0 ? mm / mmPerPx : mm);

  const mask = buildSelectionMask(rgba, width, height, params);
  let selectedPixels = 0;
  for (let i = 0; i < mask.length; i++) selectedPixels += mask[i];

  // Palette: MANUALE (i colori scelti col contagocce) oppure AUTO (median-cut). In manuale ogni pixel
  // selezionato rientra nel colore-livello più vicino tra quelli scelti (labelSelected fa già questo).
  const palette = resolvePalette(rgba, mask, params);
  const paletteHex = palette.map(hexOf);
  const { xs, ys, labels } = labelSelected(rgba, mask, width, palette);

  // pixel reali per colore (pre-griglia) → per l'area% dell'elenco colori
  const pixelCounts = new Array(palette.length).fill(0);
  for (const l of labels) pixelCounts[l]++;

  const cellPx = params.densitySpacingMm > 0 ? mm2px(params.densitySpacingMm) : 0;

  // punti per colore: densità (griglia unica, un colore per cella, proporzionale) oppure piena risoluzione
  let pointsByLabel: PtPx[][];
  if (cellPx > 1) {
    pointsByLabel = gridProportionalByColor(xs, ys, labels, palette.length, cellPx);
  } else {
    pointsByLabel = Array.from({ length: palette.length }, () => []);
    for (let i = 0; i < xs.length; i++) pointsByLabel[labels[i]].push({ x: xs[i], y: ys[i] });
  }

  // budget (tetto punti / densità obiettivo) sui gruppi ottenuti
  const groupsForBudget = new Map<string, PtPx[]>();
  for (let li = 0; li < palette.length; li++) if (pointsByLabel[li].length) groupsForBudget.set(paletteHex[li], pointsByLabel[li]);
  const globalMax = resolveGlobalBudget(groupsForBudget, params.maxPoints, params.targetDensityPct);
  const perColorMax = allocateByColor(groupsForBudget, globalMax);

  const jitterPx = mm2px(params.degradeJitterMm);
  const order = palette
    .map((_c, li) => ({ hex: paletteHex[li], li }))
    .filter((o) => pointsByLabel[o.li].length)
    .sort((a, b) => (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));   // ordine deterministico

  const prepared: PreparedColor[] = [];
  order.forEach(({ hex, li }, ci) => {
    let pts = pointsByLabel[li];
    if (params.style === 'degrade') pts = applyDegrade(pts, params.degradeDrop, jitterPx, width, height, params.seed + ci);
    const cap = perColorMax.get(hex) ?? 0;
    if (cap > 0 && pts.length > cap) pts = subsample(pts, cap);       // tetto punti
    prepared.push({ color: hex, rawCount: pixelCounts[li], points: pts });
  });

  return { prepared, meta: { totalPixels: width * height, selectedPixels } };
}

// ------------------------------------------------------------
// 8. Analisi (preview) — la fase LEGGERA: cosa verrà cucito, senza ordinare
// ------------------------------------------------------------

export interface AnalyzeColor {
  color: string;         // hex del colore quantizzato
  pixelCount: number;    // pixel selezionati assegnati a questo colore (prima della preparazione)
  preparedCount: number; // punti dopo griglia/degrade/tetto (≈ quelli che verranno cuciti)
  points: PtPx[];        // i punti preparati (in pixel), per disegnare la preview
}

export interface AnalyzeResult {
  widthPx: number;
  heightPx: number;
  totalPixels: number;
  selectedPixels: number;
  colors: AnalyzeColor[];
}

/** Preview veloce: selezione + colori + punti preparati, SENZA ordinamento né punto minimo. */
export function analyzeBitmap(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
): AnalyzeResult {
  const { prepared, meta } = selectAndPrepare(rgba, width, height, params, mmPerPx);
  return {
    widthPx: width,
    heightPx: height,
    totalPixels: meta.totalPixels,
    selectedPixels: meta.selectedPixels,
    colors: prepared.map((p) => ({ color: p.color, pixelCount: p.rawCount, preparedCount: p.points.length, points: p.points })),
  };
}

// ------------------------------------------------------------
// 9. Generazione (output) — la fase PESANTE: ordinamento + punto minimo (R3)
// ------------------------------------------------------------

/** A che punto è la generazione: `done`/`total` sono PUNTI, non percentuali già cotte. */
export interface StitchProgress { phase: string; done: number; total: number; }

/**
 * Da un buffer RGBA ai percorsi ordinati per colore, in PIXEL — **come generatore**, così chi lo
 * consuma può mostrare una barra e lasciar dipingere il browser fra un passo e l'altro. Senza
 * questo, il lavoro sincrono blocca tutto e una barra resterebbe ferma a fissare l'utente.
 * `mmPerPx` converte i parametri in mm (densità, punto minimo, banda, jitter) in pixel.
 * `onlyColor` (hex) limita l'output a un solo colore quantizzato (come "Solo SVG" dell'originale).
 */
export function* stitchSteps(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
  onlyColor?: string,
): Generator<StitchProgress, StitchResult, void> {
  const mm2px = (mm: number) => (mmPerPx > 0 ? mm / mmPerPx : mm);
  const minDistPx = params.minStitchMm > 0 ? mm2px(params.minStitchMm) : 0;
  const bandPx = Math.max(1, mm2px(params.scanlineBandMm));

  // Segnala PRIMA di lavorare: la selezione è un blocco unico da ~150ms, l'unico modo di non
  // sembrare fermi è dire cosa si sta per fare.
  yield { phase: 'Analisi dei pixel', done: 0, total: 1 };
  const { prepared } = selectAndPrepare(rgba, width, height, params, mmPerPx);
  const only = onlyColor ? onlyColor.toUpperCase() : '';
  const todo = only ? prepared.filter((pc) => pc.color.toUpperCase() === only) : prepared;

  // L'avanzamento si misura in punti, non in colori: un colore grosso non deve valere come uno piccolo.
  const total = todo.reduce((acc, pc) => acc + pc.points.length, 0) || 1;
  let done = 0;

  const colors: StitchColor[] = [];
  for (const pc of todo) {
    const peso = pc.points.length;            // quanto pesa QUESTO colore sull'avanzamento totale

    // ordinamento (la parte pesante: nearest-neighbor è O(n²))
    let ordered: PtPx[];
    if (params.ordering === 'nearest') {
      const etichetta = `Ordinamento del percorso · ${pc.color}`;
      yield { phase: etichetta, done, total };
      const g = nearestNeighborSteps(pc.points);
      let r = g.next();
      while (!r.done) {
        yield { phase: etichetta, done: done + PESO_ORDINAMENTO * r.value, total };
        r = g.next();
      }
      ordered = r.value;
    } else {
      yield { phase: `Ordinamento a righe · ${pc.color}`, done, total };
      ordered = orderScanline(pc.points, bandPx, params.serpentine);
    }
    const dopoOrdine = done + PESO_ORDINAMENTO * peso;

    // punto minimo (R3): filtro + reinserimento
    let discarded = 0;
    if (minDistPx > 0) {
      const etichetta = `Punto minimo · ${pc.color}`;
      yield { phase: etichetta, done: dopoOrdine, total };
      const f = filterMinDist(ordered, minDistPx);
      let cur = f.path, standby = f.standby;
      for (let r = 0; r < Math.max(0, params.reinsertionRounds) && standby.length; r++) {
        // A FETTE, non tutto in un colpo: il risultato è identico (ogni punto in attesa viene
        // comunque valutato nell'ordine, contro il percorso man mano che cresce), ma così la barra
        // può respirare invece di restare muta per secondi.
        const resto: PtPx[] = [];
        for (let i = 0; i < standby.length; i += REINSERT_TICK) {
          const res = reinsertPoints(cur, standby.slice(i, i + REINSERT_TICK), minDistPx);
          cur = res.path;
          for (const p of res.leftover) resto.push(p);
          const frazione = Math.min(1, (i + REINSERT_TICK) / standby.length);
          yield { phase: etichetta, done: dopoOrdine + (1 - PESO_ORDINAMENTO) * peso * frazione, total };
        }
        standby = resto;
      }
      ordered = cur; discarded = standby.length;
    }

    done += peso;
    colors.push({ color: pc.color, points: ordered, initialPoints: pc.rawCount, finalPoints: ordered.length, discarded });
  }

  return { widthPx: width, heightPx: height, colors };
}

/**
 * La generazione in un colpo solo, senza avanzamento: drena `stitchSteps`.
 * Una riga sola perché l'algoritmo è là dentro — impossibile che le due strade divergano.
 */
export function generateStitch(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
  onlyColor?: string,
): StitchResult {
  const g = stitchSteps(rgba, width, height, params, mmPerPx, onlyColor);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

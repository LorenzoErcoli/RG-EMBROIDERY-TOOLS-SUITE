// Orchestrazione Bitmap → Stitch: risultato dell'engine (in pixel) → layer di output in mm.
// Allinea il tool alla suite: filo sottile (R15), 1 unità = 1 mm (R1), export un gruppo per STOP in
// ordine di cucitura con tinta unica (come interlace), metadata riapribile (R27) lo aggiunge tool.ts.
import {
  type ExportLayer, type Bounds, type Polyline,
  THREAD_STROKE_MM, distance,
} from '@rg/core';
import { generateStitch, analyzeBitmap, type BitmapParams, type StitchColor } from './engine';

export interface BitmapPipelineResult {
  /** Layer per l'ANTEPRIMA: un gruppo per colore (leggibile). */
  layers: ExportLayer[];
  /** Layer per l'EXPORT verso Stilista: un gruppo per STOP in ordine di cucitura, tinta unica. */
  exportLayers: ExportLayer[];
  bounds: Bounds;
  stopCount: number;
  threadMm: number;
  /** Riepilogo per la statusbar (colori, punti). */
  colors: { color: string; initialPoints: number; finalPoints: number; discarded: number }[];
}

function pathLength(pl: Polyline): number {
  let s = 0;
  for (let i = 1; i < pl.length; i++) s += distance(pl[i - 1], pl[i]);
  return s;
}

/**
 * Tinta UNICA per ogni stop (piccolo scostamento base-13, ≤~5%): due stop dello stesso colore quantizzato
 * escono con esadecimali diversi → Stilista li tratta come cambi-ago distinti. Identico a interlace.
 */
function toneColor(hex: string, idx: number): string {
  const h = hex.replace('#', '');
  let r = parseInt(h.slice(0, 2), 16) || 0;
  let g = parseInt(h.slice(2, 4), 16) || 0;
  let b = parseInt(h.slice(4, 6), 16) || 0;
  const or = idx % 13, og = Math.floor(idx / 13) % 13, ob = Math.floor(idx / 169) % 13;
  r = r > 243 ? r - or : r + or;
  g = g > 243 ? g - og : g + og;
  b = b > 243 ? b - ob : b + ob;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const hx = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/** Un colore quantizzato = uno stop (una polilinea continua), scalato px→mm. */
function stopPolyline(c: StitchColor, mmPerPx: number): Polyline {
  return c.points.map((p) => ({ x: p.x * mmPerPx, y: p.y * mmPerPx }));
}

// ------------------------------------------------------------
// PREVIEW (fase leggera): mostra i punti selezionati colorati, PRIMA di generare.
// ------------------------------------------------------------

export interface BitmapPreviewColor { color: string; pixelCount: number; preparedCount: number; areaPct: number; }
export interface BitmapPreviewResult {
  svg: string;            // SVG a puntini (uno <path> per colore) da mostrare nell'anteprima
  bounds: Bounds;
  colors: BitmapPreviewColor[];
  selectedPixels: number;
  totalPixels: number;
}

const r3 = (n: number) => Number(n.toFixed(3));

/** Diradamento uniforme (linspace) di una lista di punti, solo per il DISEGNO dell'anteprima. */
function thinForDisplay(points: { x: number; y: number }[], keep: number): { x: number; y: number }[] {
  if (keep >= points.length) return points;
  const out = new Array(keep);
  for (let k = 0; k < keep; k++) out[k] = points[Math.floor((k * (points.length - 1)) / (keep - 1))];
  return out;
}

/**
 * Costruisce la preview come UN <path> di puntini per colore (trucco `M x y l ε 0` + linecap rotondo):
 * efficiente anche con molti punti (un elemento per colore invece di migliaia di cerchi).
 * Disegna TUTTI i punti; solo se il totale supera `maxTotal` (immagini enormi) li dirada in modo
 * PROPORZIONALE su tutti i colori (stessa frazione) — così nessun colore, in primis la base, sembra
 * sparire. È un limite di solo DISEGNO: il conteggio vero resta nell'elenco e la generazione usa tutto.
 */
function buildPreviewSvg(colors: { color: string; points: { x: number; y: number }[] }[], bounds: Bounds, dotMm: number, mmPerPx: number, maxTotal = 120000): string {
  const m = 4;
  const w = bounds.maxX - bounds.minX + 2 * m;
  const h = bounds.maxY - bounds.minY + 2 * m;
  const vb = `${r3(bounds.minX - m)} ${r3(bounds.minY - m)} ${r3(w)} ${r3(h)}`;
  const total = colors.reduce((s, c) => s + c.points.length, 0);
  const frac = total > maxTotal ? maxTotal / total : 1;   // <1 solo per immagini enormi; uguale per tutti
  const paths = colors.map(({ color, points }) => {
    if (!points.length) return '';
    const pts = frac < 1 ? thinForDisplay(points, Math.max(1, Math.floor(points.length * frac))) : points;
    const d = pts.map((p) => `M${r3(p.x * mmPerPx)} ${r3(p.y * mmPerPx)}l.01 0`).join('');
    return `    <path d="${d}" stroke="${color}" stroke-width="${r3(dotMm)}" stroke-linecap="round" fill="none" />`;
  }).filter(Boolean);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(w)}mm" height="${r3(h)}mm" viewBox="${vb}">\n${paths.join('\n')}\n</svg>\n`;
}

/** Preview veloce (fase leggera): i punti selezionati per colore, senza generare il tracciato. */
export function runBitmapPreview(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
): BitmapPreviewResult {
  const a = analyzeBitmap(rgba, width, height, params, mmPerPx);
  const bounds: Bounds = { minX: 0, minY: 0, maxX: width * mmPerPx, maxY: height * mmPerPx };
  // Il punto in anteprima ha dimensione FISSA (un punto è un punto): la densità cambia la DISTANZA
  // fra i punti, non la loro grandezza. (Legarlo alla densità era un errore.)
  const dotMm = 0.6;
  const svg = buildPreviewSvg(a.colors, bounds, dotMm, mmPerPx);
  const colors: BitmapPreviewColor[] = a.colors.map((c) => ({
    color: c.color, pixelCount: c.pixelCount, preparedCount: c.preparedCount,
    areaPct: a.totalPixels ? (100 * c.pixelCount) / a.totalPixels : 0,
  }));
  return { svg, bounds, colors, selectedPixels: a.selectedPixels, totalPixels: a.totalPixels };
}

/**
 * Da buffer RGBA a layer di output (fase pesante: ordinamento + punto minimo).
 * `mmPerPx`: quanti mm vale un pixel (deciso da tool.ts via realWidthMm/DPI, R11).
 * `onlyColor` (hex) limita l'output a un solo colore quantizzato.
 */
export function runBitmapPipeline(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  params: BitmapParams,
  mmPerPx: number,
  onlyColor?: string,
): BitmapPipelineResult {
  const result = generateStitch(rgba, width, height, params, mmPerPx, onlyColor);

  const bounds: Bounds = { minX: 0, minY: 0, maxX: width * mmPerPx, maxY: height * mmPerPx };

  const stops = result.colors
    .map((c) => ({ color: c.color, pl: stopPolyline(c, mmPerPx) }))
    .filter((s) => s.pl.length >= 2);

  let threadMm = 0;
  for (const s of stops) threadMm += pathLength(s.pl);

  // --- ANTEPRIMA: un gruppo per colore, filo sottile (R15). ---
  const layers: ExportLayer[] = stops.map((s, i) => ({
    id: `fill-${i}`, color: s.color, polylines: [s.pl], strokeMm: THREAD_STROKE_MM,
  }));

  // --- EXPORT: un gruppo per STOP in ordine di cucitura, tinta unica per stop (R15). ---
  const exportLayers: ExportLayer[] = stops.map((s, i) => ({
    id: `stop-${String(i).padStart(4, '0')}`, color: toneColor(s.color, i), polylines: [s.pl], strokeMm: THREAD_STROKE_MM,
  }));

  return {
    layers, exportLayers, bounds,
    stopCount: stops.length, threadMm,
    colors: result.colors.map((c) => ({ color: c.color, initialPoints: c.initialPoints, finalPoints: c.finalPoints, discarded: c.discarded })),
  };
}

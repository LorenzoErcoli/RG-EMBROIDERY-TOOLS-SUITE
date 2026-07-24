// Orchestrazione Interlace: contorni importati + ruoli-colore + parametri → layer di output.
// Segue la pipeline della COSTITUZIONE §4 (import→ruoli→boundary→placement→export).
import {
  type Contour, type Role, type ExportLayer, type Bounds, type Polyline,
  bounds as boundsOf, polygonArea, pointInPolygon, distance,
  THREAD_STROKE_MM, SHAPE_STROKE_MM,
} from '@rg/core';
import { generateFill, type InterlaceParams } from './engine';

export type RoleAssignment = Record<string, Role | undefined>;

export interface PipelineResult {
  /** Layer per l'ANTEPRIMA a schermo: riferimento + riempimento raggruppato per colore (leggibile). */
  layers: ExportLayer[];
  /** Layer per l'EXPORT verso Stilista: un gruppo per STOP, in ORDINE di cucitura, con tinta unica. */
  exportLayers: ExportLayer[];
  bounds: Bounds;
  /** Numero di stop (cambi-ago) nella sequenza. */
  stopCount: number;
  /** Lunghezza totale del filo generato (mm), per la statusbar. */
  threadMm: number;
}

const COLORS = {
  reference: '#d0d0d0',
  fillFallback: '#222222',
  voidOutline: '#e06666',
};

function contoursWithRole(contours: Contour[], roles: RoleAssignment, role: Role): Contour[] {
  return contours.filter((c) => roles[c.color] === role);
}

function pathLength(pl: Polyline): number {
  let s = 0;
  for (let i = 1; i < pl.length; i++) s += distance(pl[i - 1], pl[i]);
  return s;
}

/** Un tratto-colore consecutivo della sequenza di cucitura. */
interface Chunk { color: string; points: Polyline; }

/**
 * Spezza i tratti nella SEQUENZA DI CUCITURA: percorre i tratti in ordine e cambia colore ogni `per`
 * segmenti, ruotando sulla palette (0,1,…,k-1,0,1,…). Ritorna la lista ORDINATA dei tratti-colore
 * (ogni cambio-colore o salto tra tratti apre un nuovo chunk). Questo ORDINE è la sequenza macchina:
 * per Stilista l'export deve seguirlo, NON raggruppare per colore.
 */
function sequenceChunks(runs: Polyline[], palette: string[], stops: number): Chunk[] {
  const out: Chunk[] = [];
  const totalSegs = runs.reduce((s, r) => s + Math.max(0, r.length - 1), 0);
  if (totalSegs < 1) return out;
  const per = Math.max(1, Math.ceil(totalSegs / stops));
  let seg = 0;
  for (const run of runs) {
    if (run.length < 2) continue;
    let curCol = palette[Math.floor(seg / per) % palette.length];
    let pts: Polyline = [run[0]];
    for (let i = 1; i < run.length; i++) {
      const col = palette[Math.floor(seg / per) % palette.length];
      if (col !== curCol) {
        if (pts.length >= 2) out.push({ color: curCol, points: pts });
        pts = [run[i - 1]]; // il nuovo tratto-colore riparte dal punto di giunzione (filo continuo)
        curCol = col;
      }
      pts.push(run[i]);
      seg++;
    }
    if (pts.length >= 2) out.push({ color: curCol, points: pts });
  }
  return out;
}

/**
 * Tinta UNICA e leggermente diversa per ogni stop: applica un piccolo scostamento (base-13 sui 3 canali,
 * ≤12/255 ≈ 5%) determinato dall'indice dello stop. Così due stop dello stesso colore-palette (es. due
 * "neri") escono con esadecimali DIVERSI → Stilista li vede come cambi-ago distinti e la sequenza si può
 * sfruttare. Resta visivamente lo stesso colore. Unico fino a 13³ = 2197 stop.
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

export function runPipeline(
  contours: Contour[],
  roles: RoleAssignment,
  params: InterlaceParams,
): PipelineResult {
  const all: Polyline = contours.flatMap((c) => c.points);
  const bnds: Bounds = all.length ? boundsOf(all) : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const master = contoursWithRole(contours, roles, 'MASTER_OUTLINE').filter((c) => c.closed);
  const exclusions = contoursWithRole(contours, roles, 'EXCLUSION').filter((c) => c.closed).map((c) => c.points);

  const layers: ExportLayer[] = [];

  // Riferimento: tutti i contorni importati, tenui (aiuta a leggere l'anteprima).
  layers.push({
    id: 'reference', color: COLORS.reference,
    polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true,
  });

  // Palette: numero variabile di colori che ruotano lungo il filo. Vuota → mono (fallback).
  const palette = (params.colors && params.colors.length ? params.colors : [COLORS.fillFallback])
    .map((c) => c && c !== 'none' ? c : COLORS.fillFallback);
  const cycles = Math.max(1, Math.floor(params.paletteCycles) || 1);
  const stops = palette.length * cycles;

  // Riempimento a intreccio: per ogni area MASTER_OUTLINE il motore rende una LISTA di tratti
  // (con salti a penna alzata tra le tasche del labirinto). Raccogliamo tutti i tratti, poi
  // facciamo ruotare i colori su tutta la sequenza.
  const allRuns: Polyline[] = [];
  let threadMm = 0;
  for (const m of master) {
    const innerVoids = exclusions.filter((v) => v.length > 0 && pointInPolygon(v[0], m.points));
    for (const run of generateFill(m.points, innerVoids, params)) {
      if (run.length < 2) continue;
      allRuns.push(run);
      threadMm += pathLength(run);
    }
  }
  // Sequenza di cucitura: tratti-colore in ORDINE (non ancora raggruppati).
  const chunks = sequenceChunks(allRuns, palette, stops);

  // --- ANTEPRIMA: raggruppa per colore (più leggibile a schermo). Il filo si disegna sottile (R15). ---
  const byColor = new Map<string, Polyline[]>();
  for (const ch of chunks) { const l = byColor.get(ch.color) ?? []; l.push(ch.points); byColor.set(ch.color, l); }
  palette.forEach((col, i) => {
    const list = byColor.get(col);
    if (list && list.length) layers.push({ id: `fill-${i}`, color: col, polylines: list, strokeMm: THREAD_STROKE_MM });
  });
  // Contorno dei void (tenue) in anteprima, per mostrare che vengono rispettati.
  if (exclusions.length) {
    layers.push({ id: 'void', color: COLORS.voidOutline, polylines: exclusions, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  // --- EXPORT per Stilista: un gruppo per STOP, nell'ORDINE di cucitura, con tinta UNICA per stop.
  //     NON raggruppato per colore (si perderebbe la sequenza) e ogni stop ha un esadecimale diverso
  //     (anche due "neri") così Stilista li tratta come cambi-ago distinti. ---
  const exportLayers: ExportLayer[] = [
    { id: 'reference', color: COLORS.reference, polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true },
  ];
  chunks.forEach((ch, i) => {
    exportLayers.push({ id: `stop-${String(i).padStart(4, '0')}`, color: toneColor(ch.color, i), polylines: [ch.points], strokeMm: THREAD_STROKE_MM });
  });

  return { layers, exportLayers, bounds: bnds, stopCount: chunks.length, threadMm };
}

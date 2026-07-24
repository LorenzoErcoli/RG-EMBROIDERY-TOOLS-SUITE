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
  layers: ExportLayer[];
  bounds: Bounds;
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

/**
 * Colora una lista di tratti (ogni tratto = filo continuo) facendo RUOTARE i colori della palette
 * lungo TUTTA la sequenza dei segmenti (0,1,…,k-1,0,1,…): ogni colore ricompare su più strati
 * sovrapposti — l'ultimo non è solo in cima. Il cambio-colore avviene ogni `per` segmenti; i colori
 * non vengono mai uniti attraverso il confine tra due tratti (lì c'è un salto a penna alzata, non
 * disegnato). Ritorna: per ogni colore, l'elenco delle sue polilinee.
 */
function colorizeRuns(runs: Polyline[], palette: string[], stops: number): Map<string, Polyline[]> {
  const byColor = new Map<string, Polyline[]>();
  for (const col of palette) byColor.set(col, []);
  const totalSegs = runs.reduce((s, r) => s + Math.max(0, r.length - 1), 0);
  if (totalSegs < 1) return byColor;
  const per = Math.max(1, Math.ceil(totalSegs / stops));
  let seg = 0;
  for (const run of runs) {
    if (run.length < 2) continue;
    let curCol = palette[Math.floor(seg / per) % palette.length];
    let chunk: Polyline = [run[0]];
    for (let i = 1; i < run.length; i++) {
      const col = palette[Math.floor(seg / per) % palette.length];
      if (col !== curCol) {
        if (chunk.length >= 2) byColor.get(curCol)!.push(chunk);
        chunk = [run[i - 1]]; // il nuovo tratto-colore riparte dal punto di giunzione (continuo)
        curCol = col;
      }
      chunk.push(run[i]);
      seg++;
    }
    if (chunk.length >= 2) byColor.get(curCol)!.push(chunk);
  }
  return byColor;
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
  const perColor = colorizeRuns(allRuns, palette, stops);
  // Il filo si disegna sottile (R15): lo spessore reale è nella densità dei passaggi.
  // Un layer per colore (come nell'SVG di riferimento: un <path>/gruppo per colore).
  palette.forEach((col, i) => {
    const list = perColor.get(col)!;
    if (list.length) layers.push({ id: `fill-${i}`, color: col, polylines: list, strokeMm: THREAD_STROKE_MM });
  });

  // Contorno dei void (tenue), per mostrare che vengono rispettati.
  if (exclusions.length) {
    layers.push({ id: 'void', color: COLORS.voidOutline, polylines: exclusions, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  return { layers, bounds: bnds, threadMm };
}

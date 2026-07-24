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
 * Taglia un filo continuo in `stops` tratti CONSECUTIVI e assegna a ciascuno un colore che
 * RUOTA sulla palette (0,1,…,k-1,0,1,…). Ogni tratto condivide il punto di giunzione col
 * successivo, così il filo resta continuo; i colori si ripetono su più strati sovrapposti
 * (l'ultimo colore non è solo in cima). Ritorna: per ogni colore, l'elenco dei suoi tratti.
 */
function rotateColorStops(path: Polyline, palette: string[], stops: number): Map<string, Polyline[]> {
  const byColor = new Map<string, Polyline[]>();
  for (const col of palette) byColor.set(col, []);
  const segCount = path.length - 1;
  if (segCount < 1) return byColor;
  const per = Math.max(1, Math.ceil(segCount / stops));
  for (let s = 0, seg = 0; seg < segCount; s++) {
    const from = seg;
    const to = Math.min(segCount, seg + per); // indice di vertice finale del tratto
    const chunk = path.slice(from, to + 1);   // include il vertice di giunzione col tratto dopo
    const col = palette[s % palette.length];
    if (chunk.length >= 2) byColor.get(col)!.push(chunk);
    seg = to;
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

  // Riempimento a intreccio: un filo continuo per ogni area MASTER_OUTLINE, escludendo i void interni.
  // Ogni filo è tagliato in cambi-ago che ruotano sulla palette; accumuliamo i tratti per colore.
  const perColor = new Map<string, Polyline[]>();
  for (const col of palette) perColor.set(col, []);
  let threadMm = 0;
  for (const m of master) {
    const innerVoids = exclusions.filter((v) => v.length > 0 && pointInPolygon(v[0], m.points));
    const path = generateFill(m.points, innerVoids, params);
    if (path.length < 2) continue;
    threadMm += pathLength(path);
    const chunks = rotateColorStops(path, palette, stops);
    for (const [col, list] of chunks) perColor.get(col)!.push(...list);
  }
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

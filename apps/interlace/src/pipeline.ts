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

  // Riempimento a intreccio: un filo continuo per ogni area MASTER_OUTLINE, escludendo i void interni.
  const fillColor = master[0]?.color && master[0].color !== 'none' ? master[0].color : COLORS.fillFallback;
  const paths: Polyline[] = [];
  let threadMm = 0;
  for (const m of master) {
    const innerVoids = exclusions.filter((v) => v.length > 0 && pointInPolygon(v[0], m.points));
    const path = generateFill(m.points, innerVoids, params);
    if (path.length >= 2) { paths.push(path); threadMm += pathLength(path); }
  }
  // Il filo si disegna sottile (R15): lo spessore reale è nella densità dei passaggi.
  layers.push({ id: 'fill', color: fillColor, polylines: paths, strokeMm: THREAD_STROKE_MM });

  // Contorno dei void (tenue), per mostrare che vengono rispettati.
  if (exclusions.length) {
    layers.push({ id: 'void', color: COLORS.voidOutline, polylines: exclusions, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  return { layers, bounds: bnds, threadMm };
}

// Orchestrazione: contorni importati + ruoli-colore + parametri → layer di output.
// Segue la pipeline della COSTITUZIONE §4 (import→ruoli→boundary→placement→export).
import {
  type Contour, type Role, type ExportLayer, type Polyline, type Bounds,
  type NetParams, bounds as boundsOf, THREAD_STROKE_MM, SHAPE_STROKE_MM,
} from '@rg/core';
import { buildNet } from './net';

export type RoleAssignment = Record<string, Role | undefined>;

export interface PipelineResult {
  layers: ExportLayer[];
  bounds: Bounds;
}

const COLORS = {
  net: '#0a9aa0',
  travel: '#e06666', // passaggi ben visibili (rosso tenue)
  satin: '#e08a2b',
  square: '#b046c8',
  border: '#7a5230',
  reference: '#d0d0d0',
};

function contoursWithRole(contours: Contour[], roles: RoleAssignment, role: Role): Contour[] {
  return contours.filter((c) => roles[c.color] === role);
}

export function runPipeline(
  contours: Contour[],
  roles: RoleAssignment,
  params: NetParams,
): PipelineResult {
  const all: Polyline = contours.flatMap((c) => c.points);
  const bnds: Bounds = all.length ? boundsOf(all) : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const master = contoursWithRole(contours, roles, 'MASTER_OUTLINE').filter((c) => c.closed);
  const netAreas = contoursWithRole(contours, roles, 'NET_AREA').filter((c) => c.closed);
  const exclusions = contoursWithRole(contours, roles, 'EXCLUSION').filter((c) => c.closed).map((c) => c.points);
  const satin = contoursWithRole(contours, roles, 'SATIN_AREA');
  const squares = contoursWithRole(contours, roles, 'SQUARE_AREA');
  const borders = contoursWithRole(contours, roles, 'BORDER');

  // La rete va nell'area NET_AREA se definita, altrimenti nel perimetro MASTER_OUTLINE.
  const netBoundaries = (netAreas.length ? netAreas : master).map((c) => c.points);

  const layers: ExportLayer[] = [];

  // Layer di riferimento (tutti i contorni importati, tenui) — utile in preview.
  layers.push({
    id: 'reference',
    color: COLORS.reference,
    polylines: contours.map((c) => c.points),
    strokeMm: SHAPE_STROKE_MM,
    shapeOnly: true,
  });

  // Aree raso di fondo → FORME (l'utente le riempie su Stilista).
  if (satin.length) {
    layers.push({ id: 'satin-area', color: COLORS.satin, polylines: satin.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }
  if (squares.length) {
    layers.push({ id: 'square-area', color: COLORS.square, polylines: squares.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  // Rete = filo CONTINUO (R26): cordoncino → passaggio → cordoncino → passaggio… in un'unica
  // polilinea per area, UN solo colore. La larghezza del cordoncino è nella geometria (R15).
  const netPaths: Polyline[] = [];
  for (const b of netBoundaries) {
    const r = buildNet(b, exclusions, params);
    if (r.path.length >= 2) netPaths.push(r.path);
  }
  layers.push({ id: 'net', color: COLORS.net, polylines: netPaths, strokeMm: THREAD_STROKE_MM });

  // Bordo perimetrale → forma (per ora).
  const borderShapes = borders.length ? borders : master;
  if (borderShapes.length) {
    layers.push({ id: 'border', color: COLORS.border, polylines: borderShapes.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  return { layers, bounds: bnds };
}

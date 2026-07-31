// Orchestrazione Punto Striato: contorni importati + ruoli-colore + parametri → layer di output.
// Segue la pipeline della COSTITUZIONE §4 (import→ruoli→boundary→placement→export).
import {
  type Contour, type Role, type ExportLayer, type Bounds, type Polyline,
  bounds as boundsOf, pointInPolygon, polygonArea,
  THREAD_STROKE_MM, SHAPE_STROKE_MM,
} from '@rg/core';
import { generateStriatura, layerThreadMm, type StriaturaParams } from './engine';

export type RoleAssignment = Record<string, Role | undefined>;

export interface PipelineResult {
  /** Layer per l'ANTEPRIMA a schermo: riferimento + striature (filo) + contorno dei vuoti. */
  layers: ExportLayer[];
  /** Layer per l'EXPORT (SVG/DST): riferimento (shapeOnly) + le striature come un ago unico (mono). */
  exportLayers: ExportLayer[];
  bounds: Bounds;
  /** Lunghezza totale del filo generato (mm), per la statusbar. */
  threadMm: number;
  /** Numero di tratti (polilinee): 1 = filo tutto continuo; >1 = ci sono salti (es. attorno ai vuoti). */
  blockCount: number;
}

const COLORS = {
  reference: '#d0d0d0',
  fillFallback: '#1a1a1a',
  voidOutline: '#e06666',
};

function contoursWithRole(contours: Contour[], roles: RoleAssignment, role: Role): Contour[] {
  return contours.filter((c) => roles[c.color] === role);
}

export function runPipeline(
  contours: Contour[],
  roles: RoleAssignment,
  params: StriaturaParams,
): PipelineResult {
  const all: Polyline = contours.flatMap((c) => c.points);
  const bnds: Bounds = all.length ? boundsOf(all) : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const master = contoursWithRole(contours, roles, 'MASTER_OUTLINE').filter((c) => c.closed);
  const exclusions = contoursWithRole(contours, roles, 'EXCLUSION').filter((c) => c.closed).map((c) => c.points);
  const fillColor = params.color && params.color !== 'none' ? params.color : COLORS.fillFallback;

  const layers: ExportLayer[] = [];
  // Riferimento: tutti i contorni importati, tenui (aiuta a leggere l'anteprima).
  layers.push({
    id: 'reference', color: COLORS.reference,
    polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true,
  });

  // GENERA: un filo di striature per ogni contorno-area (MASTER_OUTLINE), rispettando i vuoti interni (R5).
  // Aree più grandi prima (stabilità), come per gli altri tool.
  const areas = master.slice().sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  const allPolylines: Polyline[] = [];
  let threadMm = 0;
  for (const m of areas) {
    const innerVoids = exclusions.filter((v) => v.length > 0 && pointInPolygon(v[0], m.points));
    for (const gl of generateStriatura({ outline: m.points, voids: innerVoids }, { ...params, color: fillColor })) {
      allPolylines.push(...gl.polylines);
      threadMm += layerThreadMm(gl);
    }
  }

  // --- ANTEPRIMA: il filo si disegna sottile (R15); contorno dei vuoti tenue per mostrare che sono rispettati. ---
  if (allPolylines.length) {
    layers.push({ id: 'striatura', color: fillColor, polylines: allPolylines, strokeMm: THREAD_STROKE_MM });
  }
  if (exclusions.length) {
    layers.push({ id: 'void', color: COLORS.voidOutline, polylines: exclusions, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }

  // --- EXPORT: riferimento (shapeOnly, non cucito) + le striature come UN ago (mono). I salti tra le
  //     polilinee diventano jump macchina; il multicolore futuro aggiungerà altri layer/aghi. ---
  const exportLayers: ExportLayer[] = [
    { id: 'reference', color: COLORS.reference, polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true },
  ];
  if (allPolylines.length) {
    exportLayers.push({ id: 'striatura', color: fillColor, polylines: allPolylines, strokeMm: THREAD_STROKE_MM });
  }

  return { layers, exportLayers, bounds: bnds, threadMm, blockCount: allPolylines.length };
}

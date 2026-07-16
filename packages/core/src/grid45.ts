// Generazione delle famiglie di diagonali (griglia a 45°). Riuso concettuale da embroidery-45-grid.
import type { Point, Bounds } from './types';

export interface GridLine {
  a: Point;
  b: Point;
  family: 'A' | 'B';
  index: number;
}

/**
 * Genera una famiglia di linee parallele a `angleDeg`, spaziate `spacingMm`
 * (spaziatura perpendicolare), che coprono interamente `bnds`.
 * Le linee sono lunghe quanto serve; il clip al perimetro avviene dopo.
 */
export function generateFamily(
  angleDeg: number,
  spacingMm: number,
  bnds: Bounds,
  origin: Point = { x: 0, y: 0 },
  family: 'A' | 'B' = 'A',
): GridLine[] {
  const rad = (angleDeg * Math.PI) / 180;
  const u = { x: Math.cos(rad), y: Math.sin(rad) };      // direzione linea
  const n = { x: -Math.sin(rad), y: Math.cos(rad) };     // normale (offset)

  const corners: Point[] = [
    { x: bnds.minX, y: bnds.minY },
    { x: bnds.maxX, y: bnds.minY },
    { x: bnds.maxX, y: bnds.maxY },
    { x: bnds.minX, y: bnds.maxY },
  ];
  // proiezioni sui due assi rispetto all'origine
  const projN = corners.map((c) => (c.x - origin.x) * n.x + (c.y - origin.y) * n.y);
  const projU = corners.map((c) => (c.x - origin.x) * u.x + (c.y - origin.y) * u.y);
  const minN = Math.min(...projN), maxN = Math.max(...projN);
  const minU = Math.min(...projU), maxU = Math.max(...projU);

  const lines: GridLine[] = [];
  const start = Math.floor(minN / spacingMm) * spacingMm;
  let index = 0;
  for (let off = start; off <= maxN + spacingMm; off += spacingMm, index++) {
    const base = { x: origin.x + off * n.x, y: origin.y + off * n.y };
    const a = { x: base.x + minU * u.x, y: base.y + minU * u.y };
    const b = { x: base.x + maxU * u.x, y: base.y + maxU * u.y };
    lines.push({ a, b, family, index });
  }
  return lines;
}

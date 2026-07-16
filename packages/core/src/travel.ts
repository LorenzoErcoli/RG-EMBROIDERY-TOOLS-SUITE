// Passaggi (travel) tra oggetti cuciti. Regola R26 (concatenamento) + passaggi sul bordo.
// routeTravel: linea retta se resta dentro la sagoma; altrimenti instrada LUNGO il perimetro.
import type { Point, Polyline } from './types';
import { distance, pointInPolygon, lerp } from './geometry';
import { resampleUniform } from './stitch';

/** Vero se il segmento a-b resta interamente dentro il poligono (campionamento). */
export function segmentInside(a: Point, b: Point, poly: Polyline, samples = 12): boolean {
  for (let i = 1; i < samples; i++) {
    if (!pointInPolygon(lerp(a, b, i / samples), poly)) return false;
  }
  return true;
}

function closestOnSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, d: distance(p, point) };
}

function nearestOnBoundary(p: Point, poly: Polyline) {
  let best = { point: poly[0], idx: 0, d: Infinity };
  for (let i = 0; i < poly.length; i++) {
    const c = closestOnSegment(p, poly[i], poly[(i + 1) % poly.length]);
    if (c.d < best.d) best = { point: c.point, idx: i, d: c.d };
  }
  return best;
}

function pathLen(pts: Point[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += distance(pts[i - 1], pts[i]);
  return s;
}

/** Cammino lungo il perimetro da pa (sul lato idx1) a pb (sul lato idx2), verso più corto. */
function walkBoundary(poly: Polyline, idx1: number, pa: Point, idx2: number, pb: Point): Polyline {
  const n = poly.length;
  if (idx1 === idx2) return [pa, pb];
  const fwd: Point[] = [pa];
  for (let i = (idx1 + 1) % n, c = 0; c <= n; c++) {
    fwd.push(poly[i]);
    if (i === idx2) break;
    i = (i + 1) % n;
  }
  fwd.push(pb);
  const bwd: Point[] = [pa];
  for (let i = idx1, c = 0; c <= n; c++) {
    bwd.push(poly[i]);
    if (i === (idx2 + 1) % n) break;
    i = (i - 1 + n) % n;
  }
  bwd.push(pb);
  return pathLen(fwd) <= pathLen(bwd) ? fwd : bwd;
}

/**
 * Passaggio che costeggia SEMPRE il contorno: a → punto più vicino sul bordo → cammino sul bordo
 * (via più corta) → punto vicino a b → b. "Poi entra" (l'ultimo tratto rientra fino a b).
 */
export function routeAlongBorder(a: Point, b: Point, boundary: Polyline | null, stitchMm: number): Polyline {
  if (!boundary || boundary.length < 3) return resampleUniform([a, b], stitchMm);
  const na = nearestOnBoundary(a, boundary);
  const nb = nearestOnBoundary(b, boundary);
  const mid = walkBoundary(boundary, na.idx, na.point, nb.idx, nb.point);
  return resampleUniform([a, ...mid, b], stitchMm);
}

/**
 * Passaggio da a a b. Se la retta resta dentro `boundary` → retta; altrimenti costeggia il
 * perimetro (routeAlongBorder). Ricampionato a `stitchMm`.
 */
export function routeTravel(a: Point, b: Point, boundary: Polyline | null, stitchMm: number): Polyline {
  if (!boundary || boundary.length < 3 || segmentInside(a, b, boundary)) {
    return resampleUniform([a, b], stitchMm);
  }
  return routeAlongBorder(a, b, boundary, stitchMm);
}

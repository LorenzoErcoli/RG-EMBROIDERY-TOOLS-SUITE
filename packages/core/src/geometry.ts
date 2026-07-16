// Primitive geometriche pure (mm). Riusabili da tutti i tool.
import type { Point, Polyline, Bounds } from './types';

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function bounds(points: Point[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function polygonArea(poly: Polyline): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a) / 2;
}

/** Ray casting. */
export function pointInPolygon(p: Point, poly: Polyline): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect =
      (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Intersezione tra i segmenti p1p2 e p3p4. Ritorna il parametro t su p1p2 e il punto, o null. */
export function segmentIntersection(
  p1: Point, p2: Point, p3: Point, p4: Point,
): { t: number; point: Point } | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // paralleli
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, point: { x: p1.x + t * d1x, y: p1.y + t * d1y } };
}

/** Tutte le intersezioni del segmento a-b con il perimetro del poligono, ordinate per t. */
export function segmentPolygonIntersections(
  a: Point, b: Point, poly: Polyline,
): { t: number; point: Point }[] {
  const hits: { t: number; point: Point }[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const h = segmentIntersection(a, b, poly[j], poly[i]);
    if (h) hits.push(h);
  }
  hits.sort((x, y) => x.t - y.t);
  return hits;
}

export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Versore da a verso b. */
export function unit(a: Point, b: Point): Point {
  const d = distance(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Normale (ruotata +90°) del versore. */
export const normal = (u: Point): Point => ({ x: -u.y, y: u.x });

function insetOnce(poly: Polyline, dist: number, sign: number): Polyline {
  const n = poly.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n], cur = poly[i], next = poly[(i + 1) % n];
    const e1 = unit(prev, cur), e2 = unit(cur, next);
    const n1 = { x: e1.y * sign, y: -e1.x * sign };
    const n2 = { x: e2.y * sign, y: -e2.x * sign };
    let mx = n1.x + n2.x, my = n1.y + n2.y;
    const ml = Math.hypot(mx, my) || 1;
    out.push({ x: cur.x + (mx / ml) * dist, y: cur.y + (my / ml) * dist });
  }
  return out;
}

/** Restringe (inset) un poligono di `dist` mm verso l'interno. Naive: ottimo per forme convesse. */
export function insetPolygon(poly: Polyline, dist: number): Polyline {
  if (dist <= 0 || poly.length < 3) return poly;
  let p = poly;
  const a0 = poly[0], aN = poly[poly.length - 1];
  if (Math.hypot(a0.x - aN.x, a0.y - aN.y) < 1e-6) p = poly.slice(0, -1);
  if (p.length < 3) return poly;
  const ca = insetOnce(p, dist, 1);
  const cb = insetOnce(p, dist, -1);
  return polygonArea(ca) < polygonArea(cb) ? ca : cb;
}

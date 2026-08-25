// Passaggi (travel) tra oggetti cuciti. Regola R26 (concatenamento) + passaggi sul bordo.
// routeTravel: linea retta se resta dentro la sagoma; altrimenti instrada LUNGO il perimetro.
// R5: se sulla strada c'è un'area vuota, il passaggio le GIRA ATTORNO — non la attraversa mai.
import type { Point, Polyline } from './types';
import { distance, pointInPolygon, lerp, segmentPolygonIntersections } from './geometry';
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

/** Vero se il segmento a-b entra in `poly`: lo taglia, oppure ci sta dentro per intero. */
function segmentEnters(a: Point, b: Point, poly: Polyline): boolean {
  if (poly.length < 3) return false;
  if (segmentPolygonIntersections(a, b, poly).length > 0) return true;
  return pointInPolygon(lerp(a, b, 0.5), poly);
}

/** Sposta un vertice del vuoto verso FUORI dal vuoto (clearance): normale locale, verso verificato. */
function pushOutOf(p: Point, poly: Polyline, idx: number, clearanceMm: number): Point {
  if (clearanceMm <= 0) return p;
  const n = poly.length;
  const prev = poly[(idx - 1 + n) % n], next = poly[(idx + 1) % n];
  let nx = -(next.y - prev.y), ny = next.x - prev.x;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  const out = { x: p.x + nx * clearanceMm, y: p.y + ny * clearanceMm };
  return pointInPolygon(out, poly) ? { x: p.x - nx * clearanceMm, y: p.y - ny * clearanceMm } : out;
}

/** Tappe che costeggiano il vuoto `v` invece di attraversarlo, dal punto d'ingresso a quello d'uscita. */
function detourAround(a: Point, b: Point, v: Polyline, clearanceMm: number): Point[] {
  const hits = segmentPolygonIntersections(a, b, v);
  const entry = hits.length ? hits[0].point : a;
  const exit = hits.length > 1 ? hits[hits.length - 1].point : b;
  const na = nearestOnBoundary(entry, v);
  const nb = nearestOnBoundary(exit, v);
  return walkBoundary(v, na.idx, na.point, nb.idx, nb.point)
    .map((p) => pushOutOf(p, v, nearestOnBoundary(p, v).idx, clearanceMm));
}

/**
 * R5 — il passaggio GIRA ATTORNO alle aree vuote. Prende una lista di tappe e, finché un tratto
 * entra in un vuoto, lo sostituisce col giro lungo il perimetro di quel vuoto (via più corta).
 * Il ciclo è limitato (`guard`): tappe nuove possono incrociare un altro vuoto, ma dopo pochi giri
 * o si è risolto o si smette — meglio un passaggio imperfetto che un ciclo infinito.
 */
export function avoidVoids(way: Point[], voids: Polyline[], clearanceMm = 0): Point[] {
  if (!voids.length || way.length < 2) return way;
  let cur = way;
  for (let guard = 0; guard < 8; guard++) {
    let touched = false;
    const next: Point[] = [cur[0]];
    for (let i = 1; i < cur.length; i++) {
      const p = cur[i - 1], q = cur[i];
      const v = voids.find((vv) => vv.length >= 3 && segmentEnters(p, q, vv));
      if (v) { next.push(...detourAround(p, q, v, clearanceMm)); touched = true; }
      next.push(q);
    }
    cur = next;
    if (!touched) break;
  }
  return cur;
}

/**
 * Passaggio che costeggia SEMPRE il contorno: a → punto più vicino sul bordo → cammino sul bordo
 * (via più corta) → punto vicino a b → b. "Poi entra" (l'ultimo tratto rientra fino a b).
 * Con `exclusions`, il cammino gira anche attorno ai vuoti (R5).
 */
export function routeAlongBorder(
  a: Point, b: Point, boundary: Polyline | null, stitchMm: number,
  exclusions: Polyline[] = [], clearanceMm = 0,
): Polyline {
  if (!boundary || boundary.length < 3) return resampleUniform(avoidVoids([a, b], exclusions, clearanceMm), stitchMm);
  const na = nearestOnBoundary(a, boundary);
  const nb = nearestOnBoundary(b, boundary);
  const mid = walkBoundary(boundary, na.idx, na.point, nb.idx, nb.point);
  return resampleUniform(avoidVoids([a, ...mid, b], exclusions, clearanceMm), stitchMm);
}

/**
 * Passaggio da a a b. Se la retta resta dentro `boundary` e non entra in un vuoto → retta;
 * se entra in un vuoto → ci gira attorno (R5); altrimenti costeggia il perimetro. Ricampionato
 * a `stitchMm`. `exclusions` è facoltativo: senza, il comportamento è quello di prima.
 */
export function routeTravel(
  a: Point, b: Point, boundary: Polyline | null, stitchMm: number,
  exclusions: Polyline[] = [], clearanceMm = 0,
): Polyline {
  const hitsVoid = exclusions.some((v) => v.length >= 3 && segmentEnters(a, b, v));
  if (!hitsVoid && (!boundary || boundary.length < 3 || segmentInside(a, b, boundary))) {
    return resampleUniform([a, b], stitchMm);
  }
  if (hitsVoid && (!boundary || boundary.length < 3 || segmentInside(a, b, boundary))) {
    return resampleUniform(avoidVoids([a, b], exclusions, clearanceMm), stitchMm);
  }
  return routeAlongBorder(a, b, boundary, stitchMm, exclusions, clearanceMm);
}

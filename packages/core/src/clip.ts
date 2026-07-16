// Clipping di linee/polilinee su un poligono (sagoma). Regola R5 (perimetro + void).
import type { Point, Polyline } from './types';
import { lerp, pointInPolygon, segmentPolygonIntersections } from './geometry';

/** Taglia il segmento a-b sul poligono: ritorna i tratti (coppie di punti) INTERNI. */
export function clipSegmentToPolygon(a: Point, b: Point, polygon: Polyline): [Point, Point][] {
  const hits = segmentPolygonIntersections(a, b, polygon).map((h) => h.t);
  const ts = [0, ...hits, 1].sort((x, y) => x - y);
  const runs: [Point, Point][] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    if (ts[i + 1] - ts[i] < 1e-6) continue;
    const mid = lerp(a, b, (ts[i] + ts[i + 1]) / 2);
    if (pointInPolygon(mid, polygon)) {
      runs.push([lerp(a, b, ts[i]), lerp(a, b, ts[i + 1])]);
    }
  }
  return runs;
}

/** Come sopra ma sottrae anche le esclusioni (void interni): un tratto è tenuto se dentro `polygon` e fuori da ogni `exclusion`. */
export function clipSegment(
  a: Point, b: Point, polygon: Polyline, exclusions: Polyline[] = [],
): [Point, Point][] {
  let runs = clipSegmentToPolygon(a, b, polygon);
  for (const ex of exclusions) {
    const next: [Point, Point][] = [];
    for (const [ra, rb] of runs) {
      // sottrai i tratti dentro l'esclusione
      const hits = segmentPolygonIntersections(ra, rb, ex).map((h) => h.t);
      const ts = [0, ...hits, 1].sort((x, y) => x - y);
      for (let i = 0; i < ts.length - 1; i++) {
        if (ts[i + 1] - ts[i] < 1e-6) continue;
        const mid = lerp(ra, rb, (ts[i] + ts[i + 1]) / 2);
        if (!pointInPolygon(mid, ex)) next.push([lerp(ra, rb, ts[i]), lerp(ra, rb, ts[i + 1])]);
      }
    }
    runs = next;
  }
  return runs;
}

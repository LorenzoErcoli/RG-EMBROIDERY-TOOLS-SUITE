// Quello che il Punto Pittorico chiede a una REGIONE, oltre a ciò che il core sa già fare.
//
// Il tipo `Region` e la domanda «questo punto è dentro?» (`pointInRegion`) stanno nel **core** dal
// 2026-09-04, promossi da `apps/broccato` insieme a `traceRegions`: qui non se ne tiene una copia,
// che sarebbe la trappola di R28 — stessa domanda, due risposte, e nessun modo di accorgersene.
//
// Resta locale quello che serve al riempimento curvo e a nessun altro: costruire una regione da
// poligoni sciolti, il suo ingombro, e soprattutto il **bordo indicizzato** — perché il campo
// armonico chiede migliaia di volte «qual è il bordo più vicino, e come corre lì?».
//
// Nessun DOM: si prova in Node.

import { type Point, type Polyline, type Bounds, type Region, bounds, polygonArea } from '@rg/core';

export type { Region };

export function makeRegion(outer: Polyline, holes: Polyline[] = []): Region {
  const netti = holes.filter((h) => h && h.length >= 3);
  const area = Math.abs(polygonArea(outer)) - netti.reduce((s, h) => s + Math.abs(polygonArea(h)), 0);
  return { outer, holes: netti, areaMm2: area };
}

/** Contorno e fori insieme: il BORDO della regione, che è ciò che vincola il campo di direzione. */
export const regionRings = (r: Region): Polyline[] => [r.outer, ...r.holes];

export const regionBounds = (r: Region): Bounds => bounds(r.outer);

export interface NearestBoundary {
  distMm: number;
  point: Point;
  /** Versore del lato più vicino. È una DIREZIONE, non un verso: ±t valgono uguale. */
  tangent: Point;
}

/**
 * Il bordo indicizzato a celle, per chiedergli il punto più vicino tante volte.
 *
 * Serve perché il campo armonico fissa la direzione **sul bordo** e la diffonde dentro: ogni nodo
 * della griglia deve sapere quanto dista dal bordo e come corre lì. A forza bruta sono milioni di
 * distanze punto-segmento; a celle sono qualche decina per query.
 */
export class BoundaryIndex {
  private readonly ax: Float64Array;
  private readonly ay: Float64Array;
  private readonly bx: Float64Array;
  private readonly by: Float64Array;
  private readonly cellMm: number;
  private readonly minX: number;
  private readonly minY: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly buckets: number[][];

  constructor(rings: Polyline[], cellMm = 4) {
    const segs: Array<[Point, Point]> = [];
    for (const ring of rings) {
      if (!ring || ring.length < 2) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if (Math.abs(a.x - b.x) > 1e-12 || Math.abs(a.y - b.y) > 1e-12) segs.push([a, b]);
      }
    }
    const n = segs.length;
    this.ax = new Float64Array(n); this.ay = new Float64Array(n);
    this.bx = new Float64Array(n); this.by = new Float64Array(n);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const [a, b] = segs[i];
      this.ax[i] = a.x; this.ay[i] = a.y; this.bx[i] = b.x; this.by[i] = b.y;
      minX = Math.min(minX, a.x, b.x); minY = Math.min(minY, a.y, b.y);
      maxX = Math.max(maxX, a.x, b.x); maxY = Math.max(maxY, a.y, b.y);
    }
    this.cellMm = Math.max(cellMm, 1e-3);
    this.minX = Number.isFinite(minX) ? minX : 0;
    this.minY = Number.isFinite(minY) ? minY : 0;
    this.nx = Math.max(1, Math.ceil((maxX - this.minX) / this.cellMm) + 1);
    this.ny = Math.max(1, Math.ceil((maxY - this.minY) / this.cellMm) + 1);
    this.buckets = Array.from({ length: this.nx * this.ny }, () => [] as number[]);
    for (let i = 0; i < n; i++) {
      // per bbox: una cella che non tocca il bbox del segmento non può contenerne un punto
      const i0 = this.col(Math.min(this.ax[i], this.bx[i])), i1 = this.col(Math.max(this.ax[i], this.bx[i]));
      const j0 = this.row(Math.min(this.ay[i], this.by[i])), j1 = this.row(Math.max(this.ay[i], this.by[i]));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) this.buckets[j * this.nx + k].push(i);
    }
  }

  private col(x: number): number {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) / this.cellMm)));
  }
  private row(y: number): number {
    return Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.minY) / this.cellMm)));
  }

  /** Il punto del bordo più vicino a `p`, con la direzione del lato su cui cade. */
  nearest(p: Point): NearestBoundary {
    const ci = this.col(p.x), cj = this.row(p.y);
    let bestD2 = Infinity, bestI = -1, bestT = 0;
    const maxRing = Math.max(this.nx, this.ny);
    for (let r = 0; r <= maxRing; r++) {
      // le celle dell'anello r distano almeno (r−1)·cella: appena il migliore è più vicino, basta
      if (bestI >= 0 && Math.sqrt(bestD2) <= (r - 1) * this.cellMm) break;
      let visto = false;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= this.ny) continue;
        for (let k = ci - r; k <= ci + r; k++) {
          if (k < 0 || k >= this.nx) continue;
          if (r > 0 && Math.abs(j - cj) !== r && Math.abs(k - ci) !== r) continue; // solo la corona
          visto = true;
          for (const i of this.buckets[j * this.nx + k]) {
            const dx = this.bx[i] - this.ax[i], dy = this.by[i] - this.ay[i];
            const len2 = dx * dx + dy * dy;
            let t = len2 > 0 ? ((p.x - this.ax[i]) * dx + (p.y - this.ay[i]) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = this.ax[i] + dx * t, qy = this.ay[i] + dy * t;
            const d2 = (p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy);
            if (d2 < bestD2) { bestD2 = d2; bestI = i; bestT = t; }
          }
        }
      }
      if (!visto && r > Math.max(this.nx, this.ny)) break;
    }
    if (bestI < 0) return { distMm: Infinity, point: p, tangent: { x: 1, y: 0 } };
    const dx = this.bx[bestI] - this.ax[bestI], dy = this.by[bestI] - this.ay[bestI];
    const len = Math.hypot(dx, dy) || 1;
    return {
      distMm: Math.sqrt(bestD2),
      point: { x: this.ax[bestI] + dx * bestT, y: this.ay[bestI] + dy * bestT },
      tangent: { x: dx / len, y: dy / len },
    };
  }
}

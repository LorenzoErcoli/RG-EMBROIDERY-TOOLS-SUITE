// L'AREA DI PROVA (Lorenzo, 2026-09-25: «disegno un'immagine di dimensioni grandi, poi la ritaglio,
// ma quello che ho disegnato grande fuori rimane: serve per indicare un punto che vogliamo testare
// nel ricamo, così disegno e modifico una sola volta»).
//
// Il disegno resta tutto, e si modifica tutto. Passaggi ed export si fanno solo dentro un rettangolo
// di celle: una griglia a sé, ritagliata, che parte da (0, 0). L'anteprima la rimette al suo posto
// spostandola di (dx, dy). Diverso dal «Ritaglia» dell'immagine, che rifà la maglia da un pezzo di
// foto e perde le modifiche a mano.
//
// Nessun DOM.

import type { Cells, GridSpec } from './model';
import { rowPitch } from './model';

/** Un rettangolo di celle: righe r0..r1-1, colonne c0..c1-1. */
export interface TestArea { r0: number; c0: number; r1: number; c1: number; }

/** L'area dentro la griglia; null se non resta niente (o se non c'era). */
export function clampArea(g: GridSpec, a: Partial<TestArea> | null | undefined): TestArea | null {
  if (!a) return null;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
  const r0 = Math.max(0, n(a.r0)), c0 = Math.max(0, n(a.c0));
  const r1 = Math.min(g.rows, n(a.r1)), c1 = Math.min(g.cols, n(a.c1));
  if (!(r1 > r0 && c1 > c0)) return null;
  return { r0, c0, r1, c1 };
}

/**
 * L'area da un rettangolo in mm sul ricamo: le celle col centro dentro. null se il rettangolo non
 * prende almeno una cella.
 */
export function areaFromMm(g: GridSpec, x0: number, y0: number, x1: number, y1: number): TestArea | null {
  const p = rowPitch(g);
  const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
  // centro della cella (r, c): ((c + ½)·w, r·p + h/2)
  const c0 = Math.ceil(xa / g.cellW - 0.5), c1 = Math.floor(xb / g.cellW - 0.5) + 1;
  const r0 = Math.ceil((ya - g.cellH / 2) / p), r1 = Math.floor((yb - g.cellH / 2) / p) + 1;
  return clampArea(g, { r0, c0, r1, c1 });
}

/** La griglia dell'area, le sue celle (rinumerate) e di quanto spostarla per rimetterla al suo posto. */
export function subGrid(g: GridSpec, cells: Cells, a: TestArea): { grid: GridSpec; cells: Cells; dx: number; dy: number } {
  const grid: GridSpec = { ...g, rows: a.r1 - a.r0, cols: a.c1 - a.c0 };
  const out: Cells = new Map();
  for (let r = a.r0; r < a.r1; r++) {
    for (let c = a.c0; c < a.c1; c++) {
      const m = cells.get(r * g.cols + c);
      if (m) out.set((r - a.r0) * grid.cols + (c - a.c0), m);
    }
  }
  return { grid, cells: out, dx: a.c0 * g.cellW, dy: a.r0 * rowPitch(g) };
}

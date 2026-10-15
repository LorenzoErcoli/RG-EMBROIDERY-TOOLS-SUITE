import type { ExportLayer } from '@rg/core';
import type { Cells } from '../../apps/cross-stitch/src/model';
import { DEFAULT_GRID } from '../../apps/cross-stitch/src/model';
import { DEFAULT_ROUTE, DEFAULT_STITCH, colorPolylinesTrim } from '../../apps/cross-stitch/src/routing';
import { routeAll } from '../../apps/cross-stitch/src/strips';

// Un campo piccolo di V a due fili sopra una base, a strisce, con un filo a due passate e un salto a mano:
// celle da 2,4 mm e punto massimo 7 mm, così nessun punto supera il massimo del DST (~12,1 mm) e il DST
// rilegge lo stesso numero di punti che hanno gli strati.
export async function prova() {
  const grid = { ...DEFAULT_GRID, rows: 12, cols: 16, cellW: 2.4, cellH: 3.5, overlapPct: 30 };
  const cells: Cells = new Map();
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    cells.set(r * grid.cols + c, { stitch: 'v', color: (r * 3 + c * 5) % 7 < 2 ? 1 : (r + 2 * c) % 9 === 0 ? 2 : 0 });
  }
  const threads = [{ hex: '#1a1a1a' }, { hex: '#b3261e', passes: 2 }, { hex: '#2b6cb0' }];
  const route = { ...DEFAULT_ROUTE, base: { color: 0, stitch: 'v' as const }, strips: { rows: 4, shiftMm: 0.3 }, baseWhole: true, trimJumps: true };
  const stitch = { ...DEFAULT_STITCH };
  const cuts: Array<[number, number, number, number]> = [];
  const forced: Array<{ from: [number, number]; to: [number, number]; via: Array<[number, number]> }> = [];
  return {
    ingresso: { cells, threads, area: null, cuts, forced, module: null, forma: null },
    params: { grid, route, stitch },
    // la strada di prima, per esteso (exportLayers() di tool.ts, senza area, modulo, forma né fili spenti)
    diretto: (): ExportLayer[] => {
      const passes = (i: number) => Math.max(1, Math.round(threads[i]?.passes ?? route.repetitions ?? 1));
      const params = { ...route, passesByColor: Object.fromEntries(threads.map((_, i) => [i, passes(i)])), cuts: [] as Array<[number, number]>, forced: [], mask: null };
      const res = routeAll(grid, cells, params);
      const shift = params.strips?.shiftMm ?? 0;
      return res.colors.map((cr) => {
        const dy = (cr.strip ?? 0) * shift;
        const pt = colorPolylinesTrim(grid, cr, stitch);
        return {
          id: cr.strip === undefined ? `filo-${cr.color + 1}` : `striscia-${cr.strip + 1}-filo-${cr.color + 1}`,
          color: threads[cr.color]?.hex ?? '#000000',
          polylines: pt.polylines.map((pl) => (dy ? pl.map((q) => ({ x: q.x, y: q.y + dy })) : pl)),
          trims: route.trimJumps === false ? pt.trims : pt.trims.map((t, k) => t || k > 0),
          strokeMm: Math.min(grid.cellW / 2, grid.cellH) * Math.min(0.9, 0.5 * (1 + 0.15 * (passes(cr.color) - 1))),
        };
      });
    },
  };
}

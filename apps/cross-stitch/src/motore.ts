// Il contratto del motore (K1b) per il Punto croce. Avvolge la strada che il tool percorreva in `exportLayers()`:
// dal disegno (griglia, celle, fili, area, salti, passaggi forzati, modulo, forma) ai passaggi (`routeAll`) e da lì
// alle tracce da cucire (`colorPolylinesTrim` per ogni filo). Funzioni pure: niente DOM, niente stato del tool;
// tool.ts costruisce lo `StatoCross` dal suo `st` e chiama queste stesse funzioni (anche per l'anteprima).
import type { ExportLayer } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { gridHeight, type Cells, type GridSpec, type Thread } from './model';
import { colorPolylinesTrim, type RouteParams, type RouteResult, type StitchParams } from './routing';
import { cellMask, subMask, type PieceShape } from './shape';
import { entryRows, routeAll, type ModulePath } from './strips';
import { tileModule, type KnitModule } from './module';
import { clampArea, subGrid, type TestArea } from './area';
import { shiftGroup } from './zones';

/** Lo stato da cui nascono i passaggi: gli stessi campi dello `st` del tool, più la forma del pezzo. */
export interface StatoCross {
  grid: GridSpec;
  cells: Cells;
  threads: Thread[];
  route: RouteParams;
  stitch: StitchParams;
  area: TestArea | null;
  /** I salti a mano: passaggi fra due vertici (riga, colonna del reticolo del disegno intero). */
  cuts: Array<[number, number, number, number]>;
  /** I passaggi ridisegnati a mano (senza modulo ripetuto). */
  forced: Array<{ from: [number, number]; to: [number, number]; via: Array<[number, number]> }>;
  module: KnitModule | null;
  shape: PieceShape | null;
}

/** Le passate di un filo: le sue, o quelle generali dei progetti di prima. */
export const passesDi = (s: Pick<StatoCross, 'threads' | 'route'>, color: number): number =>
  Math.max(1, Math.round(s.threads[color]?.passes ?? s.route.repetitions ?? 1));

/** Lo spessore del filo in mm (anteprima e SVG): circa mezza cella, di più con più passate. */
export const larghezzaFilo = (g: GridSpec, passes: number): number =>
  Math.min(g.cellW / 2, g.cellH) * Math.min(0.9, 0.5 * (1 + 0.15 * (passes - 1)));

/** I parametri del routing con le passate di ogni filo. */
export const paramsRoute = (s: Pick<StatoCross, 'threads' | 'route'>): RouteParams =>
  ({ ...s.route, passesByColor: Object.fromEntries(s.threads.map((_, i) => [i, passesDi(s, i)])) });

/** Il modulo come percorso: pezzi e riga d'ingresso di ogni filo (il primo pezzo dice dove). */
export const modulePathOf = (m: KnitModule): ModulePath => ({ cols: m.cols, rows: m.rows, marks: m.marks, pieceOf: m.seq, entryRow: entryRows({ cols: m.cols, marks: m.marks, pieceOf: m.seq, starts: m.starts }), cuts: m.cuts, forced: m.forced, bands: m.bands, bandAt: m.bandAt, ordered: m.ordered, offset: m.offset });

/** Il ricamo è proprio il modulo ripetuto (nessuna V ritoccata su una copia sola)? */
export const designIsTiled = (s: Pick<StatoCross, 'grid' | 'cells' | 'module'>): boolean => {
  const m = s.module; if (!m) return false;
  const t = tileModule(s.grid, m);
  if (t.size !== s.cells.size) return false;
  for (const [k, v] of t) { const c = s.cells.get(k); if (!c || c.color !== v.color || c.stitch !== v.stitch) return false; }
  return true;
};

/**
 * Cosa si passa a `routeAll`: tutto il disegno, o solo l'area di prova (una griglia a sé che parte da 0; i gruppi,
 * in mm, si spostano con lei). `maskFor` è la maschera delle celle della forma (il tool ne tiene una in memoria;
 * senza, si calcola qui).
 */
export function ingressoPassaggi(s: StatoCross, cells: Cells = s.cells, maskFor: (g: GridSpec) => Uint8Array | null = (g) => (s.shape ? cellMask(g, s.shape) : null)) {
  const params = paramsRoute(s);
  // IL PERCORSO DEL MODULO RIPETUTO (strips.ts): con un modulo, senza gruppi a mano e senza area di
  // prova, ogni filo si calcola una volta sul modulo (ingresso a sinistra, uscita a destra alla stessa
  // altezza) e si ripete identico in ogni copia.
  if (s.module && !(params.groups && params.groups.length) && !(params.areas && params.areas.length) && !clampArea(s.grid, s.area) && designIsTiled(s)) {
    params.modulePath = modulePathOf(s.module);
  }
  // COPIA PER COPIA (Lorenzo, 2026-10-01: i passaggi del modulo). Con un modulo, ogni striscia si
  // cuce una copia alla volta, da sinistra a destra: dopo 2-3 copie il motore ripete da solo lo
  // stesso giro in ogni copia (misurato sul Fair Isle: copie identiche fino al bordo). Costa +8%
  // di filo in vista sulla striscia libera. Se ci sono gruppi disegnati a mano, valgono quelli.
  if (s.module && !params.modulePath && !(params.groups && params.groups.length)) {
    const C = s.module.cols, n = Math.ceil(s.grid.cols / C), h = gridHeight(s.grid);
    params.groups = Array.from({ length: n }, (_, k) => ({ x: k * C * s.grid.cellW + 0.01, y: -1, w: C * s.grid.cellW - 0.02, h: h + 2 }));
  }
  const a = clampArea(s.grid, s.area);
  const toIndex = (grid: GridSpec, i0: number, j0: number) => (i: number, j: number) => {
    const ii = i - i0, jj = j - j0;
    return ii < 0 || ii > grid.rows || jj < 0 || jj > 2 * grid.cols ? -1 : ii * (2 * grid.cols + 1) + jj;
  };
  const withCuts = (grid: GridSpec, i0: number, j0: number) => {
    const ix = toIndex(grid, i0, j0);
    params.cuts = s.cuts.map(([i1, j1, i2, j2]) => [ix(i1, j1), ix(i2, j2)] as [number, number]).filter(([x, y]) => x >= 0 && y >= 0);
    if (!params.modulePath) params.forced = s.forced.map((q) => ({ from: ix(...q.from), to: ix(...q.to), via: q.via.map((v) => ix(...v)) })).filter((q) => q.from >= 0 && q.to >= 0 && q.via.every((v) => v >= 0));
  };
  const mask = maskFor(s.grid);
  if (!a) { withCuts(s.grid, 0, 0); params.mask = mask; return { grid: s.grid, cells, params, dx: 0, dy: 0 }; }
  if (mask) params.mask = subMask(mask, s.grid.cols, a.r0, a.r1, a.c0, a.c1);
  const sub = subGrid(s.grid, cells, a);
  if (params.groups) params.groups = params.groups.map((q) => shiftGroup(q, sub.dx, sub.dy));
  if (params.areas) params.areas = params.areas.map((q) => shiftGroup(q, sub.dx, sub.dy));
  withCuts(sub.grid, a.r0, 2 * a.c0);
  return { ...sub, params };
}

/**
 * Le tracce da esportare (SVG e DST), in ordine d'ago: solo gli stop accesi (Vedi). Uno stop spento non esiste nel
 * file, e i passaggi degli altri si ricalcolano come se non ci fosse: quello che copriva non copre più.
 */
export function stratiCross(s: StatoCross, maskFor?: (g: GridSpec) => Uint8Array | null, ready?: RouteResult | null): ExportLayer[] {
  const on = (color: number) => !s.threads[color]?.hidden;
  const cells: Cells = new Map([...s.cells].filter(([, m]) => on(m.color)));
  const inp = ingressoPassaggi(s, cells, maskFor);
  if (inp.params.base && !on(inp.params.base.color)) inp.params.base = null;
  // `ready`: i passaggi già calcolati sugli stessi dati (il tool li ha dal worker; con «Ottimizza l'ordine» rifarli
  // qui bloccherebbe la pagina per decine di secondi)
  const res = ready ?? routeAll(inp.grid, inp.cells, inp.params);
  // la compensazione del ritiro: la striscia k scende (o sale) di k × shiftMm
  const shift = inp.params.strips?.shiftMm ?? 0;
  return res.colors.map((cr) => {
    const dy = (cr.strip ?? 0) * shift;
    const pt = colorPolylinesTrim(inp.grid, cr, s.stitch);
    const polylines = pt.polylines.map((pl) => (dy ? pl.map((q) => ({ x: q.x, y: q.y + dy })) : pl));
    return {
      id: cr.strip === undefined ? `filo-${cr.color + 1}` : `striscia-${cr.strip + 1}-filo-${cr.color + 1}`,
      color: s.threads[cr.color]?.hex ?? '#000000',
      polylines,
      // il taglio: a ogni salto (di partenza), o solo ai salti a mano
      trims: s.route.trimJumps === false ? pt.trims : pt.trims.map((t, k) => t || k > 0),
      strokeMm: larghezzaFilo(s.grid, passesDi(s, cr.color)),
    };
  });
}

/**
 * I parametri, con la forma del file di progetto: `grid` (le misure), `route` (tutto l'oggetto che il tool salva,
 * con anche base/gruppi/blocchi scelti a mano), `stitch`.
 */
export interface ParamsCrossStitch {
  grid: GridSpec;
  route: RouteParams;
  stitch: StitchParams;
}

/** Quello che l'utente disegna e sceglie a mano: le celle, i fili, l'area di prova, i salti e i passaggi forzati, il modulo, la forma. */
export interface IngressoCrossStitch extends Ingresso {
  cells: Cells;
  threads: Thread[];
  area?: TestArea | null;
  cuts?: StatoCross['cuts'];
  forced?: StatoCross['forced'];
  module?: KnitModule | null;
  /** La forma del pezzo (perimetri e vuoti), se c'è. */
  forma?: PieceShape | null;
}

export const motore: Motore<IngressoCrossStitch, ParamsCrossStitch> = {
  id: 'cross-stitch',
  async genera(ingresso, params) {
    const strati = stratiCross({
      grid: params.grid, cells: ingresso.cells, threads: ingresso.threads, route: params.route, stitch: params.stitch,
      area: ingresso.area ?? null, cuts: ingresso.cuts ?? [], forced: ingresso.forced ?? [], module: ingresso.module ?? null, shape: ingresso.forma ?? null,
    });
    return { strati, avvisi: [] };
  },
};

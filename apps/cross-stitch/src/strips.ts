// IL RICAMO A STRISCE (Lorenzo, 2026-10-01, sul Fair Isle a punto V: «la macchina da ricamo ha dei
// ritiri, quindi lavorare tutto un colore e poi tutto un altro non si riuscirà mai a riprendere
// precisamente il registro… muovendosi a strisce, in cui faccio lavorare prima tutti i colori e poi
// scendo e ricomincio»).
//
// La griglia si divide in strisce orizzontali di `rows` righe. Ogni striscia è una griglia a sé
// (come l'area di prova): la sua base, poi i suoi colori dal chiaro allo scuro, coi passaggi nascosti
// solo sotto i punti della STESSA striscia. Poi la striscia dopo. I passaggi di ogni striscia
// tornano nelle coordinate della griglia intera e si accodano: il risultato è una sola sequenza di
// fili (ColorRoute con `strip`), che l'anteprima, l'ordine, i salti a mano e l'export leggono come
// prima. Nel DST ogni (striscia, filo) è uno stop: gli stop si ripetono a ogni striscia.
//
// Nessun DOM.

import type { Cells, GridSpec, Stitch } from './model';
import { rowPitch, segmentPoints, vertexIndex } from './model';
import { routeCells, type ColorRoute, type RouteMetrics, type RouteParams, type RouteResult, type RouteSeg } from './routing';

/** Le strisce: quante righe ciascuna (l'ultima può essere più corta). */
export interface StripOptions {
  rows: number;
  /**
   * Compensazione del ritiro, mm per striscia: la striscia k si sposta di k × shiftMm in verticale
   * (positivo = allontana, negativo = avvicina). Vale per l'export e per l'anteprima, non per il
   * calcolo dei passaggi.
   */
  shiftMm?: number;
}

/** Dove comincia ogni striscia: [riga iniziale, riga finale esclusa]. */
export function stripRanges(g: GridSpec, rows: number): Array<[number, number]> {
  const n = Math.max(1, Math.round(rows));
  const out: Array<[number, number]> = [];
  for (let r0 = 0; r0 < g.rows; r0 += n) out.push([r0, Math.min(g.rows, r0 + n)]);
  return out;
}

/** I passaggi striscia per striscia, nelle coordinate della griglia intera. */
export function routeStrips(g: GridSpec, cells: Cells, params: RouteParams, opts: StripOptions): RouteResult {
  const W = 2 * g.cols + 1;
  const pitch = rowPitch(g);
  const colors: ColorRoute[] = [];
  const metrics: RouteMetrics = { legs: 0, visibleMm: 0, retraceMm: 0, verticalMm: 0, hiddenMm: 0, jumps: 0, jumpMm: 0, maxExtra: 0 };
  stripRanges(g, opts.rows).forEach(([r0, r1], strip) => {
    const grid: GridSpec = { ...g, rows: r1 - r0 };
    const sub: Cells = new Map();
    for (let r = r0; r < r1; r++) for (let c = 0; c < g.cols; c++) { const m = cells.get(r * g.cols + c); if (m) sub.set((r - r0) * g.cols + c, m); }
    const shift = r0 * W; // i vertici della striscia sono quelli della griglia intera, r0 righe più su
    const dy = r0 * pitch;
    const p: RouteParams = {
      ...params,
      groups: params.groups?.map((q) => ({ ...q, y: q.y - dy })),
      cuts: params.cuts?.map(([a, b]) => [a - shift, b - shift] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a < (grid.rows + 1) * W && b < (grid.rows + 1) * W),
    };
    const res = routeCells(grid, sub, p);
    for (const cr of res.colors) colors.push({ color: cr.color, strip, segs: cr.segs.map((s) => ({ kind: s.kind, from: s.from + shift, to: s.to + shift })) });
    const m = res.metrics;
    metrics.legs += m.legs; metrics.visibleMm += m.visibleMm; metrics.retraceMm += m.retraceMm; metrics.verticalMm += m.verticalMm;
    metrics.hiddenMm += m.hiddenMm; metrics.jumps += m.jumps; metrics.jumpMm += m.jumpMm; metrics.maxExtra = Math.max(metrics.maxExtra, m.maxExtra);
  });
  return { colors, metrics };
}

/** I passaggi: a strisce se richiesto, altrimenti tutto il ricamo insieme. */
export function routeAll(g: GridSpec, cells: Cells, params: RouteParams): RouteResult {
  if (params.modulePath && params.modulePath.cols <= g.cols) return routeModuleTiled(g, cells, params, params.modulePath);
  const s = params.strips;
  return s && s.rows > 0 && s.rows < g.rows ? routeStrips(g, cells, params, s) : routeCells(g, cells, params);
}

// ------------------------------------------------------------
// IL PERCORSO DEL MODULO (Lorenzo, 2026-10-02: «il percorso del filo inizia dal lato sinistro e deve
// finire nel lato destro alla stessa altezza, così che il modulo vicino inizi correttamente lì»).
//
// Ogni filo si calcola UNA volta sul modulo: entra sul lato sinistro all'altezza della riga
// d'ingresso, cuce i suoi pezzi nell'ordine in cui sono stati disegnati, esce sul lato destro alla
// stessa altezza. L'uscita di una copia è l'ingresso della copia accanto: nel ricamo il percorso si
// ripete IDENTICO in ogni copia, senza passaggi fra una e l'altra. Per ogni striscia: la base (col
// motore, su tutta la striscia), poi ogni filo copia per copia da sinistra a destra. Le copie tagliate
// dal bordo del ricamo le fa il motore, dopo le copie intere dello stesso filo.
// ------------------------------------------------------------

/** Il modulo per il percorso: misura, colore e pezzo di ogni V, riga d'ingresso di ogni filo. */
export interface ModulePath {
  cols: number;
  rows: number;
  /** Per V del modulo (riga per riga): il suo filo e punto, o null. */
  marks: Array<{ stitch: Stitch; color: number } | null>;
  /** Per V del modulo: il numero del pezzo (0 = nessuno). */
  pieceOf?: number[];
  /** Per filo: la riga (0..rows-1) dove entra a sinistra ed esce a destra. */
  entryRow: Record<number, number>;
  /** Salti a mano del modulo (coppie di vertici del reticolo del modulo). */
  cuts?: Array<[number, number]>;
  /** Passaggi ridisegnati a mano del modulo (vertici del reticolo del modulo). */
  forced?: Array<{ from: number; to: number; via: number[] }>;
}

/** Il percorso di ogni filo sul modulo da solo (la base, se c'è, non è nel modulo: va sotto tutto). */
export function routeModule(g: GridSpec, mp: ModulePath, params: RouteParams): RouteResult {
  const mg: GridSpec = { ...g, cols: mp.cols, rows: mp.rows };
  const baseColor = params.base?.color;
  const cells: Cells = new Map();
  mp.marks.forEach((m, i) => { if (m && m.color !== baseColor) cells.set(i, { ...m }); });
  const startAt: Record<number, number> = {}, endAt: Record<number, number> = {};
  for (const [c, row] of Object.entries(mp.entryRow)) {
    const rr = Math.max(0, Math.min(mp.rows - 1, row));
    startAt[Number(c)] = vertexIndex(mg, rr, 0);
    endAt[Number(c)] = vertexIndex(mg, rr, 2 * mp.cols);
  }
  return routeCells(mg, cells, { ...params, base: null, strips: null, modulePath: null, groups: [], cuts: mp.cuts ?? [], forced: mp.forced ?? [], pieceOf: mp.pieceOf, startAt, endAt });
}

/** La riga d'ingresso proposta per ogni filo: quella dove comincia il suo primo pezzo (o la sua V più in alto). */
export function entryRows(mp: { cols: number; marks: Array<{ color: number } | null>; pieceOf?: number[]; starts?: Record<number, number> }): Record<number, number> {
  const out: Record<number, number> = {};
  const firstPiece = new Map<number, number>();
  mp.marks.forEach((m, i) => {
    if (!m) return;
    const pc = mp.pieceOf?.[i] ?? 0;
    if (pc > 0 && (!firstPiece.has(m.color) || pc < firstPiece.get(m.color)!)) firstPiece.set(m.color, pc);
    if (out[m.color] === undefined) out[m.color] = Math.floor(i / mp.cols);
  });
  for (const [c, pc] of firstPiece) { const start = mp.starts?.[pc]; if (start !== undefined) out[c] = Math.floor(start / mp.cols); }
  return out;
}

/** Il ricamo = il modulo ripetuto; il percorso del modulo ripetuto in ogni copia intera. */
export function routeModuleTiled(g: GridSpec, cells: Cells, params: RouteParams, mp: ModulePath): RouteResult {
  const W = 2 * g.cols + 1, Wm = 2 * mp.cols + 1;
  const mod = routeModule(g, mp, params);
  const byColor = new Map(mod.colors.map((cr) => [cr.color, cr]));
  const colors: ColorRoute[] = [];
  const metrics: RouteMetrics = { legs: 0, visibleMm: 0, retraceMm: 0, verticalMm: 0, hiddenMm: 0, jumps: 0, jumpMm: 0, maxExtra: 0 };
  const add = (m: RouteMetrics, times = 1) => {
    metrics.legs += m.legs * times; metrics.visibleMm += m.visibleMm * times; metrics.retraceMm += m.retraceMm * times;
    metrics.verticalMm += m.verticalMm * times; metrics.hiddenMm += m.hiddenMm * times; metrics.jumps += m.jumps * times; metrics.jumpMm += m.jumpMm * times;
    metrics.maxExtra = Math.max(metrics.maxExtra, m.maxExtra);
  };
  const fullX = Math.floor(g.cols / mp.cols);
  const baseC = params.base?.color;
  const order = [...new Set([...(baseC !== undefined ? [baseC] : []), ...[...cells.values()].map((m) => m.color)])]
    .sort((a, b) => (a === baseC ? -1 : b === baseC ? 1 : a - b));
  stripRanges(g, mp.rows).forEach(([r0, r1], strip) => {
    const full = r1 - r0 === mp.rows;
    // il resto della striscia (copie tagliate dal bordo) e la base: col motore
    const grid: GridSpec = { ...g, rows: r1 - r0 };
    const rest: Cells = new Map();
    const c0 = full ? fullX * mp.cols : 0;
    for (let r = r0; r < r1; r++) for (let c = c0; c < g.cols; c++) { const m = cells.get(r * g.cols + c); if (m) rest.set((r - r0) * g.cols + c, m); }
    const shift = r0 * W, dy = r0 * rowPitch(g);
    // il pezzo tagliato di ogni filo comincia dove il filo esce dall'ultima copia intera: il filo prosegue
    const startAt: Record<number, number> = {};
    if (full && fullX > 0) for (const [c, row] of Object.entries(mp.entryRow)) { const cr = byColor.get(Number(c)); if (cr && cr.segs.length) startAt[Number(c)] = Math.max(0, Math.min(mp.rows - 1, row)) * W + 2 * mp.cols * fullX; }
    const restRes = routeCells(grid, rest, { ...params, strips: null, modulePath: null, groups: params.groups?.map((q) => ({ ...q, y: q.y - dy })), cuts: [], startAt });
    add(restRes.metrics);
    const restBy = new Map(restRes.colors.map((cr) => [cr.color, cr]));
    for (const color of order) {
      if (color === baseC) {
        const b = restBy.get(color);
        if (b) colors.push({ color, strip, segs: b.segs.map((s) => ({ kind: s.kind, from: s.from + shift, to: s.to + shift })) });
        continue;
      }
      const segs: RouteSeg[] = [];
      const mr = full ? byColor.get(color) : undefined;
      if (mr && mr.segs.length) {
        for (let k = 0; k < fullX; k++) {
          // il vertice (i, j) del modulo è il vertice (r0 + i, j + 2 C k) del ricamo
          const tr = (v: number) => { const i = Math.floor(v / Wm), j = v - i * Wm; return (r0 + i) * W + j + 2 * mp.cols * k; };
          for (const s of mr.segs) segs.push({ kind: s.kind, from: tr(s.from), to: tr(s.to) });
        }
      }
      const rc = restBy.get(color);
      if (rc) for (const s of rc.segs) segs.push({ kind: s.kind, from: s.from + shift, to: s.to + shift });
      if (segs.length) colors.push({ color, strip, segs });
    }
    if (full && fullX > 0) add(mod.metrics, fullX);
  });
  return applyCuts(g, { colors, metrics }, params.cuts ?? []);
}

/** I salti a mano sul percorso finito: il passaggio fra quei due vertici diventa un salto. */
function applyCuts(g: GridSpec, res: RouteResult, cuts: Array<[number, number]>): RouteResult {
  if (!cuts.length) return res;
  const key = (a: number, b: number) => (a < b ? a + ':' + b : b + ':' + a);
  const set = new Set(cuts.map(([a, b]) => key(a, b)));
  const m = res.metrics;
  const len = (s: RouteSeg) => { const [a, b] = segmentPoints(g, s.from, s.to); return Math.hypot(b.x - a.x, b.y - a.y); };
  for (const cr of res.colors) {
    const out: RouteSeg[] = [];
    let i = 0;
    while (i < cr.segs.length) {
      const s = cr.segs[i];
      if (s.kind === 'stitch' || s.kind === 'jump') { out.push(s); i++; continue; }
      let j = i; while (j < cr.segs.length && cr.segs[j].kind !== 'stitch' && cr.segs[j].kind !== 'jump') j++;
      if (set.has(key(cr.segs[i].from, cr.segs[j - 1].to))) {
        for (let q = i; q < j; q++) {
          const t = cr.segs[q], l = len(t);
          if (t.kind === 'hidden') m.hiddenMm -= l; else if (t.kind === 'vertical') m.verticalMm -= l; else if (t.kind === 'retrace') m.retraceMm -= l; else m.visibleMm -= l;
        }
        m.jumps++;
        out.push({ kind: 'jump', from: cr.segs[i].from, to: cr.segs[j - 1].to });
      } else for (let q = i; q < j; q++) out.push(cr.segs[q]);
      i = j;
    }
    cr.segs = out;
  }
  return res;
}

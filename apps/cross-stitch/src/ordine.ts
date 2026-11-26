// L'ORDINE DEI FILI CONSIGLIATO (Lorenzo, 2026-11-26: «provare anche a valutare quale filo far passare prima e quale
// dopo in base al minor numero di salti, tenendo sempre in considerazione che lo scuro sopra copre meglio il chiaro
// sotto… quindi chiaro sotto scuro sopra»). Coi passaggi mai in vista, l'ordine decide quanto un filo si può
// nascondere sotto quelli che vengono dopo: sul suo modulo da 30 a 51 salti secondo l'ordine. Qui si provano gli
// ordini e si dà a ognuno un costo: i salti, più quanto l'ordine mette lo scuro sotto il chiaro (un salto ogni
// `LUMA_PER_JUMP` punti di luminosità invertiti). Si propone, non si cambia niente da soli.
import type { Cells, GridSpec } from './model';
import type { RouteParams } from './routing';
import { entryRows, routeAll, routeBands, type ModulePath } from './strips';
import type { KnitModule } from './module';

/** Quanti punti di luminosità (0-255) di scuro sotto il chiaro valgono un salto. */
export const LUMA_PER_JUMP = 4;

/** La luminosità di un filo, 0-255 (la stessa del bottone «Dal chiaro allo scuro»). */
export function lumaOf(hex: string): number {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  return 0.3 * parseInt(f.slice(0, 2), 16) + 0.59 * parseInt(f.slice(2, 4), 16) + 0.11 * parseInt(f.slice(4, 6), 16);
}

export interface OrderInput {
  /** Il ricamo come lo riceve il motore (routeInput del tool). */
  grid: GridSpec;
  cells: Cells;
  params: RouteParams;
  /** Col modulo si prova il modulo da solo (più veloce, e i salti sono quelli di un modulo). */
  module: KnitModule | null;
  /** Per il modulo: la griglia del ricamo vero (misure delle celle). */
  realGrid: GridSpec;
  /** I colori dei fili, per la luminosità. */
  hex: string[];
}

export interface OrderResult {
  /** order[nuovo] = vecchio, come `permuteThreads` del tool. */
  order: number[];
  jumps: number;
  visibleMm: number;
  /** Punti di luminosità di scuro messo sotto il chiaro, sommati su tutte le coppie. */
  darkUnder: number;
  cost: number;
}

/** Lo stesso ricamo coi fili in un altro ordine (`order[nuovo] = vecchio`). */
function permuted(inp: OrderInput, order: number[]): { cells: Cells; params: RouteParams; module: KnitModule | null } {
  const re = new Map(order.map((old, nw) => [old, nw]));
  const to = (c: number) => re.get(c) ?? c;
  const cells: Cells = new Map([...inp.cells].map(([k, m]) => [k, { ...m, color: to(m.color) }]));
  const p = inp.params;
  const keys = <V,>(o: Record<number, V> | undefined) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [to(Number(k)), v])) as Record<number, V> : o);
  const params: RouteParams = {
    ...p,
    base: p.base ? { ...p.base, color: to(p.base.color) } : p.base,
    passesByColor: keys(p.passesByColor),
    modulePath: p.modulePath ? { ...p.modulePath, marks: p.modulePath.marks.map((m) => (m ? { ...m, color: to(m.color) } : null)) } : p.modulePath,
  };
  const m = inp.module;
  const module = m ? { ...m, marks: m.marks.map((x) => (x ? { ...x, color: to(x.color) } : null)), bands: keys(m.bands), bandAt: keys(m.bandAt), ordered: m.ordered?.map(to) } : null;
  return { cells, params, module };
}

const pathOf = (m: KnitModule): ModulePath => ({
  cols: m.cols, rows: m.rows, marks: m.marks, pieceOf: m.seq, entryRow: entryRows({ cols: m.cols, marks: m.marks, pieceOf: m.seq, starts: m.starts }),
  cuts: m.cuts, forced: m.forced, bands: m.bands, bandAt: m.bandAt, ordered: m.ordered, offset: m.offset, repeat: m.repeat,
});

/**
 * Salti e filo in vista con quest'ordine. Nel modulo ogni filo si calcola da solo e dipende solo da QUALI fili vengono
 * dopo (lo coprono), non dal loro ordine: `memo` tiene i conti di ogni filo per ogni gruppo di fili dopo, e un ordine
 * nuovo rifà solo i fili che hanno cambiato gruppo.
 */
export function evalOrder(inp: OrderInput, order: number[], memo: Map<string, { jumps: number; visibleMm: number }> = new Map()): OrderResult {
  const q = permuted(inp, order);
  let jumps = 0, visibleMm = 0;
  if (q.module) {
    const mp = pathOf(q.module), base = inp.params.base?.color;
    order.forEach((old, nw) => {
      if (old === base || !q.module!.marks.some((m) => m && m.color === nw)) return;
      const key = old + '|' + order.slice(nw + 1).filter((c) => c !== base).sort((a, b) => a - b).join(',');
      let r = memo.get(key);
      if (!r) {
        r = { jumps: 0, visibleMm: 0 };
        for (const b of routeBands(inp.realGrid, mp, nw, q.params)) { r.jumps += b.metrics.jumps + (b.joined ? 0 : 1); r.visibleMm += b.metrics.visibleMm; }
        memo.set(key, r);
      }
      jumps += r.jumps; visibleMm += r.visibleMm;
    });
  } else {
    const res = routeAll(inp.grid, q.cells, q.params);
    jumps = res.metrics.jumps; visibleMm = res.metrics.visibleMm;
  }
  const base = inp.params.base?.color;
  let darkUnder = 0;
  const sewn = order.filter((c) => c !== base);
  for (let a = 0; a < sewn.length; a++) for (let b = a + 1; b < sewn.length; b++) {
    const d = lumaOf(inp.hex[sewn[b]] ?? '#000') - lumaOf(inp.hex[sewn[a]] ?? '#000');
    if (d > 0) darkUnder += d; // quello sotto (a) è più scuro di quello sopra (b)
  }
  return { order, jumps, visibleMm, darkUnder, cost: jumps + darkUnder / LUMA_PER_JUMP + visibleMm / 1000 };
}

/**
 * Gli ordini migliori, dal più conveniente: si parte dall'ordine di adesso e da quello dal chiaro allo scuro, e si
 * scambiano due fili alla volta finché il costo scende (la base resta prima). Al più `maxEvals` prove.
 */
export function suggestOrders(inp: OrderInput, onProgress?: (done: number, max: number) => void, maxEvals = 60): OrderResult[] {
  const n = inp.hex.length, base = inp.params.base?.color;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== base);
  const full = (rest: number[]) => (base !== undefined ? [base, ...rest] : rest);
  const seen = new Map<string, OrderResult>();
  const memo = new Map<string, { jumps: number; visibleMm: number }>();
  const tryOrder = (rest: number[]): OrderResult | null => {
    const key = rest.join(',');
    if (seen.has(key)) return seen.get(key)!;
    if (seen.size >= maxEvals) return null;
    const r = evalOrder(inp, full(rest), memo);
    seen.set(key, r);
    onProgress?.(seen.size, maxEvals);
    return r;
  };
  const starts = [others, [...others].sort((a, b) => lumaOf(inp.hex[b]) - lumaOf(inp.hex[a]))];
  for (const s of starts) {
    let cur = s, curR = tryOrder(cur);
    while (curR) {
      let best: { rest: number[]; r: OrderResult } | null = null;
      for (let a = 0; a < cur.length; a++) for (let b = a + 1; b < cur.length; b++) {
        const nx = [...cur]; [nx[a], nx[b]] = [nx[b], nx[a]];
        const r = tryOrder(nx);
        if (r && r.cost < (best?.r.cost ?? curR.cost) - 1e-9) best = { rest: nx, r };
      }
      if (!best) break;
      cur = best.rest; curR = best.r;
    }
  }
  return [...seen.values()].sort((a, b) => a.cost - b.cost);
}

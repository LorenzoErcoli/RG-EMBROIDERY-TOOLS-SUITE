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
import { isHalfStitch, rowPitch, segmentPoints, vertexIndex } from './model';
import { routeCells, type ColorRoute, type RouteMetrics, type RouteParams, type RouteResult, type RouteSeg } from './routing';
import { bandCells } from './module';
import { areaOfCell, shiftGroup } from './zones';

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
  // la base in un solo stop, su tutto il ricamo, prima delle strisce; nelle strisce niente base
  const whole = baseWholeRoute(g, cells, params);
  if (whole) { colors.push(whole.route); addMetrics(metrics, whole.metrics); params = { ...params, base: null }; cells = whole.rest; }
  stripRanges(g, opts.rows).forEach(([r0, r1], strip) => {
    const grid: GridSpec = { ...g, rows: r1 - r0 };
    const sub: Cells = new Map();
    for (let r = r0; r < r1; r++) for (let c = 0; c < g.cols; c++) { const m = cells.get(r * g.cols + c); if (m) sub.set((r - r0) * g.cols + c, m); }
    const shift = r0 * W; // i vertici della striscia sono quelli della griglia intera, r0 righe più su
    const dy = r0 * pitch;
    const p: RouteParams = {
      ...params,
      mask: params.mask ? params.mask.subarray(r0 * g.cols, r1 * g.cols) : params.mask,
      groups: params.groups?.map((q) => shiftGroup(q, 0, dy)),
      cuts: params.cuts?.map(([a, b]) => [a - shift, b - shift] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a < (grid.rows + 1) * W && b < (grid.rows + 1) * W),
      forced: params.forced?.map((q) => ({ from: q.from - shift, to: q.to - shift, via: q.via.map((v) => v - shift) })).filter((q) => [q.from, q.to, ...q.via].every((v) => v >= 0 && v < (grid.rows + 1) * W)),
    };
    const res = routeCells(grid, sub, p);
    for (const cr of res.colors) colors.push({ color: cr.color, strip, segs: cr.segs.map((s) => ({ ...s, from: s.from + shift, to: s.to + shift })) });
    const m = res.metrics;
    metrics.legs += m.legs; metrics.visibleMm += m.visibleMm; metrics.retraceMm += m.retraceMm; metrics.verticalMm += m.verticalMm;
    metrics.hiddenMm += m.hiddenMm; metrics.jumps += m.jumps; metrics.jumpMm += m.jumpMm; metrics.maxExtra = Math.max(metrics.maxExtra, m.maxExtra);
  });
  return { colors, metrics };
}

/**
 * La base in un solo stop (baseWhole, di default): il motore la cuce su tutto il ricamo, con le croci col
 * filo della base sopra di lei. Torna anche le celle senza il filo della base, per le strisce. null = no.
 */
function baseWholeRoute(g: GridSpec, cells: Cells, params: RouteParams): { route: ColorRoute; metrics: RouteMetrics; rest: Cells } | null {
  const base = params.base;
  if (!base || params.baseWhole === false) return null;
  const over: Cells = new Map(), rest: Cells = new Map();
  for (const [k, m] of cells) {
    if (m.color !== base.color) rest.set(k, m);
    else if ((m.stitch === 'cross' && base.stitch !== 'cross') || isHalfStitch(m.stitch)) over.set(k, m);
  }
  // DALL'ALTO IN BASSO (Lorenzo, 2026-10-13: «la base deve sempre lavorare da sopra a sotto»): fasce di
  // BASE_BAND_ROWS righe, a serpentina (la prima da sinistra a destra, la seconda da destra a sinistra…);
  // ogni fascia finisce sull'angolo in basso da cui parte la fascia dopo, così lo stop resta uno e continuo.
  // DOVE LA FORMA SPEZZA LE RIGHE (Lorenzo, 2026-11-25, sulla scollatura: «facciamo un'impuntura continua nei
  // punti in cui c'è la scollatura»): la base si cuce a pezzi (basePieces), una spalla tutta e poi l'altra,
  // ognuno dall'alto in basso; da un pezzo all'altro il filo va con un'impuntura dentro la forma, dove la base
  // non è ancora cucita (baseTravel): la copre la base che viene dopo. Prima passava a vista sopra il vuoto.
  const W = 2 * g.cols + 1;
  const mask = params.mask && params.mask.length === g.rows * g.cols ? params.mask : null;
  const segs: RouteSeg[] = [];
  const metrics = emptyMetrics();
  const pieces = basePieces(g, mask, params.baseBandRows ?? BASE_BAND_ROWS);
  const done = new Uint8Array(g.rows * g.cols);
  const pitch = rowPitch(g);
  const dist = (a: number, b: number) => {
    const ia = Math.floor(a / W), ib = Math.floor(b / W);
    return Math.hypot((a - ia * W - (b - ib * W)) * g.cellW / 2, (ia - ib) * pitch);
  };
  let at = -1;
  pieces.forEach((piece, p) => {
    const next = pieces[p + 1];
    // il verso della prima fascia: quello che parte più vicino a dove siamo e finisce più vicino al pezzo dopo
    const plan = (right: boolean) => {
      const start = partCorner(g, piece[0], false, right);
      const lastRight = piece.length % 2 === 1 ? !right : right;
      const end = partCorner(g, piece[piece.length - 1], true, lastRight);
      const goal = next ? partCorner(g, next[0], false, false) : -1;
      return { right, start, cost: (at >= 0 ? dist(at, start) : 0) + (goal >= 0 ? dist(end, goal) : 0) };
    };
    const a = plan(false), b = plan(true);
    const best = b.cost < a.cost - 1e-6 ? b : a;
    if (at < 0) at = best.start;
    else if (at !== best.start) {
      const travel = baseTravel(g, mask, done, at, best.start);
      if (travel) {
        for (const sg of travel) {
          const [p0, q0] = segmentPoints(g, sg.from, sg.to);
          const mm = Math.hypot(q0.x - p0.x, q0.y - p0.y);
          if (sg.kind === 'hidden') metrics.hiddenMm += mm; else metrics.visibleMm += mm;
        }
        segs.push(...travel);
        at = best.start;
      }
    }
    piece.forEach((part, k) => {
      const [r0, r1] = part.rows;
      const grid: GridSpec = { ...g, rows: r1 - r0 };
      const shift = r0 * W;
      const sub: Cells = new Map(); // le croci col filo della base vengono dopo tutta la base (sotto)
      const startRight = k % 2 === 0 ? best.right : !best.right;
      const end = partCorner(g, part, true, !startRight);
      const startLocal = at >= shift && at < shift + (grid.rows + 1) * W ? at - shift : -1;
      const res = routeCells(grid, sub, {
        ...params, strips: null, modulePath: null, areas: null, cuts: [], forced: [],
        groups: params.groups?.map((q) => shiftGroup(q, 0, r0 * pitch)),
        mask: part.mask ?? (mask ? mask.subarray(r0 * g.cols, r1 * g.cols) : null),
        startAt: startLocal >= 0 ? { [base.color]: startLocal } : undefined,
        endAt: end >= 0 ? { [base.color]: end - shift } : undefined,
      });
      for (const c of part.cells) done[c] = 1;
      const bc = res.colors.find((cr) => cr.color === base.color);
      if (!bc || !bc.segs.length) return;
      addMetrics(metrics, res.metrics);
      const moved = bc.segs.map((s) => ({ ...s, from: s.from + shift, to: s.to + shift }));
      if (segs.length && moved[0].from !== segs[segs.length - 1].to) segs.push({ kind: 'jump', from: segs[segs.length - 1].to, to: moved[0].from });
      segs.push(...moved);
      at = segs[segs.length - 1].to;
    });
  });
  // le croci col filo della base: sopra tutta la base (la riga sotto, col sormonto, le coprirebbe), nello stesso stop
  if (over.size) {
    const res = routeCells(g, over, { ...params, base: null, strips: null, modulePath: null, areas: null, cuts: [], forced: [], startAt: at >= 0 ? { [base.color]: at } : undefined });
    const bc = res.colors.find((cr) => cr.color === base.color);
    if (bc && bc.segs.length) {
      addMetrics(metrics, res.metrics);
      if (segs.length && bc.segs[0].from !== segs[segs.length - 1].to) segs.push({ kind: 'jump', from: segs[segs.length - 1].to, to: bc.segs[0].from });
      segs.push(...bc.segs);
    }
  }
  return segs.length ? { route: { color: base.color, segs }, metrics, rest } : null;
}

/**
 * Le righe di ogni fascia della base unica, cucita dall'alto in basso. Una: ogni riga di V si cuce di filato
 * (giù, su, giù…) e si scende alla riga dopo dall'angolo; misurato sull'alpino 150 × 168 V: 0 ripassi, 0 salti,
 * 0 in vista (con 4 righe per fascia 54 m di ripassi, con 2 righe 107 m).
 */
export const BASE_BAND_ROWS = 1;

/**
 * Un pezzo di una fascia della base: le sue celle (dentro la forma, unite fra loro) e, se la fascia ne ha più
 * di uno, la maschera della fascia con solo quelle (null = la maschera della fascia così com'è).
 */
interface BasePart { rows: [number, number]; cells: number[]; mask: Uint8Array | null; }

/**
 * I PEZZI DELLA BASE, nell'ordine in cui si cuciono. Ogni fascia si divide nei pezzi che la forma lascia
 * staccati (sopra la scollatura: la spalla sinistra e la destra). Un pezzo continua quello di sopra se tocca
 * solo lui e lui tocca solo questo; altrimenti comincia un pezzo nuovo, che si cuce dopo tutti quelli che
 * tocca sopra. Senza forma, o con una forma che non spezza le righe, il pezzo è uno: tutta la base.
 */
function basePieces(g: GridSpec, mask: Uint8Array | null, bandRows: number): BasePart[][] {
  const C = g.cols;
  const isIn = (i: number) => !mask || mask[i] === 1;
  const comp = new Int32Array(g.rows * C).fill(-1);
  const parts: Array<BasePart & { up: number[]; down: number[] }> = [];
  stripRanges(g, bandRows).forEach(([r0, r1], b) => {
    const first = parts.length;
    for (let r = r0; r < r1; r++) for (let c = 0; c < C; c++) {
      const i0 = r * C + c;
      if (!isIn(i0) || comp[i0] >= 0) continue;
      const id = parts.length, cells: number[] = [], stack = [i0];
      comp[i0] = id;
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        const rr = Math.floor(i / C), cc = i - rr * C;
        for (const [nr, nc] of [[rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]]) {
          if (nr < r0 || nr >= r1 || nc < 0 || nc >= C) continue;
          const j = nr * C + nc;
          if (isIn(j) && comp[j] < 0) { comp[j] = id; stack.push(j); }
        }
      }
      parts.push({ rows: [r0, r1], cells: cells.sort((x, y) => x - y), mask: null, up: [], down: [] });
    }
    if (parts.length - first > 1) for (let q = first; q < parts.length; q++) {
      const m = new Uint8Array((r1 - r0) * C);
      for (const i of parts[q].cells) m[i - r0 * C] = 1;
      parts[q].mask = m;
    }
    if (b > 0) for (let c = 0; c < C; c++) {
      const a = comp[(r0 - 1) * C + c], d = comp[r0 * C + c];
      if (a >= 0 && d >= 0 && !parts[d].up.includes(a)) { parts[d].up.push(a); parts[a].down.push(d); }
    }
  });
  const pieceOf = new Int32Array(parts.length).fill(-1);
  const pieces: Array<{ parts: number[]; deps: number[] }> = [];
  parts.forEach((pt, id) => {
    if (pt.up.length === 1 && parts[pt.up[0]].down.length === 1) { pieceOf[id] = pieceOf[pt.up[0]]; pieces[pieceOf[id]].parts.push(id); }
    else { pieceOf[id] = pieces.length; pieces.push({ parts: [id], deps: pt.up.map((u) => pieceOf[u]) }); }
  });
  // l'ordine: il pezzo più in alto fra quelli che hanno già cucito tutto quello che toccano sopra; a pari
  // altezza il più vicino a dove si è finito (all'inizio, il più a sinistra)
  const colOf = (id: number) => parts[id].cells[0] % C;
  const used = new Uint8Array(pieces.length), order: number[] = [];
  let lastCol = -Infinity;
  while (order.length < pieces.length) {
    let best = -1, bestKey: [number, number] = [Infinity, Infinity];
    pieces.forEach((pc, k) => {
      if (used[k] || pc.deps.some((d) => !used[d])) return;
      const key: [number, number] = [parts[pc.parts[0]].rows[0], Math.abs(colOf(pc.parts[0]) - lastCol)];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = k; bestKey = key; }
    });
    used[best] = 1; order.push(best);
    const last = pieces[best].parts[pieces[best].parts.length - 1];
    lastCol = parts[last].cells.reduce((s, i) => s + (i % C), 0) / parts[last].cells.length;
  }
  return order.map((k) => pieces[k].parts.map((id) => parts[id]));
}

/** Il vertice d'angolo di un pezzo: in alto (la sua prima riga) o in basso (l'ultima), a sinistra o a destra. */
function partCorner(g: GridSpec, part: BasePart, bottom: boolean, right: boolean): number {
  if (!part.cells.length) return -1;
  const C = g.cols, W = 2 * C + 1;
  const r = Math.floor((bottom ? part.cells[part.cells.length - 1] : part.cells[0]) / C);
  let c0 = Infinity, c1 = -Infinity;
  for (const i of part.cells) if (Math.floor(i / C) === r) { c0 = Math.min(c0, i % C); c1 = Math.max(c1, i % C); }
  return (bottom ? r + 1 : r) * W + 2 * (right ? c1 + 1 : c0);
}

/**
 * L'IMPUNTURA da un pezzo della base al dopo: la strada più corta sul reticolo (lati e verticali) che resta
 * dentro la forma, meglio dove la base non è ancora cucita (lì la copre dopo: 'hidden') e un po' dentro dal
 * bordo; sopra la base già cucita si può, ma costa sei volte ('visible'). Mai sopra il vuoto. null = i due
 * vertici non sono uniti dentro la forma (due pezzi staccati): lì si salta.
 */
function baseTravel(g: GridSpec, mask: Uint8Array | null, done: Uint8Array, from: number, to: number): RouteSeg[] | null {
  const C = g.cols, W = 2 * C + 1, N = (g.rows + 1) * W;
  const half = g.cellW / 2, pitch = rowPitch(g);
  const isIn = (r: number, c: number) => r >= 0 && r < g.rows && c >= 0 && c < C && (!mask || mask[r * C + c] === 1);
  const cost = (adj: Array<[number, number]>, len: number): { w: number; hidden: boolean } | null => {
    let any = false, all = true, future = false;
    for (const [r, c] of adj) {
      if (isIn(r, c)) { any = true; if (!done[r * C + c]) future = true; } else all = false;
    }
    return any ? { w: len * (future ? (all ? 1 : 1.5) : 6), hidden: future } : null;
  };
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), hid = new Uint8Array(N);
  const heap: Array<[number, number]> = [];
  const push = (d: number, v: number) => {
    heap.push([d, v]);
    for (let k = heap.length - 1; k > 0;) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]]; k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  dist[from] = 0; push(0, from);
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    if (v === to) break;
    const i = Math.floor(v / W), j = v - i * W;
    const steps: Array<[number, { w: number; hidden: boolean } | null]> = [];
    if (j + 1 < W) steps.push([v + 1, cost([[i - 1, j >> 1], [i, j >> 1]], half)]);
    if (j > 0) steps.push([v - 1, cost([[i - 1, (j - 1) >> 1], [i, (j - 1) >> 1]], half)]);
    const vert = (r: number): Array<[number, number]> => (j % 2 ? [[r, (j - 1) / 2]] : [[r, j / 2 - 1], [r, j / 2]]);
    if (i < g.rows) steps.push([v + W, cost(vert(i), pitch)]);
    if (i > 0) steps.push([v - W, cost(vert(i - 1), pitch)]);
    for (const [u, e] of steps) {
      if (!e || d + e.w >= dist[u]) continue;
      dist[u] = d + e.w; prev[u] = v; hid[u] = e.hidden ? 1 : 0; push(dist[u], u);
    }
  }
  if (!Number.isFinite(dist[to])) return null;
  const out: RouteSeg[] = [];
  for (let v = to; v !== from; v = prev[v]) out.push({ kind: hid[v] ? 'hidden' : 'visible', from: prev[v], to: v });
  return out.reverse();
}

/**
 * I BLOCCHI DI RICAMO: la base unica per prima, poi blocco per blocco (nell'ordine della lista) tutti i fili
 * dal primo all'ultimo, coi gruppi dentro, poi il resto del ricamo. Ogni cella va al primo blocco che la
 * contiene. Nel DST ogni (blocco, filo) è uno stop.
 */
export function routeAreas(g: GridSpec, cells: Cells, params: RouteParams): RouteResult {
  const colors: ColorRoute[] = [];
  const metrics = emptyMetrics();
  let p: RouteParams = { ...params, strips: null, modulePath: null, areas: null };
  let rest = cells;
  const whole = baseWholeRoute(g, cells, { ...params, baseWhole: true });
  if (whole) { colors.push(whole.route); addMetrics(metrics, whole.metrics); rest = whole.rest; p = { ...p, base: null }; }
  const areas = params.areas ?? [];
  const buckets: Cells[] = Array.from({ length: areas.length + 1 }, () => new Map());
  for (const [k, m] of rest) {
    const a = areaOfCell(g, Math.floor(k / g.cols), k % g.cols, areas);
    buckets[a < 0 ? areas.length : a].set(k, m);
  }
  buckets.forEach((sub, i) => {
    if (!sub.size) return;
    const res = routeCells(g, sub, p);
    addMetrics(metrics, res.metrics);
    for (const cr of res.colors) colors.push({ color: cr.color, strip: i, segs: cr.segs });
  });
  return { colors, metrics };
}

/** I passaggi: a strisce se richiesto, altrimenti tutto il ricamo insieme. */
export function routeAll(g: GridSpec, cells: Cells, params: RouteParams): RouteResult {
  if (params.areas && params.areas.length) return applyForced(routeAreas(g, cells, params), params.forced);
  if (params.modulePath && params.modulePath.cols <= g.cols) return routeModuleTiled(g, cells, params, params.modulePath);
  const s = params.strips;
  return applyForced(s && s.rows > 0 && s.rows < g.rows ? routeStrips(g, cells, params, s) : routeCells(g, cells, params), params.forced);
}

/**
 * I PASSAGGI A MANO SUL PERCORSO FINITO (Lorenzo, 2026-11-25: «a volte mi perde le modifiche nel ricalcolarlo più
 * tardi»): il motore li applica filo per filo, ma la base in un solo stop non li riceveva, e a strisce un passaggio
 * con un punto fuori dalla sua striscia si buttava via. Qui, per ultimi, su tutto il percorso: ogni passaggio che va
 * da `from` a `to` (o al contrario) diventa dritto da un punto all'altro; uno già così resta com'è (coi suoi tipi). I
 * tratti nuovi prendono il tipo del primo tratto di prima; i conti del filo non cambiano.
 */
export function applyForced(res: RouteResult, forced: RouteParams['forced']): RouteResult {
  if (!forced || !forced.length) return res;
  for (const cr of res.colors) {
    const segs = cr.segs, out: RouteSeg[] = [];
    let changed = false;
    for (let i = 0; i < segs.length;) {
      if (segs[i].kind === 'stitch' || segs[i].kind === 'jump') { out.push(segs[i]); i++; continue; }
      let j = i;
      while (j < segs.length && segs[j].kind !== 'stitch' && segs[j].kind !== 'jump') j++;
      const from = segs[i].from, to = segs[j - 1].to;
      const f = forced.find((q) => (q.from === from && q.to === to) || (q.from === to && q.to === from));
      const pts = f ? [from, ...(f.from === from ? f.via : [...f.via].reverse()), to] : null;
      const same = !pts || (j - i === pts.length - 1 && pts.slice(1).every((v, n) => segs[i + n].from === pts[n] && segs[i + n].to === v));
      if (same) for (let q = i; q < j; q++) out.push(segs[q]);
      else { const kind = segs[i].kind; for (let n = 1; n < pts!.length; n++) out.push({ kind, from: pts![n - 1], to: pts![n] }); changed = true; }
      i = j;
    }
    if (changed) cr.segs = out;
  }
  return res;
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
  /** Le fasce a mano: per filo, le righe dove comincia una fascia (senza: automatiche). */
  bands?: Record<number, number[]>;
  /** Le forme spostate di fascia: per filo, V del modulo → la riga della fascia con cui si cuce. */
  bandAt?: Record<number, Record<number, number>>;
  /** I fili coi pezzi messi in ordine a mano (Ordine pezzi): solo lì l'ordine dei pezzi vale nelle fasce. */
  ordered?: number[];
  /** Dove sta il modulo sul pezzo: la sua V (0, 0) è la V (dr, dc) del ricamo (Sposta pattern). */
  offset?: { dr: number; dc: number };
  /** 'x' = modulo a fascia: una striscia sola, alla riga dr; sopra e sotto solo la base (module.ts, isBand). */
  repeat?: 'xy' | 'x';
}

/** Il percorso di ogni filo sul modulo da solo (la base, se c'è, non è nel modulo: va sotto tutto). */
export function routeModule(g: GridSpec, mp: ModulePath, params: RouteParams): RouteResult {
  const mg: GridSpec = { ...g, cols: mp.cols, rows: mp.rows };
  const baseColor = params.base?.color;
  const cells: Cells = new Map();
  mp.marks.forEach((m, i) => { if (m && (m.color !== baseColor || (m.stitch === 'cross' && params.base?.stitch !== 'cross') || isHalfStitch(m.stitch))) cells.set(i, { ...m }); });
  const startAt: Record<number, number> = {}, endAt: Record<number, number> = {};
  for (const [c, row] of Object.entries(mp.entryRow)) {
    const rr = Math.max(0, Math.min(mp.rows - 1, row));
    startAt[Number(c)] = vertexIndex(mg, rr, 0);
    endAt[Number(c)] = vertexIndex(mg, rr, 2 * mp.cols);
  }
  return routeCells(mg, cells, { ...params, base: null, strips: null, modulePath: null, groups: [], mask: null, cuts: mp.cuts ?? [], forced: mp.forced ?? [], pieceOf: mp.pieceOf, startAt, endAt });
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

// ------------------------------------------------------------
// LE FASCE (Lorenzo, 2026-10-02: «dello stop di questo colore prima fai la parte alta del modulo di
// tutti i moduli consecutivi, poi passiamo al blocco sotto… e questo mi permette di lavorare a fasce
// orizzontali»; «a serpentina»; «per ogni fascia del colore di ogni modulo uscita e ingresso vicini…
// dove non è possibile facciamo i salti»; i salti senza taglio: il disegno si stacca e riparte).
//
// Ogni filo si cuce fascia per fascia dall'alto: la prima da sinistra a destra lungo tutte le copie
// della striscia, la seconda da destra a sinistra, e così via. Il percorso di una fascia si calcola UNA
// volta e si ripete in ogni copia.
//
// INIZIO E FINE (Lorenzo, 2026-10-02: «per ogni fascia l'ingresso coincida con l'uscita del precedente
// e quindi ingresso uscita ai lati rispettivi stessa altezza»). Una fascia che passa da una copia
// all'altra (al più BAND_JOIN_V V di vuoto attraverso la giuntura) entra da un bordo del modulo ed esce
// dall'altro alla stessa riga, quella dove il disegno è più vicino a tutti e due i bordi: l'uscita di una
// copia è l'ingresso della copia accanto. Una fascia di motivi isolati comincia dalla V più a sinistra
// (più a destra al ritorno), finisce sull'ultima forma e salta alla copia accanto: un salto corto. Anche
// fra una fascia e la successiva si salta.
//
// DENTRO LA FASCIA, PER FORME (Lorenzo, 2026-10-02: «non capita… che faccio una parte di rombo poi vado
// sotto poi torno sopra: ogni blocco con punti vicini deve essere concluso e poi si passa al prossimo»;
// «decide il tool dentro le fasce»). Le forme della fascia (le V che si toccano, anche in diagonale) si
// cuciono una alla volta, intere, nel verso della fascia: prima quella dell'ingresso, ultima quella
// dell'uscita, in mezzo per posizione. Dentro una forma l'ordine lo sceglie il motore. Gli spicchi
// verticali di prima tagliavano le forme (47 ritorni su e giù per modulo). L'ordine dei pezzi vale solo
// per i fili messi in ordine a mano.
// ------------------------------------------------------------

/** Il vuoto massimo (in V) attraverso la giuntura perché il filo passi da una copia all'altra. */
export const BAND_JOIN_V = 4;

/** Un vertice rispetto al modulo: riga e colonna del reticolo (la colonna può uscire dal modulo). */
export type ModVertex = [number, number];

/** Il percorso di una fascia, in vertici rispetto al modulo, entrando dal lato `dir` (1 = sinistra). */
export interface BandRoute {
  rows: [number, number];
  /** Le V del modulo nella fascia. */
  cells: number[];
  dir: 1 | -1;
  /** I punti della fascia, dall'ingresso all'ultima V. */
  body: Array<{ kind: RouteSeg['kind']; from: ModVertex; to: ModVertex; trim?: boolean }>;
  /** Il passaggio dall'ultima V all'uscita (vuoto se fra le copie si salta). */
  tail: Array<{ kind: RouteSeg['kind']; from: ModVertex; to: ModVertex; trim?: boolean }>;
  /** Vero = entra da un bordo ed esce dall'altro alla stessa riga: le copie si concatenano. */
  joined: boolean;
  start: ModVertex;
  /** Unita: l'uscita (sul bordo); a salti: l'ultima V. */
  end: ModVertex;
  /** Dove comincia la copia accanto (nel verso della fascia). */
  next: ModVertex;
  metrics: RouteMetrics;
}

/** Il vuoto fra due vertici, in V: in larghezza (due colonne del reticolo per V) o in righe, il maggiore. */
const gapV = (a: ModVertex, b: ModVertex) => Math.max(Math.abs(a[1] - b[1]) / 2, Math.abs(a[0] - b[0]));

/** Le forme di un insieme di V del modulo: gruppi di V che si toccano, anche in diagonale. */
function shapesOf(cells: number[], C: number): number[][] {
  const set = new Set(cells), seen = new Set<number>(), out: number[][] = [];
  for (const c0 of cells) {
    if (seen.has(c0)) continue;
    const shape: number[] = [], stack = [c0];
    seen.add(c0);
    while (stack.length) {
      const q = stack.pop()!;
      shape.push(q);
      const qr = Math.floor(q / C), qc = q % C;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nc = qc + dc, j = (qr + dr) * C + nc;
        if (nc >= 0 && nc < C && set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    out.push(shape);
  }
  return out;
}

/** Le fasce di un filo, già calcolate, a serpentina (la prima da sinistra). */
export function routeBands(g: GridSpec, mp0: ModulePath, color: number, params: RouteParams): BandRoute[] {
  const C = mp0.cols;
  // LE SCELTE SENZA I PASSAGGI A MANO (Lorenzo, 2026-11-26, nel modulo: «cambio un passaggio, poi passo a quelli
  // successivi, succede che nel ricalcolo mi cambia quelli precedenti»): verso, divisione, ingressi e uscite si
  // scelgono contando filo in vista e ripassi; contando anche i passaggi ridisegnati a mano, uno che aggiunge filo in
  // vista faceva scegliere un'altra strada, in cui quel passaggio non c'era più (tornava automatico, e con lui gli
  // altri). Ora si sceglie come se non ci fossero, e solo le strade scelte si rifanno coi passaggi a mano.
  const mp: ModulePath = mp0.forced && mp0.forced.length ? { ...mp0, forced: undefined } : mp0;
  // ANDATA E RITORNO (Lorenzo, 2026-10-13: «quando il modulo si ripete non sfrutta il fatto che le varie
  // fasce sono consecutive: ne finisce una, magari tornando anche indietro nel modulo, poi ripassa sopra
  // tutto e va avanti»): una fascia che continua fra le copie si può cucire in due passate lungo tutta la
  // striscia, divisa per righe: le righe sopra all'andata, quelle sotto al ritorno (o viceversa). Si tiene
  // la divisione solo se costa meno (ripassi, filo in vista, salti) e se tutte e due le passate continuano
  // fra le copie (almeno una; l'altra può andare a salti, e il salto si paga nel conto). I versi si alternano
  // per passata: la serpentina resta giusta.
  const out: BandRoute[] = [];
  let dir: 1 | -1 = 1;
  const score = (b: BandRoute) => b.metrics.retraceMm + 5 * b.metrics.visibleMm + 0.2 * b.metrics.verticalMm + 30 * b.metrics.jumps + (b.joined ? 0 : 60);
  for (const band of bandCells(mp, color)) {
    let best: BandRoute[] = [routeBand(g, mp, color, params, band, dir)];
    // il verso opposto, se costa chiaramente meno (il motore non è simmetrico: una fascia può avere filo in
    // vista in un verso e niente nell'altro); fra una fascia e l'altra si salta comunque
    const alt = routeBand(g, mp, color, params, band, dir > 0 ? -1 : 1);
    if (score(alt) + 15 + 0.05 * g.cols * g.cellW < score(best[0])) { best = [alt]; dir = alt.dir; }
    const single = score(best[0]);
    if (best[0].joined && best[0].metrics.retraceMm > 2 * g.cellW && !mp.ordered?.includes(color)) {
      for (let split = band.rows[0] + 1; split <= band.rows[1]; split++) {
        const top = band.cells.filter((i) => Math.floor(i / C) < split), bottom = band.cells.filter((i) => Math.floor(i / C) >= split);
        if (!top.length || !bottom.length) continue;
        for (const [a, b] of [[top, bottom], [bottom, top]]) {
          const rowsOf = (cs: number[]): [number, number] => [Math.min(...cs.map((i) => Math.floor(i / C))), Math.max(...cs.map((i) => Math.floor(i / C)))];
          const p1 = routeBand(g, mp, color, params, { rows: rowsOf(a), cells: a }, dir);
          const p2 = routeBand(g, mp, color, params, { rows: rowsOf(b), cells: b }, dir > 0 ? -1 : 1);
          if (!p1.joined && !p2.joined) continue;
          const s = score(p1) + score(p2);
          if (s < 0.7 * single && s < (best.length > 1 ? score(best[0]) + score(best[1]) : Infinity)) best = [p1, p2];
        }
      }
    }
    // le strade scelte si rifanno coi passaggi a mano e, se chiesto, coi salti accorciati (solo loro: farlo su ogni
    // strada provata costava tre volte il tempo)
    out.push(...(mp === mp0 && !params.shortJumps ? best : best.map((b) => bandRedo.get(b)!(mp0, !!params.shortJumps))));
    dir = best[best.length - 1].dir > 0 ? -1 : 1;
  }
  return out;
}

/** Come rifare una strada di fascia già scelta con un altro modulo (lo stesso, coi passaggi a mano). */
const bandRedo = new WeakMap<BandRoute, (mp: ModulePath, shorten: boolean) => BandRoute>();

/** Il percorso di una fascia (o di una sua passata) nel verso `dir`. */
function routeBand(g: GridSpec, mp: ModulePath, color: number, params: RouteParams, band: { rows: [number, number]; cells: number[] }, dir: 1 | -1): BandRoute {
  const a = routeBandAt(g, mp, color, params, band, dir, true);
  if (a.joined) return a;
  // UNITA LO STESSO (Lorenzo, 2026-11-26: «valutare anche dove proprio non è possibile fare i salti»): un motivo
  // staccato dal bordo saltava sempre alla copia accanto; ora che il filo passa sotto i fili che vengono dopo, se la
  // strada fino alla copia accanto non aggiunge filo in vista né salti, si tiene unito (il salto fra le copie sparisce)
  const iso = routeBandIsolated(g, mp, color, params, band, dir);
  const joinedAnyway = routeBandAt(g, mp, color, params, band, dir, true, undefined, undefined, true);
  return joinedAnyway.metrics.visibleMm <= iso.metrics.visibleMm + 1e-6 && joinedAnyway.metrics.jumps <= iso.metrics.jumps ? joinedAnyway : iso;
}

/** Un elemento isolato: si salta alla copia accanto. */
function routeBandIsolated(g: GridSpec, mp: ModulePath, color: number, params: RouteParams, band: { rows: [number, number]; cells: number[] }, dir: 1 | -1): BandRoute {
  // UN ELEMENTO ISOLATO: si provano alcuni ingressi sul lato da cui si arriva e alcune uscite sul lato verso la
  // copia dopo (in cima, in fondo, a metà; e l'uscita libera, come prima) e si tiene la coppia che costa meno
  // fra ripassi, filo in vista e metà del salto alla copia accanto (che entra dallo stesso ingresso)
  const C = mp.cols;
  const hi = Math.max(...band.cells.map((i) => i % C)), lo = Math.min(...band.cells.map((i) => i % C));
  const pickRows = (cs: number[]) => { const rs = [...new Set(cs.map((i) => Math.floor(i / C)))].sort((x, y) => x - y); return [...new Set([rs[0], rs[rs.length - 1], rs[rs.length >> 1]])]; };
  const sideV = (left: boolean): ModVertex[] => {
    const cs = band.cells.filter((i) => (left ? i % C <= lo + 1 : i % C >= hi - 1));
    return pickRows(cs).map((r) => { const row = cs.filter((i) => Math.floor(i / C) === r).map((i) => i % C); const c = left ? Math.min(...row) : Math.max(...row); return [r, left ? 2 * c : 2 * c + 2] as ModVertex; });
  };
  const entries = sideV(dir > 0), exits = sideV(dir < 0);
  const mmOf = (p: ModVertex, q: ModVertex) => Math.hypot(((q[1] - p[1]) / 2) * g.cellW, (q[0] - p[0]) * rowPitch(g));
  const cost = (b: BandRoute) => b.metrics.retraceMm + 5 * b.metrics.visibleMm + 0.5 * mmOf(b.end, b.next);
  let best = routeBandAt(g, mp, color, params, band, dir, false), bc = cost(best);
  for (const e of entries) for (const q of [null, ...exits]) {
    const r = routeBandAt(g, mp, color, params, band, dir, q !== null, q ?? undefined, e);
    const c = cost(r);
    if (c < bc - 0.5) { best = r; bc = c; }
  }
  return best;
}

function routeBandAt(g: GridSpec, mp: ModulePath, color: number, params: RouteParams, band: { rows: [number, number]; cells: number[] }, dir: 1 | -1, sideExit: boolean, exitAt?: ModVertex, entryAt?: ModVertex, joinAnyway = false): BandRoute {
  const r = routeBandAtOnce(g, mp, color, params, band, dir, sideExit, exitAt, entryAt, joinAnyway);
  bandRedo.set(r, (mp2, shorten) => routeBandAtOnce(g, mp2, color, params, band, dir, sideExit, exitAt, entryAt, joinAnyway, shorten));
  return r;
}
function routeBandAtOnce(g: GridSpec, mp: ModulePath, color: number, params: RouteParams, band: { rows: [number, number]; cells: number[] }, dir: 1 | -1, sideExit: boolean, exitAt?: ModVertex, entryAt?: ModVertex, joinAnyway = false, shorten = false): BandRoute {
  const C = mp.cols, R = mp.rows, Wm = 2 * C + 1, W2 = 4 * C + 1;
  const g2: GridSpec = { ...g, cols: 2 * C, rows: R };
  {
    // la fascia sta nella copia di sinistra (andata) o di destra (ritorno) di un modulo doppio
    const offC = dir > 0 ? 0 : C, off = 2 * offC;
    const cells: Cells = new Map();
    for (const i of band.cells) cells.set(Math.floor(i / C) * 2 * C + (i % C) + offC, { ...mp.marks[i]! });
    // le V dei fili cuciti dopo (i fili vanno in ordine d'ago, la base prima di tutti), nelle due copie: il filo ci
    // passa sotto, nascosto (Lorenzo, 2026-11-26: «vorrei che il bianco passasse sotto il rosso e sotto il marrone»)
    const cover: Cells = new Map();
    mp.marks.forEach((mk, i) => {
      if (!mk || mk.color <= color || mk.color === params.base?.color) return;
      const rr = Math.floor(i / C), c = i % C;
      for (const o of [0, C]) cover.set(rr * 2 * C + c + o, { ...mk });
    });
    // e le V di questa fascia nella copia accanto, che si cuce subito dopo: il passaggio d'uscita ci passa sotto
    for (const i of band.cells) cover.set(Math.floor(i / C) * 2 * C + (i % C) + (offC === 0 ? C : 0), { ...mp.marks[i]! });
    // il vuoto attraverso la giuntura, riga per riga e in tutto
    const rowLo = new Map<number, number>(), rowHi = new Map<number, number>();
    let lo = C, hi = -1;
    for (const i of band.cells) {
      const rr = Math.floor(i / C), c = i % C;
      rowLo.set(rr, Math.min(rowLo.get(rr) ?? C, c)); rowHi.set(rr, Math.max(rowHi.get(rr) ?? -1, c));
      lo = Math.min(lo, c); hi = Math.max(hi, c);
    }
    const joined = C - 1 - hi + lo <= BAND_JOIN_V || joinAnyway;
    let start: ModVertex;
    let exitIso: ModVertex | null = null;
    if (joined) {
      // DALL'ALTO (Lorenzo, 2026-11-26: «l'ingresso deve sempre essere dall'alto»): si entra e si esce alla riga più
      // in alto del motivo che sta sul bordo (prima colonna o ultima: per la copia accanto sono lo stesso motivo), e
      // il motivo si cuce scendendo. Prima: la riga dove il disegno è più vicino ai due bordi, spesso a metà del
      // motivo, col passaggio d'ingresso in vista. Senza V sui bordi, come prima.
      const edgeRows = band.cells.filter((i) => i % C === 0 || i % C === C - 1).map((i) => Math.floor(i / C));
      const row = edgeRows.length ? Math.min(...edgeRows)
        : [...rowLo].map(([rr, l]) => [rr, C - 1 - rowHi.get(rr)! + l] as [number, number]).sort((q, w) => q[1] - w[1] || q[0] - w[0])[0][0];
      start = [row, dir > 0 ? 0 : 2 * C];
    } else {
      // GLI ELEMENTI ISOLATI (Lorenzo, 2026-10-13: «quando gli elementi sono isolati non partono e finiscono
      // nei lati esterni o comunque più vicini agli oggetti precedenti e successivi»): si entra dal lato da
      // cui si arriva (a sinistra all'andata) e si esce dal lato opposto, alle due quote più vicine fra loro:
      // l'uscita di una copia e l'ingresso della copia accanto sono così il salto più corto
      const rc = band.cells.map((i) => [Math.floor(i / C), i % C] as [number, number]);
      const L = rc.filter((q) => q[1] <= lo + 1), Rt = rc.filter((q) => q[1] >= hi - 1);
      let bl = L[0], br = Rt[0], bc = Infinity;
      for (const l of L) for (const r of Rt) { const c = Math.abs(l[0] - r[0]) + 0.5 * (l[1] - lo + hi - r[1]) + 0.01 * (l[0] + r[0]); if (c < bc) { bc = c; bl = l; br = r; } }
      const leftV: ModVertex = [bl[0], 2 * bl[1]], rightV: ModVertex = [br[0], 2 * br[1] + 2];
      start = entryAt ?? (dir > 0 ? leftV : rightV);
      exitIso = exitAt ?? (dir > 0 ? rightV : leftV);
      if (!sideExit && !entryAt) {
        // come prima: la V più a sinistra (più a destra al ritorno); a parità di colonna, la più in alto
        const pick = rc.reduce((q, w) => ((dir > 0 ? w[1] < q[1] : w[1] > q[1]) || (w[1] === q[1] && w[0] < q[0]) ? w : q));
        start = dir > 0 ? [pick[0], 2 * pick[1]] : [pick[0], 2 * pick[1] + 2];
      }
    }
    const next: ModVertex = [start[0], start[1] + dir * 2 * C];
    const v2 = (q: ModVertex) => q[0] * W2 + q[1] + off;
    const back = (v: number): ModVertex => { const i = Math.floor(v / W2); return [i, v - i * W2 - off]; };
    const fromMod = (v: number) => { const i = Math.floor(v / Wm); return i * W2 + (v - i * Wm) + off; };
    // l'ordine: i pezzi messi in ordine a mano; altrimenti per forme, ognuna intera
    const pieceOf = new Array(R * 2 * C).fill(0);
    const at2 = (i: number) => Math.floor(i / C) * 2 * C + (i % C) + offC;
    if (mp.pieceOf && mp.ordered?.includes(color)) for (const i of band.cells) pieceOf[at2(i)] = mp.pieceOf[i] ?? 0;
    else {
      const shapes = shapesOf(band.cells, C);
      // quanto una forma è vicina a un vertice del modulo (in V)
      const near = (sh: number[], q: ModVertex) => Math.min(...sh.map((i) => gapV([Math.floor(i / C), 2 * (i % C) + 1], q)));
      const exit: ModVertex = joined ? [start[0], dir > 0 ? 2 * C : 0] : sideExit ? exitIso! : start;
      const first = shapes.reduce((q, w) => (near(w, start) < near(q, start) ? w : q));
      const lastSh = (joined || sideExit) && shapes.length > 1 ? shapes.filter((sh) => sh !== first).reduce<number[] | null>((q, w) => (!q || near(w, exit) < near(q, exit) ? w : q), null) : null;
      const pos = (sh: number[]) => dir * sh.reduce((a2, i) => a2 + (i % C), 0) / sh.length;
      const middle = shapes.filter((sh) => sh !== first && sh !== lastSh).sort((q, w) => pos(q) - pos(w));
      [first, ...middle, ...(lastSh ? [lastSh] : [])].forEach((sh, k) => { for (const i of sh) pieceOf[at2(i)] = k + 1; });
    }
    const bandParams: RouteParams = {
      ...params, base: null, strips: null, modulePath: null, groups: [], mask: null, cover,
      cuts: (mp.cuts ?? []).map(([x, y]) => [fromMod(x), fromMod(y)] as [number, number]),
      forced: (mp.forced ?? []).map((q) => ({ from: fromMod(q.from), to: fromMod(q.to), via: q.via.map(fromMod) })),
      pieceOf, startAt: { [color]: v2(start) }, ...(joined || sideExit ? { endAt: { [color]: v2(joined ? next : exitIso!) } } : {}),
    };
    const res0 = routeCells(g2, cells, bandParams);
    const res = shorten ? shortenJumps(g2, cells, cover, bandParams, color, res0) : res0;
    const segs = res.colors.find((cr) => cr.color === color)?.segs ?? [];
    let last = segs.length - 1;
    while (last >= 0 && segs[last].kind !== 'stitch') last--;
    const toMod = (sg: RouteSeg) => ({ ...sg, from: back(sg.from), to: back(sg.to) });
    const body = segs.slice(0, last + 1).map(toMod);
    const tail = joined || sideExit ? segs.slice(last + 1).map(toMod) : [];
    const end: ModVertex = joined ? next : tail.length ? tail[tail.length - 1].to : body.length ? body[body.length - 1].to : start;
    return { rows: band.rows, cells: band.cells, dir, body, tail, joined, start, end, next, metrics: res.metrics };
  }
}

/**
 * Il percorso del modulo a fasce per l'editor: per ogni fascia i suoi punti e il collegamento alla copia
 * accanto (passaggio, o salto). I vertici sono di una griglia larga tre moduli col modulo al centro.
 */
export function routeModuleBands(g: GridSpec, mp: ModulePath, params: RouteParams): RouteResult & { bands: Map<number, BandRoute[]> } {
  const baseColor = params.base?.color;
  const colors: ColorRoute[] = [];
  const metrics = emptyMetrics();
  const bands = new Map<number, BandRoute[]>();
  const W3 = 6 * mp.cols + 1;
  const v3 = (q: ModVertex) => q[0] * W3 + q[1] + 2 * mp.cols;
  const used = [...new Set(mp.marks.filter((m) => m && m.color !== baseColor).map((m) => m!.color))].sort((x, y) => x - y);
  for (const color of used) {
    const br = routeBands(g, mp, color, params);
    bands.set(color, br);
    for (const band of br) {
      const segs: RouteSeg[] = [...band.body, ...band.tail].map((sg) => ({ ...sg, from: v3(sg.from), to: v3(sg.to) }));
      if (!band.joined) { segs.push({ kind: 'jump', from: v3(band.end), to: v3(band.next) }); metrics.jumps++; }
      addMetrics(metrics, band.metrics);
      if (segs.length) colors.push({ color, segs });
    }
  }
  return { colors, metrics, bands };
}

const emptyMetrics = (): RouteMetrics => ({ legs: 0, visibleMm: 0, retraceMm: 0, verticalMm: 0, hiddenMm: 0, jumps: 0, jumpMm: 0, maxExtra: 0 });
function addMetrics(to: RouteMetrics, m: RouteMetrics, times = 1): void {
  to.legs += m.legs * times; to.visibleMm += m.visibleMm * times; to.retraceMm += m.retraceMm * times;
  to.verticalMm += m.verticalMm * times; to.hiddenMm += m.hiddenMm * times; to.jumps += m.jumps * times; to.jumpMm += m.jumpMm * times;
  to.maxExtra = Math.max(to.maxExtra, m.maxExtra);
}
/** Accoda un pezzo di percorso: se non comincia dove finisce il precedente, un salto (senza taglio). */
function join(g: GridSpec, segs: RouteSeg[], piece: RouteSeg[], metrics: RouteMetrics): void {
  if (!piece.length) return;
  const last = segs[segs.length - 1];
  if (last && last.to !== piece[0].from) {
    const [p, q] = segmentPoints(g, last.to, piece[0].from);
    segs.push({ kind: 'jump', from: last.to, to: piece[0].from });
    metrics.jumps++; metrics.jumpMm += Math.hypot(q.x - p.x, q.y - p.y);
  }
  for (const sg of piece) segs.push(sg);
}
/** Toglie il passaggio prima del primo punto o dopo l'ultimo se copre più di `maxV` V: lì si salta. */
function trimLongTravel(g: GridSpec, segs: RouteSeg[], maxV: number): RouteSeg[] {
  let first = 0; while (first < segs.length && segs[first].kind !== 'stitch') first++;
  let last = segs.length - 1; while (last >= 0 && segs[last].kind !== 'stitch') last--;
  if (last < 0) return [];
  const W = 2 * g.cols + 1;
  const far = (a: number, b: number) => gapV([Math.floor(a / W), a % W], [Math.floor(b / W), b % W]) > maxV;
  const a = first > 0 && far(segs[0].from, segs[first].from) ? first : 0;
  const b = last < segs.length - 1 && far(segs[last].to, segs[segs.length - 1].to) ? last + 1 : segs.length;
  return segs.slice(a, b);
}

/** Il ricamo = il modulo ripetuto: per ogni striscia la base, poi ogni filo a fasce, a serpentina. */
export function routeModuleTiled(g: GridSpec, cells: Cells, params: RouteParams, mp: ModulePath): RouteResult {
  const W = 2 * g.cols + 1, C = mp.cols, Rm = mp.rows;
  const colors: ColorRoute[] = [];
  const metrics = emptyMetrics();
  const baseC = params.base?.color;
  const order = [...new Set([...(baseC !== undefined ? [baseC] : []), ...[...cells.values()].map((m) => m.color)])]
    .sort((a, b) => (a === baseC ? -1 : b === baseC ? 1 : a - b));
  // le fasce di ogni filo, una volta sola
  const bandsBy = new Map<number, BandRoute[]>();
  for (const color of order) if (color !== baseC) bandsBy.set(color, routeBands(g, mp, color, params));
  // SPOSTA PATTERN (Lorenzo, 2026-10-07: «spostare dx/sx alto/basso il pattern composto dei moduli per fare
  // i centraggi»): il modulo comincia alla V (dr, dc) del ricamo; prima di lì, a sinistra e in alto, ci sono
  // copie e una striscia tagliate. Strisce e copie partono da lì, un modulo alla volta.
  // IL MODULO A FASCIA (Lorenzo, 2026-11-24): una striscia sola, dove sta la fascia (anche tagliata dal bordo);
  // la base, sopra e sotto, è intera e in un solo stop («una base più grande che viene ricamata intera»).
  const band = mp.repeat === 'x';
  const dr = band ? Math.round(mp.offset?.dr ?? 0) : ((Math.round(mp.offset?.dr ?? 0) % Rm) + Rm) % Rm, dc = ((Math.round(mp.offset?.dc ?? 0) % C) + C) % C;
  const colOrigins: number[] = [];
  for (let oc = dc > 0 ? dc - C : 0; oc < g.cols; oc += C) colOrigins.push(oc);
  const rowOrigins: number[] = [];
  if (band) { if (dr < g.rows && dr + Rm > 0) rowOrigins.push(dr); }
  else for (let or = dr > 0 ? dr - Rm : 0; or < g.rows; or += Rm) rowOrigins.push(or);
  const mask = params.mask && params.mask.length === g.rows * g.cols ? params.mask : null;
  // la base in un solo stop, su tutto il ricamo, prima delle strisce
  const whole = baseWholeRoute(g, cells, band ? { ...params, baseWhole: true } : params);
  if (whole) { colors.push(whole.route); addMetrics(metrics, whole.metrics); }
  rowOrigins.forEach((o, strip) => {
    const s0 = Math.max(0, o), s1 = Math.min(g.rows, o + Rm);
    const grid: GridSpec = { ...g, rows: s1 - s0 };
    const shift = s0 * W, dy = s0 * rowPitch(g);
    const stripParams: RouteParams = { ...params, strips: null, modulePath: null, groups: params.groups?.map((q) => shiftGroup(q, 0, dy)), cuts: [], mask: mask ? mask.subarray(s0 * g.cols, s1 * g.cols) : null };
    const toGlobal = (segs: RouteSeg[]) => segs.map((sg) => ({ ...sg, from: sg.from + shift, to: sg.to + shift }));
    // la base: il motore, sulla striscia intera, coi punti col filo della base sopra la base (le croci)
    if (baseC !== undefined && !whole) {
      const over: Cells = new Map();
      for (let rr = s0; rr < s1; rr++) for (let c = 0; c < g.cols; c++) {
        const m = cells.get(rr * g.cols + c);
        if (m && m.color === baseC && ((m.stitch === 'cross' && params.base!.stitch !== 'cross') || isHalfStitch(m.stitch)) && (!mask || mask[rr * g.cols + c])) over.set((rr - s0) * g.cols + c, m);
      }
      const res = routeCells(grid, over, stripParams);
      addMetrics(metrics, res.metrics);
      const bc = res.colors.find((cr) => cr.color === baseC);
      if (bc) colors.push({ color: baseC, strip, segs: toGlobal(bc.segs) });
    }
    // LE COPIE TAGLIATE DAL BORDO (Lorenzo, 2026-10-02: «se cambio le misure a partire da un modulo i
    // passaggi si rovinano nel finale e cambiano, quando in realtà dovrebbero rimanere uguali»): le copie
    // tagliate (dal bordo, dalla forma, o spostando il pattern) usano lo stesso percorso del modulo,
    // tagliato: si cuce quello che sta dentro, nello stesso ordine e coi passaggi a mano del modulo. Dove il
    // percorso usciva e rientrava, il filo salta.
    const fullRows = o >= 0 && o + Rm <= g.rows;
    const cut = (k: number) => !!mask || !fullRows || colOrigins[k] < 0 || colOrigins[k] + C > g.cols;
    // un vertice rispetto al modulo, nella copia k della striscia (riga e colonna del reticolo del ricamo)
    const gi = (q: ModVertex) => o + q[0];
    const gj = (q: ModVertex, k: number) => q[1] + 2 * colOrigins[k];
    const at = (q: ModVertex, k: number) => gi(q) * W + gj(q, k);
    const inside = (q: ModVertex, k: number) => gi(q) >= s0 && gi(q) <= s1 && gj(q, k) >= 0 && gj(q, k) <= 2 * g.cols;
    // con la forma: un tratto resta se la cella che attraversa (o una delle due che costeggia) è dentro
    const cellIn = (r: number, c: number) => r >= s0 && r < s1 && c >= 0 && c < g.cols && mask![r * g.cols + c] === 1;
    const segIn = (p: ModVertex, q: ModVertex, k: number) => {
      if (!mask) return true;
      const ja = gj(p, k), jb = gj(q, k), i = Math.min(gi(p), gi(q));
      if (ja === jb) return ja % 2 ? cellIn(i, (ja - 1) / 2) : cellIn(i, ja / 2 - 1) || cellIn(i, ja / 2);
      const c = Math.floor(Math.min(ja, jb) / 2);
      if (p[0] === q[0]) return cellIn(gi(p) - 1, c) || cellIn(gi(p), c);
      return cellIn(i, c);
    };
    for (const color of order) {
      if (color === baseC) continue;
      const segs: RouteSeg[] = [];
      for (const band of bandsBy.get(color) ?? []) {
        const total = band.body.filter((sg) => sg.kind === 'stitch').length;
        const copy = (k: number, withTail: boolean) => {
          const src = [...band.body, ...(withTail ? band.tail : [])];
          if (!cut(k)) { addMetrics(metrics, band.metrics); return [src.map((sg) => ({ ...sg, from: at(sg.from, k), to: at(sg.to, k) }))]; }
          // tagliata: i tratti che restano dentro, ognuno con almeno un punto
          const runs: RouteSeg[][] = [];
          let cur: RouteSeg[] = [], kept = 0;
          for (const sg of src) {
            if (inside(sg.from, k) && inside(sg.to, k) && segIn(sg.from, sg.to, k)) { cur.push({ ...sg, from: at(sg.from, k), to: at(sg.to, k) }); if (sg.kind === 'stitch') kept++; }
            else if (cur.length) { runs.push(cur); cur = []; }
          }
          if (cur.length) runs.push(cur);
          if (total) addMetrics(metrics, band.metrics, kept / total);
          return runs.filter((run) => run.some((sg) => sg.kind === 'stitch'));
        };
        const ks = colOrigins.map((_, k) => k);
        if (band.dir < 0) ks.reverse();
        ks.forEach((k, n) => { for (const run of copy(k, n < ks.length - 1)) join(g, segs, run, metrics); });
      }
      if (segs.length) colors.push({ color, strip, segs });
    }
  });
  // i salti contati sul percorso finito (le copie tagliate ne hanno una parte)
  metrics.jumps = 0; metrics.jumpMm = 0;
  for (const cr of colors) for (const sg of cr.segs) if (sg.kind === 'jump') { const [p0, q0] = segmentPoints(g, sg.from, sg.to); metrics.jumps++; metrics.jumpMm += Math.hypot(q0.x - p0.x, q0.y - p0.y); }
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
        out.push({ kind: 'jump', from: cr.segs[i].from, to: cr.segs[j - 1].to, trim: true }); // a mano: col taglio
      } else for (let q = i; q < j; q++) out.push(cr.segs[q]);
      i = j;
    }
    cr.segs = out;
  }
  return res;
}

/**
 * I SALTI PIÙ CORTI (Lorenzo, 2026-11-26: «come poter accorciare i salti facendo lavorare i vari blocchi in maniera che
 * le uscite e le entrate dei successivi siano vicine… magari facendo dei passaggi lineari prima e poi iniziando a
 * ricamare le V dal punto più conveniente»). Coi passaggi mai in vista il filo lavora a blocchi (le V che raggiunge
 * nascosto) e salta dall'uno all'altro; il blocco finiva dove capitava. Qui ogni blocco si rifà: si entra nel punto più
 * vicino a dove è finito quello prima, si cuce, e alla fine un passaggio nascosto (sotto le V ancora da cucire, o in
 * ripasso sulle sue) porta al punto più vicino al blocco dopo: di lì il salto è corto. Si tiene solo se i salti si
 * accorciano, non aumentano e non compare niente in vista. Sul suo modulo: 777 → 580 mm di salti, ripassi +14%.
 * I salti a mano (Salti) restano dentro il loro blocco.
 */
function shortenJumps(g: GridSpec, cells: Cells, cover: Cells, params: RouteParams, color: number, res: RouteResult): RouteResult {
  const cr = res.colors.find((c) => c.color === color);
  if (!cr) return res;
  const W = 2 * g.cols + 1;
  const blocks: RouteSeg[][] = [];
  let cur: RouteSeg[] = [];
  for (const sg of cr.segs) { if (sg.kind === 'jump' && !sg.trim) { if (cur.some((x) => x.kind === 'stitch')) blocks.push(cur); cur = []; } else cur.push(sg); }
  if (cur.some((x) => x.kind === 'stitch')) blocks.push(cur);
  if (blocks.length < 2) return res;
  const cellOf = (sg: RouteSeg) => { const i1 = Math.floor(sg.from / W), i2 = Math.floor(sg.to / W), j1 = sg.from % W, j2 = sg.to % W; return Math.min(i1, i2) * g.cols + Math.floor(Math.min(j1, j2) / 2); };
  const bCells = blocks.map((b) => { const m: Cells = new Map(); for (const sg of b) if (sg.kind === 'stitch') { const k = cellOf(sg); const mk = cells.get(k); if (mk) m.set(k, mk); } return m; });
  const verts = blocks.map((b) => [...new Set(b.filter((x) => x.kind === 'stitch').flatMap((x) => [x.from, x.to]))]);
  const P = (v: number) => { const i = Math.floor(v / W), j = v - i * W; return { x: j * g.cellW / 2, y: i * rowPitch(g) }; };
  const dist = (a: number, b: number) => { const p = P(a), q = P(b); return Math.hypot(p.x - q.x, p.y - q.y); };
  const closest = (from: number[], to: number[]) => { let best = from[0], bd = Infinity; for (const a of from) for (const b of to) { const d = dist(a, b); if (d < bd) { bd = d; best = a; } } return best; };
  const startAt = params.startAt?.[color], endAt = params.endAt?.[color];
  const out: RouteSeg[] = [];
  const metrics = { legs: 0, hiddenMm: 0, verticalMm: 0, retraceMm: 0, visibleMm: 0, jumps: 0, jumpMm: 0, maxExtra: 0 };
  let prevExit = -1;
  for (let b = 0; b < blocks.length; b++) {
    const entry = b === 0 && startAt !== undefined ? startAt : closest(verts[b], [prevExit]);
    const exit = b + 1 < blocks.length ? closest(verts[b], verts[b + 1]) : endAt;
    // coprono: i fili dopo, e le V degli altri blocchi di questo filo
    const cov: Cells = new Map(cover);
    bCells.forEach((m, o) => { if (o !== b) for (const [k, v] of m) cov.set(k, v); });
    const r = routeCells(g, bCells[b], { ...params, cover: cov, startAt: { [color]: entry }, ...(exit !== undefined ? { endAt: { [color]: exit } } : { endAt: undefined }) });
    const sg = r.colors.find((c) => c.color === color)?.segs ?? [];
    if (b > 0) { out.push({ kind: 'jump', from: prevExit, to: sg.length ? sg[0].from : entry }); metrics.jumps++; metrics.jumpMm += dist(prevExit, sg.length ? sg[0].from : entry); }
    out.push(...sg);
    metrics.legs += r.metrics.legs; metrics.hiddenMm += r.metrics.hiddenMm; metrics.verticalMm += r.metrics.verticalMm; metrics.retraceMm += r.metrics.retraceMm; metrics.visibleMm += r.metrics.visibleMm; metrics.jumps += r.metrics.jumps; metrics.jumpMm += r.metrics.jumpMm;
    prevExit = sg.length ? sg[sg.length - 1].to : entry;
  }
  const old = res.metrics;
  if (metrics.jumps > old.jumps || metrics.jumpMm >= old.jumpMm - 1e-6 || metrics.visibleMm > old.visibleMm + 1e-6) return res;
  return { colors: res.colors.map((c) => (c.color === color ? { ...c, segs: out } : c)), metrics };
}

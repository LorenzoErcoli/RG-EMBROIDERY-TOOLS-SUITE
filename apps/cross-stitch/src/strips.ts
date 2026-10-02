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
import { bandCells } from './module';

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
  /** Le fasce a mano: per filo, le righe dove comincia una fascia (senza: automatiche). */
  bands?: Record<number, number[]>;
  /** Le forme spostate di fascia: per filo, V del modulo → fasce più giù (+) o più su (−). */
  bandMove?: Record<number, Record<number, number>>;
  /** I fili coi pezzi messi in ordine a mano (Ordine pezzi): solo lì l'ordine dei pezzi vale nelle fasce. */
  ordered?: number[];
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
// INIZIO E FINE (Lorenzo, 2026-10-02: «essendo a fasce il punto iniziale e finale è diverso… dovrebbero
// sempre iniziare il più a sinistra possibile e finire il più a destra possibile, per permettere di
// avere una continuità. E così se metto i salti il salto è lineare e vicino»; «decide il tool dentro le
// fasce»). La fascia comincia dalla V più a sinistra (più a destra al ritorno) e si calcola su un
// modulo largo due copie, dovendo arrivare all'inizio della copia accanto: così finisce il più vicino
// possibile a lì, a qualunque altezza. Se il vuoto fino alla copia accanto è al più BAND_JOIN_V V il
// filo ci arriva con un passaggio corto e non si stacca; altrimenti salta, dall'ultima V alla prima
// della copia accanto: un salto corto. Anche fra una fascia e la successiva si salta. Dentro la fascia
// l'ordine lo decide il motore, a spicchi verticali di BAND_SLICE_V V nel verso della fascia (da solo
// non tendeva verso la copia accanto); l'ordine dei pezzi vale solo per i fili messi in ordine a mano.
// ------------------------------------------------------------

/** Il vuoto massimo (in V) fra una copia e l'altra perché il filo ci passi invece di saltare. */
export const BAND_JOIN_V = 4;
/**
 * La larghezza degli spicchi (in V) in cui si cuce una fascia, nel suo verso. Sul modulo di Lorenzo: con
 * 4 V tutte le fasce continue restano unite fra le copie (295 salti nel ricamo); con 2 il filo in vista
 * sale (65 m contro 59), con 6 o più le fasce grandi tornano a finire lontano (360 salti).
 */
export const BAND_SLICE_V = 4;

/** Un vertice rispetto al modulo: riga e colonna del reticolo (la colonna può uscire dal modulo). */
export type ModVertex = [number, number];

/** Il percorso di una fascia, in vertici rispetto al modulo, entrando dal lato `dir` (1 = sinistra). */
export interface BandRoute {
  rows: [number, number];
  /** Le V del modulo nella fascia. */
  cells: number[];
  dir: 1 | -1;
  /** I punti della fascia, dalla prima all'ultima V. */
  body: Array<{ kind: RouteSeg['kind']; from: ModVertex; to: ModVertex }>;
  /** Il passaggio corto fino all'inizio della copia accanto (vuoto se lì si salta). */
  tail: Array<{ kind: RouteSeg['kind']; from: ModVertex; to: ModVertex }>;
  /** Vero = fra una copia e l'altra il filo passa (tail), falso = salta. */
  joined: boolean;
  start: ModVertex;
  end: ModVertex;
  /** Dove comincia la copia accanto (nel verso della fascia). */
  next: ModVertex;
  metrics: RouteMetrics;
}

/** Il vuoto fra due vertici, in V: in larghezza (due colonne del reticolo per V) o in righe, il maggiore. */
const gapV = (a: ModVertex, b: ModVertex) => Math.max(Math.abs(a[1] - b[1]) / 2, Math.abs(a[0] - b[0]));

/** Le fasce di un filo, già calcolate, a serpentina (la prima da sinistra). */
export function routeBands(g: GridSpec, mp: ModulePath, color: number, params: RouteParams): BandRoute[] {
  const C = mp.cols, R = mp.rows, Wm = 2 * C + 1, W2 = 4 * C + 1;
  const g2: GridSpec = { ...g, cols: 2 * C, rows: R };
  return bandCells(mp, color).map((band, bi) => {
    const dir: 1 | -1 = bi % 2 === 0 ? 1 : -1;
    // la fascia sta nella copia di sinistra (andata) o di destra (ritorno) del modulo doppio
    const offC = dir > 0 ? 0 : C, off = 2 * offC;
    const cells: Cells = new Map();
    for (const i of band.cells) cells.set(Math.floor(i / C) * 2 * C + (i % C) + offC, { ...mp.marks[i]! });
    // la V più a destra e la più a sinistra; a parità di colonna, alla stessa altezza dell'altra (salto dritto)
    const rc = band.cells.map((i) => [Math.floor(i / C), i % C] as [number, number]);
    const right = rc.reduce((q, w) => (w[1] > q[1] || (w[1] === q[1] && w[0] < q[0]) ? w : q));
    const left = rc.filter((q) => q[1] === Math.min(...rc.map((w) => w[1]))).sort((q, w) => Math.abs(q[0] - right[0]) - Math.abs(w[0] - right[0]) || q[0] - w[0])[0];
    // l'inizio: il vertice esterno della prima V; la copia accanto comincia allo stesso punto, una copia più in là
    const start: ModVertex = dir > 0 ? [left[0], 2 * left[1]] : [right[0], 2 * right[1] + 2];
    const next: ModVertex = [start[0], start[1] + dir * 2 * C];
    const v2 = (q: ModVertex) => q[0] * W2 + q[1] + off;
    const back = (v: number): ModVertex => { const i = Math.floor(v / W2); return [i, v - i * W2 - off]; };
    const fromMod = (v: number) => { const i = Math.floor(v / Wm); return i * W2 + (v - i * Wm) + off; };
    // l'ordine: i pezzi messi in ordine a mano; altrimenti a spicchi verticali nel verso della fascia
    // (il motore da solo non tende verso la copia accanto: finiva dove capitava, anche a sinistra)
    const pieceOf = new Array(R * 2 * C).fill(0);
    const manual = !!mp.pieceOf && !!mp.ordered?.includes(color);
    for (const i of band.cells) {
      const c = i % C;
      pieceOf[Math.floor(i / C) * 2 * C + c + offC] = manual ? (mp.pieceOf![i] ?? 0) : 1 + Math.floor((dir > 0 ? c : C - 1 - c) / BAND_SLICE_V);
    }
    const res = routeCells(g2, cells, {
      ...params, base: null, strips: null, modulePath: null, groups: [],
      cuts: (mp.cuts ?? []).map(([x, y]) => [fromMod(x), fromMod(y)] as [number, number]),
      forced: (mp.forced ?? []).map((q) => ({ from: fromMod(q.from), to: fromMod(q.to), via: q.via.map(fromMod) })),
      pieceOf, startAt: { [color]: v2(start) }, endAt: { [color]: v2(next) },
    });
    const segs = res.colors.find((cr) => cr.color === color)?.segs ?? [];
    let last = segs.length - 1;
    while (last >= 0 && segs[last].kind !== 'stitch') last--;
    const toMod = (sg: RouteSeg) => ({ kind: sg.kind, from: back(sg.from), to: back(sg.to) });
    const body = segs.slice(0, last + 1).map(toMod);
    const end: ModVertex = body.length ? body[body.length - 1].to : start;
    const joined = gapV(end, next) <= BAND_JOIN_V;
    return { rows: band.rows, cells: band.cells, dir, body, tail: joined ? segs.slice(last + 1).map(toMod) : [], joined, start, end, next, metrics: res.metrics };
  });
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
      const segs: RouteSeg[] = [...band.body, ...band.tail].map((sg) => ({ kind: sg.kind, from: v3(sg.from), to: v3(sg.to) }));
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
  const W = 2 * g.cols + 1;
  const colors: ColorRoute[] = [];
  const metrics = emptyMetrics();
  const fullX = Math.floor(g.cols / mp.cols);
  const baseC = params.base?.color;
  const order = [...new Set([...(baseC !== undefined ? [baseC] : []), ...[...cells.values()].map((m) => m.color)])]
    .sort((a, b) => (a === baseC ? -1 : b === baseC ? 1 : a - b));
  // le fasce di ogni filo, una volta sola
  const bandsBy = new Map<number, BandRoute[]>();
  for (const color of order) if (color !== baseC) bandsBy.set(color, routeBands(g, mp, color, params));
  stripRanges(g, mp.rows).forEach(([r0, r1], strip) => {
    const full = r1 - r0 === mp.rows;
    const grid: GridSpec = { ...g, rows: r1 - r0 };
    const shift = r0 * W, dy = r0 * rowPitch(g);
    const stripParams: RouteParams = { ...params, strips: null, modulePath: null, groups: params.groups?.map((q) => ({ ...q, y: q.y - dy })), cuts: [] };
    const sub = (c0: number, only?: Set<number>): Cells => {
      const out: Cells = new Map();
      for (let rr = r0; rr < r1; rr++) for (let c = c0; c < g.cols; c++) {
        const m = cells.get(rr * g.cols + c);
        if (m && (!only || only.has((rr - r0) * mp.cols + (c % mp.cols)))) out.set((rr - r0) * g.cols + c, m);
      }
      return out;
    };
    const toGlobal = (segs: RouteSeg[]) => segs.map((sg) => ({ kind: sg.kind, from: sg.from + shift, to: sg.to + shift }));
    // una striscia tagliata dal fondo del ricamo (o senza copie intere): il motore, tutta insieme
    if (!full || fullX === 0) {
      const res = routeCells(grid, sub(0), stripParams);
      addMetrics(metrics, res.metrics);
      for (const cr of res.colors) colors.push({ color: cr.color, strip, segs: toGlobal(cr.segs) });
      return;
    }
    // la base: il motore, sulla striscia intera
    if (baseC !== undefined) {
      const res = routeCells(grid, new Map(), stripParams);
      addMetrics(metrics, res.metrics);
      const b = res.colors.find((cr) => cr.color === baseC);
      if (b) colors.push({ color: baseC, strip, segs: toGlobal(b.segs) });
    }
    const c0 = fullX * mp.cols;
    // un vertice rispetto al modulo, nella copia k della striscia
    const at = (q: ModVertex, k: number) => (r0 + q[0]) * W + q[1] + 2 * mp.cols * k;
    for (const color of order) {
      if (color === baseC) continue;
      const segs: RouteSeg[] = [];
      for (const band of bandsBy.get(color) ?? []) {
        const copy = (k: number, withTail: boolean) => [...band.body, ...(withTail ? band.tail : [])].map((sg) => ({ kind: sg.kind, from: at(sg.from, k), to: at(sg.to, k) }));
        // le copie tagliate dal bordo destro: il motore, attaccato alla copia intera vicina (se è vicina)
        const restCells = sub(c0, new Set(band.cells));
        const restRoute = (ends: Partial<RouteParams>) => {
          const res = routeCells(grid, restCells, { ...stripParams, base: null, ...ends });
          addMetrics(metrics, res.metrics);
          return trimLongTravel(g, toGlobal(res.colors.find((cr) => cr.color === color)?.segs ?? []), BAND_JOIN_V);
        };
        if (band.dir > 0) {
          for (let k = 0; k < fullX; k++) join(g, segs, copy(k, k < fullX - 1), metrics);
          if (restCells.size) join(g, segs, restRoute({ startAt: { [color]: segs[segs.length - 1].to - shift } }), metrics);
        } else {
          if (restCells.size) join(g, segs, restRoute({ endAt: { [color]: at(band.start, fullX - 1) - shift } }), metrics);
          for (let k = fullX - 1; k >= 0; k--) join(g, segs, copy(k, k > 0), metrics);
        }
        addMetrics(metrics, band.metrics, fullX);
      }
      if (segs.length) colors.push({ color, strip, segs });
    }
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

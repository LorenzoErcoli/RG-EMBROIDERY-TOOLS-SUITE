// I PASSAGGI del Cross-Stitch: in che ordine si cuciono le diagonali, e da dove passa il filo fra
// una e l'altra.
//
// Nella vecchia app questo era un mucchio di eccezioni — connettori verticali, a L, di contatto,
// coperti, di ripasso — ognuna con un premio o una penalità scritti a mano (-14, -18, +25…), e
// ogni nuovo caso ne aggiungeva un'altra. Qui c'è UNA regola, quella della suite (R16-R18): **il
// filo di passaggio deve finire sotto il ricamo**. Il resto è una mappa di costo sul reticolo.
//
// Il reticolo. Il filo si muove fra gli angoli delle celle, e da un angolo può andare lungo i
// quattro bordi o lungo le quattro diagonali. Quanto costa un tratto dipende da cosa c'è lì:
//
//   - una diagonale che verrà cucita DOPO (dello stesso colore o di un colore successivo):
//     il passaggio ci finisce sotto e sparisce → quasi gratis (`hidden`);
//   - una diagonale dello stesso colore GIÀ cucita: ci si ripassa sopra, si vede poco ma il
//     punto si ingrossa → poco (`retrace`);
//   - un bordo di cella: nessun punto lo copre mai, si vede → il prezzo pieno (`border`);
//   - una diagonale in una cella dove non c'è quella gamba: un filo storto nel vuoto → di più;
//   - una diagonale di un colore PRECEDENTE, già cucita: un filo di un altro colore sopra → il
//     massimo.
//
// L'ordine. Da dove si trova l'ago, si cerca (Dijkstra sul reticolo) la diagonale ancora da fare
// che costa meno raggiungere; si cuce; si riparte da dove è finita. Se niente è raggiungibile
// sotto la soglia del salto, si salta (taglio) alla più vicina. È un'avida — ma con la mappa di
// costo giusta i passaggi "buoni" (sotto il ricamo) sono gratis, e l'avida li trova da sola.
// Fra due scelte che costano uguale si prende quella che lascia meno strade aperte all'uscita
// (regola di Warnsdorff): così non restano diagonali isolate da andare a prendere alla fine.
//
// La croce: la gamba sopra si fa solo dopo quella sotto della stessa cella (model.legsOf).
// Le ripetizioni: ogni passata è un'unità a sé, e l'ordine le sceglie come le altre.
//
// Nessun DOM.

import type { Cells, GridSpec, Leg } from './model';
import { legEnds, legsOf, segmentPoints, vertexCount } from './model';

export interface TravelCosts {
  /** Sotto una diagonale che verrà cucita dopo. */
  hidden: number;
  /** Sopra una diagonale dello stesso colore già cucita. */
  retrace: number;
  /** Lungo un bordo di cella. */
  border: number;
  /** Lungo una diagonale dove quella gamba non c'è. */
  open: number;
  /** Sopra una diagonale di un colore precedente. */
  over: number;
}

/** Costi per mm di filo. `border` = 1: la soglia del salto si legge quindi in "mm di passaggio in vista". */
export const DEFAULT_COSTS: TravelCosts = { hidden: 0.05, retrace: 0.4, border: 1, open: 1.6, over: 3 };

export interface RouteParams {
  /** Passate su ogni diagonale (avanti e indietro). */
  repetitions: number;
  /** Vero = ogni diagonale si cuce solo nel suo verso (\ dall'alto, / dal basso), come nella vecchia app. */
  fixedDirection: boolean;
  /** La gamba che sta sopra nella croce. */
  topLeg: Leg;
  /** Oltre questo costo di passaggio (≈ mm in vista) si salta: taglio e ripartenza. */
  jumpMm: number;
  costs?: Partial<TravelCosts>;
}

export const DEFAULT_ROUTE: RouteParams = { repetitions: 1, fixedDirection: false, topLeg: 'down', jumpMm: 12 };

/** Un tratto del percorso fra due vertici del reticolo. */
export type SegKind = 'stitch' | 'hidden' | 'retrace' | 'visible' | 'jump';
export interface RouteSeg { kind: SegKind; from: number; to: number; }

export interface ColorRoute { color: number; segs: RouteSeg[]; }

export interface RouteMetrics {
  /** Diagonali (gambe) da cucire. */
  legs: number;
  /** mm di passaggio per tipo. */
  hiddenMm: number;
  retraceMm: number;
  visibleMm: number;
  /** Salti (tagli): fra due colori non si conta, lì il taglio c'è comunque. */
  jumps: number;
  jumpMm: number;
}

export interface RouteResult { colors: ColorRoute[]; metrics: RouteMetrics; }

interface LegState {
  color: number;
  a: number;
  b: number;
  /** Passate ancora da fare su questa gamba. */
  remaining: number;
  /** La gamba che va finita prima (la gamba sotto della croce), o -1. */
  prereq: number;
}

/** Una passata su una gamba: è l'unità che l'ordine sceglie. */
interface Unit {
  leg: number;
  /** Con la direzione fissa: l'unico capo da cui si può entrare. -1 = tutti e due. */
  fixedEntry: number;
  done: boolean;
}

// ------------------------------------------------------------
// Heap minimo (costo, vertice) — il Dijkstra lo usa migliaia di volte, meglio senza oggetti.
// ------------------------------------------------------------
class MinHeap {
  private d: number[] = [];
  private v: number[] = [];
  get size(): number { return this.d.length; }
  clear(): void { this.d.length = 0; this.v.length = 0; }
  push(d: number, v: number): void {
    const { d: D, v: V } = this;
    let i = D.length;
    D.push(d); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (D[p] <= d) break;
      D[i] = D[p]; V[i] = V[p]; i = p;
    }
    D[i] = d; V[i] = v;
  }
  /** Toglie il minimo; restituisce il vertice, il costo va letto prima con `peekD`. */
  peekD(): number { return this.d[0]; }
  pop(): number {
    const { d: D, v: V } = this;
    const top = V[0];
    const lastD = D.pop()!, lastV = V.pop()!;
    const n = D.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, md = lastD;
        if (l < n && D[l] < md) { m = l; md = D[l]; }
        if (r < n && D[r] < md) { m = r; md = D[r]; }
        if (m === i) break;
        D[i] = D[m]; V[i] = V[m]; i = m;
      }
      D[i] = lastD; V[i] = lastV;
    }
    return top;
  }
}

/**
 * Calcola i passaggi di tutte le celle, colore per colore nell'ordine della tavolozza (= ordine
 * degli aghi). `colorOrder` permette un ordine diverso; i colori senza celle si saltano.
 */
export function routeCells(g: GridSpec, cells: Cells, params: RouteParams, colorOrder?: number[]): RouteResult {
  const costs: TravelCosts = { ...DEFAULT_COSTS, ...(params.costs ?? {}) };
  const reps = Math.max(1, Math.round(params.repetitions));
  const W = g.cols + 1;
  const diagLen = Math.hypot(g.cellW, g.cellH);

  // --- le gambe, e per ogni gamba le sue passate ---
  // Le passate sono unità SEPARATE: non vanno fatte una dopo l'altra. Con 2 passate una riga di V
  // si cuce all'andata e si ripassa al ritorno, invece di andare avanti e indietro su ogni
  // diagonale e poi dover ripassare per spostarsi.
  const legs: LegState[] = [];
  const units: Unit[] = [];
  /** cella*2 + (0 = down, 1 = up) → indice della gamba. */
  const legAt = new Map<number, number>();
  const keys = [...cells.keys()].sort((x, y) => x - y);
  for (const k of keys) {
    const m = cells.get(k)!;
    const r = Math.floor(k / g.cols), c = k - r * g.cols;
    let prev = -1;
    for (const leg of legsOf(m.stitch, params.topLeg)) {
      const { a, b } = legEnds(g, r, c, leg);
      const id = legs.length;
      legs.push({ color: m.color, a, b, remaining: reps, prereq: prev });
      legAt.set(k * 2 + (leg === 'down' ? 0 : 1), id);
      // Direzione fissa: le passate vanno avanti e indietro (a→b, b→a, …) come nella vecchia app.
      for (let p = 0; p < reps; p++) units.push({ leg: id, fixedEntry: params.fixedDirection ? (p % 2 === 0 ? a : b) : -1, done: false });
      prev = id;
    }
  }

  const present = [...new Set(legs.map((l) => l.color))];
  const order = (colorOrder ?? [...present].sort((x, y) => x - y)).filter((c) => present.includes(c));
  const rank = new Map<number, number>(order.map((c, i) => [c, i]));

  const metrics: RouteMetrics = { legs: legs.length, hiddenMm: 0, retraceMm: 0, visibleMm: 0, jumps: 0, jumpMm: 0 };
  const colors: ColorRoute[] = [];

  // --- stato del Dijkstra, riusato ---
  const V = vertexCount(g);
  const dist = new Float64Array(V).fill(Infinity);
  const prevV = new Int32Array(V).fill(-1);
  const touched: number[] = [];
  const heap = new MinHeap();

  /** Il costo per mm e la classe di un tratto lungo la diagonale `bit` della cella (r,c), per il colore `k`. */
  const diagClass = (r: number, c: number, bit: 0 | 1, k: number): { w: number; kind: SegKind } => {
    const id = legAt.get((r * g.cols + c) * 2 + bit);
    if (id === undefined) return { w: costs.open, kind: 'visible' };
    const leg = legs[id];
    if (leg.color === k) return leg.remaining > 0 ? { w: costs.hidden, kind: 'hidden' } : { w: costs.retrace, kind: 'retrace' };
    return (rank.get(leg.color) ?? 0) > (rank.get(k) ?? 0)
      ? { w: costs.hidden, kind: 'hidden' }
      : { w: costs.over, kind: 'visible' };
  };

  /** I vicini di `v` nel reticolo, col costo del tratto. */
  const forEachNeighbour = (v: number, k: number, fn: (w: number, cost: number) => void): void => {
    const i = Math.floor(v / W), j = v - i * W;
    // bordi
    if (j > 0) fn(v - 1, g.cellW * costs.border);
    if (j < g.cols) fn(v + 1, g.cellW * costs.border);
    if (i > 0) fn(v - W, g.cellH * costs.border);
    if (i < g.rows) fn(v + W, g.cellH * costs.border);
    // diagonali: la cella attraversata e la sua gamba
    if (i < g.rows && j < g.cols) fn(v + W + 1, diagLen * diagClass(i, j, 0, k).w);          // ↘ cella (i,j) «\»
    if (i > 0 && j > 0) fn(v - W - 1, diagLen * diagClass(i - 1, j - 1, 0, k).w);             // ↖ cella (i-1,j-1) «\»
    if (i < g.rows && j > 0) fn(v + W - 1, diagLen * diagClass(i, j - 1, 1, k).w);            // ↙ cella (i,j-1) «/»
    if (i > 0 && j < g.cols) fn(v - W + 1, diagLen * diagClass(i - 1, j, 1, k).w);            // ↗ cella (i-1,j) «/»
  };

  /** La classe di un singolo tratto fra due vertici adiacenti (per il disegno e le misure). */
  const edgeKind = (v: number, w: number, k: number): { kind: SegKind; mm: number } => {
    const i1 = Math.floor(v / W), j1 = v - i1 * W, i2 = Math.floor(w / W), j2 = w - i2 * W;
    if (i1 === i2) return { kind: 'visible', mm: g.cellW };
    if (j1 === j2) return { kind: 'visible', mm: g.cellH };
    const r = Math.min(i1, i2), c = Math.min(j1, j2);
    const bit: 0 | 1 = (i2 - i1) === (j2 - j1) ? 0 : 1;
    return { kind: diagClass(r, c, bit, k).kind, mm: diagLen };
  };

  const pt = (v: number) => { const i = Math.floor(v / W); return { x: (v - i * W) * g.cellW, y: i * g.cellH }; };
  const available = (id: number) => {
    const u = units[id];
    if (u.done) return false;
    const pre = legs[u.leg].prereq;
    return pre < 0 || legs[pre].remaining === 0;
  };
  const entriesOf = (id: number) => {
    const u = units[id];
    return u.fixedEntry >= 0 ? [u.fixedEntry] : [legs[u.leg].a, legs[u.leg].b];
  };
  const exitOf = (id: number, entry: number) => {
    const l = legs[units[id].leg];
    return entry === l.a ? l.b : l.a;
  };
  const topLeft = (id: number) => Math.min(legs[units[id].leg].a, legs[units[id].leg].b);

  let at = -1; // vertice dove si trova l'ago (-1 = non ancora partito)

  for (const k of order) {
    const mine: number[] = [];
    /** vertice → passate di questo colore che lo toccano. */
    const byVertex = new Map<number, number[]>();
    units.forEach((u, id) => {
      const l = legs[u.leg];
      if (l.color !== k) return;
      mine.push(id);
      for (const v of [l.a, l.b]) {
        const list = byVertex.get(v);
        if (list) list.push(id); else byVertex.set(v, [id]);
      }
    });
    let left = mine.length;
    const segs: RouteSeg[] = [];

    /** Quante passate si possono prendere gratis all'uscita dopo aver preso `id` (Warnsdorff). */
    const onward = (id: number, exit: number) => {
      const leg = units[id].leg;
      let n = 0;
      for (const o of byVertex.get(exit) ?? []) {
        if (o === id || units[o].done) continue;
        const pre = legs[units[o].leg].prereq;
        // la gamba sopra si libera se questa è l'ultima passata della gamba sotto
        if (pre >= 0 && legs[pre].remaining > (pre === leg ? 1 : 0)) continue;
        if (entriesOf(o).includes(exit)) n++;
      }
      return n;
    };

    const take = (id: number, entry: number) => {
      const exit = exitOf(id, entry);
      segs.push({ kind: 'stitch', from: entry, to: exit });
      units[id].done = true;
      legs[units[id].leg].remaining--;
      left--;
      at = exit;
    };

    // Da dove parte il filo. Il primo: dalla diagonale più in alto a sinistra. Gli altri: dopo il
    // cambio colore la macchina si sposta a vuoto, quindi dal capo libero più vicino a dove ha
    // finito il filo di prima — non con un passaggio cucito che ci arriva (era il difetto visto
    // in anteprima: 10 mm di filo rosso in vista solo per raggiungere il suo inizio).
    // E in tutti e due i casi da un capo DISPARI, se c'è (Eulero): un vertice dove si incontrano
    // due diagonali è il mezzo di un percorso, e partendo da lì una metà resta da riprendere
    // con un salto. Visto in anteprima sulla riga di Λ rossa, che partiva dal centro.
    if (left > 0) {
      const degree = new Map<number, number>();
      for (const id of mine) if (available(id)) for (const e of entriesOf(id)) degree.set(e, (degree.get(e) ?? 0) + 1);
      const ends = [...degree].filter(([, n]) => n % 2 === 1).map(([v]) => v);
      const pool = ends.length ? ends : [...degree.keys()];
      const here = at >= 0 ? pt(at) : { x: 0, y: 0 };
      let bestD = Infinity, bestV = -1;
      for (const v of pool) {
        const p = pt(v), d = Math.hypot(p.x - here.x, p.y - here.y);
        if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && v < bestV)) { bestD = d; bestV = v; }
      }
      at = bestV;
    }

    while (left > 0) {
      // --- Dijkstra dal vertice dell'ago, fermo alla soglia del salto ---
      for (const t of touched) { dist[t] = Infinity; prevV[t] = -1; }
      touched.length = 0;
      heap.clear();
      dist[at] = 0; touched.push(at); heap.push(0, at);
      let bestD = Infinity;
      const cands: Array<{ id: number; entry: number; d: number }> = [];
      const limit = params.jumpMm;
      while (heap.size) {
        const d = heap.peekD();
        const v = heap.pop();
        if (d > dist[v]) continue;
        if (d > bestD + 1e-6 || d > limit) break;
        for (const id of byVertex.get(v) ?? []) {
          if (!available(id) || !entriesOf(id).includes(v)) continue;
          cands.push({ id, entry: v, d });
          if (d < bestD) bestD = d;
        }
        forEachNeighbour(v, k, (w, cost) => {
          const nd = d + cost;
          if (nd < dist[w] && nd <= limit) {
            if (dist[w] === Infinity) touched.push(w);
            dist[w] = nd; prevV[w] = v; heap.push(nd, w);
          }
        });
      }

      if (cands.length) {
        // A parità di costo, in quest'ordine:
        //  1. non chiudersi in un vicolo (all'uscita resta qualcosa da prendere gratis);
        //  2. prima le gambe con più passate da fare: con 2 passate si va avanti sulle prime e si
        //     torna sulle seconde, invece di tornare subito indietro a finire la gamba di prima;
        //  3. meno strade aperte all'uscita (Warnsdorff): così non restano gambe isolate;
        //  4. la più in alto a sinistra, per avere un ordine stabile.
        let pick = cands[0];
        let pickKey: number[] = [Infinity];
        for (const cnd of cands) {
          if (cnd.d > bestD + 1e-6) continue;
          const on = onward(cnd.id, exitOf(cnd.id, cnd.entry));
          const key = [on === 0 ? 1 : 0, -legs[units[cnd.id].leg].remaining, on, topLeft(cnd.id), cnd.entry];
          let better = false;
          for (let q = 0; q < key.length; q++) {
            if (key[q] !== pickKey[q]) { better = key[q] < (pickKey[q] ?? Infinity); break; }
          }
          if (better) { pick = cnd; pickKey = key; }
        }
        // il passaggio, tratto per tratto (ricostruito all'indietro)
        const path: number[] = [];
        for (let v = pick.entry; v !== at && v >= 0; v = prevV[v]) path.push(v);
        path.reverse();
        let from = at;
        for (const v of path) {
          const { kind, mm } = edgeKind(from, v, k);
          segs.push({ kind, from, to: v });
          if (kind === 'hidden') metrics.hiddenMm += mm;
          else if (kind === 'retrace') metrics.retraceMm += mm;
          else metrics.visibleMm += mm;
          from = v;
        }
        take(pick.id, pick.entry);
        continue;
      }

      // --- niente sotto soglia: salto alla passata disponibile più vicina ---
      const here = pt(at);
      let best: { id: number; entry: number; d: number } | null = null;
      for (const id of mine) {
        if (!available(id)) continue;
        for (const e of entriesOf(id)) {
          const p = pt(e);
          const d = Math.hypot(p.x - here.x, p.y - here.y);
          if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && e < best.entry)) best = { id, entry: e, d };
        }
      }
      if (!best) break; // non succede: la gamba sotto di una croce ha sempre lo stesso colore
      if (segs.length) { metrics.jumps++; metrics.jumpMm += best.d; }
      segs.push({ kind: 'jump', from: at, to: best.entry });
      take(best.id, best.entry);
    }

    // il primo tratto di un colore che parte con un salto non è un salto: è il cambio colore
    if (segs.length && segs[0].kind === 'jump') segs.shift();
    colors.push({ color: k, segs });
  }

  return { colors, metrics };
}

// ------------------------------------------------------------
// Dal percorso ai punti in mm
// ------------------------------------------------------------

export interface StitchParams {
  /** Il punto più lungo che la macchina fa: le diagonali più lunghe si spezzano in punti uguali. */
  maxStitchMm: number;
  /** Il punto dei passaggi (corsa sotto il ricamo). */
  travelStitchMm: number;
}

export const DEFAULT_STITCH: StitchParams = { maxStitchMm: 7, travelStitchMm: 2.5 };

function subdivide(out: { x: number; y: number }[], a: { x: number; y: number }, b: { x: number; y: number }, step: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / step - 1e-9));
  for (let s = 1; s <= n; s++) out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
}

/**
 * Le polilinee cucite di un colore: una per tratto continuo (un salto la interrompe). Le
 * diagonali sono spezzate al punto massimo, i passaggi al punto dei passaggi.
 */
export function colorPolylines(g: GridSpec, route: ColorRoute, sp: StitchParams): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const s of route.segs) {
    if (s.kind === 'jump') {
      if (cur.length > 1) out.push(cur);
      cur = [];
      continue;
    }
    const [a, b] = segmentPoints(g, s.from, s.to);
    // col sormonto un tratto può partire un filo più in là di dove è finito il precedente
    const last = cur[cur.length - 1];
    if (!last || Math.hypot(last.x - a.x, last.y - a.y) > 1e-9) cur.push(a);
    subdivide(cur, a, b, s.kind === 'stitch' ? sp.maxStitchMm : sp.travelStitchMm);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

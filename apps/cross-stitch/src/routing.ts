// I PASSAGGI del Cross-Stitch: in che ordine si cuciono le diagonali, e da dove passa il filo fra
// una e l'altra.
//
// Nella vecchia app questo era un mucchio di eccezioni — connettori verticali, a L, di contatto,
// coperti, di ripasso — ognuna con un premio o una penalità scritti a mano (-14, -18, +25…), e
// ogni nuovo caso ne aggiungeva un'altra. Qui c'è UNA regola, quella della suite (R16-R18): **il
// filo di passaggio deve finire sotto il ricamo**. Il resto è una mappa di costo sul reticolo.
//
// Il reticolo. Il filo si muove fra gli angoli delle celle e le metà dei loro lati (la punta della
// V: un punto per colonna, model.ts), in orizzontale, in verticale, lungo le diagonali di mezza
// cella (le gambe della V) e lungo le gambe di cella intera (croce, diagonale). Quanto costa un
// tratto dipende da cosa c'è lì:
//
//   - una diagonale che verrà cucita DOPO (dello stesso colore o di un colore successivo):
//     il passaggio ci finisce sotto e sparisce → quasi gratis (`hidden`);
//   - una diagonale dello stesso colore GIÀ cucita: ci si ripassa sopra, si vede poco ma il
//     punto si ingrossa → poco (`retrace`);
//   - in VERTICALE, da vertice a vertice (la punta di una V e quella sotto, o angolo e angolo):
//     il passaggio che Lorenzo ha scelto al posto di quelli orizzontali (`vertical`); se passa
//     dentro una V di un colore già cucito si vede, e costa come un filo sopra un altro colore;
//   - in ORIZZONTALE, sul bordo della cella: da evitare, solo se non c'è altra strada (`border`);
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
// La croce: la gamba sopra si fa solo dopo quella sotto della stessa cella (model.stitchLegs).
// Le ripetizioni: ogni passata è un'unità a sé, e l'ordine le sceglie come le altre.
//
// Nessun DOM.

import type { Cells, GridSpec, Leg, Stitch } from './model';
import { latticeWidth, segmentPoints, stitchLegs, vertexCount, vertexIndex } from './model';
import { zonesOf, type ZoneOptions } from './zones';

export interface TravelCosts {
  /** Sotto una diagonale che verrà cucita dopo. */
  hidden: number;
  /** Sopra una diagonale dello stesso colore già cucita. */
  retrace: number;
  /** In orizzontale, lungo il bordo della cella: da evitare. */
  border: number;
  /** In verticale, da vertice a vertice, al centro della cella: dalla punta di una V alla punta della V sotto. */
  vertical: number;
  /**
   * In verticale sul LATO della cella, da angolo ad angolo: resta fuori dal punto e si vede. Più
   * caro della strada dai vertici (Lorenzo, 2026-09-24: «mi aspetterei che i passaggi siano nei
   * vertici, a costo di avere metà della V con un passaggio in più perché deve tornare indietro»):
   * ripassare mezza V fino alla punta, scendere al centro e risalire costa meno di questo.
   */
  verticalSide: number;
  /** Lungo una diagonale dove quella gamba non c'è. */
  open: number;
  /** Sopra una diagonale di un colore precedente. */
  over: number;
  /**
   * Moltiplicatore per ogni passaggio IN PIÙ sulla stessa diagonale (sopra o sotto che sia): una
   * volta in più non si nota, due e tre ingrossano il punto e si vedono.
   */
  extra: number;
}

/**
 * Costi per mm di filo. `border` = 1: la soglia del salto si legge quindi in "mm di passaggio in vista".
 *
 * Il ripasso è quasi gratis (0,1) da quando Lorenzo l'ha visto sul giornale Dior: «se si passa una
 * volta in più sulle diagonali del punto non si nota» — e i passaggi devono usare gli stessi punti
 * invece di saltare a caso. Con 0,4 il filo sopra faceva 186 salti su quel disegno, con 0,1 e la
 * soglia a 30 ne fa 18. Una volta sola però: vedi `extra`.
 */
export const DEFAULT_COSTS: TravelCosts = { hidden: 0.05, retrace: 0.1, border: 12, vertical: 0.3, verticalSide: 1.5, open: 1.6, over: 3, extra: 1 };

export interface RouteParams {
  /** Passate su ogni diagonale (avanti e indietro). */
  repetitions: number;
  /**
   * Passate per filo (Lorenzo, 2026-09-25: «un colore voglio 3 passaggi e quello sopra 5»): indice
   * del filo → passate. Dove manca vale `repetitions`.
   */
  passesByColor?: Record<number, number>;
  /** Vero = ogni diagonale si cuce solo nel suo verso (\ dall'alto, / dal basso), come nella vecchia app. */
  fixedDirection: boolean;
  /**
   * Come si distribuiscono le passate. `row` = ogni passata è un pezzo a sé: la riga si fa
   * all'andata e si ripassa al ritorno. `stitch` = tutte le passate sullo stesso punto prima del
   * successivo, come il punto triplo delle macchine (avanti, indietro, avanti sugli stessi fori).
   * Con la V e un numero DISPARI di passate si finisce nell'angolo dove comincia la V dopo, e una
   * riga si cuce di filato senza passaggi (Lorenzo, 2026-09-24).
   */
  passOrder?: 'row' | 'stitch';
  /** La gamba che sta sopra nella croce. */
  topLeg: Leg;
  /** Oltre questo costo di passaggio (≈ mm in vista) si salta: taglio e ripartenza. */
  jumpMm: number;
  costs?: Partial<TravelCosts>;
  /**
   * La BASE (Lorenzo, 2026-09-25): un filo che riempie TUTTA la griglia col suo punto, cucito per
   * primo e con il suo ago; il disegno degli altri fili si ricama sopra. Le celle del disegno che
   * hanno già il colore della base non si cuciono una seconda volta.
   */
  base?: { color: number; stitch: Stitch } | null;
  /**
   * Per BLOCCHI di colore (default vero; Lorenzo, 2026-09-25: «lavorare per blocchi colore»): un
   * blocco è un gruppo di celle dello stesso colore che si toccano (sopra, sotto, di lato); la base
   * è un blocco solo. Il filo finisce il blocco in cui si trova prima di passare a un altro, invece
   * di andare sempre sulla cosa più vicina: sul giornale Dior il nero (139 blocchi) cambiava blocco
   * 471 volte e rientrava 332 volte in blocchi lasciati a metà.
   */
  blocks?: boolean;
  /**
   * Dentro un blocco, per TRATTI DI RIGA (default vero, con i blocchi): celle consecutive dello
   * stesso colore sulla stessa riga. Il filo finisce il tratto in cui si trova e ne comincia uno
   * nuovo solo da un'estremità, così lo percorre tutto in una volta. Sul giornale Dior, a blocchi il
   * filo faceva 2,5 volte il ripasso minimo: entrava nei tratti a metà e ci tornava.
   */
  runs?: boolean;
  /**
   * Le ZONE (zones.ts): il disegno di ogni colore tagliato lungo le strisce vuote, come
   * l'impaginazione di un giornale. Il filo finisce la zona prima di passare alla più vicina; dentro
   * la zona, i pezzi che si toccano e i tratti di riga come sopra. null = niente zone.
   */
  zones?: Partial<ZoneOptions> | null;
}

// Salti quasi mai: a macchina un salto lascia un filo che attraversa gli altri colori (Lorenzo).
// Le passate tutte sulla stessa V: la partenza scelta da Lorenzo (2026-09-24), che lavora a passate dispari.
export const DEFAULT_ROUTE: RouteParams = { repetitions: 1, fixedDirection: false, topLeg: 'down', jumpMm: 400, passOrder: 'stitch' };

/** Un tratto del percorso fra due vertici del reticolo. */
export type SegKind = 'stitch' | 'hidden' | 'retrace' | 'vertical' | 'visible' | 'jump';
export interface RouteSeg { kind: SegKind; from: number; to: number; }

export interface ColorRoute { color: number; segs: RouteSeg[]; }

export interface RouteMetrics {
  /** Diagonali (gambe) da cucire. */
  legs: number;
  /** mm di passaggio per tipo. */
  hiddenMm: number;
  verticalMm: number;
  retraceMm: number;
  visibleMm: number;
  /** Salti (tagli): fra due colori non si conta, lì il taglio c'è comunque. */
  jumps: number;
  jumpMm: number;
  /** Il massimo di passaggi in più finiti su una stessa diagonale. */
  maxExtra: number;
}

export interface RouteResult { colors: ColorRoute[]; metrics: RouteMetrics; }

interface LegState {
  color: number;
  a: number;
  b: number;
  /** Passate ancora da fare su questa gamba. */
  remaining: number;
  /** Passaggi (non punti) che le sono già passati sopra o sotto. */
  extra: number;
  /** La gamba che va finita prima (la gamba sotto della croce), o -1. */
  prereq: number;
  /** Il blocco di colore a cui appartiene (-1 = la base). */
  block: number;
  /** La zona a cui appartiene (-1 = la base). */
  zone: number;
  /** Il tratto di riga a cui appartiene. */
  run: number;
}

/**
 * L'unità che l'ordine sceglie. Con `passOrder: 'row'` è UNA passata su una gamba; con
 * `'stitch'` sono TUTTE le passate di un punto: di una gamba, o di una V intera (due gambe della
 * stessa riga che si toccano, `pair`).
 */
interface Unit {
  leg: number;
  /** Con la direzione fissa: l'unico capo da cui si può entrare. -1 = tutti e due. */
  fixedEntry: number;
  /** Quante passate cuce l'unità. */
  passes: number;
  /** La V: la seconda gamba, il vertice in comune (la punta) e i due capi liberi. */
  pair?: { leg2: number; mid: number; a: number; b: number };
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
  const repsOf = (color: number) => Math.max(1, Math.round(params.passesByColor?.[color] ?? params.repetitions));
  const W = latticeWidth(g);            // vertici per riga: angoli e metà dei lati
  const JMAX = W - 1;                   // ultima mezza colonna
  const half = g.cellW / 2;

  // --- le gambe, e per ogni gamba le sue passate ---
  // Una gamba è una coppia di vertici del reticolo: mezza cella in orizzontale (le due gambe
  // della V) o una cella intera (croce, diagonale).
  const legs: LegState[] = [];
  const units: Unit[] = [];
  const perStitch = params.passOrder === 'stitch';
  const edgeKey = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  /**
   * coppia di vertici → gambe. Possono essere più d'una: una V del disegno ricamata sopra la V
   * della base usa le stesse diagonali.
   */
  const legAt = new Map<number, number[]>();
  /** vertice → gambe lunghe (cella intera) che lo toccano: sono tratti che il reticolo fine non ha. */
  const longAt = new Map<number, number[]>();
  /** cella → le sue gambe (per sapere cosa c'è intorno a un passaggio verticale). */
  const cellLegs = new Map<number, number[]>();
  // I punti da cucire: prima la base su ogni cella, poi il disegno (senza le celle del colore
  // della base, che sono già coperte).
  const base = params.base ?? null;
  const entries: Array<[number, { stitch: Stitch; color: number }]> = [];
  if (base) for (let k = 0; k < g.rows * g.cols; k++) entries.push([k, { stitch: base.stitch, color: base.color }]);
  for (const k of [...cells.keys()].sort((x, y) => x - y)) {
    const m = cells.get(k)!;
    if (base && m.color === base.color) continue;
    entries.push([k, m]);
  }
  // le zone di ogni colore del disegno (un numero unico per tutta la griglia)
  const zoneOfCell = new Map<number, number>();
  if (params.blocks !== false && params.zones !== null) {
    let offset = 0;
    const colorsInDesign = [...new Set([...cells.values()].map((m) => m.color))].filter((c) => !(base && c === base.color));
    for (const col of colorsInDesign) {
      const z = zonesOf(g, cells, col, params.zones ?? {});
      let top = -1;
      for (const [k, v] of z) { zoneOfCell.set(k, offset + v); if (v > top) top = v; }
      offset += top + 1;
    }
  }
  const blockOfCell = new Map<number, number>();
  {
    let nb = 0;
    for (const [k0, m0] of cells) {
      if (blockOfCell.has(k0) || (base && m0.color === base.color)) continue;
      const stack = [k0];
      blockOfCell.set(k0, nb);
      while (stack.length) {
        const x = stack.pop()!;
        const rr = Math.floor(x / g.cols), cc = x - rr * g.cols;
        for (const [r2, c2] of [[rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]]) {
          if (r2 < 0 || c2 < 0 || r2 >= g.rows || c2 >= g.cols) continue;
          const y = r2 * g.cols + c2;
          if (blockOfCell.has(y) || cells.get(y)?.color !== m0.color || zoneOfCell.get(y) !== zoneOfCell.get(k0)) continue;
          blockOfCell.set(y, nb);
          stack.push(y);
        }
      }
      nb++;
    }
  }
  const nBase = base ? g.rows * g.cols : 0; // le prime nBase voci sono la base
  // Tratti di riga: per il disegno, celle consecutive dello stesso colore; per la base, la riga
  // intera. Le estremità sono i quattro angoli esterni del tratto.
  const runOfCell = new Map<number, number>();
  const runEnds: Array<Set<number>> = [];
  const addRun = (row: number, c0: number, c1: number) => {
    runEnds.push(new Set([vertexIndex(g, row, 2 * c0), vertexIndex(g, row + 1, 2 * c0), vertexIndex(g, row, 2 * c1 + 2), vertexIndex(g, row + 1, 2 * c1 + 2)]));
    return runEnds.length - 1;
  };
  for (let row = 0; row < g.rows; row++) {
    let c = 0;
    while (c < g.cols) {
      const m0 = cells.get(row * g.cols + c);
      if (!m0 || (base && m0.color === base.color)) { c++; continue; }
      let c1 = c;
      while (c1 + 1 < g.cols) { const n = cells.get(row * g.cols + c1 + 1); if (!n || n.color !== m0.color || zoneOfCell.get(row * g.cols + c1 + 1) !== zoneOfCell.get(row * g.cols + c)) break; c1++; }
      const id = addRun(row, c, c1);
      for (let x = c; x <= c1; x++) runOfCell.set(row * g.cols + x, id);
      c = c1 + 1;
    }
  }
  const baseRun: number[] = [];
  if (base) for (let row = 0; row < g.rows; row++) baseRun.push(addRun(row, 0, g.cols - 1));
  let entryIndex = -1;
  for (const [k, m] of entries) {
    entryIndex++;
    const block = entryIndex < nBase ? -1 : (blockOfCell.get(k) ?? -2);
    const run = entryIndex < nBase ? baseRun[Math.floor(k / g.cols)] : (runOfCell.get(k) ?? -2);
    const zone = entryIndex < nBase ? -1 : (zoneOfCell.get(k) ?? -2);
    const reps = repsOf(m.color);
    const r = Math.floor(k / g.cols), c = k - r * g.cols;
    const mine: number[] = [];
    let prev = -1;
    const isCross = m.stitch === 'cross';
    for (const { a, b } of stitchLegs(g, r, c, m.stitch, params.topLeg)) {
      const id = legs.length;
      // nella croce la gamba sopra aspetta quella sotto; nella V le due gambe sono libere
      legs.push({ color: m.color, a, b, remaining: reps, extra: 0, prereq: isCross ? prev : -1, block, zone, run });
      const ek = edgeKey(a, b);
      const onEdge = legAt.get(ek);
      if (onEdge) onEdge.push(id); else legAt.set(ek, [id]);
      const ja = a % W, jb = b % W;
      if (Math.abs(ja - jb) === 2) for (const v of [a, b]) { const l = longAt.get(v); if (l) l.push(id); else longAt.set(v, [id]); }
      mine.push(id);
      // Direzione fissa: le passate vanno avanti e indietro (a→b, b→a, …) come nella vecchia app.
      if (!perStitch) for (let p = 0; p < reps; p++) units.push({ leg: id, fixedEntry: params.fixedDirection ? (p % 2 === 0 ? a : b) : -1, passes: 1, done: false });
      prev = id;
    }
    const inCell = cellLegs.get(k);
    if (inCell) inCell.push(...mine); else cellLegs.set(k, mine);
    if (perStitch) {
      // Tutte le passate sullo stesso punto: la V (e la Λ) è UNA unità, angolo → punta → angolo;
      // croce e diagonale una unità per gamba.
      if (m.stitch === 'v' || m.stitch === 'lambda') {
        const [l1, l2] = mine, L1 = legs[l1], L2 = legs[l2];
        units.push({ leg: l1, fixedEntry: params.fixedDirection ? L1.a : -1, passes: reps, pair: { leg2: l2, mid: L1.b, a: L1.a, b: L2.b }, done: false });
      } else {
        for (const id of mine) units.push({ leg: id, fixedEntry: params.fixedDirection ? legs[id].a : -1, passes: reps, done: false });
      }
    }
  }

  const present = [...new Set(legs.map((l) => l.color))];
  // la base è sempre il primo ago: sta sotto a tutto
  const sorted = colorOrder ?? [...present].sort((x, y) => x - y);
  const order = (base ? [base.color, ...sorted.filter((c) => c !== base.color)] : sorted).filter((c) => present.includes(c));
  const rank = new Map<number, number>(order.map((c, i) => [c, i]));

  const metrics: RouteMetrics = { legs: legs.length, hiddenMm: 0, verticalMm: 0, retraceMm: 0, visibleMm: 0, jumps: 0, jumpMm: 0, maxExtra: 0 };
  const colors: ColorRoute[] = [];

  // --- stato del Dijkstra, riusato ---
  const V = vertexCount(g);
  const dist = new Float64Array(V).fill(Infinity);
  const prevV = new Int32Array(V).fill(-1);
  const touched: number[] = [];
  const heap = new MinHeap();

  /**
   * Il costo per mm e la classe di un tratto lungo una diagonale, per il colore `k`: nel vuoto se
   * non c'è nessuna gamba, altrimenti la migliore fra quelle che ci stanno (basta che UNA la copra).
   */
  const legClass = (ids: number[] | undefined, k: number): { w: number; kind: SegKind } => {
    if (!ids || !ids.length) return { w: costs.open, kind: 'visible' };
    let best = oneLegClass(ids[0], k);
    for (let q = 1; q < ids.length; q++) { const c = oneLegClass(ids[q], k); if (c.w < best.w) best = c; }
    return best;
  };
  const oneLegClass = (id: number, k: number): { w: number; kind: SegKind } => {
    const leg = legs[id];
    const more = leg.extra > 0 ? costs.extra * leg.extra : 1;
    if (leg.color === k) return leg.remaining > 0 ? { w: costs.hidden * more, kind: 'hidden' } : { w: costs.retrace * more, kind: 'retrace' };
    return (rank.get(leg.color) ?? 0) > (rank.get(k) ?? 0)
      ? { w: costs.hidden * more, kind: 'hidden' }
      : { w: costs.over, kind: 'visible' };
  };

  const pitch = g.cellH * (1 - Math.min(90, Math.max(0, g.overlapPct ?? 0)) / 100);
  /**
   * Il tratto verticale dal vertice (i, j) a (i+1, j) sta nella riga i: a metà cella (j dispari)
   * passa al centro della cella (la punta della V), sull'angolo (j pari) fra le due celle vicine.
   * Se lì c'è un punto di un colore già cucito, il filo ci passerebbe sopra e si vede; se è tutto
   * vuoto, è un filo nel vuoto.
   */
  const verticalClass = (i: number, j: number, k: number): { w: number; kind: SegKind } => {
    // Con la base, sotto ogni cella c'è un punto già cucito: il verticale si vede solo se intorno
    // NON c'è nessun punto di questo filo o di uno che viene dopo (che lo copre o lo accompagna).
    let mineOrLater = false, earlier = false;
    const around = j % 2 === 1 ? [(j - 1) / 2] : [j / 2 - 1, j / 2];
    for (const c of around) {
      if (c < 0 || c >= g.cols) continue;
      for (const id of cellLegs.get(i * g.cols + c) ?? []) {
        const leg = legs[id];
        if (leg.color === k || (rank.get(leg.color) ?? 0) > (rank.get(k) ?? 0)) mineOrLater = true;
        else earlier = true;
      }
    }
    if (!mineOrLater) return earlier ? { w: costs.over, kind: 'visible' } : { w: costs.open, kind: 'visible' };
    return { w: j % 2 === 1 ? costs.vertical : costs.verticalSide, kind: 'vertical' };
  };

  const shortDiag = Math.hypot(half, g.cellH), longDiag = Math.hypot(g.cellW, g.cellH);

  /** I vicini di `v` nel reticolo, col costo del tratto. */
  const forEachNeighbour = (v: number, k: number, fn: (w: number, cost: number) => void): void => {
    const i = Math.floor(v / W), j = v - i * W;
    // orizzontali (da evitare) e verticali (vertice-vertice)
    if (j > 0) fn(v - 1, half * costs.border);
    if (j < JMAX) fn(v + 1, half * costs.border);
    if (i > 0) fn(v - W, pitch * verticalClass(i - 1, j, k).w);
    if (i < g.rows) fn(v + W, pitch * verticalClass(i, j, k).w);
    // diagonali di mezza cella (le gambe della V, o un filo storto nel vuoto)
    if (i < g.rows && j < JMAX) fn(v + W + 1, shortDiag * legClass(legAt.get(edgeKey(v, v + W + 1)), k).w);
    if (i > 0 && j > 0) fn(v - W - 1, shortDiag * legClass(legAt.get(edgeKey(v, v - W - 1)), k).w);
    if (i < g.rows && j > 0) fn(v + W - 1, shortDiag * legClass(legAt.get(edgeKey(v, v + W - 1)), k).w);
    if (i > 0 && j < JMAX) fn(v - W + 1, shortDiag * legClass(legAt.get(edgeKey(v, v - W + 1)), k).w);
    // diagonali di cella intera: solo dove c'è una gamba (croce, diagonale)
    for (const id of longAt.get(v) ?? []) {
      const l = legs[id];
      fn(l.a === v ? l.b : l.a, longDiag * legClass(legAt.get(edgeKey(l.a, l.b)), k).w);
    }
  };

  /** La classe e la lunghezza di un singolo tratto fra due vertici (per il disegno e le misure). */
  const edgeKind = (v: number, w: number, k: number): { kind: SegKind; mm: number } => {
    const i1 = Math.floor(v / W), j1 = v - i1 * W, i2 = Math.floor(w / W), j2 = w - i2 * W;
    if (i1 === i2) return { kind: 'visible', mm: half * Math.abs(j2 - j1) };
    if (j1 === j2) return { kind: verticalClass(Math.min(i1, i2), j1, k).kind, mm: pitch };
    return { kind: legClass(legAt.get(edgeKey(v, w)), k).kind, mm: Math.hypot(half * Math.abs(j2 - j1), g.cellH) };
  };

  /** Segna il passaggio in più sulla gamba fra due vertici, se ce n'è una. */
  const markExtra = (v: number, w: number) => {
    for (const id of legAt.get(edgeKey(v, w)) ?? []) legs[id].extra++;
  };

  const pt = (v: number) => { const i = Math.floor(v / W); return { x: (v - i * W) * half, y: i * g.cellH }; };
  const available = (id: number) => {
    const u = units[id];
    if (u.done) return false;
    const pre = legs[u.leg].prereq;
    return pre < 0 || legs[pre].remaining === 0;
  };
  /** I due capi da cui si entra in un'unità (della V: gli angoli liberi, non la punta). */
  const endsOf = (id: number): [number, number] => {
    const u = units[id];
    return u.pair ? [u.pair.a, u.pair.b] : [legs[u.leg].a, legs[u.leg].b];
  };
  const entriesOf = (id: number) => {
    const u = units[id];
    return u.fixedEntry >= 0 ? [u.fixedEntry] : endsOf(id);
  };
  /** Con un numero dispari di passate si esce dall'altro capo, con uno pari da dove si è entrati. */
  const exitOf = (id: number, entry: number) => {
    const [a, b] = endsOf(id);
    if (units[id].passes % 2 === 0) return entry;
    return entry === a ? b : a;
  };
  const topLeft = (id: number) => Math.min(...endsOf(id));

  let at = -1; // vertice dove si trova l'ago (-1 = non ancora partito)

  for (const k of order) {
    const mine: number[] = [];
    /** vertice → unità di questo colore che lo toccano. */
    const byVertex = new Map<number, number[]>();
    units.forEach((u, id) => {
      const l = legs[u.leg];
      if (l.color !== k) return;
      mine.push(id);
      for (const v of endsOf(id)) {
        const list = byVertex.get(v);
        if (list) list.push(id); else byVertex.set(v, [id]);
      }
    });
    let left = mine.length;
    const byBlocks = params.blocks !== false;
    const blockLeft = new Map<number, number>();
    for (const id of mine) { const b = legs[units[id].leg].block; blockLeft.set(b, (blockLeft.get(b) ?? 0) + 1); }
    let current = -3; // nessun blocco ancora
    /** Si può prendere: se il blocco corrente non è finito, solo le sue unità. */
    const zoneLeft = new Map<number, number>();
    for (const id of mine) { const z = legs[units[id].leg].zone; zoneLeft.set(z, (zoneLeft.get(z) ?? 0) + 1); }
    let currentZone = -3;
    /** Nella zona corrente finché non è finita; dentro la zona, nel blocco corrente finché non è finito. */
    const inBlock = (id: number) => {
      if (!byBlocks) return true;
      const leg = legs[units[id].leg];
      if ((zoneLeft.get(currentZone) ?? 0) > 0 && leg.zone !== currentZone) return false;
      return (blockLeft.get(current) ?? 0) === 0 || leg.block === current;
    };
    const byRuns = byBlocks && params.runs !== false;
    const runLeft = new Map<number, number>();
    for (const id of mine) { const rn = legs[units[id].leg].run; runLeft.set(rn, (runLeft.get(rn) ?? 0) + 1); }
    let currentRun = -3;
    /** Nel tratto corrente finché non è finito; un tratto nuovo solo da un'estremità. */
    const inRun = (id: number, v: number) => {
      if (!byRuns) return true;
      const rn = legs[units[id].leg].run;
      if ((runLeft.get(currentRun) ?? 0) > 0) return rn === currentRun;
      return runEnds[rn]?.has(v) ?? true;
    };
    const segs: RouteSeg[] = [];

    /** Quante unità si possono prendere gratis all'uscita dopo aver preso `id` (Warnsdorff). */
    const onward = (id: number, exit: number) => {
      const leg = units[id].leg;
      let n = 0;
      for (const o of byVertex.get(exit) ?? []) {
        if (o === id || units[o].done) continue;
        const pre = legs[units[o].leg].prereq;
        // la gamba sopra si libera se questa è l'ultima passata della gamba sotto
        if (pre >= 0 && legs[pre].remaining > (pre === leg ? units[id].passes : 0)) continue;
        if (entriesOf(o).includes(exit)) n++;
      }
      return n;
    };

    const take = (id: number, entry: number) => {
      const u = units[id];
      const [a, b] = endsOf(id);
      const other = entry === a ? b : a;
      let cur = entry;
      for (let q = 0; q < u.passes; q++) {
        const to = cur === entry ? other : entry;
        if (u.pair) {
          // la V: angolo → punta → angolo, avanti e indietro
          segs.push({ kind: 'stitch', from: cur, to: u.pair.mid });
          segs.push({ kind: 'stitch', from: u.pair.mid, to });
        } else {
          segs.push({ kind: 'stitch', from: cur, to });
        }
        cur = to;
      }
      u.done = true;
      current = legs[u.leg].block;
      currentZone = legs[u.leg].zone;
      zoneLeft.set(currentZone, (zoneLeft.get(currentZone) ?? 1) - 1);
      blockLeft.set(current, (blockLeft.get(current) ?? 1) - 1);
      currentRun = legs[u.leg].run;
      runLeft.set(currentRun, (runLeft.get(currentRun) ?? 1) - 1);
      legs[u.leg].remaining -= u.passes;
      if (u.pair) legs[u.pair.leg2].remaining -= u.passes;
      left--;
      at = cur;
    };

    // Da dove parte il filo. Il primo: dalla diagonale più in alto a sinistra. Gli altri: dopo il
    // cambio colore la macchina si sposta a vuoto, quindi dal capo libero più vicino a dove ha
    // finito il filo di prima — non con un passaggio cucito che ci arriva (era il difetto visto
    // in anteprima: 10 mm di filo rosso in vista solo per raggiungere il suo inizio).
    // E in tutti e due i casi da un capo DISPARI, se c'è (Eulero): un vertice dove si incontrano
    // due gambe è il mezzo di un percorso, e partendo da lì una metà resta da riprendere con un
    // salto. Visto in anteprima sulla riga di Λ rossa, che partiva dal centro.
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
      const limit = params.jumpMm;
      const search = (accept: (id: number, v: number) => boolean) => {
        for (const t of touched) { dist[t] = Infinity; prevV[t] = -1; }
        touched.length = 0;
        heap.clear();
        dist[at] = 0; touched.push(at); heap.push(0, at);
        let best = Infinity;
        const found: Array<{ id: number; entry: number; d: number }> = [];
        while (heap.size) {
          const d = heap.peekD();
          const v = heap.pop();
          if (d > dist[v]) continue;
          if (d > best + 1e-6 || d > limit) break;
          for (const id of byVertex.get(v) ?? []) {
            if (!available(id) || !accept(id, v) || !entriesOf(id).includes(v)) continue;
            found.push({ id, entry: v, d });
            if (d < best) best = d;
          }
          forEachNeighbour(v, k, (w, cost) => {
            const nd = d + cost;
            if (nd < dist[w] && nd <= limit) {
              if (dist[w] === Infinity) touched.push(w);
              dist[w] = nd; prevV[w] = v; heap.push(nd, w);
            }
          });
        }
        return { found, best };
      };
      // prima dentro il tratto (o da un'estremità di uno nuovo); se non si trova niente, il blocco
      let { found: cands, best: bestD } = search((id, v) => inBlock(id) && inRun(id, v));
      if (!cands.length && byRuns) ({ found: cands, best: bestD } = search((id) => inBlock(id)));

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
          if (kind === 'hidden' || kind === 'retrace') markExtra(from, v);
          segs.push({ kind, from, to: v });
          if (kind === 'hidden') metrics.hiddenMm += mm;
          else if (kind === 'vertical') metrics.verticalMm += mm;
          else if (kind === 'retrace') metrics.retraceMm += mm;
          else metrics.visibleMm += mm;
          from = v;
        }
        take(pick.id, pick.entry);
        continue;
      }

      // --- niente sotto soglia: salto all'unità disponibile più vicina ---
      const here = pt(at);
      let best: { id: number; entry: number; d: number } | null = null;
      for (const id of mine) {
        if (!available(id) || !inBlock(id)) continue;
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

  for (const l of legs) if (l.extra > metrics.maxExtra) metrics.maxExtra = l.extra;
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

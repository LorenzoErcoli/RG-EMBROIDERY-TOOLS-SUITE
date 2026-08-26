// Punto ④ — I PASSAGGI NASCOSTI (R16-R21). È il cuore della tecnica, non una rifinitura.
//
// Il riempimento (punto ③) lascia le corse staccate: sulla demo sono 2.027 pezzi. Qui si cuciono
// insieme, e la regola è quella che Lorenzo ha messo al centro: **il filo di collegamento deve
// finire sotto il ricamo che verrà dopo**. L'ultimo colore non ha più niente sopra e può solo
// cercare i bordi dei soggetti, dove si vede meno.
//
// Che quella regola sia davvero la firma della tecnica non è un'opinione: nel DST di riferimento la
// copertura dei passaggi **scende monotòna lungo l'ordine dei colori** — 81, 77, 66, 53, 51, 29 e
// infine 0% per l'ultimo — e i passaggi sono orizzontali dal 67 al 99%. Sono i due numeri su cui
// questo file si misura.
//
// Come funziona. Per ogni ago si costruisce una **mappa di costo** a celle: dove ci sarà ricamo
// dopo il passaggio è nascosto e costa poco, dove resterà scoperto costa moltissimo (R16: la
// visibilità è un peso dominante), e muoversi in verticale costa più che in orizzontale. Poi un A*
// cerca la strada. Non è un vincolo rigido ma un costo, così l'ultimo colore — che non ha nessuna
// copertura — trova comunque una strada invece di arrendersi: sceglie i bordi, che costano meno.
//
// Resta locale all'app (deciso con Lorenzo): `covered-travel` nel core è la voce C8, e si promuove
// quando questo avrà passato la prova del ricamo vero.
//
// Nessun DOM.

import {
  type Point, type Polyline,
  distance, simplifyPolyline, resampleUniform,
} from '@rg/core';
import { NO_COLOR } from './reduce';
import { pointInRegion, type Region } from './regions';
import type { BroccatoColor } from './engine';

// ------------------------------------------------------------
// La mappa di costo
// ------------------------------------------------------------

/** Cosa c'è in una cella, dal punto di vista dell'ago che deve passarci. */
export const CELL_COVERED = 1;   // ci ricamerà sopra un colore successivo → il passaggio sparisce
export const CELL_OWN = 2;       // area di questo stesso ago: le sue righe lo nascondono in parte
export const CELL_EDGE = 3;      // scoperta, ma sul contorno di un soggetto: si vede meno
export const CELL_BARE = 4;      // scoperta e in mezzo al campo: qui il filo si vedrebbe

export interface CoverGrid {
  cols: number;
  rows: number;
  cellMm: number;
  /** Uno dei `CELL_*` per cella. */
  kind: Uint8Array;
}

export interface RoutingOptions {
  /** Lato della cella della mappa, in mm. */
  cellMm?: number;
  /** Quanto costa passare allo scoperto rispetto al nascosto (R16: dominante). */
  visibilityWeight?: number;
  /** Sconto sulle celle di bordo: è lì che va l'ultimo colore. */
  edgeDiscount?: number;
  /** Quanto costa muoversi in verticale rispetto all'orizzontale (il DST preferisce l'orizzontale). */
  verticalPenalty?: number;
  /** Sotto questa lunghezza, e restando dentro la regione, si va dritti senza cercare strade. */
  maxDirectMm?: number;
  /** Passo dei punti di passaggio (§3.1). */
  travelStitchMm?: number;
  /**
   * Oltre questo tratto SCOPERTO il passaggio non si cuce: si stacca il filo (R16 — «nascondi se
   * puoi; se proprio non puoi, spezza il percorso, mai un travel visibile silenzioso»).
   */
  maxVisibleTravelMm?: number;
}

const DEF: Required<RoutingOptions> = {
  cellMm: 1.5,
  visibilityWeight: 60,
  edgeDiscount: 0.45,
  verticalPenalty: 1.8,
  maxDirectMm: 6,
  travelStitchMm: 3,
  maxVisibleTravelMm: 50,
};

// Perche' 50mm di tratto scoperto prima di staccare il filo. Non e' un numero scelto: e' quello che
// riproduce la proporzione del DST di riferimento, dove i salti sono 163 su 84.530 punti (0,19%).
// Sulla demo: soglia 30 -> 120 salti, soglia 50 -> 44 salti su 25.296 punti (0,17%), soglia 80 -> 19.

/**
 * La mappa di costo per l'ago `colorIndex`: cosa gli verrà cucito sopra, cosa è suo, cosa resta
 * scoperto. Si legge direttamente dalla mappa dei colori (un byte per pixel), senza rasterizzare
 * di nuovo i poligoni.
 */
export function buildCoverGrid(
  index: Uint8Array,
  width: number,
  height: number,
  mmPerPx: number,
  colorIndex: number,
  colors: BroccatoColor[],
  cellMm: number,
): CoverGrid {
  const cols = Math.max(1, Math.ceil((width * mmPerPx) / cellMm));
  const rows = Math.max(1, Math.ceil((height * mmPerPx) / cellMm));
  const kind = new Uint8Array(cols * rows).fill(CELL_BARE);

  // Un colore di BASE cucito dopo copre tutto il foglio: se ce n'è uno, il passaggio è sempre nascosto.
  let baseDopo = false;
  for (let j = colorIndex + 1; j < colors.length; j++) {
    if (colors[j].role === 'base') baseDopo = true;
  }
  if (baseDopo) { kind.fill(CELL_COVERED); return { cols, rows, cellMm, kind }; }

  const dopo = new Uint8Array(256);
  for (let j = colorIndex + 1; j < colors.length; j++) if (colors[j].role !== 'escluso') dopo[j] = 1;

  const pxPerCell = cellMm / mmPerPx;
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor(r * pxPerCell), y1 = Math.min(height, Math.ceil((r + 1) * pxPerCell));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * pxPerCell), x1 = Math.min(width, Math.ceil((c + 1) * pxPerCell));
      let coperta = false, propria = false;
      for (let y = y0; y < y1 && !coperta; y++) {
        for (let x = x0; x < x1; x++) {
          const v = index[y * width + x];
          if (v === NO_COLOR) continue;
          if (dopo[v]) { coperta = true; break; }
          if (v === colorIndex) propria = true;
        }
      }
      kind[r * cols + c] = coperta ? CELL_COVERED : propria ? CELL_OWN : CELL_BARE;
    }
  }

  // I bordi dei soggetti: celle scoperte che confinano con qualcosa di diverso. È lì che si muove
  // l'ultimo colore, quello che non ha più niente sopra.
  const copia = Uint8Array.from(kind);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (copia[i] !== CELL_BARE) continue;
      const diverso =
        (c > 0 && copia[i - 1] !== CELL_BARE) || (c < cols - 1 && copia[i + 1] !== CELL_BARE) ||
        (r > 0 && copia[i - cols] !== CELL_BARE) || (r < rows - 1 && copia[i + cols] !== CELL_BARE);
      if (diverso) kind[i] = CELL_EDGE;
    }
  }
  return { cols, rows, cellMm, kind };
}

/** Il moltiplicatore di costo di una cella. */
function cellCost(kind: number, o: Required<RoutingOptions>): number {
  if (kind === CELL_COVERED) return 1;
  if (kind === CELL_OWN) return 2;
  if (kind === CELL_EDGE) return o.visibilityWeight * o.edgeDiscount;
  return o.visibilityWeight;
}

// ------------------------------------------------------------
// A* sulla mappa
// ------------------------------------------------------------

/** Coda di priorità minima, array binario: basta e avanza per queste dimensioni. */
class Heap {
  private a: number[] = [];
  private p: number[] = [];
  get size(): number { return this.a.length; }
  push(v: number, pri: number): void {
    this.a.push(v); this.p.push(pri);
    let i = this.a.length - 1;
    while (i > 0) {
      const g = (i - 1) >> 1;
      if (this.p[g] <= this.p[i]) break;
      [this.a[g], this.a[i]] = [this.a[i], this.a[g]];
      [this.p[g], this.p[i]] = [this.p[i], this.p[g]];
      i = g;
    }
  }
  pop(): number {
    const top = this.a[0], lastV = this.a.pop()!, lastP = this.p.pop()!;
    if (this.a.length) {
      this.a[0] = lastV; this.p[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.p[l] < this.p[m]) m = l;
        if (r < this.a.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        [this.p[m], this.p[i]] = [this.p[i], this.p[m]];
        i = m;
      }
    }
    return top;
  }
}

/** La cella che contiene un punto in mm. */
const cellOf = (p: Point, g: CoverGrid): number => {
  const c = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cellMm)));
  const r = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cellMm)));
  return r * g.cols + c;
};
const centerOf = (i: number, g: CoverGrid): Point => ({
  x: ((i % g.cols) + 0.5) * g.cellMm,
  y: (Math.floor(i / g.cols) + 0.5) * g.cellMm,
});

/**
 * La strada meno visibile da `a` a `b`. Non c'è nessun muro: dove non si può nascondere si paga, e
 * questo è ciò che permette all'ultimo colore di passare comunque, scegliendo i bordi.
 */
function routeHidden(a: Point, b: Point, g: CoverGrid, o: Required<RoutingOptions>): Point[] | null {
  const start = cellOf(a, g), goal = cellOf(b, g);
  if (start === goal) return [a, b];

  const n = g.cols * g.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const chiuso = new Uint8Array(n);
  const gx = goal % g.cols, gy = Math.floor(goal / g.cols);
  const h = (i: number): number =>
    (Math.abs((i % g.cols) - gx) + Math.abs(Math.floor(i / g.cols) - gy)) * g.cellMm;

  const open = new Heap();
  gScore[start] = 0;
  open.push(start, h(start));

  let visitate = 0;
  const tetto = Math.min(n, 60000);
  while (open.size) {
    const cur = open.pop();
    if (chiuso[cur]) continue;
    chiuso[cur] = 1;
    if (cur === goal) break;
    if (++visitate > tetto) return null;                 // rete di sicurezza, non deve mai scattare

    const cx = cur % g.cols, cy = Math.floor(cur / g.cols);
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
      const ni = ny * g.cols + nx;
      if (chiuso[ni]) continue;
      const verticale = d >= 2;
      const passo = g.cellMm * (verticale ? o.verticalPenalty : 1);
      const t = gScore[cur] + passo * cellCost(g.kind[ni], o);
      if (t < gScore[ni]) { gScore[ni] = t; from[ni] = cur; open.push(ni, t + h(ni)); }
    }
  }
  if (from[goal] < 0 && start !== goal) return null;

  const celle: number[] = [];
  for (let i = goal; i >= 0; i = from[i]) { celle.push(i); if (i === start) break; }
  celle.reverse();
  const via: Point[] = [a, ...celle.slice(1, -1).map((i) => centerOf(i, g)), b];
  return simplifyPolyline(via, g.cellMm * 0.5);
}

// ------------------------------------------------------------
// Cucire insieme le corse di un ago
// ------------------------------------------------------------

export interface RoutedColor {
  /** I tratti cuciti: fra un tratto e il successivo c'è un salto (filo staccato). */
  blocks: Polyline[];
  /** Filo di solo passaggio, in mm. */
  travelMm: number;
  /** Di quello, quanto corre sotto un colore successivo. */
  travelCoveredMm: number;
  /** Di quello, quanto corre in orizzontale. */
  travelHorizontalMm: number;
  jumps: number;
  /**
   * Il confronto onesto: sugli STESSI passaggi instradati, quanto sarebbe stato coperto andando
   * per la via piu' corta. Serve a sapere se la ricerca sta guadagnando qualcosa o se si sta solo
   * pagando del tempo — e non si puo' leggere dal totale, perche' i passaggi che diventano salti
   * escono dalla statistica e la falsano.
   */
  routedMm: number;
  routedCoveredMm: number;
  straightCoveredMm: number;
  /** Di quelli instradati, quanto corre in orizzontale (il DST li fa dal 67 al 99% orizzontali). */
  routedHorizontalMm: number;
}

/** Quanta parte di un segmento sta sotto la copertura futura. */
function coveredFraction(a: Point, b: Point, g: CoverGrid): number {
  const d = distance(a, b);
  const n = Math.max(1, Math.ceil(d / (g.cellMm * 0.5)));
  let dentro = 0;
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (g.kind[cellOf(p, g)] === CELL_COVERED) dentro++;
  }
  return dentro / (n + 1);
}

/**
 * Cuce insieme le corse di un ago, nascondendo i passaggi.
 *
 * Tre casi, in ordine:
 * 1. **dritto** — se il salto è corto e resta dentro la stessa macchia è il normale passaggio da
 *    una riga all'altra: si va dritti, non c'è niente da nascondere;
 * 2. **nascosto** — altrimenti si cerca la strada meno visibile con l'A*, e la si cuce a passo
 *    di passaggio;
 * 3. **staccato** — se anche la strada migliore resta scoperta per più di `maxVisibleTravelMm`,
 *    il filo si stacca. È il fallback graduato di R16: mai un passaggio visibile in silenzio.
 */
export interface RegionRuns { region: Region; runs: Polyline[]; }

/**
 * Cuce insieme le corse di un ago, nascondendo i passaggi.
 *
 * Le corse arrivano **già raggruppate per macchia**: sapere da dove viene una corsa costa zero,
 * mentre cercarlo con un punto-dentro-poligono costerebbe O(macchie) per ogni corsa — su un
 * lavoro grande sono 11.000 corse per 200 macchie, e diventerebbe il pezzo più lento di tutto.
 *
 * Le macchie si visitano a **catena minima** (R26): dalla fine di una alla più vicina fra quelle
 * che restano. Poi, fra una corsa e l'altra, tre casi in ordine:
 * 1. **dritto** — se il salto è corto e resta dentro la stessa macchia è il normale passo da una
 *    riga all'altra: non c'è niente da nascondere;
 * 2. **nascosto** — altrimenti si cerca la strada meno visibile con l'A*, cucita a passo di
 *    passaggio;
 * 3. **staccato** — se anche la strada migliore resta scoperta per più di `maxVisibleTravelMm`,
 *    il filo si stacca. È il fallback graduato di R16: mai un passaggio visibile in silenzio.
 */
export function routeColorRuns(
  groups: RegionRuns[],
  grid: CoverGrid,
  options: RoutingOptions = {},
): RoutedColor {
  const o = { ...DEF, ...options };
  const blocks: Polyline[] = [];
  let travelMm = 0, travelCoveredMm = 0, travelHorizontalMm = 0, jumps = 0;
  let routedMm = 0, routedCoveredMm = 0, straightCoveredMm = 0, routedHorizontalMm = 0;
  const vivi = groups.filter((g) => g.runs.length);
  if (!vivi.length) return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm };

  // Catena minima fra le macchie (R26): si va sempre alla più vicina che resta.
  const restano = [...vivi];
  const ordine: RegionRuns[] = [restano.shift()!];
  while (restano.length) {
    const ultima = ordine[ordine.length - 1];
    const coda = ultima.runs[ultima.runs.length - 1].slice(-1)[0];
    let best = 0, bestD = Infinity;
    for (let i = 0; i < restano.length; i++) {
      const d = distance(coda, restano[i].runs[0][0]);
      if (d < bestD) { bestD = d; best = i; }
    }
    ordine.push(restano.splice(best, 1)[0]);
  }

  let corrente: Point[] = [];
  let regCorrente: Region | null = null;

  for (const gruppo of ordine) {
    for (const run of gruppo.runs) {
      if (!corrente.length) {
        corrente = [...run];
        regCorrente = gruppo.region;
        continue;
      }
      const pen = corrente[corrente.length - 1];
      const meta = run[0];
      const dritto = distance(pen, meta);
      const stessaMacchia = regCorrente === gruppo.region;

      // 1. il normale passo da una riga all'altra
      if (stessaMacchia && dritto <= o.maxDirectMm && segmentoDentro(pen, meta, gruppo.region)) {
        corrente.push(...run);
        travelMm += dritto;
        travelCoveredMm += dritto * coveredFraction(pen, meta, grid);
        if (Math.abs(meta.y - pen.y) < Math.abs(meta.x - pen.x) * 0.3) travelHorizontalMm += dritto;
        continue;
      }

      // 2. la strada meno visibile
      const via = routeHidden(pen, meta, grid, o);
      if (via && via.length >= 2) {
        let lung = 0, scoperto = 0, orizz = 0;
        for (let k = 1; k < via.length; k++) {
          const d = distance(via[k - 1], via[k]);
          lung += d;
          scoperto += d * (1 - coveredFraction(via[k - 1], via[k], grid));
          if (Math.abs(via[k].y - via[k - 1].y) < Math.abs(via[k].x - via[k - 1].x) * 0.3) orizz += d;
        }
        if (scoperto <= o.maxVisibleTravelMm) {
          const cucito = resampleUniform(via, o.travelStitchMm);
          corrente.push(...cucito.slice(1), ...run);
          travelMm += lung; travelCoveredMm += lung - scoperto; travelHorizontalMm += orizz;
          // a parita' di passaggio: quanto sarebbe stato coperto andando dritti?
          routedMm += lung; routedCoveredMm += lung - scoperto; routedHorizontalMm += orizz;
          straightCoveredMm += lung * coveredFraction(pen, meta, grid);
          regCorrente = gruppo.region;
          continue;
        }
      }

      // 3. si stacca il filo: meglio un salto che un passaggio visibile (R16)
      blocks.push(corrente);
      corrente = [...run];
      jumps++;
    }
    regCorrente = gruppo.region;
  }
  if (corrente.length) blocks.push(corrente);
  return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm };
}

/** Il segmento resta dentro la macchia? (campionato: gli estremi non bastano) */
function segmentoDentro(a: Point, b: Point, r: Region): boolean {
  const n = Math.max(2, Math.ceil(distance(a, b) / 0.5));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (!pointInRegion(p, r)) return false;
  }
  return true;
}

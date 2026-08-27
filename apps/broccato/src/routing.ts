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
// Come funziona. Il filo di collegamento **costeggia sempre il contorno** della macchia, non
// taglia mai dentro il riempimento: se tagliasse, lì il filo sarebbe doppio e la densità non
// sarebbe più uniforme. Fra una macchia e l'altra si costeggia il contorno di **quella che viene
// dopo** — è ancora vergine, e il nero che passerà sui contorni la coprirà.
//
// *Prima c'era un A* su una mappa di costo che cercava la strada più nascosta.* Funzionava per
// nascondere, ma tagliava dentro il proprio riempimento, ed è il difetto che Lorenzo ha visto in
// anteprima. La mappa di costo resta, ma solo per MISURARE quanto i passaggi finiscono coperti.
//
// Resta locale all'app (deciso con Lorenzo): `covered-travel` nel core è la voce C8, e si promuove
// quando questo avrà passato la prova del ricamo vero.
//
// Nessun DOM.

import {
  type Point, type Polyline,
  distance, resampleUniform, routeAlongBorder, pointInPolygon,
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
  /** Sotto questa lunghezza, e restando dentro la regione, si va dritti senza cercare strade. */
  maxDirectMm?: number;
  /** Passo dei punti di passaggio (§3.1). */
  travelStitchMm?: number;
  /**
   * Oltre questo tratto il filo si stacca. **Dentro una macchia non si stacca MAI** (deciso da
   * Lorenzo: «il salto va sempre evitato, soprattutto negli oggetti unici»), quindi vale solo per
   * lo spostamento da una macchia all'altra, ed e' tenuto alto apposta: il giro sul contorno si
   * paga, il taglio del filo no.
   */
  maxVisibleTravelMm?: number;
}

const DEF: Required<RoutingOptions> = {
  cellMm: 1.5,
  maxDirectMm: 6,
  travelStitchMm: 3,
  maxVisibleTravelMm: 400,
};

// La soglia del salto e' alta apposta. Prima era 50mm, tarata sulla proporzione di salti del DST di
// riferimento; poi Lorenzo ha chiarito che **il salto va sempre evitato**, e che il giro sul
// contorno si paga comunque. Resta un ultimo appiglio per i casi impossibili, non una scelta.

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


// ------------------------------------------------------------
// Il passaggio che costeggia
// ------------------------------------------------------------


/** La cella che contiene un punto in mm. */
const cellOf = (p: Point, g: CoverGrid): number => {
  const c = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cellMm)));
  const r = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cellMm)));
  return r * g.cols + c;
};

/**
 * Il passaggio da `a` a `b` che **costeggia il contorno** della macchia, invece di tagliarci dentro.
 *
 * È la regola che Lorenzo ha corretto guardando l'anteprima, ed è tutta qui: il filo di
 * collegamento non attraversa mai il riempimento. Se attraversa, lì il filo è doppio, il ricamo si
 * ingrossa e la densità non è più uniforme — misurato prima della correzione: **il 42% del filo di
 * passaggio correva sopra il proprio riempimento**.
 *
 * `routeAlongBorder` del core fa esattamente questo e lo fa già per net-45: va al punto più vicino
 * sul contorno, lo percorre dalla parte più corta, e rientra. I fori valgono da vuoti (R5).
 *
 * **Su quale contorno.** Fra una macchia e l'altra si costeggia il contorno di **quella che viene
 * dopo**, non di quella che si lascia: quella nuova è ancora vergine (costeggiare quella già
 * cucita significherebbe sfiorarne il filo), e il nero che passerà dopo sui contorni lo coprirà.
 */
function passaggioSulContorno(a: Point, b: Point, r: Region, o: Required<RoutingOptions>): Polyline {
  return routeAlongBorder(a, b, r.outer, o.travelStitchMm, r.holes, 0);
}

/** Il segmento entra in un foro? (i fori sono vuoti: il filo non ci passa, R5) */
function attraversaFori(a: Point, b: Point, r: Region): boolean {
  if (!r.holes.length) return false;
  const n = Math.max(2, Math.ceil(distance(a, b) / 0.4));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    for (const h of r.holes) if (pointInPolygon(p, h)) return true;
  }
  return false;
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
  /**
   * I passaggi instradati, come polilinee a se'. Nei `blocks` sono cuciti dentro il filo continuo e
   * non si distinguono piu' (dopo il resample R4 hanno la stessa lunghezza di punto del
   * riempimento): serve tenerli da parte per poterli guardare e misurare — per esempio per sapere
   * quanto filo di passaggio finisce SOPRA il riempimento gia' cucito.
   */
  travels: Polyline[];
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
  const travels: Polyline[] = [];
  const vivi = groups.filter((g) => g.runs.length);
  if (!vivi.length) return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm, travels };

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

  const conta = (via: Polyline, dritto: boolean, pen: Point, meta: Point): void => {
    let lung = 0, coperto = 0, orizz = 0;
    for (let k = 1; k < via.length; k++) {
      const d = distance(via[k - 1], via[k]);
      lung += d;
      coperto += d * coveredFraction(via[k - 1], via[k], grid);
      if (Math.abs(via[k].y - via[k - 1].y) < Math.abs(via[k].x - via[k - 1].x) * 0.3) orizz += d;
    }
    travelMm += lung; travelCoveredMm += coperto; travelHorizontalMm += orizz;
    if (!dritto) {
      routedMm += lung; routedCoveredMm += coperto; routedHorizontalMm += orizz;
      straightCoveredMm += lung * coveredFraction(pen, meta, grid);
      travels.push(via);
    }
  };

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

      // 1. Il normale passo da una riga all'altra: corto, dentro la macchia, senza attraversare fori.
      if (stessaMacchia && dritto <= o.maxDirectMm && !attraversaFori(pen, meta, gruppo.region)
          && segmentoDentro(pen, meta, gruppo.region)) {
        corrente.push(...run);
        conta([pen, meta], true, pen, meta);
        continue;
      }

      // 2. Altrimenti si COSTEGGIA. Dentro la macchia si costeggia la sua; passando a una macchia
      //    nuova si costeggia quella nuova (è vergine, e il nero la coprirà).
      const via = passaggioSulContorno(pen, meta, gruppo.region, o);
      let scoperto = 0;
      for (let k = 1; k < via.length; k++) {
        scoperto += distance(via[k - 1], via[k]) * (1 - coveredFraction(via[k - 1], via[k], grid));
      }

      // 3. Il filo si stacca solo cambiando macchia, e solo se il giro è davvero fuori scala.
      //    Dentro una macchia non si stacca MAI.
      if (!stessaMacchia && scoperto > o.maxVisibleTravelMm) {
        blocks.push(corrente);
        corrente = [...run];
        regCorrente = gruppo.region;
        jumps++;
        continue;
      }

      const cucito = resampleUniform(via, o.travelStitchMm);
      const coda = cucito[cucito.length - 1];
      const attacco = distance(coda, run[0]) < 1e-9 ? run.slice(1) : run;
      corrente.push(...cucito.slice(1), ...attacco);
      conta(via, false, pen, meta);
      regCorrente = gruppo.region;
    }
    regCorrente = gruppo.region;
  }
  if (corrente.length) blocks.push(corrente);
  return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm, travels };
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

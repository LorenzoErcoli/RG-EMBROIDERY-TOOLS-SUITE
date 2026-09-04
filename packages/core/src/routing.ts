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

// **Promosso nel core il 2026-09-04** (voce C8 di STATO, «il grande assente»): il secondo cliente si
// è presentato — il Punto Pittorico, il cui primo DST vero in macchina aveva **15.449 salti** e
// **569 m di spostamenti a vuoto** contro 355 m di filo cucito, cioè novemila tagli. Lorenzo, in una
// riga: «abbiamo un intero sistema che ti spiega cosa sia il raso e come si comporta». Ce l'aveva, e
// questo file è quel sistema: R16 (nascondi se puoi, altrimenti paga un costo esplicito), R17 (il
// passaggio nascosto ha requisiti diversi), R18 (sotto ≠ aggira), R26 (catena minima, l'uscita di
// uno è l'ingresso del prossimo). Non andava riscritto: andava usato.

import type { Point, Polyline } from './types';
import type { Region } from './regions';
import { distance, pointInPolygon } from './geometry';
import { resampleUniform } from './stitch';
import { routeAlongBorder } from './travel';
import { NO_COLOR } from './quantize';
import { pointInRegion } from './regions';

/**
 * Quel poco che serve sapere di un ago per costruire la mappa di copertura: se **copre tutto il
 * foglio** (un fondo) e se **viene cucito** o è escluso. Basta questo — il resto (tinta, densità,
 * modo del punto) è roba del tool, non del passaggio.
 *
 * Sostituisce il tipo `BroccatoColor` che questo file importava dall'app quando ci viveva dentro:
 * era l'unica cosa che lo teneva legato a `apps/broccato`.
 */
export interface AgoInCopertura {
  /** Vero se questo ago copre tutto il foglio: se ne viene uno dopo, il passaggio è sempre nascosto. */
  base?: boolean;
  /** Vero se questo ago non viene cucito: non copre niente. */
  escluso?: boolean;
}

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
  /**
   * DOVE passa il filo quando non puo' andare dritto. Non e' una rifinitura: e' la differenza fra
   * due tecniche, e va scelta da chi chiama.
   *
   * - `'contorno'` (default, ed e' il broccato) — si costeggia il bordo della macchia. Li' il filo
   *   si vede meno, e comunque il nero dei contorni ci passera' sopra. Tagliare dentro il proprio
   *   riempimento raddoppierebbe il filo e romperebbe la densita': e' il difetto che Lorenzo aveva
   *   visto in anteprima.
   *
   * - `'interno'` (il Punto Pittorico) — **sul bordo non ci si va**, e si taglia dentro. Qui il
   *   bordo e' esattamente il posto peggiore: e' dove vive la frangia del degrade', e un filo che
   *   lo costeggia riempie i vuoti della sfumatura e la trasforma in una linea di contorno. E'
   *   quello che Lorenzo ha visto sul blu: *«il passaggio che troviamo al bordo farebbe una linea
   *   contorno e non fa sfumatura, soprattutto dove serve degrade'»*. Dentro, invece, il
   *   riempimento e' fitto e dello stesso colore: un filo in piu' fra centinaia non si vede.
   *
   * Il compromesso e' cosciente e va in direzione opposta per le due tecniche (R30): il broccato
   * paga un giro sul bordo per non toccare la densita', il pittorico paga un filo dentro per non
   * toccare la sfumatura.
   */
  viaPreferita?: 'contorno' | 'interno';
  /**
   * Solo per `'interno'`: quanto il passaggio deve stare **lontano dal bordo**. E' la larghezza
   * della banda intoccabile — la frangia. Zero vuol dire «basta stare dentro».
   */
  margineDalBordoMm?: number;
}

const DEF: Required<RoutingOptions> = {
  cellMm: 1.5,
  maxDirectMm: 6,
  travelStitchMm: 3,
  maxVisibleTravelMm: 400,
  viaPreferita: 'contorno',
  margineDalBordoMm: 0,
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
  colors: AgoInCopertura[],
  cellMm: number,
): CoverGrid {
  const cols = Math.max(1, Math.ceil((width * mmPerPx) / cellMm));
  const rows = Math.max(1, Math.ceil((height * mmPerPx) / cellMm));
  const kind = new Uint8Array(cols * rows).fill(CELL_BARE);

  // Un colore di BASE cucito dopo copre tutto il foglio: se ce n'è uno, il passaggio è sempre nascosto.
  let baseDopo = false;
  for (let j = colorIndex + 1; j < colors.length; j++) {
    if (colors[j].base) baseDopo = true;
  }
  if (baseDopo) { kind.fill(CELL_COVERED); return { cols, rows, cellMm, kind }; }

  const dopo = new Uint8Array(256);
  for (let j = colorIndex + 1; j < colors.length; j++) if (!colors[j].escluso) dopo[j] = 1;

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

/**
 * Il segmento sta dentro la macchia **con un margine**? Si prova un tubo di larghezza `2*margine`
 * attorno al segmento: se anche i due fianchi restano dentro, allora il segmento e' lontano dal
 * bordo almeno di quel margine. E' un test grossolano e volutamente prudente — costa tre
 * `pointInRegion` per campione invece di una distanza vera dal contorno, e sbaglia solo per
 * eccesso, cioe' rifiutando qualche passaggio buono. `pointInRegion` esclude gia' i fori (R5).
 */
function corridoioDentro(a: Point, b: Point, r: Region, margineMm: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, lung = Math.hypot(dx, dy);
  if (lung < 1e-9) return pointInRegion(a, r);
  const nx = -dy / lung, ny = dx / lung;
  const n = Math.max(4, Math.ceil(lung / 0.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = a.x + dx * t, py = a.y + dy * t;
    if (!pointInRegion({ x: px, y: py }, r)) return false;
    if (margineMm > 0) {
      if (!pointInRegion({ x: px + nx * margineMm, y: py + ny * margineMm }, r)) return false;
      if (!pointInRegion({ x: px - nx * margineMm, y: py - ny * margineMm }, r)) return false;
    }
  }
  return true;
}

/**
 * Spinge DENTRO un passaggio che sfiora il bordo.
 *
 * Punto per punto ci si chiede una cosa sola: *questo punto e' abbastanza dentro?* La risposta si
 * prova invece di calcolarla — si guarda di lato, di `margine`, da una parte e dall'altra della
 * strada. Se tutte e due le parti sono dentro la macchia, il punto e' gia' in mezzo e non si tocca.
 * Se una sola e' dentro, il punto sta a meno di `margine` dal bordo e lo si sposta da quella parte.
 * Se nessuna delle due regge — un collo stretto, una punta — resta dov'e': meglio un tratto che
 * torna sul bordo di un tratto che esce dalla macchia.
 *
 * Cosi' si comporta bene con qualunque strada, anche col segmento dritto: quello che gia' passa nel
 * folto non si allunga di un millimetro, e solo quello che rasenta il bordo si scosta. La prima
 * versione spostava tutti i punti sempre, e su una strada gia' buona non nascondeva niente — la
 * allungava e basta: 91 m di passaggi diventavano 152.
 *
 * Gli estremi non si toccano mai: sono i capi delle corse, e il filo deve restare attaccato.
 */
function scostaDalBordo(via: Polyline, r: Region, margineMm: number): Polyline {
  if (margineMm <= 0 || via.length < 3) return via;
  const out: Point[] = [via[0]];
  for (let i = 1; i < via.length - 1; i++) {
    const a = via[i - 1], b = via[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, lung = Math.hypot(dx, dy);
    if (lung < 1e-9) { out.push(via[i]); continue; }
    const nx = -dy / lung, ny = dx / lung;
    const uno = { x: via[i].x + nx * margineMm, y: via[i].y + ny * margineMm };
    const due = { x: via[i].x - nx * margineMm, y: via[i].y - ny * margineMm };
    const dentroUno = pointInRegion(uno, r), dentroDue = pointInRegion(due, r);
    if (dentroUno && dentroDue) out.push(via[i]);          // gia' in mezzo: fermo
    else if (dentroUno) out.push(uno);
    else if (dentroDue) out.push(due);
    else out.push(via[i]);                                  // non c'e' spazio: resta
  }
  out.push(via[via.length - 1]);
  return out;
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
   * Quante volte, e per quanti mm, si è preso ognuno dei tre casi. Non è statistica: è l'unico modo
   * per sapere PERCHÉ un colore paga i passaggi che paga, invece di indovinarlo. Sul pittorico ha
   * detto in una riga che il filo sul bordo non veniva dalle strade lunghe.
   */
  perCaso: { dritto: Caso; interno: Caso; contorno: Caso };
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
export interface Caso { volte: number; mm: number; }

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
  const perCaso = { dritto: { volte: 0, mm: 0 }, interno: { volte: 0, mm: 0 }, contorno: { volte: 0, mm: 0 } };
  let routedMm = 0, routedCoveredMm = 0, straightCoveredMm = 0, routedHorizontalMm = 0;
  const travels: Polyline[] = [];
  const vivi = groups.filter((g) => g.runs.length);
  if (!vivi.length) return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm, travels, perCaso };

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

      /*
       * 0. IL PASSO PIU' CORTO DI UN PUNTO non si instrada: si fa e basta.
       *
       * Il contorno di una macchia nata da un'immagine e' una scalinata di pixel, e la corda fra
       * due capi vicini taglia lo scalino: `segmentoDentro` risponde "fuori" per una frazione di
       * pixel, e si finisce a costeggiare. Costeggiare per un saltino di tre decimi di millimetro
       * vuol dire percorrere il contorno — e infatti sul Punto Pittorico erano **463 giri per 5,1 m
       * su 6,6 m di passaggi totali**, tutti appoggiati sul bordo: la linea di contorno che si
       * vedeva sul degrade' nasceva li', non dalle strade lunghe.
       *
       * Sotto la lunghezza di un punto non c'e' niente da nascondere e niente da aggirare: un
       * segmento cosi' non e' un passaggio, e' il giro del pettine.
       */
      if (dritto <= o.travelStitchMm) {
        corrente.push(...run);
        conta([pen, meta], true, pen, meta);
        perCaso.dritto.volte++; perCaso.dritto.mm += dritto;
        continue;
      }

      // 1. Il normale passo da una riga all'altra: corto, dentro la macchia, senza attraversare fori.
      if (stessaMacchia && dritto <= o.maxDirectMm && !attraversaFori(pen, meta, gruppo.region)
          && segmentoDentro(pen, meta, gruppo.region)) {
        corrente.push(...run);
        conta([pen, meta], true, pen, meta);
        perCaso.dritto.volte++; perCaso.dritto.mm += dritto;
        continue;
      }

      // 1bis. Via INTERNA: se il segmento resta dentro la macchia si va dritti, a qualunque
      //       lunghezza — e' la strada piu' corta E la piu' innocua, perche' passa dove il
      //       riempimento e' fitto e dello stesso colore. Poi la si spinge dentro: se corre nel
      //       folto non si muove, se rasenta il bordo si scosta. Il margine NON entra in questa
      //       decisione, solo nella correzione: chiederlo qui rifiuterebbe strade buone e
      //       rimanderebbe a costeggiare, che e' il posto peggiore (misurato: da 62 a 139 m).
      if (o.viaPreferita === 'interno' && stessaMacchia
          && corridoioDentro(pen, meta, gruppo.region, 0)) {
        const dritti = scostaDalBordo(
          resampleUniform([pen, meta], o.travelStitchMm), gruppo.region, o.margineDalBordoMm);
        corrente.push(...dritti.slice(1), ...run.slice(1));
        conta(dritti, false, pen, meta);
        perCaso.interno.volte++;
        for (let z = 1; z < dritti.length; z++) perCaso.interno.mm += distance(dritti[z - 1], dritti[z]);
        continue;
      }

      // 2. Altrimenti si COSTEGGIA. Dentro la macchia si costeggia la sua; passando a una macchia
      //    nuova si costeggia quella nuova (è vergine, e il nero la coprirà). Con `'interno'` la
      //    strada si stacca poi dal bordo del margine chiesto: costeggiare resta l'ultima risorsa,
      //    ma non deve appoggiarsi proprio sulla frangia.
      const contorno = passaggioSulContorno(pen, meta, gruppo.region, o);
      // Con `'interno'` anche la strada di ripiego si scosta: prima si infittisce ai punti di
      // cucitura, perche' e' li' che si decide punto per punto se c'e' spazio per stare piu' dentro.
      const via = o.viaPreferita === 'interno'
        ? scostaDalBordo(resampleUniform(contorno, o.travelStitchMm), gruppo.region, o.margineDalBordoMm)
        : contorno;
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
      perCaso.contorno.volte++;
      for (let z = 1; z < via.length; z++) perCaso.contorno.mm += distance(via[z - 1], via[z]);
      regCorrente = gruppo.region;
    }
    regCorrente = gruppo.region;
  }
  if (corrente.length) blocks.push(corrente);
  return { blocks, travelMm, travelCoveredMm, travelHorizontalMm, jumps, routedMm, routedCoveredMm, straightCoveredMm, routedHorizontalMm, travels, perCaso };
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

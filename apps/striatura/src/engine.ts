// Motore "Punto Striato" — striature verticali che formano MACCHIE MACULATE (blob discreti) su una
// BASE di riempimento parallelo RADO, con FRASTAGLIO e percorso a SERPENTINA. Fedele al DST di Lorenzo
// (PUNTO-STRIATURA.dst: punto ~1.9mm, tutto verticale). Un unico filo continuo (mono ora; output a layer
// per il multicolore futuro).
//
// Locale all'app (regole di crescita 1-2): si promuove nel core solo quando un 2° tool lo chiederà.
//
// Vincoli di dominio (Costituzione):
// - nessun segmento entra in un'area vuota (void, R5) né esce dal bordo, con clearance (R5/R7);
// - il passo del punto sta in [minStitchMm, maxStitchMm] (R3/R4) — il min si impone DOPO il routing (R3, in pipeline);
// - il filo si disegna sottile (R15): lo spessore reale è nella densità delle striature, non nello stroke.
//
// STRUTTURA (decisa con Lorenzo, 2026-07-31, dopo la 1ª prova):
// - la MACCHIA è un GRAPPOLO DI STRIATURE (trattini distinti), NON un riempimento pieno;
// - lo SPOSTAMENTO tra le macchie è RIEMPIMENTO PARALLELO CONTINUO (niente salti): il filo resta cucito
//   e si confonde con la base (regola 1, filo continuo).
// Realizzazione: SERPENTINA A RIGHE (come il DST: riga → giù → riga). Ogni cella (colonna × riga) è UNA
// striatura; fitta nelle macchie (passo `densitySpacingMm`), rada tra le macchie (una colonna ogni
// `fillSpacingMm`). Le celle sono collegate da tragitti verticali corti (running) = il riempimento che
// collega → un unico filo, salti solo se un tragitto uscirebbe/entrerebbe nel vuoto (R5, raro).
//
// RICAMO SOPRA (Lorenzo, 2026-11-03): le zone dove dopo verrà cucita un'altra grafica non sono aree vuote. Le
// striature sono disegnate come sempre e non guardano le zone («non deve notarsi»): si tolgono solo quelle del tutto
// nascoste, e il filo si sposta da un gruppo di trattini al prossimo sempre sotto le zone, una fascia dopo l'altra
// (`cuciSottoLeZone`; Lorenzo, 2026-11-05: «deve passare sempre sotto la macchia», «si passa a lavorare a zone»).
//
// MOTIVO DELLA STRIATURA (`stitchMode`):
// - 'retrace' (DEFAULT): dal centro su e torna, giù e torna → trattino marcato (ciò che vuole Lorenzo);
// - 'boustrophedon': passata singola (più magra). Scelta di stile (R30), da valutare a occhio.
//
// NOTA: puro TS (niente DOM) → testabile in Node come interlace/bitmap. Riceve contorni GIÀ parsati.
import {
  type Point, type Polyline,
  distanceToBoundary,
} from '@rg/core';

/** Parametri del generatore. App-locali; nomi canonici §3 dove il concetto esiste già. */
export interface StriaturaParams {
  realWidthMm: number;       // §3.4 — larghezza reale della sagoma (0 = usa la misura letta)
  minStitchMm: number;       // §3.1 R3 — lunghezza minima del punto (dopo il routing)
  maxStitchMm: number;       // §3.1 R4 — passo del punto LUNGO la striatura (~2 mm)
  // --- densità: spaziatura TRASVERSALE (R22/R30), fitta nelle macchie, rada nel riempimento ---
  densitySpacingMm: number;  // §3.7 R22 — passo colonne DENTRO la macchia (spostamento orizz. striature)
  fillSpacingMm: number;     // passo colonne del riempimento parallelo (rado) — app-locale
  passaggioAmpMm: number;    // ampiezza (altezza) del raso di passaggio tra le macchie: piccola = meno invadente
  travelStitchMm: number;    // §3.1 — punto nei tragitti/spostamenti (usato in pipeline per il resample)
  voidClearanceMm: number;   // §3.2 R5/R7 — distanza minima da bordi e aree vuote
  // --- stile macchia + frastaglio (generativi) ---
  striaturaLengthMm: number; // lunghezza di una striatura (altezza della riga/trattino)
  blobSizeMm: number;        // grandezza delle macchie: comanda anche il trattino, sotto la misura di serie
  blobVariationPct: number;  // quanto variano fra piccole e grandi (±%): 0 = tutte uguali
  blobSpacingMm: number;     // distanza tra una macchia e l'altra
  jaggedLengthMm: number;    // frastaglio: variazione di lunghezza delle striature
  jaggedStartMm: number;     // frastaglio: sfasamento verticale delle partenze (non allineate)
  // --- movimento: onda che fa ondulare le fasce orizzontali (0 = fasce dritte) ---
  waveAmpMm: number;         // ampiezza dell'onda (quanto si muovono le fasce su/giù); 0 = niente movimento
  waveLenMm: number;         // lunghezza d'onda (ogni quanti mm si ripete l'ondulazione)
  coverMarginMm: number;     // i passaggi stanno a questa distanza dal bordo del ricamo che li coprirà
  coverOverlapMm: number;    // per la ricentratura: i trattini restano interi fin qui dentro la zona; più in fondo non si cuciono
  stopZones: number;         // col ricamo sopra si cuce a fasce, una dopo l'altra, l'ordine è libero dentro la fascia; 1 = nessuna divisione
  stopZonesDirection: 'orizzontale' | 'verticale'; // orizzontale = dall'alto in basso; verticale = da sinistra a destra
  stitchMode: 'boustrophedon' | 'retrace'; // vedi sopra: default retrace (dal centro su/giù e torna)
  seed: number;              // "Variante": disposizione ricreabile (deterministica)
  // --- colore (mono ora; multicolore in futuro → l'output è già a layer) ---
  color: string;             // filo unico
}

export const defaultStriaturaParams: StriaturaParams = {
  realWidthMm: 0,
  minStitchMm: 1.0,
  maxStitchMm: 2.0,          // punto ~1.9 mm misurato nel DST di riferimento
  densitySpacingMm: 0.6,     // macchia fitta (misurato 0.4–0.8)
  fillSpacingMm: 8.0,        // passaggi MOLTO radi / fasce ampie: il routing collega le macchie (Lorenzo)
  passaggioAmpMm: 10,        // ampiezza del raso di passaggio (piccola = meno invadente)
  travelStitchMm: 3.0,
  voidClearanceMm: 0.5,
  striaturaLengthMm: 18,     // lunghezza trattino (righe ~15–25 mm nel DST)
  blobSizeMm: 22,            // macchie a foglia, dimensione media
  blobVariationPct: 50,      // era fisso nel codice: da 0,6 a 1,8 volte la grandezza
  blobSpacingMm: 5,          // ravvicinate → copertura più omogenea (poi jitter per l'irregolarità)
  jaggedLengthMm: 8,
  jaggedStartMm: 4,
  waveAmpMm: 0,              // 0 = fasce dritte; alza per dare movimento (ondulazione)
  waveLenMm: 80,
  coverMarginMm: 1,
  coverOverlapMm: 3,
  stopZones: 3,
  stopZonesDirection: 'orizzontale',
  stitchMode: 'retrace',
  seed: 1,
  color: '#1a1a1a',
};

/** Un layer di output del motore (un filo = una passata). Mono ora; lista → multicolore futuro. */
export interface StriaturaLayer {
  color: string;
  polylines: Polyline[];
  /** I passaggi fra le macchie (già dentro `polylines`): servono solo a misurarli e a mostrarli. */
  passaggi?: Polyline[];
}

/** Contorni d'ingresso già parsati: perimetro (area) + eventuali vuoti (R5). */
export interface StriaturaInput {
  outline: Polyline;     // perimetro esterno dell'area da ricamare (mm, chiuso o quasi)
  voids: Polyline[];     // aree vuote interne (R5)
  /** Dove dopo verrà cucita un'altra grafica: lì il ricamo continua e i passaggi corrono liberi. */
  coperte?: Polyline[];
}

// ------------------------------------------------------------------ utilità pure

/** RNG deterministico mulberry32 (portato dallo stile di bitmap): stesso seed → stesso pattern. */
function mulberry32(seed: number): () => number {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number; }
function bboxOf(poly: Polyline): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

type Interval = [number, number];

/**
 * Intervalli [y0,y1] in cui la retta verticale x è DENTRO il poligono (regola even-odd).
 * Il poligono è trattato come chiuso (ultimo→primo). Regola di crossing semi-aperta per non
 * contare due volte i vertici.
 */
function verticalIntervals(x: number, poly: Polyline): Interval[] {
  const ys: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ax = a.x, bx = b.x;
    if ((ax <= x && bx > x) || (bx <= x && ax > x)) {
      const t = (x - ax) / (bx - ax);
      ys.push(a.y + t * (b.y - a.y));
    }
  }
  ys.sort((p, q) => p - q);
  const out: Interval[] = [];
  for (let k = 0; k + 1 < ys.length; k += 2) out.push([ys[k], ys[k + 1]]);
  return out;
}

/** Sottrae gli intervalli `holes` da un intervallo base. Ritorna i pezzi rimasti. */
function subtractIntervals(base: Interval, holes: Interval[]): Interval[] {
  let segs: Interval[] = [base];
  for (const h of holes) {
    const next: Interval[] = [];
    for (const [s, e] of segs) {
      if (h[1] <= s || h[0] >= e) { next.push([s, e]); continue; }
      if (h[0] > s) next.push([s, Math.min(h[0], e)]);
      if (h[1] < e) next.push([Math.max(h[1], s), e]);
    }
    segs = next;
  }
  return segs;
}

// ------------------------------------------------------------------ macchie (blob)

// Macchia = FOGLIA/LENTE verticale: all'altezza y la semi-larghezza si assottiglia verso i lati
// (ingresso piccolo → corpo grande → uscita piccola). `halfW`/`halfH` (variabili) danno la variazione
// di dimensione; `sharp` la punta; `amp`/`phase` un frastaglio del bordo.
interface Blob { cx: number; cy: number; halfW: number; halfH: number; sharp: number; amp: number; phase: number; }

function insideOutline(x: number, y: number, outline: Polyline): boolean {
  const iv = verticalIntervals(x, outline);
  for (const [a, b] of iv) if (y >= a && y <= b) return true;
  return false;
}

function inAnyBlob(x: number, y: number, blobs: Blob[]): boolean {
  for (const b of blobs) {
    const dx = (x - b.cx) / b.halfW;
    if (dx <= -1 || dx >= 1) continue;           // fuori dalla larghezza → salta
    const t = 1 - Math.abs(dx);                  // 1 al centro, 0 ai lati (punta = beccuccio laterale)
    let hAllow = b.halfH * Math.pow(t, b.sharp); // profilo a foglia: alto al centro, corto ai bordi
    hAllow *= 1 + b.amp * Math.sin(0.5 * y + b.phase); // frastaglio del bordo
    if (Math.abs(y - b.cy) < hAllow) return true;
  }
  return false;
}

/**
 * Sparge le macchie su una GRIGLIA JITTERATA (copertura più omogenea: niente aree troppo vuote, ma non
 * regolare). Ogni macchia è una foglia verticale con dimensione MOLTO variabile (piccola↔grande), più alta
 * che larga. Le celle il cui centro cade fuori dalla sagoma sono saltate.
 */
function scatterBlobs(outline: Polyline, bb: BBox, p: StriaturaParams, rng: () => number): Blob[] {
  const blobs: Blob[] = [];
  const base = Math.max(2, p.blobSizeMm);
  const pitch = base + Math.max(0, p.blobSpacingMm);   // passo della griglia
  const nx = Math.max(1, Math.ceil(bb.w / pitch));
  const ny = Math.max(1, Math.ceil(bb.h / pitch));
  const jit = pitch * 0.34;                             // spostamento casuale del centro (irregolarità)
  for (let gy = 0; gy < ny; gy++) {
    for (let gx = 0; gx < nx; gx++) {
      const cx = bb.minX + (gx + 0.5) * pitch + (rng() * 2 - 1) * jit;
      const cy = bb.minY + (gy + 0.5) * pitch + (rng() * 2 - 1) * jit;
      if (!insideOutline(cx, cy, outline)) continue;
      // variazione (piccole↔grandi) attorno a 1,2 volte la grandezza: con ±50% va da 0,6 a 1,8
      const halfH = base * 0.5 * 1.2 * (1 + (rng() * 2 - 1) * (Math.max(0, Math.min(100, p.blobVariationPct)) / 100));
      const halfW = halfH * (0.4 + rng() * 0.32);        // più alta che larga (foglia)
      blobs.push({ cx, cy, halfW, halfH, sharp: 0.65 + rng() * 0.25, amp: 0.10 + rng() * 0.10, phase: rng() * 6.283 });
    }
  }
  return blobs;
}

// ------------------------------------------------------------------ la macchia comanda
//
// La macchia è fatta di trattini e sta su righe alte un trattino: con la sola grandezza si stringeva ma i
// trattini restavano da 18 mm. Misurato il 2026-11-03, con la grandezza a 8 invece di 22: macchie alte 46 mm
// invece di 91, ma trattini ancora da 17 mm. Ora sotto i 22 mm scalano con la macchia i trattini, il frastaglio e
// l'altezza dei passaggi: a 8 mm macchie alte 21 mm, trattini da 6,4. La distanza fra i passaggi NON scala: provato,
// faceva una greca su tutto il campo (4,3 m di passaggi contro 3,1 sul rettangolo di prova).
// A 22 mm il rapporto vale 1: con 22 o più il ricamo è identico a prima.

// per uscire da una tasca fra i trattini: al massimo ~5 mm attraverso il cucito, verso un corridoio di almeno ~10 mm²
const USCITA_CELLE = 6;
const CORRIDOIO_CELLE = 16;

/** Le misure con cui si cuce davvero: il trattino non è mai più lungo di quanto la macchia consente. */
export function misureEffettive(p: StriaturaParams): StriaturaParams {
  const trattino = Math.min(p.striaturaLengthMm, Math.max(2, p.blobSizeMm) * 18 / 22);
  const k = trattino / p.striaturaLengthMm;
  if (k >= 1) return p;
  return {
    ...p,
    striaturaLengthMm: trattino,
    jaggedLengthMm: p.jaggedLengthMm * k,
    jaggedStartMm: p.jaggedStartMm * k,
    passaggioAmpMm: p.passaggioAmpMm * k,
  };
}

// ------------------------------------------------------------------ cucitura

/** Intervalli verticali ricamabili al column x: dentro il perimetro, meno i vuoti, meno la clearance. */
function embroiderableAt(x: number, outline: Polyline, voids: Polyline[], clr: number, minLen: number): Interval[] {
  let iv = verticalIntervals(x, outline);
  for (const v of voids) {
    const vv = verticalIntervals(x, v);
    if (vv.length) iv = iv.flatMap((seg) => subtractIntervals(seg, vv));
  }
  return iv
    .map(([a, b]) => [a + clr, b - clr] as Interval)
    .filter(([a, b]) => b - a > minLen);
}

/** L'intervallo ricamabile al column x che CONTIENE y (o null). */
function intervalContaining(
  x: number, y: number, outline: Polyline, voids: Polyline[], clr: number, minLen: number,
): Interval | null {
  for (const [a, b] of embroiderableAt(x, outline, voids, clr, minLen)) {
    if (y >= a && y <= b) return [a, b];
  }
  return null;
}

/** Aggiunge a `pts` i punti da fromY (escluso) a toY (incluso) al passo ~step, sul column x.
 *  `ceil` → nessun segmento supera mai `step` (punti mai troppo lunghi, richiesta di Lorenzo). */
function pushSeg(pts: Point[], x: number, fromY: number, toY: number, step: number): void {
  const d = Math.abs(toY - fromY);
  const n = Math.max(1, Math.ceil(d / step));
  for (let k = 1; k <= n; k++) pts.push({ x, y: fromY + (toY - fromY) * (k / n) });
}

/** Aggiunge a `pts` un tragitto RETTO da `a` (escluso) a `b` (incluso), campionato a `step` (`ceil`). */
function pushTravel(pts: Point[], a: Point, b: Point, step: number): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d / step));
  for (let k = 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) });
}

/**
 * Aggiunge a `pts` una strada a più tratti (`strada[0]` escluso), coi punti uguali distribuiti su tutta la lunghezza.
 * Punto per punto, ogni svolta lasciava un punto corto che il punto minimo univa al vicino: fino a 3,7 mm con 3 chiesti.
 */
function pushStrada(pts: Point[], strada: Point[], step: number): void {
  let lung = 0;
  for (let i = 1; i < strada.length; i++) lung += Math.hypot(strada[i].x - strada[i - 1].x, strada[i].y - strada[i - 1].y);
  const n = Math.max(1, Math.ceil(lung / step));
  let i = 1, fatti = 0;
  for (let k = 1; k <= n; k++) {
    const dove = (lung * k) / n;
    while (i < strada.length - 1 && fatti + Math.hypot(strada[i].x - strada[i - 1].x, strada[i].y - strada[i - 1].y) < dove) {
      fatti += Math.hypot(strada[i].x - strada[i - 1].x, strada[i].y - strada[i - 1].y);
      i++;
    }
    const a = strada[i - 1], b = strada[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const t = d > 0 ? Math.min(1, (dove - fatti) / d) : 1;
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

/**
 * UNA striatura (cella colonna×riga): trattino verticale col frastaglio, centrato su `c` e limitato a
 * [lo,hi]. `retrace` = dal centro su e torna, giù e torna (entra/esce al centro). `boustrophedon` = passata
 * singola. Ritorna i punti (entry = pts[0], exit = ultimo).
 */
function striaturaCell(
  x: number, c: number, lo: number, hi: number, dir: number, p: StriaturaParams, rng: () => number,
): Point[] | null {
  const half = p.striaturaLengthMm / 2;
  const up = half + (rng() * 2 - 1) * p.jaggedLengthMm * 0.5;
  const dn = half + (rng() * 2 - 1) * p.jaggedLengthMm * 0.5;
  const cc = c + (rng() * 2 - 1) * p.jaggedStartMm;
  const top = Math.max(lo, cc - up);
  const bot = Math.min(hi, cc + dn);
  if (bot - top < p.minStitchMm) return null;
  const step = Math.max(p.minStitchMm, p.maxStitchMm);
  if (p.stitchMode === 'retrace') {
    const m = Math.min(Math.max(cc, top), bot); // centro dentro [top,bot]
    const pts: Point[] = [{ x, y: m }];
    pushSeg(pts, x, m, top, step); // centro → su
    pushSeg(pts, x, top, m, step); // → torna al centro
    pushSeg(pts, x, m, bot, step); // centro → giù
    pushSeg(pts, x, bot, m, step); // → torna al centro
    return pts;
  }
  // boustrophedon: passata singola, verso alternato
  const s = dir > 0 ? top : bot;
  const e = dir > 0 ? bot : top;
  const pts: Point[] = [{ x, y: s }];
  pushSeg(pts, x, s, e, step);
  return pts;
}

interface TrattinoRaccolto { pts: Point[]; x: number; col: number; riga: number; }
interface GrigliaZone {
  bb: BBox; cella: number; gcols: number; grows: number;
  gIdx: (x: number, y: number) => number;
  insideCell: Uint8Array; coperta: Uint8Array; profonda: Uint8Array;
}
interface Trattino { pts: Point[]; x: number; col: number; riga: number; y0: number; y1: number; }
/** Una fila di trattini vicini della stessa riga: si cuce d'un fiato, e il filo entra ed esce dai suoi due capi. */
interface Fila { trattini: Trattino[]; }

// Quanto costa un millimetro di passaggio: sotto una zona quasi niente, perché il filo deve stare lì. Lorenzo, 2026-11-05, su
// una linea in vista fra due zone: «linee che passano così in mezzo sono inaccettabili, deve passare sempre sotto la macchia».
// A 0,9 si contava soprattutto che il passaggio fosse corto (e sotto una zona era corto ma non nascosto). Quanto sia lungo
// lì sotto non si vede: a lavoro finito conta solo quello che resta fuori.
const COSTO_SOTTO = 0.05;
const COSTO_SOPRA_TRATTINI = 30;
const CANDIDATE_VICINE = 12;
const PASSAGGIO_COSTOSO = 15;
const PASSAGGIO_MOLTO_COSTOSO = 60;
// il filo può uscire dalla sua fascia di poco: quanto basta per un trattino a cavallo del confine
const MARGINE_FASCIA = 12;

/** Una coda che dà sempre per prima la cella col costo più basso. */
function codaMinima() {
  const v: { idx: number; f: number }[] = [];
  const scambia = (i: number, j: number) => { const x = v[i]; v[i] = v[j]; v[j] = x; };
  return {
    vuota: () => v.length === 0,
    metti(idx: number, f: number) {
      v.push({ idx, f });
      for (let i = v.length - 1; i > 0;) { const m = (i - 1) >> 1; if (v[m].f <= v[i].f) break; scambia(m, i); i = m; }
    },
    togli() {
      const testa = v[0];
      const ultimo = v.pop()!;
      if (v.length) {
        v[0] = ultimo;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < v.length && v[l].f < v[m].f) m = l;
          if (r < v.length && v[r].f < v[m].f) m = r;
          if (m === i) break;
          scambia(m, i); i = m;
        }
      }
      return testa;
    },
  };
}

/**
 * L'ordine delle file. Scegliere ogni volta la più conveniente lascia indietro delle file isolate, e alla fine ci
 * vuole un passaggio di 382 mm per tornarci (misurato il 2026-11-03). Dopo la prima scelta si sistema: una fila (o
 * due, tre di seguito) si sposta dove costa meno, e un pezzo di sequenza si rovescia quando elimina due passaggi lunghi.
 */
function ordinaFile(n: number, costo: (a: number, b: number) => number, distanza: (a: number, b: number) => number, primo: number): number[] {
  if (n === 1) return [0];
  const vicini: number[][] = [];
  for (let a = 0; a < n; a++) {
    const tutti: { b: number; d: number }[] = [];
    for (let b = 0; b < n; b++) if (b !== a) tutti.push({ b, d: distanza(a, b) });
    tutti.sort((p, q) => p.d - q.d);
    vicini.push(tutti.slice(0, CANDIDATE_VICINE).map((v) => v.b));
  }
  const ordine: number[] = [primo];
  const fatta = new Uint8Array(n); fatta[primo] = 1;
  for (let cur = primo; ordine.length < n;) {
    let scelta = -1, meglio = Infinity;
    for (const b of vicini[cur]) if (!fatta[b]) { const c = costo(cur, b); if (c < meglio) { meglio = c; scelta = b; } }
    if (scelta < 0) for (let b = 0; b < n; b++) if (!fatta[b]) { const d = distanza(cur, b); if (d < meglio) { meglio = d; scelta = b; } }
    fatta[scelta] = 1; ordine.push(scelta); cur = scelta;
  }
  const dove = new Int32Array(n);
  const aggiorna = () => { for (let i = 0; i < n; i++) dove[ordine[i]] = i; };
  aggiorna();
  const c = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? 0 : costo(a, b));
  for (let passata = 0; passata < 6; passata++) {
    let cambiato = false;
    // sposta 1, 2 o 3 file di seguito accanto a una loro vicina
    for (let lung = 1; lung <= 3; lung++) {
      for (let i = 0; i + lung <= n; i++) {
        const s = ordine[i], e = ordine[i + lung - 1], p = ordine[i - 1], x = ordine[i + lung];
        const via = c(p, s) + c(e, x) - c(p, x);
        if (via < 1) continue;
        let meglioGain = 0.5, dopoDi = -1, rovescia = false;
        for (const v of [...vicini[s], ...vicini[e]]) {
          const j = dove[v];
          if (j >= i && j < i + lung) continue;
          const w = ordine[j + 1];
          if (j + 1 === i) continue;
          const dritto = via - (c(v, s) + c(e, w) - c(v, w));
          const girato = via - (c(v, e) + c(s, w) - c(v, w));
          if (dritto > meglioGain) { meglioGain = dritto; dopoDi = j; rovescia = false; }
          if (girato > meglioGain) { meglioGain = girato; dopoDi = j; rovescia = true; }
        }
        if (dopoDi < 0) continue;
        const pezzo = ordine.splice(i, lung);
        if (rovescia) pezzo.reverse();
        ordine.splice(dopoDi < i ? dopoDi + 1 : dopoDi + 1 - lung, 0, ...pezzo);
        aggiorna();
        cambiato = true;
      }
    }
    // rovescia un pezzo quando elimina due passaggi lunghi
    for (let i = 0; i < n - 1; i++) {
      // un passaggio già costoso può guardare tutte le file, non solo le vicine
      const lungo = c(ordine[i], ordine[i + 1]) > PASSAGGIO_COSTOSO;
      for (const b of lungo ? ordine.slice(i + 2) : vicini[ordine[i]]) {
        const j = dove[b];
        if (j <= i + 1) continue;
        const a = ordine[i], a1 = ordine[i + 1], b1 = ordine[j + 1];
        // più costosa del passaggio da togliere di solito non migliora: non si calcola nemmeno (`distanza` è al quadrato).
        // I passaggi molto costosi, pochi e i più brutti, guardano tutto lo stesso.
        if (lungo && c(a, a1) < PASSAGGIO_MOLTO_COSTOSO && Math.sqrt(distanza(a, b)) >= c(a, a1)) continue;
        if (c(a, b) + c(a1, b1) < c(a, a1) + c(b, b1) - 0.5) {
          for (let l = i + 1, r = j; l < r; l++, r--) { const t = ordine[l]; ordine[l] = ordine[r]; ordine[r] = t; }
          aggiorna();
          cambiato = true;
          break;
        }
      }
    }
    if (!cambiato) break;
  }
  return ordine;
}

/**
 * IL CUCITO CON LE ZONE (Lorenzo, 2026-11-03: «riempie solo quegli spazi e poi fa i passaggi sotto le altre macchie…
 * la striatura deve comunque un po' entrare dentro la macchia e non essere disegnata rispetto alle macchie superiori…
 * non deve notarsi»). I trattini sono quelli di sempre e restano interi; cade solo chi sta tutto più in fondo di
 * `coverOverlapMm`. Poi, invece della serpentina, si cuce fila per fila, fascia per fascia, scegliendo l'ordine che
 * lascia meno filo in vista: il capo di un trattino che entra sotto una zona è il posto da cui uscire senza farsi vedere.
 */
function cuciSottoLeZone(
  raccolti: TrattinoRaccolto[], g: GrigliaZone, forbidden: (a: Point, b: Point) => boolean, params: StriaturaParams, passo: number, distanzaBordo: number,
): { polylines: Polyline[]; passaggi: Polyline[] } {
  const { gcols, grows, gIdx, insideCell, coperta, profonda, cella, bb } = g;
  const tenuti = raccolti.filter((t) => t.pts.some((q) => !profonda[gIdx(q.x, q.y)]));

  // i passaggi stanno lontani dal bordo e dai vuoti come il ricamo (R5, R7): si tolgono alle celle interne gli anelli
  // esterni. Senza, una cella col centro esattamente sul bordo faceva cucire sul bordo (trovato dallo smoke test).
  let percorribile = insideCell;
  for (let anello = 0; anello < Math.max(1, Math.ceil(distanzaBordo / cella)); anello++) {
    const prec = percorribile, dopo = new Uint8Array(gcols * grows);
    for (let gy = 1; gy < grows - 1; gy++) {
      for (let gx = 1; gx < gcols - 1; gx++) {
        const i = gy * gcols + gx;
        dopo[i] = prec[i] && prec[i - 1] && prec[i + 1] && prec[i - gcols] && prec[i + gcols] ? 1 : 0;
      }
    }
    percorribile = dopo;
  }

  const conSpan: Trattino[] = tenuti.map((t) => {
    let y0 = t.pts[0].y, y1 = t.pts[0].y;
    for (const q of t.pts) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    return { pts: t.pts, x: t.x, col: t.col, riga: t.riga, y0, y1 };
  });

  // le file: trattini consecutivi della stessa riga, a non più di 3 colonne l'uno dall'altro. (Provate il 2026-11-03,
  // con le zone e scartate: la macchia intera riga per riga, 1,46 m in vista contro 0,96 a grandezza 22, perché i salti di
  // riga dentro la macchia restano; la macchia intera colonna per colonna, 27 m di filo in più.)
  conSpan.sort((a, b) => a.riga - b.riga || a.col - b.col);
  const file: Fila[] = [];
  for (let k = 0; k < conSpan.length; k++) {
    const t = conSpan[k], p = conSpan[k - 1];
    if (!p || p.riga !== t.riga || t.col - p.col > 3) file.push({ trattini: [] });
    file[file.length - 1].trattini.push(t);
  }

  /** Le quote di un trattino dove il filo può entrare o uscire senza farsi vedere: il primo e l'ultimo tratto coperto. */
  const quoteNote = new Map<Trattino, number[]>();
  const quoteCoperte = (t: Trattino): number[] => {
    const nota = quoteNote.get(t);
    if (nota) return nota;
    const q: number[] = [];
    quoteNote.set(t, q);
    for (let y = t.y0; y <= t.y1; y += cella / 2) if (coperta[gIdx(t.x, y)]) { q.push(y); break; }
    for (let y = t.y1; y >= t.y0; y -= cella / 2) if (coperta[gIdx(t.x, y)]) { q.push(y); break; }
    return q;
  };
  // LO SFRANGIATO AIUTA (Lorenzo, 2026-11-03: «allungare o restringere un po' lo sfrangiato e far partire o finire nelle
  // vicinanze di parti coperte»). Il primo e l'ultimo trattino di una fila, se non toccano una zona ma ne hanno una
  // poco più in là, si allungano fin sotto: al massimo quanto vale già il frastaglio, così non si nota.
  const allunga = (t: Trattino) => {
    if (quoteCoperte(t).length) return;
    const limite = params.jaggedLengthMm;
    let meta: number | null = null;
    for (let d = cella / 2; d <= limite && meta === null; d += cella / 2) {
      if (coperta[gIdx(t.x, t.y0 - d)] && percorribile[gIdx(t.x, t.y0 - d)] && t.y0 - d >= bb.minY) meta = t.y0 - d - cella / 2;
      else if (coperta[gIdx(t.x, t.y1 + d)] && percorribile[gIdx(t.x, t.y1 + d)] && t.y1 + d <= bb.maxY) meta = t.y1 + d + cella / 2;
    }
    if (meta === null || !percorribile[gIdx(t.x, meta)]) return;
    const y0 = Math.min(t.y0, meta), y1 = Math.max(t.y1, meta);
    const passoT = Math.max(params.minStitchMm, params.maxStitchMm);
    const m = t.pts[0].y;
    const pts: Point[] = [{ x: t.x, y: m }];
    if (params.stitchMode === 'retrace') {
      pushSeg(pts, t.x, m, y0, passoT); pushSeg(pts, t.x, y0, m, passoT);
      pushSeg(pts, t.x, m, y1, passoT); pushSeg(pts, t.x, y1, m, passoT);
    } else {
      const fine = t.pts[t.pts.length - 1].y >= m ? y1 : y0;
      pts[0].y = fine === y1 ? y0 : y1;
      pushSeg(pts, t.x, pts[0].y, fine, passoT);
    }
    t.pts = pts; t.y0 = y0; t.y1 = y1;
    quoteNote.delete(t);
  };
  for (const f of file) { allunga(f.trattini[0]); if (f.trattini.length > 1) allunga(f.trattini[f.trattini.length - 1]); }

  // dove ci sono trattini in vista il filo non passa: anche quelli che verranno dopo
  const cucita = new Uint8Array(gcols * grows);
  for (const t of conSpan) for (let y = t.y0; y <= t.y1; y += cella / 2) cucita[gIdx(t.x, y)] = 1;

  const costoCella = (idx: number) => {
    if (coperta[idx]) return COSTO_SOTTO;
    return cucita[idx] ? COSTO_SOPRA_TRATTINI : 1;
  };
  /** Quanto costa il filo dritto da a a b. I primi e gli ultimi 1,5 mm non contano i trattini: sono quelli da cui parte e a cui arriva. */
  const costoLinea = (a: Point, b: Point): number => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-6) return 0;
    const n = Math.max(1, Math.ceil(d / 0.5));
    let somma = 0;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const idx = gIdx(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      const lontana = t * d > 1.5 && (1 - t) * d > 1.5;
      if (!percorribile[idx] && lontana) somma += 100;
      else if (coperta[idx]) somma += COSTO_SOTTO;
      else somma += cucita[idx] && lontana ? COSTO_SOPRA_TRATTINI : 1;
    }
    return somma * (d / n);
  };

  // LE FASCE (Lorenzo, 2026-11-05: «si passa a lavorare a zone»). Come in Pattern a macchie: una fascia dopo l'altra, libero
  // dentro, così il pezzo non ritira fra una e l'altra. Una fila sta nella fascia del suo centro.
  const verticale = params.stopZonesDirection === 'verticale';
  const nFasce = Math.max(1, Math.floor(params.stopZones));
  const inizioFasce = verticale ? bb.minX : bb.minY;
  const largFascia = (verticale ? bb.w : bb.h) / nFasce;
  const fasciaFila = file.map((f) => {
    if (verticale) return Math.max(0, Math.min(nFasce - 1, Math.floor(((f.trattini[0].x + f.trattini[f.trattini.length - 1].x) / 2 - inizioFasce) / largFascia)));
    let y0 = Infinity, y1 = -Infinity;
    for (const t of f.trattini) { if (t.y0 < y0) y0 = t.y0; if (t.y1 > y1) y1 = t.y1; }
    return Math.max(0, Math.min(nFasce - 1, Math.floor(((y0 + y1) / 2 - inizioFasce) / largFascia)));
  });
  /** Il punto sta nelle fasce da z0 a z1, col margine. */
  const nelleFasce = (x: number, y: number, z0: number, z1: number) => {
    const v = verticale ? x : y;
    return v >= inizioFasce + z0 * largFascia - MARGINE_FASCIA && v <= inizioFasce + (z1 + 1) * largFascia + MARGINE_FASCIA;
  };

  // la strada sulla griglia, a 8 vicini; le celle fuori dalla sagoma o nei vuoti non si attraversano
  const gg = new Float64Array(gcols * grows);
  const prima = new Int32Array(gcols * grows);
  const visita = new Int32Array(gcols * grows);
  let giro = 0;
  const VICINI: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  const centro = (idx: number): Point => ({ x: bb.minX + ((idx % gcols) + 0.5) * cella, y: bb.minY + (Math.floor(idx / gcols) + 0.5) * cella });
  /** Dalla cella d'arrivo alla strada vera: si risale, e si tira dritto dove il filo dritto non costa più della strada: niente scalini. */
  const finisci = (a: Point, b: Point, t: number): Point[] => {
    const celle: number[] = [];
    for (let c = t; c !== -1; c = prima[c]) celle.push(c);
    celle.reverse();
    const punti = [a, ...celle.slice(1, -1).map(centro), b];
    const costoFin = (i: number) => (i <= 0 ? 0 : i >= celle.length - 1 ? gg[t] : gg[celle[i]]);
    const fuori: Point[] = [a];
    for (let i = 0; i < punti.length - 1;) {
      let meglio = i + 1;
      for (let j = punti.length - 1; j > i + 1; j--) {
        if (costoLinea(punti[i], punti[j]) <= (costoFin(j) - costoFin(i)) * 1.02 + 0.1 && !forbidden(punti[i], punti[j])) { meglio = j; break; }
      }
      fuori.push(punti[meglio]);
      i = meglio;
    }
    return fuori;
  };
  /** La strada che costa meno da uno qualsiasi dei punti di partenza a uno qualsiasi di quelli d'arrivo, dentro le fasce da z0 a z1. */
  const strada = <T extends Point>(da: Point[], a: T[], z0: number, z1: number): { via: Point[]; uscita: Point; arrivo: T } | null => {
    giro++;
    const sorgenti = new Map<number, Point>();
    const coda = codaMinima();
    for (const p of da) {
      const s = gIdx(p.x, p.y);
      if (sorgenti.has(s)) continue;
      sorgenti.set(s, p); gg[s] = 0; prima[s] = -1; visita[s] = giro; coda.metti(s, 0);
    }
    const mete = new Map<number, T>();
    for (const p of a) { const t = gIdx(p.x, p.y); if (!mete.has(t)) mete.set(t, p); }
    while (!coda.vuota()) {
      const testa = coda.togli();
      if (testa.f > gg[testa.idx]) continue;
      const meta = mete.get(testa.idx);
      if (meta) {
        let c = testa.idx;
        while (prima[c] !== -1) c = prima[c];
        const uscita = sorgenti.get(c)!;
        return { via: finisci(uscita, meta, testa.idx), uscita, arrivo: meta };
      }
      const cx = testa.idx % gcols, cy = Math.floor(testa.idx / gcols);
      for (const [dx, dy, l] of VICINI) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gcols || ny >= grows) continue;
        const n = ny * gcols + nx;
        if (!mete.has(n) && (!percorribile[n] || !nelleFasce(bb.minX + (nx + 0.5) * cella, bb.minY + (ny + 0.5) * cella, z0, z1))) continue;
        const nuovo = gg[testa.idx] + l * cella * costoCella(n);
        if (visita[n] === giro && gg[n] <= nuovo) continue;
        gg[n] = nuovo; prima[n] = testa.idx; visita[n] = giro;
        coda.metti(n, nuovo);
      }
    }
    return null;
  };

  const polylines: Polyline[] = [];
  const passaggi: Polyline[] = [];
  let cur: Polyline = [];
  let pen: Point | null = null;
  if (!file.length) return { polylines, passaggi };

  // da fila a fila, per l'ordine: il filo meno costoso fra i capi dei due trattini estremi di ognuna
  const capi = file.map((f) => [f.trattini[0], f.trattini[f.trattini.length - 1]]
    .flatMap((t) => { const q = quoteCoperte(t); return (q.length ? q : [t.y0, t.y1]).map((y) => ({ x: t.x, y })); }));
  const memo = new Float64Array(file.length * file.length).fill(-1);
  const costoFile = (a: number, b: number): number => {
    const k = a < b ? a * file.length + b : b * file.length + a;
    if (memo[k] >= 0) return memo[k];
    let m = Infinity;
    for (const p of capi[a]) for (const q of capi[b]) { const c = costoLinea(p, q); if (c < m) m = c; }
    memo[k] = m;
    return m;
  };
  // Il filo dritto non dice quanto costa davvero andare da una fila all'altra: sotto le zone si gira quasi gratis. Si misura
  // su una griglia più larga, da ogni fila fino alle sue vicine in costo, senza uscire dalla sua fascia.
  const noto = new Uint8Array(file.length * file.length);
  {
    const K = 3, cw = Math.ceil(gcols / K), ch = Math.ceil(grows / K);
    const somma = new Float32Array(cw * ch), quanti = new Uint16Array(cw * ch);
    for (let gy = 0; gy < grows; gy++) for (let gx = 0; gx < gcols; gx++) {
      const i = gy * gcols + gx;
      if (!percorribile[i]) continue;
      const b = Math.floor(gy / K) * cw + Math.floor(gx / K);
      somma[b] += costoCella(i); quanti[b]++;
    }
    const costoB = new Float32Array(cw * ch).fill(-1);
    for (let b = 0; b < costoB.length; b++) if (quanti[b] * 2 >= K * K) costoB[b] = (somma[b] / quanti[b]) * K * cella;
    const blocco = (p: Point) => { const i = gIdx(p.x, p.y); return Math.floor(Math.floor(i / gcols) / K) * cw + Math.floor((i % gcols) / K); };
    const qui = new Map<number, number[]>();
    capi.forEach((lista, i) => { for (const p of lista) { const b = blocco(p); const v = qui.get(b); if (!v) qui.set(b, [i]); else if (v[v.length - 1] !== i) v.push(i); } });
    const dist = new Float64Array(cw * ch);
    const visto = new Int32Array(cw * ch).fill(-1);
    for (let a = 0; a < file.length; a++) {
      const coda = codaMinima();
      for (const p of capi[a]) { const b = blocco(p); visto[b] = a; dist[b] = 0; coda.metti(b, 0); }
      let trovate = 0;
      while (!coda.vuota() && trovate < 30) {
        const t = coda.togli();
        if (t.f > dist[t.idx]) continue;
        for (const o of qui.get(t.idx) ?? []) {
          if (o === a) continue;
          const k = a < o ? a * file.length + o : o * file.length + a;
          if (!noto[k]) { noto[k] = 1; memo[k] = t.f; trovate++; } else if (t.f < memo[k]) memo[k] = t.f;
        }
        const x = t.idx % cw, y = Math.floor(t.idx / cw);
        for (const [dx, dy, l] of VICINI) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const n = ny * cw + nx;
          if (costoB[n] < 0 || !nelleFasce(bb.minX + (nx + 0.5) * K * cella, bb.minY + (ny + 0.5) * K * cella, fasciaFila[a], fasciaFila[a])) continue;
          const nuovo = t.f + l * costoB[n];
          if (visto[n] === a && dist[n] <= nuovo) continue;
          visto[n] = a; dist[n] = nuovo; coda.metti(n, nuovo);
        }
      }
    }
  }
  /** Per scegliere le vicine: il costo vero al quadrato, se si conosce; le altre vengono dopo, per distanza. */
  const distanzaFile = (a: number, b: number): number => {
    const k = a < b ? a * file.length + b : b * file.length + a;
    if (noto[k]) return memo[k] * memo[k];
    let m = Infinity;
    for (const p of capi[a]) for (const q of capi[b]) { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < m) m = d; }
    return 1e6 + m;
  };
  // una fascia dopo l'altra; ognuna comincia vicino a dove è finita quella prima
  const ordine: number[] = [];
  for (let z = 0; z < nFasce; z++) {
    const qui = file.map((_, i) => i).filter((i) => fasciaFila[i] === z);
    if (!qui.length) continue;
    let inizio = 0;
    if (ordine.length) {
      const fine = ordine[ordine.length - 1];
      let m = Infinity;
      qui.forEach((i, k) => { const d = distanzaFile(fine, i); if (d < m) { m = d; inizio = k; } });
    } else {
      // comincia dalla fila più in alto a sinistra
      qui.forEach((i, k) => { const t = file[i].trattini[0], u = file[qui[inizio]].trattini[0]; if (t.y0 + t.x < u.y0 + u.x) inizio = k; });
    }
    ordine.push(...ordinaFile(qui.length, (a, b) => costoFile(qui[a], qui[b]), (a, b) => distanzaFile(qui[a], qui[b]), inizio).map((k) => qui[k]));
  }

  const cuci = (seq: Trattino[], ingresso: number | null) => {
    seq.forEach((t, k) => {
      const entrata = t.pts[0];
      if (k === 0 && ingresso !== null) {
        // la gamba sul trattino stesso è sugli stessi buchi: non si vede
        pushTravel(cur, { x: t.x, y: ingresso }, entrata, passo);
      } else if (k > 0 && pen) {
        const p = seq[k - 1];
        const yStop = Math.max(p.y0, Math.min(p.y1, entrata.y));
        if (Math.abs(yStop - pen.y) > passo) { const svolta = { x: pen.x, y: yStop }; pushTravel(cur, pen, svolta, passo); pen = svolta; }
        pushTravel(cur, pen, entrata, passo);
      }
      if (cur.length === 0) cur.push(entrata);
      for (let q = 1; q < t.pts.length; q++) cur.push(t.pts[q]);
      pen = t.pts[t.pts.length - 1];
    });
  };
  cuci(file[ordine[0]].trattini, null);
  let ultimo = file[ordine[0]].trattini[file[ordine[0]].trattini.length - 1];
  for (let o = 1; o < ordine.length; o++) {
    const f = file[ordine[o]];
    const uscite: Point[] = [pen!, ...[ultimo.y0, ultimo.y1, ...quoteCoperte(ultimo)].map((y) => ({ x: ultimo.x, y }))];
    const arrivi: (Point & { seq: Trattino[] })[] = [];
    for (const seq of [f.trattini, f.trattini.slice().reverse()]) {
      const t = seq[0];
      for (const y of [t.pts[0].y, t.y0, t.y1, ...quoteCoperte(t)]) arrivi.push({ x: t.x, y, seq });
    }
    const z0 = Math.min(fasciaFila[ordine[o]], fasciaFila[ordine[o - 1]]), z1 = Math.max(fasciaFila[ordine[o]], fasciaFila[ordine[o - 1]]);
    const r = strada(uscite, arrivi, z0, z1) ?? strada(uscite, arrivi, 0, nFasce - 1);
    if (r) {
      // esce lungo il trattino, sugli stessi buchi; poi il passaggio; poi entra lungo il trattino nuovo
      if (Math.abs(r.uscita.y - pen!.y) > 1e-6) pushTravel(cur, pen!, r.uscita, passo);
      const daQui = cur.length - 1;
      pushStrada(cur, r.via, passo);
      passaggi.push(cur.slice(daQui));
      pen = { x: r.arrivo.x, y: r.arrivo.y };
      cuci(r.arrivo.seq, r.arrivo.y);
    } else {
      if (cur.length > 1) polylines.push(cur);       // niente strada: un vuoto taglia in due il pezzo. Salto onesto.
      cur = [];
      pen = null;
      cuci(f.trattini, null);
    }
    const seq = r ? r.arrivo.seq : f.trattini;
    ultimo = seq[seq.length - 1];
  }
  if (cur.length > 1) polylines.push(cur);
  return { polylines, passaggi };
}

/**
 * Genera le striature. SERPENTINA A RIGHE: per ogni riga (alta `striaturaLengthMm`) si scorrono le colonne
 * a zig-zag. Due tipi di cella, distinti:
 *  - MACCHIA (colonna dentro un blob) → trattino FRASTAGLIATO retrace (grappolo di striature);
 *  - PASSAGGIO (colonna di base, fuori dalle macchie) → passata di RASO a bassa densità con capi PRECISI
 *    sul bordo-riga → finali orizzontali paralleli (serpentina verticale che si confonde con la base).
 * Le celle sono collegate da tragitti retti a running (`travelStitchMm`, mai troppo lunghi) → filo continuo;
 * si spezza (salto) solo se un tragitto uscirebbe dal bordo o entrerebbe in un vuoto (R5). Output a layer.
 */
export function generateStriatura(input: StriaturaInput, richiesti: StriaturaParams): StriaturaLayer[] {
  const { outline, voids } = input;
  const params = misureEffettive(richiesti);
  if (!outline || outline.length < 3) return [{ color: params.color, polylines: [] }];
  const bb = bboxOf(outline);
  const rng = mulberry32(params.seed);
  const blobs = scatterBlobs(outline, bb, params, rng);

  const dx = Math.max(0.2, params.densitySpacingMm);
  const baseEvery = Math.max(1, Math.round(params.fillSpacingMm / dx));
  const clr = params.voidClearanceMm;
  const minLen = params.minStitchMm;
  const rowH = Math.max(2, params.striaturaLengthMm);
  const travelStep = Math.max(params.minStitchMm, params.travelStitchMm);
  const maxTravel = rowH * 1.6; // collegamento CORTO consentito; oltre (o se attraverserebbe qualcosa) → salto

  // fase verticale per-colonna (de-allinea le righe → partenze non allineate): deterministica, indip. dall'ordine.
  const nCols = Math.max(1, Math.floor(bb.w / dx) + 1);
  const phaseRng = mulberry32((params.seed ^ 0x9e3779b9) >>> 0);
  const phase: number[] = [];
  for (let i = 0; i < nCols; i++) phase.push((phaseRng() * 2 - 1) * rowH * 0.35);

  // travel proibito se esce dal bordo o entra in un vuoto (R5): campiona il segmento.
  const forbidden = (a: Point, b: Point): boolean => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(d / 0.5));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (!insideOutline(x, y, outline)) return true;
      for (const v of voids) if (insideOutline(x, y, v)) return true;
    }
    return false;
  };


  const cols: { x: number; i: number }[] = [];
  for (let i = 0; i < nCols; i++) cols.push({ x: bb.minX + dx * (i + 0.5), i });

  // OCCUPAZIONE: mappa a griglia di ciò che è GIÀ cucito (macchie + passaggi). Un collegamento non deve
  // MAI attraversarla (niente passaggi sopra macchie o altri passaggi, richiesta di Lorenzo).
  const occCell = Math.max(0.8, params.densitySpacingMm * 1.2);
  const gcols = Math.max(1, Math.ceil(bb.w / occCell) + 1);
  const grows = Math.max(1, Math.ceil(bb.h / occCell) + 1);
  const occ = new Uint8Array(gcols * grows);
  const gIdx = (px: number, py: number) => {
    const gx = Math.min(gcols - 1, Math.max(0, Math.floor((px - bb.minX) / occCell)));
    const gy = Math.min(grows - 1, Math.max(0, Math.floor((py - bb.minY) / occCell)));
    return gy * gcols + gx;
  };
  const markPts = (pl: Point[]) => { for (const p of pl) occ[gIdx(p.x, p.y)] = 1; };
  /** true se il segmento a→b passa SOPRA una cella già cucita (ignorando ~skip mm ai due estremi). */
  const crossesOcc = (a: Point, b: Point): boolean => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-6) return false;
    const skip = Math.min(0.45, occCell / d);           // salta gli estremi (le macchie che collega)
    const steps = Math.max(1, Math.ceil(d));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (t < skip || t > 1 - skip) continue;
      if (occ[gIdx(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)] === 1) return true;
    }
    return false;
  };

  // cella dentro la sagoma (fuori dai vuoti): per instradare i collegamenti nei CORRIDOI liberi.
  const insideCell = new Uint8Array(gcols * grows);
  for (let gy = 0; gy < grows; gy++) {
    for (let gx = 0; gx < gcols; gx++) {
      const cxp = bb.minX + (gx + 0.5) * occCell, cyp = bb.minY + (gy + 0.5) * occCell;
      let inside = insideOutline(cxp, cyp, outline);
      if (inside) for (const v of voids) if (insideOutline(cxp, cyp, v)) { inside = false; break; }
      insideCell[gy * gcols + gx] = inside ? 1 : 0;
    }
  }
  const cellCenter = (idx: number): Point => ({
    x: bb.minX + ((idx % gcols) + 0.5) * occCell,
    y: bb.minY + (Math.floor(idx / gcols) + 0.5) * occCell,
  });
  // Corsia di BORDO: celle dentro la sagoma ma adiacenti al fuori (il perimetro). Là la clearance lascia
  // sempre una corsia libera → le teniamo SEMPRE percorribili dal routing, così il filo può girare lungo il
  // bordo per collegare due macchie senza mai saltare (il "passaggio sul bordo" chiesto da Lorenzo).
  const borderLane = new Uint8Array(gcols * grows);
  for (let gy = 0; gy < grows; gy++) {
    for (let gx = 0; gx < gcols; gx++) {
      const idx = gy * gcols + gx;
      if (!insideCell[idx]) continue;
      const edge = (gx === 0 || gx === gcols - 1 || gy === 0 || gy === grows - 1)
        || !insideCell[idx - 1] || !insideCell[idx + 1]
        || !insideCell[idx - gcols] || !insideCell[idx + gcols];
      if (edge) borderLane[idx] = 1;
    }
  }
  // ZONE COPERTE: celle dove dopo verrà cucita un'altra grafica. `coperta` = ci si può nascondere un passaggio;
  // `profonda` = così dentro che un trattino fatto solo di queste celle non si vedrebbe nemmeno con una ricentratura.
  const coperte = (input.coperte ?? []).filter((c) => c.length >= 3);
  const coperta = new Uint8Array(gcols * grows);
  const profonda = new Uint8Array(gcols * grows);
  // zona per zona, solo le celle del suo rettangolo: le zone possono essere centinaia (le macchie di un pannello)
  for (const z of coperte) {
    const zb = bboxOf(z);
    const gx0 = Math.max(0, Math.floor((zb.minX - bb.minX) / occCell)), gx1 = Math.min(gcols - 1, Math.floor((zb.maxX - bb.minX) / occCell));
    const gy0 = Math.max(0, Math.floor((zb.minY - bb.minY) / occCell)), gy1 = Math.min(grows - 1, Math.floor((zb.maxY - bb.minY) / occCell));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const idx = gy * gcols + gx;
        if (!insideCell[idx] || profonda[idx]) continue;
        const c = { x: bb.minX + (gx + 0.5) * occCell, y: bb.minY + (gy + 0.5) * occCell };
        if (!insideOutline(c.x, c.y, z)) continue;
        const dentro = distanceToBoundary(c, z);
        if (dentro >= params.coverMarginMm) coperta[idx] = 1;
        if (dentro >= params.coverOverlapMm) profonda[idx] = 1;
      }
    }
  }
  const neighOf = (c: number, d: number): number => {
    const cgx = c % gcols;
    if (d === 0) return cgx === gcols - 1 ? -1 : c + 1;
    if (d === 1) return cgx === 0 ? -1 : c - 1;
    if (d === 2) { const n = c + gcols; return n < gcols * grows ? n : -1; }
    const n = c - gcols; return n >= 0 ? n : -1;
  };

  /** Cella LIBERA (dentro la sagoma, non cucita) più vicina a `p`: serve a uscire da dentro una macchia. */
  const routable = (idx: number) => insideCell[idx] === 1 && (occ[idx] === 0 || borderLane[idx] === 1);
  const nearestFree = (p: Point): number => {
    const start = gIdx(p.x, p.y);
    if (routable(start)) return start;
    const seen = new Uint8Array(gcols * grows);
    const q = new Int32Array(gcols * grows);
    let head = 0, tail = 0; q[tail++] = start; seen[start] = 1;
    while (head < tail) {
      const c = q[head++];
      if (routable(c)) return c;
      for (let d = 0; d < 4; d++) { const nx = neighOf(c, d); if (nx < 0 || seen[nx]) continue; seen[nx] = 1; q[tail++] = nx; }
    }
    return -1;
  };
  /**
   * Instrada da `a` a `b` nei CORRIDOI LIBERI (celle dentro la sagoma e non ancora cucite), con una BFS a
   * 4 vicini → percorso più corto che NON attraversa il cucito (macchie/passaggi) e NON salta; dove i
   * corridoi interni sono chiusi, gira lungo il BORDO (là la clearance lascia una corsia libera). Esce/entra
   * dalla cella libera più vicina alle macchie di partenza/arrivo. null solo se lo spazio libero è scollegato.
   */
  const routeFree = (a: Point, b: Point): Point[] | null => {
    const sIdx = nearestFree(a), tIdx = nearestFree(b);
    if (sIdx < 0 || tIdx < 0) return null;
    return strada(sIdx, tIdx) ?? fuoriDallaTasca(a, b);
  };
  /**
   * La cella libera più vicina può essere una tasca di una cella fra i buchi dei trattini: da lì non si va da
   * nessuna parte, anche con tutto il campo libero a due celle di distanza, e il filo saltava (misurato il
   * 2026-11-03: con macchie da 8 mm quasi tutti i salti nascevano così). Se la strada non c'è, si esce verso il
   * corridoio vero più vicino, al massimo `USCITA_CELLE` celle attraverso il cucito.
   */
  const fuoriDallaTasca = (a: Point, b: Point): Point[] | null => {
    const gruppo = new Int32Array(gcols * grows).fill(-1);
    const quante: number[] = [];
    const q = new Int32Array(gcols * grows);
    for (let i = 0; i < gruppo.length; i++) {
      if (gruppo[i] >= 0 || !routable(i)) continue;
      let head = 0, tail = 0; q[tail++] = i; gruppo[i] = quante.length;
      while (head < tail) {
        const c = q[head++];
        for (let d = 0; d < 4; d++) { const nx = neighOf(c, d); if (nx >= 0 && gruppo[nx] < 0 && routable(nx)) { gruppo[nx] = quante.length; q[tail++] = nx; } }
      }
      quante.push(tail);
    }
    const uscita = (p: Point, voluto: number): number => {
      const start = gIdx(p.x, p.y);
      const dist = new Map<number, number>([[start, 0]]);
      const coda = [start];
      for (let k = 0; k < coda.length; k++) {
        const c = coda[k];
        if (gruppo[c] >= 0 && (voluto >= 0 ? gruppo[c] === voluto : quante[gruppo[c]] >= CORRIDOIO_CELLE)) return c;
        if (dist.get(c)! >= USCITA_CELLE) continue;
        for (let d = 0; d < 4; d++) { const nx = neighOf(c, d); if (nx >= 0 && insideCell[nx] && !dist.has(nx)) { dist.set(nx, dist.get(c)! + 1); coda.push(nx); } }
      }
      return -1;
    };
    const s = uscita(a, -1);
    if (s < 0) return null;
    const t = uscita(b, gruppo[s]);
    return t < 0 ? null : strada(s, t);
  };
  const strada = (sIdx: number, tIdx: number): Point[] | null => {
    if (sIdx === tIdx) return [cellCenter(sIdx)];
    const prevArr = new Int32Array(gcols * grows).fill(-2);
    const q = new Int32Array(gcols * grows);
    let head = 0, tail = 0;
    q[tail++] = sIdx; prevArr[sIdx] = -1;
    let found = false;
    while (head < tail) {
      const c = q[head++];
      if (c === tIdx) { found = true; break; }
      for (let d = 0; d < 4; d++) {
        const nx = neighOf(c, d);
        if (nx < 0 || prevArr[nx] !== -2) continue;
        if (nx !== tIdx && !routable(nx)) continue;   // corridoi liberi o corsia di bordo (o cella d'arrivo)
        prevArr[nx] = c; q[tail++] = nx;
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = tIdx; c !== -1; c = prevArr[c]) { cells.push(c); if (c === sIdx) break; }
    cells.reverse();
    return cells.map(cellCenter);
  };

  const polylines: Polyline[] = [];
  const passaggi: Polyline[] = [];
  let cur: Polyline = [];
  let pen: Point | null = null;

  const nRows = Math.max(1, Math.ceil(bb.h / rowH));
  const step = Math.max(minLen, params.maxStitchMm);
  const jag = params.jaggedLengthMm * 0.5;
  // MOVIMENTO: onda che sposta in verticale il centro-fascia di OGNI colonna → le fasce orizzontali
  // ondulano (macchie e passaggi si muovono) invece di stare su righe dritte. 0 = niente movimento.
  const waveAmp = Math.max(0, params.waveAmpMm);
  const waveLen = Math.max(1, params.waveLenMm);
  const wavePhase = mulberry32((params.seed ^ 0x2545f491) >>> 0)() * Math.PI * 2;
  const warp = (x: number) => waveAmp === 0 ? 0 : waveAmp * Math.sin((2 * Math.PI / waveLen) * x + wavePhase);
  let passDir = 1;             // verso dei trattini-macchia (boustrophedon); il retrace lo ignora
  let lastSpan: { x: number; y0: number; y1: number } | null = null; // estensione del trattino appena cucito
  // Collega passaggio→passaggio entrando dal capo che guarda l'ago. La voltata NON è orizzontale al
  // millimetro (il frastaglio muove anche il capo vicino): misurata, pende di 1,62mm in mediana e mai
  // più di 2,99mm, cioè meno di un punto. Verificata con Lorenzo il 2026-08-25 e accettata così.
  let lastWasBase = false;
  let lastCol = -1;
  const raccolti: TrattinoRaccolto[] = []; // con le zone il filo non si collega qui: si raccolgono i trattini
  // righe extra (±1) per coprire lo spostamento dell'onda ai bordi.
  for (let r = -1; r <= nRows; r++) {
    const rowY = bb.minY + rowH * (r + 0.5);
    const rowCols = (r % 2 === 0) ? cols : cols.slice().reverse(); // serpentina di riga

    // Span delle MACCHIE nella riga (indici colonna): i passaggi esistono SOLO per collegare una macchia
    // all'altra → una colonna di base è ammessa solo TRA la prima e l'ultima macchia della riga (niente
    // passaggi nei margini vuoti). Fasce ampie: si collega anche a distanza, purché ci siano macchie ai due lati.
    let firstDense = Infinity, lastDense = -Infinity;
    for (const c of cols) {
      const rcc = rowY + warp(c.x);
      const ivc = intervalContaining(c.x, rcc, outline, voids, clr, minLen);
      if (ivc && inAnyBlob(c.x, rcc, blobs)) {
        if (c.i < firstDense) firstDense = c.i;
        if (c.i > lastDense) lastDense = c.i;
      }
    }

    for (const { x, i } of rowCols) {
      const rc = rowY + warp(x);                        // centro-fascia di QUESTA colonna (con movimento)
      const iv = intervalContaining(x, rc, outline, voids, clr, minLen);
      if (!iv) continue;
      const dense = inAnyBlob(x, rc, blobs);            // dentro una macchia → trattino fitto
      const base = (i % baseEvery) === 0 && i > firstDense && i < lastDense; // passaggio SOLO tra macchie
      if (!dense && !base) continue;

      let pts: Point[] | null;
      if (dense) {
        // MACCHIA: trattino frastagliato, retrace, centro sfasato (partenze non allineate)
        pts = striaturaCell(x, rc + phase[i], iv[0], iv[1], passDir, params, rng);
      } else {
        // PASSAGGIO: linea verticale (ampiezza `passaggioAmpMm`), di LUNGHEZZA VARIABILE. Il collegamento
        // alla linea successiva è UN SOLO segmento (dalla fine di una linea all'inizio della successiva,
        // sullo STESSO lato) → serpentina con un unico passaggio per voltata, niente beccuccio.
        const amp = Math.min(params.passaggioAmpMm, iv[1] - iv[0]);
        const pTop = rc - amp / 2, pBot = rc + amp / 2;
        const continuing = !!pen && lastWasBase
          && Math.abs(pen.x - x) <= maxTravel && !forbidden(pen, { x, y: pen.y });
        let nearY: number, farY: number;
        if (continuing) {
          const nearIsTop = pen!.y < rc;                                    // stesso lato della penna
          nearY = (nearIsTop ? pTop : pBot) + (rng() * 2 - 1) * jag;        // capo vicino: altezza propria (variabile)
          farY = (nearIsTop ? pBot : pTop) + (rng() * 2 - 1) * jag;         // capo lontano: variabile
        } else {
          nearY = pBot + (rng() * 2 - 1) * jag;                            // passata isolata: parte dal basso
          farY = pTop + (rng() * 2 - 1) * jag;                             // sale in cima
        }
        nearY = Math.max(iv[0], Math.min(iv[1], nearY));
        farY = Math.max(iv[0], Math.min(iv[1], farY));
        if (Math.abs(farY - nearY) < minLen) continue;
        if (coperte.length) continue; // con le zone niente linee rade (dopo i numeri a caso: i trattini non cambiano)
        const p2: Point[] = [{ x, y: nearY }];
        pushSeg(p2, x, nearY, farY, step);
        pts = p2;
      }
      if (!pts) continue;
      if (coperte.length) { raccolti.push({ pts, x, col: i, riga: r }); passDir = -passDir; continue; }

      const entry = pts[0];
      // collegamento consentito solo se CORTO e non fuori sagoma/vuoto (R5). Per i salti "medi" (che
      // potrebbero passare sopra qualcosa) si controlla anche l'occupazione; i collegamenti corti (serpentina
      // locale dentro/tra macchie adiacenti) NON la controllano (la regione è occupata da sé stessi).
      const dtravel = pen ? Math.hypot(pen.x - entry.x, pen.y - entry.y) : Infinity;
      const shortLink = dtravel <= rowH * 0.9;
      const reachable = pen
        && dtravel <= maxTravel
        && !forbidden(pen, entry)
        && (shortLink || !crossesOcc(pen, entry));
      // fra due trattini vicini della stessa macchia il collegamento non è un passaggio: sta in mezzo ai trattini
      const interno = dense && !lastWasBase && Math.abs(i - lastCol) <= 3;
      let daQui = cur.length - 1;
      if (reachable && pen) {
        // COLLEGAMENTO NASCOSTO (feedback di Lorenzo, 2026-08-25). Il trattino in retrace entra ed esce
        // dal proprio CENTRO, e i centri di due colonne vicine sono sfasati apposta (le partenze non
        // devono allinearsi): il collegamento diretto diventava una linea verticale lunga anche 16mm in
        // mezzo al ricamo, quattro volte i collegamenti normali e visibilmente diversa da loro.
        // Ora la quota d'arrivo si insegue RESTANDO sul trattino appena cucito, cioè ripassando sugli
        // stessi buchi: se ci cade dentro il collegamento sparisce del tutto, se cade oltre (è la riga
        // sotto) resta esposto solo il pezzo che avanza.
        const yStop = lastSpan ? Math.max(lastSpan.y0, Math.min(lastSpan.y1, entry.y)) : pen.y;
        const salita = !!lastSpan && Math.abs(pen.x - lastSpan.x) < 0.01 && Math.abs(yStop - pen.y) > travelStep;
        if (salita) {
          const svolta = { x: pen.x, y: yStop };
          pushTravel(cur, pen, svolta, travelStep);   // gamba nascosta sopra il cucito
          daQui = cur.length - 1;
          pushTravel(cur, svolta, entry, travelStep); // gamba corta verso il trattino nuovo
        } else {
          // UN SOLO passaggio retto pen→entry (`ceil` = nessun segmento troppo lungo).
          pushTravel(cur, pen, entry, travelStep);
        }
        if (!interno) passaggi.push(cur.slice(daQui));
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]); // stroke senza il primo (= entry, già aggiunto)
      } else {
        const route = pen ? routeFree(pen, entry) : null;
        if (route && pen) {
          // NIENTE SALTO: instrada nei corridoi liberi (e lungo il bordo dove serve) senza attraversare il cucito.
          let prev: Point = pen;
          for (const wp of route) { pushTravel(cur, prev, wp, travelStep); prev = wp; }
          pushTravel(cur, prev, entry, travelStep);
          if (!interno) passaggi.push(cur.slice(daQui));
          for (let k = 1; k < pts.length; k++) cur.push(pts[k]);
          // NB: il percorso di collegamento NON viene marcato occupato → i corridoi restano aperti per gli
          // altri collegamenti (evita che lo spazio libero si frammenti e costringa a un salto). Al più due
          // collegamenti condividono un corridoio (thin), meglio di un salto o di un attraversamento.
        } else {
          // lo spazio libero è scollegato (tasca murata dalle macchie): niente corridoio né bordo → l'unica
          // alternativa a un salto sarebbe ATTRAVERSARE una macchia (bocciato). Salto raro e onesto.
          if (cur.length > 1) polylines.push(cur);
          cur = pts.slice();
        }
      }
      if (!dense) passaggi.push(pts);    // la passata rada è un passaggio anche lei
      markPts(pts);                      // la macchia/passata appena cucita occupa spazio
      pen = pts[pts.length - 1];
      // estensione verticale del trattino appena cucito: serve al collegamento successivo per capire
      // se può risalirci sopra (invisibile) invece di tirare una linea nuova in mezzo al ricamo.
      let y0 = pts[0].y, y1 = pts[0].y;
      for (const q of pts) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      lastSpan = { x, y0, y1 };
      passDir = -passDir;
      lastWasBase = !dense;
      lastCol = i;
    }
  }
  if (cur.length > 1) polylines.push(cur);

  if (coperte.length) {
    const griglia: GrigliaZone = { bb, cella: occCell, gcols, grows, gIdx, insideCell, coperta, profonda };
    return [{ color: params.color, ...cuciSottoLeZone(raccolti, griglia, forbidden, params, travelStep, clr) }];
  }
  return [{ color: params.color, polylines, passaggi }];
}

/** Somma delle lunghezze di tutte le polilinee di un layer (mm), per la statusbar. */
export function layerThreadMm(layer: StriaturaLayer): number {
  let s = 0;
  for (const pl of layer.polylines) {
    for (let i = 1; i < pl.length; i++) {
      const a: Point = pl[i - 1];
      const b: Point = pl[i];
      s += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return s;
}

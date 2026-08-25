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
// MOTIVO DELLA STRIATURA (`stitchMode`):
// - 'retrace' (DEFAULT): dal centro su e torna, giù e torna → trattino marcato (ciò che vuole Lorenzo);
// - 'boustrophedon': passata singola (più magra). Scelta di stile (R30), da valutare a occhio.
//
// NOTA: puro TS (niente DOM) → testabile in Node come interlace/bitmap. Riceve contorni GIÀ parsati.
import {
  type Point, type Polyline,
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
  blobSizeMm: number;        // grandezza media delle macchie maculate (diametro indicativo)
  blobSpacingMm: number;     // distanza tra una macchia e l'altra
  jaggedLengthMm: number;    // frastaglio: variazione di lunghezza delle striature
  jaggedStartMm: number;     // frastaglio: sfasamento verticale delle partenze (non allineate)
  // --- movimento: onda che fa ondulare le fasce orizzontali (0 = fasce dritte) ---
  waveAmpMm: number;         // ampiezza dell'onda (quanto si muovono le fasce su/giù); 0 = niente movimento
  waveLenMm: number;         // lunghezza d'onda (ogni quanti mm si ripete l'ondulazione)
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
  blobSpacingMm: 5,          // ravvicinate → copertura più omogenea (poi jitter per l'irregolarità)
  jaggedLengthMm: 8,
  jaggedStartMm: 4,
  waveAmpMm: 0,              // 0 = fasce dritte; alza per dare movimento (ondulazione)
  waveLenMm: 80,
  stitchMode: 'retrace',
  seed: 1,
  color: '#1a1a1a',
};

/** Un layer di output del motore (un filo = una passata). Mono ora; lista → multicolore futuro. */
export interface StriaturaLayer {
  color: string;
  polylines: Polyline[];
}

/** Contorni d'ingresso già parsati: perimetro (area) + eventuali vuoti (R5). */
export interface StriaturaInput {
  outline: Polyline;     // perimetro esterno dell'area da ricamare (mm, chiuso o quasi)
  voids: Polyline[];     // aree vuote interne (R5)
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
      const halfH = base * 0.5 * (0.6 + rng() * 1.2);   // variazione (piccole↔grandi) ma senza minuscole → meno buchi
      const halfW = halfH * (0.4 + rng() * 0.32);        // più alta che larga (foglia)
      blobs.push({ cx, cy, halfW, halfH, sharp: 0.65 + rng() * 0.25, amp: 0.10 + rng() * 0.10, phase: rng() * 6.283 });
    }
  }
  return blobs;
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

/**
 * Genera le striature. SERPENTINA A RIGHE: per ogni riga (alta `striaturaLengthMm`) si scorrono le colonne
 * a zig-zag. Due tipi di cella, distinti:
 *  - MACCHIA (colonna dentro un blob) → trattino FRASTAGLIATO retrace (grappolo di striature);
 *  - PASSAGGIO (colonna di base, fuori dalle macchie) → passata di RASO a bassa densità con capi PRECISI
 *    sul bordo-riga → finali orizzontali paralleli (serpentina verticale che si confonde con la base).
 * Le celle sono collegate da tragitti retti a running (`travelStitchMm`, mai troppo lunghi) → filo continuo;
 * si spezza (salto) solo se un tragitto uscirebbe dal bordo o entrerebbe in un vuoto (R5). Output a layer.
 */
export function generateStriatura(input: StriaturaInput, params: StriaturaParams): StriaturaLayer[] {
  const { outline, voids } = input;
  if (!outline || outline.length < 3) return [{ color: params.color, polylines: [] }];
  const bb = bboxOf(outline);
  const rng = mulberry32(params.seed);
  const blobs = scatterBlobs(outline, bb, params, rng);

  const dx = Math.max(0.2, params.densitySpacingMm);
  const baseEvery = Math.max(1, Math.round(params.fillSpacingMm / dx));
  const clr = params.voidClearanceMm;
  const minLen = params.minStitchMm;
  const rowH = Math.max(4, params.striaturaLengthMm);
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
  let lastWasBase = false;     // per collegare passaggio→passaggio con VOLTATA ORIZZONTALE
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
        const p2: Point[] = [{ x, y: nearY }];
        pushSeg(p2, x, nearY, farY, step);
        pts = p2;
      }
      if (!pts) continue;

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
          pushTravel(cur, svolta, entry, travelStep); // gamba corta verso il trattino nuovo
        } else {
          // UN SOLO passaggio retto pen→entry (`ceil` = nessun segmento troppo lungo).
          pushTravel(cur, pen, entry, travelStep);
        }
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]); // stroke senza il primo (= entry, già aggiunto)
      } else {
        const route = pen ? routeFree(pen, entry) : null;
        if (route && pen) {
          // NIENTE SALTO: instrada nei corridoi liberi (e lungo il bordo dove serve) senza attraversare il cucito.
          let prev: Point = pen;
          for (const wp of route) { pushTravel(cur, prev, wp, travelStep); prev = wp; }
          pushTravel(cur, prev, entry, travelStep);
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
      markPts(pts);                      // la macchia/passata appena cucita occupa spazio
      pen = pts[pts.length - 1];
      // estensione verticale del trattino appena cucito: serve al collegamento successivo per capire
      // se può risalirci sopra (invisibile) invece di tirare una linea nuova in mezzo al ricamo.
      let y0 = pts[0].y, y1 = pts[0].y;
      for (const q of pts) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      lastSpan = { x, y0, y1 };
      passDir = -passDir;
      lastWasBase = !dense;
    }
  }
  if (cur.length > 1) polylines.push(cur);

  return [{ color: params.color, polylines }];
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

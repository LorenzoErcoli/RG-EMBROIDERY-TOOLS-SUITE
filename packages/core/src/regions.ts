// Dalla mappa dei colori alle REGIONI: poligoni in millimetri, con i loro fori.
//
// È il pezzo che nella suite non esisteva da nessuna parte: `apps/bitmap` va da raster a *punti*
// senza mai costruire un'area. Serve perché il raso (R24, `buildParallelFill`) vuole un poligono,
// non una maschera — ed è la stessa forma che poi il routing deve aggirare.
//
// **Nato in `apps/broccato`, promosso qui il 2026-09-04** quando il secondo cliente si è
// presentato: il Punto Pittorico, che da una regione ricava il campo di direzione e il riempimento
// curvo. È la regola di crescita 1 — il core cresce per estrazione, non per anticipazione — e il
// trasloco è a comportamento invariato, con il lucchetto scritto in `test/smoke.mjs` PRIMA di
// muovere una riga.
//
// Nessun DOM: si prova in Node dallo smoke test.

import type { Polyline, Point, Bounds } from './types';
import { simplifyPolyline, polygonArea, pointInPolygon, bounds } from './geometry';
import { NO_COLOR } from './quantize';

/** Un'area di un colore: il suo contorno e i buchi che ha dentro, in millimetri reali (R1). */
export interface Region {
  outer: Polyline;
  holes: Polyline[];
  /** Area netta (contorno meno fori), in mm². */
  areaMm2: number;
}

/** Direzioni dei lati di un pixel, percorsi in modo che il pieno resti sempre dalla stessa parte. */
type Crack = { x0: number; y0: number; x1: number; y1: number };

const key = (x: number, y: number): number => y * 100000 + x;

/**
 * Segue il contorno di una macchia lungo i **lati dei pixel** (non i loro centri): il risultato è
 * un anello esatto a gradini, che poi si semplifica.
 *
 * Ogni pixel pieno che confina col vuoto contribuisce quel lato, orientato sempre nello stesso
 * verso; incatenando i lati per estremi si ottengono gli anelli chiusi. Dove due pixel si toccano
 * solo in diagonale da un angolo escono due lati: si prende sempre quello che gira più a destra,
 * così la scelta è deterministica e i due anelli restano distinti.
 */
function traceLoops(inside: (i: number) => boolean, cells: number[], width: number): Point[][] {
  const cracks = new Map<number, Crack[]>();
  const push = (c: Crack): void => {
    const k = key(c.x0, c.y0);
    const arr = cracks.get(k);
    if (arr) arr.push(c); else cracks.set(k, [c]);
  };
  const pieno = new Set(cells);
  /**
   * Il vicino a (x, y) è pieno? Il controllo su `x` non è pignoleria: senza, `y * width + x` con
   * `x = -1` **scavalca a capo** e finisce sull'ultimo pixel della riga precedente. Se quel pixel è
   * dello stesso colore — e su un fondo che tocca il bordo lo è sempre — il lato sinistro non viene
   * emesso, la catena dei lati si spezza e il contorno non si chiude.
   *
   * Trovato sull'immagine vera di Lorenzo: il fondo scuro, **944.137 pixel**, usciva come 865
   * frammenti da una ventina di pixel quadrati l'uno. Su y non serve: una riga sopra la prima dà una
   * chiave negativa e una sotto l'ultima una chiave oltre la fine, e in nessuno dei due casi la
   * chiave sta nell'insieme.
   */
  const ok = (x: number, y: number): boolean =>
    x >= 0 && x < width && pieno.has(y * width + x) && inside(y * width + x);

  for (const i of cells) {
    const x = i % width, y = (i / width) | 0;
    if (!ok(x, y - 1)) push({ x0: x, y0: y, x1: x + 1, y1: y });               // sopra  → +x
    if (!ok(x + 1, y)) push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });       // destra → +y
    if (!ok(x, y + 1)) push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1 });       // sotto  → −x
    if (!ok(x - 1, y)) push({ x0: x, y0: y + 1, x1: x, y1: y });               // sin.   → −y
  }

  const loops: Point[][] = [];
  const usate = new Set<Crack>();
  for (const [, arr] of cracks) {
    for (const start of arr) {
      if (usate.has(start)) continue;
      const loop: Point[] = [];
      let cur: Crack | undefined = start;
      while (cur && !usate.has(cur)) {
        usate.add(cur);
        loop.push({ x: cur.x0, y: cur.y0 });
        const dx = cur.x1 - cur.x0, dy = cur.y1 - cur.y0;
        const uscenti: Crack[] = (cracks.get(key(cur.x1, cur.y1)) ?? []).filter((c) => !usate.has(c));
        if (!uscenti.length) break;
        // svolta più a destra: rotazione oraria minima rispetto alla direzione d'arrivo
        let best: Crack = uscenti[0];
        let bestScore = -Infinity;
        for (const c of uscenti) {
          const ex = c.x1 - c.x0, ey = c.y1 - c.y0;
          const cross = dx * ey - dy * ex;         // >0 = svolta a destra in coordinate y-giù
          const dot = dx * ex + dy * ey;
          const score = cross > 0 ? 2 : cross < 0 ? 0 : dot > 0 ? 1 : -1;
          if (score > bestScore) { bestScore = score; best = c; }
        }
        cur = best;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

export interface TraceOptions {
  /** Tolleranza della semplificazione del contorno, in mm. */
  simplifyMm?: number;
  /** Area netta minima perché una regione valga la pena, in mm². */
  minAreaMm2?: number;
}

/**
 * Le regioni di un colore: una per macchia connessa, coi suoi fori, in millimetri.
 *
 * Le macchie si contano a **4 vicini** (non in diagonale): due pixel che si toccano solo per un
 * angolo sono due macchie, com'è giusto per il ricamo — il filo lì non ci passa.
 */
export function traceRegions(
  index: Uint8Array,
  width: number,
  height: number,
  colorIndex: number,
  mmPerPx: number,
  opts: TraceOptions = {},
): Region[] {
  const tol = opts.simplifyMm ?? Math.max(0.2, mmPerPx * 1.2);
  const minArea = opts.minAreaMm2 ?? 0;
  const n = width * height;
  const mine = (i: number): boolean => index[i] === colorIndex && index[i] !== NO_COLOR;

  const visto = new Uint8Array(n);
  const stack = new Int32Array(n);
  const out: Region[] = [];

  for (let s = 0; s < n; s++) {
    if (visto[s] || !mine(s)) continue;
    // la macchia connessa
    let sp = 0;
    const cells: number[] = [];
    stack[sp++] = s; visto[s] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      cells.push(i);
      const x = i % width, y = (i / width) | 0;
      if (x > 0 && !visto[i - 1] && mine(i - 1)) { visto[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < width - 1 && !visto[i + 1] && mine(i + 1)) { visto[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && !visto[i - width] && mine(i - width)) { visto[i - width] = 1; stack[sp++] = i - width; }
      if (y < height - 1 && !visto[i + width] && mine(i + width)) { visto[i + width] = 1; stack[sp++] = i + width; }
    }

    const loops = traceLoops(mine, cells, width)
      .map((l) => simplifyPolyline(l.map((p) => ({ x: p.x * mmPerPx, y: p.y * mmPerPx })), tol))
      .filter((l) => l.length >= 4);
    if (!loops.length) continue;

    // Il contorno è l'anello con l'area più grande; gli altri sono fori (sono dentro, per costruzione).
    const conArea = loops.map((l) => ({ l, a: Math.abs(polygonArea(l)) })).sort((p, q) => q.a - p.a);
    const outer = conArea[0].l;
    const holes = conArea.slice(1).map((c) => c.l);
    const areaMm2 = conArea[0].a - holes.reduce((sum, h) => sum + Math.abs(polygonArea(h)), 0);
    if (areaMm2 < minArea) continue;
    out.push({ outer, holes, areaMm2 });
  }

  // dalla più grande alla più piccola: si cuce prima il grosso, e l'ordine è deterministico
  out.sort((a, b) => b.areaMm2 - a.areaMm2 || a.outer[0].x - b.outer[0].x || a.outer[0].y - b.outer[0].y);
  return out;
}

/** Vero se `p` sta dentro la regione: dentro il contorno e fuori da tutti i fori. */
export function pointInRegion(p: Point, r: Region): boolean {
  if (!pointInPolygon(p, r.outer)) return false;
  for (const h of r.holes) if (pointInPolygon(p, h)) return false;
  return true;
}

/** L'area totale di un insieme di regioni, in mm². */
export const regionsAreaMm2 = (rs: Region[]): number => rs.reduce((s, r) => s + r.areaMm2, 0);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Quello che serve a chi la regione se la deve RIEMPIRE, oltre a saperla tracciare.
//
// Nato in `apps/pittorico` (il riempimento curvo), promosso qui il 2026-09-10 quando i clienti
// sono diventati tre: `apps/pettine` e i suoi script lo importavano dall'app con un percorso
// relativo, che è la dipendenza che l'architettura non ammette (un'app dipende dai pacchetti, mai
// da un'altra app). Trasloco a comportamento invariato: stesse funzioni, stesso codice.
//
// Il pezzo che conta è `BoundaryIndex`: il campo di direzione fissa l'orientamento SUL BORDO e lo
// diffonde dentro, quindi ogni nodo della griglia deve chiedere «quanto disto dal bordo, e come
// corre lì?». A forza bruta sono milioni di distanze punto-segmento; a celle, qualche decina.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function makeRegion(outer: Polyline, holes: Polyline[] = []): Region {
  const netti = holes.filter((h) => h && h.length >= 3);
  const area = Math.abs(polygonArea(outer)) - netti.reduce((s, h) => s + Math.abs(polygonArea(h)), 0);
  return { outer, holes: netti, areaMm2: area };
}

/** Contorno e fori insieme: il BORDO della regione, che è ciò che vincola il campo di direzione. */
export const regionRings = (r: Region): Polyline[] => [r.outer, ...r.holes];

export const regionBounds = (r: Region): Bounds => bounds(r.outer);

export interface NearestBoundary {
  distMm: number;
  point: Point;
  /** Versore del lato più vicino. È una DIREZIONE, non un verso: ±t valgono uguale. */
  tangent: Point;
}

/**
 * Il bordo indicizzato a celle, per chiedergli il punto più vicino tante volte.
 *
 * Serve perché il campo armonico fissa la direzione **sul bordo** e la diffonde dentro: ogni nodo
 * della griglia deve sapere quanto dista dal bordo e come corre lì. A forza bruta sono milioni di
 * distanze punto-segmento; a celle sono qualche decina per query.
 */
export class BoundaryIndex {
  private readonly ax: Float64Array;
  private readonly ay: Float64Array;
  private readonly bx: Float64Array;
  private readonly by: Float64Array;
  private readonly cellMm: number;
  private readonly minX: number;
  private readonly minY: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly buckets: number[][];

  constructor(rings: Polyline[], cellMm = 4) {
    const segs: Array<[Point, Point]> = [];
    for (const ring of rings) {
      if (!ring || ring.length < 2) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if (Math.abs(a.x - b.x) > 1e-12 || Math.abs(a.y - b.y) > 1e-12) segs.push([a, b]);
      }
    }
    const n = segs.length;
    this.ax = new Float64Array(n); this.ay = new Float64Array(n);
    this.bx = new Float64Array(n); this.by = new Float64Array(n);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const [a, b] = segs[i];
      this.ax[i] = a.x; this.ay[i] = a.y; this.bx[i] = b.x; this.by[i] = b.y;
      minX = Math.min(minX, a.x, b.x); minY = Math.min(minY, a.y, b.y);
      maxX = Math.max(maxX, a.x, b.x); maxY = Math.max(maxY, a.y, b.y);
    }
    this.cellMm = Math.max(cellMm, 1e-3);
    this.minX = Number.isFinite(minX) ? minX : 0;
    this.minY = Number.isFinite(minY) ? minY : 0;
    this.nx = Math.max(1, Math.ceil((maxX - this.minX) / this.cellMm) + 1);
    this.ny = Math.max(1, Math.ceil((maxY - this.minY) / this.cellMm) + 1);
    this.buckets = Array.from({ length: this.nx * this.ny }, () => [] as number[]);
    for (let i = 0; i < n; i++) {
      // per bbox: una cella che non tocca il bbox del segmento non può contenerne un punto
      const i0 = this.col(Math.min(this.ax[i], this.bx[i])), i1 = this.col(Math.max(this.ax[i], this.bx[i]));
      const j0 = this.row(Math.min(this.ay[i], this.by[i])), j1 = this.row(Math.max(this.ay[i], this.by[i]));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) this.buckets[j * this.nx + k].push(i);
    }
  }

  private col(x: number): number {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) / this.cellMm)));
  }
  private row(y: number): number {
    return Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.minY) / this.cellMm)));
  }

  /** Il punto del bordo più vicino a `p`, con la direzione del lato su cui cade. */
  nearest(p: Point): NearestBoundary {
    const ci = this.col(p.x), cj = this.row(p.y);
    let bestD2 = Infinity, bestI = -1, bestT = 0;
    const maxRing = Math.max(this.nx, this.ny);
    for (let r = 0; r <= maxRing; r++) {
      // le celle dell'anello r distano almeno (r−1)·cella: appena il migliore è più vicino, basta
      if (bestI >= 0 && Math.sqrt(bestD2) <= (r - 1) * this.cellMm) break;
      let visto = false;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= this.ny) continue;
        for (let k = ci - r; k <= ci + r; k++) {
          if (k < 0 || k >= this.nx) continue;
          if (r > 0 && Math.abs(j - cj) !== r && Math.abs(k - ci) !== r) continue; // solo la corona
          visto = true;
          for (const i of this.buckets[j * this.nx + k]) {
            const dx = this.bx[i] - this.ax[i], dy = this.by[i] - this.ay[i];
            const len2 = dx * dx + dy * dy;
            let t = len2 > 0 ? ((p.x - this.ax[i]) * dx + (p.y - this.ay[i]) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = this.ax[i] + dx * t, qy = this.ay[i] + dy * t;
            const d2 = (p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy);
            if (d2 < bestD2) { bestD2 = d2; bestI = i; bestT = t; }
          }
        }
      }
      if (!visto && r > Math.max(this.nx, this.ny)) break;
    }
    if (bestI < 0) return { distMm: Infinity, point: p, tangent: { x: 1, y: 0 } };
    const dx = this.bx[bestI] - this.ax[bestI], dy = this.by[bestI] - this.ay[bestI];
    const len = Math.hypot(dx, dy) || 1;
    return {
      distMm: Math.sqrt(bestD2),
      point: { x: this.ax[bestI] + dx * bestT, y: this.ay[bestI] + dy * bestT },
      tangent: { x: dx / len, y: dy / len },
    };
  }
}

/**
 * IL CONTORNO LISCIO — togliere la scalinata dei pixel senza spostare la forma.
 *
 * Una macchia nata da un'immagine ha un contorno a gradini: e' fatto di lati di pixel, e non c'e'
 * niente di curvo dentro. Quei gradini non sono un dettaglio estetico, sono caos che arriva fino al
 * filo. Si sono gia' visti costare due volte: la corda fra due capi vicini taglia lo scalino e il
 * routing risponde «fuori», e il campo di direzione prende la perpendicolare del gradino invece di
 * quella del bordo vero, cosi' il raso ruota dove il disegno non ruota.
 *
 * La semplificazione da sola non basta e il motivo e' geometrico: una scalinata devia da una retta
 * di circa **un pixel**, quindi Douglas-Peucker con tolleranza di un pixel e mezzo — quella che si
 * usava — puo' solo togliere qualche vertice, non raddrizzare il gradino. E alzare la tolleranza
 * non liscia: taglia gli angoli veri insieme a quelli finti.
 *
 * Qui si fa in tre tempi:
 *
 *   1. si ricampiona l'anello a passo costante, perche' i passi successivi presumono vertici
 *      distribuiti in modo regolare e dopo una semplificazione non lo sono affatto;
 *   2. si applica **Taubin** (λ/μ), cioe' una passata che liscia seguita da una che ri-gonfia. La
 *      media mobile normale liscia e RESTRINGE — su un anello chiuso mangia i convessi a ogni giro,
 *      e a forza di giri una macchia diventa piu' piccola di com'e'. La coppia λ/μ e' fatta apposta
 *      per non restringere, ed e' il motivo per cui non basta una media mobile;
 *   3. si semplifica, per non portarsi dietro migliaia di vertici che ora sono allineati.
 *
 * `mm` e' il raggio della lisciatura: quanto grande e' il dettaglio che sparisce. Zero lascia tutto
 * com'e'.
 */
export function lisciaAnello(ring: Polyline, mm: number, passoMm: number): Polyline {
  if (mm <= 0 || ring.length < 8) return ring;
  const passo = Math.max(passoMm, 1e-3);

  // 1. a passo costante, sull'anello chiuso
  const chiuso = [...ring, ring[0]];
  const uni: Point[] = [];
  let resto = 0;
  for (let i = 1; i < chiuso.length; i++) {
    const a = chiuso[i - 1], b = chiuso[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-12) continue;
    let t = resto;
    while (t < len) {
      uni.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
      t += passo;
    }
    resto = t - len;
  }
  if (uni.length < 8) return ring;

  /*
   * 2. Taubin. Il numero di passate viene dal raggio chiesto: una passata di Laplaciano con λ=0,5
   * ha l'effetto di una gaussiana con σ ≈ passo/√2, e N passate compongono in σ ≈ passo·√(N/2).
   * Invertita: N ≈ 2·(mm/passo)². Il tetto e' li' perche' su un passo molto fine la formula
   * esploderebbe in decine di migliaia di giri per un millimetro di lisciatura.
   */
  const coppie = Math.min(200, Math.max(1, Math.round((mm / passo) ** 2)));
  const LAMBDA = 0.5, MU = -0.53;
  let p = uni;
  const passata = (src: Point[], k: number): Point[] => {
    const n = src.length;
    const out = new Array<Point>(n);
    for (let i = 0; i < n; i++) {
      const a = src[(i - 1 + n) % n], b = src[(i + 1) % n], c = src[i];
      out[i] = { x: c.x + k * ((a.x + b.x) / 2 - c.x), y: c.y + k * ((a.y + b.y) / 2 - c.y) };
    }
    return out;
  };
  for (let k = 0; k < coppie; k++) { p = passata(p, LAMBDA); p = passata(p, MU); }

  // 3. via i vertici ormai allineati. `simplifyPolyline` tiene sempre i capi: si chiude l'anello
  //    prima e si toglie il doppione dopo, cosi' la giunzione non resta un angolo vivo.
  const semplice = simplifyPolyline([...p, p[0]], Math.max(0.05, passo * 0.6));
  if (semplice.length > 4
      && Math.hypot(semplice[0].x - semplice[semplice.length - 1].x,
        semplice[0].y - semplice[semplice.length - 1].y) < 1e-9) semplice.pop();
  return semplice.length >= 4 ? semplice : ring;
}

/** L'intera regione con i contorni lisciati: il guscio esterno e ogni foro. */
export function lisciaRegione(r: Region, mm: number, passoMm: number): Region {
  if (mm <= 0) return r;
  return makeRegion(lisciaAnello(r.outer, mm, passoMm),
    r.holes.map((h) => lisciaAnello(h, mm, passoMm)));
}

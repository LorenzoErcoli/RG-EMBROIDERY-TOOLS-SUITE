// Il RIEMPIMENTO CHE SEGUE IL CAMPO, a densità costante (§4.2 del briefing). È il cuore del tool.
//
// Il problema, in una riga: con l'angolo fisso il passo fra le righe è costante *per costruzione*
// (`buildParallelFill` nel core, R24); appena la direzione ruota quella garanzia salta — sul lato
// esterno della curva le file si allontanano e il filo apre, sul lato interno si stringono e il
// ricamo ingrossa.
//
// La soluzione non è inventata: è il posizionamento di curve a distanza costante di **Jobard &
// Lefer (1997)**, lo standard in visualizzazione di campi vettoriali (è dentro VTK). Si integra una
// fila lungo il campo e la si **ferma quando si avvicina a meno di `d_test`** da una fila già
// accettata; poi si semina una fila nuova **esattamente a `d_sep`** da una esistente. Le file
// nascono e muoiono da sole dove il ventaglio si apre e si chiude: la distanza fra vicine è
// costante per costruzione — il "rinfittimento" ottenuto senza calcolarlo a posteriori.
//
// Cosa fa e cosa NON fa: come `buildParallelFill`, produce le **corse** e si ferma lì. Non le
// collega (è routing), non impone il punto minimo (R3, dopo il routing). Quello che aggiunge
// rispetto al raso è che le corse non sono più righe di una griglia: sono linee di flusso.

import { type Point, type Polyline, segmentPolygonIntersections } from '@rg/core';
import { type Region, regionRings, insideRegion, regionBounds } from './region';
import { type DirectionField } from './field';

export interface CurvedFillOptions {
  /** `d_sep`: distanza voluta fra due file vicine (R22, `densitySpacingMm`). */
  spacingMm: number;
  /** Passo massimo lungo la fila (R4): si suddivide, la forma non cambia. */
  maxStitchMm?: number;
  /**
   * `d_test` / `d_sep`: quanto una fila può avvicinarsi a un'altra prima di fermarsi.
   *
   * **Default 0.55, non 0.5.** Jobard & Lefer usano 0.5, ma il loro scopo è guardare un campo
   * vettoriale: qui questo numero è la DENSITÀ CONSEGNATA, perché decide quanto le file si
   * accavallano. Misurato sulle tre regioni di prova, il filo per mm² rispetto a quello chiesto
   * vale 1.22–1.27 a 0.40, 1.05–1.08 a 0.50, 0.94–0.97 a 0.60, 0.80–0.82 a 0.80: passa per 1.00
   * a 0.55, e ci passa uguale nelle tre regioni (0.99–1.03). Con 0.5 il tool consegnerebbe il 6%
   * di filo in più di quello chiesto — un errore sistematico, non rumore (R22: `densitySpacingMm`
   * è un contratto).
   */
  testRatio?: number;
  /** Passo di integrazione. Default `spacingMm / 3`, con un tetto a 0.5 mm. */
  stepMm?: number;
  /**
   * Quanto un seme deve tenersi lontano dal filo già accettato, in frazione di `d_sep`.
   * Default 0.95, e **mai 1.0**: misurato, fra 0.70 e 0.95 il risultato non cambia di niente (le
   * file nascono comunque dove serve), ma a 1.0 il ventaglio collassa — 13 file invece di 339, il
   * 4% del filo. A 1.0 il seme, che nasce a esattamente `d_sep` dalla fila madre, viene rifiutato
   * dal confronto con la fila madre stessa, e in un campo che diverge non nasce più niente. È il
   * genere di difetto che non si vede se non si misura: il riempimento esce, è solo vuoto.
   */
  seedRatio?: number;
  /**
   * Quanto la distanza di arresto varia da posto a posto, in frazione di `d_sep`. **Default 0**.
   *
   * Serve contro un difetto che i numeri non gridano ma l'occhio vede subito: in un ventaglio tutte
   * le coppie di file raggiungono il vuoto critico **allo stesso raggio**, quindi le file nascono e
   * muoiono tutte insieme e il ricamo mostra un **anello concentrico**. Il disturbo è a media zero
   * (la densità consegnata non cambia) ed è deciso dalla posizione — deterministico, non casuale:
   * stessi parametri, stesso ricamo (§7).
   *
   * Va sull'arresto, non sul seme: misurato, disturbare la soglia del seme non cambia **niente**
   * (404 file e 13,56 m identici da 0 a 0,4), perché una fila nuova nasce comunque, ed è *dove si
   * ferma* a decidere il disegno.
   *
   * **Sta a 0, ed è una strada provata e non riuscita, non un'opzione da accendere.** I numeri la
   * davano buona — sul ventaglio, dove gli anelli ci sono, a 0,3 la dispersione cala su tutte le
   * scale (14,4 → 12,4% su celle da 2 mm, 8,3 → 6,9% su celle da 8 mm), sulla banda col foro, dove
   * anelli non ce ne sono, peggiora (10,2 → 12,0%). Ma **guardandola** l'anello non diventa grana
   * fine: diventa una fascia **frastagliata**, e a occhio è peggio dell'anello che toglie. Resta
   * qui, spenta e con la sua misura, perché la prossima volta che verrà in mente si sappia già
   * com'è andata (`ventaglio-disturbo.svg`).
   */
  jitterRatio?: number;
  /**
   * Quanto la corda di un punto può scostarsi dalla curva, in mm. **Default `spacingMm / 8`**,
   * scelto misurando: sulla banda curva il passo minimo fra file passa da 0,006 mm (corda libera) a
   * 0,165 (0,41 del passo chiesto) e i punti che stanno sotto mezzo passo dal 2,9% all'1,7%, al
   * prezzo del 3% di punti in più. Stringere ancora costa e rende poco; allargare a `d_sep/2`
   * riporta il minimo a 0,05 mm. A 0 il vincolo si spegne e vale il solo punto massimo (R4).
   */
  maxSagittaMm?: number;
  /** Corse più corte di così si buttano. Default `spacingMm`. */
  minRunMm?: number;
  /** Tetto di sicurezza sulla lunghezza di una singola fila, in passi. Default 20000. */
  maxStepsPerRun?: number;
  /** Da dove parte la prima fila. Default: il baricentro se è dentro, altrimenti il primo punto utile. */
  seed?: Point;
  /** Tetto al numero di corse, per non andare in fuga su parametri assurdi. Default 20000. */
  maxRuns?: number;
}

export interface CurvedFillResult {
  runs: Polyline[];
  /** Corse scartate perché più corte di `minRunMm`. */
  discardedShort: number;
  /** Semi provati (accettati + rifiutati perché troppo vicini a una fila esistente). */
  seedsTried: number;
  /** Punti di integrazione registrati: è la risoluzione con cui si misura la distanza fra file. */
  integrationPoints: number;
}

/** Griglia di punti per la domanda «c'è già del filo entro d da qui?». */
class PointGrid {
  private readonly cell: number;
  private readonly map = new Map<number, number[]>();
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private readonly arcs: number[] = [];

  constructor(cellMm: number) { this.cell = Math.max(cellMm, 1e-3); }

  get size(): number { return this.xs.length; }

  private key(ix: number, iy: number): number { return (ix + 1048576) * 2097152 + (iy + 1048576); }

  add(x: number, y: number, arc: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    const bucket = this.map.get(k);
    const idx = this.xs.length;
    this.xs.push(x); this.ys.push(y); this.arcs.push(arc);
    if (bucket) bucket.push(idx); else this.map.set(k, [idx]);
  }

  /**
   * C'è un punto registrato entro `d`? Con `arcGap > 0` si ignorano i punti che distano meno di
   * `arcGap` **lungo la fila** da `arcRef`: è il modo di non far fermare una fila su se stessa
   * appena partita, senza però perderla se si avvolge davvero su di sé.
   */
  anyWithin(x: number, y: number, d: number, arcRef = 0, arcGap = 0): boolean {
    const r = Math.ceil(d / this.cell);
    const ix = Math.floor(x / this.cell), iy = Math.floor(y / this.cell);
    const d2 = d * d;
    for (let j = iy - r; j <= iy + r; j++) {
      for (let i = ix - r; i <= ix + r; i++) {
        const bucket = this.map.get(this.key(i, j));
        if (!bucket) continue;
        for (const q of bucket) {
          if (arcGap > 0 && Math.abs(this.arcs[q] - arcRef) < arcGap) continue;
          const dx = this.xs[q] - x, dy = this.ys[q] - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  }

  merge(other: PointGrid): void {
    for (let i = 0; i < other.xs.length; i++) this.add(other.xs[i], other.ys[i], other.arcs[i]);
  }
}

/**
 * Disturbo in [0,1) deciso dalla posizione. Tutto a numeri interi di proposito: `Math.sin` non è
 * garantito identico bit a bit fra motori JavaScript, e il determinismo (§7) è un'invariante.
 */
function disturbo(x: number, y: number, scalaMm: number): number {
  const ix = Math.round(x / scalaMm) | 0, iy = Math.round(y / scalaMm) | 0;
  let a = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

/** La direzione del campo qui, girata dalla parte in cui stiamo andando (è un line field). */
function aligned(field: DirectionField, p: Point, prev: Point): Point {
  const d = field.dirAt(p);
  return d.x * prev.x + d.y * prev.y < 0 ? { x: -d.x, y: -d.y } : d;
}

/** Dove il segmento a→b esce dalla regione. `a` è dentro, `b` fuori. */
function exitPoint(a: Point, b: Point, region: Region): Point | null {
  let bestT = Infinity, best: Point | null = null;
  for (const ring of regionRings(region)) {
    for (const hit of segmentPolygonIntersections(a, b, ring)) {
      if (hit.t > 1e-9 && hit.t < bestT) { bestT = hit.t; best = hit.point; }
    }
  }
  return best;
}

/**
 * Dalla linea di flusso ai PUNTI-AGO: passo non oltre `stepMm` (R4), **e** corda che non si scosta
 * dalla curva più di `maxSagittaMm`.
 *
 * Il secondo vincolo non è un vezzo geometrico: su un riempimento curvo il punto massimo e la
 * densità **non sono indipendenti**. Il filo fra due punti-ago è un segmento dritto; su una curva
 * quel segmento taglia dentro, e se taglia più della distanza fra le file finisce **sulla fila
 * vicina** — due punti nello stesso buco, accumulo (R20), e la densità che si era appena garantita
 * salta. Misurato sulla banda curva, con la sola regola R4: senza decimare il passo minimo fra file
 * è 0,21 mm (0,52 del passo chiesto) e nessun punto sta sotto mezzo passo; decimando a 1 mm lo
 * 0,07% ci sta sotto, a 2 mm lo 0,84%, a 3 mm il 3,4%, a 5 mm il 10,3% — col minimo sceso a
 * 0,001 mm. Il ventaglio non se ne accorge (le sue file sono dritte): il difetto è **della curva**.
 *
 * Il tetto alla corda si sceglie dal passo fra le file: `d_sep / 8` è il default di chi chiama.
 */
function toStitches(line: Polyline, stepMm: number, maxSagittaMm: number): Polyline {
  if (line.length < 2 || stepMm <= 0) return line.slice();
  const out: Point[] = [line[0]];
  let ancora = 0;
  while (ancora < line.length - 1) {
    let arco = 0, j = ancora;
    let ultimoBuono = ancora + 1;
    while (j < line.length - 1) {
      const passo = Math.hypot(line[j + 1].x - line[j].x, line[j + 1].y - line[j].y);
      if (arco + passo > stepMm + 1e-9) break;
      arco += passo;
      j += 1;
      if (maxSagittaMm > 0 && scostamento(line, ancora, j) > maxSagittaMm) break;
      ultimoBuono = j;
    }
    if (ultimoBuono <= ancora) ultimoBuono = ancora + 1;   // almeno un segmento, sempre
    out.push(line[ultimoBuono]);
    ancora = ultimoBuono;
  }
  return out;
}

/** Quanto la corda da `i` a `j` si scosta dai punti che salta. */
function scostamento(line: Polyline, i: number, j: number): number {
  const a = line[i], b = line[j];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let peggio = 0;
  for (let k = i + 1; k < j; k++) {
    let t = len2 > 0 ? ((line[k].x - a.x) * dx + (line[k].y - a.y) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(line[k].x - (a.x + dx * t), line[k].y - (a.y + dy * t));
    if (d > peggio) peggio = d;
  }
  return peggio;
}

interface Marcia { pts: Point[]; arcs: number[]; }

/**
 * Integra una fila da `start` in un verso, con Runge-Kutta 4, finché non succede una di queste:
 * esce dalla regione (e allora si taglia sul bordo — il riempimento deve arrivarci), si avvicina a
 * meno di `dTest` da una fila già accettata, o si avvicina a se stessa.
 */
function march(
  region: Region, field: DirectionField, start: Point, verso: 1 | -1,
  accepted: PointGrid, current: PointGrid,
  step: number, dTest: number, jitter: number, selfGap: number, maxSteps: number,
): Marcia {
  const d0 = field.dirAt(start);
  let prev: Point = { x: d0.x * verso, y: d0.y * verso };
  const pts: Point[] = [start];
  const arcs: number[] = [0];
  let p = start;
  let arc = 0;

  for (let s = 0; s < maxSteps; s++) {
    const k1 = aligned(field, p, prev);
    const k2 = aligned(field, { x: p.x + (step / 2) * k1.x, y: p.y + (step / 2) * k1.y }, k1);
    const k3 = aligned(field, { x: p.x + (step / 2) * k2.x, y: p.y + (step / 2) * k2.y }, k2);
    const k4 = aligned(field, { x: p.x + step * k3.x, y: p.y + step * k3.y }, k3);
    const vx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
    const vy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
    const m = Math.hypot(vx, vy);
    if (m < 1e-9) break;                                     // campo degenere: si smette
    const next: Point = { x: p.x + step * (vx / m), y: p.y + step * (vy / m) };

    const nextArc = arc + verso * step;
    // il disturbo è costante su celle da 2·d_sep: se cambiasse a ogni passo la fila si fermerebbe
    // alla prima soglia alta capitata, e la densità media si sposterebbe
    const dStop = jitter > 0 ? dTest + jitter * (disturbo(next.x, next.y, jitter * 10) - 0.5) : dTest;

    if (!insideRegion(next, region)) {
      // Il capo si posa SUL bordo — ma anche il capo è filo, e va misurato come il resto.
      // Senza questo controllo due file possono finire a 0,004 mm l'una dall'altra: due punti nello
      // stesso buco, che è accumulo (R20) e si vede. Misurato prima del controllo: il 19-21% dei
      // capi stava sotto mezzo passo, contro l'1,7-3,5% del corpo. Se lì il filo c'è già, la fila
      // finisce un passo prima: la copertura del bordo la fa quell'altra.
      const q = exitPoint(p, next, region);
      const qArc = q ? arc + verso * Math.hypot(q.x - p.x, q.y - p.y) : 0;
      if (q && !accepted.anyWithin(q.x, q.y, dStop) && !current.anyWithin(q.x, q.y, dStop, qArc, selfGap)) {
        pts.push(q); arcs.push(qArc);
      }
      break;
    }
    if (accepted.anyWithin(next.x, next.y, dStop)) break;
    if (current.anyWithin(next.x, next.y, dStop, nextArc, selfGap)) break;

    pts.push(next);
    arcs.push(nextArc);
    current.add(next.x, next.y, nextArc);
    prev = { x: vx / m, y: vy / m };
    p = next;
    arc = nextArc;
  }
  return { pts, arcs };
}

const lunghezza = (line: Polyline): number => {
  let mm = 0;
  for (let i = 1; i < line.length; i++) mm += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  return mm;
};

function primoPuntoDentro(region: Region): Point | null {
  const bb = regionBounds(region);
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  if (insideRegion({ x: cx, y: cy }, region)) return { x: cx, y: cy };
  const passo = Math.max((bb.maxX - bb.minX), (bb.maxY - bb.minY)) / 200;
  for (let y = bb.minY; y <= bb.maxY; y += passo) {
    for (let x = bb.minX; x <= bb.maxX; x += passo) {
      if (insideRegion({ x, y }, region)) return { x, y };
    }
  }
  return null;
}

/**
 * Riempie la regione di file che seguono il campo, **a distanza costante** fra vicine.
 * Le corse escono nell'ordine in cui sono nate; collegarle è routing (R16/R26), non affar suo.
 */
export function buildCurvedFill(
  region: Region, field: DirectionField, opts: CurvedFillOptions,
): CurvedFillResult {
  const dSep = opts.spacingMm;
  const vuoto: CurvedFillResult = { runs: [], discardedShort: 0, seedsTried: 0, integrationPoints: 0 };
  if (!(dSep > 0) || !region.outer || region.outer.length < 3) return vuoto;

  const dTest = dSep * (opts.testRatio ?? 0.55);
  const step = Math.min(opts.stepMm && opts.stepMm > 0 ? opts.stepMm : dSep / 3, 0.5);
  const minRun = opts.minRunMm ?? dSep;
  const maxSteps = Math.max(10, Math.round(opts.maxStepsPerRun ?? 20000));
  const maxRuns = Math.max(1, Math.round(opts.maxRuns ?? 20000));
  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;
  const maxSagitta = opts.maxSagittaMm ?? dSep / 8;
  const selfGap = dSep * 2;
  const seedRatio = opts.seedRatio ?? 0.95;
  const jitter = Math.max(0, opts.jitterRatio ?? 0) * dSep;

  const partenza = opts.seed ?? primoPuntoDentro(region);
  if (!partenza) return vuoto;

  const accepted = new PointGrid(Math.max(dSep, 0.2));
  const coda: Point[] = [partenza];
  const runs: Polyline[] = [];
  let discardedShort = 0, seedsTried = 0;

  while (coda.length && runs.length < maxRuns) {
    const seme = coda.shift() as Point;
    seedsTried++;
    if (!insideRegion(seme, region)) continue;
    if (accepted.anyWithin(seme.x, seme.y, dTest)) continue;

    const current = new PointGrid(Math.max(dSep, 0.2));
    current.add(seme.x, seme.y, 0);
    const avanti = march(region, field, seme, 1, accepted, current, step, dTest, jitter, selfGap, maxSteps);
    const indietro = march(region, field, seme, -1, accepted, current, step, dTest, jitter, selfGap, maxSteps);
    const linea: Point[] = [...indietro.pts.slice(1).reverse(), ...avanti.pts];

    if (lunghezza(linea) < minRun) { discardedShort++; continue; }

    accepted.merge(current);
    runs.push(linea);

    // Semi per le file vicine: a `d_sep` di lato, ogni `d_sep` lungo la fila appena accettata.
    let acc = 0;
    for (let i = 1; i < linea.length; i++) {
      const a = linea[i - 1], b = linea[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      acc += seg;
      if (acc < dSep || seg < 1e-9) continue;
      acc = 0;
      const nx = -(b.y - a.y) / seg, ny = (b.x - a.x) / seg;
      for (const lato of [1, -1]) {
        const c = { x: b.x + nx * dSep * lato, y: b.y + ny * dSep * lato };
        if (!insideRegion(c, region)) continue;
        if (accepted.anyWithin(c.x, c.y, dSep * seedRatio)) continue;
        coda.push(c);
      }
    }
  }

  const finali = maxStitch > 0 ? runs.map((r) => toStitches(r, maxStitch, maxSagitta)) : runs;
  return { runs: finali, discardedShort, seedsTried, integrationPoints: accepted.size };
}

/**
 * Il riempimento curvo INGENUO: si seminano le file a distanza costante su una retta e si lasciano
 * correre, senza la regola della distanza. È il «copy» di Ink/Stitch, ed è qui per una ragione sola
 * — far vedere che il problema esiste. Dove il ventaglio si apre le file si allontanano e il filo
 * apre; dove si chiude si accavallano. Serve come termine di paragone, non come opzione.
 */
export function buildNaiveCurvedFill(
  region: Region, field: DirectionField, opts: CurvedFillOptions,
): CurvedFillResult {
  const dSep = opts.spacingMm;
  const vuoto: CurvedFillResult = { runs: [], discardedShort: 0, seedsTried: 0, integrationPoints: 0 };
  if (!(dSep > 0) || !region.outer || region.outer.length < 3) return vuoto;

  const step = Math.min(opts.stepMm && opts.stepMm > 0 ? opts.stepMm : dSep / 3, 0.5);
  const maxSteps = Math.max(10, Math.round(opts.maxStepsPerRun ?? 20000));
  const minRun = opts.minRunMm ?? dSep;
  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;

  const bb = regionBounds(region);
  const centro = opts.seed ?? primoPuntoDentro(region);
  if (!centro) return vuoto;

  // La retta dei semi passa per il centro, perpendicolare al campo lì: è la "linea guida" copiata.
  const d = field.dirAt(centro);
  const nx = -d.y, ny = d.x;
  const mezzo = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY);

  const vuota = new PointGrid(Math.max(dSep, 0.2));   // resta vuota: nessuna regola di distanza
  const runs: Polyline[] = [];
  let discardedShort = 0, seedsTried = 0;

  const passi = Math.ceil(mezzo / dSep);
  for (let k = -passi; k <= passi; k++) {
    const seme = { x: centro.x + nx * dSep * k, y: centro.y + ny * dSep * k };
    seedsTried++;
    if (!insideRegion(seme, region)) continue;
    const current = new PointGrid(Math.max(dSep, 0.2));
    const avanti = march(region, field, seme, 1, vuota, current, step, 0, 0, 0, maxSteps);
    const indietro = march(region, field, seme, -1, vuota, current, step, 0, 0, 0, maxSteps);
    const linea: Point[] = [...indietro.pts.slice(1).reverse(), ...avanti.pts];
    if (lunghezza(linea) < minRun) { discardedShort++; continue; }
    runs.push(linea);
  }

  const finali = maxStitch > 0 ? runs.map((r) => toStitches(r, maxStitch, opts.maxSagittaMm ?? dSep / 8)) : runs;
  return { runs: finali, discardedShort, seedsTried, integrationPoints: 0 };
}

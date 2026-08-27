// Dalla riduzione al ricamo: regioni → raso → passaggi → punto minimo → fermatura → layer.
//
// L'ordine è quello canonico della Costituzione (§4), e va rispettato: riduzione (import+ruoli) →
// regioni (boundary) → riempimento (placement) → routing (7) → **min-stitch (8)** → **lock (9)** →
// export (10). Il minimo del punto si impone DOPO il routing e non prima (R3): sono proprio le
// giunzioni fra una corsa e l'altra a reintrodurre i micro-segmenti, ed è l'inciampo che striatura
// aveva già pagato — il commento diceva che il pass c'era, e in pipeline non c'era.
//
// Nessun DOM.

import {
  type ExportLayer, type Polyline, type Bounds, type Point,
  THREAD_STROKE_MM, buildParallelFill, fillThreadMm, hexToRgb, enforceMinStitch, resampleUniform, distance,
} from '@rg/core';
import { buildCoverGrid, routeColorRuns, type RegionRuns, type RoutingOptions } from './routing';
import type { BroccatoColor, BroccatoParams } from './engine';
import { traceRegions, type Region } from './regions';
import type { ReduceResult } from './reduce';

/** Cosa esce per un ago: le sue regioni, il filo cucito, e come sono andati i passaggi. */
export interface ColorPlan {
  /** Indice nella palette / nell'ordine di cucitura. */
  index: number;
  color: BroccatoColor;
  regions: Region[];
  /** I tratti cuciti: fra un tratto e il successivo c'e' un salto. */
  blocks: Polyline[];
  threadMm: number;
  pointCount: number;
  /** Filo di solo passaggio, e quanto ne finisce sotto i colori successivi (R16). */
  travelMm: number;
  travelCoveredMm: number;
  travelHorizontalMm: number;
  jumps: number;
  /** Quanto la ricerca guadagna rispetto alla via piu' corta, sugli stessi passaggi. */
  routedMm: number;
  routedCoveredMm: number;
  straightCoveredMm: number;
  routedHorizontalMm: number;
  /** I passaggi instradati, tenuti a parte per poterli guardare e misurare. */
  travels: Polyline[];
}

export interface BroccatoPlan {
  colors: ColorPlan[];
  previewLayers: ExportLayer[];
  /** Un gruppo per STOP in ordine di cucitura, con tinta unica: è quello che va a Stilista. */
  exportLayers: ExportLayer[];
  bounds: Bounds;
  threadMm: number;
  pointCount: number;
  /** Quanti tratti separati in tutto: uno solo per colore = filo continuo. */
  blockCount: number;
  jumps: number;
  travelMm: number;
  travelCoveredMm: number;
  routedMm: number;
  routedCoveredMm: number;
  straightCoveredMm: number;
  routedHorizontalMm: number;
}

/**
 * Tinta UNICA per ogni stop (piccolo scostamento base-13, ≤~5%): due aghi che l'utente ha messo
 * dello stesso colore escono con esadecimali diversi, così Stilista li tratta come cambi-ago
 * distinti. Identico a interlace e bitmap — è una convenzione della suite, non una scelta locale.
 */
function toneColor(hex: string, idx: number): string {
  const h = hex.replace('#', '');
  let r = parseInt(h.slice(0, 2), 16) || 0;
  let g = parseInt(h.slice(2, 4), 16) || 0;
  let b = parseInt(h.slice(4, 6), 16) || 0;
  const or = idx % 13, og = Math.floor(idx / 13) % 13, ob = Math.floor(idx / 169) % 13;
  r = r > 243 ? r - or : r + or;
  g = g > 243 ? g - og : g + og;
  b = b > 243 ? b - ob : b + ob;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const hx = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/**
 * **Fermatura di uscita** (R8, passo 9): qualche punto cortissimo in fondo all'ago, prima del
 * cambio-colore, perché il filo non si sfili quando la macchina taglia.
 *
 * La forma è quella MISURATA sul DST di riferimento, non quella di oblique: là il lock sono 3 punti
 * che marciano lungo il bordo del pannello, qui invece il file mostra **4 punti da 0,30mm in
 * fondo** (in 5 blocchi su 7) e **nessuna fermatura in ingresso**. Sono due tecniche diverse e si
 * segue quella del broccato — divergenza registrata, da confermare col ricamo in mano (R30).
 */
function addEndLock(block: Polyline, count: number, lenMm: number): Polyline {
  if (block.length < 2 || count < 1 || lenMm <= 0) return block;
  const b = block[block.length - 1], a = block[block.length - 2];
  const d = distance(a, b);
  if (d < 1e-6) return block;
  // si marcia avanti e indietro sull'ultimo tratto: nessun punto nuovo fuori dalla forma
  const ux = (a.x - b.x) / d, uy = (a.y - b.y) / d;
  const out: Point[] = [...block];
  for (let i = 1; i <= count; i++) {
    const t = i % 2 === 1 ? lenMm : 0;
    out.push({ x: b.x + ux * t, y: b.y + uy * t });
  }
  return out;
}

/**
 * Passo 8 — MIN-STITCH (R3), col contorno che il pass del core da solo non copre.
 *
 * `enforceMinStitch` preserva SEMPRE gli estremi, ed e' giusto: sono i capi del tratto. Ma proprio
 * per questo non puo' togliere una coda corta o un punto duplicato in fondo, e restavano
 * micro-segmenti (misurati: 3 sotto il minimo e qualche segmento di lunghezza zero, cioe' due punti
 * nello stesso buco — proprio cio' che R3 vieta). Li si toglie qui arretrando il PENULTIMO punto,
 * mai l'ultimo.
 *
 * Poi si rimette il massimo (R4): togliere un punto in mezzo unisce due tratti e puo' allungare il
 * punto oltre il consentito. `resampleUniform` **suddivide soltanto** — non sposta niente — quindi
 * rimette il tetto senza toccare la geometria. Vale finche' il minimo sta sotto meta' del massimo
 * (1 su 3 nei default): una suddivisione in due parti non puo' scendere sotto il minimo.
 */
function minStitched(pl: Polyline, minMm: number, maxMm: number): Polyline {
  const out = enforceMinStitch(pl, minMm);
  while (out.length >= 3 && distance(out[out.length - 1], out[out.length - 2]) < minMm) {
    out.splice(out.length - 2, 1);
  }
  while (out.length >= 2 && distance(out[out.length - 1], out[out.length - 2]) < 1e-9) out.pop();
  return maxMm > 0 ? resampleUniform(out, maxMm) : out;
}

/** Il rettangolo dell'intero lavoro, in mm. La base lo riempie tutto. */
export interface SheetMm { widthMm: number; heightMm: number; }

/** Il contorno del foglio come poligono (la base riempie questo). */
const sheetPolygon = (s: SheetMm): Polyline => [
  { x: 0, y: 0 }, { x: s.widthMm, y: 0 }, { x: s.widthMm, y: s.heightMm }, { x: 0, y: s.heightMm },
];

/**
 * Costruisce il ricamo dalla riduzione.
 *
 * - un colore **escluso** non produce niente;
 * - un colore **base** riempie tutto il foglio a righe intere, e va cucito sotto tutto il resto;
 * - un colore **macchia** riempie le proprie aree.
 *
 * Le righe di tutti gli aghi sono ancorate alla **stessa origine assoluta** (`gridOriginMm` 0):
 * due macchie separate dello stesso colore hanno così le righe alla stessa quota, e sul ricamo non
 * si vede la giunta fra una macchia e l'altra.
 */
export function buildPlan(
  reduced: ReduceResult,
  params: BroccatoParams,
  mmPerPx: number,
  sheet: SheetMm,
  routing: RoutingOptions = {},
): BroccatoPlan {
  const colors: ColorPlan[] = [];
  const previewLayers: ExportLayer[] = [];

  params.colors.forEach((color, i) => {
    if (color.role === 'escluso') return;

    const regions: Region[] = color.role === 'base'
      ? [{ outer: sheetPolygon(sheet), holes: [], areaMm2: sheet.widthMm * sheet.heightMm }]
      : traceRegions(reduced.index, reduced.prepared.width, reduced.prepared.height, i, mmPerPx, {
          minAreaMm2: params.minBlobMm2,
        });

    // Le corse restano raggruppate per macchia: al routing serve sapere da dove vengono, e
    // ricavarlo dopo con un punto-dentro-poligono costerebbe O(macchie) per ogni corsa.
    const groups: RegionRuns[] = regions.map((r) => ({
      region: r,
      runs: buildParallelFill(r.outer, r.holes, {
        angleDeg: params.fillAngleDeg,
        spacingMm: color.densitySpacingMm,
        maxStitchMm: params.maxStitchMm,
        mode: color.mode === 'pettine' ? 'comb' : 'serpentine',
        retraceOffsetMm: params.retraceOffsetMm,
        gridOriginMm: 0,
      }),
    })).filter((g) => g.runs.length);

    // I passaggi si nascondono sotto i colori SUCCESSIVI (R16): la mappa di costo si costruisce
    // guardando cosa verra' cucito dopo questo ago.
    const grid = buildCoverGrid(
      reduced.index, reduced.prepared.width, reduced.prepared.height,
      mmPerPx, i, params.colors, routing.cellMm ?? 1.5,
    );
    const routed = routeColorRuns(groups, grid, { travelStitchMm: params.travelStitchMm, ...routing });

    // Passo 8 — PUNTO MINIMO, dopo il routing (R3). Le giunzioni fra corse, tragitti e corridoi
    // sono esattamente ciò che reintroduce i micro-segmenti: farlo prima non servirebbe a niente.
    // Passo 9 — FERMATURA di uscita sull'ultimo tratto dell'ago (R8).
    let blocks = routed.blocks
      .map((b) => minStitched(b, params.minStitchMm, params.maxStitchMm))
      .filter((b) => b.length >= 2);
    if (blocks.length && params.endLockCount > 0) {
      blocks = blocks.map((b, k) =>
        (k === blocks.length - 1 ? addEndLock(b, params.endLockCount, params.endLockMm) : b));
    }

    const threadMm = fillThreadMm(blocks);
    const pointCount = blocks.reduce((s, r) => s + r.length, 0);
    colors.push({
      index: i, color, regions, blocks, threadMm, pointCount,
      travelMm: routed.travelMm, travelCoveredMm: routed.travelCoveredMm,
      travelHorizontalMm: routed.travelHorizontalMm, jumps: routed.jumps,
      routedMm: routed.routedMm, routedCoveredMm: routed.routedCoveredMm,
      straightCoveredMm: routed.straightCoveredMm, routedHorizontalMm: routed.routedHorizontalMm,
      travels: routed.travels,
    });

    // Anteprima: il filo si disegna SOTTILE (R15) — la larghezza reale del punto sta nella
    // geometria (quanto sono vicine le righe), non nello spessore del tratto.
    previewLayers.push({
      id: `colore-${String(i).padStart(2, '0')}`,
      color: color.hex,
      polylines: blocks,
      strokeMm: THREAD_STROKE_MM,
    });
  });

  // L'export va a Stilista/macchina: un gruppo per STOP nell'ORDINE di cucitura, con tinta unica.
  const exportLayers: ExportLayer[] = colors.map((c, k) => ({
    id: `stop-${String(k).padStart(4, '0')}`,
    color: toneColor(c.color.hex, k),
    polylines: c.blocks,
    strokeMm: THREAD_STROKE_MM,
  }));

  return {
    colors,
    previewLayers,
    exportLayers,
    bounds: { minX: 0, minY: 0, maxX: sheet.widthMm, maxY: sheet.heightMm },
    threadMm: colors.reduce((s, c) => s + c.threadMm, 0),
    pointCount: colors.reduce((s, c) => s + c.pointCount, 0),
    blockCount: colors.reduce((s, c) => s + c.blocks.length, 0),
    jumps: colors.reduce((s, c) => s + c.jumps, 0),
    travelMm: colors.reduce((s, c) => s + c.travelMm, 0),
    travelCoveredMm: colors.reduce((s, c) => s + c.travelCoveredMm, 0),
    routedMm: colors.reduce((s, c) => s + c.routedMm, 0),
    routedCoveredMm: colors.reduce((s, c) => s + c.routedCoveredMm, 0),
    straightCoveredMm: colors.reduce((s, c) => s + c.straightCoveredMm, 0),
    routedHorizontalMm: colors.reduce((s, c) => s + c.routedHorizontalMm, 0),
  };
}

/** Quanto è scuro un colore (0 nero, 1 bianco): serve a scegliere il fondo dell'anteprima. */
export function luminanza(hex: string): number {
  const c = hexToRgb(hex) ?? [0, 0, 0];
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

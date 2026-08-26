// Dalla riduzione al ricamo: regioni → raso → layer pronti per anteprima ed export.
//
// L'ordine è quello canonico della Costituzione (§4): riduzione (import+ruoli) → regioni
// (boundary) → riempimento (placement) → *poi* routing, min-stitch e lock, che sono i punti ④-⑤.
// Qui il collegamento fra una corsa e l'altra ancora non c'è: le corse escono staccate, e ogni
// stacco sarà un salto finché il routing non le cucirà insieme sotto i colori successivi (R16).
//
// Nessun DOM.

import {
  type ExportLayer, type Polyline, THREAD_STROKE_MM,
  buildParallelFill, fillThreadMm, hexToRgb,
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
}

export interface BroccatoPlan {
  colors: ColorPlan[];
  previewLayers: ExportLayer[];
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

    const threadMm = fillThreadMm(routed.blocks);
    const pointCount = routed.blocks.reduce((s, r) => s + r.length, 0);
    colors.push({
      index: i, color, regions, blocks: routed.blocks, threadMm, pointCount,
      travelMm: routed.travelMm, travelCoveredMm: routed.travelCoveredMm,
      travelHorizontalMm: routed.travelHorizontalMm, jumps: routed.jumps,
      routedMm: routed.routedMm, routedCoveredMm: routed.routedCoveredMm,
      straightCoveredMm: routed.straightCoveredMm, routedHorizontalMm: routed.routedHorizontalMm,
    });

    // Anteprima: il filo si disegna SOTTILE (R15) — la larghezza reale del punto sta nella
    // geometria (quanto sono vicine le righe), non nello spessore del tratto.
    previewLayers.push({
      id: `colore-${String(i).padStart(2, '0')}`,
      color: color.hex,
      polylines: routed.blocks,
      strokeMm: THREAD_STROKE_MM,
    });
  });

  return {
    colors,
    previewLayers,
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

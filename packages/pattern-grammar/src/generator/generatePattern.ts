import { THREAD_STROKE_MM } from "@rg/core";
import type { GeneratedPoint, PatternConfig, Point } from "../grammar/types.ts";
import { resolvePatternGrammar } from "../grammar/patternGrammar.ts";
import { exportSvg } from "../exporter/svgExporter.ts";
import { cleanupBoundaryConnectedPath, clipPathToBoundaryChunks, connectClippedChunksAlongBoundary, type TravelMove } from "./applyBoundary.ts";
import { cleanupPolyline, removeConsecutiveDuplicatePoints } from "./cleanupPolyline.ts";
import { generateConnector } from "./generateConnector.ts";
import { generateModule, type ModulePhase } from "./generateModule.ts";
import { columnDirection, orderColumnBlocks, type ColumnDirection } from "./orderColumn.ts";
import { pointBounds } from "./layoutPoints.ts";
import { splitTravelJumps } from "./splitTravelJumps.ts";
import { adjustVerticalConnectorDiagonals } from "./adjustVerticalConnectors.ts";
import { subdivideLongSegments } from "./subdivideLongSegments.ts";
import { orientPolylinesFromTopLeft, type StartOrientation } from "./orientStartPoint.ts";

const translate = (points: GeneratedPoint[], x: number, y: number): GeneratedPoint[] =>
  points.map((point) => ({ ...point, x: point.x + x, y: point.y + y }));

export type VisualPathGroup = {
  subpaths: GeneratedPoint[][];
  columnIndex?: number;
};

export type FinalPatternPoints = {
  points: GeneratedPoint[];
  width: number;
  height: number;
  strokeWidth: number;
  grammar: ReturnType<typeof resolvePatternGrammar>;
  generatedPointCount: number;
  visualPolylines: GeneratedPoint[][];
  visualPathGroups: VisualPathGroup[];
  startOrientation?: StartOrientation;
  boundaryTravelMoves: TravelMove[];
};

export type ExportReport = {
  totalPoints: number;
  polylineCount: number;
  pathCount: number;
  chunkCount: number;
  maxPointsPerPath: number;
  maxPointsInSinglePath: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  svgSizeMm: { width: number; height: number };
  estimatedFileBytes: number;
  outsideViewBox: { count: number; first?: Point };
  duplicateConsecutivePoints: number;
  microSegments: { thresholdMm: number; count: number };
  compatibilityMode: "normal" | "illustrator-safe";
  warnings: string[];
};
const ILLUSTRATOR_SAFE_MAX_POINTS_PER_PATH = 5_000;

/** Single source of truth used by both SVG export and browser preview. */
export function generateFinalPatternPoints(config: PatternConfig): FinalPatternPoints {
  const grammar = resolvePatternGrammar(config);
  const marginX = grammar.moduleWidth * 1.6;
  const marginY = grammar.constructionStroke * 3;
  const path: GeneratedPoint[] = [];
  const baseShape = {
    horizontalZigzagWidth: grammar.horizontalZigzagWidth,
    horizontalZigzagHeight: grammar.horizontalZigzagHeight,
    horizontalZigzagPasses: grammar.horizontalZigzagPasses,
    horizontalZigzagOffsetX: grammar.horizontalZigzagOffsetX,
    columnSpacing: grammar.stepX,
    verticalZigzagWidth: grammar.verticalZigzagWidth,
    verticalZigzagPasses: grammar.verticalZigzagPasses
  };
  const shapeForColumn = (column: number) => ({
    ...baseShape,
    horizontalAngleDeg: grammar.horizontalAngleDeg
      * (grammar.alternateHorizontalAngle && column % 2 === 0 ? -1 : 1)
  });

  const appendOrderedPoints = (points: GeneratedPoint[]) => {
    const ordered = points.slice();
    if (path.length && ordered.length && path.at(-1)!.x === ordered[0].x && path.at(-1)!.y === ordered[0].y) ordered.shift();
    path.push(...ordered);
  };

  const phaseBlocks = (column: number, phase: ModulePhase): GeneratedPoint[][] => {
    const x = marginX + column * grammar.stepX;
    const offset = column % 2 === 0 ? 0 : grammar.offsetY;
    const blocks = Array.from({ length: grammar.rows }, (_, row) =>
      translate(
        generateModule(grammar.moduleWidth, grammar.moduleHeight, phase, 1, shapeForColumn(column)).points,
        x,
        marginY + row * grammar.stepY + offset
      ).map((point) => ({ ...point, columnIndex: column, blockIndex: row }))
    );
    return phase === "vertical"
      ? adjustVerticalConnectorDiagonals(blocks, grammar.verticalConnectorDiagonalOffsetY)
      : blocks;
  };

  const orderedPhase = (column: number, phase: ModulePhase, direction: ColumnDirection) =>
    orderColumnBlocks(phaseBlocks(column, phase), direction);

  const phaseDirection = (phase: ModulePhase, traversalIndex: number): ColumnDirection => {
    if (!grammar.repeatBack) return phase === "horizontal" ? "bottomToTop" : "topToBottom";
    return columnDirection(traversalIndex, true);
  };

  const appendPhase = (column: number, phase: ModulePhase, traversalIndex: number) => {
    const direction = phaseDirection(phase, traversalIndex);
    appendOrderedPoints(orderedPhase(column, phase, direction));
  };

  const phaseStart = (column: number, phase: ModulePhase, traversalIndex: number): GeneratedPoint =>
    orderedPhase(column, phase, phaseDirection(phase, traversalIndex))[0];

  const connectTo = (target: Point) => {
    const targetPoint = target as GeneratedPoint;
    const connectorPoints = grammar.useConnectors && !grammar.repeatBack
      ? generateConnector(path.at(-1)!, target, grammar.stepY * 0.08)
      : [{ ...target, role: grammar.repeatBack ? ("travel" as const) : ("structural" as const), source: "connector" as const }];
    path.push(...connectorPoints.map((point) => ({
      ...point,
      columnIndex: targetPoint.columnIndex,
      blockIndex: targetPoint.blockIndex
    })));
  };

  const generateNormalTraversal = () => {
    let traversalIndex = 0;
    appendPhase(0, "vertical", traversalIndex);
    for (let column = 0; column < grammar.columns - 1; column++) {
      traversalIndex++;
      connectTo(phaseStart(column + 1, "horizontal", traversalIndex));
      appendPhase(column + 1, "horizontal", traversalIndex);
      traversalIndex++;
      connectTo(phaseStart(column + 1, "vertical", traversalIndex));
      appendPhase(column + 1, "vertical", traversalIndex);
    }
  };

  const generateBoustrophedonHorizontalColumns = () => {
    for (let column = 0; column < grammar.columns; column++) {
      const direction = columnDirection(column, true);
      const ordered = orderedPhase(column, "horizontal", direction);
      if (path.length && ordered.length) {
        const target = ordered[0];
        if (path.at(-1)!.x !== target.x || path.at(-1)!.y !== target.y) {
          path.push({ x: target.x, y: target.y, role: "structural", source: "connector" });
        }
      }
      appendOrderedPoints(ordered);
    }
  };

  if (grammar.repeatBack) generateBoustrophedonHorizontalColumns();
  else generateNormalTraversal();

  const sequencedPath = path.map((point, sequenceIndex) => ({ ...point, sequenceIndex }));
  const deformed = grammar.columnWaveAmplitude === 0 ? sequencedPath : sequencedPath.map((point) => ({
    ...point,
    x: point.x + Math.sin(point.y * grammar.columnWaveFrequency + grammar.columnWavePhase) * grammar.columnWaveAmplitude,
    y: point.y
  }));
  const rawScaled = deformed.map((point) => ({ ...point, x: point.x * grammar.scale, y: point.y * grammar.scale }));
  const rawBounds = pointBounds(rawScaled);
  const inset = grammar.constructionStroke * grammar.scale;
  const scaled = rawScaled.map((point) => ({
    ...point,
    x: point.x - rawBounds.minX + inset,
    y: point.y - rawBounds.minY + inset
  }));
  const naturalWidth = rawBounds.width + inset * 2;
  const naturalHeight = rawBounds.height + inset * 2;
  // Coordinates are already millimeters. Panel dimensions can add empty space,
  // but they must never fit/scale the generated geometry or UI parameters stop
  // matching real physical measurements.
  const importedBounds = grammar.shapeType === "imported" ? grammar.importedBoundary?.bounds : undefined;
  const importedWidth = importedBounds ? Math.max(0, importedBounds.maxX) : 0;
  const importedHeight = importedBounds ? Math.max(0, importedBounds.maxY) : 0;
  const usesImportedBoundary = Boolean(importedBounds);
  // ⑤ Formato esatto: se l'utente fissa larghezza/altezza, il pannello è QUELLO. La geometria
  //    in eccesso si TAGLIA al bordo (rifila), non si allarga il pannello. Senza formato dichiarato
  //    resta la dimensione naturale del disegno.
  const width = usesImportedBoundary
    ? Math.max(grammar.totalWidth ?? importedWidth, importedWidth)
    : (grammar.totalWidth ?? naturalWidth);
  const height = usesImportedBoundary
    ? Math.max(grammar.totalHeight ?? importedHeight, importedHeight)
    : (grammar.totalHeight ?? naturalHeight);
  // "Nessuna sagoma di ritaglio" + un formato impostato = il pannello è comunque delimitato dal
  //    suo rettangolo (è il bordo del pannello, non un ritaglio interno). Le forme vere (cerchio,
  //    rombo, importata) restano come scelte.
  const clipShape = (grammar.shapeType === "none" && (grammar.totalWidth !== undefined || grammar.totalHeight !== undefined))
    ? "rectangle"
    : grammar.shapeType;
  const layoutPoints = scaled;
  const clipResult = clipPathToBoundaryChunks(layoutPoints, {
    width,
    height,
    inset,
    shapeType: clipShape,
    importedBoundary: grammar.importedBoundary
  });
  const cleanedChunks = clipResult.chunks
    .map((chunk) => removeConsecutiveDuplicatePoints(cleanupPolyline(chunk.points, {
      minSegmentLength: grammar.minPointDistance,
      preserveSharpAngles: grammar.preserveSharpAngles,
      angleThresholdDeg: grammar.angleThresholdDeg
    })))
    .filter((chunk) => chunk.length > 1);
  const clippedToShape = clipShape === "circle" || clipShape === "diamond" || clipShape === "imported" || clipShape === "rectangle";
  const cleanedPoints = cleanedChunks.flat();
  const baseVisualPolylines = grammar.repeatBack
    ? [cleanedPoints]
    : grammar.useConnectors ? [cleanedPoints] : splitTravelJumps(cleanedPoints);
  const stitchedPolylines = (clippedToShape ? cleanedChunks : baseVisualPolylines)
    .map((polyline) => removeConsecutiveDuplicatePoints(subdivideLongSegments(polyline, grammar.maxStitchLength)))
    .filter((polyline) => polyline.length > 1);
  const connectedBoundaryPath = clippedToShape
    ? removeConsecutiveDuplicatePoints(cleanupBoundaryConnectedPath(
      connectClippedChunksAlongBoundary(
        stitchedPolylines.map((points, index) => ({ points, sourceStartIndex: index, sourceEndIndex: index })),
        { width, height, inset, shapeType: clipShape, importedBoundary: grammar.importedBoundary, connectorStep: Math.max(1, grammar.maxStitchLength || grammar.constructionStroke * 4) }
      ),
      {
        width,
        height,
        inset,
        shapeType: clipShape,
        importedBoundary: grammar.importedBoundary,
        minPointDistance: grammar.minPointDistance,
        boundaryCleanupMode: grammar.boundaryCleanupMode,
        maxBoundaryAdjustment: grammar.maxBoundaryAdjustment
      }
    ))
    : [];
  const oriented = clippedToShape
    ? { polylines: connectedBoundaryPath.length > 1 ? [connectedBoundaryPath] : [], orientation: undefined }
    : orientPolylinesFromTopLeft(stitchedPolylines);
  // R4 — la suddivisione va rifatta ALLA FINE. La prima passata avviene prima della riconnessione al
  // bordo, che poi crea segmenti nuovi (connettori, rientri): è lo stesso inciampo di R3, dove sono
  // le giunzioni del routing a reintrodurre i micro-punti. Misurato: con "punto massimo" a 4mm
  // uscivano segmenti da 7.9mm. Suddividere **non sposta nessun punto esistente** — la forma
  // disegnata resta identica al millesimo, cambia solo quanto è fitta la punzonatura.
  // Con `maxStitchLength` a 0 (default) la funzione restituisce la lista invariata.
  const visualPolylines = oriented.polylines
    .map((polyline) => removeConsecutiveDuplicatePoints(subdivideLongSegments(polyline, grammar.maxStitchLength)))
    .filter((polyline) => polyline.length > 1);
  const visualPathGroups = clippedToShape
    ? [{ subpaths: visualPolylines }]
    : visualPolylines.map((polyline) => ({
      subpaths: [polyline],
      columnIndex: polyline[0]?.columnIndex
    }));
  const finalPoints = visualPolylines.flat();
  return {
    points: finalPoints,
    visualPolylines,
    visualPathGroups,
    width,
    height,
    strokeWidth: THREAD_STROKE_MM, // filo disegnato sempre sottile (R15); la geometria usa constructionStroke
    grammar,
    generatedPointCount: scaled.length,
    startOrientation: oriented.orientation,
    boundaryTravelMoves: clipResult.travelMoves
  };
}

export function groupPolylinesByColumn(polylines: GeneratedPoint[][]): VisualPathGroup[] {
  const groups: VisualPathGroup[] = [];
  const byColumn = new Map<number | undefined, VisualPathGroup>();
  for (const polyline of polylines) {
    const columnIndex = polyline.find((point) => point.columnIndex !== undefined)?.columnIndex;
    let group = byColumn.get(columnIndex);
    if (!group) {
      group = { columnIndex, subpaths: [] };
      byColumn.set(columnIndex, group);
      groups.push(group);
    }
    group.subpaths.push(polyline);
  }
  return groups;
}

function countConsecutiveDuplicates(points: Point[], tolerance = 0.0005): number {
  let count = 0;
  for (let index = 1; index < points.length; index++) {
    if (Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y) <= tolerance) {
      count++;
    }
  }
  return count;
}

function countMicroSegments(points: Point[], thresholdMm: number): number {
  let count = 0;
  for (let index = 1; index < points.length; index++) {
    const distance = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    if (distance > 0 && distance < thresholdMm) count++;
  }
  return count;
}

function findOutsideViewBox(points: Point[], width: number, height: number): { count: number; first?: Point } {
  let first: Point | undefined;
  let count = 0;
  for (const point of points) {
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
      first ??= point;
      count++;
    }
  }
  return { count, first };
}

export function splitLongPolylines<T extends Point>(polylines: T[][], maxPointsPerPath: number): T[][] {
  if (maxPointsPerPath < 2) return polylines;
  const chunks: T[][] = [];
  for (const polyline of polylines) {
    if (polyline.length <= maxPointsPerPath) {
      chunks.push(polyline);
      continue;
    }
    let start = 0;
    while (start < polyline.length) {
      const capacity = start === 0 ? maxPointsPerPath : maxPointsPerPath - 1;
      const end = Math.min(polyline.length, start + capacity);
      const chunk = polyline.slice(start, end);
      if (start > 0) chunk.unshift(polyline[start - 1]);
      chunks.push(chunk);
      start = end;
    }
  }
  return chunks;
}

const groupPointCount = (group: VisualPathGroup): number =>
  group.subpaths.reduce((sum, subpath) => sum + subpath.length, 0);

function splitPathGroupByPointLimit(group: VisualPathGroup, maxPointsPerPath: number): VisualPathGroup[] {
  const splitSubpaths = splitLongPolylines(group.subpaths, maxPointsPerPath);
  const groups: VisualPathGroup[] = [];
  let current: VisualPathGroup = { columnIndex: group.columnIndex, subpaths: [] };
  let currentCount = 0;

  for (const subpath of splitSubpaths) {
    if (current.subpaths.length && currentCount + subpath.length > maxPointsPerPath) {
      groups.push(current);
      current = { columnIndex: group.columnIndex, subpaths: [] };
      currentCount = 0;
    }
    current.subpaths.push(subpath);
    currentCount += subpath.length;
  }

  if (current.subpaths.length) groups.push(current);
  return groups;
}

export function exportPathGroupsForCompatibility(final: FinalPatternPoints): VisualPathGroup[] {
  return final.grammar.exportCompatibilityMode === "illustrator-safe"
    ? final.visualPathGroups.flatMap((group) => splitPathGroupByPointLimit(group, ILLUSTRATOR_SAFE_MAX_POINTS_PER_PATH))
    : final.visualPathGroups;
}

export function exportPolylinesForCompatibility(final: FinalPatternPoints): GeneratedPoint[][] {
  return exportPathGroupsForCompatibility(final).flatMap((group) => group.subpaths);
}

export function createExportReport(
  final: FinalPatternPoints,
  estimatedFileBytes = 0,
  exportedGroups = exportPathGroupsForCompatibility(final)
): ExportReport {
  const exportedPolylines = exportedGroups.flatMap((group) => group.subpaths);
  const exportedPoints = exportedPolylines.flat();
  const bounds = pointBounds(exportedPoints);
  const compatibilityMode = final.grammar.exportCompatibilityMode;
  const usesPathElements = compatibilityMode === "illustrator-safe"
    || final.grammar.shapeType === "circle"
    || final.grammar.shapeType === "diamond"
    || final.grammar.shapeType === "imported"
    || exportedGroups.some((group) => group.subpaths.length > 1);
  const outsideViewBox = findOutsideViewBox(exportedPoints, final.width, final.height);
  const microThreshold = Math.max(0.001, final.grammar.minPointDistance || 0.01);
  const microSegments = countMicroSegments(exportedPoints, microThreshold);
  const duplicateConsecutivePoints = countConsecutiveDuplicates(exportedPoints);
  const warnings: string[] = [];
  if (final.width > 5000 || final.height > 5000) warnings.push("SVG fisicamente molto grande: Illustrator puo aprirlo fuori area visibile o molto zoomato.");
  if (compatibilityMode === "normal" && exportedPoints.length > 5000) warnings.push("Numero punti alto per un singolo tracciato: usare illustrator-safe per dividerlo in chunk.");
  if (exportedPoints.length > 50000) warnings.push("Numero punti totale alto: Illustrator puo rallentare anche con chunk multipli.");
  if (estimatedFileBytes > 5_000_000) warnings.push("File SVG pesante: valutare minPointDistance o illustrator-safe.");
  if (outsideViewBox.count > 0) warnings.push("Sono presenti coordinate fuori dal viewBox.");
  if (duplicateConsecutivePoints > 0) warnings.push("Sono presenti punti consecutivi duplicati.");
  if (microSegments > 0) warnings.push("Sono presenti micro-segmenti sotto la soglia diagnostica.");
  if (compatibilityMode === "illustrator-safe") warnings.push("Illustrator-safe esporta path con stile inline e divide i tracciati oltre 5000 punti.");
  return {
    totalPoints: exportedPoints.length,
    polylineCount: usesPathElements ? 0 : exportedGroups.length,
    pathCount: usesPathElements ? exportedGroups.length : 0,
    chunkCount: exportedGroups.length,
    maxPointsPerPath: compatibilityMode === "illustrator-safe" ? ILLUSTRATOR_SAFE_MAX_POINTS_PER_PATH : 0,
    maxPointsInSinglePath: Math.max(0, ...exportedGroups.map(groupPointCount)),
    boundingBox: bounds,
    svgSizeMm: { width: final.width, height: final.height },
    estimatedFileBytes,
    outsideViewBox,
    duplicateConsecutivePoints,
    microSegments: { thresholdMm: microThreshold, count: microSegments },
    compatibilityMode,
    warnings
  };
}

export function generatePattern(config: PatternConfig): string {
  const final = generateFinalPatternPoints(config);
  const exportGroups = exportPathGroupsForCompatibility(final);
  const hasSubpaths = exportGroups.some((group) => group.subpaths.length > 1);
  const elementType = final.grammar.exportCompatibilityMode === "illustrator-safe" || hasSubpaths
    || final.grammar.shapeType === "circle" || final.grammar.shapeType === "diamond" || final.grammar.shapeType === "imported"
    ? "path"
    : "polyline";
  const exportLines = exportGroups.map((group) => ({
    ...(elementType === "path" ? { subpaths: group.subpaths } : { points: group.subpaths[0] }),
    className: "continuous-pattern",
    dataAttributes: { column: group.columnIndex }
  }));
  const { sourceAnalysis, ...sourceConfig } = config;
  const metadataBase = {
    grammar: final.grammar,
    parameters: final.grammar,
    sourceConfig,
    topology: final.visualPolylines.length === 1 ? "single-continuous-polyline" : "ordered-visual-polylines",
    traversal: final.grammar.repeatBack ? "alternating-column-boustrophedon" : "vertical-down-horizontal-up",
    boundaryMethod: final.grammar.shapeType === "circle" || final.grammar.shapeType === "diamond" || final.grammar.shapeType === "imported"
      ? "path-order-preserving-boundary-reconnected-clipping"
      : "none",
    boundaryTravelMoves: final.boundaryTravelMoves.length,
    boundaryConnectorCount: final.points.filter((point) => point.role === "boundaryConnector").length,
    pointCount: { generated: final.generatedPointCount, exported: final.points.length },
    startRule: {
      mode: final.grammar.shapeType === "circle" || final.grammar.shapeType === "diamond" || final.grammar.shapeType === "imported"
        ? "path-order-preserved-after-clipping"
        : "top-left-nearest-visible-endpoint",
      target: final.startOrientation?.target,
      startPoint: final.startOrientation?.startPoint,
      reversed: final.startOrientation?.reversed ?? false
    },
    units: "mm",
    layoutMode: "real-size-no-fit-scaling",
    generatedBy: "pattern-grammar-engine"
  };
  const draft = exportSvg({
    width: final.width,
    height: final.height,
    strokeWidth: final.strokeWidth,
    elementType,
    inlineStyles: final.grammar.exportCompatibilityMode === "illustrator-safe",
    polylines: exportLines,
    metadata: { ...metadataBase, exportReport: createExportReport(final, 0, exportGroups) }
  });
  return exportSvg({
    width: final.width,
    height: final.height,
    strokeWidth: final.strokeWidth,
    elementType,
    inlineStyles: final.grammar.exportCompatibilityMode === "illustrator-safe",
    polylines: exportLines,
    metadata: { ...metadataBase, exportReport: createExportReport(final, new TextEncoder().encode(draft).length, exportGroups) }
  });
}

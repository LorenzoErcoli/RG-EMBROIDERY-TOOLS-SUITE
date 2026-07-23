import type { BoundaryCleanupMode, ExportCompatibilityMode, ImportedBoundary, PatternAnalysis, PatternConfig, ShapeType } from "./types.ts";

export type ResolvedPatternGrammar = {
  columns: number;
  rows: number;
  totalWidth?: number;
  totalHeight?: number;
  parameterScalePercent: number;
  stepX: number;
  stepY: number;
  offsetY: number;
  moduleWidth: number;
  moduleHeight: number;
  horizontalZigzagWidth: number;
  horizontalZigzagHeight: number;
  horizontalZigzagInterline: number;
  horizontalZigzagPasses: number;
  horizontalZigzagOffsetX: number;
  horizontalZigzagSpacing: number;
  verticalZigzagWidth: number;
  verticalZigzagInterline: number;
  verticalZigzagPasses: number;
  verticalConnectorDiagonalOffsetY: number;
  scale: number;
  constructionStroke: number;
  useConnectors: boolean;
  repeatBack: boolean;
  minSegmentLength: number;
  minPointDistance: number;
  maxStitchLength: number;
  preserveSharpAngles: boolean;
  angleThresholdDeg: number;
  horizontalAngleDeg: number;
  alternateHorizontalAngle: boolean;
  columnWaveAmplitude: number;
  columnWaveFrequency: number;
  columnWavePhase: number;
  shapeType: ShapeType;
  importedBoundary?: ImportedBoundary;
  boundaryCleanupMode: BoundaryCleanupMode;
  maxBoundaryAdjustment: number;
  exportCompatibilityMode: ExportCompatibilityMode;
};

function passesFromLinearInterline(span: number, interline: number): number {
  if (interline <= 0 || span <= interline) return 1;
  return Math.max(1, Math.round(span / interline));
}

function verticalPassesFromInterline(width: number, interline: number): number {
  if (interline <= 0 || width <= interline) return 1;
  return Math.max(2, Math.round(width / interline) + 1);
}

export function resolvePatternGrammar(config: PatternConfig): ResolvedPatternGrammar {
  const analysis: PatternAnalysis | undefined = config.sourceAnalysis;
  const parameterScalePercent = config.parameterScalePercent ?? 100;
  const parameterScale = Math.max(0.001, parameterScalePercent / 100);
  const scaled = (value: number) => value * parameterScale;
  const horizontalZigzagWidth = scaled(config.horizontalZigzagWidth ?? config.horizontalCordWidth ?? 5.5);
  const horizontalZigzagHeight = scaled(config.horizontalZigzagHeight ?? 4.3);
  const horizontalZigzagPasses = config.horizontalZigzagInterline !== undefined
    ? passesFromLinearInterline(horizontalZigzagHeight, config.horizontalZigzagInterline)
    : Math.max(1, Math.floor(config.horizontalZigzagPasses ?? config.horizontalZigzagCount ?? config.density ?? 4));
  const horizontalZigzagInterline = config.horizontalZigzagInterline
    ?? (horizontalZigzagPasses > 0 ? horizontalZigzagHeight / horizontalZigzagPasses : horizontalZigzagHeight);
  const horizontalZigzagSpacing = scaled(config.horizontalZigzagSpacing ?? config.cellHeight ?? config.moduleHeight
    ?? analysis?.estimatedGrid.stepY ?? 12);
  const verticalZigzagWidth = scaled(config.verticalZigzagWidth ?? 1.2);
  const verticalZigzagPasses = config.verticalZigzagInterline !== undefined
    ? verticalPassesFromInterline(verticalZigzagWidth, config.verticalZigzagInterline)
    : Math.max(1, Math.floor(config.verticalZigzagPasses ?? config.density ?? 2));
  const verticalZigzagInterline = config.verticalZigzagInterline
    ?? (verticalZigzagPasses > 1 ? verticalZigzagWidth / (verticalZigzagPasses - 1) : verticalZigzagWidth);
  const minPointDistance = scaled(Math.max(0, config.minStitchMm ?? config.minPointDistance ?? config.minSegmentLength ?? 0));
  const maxStitchLength = Math.max(0, config.maxStitchMm ?? config.maxStitchLength ?? 0);
  // Onda (⑦): l'utente dà lunghezza d'onda (mm) e fase (gradi); la matematica interna vuole rad/mm e rad.
  const columnWaveFrequency = config.columnWaveLengthMm !== undefined
    ? (config.columnWaveLengthMm > 0 ? (2 * Math.PI) / config.columnWaveLengthMm : 0)
    : (config.columnWaveFrequency ?? 0.1);
  const columnWavePhase = config.columnWavePhaseDeg !== undefined
    ? (config.columnWavePhaseDeg * Math.PI) / 180
    : (config.columnWavePhase ?? 0);
  const moduleWidth = scaled(config.cellWidth ?? config.moduleWidth ?? analysis?.estimatedGrid.stepX ?? 5.2);
  const moduleHeight = horizontalZigzagSpacing;
  const stepX = config.stepX !== undefined ? scaled(config.stepX) : moduleWidth;
  const stepY = config.stepY !== undefined ? scaled(config.stepY) : horizontalZigzagSpacing;
  const changesGeometry = config.cellWidth !== undefined || config.cellHeight !== undefined
    || config.moduleWidth !== undefined || config.moduleHeight !== undefined
    || config.horizontalZigzagSpacing !== undefined || config.horizontalZigzagWidth !== undefined
    || config.horizontalZigzagHeight !== undefined || config.horizontalZigzagInterline !== undefined
    || config.parameterScalePercent !== undefined
    || config.verticalZigzagPasses !== undefined || config.verticalZigzagInterline !== undefined;
  return {
    columns: Math.max(1, Math.floor(config.columns ?? (config.totalWidth ? Math.ceil(config.totalWidth / stepX) + 2 : 5))),
    rows: Math.max(1, Math.floor(config.rows ?? (config.totalHeight ? Math.ceil(config.totalHeight / stepY) + 2 : 5))),
    totalWidth: config.totalWidth,
    totalHeight: config.totalHeight,
    parameterScalePercent,
    stepX,
    stepY,
    offsetY: config.offsetY !== undefined
      ? scaled(config.offsetY)
      : (!changesGeometry && analysis?.estimatedGrid.offsetY !== undefined)
        ? scaled(analysis.estimatedGrid.offsetY)
        : stepY / 2,
    moduleWidth,
    moduleHeight,
    horizontalZigzagWidth,
    horizontalZigzagHeight,
    horizontalZigzagInterline,
    horizontalZigzagPasses,
    horizontalZigzagOffsetX: scaled(config.horizontalZigzagOffsetX ?? 0),
    horizontalZigzagSpacing,
    verticalZigzagWidth,
    verticalZigzagInterline,
    verticalZigzagPasses,
    verticalConnectorDiagonalOffsetY: scaled(config.verticalConnectorDiagonalOffsetY ?? 0),
    scale: config.scale ?? 1,
    constructionStroke: scaled(config.constructionStroke ?? config.strokeWidth ?? 0.3),
    useConnectors: config.useConnectors ?? true,
    repeatBack: config.repeatBack ?? false,
    minSegmentLength: minPointDistance,
    minPointDistance,
    maxStitchLength,
    preserveSharpAngles: config.preserveSharpAngles ?? true,
    angleThresholdDeg: config.angleThresholdDeg ?? 35,
    horizontalAngleDeg: config.horizontalAngleDeg ?? 0,
    alternateHorizontalAngle: config.alternateHorizontalAngle ?? false,
    columnWaveAmplitude: scaled(config.columnWaveAmplitude ?? 0),
    columnWaveFrequency,
    columnWavePhase,
    shapeType: config.shapeType ?? "none",
    importedBoundary: config.importedBoundary,
    boundaryCleanupMode: config.boundaryCleanupMode ?? "adjust-then-delete",
    maxBoundaryAdjustment: config.maxBoundaryAdjustment !== undefined && config.maxBoundaryAdjustment > 0
      ? Math.max(0, config.maxBoundaryAdjustment)
      : minPointDistance,
    exportCompatibilityMode: config.exportCompatibilityMode ?? "normal"
  };
}

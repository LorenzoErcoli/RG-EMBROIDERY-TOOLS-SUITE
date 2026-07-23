export type Point = { x: number; y: number };
export type PointRole = "structural" | "intermediate" | "subdivision" | "boundary" | "boundaryConnector" | "travel";
export type PointSource = "horizontalZigzag" | "verticalZigzag" | "connector";
export type GeneratedPoint = Point & {
  role: PointRole;
  source?: PointSource;
  columnIndex?: number;
  blockIndex?: number;
  sequenceIndex?: number;
};
export type ViewBox = { x: number; y: number; width: number; height: number };
export type ShapeType = "none" | "rectangle" | "circle" | "diamond" | "imported";
export type ExportCompatibilityMode = "normal" | "illustrator-safe";
export type BoundaryCleanupMode = "delete" | "adjust-then-delete";
export type SvgGeometry = {
  type: "path" | "polyline" | "polygon" | "line";
  points: Point[];
  closed: boolean;
};

export type PatternAnalysis = {
  viewBox: ViewBox;
  points: Point[];
  boundingBox: ViewBox;
  estimatedGrid: { stepX: number; stepY: number; offsetY: number };
  estimatedModule: { width: number; height: number; localPoints: Point[] };
  connectors?: { localPoints: Point[] };
  confidence: { grid: number; module: number; repetition: number };
  metrics: {
    pointCount: number;
    elementCount: number;
    recurringDistances: Array<{ value: number; count: number }>;
    recurringAngles: Array<{ value: number; count: number }>;
  };
  traversal: {
    continuous: boolean;
    segmentClasses: Record<string, number>;
    recurringSequences: Array<{ sequence: string; count: number }>;
  };
  notes: string[];
};

export type BoundaryPath = {
  id: string;
  points: Point[];
  closed: boolean;
  color?: string;
  layer?: string;
};

export type ImportedBoundary = {
  id: string;
  sourceFileName: string;
  sourceType: "svg" | "dxf";
  color?: string;
  layer?: string;
  paths: BoundaryPath[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

export type PatternConfig = {
  columns?: number;
  rows?: number;
  /** Exact final SVG dimensions in millimeters. Automatically derives rows/columns. */
  totalWidth?: number;
  totalHeight?: number;
  /** Scales active geometric parameters. Does not scale total size or interline/density controls. */
  parameterScalePercent?: number;
  /** Width/height of one horizontal zig-zag module. */
  horizontalZigzagWidth?: number;
  horizontalZigzagHeight?: number;
  /** Preferred control: distance between adjacent horizontal cord passes in millimeters. */
  horizontalZigzagInterline?: number;
  /** Legacy: number of horizontal cord passes distributed inside the exact height. */
  horizontalZigzagPasses?: number;
  /** Moves the horizontal zig-zag origin left from its column. */
  horizontalZigzagOffsetX?: number;
  /** Center-to-center distance between consecutive horizontal zig-zags. */
  horizontalZigzagSpacing?: number;
  /** Width and preferred adjacent-pass distance for vertical zig-zags. */
  verticalZigzagWidth?: number;
  verticalZigzagInterline?: number;
  /** Legacy: number of vertical passes between horizontal zig-zags. */
  verticalZigzagPasses?: number;
  /** Makes the connector between consecutive vertical blocks diagonal. */
  verticalConnectorDiagonalOffsetY?: number;
  /** Legacy aliases retained for API compatibility. */
  cellWidth?: number;
  cellHeight?: number;
  stepX?: number;
  stepY?: number;
  offsetY?: number;
  moduleWidth?: number;
  moduleHeight?: number;
  /** Legacy controls retained for API compatibility. */
  horizontalZigzagCount?: number;
  horizontalCordWidth?: number;
  density?: number;
  scale?: number;
  /** Legacy: guidava spessore disegnato E geometria. Ora la geometria usa constructionStroke, il filo è fisso 0.1mm (R15/⑥). */
  strokeWidth?: number;
  /** Spessore di costruzione (mm): rientri, margini, raccordi. Distinto dal filo disegnato. */
  constructionStroke?: number;
  useConnectors?: boolean;
  /** Alternate column traversal without changing module coordinates. */
  repeatBack?: boolean;
  /** Post-process controls. Defaults preserve the existing geometry exactly. */
  minSegmentLength?: number;
  /** Canonico (§3.1): punto minimo. `minPointDistance`/`minSegmentLength` restano come alias legacy. */
  minStitchMm?: number;
  minPointDistance?: number;
  /** Canonico (§3.1): lunghezza massima del punto. `maxStitchLength` resta come alias legacy. */
  maxStitchMm?: number;
  /** Adds evenly spaced stitch points on visible segments longer than this mm value. 0 disables it. */
  maxStitchLength?: number;
  preserveSharpAngles?: boolean;
  angleThresholdDeg?: number;
  /** Creative geometric controls. */
  horizontalAngleDeg?: number;
  alternateHorizontalAngle?: boolean;
  columnWaveAmplitude?: number;
  /** Preferiti (⑦): lunghezza d'onda in mm e fase in gradi. `columnWaveFrequency` (rad/mm) e `columnWavePhase` (rad) restano legacy. */
  columnWaveLengthMm?: number;
  columnWavePhaseDeg?: number;
  columnWaveFrequency?: number;
  columnWavePhase?: number;
  shapeType?: ShapeType;
  importedBoundary?: ImportedBoundary;
  boundaryCleanupMode?: BoundaryCleanupMode;
  maxBoundaryAdjustment?: number;
  exportCompatibilityMode?: ExportCompatibilityMode;
  sourceAnalysis?: PatternAnalysis;
};

export type ParsedSvg = {
  viewBox: ViewBox;
  geometries: SvgGeometry[];
  source: string;
};

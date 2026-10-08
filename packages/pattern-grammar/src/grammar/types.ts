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
  /**
   * `true` = questo anello è un'AREA VUOTA (R5): dentro non si ricama.
   *
   * Quando nessun path lo dichiara vale la convenzione dei tracciati composti di Illustrator —
   * il più grande è il perimetro, gli altri sono buchi. Dichiararlo serve quando i ruoli li
   * assegna l'utente per colore: un vuoto può essere più grande del contorno che lo contiene
   * (una cornice sottile), e l'area da sola darebbe la risposta rovesciata.
   */
  hole?: boolean;
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
  /**
   * Aree di SCARICO (anelli chiusi, mm, nelle coordinate finali — le stesse della sagoma
   * importata): dentro, i zig-zag verticali e orizzontali hanno meno passate. Il reticolo non
   * si sposta: cambia solo quanto filo c'è in ogni zig-zag. Non ritagliano niente.
   */
  reliefAreas?: Point[][];
  /** Quanto scaricare dentro le aree, in %: 50 = metà delle passate. 0 = niente. */
  reliefPercent?: number;
  /**
   * Punto dell'IMPUNTURA dentro le AREE VUOTE, mm (Lorenzo, 2026-10-01: «il ricamo non deve evitare
   * del tutto di passare in quel vuoto, ma deve diventare un'impuntura normale con distanza punto
   * definita»). Dentro un vuoto i punti particolari spariscono e il filo lo attraversa dritto, a
   * punti di questa misura; fuori il pattern riprende. `0` = dentro non si cuce (R5 puro).
   */
  voidStitchMm?: number;
  /**
   * I PASSAGGI DEL FILO dello zig-zag orizzontale, contati ogni andata e ogni ritorno sul tratto (Lorenzo,
   * 2026-10-08: «uno zig-zag altezza 0 ma che passa 4 volte»). Se è più di 0 vale questo, a qualunque
   * altezza, e l'interlinea non conta: 2 = un'andata e un ritorno, 4 = due e due. Il tratto finisce sempre
   * sulla colonna, quindi i passaggi sono pari (un dispari si arrotonda). 0 = dall'interlinea, come prima.
   */
  horizontalZigzagPassCount?: number;
  /**
   * LE VARIAZIONI NELL'AREA (Lorenzo, 2026-10-06): le misure del modulo cambiano da sinistra a destra.
   * Misura ai lati e al centro in % del pattern (100 = com'è): tratto, distanza fra le colonne e fra i
   * tratti scalano insieme, con una sfumatura continua. Tutti a 100 e il resto a 0 = pattern di sempre.
   */
  variationSidesPercent?: number;
  variationCenterPercent?: number;
  /** Irregolarità morbida in x e in y, in %: 100 = i valori della prova approvata. 0 = niente. */
  variationIrregularityPercent?: number;
  /** Di quanto al massimo si inclina il tratto orizzontale, gradi (±). 0 = sempre dritto. */
  strokeAngleJitterDeg?: number;
  /** Quale disegno casuale: a parità di valori, un altro numero dà un'altra pelle. */
  variationSeed?: number;
  /**
   * I PASSAGGI DEL FILO che cambiano nell'area (Lorenzo, 2026-10-08: «al centro più passaggi, per esempio 4,
   * e ai lati solo due… non uno stacco netto ma fasce di colonne in cui a volte sono 2 a volte 4, prima più
   * 2 che 4, poi più 4 che 2, e alla fine solo 4»). Contati come `horizontalZigzagPassCount`; 0 = come il
   * pattern. Fra i due, ogni tratto si sorteggia fra le due misure vicine con una probabilità che scorre.
   */
  variationPassCountSides?: number;
  variationPassCountCenter?: number;
  exportCompatibilityMode?: ExportCompatibilityMode;
  sourceAnalysis?: PatternAnalysis;
};

export type ParsedSvg = {
  viewBox: ViewBox;
  geometries: SvgGeometry[];
  source: string;
};

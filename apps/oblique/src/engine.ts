// Motore Oblique — TS puro, testabile in Node (DOM solo in tool.ts, come interlace/bitmap).
//
// Porting da rg-oblique-embroidery-pattern-generator/src/app.js, zona per zona, riusando le
// primitive di @rg/core dove rispondono alla stessa domanda geometrica (regola di crescita 6/7,
// Costituzione R28/R30). Ogni divergenza numerica si decide e si blocca con un test.
//
// NON portato (deciso con Lorenzo): coverage map / covered-travel (R16–R21) e la modalità
// procedural del Livello 0 — l'easy di default usa level0Mode="module" e non li tocca.
//
// CONFINE Node/DOM: l'engine riceve moduli GIÀ PARSATI (ObliqueModule = polilinee in mm).
// Il parsing SVG (DOMParser) vive in tool.ts nel browser; lo smoke usa moduli sintetici.

// Primitive geometriche riusate dal core (confrontate con app.js, identiche → nessuna divergenza,
// regola di crescita 6/7): distanza minima dal loop, punto-in-poligono, distanza fra punti.
import { pointInPolygon, distanceToBoundary, distance, distanceToSegment, lerp, clamp } from '@rg/core';

// ───────────────────────────── Tipi ─────────────────────────────

export interface Pt { x: number; y: number; }
export type Poly = Pt[];

/** BBox in mm con centro precalcolato (equivalente a `source.bounds` dell'originale). */
export interface RectBounds {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number; centerX: number; centerY: number;
}

/**
 * Un modulo pronto per il placement: le polilinee del motivo in coordinate-modulo (mm),
 * il suo bbox e l'ancora di default (nell'originale = viewBox origin × unitScale; qui la
 * calcola tool.ts al parse, o il test la fornisce). Prodotto da tool.ts (DOM) o sintetico.
 */
export interface ObliqueModule {
  elements: Poly[];
  bounds: RectBounds;
  /** Ancora di default in coordinate-modulo (usata quando anchorMode ≠ manual/bbox_center). */
  defaultAnchorMm: Pt;
}

export type LevelName = 'level0' | 'level1' | 'level2' | 'holes';

/** Sorgenti del tool: i 4 moduli built-in + (opzionale) il pannello per il formato. */
export interface ObliqueSources {
  level0?: ObliqueModule;
  level1: ObliqueModule;
  level2: ObliqueModule;
  holes?: ObliqueModule;
  /** Se presente, il suo bbox è il formato (Testa A: la misura nasce dalla sorgente). */
  panelBounds?: RectBounds;
}

/** Un piazzamento del modulo sulla griglia diagonale. */
export interface Place {
  diagonal: number;
  index: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  anchor: Pt;
  scale: number;
}

/** Una polilinea grezza generata da un modulo piazzato (prima di clip/routing). */
export interface RawPolyline {
  layer: LevelName;
  diagonal: number;
  index: number;
  points: Poly;
  /** Marcatori di taglio (posti dal clip, consumati dalla riconnessione/routing dello step 2d). */
  splitFragment?: number;
  cutReconnected?: boolean;
}

/** La griglia condivisa (conteggi + espansione) calcolata una volta dal Livello 1. */
export interface GridCounts {
  diagonalCount: number;
  modulesPerDiagonal: number;
  expanded: RectBounds;
  vectorA: Pt;
  vectorB: Pt;
}

// ─────────────────────────── Parametri ───────────────────────────

/**
 * Parametri della modalità semplice (Broderie Anglaise). Nomi allineati ai canonici §3 dove
 * esistono; i restanti sono oblique-specifici. Default = base di app.js con gli override di
 * easy.html applicati (RG_PARAM_OVERRIDES); gli offset per-livello NON sono azzerati dall'easy
 * (micro-calibrazioni fra i livelli, OBIETTIVO.txt).
 */
export interface ObliqueParams {
  // Formato pannello (Testa A: la misura può nascere dalla sorgente, con override).
  formatWidth: number;
  formatHeight: number;
  formatOriginX: number;
  formatOriginY: number;
  realWidthMm: number;
  overflowMarginMm: number;

  // Griglia diagonale (placement dei moduli sui livelli). Vettori in mm.
  vectorAX: number;
  vectorAY: number;
  vectorBX: number;
  vectorBY: number;
  horizontalGap: number;
  verticalGap: number;
  horizontalOverlap: number;
  verticalOverlap: number;
  rowShiftX: number;
  rowShiftY: number;
  startOffsetX: number;
  startOffsetY: number;
  rotation: number;
  autoFillDiagonals: boolean;
  autoModulesPerDiagonal: boolean;
  diagonalCount: number;
  modulesPerDiagonal: number;
  moduleScale: number;

  // Ancora del modulo.
  anchorMode: 'bbox_center' | 'manual' | 'viewbox';
  manualAnchorX: number;
  manualAnchorY: number;

  // Micro-calibrazione per-livello (offset in mm, scala, ancora esplicita opzionale).
  level0OffsetX: number; level0OffsetY: number; level0Scale: number; level0AnchorX: number; level0AnchorY: number;
  level1OffsetX: number; level1OffsetY: number;
  level2OffsetX: number; level2OffsetY: number;
  holesOffsetX: number; holesOffsetY: number; holesScale: number; holesAnchorX: number; holesAnchorY: number;

  // Posizione globale del pattern (spostamento, non scala).
  globalPatternOffsetX: number;
  globalPatternOffsetY: number;

  // Rientri di taglio (rettangoli entro cui si realizzano pattern e fori/piazz./fissaggio).
  patternBorderOffset: number;
  holesMargin: number;

  // Fori laser (Level 4) → filtrano piazzamento/fissaggio (Level 0/1).
  enableHolesLayer: boolean;
  holePerimeterToleranceMm: number;
  pruneFeaturesWithoutHoles: boolean;
  trimDiagonalsToHoles: boolean;
  holeMatchTolerance: number;

  // Livelli.
  enableLevel0: boolean;
  enableLevel05: boolean;
  level05StitchLength: number;

  // Aree di esclusione interne (void, R5).
  enableExclusionAreas: boolean;
  reconnectVoidBorders: boolean;

  // Clip al perimetro (modalità + tolleranze).
  cleanupMode: 'strict_clip' | 'snap_to_edge' | 'trim_and_close';
  cleanupTolerance: number;
  snapToEdgeDistance: number;
  perimeterCloseTolerance: number;
  level0ClipMode: string;
  level1ClipMode: string;

  // Routing dei passaggi (R26): come i passaggi costeggiano il bordo tra le diagonali.
  travelPathMode: string;
  travelRoutingStrategy: string;
  travelSideStrategy: string;
  allowInternalShortcuts: boolean;
  perimeterLaneWidth: number;
  perimeterLaneTolerance: number;
  technicalMaxTravelMm: number;
  technicalGapBreakFactor: number;
  routeAroundVoidsEnabled: boolean;

  // Punti (canonici §3.1) e scarico filo (R8).
  minimumTravelStitchLength: number;
  minimumSegmentLength: number;
  cutBorderStitchLength: number;
  startLockEnabled: boolean;
  startLockStitchMm: number;
}

/** Default della Broderie Anglaise (base app.js + override easy.html). */
export function defaultObliqueParams(): ObliqueParams {
  return {
    formatWidth: 100,
    formatHeight: 100,
    formatOriginX: 0,
    formatOriginY: 0,
    realWidthMm: 0,
    overflowMarginMm: 80,

    vectorAX: 18.5,
    vectorAY: -14.8,
    vectorBX: -8.45,
    vectorBY: 54.8,
    horizontalGap: 0,
    verticalGap: 0,
    horizontalOverlap: 0,
    verticalOverlap: 0,
    rowShiftX: 0,
    rowShiftY: 0,
    startOffsetX: 2.8,
    startOffsetY: 27.5,
    rotation: 0,
    autoFillDiagonals: true,
    autoModulesPerDiagonal: true,
    diagonalCount: 23,
    modulesPerDiagonal: 35,
    moduleScale: 1,

    anchorMode: 'bbox_center',
    manualAnchorX: 0,
    manualAnchorY: 0,

    level0OffsetX: -6, level0OffsetY: 7.9, level0Scale: 1, level0AnchorX: 0, level0AnchorY: 0,
    level1OffsetX: 2.2, level1OffsetY: 4.8,
    level2OffsetX: 0, level2OffsetY: 0,
    holesOffsetX: -0.4, holesOffsetY: 6.7, holesScale: 1, holesAnchorX: 0, holesAnchorY: 0,

    globalPatternOffsetX: 0,
    globalPatternOffsetY: 0,

    patternBorderOffset: 0,
    holesMargin: 0,

    enableHolesLayer: true,
    holePerimeterToleranceMm: 2,
    pruneFeaturesWithoutHoles: false,
    trimDiagonalsToHoles: false,
    holeMatchTolerance: 0.5,

    enableLevel0: true,
    enableLevel05: false,
    level05StitchLength: 3,

    enableExclusionAreas: true,
    reconnectVoidBorders: false,

    cleanupMode: 'strict_clip',
    cleanupTolerance: 0.25,
    snapToEdgeDistance: 0.5,
    perimeterCloseTolerance: 0.1,
    level0ClipMode: 'strict_clip',
    level1ClipMode: 'strict_clip',

    travelPathMode: 'Border Following',
    travelRoutingStrategy: 'shortest_valid',
    travelSideStrategy: 'auto',
    allowInternalShortcuts: false,
    // DIVERGENZA VOLUTA dall'originale (decisa da Lorenzo, verifica visiva del 2026-08-25).
    // `app.js`/easy.html porta i passaggi in una corsia larga 3mm FUORI dal formato: misurato sul
    // default 100×100 erano 877mm di filo del livello pattern + 593 dei 672mm di passaggi a spasso
    // oltre il bordo del pannello. Lorenzo li vuole dentro il formato → corsia 0: i passaggi
    // costeggiano il perimetro restandoci sopra. Verificato: **niente esce più** (0 punti oltre il
    // bordo), il filo resta **un unico tratto continuo** (R26) e cala del 5,5% (35,42 → 33,46 m),
    // perché il giro largo costava più del bordo. Bloccato da un test in `test/smoke.mjs`.
    // Per tornare al comportamento originale basta rimettere 3.
    perimeterLaneWidth: 0,
    perimeterLaneTolerance: 1,
    technicalMaxTravelMm: 0,
    technicalGapBreakFactor: 2.5,
    routeAroundVoidsEnabled: false,

    minimumTravelStitchLength: 2.25,
    minimumSegmentLength: 1.0,
    cutBorderStitchLength: 2.25,
    startLockEnabled: true,
    startLockStitchMm: 2.25,
  };
}

// ─────────────────────── Geometria di supporto ───────────────────────

/** Costruisce un RectBounds da origine+dimensioni. */
export function rectBounds(x: number, y: number, width: number, height: number): RectBounds {
  return {
    minX: x, minY: y, maxX: x + width, maxY: y + height,
    width, height, centerX: x + width / 2, centerY: y + height / 2,
  };
}

/** BBox (mm) di un insieme di polilinee. Usato per costruire ObliqueModule.bounds. */
export function boundsOfPolylines(polys: Poly[]): RectBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  return rectBounds(minX, minY, maxX - minX, maxY - minY);
}

/** Costruisce un ObliqueModule dalle sue polilinee, con ancora di default = centro bbox. */
export function moduleFromPolylines(elements: Poly[], defaultAnchorMm?: Pt): ObliqueModule {
  const bounds = boundsOfPolylines(elements);
  return { elements, bounds, defaultAnchorMm: defaultAnchorMm ?? { x: bounds.centerX, y: bounds.centerY } };
}

/**
 * Parsa un modulo oblique dai suoi `<polyline>` leggendo i punti VERBATIM (come app.js), NON
 * ri-campionando le curve. I moduli sono Illustrator flat (solo polyline, niente transform/bézier):
 * app.js legge i punti così come sono e scala pt→mm a 72dpi (R11, ramo Illustrator). Il core invece
 * ri-campiona ogni tracciato a ~0.6mm (getPointAtLength) → ~2.7× più punti = ricamo troppo fitto.
 * Node-safe: pura regex, niente DOM → lo usa tool.ts per i 4 moduli built-in ed è testabile.
 */
export function parseModuleSvg(svgText: string): ObliqueModule {
  const isIllustrator = /Adobe Illustrator|Illustrator/i.test(svgText) || /id="Livello_/i.test(svgText);
  const scale = isIllustrator ? 25.4 / 72 : 1; // pt→mm (72dpi) o viewBox-as-mm
  const elements: Poly[] = [];
  const re = /<polyline\b[^>]*\bpoints="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svgText)) !== null) {
    const nums = (m[1].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i] * scale, y: nums[i + 1] * scale });
    if (pts.length >= 2) elements.push(pts);
  }
  return moduleFromPolylines(elements);
}

// ─────────────────────── Griglia e placement ───────────────────────
// Porting fedele di generatePlacements / computeAutoFill / transformPoint / buildRawPolylines.

/** I due vettori della griglia diagonale (con gap/overlap/rowShift, tutti 0 nell'easy). */
export function gridVectors(p: ObliqueParams): { vectorA: Pt; vectorB: Pt } {
  return {
    vectorA: { x: p.vectorAX + p.horizontalGap - p.horizontalOverlap, y: p.vectorAY + p.verticalGap - p.verticalOverlap },
    vectorB: { x: p.vectorBX + p.rowShiftX, y: p.vectorBY + p.rowShiftY },
  };
}

/** Il rettangolo di formato: bbox del pannello se importato, altrimenti formatWidth×Height. */
export function formatBounds(p: ObliqueParams, panelBounds?: RectBounds): RectBounds {
  if (panelBounds) return rectBounds(panelBounds.minX, panelBounds.minY, panelBounds.width, panelBounds.height);
  return rectBounds(p.formatOriginX, p.formatOriginY, p.formatWidth, p.formatHeight);
}

/** Quanti moduli/diagonali servono per coprire il formato espanso (porting di computeAutoFill). */
export function computeAutoFill(
  format: RectBounds, moduleBounds: RectBounds, vectorA: Pt, vectorB: Pt, levelScale: number, overflowMarginMm: number,
): { expanded: RectBounds; modulesPerDiagonal: number; diagonalCount: number; moduleSpan: number } {
  const margin = Math.max(0, overflowMarginMm || 0);
  const expanded = rectBounds(format.minX - margin, format.minY - margin, format.width + margin * 2, format.height + margin * 2);
  const moduleSpan = Math.max(moduleBounds.width, moduleBounds.height, 1) * Math.max(levelScale, 0.001);
  const rawStepA = Math.hypot(vectorA.x, vectorA.y);
  const rawStepB = Math.hypot(vectorB.x, vectorB.y);
  const stepA = rawStepA >= 1 ? rawStepA : moduleSpan;
  const stepB = rawStepB >= 1 ? rawStepB : moduleSpan;
  const diagonalReach = Math.hypot(expanded.width, expanded.height) + moduleSpan * 2;
  const crossReach = expanded.width + expanded.height + moduleSpan * 2;
  return {
    expanded,
    modulesPerDiagonal: Math.ceil(diagonalReach / stepA) + 6,
    diagonalCount: Math.ceil(crossReach / stepB) + 6,
    moduleSpan,
  };
}

function levelOffset(p: ObliqueParams, level: LevelName): Pt {
  switch (level) {
    case 'level0': return { x: p.level0OffsetX, y: p.level0OffsetY };
    case 'level1': return { x: p.level1OffsetX, y: p.level1OffsetY };
    case 'level2': return { x: p.level2OffsetX, y: p.level2OffsetY };
    case 'holes': return { x: p.holesOffsetX, y: p.holesOffsetY };
  }
}

function levelScale(p: ObliqueParams, level: LevelName): number {
  const v = level === 'level0' ? p.level0Scale : level === 'holes' ? p.holesScale : p.moduleScale;
  return Number.isFinite(v) ? v : p.moduleScale;
}

function levelExplicitAnchor(p: ObliqueParams, level: LevelName): Pt | null {
  const ax = level === 'level0' ? p.level0AnchorX : level === 'holes' ? p.holesAnchorX : 0;
  const ay = level === 'level0' ? p.level0AnchorY : level === 'holes' ? p.holesAnchorY : 0;
  if (Number.isFinite(ax) && Number.isFinite(ay) && (ax !== 0 || ay !== 0)) return { x: ax, y: ay };
  return null;
}

/** Ancora del modulo per un livello (porting di anchorFor). */
export function anchorFor(mod: ObliqueModule, p: ObliqueParams, level: LevelName): Pt {
  const explicit = levelExplicitAnchor(p, level);
  if (explicit) return explicit;
  if (p.anchorMode === 'manual') return { x: p.manualAnchorX, y: p.manualAnchorY };
  if (p.anchorMode === 'bbox_center') return { x: mod.bounds.centerX, y: mod.bounds.centerY };
  return mod.defaultAnchorMm;
}

/** Punto del modulo trasformato dal piazzamento (porting di transformPoint; rotation 0 nell'easy). */
export function transformPoint(point: Pt, place: Place, p: ObliqueParams): Pt {
  const scale = place.scale;
  const sx = point.x * scale;
  const sy = point.y * scale;
  if (!p.rotation) return { x: place.x + sx, y: place.y + sy };
  const angle = (p.rotation * Math.PI) / 180;
  const cx = place.anchor.x * scale;
  const cy = place.anchor.y * scale;
  const dx = sx - cx;
  const dy = sy - cy;
  return {
    x: place.x + cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: place.y + cy + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

/**
 * La griglia condivisa: conteggi + espansione calcolati UNA volta dal Livello 1 (come l'originale,
 * dove il pass level1 imposta diagonalCount/modulesPerDiagonal riusati dagli altri livelli).
 */
export function computeGridCounts(sources: ObliqueSources, p: ObliqueParams): GridCounts {
  const { vectorA, vectorB } = gridVectors(p);
  const format = formatBounds(p, sources.panelBounds);
  const auto = computeAutoFill(format, sources.level1.bounds, vectorA, vectorB, levelScale(p, 'level1'), p.overflowMarginMm);
  const diagonalCount = p.autoFillDiagonals ? auto.diagonalCount : Math.max(1, Math.floor(p.diagonalCount || 1));
  const modulesPerDiagonal = p.autoModulesPerDiagonal ? auto.modulesPerDiagonal : Math.max(1, Math.floor(p.modulesPerDiagonal || 1));
  return { diagonalCount, modulesPerDiagonal, expanded: auto.expanded, vectorA, vectorB };
}

/** I piazzamenti di un livello sulla griglia condivisa (porting di generatePlacements). */
export function generatePlacements(mod: ObliqueModule, p: ObliqueParams, level: LevelName, grid: GridCounts): Place[][] {
  const anchor = anchorFor(mod, p, level);
  const scale = levelScale(p, level);
  const off = levelOffset(p, level);
  const startX = grid.expanded.minX + p.startOffsetX + off.x;
  const startY = grid.expanded.minY + p.startOffsetY + off.y;
  const placements: Place[][] = [];
  for (let diagonal = 0; diagonal < grid.diagonalCount; diagonal += 1) {
    const band: Place[] = [];
    for (let index = 0; index < grid.modulesPerDiagonal; index += 1) {
      const anchorX = startX + diagonal * grid.vectorB.x + index * grid.vectorA.x;
      const anchorY = startY + diagonal * grid.vectorB.y + index * grid.vectorA.y;
      band.push({
        diagonal, index, anchorX, anchorY,
        x: anchorX - anchor.x * scale,
        y: anchorY - anchor.y * scale,
        anchor, scale,
      });
    }
    placements.push(band);
  }
  return placements;
}

/** Le polilinee grezze di un livello (porting di buildRawPolylines). */
export function buildRawPolylines(mod: ObliqueModule, placements: Place[][], layer: LevelName, p: ObliqueParams): RawPolyline[] {
  const result: RawPolyline[] = [];
  for (const band of placements) {
    for (const place of band) {
      for (const element of mod.elements) {
        result.push({
          layer,
          diagonal: place.diagonal,
          index: place.index,
          points: element.map((pt) => transformPoint(pt, place, p)),
        });
      }
    }
  }
  return result;
}

/** Le polilinee grezze traslate del global pattern offset (porting di translatePolylines + offset). */
export function translateRaw(raw: RawPolyline[], dx: number, dy: number): RawPolyline[] {
  if (!dx && !dy) return raw;
  return raw.map((r) => ({ ...r, points: r.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) }));
}

/**
 * Sotto-step 2a: genera le polilinee GREZZE dei quattro livelli sulla griglia condivisa,
 * applicando il global pattern offset. Ancora niente filtro-fori / clip / routing (step 2b+).
 */
export function buildRawLevels(sources: ObliqueSources, p: ObliqueParams): {
  grid: GridCounts;
  level0: RawPolyline[];
  level1: RawPolyline[];
  level2: RawPolyline[];
  holes: RawPolyline[];
} {
  const grid = computeGridCounts(sources, p);
  const dx = p.globalPatternOffsetX || 0;
  const dy = p.globalPatternOffsetY || 0;
  const holesEnabled = p.enableHolesLayer && !!sources.holes;
  const level0Enabled = p.enableLevel0 && !!sources.level0;

  const raw = (mod: ObliqueModule | undefined, level: LevelName): RawPolyline[] =>
    mod ? translateRaw(buildRawPolylines(mod, generatePlacements(mod, p, level, grid), level, p), dx, dy) : [];

  return {
    grid,
    level0: level0Enabled ? raw(sources.level0, 'level0') : [],
    level1: raw(sources.level1, 'level1'),
    level2: raw(sources.level2, 'level2'),
    holes: holesEnabled ? raw(sources.holes, 'holes') : [],
  };
}

// ═══════════════════════ Step 2b — boundary + filtro fori ═══════════════════════
// Porting fedele delle zone boundary (activePatternBoundary/laser/placement/decorative +
// insetBoundary/boundaryFromPoints) e filtro fori (buildLaserExportPolylines,
// filterPolylinesByValidHoles, pruneFeaturesByHoles, trimDiagonalEndsWithoutHoles).

/** Un'area delimitante: rettangolo (formato/inset) o poligono (contorno di un ruolo-colore). */
export interface Boundary {
  type: 'rect' | 'polygon';
  name: string;
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number;
  points: Poly;              // loop chiuso (ultimo = primo)
  exclusions?: Boundary[];   // contorni interni = aree vuote (R5)
}

/** Area con segno di un loop APERTO (porting di polygonArea di app.js — loop-locale, non dal core). */
function signedArea(points: Poly): number {
  let area = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return area / 2;
}

const samePt = (a: Pt, b: Pt): boolean => distance(a, b) < 0.001;

/** BBox center (equivalente a measurePointSets.center). */
function bboxCenter(points: Poly): Pt {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** Boundary rettangolare da origine+dimensioni (porting di rectBoundary). */
export function rectBoundaryOf(x: number, y: number, width: number, height: number, name: string): Boundary {
  return {
    type: 'rect', name,
    minX: x, minY: y, maxX: x + width, maxY: y + height, width, height,
    points: [
      { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y },
    ],
  };
}

/** Boundary rettangolare dal RectBounds del formato. */
export function boundaryFromFormat(fmt: RectBounds, name: string): Boundary {
  return rectBoundaryOf(fmt.minX, fmt.minY, fmt.width, fmt.height, name);
}

/** Normalizza un loop-perimetro (porting di normalizePerimeterLoop): chiuso, senza micro-segmenti, winding coerente. */
export function normalizePerimeterLoop(points: Poly, closeTolerance = 0.1): Poly | null {
  if (!points || points.length < 3) return null;
  const cleaned: Pt[] = [];
  for (const point of points) {
    const next = { x: point.x, y: point.y };
    if (!cleaned.length || distance(cleaned[cleaned.length - 1], next) > 0.001) cleaned.push(next);
  }
  if (cleaned.length < 3) return null;
  if (distance(cleaned[0], cleaned[cleaned.length - 1]) > closeTolerance) return null;
  if (!samePt(cleaned[0], cleaned[cleaned.length - 1])) cleaned.push({ ...cleaned[0] });
  const out: Pt[] = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i += 1) {
    if (distance(out[out.length - 1], cleaned[i]) > 0.001) out.push(cleaned[i]);
  }
  if (!samePt(out[0], out[out.length - 1])) out.push({ ...out[0] });
  if (out.length < 4) return null;
  if (signedArea(out) < 0) out.reverse();
  if (!samePt(out[0], out[out.length - 1])) out.push({ ...out[0] });
  return out;
}

/**
 * Semplifica un loop con **Douglas-Peucker vero**: nessun punto del contorno originale finisce a più
 * di `tol` dal contorno semplificato. Serve perché l'import del core campiona i contorni a ~0.6mm:
 * un rettangolo diventa ~600 punti → il clip dei moduli sul boundary (O(segmenti×lati)) esplode
 * (≈180M operazioni = tool bloccato). Un rettangolo torna a 4 angoli e il clip vola.
 *
 * *Prima era una versione "greedy"* che misurava ogni punto rispetto all'**ultimo tenuto**: su una
 * curva l'errore si accumulava senza limiti, e un cerchio di raggio 25 campionato fine diventava un
 * **decagono, con 1,5mm di scarto** — dieci volte la tolleranza dichiarata. Su un cartamodello
 * curvo voleva dire ricamare dentro una sagoma diversa da quella disegnata (trovato misurando,
 * verifica visiva A1 punto 4). Douglas-Peucker misura sempre rispetto alla **corda originale**,
 * quindi lo scarto è garantito ≤ `tol`.
 */
export function simplifyLoop(points: Poly, tol = 0.2): Poly {
  const n = points.length;
  if (n <= 4) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  // pila esplicita invece della ricorsione: i contorni veri arrivano anche a decine di migliaia di punti
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    let worst = -1, worstDistance = tol;
    for (let i = a + 1; i < b; i += 1) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > worstDistance) { worstDistance = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(points[i]);
  return out.length >= 4 ? out : points;
}

/** Boundary poligonale da un loop di punti (porting di boundaryFromPoints). */
export function boundaryFromPoints(points: Poly, name: string, closeTolerance = 0.1): Boundary {
  const loop = simplifyLoop(normalizePerimeterLoop(points, closeTolerance) || points);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of loop) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { type: 'polygon', name, minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, points: loop };
}

/**
 * Il contorno più grande di un insieme di elementi diventa il boundary; i contorni interni più
 * piccoli diventano esclusioni (void, R5). Porting di sourceContourBoundary.
 */
export function contourBoundary(elements: Poly[], name = 'pattern', closeTolerance = 0.1): Boundary | null {
  const candidates = elements
    .map((pts) => normalizePerimeterLoop(pts, closeTolerance))
    .filter((x): x is Poly => !!x)
    .sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  const largest = candidates[0];
  if (!largest) return null;
  const boundary = boundaryFromPoints(largest, name, closeTolerance);
  const exclusions: Boundary[] = [];
  for (let i = 1; i < candidates.length; i += 1) {
    const loop = candidates[i];
    const centroid = loop.reduce((acc, p) => ({ x: acc.x + p.x / loop.length, y: acc.y + p.y / loop.length }), { x: 0, y: 0 });
    if (pointInPolygon(centroid, largest)) exclusions.push(boundaryFromPoints(loop, 'exclusion', closeTolerance));
  }
  if (exclusions.length) boundary.exclusions = exclusions;
  return boundary;
}

/** Inset rettangolare di un boundary (porting di insetBoundary): sempre un rettangolo. */
export function insetBoundary(b: Boundary, offsets: { top?: number; right?: number; bottom?: number; left?: number }, name: string): Boundary {
  const minX = b.minX + Math.max(0, offsets.left || 0);
  const minY = b.minY + Math.max(0, offsets.top || 0);
  const maxX = b.maxX - Math.max(0, offsets.right || 0);
  const maxY = b.maxY - Math.max(0, offsets.bottom || 0);
  return rectBoundaryOf(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY), name);
}

/** Punto dentro il boundary con tolleranza (porting di isInside). */
export function isInside(point: Pt, b: Boundary, tolerance = 0): boolean {
  if (b.type === 'polygon') return pointInPolygon(point, b.points) || distanceToBoundary(point, b.points) <= tolerance;
  return point.x >= b.minX - tolerance && point.x <= b.maxX + tolerance &&
    point.y >= b.minY - tolerance && point.y <= b.maxY + tolerance;
}

/**
 * Boundary del ruolo-colore (contorni del pannello) che possono sostituire i rettangoli di inset.
 * tool.ts risolve colore→contorno via l'import del core e li passa qui; i test passano rettangoli.
 */
export interface RoleBoundaries {
  master?: Boundary;    // MASTER_OUTLINE → perimetro pattern
  pattern?: Boundary;   // PATTERN_REFERENCE → boundary decorativo
  laser?: Boundary;     // LASER_REFERENCE → boundary fori
  placement?: Boundary; // PLACEMENT_REFERENCE → boundary piazzamento/fissaggio
}

/** I quattro boundary risolti (porting di activePatternBoundary/decorative/laser/placement). */
export interface ObliqueBoundaries {
  pattern: Boundary;
  decorative: Boundary;
  laser: Boundary;
  placement: Boundary;
}

/**
 * Risolve i boundary: se un ruolo-colore è assegnato usa il suo contorno, altrimenti i rettangoli
 * di inset dal formato. Nell'easy i rientri fori/piazzamento sono guidati dall'unico `holesMargin`
 * (uniforme sui 4 lati), il decorativo da `patternBorderOffset`.
 */
export function resolveBoundaries(p: ObliqueParams, panelBounds?: RectBounds, roles: RoleBoundaries = {}): ObliqueBoundaries {
  const pattern = roles.master ?? boundaryFromFormat(formatBounds(p, panelBounds), 'pattern');
  const insetAll = (b: Boundary, off: number, name: string): Boundary =>
    off > 0 ? insetBoundary(pattern, { top: off, right: off, bottom: off, left: off }, name) : { ...b, name };
  const decorative = roles.pattern ?? insetAll(pattern, Math.max(0, p.patternBorderOffset || 0), 'decorative');
  const laser = roles.laser ?? insetBoundary(pattern, { top: p.holesMargin, right: p.holesMargin, bottom: p.holesMargin, left: p.holesMargin }, 'laser_reference');
  const placement = roles.placement ?? insetBoundary(pattern, { top: p.holesMargin, right: p.holesMargin, bottom: p.holesMargin, left: p.holesMargin }, 'placement_reference');
  return { pattern, decorative, laser, placement };
}

// ─────────────────────── Filtro fori (R7, R12) ───────────────────────

/** Un foro valido, con centro e id di griglia. */
export interface ValidCenter { x: number; y: number; id: string; diagonal: number; index: number; }

export interface LaserExport {
  validIds: Set<string>;
  validCenters: ValidCenter[];
  validHoles: RawPolyline[];
  polylines: RawPolyline[];
}

const moduleId = (r: { diagonal?: number; index?: number }): string => `${r.diagonal ?? 0}:${r.index ?? 0}`;

/**
 * Fori validi rispetto al perimetro (R7): un foro resta se è dentro il boundary fori entro
 * tolleranza (positiva = sporge al max; negativa = deve stare almeno |tol| DENTRO). Porting di
 * buildLaserExportPolylines (senza il ramo void, aggiunto allo step 2c).
 */
export function buildLaserExport(rawHoles: RawPolyline[], clipBounds: Boundary, outerBounds: Boundary, perimeterToleranceMm: number, voidExclusions: Boundary[] = []): LaserExport {
  const output: RawPolyline[] = [];
  const validIds = new Set<string>();
  const validCenters: ValidCenter[] = [];
  const validHoles: RawPolyline[] = [];
  for (const polyline of rawHoles) {
    const center = bboxCenter(polyline.points);
    const withinPerimeter = perimeterToleranceMm >= 0
      ? polyline.points.every((point) => isInside(point, clipBounds, perimeterToleranceMm))
      : polyline.points.every((point) => isInside(point, clipBounds, 0) && distanceToBoundary(point, clipBounds.points) >= -perimeterToleranceMm);
    // Un foro è soppresso da un void (dove non c'è ricamo non ci sono fori, R5), stessa tolleranza del perimetro.
    const inExclusion = voidExclusions.some((ex) => holeRemovedByVoid(polyline.points, ex, perimeterToleranceMm));
    if (withinPerimeter && !inExclusion) {
      const id = moduleId(polyline);
      validIds.add(id);
      validCenters.push({ x: center.x, y: center.y, id, diagonal: polyline.diagonal, index: polyline.index });
      validHoles.push(polyline);
      output.push(polyline);
    }
  }
  return { validIds, validCenters, validHoles, polylines: output };
}

/** Tiene i moduli L0/L1 il cui foro (stessa cella di griglia, o centro vicino) è valido. Porting di filterPolylinesByValidHoles. */
export function filterPolylinesByValidHoles(polylines: RawPolyline[], validIds: Set<string>, validCenters: ValidCenter[], holeMatchTolerance: number): RawPolyline[] {
  const tolerance = Math.max(0, holeMatchTolerance || 0.5);
  const kept: RawPolyline[] = [];
  for (const polyline of polylines) {
    const id = moduleId(polyline);
    const center = bboxCenter(polyline.points);
    const spatialMatch = validCenters.some((hole) => distance(center, hole) <= tolerance);
    if (validIds.has(id) || spatialMatch) kept.push(polyline);
  }
  return kept;
}

/**
 * Toglie i cerchi/rosette (L0/L1) dove non c'è il foro, MANTENENDO le passate che corrono sotto.
 * Porting fedele di pruneFeaturesByHoles.
 */
export function pruneFeaturesByHoles(points: Poly, validCenters: ValidCenter[], tolerance: number): Poly {
  if (!Array.isArray(points) || points.length < 4) return points;
  const LOOP_TOL = 1.0, BACK_CAP = 160, MIN_REACH = 2.5;
  const centers = validCenters || [];
  const holeTol = Math.max(0, tolerance || 0);
  const featureHasHole = (loop: Poly): boolean => {
    let cx = 0, cy = 0;
    for (const q of loop) { cx += q.x; cy += q.y; }
    cx /= loop.length; cy /= loop.length;
    const centroid = { x: cx, y: cy };
    let reach = 0;
    for (const q of loop) { const d = distance(centroid, q); if (d > reach) reach = d; }
    return centers.some((hole) => pointInPolygon(hole, loop) || distance(centroid, hole) <= reach + holeTol);
  };
  const out: { x: number; y: number; prot: boolean }[] = [];
  for (let k = 0; k < points.length; k += 1) {
    const p = points[k];
    let found = -1;
    for (let s = out.length - 2; s >= Math.max(0, out.length - BACK_CAP); s -= 1) {
      if (!out[s].prot && distance(out[s], p) <= LOOP_TOL) { found = s; break; }
    }
    if (found >= 0 && out.length - found + 1 >= 4) {
      const span = out.slice(found).concat([{ x: p.x, y: p.y, prot: false }]);
      let cx = 0, cy = 0;
      for (const q of span) { cx += q.x; cy += q.y; }
      cx /= span.length; cy /= span.length;
      let reach = 0;
      for (const q of span) { const d = distance({ x: cx, y: cy }, q); if (d > reach) reach = d; }
      if (reach >= MIN_REACH) {
        if (featureHasHole(span)) {
          for (let s = found; s < out.length; s += 1) out[s].prot = true;
          out.push({ x: p.x, y: p.y, prot: true });
        } else {
          let hasProtected = false;
          for (let s = found; s < out.length; s += 1) { if (out[s].prot) { hasProtected = true; break; } }
          if (hasProtected) out.push({ x: p.x, y: p.y, prot: false });
          else out.length = found + 1;
        }
        continue;
      }
    }
    out.push({ x: p.x, y: p.y, prot: false });
  }
  return out.map((o) => ({ x: o.x, y: o.y }));
}

/** pruneFeaturesByHoles su un intero livello. Porting di pruneLayerFeaturesByHoles. */
export function pruneLayerFeaturesByHoles(polylines: RawPolyline[], validCenters: ValidCenter[], tolerance: number): RawPolyline[] {
  const output: RawPolyline[] = [];
  for (const polyline of polylines) {
    const points = pruneFeaturesByHoles(polyline.points, validCenters, tolerance);
    if (points.length >= 2) output.push({ ...polyline, points });
  }
  return output;
}

/**
 * Taglia ogni diagonale (L0/L1) alla campata dei suoi fori: tiene i moduli dal primo foro all'ultimo,
 * scarta gli estremi vuoti e le diagonali senza fori. Porting di trimDiagonalEndsWithoutHoles.
 */
export function trimDiagonalEndsWithoutHoles(polylines: RawPolyline[], validCenters: ValidCenter[]): RawPolyline[] {
  if (!polylines.length) return polylines;
  const centers = validCenters || [];
  if (!centers.length) return [];
  const TOL = 2;
  const byDiag = new Map<number, RawPolyline[]>();
  for (const pl of polylines) {
    const d = pl.diagonal ?? 0;
    if (!byDiag.has(d)) byDiag.set(d, []);
    byDiag.get(d)!.push(pl);
  }
  const kept: RawPolyline[] = [];
  byDiag.forEach((items) => {
    const byIndex = new Map<number, RawPolyline[]>();
    for (const pl of items) {
      const i = pl.index ?? 0;
      if (!byIndex.has(i)) byIndex.set(i, []);
      byIndex.get(i)!.push(pl);
    }
    const indices = Array.from(byIndex.keys()).sort((a, b) => a - b);
    const hasHole = (i: number): boolean => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pl of byIndex.get(i)!) for (const p of pl.points) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      return centers.some((h) => h.x >= minX - TOL && h.x <= maxX + TOL && h.y >= minY - TOL && h.y <= maxY + TOL);
    };
    let first: number | null = null, lastHole: number | null = null;
    for (const i of indices) { if (hasHole(i)) { if (first === null) first = i; lastHole = i; } }
    if (first === null) return;
    for (const i of indices) { if (i >= first && i <= lastHole!) for (const pl of byIndex.get(i)!) kept.push(pl); }
  });
  return kept;
}

/** Applica il filtro fori a un livello L0/L1, come render() (default = filterByValidHoles; toggle prune/trim). */
export function filterLevelByHoles(raw: RawPolyline[], p: ObliqueParams, laser: LaserExport, holesEnabled: boolean): RawPolyline[] {
  if (!holesEnabled) return raw;
  const filtered = p.pruneFeaturesWithoutHoles
    ? pruneLayerFeaturesByHoles(raw, laser.validCenters, p.holeMatchTolerance || 0.5)
    : filterPolylinesByValidHoles(raw, laser.validIds, laser.validCenters, p.holeMatchTolerance || 0.5);
  return p.trimDiagonalsToHoles ? trimDiagonalEndsWithoutHoles(filtered, laser.validCenters) : filtered;
}

// ═══════════════════════ Step 2c — clip al perimetro + void (R5) ═══════════════════════
// Porting fedele di cleanupPolyline/cleanupPolylines/applyModuleClipMode + clip helpers +
// subtractExclusions/cleanupVoids. Riuso dal core lerp/clamp/pointInPolygon/distanceToBoundary.
// I metadati di taglio (splitFragment) sono oblique-specifici → clip locale, non il core.clip.

/** Intersezione parametrica segmento-segmento (porting di segmentIntersectionParam, con ±1e-6). */
function segmentIntersectionParam(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; point: Pt } | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 0.000001) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) return null;
  const tc = clamp(t, 0, 1);
  return { t: tc, point: lerp(a, b, tc) };
}

/** Clip di un segmento su un rettangolo (Liang-Barsky). Ritorna il tratto interno o null. */
function clipSegmentToRect(a: Pt, b: Pt, bnd: Boundary): { a: Pt; b: Pt } | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - bnd.minX], [dx, bnd.maxX - a.x], [-dy, a.y - bnd.minY], [dy, bnd.maxY - a.y],
  ];
  for (const [edge, q] of checks) {
    if (edge === 0 && q < 0) return null;
    if (edge !== 0) {
      const rr = q / edge;
      if (edge < 0) { if (rr > t1) return null; if (rr > t0) t0 = rr; }
      else { if (rr < t0) return null; if (rr < t1) t1 = rr; }
    }
  }
  return { a: { x: a.x + t0 * dx, y: a.y + t0 * dy }, b: { x: a.x + t1 * dx, y: a.y + t1 * dy } };
}

/** Clip di un segmento su un poligono; keepOutside=true tiene la parte FUORI (per i void). */
function clipSegmentToPolygon(a: Pt, b: Pt, polygon: Poly, keepOutside = false): { a: Pt; b: Pt }[] {
  const wanted = (point: Pt): boolean => (keepOutside ? !pointInPolygon(point, polygon) : pointInPolygon(point, polygon));
  const intersections: { t: number; point: Pt }[] = [{ t: 0, point: a }, { t: 1, point: b }];
  for (let i = 0; i < polygon.length - 1; i += 1) {
    const hit = segmentIntersectionParam(a, b, polygon[i], polygon[i + 1]);
    if (hit && hit.t >= 0 && hit.t <= 1) intersections.push(hit);
  }
  const unique = intersections
    .sort((l, r) => l.t - r.t)
    .filter((item, i, items) => i === 0 || Math.abs(item.t - items[i - 1].t) > 0.000001);
  const segments: { a: Pt; b: Pt }[] = [];
  for (let i = 0; i < unique.length - 1; i += 1) {
    const mid = lerp(a, b, (unique[i].t + unique[i + 1].t) / 2);
    if (wanted(mid)) segments.push({ a: unique[i].point, b: unique[i + 1].point });
  }
  if (!segments.length && wanted(a) && wanted(b)) return [{ a, b }];
  return segments;
}

function rectToPolygon(bnd: Boundary): Poly {
  return [
    { x: bnd.minX, y: bnd.minY }, { x: bnd.maxX, y: bnd.minY },
    { x: bnd.maxX, y: bnd.maxY }, { x: bnd.minX, y: bnd.maxY }, { x: bnd.minX, y: bnd.minY },
  ];
}

/** Clip di un segmento su un boundary (rect o poligono), dispatch come app.js. */
function clipSegmentToBoundary(a: Pt, b: Pt, bnd: Boundary, keepOutside = false): { a: Pt; b: Pt }[] {
  if (bnd.type !== 'polygon') {
    if (keepOutside) return clipSegmentToPolygon(a, b, rectToPolygon(bnd), true);
    const clipped = clipSegmentToRect(a, b, bnd);
    return clipped ? [clipped] : [];
  }
  return clipSegmentToPolygon(a, b, bnd.points, keepOutside);
}

function closestPointOnSegment(point: Pt, a: Pt, b: Pt): Pt {
  const len2 = Math.max(0.000001, (b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const t = clamp(((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / len2, 0, 1);
  return lerp(a, b, t);
}

function closestPointOnBoundary(point: Pt, bnd: Boundary): Pt | null {
  let best: Pt | null = null, bestD = Infinity;
  for (let i = 0; i < bnd.points.length - 1; i += 1) {
    const cand = closestPointOnSegment(point, bnd.points[i], bnd.points[i + 1]);
    const d = distance(point, cand);
    if (d < bestD) { best = cand; bestD = d; }
  }
  return best;
}

/** Proietta un punto sul bordo del boundary se entro maxDistance (porting di snapToRect). */
function snapToRect(point: Pt, bnd: Boundary, maxDistance: number): Pt | null {
  if (bnd.type === 'polygon') {
    const projected = closestPointOnBoundary(point, bnd);
    return projected && distance(point, projected) <= maxDistance ? projected : null;
  }
  const candidates: Pt[] = [
    { x: clamp(point.x, bnd.minX, bnd.maxX), y: bnd.minY },
    { x: clamp(point.x, bnd.minX, bnd.maxX), y: bnd.maxY },
    { x: bnd.minX, y: clamp(point.y, bnd.minY, bnd.maxY) },
    { x: bnd.maxX, y: clamp(point.y, bnd.minY, bnd.maxY) },
  ];
  let best: Pt | null = null, bestD = maxDistance;
  for (const c of candidates) { const d = distance(point, c); if (d <= bestD) { best = c; bestD = d; } }
  return best;
}

/**
 * Taglia una polilinea sul boundary (porting di cleanupPolyline, senza il report). keepOutside=true
 * tiene la parte FUORI (per un void). Spezza in più frammenti dove esce, con marker splitFragment.
 */
export function cleanupPolyline(polyline: RawPolyline, bnd: Boundary, p: ObliqueParams, keepOutside = false): RawPolyline[] {
  const output: RawPolyline[] = [];
  const cleanedFrom = (pts: Poly): RawPolyline => ({
    layer: polyline.layer, diagonal: polyline.diagonal, index: polyline.index, points: pts.map((pt) => ({ x: pt.x, y: pt.y })),
  });
  const cleanedPush = (pts: Poly): void => {
    // R3: il min-stitch si applica DOPO il routing (pass finale enforceMinimumStitch), non qui —
    // altrimenti col sampling fine del core (~0.6mm) i moduli sparirebbero nel clip. Qui solo dedup.
    const simplified = removeConsecutiveDuplicates(pts);
    if (simplified.length > 1) output.push({ ...cleanedFrom(simplified), splitFragment: output.length });
  };
  // Modalità snap/trim: sposta i punti fuori bordo sul bordo (non nell'easy, che è strict_clip).
  const adjusted = polyline.points.map((point) => {
    const inBounds = isInside(point, bnd, keepOutside ? 0 : p.cleanupTolerance);
    const keep = keepOutside ? !inBounds : inBounds;
    if (keep) return point;
    if (p.cleanupMode !== 'strict_clip') {
      const snapped = snapToRect(point, bnd, p.snapToEdgeDistance);
      if (snapped) return snapped;
    }
    return point;
  });
  let current: Pt[] = [];
  for (let i = 0; i < adjusted.length - 1; i += 1) {
    const a = adjusted[i], b = adjusted[i + 1];
    const clippedSegments = clipSegmentToBoundary(a, b, bnd, keepOutside);
    if (!clippedSegments.length) {
      if (current.length > 1) { cleanedPush(current); current = []; }
      continue;
    }
    clippedSegments.forEach((clipped, segmentIndex) => {
      // Scarta solo i tratti a lunghezza zero (dal clip agli spigoli); la lunghezza minima
      // vera la impone il pass finale enforceMinimumStitch DOPO il routing (R3).
      if (distance(clipped.a, clipped.b) < 1e-4) return;
      if (segmentIndex > 0 || !current.length || !samePt(current[current.length - 1], clipped.a)) {
        if (current.length > 1) cleanedPush(current);
        current = [clipped.a];
      }
      current.push(clipped.b);
    });
  }
  if (current.length > 1) cleanedPush(current);
  return output;
}

/** Taglia un livello sul boundary (porting di cleanupPolylines). */
export function cleanupPolylines(polylines: RawPolyline[], bnd: Boundary, p: ObliqueParams, keepOutside = false): RawPolyline[] {
  const cleaned: RawPolyline[] = [];
  for (const polyline of polylines) cleaned.push(...cleanupPolyline(polyline, bnd, p, keepOutside));
  return cleaned;
}

function moduleFullyInside(items: RawPolyline[], bnd: Boundary, p: ObliqueParams): boolean {
  return items.every((item) => item.points.every((point) => isInside(point, bnd, p.cleanupTolerance || 0)));
}

function moduleIntersectsBoundary(items: RawPolyline[], bnd: Boundary, p: ObliqueParams): boolean {
  return items.some((item) => {
    if (item.points.some((point) => isInside(point, bnd, p.cleanupTolerance || 0))) return true;
    for (let i = 0; i < item.points.length - 1; i += 1) {
      if (clipSegmentToBoundary(item.points[i], item.points[i + 1], bnd).length) return true;
    }
    return false;
  });
}

/**
 * Clip di un livello secondo la modalità (porting di applyModuleClipMode). strict_clip (default easy)
 * taglia netto al boundary; le altre modalità tengono/scartano il modulo INTERO.
 */
export function applyModuleClipMode(polylines: RawPolyline[], bnd: Boundary, mode: string, p: ObliqueParams): RawPolyline[] {
  if (mode === 'strict_clip') return cleanupPolylines(polylines, bnd, p);
  const groups = new Map<string, RawPolyline[]>();
  for (const polyline of polylines) {
    const id = moduleId(polyline);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(polyline);
  }
  const kept: RawPolyline[] = [];
  groups.forEach((items) => {
    const keep = mode === 'keep_only_if_fully_inside' ? moduleFullyInside(items, bnd, p) : moduleIntersectsBoundary(items, bnd, p);
    if (keep) kept.push(...items);
  });
  return kept;
}

// ─────────────────────── Void (aree di esclusione, R5) ───────────────────────

function segmentCrossesPolygon(a: Pt, b: Pt, polygon: Poly): boolean {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    if (segmentIntersectionParam(a, b, polygon[j], polygon[i])) return true;
  }
  return pointInPolygon(a, polygon) && pointInPolygon(b, polygon);
}

/** Se un foro va scartato per un void, con la stessa tolleranza del perimetro (porting di holeRemovedByVoid). */
export function holeRemovedByVoid(points: Poly, exclusion: Boundary, tolerance: number): boolean {
  for (let i = 0; i < points.length; i += 1) {
    const inside = isInside(points[i], exclusion, 0);
    const d = distanceToBoundary(points[i], exclusion.points);
    if ((inside ? d : -d) >= tolerance) return true;
  }
  if (tolerance <= 0.001) {
    for (let i = 1; i < points.length; i += 1) {
      if (segmentCrossesPolygon(points[i - 1], points[i], exclusion.points)) return true;
    }
  }
  return false;
}

/** Sottrae i void dal ricamo tagliando esatto sul bordo del vuoto (porting di subtractExclusions). */
export function subtractExclusions(polylines: RawPolyline[], exclusions: Boundary[]): RawPolyline[] {
  if (!exclusions.length) return polylines;
  const insideAny = (pt: Pt): boolean => exclusions.some((ex) =>
    pt.x >= ex.minX && pt.x <= ex.maxX && pt.y >= ex.minY && pt.y <= ex.maxY && isInside(pt, ex, 0));
  const hitsOf = (a: Pt, b: Pt): { t: number; point: Pt }[] => {
    const hits: { t: number; point: Pt }[] = [];
    const segMinX = Math.min(a.x, b.x), segMaxX = Math.max(a.x, b.x);
    const segMinY = Math.min(a.y, b.y), segMaxY = Math.max(a.y, b.y);
    for (const ex of exclusions) {
      if (segMaxX < ex.minX || segMinX > ex.maxX || segMaxY < ex.minY || segMinY > ex.maxY) continue;
      const poly = ex.points;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const r = segmentIntersectionParam(a, b, poly[j], poly[i]);
        if (r) hits.push({ t: r.t, point: r.point });
      }
    }
    hits.sort((x, y) => x.t - y.t);
    return hits;
  };
  const output: RawPolyline[] = [];
  for (const polyline of polylines) {
    if (polyline.points.length < 2) continue;
    const pts = polyline.points;
    let run: Pt[] = [];
    let prevInside = insideAny(pts[0]);
    if (!prevInside) run.push(pts[0]);
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1], b = pts[i];
      const bInside = insideAny(b);
      if (!prevInside && !bInside) {
        const hits = hitsOf(a, b);
        if (hits.length >= 2) {
          run.push(hits[0].point);
          if (run.length > 1) output.push({ ...polyline, points: run });
          run = [hits[hits.length - 1].point, b];
        } else run.push(b);
      } else if (!prevInside && bInside) {
        const hits = hitsOf(a, b);
        if (hits.length) run.push(hits[0].point);
        if (run.length > 1) output.push({ ...polyline, points: run });
        run = [];
      } else if (prevInside && !bInside) {
        const hits = hitsOf(a, b);
        run = hits.length ? [hits[hits.length - 1].point, b] : [b];
      }
      prevInside = bInside;
    }
    if (run.length > 1) output.push({ ...polyline, points: run });
  }
  return output;
}

/** Taglia il ricamo fuori da ogni void con la stessa pipeline del bordo esterno (porting di cleanupVoids). */
export function cleanupVoids(polylines: RawPolyline[], exclusions: Boundary[], p: ObliqueParams): RawPolyline[] {
  if (!exclusions.length) return polylines;
  let current = polylines;
  for (const exclusion of exclusions) {
    if (exclusion && exclusion.points.length > 2) current = cleanupPolylines(current, exclusion, p, true);
  }
  return current;
}

/** Ramo void come render(): OFF → niente; reconnectVoidBorders → cleanupVoids; altrimenti subtractExclusions. */
export function applyVoids(polylines: RawPolyline[], exclusions: Boundary[] | undefined, p: ObliqueParams): RawPolyline[] {
  if (!p.enableExclusionAreas || !exclusions || !exclusions.length) return polylines;
  return p.reconnectVoidBorders ? cleanupVoids(polylines, exclusions, p) : subtractExclusions(polylines, exclusions);
}

// ═══════════════════════ Step 2d — routing continuo (R26) + min-stitch (R3) + lock (R8) ═══════════════════════
// Porting fedele delle zone routing di app.js (connectLayerContinuity/connectTechnicalDiagonals +
// perimeterRoute e famiglia + reconnectCutFragmentsOnBoundary/cutGeneratedBorderRoute + routeAroundVoids)
// e dei pass finali enforceMinimumStitch/addStartEndLock. Report/debug omessi (solo geometria).

/** Un tratto connesso o di travel (layer come stringa, es. "level2-routing"). */
export interface Stroke { layer: string; points: Poly; diagonal?: number; connectorType?: string; }
/** Uscita di una connessione: il filo continuo + gli overlay di travel per la preview. */
export interface Connected { polylines: Stroke[]; routingPolylines: Stroke[]; intraDiagonalPolylines: Stroke[]; }

const pathLength = (points: Poly): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
};

function removeConsecutiveDuplicates(points: Poly): Poly {
  const out: Pt[] = [];
  for (const p of points) if (!out.length || distance(out[out.length - 1], p) > 0.001) out.push({ ...p });
  return out;
}

/** Resample arc-length uniforme: un punto ogni `spacing` mm, primo/ultimo esatti (porting di resampleUniform). */
function resampleUniform(points: Poly, spacing: number): Poly {
  if (points.length < 2) return points.slice();
  const s = Math.max(0.1, spacing);
  const out: Pt[] = [{ x: points[0].x, y: points[0].y }];
  let cursor = { x: points[0].x, y: points[0].y };
  let idx = 1;
  let distToNext = distance(cursor, points[idx]);
  let need = s;
  let guard = 0;
  const guardMax = points.length * 4 + Math.ceil(pathLength(points) / s) + 16;
  while (idx < points.length && guard++ < guardMax) {
    if (distToNext >= need) {
      const t = need / distToNext;
      cursor = { x: cursor.x + (points[idx].x - cursor.x) * t, y: cursor.y + (points[idx].y - cursor.y) * t };
      out.push(cursor);
      distToNext = distance(cursor, points[idx]);
      need = s;
    } else {
      need -= distToNext;
      cursor = points[idx];
      idx += 1;
      if (idx < points.length) distToNext = distance(cursor, points[idx]);
    }
  }
  const lastPt = points[points.length - 1];
  if (!samePt(out[out.length - 1], lastPt)) out.push({ x: lastPt.x, y: lastPt.y });
  return out;
}

/** Suddivide i segmenti lunghi (spaziatura MAX), tiene ogni vertice (porting di resampleTravelPath). */
function resampleTravelPath(points: Poly, minimumLength: number): Poly {
  const result: Pt[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i], b = points[i + 1];
    const parts = Math.max(1, Math.floor(distance(a, b) / Math.max(0.1, minimumLength)));
    for (let step = 1; step <= parts; step += 1) result.push({ x: a.x + (b.x - a.x) * (step / parts), y: a.y + (b.y - a.y) * (step / parts) });
  }
  return result.filter((point, i, items) => i === 0 || !samePt(point, items[i - 1]));
}

function resamplePathMaxSpacing(points: Poly, maxSpacing: number): Poly {
  if (!points.length) return [];
  const result: Pt[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i], b = points[i + 1];
    const parts = Math.max(1, Math.ceil(distance(a, b) / Math.max(0.1, maxSpacing)));
    for (let step = 1; step <= parts; step += 1) result.push(lerp(a, b, step / parts));
  }
  return result.filter((point, i, items) => i === 0 || !samePt(point, items[i - 1]));
}

function maxSegmentLength(points: Poly): number {
  let max = 0;
  for (let i = 0; i < points.length - 1; i += 1) max = Math.max(max, distance(points[i], points[i + 1]));
  return max;
}

// ─── Percorso perimetrale (corsia rettangolare + grafo poligonale) ───

interface RouteResult { points: Poly; length: number; direction?: string; valid?: boolean; }

function laneRect(bnd: Boundary, laneWidth: number): { minX: number; minY: number; maxX: number; maxY: number } {
  const lane = Math.max(0, laneWidth || 0);
  return { minX: bnd.minX - lane, minY: bnd.minY - lane, maxX: bnd.maxX + lane, maxY: bnd.maxY + lane };
}

function projectToPerimeterLane(point: Pt, bnd: Boundary, laneWidth: number): Pt & { side: string } {
  const rect = laneRect(bnd, laneWidth);
  const candidates = [
    { x: clamp(point.x, rect.minX, rect.maxX), y: rect.minY, side: 'top' },
    { x: rect.maxX, y: clamp(point.y, rect.minY, rect.maxY), side: 'right' },
    { x: clamp(point.x, rect.minX, rect.maxX), y: rect.maxY, side: 'bottom' },
    { x: rect.minX, y: clamp(point.y, rect.minY, rect.maxY), side: 'left' },
  ];
  return candidates.reduce((best, c) => (distance(point, c) < distance(point, best) ? c : best), candidates[0]);
}

function nextSide(side: string, clockwise: boolean): string {
  const order = ['top', 'right', 'bottom', 'left'];
  const i = order.indexOf(side);
  return order[clockwise ? (i + 1) % 4 : (i + 3) % 4];
}

function perimeterWalk(a: Pt & { side: string }, b: Pt & { side: string }, bnd: Boundary, clockwise: boolean, laneWidth: number): RouteResult {
  const rect = laneRect(bnd, laneWidth);
  const corners = clockwise
    ? [{ x: rect.maxX, y: rect.minY, side: 'top' }, { x: rect.maxX, y: rect.maxY, side: 'right' }, { x: rect.minX, y: rect.maxY, side: 'bottom' }, { x: rect.minX, y: rect.minY, side: 'left' }]
    : [{ x: rect.minX, y: rect.minY, side: 'top' }, { x: rect.minX, y: rect.maxY, side: 'left' }, { x: rect.maxX, y: rect.maxY, side: 'bottom' }, { x: rect.maxX, y: rect.minY, side: 'right' }];
  const points: Pt[] = [{ x: a.x, y: a.y }];
  let guard = 0, currentSide = a.side;
  while (currentSide !== b.side && guard < 8) {
    const corner = corners.find((c) => c.side === currentSide)!;
    points.push({ x: corner.x, y: corner.y });
    currentSide = nextSide(currentSide, clockwise);
    guard += 1;
  }
  points.push({ x: b.x, y: b.y });
  return { points, length: pathLength(points) };
}

function routeSideScore(points: Poly, side: string): number {
  const c = bboxCenter(points); // solo per minX/maxX via bbox: ricomputo il bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  void c;
  if (side === 'top') return -minY;
  if (side === 'bottom') return maxY;
  if (side === 'left') return -minX;
  if (side === 'right') return maxX;
  return 0;
}

function validatePerimeterRoute(points: Poly, bnd: Boundary, p: ObliqueParams): boolean {
  if (points.length < 2) return false;
  const tolerance = Math.max(0.1, p.perimeterLaneTolerance || 1);
  for (let i = 0; i < points.length - 1; i += 1) {
    const mid = lerp(points[i], points[i + 1], 0.5);
    if (bnd.type === 'polygon') {
      if (pointInPolygon(mid, bnd.points) && distanceToBoundary(mid, bnd.points) > tolerance) return false;
    } else if (isInside(mid, bnd, -0.001)) {
      const nearEdge = Math.min(Math.abs(mid.x - bnd.minX), Math.abs(mid.x - bnd.maxX), Math.abs(mid.y - bnd.minY), Math.abs(mid.y - bnd.maxY));
      if (nearEdge > tolerance) return false;
    }
  }
  return true;
}

function choosePerimeterCandidate(cw: RouteResult, ccw: RouteResult, bnd: Boundary, p: ObliqueParams, options: RouteOptions): RouteResult {
  cw.direction = 'clockwise'; ccw.direction = 'counter_clockwise';
  cw.valid = !options.validateCandidates || validatePerimeterRoute(cw.points, bnd, p);
  ccw.valid = !options.validateCandidates || validatePerimeterRoute(ccw.points, bnd, p);
  if (options.preferredDirection) {
    const preferred = options.preferredDirection === 'clockwise' ? cw : ccw;
    const opposite = options.preferredDirection === 'clockwise' ? ccw : cw;
    return preferred.valid ? preferred : opposite.valid ? opposite : preferred;
  }
  const strategy = p.travelRoutingStrategy || 'shortest_valid';
  if (strategy === 'clockwise') return cw;
  if (strategy === 'counter_clockwise') return ccw;
  if (cw.valid && ccw.valid) return cw.length <= ccw.length ? cw : ccw;
  if (cw.valid) return cw;
  if (ccw.valid) return ccw;
  const side = p.travelSideStrategy || 'auto';
  if (side === 'clockwise') return cw;
  if (side === 'counter_clockwise') return ccw;
  if (side.startsWith('prefer_')) {
    const s = side.replace('prefer_', '');
    const cwScore = routeSideScore(cw.points, s), ccwScore = routeSideScore(ccw.points, s);
    if (cwScore !== ccwScore) return cwScore > ccwScore ? cw : ccw;
  }
  return cw.length <= ccw.length ? cw : ccw;
}

interface PerimeterGraph { points: Poly; cumulative: number[]; length: number; }
interface GraphProjection { point: Pt; index: number; distance: number; along: number; }

function perimeterGraph(points: Poly, closeTolerance: number): PerimeterGraph {
  const loop = normalizePerimeterLoop(points, closeTolerance) || points;
  const cumulative = [0];
  for (let i = 0; i < loop.length - 1; i += 1) cumulative.push(cumulative[i] + distance(loop[i], loop[i + 1]));
  return { points: loop, cumulative, length: cumulative[cumulative.length - 1] };
}

function projectToPerimeterGraph(point: Pt, graph: PerimeterGraph): GraphProjection | null {
  let best: GraphProjection | null = null;
  for (let i = 0; i < graph.points.length - 1; i += 1) {
    const projected = closestPointOnSegment(point, graph.points[i], graph.points[i + 1]);
    const along = graph.cumulative[i] + distance(graph.points[i], projected);
    const cand = { point: projected, index: i, distance: distance(point, projected), along };
    if (!best || cand.distance < best.distance) best = cand;
  }
  return best;
}

function isAlongBetweenForward(value: number, start: number, end: number, total: number): boolean {
  const dv = (value - start + total) % total;
  const de = (end - start + total) % total;
  return dv > 0.001 && dv < de - 0.001;
}
function isAlongBetweenBackward(value: number, start: number, end: number, total: number): boolean {
  const dv = (start - value + total) % total;
  const de = (start - end + total) % total;
  return dv > 0.001 && dv < de - 0.001;
}

function walkPerimeterGraph(graph: PerimeterGraph, a: GraphProjection, b: GraphProjection, forward: boolean): Poly {
  if (!a || !b || graph.length <= 0) return [];
  const route: Pt[] = [a.point];
  if (Math.abs(a.along - b.along) < 0.001) return route;
  let cursor = a.index, guard = 0;
  const n = graph.points.length - 1;
  if (forward) {
    while (guard < graph.points.length + 2) {
      const nextVertexIndex = (cursor + 1) % n;
      const nextAlong = graph.cumulative[cursor + 1] ?? graph.length;
      if (isAlongBetweenForward(nextAlong, a.along, b.along, graph.length)) route.push(graph.points[nextVertexIndex]);
      if (isAlongBetweenForward(b.along, a.along, nextAlong, graph.length)) break;
      cursor = nextVertexIndex; guard += 1;
    }
  } else {
    while (guard < graph.points.length + 2) {
      const prevAlong = graph.cumulative[cursor];
      if (isAlongBetweenBackward(prevAlong, a.along, b.along, graph.length)) route.push(graph.points[cursor]);
      if (isAlongBetweenBackward(b.along, a.along, prevAlong, graph.length)) break;
      cursor = (cursor - 1 + n) % n; guard += 1;
    }
  }
  route.push(b.point);
  return route.filter((point, i, items) => i === 0 || !samePt(point, items[i - 1]));
}

function polygonPerimeterRoute(exitPoint: Pt, entryPoint: Pt, boundary: Boundary, p: ObliqueParams, options: RouteOptions = {}): RouteResult {
  const graph = perimeterGraph(boundary.points, p.perimeterCloseTolerance || 0.1);
  const a = projectToPerimeterGraph(exitPoint, graph);
  const b = projectToPerimeterGraph(entryPoint, graph);
  if (!a || !b) return { points: [exitPoint, entryPoint], length: distance(exitPoint, entryPoint) };
  const forward = walkPerimeterGraph(graph, a, b, true);
  const backward = walkPerimeterGraph(graph, a, b, false);
  const chosen = choosePerimeterCandidate({ points: forward, length: pathLength(forward) }, { points: backward, length: pathLength(backward) }, boundary, p, options);
  const points = [exitPoint, ...chosen.points, entryPoint].filter((point, i, items) => i === 0 || !samePt(point, items[i - 1]));
  return { points, length: pathLength(chosen.points), direction: chosen.direction, valid: chosen.valid };
}

interface RouteOptions {
  forceBorder?: boolean;
  preferredDirection?: string | null;
  validateCandidates?: boolean;
  stitchLength?: number;
}

/** Passaggio che costeggia il bordo tra due punti (porting di perimeterRoute). */
function perimeterRoute(exitPoint: Pt, entryPoint: Pt, bnd: Boundary, p: ObliqueParams, options: RouteOptions = {}): RouteResult {
  const mode = p.travelPathMode || 'Border Following';
  const stitch = Math.max(0.1, options.stitchLength || p.minimumTravelStitchLength || 3);
  if (mode === 'Straight' && !options.forceBorder && p.allowInternalShortcuts) {
    const points = resampleTravelPath([exitPoint, entryPoint], stitch);
    return { points, length: pathLength(points) };
  }
  if (bnd.type === 'polygon') {
    const route = polygonPerimeterRoute(exitPoint, entryPoint, bnd, p, options);
    const points = resampleUniform(route.points, stitch);
    return { points, length: pathLength(points), direction: route.direction, valid: route.valid };
  }
  const a = projectToPerimeterLane(exitPoint, bnd, p.perimeterLaneWidth);
  const b = projectToPerimeterLane(entryPoint, bnd, p.perimeterLaneWidth);
  const clockwise = perimeterWalk(a, b, bnd, true, p.perimeterLaneWidth);
  const counterClockwise = perimeterWalk(a, b, bnd, false, p.perimeterLaneWidth);
  const laneRoute = choosePerimeterCandidate(clockwise, counterClockwise, bnd, p, options);
  const basePoints = [exitPoint, ...laneRoute.points, entryPoint].filter((point, i, items) => i === 0 || !samePt(point, items[i - 1]));
  const points = resampleUniform(basePoints, stitch);
  return { points, length: pathLength(points), direction: laneRoute.direction, valid: laneRoute.valid };
}

// ─── Riconnessione dei frammenti da taglio (usa i marker splitFragment del 2c) ───

function isBoundaryCutPair(a: Pt, b: Pt, bnd: Boundary, p: ObliqueParams): boolean {
  const tolerance = Math.max(0.2, p.perimeterLaneTolerance || 1);
  return distanceToBoundary(a, bnd.points) <= tolerance && distanceToBoundary(b, bnd.points) <= tolerance;
}

function isBoundaryCutConnectorCandidate(previousItem: RawPolyline | null, item: RawPolyline, from: Pt, to: Pt, bnd: Boundary, p: ObliqueParams): boolean {
  if (!previousItem || !item || !bnd) return false;
  if (previousItem.index === item.index) return false;
  const hasCutMetadata = previousItem.splitFragment != null || item.splitFragment != null || previousItem.cutReconnected || item.cutReconnected;
  if (!hasCutMetadata) return false;
  const stitch = p.cutBorderStitchLength || 2;
  const tolerance = Math.max(p.perimeterLaneTolerance || 1, stitch + (p.cleanupTolerance || 0.25), p.minimumSegmentLength || 1);
  return distanceToBoundary(from, bnd.points) <= tolerance && distanceToBoundary(to, bnd.points) <= tolerance;
}

/** Passaggio lungo il bordo tra un'uscita e un rientro da taglio (porting di cutGeneratedBorderRoute). */
function cutGeneratedBorderRoute(exitPoint: Pt, reentryPoint: Pt, bnd: Boundary, stitchLength: number, p: ObliqueParams): Poly {
  const projectedExit = closestPointOnBoundary(exitPoint, bnd) || exitPoint;
  const projectedReentry = closestPointOnBoundary(reentryPoint, bnd) || reentryPoint;
  const snapTolerance = Math.max(p.perimeterLaneTolerance || 1, (stitchLength || 2) + (p.cleanupTolerance || 0.25), p.minimumSegmentLength || 1);
  if (distance(exitPoint, projectedExit) > snapTolerance || distance(reentryPoint, projectedReentry) > snapTolerance) return [];
  const route = perimeterRoute(projectedExit, projectedReentry, bnd, p, { forceBorder: true, validateCandidates: true, preferredDirection: null, stitchLength: Math.max(0.2, stitchLength || 2) });
  if (route.valid === false || !route.points.length) return [];
  const points = resamplePathMaxSpacing(route.points, Math.max(0.2, stitchLength || 2));
  if (maxSegmentLength(points) > (stitchLength || 2) + 0.01) return [];
  return points;
}

/** Riconnette i frammenti di uno stesso modulo tagliati dal bordo, costeggiando il perimetro (porting di reconnectCutFragmentsOnBoundary). */
export function reconnectCutFragmentsOnBoundary(polylines: RawPolyline[], bnd: Boundary, p: ObliqueParams): RawPolyline[] {
  const grouped = new Map<string, RawPolyline[]>();
  for (const polyline of polylines) {
    const key = `${polyline.layer}:${polyline.diagonal ?? 0}:${polyline.index ?? 0}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(polyline);
  }
  const output: RawPolyline[] = [];
  grouped.forEach((items) => {
    if (items.length < 2) { output.push(...items); return; }
    let merged: RawPolyline = { ...items[0], cutReconnected: false, points: items[0].points.map((pt) => ({ ...pt })) };
    let reconnected = false;
    for (let i = 1; i < items.length; i += 1) {
      const previousEnd = merged.points[merged.points.length - 1];
      const nextStart = items[i].points[0];
      if (isBoundaryCutPair(previousEnd, nextStart, bnd, p)) {
        const cutRoute = cutGeneratedBorderRoute(previousEnd, nextStart, bnd, p.cutBorderStitchLength || 2, p);
        if (cutRoute.length > 1) {
          if (!samePt(merged.points[merged.points.length - 1], cutRoute[0])) merged.points[merged.points.length - 1] = cutRoute[0];
          merged.points.push(...cutRoute.slice(1), ...items[i].points.slice(1));
          reconnected = true;
          merged.cutReconnected = true;
          continue;
        }
      }
      output.push(reconnected ? merged : items[i - 1]);
      merged = { ...items[i], points: items[i].points.map((pt) => ({ ...pt })) };
      reconnected = false;
    }
    output.push(merged);
  });
  return output;
}

// ─── Connessione dei moduli in filo continuo (R26) ───

function groupByDiagonal(polylines: RawPolyline[]): RawPolyline[][] {
  const map = new Map<number, RawPolyline[]>();
  for (const polyline of polylines) {
    const key = polyline.diagonal ?? 0;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(polyline);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, items]) => items.sort((a, b) => a.index - b.index));
}

function longestDiagonalIndex(diagonals: RawPolyline[][]): number {
  let bestIndex = 0, bestScore = -1;
  diagonals.forEach((items, index) => { if (items.length > bestScore) { bestScore = items.length; bestIndex = index; } });
  return bestIndex;
}

interface ConnectOptions {
  bounds?: Boundary;
  cutBoundary?: Boundary;
  routeBoundaryCutConnectors?: boolean;
  forceBorderRouting?: boolean;
  symmetricRouting?: boolean;
  routeBoundaryCutIntraDiagonal?: boolean;
}

function connectDiagonalModules(items: RawPolyline[], layer: string, p: ObliqueParams, options: ConnectOptions): { points: Poly; intraDiagonalPolylines: Stroke[] } {
  const points: Pt[] = [];
  const intraDiagonalPolylines: Stroke[] = [];
  let previousItem: RawPolyline | null = null;
  for (const item of items) {
    if (!item.points.length) continue;
    if (!points.length) { points.push(...item.points); previousItem = item; continue; }
    const from = points[points.length - 1];
    const to = item.points[0];
    if (!samePt(from, to)) {
      const cutBoundary = options.cutBoundary || options.bounds!;
      const shouldRouteCut = options.routeBoundaryCutConnectors && isBoundaryCutConnectorCandidate(previousItem, item, from, to, cutBoundary, p);
      if (shouldRouteCut) {
        const cutRoute = cutGeneratedBorderRoute(from, to, cutBoundary, p.cutBorderStitchLength || 2, p);
        if (cutRoute.length > 1) {
          if (!samePt(points[points.length - 1], cutRoute[0])) points[points.length - 1] = cutRoute[0];
          points.push(...cutRoute.slice(1));
          intraDiagonalPolylines.push({ layer: `${layer}-cut-routing`, connectorType: 'cut-generated-intra-diagonal-border-connector', points: cutRoute });
        }
      } else {
        if (previousItem && previousItem.index !== item.index) {
          intraDiagonalPolylines.push({ layer: `${layer}-intra`, connectorType: 'intra-diagonal-connector', points: [from, to] });
        }
        points.push(to);
      }
    }
    points.push(...item.points.slice(1));
    previousItem = item;
  }
  return { points, intraDiagonalPolylines };
}

function technicalGapBreakDistance(diagonals: RawPolyline[][], p: ObliqueParams): number {
  const override = Number(p.technicalMaxTravelMm);
  if (override && override > 0) return override;
  const factor = Math.max(1, Number(p.technicalGapBreakFactor) || 2.5);
  const gaps: number[] = [];
  for (const items of diagonals) {
    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1].points, cur = items[i].points;
      if (!prev.length || !cur.length || items[i - 1].index === items[i].index) continue;
      const d = distance(prev[prev.length - 1], cur[0]);
      if (d > 0.0001) gaps.push(d);
    }
  }
  if (!gaps.length) return Infinity;
  gaps.sort((a, b) => a - b);
  return Math.max(gaps[Math.floor(gaps.length / 2)] * factor, p.minimumSegmentLength || 1);
}

/** Giunzione tecnica L0/L1: una polilinea per diagonale, spezzata sui salti grandi (porting di connectTechnicalDiagonals). */
export function connectTechnicalDiagonals(polylines: RawPolyline[], layer: string, p: ObliqueParams): Connected {
  if (!polylines.length) return { polylines: [], routingPolylines: [], intraDiagonalPolylines: [] };
  const diagonals = groupByDiagonal(polylines);
  const breakDistance = technicalGapBreakDistance(diagonals, p);
  const output: Stroke[] = [];
  const intraDiagonalPolylines: Stroke[] = [];
  for (const items of diagonals) {
    const diagonalKey = items[0]?.diagonal ?? 0;
    let run: Pt[] = [];
    let previousItem: RawPolyline | null = null;
    const flush = (): void => { const clean = removeConsecutiveDuplicates(run); if (clean.length > 1) output.push({ layer, diagonal: diagonalKey, points: clean }); run = []; };
    for (const item of items) {
      if (!item.points.length) continue;
      if (!run.length) { run.push(...item.points); previousItem = item; continue; }
      const from = run[run.length - 1], to = item.points[0];
      if (samePt(from, to)) { run.push(...item.points.slice(1)); previousItem = item; continue; }
      if (distance(from, to) > breakDistance) { flush(); run.push(...item.points); previousItem = item; continue; }
      if (previousItem && previousItem.index !== item.index) intraDiagonalPolylines.push({ layer: `${layer}-intra`, connectorType: 'intra-diagonal-connector', points: [from, to] });
      run.push(to, ...item.points.slice(1));
      previousItem = item;
    }
    flush();
  }
  return { polylines: output, routingPolylines: [], intraDiagonalPolylines };
}

/** Filo continuo con passaggi perimetrali fra le diagonali (porting di connectLayerContinuity). */
export function connectLayerContinuity(polylines: RawPolyline[], bounds: Boundary, layer: string, p: ObliqueParams, options: ConnectOptions = {}): Connected {
  if (!polylines.length) return { polylines: [], routingPolylines: [], intraDiagonalPolylines: [] };
  const diagonals = groupByDiagonal(polylines);
  const connected: Stroke[] = [{ layer, points: [] }];
  const routingPolylines: Stroke[] = [];
  const intraDiagonalPolylines: Stroke[] = [];
  const longest = longestDiagonalIndex(diagonals);
  diagonals.forEach((diagonalItems, diagonalPosition) => {
    const diagonalPath = connectDiagonalModules(diagonalItems, layer, p, {
      bounds, cutBoundary: options.cutBoundary || bounds, routeBoundaryCutConnectors: options.routeBoundaryCutIntraDiagonal,
    });
    if (!diagonalPath.points.length) return;
    const current = connected[connected.length - 1];
    if (!current.points.length) { current.points.push(...diagonalPath.points); intraDiagonalPolylines.push(...diagonalPath.intraDiagonalPolylines); return; }
    const exitPoint = current.points[current.points.length - 1];
    const entryPoint = diagonalPath.points[0];
    const phase = diagonalPosition <= longest ? 'first_half' : 'second_half';
    const routingStrategy = p.travelRoutingStrategy || 'shortest_valid';
    const preferredDirection = routingStrategy === 'clockwise' || routingStrategy === 'counter_clockwise'
      ? routingStrategy
      : options.symmetricRouting && routingStrategy !== 'shortest_valid'
        ? (phase === 'first_half' ? 'clockwise' : 'counter_clockwise')
        : null;
    const route = perimeterRoute(exitPoint, entryPoint, bounds, p, { forceBorder: options.forceBorderRouting, preferredDirection, validateCandidates: options.symmetricRouting });
    const routeValid = route.points.length > 1 && route.valid !== false;
    if (routeValid && diagonalPosition > 0) {
      routingPolylines.push({ layer: `${layer}-routing`, connectorType: 'inter-diagonal-border-connector', points: route.points });
      current.points.push(...route.points.slice(1));
    } else if (diagonalPosition > 0) {
      connected.push({ layer, diagonal: diagonalItems[0]?.diagonal ?? diagonalPosition, points: diagonalPath.points });
      intraDiagonalPolylines.push(...diagonalPath.intraDiagonalPolylines);
      return;
    }
    current.points.push(...diagonalPath.points.slice(1));
    intraDiagonalPolylines.push(...diagonalPath.intraDiagonalPolylines);
  });
  return { polylines: connected, routingPolylines, intraDiagonalPolylines };
}

/** Devia i passaggi che attraversano un vuoto lungo il suo bordo (porting di routeAroundVoids; OFF di default). */
export function routeAroundVoids(connected: Connected, exclusions: Boundary[] | undefined, stitch: number, p: ObliqueParams): void {
  if (p.routeAroundVoidsEnabled === false) return;
  if (!exclusions || !exclusions.length) return;
  const s = Math.max(0.5, stitch || 3);
  const voids = exclusions.map((exclusion) => {
    const xs = exclusion.points.map((pt) => pt.x), ys = exclusion.points.map((pt) => pt.y);
    return { boundary: exclusion, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  for (const polyline of connected.polylines) {
    if (polyline.points.length < 2) continue;
    const pts = polyline.points;
    const out: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1], b = pts[i];
      const segMinX = Math.min(a.x, b.x), segMaxX = Math.max(a.x, b.x), segMinY = Math.min(a.y, b.y), segMaxY = Math.max(a.y, b.y);
      const hit = voids.find((v) => !(segMaxX < v.minX || segMinX > v.maxX || segMaxY < v.minY || segMinY > v.maxY) && segmentCrossesPolygon(a, b, v.boundary.points));
      if (hit) {
        const route = polygonPerimeterRoute(a, b, hit.boundary, p).points;
        const inner = route.length > 2 ? resampleUniform(route.slice(1, route.length - 1), s) : [];
        out.push(...inner, b);
      } else out.push(b);
    }
    polyline.points = out;
  }
}

// ─── Pass finali: min-stitch (R3) e lock scarico filo (R8) ───

/** Punto minimo endpoint-preserving (porting di enforceMinimumStitch). */
export function enforceMinimumStitch(points: Poly, minLength: number): Poly {
  if (points.length < 3 || !(minLength > 0)) return points;
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (distance(out[out.length - 1], point) >= minLength) out.push(point);
    else if (i === points.length - 1) { if (out.length > 1) out[out.length - 1] = point; else out.push(point); }
  }
  return out;
}

function enforceMinimumStitchOnLayer(connected: Connected, minLength: number): void {
  if (!(minLength > 0)) return;
  for (const polyline of connected.polylines) polyline.points = enforceMinimumStitch(polyline.points, minLength);
}

/** Scarico filo sul bordo (3 punti di lock + ingresso) a inizio e fine di ogni tratto (porting di addStartEndLock, R8). */
export function addStartEndLock(connected: Connected, boundary: Boundary, stitch: number): void {
  if (!boundary || !boundary.points.length) return;
  const s = Math.max(0.5, stitch || 3);
  const lockStep = Math.max(3, s);
  const borderTangent = (b: Pt): { point: Pt; tan: Pt } => {
    const pts = boundary.points;
    let bestD = Infinity, projected = b, tan = { x: 1, y: 0 };
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i], c = pts[i + 1];
      const cand = closestPointOnSegment(b, a, c);
      const d = distance(b, cand);
      if (d < bestD) { bestD = d; projected = cand; const len = Math.hypot(c.x - a.x, c.y - a.y) || 1; tan = { x: (c.x - a.x) / len, y: (c.y - a.y) / len }; }
    }
    return { point: projected, tan };
  };
  const lockAt = (border: Pt): Pt[] => {
    const { point, tan } = borderTangent(border);
    const march = (k: number): Pt => closestPointOnBoundary({ x: point.x + tan.x * lockStep * k, y: point.y + tan.y * lockStep * k }, boundary) || point;
    return [point, march(1), march(2)];
  };
  for (const polyline of connected.polylines) {
    if (polyline.points.length < 2) continue;
    const pts = polyline.points;
    const start = pts[0], end = pts[pts.length - 1];
    const bStart = closestPointOnBoundary(start, boundary);
    const bEnd = closestPointOnBoundary(end, boundary);
    let out: Pt[];
    if (bStart) {
      const lock = lockAt(bStart);
      const entry = resampleTravelPath([lock[lock.length - 1], start], s);
      out = lock.concat(entry.slice(1), pts.slice(1));
    } else out = pts.slice();
    if (bEnd) {
      const lock = lockAt(bEnd);
      const exit = resampleTravelPath([end, lock[0]], s);
      out = out.concat(exit.slice(1), lock.slice(1));
    }
    polyline.points = out;
  }
}

// ═══════════════════════ Orchestratore — generateOblique (compone 2a→2d come render()) ═══════════════════════

export interface GenerateOptions {
  roles?: RoleBoundaries;
  /** true se Piazzamento/Fissaggio hanno lo stesso colore del Pattern → seguono il perimetro (porting di shouldPlacementFollowPattern). */
  placementFollowsPattern?: boolean;
}

export interface ObliqueResult {
  boundaries: ObliqueBoundaries;
  grid: GridCounts;
  level0: Stroke[];
  level05: Stroke[];
  level1: Stroke[];
  level2: Stroke[];
  holes: RawPolyline[];
  travel: Stroke[];
}

/** Compone l'intera pipeline oblique (griglia→filtro fori→clip→routing→min-stitch→lock), come render(). */
export function generateOblique(sources: ObliqueSources, p: ObliqueParams, options: GenerateOptions = {}): ObliqueResult {
  const bnds = resolveBoundaries(p, sources.panelBounds, options.roles || {});
  const { pattern, decorative, laser, placement } = bnds;
  const routingBounds = pattern; // routingPerimeterBoundary default MASTER_OUTLINE → pattern
  const placementFollows = !!options.placementFollowsPattern;
  const holesEnabled = p.enableHolesLayer && !!sources.holes;

  const raw = buildRawLevels(sources, p);

  const holeVoids = p.enableExclusionAreas
    ? [...(laser.exclusions || []), ...(decorative.exclusions || []), ...(placement.exclusions || [])]
    : [];
  const laserExport = holesEnabled
    ? buildLaserExport(raw.holes, laser, pattern, p.holePerimeterToleranceMm, holeVoids)
    : { validIds: new Set<string>(), validCenters: [], validHoles: [], polylines: [] };

  const routeOptions: ConnectOptions = { forceBorderRouting: true, symmetricRouting: true, routeBoundaryCutIntraDiagonal: true, cutBoundary: decorative };

  const connectTechnical = (raw0: RawPolyline[], layer: string): Connected => {
    const filtered = filterLevelByHoles(raw0, p, laserExport, holesEnabled);
    const clipped = applyModuleClipMode(filtered, placement, layer === 'level0' ? p.level0ClipMode : p.level1ClipMode, p);
    const voided = applyVoids(clipped, placement.exclusions, p);
    const connected = placementFollows
      ? connectLayerContinuity(voided, routingBounds, layer, p, routeOptions)
      : connectTechnicalDiagonals(voided, layer, p);
    routeAroundVoids(connected, placement.exclusions, p.minimumTravelStitchLength || 3, p);
    return connected;
  };

  const level0Connected = p.enableLevel0 && sources.level0 ? connectTechnical(raw.level0, 'level0') : { polylines: [], routingPolylines: [], intraDiagonalPolylines: [] };
  const level1Connected = connectTechnical(raw.level1, 'level1');

  // Livello 0.5 (fissaggio a punto dritto prima dei cerchi): tutte le rosette tolte, restano le passate.
  let level05Connected: Connected = { polylines: [], routingPolylines: [], intraDiagonalPolylines: [] };
  if (p.enableLevel05) {
    const pruned = pruneLayerFeaturesByHoles(raw.level1, [], p.holeMatchTolerance || 0.5);
    const clipped = applyModuleClipMode(pruned, placement, p.level1ClipMode, p);
    const voided = applyVoids(clipped, placement.exclusions, p);
    level05Connected = placementFollows ? connectLayerContinuity(voided, routingBounds, 'level1', p, routeOptions) : connectTechnicalDiagonals(voided, 'level1', p);
    routeAroundVoids(level05Connected, placement.exclusions, p.minimumTravelStitchLength || 3, p);
    const stitch05 = Math.max(1, p.level05StitchLength || 3);
    for (const pl of level05Connected.polylines) { pl.points = resampleUniform(pl.points, stitch05); pl.layer = 'level05'; }
  }

  // Livello 2 (disegno): cleanup → riconnessione frammenti da taglio → void → routing perimetrale.
  const l2Clean = cleanupPolylines(raw.level2, decorative, p);
  const l2Reconnect = reconnectCutFragmentsOnBoundary(l2Clean, decorative, p);
  const l2Voided = applyVoids(l2Reconnect, decorative.exclusions, p);
  const level2Connected = connectLayerContinuity(l2Voided, routingBounds, 'level2', p, routeOptions);
  routeAroundVoids(level2Connected, decorative.exclusions, p.minimumTravelStitchLength || 3, p);

  // Pass finali: punto minimo globale (R3) + scarico filo sul bordo (R8).
  const minStitch = Math.max(0, p.minimumSegmentLength || 0);
  for (const c of [level0Connected, level05Connected, level1Connected, level2Connected]) enforceMinimumStitchOnLayer(c, minStitch);
  if (p.startLockEnabled) {
    for (const c of [level0Connected, level05Connected, level1Connected, level2Connected]) addStartEndLock(c, pattern, p.startLockStitchMm || 3);
  }

  const travel: Stroke[] = [];
  for (const c of [level0Connected, level05Connected, level1Connected, level2Connected]) travel.push(...c.intraDiagonalPolylines, ...c.routingPolylines);

  return {
    boundaries: bnds,
    grid: raw.grid,
    level0: level0Connected.polylines,
    level05: level05Connected.polylines,
    level1: level1Connected.polylines,
    level2: level2Connected.polylines,
    holes: laserExport.polylines,
    travel,
  };
}

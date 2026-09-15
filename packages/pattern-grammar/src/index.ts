// @rg/pattern-grammar — motore della grammatica di pattern (reti, basi ricamo, cannage...).
// Migrato da `pattern-grammar-engine`: solo il percorso browser (niente CLI/analyzer node-only).
export { generatePattern, generateFinalPatternPoints, createExportReport } from './generator/generatePattern.ts';
// Il ritaglio al contorno serve anche fuori dal generatore: chi posa un MODULO dentro una zona
// deve rifilarlo allo stesso identico modo (R28: stessa domanda, stessa risposta).
export { clipPathToBoundaryChunks, isInsideBoundary } from './generator/applyBoundary.ts';
export type { BoundaryOptions, ClippedPathChunk } from './generator/applyBoundary.ts';
export { parseImportedBoundarySource, parseSvgPolylines, parseSvgTransform } from './importer/importBoundary.ts';
export type { PatternConfig, Point, GeneratedPoint, ShapeType, ViewBox, BoundaryPath, ImportedBoundary } from './grammar/types.ts';
export type { ImportedBoundaryModel, ImportScaleMode, ImportBoundaryOptions, BoundaryChoice, PaintPriority, Matrix, SvgPolylinesModel } from './importer/importBoundary.ts';
// Il pattern DENTRO LE ZONE di un disegno: nato in Pattern a zone, promosso qui quando l'ha chiesto il
// secondo tool (Cannage rafia, per le basi — regola di crescita 1). Un motore solo per tutti e due.
export {
  dominantAngleDeg, angleDelta90, familyAngleDeg, refineAngleDeg, cellElongation, STRIP_ELONGATION, familyAxisShiftDeg,
  resolveZoneAngles, makeZone, zonesFromShapes, readZones, orderZonesRaster, outerEdgeFlags, pointInPolygon,
  expandOuterEdges, rotatePoints, boundsOfPoints,
} from './zone/engine.ts';
export type { Zone, ZoneShape } from './zone/engine.ts';
export {
  patternLetter, normalizeRole, patternKeysInUse, patternChoices, PATTERN_INKS, inkFor, RELIEF_ROLE,
  fillZone, buildZonePlan, exportSequenceLayers, travelMetres, threadMetres,
} from './zone/pipeline.ts';
export type { PatternKey, ZoneRole, ZonePlanParams, ZoneStitch, Travel, SequenceStep, ZonePlan } from './zone/pipeline.ts';
export { buildEdgeGraph, travelAlongEdges } from './zone/travel.ts';
export type { EdgeGraph } from './zone/travel.ts';

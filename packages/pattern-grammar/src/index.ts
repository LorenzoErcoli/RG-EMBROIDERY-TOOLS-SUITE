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

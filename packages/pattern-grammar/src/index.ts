// @rg/pattern-grammar — motore della grammatica di pattern (cannage).
// Migrato da `pattern-grammar-engine`: solo il percorso browser (niente CLI/analyzer node-only).
export { generatePattern, generateFinalPatternPoints, createExportReport } from './generator/generatePattern.ts';
export { parseImportedBoundarySource } from './importer/importBoundary.ts';
export type { PatternConfig, Point, GeneratedPoint, ShapeType, ViewBox } from './grammar/types.ts';
export type { ImportedBoundaryModel, ImportScaleMode, ImportBoundaryOptions, BoundaryChoice } from './importer/importBoundary.ts';

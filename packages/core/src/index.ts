// @rg/core — libreria condivisa dell'ecosistema ricamo.
// Rispetta COSTITUZIONE-RICAMO.md. Il core cresce per ESTRAZIONE (ARCHITETTURA §regole di crescita).
export * from './types';
export * from './geometry';
export * from './units';
export * from './grid45';
export * from './clip';
export * from './stitch';
export * from './fill';
export * from './travel';
export * from './params';
export * from './quantize';
export * from './regions';
export * from './isolines';
export * from './borders';
export * from './colonne';
export * from './reduce';
export * from './routing';
export * from './imports';
export * from './export';
export * from './dst';
export * from './io/normalize';
export * from './io/transform';
export { parseSvgToContours } from './io/svg';
export type { SvgImportOptions } from './io/svg';
export { parseDxfToContours } from './io/dxf';

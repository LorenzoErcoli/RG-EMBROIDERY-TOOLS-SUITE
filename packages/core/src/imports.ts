// Risoluzione canonica della scala d'import (R2, R11). UNA volta, uguale per tutti i tool.
import type { Contour, ImportResult } from './types';
import { bounds } from './geometry';

export function measureContours(contours: Contour[]): { widthMm: number; heightMm: number } {
  const all = contours.flatMap((c) => c.points);
  if (!all.length) return { widthMm: 0, heightMm: 0 };
  const b = bounds(all);
  return { widthMm: b.maxX - b.minX, heightMm: b.maxY - b.minY };
}

export function scaleContours(contours: Contour[], factor: number): Contour[] {
  return contours.map((c) => ({
    ...c,
    points: c.points.map((p) => ({ x: p.x * factor, y: p.y * factor })),
  }));
}

/**
 * Politica canonica (R11):
 * 1. Se il file dichiara una dimensione fisica (mm/cm/in…) → si usa quella, esatta (method 'declared'/'unit').
 * 2. Altrimenti l'IO fornisce una stima a DPI canonico (method 'dpi').
 * 3. In ogni caso, se l'utente indica `realWidthMm` > 0, si scala uniformemente
 *    così che la sagoma sia larga esattamente quella misura. È la fonte di verità.
 */
export function applyRealWidth(result: ImportResult, realWidthMm?: number | null): Contour[] {
  if (!realWidthMm || realWidthMm <= 0 || result.widthMm <= 0) return result.contours;
  return scaleContours(result.contours, realWidthMm / result.widthMm);
}

/** Costruisce un ImportResult da contorni già in mm (es. sagoma demo). */
export function importResultFromContours(
  contours: Contour[],
  method: ImportResult['method'] = 'declared',
): ImportResult {
  const { widthMm, heightMm } = measureContours(contours);
  return { contours, widthMm, heightMm, method };
}

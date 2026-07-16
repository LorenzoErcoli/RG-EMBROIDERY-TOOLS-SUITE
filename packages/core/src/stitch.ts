// Primitive di punto: resample, min-stitch, cordoncino, running. Regole R3, R4, R24.
import type { Point, Polyline } from './types';
import { distance, lerp, unit, normal } from './geometry';

/** Suddivide SOLO: garantisce spaziatura massima `maxStepMm` (R4). Non tocca i punti corti. */
export function resampleUniform(line: Polyline, maxStepMm: number): Polyline {
  if (line.length < 2 || maxStepMm <= 0) return line.slice();
  const out: Point[] = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const d = distance(a, b);
    const n = Math.ceil(d / maxStepMm);
    for (let k = 1; k <= n; k++) out.push(lerp(a, b, k / n));
  }
  return out;
}

/** Rimuove i punti che creano segmenti < `minMm`, preservando SEMPRE gli estremi (R3). */
export function enforceMinStitch(line: Polyline, minMm: number): Polyline {
  if (line.length < 3 || minMm <= 0) return line.slice();
  const out: Point[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    if (distance(out[out.length - 1], line[i]) >= minMm) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

/**
 * Cordoncino: zig-zag stretto lungo a→b, ampiezza `widthMm`, passo longitudinale `stepMm`.
 * (Cfr. buildCordoncinoPoints di embroidery-45-grid.)
 */
export function buildCordoncino(a: Point, b: Point, widthMm: number, stepMm: number): Polyline {
  const len = distance(a, b);
  if (len < 1e-6) return [a];
  const u = unit(a, b);
  const nrm = normal(u);
  const half = widthMm / 2;
  const step = Math.max(0.05, stepMm);
  const count = Math.max(1, Math.round(len / step));
  const pts: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const center = lerp(a, b, t);
    // Estremi ESATTAMENTE sull'asse (i=0→a, i=count→b) così il cordoncino si salda ai passaggi
    // senza salto; lo zig-zag alterna solo nel corpo. Regola R26 (consecutività).
    const side = i === 0 || i === count ? 0 : (i % 2 === 0 ? half : -half);
    pts.push({ x: center.x + nrm.x * side, y: center.y + nrm.y * side });
  }
  return pts;
}

/** Punto corsa (running) semplice lungo a→b, passo `stepMm`. */
export function buildRunning(a: Point, b: Point, stepMm: number): Polyline {
  return resampleUniform([a, b], stepMm);
}

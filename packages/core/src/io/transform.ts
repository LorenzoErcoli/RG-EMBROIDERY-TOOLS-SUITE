// Matrici affini SVG: leggere un `transform` e applicarlo a un punto. Regola R11.
//
// Sta nel core perché è la stessa domanda per ogni importer della suite: "dove finisce
// davvero questo punto?". Ignorare i `transform` non dà errore — dà la forma giusta nel
// posto sbagliato, in silenzio (trovato col cannage: 4 zone su 37 arrivavano così).
// Nessun uso del DOM: funziona anche in Node, quindi è testabile.
import type { Point } from '../types';

/** Matrice affine SVG `[a b c d e f]`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

export function multiplyMatrix(parent: Matrix, child: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = parent;
  const [a2, b2, c2, d2, e2, f2] = child;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMatrix(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

/** true se la matrice non sposta nulla (scorciatoia per saltare il lavoro inutile). */
export function isIdentityMatrix(m: Matrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

const parseNumberList = (value?: string): number[] =>
  (value || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];

function transformFunctionMatrix(name: string, args: number[]): Matrix {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  if (name === 'matrix' && args.length >= 6) return [args[0], args[1], args[2], args[3], args[4], args[5]];
  if (name === 'translate') return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
  if (name === 'scale') return [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
  if (name === 'rotate') {
    const cos = Math.cos(rad(args[0] ?? 0));
    const sin = Math.sin(rad(args[0] ?? 0));
    const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
    if (args.length < 3) return rotation;
    // rotate(a, cx, cy) = translate(cx,cy) · rotate(a) · translate(-cx,-cy)
    return multiplyMatrix(multiplyMatrix([1, 0, 0, 1, args[1], args[2]], rotation), [1, 0, 0, 1, -args[1], -args[2]]);
  }
  if (name === 'skewx') return [1, 0, Math.tan(rad(args[0] ?? 0)), 1, 0, 0];
  if (name === 'skewy') return [1, Math.tan(rad(args[0] ?? 0)), 0, 1, 0, 0];
  return IDENTITY_MATRIX;
}

/** `transform="translate(…) rotate(…)"`: le funzioni si compongono da sinistra a destra. */
export function parseSvgTransform(value?: string | null): Matrix {
  if (!value) return IDENTITY_MATRIX;
  let matrix = IDENTITY_MATRIX;
  const functionRegex = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = functionRegex.exec(value)) !== null) {
    matrix = multiplyMatrix(matrix, transformFunctionMatrix(match[1].toLowerCase(), parseNumberList(match[2])));
  }
  return matrix;
}

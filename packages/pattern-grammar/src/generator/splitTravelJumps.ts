import type { Point } from "../grammar/types.ts";

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Splits only anomalously long travel moves. Normal module segments remain
 * untouched. Intended connectors should be generated before this stage.
 */
export function splitTravelJumps<T extends Point>(points: T[], multiplier = 2.5): T[][] {
  if (points.length < 2) return [points.slice()];
  const lengths = points.slice(1).map((point, index) => distance(points[index], point)).filter((value) => value > 0);
  const sorted = lengths.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = median * multiplier;
  const segments: T[][] = [[points[0]]];
  for (let index = 1; index < points.length; index++) {
    if (threshold > 0 && distance(points[index - 1], points[index]) > threshold) segments.push([]);
    segments.at(-1)!.push(points[index]);
  }
  return segments.filter((segment) => segment.length > 1);
}

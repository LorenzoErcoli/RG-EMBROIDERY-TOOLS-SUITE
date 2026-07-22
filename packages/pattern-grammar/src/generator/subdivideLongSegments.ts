import type { GeneratedPoint, Point } from "../grammar/types.ts";

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Inserts evenly distributed stitch points on long drawn segments.
 * Original vertices are copied unchanged and always remain in the output.
 */
export function subdivideLongSegments(points: GeneratedPoint[], maxStitchLength = 0): GeneratedPoint[] {
  const limit = Math.max(0, maxStitchLength);
  if (limit === 0 || points.length <= 1) return points.slice();

  const subdivided: GeneratedPoint[] = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const length = distance(previous, current);
    const parts = length > limit ? Math.ceil(length / limit) : 1;

    for (let part = 1; part < parts; part++) {
      const t = part / parts;
      subdivided.push({
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
        role: "subdivision",
        source: current.source ?? previous.source,
        columnIndex: current.columnIndex ?? previous.columnIndex,
        blockIndex: current.blockIndex ?? previous.blockIndex,
        sequenceIndex: current.sequenceIndex ?? previous.sequenceIndex
      });
    }

    subdivided.push(current);
  }

  return subdivided;
}

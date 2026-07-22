import type { GeneratedPoint } from "../grammar/types.ts";

/**
 * A travel point is the first point of the next visual segment. The machine
 * path keeps it, while the visual SVG does not draw the incoming travel line.
 */
export function splitTravelPoints(points: GeneratedPoint[]): GeneratedPoint[][] {
  if (!points.length) return [];
  const segments: GeneratedPoint[][] = [[points[0]]];
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    if (point.role === "travel") segments.push([{ ...point, role: "structural" }]);
    else segments.at(-1)!.push(point);
  }
  return segments.filter((segment) => segment.length > 1);
}

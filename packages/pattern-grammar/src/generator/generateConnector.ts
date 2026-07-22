import type { GeneratedPoint, Point } from "../grammar/types.ts";

/** Continuous turn between two adjacent serpentine columns. */
export function generateConnector(start: Point, end: Point, amplitude: number): GeneratedPoint[] {
  const direction = end.y >= start.y ? 1 : -1;
  return [
    { x: (start.x + end.x) / 2, y: start.y + amplitude * direction, role: "intermediate", source: "connector" },
    { x: end.x, y: end.y, role: "structural", source: "connector" }
  ];
}

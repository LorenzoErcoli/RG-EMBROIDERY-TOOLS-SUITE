import type { GeneratedPoint, Point } from "../grammar/types.ts";

export type CleanupPolylineOptions = {
  minSegmentLength?: number;
  preserveSharpAngles?: boolean;
  angleThresholdDeg?: number;
};

export function removeConsecutiveDuplicatePoints<T extends Point>(points: T[], tolerance = 0.0001): T[] {
  if (points.length <= 1) return points.slice();
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > tolerance);
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function turnAngleDeg(previous: Point, current: Point, next: Point): number {
  const ax = current.x - previous.x;
  const ay = current.y - previous.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!length) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / length));
  return Math.acos(cosine) * 180 / Math.PI;
}

/**
 * Removes short, low-information segments while keeping endpoint order.
 * Sharp corners survive even when their incoming segment is below the limit.
 */
export function cleanupPolyline<T extends Point>(points: T[], options: CleanupPolylineOptions = {}): T[] {
  if (points.length <= 2) return points.slice();
  const minSegmentLength = Math.max(0, options.minSegmentLength ?? 0);
  if (minSegmentLength === 0) return points.slice();
  const preserveSharpAngles = options.preserveSharpAngles ?? true;
  const angleThresholdDeg = options.angleThresholdDeg ?? 35;
  const accepted: T[] = [points[0]];

  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const longEnough = distance(accepted.at(-1)!, point) >= minSegmentLength;
    const role = (point as Partial<GeneratedPoint>).role;
    const structural = role === "structural" || role === "subdivision" || role === "boundary" || role === "boundaryConnector" || role === "travel";
    const meaningfulCorner = role === undefined && preserveSharpAngles
      && turnAngleDeg(points[index - 1], point, points[index + 1]) >= angleThresholdDeg;
    if (structural || longEnough || meaningfulCorner) accepted.push(point);
  }

  const last = points.at(-1)!;
  if (accepted.at(-1)!.x === last.x && accepted.at(-1)!.y === last.y) return accepted;
  accepted.push(last);
  return accepted;
}

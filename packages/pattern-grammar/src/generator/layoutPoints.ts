import type { Point } from "../grammar/types.ts";

export function pointBounds(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Uniformly fits geometry inside an exact physical canvas. The returned
 * coordinates, including the requested inset, are guaranteed to stay inside.
 */
export function fitPatternPoints<T extends Point>(
  points: T[],
  width: number,
  height: number,
  inset = 0
): T[] {
  const bounds = pointBounds(points);
  const availableWidth = Math.max(0, width - inset * 2);
  const availableHeight = Math.max(0, height - inset * 2);
  const scale = Math.min(
    bounds.width > 0 ? availableWidth / bounds.width : 1,
    bounds.height > 0 ? availableHeight / bounds.height : 1
  );
  const fittedWidth = bounds.width * scale;
  const fittedHeight = bounds.height * scale;
  const offsetX = inset + (availableWidth - fittedWidth) / 2;
  const offsetY = inset + (availableHeight - fittedHeight) / 2;
  return points.map((point) => ({
    ...point,
    x: (point.x - bounds.minX) * scale + offsetX,
    y: (point.y - bounds.minY) * scale + offsetY
  }));
}

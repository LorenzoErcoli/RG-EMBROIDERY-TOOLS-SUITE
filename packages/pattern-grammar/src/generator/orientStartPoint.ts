import type { Point } from "../grammar/types.ts";

export type StartOrientation = {
  target: Point;
  startPoint: Point;
  polylineIndex: number;
  reversed: boolean;
};

const distanceSq = (a: Point, b: Point): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

function targetPoint(polylines: Point[][]): Point {
  const points = polylines.flat();
  return {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y))
  };
}

/**
 * Starts from the visible polyline endpoint closest to the pattern top-left.
 * It only reverses existing open polylines; it never rotates from an internal
 * vertex because that would introduce a new artificial travel segment.
 */
export function orientPolylinesFromTopLeft<T extends Point>(polylines: T[][]): {
  polylines: T[][];
  orientation?: StartOrientation;
} {
  const visible = polylines.filter((polyline) => polyline.length > 0);
  if (!visible.length) return { polylines: [] };

  const target = targetPoint(visible);
  let best = {
    polylineIndex: 0,
    reversed: false,
    point: visible[0][0],
    distance: distanceSq(visible[0][0], target)
  };

  visible.forEach((polyline, polylineIndex) => {
    const first = polyline[0];
    const last = polyline.at(-1)!;
    const candidates = [
      { point: first, reversed: false, distance: distanceSq(first, target) },
      { point: last, reversed: true, distance: distanceSq(last, target) }
    ];
    for (const candidate of candidates) {
      if (candidate.distance < best.distance) {
        best = { polylineIndex, ...candidate };
      }
    }
  });

  const oriented = visible.map((polyline, index) =>
    index === best.polylineIndex && best.reversed ? polyline.slice().reverse() : polyline.slice()
  );
  const selected = oriented.splice(best.polylineIndex, 1)[0];
  oriented.unshift(selected);

  return {
    polylines: oriented,
    orientation: {
      target,
      startPoint: selected[0],
      polylineIndex: best.polylineIndex,
      reversed: best.reversed
    }
  };
}

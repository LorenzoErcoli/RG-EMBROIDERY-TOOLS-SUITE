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

/** L'angolo in alto a sinistra del disegno. A ciclo: lo spread crolla sui disegni grandi
 *  (stesso difetto di `pointBounds`, e questa è la strada che si percorre senza un formato). */
function targetPoint(polylines: Point[][]): Point {
  let x = Infinity;
  let y = Infinity;
  for (const polyline of polylines) {
    for (const point of polyline) {
      if (point.x < x) x = point.x;
      if (point.y < y) y = point.y;
    }
  }
  return { x, y };
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

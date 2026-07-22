import type { GeneratedPoint, PointSource } from "../grammar/types.ts";

export type ModulePhase = "vertical" | "horizontal";
export type ModuleGeometry = { points: GeneratedPoint[]; phase: ModulePhase };

export type ModuleShapeConfig = {
  horizontalZigzagWidth?: number;
  horizontalZigzagHeight?: number;
  horizontalZigzagPasses?: number;
  horizontalZigzagOffsetX?: number;
  horizontalAngleDeg?: number;
  columnSpacing?: number;
  verticalZigzagWidth?: number;
  verticalZigzagPasses?: number;
};

const structural = (x: number, y: number, source?: PointSource): GeneratedPoint => ({ x, y, role: "structural", source });

/**
 * One horizontal density unit is one complete movement:
 * column -> left extreme -> column.
 */
export function generateHorizontalZigzag(
  x0: number,
  y0: number,
  width: number,
  blockHeight: number,
  density = 1
): GeneratedPoint[] {
  const movements = Math.max(1, Math.floor(density));
  const movementHeight = blockHeight / movements;
  const points: GeneratedPoint[] = [structural(x0, y0, "horizontalZigzag")];
  for (let movement = 0; movement < movements; movement++) {
    points.push(
      structural(x0 - width, y0 + (movement + 0.5) * movementHeight, "horizontalZigzag"),
      structural(x0, y0 + (movement + 1) * movementHeight, "horizontalZigzag")
    );
  }
  return points;
}

/**
 * Density 1 is a regular vertical column sampled every `step`. Higher density
 * restores the original vertical traversal logic: every pass crosses the full
 * height, while X changes only to position the next vertical pass.
 */
export function generateVerticalZigzag(
  x: number,
  y: number,
  height: number,
  step: number,
  zigzagWidth = 1.2,
  density = 1
): GeneratedPoint[] {
  const safeStep = step > 0 ? step : height;
  const intervals = Math.max(1, Math.round(height / safeStep));
  const passes = Math.max(1, Math.floor(density));
  if (passes === 1) {
    return Array.from({ length: intervals + 1 }, (_, index) =>
      structural(x, y + height * index / intervals, "verticalZigzag")
    );
  }
  const halfWidth = zigzagWidth / 2;
  const xs = Array.from({ length: passes }, (_, index) =>
    passes === 1 ? x : x - halfWidth + zigzagWidth * index / (passes - 1)
  );
  const points: GeneratedPoint[] = [structural(xs[0], y, "verticalZigzag")];
  for (let pass = 0; pass < passes; pass++) {
    points.push(structural(xs[pass], y + height, "verticalZigzag"));
    if (pass < passes - 1) {
      points.push(structural(xs[pass + 1], y, "verticalZigzag"));
    }
  }
  return points;
}

/** Compatibility wrapper for the original public API. */
export function generateVerticalMicroZigzag(
  width: number,
  height: number,
  zigzagWidth = 1.2,
  passes = 2
): GeneratedPoint[] {
  return generateVerticalZigzag(width / 2, 0, height, height, zigzagWidth, passes);
}

function horizontalPhase(width: number, height: number, shape: ModuleShapeConfig): GeneratedPoint[] {
  const cx = width / 2;
  const zigzagWidth = shape.horizontalZigzagWidth ?? 5.5;
  const zigzagHeight = Math.min(height, shape.horizontalZigzagHeight ?? 4.3);
  const top = (height - zigzagHeight) / 2;
  const bottom = top + zigzagHeight;
  const density = Math.max(1, Math.floor(shape.horizontalZigzagPasses ?? 4));
  const xOrigin = cx - (shape.horizontalZigzagOffsetX ?? 0);
  const bundle = generateHorizontalZigzag(xOrigin, top, zigzagWidth, zigzagHeight, density);
  const points = [
    ...(top > 0 ? [structural(cx, 0, "horizontalZigzag")] : []),
    ...bundle,
    ...(bottom < height ? [structural(cx, height, "horizontalZigzag")] : [])
  ];
  const angle = (shape.horizontalAngleDeg ?? 0) * Math.PI / 180;
  if (angle === 0) return points;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const center = { x: cx - zigzagWidth / 2, y: top + zigzagHeight / 2 };
  return points.map((point) => {
    if (point.x === cx) return point;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      ...point,
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  });
}

/**
 * Returns one continuous phase cell. Density 1 is always the mathematically
 * simplest valid form for both phases.
 */
export function generateModule(
  width: number,
  height: number,
  phase: ModulePhase = "vertical",
  direction: 1 | -1 = 1,
  shape: ModuleShapeConfig = {}
): ModuleGeometry {
  const points = phase === "vertical"
    ? generateVerticalMicroZigzag(width, height, shape.verticalZigzagWidth, shape.verticalZigzagPasses)
    : horizontalPhase(width, height, shape);
  return {
    phase,
    points: direction === 1 ? points : points.map((point) => ({ ...point, y: height - point.y }))
  };
}

import type { BoundaryCleanupMode, GeneratedPoint, ImportedBoundary, Point, ShapeType } from "../grammar/types.ts";

export type BoundaryOptions = {
  width: number;
  height: number;
  inset?: number;
  shapeType: ShapeType;
  importedBoundary?: ImportedBoundary;
};

export type ClippedPathChunk<T extends Point = GeneratedPoint> = {
  points: T[];
  sourceStartIndex: number;
  sourceEndIndex: number;
};

export type TravelMove = {
  from: Point;
  to: Point;
  draw: false;
};

export type BoundaryClipResult<T extends Point = GeneratedPoint> = {
  chunks: Array<ClippedPathChunk<T>>;
  travelMoves: TravelMove[];
};

export type BoundaryConnectionOptions = BoundaryOptions & {
  connectorStep?: number;
};

export type BoundaryCleanupOptions = BoundaryOptions & {
  minPointDistance?: number;
  boundaryCleanupMode?: BoundaryCleanupMode;
  maxBoundaryAdjustment?: number;
};

const EPSILON = 1e-9;

const samePoint = (a: Point, b: Point, tolerance = 0.0001): boolean =>
  Math.hypot(b.x - a.x, b.y - a.y) <= tolerance;

function metrics(options: BoundaryOptions) {
  const inset = Math.max(0, options.inset ?? 0);
  const cx = options.width / 2;
  const cy = options.height / 2;
  return {
    cx,
    cy,
    rx: Math.max(0.001, cx - inset),
    ry: Math.max(0.001, cy - inset)
  };
}

export function isInsideBoundary(point: Point, options: BoundaryOptions, tolerance = 1e-7): boolean {
  if (options.shapeType === "none") return true;
  if (options.shapeType === "rectangle") {
    const inset = Math.max(0, options.inset ?? 0);
    return point.x >= inset - tolerance && point.x <= options.width - inset + tolerance
      && point.y >= inset - tolerance && point.y <= options.height - inset + tolerance;
  }
  if (options.shapeType === "imported") {
    const polygon = importedBoundaryPolygon(options);
    if (!polygon.length) return true;
    return pointInPolygon(point, polygon) || nearestPointOnPolygonBoundary(point, polygon).distance <= tolerance;
  }
  const { cx, cy, rx, ry } = metrics(options);
  const nx = (point.x - cx) / rx;
  const ny = (point.y - cy) / ry;
  return options.shapeType === "circle"
    ? nx * nx + ny * ny <= 1 + tolerance
    : Math.abs(nx) + Math.abs(ny) <= 1 + tolerance;
}

function circleSegmentInterval(a: Point, b: Point, options: BoundaryOptions): [number, number] | undefined {
  const { cx, cy, rx, ry } = metrics(options);
  const x0 = (a.x - cx) / rx;
  const y0 = (a.y - cy) / ry;
  const dx = (b.x - a.x) / rx;
  const dy = (b.y - a.y) / ry;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (x0 * dx + y0 * dy);
  const qc = x0 * x0 + y0 * y0 - 1;

  if (Math.abs(qa) <= EPSILON) return qc <= 0 ? [0, 1] : undefined;
  const discriminant = qb * qb - 4 * qa * qc;
  if (discriminant < -EPSILON) return qc <= 0 ? [0, 1] : undefined;
  const root = Math.sqrt(Math.max(0, discriminant));
  const t1 = (-qb - root) / (2 * qa);
  const t2 = (-qb + root) / (2 * qa);
  const start = Math.max(0, Math.min(t1, t2));
  const end = Math.min(1, Math.max(t1, t2));
  return start <= end + EPSILON ? [Math.max(0, start), Math.min(1, end)] : undefined;
}

function diamondSegmentInterval(a: Point, b: Point, options: BoundaryOptions): [number, number] | undefined {
  const { cx, cy, rx, ry } = metrics(options);
  const x0 = (a.x - cx) / rx;
  const y0 = (a.y - cy) / ry;
  const dx = (b.x - a.x) / rx;
  const dy = (b.y - a.y) / ry;
  const planes = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
  let enter = 0;
  let exit = 1;

  for (const [nx, ny] of planes) {
    const value = nx * x0 + ny * y0 - 1;
    const delta = nx * dx + ny * dy;
    if (Math.abs(delta) <= EPSILON) {
      if (value > EPSILON) return undefined;
      continue;
    }
    const t = -value / delta;
    if (delta > 0) exit = Math.min(exit, t);
    else enter = Math.max(enter, t);
    if (enter > exit + EPSILON) return undefined;
  }

  return [Math.max(0, enter), Math.min(1, exit)];
}

/** Taglio del segmento al rettangolo del pannello [inset..width-inset] × [inset..height-inset] (Liang-Barsky). */
function rectangleSegmentInterval(a: Point, b: Point, options: BoundaryOptions): [number, number] | undefined {
  const inset = Math.max(0, options.inset ?? 0);
  const minX = inset, maxX = options.width - inset;
  const minY = inset, maxY = options.height - inset;
  const dx = b.x - a.x, dy = b.y - a.y;
  let enter = 0, exit = 1;
  const edges: Array<[number, number]> = [
    [-dx, a.x - minX], // x >= minX
    [dx, maxX - a.x],  // x <= maxX
    [-dy, a.y - minY], // y >= minY
    [dy, maxY - a.y],  // y <= maxY
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) <= EPSILON) { if (q < -EPSILON) return undefined; continue; }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit + EPSILON) return undefined;
  }
  return [Math.max(0, enter), Math.min(1, exit)];
}

function segmentInterval(a: Point, b: Point, options: BoundaryOptions): [number, number] | undefined {
  if (options.shapeType === "none") return [0, 1];
  if (options.shapeType === "rectangle") return rectangleSegmentInterval(a, b, options);
  if (options.shapeType === "imported") return polygonSegmentInterval(a, b, options);
  return options.shapeType === "circle"
    ? circleSegmentInterval(a, b, options)
    : diamondSegmentInterval(a, b, options);
}

function pointAt(a: GeneratedPoint, b: GeneratedPoint, t: number): GeneratedPoint {
  if (t <= EPSILON) return a;
  if (t >= 1 - EPSILON) return b;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    role: "boundary",
    source: b.source ?? a.source,
    columnIndex: b.columnIndex ?? a.columnIndex,
    blockIndex: b.blockIndex ?? a.blockIndex,
    sequenceIndex: b.sequenceIndex ?? a.sequenceIndex
  };
}

function appendUnique(points: GeneratedPoint[], point: GeneratedPoint): void {
  if (!points.length || !samePoint(points.at(-1)!, point)) points.push(point);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

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

function segmentStaysInside(a: Point, b: Point, options: BoundaryOptions): boolean {
  const samples = 6;
  for (let index = 0; index <= samples; index++) {
    const t = index / samples;
    if (!isInsideBoundary({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    }, options, 1e-5)) return false;
  }
  return true;
}

function boundaryLike(point: GeneratedPoint): boolean {
  return point.role === "boundary" || point.role === "boundaryConnector";
}

function removableBoundaryPoint(previous: GeneratedPoint, current: GeneratedPoint, next: GeneratedPoint, options: BoundaryCleanupOptions): boolean {
  if (!boundaryLike(current)) return false;
  if (!segmentStaysInside(previous, next, options)) return false;
  if (current.role === "boundaryConnector" && turnAngleDeg(previous, current, next) >= 35) return false;
  return true;
}

function validAdjustedPoint(previous: GeneratedPoint, candidate: GeneratedPoint, next: GeneratedPoint, options: BoundaryCleanupOptions, minPointDistance: number): boolean {
  return distance(previous, candidate) >= minPointDistance
    && distance(candidate, next) >= minPointDistance
    && isInsideBoundary(candidate, options, 1e-5)
    && segmentStaysInside(previous, candidate, options)
    && segmentStaysInside(candidate, next, options);
}

function circlePointAtAngle(angle: number, options: BoundaryOptions): Point {
  const { cx, cy, rx, ry } = metrics(options);
  return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
}

function circleAngle(point: Point, options: BoundaryOptions): number {
  const { cx, cy, rx, ry } = metrics(options);
  return Math.atan2((point.y - cy) / ry, (point.x - cx) / rx);
}

function diamondPointAtPerimeter(perimeter: number, vertices: Point[], total: number): Point {
  let remaining = ((perimeter % total) + total) % total;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const length = edgeLength(a, b);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return vertices[0];
}

function rectangleVertices(options: BoundaryOptions): Point[] {
  const inset = Math.max(0, options.inset ?? 0);
  return [
    { x: inset, y: inset },
    { x: options.width - inset, y: inset },
    { x: options.width - inset, y: options.height - inset },
    { x: inset, y: options.height - inset }
  ];
}

function polygonPerimeterPosition(point: Point, vertices: Point[]) {
  const lengths = vertices.map((vertex, index) => edgeLength(vertex, vertices[(index + 1) % vertices.length]));
  let cumulative = 0;
  let best = {
    edgeIndex: 0,
    t: 0,
    perimeter: 0,
    distance: Number.POSITIVE_INFINITY
  };
  for (let index = 0; index < vertices.length; index++) {
    const edge = closestPointOnSegment(point, vertices[index], vertices[(index + 1) % vertices.length]);
    if (edge.distance < best.distance) {
      best = {
        edgeIndex: index,
        t: edge.t,
        perimeter: cumulative + lengths[index] * edge.t,
        distance: edge.distance
      };
    }
    cumulative += lengths[index];
  }
  return { ...best, lengths, total: cumulative };
}

function boundaryCandidate(point: Point, template: GeneratedPoint, role: "boundary" | "boundaryConnector" = template.role === "boundaryConnector" ? "boundaryConnector" : "boundary"): GeneratedPoint {
  return {
    ...template,
    x: point.x,
    y: point.y,
    role
  };
}

function tryMoveAlongBoundary(
  previous: GeneratedPoint,
  current: GeneratedPoint,
  next: GeneratedPoint,
  options: BoundaryCleanupOptions,
  minPointDistance: number,
  maxAdjustment: number
): GeneratedPoint | undefined {
  if (!boundaryLike(current) || maxAdjustment <= 0) return undefined;
  const sampleCount = 24;
  const candidates: GeneratedPoint[] = [];

  if (options.shapeType === "circle") {
    const { rx, ry } = metrics(options);
    const radius = (rx + ry) / 2;
    const baseAngle = circleAngle(current, options);
    const maxAngle = maxAdjustment / Math.max(0.001, radius);
    for (let index = 1; index <= sampleCount; index++) {
      const delta = maxAngle * index / sampleCount;
      candidates.push(
        boundaryCandidate(circlePointAtAngle(baseAngle + delta, options), current),
        boundaryCandidate(circlePointAtAngle(baseAngle - delta, options), current)
      );
    }
  } else if (options.shapeType === "diamond" || options.shapeType === "rectangle" || options.shapeType === "imported") {
    const vertices = options.shapeType === "diamond"
      ? diamondVertices(options)
      : options.shapeType === "imported"
        ? importedBoundaryPolygon(options)
        : rectangleVertices(options);
    if (!vertices.length) return undefined;
    const position = polygonPerimeterPosition(current, vertices);
    for (let index = 1; index <= sampleCount; index++) {
      const delta = maxAdjustment * index / sampleCount;
      candidates.push(
        boundaryCandidate(diamondPointAtPerimeter(position.perimeter + delta, vertices, position.total), current),
        boundaryCandidate(diamondPointAtPerimeter(position.perimeter - delta, vertices, position.total), current)
      );
    }
  }

  return candidates
    .filter((candidate) => distance(current, candidate) <= maxAdjustment + 0.0001)
    .filter((candidate) => validAdjustedPoint(previous, candidate, next, options, minPointDistance))
    .sort((a, b) => distance(current, a) - distance(current, b))[0];
}

function projectToBoundary(point: GeneratedPoint, options: BoundaryCleanupOptions): GeneratedPoint | undefined {
  if (options.shapeType === "circle") {
    const { cx, cy, rx, ry } = metrics(options);
    const angle = circleAngle(point, options);
    return boundaryCandidate({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }, point, "boundary");
  }
  if (options.shapeType === "diamond" || options.shapeType === "rectangle" || options.shapeType === "imported") {
    const vertices = options.shapeType === "diamond"
      ? diamondVertices(options)
      : options.shapeType === "imported"
        ? importedBoundaryPolygon(options)
        : rectangleVertices(options);
    if (!vertices.length) return undefined;
    const position = polygonPerimeterPosition(point, vertices);
    return boundaryCandidate(diamondPointAtPerimeter(position.perimeter, vertices, position.total), point, "boundary");
  }
  return undefined;
}

function tryProjectNearBoundary(
  previous: GeneratedPoint,
  current: GeneratedPoint,
  next: GeneratedPoint,
  options: BoundaryCleanupOptions,
  minPointDistance: number,
  maxAdjustment: number
): GeneratedPoint | undefined {
  if (boundaryLike(current) || maxAdjustment <= 0) return undefined;
  const projected = projectToBoundary(current, options);
  if (!projected) return undefined;
  if (distance(current, projected) > maxAdjustment) return undefined;
  return validAdjustedPoint(previous, projected, next, options, minPointDistance) ? projected : undefined;
}

export function cleanupBoundaryConnectedPath(points: GeneratedPoint[], options: BoundaryCleanupOptions): GeneratedPoint[] {
  const minPointDistance = Math.max(0, options.minPointDistance ?? 0);
  const mode = options.boundaryCleanupMode ?? "adjust-then-delete";
  const maxAdjustment = Math.max(0, options.maxBoundaryAdjustment ?? minPointDistance);
  const deduped = removeNearDuplicateBoundaryPoints(points, Math.max(0.0001, minPointDistance || 0.0001));
  if (minPointDistance === 0 || deduped.length <= 2) return deduped;

  const cleaned: GeneratedPoint[] = [deduped[0]];
  for (let index = 1; index < deduped.length - 1; index++) {
    const current = deduped[index];
    const previous = cleaned.at(-1)!;
    const next = deduped[index + 1];
    const tooClose = distance(previous, current) < minPointDistance;
    const removable = current.role === "intermediate"
      || current.role === "subdivision"
      || removableBoundaryPoint(previous, current, next, options);
    if (tooClose && mode === "adjust-then-delete") {
      const adjusted = tryMoveAlongBoundary(previous, current, next, options, minPointDistance, maxAdjustment)
        ?? tryProjectNearBoundary(previous, current, next, options, minPointDistance, maxAdjustment);
      if (adjusted) {
        cleaned.push(adjusted);
        continue;
      }
    }
    if (tooClose && removable) continue;
    cleaned.push(current);
  }

  const last = deduped.at(-1)!;
  if (!samePoint(cleaned.at(-1)!, last)) cleaned.push(last);
  return cleaned;
}

function removeNearDuplicateBoundaryPoints(points: GeneratedPoint[], tolerance: number): GeneratedPoint[] {
  if (points.length <= 1) return points.slice();
  const result: GeneratedPoint[] = [points[0]];
  for (const point of points.slice(1)) {
    const previous = result.at(-1)!;
    if (distance(previous, point) < tolerance && boundaryLike(previous) && boundaryLike(point)) {
      continue;
    }
    result.push(point);
  }
  return result;
}

function connectorPoint(point: Point, template?: GeneratedPoint): GeneratedPoint {
  return {
    x: point.x,
    y: point.y,
    role: "boundaryConnector",
    source: "connector",
    columnIndex: template?.columnIndex,
    blockIndex: template?.blockIndex,
    sequenceIndex: template?.sequenceIndex
  };
}

const normalizeAngle = (angle: number): number => {
  let value = angle;
  while (value <= -Math.PI) value += Math.PI * 2;
  while (value > Math.PI) value -= Math.PI * 2;
  return value;
};

function circleBoundaryConnector(from: GeneratedPoint, to: GeneratedPoint, options: BoundaryConnectionOptions): GeneratedPoint[] {
  const { cx, cy, rx, ry } = metrics(options);
  const a0 = Math.atan2((from.y - cy) / ry, (from.x - cx) / rx);
  const a1 = Math.atan2((to.y - cy) / ry, (to.x - cx) / rx);
  const delta = normalizeAngle(a1 - a0);
  const radius = (rx + ry) / 2;
  const step = Math.max(0.5, options.connectorStep ?? 2);
  const parts = Math.max(1, Math.ceil(Math.abs(delta) * radius / step));
  const points: GeneratedPoint[] = [];

  for (let index = 1; index < parts; index++) {
    const angle = a0 + delta * index / parts;
    points.push(connectorPoint({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    }, to));
  }
  points.push(connectorPoint(to, to));
  return points;
}

function diamondVertices(options: BoundaryConnectionOptions): Point[] {
  const { cx, cy, rx, ry } = metrics(options);
  return [
    { x: cx, y: cy - ry },
    { x: cx + rx, y: cy },
    { x: cx, y: cy + ry },
    { x: cx - rx, y: cy }
  ];
}

function edgeLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function closestPointOnSegment(point: Point, a: Point, b: Point): { t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const rawT = lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  const t = Math.max(0, Math.min(1, rawT));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return { t, distance: Math.hypot(point.x - x, point.y - y) };
}

function diamondPerimeterPosition(point: Point, vertices: Point[]) {
  const lengths = vertices.map((vertex, index) => edgeLength(vertex, vertices[(index + 1) % vertices.length]));
  let cumulative = 0;
  let best = {
    edgeIndex: 0,
    t: 0,
    perimeter: 0,
    distance: Number.POSITIVE_INFINITY
  };
  for (let index = 0; index < vertices.length; index++) {
    const edge = closestPointOnSegment(point, vertices[index], vertices[(index + 1) % vertices.length]);
    if (edge.distance < best.distance) {
      best = {
        edgeIndex: index,
        t: edge.t,
        perimeter: cumulative + lengths[index] * edge.t,
        distance: edge.distance
      };
    }
    cumulative += lengths[index];
  }
  return { ...best, lengths, total: cumulative };
}

function diamondBoundaryConnector(from: GeneratedPoint, to: GeneratedPoint, options: BoundaryConnectionOptions): GeneratedPoint[] {
  const vertices = diamondVertices(options);
  return polygonBoundaryConnector(from, to, vertices, options);
}

function polygonBoundaryConnector(
  from: GeneratedPoint,
  to: GeneratedPoint,
  vertices: Point[],
  options: BoundaryConnectionOptions
): GeneratedPoint[] {
  if (vertices.length < 2) return [connectorPoint(to, to)];
  const start = diamondPerimeterPosition(from, vertices);
  const end = diamondPerimeterPosition(to, vertices);
  const clockwise = (end.perimeter - start.perimeter + start.total) % start.total;
  const counterClockwise = (start.perimeter - end.perimeter + start.total) % start.total;
  const direction = clockwise <= counterClockwise ? 1 : -1;
  const points: GeneratedPoint[] = [];
  let edge = start.edgeIndex;

  while (edge !== end.edgeIndex) {
    const nextVertexIndex = direction === 1 ? (edge + 1) % vertices.length : edge;
    points.push(connectorPoint(vertices[nextVertexIndex], to));
    edge = direction === 1
      ? (edge + 1) % vertices.length
      : (edge - 1 + vertices.length) % vertices.length;
  }

  points.push(connectorPoint(to, to));
  return points;
}

function boundaryConnector(from: GeneratedPoint, to: GeneratedPoint, options: BoundaryConnectionOptions): GeneratedPoint[] {
  if (samePoint(from, to)) return [connectorPoint(to, to)];
  if (options.shapeType === "circle") return circleBoundaryConnector(from, to, options);
  if (options.shapeType === "diamond") return diamondBoundaryConnector(from, to, options);
  if (options.shapeType === "imported") return polygonBoundaryConnector(from, to, importedBoundaryPolygon(options), options);
  if (options.shapeType === "rectangle") return polygonBoundaryConnector(from, to, rectangleVertices(options), options);
  return [connectorPoint(to, to)];
}

export function connectClippedChunksAlongBoundary(
  chunks: Array<ClippedPathChunk<GeneratedPoint>>,
  options: BoundaryConnectionOptions
): GeneratedPoint[] {
  if (chunks.length === 0) return [];
  const connected: GeneratedPoint[] = [];

  for (const chunk of chunks) {
    if (!chunk.points.length) continue;
    if (!connected.length) {
      connected.push(...chunk.points);
      continue;
    }

    const from = connected.at(-1)!;
    const to = chunk.points[0];
    for (const point of boundaryConnector(from, to, options)) appendUnique(connected, point);
    for (const point of chunk.points.slice(1)) appendUnique(connected, point);
  }

  return connected;
}

export function clipPathToBoundaryChunks(
  points: GeneratedPoint[],
  options: BoundaryOptions
): BoundaryClipResult<GeneratedPoint> {
  if (points.length === 0) return { chunks: [], travelMoves: [] };
  if (options.shapeType === "none") {
    // Nessun ritaglio: tutto passa. "rectangle" invece taglia davvero (cade nel ciclo sotto).
    return { chunks: [{ points: points.slice(), sourceStartIndex: 0, sourceEndIndex: points.length - 1 }], travelMoves: [] };
  }

  const chunks: Array<ClippedPathChunk<GeneratedPoint>> = [];
  const travelMoves: TravelMove[] = [];
  let current: ClippedPathChunk<GeneratedPoint> | undefined;
  let previousEndedAtSegmentEnd = false;
  let lastClosedPoint: GeneratedPoint | undefined;

  const closeCurrent = () => {
    if (!current) return;
    if (current.points.length > 1) {
      chunks.push(current);
      lastClosedPoint = current.points.at(-1);
    }
    current = undefined;
    previousEndedAtSegmentEnd = false;
  };

  const openCurrent = (startPoint: GeneratedPoint, sourceIndex: number) => {
    if (lastClosedPoint && !samePoint(lastClosedPoint, startPoint)) {
      travelMoves.push({ from: lastClosedPoint, to: startPoint, draw: false });
    }
    current = { points: [startPoint], sourceStartIndex: sourceIndex, sourceEndIndex: sourceIndex };
  };

  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const interval = segmentInterval(a, b, options);
    if (!interval) {
      closeCurrent();
      continue;
    }

    const [rawStart, rawEnd] = interval;
    const start = Math.max(0, Math.min(1, rawStart));
    const end = Math.max(0, Math.min(1, rawEnd));
    if (end < start || end - start <= EPSILON) {
      closeCurrent();
      continue;
    }

    const startPoint = pointAt(a, b, start);
    const endPoint = pointAt(a, b, end);
    const continuesPrevious = current && previousEndedAtSegmentEnd && start <= EPSILON;
    if (!continuesPrevious) {
      closeCurrent();
      openCurrent(startPoint, index);
    }

    appendUnique(current!.points, endPoint);
    current!.sourceEndIndex = index + 1;
    previousEndedAtSegmentEnd = end >= 1 - EPSILON;
    if (!previousEndedAtSegmentEnd) closeCurrent();
  }

  closeCurrent();
  return { chunks, travelMoves };
}

/**
 * Compatibility helper: returns visible clipped points flattened in source order.
 * New generation code should prefer clipPathToBoundaryChunks to preserve breaks.
 */
export function applyBoundary(points: GeneratedPoint[], options: BoundaryOptions): GeneratedPoint[] {
  return clipPathToBoundaryChunks(points, options).chunks.flatMap((chunk) => chunk.points);
}

function importedBoundaryPolygon(options: BoundaryOptions): Point[] {
  const paths = options.importedBoundary?.paths ?? [];
  const closed = paths
    .filter((path) => path.closed && path.points.length >= 3)
    .map((path) => closePolygon(path.points))
    .sort((a, b) => polygonArea(b) - polygonArea(a));
  return closed[0] ?? [];
}

function closePolygon(points: Point[]): Point[] {
  if (!points.length) return [];
  const first = points[0];
  const last = points[points.length - 1];
  return samePoint(first, last) ? points.slice() : [...points, { ...first }];
}

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length - 1; index++) {
    sum += points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
  }
  return Math.abs(sum / 2);
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function nearestPointOnPolygonBoundary(point: Point, polygon: Point[]) {
  let best = { point: polygon[0] ?? { x: 0, y: 0 }, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < polygon.length - 1; index++) {
    const candidate = closestPointOnSegment(point, polygon[index], polygon[index + 1]);
    if (candidate.distance < best.distance) best = { point: { x: polygon[index].x + (polygon[index + 1].x - polygon[index].x) * candidate.t, y: polygon[index].y + (polygon[index + 1].y - polygon[index].y) * candidate.t }, distance: candidate.distance };
  }
  return best;
}

function segmentIntersectionT(a: Point, b: Point, c: Point, d: Point): number | undefined {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const ac = { x: c.x - a.x, y: c.y - a.y };
  const t = cross(ac, s) / denominator;
  const u = cross(ac, r) / denominator;
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON
    ? Math.max(0, Math.min(1, t))
    : undefined;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function polygonSegmentInterval(a: Point, b: Point, options: BoundaryOptions): [number, number] | undefined {
  const polygon = importedBoundaryPolygon(options);
  if (polygon.length < 3) return [0, 1];
  const values = [0, 1];
  for (let index = 0; index < polygon.length - 1; index++) {
    const t = segmentIntersectionT(a, b, polygon[index], polygon[index + 1]);
    if (t !== undefined) values.push(t);
  }
  const sorted = [...new Set(values.map((value) => Number(value.toFixed(8))))].sort((left, right) => left - right);
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index < sorted.length - 1; index++) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end - start <= EPSILON) continue;
    const middle = (start + end) / 2;
    if (pointInPolygon(pointOnSegment(a, b, middle), polygon)) intervals.push([start, end]);
  }
  if (pointInPolygon(a, polygon)) intervals.unshift([0, sorted[1] ?? 1]);
  if (pointInPolygon(b, polygon)) intervals.push([sorted.at(-2) ?? 0, 1]);
  const unique = intervals
    .map(([start, end]) => [Math.max(0, start), Math.min(1, end)] as [number, number])
    .filter(([start, end]) => end - start > EPSILON)
    .sort((left, right) => (right[1] - right[0]) - (left[1] - left[0]));
  return unique[0];
}

function pointOnSegment(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

import type { BoundaryCleanupMode, GeneratedPoint, ImportedBoundary, Point, ShapeType } from "../grammar/types.ts";
// Girare attorno a un'area vuota è una domanda già risolta nel core (R5, `avoidVoids`, usata da
// net-45): si riusa, non si riscrive — sarebbe la seconda risposta alla stessa domanda (R28).
import { avoidVoids, simplifyPolyline } from "@rg/core";

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
  if (options.shapeType === "imported") return insideImported(point, options, tolerance);
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

/**
 * Il perimetro su cui lavorare. Con le sole AREE VUOTE dichiarate e nessun contorno (Lorenzo,
 * 2026-10-01: «fai valere l'area vuota anche da sola») il perimetro è il RETTANGOLO DEL PANNELLO: il
 * vuoto toglie il suo buco e tutto il resto — formato compreso — si comporta come prima.
 */
function perimetroImportato(outer: Point[], options: BoundaryOptions): Point[] {
  return outer.length >= 3 ? outer : closePolygon(rectangleVertices(options));
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
  if (options.shapeType === "imported") {
    // Il raccordo cammina sul PERIMETRO, che però può passare sopra un'area vuota: il giro va
    // deviato attorno ai buchi, altrimenti il filo attraversa il vuoto (misurato sulla cornice
    // di Lorenzo: 490 punti di raccordo dentro lo specchio, fino a 26,1mm di profondità).
    const { outer: importato, holes } = importedBoundaryParts(options);
    const outer = perimetroImportato(importato, options);
    const way = polygonBoundaryConnector(from, to, outer, options);
    if (!holes.length || way.length < 2) return way;
    const around = avoidVoids([from, ...way], holes, options.inset ?? 0).slice(1);
    return around.map((point) => connectorPoint(point, to));
  }
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
      // a ciclo, non `push(...)`: lo spread passa un argomento per punto, e su un pezzo grande (440 mm
      // di punto canvas, col vuoto attraversato a impuntura il filo non si spezza più) un tratto
      // supera i centomila punti e il motore si fermava con "Maximum call stack size exceeded".
      for (const point of chunk.points) connected.push(point);
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

/**
 * I poligoni del contorno importato: **il più grande è il perimetro, gli altri sono BUCHI**.
 *
 * È la convenzione dei tracciati composti di Illustrator, ed è quella che serve per le AREE
 * VUOTE (R5): una cornice è il suo rettangolo esterno meno l'apertura interna. Prima si teneva
 * solo `closed[0]` e tutto il resto spariva in silenzio — un file con la cornice e la sua
 * apertura veniva ricamato pieno, buco compreso.
 */
/**
 * I poligoni si calcolano UNA VOLTA per contorno importato, non a ogni domanda.
 *
 * `isInsideBoundary` e `polygonSegmentInterval` chiamano questa funzione per OGNI punto e per
 * OGNI segmento: rifare filtro, chiusura e ordinamento ogni volta costa quanto la geometria.
 * Misurato sulla cornice di Lorenzo, dove l'anello dello specchio ha **20.825 vertici** perché
 * Illustrator ha campionato le curve: senza cache la generazione non finiva in due minuti.
 * Il costo c'era anche prima di gestire i buchi — solo, con un anello solo si notava meno.
 */
const boundaryCache = new WeakMap<ImportedBoundary, { outer: Point[]; holes: Point[][] }>();

/** Sopra questo numero di vertici un anello si semplifica: la tolleranza è sotto il filo (R15). */
const DENSE_RING_VERTICES = 2000;
const RING_SIMPLIFY_MM = 0.05;

function importedBoundaryParts(options: BoundaryOptions): { outer: Point[]; holes: Point[][] } {
  const boundary = options.importedBoundary;
  if (!boundary) return { outer: [], holes: [] };
  const cached = boundaryCache.get(boundary);
  if (cached) return cached;
  const computed = computeBoundaryParts(options);
  boundaryCache.set(boundary, computed);
  return computed;
}

function computeBoundaryParts(options: BoundaryOptions): { outer: Point[]; holes: Point[][] } {
  const closed = (options.importedBoundary?.paths ?? [])
    .filter((path) => path.closed && path.points.length >= 3);
  const byArea = (paths: typeof closed) => paths
    .map((path) => closePolygon(
      // Un anello con decine di migliaia di vertici va semplificato: la tolleranza è più fine
      // del filo disegnato, quindi la forma non cambia, ma ogni test geometrico costa 30 volte
      // meno. È `simplifyPolyline` del core, promossa da oblique — non se ne scrive un'altra.
      path.points.length > DENSE_RING_VERTICES ? simplifyPolyline(path.points, RING_SIMPLIFY_MM) : path.points,
    ))
    .sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));

  // Se qualcuno DICHIARA i vuoti, si crede a lui: un vuoto può essere più grande del contorno
  // che lo contiene (una cornice sottile) e l'area darebbe la risposta rovesciata.
  const declared = closed.filter((path) => path.hole === true);
  if (declared.length) {
    const perimeters = byArea(closed.filter((path) => path.hole !== true));
    return { outer: perimeters[0] ?? [], holes: [...perimeters.slice(1), ...byArea(declared)] };
  }
  const all = byArea(closed);
  return { outer: all[0] ?? [], holes: all.slice(1) };
}

/** Le sole AREE VUOTE del contorno importato (anelli chiusi, già semplificati e in cache). */
export function importedVoidRings(options: BoundaryOptions): Point[][] {
  return importedBoundaryParts(options).holes;
}

/**
 * Dentro le aree vuote il pattern diventa un'IMPUNTURA (Lorenzo, 2026-10-01: «se l'area è al centro di
 * colonne di punti particolari, dentro quell'area i punti particolari spariscono e tutto diventa
 * un'impuntura semplice, per poi riprendere fuori dall'area»).
 *
 * Ogni corsa di punti dentro un vuoto si sostituisce con la RETTA dal punto d'entrata a quello
 * d'uscita, ricampionata a `stitchMm`: il filo non si stacca, non ricama il motivo, e riprende dove
 * esce. Il taglio sul vuoto si disattiva a monte (chi chiama toglie i buchi dalla sagoma di ritaglio),
 * altrimenti l'impuntura appena messa verrebbe tolta subito dopo.
 */
export function runningStitchInVoids<T extends Point>(points: T[], holes: Point[][], stitchMm: number, minStitchMm = 0): T[] {
  if (!(stitchMm > 0) || !holes.length || points.length < 2) return points;
  const dentro = (point: Point) => holes.some((hole) => pointInPolygon(point, hole));
  // L'ASSE di ogni colonna: la x media dei suoi punti. Le impunture stanno lì, una per colonna e a passo
  // regolare — non dove lo zig-zag tocca la linea, che cade in un punto qualunque della larghezza della
  // colonna e dava righe a distanze irregolari (Lorenzo, 2026-10-01: «vorrei che fosse tutto ordinato»).
  const somme = new Map<number, { x: number; n: number }>();
  for (const point of points) {
    const colonna = (point as { columnIndex?: number }).columnIndex;
    if (colonna === undefined) continue;
    const acc = somme.get(colonna) ?? { x: 0, n: 0 };
    acc.x += point.x; acc.n++;
    somme.set(colonna, acc);
  }
  const asseDi = (corsa: T[]): number | undefined => {
    const conta = new Map<number, number>();
    for (const point of corsa) {
      const colonna = (point as { columnIndex?: number }).columnIndex;
      if (colonna !== undefined) conta.set(colonna, (conta.get(colonna) ?? 0) + 1);
    }
    let meglio: number | undefined, quanti = 0;
    for (const [colonna, n] of conta) if (n > quanti) { meglio = colonna; quanti = n; }
    const acc = meglio === undefined ? undefined : somme.get(meglio);
    return acc ? acc.x / acc.n : undefined;
  };
  const out: T[] = [];
  /** I capi delle righe già messe: testa e fondo di ogni verticale. */
  const capiRiga = new WeakSet<object>();
  let index = 0;
  while (index < points.length) {
    if (!dentro(points[index])) { out.push(points[index++]); continue; }
    let end = index;
    while (end < points.length && dentro(points[end])) end++;
    const modello = points[index];
    const hole = holes.find((h) => pointInPolygon(modello, h))!;
    // I DUE PUNTI DI CONTATTO con la linea del vuoto (Lorenzo, 2026-10-01: «nel punto di contatto con la
    // linea dell'area vuota inizi subito l'imbastitura»): dove il filo attraversa davvero la linea, non
    // l'ultimo punto fuori — che può stare un punto intero più in là, e la retta partiva storta da lì.
    const prima = out[out.length - 1];
    const dopo = points[end];
    const entrata = prima ? contattoSulBordo(prima, points[index], hole, "primo") ?? points[index] : points[index];
    const uscita = dopo ? contattoSulBordo(points[end - 1], dopo, hole, "ultimo") ?? points[end - 1] : points[end - 1];
    const corsa = points.slice(index, end);
    const tratto = sfoltisci(impunturaNelVuoto(entrata, uscita, corsa, hole, stitchMm, asseDi(corsa)), minStitchMm);
    // IL PUNTO MINIMO non deve mangiare il punto sulla linea: la pulizia che viene dopo toglierebbe quello,
    // e il filo scavalcherebbe il bordo senza toccarlo (125 volte sul davanti LASER-AI). Si toglie invece
    // l'ultimo punto del pattern prima della linea, e il primo dopo.
    // ...ma i capi di una riga già messa (role "boundary") non si tolgono mai: quando il filo, finita una
    // riga, ritocca subito la linea, si toglie il primo punto del tratto nuovo, non il capo della riga.
    // Fra due punti fissi troppo vicini vince il CAPO DI UNA RIGA (testa o fondo della verticale): la
    // pulizia che viene dopo toglierebbe il secondo dei due, e se è la testa la riga parte storta.
    const fisso = (p: Point) => capiRiga.has(p) || (p as { role?: string }).role === "boundary";
    while (tratto.length > 1 && out.length > 0 && distance(out[out.length - 1], tratto[0].p) < minStitchMm) {
      const ultimoMesso = out[out.length - 1];
      if (out.length > 1 && !fisso(ultimoMesso)) out.pop();
      else if (!tratto[0].fisso) tratto.shift();
      else if (out.length > 1 && !capiRiga.has(ultimoMesso)) out.pop();
      else if (!tratto[0].capo || distance(ultimoMesso, tratto[0].p) < 0.05) tratto.shift();
      else break;
    }
    for (const t of tratto) {
      // i capi delle righe sono "structural": la pulizia del bordo (`cleanupBoundaryConnectedPath`) toglie i
      // punti "boundary" a meno del punto minimo dal precedente, e lì toglieva proprio la testa della riga
      const punto: T = { ...modello, x: t.p.x, y: t.p.y, role: t.capo ? "structural" : t.fisso ? "boundary" : "subdivision" };
      if (t.capo) capiRiga.add(punto);
      out.push(punto);
    }
    const ultimo = tratto[tratto.length - 1].p;
    let dopoIlVuoto = end;
    while (dopoIlVuoto < points.length - 1 && !dentro(points[dopoIlVuoto]) && distance(points[dopoIlVuoto], ultimo) < minStitchMm) dopoIlVuoto++;
    index = dopoIlVuoto;
  }
  return out;
}

/**
 * La strada dell'impuntura dentro un vuoto, da `entrata` a `uscita` (esclusi): punti intermedi al passo.
 *
 * «Tutto ordinato: la linea dell'imbastitura sia perpendicolare precisa fino all'altra parte» (Lorenzo,
 * 2026-10-01). Le colonne del pattern sono verticali: dall'entrata si scende (o si sale) DRITTI fino alla
 * linea dall'altra parte, e da lì si cammina SULLA linea fino a dove il pattern riprende. Così tutte le
 * impunture sono parallele e partono e arrivano sul bordo, invece di essere corde storte da un punto
 * qualunque della colonna all'altro.
 *
 * Due casi in cui la verticale non è la strada giusta:
 * - il filo entra ed esce dalla STESSA parte (sfiora il vuoto vicino a una punta): la verticale
 *   attraverserebbe tutto il vuoto per niente → si va dritti da entrata a uscita;
 * - il vuoto è CONCAVO (a C, a L) e la verticale esce dall'area → si segue la strada che faceva il filo,
 *   ricampionata allo stesso passo.
 */
/** Un punto della strada nel vuoto: `fisso` non si toglie per il punto minimo; `capo` = testa o fondo di una riga. */
type Tappa = { p: Point; fisso: boolean; capo?: boolean };

function impunturaNelVuoto(
  entrata: Point, uscita: Point, corsa: Point[], hole: Point[], stitchMm: number, asse?: number,
): Tappa[] {
  const verso = Math.sign(uscita.y - entrata.y) || Math.sign((corsa.at(-1)?.y ?? entrata.y) - entrata.y) || 1;
  // la testa della riga: dove l'asse della colonna incontra la linea, dalla parte dell'entrata
  const testa = (asse !== undefined ? puntoSulBordoAllaX(hole, asse, entrata) : undefined) ?? entrata;
  const fondo = verticaleFinoAlBordo(testa, verso, hole);
  const resta = (a: Point, b: Point) => campionaRetta(a, b, Math.max(0.5, stitchMm / 2)).every((p) => pointInPolygon(p, hole));
  const libero = (p: Point): Tappa => ({ p, fisso: false });
  if (fondo && Math.abs(uscita.y - entrata.y) >= 0.5 * Math.abs(fondo.y - testa.y) && resta(testa, fondo)) {
    // entrata e uscita sono sulla linea ma si possono togliere; testa e fondo no: sono i capi della riga
    const inizio = lungoIlBordo(hole, entrata, testa);
    const fine = lungoIlBordo(hole, fondo, uscita);
    return [
      libero(entrata),
      ...(inizio.length > 1 ? ripercorriLaLinea(inizio, stitchMm) : []),
      { p: testa, fisso: true, capo: true },
      ...campionaRetta(testa, fondo, stitchMm).map(libero),
      { p: fondo, fisso: true, capo: true },
      ...(fine.length > 1 ? ripercorriLaLinea(fine, stitchMm) : []),
      libero(uscita),
    ];
  }
  // la colonna SFIORA il vuoto (entra ed esce dalla stessa parte, di solito vicino a un angolo o a una
  // punta): si resta SULLA linea, invece di tagliare l'angolo con una corda storta dentro il vuoto
  const sullaLinea = lungoIlBordo(hole, entrata, uscita);
  const lunghezza = (way: Point[]) => way.reduce((t, p, i) => (i ? t + distance(way[i - 1], p) : 0), 0);
  if (sullaLinea.length > 1 && lunghezza(sullaLinea) <= 3 * distance(entrata, uscita) + stitchMm) {
    // sulla linea gli spigoli contano più dei punti d'entrata e d'uscita: se il punto minimo deve
    // togliere qualcosa, toglie quelli, e il filo gira l'angolo invece di tagliarlo
    return [libero(entrata), ...ripercorriLaLinea(sullaLinea, stitchMm), libero(uscita)];
  }
  const dentro = resta(entrata, uscita) ? campionaRetta(entrata, uscita, stitchMm) : ricampionaPunti([entrata, ...corsa, uscita], stitchMm);
  return [{ p: entrata, fisso: true }, ...dentro.map(libero), { p: uscita, fisso: true }];
}

/**
 * Toglie dalla strada i punti più vicini del punto minimo, MAI quelli fissi (i capi della riga). Così il
 * punto minimo vale anche dentro il vuoto senza spostare l'impuntura dalla linea.
 */
function sfoltisci(tappe: Tappa[], minStitchMm: number): Tappa[] {
  if (!(minStitchMm > 0)) return tappe;
  const vicini = (a: Tappa, b: Tappa) => distance(a.p, b.p) < minStitchMm;
  let out = tappe.filter((t, i) => i === 0 || distance(t.p, tappe[i - 1].p) > 1e-6);
  let cambiato = true;
  while (cambiato && out.length > 2) {
    cambiato = false;
    for (let i = 0; i + 1 < out.length; i++) {
      if (!vicini(out[i], out[i + 1])) continue;
      const via = !out[i].fisso ? i : !out[i + 1].fisso ? i + 1 : -1;
      if (via < 0) continue;
      out = out.filter((_, k) => k !== via);
      cambiato = true;
      break;
    }
  }
  return out;
}

/** Dove la verticale x = `x` taglia la linea dell'anello, il punto più vicino a `vicino`. */
function puntoSulBordoAllaX(ring: Point[], x: number, vicino: Point): Point | undefined {
  let best: Point | undefined, dist = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
    const y = a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
    const d = Math.hypot(x - vicino.x, y - vicino.y);
    if (d < dist) { dist = d; best = { x, y }; }
  }
  return best;
}

/** Il punto dove il segmento a→b attraversa il bordo dell'anello: il primo o l'ultimo lungo il segmento. */
function contattoSulBordo(a: Point, b: Point, ring: Point[], quale: "primo" | "ultimo"): Point | undefined {
  let best: number | undefined;
  for (let i = 0; i < ring.length - 1; i++) {
    const t = segmentIntersectionT(a, b, ring[i], ring[i + 1]);
    if (t === undefined) continue;
    if (best === undefined || (quale === "primo" ? t < best : t > best)) best = t;
  }
  return best === undefined ? undefined : pointOnSegment(a, b, best);
}

/** Da `p` sul bordo, dritti in verticale (verso +1 = in giù) fino al bordo dall'altra parte. */
function verticaleFinoAlBordo(p: Point, verso: number, ring: Point[]): Point | undefined {
  let best: number | undefined;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if ((a.x - p.x) * (b.x - p.x) > 0 || a.x === b.x) continue;
    const y = a.y + ((p.x - a.x) * (b.y - a.y)) / (b.x - a.x);
    const d = (y - p.y) * verso;
    if (d > 0.05 && (best === undefined || d < best)) best = d;
  }
  return best === undefined ? undefined : { x: p.x, y: p.y + best * verso };
}

/** La strada più corta SULLA linea dell'anello da `da` ad `a` (tutti e due sul bordo), coi vertici in mezzo. */
function lungoIlBordo(ring: Point[], da: Point, a: Point): Point[] {
  if (Math.hypot(a.x - da.x, a.y - da.y) < 0.05) return [];
  const n = ring.length - 1;
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(ring[i].x - ring[i - 1].x, ring[i].y - ring[i - 1].y));
  const L = cum[n];
  const posizione = (p: Point) => {
    let best = { s: 0, d: Infinity, lato: 0 };
    for (let i = 0; i < n; i++) {
      const c = closestPointOnSegment(p, ring[i], ring[i + 1]);
      if (c.distance < best.d) best = { s: cum[i] + c.t * (cum[i + 1] - cum[i]), d: c.distance, lato: i };
    }
    return best;
  };
  const p0 = posizione(da), p1 = posizione(a);
  const avanti = ((p1.s - p0.s) % L + L) % L;
  const out: Point[] = [da];
  if (avanti <= L - avanti) {
    for (let k = 1, i = p0.lato; k <= n && i !== p1.lato; k++) { i = (i + 1) % n; out.push(ring[i]); }
  } else {
    for (let k = 1, i = p0.lato; k <= n && i !== p1.lato; k++) { out.push(ring[i]); i = (i - 1 + n) % n; }
  }
  out.push(a);
  return out;
}

/**
 * I punti intermedi di una strada SULLA linea del vuoto: ogni vertice resta (gli spigoli non si tagliano)
 * e i lati lunghi si dividono al passo. I vertici fitti di una curva li dirada poi il punto minimo.
 */
function ripercorriLaLinea(way: Point[], stitchMm: number): Tappa[] {
  const out: Tappa[] = [];
  for (let i = 1; i < way.length; i++) {
    for (const p of campionaRetta(way[i - 1], way[i], stitchMm)) out.push({ p, fisso: false });
    if (i < way.length - 1) out.push({ p: way[i], fisso: svolta(way[i - 1], way[i], way[i + 1]) > SPIGOLO_DELLA_LINEA });
  }
  return out;
}

/** Oltre questa svolta un vertice della linea è uno SPIGOLO, e non si toglie (gradi). */
const SPIGOLO_DELLA_LINEA = 30;

function svolta(a: Point, b: Point, c: Point): number {
  const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

/** I punti intermedi della retta a→b, divisa in parti uguali vicine al passo. */
function campionaRetta(a: Point, b: Point, stitchMm: number): Point[] {
  const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / stitchMm));
  const out: Point[] = [];
  for (let k = 1; k < steps; k++) out.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  return out;
}

/** I punti intermedi di una strada, ripercorsa a passo uguale; l'ultimo vertice resta fuori (lo mette chi chiama). */
function ricampionaPunti(way: Point[], stitchMm: number): Point[] {
  const cum = [0];
  for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const steps = Math.max(1, Math.round(total / stitchMm));
  const out: Point[] = [];
  let seg = 1;
  for (let k = 1; k < steps; k++) {
    const s = (total * k) / steps;
    while (seg < way.length - 1 && cum[seg] < s) seg++;
    const t = (s - cum[seg - 1]) / ((cum[seg] - cum[seg - 1]) || 1);
    out.push({ x: way[seg - 1].x + (way[seg].x - way[seg - 1].x) * t, y: way[seg - 1].y + (way[seg].y - way[seg - 1].y) * t });
  }
  return out;
}

/** Il solo perimetro. Resta per chi deve camminare SUL bordo esterno (i raccordi al confine). */
function importedBoundaryPolygon(options: BoundaryOptions): Point[] {
  const { outer, holes } = importedBoundaryParts(options);
  return outer.length || holes.length ? perimetroImportato(outer, options) : [];
}

/**
 * Dentro il perimetro E fuori da ogni buco. È la definizione di "area ricamabile" (R5).
 *
 * SENZA perimetro (solo aree vuote dichiarate, Lorenzo 2026-10-01: «fai valere l'area vuota anche da
 * sola») la prima metà della domanda cade: ricamabile = fuori da ogni buco, e il resto del pattern
 * resta com'è.
 */
function insideImported(point: Point, options: BoundaryOptions, tolerance: number): boolean {
  const { outer: importato, holes } = importedBoundaryParts(options);
  if (!importato.length && !holes.length) return true;
  const outer = perimetroImportato(importato, options);
  const onOuter = pointInPolygon(point, outer)
    || nearestPointOnPolygonBoundary(point, outer).distance <= tolerance;
  if (!onOuter) return false;
  for (const hole of holes) {
    // Il bordo del buco è ricamabile (ci si appoggia), l'interno no.
    if (pointInPolygon(point, hole) && nearestPointOnPolygonBoundary(point, hole).distance > tolerance) return false;
  }
  return true;
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
  const { outer: importato, holes } = importedBoundaryParts(options);
  if (importato.length < 3 && !holes.length) return [0, 1];
  const outer = perimetroImportato(importato, options);
  // I punti di taglio arrivano dal perimetro E dal bordo di ogni buco: senza gli incroci coi
  // buchi un segmento che li attraversa resterebbe intero, e il vuoto verrebbe ricamato.
  const values = [0, 1];
  for (const polygon of [outer, ...holes]) {
    for (let index = 0; index < polygon.length - 1; index++) {
      const t = segmentIntersectionT(a, b, polygon[index], polygon[index + 1]);
      if (t !== undefined) values.push(t);
    }
  }
  const sorted = [...new Set(values.map((value) => Number(value.toFixed(8))))].sort((left, right) => left - right);
  // "Ricamabile" = dentro il perimetro e fuori da ogni buco. Si giudica sul PUNTO DI MEZZO di
  // ogni tratto, che è il criterio che non dipende da come cadono i vertici.
  const drawable = (point: Point) => pointInPolygon(point, outer)
    && !holes.some((hole) => pointInPolygon(point, hole));
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index < sorted.length - 1; index++) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end - start <= EPSILON) continue;
    if (drawable(pointOnSegment(a, b, (start + end) / 2))) intervals.push([start, end]);
  }
  if (drawable(a)) intervals.unshift([0, sorted[1] ?? 1]);
  if (drawable(b)) intervals.push([sorted.at(-2) ?? 0, 1]);
  const unique = intervals
    .map(([start, end]) => [Math.max(0, start), Math.min(1, end)] as [number, number])
    .filter(([start, end]) => end - start > EPSILON)
    .sort((left, right) => (right[1] - right[0]) - (left[1] - left[0]));
  return unique[0];
}

function pointOnSegment(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

import type { BoundaryPath, ImportedBoundary, Point } from "../grammar/types.ts";

export type BoundaryChoice = {
  id: string;
  label: string;
  color?: string;
  layer?: string;
  pathCount: number;
  bounds: ImportedBoundary["bounds"];
  boundary: ImportedBoundary;
};

export type ImportedBoundaryModel = {
  sourceFileName: string;
  sourceType: "svg" | "dxf";
  choices: BoundaryChoice[];
  source?: {
    rawWidth?: string;
    rawHeight?: string;
    rawViewBox?: number[];
    effectiveScaleMode?: ImportScaleMode;
    widthMm?: number;
    heightMm?: number;
    scaleX?: number;
    scaleY?: number;
    finalBoundsMm?: ImportedBoundary["bounds"];
    warnings?: string[];
  };
  warning?: string;
};

type SvgLength = { raw: string; amount: number; unit: string };
type SvgElement = BoundaryPath & { stroke?: string; fill?: string };
export type ImportScaleMode = "auto" | "explicit-units" | "illustrator-72dpi" | "viewbox-mm" | "custom-size";
export type ImportBoundaryOptions = {
  scaleMode?: ImportScaleMode;
  customWidthMm?: number;
  customHeightMm?: number;
};

const namedColors: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  magenta: "#ff00ff",
  cyan: "#00ffff",
  yellow: "#ffff00"
};

const dxfAciColors: Record<number, string> = {
  1: "#ff0000",
  2: "#ffff00",
  3: "#00ff00",
  4: "#00ffff",
  5: "#0000ff",
  6: "#ff00ff",
  7: "#ffffff",
  8: "#414141",
  9: "#808080"
};

export function parseImportedBoundarySource(text: string, fileName: string, options: ImportBoundaryOptions = {}): ImportedBoundaryModel {
  return /\.dxf$/i.test(fileName)
    ? parseDxfBoundary(text, fileName)
    : parseSvgBoundary(text, fileName, options);
}

export function selectBoundaryChoice(model: ImportedBoundaryModel, choiceId?: string): ImportedBoundary | undefined {
  return (choiceId ? model.choices.find((choice) => choice.id === choiceId) : model.choices[0])?.boundary;
}

function parseSvgBoundary(text: string, fileName: string, options: ImportBoundaryOptions): ImportedBoundaryModel {
  const sourceType = "svg" as const;
  const viewBox = parseNumberList(attribute(text, "viewBox"));
  const rawWidth = parseSvgLength(attribute(text, "width"));
  const rawHeight = parseSvgLength(attribute(text, "height"));
  const modelSpace = resolveSvgModelSpace(viewBox, rawWidth, rawHeight, options);
  const cssStyles = parseSvgCssStyles(text);
  const elements = extractSvgElements(text, cssStyles).map((element) => ({
    ...element,
    points: transformSvgPointsToModelSpace(element.points, modelSpace)
  }));
  const choices = buildChoices(fileName, sourceType, elements);
  const finalBoundsMm = boundsOf(elements.flatMap((element) => element.points));
  const warnings = svgImportWarnings(modelSpace, finalBoundsMm);
  return {
    sourceFileName: fileName,
    sourceType,
    choices,
    source: {
      rawWidth: rawWidth?.raw,
      rawHeight: rawHeight?.raw,
      rawViewBox: viewBox.length === 4 ? viewBox : undefined,
      effectiveScaleMode: modelSpace.effectiveScaleMode,
      widthMm: modelSpace.widthMm,
      heightMm: modelSpace.heightMm,
      scaleX: modelSpace.scaleX,
      scaleY: modelSpace.scaleY,
      finalBoundsMm,
      warnings
    },
    warning: elements.length
      ? warnings.length ? warnings.join(" ") : undefined
      : "Nessun contorno SVG utilizzabile rilevato."
  };
}

function parseDxfBoundary(text: string, fileName: string): ImportedBoundaryModel {
  const sourceType = "dxf" as const;
  const pairs = dxfPairs(text);
  const elements: SvgElement[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index];
    if (pair.code !== "0") continue;
    const type = pair.value.toUpperCase();
    if (type === "LINE") {
      const entity = readEntity(pairs, index + 1);
      const start = { x: numberCode(entity, "10"), y: numberCode(entity, "20") };
      const end = { x: numberCode(entity, "11"), y: numberCode(entity, "21") };
      elements.push({
        id: `dxf-line-${elements.length}`,
        points: [start, end],
        closed: false,
        layer: stringCode(entity, "8") || "0",
        color: dxfColor(entity)
      });
    }
    if (type === "LWPOLYLINE") {
      const entity = readEntity(pairs, index + 1);
      const xs = entity.filter((item) => item.code === "10").map((item) => Number(item.value));
      const ys = entity.filter((item) => item.code === "20").map((item) => Number(item.value));
      const points = xs.slice(0, Math.min(xs.length, ys.length)).map((x, pointIndex) => ({ x, y: ys[pointIndex] }));
      const closed = (Number(stringCode(entity, "70") || 0) & 1) === 1 || looksClosed(points);
      elements.push({
        id: `dxf-lwpolyline-${elements.length}`,
        points: closed ? closePolygon(points) : points,
        closed,
        layer: stringCode(entity, "8") || "0",
        color: dxfColor(entity)
      });
    }
    if (type === "POLYLINE") {
      const layer = stringCode(readEntity(pairs, index + 1), "8") || "0";
      const points: Point[] = [];
      let cursor = index + 1;
      while (cursor < pairs.length) {
        if (pairs[cursor].code === "0" && pairs[cursor].value.toUpperCase() === "VERTEX") {
          const vertex = readEntity(pairs, cursor + 1);
          points.push({ x: numberCode(vertex, "10"), y: numberCode(vertex, "20") });
        }
        if (pairs[cursor].code === "0" && pairs[cursor].value.toUpperCase() === "SEQEND") break;
        cursor++;
      }
      if (points.length) {
        elements.push({
          id: `dxf-polyline-${elements.length}`,
          points: looksClosed(points) ? closePolygon(points) : points,
          closed: looksClosed(points),
          layer,
          color: "#000000"
        });
      }
    }
  }
  return {
    sourceFileName: fileName,
    sourceType,
    choices: buildChoices(fileName, sourceType, elements),
    warning: elements.length ? undefined : "DXF importato, ma non sono state trovate entita LINE/POLYLINE utilizzabili."
  };
}

function buildChoices(sourceFileName: string, sourceType: "svg" | "dxf", elements: SvgElement[]): BoundaryChoice[] {
  const groups = new Map<string, SvgElement[]>();
  for (const element of elements) {
    if (element.points.length < 2) continue;
    const key = sourceType === "svg"
      ? `color:${element.color || "unknown"}`
      : `layer:${element.layer || "0"}|color:${element.color || "unknown"}`;
    groups.set(key, [...(groups.get(key) ?? []), element]);
  }
  return [...groups.entries()].map(([key, group], index) => {
    const color = group.find((item) => item.color)?.color;
    const layer = group.find((item) => item.layer)?.layer;
    const paths = group.map((item, pathIndex): BoundaryPath => ({
      id: item.id || `${key}-${pathIndex}`,
      points: item.closed ? closePolygon(item.points) : item.points,
      closed: item.closed,
      color: item.color,
      layer: item.layer
    }));
    const closed = paths.filter((path) => path.closed && path.points.length >= 3);
    const selectedPaths = closed.length ? closed : paths;
    const bounds = boundsOf(selectedPaths.flatMap((path) => path.points));
    const id = `${sourceType}-${index}-${slug(key)}`;
    const boundary: ImportedBoundary = {
      id,
      sourceFileName,
      sourceType,
      color,
      layer,
      paths: selectedPaths,
      bounds
    };
    return {
      id,
      label: [layer ? `Layer ${layer}` : "", color ? `Colore ${color}` : ""].filter(Boolean).join(" / ") || key,
      color,
      layer,
      pathCount: selectedPaths.length,
      bounds,
      boundary
    };
  }).sort((a, b) => areaOfBounds(b.bounds) - areaOfBounds(a.bounds));
}

function extractSvgElements(text: string, cssStyles: Record<string, Record<string, string>>): SvgElement[] {
  const elements: SvgElement[] = [];
  const elementRegex = /<(path|polyline|polygon|rect)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = elementRegex.exec(text))) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const points = svgElementPoints(tag, attrs);
    if (points.length < 2) continue;
    const stroke = paint(attrs, cssStyles, "stroke");
    const fill = paint(attrs, cssStyles, "fill");
    const color = normalizeColor(isPaintActive(stroke) ? stroke : fill);
    elements.push({
      id: attrs.id || `svg-${tag}-${elements.length}`,
      points,
      closed: tag === "polygon" || tag === "rect" || pathLooksClosed(attrs.d, points),
      color,
      stroke,
      fill
    });
  }
  return elements;
}

function svgElementPoints(tag: string, attrs: Record<string, string>): Point[] {
  if (tag === "polygon" || tag === "polyline") return parsePointList(attrs.points || "");
  if (tag === "path") return parsePathPoints(attrs.d || "");
  if (tag === "rect") {
    const x = parseSvgCoordinate(attrs.x);
    const y = parseSvgCoordinate(attrs.y);
    const width = parseSvgCoordinate(attrs.width);
    const height = parseSvgCoordinate(attrs.height);
    return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }];
  }
  return [];
}

function resolveSvgModelSpace(
  viewBox: number[],
  rawWidth: SvgLength | null,
  rawHeight: SvgLength | null,
  options: ImportBoundaryOptions
) {
  const physicalWidth = rawWidth ? svgLengthPhysicalMm(rawWidth) : null;
  const physicalHeight = rawHeight ? svgLengthPhysicalMm(rawHeight) : null;
  const hasPhysicalSize = physicalWidth != null && physicalHeight != null;
  const selectedMode = options.scaleMode ?? "auto";
  const effectiveScaleMode: ImportScaleMode = selectedMode === "auto"
    ? hasPhysicalSize ? "explicit-units" : viewBox.length === 4 ? "viewbox-mm" : "custom-size"
    : selectedMode;
  if (viewBox.length === 4) {
    const size = resolveSvgModelSizeMm(effectiveScaleMode, viewBox[2], viewBox[3], physicalWidth, physicalHeight, options);
    return {
      viewBox,
      effectiveScaleMode,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      scaleX: size.widthMm / Math.max(0.0001, viewBox[2]),
      scaleY: size.heightMm / Math.max(0.0001, viewBox[3])
    };
  }
  const widthMm = physicalWidth ?? Math.max(0.001, options.customWidthMm ?? 1);
  const heightMm = physicalHeight ?? Math.max(0.001, options.customHeightMm ?? 1);
  return { viewBox: [0, 0, widthMm, heightMm], effectiveScaleMode, widthMm, heightMm, scaleX: 1, scaleY: 1 };
}

function resolveSvgModelSizeMm(
  mode: ImportScaleMode,
  viewBoxWidth: number,
  viewBoxHeight: number,
  physicalWidth: number | null,
  physicalHeight: number | null,
  options: ImportBoundaryOptions
) {
  if (mode === "auto" && physicalWidth != null && physicalHeight != null) {
    return { widthMm: physicalWidth, heightMm: physicalHeight };
  }
  if (mode === "explicit-units") {
    return {
      widthMm: physicalWidth ?? viewBoxWidth,
      heightMm: physicalHeight ?? viewBoxHeight
    };
  }
  if (mode === "custom-size") {
    return {
      widthMm: Math.max(0.001, options.customWidthMm ?? physicalWidth ?? viewBoxWidth),
      heightMm: Math.max(0.001, options.customHeightMm ?? physicalHeight ?? viewBoxHeight)
    };
  }
  if (mode === "viewbox-mm") return { widthMm: viewBoxWidth, heightMm: viewBoxHeight };
  if (mode === "illustrator-72dpi") return { widthMm: viewBoxWidth * 25.4 / 72, heightMm: viewBoxHeight * 25.4 / 72 };
  return { widthMm: physicalWidth ?? viewBoxWidth * 25.4 / 72, heightMm: physicalHeight ?? viewBoxHeight * 25.4 / 72 };
}

function transformSvgPointsToModelSpace(points: Point[], modelSpace: { viewBox: number[]; scaleX: number; scaleY: number }): Point[] {
  const [minX, minY] = modelSpace.viewBox;
  return points.map((point) => ({
    x: (point.x - minX) * modelSpace.scaleX,
    y: (point.y - minY) * modelSpace.scaleY
  }));
}

function svgImportWarnings(
  modelSpace: { widthMm: number; heightMm: number; scaleX: number; scaleY: number; effectiveScaleMode: ImportScaleMode },
  finalBoundsMm: ImportedBoundary["bounds"]
): string[] {
  const warnings: string[] = [];
  const boundsWidth = finalBoundsMm.maxX - finalBoundsMm.minX;
  const boundsHeight = finalBoundsMm.maxY - finalBoundsMm.minY;
  const aspectPhysical = modelSpace.widthMm / Math.max(0.0001, modelSpace.heightMm);
  const aspectBounds = boundsWidth / Math.max(0.0001, boundsHeight);
  if (Math.abs(aspectPhysical - aspectBounds) > 0.05) {
    warnings.push("Attenzione: proporzioni bounds/import diverse dalla dimensione fisica SVG; potrebbero esserci margini, stroke o elementi fuori area.");
  }
  if (modelSpace.effectiveScaleMode === "viewbox-mm") {
    warnings.push("Import SVG senza dimensioni fisiche esplicite: Auto usa ViewBox = mm. Cambia scala import se il file usa px/pt.");
  }
  return warnings;
}

function parsePathPoints(d: string): Point[] {
  const tokens = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const points: Point[] = [];
  let index = 0;
  let command = "";
  let current = { x: 0, y: 0 };
  let start: Point | undefined;
  const number = () => Number(tokens[index++]);
  const hasNumber = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  const push = (point: Point) => {
    current = point;
    points.push(point);
    start ??= point;
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    const relative = command === command.toLowerCase();
    const op = command.toUpperCase();
    if (op === "M" || op === "L") {
      while (hasNumber()) {
        const point = { x: number(), y: number() };
        push(relative ? add(current, point) : point);
        if (op === "M") command = relative ? "l" : "L";
      }
    } else if (op === "H") {
      while (hasNumber()) {
        const x = number();
        push({ x: relative ? current.x + x : x, y: current.y });
      }
    } else if (op === "V") {
      while (hasNumber()) {
        const y = number();
        push({ x: current.x, y: relative ? current.y + y : y });
      }
    } else if (op === "C") {
      while (hasNumber()) {
        const c1 = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        const c2 = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        const end = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        sampleCubic(current, c1, c2, end).forEach(push);
      }
    } else if (op === "Q") {
      while (hasNumber()) {
        const c = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        const end = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        sampleQuadratic(current, c, end).forEach(push);
      }
    } else if (op === "A") {
      while (hasNumber()) {
        index += 5;
        const end = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        push(end);
      }
    } else if (op === "Z") {
      if (start) push(start);
      command = "";
    } else {
      break;
    }
  }
  return points;
}

function parseSvgCssStyles(text: string): Record<string, Record<string, string>> {
  const styles: Record<string, Record<string, string>> = {};
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRegex.exec(text))) {
    const ruleRegex = /\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(styleMatch[1]))) styles[ruleMatch[1]] = parseStyleDeclaration(ruleMatch[2]);
  }
  return styles;
}

function paint(attrs: Record<string, string>, cssStyles: Record<string, Record<string, string>>, paintName: string): string {
  const inline = parseStyleDeclaration(attrs.style);
  const classStyles: Record<string, string> = {};
  String(attrs.class || "").split(/\s+/).filter(Boolean).forEach((className) => Object.assign(classStyles, cssStyles[className] || {}));
  return normalizeColor(attrs[paintName] || inline[paintName] || classStyles[paintName] || "unknown");
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([:\w-]+)\s*=\s*(['"])(.*?)\2/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) attrs[match[1]] = match[3];
  return attrs;
}

function attribute(text: string, name: string): string {
  const root = text.match(/<svg\b([^>]*)>/i)?.[1] || "";
  return parseAttributes(root)[name] || "";
}

function parseStyleDeclaration(value = ""): Record<string, string> {
  const result: Record<string, string> = {};
  String(value).split(";").forEach((part) => {
    const [key, raw] = part.split(":");
    if (key && raw != null) result[key.trim().toLowerCase()] = raw.trim();
  });
  return result;
}

function parseSvgLength(value?: string): SvgLength | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-z%]*)$/i);
  if (!match) return null;
  return { raw: String(value).trim(), amount: Number(match[1]), unit: match[2].toLowerCase() || "unitless" };
}

function svgLengthPhysicalMm(length: SvgLength): number | null {
  if (length.unit === "mm") return length.amount;
  if (length.unit === "cm") return length.amount * 10;
  if (length.unit === "in") return length.amount * 25.4;
  if (length.unit === "pt") return length.amount * 25.4 / 72;
  if (length.unit === "pc") return length.amount * 25.4 / 6;
  if (length.unit === "px") return length.amount * 25.4 / 96;
  return null;
}

function parseSvgCoordinate(value?: string): number {
  return parseSvgLength(value)?.amount ?? 0;
}

function normalizeColor(value?: string): string {
  if (!value) return "unknown";
  const color = value.trim().toLowerCase();
  if (color === "none" || color === "transparent") return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  const rgb = color.match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/i);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((item) => clamp(Number(item), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  return namedColors[color] || color;
}

function isPaintActive(value?: string): boolean {
  return Boolean(value && value !== "none" && value !== "transparent" && value !== "unknown");
}

function dxfPairs(text: string): Array<{ code: string; value: string }> {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: Array<{ code: string; value: string }> = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    pairs.push({ code: lines[index].trim(), value: lines[index + 1].trim() });
  }
  return pairs;
}

function readEntity(pairs: Array<{ code: string; value: string }>, start: number) {
  const entity: Array<{ code: string; value: string }> = [];
  for (let index = start; index < pairs.length; index++) {
    if (pairs[index].code === "0") break;
    entity.push(pairs[index]);
  }
  return entity;
}

function stringCode(entity: Array<{ code: string; value: string }>, code: string): string {
  return entity.find((item) => item.code === code)?.value || "";
}

function numberCode(entity: Array<{ code: string; value: string }>, code: string): number {
  return Number(stringCode(entity, code) || 0);
}

function dxfColor(entity: Array<{ code: string; value: string }>): string {
  const trueColor = Number(stringCode(entity, "420") || 0);
  if (trueColor) return `#${trueColor.toString(16).padStart(6, "0").slice(-6)}`;
  const aci = Number(stringCode(entity, "62") || 0);
  return dxfAciColors[Math.abs(aci)] || "#000000";
}

function parsePointList(value: string): Point[] {
  const numbers = parseNumberList(value);
  const points: Point[] = [];
  for (let index = 0; index < numbers.length - 1; index += 2) points.push({ x: numbers[index], y: numbers[index + 1] });
  return points;
}

function parseNumberList(value?: string): number[] {
  return (value || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
}

function pathLooksClosed(d = "", points: Point[]): boolean {
  return /z\s*$/i.test(d.trim()) || looksClosed(points);
}

function looksClosed(points: Point[]): boolean {
  return points.length > 2 && distance(points[0], points.at(-1)!) < 0.001;
}

function closePolygon(points: Point[]): Point[] {
  if (!points.length) return [];
  return looksClosed(points) ? points.slice() : [...points, { ...points[0] }];
}

function boundsOf(points: Point[]): ImportedBoundary["bounds"] {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function areaOfBounds(bounds: ImportedBoundary["bounds"]): number {
  return Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  return Array.from({ length: 12 }, (_, index) => {
    const t = (index + 1) / 12;
    const mt = 1 - t;
    return {
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
    };
  });
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point): Point[] {
  return Array.from({ length: 10 }, (_, index) => {
    const t = (index + 1) / 10;
    const mt = 1 - t;
    return { x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x, y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y };
  });
}

function areaOf(points: Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length - 1; index++) sum += points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
  return Math.abs(sum / 2);
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#-]+/g, "-").replace(/^-|-$/g, "");
}

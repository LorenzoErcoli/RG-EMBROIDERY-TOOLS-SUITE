import type { BoundaryPath, ImportedBoundary, Point } from "../grammar/types.ts";
// Chiusura, colori e lunghezze fisiche vengono dal core: sono le stesse domande
// che si pone l'importer di net-45, e devono avere le stesse risposte (R28).
import { closePolygon, isGeometricallyClosed, normalizeColor, svgPhysicalLengthToMm } from "@rg/core";

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
/**
 * Quale vernice identifica l'elemento. Un file di CONTORNI si riconosce dal tratto
 * (`stroke`, il default storico); un file di ZONE PIENE si riconosce dal riempimento
 * (`fill`) — lì il tratto è il nero del bordo, uguale per tutte, e farlo vincere
 * collasserebbe ogni zona in un colore solo.
 */
export type PaintPriority = "stroke" | "fill";
export type ImportBoundaryOptions = {
  scaleMode?: ImportScaleMode;
  customWidthMm?: number;
  customHeightMm?: number;
  paintPriority?: PaintPriority;
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

/** Un disegno letto come TRACCIATI, non come sagome: è la forma che serve a un modulo di pattern. */
export type SvgPolylinesModel = {
  polylines: Point[][];
  bounds: ImportedBoundary["bounds"];
  widthMm: number;
  heightMm: number;
  effectiveScaleMode: ImportScaleMode;
  warning?: string;
};

/**
 * Le polilinee di un SVG in mm, coi `transform` applicati e SENZA chiuderle né raggrupparle
 * per colore.
 *
 * È l'altra domanda che si fa allo stesso file: `parseImportedBoundarySource` chiede "quali
 * SAGOME contiene" (e quindi chiude gli anelli e raggruppa per tinta), questa chiede "quali
 * TRACCIATI contiene" — che è quello che serve quando l'SVG non è un cartamodello ma un
 * MODULO di ricamo da ripetere. Stessa macchina di lettura (scala, transform, curve), così
 * le due risposte non possono divergere (R28).
 */
export function parseSvgPolylines(text: string, options: ImportBoundaryOptions = {}): SvgPolylinesModel {
  const viewBox = parseNumberList(attribute(text, "viewBox"));
  const rawWidth = parseSvgLength(attribute(text, "width"));
  const rawHeight = parseSvgLength(attribute(text, "height"));
  const modelSpace = resolveSvgModelSpace(viewBox, rawWidth, rawHeight, options);
  const polylines = extractSvgElements(text, parseSvgCssStyles(text), options.paintPriority)
    .map((element) => transformSvgPointsToModelSpace(element.points, modelSpace))
    .filter((points) => points.length >= 2);
  return {
    polylines,
    bounds: boundsOf(polylines.flat()),
    widthMm: modelSpace.widthMm,
    heightMm: modelSpace.heightMm,
    effectiveScaleMode: modelSpace.effectiveScaleMode,
    warning: polylines.length ? undefined : "Nessun tracciato utilizzabile nell'SVG.",
  };
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
  const elements = extractSvgElements(text, cssStyles, options.paintPriority).map((element) => ({
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
      const closed = (Number(stringCode(entity, "70") || 0) & 1) === 1 || isGeometricallyClosed(points);
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
          points: isGeometricallyClosed(points) ? closePolygon(points) : points,
          closed: isGeometricallyClosed(points),
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

/**
 * Elementi del disegno, coi `transform` GIÀ applicati.
 *
 * Perché conta: Illustrator scrive spessissimo i rombi ruotati come
 * `<rect … transform="translate(…) rotate(-45)">`. Ignorare il transform non dà
 * errore — dà un quadrato dritto nel posto sbagliato, in silenzio. Misurato sul
 * cannage di Lorenzo: 4 zone su 37 arrivavano così.
 * Il testo si percorre in ORDINE DI DOCUMENTO tenendo una pila di matrici, così
 * valgono anche i `transform` dei `<g>` annidati (il figlio eredita il padre).
 */
function extractSvgElements(
  text: string,
  cssStyles: Record<string, Record<string, string>>,
  paintPriority: PaintPriority = "stroke"
): SvgElement[] {
  const elements: SvgElement[] = [];
  const stack: Matrix[] = [IDENTITY_MATRIX];
  const tokenRegex = /<(g|path|polyline|polygon|rect)\b([^>]*?)(\/?)>|<\/g\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text))) {
    if (match[1] === undefined) {            // </g>
      if (stack.length > 1) stack.pop();
      continue;
    }
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const matrix = multiplyMatrix(stack.at(-1)!, parseSvgTransform(attrs.transform));
    if (tag === "g") {
      if (match[3] !== "/") stack.push(matrix);
      continue;
    }
    const points = svgElementPoints(tag, attrs).map((point) => applyMatrix(matrix, point));
    if (points.length < 2) continue;
    const stroke = paint(attrs, cssStyles, "stroke");
    const fill = paint(attrs, cssStyles, "fill");
    const preferred = paintPriority === "fill" ? fill : stroke;
    const fallback = paintPriority === "fill" ? stroke : fill;
    const color = normalizeColor(isPaintActive(preferred) ? preferred : fallback);
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

/** Matrice affine SVG `[a b c d e f]`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];
const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

function multiplyMatrix(parent: Matrix, child: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = parent;
  const [a2, b2, c2, d2, e2, f2] = child;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function applyMatrix(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

/** `transform="translate(…) rotate(…)"`: le funzioni si compongono da sinistra a destra. */
export function parseSvgTransform(value?: string): Matrix {
  if (!value) return IDENTITY_MATRIX;
  let matrix = IDENTITY_MATRIX;
  const functionRegex = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = functionRegex.exec(value))) {
    matrix = multiplyMatrix(matrix, transformFunctionMatrix(match[1].toLowerCase(), parseNumberList(match[2])));
  }
  return matrix;
}

function transformFunctionMatrix(name: string, args: number[]): Matrix {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  if (name === "matrix" && args.length >= 6) return [args[0], args[1], args[2], args[3], args[4], args[5]];
  if (name === "translate") return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
  if (name === "scale") return [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
  if (name === "rotate") {
    const cos = Math.cos(rad(args[0] ?? 0));
    const sin = Math.sin(rad(args[0] ?? 0));
    const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
    if (args.length < 3) return rotation;
    // rotate(a, cx, cy) = translate(cx,cy) · rotate(a) · translate(-cx,-cy)
    return multiplyMatrix(
      multiplyMatrix([1, 0, 0, 1, args[1], args[2]], rotation),
      [1, 0, 0, 1, -args[1], -args[2]]
    );
  }
  if (name === "skewx") return [1, 0, Math.tan(rad(args[0] ?? 0)), 1, 0, 0];
  if (name === "skewy") return [1, Math.tan(rad(args[0] ?? 0)), 0, 1, 0, 0];
  return IDENTITY_MATRIX;
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
  const physicalWidth = svgPhysicalLengthToMm(rawWidth?.raw);
  const physicalHeight = svgPhysicalLengthToMm(rawHeight?.raw);
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
        const rx = number(), ry = number(), rotation = number();
        const largeArc = number(), sweep = number();
        const end = relative ? add(current, { x: number(), y: number() }) : { x: number(), y: number() };
        sampleArc(current, rx, ry, rotation, largeArc, sweep, end).forEach(push);
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
    // Un selettore può valere per PIÙ classi (`.cls-1, .cls-2 { stroke:#000 }`, come le
    // scrive Illustrator) e le regole si SOMMANO: la seconda non cancella la prima.
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(styleMatch[1]))) {
      const declaration = parseStyleDeclaration(ruleMatch[2]);
      for (const selector of ruleMatch[1].split(",")) {
        const className = selector.trim().match(/^\.([A-Za-z0-9_-]+)$/)?.[1];
        if (className) styles[className] = { ...styles[className], ...declaration };
      }
    }
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


function parseSvgCoordinate(value?: string): number {
  return parseSvgLength(value)?.amount ?? 0;
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
  return /z\s*$/i.test(d.trim()) || isGeometricallyClosed(points);
}

/**
 * Ingombro dei punti, **a ciclo**. Prima era `Math.min(...xs)`: lo spread passa un argomento per
 * punto, e su un file vero di Lorenzo (il golden di oblique, 2MB, centinaia di migliaia di punti)
 * faceva esplodere lo stack — l'import falliva con "Maximum call stack size exceeded" invece di
 * aprire il file. Un ciclo non ha limiti di dimensione.
 */
function boundsOf(points: Point[]): ImportedBoundary["bounds"] {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
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

/**
 * Arco ellittico (comando `A`) campionato davvero. Prima veniva **tirato dritto** fino al punto
 * finale: su una sagoma con raccordi curvi il contorno usciva spigoloso e la misura sbagliata
 * (una semicirconferenza da 50mm di raggio spariva del tutto).
 * Conversione endpoint → centro come da specifica SVG (W3C, note di implementazione F.6.5/F.6.6).
 * *Limite noto:* i flag `large-arc`/`sweep` devono essere separati dagli altri numeri (`0 1` e non
 * `01`), come li scrivono Illustrator e Inkscape — il tokenizer del parser non li spacchetta.
 */
function sampleArc(
  p0: Point, rxInput: number, ryInput: number, rotationDeg: number,
  largeArc: number, sweep: number, p1: Point
): Point[] {
  let rx = Math.abs(rxInput), ry = Math.abs(ryInput);
  // raggio nullo o punti coincidenti: per la specifica è un segmento retto
  if (rx < 1e-9 || ry < 1e-9 || (Math.abs(p1.x - p0.x) < 1e-12 && Math.abs(p1.y - p0.y) < 1e-12)) return [p1];

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
  const x1 = cosPhi * dx + sinPhi * dy;
  const y1 = -sinPhi * dx + cosPhi * dy;

  // raggi troppo piccoli per congiungere gli estremi: si ingrandiscono quanto basta (F.6.6)
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }

  const sign = largeArc !== sweep ? 1 : -1;
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coefficient = sign * Math.sqrt(Math.max(0, numerator / (denominator || 1)));
  const cx1 = (coefficient * rx * y1) / ry;
  const cy1 = (-coefficient * ry * x1) / rx;
  const cx = cosPhi * cx1 - sinPhi * cy1 + (p0.x + p1.x) / 2;
  const cy = sinPhi * cx1 + cosPhi * cy1 + (p0.y + p1.y) / 2;

  const angleBetween = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    const a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const ux = (x1 - cx1) / rx, uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx, vy = (-y1 - cy1) / ry;
  const theta = angleBetween(1, 0, ux, uy);
  let sweepAngle = angleBetween(ux, uy, vx, vy);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  else if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;

  // campionamento proporzionale all'ampiezza: un quarto di giro ≈ 8 punti, un giro intero ≈ 32
  const samples = Math.max(4, Math.ceil((Math.abs(sweepAngle) / (Math.PI / 2)) * 8));
  return Array.from({ length: samples }, (_, index) => {
    const t = theta + sweepAngle * ((index + 1) / samples);
    const cosT = Math.cos(t), sinT = Math.sin(t);
    return {
      x: cosPhi * rx * cosT - sinPhi * ry * sinT + cx,
      y: sinPhi * rx * cosT + cosPhi * ry * sinT + cy
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


function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}



function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#-]+/g, "-").replace(/^-|-$/g, "");
}

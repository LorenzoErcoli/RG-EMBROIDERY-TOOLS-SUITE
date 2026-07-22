import type { Point } from "../grammar/types.ts";

export type SvgPolyline = {
  points?: Point[];
  subpaths?: Point[][];
  className?: string;
  dataAttributes?: Record<string, string | number | boolean | undefined>;
};
export type SvgElementType = "polyline" | "path";
export type SvgExportOptions = {
  width: number;
  height: number;
  strokeWidth: number;
  polylines: SvgPolyline[];
  elementType?: SvgElementType;
  inlineStyles?: boolean;
  metadata?: Record<string, unknown>;
};

const number = (value: number) => Number(value.toFixed(3));
const points = (value: Point[]) => value.map((point) => `${number(point.x)},${number(point.y)}`).join(" ");
const pathData = (value: Point[]) => value
  .map((point, index) => `${index === 0 ? "M" : "L"}${number(point.x)} ${number(point.y)}`)
  .join(" ");
const subpathData = (value: Point[][]) => value.map(pathData).join(" ");
const dataAttributes = (value: SvgPolyline["dataAttributes"] = {}) =>
  Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, attributeValue]) => ` data-${key}="${escapeXml(String(attributeValue))}"`)
    .join("");

export function exportSvg(options: SvgExportOptions): string {
  const metadata = options.metadata ? `\n  <metadata>${escapeXml(JSON.stringify(options.metadata))}</metadata>` : "";
  const elementType = options.elementType ?? "polyline";
  const inlineStyle = options.inlineStyles
    ? ` fill="none" stroke="#005f27" stroke-width="${number(options.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"`
    : "";
  const lines = options.polylines.map((line) => {
    const className = line.className ? ` class="${line.className}"` : "";
    const data = dataAttributes(line.dataAttributes);
    const subpaths = line.subpaths ?? (line.points ? [line.points] : []);
    return elementType === "path" || line.subpaths
      ? `  <path${className}${data}${inlineStyle} d="${subpathData(subpaths)}"/>`
      : `  <polyline${className}${data}${inlineStyle} points="${points(subpaths[0] ?? [])}"/>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${number(options.width)}mm" height="${number(options.height)}mm" viewBox="0 0 ${number(options.width)} ${number(options.height)}" preserveAspectRatio="xMidYMid meet">${metadata}
  <style>polyline,path{fill:none;stroke:#005f27;stroke-width:${number(options.strokeWidth)};stroke-linecap:round;stroke-linejoin:round}</style>
${lines}
</svg>
`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

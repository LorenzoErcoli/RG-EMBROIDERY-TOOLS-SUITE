// Export SVG in mm, riapribile via metadata. Regole R6, R9, R10, R27.
import type { ExportLayer, Bounds, SourceFrame, Point } from './types';

export interface SvgExportOptions {
  bounds: Bounds;
  marginMm?: number;
  metadata?: Record<string, unknown>;
  maxPointsPerPath?: number; // R6
}

const fmt = (n: number) => Number(n.toFixed(3));

export function buildSvg(layers: ExportLayer[], opts: SvgExportOptions): string {
  const m = opts.marginMm ?? 5;
  const { minX, minY, maxX, maxY } = opts.bounds;
  const w = maxX - minX + 2 * m;
  const h = maxY - minY + 2 * m;
  const vb = `${fmt(minX - m)} ${fmt(minY - m)} ${fmt(w)} ${fmt(h)}`;
  const cap = opts.maxPointsPerPath ?? 5000;

  const groups = layers.map((layer) => {
    const paths = layer.polylines
      .filter((pl) => pl.length >= (layer.shapeOnly ? 3 : 2))
      // R6: spezza le polilinee troppo lunghe in più path
      .flatMap((pl) => chunk(pl, cap))
      .map((pl) => {
        const d = pl.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
        const closed = layer.shapeOnly ? ' fill="none"' : '';
        return `      <polyline points="${d}"${closed} />`;
      })
      .join('\n');
    const stroke = layer.strokeMm ?? 0.3;
    return `    <g id="${layer.id}" stroke="${layer.color}" stroke-width="${stroke}" fill="none" stroke-linejoin="round" stroke-linecap="round">\n${paths}\n    </g>`;
  });

  const meta = opts.metadata
    ? `  <metadata id="rg-project">${JSON.stringify(opts.metadata)}</metadata>\n`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}mm" height="${fmt(h)}mm" viewBox="${vb}">\n${meta}${groups.join('\n')}\n</svg>\n`;
}

export interface SourceFrameExportOptions {
  frame: SourceFrame;
  /** r = realWidthMm / widthMm rilevata (o 1 se non impostata). */
  realWidthFactor?: number;
  metadata?: Record<string, unknown>;
  maxPointsPerPath?: number;
}

/**
 * Export nel FRAME DELLA SORGENTE (R27): stesse coordinate/viewBox/unità dell'SVG importato,
 * così l'output si sovrappone esattamente al cartamodello d'ingresso nel software a valle.
 * Mappa i punti (in mm scalati per realWidth) di nuovo in unità-file: `file = mm/(r·scale) + offset`.
 */
export function buildSvgInSourceFrame(layers: ExportLayer[], opts: SourceFrameExportOptions): string {
  const r = opts.realWidthFactor && opts.realWidthFactor > 0 ? opts.realWidthFactor : 1;
  const f = opts.frame;
  const cap = opts.maxPointsPerPath ?? 5000;
  const map = (p: Point): Point => ({
    x: p.x / (r * f.scaleX) + f.offsetX,
    y: p.y / (r * f.scaleY) + f.offsetY,
  });
  const groups = layers.map((layer) => {
    const strokeFile = (layer.strokeMm ?? 0.3) / (r * f.scaleX);
    const paths = layer.polylines
      .filter((pl) => pl.length >= (layer.shapeOnly ? 3 : 2))
      .flatMap((pl) => chunk(pl, cap))
      .map((pl) => {
        const d = pl.map((p) => { const q = map(p); return `${fmt(q.x)},${fmt(q.y)}`; }).join(' ');
        return `      <polyline points="${d}" />`;
      })
      .join('\n');
    return `    <g id="${layer.id}" stroke="${layer.color}" stroke-width="${fmt(strokeFile)}" fill="none" stroke-linejoin="round" stroke-linecap="round">\n${paths}\n    </g>`;
  });
  const meta = opts.metadata
    ? `  <metadata id="rg-project">${JSON.stringify(opts.metadata)}</metadata>\n`
    : '';
  const wh = f.widthAttr && f.heightAttr ? ` width="${f.widthAttr}" height="${f.heightAttr}"` : '';
  const vb = f.viewBox ? ` viewBox="${f.viewBox}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${wh}${vb}>\n${meta}${groups.join('\n')}\n</svg>\n`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length <= size) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size - 1) out.push(arr.slice(i, i + size));
  return out;
}

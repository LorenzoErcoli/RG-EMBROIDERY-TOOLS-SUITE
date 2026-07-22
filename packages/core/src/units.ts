// Unità e scala. Regole R1, R2, R11.
export const MM_PER_INCH = 25.4;
export const DPI_DEFAULT = 96;        // convenzione canonica px↔mm
export const DPI_ILLUSTRATOR = 72;    // ramo Illustrator point-based

export type ScaleMode = 'auto' | 'illustrator-72' | 'viewbox-mm' | 'custom';

export const pxToMm = (px: number, dpi = DPI_DEFAULT): number =>
  (px * MM_PER_INCH) / dpi;

export const mmToPx = (mm: number, dpi = DPI_DEFAULT): number =>
  (mm * dpi) / MM_PER_INCH;

/**
 * Converte in mm SOLO le lunghezze che dichiarano un'unità fisica reale.
 * Un numero nudo (`width="539"`) o una percentuale non dicono quanto è grande
 * l'oggetto: qui tornano `null`, così chi importa sa di dover chiedere la scala
 * invece di inventarsela (R11). Usa `svgLengthToMm` quando invece va bene
 * ripiegare sul DPI canonico.
 */
export function svgPhysicalLengthToMm(value: string | undefined | null): number | null {
  const m = /^\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(value ?? '');
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2].toLowerCase()) {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'in': return n * MM_PER_INCH;
    case 'pt': return (n * MM_PER_INCH) / 72;
    case 'pc': return (n * MM_PER_INCH) / 6;
    case 'px': return pxToMm(n, DPI_DEFAULT);
    default: return null;   // unitless o '%': dimensione fisica sconosciuta
  }
}

/** Converte una lunghezza SVG con unità (mm/cm/in/pt/pc/px) in mm. */
export function svgLengthToMm(value: string, dpi = DPI_DEFAULT): number | null {
  const m = /^\s*(-?[\d.]+)\s*(mm|cm|in|pt|pc|px)?\s*$/.exec(value);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'in': return n * MM_PER_INCH;
    case 'pt': return (n * MM_PER_INCH) / 72;
    case 'pc': return (n * MM_PER_INCH) / 6;
    case 'px':
    case undefined:
    default: return pxToMm(n, dpi);
  }
}

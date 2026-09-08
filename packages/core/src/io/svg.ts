// Import SVG → contorni in mm, con colore per ruolo. Regole R2, R11, R12.
// Usa il DOM del browser (getPointAtLength) per campionare qualsiasi path/curva in modo robusto.
import type { Contour, Point, ImportResult, SourceFrame } from '../types';
import { pxToMm, svgLengthToMm, DPI_DEFAULT, MM_PER_INCH, type ScaleMode } from '../units';
import { measureContours } from '../imports';
import { isGeometricallyClosed, normalizeColor } from './normalize';
import { applyMatrix, isIdentityMatrix, multiplyMatrix, parseSvgTransform, IDENTITY_MATRIX, type Matrix } from './transform';

export interface SvgImportOptions {
  /** DPI usato quando l'SVG NON dichiara width/height (ripiego). Default 96. */
  dpi?: number;
  /**
   * Come leggere il viewBox quando mancano width/height:
   * - `auto` (default): unità = px al DPI dato;
   * - `illustrator-72`: unità = punti PostScript (Illustrator senza misure);
   * - `viewbox-mm`: unità = millimetri (1:1).
   */
  scaleMode?: ScaleMode;
}

/** Contenitori che NON disegnano: la loro geometria è materiale di servizio, non ricamo. */
const NON_RENDERED = new Set(['defs', 'clippath', 'mask', 'symbol', 'marker', 'pattern']);

/** L'elemento è dentro un contenitore non disegnato, o è esplicitamente nascosto? */
function isHiddenGeometry(el: Element, root: Element): boolean {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    if (NON_RENDERED.has(node.tagName.toLowerCase())) return true;
    const display = node.getAttribute('display');
    if (display && display.trim().toLowerCase() === 'none') return true;
    const style = node.getAttribute('style') || '';
    if (/(^|;)\s*display\s*:\s*none/i.test(style)) return true;
    if (/(^|;)\s*visibility\s*:\s*hidden/i.test(style)) return true;
    const visibility = node.getAttribute('visibility');
    if (visibility && visibility.trim().toLowerCase() === 'hidden') return true;
  }
  return false;
}

/**
 * Matrice cumulata dell'elemento: il suo `transform` più quelli di tutti i `<g>` che lo
 * contengono. Serve perché `getPointAtLength` risponde nello spazio utente LOCALE
 * dell'elemento — senza questa, un `<g transform="translate(…) rotate(…)">` di Illustrator
 * fa entrare la forma giusta nel posto sbagliato, senza nessun errore.
 */
function cumulativeMatrix(el: Element, root: Element): Matrix {
  const chain: Element[] = [];
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) chain.push(node);
  let matrix = IDENTITY_MATRIX;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    matrix = multiplyMatrix(matrix, parseSvgTransform(chain[i].getAttribute('transform')));
  }
  return matrix;
}

/** Scala unità-viewBox → mm quando il file non dichiara una misura fisica (porting di inferUndeclaredSvgScale). */
function undeclaredScale(scaleMode: ScaleMode, dpi: number): number {
  if (scaleMode === 'illustrator-72') return MM_PER_INCH / 72;
  if (scaleMode === 'viewbox-mm') return 1;
  return pxToMm(1, dpi);
}

export function parseSvgToContours(svgText: string, options: number | SvgImportOptions = {}): ImportResult {
  const opts: SvgImportOptions = typeof options === 'number' ? { dpi: options } : options;
  const dpi = opts.dpi ?? DPI_DEFAULT;
  const scaleMode = opts.scaleMode ?? 'auto';

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  const host = document.createElement('div');
  host.setAttribute('style', 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden');
  const imported = document.importNode(svgEl, true) as SVGSVGElement;
  host.appendChild(imported);
  document.body.appendChild(host);

  const contours: Contour[] = [];
  let method: ImportResult['method'] = 'dpi';
  let frame: SourceFrame | undefined;
  try {
    const vb = imported.viewBox?.baseVal;
    const vw = vb && vb.width ? vb.width : 0;
    const vh = vb && vb.height ? vb.height : 0;
    // Le misure dichiarate si leggono SEMPRE al DPI canonico: `width="595"` vuol dire 595 px,
    // non 595 unità del ripiego. Il `dpi`/`scaleMode` dell'opzione riguarda solo il ripiego.
    const widthMm = svgLengthToMm(imported.getAttribute('width') || '', DPI_DEFAULT);
    const heightMm = svgLengthToMm(imported.getAttribute('height') || '', DPI_DEFAULT);
    // Se il file dichiara UNA sola dimensione, l'altra prende la stessa scala: scalare i due assi
    // con criteri diversi non rimpicciolisce il disegno, lo STIRA — e nessuno se ne accorge.
    let sx = widthMm && vw ? widthMm / vw : null;
    let sy = heightMm && vh ? heightMm / vh : null;
    if (sx === null && sy !== null) sx = sy;
    if (sy === null && sx !== null) sy = sx;
    const declared = sx !== null;
    method = declared ? 'declared' : 'dpi';
    const fallback = undeclaredScale(scaleMode, dpi);
    const scaleX = sx ?? fallback;
    const scaleY = sy ?? fallback;
    const ox = vb ? vb.x : 0;
    const oy = vb ? vb.y : 0;
    const toMm = (p: { x: number; y: number }): Point => ({ x: (p.x - ox) * scaleX, y: (p.y - oy) * scaleY });
    frame = {
      scaleX, scaleY, offsetX: ox, offsetY: oy,
      viewBox: imported.getAttribute('viewBox'),
      widthAttr: imported.getAttribute('width'),
      heightAttr: imported.getAttribute('height'),
    };

    const els = imported.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse');
    els.forEach((el) => {
      if (isHiddenGeometry(el, imported)) return;
      const geo = el as unknown as SVGGeometryElement;
      if (typeof geo.getTotalLength !== 'function') return;
      let L = 0;
      try { L = geo.getTotalLength(); } catch { return; }
      if (!isFinite(L) || L <= 0) return;
      const matrix = cumulativeMatrix(el, imported);
      const identity = isIdentityMatrix(matrix);
      const stepUser = Math.max(0.4, 0.6 / (scaleX || 1)); // ~0.6mm in user units
      const n = Math.max(2, Math.ceil(L / stepUser));
      const pts: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const raw = geo.getPointAtLength((i / n) * L);
        pts.push(toMm(identity ? raw : applyMatrix(matrix, raw)));
      }
      const tag = el.tagName.toLowerCase();
      const d = el.getAttribute('d') || '';
      // Chiusura geometrica: molti <polyline>/<path> chiudono la forma senza Z ripetendo il primo punto (R28).
      const closed = isGeometricallyClosed(pts) || /polygon|rect|circle|ellipse/.test(tag) || /[zZ]/.test(d);
      const cs = getComputedStyle(el as Element);
      const strokeC = normalizeColor(cs.stroke);
      const fillC = normalizeColor(cs.fill);
      const color = strokeC !== 'none' ? strokeC : fillC !== 'none' ? fillC : '#000000';
      contours.push({ points: pts, closed, color });
    });
  } finally {
    document.body.removeChild(host);
  }
  return { contours, ...measureContours(contours), method, frame };
}

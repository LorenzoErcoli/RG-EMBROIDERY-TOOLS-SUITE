// Import SVG → contorni in mm, con colore per ruolo. Regole R2, R11, R12.
// Usa il DOM del browser (getPointAtLength) per campionare qualsiasi path/curva in modo robusto.
import type { Contour, Point, ImportResult, SourceFrame } from '../types';
import { pxToMm, svgLengthToMm, DPI_DEFAULT } from '../units';
import { measureContours } from '../imports';

function rgbToHex(c: string): string {
  if (!c || c === 'none') return 'none';
  if (c.startsWith('#')) {
    if (c.length === 4) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
    return c.toLowerCase();
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return 'none';
  const parts = m[1].split(',').map((s) => parseFloat(s));
  if (parts.length >= 4 && parts[3] === 0) return 'none';
  const [r, g, b] = parts;
  const hx = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

export function parseSvgToContours(svgText: string, dpi = DPI_DEFAULT): ImportResult {
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
    const widthMm = svgLengthToMm(imported.getAttribute('width') || '', dpi);
    const heightMm = svgLengthToMm(imported.getAttribute('height') || '', dpi);
    const declared = !!(widthMm && vw);
    method = declared ? 'declared' : 'dpi';
    const sx = declared ? widthMm! / vw : pxToMm(1, dpi);
    const sy = heightMm && vh ? heightMm / vh : pxToMm(1, dpi);
    const ox = vb ? vb.x : 0;
    const oy = vb ? vb.y : 0;
    const toMm = (p: { x: number; y: number }): Point => ({ x: (p.x - ox) * sx, y: (p.y - oy) * sy });
    frame = {
      scaleX: sx, scaleY: sy, offsetX: ox, offsetY: oy,
      viewBox: imported.getAttribute('viewBox'),
      widthAttr: imported.getAttribute('width'),
      heightAttr: imported.getAttribute('height'),
    };

    const els = imported.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse');
    els.forEach((el) => {
      const geo = el as unknown as SVGGeometryElement;
      if (typeof geo.getTotalLength !== 'function') return;
      let L = 0;
      try { L = geo.getTotalLength(); } catch { return; }
      if (!isFinite(L) || L <= 0) return;
      const stepUser = Math.max(0.4, 0.6 / (sx || 1)); // ~0.6mm in user units
      const n = Math.max(2, Math.ceil(L / stepUser));
      const pts: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const pt = geo.getPointAtLength((i / n) * L);
        pts.push(toMm(pt));
      }
      const tag = el.tagName.toLowerCase();
      const d = el.getAttribute('d') || '';
      const first = pts[0], last = pts[pts.length - 1];
      // Chiusura geometrica: molti <polyline>/<path> chiudono la forma senza Z ripetendo il primo punto.
      const geoClosed = pts.length > 2 && Math.hypot(first.x - last.x, first.y - last.y) < 1.0;
      const closed = geoClosed || /polygon|rect|circle|ellipse/.test(tag) || /[zZ]/.test(d);
      const cs = getComputedStyle(el as Element);
      const strokeC = rgbToHex(cs.stroke);
      const fillC = rgbToHex(cs.fill);
      const color = strokeC !== 'none' ? strokeC : fillC !== 'none' ? fillC : '#000000';
      contours.push({ points: pts, closed, color });
    });
  } finally {
    document.body.removeChild(host);
  }
  return { contours, ...measureContours(contours), method, frame };
}

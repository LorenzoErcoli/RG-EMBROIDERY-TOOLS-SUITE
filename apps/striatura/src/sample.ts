import type { Contour } from '@rg/core';

// Sagoma demo: un contorno esterno arrotondato (area ricamabile) + un'area vuota interna,
// così si vede subito che le striature rispettano il vuoto e il bordo (R5).
function roundedRect(x: number, y: number, w: number, h: number, r: number, n = 8): Contour['points'] {
  const pts: Contour['points'] = [];
  const corners: [number, number, number, number][] = [
    [x + r, y + r, Math.PI, 1.5 * Math.PI],
    [x + w - r, y + r, 1.5 * Math.PI, 2 * Math.PI],
    [x + w - r, y + h - r, 0, 0.5 * Math.PI],
    [x + r, y + h - r, 0.5 * Math.PI, Math.PI],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  return pts;
}
function circle(cx: number, cy: number, r: number, n = 28): Contour['points'] {
  const pts: Contour['points'] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function sampleContours(): Contour[] {
  return [
    { points: roundedRect(10, 10, 190, 180, 30), closed: true, color: '#2b6cb0' }, // area ricamabile
    { points: circle(145, 62, 26), closed: true, color: '#e53e3e' },               // area vuota (void)
  ];
}

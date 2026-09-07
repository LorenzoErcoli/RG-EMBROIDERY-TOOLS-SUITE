// Come si DISEGNA questo tool: una funzione sola, usata dall'anteprima e dall'export.
//
// Se il disegno dell'anteprima e quello dell'export fossero due, mostrerebbero due cose diverse e
// nessuno se ne accorgerebbe finché il file non arriva in macchina (è lo stesso motivo per cui il
// decoder del DST è uno solo — R28).
//
// Il ricamo di partenza e le frange stanno in DUE gruppi separati apposta: il primo si disegna una
// volta sola e non cambia mai, il secondo si rigenera a ogni giro di manopola. Su 188.000 punti la
// differenza fra ridisegnare tutto e ridisegnare solo le frange è fra un tool che scatta e uno che
// arranca.

import type { Point } from '@rg/core';

/** Filo sottile, in preview e in export (R15): la larghezza vera del punto è nella geometria. */
const THREAD_MM = 0.1;

export interface Riquadro { minX: number; minY: number; larghezza: number; altezza: number }

/** Tinte degli aghi: servono a distinguere i blocchi, non a dire il colore del filato (R31). */
export const TINTE = ['#283e6e', '#5c7ea8', '#96b0c8', '#b0b096', '#8a6f8f', '#6f8a7a'];

export function riquadroDi(blocchi: Array<{ points_mm: Array<[number, number]> }>): Riquadro {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of blocchi) for (const [x, y] of b.points_mm) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, larghezza: 1, altezza: 1 };
  return { minX, minY, larghezza: Math.max(1, maxX - minX), altezza: Math.max(1, maxY - minY) };
}

const via = (punti: Array<[number, number]>): string =>
  punti.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ');

/** Il ricamo (un path per blocco, colorato per ago). */
export function gruppoRicamo(
  blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>,
  opts: { grigio?: boolean } = {},
): string {
  const path = blocchi
    .filter((b) => b.points_mm.length >= 2)
    .map((b) => `<path d="${via(b.points_mm)}" fill="none" stroke="${opts.grigio ? '#c3c8ce' : TINTE[(b.needle - 1) % TINTE.length]}" stroke-width="${THREAD_MM}"/>`)
    .join('');
  return `<g id="ricamo">${path}</g>`;
}

/**
 * Le sole frange, prese dal confronto fra prima e dopo: sono i punti in più, e ognuno è una punta
 * fra due gemelli. Si disegnano a parte perché il ricamo sotto non cambia mai.
 */
export function gruppoFrange(
  prima: Array<{ points_mm: Array<[number, number]> }>,
  dopo: Array<{ needle: number; points_mm: Array<[number, number]> }>,
  colore: string,
): string {
  const segmenti: string[] = [];
  for (let i = 0; i < dopo.length; i++) {
    const a = prima[i]?.points_mm, b = dopo[i].points_mm;
    if (!a || a.length === b.length) continue;
    for (let j = 1; j < b.length - 1; j++) {
      const p = b[j - 1], q = b[j], r = b[j + 1];
      if (p[0] !== r[0] || p[1] !== r[1]) continue;       // la punta sta fra due gemelli
      segmenti.push(`M${p[0].toFixed(3)} ${p[1].toFixed(3)}L${q[0].toFixed(3)} ${q[1].toFixed(3)}`);
    }
  }
  return `<g id="frange"><path d="${segmenti.join(' ')}" fill="none" stroke="${colore}" stroke-width="${THREAD_MM}"/></g>`;
}

/** Le zone marcate, in chiaro: si vedono solo a schermo, mai nell'export. */
export function gruppoZone(zone: Point[][]): string {
  if (!zone.length) return '<g id="zone"></g>';
  const p = zone
    .map((z) => `<path d="${via(z.map((q) => [q.x, q.y] as [number, number]))}Z" fill="#f3c623" fill-opacity="0.22" stroke="#c99a10" stroke-width="0.15" stroke-opacity="0.5"/>`)
    .join('');
  return `<g id="zone">${p}</g>`;
}

/** L'SVG completo, in millimetri reali (R1): 1 unità = 1 mm, viewBox sul riquadro del ricamo. */
export function svgDocumento(r: Riquadro, contenuto: string, metadata?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.larghezza.toFixed(2)}mm" height="${r.altezza.toFixed(2)}mm" viewBox="${r.minX.toFixed(2)} ${r.minY.toFixed(2)} ${r.larghezza.toFixed(2)} ${r.altezza.toFixed(2)}">${metadata ?? ''}${contenuto}</svg>`;
}

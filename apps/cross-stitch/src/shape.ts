// LA FORMA DEL PEZZO (Lorenzo, 2026-10-07: «dovrei poter inserire un DXF o SVG per creare un riempimento
// dopo aver costruito un modulo… sono tutti strumenti già esistenti»).
//
// Un DXF o un SVG (letti coi parser della suite, @rg/core) dà dei contorni in mm. Come negli altri tool
// (striatura, razza): il contorno chiuso più grande è il perimetro, i contorni chiusi di un altro colore
// dentro di lui sono aree vuote; i ruoli si correggono per colore. Il ricamo prende la misura della forma
// e si cuciono solo le celle col centro dentro un perimetro e fuori dalle aree vuote: la MASCHERA. Il
// disegno (anche il modulo ripetuto) resta com'è: la maschera la applica il motore (routing.ts, strips.ts),
// così il ricamo resta «il modulo ripetuto» e il percorso del modulo si taglia alla forma.
//
// Nessun DOM.

import { pointInPolygon, polygonArea, type Contour, type Polyline } from '@rg/core';
import type { GridSpec } from './model';
import { rowPitch } from './model';

export type ShapeRole = 'outline' | 'void';

/** La forma del pezzo: i contorni in mm (con l'angolo in alto a sinistra in 0, 0) e il ruolo di ogni colore. */
export interface PieceShape {
  contours: Contour[];
  roles: Record<string, ShapeRole | ''>;
  /** Il nome del file, per la barra di stato. */
  name?: string;
}

/** I contorni portati con l'angolo in alto a sinistra in (0, 0) (il DXF ha le Y negative), e la loro misura. */
export function normalizeContours(contours: Contour[]): { contours: Contour[]; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of contours) for (const p of c.points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  if (!(x1 > x0)) return { contours: [], w: 0, h: 0 };
  return { contours: contours.map((c) => ({ ...c, points: c.points.map((p) => ({ x: p.x - x0, y: p.y - y0 })) })), w: x1 - x0, h: y1 - y0 };
}

/** I ruoli proposti: il colore del contorno chiuso più grande è il perimetro; gli altri colori con un contorno dentro di lui, aree vuote. */
export function autoRoles(contours: Contour[]): Record<string, ShapeRole | ''> {
  const roles: Record<string, ShapeRole | ''> = {};
  const closed = contours.filter((c) => c.closed && c.points.length > 2);
  for (const c of contours) roles[c.color] = '';
  if (!closed.length) return roles;
  const big = closed.reduce((q, w) => (polygonArea(w.points) > polygonArea(q.points) ? w : q));
  roles[big.color] = 'outline';
  for (const c of closed) if (c.color !== big.color && pointInPolygon(c.points[0], big.points)) roles[c.color] = 'void';
  return roles;
}

/** I perimetri e le aree vuote della forma (solo i contorni chiusi). */
export function shapeRings(shape: PieceShape): { outers: Polyline[]; holes: Polyline[] } {
  const outers: Polyline[] = [], holes: Polyline[] = [];
  for (const c of shape.contours) {
    if (!c.closed || c.points.length < 3) continue;
    const r = shape.roles[c.color];
    if (r === 'outline') outers.push(c.points); else if (r === 'void') holes.push(c.points);
  }
  // un solo colore per perimetro e buchi (convenzione di Illustrator): il più grande è il perimetro
  if (outers.length > 1 && !holes.length) {
    const sorted = [...outers].sort((a, b) => polygonArea(b) - polygonArea(a));
    const big = sorted[0];
    return { outers: [big, ...sorted.slice(1).filter((p) => !pointInPolygon(p[0], big))], holes: sorted.slice(1).filter((p) => pointInPolygon(p[0], big)) };
  }
  return { outers, holes };
}

/**
 * La maschera: per ogni cella della griglia (riga per riga) 1 se il suo centro è dentro un perimetro e
 * fuori da tutte le aree vuote. Il centro di una cella è ((c + ½)·cellW, r·passo + cellH/2), come per
 * l'area di prova. null se la forma non ha nessun perimetro.
 */
export function cellMask(g: GridSpec, shape: PieceShape): Uint8Array | null {
  const { outers, holes } = shapeRings(shape);
  if (!outers.length) return null;
  const mask = new Uint8Array(g.rows * g.cols);
  const pitch = rowPitch(g);
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const p = { x: (c + 0.5) * g.cellW, y: r * pitch + g.cellH / 2 };
    if (outers.some((o) => pointInPolygon(p, o)) && !holes.some((h) => pointInPolygon(p, h))) mask[r * g.cols + c] = 1;
  }
  return mask;
}

/** Il pezzo di maschera di un rettangolo di celle (righe r0..r1, colonne c0..c1 escluse). */
export function subMask(mask: Uint8Array, cols: number, r0: number, r1: number, c0 = 0, c1 = cols): Uint8Array {
  const w = c1 - c0, out = new Uint8Array((r1 - r0) * w);
  for (let r = r0; r < r1; r++) out.set(mask.subarray(r * cols + c0, r * cols + c1), (r - r0) * w);
  return out;
}

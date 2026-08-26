// Punto ③ — dalla mappa dei colori alle REGIONI: poligoni in millimetri, con i loro fori.
//
// È il pezzo che nella suite non esisteva da nessuna parte: `apps/bitmap` va da raster a *punti*
// senza mai costruire un'area. Qui serve perché il raso (R24, `buildParallelFill` nel core) vuole
// un poligono, non una maschera — ed è la stessa forma che poi il routing deve aggirare.
//
// Resta locale all'app (ARCHITETTURA, regola di crescita 2): si promuove nel core quando la
// chiederà un secondo tool. I candidati ci sono già — bitmap, per fare riempimenti veri invece di
// puntini, e interlace per le macchie per zona (C4) — ma finché non la chiedono davvero sta qui.
//
// Nessun DOM: si prova in Node dallo smoke test.

import { type Polyline, type Point, simplifyPolyline, polygonArea, pointInPolygon } from '@rg/core';
import { NO_COLOR } from './reduce';

/** Un'area di un colore: il suo contorno e i buchi che ha dentro, in millimetri reali (R1). */
export interface Region {
  outer: Polyline;
  holes: Polyline[];
  /** Area netta (contorno meno fori), in mm². */
  areaMm2: number;
}

/** Direzioni dei lati di un pixel, percorsi in modo che il pieno resti sempre dalla stessa parte. */
type Crack = { x0: number; y0: number; x1: number; y1: number };

const key = (x: number, y: number): number => y * 100000 + x;

/**
 * Segue il contorno di una macchia lungo i **lati dei pixel** (non i loro centri): il risultato è
 * un anello esatto a gradini, che poi si semplifica.
 *
 * Ogni pixel pieno che confina col vuoto contribuisce quel lato, orientato sempre nello stesso
 * verso; incatenando i lati per estremi si ottengono gli anelli chiusi. Dove due pixel si toccano
 * solo in diagonale da un angolo escono due lati: si prende sempre quello che gira più a destra,
 * così la scelta è deterministica e i due anelli restano distinti.
 */
function traceLoops(inside: (i: number) => boolean, cells: number[], width: number): Point[][] {
  const cracks = new Map<number, Crack[]>();
  const push = (c: Crack): void => {
    const k = key(c.x0, c.y0);
    const arr = cracks.get(k);
    if (arr) arr.push(c); else cracks.set(k, [c]);
  };
  const pieno = new Set(cells);
  const ok = (x: number, y: number): boolean => pieno.has(y * width + x) && inside(y * width + x);

  for (const i of cells) {
    const x = i % width, y = (i / width) | 0;
    if (!ok(x, y - 1)) push({ x0: x, y0: y, x1: x + 1, y1: y });               // sopra  → +x
    if (!ok(x + 1, y)) push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });       // destra → +y
    if (!ok(x, y + 1)) push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1 });       // sotto  → −x
    if (!ok(x - 1, y)) push({ x0: x, y0: y + 1, x1: x, y1: y });               // sin.   → −y
  }

  const loops: Point[][] = [];
  const usate = new Set<Crack>();
  for (const [, arr] of cracks) {
    for (const start of arr) {
      if (usate.has(start)) continue;
      const loop: Point[] = [];
      let cur: Crack | undefined = start;
      while (cur && !usate.has(cur)) {
        usate.add(cur);
        loop.push({ x: cur.x0, y: cur.y0 });
        const dx = cur.x1 - cur.x0, dy = cur.y1 - cur.y0;
        const uscenti: Crack[] = (cracks.get(key(cur.x1, cur.y1)) ?? []).filter((c) => !usate.has(c));
        if (!uscenti.length) break;
        // svolta più a destra: rotazione oraria minima rispetto alla direzione d'arrivo
        let best: Crack = uscenti[0];
        let bestScore = -Infinity;
        for (const c of uscenti) {
          const ex = c.x1 - c.x0, ey = c.y1 - c.y0;
          const cross = dx * ey - dy * ex;         // >0 = svolta a destra in coordinate y-giù
          const dot = dx * ex + dy * ey;
          const score = cross > 0 ? 2 : cross < 0 ? 0 : dot > 0 ? 1 : -1;
          if (score > bestScore) { bestScore = score; best = c; }
        }
        cur = best;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

export interface TraceOptions {
  /** Tolleranza della semplificazione del contorno, in mm. */
  simplifyMm?: number;
  /** Area netta minima perché una regione valga la pena, in mm². */
  minAreaMm2?: number;
}

/**
 * Le regioni di un colore: una per macchia connessa, coi suoi fori, in millimetri.
 *
 * Le macchie si contano a **4 vicini** (non in diagonale): due pixel che si toccano solo per un
 * angolo sono due macchie, com'è giusto per il ricamo — il filo lì non ci passa.
 */
export function traceRegions(
  index: Uint8Array,
  width: number,
  height: number,
  colorIndex: number,
  mmPerPx: number,
  opts: TraceOptions = {},
): Region[] {
  const tol = opts.simplifyMm ?? Math.max(0.2, mmPerPx * 1.2);
  const minArea = opts.minAreaMm2 ?? 0;
  const n = width * height;
  const mine = (i: number): boolean => index[i] === colorIndex && index[i] !== NO_COLOR;

  const visto = new Uint8Array(n);
  const stack = new Int32Array(n);
  const out: Region[] = [];

  for (let s = 0; s < n; s++) {
    if (visto[s] || !mine(s)) continue;
    // la macchia connessa
    let sp = 0;
    const cells: number[] = [];
    stack[sp++] = s; visto[s] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      cells.push(i);
      const x = i % width, y = (i / width) | 0;
      if (x > 0 && !visto[i - 1] && mine(i - 1)) { visto[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < width - 1 && !visto[i + 1] && mine(i + 1)) { visto[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && !visto[i - width] && mine(i - width)) { visto[i - width] = 1; stack[sp++] = i - width; }
      if (y < height - 1 && !visto[i + width] && mine(i + width)) { visto[i + width] = 1; stack[sp++] = i + width; }
    }

    const loops = traceLoops(mine, cells, width)
      .map((l) => simplifyPolyline(l.map((p) => ({ x: p.x * mmPerPx, y: p.y * mmPerPx })), tol))
      .filter((l) => l.length >= 4);
    if (!loops.length) continue;

    // Il contorno è l'anello con l'area più grande; gli altri sono fori (sono dentro, per costruzione).
    const conArea = loops.map((l) => ({ l, a: Math.abs(polygonArea(l)) })).sort((p, q) => q.a - p.a);
    const outer = conArea[0].l;
    const holes = conArea.slice(1).map((c) => c.l);
    const areaMm2 = conArea[0].a - holes.reduce((sum, h) => sum + Math.abs(polygonArea(h)), 0);
    if (areaMm2 < minArea) continue;
    out.push({ outer, holes, areaMm2 });
  }

  // dalla più grande alla più piccola: si cuce prima il grosso, e l'ordine è deterministico
  out.sort((a, b) => b.areaMm2 - a.areaMm2 || a.outer[0].x - b.outer[0].x || a.outer[0].y - b.outer[0].y);
  return out;
}

/** Vero se `p` sta dentro la regione: dentro il contorno e fuori da tutti i fori. */
export function pointInRegion(p: Point, r: Region): boolean {
  if (!pointInPolygon(p, r.outer)) return false;
  for (const h of r.holes) if (pointInPolygon(p, h)) return false;
  return true;
}

/** L'area totale di un insieme di regioni, in mm². */
export const regionsAreaMm2 = (rs: Region[]): number => rs.reduce((s, r) => s + r.areaMm2, 0);

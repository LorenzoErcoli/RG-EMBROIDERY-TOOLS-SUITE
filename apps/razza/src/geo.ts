// Piccoli attrezzi geometrici del tool: il pezzo (contorno + vuoti), la griglia dei vicini, i numeri a caso.
import { type Point, type Polyline, pointInPolygon, distanceToBoundary } from '@rg/core';
import type { Pezzo } from './tipi';

export function pezzoDa(contorno: Polyline, vuoti: Polyline[] = []): Pezzo {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of contorno) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return { contorno, vuoti, minX, minY, maxX, maxY };
}

export function rettangolo(w: number, h: number): Pezzo {
  return pezzoDa([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
}

/** Il punto sta nel pezzo? Dentro il contorno e fuori da ogni vuoto. */
export function dentroPezzo(pz: Pezzo, p: Point): boolean {
  if (!pointInPolygon(p, pz.contorno)) return false;
  for (const v of pz.vuoti) if (pointInPolygon(p, v)) return false;
  return true;
}

/** Distanza dal bordo piu' vicino: quello esterno o quello di un vuoto. */
export function distanzaBordo(pz: Pezzo, p: Point): number {
  let d = distanceToBoundary(p, pz.contorno);
  for (const v of pz.vuoti) d = Math.min(d, distanceToBoundary(p, v));
  return d;
}

/** L'area del pezzo, vuoti tolti (formula dei lacci). */
export function areaPezzo(pz: Pezzo): number {
  const lacci = (poly: Polyline): number => {
    let s = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; }
    return Math.abs(s) / 2;
  };
  return lacci(pz.contorno) - pz.vuoti.reduce((s, v) => s + lacci(v), 0);
}

/** Un segmento sta tutto dentro il pezzo? (un passaggio non deve uscire dalla sagoma ne' attraversare un vuoto) */
export function segmentoDentroPezzo(pz: Pezzo, a: Point, b: Point): boolean {
  const L = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(L / 0.5));
  for (let q = 0; q <= m; q++) if (!dentroPezzo(pz, { x: a.x + ((b.x - a.x) * q) / m, y: a.y + ((b.y - a.y) * q) / m })) return false;
  return true;
}

/**
 * Le distanze dal bordo su una griglia: costano una volta sola (qualche decina di migliaia di punti per
 * il contorno intero) e poi ogni domanda «quanto sono lontano dal bordo?» e' un'interpolazione. Senza,
 * il campo dei diametri, chiesto mezzo milione di volte dalla posa, rifaceva ogni volta la distanza da
 * tutti i lati del contorno.
 */
export class MappaDistanze {
  readonly w: number; readonly h: number;
  private readonly dati: Float32Array;
  /** la distanza massima dal bordo, dentro il pezzo: «quanto e' profondo» */
  readonly massima: number;
  constructor(readonly pz: Pezzo, readonly passo = 1) {
    this.w = Math.ceil((pz.maxX - pz.minX) / passo) + 2;
    this.h = Math.ceil((pz.maxY - pz.minY) / passo) + 2;
    this.dati = new Float32Array(this.w * this.h);
    let massima = 0;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const p = { x: pz.minX + (i - 0.5) * passo, y: pz.minY + (j - 0.5) * passo };
      const d = dentroPezzo(pz, p) ? distanzaBordo(pz, p) : 0;
      this.dati[j * this.w + i] = d;
      if (d > massima) massima = d;
    }
    this.massima = massima;
  }
  /** Distanza dal bordo in (x,y); 0 fuori dal pezzo. Interpolata. */
  alla(x: number, y: number): number {
    const fx = (x - this.pz.minX) / this.passo + 0.5, fy = (y - this.pz.minY) / this.passo + 0.5;
    const i = Math.max(0, Math.min(this.w - 2, Math.floor(fx))), j = Math.max(0, Math.min(this.h - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
    const a = this.dati[j * this.w + i], b = this.dati[j * this.w + i + 1], c = this.dati[(j + 1) * this.w + i], d = this.dati[(j + 1) * this.w + i + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
}

export class Griglia {
  private celle = new Map<number, number[]>();
  constructor(readonly passo: number) {}
  private chiave(ix: number, iy: number): number { return ix * 100003 + iy; }
  aggiungi(i: number, x: number, y: number): void {
    const k = this.chiave(Math.floor(x / this.passo), Math.floor(y / this.passo));
    const c = this.celle.get(k); if (c) c.push(i); else this.celle.set(k, [i]);
  }
  /** Gli indici nelle celle entro `raggio` da (x,y). */
  vicini(x: number, y: number, raggio: number): number[] {
    const out: number[] = [];
    const i0 = Math.floor((x - raggio) / this.passo), i1 = Math.floor((x + raggio) / this.passo);
    const j0 = Math.floor((y - raggio) / this.passo), j1 = Math.floor((y + raggio) / this.passo);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = this.celle.get(this.chiave(i, j)); if (c) for (const k of c) out.push(k); }
    return out;
  }
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Rumore di valore 2D liscio, in [0,1]. */
export function rumore(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

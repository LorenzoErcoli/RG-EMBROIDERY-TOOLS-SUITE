import type { Point } from "../grammar/types.ts";

/**
 * Le AREE DI SCARICO: dove i punti vanno "scaricati", di solito per il montaggio. Dentro, i
 * zig-zag hanno meno passate; fuori, niente cambia. Sono anelli chiusi nelle coordinate finali
 * del disegno (mm), le stesse della sagoma importata.
 *
 * Più aree possono sovrapporsi: vale l'UNIONE — un punto dentro almeno una è scaricato.
 */
export type ReliefRing = Point[];

/** Anelli utilizzabili: almeno un triangolo. */
export function usableReliefRings(rings: ReliefRing[] | undefined): ReliefRing[] {
  return (rings ?? []).filter((ring) => Array.isArray(ring) && ring.length >= 3);
}

function insideRing(point: Point, ring: ReliefRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** `true` se il punto sta dentro almeno un'area. */
export function insideRelief(point: Point, rings: ReliefRing[]): boolean {
  return rings.some((ring) => insideRing(point, ring));
}

/**
 * Dove la verticale `x` sta DENTRO le aree: intervalli [y0, y1] ordinati e già uniti.
 *
 * Serve al taglio NETTO dei zig-zag verticali: un blocco verticale è alto quanto un modulo
 * (12 mm nel cannage), e decidere il blocco intero dal suo centro sposterebbe il confine dello
 * scarico fino a mezzo modulo. Tagliando il blocco dove la verticale incontra il contorno, il
 * cambio di densità cade sulla linea disegnata.
 */
export function reliefIntervalsAlongVertical(x: number, rings: ReliefRing[]): [number, number][] {
  const intervals: [number, number][] = [];
  for (const ring of rings) {
    const crossings: number[] = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      // Semiaperto a destra: un vertice che cade proprio sulla verticale conta una volta sola.
      if ((a.x <= x && x < b.x) || (b.x <= x && x < a.x)) {
        crossings.push(a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) intervals.push([crossings[k], crossings[k + 1]]);
  }
  intervals.sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([interval[0], interval[1]]);
  }
  return merged;
}

/**
 * Le passate che restano dopo lo scarico. `percent` è quanto si toglie: 50 = metà.
 * Mai sotto una passata — un zig-zag senza passate non è più un zig-zag, è un buco.
 */
export function relievedPasses(passes: number, percent: number): number {
  const kept = 1 - Math.min(100, Math.max(0, percent)) / 100;
  return Math.max(1, Math.round(passes * kept));
}

// Primitive condivise di import: chiusura dei contorni e colori. Regole R12, R28.
// NESSUN uso del DOM qui dentro: questo file deve funzionare anche in Node,
// così ogni importer (browser o puro testo) può appoggiarsi alle stesse risposte.
import type { Point } from '../types';

/**
 * Tolleranza di chiusura di un contorno (R28).
 * Un disegno di ricamo chiude spesso la sagoma ripetendo il primo punto senza `Z`,
 * e con arrotondamenti da CAD/Illustrator: sotto questa distanza i due capi
 * sono lo stesso punto. 1 mm è largo rispetto al filo (0.1 mm) ma stretto
 * rispetto a qualsiasi apertura voluta in un cartamodello.
 */
export const CLOSURE_TOL_MM = 1.0;

/** I due capi del contorno coincidono entro la tolleranza? */
export function isGeometricallyClosed(points: Point[], tolMm = CLOSURE_TOL_MM): boolean {
  if (points.length <= 2) return false;
  const first = points[0], last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < tolMm;
}

/**
 * Restituisce l'anello chiuso *esatto*: l'ultimo punto coincide col primo.
 * Se i capi erano già vicini entro tolleranza, l'ultimo viene portato sul primo
 * (era il primo, mal arrotondato) invece di lasciare un buco.
 */
export function closePolygon(points: Point[], tolMm = CLOSURE_TOL_MM): Point[] {
  if (!points.length) return [];
  const first = points[0], last = points[points.length - 1];
  if (first.x === last.x && first.y === last.y) return points.slice();
  if (isGeometricallyClosed(points, tolMm)) return [...points.slice(0, -1), { ...first }];
  return [...points, { ...first }];
}

/** Colori CSS per nome che compaiono nei file di cartamodello. */
export const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', magenta: '#ff00ff', cyan: '#00ffff', yellow: '#ffff00',
};

/**
 * Normalizza un colore SVG/CSS in `#rrggbb` minuscolo — è la chiave con cui
 * l'utente assegna i ruoli, quindi due file che dicono lo stesso colore in modo
 * diverso devono produrre la stessa chiave.
 *
 * - valore assente → `fallback`
 * - `none` / `transparent` / rgba con alpha 0 → `'none'` (assenza di tinta, non un colore)
 * - tutto il resto non interpretabile → restituito com'è, minuscolo
 */
export function normalizeColor(value: string | undefined | null, fallback = 'none'): string {
  const c = (value ?? '').trim().toLowerCase();
  if (!c) return fallback;
  if (c === 'none' || c === 'transparent') return c;

  if (/^#[0-9a-f]{3}$/.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  if (/^#[0-9a-f]{6}$/.test(c)) return c;

  const m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    if (parts.length >= 4 && parts[3] === 0) return 'none';
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      const hx = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
      return `#${hx(parts[0])}${hx(parts[1])}${hx(parts[2])}`;
    }
    return fallback;
  }

  return NAMED_COLORS[c] ?? c;
}

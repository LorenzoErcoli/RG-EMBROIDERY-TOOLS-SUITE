// IL TIMBRO (Lorenzo, 2026-10-19: «devo disegnare una nuova grafica, ma ha una parte che voglio riprendere da un
// altro DST generato nel tool»). Un pezzo di un altro progetto (le sue celle, coi suoi fili) si prende, si porta alla
// misura delle V del progetto aperto, si capovolge se serve e si posa sulla griglia. I colori del pezzo vanno sui
// fili del progetto (lo stesso colore, o il più vicino, o un filo nuovo); le celle del fondo del pezzo, di partenza,
// non coprono il disegno sotto.
//
// Nessun DOM.

import type { CellEdit, CellMark, Cells, GridSpec, Stitch, Thread } from './model';
import { labOf, rowPitch } from './model';

/** Il pezzo: le sue celle (riga per riga, null = vuota), la sua V e i fili da cui viene. */
export interface Stamp {
  rows: number;
  cols: number;
  marks: Array<CellMark | null>;
  cellW: number;
  cellH: number;
  overlapPct: number;
}

/** Il pezzo del rettangolo di celle [r0, r1) × [c0, c1); `skipColor` = il fondo da non portare (null = tutto). */
export function extractStamp(g: GridSpec, cells: Cells, r0: number, r1: number, c0: number, c1: number, skipColor: number | null): Stamp {
  r0 = Math.max(0, r0); c0 = Math.max(0, c0); r1 = Math.min(g.rows, r1); c1 = Math.min(g.cols, c1);
  const rows = Math.max(0, r1 - r0), cols = Math.max(0, c1 - c0);
  const marks: Array<CellMark | null> = [];
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const m = cells.get(r * g.cols + c);
    marks.push(m && m.color !== skipColor ? { ...m } : null);
  }
  return trimStamp({ rows, cols, marks, cellW: g.cellW, cellH: g.cellH, overlapPct: g.overlapPct ?? 0 });
}

/** Il pezzo stretto alle sue celle piene (via le righe e le colonne vuote ai bordi). */
export function trimStamp(s: Stamp): Stamp {
  let r0 = s.rows, r1 = -1, c0 = s.cols, c1 = -1;
  s.marks.forEach((m, i) => { if (!m) return; const r = Math.floor(i / s.cols), c = i % s.cols; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); });
  if (r1 < 0) return { ...s, rows: 0, cols: 0, marks: [] };
  const marks: Array<CellMark | null> = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) marks.push(s.marks[r * s.cols + c]);
  return { ...s, rows: r1 - r0 + 1, cols: c1 - c0 + 1, marks };
}

/**
 * Il pezzo alla misura delle V di `g`: stesse misure in mm (larghezza e altezza), celle prese dalla più vicina.
 * Con le V uguali resta com'è. `exact` dice se è rimasto identico (con V diverse il disegno si deforma un po').
 */
export function fitStamp(s: Stamp, g: GridSpec): { stamp: Stamp; exact: boolean } {
  const same = Math.abs(s.cellW - g.cellW) < 1e-6 && Math.abs(s.cellH - g.cellH) < 1e-6 && Math.abs(s.overlapPct - (g.overlapPct ?? 0)) < 1e-6;
  if (same || !s.rows) return { stamp: s, exact: true };
  const pSrc = rowPitch({ cols: 1, rows: 1, cellW: s.cellW, cellH: s.cellH, overlapPct: s.overlapPct }), pDst = rowPitch(g);
  const cols = Math.max(1, Math.round((s.cols * s.cellW) / g.cellW)), rows = Math.max(1, Math.round((s.rows * pSrc) / pDst));
  const marks: Array<CellMark | null> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    // il centro della cella nuova, in mm, e la cella del pezzo che lo contiene
    const sr = Math.min(s.rows - 1, Math.floor(((r + 0.5) * pDst) / pSrc)), sc = Math.min(s.cols - 1, Math.floor(((c + 0.5) * g.cellW) / s.cellW));
    const m = s.marks[sr * s.cols + sc];
    marks.push(m ? { ...m } : null);
  }
  return { stamp: { rows, cols, marks, cellW: g.cellW, cellH: g.cellH, overlapPct: g.overlapPct ?? 0 }, exact: false };
}

const flipH: Record<Stitch, Stitch> = { down: 'up', up: 'down', v: 'v', lambda: 'lambda', cross: 'cross' };
const flipV: Record<Stitch, Stitch> = { down: 'up', up: 'down', v: 'lambda', lambda: 'v', cross: 'cross' };

/** Il pezzo capovolto: a specchio (sinistra-destra) o sottosopra. Le diagonali e le V girano con lui. */
export function flipStamp(s: Stamp, axis: 'h' | 'v'): Stamp {
  const marks: Array<CellMark | null> = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const m = axis === 'h' ? s.marks[r * s.cols + (s.cols - 1 - c)] : s.marks[(s.rows - 1 - r) * s.cols + c];
    marks.push(m ? { color: m.color, stitch: (axis === 'h' ? flipH : flipV)[m.stitch] } : null);
  }
  return { ...s, marks };
}

/** I fili usati dal pezzo. */
export const stampColors = (s: Stamp): number[] => [...new Set(s.marks.filter((m): m is CellMark => !!m).map((m) => m.color))].sort((a, b) => a - b);

const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
/** La distanza fra due colori come la vede l'occhio (Lab). */
export function colorDistance(a: string, b: string): number {
  const p = labOf(...hexRgb(a)), q = labOf(...hexRgb(b));
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * La scelta proposta per ogni filo del pezzo: il filo del progetto con lo stesso colore (distanza < 3); se non c'è,
 * il filo selezionato nel tool (Lorenzo, 2026-10-19: «sembra voler disegnare sull'ago 1 e non su quello
 * selezionato»: col colore più vicino un blu chiaro finiva sul fondo, e il pezzo posato non si vedeva). Mai il filo
 * della base, se il colore non è proprio quello: se il selezionato è la base, il più vicino fra gli altri.
 */
export function proposeColorMap(src: Thread[], dst: Thread[], used: number[], opts: { selected?: number; base?: number | null } = {}): Record<number, { to: number; same: boolean }> {
  const out: Record<number, { to: number; same: boolean }> = {};
  const base = opts.base ?? null, sel = opts.selected;
  for (const k of used) {
    const hex = src[k]?.hex ?? '#000000';
    let same = -1, sd = Infinity, near = -1, nd = Infinity;
    dst.forEach((t, i) => { const d = colorDistance(hex, t.hex); if (d < sd) { sd = d; same = i; } if (i !== base && d < nd) { nd = d; near = i; } });
    if (sd < 3) out[k] = { to: same, same: true };
    else if (sel !== undefined && sel >= 0 && sel < dst.length && sel !== base) out[k] = { to: sel, same: false };
    else out[k] = { to: near >= 0 ? near : same, same: false };
  }
  return out;
}

/** Le modifiche per posare il pezzo con la sua cella (0, 0) sulla cella (r0, c0); `map` = filo del pezzo → filo del progetto. */
export function stampEdits(g: GridSpec, s: Stamp, r0: number, c0: number, map: Record<number, number>): CellEdit[] {
  const out: CellEdit[] = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const m = s.marks[r * s.cols + c];
    if (!m) continue;
    const rr = r0 + r, cc = c0 + c;
    if (rr < 0 || cc < 0 || rr >= g.rows || cc >= g.cols) continue;
    out.push({ r: rr, c: cc, mark: { stitch: m.stitch, color: map[m.color] ?? m.color } });
  }
  return out;
}

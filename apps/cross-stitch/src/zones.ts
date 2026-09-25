// Le ZONE di un colore: le parti del disegno che il filo finisce una alla volta (Lorenzo,
// 2026-09-25: «lavorare più a blocchi di oggetti tutti vicini per poi passare al blocco successivo»,
// con l'immagine dei passaggi che tornavano su blocchi iniziati prima e finiti dopo).
//
// Perché non bastano i pezzi che si toccano: in una colonna di testo ogni lettera è un pezzo a sé,
// e il filo, andando al pezzo più vicino, passava da una colonna all'altra e tornava (sul giornale
// Dior la colonna di sinistra era cucita un po' all'inizio e un po' alla fine). Né basta unire i
// pezzi vicini entro una distanza: le righe orizzontali del giornale collegano tutto, e già a 6 mm
// il nero diventava un gruppo solo.
//
// Come si trovano: si taglia il disegno lungo le STRISCE VUOTE — righe o colonne senza quel colore,
// larghe almeno `gapMm` — come si legge l'impaginazione di un giornale, e si ripete dentro ogni
// pezzo. Se una zona resta più grande di `maxMm` senza strisce vuote (il corpo del giornale, dove
// una riga verticale e la montagna tengono tutto unito), la si taglia sulla linea MENO piena nella
// sua parte centrale, lungo il lato lungo.
//
// Nessun DOM.

import type { Cells, GridSpec } from './model';
import { rowPitch } from './model';

export interface ZoneOptions {
  /** Vuoto minimo per tagliare, mm. */
  gapMm: number;
  /** Oltre questa misura una zona si taglia comunque, sulla linea meno piena, mm. */
  maxMm: number;
}

export const DEFAULT_ZONES: ZoneOptions = { gapMm: 5, maxMm: 100 };

/** Le zone delle celle di colore `color`: cella → zona (0, 1, 2… nell'ordine del taglio). */
export function zonesOf(g: GridSpec, cells: Cells, color: number, opts: Partial<ZoneOptions> = {}): Map<number, number> {
  const gapMm = Math.max(0, opts.gapMm ?? DEFAULT_ZONES.gapMm);
  const maxMm = Math.max(1, opts.maxMm ?? DEFAULT_ZONES.maxMm);
  const pitch = rowPitch(g);
  const on = (r: number, c: number) => cells.get(r * g.cols + c)?.color === color;
  const out = new Map<number, number>();
  let zone = 0;

  const cut = (r0: number, r1: number, c0: number, c1: number, depth: number): void => {
    let t = r0, b = r1, l = c0, rr = c1;
    const rowCount = (r: number) => { let n = 0; for (let c = l; c < rr; c++) if (on(r, c)) n++; return n; };
    const colCount = (c: number) => { let n = 0; for (let r = t; r < b; r++) if (on(r, c)) n++; return n; };
    // si stringe al contenuto
    while (t < b && !rowCount(t)) t++;
    while (b > t && !rowCount(b - 1)) b--;
    while (l < rr && !colCount(l)) l++;
    while (rr > l && !colCount(rr - 1)) rr--;
    if (t >= b || l >= rr) return;
    // la striscia vuota più larga, in righe e in colonne (in mm, per confrontarle)
    const widest = (n0: number, n1: number, count: (i: number) => number) => {
      let at = -1, len = 0, s = -1;
      for (let i = n0; i < n1; i++) {
        if (!count(i)) { if (s < 0) s = i; if (i - s + 1 > len) { len = i - s + 1; at = s; } } else s = -1;
      }
      return { at, len };
    };
    const hr = widest(t, b, rowCount), vc = widest(l, rr, colCount);
    const hMm = hr.len * pitch, vMm = vc.len * g.cellW;
    if (depth < 60 && gapMm > 0 && Math.max(hMm, vMm) >= gapMm) {
      if (hMm >= vMm) { cut(t, hr.at, l, rr, depth + 1); cut(hr.at + hr.len, b, l, rr, depth + 1); }
      else { cut(t, b, l, vc.at, depth + 1); cut(t, b, vc.at + vc.len, rr, depth + 1); }
      return;
    }
    const wMm = (rr - l) * g.cellW, htMm = (b - t) * pitch;
    if (depth < 60 && Math.max(wMm, htMm) > maxMm) {
      // la linea meno piena nella parte centrale (dal 30 al 70%), lungo il lato lungo
      if (wMm >= htMm) {
        let bi = -1, bv = Infinity;
        for (let c = l + Math.floor((rr - l) * 0.3); c < l + Math.ceil((rr - l) * 0.7); c++) { const v = colCount(c); if (v < bv) { bv = v; bi = c; } }
        if (bi > l && bi < rr) { cut(t, b, l, bi, depth + 1); cut(t, b, bi, rr, depth + 1); return; }
      } else {
        let bi = -1, bv = Infinity;
        for (let r = t + Math.floor((b - t) * 0.3); r < t + Math.ceil((b - t) * 0.7); r++) { const v = rowCount(r); if (v < bv) { bv = v; bi = r; } }
        if (bi > t && bi < b) { cut(t, bi, l, rr, depth + 1); cut(bi, b, l, rr, depth + 1); return; }
      }
    }
    for (let r = t; r < b; r++) for (let c = l; c < rr; c++) if (on(r, c)) out.set(r * g.cols + c, zone);
    zone++;
  };

  cut(0, g.rows, 0, g.cols, 0);
  return out;
}

// I PASSAGGI — il filo che va da un pallino al successivo, piccolo e coperto il piu' possibile (R16-R21).
//
// Due strade per ogni giuntura, si sceglie la meno vista:
//  - dritto dall'uscita dell'uno all'ingresso dell'altro;
//  - DENTRO il pallino appena cucito (li' il filo sta sopra un cordoncino della sua stessa tinta) fino al bordo che
//    guarda il prossimo, e poi, passato il vuoto, SOTTO il prossimo (che lo coprira').
// In vista, sul fondo, resta soltanto il vuoto fra i due.
import type { Point } from '@rg/core';
import { dentro } from './pallino';
import type { Griglia } from './geo';
import type { ParametriRazza, Tondino } from './tipi';

/** Dove si trova il bordo del pallino lungo il raggio dal centro nella direzione (dx,dy). */
export function bordoLungo(t: Tondino, dx: number, dy: number, profilo: number): number {
  let lo = 0, hi = t.a * 1.05;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (dentro(t, t.cx + dx * m, t.cy + dy * m, profilo)) lo = m; else hi = m; }
  return lo;
}

/** Quanto di un tratto sta sul fondo (in vista) e quanto sopra il gia' cucito. */
export function vistaSopra(par: ParametriRazza, gr: Griglia, ord: Tondino[], da: number, pts: Point[], passo = 0.05): { vista: number; sopra: number; tot: number } {
  let vista = 0, sopra = 0, tot = 0;
  const raggio = Math.max(par.diamMaxMm, ...ord.filter((o) => o.fisso).map((o) => 2 * o.a));
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(d / passo));
    tot += d;
    for (let q = 0; q < m; q++) {
      const x = a.x + ((b.x - a.x) * (q + 0.5)) / m, y = a.y + ((b.y - a.y) * (q + 0.5)) / m;
      let so = false, sp = false;
      for (const j of gr.vicini(x, y, raggio)) { if (!dentro(ord[j], x, y, par.profilo)) continue; if (j > da) so = true; else sp = true; }
      const l = d / m;
      if (!so) { if (sp) sopra += l; else vista += l; }
    }
  }
  return { vista, sopra, tot };
}

/** Il punto in piu' (o nessuno) del passaggio fra l'uscita E del pallino `da` e l'ingresso N del pallino `verso`. */
export function viaPassaggio(par: ParametriRazza, gr: Griglia, ord: Tondino[], da: number, verso: number, E: Point, N: Point): Point[] {
  if (par.modoPassaggio === 'diretto') return [];
  const P = ord[da], C = ord[verso];
  const L = Math.hypot(C.cx - P.cx, C.cy - P.cy) || 1;
  const dx = (C.cx - P.cx) / L, dy = (C.cy - P.cy) / L;
  const t = Math.max(0, bordoLungo(P, dx, dy, par.profilo) - 0.2);
  const W1 = { x: P.cx + dx * t, y: P.cy + dy * t };
  if (par.modoPassaggio === 'dentro') return [W1];
  const a = vistaSopra(par, gr, ord, da, [E, N], 0.1), b = vistaSopra(par, gr, ord, da, [E, W1, N], 0.1);
  const costo = (m: { vista: number; sopra: number }): number => 10 * m.vista + par.pesoSopra * m.sopra;
  return costo(b) < costo(a) - 1e-6 ? [W1] : [];
}

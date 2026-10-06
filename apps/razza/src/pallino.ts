// IL PALLINO — un cordoncino che parte piccolo, cresce al centro e torna piccolo (decisione di Lorenzo,
// 2026-10-06). Zig-zag perpendicolare all'asse, una riga ogni `densitySpacingMm`, largo quanto dice il profilo
// ma mai meno del minimo: nessun punto sotto `minStitchMm` (R3), neppure dopo l'arrotondamento del DST.
import type { Point } from '@rg/core';
import type { ParametriRazza, Tondino } from './tipi';

/** Il DST porta le coordinate a 0,1 mm: due punti da 0,80 possono diventare 0,72. */
export const GRIGLIA_DST_MM = 0.1;

/**
 * Si progetta con un margine di 1,5 passi di griglia, cosi' il minimo tiene anche DOPO l'arrotondamento (trovato
 * rileggendo i DST: min 0,72 invece di 0,80). La stessa cosa vale per il centraggio del file: va sulla griglia.
 */
export function larghezzaMinima(par: ParametriRazza): number { return par.minStitchMm + 1.5 * GRIGLIA_DST_MM; }

export const sullaGriglia = (v: number): number => Math.round(v / GRIGLIA_DST_MM) * GRIGLIA_DST_MM;
export const puntoSullaGriglia = (p: Point): Point => ({ x: sullaGriglia(p.x), y: sullaGriglia(p.y) });

/** Mezza larghezza del cordoncino alla distanza `s` dal centro, lungo l'asse. */
export function mezzaLarghezza(t: Tondino, s: number, profilo: number): number {
  const u = Math.min(1, Math.abs(s) / t.a);
  return t.b * Math.pow(Math.max(0, 1 - Math.pow(u, profilo)), 1 / profilo);
}

/** Il diametro piu' piccolo che puo' ancora avere un corpo sopra il punto minimo. */
export function diametroMinimoPossibile(par: ParametriRazza): number {
  return (larghezzaMinima(par) * 1.5) / Math.max(0.1, par.aspetto);
}

export function creaTondino(cx: number, cy: number, diam: number, par: ParametriRazza, ang: number, fisso = false): Tondino | null {
  const a = diam / 2, b = a * par.aspetto;
  const larghMin = larghezzaMinima(par);
  if (2 * b < larghMin * 1.5) return null; // troppo stretto per avere un corpo sopra il minimo
  const rapporto = larghMin / (2 * b);
  const s0 = a * Math.pow(1 - Math.pow(rapporto, par.profilo), 1 / par.profilo);
  const t: Tondino = { cx, cy, a, b, ang, cos: Math.cos(ang), sin: Math.sin(ang), s0 };
  if (fisso) t.fisso = true;
  return t;
}

export function ruota(t: Tondino, ang: number): void { t.ang = ang; t.cos = Math.cos(ang); t.sin = Math.sin(ang); }

/** Il punto sta dentro il pallino cucito? */
export function dentro(t: Tondino, x: number, y: number, profilo: number): boolean {
  const dx = x - t.cx, dy = y - t.cy;
  const u = dx * t.cos + dy * t.sin, v = -dx * t.sin + dy * t.cos;
  if (Math.abs(u) > t.s0) return false;
  return Math.abs(v) <= mezzaLarghezza(t, u, profilo);
}

/** L'area cucita del pallino (integrando il profilo). */
export function areaTondino(t: Tondino, profilo: number): number {
  let ar = 0; const N = 40;
  for (let k = 0; k < N; k++) { const s = -t.s0 + (2 * t.s0 * (k + 0.5)) / N; ar += 2 * mezzaLarghezza(t, s, profilo) * ((2 * t.s0) / N); }
  return ar;
}

/**
 * I punti del cordoncino: zig-zag fra i due lati, uno per riga, dal capo `-s0` al capo `+s0` (o all'inverso con
 * `inverso`; `speculare` parte dall'altro lato). Le righe sono equidistanti e mai piu' larghe di `densitySpacingMm`,
 * cosi' i due capi cadono esatti.
 */
export function puntiCordoncino(t: Tondino, par: ParametriRazza, inverso: boolean, speculare: boolean): Point[] {
  const righe = Math.max(3, Math.ceil((2 * t.s0) / par.densitySpacingMm) + 1);
  const out: Point[] = [];
  for (let k = 0; k < righe; k++) {
    const s = -t.s0 + (2 * t.s0 * k) / (righe - 1);
    const hw = Math.max(larghezzaMinima(par) / 2, mezzaLarghezza(t, s, par.profilo));
    const lato = (k % 2 === 0 ? 1 : -1) * (speculare ? -1 : 1);
    const v = lato * hw;
    out.push({ x: t.cx + s * t.cos - v * t.sin, y: t.cy + s * t.sin + v * t.cos });
  }
  return inverso ? out.reverse() : out;
}

/** Il vuoto fra i bordi di due pallini: il passaggio che li collega, almeno. */
export const vuotoFra = (a: Tondino, b: Tondino): number => Math.max(0, Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.a - b.a);

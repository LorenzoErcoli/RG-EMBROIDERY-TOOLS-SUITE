import type { Piano } from './pianificatore';
import type { Point } from '@rg/core';

export interface VerificaPiano {
  pezziMancanti: number; pezziDuplicati: number; precedenzeInvertite: number;
  passaggioScopertoMm: number; puntiSotto1Mm: number;
  prontoPerSwatch: boolean;
}
/** Verifica indipendente dall'instradatore: misura i segmenti macchina contro
 * il ricamo che compare DOPO di loro nella sequenza effettivamente emessa.
 * Non usa il campo coperture, né il costo della ricerca, né la maschera colore.
 */
export function verificaPiano(piano: Piano, tolleranzaMm = 0.25): VerificaPiano {
  const rnd = (p: Point): Point => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
  interface Seg { a: Point; b: Point; when: number; col: number }
  const bins = new Map<string, Seg[]>(), BIN = 2;
  const pos = new Map<number, number>(), counts = new Map<number, number>();
  piano.operazioni.forEach((o, when) => {
    if (o.tipo !== 'ricamo') return;
    if (o.pezzo !== undefined) { pos.set(o.pezzo, when); counts.set(o.pezzo, (counts.get(o.pezzo) ?? 0) + 1); }
    for (let i = 1; i < o.punti.length; i++) {
      const a = rnd(o.punti[i - 1]), b = rnd(o.punti[i]), s = { a, b, when, col: o.colore };
      for (let y = Math.floor((Math.min(a.y,b.y) - tolleranzaMm) / BIN); y <= Math.floor((Math.max(a.y,b.y) + tolleranzaMm) / BIN); y++)
        for (let x = Math.floor((Math.min(a.x,b.x) - tolleranzaMm) / BIN); x <= Math.floor((Math.max(a.x,b.x) + tolleranzaMm) / BIN); x++) {
          const key = `${x},${y}`, list = bins.get(key) ?? []; list.push(s); bins.set(key, list);
        }
    }
  });
  const vicino = (p: Point, s: Seg): boolean => {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - s.a.x - t * dx, p.y - s.a.y - t * dy) <= tolleranzaMm + 1e-8;
  };
  let scoperto = 0;
  piano.operazioni.forEach((o, when) => {
    if (o.tipo !== 'passaggio') return;
    for (let i = 1; i < o.punti.length; i++) {
      const a = rnd(o.punti[i - 1]), b = rnd(o.punti[i]), d = Math.hypot(a.x-b.x,a.y-b.y), n = Math.max(1,Math.ceil(d / 0.1));
      for (let k = 0; k < n; k++) {
        const p = { x: a.x + (b.x-a.x) * (k+0.5)/n, y: a.y+(b.y-a.y)*(k+0.5)/n };
        const list = bins.get(`${Math.floor(p.x/BIN)},${Math.floor(p.y/BIN)}`) ?? [];
        const futuro = list.some(s => s.when > when && s.col === o.colore && vicino(p,s));
        const sormonto = list.some(s => s.when > when && s.col > o.colore && vicino(p,s)) && list.some(s => s.col === o.colore && vicino(p,s));
        if (!futuro && !sormonto) scoperto += d / n;
      }
    }
  });
  const missing = piano.pezzi.filter((_, i) => !counts.has(i)).length;
  const dup = [...counts.values()].filter(n => n !== 1).length;
  const inverted = piano.precedenze.filter(([a,b]) => (pos.get(a) ?? Infinity) >= (pos.get(b) ?? -Infinity)).length;
  let corti = 0;
  for (const path of piano.paths) for (let i = 1; i < path.points_mm.length; i++) {
    const a = path.points_mm[i-1], b = path.points_mm[i], d = Math.hypot(a[0]-b[0],a[1]-b[1]);
    if (d > 0.001 && d < 0.999) corti++;
  }
  return { pezziMancanti: missing, pezziDuplicati: dup, precedenzeInvertite: inverted,
    passaggioScopertoMm: scoperto, puntiSotto1Mm: corti,
    prontoPerSwatch: missing === 0 && dup === 0 && inverted === 0 && scoperto < 1e-6 && corti === 0 };
}

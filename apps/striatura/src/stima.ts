// I VALORI DA UN DST (Lorenzo, 2026-11-20: «dammi la possibilità di inserire i valori a partire da un dst»). Da una striatura già
// cucita, anche fatta con un'altra versione del tool o senza i parametri nel file, si risale alle misure guardando i punti: un livello
// per ogni ago che contiene striatura. La variante (la disposizione esatta) non si ritrova: con questi valori viene lo stesso aspetto.
// Tarato il 2026-11-20 su due stop di un pannello vero e sul motore: grandezza 22 → trattini di 17 mm (mediana), 18 → 14, 10 → 7,5,
// 9 → 7, 8 → 6.
import type { Point, Polyline } from '@rg/core';
import { defaultStriaturaParams, generateStriatura, type StriaturaParams } from './engine';

/** Quello che si è ricavato da un ago. */
export interface StimaLivello {
  ago: number;
  punti: number;
  trattini: number;
  /** I valori da mettere nei campi del primo livello (per il secondo si rinominano). */
  valori: Pick<StriaturaParams, 'maxStitchMm' | 'minStitchMm' | 'travelStitchMm' | 'densitySpacingMm' | 'blobSizeMm' | 'blobSpacingMm' | 'striaturaLengthMm' | 'stitchMode'>;
}

/** Il blocco di un DST letto (`readDst`): l'ago e i punti in mm. */
export interface BloccoLetto { needle: number; points_mm: Array<[number, number]>; }

const quantile = (a: number[], f: number): number => {
  if (!a.length) return 0;
  const s = a.slice().sort((p, q) => p - q);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(f * s.length)))];
};
const moda = (a: number[], passo: number): number => {
  const c = new Map<number, number>();
  for (const v of a) { const k = Math.round(v / passo); c.set(k, (c.get(k) ?? 0) + 1); }
  let m = 0, n = -1;
  for (const [k, v] of c) if (v > n) { n = v; m = k; }
  return m * passo;
};
const arrotonda = (v: number, passo: number) => +(Math.round(v / passo) * passo).toFixed(2);

// dalla grandezza al trattino tipico (mediana), come lo fa il motore con i valori di serie: sotto 22 mm il trattino si accorcia
const TRATTINO_SU_GRANDEZZA = 0.78;
// le distanze fra le macchie provate per la copertura
const DISTANZE_DA_PROVARE = [2, 3, 4, 5, 6, 8, 10, 13];

/**
 * Ricava i valori, un livello per ogni ago che contiene striatura (trattini dritti, su e giù). `simula` serve solo alla distanza fra le
 * macchie: di serie rigenera col motore su un rettangolo della stessa misura (qualche secondo); i test la possono togliere.
 */
export function stimaDaDst(blocchi: BloccoLetto[], opz: { simula?: boolean } = {}): StimaLivello[] {
  const perAgo = new Map<number, Polyline[]>();
  for (const b of blocchi) {
    if (b.points_mm.length < 2) continue;
    const v = perAgo.get(b.needle) ?? [];
    v.push(b.points_mm.map(([x, y]) => ({ x, y })));
    perAgo.set(b.needle, v);
  }
  const fuori: StimaLivello[] = [];
  for (const [ago, pls] of [...perAgo.entries()].sort((a, b) => a[0] - b[0])) {
    const s = stimaLivello(pls, opz.simula !== false);
    if (s) fuori.push({ ago, ...s });
  }
  return fuori;
}

interface Tratto { x: number; y0: number; y1: number; suEGiu: boolean; }

function stimaLivello(pls: Polyline[], simula: boolean): Omit<StimaLivello, 'ago'> | null {
  const verticali: number[] = [], altri: number[] = [];
  const tratti: Tratto[] = [];
  let punti = 0, lungVerticale = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pls) {
    punti += p.length;
    for (const q of p) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    let i = 0;
    while (i < p.length - 1) {
      const a = p[i], b = p[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < 1e-6) { i++; continue; }
      if (Math.abs(b.x - a.x) > 0.005) { altri.push(L); i++; continue; }
      // un tratto verticale: tutti i passi di fila sulla stessa colonna
      let j = i, lo = a.y, hi = a.y, su = false, giu = false;
      while (j < p.length - 1 && Math.abs(p[j + 1].x - p[j].x) <= 0.005) {
        const d = Math.abs(p[j + 1].y - p[j].y);
        if (d > 1e-6) { verticali.push(d); lungVerticale += d; if (p[j + 1].y > p[j].y) su = true; else giu = true; }
        lo = Math.min(lo, p[j + 1].y); hi = Math.max(hi, p[j + 1].y); j++;
      }
      tratti.push({ x: a.x, y0: lo, y1: hi, suEGiu: su && giu });
      i = j;
    }
  }
  const trattini = tratti.filter((t) => t.y1 - t.y0 > 0.5 && t.suEGiu);
  // striatura = tanti trattini che vanno su e giù; un raso o un contorno non lo è
  if (trattini.length < 20 || verticali.length < altri.length) return null;

  const maxStitchMm = Math.max(0.5, arrotonda(quantile(verticali, 0.97), 0.1));
  const tutti = verticali.concat(altri);
  // il punto minimo: sotto ci sono pochissimi punti (le punte e i capi, che il minimo non tocca). Sui due stop veri: 1,2
  const minStitchMm = Math.max(0.2, arrotonda(quantile(tutti, 0.01), 0.1));
  const travelStitchMm = altri.length ? Math.max(minStitchMm, arrotonda(quantile(altri, 0.95), 0.5)) : defaultStriaturaParams.travelStitchMm;
  // la distanza fra colonne vicine, la più frequente
  const colonne = [...new Set(trattini.map((t) => Math.round(t.x * 100) / 100))].sort((a, b) => a - b);
  const salti = colonne.slice(1).map((x, k) => x - colonne[k]).filter((d) => d >= 0.2 && d <= 1.5);
  const densitySpacingMm = salti.length ? arrotonda(moda(salti, 0.05), 0.05) : defaultStriaturaParams.densitySpacingMm;
  // la grandezza dal trattino tipico; sopra i 22 mm il trattino non cresce più (lo tiene la lunghezza massima)
  const alti = trattini.map((t) => t.y1 - t.y0);
  const mediana = quantile(alti, 0.5);
  const blobSizeMm = Math.max(2, Math.round(mediana / TRATTINO_SU_GRANDEZZA));
  const striaturaLengthMm = blobSizeMm >= 22 ? Math.max(4, Math.round(quantile(alti, 0.9) - 4)) : defaultStriaturaParams.striaturaLengthMm;

  const valori: StimaLivello['valori'] = {
    maxStitchMm, minStitchMm, travelStitchMm, densitySpacingMm, blobSizeMm, striaturaLengthMm,
    blobSpacingMm: defaultStriaturaParams.blobSpacingMm, stitchMode: 'retrace',
  };
  // la distanza fra le macchie dalla copertura: quanta striatura per mm² cuce il motore con ogni distanza, sullo stesso rettangolo
  if (simula && x1 > x0 && y1 > y0) {
    const area = (x1 - x0) * (y1 - y0);
    const vera = lungVerticale / area;
    // la copertura è per mm²: basta un pezzo fino a 150 × 150 mm, così il calcolo resta di pochi secondi
    const w = Math.min(150, x1 - x0), h = Math.min(150, y1 - y0);
    const rett: Point[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    const areaProva = w * h;
    let meglio = valori.blobSpacingMm, scarto = Infinity;
    for (const s of DISTANZE_DA_PROVARE) {
      const g = generateStriatura({ outline: rett, voids: [] }, { ...defaultStriaturaParams, ...valori, blobSpacingMm: s })[0];
      let l = 0;
      for (const pl of g.polylines) for (let k = 1; k < pl.length; k++) if (Math.abs(pl[k].x - pl[k - 1].x) <= 0.005) l += Math.abs(pl[k].y - pl[k - 1].y);
      const d = Math.abs(Math.log((l / areaProva) / vera));
      if (d < scarto) { scarto = d; meglio = s; }
    }
    valori.blobSpacingMm = meglio;
  }
  return { punti, trattini: trattini.length, valori };
}

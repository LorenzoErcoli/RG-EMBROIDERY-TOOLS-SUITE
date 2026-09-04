// LA MISURA. È il punto 1 del piano: «se quella misura non regge, il tool non sta in piedi e va
// saputo subito».
//
// Tre domande, tre misure, tutte in millimetri reali:
//
// 1. **Copertura** — quanto filo cade in ogni cella di una griglia. Un riempimento a righe
//    parallele a passo `s` mette 1/s millimetri di filo per mm²; se il riempimento curvo si
//    scosta da quel valore, lì il ricamo è più rado (si vede il tessuto) o più fitto (ingrossa e
//    tira, R23). La misura che conta non è la media — è la **dispersione**.
// 2. **Distanza fra file vicine** — per ogni punto, quanto dista la fila *diversa* più vicina.
//    È la stessa grandezza vista dall'altra parte: la copertura dice l'effetto, questa dice la
//    causa, e si legge come un intervallo [min, max] da dichiarare (§7 del briefing).
// 3. **Contenimento** — niente fuori dalla regione, niente dentro i vuoti (R5).
//
// Le celle di bordo sono ESCLUSE dalla copertura, e non è un trucco: una cella tagliata a metà dal
// contorno contiene metà filo per ragioni geometriche, non di densità. Contarla misurerebbe la
// forma, non il riempimento. Il bordo si giudica col contenimento, che è la domanda giusta per lui.

import { type Point, type Polyline } from '@rg/core';
import { type Region, regionRings, insideRegion, regionBounds, BoundaryIndex } from './region';

export interface CoverageStats {
  /** Celle interne considerate (le celle di bordo non entrano). */
  cells: number;
  cellMm: number;
  /** Filo per mm² atteso da un riempimento a passo `spacingMm`: vale 1/spacing. */
  nominale: number;
  media: number;
  /** Scarto relativo: deviazione standard / media. È **la** cifra. */
  cv: number;
  p05: number; p50: number; p95: number; min: number; max: number;
  /** Frazione di celle che si scostano dal nominale di più del ±20%. */
  fuoriBanda: number;
}

const percentile = (ordinati: number[], q: number): number => {
  if (!ordinati.length) return 0;
  const i = Math.min(ordinati.length - 1, Math.max(0, Math.round(q * (ordinati.length - 1))));
  return ordinati[i];
};

/**
 * Filo per mm² cella per cella. `cellMm` va scelto **più grande del passo** (almeno 3-4 volte),
 * altrimenti si misura la posizione delle singole file invece della densità.
 */
export function coverageStats(
  runs: Polyline[], region: Region, spacingMm: number, cellMm = Math.max(2, spacingMm * 5),
): CoverageStats {
  const bb = regionBounds(region);
  const nx = Math.max(1, Math.ceil((bb.maxX - bb.minX) / cellMm));
  const ny = Math.max(1, Math.ceil((bb.maxY - bb.minY) / cellMm));
  const index = new BoundaryIndex(regionRings(region), Math.max(2, cellMm));

  // quali celle contano: centro dentro la regione e interamente lontane dal bordo
  const buona = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = { x: bb.minX + (i + 0.5) * cellMm, y: bb.minY + (j + 0.5) * cellMm };
      if (!insideRegion(c, region)) continue;
      if (index.nearest(c).distMm < cellMm * 0.75) continue;
      buona[j * nx + i] = 1;
    }
  }

  const filo = new Float64Array(nx * ny);
  const pezzo = cellMm / 4;
  for (const run of runs) {
    for (let k = 1; k < run.length; k++) {
      const a = run[k - 1], b = run[k];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-12) continue;
      const n = Math.max(1, Math.ceil(len / pezzo));
      const quota = len / n;
      for (let q = 0; q < n; q++) {
        const t = (q + 0.5) / n;
        const mx = a.x + (b.x - a.x) * t, my = a.y + (b.y - a.y) * t;
        const i = Math.floor((mx - bb.minX) / cellMm), j = Math.floor((my - bb.minY) / cellMm);
        if (i < 0 || i >= nx || j < 0 || j >= ny) continue;
        filo[j * nx + i] += quota;
      }
    }
  }

  const dens: number[] = [];
  const area = cellMm * cellMm;
  for (let k = 0; k < nx * ny; k++) if (buona[k]) dens.push(filo[k] / area);
  const nominale = 1 / spacingMm;
  if (!dens.length) {
    return { cells: 0, cellMm, nominale, media: 0, cv: 0, p05: 0, p50: 0, p95: 0, min: 0, max: 0, fuoriBanda: 1 };
  }
  const media = dens.reduce((s, v) => s + v, 0) / dens.length;
  const varianza = dens.reduce((s, v) => s + (v - media) * (v - media), 0) / dens.length;
  const ordinati = dens.slice().sort((p, q) => p - q);
  const fuori = dens.filter((v) => Math.abs(v - nominale) > 0.2 * nominale).length / dens.length;
  return {
    cells: dens.length, cellMm, nominale, media,
    cv: media > 0 ? Math.sqrt(varianza) / media : 0,
    p05: percentile(ordinati, 0.05), p50: percentile(ordinati, 0.5), p95: percentile(ordinati, 0.95),
    min: ordinati[0], max: ordinati[ordinati.length - 1],
    fuoriBanda: fuori,
  };
}

export interface SpacingStats {
  campioni: number;
  min: number; p05: number; p50: number; p95: number; max: number;
  /** Quota di punti più vicini a un'altra fila di metà del passo chiesto: il filo che si accavalla. */
  quotaSottoMezzoPasso: number;
}

/** Su quali punti misurare: tutti, solo i **capi** delle file, o solo il **corpo**. */
export type QualiPunti = 'tutti' | 'capi' | 'corpo';

/**
 * I segmenti di tutte le corse, indicizzati a celle, ciascuno con la corsa da cui viene.
 *
 * Serve perché la distanza fra due file **non** è la distanza fra i loro punti: col punto massimo a
 * 3 mm (R4) due file parallele a 0,4 mm di distanza hanno punti che distano fino a 1,5 mm *lungo*
 * la fila, e una misura punto-a-punto lo scambierebbe per un buco. Misurato: sul raso del core,
 * dove il passo è 0,4 per costruzione, la misura punto-a-punto dava un p95 di 0,90 mm. Si misura
 * dal punto al **segmento**.
 */
class SegmentIndex {
  private readonly cell: number;
  private readonly map = new Map<number, number[]>();
  private readonly ax: number[] = []; private readonly ay: number[] = [];
  private readonly bx: number[] = []; private readonly by: number[] = [];
  private readonly owner: number[] = [];

  constructor(runs: Polyline[], cellMm: number) {
    this.cell = Math.max(cellMm, 1e-3);
    runs.forEach((run, r) => {
      for (let i = 1; i < run.length; i++) this.add(run[i - 1], run[i], r);
    });
  }

  private key(ix: number, iy: number): number { return (ix + 1048576) * 2097152 + (iy + 1048576); }

  private add(a: Point, b: Point, r: number): void {
    const idx = this.ax.length;
    this.ax.push(a.x); this.ay.push(a.y); this.bx.push(b.x); this.by.push(b.y); this.owner.push(r);
    const i0 = Math.floor(Math.min(a.x, b.x) / this.cell), i1 = Math.floor(Math.max(a.x, b.x) / this.cell);
    const j0 = Math.floor(Math.min(a.y, b.y) / this.cell), j1 = Math.floor(Math.max(a.y, b.y) / this.cell);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = this.key(i, j);
        const bucket = this.map.get(k);
        if (bucket) bucket.push(idx); else this.map.set(k, [idx]);
      }
    }
  }

  /** Distanza dal segmento più vicino che NON appartiene alla corsa `escludi`. */
  nearestOther(p: Point, escludi: number, maxRaggio = 12): number {
    const ix = Math.floor(p.x / this.cell), iy = Math.floor(p.y / this.cell);
    let best = Infinity;
    for (let r = 0; r <= maxRaggio; r++) {
      if (best < Infinity && best <= (r - 1) * this.cell) break;
      for (let j = iy - r; j <= iy + r; j++) {
        for (let i = ix - r; i <= ix + r; i++) {
          if (r > 0 && Math.abs(j - iy) !== r && Math.abs(i - ix) !== r) continue;
          const bucket = this.map.get(this.key(i, j));
          if (!bucket) continue;
          for (const q of bucket) {
            if (this.owner[q] === escludi) continue;
            const dx = this.bx[q] - this.ax[q], dy = this.by[q] - this.ay[q];
            const len2 = dx * dx + dy * dy;
            let t = len2 > 0 ? ((p.x - this.ax[q]) * dx + (p.y - this.ay[q]) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = this.ax[q] + dx * t, qy = this.ay[q] + dy * t;
            const d = Math.hypot(p.x - qx, p.y - qy);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }
}

/**
 * Per ogni punto di ogni corsa, la distanza dalla corsa **diversa** più vicina.
 * Con le righe parallele deve dare il passo, ovunque; è quella la pietra di paragone.
 */
export function neighbourSpacing(
  runs: Polyline[], spacingMm: number, quali: QualiPunti = 'tutti',
): SpacingStats {
  const index = new SegmentIndex(runs, Math.max(spacingMm * 2, 0.5));
  const dist: number[] = [];
  runs.forEach((run, r) => {
    for (let k = 0; k < run.length; k++) {
      const capo = k === 0 || k === run.length - 1;
      if (quali === 'capi' && !capo) continue;
      if (quali === 'corpo' && capo) continue;
      const d = index.nearestOther(run[k], r);
      if (Number.isFinite(d)) dist.push(d);
    }
  });
  if (!dist.length) return { campioni: 0, min: 0, p05: 0, p50: 0, p95: 0, max: 0, quotaSottoMezzoPasso: 0 };
  const ord = dist.slice().sort((a, b) => a - b);
  return {
    campioni: ord.length,
    min: ord[0], p05: percentile(ord, 0.05), p50: percentile(ord, 0.5),
    p95: percentile(ord, 0.95), max: ord[ord.length - 1],
    quotaSottoMezzoPasso: ord.filter((v) => v < spacingMm * 0.5).length / ord.length,
  };
}

export interface ContainmentStats {
  punti: number;
  /** Punti fuori dalla regione di più della tolleranza: quelli *sul* bordo non contano. */
  fuori: number;
  /** Quanto è uscito il punto più fuori di tutti, in mm. */
  fuoriMaxMm: number;
  /** Punti dentro un vuoto oltre la tolleranza (R5). */
  neiVuoti: number;
  /** Quanto è entrato nel vuoto il punto più dentro di tutti, in mm. */
  vuotoMaxMm: number;
}

/**
 * Un punto **sul** bordo non è un punto fuori: il riempimento ci deve arrivare, e l'aritmetica in
 * virgola mobile lo mette da una parte o dall'altra a caso. Si conta fuori solo chi esce di più di
 * `tolleranzaMm`, e si dice **di quanto** — che è la domanda vera.
 */
export function containment(runs: Polyline[], region: Region, tolleranzaMm = 0.05): ContainmentStats {
  const index = new BoundaryIndex(regionRings(region), 4);
  let punti = 0, fuori = 0, fuoriMaxMm = 0, neiVuoti = 0, vuotoMaxMm = 0;
  for (const run of runs) {
    for (const p of run) {
      punti++;
      if (insideRegion(p, region)) continue;
      const d = index.nearest(p).distMm;
      if (d > tolleranzaMm) fuori++;
      if (d > fuoriMaxMm) fuoriMaxMm = d;
      for (const h of region.holes) {
        if (!dentroAnello(p, h)) continue;
        if (d > tolleranzaMm) neiVuoti++;
        if (d > vuotoMaxMm) vuotoMaxMm = d;
        break;
      }
    }
  }
  return { punti, fuori, fuoriMaxMm, neiVuoti, vuotoMaxMm };
}

function dentroAnello(p: Point, ring: Polyline): boolean {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

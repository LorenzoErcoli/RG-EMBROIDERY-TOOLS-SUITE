// Il CAMPO DI DIREZIONE: da dove il punto prende l'orientamento (§4.1 del briefing).
//
// È un campo di **direzioni**, non di vettori: al punto non importa se va a destra o a sinistra,
// gli importa la retta su cui sta. Sommare direzioni come vettori è l'errore classico — 179° e
// −179° sono quasi la stessa direzione ma la loro media vettoriale è zero. Si lavora quindi
// sull'**angolo raddoppiato** (cos2θ, sin2θ), dove le due direzioni opposte coincidono; alla fine
// si dimezza. È la rappresentazione standard dei line field, ed è ciò che permette al campo di
// girare attorno a una forma senza ribaltarsi.
//
// Il campo AUTOMATICO è **armonico**: la direzione è fissata sul bordo (tangente al contorno) e
// dentro si risolve per il campo più liscio possibile — cioè si media coi vicini finché non si
// assesta. Fuori dalla regione il campo resta congelato sulla tangente del bordo più vicino, così
// campionarlo mentre una fila esce dalla forma non produce salti.
//
// Perché a cascata dal grossolano al fine: mediare coi vicini propaga l'informazione di una cella
// per passata, quindi su una griglia larga 200 celle servirebbero decine di migliaia di passate.
// Si risolve prima su una griglia 8 volte più larga (poche passate bastano), si usa quel risultato
// come punto di partenza per quella dopo, e così via. Stesso risultato, due ordini di grandezza in
// meno di lavoro.

import { type Point } from '@rg/core';
import { type Region, regionRings, regionBounds, insideRegion, BoundaryIndex } from './region';

/** Tutto ciò che il riempimento chiede a un campo: che direzione tenere qui. Versore. */
export interface DirectionField {
  dirAt(p: Point): Point;
}

export interface HarmonicFieldOptions {
  /** Lato della cella della griglia più fine, in mm. Default 1. */
  cellMm?: number;
  /** Quante griglie a cascata (la più grossolana ha cella `cellMm · 2^(levels-1)`). Default 4. */
  levels?: number;
  /** Passate di rilassamento per livello. Default 300. */
  sweeps?: number;
  /** Sotto questo scostamento massimo il livello è considerato assestato. Default 1e-5. */
  tol?: number;
}

interface Grid {
  nx: number; ny: number; cellMm: number; ox: number; oy: number;
  a: Float64Array; b: Float64Array; fixed: Uint8Array; inside: Uint8Array;
}

export interface HarmonicField extends DirectionField {
  /** Le passate effettivamente servite per livello: dice se il campo si è assestato o no. */
  sweepsUsed: number[];
  grid: Grid;
}

function buildGrid(region: Region, index: BoundaryIndex, cellMm: number, bandMm: number): Grid {
  const bb = regionBounds(region);
  const margin = cellMm * 2 + bandMm;
  const ox = bb.minX - margin, oy = bb.minY - margin;
  const nx = Math.max(3, Math.ceil((bb.maxX - bb.minX + 2 * margin) / cellMm) + 1);
  const ny = Math.max(3, Math.ceil((bb.maxY - bb.minY + 2 * margin) / cellMm) + 1);
  const g: Grid = {
    nx, ny, cellMm, ox, oy,
    a: new Float64Array(nx * ny), b: new Float64Array(nx * ny),
    fixed: new Uint8Array(nx * ny), inside: new Uint8Array(nx * ny),
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = { x: ox + i * cellMm, y: oy + j * cellMm };
      const k = j * nx + i;
      const ins = insideRegion(p, region);
      const nb = index.nearest(p);
      const th = Math.atan2(nb.tangent.y, nb.tangent.x);
      g.a[k] = Math.cos(2 * th);
      g.b[k] = Math.sin(2 * th);
      g.inside[k] = ins ? 1 : 0;
      // il bordo COMANDA: fuori, e in una fascia dentro, la direzione è quella del contorno
      g.fixed[k] = !ins || nb.distMm <= bandMm ? 1 : 0;
    }
  }
  return g;
}

/** Campiona (a,b) bilineare. Fuori griglia si aggrappa al bordo della griglia. */
function sampleAB(g: Grid, p: Point): [number, number] {
  const fx = (p.x - g.ox) / g.cellMm, fy = (p.y - g.oy) / g.cellMm;
  const i = Math.min(g.nx - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(g.ny - 2, Math.max(0, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j));
  const k00 = j * g.nx + i, k10 = k00 + 1, k01 = k00 + g.nx, k11 = k01 + 1;
  const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
  return [
    g.a[k00] * w00 + g.a[k10] * w10 + g.a[k01] * w01 + g.a[k11] * w11,
    g.b[k00] * w00 + g.b[k10] * w10 + g.b[k01] * w01 + g.b[k11] * w11,
  ];
}

/** Il livello fine parte dal risultato di quello grossolano: è tutto il guadagno della cascata. */
function seedFromCoarse(fine: Grid, coarse: Grid): void {
  for (let j = 0; j < fine.ny; j++) {
    for (let i = 0; i < fine.nx; i++) {
      const k = j * fine.nx + i;
      if (fine.fixed[k]) continue;
      const [a, b] = sampleAB(coarse, { x: fine.ox + i * fine.cellMm, y: fine.oy + j * fine.cellMm });
      const m = Math.hypot(a, b);
      if (m > 1e-9) { fine.a[k] = a / m; fine.b[k] = b / m; }
    }
  }
}

/** Media coi quattro vicini, in-place, finché non si assesta. Ritorna le passate servite. */
function relax(g: Grid, sweeps: number, tol: number): number {
  for (let s = 1; s <= sweeps; s++) {
    let maxDelta = 0;
    for (let j = 1; j < g.ny - 1; j++) {
      for (let i = 1; i < g.nx - 1; i++) {
        const k = j * g.nx + i;
        if (g.fixed[k]) continue;
        const a = (g.a[k - 1] + g.a[k + 1] + g.a[k - g.nx] + g.a[k + g.nx]) / 4;
        const b = (g.b[k - 1] + g.b[k + 1] + g.b[k - g.nx] + g.b[k + g.nx]) / 4;
        const m = Math.hypot(a, b);
        const na = m > 1e-9 ? a / m : g.a[k];
        const nb = m > 1e-9 ? b / m : g.b[k];
        const d = Math.abs(na - g.a[k]) + Math.abs(nb - g.b[k]);
        if (d > maxDelta) maxDelta = d;
        g.a[k] = na; g.b[k] = nb;
      }
    }
    if (maxDelta < tol) return s;
  }
  return sweeps;
}

/**
 * Il campo armonico della forma: tangente sul bordo, il più liscio possibile dentro.
 *
 * È il livello 1 dei tre di §4.1 — quello che «prova a capire da solo». I livelli 2 (gradiente
 * dell'immagine) e 3 (linee guida disegnate) si innestano qui cambiando le condizioni al bordo,
 * non il solutore.
 */
export function harmonicField(region: Region, opts: HarmonicFieldOptions = {}): HarmonicField {
  const cellMm = opts.cellMm && opts.cellMm > 0 ? opts.cellMm : 1;
  const levels = Math.max(1, Math.round(opts.levels ?? 4));
  const sweeps = Math.max(1, Math.round(opts.sweeps ?? 300));
  const tol = opts.tol ?? 1e-5;

  const index = new BoundaryIndex(regionRings(region), Math.max(2, cellMm * 4));
  const sweepsUsed: number[] = [];
  let grid: Grid | null = null;
  for (let l = levels - 1; l >= 0; l--) {
    const c = cellMm * Math.pow(2, l);
    const g = buildGrid(region, index, c, c * 1.2);
    if (grid) seedFromCoarse(g, grid);
    sweepsUsed.push(relax(g, sweeps, tol));
    grid = g;
  }
  const finale = grid as Grid;

  return {
    sweepsUsed,
    grid: finale,
    dirAt(p: Point): Point {
      const [a, b] = sampleAB(finale, p);
      if (Math.hypot(a, b) < 1e-9) return index.nearest(p).tangent;   // singolarità: si ripiega sul bordo
      const th = Math.atan2(b, a) / 2;
      return { x: Math.cos(th), y: Math.sin(th) };
    },
  };
}

/** Campo costante: è il raso a angolo fisso, il termine di paragone. */
export function constantField(angleDeg: number): DirectionField {
  const a = (angleDeg * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  return { dirAt: () => d };
}

/** Campo RADIALE attorno a un centro: il ventaglio che si apre. Direzione = raggio. */
export function radialField(center: Point): DirectionField {
  return {
    dirAt(p: Point): Point {
      const dx = p.x - center.x, dy = p.y - center.y;
      const m = Math.hypot(dx, dy);
      return m < 1e-9 ? { x: 1, y: 0 } : { x: dx / m, y: dy / m };
    },
  };
}

/** Campo CONCENTRICO attorno a un centro: direzione = tangente al cerchio. */
export function concentricField(center: Point): DirectionField {
  return {
    dirAt(p: Point): Point {
      const dx = p.x - center.x, dy = p.y - center.y;
      const m = Math.hypot(dx, dy);
      return m < 1e-9 ? { x: 1, y: 0 } : { x: -dy / m, y: dx / m };
    },
  };
}

/**
 * L'angolo MEDIO del campo dentro la regione, a periodo 180° (è una direzione, non un verso).
 * Serve a dare al riempimento rettilineo l'angolo che più gli somiglia: confrontarlo con un angolo
 * a caso sarebbe un confronto truccato.
 */
export function meanFieldAngleDeg(field: DirectionField, region: Region, stepMm = 2): number {
  const bb = regionBounds(region);
  let sa = 0, sb = 0;
  for (let y = bb.minY; y <= bb.maxY; y += stepMm) {
    for (let x = bb.minX; x <= bb.maxX; x += stepMm) {
      const p = { x, y };
      if (!insideRegion(p, region)) continue;
      const d = field.dirAt(p);
      const th = Math.atan2(d.y, d.x);
      sa += Math.cos(2 * th); sb += Math.sin(2 * th);
    }
  }
  if (Math.hypot(sa, sb) < 1e-12) return 0;
  return ((Math.atan2(sb, sa) / 2) * 180) / Math.PI;
}

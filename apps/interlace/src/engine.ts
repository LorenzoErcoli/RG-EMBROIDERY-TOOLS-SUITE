// Motore di riempimento "Interlace" — filo continuo di PASSAGGI BREVI che vagano
// in modo pseudo-casuale, riempiendo l'area in modo omogeneo con vortici organici.
// Locale all'app (regole di crescita 1-2): si promuove nel core solo quando un 2° tool lo chiederà.
//
// Vincoli di dominio:
// - nessun segmento entra in un'area vuota (void, R5) né esce dal bordo, con clearance (R5/R7);
// - ogni passo ha lunghezza in [minStitchMm, maxStitchMm] → punto minimo/massimo rispettati
//   per costruzione (R3 min-stitch è qui l'ultimo filtro, non essendoci un routing separato; R4);
// - il filo si disegna sottile (R15): lo spessore reale è nella densità dei passaggi, non nello stroke.
import {
  type Point, type Polyline,
  pointInPolygon, distanceToBoundary, segmentPolygonIntersections,
  polygonArea, bounds, distance,
} from '@rg/core';

/** Parametri del riempimento. App-locali finché non si promuovono nel core. Nomi canonici §3 dove esistono. */
export interface InterlaceParams {
  realWidthMm: number;       // §3.4 — larghezza reale della sagoma (0 = usa la misura letta)
  minStitchMm: number;       // §3.1 R3 — lunghezza minima del punto
  maxStitchMm: number;       // §3.1 R4 — lunghezza massima del punto
  densitySpacingMm: number;  // §3.7 R22 — spaziatura tra le file di filo (piccola = più coprente)
  voidClearanceMm: number;   // §3.2 R5/R7 — distanza minima da bordi e aree vuote
  seed: number;              // ripetibilità dell'anteprima
  // --- Palette (usata dalla pipeline, non dalla geometria) ---
  colors: string[];          // palette a numero variabile; l'ordine = ordine di rotazione lungo il filo
  paletteCycles: number;     // quante volte la palette gira lungo il tracciato → cambi-ago
}

export const defaultInterlaceParams: InterlaceParams = {
  realWidthMm: 0,
  minStitchMm: 6,
  maxStitchMm: 15,
  densitySpacingMm: 0.8,
  voidClearanceMm: 0.6,
  seed: 1,
  colors: ['#1f3a5f', '#c0392b', '#e0a41f', '#3b7d4f'],
  paletteCycles: 6,
};

// --- Costanti interne (implementazione, non parametri utente): il "movimento" del filo.
//     Diventeranno parametri di pannello quando decideremo i nomi (processo REVISIONE-PARAMETRI). ---
const FLOW_INFLUENCE = 0.2; // quanto il campo di flusso curva la camminata → vortici organici
const TURN_SPREAD = 2.2;    // ampiezza della virata casuale a ogni passo (sembra casuale)
const FLOW_FREQ = 0.02;     // scala del campo di flusso (nuvole più o meno grandi)
const SWIRL = 2.2;          // intensità di rotazione del campo
const CANDIDATES = 16;      // candidati valutati a ogni passo (si sceglie la zona meno riempita)
const MAX_POINTS = 80000;   // guardia anti-runaway

// RNG deterministico (mulberry32): anteprima ripetibile a parità di seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rumore di valore → campo di flusso (angoli): dà la coerenza locale che crea nuvole/vortici.
function hash(i: number, j: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(x0, y0), n10 = hash(x0 + 1, y0), n01 = hash(x0, y0 + 1), n11 = hash(x0 + 1, y0 + 1);
  const a = n00 + (n10 - n00) * sx, b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

function angDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Genera il tracciato continuo che riempie `boundary` evitando i `voids`.
 *
 * Camminata "cerca-vuoti": passi brevi pseudo-casuali con vortici organici, ma quando la
 * zona locale ha già raggiunto la copertura obiettivo il filo **punta verso il vuoto più
 * vicino** (sempre a passi ≤ maxStitch, niente linee lunghe). Il riempimento **finisce
 * quando tutte le celle raggiungono la copertura**, non a lunghezza fissa: così l'omogeneità
 * NON dipende dalla lunghezza del punto (il punto corto ci mette solo più passi).
 *
 * Ritorna la polilinea (un solo filo). Vuota se non trova un punto d'avvio valido.
 */
export function generateFill(boundary: Polyline, voids: Polyline[], p: InterlaceParams): Point[] {
  if (boundary.length < 3) return [];
  const bb = bounds(boundary);
  const clear = Math.max(0, p.voidClearanceMm);
  const minS = Math.max(0.5, p.minStitchMm);
  const maxS = Math.max(minS + 0.1, p.maxStitchMm);
  const spacing = Math.max(0.1, p.densitySpacingMm);

  const inRegion = (pt: Point): boolean => {
    if (!pointInPolygon(pt, boundary)) return false;
    if (distanceToBoundary(pt, boundary) < clear) return false;
    for (const v of voids) {
      if (pointInPolygon(pt, v)) return false;
      if (distanceToBoundary(pt, v) < clear) return false;
    }
    return true;
  };
  // Un segmento è valido se non taglia bordo/vuoti e i suoi punti interni restano nell'area (con clearance).
  const segOk = (a: Point, b: Point): boolean => {
    if (segmentPolygonIntersections(a, b, boundary).length > 0) return false;
    for (const v of voids) if (segmentPolygonIntersections(a, b, v).length > 0) return false;
    for (let t = 0.2; t < 1; t += 0.2) {
      if (!inRegion({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  };

  // Griglia di copertura. `cell` ≈ spaziatura tra file → una cella "coperta" a `target` passaggi
  // equivale ad avere file di filo distanti ~spacing. Così la densità governa quanto è pieno.
  const cell = Math.max(maxS * 0.5, 1);
  const gx = Math.ceil((bb.maxX - bb.minX) / cell) + 1;
  const gy = Math.ceil((bb.maxY - bb.minY) / cell) + 1;
  const cov = new Float32Array(gx * gy);
  const target = Math.max(1, Math.round(cell / spacing)); // passaggi obiettivo per cella
  const cellX = (i: number) => bb.minX + (i + 0.5) * cell;
  const cellY = (j: number) => bb.minY + (j + 0.5) * cell;
  const ij = (pt: Point): [number, number] => [
    Math.min(gx - 1, Math.max(0, Math.floor((pt.x - bb.minX) / cell))),
    Math.min(gy - 1, Math.max(0, Math.floor((pt.y - bb.minY) / cell))),
  ];
  const idx = (i: number, j: number) => j * gx + i;

  // Maschera delle celle riempibili (centro dentro l'area): sono quelle che dobbiamo coprire.
  const fillable = new Uint8Array(gx * gy);
  let fillableCount = 0;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    if (inRegion({ x: cellX(i), y: cellY(j) })) { fillable[idx(i, j)] = 1; fillableCount++; }
  }
  if (fillableCount === 0) return [];

  let coveredCells = 0; // celle riempibili che hanno raggiunto `target`
  const stamp = (a: Point, b: Point): void => {
    const n = Math.max(1, Math.ceil(distance(a, b) / cell));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [i, j] = ij({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const id = idx(i, j);
      const before = cov[id];
      cov[id] = before + 1;
      if (fillable[id] && before < target && before + 1 >= target) coveredCells++;
    }
  };

  // Direzione verso la cella riempibile ancora scoperta più vicina (o null se non ce ne sono).
  const gapDir = (from: Point): Point | null => {
    const [ci0, cj0] = ij(from);
    let bestD = Infinity, bx = 0, by = 0, found = false;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const id = idx(i, j);
      if (!fillable[id] || cov[id] >= target) continue;
      const d = (i - ci0) * (i - ci0) + (j - cj0) * (j - cj0);
      if (d < bestD) { bestD = d; bx = cellX(i); by = cellY(j); found = true; }
    }
    if (!found) return null;
    const dx = bx - from.x, dy = by - from.y, m = Math.hypot(dx, dy) || 1;
    return { x: dx / m, y: dy / m };
  };

  const rng = mulberry32(p.seed || 1);
  const flowAng = (pt: Point): number => vnoise(pt.x * FLOW_FREQ, pt.y * FLOW_FREQ) * Math.PI * 2 * SWIRL;

  // Punto d'avvio valido.
  let start: Point | null = null;
  for (let tries = 0; tries < 4000 && !start; tries++) {
    const cand = { x: bb.minX + rng() * (bb.maxX - bb.minX), y: bb.minY + rng() * (bb.maxY - bb.minY) };
    if (inRegion(cand)) start = cand;
  }
  if (!start) return [];

  const pts: Point[] = [start];
  let c: Point = start;
  let dir = rng() * Math.PI * 2;
  let blocked = 0, stagnation = 0, lastCovered = 0, iter = 0;
  const MAX_ITER = fillableCount * 200 + 20000;

  // Finisce quando ~tutte le celle riempibili hanno raggiunto la copertura obiettivo.
  while (coveredCells < fillableCount * 0.985 && pts.length < MAX_POINTS && iter++ < MAX_ITER) {
    // Se la cella corrente è già coperta, punta verso il vuoto più vicino (a passi brevi).
    const [ci0, cj0] = ij(c);
    const saturated = cov[idx(ci0, cj0)] >= target;
    let head = dir;
    let spread = TURN_SPREAD;
    if (saturated) {
      const g = gapDir(c);
      if (g) { head = Math.atan2(g.y, g.x); spread = 1.0; } // vira deciso verso il vuoto
    }

    let best: { p: Point; ang: number } | null = null;
    let bestScore = -Infinity;
    const fdir = flowAng(c);
    for (let k = 0; k < CANDIDATES; k++) {
      const len = minS + rng() * (maxS - minS);
      let ang = head + (rng() * 2 - 1) * spread;      // virata (ampia se libero, decisa se cerca il vuoto)
      ang += FLOW_INFLUENCE * angDelta(ang, fdir);     // leggera coerenza → vortici organici
      const nb = { x: c.x + Math.cos(ang) * len, y: c.y + Math.sin(ang) * len };
      if (!inRegion(nb) || !segOk(c, nb)) continue;
      const [ni, nj] = ij(nb);
      const score = -cov[idx(ni, nj)] + rng() * 0.6;   // preferisci la cella meno piena
      if (score > bestScore) { bestScore = score; best = { p: nb, ang }; }
    }
    if (!best) {
      // Bloccato vicino a bordo/vuoto: gira secco e prova un passo corto. MAI un salto lungo.
      blocked++;
      dir += (rng() * 2 - 1) * 2.5;
      let esc: { p: Point; ang: number } | null = null;
      for (let k = 0; k < 24; k++) {
        const a = rng() * Math.PI * 2;
        const nb = { x: c.x + Math.cos(a) * minS, y: c.y + Math.sin(a) * minS };
        if (inRegion(nb) && segOk(c, nb)) { esc = { p: nb, ang: a }; break; }
      }
      if (!esc) { if (blocked > 800) break; continue; }
      best = esc;
    } else {
      blocked = 0;
    }
    stamp(c, best.p);
    pts.push(best.p);
    c = best.p;
    dir = best.ang;

    // Anti-stallo: se la copertura non avanza per molti passi, ci fermiamo (sacche irraggiungibili).
    if (coveredCells > lastCovered) { lastCovered = coveredCells; stagnation = 0; }
    else if (++stagnation > fillableCount + 2000) break;
  }
  return pts;
}

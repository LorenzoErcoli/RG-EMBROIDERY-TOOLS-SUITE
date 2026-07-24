// Motore di riempimento "Interlace" — filo continuo di PASSAGGI BREVI che vagano in modo
// pseudo-casuale, riempiendo l'area in modo omogeneo con vortici organici.
// Locale all'app (regole di crescita 1-2): si promuove nel core solo quando un 2° tool lo chiederà.
//
// Vincoli di dominio:
// - nessun segmento entra in un'area vuota (void, R5) né esce dal bordo, con clearance (R5/R7);
// - ogni passo ha lunghezza in [minStitchMm, maxStitchMm] → punto minimo/massimo rispettati (R3/R4);
// - il filo si disegna sottile (R15): lo spessore reale è nella densità dei passaggi, non nello stroke.
//
// PRESTAZIONI (cartamodelli con tante aree vuote): l'area ricamabile viene "disegnata" UNA volta
// in una maschera a griglia (dentro il bordo, fuori dai vuoti, clearance già incorporata via erosione).
// Poi ogni controllo del motore è una lettura O(1) nella maschera, INDIPENDENTE dal numero di vuoti —
// così un cartamodello con 60 lettere costa quanto uno con 2.
import {
  type Point, type Polyline,
  bounds, distance,
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
const MAX_POINTS = 200000;  // guardia anti-runaway
const MAX_MASK_CELLS = 4_000_000; // tetto memoria maschera fine

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

/** Riempie (even-odd, scanline) le celle il cui centro è dentro `poly`, mettendole a `value`. O(righe·lati). */
function fillPolygon(grid: Uint8Array, gw: number, gh: number, x0: number, y0: number, res: number, poly: Polyline, value: number): void {
  const m = poly.length;
  if (m < 3) return;
  const xs: number[] = [];
  for (let j = 0; j < gh; j++) {
    const y = y0 + (j + 0.5) * res;
    xs.length = 0;
    for (let k = 0; k < m; k++) {
      const a = poly[k], b = poly[(k + 1) % m];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let s = 0; s + 1 < xs.length; s += 2) {
      let i0 = Math.ceil((xs[s] - x0) / res - 0.5);
      let i1 = Math.floor((xs[s + 1] - x0) / res - 0.5);
      if (i0 < 0) i0 = 0;
      if (i1 > gw - 1) i1 = gw - 1;
      const row = j * gw;
      for (let i = i0; i <= i1; i++) grid[row + i] = value;
    }
  }
}

/** Maschera dell'area ricamabile + coordinate. `fillable[c]` = 1 se cucibile (clearance già incorporata). */
interface Mask {
  fillable: Uint8Array;
  gw: number; gh: number; x0: number; y0: number; res: number;
  at(x: number, y: number): boolean;
}

function buildMask(boundary: Polyline, voids: Polyline[], clear: number, res0: number): Mask {
  const bb = bounds(boundary);
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
  // Tetto memoria: se la griglia sarebbe troppo fine, allarga la cella.
  let res = res0;
  if ((w / res + 2) * (h / res + 2) > MAX_MASK_CELLS) res = Math.sqrt((w * h) / MAX_MASK_CELLS);
  const x0 = bb.minX - res, y0 = bb.minY - res;
  const gw = Math.ceil(w / res) + 3, gh = Math.ceil(h / res) + 3;
  const solid = new Uint8Array(gw * gh);
  fillPolygon(solid, gw, gh, x0, y0, res, boundary, 1); // dentro il bordo = 1
  for (const v of voids) fillPolygon(solid, gw, gh, x0, y0, res, v, 0); // scava i vuoti = 0

  // Erosione per la clearance: cucibile solo se dista ≥ (clear + margine) da qualsiasi cella non-solida
  // (bordo/vuoto). Il margine ~1.2·res copre la discretizzazione: un punto può cadere nell'angolo di una
  // cella cucibile, quindi la soglia extra garantisce che RESTI comunque dentro con la clearance richiesta.
  // Distance transform chamfer a 2 passate (obstacle = solid==0).
  const fillable = new Uint8Array(gw * gh);
  const erode = clear + 1.2 * res;
  const BIG = 1e9, diag = res * Math.SQRT2;
  const dist = new Float32Array(gw * gh);
  for (let c = 0; c < solid.length; c++) dist[c] = solid[c] ? BIG : 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i; if (dist[c] === 0) continue;
    if (i > 0 && dist[c - 1] + res < dist[c]) dist[c] = dist[c - 1] + res;
    if (j > 0 && dist[c - gw] + res < dist[c]) dist[c] = dist[c - gw] + res;
    if (i > 0 && j > 0 && dist[c - gw - 1] + diag < dist[c]) dist[c] = dist[c - gw - 1] + diag;
    if (i < gw - 1 && j > 0 && dist[c - gw + 1] + diag < dist[c]) dist[c] = dist[c - gw + 1] + diag;
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const c = j * gw + i; if (dist[c] === 0) continue;
    if (i < gw - 1 && dist[c + 1] + res < dist[c]) dist[c] = dist[c + 1] + res;
    if (j < gh - 1 && dist[c + gw] + res < dist[c]) dist[c] = dist[c + gw] + res;
    if (i < gw - 1 && j < gh - 1 && dist[c + gw + 1] + diag < dist[c]) dist[c] = dist[c + gw + 1] + diag;
    if (i > 0 && j < gh - 1 && dist[c + gw - 1] + diag < dist[c]) dist[c] = dist[c + gw - 1] + diag;
  }
  for (let c = 0; c < solid.length; c++) fillable[c] = solid[c] && dist[c] >= erode ? 1 : 0;

  return {
    fillable, gw, gh, x0, y0, res,
    at(x: number, y: number): boolean {
      const i = Math.floor((x - x0) / res), j = Math.floor((y - y0) / res);
      if (i < 0 || j < 0 || i >= gw || j >= gh) return false;
      return fillable[j * gw + i] === 1;
    },
  };
}

/**
 * Genera il tracciato continuo che riempie `boundary` evitando i `voids`.
 *
 * Camminata "cerca-vuoti": passi brevi pseudo-casuali con vortici organici; quando la zona locale
 * ha già raggiunto la copertura obiettivo il filo punta verso la zona meno coperta più vicina
 * (sempre a passi ≤ maxStitch). Finisce quando tutte le celle raggiungono la copertura: l'omogeneità
 * NON dipende dalla lunghezza del punto. Tutti i controlli di validità sono O(1) su una maschera.
 *
 * Ritorna una LISTA di tratti (polilinee): dentro un tratto il filo è continuo; tra un tratto e il
 * successivo c'è un salto a penna alzata (non disegnato) verso una nuova tasca scoperta — necessario
 * perché l'area ricamabile è spesso un labirinto (canali che girano attorno agli ostacoli) e un solo
 * filo continuo resterebbe intrappolato. Lista vuota se l'area ricamabile è nulla.
 */
export function generateFill(boundary: Polyline, voids: Polyline[], p: InterlaceParams): Point[][] {
  if (boundary.length < 3) return [];
  const clear = Math.max(0, p.voidClearanceMm);
  const minS = Math.max(0.5, p.minStitchMm);
  const maxS = Math.max(minS + 0.1, p.maxStitchMm);
  const spacing = Math.max(0.1, p.densitySpacingMm);

  // Maschera fine: risoluzione abbastanza fitta da cogliere clearance e canali stretti.
  const fineRes = Math.min(clear > 0 ? clear : 1, minS / 4, 1.2);
  const mask = buildMask(boundary, voids, clear, Math.max(0.4, fineRes));
  const inRegion = (x: number, y: number): boolean => mask.at(x, y);
  // Segmento valido = tutti i campioni (passo ~maschera) sono cucibili: nessun void/bordo attraversato.
  const segStep = mask.res * 0.9;
  const segOk = (ax: number, ay: number, bx: number, by: number): boolean => {
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(L / segStep));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!inRegion(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  };

  // Griglia di copertura. La cella è ~ della taglia del punto (mai più grande del punto minimo),
  // così la copertura viene tracciata in modo fedele anche in canali stretti.
  const bb = bounds(boundary);
  const cell = Math.max(1.5, Math.min(maxS * 0.5, minS));
  const gx = Math.ceil((bb.maxX - bb.minX) / cell) + 1;
  const gy = Math.ceil((bb.maxY - bb.minY) / cell) + 1;
  const cov = new Float32Array(gx * gy);
  const cfill = new Uint8Array(gx * gy); // celle grossolane cucibili (centro nella maschera)
  const target = Math.max(1, Math.round(cell / spacing));
  const cellX = (i: number) => bb.minX + (i + 0.5) * cell;
  const cellY = (j: number) => bb.minY + (j + 0.5) * cell;
  const ci = (x: number) => Math.min(gx - 1, Math.max(0, Math.floor((x - bb.minX) / cell)));
  const cj = (y: number) => Math.min(gy - 1, Math.max(0, Math.floor((y - bb.minY) / cell)));

  let fillableCount = 0;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    if (inRegion(cellX(i), cellY(j))) { cfill[j * gx + i] = 1; fillableCount++; }
  }
  if (fillableCount === 0) return [];

  let coveredCells = 0;
  const stamp = (ax: number, ay: number, bx: number, by: number): void => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / cell));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const id = cj(ay + (by - ay) * t) * gx + ci(ax + (bx - ax) * t);
      const before = cov[id];
      cov[id] = before + 1;
      if (cfill[id] && before < target && before + 1 >= target) coveredCells++;
    }
  };

  // Cella cucibile ancora scoperta più vicina (per lo steering e per la rilocazione). Salta le "morte".
  const dead = new Uint8Array(gx * gy);
  const nearestGap = (x: number, y: number): { x: number; y: number; id: number } | null => {
    const i0 = ci(x), j0 = cj(y);
    let bestD = Infinity, bx = 0, by = 0, bid = -1;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const id = j * gx + i;
      if (!cfill[id] || cov[id] >= target || dead[id]) continue;
      const d = (i - i0) * (i - i0) + (j - j0) * (j - j0);
      if (d < bestD) { bestD = d; bx = cellX(i); by = cellY(j); bid = id; }
    }
    return bid < 0 ? null : { x: bx, y: by, id: bid };
  };

  const rng = mulberry32(p.seed || 1);
  const flowAng = (x: number, y: number): number => vnoise(x * FLOW_FREQ, y * FLOW_FREQ) * Math.PI * 2 * SWIRL;

  // Punto d'avvio valido (cerco tra le celle grossolane cucibili).
  let sx = 0, sy = 0, seeded = false;
  for (let tries = 0; tries < 8000 && !seeded; tries++) {
    const x = bb.minX + rng() * (bb.maxX - bb.minX);
    const y = bb.minY + rng() * (bb.maxY - bb.minY);
    if (inRegion(x, y)) { sx = x; sy = y; seeded = true; }
  }
  if (!seeded) return [];

  const runs: Point[][] = [];
  let run: Point[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy, dir = rng() * Math.PI * 2;
  let curId = cj(sy) * gx + ci(sx); // cella dove il tratto corrente è iniziato
  let runMoves = 0, noProgress = 0, lastCovered = 0, iter = 0, totalPts = 1;
  const MAX_ITER = fillableCount * 400 + 60000;
  const RELOCATE_AFTER = 50;

  // Salto a penna alzata verso la tasca scoperta più vicina; apre un nuovo tratto. false se non resta nulla.
  const relocate = (): boolean => {
    // Se la cella d'arrivo non si è potuta riempire (nessun passo valido), la marchiamo "morta":
    // niente copertura fittizia, solo esclusione dalla ricerca del prossimo vuoto (termina il loop).
    if (curId >= 0 && runMoves === 0) dead[curId] = 1;
    const g = nearestGap(cx, cy);
    if (!g) return false;
    if (run.length >= 2) runs.push(run);
    run = [{ x: g.x, y: g.y }];
    cx = g.x; cy = g.y; dir = rng() * Math.PI * 2;
    curId = g.id; runMoves = 0; noProgress = 0;
    return true;
  };

  while (coveredCells < fillableCount * 0.985 && totalPts < MAX_POINTS && iter++ < MAX_ITER) {
    const saturated = cov[cj(cy) * gx + ci(cx)] >= target;
    let head = dir, spread = TURN_SPREAD;
    if (saturated) {
      const g = nearestGap(cx, cy);
      if (g) { head = Math.atan2(g.y - cy, g.x - cx); spread = 1.0; } // vira verso il vuoto (se raggiungibile dritto)
    }

    let bx = 0, by = 0, bAng = 0, bestScore = -Infinity, has = false;
    const fdir = flowAng(cx, cy);
    for (let k = 0; k < CANDIDATES; k++) {
      const len = minS + rng() * (maxS - minS);
      let ang = head + (rng() * 2 - 1) * spread;
      ang += FLOW_INFLUENCE * angDelta(ang, fdir);
      const nx = cx + Math.cos(ang) * len, ny = cy + Math.sin(ang) * len;
      if (!inRegion(nx, ny) || !segOk(cx, cy, nx, ny)) continue;
      const score = -cov[cj(ny) * gx + ci(nx)] + rng() * 0.6;
      if (score > bestScore) { bestScore = score; bx = nx; by = ny; bAng = ang; has = true; }
    }
    if (!has) {
      // Bloccato: gira secco e prova un passo corto (MAI un salto lungo disegnato).
      dir += (rng() * 2 - 1) * 2.5;
      let esc = false;
      for (let k = 0; k < 24 && !esc; k++) {
        const a = rng() * Math.PI * 2;
        const nx = cx + Math.cos(a) * minS, ny = cy + Math.sin(a) * minS;
        if (inRegion(nx, ny) && segOk(cx, cy, nx, ny)) { bx = nx; by = ny; bAng = a; esc = true; }
      }
      if (!esc) { if (!relocate()) break; continue; } // tasca chiusa → riloca a penna alzata
    }
    stamp(cx, cy, bx, by);
    run.push({ x: bx, y: by });
    cx = bx; cy = by; dir = bAng; totalPts++; runMoves++;

    if (coveredCells > lastCovered) { lastCovered = coveredCells; noProgress = 0; }
    else if (++noProgress > RELOCATE_AFTER) { if (!relocate()) break; } // tasca finita → nuova tasca
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

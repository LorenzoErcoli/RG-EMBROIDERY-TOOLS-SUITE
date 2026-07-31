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
  densitySpacingMm: number;  // §3.7 R22 — spaziatura fra le file = dimensione cella (piccola = più filo)
  voidClearanceMm: number;   // §3.2 R5/R7 — distanza minima da bordi e aree vuote
  seed: number;              // ripetibilità dell'anteprima
  // --- Palette (usata dalla pipeline, non dalla geometria) ---
  colors: string[];          // palette a numero variabile; l'ordine = ordine di rotazione lungo il filo
  paletteCycles: number;     // quante volte la palette gira lungo il tracciato → cambi-ago
  /** Densità PER-COLORE (spaziatura mm, parallela a `colors`): 0/assente = usa `densitySpacingMm`.
   *  Serve a controllare il filo quando si aggiungono colori (ognuno indipendente). */
  colorDensities: number[];
  /** Agglomerati: ogni colore si addensa in ZONE diverse (campo a bassa frequenza) invece del mélange
   *  uniforme → sfumature di colore più nette. false = mélange uniforme (comportamento storico). */
  clusterMode: boolean;
  /** Intensità degli agglomerati 0–100 (solo con `clusterMode`): quanto il colore dominante è più denso
   *  nella sua zona → 0 ≈ appena percettibile, 100 = zone di colore molto marcate. */
  clusterStrength: number;
}

export const defaultInterlaceParams: InterlaceParams = {
  realWidthMm: 0,
  minStitchMm: 6,
  maxStitchMm: 15,
  densitySpacingMm: 2.0, // spaziatura file (mm) di OGNI colore ≈ 0.8–3.2; piccola = fitto/più filo
  voidClearanceMm: 0.6,
  seed: 1,
  colors: ['#1f3a5f', '#c0392b', '#e0a41f', '#3b7d4f'],
  paletteCycles: 1, // 4 colori = 4 strati già di loro; alza per farli ripetere
  colorDensities: [], // vuoto = tutti i colori usano densitySpacingMm
  clusterMode: false, // false = mélange uniforme; true = agglomerati a zone (sfumature nette)
  clusterStrength: 60, // intensità zone 0–100 (solo con clusterMode)
};

// --- Costanti interne (implementazione, non parametri utente): il "movimento" del filo.
//     Diventeranno parametri di pannello quando decideremo i nomi (processo REVISIONE-PARAMETRI). ---
const FLOW_INFLUENCE = 0.2; // quanto il campo di flusso curva la camminata → vortici organici
const TURN_SPREAD = 2.2;    // ampiezza della virata casuale a ogni passo (sembra casuale)
const FLOW_FREQ = 0.02;     // scala del campo di flusso (nuvole più o meno grandi)
const SWIRL = 2.2;          // intensità di rotazione del campo
const CANDIDATES = 16;      // candidati valutati a ogni passo (si sceglie la zona meno riempita)
const CLUMP_CAP = 3;        // tetto ai picchi: il filo non passa più di ~3× il target in una stessa cella
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

/** Distance transform chamfer (2 passate): distanza in mm dalla cella-sorgente più vicina. */
function chamferDT(source0: Uint8Array, gw: number, gh: number, res: number): Float32Array {
  const BIG = 1e9, diag = res * Math.SQRT2;
  const d = new Float32Array(gw * gh);
  for (let c = 0; c < d.length; c++) d[c] = source0[c] ? 0 : BIG;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i; if (d[c] === 0) continue;
    if (i > 0 && d[c - 1] + res < d[c]) d[c] = d[c - 1] + res;
    if (j > 0 && d[c - gw] + res < d[c]) d[c] = d[c - gw] + res;
    if (i > 0 && j > 0 && d[c - gw - 1] + diag < d[c]) d[c] = d[c - gw - 1] + diag;
    if (i < gw - 1 && j > 0 && d[c - gw + 1] + diag < d[c]) d[c] = d[c - gw + 1] + diag;
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const c = j * gw + i; if (d[c] === 0) continue;
    if (i < gw - 1 && d[c + 1] + res < d[c]) d[c] = d[c + 1] + res;
    if (j < gh - 1 && d[c + gw] + res < d[c]) d[c] = d[c + gw] + res;
    if (i < gw - 1 && j < gh - 1 && d[c + gw + 1] + diag < d[c]) d[c] = d[c + gw + 1] + diag;
    if (i > 0 && j < gh - 1 && d[c + gw - 1] + diag < d[c]) d[c] = d[c + gw - 1] + diag;
  }
  return d;
}

/**
 * Campo di distanza CON SEGNO dell'area ricamabile: `sdf(x,y)` = distanza in mm dal bordo/vuoto più
 * vicino, POSITIVA dentro l'area, negativa fuori. La clearance si applica al punto REALE (sdf≥clear),
 * non a una maschera sì/no: così `clear=0` lascia il filo arrivare esattamente al bordo, e un valore
 * di clearance è rispettato con precisione (a meno della risoluzione della griglia). O(1) per query.
 */
interface Mask { gw: number; gh: number; x0: number; y0: number; res: number; sdf(x: number, y: number): number; }

function buildMask(boundary: Polyline, voids: Polyline[], res0: number): Mask {
  const bb = bounds(boundary);
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
  let res = res0;
  if ((w / res + 2) * (h / res + 2) > MAX_MASK_CELLS) res = Math.sqrt((w * h) / MAX_MASK_CELLS);
  const x0 = bb.minX - res, y0 = bb.minY - res;
  const gw = Math.ceil(w / res) + 3, gh = Math.ceil(h / res) + 3;
  const solid = new Uint8Array(gw * gh);
  fillPolygon(solid, gw, gh, x0, y0, res, boundary, 1); // dentro il bordo = 1
  for (const v of voids) fillPolygon(solid, gw, gh, x0, y0, res, v, 0); // scava i vuoti = 0

  const empty = new Uint8Array(gw * gh);
  for (let c = 0; c < solid.length; c++) empty[c] = solid[c] ? 0 : 1;
  const dOut = chamferDT(empty, gw, gh, res);  // dist. dal vuoto/bordo (per le celle dentro)
  const dIn = chamferDT(solid, gw, gh, res);   // dist. dall'area (per le celle fuori)
  // Campo con segno, con lo zero centrato sul bordo reale (~mezza cella tra dentro e fuori).
  const field = new Float32Array(gw * gh);
  for (let c = 0; c < field.length; c++) field[c] = solid[c] ? dOut[c] - 0.5 * res : 0.5 * res - dIn[c];

  return {
    gw, gh, x0, y0, res,
    sdf(x: number, y: number): number {
      const fx = (x - x0) / res - 0.5, fy = (y - y0) / res - 0.5;
      let i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0) i = 0; else if (i > gw - 2) i = gw - 2;
      if (j < 0) j = 0; else if (j > gh - 2) j = gh - 2;
      // Frazioni limitate a [0,1]: FUORI dalla griglia NON si estrapola (altrimenti sdf falsa positiva →
      // punti accettati lontano dal bordo). Ai margini si legge il valore della cella di bordo (negativo).
      let tx = fx - i, ty = fy - j;
      if (tx < 0) tx = 0; else if (tx > 1) tx = 1;
      if (ty < 0) ty = 0; else if (ty > 1) ty = 1;
      const r = j * gw + i;
      const a = field[r] + (field[r + 1] - field[r]) * tx;
      const b = field[r + gw] + (field[r + gw + 1] - field[r + gw]) * tx;
      return a + (b - a) * ty;
    },
  };
}

/** Contesto di riempimento indipendente dalla densità: maschera + griglia + celle cucibili. */
interface FillCtx {
  bb: ReturnType<typeof bounds>; res: number;
  cell: number; gx: number; gy: number;
  cellX: (i: number) => number; cellY: (j: number) => number;
  ci: (x: number) => number; cj: (y: number) => number;
  cfill: Uint8Array; fillableCount: number; minS: number; maxS: number;
  /** Punto rappresentativo VALIDO della cella (centro se cucibile, altrimenti sotto-punto vicino al bordo). */
  cpx: Float32Array; cpy: Float32Array;
  inRegion: (x: number, y: number) => boolean;
  segOk: (ax: number, ay: number, bx: number, by: number) => boolean;
  /** Distanza con segno dal bordo/vuoto (mm), per capire quanto è stretto il canale e la sua direzione. */
  sdf: (x: number, y: number) => number;
}

/**
 * Prepara maschera e griglia. `cell` = SPAZIATURA FRA LE FILE (mm) = la densità: la griglia di copertura ha
 * celle grandi `cell`, quindi meno celle (più rado) o più celle (più fitto). null se area nulla.
 */
function prepare(boundary: Polyline, voids: Polyline[], minS: number, maxS: number, clear: number, cell: number): FillCtx | null {
  // Maschera fine (campo di distanza con segno): risoluzione fitta per clearance accurata e canali stretti.
  const fineRes = Math.max(0.3, Math.min(0.5, minS / 8));
  const mask = buildMask(boundary, voids, fineRes);
  // `SAFE` (~mezza cella) garantisce R5 (mai nel vuoto) anche con l'errore di griglia; a clear=0 il filo
  // arriva a ridosso del bordo. Confronto sul punto REALE (sdf), non su una cella.
  const SAFE = 0.5 * mask.res;
  const inRegion = (x: number, y: number): boolean => mask.sdf(x, y) >= clear + SAFE;
  const segStep = mask.res * 0.9;
  const segOk = (ax: number, ay: number, bx: number, by: number): boolean => {
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(L / segStep));
    for (let k = 0; k <= n; k++) { const t = k / n; if (!inRegion(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  };
  const bb = bounds(boundary);
  const gx = Math.ceil((bb.maxX - bb.minX) / cell) + 1;
  const gy = Math.ceil((bb.maxY - bb.minY) / cell) + 1;
  const cellX = (i: number) => bb.minX + (i + 0.5) * cell;
  const cellY = (j: number) => bb.minY + (j + 0.5) * cell;
  const ci = (x: number) => Math.min(gx - 1, Math.max(0, Math.floor((x - bb.minX) / cell)));
  const cj = (y: number) => Math.min(gy - 1, Math.max(0, Math.floor((y - bb.minY) / cell)));
  const cfill = new Uint8Array(gx * gy);
  const cpx = new Float32Array(gx * gy), cpy = new Float32Array(gx * gy);
  // Sotto-punti per recuperare le celle di BORDO: se il centro non è cucibile ma un punto interno della
  // cella lo è (vicino al bordo/vuoto entro clearance), la cella è comunque riempibile lì → niente frangia vuota.
  const SUB: [number, number][] = [[0, 0], [-0.33, 0], [0.33, 0], [0, -0.33], [0, 0.33], [-0.33, -0.33], [0.33, 0.33], [-0.33, 0.33], [0.33, -0.33]];
  let fillableCount = 0;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const cxc = cellX(i), cyc = cellY(j);
    let vx = NaN, vy = NaN;
    for (const [ox, oy] of SUB) { const x = cxc + ox * cell, y = cyc + oy * cell; if (inRegion(x, y)) { vx = x; vy = y; break; } }
    if (!Number.isNaN(vx)) { const id = j * gx + i; cfill[id] = 1; cpx[id] = vx; cpy[id] = vy; fillableCount++; }
  }
  if (fillableCount === 0) return null;
  return { bb, res: mask.res, cell, gx, gy, cellX, cellY, ci, cj, cfill, fillableCount, cpx, cpy, minS, maxS, inRegion, segOk, sdf: mask.sdf };
}

/**
 * UNA passata di riempimento sul contesto `ctx`, con seme `seed` e un TARGET DI COPERTURA PER CELLA
 * (`targetArr[id]` = quante volte il filo deve attraversare la cella `id`; 0 = la cella NON appartiene
 * a questa passata). La camminata "cerca-vuoti" a passi brevi riempie SOLO le celle assegnate, con due
 * fasi (principale + controllo successivo che livella), rilocando a penna alzata tra le zone assegnate.
 * Questo permette il mélange: passate diverse ricevono celle diverse (dither), sparse su tutta l'area.
 */
function runOneFill(ctx: FillCtx, seed: number, targetArr: Uint8Array): Point[][] {
  const { bb, cell, gx, gy, ci, cj, cpx, cpy, minS, maxS, inRegion, segOk } = ctx;
  const cov = new Float32Array(gx * gy);
  const dead = new Uint8Array(gx * gy);
  let need = 0;
  for (let id = 0; id < targetArr.length; id++) if (targetArr[id] > 0) need++;
  if (need === 0) return [];
  let coveredCells = 0;
  const stamp = (ax: number, ay: number, bx: number, by: number): void => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / cell));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const id = cj(ay + (by - ay) * t) * gx + ci(ax + (bx - ax) * t);
      const before = cov[id];
      cov[id] = before + 1;
      const tg = targetArr[id];
      if (tg > 0 && before < tg && before + 1 >= tg) coveredCells++;
    }
  };
  const nearestGap = (x: number, y: number): { x: number; y: number; id: number } | null => {
    const i0 = ci(x), j0 = cj(y);
    let bestD = Infinity, bx = 0, by = 0, bid = -1;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const id = j * gx + i; const tg = targetArr[id];
      if (tg === 0 || cov[id] >= tg || dead[id]) continue;
      const d = (i - i0) * (i - i0) + (j - j0) * (j - j0);
      if (d < bestD) { bestD = d; bx = cpx[id]; by = cpy[id]; bid = id; }
    }
    return bid < 0 ? null : { x: bx, y: by, id: bid };
  };

  const rng = mulberry32(seed >>> 0 || 1);
  const flowAng = (x: number, y: number): number => vnoise(x * FLOW_FREQ, y * FLOW_FREQ) * Math.PI * 2 * SWIRL;

  // Avvio: la prima cella assegnata a questa passata (partendo da un punto casuale).
  const g0 = nearestGap(bb.minX + rng() * (bb.maxX - bb.minX), bb.minY + rng() * (bb.maxY - bb.minY));
  if (!g0) return [];

  const runs: Point[][] = [];
  let run: Point[] = [{ x: g0.x, y: g0.y }];
  let cx = g0.x, cy = g0.y, dir = rng() * Math.PI * 2;
  let curId = g0.id;
  let runMoves = 0, totalPts = 1;

  // `capMult` = tetto ai picchi in multipli del target: NON attraversare celle già a `capMult×target`
  // (Infinity = nessun tetto, ultima spiaggia). `hi` = lunghezza max del passo (di norma maxS; fino a
  // maxS+2 solo negli escape — il minimo NON cambia mai). Preferisce la cella MENO coperta (score -cov).
  const advance = (head: number, spread: number, capMult: number, hi: number): { x: number; y: number; ang: number } | null => {
    const curCell = cj(cy) * gx + ci(cx);
    const fdir = flowAng(cx, cy);
    let bx = 0, by = 0, bAng = 0, best = -Infinity, has = false;
    for (let k = 0; k < CANDIDATES; k++) {
      const len = minS + rng() * (hi - minS);
      let ang = head + (rng() * 2 - 1) * spread;
      ang += FLOW_INFLUENCE * angDelta(ang, fdir);
      const nx = cx + Math.cos(ang) * len, ny = cy + Math.sin(ang) * len;
      if (!inRegion(nx, ny) || !segOk(cx, cy, nx, ny)) continue;
      const destId = cj(ny) * gx + ci(nx);
      const tg = targetArr[destId];
      if (tg === 0) continue;
      if (cov[destId] >= capMult * tg) continue; // tetto ai picchi (vale anche ai tragitti)
      let score = -cov[destId] + rng() * 0.25;
      if (destId === curCell) score -= 3;
      if (cov[destId] >= tg) score -= 6;
      if (score > best) { best = score; bx = nx; by = ny; bAng = ang; has = true; }
    }
    if (has) return { x: bx, y: by, ang: bAng };
    for (let k = 0; k < 48; k++) { // escape ad ampio raggio, stesso tetto
      const a = rng() * Math.PI * 2;
      const len = minS + rng() * (hi - minS);
      const nx = cx + Math.cos(a) * len, ny = cy + Math.sin(a) * len;
      if (!inRegion(nx, ny) || !segOk(cx, cy, nx, ny)) continue;
      const id = cj(ny) * gx + ci(nx);
      if (targetArr[id] > 0 && cov[id] < capMult * targetArr[id]) return { x: nx, y: ny, ang: a };
    }
    return null;
  };
  const commit = (nx: number, ny: number, ang: number): void => {
    stamp(cx, cy, nx, ny);
    run.push({ x: nx, y: ny });
    cx = nx; cy = ny; dir = ang; totalPts++; runMoves++;
  };
  const openRunAt = (x: number, y: number, id: number): void => {
    if (run.length >= 2) runs.push(run);
    run = [{ x, y }];
    cx = x; cy = y; dir = rng() * Math.PI * 2; curId = id; runMoves = 0;
  };

  // FASE 1 — riempimento CONTINUO. REGOLA 1: mai staccare "di comodo". Se la zona locale è coperta o il
  // filo è bloccato, PROSEGUE verso il vuoto più vicino ATTRAVERSANDO l'area (preferendo le celle non
  // ancora cucite → il tragitto è esso stesso riempimento, niente sovrapposizione inutile). Si stacca
  // SOLO se una zona è davvero murata/irraggiungibile cucendo (caso raro → Regola 2, prossimo passo).
  let iter = 0;
  const MAX_ITER = need * 600 + 80000;
  // Copertura piena (il bilancio tra colori lo dà già la densità-totale divisa). Il fine-corsa si ferma
  // quando non restano più vuoti raggiungibili (nearestGap null) o a soglia alta.
  while (coveredCells < need * 0.995 && totalPts < MAX_POINTS && iter++ < MAX_ITER) {
    const cc = cj(cy) * gx + ci(cx);
    let head = dir, spread = TURN_SPREAD;
    const covered = targetArr[cc] === 0 || cov[cc] >= targetArr[cc];
    if (covered) {
      const g = nearestGap(cx, cy);
      if (!g) break; // niente più vuoti → passata finita
      head = Math.atan2(g.y - cy, g.x - cx); spread = 1.0; // punta al vuoto, restando continuo
    }
    // 1) passo normale (preferisce il vuoto, rispetta il tetto).
    let nxt = advance(head, spread, CLUMP_CAP, maxS);
    if (!nxt) {
      // 2) prosegui verso il vuoto attraversando l'area, sempre CUCENDO (mai staccare), punto fino a max+2
      //    SOLO qui (l'escape ha bisogno di un filo di raggio in più per non arenarsi in mille passi corti,
      //    che squilibrerebbero i colori; il minimo NON cambia mai). A GRADINI: prima senza superare il
      //    tetto-densità (i tragitti NON creano autostrade iper-dense), poi tetto doppio, poi ultima spiaggia.
      const g = nearestGap(cx, cy);
      const h2 = g ? Math.atan2(g.y - cy, g.x - cx) : dir + (rng() * 2 - 1) * 2;
      nxt = advance(h2, Math.PI, CLUMP_CAP, maxS + 2) || advance(h2, Math.PI, CLUMP_CAP * 2, maxS + 2) || advance(h2, Math.PI, Infinity, maxS + 2);
    }
    if (!nxt) {
      // 3) davvero murato (irraggiungibile cucendo): UNICO stacco ammesso, raro.
      if (runMoves === 0 && curId >= 0) dead[curId] = 1;
      const g = nearestGap(cx, cy);
      if (!g) break;
      openRunAt(g.x, g.y, g.id);
      continue;
    }
    commit(nxt.x, nxt.y, nxt.ang);
  }

  if (run.length >= 2) runs.push(run);
  return runs;
}

/**
 * SPAZIATURA fra le file (mm) → dimensione della cella di copertura. È QUESTA a controllare la densità
 * (e quindi il filo): cella piccola = fitto, cella grande = rado. Limitata a un intervallo ragionevole
 * perché la griglia resti sana anche nei canali stretti.
 */
function cellForSpacing(spacing: number, _maxS: number): number {
  // La cella = spaziatura fra le file. Fino a ~3mm la densità è regolare e OMOGENEA; verso 4 inizia a
  // farsi rada ma un po' disomogenea. Oltre ~4 il filo continuo, per restare tale, rimbalza in tragitti
  // che si AMMASSANO (zone iper-dense) invece di diradarsi → tetto a 4 (limite pratico dell'omogeneità).
  return Math.max(0.8, Math.min(4, spacing));
}

/** Copertura per cella (quante attraversate): FISSA. La densità è governata dalla dimensione della cella,
 * non da questo numero — così a densità bassa NON si moltiplicano i tragitti (il difetto del vecchio modello). */
const COVER_TARGET = 2;

const CLUSTER_FREQ = 0.022; // frequenza del campo di zona (agglomerati) → territori ~45mm
/** Campo di zona [0,1] del colore `k`: rumore a bassa frequenza sfasato per colore E per `seed`, così
 *  varianti diverse (seed diversi) danno DISPOSIZIONI di zone diverse — ma DETERMINISTICHE (stesso seed
 *  → stesse zone). Ogni colore si sposta di un passo diverso col seed → le zone si ridispongono, non
 *  solo traslano. */
function clusterField(x: number, y: number, k: number, seed: number): number {
  const off = k * 913.7 + 41 + seed * (167.3 + k * 53.9);
  return vnoise((x + off) * CLUSTER_FREQ, (y + off * 0.61) * CLUSTER_FREQ);
}
/**
 * Copertura obiettivo di UNA cella per il colore `pIdx` in modalità AGGLOMERATI. Ogni colore ha un campo
 * di zona sfasato; in ogni punto VINCE il colore col campo più alto → quello si addensa (territorio),
 * gli altri restano alla BASE (1, per tenere il filo continuo e attraversabile). Così nascono regioni
 * dominate da un colore con bordi sfumati = sfumature nette, senza zone isolate (niente runaway).
 */
function clusterTarget(x: number, y: number, pIdx: number, nColors: number, strength: number, seed: number): number {
  const self = clusterField(x, y, pIdx, seed);
  let maxOther = -1;
  for (let k = 0; k < nColors; k++) if (k !== pIdx) { const w = clusterField(x, y, k, seed); if (w > maxOther) maxOther = w; }
  const dom = self - maxOther; // >0 = questo colore domina qui
  // `boost` = quanto più denso è il vincitore nel suo nucleo, scalato dall'intensità (0→0, 100→8).
  const boost = Math.round(Math.max(0, Math.min(100, strength)) / 100 * 8);
  return dom > 0.02 ? COVER_TARGET + boost : dom > -0.05 ? COVER_TARGET : 1; // nucleo · confine · base
}

/** Colore RGB [0..255] di un punto, o null (fuori immagine/trasparente). Passato dall'app (campiona un canvas). */
export type ImageColorAt = (x: number, y: number) => [number, number, number] | null;

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

/**
 * Copertura obiettivo in modalità AGGLOMERATI GUIDATI DA IMMAGINE: invece del rumore, la zona di ogni
 * colore è DOVE l'immagine ha quel colore. Nel punto (x,y) si legge il pixel dell'immagine e si trova il
 * colore-filo più VICINO (cattura-colore): se è il mio colore mi addenso (nucleo), altrimenti resto alla
 * base minima (1) — così l'area resta continua/attraversabile ma il disegno RISPETTA l'immagine.
 */
function imageClusterTarget(x: number, y: number, myColorIdx: number, palRgb: Array<[number, number, number]>, sample: ImageColorAt, strength: number): number {
  const rgb = sample(x, y);
  if (!rgb) return 1; // fuori immagine → base
  let best = -1, bestD = Infinity;
  for (let k = 0; k < palRgb.length; k++) {
    const dr = rgb[0] - palRgb[k][0], dg = rgb[1] - palRgb[k][1], db = rgb[2] - palRgb[k][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = k; }
  }
  if (best !== myColorIdx) return 1; // qui l'immagine vuole un altro colore → base
  const boost = Math.round(Math.max(0, Math.min(100, strength)) / 100 * 8);
  return COVER_TARGET + boost;
}

/**
 * Riempimento a filo singolo: una sola passata alla densità richiesta (tutte le celle a target).
 * Usato dai test e come base; per il multicolore mélange si usa `generatePasses`.
 */
export function generateFill(boundary: Polyline, voids: Polyline[], p: InterlaceParams): Point[][] {
  if (boundary.length < 3) return [];
  const clear = Math.max(0, p.voidClearanceMm);
  const minS = Math.max(0.5, p.minStitchMm);
  const maxS = Math.max(minS + 0.1, p.maxStitchMm);
  const ctx = prepare(boundary, voids, minS, maxS, clear, cellForSpacing(p.densitySpacingMm, maxS));
  if (!ctx) return [];
  const targetArr = new Uint8Array(ctx.gx * ctx.gy);
  for (let id = 0; id < targetArr.length; id++) if (ctx.cfill[id]) targetArr[id] = COVER_TARGET;
  return runOneFill(ctx, p.seed || 1, targetArr);
}

/**
 * PASSATE A COLORE: una passata per ciascuna densità in `densities`, ognuna un FILO CONTINUO che copre
 * tutta la superficie alla PROPRIA densità (`densities[i]` mm), con un seme diverso. Sovrapponendo le
 * passate → intreccio multicolore. La densità PER-COLORE permette di controllare il filo quando si
 * aggiungono colori (ognuno indipendente). Maschera costruita una sola volta e condivisa.
 */
export function generatePasses(boundary: Polyline, voids: Polyline[], p: InterlaceParams, densities: number[], imageColorAt?: ImageColorAt): Point[][][] {
  if (boundary.length < 3 || densities.length < 1) return [];
  const clear = Math.max(0, p.voidClearanceMm);
  const minS = Math.max(0.5, p.minStitchMm);
  const maxS = Math.max(minS + 0.1, p.maxStitchMm);
  const base = (p.seed || 1) >>> 0;
  // Agglomerati guidati da immagine: palette in RGB, usata solo se c'è un campionatore immagine.
  const imgPal = imageColorAt && p.colors && p.colors.length ? p.colors.map(hexToRgb) : null;
  // La densità PER-COLORE è la dimensione della cella → ogni densità ha una sua griglia. La maschera si
  // ricostruisce solo quando la cella cambia (cache per valore di cella): densità uguali → una sola build.
  const ctxByCell = new Map<number, FillCtx | null>();
  const passes: Point[][][] = [];
  for (let pIdx = 0; pIdx < densities.length; pIdx++) {
    const cell = cellForSpacing(densities[pIdx], maxS);
    let ctx = ctxByCell.get(cell);
    if (ctx === undefined) { ctx = prepare(boundary, voids, minS, maxS, clear, cell); ctxByCell.set(cell, ctx); }
    if (!ctx) { passes.push([]); continue; }
    const targetArr = new Uint8Array(ctx.gx * ctx.gy);
    if (p.clusterMode) {
      // Agglomerati: la copertura di ogni cella dipende dalla ZONA del colore — da IMMAGINE se caricata
      // (il colore va dove l'immagine ha quel colore), altrimenti dal campo di rumore per-colore/seed.
      const myColor = imgPal ? pIdx % imgPal.length : 0;
      for (let id = 0; id < targetArr.length; id++) {
        if (!ctx.cfill[id]) continue;
        const gi = id % ctx.gx, gj = (id / ctx.gx) | 0;
        const x = ctx.cellX(gi), y = ctx.cellY(gj);
        targetArr[id] = imgPal
          ? imageClusterTarget(x, y, myColor, imgPal, imageColorAt as ImageColorAt, p.clusterStrength)
          : clusterTarget(x, y, pIdx, densities.length, p.clusterStrength, base);
      }
    } else {
      for (let id = 0; id < targetArr.length; id++) if (ctx.cfill[id]) targetArr[id] = COVER_TARGET;
    }
    passes.push(runOneFill(ctx, (base + pIdx * 0x9e3779b1) >>> 0, targetArr));
  }
  return passes;
}

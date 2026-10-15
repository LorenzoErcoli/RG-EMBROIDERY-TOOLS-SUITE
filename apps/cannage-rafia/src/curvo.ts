// Cannage rafia — il reticolo CURVO (Lorenzo, 14/10): su un cartamodello come la borsa curva i rombi non
// stanno su un reticolo dritto — le file di vertici si arcuano, i rombi si deformano — e linee, cornice e
// griglia devono seguirli.
//
// Come si fa senza riscrivere i motori: linee, cornice e griglia restano scritti sul reticolo DRITTO (il
// reticolo «ideale», quello che il disegno avrebbe senza curvatura) e lavorano su un pezzo ideale, cioè il
// pezzo vero riportato lì dalla deformazione inversa. Quello che generano si porta poi sul pezzo vero con
// la deformazione. Così le linee seguono la curva che passa per i vertici di riga, scalano col rombo e —
// siccome il pezzo ideale arriva dove arriva il cartamodello — finiscono sempre sul bordo vero.
//
// La deformazione è una thin-plate spline fra i vertici veri dei rombi interi e le loro posizioni sul
// reticolo ideale: passa ESATTAMENTE per i vertici (la curva delle linee passa per i vertici, come
// chiesto) ed è liscia fra l'uno e l'altro. Ogni rombo intero dà i suoi quattro vertici: sinistro, alto,
// destro, basso (i punti estremi del suo contorno, che anche con i lati lievemente curvi restano gli angoli).
import type { Punto, Reticolo } from './linee';
import { reticoloDaZone, type LetturaReticolo, type Zona } from './reticolo';
import { sagomaDaLati, type Sagoma } from './sagoma';

export type Warp = {
  /** Dal reticolo ideale (dritto) al disegno vero. */
  avanti(p: Punto): Punto;
  /** Dal disegno vero al reticolo ideale. */
  indietro(p: Punto): Punto;
};

export type LetturaCurva = {
  reticolo: Reticolo;
  warp: Warp;
  /** Vertici veri usati dalla deformazione. */
  nodi: number;
  /** Rombi interi letti (tutte e due le tinte). */
  rombiInteri: number;
  /** Quanto il reticolo dritto sbaglierebbe sul vertice peggiore, mm. */
  scostamentoMax: number;
  /** Il Jacobiano più piccolo trovato sul pezzo: sotto 0,2 la deformazione si ripiega e non è da fidarsi. */
  jacobianoMin: number;
};

const dist = (p: Punto, q: Punto) => Math.hypot(q.x - p.x, q.y - p.y);
const norm = (c?: string) => (c ?? '').trim().toLowerCase();

type Rombo = { colore: string; l: Punto; t: Punto; r: Punto; b: Punto };

/** Distanza di un punto da un segmento. */
function distSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Il rombo intero di una zona, o null. Gli angoli sono i punti estremi (sinistro, alto, destro, basso);
 * la zona è un rombo intero se tutto il suo contorno sta lungo i quattro lati di quel quadrilatero (i lati
 * possono incurvarsi un poco) e i quattro lati sono simili fra loro: una zona tagliata dal bordo del pezzo
 * non lo passa.
 */
function romboDa(z: Zona): Rombo | null {
  const P = z.points;
  if (P.length < 4) return null;
  let l = P[0], r = P[0], t = P[0], b = P[0];
  for (const p of P) { if (p.x < l.x) l = p; if (p.x > r.x) r = p; if (p.y < t.y) t = p; if (p.y > b.y) b = p; }
  const quad = [l, t, r, b];
  const lati = [dist(l, t), dist(t, r), dist(r, b), dist(b, l)];
  const diag = Math.max(dist(l, r), dist(t, b));
  if (diag < 5 || Math.min(...lati) < 0.5 * Math.max(...lati)) return null;
  // i quattro angoli devono essere distinti e in giro, non due punti coincidenti
  if (Math.min(dist(l, r), dist(t, b)) < 0.5 * diag) return null;
  for (const p of P) {
    const d = Math.min(...quad.map((q, i) => distSegmento(p, q, quad[(i + 1) % 4])));
    if (d > 0.06 * diag) return null;
  }
  return { colore: norm(z.color), l, t, r, b };
}

type Nodo = Punto & { m?: number; n?: number; vicini: Nodo[] };

// ---- la thin-plate spline ---------------------------------------------------------------------
const phi = (r2: number) => (r2 > 1e-12 ? 0.5 * r2 * Math.log(r2) : 0);

function risolvi(M: number[][], B: number[][]): number[][] {
  const n = M.length, k = B[0].length;
  const A = M.map((r, i) => [...r, ...B[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-12) throw new Error('deformazione singolare');
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      if (f) for (let c = i; c < n + k; c++) A[r][c] -= f * A[i][c];
    }
  }
  return A.map((r, i) => r.slice(n).map((v) => v / A[i][i]));
}

/** Una spline ideale → vero che passa per tutte le coppie. Le coordinate ideali si scalano con `s`. */
function costruisciSpline(ideali: Punto[], veri: Punto[], s: number): (p: Punto) => Punto {
  const N = ideali.length;
  const u = ideali.map((p) => ({ x: p.x / s, y: p.y / s }));
  const M = Array.from({ length: N + 3 }, () => new Array(N + 3).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) M[i][j] = phi((u[i].x - u[j].x) ** 2 + (u[i].y - u[j].y) ** 2);
    M[i][i] += 1e-9;
    M[i][N] = 1; M[i][N + 1] = u[i].x; M[i][N + 2] = u[i].y;
    M[N][i] = 1; M[N + 1][i] = u[i].x; M[N + 2][i] = u[i].y;
  }
  const B = [...veri.map((p) => [p.x, p.y]), [0, 0], [0, 0], [0, 0]];
  const C = risolvi(M, B);
  return (p) => {
    const x = p.x / s, y = p.y / s;
    let X = C[N][0] + C[N + 1][0] * x + C[N + 2][0] * y, Y = C[N][1] + C[N + 1][1] * x + C[N + 2][1] * y;
    for (let i = 0; i < N; i++) {
      const f = phi((x - u[i].x) ** 2 + (y - u[i].y) ** 2);
      X += C[i][0] * f; Y += C[i][1] * f;
    }
    return { x: X, y: Y };
  };
}

/** L'inverso per Newton: parte dal punto stesso (ideale e vero sono vicini) e segue il Jacobiano. */
function invertitore(avanti: (p: Punto) => Punto, passo: number): (q: Punto) => Punto {
  return (q) => {
    let p = { x: q.x, y: q.y };
    for (let it = 0; it < 40; it++) {
      const f = avanti(p);
      const ex = q.x - f.x, ey = q.y - f.y;
      if (Math.hypot(ex, ey) < 1e-5) break;
      const fx = avanti({ x: p.x + passo, y: p.y }), fy = avanti({ x: p.x, y: p.y + passo });
      const a = (fx.x - f.x) / passo, c = (fx.y - f.y) / passo, b = (fy.x - f.x) / passo, d = (fy.y - f.y) / passo;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-9) break;
      p = { x: p.x + (d * ex - b * ey) / det, y: p.y + (-c * ex + a * ey) / det };
    }
    return p;
  };
}

/**
 * Il reticolo curvo dai rombi interi di tutte e due le tinte, o null se non si può leggere (meno di
 * quattro rombi interi, rombi che non si toccano di vertice a vertice, indici in conflitto).
 */
export function reticoloCurvoDaZone(zone: Zona[], colore: string): LetturaCurva | null {
  const target = norm(colore);
  const rombi = zone.map(romboDa).filter((r): r is Rombo => !!r);
  if (rombi.length < 4 || !rombi.some((r) => r.colore === target)) return null;
  const diag = rombi.map((r) => (dist(r.l, r.r) + dist(r.t, r.b)) / 2).sort((p, q) => p - q)[Math.floor(rombi.length / 2)];
  const tol = 0.03 * diag;

  // i nodi: gli angoli dei rombi, uniti quando coincidono
  const nodi: Nodo[] = [];
  const nodoDi = (p: Punto): Nodo => {
    let g = nodi.find((q) => dist(q, p) < tol);
    if (!g) { g = { x: p.x, y: p.y, vicini: [] }; nodi.push(g); }
    return g;
  };
  const angoli = rombi.map((r) => [nodoDi(r.l), nodoDi(r.t), nodoDi(r.r), nodoDi(r.b)]);
  for (const a of angoli) for (let i = 0; i < 4; i++) {
    const p = a[i], q = a[(i + 1) % 4];
    if (p === q) return null;
    if (!p.vicini.includes(q)) p.vicini.push(q);
    if (!q.vicini.includes(p)) q.vicini.push(p);
  }

  // gli indici (m, n) per visita dei lati: un lato va sempre di ±1 in orizzontale e in verticale
  const primoP1 = rombi.findIndex((r) => r.colore === target);
  const radice = angoli[primoP1][0];
  radice.m = 0; radice.n = 0;
  const coda = [radice];
  while (coda.length) {
    const g = coda.shift()!;
    for (const h of g.vicini) {
      const m = g.m! + (h.x > g.x ? 1 : -1), n = g.n! + (h.y > g.y ? 1 : -1);
      if (h.m === undefined) { h.m = m; h.n = n; coda.push(h); } else if (h.m !== m || h.n !== n) return null;
    }
  }
  const indicizzati = nodi.filter((g) => g.m !== undefined);
  const visti = new Set<string>();
  for (const g of indicizzati) { const k = `${g.m},${g.n}`; if (visti.has(k)) return null; visti.add(k); }
  // i rombi del pattern 1 stanno tutti con centro in (m dispari, n pari): se no la tinta scelta non è un pattern
  for (let i = 0; i < rombi.length; i++) {
    if (rombi[i].colore !== target) continue;
    const l = angoli[i][0];
    if (l.m === undefined || (l.n! % 2 !== 0)) return null;
  }
  if (indicizzati.length < 6) return null;

  // il reticolo ideale: mezze diagonali dalle distanze medie fra vertici adiacenti, origine che tiene fermo
  // il baricentro (così il reticolo ideale e il disegno vero restano vicini)
  const medie = (f: (g: Nodo, h: Nodo) => number | null) => {
    const v: number[] = [];
    for (const g of indicizzati) for (const h of g.vicini) if (h.m !== undefined) { const x = f(g, h); if (x !== null) v.push(x); }
    return v.reduce((s, x) => s + x, 0) / v.length;
  };
  const a = medie((g, h) => (h.m! > g.m! ? Math.abs(h.x - g.x) : null));
  const b = medie((g, h) => (h.n! > g.n! ? Math.abs(h.y - g.y) : null));
  const mm = indicizzati.reduce((s, g) => s + g.m!, 0) / indicizzati.length, mn = indicizzati.reduce((s, g) => s + g.n!, 0) / indicizzati.length;
  const mx = indicizzati.reduce((s, g) => s + g.x, 0) / indicizzati.length, my = indicizzati.reduce((s, g) => s + g.y, 0) / indicizzati.length;
  const ux0 = mx - a * mm, vy0 = my - b * mn;
  const ideale = (g: Nodo): Punto => ({ x: ux0 + a * g.m!, y: vy0 + b * g.n! });
  const reticolo: Reticolo = { cx: ux0 + a, cy: vy0, a, b };

  let avanti: (p: Punto) => Punto;
  try { avanti = costruisciSpline(indicizzati.map(ideale), indicizzati, a); } catch { return null; }
  const indietro = invertitore(avanti, 0.01 * a);
  const scostamentoMax = Math.max(...indicizzati.map((g) => dist(g, ideale(g))));

  // la deformazione deve restare una mappa: Jacobiano positivo su tutto il pezzo (griglia sui punti delle zone)
  let jacobianoMin = Infinity;
  const h = 0.05 * a;
  for (const z of zone) for (let k = 0; k < z.points.length; k += Math.max(1, Math.floor(z.points.length / 12))) {
    const p = indietro(z.points[k]);
    const f0 = avanti(p), fx = avanti({ x: p.x + h, y: p.y }), fy = avanti({ x: p.x, y: p.y + h });
    const det = ((fx.x - f0.x) * (fy.y - f0.y) - (fy.x - f0.x) * (fx.y - f0.y)) / (h * h);
    jacobianoMin = Math.min(jacobianoMin, det);
    if (dist(avanti(p), z.points[k]) > 0.05) return null; // l'inverso non torna: la deformazione non è affidabile
  }
  return { reticolo, warp: { avanti, indietro }, nodi: indicizzati.length, rombiInteri: rombi.length, scostamentoMax, jacobianoMin };
}

/** Oltre questa parte della mezza diagonale un vertice fuori dal reticolo dritto vuol dire cartamodello curvo. */
export const SOGLIA_CURVO = 0.12;

/**
 * Il reticolo di un disegno, dritto o curvo. Se i rombi stanno sul reticolo dritto (come nei cartamodelli
 * di prima) tutto resta com'era e non c'è deformazione; se no — il reticolo dritto non si legge, o dei
 * rombi ne restano fuori, o i vertici se ne scostano più di SOGLIA_CURVO mezze diagonali — si usa quello
 * curvo.
 */
export function leggiReticolo(zone: Zona[], colore: string): LetturaReticolo {
  let dritto: LetturaReticolo | null = null;
  let errore: unknown = null;
  try { dritto = reticoloDaZone(zone, colore); } catch (e) { errore = e; }
  const curvo = reticoloCurvoDaZone(zone, colore);
  if (curvo && (!dritto || dritto.fuoriReticolo > 0 || curvo.scostamentoMax > SOGLIA_CURVO * curvo.reticolo.a)) {
    return { reticolo: curvo.reticolo, rombiInteri: curvo.rombiInteri, fuoriReticolo: 0, warp: curvo.warp, curvo: { nodi: curvo.nodi, scostamentoMax: curvo.scostamentoMax, jacobianoMin: curvo.jacobianoMin } };
  }
  if (dritto) return dritto;
  throw errore;
}

// ---- dal pezzo vero al pezzo ideale e ritorno -------------------------------------------------

/** Un tratto di bordo lungo più di così si spezza prima di riportarlo sul reticolo ideale, mm. */
const PASSO_BORDO = 4;

/**
 * Il pezzo riportato sul reticolo ideale. Si parte dai LATI del bordo, non dagli anelli: l'anello è una
 * catena che ai vertici dove due zone si toccano di punta può prendere scorciatoie, mentre i lati sono il
 * bordo vero. Ogni lato si spezza e si passa dall'inverso, così segue la deformazione.
 */
export function sagomaIdeale(sagoma: Sagoma, warp: Warp): Sagoma {
  // Gli angoli di zone diverse che si toccano coincidono solo entro qualche centesimo di mm: nel disegno vero
  // non fa danni, ma qui due capi quasi uguali darebbero due immagini lievemente diverse e fra i due lati
  // resterebbe un varco in cui il «dentro o fuori» di una riga sbaglia. Si saldano prima, come l'importer.
  const SALDA_CAPI = 0.25;
  const celle = new Map<string, Punto[]>();
  const saldato = (p: Punto): Punto => {
    const cx = Math.round(p.x / SALDA_CAPI), cy = Math.round(p.y / SALDA_CAPI);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
      for (const q of celle.get(i + ',' + j) ?? []) if (dist(p, q) < SALDA_CAPI) return q;
    }
    const k = cx + ',' + cy;
    const l = celle.get(k);
    if (l) l.push(p); else celle.set(k, [p]);
    return p;
  };
  const lati: [Punto, Punto][] = [];
  for (const [a, b] of sagoma.lati) {
    const p = saldato(a), q = saldato(b);
    if (p === q) continue;
    const n = Math.max(1, Math.ceil(dist(p, q) / PASSO_BORDO));
    let prev = warp.indietro(p);
    for (let i = 1; i <= n; i++) {
      const cur = i === n ? warp.indietro(q) : warp.indietro({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n });
      lati.push([prev, cur]);
      prev = cur;
    }
  }
  return sagomaDaLati(lati, sagoma.anello?.map((p) => warp.indietro(p)));
}

export const anelliIdeali = (anelli: Punto[][], warp: Warp): Punto[][] => anelli.map((r) => r.map((p) => warp.indietro(p)));

/**
 * I tratti cuciti sul reticolo ideale portati sul disegno vero. Un tratto dritto nell'ideale diventa curvo:
 * dove la corda si scosta più di `tolleranza` dalla curva si aggiungono punti, altrimenti no — così i
 * cordoncini (un punto per passata) restano com'erano e solo i tratti lunghi seguono la curva.
 */
export function mappaBlocchi(blocchi: Punto[][], warp: Warp, tolleranza = 0.1): Punto[][] {
  const out: Punto[][] = [];
  for (const b of blocchi) {
    if (!b.length) continue;
    const r: Punto[] = [warp.avanti(b[0])];
    for (let i = 1; i < b.length; i++) segmento(b[i - 1], b[i], r[r.length - 1], warp.avanti(b[i]), warp, tolleranza, 0, r);
    out.push(r);
  }
  return out;
}

function segmento(p: Punto, q: Punto, fp: Punto, fq: Punto, warp: Warp, tol: number, livello: number, out: Punto[]): void {
  if (livello < 7 && dist(p, q) > 0.2) {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const fm = warp.avanti(m);
    if (distSegmento(fm, fp, fq) > tol) {
      segmento(p, m, fp, fm, warp, tol, livello + 1, out);
      segmento(m, q, fm, fq, warp, tol, livello + 1, out);
      return;
    }
  }
  out.push(fq);
}

/** I rombi interi di una tinta, dritti o curvi: serve a riconoscere le due tinte del cannage al caricamento. */
export function contaRombi(zone: Zona[], colore: string): number {
  let dritti = 0;
  try { dritti = reticoloDaZone(zone, colore).rombiInteri; } catch { /* non è un reticolo dritto */ }
  const target = norm(colore);
  return Math.max(dritti, zone.filter((z) => norm(z.color) === target && romboDa(z)).length);
}

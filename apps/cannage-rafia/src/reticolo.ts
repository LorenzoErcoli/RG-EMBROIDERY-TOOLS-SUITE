// Il reticolo dei rombi letto da un SVG a zone: da dove la fase 3 prende tutte le sue misure.
import type { ImportedBoundaryModel } from '@rg/pattern-grammar';
import type { Punto, Reticolo } from './linee';

export type Zona = { color?: string; points: Punto[] };

/**
 * Le zone di un file importato: ogni tracciato chiuso di una tinta vera. I tracciati senza colore
 * (Illustrator li mette doppi, `fill: none`) non sono zone e restano fuori.
 */
export function zoneDaModello(model: ImportedBoundaryModel): Zona[] {
  const out: Zona[] = [];
  for (const c of model.choices) for (const p of c.boundary.paths) {
    const color = (p.color ?? c.color ?? '').toLowerCase();
    if (!p.closed || p.points.length < 4 || !/^#[0-9a-f]{6}$/.test(color)) continue;
    out.push({ color, points: p.points.map((q) => ({ x: q.x, y: q.y })) });
  }
  return out;
}

/** Un tracciato APERTO di una tinta: le linee che Lorenzo disegna per dire dove bordare (16/09). */
export type LineaAperta = { color: string; points: Punto[] };

/**
 * I tracciati aperti del file, per tinta. L'importer li tiene solo per le tinte che non hanno anche
 * tracciati chiusi: una linea di bordatura va disegnata con una tinta sua.
 */
export function lineeDaModello(model: ImportedBoundaryModel): LineaAperta[] {
  const out: LineaAperta[] = [];
  for (const c of model.choices) for (const p of c.boundary.paths) {
    const color = (p.color ?? c.color ?? '').toLowerCase();
    if (p.closed || p.points.length < 2 || !/^#[0-9a-f]{6}$/.test(color)) continue;
    out.push({ color, points: p.points.map((q) => ({ x: q.x, y: q.y })) });
  }
  return out;
}

export type LetturaReticolo = {
  reticolo: Reticolo;
  /** Rombi interi del colore scelto usati per la misura. */
  rombiInteri: number;
  /** Rombi interi che NON cadono sul reticolo: se non è zero, il disegno non è un cannage regolare. */
  fuoriReticolo: number;
};

const norm = (c?: string) => (c ?? '').trim().toLowerCase();

function pulisci(points: Punto[]): Punto[] {
  const out: Punto[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.01) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 0.01) out.pop();
  return out;
}

function area(points: Punto[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

const mediana = (v: number[]) => {
  const s = v.slice().sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

/**
 * Il reticolo dai rombi INTERI di una tinta (quella del pattern 1). Un rombo intero è un poligono
 * con un vertice al centro di ogni lato del suo rettangolo d'ingombro e area pari a metà del
 * rettangolo; i rombi tagliati dal bordo del pezzo non contano. Le mezze diagonali sono la mediana;
 * il centro si media su tutti i rombi riportati sul reticolo, così un rombo disegnato storto di un
 * decimo non sposta tutto.
 */
export function reticoloDaZone(zone: Zona[], colore: string): LetturaReticolo {
  const target = norm(colore);
  const cand: { cx: number; cy: number; w: number; h: number }[] = [];
  for (const z of zone) {
    if (norm(z.color) !== target) continue;
    const pts = pulisci(z.points);
    if (pts.length < 4) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const w = maxX - minX, h = maxY - minY;
    if (w < 1 || h < 1) continue;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (Math.abs(Math.abs(area(pts)) - (w * h) / 2) > 0.04 * (w * h) / 2) continue;
    const tol = 0.03 * Math.max(w, h);
    const vicino = (x: number, y: number) => pts.some((p) => Math.hypot(p.x - x, p.y - y) < tol);
    if (!(vicino(minX, cy) && vicino(maxX, cy) && vicino(cx, minY) && vicino(cx, maxY))) continue;
    cand.push({ cx, cy, w, h });
  }
  if (!cand.length) throw new Error(`Nessun rombo intero di colore ${colore}: il reticolo non si può leggere.`);
  const W = mediana(cand.map((c) => c.w)), H = mediana(cand.map((c) => c.h));
  const buoni = cand.filter((c) => Math.abs(c.w - W) < 0.05 * W && Math.abs(c.h - H) < 0.05 * H);
  const a = mediana(buoni.map((c) => c.w)) / 2, b = mediana(buoni.map((c) => c.h)) / 2;
  const P = 2 * a, Q = 2 * b;
  const gx = buoni.reduce((s, c) => s + c.cx, 0) / buoni.length, gy = buoni.reduce((s, c) => s + c.cy, 0) / buoni.length;
  const rif = buoni.reduce((best, c) => (Math.hypot(c.cx - gx, c.cy - gy) < Math.hypot(best.cx - gx, best.cy - gy) ? c : best));
  const rx = buoni.map((c) => c.cx - P * Math.round((c.cx - rif.cx) / P));
  const ry = buoni.map((c) => c.cy - Q * Math.round((c.cy - rif.cy) / Q));
  const cx = rx.reduce((s, v) => s + v, 0) / rx.length, cy = ry.reduce((s, v) => s + v, 0) / ry.length;
  const fuori = buoni.filter((c) => Math.abs(c.cx - cx - P * Math.round((c.cx - cx) / P)) > 0.1 * a
    || Math.abs(c.cy - cy - Q * Math.round((c.cy - cy) / Q)) > 0.1 * b).length;
  return { reticolo: { cx, cy, a, b }, rombiInteri: buoni.length, fuoriReticolo: fuori };
}

/** Il contorno del pezzo come rettangolo d'ingombro di tutte le zone (il caso del piazzamento a riquadro). */
export function contornoDaZone(zone: Zona[]): Punto[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of zone) for (const p of z.points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  if (!Number.isFinite(minX)) throw new Error('Nessuna zona: il contorno del pezzo non si può ricavare.');
  return [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
}

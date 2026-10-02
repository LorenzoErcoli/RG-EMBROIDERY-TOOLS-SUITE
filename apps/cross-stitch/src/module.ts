// RICAVA MODULO (Lorenzo, 2026-10-01, sul Fair Isle: «in primis definire il modulo. Il programma deve
// muoversi realizzando moduli… dovremmo trovare il modo di creare un modulo che si ripete»).
//
// Da un'immagine di una maglia a motivo ripetuto: quanto è grande il motivo che si ripete (in pixel),
// quante V ci stanno, il colore di ogni V e i fili. Misurato sul Fair Isle di Lorenzo
// (sapere/decisioni/cross-stitch-fair-isle-strisce.md):
//
// 1. Il PERIODO del motivo, in x e in y: il minimo della differenza fra l'immagine e sé stessa
//    spostata. Sul Fair Isle 429 × 657 px.
// 2. Le COLONNE: i bordi di colore cadono sempre fra due V; il passo che li allinea meglio, fra quelli
//    che dividono il periodo in un numero intero di V (72; a pari merito il passo più largo, perché
//    metà passo allinea gli stessi bordi).
// 3. Le RIGHE: dai colori NON si trovano (provati: purezza delle celle, concordanza fra copie, bordi —
//    tutti indifferenti fra 84 e 132). Le dà la trama del filo, che in verticale si ripete a ogni
//    riga o a righe alterne: si prende il multiplo che fa la V più vicina a quadrata (112). Senza
//    trama, V quadrate.
// 4. Il COLORE di ogni V: il centro della cella, in tutte le copie del motivo; i colori in gruppi
//    nello spazio Lab (vicino a come vede l'occhio: in RGB l'azzurro e il verde poco saturi finivano
//    nei grigi); ogni V prende il gruppo della maggioranza delle sue copie.
// 5. Il modulo VERO: se le due metà (in x o in y) sono uguali, a meno del rumore sui bordi, il modulo
//    è la metà, per maggioranza (Fair Isle: 72 × 112 = 4 copie di 36 × 56).
// 6. I colori FINTI: un gruppo fatto quasi solo di V isolate (in media al più 2 V per pezzo) è il
//    bordo sfumato fra due colori, non un filo (Fair Isle: 127 pezzi, 106 V isolate, 1,3 V di media).
//    Le sue V prendono il colore che hanno intorno.
//
// Nessun DOM.

import type { CellEdit, CellMark, Cells, GridSpec, Pixels } from './model';

export interface ModuleOptions {
  /** Quanti colori cercare (prima di togliere quelli finti). */
  colors: number;
  /** Colonne e righe del modulo nell'immagine, se si vogliono imporre (0 = trovale). */
  cols?: number;
  rows?: number;
}

export interface FoundModule {
  /** Il modulo: colonne × righe di V, e il colore (indice in palette) di ogni V, riga per riga. */
  cols: number;
  rows: number;
  map: number[];
  /** I fili, '#rrggbb', nell'ordine: prima il più diffuso (la base), poi dal più chiaro al più scuro. */
  palette: string[];
  /** Quante V di ogni filo nel modulo. */
  counts: number[];
  /** Il motivo nell'immagine: periodo in px e V. */
  periodPx: { w: number; h: number };
  imageCells: { cols: number; rows: number };
  /** Colori finti tolti (bordi sfumati). */
  removed: number;
  /** V del modulo su cui le copie non erano d'accordo. */
  uncertain: number;
  /** Dove sta il modulo nell'immagine (px dell'immagine analizzata): la sua V (0, 0) e la sua misura. */
  guidePx: { x: number; y: number; w: number; h: number };
}

// ------------------------------------------------------------ colore

type Lab = [number, number, number];
function toLab(r: number, g: number, b: number): Lab {
  const f = (u: number) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = h(X); Y = h(Y); Z = h(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const d2 = (p: number[], q: number[]) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// ------------------------------------------------------------ 1. il periodo

/** Il periodo del motivo lungo un asse: lo spostamento con la differenza media più bassa. */
function period(L: Float32Array, W: number, H: number, axis: 'x' | 'y'): number {
  const n = axis === 'x' ? W : H;
  const lo = Math.max(8, Math.round(n * 0.05)), hi = Math.round(n * 0.6);
  const diff = (d: number, step: number) => {
    let s = 0, k = 0;
    for (let y = 0; y + (axis === 'y' ? d : 0) < H; y += step) {
      for (let x = 0; x + (axis === 'x' ? d : 0) < W; x += step) {
        const i = y * W + x, j = axis === 'x' ? i + d : i + d * W;
        s += Math.abs(L[i] - L[j]); k++;
      }
    }
    return s / k;
  };
  // prima grossolana (uno spostamento su due, un pixel su sei), poi fine intorno ai tre migliori
  const coarse: Array<[number, number]> = [];
  for (let d = lo; d <= hi; d += 2) coarse.push([d, diff(d, 6)]);
  coarse.sort((a, b) => a[1] - b[1]);
  let best = 0, bestV = Infinity;
  for (const [c] of coarse.slice(0, 3)) for (let d = Math.max(lo, c - 3); d <= Math.min(hi, c + 3); d++) { const v = diff(d, 2); if (v < bestV) { bestV = v; best = d; } }
  return best;
}

// ------------------------------------------------------------ 2. le colonne (bordi di colore)

/** Il colore liscio (media 5×5, separabile): toglie la trama del filo. */
function smooth(data: ArrayLike<number>, W: number, H: number): Float32Array {
  const tmp = new Float32Array(W * H * 3), sm = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 2; x < W - 2; x++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let b = -2; b <= 2; b++) s += data[4 * (y * W + x + b) + c];
    tmp[3 * (y * W + x) + c] = s / 5;
  }
  for (let y = 2; y < H - 2; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let a = -2; a <= 2; a++) s += tmp[3 * ((y + a) * W + x) + c];
    sm[3 * (y * W + x) + c] = s / 5;
  }
  return sm;
}

/** Bordi di colore netti lungo un asse: posizione e forza. */
function colorEdges(sm: Float32Array, W: number, H: number, axis: 'x' | 'y'): Array<[number, number]> {
  const dist = (i: number, j: number) => Math.hypot(sm[3 * i] - sm[3 * j], sm[3 * i + 1] - sm[3 * j + 1], sm[3 * i + 2] - sm[3 * j + 2]);
  const out: Array<[number, number]> = [];
  const along = axis === 'x' ? W : H, across = axis === 'x' ? H : W;
  const at = (line: number, t: number) => (axis === 'x' ? line * W + t : t * W + line);
  const g = new Float32Array(along);
  for (let line = 4; line < across - 4; line += 2) {
    for (let t = 1; t < along - 1; t++) g[t] = dist(at(line, t + 1), at(line, t - 1));
    // i massimi della variazione; su un pianoro (bordo netto dopo la media: la variazione è costante
    // per qualche pixel) un bordo solo, al centro — sull'immagine sintetica se ne contavano 3-5
    for (let t = 4; t < along - 4; t++) {
      if (g[t] <= 40 || g[t] <= g[t - 1]) continue;
      let e = t;
      while (e + 1 < along - 4 && Math.abs(g[e + 1] - g[t]) < 1e-3) e++;
      // +0,5: la posizione è contata al centro dei pixel, il bordo fra due pixel sta mezzo pixel più in là
      if (g[e + 1] < g[t]) out.push([(t + e) / 2 + 0.5, g[t]]);
      t = e;
    }
  }
  return out;
}

/** Quanto i bordi cadono a multipli di `p` (0..1), e dove (la fase, in px). */
function alignment(edges: Array<[number, number]>, p: number): { c: number; phase: number } {
  let cs = 0, sn = 0, w = 0;
  for (const [v, k] of edges) { const a = (2 * Math.PI * v) / p; cs += k * Math.cos(a); sn += k * Math.sin(a); w += k; }
  const phase = (((Math.atan2(sn, cs) / (2 * Math.PI)) * p) % p + p) % p;
  return { c: w ? Math.hypot(cs, sn) / w : 0, phase };
}

/** Le V in un periodo: il numero intero che allinea meglio i bordi (il passo più largo fra i quasi migliori). */
function cellsInPeriod(edges: Array<[number, number]>, per: number, minPx = 4, maxPx = 40): { n: number; phase: number; c: number } {
  const res: Array<{ n: number; c: number; phase: number }> = [];
  for (let n = Math.max(1, Math.ceil(per / maxPx)); per / n >= minPx; n++) { const a = alignment(edges, per / n); res.push({ n, c: a.c, phase: a.phase }); }
  if (!res.length) return { n: 1, phase: 0, c: 0 };
  const top = Math.max(...res.map((r) => r.c));
  // il migliore; a pari merito (metà passo allinea gli stessi bordi) il passo più largo
  return res.filter((r) => r.c >= 0.98 * top).sort((a, b) => a.n - b.n)[0];
}

// ------------------------------------------------------------ 3. le righe (la trama)

/** Il passo della trama del filo lungo y: il picco della luminosità passa-alto per riga. */
function texturePeriodY(L: Float32Array, W: number, H: number, minP: number, maxP: number): number | null {
  // passa-alto: luminosità meno la media 13×13
  const r = 6;
  const rowsum = new Float64Array(H);
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += L[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * r + 1); s += L[y * W + Math.min(W - 1, x + r + 1)] - L[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { rowsum[y] += L[y * W + x] - s / (2 * r + 1); s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  let best = 0, bestP = 0, sumP = 0, k = 0;
  for (let p = minP; p <= maxP; p += 0.02) {
    let re = 0, im = 0;
    for (let y = 0; y < H; y++) { const a = (2 * Math.PI * y) / p; re += rowsum[y] * Math.cos(a); im += rowsum[y] * Math.sin(a); }
    const pw = Math.hypot(re, im); sumP += pw; k++;
    if (pw > best) { best = pw; bestP = p; }
  }
  // un picco vero spicca sulla media
  return k && best > 1.6 * (sumP / k) ? bestP : null;
}

// ------------------------------------------------------------ il modulo

export function findModule(px: Pixels, opts: ModuleOptions): FoundModule {
  const { rgba: data, width: W, height: H } = px;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.3 * data[4 * i] + 0.59 * data[4 * i + 1] + 0.11 * data[4 * i + 2];

  // 1. il periodo
  const MW = period(L, W, H, 'x'), MH = period(L, W, H, 'y');

  // 2. le colonne
  const sm = smooth(data, W, H);
  const ex = colorEdges(sm, W, H, 'x');
  const colsFound = cellsInPeriod(ex, MW);
  const MC = opts.cols && opts.cols > 0 ? opts.cols : colsFound.n;
  const cw = MW / MC;
  const ox = alignment(ex, cw).phase;

  // 3. le righe
  let MR = opts.rows && opts.rows > 0 ? opts.rows : 0;
  if (!MR) {
    const T = texturePeriodY(L, W, H, cw * 0.6, cw * 4.2);
    const cands: number[] = [];
    if (T) for (let k = 1; k <= 4; k++) cands.push(Math.round((MH / T) * k));
    else cands.push(Math.round(MH / cw));
    MR = cands.sort((a, b) => Math.abs(MH / a - cw) - Math.abs(MH / b - cw))[0];
  }
  const ch = MH / MR;
  const ey = colorEdges(sm, W, H, 'y');
  const oy = alignment(ey, ch).phase;

  // 4. il colore di ogni V, in tutte le copie
  const samples: Array<{ key: number; rgb: number[]; lab: Lab }> = [];
  const x0g = ox % cw, y0g = oy % ch;
  for (let j = 0; y0g + (j + 1) * ch <= H; j++) for (let i = 0; x0g + (i + 1) * cw <= W; i++) {
    const xa = Math.round(x0g + i * cw + cw * 0.25), xb = Math.max(xa + 1, Math.round(x0g + i * cw + cw * 0.75));
    const ya = Math.round(y0g + j * ch + ch * 0.25), yb = Math.max(ya + 1, Math.round(y0g + j * ch + ch * 0.75));
    const s = [0, 0, 0]; let n = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const k = 4 * (y * W + x); s[0] += data[k]; s[1] += data[k + 1]; s[2] += data[k + 2]; n++; }
    const rgb = s.map((v) => v / n);
    // la V (j, i) dell'immagine è la V (j mod MR, i mod MC) del motivo, contando dalla prima V intera
    samples.push({ key: (j % MR) * MC + (i % MC), rgb, lab: toLab(rgb[0], rgb[1], rgb[2]) });
  }

  // colori in Lab: k-means++ con più avvii (generatore fisso: stesso risultato a ogni giro)
  const K = Math.max(2, Math.min(12, opts.colors));
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let best: { err: number; lbl: number[] } | null = null;
  for (let run = 0; run < 8; run++) {
    const cen: number[][] = [samples[Math.floor(rnd() * samples.length)].lab];
    while (cen.length < K) {
      const ds = samples.map((c) => Math.min(...cen.map((q) => d2(c.lab, q))));
      const tot = ds.reduce((a, b) => a + b, 0);
      let t = rnd() * tot, i = 0; while (i < ds.length - 1 && t > ds[i]) { t -= ds[i]; i++; }
      cen.push([...samples[i].lab]);
    }
    let lbl: number[] = new Array(samples.length).fill(-1);
    for (let it = 0; it < 30; it++) {
      let changed = 0;
      const acc = Array.from({ length: K }, () => [0, 0, 0, 0]);
      for (let i = 0; i < samples.length; i++) {
        const c = samples[i].lab; let b = 0, bd = d2(c, cen[0]);
        for (let k = 1; k < K; k++) { const dd = d2(c, cen[k]); if (dd < bd) { bd = dd; b = k; } }
        if (lbl[i] !== b) { lbl[i] = b; changed++; }
        const a = acc[b]; a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; a[3]++;
      }
      for (let k = 0; k < K; k++) if (acc[k][3]) cen[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]];
      if (!changed) break;
    }
    const err = samples.reduce((a, c, i) => a + d2(c.lab, cen[lbl[i]]), 0);
    if (!best || err < best.err) best = { err, lbl };
  }
  const lbl = best!.lbl;
  const med = (arr: number[]) => { const s = [...arr].sort((p, q) => p - q); return s[s.length >> 1]; };
  const rgbOf = Array.from({ length: K }, (_, k) => { const m = samples.filter((_, i) => lbl[i] === k); return m.length ? [0, 1, 2].map((q) => Math.round(med(m.map((c) => c.rgb[q])))) : [0, 0, 0]; });

  // ogni V del motivo: la maggioranza delle sue copie
  const votes = Array.from({ length: MR * MC }, () => new Map<number, number>());
  samples.forEach((c, i) => { const v = votes[c.key]; v.set(lbl[i], (v.get(lbl[i]) ?? 0) + 1); });
  let map = votes.map((v) => { let b = 0, bn = -1; for (const [k, n] of v) if (n > bn) { bn = n; b = k; } return b; });
  let cols = MC, rows = MR, uncertain = 0;

  // 5. il modulo vero: metà uguali (a meno del rumore) → la metà, per maggioranza
  const reduce = (axis: 'x' | 'y') => {
    const half = axis === 'x' ? cols / 2 : rows / 2;
    if (!Number.isInteger(half) || half < 2) return false;
    let same = 0;
    for (let r = 0; r < (axis === 'y' ? half : rows); r++) for (let c = 0; c < (axis === 'x' ? half : cols); c++) {
      const a = map[r * cols + c], b = axis === 'x' ? map[r * cols + c + half] : map[(r + half) * cols + c];
      if (a === b) same++;
    }
    const total = (axis === 'x' ? half * rows : half * cols);
    if (same / total < 0.85) return false;
    const nc = axis === 'x' ? half : cols, nr = axis === 'y' ? half : rows;
    const next: number[] = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      const a = map[r * cols + c], b = axis === 'x' ? map[r * cols + c + half] : map[(r + half) * cols + c];
      // fra due copie diverse vince quella con più voti nell'immagine
      if (a === b) { next.push(a); continue; }
      const va = votes[r * cols + c]?.get(a) ?? 0, vb = (axis === 'x' ? votes[r * cols + c + half] : votes[(r + half) * cols + c])?.get(b) ?? 0;
      next.push(va >= vb ? a : b);
      uncertain++;
    }
    // i voti si sommano, per una riduzione successiva
    const nv: Array<Map<number, number>> = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      const m = new Map(votes[r * cols + c]);
      for (const [k, n] of (axis === 'x' ? votes[r * cols + c + half] : votes[(r + half) * cols + c])) m.set(k, (m.get(k) ?? 0) + n);
      nv.push(m);
    }
    votes.length = 0; votes.push(...nv);
    map = next; cols = nc; rows = nr;
    return true;
  };
  for (let guard = 0; guard < 6; guard++) { const a = reduce('x'), b = reduce('y'); if (!a && !b) break; }

  // 6. i colori finti: solo pezzetti → prendono il colore intorno
  let removed = 0;
  const comps = (k: number) => {
    const seen = new Set<number>(); const sizes: number[] = [];
    for (let i = 0; i < map.length; i++) {
      if (map[i] !== k || seen.has(i)) continue;
      const st = [i]; seen.add(i); let n = 0;
      while (st.length) { const x = st.pop()!; n++; const r = Math.floor(x / cols), c = x % cols; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const y = ((r + dr + rows) % rows) * cols + ((c + dc + cols) % cols); if (!seen.has(y) && map[y] === k) { seen.add(y); st.push(y); } } }
      sizes.push(n);
    }
    return sizes;
  };
  const used = [...new Set(map)];
  for (const k of used) {
    const sizes = comps(k);
    if (!sizes.length || sizes.length < 6) continue;
    const singles = sizes.filter((s) => s === 1).length;
    // colore finto: quasi solo V isolate, pezzi in media minuscoli (Fair Isle: 83% isolate, 1,3 V di
    // media; i fili veri da 3 V in su). «Mai più di 5 V» era fragile: mezzo pixel di griglia ne faceva 7.
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    if (singles / sizes.length >= 0.7 && mean <= 2) {
      removed++;
      for (let pass = 0; pass < 6; pass++) {
        let left = 0; const next = [...map];
        for (let i = 0; i < map.length; i++) {
          if (map[i] !== k) continue;
          const r = Math.floor(i / cols), c = i % cols; const cnt = new Map<number, number>();
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const v = map[((r + dr + rows) % rows) * cols + ((c + dc + cols) % cols)]; if (v !== k) cnt.set(v, (cnt.get(v) ?? 0) + 1); }
          if (!cnt.size) { left++; continue; }
          next[i] = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
        }
        map = next; if (!left) break;
      }
    }
  }

  // i fili: prima il più diffuso (la base), poi dal più chiaro al più scuro
  const count = new Map<number, number>(); for (const v of map) count.set(v, (count.get(v) ?? 0) + 1);
  const lum = (k: number) => 0.3 * rgbOf[k][0] + 0.59 * rgbOf[k][1] + 0.11 * rgbOf[k][2];
  const baseK = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const order = [baseK, ...[...count.keys()].filter((k) => k !== baseK).sort((a, b) => lum(b) - lum(a))];
  const ni = new Map(order.map((o, i) => [o, i]));
  const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  return {
    cols, rows,
    map: map.map((k) => ni.get(k)!),
    palette: order.map((k) => hex(rgbOf[k])),
    counts: order.map((k) => count.get(k)!),
    periodPx: { w: MW, h: MH },
    imageCells: { cols: MC, rows: MR },
    removed,
    uncertain,
    guidePx: { x: x0g, y: y0g, w: cols * cw, h: rows * ch },
  };
}

// ------------------------------------------------------------ il modulo nel ricamo

/**
 * Il modulo come sta nel ricamo: ogni V col suo punto e filo (null = vuota). `guide` = il pezzo
 * dell'immagine originale (px) che il modulo ricopia: si vede sopra il modulo per disegnarci sopra.
 * `drawn` = disegnato a mano (Nuovo modulo): cambiandone colonne e righe si allarga, non si ricava.
 */
export interface KnitModule { cols: number; rows: number; marks: Array<CellMark | null>; guide?: { x: number; y: number; w: number; h: number } | null; drawn?: boolean; }

/** Il ricamo = il modulo ripetuto su tutta la griglia, a partire dall'angolo in alto a sinistra. */
export function tileModule(g: GridSpec, mod: KnitModule): Cells {
  const out: Cells = new Map();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const m = mod.marks[(r % mod.rows) * mod.cols + (c % mod.cols)];
    if (m) out.set(r * g.cols + c, { ...m });
  }
  return out;
}

/**
 * Una modifica a mano su tutte le copie del modulo (Lorenzo: si disegna e si modifica una volta
 * sola): ogni cella toccata si ripete in ogni copia, e il modulo stesso cambia, così resta vero anche
 * se poi si cambiano le misure del ricamo.
 */
export function editsOnAllCopies(g: GridSpec, mod: KnitModule, edits: CellEdit[]): CellEdit[] {
  const out: CellEdit[] = [];
  const seen = new Set<number>();
  for (const e of edits) {
    const mr = ((e.r % mod.rows) + mod.rows) % mod.rows, mc = ((e.c % mod.cols) + mod.cols) % mod.cols;
    if (seen.has(mr * mod.cols + mc)) continue;
    seen.add(mr * mod.cols + mc);
    mod.marks[mr * mod.cols + mc] = e.mark ? { ...e.mark } : null;
    for (let r = mr; r < g.rows; r += mod.rows) for (let c = mc; c < g.cols; c += mod.cols) out.push({ r, c, mark: e.mark ? { ...e.mark } : null });
  }
  return out;
}

/** Il modulo con l'inizio spostato: la V (dr, dc) di prima diventa la prima (0, 0). */
export function shiftModule(mod: KnitModule, dr: number, dc: number): KnitModule {
  const R = mod.rows, C = mod.cols;
  const sr = ((dr % R) + R) % R, sc = ((dc % C) + C) % C;
  const marks: Array<CellMark | null> = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const m = mod.marks[((r + sr) % R) * C + ((c + sc) % C)];
    marks.push(m ? { ...m } : null);
  }
  // la guida scorre col modulo: la sua prima V è la V (sr, sc) di prima
  const guide = mod.guide ? { ...mod.guide, x: mod.guide.x + (sc * mod.guide.w) / C, y: mod.guide.y + (sr * mod.guide.h) / R } : mod.guide;
  return { cols: C, rows: R, marks, guide, drawn: mod.drawn };
}

/**
 * Il modulo disegnato a mano con altre colonne e righe: quello che c'era resta in alto a sinistra,
 * il nuovo si riempie con `fill` (la base). La guida resta lo stesso pezzo d'immagine.
 */
export function resizeModule(mod: KnitModule, cols: number, rows: number, fill: CellMark | null): KnitModule {
  const marks: Array<CellMark | null> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const m = r < mod.rows && c < mod.cols ? mod.marks[r * mod.cols + c] : fill;
    marks.push(m ? { ...m } : null);
  }
  return { cols, rows, marks, guide: mod.guide, drawn: mod.drawn };
}

/**
 * Dove far cominciare il modulo perché le giunture cadano sulla base: il bordo del modulo è
 * arbitrario, e se taglia un motivo il motivo finisce in due copie (e, coi passaggi per modulo,
 * cucito in due pezzi). Si cerca la colonna e la riga di giuntura che separano meno coppie di V
 * fuori dalla base (una V vuota conta come base). Restituisce lo spostamento per shiftModule.
 */
export function seamShift(mod: KnitModule, baseColor: number): { dr: number; dc: number; cutCols: number; cutRows: number } {
  const R = mod.rows, C = mod.cols;
  const design = (r: number, c: number) => { const m = mod.marks[((r + R) % R) * C + ((c + C) % C)]; return !!m && m.color !== baseColor; };
  // giuntura verticale prima della colonna c: coppie (c-1, c) entrambe di disegno, su tutte le righe
  let dc = 0, cutCols = Infinity;
  for (let c = 0; c < C; c++) {
    let n = 0; for (let r = 0; r < R; r++) if (design(r, c - 1) && design(r, c)) n++;
    if (n < cutCols) { cutCols = n; dc = c; }
  }
  let dr = 0, cutRows = Infinity;
  for (let r = 0; r < R; r++) {
    let n = 0; for (let c = 0; c < C; c++) if (design(r - 1, c) && design(r, c)) n++;
    if (n < cutRows) { cutRows = n; dr = r; }
  }
  return { dr, dc, cutCols, cutRows };
}

// Venature di filo SOPRA Interlace: lo strato scelto da Lorenzo il 2026-11-19 (il disegno «A» della ricerca).
// Sotto resta Interlace normale; sopra, venature come quelle della pelle "pull-up": fasci di venature SPESSE a fuso
// (andata e ritorno: il ritorno corre a poco dall'andata in mezzo e la raggiunge alle punte) e venature FINI a filo
// singolo che partono da una vena, ne attraversano qualcuna e si fermano su un'altra. Tutto in UN giro, senza salti:
// dove il filo dovrebbe staccare ripassa un tratto, scelto sulle spesse (le fini costano 25 volte di più), così le fini
// restano a filo singolo il più possibile.
// Motore puro (nessun DOM), locale all'app come engine.ts.
import { type Point, type Polyline, bounds, pointInPolygon } from '@rg/core';
import { buildMask, mulberry32 } from './engine';

export interface VeinParams {
  /** Venature sopra il ricamo: spente di serie. */
  veinsOn: boolean;
  /** Colore del filo delle venature (cucito per ultimo, sopra a tutto). */
  veinsColor: string;
  /** Quanti fasci di venature spesse (2-3 venature a fuso per fascio). */
  veinsBundles: number;
  /** Quante venature fini si provano a tracciare (quelle che non incontrano nessuna vena non si fanno). */
  veinsThin: number;
  /** Direzione delle venature, in gradi: 90 = scendono dritte, 0 = in orizzontale. */
  veinsAngleDeg: number;
  /** Variante: stesso numero = stesso disegno. */
  veinsSeed: number;
  /** Distanza da bordi e vuoti, la stessa del riempimento. */
  voidClearanceMm: number;
}

/** Un lato della rete com'è cucito: quante volte ci passa il filo e se è di una venatura spessa. */
export interface VeinEdge { a: Point; b: Point; passes: number; thick: boolean; repassed: number; }

export interface VeinResult {
  /** I tratti cuciti: uno solo quando la rete è tutta collegata (il caso normale). */
  runs: Point[][];
  edges: VeinEdge[];
  /** Nodi uniti perché a meno di FUSE_MM (gli incroci doppi dove una fine taglia un fuso). */
  fused: number;
  /** Venature fini aggiunte come ponte fra pezzi di rete staccati (perché il filo non stacchi). */
  bridges: number;
  /** Lunghezza delle venature spesse fatte una volta sola (le andate): il filo cucito sulle spesse ne è almeno il
   *  doppio, perché ognuna è andata e ritorno. */
  thickOneWayMm: number;
}

// Le misure della «A» (schizzo `venature8.py` della ricerca): non sono parametri di Lorenzo, sono la forma scelta.
const THICK_STEP: [number, number] = [2.2, 3.6]; // punto delle spesse (mm)
const THIN_STEP: [number, number] = [1.8, 3.2];  // punto delle fini, più corto: più spezzate
const SPINDLE_MM = 0.35;   // quanto il ritorno della spessa si scosta dall'andata, nel mezzo
const THIN_COST = 25;      // ripassare una fine costa 25 volte una spessa: i ripassi vanno sulle spesse
const FUSE_MM = 1;         // sotto questa misura due punti agli incroci si uniscono (punto minimo per la macchina)
const MIN_BEFORE_STOP = 8; // una fine non si ferma sulla prima vena prima di 8 mm
const MAX_THIN_MM = 90;
// Direzioni rispetto a `veinsAngleDeg` (nella A, a 82°: fasci 82/78/86/80 e uno coricato a 148; fini 60…160).
const BUNDLE_TURN = [0, -4, 4, -2, 66];
const THIN_TURN = [-22, -7, 18, 38, 58, 78];
const RAD = Math.PI / 180;
/** Davanti a un foro la vena gira di questi angoli (radianti, prima a un lato poi all'altro) e prosegue: si ferma solo al bordo. */
const SCARTO_FORO = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25];
/** La A era disegnata su 120×80 (120 di traverso alle vene, 80 lungo): i pezzi più grandi si dividono in riquadri così. */
const LUNG_A_MM = 80;
const LARGO_A_MM = 120;

/** Le venature dentro una sagoma (con i suoi vuoti). Pura e deterministica: stesso seme = stesso disegno. */
export function generateVeins(boundary: Polyline, voids: Polyline[], p: VeinParams): VeinResult {
  const empty: VeinResult = { runs: [], edges: [], fused: 0, bridges: 0, thickOneWayMm: 0 };
  if (!p.veinsOn || boundary.length < 3) return empty;
  const rnd = mulberry32((Math.round(p.veinsSeed) || 1) * 2654435761);
  const uni = (a: number, b: number) => a + rnd() * (b - a);
  const gauss = (s: number) => s * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const bb = bounds(boundary);
  const W = bb.maxX - bb.minX, H = bb.maxY - bb.minY;
  const mask = buildMask(boundary, voids, 0.3);
  const clear = Math.max(0, p.voidClearanceMm) + 0.5 * mask.res;
  const inside = (x: number, y: number) => mask.sdf(x, y) >= clear;
  const segInside = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (mask.res * 0.9)));
    for (let k = 0; k <= n; k++) if (!inside(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
    return true;
  };
  const D = p.veinsAngleDeg * RAD;
  /** Un passo della vena da (x,y) con angolo `a`: se finisce fuori dalla sagoma la vena si ferma (null); se va in un
   *  foro, gira di poco a un lato o all'altro e prosegue. Senza fori è il passo dritto di sempre. */
  const passo = (x: number, y: number, a: number, L: number): [number, number] | null => {
    const nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
    if (inside(nx, ny) && segInside(x, y, nx, ny)) return [nx, ny];
    if (!voids.length || !pointInPolygon({ x: nx, y: ny }, boundary)) return null;
    for (const da of SCARTO_FORO) {
      const mx = x + Math.cos(a + da) * L, my = y + Math.sin(a + da) * L;
      if (inside(mx, my) && segInside(x, y, mx, my)) return [mx, my];
    }
    return null;
  };
  const campo = (x: number, y: number, a0: number, s: number) => {
    const u = x - bb.minX, v = y - bb.minY;
    return a0 + 0.42 * Math.sin(u / 33 + 0.9 * Math.sin(v / 24) + s) + 0.18 * Math.sin(v / 12 + u / 39 + 2 * s);
  };

  // --- la rete: nodi, lati con le passate, e una griglia per trovare in fretta i lati vicini ---
  const X: number[] = [], Y: number[] = [];
  interface Lato { a: number; b: number; m: number; thick: boolean; }
  const E = new Map<number, Lato>();
  const K = 1 << 21;
  const keyOf = (a: number, b: number) => Math.min(a, b) * K + Math.max(a, b);
  const G = 4;
  const gw = Math.ceil(W / G) + 2;
  const cells = new Map<number, Set<number>>();
  const cellsOf = (ax: number, ay: number, bx: number, by: number): number[] => {
    const i0 = Math.floor((Math.min(ax, bx) - bb.minX) / G) + 1, i1 = Math.floor((Math.max(ax, bx) - bb.minX) / G) + 1;
    const j0 = Math.floor((Math.min(ay, by) - bb.minY) / G) + 1, j1 = Math.floor((Math.max(ay, by) - bb.minY) / G) + 1;
    const out: number[] = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(j * gw + i);
    return out;
  };
  const nodo = (x: number, y: number) => { X.push(x); Y.push(y); return X.length - 1; };
  const lato = (a: number, b: number, m: number, thick: boolean) => {
    if (a === b) return;
    const k = keyOf(a, b);
    const e = E.get(k);
    if (e) { e.m += m; e.thick = e.thick || thick; return; }
    E.set(k, { a: Math.min(a, b), b: Math.max(a, b), m, thick });
    for (const c of cellsOf(X[a], Y[a], X[b], Y[b])) { let s = cells.get(c); if (!s) cells.set(c, s = new Set()); s.add(k); }
  };
  const togli = (k: number) => {
    const e = E.get(k)!; E.delete(k);
    for (const c of cellsOf(X[e.a], Y[e.a], X[e.b], Y[e.b])) cells.get(c)?.delete(k);
    return e;
  };
  const spezza = (k: number, x: number, y: number) => {
    const e = togli(k); const q = nodo(x, y);
    lato(e.a, q, e.m, e.thick); lato(q, e.b, e.m, e.thick);
    return q;
  };
  /** Il primo lato esistente tagliato dal segmento (escluso chi tocca `cur`): frazione lungo il segmento e chiave. */
  const taglia = (cur: number, ax: number, ay: number, bx: number, by: number): { t: number; k: number } | null => {
    let best: { t: number; k: number } | null = null;
    const visti = new Set<number>();
    for (const c of cellsOf(ax, ay, bx, by)) {
      const s = cells.get(c); if (!s) continue;
      for (const k of s) {
        if (visti.has(k)) continue; visti.add(k);
        const e = E.get(k)!; if (e.a === cur || e.b === cur) continue;
        const rx = X[e.a], ry = Y[e.a], sx = X[e.b], sy = Y[e.b];
        const d = (bx - ax) * (sy - ry) - (by - ay) * (sx - rx);
        if (Math.abs(d) < 1e-9) continue;
        const t = ((rx - ax) * (sy - ry) - (ry - ay) * (sx - rx)) / d;
        const u = ((rx - ax) * (by - ay) - (ry - ay) * (bx - ax)) / d;
        if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98 && (!best || t < best.t)) best = { t, k };
      }
    }
    return best;
  };
  /** Mette nella rete una linea di punti: ogni incrocio con un lato esistente diventa un nodo comune. */
  const cuci = (pts: Array<[number, number]>, thick: boolean, start: number | null): number[] => {
    let cur = start ?? nodo(pts[0][0], pts[0][1]);
    const nodi = [cur];
    let x = X[cur], y = Y[cur];
    for (let i = 1; i < pts.length; i++) {
      const [nx, ny] = pts[i];
      for (;;) {
        const h = taglia(cur, x, y, nx, ny);
        if (!h) break;
        const qx = x + (nx - x) * h.t, qy = y + (ny - y) * h.t;
        const q = spezza(h.k, qx, qy);
        lato(cur, q, 1, thick); cur = q; nodi.push(q); x = qx; y = qy;
      }
      const q = nodo(nx, ny); lato(cur, q, 1, thick); cur = q; nodi.push(q); x = nx; y = ny;
    }
    return nodi;
  };
  const traccia = (x: number, y: number, a0: number, lung: number, s: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [[x, y]];
    let fatto = 0;
    while (fatto < lung) {
      const L = uni(THICK_STEP[0], THICK_STEP[1]);
      const a = campo(x, y, a0, s) + gauss(0.08);
      const q = passo(x, y, a, L);
      if (!q) break;
      const [nx, ny] = q;
      pts.push([nx, ny]); x = nx; y = ny; fatto += L;
    }
    return pts;
  };
  const puntoDentro = (x0: number, x1: number, y0: number, y1: number): [number, number] | null => {
    for (let t = 0; t < 60; t++) {
      const x = uni(x0, x1), y = uni(y0, y1);
      if (inside(x, y)) return [x, y];
    }
    for (let t = 0; t < 200; t++) {
      const x = uni(bb.minX, bb.maxX), y = uni(bb.minY, bb.maxY);
      if (inside(x, y)) return [x, y];
    }
    return null;
  };

  // 1) fasci di spesse a fuso, come nella A. Lorenzo (2026-11-23), sul suo pezzo grande: prima «perchè le venature
  //    sono solo a destra? Serve un algoritmo in grado di crearle su tutta la superficie», poi, con i fasci sparsi in
  //    strisce parallele dall'alto in basso, «a me ancora così non mi sembra troppa pelle». La A era 120×80: lì i fasci
  //    si incrociano in direzioni diverse. Allora il pezzo è diviso in RIQUADRI della misura della A (di traverso e
  //    lungo la direzione delle vene) e ogni riquadro ha la sua composizione A, con la direzione girata un po'
  //    (tranne quando il riquadro è uno solo: allora è la A). I fasci sconfinano nei riquadri vicini e si incrociano.
  //    Nel riquadro: i fasci nella direzione principale partono dal lato "a monte", ognuno nella sua fetta di
  //    larghezza; i coricati dentro il riquadro. `veinsBundles` e `veinsThin` sono i numeri per riquadro.
  const tx = Math.cos(D), ty = Math.sin(D), nx = -ty, ny = tx;
  const angoli = [[bb.minX, bb.minY], [bb.maxX, bb.minY], [bb.minX, bb.maxY], [bb.maxX, bb.maxY]];
  const tP = angoli.map(([x, y]) => x * tx + y * ty), nP = angoli.map(([x, y]) => x * nx + y * ny);
  const tMin = Math.min(...tP), tMax = Math.max(...tP), nMin = Math.min(...nP), nMax = Math.max(...nP);
  const riqN = Math.max(1, Math.round((nMax - nMin) / LARGO_A_MM)), riqT = Math.max(1, Math.round((tMax - tMin) / LUNG_A_MM));
  const dn = (nMax - nMin) / riqN, dt = (tMax - tMin) / riqT;
  const perRiquadro = Math.round(Math.max(0, p.veinsBundles));
  const partenza = (n0: number, n1: number, t0: number, t1: number, allarga: boolean): [number, number] | null => {
    for (let k = 0; k < 80; k++) {
      // se la fascia a monte cade fuori dalla sagoma (bordi tondi, forme strane, fori) la si allarga verso l'interno
      const hi = allarga ? t1 + dt * 0.6 * (k / 80) : t1;
      const n = uni(n0, n1), t = uni(t0, hi);
      const x = t * tx + n * nx, y = t * ty + n * ny;
      if (inside(x, y)) return [x, y];
    }
    return null;
  };
  const thickNodes = new Set<number>();
  let thickOneWayMm = 0;
  let f = 0;
  for (let rt = 0; rt < riqT; rt++) for (let rn = 0; rn < riqN; rn++) {
    const giro = riqN * riqT > 1 ? gauss(16 * RAD) : 0;
    const n0r = nMin + rn * dn, t0r = tMin + rt * dt;
    const fetta = (dn - 10) / Math.max(1, perRiquadro);
    for (let q = 0; q < perRiquadro; q++, f++) {
    const turn = BUNDLE_TURN[q % BUNDLE_TURN.length];
    const a0 = D + giro + turn * RAD, s = f;
    const coricato = turn > 30;
    const n0 = n0r + 5 + q * fetta, n1 = n0 + fetta;
    const start = coricato
      ? partenza(n0, n1, t0r + 15, t0r + dt - 15, false)
      : partenza(n0, n1, t0r + 1, t0r + 10, true);
    if (!start) continue;
    const linee = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < linee; k++) {
      const sx = start[0] + gauss(3.5), sy = start[1] + gauss(2);
      if (!inside(sx, sy)) continue;
      const andata = traccia(sx, sy, a0, uni(45, 95), s);
      const n = andata.length;
      if (n < 6) continue;
      const ritorno: Array<[number, number]> = [];
      for (let i = n - 2; i >= 1; i--) {
        const [px, py] = andata[i]; const [qx, qy] = andata[i + 1]; const [rx, ry] = andata[i - 1];
        const tx = qx - rx, ty = qy - ry, L = Math.hypot(tx, ty) || 1;
        const off = SPINDLE_MM * Math.pow(Math.max(0, Math.sin(Math.PI * i / (n - 1))), 1.2);
        const cx = px - ty / L * off, cy = py + tx / L * off;
        ritorno.push(inside(cx, cy) ? [cx, cy] : [px, py]);
      }
      for (let i = 1; i < n; i++) thickOneWayMm += Math.hypot(andata[i][0] - andata[i - 1][0], andata[i][1] - andata[i - 1][1]);
      const nodi = cuci(andata, true, null);
      const last = nodi[nodi.length - 1];
      const nodiR = cuci([[X[last], Y[last]], ...ritorno], true, last);
      lato(nodiR[nodiR.length - 1], nodi[0], 1, true);
      for (const q of nodi) thickNodes.add(q);
      for (const q of nodiR) thickNodes.add(q);
    }
    }
  }
  if (E.size === 0) return empty;

  // 2) fini: da una vena (70% da una spessa), camminano finché incontrano un'altra vena dopo almeno 8 mm; spesso
  //    la attraversano (0-2 volte) e vanno avanti; finiscono su una vena, o al bordo come nella A.
  // anche le fini sono per riquadro, come i fasci
  const fini = Math.round(Math.max(0, p.veinsThin)) * riqN * riqT;
  for (let k = 0; k < fini; k++) {
    const pool = rnd() < 0.7 && thickNodes.size ? [...thickNodes] : X.map((_, i) => i);
    let cur = pool[Math.floor(rnd() * pool.length)];
    if (!E.size) break;
    const a0 = D + THIN_TURN[Math.floor(rnd() * THIN_TURN.length)] * RAD;
    const verso = rnd() < 0.5 ? -1 : 1;
    let attraversa = Math.floor(rnd() * 3);
    let x = X[cur], y = Y[cur], fatto = 0;
    while (fatto < MAX_THIN_MM) {
      const L = uni(THIN_STEP[0], THIN_STEP[1]);
      const a = campo(x, y, a0, 7 + k) + (verso > 0 ? 0 : Math.PI) + gauss(0.22);
      const q0 = passo(x, y, a, L);
      if (!q0) break;
      const [nx, ny] = q0;
      const h = taglia(cur, x, y, nx, ny);
      if (h) {
        const qx = x + (nx - x) * h.t, qy = y + (ny - y) * h.t;
        const q = spezza(h.k, qx, qy); lato(cur, q, 1, false); cur = q; x = qx; y = qy; fatto += L * h.t;
        if (fatto > MIN_BEFORE_STOP) { if (attraversa > 0) { attraversa--; continue; } break; }
        continue;
      }
      const q = nodo(nx, ny); lato(cur, q, 1, false); cur = q; x = nx; y = ny; fatto += L;
    }
  }

  // 2b) PONTI: se la rete è in più pezzi (fasci che nessuna fine ha collegato, o un pezzo grande con pochi fasci) il
  //     filo dovrebbe staccare. Allora una venatura fine fa da ponte fra i due nodi più vicini di due pezzi, con lo
  //     stesso passo spezzato delle fini. Se fra i due c'è un vuoto e il ponte non passa, resta il salto.
  let bridges = 0;
  for (let giro = 0; giro < 50; giro++) {
    const pezzo = new Map<number, number>();
    const vicini = new Map<number, number[]>();
    for (const e of E.values()) {
      if (!vicini.has(e.a)) vicini.set(e.a, []); if (!vicini.has(e.b)) vicini.set(e.b, []);
      vicini.get(e.a)!.push(e.b); vicini.get(e.b)!.push(e.a);
    }
    let n = 0;
    for (const s of vicini.keys()) {
      if (pezzo.has(s)) continue;
      const st = [s]; pezzo.set(s, n);
      while (st.length) { const u = st.pop()!; for (const v of vicini.get(u)!) if (!pezzo.has(v)) { pezzo.set(v, n); st.push(v); } }
      n++;
    }
    if (n <= 1) break;
    // il pezzo 0 contro tutti gli altri: la coppia di nodi più vicina che si può collegare restando nella sagoma
    const nodi0: number[] = [], altri: number[] = [];
    for (const [q, c] of pezzo) (c === 0 ? nodi0 : altri).push(q);
    let best: { u: number; v: number; d: number } | null = null;
    for (const u of nodi0) for (const v of altri) {
      const d = Math.hypot(X[u] - X[v], Y[u] - Y[v]);
      if (d > 0 && (!best || d < best.d) && segInside(X[u], Y[u], X[v], Y[v])) best = { u, v, d };
    }
    if (!best) break;
    const passi = Math.max(1, Math.round(best.d / uni(THIN_STEP[0], THIN_STEP[1])));
    const tx = (X[best.v] - X[best.u]) / best.d, ty = (Y[best.v] - Y[best.u]) / best.d;
    const pts: Array<[number, number]> = [[X[best.u], Y[best.u]]];
    for (let i = 1; i < passi; i++) {
      const w = gauss(0.35), px = X[best.u] + (X[best.v] - X[best.u]) * i / passi - ty * w, py = Y[best.u] + (Y[best.v] - Y[best.u]) * i / passi + tx * w;
      pts.push(inside(px, py) ? [px, py] : [X[best.u] + (X[best.v] - X[best.u]) * i / passi, Y[best.u] + (Y[best.v] - Y[best.u]) * i / passi]);
    }
    const nodi = pts.length > 1 ? cuci(pts, false, best.u) : [best.u];
    lato(nodi[nodi.length - 1], best.v, 1, false);
    bridges++;
  }

  // 3) FUSIONE: agli incroci doppi (una fine che taglia le due linee di un fuso) restano punti sotto 1 mm. I due capi
  //    di un lato così corto diventano un nodo solo, finché non ne resta nessuno.
  const parent = X.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  let lati = [...E.values()].map((e) => ({ ...e }));
  let fused = 0;
  for (let giro = 0; giro < 12; giro++) {
    let cambiato = false;
    for (const e of lati) {
      const a = find(e.a), b = find(e.b);
      if (a === b) continue;
      if (Math.hypot(X[a] - X[b], Y[a] - Y[b]) < FUSE_MM) {
        X[a] = (X[a] + X[b]) / 2; Y[a] = (Y[a] + Y[b]) / 2; parent[b] = a; fused++; cambiato = true;
      }
    }
    const uniti = new Map<number, Lato>();
    for (const e of lati) {
      const a = find(e.a), b = find(e.b);
      if (a === b) continue;
      const k = keyOf(a, b), u = uniti.get(k);
      if (u) { u.m += e.m; u.thick = u.thick || e.thick; } else uniti.set(k, { a: Math.min(a, b), b: Math.max(a, b), m: e.m, thick: e.thick });
    }
    lati = [...uniti.values()];
    if (!cambiato) break;
  }

  // 4) UN GIRO SOLO: dove la rete ha nodi con un numero dispari di passate il filo dovrebbe staccare; si appaiano
  //    col cammino più economico (le fini costano THIN_COST) e quel cammino si ripassa.
  const adj = new Map<number, Array<{ v: number; e: number }>>();
  lati.forEach((e, i) => {
    if (!adj.has(e.a)) adj.set(e.a, []); if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ v: e.b, e: i }); adj.get(e.b)!.push({ v: e.a, e: i });
  });
  const len = (e: Lato) => Math.hypot(X[e.a] - X[e.b], Y[e.a] - Y[e.b]);
  const rip = new Array<number>(lati.length).fill(0);
  const comp = new Map<number, number>();
  let nComp = 0;
  for (const s of adj.keys()) {
    if (comp.has(s)) continue;
    const st = [s]; comp.set(s, nComp);
    while (st.length) { const u = st.pop()!; for (const { v } of adj.get(u)!) if (!comp.has(v)) { comp.set(v, nComp); st.push(v); } }
    nComp++;
  }
  const grado = (n: number) => adj.get(n)!.reduce((s, { e }) => s + lati[e].m + rip[e], 0);
  const dijkstra = (a: number) => {
    const Dm = new Map<number, number>([[a, 0]]); const prev = new Map<number, { u: number; e: number }>();
    const heap: Array<[number, number]> = [[0, a]];
    const push = (it: [number, number]) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pI = (i - 1) >> 1; if (heap[pI][0] <= heap[i][0]) break; [heap[pI], heap[i]] = [heap[i], heap[pI]]; i = pI; } };
    const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop();
      if (d > (Dm.get(u) ?? Infinity)) continue;
      for (const { v, e } of adj.get(u)!) {
        const w = d + len(lati[e]) * (lati[e].thick ? 1 : THIN_COST);
        if (w < (Dm.get(v) ?? Infinity)) { Dm.set(v, w); prev.set(v, { u, e }); push([w, v]); }
      }
    }
    return { Dm, prev };
  };
  for (let c = 0; c < nComp; c++) {
    const rest = [...adj.keys()].filter((n) => comp.get(n) === c && grado(n) % 2 === 1);
    while (rest.length > 2) {
      const a = rest.shift()!;
      const { Dm, prev } = dijkstra(a);
      let bi = 0;
      for (let i = 1; i < rest.length; i++) if ((Dm.get(rest[i]) ?? Infinity) < (Dm.get(rest[bi]) ?? Infinity)) bi = i;
      const b = rest.splice(bi, 1)[0];
      for (let v = b; v !== a;) { const st = prev.get(v)!; rip[st.e]++; v = st.u; }
    }
  }
  // Hierholzer per ogni pezzo collegato: un tratto per pezzo (di norma uno solo)
  const usati = new Array<number>(lati.length).fill(0);
  const quante = lati.map((e, i) => e.m + rip[i]);
  const ptr = new Map<number, number>();
  const runs: Point[][] = [];
  const fatti = new Set<number>();
  for (const s0 of adj.keys()) {
    const c = comp.get(s0)!;
    if (fatti.has(c)) continue;
    fatti.add(c);
    const disp = [...adj.keys()].filter((n) => comp.get(n) === c && grado(n) % 2 === 1);
    const start = disp.length ? disp[0] : s0;
    const st = [start], giro: number[] = [];
    while (st.length) {
      const u = st[st.length - 1];
      const lista = adj.get(u)!;
      let i = ptr.get(u) ?? 0;
      while (i < lista.length && usati[lista[i].e] >= quante[lista[i].e]) i++;
      ptr.set(u, i);
      if (i < lista.length) { usati[lista[i].e]++; st.push(lista[i].v); }
      else giro.push(st.pop()!);
    }
    if (giro.length >= 2) runs.push(giro.reverse().map((n) => ({ x: X[n], y: Y[n] })));
  }
  const edges: VeinEdge[] = lati.map((e, i) => ({ a: { x: X[e.a], y: Y[e.a] }, b: { x: X[e.b], y: Y[e.b] }, passes: quante[i], thick: e.thick, repassed: rip[i] }));
  return { runs, edges, fused, bridges, thickOneWayMm };
}

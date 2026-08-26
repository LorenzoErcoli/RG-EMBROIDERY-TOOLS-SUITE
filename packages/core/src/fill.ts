// Riempimento a righe parallele — il **raso/tatami** della Costituzione (R24).
//
// Perché sta nel core. R24 lo chiama testualmente «il grande assente»: la tassonomia dei punti lo
// dà per canonico, la §6 lo prevede nel modulo `stitch-types`, e due tool lo stanno aspettando —
// `apps/broccato`, che ne ha bisogno adesso, e net-45, dove le aree di raso escono ancora come
// FORME da riempire a mano su Stilista (voce A4 della lista in STATO).
//
// Cosa fa e cosa NON fa. Genera le **corse** di riempimento dentro un poligono con i suoi fori,
// nell'ordine in cui si cuciono, e si ferma lì: **non le collega**. Il collegamento è routing
// (passo 7 della pipeline canonica) e dipende da cose che il riempimento non sa — se il passaggio
// va nascosto sotto un colore successivo (R16), se deve girare attorno a un vuoto (R5). Tenerli
// separati è ciò che permette a broccato di instradare i passaggi sotto la copertura e a net-45 di
// non farlo. Il minimo del punto (R3) si impone dopo, come sempre.

import type { Point, Polyline } from './types';

/**
 * Come si percorre una riga.
 * - `serpentine` — andata e ritorno alternati riga per riga: una passata sola su ogni riga, resa
 *   leggera. È il «normale».
 * - `comb` — **a pettine**: la riga si percorre e si ritorna sulla stessa, sfalsando il ritorno di
 *   `retraceOffsetMm` per non ricadere negli stessi buchi. Doppio filo → tratto marcato. Misurato
 *   sul DST di riferimento del broccato: sale di 0,9mm, esce di 3,4mm, rientra 0,1mm più sotto.
 */
export type FillMode = 'serpentine' | 'comb';

export interface ParallelFillOptions {
  /** Orientamento delle righe (R24 `fillAngleDeg`). 0 = orizzontali. */
  angleDeg?: number;
  /** Passo trasversale fra due righe (R22 `densitySpacingMm`). Piccolo = fitto. */
  spacingMm: number;
  /** Passo massimo lungo la riga (R4): le corse lunghe si suddividono, la forma non cambia. */
  maxStitchMm?: number;
  mode?: FillMode;
  /** Solo `comb`: di quanto il ritorno si sposta verso la riga successiva. Limitato a metà passo. */
  retraceOffsetMm?: number;
  /**
   * Dove cade la griglia delle righe, misurato di traverso. Le righe stanno su multipli di
   * `spacingMm` a partire da qui, **in coordinate assolute** — non dal bordo della forma.
   *
   * È la ragione per cui due macchie separate dello stesso colore hanno le righe **alla stessa
   * quota**: ancorandole alla forma, ogni macchia partirebbe per conto suo e sul ricamo si
   * vedrebbero le giunte.
   */
  gridOriginMm?: number;
}

const rot = (p: Point, c: number, s: number): Point => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });

/** Le ascisse in cui la retta orizzontale `v` attraversa il bordo (contorno + fori), ordinate. */
function crossings(rings: Polyline[], v: number): number[] {
  const xs: number[] = [];
  for (const ring of rings) {
    const n = ring.length;
    if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      // regola pari-dispari: il vertice conta una volta sola (estremo basso incluso, alto escluso)
      if ((a.y <= v && b.y > v) || (b.y <= v && a.y > v)) {
        xs.push(a.x + ((v - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
  }
  return xs.sort((p, q) => p - q);
}

/** Gli intervalli dentro UN anello sulla retta `v`: le attraversate a coppie (pari-dispari). */
function ringSpans(ring: Polyline, v: number): Array<[number, number]> {
  const xs = crossings([ring], v);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-9) out.push([xs[i], xs[i + 1]]);
  return out;
}

/** `a` meno `b`, su intervalli ordinati della stessa retta. */
function subtractSpans(a: Array<[number, number]>, b: Array<[number, number]>): Array<[number, number]> {
  let cur = a;
  for (const [b0, b1] of b) {
    const next: Array<[number, number]> = [];
    for (const [x0, x1] of cur) {
      if (b1 <= x0 || b0 >= x1) { next.push([x0, x1]); continue; }   // non si toccano
      if (b0 > x0) next.push([x0, b0]);
      if (b1 < x1) next.push([b1, x1]);
    }
    cur = next;
  }
  return cur.filter(([x0, x1]) => x1 - x0 > 1e-9);
}

/**
 * Gli intervalli DENTRO la forma: dentro il contorno **meno** i fori.
 *
 * Non basta il pari-dispari su contorno e fori messi insieme: quella regola dà la differenza
 * simmetrica, e un foro che sporge dal contorno finirebbe per *aggiungere* riempimento **fuori**
 * dalla forma. Trovato da un test con un foro più grande del pezzo: usciva un riempimento di 82
 * punti dove doveva uscire il nulla.
 */
function spans(outerRing: Polyline, holeRings: Polyline[], v: number): Array<[number, number]> {
  const dentro = ringSpans(outerRing, v);
  if (!dentro.length || !holeRings.length) return dentro;
  const fuori: Array<[number, number]> = [];
  for (const h of holeRings) fuori.push(...ringSpans(h, v));
  return subtractSpans(dentro, fuori);
}

/** Le ascisse dei punti-ago lungo una corsa, capo compreso (R4: si suddivide, non si sposta). */
function subdivide(x0: number, x1: number, maxStitchMm: number): number[] {
  const len = Math.abs(x1 - x0);
  const n = maxStitchMm > 0 ? Math.max(1, Math.ceil(len / maxStitchMm)) : 1;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(x0 + ((x1 - x0) * i) / n);
  return out;
}

/**
 * Riempie `outer` (meno i suoi `holes`) di righe parallele, e restituisce le **corse in ordine di
 * cucitura**. Ogni corsa è una polilinea; con `comb` la corsa contiene già andata e ritorno.
 *
 * Le corse NON sono collegate fra loro: il collegamento è routing, e chi chiama sa cose che qui
 * non si sanno (sotto cosa va nascosto il passaggio, quali vuoti aggirare).
 */
export function buildParallelFill(
  outer: Polyline,
  holes: Polyline[],
  opts: ParallelFillOptions,
): Polyline[] {
  const spacing = opts.spacingMm;
  if (!outer || outer.length < 3 || !(spacing > 0)) return [];

  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;
  const mode: FillMode = opts.mode ?? 'serpentine';
  const offset = Math.min(Math.max(opts.retraceOffsetMm ?? 0, 0), spacing / 2);
  const origin = opts.gridOriginMm ?? 0;

  // Si ruota tutto di −angolo: le righe tornano orizzontali e il resto è una scansione banale.
  const a = ((opts.angleDeg ?? 0) * Math.PI) / 180;
  const cf = Math.cos(-a), sf = Math.sin(-a);
  const cb = Math.cos(a), sb = Math.sin(a);
  const outerR: Polyline = outer.map((p) => rot(p, cf, sf));
  const holeR: Polyline[] = (holes ?? []).filter((h) => h && h.length >= 3).map((r) => r.map((p) => rot(p, cf, sf)));

  let minV = Infinity, maxV = -Infinity;
  for (const p of outerR) { if (p.y < minV) minV = p.y; if (p.y > maxV) maxV = p.y; }
  if (!Number.isFinite(minV) || maxV - minV <= 0) return [];

  const kStart = Math.ceil((minV - origin) / spacing);
  const kEnd = Math.floor((maxV - origin) / spacing);

  // ---------------------------------------------------------------------------------------
  // 1. I tratti pieni di ogni riga.
  // ---------------------------------------------------------------------------------------
  interface Riga { v: number; tratti: Array<[number, number]>; ritorni: Array<[number, number] | null>; }
  const righe: Riga[] = [];
  for (let k = kStart; k <= kEnd; k++) {
    const v = origin + k * spacing;
    let tratti = spans(outerR, holeR, v);
    if (!tratti.length) { righe.push({ v, tratti: [], ritorni: [] }); continue; }

    // Col pettine il ritorno corre a `v + offset`: si tiene solo la parte percorribile a ENTRAMBE
    // le quote, altrimenti su un bordo obliquo il ritorno uscirebbe dalla forma.
    let ritorni: Array<[number, number] | null> = tratti.map(() => null);
    if (mode === 'comb' && offset > 0) {
      const altri = spans(outerR, holeR, v + offset);
      ritorni = tratti.map(([x0, x1]) => {
        let best: [number, number] | null = null, bestLen = 0;
        for (const [y0, y1] of altri) {
          const lo = Math.max(x0, y0), hi = Math.min(x1, y1);
          if (hi - lo > bestLen) { bestLen = hi - lo; best = [lo, hi]; }
        }
        return best;
      });
      tratti = tratti.map(([x0, x1], t) => (ritorni[t] ? (ritorni[t] as [number, number]) : [x0, x1]));
    }
    righe.push({ v, tratti, ritorni });
  }

  // ---------------------------------------------------------------------------------------
  // 2. Le CAMERE: catene di tratti che si sovrappongono da una riga alla successiva.
  //
  // Senza questo passo il riempimento va riga per riga su tutta la forma, e su una macchia
  // frastagliata — dove una riga si spezza in più tratti — l'ago finisce per attraversarla
  // avanti e indietro a ogni riga. È il difetto che Lorenzo ha visto per primo guardando
  // l'anteprima: «la macchia dovrebbe lavorare da un punto e arrivare a un altro, senza mille
  // passaggi interni».
  //
  // La catena si spezza dove la forma si biforca o si richiude (un tratto con due figli, o due
  // padri): lì una camera finisce e ne cominciano altre. Ogni camera è una zona in cui si scende
  // riga per riga senza mai tornare indietro.
  // ---------------------------------------------------------------------------------------
  const sovrappone = (a: [number, number], b: [number, number]): boolean =>
    Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 1e-9;

  interface Cella { r: number; t: number; }
  const figli: number[][][] = righe.map(() => []);
  const padri: number[][][] = righe.map(() => []);
  for (let r = 0; r + 1 < righe.length; r++) {
    figli[r] = righe[r].tratti.map(() => []);
    padri[r + 1] = righe[r + 1].tratti.map(() => []);
  }
  if (righe.length) { figli[righe.length - 1] = righe[righe.length - 1].tratti.map(() => []); }
  if (righe.length) { padri[0] = righe[0].tratti.map(() => []); }
  for (let r = 0; r + 1 < righe.length; r++) {
    for (let a = 0; a < righe[r].tratti.length; a++) {
      for (let b = 0; b < righe[r + 1].tratti.length; b++) {
        if (sovrappone(righe[r].tratti[a], righe[r + 1].tratti[b])) {
          figli[r][a].push(b);
          padri[r + 1][b].push(a);
        }
      }
    }
  }

  const preso: boolean[][] = righe.map((x) => x.tratti.map(() => false));
  const camere: Cella[][] = [];
  for (let r = 0; r < righe.length; r++) {
    for (let t = 0; t < righe[r].tratti.length; t++) {
      if (preso[r][t]) continue;
      // una camera comincia dove non c'è un padre unico che la continui
      if (padri[r][t].length === 1) {
        const p = padri[r][t][0];
        if (figli[r - 1][p].length === 1) continue;   // la continua la camera del padre
      }
      const camera: Cella[] = [];
      let cr = r, ct = t;
      for (;;) {
        preso[cr][ct] = true;
        camera.push({ r: cr, t: ct });
        if (cr + 1 >= righe.length) break;
        const f = figli[cr][ct];
        if (f.length !== 1) break;                    // si biforca: la camera finisce qui
        const nt = f[0];
        if (padri[cr + 1][nt].length !== 1) break;    // due rami si richiudono: idem
        if (preso[cr + 1][nt]) break;
        cr += 1; ct = nt;
      }
      camere.push(camera);
    }
  }

  // ---------------------------------------------------------------------------------------
  // 3. Le corse, camera per camera.
  // ---------------------------------------------------------------------------------------
  const runs: Polyline[] = [];
  for (const camera of camere) {
    camera.forEach((cella, idx) => {
      const { r, t } = cella;
      const riga = righe[r];
      const [x0, x1] = riga.tratti[t];
      if (x1 - x0 <= 1e-9) return;
      const v = riga.v;

      /*
       * Da che parte si parte.
       *
       * Serpentina: si alterna dentro la camera — la riga finisce dove comincia la successiva.
       *
       * Pettine: si parte SEMPRE dalla stessa parte, perché la corsa **torna dov'era partita**.
       * Alternando, l'ago dovrebbe attraversare tutta la macchia a ogni riga per raggiungere il
       * capo opposto: misurato, il filo di solo passaggio passava a 25,8 m su 62,9 di totale.
       */
      const avanti = mode === 'comb' ? true : idx % 2 === 0;
      const da = avanti ? x0 : x1, a2 = avanti ? x1 : x0;
      const xs = subdivide(da, a2, maxStitch);

      if (mode !== 'comb') {
        runs.push(xs.map((x) => rot({ x, y: v }, cb, sb)));
        return;
      }

      /*
       * La voltata del pettine è una DIAGONALE, non un gradino.
       *
       * Lo scostamento sta sull'**ultimo punto dell'andata**: l'ago arriva in fondo già spostato
       * di `retraceOffsetMm`, e da lì il ritorno corre perfettamente orizzontale. Mettere invece
       * un punto in più alla stessa ascissa creerebbe un micro-passaggio verticale che nel ricamo
       * non c'è.
       *
       * È così nel DST di riferimento — la riga a −7,10 fa −50,10 → −48,80 → −46,40 (qui scende
       * di 0,10) → −48,80 → −50,10, con il ritorno a dy esattamente 0. Segnalato da Lorenzo
       * guardando l'anteprima, e il file gli dava ragione.
       */
      const vr = riga.ritorni[t] ? v + offset : v;
      const corsa: Point[] = [];
      for (let q = 0; q < xs.length - 1; q++) corsa.push(rot({ x: xs[q], y: v }, cb, sb));
      corsa.push(rot({ x: xs[xs.length - 1], y: vr }, cb, sb));       // il capo: già spostato
      for (let q = xs.length - 2; q >= 0; q--) corsa.push(rot({ x: xs[q], y: vr }, cb, sb));
      runs.push(corsa);
    });
  }
  return runs;
}

/** Lunghezza totale del filo di un insieme di corse, in mm. Comodo per confrontare due densità. */
export function fillThreadMm(runs: Polyline[]): number {
  let mm = 0;
  for (const r of runs) for (let i = 1; i < r.length; i++) mm += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
  return mm;
}

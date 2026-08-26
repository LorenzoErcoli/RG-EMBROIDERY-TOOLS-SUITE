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

  const runs: Polyline[] = [];
  for (let k = kStart; k <= kEnd; k++) {
    const v = origin + k * spacing;
    /*
     * Da che parte si parte.
     *
     * Serpentina: si alterna, ed è il senso stesso della serpentina — la riga finisce dove comincia
     * la successiva. Il verso dipende da `k`, NON dall'ordine in cui capitano le macchie, così due
     * macchie dello stesso colore restano coerenti fra loro.
     *
     * Pettine: si parte SEMPRE dalla stessa parte, perché la corsa **torna dov'era partita**.
     * Alternando, l'ago dovrebbe attraversare tutta la macchia a ogni riga per raggiungere il capo
     * opposto: misurato sulla demo, il filo di solo passaggio passava da poco a **25,8 m su 62,9**
     * di totale. Il DST di riferimento conferma: le righe a pettine consecutive partono vicine
     * (−50,10 · −50,70 · −49,60), non da capi opposti.
     */
    const avanti = mode === 'comb' ? true : ((k % 2) + 2) % 2 === 0;

    let tratti = spans(outerR, holeR, v);
    if (!tratti.length) continue;

    // Col pettine il ritorno corre a `v + offset`: si tiene solo la parte comune alle due quote,
    // altrimenti su un bordo obliquo il ritorno uscirebbe dalla forma.
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
      // la corsa si accorcia alla parte percorribile in entrambi i sensi
      tratti = tratti.map(([x0, x1], i) => (ritorni[i] ? (ritorni[i] as [number, number]) : [x0, x1]));
    }

    const ordine = avanti ? tratti.map((_, i) => i) : tratti.map((_, i) => i).reverse();
    for (const i of ordine) {
      const [x0, x1] = tratti[i];
      if (x1 - x0 <= 1e-9) continue;
      const da = avanti ? x0 : x1, a2 = avanti ? x1 : x0;
      const xs = subdivide(da, a2, maxStitch);
      const corsa: Point[] = xs.map((x) => rot({ x, y: v }, cb, sb));
      if (mode === 'comb') {
        const vr = ritorni[i] ? v + offset : v;
        for (let t = xs.length - 1; t >= 0; t--) corsa.push(rot({ x: xs[t], y: vr }, cb, sb));
      }
      runs.push(corsa);
    }
  }
  return runs;
}

/** Lunghezza totale del filo di un insieme di corse, in mm. Comodo per confrontare due densità. */
export function fillThreadMm(runs: Polyline[]): number {
  let mm = 0;
  for (const r of runs) for (let i = 1; i < r.length; i++) mm += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
  return mm;
}

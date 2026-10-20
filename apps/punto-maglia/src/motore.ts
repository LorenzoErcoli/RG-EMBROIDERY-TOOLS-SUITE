// Motore del "Punto maglia": un tratto disegnato (linea centrale) diventa un cordoncino di V che gira lungo la
// curva. Puro, senza DOM: lo usano il tool e test/smoke.mjs.
//
// Il cordoncino è quello deciso da Lorenzo il 2026-10-19/20 (sapere/decisioni/punto-maglia-cordoncino.md), portato
// pari pari dal generatore del campione (`apps/cross-stitch/.lab/dior/campione.ts`): dato lo stesso tracciato, dà gli
// stessi punti del campione (lo controlla il test con `fixtures/campione-4.json`).
// - V larga 2,5, alta 3,5, una riga ogni 2,5 mm.
// - Lati: una mezza catena per parte, una gamba per riga, 2 passate, passaggio dalla parte di dentro.
// - Centro (1 / 1,5 / 2 colonne): cucito dopo i lati, sopra; entra ed esce dalla punta, 4 passate per gamba.
// - Ordine: lato A in giù → ritorno su per il centro → lato B in giù → centro in su.
// - Mai spezzare: ogni gamba e ogni passaggio è UN punto solo.
import type { ExportLayer } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';

export type Pt = [number, number];
export type Colonne = 1 | 1.5 | 2;

/** Un tratto come lo disegna Lorenzo: la linea centrale e come va cucito. */
export interface Tratto {
  nome: string;
  /** I punti di controllo in mm (y verso il basso): la curva passa morbida per questi punti. */
  punti: Pt[];
  /** Tratto chiuso (un anello, come la "o"). */
  chiuso: boolean;
  /** Larghezza del centro rialzato, in colonne di V da 2,5 mm. */
  colonne: Colonne;
  /** Da che parte guardano le punte delle V: 'avanti' = verso l'ultimo punto disegnato. */
  versoV: 'avanti' | 'indietro';
  /** Da quale capo del tratto si comincia a cucire: 'capo' = dal primo punto disegnato. */
  inizio: 'capo' | 'coda';
  /** Col centro 1,5: da che parte sta la colonna di mezze V, guardando verso le punte. */
  mezza: 'destra' | 'sinistra';
  /**
   * Punti ad angolo (come i vertici di Illustrator): angoli[i] = true → la linea fa uno spigolo in punti[i] e, fra due
   * punti ad angolo, va dritta. Assente = tutti morbidi.
   */
  angoli?: boolean[];
  /** Una forma precisa: 'cerchio' = punti[0] è il centro, punti[1] il punto sul cerchio dove si comincia (raggio). */
  forma?: 'cerchio';
  /** Il tratto si stringe verso il capo / la coda: colonne al capo e da quanti mm prima comincia a stringersi. */
  strettoCapo?: Stretto;
  strettoCoda?: Stretto;
  /** I punti di ricamo spostati a mano (strumento «Punti»). Valgono finché il cordoncino del tratto non cambia. */
  ritocchi?: Ritocchi;
  /**
   * Dove finisce il tratto. Assente = dove comincia (lato A in giù, ritorno su per il centro, lato B in giù, centro in
   * su: l'ordine del campione). 'altroCapo' = all'altro capo: lato A in giù, lato B in su, centro in giù (niente ritorno).
   */
  fine?: 'altroCapo';
  /** Passate per gamba del centro solo per questo tratto (più leggero: 2); assente = quelle del cordoncino. */
  passateCentro?: number;
  /**
   * Cerchio: la mezza catena dalla parte del centro. Assente = automatico: via quando non ci sta (nel cerchio piccolo
   * le sue gambe arrivano al centro e si ammucchiano: «troppo filo e punti in poco spazio»).
   */
  latoInterno?: boolean;
}

/**
 * Il tratto si stringe (o si allarga) verso un capo: negli ultimi `mm` le colonne passano dal centro a `colonne` a passi
 * di mezza colonna, in tratti uguali (centro 2 → capo 1 su 10 mm: 5 mm a 1,5 e gli ultimi 5 a 1).
 */
export interface Stretto {
  colonne: Colonne; mm: number;
  /** Secco: niente passi di mezza colonna, negli ultimi `mm` tutto a `colonne` (Lorenzo: «passasse secco da 1 a 2»). */
  secco?: boolean;
}

/** Spostamenti a mano: `da` = dove il punto stava nel cordoncino calcolato, `a` = dove l'ha messo Lorenzo. */
export interface Ritocchi {
  firma: string; spostati: Array<{ da: Pt; a: Pt }>;
  /** I buchi tolti a mano: il filo non ci passa più (le gambe che ci arrivavano spariscono). */
  tolti?: Pt[];
}

export interface ParametriMaglia {
  /** Larghezza della V (una colonna), mm. */
  larghezzaVMm: number;
  /** Altezza della V lungo il tratto, mm. */
  altezzaVMm: number;
  /** Passo fra una riga di V e la successiva, mm. */
  passoMm: number;
  /** Quanto la gamba del lato parte sotto il bordo del centro, mm. */
  rientroMm: number;
  /** Passate per gamba del centro: numero pari, così si torna sempre sulla punta. */
  passateCentro: number;
  /** Passate per gamba dei lati (va e torna). */
  passateLati: number;
  /** Negli incroci: quanto oltre il bordo del tratto sopra si tolgono le righe di quello sotto, mm. */
  margineIncrocioMm: number;
}

/** I valori del campione cucito (Lorenzo, 2026-10-20: tiene la versione a 4 passate). */
export const PARAMETRI_MAGLIA: ParametriMaglia = {
  larghezzaVMm: 2.5, altezzaVMm: 3.5, passoMm: 2.5, rientroMm: 0.4, passateCentro: 4, passateLati: 2, margineIncrocioMm: 0,
};

export const VERSIONE_MAGLIA = 3; // 2: cerchi, punti ad angolo, tratti che si stringono, ritocchi a mano; 3: spigoli a pezzi, stretto secco, lato interno, passate per tratto

/** Un tracciato percorribile a lunghezza d'arco: posizione e normale (a destra di chi va avanti, con y in giù). */
export interface Campionatore {
  L: number;
  chiuso: boolean;
  at: (s: number) => { x: number; y: number; nx: number; ny: number };
  /**
   * Con dei punti ad angolo: i pezzi fra uno spigolo e l'altro. Le righe di V non scavalcano uno spigolo (una V a
   * cavallo si storceva: «la stanghina gira strana»): ogni pezzo ha le sue, centrate nel pezzo.
   */
  pezzi?: Array<[number, number]>;
}

/** gamba = gamba di V del centro; lato = gamba delle mezze catene ai lati; passaggio = fra una gamba e l'altra. */
export type TipoPunto = 'gamba' | 'lato' | 'passaggio';

/** Il cordoncino di un tratto: i punti in fila (ognuno è un punto della macchina) e cosa fa ciascuno. */
export interface Cucitura {
  punti: Pt[];
  /** tipi[i] = cosa fa il punto che ARRIVA a punti[i] (tipi[0] non conta: è l'attacco). */
  tipi: TipoPunto[];
  /** Righe di V del tratto e quante tolte perché ci passa sopra un altro tratto. */
  righe: number;
  righeTolte: number;
  /** Il punto più lungo, mm (oltre 12,1 il DST lo spezzerebbe). */
  puntoMaxMm: number;
  /** Le colonne del centro riga per riga (cambiano dove il tratto si stringe). */
  colonneRighe?: Colonne[];
  /** I punti come li ha calcolati il motore, prima dei ritocchi a mano (stessa lunghezza di `punti`). */
  originali?: Pt[];
  /** La firma del cordoncino calcolato: i ritocchi valgono solo con la stessa firma. */
  firma?: string;
}

// ---------------------------------------------------------------- la curva per i punti di controllo

/**
 * La linea centrale: Catmull-Rom centripeta per i punti di controllo (passa per tutti, senza cappi né punte), poi
 * fitta a 0,1 mm circa. Ritorna la polilinea fitta (chiusa: l'ultimo punto ripete il primo).
 */
export function curva(punti: Pt[], chiuso: boolean, angoli?: boolean[]): Pt[] {
  if (angoli?.some((a, i) => a && i < punti.length)) return curvaConAngoli(punti, chiuso, angoli);
  const P = punti.filter((p, i) => i === 0 || Math.hypot(p[0] - punti[i - 1][0], p[1] - punti[i - 1][1]) > 1e-6);
  if (chiuso && P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
  if (P.length < 2) return P.slice();
  const n = P.length;
  const get = (i: number): Pt => {
    if (chiuso) return P[((i % n) + n) % n];
    if (i < 0) return [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
    if (i >= n) return [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]];
    return P[i];
  };
  const out: Pt[] = [P[0]];
  const segs = chiuso ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const d = (a: Pt, b: Pt): number => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(4, Math.ceil(len / 0.1));
    for (let k = 1; k <= m; k++) {
      const t = t1 + ((t2 - t1) * k) / m;
      const lerp = (a: Pt, b: Pt, ta: number, tb: number): Pt => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
      out.push(lerp(B1, B2, t1, t2));
    }
  }
  return out;
}

/** Un segmento dritto fitto a ~0,1 mm (il campionatore interpola le tangenti fra i vertici: servono vicini). */
function dritto(a: Pt, b: Pt): Pt[] {
  const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
  return Array.from({ length: m + 1 }, (_, k): Pt => [a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
}

/**
 * La linea con dei punti ad angolo: si spezza nei punti ad angolo e ogni pezzo è una curva morbida per i suoi punti
 * (fra due punti ad angolo vicini: un segmento dritto). Chiusa: riparte da un punto ad angolo e ci torna.
 */
function curvaConAngoli(punti: Pt[], chiuso: boolean, angoli: boolean[]): Pt[] {
  return lineaConSpigoli(punti, chiuso, angoli).linea;
}

/** Come `curvaConAngoli`, e in più dove stanno gli spigoli nella linea fitta (indici; chiusa: anche il primo e l'ultimo). */
export function lineaConSpigoli(punti: Pt[], chiuso: boolean, angoli: boolean[]): { linea: Pt[]; spigoli: number[] } {
  const n = punti.length;
  let idx = Array.from({ length: n }, (_, i) => i);
  if (chiuso) { const c = idx.find((i) => angoli[i]) ?? 0; idx = [...idx.slice(c), ...idx.slice(0, c), c]; }
  const out: Pt[] = [], spigoli: number[] = chiuso ? [0] : [];
  let pezzo: number[] = [idx[0]];
  for (let j = 1; j < idx.length; j++) {
    pezzo.push(idx[j]);
    if (j < idx.length - 1 && !angoli[idx[j]]) continue;
    const pts = pezzo.map((i) => punti[i]);
    const c = pts.length === 2 ? dritto(pts[0], pts[1]) : curva(pts, false);
    for (const q of out.length ? c.slice(1) : c) out.push(q);
    if (j < idx.length - 1 || chiuso) spigoli.push(out.length - 1);
    pezzo = [idx[j]];
  }
  return { linea: out, spigoli };
}

/** Un cerchio preciso: dal punto `inizio` sul cerchio, in senso orario sullo schermo (come il campione), chiuso. */
export function cerchio(centro: Pt, inizio: Pt): Pt[] {
  const r = Math.hypot(inizio[0] - centro[0], inizio[1] - centro[1]);
  const a0 = Math.atan2(inizio[1] - centro[1], inizio[0] - centro[0]);
  const m = Math.max(16, Math.ceil((2 * Math.PI * r) / 0.1));
  const out: Pt[] = [];
  for (let k = 0; k < m; k++) { const a = a0 + (2 * Math.PI * k) / m; out.push([centro[0] + r * Math.cos(a), centro[1] + r * Math.sin(a)]); }
  out.push(out[0]);
  return out;
}

/** Il tratto è chiuso (un anello o un cerchio). */
export const eChiuso = (t: Tratto): boolean => t.forma === 'cerchio' || t.chiuso;

/** La linea centrale di un tratto nel verso in cui è disegnato (fitta a ~0,1 mm). */
export function lineaTratto(t: Tratto): Pt[] {
  if (t.forma === 'cerchio' && t.punti.length >= 2) return cerchio(t.punti[0], t.punti[1]);
  return curva(t.punti, t.chiuso, t.angoli);
}

/** Un campionatore su una polilinea fitta (chiusa se l'ultimo punto ripete il primo e `chiuso`). */
export function campionatore(poly: Pt[], chiuso: boolean, spigoli: number[] = []): Campionatore {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const L = cum[cum.length - 1];
  const nseg = poly.length - 1;
  // tangente in ogni vertice = media dei due segmenti accanto (così la normale gira continua, non a scatti); negli
  // spigoli no: chi arriva tiene la direzione del pezzo prima, chi parte quella del pezzo dopo
  const segT = (i: number): Pt => { const a = poly[i], b = poly[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const sp = new Set(spigoli);
  const media = (i: number): Pt => {
    const prev = i > 0 ? segT(i - 1) : chiuso ? segT(nseg - 1) : null;
    const next = i < nseg ? segT(i) : chiuso ? segT(0) : null;
    const t: Pt = prev && next ? [prev[0] + next[0], prev[1] + next[1]] : (prev ?? next ?? [1, 0]);
    const l = Math.hypot(t[0], t[1]) || 1; return [t[0] / l, t[1] / l];
  };
  const vtIn: Pt[] = poly.map((_, i) => (sp.has(i) && i > 0 ? segT(i - 1) : media(i)));
  const vtOut: Pt[] = poly.map((_, i) => (sp.has(i) && i < nseg ? segT(i) : media(i)));
  const vt = vtOut; // per il tratto che parte da un vertice
  // i pezzi fra uno spigolo e l'altro (lunghezze d'arco): ognuno ha le sue righe di V
  const cuts = [...new Set([0, ...spigoli.map((i) => cum[i]), L])].sort((a, b) => a - b);
  const pezzi: Array<[number, number]> | undefined = spigoli.length ? cuts.slice(1).map((b, k) => [cuts[k], b] as [number, number]).filter(([a, b]) => b - a > 1e-6) : undefined;
  const at = (s0: number) => {
    const s = chiuso ? ((s0 % L) + L) % L : Math.max(0, Math.min(L, s0));
    let lo = 0, hi = nseg;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const seg = Math.max(0, Math.min(nseg - 1, lo));
    const l = cum[seg + 1] - cum[seg] || 1, f = (s - cum[seg]) / l;
    const a = poly[seg], b = poly[seg + 1], ta = vt[seg], tb = vtIn[seg + 1];
    let tx = ta[0] * (1 - f) + tb[0] * f, ty = ta[1] * (1 - f) + tb[1] * f; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, nx: -ty, ny: tx };
  };
  return pezzi ? { L, chiuso, at, pezzi } : { L, chiuso, at };
}

/** La linea centrale di un tratto nel verso delle punte, con la normale girata dalla parte della mezza colonna. */
export function campionatoreTratto(t: Tratto): Campionatore {
  const { linea, spigoli } = t.forma !== 'cerchio' && t.angoli?.some(Boolean) ? lineaConSpigoli(t.punti, t.chiuso, t.angoli) : { linea: lineaTratto(t), spigoli: [] };
  const n = linea.length - 1, ind = t.versoV === 'indietro';
  const c = campionatore(ind ? linea.slice().reverse() : linea, eChiuso(t), ind ? spigoli.map((i) => n - i) : spigoli);
  if (t.mezza === 'destra') return c;
  return { ...c, at: (s) => { const a = c.at(s); return { x: a.x, y: a.y, nx: -a.nx, ny: -a.ny }; } };
}

/** Mezza larghezza di tutto il cordoncino (centro + lati), mm. */
export function mezzaLarghezza(colonne: Colonne, par: ParametriMaglia = PARAMETRI_MAGLIA): number {
  return (colonne * par.larghezzaVMm) / 2 - par.rientroMm + par.larghezzaVMm / 2;
}

/** Le righe di V lungo un tracciato: dove partono (lunghezza d'arco), come nel campione. */
export function righe(sp: Campionatore, par: ParametriMaglia = PARAMETRI_MAGLIA): { s: number[]; passo: number } {
  const VH = par.altezzaVMm, PITCH = par.passoMm;
  if (sp.pezzi) { // con gli spigoli: le righe di ogni pezzo, al passo, centrate nel pezzo (nessuna V a cavallo di uno spigolo)
    const out: number[] = [];
    for (const [a, b] of sp.pezzi) {
      const Lp = b - a - 2e-6; if (Lp < VH) continue;
      const n = Math.floor((Lp - VH) / PITCH) + 1, resto = Lp - VH - (n - 1) * PITCH;
      for (let k = 0; k < n; k++) out.push(a + 1e-6 + resto / 2 + k * PITCH);
    }
    return { s: out, passo: PITCH };
  }
  if (!sp.chiuso && sp.L < VH) return { s: [], passo: PITCH };
  const n0 = sp.chiuso ? Math.round(sp.L / PITCH) : Math.floor((sp.L - VH) / PITCH) + 1;
  const n = sp.chiuso && n0 % 2 ? n0 + 1 : n0; // nell'anello un numero pari di righe: il centro da 2 va avanti e indietro
  const passo = sp.chiuso ? sp.L / n : PITCH;
  return { s: Array.from({ length: n }, (_, k) => k * passo), passo };
}

/**
 * Il cordoncino su un tracciato. `tenute[k]` = false toglie la riga k (ci passa sopra un altro tratto): i lati e il
 * centro la saltano con un passaggio solo, che resta sotto il tratto sopra. `alContrario` = si comincia dall'altro
 * capo (le punte guardano sempre dalla stessa parte).
 */
export function cordoncino(sp: Campionatore, colonne: Colonne | ((s: number) => Colonne), par: ParametriMaglia = PARAMETRI_MAGLIA, opz: { tenute?: boolean[]; alContrario?: boolean; senzaLato?: -1 | 1; passateCentro?: number; altroCapo?: boolean } = {}): Cucitura {
  const COL = par.larghezzaVMm, VH = par.altezzaVMm, HALF = COL / 2, OV = par.rientroMm;
  const PC = Math.max(2, Math.round((opz.passateCentro ?? par.passateCentro) / 2) * 2), PL = Math.max(1, Math.round(par.passateLati));
  const { s: S } = righe(sp, par);
  const n = S.length;
  // le colonne riga per riga: costanti, o più strette verso i capi (la funzione riceve l'inizio della riga)
  const C: Colonne[] = S.map((s) => (typeof colonne === 'function' ? colonne(s) : colonne));
  const tenute = opz.tenute ?? S.map(() => true);
  const tolte = tenute.filter((v) => !v).length;
  // l'ordine delle righe per i lati. Un anello intero gira; un anello con righe tolte si apre dopo un buco e diventa
  // un tratto aperto.
  let ord = Array.from({ length: n }, (_, k) => k);
  const anello = sp.chiuso && tolte === 0 && !sp.pezzi; // con gli spigoli l'anello parte e finisce su uno spigolo: come aperto
  if (sp.chiuso && tolte > 0 && !sp.pezzi) { const k0 = tenute.findIndex((v, k) => v && !tenute[(k - 1 + n) % n]); ord = ord.map((_, i) => (k0 + i) % n); }
  ord = ord.filter((k) => tenute[k]);
  if (opz.alContrario) ord.reverse();
  if (!ord.length) return { punti: [], tipi: [], righe: n, righeTolte: tolte, puntoMaxMm: 0, colonneRighe: C };
  // il centro va al contrario dei lati; nell'anello intero riparte dalla prima riga e gira all'indietro (come il campione)
  // finire all'altro capo: il lato B torna su e il centro scende (solo con due lati e su un tratto che non gira)
  const altroCapo = !!opz.altroCapo && !anello && !opz.senzaLato;
  const ordC = anello ? [ord[0], ...ord.slice(1).reverse()] : altroCapo ? ord.slice() : ord.slice().reverse();

  const pt = (s: number, o: number): Pt => { const a = sp.at(s); return [a.x + a.nx * o, a.y + a.ny * o]; };
  const inner = (k: number): number => (C[k] * COL) / 2 - OV, outer = (k: number): number => inner(k) + HALF;
  const out: Pt[] = [], tipi: TipoPunto[] = [];
  // un passaggio (fra due gambe): un punto solo, mai spezzato (Lorenzo: «non spezzare nemmeno i passaggi»)
  const go = (p: Pt): void => { const q = out.at(-1); if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05) return; out.push(p); tipi.push('passaggio'); };
  const gamba = (p: Pt): void => { out.push(p); tipi.push('gamba'); };
  // una gamba del lato (mezza V): UN punto solo per passata, mai spezzato (Lorenzo: «le v non vanno spezzate»)
  const legs = (a: Pt, b: Pt, passes: number): void => { go(a); for (let i = 0; i < passes; i++) { out.push(i % 2 ? a : b); tipi.push('lato'); } };

  // ---- i lati: sgn +1 = lato della mezza V (centro 1,5), sgn -1 = l'altro ----
  const side = (sgn: number, righe: number[] = ord): void => {
    for (const k of righe) {
      const s = S[k], flip = C[k] === 1.5 && sgn === 1;
      // la gamba parte e torna sempre al suo capo interno (il passaggio resta dentro)
      if (flip) legs(pt(s + VH, sgn * inner(k)), pt(s, sgn * outer(k)), PL); else legs(pt(s, sgn * inner(k)), pt(s + VH, sgn * outer(k)), PL);
    }
  };
  if (opz.senzaLato) side(opz.senzaLato === 1 ? -1 : 1); // un lato solo (il cerchio piccolo senza il lato interno): poi subito il centro
  else if (altroCapo) { side(-1); side(1, ord.slice().reverse()); } // il passaggio da un lato all'altro resta in fondo, sotto il centro
  else {
    side(-1);
    // ritorno per il centro (sotto il centro che verrà cucito sopra): un punto per riga, sulle punte delle V del centro
    const axis = (k: number): number => (C[k] === 1.5 ? -COL / 4 : 0);
    if (!anello) for (const k of ord.slice().reverse()) go(pt(S[k] + VH, axis(k))); else go(pt(S[ord[0]], axis(ord[0])));
    side(1);
  }
  // ---- il centro: da punta a punta (Lorenzo, 2026-10-20), ogni gamba PC volte ----
  const rep = (seq: Pt[], times: number): void => { for (let i = 0; i < times; i++) for (const p of seq) gamba(p); };
  ordC.forEach((k, kk) => {
    const s = S[k], cols = C[k];
    const P0 = (o: number): Pt => pt(s, o), T = (o: number): Pt => pt(s + VH, o);
    if (cols === 1) { const t = T(0); go(t); rep([P0(-COL / 2), t], PC / 2); rep([P0(COL / 2), t], PC / 2); }
    else if (cols === 1.5) { // la V intera a −0,625 e la mezza V dal suo angolo destro verso fuori
      const t = T(-COL / 4), l = P0(-COL / 4 - COL / 2), r = P0(-COL / 4 + COL / 2), x1 = T(-COL / 4 + COL / 2 + HALF);
      go(t); rep([l, t], PC / 2); gamba(r); rep([x1, r], PC / 2); gamba(t); rep([r, t], PC / 2 - 1);
    } else { // due V: punta A → (gamba esterna A) → gambe interne → punta B → (gamba esterna B); una riga per verso
      const fwd = kk % 2 === 0;
      const ta = T(fwd ? COL / 2 : -COL / 2), tb = T(fwd ? -COL / 2 : COL / 2), la = P0(fwd ? COL : -COL), lb = P0(fwd ? -COL : COL), c = P0(0);
      go(ta); rep([la, ta], PC / 2); rep([c, ta], (PC - 2) / 2); gamba(c); rep([tb, c], (PC - 2) / 2); gamba(tb); rep([lb, tb], PC / 2);
    }
  });
  let puntoMaxMm = 0;
  for (let i = 1; i < out.length; i++) puntoMaxMm = Math.max(puntoMaxMm, Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { punti: out, tipi, righe: n, righeTolte: tolte, puntoMaxMm, colonneRighe: C };
}

/** Le colonne a distanza `d` da un capo: dal centro `mezzo` a `st.colonne` negli ultimi `st.mm`, a passi di mezza colonna. */
export function colonneVersoCapo(mezzo: Colonne, st: Stretto | undefined, d: number): Colonne {
  if (!st || st.mm <= 0 || st.colonne === mezzo || d >= st.mm) return mezzo;
  if (st.secco) return st.colonne;
  const passi: Colonne[] = []; // dal capo verso il centro, senza il centro
  const dir = mezzo > st.colonne ? 0.5 : -0.5;
  for (let c: number = st.colonne; c !== mezzo; c += dir) passi.push(c as Colonne);
  return passi[Math.min(passi.length - 1, Math.floor((Math.max(0, d) / st.mm) * passi.length))];
}

/**
 * Nel cerchio, la mezza catena dalla parte del centro ci sta se fra le sue punte e il centro resta almeno mezza V di
 * altezza (1,75 mm): sotto, le gambe si ammucchiano al centro. Scelto nel codice il 2026-10-20 sul pallino della «i»
 * (raggio 2 mm: lato interno oltre il centro); la «o» (raggio 5,3) lo tiene.
 */
export function latoInternoCi(r: number, colonne: Colonne, par: ParametriMaglia = PARAMETRI_MAGLIA): boolean {
  return r - mezzaLarghezza(colonne, par) >= par.altezzaVMm / 2;
}

/** Firma di un cordoncino calcolato: numero di punti, primo e ultimo (al centesimo). */
export function firma(punti: Pt[]): string {
  const f = (p: Pt | undefined): string => (p ? `${p[0].toFixed(2)},${p[1].toFixed(2)}` : '-');
  return `${punti.length}:${f(punti[0])}:${f(punti.at(-1))}`;
}

/**
 * I ritocchi a mano: ogni punto che stava in `da` va in `a`, tutte le volte che il filo ci passa (una punta di V con
 * 4 passate si sposta tutta insieme: le passate restano sullo stesso buco). Con un'altra firma non valgono.
 */
export function applicaRitocchi(c: Cucitura, r: Ritocchi | undefined): { cucitura: Cucitura; persi: boolean } {
  const orig = c.punti, base: Cucitura = { ...c, originali: orig, firma: firma(orig) };
  if (!r?.spostati.length && !r?.tolti?.length) return { cucitura: base, persi: false };
  if (r.firma !== base.firma) return { cucitura: base, persi: true };
  const qui = (a: Pt, p: Pt): boolean => Math.abs(a[0] - p[0]) < 0.005 && Math.abs(a[1] - p[1]) < 0.005;
  // i buchi tolti: via tutte le volte che il filo ci passava; `originali` resta allineato ai punti che restano
  let punti: Pt[] = [], originali: Pt[] = [], tipi: TipoPunto[] = [];
  orig.forEach((p, i) => {
    if (r.tolti?.some((q) => qui(q, p))) return;
    const m = r.spostati.find((q) => qui(q.da, p)); const nuovo: Pt = m ? [m.a[0], m.a[1]] : p;
    const prima = punti.at(-1); if (prima && prima[0] === nuovo[0] && prima[1] === nuovo[1]) return; // due volte lo stesso buco di fila: un punto fermo, via
    punti.push(nuovo); originali.push(p); tipi.push(c.tipi[i]);
  });
  if (!punti.length) { punti = []; originali = []; tipi = []; }
  let puntoMaxMm = 0;
  for (let i = 1; i < punti.length; i++) puntoMaxMm = Math.max(puntoMaxMm, Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]));
  return { cucitura: { ...base, punti, tipi, originali, puntoMaxMm }, persi: false };
}

// ---------------------------------------------------------------- gli incroci

/** Distanza di un punto da una polilinea (con un riquadro per scartare in fretta i segmenti lontani). */
function distanza(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

/**
 * Le righe di un tratto che restano: si tolgono le righe intere (lati e centro) dove passa un tratto cucito dopo
 * (Lorenzo, 2026-10-20: «le righe intere»), cioè quando il centro della riga (a metà della V, sull'asse) cade nella
 * striscia del tratto sopra. Le righe accanto restano e infilano un pezzo sotto i lati del tratto sopra: toglierle
 * anche quelle allungava il buco e il passaggio (incrocio a croce con un centro 2: 4 righe e 12,5 mm, oltre il DST).
 */
export function righeTenute(sp: Campionatore, sopra: Array<{ linea: Pt[]; mezza: number }>, par: ParametriMaglia = PARAMETRI_MAGLIA): boolean[] {
  const { s: S } = righe(sp, par);
  if (!sopra.length) return S.map(() => true);
  const box = sopra.map((t) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of t.linea) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const m = t.mezza + par.margineIncrocioMm; return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m, m };
  });
  return S.map((s) => {
    const a = sp.at(s + par.altezzaVMm / 2), p: Pt = [a.x, a.y];
    return !sopra.some((t, j) => {
      const b = box[j]; if (p[0] < b.x0 || p[0] > b.x1 || p[1] < b.y0 || p[1] > b.y1) return false;
      return distanza(p, t.linea) < b.m;
    });
  });
}

// ---------------------------------------------------------------- tutti i tratti

export interface RisultatoTratto { tratto: Tratto; cucitura: Cucitura; linea: Pt[] }
export interface Risultato { tratti: RisultatoTratto[]; punti: number; avvisi: string[] }

/** Cuce i tratti nell'ordine della lista: quelli dopo stanno sopra (sono cuciti dopo) e tolgono le righe a quelli prima. */
export function cuci(tratti: Tratto[], par: ParametriMaglia = PARAMETRI_MAGLIA): Risultato {
  const pronti = tratti.map((t) => ({ t, sp: t.punti.length >= 2 ? campionatoreTratto(t) : null, linea: t.punti.length >= 2 ? lineaTratto(t) : t.punti.slice() }));
  // la striscia più larga del tratto (centro o capi), per togliere le righe a quelli sotto
  const largo = (t: Tratto): Colonne => (eChiuso(t) ? t.colonne : Math.max(t.colonne, t.strettoCapo?.colonne ?? 0, t.strettoCoda?.colonne ?? 0) as Colonne);
  const avvisi: string[] = [];
  const out: RisultatoTratto[] = pronti.map(({ t, sp, linea }, i) => {
    if (!sp) return { tratto: t, cucitura: { punti: [], tipi: [], righe: 0, righeTolte: 0, puntoMaxMm: 0 }, linea };
    const sopra = pronti.slice(i + 1).filter((q) => q.sp).map((q) => ({ linea: q.linea, mezza: mezzaLarghezza(largo(q.t), par) }));
    const tenute = righeTenute(sp, sopra, par);
    // le colonne di ogni riga: la distanza dal capo e dalla coda DISEGNATI si misura a metà della riga
    const indietro = t.versoV === 'indietro';
    const colonne = eChiuso(t) || (!t.strettoCapo && !t.strettoCoda) ? t.colonne : (s: number): Colonne => {
      const m = s + par.altezzaVMm / 2, dCapo = indietro ? sp.L - m : m, dCoda = sp.L - dCapo;
      const a = colonneVersoCapo(t.colonne, t.strettoCapo, dCapo), b = colonneVersoCapo(t.colonne, t.strettoCoda, dCoda);
      return Math.abs(a - t.colonne) >= Math.abs(b - t.colonne) ? a : b;
    };
    // il cerchio piccolo: senza la mezza catena dalla parte del centro quando non ci sta (o se Lorenzo la toglie)
    let senzaLato: -1 | 1 | undefined;
    if (t.forma === 'cerchio' && t.punti.length >= 2) {
      const r = Math.hypot(t.punti[1][0] - t.punti[0][0], t.punti[1][1] - t.punti[0][1]);
      const via = t.latoInterno === undefined ? !latoInternoCi(r, t.colonne, par) : !t.latoInterno;
      const a = sp.at(0); // da che parte guarda la normale: verso il centro = +1
      if (via) senzaLato = (t.punti[0][0] - a.x) * a.nx + (t.punti[0][1] - a.y) * a.ny > 0 ? 1 : -1;
    }
    const { cucitura, persi } = applicaRitocchi(cordoncino(sp, colonne, par, { tenute, alContrario: (t.inizio === 'coda') !== indietro, senzaLato, passateCentro: t.passateCentro, altroCapo: t.fine === 'altroCapo' }), t.ritocchi);
    if (persi) avvisi.push(`«${t.nome}»: il cordoncino è cambiato, i punti spostati a mano non valgono più (tornano se annulli la modifica).`);
    if (!cucitura.righe) avvisi.push(`«${t.nome}» è più corto di una V (${par.altezzaVMm} mm): non si cuce.`);
    if (cucitura.puntoMaxMm > 12.1) avvisi.push(`«${t.nome}»: un punto di ${cucitura.puntoMaxMm.toFixed(1).replace('.', ',')} mm${t.ritocchi && !persi ? '' : ' (passaggio sotto un incrocio)'} — oltre 12,1 mm il DST lo spezza.`);
    return { tratto: t, cucitura, linea };
  });
  return { tratti: out, punti: out.reduce((a, r) => a + r.cucitura.punti.length, 0), avvisi };
}

// ---------------------------------------------------------------- export e progetto

export interface ProgettoMaglia { rgProject: 'punto-maglia'; versione: number; params: ParametriMaglia; tratti: Tratto[] }

export function progetto(par: ParametriMaglia, tratti: Tratto[]): ProgettoMaglia {
  return { rgProject: 'punto-maglia', versione: VERSIONE_MAGLIA, params: { ...par }, tratti: JSON.parse(JSON.stringify(tratti)) as Tratto[] };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const isPt = (q: unknown): q is Pt => Array.isArray(q) && isNum(q[0]) && isNum(q[1]);
function leggiStretto(v: unknown): Stretto | undefined {
  const o = v as Record<string, unknown> | undefined;
  if (!o || !isNum(o.mm) || !(o.colonne === 1 || o.colonne === 1.5 || o.colonne === 2)) return undefined;
  return { colonne: o.colonne, mm: o.mm, ...(o.secco === true ? { secco: true } : {}) };
}
function leggiRitocchi(v: unknown): Ritocchi | undefined {
  const o = v as Record<string, unknown> | undefined;
  if (!o || typeof o.firma !== 'string' || !Array.isArray(o.spostati)) return undefined;
  const spostati = (o.spostati as Array<Record<string, unknown>>).filter((q) => q && isPt(q.da) && isPt(q.a))
    .map((q) => ({ da: [(q.da as Pt)[0], (q.da as Pt)[1]] as Pt, a: [(q.a as Pt)[0], (q.a as Pt)[1]] as Pt }));
  const tolti = Array.isArray(o.tolti) ? (o.tolti as unknown[]).filter(isPt).map((q) => [q[0], q[1]] as Pt) : [];
  return spostati.length || tolti.length ? { firma: o.firma, spostati, ...(tolti.length ? { tolti } : {}) } : undefined;
}

/** Rilegge un progetto (dai metadati di un SVG o di un DST usciti da qui); null se non è un progetto punto maglia. */
export function leggiProgetto(meta: Record<string, unknown> | null): { params: ParametriMaglia; tratti: Tratto[] } | null {
  if (!meta || meta.rgProject !== 'punto-maglia') return null;
  const params = { ...PARAMETRI_MAGLIA };
  const p = (meta.params ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(params) as Array<keyof ParametriMaglia>) if (isNum(p[k])) params[k] = p[k] as number;
  const tratti: Tratto[] = [];
  for (const r of Array.isArray(meta.tratti) ? meta.tratti : []) {
    const t = r as Record<string, unknown>;
    const punti = Array.isArray(t.punti) ? (t.punti as unknown[]).filter((q): q is Pt => Array.isArray(q) && isNum(q[0]) && isNum(q[1])).map((q) => [q[0], q[1]] as Pt) : [];
    if (punti.length < 2) continue;
    tratti.push({
      nome: typeof t.nome === 'string' ? t.nome : `Tratto ${tratti.length + 1}`,
      punti,
      chiuso: t.chiuso === true,
      colonne: t.colonne === 1.5 || t.colonne === 2 ? t.colonne : 1,
      versoV: t.versoV === 'indietro' ? 'indietro' : 'avanti',
      inizio: t.inizio === 'coda' ? 'coda' : 'capo',
      mezza: t.mezza === 'sinistra' ? 'sinistra' : 'destra',
      ...(Array.isArray(t.angoli) ? { angoli: (t.angoli as unknown[]).map((v) => v === true) } : {}),
      ...(t.forma === 'cerchio' ? { forma: 'cerchio' as const } : {}),
      ...(leggiStretto(t.strettoCapo) ? { strettoCapo: leggiStretto(t.strettoCapo) } : {}),
      ...(leggiStretto(t.strettoCoda) ? { strettoCoda: leggiStretto(t.strettoCoda) } : {}),
      ...(leggiRitocchi(t.ritocchi) ? { ritocchi: leggiRitocchi(t.ritocchi) } : {}),
      ...(isNum(t.passateCentro) ? { passateCentro: t.passateCentro } : {}),
      ...(typeof t.latoInterno === 'boolean' ? { latoInterno: t.latoInterno } : {}),
      ...(t.fine === 'altroCapo' ? { fine: 'altroCapo' as const } : {}),
    });
  }
  return { params, tratti };
}

/**
 * Gli strati da cucire: un ago solo, un tratto per polilinea nell'ordine della lista, un taglio prima di ogni tratto
 * (come il campione). Ogni gamba e ogni passaggio resta un punto solo: niente si suddivide (sotto i 12,1 mm del DST).
 */
export function strati(r: Risultato, colore = '#2f6fd6'): ExportLayer[] {
  const pl = r.tratti.filter((t) => t.cucitura.punti.length >= 2).map((t) => t.cucitura.punti.map(([x, y]) => ({ x, y })));
  return pl.length ? [{ id: 'maglia', color: colore, strokeMm: 0.35, polylines: pl, trims: pl.map(() => true) }] : [];
}

/** Il disegno di Lorenzo è ingresso, non parametri: i tratti (linee centrali e come si cuciono). */
export interface IngressoMaglia extends Ingresso { tratti: Tratto[] }

/** Il contratto del motore (K1b): la stessa porta d'ingresso di tutti i tool. */
export const motore: Motore<IngressoMaglia, ParametriMaglia> = {
  id: 'punto-maglia',
  async genera(ingresso, params) {
    const r = cuci(ingresso.tratti ?? [], params);
    return { strati: strati(r), avvisi: r.avvisi };
  },
};

/** Il riquadro dei punti cuciti. */
export function riquadro(r: Risultato): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of r.tratti) for (const [x, y] of t.cucitura.punti) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

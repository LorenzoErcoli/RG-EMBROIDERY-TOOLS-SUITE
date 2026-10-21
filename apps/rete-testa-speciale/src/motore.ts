// RETE-TESTA-SPECIALE (Lorenzo, 2026-10-15): una rete a rombi fatta di SERPENTINE. La linea scende a zig-zag e
// risale con lo stesso zig-zag sull'altro lato, e le due insieme fanno una colonna di rombi; le colonne vicine si
// toccano (o si accavallano) con le punte. Serve alle teste speciali, che mettono un filo più spesso.
//
// Le sue decisioni, prese guardando la simulazione (sapere/tool/rete-testa-speciale.md):
// - la serpentina può essere verticale, orizzontale o a un angolo qualsiasi;
// - larghezza e altezza del rombo si scelgono;
// - «la stessa rientranza»: UNA sola sovrapposizione per ogni incrocio della rete — discesa e risalita alla
//   rientranza, e le punte di due colonne vicine. Lo stesso per l'arrotondamento: uno solo per tutti gli angoli;
// - la zona di sovrapposizione è «tutto ciò che sta dentro i 2 punti di incrocio» (la lente che due linee fanno
//   incrociandosi), col suo punto; l'ampiezza la allarga o la stringe, e con le linee che si toccano soltanto la
//   zona è l'ampiezza attorno al punto di contatto;
// - nella zona la linea cucita prima sta SOTTO e tiene la lunghezza del punto (se non se ne dà una apposta), quella
//   che passa dopo sta SOPRA col punto delle sovrapposizioni;
// - le linee «devono toccare il bordo sempre», del pezzo e delle aree vuote: ogni linea va fino al SUO bordo;
// - sul bordo il filo non si sovrappone: «se c'è già qualcosa sotto il filo lo spostiamo dentro», di uno spessore
//   di filo per ogni passata già posata (gli strati impilati vanno bene);
// - all'area vuota la serpentina può: tornare indietro e riattaccare dopo la parte mancante, girare sul bordo del
//   vuoto, o attraversarlo con un'impuntura dritta (come nel Generatore pattern);
// - «quando inserisci una parte nuova inizia sempre dal contorno esterno del cartamodello».
import { distance, distanceToSegment, enforceMinStitch, lerp, pointInPolygon, type Point, type Polyline } from '@rg/core';
import {
  anelliOvali, anelliRadiali, cimeDellaRete, fondoDellaLegatura, siIncrociano, puntoDelFondo, puntoDelNodo, raggioDelFondo, sovrapposizioneAlNodo,
  tangenteAlNodo, versoIlCentro, type Anelli, type RegolaSovrapposizione,
} from './sacca';

export type ModoVuoto = 'ritorno' | 'bordo' | 'centro';
/** Da dove viene il pezzo: il contorno del cartamodello caricato, o un rettangolo con le misure scritte a mano. */
export type OrigineDelPezzo = 'cartamodello' | 'misure';
/** La forma della rete: a colonne su un pezzo, o radiale in un disco che diventa una sacca. */
export type FormaDellaRete = 'colonne' | 'radiale';

/** I parametri, come il tool li salva nel file di progetto (nomi del registro K1). */
export type ParametriRete = {
  /** La rete: a colonne sul pezzo, o radiale (la sacca a rete, Lorenzo 2026-10-15). */
  netShape: FormaDellaRete;
  /** Sacca: rombi per giro. */
  radialCount: number;
  /** Sacca: lato del rombo, mm. Tutti i lati uguali: è quello che fa diventare il disco una sacca. */
  radialSideMm: number;
  /** Sacca: raggio del fondo, mm (dove finisce la rete e comincia la spirale). */
  bottomRadiusMm: number;
  /**
   * Sacca: il fondo tondo o ovale (Lorenzo, 2026-10-16). Ovale: la rete cresce con le stesse regole e diventa ovale anche
   * lei; sulle teste la fascia viene più corta che sui lati lunghi (i rombi lì si aprono prima), e chiusa col cordone la
   * sacca fa pancia sui lati lunghi e tiene tese le teste.
   */
  bottomShape: 'tondo' | 'ovale';
  /** Sacca, fondo ovale: lunghezza e larghezza, mm. */
  bottomLengthMm: number;
  bottomWidthMm: number;
  /** Sacca, fondo ovale: quanto le teste sono mezzi cerchi, % (0 = ovale, 100 = mezzi cerchi uniti da tratti dritti). */
  bottomRoundEnds: number;
  /**
   * Sacca, fondo ovale: la fascia sui lati lunghi, mm (0 = tutta la rete). Le colonne dei lati si fermano prima, le teste
   * no: meno rete sui lati lunghi, più sulle teste (Lorenzo, 2026-10-16), vedi `cimeDelleColonne`.
   */
  sideBandMm: number;
  /** Sacca: angolo massimo dei rombi in fuori, gradi (a 180 sono piatti). */
  maxAngleDeg: number;
  /** Sacca: lato del campo macchina, mm. Il disco ci deve stare. */
  fieldMm: number;
  /** Sacca: passo della spirale del fondo, mm (uguale allo spessore del filo = giri affiancati). */
  spiralPitchMm: number;
  /** Sacca: distanza minima fra le legature che entrano nel fondo, mm. */
  tieSpacingMm: number;
  /**
   * Sacca: che cosa resta uguale in tutta la rete (Lorenzo, 2026-10-16). `spostamento` = la sovrapposizione scritta
   * ovunque (la lente cresce verso il centro, in cima la punta passa appena oltre l'altra linea); `lente` = la lente di
   * quella in cima; `aggancio` = la punta passa oltre l'altra linea della stessa misura ovunque (`sovrapposizioneAlNodo`).
   */
  overlapRule: RegolaSovrapposizione;
  /**
   * Sacca: un giro d'impuntura in cima, sulle punte esterne. Spento di partenza: Lorenzo, 2026-10-16, «lascia stare la
   * parte sopra, lasciamola libera»; la bocca si chiude al montaggio con un cordone nei buchi dell'ultima fila.
   */
  rimPass: boolean;
  /** Il pezzo: dal cartamodello, o dalle misure qui sotto (Lorenzo, 2026-10-15: «a partire da dimensioni mie»). */
  pieceSource: OrigineDelPezzo;
  /** Larghezza del pezzo quando lo si dà a misure, mm. */
  totalWidth: number;
  /** Altezza del pezzo quando lo si dà a misure, mm. */
  totalHeight: number;
  /** Larghezza del rombo, mm: da punta a punta di una colonna, misurata sulla linea vera (anche arrotondata). */
  diamondWidthMm: number;
  /** Altezza del rombo, mm: da una rientranza alla successiva lungo la colonna. */
  diamondHeightMm: number;
  /** Direzione della serpentina, gradi: 0 = scende in verticale, 90 = corre in orizzontale. */
  angleDeg: number;
  /** Quanto si accavallano due linee a ogni incrocio, mm (rientranza e punte delle colonne vicine); 0 = si toccano. */
  overlapMm: number;
  /** Le colonne sfalsate di mezzo rombo. */
  staggerColumns: boolean;
  /**
   * Colonne intere nella larghezza (Lorenzo, 2026-10-21, sulla Net bag Clover 420 × 710: «se guardi i bordi laterali
   * sinistra e destra si creano delle curve strane… serve una curva migliore»). La larghezza del pezzo si divide in un
   * numero intero di colonne, ritoccando di poco la larghezza del rombo: ogni bordo laterale cade a metà della
   * sovrapposizione, come una colonna vicina, e ogni punta lo tocca con lo stesso piccolo aggancio. Senza, il bordo
   * taglia il rombo in un punto qualsiasi: tagli profondi, triangolini di pochi decimi, scalini fra le passate.
   */
  fitColumns: boolean;
  /** Arrotondamento di punte e rientranze, %: 0 = spigolo vivo, 100 = curva piena. */
  cornerRounding: number;
  /** Lunghezza del punto, mm (ogni tratto fra due punti fissi si divide in punti uguali, non più lunghi di così). */
  maxStitchMm: number;
  /**
   * Lunghezza del punto dentro le zone di sovrapposizione, per la linea che sta SOPRA (quella che passa dopo), mm.
   * (Il nome viene da prima della divisione sotto/sopra, 2026-10-15: si tiene, i file salvati lo usano.)
   */
  overlapStitchMm: number;
  /** Lunghezza del punto nelle sovrapposizioni per la linea che sta SOTTO (cucita prima), mm; 0 = la lunghezza del punto. */
  underOverlapStitchMm: number;
  /** Di quanto la zona di sovrapposizione esce dai due punti d'incrocio (negativo: rientra), mm. */
  overlapZoneMm: number;
  /** Spessore del filo, mm: sul contorno una passata nuova va accanto a quella già posata, a questa distanza. */
  constructionStroke: number;
  /** Cosa fa la rete a un'area vuota. */
  voidMode: ModoVuoto;
  /** Punto dell'impuntura che attraversa un'area vuota o ci gira attorno, mm. */
  voidStitchMm: number;
  /** Punto minimo, mm (R3): si impone alla fine, dopo l'ordine di cucitura. */
  minStitchMm: number;
};

export const PARAMETRI_RETE: ParametriRete = {
  netShape: 'colonne',
  radialCount: 48,
  radialSideMm: 15,
  bottomRadiusMm: 100,
  bottomShape: 'tondo',
  bottomLengthMm: 260,
  bottomWidthMm: 140,
  bottomRoundEnds: 0,
  sideBandMm: 0,
  maxAngleDeg: 165,
  fieldMm: 450,
  spiralPitchMm: 5,
  tieSpacingMm: 10,
  overlapRule: 'spostamento',
  rimPass: false,
  pieceSource: 'cartamodello',
  totalWidth: 120,
  totalHeight: 160,
  diamondWidthMm: 12,
  diamondHeightMm: 16,
  angleDeg: 0,
  overlapMm: 2,
  staggerColumns: false,
  fitColumns: false,
  cornerRounding: 0,
  maxStitchMm: 2.5,
  overlapStitchMm: 1.2,
  underOverlapStitchMm: 0,
  overlapZoneMm: 0,
  constructionStroke: 1,
  voidMode: 'ritorno',
  voidStitchMm: 2,
  minStitchMm: 0.5,
};

/** Che tratto di filo è un punto: la rete, una passata sul contorno, l'impuntura in un vuoto, un raccordo dritto, il fondo della sacca. */
export type TipoTratto = 'rete' | 'bordo' | 'vuoto' | 'raccordo' | 'fondo';

/** Un punto ago, con quello che serve all'anteprima. */
export interface PuntoAgo extends Point {
  tipo: TipoTratto;
  /** Dentro una zona di sovrapposizione. */
  sovrapposto: boolean;
  /** Nella zona, è la linea che passa DOPO (sta sopra); false = sta sotto, o fuori dalle zone. */
  sopra: boolean;
  /** Il blocco (la parte) a cui appartiene, in ordine di cucitura. */
  blocco: number;
  /** Strato sul contorno (0 = sul bordo, n = n spessori di filo verso l'interno). Solo per i punti 'bordo'. */
  strato?: number;
}

export interface RisultatoRete {
  /** Quello che non si è potuto fare, detto a parole (es. la sacca non ci sta). */
  avviso?: string;
  /** Con le colonne intere: quante colonne e la larghezza del rombo usata davvero, mm. */
  colonneIntere?: { colonne: number; larghezzaRombo: number };
  /** Un tratto continuo per ogni blocco, in ordine di cucitura: fra due blocchi la macchina salta. */
  blocchi: PuntoAgo[][];
  misure: {
    punti: number;
    puntiSovrapposti: number;
    /** Di questi, quelli della linea che sta sopra. */
    puntiSopra: number;
    filoMm: number;
    puntoMinMm: number;
    puntoMaxMm: number;
    salti: number;
    saltiMm: number;
    stratiMax: number;
    tempoMs: number;
  };
}

// ------------------------------------------------------------------------------------------------ geometria

interface Proiezione { d: number; i: number; t: number }
function proietta(p: Point, poly: Polyline): Proiezione {
  let best: Proiezione = { d: Infinity, i: 0, t: 0 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (d < best.d) best = { d, i, t };
  }
  return best;
}

/** La strada più corta sul contorno `poly` da a a b (a e b compresi). */
function sulContorno(poly: Polyline, a: Point, b: Point): Point[] {
  const pa = proietta(a, poly), pb = proietta(b, poly), n = poly.length;
  const avanti: Point[] = [a];
  if (!(pa.i === pb.i && pb.t >= pa.t)) { let i = pa.i; do { i = (i + 1) % n; avanti.push(poly[i]); } while (i !== pb.i); }
  avanti.push(b);
  const indietro: Point[] = [a];
  if (!(pa.i === pb.i && pb.t <= pa.t)) { let i = pa.i; indietro.push(poly[i]); while (i !== (pb.i + 1) % n) { i = (i - 1 + n) % n; indietro.push(poly[i]); } }
  indietro.push(b);
  return lunghezza(avanti) <= lunghezza(indietro) ? avanti : indietro;
}

const lunghezza = (q: Point[]): number => q.reduce((s, p, k) => (k ? s + distance(q[k - 1], p) : 0), 0);

/** Parametro t su ab dell'incrocio con cd, o null. */
function incrocio(a: Point, b: Point, c: Point, d: Point): number | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// ------------------------------------------------------------------------------------------------ un lato

/** Un punto di un lato, nel riferimento della colonna: u di traverso, v lungo. */
interface PuntoLato { u: number; v: number; fisso: boolean; apice: boolean }

/**
 * Un lato della serpentina (s = -1 sinistra, +1 destra): punte e rientranze alternate lungo v. Larghezza e
 * sovrapposizione valgono sull'APICE della curva anche quando è arrotondata, così arrotondare non stacca le
 * linee: si risolve per i vertici veri che danno quegli apici (curva quadratica, punto di controllo sul vertice).
 */
function lato(p: ParametriRete, s: number, fase: number, vmin: number, vmax: number): PuntoLato[] {
  const H = p.diamondHeightMm, f = Math.max(0, Math.min(1, p.cornerRounding / 100));
  const apiceRientranza = -s * p.overlapMm / 2, apicePunta = s * p.diamondWidthMm / 2;
  // apice = x + (vicino − x)·f/4, per la rientranza e per la punta: due equazioni
  const a11 = 1 - f / 4, a12 = f / 4, det = a11 * a11 - a12 * a12;
  const xr = (apiceRientranza * a11 - a12 * apicePunta) / det, xp = (a11 * apicePunta - a12 * apiceRientranza) / det;
  const vertici: Array<{ u: number; v: number }> = [];
  for (let j = Math.floor((vmin - fase) / H) - 1; j <= Math.ceil((vmax - fase) / H) + 1; j++) {
    vertici.push({ u: xr, v: fase + j * H }, { u: xp, v: fase + j * H + H / 2 });
  }
  const out: PuntoLato[] = [];
  let ultimo: { u: number; v: number } | null = null;
  const dritto = (a: { u: number; v: number }, b: { u: number; v: number }) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.u - a.u, b.v - a.v) / 0.25));
    for (let i = 1; i < n; i++) out.push({ u: a.u + (b.u - a.u) * i / n, v: a.v + (b.v - a.v) * i / n, fisso: false, apice: false });
  };
  for (let i = 0; i < vertici.length; i++) {
    const V = vertici[i], pr = vertici[i - 1], nx = vertici[i + 1];
    if (!pr || !nx || f === 0) {
      if (ultimo) dritto(ultimo, V);
      out.push({ ...V, fisso: true, apice: true });
      ultimo = V;
      continue;
    }
    const A = { u: V.u + (pr.u - V.u) * f / 2, v: V.v + (pr.v - V.v) * f / 2 };
    const B = { u: V.u + (nx.u - V.u) * f / 2, v: V.v + (nx.v - V.v) * f / 2 };
    if (ultimo) dritto(ultimo, A);
    const N = 16;
    for (let k = 0; k <= N; k++) {
      const t = k / N, m = 1 - t;
      out.push({
        u: m * m * A.u + 2 * m * t * V.u + t * t * B.u, v: m * m * A.v + 2 * m * t * V.v + t * t * B.v,
        fisso: k === 0 || k === N || k === N / 2, apice: k === N / 2,
      });
    }
    ultimo = B;
  }
  return out;
}

/** u del lato alla quota v (il lato è monotono in v). */
function uA(pts: PuntoLato[], v: number): number {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].v <= v) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], t = b.v === a.v ? 0 : (v - a.v) / (b.v - a.v);
  return a.u + (b.u - a.u) * t;
}
function fetta(pts: PuntoLato[], v0: number, v1: number): PuntoLato[] {
  const o: PuntoLato[] = [{ u: uA(pts, v0), v: v0, fisso: true, apice: false }];
  for (const q of pts) if (q.v > v0 + 1e-6 && q.v < v1 - 1e-6) o.push(q);
  o.push({ u: uA(pts, v1), v: v1, fisso: true, apice: false });
  return o;
}

// ------------------------------------------------------------------------------------------------ la rete

/** Un punto della traccia (prima dei punti ago), in mm. `poly` = il contorno su cui sta, se ci sta. */
interface PuntoTraccia extends Point {
  fisso: boolean; apice?: boolean; poly?: Polyline;
  /** Quale linea della rete: 2k = il lato sinistro della colonna k, 2k + 1 il destro. In ordine, da sinistra a destra. */
  riga?: number;
}

type Pezzo =
  | { tipo: 'rete' | 'raccordo' | 'vuoto' | 'fondo' | 'salto'; pts: PuntoTraccia[]; sid: number; blocco: number }
  | { tipo: 'bordo'; poly: Polyline; a: PuntoTraccia; b: PuntoTraccia; daVuoto?: boolean; sid: number; blocco: number };

type PezzoRisolto = { tipo: TipoTratto | 'salto'; pts: PuntoTraccia[]; sid: number; blocco: number; daVuoto?: boolean; strati?: number[] };

/**
 * La rete dentro il pezzo `contorno` (un anello chiuso), fuori dalle aree `vuoti`.
 * Ritorna i punti ago in ordine di cucitura, un tratto continuo per blocco.
 */
export function costruisciRete(contorno: Polyline, vuoti: Polyline[], par: ParametriRete): RisultatoRete {
  const t0 = Date.now();
  const p: ParametriRete = { ...PARAMETRI_RETE, ...par };
  let W = Math.max(1, p.diamondWidthMm); const H = Math.max(1, p.diamondHeightMm);
  p.diamondWidthMm = W; p.diamondHeightMm = H;
  const ang = p.angleDeg * Math.PI / 180;
  const U = { x: Math.cos(ang), y: Math.sin(ang) }, V = { x: -Math.sin(ang), y: Math.cos(ang) };
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const q of contorno) { mnx = Math.min(mnx, q.x); mny = Math.min(mny, q.y); mxx = Math.max(mxx, q.x); mxy = Math.max(mxy, q.y); }
  const C = { x: (mnx + mxx) / 2, y: (mny + mxy) / 2 };
  const mondo = (u: number, v: number): Point => ({ x: C.x + u * U.x + v * V.x, y: C.y + u * U.y + v * V.y });
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const q of contorno) {
    const dx = q.x - C.x, dy = q.y - C.y, u = dx * U.x + dy * U.y, v = dx * V.x + dy * V.y;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }

  const ritorno = p.voidMode === 'ritorno';
  // l'ingombro di ogni vuoto: con decine di vuoti la prova «dentro?» guarda solo quelli che possono contenere il punto
  const ingombri = vuoti.map((v) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const q of v) { a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x); d = Math.max(d, q.y); }
    return { x0: a, y0: b, x1: c, y1: d };
  });
  const nelVuotoI = (q: Point) => vuoti.findIndex((v, i) => { const g = ingombri[i]; return q.x >= g.x0 && q.x <= g.x1 && q.y >= g.y0 && q.y <= g.y1 && pointInPolygon(q, v); });
  const dentro = (q: Point) => pointInPolygon(q, contorno) && (!ritorno || nelVuotoI(q) < 0);
  let passo = Math.max(0.5, W - p.overlapMm), u0 = 0, colonneIntere: RisultatoRete['colonneIntere'];
  if (p.fitColumns) {
    // un numero intero di colonne nella larghezza: la prima a mezzo passo dal bordo (lì cadrebbe la colonna vicina)
    const n = Math.max(1, Math.round((umax - umin) / passo));
    passo = (umax - umin) / n; W = passo + p.overlapMm; p.diamondWidthMm = W; u0 = umin + passo / 2;
    colonneIntere = { colonne: n, larghezzaRombo: W };
  }

  // 1. le colonne e i loro tratti: basta che UNA delle due linee sia dentro, ognuna poi si ferma sul proprio bordo.
  //    Sul bordo inclinato le punte entrano ed escono: tratti separati da meno di un rombo sono la stessa colonna.
  interface Colonna { k: number; uc: number; L: PuntoLato[]; R: PuntoLato[]; tratti: Array<[number, number]> }
  const colonne: Colonna[] = [];
  for (let k = Math.floor((umin - u0) / passo) - 1; k <= Math.ceil((umax - u0) / passo) + 1; k++) {
    const uc = u0 + k * passo, fase = p.staggerColumns && (((k % 2) + 2) % 2) ? H / 2 : 0;
    const L = lato(p, -1, fase, vmin, vmax), R = lato(p, 1, fase, vmin, vmax);
    const corse: Array<[number, number]> = []; let inizio: number | null = null; const dv = 0.25;
    for (let v = vmin; v <= vmax + dv; v += dv) {
      const ok = v <= vmax && (dentro(mondo(uc + uA(L, v), v)) || dentro(mondo(uc + uA(R, v), v)));
      if (ok && inizio === null) inizio = v;
      if (!ok && inizio !== null) { corse.push([inizio, v - dv]); inizio = null; }
    }
    const tratti: Array<[number, number]> = [];
    for (const r of corse) { if (tratti.length && r[0] - tratti[tratti.length - 1][1] < H) tratti[tratti.length - 1][1] = r[1]; else tratti.push([r[0], r[1]]); }
    colonne.push({ k, uc, L, R, tratti: tratti.filter(([a, b]) => b - a >= 0.5) });
  }

  // 2. i blocchi: la serpentina va avanti finché il tratto della colonna dopo tocca il suo; i tratti che restano
  //    fuori (sotto un vuoto, in un'insenatura) aprono un blocco che si cuce dopo.
  interface Blocco { cols: Array<{ col: Colonna; v0: number; v1: number }>; ultimaK: number; ultimo: [number, number] }
  const blocchi: Blocco[] = [], aperti: Blocco[] = [];
  for (const col of colonne) {
    const presi = new Set<Blocco>();
    for (const I of col.tratti) {
      let b = aperti.find((x) => x.ultimaK === col.k - 1 && !presi.has(x) && x.ultimo[0] < I[1] && I[0] < x.ultimo[1]);
      if (!b) { b = { cols: [], ultimaK: col.k, ultimo: I }; blocchi.push(b); aperti.push(b); }
      b.cols.push({ col, v0: I[0], v1: I[1] }); b.ultimo = I; b.ultimaK = col.k; presi.add(b);
    }
    for (let i = aperti.length - 1; i >= 0; i--) if (aperti[i].ultimaK !== col.k) aperti.splice(i, 1);
  }

  // 3. ogni linea arriva al SUO bordo. I tratti che corrono sul contorno (punta che esce, giro in fondo, raccordo
  //    in cima) sono pezzi «bordo»: dove cadono davvero si decide al passo 5, in ordine di cucitura.
  // il contorno attraversato: quello del vuoto dove cade il punto appena fuori, altrimenti il contorno del pezzo
  const contornoDi = (fuori: Point): Polyline => { const i = ritorno && pointInPolygon(fuori, contorno) ? nelVuotoI(fuori) : -1; return i >= 0 ? vuoti[i] : contorno; };
  const attraversa = (a: Point, b: Point): PuntoTraccia => { // a dentro, b fuori
    let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (dentro(lerp(a, b, m))) lo = m; else hi = m; }
    const q = lerp(a, b, lo); return { x: q.x, y: q.y, fisso: true, poly: contornoDi(lerp(a, b, hi)) };
  };
  type Tratto = { tipo: 'rete'; pts: PuntoTraccia[] } | { tipo: 'bordo'; poly: Polyline; a: PuntoTraccia; b: PuntoTraccia };
  const taglia = (pts: PuntoTraccia[]): Tratto[] => {
    const ins = pts.map(dentro), f = ins.indexOf(true), l = ins.lastIndexOf(true);
    if (f < 0) return [];
    const out: Tratto[] = []; let cur: PuntoTraccia[] = [];
    if (f > 0) cur.push(attraversa(pts[f], pts[f - 1]));
    for (let i = f; i <= l; i++) {
      if (ins[i]) { cur.push(pts[i]); continue; }
      let j = i; while (!ins[j + 1]) j++;
      const a = attraversa(pts[i - 1], pts[i]), b = attraversa(pts[j + 1], pts[j]);
      if (a.poly === b.poly) { cur.push(a); out.push({ tipo: 'rete', pts: cur }, { tipo: 'bordo', poly: a.poly!, a, b }); cur = [b]; }
      else cur.push(a, b);
      i = j;
    }
    if (l < pts.length - 1) cur.push(attraversa(pts[l], pts[l + 1]));
    out.push({ tipo: 'rete', pts: cur });
    return out.filter((s) => s.tipo === 'bordo' || s.pts.length > 1);
  };

  const pezzi: Pezzo[] = []; let sid = 0;
  const grande = Math.max(W, H);
  const verso = (col: Colonna, q: PuntoLato, riga: number): PuntoTraccia => ({ ...mondo(col.uc + q.u, q.v), fisso: q.fisso, apice: q.apice, riga });
  const ultimoPunto = (): PuntoTraccia => { const pc = pezzi[pezzi.length - 1]; return pc.tipo === 'bordo' ? pc.b : pc.pts[pc.pts.length - 1]; };
  const collega = (a: PuntoTraccia, b: PuntoTraccia, blocco: number, puoSaltare: boolean) => { // giro in fondo, raccordo in cima
    if (a.poly && a.poly === b.poly) {
      if (puoSaltare && lunghezza(sulContorno(a.poly, a, b)) > 2.5 * grande) pezzi.push({ tipo: 'salto', pts: [a, b], sid: sid++, blocco });
      else pezzi.push({ tipo: 'bordo', poly: a.poly, a, b, sid: sid++, blocco });
    } else pezzi.push({ tipo: puoSaltare && distance(a, b) > 2.2 * grande ? 'salto' : 'raccordo', pts: [{ ...a, fisso: true }, { ...b, fisso: true }], sid: sid++, blocco });
  };
  // Ogni parte nuova comincia, se può, dal contorno esterno del cartamodello: delle quattro partenze (dall'alto o
  // dal basso, verso destra o verso sinistra) si tengono quelle che partono sul contorno, e fra queste la più vicina
  // a dove è finita la parte prima.
  const lineeDelBlocco = (b: Blocco, dalBasso: boolean, versoSinistra: boolean): Tratto[][][] =>
    (versoSinistra ? [...b.cols].reverse() : b.cols).map((c) => {
      const L = fetta(c.col.L, c.v0 - 0.5, c.v1 + 0.5).map((q) => verso(c.col, q, 2 * c.col.k));
      const R = fetta(c.col.R, c.v0 - 0.5, c.v1 + 0.5).map((q) => verso(c.col, q, 2 * c.col.k + 1));
      const [andata, torna] = versoSinistra ? [R, L] : [L, R]; // si torna sul lato che guarda la colonna dopo
      const va = dalBasso ? andata.slice().reverse() : andata, ri = dalBasso ? torna : torna.slice().reverse();
      return [taglia(va), taglia(ri)].filter((ln) => ln.length);
    });
  const inizioDi = (ln: Tratto[]): PuntoTraccia => (ln[0].tipo === 'rete' ? ln[0].pts[0] : ln[0].a);
  blocchi.forEach((b, bi) => {
    const fine = pezzi.length ? ultimoPunto() : null;
    let meglio: { voto: number; cols: Tratto[][][] } | null = null;
    for (const dalBasso of [false, true]) for (const versoSinistra of [false, true]) {
      const cols = lineeDelBlocco(b, dalBasso, versoSinistra), prima = cols.flat()[0];
      if (!prima) continue;
      const s0 = inizioDi(prima);
      const voto = (s0.poly === contorno ? 0 : 1e6) + (fine ? distance(fine, s0) : s0.y + s0.x * 0.01);
      if (!meglio || voto < meglio.voto) meglio = { voto, cols };
    }
    if (!meglio) return;
    meglio.cols.forEach((linee, ci) => linee.forEach((ln, li) => {
      const primo = inizioDi(ln);
      if (pezzi.length) {
        if (ci === 0 && li === 0) pezzi.push({ tipo: 'salto', pts: [ultimoPunto(), primo], sid: sid++, blocco: bi });
        else collega(ultimoPunto(), primo, bi, li === 0);
      }
      for (const s of ln) pezzi.push(s.tipo === 'rete' ? { tipo: 'rete', pts: s.pts, sid: sid++, blocco: bi } : { ...s, sid: sid++, blocco: bi });
    }));
  });

  const locale = (q: Point) => { const dx = q.x - C.x, dy = q.y - C.y; return { u: dx * U.x + dy * U.y, v: dx * V.x + dy * V.y }; };
  return { ...cuci(pezzi, { contorno, vuoti, ritorno, nelVuotoI, grande, locale, ordine: (ra, rb) => rb - ra }, p, t0), colonneIntere };
}

/**
 * Come la geometria si legge per riconoscere le lenti: `locale` dà a ogni punto la sua posizione di traverso (u) e
 * lungo le linee (v); le linee sono monotone in v. `ordine(ra, rb)` > 0 se la linea ra sta prima (a sinistra) di rb.
 * `giro` = il periodo di u se è un angolo (la rete radiale): le differenze si prendono sul giro più corto.
 */
interface Geometria {
  contorno: Polyline;
  vuoti: Polyline[];
  ritorno: boolean;
  nelVuotoI: (q: Point) => number;
  grande: number;
  locale: (q: Point) => { u: number; v: number };
  ordine: (ra: number, rb: number) => number;
  giro?: number;
}

/**
 * La cucitura, uguale per tutte le reti: i vuoti attraversati, le passate sul contorno affiancate, le zone di
 * sovrapposizione (sotto e sopra), i punti ago, il punto minimo e massimo. Riceve i pezzi in ordine di cucitura.
 */
function cuci(pezzi: Pezzo[], g: Geometria, p: ParametriRete, t0: number): RisultatoRete {
  const { contorno, vuoti, ritorno, nelVuotoI, grande } = g;
  // 4. vuoti attraversati (modi «bordo» e «centro»): dentro il vuoto la linea gira sul suo contorno o tira dritta.
  let fila: Pezzo[] = pezzi;
  if (!ritorno && vuoti.length) {
    fila = [];
    const nelVuoto = nelVuotoI;
    const entra = (a: Point, b: Point, vi: number): PuntoTraccia => {
      let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (pointInPolygon(lerp(a, b, m), vuoti[vi])) hi = m; else lo = m; }
      const q = lerp(a, b, lo); return { x: q.x, y: q.y, fisso: true };
    };
    for (const pc of pezzi) {
      if (pc.tipo !== 'rete') { fila.push(pc); continue; }
      let cur: PuntoTraccia[] = [];
      const q = pc.pts; let i = 0;
      while (i < q.length) {
        const vi = nelVuoto(q[i]);
        if (vi < 0 || i === 0) { cur.push(q[i]); i++; continue; }
        let j = i; while (j + 1 < q.length && nelVuoto(q[j + 1]) === vi) j++;
        if (j === q.length - 1) { i = j + 1; continue; }
        const dentroA = entra(q[i - 1], q[i], vi), fuoriB = entra(q[j + 1], q[j], vi);
        cur.push(dentroA); fila.push({ ...pc, pts: cur });
        if (p.voidMode === 'centro') fila.push({ tipo: 'vuoto', pts: [dentroA, fuoriB], sid: pc.sid, blocco: pc.blocco });
        else fila.push({ tipo: 'bordo', poly: vuoti[vi], a: dentroA, b: fuoriB, daVuoto: true, sid: pc.sid, blocco: pc.blocco });
        cur = [fuoriB]; i = j + 1;
      }
      fila.push({ ...pc, pts: cur });
    }
  }

  // 5. le passate sul contorno, in ordine di cucitura. Il filo delle teste speciali è spesso: sul bordo non si
  //    sovrappone. Dove c'è già filo la passata nuova va accanto, verso l'interno, uno spessore per ogni passata
  //    già posata; si sposta solo il tratto coperto. Le linee della rete si fermano sulla passata.
  interface Perimetro { poly: Polyline; cum: number[]; T: number; segno: number; corse: Array<{ s0: number; len: number }> }
  const perimetri = new Map<Polyline, Perimetro>();
  const perimetro = (poly: Polyline): Perimetro => {
    const g = perimetri.get(poly); if (g) return g;
    const cum = [0]; for (let i = 0; i < poly.length; i++) cum.push(cum[i] + distance(poly[i], poly[(i + 1) % poly.length]));
    const a = poly[0], b = poly[1], l = distance(a, b) || 1, m = lerp(a, b, 0.5);
    const verso = poly === contorno; // verso l'interno: dentro il pezzo, fuori dal vuoto
    const segno = pointInPolygon({ x: m.x - (b.y - a.y) / l * 0.01, y: m.y + (b.x - a.x) / l * 0.01 }, poly) === verso ? 1 : -1;
    const r: Perimetro = { poly, cum, T: cum[cum.length - 1], segno, corse: [] };
    perimetri.set(poly, r); return r;
  };
  const normaleLato = (pe: Perimetro, i: number): Point => {
    const a = pe.poly[i], b = pe.poly[(i + 1) % pe.poly.length], l = distance(a, b) || 1;
    return { x: -(b.y - a.y) / l * pe.segno, y: (b.x - a.x) / l * pe.segno };
  };
  const posizione = (pe: Perimetro, s: number): { pt: Point; nr: Point } => {
    const n = pe.poly.length; s = ((s % pe.T) + pe.T) % pe.T;
    let i = 0; while (i < n - 1 && pe.cum[i + 1] <= s) i++;
    const el = pe.cum[i + 1] - pe.cum[i], t = el ? (s - pe.cum[i]) / el : 0;
    let nr = normaleLato(pe, i);
    if (t < 1e-6) { // sul vertice: la bisettrice, allungata perché i due lati restino a uno spessore
      const n0 = normaleLato(pe, (i - 1 + n) % n), sx = n0.x + nr.x, sy = n0.y + nr.y, sl = Math.hypot(sx, sy) || 1;
      const k = Math.min(2, 1 / Math.max(0.5, (sx * nr.x + sy * nr.y) / sl));
      nr = { x: sx / sl * k, y: sy / sl * k };
    }
    return { pt: lerp(pe.poly[i], pe.poly[(i + 1) % n], t), nr };
  };
  const ascissa = (pe: Perimetro, q: Point) => { const pr = proietta(q, pe.poly); return pe.cum[pr.i] + pr.t * (pe.cum[pr.i + 1] - pe.cum[pr.i]); };
  const stratiIn = (pe: Perimetro, s: number) => pe.corse.filter((r) => { const d = (((s - r.s0) % pe.T) + pe.T) % pe.T; return d > 1e-3 && d < r.len - 1e-3; }).length;
  /** La linea si ferma a distanza d dal contorno. false = è tutta più vicina di d: una punta che sfiora il bordo, dove c'è già filo. */
  const fermaA = (pts: PuntoTraccia[], poly: Polyline, d: number): boolean => {
    const dp = (q: Point) => proietta(q, poly).d;
    let i = pts.length - 1; while (i > 0 && dp(pts[i - 1]) < d) i--;
    if (i === 0) return false;
    let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (dp(lerp(pts[i - 1], pts[i], m)) >= d) lo = m; else hi = m; }
    const q = lerp(pts[i - 1], pts[i], lo); pts.splice(i); pts.push({ x: q.x, y: q.y, fisso: true });
    return true;
  };
  const risolti: PezzoRisolto[] = []; let fermaDopo: { poly: Polyline; d: number } | null = null;
  for (const pc of fila) {
    if (pc.tipo !== 'bordo') {
      const r: PezzoRisolto = { tipo: pc.tipo, pts: pc.pts.slice(), sid: pc.sid, blocco: pc.blocco };
      let tieni = true;
      if (r.tipo === 'rete' && fermaDopo && fermaDopo.d > 0) { r.pts.reverse(); tieni = fermaA(r.pts, fermaDopo.poly, fermaDopo.d); r.pts.reverse(); }
      fermaDopo = null;
      if (tieni) risolti.push(r);
      continue;
    }
    const pe = perimetro(pc.poly), sa = ascissa(pe, pc.a), sb = ascissa(pe, pc.b);
    const avanti = (((sb - sa) % pe.T) + pe.T) % pe.T, dir = avanti <= pe.T - avanti ? 1 : -1, len = Math.min(avanti, pe.T - avanti);
    const n = Math.max(1, Math.ceil(len / 0.25)), pts: PuntoTraccia[] = [];
    const ss = Array.from({ length: n + 1 }, (_, k) => sa + dir * len * k / n);
    const strati = ss.map((s) => stratiIn(pe, s));
    // dove una passata finisce e la successiva comincia, il conteggio vede un buco di un campione: si riempie
    for (let k = 1; k < n; k++) strati[k] = Math.max(strati[k], Math.min(strati[k - 1], strati[k + 1]));
    ss.forEach((s, k) => {
      const { pt, nr } = posizione(pe, s), o = strati[k] * p.constructionStroke;
      pts.push({ x: pt.x + nr.x * o, y: pt.y + nr.y * o, fisso: k === 0 || k === n || strati[k] !== strati[k - 1] });
    });
    pe.corse.push({ s0: dir > 0 ? sa : sb, len });
    let prec = risolti[risolti.length - 1];
    if (prec && prec.tipo === 'rete' && strati[0] > 0 && !fermaA(prec.pts, pc.poly, strati[0] * p.constructionStroke)) { risolti.pop(); prec = risolti[risolti.length - 1]; }
    if (prec && prec.tipo !== 'salto') { pts.unshift({ ...prec.pts[prec.pts.length - 1], fisso: true }); strati.unshift(strati[0]); } // parte da dove la linea si è fermata
    risolti.push({ tipo: 'bordo', pts, sid: pc.sid, blocco: pc.blocco, daVuoto: pc.daVuoto, strati });
    fermaDopo = { poly: pc.poly, d: strati[strati.length - 1] * p.constructionStroke };
  }
  // la passata finisce dove riparte la linea (accorciata)
  for (let i = 1; i < risolti.length; i++) {
    const a = risolti[i - 1], b = risolti[i];
    if (a.tipo === 'bordo' && b.tipo === 'rete') { a.pts.push({ ...b.pts[0], fisso: true }); a.strati!.push(a.strati![a.strati!.length - 1]); }
  }

  // 6. le zone di sovrapposizione: dove due linee della rete si incrociano fanno una lente; la zona è il tratto di
  //    linea fra i due punti d'incrocio, allargato (o stretto) dell'ampiezza. Il contorno non conta: lì il filo
  //    non si sovrappone (passo 5). In ogni lente la linea cucita prima sta SOTTO e quella che passa dopo SOPRA
  //    (Lorenzo, 2026-10-15): ognuna col suo punto.
  const cella = 2, griglia = new Map<string, Array<{ a: Point; b: Point; sid: number; idx: number }>>();
  const cum = risolti.map((pc) => { const c = [0]; for (let i = 1; i < pc.pts.length; i++) c.push(c[i - 1] + distance(pc.pts[i - 1], pc.pts[i])); return c; });
  const celle = (a: Point, b: Point, fn: (k: string) => void) => {
    const x0 = Math.floor(Math.min(a.x, b.x) / cella), x1 = Math.floor(Math.max(a.x, b.x) / cella);
    const y0 = Math.floor(Math.min(a.y, b.y) / cella), y1 = Math.floor(Math.max(a.y, b.y) / cella);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) fn(gx + ',' + gy);
  };
  const contaNelleZone = (pc: PezzoRisolto) => pc.tipo === 'rete' || pc.tipo === 'raccordo';
  risolti.forEach((pc, idx) => {
    if (!contaNelleZone(pc)) return;
    for (let i = 1; i < pc.pts.length; i++) {
      const a = pc.pts[i - 1], b = pc.pts[i];
      celle(a, b, (k) => { let l = griglia.get(k); if (!l) griglia.set(k, (l = [])); l.push({ a, b, sid: pc.sid, idx }); });
    }
  });
  type Zona = [number, number, boolean]; // da, a, sopra
  // Una lente è dove due linee si sono SCAMBIATE di posto: quella che sta a sinistra (riga più bassa) passa a destra
  // dell'altra. Accoppiare gli incroci a due a due nell'ordine non basta: se una lente è tagliata dal bordo e ha un
  // incrocio solo, le coppie slittano di uno e la zona diventa il tratto FRA due lenti (Lorenzo, 2026-10-15, coi rombi
  // 7,5 × 14,5 sul pezzo 200 × 160: zone da 13,4 mm invece di 4,0).
  const locale = g.locale;
  const differenza = (ua: number, ub: number) => { let d = ub - ua; if (g.giro) { const G = g.giro; d = ((d % G) + G * 1.5) % G - G / 2; } return d; };
  const rigaDi = (idx: number) => risolti[idx].pts.find((q) => q.riga !== undefined)?.riga;
  const uDellaLinea = (idx: number, v: number): number | null => {
    const q = risolti[idx].pts;
    for (let i = 1; i < q.length; i++) {
      const a = locale(q[i - 1]), b = locale(q[i]);
      if ((a.v - v) * (b.v - v) <= 0 && a.v !== b.v) return a.u + differenza(a.u, b.u) * (v - a.v) / (b.v - a.v);
    }
    return null;
  };
  const puntoA = (idx: number, s: number): Point => {
    const q = risolti[idx].pts, c = cum[idx]; let k = 1; while (k < q.length - 1 && c[k] < s) k++;
    return lerp(q[k - 1], q[k], Math.max(0, Math.min(1, (s - c[k - 1]) / ((c[k] - c[k - 1]) || 1))));
  };
  const eLente = (idx: number, altro: number, s1: number, s2: number): boolean => {
    const ra = rigaDi(idx), rb = rigaDi(altro);
    const m = locale(puntoA(idx, (s1 + s2) / 2)), ub = uDellaLinea(altro, m.v);
    if (ra === undefined || rb === undefined || ra === rb || ub === null) return s2 - s1 < grande; // un raccordo: la regola di prima
    const o = g.ordine(ra, rb);
    if (o === 0) return s2 - s1 < grande;
    return o > 0 ? differenza(m.u, ub) < 0 : differenza(m.u, ub) > 0;
  };
  // Due pezzi consecutivi si toccano dove uno finisce e l'altro comincia: quello non è un incrocio. Fra pezzi
  // consecutivi si ignora solo quel punto (la rete radiale ha discesa e risalita attaccate, e le lenti fra loro contano).
  const attacco = (idx: number, altro: number): Point | null =>
    altro === idx + 1 ? risolti[idx].pts[risolti[idx].pts.length - 1] : altro === idx - 1 ? risolti[idx].pts[0] : null;
  const vicinoAllAttacco = (idx: number, altro: number, q: Point) => { if (Math.abs(altro - idx) > 1) return false; const j = attacco(idx, altro); return !j || distance(j, q) < 0.05; };
  const zone: Zona[][] = risolti.map((pc, idx) => {
    if (!contaNelleZone(pc)) return [];
    const colpi = new Map<number, { dopo: boolean; altro: number; s: number[] }>(); // sid dell'altra linea → ascisse degli incroci lungo questa
    for (let i = 1; i < pc.pts.length; i++) {
      const a = pc.pts[i - 1], b = pc.pts[i], visti = new Set<object>();
      celle(a, b, (k) => {
        for (const o of griglia.get(k) ?? []) {
          if (o.sid === pc.sid || visti.has(o)) continue; visti.add(o);
          const t = incrocio(a, b, o.a, o.b); if (t === null || vicinoAllAttacco(idx, o.idx, lerp(a, b, t))) continue;
          let l = colpi.get(o.sid); if (!l) colpi.set(o.sid, (l = { dopo: idx > o.idx, altro: o.idx, s: [] }));
          l.s.push(cum[idx][i - 1] + t * (cum[idx][i] - cum[idx][i - 1]));
        }
      });
    }
    const z: Zona[] = [];
    for (const { dopo, altro, s: arr } of colpi.values()) {
      arr.sort((x, y) => x - y);
      const u = arr.filter((s, i) => i === 0 || s - arr[i - 1] > 1e-4); // lo stesso incrocio visto da due segmenti
      for (let i = 0; i + 1 < u.length; i++) if (eLente(idx, altro, u[i], u[i + 1])) { z.push([u[i] - p.overlapZoneMm, u[i + 1] + p.overlapZoneMm, dopo]); i++; }
    }
    // linee che si toccano senza incrociarsi (sovrapposizione 0): la zona è l'ampiezza attorno al contatto
    if (p.overlapZoneMm > 0) pc.pts.forEach((q, i) => {
      if (!q.apice) return;
      const s = cum[idx][i];
      const gx = Math.floor(q.x / cella), gy = Math.floor(q.y / cella);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of griglia.get((gx + dx) + ',' + (gy + dy)) ?? []) {
        if (o.sid === pc.sid || vicinoAllAttacco(idx, o.idx, q)) continue;
        if (distanceToSegment(q, o.a, o.b) < 0.05 && !z.some((r) => s > r[0] && s < r[1])) z.push([s - p.overlapZoneMm, s + p.overlapZoneMm, idx > o.idx]);
      }
    });
    return z.filter((r) => r[1] - r[0] > 1e-6);
  });

  // 7. i punti ago: uno su ogni punta, ogni apice, ogni confine di zona; ogni tratto fra due punti fissi in punti
  //    uguali, della lunghezza giusta per la sua zona.
  const blocchiOut: PuntoAgo[][] = [];
  let cur: PuntoAgo[] | null = null;
  risolti.forEach((pc, idx) => {
    const q = pc.pts;
    if (pc.tipo === 'salto') { cur = null; return; }
    const tipo: TipoTratto = pc.tipo === 'bordo' && pc.daVuoto ? 'vuoto' : pc.tipo;
    if (!cur) { cur = [{ x: q[0].x, y: q[0].y, tipo, sovrapposto: false, sopra: false, blocco: pc.blocco, strato: pc.strati?.[0] }]; blocchiOut.push(cur); }
    const zs = zone[idx], inZona = (s: number) => zs.find((r) => s > r[0] && s < r[1]);
    let da = 0;
    for (let i = 1; i < q.length; i++) {
      if (!(q[i].fisso || i === q.length - 1)) continue;
      const base = cum[idx][da], tot = cum[idx][i] - base, k0 = da; da = i;
      if (tot < 1e-6) continue;
      const a = (s: number): { pt: Point; k: number } => {
        const g = base + s; let k = k0 + 1; while (k < i && cum[idx][k] < g) k++;
        const c = cum[idx], t = (g - c[k - 1]) / ((c[k] - c[k - 1]) || 1);
        return { pt: lerp(q[k - 1], q[k], Math.max(0, Math.min(1, t))), k };
      };
      const tagli = [0, tot];
      for (const r of zs) for (const e of [r[0], r[1]]) if (e - base > 1e-6 && e - base < tot - 1e-6) tagli.push(e - base);
      tagli.sort((x, y) => x - y);
      for (let k = 1; k < tagli.length; k++) {
        const s0 = tagli[k - 1], len = tagli[k] - s0; if (len < 1e-6) continue;
        const zona = inZona(base + s0 + len / 2), sovrapposto = !!zona, sopra = !!zona?.[2];
        const sotto = p.underOverlapStitchMm > 0 ? p.underOverlapStitchMm : p.maxStitchMm;
        const lp = tipo === 'vuoto' ? p.voidStitchMm : !zona ? p.maxStitchMm : sopra ? p.overlapStitchMm : sotto;
        const n = Math.max(1, Math.ceil(len / Math.max(0.1, lp) - 1e-9));
        for (let m = 1; m <= n; m++) {
          const { pt, k: kk } = a(s0 + len * m / n);
          (cur as PuntoAgo[]).push({ x: pt.x, y: pt.y, tipo, sovrapposto, sopra, blocco: pc.blocco, strato: pc.strati?.[kk] });
        }
      }
    }
  });

  // 8. il punto minimo (R3), alla fine: enforceMinStitch tiene gli stessi oggetti, coi loro segni. Togliendo un
  //    punto corto, quello prima si allunga e può passare il massimo (R4): si ridivide in punti uguali.
  const massimo = Math.max(0.1, p.maxStitchMm, p.voidStitchMm, p.underOverlapStitchMm);
  const finali = blocchiOut.map((b) => {
    const tenuti = enforceMinStitch(b, p.minStitchMm) as PuntoAgo[];
    // enforceMinStitch tiene sempre l'ultimo punto: se è troppo vicino, si toglie il penultimo
    if (tenuti.length > 2 && distance(tenuti[tenuti.length - 2], tenuti[tenuti.length - 1]) < p.minStitchMm) tenuti.splice(tenuti.length - 2, 1);
    const out: PuntoAgo[] = [tenuti[0]];
    for (let i = 1; i < tenuti.length; i++) {
      const a = tenuti[i - 1], q = tenuti[i], n = Math.ceil(distance(a, q) / massimo - 1e-9);
      for (let k = 1; k < n; k++) out.push({ ...q, ...lerp(a, q, k / n) });
      out.push(q);
    }
    return out;
  }).filter((b) => b.length > 1);

  let punti = 0, sovr = 0, sopra = 0, filo = 0, mn = Infinity, mx = 0, saltiMm = 0, stratiMax = 0;
  finali.forEach((b, i) => {
    if (i) saltiMm += distance(finali[i - 1][finali[i - 1].length - 1], b[0]);
    punti += b.length;
    b.forEach((q, k) => {
      if (q.sovrapposto) sovr++;
      if (q.sopra) sopra++;
      stratiMax = Math.max(stratiMax, q.strato ?? 0);
      if (k) { const d = distance(b[k - 1], q); filo += d; mn = Math.min(mn, d); mx = Math.max(mx, d); }
    });
  });
  return {
    blocchi: finali,
    misure: {
      punti, puntiSovrapposti: sovr, puntiSopra: sopra, filoMm: filo, puntoMinMm: Number.isFinite(mn) ? mn : 0, puntoMaxMm: mx,
      salti: Math.max(0, finali.length - 1), saltiMm, stratiMax, tempoMs: Date.now() - t0,
    },
  };
}

// ------------------------------------------------------------------------------------------------ la sacca a rete

/**
 * Una linea per i suoi apici voluti T (i nodi, spostati della sovrapposizione), con gli angoli arrotondati: si cercano
 * i vertici veri che danno quegli apici, come nella rete a colonne (apice = V·(1 − f/4) + f/8·(prima + dopo)).
 */
function lineaArrotondata(T: Point[], f: number, riga: number): PuntoTraccia[] {
  const V = T.map((q) => ({ x: q.x, y: q.y }));
  if (f > 0) for (let it = 0; it < 80; it++) for (let i = 1; i < V.length - 1; i++) {
    V[i] = { x: (T[i].x - f / 8 * (V[i - 1].x + V[i + 1].x)) / (1 - f / 4), y: (T[i].y - f / 8 * (V[i - 1].y + V[i + 1].y)) / (1 - f / 4) };
  }
  const out: PuntoTraccia[] = [];
  const push = (q: Point, fisso: boolean, apice: boolean) => out.push({ x: q.x, y: q.y, fisso, apice, riga });
  const dritto = (a: Point, b: Point) => { const n = Math.max(1, Math.ceil(distance(a, b) / 0.25)); for (let i = 1; i < n; i++) push(lerp(a, b, i / n), false, false); };
  let ultimo: Point | null = null;
  for (let i = 0; i < V.length; i++) {
    const v = V[i], pr = V[i - 1], nx = V[i + 1];
    if (!pr || !nx || f === 0) { if (ultimo) dritto(ultimo, v); push(v, true, true); ultimo = v; continue; }
    const A = lerp(v, pr, f / 2), B = lerp(v, nx, f / 2);
    if (ultimo) dritto(ultimo, A);
    const N = 16;
    for (let k = 0; k <= N; k++) {
      const s = k / N, m = 1 - s;
      push({ x: m * m * A.x + 2 * m * s * v.x + s * s * B.x, y: m * m * A.y + 2 * m * s * v.y + s * s * B.y }, k === 0 || k === N || k === N / 2, k === N / 2);
    }
    ultimo = B;
  }
  return out;
}


/**
 * La SACCA A RETE: un disco di rombi coi lati tutti uguali (sacca.ts), centrato nel campo macchina. Ogni colonna è una
 * serpentina come nella rete a colonne, ma lungo un raggio: esce dal fondo su un lato, gira in cima sul contorno ed
 * entra sull'altro lato; poi una legatura entra nel fondo e torna fuori alla colonna dopo. Prima di tutto la spirale
 * del fondo, dal centro in fuori; alla fine, se si vuole, un giro d'impuntura in cima.
 */
export function costruisciReteRadiale(par: ParametriRete): RisultatoRete & { anelli: Anelli; centro: Point; cime: number[] | null } {
  const t0 = Date.now();
  const p: ParametriRete = { ...PARAMETRI_RETE, ...par };
  const N = Math.max(3, Math.round(p.radialCount)), L = Math.max(1, p.radialSideMm);
  const ovale = p.bottomShape === 'ovale';
  const A = ovale
    ? anelliOvali({ N, L, r0: p.bottomLengthMm / 2, b: p.bottomWidthMm / 2, tondo: p.bottomRoundEnds / 100, amax: p.maxAngleDeg, campo: p.fieldMm })
    : anelliRadiali({ N, L, r0: p.bottomRadiusMm, amax: p.maxAngleDeg, campo: p.fieldMm });
  const centro = { x: p.fieldMm / 2, y: p.fieldMm / 2 };
  const vuota = (avviso: string) => ({
    blocchi: [], avviso, anelli: A, centro, cime: null,
    misure: { punti: 0, puntiSovrapposti: 0, puntiSopra: 0, filoMm: 0, puntoMinMm: 0, puntoMaxMm: 0, salti: 0, saltiMm: 0, stratiMax: 0, tempoMs: Date.now() - t0 },
  });
  if (A.impossibile) return vuota(ovale
    ? `Con ${N} rombi di lato ${L} mm il fondo ovale ${p.bottomLengthMm} × ${p.bottomWidthMm} mm non ha posto nemmeno per un anello: aumenta i rombi o il lato, o riduci il fondo.`
    : `Con ${N} rombi di lato ${L} mm il fondo non può avere raggio ${p.bottomRadiusMm} mm: il limite è ${A.rMaxPiatto.toFixed(1)} mm.`);
  if (A.rho.length < 3) return vuota('Fra il fondo e il limite non ci sta nemmeno un rombo: aumenta il lato, l’angolo massimo o il campo, o riduci il fondo.');
  // (ogni colonna finisce dove le sue due linee si incontrano: su un anello pari, `cimeDellaRete`)
  const n = A.rho.length - 1, rOut = A.rho[n - (n % 2)], r0 = A.rho[0];
  const pol = (r: number, f: number): Point => ({ x: centro.x + r * Math.cos(f), y: centro.y + r * Math.sin(f) });
  const tangente = (f: number): Point => ({ x: -Math.sin(f), y: Math.cos(f) });
  const fi = (k: number) => 2 * Math.PI * k / N;
  const angoloNodo = (j: number, k: number) => fi(k) + (j % 2 ? Math.PI / N : 0);
  const nodoA = (j: number, k: number): Point => { const q = puntoDelNodo(A, N, j, k); return { x: centro.x + q.x, y: centro.y + q.y }; };
  // le colonne dei lati lunghi che si fermano prima (fondo ovale, «Fascia sui lati lunghi»): ognuna col suo ultimo anello
  const cime = cimeDellaRete(A, N, ovale ? p.sideBandMm : 0), cima = (k: number) => (cime ? cime[((k % N) + N) % N] : n);
  // il contorno in cima: un cerchio con un vertice su ogni nodo dell'ultimo anello (sull'ovale, i nodi dell'ultimo anello;
  // con le colonne tagliate, la cima di ogni colonna)
  const M = ovale ? N : 2 * N * Math.ceil(360 / (2 * N));
  const contorno: Polyline = ovale ? Array.from({ length: N }, (_, k) => nodoA(cima(k), k)) : Array.from({ length: M }, (_, i) => pol(rOut, 2 * Math.PI * i / M));

  // le due linee della colonna k: B a sinistra (verso l'angolo minore), A a destra. Agli anelli pari si toccano fra
  // loro (la rientranza), agli anelli dispari toccano le colonne vicine (le punte). La sovrapposizione le porta oltre
  // il nodo di mezza misura, di traverso (anello per anello, se la lente dev'essere costante); i capi restano sui nodi.
  const f = Math.max(0, Math.min(1, p.cornerRounding / 100));
  const mezza = A.rho.map((_, j) => sovrapposizioneAlNodo(A, N, j, p.overlapMm, p.overlapRule, L) / 2);
  const linea = (k: number, lato: -1 | 1): PuntoTraccia[] => {
    const T: Point[] = [], cimaK = cima(k);
    for (let j = 0; j <= cimaK; j++) {
      const kk = j % 2 && lato < 0 ? k - 1 : k, a = angoloNodo(j, kk), q = ovale ? nodoA(j, kk) : pol(A.rho[j], a);
      // in cima, e dove l'altra linea non arriva (la colonna vicina è già finita), niente incrocio: il nodo resta dov'è
      if (j === 0 || j === cimaK || !siIncrociano(cime, N, j, kk)) { T.push(q); continue; }
      // sull'ovale ogni nodo ha il suo incrocio, e lo spostamento va lungo il suo anello
      const verso = j % 2 ? lato : -lato, t = ovale ? tangenteAlNodo(A, N, j, kk) : tangente(a);
      const m = ovale ? sovrapposizioneAlNodo(A, N, j, p.overlapMm, p.overlapRule, L, kk) / 2 : mezza[j];
      T.push({ x: q.x + t.x * m * verso, y: q.y + t.y * m * verso });
    }
    return lineaArrotondata(T, f, 2 * k + (lato > 0 ? 1 : 0));
  };

  const pezzi: Pezzo[] = []; let sid = 0;
  // 1. il fondo: la spirale dal centro in fuori, che finisce sul nodo 0 dell'anello 0
  // (sull'ovale i giri sono gli ovali del fondo, `puntoDelFondo`: alla stessa distanza sui lati lunghi e sulle teste)
  const R0 = raggioDelFondo(A), passo = Math.max(0.3, p.spiralPitchMm), giri = R0 / passo, dritto = A.ovale ? A.ovale.a - A.ovale.b : 0;
  if (giri >= 1) {
    const Th = 2 * Math.PI * giri, sp: PuntoTraccia[] = [];
    for (let th = 0; th < Th; ) {
      const f = th / Th, q = puntoDelFondo(A, th - Th, f);
      sp.push({ x: centro.x + q.x, y: centro.y + q.y, fisso: sp.length === 0 });
      th += 0.25 / Math.max(dritto + f * R0, 0.5);
    }
    sp.push({ ...nodoA(0, 0), fisso: true });
    pezzi.push({ tipo: 'fondo', pts: sp, sid: sid++, blocco: 0 });
  }
  // 2. le colonne
  const nodo0 = (k: number): PuntoTraccia => ({ ...(ovale ? nodoA(0, k) : pol(r0, fi(k))), fisso: true });
  const dentro = (k: number, rs: number): Point => { const q = versoIlCentro(A, N, k, rs / R0); return { x: centro.x + q.x, y: centro.y + q.y }; };
  for (let k = 0; k < N; k++) {
    const B = linea(k, -1), Ar = linea(k, 1).reverse();
    pezzi.push({ tipo: 'rete', pts: B, sid: sid++, blocco: 0 });
    const a = B[B.length - 1], b = Ar[0];
    if (distance(a, b) > 1e-6) pezzi.push({ tipo: 'bordo', poly: contorno, a: { ...a, poly: contorno }, b: { ...b, poly: contorno }, sid: sid++, blocco: 0 });
    pezzi.push({ tipo: 'rete', pts: Ar, sid: sid++, blocco: 0 });
    // la legatura: dentro il fondo e fuori alla colonna dopo
    // (sull'ovale la profondità si misura sul mezzo asse corto, e la legatura entra lungo la forma del fondo)
    const rs = fondoDellaLegatura(k, N, Math.max(passo, p.tieSpacingMm), R0, Math.min(passo, R0 / 2));
    pezzi.push({ tipo: 'fondo', pts: [nodo0(k), { ...(ovale ? dentro(k, rs) : pol(rs, fi(k))), fisso: true }, nodo0(k + 1)], sid: sid++, blocco: 0 });
  }
  // 3. il giro in cima (un salto dal fondo fino alla bocca)
  if (p.rimPass) {
    const sulBordo = (i: number) => (ovale ? contorno[Math.round(i * M / 3) % M] : pol(rOut, 2 * Math.PI * i / 3));
    const s0 = { ...sulBordo(0), fisso: true, poly: contorno };
    pezzi.push({ tipo: 'salto', pts: [nodo0(0), s0], sid: sid++, blocco: 1 });
    for (let i = 0; i < 3; i++) {
      const a = { ...sulBordo(i), fisso: true, poly: contorno }, b = { ...sulBordo(i + 1), fisso: true, poly: contorno };
      pezzi.push({ tipo: 'bordo', poly: contorno, a, b, sid: sid++, blocco: 1 });
    }
  }

  const due = 2 * N;
  const r = cuci(pezzi, {
    contorno, vuoti: [], ritorno: false, nelVuotoI: () => -1, grande: 2 * L,
    locale: (q) => ({ u: Math.atan2(q.y - centro.y, q.x - centro.x), v: Math.hypot(q.x - centro.x, q.y - centro.y) }),
    ordine: (ra, rb) => { let d = (((rb - ra) % due) + due) % due; if (d > N) d -= due; return d; },
    giro: 2 * Math.PI,
  }, p, t0);
  return { ...r, anelli: A, centro, cime };
}

// ------------------------------------------------------------------------------------------------ il contratto (K1b)

import type { Ingresso, Motore } from '@rg/cervello';
import { refertoDaStrati, type ExportLayer as StratoEsportato } from '@rg/core';

/** Il colore del filo nell'anteprima e nel file: uno solo, la rete è un filo. */
export const COLORE_RETE = '#1f4e79';

export interface IngressoRete extends Ingresso {
  /** Il contorno esterno del cartamodello (anello chiuso, mm). Non serve col pezzo a misure. */
  contorno?: Polyline;
  /** Le aree vuote (anelli chiusi, mm). */
  vuoti?: Polyline[];
}

/** Il pezzo a misure: un rettangolo dall'origine, larghezza × altezza in mm. */
export function pezzoAMisure(par: Pick<ParametriRete, 'totalWidth' | 'totalHeight'>): Polyline {
  const w = Math.max(1, par.totalWidth), h = Math.max(1, par.totalHeight);
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

/** Il pezzo su cui si fa la rete: a misure (senza vuoti) o il cartamodello coi suoi vuoti. null = manca il cartamodello. */
export function pezzoDellaRete(par: ParametriRete, ingresso: IngressoRete): { contorno: Polyline; vuoti: Polyline[] } | null {
  if (par.pieceSource === 'misure') return { contorno: pezzoAMisure(par), vuoti: [] };
  return ingresso.contorno ? { contorno: ingresso.contorno, vuoti: ingresso.vuoti ?? [] } : null;
}

/** Lo strato da cucire: un tratto continuo per blocco; fra due blocchi la macchina salta. */
export function stratiRete(r: RisultatoRete): StratoEsportato[] {
  return [{ id: 'rete', color: COLORE_RETE, polylines: r.blocchi.map((b) => b.map((q) => ({ x: q.x, y: q.y }))) }];
}

export const motore: Motore<IngressoRete, ParametriRete> = {
  id: 'rete-testa-speciale',
  async genera(ingresso, params) {
    if (params.netShape === 'radiale') {
      const r = costruisciReteRadiale(params);
      const st = r.blocchi.length ? stratiRete(r) : [];
      return { strati: st, avvisi: r.avviso ? [r.avviso] : [], misure: refertoDaStrati(st) };
    }
    const pezzo = pezzoDellaRete({ ...PARAMETRI_RETE, ...params }, ingresso);
    if (!pezzo) return { strati: [], avvisi: ['Manca il contorno del cartamodello: caricalo, o scegli il pezzo a misure.'], misure: refertoDaStrati([]) };
    const r = costruisciRete(pezzo.contorno, pezzo.vuoti, params);
    const st = stratiRete(r);
    return { strati: st, avvisi: [], misure: refertoDaStrati(st) };
  },
};

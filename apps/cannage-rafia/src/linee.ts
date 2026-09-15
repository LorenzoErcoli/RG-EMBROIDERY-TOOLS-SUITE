// Cannage rafia — FASE 3: le linee orizzontali e verticali.
//
// Decifrata dal DST M1404 davanti e verificata sul lato: ricostruendo il modulo da questi parametri si
// ritrovano nei due file tutti gli elementi (2.120 su 2.120, scarto ≤ 0,56 mm). Le regole, in breve:
//
// - Tutto è agganciato ai rombi del PATTERN 1. Nel cannage i rombi che si toccano di punta a destra e
//   a sinistra hanno lo stesso pattern, quindi formano file orizzontali: un GRUPPO di linee corre lungo
//   la diagonale orizzontale di ogni fila di pattern 1 (una sì e una no, passo = altezza del rombo) e il
//   modulo si ripete ogni larghezza di rombo.
// - Un gruppo sono 4 linee: A e D esterne (±6,7), B e C interne (±4,75). Ogni linea è un CORDONCINO
//   (il filo ripassato più volte sullo stesso tratto) a pezzi, con una FINESTRA di filo singolo dove la
//   linea attraversa il lato del rombo — lì passa la cornice.
// - Andata con i cordoncini (e sulle esterne le SCALETTE verso fuori), ritorno con i FERMI sui giunti;
//   sulle interne al ritorno anche le BARRE ai vertici, e sulla C i MEANDRI che legano le due interne.
// - Ordine: A→ A← B→ B←, D→ D← C→ C←. I cambi di linea e di gruppo camminano sul bordo sinistro, fuori
//   dal pezzo.
//
// Misure PROPORZIONALI al rombo (Lorenzo, 15/09): le posizioni scalano con le mezze diagonali. Ma «ad un
// certo punto non si allungano solo i punti, aumentano anche gli oggetti»: un pezzo di cordoncino o un
// mattoncino di scaletta che, scalato, supera la sua lunghezza di riferimento di più della soglia si
// divide in più pezzi — con un fermo in più su ogni giunto nuovo. Fermi, barre e distanza fra le corsie
// dipendono dal filo, non dal rombo: restano fissi.
import type { DstProgram } from '@rg/core';

export type Punto = { x: number; y: number };

/**
 * Il reticolo dei rombi: il centro di un rombo del PATTERN 1 e le sue mezze diagonali (a orizzontale,
 * b verticale). Coordinate in mm, y verso il basso come in SVG. I rombi del pattern 1 stanno in
 * (cx + 2a·i, cy + 2b·j).
 */
export type Reticolo = { cx: number; cy: number; a: number; b: number };

/** Il rombo su cui la fase è stata misurata (M1404): 63,4 × 60,6 mm. Le posizioni scalano da qui. */
export const ROMBO_RIFERIMENTO = { a: 31.7, b: 30.3 } as const;

export type ParametriLinee = {
  /** Passate di ogni pezzo di cordoncino orizzontale (dispari: il pezzo finisce dall'altra parte). */
  passateCordoncino: number;
  /** Punto massimo dentro il cordoncino orizzontale, mm; 0 = un punto per passata. */
  puntoMaxCordoncino: number;
  /** Passate dei pezzi verticali (scalette e meandri). */
  passateVerticali: number;
  /** Punto massimo delle corse (filo singolo sulle linee e nelle finestre), mm. */
  puntoMaxCorsa: number;
  /** Lunghezza di riferimento di un pezzo di cordoncino, mm: oltre questa (più la soglia) si divide. */
  lunghezzaPezzo: number;
  /** Lunghezza di riferimento di un mattoncino di scaletta o meandro, mm. */
  lunghezzaMattoncino: number;
  /** Quanto un oggetto può allungarsi prima di diventare due (0,5 = il 50%). */
  sogliaOggetti: number;
  /** Di quanto la linea parte fuori dal bordo sinistro, mm. */
  sporgenzaSinistra: number;
  /** Quanto prima del bordo destro deve chiudersi la linea, al più: si ferma sull'ultimo giunto dentro. */
  rientroDestro: number;
  /** Distanza minima dal bordo del pezzo, in alto e in basso, per scalette, meandri e barre, mm. */
  margineVerticale: number;
  /** Punto dei passaggi sul bordo sinistro, mm. */
  puntoPassaggioBordo: number;
  /** Il contorno ripassato a inizio fase, per le termogarze: può esserci o no. */
  termogarze: boolean;
  /** Punto del contorno per le termogarze, mm. */
  puntoTermogarze: number;
};

/** Il riferimento reale (Lorenzo): le passate del davanti M1404. */
export const PARAMETRI_DAVANTI: ParametriLinee = {
  passateCordoncino: 9,
  puntoMaxCordoncino: 0,
  passateVerticali: 11,
  puntoMaxCorsa: 10,
  lunghezzaPezzo: 8.4,
  lunghezzaMattoncino: 7.5,
  sogliaOggetti: 0.5,
  sporgenzaSinistra: 1,
  rientroDestro: 2,
  margineVerticale: 3,
  puntoPassaggioBordo: 2.5,
  termogarze: false,
  puntoTermogarze: 4,
};

/** L'alternativa usata in alcuni modelli (il lato M1404): più passate a punto corto. */
export const PARAMETRI_LATO: ParametriLinee = {
  ...PARAMETRI_DAVANTI,
  passateCordoncino: 17,
  puntoMaxCordoncino: 3.5,
  puntoMaxCorsa: 3.5,
};

/** Un pezzo di scaletta o di meandro: corsia (−1, 0, +1), capo di partenza `da` e di arrivo `a`. */
type VoceVerticale = { corsia: number; da: number; a: number; torna: boolean };

/**
 * Il modulo, in mm sul rombo di riferimento: x dal centro del rombo, y dalla sua diagonale orizzontale.
 * Le x scalano con a/31,7, le y con b/30,3.
 */
const MODULO = {
  rigaInterna: 4.75,
  rigaEsterna: 6.7,
  finestraEsterna: [21.2, 26.7] as const,
  finestraInterna: [23.7, 29.0] as const,
  /** Giunti fra pezzi di cordoncino, oltre ai bordi finestra e al vertice (simmetrici). */
  giuntiEsterni: [4.85, 11.9],
  giuntiInterni: [0, 8, 16],
  /** Scalette (linee esterne) e meandri (fra le interne): a ±8 dal centro del rombo. */
  xVerticali: 8,
  /** Le scalette partono qui, 0,75 mm dentro la linea esterna, e vanno verso fuori. */
  baseScaletta: 5.95,
  /**
   * La scaletta, pezzo per pezzo NELL'ORDINE DEL DST, coi tratti misurati dalla base verso fuori: il
   * cordoncino parte da `da` e arriva ad `a`; `torna` = passate pari, il pezzo finisce da dove è partito.
   *
   * L'ordine e i capi di partenza non sono un dettaglio: decidono dove cammina il filo fra un pezzo e
   * l'altro, cioè le PUNTE. La prima versione sceglieva «il capo più vicino»: la geometria dei pezzi era
   * giusta, ma dalla cima della corsia centrale il filo passava sulla sinistra e ci saliva fino in
   * cima — punta diversa dal DST e dal disegno (Lorenzo, 15/09). Nel DST la corsia centrale alta si
   * prende DALL'ALTO e la sinistra si attacca a metà, finendo da dove parte.
   */
  scaletta: [
    { corsia: 1, da: 0, a: 3.3, torna: false },
    { corsia: 0, da: 0, a: 7.5, torna: false },
    { corsia: 1, da: 4.3, a: 11.9, torna: false },
    { corsia: 0, da: 15.5, a: 8.7, torna: false },
    { corsia: -1, da: 11.9, a: 4.4, torna: true },
    { corsia: -1, da: 0, a: 3.3, torna: true },
  ] as VoceVerticale[],
  /** Il meandro, allo stesso modo: tratti misurati dalla diagonale, nell'ordine del DST. */
  meandro: [
    { corsia: 0, da: 6.3, a: 1.6, torna: false },
    { corsia: 1, da: 3.8, a: -2.4, torna: false },
    { corsia: 0, da: -5.3, a: -0.3, torna: false },
    { corsia: -1, da: -2.1, a: 3.6, torna: false },
  ] as VoceVerticale[],
  /** Dal meandro si torna sulla linea passando dalla corsia centrale a questa altezza. */
  uscitaMeandro: 1.6,
  barraSopra: [-7.6, -1.1] as const,
  barraSotto: [1.5, 8.0] as const,
};
/** Distanza fra le corsie di scalette e meandri, mm (dipende dal filo: non scala). */
const CORSIA = 1.6;
const FERMO_ALTO = 2.4;
const FERMO_LARGO = 0.8;
const PASSATE_FERMO = 7;
const PASSATE_BARRA = 7;
const LARGO_BARRA = 0.8;
/** Vuoto fra due mattoncini nati da una divisione, mm. */
const VUOTO_MATTONCINO = 1;
/** Il record DST non va oltre 12,1 mm: nessun punto lo supera. */
const PUNTO_DST_MAX = 12;

export type RisultatoLinee = {
  /** Tratti continui di cucitura, nell'ordine; fra un tratto e il successivo c'è un salto. */
  blocchi: Punto[][];
  conteggi: { gruppi: number; linee: number; cordoncini: number; fermi: number; scalette: number; meandri: number; barre: number; punti: number };
};

// ---------------------------------------------------------------------------------------------------
// Il percorso: un solo filo che avanza.

class Percorso {
  readonly blocchi: Punto[][] = [];
  private cur: Punto[] | null = null;

  get ultimo(): Punto | null {
    return this.cur ? this.cur[this.cur.length - 1] : null;
  }

  salta(p: Punto): void {
    this.chiudi();
    this.cur = [p];
  }

  chiudi(): void {
    if (this.cur && this.cur.length > 1) this.blocchi.push(this.cur);
    this.cur = null;
  }

  /** Va a `p` con punti non più lunghi di `max` (0 = un punto solo, entro il limite del DST). */
  vai(p: Punto, max = 0): void {
    if (!this.cur) { this.cur = [p]; return; }
    const a = this.cur[this.cur.length - 1];
    const len = Math.hypot(p.x - a.x, p.y - a.y);
    if (len < 0.05) return;
    const lim = Math.min(max > 0 ? max : Infinity, PUNTO_DST_MAX);
    const n = Math.max(1, Math.ceil(len / lim - 1e-9));
    for (let i = 1; i <= n; i++) this.cur.push({ x: a.x + ((p.x - a.x) * i) / n, y: a.y + ((p.y - a.y) * i) / n });
  }

  /**
   * Il cordoncino: da p0 a p1 e ritorno. Con `torna` le passate sono pari e si finisce su p0,
   * altrimenti dispari e si finisce su p1.
   */
  cordoncino(p0: Punto, p1: Punto, passate: number, max: number, torna = false): void {
    let n = Math.max(1, Math.round(passate));
    if (torna) { if (n % 2) n = Math.max(2, n - 1); } else if (n % 2 === 0) n += 1;
    this.vai(p0, max);
    for (let i = 1; i <= n; i++) this.vai(i % 2 ? p1 : p0, max);
  }
}

// ---------------------------------------------------------------------------------------------------
// Geometria del pezzo.

/** Dove una retta orizzontale sta dentro il contorno: [x sinistra, x destra], o null. */
function estensioneX(contorno: Punto[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const p = contorno[i], q = contorno[(i + 1) % contorno.length];
    if ((p.y <= y && y < q.y) || (q.y <= y && y < p.y)) xs.push(p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y));
  }
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
}

/** Dove una retta verticale sta dentro il contorno: [y alto, y basso], o null. */
function estensioneY(contorno: Punto[], x: number): [number, number] | null {
  const ys: number[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const p = contorno[i], q = contorno[(i + 1) % contorno.length];
    if ((p.x <= x && x < q.x) || (q.x <= x && x < p.x)) ys.push(p.y + ((x - p.x) * (q.y - p.y)) / (q.x - p.x));
  }
  return ys.length >= 2 ? [Math.min(...ys), Math.max(...ys)] : null;
}

/** I confini di un tratto, divisi in più oggetti se il tratto è troppo lungo per restarne uno. */
function dividi(p0: number, p1: number, lunghezza: number, soglia: number): number[] {
  const len = p1 - p0;
  if (lunghezza <= 0 || len <= lunghezza * (1 + soglia)) return [p0, p1];
  const k = Math.max(2, Math.round(len / lunghezza));
  return Array.from({ length: k + 1 }, (_, i) => p0 + (len * i) / k);
}

type Pezzo = { x0: number; x1: number; finestra: boolean };
type Tipo = 'esterna' | 'interna';

/** I pezzi di una linea in un periodo (da vertice a vertice), in coordinate locali già scalate. */
function pezziPeriodo(tipo: Tipo, a: number, sx: number, par: ParametriLinee): Pezzo[] {
  const [w0, w1] = (tipo === 'esterna' ? MODULO.finestraEsterna : MODULO.finestraInterna).map((v) => v * sx);
  const giunti = (tipo === 'esterna' ? MODULO.giuntiEsterni : MODULO.giuntiInterni).map((v) => v * sx);
  const confini = [...new Set([-a, -w1, -w0, ...giunti.flatMap((g) => (g === 0 ? [0] : [-g, g])), w0, w1, a]
    .map((v) => Math.round(v * 1e6) / 1e6))].sort((p, q) => p - q);
  const out: Pezzo[] = [];
  for (let i = 1; i < confini.length; i++) {
    const x0 = confini[i - 1], x1 = confini[i];
    const finestra = (Math.abs(x0 + w1) < 1e-6 && Math.abs(x1 + w0) < 1e-6) || (Math.abs(x0 - w0) < 1e-6 && Math.abs(x1 - w1) < 1e-6);
    if (finestra) { out.push({ x0, x1, finestra }); continue; }
    const cuts = dividi(x0, x1, par.lunghezzaPezzo, par.sogliaOggetti);
    for (let k = 1; k < cuts.length; k++) out.push({ x0: cuts[k - 1], x1: cuts[k], finestra: false });
  }
  return out;
}

/** Un pezzo verticale pronto da cucire: il cordoncino parte da `y0` e va verso `y1`. */
type PezzoV = { x: number; y0: number; y1: number; torna: boolean };

/**
 * I pezzi di una scaletta o di un meandro, nell'ordine del modulo, tagliati sul contorno e divisi se
 * troppo lunghi. Ogni pezzo tiene il suo capo di partenza: se il taglio o la divisione lo spostano, si
 * parte comunque dal lato da cui il modulo parte.
 */
function pezziVerticali(
  xBase: number, voci: VoceVerticale[], aY: (d: number) => number,
  contorno: Punto[], par: ParametriLinee,
): PezzoV[] {
  const out: PezzoV[] = [];
  for (const v of voci) {
    const x = xBase + v.corsia * CORSIA;
    const ext = estensioneY(contorno, x);
    if (!ext) continue;
    const yDa = aY(v.da), yA = aY(v.a);
    const lo = Math.max(Math.min(yDa, yA), ext[0] + par.margineVerticale);
    const hi = Math.min(Math.max(yDa, yA), ext[1] - par.margineVerticale);
    if (hi - lo < 1) continue;
    const cuts = dividi(lo, hi, par.lunghezzaMattoncino, par.sogliaOggetti);
    const tratti: [number, number][] = [];
    for (let k = 1; k < cuts.length; k++) {
      const s = k > 1 ? VUOTO_MATTONCINO / 2 : 0, e = k < cuts.length - 1 ? VUOTO_MATTONCINO / 2 : 0;
      tratti.push([cuts[k - 1] + s, cuts[k] - e]);
    }
    const dalBasso = yDa > yA; // la y cresce verso il basso: si parte dal capo con la y più grande
    if (dalBasso) tratti.reverse();
    for (const [t0, t1] of tratti) out.push({ x, y0: dalBasso ? t1 : t0, y1: dalBasso ? t0 : t1, torna: v.torna });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Gli elementi cuciti.

/**
 * Cuce i pezzi verticali come nel DST: al primo pezzo si va dritti al capo di partenza; fra un pezzo e
 * l'altro si fa il passo di corsia all'altezza dove si è arrivati e si scorre sulla corsia nuova fino al
 * capo di partenza. Alla fine si passa per i punti di `uscita`.
 */
function cuciVerticali(perc: Percorso, pezzi: PezzoV[], par: ParametriLinee, uscita: Punto[]): void {
  pezzi.forEach((pz, n) => {
    const u = perc.ultimo!;
    if (n > 0 && Math.abs(u.x - pz.x) > 0.05) perc.vai({ x: pz.x, y: u.y }, par.puntoMaxCorsa);
    perc.vai({ x: pz.x, y: pz.y0 }, par.puntoMaxCorsa);
    perc.cordoncino({ x: pz.x, y: pz.y0 }, { x: pz.x, y: pz.y1 }, par.passateVerticali, 0, pz.torna);
  });
  for (const p of uscita) perc.vai(p, par.puntoMaxCorsa);
}

/**
 * Il fermo: una barretta a cavallo della linea, cucita andando verso sinistra. Come nel DST: QUATTRO
 * tratti verticali dritti (a 0,27 mm l'uno dall'altro, da destra a sinistra) legati da tre diagonali
 * che scendono — non sette tratti tutti obliqui, che era la prima versione. Si entra dal basso a destra
 * e si esce dall'alto a sinistra tornando giù sulla linea.
 */
function fermo(perc: Percorso, x: number, y: number): void {
  const h = FERMO_ALTO / 2, w = FERMO_LARGO / 2;
  const tratti = (PASSATE_FERMO + 1) / 2; // 7 passate = 4 salite + 3 discese
  perc.vai({ x: x + w, y: y + h });
  for (let k = 0; k < tratti; k++) {
    const xk = x + w - (FERMO_LARGO * k) / (tratti - 1);
    if (k > 0) perc.vai({ x: xk, y: y + h });
    perc.vai({ x: xk, y: y - h });
  }
  perc.vai({ x: x - w, y });
}

/** La barra al vertice: parte dal capo verso la diagonale, zig-zag fino all'altro, torna sulla linea. */
function barra(perc: Percorso, x: number, yLinea: number, riga: number, lo: number, hi: number): void {
  const vicino = Math.abs(lo - riga) < Math.abs(hi - riga) ? lo : hi;
  const lontano = vicino === lo ? hi : lo;
  const w = LARGO_BARRA / 2;
  perc.vai({ x: x + w, y: vicino });
  const passo = Math.abs(hi - lo) / 2 + 0.01; // due punti per passata, come nel riferimento
  for (let k = 1; k <= PASSATE_BARRA; k++) perc.vai({ x: x + w - (LARGO_BARRA * k) / PASSATE_BARRA, y: k % 2 ? lontano : vicino }, passo);
  perc.vai({ x: x - w, y: yLinea }, passo);
}

// ---------------------------------------------------------------------------------------------------

/**
 * Genera la fase 3 su un pezzo: il reticolo dei rombi del pattern 1 e il contorno del pezzo (anello
 * chiuso, mm). Tutto il reticolo, senza togliere niente: le parti tolte per il montaggio si decidono dopo.
 */
export function generaLinee(ret: Reticolo, contorno: Punto[], par: ParametriLinee = PARAMETRI_DAVANTI): RisultatoLinee {
  if (!(ret.a > 0 && ret.b > 0)) throw new Error('Reticolo non valido: le mezze diagonali devono essere positive.');
  if (contorno.length < 3) throw new Error('Serve il contorno del pezzo (almeno tre punti).');
  const sx = ret.a / ROMBO_RIFERIMENTO.a, sy = ret.b / ROMBO_RIFERIMENTO.b;
  const P = 2 * ret.a;
  const conteggi = { gruppi: 0, linee: 0, cordoncini: 0, fermi: 0, scalette: 0, meandri: 0, barre: 0, punti: 0 };
  const perc = new Percorso();

  let ymin = Infinity, ymax = -Infinity;
  for (const p of contorno) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }

  if (par.termogarze) {
    perc.salta(contorno[0]);
    for (const p of [...contorno.slice(1), contorno[0]]) perc.vai(p, par.puntoTermogarze);
    perc.chiudi();
  }

  const eVertice = (x: number) => {
    const l = (((x - ret.cx) % P) + P) % P;
    return Math.abs(l - ret.a) < 0.05;
  };
  const posizioni = (xs0: number, xs1: number, offsets: number[]) => {
    const out: number[] = [];
    const k0 = Math.floor((xs0 - ret.cx) / P) - 1, k1 = Math.ceil((xs1 - ret.cx) / P) + 1;
    for (let k = k0; k <= k1; k++) for (const o of offsets) {
      const x = ret.cx + k * P + o;
      if (x > xs0 + 0.5 && x < xs1 - 0.5) out.push(x);
    }
    return out.sort((p, q) => p - q);
  };
  const xVert = MODULO.xVerticali * sx;

  const e = MODULO.rigaEsterna * sy, i = MODULO.rigaInterna * sy;
  const j0 = Math.floor((ymin - e - ret.cy) / (2 * ret.b)), j1 = Math.ceil((ymax + e - ret.cy) / (2 * ret.b));
  for (let j = j0; j <= j1; j++) {
    const riga = ret.cy + 2 * j * ret.b;
    const linee: { y: number; tipo: Tipo; segno: -1 | 1; nome: 'A' | 'B' | 'C' | 'D' }[] = [
      { y: riga - e, tipo: 'esterna', segno: -1, nome: 'A' },
      { y: riga - i, tipo: 'interna', segno: -1, nome: 'B' },
      { y: riga + e, tipo: 'esterna', segno: 1, nome: 'D' },
      { y: riga + i, tipo: 'interna', segno: 1, nome: 'C' },
    ];
    let cucite = 0;
    for (const L of linee) {
      const ext = estensioneX(contorno, L.y);
      if (!ext) continue;
      const xStart = ext[0] - par.sporgenzaSinistra;
      const limite = ext[1] - par.rientroDestro;
      const base = pezziPeriodo(L.tipo, ret.a, sx, par);
      const pezzi: Pezzo[] = [];
      const k0 = Math.floor((xStart - ret.cx) / P) - 1, k1 = Math.ceil((limite - ret.cx) / P) + 1;
      for (let k = k0; k <= k1; k++) {
        const xc = ret.cx + k * P;
        for (const p of base) {
          const x0 = xc + p.x0, x1 = xc + p.x1;
          if (x1 <= xStart + 1e-6 || x1 > limite + 1e-6) continue;
          pezzi.push({ x0: Math.max(x0, xStart), x1, finestra: p.finestra });
        }
      }
      const pz = pezzi.filter((p) => p.x1 - p.x0 > 0.05);
      if (!pz.length) continue;
      const xEnd = pz[pz.length - 1].x1;

      // ---- passaggio sul bordo sinistro dalla linea di prima a questa
      const u = perc.ultimo;
      if (u) {
        const bordo = Math.min(u.x, xStart);
        perc.vai({ x: bordo, y: u.y }, par.puntoMaxCorsa);
        perc.vai({ x: bordo, y: L.y }, par.puntoPassaggioBordo);
        perc.vai({ x: xStart, y: L.y }, par.puntoMaxCorsa);
      } else {
        perc.salta({ x: xStart, y: L.y });
      }

      // ---- ANDATA: cordoncini; sulle esterne le scalette verso fuori
      const scalette = L.tipo === 'esterna' ? posizioni(xStart, xEnd, [-xVert, xVert]) : [];
      const yBase = riga + L.segno * MODULO.baseScaletta * sy;
      for (const p of pz) {
        if (p.finestra) { perc.vai({ x: p.x1, y: L.y }, par.puntoMaxCorsa); continue; }
        for (const xs of scalette.filter((x) => x >= p.x0 - 1e-6 && x < p.x1 - 1e-6)) {
          const pezziV = pezziVerticali(xs, MODULO.scaletta, (d) => riga + L.segno * (MODULO.baseScaletta + d) * sy, contorno, par);
          if (!pezziV.length) continue;
          cuciVerticali(perc, pezziV, par, [{ x: pezziV[pezziV.length - 1].x, y: yBase }]);
          conteggi.scalette++;
        }
        perc.cordoncino({ x: p.x0, y: L.y }, { x: p.x1, y: L.y }, par.passateCordoncino, par.puntoMaxCordoncino);
        conteggi.cordoncini++;
      }

      // ---- RITORNO: fermi sui giunti; sulle interne le barre ai vertici; sulla C i meandri
      const eventi: { x: number; fai: () => void }[] = [];
      const meandri = L.nome === 'C' ? posizioni(xStart, xEnd, [-xVert, xVert]) : [];
      const vicinoAMeandro = (x: number) => L.tipo === 'interna' && posizioni(xStart - P, xEnd + P, [-xVert, xVert]).some((m) => Math.abs(m - x) < 1);
      for (let k = 1; k < pz.length; k++) {
        const x = pz[k].x0;
        if (eVertice(x) || vicinoAMeandro(x) || x <= xStart + 0.3) continue;
        eventi.push({ x, fai: () => { fermo(perc, x, L.y); conteggi.fermi++; } });
      }
      if (L.tipo === 'interna') {
        const [b0, b1] = L.nome === 'B' ? MODULO.barraSopra : MODULO.barraSotto;
        for (const xv of posizioni(xStart, xEnd, [ret.a])) {
          const ext2 = estensioneY(contorno, xv);
          if (!ext2) continue;
          const lo = Math.max(riga + b0 * sy, ext2[0] + par.margineVerticale);
          const hi = Math.min(riga + b1 * sy, ext2[1] - par.margineVerticale);
          if (hi - lo < 1) continue;
          eventi.push({ x: xv, fai: () => { barra(perc, xv, L.y, riga, lo, hi); conteggi.barre++; } });
        }
      }
      for (const xm of meandri) {
        eventi.push({
          x: xm,
          fai: () => {
            const pezziV = pezziVerticali(xm, MODULO.meandro, (d) => riga + d * sy, contorno, par);
            if (!pezziV.length) return;
            cuciVerticali(perc, pezziV, par, [{ x: xm, y: riga + MODULO.uscitaMeandro * sy }, { x: xm, y: L.y }]);
            conteggi.meandri++;
          },
        });
      }
      eventi.sort((p, q) => q.x - p.x);
      for (const ev of eventi) { perc.vai({ x: ev.x, y: L.y }, par.puntoMaxCorsa); ev.fai(); }
      perc.vai({ x: xStart, y: L.y }, par.puntoMaxCorsa);
      conteggi.linee++;
      cucite++;
    }
    if (cucite) conteggi.gruppi++;
  }
  perc.chiudi();
  conteggi.punti = perc.blocchi.reduce((s, b) => s + b.length - 1, 0);
  return { blocchi: perc.blocchi, conteggi };
}

/** Il programma DST della fase: un ago, un tratto per blocco (fra i blocchi un salto). */
export function programmaLinee(ris: RisultatoLinee, label = 'CANNAGE FASE3', metadata?: Record<string, unknown>): DstProgram {
  return {
    label,
    coordinate_system: 'svg',
    paths: ris.blocchi.map((b) => ({ needle: 1, points_mm: b.map((p): [number, number] => [p.x, p.y]) })),
    metadata,
  };
}

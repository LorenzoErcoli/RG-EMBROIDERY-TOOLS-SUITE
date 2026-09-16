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
// divide in più pezzi — con un fermo in più su ogni giunto nuovo. Barre e distanza fra le corsie
// dipendono dal filo, non dal rombo: restano fisse. I FERMI invece su un rombo più piccolo del riferimento
// rimpiccioliscono con lui (Lorenzo, 16/09): grandi uguali, sull'M3641 (rombo 42 mm) non lasciavano posto
// agli uncini della cornice vicino al vertice. Sui rombi più grandi restano quelli del DST.
import type { DstProgram } from '@rg/core';
import { sagomaDaAnello, type Sagoma } from './sagoma';
import { camminoSulBordo } from './stop';

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
  /**
   * Di quanto la linea finisce fuori dal bordo destro, mm: come a sinistra, e l'ultimo pezzo si taglia
   * lì. Nei DST M1404 la linea si chiudeva sull'ultimo giunto dentro, fino a 10 mm prima del bordo;
   * Lorenzo la vuole fino in fondo (15/09).
   */
  sporgenzaDestra: number;
  /** Distanza minima dal bordo del pezzo, in alto e in basso, per scalette, meandri e barre, mm. */
  margineVerticale: number;
  /** Punto dei passaggi sul bordo sinistro, mm. */
  puntoPassaggioBordo: number;
  /**
   * Quante passate fare dentro le AREE DI SCARICO invece di quelle qui sopra (Lorenzo, 16/09): vale per i
   * cordoncini, per scalette e meandri e anche per gli ZIG-ZAG, cioè fermi e barre («si deve scaricare
   * anche lo zig zag delle linee», 16/09). 0 = non scaricare niente.
   */
  passateScarico: number;
  /** Il contorno ripassato a inizio fase, per le termogarze: può esserci o no. */
  termogarze: boolean;
  /** Punto del contorno per le termogarze, mm. */
  puntoTermogarze: number;
  /**
   * Di quanto si allarga per parte la FINESTRA dove la linea attraversa il lato del rombo, mm sul rombo di
   * riferimento: i due fermi si allontanano e gli uncini della cornice ci stanno in mezzo invece di
   * passarci sopra (Lorenzo, 16/09). 0 = le finestre del DST M1404.
   */
  allargamentoFinestre: number;
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
  sporgenzaDestra: 1,
  margineVerticale: 3,
  puntoPassaggioBordo: 2.5,
  termogarze: false,
  puntoTermogarze: 4,
  allargamentoFinestre: 1,
  passateScarico: 5,
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
  /**
   * Le barre ai vertici: il capo verso la diagonale (verso la barra dall'altra parte) è quello del DST.
   * Il capo verso fuori NON ha una misura propria: arriva pari ai fermi della linea esterna (vedi generaLinee).
   */
  barraVersoDiagonale: { sopra: -1.1, sotto: 1.5 },
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

export type Ingombro = { tipo: 'fermo' | 'barra'; x0: number; y0: number; x1: number; y1: number };

export type RisultatoLinee = {
  /** Tratti continui di cucitura, nell'ordine; fra un tratto e il successivo c'è un salto. */
  blocchi: Punto[][];
  /**
   * Dove stanno fermi e barre, come rettangoli (mm): la cornice, cucita dopo, non ci deve passare
   * sopra (Lorenzo, 16/09: «altrimenti sbatte contro»).
   */
  ingombri: Ingombro[];
  conteggi: { gruppi: number; linee: number; cordoncini: number; fermi: number; scalette: number; meandri: number; barre: number; punti: number };
};

// ---------------------------------------------------------------------------------------------------
// Il percorso: un solo filo che avanza (lo usa anche la cornice).

export class Percorso {
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

/** Fra i tratti di una retta dentro il pezzo, quello che contiene una quota (o null). */
function tratto(tratti: [number, number][], q: number): [number, number] | null {
  for (const t of tratti) if (q >= t[0] - 1e-6 && q <= t[1] + 1e-6) return t;
  return null;
}

/** Fra i tratti, quello che copre di più l'intervallo dato (o null se non ne copre nessuno). */
function copreDiPiu(tratti: [number, number][], q0: number, q1: number): [number, number] | null {
  let best: [number, number] | null = null, meglio = 0;
  for (const t of tratti) {
    const q = Math.min(t[1], q1) - Math.max(t[0], q0);
    if (q > meglio) { meglio = q; best = t; }
  }
  return best;
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
  const [f0, f1] = tipo === 'esterna' ? MODULO.finestraEsterna : MODULO.finestraInterna;
  const allarga = Math.max(0, par.allargamentoFinestre ?? 0);
  const w0 = (f0 - allarga) * sx, w1 = (f1 + allarga) * sx;
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
  sagoma: Sagoma, par: ParametriLinee, rifY: number,
): PezzoV[] {
  const out: PezzoV[] = [];
  for (const v of voci) {
    const x = xBase + v.corsia * CORSIA;
    const yDa = aY(v.da), yA = aY(v.a);
    // il tratto di pezzo dove sta la linea: se il pezzo è tagliato, gli altri non c'entrano. Se la riga
    // stessa è fuori (blocco orfano, vedi generaLinee) vale il tratto che copre di più il blocco.
    const ext = tratto(sagoma.estensioniY(x), rifY) ?? copreDiPiu(sagoma.estensioniY(x), Math.min(yDa, yA), Math.max(yDa, yA));
    if (!ext) continue;
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
function cuciVerticali(perc: Percorso, pezzi: PezzoV[], par: ParametriLinee, uscita: Punto[], passate: (x: number, y: number) => number): void {
  pezzi.forEach((pz, n) => {
    const u = perc.ultimo!;
    if (n > 0 && Math.abs(u.x - pz.x) > 0.05) perc.vai({ x: pz.x, y: u.y }, par.puntoMaxCorsa);
    perc.vai({ x: pz.x, y: pz.y0 }, par.puntoMaxCorsa);
    perc.cordoncino({ x: pz.x, y: pz.y0 }, { x: pz.x, y: pz.y1 }, passate(pz.x, (pz.y0 + pz.y1) / 2), 0, pz.torna);
  });
  for (const p of uscita) perc.vai(p, par.puntoMaxCorsa);
}

/**
 * Il fermo: una barretta a cavallo della linea, cucita andando verso sinistra. Come nel DST: QUATTRO
 * tratti verticali dritti (a 0,27 mm l'uno dall'altro, da destra a sinistra) legati da tre diagonali
 * che scendono — non sette tratti tutti obliqui, che era la prima versione. Si entra dal basso a destra
 * e si esce dall'alto a sinistra tornando giù sulla linea.
 */
function fermo(perc: Percorso, x: number, y: number, alto = FERMO_ALTO, largo = FERMO_LARGO, passate = PASSATE_FERMO): void {
  const h = alto / 2, w = largo / 2;
  const tratti = Math.max(2, Math.round((passate + 1) / 2)); // 7 passate = 4 salite + 3 discese
  perc.vai({ x: x + w, y: y + h });
  for (let k = 0; k < tratti; k++) {
    const xk = x + w - (largo * k) / (tratti - 1);
    if (k > 0) perc.vai({ x: xk, y: y + h });
    perc.vai({ x: xk, y: y - h });
  }
  perc.vai({ x: x - w, y });
}

/** La barra al vertice: parte dal capo verso la diagonale, zig-zag fino all'altro, torna sulla linea. */
function barra(perc: Percorso, x: number, yLinea: number, riga: number, lo: number, hi: number, passate = PASSATE_BARRA): void {
  const vicino = Math.abs(lo - riga) < Math.abs(hi - riga) ? lo : hi;
  const lontano = vicino === lo ? hi : lo;
  const w = LARGO_BARRA / 2;
  const n = Math.max(2, Math.round(passate));
  perc.vai({ x: x + w, y: vicino });
  const passo = Math.abs(hi - lo) / 2 + 0.01; // due punti per passata, come nel riferimento
  for (let k = 1; k <= n; k++) perc.vai({ x: x + w - (LARGO_BARRA * k) / n, y: k % 2 ? lontano : vicino }, passo);
  perc.vai({ x: x - w, y: yLinea }, passo);
}

// ---------------------------------------------------------------------------------------------------

/**
 * Genera la fase 3 su un pezzo: il reticolo dei rombi del pattern 1 e il contorno del pezzo (anello
 * chiuso, mm). Tutto il reticolo, senza togliere niente: le parti tolte per il montaggio si decidono dopo.
 */
export function generaLinee(
  ret: Reticolo, pezzo: Punto[] | Sagoma, par: ParametriLinee = PARAMETRI_DAVANTI,
  scarico: Punto[][] = [], contornoTermogarze: Punto[][] = [],
): RisultatoLinee {
  if (!(ret.a > 0 && ret.b > 0)) throw new Error('Reticolo non valido: le mezze diagonali devono essere positive.');
  if (Array.isArray(pezzo) && pezzo.length < 3) throw new Error('Serve il contorno del pezzo (almeno tre punti).');
  const sagoma = Array.isArray(pezzo) ? sagomaDaAnello(pezzo) : pezzo;
  const sx = ret.a / ROMBO_RIFERIMENTO.a, sy = ret.b / ROMBO_RIFERIMENTO.b;
  // i fermi rimpiccioliscono coi rombi più piccoli del riferimento, non crescono con quelli più grandi
  const fermoAlto = FERMO_ALTO * Math.min(1, sy), fermoLargo = FERMO_LARGO * Math.min(1, sx);
  const P = 2 * ret.a;
  const conteggi = { gruppi: 0, linee: 0, cordoncini: 0, fermi: 0, scalette: 0, meandri: 0, barre: 0, punti: 0 };
  const ingombri: Ingombro[] = [];
  const perc = new Percorso();
  // le aree di scarico: dentro i loro contorni cordoncini, scalette e meandri hanno meno passate
  const alleggerisci = par.passateScarico > 0 && scarico.length > 0;
  const nelloScarico = (x: number, y: number) => {
    if (!alleggerisci) return false;
    for (const area of scarico) {
      let dentro = false;
      for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
        const a = area[i], b = area[j];
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
      }
      if (dentro) return true;
    }
    return false;
  };
  const passate = (base: number, x: number, y: number) => (nelloScarico(x, y) ? par.passateScarico : base);

  const ymin = sagoma.ingombro.y0, ymax = sagoma.ingombro.y1;

  if (par.termogarze) {
    const g = sagoma.ingombro;
    // il contorno delle termogarze: la linea scelta nel disegno, se no il bordo del pezzo
    const anelli = contornoTermogarze.length ? contornoTermogarze
      : sagoma.anelli.length ? sagoma.anelli
      : [[{ x: g.x0, y: g.y0 }, { x: g.x1, y: g.y0 }, { x: g.x1, y: g.y1 }, { x: g.x0, y: g.y1 }]];
    anelli.forEach((contorno, n) => {
      perc.salta(contorno[0]);
      for (const p of [...contorno.slice(1), contorno[0]]) perc.vai(p, par.puntoTermogarze);
      // dall'ultimo contorno il filo non si stacca: la prima linea ci arriva camminando sul bordo
      if (n < anelli.length - 1) perc.chiudi();
    });
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
  let precedente: { xa: number; xb: number } | null = null;
  const j0 = Math.floor((ymin - e - ret.cy) / (2 * ret.b)), j1 = Math.ceil((ymax + e - ret.cy) / (2 * ret.b));
  for (let j = j0; j <= j1; j++) {
    const riga = ret.cy + 2 * j * ret.b;
    const linee: { y: number; tipo: Tipo; segno: -1 | 1; nome: 'A' | 'B' | 'C' | 'D'; idx: number }[] = ([
      { y: riga - e, tipo: 'esterna', segno: -1, nome: 'A' },
      { y: riga - i, tipo: 'interna', segno: -1, nome: 'B' },
      { y: riga + e, tipo: 'esterna', segno: 1, nome: 'D' },
      { y: riga + i, tipo: 'interna', segno: 1, nome: 'C' },
    ] as { y: number; tipo: Tipo; segno: -1 | 1; nome: 'A' | 'B' | 'C' | 'D' }[]).map((L, idx) => ({ ...L, idx }));

    // I BLOCCHI VERTICALI ORFANI (Lorenzo, 16/09: «in basso e in alto mi togli anche i blocchi verticali,
    // perché si sviluppano dalla riga che non c'è più»). Scalette e meandri nascono da una linea: se il
    // bordo taglia via quella linea ma il blocco starebbe dentro il pezzo, lo cuce un'altra linea della
    // stessa riga — quella che a quella x c'è e passa più vicino.
    const copre = (y: number, x: number) => sagoma.estensioniX(y).some(([a, b]) => x > a + 0.5 && x < b - 0.5);
    const orfani: { x: number; voci: VoceVerticale[]; aY: (d: number) => number; scaletta: boolean; linea: number }[] = [];
    for (const L of linee) {
      const suoi = L.tipo === 'esterna'
        ? { voci: MODULO.scaletta, aY: (d: number) => riga + L.segno * (MODULO.baseScaletta + d) * sy, scaletta: true }
        : L.nome === 'C' ? { voci: MODULO.meandro, aY: (d: number) => riga + d * sy, scaletta: false } : null;
      if (!suoi) continue;
      for (const x of posizioni(sagoma.ingombro.x0 - 1, sagoma.ingombro.x1 + 1, [-xVert, xVert])) {
        if (copre(L.y, x)) continue; // la sua linea c'è: ci pensa lei
        if (!pezziVerticali(x, suoi.voci, suoi.aY, sagoma, par, riga).length) continue; // e non ci starebbe
        let linea = -1, vicino = Infinity;
        for (const M of linee) { if (!copre(M.y, x)) continue; const d = Math.abs(M.y - L.y); if (d < vicino) { vicino = d; linea = M.idx; } }
        if (linea >= 0) orfani.push({ x, voci: suoi.voci, aY: suoi.aY, scaletta: suoi.scaletta, linea });
      }
    }
    let cucite = 0;
    // Il pezzo può essere tagliato — il davanti dell'M3641 ha il bordo alto curvo e un incavo in basso —
    // e allora su una riga ci sono più tratti: la linea si ferma dove finisce il cannage (Lorenzo, 16/09:
    // «se il rombo non è completo anche le linee non lo devono essere») e fra un tratto e l'altro il filo
    // si stacca invece di attraversare il vuoto.
    const tratti = linee.flatMap((L) => sagoma.estensioniX(L.y).map(([xa, xb]) => ({ ...L, xa, xb })));
    for (const L of tratti) {
      const xStart = L.xa - par.sporgenzaSinistra;
      const limite = L.xb + par.sporgenzaDestra;
      // il passaggio da una linea all'altra cammina sul bordo sinistro: va bene finché i due tratti si
      // sovrappongono. Se no attraverserebbe il vuoto (l'incavo del davanti): prima il filo si staccava,
      // con salti fino a 360 mm; ora cammina sul BORDO del pezzo, a impunture (Lorenzo, 16/09)
      const ultimo = perc.ultimo;
      if (precedente && ultimo && (L.xb < precedente.xa || L.xa > precedente.xb) && sagoma.anelli.length) {
        for (const p of camminoSulBordo(sagoma.anelli[0], ultimo, { x: xStart, y: L.y })) perc.vai(p, par.puntoPassaggioBordo);
      }
      precedente = { xa: L.xa, xb: L.xb };
      const base = pezziPeriodo(L.tipo, ret.a, sx, par);
      const pezzi: Pezzo[] = [];
      const k0 = Math.floor((xStart - ret.cx) / P) - 1, k1 = Math.ceil((limite - ret.cx) / P) + 1;
      for (let k = k0; k <= k1; k++) {
        const xc = ret.cx + k * P;
        for (const p of base) {
          const x0 = xc + p.x0, x1 = xc + p.x1;
          // i pezzi si tagliano ai due capi: la linea va da un bordo all'altro, fuori di poco da tutte e due le parti
          if (x1 <= xStart + 1e-6 || x0 >= limite - 1e-6) continue;
          pezzi.push({ x0: Math.max(x0, xStart), x1: Math.min(x1, limite), finestra: p.finestra });
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
          const pezziV = pezziVerticali(xs, MODULO.scaletta, (d) => riga + L.segno * (MODULO.baseScaletta + d) * sy, sagoma, par, riga);
          if (!pezziV.length) continue;
          cuciVerticali(perc, pezziV, par, [{ x: pezziV[pezziV.length - 1].x, y: yBase }], (x, y) => passate(par.passateVerticali, x, y));
          conteggi.scalette++;
        }
        perc.cordoncino({ x: p.x0, y: L.y }, { x: p.x1, y: L.y }, passate(par.passateCordoncino, (p.x0 + p.x1) / 2, L.y), par.puntoMaxCordoncino);
        conteggi.cordoncini++;
      }

      // ---- RITORNO: fermi sui giunti; sulle interne le barre ai vertici; sulla C i meandri
      const eventi: { x: number; fai: () => void }[] = [];
      const meandri = L.nome === 'C' ? posizioni(xStart, xEnd, [-xVert, xVert]) : [];
      const vicinoAMeandro = (x: number) => L.tipo === 'interna' && posizioni(xStart - P, xEnd + P, [-xVert, xVert]).some((m) => Math.abs(m - x) < 1);
      for (let k = 1; k < pz.length; k++) {
        const x = pz[k].x0;
        if (eVertice(x) || vicinoAMeandro(x) || x <= xStart + 0.3) continue;
        eventi.push({ x, fai: () => {
          fermo(perc, x, L.y, fermoAlto, fermoLargo, passate(PASSATE_FERMO, x, L.y));
          conteggi.fermi++;
          ingombri.push({ tipo: 'fermo', x0: x - fermoLargo / 2, y0: L.y - fermoAlto / 2, x1: x + fermoLargo / 2, y1: L.y + fermoAlto / 2 });
        } });
      }
      if (L.tipo === 'interna') {
        // La barra al vertice arriva IN TESTA pari ai fermi della linea esterna (Lorenzo, 15/09): nel DST
        // M1404 si fermava 0,3 mm prima (−7,6 invece di −7,9). Il capo verso la diagonale — verso la
        // barra dall'altra parte — resta invece quello del DST: accorciarlo era sbagliato, lo ha visto
        // Lorenzo. La testa si ricava dalla linea esterna, così resta pari anche se il rombo cambia.
        const hf = fermoAlto / 2;
        const [b0, b1] = L.nome === 'B'
          ? [riga - e - hf, riga + MODULO.barraVersoDiagonale.sopra * sy]
          : [riga + MODULO.barraVersoDiagonale.sotto * sy, riga + e + hf];
        for (const xv of posizioni(xStart, xEnd, [ret.a])) {
          const ext2 = tratto(sagoma.estensioniY(xv), riga);
          if (!ext2) continue;
          const lo = Math.max(b0, ext2[0] + par.margineVerticale);
          const hi = Math.min(b1, ext2[1] - par.margineVerticale);
          if (hi - lo < 1) continue;
          eventi.push({ x: xv, fai: () => {
            barra(perc, xv, L.y, riga, lo, hi, passate(PASSATE_BARRA, xv, (lo + hi) / 2));
            conteggi.barre++;
            ingombri.push({ tipo: 'barra', x0: xv - LARGO_BARRA / 2, y0: lo, x1: xv + LARGO_BARRA / 2, y1: hi });
          } });
        }
      }
      for (const o of orfani.filter((o) => o.linea === L.idx && o.x > xStart + 0.5 && o.x < limite - 0.5)) {
        eventi.push({ x: o.x, fai: () => {
          const pezziV = pezziVerticali(o.x, o.voci, o.aY, sagoma, par, riga);
          if (!pezziV.length) return;
          cuciVerticali(perc, pezziV, par, [{ x: o.x, y: L.y }], (x, y) => passate(par.passateVerticali, x, y));
          if (o.scaletta) conteggi.scalette++; else conteggi.meandri++;
        } });
      }
      for (const xm of meandri) {
        eventi.push({
          x: xm,
          fai: () => {
            const pezziV = pezziVerticali(xm, MODULO.meandro, (d) => riga + d * sy, sagoma, par, riga);
            if (!pezziV.length) return;
            cuciVerticali(perc, pezziV, par, [{ x: xm, y: riga + MODULO.uscitaMeandro * sy }, { x: xm, y: L.y }], (x, y) => passate(par.passateVerticali, x, y));
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
  return { blocchi: perc.blocchi, ingombri, conteggi };
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

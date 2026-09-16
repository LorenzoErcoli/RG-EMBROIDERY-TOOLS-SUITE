// Cannage rafia — la BORDATURA (Lorenzo, 16/09): un orlo ricamato sui lati scelti del pezzo.
//
// Letta dal DST M1424 ORLATURA E MEDAGLIONE (stop 1 = la linea di riferimento, stop 2-5 = la bordatura
// doppia da 4 mm) e misurata punto per punto rispetto alla linea, lungo (s) e verso dentro (d):
//   7. RASO OBLIQUO a densità bassa: un punto ogni 1 mm per lato, inclinato di 45°; non arriva al bordo
//      esterno (resta 0,5 mm sotto il raso dritto), dentro arriva pari.
//   8. RITORNO A RASO DRITTO, fitto (0,7 mm per lato), per tutta l'altezza: sborda di quei decimi sopra
//      l'obliquo.
//   9. CORDONCINO A LISCIO sul bordo superiore: alto 1,2 mm nel DST (0,5 mm per lato), a filo del raso
//      dritto.
//  10. LE LINEE ORIZZONTALI, come le cannette: cordoncino a pezzi uguali (11 passate) all'andata, fermi
//      a zig-zag sui giunti al ritorno. Nella doppia due linee a 2 mm, coi fermi sfasati di mezzo passo.
// Singolo passaggio = 2 mm e una linea; doppio = 4 mm e due linee. Tutto il resto uguale. Si sceglie LINEA
// PER LINEA (Lorenzo, 16/09: «nello stesso programma potrei avere alcune bordature doppie, altre singole»):
// tutte stanno negli stessi quattro stop, cambia solo quanto è alta la fascia e quante linee ha.
//
// La bordatura esce dalla linea disegnata di 0,5 mm (Lorenzo, 16/09: la linea è sempre il lato esterno) e
// si sviluppa verso dentro il pezzo. Si costruisce in coordinate (s, d) e si piega sulla linea: vale per i
// bordi dritti e per quelli curvi.
import { Percorso, type Punto } from './linee';
import type { Sagoma } from './sagoma';

export type ParametriBordatura = {
  /** Di quanto la bordatura esce oltre la linea disegnata, verso fuori, mm. */
  uscita: number;
  /** Di quanto la bordatura va oltre i capi di una linea aperta, mm. */
  sporgenzaEstremi: number;
  /** Raso obliquo: distanza fra due punti sullo stesso lato, mm. */
  passoObliquo: number;
  /** Raso obliquo: inclinazione rispetto al bordo, gradi. */
  angoloObliquo: number;
  /** Di quanto il raso dritto sborda oltre l'obliquo verso fuori, mm. */
  sbordoDritto: number;
  /** Raso dritto: distanza fra due punti sullo stesso lato, mm. */
  passoDritto: number;
  /** Altezza del cordoncino sul bordo esterno, mm. */
  altezzaCordoncino: number;
  /** Cordoncino: distanza fra due punti sullo stesso lato, mm. */
  passoCordoncino: number;
  /** Distanza della prima linea dal bordo esterno della bordatura, mm. */
  primaLinea: number;
  /** Distanza fra le due linee del doppio passaggio, mm. */
  distanzaLinee: number;
  /** Passo dei fermi, mm; 0 = il pezzo di cordoncino più lungo delle linee orizzontali (stop 5). */
  passoFermi: number;
  /** Passate di ogni pezzo di cordoncino delle linee (dispari). */
  passateLinea: number;
  /** Altezza dei fermi a zig-zag, mm. */
  altezzaFermo: number;
};

/** I valori del DST M1424 (doppio), con l'uscita di 0,5 mm chiesta da Lorenzo. */
export const PARAMETRI_BORDATURA: ParametriBordatura = {
  uscita: 0.5,
  sporgenzaEstremi: 1.5,
  passoObliquo: 1,
  angoloObliquo: 45,
  sbordoDritto: 0.5,
  passoDritto: 0.7,
  altezzaCordoncino: 1.2,
  passoCordoncino: 0.5,
  primaLinea: 1.4,
  distanzaLinee: 2,
  passoFermi: 0,
  passateLinea: 11,
  altezzaFermo: 2.3,
};

/** Il passo dei fermi quando non c'è uno stop 5 da cui prenderlo: quello del DST M1424. */
export const PASSO_FERMI_M1424 = 9.5;

/** Larghezza del fermo lungo il bordo e numero dei suoi tratti, come nel DST (e come i fermi delle linee). */
const LARGO_FERMO = 0.9;
const TRATTI_FERMO = 4;
/** Su quanti mm per parte si guarda la direzione della linea: le curve restano lisce, i gradini no. */
const FINESTRA_TANGENTE = 2;

/** Doppia = 4 mm e due linee, singola = 2 mm e una linea. */
export type Passaggio = 'doppia' | 'singola';

/** Una linea da bordare: il lato esterno, aperto o chiuso, col suo passaggio. */
export type LineaBordo = { punti: Punto[]; chiusa: boolean; passaggio: Passaggio };

export type RisultatoBordatura = {
  /** I quattro stop, ognuno coi suoi tratti: raso obliquo, raso dritto, cordoncino, linee. */
  obliquo: Punto[][];
  dritto: Punto[][];
  cordoncino: Punto[][];
  linee: Punto[][];
  conteggi: { linee: number; lunghezza: number; passoFermi: number; fermi: number };
};

/** La linea percorsa per lunghezza: il punto a distanza `s` dall'inizio e spostato di `d` verso dentro. */
class Guida {
  readonly punti: Punto[];
  readonly cum: number[] = [0];
  readonly L: number;
  verso = 1;

  constructor(readonly linea: { punti: Punto[]; chiusa: boolean }) {
    const p: Punto[] = [];
    for (const q of linea.punti) {
      const u = p[p.length - 1];
      if (!u || Math.hypot(q.x - u.x, q.y - u.y) > 0.01) p.push({ x: q.x, y: q.y });
    }
    if (linea.chiusa && p.length > 2 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) <= 0.01) p.pop();
    if (linea.chiusa && p.length > 2) p.push({ ...p[0] });
    this.punti = p;
    for (let i = 1; i < p.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
    this.L = this.cum[this.cum.length - 1] ?? 0;
  }

  get chiusa(): boolean { return this.linea.chiusa; }

  /** Il punto sulla linea; una linea aperta oltre i capi prosegue dritta. */
  sulla(s: number): Punto {
    const P = this.punti, n = P.length;
    if (this.chiusa) s = ((s % this.L) + this.L) % this.L;
    else if (s < 0 || s > this.L) {
      const [a, b] = s < 0 ? [P[1], P[0]] : [P[n - 2], P[n - 1]];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1, oltre = s < 0 ? -s : s - this.L;
      return { x: b.x + ((b.x - a.x) / l) * oltre, y: b.y + ((b.y - a.y) / l) * oltre };
    }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const t = (s - this.cum[lo]) / ((this.cum[hi] - this.cum[lo]) || 1);
    return { x: P[lo].x + (P[hi].x - P[lo].x) * t, y: P[lo].y + (P[hi].y - P[lo].y) * t };
  }

  punto(s: number, d: number): Punto {
    const a = this.sulla(s - FINESTRA_TANGENTE), b = this.sulla(s + FINESTRA_TANGENTE), c = this.sulla(s);
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / l) * this.verso, ny = ((b.x - a.x) / l) * this.verso;
    return { x: c.x + nx * d, y: c.y + ny * d };
  }
}

/** Da che parte è il dentro: si guarda di qua e di là dalla linea in venti punti e vince la maggioranza. */
function versoDentro(g: Guida, sagoma?: Sagoma): number {
  if (!sagoma) return 1;
  g.verso = 1;
  let voti = 0;
  for (let k = 1; k < 20; k++) {
    const s = (g.L * k) / 20;
    voti += Math.sign(sagoma.distanza(g.punto(s, 1.5)) - sagoma.distanza(g.punto(s, -1.5)));
  }
  return voti >= 0 ? 1 : -1;
}

/**
 * La bordatura sulle linee date. `sagoma` dice da che parte è il pezzo (senza, il dentro è a destra di chi
 * percorre la linea con la y verso il basso); `passoFermiStop5` è il passo di partenza dei fermi.
 */
export function generaBordatura(
  linee: LineaBordo[], par: ParametriBordatura = PARAMETRI_BORDATURA,
  sagoma?: Sagoma, passoFermiStop5 = PASSO_FERMI_M1424,
): RisultatoBordatura {
  const out: RisultatoBordatura = { obliquo: [], dritto: [], cordoncino: [], linee: [], conteggi: { linee: 0, lunghezza: 0, passoFermi: 0, fermi: 0 } };
  const dO = -Math.max(0, par.uscita);
  const passoFermi = par.passoFermi > 0 ? par.passoFermi : passoFermiStop5 > 0 ? passoFermiStop5 : PASSO_FERMI_M1424;
  out.conteggi.passoFermi = passoFermi;

  for (const linea of linee) {
    // una linea aperta si cuce da sinistra, come tutto il resto del programma
    const punti = !linea.chiusa && linea.punti.length > 1 && linea.punti[linea.punti.length - 1].x < linea.punti[0].x
      ? linea.punti.slice().reverse() : linea.punti;
    const g = new Guida({ punti, chiusa: linea.chiusa });
    const doppia = linea.passaggio !== 'singola';
    const H = doppia ? 4 : 2;
    if (g.punti.length < 2 || g.L < 2) continue;
    g.verso = versoDentro(g, sagoma);
    const A = g.chiusa ? 0 : -Math.max(0, par.sporgenzaEstremi);
    const B = g.chiusa ? g.L : g.L + Math.max(0, par.sporgenzaEstremi);
    const dentro = (s: number) => (g.chiusa ? s : Math.min(B, Math.max(A, s)));
    const W = (s: number, d: number) => g.punto(dentro(s), d);
    out.conteggi.linee++;
    out.conteggi.lunghezza += B - A;

    // 7. raso obliquo, andata: dentro al passo, fuori spostato avanti dell'inclinazione
    {
      const perc = new Percorso();
      const dIn = dO + H, dOut = dO + Math.min(Math.max(0, par.sbordoDritto), H - 0.5);
      const p = Math.max(0.2, par.passoObliquo);
      const ang = (Math.min(90, Math.max(10, par.angoloObliquo)) * Math.PI) / 180;
      const avanti = (dIn - dOut) / Math.tan(ang) + p / 2;
      const inizio = g.chiusa ? A : A - avanti;
      for (let k = 0; ; k++) {
        const s = inizio + k * p;
        if (s > B + 1e-9 || (g.chiusa && s >= B)) break;
        perc.vai(W(s, dIn));
        perc.vai(W(s + avanti, dOut));
      }
      perc.chiudi();
      out.obliquo.push(...perc.blocchi);
    }

    // 8. raso dritto, ritorno: fuori e dentro alternati, mezzo passo per punto
    {
      const perc = new Percorso();
      const p = Math.max(0.2, par.passoDritto);
      const n = Math.max(1, Math.ceil((B - A) / (p / 2)));
      for (let j = 0; j <= n; j++) perc.vai(W(B - ((B - A) * j) / n, j % 2 ? dO + H : dO));
      perc.chiudi();
      out.dritto.push(...perc.blocchi);
    }

    // 9. cordoncino a liscio sul bordo esterno, andata
    {
      const perc = new Percorso();
      const p = Math.max(0.2, par.passoCordoncino);
      const h = Math.min(Math.max(0.3, par.altezzaCordoncino), H);
      const n = Math.max(1, Math.ceil((B - A) / (p / 2)));
      for (let j = 0; j <= n; j++) perc.vai(W(A + ((B - A) * j) / n, j % 2 ? dO + h : dO));
      perc.chiudi();
      out.cordoncino.push(...perc.blocchi);
    }

    // 10. le linee: cordoncino a pezzi uguali all'andata, fermi sui giunti al ritorno
    {
      const perc = new Percorso();
      const pezzi = Math.max(1, Math.round((B - A) / passoFermi));
      const passo = (B - A) / pezzi;
      const quante = doppia ? 2 : 1;
      for (let i = 0; i < quante; i++) {
        const d = dO + par.primaLinea + i * par.distanzaLinee;
        // la seconda linea ha i giunti a metà passo della prima: i fermi si alternano
        const giunti = i % 2 === 0
          ? Array.from({ length: pezzi + 1 }, (_, k) => A + k * passo)
          : [A, ...Array.from({ length: pezzi }, (_, k) => A + (k + 0.5) * passo), B];
        perc.vai(W(giunti[0], d));
        for (let k = 1; k < giunti.length; k++) perc.cordoncino(W(giunti[k - 1], d), W(giunti[k], d), par.passateLinea, 0);
        const fermi = g.chiusa ? giunti.slice(0, -1) : giunti;
        for (let k = fermi.length - 1; k >= 0; k--) {
          // ai capi il fermo entra di mezza larghezza: tagliato sul capo sarebbe un tratto solo ripassato
          const h = par.altezzaFermo / 2, w = LARGO_FERMO / 2;
          const s = g.chiusa ? fermi[k] : Math.min(B - w, Math.max(A + w, fermi[k]));
          // come nel DST: si arriva sulla linea al fermo e solo lì si sale all'angolo (niente diagonale lunga)
          perc.vai(W(s, d));
          perc.vai(W(s + w, d + h));
          for (let t = 0; t < TRATTI_FERMO; t++) {
            const st = s + w - (LARGO_FERMO * t) / (TRATTI_FERMO - 1);
            if (t > 0) perc.vai(W(st, d + h));
            perc.vai(W(st, d - h));
          }
          perc.vai(W(s - w, d));
          out.conteggi.fermi++;
        }
      }
      perc.chiudi();
      out.linee.push(...perc.blocchi);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// I lati del contorno, per sceglierli in anteprima.

/** Un lato del contorno: fra due spigoli di un anello. `chiave` è il suo punto di mezzo, per ritrovarlo. */
export type LatoContorno = { anello: number; indice: number; punti: Punto[]; chiuso: boolean; chiave: Punto };

/** Oltre questa svolta un vertice è uno spigolo e divide due lati, gradi. */
const SPIGOLO_GRADI = 30;

/** I lati degli anelli del contorno: una curva liscia resta un lato solo, gli spigoli li dividono. */
export function latiDelContorno(anelli: Punto[][], spigoloGradi = SPIGOLO_GRADI): LatoContorno[] {
  const out: LatoContorno[] = [];
  anelli.forEach((anello, ia) => {
    const r = anello.slice();
    if (r.length > 2 && Math.hypot(r[0].x - r[r.length - 1].x, r[0].y - r[r.length - 1].y) <= 0.01) r.pop();
    const n = r.length;
    if (n < 3) return;
    const spigoli: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n];
      const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
      let svolta = Math.abs(a2 - a1);
      if (svolta > Math.PI) svolta = 2 * Math.PI - svolta;
      if ((svolta * 180) / Math.PI > spigoloGradi) spigoli.push(i);
    }
    let lati: Punto[][] = [];
    if (spigoli.length) for (let k = 0; k < spigoli.length; k++) {
      const i0 = spigoli[k], i1 = spigoli[(k + 1) % spigoli.length];
      const pts: Punto[] = [];
      for (let i = i0; ; i = (i + 1) % n) { pts.push(r[i]); if (i === i1 && pts.length > 1) break; }
      lati.push(pts);
    }
    lati = unisciLati(lati, spigoloGradi);
    if (lati.length < 2) lati = [[...r, r[0]]];
    const chiuso = lati.length === 1;
    lati.forEach((punti, indice) => out.push({ anello: ia, indice, punti, chiuso, chiave: mezzo(punti) }));
  });
  return out;
}

/** Un lato più corto di così non è un lato: è uno scalino fra due rombi, e va col lato vicino, mm. */
const LATO_MINIMO = 3;

const lunghezza = (punti: Punto[]) => {
  let t = 0;
  for (let i = 1; i < punti.length; i++) t += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
  return t;
};

/**
 * Sul contorno vero un bordo dritto arriva a pezzi: fra un rombo e l'altro ci sono scalini da un millimetro
 * (sul davanti M3641 il fondo era in 20 lati). Si uniscono i lati consecutivi quando uno dei due è uno
 * scalino o quando vanno nella stessa direzione (la corda dall'inizio alla fine), finché non cambia più.
 */
function unisciLati(lati: Punto[][], spigoloGradi: number): Punto[][] {
  const direzione = (p: Punto[]) => Math.atan2(p[p.length - 1].y - p[0].y, p[p.length - 1].x - p[0].x);
  let cambiato = true;
  while (cambiato && lati.length > 1) {
    cambiato = false;
    for (let k = 0; k < lati.length && lati.length > 1; k++) {
      const j = (k + 1) % lati.length, a = lati[k], b = lati[j];
      let diff = Math.abs(direzione(a) - direzione(b));
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (lunghezza(a) < LATO_MINIMO || lunghezza(b) < LATO_MINIMO || (diff * 180) / Math.PI <= spigoloGradi) {
        const unito = [...a, ...b.slice(1)];
        if (j === 0) { lati.splice(k, 1); lati[0] = unito; } else lati.splice(k, 2, unito);
        cambiato = true;
        break;
      }
    }
  }
  return lati;
}

function mezzo(punti: Punto[]): Punto {
  let tot = 0;
  for (let i = 1; i < punti.length; i++) tot += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
  let s = 0;
  for (let i = 1; i < punti.length; i++) {
    const l = Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
    if (s + l >= tot / 2) {
      const t = (tot / 2 - s) / (l || 1);
      return { x: Math.round((punti[i - 1].x + (punti[i].x - punti[i - 1].x) * t) * 100) / 100, y: Math.round((punti[i - 1].y + (punti[i].y - punti[i - 1].y) * t) * 100) / 100 };
    }
    s += l;
  }
  return { ...punti[0] };
}

/** Il lato scelto con questa chiave, se c'è ancora (entro mezzo millimetro). */
export const stessoLato = (l: LatoContorno, chiave: Punto) => Math.hypot(l.chiave.x - chiave.x, l.chiave.y - chiave.y) <= 0.5;

/**
 * I lati scelti diventano linee da bordare: quelli consecutivi dello stesso anello COL STESSO PASSAGGIO si
 * uniscono in una. `scelta` dice il passaggio di un lato, o null se il lato non si borda.
 */
export function lineeDaLati(lati: LatoContorno[], scelta: (l: LatoContorno) => Passaggio | null): LineaBordo[] {
  const out: LineaBordo[] = [];
  const perAnello = new Map<number, LatoContorno[]>();
  for (const l of lati) perAnello.set(l.anello, [...(perAnello.get(l.anello) ?? []), l]);
  for (const gruppo of perAnello.values()) {
    const tipi = gruppo.map(scelta);
    if (!tipi.some(Boolean)) continue;
    const n = gruppo.length;
    if (tipi.every((t) => t === tipi[0])) {
      out.push({ punti: gruppo.flatMap((l, k) => (k ? l.punti.slice(1) : l.punti)), chiusa: true, passaggio: tipi[0]! });
      continue;
    }
    // si parte dove il passaggio cambia, così un tratto che passa sopra l'inizio dell'anello resta intero
    const via = tipi.findIndex((t, i) => t !== tipi[(i + 1) % n]);
    let corrente: LineaBordo | null = null;
    for (let k = 1; k <= n; k++) {
      const i = (via + k) % n, t = tipi[i];
      if (corrente && corrente.passaggio !== t) { out.push(corrente); corrente = null; }
      if (!t) continue;
      if (corrente) corrente.punti.push(...gruppo[i].punti.slice(1));
      else corrente = { punti: gruppo[i].punti.slice(), chiusa: false, passaggio: t };
    }
    if (corrente) out.push(corrente);
  }
  return out;
}

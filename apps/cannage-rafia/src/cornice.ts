// Cannage rafia — STOP 6: la cornice nei rombi.
//
// Letta dall'ago 6 dei DST M1404 (davanti e lato, uguali):
// - La cornice gira attorno ai rombi del PATTERN 2, uno per volta, righe dall'alto. Ogni giro va in
//   senso orario partendo dal vertice destro: lato basso-destra, basso-sinistra, alto-sinistra,
//   alto-destra.
// - Il pezzo che si ripete è l'UNCINO: un'orizzontale ripassata (11 passate) a cavallo del lato del
//   rombo e una verticale ripassata (9–12 passate) dentro il pattern 2, col capo sulla riga
//   dell'orizzontale, poco dentro il suo capo nel pattern 2.
// - Gli uncini stanno su un passo di 1/15 del lato (in altezza b/15): 13 orizzontali per lato, a metà
//   fra una divisione e l'altra. Dove il rombo si stringe verso i vertici alto e basso non c'è posto
//   per la verticale; verso i vertici destro e sinistro le verticali dei due lati si toccano e diventano
//   una sola, a cavallo della diagonale (le fa il lato che arriva al vertice).
// - Ai vertici pezzi propri: alto e basso un'orizzontale larga a 1,45 mm dentro (e sul vertice alto una
//   corta), destro e sinistro due orizzontali lunghe a ±1 mm. Tutti centrati sul vertice.
// - Da un rombo al successivo il filo cammina sui due lati alti del rombo nuovo, che i suoi uncini
//   coprono alla fine del giro.
// Nel DST il giro è un modulo copiato identico su ogni rombo (97 tratti, copie entro 0,2 mm).
//
// Decisioni di Lorenzo (15/09):
// - si RIGENERA dai valori, non si copia il modulo del DST: così scala col rombo e, oltre la soglia,
//   aumentano gli uncini;
// - le irregolarità sono volute ma MINIME: un solo valore in mm, e il centro dell'orizzontale resta
//   SEMPRE sul lato del rombo (nel DST cadeva anche 0,5 mm fuori) — «così che venga tutto preciso»;
// - sul bordo del pezzo un rientro unico. Ma «tu tagli troppo presto» (16/09): la prima versione
//   toglieva l'uncino intero se anche solo la verticale non ci stava. Ora si guarda pezzo per pezzo:
//   l'orizzontale resta se ci sta, la verticale si accorcia fino al rientro;
// - i PASSAGGI «devono sempre passare dentro» (16/09): la prima versione ripartiva ogni riga da sinistra
//   e, quando il vertice del rombo dopo cadeva fuori, girava sul contorno — tutto il fondo, su e giù dai
//   bordi. Ora le righe vanno a serpentina (la riga al contrario cuce i giri a specchio) e il filo
//   cammina SOLO sui lati dei rombi dentro il pezzo, cercando la strada più corta: un lato ancora da
//   cucire costa poco (lo copriranno gli uncini, il passaggio resta sotto), uno già cucito o che nessun
//   uncino coprirà costa molto. Come cucire ogni giro (da che vertice, in che verso, e se un giro
//   tagliato dal bordo va spezzato in due metà) si sceglie per avere i passaggi più corti e nascosti in
//   tutto il programma: in mezzo al pezzo ritorna da solo il giro del DST.
//
// Fermi e barre delle linee (16/09, Lorenzo: la cornice «passa sopra i cordoncini … sbatte contro»): lo
// stop 5 è cucito prima e dice dove li ha messi. Gli uncini devono stare DENTRO la finestra, fra i due
// fermi: un'orizzontale che ne tocca uno si accorcia dalle due parti (il centro resta sul lato) e la sua
// verticale si sposta con lei; una verticale si accorcia dal capo lontano. Quello che neanche così ci sta
// non si cuce. Le orizzontali dei vertici incrociano la barra del vertice anche nel DST: lì non si tocca.
import { Percorso, ROMBO_RIFERIMENTO, type Ingombro, type Punto, type Reticolo } from './linee';

export type ParametriCornice = {
  /** Passate di ogni orizzontale (dispari: finisce dall'altra parte). */
  passateOrizzontale: number;
  /** Passate di ogni verticale. */
  passateVerticale: number;
  /** Lunghezza dell'orizzontale sul rombo di riferimento, mm: metà per parte del lato. */
  lunghezzaOrizzontale: number;
  /** Lunghezza della verticale sul rombo di riferimento, mm. */
  lunghezzaVerticale: number;
  /** Di quanto al massimo cambia la lunghezza di un uncino rispetto agli altri, mm (0 = tutti uguali). */
  irregolarita: number;
  /**
   * Distanza minima dal bordo del pezzo, mm: un'orizzontale che ci arriva più vicino non si cuce, una
   * verticale si accorcia.
   */
  rientro: number;
  /** Quanto il passo fra gli uncini può allungarsi col rombo prima che se ne aggiungano (0,5 = il 50%). */
  sogliaUncini: number;
  /** Punto dei passaggi, mm. */
  puntoPassaggio: number;
};

/** Il davanti M1404, riportato a uncini regolari: le misure sono le mediane del DST. */
export const PARAMETRI_CORNICE: ParametriCornice = {
  passateOrizzontale: 11,
  passateVerticale: 9,
  lunghezzaOrizzontale: 5.4,
  lunghezzaVerticale: 4.3,
  irregolarita: 0.3,
  rientro: 1,
  sogliaUncini: 0.5,
  puntoPassaggio: 4,
};

/** Divisioni del lato sul rombo di riferimento: il passo degli uncini è b/15 (2,02 mm). */
const DIVISIONI = 15;
const PASSO_RIFERIMENTO = ROMBO_RIFERIMENTO.b / DIVISIONI;

/** Le misure del modulo sul rombo di riferimento, mm: scalano col passo. */
const MODULO = {
  /** La verticale sta così dentro dal capo dell'orizzontale nel pattern 2, verso il lato. */
  rientroVerticale: 1.0,
  /** Più vicino di così all'asse verticale del rombo la verticale non ci sta (verso i vertici alto e basso). */
  asseMinimoVerticale: 4.5,
  /** Se il rombo alla quota della verticale è più basso di così, le verticali dei due lati si uniscono. */
  altezzaUnione: 8.0,
  /** La verticale unita si ferma così prima dei due lati. */
  margineUnione: 2.3,
  /** L'orizzontale non arriva più vicino di così all'asse del rombo. */
  gioco: 0.3,
  verticeAltoBasso: { lunghezza: 7.0, dentro: 1.45, sulVertice: 3.7 },
  verticeLaterale: { lunghezza: 8.7, quota: 1.0 },
  /** Un passaggio più corto di così va dritto (come nel DST fra un pezzo e l'altro); più lungo cammina sui lati. */
  saltoDiretto: 10,
  /** Una verticale accorciata sul bordo resta se è lunga almeno così. */
  verticaleMinima: 1,
};

/** Quanto pesa un millimetro di passaggio sopra un lato già cucito, e su un lato che nessun uncino coprirà. */
const PESO_SOPRA = 20;
const PESO_SCOPERTO = 4;
/** I passaggi sui lati stanno almeno così dentro il pezzo, mm. */
const MARGINE_PASSAGGI = 0.3;
/** Gli uncini stanno almeno così lontani da fermi e barre delle linee, mm (dipende dal filo: non scala). */
const MARGINE_INGOMBRI = 0.3;
/** Un'orizzontale accorciata più corta di così non si cuce, mm sul rombo di riferimento. */
const ORIZZONTALE_MINIMA = 1.5;

export type ElementoCornice = { tipo: 'H' | 'V'; a: Punto; b: Punto; passate: number };

export type RisultatoCornice = {
  /** Tratti continui di cucitura, nell'ordine. */
  blocchi: Punto[][];
  /** Orizzontali e verticali cucite, nell'ordine, coi capi di partenza e arrivo. */
  elementi: ElementoCornice[];
  /** I giri cuciti, in ordine: il centro del rombo del pattern 2 e quanti tratti ripassati ci sono. */
  giri: { centro: Punto; elementi: number }[];
  conteggi: {
    giri: number; uncini: number; orizzontali: number; verticali: number; punti: number;
    /** Filo dei passaggi, mm, e quanto ne corre sopra lati già cuciti. */
    passaggi: number; passaggiSopra: number;
    /** Orizzontali e verticali accorciate per non passare sopra fermi e barre delle linee. */
    accorciati: number;
  };
};

type Voce = {
  tipo: 'H' | 'V'; a: Punto; b: Punto; passate: number; torna: boolean; gruppo: number; lato: number; indice: number;
  accorciato?: boolean;
};
type Modulo = { voci: Voce[]; extra: Voce[]; inizi: number[] };

/** Un numero fra −1 e 1 che dipende solo da lato, livello e pezzo: ogni rombo ha la stessa «mano». */
function rumore(lato: number, livello: number, pezzo: number): number {
  const x = Math.sin(lato * 127.1 + livello * 311.7 + pezzo * 74.7) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

const dist = (p: Punto, q: Punto) => Math.hypot(q.x - p.x, q.y - p.y);
const lerp = (p: Punto, q: Punto, t: number): Punto => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

/**
 * Quante divisioni ha il lato. Col rombo di riferimento 15; se il passo, scalato, cresce (o cala) oltre
 * la soglia, le divisioni si ricontano sul passo di riferimento: aumentano (o calano) gli uncini.
 */
export function divisioniCornice(b: number, soglia: number): number {
  const passo = b / DIVISIONI;
  if (passo <= PASSO_RIFERIMENTO * (1 + soglia) && passo >= PASSO_RIFERIMENTO / (1 + soglia)) return DIVISIONI;
  return Math.max(6, Math.round(b / PASSO_RIFERIMENTO));
}

/**
 * Il giro attorno a un rombo del pattern 2, in coordinate dal suo centro, nell'ordine di cucitura.
 * `gruppo` lega un'orizzontale alla sua verticale; `lato` è il lato del rombo (−1 = pezzo di vertice);
 * `inizi` dice dove comincia ogni lato. `extra` sono le orizzontali del vertice destro: le fa il giro
 * del rombo accanto, o questo se accanto non c'è niente.
 */
function moduloGiro(a: number, b: number, par: ParametriCornice): Modulo {
  const D = divisioniCornice(b, par.sogliaUncini);
  const d = b / D, f = d / PASSO_RIFERIMENTO;
  const livelli = D - 2;
  const pH = par.passateOrizzontale;
  const voci: Voce[] = [];
  const inizi: number[] = [];
  let gruppo = 0;
  const metti = (tipo: 'H' | 'V', p0: Punto, p1: Punto, passate: number, torna: boolean, g: number, lato: number) =>
    voci.push({ tipo, a: p0, b: p1, passate, torna, gruppo: g, lato, indice: voci.length });
  const segni: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

  for (let s = 0; s < 4; s++) {
    inizi.push(voci.length);
    const [gx, gy] = segni[s];
    // i lati 0 e 2 partono dal vertice laterale, l'1 e il 3 da quello alto o basso
    const ordine = Array.from({ length: livelli }, (_, n) => (s % 2 === 0 ? n : livelli - 1 - n));
    for (const n of ordine) {
      const yy = (1.5 + n) * d;
      const w = a * (1 - yy / b); // il lato alla quota yy, dall'asse verticale
      const meta = Math.min((par.lunghezzaOrizzontale * f + par.irregolarita * rumore(s, n, 0)) / 2, w - MODULO.gioco * f);
      if (meta < 0.3) continue;
      const y = gy * yy;
      // centro SULLA retta del lato: metà nel pattern 1, metà nel pattern 2
      const inP1 = { x: gx * (w + meta), y }, inP2 = { x: gx * (w - meta), y };
      const g = gruppo++;
      let V: { da: Punto; a: Punto; torna: boolean } | null = null;
      const xv = w - meta + MODULO.rientroVerticale * f;
      if (xv >= MODULO.asseMinimoVerticale * f && xv < a) {
        const alto = b * (1 - xv / a); // metà altezza del rombo alla x della verticale
        if (alto < MODULO.altezzaUnione * f) {
          // verticale unita a cavallo della diagonale: la fa solo il lato che arriva al vertice laterale
          const e = alto - MODULO.margineUnione * f;
          if (s % 2 === 1 && e > 0.5) V = { da: { x: gx * xv, y: gy * e }, a: { x: gx * xv, y: -gy * e }, torna: true };
        } else {
          const lv = Math.max(1, par.lunghezzaVerticale * f + par.irregolarita * rumore(s, n, 1));
          const vicino = { x: gx * xv, y }, lontano = { x: gx * xv, y: gy * Math.max(0, yy - lv) };
          // come nel DST: sui lati 0 e 2 dal capo lontano, sugli altri avanti e indietro dal capo sulla riga
          V = s % 2 === 0 ? { da: lontano, a: vicino, torna: false } : { da: vicino, a: lontano, torna: true };
        }
      }
      if (s % 2 === 0) {
        if (V) metti('V', V.da, V.a, par.passateVerticale, V.torna, g, s);
        metti('H', inP1, inP2, pH, false, g, s);
      } else {
        if (V) metti('V', V.da, V.a, V.torna ? par.passateVerticale + 1 : par.passateVerticale, V.torna, g, s);
        metti('H', inP2, inP1, pH, false, g, s);
      }
    }
    const va = MODULO.verticeAltoBasso, vl = MODULO.verticeLaterale;
    if (s === 0) metti('H', { x: (va.lunghezza / 2) * f, y: b - va.dentro * f }, { x: (-va.lunghezza / 2) * f, y: b - va.dentro * f }, pH, false, gruppo++, -1);
    if (s === 1) for (const q of [vl.quota, -vl.quota]) {
      metti('H', { x: -a + (vl.lunghezza / 2) * f, y: q * f }, { x: -a - (vl.lunghezza / 2) * f, y: q * f }, pH, false, gruppo++, -1);
    }
    if (s === 2) {
      metti('H', { x: (-va.sulVertice / 2) * f, y: -b }, { x: (va.sulVertice / 2) * f, y: -b }, pH, false, gruppo++, -1);
      metti('H', { x: (-va.lunghezza / 2) * f, y: -b + va.dentro * f }, { x: (va.lunghezza / 2) * f, y: -b + va.dentro * f }, pH, false, gruppo++, -1);
    }
  }
  const vl = MODULO.verticeLaterale;
  const extra: Voce[] = [vl.quota, -vl.quota].map((q, j) => ({
    tipo: 'H', a: { x: a - (vl.lunghezza / 2) * f, y: q * f }, b: { x: a + (vl.lunghezza / 2) * f, y: q * f },
    passate: pH, torna: false, gruppo: gruppo++, lato: -1, indice: voci.length + j,
  }));
  return { voci, extra, inizi };
}

/**
 * Il giro a specchio, per le righe cucite da destra a sinistra: parte dal vertice sinistro e gira
 * nell'altro verso. Il vertice laterale suo diventa il destro, e l'extra quello sinistro.
 */
function specchia(m: Modulo): Modulo {
  const sp = (v: Voce): Voce => ({ ...v, a: { x: -v.a.x, y: v.a.y }, b: { x: -v.b.x, y: v.b.y } });
  return { voci: m.voci.map(sp), extra: m.extra.map(sp), inizi: m.inizi };
}

function dentroAnello(p: Punto, poly: Punto[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Distanza dal contorno, positiva dentro il pezzo. */
function distanzaInterna(p: Punto, poly: Punto[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y));
  }
  return dentroAnello(p, poly) ? best : -best;
}

/** Il punto del segmento da `buono` (dentro) a `cattivo` (fuori) dove si smette di stare dentro. */
function confine(buono: Punto, cattivo: Punto, dentro: (p: Punto) => boolean): Punto {
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (dentro(lerp(buono, cattivo, m))) lo = m; else hi = m; }
  return lerp(buono, cattivo, lo);
}

// ---------------------------------------------------------------------------------------------------
// La rete dei lati dei rombi: dove il filo può camminare.

/**
 * Il lato del reticolo su cui sta un punto, o null. In coordinate di reticolo u = (x−cx)/a, v = (y−cy)/b
 * i vertici sono i punti interi con u+v dispari e i lati stanno sulle rette u+v = dispari («s») e
 * u−v = dispari («d»), un pezzo per ogni intero di u.
 */
export function latoDelReticolo(ret: Reticolo, p: Punto, tolleranza = 0.02): string | null {
  const u = (p.x - ret.cx) / ret.a, v = (p.y - ret.cy) / ret.b;
  const dispari = (z: number) => 2 * Math.round((z - 1) / 2) + 1;
  const s = u + v, dd = u - v, ks = dispari(s), kd = dispari(dd);
  const es = Math.abs(s - ks), ed = Math.abs(dd - kd);
  if (Math.min(es, ed) > tolleranza) return null;
  return es <= ed ? `s${ks}:${Math.floor(u)}` : `d${kd}:${Math.floor(u)}`;
}

type Arco = { chiave: string; n0: number; n1: number; q0: Punto; q1: Punto; len: number };
type Aggancio = { arco: number; t: number; punto: Punto; d: number };
type Strada = { costo: number; punti: Punto[]; sopra: number };

class Rete {
  readonly nodi: Punto[] = [];
  readonly archi: Arco[] = [];
  private readonly vicini: number[][] = [];
  private readonly perChiave = new Map<string, number>();

  constructor(private readonly ret: Reticolo, contorno: Punto[], private readonly salto: number) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of contorno) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const u0 = Math.floor((minX - ret.cx) / ret.a) - 1, u1 = Math.ceil((maxX - ret.cx) / ret.a) + 1;
    const v0 = Math.floor((minY - ret.cy) / ret.b) - 1, v1 = Math.ceil((maxY - ret.cy) / ret.b) + 1;
    const dentro = (p: Punto) => distanzaInterna(p, contorno) >= MARGINE_PASSAGGI;
    const idVertice = new Map<string, number>();
    const nodo = (p: Punto, chiave?: string) => {
      if (chiave !== undefined) { const k = idVertice.get(chiave); if (k !== undefined) return k; }
      this.nodi.push(p); this.vicini.push([]);
      if (chiave !== undefined) idVertice.set(chiave, this.nodi.length - 1);
      return this.nodi.length - 1;
    };
    const P = (u: number, v: number): Punto => ({ x: ret.cx + u * ret.a, y: ret.cy + v * ret.b });
    for (let u = u0; u < u1; u++) for (let v = v0; v <= v1; v++) {
      if (Math.abs((u + v) % 2) !== 1) continue;
      for (const [dv, fam, k] of [[-1, 's', u + v], [1, 'd', u - v]] as [number, string, number][]) {
        const p0 = P(u, v), p1 = P(u + 1, v + dv);
        const ok0 = dentro(p0), ok1 = dentro(p1);
        if (!ok0 && !ok1) continue;
        let q0 = p0, q1 = p1, n0: number, n1: number;
        if (ok0 && ok1) {
          if (!dentro(lerp(p0, p1, 0.5))) continue;
          n0 = nodo(p0, `${u},${v}`); n1 = nodo(p1, `${u + 1},${v + dv}`);
        } else if (ok0) {
          q1 = confine(p0, p1, dentro);
          if (dist(q0, q1) < 0.5) continue;
          n0 = nodo(p0, `${u},${v}`); n1 = nodo(q1);
        } else {
          q0 = confine(p1, p0, dentro);
          if (dist(q0, q1) < 0.5) continue;
          n0 = nodo(q0); n1 = nodo(p1, `${u + 1},${v + dv}`);
        }
        const chiave = `${fam}${k}:${u}`;
        this.perChiave.set(chiave, this.archi.length);
        this.vicini[n0].push(this.archi.length); this.vicini[n1].push(this.archi.length);
        this.archi.push({ chiave, n0, n1, q0, q1, len: dist(q0, q1) });
      }
    }
  }

  /** I lati più vicini a un punto (uno per famiglia), con la proiezione sul tratto percorribile. */
  private agganci(p: Punto): Aggancio[] {
    const u = (p.x - this.ret.cx) / this.ret.a, v = (p.y - this.ret.cy) / this.ret.b;
    const dispari = (z: number) => 2 * Math.round((z - 1) / 2) + 1;
    const out: Aggancio[] = [];
    for (const [fam, k] of [['s', dispari(u + v)], ['d', dispari(u - v)]] as [string, number][]) {
      let best: Aggancio | null = null;
      for (let du = -1; du <= 1; du++) {
        const i = this.perChiave.get(`${fam}${k}:${Math.floor(u) + du}`);
        if (i === undefined) continue;
        const A = this.archi[i];
        const dx = A.q1.x - A.q0.x, dy = A.q1.y - A.q0.y;
        const t = Math.max(0, Math.min(1, ((p.x - A.q0.x) * dx + (p.y - A.q0.y) * dy) / (A.len * A.len)));
        const punto = lerp(A.q0, A.q1, t), d = dist(p, punto);
        if (!best || d < best.d) best = { arco: i, t, punto, d };
      }
      // ci si aggancia solo a un lato vicino: un lato lontano vorrebbe dire un salto dritto a vista
      if (best && best.d <= this.salto * 0.6) out.push(best);
    }
    return out;
  }

  /** La strada più corta da p a q: dritta se è corta, se no sui lati, coi pesi dati per lato. */
  strada(p: Punto, q: Punto, peso: (chiave: string) => number): Strada {
    const diretta = dist(p, q);
    let best: Strada = diretta <= this.salto ? { costo: diretta, punti: [q], sopra: 0 } : { costo: Infinity, punti: [q], sopra: 0 };
    const da = this.agganci(p), a = this.agganci(q);
    if (!da.length || !a.length) return best.costo < Infinity ? best : { costo: diretta * PESO_SOPRA * 2, punti: [q], sopra: 0 };
    const sopraDi = (i: number, l: number) => (peso(this.archi[i].chiave) === PESO_SOPRA ? l : 0);
    // sullo stesso lato
    for (const s of da) for (const t of a) if (s.arco === t.arco) {
      const A = this.archi[s.arco], l = Math.abs(s.t - t.t) * A.len;
      const c = s.d + l * peso(A.chiave) + t.d;
      if (c < best.costo) best = { costo: c, punti: [s.punto, t.punto, q], sopra: sopraDi(s.arco, l) };
    }
    // Dijkstra sui nodi
    const N = this.nodi.length;
    const costo = new Float64Array(N).fill(Infinity);
    const prima = new Int32Array(N).fill(-2); // −1 = arriva dall'aggancio di partenza
    const primaArco = new Int32Array(N).fill(-1);
    const partenza = new Int32Array(N).fill(-1);
    const heap: [number, number][] = [];
    const push = (c: number, n: number) => {
      heap.push([c, n]);
      for (let i = heap.length - 1; i > 0;) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; }
      }
      return top;
    };
    da.forEach((s, k) => {
      const A = this.archi[s.arco], w = peso(A.chiave);
      for (const [n, l] of [[A.n0, s.t * A.len], [A.n1, (1 - s.t) * A.len]] as [number, number][]) {
        const c = s.d + l * w;
        if (c < costo[n]) { costo[n] = c; prima[n] = -1; primaArco[n] = s.arco; partenza[n] = k; push(c, n); }
      }
    });
    const bersagli = new Set<number>();
    for (const t of a) { bersagli.add(this.archi[t.arco].n0); bersagli.add(this.archi[t.arco].n1); }
    const fatto = new Uint8Array(N);
    let mancano = bersagli.size;
    while (heap.length && mancano > 0) {
      const [c, n] = pop();
      if (fatto[n]) continue;
      fatto[n] = 1;
      if (bersagli.has(n)) mancano--;
      for (const i of this.vicini[n]) {
        const A = this.archi[i], m = A.n0 === n ? A.n1 : A.n0;
        const nc = c + A.len * peso(A.chiave);
        if (nc < costo[m]) { costo[m] = nc; prima[m] = n; primaArco[m] = i; partenza[m] = partenza[n]; push(nc, m); }
      }
    }
    let arrivo: { n: number; t: Aggancio } | null = null, arrivoCosto = best.costo;
    for (const t of a) {
      const A = this.archi[t.arco], w = peso(A.chiave);
      for (const [n, l] of [[A.n0, t.t * A.len], [A.n1, (1 - t.t) * A.len]] as [number, number][]) {
        const c = costo[n] + l * w + t.d;
        if (c < arrivoCosto) { arrivoCosto = c; arrivo = { n, t }; }
      }
    }
    if (!arrivo) return best.costo < Infinity ? best : { costo: diretta * PESO_SOPRA * 2, punti: [q], sopra: 0 };
    const nodi: number[] = [];
    let sopra = 0;
    const At = this.archi[arrivo.t.arco];
    sopra += sopraDi(arrivo.t.arco, (arrivo.n === At.n0 ? arrivo.t.t : 1 - arrivo.t.t) * At.len);
    for (let n = arrivo.n; ;) {
      nodi.push(n);
      if (prima[n] === -1) {
        const s = da[partenza[n]], As = this.archi[s.arco];
        sopra += sopraDi(s.arco, (n === As.n0 ? s.t : 1 - s.t) * As.len);
        nodi.reverse();
        return { costo: arrivoCosto, punti: [s.punto, ...nodi.map((k) => this.nodi[k]), arrivo.t.punto, q], sopra };
      }
      sopra += sopraDi(primaArco[n], this.archi[primaArco[n]].len);
      n = prima[n];
    }
  }
}

// ---------------------------------------------------------------------------------------------------

/** Un giro da cucire: i pezzi rimasti in ordine di modulo; `ultimo` = l'indice dopo cui si torna allo 0. */
type Giro = { centro: Punto; riga: number; I: number; voci: Voce[]; inizi: number[]; lati: Set<string>; ultimo: number };

const fineDi = (v: Voce) => (v.torna ? v.a : v.b);

/**
 * Genera la cornice su un pezzo: il reticolo dei rombi del PATTERN 1 (come le linee) e il contorno del
 * pezzo. I rombi del pattern 2 stanno in mezzo: centro (cx + a + 2a·I, cy + b + 2b·J). `ingombri` sono
 * fermi e barre delle linee (stop 5), da non coprire.
 */
export function generaCornice(ret: Reticolo, contorno: Punto[], par: ParametriCornice = PARAMETRI_CORNICE, ingombri: Ingombro[] = []): RisultatoCornice {
  if (!(ret.a > 0 && ret.b > 0)) throw new Error('Reticolo non valido: le mezze diagonali devono essere positive.');
  if (contorno.length < 3) throw new Error('Serve il contorno del pezzo (almeno tre punti).');
  const normale = moduloGiro(ret.a, ret.b, par), specchio = specchia(normale);
  const f = ret.b / divisioniCornice(ret.b, par.sogliaUncini) / PASSO_RIFERIMENTO;
  const salto = MODULO.saltoDiretto * f;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of contorno) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const I0 = Math.floor((minX - ret.cx - ret.a) / (2 * ret.a)) - 1, I1 = Math.ceil((maxX - ret.cx - ret.a) / (2 * ret.a)) + 1;
  const J0 = Math.floor((minY - ret.cy - ret.b) / (2 * ret.b)) - 1, J1 = Math.ceil((maxY - ret.cy - ret.b) / (2 * ret.b)) + 1;
  const dentro = (p: Punto) => distanzaInterna(p, contorno) >= par.rientro - 1e-9;

  /**
   * Quello che resta di un giro sul bordo, pezzo per pezzo: l'orizzontale se ci sta tutta (e con lei
   * la sua verticale), la verticale accorciata fino al rientro se è ancora lunga abbastanza.
   */
  // il gioco rimpicciolisce coi rombi più piccoli, come i fermi
  const gioco = MARGINE_INGOMBRI * Math.min(1, f);
  const scatole = ingombri.map((r) => ({
    barra: r.tipo === 'barra', x0: r.x0 - gioco, x1: r.x1 + gioco, y0: r.y0 - gioco, y1: r.y1 + gioco,
  }));
  /** Gli uncini che toccano fermi e barre, accorciati per stare nella finestra (o tolti se non ci stanno). */
  const evita = (voci: Voce[]): Voce[] => {
    if (!scatole.length) return voci;
    const nuove = new Map<number, { prima: Voce; dopo: Voce }>();
    const via = new Set<number>();
    for (const v of voci) {
      if (v.tipo !== 'H') continue;
      const y = v.a.y, c = (v.a.x + v.b.x) / 2, meta = Math.abs(v.b.x - v.a.x) / 2;
      let m = meta;
      for (const s of scatole) {
        if (s.barra && v.lato < 0) continue;
        if (y < s.y0 || y > s.y1 || s.x1 < c - m || s.x0 > c + m) continue;
        if (s.x0 <= c && s.x1 >= c) { m = 0; break; }
        m = Math.min(m, s.x0 > c ? s.x0 - c : c - s.x1);
      }
      if (m >= meta) continue;
      if (2 * m < ORIZZONTALE_MINIMA * f) { via.add(v.gruppo); continue; }
      const dopo = { ...v, a: { x: c + Math.sign(v.a.x - c) * m, y }, b: { x: c + Math.sign(v.b.x - c) * m, y }, accorciato: true };
      nuove.set(v.gruppo, { prima: v, dopo });
    }
    const out: Voce[] = [];
    for (const v0 of voci) {
      if (via.has(v0.gruppo)) continue;
      const h = nuove.get(v0.gruppo);
      if (v0.tipo === 'H') { out.push(h && h.prima === v0 ? h.dopo : v0); continue; }
      let v = v0;
      if (h) {
        // la verticale segue il capo dell'orizzontale che le sta vicino
        const [pa, pb] = [h.prima.a, h.prima.b], [na, nb] = [h.dopo.a, h.dopo.b];
        const dx = Math.abs(pa.x - v.a.x) < Math.abs(pb.x - v.a.x) ? na.x - pa.x : nb.x - pb.x;
        v = { ...v, a: { x: v.a.x + dx, y: v.a.y }, b: { x: v.b.x + dx, y: v.b.y }, accorciato: true };
      }
      const x = v.a.x, lo = Math.min(v.a.y, v.b.y), hi = Math.max(v.a.y, v.b.y);
      // il capo sulla riga dell'orizzontale resta dov'è; se non c'è (verticale unita) si tiene il capo di partenza
      const riga = h ? h.prima.a.y : voci.find((u) => u.tipo === 'H' && u.gruppo === v.gruppo)?.a.y;
      const ancora = riga !== undefined && Math.abs(v.b.y - riga) < 1e-6 ? v.b.y : riga !== undefined && Math.abs(v.a.y - riga) < 1e-6 ? v.a.y : v.a.y;
      let libLo = lo, libHi = hi, fuori = false;
      for (const s of scatole) {
        if (x < s.x0 || x > s.x1 || s.y1 < lo || s.y0 > hi) continue;
        if (s.y0 <= ancora && s.y1 >= ancora) { fuori = true; break; }
        if (s.y0 > ancora) libHi = Math.min(libHi, s.y0); else libLo = Math.max(libLo, s.y1);
      }
      if (fuori) continue;
      if (libLo > lo || libHi < hi) {
        if (libHi - libLo < Math.max(MODULO.verticaleMinima * f, 0.35 * (hi - lo))) continue;
        const stringi = (p: Punto) => ({ x: p.x, y: Math.min(libHi, Math.max(libLo, p.y)) });
        v = { ...v, a: stringi(v.a), b: stringi(v.b), accorciato: true };
      }
      out.push(v);
    }
    return out;
  };

  const tieni = (lista: Voce[], X: number, Y: number): Voce[] => {
    const spostate = evita(lista.map((v) => ({ ...v, a: { x: v.a.x + X, y: v.a.y + Y }, b: { x: v.b.x + X, y: v.b.y + Y } })));
    const senzaH = new Set(spostate.filter((v) => v.tipo === 'H' && !(dentro(v.a) && dentro(v.b))).map((v) => v.gruppo));
    const out: Voce[] = [];
    for (const v of spostate) {
      if (senzaH.has(v.gruppo)) continue;
      if (v.tipo === 'H') { out.push(v); continue; }
      const okA = dentro(v.a), okB = dentro(v.b);
      if (okA && okB) { out.push(v); continue; }
      if (!okA && !okB) continue;
      const q = okA ? confine(v.a, v.b, dentro) : confine(v.b, v.a, dentro);
      const corta = okA ? { ...v, b: q } : { ...v, a: q };
      if (dist(corta.a, corta.b) >= Math.max(MODULO.verticaleMinima * f, 0.35 * dist(v.a, v.b))) out.push(corta);
    }
    return out;
  };

  // ---- i giri, righe a serpentina: da sinistra, poi da destra (a specchio), poi di nuovo da sinistra
  const giri: Giro[] = [];
  let verso = 1;
  for (let J = J0; J <= J1; J++) {
    const Y = ret.cy + ret.b + 2 * ret.b * J;
    const X = (I: number) => ret.cx + ret.a + 2 * ret.a * I;
    if (!Array.from({ length: I1 - I0 + 1 }, (_, k) => tieni(normale.voci, X(I0 + k), Y).length > 0).some(Boolean)) continue;
    const m = verso > 0 ? normale : specchio;
    const riga = new Map<number, Voce[]>();
    for (let I = I0; I <= I1; I++) riga.set(I, tieni(m.voci, X(I), Y));
    const ordine = Array.from({ length: I1 - I0 + 1 }, (_, k) => (verso > 0 ? I0 + k : I1 - k));
    for (const I of ordine) {
      const voci = riga.get(I)!;
      if (!voci.length) continue;
      // il vertice laterale in comune lo fa il giro cucito dopo; l'ultimo della riga fa anche il suo
      const conExtra = !(riga.get(I + verso)?.length);
      if (conExtra) voci.push(...tieni(m.extra, X(I), Y));
      const lati = new Set<string>();
      for (const v of voci) if (v.tipo === 'H' && v.lato >= 0) { const k = latoDelReticolo(ret, lerp(v.a, v.b, 0.5)); if (k) lati.add(k); }
      giri.push({ centro: { x: X(I), y: Y }, riga: J, I, voci, inizi: m.inizi, lati, ultimo: conExtra ? m.voci.length + 1 : m.voci.length - 1 });
    }
    verso = -verso;
  }

  const rete = new Rete(ret, contorno, salto);
  const coperti = new Set<string>();
  for (const g of giri) for (const k of g.lati) coperti.add(k);
  const pesoCon = (cuciti: Set<string>) => (k: string) => (cuciti.has(k) ? PESO_SOPRA : coperti.has(k) ? 1 : PESO_SCOPERTO);
  const latiDi = (voci: Voce[]) => {
    const s = new Set<string>();
    for (const v of voci) if (v.tipo === 'H' && v.lato >= 0) { const k = latoDelReticolo(ret, lerp(v.a, v.b, 0.5)); if (k) s.add(k); }
    return s;
  };
  /** Un tratto di giro cucito all'indietro: stessi pezzi, ordine e capi rovesciati. */
  const inverti = (arco: Voce[]): Voce[] => arco.slice().reverse().map((v) => (v.torna ? v : { ...v, a: v.b, b: v.a }));

  /**
   * I modi di cucire un giro. INTERO: si apre a uno dei quattro vertici, in un verso o nell'altro, e si
   * finisce dove si è cominciato. APERTO dal bordo (un tratto solo): da un capo all'altro, oppure
   * spezzato a un vertice — il filo corre sotto la prima metà fino al suo capo lontano e la cuce tornando
   * al vertice, poi lo stesso con l'altra metà. Così anche un giro tagliato finisce su un vertice, da dove
   * si riparte su lati ancora da cucire invece di tornare indietro sopra quelli appena cuciti.
   */
  type Piano = { passi: Voce[][]; inizio: Punto; fine: Punto };
  const piani = (g: Giro): Piano[] => {
    const n = g.voci.length;
    const arco = (i: number, j: number) => {
      const lung = (j - i + n) % n || n, out: Voce[] = [];
      for (let k = 0; k < lung; k++) out.push(g.voci[(i + k) % n]);
      return out;
    };
    const piano = (passi: Voce[][]): Piano => {
      const p = passi.filter((x) => x.length), ultimo = p[p.length - 1];
      return { passi: p, inizio: p[0][0].a, fine: fineDi(ultimo[ultimo.length - 1]) };
    };
    const buchi: number[] = [];
    for (let k = 0; k < n && n > 1; k++) {
      const a = g.voci[k], b = g.voci[(k + 1) % n];
      const seguito = b.indice === a.indice + 1 || (a.indice === g.ultimo && b.indice === 0);
      if (!seguito && dist(fineDi(a), b.a) > salto / 2) buchi.push((k + 1) % n);
    }
    const vertici = [...new Set(g.inizi.map((s) => g.voci.findIndex((v) => v.indice === s)).filter((k) => k >= 0))];
    if (!buchi.length) {
      const aperture = vertici.length ? vertici : [0];
      return aperture.flatMap((v) => { const c = arco(v, v); return [piano([c]), piano([inverti(c)])]; });
    }
    if (buchi.length === 1) {
      const p = buchi[0], tutto = arco(p, p);
      const out = [piano([tutto]), piano([inverti(tutto)])];
      for (const v of vertici) {
        if (v === p) continue;
        const prima = arco(p, v), dopo = arco(v, p);
        out.push(piano([prima, inverti(dopo)]), piano([inverti(dopo), prima]));
      }
      return out;
    }
    const archi = buchi.map((p, i) => arco(p, buchi[(i + 1) % buchi.length]));
    return [piano(archi), piano(archi.slice().reverse().map(inverti))];
  };
  const tuttiPiani = giri.map(piani);
  /** Il filo dei passaggi DENTRO un piano, fra una metà e l'altra. */
  const interno = (pl: Piano, cuciti: Set<string>) => {
    const tmp = new Set(cuciti);
    let c = 0;
    for (let i = 1; i < pl.passi.length; i++) {
      const prima = pl.passi[i - 1];
      for (const l of latiDi(prima)) tmp.add(l);
      c += rete.strada(fineDi(prima[prima.length - 1]), pl.passi[i][0].a, pesoCon(tmp)).costo;
    }
    return c;
  };

  // ---- i blocchi: un giro, oppure gli ultimi due di una riga, che si possono cucire anche scambiati.
  // Sul bordo l'ultimo giro è spesso una scheggia di rombo: dal suo vertice tutte le strade sono già
  // cucite, e scendere alla riga dopo vorrebbe dire passare sopra un lato. Cucendo prima la scheggia e
  // poi il giro intero accanto, il giro intero può finire sul vertice basso e scendere su lati nuovi.
  // L'ULTIMA RIGA, se il bordo la taglia sotto i vertici laterali, è fatta di mezzi rombi che non si
  // toccano: da uno all'altro si passerebbe sopra la riga prima, già cucita. Allora ogni mezzo rombo si
  // può cucire insieme al giro sopra, PRIMA di lui: il filo scende sotto i lati bassi del giro, cuce il
  // mezzo rombo, risale al vertice e cuce il giro, che copre la strada fatta. Si provano le due maniere
  // e si tiene la migliore.
  type PianoBlocco = Piano & { ordine: number[] };
  const righe = [...new Set(giri.map((g) => g.riga))];
  const blocchiDi = (unisciUltima: boolean): number[][] => {
    const out: number[][] = [];
    const ultima = righe[righe.length - 1], penultima = righe[righe.length - 2];
    const presi = new Set<number>();
    for (let k = 0; k < giri.length;) {
      let ultimo = k;
      while (ultimo + 1 < giri.length && giri[ultimo + 1].riga === giri[k].riga) ultimo++;
      const riga = giri[k].riga;
      if (unisciUltima && riga === penultima) {
        for (let i = k; i <= ultimo; i++) {
          const sotto = giri.findIndex((g) => g.riga === ultima && g.I === giri[i].I);
          if (sotto >= 0) { out.push([i, sotto]); presi.add(sotto); } else out.push([i]);
        }
      } else if (unisciUltima && riga === ultima) {
        for (let i = k; i <= ultimo; i++) if (!presi.has(i)) out.push([i]);
      } else {
        for (let i = k; i <= ultimo - 2; i++) out.push([i]);
        out.push(ultimo > k ? [ultimo - 1, ultimo] : [ultimo]);
      }
      k = ultimo + 1;
    }
    return out;
  };
  const pianiBlocco = (b: number[], cuciti: Set<string>): { piani: PianoBlocco[]; interni: number[] } => {
    if (b.length === 1) {
      const piani = tuttiPiani[b[0]].map((p) => ({ ...p, ordine: b }));
      return { piani, interni: piani.map((p) => interno(p, cuciti)) };
    }
    const piani: PianoBlocco[] = [], interni: number[] = [];
    for (const [g1, g2] of [[b[0], b[1]], [b[1], b[0]]]) {
      const dopo = new Set([...cuciti, ...giri[g1].lati]);
      const i1 = tuttiPiani[g1].map((p) => interno(p, cuciti)), i2 = tuttiPiani[g2].map((p) => interno(p, dopo));
      tuttiPiani[g1].forEach((x, a) => tuttiPiani[g2].forEach((y, c) => {
        piani.push({ passi: [...x.passi, ...y.passi], inizio: x.inizio, fine: y.fine, ordine: [g1, g2] });
        interni.push(i1[a] + rete.strada(x.fine, y.inizio, pesoCon(dopo)).costo + i2[c]);
      }));
    }
    return { piani, interni };
  };

  // ---- come cucire ogni blocco: i passaggi più corti e più nascosti su tutto il programma
  const pianifica = (blocchi: number[][]) => {
    const cuciti = new Set<string>();
    const tabelle: PianoBlocco[][] = [];
    const dietro: number[][] = [];
    let costi: number[] = [];
    blocchi.forEach((b, k) => {
      if (k > 0) for (const g of blocchi[k - 1]) for (const l of giri[g].lati) cuciti.add(l);
      const { piani, interni } = pianiBlocco(b, cuciti);
      tabelle.push(piani);
      if (k === 0) { costi = interni; return; }
      const peso = pesoCon(cuciti), prec = tabelle[k - 1];
      // dai blocchi precedenti bastano i piani più economici: gli altri non vincono mai
      const migliori = costi.map((c, j) => [c, j]).sort((p, q) => p[0] - q[0]).slice(0, 24).map((x) => x[1]);
      const nuovi: number[] = [], scelte: number[] = [];
      piani.forEach((pl, i) => {
        let best = Infinity, arg = migliori[0];
        for (const j of migliori) {
          const tot = costi[j] + rete.strada(prec[j].fine, pl.inizio, peso).costo;
          if (tot < best) { best = tot; arg = j; }
        }
        nuovi.push(best + interni[i]); scelte.push(arg);
      });
      costi = nuovi;
      dietro.push(scelte);
    });
    const scelta: number[] = new Array(blocchi.length);
    let j = costi.indexOf(Math.min(...costi));
    for (let k = blocchi.length - 1; k >= 0; k--) { scelta[k] = j; if (k > 0) j = dietro[k - 1][j]; }
    return { blocchi, tabelle, scelta, costo: blocchi.length ? Math.min(...costi) : 0 };
  };
  const opzioni = [pianifica(blocchiDi(false))];
  if (righe.length >= 2) opzioni.push(pianifica(blocchiDi(true)));
  const { blocchi, tabelle, scelta } = opzioni.reduce((p, q) => (q.costo < p.costo ? q : p));

  // ---- si cuce
  const cuciti = new Set<string>();
  const peso = pesoCon(cuciti);
  const perc = new Percorso();
  const elementi: ElementoCornice[] = [];
  const riassunto: RisultatoCornice['giri'] = [];
  const conteggi = { giri: 0, uncini: 0, orizzontali: 0, verticali: 0, punti: 0, passaggi: 0, passaggiSopra: 0, accorciati: 0 };
  const vaiA = (q: Punto) => {
    const u = perc.ultimo;
    if (!u) { perc.salta(q); return; }
    const s = rete.strada(u, q, peso);
    let da = u;
    for (const p of s.punti) { conteggi.passaggi += dist(da, p); perc.vai(p, par.puntoPassaggio); da = p; }
    conteggi.passaggiSopra += s.sopra;
  };
  blocchi.forEach((_, k) => {
    const pl = tabelle[k][scelta[k]];
    for (const passo of pl.passi) {
      for (const v of passo) {
        vaiA(v.a);
        perc.cordoncino(v.a, v.b, v.passate, 0, v.torna);
        elementi.push({ tipo: v.tipo, a: v.a, b: v.b, passate: v.passate });
        if (v.tipo === 'H') conteggi.orizzontali++; else conteggi.verticali++;
        if (v.accorciato) conteggi.accorciati++;
      }
      for (const l of latiDi(passo)) cuciti.add(l);
    }
    for (const i of pl.ordine) {
      conteggi.uncini += new Set(giri[i].voci.map((v) => v.gruppo)).size;
      conteggi.giri++;
      riassunto.push({ centro: giri[i].centro, elementi: giri[i].voci.length });
    }
  });
  perc.chiudi();
  conteggi.punti = perc.blocchi.reduce((s, b) => s + b.length - 1, 0);
  return { blocchi: perc.blocchi, elementi, giri: riassunto, conteggi };
}

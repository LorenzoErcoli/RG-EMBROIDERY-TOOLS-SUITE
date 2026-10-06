// LE VARIAZIONI NELL'AREA (Lorenzo, 2026-10-06): un pattern standard le cui misure cambiano con la
// posizione — «ai lati più piccolo e più vicino, al centro più largo e lontano», con la sfumatura che non
// si nota e «più irregolarità destra, sinistra, sopra, sotto». L'obiettivo è una pelle squamata col punto
// nastro. Viste le prove (sfumatura continua A, a macchie D, con e senza angolo) ha scelto la A con
// l'angolo del tratto che si muove, coi valori della prova «un po' meno».
//
// Questo file risponde a una domanda sola: in questo punto del piano, quanto è grande il modulo e come
// si scosta. Il generatore costruisce le colonne con queste risposte invece che a passo fisso.
//
// Il rumore è MORBIDO e SEMINATO: stesso seme, stesso ricamo (si riapre uguale dal DST); un altro seme dà
// un'altra pelle con gli stessi valori. Le lunghezze d'onda seguono il passo delle colonne, così un
// pattern ingrandito si muove nello stesso modo.

/** Quanto pesa ogni irregolarità al 100%: i valori della prova approvata (2026-10-06). */
export const IRREGOLARITA_PIENA = {
  /** Di quanto la spina della colonna ondeggia a destra e a sinistra, in passi di colonna. */
  deriva: 0.41,
  /** Di quanto respira la distanza fra i tratti lungo la colonna. */
  respiro: 0.18,
  /** Di quanto varia la lunghezza del tratto. */
  larghezza: 0.12,
  /** Di quanto varia la distanza fra le colonne. */
  passoColonne: 0.08,
} as const;

export type VariationParams = {
  /** Misura ai lati e al centro, in frazione (1 = come il pattern). */
  lati: number;
  centro: number;
  /** 0 = nessuna irregolarità, 1 = quella della prova. */
  irregolarita: number;
  /** Di quanto al massimo si inclina il tratto, gradi (±). */
  angoloMaxDeg: number;
  seme: number;
};

export type VariationField = {
  /** La misura del modulo alla colonna in x (0 = bordo sinistro dell'area, `larghezza` = destro). */
  scala(x: number): number;
  /** I quattro scostamenti, tutti in [-1, 1]: si moltiplicano per l'irregolarità e il loro peso. */
  deriva(x: number, y: number): number;
  respiro(x: number, y: number): number;
  larghezza(x: number, y: number): number;
  passoColonne(x: number): number;
  /** L'inclinazione del tratto in quel punto, gradi. */
  angolo(x: number, y: number): number;
  params: VariationParams;
};

/** Le variazioni sono spente quando ogni valore è neutro: il generatore va per la strada di sempre. */
export function variationActive(p: VariationParams): boolean {
  return Math.abs(p.lati - 1) > 1e-9 || Math.abs(p.centro - 1) > 1e-9 || p.irregolarita > 0 || p.angoloMaxDeg > 0;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Rumore morbido 2D (value noise, due ottave), valori in [-1, 1], deterministico per seme. */
function rumore(seme: number): (x: number, y: number) => number {
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + seme * 982451653) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const uno = (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
    return lerp(lerp(h(i, j), h(i + 1, j), fx), lerp(h(i, j + 1), h(i + 1, j + 1), fx), fy);
  };
  return (x, y) => uno(x, y) * 0.7 + uno(x * 2.3 + 17, y * 2.3 + 5) * 0.3;
}

/**
 * Il campo delle variazioni su un'area larga `larghezza` (mm, dal bordo sinistro), per un pattern col
 * passo di colonna `passo` (mm). Le lunghezze d'onda della prova erano pensate sul punto nastro
 * (passo 2,2): qui scalano col passo.
 */
export function variationField(params: VariationParams, larghezza: number, passo: number): VariationField {
  const seme = Math.round(params.seme) * 7;
  const k = Math.max(0.1, passo / 2.2);
  const nDeriva = rumore(seme + 1), nRespiro = rumore(seme + 2), nLarghezza = rumore(seme + 3);
  const nAngolo = rumore(seme + 4), nPasso = rumore(seme + 5);
  const meta = Math.max(1e-6, larghezza / 2);
  return {
    params,
    scala: (x) => lerp(params.centro, params.lati, smooth(Math.min(1, Math.abs(x - meta) / meta))),
    deriva: (x, y) => nDeriva(x / (28 * k), y / (22 * k)),
    respiro: (x, y) => nRespiro(x / (11 * k), y / (11 * k)),
    larghezza: (x, y) => nLarghezza(x / (9 * k), y / (9 * k)),
    passoColonne: (x) => nPasso(x / (5 * k), 40),
    angolo: (x, y) => params.angoloMaxDeg * nAngolo(x / (16 * k), y / (16 * k)),
  };
}

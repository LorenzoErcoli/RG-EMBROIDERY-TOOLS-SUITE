// I tipi e i parametri del tool «Pelle di razza». Nessun DOM, nessuna logica: sta qui perche' il pannello,
// il worker, il motore e i test parlino della stessa cosa (R28: una sola definizione).
import type { Point, Polyline } from '@rg/core';

export type ModoCampo = 'bordo' | 'uniforme';
export type ModoAngolo = 'casuale' | 'percorso';
export type ModoPassaggio = 'diretto' | 'dentro' | 'scegli';

/** Un pallino che Lorenzo mette lui: posizione e diametro sono suoi, il resto del ricamo nasce da qui. */
export interface Fisso { x: number; y: number; diamMm: number }

/**
 * Una linea di sfumatura, come il gradiente di Illustrator: da A a B il diametro passa da `diamAMm` a
 * `diamBMm`. Prima di A vale quello di A, dopo B quello di B. Il verso e' A → B.
 */
export interface Sfumatura { a: Point; b: Point; diamAMm: number; diamBMm: number }

export interface ParametriRazza {
  seed: number;
  // — i pallini —
  /** Diametro del pallino piu' piccolo (lungo l'asse del cordoncino). Sotto i 3 mm diventa uno zig-zag: ricamato sembra un pallino. */
  diamMinMm: number;
  /** Diametro del pallino piu' grande. */
  diamMaxMm: number;
  /** Vuoto fra due pallini (negativo = si sovrappongono un poco). */
  gapMm: number;
  /** Larghezza / lunghezza del pallino (1 = tondo). */
  aspetto: number;
  /** Forma del profilo: 2 = ellisse, 1 = losanga, oltre 2 = piu' squadrato. */
  profilo: number;
  /** Irregolarita' del diametro, caso per caso (0 = esattamente quello del campo). */
  irregolarita: number;
  // — dove stanno piccoli e grandi —
  /** 'bordo' = piccoli ai bordi, grandi verso il centro; 'uniforme' = tutti della stessa misura (la media). */
  modoCampo: ModoCampo;
  /** Distanza dal bordo a cui i pallini arrivano al massimo. 0 = automatico (quanto e' profondo il pezzo). */
  profonditaMm: number;
  /** Curva della sfumatura: 1 = lineare; oltre 1 i pallini restano piccoli piu' a lungo vicino al bordo. */
  curvaBordo: number;
  /** Chiazze: quanto il campo si discosta dal cerchio perfetto attorno al centro (0 = niente). */
  rumoreCampo: number;
  /** Lunghezza d'onda delle chiazze. */
  scalaCampoMm: number;
  /** Se ci sono linee di sfumatura: quanto contano rispetto al bordo (1 = solo loro, 0 = le ignora). */
  pesoSfumature: number;
  /** Fino a che distanza da un pallino fisso la sua misura tira quella dei vicini. */
  influenzaFissiMm: number;
  // — il punto —
  /** Spaziatura fra le file del cordoncino (R22). */
  densitySpacingMm: number;
  /** Punto minimo (R3): nessun punto piu' corto di cosi'. */
  minStitchMm: number;
  /** Punto massimo (R4): vale anche per i passaggi. */
  maxStitchMm: number;
  // — i passaggi —
  modoAngolo: ModoAngolo;
  modoPassaggio: ModoPassaggio;
  /** Quanto costa, rispetto a un mm in vista (10), un mm di passaggio sopra un pallino gia' cucito. */
  pesoSopra: number;
  // — la posa —
  /** Margine dal bordo del pezzo. */
  margineMm: number;
  /** Di quanto un pallino puo' superare il campo crescendo per toccare i vicini (1 = mai). */
  crescita: number;
  /** Quanto puo' rimpicciolire un pallino rispetto al campo per entrare in un buco (1 = mai). */
  rapportoMinimo: number;
}

export const PARAMETRI_RAZZA: ParametriRazza = {
  seed: 1,
  diamMinMm: 2.4, diamMaxMm: 8, gapMm: 0, aspetto: 1, profilo: 2, irregolarita: 0.25,
  modoCampo: 'bordo', profonditaMm: 0, curvaBordo: 1, rumoreCampo: 0.25, scalaCampoMm: 40, pesoSfumature: 1, influenzaFissiMm: 25,
  densitySpacingMm: 0.4, minStitchMm: 0.8, maxStitchMm: 3,
  modoAngolo: 'percorso', modoPassaggio: 'scegli', pesoSopra: 3,
  margineMm: 0.3, crescita: 1.3, rapportoMinimo: 0.3,
};

/** Il pezzo da ricamare: un contorno e, dentro, le aree vuote (R5: li' non si ricama e il filo non passa). */
export interface Pezzo {
  contorno: Polyline;
  vuoti: Polyline[];
  minX: number; minY: number; maxX: number; maxY: number;
}

export interface Tondino {
  cx: number; cy: number;
  /** semi-lunghezza e semi-larghezza di progetto (prima del taglio ai capi) */
  a: number; b: number;
  ang: number; cos: number; sin: number;
  /** semi-lunghezza davvero cucita: li' la larghezza arriva al minimo */
  s0: number;
  /** messo da Lorenzo: non cresce, non si sposta */
  fisso?: boolean;
}

export type TipoPunto = 's' | 't'; // satin | passaggio

/** `prima` (solo per i passaggi): l'indice del tondino da cui si parte; `tond` e' quello dove si arriva. */
export interface PuntoCucito { p: Point; tond: number; tipo: TipoPunto; prima?: number; /** il segmento che ARRIVA qui e' un passaggio che resta in vista */ vista?: boolean }

export interface Misure {
  tondini: number;
  copertoPercento: number;
  punti: number;
  filoM: number;
  filoSatinM: number;
  filoPassaggiM: number;
  passaggi: number;
  passaggiMediana: number;
  passaggiMax: number;
  /** lunghezza dei passaggi per dove cadono: sotto un pallino da cucire, sopra uno gia' cucito, in vista sul fondo */
  sottoM: number; sopraM: number; vistaM: number;
  /** giunture il cui tragitto esce dalla sagoma o attraversa un vuoto */
  fuoriSagoma: number;
  /** quanto resta in vista, per ogni giuntura */
  vistaGiuntura: { mediana: number; p90: number; max: number; sotto06: number; oltre2: number; oltre5: number; giunture: number };
  puntiSottoMinimo: number;
  puntoMin: number; puntoMax: number;
  /** punti tolti dal minimo (R3) alle giunture */
  caduti: number;
  millisecondi: number;
}

export interface Risultato {
  par: ParametriRazza;
  pezzo: Pezzo;
  tondini: Tondino[];
  punti: PuntoCucito[];
  misure: Misure;
  /** cose che Lorenzo deve sapere: un fisso fuori dal pezzo, troppo piccolo per avere un corpo, ecc. */
  avvisi: string[];
}

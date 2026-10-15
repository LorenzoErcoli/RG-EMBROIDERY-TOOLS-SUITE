// Il contratto del motore (K1b, AVVIO-CERVELLO-RICAMO §3e).
//
// Ogni tool esporta da `apps/<tool>/src/motore.ts` un `motore: Motore` che AVVOLGE il motore che c'è: la
// stessa porta d'ingresso per tutti, così il pannello, il banco (K7), l'agente (K8) e i prodotti per i
// clienti chiamano tutti la stessa funzione. I tool importano questo file SOLO come tipo.
//
// Regole:
//  - `params` è lo stesso oggetto che il tool salva oggi nel file di progetto, coi nomi di oggi: niente rinomine.
//  - Quello che l'utente disegna a mano (celle del cross-stitch, zone pennellate della sfrangiatura, pallini
//    fissi della razza, ruoli dei colori…) è INGRESSO, non parametri: ogni tool lo dichiara estendendo `Ingresso`.
//  - Il motore gira in node: niente DOM, niente Worker. Se un tool usa un Worker, è il Worker che chiama `genera`.
//  - `busta` resta vuota: arriva con la K2 (busta di progetto). `misure` è il referto comune (K3).
import type { Contour, ExportLayer, Referto } from '@rg/core';

export type { Referto, RefertoAgo } from '@rg/core';

/** Un'immagine in ingresso: pixel RGBA, e quanti pixel fanno un millimetro (la misura reale, R11). */
export interface Immagine {
  larghezza: number;
  altezza: number;
  /** RGBA, 4 byte per pixel, riga per riga (come `ImageData.data`). */
  pixel: Uint8ClampedArray;
  pxPerMm: number;
}

/** Quello che ogni motore può ricevere. Un tool prende le parti che gli servono e ne aggiunge di proprie. */
export interface Ingresso {
  /** Il disegno vettoriale (contorni in mm, colore e ruolo). */
  sagoma?: Contour[];
  immagine?: Immagine;
  /** Un ricamo già cucito (DST), per i tool che ci lavorano sopra. */
  dst?: Uint8Array;
  /** Larghezza reale del pezzo in mm (R11), se non la dà la sagoma. */
  larghezzaMm?: number;
}

export interface Risultato {
  /** Gli strati da cucire, in ordine d'ago. */
  strati: ExportLayer[];
  /** Cosa il motore ha dovuto dire all'utente (scelte fatte, cose scartate): mai taciute. */
  avvisi: string[];
  /** K2: la busta di progetto. Vuota finché non c'è. */
  busta?: unknown;
  /**
   * K3: il referto comune, misurato dai byte del DST che il tool esporta davvero (`misuraDst`): sempre le stesse
   * misure, calcolate allo stesso modo. Il filo in vista c'è solo per i tool che lo calcolano.
   */
  misure?: Referto;
}

export interface Motore<I extends Ingresso = Ingresso, P extends object = Record<string, unknown>> {
  /** L'id del tool (quello di `TOOLS` e del registro dei parametri). */
  id: string;
  genera(ingresso: I, params: P): Promise<Risultato>;
}

// IL RIEMPIMENTO CONTINUO — un filo solo che entra da una parte ed esce dall'altra.
//
// Lorenzo: «prova a riempire la macchia in maniera continuativa partendo da un punto e arrivando
// all'altra parte, cercando di fare un raso piu' pulito possibile».
//
// E' il modo in cui si cuce un raso a mano e in cui lo cuce una macchina quando il disegno e' fatto
// bene: si arriva in fondo alla corsa, si gira, si torna indietro accanto a quella appena fatta, si
// gira di nuovo. Il filo non si stacca e non attraversa niente — il giro in fondo e' lungo quanto la
// spaziatura, cioe' tre decimi di millimetro.
//
// Fino a qui ogni corsa era un pezzo a se', e il compito di unirle era del routing. Il routing lo
// faceva bene — mediana dei salti 0,30 mm, esattamente la spaziatura — ma restava una cucitura
// dopo il fatto: una corsa su cinque restava orfana, e per raggiungerla il filo doveva tagliare
// dentro o costeggiare. Da li' venivano i fili tesi che Lorenzo ha visto. Se invece l'ordine e'
// gia' un cammino, non c'e' niente da ricucire.
//
// La rotaia le corse le consegna **gia' in fila**: la prima confina con la seconda per costruzione.
// Quindi qui non si cerca nessun ordine — si gira una corsa su due e si attacca. Quando pero' due
// corse vicine non si toccano davvero (la fascia si e' spezzata, un foro l'ha divisa, la frangia le
// ha accorciate in modo molto diverso) la catena si chiude e ne comincia un'altra: attaccarle lo
// stesso vorrebbe dire tirare un filo attraverso il vuoto, che e' proprio quello che si vuole
// togliere.
//
// Nessun DOM: entra una lista di corse ordinate, escono pochi tracciati continui.

import type { Point, Polyline } from '@rg/core';

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface SerpentinaResult {
  /** I tracciati continui: di solito uno per macchia, di piu' se la fascia si spezzava. */
  tracciati: Polyline[];
  /** Quante volte la catena si e' dovuta interrompere. Zero vuol dire un filo solo. */
  rotture: number;
  /** Il giro piu' lungo che si e' accettato di cucire, in mm. */
  giroMassimoMm: number;
}

/**
 * Unisce le corse in serpentina.
 *
 * `maxGiroMm` e' quanto puo' essere lungo il giro in fondo: sopra quella misura le due corse non si
 * toccano e la catena si spezza. Non e' una tolleranza da tarare a occhio — e' la domanda «queste
 * due corse sono vicine?», e la risposta la da' la spaziatura, piu' il gioco che la frangia
 * introduce accorciandole in modo diverso.
 */
export function serpentina(runs: Polyline[], maxGiroMm: number): SerpentinaResult {
  const tracciati: Polyline[] = [];
  let rotture = 0, giroMassimoMm = 0;
  let corrente: Point[] = [];

  for (const run of runs) {
    if (run.length < 2) continue;
    if (!corrente.length) { corrente = [...run]; continue; }

    const coda = corrente[corrente.length - 1];
    const dritta = dist(coda, run[0]);
    const girata = dist(coda, run[run.length - 1]);
    const giro = Math.min(dritta, girata);

    if (giro > maxGiroMm) {
      tracciati.push(corrente);
      corrente = [...run];
      rotture++;
      continue;
    }

    // si entra dal capo piu' vicino: e' cosi' che il giro resta corto quanto la spaziatura
    const pezzo = dritta <= girata ? run : [...run].reverse();
    if (giro > giroMassimoMm) giroMassimoMm = giro;
    // se i due capi coincidono non si ripete il punto: due punti nello stesso buco sono vietati (R3)
    corrente.push(...(giro < 1e-9 ? pezzo.slice(1) : pezzo));
  }
  if (corrente.length >= 2) tracciati.push(corrente);
  return { tracciati, rotture, giroMassimoMm };
}

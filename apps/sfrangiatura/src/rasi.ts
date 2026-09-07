// LE FILE DI RASO DENTRO UN BLOCCO, E I LORO CAPI.
//
// Il DST non sa cosa sia un raso: è una sequenza di punti. Ma un raso da parete a parete lascia una
// firma inconfondibile — il filo attraversa la colonna, INVERTE marcia sul bordo, e riattraversa. I
// capi sono le inversioni, e sono esattamente i punti che questo tool deve allungare.
//
// La soglia dell'inversione non è una scelta a occhio: misurata sui 42 rasi del ricamo di Lorenzo,
// la svolta dei punti è **bimodale con un deserto in mezzo** — il 79% dei punti gira meno di 10°
// (sta proseguendo lungo la fila, che il punto massimo ha suddiviso), il 14% gira più di 150°
// (inverte), e **fra 50° e 130° non c'è praticamente nulla**. Qualunque soglia da 90° a 135° dà gli
// stessi identici capi: 1.280 sul blocco di prova. Il default è 90°, in mezzo al deserto.
//
// I capi si alternano fra i due bordi della colonna: `lato` 0, 1, 0, 1… È la struttura che serve per
// sfrangiare **un lato solo** — quello che guarda verso la macchia vicina — senza toccare l'altro.

import type { Point } from '@rg/core';

export interface Capo {
  /** Indice del punto dentro il blocco: è la coordinata da modificare. */
  indice: number;
  /** Dove sta il capo, in mm. */
  punto: Point;
  /** Bordo di appartenenza: i capi si alternano fra i due lati della colonna di raso. */
  lato: 0 | 1;
  /**
   * Versore lungo cui la frangia deve proseguire: è la direzione della FILA, cioè del più lungo dei
   * due segmenti che si incontrano nel capo, orientato verso l'esterno.
   *
   * Non è sempre il segmento entrante, e il test l'ha dimostrato: in una serpentina metà dei capi si
   * raggiungono col micro-collegamento fra una fila e l'altra (0,4 mm, di traverso). Prendendo
   * l'entrante, quelle frange sarebbero partite lungo il bordo invece che fuori dalla macchia.
   */
  direzione: Point;
  /** Lunghezza della fila a cui il capo appartiene: il più lungo dei due segmenti che ci si incontrano. */
  filaMm: number;
}

export interface LetturaRaso {
  /** I capi in ordine di cucitura, estremi del blocco compresi. */
  capi: Capo[];
  /** Punti totali del blocco (per chi deve riscriverlo). */
  punti: number;
}

export interface LeggiRasoOptions {
  /** Oltre questa svolta il punto è un'inversione, cioè un capo. Default 80°: dentro il deserto, ma NON a 90 esatti — il collegamento fra due file di raso e' proprio un angolo retto, e sulla soglia esatta il riconoscimento dipenderebbe dall'arrotondamento. */
  sogliaInversioneDeg?: number;
  /** Sotto questa lunghezza due capi consecutivi non delimitano una fila vera. Default 0,5 mm. */
  filaMinimaMm?: number;
}

const versore = (dx: number, dy: number): Point => {
  const l = Math.hypot(dx, dy);
  return l > 1e-12 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 };
};

/**
 * Trova i capi delle file di raso in un blocco cucito (i punti di `readDst`, in mm e in ordine).
 * Non modifica niente: legge e basta. Un blocco che non è un raso (una corsa, una fermatura) dà
 * semplicemente i suoi due estremi, che è la risposta giusta: non ci sono file da sfrangiare.
 */
export function leggiRaso(punti: Point[], opts: LeggiRasoOptions = {}): LetturaRaso {
  const soglia = Math.cos(((opts.sogliaInversioneDeg ?? 80) * Math.PI) / 180);
  const filaMin = opts.filaMinimaMm ?? 0.5;
  const n = punti.length;
  if (n < 2) return { capi: [], punti: n };

  // gli indici delle inversioni, più i due estremi del blocco (dove il filo comincia e finisce)
  const indici: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    const a = punti[i - 1], b = punti[i], c = punti[i + 1];
    const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-9 || lv < 1e-9) continue;
    // cos della svolta: −1 = inversione secca, +1 = dritto. Sotto la soglia = ha invertito.
    if ((ux * vx + uy * vy) / (lu * lv) < soglia) indici.push(i);
  }
  indici.push(n - 1);

  const capi: Capo[] = [];
  let lato: 0 | 1 = 0;
  for (let k = 0; k < indici.length; k++) {
    const i = indici[k];
    const p = punti[i];
    const prev = k > 0 ? punti[indici[k - 1]] : null;
    const passo = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
    // Un tratto troppo corto non è una traversata: è il collegamento fra due file sullo stesso bordo.
    // Il capo resta (il punto esiste) ma non fa cambiare lato, altrimenti l'alternanza si sfasa.
    if (k > 0 && passo >= filaMin) lato = lato === 0 ? 1 : 0;

    // La fila del capo è il PIÙ LUNGO dei due segmenti che vi si incontrano, e la frangia prosegue
    // di lì, verso l'esterno: se il più lungo è quello entrante si tira dritto, se è quello uscente
    // si torna indietro lungo di esso. Sul segmento corto (il collegamento) la frangia andrebbe di
    // traverso, cioè lungo il bordo invece che fuori.
    const a = i > 0 ? punti[i - 1] : null;
    const b = i < n - 1 ? punti[i + 1] : null;
    const lIn = a ? Math.hypot(p.x - a.x, p.y - a.y) : 0;
    const lOut = b ? Math.hypot(b.x - p.x, b.y - p.y) : 0;
    const dir = lIn >= lOut && a ? versore(p.x - a.x, p.y - a.y) : b ? versore(p.x - b.x, p.y - b.y) : { x: 0, y: 0 };
    capi.push({ indice: i, punto: p, lato, direzione: dir, filaMm: Math.max(lIn, lOut) });
  }
  return { capi, punti: n };
}

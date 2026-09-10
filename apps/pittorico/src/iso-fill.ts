// IL RIEMPIMENTO PER CURVE DI LIVELLO — il raso che curva e resta omogeneo, per costruzione.
//
// Lorenzo, dopo aver guardato il ricamo: «non ci siamo. Se ricamo questa cosa viene un casino, un
// sacco di addensamenti. Bisogna trovare un modo che permetta al filo di riempire in modo omogeneo
// le aree senza creare sovrapposizioni ne' buchi. Partiamo da creare riempimenti con raso che curva
// ma che sia omogeneo. Come possiamo farlo?».
//
// IL DIFETTO DEL METODO PRECEDENTE, ED E' STRUTTURALE. Sia il riempimento a distanza costante che
// quello dalla rotaia **tracciano le corse e poi sperano**: i punti nascono a distanza giusta — sui
// semi o sulla rotaia — e da li' ognuno se ne va per conto suo seguendo il campo di direzione. Ma un
// campo di direzione non conserva la distanza: dove converge le corse si accavallano, dove diverge
// si aprono. Il cuneo e la troncatura sono due toppe su questa perdita, una per lato, e non possono
// chiuderla — infatti la coda della densita' non si chiudeva: 17% di celle sopra il 150% del
// chiesto, e l'82% di quelle addossate al bordo.
//
// L'IDEA. Non si tracciano le corse: si costruisce una funzione, e le corse sono le sue **curve di
// livello**.
//
// Dentro la macchia si calcola una DISTANZA, e poi se ne prendono le curve di livello a multipli
// della spaziatura: 0,3 mm · 0,6 · 0,9 e cosi' via. Due livelli consecutivi distano esattamente la
// spaziatura **ovunque**, perche' e' la definizione stessa di curva di livello di una distanza: il
// gradiente di una distanza ha modulo uno, sempre. Non e' una taratura riuscita bene, e' una
// garanzia geometrica.
//
// MA QUALE DISTANZA. Non quella normale. Se si misurasse il cammino nel modo consueto, le curve di
// livello sarebbero i contorni paralleli al bordo, e il punto correrebbe LUNGO la fascia invece di
// attraversarla — il contrario di quello che serve, perche' il punto deve stare perpendicolare alla
// transizione di colore.
//
// Quindi si misura **solo la componente trasversale al punto**: muoversi lungo la direzione di
// cucitura non costa niente, muoversi di traverso costa per intero. Con questa misura:
//
//   * le curve di livello corrono LUNGO la direzione del punto — sono le corse;
//   * due curve vicine distano la spaziatura misurata DI TRAVERSO, che e' esattamente la distanza
//     fra due punti di raso;
//   * e basta un SEME SOLO. Siccome camminare lungo il punto e' gratis, il fronte si allunga da
//     solo per tutta la corsa che passa per il seme, e poi avanza di lato. Non serve una testata —
//     ed e' quello che ha fatto fallire il primo tentativo: qui le macchie sono circondate da altri
//     colori su tutti i lati, e testate non ne hanno (0-2 vertici liberi su 52).
//
// COSA HA DETTO LA MISURA, ed e' il motivo per cui questo motore c'e' ma NON e' quello acceso.
//
// Sul ritaglio vero, contro il metodo tracciato:
//
//                     p5      mediana        p95    celle sopra il 150%
//   tracciato        2,25   104% del chiesto  9,55        24%
//   iso              1,17    92%              6,66        14%
//
// Il troppo pieno lo toglie davvero — ed e' quello che si voleva. Ma apre i buchi: il p5 crolla da
// 2,25 a 1,17, cioe' un terzo del filo promesso, e la mediana scende sotto il chiesto. Un buco in un
// raso e' peggio di un addensamento: l'addensamento si vede, il buco fa passare il tessuto.
//
// E il perche' non e' un difetto da sistemare, e' un limite geometrico. Un campo di direzione
// qualunque **non ammette** una famiglia di curve che lo seguono e stanno tutte a distanza costante:
// esiste solo se il campo e' «parallelo», e i campi che nascono da un disegno non lo sono. Dove la
// pretesa e' impossibile la soluzione sviluppa uno scontro fra fronti, e li' il livello si spezza:
// **142 livelli su 142 spezzati**, cioe' sempre. Ho provato ad abbassare il costo di camminare
// lungo il punto (0,05 -> 0,01 -> 0,002: peggiora, mediana dall'92 al 77%) e ad allargare lo stencil
// da 8 a 32 direzioni per rappresentare meglio l'anisotropia (peggiora ancora). Non e' la taratura.
//
// Quindi resta qui, misurato e spento, per due motivi: perche' la diagnosi vale piu' del codice — ci
// dice che «omogeneo E perpendicolare» non si possono avere tutti e due, e che quindi la strada e'
// aggiustare la densita' sul tracciato, non sostituirlo — e perche' su forme diverse da queste (una
// fascia vera con due testate, dove il campo E' quasi parallelo) puo' invece essere la scelta giusta.
//
// Cosa ne consegue, e sono tutte cose che prima si dovevano rincorrere:
//
//   * il filo per mm² e' 1/spaziatura ovunque. Dove la fascia si allarga la curva si allunga, dove
//     si stringe si accorcia: e' la LUNGHEZZA della corsa a cambiare, non la distanza fra le corse.
//     Niente cunei da infilare, niente punti da troncare;
//   * le corse escono gia' NUMERATE, 0, 1, 2, ... — quindi l'ordine non si cerca, c'e'; e la
//     serpentina e' esatta invece che ricostruita;
//   * la corsa e' perpendicolare al fronte che avanza. Seminando sulla testata, il fronte avanza
//     LUNGO la fascia e le curve la attraversano: e' il punto perpendicolare alla transizione di
//     colore che Lorenzo chiede dall'inizio, e qui viene dalla costruzione invece che da un campo
//     armonico da diffondere.
//
// IL PREZZO, detto subito. Dove due fronti si scontrano — l'asse mediano di una forma, il punto in
// cui la fascia si richiude dopo un foro — una curva di livello si spezza in due pezzi. E' onesto:
// li' il ricamo cambia davvero verso, e un raso vero fa la stessa cosa. Ma vuol dire che una
// macchia non da' sempre un filo solo.
//
// Nessun DOM: entra una regione e delle curve di partenza, escono le corse in ordine.

import {
  type Point, type Polyline, type Region, resampleUniform,
} from '@rg/core';
import { regionBounds, rasterizza, livello, incatena } from '@rg/core';
import type { DirectionField } from './field';

export interface IsoFillOptions {
  /** Distanza fra due corse (R22 `densitySpacingMm`). E' il passo fra due livelli. */
  spacingMm: number;
  /** Passo massimo lungo la corsa (R4). */
  maxStitchMm?: number;
  /**
   * Lato della cella con cui si misura la distanza. Default: mezzo passo.
   *
   * E' la risoluzione con cui si conosce il fronte, quindi decide l'errore sulla spaziatura: con
   * celle grandi quanto il passo, il livello estratto puo' sbagliare di mezza cella e la promessa
   * salta. Mezzo passo tiene l'errore sotto un quarto di spaziatura.
   */
  cellMm?: number;
  /**
   * Quanto costa muoversi LUNGO il punto, in frazione del costo di traverso. Default 0,05.
   *
   * In teoria dovrebbe essere zero — lungo il punto non ci si allontana da niente. Ma con zero il
   * problema e' degenere: il fronte correrebbe all'infinito lungo una linea di campo senza mai
   * pagare, e su un campo che gira su se stesso non si assesterebbe. Un cinque percento tiene il
   * conto ben posto e sposta i livelli di una frazione di cella.
   */
  costoLungoIlPunto?: number;
}

export interface IsoFillResult {
  /** Le corse, **in ordine di livello**: la prima confina con la seconda per costruzione. */
  runs: Polyline[];
  /** Quanti livelli sono stati estratti. */
  livelli: number;
  /** Quante volte un livello si e' spezzato in piu' pezzi: sono gli scontri fra fronti. */
  spezzati: number;
  /** La distanza massima raggiunta dal fronte, in mm: quanto e' lunga la macchia da percorrere. */
  profonditaMm: number;
}

/**
 * La macchia disegnata su griglia, con la regola pari-dispari: dentro il guscio e fuori dai fori.
 *
 * Si rasterizza a scansione invece di chiedere `pointInRegion` cella per cella: su una macchia da
 * 35 cm le celle sono milioni, e una domanda per cella vorrebbe dire milioni di attraversamenti del
 * poligono. A scansione ogni riga costa un ordinamento di pochi incroci.
 */
function distanzaAnisotropa(
  dentro: Uint8Array, D: Float32Array, nx: Float32Array, ny: Float32Array,
  cols: number, rows: number, cella: number, lungo: number,
): void {
  /*
   * LO STENCIL, e non e' un dettaglio: gli otto vicini non bastano.
   *
   * Con otto passi le direzioni rappresentabili sono otto, a 45 gradi l'una dall'altra. Su una
   * distanza normale l'errore che ne viene e' qualche percento. Ma qui il costo di un passo dipende
   * dalla DIREZIONE, e nel rapporto di venti a uno: se il punto corre a 22 gradi, nessuna
   * combinazione di passi a 0 e 45 gradi lo segue davvero, e quella corsa la si paga come se fosse
   * di traverso. Il fronte allora si deforma, i livelli si spezzano, e nel filo si aprono i buchi —
   * misurato: mediana al 92% del chiesto, un livello su 162 intero.
   *
   * Con tutti i passi fino a tre celle e componenti prime fra loro, le direzioni diventano oltre
   * trenta, e l'errore angolare scende sotto i sei gradi. Costa piu' o meno quattro volte tanto per
   * spazzata, ed e' il prezzo giusto: e' l'unica cosa che rende vera la promessa di omogeneita'.
   */
  const passi: Array<[number, number]> = [];
  const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b));
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (mcd(Math.abs(dx), Math.abs(dy)) !== 1) continue;   // (2,2) e' (1,1) percorso due volte
      passi.push([dx, dy]);
    }
  }
  const costo = (i: number, dx: number, dy: number): number => {
    // la componente del passo perpendicolare al punto: e' quella che allontana da una corsa
    const trasv = Math.abs(dx * nx[i] + dy * ny[i]);
    return (trasv + lungo * Math.hypot(dx, dy)) * cella;
  };
  for (let giro = 0; giro < 60; giro++) {
    let cambiato = false;
    for (let dir = 0; dir < 2; dir++) {
      const r0 = dir === 0 ? 0 : rows - 1, r1 = dir === 0 ? rows : -1, dr = dir === 0 ? 1 : -1;
      const c0 = dir === 0 ? 0 : cols - 1, c1 = dir === 0 ? cols : -1, dc = dir === 0 ? 1 : -1;
      for (let r = r0; r !== r1; r += dr) {
        for (let c = c0; c !== c1; c += dc) {
          const i = r * cols + c;
          if (!dentro[i]) continue;
          for (const [ux, uy] of passi) {
            const cc = c + ux, rr = r + uy;
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            const j = rr * cols + cc;
            if (!dentro[j] || D[j] === Infinity) continue;
            const v = D[j] + costo(i, ux, uy);
            if (v < D[i] - 1e-9) { D[i] = v; cambiato = true; }
          }
        }
      }
    }
    if (!cambiato) break;
  }
}

/** Un segmento della curva di livello dentro una cella, in coordinate del mondo. */
const lunghezza = (l: Polyline): number => {
  let m = 0;
  for (let i = 1; i < l.length; i++) m += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y);
  return m;
};

/**
 * Il riempimento: le curve di livello della distanza anisotropa da un seme.
 *
 * `campo` da' la direzione del punto in ogni posizione — e' lo stesso campo armonico di prima,
 * perpendicolare dove il colore cambia e libero sulle testate. `seme` e' da dove parte il fronte: un
 * punto basta, perche' lungo il punto camminare non costa niente e il fronte si allunga da solo.
 */
export function buildIsoFill(
  region: Region, campo: DirectionField, seme: Point, opts: IsoFillOptions,
): IsoFillResult {
  const passo = opts.spacingMm;
  const vuoto: IsoFillResult = { runs: [], livelli: 0, spezzati: 0, profonditaMm: 0 };
  if (!(passo > 0)) return vuoto;

  const cella = Math.max(1e-3, opts.cellMm ?? passo / 2);
  const bb = regionBounds(region);
  const margine = cella * 2;
  const x0 = bb.minX - margine, y0 = bb.minY - margine;
  const cols = Math.ceil((bb.maxX - bb.minX + margine * 2) / cella);
  const rows = Math.ceil((bb.maxY - bb.minY + margine * 2) / cella);
  if (cols < 3 || rows < 3 || cols * rows > 40e6) return vuoto;

  const dentro = rasterizza(region, x0, y0, cols, rows, cella);
  let quante = 0;
  for (let i = 0; i < dentro.length; i++) if (dentro[i]) quante++;
  if (!quante) return vuoto;

  // la perpendicolare al punto, cella per cella: e' lei che dice quanto costa un passo
  const nx = new Float32Array(cols * rows), ny = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!dentro[i]) continue;
      const d = campo.dirAt({ x: x0 + (c + 0.5) * cella, y: y0 + (r + 0.5) * cella });
      nx[i] = -d.y; ny[i] = d.x;
    }
  }

  const D = new Float32Array(cols * rows).fill(Infinity);
  const cs = Math.round((seme.x - x0) / cella - 0.5), rs = Math.round((seme.y - y0) / cella - 0.5);
  let piantato = false;
  if (cs >= 0 && rs >= 0 && cs < cols && rs < rows && dentro[rs * cols + cs]) {
    D[rs * cols + cs] = 0; piantato = true;
  }
  if (!piantato) {
    // il seme chiesto non e' dentro: si pianta nella prima cella utile, il fronte copre lo stesso
    for (let i = 0; i < dentro.length && !piantato; i++) if (dentro[i]) { D[i] = 0; piantato = true; }
  }
  if (!piantato) return vuoto;

  distanzaAnisotropa(dentro, D, nx, ny, cols, rows, cella, opts.costoLungoIlPunto ?? 0.05);

  let massimo = 0;
  for (let i = 0; i < D.length; i++) if (dentro[i] && D[i] < Infinity && D[i] > massimo) massimo = D[i];
  if (!(massimo > passo)) return vuoto;

  /*
   * I livelli. Si comincia a mezzo passo dal seme e si va avanti di un passo alla volta. Il seme
   * puo' stare in mezzo alla macchia, quindi il fronte cresce da tutt'e due i lati e i livelli
   * coprono l'intera profondita' raggiunta.
   */
  const runs: Polyline[] = [];
  let livelli = 0, spezzati = 0;
  /*
   * Il pezzo minimo che vale la pena tenere. Tenuto BASSO apposta: un frammento corto e' comunque
   * filo che il ricamo si aspetta, e buttarlo apre un buco proprio dove il livello era gia' in
   * difficolta'. Si scarta solo quello che non regge nemmeno un punto.
   */
  const minima = passo;
  for (let d = passo / 2; d <= massimo; d += passo) {
    const segs = livello(D, dentro, cols, rows, x0, y0, cella, d);
    if (!segs.length) continue;
    const catene = incatena(segs, cella * 0.75).filter((c) => lunghezza(c) >= minima);
    if (!catene.length) continue;
    livelli++;
    if (catene.length > 1) spezzati++;
    // dentro un livello i pezzi si mettono in fila: sono i due lati di uno scontro fra fronti, e
    // saltare dall'uno all'altro deve costare il meno possibile
    catene.sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);
    for (const c of catene) {
      runs.push(opts.maxStitchMm && opts.maxStitchMm > 0 ? resampleUniform(c, opts.maxStitchMm) : c);
    }
  }
  return { runs, livelli, spezzati, profonditaMm: massimo };
}

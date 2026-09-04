// Punto 4 — I BORDI: dove il colore sfuma e dove stacca.
//
// È il pezzo che fa il degradé, e la decisione di Lorenzo dice come: **col frastaglio del bordo, non
// con una texture**. Un riempimento pieno i cui *capi* hanno lunghezza variabile, più la
// sovrapposizione fra blocchi adiacenti. Dove il colore stacca netto, invece, il riempimento si
// ferma secco.
//
// Tre cose, e sono separate apposta:
//
// 1. **Quanto è largo il passaggio** fra due tinte, in millimetri. È la misura che decide tutto il
//    resto, e si prende sull'immagine ORIGINALE: dopo la riduzione la sfumatura non c'è più, è
//    diventata una scaletta di tinte piatte. Si cammina di traverso al bordo e si guarda quanti
//    millimetri servono perché la luce passi dal livello di una tinta a quello dell'altra.
// 2. **La crescita di 5 mm** verso i colori che verranno cuciti dopo (decisione 2 di Lorenzo: chi sta
//    sotto è abbondante, chi va sopra ci si appoggia). Si fa sulla MASCHERA, non sul poligono:
//    ingrandire un poligono con le rientranze e i fori è un problema pieno di casi limite, mentre sui
//    pixel è una distanza e basta — e la maschera è la stessa rappresentazione da cui le regioni
//    nascono.
// 3. **Il frastaglio**: i capi delle file si ritirano di una quantità variabile, decisa dalla
//    posizione. Due riempimenti che si affacciano sullo stesso bordo si ritirano *ognuno per conto
//    suo*, e nell'intreccio dei capi nasce il degradé.

import { type Point, type Polyline, type PixelImage } from '@rg/core';

// ---------------------------------------------------------------------------------------------
// 1. Quanto è largo il passaggio
// ---------------------------------------------------------------------------------------------

const luminanza = (img: PixelImage, i: number): number =>
  0.2126 * img.rgba[i * 4] + 0.7152 * img.rgba[i * 4 + 1] + 0.0722 * img.rgba[i * 4 + 2];

/** Luminanza campionata a coordinate frazionarie, bilineare. Fuori dall'immagine: null. */
function luceIn(img: PixelImage, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x > img.width - 1.001 || y > img.height - 1.001) return null;
  const i = Math.floor(x), j = Math.floor(y);
  const tx = x - i, ty = y - j;
  const l = (a: number, b: number): number => a + (b - a) * tx;
  return (
    l(luminanza(img, j * img.width + i), luminanza(img, j * img.width + i + 1)) * (1 - ty) +
    l(luminanza(img, (j + 1) * img.width + i), luminanza(img, (j + 1) * img.width + i + 1)) * ty
  );
}

export interface Transizione {
  /** Millimetri per passare dal 10% al 90% del salto di luce. */
  larghezzaMm: number;
  /** Di quanto salta la luce, su 255. Sotto una certa soglia non c'è un bordo da misurare. */
  saltoLuce: number;
}

/**
 * Quanto è largo il passaggio di colore attraversando il bordo in `p` lungo la normale `n`.
 *
 * Si campiona un profilo di luce da un lato all'altro, si prendono i due **altipiani** (la media del
 * primo e dell'ultimo quinto) e si misura quanto si cammina per passare dal 10% al 90% del salto fra
 * loro. È la misura standard della larghezza di un bordo, e qui vuol dire una cosa sola: **quanti
 * millimetri di ricamo devono compenetrarsi** perché il degradé sia quello del disegno.
 *
 * Torna `null` dove non c'è un salto vero: due tinte quasi uguali, o un bordo che il campione ha
 * mancato.
 */
export function larghezzaTransizione(
  img: PixelImage, mmPerPx: number, p: Point, n: Point,
  opts: { raggioMm?: number; saltoMinimo?: number } = {},
): Transizione | null {
  const raggio = (opts.raggioMm ?? 8) / mmPerPx;
  const saltoMinimo = opts.saltoMinimo ?? 25;
  const passi = Math.max(12, Math.round(raggio * 2));
  const prof: number[] = [];
  for (let k = 0; k <= passi; k++) {
    const t = -raggio + (2 * raggio * k) / passi;
    const v = luceIn(img, p.x / mmPerPx + n.x * t, p.y / mmPerPx + n.y * t);
    if (v === null) return null;
    prof.push(v);
  }
  const quinto = Math.max(1, Math.round(prof.length / 5));
  const media = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
  const basso = media(prof.slice(0, quinto));
  const alto = media(prof.slice(-quinto));
  const salto = alto - basso;
  if (Math.abs(salto) < saltoMinimo) return null;

  /**
   * Il profilo normalizzato: 0 sull'altipiano di partenza, 1 su quello d'arrivo, comunque sia
   * orientato il salto. Così i due livelli si cercano **nello stesso verso**, ed è la correzione di
   * un errore che rendeva la misura inutile: cercavo il 90% partendo dal lato dove il profilo è già
   * alto, quindi lo trovavo al primo campione e la larghezza usciva quasi sempre uguale alla
   * finestra. Tarata su rampe di larghezza nota, dava 12,00 mm per un gradino netto e 15,88 per una
   * rampa da 10 mm — cioè non misurava il bordo, misurava la finestra.
   */
  const norm = prof.map((v) => (v - basso) / salto);
  const primaSopra = (q: number): number | null => {
    for (let i = 0; i < norm.length; i++) {
      if (norm[i] >= q) return (-raggio + (2 * raggio * i) / passi) * mmPerPx;
    }
    return null;
  };
  const x10 = primaSopra(0.1);
  const x90 = primaSopra(0.9);
  if (x10 === null || x90 === null || x90 < x10) return null;
  return { larghezzaMm: x90 - x10, saltoLuce: Math.abs(salto) };
}

// ---------------------------------------------------------------------------------------------
// 2. La crescita verso i colori che vengono dopo
// ---------------------------------------------------------------------------------------------

/**
 * Ingrandisce la maschera della tinta `tinta` di `crescitaMm`, ma **solo dentro i pixel delle tinte
 * che verranno cucite dopo di lei**. Verso quelle già cucite resta al proprio bordo.
 *
 * È la decisione 2 di Lorenzo, tradotta in geometria: chi sta sotto è abbondante, chi va sopra ci si
 * appoggia. Così alle giunte non restano buchi, e il degradé nasce dall'intreccio delle frange
 * invece che da un accostamento preciso che in macchina non esiste.
 *
 * Si lavora sulla maschera e non sul poligono: ingrandire un poligono con rientranze e fori è pieno
 * di casi limite — sulle punte acute l'incrocio dei lati schizza lontano, ed è un difetto che questa
 * suite ha già incontrato e misurato in `zone-pattern`. Sui pixel è una distanza e basta.
 */
export function cresciVersoISuccessivi(
  index: Uint8Array, width: number, height: number,
  tinta: number, ordine: number[], mmPerPx: number, crescitaMm: number,
  /**
   * Dove è lecito crescere: 1 = qui il colore sfuma. Se non si passa, si cresce ovunque.
   *
   * Serve perché **sul bordo netto non si cresce**: se il blocco scavalca un taglio secco, il taglio
   * smette di staccare preciso — ed è la prima cosa che Lorenzo ha chiesto guardando l'anteprima
   * (*«sul bordo netto vorrei rimanesse tutto netto, colore che stacca preciso»*). La crescita di
   * 5 mm serve a far intrecciare le frange, e le frange stanno solo dove c'è una sfumatura da fare.
   */
  soloDoveSfuma?: Uint8Array | null,
): Uint8Array {
  const raggio = crescitaMm / mmPerPx;
  const mia = new Uint8Array(index.length);
  for (let i = 0; i < index.length; i++) if (index[i] === tinta) mia[i] = 1;
  if (!(raggio >= 1)) return mia;

  const posizione = ordine.indexOf(tinta);
  const dopo = new Set(ordine.slice(posizione + 1));

  // distanza dal proprio pieno, a due passate (chamfer 3-4): basta e avanza per un raggio in pixel
  const INF = 1 << 20;
  const d = new Int32Array(index.length).fill(INF);
  for (let i = 0; i < index.length; i++) if (mia[i]) d[i] = 0;
  const guarda = (i: number, j: number, costo: number): void => {
    if (d[j] + costo < d[i]) d[i] = d[j] + costo;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) guarda(i, i - 1, 3);
      if (y > 0) guarda(i, i - width, 3);
      if (x > 0 && y > 0) guarda(i, i - width - 1, 4);
      if (x < width - 1 && y > 0) guarda(i, i - width + 1, 4);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) guarda(i, i + 1, 3);
      if (y < height - 1) guarda(i, i + width, 3);
      if (x < width - 1 && y < height - 1) guarda(i, i + width + 1, 4);
      if (x > 0 && y < height - 1) guarda(i, i + width - 1, 4);
    }
  }

  const soglia = raggio * 3;
  const fuori = new Uint8Array(index.length);
  for (let i = 0; i < index.length; i++) {
    const puo = !soloDoveSfuma || soloDoveSfuma[i] === 1;
    fuori[i] = mia[i] || (puo && d[i] <= soglia && dopo.has(index[i])) ? 1 : 0;
  }
  return fuori;
}

// ---------------------------------------------------------------------------------------------
// 3. Il frastaglio
// ---------------------------------------------------------------------------------------------

/** Disturbo in [0,1) deciso dalla posizione: deterministico, e identico su ogni motore. */
function disturbo(x: number, y: number, scalaMm: number): number {
  const ix = Math.round(x / scalaMm) | 0, iy = Math.round(y / scalaMm) | 0;
  let a = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

export interface FrastaglioOptions {
  /** Lunghezza massima della frangia, in mm. È il parametro di pannello (decisione 3). */
  frangiaMm: number;
  /** Quanto è grossa la grana della frangia: due capi entro questa distanza si ritirano uguale. */
  granaMm?: number;
  /**
   * Il confine che il ritiro **non deve superare**: `true` = qui siamo già nel corpo del colore.
   *
   * È la correzione del difetto che Lorenzo ha visto per primo (*«non mi sembra molto elegante il
   * modo di fare sfumature, ci sono davvero un sacco di buchi»*), e la ragione è geometrica, non
   * estetica: nel ricamo vero le frange **sporgono oltre** il blocco di colore — per questo la
   * regione cresce di 5 mm prima di essere riempita — mentre io ritiravo i capi *dentro*. Dove il
   * blocco non era cresciuto (bordo netto, oppure l'ultima tinta, che non ha nessuno sotto cui
   * infilarsi) il ritiro mangiava il riempimento, e fra due blocchi che si ritiravano entrambi
   * restava un buco.
   *
   * Con questo confine la frangia vive **solo nel margine cresciuto**: la punta di ogni file cade
   * fra il bordo vero del colore e i 5 mm di sconfinamento, mai più indietro. Il blocco arriva
   * sempre almeno al proprio bordo, quindi buchi non se ne aprono.
   */
  restaFuoriDa?: (p: Point) => boolean;
}

/**
 * Ritira i capi delle file di una quantità variabile, così il bordo del riempimento diventa una
 * frangia invece di una linea.
 *
 * Si tocca solo il capo che sta **sul bordo da sfumare**: `daSfumare` dice, per un punto, se quel
 * tratto di bordo è un passaggio morbido. Un capo che finisce contro un bordo netto — o in mezzo
 * alla forma, perché la fila si è fermata contro un'altra fila — non si tocca.
 *
 * Il ritiro è deciso dalla POSIZIONE, non dal caso: due riempimenti che si affacciano sullo stesso
 * bordo si ritirano ognuno per conto suo (hanno capi in posti diversi) ma ciascuno in modo ripetibile,
 * e stessi parametri danno sempre lo stesso ricamo (§7).
 */
export function frastaglia(
  runs: Polyline[], daSfumare: (p: Point) => boolean, opts: FrastaglioOptions,
): Polyline[] {
  const frangia = opts.frangiaMm;
  if (!(frangia > 0)) return runs.map((r) => r.slice());
  const grana = opts.granaMm ?? Math.max(frangia / 2, 0.5);

  return runs.map((run) => {
    if (run.length < 2) return run.slice();
    let corsa = run.slice();
    for (const daCapo of [true, false]) {
      const capo = daCapo ? corsa[0] : corsa[corsa.length - 1];
      if (!daSfumare(capo)) continue;
      const voluto = frangia * disturbo(capo.x, capo.y, grana);
      const ritiro = opts.restaFuoriDa ? Math.min(voluto, quantoSiPuoRitirare(corsa, daCapo, opts.restaFuoriDa)) : voluto;
      if (ritiro <= 0) continue;
      corsa = ritiraCapo(corsa, ritiro, daCapo);
      if (corsa.length < 2) return corsa;
    }
    return corsa;
  }).filter((r) => r.length >= 2);
}

/**
 * Di quanto ci si può ritirare da un capo prima di entrare nel corpo del colore: si cammina
 * indietro finché `dentro` dice di sì, e ci si ferma lì.
 */
function quantoSiPuoRitirare(
  linea: Polyline, daCapo: boolean, dentro: (p: Point) => boolean, passoMm = 0.2,
): number {
  const l = daCapo ? linea.slice() : linea.slice().reverse();   // l[0] è il capo da cui si ritira
  // Si cammina LUNGO il filo, non di vertice in vertice: coi punti-ago a 3 mm l'uno dall'altro (R4)
  // il limite si quantizzerebbe a scatti di 3 mm, e su una fila di due soli punti verrebbe zero —
  // cioè la frangia non varierebbe affatto. Trovato da un test che pretendeva che variasse.
  let percorso = 0;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-9) continue;
    const passi = Math.max(1, Math.ceil(seg / passoMm));
    for (let k = 1; k <= passi; k++) {
      const t = k / passi;
      if (dentro({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return percorso + (seg * (k - 1)) / passi;
    }
    percorso += seg;
  }
  return percorso;
}

/** Accorcia la polilinea di `mm` da un capo, tagliando esattamente alla misura. */
function ritiraCapo(linea: Polyline, mm: number, daCapo: boolean): Polyline {
  if (mm <= 0) return linea;
  const l = daCapo ? linea.slice().reverse() : linea.slice();
  let resta = mm;
  while (l.length >= 2) {
    const a = l[l.length - 2], b = l[l.length - 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg > resta) {
      const t = (seg - resta) / seg;
      l[l.length - 1] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      break;
    }
    resta -= seg;
    l.pop();
  }
  return daCapo ? l.reverse() : l;
}

// L'ALLUNGAMENTO DEI CAPI: la sfrangiatura vera e propria.
//
// Regola che comanda tutto: **non si tocca niente se non i capi dentro le zone marcate.** Niente
// punti aggiunti, niente punti tolti, nessun riordino, nessun blocco spostato. Un capo marcato
// prosegue nella direzione in cui la sua fila stava andando, di una lunghezza a caso fra un minimo e
// un massimo; i capi di due macchie che si affacciano si spingono l'uno nel territorio dell'altro, e
// nell'intreccio nasce l'effetto delle foto del dossier.
//
// Il caso è **deterministico**: stessa marcatura e stesso seme = stesso ricamo, sempre. Un ricamo che
// cambia a ogni clic non si può ne' correggere ne' rifare, e in reparto questo conta piu' della varieta'.
// Il seme di ogni capo è ricavato dalla sua POSIZIONE nel file (blocco, indice), non da un contatore:
// così sfrangiare una zona non cambia le frange di un'altra, e rimarcare in un ordine diverso da'
// lo stesso risultato.
//
// L'effetto voluto non e' un pettine ma un INTRECCIO: le frange devono incrociarsi fra loro e fare
// delle X, come nelle foto di ricamo. Una virata a caso non basta - due frange vicine che virano
// tutte e due a destra restano parallele e non si incontrano mai. Quello che le fa incrociare e' il
// **segno opposto**: la virata alterna fra una frangia e la successiva, e l'ampiezza resta casuale.
// Cosi' ogni coppia vicina si apre a X, e siccome l'ampiezza varia gli incroci cadono a altezze
// diverse invece di allinearsi in una riga.
//
// «La successiva» va presa con cura, ed e' costato una misura per accorgersene: i capi consecutivi
// nella CUCITURA stanno su lati opposti della colonna di raso, cioe' lontanissimi sul ricamo.
// Alternare li' faceva incrociare solo il 30% delle coppie e il numero non saliva piu' nemmeno
// aprendo l'angolo. L'alternanza va fatta fra capi **dello stesso lato**, che sono quelli davvero
// vicini: e' l'unico posto dove una X si puo' formare.
//
// Due cose che il filo impone, e sono vincoli non parametri:
// - un punto non puo' diventare piu' lungo di quello che la macchina cuce (`puntoMassimoMm`): se la
//   frangia lo sforerebbe, si accorcia fino al limite invece di sballare il file;
// - l'attacco e lo stacco del filo (primo e ultimo punto di un blocco) non si toccano: li' il filo
//   entra e esce, e spostarli vorrebbe dire spostare un salto e la sua fermatura.

import { pointInPolygon, type Point } from '@rg/core';
import { leggiRaso, type LeggiRasoOptions } from './rasi';

export interface FrangiaParams extends LeggiRasoOptions {
  /** Lunghezza minima della frangia, in mm. */
  minMm: number;
  /** Lunghezza massima della frangia, in mm. */
  maxMm: number;
  /**
   * Apertura dell'incrocio, in gradi: di quanto la frangia si scosta dalla sua fila. Il segno
   * ALTERNA fra capi vicini, quindi questo e' anche mezzo angolo della X che si forma fra due
   * frange adiacenti. Default 25. A 0 le frange restano parallele e non si incrocia niente.
   */
  incrocioDeg?: number;
  /**
   * Quanto l'apertura puo' variare da una frangia all'altra, come frazione (0..1): con 0,6 l'angolo
   * va dal 40% al 100% dell'apertura. Serve a far cadere gli incroci a altezze diverse invece che
   * tutti sulla stessa riga. Default 0,6.
   */
  variazioneIncrocio?: number;
  /** Seme del caso. Stesso seme = stesso ricamo. Default 1. */
  seme?: number;
  /** Punto piu' lungo che la macchina cuce, in mm. Default 12 (il record DST arriva a 12,1). */
  puntoMassimoMm?: number;
  /** Sotto questa lunghezza una fila non e' una traversata di raso e il suo capo si lascia stare. Default 1 mm. */
  filaMinimaSfrangiabileMm?: number;
}

export interface EsitoSfrangiatura {
  /** I blocchi riscritti: stessa struttura, stesso numero di punti, solo i capi marcati spostati. */
  blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>;
  /** Quanti capi sono stati allungati. */
  allungati: number;
  /** Quanti capi erano nelle zone ma sono stati lasciati stare, e perche'. */
  saltati: { fuoriRaso: number; attaccoOStacco: number; filaCorta: number };
  /** Quante frange sono state accorciate per non sforare il punto massimo della macchina. */
  limitate: number;
  /** Lunghezza media della frangia effettivamente cucita, in mm. */
  frangiaMediaMm: number;
  /**
   * Quante volte due frange si tagliano davvero: e' la misura dell'effetto voluto, non
   * un'impressione. A apertura 0 (frange parallele) deve essere praticamente zero.
   *
   * Si guardano le VICINE, non solo la prima: con 25 gradi una frangia da 5 mm si sposta di traverso
   * di 2 mm, cioe' scavalca parecchie file, e contare solo la coppia adiacente diceva 48% quando
   * l'occhio ne vedeva molte di piu'.
   */
  incroci: number;
  /** Incroci per frangia allungata: il numero che dice quanto e' fitto l'intreccio. */
  incrociPerFrangia: number;
}

/** Generatore deterministico: da tre interi a un numero in [0,1). Nessuno stato, nessun ordine che conti. */
function caso(a: number, b: number, c: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b) ^ (c * 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** I due segmenti si tagliano? Serve a CONTARE le X, cosi' l'intreccio e' un numero e non un parere. */
function siIncrociano(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d = (p: Point, q: Point, r: Point): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

const dentro = (p: Point, zone: Point[][]): boolean => zone.some((z) => z.length >= 3 && pointInPolygon(p, z));

/**
 * Allunga i capi delle file di raso che cadono dentro le zone marcate. `blocchi` sono quelli di
 * `readDst`; le `zone` sono poligoni in mm (le stesse coordinate del ricamo). Restituisce blocchi
 * nuovi: fuori dalle zone sono gli stessi oggetti, punto per punto.
 */
export function sfrangia(
  blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>,
  zone: Point[][],
  params: FrangiaParams,
): EsitoSfrangiatura {
  const minMm = Math.max(0, params.minMm);
  const maxMm = Math.max(minMm, params.maxMm);
  const incrocio = ((params.incrocioDeg ?? 25) * Math.PI) / 180;
  const variaz = Math.min(1, Math.max(0, params.variazioneIncrocio ?? 0.6));
  const seme = params.seme ?? 1;
  const puntoMax = params.puntoMassimoMm ?? 12;
  const filaMin = params.filaMinimaSfrangiabileMm ?? 1;

  // quante frange indietro si guardano per contare gli incroci: una frangia lunga ne scavalca
  // diverse, e fermarsi alla prima sottostimava l'intreccio di molto.
  const VICINE = 12;
  const esito: EsitoSfrangiatura = {
    blocchi: [], allungati: 0,
    saltati: { fuoriRaso: 0, attaccoOStacco: 0, filaCorta: 0 },
    limitate: 0, frangiaMediaMm: 0, incroci: 0, incrociPerFrangia: 0,
  };
  let sommaFrangia = 0;

  blocchi.forEach((b, ib) => {
    const n = b.points_mm.length;
    // un blocco che non e' un raso (fermature, corse) non ha file da sfrangiare: si copia com'e'
    if (n < 5) { esito.blocchi.push(b); return; }
    const punti: Point[] = b.points_mm.map(([x, y]) => ({ x, y }));
    const { capi } = leggiRaso(punti, params);

    let toccato = false;
    // conta i capi allungati DENTRO questo blocco: e' l'indice su cui alterna il verso della virata,
    // e va per capi consecutivi lungo la cucitura - cioe' fra frange che sul ricamo sono vicine.
    // un contatore e le ultime frange PER LATO: le vicine sono quelle dello stesso bordo
    const incrociati = [0, 0];
    const precedenti: Array<Array<{ da: Point; a: Point }>> = [[], []];
    const nuovi = b.points_mm.slice() as Array<[number, number]>;
    for (const capo of capi) {
      if (!dentro(capo.punto, zone)) continue;
      if (capo.indice === 0 || capo.indice === n - 1) { esito.saltati.attaccoOStacco++; continue; }
      if (capo.filaMm < filaMin) { esito.saltati.filaCorta++; continue; }
      if (capo.direzione.x === 0 && capo.direzione.y === 0) { esito.saltati.fuoriRaso++; continue; }

      const r1 = caso(seme, ib, capo.indice);
      const r2 = caso(seme + 7919, ib, capo.indice);
      let lung = minMm + (maxMm - minMm) * r1;
      // il segno alterna (e' cio' che fa la X), l'ampiezza no: fra il (1-variazione) e il 100%
      const verso = incrociati[capo.lato] % 2 === 0 ? 1 : -1;
      const ang = verso * incrocio * (1 - variaz + variaz * r2);
      incrociati[capo.lato]++;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const dx = capo.direzione.x * cs - capo.direzione.y * sn;
      const dy = capo.direzione.x * sn + capo.direzione.y * cs;

      // il punto piu' lungo che si crea e' quello entrante o quello uscente: nessuno dei due puo'
      // sforare il limite della macchina, quindi la frangia si accorcia fino a li' e lo si dichiara.
      const prev = punti[capo.indice - 1], next = punti[capo.indice + 1];
      let tetto = Infinity;
      for (const q of [prev, next]) {
        if (!q) continue;
        // lunghezza del segmento q→(capo + t·d) al crescere di t: si risolve per |…| = puntoMax
        const ax = capo.punto.x - q.x, ay = capo.punto.y - q.y;
        const bq = ax * dx + ay * dy;
        const cq = ax * ax + ay * ay - puntoMax * puntoMax;
        const disc = bq * bq - cq;
        if (disc <= 0) { tetto = 0; break; }
        tetto = Math.min(tetto, -bq + Math.sqrt(disc));
      }
      if (tetto <= 0) { esito.saltati.fuoriRaso++; continue; }
      if (lung > tetto) { lung = tetto; esito.limitate++; }

      const punta: Point = { x: capo.punto.x + dx * lung, y: capo.punto.y + dy * lung };
      nuovi[capo.indice] = [punta.x, punta.y];
      esito.allungati++; sommaFrangia += lung; toccato = true;
      // la X si conta fra una frangia e la vicina, che sulla cucitura e' la precedente allungata
      const vicine = precedenti[capo.lato];
      for (const v of vicine) if (siIncrociano(v.da, v.a, capo.punto, punta)) esito.incroci++;
      vicine.push({ da: capo.punto, a: punta });
      if (vicine.length > VICINE) vicine.shift();
    }
    esito.blocchi.push(toccato ? { needle: b.needle, points_mm: nuovi } : b);
  });

  esito.frangiaMediaMm = esito.allungati ? sommaFrangia / esito.allungati : 0;
  esito.incrociPerFrangia = esito.allungati ? esito.incroci / esito.allungati : 0;
  return esito;
}

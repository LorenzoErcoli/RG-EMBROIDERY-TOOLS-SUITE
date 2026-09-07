// LA FRANGIA: un andata e ritorno di filo che esce dal capo di una fila di raso.
//
// Regola che comanda tutto: **il ricamo di partenza non si tocca.** I suoi punti restano tutti, nello
// stesso ordine e nelle stesse coordinate; la frangia si AGGIUNGE. Togliendo i punti aggiunti si
// riottiene il file di prima, punto per punto — ed è un test, non una promessa.
//
// Come è fatta una frangia (decisione di Lorenzo, ed è più pulita di come l'avevo pensata all'inizio):
// dal capo il filo esce fino alla punta e **torna esattamente sul capo**, due punti di filo
// sovrapposti. Il raso resta intatto — prima invece spostavo il capo, cioè deformavo l'ultima fila —
// e in macchina è il modo normale di fare uno spillo: l'ago scende sulla punta e rientra nel buco da
// cui era uscito.
//
//   … p[i−1] → CAPO → punta → CAPO → p[i+1] …
//
// L'effetto voluto non è un pettine ma un INTRECCIO: le frange devono incrociarsi e fare delle X.
// Una virata a caso non basta — due frange vicine che virano dalla stessa parte restano parallele per
// sempre. Quello che le fa tagliare è il **segno opposto**: il verso alterna fra una frangia e la
// successiva, l'ampiezza resta casuale dentro l'intervallo chiesto, così gli incroci cadono a altezze
// diverse invece di allinearsi in una riga.
//
// «La successiva» va presa con cura, ed è costato una misura per accorgersene: i capi consecutivi
// nella CUCITURA stanno su lati opposti della colonna di raso, cioè lontanissimi sul ricamo.
// Alternare lì faceva incrociare solo il 30% delle coppie, e il numero non saliva più nemmeno
// aprendo l'angolo. L'alternanza va fatta fra capi **dello stesso lato**, i soli davvero vicini.
//
// Il caso è **deterministico e posizionale**: il seme di un capo viene dal suo posto nel file, non da
// un contatore. Sfrangiare una zona non cambia le frange di un'altra, rimarcare in ordine diverso dà
// lo stesso ricamo, e con lo stesso seme il file si rifà identico. In reparto questo conta più della
// varietà: un ricamo che cambia a ogni clic non si può né correggere né rifare.

import { pointInPolygon, type Point } from '@rg/core';
import { leggiRaso, type LeggiRasoOptions } from './rasi';

export interface FrangiaParams extends LeggiRasoOptions {
  /** Lunghezza della frangia: estratta a caso fra questi due, in mm. */
  lunghezzaMinMm: number;
  lunghezzaMaxMm: number;
  /**
   * Apertura dell'incrocio: di quanto la frangia si scosta dalla sua fila, in gradi, estratta fra
   * questi due. Il segno ALTERNA fra frange vicine, quindi l'apertura è anche mezzo angolo della X
   * che si forma. A 0 le frange restano parallele e non si incrocia niente.
   */
  aperturaMinDeg: number;
  aperturaMaxDeg: number;
  /**
   * Sormonto, in mm: quanto ogni frangia entra **di sicuro** nel territorio della macchia vicina.
   * È una quota fissa che si somma alla lunghezza estratta — alza il pavimento, non il soffitto:
   * con sormonto 3 nessuna frangia si ferma prima di 3 mm oltre il capo.
   */
  sormontoMm?: number;
  /** Seme del caso. Stesso seme = stesso ricamo. Default 1. */
  seme?: number;
  /** Punto più lungo che la macchina cuce, in mm. Default 12 (il record DST arriva a 12,1). */
  puntoMassimoMm?: number;
  /** Sotto questa lunghezza una fila non è una traversata di raso e il suo capo si lascia stare. Default 1 mm. */
  filaMinimaSfrangiabileMm?: number;
  /** Aghi su cui NON intervenire (numeri d'ago di `readDst`). Vuoto = tutti. */
  aghiEsclusi?: number[];
  /**
   * `andata-ritorno` (default): la frangia si aggiunge e il raso resta intatto.
   * `sposta`: il capo viene spostato in fuori, come nella prima versione. Tenuto per confronto.
   */
  modo?: 'andata-ritorno' | 'sposta';
}

export interface EsitoSfrangiatura {
  /** I blocchi riscritti. Fuori dalle zone marcate sono gli stessi oggetti di prima. */
  blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>;
  /** Quante frange sono state fatte. */
  frange: number;
  /** Capi dentro le zone lasciati stare, e perché. */
  saltati: { fuoriRaso: number; attaccoOStacco: number; filaCorta: number };
  /** Frange accorciate per non sforare il punto massimo della macchina. */
  limitate: number;
  /** Lunghezza media della frangia, in mm. */
  frangiaMediaMm: number;
  /** Filo aggiunto in totale, in metri (l'andata e ritorno conta doppio). */
  filoAggiuntoM: number;
  /**
   * Quante volte due frange si tagliano davvero: la misura dell'effetto, non un'impressione.
   * Si guardano le vicine, non solo la prima: una frangia da 5 mm a 25° si sposta di traverso di
   * 2 mm e ne scavalca parecchie, e contare solo l'adiacente diceva 48% quando l'occhio ne vedeva
   * molte di più. A apertura 0 dev'essere zero.
   */
  incroci: number;
  /** Incroci per frangia: quanto è fitto l'intreccio. */
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

/** I due segmenti si tagliano? Serve a CONTARE le X, così l'intreccio è un numero e non un parere. */
function siIncrociano(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d = (p: Point, q: Point, r: Point): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

const dentro = (p: Point, zone: Point[][]): boolean => zone.some((z) => z.length >= 3 && pointInPolygon(p, z));

/** Quante frange indietro si guardano per contare gli incroci: una lunga ne scavalca diverse. */
const VICINE = 12;

/**
 * Fa le frange sui capi delle file di raso che cadono dentro le zone marcate. `blocchi` sono quelli
 * di `readDst`; le `zone` sono poligoni in mm, nelle stesse coordinate del ricamo.
 */
export function sfrangia(
  blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>,
  zone: Point[][],
  params: FrangiaParams,
): EsitoSfrangiatura {
  const lMin = Math.max(0, params.lunghezzaMinMm);
  const lMax = Math.max(lMin, params.lunghezzaMaxMm);
  const aMin = (Math.min(params.aperturaMinDeg, params.aperturaMaxDeg) * Math.PI) / 180;
  const aMax = (Math.max(params.aperturaMinDeg, params.aperturaMaxDeg) * Math.PI) / 180;
  const sormonto = Math.max(0, params.sormontoMm ?? 0);
  const seme = params.seme ?? 1;
  const puntoMax = params.puntoMassimoMm ?? 12;
  const filaMin = params.filaMinimaSfrangiabileMm ?? 1;
  const esclusi = new Set(params.aghiEsclusi ?? []);
  const andataRitorno = (params.modo ?? 'andata-ritorno') === 'andata-ritorno';

  const esito: EsitoSfrangiatura = {
    blocchi: [], frange: 0,
    saltati: { fuoriRaso: 0, attaccoOStacco: 0, filaCorta: 0 },
    limitate: 0, frangiaMediaMm: 0, filoAggiuntoM: 0, incroci: 0, incrociPerFrangia: 0,
  };
  let somma = 0;

  blocchi.forEach((b, ib) => {
    const n = b.points_mm.length;
    // un blocco che non è un raso (fermature, corse) non ha file da sfrangiare: si copia com'è
    if (n < 5 || !zone.length || esclusi.has(b.needle)) { esito.blocchi.push(b); return; }
    const punti: Point[] = b.points_mm.map(([x, y]) => ({ x, y }));
    const { capi } = leggiRaso(punti, params);

    // le frange da fare, indicizzate sul punto a cui si attaccano
    const daFare = new Map<number, Point>();
    const alternanza = [0, 0];
    const precedenti: Array<Array<{ da: Point; a: Point }>> = [[], []];

    for (const capo of capi) {
      if (!dentro(capo.punto, zone)) continue;
      if (capo.indice === 0 || capo.indice === n - 1) { esito.saltati.attaccoOStacco++; continue; }
      if (capo.filaMm < filaMin) { esito.saltati.filaCorta++; continue; }
      if (capo.direzione.x === 0 && capo.direzione.y === 0) { esito.saltati.fuoriRaso++; continue; }

      const r1 = caso(seme, ib, capo.indice);
      const r2 = caso(seme + 7919, ib, capo.indice);
      let lung = sormonto + lMin + (lMax - lMin) * r1;
      // il segno alterna (è ciò che fa la X), l'ampiezza è estratta nell'intervallo chiesto
      const verso = alternanza[capo.lato] % 2 === 0 ? 1 : -1;
      const ang = verso * (aMin + (aMax - aMin) * r2);
      alternanza[capo.lato]++;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const dx = capo.direzione.x * cs - capo.direzione.y * sn;
      const dy = capo.direzione.x * sn + capo.direzione.y * cs;

      // il punto più lungo che si crea non può sforare quello che la macchina cuce. Con l'andata e
      // ritorno i due segmenti nuovi sono lunghi entrambi quanto la frangia, quindi il tetto è
      // immediato; spostando il capo, invece, cambiano i due segmenti che ci arrivano.
      let tetto = puntoMax;
      if (!andataRitorno) {
        tetto = Infinity;
        for (const q of [punti[capo.indice - 1], punti[capo.indice + 1]]) {
          if (!q) continue;
          const ax = capo.punto.x - q.x, ay = capo.punto.y - q.y;
          const bq = ax * dx + ay * dy;
          const cq = ax * ax + ay * ay - puntoMax * puntoMax;
          const disc = bq * bq - cq;
          if (disc <= 0) { tetto = 0; break; }
          tetto = Math.min(tetto, -bq + Math.sqrt(disc));
        }
      }
      if (tetto <= 0) { esito.saltati.fuoriRaso++; continue; }
      if (lung > tetto) { lung = tetto; esito.limitate++; }

      const punta: Point = { x: capo.punto.x + dx * lung, y: capo.punto.y + dy * lung };
      daFare.set(capo.indice, punta);
      esito.frange++; somma += lung;
      esito.filoAggiuntoM += ((andataRitorno ? 2 : 1) * lung) / 1000;

      const vicine = precedenti[capo.lato];
      for (const v of vicine) if (siIncrociano(v.da, v.a, capo.punto, punta)) esito.incroci++;
      vicine.push({ da: capo.punto, a: punta });
      if (vicine.length > VICINE) vicine.shift();
    }

    if (!daFare.size) { esito.blocchi.push(b); return; }
    const nuovi: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const punta = daFare.get(i);
      if (andataRitorno) {
        // il punto originale resta dov'è, e dopo di lui si esce e si rientra nello stesso buco
        nuovi.push(b.points_mm[i]);
        if (punta) { nuovi.push([punta.x, punta.y]); nuovi.push(b.points_mm[i]); }
      } else {
        nuovi.push(punta ? [punta.x, punta.y] : b.points_mm[i]);
      }
    }
    esito.blocchi.push({ needle: b.needle, points_mm: nuovi });
  });

  esito.frangiaMediaMm = esito.frange ? somma / esito.frange : 0;
  esito.incrociPerFrangia = esito.frange ? esito.incroci / esito.frange : 0;
  return esito;
}

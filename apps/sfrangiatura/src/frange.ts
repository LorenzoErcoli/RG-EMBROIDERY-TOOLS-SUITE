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
  /** Virata casuale del capo, in gradi per lato: i fili non restano paralleli. Default 8. */
  virataDeg?: number;
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
}

/** Generatore deterministico: da tre interi a un numero in [0,1). Nessuno stato, nessun ordine che conti. */
function caso(a: number, b: number, c: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b) ^ (c * 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
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
  const virata = ((params.virataDeg ?? 8) * Math.PI) / 180;
  const seme = params.seme ?? 1;
  const puntoMax = params.puntoMassimoMm ?? 12;
  const filaMin = params.filaMinimaSfrangiabileMm ?? 1;

  const esito: EsitoSfrangiatura = {
    blocchi: [], allungati: 0,
    saltati: { fuoriRaso: 0, attaccoOStacco: 0, filaCorta: 0 },
    limitate: 0, frangiaMediaMm: 0,
  };
  let sommaFrangia = 0;

  blocchi.forEach((b, ib) => {
    const n = b.points_mm.length;
    // un blocco che non e' un raso (fermature, corse) non ha file da sfrangiare: si copia com'e'
    if (n < 5) { esito.blocchi.push(b); return; }
    const punti: Point[] = b.points_mm.map(([x, y]) => ({ x, y }));
    const { capi } = leggiRaso(punti, params);

    let toccato = false;
    const nuovi = b.points_mm.slice() as Array<[number, number]>;
    for (const capo of capi) {
      if (!dentro(capo.punto, zone)) continue;
      if (capo.indice === 0 || capo.indice === n - 1) { esito.saltati.attaccoOStacco++; continue; }
      if (capo.filaMm < filaMin) { esito.saltati.filaCorta++; continue; }
      if (capo.direzione.x === 0 && capo.direzione.y === 0) { esito.saltati.fuoriRaso++; continue; }

      const r1 = caso(seme, ib, capo.indice);
      const r2 = caso(seme + 7919, ib, capo.indice);
      let lung = minMm + (maxMm - minMm) * r1;
      const ang = (r2 * 2 - 1) * virata;
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

      nuovi[capo.indice] = [capo.punto.x + dx * lung, capo.punto.y + dy * lung];
      esito.allungati++; sommaFrangia += lung; toccato = true;
    }
    esito.blocchi.push(toccato ? { needle: b.needle, points_mm: nuovi } : b);
  });

  esito.frangiaMediaMm = esito.allungati ? sommaFrangia / esito.allungati : 0;
  return esito;
}

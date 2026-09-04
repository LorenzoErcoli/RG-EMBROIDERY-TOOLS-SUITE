// LA CATENA — da un'immagine ai punti da cucire, in un pezzo solo e senza DOM.
//
// Qui non c'è algoritmo nuovo: c'è l'ordine in cui i pezzi già provati si chiamano, ed è quello
// l'oggetto di questo file. L'ordine non è arbitrario, ogni passo dipende da una cosa misurata nel
// precedente:
//
//   1. **riduzione** (`reduce`, core) — senza, il contorno è la grana della stampa e non la forma:
//      misurato sulla cianotipia, 699 fori falsi in una campitura uniforme;
//   2. **regioni** (`traceRegions`, core) — dalla mappa dei colori ai poligoni coi loro fori;
//   3. **larghezza dei passaggi** (`borders`) — quali bordi sfumano e quali staccano. Si misura
//      sull'immagine ORIGINALE, perché dopo la riduzione la sfumatura non esiste più;
//   4. **crescita** — 5 mm dove sfuma, 1,5 dove stacca, e solo verso i colori che verranno dopo;
//   5. **campo di direzione** (`field`) — perpendicolare sui bordi di colore, libero sulle testate;
//   6. **riempimento dalla rotaia** (`rail-fill`) — l'ordine viene da lì, coi cunei dove la fascia
//      si allarga; sulle forme che non sono fasce si torna al riempimento a distanza costante;
//   7. **frastaglio** (`borders`) — solo dove sfuma, e solo dentro il margine cresciuto.
//
// Quello che NON c'è ancora, e va detto: il **punto minimo** (R3), che per regola si impone dopo il
// routing, e i **passaggi** fra una macchia e l'altra (R16/R26). Sono il pezzo successivo.

import {
  type PixelImage, type Polyline, type Point, type Region, type ExportLayer, type Rgb,
  reduceStable, prepareImage, traceRegions, rgbToHex,
} from '@rg/core';
import { harmonicField, type CondizioneAlBordo } from './field';
import { buildRailFill } from './rail-fill';
import { buildCurvedFill } from './curved-fill';
import { larghezzaTransizione, cresciVersoISuccessivi, frastaglia } from './borders';
// I passaggi NON si riscrivono: sono R16-R21 e R26, e vivono nel core da quando `routing` è stato
// promosso da broccato. Mappa di copertura, catena minima fra le macchie, e i tre casi in ordine —
// dritto, nascosto con l'A*, staccato solo se non c'è strada.
import {
  buildCoverGrid, routeColorRuns, enforceMinStitch, resampleUniform, distance, type RegionRuns,
} from '@rg/core';

/**
 * L'ORDINE DELLE CORSE dentro una macchia.
 *
 * `routeColorRuns` mette in fila le MACCHIE a catena minima, ma dentro una macchia cuce le corse
 * nell'ordine in cui gliele si passa: è il patto giusto, perché quell'ordine lo sa solo chi ha
 * generato il riempimento. Dalla rotaia le corse escono già in fila — è il senso di quel motore —
 * ma il riempimento a distanza costante le semina dove servono alla distanza, non in sequenza, e
 * consegnate così fanno pagare un passaggio lungo a ogni corsa.
 *
 * Qui si mettono in fila e basta: dal capo dov'è finito il filo all'estremo più vicino che resta,
 * girando la corsa se conviene entrarci dall'altra parte. Non si cuce niente — quello è mestiere di
 * `routeColorRuns` — si decide solo la sequenza, così i tratti che dovrà coprire sono i più corti.
 */
function inFila(runs: Polyline[]): Polyline[] {
  if (runs.length < 2) return [...runs];
  const restano = runs.map((r, i) => ({ r, i }));
  const out: Polyline[] = [restano.shift()!.r];
  while (restano.length) {
    const coda = out[out.length - 1][out[out.length - 1].length - 1];
    let best = 0, bestD = Infinity, gira = false;
    for (let k = 0; k < restano.length; k++) {
      const r = restano[k].r;
      const dA = distance(coda, r[0]), dB = distance(coda, r[r.length - 1]);
      if (dA < bestD) { bestD = dA; best = k; gira = false; }
      if (dB < bestD) { bestD = dB; best = k; gira = true; }
    }
    const scelta = restano.splice(best, 1)[0].r;
    out.push(gira ? [...scelta].reverse() : scelta);
  }
  return out;
}

/**
 * R3 e R4 insieme, nell'ordine giusto — stesso passo 8 del broccato.
 *
 * `enforceMinStitch` tiene SEMPRE gli estremi, quindi non puo' togliere una coda corta in fondo: la
 * si toglie arretrando il PENULTIMO punto, mai l'ultimo. Poi si rimette il tetto (R4), perche'
 * togliere un punto in mezzo unisce due tratti e puo' allungare il punto oltre il massimo;
 * `resampleUniform` **suddivide soltanto** (R4), quindi non sposta un millimetro di geometria.
 */
function minEMax(pl: Polyline, minMm: number, maxMm: number): Polyline {
  const out = enforceMinStitch(pl, minMm);
  while (out.length >= 3 && distance(out[out.length - 1], out[out.length - 2]) < minMm) {
    out.splice(out.length - 2, 1);
  }
  while (out.length >= 2 && distance(out[out.length - 1], out[out.length - 2]) < 1e-9) out.pop();
  return maxMm > 0 ? resampleUniform(out, maxMm) : out;
}

export interface PittoricoParams {
  /** Quante tinte: ogni tinta è un ago. */
  colorCount: number;
  /** Passo fra due file di filo (R22). Scelto da Lorenzo sui provini: 0,3. */
  densitySpacingMm: number;
  /** Lunghezza massima del punto (R4). */
  maxStitchMm: number;
  /** Quanto sporgono le frange dove il colore sfuma. Scelto sui provini: 5. */
  frangiaMm: number;
  /** Quanto il colore sotto sborda sotto quello sopra dove il colore SFUMA. */
  crescitaMm: number;
  /** ...e dove il colore STACCA NETTO: il bordo resta preciso, ma senza far vedere la tela. */
  sormontoMm: number;
  /** Sopra questa larghezza il passaggio è considerato una sfumatura. */
  sogliaSfumaturaMm: number;
  /** Raggio del pareggio della luce, in mm (0 = spento). */
  flattenLightMm: number;
  /** Raggio dell'attenuazione della grana, in mm. */
  smoothMm: number;
  /** Area minima di una macchia perché valga la pena cucirla, in mm². */
  minAreaMm2: number;
  /** Larghezza reale del disegno in mm (R11): è la fonte di verità. */
  realWidthMm: number;
  /** Punto minimo (R3): si impone DOPO il routing, mai prima. */
  minStitchMm: number;
  /** Passo dei punti di passaggio (§3.1 `travelStitchMm`). */
  travelStitchMm: number;
  /**
   * Oltre questo tratto SCOPERTO il filo si stacca (R16, fallback graduato). Tenuto alto apposta:
   * il giro sul contorno si paga, il taglio del filo no — ed è la regola che Lorenzo ha ribadito
   * («solo l'ultimo livello, se non c'è soluzione, mettiamo rasafilo»).
   */
  maxVisibleTravelMm: number;
  /**
   * Lo stesso, ma per l'ULTIMO ago: sopra di lui non c'è niente, quindi ogni passaggio si vede.
   * Tenuto sotto la soglia del rasafilo della macchina (5-10 mm): il tratto corto lo si cuce, il
   * resto si taglia. È l'unico livello dove il taglio è la risposta giusta.
   */
  maxVisibleTravelUltimoMm: number;
}

export const defaultPittoricoParams: PittoricoParams = {
  colorCount: 4,
  densitySpacingMm: 0.3,
  maxStitchMm: 3,
  frangiaMm: 5,
  crescitaMm: 5,
  sormontoMm: 1.5,
  sogliaSfumaturaMm: 1.5,
  flattenLightMm: 40,
  smoothMm: 1.5,
  minAreaMm2: 400,
  realWidthMm: 0,
  minStitchMm: 1,
  travelStitchMm: 2.5,
  maxVisibleTravelMm: 400,
  maxVisibleTravelUltimoMm: 5,
};

export interface MacchiaCucita {
  tinta: number;
  region: Region;
  corse: Polyline[];
  /** Come è stata riempita: dalla rotaia (ordinata) o a distanza costante (forma senza fianchi). */
  metodo: 'rotaia' | 'distanza';
}

export interface PittoricoPlan {
  palette: Rgb[];
  /** L'ordine di cucitura: dalla tinta più scura alla più chiara. Ogni tinta è un ago. */
  ordine: number[];
  macchie: MacchiaCucita[];
  mmPerPx: number;
  larghezzaMm: number;
  altezzaMm: number;
  /** Quanti campioni di bordo sono risultati sfumati, e quanti in tutto. */
  bordiSfumati: number;
  bordiTotali: number;
  filoMm: number;
  punti: number;
  /** Quanti salti restano dopo aver cucito i passaggi, e quanto sono lunghi in tutto. */
  salti: number;
  saltoMm: number;
  saltoMassimoMm: number;
  /** Come sono andati i passaggi, ago per ago: è la misura che dice se il routing sta reggendo. */
  passaggiPerAgo: PassaggiAgo[];
}

/** Il conto dei passaggi di un ago (R16): quanto filo si spende per andare, e quanto se ne vede. */
export interface PassaggiAgo {
  tinta: number;
  corse: number;
  riempimentoMm: number;
  passaggiMm: number;
  /** Di quei passaggi, quanto corre sotto un colore che verrà: quello non si vede. */
  passaggiCopertiMm: number;
  /** Quante volte il filo si è dovuto staccare: sull'ultimo ago è un rasafilo vero. */
  stacchi: number;
}

const luce = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * Dall'immagine al piano di cucitura.
 *
 * `mmPerPx` esce da `realWidthMm` (R11): se non è dato si usa la larghezza dichiarata dal file, che
 * è una stima e non una misura — il chiamante deve saperlo e offrire l'override.
 */
export function buildPittoricoPlan(img: PixelImage, p: PittoricoParams): PittoricoPlan {
  const larghezzaMm = p.realWidthMm > 0 ? p.realWidthMm : img.width;
  const mmPerPx = larghezzaMm / img.width;


  // 1. le tinte, stabili
  const res = reduceStable(img, {
    colorCount: p.colorCount, flattenLightMm: p.flattenLightMm, smoothMm: p.smoothMm,
    minBlobMm2: Math.max(1, p.minAreaMm2 / 40), mmPerPx,
  });
  const ordine = res.palette.map((_, i) => i).sort((a, b) => luce(res.palette[a]) - luce(res.palette[b]));

  // 3. i passaggi: si misurano sull'immagine com'è, tolta solo la grana (vedi `borders`)
  const perMisurare = prepareImage(img, { flattenLightMm: 0, smoothMm: p.smoothMm, mmPerPx });
  const idx = res.index;
  const tintaIn = (x: number, y: number): number =>
    (x < 0 || y < 0 || x >= img.width || y >= img.height) ? -1 : idx[y * img.width + x];

  /** 1 dove il colore sfuma: è lì che si cresce di 5 mm e che si frastaglia. */
  const sfuma = new Uint8Array(img.width * img.height);
  let bordiSfumati = 0, bordiTotali = 0;
  {
    const raggio = Math.ceil(p.crescitaMm / mmPerPx) + 2;
    for (let t = 0; t < res.palette.length; t++) {
      for (const r of traceRegions(idx, img.width, img.height, t, mmPerPx, { simplifyMm: mmPerPx * 0.8, minAreaMm2: p.minAreaMm2 })) {
        for (const anello of [r.outer, ...r.holes]) {
          let percorsa = 0;
          for (let i = 0; i < anello.length; i++) {
            const a = anello[i], b = anello[(i + 1) % anello.length];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            percorsa += len;
            if (percorsa < 2 || len < 1e-9) continue;
            percorsa = 0;
            const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
            const px = q.x / mmPerPx, py = q.y / mmPerPx;
            const t1 = tintaIn(Math.round(px + n.x * 2.5), Math.round(py + n.y * 2.5));
            const t2 = tintaIn(Math.round(px - n.x * 2.5), Math.round(py - n.y * 2.5));
            const altra = t1 === t ? t2 : t1;
            if (altra < 0 || altra === t) continue;
            const tr = larghezzaTransizione(perMisurare, mmPerPx, q, n, { raggioMm: 10 });
            if (!tr) continue;
            bordiTotali++;
            if (tr.larghezzaMm <= p.sogliaSfumaturaMm) continue;
            bordiSfumati++;
            const cx = Math.round(px), cy = Math.round(py);
            for (let dy = -raggio; dy <= raggio; dy++) {
              const y = cy + dy;
              if (y < 0 || y >= img.height) continue;
              const mezzo = Math.floor(Math.sqrt(Math.max(0, raggio * raggio - dy * dy)));
              for (let dx = -mezzo; dx <= mezzo; dx++) {
                const x = cx + dx;
                if (x >= 0 && x < img.width) sfuma[y * img.width + x] = 1;
              }
            }
          }
        }
      }
    }
  }

  // 4-7. tinta per tinta, nell'ordine di cucitura
  const macchie: MacchiaCucita[] = [];
  for (const t of ordine) {
    const mio = ordine.indexOf(t);
    const cresciuta = cresciVersoISuccessivi(idx, img.width, img.height, t, ordine, mmPerPx, {
      crescitaMm: p.crescitaMm, sormontoMm: p.sormontoMm, sfuma,
    });
    for (const region of traceRegions(cresciuta, img.width, img.height, 1, mmPerPx, {
      simplifyMm: mmPerPx * 1.5, minAreaMm2: p.minAreaMm2,
    })) {
      /** Che tinta c'è appena fuori dal contorno, in questo punto. −1 = niente. */
      const fuori = (q: Point): number => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as Array<[number, number]>) {
          const v = tintaIn(x + dx, y + dy);
          if (v >= 0 && v !== t) return v;
        }
        return -1;
      };
      // 5. il campo: perpendicolare dove il colore cambia, LIBERO sulle testate
      const campo = harmonicField(region, {
        cellMm: Math.max(0.8, mmPerPx * 3), levels: 4, sweeps: 220,
        condizioneA: (q): CondizioneAlBordo => (fuori(q) >= 0 ? 'perpendicolare' : 'libera'),
      });

      // 6. la rotaia: UN lato, quello che guarda il colore già cucito
      const rotaia = trattoVerso(region.outer, fuori, ordine, mio, 'prima')
        ?? trattoVerso(region.outer, fuori, ordine, mio, 'dopo');
      const daRotaia = !!rotaia && rotaia.length < region.outer.length * 0.75;
      const corse = daRotaia
        ? buildRailFill(region, campo, rotaia as Polyline, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
        }).runs
        : buildCurvedFill(region, campo, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
        }).runs;

      // 7. il frastaglio: solo dove sfuma, e solo dentro il margine cresciuto
      const quiSfuma = (q: Point): boolean => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        return x >= 0 && y >= 0 && x < img.width && y < img.height && sfuma[y * img.width + x] === 1;
      };
      const corpo = (q: Point): boolean => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        return tintaIn(x, y) === t;
      };
      const frangiate = frastaglia(corse, quiSfuma, {
        frangiaMm: Math.min(p.frangiaMm, p.crescitaMm),   // oltre il margine la frangia si appiattisce
        granaMm: Math.max(p.densitySpacingMm * 4, 0.8),
        restaFuoriDa: corpo,
      });

      macchie.push({ tinta: t, region, corse: frangiate, metodo: daRotaia ? 'rotaia' : 'distanza' });
    }
  }

  /*
   * I PASSAGGI (R16-R21, R26) — il pezzo che il primo DST vero non aveva, e che l'ha reso
   * inutilizzabile: 15.449 salti e 569 m di spostamenti a vuoto contro 355 m di filo cucito.
   *
   * Non c'è niente di nuovo da scrivere: `routeColorRuns` del core fa esattamente questo. Per ogni
   * ago costruisce la mappa di cosa gli verrà cucito SOPRA, visita le macchie a catena minima, e
   * fra una corsa e l'altra sceglie fra tre cose in ordine — dritto se il salto è corto e resta
   * dentro la macchia, altrimenti la strada meno visibile con l'A*, e solo se nemmeno quella regge
   * il filo si stacca.
   *
   * La mappa vuole gli indici **in ordine di cucitura**, non quelli della palette: `ordine` è una
   * permutazione, e passare gli indici grezzi vorrebbe dire dire al core che «dopo» è un altro.
   */
  const inOrdine = new Uint8Array(idx.length).fill(0xff);
  for (let i = 0; i < idx.length; i++) {
    const pos = ordine.indexOf(idx[i]);
    if (pos >= 0) inOrdine[i] = pos;
  }
  const aghi = ordine.map(() => ({}));

  let filoMm = 0, punti = 0, salti = 0, saltoMm = 0, saltoMassimoMm = 0;
  const passaggiPerAgo: PassaggiAgo[] = [];
  for (let k = 0; k < ordine.length; k++) {
    const t = ordine[k];
    const gruppi: RegionRuns[] = macchie
      .filter((m) => m.tinta === t && m.corse.length)
      .map((m) => ({ region: m.region, runs: inFila(m.corse) }));
    if (!gruppi.length) continue;
    const grid = buildCoverGrid(inOrdine, img.width, img.height, mmPerPx, k, aghi, 1.5);
    /*
     * Quanto passaggio SCOPERTO si accetta prima di staccare il filo (R16, fallback graduato).
     *
     * Non è un numero solo, perché non tutti gli aghi sono nella stessa condizione. Sotto un colore
     * che verrà, un passaggio lungo sparisce: si può essere generosi, e conviene, perché un taglio
     * costa una ripresa e un capo da fissare. Sull'ULTIMO ago non c'è niente che copra: lì un
     * passaggio è filo che si vede sul davanti, e la regola di Lorenzo è quella — «solo l'ultimo
     * livello, se non c'è soluzione, mettiamo rasafilo». Quindi lì si tiene la soglia sotto il
     * rasafilo della macchina: il tratto corto passa, il resto si taglia.
     */
    const ultimo = k === ordine.length - 1;
    const routed = routeColorRuns(gruppi, grid, {
      travelStitchMm: p.travelStitchMm,
      maxVisibleTravelMm: ultimo ? p.maxVisibleTravelUltimoMm : p.maxVisibleTravelMm,
    });
    // R3 DOPO il routing, mai prima: sono le giunzioni appena create a reintrodurre i micro-punti
    const blocchi = routed.blocks
      .map((b) => minEMax(b, p.minStitchMm, p.maxStitchMm))
      .filter((b) => b.length >= 2);
    // i blocchi cuciti stanno tutti sulla prima macchia dell'ago: da qui in poi contano gli AGHI
    for (const m of macchie) if (m.tinta === t) m.corse = [];
    const prima = macchie.find((m) => m.tinta === t);
    if (prima) prima.corse = blocchi;

    salti += routed.jumps;
    saltoMm += routed.travelMm;
    passaggiPerAgo.push({
      tinta: t,
      corse: gruppi.reduce((a, g) => a + g.runs.length, 0),
      riempimentoMm: gruppi.reduce((a, g) => a + g.runs.reduce((b, r) => {
        let m = 0; for (let i = 1; i < r.length; i++) m += distance(r[i], r[i - 1]); return b + m;
      }, 0), 0),
      passaggiMm: routed.travelMm,
      passaggiCopertiMm: routed.travelCoveredMm,
      stacchi: routed.jumps,
    });
    for (let i = 1; i < blocchi.length; i++) {
      const d = Math.hypot(blocchi[i][0].x - blocchi[i - 1][blocchi[i - 1].length - 1].x,
        blocchi[i][0].y - blocchi[i - 1][blocchi[i - 1].length - 1].y);
      if (d > saltoMassimoMm) saltoMassimoMm = d;
    }
    for (const b of blocchi) {
      punti += b.length;
      for (let i = 1; i < b.length; i++) filoMm += Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y);
    }
  }

  return {
    palette: res.palette, ordine, macchie, mmPerPx,
    larghezzaMm, altezzaMm: img.height * mmPerPx,
    bordiSfumati, bordiTotali, filoMm, punti,
    salti, saltoMm, saltoMassimoMm, passaggiPerAgo,
  };
}

/**
 * Il tratto di contorno più lungo che guarda una tinta **prima** (già cucita) o **dopo** di questa.
 * È la rotaia: un lato solo. Prendere tutto il contorno che guarda un'altra tinta sembra equivalente
 * e non lo è — su una regione interna è quasi tutto l'anello, e si finisce per seminare da ogni lato.
 */
function trattoVerso(
  anello: Polyline, fuori: (p: Point) => number, ordine: number[], mio: number, verso: 'prima' | 'dopo',
): Polyline | null {
  const guarda = anello.map((p) => {
    const q = fuori(p);
    if (q < 0) return false;
    const suo = ordine.indexOf(q);
    return verso === 'prima' ? suo >= 0 && suo < mio : suo > mio;
  });
  let inizio = 0, lungh = 0, corrente = 0, iniz = 0;
  for (let i = 0; i < guarda.length * 2; i++) {
    if (guarda[i % guarda.length]) {
      if (corrente === 0) iniz = i;
      corrente++;
      if (corrente > lungh) { lungh = corrente; inizio = iniz; }
    } else corrente = 0;
  }
  if (lungh < 6) return null;
  return Array.from({ length: Math.min(lungh, guarda.length) }, (_, k) => anello[(inizio + k) % guarda.length]);
}

/**
 * I livelli da esportare: **uno per tinta**, perché una tinta è un filato è un ago (R31). Le macchie
 * della stessa tinta stanno nello stesso livello, in ordine di cucitura.
 */
export function pittoricoExportLayers(plan: PittoricoPlan): ExportLayer[] {
  const THREAD_STROKE_MM = 0.1;                       // R15: il filo si disegna sottile
  return plan.ordine.map((t, i) => ({
    id: `ago-${String(i).padStart(2, '0')}-tinta-${t}`,
    color: rgbToHex(plan.palette[t]),
    strokeMm: THREAD_STROKE_MM,
    polylines: plan.macchie.filter((m) => m.tinta === t).flatMap((m) => m.corse),
  })).filter((l) => l.polylines.length > 0);
}

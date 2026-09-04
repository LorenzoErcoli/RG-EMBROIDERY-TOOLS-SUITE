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

  let filoMm = 0, punti = 0;
  for (const m of macchie) {
    for (const c of m.corse) {
      punti += c.length;
      for (let i = 1; i < c.length; i++) filoMm += Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y);
    }
  }

  return {
    palette: res.palette, ordine, macchie, mmPerPx,
    larghezzaMm, altezzaMm: img.height * mmPerPx,
    bordiSfumati, bordiTotali, filoMm, punti,
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

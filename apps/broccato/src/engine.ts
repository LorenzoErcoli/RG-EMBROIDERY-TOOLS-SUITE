// Motore del tool "Broccato" — TS puro, nessun DOM (come interlace/bitmap/striatura: il DOM sta
// solo in tool.ts, così il motore si prova in Node dallo smoke test).
//
// Cosa costruisce: da un'immagine di tessuto si ricavano 4–8 tinte; ogni tinta diventa un ago che
// riempie le sue aree di **raso molto rado orizzontale** — a pettine (va e torna sulla stessa linea)
// o normale. Fra il rado del ricamo si intravede il fondo: è l'effetto d'intreccio del broccato.
//
// Le misure di riferimento vengono dalla decodifica di `PUNTO-BROCCATO` (BROCCATO.dst, 84.530 punti):
// passo fra le righe 0,4–0,8 mm, punto 1,7–3,3 mm, ritorno del pettine sfalsato di 0,1 mm, passaggi
// orizzontali dal 67 al 99%, e la copertura dei passaggi che cala lungo l'ordine dei colori
// (81 → 77 → 66 → 53 → 51 → 29 → 0%): ogni colore nasconde i propri passaggi sotto i successivi,
// l'ultimo non ha più niente sopra (R16).

import { type Rgb, rgbToHex, hexToRgb } from '@rg/core';

// ------------------------------------------------------------
// Immagine
// ------------------------------------------------------------

/** Pixel già rasterizzati: RGBA riga per riga. Lo produce tool.ts col canvas, l'unico pezzo a DOM. */
export interface PixelImage {
  rgba: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

// ------------------------------------------------------------
// Colori: ognuno è un ago, e l'ordine è l'ordine di cucitura
// ------------------------------------------------------------

/**
 * Cosa fa un colore della palette.
 * - `macchia`  — riempie le AREE in cui l'immagine ha quel colore (il caso normale);
 * - `base`     — riempie TUTTA la sagoma a righe intere, sotto tutto il resto (nel DST di
 *                riferimento sono i primi due aghi: righe da 188 mm, passo 0,8 mm);
 * - `escluso`  — non si ricama. Serve a togliere il colore di fondo dell'immagine: lì non nasce
 *                nessuna macchia e resta la base a coprire.
 */
export type BroccatoColorRole = 'macchia' | 'base' | 'escluso';

export const COLOR_ROLE_LABELS: Record<BroccatoColorRole, string> = {
  macchia: 'Macchia',
  base: 'Base (tutta la sagoma)',
  escluso: 'Escluso dall’immagine',
};

/** Come si costruisce la striscia di raso. */
export type FillMode = 'pettine' | 'normale';

export const FILL_MODE_LABELS: Record<FillMode, string> = {
  pettine: 'A pettine (va e torna)',
  normale: 'Normale (serpentina)',
};

/** Un ago: la sua tinta, cosa riempie, quanto fitto e come. L'ordine nell'array È l'ordine di cucitura. */
export interface BroccatoColor {
  /** Tinta #rrggbb, come catturata dall'immagine o scelta col contagocce. */
  hex: string;
  role: BroccatoColorRole;
  /** Passo fra le righe di filo (R22, `densitySpacingMm`): piccolo = fitto, grande = rado. */
  densitySpacingMm: number;
  mode: FillMode;
}

/** Quanti aghi regge il sistema: deciso con Lorenzo, base compresa. */
export const MIN_COLORS = 4;
export const MAX_COLORS = 8;

// ------------------------------------------------------------
// Parametri
// ------------------------------------------------------------

export interface BroccatoParams {
  // --- 01 Immagine (R11: la misura nasce dalla sorgente → pannello Testa A) ---
  /** Larghezza reale della sagoma. >0 = fonte di verità, prevale su qualsiasi stima (R11). */
  realWidthMm: number;
  /** DPI usato per stimare i mm quando `realWidthMm` è 0 (R11, §3.4). */
  dpiDefault: number;
  /** Risoluzione di lavoro: l'immagine viene ridotta a questa larghezza in pixel prima di analizzarla. */
  maxWidthPx: number;

  // --- 02 Riduzione a poche tinte ---
  /** Quante tinte (4–8, base compresa). */
  colorCount: number;
  /**
   * Pareggio della luce prima di quantizzare, in mm (0 = spento). Toglie la variazione LENTA di tono
   * (illuminazione, sporco, invecchiamento) e lascia le differenze di disegno: è ciò che fa cadere
   * sullo stesso ago lo stesso motivo ripetuto in punti diversi del tessuto.
   */
  flattenLightMm: number;
  /** Attenuazione della grana tenendo i bordi, in mm (0 = spenta). */
  smoothMm: number;
  /** Area minima di una macchia: sotto questa soglia sparisce e va al colore vicino. */
  minBlobMm2: number;

  // --- 03 Colori (in ordine di cucitura) ---
  colors: BroccatoColor[];

  // --- 04 Riempimento ---
  /** Orientamento unico di tutte le righe (R24 `fillAngleDeg`). 0 = orizzontale, com'è nel riferimento. */
  fillAngleDeg: number;
  /** Passo massimo lungo la riga (R4). Nel riferimento: 2,7 e 3,3 mm, costanti per ago. */
  maxStitchMm: number;
  /** Punto minimo, imposto DOPO il routing (R3). */
  minStitchMm: number;
  /** Di quanto il ritorno del pettine si sposta per non ricadere negli stessi buchi (0,1 mm nel riferimento). */
  retraceOffsetMm: number;
  /**
   * Fermatura di uscita (R8): quanti punti cortissimi in fondo a ogni ago, prima del cambio-colore.
   * 0 = nessuna. Nel DST di riferimento sono **4**, e non c'è fermatura in ingresso.
   */
  endLockCount: number;
  /** Lunghezza dei punti di fermatura. Nel riferimento 0,30 mm. */
  endLockMm: number;

  // --- 05 Passaggi ---
  /** Passo dei punti di passaggio (§3.1). */
  travelStitchMm: number;
  /** Distanza di sicurezza dal bordo e dalle aree vuote (R5, §3.2). */
  voidClearanceMm: number;
}

export const defaultBroccatoParams: BroccatoParams = {
  realWidthMm: 0,
  dpiDefault: 96,
  maxWidthPx: 900,

  // I tre default della riduzione stabile sono MISURATI, non scelti (punto ②, vedi reduce.ts):
  //  · 15 mm di pareggio = il raggio più piccolo che NON svuota le campiture piene (10/25/45 mm
  //    restano di una tinta sola al 100%), tenendo la somiglianza fra ripetizioni all'85-98%.
  //    Sotto i 12 mm la somiglianza sarebbe anche più alta, ma una macchia da 45 mm si svuota;
  //  · 0,9 mm di grana = tre passate di mediana, il punto in cui smette di migliorare;
  //  · 20 mm² di area minima = l'ordine di grandezza delle macchie tenute nel DST di riferimento,
  //    e la soglia che porta le isole da 1.029 a 27 senza isole residue sotto misura.
  colorCount: 6,
  flattenLightMm: 15,
  smoothMm: 0.9,
  minBlobMm2: 20,

  colors: [],

  fillAngleDeg: 0,
  maxStitchMm: 3.0,
  minStitchMm: 1.0,
  retraceOffsetMm: 0.1,
  endLockCount: 4,
  endLockMm: 0.3,

  travelStitchMm: 3.0,
  voidClearanceMm: 0.3,
};

// ------------------------------------------------------------
// Cattura dei colori e riduzione
// ------------------------------------------------------------

/** Numero di tinte riportato dentro i limiti del sistema (4–8). */
export const clampColorCount = (n: number): number =>
  Math.max(MIN_COLORS, Math.min(MAX_COLORS, Math.round(Number(n) || MIN_COLORS)));

/**
 * Trasforma una palette in righe di colore pronte per il pannello, **conservando** le scelte già
 * fatte dall'utente (ruolo, densità, modo) per le tinte che restano: ricatturare i colori non deve
 * buttare via il lavoro di chi sta regolando.
 */
export function paletteToColors(
  palette: Rgb[],
  previous: BroccatoColor[] = [],
  fallback: Partial<BroccatoColor> = {},
): BroccatoColor[] {
  const base: Omit<BroccatoColor, 'hex'> = {
    role: fallback.role ?? 'macchia',
    densitySpacingMm: fallback.densitySpacingMm ?? 0.6,
    mode: fallback.mode ?? 'pettine',
  };
  const byHex = new Map(previous.map((c) => [c.hex.toLowerCase(), c]));
  return palette.map((rgb) => {
    const hex = rgbToHex(rgb);
    const old = byHex.get(hex);
    return old ? { ...old, hex } : { hex, ...base };
  });
}

/** Mette la stessa densità su tutte le righe-colore (il bottone "tutte uguali" chiesto da Lorenzo). */
export function applyDensityToAll(colors: BroccatoColor[], densitySpacingMm: number): BroccatoColor[] {
  return colors.map((c) => ({ ...c, densitySpacingMm }));
}

/** Le tinte correnti come RGB, nell'ordine di cucitura. */
export function colorsToPalette(colors: BroccatoColor[]): Rgb[] {
  return colors.map((c) => hexToRgb(c.hex) ?? [0, 0, 0]);
}

/** Millimetri per pixel: dalla larghezza reale se c'è (R11), altrimenti stima al DPI. */
export function mmPerPixel(widthPx: number, p: Pick<BroccatoParams, 'realWidthMm' | 'dpiDefault'>): number {
  if (p.realWidthMm > 0 && widthPx > 0) return p.realWidthMm / widthPx;
  return 25.4 / (p.dpiDefault > 0 ? p.dpiDefault : 96);
}

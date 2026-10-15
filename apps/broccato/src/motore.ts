// Il contratto del motore (K1b) per Broccato: avvolge la sequenza riduzione → tinte → `buildPlan`.
// La sequenza stava dentro `analyze()` di tool.ts: ora è qui (`calcolaPiano`), pura, e tool.ts la chiama.
import { reduceStable, type ReduceResult, refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { colorsToPalette, mmPerPixel, paletteToColors, type BroccatoParams, type PixelImage } from './engine';
import { buildPlan, type BroccatoPlan } from './pipeline';

/** L'immagine (`immagine`) è già alla larghezza di lavoro (`maxWidthPx`), come la dà `Source.pixelsAt`. */
export type IngressoBroccato = Ingresso;

export interface PianoCalcolato {
  res: ReduceResult;
  mmpp: number;
  plan: BroccatoPlan;
  /** Le righe-colore usate (quelle di `params.colors`, o le tinte appena catturate). */
  colors: BroccatoParams['colors'];
}

/**
 * Immagine → riduzione → piano di ricamo. `ricattura`: le tinte si ricatturano dall'immagine
 * (altrimenti si usano `params.colors`). Non modifica `params`.
 */
export function calcolaPiano(img: PixelImage, params: BroccatoParams, ricattura: boolean): PianoCalcolato {
  const mmpp = mmPerPixel(img.width, params);
  const nuova = (ricattura || !params.colors.length) && (params.paletteMode === 'auto' || !params.colors.length);
  const res = reduceStable(img, {
    colorCount: params.colorCount,
    flattenLightMm: params.flattenLightMm,
    smoothMm: params.smoothMm,
    minBlobMm2: params.minBlobMm2,
    mmPerPx: mmpp,
    palette: nuova ? undefined : colorsToPalette(params.colors),
  });
  const colors = nuova ? paletteToColors(res.palette, params.colors) : params.colors;
  const plan = buildPlan(res, nuova ? { ...params, colors } : params, mmpp, {
    widthMm: img.width * mmpp,
    heightMm: img.height * mmpp,
  });
  return { res, mmpp, plan, colors };
}

export const motore: Motore<IngressoBroccato, BroccatoParams> = {
  id: 'broccato',
  async genera(ingresso, params) {
    const im = ingresso.immagine;
    if (!im) throw new Error('broccato: serve `ingresso.immagine`');
    const img: PixelImage = { rgba: im.pixel, width: im.larghezza, height: im.altezza };
    const { plan } = calcolaPiano(img, params, false);
    const strati = plan.exportLayers;
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

import { reduceStable } from '@rg/core';
import { defaultBroccatoParams, mmPerPixel, paletteToColors } from '../../apps/broccato/src/engine';
import { buildPlan } from '../../apps/broccato/src/pipeline';
import { sampleImage } from '../../apps/broccato/src/sample';

// L'immagine demo del tool (il finto broccato) a 200x160 px, coi valori di partenza (colors vuoto: le tinte si catturano).
export async function prova() {
  const img = sampleImage(200, 160);
  const params = { ...defaultBroccatoParams, colors: [] as typeof defaultBroccatoParams.colors };
  const mmpp = mmPerPixel(img.width, params);
  return {
    ingresso: { immagine: { larghezza: img.width, altezza: img.height, pixel: img.rgba, pxPerMm: 1 / mmpp } },
    params,
    // la strada di prima: la sequenza che faceva analyze() in tool.ts
    diretto: () => {
      const p = { ...params, colors: [] as typeof params.colors };
      const res = reduceStable(img, {
        colorCount: p.colorCount, flattenLightMm: p.flattenLightMm, smoothMm: p.smoothMm, minBlobMm2: p.minBlobMm2,
        mmPerPx: mmpp, palette: undefined,
      });
      p.colors = paletteToColors(res.palette, p.colors);
      return buildPlan(res, p, mmpp, { widthMm: img.width * mmpp, heightMm: img.height * mmpp }).exportLayers;
    },
  };
}

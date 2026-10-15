// Il contratto del motore (K1b) per Bitmap → Stitch: avvolge la fase PESANTE (`runBitmapPipeline`), senza cambiare niente.
// L'analisi/anteprima (`analyzeBitmap`, `runBitmapPreview`) non entra nel contratto e resta com'è.
import { refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import type { BitmapParams } from './engine';
import { runBitmapPipeline } from './pipeline';

/**
 * L'immagine (`immagine`: pixel RGBA già alla risoluzione di lavoro, e `pxPerMm`) più, se l'utente l'ha scelta,
 * la sola tinta da generare (`soloColore`, esadecimale: «solo questo colore» del pannello).
 */
export interface IngressoBitmap extends Ingresso {
  soloColore?: string;
}

export const motore: Motore<IngressoBitmap, BitmapParams> = {
  id: 'bitmap',
  async genera(ingresso, params) {
    const im = ingresso.immagine;
    if (!im) throw new Error('bitmap: manca l\'immagine');
    // gli strati sono quelli dell'export (un gruppo per stop, in ordine di cucitura)
    const res = runBitmapPipeline(im.pixel, im.larghezza, im.altezza, params, 1 / im.pxPerMm, ingresso.soloColore || undefined);
    const strati = res.exportLayers;
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

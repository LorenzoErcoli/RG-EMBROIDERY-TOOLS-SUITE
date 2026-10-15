// Il contratto del motore (K1b) per il Punto Pittorico: avvolge `buildPittoricoPlan` + `pittoricoExportLayers`, senza cambiare niente.
import { refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import type { Point } from '@rg/core';
import { buildPittoricoPlan, pittoricoExportLayers, type PittoricoParams } from './pipeline';

/** I parametri come li salva il tool: tutti quelli di `PittoricoParams` tranne i tagli fatti a mano (che sono ingresso). */
export type ParamsPittorico = Omit<PittoricoParams, 'tagliAggiunti' | 'tagliRimossi'>;

/** Oltre all'immagine (`immagine`): i tagli dell'asse fatti a mano (solo per il metodo «colonne»), in mm. */
export interface IngressoPittorico extends Ingresso {
  /** Tagli aggiunti a mano, per punto (mm). */
  tagliAggiunti?: Point[];
  /** Tagli automatici tolti a mano, per punto (mm). */
  tagliRimossi?: Point[];
}

export const motore: Motore<IngressoPittorico, ParamsPittorico> = {
  id: 'pittorico',
  async genera(ingresso, params) {
    const im = ingresso.immagine;
    if (!im) throw new Error('pittorico: serve `ingresso.immagine`');
    const img = { rgba: im.pixel, width: im.larghezza, height: im.altezza };
    // come tool.ts: la larghezza reale vale per l'immagine intera; a 0 un pixel vale un millimetro
    const p: PittoricoParams = {
      ...params,
      realWidthMm: params.realWidthMm > 0 ? params.realWidthMm : img.width,
      tagliAggiunti: ingresso.tagliAggiunti ?? [],
      tagliRimossi: ingresso.tagliRimossi ?? [],
    };
    const piano = buildPittoricoPlan(img, p);
    const strati = pittoricoExportLayers(piano);
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

// Il contratto del motore (K1b) per Interlace: avvolge `runPipeline`, senza cambiare niente.
import { applyRealWidth, type Contour } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { runPipeline, type RoleAssignment } from './pipeline';
import type { ImageColorAt, InterlaceParams } from './engine';

/** Oltre alla sagoma (`sagoma`) e all'immagine di riferimento (`immagine`, serve agli agglomerati):
 *  il ruolo di ogni colore, che l'utente sceglie a mano. */
export interface IngressoInterlace extends Ingresso {
  ruoli: RoleAssignment;
}

/**
 * Campionatore colore dell'immagine per gli agglomerati (mm → RGB), o undefined se non c'è immagine o
 * `clusterMode` è spento. L'immagine copre il riquadro del disegno (già scalato alla larghezza reale).
 * (Spostato qui da tool.ts: stesso codice, senza il DOM.)
 */
export function campionatoreImmagine(
  immagine: { pixel: Uint8ClampedArray; larghezza: number; altezza: number } | undefined,
  contorni: Contour[],
  clusterMode: boolean,
): ImageColorAt | undefined {
  if (!immagine || !clusterMode) return undefined;
  const { pixel: data, larghezza: w, altezza: h } = immagine;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contorni) for (const p of c.points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const dw = maxX - minX || 1, dh = maxY - minY || 1;
  return (x: number, y: number): [number, number, number] | null => {
    const u = (x - minX) / dw, v = (y - minY) / dh;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
    const py = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
    const i = (py * w + px) * 4;
    if (data[i + 3] < 128) return null; // trasparente
    return [data[i], data[i + 1], data[i + 2]];
  };
}

export const motore: Motore<IngressoInterlace, InterlaceParams> = {
  id: 'interlace',
  async genera(ingresso, params) {
    // Come il tool: la larghezza reale (0 = quella letta dal file) scala i contorni prima della pipeline.
    const sagoma = ingresso.sagoma ?? [];
    let wMm = ingresso.larghezzaMm;
    if (wMm === undefined) {
      let a = Infinity, b = -Infinity;
      for (const c of sagoma) for (const p of c.points) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; }
      wMm = b > a ? b - a : 0;
    }
    const contorni = applyRealWidth({ contours: sagoma, widthMm: wMm, heightMm: 0, method: 'declared' }, params.realWidthMm);
    const imageColorAt = campionatoreImmagine(ingresso.immagine, contorni, params.clusterMode);
    const { exportLayers } = runPipeline(contorni, ingresso.ruoli, params, { imageColorAt });
    return { strati: exportLayers, avvisi: [] };
  },
};

import { dstFromExportLayers } from '@rg/core';
import { PARAMETRI_RAZZA, costruisci, pezzoDa, stratiPerDst } from '../../apps/razza/src/motore';

// La «C» dello smoke (apertura a sinistra, come il pezzo vero), con un pallino fisso e una sfumatura.
export async function prova() {
  const pezzo = pezzoDa([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 55 }, { x: 70, y: 55 }, { x: 70, y: 25 }, { x: 0, y: 25 }]);
  const fissi = [{ x: 100, y: 40, diamMm: 6 }];
  const sfumature = [{ a: { x: 5, y: 5 }, b: { x: 60, y: 5 }, diamAMm: 2, diamBMm: 5 }];
  const params = { ...PARAMETRI_RAZZA, seed: 3 };
  return {
    ingresso: { pezzo, fissi, sfumature },
    params,
    // la strada di prima: quello che faceva tool.ts per il DST (Worker → costruisci, poi stratiPerDst)
    diretto: () => stratiPerDst(costruisci(pezzo, params, fissi, sfumature)).layers,
    // il DST che il tool esporta davvero (tool.ts: center:false, perché gli strati sono già sulla griglia da 0,1 mm)
    dst: () => dstFromExportLayers(stratiPerDst(costruisci(pezzo, params, fissi, sfumature)).layers, { label: 'RAZZA', center: false }),
  };
}

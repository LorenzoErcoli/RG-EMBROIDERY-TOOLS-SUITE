import { defaultInterlaceParams } from '../../apps/interlace/src/engine';
import { sampleContours } from '../../apps/interlace/src/sample';
import { runPipeline } from '../../apps/interlace/src/pipeline';

// La sagoma demo del tool (area ricamabile + vuoto), ruoli come nel tool, valori di partenza del motore.
// Densità più larga e punto massimo 9 (il DST spezza i punti lunghi: col 15 di default il conto non torna) per girare in pochi secondi.
export async function prova() {
  const sagoma = sampleContours();
  const ruoli = { [sagoma[0].color]: 'MASTER_OUTLINE' as const, [sagoma[1].color]: 'EXCLUSION' as const };
  const params = { ...defaultInterlaceParams, densitySpacingMm: 3, maxStitchMm: 9 };
  return {
    ingresso: { sagoma, ruoli },
    params,
    // la strada di prima: la chiamata che faceva tool.ts (realWidth 0, niente immagine)
    diretto: () => runPipeline(sagoma, ruoli, params, { imageColorAt: undefined }).exportLayers,
  };
}

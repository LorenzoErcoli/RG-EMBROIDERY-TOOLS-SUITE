import { defaultStriaturaParams } from '../../apps/striatura/src/engine';
import { sampleContours } from '../../apps/striatura/src/sample';
import { runPipeline } from '../../apps/striatura/src/pipeline';

// La sagoma demo del tool (rettangolo arrotondato + vuoto circolare), coi ruoli dei colori, e i valori di partenza.
export async function prova() {
  const sagoma = sampleContours();
  const ruoli = { [sagoma[0].color]: 'MASTER_OUTLINE' as const, [sagoma[1].color]: 'EXCLUSION' as const };
  const params = { ...defaultStriaturaParams };
  return {
    ingresso: { sagoma, ruoli },
    params,
    // la strada di prima: la chiamata che faceva tool.ts per l'export (DST/SVG)
    diretto: () => runPipeline(sagoma, ruoli, params).exportLayers,
  };
}

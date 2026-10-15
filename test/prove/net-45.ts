import { defaultNetParams } from '@rg/core';
import { sampleContours } from '../../apps/net-45/src/sample';
import { runPipeline } from '../../apps/net-45/src/pipeline';

// La sagoma demo del tool (la punta a V), col suo colore come perimetro, e i valori di partenza.
export async function prova() {
  const sagoma = sampleContours();
  const ruoli = { [sagoma[0].color]: 'MASTER_OUTLINE' as const };
  const params = { ...defaultNetParams };
  return {
    ingresso: { sagoma, ruoli },
    params,
    // la strada di prima: la chiamata che faceva tool.ts
    diretto: () => runPipeline(sagoma, ruoli, params).layers,
  };
}

import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultBitmapParams } from '../../apps/bitmap/src/engine';

// Cosa salva il tool bitmap in `params`: tutte le chiavi di defaultBitmapParams (restoreParams le rilegge così).
// Le liste (sampleColors, manualColors, manualTolerances) non sono scalari: il registro non ha ancora un tipo lista, stanno nel debito.
// backgroundColors è una lista scritta nel pannello come testo separato da virgola: si registra come testo.
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(defaultBitmapParams)) {
    if (k === 'backgroundColors') out[k] = (v as string[]).join(',');
    else if (Array.isArray(v)) out[k] = v as Valore; // lista: nel debito
    else out[k] = v as Valore;
  }
  return out;
}

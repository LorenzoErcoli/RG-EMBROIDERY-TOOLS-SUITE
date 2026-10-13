import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultBroccatoParams } from '../../apps/broccato/src/engine';

// Broccato salva `{ ...params }` (paramsSalvabili): tutti i campi di BroccatoParams.
// `colors` è un blob (righe di colore), non un parametro: fuori.
export function salvati(): Record<string, Valore> {
  const r: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(defaultBroccatoParams)) {
    if (k === 'colors') continue;
    r[k] = v as Valore;
  }
  return r;
}

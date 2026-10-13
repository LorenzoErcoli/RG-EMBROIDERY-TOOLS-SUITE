import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_RAZZA } from '../../apps/razza/src/tipi';

// Cosa salva il tool razza: `params` = ParametriRazza (default PARAMETRI_RAZZA, DOM-free).
// `fissi`, `sfumature`, `contorno`, `vuoti` sono dati, non parametri.
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(PARAMETRI_RAZZA).map(([k, v]) => [k, v as Valore]));
}

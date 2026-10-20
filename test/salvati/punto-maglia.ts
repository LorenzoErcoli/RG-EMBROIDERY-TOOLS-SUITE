import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_MAGLIA } from '../../apps/punto-maglia/src/motore';

// Cosa salva il tool punto-maglia: `params` = ParametriMaglia (default PARAMETRI_MAGLIA, DOM-free).
// `tratti` sono il disegno, non parametri.
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(PARAMETRI_MAGLIA).map(([k, v]) => [k, v as Valore]));
}

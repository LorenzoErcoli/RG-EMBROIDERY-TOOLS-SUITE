import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultObliqueParams } from '../../apps/oblique/src/engine';

// Oblique salva `params` (tutto ObliqueParams, dai default del motore) e `roles` (ruolo→colore: blob, non parametri).
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(defaultObliqueParams())) as Record<string, Valore>;
}

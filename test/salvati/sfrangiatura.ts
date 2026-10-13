import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultSfrangiaturaParams } from '../../apps/sfrangiatura/src/frange';

// Sfrangiatura salva `params` (i 7 default sotto) e `zone` (poligoni marcati: blob, non parametro).
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(defaultSfrangiaturaParams)) as Record<string, Valore>;
}

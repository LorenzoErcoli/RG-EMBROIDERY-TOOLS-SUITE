import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultInterlaceParams } from '../../apps/interlace/src/engine';

// Cosa salva il tool interlace in `params`, dai default del motore (engine.ts, senza DOM).
// Le liste (colors, colorDensities, colorTolerances, zoneBans) non hanno ancora un tipo nel registro: stanno nel debito.
// Fuori: roles, object, refImage sono blob, non parametri.
export function salvati(): Record<string, Valore> {
  const r: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(defaultInterlaceParams)) r[k] = v as Valore;
  return r;
}

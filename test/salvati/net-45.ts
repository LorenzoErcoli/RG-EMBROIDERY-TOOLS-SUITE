import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultNetParams } from '@rg/core';

// Cosa salva il tool net-45 in `params`: l'oggetto NetParams intero (apps/net-45/src/tool.ts: params = { ...defaultNetParams }).
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(defaultNetParams)) as Record<string, Valore>;
}

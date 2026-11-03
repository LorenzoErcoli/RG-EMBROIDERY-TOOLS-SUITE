import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_RETE } from '../../apps/rete-catenella/src/motore';

// Cosa salva rete-catenella nel progetto: `params` = PARAMETRI_RETE (progetto() in tool.ts).
// Il modulo non si salva nel file, solo il suo nome: è del cliente, e sta fuori dalla suite.
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(PARAMETRI_RETE)) out[k] = v as Valore;
  return out;
}

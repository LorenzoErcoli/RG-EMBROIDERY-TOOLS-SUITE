import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_RETE } from '../../apps/rete-testa-speciale/src/motore';

// Cosa salva rete-testa-speciale nel progetto: `params` = PARAMETRI_RETE (progetto() in tool.ts).
// `ruoli` (colore → contorno / area vuota) e il disegno sono dati, non parametri.
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(PARAMETRI_RETE)) out[k] = v as Valore;
  return out;
}

import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_MACCHIE } from '../../apps/pattern-macchie/src/motore';

// Cosa salva pattern-macchie nel progetto: `params` = PARAMETRI_MACCHIE (progetto() in tool.ts).
// `pattern` (preset del Generatore pattern + nome) e `ruoli` (colore→ruolo) sono dati, non parametri propri.
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(PARAMETRI_MACCHIE)) out[k] = v as Valore;
  return out;
}

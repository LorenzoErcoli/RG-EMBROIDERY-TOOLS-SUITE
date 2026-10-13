import type { Valore } from '../../packages/cervello/src/tipi';
import { PATTERN_FIELDS, ZONE_FIELDS } from '../../apps/zone-pattern/src/fields';

// Cosa salva «Pattern a zone» in `params`: i campi di «Zone e sequenza» e, per ogni pattern in uso,
// i campi del pattern prefissati dalla lettera (A.stepX…). Qui la lettera A; B, C… sono identiche.
// (initialConfig() in tool.ts parte dai soli campi di zona; ensurePattern() aggiunge quelli del pattern.)
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const f of ZONE_FIELDS) out[f.name] = f.value;
  for (const f of PATTERN_FIELDS) out[`A.${f.name}`] = f.value;
  return out;
}

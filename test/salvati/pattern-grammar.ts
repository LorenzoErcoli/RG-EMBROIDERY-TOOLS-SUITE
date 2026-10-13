import type { Valore } from '../../packages/cervello/src/tipi';
import { ALL_FIELD_GROUPS } from '../../apps/pattern-grammar/src/fields';

// Cosa salva il Generatore pattern: `params` = la config del pannello (ogni campo di fields.ts, con il suo
// valore iniziale: è esattamente `initialConfig()` di tool.ts, che non si importa perché tocca il DOM)
// senza importedBoundary, sourceAnalysis, reliefAreas (non sono parametri: sagoma, analisi, aree).
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const g of ALL_FIELD_GROUPS) for (const f of g.fields) out[f.name] = f.value;
  return out;
}

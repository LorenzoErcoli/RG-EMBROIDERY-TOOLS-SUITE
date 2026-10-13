import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultPittoricoParams } from '../../apps/pittorico/src/pipeline';

// Cosa salva il tool pittorico: `params: { ...params }` (tool.ts, metadati), cioè tutte le chiavi di
// defaultPittoricoParams. Fuori restano tagliAggiunti e tagliRimossi: liste di punti (blob, non parametri).
const BLOB = new Set(['tagliAggiunti', 'tagliRimossi']);

export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(defaultPittoricoParams)) {
    if (!BLOB.has(k)) out[k] = v as Valore;
  }
  return out;
}

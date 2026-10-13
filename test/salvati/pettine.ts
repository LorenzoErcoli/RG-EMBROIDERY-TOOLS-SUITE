import type { Valore } from '../../packages/cervello/src/tipi';
import { parametriPettineDefault } from '../../apps/pettine/src/motore';

// Cosa salva il tool pettine: l'oggetto `par` del progetto (tool.ts: `par = { ...parametriPettineDefault }`).
// `golaMm` non e' nei default del motore ma il pannello lo mostra a 30 (il motore usa `par.golaMm ?? 30`)
// e finisce in `par` appena si tocca il campo: lo si conta con quel valore.
// `larghezzaRealeMm` sta alla radice del progetto, non in `par`: non e' qui (vedi rapporto).
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  for (const [k, v] of Object.entries(parametriPettineDefault)) out[`par.${k}`] = v as Valore;
  out['par.golaMm'] = 30;
  // Alla radice del progetto, non in `par`: il registro non ha ancora un posto per questi (debito). Il default 419.45 sta in tool.ts (DOM).
  out['larghezzaRealeMm'] = 419.45;
  out['ritaglio'] = null; // riquadro {x, y, larghezza, altezza}: oggetto, nessun default nel motore
  return out;
}

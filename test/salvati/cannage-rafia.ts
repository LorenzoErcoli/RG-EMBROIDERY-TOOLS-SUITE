import type { Valore } from '../../packages/cervello/src/tipi';
import { PARAMETRI_DAVANTI } from '../../apps/cannage-rafia/src/linee';
import { PARAMETRI_STOP } from '../../apps/cannage-rafia/src/stop';
import { PARAMETRI_CORNICE } from '../../apps/cannage-rafia/src/cornice';
import { PARAMETRI_BORDATURA } from '../../apps/cannage-rafia/src/bordatura';
import { BASI_VALORI, PROGRAMMA_VALORI, valoriCorniceDa, valoriDa } from '../../apps/cannage-rafia/src/fields';

// Cosa salva il cannage (progetto() in tool.ts): `params` (linee, davanti), `stop`, `basiParams`,
// `cornice`, `programma`, `bordatura`. Non sono parametri: basi (nomi dei pattern), latiBordatura,
// ruoli, drawing.
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  const dentro = (dove: string | null, o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) out[dove ? `${dove}.${k}` : k] = v as Valore;
  };
  dentro(null, valoriDa(PARAMETRI_DAVANTI));
  dentro('stop', PARAMETRI_STOP);
  dentro('basiParams', BASI_VALORI);
  dentro('cornice', valoriCorniceDa(PARAMETRI_CORNICE));
  dentro('programma', PROGRAMMA_VALORI);
  dentro('bordatura', PARAMETRI_BORDATURA);
  return out;
}

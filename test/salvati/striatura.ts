import type { Valore } from '../../packages/cervello/src/tipi';
import { defaultStriaturaParams } from '../../apps/striatura/src/engine';

// Punto Striato salva `params` (= defaultStriaturaParams, tutti i campi) e `roles` (assegnazione dei
// ruoli ai colori: non è un parametro, non si registra).
export function salvati(): Record<string, Valore> {
  return Object.fromEntries(Object.entries(defaultStriaturaParams)) as Record<string, Valore>;
}

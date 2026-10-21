// Il contratto del motore (K1b) per Rete 45°: avvolge `runPipeline`, senza cambiare niente.
import type { NetParams } from '@rg/core';
import { refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { runPipeline, type RoleAssignment } from './pipeline';

/** Oltre alla sagoma (`sagoma`), quello che l'utente sceglie a mano: il ruolo di ogni colore (R12). */
export interface IngressoNet45 extends Ingresso {
  ruoli: RoleAssignment;
}

export const motore: Motore<IngressoNet45, NetParams> = {
  id: 'net-45',
  async genera(ingresso, params) {
    const { layers } = runPipeline(ingresso.sagoma ?? [], ingresso.ruoli, params);
    const strati = layers;
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

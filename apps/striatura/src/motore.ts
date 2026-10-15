// Il contratto del motore (K1b) per Punto Striato: avvolge `runPipeline`, senza cambiare niente.
// Gli strati sono quelli dell'export (DST/SVG): `exportLayers`, non quelli dell'anteprima.
import { refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { runPipeline, type RoleAssignment } from './pipeline';
import type { StriaturaParams } from './engine';

/** Oltre alla sagoma (`sagoma`), quello che l'utente sceglie a mano: il ruolo di ogni colore (R12). */
export interface IngressoStriatura extends Ingresso {
  ruoli: RoleAssignment;
}

export const motore: Motore<IngressoStriatura, StriaturaParams> = {
  id: 'striatura',
  async genera(ingresso, params) {
    const { exportLayers } = runPipeline(ingresso.sagoma ?? [], ingresso.ruoli, params);
    const strati = exportLayers;
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

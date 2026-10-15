// Il contratto del motore (K1b) per Sfrangiatura: avvolge `readDst` + `sfrangia`, senza cambiare niente.
//
// Il tool non ha ExportLayer propri: ne rilavora un DST e oggi esporta i blocchi riscritti direttamente
// (`dstProgramFromBlocks`, in tool.ts). Gli strati del contratto sono quegli stessi blocchi, uno strato per
// ago, ogni blocco una polilinea: stessi punti, nello stesso ordine.
import { readDst, type ExportLayer, type Point } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import { sfrangia, type FrangiaParams } from './frange';
import { TINTE } from './vista';

/** Oltre al DST (`dst`), quello che l'utente fa a mano: le zone pennellate e gli aghi su cui non intervenire. */
export interface IngressoSfrangiatura extends Ingresso {
  /** Poligoni in mm, nelle coordinate del ricamo (le passate di pennello). */
  zone: Point[][];
  /** Numeri d'ago (di `readDst`) da lasciare stare. Vuoto/assente = tutti sfrangiabili. */
  aghiEsclusi?: number[];
}

/** I valori che il tool salva nel file di progetto (`params`): le 7 chiavi di `defaultSfrangiaturaParams`. */
export type ParamsSfrangiatura = FrangiaParams & { pennelloMm: number };

/** I blocchi riscritti come strati: uno per ago, un'andata di filo per blocco. */
export function blocchiAStrati(blocchi: Array<{ needle: number; points_mm: Array<[number, number]> }>): ExportLayer[] {
  const perAgo = new Map<number, ExportLayer>();
  for (const b of blocchi) {
    if (b.points_mm.length < 2) continue;
    let l = perAgo.get(b.needle);
    if (!l) {
      l = { id: `ago-${b.needle}`, color: TINTE[(b.needle - 1) % TINTE.length], polylines: [], strokeMm: 0.1 };
      perAgo.set(b.needle, l);
    }
    l.polylines.push(b.points_mm.map(([x, y]) => ({ x, y })));
  }
  return [...perAgo.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
}

export const motore: Motore<IngressoSfrangiatura, ParamsSfrangiatura> = {
  id: 'sfrangiatura',
  async genera(ingresso, params) {
    if (!ingresso.dst) throw new Error('Sfrangiatura: serve un ricamo di partenza (ingresso.dst).');
    const letto = readDst(ingresso.dst);
    if (!letto.blocks.length) throw new Error('nessun blocco cucito');
    const esito = sfrangia(letto.blocks, ingresso.zone ?? [], { ...params, aghiEsclusi: [...(ingresso.aghiEsclusi ?? [])] });
    return { strati: blocchiAStrati(esito.blocchi), avvisi: [] };
  },
};

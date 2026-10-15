// Il contratto del motore (K1b) per il Generatore pattern: avvolge `generateFinalPatternPoints`, senza cambiare niente.
import { generateFinalPatternPoints, type PatternConfig } from '@rg/pattern-grammar';
import type { ExportLayer } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';

/** Quello che il tool salva in `params` nel file di progetto: la config del pannello, senza le parti d'ingresso. */
export type ParamsPatternGrammar = Omit<PatternConfig, 'importedBoundary' | 'sourceAnalysis' | 'reliefAreas'>;

/**
 * Le parti proprie del tool: la sagoma importata (con i ruoli già risolti), l'analisi del disegno e gli anelli
 * delle aree di scarico. Fanno parte della config che legge il motore, ma non si salvano fra i parametri.
 */
export interface IngressoPatternGrammar extends Ingresso {
  importedBoundary?: PatternConfig['importedBoundary'];
  sourceAnalysis?: PatternConfig['sourceAnalysis'];
  reliefAreas?: PatternConfig['reliefAreas'];
}

export const motore: Motore<IngressoPatternGrammar, ParamsPatternGrammar> = {
  id: 'pattern-grammar',
  async genera(ingresso, params) {
    const cfg = { ...params } as PatternConfig;
    if (ingresso.importedBoundary !== undefined) cfg.importedBoundary = ingresso.importedBoundary;
    if (ingresso.sourceAnalysis !== undefined) cfg.sourceAnalysis = ingresso.sourceAnalysis;
    if (ingresso.reliefAreas !== undefined) cfg.reliefAreas = ingresso.reliefAreas;
    return { strati: [stratoPattern(cfg)], avvisi: [] };
  },
};

/** Il pattern è un filo continuo: un solo strato cucito (un ago), una polilinea per tratto visibile, in mm. */
export function stratoPattern(cfg: PatternConfig): ExportLayer {
  const final = generateFinalPatternPoints(cfg);
  return {
    id: 'pattern', color: '#005f27',
    polylines: final.visualPolylines.map((pl) => pl.map((p) => ({ x: p.x, y: p.y }))),
  };
}

import { parseImportedBoundarySource } from '@rg/pattern-grammar';
import type { PatternConfig } from '@rg/pattern-grammar';
import { costruisciMacchie, PARAMETRI_MACCHIE } from '../../apps/pattern-macchie/src/motore';

// Il pannello di prova di Lorenzo (le prime 12 macchie, per stare in pochi secondi), il pattern a squame e i valori di partenza.
export async function prova() {
  // il bundle è «neutral» (niente builtin di node nei sorgenti): si carica fs con un import non letterale
  const modulo = 'node:fs';
  const { readFileSync } = await import(modulo) as typeof import('node:fs');
  const radice = new URL('../../', import.meta.url);
  const pm = parseImportedBoundarySource(readFileSync(new URL('test/fixtures/macchie-pannello.svg', radice), 'utf8'), 'macchie.svg', { scaleMode: 'illustrator-72dpi' });
  const pannello = pm.choices.find((c) => c.color === '#e52521')!.boundary.paths[0].points;
  const macchie = pm.choices.find((c) => c.color === '#ede300')!.boundary.paths.map((p) => p.points).slice(0, 12);
  const pattern = JSON.parse(readFileSync(new URL('apps/pattern-grammar/src/presets.shared.json', radice), 'utf8'))['RG-PUNTO NASTRO — SQUAME'] as PatternConfig;
  const params = { ...PARAMETRI_MACCHIE };
  return {
    ingresso: { pannello, macchie, pattern },
    params,
    // la strada di prima: la chiamata di tool.ts e gli strati di strati()
    diretto: () => {
      const r = costruisciMacchie(pannello, macchie, pattern, params);
      return (['base', 'raso', 'sopra'] as const).map((k, i) => ({ id: k, color: ['#8a6d4e', '#1f1a17', '#c8952e'][i], polylines: r[k].tratti }));
    },
  };
}

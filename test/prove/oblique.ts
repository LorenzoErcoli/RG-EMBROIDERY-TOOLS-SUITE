import { defaultObliqueParams, generateOblique, moduleFromPolylines, parseModuleSvg } from '../../apps/oblique/src/engine';
import { exportLayersFor } from '../../apps/oblique/src/motore';

// Prova senza cartamodello: formato 100x100 dei valori di partenza, coi 4 moduli built-in del tool (gli SVG veri),
// letti da disco (la prova gira in node). Se non si leggono, ripiega su moduli sintetici (quadretti) come lo smoke.
async function moduli() {
  try {
    const nome = 'node:fs'; // specificatore in variabile: esbuild non lo risolve, lo carica node
    const { readFileSync } = await import(/* @vite-ignore */ nome);
    const leggi = (f: string) => parseModuleSvg(readFileSync(new URL(`../../apps/oblique/src/modules/${f}.svg`, import.meta.url), 'utf8'));
    return { level0: leggi('level0'), level1: leggi('level1'), level2: leggi('level2'), holes: leggi('holes') };
  } catch {
    const q = (s: number) => moduleFromPolylines([[{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }, { x: 0, y: 0 }]]);
    return { level0: q(8), level1: q(8), level2: q(8), holes: q(3) };
  }
}

export async function prova() {
  const m = await moduli();
  const params = defaultObliqueParams();
  return {
    ingresso: { moduli: m, ruoli: {} },
    params,
    // la strada di prima: la chiamata che faceva tool.ts (nessun cartamodello, nessun ruolo) e i suoi strati d'export
    diretto: () => exportLayersFor(generateOblique({ level0: m.level0, level1: m.level1, level2: m.level2, holes: m.holes, panelBounds: undefined }, params, { roles: {}, panelContour: undefined, placementFollowsPattern: false })),
  };
}

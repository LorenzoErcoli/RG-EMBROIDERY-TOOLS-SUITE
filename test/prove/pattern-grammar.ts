import { generateFinalPatternPoints, type PatternConfig } from '@rg/pattern-grammar';
import { ALL_FIELD_GROUPS } from '../../apps/pattern-grammar/src/fields';

// Il pattern di partenza del tool (i default dei campi, come li salva nel file), su un formato piccolo.
export async function prova() {
  const params: Record<string, unknown> = {};
  for (const g of ALL_FIELD_GROUPS) for (const f of g.fields) params[f.name] = f.value;
  params.totalWidth = 60;
  params.totalHeight = 60;
  return {
    ingresso: {},
    params,
    // la strada di prima: la chiamata che faceva tool.ts
    diretto: () => {
      const final = generateFinalPatternPoints({ ...params } as PatternConfig);
      return [{
        id: 'pattern', color: '#005f27',
        polylines: final.visualPolylines.map((pl) => pl.map((p) => ({ x: p.x, y: p.y }))),
      }];
    },
  };
}

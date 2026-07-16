import { writeFileSync } from 'node:fs';
import { sampleContours } from '../src/sample.ts';
import { runPipeline } from '../src/pipeline.ts';
import { defaultNetParams } from '@rg/core';

const { layers, bounds } = runPipeline(
  sampleContours(),
  { '#e73433': 'MASTER_OUTLINE' },
  { ...defaultNetParams },
);
const out = {
  bounds,
  layers: layers.map((l) => ({ id: l.id, color: l.color, shapeOnly: !!l.shapeOnly, polylines: l.polylines })),
};
writeFileSync(new URL('./dump.json', import.meta.url), JSON.stringify(out));
console.log('layers:', out.layers.map((l) => `${l.id}:${l.polylines.length}`).join(' '));

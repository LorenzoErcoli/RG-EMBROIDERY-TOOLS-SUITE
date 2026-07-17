import { readFileSync, writeFileSync } from 'node:fs';
import type { Contour } from '@rg/core';
import { runPipeline } from '../src/pipeline.ts';
import { defaultNetParams, importResultFromContours, applyRealWidth, measureContours } from '@rg/core';

const svg = readFileSync('C:/Users/l.ercoli/Downloads/8J4019 B1S0-B1SR CAMP.svg', 'utf8');
const m = /points="([^"]+)"/.exec(svg)!;
const nums = m[1].trim().split(/\s+/).map(Number);
const K = 25.4 / 96; // px→mm a 96dpi (nessuna width dichiarata)
const pts = [];
for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i] * K, y: nums[i + 1] * K });

const contour: Contour = { points: pts, closed: true, color: '#ff0000' };
const result = importResultFromContours([contour], 'dpi');
console.log('rilevata:', Math.round(result.widthMm), 'x', Math.round(result.heightMm), 'mm');

// Percorso canonico: applica la larghezza reale (prova a 232mm) → tutto scala.
const REAL = 232;
const scaled = applyRealWidth(result, REAL);
const eff = measureContours(scaled);
console.log('reale impostata:', REAL, '→ effettiva', Math.round(eff.widthMm), 'x', Math.round(eff.heightMm), 'mm');

const { layers, bounds } = runPipeline(scaled, { '#ff0000': 'MASTER_OUTLINE' }, { ...defaultNetParams, netInsetMm: 0, rasoBandMm: 7 });
writeFileSync(new URL('./dump.json', import.meta.url), JSON.stringify({
  bounds,
  layers: layers.map((l) => ({ id: l.id, color: l.color, shapeOnly: !!l.shapeOnly, polylines: l.polylines })),
}));
console.log('layers:', layers.map((l) => `${l.id}:${l.polylines.length}`).join(' '));
console.log('net strokeMm:', layers.find((l) => l.id === 'net')!.strokeMm, '(netInset 8mm)');

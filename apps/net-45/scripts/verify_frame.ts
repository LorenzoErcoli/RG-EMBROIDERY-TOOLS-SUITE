import { readFileSync } from 'node:fs';
import type { Contour, SourceFrame } from '@rg/core';
import { runPipeline } from '../src/pipeline.ts';
import { defaultNetParams, buildSvgInSourceFrame } from '@rg/core';

const svg = readFileSync('C:/Users/l.ercoli/Downloads/8J4019 B1S0-B1SR CAMP.svg', 'utf8');
const m = /points="([^"]+)"/.exec(svg)!;
const nums = m[1].trim().split(/\s+/).map(Number);
const K = 25.4 / 96;
const pts: { x: number; y: number }[] = [];
for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i] * K, y: nums[i + 1] * K });

// Frame come lo costruisce io/svg (viewBox "0 0 539 451.1", nessuna width → scala K, offset 0).
const frame: SourceFrame = {
  scaleX: K, scaleY: K, offsetX: 0, offsetY: 0,
  viewBox: '0 0 539 451.1', widthAttr: null, heightAttr: null,
};

const contour: Contour = { points: pts, closed: true, color: '#ff0000' };
const { layers } = runPipeline([contour], { '#ff0000': 'MASTER_OUTLINE' }, { ...defaultNetParams });
const out = buildSvgInSourceFrame(layers, { frame, realWidthFactor: 1 });

const vbOut = /viewBox="([^"]+)"/.exec(out)![1];
// primo punto del layer 'border' (la sagoma) nell'export
const borderG = /<g id="border"[\s\S]*?<polyline points="([^"]+)"/.exec(out);
const firstBorder = borderG![1].trim().split(' ')[0];
console.log('input  viewBox:', /viewBox="([^"]+)"/.exec(svg)![1]);
console.log('export viewBox:', vbOut);
console.log('input  primo punto (px):', `${nums[0]},${nums[1]}`);
console.log('export primo punto sagoma (px):', firstBorder);

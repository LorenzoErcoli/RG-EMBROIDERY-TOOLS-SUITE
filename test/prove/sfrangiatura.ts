import { buildParallelFill, buildDst, dstProgramFromBlocks, readDst } from '@rg/core';
import { sfrangia, defaultSfrangiaturaParams } from '../../apps/sfrangiatura/src/frange';
import { blocchiAStrati } from '../../apps/sfrangiatura/src/motore';

// Un raso sintetico 20x12 mm (come lo smoke), cucito in un DST; una zona sul bordo x=20; i valori di partenza del tool.
export async function prova() {
  const righe = buildParallelFill([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }], [], { angleDeg: 0, spacingMm: 0.4, maxStitchMm: 3, mode: 'serpentine' });
  const punti: Array<[number, number]> = [];
  for (const r of righe) for (const p of r) punti.push([p.x, p.y]);
  const dst = buildDst(dstProgramFromBlocks([{ needle: 1, points_mm: punti }], { label: 'RASO' }));
  const zone = [[{ x: 19, y: -1 }, { x: 25, y: -1 }, { x: 25, y: 13 }, { x: 19, y: 13 }]];
  const params = { ...defaultSfrangiaturaParams };
  return {
    ingresso: { dst, zone },
    params,
    // la strada di prima: quello che faceva tool.ts (readDst, sfrangia sui blocchi letti) e poi i blocchi riscritti
    diretto: () => blocchiAStrati(sfrangia(readDst(dst).blocks, zone, { ...params, aghiEsclusi: [] }).blocchi),
  };
}

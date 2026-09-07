// LA SFRANGIATURA GUARDATA, non solo misurata: un ritaglio prima e dopo, alla stessa scala.
//
// I numeri dicono che si sono mossi 424 capi e nient'altro; se l'effetto sia quello delle foto del
// dossier lo dice solo l'occhio, e questo e' il file da mettere davanti a Lorenzo.
//
//   npx esbuild apps/sfrangiatura/scripts/vedi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/sfrangiatura/scripts/vedi.mjs
//   node apps/sfrangiatura/scripts/vedi.mjs <file.dst> [px/mm]
import { readFileSync, mkdirSync } from 'node:fs';
import { readDst, type Point } from '@rg/core';
import { Tela } from '../../pittorico/scripts/png.ts';
import { sfrangia } from '../src/frange.ts';

const percorso = process.argv[2];
const PX = Number(process.argv[3] ?? 14);
const letto = readDst(new Uint8Array(readFileSync(percorso)));

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const b of letto.blocks) for (const [x, y] of b.points_mm) {
  if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
}

// DOVE due macchie si affacciano davvero: si cerca la cella in cui due aghi diversi hanno piu' punti
// tutti e due. Marcare a caso in mezzo a un raso fa vedere le frange ma non l'intreccio, che e' il
// punto: l'effetto nasce fra la macchia di sopra e quella di sotto.
const CELLA = 8;
const conta = new Map<string, Map<number, number>>();
for (const b of letto.blocks) for (const [x, y] of b.points_mm) {
  const k = `${Math.floor((x - minX) / CELLA)},${Math.floor((y - minY) / CELLA)}`;
  let m = conta.get(k); if (!m) { m = new Map(); conta.set(k, m); }
  m.set(b.needle, (m.get(b.needle) ?? 0) + 1);
}
let miglior = '', punteggio = 0;
for (const [k, m] of conta) {
  if (m.size < 2) continue;
  const v = [...m.values()].sort((a, b) => b - a);
  const p = Math.min(v[0], v[1]);                       // quanto e' bilanciata: il secondo ago conta
  if (p > punteggio) { punteggio = p; miglior = k; }
}
const [cx, cy] = miglior.split(',').map(Number);
const zx = minX + cx * CELLA, zy = minY + cy * CELLA;
console.log(`confine scelto: cella ${miglior} (${punteggio} punti del secondo ago) a ${zx.toFixed(1)},${zy.toFixed(1)} mm`);
const zona: Point[][] = [[{ x: zx - CELLA, y: zy - CELLA }, { x: zx + 2 * CELLA, y: zy - CELLA }, { x: zx + 2 * CELLA, y: zy + 2 * CELLA }, { x: zx - CELLA, y: zy + 2 * CELLA }]];
const y0 = zy - CELLA, y1 = zy + 2 * CELLA;
const APERTURA = Number(process.argv[4] ?? 25);
const LUNGA = Number(process.argv[5] ?? 6);
const esito = sfrangia(letto.blocks, zona, { lunghezzaMinMm: 2, lunghezzaMaxMm: LUNGA, aperturaMinDeg: APERTURA * 0.4, aperturaMaxDeg: APERTURA, seme: 1, modo: 'sposta' as const });

const rx0 = zx - CELLA * 1.5, rw = CELLA * 5;
const ry0 = zy - CELLA * 1.5, rh = CELLA * 5;
const dir = 'apps/sfrangiatura/scripts/out';
mkdirSync(dir, { recursive: true });

const disegna = (blocchi: typeof letto.blocks, nome: string, marca: boolean): void => {
  const t = new Tela(rw, rh, PX);
  if (marca) for (let px = 0; px < t.w; px++) for (let py = 0; py < t.h; py++) {
    const my = ry0 + py / PX;
    if (my >= y0 && my <= y1) { const i = (py * t.w + px) * 3; t.rgb[i] = 255; t.rgb[i + 1] = 244; t.rgb[i + 2] = 214; }
  }
  const tinte: Array<[number, number, number]> = [[40, 62, 110], [92, 126, 168], [150, 176, 200], [176, 176, 150]];
  for (const b of blocchi) {
    const [r, g, bl] = tinte[(b.needle - 1) % tinte.length];
    t.linea(b.points_mm.map(([x, y]) => ({ x: x - rx0, y: y - ry0 })), r, g, bl);
  }
  t.salva(`${dir}/${nome}.png`);
  console.log(`→ ${dir}/${nome}.png  (${t.w}x${t.h} px, ${PX} px/mm)`);
};

/**
 * Il confronto che si guarda davvero: il ricamo di partenza in grigio, e SOPRA soltanto i due
 * segmenti di ogni capo che si e' allungato. Cosi' la frangia si distingue dal raso, che a video ha
 * gia' l'aria di un pettine e nasconde la differenza.
 */
const confronto = (nome: string): void => {
  const t = new Tela(rw, rh, PX);
  for (let px = 0; px < t.w; px++) for (let py = 0; py < t.h; py++) {
    const my = ry0 + py / PX;
    if (my >= y0 && my <= y1) { const i = (py * t.w + px) * 3; t.rgb[i] = 255; t.rgb[i + 1] = 246; t.rgb[i + 2] = 222; }
  }
  for (const b of letto.blocks) t.linea(b.points_mm.map(([x, y]) => ({ x: x - rx0, y: y - ry0 })), 188, 194, 202);
  let n = 0;
  for (let ib = 0; ib < letto.blocks.length; ib++) {
    const a = letto.blocks[ib].points_mm, c = esito.blocchi[ib].points_mm;
    for (let j = 0; j < a.length; j++) {
      if (a[j][0] === c[j][0] && a[j][1] === c[j][1]) continue;
      n++;
      for (const k of [j - 1, j + 1]) {
        if (k < 0 || k >= c.length) continue;
        t.linea([{ x: c[k][0] - rx0, y: c[k][1] - ry0 }, { x: c[j][0] - rx0, y: c[j][1] - ry0 }], 196, 32, 48);
      }
    }
  }
  t.salva(`${dir}/${nome}.png`);
  console.log(`→ ${dir}/${nome}.png  · ${n} capi allungati, in rosso`);
};

const nome = `a${APERTURA}-l${LUNGA}`;
disegna(letto.blocks, 'prima', true);
disegna(esito.blocchi, `dopo-${nome}`, true);
console.log(`apertura ${APERTURA}° · frangia 2–${LUNGA} mm · ${esito.frange} capi · ${esito.incroci} incroci (${esito.incrociPerFrangia.toFixed(2)} per frangia)`);

confronto(`confronto-${nome}`);

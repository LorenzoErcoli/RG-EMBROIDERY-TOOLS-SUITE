// IL BANCO DI PROVA del punto pettine, headless: legge i file, chiama il motore, scrive le uscite.
//
// La geometria non sta piu' qui: sta in `apps/pettine/src/motore.ts`, che e' lo stesso codice che
// gira nel tool dentro il browser (R28 — una domanda, una risposta sola). Qui restano solo gli
// argomenti da riga di comando, la lettura del BMP e la scrittura dei file.
//
//   npx esbuild apps/pettine/scripts/livelli.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts \
//     --alias:@rg/pattern-grammar=./packages/pattern-grammar/src/index.ts \
//     --outfile=apps/pettine/scripts/livelli.mjs
//   node --max-old-space-size=4096 apps/pettine/scripts/livelli.mjs <file.svg> [basi] [sormonto]
//     [addolcisci] [foto.bmp] [denteMin] [denteMax] [passo] [apertura] [netto] [sconfina] [lisciaMax]
//     [spiana] [chiudi] [traslaMax]
//   DENTI=1 mette il pettine · MOSTRA_NUDI=1 colora di rosa cio' che resta scoperto
//   RITAGLIO=x,y,larghezza,altezza lavora solo dentro quel rettangolo (in mm) — gli swatch
//   NOME=... cambia il nome dei file di uscita

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';
import { costruisciPettine, parametriPettineDefault, type Riquadro } from '../src/motore.ts';

const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const fileSvg = process.argv[2];
if (!fileSvg) { console.error('uso: node livelli.mjs <file.svg> [basi] [sormonto] [addolcisci] [foto.bmp] ...'); process.exit(1); }
const DENTI = !!process.env.DENTI;
const FOTO = process.argv[6] ?? 'BRIEFING-RASO-OMOGENEO/cianotipia.bmp';

const par = {
  ...parametriPettineDefault,
  basiMm: num(3, 2),
  sormontoMm: num(4, 4),
  addolcisciMm: num(5, 0.15),
  denteMinMm: num(7, 3),
  denteMaxMm: num(8, 5),
  passoMm: num(9, 1.5),
  aperturaDeg: num(10, 40),
  nettoMm: num(11, 2.5),
  sconfinaMm: num(12, num(3, 2) + 0.5),
  lisciaMaxMm: num(13, 8),
  spianaMm: num(14, 5),
  chiudiMm: num(15, 3),
  traslaMaxMm2: num(16, 9000),
  denti: DENTI,
  mostraNudi: !!process.env.MOSTRA_NUDI,
  dst: DENTI,
};

let ritaglio: Riquadro | null = null;
if (process.env.RITAGLIO) {
  const [x, y, larghezza, altezza] = process.env.RITAGLIO.split(',').map(Number);
  ritaglio = { x, y, larghezza, altezza };
}

const esito = costruisciPettine(
  { testoSvg: readFileSync(fileSvg, 'utf8'), larghezzaRealeMm: 419.45, foto: DENTI ? leggiBmp(FOTO) : null, ritaglio },
  par,
);
for (const riga of esito.note) console.log(riga);

const nome = process.env.NOME ?? `pettine-b${par.basiMm}-d${par.denteMinMm}_${par.denteMaxMm}-p${par.passoMm}-s${par.sormontoMm}`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/verifica-livelli.svg', esito.svgVerifica, 'utf8');
console.log('-> apps/pettine/scripts/out/verifica-livelli.svg');
if (DENTI) {
  writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, esito.svg, 'utf8');
  console.log(`-> apps/pettine/scripts/out/${nome}.svg`);
  if (esito.dst) {
    writeFileSync(`apps/pettine/scripts/out/${nome}.dst`, esito.dst);
    console.log(`-> apps/pettine/scripts/out/${nome}.dst (${esito.dst.length} byte)`);
  }
}

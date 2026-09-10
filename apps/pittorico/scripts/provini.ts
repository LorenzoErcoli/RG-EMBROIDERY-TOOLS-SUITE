// I PROVINI — lo stesso ritaglio del disegno cucito a densità e frastaglio diversi.
//
// Nasce da una frase di Lorenzo sul degradé: *«secondo me meglio, ma bisognerà vederlo una volta
// stabilite densità e ampiezza frastaglio; a me sembra ancora tanto sporco»*. Ha ragione a non
// giudicare adesso: quei due numeri cambiano completamente la resa, e finché non sono fissati si
// sta guardando un caso a caso. Questi sono i casi messi uno accanto all'altro.
//
// Non è un esperimento da rifare a mano ogni volta: è uno script, quindi quando il motore cambia i
// provini si rifanno e si confrontano con quelli di prima.
//
//   npx esbuild apps/pittorico/scripts/provini.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/provini.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/provini.mjs <cianotipia.bmp> [larghezzaMm]

import { writeFileSync, mkdirSync } from 'node:fs';
import { traceRegions, reduceStable, prepareImage, type Polyline, type Point } from '@rg/core';
import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';
import { larghezzaTransizione, cresciVersoISuccessivi, frastaglia } from '@rg/core';
import { harmonicField } from '../src/field.ts';
import { buildCurvedFill } from '../src/curved-fill.ts';
import { makeRegion } from '@rg/core';
import { coverageStats, neighbourSpacing } from '../src/coverage.ts';

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node provini.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
const img = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / img.width;

const CRESCITA = 5;
const SORMONTO = 1.5;
const SOGLIA_SECCO_MM = 1.5;
/** Le densità da provare (passo fra due file di filo, R22) e le ampiezze di frangia. */
const DENSITA = [0.3, 0.4, 0.5];
const FRANGE = [2, 3.5, 5];
const LATO_MM = 38;
/**
 * Un decimo di millimetro basta e avanza per un provino, e dimezza il file: a due decimali il
 * foglio pesava 975 kB e non si apriva nemmeno in anteprima. La geometria vera resta quella del
 * motore — questo è solo il modo di scriverla per guardarla.
 */
const dec = (v: number): string => v.toFixed(1);

console.log('');
console.log('PUNTO PITTORICO — provini: lo stesso ritaglio a densità e frastaglio diversi');

const res = reduceStable(img, {
  colorCount: 4, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: 8, mmPerPx: MM_PER_PX,
});
const luce = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const ordine = res.palette.map((_, i) => i).sort((a, b) => luce(res.palette[a]) - luce(res.palette[b]));
const perMisurare = prepareImage(img, { flattenLightMm: 0, smoothMm: 1.5, mmPerPx: MM_PER_PX });
const idx = res.index;

// --------------------------------------------------------------------------------------------
// la maschera «qui sfuma» e il ritaglio, scelti come in bordi.ts
// --------------------------------------------------------------------------------------------
const sfuma = new Uint8Array(img.width * img.height);
let migliore: { p: Point; larghezzaMm: number } | null = null;
{
  const r = Math.ceil(CRESCITA / MM_PER_PX) + 2;
  const dentroIdx = (x: number, y: number): number =>
    (x < 0 || y < 0 || x >= img.width || y >= img.height) ? -1 : idx[y * img.width + x];
  for (let t = 0; t < res.palette.length; t++) {
    for (const reg of traceRegions(idx, img.width, img.height, t, MM_PER_PX, { simplifyMm: MM_PER_PX * 0.8, minAreaMm2: 300 })) {
      for (const anello of [reg.outer, ...reg.holes]) {
        let percorsa = 0;
        for (let i = 0; i < anello.length; i++) {
          const a = anello[i], b = anello[(i + 1) % anello.length];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          percorsa += len;
          if (percorsa < 2 || len < 1e-9) continue;
          percorsa = 0;
          const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
          const px = p.x / MM_PER_PX, py = p.y / MM_PER_PX;
          const t1 = dentroIdx(Math.round(px + n.x * 2.5), Math.round(py + n.y * 2.5));
          const t2 = dentroIdx(Math.round(px - n.x * 2.5), Math.round(py - n.y * 2.5));
          const altra = t1 === t ? t2 : t1;
          if (altra < 0 || altra === t) continue;
          const tr = larghezzaTransizione(perMisurare, MM_PER_PX, p, n, { raggioMm: 10 });
          if (!tr || tr.larghezzaMm <= SOGLIA_SECCO_MM) continue;
          if (!migliore || (tr.larghezzaMm > migliore.larghezzaMm && tr.larghezzaMm < 16)) {
            migliore = { p, larghezzaMm: tr.larghezzaMm };
          }
          const cx = Math.round(px), cy = Math.round(py);
          for (let dy = -r; dy <= r; dy++) {
            const y = cy + dy;
            if (y < 0 || y >= img.height) continue;
            const mezzo = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
            for (let dx = -mezzo; dx <= mezzo; dx++) {
              const x = cx + dx;
              if (x >= 0 && x < img.width) sfuma[y * img.width + x] = 1;
            }
          }
        }
      }
    }
  }
}
if (!migliore) { console.error('nessun bordo sfumato trovato'); process.exit(1); }

const lato = Math.round(LATO_MM / MM_PER_PX);
const x0 = Math.max(0, Math.min(img.width - lato, Math.round(migliore.p.x / MM_PER_PX - lato / 2)));
const y0 = Math.max(0, Math.min(img.height - lato, Math.round(migliore.p.y / MM_PER_PX - lato / 2)));
const rit = new Uint8Array(lato * lato);
const ritSfuma = new Uint8Array(lato * lato);
for (let y = 0; y < lato; y++) {
  for (let x = 0; x < lato; x++) {
    rit[y * lato + x] = idx[(y0 + y) * img.width + (x0 + x)];
    ritSfuma[y * lato + x] = sfuma[(y0 + y) * img.width + (x0 + x)];
  }
}
const L = lato * MM_PER_PX;
console.log(`ritaglio di ${n1(L)} mm dove il passaggio è largo ${n2(migliore.larghezzaMm)} mm`);

// --------------------------------------------------------------------------------------------
// un provino
// --------------------------------------------------------------------------------------------
const esa = (c: readonly number[]): string =>
  `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const ritaglioRegion = makeRegion([
  { x: 0.5, y: 0.5 }, { x: L - 0.5, y: 0.5 }, { x: L - 0.5, y: L - 0.5 }, { x: 0.5, y: L - 0.5 },
]);

interface Provino { passoMm: number; frangiaMm: number; disegno: string; filoM: number; vuotoMax: number; }

function provino(passoMm: number, frangiaMm: number): Provino {
  const pezzi: string[] = [];
  const tutte: Polyline[] = [];
  for (const t of ordine) {
    const mask = cresciVersoISuccessivi(rit, lato, lato, t, ordine, MM_PER_PX,
      { crescitaMm: CRESCITA, sormontoMm: SORMONTO, sfuma: ritSfuma });
    const corpo = (p: Point): boolean => {
      const x = Math.round(p.x / MM_PER_PX), y = Math.round(p.y / MM_PER_PX);
      return x >= 0 && y >= 0 && x < lato && y < lato && rit[y * lato + x] === t;
    };
    const quiSfuma = (p: Point): boolean => {
      const x = Math.round(p.x / MM_PER_PX), y = Math.round(p.y / MM_PER_PX);
      return x >= 0 && y >= 0 && x < lato && y < lato && ritSfuma[y * lato + x] === 1;
    };
    for (const r of traceRegions(mask, lato, lato, 1, MM_PER_PX, { simplifyMm: MM_PER_PX * 1.5, minAreaMm2: 40 })) {
      const campo = harmonicField(r, { cellMm: 1.2, levels: 4, sweeps: 200 });
      const corse = buildCurvedFill(r, campo, { spacingMm: passoMm, maxStitchMm: 3 }).runs;
      const frangiate = frastaglia(corse, quiSfuma, { frangiaMm, granaMm: 1.2, restaFuoriDa: corpo });
      tutte.push(...frangiate);
      const tinta = res.palette[t];
      const chiara = luce(tinta) > 170;
      const colore = esa(chiara ? tinta.map((v) => v * 0.62 + 20) : tinta);
      pezzi.push(`<g fill="none" stroke="${colore}" stroke-width="${(passoMm * 0.55).toFixed(2)}" stroke-linecap="round">${
        frangiate.map((c) => `<polyline points="${c.map((p) => `${dec(p.x)},${dec(p.y)}`).join(' ')}" />`).join('')
      }</g>`);
    }
  }
  let filo = 0;
  for (const c of tutte) for (let i = 1; i < c.length; i++) filo += Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y);
  return {
    passoMm, frangiaMm, disegno: pezzi.join(''), filoM: filo / 1000,
    vuotoMax: neighbourSpacing(tutte, passoMm).max,
  };
}

// --------------------------------------------------------------------------------------------
console.log('');
console.log(`   ${'passo'.padStart(7)} ${'frangia'.padStart(8)} ${'filo m'.padStart(7)} ${'vuoto max'.padStart(10)} ${'tempo'.padStart(7)}`);
const provini: Provino[] = [];
for (const passo of DENSITA) {
  for (const frangia of FRANGE) {
    const t0 = Date.now();
    const pr = provino(passo, frangia);
    provini.push(pr);
    console.log(`   ${`${n1(passo)} mm`.padStart(7)} ${`${n1(frangia)} mm`.padStart(8)} ${n1(pr.filoM).padStart(7)} ${`${n2(pr.vuotoMax)} mm`.padStart(10)} ${`${Date.now() - t0}ms`.padStart(7)}`);
  }
}

// --------------------------------------------------------------------------------------------
// il foglio
// --------------------------------------------------------------------------------------------
const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });
{
  const gap = 5, testa = 7, bordoSx = 16;
  const W = bordoSx + DENSITA.length * (L + gap);
  const H = testa + FRANGE.length * (L + gap + 4);
  const celle = provini.map((p) => {
    const col = DENSITA.indexOf(p.passoMm), riga = FRANGE.indexOf(p.frangiaMm);
    const dx = bordoSx + col * (L + gap), dy = testa + riga * (L + gap + 4);
    return `  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})">
    <rect x="0" y="0" width="${L.toFixed(2)}" height="${L.toFixed(2)}" fill="#f2ead9" />
    ${p.disegno}
    <rect x="0" y="0" width="${L.toFixed(2)}" height="${L.toFixed(2)}" fill="none" stroke="#9a9075" stroke-width="0.12" />
    <text x="0" y="${(L + 3).toFixed(2)}" font-family="monospace" font-size="2.1" fill="#4a5a70">passo ${n1(p.passoMm)} · frangia ${n1(p.frangiaMm)} · ${n1(p.filoM)} m</text>
  </g>`;
  }).join('\n');
  const intestazioni = DENSITA.map((d, i) =>
    `<text x="${(bordoSx + i * (L + gap)).toFixed(2)}" y="4.4" font-family="monospace" font-size="2.6" fill="#0d2340">passo ${n1(d)} mm</text>`).join('');
  const laterali = FRANGE.map((f, i) =>
    `<text x="2" y="${(testa + i * (L + gap + 4) + L / 2).toFixed(2)}" font-family="monospace" font-size="2.6" fill="#0d2340" transform="rotate(-90 2 ${(testa + i * (L + gap + 4) + L / 2).toFixed(2)})" text-anchor="middle">frangia ${n1(f)} mm</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">
  <rect x="0" y="0" width="${W.toFixed(2)}" height="${H.toFixed(2)}" fill="#efe8d8" />
  ${intestazioni}${laterali}
${celle}
</svg>
`;
  writeFileSync(`${dir}provini.svg`, svg);
  console.log('');
  console.log(`provini → ${dir}provini.svg  (${(svg.length / 1024).toFixed(0)} kB)`);
}
console.log('');

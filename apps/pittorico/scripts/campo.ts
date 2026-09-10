// Punto 3 — IL CAMPO DI DIREZIONE sull'immagine vera, e la misura che dice se è buono.
//
// Il campo decide in che verso corre il punto in ogni millimetro del disegno. Guardarlo è metà del
// lavoro (§4.1: «si guarda *prima* di cucire»), ma un disegno bello non è una prova. La misura che
// conta è **quanto gira il punto per ogni millimetro percorso**: un campo che sfarfalla dà punti che
// si combattono fra loro, tirano il tessuto in direzioni diverse e si vedono. Un campo buono gira
// dove gira il disegno e sta fermo dove il disegno sta fermo.
//
// Le linee di flusso NON sono un secondo motore: sono lo stesso riempimento curvo del punto 1,
// chiesto a passo largo. Scrivere un tracciatore di linee a parte vorrebbe dire avere due risposte
// alla stessa domanda, che è esattamente ciò che R28 vieta — e l'anteprima mostrerebbe una cosa
// mentre l'ago ne cucirebbe un'altra.
//
//   npx esbuild apps/pittorico/scripts/campo.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/campo.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/campo.mjs <cianotipia.bmp> [larghezzaMm]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  traceRegions, reduceStable, simplifyPolyline, pointInRegion,
  type Polyline, type Region, type Point,
} from '@rg/core';
import { harmonicField, type DirectionField } from '../src/field.ts';
import { buildCurvedFill } from '../src/curved-fill.ts';
import { makeRegion } from '@rg/core';
import { regolarizzaAnello } from '../src/primitives.ts';

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);
const n3 = (v: number): string => v.toFixed(3);

// --------------------------------------------------------------------------------------------
// lettura BMP (vedi immagine.ts per il perché del BMP)
// --------------------------------------------------------------------------------------------
function leggiBmp(percorso: string): { W: number; H: number; rgba: Uint8ClampedArray } {
  const b = readFileSync(percorso);
  if (b[0] !== 0x42 || b[1] !== 0x4d) throw new Error('non è un BMP');
  const dati = b.readUInt32LE(10), W = b.readInt32LE(18), altezza = b.readInt32LE(22);
  if (b.readUInt16LE(28) !== 24) throw new Error('servono 24 bit per pixel');
  const H = Math.abs(altezza), dalBasso = altezza > 0;
  const passo = Math.ceil((W * 3) / 4) * 4;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const riga = dati + (dalBasso ? H - 1 - y : y) * passo;
    for (let x = 0; x < W; x++) {
      const s = riga + x * 3, d = (y * W + x) * 4;
      rgba[d] = b[s + 2]; rgba[d + 1] = b[s + 1]; rgba[d + 2] = b[s]; rgba[d + 3] = 255;
    }
  }
  return { W, H, rgba };
}

// --------------------------------------------------------------------------------------------
// LA MISURA: quanto gira il punto, per millimetro
// --------------------------------------------------------------------------------------------
interface Curvatura { campioni: number; p50: number; p95: number; max: number; mediaAssoluta: number; }

/**
 * Gradi di rotazione per millimetro percorso, lungo le linee di flusso.
 *
 * Il riferimento non è zero: un ricamo che segue una curva **deve** girare. Su un cerchio di raggio
 * R la rotazione vale esattamente 57,3/R gradi al mm — su 77 mm di raggio fa 0,74°/mm, ed è la
 * rotazione *voluta*. Quello che non deve esserci è il **sfarfallio**: rotazioni grandi su tratti
 * corti, che sono rumore del contorno arrivato fin dentro al filo.
 */
function curvatura(linee: Polyline[]): Curvatura {
  const g: number[] = [];
  for (const l of linee) {
    // i due punti a ogni capo non contano: li' la fila e' stata tagliata sul bordo, l'ultimo
    // segmento e' corto e irregolare, e l'angolo diviso per la sua lunghezza esplode. Verificato
    // sul ventaglio, dove la risposta si sa a mano: nel corpo lo scarto dalla teoria e' 0,00%, ai
    // capi arriva al 93%. Tenerli dentro voleva dire misurare il taglio invece del campo.
    for (let i = 4; i < l.length - 2; i++) {
      const a = l[i - 2], b = l[i - 1], c = l[i];
      const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
      const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
      if (lu < 1e-9 || lv < 1e-9) continue;
      const cross = (u.x * v.y - u.y * v.x) / (lu * lv);
      const dot = (u.x * v.x + u.y * v.y) / (lu * lv);
      const deg = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
      g.push(deg / ((lu + lv) / 2));
    }
  }
  if (!g.length) return { campioni: 0, p50: 0, p95: 0, max: 0, mediaAssoluta: 0 };
  const o = g.slice().sort((a, b) => a - b);
  const q = (p: number): number => o[Math.min(o.length - 1, Math.round(p * (o.length - 1)))];
  return {
    campioni: o.length, p50: q(0.5), p95: q(0.95), max: o[o.length - 1],
    mediaAssoluta: g.reduce((s, v) => s + v, 0) / g.length,
  };
}

/**
 * Quanto il campo si discosta dalla PERPENDICOLARE al bordo, un passo dentro il bordo.
 *
 * Prima versione sbagliata, e vale la pena scriverlo: campionavo da tutt'e due i lati e poi
 * dividevo per due, cioè mescolavo punti dentro la regione con punti fuori — dove il campo è
 * congelato sulla tangente per costruzione, quindi risponde sempre bene. Il numero che usciva non
 * misurava niente. Adesso si guarda da che parte si è finiti e si tiene solo il dentro.
 */
function fedeltaAlBordo(region: Region, field: DirectionField, passoMm: number): number {
  const anello = region.outer;
  let somma = 0, n = 0;
  for (let i = 0; i < anello.length; i += Math.max(1, Math.round(anello.length / 400))) {
    const a = anello[i], b = anello[(i + 1) % anello.length];
    const t = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(t.x, t.y);
    if (len < 1e-9) continue;
    const nx = -t.y / len, ny = t.x / len;
    for (const s of [1, -1]) {
      const p = { x: (a.x + b.x) / 2 + nx * s * passoMm, y: (a.y + b.y) / 2 + ny * s * passoMm };
      if (!pointInRegion(p, region)) continue;
      const d = field.dirAt(p);
      const cos = Math.abs((d.x * t.x + d.y * t.y) / len);
      const dallaTangente = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
      // il campo deve stare PERPENDICOLARE al bordo (è la resa chiesta da Lorenzo), quindi lo
      // scarto si misura da 90° e non da 0. Misurarlo dalla tangente, dopo il cambio, dava numeri
      // che sembravano un peggioramento e invece erano il contrario.
      somma += Math.abs(90 - dallaTangente);
      n++;
    }
  }
  return n ? somma / n : 0;
}

// --------------------------------------------------------------------------------------------

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node campo.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
const img = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / img.W;

console.log('');
console.log('PUNTO PITTORICO — il campo di direzione sull\'immagine vera');
console.log(`${img.W} x ${img.H} px · ${n3(MM_PER_PX)} mm per pixel · il disegno misura ${n1(LARGHEZZA_MM)} x ${n1(img.H * MM_PER_PX)} mm`);

// 1. immagine → tinte stabili → regioni in MILLIMETRI (non più in pixel: qui si cuce)
const TINTE = 4;
const res = reduceStable({ rgba: img.rgba, width: img.W, height: img.H }, {
  colorCount: TINTE, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: 8, mmPerPx: MM_PER_PX,
});
console.log(`tinte: ${res.palette.map((c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`).join(' · ')}`);

interface Zona { tinta: number; region: Region; }
const zone: Zona[] = [];
for (let t = 0; t < res.palette.length; t++) {
  for (const r of traceRegions(res.index, img.W, img.H, t, MM_PER_PX, { simplifyMm: MM_PER_PX * 0.8, minAreaMm2: 400 })) {
    zone.push({ tinta: t, region: r });
  }
}
zone.sort((a, b) => b.region.areaMm2 - a.region.areaMm2);
console.log(`zone sopra 400 mm²: ${zone.length} · le più grandi: ${zone.slice(0, 5).map((z) => `${Math.round(z.region.areaMm2)}`).join(', ')} mm²`);

/**
 * Il campo vuole un contorno LISCIO, non fitto: la tangente al bordo è la sua condizione, e su una
 * scalinata la tangente salta di 90° a ogni gradino. Semplificare non è perdere informazione — è
 * togliere dal bordo un dettaglio che il bordo non ha davvero.
 */
const alleggerisci = (r: Region, tolMm: number): Region => makeRegion(
  simplifyPolyline(r.outer, tolMm),
  r.holes.map((h) => simplifyPolyline(h, tolMm)).filter((h) => h.length >= 3),
);

/** Lo stesso contorno, ma con le primitive riconosciute al posto delle spezzate (punto 2b). */
const regolarizza = (r: Region, tolMm: number): Region => makeRegion(
  regolarizzaAnello(r.outer, { tolMm }).ring,
  r.holes.map((h) => regolarizzaAnello(h, { tolMm }).ring).filter((h) => h.length >= 3),
);

const PASSO_ANTEPRIMA = 4;      // mm fra una linea di flusso e l'altra: si guarda, non si cuce
const CELLA = 1.2;              // mm della griglia più fine del campo

console.log('');
console.log('1. IL CAMPO SULLE ZONE GRANDI — quanto gira il punto, per millimetro');
console.log(`   ${'zona'.padEnd(26)} ${'area mm²'.padStart(9)} ${'contorno'.padStart(9)} ${'campo ms'.padStart(9)} ${'linee'.padStart(6)} ${'gira °/mm p50'.padStart(13)} ${'p95'.padStart(7)} ${'bordo °'.padStart(8)}`);

interface Disegno { region: Region; linee: Polyline[]; tinta: number; }
const disegni: Disegno[] = [];

for (const z of zone) {
  const r = alleggerisci(z.region, MM_PER_PX * 1.5);
  if (r.outer.length < 8) continue;
  const t0 = Date.now();
  const campo = harmonicField(r, { cellMm: CELLA, levels: 4, sweeps: 260 });
  const ms = Date.now() - t0;
  const linee = buildCurvedFill(r, campo, { spacingMm: PASSO_ANTEPRIMA, maxStitchMm: 1.5 }).runs;
  // la curvatura si misura sulla linea di flusso INTERA, non sui punti-ago: altrimenti si
  // mescolerebbe lo sfarfallio del campo con la corda del punto, che è un'altra cosa (punto 1)
  const c = curvatura(buildCurvedFill(r, campo, { spacingMm: PASSO_ANTEPRIMA }).runs);
  const bordo = fedeltaAlBordo(r, campo, CELLA);
  if (disegni.length < 8) console.log(`   ${`tinta ${z.tinta} · ${Math.round(z.region.areaMm2)} mm²`.padEnd(26)} ${String(Math.round(r.areaMm2)).padStart(9)} ${String(r.outer.length).padStart(9)} ${String(ms).padStart(9)} ${String(linee.length).padStart(6)} ${n2(c.p50).padStart(13)} ${n2(c.p95).padStart(7)} ${n1(bordo).padStart(8)}`);
  disegni.push({ region: r, linee, tinta: z.tinta });
}
console.log(`   (calcolate tutte e ${disegni.length} le zone: qui sopra le piu' grandi)`);

console.log('');
console.log('   PER LEGGERE I NUMERI: su un cerchio di raggio R la rotazione VOLUTA vale 57,3/R gradi');
console.log(`   al mm. Sulla sfera (raggio 77 mm) fa 0,74°/mm; su una curva stretta da 10 mm, 5,7°/mm.`);
console.log('   Quindi non si cerca lo zero: si cerca che il p95 non sia molto sopra la curva vera del');
console.log('   disegno, perché quello che eccede è sfarfallio del contorno arrivato dentro al filo.');

console.log('');
console.log('2. IL CONTORNO CONTA: scalinata, semplificato, riconosciuto');
console.log('   il campo nasce dal BORDO — ci si posa perpendicolare — e su una scalinata la');
console.log('   direzione del bordo salta di 90° a ogni gradino. Stessa zona, tre contorni:');
console.log(`   ${'contorno'.padEnd(26)} ${'punti'.padStart(6)} ${'campo ms'.padStart(9)} ${'gira °/mm p50'.padStart(13)} ${'p95'.padStart(7)} ${'max'.padStart(7)} ${'bordo °'.padStart(8)}`);
{
  const grande = zone[0];
  const prove: Array<[string, Region]> = [
    ['scalinata (come tracciata)', grande.region],
    ['semplificato 0,5 mm', alleggerisci(grande.region, MM_PER_PX * 1.5)],
    ['riconosciuto (punto 2b)', regolarizza(alleggerisci(grande.region, MM_PER_PX * 1.5), MM_PER_PX * 2)],
  ];
  for (const [nome, r] of prove) {
    if (r.outer.length < 8) { console.log(`   ${nome.padEnd(26)} contorno troppo corto`); continue; }
    const t0 = Date.now();
    const campo = harmonicField(r, { cellMm: CELLA, levels: 4, sweeps: 260 });
    const ms = Date.now() - t0;
    const c = curvatura(buildCurvedFill(r, campo, { spacingMm: PASSO_ANTEPRIMA }).runs);
    console.log(`   ${nome.padEnd(26)} ${String(r.outer.length).padStart(6)} ${String(ms).padStart(9)} ${n2(c.p50).padStart(13)} ${n2(c.p95).padStart(7)} ${n2(c.max).padStart(7)} ${n1(fedeltaAlBordo(r, campo, CELLA)).padStart(8)}`);
  }
}

// --------------------------------------------------------------------------------------------
// L'ANTEPRIMA: le linee di flusso disegnate sul disegno
// --------------------------------------------------------------------------------------------
const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });
{
  const W = LARGHEZZA_MM, H = img.H * MM_PER_PX;
  const poly = (l: Polyline, chiuso: boolean): string =>
    `<${chiuso ? 'polygon' : 'polyline'} points="${l.map((p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" />`;
  const esa = (c: readonly number[]): string =>
    `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const chiara = (c: readonly number[]): boolean => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 140;

  // L'anteprima si guarda SUL DISEGNO, non su un foglio bianco: ogni zona porta la sua tinta vera e
  // il filo si disegna nel colore che ci si vede sopra. E il tratto vale 0,45 mm, non 0,1: lo 0,1 di
  // R15 è la misura giusta per il ricamo, ma su un foglio da 42 cm sparisce — questa è una vista,
  // non un export, e la regola parla di export.
  const corpi = disegni.map((d) => {
    const tinta = res.palette[d.tinta];
    const filo = chiara(tinta) ? '#0d2340' : '#f2ead9';
    const zona = [d.region.outer, ...d.region.holes].map((l) => poly(l, true)).join('');
    const linee = d.linee.map((l) => poly(l, false)).join('');
    return `  <g>
    <g fill="${esa(tinta)}" fill-rule="evenodd" stroke="none">${zona}</g>
    <g fill="none" stroke="${filo}" stroke-width="0.45" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">${linee}</g>
  </g>`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">
  <rect x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="${esa(res.palette[0])}" />
${corpi}
</svg>
`;
  writeFileSync(`${dir}cianotipia-campo.svg`, svg);
  console.log('');
  console.log(`anteprima delle linee di flusso → ${dir}cianotipia-campo.svg`);
  console.log(`(passo ${PASSO_ANTEPRIMA} mm fra una linea e l'altra: è un'anteprima, non il ricamo)`);
}
console.log('');

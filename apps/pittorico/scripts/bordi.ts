// Punto 4 — i BORDI, misurati sull'immagine vera.
//
// La domanda è una sola: **quali bordi di questo disegno sfumano e quali staccano?** Da quella
// risposta discende tutto il resto — frange dove sfuma, taglio secco dove stacca, e quanto
// profonda deve essere la compenetrazione.
//
// La misura si prende sull'immagine ORIGINALE, non su quella ridotta: dopo la riduzione la sfumatura
// non esiste più, è diventata una scaletta di tinte piatte, e misurarla lì vorrebbe dire misurare la
// propria semplificazione.
//
//   npx esbuild apps/pittorico/scripts/bordi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/bordi.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/bordi.mjs <cianotipia.bmp> [larghezzaMm]

import { writeFileSync, mkdirSync } from 'node:fs';
import { traceRegions, reduceStable, prepareImage, type Polyline, type Point } from '@rg/core';
import { leggiBmp } from './bmp.ts';
import { larghezzaTransizione, cresciVersoISuccessivi, frastaglia } from '../src/borders.ts';
import { harmonicField } from '../src/field.ts';
import { makeRegion } from '../src/region.ts';
import { coverageStats, neighbourSpacing } from '../src/coverage.ts';
import { buildCurvedFill } from '../src/curved-fill.ts';

const esaTinta = (c: readonly number[]): string =>
  `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);
const n3 = (v: number): string => v.toFixed(3);
const mediana = (a: number[]): number => {
  if (!a.length) return 0;
  const o = a.slice().sort((x, y) => x - y);
  return o[Math.floor(o.length / 2)];
};
const perc = (a: number[], q: number): number => {
  if (!a.length) return 0;
  const o = a.slice().sort((x, y) => x - y);
  return o[Math.min(o.length - 1, Math.round(q * (o.length - 1)))];
};

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node bordi.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
const img = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / img.width;

console.log('');
console.log('PUNTO PITTORICO — i bordi: dove il colore sfuma e dove stacca');
console.log(`${img.width} x ${img.height} px · ${n3(MM_PER_PX)} mm per pixel`);

const TINTE = 4;
const res = reduceStable(img, {
  colorCount: TINTE, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: 8, mmPerPx: MM_PER_PX,
});
const luce = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
console.log(`tinte (dalla più scura): ${res.palette.map((c, i) => `${i}=${Math.round(luce(c))}`).join(' · ')}`);

// --------------------------------------------------------------------------------------------
// 1. LA MISURA, bordo per bordo
// --------------------------------------------------------------------------------------------
// Si cammina lungo il contorno di ogni zona; per ogni campione si guarda che tinta c'è dall'altra
// parte e si misura quanto è largo il passaggio di luce attraversandolo.
/**
 * L'immagine su cui si MISURA il passaggio non è quella su cui si sono scelte le tinte.
 * `res.prepared` ha il pareggio della luce a 40 mm, che serve a far scegliere bene le tinte ma
 * **toglie proprio la sfumatura**: sottrae le variazioni lente, e una sfumatura larga 15 mm è una
 * variazione lenta. Qui si vuole la luce com'è, tolta solo la grana.
 */
const perMisurare = prepareImage(img, { flattenLightMm: 0, smoothMm: 1.5, mmPerPx: MM_PER_PX });

const idx = res.index;
const dentro = (x: number, y: number): number =>
  (x < 0 || y < 0 || x >= img.width || y >= img.height) ? -1 : idx[y * img.width + x];

interface Campione { a: number; b: number; larghezzaMm: number; p: Point; }
const campioni: Campione[] = [];

const zone: Array<{ tinta: number; anello: Polyline; areaMm2: number }> = [];
for (let t = 0; t < res.palette.length; t++) {
  for (const r of traceRegions(idx, img.width, img.height, t, MM_PER_PX, { simplifyMm: MM_PER_PX * 0.8, minAreaMm2: 300 })) {
    zone.push({ tinta: t, anello: r.outer, areaMm2: r.areaMm2 });
    for (const h of r.holes) zone.push({ tinta: t, anello: h, areaMm2: 0 });
  }
}

const PASSO_CAMPIONE_MM = 2;
for (const z of zone) {
  const anello = z.anello;
  let percorsa = 0;
  for (let i = 0; i < anello.length; i++) {
    const a = anello[i], b = anello[(i + 1) % anello.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    percorsa += len;
    if (percorsa < PASSO_CAMPIONE_MM || len < 1e-9) continue;
    percorsa = 0;
    const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    // chi c'è dall'altra parte: si guarda due pixel oltre il bordo, dai due lati
    const px = p.x / MM_PER_PX, py = p.y / MM_PER_PX;
    const q = 2.5;
    const t1 = dentro(Math.round(px + n.x * q), Math.round(py + n.y * q));
    const t2 = dentro(Math.round(px - n.x * q), Math.round(py - n.y * q));
    const altra = t1 === z.tinta ? t2 : t1;
    if (altra < 0 || altra === z.tinta) continue;
    const tr = larghezzaTransizione(perMisurare, MM_PER_PX, p, n, { raggioMm: 10 });
    if (!tr) continue;
    campioni.push({ a: Math.min(z.tinta, altra), b: Math.max(z.tinta, altra), larghezzaMm: tr.larghezzaMm, p });
  }
}

console.log('');
console.log('1. QUANTO È LARGO IL PASSAGGIO, coppia di tinte per coppia di tinte');
console.log(`   ${'fra le tinte'.padEnd(14)} ${'campioni'.padStart(9)} ${'mediana'.padStart(9)} ${'p10'.padStart(7)} ${'p90'.padStart(7)} ${'in fili'.padStart(9)}`);
const coppie = new Map<string, number[]>();
for (const c of campioni) {
  const k = `${c.a}-${c.b}`;
  const v = coppie.get(k);
  if (v) v.push(c.larghezzaMm); else coppie.set(k, [c.larghezzaMm]);
}
for (const [k, v] of [...coppie.entries()].sort((x, y) => y[1].length - x[1].length)) {
  const m = mediana(v);
  console.log(`   ${k.padEnd(14)} ${String(v.length).padStart(9)} ${`${n2(m)} mm`.padStart(9)} ${n2(perc(v, 0.1)).padStart(7)} ${n2(perc(v, 0.9)).padStart(7)} ${n1(m / 0.4).padStart(9)}`);
}
console.log('   («in fili» = quanti passi di filo da 0,4 mm stanno dentro il passaggio: è la profondità');
console.log('   che le due frange devono compenetrarsi perché il degradé sia quello del disegno.)');

// --------------------------------------------------------------------------------------------
// 2. SECCO O SFUMATO: la soglia, e cosa separa
// --------------------------------------------------------------------------------------------
console.log('');
console.log('2. SECCO O SFUMATO — la stessa immagine ha tutt\'e due, ed è per questo che serve una soglia');
const tutte = campioni.map((c) => c.larghezzaMm);
console.log(`   su ${tutte.length} campioni: p10 ${n2(perc(tutte, 0.1))} · mediana ${n2(mediana(tutte))} · p90 ${n2(perc(tutte, 0.9))} · max ${n2(perc(tutte, 1))} mm`);
for (const soglia of [1.5, 2, 3, 4]) {
  const secchi = tutte.filter((v) => v <= soglia).length;
  console.log(`   con soglia ${n1(soglia)} mm: ${((secchi / tutte.length) * 100).toFixed(0)}% dei bordi è SECCO, ${(((tutte.length - secchi) / tutte.length) * 100).toFixed(0)}% è SFUMATO`);
}

// --------------------------------------------------------------------------------------------
// LA MASCHERA "QUI SFUMA": dove si puo' crescere e dove si puo' frastagliare.
//
// Si costruisce dai campioni gia' misurati: attorno a ogni campione con un passaggio piu' largo
// della soglia si timbra un disco largo quanto la crescita. Fuori di li' — cioe' sui bordi netti —
// non si cresce e non si frastaglia, e il colore stacca preciso.
// --------------------------------------------------------------------------------------------
const SOGLIA_SECCO_MM = 1.5;
const CRESCITA = 5;
const SORMONTO = 1.5;   // il sormonto sui bordi netti, chiesto da Lorenzo
const sfuma = new Uint8Array(img.width * img.height);
{
  const r = Math.ceil(CRESCITA / MM_PER_PX) + 2;
  let morbidi = 0;
  for (const c of campioni) {
    if (c.larghezzaMm <= SOGLIA_SECCO_MM) continue;
    morbidi++;
    const cx = Math.round(c.p.x / MM_PER_PX), cy = Math.round(c.p.y / MM_PER_PX);
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
  let quanti = 0;
  for (let i = 0; i < sfuma.length; i++) if (sfuma[i]) quanti++;
  console.log('');
  console.log(`   maschera «qui sfuma»: ${morbidi} campioni morbidi su ${campioni.length} · copre il ${((quanti / sfuma.length) * 100).toFixed(0)}% del disegno`);
}

// --------------------------------------------------------------------------------------------
// 3. LA CRESCITA DI 5 MM, e la prova che va nel verso giusto
// --------------------------------------------------------------------------------------------
console.log('');
console.log(`3. LA SOVRAPPOSIZIONE — ${CRESCITA} mm dove sfuma, ${SORMONTO} mm dove stacca netto`);
console.log('   chi sta sotto è abbondante, chi va sopra ci si appoggia: anche sul taglio secco il');
console.log('   colore sotto sborda di un millimetro e mezzo, così alla giunta non si vede la tela.');
const ordine = res.palette.map((_, i) => i).sort((a, b) => luce(res.palette[a]) - luce(res.palette[b]));
console.log(`   ordine di cucitura (dalla più scura): ${ordine.join(' → ')}`);
for (const t of ordine) {
  const cresciuta = cresciVersoISuccessivi(idx, img.width, img.height, t, ordine, MM_PER_PX, { crescitaMm: CRESCITA, sormontoMm: SORMONTO, sfuma });
  let miei = 0, guadagnati = 0, rubatiAiPrecedenti = 0;
  const posizione = ordine.indexOf(t);
  const prima = new Set(ordine.slice(0, posizione));
  for (let i = 0; i < idx.length; i++) {
    if (idx[i] === t) miei++;
    else if (cresciuta[i]) {
      guadagnati++;
      if (prima.has(idx[i])) rubatiAiPrecedenti++;
    }
  }
  const areaPx = MM_PER_PX * MM_PER_PX;
  console.log(`   tinta ${t}: ${Math.round(miei * areaPx)} mm² suoi + ${Math.round(guadagnati * areaPx)} mm² di crescita · verso chi era già cucito: ${rubatiAiPrecedenti} pixel`);
}
console.log('   l\'ultima tinta non cresce (non ha nessuno dopo di sé) e nessuna cresce all\'indietro:');
console.log('   è la decisione 2 di Lorenzo, e i pixel «verso chi era già cucito» devono essere zero.');

// --------------------------------------------------------------------------------------------
// 4. IL DEGRADÉ: due riempimenti che si compenetrano con le frange
// --------------------------------------------------------------------------------------------
// Un ritaglio, perché il degradé si guarda da vicino: a passo 0,4 mm su tutto il disegno sarebbero
// centinaia di metri di filo e un SVG da decine di megabyte.
console.log('');
console.log('4. IL DEGRADÉ — le frange che si intrecciano, su un ritaglio');
let dettaglio = '';
{
  // si sceglie la finestra dove la sfumatura è più larga, cioè dove il degradé si vede meglio
  const migliore = campioni.filter((c) => c.larghezzaMm > 6)
    .sort((a, b) => b.larghezzaMm - a.larghezzaMm)[Math.floor(campioni.length / 40)] ?? campioni[0];
  const LATO_MM = 70;
  const lato = Math.round(LATO_MM / MM_PER_PX);
  const x0 = Math.max(0, Math.min(img.width - lato, Math.round(migliore.p.x / MM_PER_PX - lato / 2)));
  const y0 = Math.max(0, Math.min(img.height - lato, Math.round(migliore.p.y / MM_PER_PX - lato / 2)));
  console.log(`   ritaglio di ${LATO_MM} mm centrato dove il passaggio è largo ${n2(migliore.larghezzaMm)} mm`);

  const rit = new Uint8Array(lato * lato);
  const ritSfuma = new Uint8Array(lato * lato);
  for (let y = 0; y < lato; y++) for (let x = 0; x < lato; x++) {
    rit[y * lato + x] = idx[(y0 + y) * img.width + (x0 + x)];
    ritSfuma[y * lato + x] = sfuma[(y0 + y) * img.width + (x0 + x)];
  }
  /** Il corpo del colore PRIMA della crescita: è il confine che la frangia non deve superare. */
  const corpoDi = (t: number) => (p: Point): boolean => {
    const x = Math.round(p.x / MM_PER_PX), y = Math.round(p.y / MM_PER_PX);
    return x >= 0 && y >= 0 && x < lato && y < lato && rit[y * lato + x] === t;
  };

  const pezzi: string[] = [];
  const tutteLeCorse: Polyline[] = [];
  let filoTot = 0;
  // la regione su cui si misura la copertura: tutto il ritaglio, che è pieno di ricamo
  const ritaglioRegion = makeRegion([
    { x: 0.5, y: 0.5 }, { x: lato * MM_PER_PX - 0.5, y: 0.5 },
    { x: lato * MM_PER_PX - 0.5, y: lato * MM_PER_PX - 0.5 }, { x: 0.5, y: lato * MM_PER_PX - 0.5 },
  ]);
  for (const t of ordine) {
    const mask = cresciVersoISuccessivi(rit, lato, lato, t, ordine, MM_PER_PX, { crescitaMm: CRESCITA, sormontoMm: SORMONTO, sfuma: ritSfuma });
    for (const r of traceRegions(mask, lato, lato, 1, MM_PER_PX, { simplifyMm: MM_PER_PX * 1.5, minAreaMm2: 60 })) {
      const campo = harmonicField(r, { cellMm: 1.2, levels: 4, sweeps: 220 });
      const corse = buildCurvedFill(r, campo, { spacingMm: 0.4, maxStitchMm: 3 }).runs;
      /**
       * Il capo si frastaglia SOLO dove il colore sfuma, e la frangia è lunga quanto il passaggio
       * misurato lì — non un numero fisso. Il parametro di pannello (decisione 3) fa da TETTO: si
       * prende il più corto fra quello che l'utente concede e quello che l'immagine chiede.
       */
      const FRANGIA_MASSIMA = 5;
      const quiSfuma = (p: Point): boolean => {
        const x = Math.round(p.x / MM_PER_PX), y = Math.round(p.y / MM_PER_PX);
        return x >= 0 && y >= 0 && x < lato && y < lato && ritSfuma[y * lato + x] === 1;
      };
      // la frangia vive SOLO nel margine cresciuto: `restaFuoriDa` la ferma appena tornerebbe
      // dentro il corpo del colore, ed è ciò che impedisce i buchi
      const frangiate = frastaglia(corse, quiSfuma, {
        frangiaMm: FRANGIA_MASSIMA, granaMm: 1.2, restaFuoriDa: corpoDi(t),
      });
      for (const c of frangiate) for (let i = 1; i < c.length; i++) filoTot += Math.hypot(c[i].x - c[i-1].x, c[i].y - c[i-1].y);
      tutteLeCorse.push(...frangiate);
      /**
       * Il filo si disegna nella sua tinta vera, ma le tinte chiarissime sul fondo tela sarebbero
       * invisibili — e su un disegno tecnico un filo invisibile si scambia per un buco. Le tinte
       * più chiare della tela si scuriscono un po' SOLO PER LA VISTA: la geometria non cambia, e il
       * confronto fra chiaro e scuro resta leggibile.
       */
      const t3 = res.palette[t];
      const chiara = 0.2126 * t3[0] + 0.7152 * t3[1] + 0.0722 * t3[2] > 170;
      const colore = esaTinta(chiara ? t3.map((v) => v * 0.62 + 20) : t3);
      pezzi.push(`<g fill="none" stroke="${colore}" stroke-width="0.22" stroke-linecap="round">${
        frangiate.map((c) => `<polyline points="${c.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" />`).join('')
      }</g>`);
    }
  }
  // I BUCHI, misurati invece che discussi. Lorenzo, guardando la prima versione: «non mi sembra
  // molto elegante il modo di fare sfumature, ci sono davvero un sacco di buchi». La frangia che
  // mangiava il riempimento è corretta; quello che resta è la variazione di densità del
  // posizionamento a distanza costante, e va detto con un numero perché si possa vedere se cala.
  {
    const nom = 1 / 0.4;
    const cov = coverageStats(tutteLeCorse, ritaglioRegion, 0.4, 2);
    const sp = neighbourSpacing(tutteLeCorse, 0.4);
    console.log(`   copertura: media ${n2(cov.media / nom)} del nominale · il 5% più rado sta a ${n2(cov.p05 / nom)} · dispersione ${(cov.cv * 100).toFixed(1)}%`);
    console.log(`   distanza fra file: mediana ${n2(sp.p50)} mm · il 5% più largo ${n2(sp.p95)} · il vuoto peggiore ${n2(sp.max)} mm (chiesto 0,40)`);
  }

  const L = lato * MM_PER_PX;
  // misure in pixel e non in mm: questo è un DETTAGLIO da guardare ingrandito, non un export.
  // Il vero (1 unità = 1 mm, R1) resta nel viewBox, che è la geometria.
  dettaglio = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 ${L.toFixed(1)} ${L.toFixed(1)}">
  <rect x="0" y="0" width="${L.toFixed(1)}" height="${L.toFixed(1)}" fill="#f2ead9" />
${pezzi.join('\n')}
</svg>
`;
  console.log(`   ${(filoTot / 1000).toFixed(1)} m di filo su ${(L * L / 100).toFixed(0)} cm²`);
}

// --------------------------------------------------------------------------------------------
// Il disegno: i bordi colorati per quanto sfumano
// --------------------------------------------------------------------------------------------
const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });
{
  const W = LARGHEZZA_MM, H = img.height * MM_PER_PX;
  const esa = esaTinta;
  const SOGLIA = SOGLIA_SECCO_MM;
  const punti = campioni.map((c) => {
    const sfumato = c.larghezzaMm > SOGLIA;
    const r = sfumato ? Math.min(2.4, 0.6 + c.larghezzaMm * 0.22) : 0.55;
    return `<circle cx="${c.p.x.toFixed(2)}" cy="${c.p.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${sfumato ? '#e8a33d' : '#d02020'}" />`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">
  <rect x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="${esa(res.palette[ordine[0]])}" />
  <g opacity="0.55">${zone.map((z) => `<polygon points="${z.anello.map((p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" fill="${esa(res.palette[z.tinta])}" stroke="none" />`).join('')}</g>
  <g>${punti}</g>
</svg>
`;
  writeFileSync(`${dir}cianotipia-bordi.svg`, svg);
  console.log('');
  console.log(`mappa dei bordi → ${dir}cianotipia-bordi.svg`);
  console.log('   rosso piccolo = il colore stacca netto · arancio, grande quanto è larga la sfumatura = sfuma');
  writeFileSync(`${dir}cianotipia-degrade.svg`, dettaglio);
  console.log(`dettaglio del degradé → ${dir}cianotipia-degrade.svg`);
}
console.log('');

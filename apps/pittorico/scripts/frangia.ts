// LA FRANGIA, MISURATA: il filo si dirada verso la punta, o c'è una linea di contorno?
//
// Lorenzo, guardando l'anteprima: *«il passaggio che troviamo al bordo, soprattutto nel blu, farebbe
// una linea contorno e non fa sfumatura, soprattutto dove serve degradé»*. È un difetto che si vede,
// e finché si vede e basta non si sa se una modifica lo cura o lo sposta.
//
// Qui si misura la cosa giusta: **quanto filo c'è a ogni profondità dal bordo**. Si prendono fette
// parallele al contorno, larghe una frazione di millimetro, e in ognuna si conta il filo cucito
// diviso l'area della fetta. Il profilo che ne esce dice tutto:
//
//   degradé vero        → una rampa: quasi zero sulla punta, densità piena verso il dentro
//   linea di contorno   → uno scalino, o peggio un picco, proprio sulla fetta più esterna
//
// Il numero che riassume è la **pendenza della rampa**: quanto della densità piena c'è già nella
// prima mezza frangia. Sotto il 30% è un degradé; sopra il 60% è una linea.
//
// Si misura SOLO sui bordi sfumati: dove il colore stacca netto la densità piena fino all'ultimo
// millimetro è quello che si vuole, e misurarla lì direbbe "linea" a ragion veduta.
//
//   npx esbuild apps/pittorico/scripts/frangia.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/frangia.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/frangia.mjs <cianotipia.bmp>

import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';
import { buildPittoricoPlan, defaultPittoricoParams } from '../src/pipeline.ts';
import { BoundaryIndex, regionRings } from '@rg/core';
import { pointInRegion } from '@rg/core';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node frangia.mjs <percorso.bmp>'); process.exit(1); }
const intera = leggiBmp(percorso);
const LARGHEZZA_MM = Number(process.argv[3] ?? 419.45);
const MM_PER_PX = LARGHEZZA_MM / intera.width;
const LATO_MM = Number(process.env.RG_LATO_MM ?? 90);
const LATO = LATO_MM > 0 ? Math.round(LATO_MM / MM_PER_PX) : Math.min(intera.width, intera.height);
const x0 = LATO_MM > 0 ? Math.round(intera.width * 0.52) : 0;
const y0 = LATO_MM > 0 ? Math.round(intera.height * 0.18) : 0;
const rgba = new Uint8ClampedArray(LATO * LATO * 4);
for (let y = 0; y < LATO; y++) {
  for (let x = 0; x < LATO; x++) {
    const s = ((y0 + y) * intera.width + (x0 + x)) * 4, d = (y * LATO + x) * 4;
    rgba[d] = intera.rgba[s]; rgba[d + 1] = intera.rgba[s + 1];
    rgba[d + 2] = intera.rgba[s + 2]; rgba[d + 3] = 255;
  }
}
const img = { width: LATO, height: LATO, rgba };
const plan = buildPittoricoPlan(img, {
  ...defaultPittoricoParams,
  realWidthMm: LATO * MM_PER_PX,
  cuciPassaggi: process.env.RG_SENZA_PASSAGGI !== '1',
  viaPassaggi: (process.env.RG_VIA as 'interno' | 'contorno') ?? defaultPittoricoParams.viaPassaggi,
  margineDalBordoMm: process.env.RG_MARGINE !== undefined
    ? Number(process.env.RG_MARGINE) : defaultPittoricoParams.margineDalBordoMm,
});

// Le fette: dal bordo verso il dentro, larghe `PASSO`, fino a `PROFONDITA`.
const PROFONDITA = 10;
const PASSO = 0.5;
const FETTE = Math.round(PROFONDITA / PASSO);

console.log('');
console.log('LA FRANGIA, MISURATA — filo per mm² a ogni profondità dal bordo');
console.log(`${(LATO * MM_PER_PX).toFixed(0)} mm di lato · fette da ${PASSO} mm fino a ${PROFONDITA} mm`);

for (const t of plan.ordine) {
  const mie = plan.macchie.filter((m) => m.tinta === t);
  const corse = mie.flatMap((m) => m.corse);
  if (!corse.length) continue;

  /*
   * Il bordo è quello di TUTTE le macchie della tinta, in un indice solo, e l'area si conta solo
   * dove si è davvero dentro una di loro. Prima le contavo una per una: dopo il routing però il
   * filo sta tutto sulla prima macchia, quindi ogni corsa veniva misurata contro bordi che non
   * erano i suoi, e l'area comprendeva il fuori — che sta tutto nelle fette esterne, cioè proprio
   * quelle in discussione. Il denominatore sbagliato faceva sembrare la frangia più magra di com'è.
   */
  const bordo = new BoundaryIndex(mie.flatMap((m) => regionRings(m.region)), 4);
  const dentro = (p: { x: number; y: number }): boolean => mie.some((m) => pointInRegion(p, m.region));

  const filo = new Float64Array(FETTE);
  const area = new Float64Array(FETTE);

  for (const corsa of corse) {
    for (let i = 1; i < corsa.length; i++) {
      const a = corsa[i - 1], b = corsa[i];
      const d = bordo.nearest({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }).distMm;
      const k = Math.floor(d / PASSO);
      if (k < FETTE) filo[k] += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }

  const bb = mie.flatMap((m) => m.region.outer).reduce((acc, p) => ({
    x0: Math.min(acc.x0, p.x), y0: Math.min(acc.y0, p.y),
    x1: Math.max(acc.x1, p.x), y1: Math.max(acc.y1, p.y),
  }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const passo = 0.4;
  for (let y = bb.y0; y <= bb.y1; y += passo) {
    for (let x = bb.x0; x <= bb.x1; x += passo) {
      if (!dentro({ x, y })) continue;
      const k = Math.floor(bordo.nearest({ x, y }).distMm / PASSO);
      if (k < FETTE) area[k] += passo * passo;
    }
  }

  const dens = Array.from({ length: FETTE }, (_, k) => (area[k] > 0 ? filo[k] / area[k] : 0));
  // la densità "piena" è quella del cuore: la mediana delle fette oltre la frangia. Se il cuore non
  // c'è — macchie tutte sottili — il profilo non vuol dire niente e non lo si stampa.
  const cuore = dens.slice(Math.round(6 / PASSO)).filter((v, i) => v > 0 && area[Math.round(6 / PASSO) + i] > 20);
  if (cuore.length < 3) { console.log(''); console.log(`tinta ${t} — niente cuore (macchie tutte sottili): profilo non misurabile`); continue; }
  cuore.sort((a, b) => a - b);
  const piena = cuore[Math.floor(cuore.length / 2)];
  if (piena <= 0) continue;

  const barra = (v: number): string => '#'.repeat(Math.max(0, Math.min(40, Math.round((v / piena) * 20))));
  console.log('');
  console.log(`tinta ${t} — densità piena ${piena.toFixed(2)} mm di filo per mm²`);
  for (let k = 0; k < Math.round(6 / PASSO); k++) {
    console.log(`  ${(k * PASSO).toFixed(1)}-${((k + 1) * PASSO).toFixed(1)} mm  ${((dens[k] / piena) * 100).toFixed(0).padStart(4)}%  ${barra(dens[k])}`);
  }
  const meta = dens.slice(0, Math.round(2.5 / PASSO));
  const q = meta.reduce((s, v) => s + v, 0) / meta.length / piena;
  const verdetto = q < 0.3 ? 'degradé' : q < 0.6 ? 'sfumatura corta' : 'LINEA DI CONTORNO';
  console.log(`  → i primi 2,5 mm stanno al ${(q * 100).toFixed(0)}% della densità piena: ${verdetto}`);
}
console.log('');

/*
 * I SALTI FRA UNA CORSA E LA SUCCESSIVA, misurati sulle corse consegnate al routing (`RG_SENZA_PASSAGGI=1`).
 *
 * E' il numero che dice se il passaggio e' un male necessario o un sintomo. In un pettine ben
 * ordinato il salto fra due corse vale la SPAZIATURA: se la mediana e' dieci volte tanto, non c'e'
 * routing che tenga — la catena sta girando a vuoto, e ogni suo giro e' filo sul bordo.
 */
if (process.env.RG_SENZA_PASSAGGI === '1') {
  console.log('I SALTI FRA CORSA E CORSA (quello che il routing dovra poi cucire)');
  console.log(`spaziatura chiesta: ${defaultPittoricoParams.densitySpacingMm} mm`);
  for (const t of plan.ordine) {
    const corse = plan.macchie.filter((m) => m.tinta === t).flatMap((m) => m.corse);
    if (corse.length < 2) continue;
    const d: number[] = [];
    for (let i = 1; i < corse.length; i++) {
      const a = corse[i - 1][corse[i - 1].length - 1], b = corse[i][0];
      d.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    d.sort((a, b) => a - b);
    const q = (f: number): number => d[Math.min(d.length - 1, Math.round(f * (d.length - 1)))];
    const tot = d.reduce((s, v) => s + v, 0);
    const lunghi = d.filter((v) => v > defaultPittoricoParams.densitySpacingMm * 3).length;
    console.log(`  tinta ${t}: ${d.length} salti · mediana ${q(0.5).toFixed(2)} mm · p90 ${q(0.9).toFixed(2)} · massimo ${q(1).toFixed(0)} mm`);
    console.log(`            ${(tot / 1000).toFixed(1)} m in tutto · ${lunghi} salti (${((lunghi / d.length) * 100).toFixed(0)}%) oltre 3 volte la spaziatura`);
  }
  console.log('');
}

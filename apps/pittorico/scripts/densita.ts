// LA DENSITÀ, MAPPATA — e le lunghezze dei passaggi, che sono l'altra faccia dello stesso problema.
//
// Lorenzo, guardando il ricamo: «mi preoccupano un po' i passaggi perché mi sembrano poco puliti, e
// a colpo d'occhio mi preoccupa anche la diversità di densità in alcune parti piuttosto che in
// altre. Nell'immagine è evidente che ci sono densità maggiori e minori. Nella seconda ci sono
// passaggi assurdi che sono fuori il ricamo».
//
// Sono due difetti che si vedono, e uno e' probabilmente la causa dell'altro: ogni millimetro di
// filo di passaggio si posa da qualche parte, e dove si posa la densita' sale. Quindi si misurano
// insieme.
//
//   MAPPA DELLA DENSITA'   quanto filo per mm², cella per cella, disegnata come una mappa di calore
//                          e riassunta in percentili. La densita' chiesta e' 1/spaziatura: la
//                          distanza fra il 5° e il 95° percentile dice quanto il ricamo mantiene
//                          la promessa. Si separa il filo di RIEMPIMENTO da quello di PASSAGGIO,
//                          cosi' si vede subito quanto della disuniformita' e' colpa dei passaggi.
//
//   LUNGHEZZE DEI PASSAGGI quanto sono lunghi, e quanti sono lunghi. Un passaggio corto e' il giro
//                          del pettine; uno da dieci centimetri e' un filo teso attraverso il
//                          disegno, ed e' quello che si vede nella seconda immagine.
//
//   npx esbuild apps/pittorico/scripts/densita.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/densita.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/densita.mjs <cianotipia.bmp>

import { writeFileSync, mkdirSync } from 'node:fs';
import { leggiBmp } from './bmp.ts';
import { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams, type PittoricoPlan } from '../src/pipeline.ts';
import { svgRicamo, svgPassaggi, foglio, COLORE_PASSAGGI } from '../src/viste.ts';
import { pointInRegion, type Polyline } from '@rg/core';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node densita.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
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
  ...defaultPittoricoParams, realWidthMm: LATO * MM_PER_PX,
  lisciaBordiMm: Number(process.env.RG_LISCIA ?? defaultPittoricoParams.lisciaBordiMm),
  metodoRiempimento: (process.env.RG_METODO as 'fasce' | 'iso' | 'tracciato')
    ?? defaultPittoricoParams.metodoRiempimento,   // per confrontare i due motori
  derivaMassima: Number(process.env.RG_DERIVA ?? defaultPittoricoParams.derivaMassima),
  fasciaMm: Number(process.env.RG_FASCIA_MM ?? defaultPittoricoParams.fasciaMm),
  crescitaMm: process.env.RG_CRESCITA !== undefined ? Number(process.env.RG_CRESCITA) : defaultPittoricoParams.crescitaMm,
  sormontoMm: process.env.RG_SORMONTO !== undefined ? Number(process.env.RG_SORMONTO) : defaultPittoricoParams.sormontoMm,
  frangiaMm: process.env.RG_FRANGIA !== undefined
    ? Number(process.env.RG_FRANGIA) : defaultPittoricoParams.frangiaMm,
});
console.log(`metodo: ${process.env.RG_METODO ?? defaultPittoricoParams.metodoRiempimento}`
  + ` · macchie per metodo: ${['fasce', 'iso', 'rotaia', 'distanza'].map((m) => `${m} ${plan.macchie.filter((x) => x.metodo === m).length}`).join(' · ')}`);
const strati = pittoricoExportLayers(plan);

/** Il filo di una polilinea spalmato sulle celle che attraversa, in mm per cella. */
function spalma(linee: Polyline[], cella: number, cols: number, rows: number, out: Float64Array): void {
  for (const l of linee) {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < 1e-9) continue;
      // si campiona il segmento a mezza cella: un punto solo per segmento sbaglierebbe sui lunghi
      const n = Math.max(1, Math.ceil(d / (cella * 0.5)));
      const quota = d / n;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const cx = Math.floor((a.x + (b.x - a.x) * t) / cella);
        const cy = Math.floor((a.y + (b.y - a.y) * t) / cella);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        out[cy * cols + cx] += quota;
      }
    }
  }
}

const CELLA = 2;                                    // 2 mm: piu' piccolo e la cella conta pochi punti
const cols = Math.ceil(plan.larghezzaMm / CELLA), rows = Math.ceil(plan.altezzaMm / CELLA);
const riempimento = new Float64Array(cols * rows);
const passaggi = new Float64Array(cols * rows);
spalma(strati.flatMap((l) => l.polylines), CELLA, cols, rows, riempimento);
spalma(plan.passaggiPerAgo.flatMap((a) => a.vie), CELLA, cols, rows, passaggi);
// i passaggi stanno DENTRO i blocchi cuciti, quindi nel riempimento sono gia' contati: si separano
for (let i = 0; i < riempimento.length; i++) riempimento[i] = Math.max(0, riempimento[i] - passaggi[i]);

const areaCella = CELLA * CELLA;
const chiesta = 1 / defaultPittoricoParams.densitySpacingMm;   // mm di filo per mm², se il passo è quello

/*
 * QUALI CELLE CONTANO. Solo quelle **interamente dentro** una macchia — tutti e quattro gli angoli.
 *
 * Sembra un dettaglio e non lo e': una cella a cavallo del bordo e' ricamata solo per meta', quindi
 * il filo diviso l'area della cella da un numero basso, e la misura la conta come «poco densa». Su
 * un disegno con tante macchie quelle celle sono tante, e da sole facevano sembrare il ricamo molto
 * piu' irregolare di com'e': erano loro tutta la coda bassa. Contarle era misurare il mio reticolo,
 * non il ricamo.
 */
const dentroMacchia = (cx: number, cy: number): boolean => {
  const angoli = [[cx, cy], [cx + CELLA, cy], [cx, cy + CELLA], [cx + CELLA, cy + CELLA]];
  return plan.macchie.some((m) => angoli.every(([x, y]) => pointInRegion({ x, y }, m.region)));
};
const piene = new Uint8Array(cols * rows);
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) if (dentroMacchia(x * CELLA, y * CELLA)) piene[y * cols + x] = 1;
}
const vive: number[] = [];
for (let i = 0; i < riempimento.length; i++) {
  if (piene[i]) vive.push((riempimento[i] + passaggi[i]) / areaCella);
}
vive.sort((a, b) => a - b);
const q = (f: number): number => (vive.length ? vive[Math.min(vive.length - 1, Math.round(f * (vive.length - 1)))] : 0);

// le lunghezze dei passaggi, tutte insieme
const lung: number[] = [];
for (const a of plan.passaggiPerAgo) {
  for (const v of a.vie) {
    let m = 0;
    for (let i = 1; i < v.length; i++) m += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y);
    if (m > 0) lung.push(m);
  }
}
lung.sort((a, b) => a - b);
const ql = (f: number): number => (lung.length ? lung[Math.min(lung.length - 1, Math.round(f * (lung.length - 1)))] : 0);
const oltre = (mm: number): number => lung.filter((v) => v > mm).length;
const mmOltre = (mm: number): number => lung.filter((v) => v > mm).reduce((s, v) => s + v, 0);

const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);

console.log('');
console.log(`LA DENSITÀ — ${n1(plan.larghezzaMm)} × ${n1(plan.altezzaMm)} mm · celle da ${CELLA} mm`);
console.log(`densità chiesta: ${n2(chiesta)} mm di filo per mm² (passo ${defaultPittoricoParams.densitySpacingMm} mm)`);
console.log(`  p5 ${n2(q(0.05))} · p25 ${n2(q(0.25))} · mediana ${n2(q(0.5))} · p75 ${n2(q(0.75))} · p95 ${n2(q(0.95))}`);
console.log(`  la mediana sta al ${((q(0.5) / chiesta) * 100).toFixed(0)}% del chiesto · `
  + `dal p5 al p95 c'è un fattore ${(q(0.95) / Math.max(1e-9, q(0.05))).toFixed(1)}×`);

/*
 * Da dove viene la disuniformita'? Si guardano gli stessi percentili sul solo RIEMPIMENTO e sui
 * soli PASSAGGI, sulle stesse celle. Se il riempimento e' gia' sparso, il colpevole e' il modo di
 * riempire — sovrapposizioni fra macchie, cunei, chiusure dei vuoti. Se invece il riempimento e'
 * regolare e a sparpagliare e' il passaggio, allora si cura il passaggio. Sono due lavori diversi e
 * senza questa separazione si sceglie a caso.
 */
const viveIdx: number[] = [];
for (let i = 0; i < riempimento.length; i++) if (piene[i]) viveIdx.push(i);
const perc = (campo: Float64Array): ((f: number) => number) => {
  const v = viveIdx.map((i) => campo[i] / areaCella).sort((a, b) => a - b);
  return (f: number): number => (v.length ? v[Math.min(v.length - 1, Math.round(f * (v.length - 1)))] : 0);
};
const qr = perc(riempimento), qp = perc(passaggi);
console.log(`  solo riempimento: p5 ${n2(qr(0.05))} · mediana ${n2(qr(0.5))} · p95 ${n2(qr(0.95))} `
  + `(${(qr(0.95) / Math.max(1e-9, qr(0.05))).toFixed(1)}×)`);
console.log(`  solo passaggi:    p5 ${n2(qp(0.05))} · mediana ${n2(qp(0.5))} · p95 ${n2(qp(0.95))} `
  + `· nel 95° percentile valgono il ${((qp(0.95) / Math.max(1e-9, q(0.95))) * 100).toFixed(0)}% del totale`);
const quante = viveIdx.filter((i) => (riempimento[i] + passaggi[i]) / areaCella > chiesta * 1.5).length;
console.log(`  celle oltre il 150% del chiesto: ${quante} su ${viveIdx.length} (${((quante / viveIdx.length) * 100).toFixed(0)}%)`);

/*
 * LA PROVA DECISIVA: la densita' di ogni ago DA SOLO.
 *
 * Se ogni ago, preso per conto suo, consegna la densita' che ha promesso, allora la disuniformita'
 * non e' nel modo di riempire: e' nelle SOVRAPPOSIZIONI. Le macchie si fanno crescere l'una sotto
 * l'altra apposta (e' il sormonto, e serve — senza, fra un colore e l'altro si vedrebbe il tessuto),
 * ma dove due aghi coprono la stessa striscia il filo e' doppio, e li' la densita' raddoppia per
 * costruzione. E' la differenza fra un difetto da correggere e un prezzo da tarare.
 */
/*
 * DOVE stanno le celle troppo dense: in mezzo alla macchia, o attaccate al bordo?
 *
 * E' la domanda che separa due colpevoli diversi. Se stanno al bordo, il di piu' viene da come le
 * macchie si toccano e si sormontano — e allora si tara la crescita. Se stanno in mezzo, viene dal
 * modo di riempire: i cunei che la rotaia infila dove la fascia si allarga, le ombre dietro i fori,
 * la passata che chiude i vuoti. Sono due lavori diversi, e senza sapere quale non si sceglie.
 */
{
  const anelli = plan.macchie.flatMap((m) => [m.region.outer, ...m.region.holes]);
  const distDalBordo = (x: number, y: number): number => {
    let min = Infinity;
    for (const r of anelli) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
        const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
        if (d < min) min = d;
      }
    }
    return min;
  };
  const dense: number[] = [], normali: number[] = [];
  for (const i of viveIdx) {
    const v = (riempimento[i] + passaggi[i]) / areaCella;
    const cx = ((i % cols) + 0.5) * CELLA, cy = (Math.floor(i / cols) + 0.5) * CELLA;
    (v > chiesta * 1.5 ? dense : normali).push(distDalBordo(cx, cy));
  }
  const med = (v: number[]): number => {
    if (!v.length) return 0;
    const o = [...v].sort((a, b) => a - b);
    return o[Math.floor(o.length / 2)];
  };
  console.log('');
  console.log(`  le celle TROPPO DENSE stanno a ${n1(med(dense))} mm dal bordo (mediana), `
    + `le altre a ${n1(med(normali))} mm`);
  const vicine = dense.filter((d) => d < 3).length;
  console.log(`  di quelle dense, ${vicine} su ${dense.length} (${((vicine / Math.max(1, dense.length)) * 100).toFixed(0)}%) stanno entro 3 mm dal bordo`);
}

console.log('');
console.log('  ago per ago, ognuno da solo:');
let sommaAghi = 0;
for (const t of plan.ordine) {
  const mio = new Float64Array(cols * rows);
  spalma(strati.filter((l) => l.id.includes(`tinta-${t}`)).flatMap((l) => l.polylines), CELLA, cols, rows, mio);
  // per un ago si guardano solo le celle intere DELLE SUE macchie: le altre non sono affar suo
  const sue = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const angoli = [[x * CELLA, y * CELLA], [x * CELLA + CELLA, y * CELLA],
        [x * CELLA, y * CELLA + CELLA], [x * CELLA + CELLA, y * CELLA + CELLA]];
      if (plan.macchie.some((m) => m.tinta === t && angoli.every(([ax, ay]) => pointInRegion({ x: ax, y: ay }, m.region)))) {
        sue[y * cols + x] = 1;
      }
    }
  }
  const v: number[] = [];
  for (let i = 0; i < mio.length; i++) if (sue[i]) v.push(mio[i] / areaCella);
  v.sort((a, b) => a - b);
  if (!v.length) continue;
  const qq = (f: number): number => v[Math.min(v.length - 1, Math.round(f * (v.length - 1)))];
  sommaAghi += v.reduce((a, b) => a + b, 0);
  console.log(`    tinta ${t}: ${String(v.length).padStart(4)} celle · p5 ${n2(qq(0.05))} · `
    + `mediana ${n2(qq(0.5))} (${((qq(0.5) / chiesta) * 100).toFixed(0)}% del chiesto) · `
    + `p95 ${n2(qq(0.95))} · ${(qq(0.95) / Math.max(1e-9, qq(0.05))).toFixed(1)}×`);
}
const sommaTot = vive.reduce((a, b) => a + b, 0);
console.log(`  se gli aghi non si sovrapponessero il filo sarebbe lo stesso: `
  + `somma dei singoli ${n1(sommaAghi)} contro totale ${n1(sommaTot)} `
  + `(${((sommaAghi / Math.max(1e-9, sommaTot)) * 100).toFixed(0)}%)`);
console.log('');
console.log(`I PASSAGGI — ${lung.length.toLocaleString('it-IT')} tratti`);
console.log(`  mediana ${n2(ql(0.5))} mm · p90 ${n2(ql(0.9))} · p99 ${n2(ql(0.99))} · massimo ${n1(ql(1))} mm`);
for (const s of [10, 25, 50, 100]) {
  console.log(`  oltre ${String(s).padStart(3)} mm: ${String(oltre(s)).padStart(5)} tratti per ${n1(mmOltre(s) / 1000)} m`);
}
console.log('');

// ---- la mappa, come SVG di celle ------------------------------------------
const scala = q(0.95) > 0 ? q(0.95) : 1;
function mappa(campo: Float64Array, titolo: string): string {
  let celle = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = campo[y * cols + x] / areaCella;
      if (v <= 0) continue;
      const t = Math.min(1.35, v / scala);
      // sotto il chiesto vira al blu, sopra al rosso: il verde-neutro è "come promesso"
      const c = t < 1
        ? `rgb(${Math.round(30 + 200 * t)},${Math.round(70 + 130 * t)},${Math.round(200 - 60 * t)})`
        : `rgb(${Math.round(230)},${Math.round(200 - 150 * (t - 1) / 0.35)},${Math.round(140 - 120 * (t - 1) / 0.35)})`;
      celle += `<rect x="${x * CELLA}" y="${y * CELLA}" width="${CELLA}" height="${CELLA}" fill="${c}" />`;
    }
  }
  return `<figure><figcaption>${titolo}</figcaption><div class="telaio">${foglio(plan, celle)}</div></figure>`;
}

const istogramma = (): string => {
  const n = 24, max = Math.max(...vive, 1e-9);
  const conta = new Array(n).fill(0);
  for (const v of vive) conta[Math.min(n - 1, Math.floor((v / max) * n))]++;
  const alto = Math.max(...conta, 1);
  return conta.map((c, i) => {
    const v = ((i + 0.5) / n) * max;
    return `<div class="barra" style="height:${(c / alto) * 100}%" title="${n2(v)} mm/mm² · ${c} celle"></div>`;
  }).join('');
};

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Punto Pittorico — densità e passaggi</title>
<style>
  :root { color-scheme: light dark; --carta:#faf9f7; --inchiostro:#141414; --tenue:#6b6b6b; --linea:#dcdad5; }
  @media (prefers-color-scheme: dark) { :root { --carta:#141414; --inchiostro:#f2f0ec; --tenue:#9a9a9a; --linea:#333; } }
  body { margin:0; padding:2rem clamp(1rem,4vw,4rem); background:var(--carta); color:var(--inchiostro);
         font:15px/1.55 ui-sans-serif,system-ui,'Segoe UI',sans-serif; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  h2 { font-size:1.1rem; margin:2.5rem 0 .75rem; padding-bottom:.3rem; border-bottom:1px solid var(--linea); }
  .sotto { color:var(--tenue); margin:0 0 1.5rem; max-width:66ch; }
  .fila { display:grid; gap:1.5rem; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); }
  figure { margin:0; } figcaption { color:var(--tenue); font-size:.85rem; margin-bottom:.35rem; }
  .telaio { border:1px solid var(--linea); background:#fff; padding:.35rem; }
  .telaio svg { display:block; width:100%; height:auto; }
  table { border-collapse:collapse; font-size:.9rem; margin-top:.5rem; }
  th,td { border-bottom:1px solid var(--linea); padding:.35rem .9rem .35rem 0; text-align:left;
          font-variant-numeric:tabular-nums; white-space:nowrap; }
  th { color:var(--tenue); font-weight:600; }
  .isto { display:flex; align-items:flex-end; gap:2px; height:110px; margin:.5rem 0 .3rem;
          border-bottom:1px solid var(--linea); }
  .barra { flex:1; background:var(--inchiostro); min-height:1px; }
  .scala { display:flex; justify-content:space-between; color:var(--tenue); font-size:.8rem; }
  .rosso { color:${COLORE_PASSAGGI}; }
</style></head><body>
<h1>Densità e passaggi</h1>
<p class="sotto">Ritaglio di ${n1(plan.larghezzaMm)} × ${n1(plan.altezzaMm)} mm, celle da ${CELLA} mm.
La densità chiesta è <b>${n2(chiesta)} mm di filo per mm²</b> (un passo di
${defaultPittoricoParams.densitySpacingMm} mm). Nella mappa il <span style="color:#1e4bc8">blu</span>
è sotto il chiesto, il <span style="color:#e6a020">giallo-rosso</span> è sopra.</p>

<h2>Dove il filo è troppo, e dove è troppo poco</h2>
<div class="fila">
${mappa(riempimento, 'solo riempimento')}
${mappa(passaggi, 'solo passaggi')}
${(() => { const t = new Float64Array(cols * rows); for (let i = 0; i < t.length; i++) t[i] = riempimento[i] + passaggi[i]; return mappa(t, 'tutto insieme'); })()}
</div>
<div class="isto">${istogramma()}</div>
<div class="scala"><span>0</span><span>densità delle celle ricamate</span><span>${n2(Math.max(...vive))} mm/mm²</span></div>
<table>
<tr><th>p5</th><th>p25</th><th>mediana</th><th>p75</th><th>p95</th><th>p95/p5</th></tr>
<tr><td>${n2(q(0.05))}</td><td>${n2(q(0.25))}</td><td>${n2(q(0.5))}</td><td>${n2(q(0.75))}</td>
<td>${n2(q(0.95))}</td><td>${(q(0.95) / Math.max(1e-9, q(0.05))).toFixed(1)}×</td></tr>
</table>

<h2>Quanto sono lunghi i passaggi</h2>
<p class="sotto">Un passaggio corto è il giro del pettine e non si vede. Uno da dieci centimetri è un
filo teso attraverso il disegno.</p>
<table>
<tr><th>tratti</th><th>mediana</th><th>p90</th><th>p99</th><th>massimo</th></tr>
<tr><td>${lung.length.toLocaleString('it-IT')}</td><td>${n2(ql(0.5))} mm</td><td>${n2(ql(0.9))} mm</td>
<td>${n2(ql(0.99))} mm</td><td>${n1(ql(1))} mm</td></tr>
</table>
<table>
<tr><th>oltre</th><th>tratti</th><th>filo</th></tr>
${[10, 25, 50, 100].map((s) => `<tr><td>${s} mm</td><td>${oltre(s)}</td><td>${n1(mmOltre(s) / 1000)} m</td></tr>`).join('')}
</table>

<h2>Il ricamo, e il filo di passaggio</h2>
<div class="fila">
<figure><figcaption>ricamo</figcaption><div class="telaio">${svgRicamo(plan, strati)}</div></figure>
<figure><figcaption class="rosso">solo i passaggi</figcaption><div class="telaio">${svgPassaggi(plan, strati)}</div></figure>
</div>
</body></html>`;

const dir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const fuori = `${dir}densita.html`;
writeFileSync(fuori, html, 'utf8');
console.log(`→ ${fuori}  (${(html.length / 1024).toFixed(0)} kB)`);
console.log('');

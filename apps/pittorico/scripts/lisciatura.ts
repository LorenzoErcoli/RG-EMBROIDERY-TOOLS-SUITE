// DA DOVE VIENE IL FRASTAGLIO: dal contorno della macchia, o dalla frangia che ci mettiamo noi?
//
// Lorenzo, guardando le macchie: «i bordi sono davvero frastagliati e questo crea un sacco di caos
// al ricamo; possiamo fare un test che appiattisce tutte le frastaglie e rende i bordi lisci? e
// vediamo intanto come si muove il ricamo quando ha bordi precisi?».
//
// Le cose che possono frastagliare un bordo sono due, e sono opposte:
//
//   il CONTORNO della macchia   nasce da un'immagine, quindi in origine e' una scalinata di pixel.
//                               Si liscia con `lisciaBordiMm`.
//   la FRANGIA                  la fabbrichiamo noi, apposta, accorciando le corse di quantita'
//                               diverse: e' il degrade'. Si spegne con `frangiaMm: 0`.
//
// La prima misura ha risposto da sola alla prima meta': i contorni hanno **282 vertici in tutto**
// su sette macchie di 90 mm, e lisciarli non li semplifica — li infittisce. Non sono una scalinata:
// `traceRegions` li semplifica gia' a un pixel e mezzo. Quindi il frastaglio che si vede non e' li'.
//
// Questo banco mette le quattro combinazioni una accanto all'altra e le misura, cosi' la domanda
// «da dove viene il caos» ha una risposta e non un'impressione. Cosa si guarda:
//
//   frastaglio     quanto gira il CONTORNO per millimetro: la misura diretta della scalinata
//   vertici, area  quanti punti descrivono i contorni, e quanta forma sopravvive alla lisciatura
//   passaggi       filo speso per andare — e' il caos che si vede in macchina
//   sul contorno   quante volte il routing ha dovuto girare intorno invece di andare dritto
//   rotazione      quanto ruota il raso per millimetro: e' il «raso che ruota troppo libero»
//
//   npx esbuild apps/pittorico/scripts/lisciatura.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/lisciatura.mjs
//   node --max-old-space-size=4096 apps/pittorico/scripts/lisciatura.mjs <cianotipia.bmp>

import { writeFileSync, mkdirSync } from 'node:fs';
import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';
import { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams, type PittoricoPlan } from '../src/pipeline.ts';
import { svgMacchie, svgRicamo, COLORE_PASSAGGI } from '../src/viste.ts';

const percorso = process.argv[2];
if (!percorso) { console.error('uso: node lisciatura.mjs <percorso.bmp> [larghezzaMm]'); process.exit(1); }
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

/**
 * Quanto ruota il filo, in gradi per millimetro percorso.
 *
 * E' la misura del difetto che Lorenzo ha chiamato «il raso che ruota con troppa liberta'»: se il
 * contorno e' una scalinata, il campo di direzione prende la perpendicolare del GRADINO invece di
 * quella del bordo vero, e il punto gira dove il disegno non gira. Si guarda la mediana e la coda
 * alta: la mediana dice come si comporta di solito, il p95 dove impazzisce.
 */
function rotazione(pl: PittoricoPlan): { mediana: number; p95: number } {
  const g: number[] = [];
  for (const m of pl.macchie) {
    for (const c of m.corse) {
      for (let i = 2; i < c.length - 1; i++) {
        const a = c[i - 1], b = c[i], d = c[i + 1];
        const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(d.x - b.x, d.y - b.y);
        if (l1 < 0.2 || l2 < 0.2) continue;
        const ang = Math.abs(Math.atan2(d.y - b.y, d.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
        const giro = Math.min(ang, 2 * Math.PI - ang) * (180 / Math.PI);
        g.push(giro / ((l1 + l2) / 2));
      }
    }
  }
  if (!g.length) return { mediana: 0, p95: 0 };
  g.sort((a, b) => a - b);
  const q = (f: number): number => g[Math.min(g.length - 1, Math.round(f * (g.length - 1)))];
  return { mediana: q(0.5), p95: q(0.95) };
}

/**
 * FRASTAGLIO DEL CONTORNO: quante volte, per millimetro, il bordo cambia verso di curvatura.
 *
 * La prima versione contava i gradi per millimetro, ed era la misura sbagliata: quella e'
 * **curvatura**, e una curva vera gira esattamente quanto uno zigzag. Infatti dava 10,35 gradi/mm
 * prima e 10,21 dopo aver lisciato di un millimetro e mezzo — non perche' la lisciatura non
 * funzionasse, ma perche' il numero non guardava la cosa giusta.
 *
 * Il frastaglio non e' girare: e' girare **avanti e indietro**. Un bordo liscio, anche molto curvo,
 * tiene lo stesso verso per tratti lunghi; uno frastagliato lo inverte a ogni dente. Quindi si
 * contano le inversioni di segno, per millimetro di perimetro.
 *
 * Il contorno si ricampiona sempre a mezzo millimetro prima di misurare. Senza, il numero
 * direbbe soltanto quanto e' fitto il poligono — e la lisciatura cambia proprio quello.
 */
function frastaglio(pl: PittoricoPlan): number {
  let inversioni = 0, mm = 0;
  for (const m of pl.macchie) {
    for (const anello of [m.region.outer, ...m.region.holes]) {
      if (anello.length < 8) continue;
      // a passo costante di 0,5 mm, sull'anello chiuso
      const chiuso = [...anello, anello[0]];
      const q: Array<{ x: number; y: number }> = [];
      let resto = 0;
      for (let i = 1; i < chiuso.length; i++) {
        const a = chiuso[i - 1], b = chiuso[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1e-12) continue;
        let t = resto;
        while (t < len) {
          q.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
          t += 0.5;
        }
        resto = t - len;
      }
      const n = q.length;
      if (n < 8) continue;
      let segnoPrec = 0;
      for (let i = 0; i < n; i++) {
        const a = q[(i - 1 + n) % n], b = q[i], c = q[(i + 1) % n];
        // il prodotto vettoriale dice da che parte si sta girando
        const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        const segno = Math.abs(cr) < 1e-9 ? 0 : (cr > 0 ? 1 : -1);
        if (segno !== 0) {
          if (segnoPrec !== 0 && segno !== segnoPrec) inversioni++;
          segnoPrec = segno;
        }
      }
      mm += n * 0.5;
    }
  }
  return mm > 0 ? inversioni / mm : 0;
}

const vertici = (pl: PittoricoPlan): number =>
  pl.macchie.reduce((s, m) => s + m.region.outer.length + m.region.holes.reduce((h, r) => h + r.length, 0), 0);
const area = (pl: PittoricoPlan): number => pl.macchie.reduce((s, m) => s + m.region.areaMm2, 0);

interface Prova { nome: string; spiega: string; pl: PittoricoPlan; ms: number }
const CASI: Array<[string, string, number, number]> = [
  ['com\u2019\u00e8 oggi', 'contorno dalla tracciatura, frangia da 5 mm', 0, defaultPittoricoParams.frangiaMm],
  ['senza frangia', 'il degrad\u00e9 spento: ogni corsa arriva fino in fondo', 0, 0],
  ['contorno lisciato', 'la frangia resta, il contorno si liscia di 1,6 mm', 1.6, defaultPittoricoParams.frangiaMm],
  ['tutto preciso', 'niente frangia e contorno lisciato: il bordo pi\u00f9 netto possibile', 1.6, 0],
];
const prove: Prova[] = CASI.map(([nome, spiega, liscia, frangia]) => {
  const t0 = Date.now();
  const pl = buildPittoricoPlan(img, {
    ...defaultPittoricoParams, realWidthMm: LATO * MM_PER_PX,
    lisciaBordiMm: liscia, frangiaMm: frangia,
  });
  return { nome, spiega, pl, ms: Date.now() - t0 };
});

const base = prove[0];
const n1 = (v: number): string => v.toFixed(1);
const n2 = (v: number): string => v.toFixed(2);
const rispetto = (v: number, b: number): string => {
  if (b <= 0) return '';
  const d = ((v - b) / b) * 100;
  return `<span class="${d < -2 ? 'meglio' : d > 2 ? 'peggio' : 'uguale'}">${d >= 0 ? '+' : ''}${d.toFixed(0)}%</span>`;
};

console.log('');
console.log('BORDI FRASTAGLIATI CONTRO BORDI LISCI');
console.log(`ritaglio ${n1(base.pl.larghezzaMm)} × ${n1(base.pl.altezzaMm)} mm`);
console.log('');
for (const p of prove) {
  const r = rotazione(p.pl);
  const contorno = p.pl.passaggiPerAgo.reduce((s, a) => s + a.perCaso.contorno.volte, 0);
  const contornoMm = p.pl.passaggiPerAgo.reduce((s, a) => s + a.perCaso.contorno.mm, 0);
  console.log(`${p.nome} \u2014 ${p.spiega}`);
  console.log(`  frastaglio del contorno ${n2(frastaglio(p.pl))}  inversioni per mm`);
  console.log(`  vertici ${vertici(p.pl).toLocaleString('it-IT')} · area ${n1(area(p.pl))} mm² · `
    + `${p.pl.macchie.length} macchie`);
  console.log(`  filo ${n1(p.pl.filoMm / 1000)} m · passaggi ${n1(p.pl.saltoMm / 1000)} m · `
    + `${contorno} giri sul contorno per ${n1(contornoMm / 1000)} m · ${p.pl.salti} salti`);
  console.log(`  rotazione del raso: mediana ${n2(r.mediana)}°/mm · p95 ${n2(r.p95)}°/mm · ${p.ms} ms`);
  console.log('');
}

const righe = prove.map((p) => {
  const r = rotazione(p.pl), rb = rotazione(base.pl);
  const contorno = p.pl.passaggiPerAgo.reduce((s, a) => s + a.perCaso.contorno.volte, 0);
  const contornoB = base.pl.passaggiPerAgo.reduce((s, a) => s + a.perCaso.contorno.volte, 0);
  return `<tr><th>${p.nome}</th>`
    + `<td>${n2(frastaglio(p.pl))} ${rispetto(frastaglio(p.pl), frastaglio(base.pl))}</td>`
    + `<td>${vertici(p.pl).toLocaleString('it-IT')} ${rispetto(vertici(p.pl), vertici(base.pl))}</td>`
    + `<td>${n1(area(p.pl))} mm² ${rispetto(area(p.pl), area(base.pl))}</td>`
    + `<td>${p.pl.macchie.length}</td>`
    + `<td>${n1(p.pl.filoMm / 1000)} m ${rispetto(p.pl.filoMm, base.pl.filoMm)}</td>`
    + `<td>${n1(p.pl.saltoMm / 1000)} m ${rispetto(p.pl.saltoMm, base.pl.saltoMm)}</td>`
    + `<td>${contorno} ${rispetto(contorno, contornoB)}</td>`
    + `<td>${n2(r.mediana)} ${rispetto(r.mediana, rb.mediana)}</td>`
    + `<td>${n2(r.p95)} ${rispetto(r.p95, rb.p95)}</td></tr>`;
}).join('\n');

const colonne = prove.map((p) => `<div class="col"><h2>${p.nome}</h2><p class="spiega">${p.spiega}</p>`
  + `<figure><figcaption>macchie</figcaption><div class="telaio">${svgMacchie(p.pl)}</div></figure>`
  + `<figure><figcaption>ricamo</figcaption><div class="telaio">${svgRicamo(p.pl, pittoricoExportLayers(p.pl))}</div></figure>`
  + `</div>`).join('\n');

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Punto Pittorico — bordi lisci</title>
<style>
  :root { color-scheme: light dark; --carta:#faf9f7; --inchiostro:#141414; --tenue:#6b6b6b; --linea:#dcdad5;
          --meglio:#1a7f4b; --peggio:#b3341f; }
  @media (prefers-color-scheme: dark) { :root { --carta:#141414; --inchiostro:#f2f0ec; --tenue:#9a9a9a;
          --linea:#333; --meglio:#4bd08a; --peggio:#ff7a5e; } }
  body { margin:0; padding:2rem clamp(1rem,4vw,4rem); background:var(--carta); color:var(--inchiostro);
         font:15px/1.55 ui-sans-serif,system-ui,'Segoe UI',sans-serif; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  .sotto { color:var(--tenue); margin:0 0 2rem; max-width:66ch; }
  .fila { display:grid; gap:1.5rem; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
  .col h2 { font-size:1.05rem; margin:0 0 .2rem; padding-bottom:.35rem; border-bottom:2px solid var(--inchiostro); }
  .spiega { color:var(--tenue); font-size:.82rem; margin:0 0 .8rem; min-height:2.6em; }
  figure { margin:0 0 1rem; }
  figcaption { color:var(--tenue); font-size:.85rem; margin-bottom:.35rem; }
  .telaio { border:1px solid var(--linea); background:#fff; padding:.35rem; }
  .telaio svg { display:block; width:100%; height:auto; }
  table { border-collapse:collapse; margin-top:2.5rem; font-size:.9rem; width:100%; }
  th,td { border-bottom:1px solid var(--linea); padding:.4rem .8rem .4rem 0; text-align:left;
          font-variant-numeric:tabular-nums; white-space:nowrap; }
  thead th { color:var(--tenue); font-weight:600; }
  tbody th { font-weight:700; }
  .meglio { color:var(--meglio); } .peggio { color:var(--peggio); } .uguale { color:var(--tenue); }
  .nota { margin-top:1.5rem; color:var(--tenue); max-width:66ch; }
  .nota b { color:var(--inchiostro); }
</style></head><body>
<h1>Bordi frastagliati contro bordi lisci</h1>
<p class="sotto">Lo stesso ritaglio di ${n1(base.pl.larghezzaMm)} × ${n1(base.pl.altezzaMm)} mm,
quattro lisciature del contorno. A <b>0 mm</b> il bordo è la scalinata di pixel che esce dalla
tracciatura, com'era fino a ieri. Le percentuali sono rispetto a quella colonna: <span class="meglio">verde</span>
= il numero è sceso, <span class="peggio">rosso</span> = è salito. Attenzione che non tutto ciò che scende
è un guadagno — se cala l'<b>area</b>, la lisciatura sta mangiando forma vera insieme ai gradini.</p>
<div class="fila">${colonne}</div>
<table>
<thead><tr><th>caso</th><th>frastaglio inv./mm</th><th>vertici</th><th>area</th><th>macchie</th><th>filo</th>
<th>passaggi</th><th>giri sul contorno</th><th>rotazione mediana °/mm</th><th>p95 °/mm</th></tr></thead>
<tbody>${righe}</tbody>
</table>
<p class="nota">Come leggerla. Il <b>frastaglio</b> \u00e8 quanti gradi gira il contorno per ogni
millimetro percorso: un bordo liscio gira poco, una scalinata di pixel gira di 90 gradi a ogni
gradino. \u00c8 la misura che dice se il problema sta nel contorno. I <b>vertici</b> sono quanti punti
servono a descriverlo. I <b>giri sul contorno</b> sono le volte in cui il filo non ha
trovato la via dritta e ha dovuto costeggiare — è il caos che si vede in macchina, ed è già stato
la causa della linea sul degradé. La <b>rotazione</b> è quanto gira il punto per ogni millimetro
percorso: è il «raso che ruota con troppa libertà», e se la scalinata è la causa, deve scendere qui.
Il <span style="color:${COLORE_PASSAGGI}">filo di passaggio</span> si guarda nella vista Passaggi
del tool, non qui.</p>
</body></html>`;

const dir = new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const fuori = `${dir}lisciatura.html`;
writeFileSync(fuori, html, 'utf8');
console.log(`→ ${fuori}  (${(html.length / 1024).toFixed(0)} kB)`);
console.log('');

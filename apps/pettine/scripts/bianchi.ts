// IL PELO GUIDATO DAI BIANCHI — e la riga in mezzo che si forma da sola.
//
// Lorenzo, guardando il disegno: «le macchie al centro si muovono un po' seguendo i bianchi e
// allontanandosi da questi, non saprei come poter rendere armoniosa l'area dove ci sono due bianchi
// intorno». La descrizione contiene già la soluzione, e non richiede di identificare gli oggetti a
// mano: quello che governa è la DISTANZA DAL BIANCO.
//
//   * le linee di base sono le CURVE DI LIVELLO di quella distanza — e una curva di livello segue il
//     bianco per costruzione, non per taratura;
//   * il dente esce PERPENDICOLARE alla curva di livello, cioè lungo il gradiente, cioè dritto verso
//     il bianco (o via da lui: è un segno);
//   * dove ci sono DUE bianchi, i due fronti si incontrano su una cresta — il luogo dei punti
//     equidistanti — e lì il pelo si divide da solo, come una scriminatura. Non c'è niente da
//     decidere e niente da tarare: l'armonia di quel punto è una conseguenza geometrica.
//
// Il pezzo per estrarre le curve di livello esiste già ed è di un altro tool (`livello` e `incatena`
// in `apps/pittorico/src/iso-fill.ts`, dal riempimento per curve di livello). Qui cambia solo QUALE
// distanza si mette dentro: non quella anisotropa di quel motore, ma la distanza vera dal bianco.
//
//   npx esbuild apps/pettine/scripts/bianchi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/bianchi.mjs
//   node --max-old-space-size=4096 apps/pettine/scripts/bianchi.mjs <file.svg> [basi] [passo] [dMin] [dMax] [incl]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, pointInPolygon, polygonArea } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '@rg/core';
import { rasterizza, livello, incatena } from '@rg/core';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;                     // la griglia su cui si misura la distanza dal bianco

const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const percorso = process.argv[2];
const BASI_MM = num(3, 2);
const PASSO_MM = Math.max(1, num(4, 1.5));
const DENTE_MIN = num(5, 4), DENTE_MAX = num(6, 10);
const INCL = num(7, 40);
if (!percorso) { console.error('uso: node bianchi.mjs <file.svg> [basi] [passo] [dMin] [dMax] [incl]'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- il file: aree per colore, in millimetri veri ----------------------------------------------
const testo = readFileSync(percorso, 'utf8');
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
const classi = [...testo.matchAll(/<path[^>]*class="(st\d+)"/g)].map((m) => m[1]);
const letto = parseSvgPolylines(testo, {});
const K = LARGHEZZA_REALE_MM / letto.widthMm;
const W = letto.widthMm * K, H = letto.heightMm * K;
const aree = letto.polylines.map((p, i) => ({
  punti: p.map((q) => ({ x: q.x * K, y: q.y * K })) as Polyline,
  colore: stili.get(classi[i] ?? '') ?? 'none',
})).map((a) => ({ ...a, area: Math.abs(polygonArea(a.punti)) })).filter((a) => a.colore !== 'none' && a.area > 20);

const luminosita = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

const perColore = new Map<string, typeof aree>();
for (const a of aree) {
  const l = perColore.get(a.colore) ?? [];
  l.push(a); perColore.set(a.colore, l);
}
const ordinati = [...perColore.keys()].sort((a, b) => luminosita(b) - luminosita(a));
console.log(`\n${percorso}\n${W.toFixed(1)} × ${H.toFixed(1)} mm · tinte dal chiaro allo scuro: ${ordinati.map((c) => `${c} (${luminosita(c).toFixed(2)})`).join(' · ')}`);

function regioniDi(lista: typeof aree): Array<{ outer: Polyline; holes: Polyline[] }> {
  const ord = [...lista].sort((a, b) => b.area - a.area);
  const usate = new Set<number>();
  const out: Array<{ outer: Polyline; holes: Polyline[] }> = [];
  ord.forEach((a, i) => {
    if (usate.has(i)) return;
    const holes: Polyline[] = [];
    ord.forEach((b, j) => {
      if (j <= i || usate.has(j)) return;
      if (pointInPolygon(b.punti[0], a.punti)) { holes.push(b.punti); usate.add(j); }
    });
    out.push({ outer: a.punti, holes });
  });
  return out;
}

// --- la griglia: dov'è il bianco, e dov'è ogni tinta -------------------------------------------
const COLS = Math.ceil(W / CELLA) + 2, ROWS = Math.ceil(H / CELLA) + 2;
const tinta = new Int8Array(COLS * ROWS).fill(-1);      // -1 = fondo (tessuto nudo)
ordinati.forEach((colore, idx) => {
  for (const r of regioniDi(perColore.get(colore)!)) {
    const dentro = rasterizza(makeRegion(r.outer, r.holes), 0, 0, COLS, ROWS, CELLA);
    for (let i = 0; i < dentro.length; i++) if (dentro[i]) tinta[i] = idx;
  }
});

/**
 * LA DISTANZA DAL BIANCO, in millimetri, con due passate (chamfer 3-4 sulla griglia). Il «bianco» è
 * la tinta più chiara più il fondo: sono le due cose da cui il pelo si misura.
 */
const INF = 1e9;
const D = new Float32Array(COLS * ROWS).fill(INF);
for (let i = 0; i < D.length; i++) if (tinta[i] === -1 || tinta[i] === 0) D[i] = 0;
const a1 = CELLA, a2 = CELLA * Math.SQRT2;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const i = r * COLS + c;
  let v = D[i];
  if (c > 0) v = Math.min(v, D[i - 1] + a1);
  if (r > 0) v = Math.min(v, D[i - COLS] + a1);
  if (c > 0 && r > 0) v = Math.min(v, D[i - COLS - 1] + a2);
  if (c + 1 < COLS && r > 0) v = Math.min(v, D[i - COLS + 1] + a2);
  D[i] = v;
}
for (let r = ROWS - 1; r >= 0; r--) for (let c = COLS - 1; c >= 0; c--) {
  const i = r * COLS + c;
  let v = D[i];
  if (c + 1 < COLS) v = Math.min(v, D[i + 1] + a1);
  if (r + 1 < ROWS) v = Math.min(v, D[i + COLS] + a1);
  if (c + 1 < COLS && r + 1 < ROWS) v = Math.min(v, D[i + COLS + 1] + a2);
  if (c > 0 && r + 1 < ROWS) v = Math.min(v, D[i + COLS - 1] + a2);
  D[i] = v;
}
let maxD = 0;
for (const v of D) if (v < INF && v > maxD) maxD = v;
console.log(`distanza dal bianco: fino a ${maxD.toFixed(1)} mm (la macchia più "profonda" del disegno)`);

/** Il gradiente della distanza: dice dove sta il bianco, ed è la direzione del dente. */
const gradiente = (p: Point): Point => {
  const c = Math.min(COLS - 2, Math.max(1, Math.round(p.x / CELLA)));
  const r = Math.min(ROWS - 2, Math.max(1, Math.round(p.y / CELLA)));
  const i = r * COLS + c;
  const gx = (D[i + 1] - D[i - 1]) / (2 * CELLA);
  const gy = (D[i + COLS] - D[i - COLS]) / (2 * CELLA);
  const l = Math.hypot(gx, gy);
  // −gradiente = verso il bianco. Dove il campo è piatto (cresta) non c'è direzione: si dirà dopo.
  return l < 1e-6 ? { x: 0, y: 0 } : { x: -gx / l, y: -gy / l };
};

// --- le basi: le curve di livello della distanza, dentro ogni tinta scura -----------------------
const pezzi: string[] = [];
const perTinta = new Map<string, string[]>();
let denti = 0, filoMm = 0, basiTot = 0, senzaDirezione = 0;

ordinati.forEach((colore, idx) => {
  if (idx === 0) return;                                 // la tinta chiara è il riferimento: non si sfrangia
  const dentro = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < tinta.length; i++) if (tinta[i] === idx) dentro[i] = 1;
  const acc: string[] = [];
  for (let v = BASI_MM / 2; v < maxD; v += BASI_MM) {
    const linee = incatena(livello(D, dentro, COLS, ROWS, 0, 0, CELLA, v), CELLA * 1.5);
    for (const linea of linee) {
      if (linea.length < 3) continue;
      basiTot++;
      // il pettine sulla curva di livello: il dente segue il gradiente, cioè punta al bianco
      let tot = 0;
      const cum: number[] = [0];
      for (let i = 1; i < linea.length; i++) {
        tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y);
        cum.push(tot);
      }
      const punti: Point[] = [];
      let k = 0;
      for (let d = 0; d <= tot; d += PASSO_MM, k++) {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < d) i++;
        const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        const a = linea[i - 1], b = linea[i];
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const g = gradiente(p);
        if (g.x === 0 && g.y === 0) { senzaDirezione++; continue; }
        const r1 = caso(idx * 7919 + Math.round(v * 10), k * 2), r2 = caso(idx * 104729 + Math.round(v * 10), k * 2 + 1);
        const lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
        const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
        const ux = g.x * Math.cos(ang) - g.y * Math.sin(ang);
        const uy = g.x * Math.sin(ang) + g.y * Math.cos(ang);
        punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
      }
      if (punti.length < 3) continue;
      denti += Math.floor(punti.length / 3);
      for (let i = 1; i < punti.length; i++) filoMm += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
      acc.push(punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
    }
  }
  perTinta.set(colore, acc);
});

// si disegna dal chiaro allo scuro: chi viene dopo copre chi viene prima
for (const c of ordinati) {
  const d = perTinta.get(c);
  if (d?.length) pezzi.push(`<path d="${d.join('')}" fill="none" stroke="${c}" stroke-width="0.1"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm">
<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `bianchi-b${BASI_MM}-p${PASSO_MM}-d${DENTE_MIN}_${DENTE_MAX}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, svg, 'utf8');
console.log(`${basiTot} linee di base · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo · ${senzaDirezione} punti senza direzione (sulla cresta)`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

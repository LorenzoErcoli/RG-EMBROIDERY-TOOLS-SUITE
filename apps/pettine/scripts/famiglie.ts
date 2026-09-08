// LE FAMIGLIE: un livello del file = un raggruppamento di blocchi con la stessa direzione e la
// stessa curvatura. Prima di ricamare, l'immagine per capirsi.
//
// Lorenzo: «ti do un svg dove ho raggruppato i blocchi che vorrei avessero la stessa direzione e
// curvatura. La direzione del pettine verso il chiaro, la sovrapposizione dal chiaro verso lo scuro.
// Prima di realizzare proviamo a esaminare attraverso immagini se ci siamo capiti».
//
// COM'È FATTO IL FILE. Diciannove livelli (Livello_7 … Livello_25). Ogni livello è una FAMIGLIA: le
// sue forme sono le fasce di un gradiente, dal chiaro allo scuro, che condividono una curvatura. I
// colori sono sei, e stavolta coerenti: #dddbd3 · #a3d6d8 · #699dd4 · #1b3257 · #132237 · #0b131e.
//
// LA COSTRUZIONE, per famiglia:
//   1. l'UNIONE delle sue forme è il blocco su cui si fa la fusione;
//   2. il MURO DI PARTENZA (A, rosso) è il tratto del contorno dell'unione che appartiene alla forma
//      più chiara della famiglia; il MURO OPPOSTO (B, blu) è il resto. Una famiglia di una forma sola
//      (le isole scure) si spezza in due metà col riferimento;
//   3. le linee di base sono le vie di mezzo fra A e B, e ogni tratto prende il COLORE della forma che
//      ha sotto: la curvatura è una per tutta la famiglia, il colore cambia dove cambiano le forme;
//   4. i DENTI vanno verso A, cioè verso il chiaro;
//   5. la SOVRAPPOSIZIONE (arancio nell'immagine di verifica): dove una forma chiara confina con una più
//      scura, le sue linee continuano sotto la scura per `sormonto` mm — dal chiaro verso lo scuro.
//
//   npx esbuild apps/pettine/scripts/famiglie.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/famiglie.mjs
//   VERIFICA=1 node --max-old-space-size=6144 apps/pettine/scripts/famiglie.mjs <file.svg> [basi] [sormonto] [lisciaMm]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, pointInPolygon, polygonArea, traceRegions } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '../../pittorico/src/region.ts';
import { rasterizza } from '../../pittorico/src/iso-fill.ts';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const fileSvg = process.argv[2];
const BASI_MM = num(3, 4);
const SORM_MM = num(4, 4);
const LISCIA_MM = num(5, 1.5);
// quanto la linea si addolcisce allontanandosi dal muro: mm di lisciatura per mm di distanza.
// Vicino al muro la linea lo ricopia, lontano perde gli spigoli - come in una fusione vera.
const ADDOLCISCI = num(6, 0.6);
const RIFERIMENTO_DEG = -90;
if (!fileSvg) { console.error('uso: node famiglie.mjs <file.svg> [basi] [sormonto] [lisciaMm]'); process.exit(1); }

const luminosita = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// --- 1. il file: livelli → famiglie → forme col loro colore -------------------------------------------
const testo = readFileSync(fileSvg, 'utf8');
const viewBox = /viewBox="([^"]+)"/.exec(testo)![1];
const [vbW, vbH] = viewBox.split(/\s+/).slice(2).map(Number);
const K = LARGHEZZA_REALE_MM / vbW;
const WM = vbW * K, HM = vbH * K;
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);

interface Forma { colore: string; punti: Polyline; area: number }
interface Famiglia { nome: string; forme: Forma[] }
const famiglie: Famiglia[] = [];
// i livelli sono i <g id="Livello_N"> di primo livello: si prende tutto quello che c'è dentro
for (const m of testo.matchAll(/<g id="(Livello_\d+)"[^>]*>([\s\S]*?)(?=<g id="Livello_\d+"|<\/svg>)/g)) {
  const nome = m[1], corpo = m[2];
  const forme: Forma[] = [];
  for (const el of corpo.matchAll(/<(path|polygon)\b[^>]*>/g)) {
    const cls = /class="(st\d+)"/.exec(el[0])?.[1];
    const colore = (cls && stili.get(cls)) || /fill="([^"]+)"/.exec(el[0])?.[1] || '#808080';
    const tag = el[0].replace(/class="st\d+"/, 'fill="#000"');
    const letto = parseSvgPolylines(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${tag}</svg>`, {});
    for (const p of letto.polylines) {
      const pl = p.map((q) => ({ x: q.x * K, y: q.y * K }));
      const area = Math.abs(polygonArea(pl));
      if (pl.length >= 3 && area > 5) forme.push({ colore, punti: pl, area });
    }
  }
  if (forme.length) famiglie.push({ nome, forme });
}
const colori = [...new Set(famiglie.flatMap((f) => f.forme.map((x) => x.colore)))].sort((a, b) => luminosita(b) - luminosita(a));
const rango = new Map(colori.map((c, i) => [c, i]));
console.log(`\n${fileSvg}\n${WM.toFixed(1)} × ${HM.toFixed(1)} mm · ${famiglie.length} famiglie · colori dal chiaro allo scuro: ${colori.join(' · ')}`);

// --- 2. la griglia: per ogni cella il colore (chi è più scuro vince) e la famiglia ---------------------
const COLS = Math.ceil(WM / CELLA) + 2, ROWS = Math.ceil(HM / CELLA) + 2;
const tinta = new Int8Array(COLS * ROWS).fill(-1);
const famDi = new Int16Array(COLS * ROWS).fill(-1);
famiglie.forEach((f, fi) => {
  for (const s of [...f.forme].sort((a, b) => b.area - a.area)) {
    const dentro = rasterizza(makeRegion(s.punti, []), 0, 0, COLS, ROWS, CELLA);
    const r = rango.get(s.colore)!;
    for (let i = 0; i < dentro.length; i++) if (dentro[i]) {
      // dentro una famiglia le forme sono annidate dal chiaro allo scuro: la più scura vince la cella
      if (famDi[i] !== fi || tinta[i] < r) { tinta[i] = r; famDi[i] = fi; }
    }
  }
});
const cella = (p: Point): number => {
  const c = Math.round(p.x / CELLA), r = Math.round(p.y / CELLA);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
};
const tintaIn = (p: Point): number => { const i = cella(p); return i < 0 ? -1 : tinta[i]; };

// --- 3. geometria ---------------------------------------------------------------------------------------
function ricampiona(l: Point[], passo: number): Point[] {
  const out: Point[] = [l[0]];
  let resto = 0;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-9) continue;
    let s = passo - resto;
    while (s <= d) { out.push({ x: a.x + ((b.x - a.x) * s) / d, y: a.y + ((b.y - a.y) * s) / d }); s += passo; }
    resto = d - (s - passo);
  }
  return out;
}
function liscia(l: Point[], sigmaMm: number, passo: number): Point[] {
  if (sigmaMm <= 0 || l.length < 3) return l;
  const raggio = Math.ceil((sigmaMm * 3) / passo);
  const pesi: number[] = [];
  for (let k = -raggio; k <= raggio; k++) pesi.push(Math.exp(-((k * passo) ** 2) / (2 * sigmaMm * sigmaMm)));
  return l.map((_, i) => {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -raggio; k <= raggio; k++) {
      const j = Math.min(l.length - 1, Math.max(0, i + k));
      sx += l[j].x * pesi[k + raggio]; sy += l[j].y * pesi[k + raggio]; sw += pesi[k + raggio];
    }
    return { x: sx / sw, y: sy / sw };
  });
}
function lungoLaLinea(l: Point[]): (u: number) => Point {
  const cum: number[] = [0];
  for (let i = 1; i < l.length; i++) cum.push(cum[i - 1] + Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y));
  const tot = cum[cum.length - 1] || 1;
  return (u: number): Point => {
    const d = Math.min(tot, Math.max(0, u * tot));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    return { x: l[i - 1].x + (l[i].x - l[i - 1].x) * t, y: l[i - 1].y + (l[i].y - l[i - 1].y) * t };
  };
}
const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

// --- 4. famiglia per famiglia: l'unione, i due muri, le vie di mezzo colorate ------------------------
const perColore: string[][] = colori.map(() => []);
const sotto: string[][] = colori.map(() => []);      // la sovrapposizione, per colore chiaro
const muriA: string[] = [], muriB: string[] = [], frecce: string[] = [];
let famOk = 0, famSaltate = 0;

famiglie.forEach((f, fi) => {
  // l'unione della famiglia, tracciata dalla griglia
  const maschera = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < maschera.length; i++) if (famDi[i] === fi) maschera[i] = 1;
  const unioni = traceRegions(maschera, COLS, ROWS, 1, CELLA, { minAreaMm2: 10, simplifyMm: 0.3 });
  if (!unioni.length) { famSaltate++; return; }
  const u = unioni.sort((a, b) => b.areaMm2 - a.areaMm2)[0];
  const dentroFam = (p: Point): boolean => { const i = cella(p); return i >= 0 && famDi[i] === fi; };

  // il contorno dell'unione, e per ogni punto: di che colore è la forma appena dentro?
  const anello = ricampiona([...u.outer, u.outer[0]], 0.5);
  const n = anello.length;
  if (n < 12) { famSaltate++; return; }
  const dentroCol = new Int8Array(n);
  const normali: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = anello[(i + n - 1) % n], c = anello[(i + 1) % n];
    let nx = c.y - a.y, ny = -(c.x - a.x);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const p = anello[i];
    if (dentroFam({ x: p.x + nx * 1, y: p.y + ny * 1 })) { nx = -nx; ny = -ny; }   // normale verso fuori
    normali.push({ x: nx, y: ny });
    dentroCol[i] = tintaIn({ x: p.x - nx * 1.5, y: p.y - ny * 1.5 });
  }
  const chiaro = Math.min(...Array.from(dentroCol).filter((v) => v >= 0));
  // il muro A: il tratto circolare più lungo dove appena dentro c'è il colore più chiaro della famiglia
  const cerca = (pred: (i: number) => boolean): [number, number] | null => {
    let start = -1;
    for (let k = 0; k < n; k++) if (!pred(k)) { start = k; break; }
    if (start < 0) return null;
    let best: [number, number] | null = null, bestLen = 0;
    for (let k = 0; k < n; k++) {
      const idx = (start + k) % n;
      if (!pred(idx)) continue;
      let len = 0;
      while (len < n && pred((idx + len) % n)) len++;
      if (len > bestLen) { bestLen = len; best = [idx, len]; }
      k += len - 1;
    }
    return best;
  };
  const unaSolaTinta = new Set(Array.from(dentroCol).filter((v) => v >= 0)).size <= 1;
  let tratto = unaSolaTinta ? null : cerca((i) => dentroCol[i] === chiaro);
  if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) {
    // isola (o muro che è tutto il giro): due metà col riferimento — A è il lato che guarda in alto
    const rx = Math.cos((RIFERIMENTO_DEG * Math.PI) / 180), ry = Math.sin((RIFERIMENTO_DEG * Math.PI) / 180);
    tratto = cerca((i) => normali[i].x * rx + normali[i].y * ry >= 0);
    if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) { famSaltate++; return; }
  }
  const [a0, la] = tratto;
  const A: Point[] = [], B: Point[] = [];
  for (let k = 0; k < la; k++) A.push(anello[(a0 + k) % n]);
  for (let k = 0; k < n - la; k++) B.push(anello[(a0 + la + k) % n]);
  B.reverse();
  const As = liscia(A, LISCIA_MM, 0.5), Bs = liscia(B, LISCIA_MM, 0.5);
  const fA = lungoLaLinea(As), fB = lungoLaLinea(Bs);
  muriA.push(via(As)); muriB.push(via(Bs));
  famOk++;

  // LA DISTANZA FRA LE LINEE E' FISSA, il numero no (Lorenzo: «se non ci sta, la linea si interrompe
  // e arriva al bordo come arriva»). La fusione pura conservava il numero di linee lungo tutta la
  // famiglia: dove si stringe le schiacciava, dove si allarga le apriva, e ai capi le ammucchiava.
  // Qui la linea k sta a (k + 1/2) passi dal muro A, misurati lungo la direzione della fusione, e
  // vive solo finche' sta dentro la famiglia: dove c'e' posto nasce, dove non ce n'e' finisce.
  let largMax = 0;
  for (let k = 0; k <= 48; k++) { const pa = fA(k / 48), pb = fB(k / 48); largMax = Math.max(largMax, Math.hypot(pb.x - pa.x, pb.y - pa.y)); }
  const quante = Math.max(1, Math.ceil(largMax / BASI_MM));
  const passiU = Math.max(16, Math.round((As.length + Bs.length) / 2));

  for (let q = 0; q < quante; q++) {
    const distanza = (q + 0.5) * BASI_MM;
    // prima la linea intera, poi la si addolcisce in proporzione alla distanza dal muro, e SOLO DOPO
    // si colora e si spezza: cosi' gli spigoli del muro si perdono man mano invece di propagarsi
    const grezza: Point[] = [];
    for (let k = 0; k <= passiU; k++) {
      const uu = k / passiU;
      const pa = fA(uu), pb = fB(uu);
      const w = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      grezza.push({ x: pa.x + ((pb.x - pa.x) / w) * distanza, y: pa.y + ((pb.y - pa.y) / w) * distanza });
    }
    const passoU = (() => { let t = 0; for (let k = 1; k < grezza.length; k++) t += Math.hypot(grezza[k].x - grezza[k - 1].x, grezza[k].y - grezza[k - 1].y); return Math.max(0.1, t / Math.max(1, grezza.length - 1)); })();
    const morbida = liscia(grezza, Math.min(15, ADDOLCISCI * distanza), passoU);
    // la via di mezzo, spezzata dove esce dalla famiglia, e COLORATA dalla forma che ha sotto
    let cur: Point[] = [], curCol = -2;
    const chiudi = (): void => {
      if (cur.length >= 2 && curCol >= 0) perColore[curCol].push(via(cur));
      cur = []; curCol = -2;
    };
    for (let k = 0; k <= passiU; k++) {
      const uu = k / passiU;
      const pa = fA(uu), pb = fB(uu);
      const w = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      const p = morbida[k];
      // oltre il muro opposto la linea non esiste: si ferma dove finisce il posto
      const col = distanza < w - BASI_MM * 0.25 && dentroFam(p) ? tintaIn(p) : -1;
      if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
      if (col >= 0) cur.push(p);
      // la SOVRAPPOSIZIONE: se verso A (il chiaro), entro `sormonto`, c'è una forma più chiara di
      // quella qui sotto, questo punto si cuce anche con quel colore chiaro — prima, e sotto
      if (col >= 0) {
        const dx = pa.x - pb.x, dy = pa.y - pb.y, l = Math.hypot(dx, dy) || 1;
        const qq = { x: p.x + (dx / l) * SORM_MM, y: p.y + (dy / l) * SORM_MM };
        const colLa = dentroFam(qq) ? tintaIn(qq) : -1;
        if (colLa >= 0 && colLa < col) sotto[colLa].push(via([p, { x: p.x + (dx / l) * 0.6, y: p.y + (dy / l) * 0.6 }]));
      }
      // le frecce del verso: ogni tanto, verso A
      if (k % 30 === 15 && q % 2 === 0 && col >= 0) {
        const dx = pa.x - pb.x, dy = pa.y - pb.y, l = Math.hypot(dx, dy) || 1;
        const tip = { x: p.x + (dx / l) * 3, y: p.y + (dy / l) * 3 };
        const px = -dy / l, py = dx / l;
        frecce.push(via([p, tip]) + via([{ x: tip.x - (dx / l) * 1 + px * 0.8, y: tip.y - (dy / l) * 1 + py * 0.8 }, tip, { x: tip.x - (dx / l) * 1 - px * 0.8, y: tip.y - (dy / l) * 1 - py * 0.8 }]));
      }
    }
    chiudi();
  }

  // L'ULTIMA LINEA, lungo il muro opposto. Le linee seguono il rosso e finiscono un passo prima del
  // blu, o contro i lati: li' resta un vuoto che i denti non coprono, perche' puntano dall'altra
  // parte (Lorenzo: «si sono creati dei buchi»). Una linea a mezzo passo dentro il blu, che esiste
  // solo dove il vuoto fra l'ultima linea e il muro supera i tre quarti del passo: dove le linee
  // arrivano gia' vicine, non c'e'.
  {
    const nB = ricampiona([...Bs], 0.5);
    const grezza: Point[] = [];
    const vuoto: boolean[] = [];
    for (let i = 0; i < nB.length; i++) {
      const a = nB[Math.max(0, i - 1)], c = nB[Math.min(nB.length - 1, i + 1)];
      let nx = c.y - a.y, ny = -(c.x - a.x);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const b = nB[i];
      if (!dentroFam({ x: b.x + nx * 1, y: b.y + ny * 1 })) { nx = -nx; ny = -ny; }   // normale verso dentro
      const p = { x: b.x + nx * (BASI_MM / 2), y: b.y + ny * (BASI_MM / 2) };
      grezza.push(p);
      // quanto e' lontana l'ultima linea da A? si misura la larghezza locale w e il resto oltre l'ultima
      // linea intera: w mod passo. Se il resto supera 3/4 del passo, qui c'e' un vuoto da riempire.
      let u = 0, best = 1e9;
      for (let k = 0; k <= 60; k++) { const q = fB(k / 60); const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < best) { best = d; u = k / 60; } }
      const pa = fA(u), pb = fB(u);
      const w = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const resto = w - (Math.floor(w / BASI_MM - 0.25) + 0.5) * BASI_MM;   // distanza dall'ultima linea al muro B
      vuoto.push(resto > BASI_MM * 0.75 && dentroFam(p));
    }
    const morbida = liscia(grezza, LISCIA_MM, 0.5);
    let cur: Point[] = [], curCol = -2;
    const chiudi = (): void => { if (cur.length >= 2 && curCol >= 0) perColore[curCol].push(via(cur)); cur = []; curCol = -2; };
    for (let i = 0; i < morbida.length; i++) {
      const p = morbida[i];
      const col = vuoto[i] && dentroFam(p) ? tintaIn(p) : -1;
      if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
      if (col >= 0) cur.push(p);
    }
    chiudi();
  }
});

// --- 5. l'immagine per capirsi -------------------------------------------------------------------------
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (perColore[t].length) pezzi.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.3"/>`);
});
// la sovrapposizione in arancio (tratti corti dal punto verso il chiaro), poi i muri, poi le frecce
const sottoTutti = sotto.flat();
if (sottoTutti.length) pezzi.push(`<path d="${sottoTutti.join('')}" fill="none" stroke="#f08a1a" stroke-width="0.35"/>`);
pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.8"/>`);
pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.5"/>`);
pezzi.push(`<path d="${frecce.join('')}" fill="none" stroke="#111" stroke-width="0.35"/>`);
const legenda = colori.map((c, i) => `<rect x="${(8 + i * 22).toFixed(1)}" y="2" width="6" height="6" fill="${c}" stroke="#333" stroke-width="0.2"/><text x="${(15 + i * 22).toFixed(1)}" y="7" font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#222">${i + 1}${i === 0 ? ' (grigio)' : ''}</text>`).join('');
const nota = `<text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="3.6" fill="#222">ordine di cucitura 1→6 dal chiaro allo scuro · ROSSO muro di partenza (chiaro) · BLU muro opposto · FRECCE verso del pettine · ARANCIO la sovrapposizione del chiaro sotto lo scuro</text>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/verifica-famiglie.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 ${WM.toFixed(1)} ${(HM + 18).toFixed(1)}" width="${WM.toFixed(1)}mm" height="${(HM + 18).toFixed(1)}mm">
<rect x="0" y="-18" width="${WM.toFixed(1)}" height="${(HM + 18).toFixed(1)}" fill="#faf9f7"/>
<g transform="translate(0,-18)">${legenda}${nota}</g>
${pezzi.join('\n')}
</svg>`, 'utf8');
console.log(`${famOk} famiglie disegnate, ${famSaltate} saltate · basi ogni ${BASI_MM} mm · sormonto ${SORM_MM} mm`);
console.log('-> apps/pettine/scripts/out/verifica-famiglie.svg');

// I PROVINI DA CUCIRE: nove riquadri a densità diverse, in un DST solo.
//
// Lorenzo: «densità bisogna provare in macchina e vedere che succede con vari parametri». Quindi non
// un'altra immagine da guardare a schermo, ma un file da mandare in macchina — e accanto la sua
// legenda su carta, perché in macchina i numeri non si leggono.
//
// Ogni riquadro è 40 × 30 mm, con la curvatura interna (archi concentrici) come nella tavola dei
// rettangoli. Cambia una manopola per volta: quanto sono distanti le linee di base, il passo fra i
// denti, la lunghezza dei denti.
//
// COME SI RICONOSCONO IN MACCHINA. Sotto ogni riquadro ci sono delle **barrette**: una per il primo
// provino, due per il secondo, e così via. Sul tessuto si contano, e si torna alla legenda.
//
// COME È CUCITO. Le linee di base si percorrono a serpentina — una verso destra, la successiva verso
// sinistra — così la fine di una è vicina all'inizio dell'altra e il collegamento è corto: un
// riquadro è **un blocco solo**, senza salti in mezzo e senza rasafili. È anche il modo in cui dovrà
// cucire il tool vero.
//
//   npx esbuild apps/pettine_v2/scripts/provini-dst.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine_v2/scripts/provini-dst.mjs
//   node apps/pettine_v2/scripts/provini-dst.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { buildDst, type Point, type Polyline } from '@rg/core';

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Ricetta {
  nome: string;
  basiMm: number;      // distanza fra una linea di base e la vicina
  passoMm: number;     // fra un dente e il successivo (mai sotto 1)
  denteMin: number;
  denteMax: number;
  inclDeg: number;
}

/** Le nove ricette: si muove una cosa per volta, partendo da una di mezzo. */
const RICETTE: Ricetta[] = [
  { nome: '1 · base',            basiMm: 2.0, passoMm: 1.5, denteMin: 4, denteMax: 10, inclDeg: 40 },
  { nome: '2 · basi fitte',      basiMm: 1.2, passoMm: 1.5, denteMin: 4, denteMax: 10, inclDeg: 40 },
  { nome: '3 · basi larghe',     basiMm: 3.5, passoMm: 1.5, denteMin: 4, denteMax: 10, inclDeg: 40 },
  { nome: '4 · denti fitti',     basiMm: 2.0, passoMm: 1.0, denteMin: 4, denteMax: 10, inclDeg: 40 },
  { nome: '5 · denti radi',      basiMm: 2.0, passoMm: 2.5, denteMin: 4, denteMax: 10, inclDeg: 40 },
  { nome: '6 · denti corti',     basiMm: 2.0, passoMm: 1.5, denteMin: 2.5, denteMax: 5, inclDeg: 40 },
  { nome: '7 · denti lunghi',    basiMm: 2.0, passoMm: 1.5, denteMin: 8, denteMax: 18, inclDeg: 40 },
  { nome: '8 · poco aperti',     basiMm: 2.0, passoMm: 1.5, denteMin: 4, denteMax: 10, inclDeg: 15 },
  { nome: '9 · molto aperti',    basiMm: 2.0, passoMm: 1.5, denteMin: 4, denteMax: 10, inclDeg: 65 },
];

const W = 40, H = 30;                 // ogni provino, in mm
const GX = 52, GY = 46;               // passo della griglia
const CURVATURA = 0.8;

/** Le linee di base: archi concentrici col centro sotto il riquadro, tagliati ai suoi lati. */
function basi(distanzaMm: number): Polyline[] {
  const cy = H + W / (2 * CURVATURA), cx = W / 2;
  const out: Polyline[] = [];
  for (let y = distanzaMm / 2; y < H; y += distanzaMm) {
    const r = cy - y;
    const semi = Math.min(Math.PI / 2, Math.asin(Math.min(1, (W * 0.75) / r)) * 2);
    const linea: Point[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = -semi + (2 * semi * i) / 80;
      const p = { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) linea.push(p);
    }
    if (linea.length >= 2) out.push(linea);
  }
  return out;
}

/** Il pettine su una base: dente fuori, punta, ritorno nello stesso buco. */
function pettine(base: Polyline, r: Ricetta, seme: number, verso: number): Point[] {
  let tot = 0;
  const cum: number[] = [0];
  for (let i = 1; i < base.length; i++) {
    tot += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y);
    cum.push(tot);
  }
  const out: Point[] = [];
  let k = 0;
  for (let d = 0; d <= tot; d += r.passoMm, k++) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const a = base[i - 1], b = base[i];
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const r1 = caso(seme, k * 2), r2 = caso(seme, k * 2 + 1);
    const lung = r.denteMin + (r.denteMax - r.denteMin) * r1;
    const ang = ((r2 * 2 - 1) * r.inclDeg * Math.PI) / 180;
    // il pelo di un provino punta sempre in su: qui non c'è un'area chiara accanto da seguire
    const nx = (-dy / l) * verso, ny = (dx / l) * verso;
    const ux = nx * Math.cos(ang) - ny * Math.sin(ang);
    const uy = nx * Math.sin(ang) + ny * Math.cos(ang);
    out.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
  }
  return out;
}

/**
 * Un provino intero, come UNA polilinea continua: le basi si percorrono a serpentina, quindi fra la
 * fine di una e l'inizio della successiva c'è solo la distanza fra le basi — nessun salto, nessun
 * rasafilo in mezzo al provino.
 */
function provino(r: Ricetta, x0: number, y0: number, indice: number): Point[] {
  const punti: Point[] = [];
  basi(r.basiMm).forEach((base, i) => {
    const b = i % 2 === 0 ? base : [...base].reverse();
    for (const p of pettine(b, r, 100 + indice * 31 + i, -1)) punti.push({ x: p.x + x0, y: p.y + y0 });
  });
  // le barrette che dicono quale provino è: si contano sul tessuto
  for (let n = 0; n <= indice; n++) {
    const bx = x0 + 1 + n * 2;
    punti.push({ x: bx, y: y0 + H + 3 }, { x: bx, y: y0 + H + 6 }, { x: bx, y: y0 + H + 3 });
  }
  return punti;
}

// ---------------------------------------------------------------------------------------------

const blocchi: Point[][] = [];
const pezzi: string[] = [];
const testo = (x: number, y: number, s: string, size = 3, peso = 700): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="${peso}" fill="#1d1d1b">${s}</text>`;

RICETTE.forEach((r, i) => {
  const x0 = 8 + (i % 3) * GX, y0 = 24 + Math.floor(i / 3) * GY;
  const punti = provino(r, x0, y0, i);
  blocchi.push(punti);
  pezzi.push(`<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="none" stroke="#d5d8dc" stroke-width="0.2"/>`);
  pezzi.push(testo(x0, y0 - 4.5, r.nome, 3.2));
  pezzi.push(testo(x0, y0 - 1.4, `basi ${r.basiMm} · passo ${r.passoMm} · dente ${r.denteMin}-${r.denteMax} · ±${r.inclDeg}°`, 2.3, 400));
  pezzi.push(`<path d="${punti.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}" fill="none" stroke="#1b3257" stroke-width="0.1"/>`);
});

const TW = 8 * 2 + GX * 2 + W, TH = 24 + GY * 3;
let punti = 0, filo = 0;
for (const b of blocchi) {
  punti += b.length;
  for (let i = 1; i < b.length; i++) filo += Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TW} ${TH}" width="${TW}mm" height="${TH}mm">
<rect width="${TW}" height="${TH}" fill="#faf9f7"/>
${testo(8, 9, 'PROVINI DEL PUNTO PETTINE — da cucire', 4.5)}
${testo(8, 12.8, `${TW} × ${TH} mm · un filo solo · le barrette sotto ogni riquadro dicono quale provino è (una, due, tre…)`, 2.5, 400)}
${pezzi.join('\n')}
</svg>`;

mkdirSync('apps/pettine_v2/scripts/out', { recursive: true });
writeFileSync('apps/pettine_v2/scripts/out/provini.svg', svg, 'utf8');

// il DST: un ago solo, un blocco per provino (fra un provino e l'altro la macchia salta e taglia)
const dst = buildDst({
  label: 'PETTINE',
  coordinate_system: 'svg',
  paths: blocchi.map((b) => ({ needle: 1, points_mm: b.map((p) => [p.x - TW / 2, p.y - TH / 2] as [number, number]) })),
});
writeFileSync('apps/pettine_v2/scripts/out/provini.dst', dst);

console.log(`-> apps/pettine_v2/scripts/out/provini.svg  (${TW} × ${TH} mm)`);
console.log(`-> apps/pettine_v2/scripts/out/provini.dst  (${(dst.length / 1024).toFixed(0)} kB)`);
console.log(`${RICETTE.length} provini · ${punti} punti · ${(filo / 1000).toFixed(1)} m di filo`);

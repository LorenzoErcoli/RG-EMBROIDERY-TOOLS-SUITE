// IL CASO MINIMO: un rettangolo, e dentro il pettine che curva.
//
// Lorenzo, guardando il pettine sulle aree vere: «la verita' e' che per quello che vedo niente e' ok».
// Quindi si torna indietro fino al caso piu' semplice possibile — un rettangolo, una curvatura sola,
// il pettine sopra — e si guarda quello. Se non funziona qui, non puo' funzionare su un disegno.
//
// LA CURVATURA INTERNA. Il contorno e' dritto, ma le linee di base dentro sono curve: sono archi di
// cerchio con il centro fuori dal rettangolo, cioe' una curvatura OMOGENEA — ogni linea gira quanto
// la vicina, nessuna sta storta. E' il modo piu' pulito di far vedere la cosa senza tirare in mezzo
// la forma di una macchia vera.
//
// Tutto in millimetri veri. Il passo fra i denti non scende mai sotto 1 mm (limite di Lorenzo).
//
//   npx esbuild apps/pettine_v2/scripts/rettangolo.ts --bundle --format=esm --platform=node \
//     --outfile=apps/pettine_v2/scripts/rettangolo.mjs
//   node apps/pettine_v2/scripts/rettangolo.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

interface P { x: number; y: number }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Le linee di base dentro il rettangolo: archi concentrici col centro sotto, tagliati al rettangolo.
 * `curvatura` 0 = linee dritte; più alta = più curve. È l'unica cosa che cambia fra un riquadro e
 * l'altro quando si guarda la curvatura, e resta uguale quando si guardano i denti.
 */
function basiCurve(w: number, h: number, distanzaMm: number, curvatura: number): P[][] {
  const out: P[][] = [];
  if (curvatura <= 0) {
    for (let y = distanzaMm / 2; y < h; y += distanzaMm) {
      out.push([{ x: -2, y }, { x: w + 2, y }]);
    }
    return out;
  }
  // il centro sta sotto il rettangolo: più è vicino, più le linee sono curve
  const cy = h + w / (2 * curvatura);
  const cx = w / 2;
  for (let y = distanzaMm / 2 - distanzaMm; y < h + distanzaMm; y += distanzaMm) {
    const r = cy - y;
    // l'arco si genera PIU' LARGO del rettangolo e poi lo taglia il clip: fermandolo alla larghezza,
    // salendo la corda si accorcia e gli angoli in alto restano scoperti (difetto visto al primo giro).
    const semiAngolo = Math.min(Math.PI / 2, Math.asin(Math.min(1, (w * 0.75) / r)) * 2);
    const passi = 60;
    const linea: P[] = [];
    for (let i = 0; i <= passi; i++) {
      const a = -semiAngolo + (2 * semiAngolo * i) / passi;
      linea.push({ x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r });
    }
    if (linea.some((p) => p.y >= 0 && p.y <= h)) out.push(linea.filter((p) => p.y >= -2 && p.y <= h + 2));
  }
  return out;
}

interface PettineOpts {
  passoMm: number;      // fra un dente e il successivo, MAI sotto 1
  denteMinMm: number;
  denteMaxMm: number;
  inclDeg: number;      // di quanto il dente si scosta dalla perpendicolare alla base
  verso: number;        // da che parte della base escono i denti
  seme: number;
}

/** Il pettine su una base: dente fuori, punta, e ritorno nello stesso buco. */
function pettine(base: P[], o: PettineOpts): P[] {
  let tot = 0;
  const cum: number[] = [0];
  for (let i = 1; i < base.length; i++) {
    tot += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y);
    cum.push(tot);
  }
  const out: P[] = [];
  let k = 0;
  for (let d = 0; d <= tot; d += o.passoMm, k++) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const a = base[i - 1], b = base[i];
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const r1 = caso(o.seme, k * 2), r2 = caso(o.seme, k * 2 + 1);
    const lung = o.denteMinMm + (o.denteMaxMm - o.denteMinMm) * r1;
    const ang = ((r2 * 2 - 1) * o.inclDeg * Math.PI) / 180;
    const nx = (-dy / l) * o.verso, ny = (dx / l) * o.verso;
    const ux = nx * Math.cos(ang) - ny * Math.sin(ang);
    const uy = nx * Math.sin(ang) + ny * Math.cos(ang);
    out.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

const BLU = '#1b3257';
const pezzi: string[] = [];
const via = (pt: P[], colore: string, w = 0.12): string =>
  `<path d="${pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')}" fill="none" stroke="${colore}" stroke-width="${w}"/>`;
const testo = (x: number, y: number, s: string, size = 3.4, peso = 700): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="${peso}" fill="#1d1d1b">${s}</text>`;

/** Un riquadro: il rettangolo, le sue basi curve, il pettine sopra, e l'etichetta coi numeri. */
function riquadro(
  x0: number, y0: number, w: number, h: number,
  opts: { distanza: number; curvatura: number; passo: number; dMin: number; dMax: number; incl: number; titolo: string; mostraBasi?: boolean },
): void {
  pezzi.push(testo(x0, y0 - 5.5, opts.titolo, 3.6));
  pezzi.push(testo(x0, y0 - 1.6, `basi ogni ${opts.distanza} mm · dente ${opts.dMin}-${opts.dMax} · passo ${opts.passo} · ±${opts.incl}°`, 2.6, 400));
  pezzi.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="#c8ccd2" stroke-width="0.2"/>`);
  pezzi.push(`<clipPath id="c${x0}_${y0}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/></clipPath>`);
  const dentro: string[] = [];
  basiCurve(w, h, opts.distanza, opts.curvatura).forEach((base, i) => {
    const b = base.map((p) => ({ x: p.x + x0, y: p.y + y0 }));
    if (opts.mostraBasi) dentro.push(via(b, '#b9bec4', 0.25));
    dentro.push(via(pettine(b, {
      passoMm: Math.max(1, opts.passo), denteMinMm: opts.dMin, denteMaxMm: opts.dMax,
      inclDeg: opts.incl, verso: -1, seme: 1 + i * 7 + Math.round(x0 + y0),
    }), BLU));
  });
  pezzi.push(`<g clip-path="url(#c${x0}_${y0})">${dentro.join('')}</g>`);
}

const W = 60, H = 42;           // ogni riquadro, in mm veri
const GX = 68, GY = 56;
const X0 = 10, Y0 = 26;

pezzi.push(testo(8, 10, 'IL PETTINE IN UN RETTANGOLO, con la curvatura interna', 5));
pezzi.push(testo(8, 15, 'ogni riquadro e’ 60 × 42 mm veri. Stessa curvatura ovunque: cambiano solo i denti e la loro fittezza.', 2.8, 400));

// riga 1 — quanto sono distanti le linee di base (la fittezza del ricamo)
riquadro(X0, Y0, W, H, { distanza: 10, curvatura: 0.8, passo: 2, dMin: 6, dMax: 12, incl: 40, titolo: 'A · basi larghe', mostraBasi: true });
riquadro(X0 + GX, Y0, W, H, { distanza: 6, curvatura: 0.8, passo: 2, dMin: 6, dMax: 12, incl: 40, titolo: 'B · basi medie' });
riquadro(X0 + GX * 2, Y0, W, H, { distanza: 3, curvatura: 0.8, passo: 2, dMin: 6, dMax: 12, incl: 40, titolo: 'C · basi fitte' });

// riga 2 — quanto sono lunghi i denti
riquadro(X0, Y0 + GY, W, H, { distanza: 6, curvatura: 0.8, passo: 2, dMin: 3, dMax: 5, incl: 40, titolo: 'D · denti corti' });
riquadro(X0 + GX, Y0 + GY, W, H, { distanza: 6, curvatura: 0.8, passo: 2, dMin: 8, dMax: 18, incl: 40, titolo: 'E · denti lunghi' });
riquadro(X0 + GX * 2, Y0 + GY, W, H, { distanza: 6, curvatura: 0.8, passo: 1.2, dMin: 6, dMax: 12, incl: 40, titolo: 'F · denti ravvicinati' });

// riga 3 — quanto si aprono, e la curvatura
riquadro(X0, Y0 + GY * 2, W, H, { distanza: 6, curvatura: 0.8, passo: 2, dMin: 6, dMax: 12, incl: 12, titolo: 'G · quasi dritti (±12°)' });
riquadro(X0 + GX, Y0 + GY * 2, W, H, { distanza: 6, curvatura: 0.8, passo: 2, dMin: 6, dMax: 12, incl: 65, titolo: 'H · molto aperti (±65°)' });
riquadro(X0 + GX * 2, Y0 + GY * 2, W, H, { distanza: 6, curvatura: 0, passo: 2, dMin: 6, dMax: 12, incl: 40, titolo: 'I · senza curvatura', mostraBasi: true });

const TW = X0 * 2 + GX * 2 + W, TH = Y0 + GY * 3;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TW} ${TH}" width="${TW}mm" height="${TH}mm">
<rect width="${TW}" height="${TH}" fill="#faf9f7"/>
${pezzi.join('\n')}
</svg>`;
mkdirSync('apps/pettine_v2/scripts/out', { recursive: true });
writeFileSync('apps/pettine_v2/scripts/out/rettangolo.svg', svg, 'utf8');
console.log(`-> apps/pettine_v2/scripts/out/rettangolo.svg  (${TW} x ${TH} mm)`);

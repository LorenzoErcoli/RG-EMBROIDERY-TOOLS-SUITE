// I BLOCCHI LI DIVIDE LORENZO: il pettine sul vettoriale a sei gruppi.
//
// «Puoi provare a usare questo svg dove ho diviso i blocchi colore». È la risposta alla domanda che
// girava da giorni — come identificare i blocchi da sfumare con un'unica direzione — e la risposta è
// che li identifica lui, in Illustrator, come un ricamatore. Il sistema smette di indovinarli dai
// pixel: ogni forma del file è un blocco, e il GRUPPO in cui sta è la sua tinta. Non la classe di
// colore, che dentro i gruppi è mista (in CELESTE_SCURO dieci forme hanno il fill di
// BLU_SUPER_NOTTE e quattro non hanno fill): il gruppo è la verità.
//
// Su ogni blocco, la costruzione che ha approvato sulle fasce: il MURO DI PARTENZA è il tratto di
// contorno verso il gruppo più chiaro, il MURO OPPOSTO è il resto del contorno, e le linee di base
// sono le vie di mezzo fra i due — la fusione. I muri vengono dal vettoriale, quindi sono già curve:
// la lisciatura resta leggera (1 mm), solo per le giunte fra i tratti di Bézier.
//
// Il SORMONTO fra i colori, senza tornare ai pixel: il blocco chiaro, cucito prima, continua le sue
// basi OLTRE il muro opposto — di `sormSfumato` mm dove la foto dice che il bordo sfuma, di
// `sormNetto` dove stacca — e finiscono sotto il blocco scuro che viene dopo.
//
//   npx esbuild apps/pettine/scripts/gruppi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/gruppi.mjs
//   SOLO_BASI=1 node --max-old-space-size=6144 apps/pettine/scripts/gruppi.mjs <blocchi.svg> <foto.bmp> [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato] [verso] [lisciaMm]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, pointInPolygon, polygonArea } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '../../pittorico/src/region.ts';
import { rasterizza } from '../../pittorico/src/iso-fill.ts';
import { larghezzaTransizione } from '../../pittorico/src/borders.ts';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const fileSvg = process.argv[2], foto = process.argv[3];
const BASI_MM = num(4, 2);
const PASSO_MM = Math.max(1, num(5, 1.5));
const DENTE_MIN = num(6, 2), DENTE_MAX = num(7, 5);
const INCL = num(8, 40);
const NETTO_MM = num(9, 2.5);
const SORM_NETTO = num(10, 0.8);
const SORM_SFUMATO = num(11, 4);
const VERSO = num(12, 1) >= 0 ? 1 : -1;      // +1 = denti dallo scuro verso il chiaro
const LISCIA_MM = num(13, 1);
const SOLO_BASI = !!process.env.SOLO_BASI;
if (!fileSvg || !foto) { console.error('uso: node gruppi.mjs <blocchi.svg> <foto.bmp> ...'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const luminosita = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// --- 1. il vettoriale: un gruppo = una tinta, una forma = un blocco ---------------------------------
const testo = readFileSync(fileSvg, 'utf8');
const viewBox = /viewBox="([^"]+)"/.exec(testo)![1];
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
interface Gruppo { nome: string; colore: string; forme: Polyline[] }
const gruppi: Gruppo[] = [];
for (const m of testo.matchAll(/<g id="([^"]+)"([\s\S]*?)<\/g>/g)) {
  const nome = m[1], corpo = m[2];
  // il colore del gruppo: la classe più frequente fra le sue forme (esclusi i fill "none")
  const conta = new Map<string, number>();
  for (const c of corpo.matchAll(/class="(st\d+)"/g)) {
    const col = stili.get(c[1]);
    if (col && col !== 'none') conta.set(col, (conta.get(col) ?? 0) + 1);
  }
  const colore = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#808080';
  // ogni forma si legge da sola, forzando un fill così l'importer non la scarta se è "none"
  const forme: Polyline[] = [];
  for (const el of corpo.matchAll(/<(path|polygon)\b[^>]*>/g)) {
    const tag = el[0].replace(/class="st\d+"/, 'fill="#000"');
    const mini = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${tag}</svg>`;
    const letto = parseSvgPolylines(mini, {});
    const K = LARGHEZZA_REALE_MM / letto.widthMm;
    let prese = 0;
    for (const p of letto.polylines) {
      const pl = p.map((q) => ({ x: q.x * K, y: q.y * K }));
      if (pl.length >= 3 && Math.abs(polygonArea(pl)) > 5) { forme.push(pl); prese++; }
    }
    if (process.env.DIAG) console.log(`  ${nome}: forma con ${letto.polylines.length} polilinee lette, ${prese} tenute (d lungo ${(/d="([^"]*)"/.exec(tag)?.[1].length ?? 0)})`);
  }
  gruppi.push({ nome, colore, forme });
}
gruppi.sort((a, b) => luminosita(b.colore) - luminosita(a.colore));
const [vbW, vbH] = viewBox.split(/\s+/).slice(2).map(Number);
const Kmm = LARGHEZZA_REALE_MM / vbW;
const WM = vbW * Kmm, HM = vbH * Kmm;
console.log(`\n${fileSvg}\n${WM.toFixed(1)} × ${HM.toFixed(1)} mm · gruppi dal chiaro allo scuro:`);
gruppi.forEach((g, i) => console.log(`  ${i} ${g.nome.padEnd(16)} ${g.colore} (luce ${luminosita(g.colore).toFixed(2)}) · ${g.forme.length} forme`));

// --- 2. la griglia delle tinte (per sapere cosa c'è di là da un muro) e la foto (netto/sfumato) -----
const COLS = Math.ceil(WM / CELLA) + 2, ROWS = Math.ceil(HM / CELLA) + 2;
const tinta = new Int8Array(COLS * ROWS).fill(-1);
function regioniDi(forme: Polyline[]): Array<{ outer: Polyline; holes: Polyline[] }> {
  const ord = forme.map((p) => ({ p, a: Math.abs(polygonArea(p)) })).sort((a, b) => b.a - a.a);
  const usate = new Set<number>();
  const out: Array<{ outer: Polyline; holes: Polyline[] }> = [];
  ord.forEach((a, i) => {
    if (usate.has(i)) return;
    const holes: Polyline[] = [];
    ord.forEach((b, j) => {
      if (j <= i || usate.has(j)) return;
      if (pointInPolygon(b.p[0], a.p)) { holes.push(b.p); usate.add(j); }
    });
    out.push({ outer: a.p, holes });
  });
  return out;
}
const blocchi: Array<{ tinta: number; outer: Polyline; holes: Polyline[] }> = [];
gruppi.forEach((g, t) => {
  for (const r of regioniDi(g.forme)) {
    blocchi.push({ tinta: t, ...r });
    const dentro = rasterizza(makeRegion(r.outer, r.holes), 0, 0, COLS, ROWS, CELLA);
    // chi viene dopo (più scuro) vince la cella: è l'ordine di cucitura
    for (let i = 0; i < dentro.length; i++) if (dentro[i]) tinta[i] = t;
  }
});
const tintaIn = (p: Point): number => {
  const c = Math.round(p.x / CELLA), r = Math.round(p.y / CELLA);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : tinta[r * COLS + c];
};

const img = leggiBmp(foto);
const mmPerPx = LARGHEZZA_REALE_MM / img.width;
/** Il bordo in `p`, attraversato lungo `n`, sulla foto: sfuma (true) o stacca (false)? */
const sfumaQui = (p: Point, n: Point): boolean => {
  const tr = larghezzaTransizione(img, mmPerPx, p, n, { raggioMm: 6 });
  return tr !== null && tr.larghezzaMm >= NETTO_MM;
};

// --- 3. geometria ---------------------------------------------------------------------------------
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

// --- 4. blocco per blocco: i due muri, la fusione, il pettine ---------------------------------------
const perTinta: string[][] = gruppi.map(() => []);
const muriA: string[] = [], muriB: string[] = [];
const CW = Math.ceil(WM) + 1, CH = Math.ceil(HM) + 1;
const coperto = new Uint8Array(CW * CH);
let denti = 0, filoMm = 0, basiTot = 0, fermati = 0, attraversano = 0, saltati = 0;
const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

blocchi.forEach((b, ib) => {
  const t = b.tinta;
  const regione = makeRegion(b.outer, b.holes);
  const dentroBlocco = (p: Point): boolean => pointInPolygon(p, b.outer) && !b.holes.some((h) => pointInPolygon(p, h));
  // il contorno a passo costante, e per ogni punto cosa c'è di là
  const anello = ricampiona([...b.outer, b.outer[0]], 0.5);
  const n = anello.length;
  if (n < 12) { saltati++; return; }
  const classe = new Int8Array(n);
  const normali: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = anello[(i + n - 1) % n], c = anello[(i + 1) % n];
    let nx = c.y - a.y, ny = -(c.x - a.x);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const p = anello[i];
    if (dentroBlocco({ x: p.x + nx * 1, y: p.y + ny * 1 })) { nx = -nx; ny = -ny; }
    normali.push({ x: nx, y: ny });
    const fuori = tintaIn({ x: p.x + nx * 2, y: p.y + ny * 2 });
    classe[i] = fuori < 0 || fuori === t ? 0 : fuori < t ? 1 : -1;
  }
  // il muro A: il tratto circolare più lungo verso il chiaro (o verso lo scuro se non c'è)
  const cerca = (val: number): [number, number] | null => {
    let start = -1;
    for (let k = 0; k < n; k++) if (classe[k] !== val) { start = k; break; }
    if (start < 0) return null;
    let best: [number, number] | null = null, bestLen = 0;
    for (let k = 0; k < n; k++) {
      const idx = (start + k) % n;
      if (classe[idx] !== val) continue;
      let len = 0;
      while (len < n && classe[(idx + len) % n] === val) len++;
      if (len > bestLen) { bestLen = len; best = [idx, len]; }
      k += len - 1;
    }
    return best;
  };
  let versoChiaro = true;
  let tratto = cerca(1);
  if (!tratto) { tratto = cerca(-1); versoChiaro = false; }
  if (!tratto) { saltati++; return; }
  const [i0, lenA] = tratto;
  let a0 = i0, la = lenA;
  if (la < 6) { saltati++; return; }
  if (la > n - 6) {
    // un'ISOLA: il muro e' tutto il giro. Si spezza in due meta' con un riferimento: e' muro A il
    // tratto piu' lungo la cui normale guarda in alto (la scelta e' arbitraria e dichiarata).
    const su = new Int8Array(n);
    for (let i = 0; i < n; i++) su[i] = normali[i].y < 0 ? 1 : -1;
    let start = -1;
    for (let k = 0; k < n; k++) if (su[k] !== 1) { start = k; break; }
    if (start < 0) { saltati++; return; }
    let best = -1, bestLen = 0;
    for (let k = 0; k < n; k++) {
      const idx = (start + k) % n;
      if (su[idx] !== 1) continue;
      let len = 0;
      while (len < n && su[(idx + len) % n] === 1) len++;
      if (len > bestLen) { bestLen = len; best = idx; }
      k += len - 1;
    }
    if (best < 0 || bestLen < 6 || bestLen > n - 6) { saltati++; return; }
    a0 = best; la = bestLen;
  }
  const A: Point[] = [], B: Point[] = [];
  for (let k = 0; k < la; k++) A.push(anello[(a0 + k) % n]);
  for (let k = 0; k < n - la; k++) B.push(anello[(a0 + la + k) % n]);
  B.reverse();
  const As = liscia(A, LISCIA_MM, 0.5), Bs = liscia(B, LISCIA_MM, 0.5);
  const fA = lungoLaLinea(As), fB = lungoLaLinea(Bs);
  if (SOLO_BASI) { muriA.push(via(As)); muriB.push(via(Bs)); }

  // larghezza media → quante basi; e il SORMONTO oltre il muro B, dove la foto sfuma
  let larg = 0;
  for (let k = 0; k <= 24; k++) { const pa = fA(k / 24), pb = fB(k / 24); larg += Math.hypot(pb.x - pa.x, pb.y - pa.y); }
  larg /= 25;
  const quante = Math.max(1, Math.round(larg / BASI_MM));
  const passiU = Math.max(12, Math.round((As.length + Bs.length) / 2));
  // il sormonto è quello del blocco CHIARO che continua sotto lo scuro: qui B guarda lo scuro solo se
  // versoChiaro, quindi le basi in più (frazione > 1) si aggiungono solo in quel caso
  const sorm = versoChiaro ? Math.max(SORM_NETTO, SORM_SFUMATO) : 0;
  const quanteInPiu = versoChiaro ? Math.round(sorm / BASI_MM) : 0;
  const segno = (versoChiaro ? -1 : 1) * VERSO;         // -1 = verso A

  for (let q = 0; q < quante + quanteInPiu; q++) {
    const fr = (q + 0.5) / quante;                       // > 1 = oltre il muro B: sormonto
    const linea: Point[] = [];
    const dir: Point[] = [];
    for (let k = 0; k <= passiU; k++) {
      const u = k / passiU;
      const pa = fA(u), pb = fB(u);
      const p = { x: pa.x + (pb.x - pa.x) * fr, y: pa.y + (pb.y - pa.y) * fr };
      // oltre il muro B si va solo dove la foto sfuma, e non più di SORM_NETTO dove stacca
      if (fr > 1) {
        const oltre = Math.hypot(p.x - pb.x, p.y - pb.y);
        const nB = { x: pb.x - pa.x, y: pb.y - pa.y }; const nl = Math.hypot(nB.x, nB.y) || 1;
        const massimo = sfumaQui(pb, { x: nB.x / nl, y: nB.y / nl }) ? SORM_SFUMATO : SORM_NETTO;
        if (oltre > massimo) { linea.push({ x: NaN, y: NaN }); dir.push({ x: 0, y: 0 }); continue; }
      }
      linea.push(p);
      const dx = pa.x - pb.x, dy = pa.y - pb.y, l = Math.hypot(dx, dy) || 1;
      dir.push({ x: (dx / l) * -segno, y: (dy / l) * -segno });
    }
    basiTot++;
    // i tratti validi (dentro il blocco, o nel sormonto): si spezza dove non lo sono
    const tratti: Array<{ p: Point[]; d: Point[] }> = [];
    let cur: { p: Point[]; d: Point[] } = { p: [], d: [] };
    linea.forEach((p, k) => {
      const ok = Number.isFinite(p.x) && (fr > 1 || dentroBlocco(p) || regione.holes.length === 0 && pointInPolygon(p, b.outer));
      if (ok) { cur.p.push(p); cur.d.push(dir[k]); } else if (cur.p.length) { tratti.push(cur); cur = { p: [], d: [] }; }
    });
    if (cur.p.length) tratti.push(cur);
    for (const tr of tratti) {
      if (tr.p.length < 2) continue;
      if (SOLO_BASI) { perTinta[t].push(via(tr.p)); continue; }
      let tot = 0;
      const cum: number[] = [0];
      for (let i = 1; i < tr.p.length; i++) { tot += Math.hypot(tr.p[i].x - tr.p[i - 1].x, tr.p[i].y - tr.p[i - 1].y); cum.push(tot); }
      const punti: Point[] = [];
      let k = 0;
      for (let d = 0; d <= tot; d += PASSO_MM, k++) {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < d) i++;
        const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        const pa = tr.p[i - 1], pb = tr.p[i];
        const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
        const dA = tr.d[i - 1], dB = tr.d[i];
        let bx = dA.x + (dB.x - dA.x) * tt, by = dA.y + (dB.y - dA.y) * tt;
        const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
        const r1 = caso(ib * 7919 + q, k * 2), r2 = caso(ib * 104729 + q, k * 2 + 1);
        let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
        const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
        const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);
        // dove il dente esce dal blocco: se lì stacca si ferma, se sfuma attraversa
        for (let s = 0.5; s <= lung; s += 0.5) {
          const qq = { x: p.x + ux * s, y: p.y + uy * s };
          if (dentroBlocco(qq)) continue;
          if (!sfumaQui(qq, { x: ux, y: uy })) { lung = Math.max(0.5, s - 0.25); fermati++; } else attraversano++;
          break;
        }
        punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
      }
      if (punti.length < 3) continue;
      denti += Math.floor(punti.length / 3);
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], c = punti[i];
        filoMm += Math.hypot(c.x - a.x, c.y - a.y);
        const nn = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y)));
        for (let kk = 0; kk <= nn; kk++) {
          const x = Math.round(a.x + ((c.x - a.x) * kk) / nn), y = Math.round(a.y + ((c.y - a.y) * kk) / nn);
          if (x >= 0 && y >= 0 && x < CW && y < CH) coperto[y * CW + x] = 1;
        }
      }
      perTinta[t].push(via(punti));
    }
  }
});

// --- 5. il disegno: dal chiaro allo scuro; il più chiaro in grigio -------------------------------------
const pezzi: string[] = [];
gruppi.forEach((g, t) => {
  if (perTinta[t].length) pezzi.push(`<path d="${perTinta[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : g.colore}" stroke-width="${SOLO_BASI ? 0.25 : 0.1}"/>`);
});
if (SOLO_BASI) {
  pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.6"/>`);
  pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.4"/>`);
}
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `${SOLO_BASI ? 'basi-' : ''}gruppi-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-s${SORM_NETTO}_${SORM_SFUMATO}${VERSO < 0 ? '-inv' : ''}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`, 'utf8');
if (!SOLO_BASI) {
  let dentro = 0, nudo = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (tintaIn({ x, y }) < 0) continue;
    dentro++;
    if (!coperto[y * CW + x]) nudo++;
  }
  console.log(`COPERTURA VERA: ${((nudo / dentro) * 100).toFixed(1)}% senza filo`);
}
console.log(`${blocchi.length} blocchi (${saltati} saltati) · ${basiTot} basi · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m · ${fermati} fermati, ${attraversano} attraversano`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

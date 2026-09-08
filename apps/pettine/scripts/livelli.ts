// I LIVELLI DELLA DISTANZA DAL MURO: una famiglia sola di curve, spaziatura esatta, copertura totale.
//
// Dopo la doppia propagazione (una seconda direzione: bocciata da Lorenzo, giustamente) e il campo
// armonico (che non ho fatto convergere), la costruzione che ha TUTTE le proprieta' chieste e' la
// piu' semplice: dentro ogni famiglia si misura la distanza geodetica dal muro di partenza (rosso),
// e le linee di base sono le sue curve di livello, una ogni passo.
//   * una famiglia sola di curve, che non si incrociano mai e non hanno giunture;
//   * spaziatura perpendicolare ESATTA: e' la definizione di curva di livello di una distanza;
//   * copertura totale: ogni punto della famiglia ha una distanza, quindi sta fra due livelli;
//   * dove la famiglia si stringe la linea finisce contro il bordo, e arriva come arriva;
//   * i denti hanno un verso solo: verso il muro, cioe' verso il chiaro.
// Il muro viene dal vettoriale di Lorenzo, quindi e' gia' una curva; e ogni livello si addolcisce
// in proporzione alla distanza dal muro, cosi' gli spigoli del muro si dissolvono man mano invece
// di propagarsi (i ventagli attorno agli angoli - gli «epicentri» - erano del muro a scalinata dei
// pixel e della distanza a 8 vicini: qui il muro e' liscio e la distanza e' a 16 vicini).
//
//   npx esbuild apps/pettine/scripts/livelli.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/livelli.mjs
//   node --max-old-space-size=4096 apps/pettine/scripts/livelli.mjs <file.svg> [basi] [sormonto] [addolcisci]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, polygonArea, traceRegions } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '../../pittorico/src/region.ts';
import { rasterizza, livello, incatena } from '../../pittorico/src/iso-fill.ts';
import { larghezzaTransizione } from '../../pittorico/src/borders.ts';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const fileSvg = process.argv[2];
const BASI_MM = num(3, 4);
const SORM_MM = num(4, 4);
const ADDOLCISCI = num(5, 0.3);       // mm di lisciatura per mm di distanza dal muro
const LISCIA_MM = 1.5;                 // lisciatura di base (i muri sono gia' curve)
const RIFERIMENTO_DEG = -90;
// I DENTI (DENTI=1): lunghezza fra min e max, uno ogni PASSO lungo la base, apertura ±INCL, verso il chiaro.
const DENTI = !!process.env.DENTI;
const FOTO = process.argv[6] ?? 'BRIEFING-RASO-OMOGENEO/cianotipia.bmp';
const DENTE_MIN = num(7, 3), DENTE_MAX = num(8, 5), PASSO_MM = Math.max(1, num(9, 1.5)), INCL = num(10, 40), NETTO_MM = num(11, 2.5);
function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
if (!fileSvg) { console.error('uso: node livelli.mjs <file.svg> [basi] [sormonto] [addolcisci]'); process.exit(1); }

const luminosita = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// --- 1. il file --------------------------------------------------------------------------------------
const testo = readFileSync(fileSvg, 'utf8');
const viewBox = /viewBox="([^"]+)"/.exec(testo)![1];
const [vbW, vbH] = viewBox.split(/\s+/).slice(2).map(Number);
const K = LARGHEZZA_REALE_MM / vbW;
const WM = vbW * K, HM = vbH * K;
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
interface Forma { colore: string; punti: Polyline; area: number }
const famiglie: Array<{ nome: string; forme: Forma[] }> = [];
for (const m of testo.matchAll(/<g id="(Livello_\d+)"[^>]*>([\s\S]*?)(?=<g id="Livello_\d+"|<\/svg>)/g)) {
  const forme: Forma[] = [];
  for (const el of m[2].matchAll(/<(path|polygon)\b[^>]*>/g)) {
    const cls = /class="(st\d+)"/.exec(el[0])?.[1];
    const colore = (cls && stili.get(cls)) || /fill="([^"]+)"/.exec(el[0])?.[1] || '#808080';
    const letto = parseSvgPolylines(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${el[0].replace(/class="st\d+"/, 'fill="#000"')}</svg>`, {});
    for (const p of letto.polylines) {
      const pl = p.map((q) => ({ x: q.x * K, y: q.y * K }));
      const area = Math.abs(polygonArea(pl));
      if (pl.length >= 3 && area > 5) forme.push({ colore, punti: pl, area });
    }
  }
  if (forme.length) famiglie.push({ nome: m[1], forme });
}
const colori = [...new Set(famiglie.flatMap((f) => f.forme.map((x) => x.colore)))].sort((a, b) => luminosita(b) - luminosita(a));
const rango = new Map(colori.map((c, i) => [c, i]));
console.log(`\n${fileSvg}\n${WM.toFixed(1)} × ${HM.toFixed(1)} mm · ${famiglie.length} famiglie · ${colori.join(' · ')}`);

// --- 2. la griglia ---------------------------------------------------------------------------------------
const COLS = Math.ceil(WM / CELLA) + 2, ROWS = Math.ceil(HM / CELLA) + 2;
const tinta = new Int8Array(COLS * ROWS).fill(-1);
const famDi = new Int16Array(COLS * ROWS).fill(-1);
famiglie.forEach((f, fi) => {
  for (const s of [...f.forme].sort((a, b) => b.area - a.area)) {
    const dentro = rasterizza(makeRegion(s.punti, []), 0, 0, COLS, ROWS, CELLA);
    const r = rango.get(s.colore)!;
    for (let i = 0; i < dentro.length; i++) if (dentro[i] && (famDi[i] !== fi || tinta[i] < r)) { tinta[i] = r; famDi[i] = fi; }
  }
});
const cella = (p: Point): number => {
  const c = Math.round(p.x / CELLA), r = Math.round(p.y / CELLA);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
};
const tintaIn = (p: Point): number => { const i = cella(p); return i < 0 ? -1 : tinta[i]; };
const famIn = (p: Point): number => { const i = cella(p); return i < 0 ? -1 : famDi[i]; };
// la foto, per dire dove un bordo fra famiglie stacca (il dente si ferma) e dove sfuma (attraversa)
const img = DENTI ? leggiBmp(FOTO) : null;
const mmPerPx = img ? LARGHEZZA_REALE_MM / img.width : 1;
const sfumaQui = (p: Point, n: Point): boolean => {
  if (!img) return true;
  const tr = larghezzaTransizione(img, mmPerPx, p, n, { raggioMm: 6 });
  return tr !== null && tr.larghezzaMm >= NETTO_MM;
};
const perColoreDenti: string[][] = [];
let dentiTot = 0, filoMm = 0, fermati = 0, attraversano = 0;

// --- 3. geometria ------------------------------------------------------------------------------------------
function ricampiona(l: Point[], passo: number): Point[] {
  const out: Point[] = [l[0]];
  let acc = 0;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-9) continue;
    let pos = 0;
    while (acc + (d - pos) >= passo) { pos += passo - acc; out.push({ x: a.x + ((b.x - a.x) * pos) / d, y: a.y + ((b.y - a.y) * pos) / d }); acc = 0; }
    acc += d - pos;
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
const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

// --- 4. famiglia per famiglia ---------------------------------------------------------------------------------
const perColore: string[][] = colori.map(() => []);
colori.forEach(() => perColoreDenti.push([]));
const sotto: string[][] = colori.map(() => []);
const muriA: string[] = [], muriB: string[] = [], frecce: string[] = [];
const lineeFinali: Array<{ id: number; punti: Point[] }> = [];   // id = il livello: due tratti dello stesso livello non sono due linee
let idLivello = 0;
let famOk = 0, famSaltate = 0;
const t0 = Date.now();

famiglie.forEach((f, fi) => {
  const maschera = new Uint8Array(COLS * ROWS);
  let celle = 0;
  for (let i = 0; i < COLS * ROWS; i++) if (famDi[i] === fi) { maschera[i] = 1; celle++; }
  if (celle < 40) { famSaltate++; return; }
  const unioni = traceRegions(maschera, COLS, ROWS, 1, CELLA, { minAreaMm2: 10, simplifyMm: 0.3 });
  if (!unioni.length) { famSaltate++; return; }
  const u = unioni.sort((a, b) => b.areaMm2 - a.areaMm2)[0];
  const dentroFam = (p: Point): boolean => { const i = cella(p); return i >= 0 && famDi[i] === fi; };

  // i due muri, come prima
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
    if (dentroFam({ x: p.x + nx * 1, y: p.y + ny * 1 })) { nx = -nx; ny = -ny; }
    normali.push({ x: nx, y: ny });
    dentroCol[i] = tintaIn({ x: p.x - nx * 1.5, y: p.y - ny * 1.5 });
  }
  const chiaro = Math.min(...Array.from(dentroCol).filter((v) => v >= 0));
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
    const rx = Math.cos((RIFERIMENTO_DEG * Math.PI) / 180), ry = Math.sin((RIFERIMENTO_DEG * Math.PI) / 180);
    tratto = cerca((i) => normali[i].x * rx + normali[i].y * ry >= 0);
    if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) { famSaltate++; return; }
  }
  const [a0, la] = tratto;
  const A: Point[] = [], B: Point[] = [];
  for (let k = 0; k < la; k++) A.push(anello[(a0 + k) % n]);
  for (let k = 0; k < n - la; k++) B.push(anello[(a0 + la + k) % n]);
  const As = liscia(A, LISCIA_MM, 0.5);
  muriA.push(via(As)); muriB.push(via(B));
  famOk++;

  // LA DISTANZA DAL MURO, dentro la famiglia: semi = le celle attraversate dal muro liscio (e le
  // celle di bordo della famiglia entro una cella da esso). Chamfer a 16 vicini, tre giri.
  const INF = 1e9;
  const D = new Float32Array(COLS * ROWS).fill(INF);
  for (const p of ricampiona(As, CELLA / 2)) { const i = cella(p); if (i >= 0) D[i] = 0; }
  for (let i = 0; i < COLS * ROWS; i++) if (D[i] === 0 && famDi[i] !== fi) {
    // il muro sta sul bordo: si sposta il seme sulla cella della famiglia piu' vicina
    for (const j of [i - 1, i + 1, i - COLS, i + COLS, i - COLS - 1, i - COLS + 1, i + COLS - 1, i + COLS + 1]) if (j >= 0 && j < COLS * ROWS && famDi[j] === fi) D[j] = 0;
    D[i] = INF;
  }
  const V: Array<[number, number, number]> = [[-1, 0, CELLA], [0, -1, CELLA], [-1, -1, CELLA * 1.4], [1, -1, CELLA * 1.4], [-2, -1, CELLA * 2.2], [-1, -2, CELLA * 2.2], [1, -2, CELLA * 2.2], [2, -1, CELLA * 2.2]];
  const mio = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < COLS && r < ROWS && famDi[r * COLS + c] === fi;
  for (let giro = 0; giro < 3; giro++) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!mio(c, r)) continue;
      let v = D[i];
      for (const [dx, dy, w] of V) if (mio(c + dx, r + dy)) { const t = D[(r + dy) * COLS + c + dx] + w; if (t < v) v = t; }
      D[i] = v;
    }
    for (let r = ROWS - 1; r >= 0; r--) for (let c = COLS - 1; c >= 0; c--) {
      const i = r * COLS + c;
      if (!mio(c, r)) continue;
      let v = D[i];
      for (const [dx, dy, w] of V) if (mio(c - dx, r - dy)) { const t = D[(r - dy) * COLS + c - dx] + w; if (t < v) v = t; }
      D[i] = v;
    }
  }
  let dMax = 0;
  for (let i = 0; i < COLS * ROWS; i++) if (famDi[i] === fi && D[i] < INF && D[i] > dMax) dMax = D[i];
  const gradVersoA = (p: Point): Point => {
    const i = cella(p);
    if (i < 0) return { x: 0, y: 0 };
    const g = (j: number): number => (j >= 0 && j < COLS * ROWS && famDi[j] === fi && D[j] < INF ? D[j] : D[i]);
    let gx = (g(i + 1) - g(i - 1)) / (2 * CELLA), gy = (g(i + COLS) - g(i - COLS)) / (2 * CELLA);
    const l = Math.hypot(gx, gy) || 1;
    return { x: -gx / l, y: -gy / l };    // -gradiente = verso il muro = verso il chiaro
  };

  /**
   * IL PETTINE su un tratto di base: un dente ogni PASSO_MM, lungo fra min e max, aperto a caso entro
   * ±INCL attorno al verso del chiaro (-gradiente della distanza), andata e ritorno nello stesso
   * buco. Dove il dente esce dalla FAMIGLIA si guarda la foto: se il bordo stacca si ferma, se sfuma
   * attraversa. Dentro la famiglia attraversa sempre: i cambi di colore li' sono un gradiente.
   * Il SORMONTO: se verso il chiaro, entro SORM_MM, c'e' un colore piu' chiaro, il dente si cuce
   * anche con quel colore - prima, e sotto.
   */
  const pettina = (base: Point[], col: number, famiglia: number, idLiv: number): void => {
    let tot = 0;
    const cum: number[] = [0];
    for (let i = 1; i < base.length; i++) { tot += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y); cum.push(tot); }
    const punti: Point[] = [];
    const puntiSotto = new Map<number, Point[]>();
    let k = 0;
    for (let d = 0; d <= tot; d += PASSO_MM, k++) {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      const pa = base[i - 1], pb = base[i];
      const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
      const v = gradVersoA(p);
      if (v.x === 0 && v.y === 0) continue;
      const r1 = caso(famiglia * 7919 + idLiv, k * 2), r2 = caso(famiglia * 104729 + idLiv, k * 2 + 1);
      let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
      const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
      const ux = v.x * Math.cos(ang) - v.y * Math.sin(ang), uy = v.x * Math.sin(ang) + v.y * Math.cos(ang);
      for (let s = 0.5; s <= lung; s += 0.5) {
        const qq = { x: p.x + ux * s, y: p.y + uy * s };
        if (famIn(qq) === famiglia) continue;
        if (!sfumaQui(qq, { x: ux, y: uy })) { lung = Math.max(0.5, s - 0.25); fermati++; } else attraversano++;
        break;
      }
      const punta = { x: p.x + ux * lung, y: p.y + uy * lung };
      punti.push(p, punta, p);
      dentiTot++; filoMm += 2 * lung;
      const qq = { x: p.x + v.x * SORM_MM, y: p.y + v.y * SORM_MM };
      const colLa = famIn(qq) === famiglia ? tintaIn(qq) : -1;
      if (colLa >= 0 && colLa < col) { const l = puntiSotto.get(colLa) ?? []; l.push(p, punta, p); puntiSotto.set(colLa, l); }
    }
    if (punti.length >= 3) perColoreDenti[col].push(via(punti));
    for (const [c, l] of puntiSotto) if (l.length >= 3) perColoreDenti[c].push(via(l));
  };

  // I LIVELLI, uno ogni passo, ognuno addolcito in proporzione alla distanza
  for (let d = BASI_MM / 2; d < dMax; d += BASI_MM) {
    idLivello++;
    for (const linea of incatena(livello(D, maschera, COLS, ROWS, 0, 0, CELLA, d), CELLA * 1.5)) {
      if (linea.length < 3) continue;
      const morbida = liscia(ricampiona(linea, 0.5), LISCIA_MM + ADDOLCISCI * d, 0.5);
      let cur: Point[] = [], curCol = -2;
      const chiudi = (): void => {
        if (cur.length >= 2 && curCol >= 0) {
          perColore[curCol].push(via(cur)); lineeFinali.push({ id: idLivello, punti: cur.slice() });
          if (DENTI) pettina(cur, curCol, fi, idLivello);
        }
        cur = []; curCol = -2;
      };
      for (let i = 0; i < morbida.length; i++) {
        const p = morbida[i];
        const col = dentroFam(p) ? tintaIn(p) : -1;
        if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
        if (col >= 0) cur.push(p);
        if (col >= 0) {
          const v = gradVersoA(p);
          const qq = { x: p.x + v.x * SORM_MM, y: p.y + v.y * SORM_MM };
          const colLa = dentroFam(qq) ? tintaIn(qq) : -1;
          if (colLa >= 0 && colLa < col) sotto[colLa].push(via([p, { x: p.x + v.x * 0.6, y: p.y + v.y * 0.6 }]));
          if (i % 40 === 20 && Math.round(d / BASI_MM) % 2 === 0) {
            const tip = { x: p.x + v.x * 3, y: p.y + v.y * 3 };
            const px = -v.y, py = v.x;
            frecce.push(via([p, tip]) + via([{ x: tip.x - v.x + px * 0.8, y: tip.y - v.y + py * 0.8 }, tip, { x: tip.x - v.x - px * 0.8, y: tip.y - v.y - py * 0.8 }]));
          }
        }
      }
      chiudi();
    }
  }
});
console.log(`${famOk} famiglie, ${famSaltate} saltate · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// --- 5. il metro ------------------------------------------------------------------------------------------
const G = 0.5;
const GW = Math.ceil(WM / G) + 1, GH = Math.ceil(HM / G) + 1;
// denso = due LIVELLI diversi entro 0,35 passi. Contare le polilinee contava due volte lo stesso
// livello spezzato a un cambio di colore: il metro diceva 27% denso su linee a 4 mm esatti.
const ultimoId = new Int32Array(GW * GH).fill(-1);
const conteggio = new Uint8Array(GW * GH), vicino = new Uint8Array(GW * GH);
const r1 = Math.round((BASI_MM * 0.35) / G), r2 = Math.ceil((BASI_MM * 0.75) / G);
for (const { id, punti: linea } of lineeFinali) {
  const toccate = new Set<number>();
  for (const p of linea) {
    const cx = Math.round(p.x / G), cy = Math.round(p.y / G);
    for (let dy = -r2; dy <= r2; dy++) for (let dx = -r2; dx <= r2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 * r2) vicino[y * GW + x] = 1;
      if (d2 <= r1 * r1) toccate.add(y * GW + x);
    }
  }
  for (const i of toccate) if (ultimoId[i] !== id) { ultimoId[i] = id; if (conteggio[i] < 255) conteggio[i]++; }
}
let nude = 0, dense = 0, dentro = 0;
const macchie: string[] = [];
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
  const i = y * GW + x;
  if (tintaIn({ x: x * G, y: y * G }) < 0) continue;
  dentro++;
  if (!vicino[i]) { nude++; macchie.push(`<rect x="${(x * G).toFixed(1)}" y="${(y * G).toFixed(1)}" width="${G}" height="${G}" fill="#ff5fa2" opacity="0.55"/>`); }
  else if (conteggio[i] >= 2) { dense++; macchie.push(`<rect x="${(x * G).toFixed(1)}" y="${(y * G).toFixed(1)}" width="${G}" height="${G}" fill="#2bc46a" opacity="0.55"/>`); }
}
console.log(`METRO (passo ${BASI_MM}): nudo ${((nude / dentro) * 100).toFixed(1)}% · denso ${((dense / dentro) * 100).toFixed(1)}%`);

// --- 6. l'immagine ------------------------------------------------------------------------------------------
const pezzi: string[] = [];
colori.forEach((c, t) => { if (perColore[t].length) pezzi.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.3"/>`); });
const sottoTutti = sotto.flat();
if (sottoTutti.length) pezzi.push(`<path d="${sottoTutti.join('')}" fill="none" stroke="#f08a1a" stroke-width="0.35"/>`);
pezzi.push(`<g>${macchie.join('')}</g>`);
pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.8"/>`);
pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.5"/>`);
pezzi.push(`<path d="${frecce.join('')}" fill="none" stroke="#111" stroke-width="0.35"/>`);
const legenda = colori.map((c, i) => `<rect x="${(8 + i * 22).toFixed(1)}" y="2" width="6" height="6" fill="${c}" stroke="#333" stroke-width="0.2"/><text x="${(15 + i * 22).toFixed(1)}" y="7" font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#222">${i + 1}${i === 0 ? ' (grigio)' : ''}</text>`).join('');
const nota = `<text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="3.6" fill="#222">livelli della distanza dal muro: ordine 1→6 dal chiaro allo scuro · ROSSO muro di partenza · BLU muro opposto · FRECCE verso del pettine · ARANCIO sovrapposizione · ROSA nudo · VERDE denso</text>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/verifica-livelli.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 ${WM.toFixed(1)} ${(HM + 18).toFixed(1)}" width="${WM.toFixed(1)}mm" height="${(HM + 18).toFixed(1)}mm">
<rect x="0" y="-18" width="${WM.toFixed(1)}" height="${(HM + 18).toFixed(1)}" fill="#faf9f7"/>
<g transform="translate(0,-18)">${legenda}${nota}</g>
${pezzi.join('\n')}
</svg>`, 'utf8');
console.log('-> apps/pettine/scripts/out/verifica-livelli.svg');
if (DENTI) {
  const pz: string[] = [];
  colori.forEach((c, t) => {
    const tratto = t === 0 ? '#9a9a9a' : c;
    if (perColore[t].length) pz.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${tratto}" stroke-width="0.1"/>`);
    if (perColoreDenti[t].length) pz.push(`<path d="${perColoreDenti[t].join('')}" fill="none" stroke="${tratto}" stroke-width="0.1"/>`);
  });
  const nome = `pettine-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-p${PASSO_MM}-s${SORM_MM}`;
  writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pz.join('\n')}
</svg>`, 'utf8');
  console.log(`DENTI: ${dentiTot} denti · ${(filoMm / 1000).toFixed(1)} m di filo nei denti · ${fermati} fermati a un bordo netto, ${attraversano} attraversano una sfumatura`);
  console.log(`-> apps/pettine/scripts/out/${nome}.svg`);
}

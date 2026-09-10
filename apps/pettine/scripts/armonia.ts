// UNA FAMIGLIA SOLA DI CURVE: il campo armonico fra i due muri.
//
// Lorenzo, sulla doppia propagazione: «siamo tornati indietro rispetto a quello che avevo chiesto
// all'inizio: un'unica direzione, niente curve e giunture. Ci sono frecce che si incrociano e questo
// non dovrebbe mai accadere in un blocco». Aveva ragione: linee che nascono dal blu e vanno
// incontro a quelle del rosso SONO una seconda direzione, e dove si incontrano si incrociano o
// fanno una giuntura. Non si aggiusta nei dettagli.
//
// LA COSTRUZIONE CHE LO GARANTISCE. Dentro ogni famiglia si risolve un campo φ armonico: vale 0 sul
// muro di partenza (rosso), 1 sul muro opposto (blu), e in mezzo è il più liscio possibile
// (equazione di Laplace). Le linee di base sono le sue CURVE DI LIVELLO. Tre cose vengono gratis:
//   * non si incrociano MAI e non hanno giunture: sono livelli di una funzione sola;
//   * la curvatura si dissolve dolcemente dal rosso al blu: è l'addolcimento, senza manopola;
//   * i denti hanno un verso solo, −∇φ, cioè verso il rosso, il chiaro.
// La spaziatura fra i livelli non è costante (dove la famiglia si stringe si infittiscono): lì si
// DIRADANO. Un livello si disegna in un punto solo se la distanza dal livello vicino, 1/(N·|∇φ|),
// vale almeno 0,7 passi; altrimenti si tengono solo i livelli pari, poi uno su quattro, e così via.
// La linea che si dirada FINISCE — non tocca nessuno. È la regola di Lorenzo: dove non c'è posto
// la linea si interrompe, e arriva dove arriva.
//
//   npx esbuild apps/pettine/scripts/armonia.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/armonia.mjs
//   node --max-old-space-size=4096 apps/pettine/scripts/armonia.mjs <file.svg> [basi] [sormonto]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, polygonArea, traceRegions } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '@rg/core';
import { rasterizza, livello, incatena } from '@rg/core';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const fileSvg = process.argv[2];
const BASI_MM = num(3, 4);
const SORM_MM = num(4, 4);
const RIFERIMENTO_DEG = -90;
if (!fileSvg) { console.error('uso: node armonia.mjs <file.svg> [basi] [sormonto]'); process.exit(1); }

const luminosita = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// --- 1. il file: livelli → famiglie → forme ---------------------------------------------------------
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

// --- 2. la griglia: colore e famiglia di ogni cella -----------------------------------------------------
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

// --- 3. geometria -------------------------------------------------------------------------------------
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
const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

// --- 4. famiglia per famiglia: i due muri, il campo armonico, i livelli diradati ----------------------
const perColore: string[][] = colori.map(() => []);
const sotto: string[][] = colori.map(() => []);
const muriA: string[] = [], muriB: string[] = [], frecce: string[] = [];
const lineeFinali: Point[][] = [];
let famOk = 0, famSaltate = 0, iterTot = 0;
const t0 = Date.now();

famiglie.forEach((f, fi) => {
  const maschera = new Uint8Array(COLS * ROWS);
  let minC = COLS, maxC = 0, minR = ROWS, maxR = 0, celle = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (famDi[i] !== fi) continue;
    maschera[i] = 1; celle++;
    if (c < minC) minC = c; if (c > maxC) maxC = c; if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  if (celle < 40) { famSaltate++; return; }
  const unioni = traceRegions(maschera, COLS, ROWS, 1, CELLA, { minAreaMm2: 10, simplifyMm: 0.3 });
  if (!unioni.length) { famSaltate++; return; }
  const u = unioni.sort((a, b) => b.areaMm2 - a.areaMm2)[0];
  const dentroFam = (p: Point): boolean => { const i = cella(p); return i >= 0 && famDi[i] === fi; };

  // il contorno e i due muri, come prima: A = il tratto più lungo dove dentro c'è il colore più chiaro
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
  // IL MURO DI FRONTE E I LATI. Con il valore 1 su tutto il resto del contorno, lati compresi, i
  // livelli si piegavano verso i lati (anelli e altipiani rosa, misurati: nudo 16%). Il valore 1 va
  // solo sul tratto di B che sta DI FRONTE ad A - i punti di B lontani da A almeno il 60% della
  // distanza massima; i lati, dove B si sta ancora allontanando da A, restano liberi: il campo ci
  // arriva perpendicolare da solo (condizione di Neumann).
  const distA = (pt: Point): number => { let best = 1e9; for (let k = 0; k < A.length; k += 2) { const d = Math.hypot(A[k].x - pt.x, A[k].y - pt.y); if (d < best) best = d; } return best; };
  const distanzeB = B.map(distA);
  const dMax = Math.max(...distanzeB);
  const fronte: Point[] = [], lati: Point[] = [];
  B.forEach((p, k) => { (distanzeB[k] >= 0.6 * dMax ? fronte : lati).push(p); });
  muriA.push(via(A)); muriB.push(via(B));

  // IL CAMPO ARMONICO sul riquadro della famiglia: 0 sul bordo vicino ad A, 1 sul bordo vicino a B,
  // Laplace dentro. Le condizioni al contorno stanno sulle celle di bordo della famiglia: ognuna
  // prende il valore del muro a cui è più vicina. Si risolve con Gauss-Seidel sovrarilassato.
  const w = maxC - minC + 3, h = maxR - minR + 3;
  const idx = (c: number, r: number): number => (r - minR + 1) * w + (c - minC + 1);
  const phi = new Float32Array(w * h);
  const fisso = new Uint8Array(w * h);      // 1 = condizione al contorno
  const libero = new Uint8Array(w * h);     // 1 = cella interna da risolvere
  const griglia = (pts: Point[]): Set<number> => { const s = new Set<number>(); for (const p of pts) s.add(cella(p)); return s; };
  const inA = griglia(A), inB = griglia(fronte);
  // distanza (in celle) al muro A e al muro B lungo il bordo: si assegna per vicinanza
  const piuVicino = (l: Point[], pt: Point): number => { let best = 1e9; for (let k = 0; k < l.length; k += 2) { const d = Math.hypot(l[k].x - pt.x, l[k].y - pt.y); if (d < best) best = d; } return best; };
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) {
    const i = r * COLS + c;
    if (famDi[i] !== fi) continue;
    const bordo = famDi[i - 1] !== fi || famDi[i + 1] !== fi || famDi[i - COLS] !== fi || famDi[i + COLS] !== fi;
    const j = idx(c, r);
    if (bordo) {
      const p = { x: c * CELLA, y: r * CELLA };
      const da = piuVicino(A, p), df = fronte.length ? piuVicino(fronte, p) : 1e9, dl = lati.length ? piuVicino(lati, p) : 1e9;
      if (inA.has(i) || (da <= df && da <= dl)) { fisso[j] = 1; phi[j] = 0; }
      else if (inB.has(i) || df <= dl) { fisso[j] = 1; phi[j] = 1; }
      else { libero[j] = 1; phi[j] = 0.5; }          // un lato: libero, il campo ci arriva perpendicolare
    } else { libero[j] = 1; phi[j] = 0.5; }
  }
  // LA STIMA DI PARTENZA: dA / (dA + dB), con le distanze ai due muri dentro la famiglia (chamfer a
  // 16 vicini). Partendo da 0,5 ovunque il rilassamento propagava di una cella a sweep e si fermava
  // troppo presto: i livelli giravano attorno ai muri come anelli. Da qui e' gia' quasi la soluzione.
  const distDa = (seme: (j: number) => boolean): Float32Array => {
    const INF = 1e9;
    const d = new Float32Array(w * h).fill(INF);
    for (let j = 0; j < w * h; j++) if (seme(j)) d[j] = 0;
    const V: Array<[number, number, number]> = [[-1, 0, CELLA], [0, -1, CELLA], [-1, -1, CELLA * 1.4], [1, -1, CELLA * 1.4], [-2, -1, CELLA * 2.2], [-1, -2, CELLA * 2.2], [1, -2, CELLA * 2.2], [2, -1, CELLA * 2.2]];
    const ok = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < w && r < h && (libero[r * w + c] || fisso[r * w + c]) === 1;
    for (let giro = 0; giro < 3; giro++) {
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const j = r * w + c; if (!ok(c, r)) continue; let v = d[j]; for (const [dx, dy, ww] of V) if (ok(c + dx, r + dy)) { const u = d[(r + dy) * w + c + dx] + ww; if (u < v) v = u; } d[j] = v; }
      for (let r = h - 1; r >= 0; r--) for (let c = w - 1; c >= 0; c--) { const j = r * w + c; if (!ok(c, r)) continue; let v = d[j]; for (const [dx, dy, ww] of V) if (ok(c - dx, r - dy)) { const u = d[(r - dy) * w + c - dx] + ww; if (u < v) v = u; } d[j] = v; }
    }
    return d;
  };
  const dA = distDa((j) => fisso[j] === 1 && phi[j] === 0), dB = distDa((j) => fisso[j] === 1 && phi[j] === 1);
  for (let j = 0; j < w * h; j++) if (libero[j]) { const a = dA[j], b = dB[j]; phi[j] = a < 1e8 && b < 1e8 ? a / (a + b + 1e-9) : 0.5; }
  // Gauss-Seidel con sovrarilassamento, finché il cambiamento massimo scende sotto la soglia
  const omega = 1.85;
  let iter = 0;
  for (; iter < 1500; iter++) {
    let maxDelta = 0;
    for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
      const j = r * w + c;
      if (!libero[j]) continue;
      let s = 0, k = 0;
      for (const jj of [j - 1, j + 1, j - w, j + w]) if (libero[jj] || fisso[jj]) { s += phi[jj]; k++; }
      if (!k) continue;
      const nuovo = phi[j] + omega * (s / k - phi[j]);
      const d = Math.abs(nuovo - phi[j]);
      if (d > maxDelta) maxDelta = d;
      phi[j] = nuovo;
    }
    if (maxDelta < 1e-5) break;
  }
  iterTot += iter;
  famOk++;

  // i livelli: N = larghezza massima / passo, dove la larghezza è 1/|∇φ| nel punto più largo
  const D = new Float32Array(w * h).fill(0);
  const dentro = new Uint8Array(w * h);
  for (let j = 0; j < w * h; j++) { dentro[j] = libero[j] || fisso[j] ? 1 : 0; D[j] = phi[j]; }
  // |∇φ| per cella (differenze centrate, in 1/mm); dove non si può, si lascia 0 = "non diradare"
  const grad = (j: number): [number, number] => {
    const l = dentro[j - 1] ? phi[j - 1] : phi[j], rr = dentro[j + 1] ? phi[j + 1] : phi[j];
    const uu = dentro[j - w] ? phi[j - w] : phi[j], dd = dentro[j + w] ? phi[j + w] : phi[j];
    const sx = (dentro[j - 1] ? 1 : 0) + (dentro[j + 1] ? 1 : 0), sy = (dentro[j - w] ? 1 : 0) + (dentro[j + w] ? 1 : 0);
    return [sx ? (rr - l) / (sx * CELLA) : 0, sy ? (dd - uu) / (sy * CELLA) : 0];
  };
  const N = Math.max(1, Math.round(dMax / BASI_MM));
  const x0 = (minC - 1) * CELLA, y0 = (minR - 1) * CELLA;
  const cellaLoc = (p: Point): number => {
    const c = Math.round(p.x / CELLA) - minC + 1, r = Math.round(p.y / CELLA) - minR + 1;
    return c < 0 || r < 0 || c >= w || r >= h ? -1 : r * w + c;
  };

  for (let k = 0; k < N; k++) {
    const val = (k + 0.5) / N;
    for (const linea of incatena(livello(D, dentro, w, h, x0, y0, CELLA, val), CELLA * 1.5)) {
      if (linea.length < 3) continue;
      // il DIRADAMENTO: in ogni punto, la distanza dal livello vicino è 1/(N·|∇φ|). Se è sotto 0,7
      // passi il livello k si tiene solo se k è pari (e la distanza doppia basta), poi uno su 4...
      let cur: Point[] = [], curCol = -2;
      const chiudi = (): void => { if (cur.length >= 2 && curCol >= 0) { perColore[curCol].push(via(cur)); lineeFinali.push(cur.slice()); } cur = []; curCol = -2; };
      const pts = ricampiona(linea, 0.5);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const j = cellaLoc(p);
        let ok = j >= 0 && dentroFam(p);
        let gx = 0, gy = 0;
        if (ok) {
          [gx, gy] = grad(j);
          const g = Math.hypot(gx, gy);
          const spazio = g > 1e-6 ? 1 / (N * g) : BASI_MM;
          let m = 1;
          while (spazio * m < BASI_MM * 0.7 && m < 64) m *= 2;
          if (k % m !== 0) ok = false;
        }
        const col = ok ? tintaIn(p) : -1;
        if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
        if (col >= 0) cur.push(p);
        if (col >= 0) {
          const g = Math.hypot(gx, gy) || 1;
          const vx = -gx / g, vy = -gy / g;                                     // verso A, il chiaro
          const qq = { x: p.x + vx * SORM_MM, y: p.y + vy * SORM_MM };
          const colLa = dentroFam(qq) ? tintaIn(qq) : -1;
          if (colLa >= 0 && colLa < col) sotto[colLa].push(via([p, { x: p.x + vx * 0.6, y: p.y + vy * 0.6 }]));
          if (i % 40 === 20 && k % 2 === 0) {
            const tip = { x: p.x + vx * 3, y: p.y + vy * 3 };
            const px = -vy, py = vx;
            frecce.push(via([p, tip]) + via([{ x: tip.x - vx + px * 0.8, y: tip.y - vy + py * 0.8 }, tip, { x: tip.x - vx - px * 0.8, y: tip.y - vy - py * 0.8 }]));
          }
        }
      }
      chiudi();
    }
  }
});
console.log(`${famOk} famiglie, ${famSaltate} saltate · ${iterTot} iterazioni di Laplace · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// --- 5. il metro: nudo e denso ------------------------------------------------------------------------
const G = 0.5;
const GW = Math.ceil(WM / G) + 1, GH = Math.ceil(HM / G) + 1;
const conteggio = new Uint8Array(GW * GH), vicino = new Uint8Array(GW * GH);
const r1 = Math.round((BASI_MM * 0.35) / G), r2 = Math.ceil((BASI_MM * 0.75) / G);
for (const linea of lineeFinali) {
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
  for (const i of toccate) if (conteggio[i] < 255) conteggio[i]++;
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

// --- 6. l'immagine per capirsi --------------------------------------------------------------------------
const pezzi: string[] = [];
colori.forEach((c, t) => { if (perColore[t].length) pezzi.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.3"/>`); });
const sottoTutti = sotto.flat();
if (sottoTutti.length) pezzi.push(`<path d="${sottoTutti.join('')}" fill="none" stroke="#f08a1a" stroke-width="0.35"/>`);
pezzi.push(`<g>${macchie.join('')}</g>`);
pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.8"/>`);
pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.5"/>`);
pezzi.push(`<path d="${frecce.join('')}" fill="none" stroke="#111" stroke-width="0.35"/>`);
const legenda = colori.map((c, i) => `<rect x="${(8 + i * 22).toFixed(1)}" y="2" width="6" height="6" fill="${c}" stroke="#333" stroke-width="0.2"/><text x="${(15 + i * 22).toFixed(1)}" y="7" font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#222">${i + 1}${i === 0 ? ' (grigio)' : ''}</text>`).join('');
const nota = `<text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="3.6" fill="#222">campo armonico: ordine 1→6 dal chiaro allo scuro · ROSSO muro di partenza · BLU muro opposto · FRECCE verso del pettine · ARANCIO sovrapposizione · ROSA nudo · VERDE denso</text>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/verifica-armonia.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 ${WM.toFixed(1)} ${(HM + 18).toFixed(1)}" width="${WM.toFixed(1)}mm" height="${(HM + 18).toFixed(1)}mm">
<rect x="0" y="-18" width="${WM.toFixed(1)}" height="${(HM + 18).toFixed(1)}" fill="#faf9f7"/>
<g transform="translate(0,-18)">${legenda}${nota}</g>
${pezzi.join('\n')}
</svg>`, 'utf8');
console.log('-> apps/pettine/scripts/out/verifica-armonia.svg');

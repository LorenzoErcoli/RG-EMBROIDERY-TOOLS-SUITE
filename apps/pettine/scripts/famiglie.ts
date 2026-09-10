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
import { makeRegion } from '@rg/core';
import { rasterizza } from '@rg/core';

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
const MARGINE = num(7, 3);          // passi di sopravvivenza fuori dalla famiglia
const SECONDA = num(8, 0) > 0;      // la seconda passata dal blu: SPENTA, e' una seconda direzione
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
  // Riscritta: la versione precedente, quando i punti in ingresso erano piu' vicini del passo,
  // sbagliava il segno del resto e a ogni linea i punti crescevano del 50% - 3 milioni alla linea 39.
  const out: Point[] = [l[0]];
  let acc = 0;                                  // strada fatta dall'ultimo punto emesso
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-9) continue;
    let pos = 0;
    while (acc + (d - pos) >= passo) {
      pos += passo - acc;
      out.push({ x: a.x + ((b.x - a.x) * pos) / d, y: a.y + ((b.y - a.y) * pos) / d });
      acc = 0;
    }
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
const lineeFinali: Point[][] = [];   // per il metro: nudo e denso
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

  // OGNI LINEA NASCE DALLA PRECEDENTE, spostata di un passo lungo la sua NORMALE: cosi' la
  // spaziatura e' perpendicolare per costruzione, e la lisciatura di ogni passo si accumula
  // (l'addolcimento progressivo). E la regola di Lorenzo ha due facce: dove non c'e' posto la linea
  // finisce, dove c'e' posto ne nasce una. Gli offset nascono solo dal muro da cui partono, quindi si
  // propaga DUE volte - prima dal rosso verso il blu, poi dal blu verso il rosso - e la seconda
  // passata vive solo nelle celle che la prima ha lasciato scoperte, e si ferma dove la incontra.
  const Gc = 0.5;
  const GWc = Math.ceil(WM / Gc) + 1, GHc = Math.ceil(HM / Gc) + 1;
  const copertoFam = new Uint8Array(GWc * GHc);     // celle entro 3/4 di passo da una linea gia' tracciata
  const rCop = Math.ceil((BASI_MM * 0.75) / Gc);
  const segna = (linea: Point[]): void => {
    for (const p of linea) {
      const cx = Math.round(p.x / Gc), cy = Math.round(p.y / Gc);
      for (let dy = -rCop; dy <= rCop; dy++) for (let dx = -rCop; dx <= rCop; dx++) {
        if (dx * dx + dy * dy > rCop * rCop) continue;
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < GWc && y < GHc) copertoFam[y * GWc + x] = 1;
      }
    }
  };
  const scoperta = (p: Point): boolean => {
    const x = Math.round(p.x / Gc), y = Math.round(p.y / Gc);
    return x >= 0 && y >= 0 && x < GWc && y < GHc && !copertoFam[y * GWc + x];
  };
  const piuVicino = (l: Point[], pt: Point): Point => {
    let best = 1e9, q = l[0];
    for (let k = 0; k < l.length; k += 2) { const d = Math.hypot(l[k].x - pt.x, l[k].y - pt.y); if (d < best) { best = d; q = l[k]; } }
    return q;
  };
  // la linea sopravvive fino a MARGINE passi fuori dalla famiglia: cosi' ai capi non si svuota e puo'
  // rientrare dove la famiglia si riallarga (con mezzo passo 12 famiglie su 19 si svuotavano)
  const vicinoAllaFam = (pt: Point): boolean => {
    if (dentroFam(pt)) return true;
    const r = BASI_MM * MARGINE;
    for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; if (dentroFam({ x: pt.x + Math.cos(t) * r, y: pt.y + Math.sin(t) * r })) return true; }
    return false;
  };
  /** Le normali di una linea, col segno deciso per continuita' da un seme: il punto centrale guarda `verso`. */
  const normaliVerso = (linea: Point[], verso: Point[]): Point[] => {
    const nrm: Point[] = linea.map((_, k) => {
      const a = linea[Math.max(0, k - 1)], c = linea[Math.min(linea.length - 1, k + 1)];
      const nx = c.y - a.y, ny = -(c.x - a.x);
      const l = Math.hypot(nx, ny) || 1;
      return { x: nx / l, y: ny / l };
    });
    const mid = linea.length >> 1;
    const q = piuVicino(verso, linea[mid]);
    const vx = q.x - linea[mid].x, vy = q.y - linea[mid].y;
    if (nrm[mid].x * vx + nrm[mid].y * vy < 0) nrm[mid] = { x: -nrm[mid].x, y: -nrm[mid].y };
    for (let k = mid + 1; k < nrm.length; k++) if (nrm[k].x * nrm[k - 1].x + nrm[k].y * nrm[k - 1].y < 0) nrm[k] = { x: -nrm[k].x, y: -nrm[k].y };
    for (let k = mid - 1; k >= 0; k--) if (nrm[k].x * nrm[k + 1].x + nrm[k].y * nrm[k + 1].y < 0) nrm[k] = { x: -nrm[k].x, y: -nrm[k].y };
    return nrm;
  };
  let largMax = 0;
  for (let k = 0; k <= 48; k++) { const pa = fA(k / 48), pb = fB(k / 48); largMax = Math.max(largMax, Math.hypot(pb.x - pa.x, pb.y - pa.y)); }
  const quante = Math.max(1, Math.ceil(largMax / BASI_MM) + 1);

  /**
   * Propaga dal muro `partenza` verso il muro `arrivo`. Le linee della seconda passata (`soloScoperte`)
   * si disegnano solo dove la prima non e' arrivata. I denti vanno SEMPRE verso A (il chiaro).
   */
  const propaga = (partenza: Point[], arrivo: Point[], soloScoperte: boolean, passata: number): void => {
    let corrente: Point[] = partenza.slice();
    let vuote = 0;
    for (let q = 0; q < quante; q++) {
      const nrm = normaliVerso(corrente, arrivo);
      const salto = q === 0 ? BASI_MM / 2 : BASI_MM;
      const grezza: Point[] = corrente.map((pt, k) => ({ x: pt.x + nrm[k].x * salto, y: pt.y + nrm[k].y * salto }));
      const tenuti: Point[] = [];
      for (let k = 0; k < grezza.length; k++) {
        const a0 = corrente[Math.max(0, k - 1)], c0 = corrente[Math.min(corrente.length - 1, k + 1)];
        const a1 = grezza[Math.max(0, k - 1)], c1 = grezza[Math.min(grezza.length - 1, k + 1)];
        if ((c0.x - a0.x) * (c1.x - a1.x) + (c0.y - a0.y) * (c1.y - a1.y) < 0) continue;   // ripiegamento
        tenuti.push(grezza[k]);
      }
      if (tenuti.length < 4) break;
      const morbida = liscia(ricampiona(tenuti, 0.5), LISCIA_MM + ADDOLCISCI * BASI_MM, 0.5);
      corrente = morbida.filter(vicinoAllaFam);
      if (corrente.length < 4) break;
      const versoA = normaliVerso(morbida, As);                     // i denti e il sormonto guardano A
      let cur: Point[] = [], curCol = -2;
      const chiudi = (): void => {
        if (cur.length >= 2 && curCol >= 0) { perColore[curCol].push(via(cur)); lineeFinali.push(cur.slice()); segna(cur); }
        cur = []; curCol = -2;
      };
      let vivi = 0;
      for (let k = 0; k < morbida.length; k++) {
        const p = morbida[k];
        const ok = dentroFam(p) && (!soloScoperte || scoperta(p));
        const col = ok ? tintaIn(p) : -1;
        if (col >= 0) vivi++;
        if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
        if (col >= 0) cur.push(p);
        if (col >= 0) {
          const qq = { x: p.x + versoA[k].x * SORM_MM, y: p.y + versoA[k].y * SORM_MM };
          const colLa = dentroFam(qq) ? tintaIn(qq) : -1;
          if (colLa >= 0 && colLa < col) sotto[colLa].push(via([p, { x: p.x + versoA[k].x * 0.6, y: p.y + versoA[k].y * 0.6 }]));
        }
        if (k % 30 === 15 && q % 2 === 0 && col >= 0) {
          const dx = versoA[k].x, dy = versoA[k].y;
          const tip = { x: p.x + dx * 3, y: p.y + dy * 3 };
          const px = -dy, py = dx;
          frecce.push(via([p, tip]) + via([{ x: tip.x - dx * 1 + px * 0.8, y: tip.y - dy * 1 + py * 0.8 }, tip, { x: tip.x - dx * 1 - px * 0.8, y: tip.y - dy * 1 - py * 0.8 }]));
        }
      }
      chiudi();
      // la seconda passata: quando due linee di fila non trovano piu' niente di scoperto, e' finita
      if (vivi === 0) { vuote++; if (vuote >= 4 && q > 0) break; } else vuote = 0;
      if (process.env.DIAG2 && q === quante - 1) console.log(`  DIAG2 fam ${fi} ${f.nome} passata ${passata}: tutte le ${quante} linee`);
    }
  };
  propaga(As, Bs, false, 1);
  if (SECONDA) propaga(Bs, As, true, 2);
});

// --- 4b. IL METRO: celle nude (nessuna linea entro 3/4 di passo) e celle dense (due linee a meno
// di mezzo passo). Si rasterizza a mezzo millimetro; per la densita' si conta, per cella, il numero
// di linee DISTINTE che passano entro mezzo passo.
const G = 0.5;
const GW = Math.ceil(WM / G) + 1, GH = Math.ceil(HM / G) + 1;
const conteggio = new Uint8Array(GW * GH);          // quante linee distinte toccano la cella (raggio passo/2)
const vicino = new Uint8Array(GW * GH);             // c'e' una linea entro 3/4 di passo?
// densa = due linee entrambe entro 0,35 passi dalla cella, cioe' spaziate meno di 0,7 passi. A mezzo passo
// esatto ogni cella a meta' strada fra due linee regolari risultava densa: il metro contava se stesso.
const r1 = Math.round((BASI_MM * 0.35) / G), r2 = Math.ceil((BASI_MM * 0.75) / G);
lineeFinali.forEach((linea, id) => {
  const toccate = new Set<number>();
  for (let i = 0; i < linea.length; i++) {
    const p = linea[i];
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
  void id;
});
let nude = 0, dense = 0, dentro = 0;
const macchie: string[] = [];
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
  const i = y * GW + x;
  if (tintaIn({ x: x * G, y: y * G }) < 0) continue;
  dentro++;
  if (!vicino[i]) { nude++; macchie.push(`<rect x="${(x * G).toFixed(1)}" y="${(y * G).toFixed(1)}" width="${G}" height="${G}" fill="#ff5fa2" opacity="0.55"/>`); }
  else if (conteggio[i] >= 2) { dense++; macchie.push(`<rect x="${(x * G).toFixed(1)}" y="${(y * G).toFixed(1)}" width="${G}" height="${G}" fill="#2bc46a" opacity="0.55"/>`); }
}
console.log(`METRO (passo ${BASI_MM}): nudo ${((nude / dentro) * 100).toFixed(1)}% del pannello (oltre 3/4 di passo da ogni linea) · denso ${((dense / dentro) * 100).toFixed(1)}% (due linee spaziate meno di 0,7 passi)`);

// --- 5. l'immagine per capirsi -------------------------------------------------------------------------
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (perColore[t].length) pezzi.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.3"/>`);
});
// la sovrapposizione in arancio (tratti corti dal punto verso il chiaro), poi i muri, poi le frecce
const sottoTutti = sotto.flat();
if (sottoTutti.length) pezzi.push(`<path d="${sottoTutti.join('')}" fill="none" stroke="#f08a1a" stroke-width="0.35"/>`);
pezzi.push(`<g>${macchie.join('')}</g>`);
pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.8"/>`);
pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.5"/>`);
pezzi.push(`<path d="${frecce.join('')}" fill="none" stroke="#111" stroke-width="0.35"/>`);
const legenda = colori.map((c, i) => `<rect x="${(8 + i * 22).toFixed(1)}" y="2" width="6" height="6" fill="${c}" stroke="#333" stroke-width="0.2"/><text x="${(15 + i * 22).toFixed(1)}" y="7" font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#222">${i + 1}${i === 0 ? ' (grigio)' : ''}</text>`).join('');
const nota = `<text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="3.6" fill="#222">ordine di cucitura 1→6 dal chiaro allo scuro · ROSSO muro di partenza (chiaro) · BLU muro opposto · FRECCE verso del pettine · ARANCIO la sovrapposizione del chiaro sotto lo scuro · ROSA celle nude (oltre 3/4 di passo da ogni linea) · VERDE celle dense (due linee spaziate meno di 0,7 passi)</text>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/verifica-famiglie.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 ${WM.toFixed(1)} ${(HM + 18).toFixed(1)}" width="${WM.toFixed(1)}mm" height="${(HM + 18).toFixed(1)}mm">
<rect x="0" y="-18" width="${WM.toFixed(1)}" height="${(HM + 18).toFixed(1)}" fill="#faf9f7"/>
<g transform="translate(0,-18)">${legenda}${nota}</g>
${pezzi.join('\n')}
</svg>`, 'utf8');
console.log(`${famOk} famiglie disegnate, ${famSaltate} saltate · basi ogni ${BASI_MM} mm · sormonto ${SORM_MM} mm`);
console.log('-> apps/pettine/scripts/out/verifica-famiglie.svg');

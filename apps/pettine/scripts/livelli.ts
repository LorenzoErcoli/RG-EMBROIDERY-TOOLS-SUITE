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
//     [foto.bmp] [denteMin] [denteMax] [passo] [incl] [nettoMm] [sconfina] [lisciaMax]
//   DENTI=1 mette il pettine; MOSTRA_NUDI=1 colora di rosa le celle nude; MAPPA=1 stampa dove stanno
//   le celle nude e i tratti corti; PROBE=x,y sonda un punto; CROP=x0,y0,x1,y1 scrive un ritaglio
//   leggero (out/ritaglio.svg), SOLO_BASI=1 senza denti.

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
const BASI_MM = num(3, 2);
const SORM_MM = num(4, 4);
const ADDOLCISCI = num(5, 0.3);       // mm di lisciatura per mm di distanza dal muro
const LISCIA_MM = 1.5;                 // lisciatura di base (i muri sono gia' curve)
const LISCIA_MAX = num(13, 8);         // tetto alla lisciatura, in mm
// LA DISTANZA SI SPIANA (raggio in mm, tre passate di media mobile = quasi una gaussiana). Le creste
// della distanza - dove due fronti si incontrano - facevano V e forcine nei livelli; Lorenzo (2026-09-09):
// «evitiamo di creare angoli troppo estremi delle curve, anche se questo implica non rispettare i due
// muri. Preferisco che la copertura sia piu' efficace». Spianata la distanza, la cresta diventa un dorso
// e il livello ci gira attorno con un raggio invece di uno spigolo.
const SPIANA_MM = num(14, 5);
// LA CHIUSURA delle insenature nella crescita a passo fisso (raggio in mm, cresce con ADDOLCISCI per mm
// di distanza dal muro, tetto LISCIA_MAX).
const CHIUDI_MM = num(15, 3);
// LE FAMIGLIE PICCOLE (fino a tanti mm²) vanno a traslazione del muro chiaro: prova sulla sfera
const TRASLA_MAX_MM2 = num(16, 9000);   // Lorenzo (2026-09-09, seconda tornata): «puoi spianarle ancora di piu'»
// L'ULTIMA BASE LUNGO IL MURO OPPOSTO: spenta di default (ULTIMA=1 per riaverla). Lorenzo: «la curva si
// amplifica per rispettare il muro finale, quello lo eviterei, non e' necessario che diventi uguale al
// muro finale». Con lo sconfinamento oltre il muro i suoi buchi non ci sono piu'.
const ULTIMA_BASE = !!process.env.ULTIMA;
const RIFERIMENTO_DEG = -90;
// SCONFINAMENTO ai bordi fra famiglie: basi e denti vivono fino a tanto oltre il bordo della propria
// famiglia. Lungo un bordo le basi finiscono contro il muro e i denti gli corrono paralleli: senza
// questo restava una striscia nuda di ~1 mm su ogni giunta (misurato: 2,4% del pannello, tutto li').
const SCONFINA_MM = num(12, num(3, 2) + 0.5);   // di default un passo e mezzo: cosi' oltre il muro opposto c'e' sempre un livello intero, e i suoi denti coprono la striscia fino al bordo
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
// IL MARGINE ATTORNO AL PANNELLO: la griglia comincia MARG mm prima del disegno, cosi' basi e denti
// possono sconfinare anche oltre il bordo del pannello (il metro diceva: i buchi stanno quasi tutti
// li', 4000 celle sul bordo contro 200 sulle giunte). Il pannello va ricamato fino al bordo e oltre.
const MARG = SCONFINA_MM + num(14, 5) + 1;   // sconfinamento + raggio di spianatura + 1
const ORIG = -MARG;
const COLS = Math.ceil((WM + 2 * MARG) / CELLA) + 2, ROWS = Math.ceil((HM + 2 * MARG) / CELLA) + 2;
const tinta = new Int8Array(COLS * ROWS).fill(-1);
const famDi = new Int16Array(COLS * ROWS).fill(-1);
famiglie.forEach((f, fi) => {
  for (const s of [...f.forme].sort((a, b) => b.area - a.area)) {
    const dentro = rasterizza(makeRegion(s.punti, []), ORIG, ORIG, COLS, ROWS, CELLA);
    const r = rango.get(s.colore)!;
    for (let i = 0; i < dentro.length; i++) if (dentro[i] && (famDi[i] !== fi || tinta[i] < r)) { tinta[i] = r; famDi[i] = fi; }
  }
});
// GLI SPAZI VUOTI FRA I GRUPPI. Fra una forma e l'altra del vettoriale restano fessure senza tinta,
// che nessuna famiglia copre e che il metro non contava: erano i canali bianchi fra le famiglie.
// Ogni cella vuota circondata dal disegno prende la famiglia (e la tinta) della vicina - chi viene
// dopo copre, quindi vince la piu' scura fra le vicine. Si misura prima quanto erano.
{
  let vuote = 0, riempite = 0;
  // «dentro il disegno» = entro 6 mm da una cella colorata (il bordo esterno della foto non conta)
  const r = Math.round(6 / CELLA);
  const vicinoAlDisegno = (i: number): boolean => {
    const c = i % COLS, rr = Math.floor(i / COLS);
    for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) {
      const x = c + dx, y = rr + dy;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS && famDi[y * COLS + x] >= 0) return true;
    }
    return false;
  };
  // ...e dentro il rettangolo del pannello: il margine attorno resta senza tinta (e' fuori dal ricamo)
  const nelPannello = (i: number): boolean => { const x = ORIG + (i % COLS) * CELLA, y = ORIG + Math.floor(i / COLS) * CELLA; return x >= 0 && y >= 0 && x <= WM && y <= HM; };
  for (let i = 0; i < COLS * ROWS; i++) if (famDi[i] < 0 && nelPannello(i) && vicinoAlDisegno(i)) vuote++;
  for (let passata = 0; passata < r; passata++) {
    const nuovaFam = new Int16Array(famDi), nuovaTinta = new Int8Array(tinta);
    for (let y = 1; y + 1 < ROWS; y++) for (let x = 1; x + 1 < COLS; x++) {
      const i = y * COLS + x;
      if (famDi[i] >= 0 || !nelPannello(i)) continue;
      let best = -1;
      for (const j of [i - 1, i + 1, i - COLS, i + COLS]) if (famDi[j] >= 0 && (best < 0 || tinta[j] > tinta[best])) best = j;
      if (best >= 0) { nuovaFam[i] = famDi[best]; nuovaTinta[i] = tinta[best]; riempite++; }
    }
    famDi.set(nuovaFam); tinta.set(nuovaTinta);
  }
  console.log(`spazi vuoti fra i gruppi: ${(vuote * CELLA * CELLA).toFixed(0)} mm² (${((vuote * CELLA * CELLA) / (WM * HM) * 100).toFixed(1)}% del pannello) · riempiti ${(riempite * CELLA * CELLA).toFixed(0)} mm²`);
}
const cella = (p: Point): number => {
  const c = Math.round((p.x - ORIG) / CELLA), r = Math.round((p.y - ORIG) / CELLA);
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
const cucito: Point[][] = [];   // tutto cio' che si cuce (basi e denti), per il metro del filo
// LA COPERTURA, tenuta aggiornata mentre si cuce: celle da 0,5 mm entro 0,75 mm da un filo. Serve al
// metro finale e al rammendo per famiglia.
const G = 0.5;
const GW = Math.ceil(WM / G) + 1, GH = Math.ceil(HM / G) + 1;
const cop = new Uint8Array(GW * GH);
const RF = Math.ceil(0.75 / G);
const cuci = (seg: Point[]): void => {
  cucito.push(seg);
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1], b = seg[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / G));
    for (let k = 0; k <= n; k++) {
      const cx = Math.round((a.x + ((b.x - a.x) * k) / n) / G), cy = Math.round((a.y + ((b.y - a.y) * k) / n) / G);
      for (let dy = -RF; dy <= RF; dy++) for (let dx = -RF; dx <= RF; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < GW && y < GH && dx * dx + dy * dy <= RF * RF) cop[y * GW + x] = 1; }
    }
  }
};

// --- 3. geometria ------------------------------------------------------------------------------------------
/**
 * LE FORCINE: dove una curva di livello gira attorno a una cresta della distanza (due fronti che si
 * incontrano) i due bracci stanno a pochi decimi l'uno dall'altro, e la lisciatura li schiacciava in
 * una base sola che passa due volte e non arriva al bordo. Qui la catena si spezza dove la direzione
 * gira di piu' di 100 gradi nel giro di 2 mm: ogni braccio diventa una base sua, che finisce alla cresta.
 */
/** I COLORI SI STABILIZZANO lungo una base: una tinta che dura meno di `min` punti (2 mm) non spezza
 *  la linea, prende il colore del tratto che la precede (o che la segue, in testa). Senza, ogni
 *  striscia di una cella al confine fra due colori faceva un tratto di base da due punti: 2800
 *  tratti sotto 1,5 mm, ognuno coi suoi denti. */
function stabilizza(cols: number[], min: number): number[] {
  const out = cols.slice();
  let i = 0;
  while (i < out.length) {
    let j = i;
    while (j < out.length && out[j] === out[i]) j++;
    if (j - i < min) {
      const prima = i > 0 ? out[i - 1] : j < out.length ? out[j] : out[i];
      for (let k = i; k < j; k++) out[k] = prima;
    }
    i = j;
  }
  return out;
}
const lunghezza = (l: Point[]): number => { let t = 0; for (let i = 1; i < l.length; i++) t += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); return t; };
function spezzaAlleForcine(l: Point[], passo: number): Point[][] {
  const w = Math.max(1, Math.round(2 / passo));
  const out: Point[][] = [];
  let da = 0;
  for (let i = w; i + w < l.length; i++) {
    const ax = l[i].x - l[i - w].x, ay = l[i].y - l[i - w].y, bx = l[i + w].x - l[i].x, by = l[i + w].y - l[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    if ((ax * bx + ay * by) / (la * lb) < Math.cos((100 * Math.PI) / 180)) { out.push(l.slice(da, i + 1)); da = i; i += w; }
  }
  out.push(l.slice(da));
  return out;
}
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
  // I CAPI: la linea si prolunga per riflessione (punto per punto attorno al capo) prima di lisciarla,
  // cosi' il capo resta dov'e'. Con l'indice bloccato al capo la media lo tirava indietro di ~0,4 sigma:
  // con sigma = 1,5 + 0,15·d, a 40 mm dal muro le basi finivano 3 mm prima del bordo (striscia nuda).
  const n = l.length, p0 = l[0], pn = l[n - 1];
  const est = (i: number): Point => {
    if (i < 0) { const q = l[Math.min(n - 1, -i)]; return { x: 2 * p0.x - q.x, y: 2 * p0.y - q.y }; }
    if (i >= n) { const q = l[Math.max(0, 2 * (n - 1) - i)]; return { x: 2 * pn.x - q.x, y: 2 * pn.y - q.y }; }
    return l[i];
  };
  return l.map((_, i) => {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -raggio; k <= raggio; k++) {
      const q = est(i + k);
      sx += q.x * pesi[k + raggio]; sy += q.y * pesi[k + raggio]; sw += pesi[k + raggio];
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
let rammendi = 0;
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
  if (process.env.FAMIGLIE) {
    const tot = unioni.reduce((a, r) => a + r.areaMm2, 0);
    const xs = u.outer.map((q) => q.x + ORIG), ys = u.outer.map((q) => q.y + ORIG);
    console.log(`  famiglia ${fi} ${f.nome}: ${unioni.length} pezzi, il maggiore ${u.areaMm2.toFixed(0)} mm² su ${tot.toFixed(0)} (${((u.areaMm2 / tot) * 100).toFixed(0)}%), bbox ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)} × ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)}, altri: ${unioni.slice(1, 6).map((r) => r.areaMm2.toFixed(0)).join(' ')}`);
  }
  u.outer = u.outer.map((p) => ({ x: p.x + ORIG, y: p.y + ORIG }));   // traceRegions conta dall'angolo della griglia
  const dentroFamStretto = (p: Point): boolean => { const i = cella(p); return i >= 0 && famDi[i] === fi; };
  // «dentro» con lo sconfinamento: la cella e' della famiglia, o lo e' una cella entro SCONFINA_MM
  let dentroFam = (p: Point): boolean => dentroFamStretto(p);   // viene rimpiazzata dalla maschera allargata piu' sotto

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
    if (dentroFamStretto({ x: p.x + nx * 1, y: p.y + ny * 1 })) { nx = -nx; ny = -ny; }   // stretto: il margine qui direbbe «dentro» da tutte e due le parti
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
  // IL BORDO DEL PANNELLO NON E' UN MURO: il taglio del pannello non dice da dove viene la luce. Se il
  // tratto chiaro girava l'angolo e correva lungo il bordo, da li' partiva un secondo fronte di
  // livelli che incontrava il primo su una cresta diagonale: forcine, V, basi che passano due volte.
  const sulBordoPannello = (q: Point): boolean => q.x < 1 || q.y < 1 || q.x > WM - 1 || q.y > HM - 1;
  let tratto = unaSolaTinta ? null : cerca((i) => dentroCol[i] === chiaro && !sulBordoPannello(anello[i]));
  if (!tratto || tratto[1] < 6) tratto = unaSolaTinta ? null : cerca((i) => dentroCol[i] === chiaro);
  if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) {
    const rx = Math.cos((RIFERIMENTO_DEG * Math.PI) / 180), ry = Math.sin((RIFERIMENTO_DEG * Math.PI) / 180);
    tratto = cerca((i) => normali[i].x * rx + normali[i].y * ry >= 0);
    if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) { famSaltate++; return; }
  }
  // IL MURO SI SPEZZA AGLI ANGOLI NETTI e si tiene il tratto piu' lungo: negli spicchi della sfera il
  // tratto chiaro era a L (arco + lato radiale), e uno spostamento lungo la sua normale media andava a
  // 45 gradi. Un angolo e' netto se la direzione gira di piu' di 60 gradi nel giro di 3 mm (6 punti).
  {
    const [s0, sl] = tratto;
    const w = 3;
    let da = 0, best: [number, number] = [s0, sl];
    let bestLen = 0;
    const dir = (k: number): Point => { const a = anello[(s0 + Math.max(0, k - w)) % n], b = anello[(s0 + Math.min(sl - 1, k + w)) % n]; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
    const tagli: number[] = [];
    for (let k = w; k + w < sl; k++) { const p1 = dir(k - w), p2 = dir(k + w); if (p1.x * p2.x + p1.y * p2.y < Math.cos(Math.PI / 3)) { tagli.push(k); k += w; } }
    bestLen = 0;
    for (const t of [...tagli, sl]) { if (t - da > bestLen) { bestLen = t - da; best = [(s0 + da) % n, t - da]; } da = t; }
    if (tagli.length && bestLen >= 6) tratto = best;
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
  // LA MASCHERA ALLARGATA di SCONFINA_MM: la distanza e i livelli si calcolano qui, cosi' le linee
  // sconfinano davvero (col margine applicato solo al taglio, le linee finivano comunque al bordo:
  // il metro non si muoveva, 2,4% prima e dopo).
  const largo = new Uint8Array(COLS * ROWS);
  {
    const rc = Math.max(0, Math.round(SCONFINA_MM / CELLA));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!maschera[i]) continue;
      largo[i] = 1;
      if (!rc) continue;
      const bordo = (c > 0 && !maschera[i - 1]) || (c + 1 < COLS && !maschera[i + 1]) || (r > 0 && !maschera[i - COLS]) || (r + 1 < ROWS && !maschera[i + COLS]);
      if (!bordo) continue;
      for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
        if (dx * dx + dy * dy > rc * rc) continue;
        const x = c + dx, y = r + dy;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) largo[y * COLS + x] = 1;   // anche fuori dal disegno: oltre il bordo del pannello e nelle fessure
      }
    }
  }
  // LA FASCIA ESTESA per spianare: la media mobile ai bordi di `largo` era storta (solo celle da
  // una parte), i livelli nel margine si spostavano e il bordo del pannello tornava nudo. D si
  // prolunga e si spiana su una fascia piu' larga del raggio di spianatura; i livelli restano su `largo`.
  const esteso = new Uint8Array(COLS * ROWS);
  {
    const rc = Math.round(SPIANA_MM / CELLA) + 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!largo[i]) continue;
      esteso[i] = 1;
      const bordo = (c > 0 && !largo[i - 1]) || (c + 1 < COLS && !largo[i + 1]) || (r > 0 && !largo[i - COLS]) || (r + 1 < ROWS && !largo[i + COLS]);
      if (!bordo) continue;
      for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
        if (dx * dx + dy * dy > rc * rc) continue;
        const x = c + dx, y = r + dy;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) esteso[y * COLS + x] = 1;
      }
    }
  }
  const nelLargo = (p: Point): boolean => { const i = cella(p); return i >= 0 && largo[i] === 1; };
  dentroFam = nelLargo;
  // la tinta della cella della famiglia piu' vicina, per chi sta nel margine
  const tintaVicina = (p: Point): number => {
    const c0 = Math.round((p.x - ORIG) / CELLA), r0 = Math.round((p.y - ORIG) / CELLA);
    const rMax = Math.round(SCONFINA_MM / CELLA) + 2;
    for (let rr = 1; rr <= rMax; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      const c = c0 + dx, r = r0 + dy;
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS && famDi[r * COLS + c] === fi) return tinta[r * COLS + c];
    }
    return -1;
  };
  const INF = 1e9;
  const D = new Float32Array(COLS * ROWS).fill(INF);
  for (const p of ricampiona(As, CELLA / 2)) { const i = cella(p); if (i >= 0) D[i] = 0; }
  for (let i = 0; i < COLS * ROWS; i++) if (D[i] === 0 && !largo[i]) {
    // il muro sta sul bordo: si sposta il seme sulla cella della famiglia piu' vicina
    for (const j of [i - 1, i + 1, i - COLS, i + COLS, i - COLS - 1, i - COLS + 1, i + COLS - 1, i + COLS + 1]) if (j >= 0 && j < COLS * ROWS && largo[j]) D[j] = 0;
    D[i] = INF;
  }
  const V: Array<[number, number, number]> = [[-1, 0, CELLA], [0, -1, CELLA], [-1, -1, CELLA * 1.4], [1, -1, CELLA * 1.4], [-2, -1, CELLA * 2.2], [-1, -2, CELLA * 2.2], [1, -2, CELLA * 2.2], [2, -1, CELLA * 2.2]];
  const mio = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < COLS && r < ROWS && largo[r * COLS + c] === 1;
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
  // LA FASCIA DI SCONFINAMENTO NON E' UN CORRIDOIO. Il chamfer misurava la distanza anche nella
  // fascia oltre il bordo, ma la fascia e' un vicolo cieco largo 2,5 mm: la si raggiunge solo dal
  // bordo, quindi D vi risaliva e i livelli ci facevano una forcina (sondato al bordo sinistro:
  // D=61,0 sul bordo, 61,5 a 2,5 mm fuori E a 2,5 mm dentro). La lisciatura, con sigma di 10 mm,
  // schiacciava la forcina e la base finiva 3 mm prima del bordo. Qui, nella fascia, D si
  // PROLUNGA LINEARMENTE dalla cella della famiglia piu' vicina col suo gradiente: la linea esce
  // dritta, come arriva.
  {
    const src = new Int32Array(COLS * ROWS).fill(-1);
    const coda: number[] = [];
    const grad = (q: number): [number, number] => {
      const c = q % COLS, r = Math.floor(q / COLS);
      const st = (cc: number, rr: number): boolean => cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && maschera[rr * COLS + cc] === 1 && D[rr * COLS + cc] < INF;
      let gx = 0, gy = 0;
      if (st(c + 1, r) && st(c - 1, r)) gx = (D[q + 1] - D[q - 1]) / (2 * CELLA);
      else if (st(c + 1, r)) gx = (D[q + 1] - D[q]) / CELLA;
      else if (st(c - 1, r)) gx = (D[q] - D[q - 1]) / CELLA;
      if (st(c, r + 1) && st(c, r - 1)) gy = (D[q + COLS] - D[q - COLS]) / (2 * CELLA);
      else if (st(c, r + 1)) gy = (D[q + COLS] - D[q]) / CELLA;
      else if (st(c, r - 1)) gy = (D[q] - D[q - COLS]) / CELLA;
      return [gx, gy];
    };
    const gradienti = new Map<number, [number, number]>();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (!maschera[i] || D[i] >= INF) continue;
      const fuori = (c > 0 && esteso[i - 1] && !maschera[i - 1]) || (c + 1 < COLS && esteso[i + 1] && !maschera[i + 1]) || (r > 0 && esteso[i - COLS] && !maschera[i - COLS]) || (r + 1 < ROWS && esteso[i + COLS] && !maschera[i + COLS]);
      if (fuori) { src[i] = i; coda.push(i); gradienti.set(i, grad(i)); }
    }
    for (let k = 0; k < coda.length; k++) {
      const cur = coda[k], q = src[cur];
      const [gx, gy] = gradienti.get(q)!;
      const qc = q % COLS, qr = Math.floor(q / COLS), cc = cur % COLS, cr = Math.floor(cur / COLS);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cc + dx, y = cr + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const n = y * COLS + x;
        if (!esteso[n] || maschera[n] || src[n] >= 0) continue;
        src[n] = q;
        D[n] = Math.max(0, D[q] + gx * (x - qc) * CELLA + gy * (y - qr) * CELLA);
        coda.push(n);
      }
    }
  }
  const D0 = new Float32Array(D);   // la distanza prima della spianatura: da qui parte la crescita
  // D SI SPIANA, solo sulle celle della fascia larga: media mobile separabile di raggio SPIANA_MM,
  // tre passate (quasi una gaussiana di sigma ~ raggio/1,2). Serve a due cose: il chamfer e' a
  // gradini (somme di 0,5/0,7/1,1) e i suoi livelli uscivano doppi; e le creste fra due fronti
  // diventano dorsi tondi invece di spigoli. Le somme prefissate per riga/colonna lo rendono O(N).
  {
    const rc = Math.max(1, Math.round(SPIANA_MM / CELLA));
    const S = new Float64Array(Math.max(COLS, ROWS) + 1), C = new Int32Array(Math.max(COLS, ROWS) + 1);
    const E = new Float32Array(COLS * ROWS);
    const passata = (lungoRighe: boolean): void => {
      const n = lungoRighe ? COLS : ROWS, m = lungoRighe ? ROWS : COLS;
      for (let k = 0; k < m; k++) {
        const at = (t: number): number => (lungoRighe ? k * COLS + t : t * COLS + k);
        S[0] = 0; C[0] = 0;
        for (let t = 0; t < n; t++) { const i = at(t); const ok = esteso[i] && D[i] < INF; S[t + 1] = S[t] + (ok ? D[i] : 0); C[t + 1] = C[t] + (ok ? 1 : 0); }
        for (let t = 0; t < n; t++) {
          const i = at(t);
          if (!esteso[i] || D[i] >= INF) { E[i] = D[i]; continue; }
          const a = Math.max(0, t - rc), b = Math.min(n, t + rc + 1);
          const cnt = C[b] - C[a];
          E[i] = cnt ? (S[b] - S[a]) / cnt : D[i];
        }
      }
      D.set(E);
    };
    for (let giro = 0; giro < 3; giro++) { passata(true); passata(false); }
  }
  let dMax = 0;
  for (let i = 0; i < COLS * ROWS; i++) if (largo[i] && D[i] < INF && D[i] > dMax) dMax = D[i];
  if (process.env.PROBE) {
    const [px, py] = process.env.PROBE.split(',').map(Number);
    const ip = cella({ x: px, y: py });
    if (ip >= 0 && famDi[ip] === fi) {
      const riga: string[] = [];
      for (let x = px - 4; x <= px + 5; x += CELLA) { const i = cella({ x, y: py }); riga.push(`x=${x.toFixed(1)}:${i < 0 ? '-' : `m${maschera[i]}l${largo[i]}f${famDi[i]}D${D[i] < INF ? D[i].toFixed(1) : 'inf'}`}`); }
      console.log(`SONDA famiglia ${fi}: ${riga.join(' ')}`);
      for (let y = py - 6; y <= py + 4; y += CELLA) {
        const r: string[] = [];
        for (let x = px - 2; x <= px + 8; x += CELLA) { const i = cella({ x, y }); r.push(i < 0 ? '   -  ' : !largo[i] ? '   .  ' : (D[i] < INF ? D[i].toFixed(1) : 'inf').padStart(5) + (maschera[i] ? ' ' : '*')); }
        console.log(`  y=${y.toFixed(1).padStart(6)} ${r.join('')}`);
      }
    }
  }
  let versoFisso: Point | null = null;   // nel modo a traslazione i denti vanno tutti contro il verso dello spostamento
  const gradVersoA = (p: Point): Point => {
    if (versoFisso) return versoFisso;
    const i = cella(p);
    if (i < 0) return { x: 0, y: 0 };
    const g = (j: number): number => (j >= 0 && j < COLS * ROWS && largo[j] && D[j] < INF ? D[j] : D[i]);
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
        if (famIn(qq) === famiglia || dentroFam(qq)) continue;
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
    if (punti.length >= 3) { perColoreDenti[col].push(via(punti)); cuci(punti); }
    for (const [c, l] of puntiSotto) if (l.length >= 3) perColoreDenti[c].push(via(l));
  };

  // I LIVELLI, uno ogni passo, ognuno addolcito in proporzione alla distanza
  // Un livello: si estrae su una maschera, si incatena, si spezza alle forcine, si liscia, si colora.
  // I SEGMENTI NULLI: dove D vale esattamente d su un angolo di cella (succede ogni 2,5 mm: il
  // chamfer somma multipli di 0,5) il marching squares emette un segmento di lunghezza zero, e la
  // catena si spezzava li'. Le basi finivano 3 mm prima del bordo: era questo, non la lisciatura.
  // Il livello si estrae un pelo (0,0137 mm) sopra il valore tondo: i valori del chamfer sono
  // somme di 0,5/0,7/1,1 e finivano ESATTAMENTE sui livelli, con tre o quattro segmenti che si
  // toccavano in un angolo e la catena che sceglieva quello sbagliato.
  const tiraLivello = (d: number, su: Uint8Array): void => {
    const segmenti = livello(D, su, COLS, ROWS, ORIG, ORIG, CELLA, d + 0.0137).filter((sg) => Math.hypot(sg.b.x - sg.a.x, sg.b.y - sg.a.y) > 1e-6);
    tiraLinee(incatena(segmenti, CELLA * 1.5), d);
  };
  const tiraLinee = (linee: Point[][], d: number, sigma?: number): void => {
    idLivello++;
    for (const linea of linee) {
      if (linea.length < 3) continue;
      for (const pezzo of process.env.NO_FORCINE ? [ricampiona(linea, 0.5)] : spezzaAlleForcine(ricampiona(linea, 0.5), 0.5)) {
      if (pezzo.length < 4) continue;
      // il tetto alla lisciatura: a 140 mm dal muro sigma faceva 22 mm e un gomito dei livelli
      // diventava un arco largo, che tagliava l'angolo lasciandolo nudo (sondato a (112,250))
      const sg = sigma ?? Math.min(LISCIA_MAX, LISCIA_MM + ADDOLCISCI * d);
      const morbida = sg > 0 ? liscia(pezzo, sg, 0.5) : pezzo;
      let cur: Point[] = [], curCol = -2;
      const chiudi = (): void => {
        if (cur.length >= 2 && curCol >= 0 && lunghezza(cur) >= 1.5) {
          perColore[curCol].push(via(cur)); const copia = cur.slice(); lineeFinali.push({ id: idLivello, punti: copia }); cuci(copia);
          if (DENTI) pettina(cur, curCol, fi, idLivello);
        }
        cur = []; curCol = -2;
      };
      // il colore punto per punto, poi stabilizzato. Sconfinando, il colore resta quello della
      // famiglia: si prende dalla cella piu' vicina che e' sua (un livello che corre tutto nel
      // margine, oltre il bordo del pannello, non ne tocca nessuna).
      const grezzi: number[] = [];
      for (let i = 0; i < morbida.length; i++) {
        const p = morbida[i];
        const prec = grezzi.length ? grezzi[grezzi.length - 1] : -1;
        grezzi.push(dentroFamStretto(p) ? tintaIn(p) : dentroFam(p) ? (prec >= 0 ? prec : tintaVicina(p)) : -1);
      }
      const colori = stabilizza(grezzi, 4);
      for (let i = 0; i < morbida.length; i++) {
        const p = morbida[i];
        const col = colori[i];
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
  };
  // LA TRASLAZIONE (prova chiesta da Lorenzo, 2026-09-09, sulla sfera): «non fare la fusione tra due
  // muri, prendi solo quello piu' chiaro e fai lo spostamento senza alterare la forma della curva,
  // solamente tagliandola dove finisce la forma». Il muro chiaro, prolungato dritto ai due capi, si
  // sposta di un passo alla volta lungo la sua normale media (verso l'interno): ogni copia e'
  // identica, si taglia dove esce dal blocco (con lo sconfinamento) e dove corre a meno di 30 gradi
  // dal verso dello spostamento (li' le copie si accavallerebbero). I denti vanno tutti contro lo
  // spostamento, cioe' verso il muro chiaro. Vale per le famiglie fino a TRASLA_MAX_MM2 (i blocchi
  // della sfera); le fasce grandi restano come prima.
  if (u.areaMm2 <= TRASLA_MAX_MM2) {
    const base = ricampiona(As, 0.5);
    // la normale media, verso l'interno della famiglia
    let ux = 0, uy = 0;
    for (let i = 1; i + 1 < base.length; i++) {
      const tx = base[i + 1].x - base[i - 1].x, ty = base[i + 1].y - base[i - 1].y;
      const l = Math.hypot(tx, ty) || 1;
      let nx = -ty / l, ny = tx / l;
      if (!dentroFamStretto({ x: base[i].x + nx * 1.5, y: base[i].y + ny * 1.5 }) && dentroFamStretto({ x: base[i].x - nx * 1.5, y: base[i].y - ny * 1.5 })) { nx = -nx; ny = -ny; }
      ux += nx; uy += ny;
    }
    const lu = Math.hypot(ux, uy) || 1; ux /= lu; uy /= lu;
    versoFisso = { x: -ux, y: -uy };
    // il muro prolungato dritto ai due capi
    const est = (a: Point, b: Point, L: number): Point[] => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; const out: Point[] = []; for (let t = L; t > 0; t -= 0.5) out.push({ x: b.x + ((b.x - a.x) / l) * t, y: b.y + ((b.y - a.y) / l) * t }); return out; };
    const n = base.length, L = 300;
    const lunga = [...est(base[Math.min(n - 1, 6)], base[0], L), ...base, ...est(base[Math.max(0, n - 7)], base[n - 1], L).reverse()];
    // dove la curva corre quasi lungo lo spostamento le copie si accavallano (distanza fra due copie =
    // passo × sin dell'angolo): li' si tiene una copia ogni tante, cosi' la distanza torna ~ un passo.
    // Toglierle e basta lasciava una colonna nuda (visto nel blocco in alto a destra della sfera).
    const ogni: number[] = lunga.map((_, i) => {
      const a = lunga[Math.max(0, i - 2)], b = lunga[Math.min(lunga.length - 1, i + 2)];
      const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
      const sin = Math.sqrt(Math.max(0, 1 - ((tx * ux + ty * uy) / l) ** 2));
      return sin >= 0.5 ? 1 : Math.min(10, Math.round(1 / Math.max(0.1, sin)));
    });
    for (let k = 0; k < 400; k++) {
      const d = k * BASI_MM + BASI_MM / 2;
      const linee: Point[][] = [];
      let cur: Point[] = [], viva = false;
      for (let i = 0; i < lunga.length; i++) {
        const q = { x: lunga[i].x + ux * d, y: lunga[i].y + uy * d };
        const ok = k % ogni[i] === 0 && nelLargo(q);
        if (ok) { cur.push(q); viva = true; } else if (cur.length) { linee.push(cur); cur = []; }
      }
      if (cur.length) linee.push(cur);
      if (!viva) { if (k > 2) break; else continue; }
      tiraLinee(linee, d, 0);
    }
  } else if (process.env.MODO === 'livelli') {
    for (let d = BASI_MM / 2; d < dMax; d += BASI_MM) tiraLivello(d, largo);
  } else {
    // LA CRESCITA A PASSO FISSO. Lorenzo (2026-09-09): «nei punti in cui hai allentato la curva la
    // densita' non e' omogenea e si allarga nella curvatura, li' non deve succedere. La densita' deve
    // rimanere la stessa». Le curve di livello di una distanza spianata si allargano per forza dove
    // la spianatura ha abbassato la pendenza. Qui invece la regione raggiunta cresce di UN PASSO
    // esatto a ogni giro (dilatazione), e solo dopo si arrotondano le sue insenature (chiusura
    // morfologica di raggio CHIUDI_MM): la linea nuova sta a un passo dalla precedente ovunque,
    // tranne nell'insenatura riempita, che coprono i denti (verso il chiaro, cioe' verso di essa).
    // La linea e' il bordo della regione verso le celle non ancora raggiunte.
    const R = new Uint8Array(COLS * ROWS);
    let dentroR = 0, tot = 0;
    // (dalla distanza NON spianata: spianata, vicino al muro D sale sopra il mezzo passo e la regione
    // di partenza restava vuota - 9 famiglie su 19 senza una linea)
    for (let i = 0; i < COLS * ROWS; i++) if (largo[i]) { tot++; if (D0[i] < INF && D0[i] <= BASI_MM / 2) { R[i] = 1; dentroR++; } }
    const raggioCelle = (mm: number): number => Math.max(1, Math.round(mm / CELLA));
    const disco = (rc: number): Array<[number, number]> => { const out: Array<[number, number]> = []; for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) if (dx * dx + dy * dy <= rc * rc + 0.25) out.push([dx, dy]); return out; };
    // dilata `M` di rc celle, restando in `largo`; i semi sono le celle di M con un vicino fuori da M
    const dilata = (M: Uint8Array, rc: number): Uint8Array => {
      const out = new Uint8Array(M);
      const dd = disco(rc);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!M[i]) continue;
        if ((c > 0 && !M[i - 1] && largo[i - 1]) || (c + 1 < COLS && !M[i + 1] && largo[i + 1]) || (r > 0 && !M[i - COLS] && largo[i - COLS]) || (r + 1 < ROWS && !M[i + COLS] && largo[i + COLS])) {
          for (const [dx, dy] of dd) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && largo[y * COLS + x]) out[y * COLS + x] = 1; }
        }
      }
      return out;
    };
    // erode `M` di rc celle: via le celle di M entro rc da una cella di largo fuori da M (fuori da largo non conta)
    const erodi = (M: Uint8Array, rc: number): Uint8Array => {
      const out = new Uint8Array(M);
      const dd = disco(rc);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (M[i] || !largo[i]) continue;
        if ((c > 0 && M[i - 1]) || (c + 1 < COLS && M[i + 1]) || (r > 0 && M[i - COLS]) || (r + 1 < ROWS && M[i + COLS])) {
          for (const [dx, dy] of dd) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) out[y * COLS + x] = 0; }
        }
      }
      return out;
    };
    const passoCelle = raggioCelle(BASI_MM);
    let giro = 0;
    let Rk = R;
    while (dentroR < tot && giro < 400) {
      giro++;
      const d = (giro + 0.5) * BASI_MM;
      let Rn = dilata(Rk, passoCelle);
      const rChiudi = raggioCelle(Math.min(LISCIA_MAX, CHIUDI_MM + ADDOLCISCI * d));
      if (rChiudi > 0) { const chiusa = erodi(dilata(Rn, rChiudi), rChiudi); for (let i = 0; i < COLS * ROWS; i++) if (chiusa[i]) Rn[i] = 1; }
      // il fronte: i bordi della regione che guardano celle di largo non ancora raggiunte
      const regioni = traceRegions(Rn, COLS, ROWS, 1, CELLA, { minAreaMm2: 0.5, simplifyMm: 0.3 });
      const linee: Point[][] = [];
      const guardaFuori = (p: Point): boolean => {
        const c = Math.round((p.x - ORIG) / CELLA), r = Math.round((p.y - ORIG) / CELLA);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { const j = y * COLS + x; if (largo[j] && !Rn[j]) return true; } }
        return false;
      };
      for (const reg of regioni) for (const anello of [reg.outer, ...reg.holes]) {
        const pts = ricampiona([...anello, anello[0]].map((q) => ({ x: q.x + ORIG, y: q.y + ORIG })), 0.5);
        // si taglia il giro in tratti che guardano fuori
        let cur: Point[] = [];
        const tratti: Point[][] = [];
        for (const q of pts) { if (guardaFuori(q)) cur.push(q); else { if (cur.length >= 3) tratti.push(cur); cur = []; } }
        if (cur.length >= 3) tratti.push(cur);
        // se il giro e' tutto fronte, primo e ultimo tratto sono lo stesso: si uniscono
        if (tratti.length >= 2 && guardaFuori(pts[0]) && guardaFuori(pts[pts.length - 1])) { const ultimo = tratti.pop()!; tratti[0] = [...ultimo, ...tratti[0]]; }
        for (const t of tratti) linee.push(t);
      }
      tiraLinee(linee, d);
      let n = 0;
      for (let i = 0; i < COLS * ROWS; i++) if (Rn[i]) n++;
      if (n === dentroR) break;   // non cresce piu' (regione chiusa da qualche parte): basta
      dentroR = n; Rk = Rn;
    }
    if (process.env.FAMIGLIE) console.log(`  famiglia ${fi}: ${giro} giri, raggiunto ${((dentroR / tot) * 100).toFixed(1)}% di largo, dMax ${dMax.toFixed(0)}`);
  }

  // IL RAMMENDO. Dopo i livelli (e i loro denti) si guarda cosa della famiglia e' rimasto a piu' di
  // 0,75 mm da qualunque filo: ogni macchia nuda di almeno 2 mm² riceve un livello in piu', quello
  // che passa per il suo centro (la mediana di D sulla macchia), limitato a un intorno della macchia.
  // E' un livello come gli altri, coi denti verso il chiaro. Copre qualunque causa - gli apici delle U
  // sui dorsi spianati, un gomito, un capo che arriva corto - senza dover indovinare quale.
  if (DENTI) for (let giro = 0; giro < 2; giro++) {
    const visto = new Uint8Array(GW * GH);
    const toppa = new Uint8Array(COLS * ROWS);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const g0 = gy * GW + gx;
      if (visto[g0] || cop[g0]) continue;
      const p0 = { x: gx * G, y: gy * G };
      if (famIn(p0) !== fi) continue;
      // la macchia nuda, a 4 vicini, dentro la famiglia
      const macchia: number[] = [g0];
      visto[g0] = 1;
      for (let h = 0; h < macchia.length; h++) {
        const g = macchia[h], x = g % GW, y = Math.floor(g / GW);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
          const gg = yy * GW + xx;
          if (visto[gg] || cop[gg] || famIn({ x: xx * G, y: yy * G }) !== fi) continue;
          visto[gg] = 1; macchia.push(gg);
        }
      }
      if (macchia.length * G * G < 2) continue;
      const valori: number[] = [];
      const celle: number[] = [];
      for (const g of macchia) { const i = cella({ x: (g % GW) * G, y: Math.floor(g / GW) * G }); if (i >= 0 && largo[i] && D[i] < INF) { valori.push(D[i]); celle.push(i); } }
      if (!valori.length) continue;
      valori.sort((a, b) => a - b);
      const dMed = valori[Math.floor(valori.length / 2)];
      const rt = Math.round(2 / CELLA);
      const toccate: number[] = [];
      for (const i of celle) { const c = i % COLS, r = Math.floor(i / COLS); for (let dy = -rt; dy <= rt; dy++) for (let dx = -rt; dx <= rt; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && largo[y * COLS + x] && !toppa[y * COLS + x]) { toppa[y * COLS + x] = 1; toccate.push(y * COLS + x); } } }
      tiraLivello(dMed, toppa);
      rammendi++;
      for (const i of toccate) toppa[i] = 0;
    }
  }

  // L'ULTIMA BASE LUNGO IL MURO BLU (spenta di default, vedi ULTIMA_BASE). I denti vanno verso il chiaro, cioe' via dal blu: la striscia
  // fra l'ultimo livello e il blu non la copre nessun dente, e fra due famiglie il canale nudo si
  // raddoppia (Lorenzo: «tanti buchi, anche tra due gruppi diversi»). Qui una base corre lungo il
  // blu a mezzo passo dentro, SOLO dove la distanza dal muro rosso supera l'ultimo livello di piu'
  // di 3/4 di passo, coi denti verso il chiaro come tutte le altre: nessuna seconda direzione.
  if (ULTIMA_BASE) {
    idLivello++;
    const nB = ricampiona([...B], 0.5);
    const grezza: Point[] = [], tieni: boolean[] = [];
    for (let i = 0; i < nB.length; i++) {
      const a = nB[Math.max(0, i - 1)], c = nB[Math.min(nB.length - 1, i + 1)];
      let nx = c.y - a.y, ny = -(c.x - a.x);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const b = nB[i];
      if (!dentroFamStretto({ x: b.x + nx * 1, y: b.y + ny * 1 })) { nx = -nx; ny = -ny; }
      const p = { x: b.x + nx * (BASI_MM / 2), y: b.y + ny * (BASI_MM / 2) };
      grezza.push(p);
      const ci = cella(p);
      const dist = ci >= 0 && famDi[ci] === fi ? D[ci] : INF;
      const ultimoLivello = dist < INF ? (Math.floor(dist / BASI_MM - 0.5) + 0.5) * BASI_MM : 0;
      tieni.push(dist < INF && dist - ultimoLivello > BASI_MM * 0.75);
    }
    const morbida = liscia(grezza, LISCIA_MM, 0.5);
    let cur: Point[] = [], curCol = -2;
    const chiudi = (): void => {
      if (cur.length >= 2 && curCol >= 0 && lunghezza(cur) >= 1.5) { perColore[curCol].push(via(cur)); const copia = cur.slice(); lineeFinali.push({ id: idLivello, punti: copia }); cuci(copia); if (DENTI) pettina(cur, curCol, fi, idLivello); }
      cur = []; curCol = -2;
    };
    // qui la base sta a mezzo passo dentro: ha sempre una tinta
    const colori = stabilizza(morbida.map((p, i) => (tieni[i] && dentroFam(p) ? tintaIn(p) : -1)), 4);
    for (let i = 0; i < morbida.length; i++) {
      const p = morbida[i];
      const col = colori[i];
      if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
      if (col >= 0) cur.push(p);
    }
    chiudi();
  }
});
{
  const lung = lineeFinali.map((l) => { let t = 0; for (let i = 1; i < l.punti.length; i++) t += Math.hypot(l.punti[i].x - l.punti[i - 1].x, l.punti[i].y - l.punti[i - 1].y); return t; });
  const corte = lung.filter((v) => v < 5).length, tot = lung.reduce((a, b) => a + b, 0);
  const cortissime = lung.filter((v) => v < 1.5).length;
  console.log(`  tratti sotto 1,5 mm: ${cortissime}`);
  if (process.env.MAPPA) {
    // dove stanno i tratti corti (sotto 5 mm): una mappa a celle di 8 mm
    const MW = Math.ceil(WM / 8), MH = Math.ceil(HM / 8);
    const m = new Uint16Array(MW * MH);
    lineeFinali.forEach((l, k) => { if (lung[k] < 5) { const q = l.punti[0]; const mx = Math.min(MW - 1, Math.max(0, Math.floor(q.x / 8))), my = Math.min(MH - 1, Math.max(0, Math.floor(q.y / 8))); m[my * MW + mx]++; } });
    const righe: string[] = [];
    for (let my = 0; my < MH; my++) { let r = ''; for (let mx = 0; mx < MW; mx++) { const v = m[my * MW + mx]; r += v === 0 ? '.' : v < 3 ? ':' : v < 8 ? 'o' : '#'; } righe.push(r); }
    console.log('TRATTI CORTI (celle 8 mm):' + String.fromCharCode(10) + righe.join(String.fromCharCode(10)));
  }
  console.log(`  rammendi: ${rammendi} livelli in piu' sulle macchie nude`);
  console.log(`${famOk} famiglie, ${famSaltate} saltate · ${lineeFinali.length} tratti di base (${corte} sotto i 5 mm) · ${(tot / 1000).toFixed(1)} m di basi · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// --- 5. il metro ------------------------------------------------------------------------------------------
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
const nudiFilo: string[] = [];
if (DENTI) {
  // IL METRO DEL FILO: ogni segmento cucito (basi e denti) copre le celle entro 0,75 mm (`cop`,
  // tenuta aggiornata da `cuci`); cosa resta?
  let nudoFilo = 0, tot = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (tintaIn({ x: x * G, y: y * G }) < 0) continue; tot++; if (!cop[y * GW + x]) { nudoFilo++; nudiFilo.push(`<rect x="${(x * G).toFixed(1)}" y="${(y * G).toFixed(1)}" width="${G}" height="${G}" fill="#ff2f8f" opacity="0.7"/>`); } }
  console.log(`METRO DEL FILO: ${((nudoFilo / tot) * 100).toFixed(1)}% del pannello a piu' di 0,75 mm da qualunque filo`);
  if (process.env.MAPPA) {
    // QUANTO FILO per cella di 8 mm (basi + denti), in mm/mm²: dove si accumula?
    const MW = Math.ceil(WM / 8), MH = Math.ceil(HM / 8);
    const filo = new Float64Array(MW * MH);
    for (const seg of cucito) for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1], b = seg[i];
      const mx = Math.floor(((a.x + b.x) / 2) / 8), my = Math.floor(((a.y + b.y) / 2) / 8);
      if (mx < 0 || my < 0 || mx >= MW || my >= MH) continue;   // il margine fuori dal pannello non si conta
      filo[my * MW + mx] += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const dens = Array.from(filo).map((v) => v / 64);
    const ord = dens.filter((v) => v > 0).sort((a, b) => a - b);
    const med = ord[Math.floor(ord.length / 2)], q90 = ord[Math.floor(ord.length * 0.9)], q10 = ord[Math.floor(ord.length * 0.1)];
    const righe: string[] = [];
    for (let my = 0; my < MH; my++) { let r = ''; for (let mx = 0; mx < MW; mx++) { const v = dens[my * MW + mx]; r += v === 0 ? ' ' : v < med * 0.7 ? '.' : v < med * 1.3 ? ':' : v < med * 1.7 ? 'o' : '#'; } righe.push(r); }
    console.log(`FILO PER CELLA (8 mm): mediana ${med.toFixed(2)} mm/mm² · 10% ${q10.toFixed(2)} · 90% ${q90.toFixed(2)} · '.' sotto 0,7x · ':' attorno · 'o' 1,3-1,7x · '#' oltre 1,7x` + String.fromCharCode(10) + righe.join(String.fromCharCode(10)));
  }
  // DOVE STANNO le celle nude: sul bordo del pannello, su una giunta fra famiglie, o dentro una famiglia?
  {
    let bordoPan = 0, giunta = 0, interno = 0;
    const R = Math.ceil(1.5 / G);
    const MW = Math.ceil(WM / 4), MH = Math.ceil(HM / 4);
    const mappa = new Uint16Array(MW * MH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const p = { x: x * G, y: y * G };
      if (tintaIn(p) < 0 || cop[y * GW + x]) continue;
      const fam = famIn(p);
      let fuori = false, altra = false;
      for (let dy = -R; dy <= R && !fuori; dy++) for (let dx = -R; dx <= R; dx++) {
        const q = { x: (x + dx) * G, y: (y + dy) * G };
        if (tintaIn(q) < 0) { fuori = true; break; }
        if (famIn(q) !== fam) altra = true;
      }
      if (fuori) bordoPan++; else if (altra) giunta++; else interno++;
      const mx = Math.min(MW - 1, Math.floor(p.x / 4)), my = Math.min(MH - 1, Math.floor(p.y / 4));
      mappa[my * MW + mx]++;
    }
    console.log(`  nude: ${bordoPan} sul bordo del pannello · ${giunta} sulle giunte fra famiglie · ${interno} dentro una famiglia (celle da 0,5 mm)`);
    if (process.env.MAPPA) {
      const righe: string[] = [];
      for (let my = 0; my < MH; my++) { let r = ''; for (let mx = 0; mx < MW; mx++) { const v = mappa[my * MW + mx]; r += v === 0 ? '.' : v < 8 ? ':' : v < 24 ? 'o' : '#'; } righe.push(r); }
      console.log(righe.join(String.fromCharCode(10)));
    }
  }
}
// UN RITAGLIO per guardare da vicino: CROP=x0,y0,x1,y1 (mm) scrive solo cio' che ci cade dentro
if (process.env.CROP) {
  const [x0, y0, x1, y1] = process.env.CROP.split(',').map(Number);
  const dentroCrop = (l: Point[]): boolean => l.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
  const basi = new Set(lineeFinali.map((l) => l.punti));
  const pb: string[] = [], pd: string[] = [];
  for (const l of cucito) if (dentroCrop(l)) (basi.has(l) ? pb : pd).push(via(l));
  const nudi = nudiFilo.filter((r) => { const m = /x="([\d.]+)" y="([\d.]+)"/.exec(r)!; const x = +m[1], y = +m[2]; return x >= x0 && x <= x1 && y >= y0 && y <= y1; });
  writeFileSync(`apps/pettine/scripts/out/${process.env.CROP_NOME ?? 'ritaglio'}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${(x1 - x0) * 8}" height="${(y1 - y0) * 8}">
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#f7f6f3"/>
<rect x="0" y="0" width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="none" stroke="#333" stroke-width="0.2" stroke-dasharray="1 0.5"/>
<g>${nudi.join('')}</g>
<path d="${process.env.SOLO_BASI ? '' : pd.join('')}" fill="none" stroke="#7a9" stroke-width="0.08"/>
<path d="${pb.join('')}" fill="none" stroke="#000" stroke-width="0.2"/>
<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.4"/>
<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.3"/>
</svg>`, 'utf8');
  console.log(`-> apps/pettine/scripts/out/${process.env.CROP_NOME ?? 'ritaglio'}.svg`);
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
writeFileSync('apps/pettine/scripts/out/verifica-livelli.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARG} ${-18 - MARG} ${(WM + 2 * MARG).toFixed(1)} ${(HM + 18 + 2 * MARG).toFixed(1)}" width="${(WM + 2 * MARG).toFixed(1)}mm" height="${(HM + 18 + 2 * MARG).toFixed(1)}mm">
<rect x="${-MARG}" y="${-18 - MARG}" width="${(WM + 2 * MARG).toFixed(1)}" height="${(HM + 18 + 2 * MARG).toFixed(1)}" fill="#faf9f7"/>
<rect x="0" y="0" width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="none" stroke="#333" stroke-width="0.3" stroke-dasharray="2 1"/>
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
  if (process.env.MOSTRA_NUDI) pz.push(`<g>${nudiFilo.join('')}</g>`);
  const nome = `pettine-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-p${PASSO_MM}-s${SORM_MM}`;
  writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARG} ${-MARG} ${(WM + 2 * MARG).toFixed(1)} ${(HM + 2 * MARG).toFixed(1)}" width="${(WM + 2 * MARG).toFixed(1)}mm" height="${(HM + 2 * MARG).toFixed(1)}mm">
<rect x="${-MARG}" y="${-MARG}" width="${(WM + 2 * MARG).toFixed(1)}" height="${(HM + 2 * MARG).toFixed(1)}" fill="#f7f6f3"/>
<rect x="0" y="0" width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="none" stroke="#333" stroke-width="0.3" stroke-dasharray="2 1"/>
${pz.join('\n')}
</svg>`, 'utf8');
  // UNA ZONA: ZONA=x0,y0,x1,y1[;x0,y0,x1,y1...] confronta basi e denti dentro rettangoli diversi
  if (process.env.ZONA) {
    const basiSet = new Set(lineeFinali.map((l) => l.punti));
    for (const z of process.env.ZONA.split(';')) {
      const [x0, y0, x1, y1] = z.split(',').map(Number);
      const area = (x1 - x0) * (y1 - y0);
      const dentroZ = (q: Point): boolean => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
      let mmBasi = 0, mmDenti = 0, nDenti = 0, nTratti = 0;
      const ids = new Set<number>();
      for (const l of cucito) {
        let mm = 0, dentro = false;
        for (let i = 1; i < l.length; i++) if (dentroZ(l[i - 1]) && dentroZ(l[i])) { mm += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); dentro = true; }
        if (!dentro) continue;
        if (basiSet.has(l)) { mmBasi += mm; nTratti++; } else { mmDenti += mm; nDenti += Math.round(l.length / 3); }
      }
      for (const { id, punti } of lineeFinali) if (punti.some(dentroZ)) ids.add(id);
      if (process.env.ZONA_DETTAGLIO) {
        const perId = new Map<number, string[]>();
        for (const { id, punti } of lineeFinali) {
          const dentro = punti.filter(dentroZ);
          if (!dentro.length) continue;
          const ys = dentro.map((q) => q.y), xs = dentro.map((q) => q.x);
          const l = perId.get(id) ?? []; l.push(`[x ${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)} y ${Math.min(...ys).toFixed(1)}-${Math.max(...ys).toFixed(1)} · ${punti.length}p da (${punti[0].x.toFixed(0)},${punti[0].y.toFixed(0)}) a (${punti[punti.length - 1].x.toFixed(0)},${punti[punti.length - 1].y.toFixed(0)})]`); perId.set(id, l);
        }
        for (const [id, l] of [...perId.entries()].slice(0, 12)) console.log(`   livello ${id}: ${l.join(' ')}`);
      }
      console.log(`ZONA ${z}: basi ${(mmBasi / area).toFixed(3)} mm/mm² in ${nTratti} tratti (${ids.size} livelli) · denti ${(mmDenti / area).toFixed(2)} mm/mm², ${(nDenti / area * 100).toFixed(1)} denti/cm², lunghi in media ${(mmDenti / Math.max(1, nDenti) / 2).toFixed(2)} mm`);
    }
  }
  // UNA SONDA: PROBE=x,y stampa cosa c'e' attorno a un punto (per capire un buco)
  if (process.env.PROBE) {
    const [px, py] = process.env.PROBE.split(',').map(Number);
    const i = cella({ x: px, y: py });
    console.log(`SONDA (${px},${py}): famiglia ${i >= 0 ? famDi[i] : '?'} tinta ${i >= 0 ? tinta[i] : '?'}`);
    const capi: string[] = [];
    for (const { punti: l } of lineeFinali) for (const q of [l[0], l[l.length - 1]]) if (Math.hypot(q.x - px, q.y - py) < 5) capi.push(`(${q.x.toFixed(1)},${q.y.toFixed(1)})`);
    console.log(`  capi di base entro 5 mm: ${capi.join(' ')}`);
    for (const { id, punti: l } of lineeFinali) {
      let b3 = 1e9;
      for (const q of l) b3 = Math.min(b3, Math.hypot(q.x - px, q.y - py));
      if (b3 < 6) console.log(`  base livello ${id}: ${l.length} punti, da (${l[0].x.toFixed(1)},${l[0].y.toFixed(1)}) a (${l[l.length - 1].x.toFixed(1)},${l[l.length - 1].y.toFixed(1)}), passa a ${b3.toFixed(1)} mm`);
    }
    let best = 1e9, bp: Point | null = null;
    for (const l of cucito) for (const q of l) { const d = Math.hypot(q.x - px, q.y - py); if (d < best) { best = d; bp = q; } }
    console.log(`  filo piu' vicino: ${best.toFixed(2)} mm a (${bp?.x.toFixed(1)},${bp?.y.toFixed(1)})`);
    const nudeVicine = nudiFilo.map((r) => /x="(-?[\d.]+)" y="(-?[\d.]+)"/.exec(r)!).map((m) => ({ x: +m[1], y: +m[2] })).filter((q) => Math.hypot(q.x - px, q.y - py) < 12);
    if (nudeVicine.length) {
      const xs = nudeVicine.map((q) => q.x), ys = nudeVicine.map((q) => q.y);
      console.log(`  celle nude entro 12 mm: ${nudeVicine.length}, fra x ${Math.min(...xs)}..${Math.max(...xs)} e y ${Math.min(...ys)}..${Math.max(...ys)}`);
      const c = nudeVicine[Math.floor(nudeVicine.length / 2)];
      let b2 = 1e9, bq: Point | null = null;
      for (const l of cucito) for (const q of l) { const d = Math.hypot(q.x - c.x, q.y - c.y); if (d < b2) { b2 = d; bq = q; } }
      const ic = cella(c);
      console.log(`  una di esse (${c.x},${c.y}): famiglia ${ic >= 0 ? famDi[ic] : '?'} tinta ${ic >= 0 ? tinta[ic] : '?'} · filo piu' vicino ${b2.toFixed(2)} mm a (${bq?.x.toFixed(1)},${bq?.y.toFixed(1)})`);
    }
  }
  console.log(`DENTI: ${dentiTot} denti · ${(filoMm / 1000).toFixed(1)} m di filo nei denti · ${fermati} fermati a un bordo netto, ${attraversano} attraversano una sfumatura`);
  console.log(`-> apps/pettine/scripts/out/${nome}.svg`);
}

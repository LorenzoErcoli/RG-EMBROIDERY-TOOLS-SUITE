// IL PANNELLO PIENO: ogni area ricamata, una direzione sola per area, bordi netti dove il disegno
// stacca e compenetrazione dove sfuma.
//
// Lorenzo, sul giro precedente: «l'immagine dovrebbe essere completamente ricamata», «il bianco in
// futuro potrebbe essere altri colori», «lasciare decidere troppo all'immagine crea poca chiarezza»,
// «la palla dovrebbe avere il bordo molto più preciso nelle parti di stacco netto», «mai far toccare
// due linee con direzione opposta in un passaggio di gradient».
//
// Dove sbagliava il giro prima: faceva dipendere tutto da UNA tinta (il bianco) e da un campo che
// decide da solo — e un campo, dove ha due bianchi intorno, mette una riga in mezzo per forza.
//
// IL MODELLO, e sono quattro regole:
//
//   1. OGNI AREA HA UNA DIREZIONE SOLA. Un'area è una macchia connessa di una tinta. Il suo pelo va
//      verso UN lato: quello dove confina con la tinta più chiara — e se confina con una più chiara
//      da due parti, si sceglie il lato col confine più lungo. Le linee di base sono le curve di
//      livello della distanza da QUEL lato, quindi restano parallele al bordo verso cui va il pelo e
//      non si incontrano mai frontalmente. La tua idea («identificare oggetti e mantenere un'unica
//      direzione») è la regola, non l'eccezione.
//   2. LA TINTA PIÙ CHIARA È RICAMATA come le altre: la sua base sta sul suo bordo (netto), i denti
//      vanno verso dentro. Non ha nessuno di più chiaro da raggiungere, e i denti delle tinte scure le
//      arrivano sopra. Nell'anteprima è GRIGIA, così si vede che è filo.
//   3. L'ORDINE va dal chiaro allo scuro: chi viene dopo copre chi viene prima. Vale per qualunque
//      palette, conta solo l'ordine di luminosità.
//   4. NETTO O SFUMATO lo dice l'IMMAGINE ORIGINALE, non il vettoriale: dove un dente attraverserebbe
//      il bordo dell'area, si misura sulla foto quanto è largo il passaggio di luce lì
//      (`larghezzaTransizione`, la misura del Punto Pittorico). Sotto la soglia è uno stacco: il
//      dente si ferma al bordo, preciso. Sopra è una sfumatura: il dente attraversa e si compenetra.
//
//   npx esbuild apps/pettine_v2/scripts/pieno.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine_v2/scripts/pieno.mjs
//   node --max-old-space-size=4096 apps/pettine_v2/scripts/pieno.mjs <vettoriale.svg> <foto.bmp> [basi] [passo] [dMin] [dMax] [incl] [nettoMm]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, pointInPolygon, polygonArea } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '../../pittorico/src/region.ts';
import { rasterizza, livello, incatena } from '../../pittorico/src/iso-fill.ts';
import { larghezzaTransizione } from '../../pittorico/src/borders.ts';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';

const LARGHEZZA_REALE_MM = 419.45;
const CELLA = 0.5;

const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const percorso = process.argv[2], foto = process.argv[3];
const BASI_MM = num(4, 2);
const PASSO_MM = Math.max(1, num(5, 1.5));
const DENTE_MIN = num(6, 4), DENTE_MAX = num(7, 10);
const INCL = num(8, 40);
const NETTO_MM = num(9, 2.5);         // sotto questa larghezza di passaggio, il bordo è uno stacco
if (!percorso || !foto) { console.error('uso: node pieno.mjs <vettoriale.svg> <foto.bmp> [basi] [passo] [dMin] [dMax] [incl] [nettoMm]'); process.exit(1); }

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

// --- il vettoriale: le aree, in mm ---------------------------------------------------------------
const testo = readFileSync(percorso, 'utf8');
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
const classi = [...testo.matchAll(/<path[^>]*class="(st\d+)"/g)].map((m) => m[1]);
const letto = parseSvgPolylines(testo, {});
const K = LARGHEZZA_REALE_MM / letto.widthMm;
const W = letto.widthMm * K, H = letto.heightMm * K;
const tracciati = letto.polylines.map((p, i) => ({
  punti: p.map((q) => ({ x: q.x * K, y: q.y * K })) as Polyline,
  colore: stili.get(classi[i] ?? '') ?? 'none',
})).map((a) => ({ ...a, area: Math.abs(polygonArea(a.punti)) })).filter((a) => a.colore !== 'none' && a.area > 20);

const tinte = [...new Set(tracciati.map((t) => t.colore))].sort((a, b) => luminosita(b) - luminosita(a));
const idxTinta = new Map(tinte.map((c, i) => [c, i]));

// --- la foto: è quella da cui il vettoriale è stato tracciato, stessa larghezza reale --------------
const img = leggiBmp(foto);
const mmPerPx = LARGHEZZA_REALE_MM / img.width;
console.log(`\n${percorso}\n${W.toFixed(1)} × ${H.toFixed(1)} mm · tinte dal chiaro allo scuro: ${tinte.join(' · ')}`);
console.log(`foto ${img.width} × ${img.height} px, un pixel vale ${mmPerPx.toFixed(4)} mm`);

// --- la griglia: ogni cella sa a quale AREA appartiene (macchia connessa di una tinta) -------------
function regioniDi(lista: typeof tracciati): Array<{ outer: Polyline; holes: Polyline[] }> {
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

const COLS = Math.ceil(W / CELLA) + 2, ROWS = Math.ceil(H / CELLA) + 2;
const N = COLS * ROWS;
const areaDi = new Int32Array(N).fill(-1);
const tintaDi = new Int8Array(N).fill(-1);
interface Area { id: number; tinta: number; colore: string; celle: number }
const aree: Area[] = [];
for (const colore of tinte) {
  const t = idxTinta.get(colore)!;
  for (const r of regioniDi(tracciati.filter((x) => x.colore === colore))) {
    const dentro = rasterizza(makeRegion(r.outer, r.holes), 0, 0, COLS, ROWS, CELLA);
    const id = aree.length;
    let celle = 0;
    for (let i = 0; i < N; i++) if (dentro[i]) { areaDi[i] = id; tintaDi[i] = t; celle++; }
    aree.push({ id, tinta: t, colore, celle });
  }
}
// una cella scoperta (bordo del disegno, fessure fra tracciati) prende la tinta della vicina più
// chiara: il pannello dev'essere PIENO, non c'è tessuto nudo da lasciare
for (let passata = 0; passata < 4; passata++) {
  for (let r = 1; r + 1 < ROWS; r++) for (let c = 1; c + 1 < COLS; c++) {
    const i = r * COLS + c;
    if (areaDi[i] !== -1) continue;
    let best = -1;
    for (const j of [i - 1, i + 1, i - COLS, i + COLS]) if (areaDi[j] !== -1 && (best === -1 || tintaDi[j] < tintaDi[best])) best = j;
    if (best !== -1) { areaDi[i] = areaDi[best]; tintaDi[i] = tintaDi[best]; }
  }
}
console.log(`${aree.length} aree`);

// --- per ogni area: il LATO verso cui va il pelo, e la distanza da quel lato ---------------------
/**
 * I semi sono le celle dell'area che toccano una tinta PIÙ CHIARA. Se ce ne sono su più lati
 * staccati, si tiene il gruppo più grande: è la regola «un'area, una direzione». La tinta più
 * chiara di tutte non ha nessuno da raggiungere: i suoi semi sono tutto il suo bordo, e il pelo va
 * verso dentro.
 */
function semiDi(a: Area): { semi: Uint8Array; versoDentro: boolean } {
  const bordo = new Uint8Array(N);
  const versoChiaro = new Uint8Array(N);
  for (let r = 1; r + 1 < ROWS; r++) for (let c = 1; c + 1 < COLS; c++) {
    const i = r * COLS + c;
    if (areaDi[i] !== a.id) continue;
    for (const j of [i - 1, i + 1, i - COLS, i + COLS]) {
      if (areaDi[j] === a.id) continue;
      bordo[i] = 1;
      if (tintaDi[j] !== -1 && tintaDi[j] < a.tinta) versoChiaro[i] = 1;
    }
  }
  // la più chiara: base su tutto il bordo, e le PUNTE vanno verso dentro — verso la parte più chiara.
  // Il segno conta: «verso i semi» per lei vorrebbe dire verso il bordo, cioè addosso al vicino, ed è
  // il difetto che Lorenzo ha visto (bianco e celeste che si picchiano).
  if (a.tinta === 0) return { semi: bordo, versoDentro: true };
  // gruppi connessi di celle «verso il chiaro»: si tiene il più grande
  const gruppo = new Int32Array(N).fill(-1);
  let migliore = -1, migliorePeso = 0, ng = 0;
  for (let s = 0; s < N; s++) {
    if (!versoChiaro[s] || gruppo[s] !== -1) continue;
    const coda = [s]; gruppo[s] = ng; let peso = 0;
    while (coda.length) {
      const i = coda.pop()!; peso++;
      for (const j of [i - 1, i + 1, i - COLS, i + COLS, i - COLS - 1, i - COLS + 1, i + COLS - 1, i + COLS + 1]) {
        if (j < 0 || j >= N || !versoChiaro[j] || gruppo[j] !== -1) continue;
        // due celle di bordo sono «vicine» anche a un passo di 3 celle: i bordi tracciati sono frastagliati
        gruppo[j] = ng; coda.push(j);
      }
    }
    if (peso > migliorePeso) { migliorePeso = peso; migliore = ng; }
    ng++;
  }
  if (migliore === -1) return { semi: bordo, versoDentro: true };   // isola senza vicini più chiari: come la più chiara
  const semi = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (versoChiaro[i] && gruppo[i] === migliore) semi[i] = 1;
  return { semi, versoDentro: false };
}

/** Distanza dai semi, dentro l'area sola (chamfer in due passate ripetute finché si assesta). */
function distanzaDa(a: Area, semi: Uint8Array): Float32Array {
  const INF = 1e9;
  const D = new Float32Array(N).fill(INF);
  for (let i = 0; i < N; i++) if (semi[i]) D[i] = 0;
  const a1 = CELLA, a2 = CELLA * Math.SQRT2;
  const ok = (j: number): boolean => areaDi[j] === a.id;
  for (let giro = 0; giro < 3; giro++) {
    for (let r = 1; r + 1 < ROWS; r++) for (let c = 1; c + 1 < COLS; c++) {
      const i = r * COLS + c;
      if (!ok(i)) continue;
      let v = D[i];
      if (ok(i - 1)) v = Math.min(v, D[i - 1] + a1);
      if (ok(i - COLS)) v = Math.min(v, D[i - COLS] + a1);
      if (ok(i - COLS - 1)) v = Math.min(v, D[i - COLS - 1] + a2);
      if (ok(i - COLS + 1)) v = Math.min(v, D[i - COLS + 1] + a2);
      D[i] = v;
    }
    for (let r = ROWS - 2; r >= 1; r--) for (let c = COLS - 2; c >= 1; c--) {
      const i = r * COLS + c;
      if (!ok(i)) continue;
      let v = D[i];
      if (ok(i + 1)) v = Math.min(v, D[i + 1] + a1);
      if (ok(i + COLS)) v = Math.min(v, D[i + COLS] + a1);
      if (ok(i + COLS + 1)) v = Math.min(v, D[i + COLS + 1] + a2);
      if (ok(i + COLS - 1)) v = Math.min(v, D[i + COLS - 1] + a2);
      D[i] = v;
    }
  }
  return D;
}

const cellaDi = (p: Point): number => {
  const c = Math.min(COLS - 2, Math.max(1, Math.round(p.x / CELLA)));
  const r = Math.min(ROWS - 2, Math.max(1, Math.round(p.y / CELLA)));
  return r * COLS + c;
};

// --- il pettine, area per area -------------------------------------------------------------------
const perTinta = new Map<number, string[]>();
let denti = 0, filoMm = 0, basiTot = 0, netti = 0, sfumati = 0, dentroArea = 0;

for (const a of aree) {
  if (a.celle < 40) continue;                           // sotto 10 mm² non c'è posto per un pettine
  const { semi, versoDentro } = semiDi(a);
  const D = distanzaDa(a, semi);
  const segno = versoDentro ? 1 : -1;                  // -1 = verso i semi (il lato chiaro); +1 = via dal bordo
  const dentro = new Uint8Array(N);
  let maxD = 0;
  for (let i = 0; i < N; i++) if (areaDi[i] === a.id) { dentro[i] = 1; if (D[i] < 1e8 && D[i] > maxD) maxD = D[i]; }
  const acc = perTinta.get(a.tinta) ?? [];

  for (let v = BASI_MM / 2; v < maxD; v += BASI_MM) {
    for (const linea of incatena(livello(D, dentro, COLS, ROWS, 0, 0, CELLA, v), CELLA * 1.5)) {
      if (linea.length < 3) continue;
      basiTot++;
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
        const pa = linea[i - 1], pb = linea[i];
        const p = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
        // direzione: verso i semi, cioè −gradiente della distanza
        const ci = cellaDi(p);
        const gx = (D[ci + 1] - D[ci - 1]) / (2 * CELLA), gy = (D[ci + COLS] - D[ci - COLS]) / (2 * CELLA);
        const gl = Math.hypot(gx, gy);
        if (gl < 1e-6 || !Number.isFinite(gl)) continue;
        const r1 = caso(a.id * 7919 + Math.round(v * 10), k * 2), r2 = caso(a.id * 104729 + Math.round(v * 10), k * 2 + 1);
        let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
        const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
        const bx = (segno * gx) / gl, by = (segno * gy) / gl;
        const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);

        // NETTO O SFUMATO. Si cammina lungo il dente fino a dove esce dall'area; lì si misura sulla
        // foto quanto è largo il passaggio di luce. Stretto = stacco: il dente si ferma al bordo.
        // Largo = sfumatura: il dente attraversa e si compenetra col vicino.
        let uscita = -1;
        for (let s = CELLA; s <= lung; s += CELLA) {
          if (areaDi[cellaDi({ x: p.x + ux * s, y: p.y + uy * s })] !== a.id) { uscita = s; break; }
        }
        if (uscita < 0) dentroArea++;
        else {
          const q = { x: p.x + ux * uscita, y: p.y + uy * uscita };
          const tr = larghezzaTransizione(img, mmPerPx, q, { x: ux, y: uy }, { raggioMm: 6 });
          if (!tr || tr.larghezzaMm < NETTO_MM) { lung = Math.max(0.5, uscita - CELLA / 2); netti++; }
          else sfumati++;
        }
        punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
      }
      if (punti.length < 3) continue;
      denti += Math.floor(punti.length / 3);
      for (let i = 1; i < punti.length; i++) filoMm += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
      acc.push(punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
    }
  }
  perTinta.set(a.tinta, acc);
}

// --- il disegno: dal chiaro allo scuro; la tinta più chiara in GRIGIO, perché è filo anche lei ----
const pezzi: string[] = [];
tinte.forEach((colore, t) => {
  const d = perTinta.get(t);
  if (!d?.length) return;
  const tratto = t === 0 ? '#9a9a9a' : colore;
  pezzi.push(`<path d="${d.join('')}" fill="none" stroke="${tratto}" stroke-width="0.1"/>`);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm">
<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`;
mkdirSync('apps/pettine_v2/scripts/out', { recursive: true });
const nome = `pieno-b${BASI_MM}-p${PASSO_MM}-d${DENTE_MIN}_${DENTE_MAX}-n${NETTO_MM}`;
writeFileSync(`apps/pettine_v2/scripts/out/${nome}.svg`, svg, 'utf8');
console.log(`${basiTot} linee di base · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo`);
console.log(`denti che escono dall'area: ${netti} fermati a un bordo NETTO · ${sfumati} lasciati attraversare una SFUMATURA · ${dentroArea} restano dentro`);
console.log(`-> apps/pettine_v2/scripts/out/${nome}.svg`);

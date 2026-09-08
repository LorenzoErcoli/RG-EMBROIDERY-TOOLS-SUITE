// IL PETTINE SULLE AREE VERE, con la curvatura dedotta dalla forma.
//
// Il foglio 4 del provino faceva la fusione fra due curve disegnate a mano. Qui le curve non le
// disegna nessuno: si ricavano dalla forma della macchia, ed è la richiesta di Lorenzo
// («mi piacerebbe riuscissi tu a farla»).
//
// COME. Il pezzo esiste già ed è di un altro tool: `buildColonne` del Punto Pittorico spezza una
// macchia in colonne — l'asse per assottigliamento, i tagli ai bivi e dove ruota troppo — e di ogni
// colonna dà le traverse, i segmenti **da parete a parete**. La fusione allora è gratis: la traversa
// k-esima va dalla parete A alla parete B, quindi prendendo tutte le traverse alla stessa frazione t
// si ottiene una linea che corre lungo la colonna e si adegua alle due pareti. È esattamente
// l'oggetto fusione di Illustrator, con le pareti al posto delle due curve disegnate a mano.
//
// Su ogni linea così ottenuta va il pettine: base sulla linea, denti a caso in lunghezza e
// inclinazione, andata e ritorno. La DIREZIONE dei denti è una scelta per area — Lorenzo: «il bottom
// del punto pettine diventa una linea bella netta che divide un oggetto dall'altro» — quindi i denti
// escono da una parete sola e l'altra resta il bordo netto.
//
// Misure in millimetri veri: il file è 1189 px per 419,45 mm di larghezza reale (la misura che
// Lorenzo ha già dato per questo stesso disegno nel Punto Pittorico), cioè 0,3528 mm per pixel.
//
//   npx esbuild apps/pettine/scripts/zone.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/zone.mjs
//   node apps/pettine/scripts/zone.mjs <file.svg> [gruppo]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { type Point, type Polyline, pointInPolygon, polygonArea } from '@rg/core';
import { parseSvgPolylines } from '../../../packages/pattern-grammar/src/index.ts';
import { makeRegion } from '../../pittorico/src/region.ts';
import { buildColonne } from '../../pittorico/src/colonne.ts';

const LARGHEZZA_REALE_MM = 419.45;   // dichiarata da Lorenzo per questo disegno (Punto Pittorico)

// ---------------------------------------------------------------------------------------------
// il pettine (stesse regole del provino, coi numeri misurati dal file di Lorenzo)
// ---------------------------------------------------------------------------------------------

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface PettineOpts {
  /** Passo fra un dente e il successivo lungo la base, in mm. Mai sotto 1 (limite dato da Lorenzo). */
  passoMm: number;
  denteMinMm: number;
  denteMaxMm: number;
  inclDeg: number;
  verso: number;
  seme: number;
}

function pettine(spina: Polyline, direzioni: Point[], o: PettineOpts): Polyline {
  let tot = 0;
  const cum: number[] = [0];
  for (let i = 1; i < spina.length; i++) {
    tot += Math.hypot(spina[i].x - spina[i - 1].x, spina[i].y - spina[i - 1].y);
    cum.push(tot);
  }
  const out: Point[] = [];
  let k = 0;
  for (let d = 0; d <= tot; d += o.passoMm, k++) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const a = spina[i - 1], b = spina[i];
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    // LA DIREZIONE DEL DENTE NON VIENE DALLA BASE. Viene dalla traversa, cioe' da dove sta il bordo
    // netto rispetto al bordo peloso: e' il difetto che ha visto Lorenzo. Prendendo la normale alla
    // base, dove la base curva e si torce i denti ruotano con lei e nasce l'intrico; qui invece
    // tutti i denti di una colonna puntano dalla stessa parte, e la curvatura si vede pulita.
    const dA = direzioni[i - 1], dB = direzioni[i];
    let ux = dA.x + (dB.x - dA.x) * t, uy = dA.y + (dB.y - dA.y) * t;
    const lu = Math.hypot(ux, uy) || 1;
    ux /= lu; uy /= lu;
    const r1 = caso(o.seme, k * 2), r2 = caso(o.seme, k * 2 + 1);
    const lung = o.denteMinMm + (o.denteMaxMm - o.denteMinMm) * r1;
    const ang = ((r2 * 2 - 1) * o.inclDeg * Math.PI) / 180;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const vx = ux * cs - uy * sn, vy = ux * sn + uy * cs;
    out.push(p, { x: p.x + vx * lung, y: p.y + vy * lung }, p);
  }
  return out;
}

/**
 * LA FUSIONE dalle traverse: la traversa k va da parete A a parete B, quindi la linea alla frazione
 * t è la sequenza dei punti a frazione t di ogni traversa. Le traverse hanno lunghezze diverse — la
 * colonna si allarga e si stringe — ed è proprio questo che fa «adeguare» le linee in mezzo.
 */
function spineDaTraverse(
  traverse: Polyline[],
  quante: number,
  versoDeg: number,
): Array<{ spina: Polyline; direzioni: Point[] }> {
  const buone = traverse.filter((r) => r.length >= 2);
  if (buone.length < 2) return [];
  const vx = Math.cos((versoDeg * Math.PI) / 180), vy = Math.sin((versoDeg * Math.PI) / 180);
  // ogni traversa da' un verso; si sceglie quello che guarda dalla parte chiesta, cosi' il pelo di
  // tutta la macchia e' pettinato uguale e il bordo opposto resta la linea netta.
  const dir = buone.map((r) => {
    const a = r[0], b = r[r.length - 1];
    let dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    return dx * vx + dy * vy >= 0 ? { x: dx, y: dy } : { x: -dx, y: -dy };
  });
  const out: Array<{ spina: Polyline; direzioni: Point[] }> = [];
  for (let i = 0; i < quante; i++) {
    const t = quante === 1 ? 0.5 : i / (quante - 1);
    out.push({
      spina: buone.map((r, k) => {
        const a = r[0], b = r[r.length - 1];
        // il verso della traversa decide anche da quale capo si misura la frazione: cosi' t=0 e'
        // sempre il lato del bordo netto e t=1 sempre il lato peloso, in tutta la macchia.
        const dritto = (b.x - a.x) * dir[k].x + (b.y - a.y) * dir[k].y >= 0;
        const p0 = dritto ? a : b, p1 = dritto ? b : a;
        return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
      }),
      direzioni: dir,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// lettura del file: aree per colore, coi loro fori
// ---------------------------------------------------------------------------------------------

const percorso = process.argv[2];
const soloGruppo = process.argv[3];
if (!percorso) { console.error('uso: node zone.mjs <file.svg> [colore]'); process.exit(1); }

const testo = readFileSync(percorso, 'utf8');
// il colore di ogni tracciato sta nella classe: si legge lo stile e si associa
const stili = new Map<string, string>();
for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
const classi = [...testo.matchAll(/<path[^>]*class="(st\d+)"/g)].map((m) => m[1]);

const letto = parseSvgPolylines(testo, {});
// R11: il file non dichiara una dimensione fisica, quindi la larghezza reale la diamo noi ed e'
// la fonte di verita'. parseSvgPolylines non la applica da se', quindi si scala qui, una volta sola.
const K = LARGHEZZA_REALE_MM / letto.widthMm;
const modello = {
  polylines: letto.polylines.map((l) => l.map((p) => ({ x: p.x * K, y: p.y * K }))),
  widthMm: letto.widthMm * K,
  heightMm: letto.heightMm * K,
};
console.log(`\n${percorso}\n${modello.polylines.length} tracciati · ${modello.widthMm.toFixed(1)} × ${modello.heightMm.toFixed(1)} mm (un pixel vale ${K.toFixed(4)} mm)`);

// tracciati e colori vanno in parallelo: stesso ordine di comparsa nel file
const aree = modello.polylines.map((p, i) => ({
  punti: p as Polyline,
  colore: stili.get(classi[i] ?? '') ?? 'none',
  area: Math.abs(polygonArea(p as Polyline)),
})).filter((a) => a.colore !== 'none' && a.area > 20);       // via i frammenti della vettorializzazione

const perColore = new Map<string, typeof aree>();
for (const a of aree) {
  const l = perColore.get(a.colore) ?? [];
  l.push(a); perColore.set(a.colore, l);
}
console.log('\naree per colore (mm²):');
for (const [c, l] of perColore) {
  console.log(`  ${c}  ${String(l.length).padStart(3)} aree · ${l.reduce((s, a) => s + a.area, 0).toFixed(0)} mm² · la più grande ${Math.max(...l.map((a) => a.area)).toFixed(0)}`);
}

/** Un'area dentro un'altra dello stesso colore è un foro: si guarda un punto e basta. */
function regioniDi(lista: typeof aree): Array<{ outer: Polyline; holes: Polyline[]; colore: string }> {
  const ordinate = [...lista].sort((a, b) => b.area - a.area);
  const usate = new Set<number>();
  const out: Array<{ outer: Polyline; holes: Polyline[]; colore: string }> = [];
  ordinate.forEach((a, i) => {
    if (usate.has(i)) return;
    const holes: Polyline[] = [];
    ordinate.forEach((b, j) => {
      if (j <= i || usate.has(j)) return;
      if (pointInPolygon(b.punti[0], a.punti)) { holes.push(b.punti); usate.add(j); }
    });
    out.push({ outer: a.punti, holes, colore: a.colore });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// il disegno
// ---------------------------------------------------------------------------------------------

// Le manopole, dalla riga di comando: sono quelle che Lorenzo dovra' girare nel tool.
//   node zone.mjs <file> [colore] [passo] [denteMin] [denteMax] [distanzaFraLeBasi] [inclinazione]
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const PASSO_MM = Math.max(1, num(4, 1.4));   // MAI sotto 1 mm: limite dato da Lorenzo
const DENTE_MIN = num(5, 3), DENTE_MAX = num(6, 9);
const BASE_MM = num(7, 2.2);                 // distanza fra una linea di base e la vicina
const INCL = num(8, 50);
const VERSO_DEG = num(9, -90);   // dove punta il pelo: -90 = verso l'alto del disegno
const SPINE_PER_MM = 1 / BASE_MM;

const pezzi: string[] = [];
// un solo path per colore, con un decimale: 80.000 denti in path separati fanno un file da megabyte
// che nessun programma apre volentieri, e la geometria e' identica.
const tratto = (pt: Polyline): string =>
  pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
const perColore2 = new Map<string, string[]>();

const scuriscono = (c: string): string => c;
let denti = 0, filoMm = 0, colonneTot = 0;
const t0 = Date.now();

const gruppi = soloGruppo ? [soloGruppo] : [...perColore.keys()];
for (const colore of gruppi) {
  const lista = perColore.get(colore);
  if (!lista) continue;
  for (const r of regioniDi(lista)) {
    if (Math.abs(polygonArea(r.outer)) < 300) continue;      // le macchie piccolissime si saltano
    const region = makeRegion(r.outer, r.holes);
    let col;
    try {
      col = buildColonne(region, { spacingMm: PASSO_MM, cellMm: 0.8, larghezzaColonnaMm: 24 });
    } catch (e) {
      console.log(`  (saltata una macchia: ${(e as Error).message})`);
      continue;
    }
    colonneTot += col.colonne.length;
    for (const c of col.colonne) {
      const quante = Math.max(1, Math.round(c.larghezzaMm * SPINE_PER_MM));
      spineDaTraverse(c.runs, quante, VERSO_DEG).forEach(({ spina, direzioni }, i) => {
        const p = pettine(spina, direzioni, {
          passoMm: PASSO_MM, denteMinMm: DENTE_MIN, denteMaxMm: DENTE_MAX,
          inclDeg: INCL, verso: -1, seme: 1000 + c.id * 13 + i,
        });
        denti += Math.floor(p.length / 3);
        for (let k = 1; k < p.length; k++) filoMm += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y);
        const acc = perColore2.get(r.colore) ?? [];
        acc.push(tratto(p));
        perColore2.set(r.colore, acc);
      });
    }
  }
}

const W = modello.widthMm, H = modello.heightMm;
for (const [c, d] of perColore2) pezzi.push(`<path d="${d.join('')}" fill="none" stroke="${scuriscono(c)}" stroke-width="0.1"/>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm">
<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `zone-${soloGruppo ? soloGruppo.replace('#', '') : 'tutte'}-p${PASSO_MM}-d${DENTE_MIN}_${DENTE_MAX}-b${BASE_MM}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, svg, 'utf8');
console.log(`\n${colonneTot} colonne · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

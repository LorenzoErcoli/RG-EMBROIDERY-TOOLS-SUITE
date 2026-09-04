// IL RIEMPIMENTO ORDINATO — i punti partono tutti dalla stessa rotaia e attraversano la fascia.
//
// Nasce da una critica di Lorenzo al riempimento precedente: *«il mio dubbio rimane sulla pulizia e
// ordine del filo. Mi aspetto che il riempimento sia molto preciso, con densità costanti dove
// possibile e accorgimenti quando la densità cambia. Ora vedo tante linee non ordinate»*.
//
// Aveva ragione, ed è un limite del METODO, non una rifinitura mancata. Il posizionamento a
// distanza costante (Jobard & Lefer, `curved-fill.ts`) ottimizza **la distanza fra le file** e non
// **l'ordine**: le file nascono e muoiono dove serve alla distanza, quindi cominciano e finiscono a
// quote diverse e il risultato è un'erba fitta ma sparsa. Va benissimo per riempire una forma
// qualunque; non è come cuce un ricamatore.
//
// Un ricamatore, e le fotografie di ricamo pittorico lo mostrano, fa così:
//   1. sceglie un **bordo di partenza** — la rotaia — e ci posa i punti a distanza costante;
//   2. ogni punto **attraversa** la fascia fino all'altro bordo, seguendo la direzione;
//   3. dove la fascia si allarga e i punti si distanziano, **infila un cuneo**: un punto nuovo che
//      comincia a metà, esattamente dove il vuoto si è aperto.
//
// Il passo (3) è l'«accorgimento quando la densità cambia» di Lorenzo. Non è una nascita casuale:
// è un pezzo in più, in un posto deciso, fra due punti che si conoscono. Il risultato è un pettine
// ordinato con dei cunei visibili, invece di un'erba.
//
// Il riempimento a distanza costante resta: serve dove la forma non ha due bordi contrapposti — una
// macchia tonda, un'isola — e lì l'ordine non è definibile.

import { type Point, type Polyline, pointInRegion, type Region } from '@rg/core';
import { type DirectionField } from './field';
import { regionRings } from './region';
import { segmentPolygonIntersections } from '@rg/core';

export interface RailFillOptions {
  /** Passo fra due punti **lungo la rotaia** (R22 `densitySpacingMm`). */
  spacingMm: number;
  /** Passo massimo lungo il punto (R4). */
  maxStitchMm?: number;
  /** Quanto la corda del punto può scostarsi dalla curva. Default `spacingMm / 8` (vedi punto 1). */
  maxSagittaMm?: number;
  /**
   * Oltre questa distanza fra due punti vicini si infila un cuneo. Default 1,8 volte il passo.
   *
   * È la soglia dell'«accorgimento»: sotto, la densità è considerata costante e non si tocca niente;
   * sopra, si è aperto un vuoto e ci va un punto in più. 1,8 e non 2 perché a 2 il vuoto è già largo
   * il doppio del passo, cioè visibile.
   */
  cuneoOltre?: number;
  /** Passo di integrazione lungo il punto. Default `spacingMm / 2`, con un tetto a 0.5 mm. */
  stepMm?: number;
  /** Quanti giri di infilatura dei cunei al massimo. Default 6. */
  giriMassimi?: number;
  maxStepsPerRun?: number;
}

export interface RailFillResult {
  /** I punti, **in ordine lungo la rotaia**: il primo confina col secondo, e così via. */
  runs: Polyline[];
  /** Quanti cunei sono stati infilati, giro per giro: dice dove la fascia si allargava. */
  cuneiPerGiro: number[];
  /** Punti seminati sulla rotaia. */
  semi: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const lunghezza = (l: Polyline): number => {
  let mm = 0;
  for (let i = 1; i < l.length; i++) mm += dist(l[i - 1], l[i]);
  return mm;
};

/** Punti a passo costante lungo una polilinea aperta, capi compresi. */
function passiLungo(linea: Polyline, passoMm: number): Array<{ p: Point; t: Point }> {
  const out: Array<{ p: Point; t: Point }> = [];
  if (linea.length < 2 || !(passoMm > 0)) return out;
  let avanzo = 0;
  for (let i = 1; i < linea.length; i++) {
    const a = linea[i - 1], b = linea[i];
    const len = dist(a, b);
    if (len < 1e-9) continue;
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let s = avanzo;
    while (s <= len) {
      out.push({ p: { x: a.x + t.x * s, y: a.y + t.y * s }, t });
      s += passoMm;
    }
    avanzo = s - len;
  }
  return out;
}

/** La direzione del campo, girata verso l'interno della regione. */
function versoDentro(field: DirectionField, p: Point, region: Region, provaMm: number): Point | null {
  const d = field.dirAt(p);
  if (pointInRegion({ x: p.x + d.x * provaMm, y: p.y + d.y * provaMm }, region)) return d;
  const r = { x: -d.x, y: -d.y };
  if (pointInRegion({ x: p.x + r.x * provaMm, y: p.y + r.y * provaMm }, region)) return r;
  return null;
}

/** Dove il segmento a→b esce dalla regione (`a` dentro, `b` fuori). */
function uscita(a: Point, b: Point, region: Region): Point | null {
  let bestT = Infinity, best: Point | null = null;
  for (const ring of regionRings(region)) {
    for (const hit of segmentPolygonIntersections(a, b, ring)) {
      if (hit.t > 1e-9 && hit.t < bestT) { bestT = hit.t; best = hit.point; }
    }
  }
  return best;
}

/**
 * Un punto: parte da `da`, segue il campo verso l'interno e si ferma sull'altro bordo.
 * Non guarda gli altri punti — l'ordine lo dà la rotaia, non la vicinanza.
 */
function attraversa(
  region: Region, field: DirectionField, da: Point, verso: Point, step: number, maxPassi: number,
): Polyline {
  const pts: Point[] = [da];
  let p = da, prev = verso;
  for (let s = 0; s < maxPassi; s++) {
    const k1 = allinea(field, p, prev);
    const k2 = allinea(field, { x: p.x + (step / 2) * k1.x, y: p.y + (step / 2) * k1.y }, k1);
    const k3 = allinea(field, { x: p.x + (step / 2) * k2.x, y: p.y + (step / 2) * k2.y }, k2);
    const k4 = allinea(field, { x: p.x + step * k3.x, y: p.y + step * k3.y }, k3);
    const vx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
    const vy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
    const m = Math.hypot(vx, vy);
    if (m < 1e-9) break;
    const next = { x: p.x + step * (vx / m), y: p.y + step * (vy / m) };
    if (!pointInRegion(next, region)) {
      const q = uscita(p, next, region);
      if (q) pts.push(q);
      break;
    }
    pts.push(next);
    prev = { x: vx / m, y: vy / m };
    p = next;
  }
  return pts;
}

function allinea(field: DirectionField, p: Point, prev: Point): Point {
  const d = field.dirAt(p);
  return d.x * prev.x + d.y * prev.y < 0 ? { x: -d.x, y: -d.y } : d;
}

/** Il punto della polilinea a distanza `s` dal suo inizio, o null se la polilinea finisce prima. */
function aDistanza(linea: Polyline, s: number): Point | null {
  if (s <= 0) return linea[0] ?? null;
  let percorso = 0;
  for (let i = 1; i < linea.length; i++) {
    const seg = dist(linea[i - 1], linea[i]);
    if (percorso + seg >= s) {
      const t = (s - percorso) / seg;
      return {
        x: linea[i - 1].x + (linea[i].x - linea[i - 1].x) * t,
        y: linea[i - 1].y + (linea[i].y - linea[i - 1].y) * t,
      };
    }
    percorso += seg;
  }
  return null;
}

/** Punti a passo `stepMm` lungo la polilinea, con un tetto allo scostamento della corda (punto 1). */
function inPuntiAgo(linea: Polyline, stepMm: number, maxSagittaMm: number): Polyline {
  if (linea.length < 2 || stepMm <= 0) return linea.slice();
  const out: Point[] = [linea[0]];
  let ancora = 0;
  while (ancora < linea.length - 1) {
    let arco = 0, ultimoBuono = ancora + 1;
    for (let j = ancora; j < linea.length - 1; j++) {
      const passo = dist(linea[j], linea[j + 1]);
      if (arco + passo > stepMm + 1e-9) break;
      arco += passo;
      if (maxSagittaMm > 0 && scostamento(linea, ancora, j + 1) > maxSagittaMm) break;
      ultimoBuono = j + 1;
    }
    out.push(linea[ultimoBuono]);
    ancora = ultimoBuono;
  }
  return out;
}

function scostamento(linea: Polyline, i: number, j: number): number {
  const a = linea[i], b = linea[j];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let peggio = 0;
  for (let k = i + 1; k < j; k++) {
    let t = len2 > 0 ? ((linea[k].x - a.x) * dx + (linea[k].y - a.y) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(linea[k].x - (a.x + dx * t), linea[k].y - (a.y + dy * t));
    if (d > peggio) peggio = d;
  }
  return peggio;
}

/**
 * Riempie la regione partendo dalla rotaia: un punto ogni `spacingMm` lungo di essa, ciascuno che
 * attraversa la fascia seguendo il campo, più i **cunei** dove la fascia si allarga.
 *
 * I punti escono **in ordine lungo la rotaia**: il primo confina col secondo. È questo che rende il
 * ricamo pulito, e non si ottiene ordinando a posteriori un insieme di file nate a caso.
 */
export function buildRailFill(
  region: Region, field: DirectionField, rotaia: Polyline, opts: RailFillOptions,
): RailFillResult {
  const passo = opts.spacingMm;
  const vuoto: RailFillResult = { runs: [], cuneiPerGiro: [], semi: 0 };
  if (!(passo > 0) || rotaia.length < 2) return vuoto;

  const step = Math.min(opts.stepMm && opts.stepMm > 0 ? opts.stepMm : passo / 2, 0.5);
  const maxPassi = Math.max(10, Math.round(opts.maxStepsPerRun ?? 20000));
  const cuneoOltre = opts.cuneoOltre ?? passo * 1.8;
  const giriMassimi = Math.max(0, Math.round(opts.giriMassimi ?? 6));
  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;
  const maxSagitta = opts.maxSagittaMm ?? passo / 8;

  // 1. i semi sulla rotaia, a passo costante — è qui che nasce l'ordine
  const semi = passiLungo(rotaia, passo);
  const dentroDi = passo * 0.35;
  /**
   * Ogni punto porta con sé **da che profondità comincia**, misurata dalla rotaia. Serve al passo
   * successivo: due punti vicini si confrontano a una profondità COMUNE, non ciascuno alla propria
   * distanza dal proprio inizio. Senza questo, un cuneo — che comincia più avanti — veniva
   * confrontato coi vicini a quote diverse, il vuoto sembrava sempre aperto e i cunei raddoppiavano
   * a ogni giro: misurato 53, 105, 205, 394, 711, 1319 su 444 semi, con 49 m di filo al posto di 9.
   */
  let punti: Array<{ linea: Polyline; da: number }> = [];
  for (const s of semi) {
    const v = versoDentro(field, s.p, region, dentroDi);
    if (!v) continue;
    const partenza = pointInRegion(s.p, region) ? s.p : { x: s.p.x + v.x * 1e-3, y: s.p.y + v.y * 1e-3 };
    const linea = attraversa(region, field, partenza, v, step, maxPassi);
    if (lunghezza(linea) >= passo) punti.push({ linea, da: 0 });
  }

  // 2. i CUNEI: dove due punti vicini si allontanano oltre la soglia, ne va infilato uno in mezzo,
  //    e comincia esattamente alla profondità in cui il vuoto si è aperto — non dalla rotaia, che
  //    lì è già piena. È l'accorgimento del ricamatore, non una nascita casuale.
  const cuneiPerGiro: number[] = [];
  for (let giro = 0; giro < giriMassimi; giro++) {
    const nuovi: Array<{ dopo: number; linea: Polyline; da: number }> = [];
    for (let i = 0; i + 1 < punti.length; i++) {
      const a = punti[i], b = punti[i + 1];
      // la profondità si conta dalla ROTAIA: si comincia da dove tutt'e due esistono già
      const inizio = Math.max(a.da, b.da) + passo;
      const fine = Math.min(a.da + lunghezza(a.linea), b.da + lunghezza(b.linea));
      let apertura = -1;
      for (let d = inizio; d <= fine; d += passo / 2) {
        const pa = aDistanza(a.linea, d - a.da), pb = aDistanza(b.linea, d - b.da);
        if (!pa || !pb) break;
        if (dist(pa, pb) > cuneoOltre) { apertura = d; break; }
      }
      if (apertura < 0) continue;
      const pa = aDistanza(a.linea, apertura - a.da), pb = aDistanza(b.linea, apertura - b.da);
      if (!pa || !pb) continue;
      const mezzo = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      if (!pointInRegion(mezzo, region)) continue;
      const d0 = field.dirAt(mezzo);
      // il cuneo prosegue nello stesso verso dei suoi due vicini
      const versoA = versoDaDue(a.linea, apertura - a.da);
      const v = d0.x * versoA.x + d0.y * versoA.y < 0 ? { x: -d0.x, y: -d0.y } : d0;
      const linea = attraversa(region, field, mezzo, v, step, maxPassi);
      if (lunghezza(linea) >= passo) nuovi.push({ dopo: i, linea, da: apertura });
    }
    cuneiPerGiro.push(nuovi.length);
    if (!nuovi.length) break;
    // si reinseriscono in ordine, così la sequenza lungo la rotaia resta vera
    const fusi: Array<{ linea: Polyline; da: number }> = [];
    let k = 0;
    for (let i = 0; i < punti.length; i++) {
      fusi.push(punti[i]);
      while (k < nuovi.length && nuovi[k].dopo === i) { fusi.push({ linea: nuovi[k].linea, da: nuovi[k].da }); k++; }
    }
    punti = fusi;
  }

  const finali = punti.map((x) => (maxStitch > 0 ? inPuntiAgo(x.linea, maxStitch, maxSagitta) : x.linea));
  return { runs: finali, cuneiPerGiro, semi: semi.length };
}

/** Il verso di marcia di una fila alla profondità `s`, per far proseguire il cuneo come i vicini. */
function versoDaDue(linea: Polyline, s: number): Point {
  const a = aDistanza(linea, Math.max(0, s - 0.5));
  const b = aDistanza(linea, s + 0.5) ?? linea[linea.length - 1];
  if (!a || !b) return { x: 1, y: 0 };
  const m = dist(a, b);
  return m < 1e-9 ? { x: 1, y: 0 } : { x: (b.x - a.x) / m, y: (b.y - a.y) / m };
}

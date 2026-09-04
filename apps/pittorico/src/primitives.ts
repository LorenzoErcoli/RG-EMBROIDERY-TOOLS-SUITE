// LE FORME NETTE (§5 del briefing): dal contorno a gradini alla primitiva che c'era sotto.
//
// Il problema, guardando la cianotipia di Lorenzo: la sfera **è un cerchio** e i tagli interni sono
// archi esatti. Un contorno tracciato sui pixel è una scalinata; semplificarla dà un poligono coi
// gradini smussati, e sul ricamo si vede. Peggio: il campo di direzione nasce dalla **tangente al
// bordo**, quindi su un bordo a gradini il campo balla, e il riempimento con lui.
//
// La risposta non è semplificare meglio: è **riconoscere**. Si prova a interpolare cerchi, archi e
// segmenti; se il residuo sta sotto una tolleranza in mm, la primitiva sostituisce la spezzata. È
// la "regolarizzazione delle forme" dei vettorizzatori, e qui serve a tre cose insieme — il bordo
// giusto, il campo esatto, e i fori che non perdono un angolo (il difetto misurato in
// `test/smoke.mjs`: un foro da 4 mm² che ne consegna 3,5).
//
// Resta locale all'app (regola di crescita 2): sale nel core quando la chiederà un secondo tool.

import { type Point, type Polyline } from '@rg/core';

export interface Cerchio { tipo: 'cerchio'; cx: number; cy: number; r: number; }
export interface Arco { tipo: 'arco'; cx: number; cy: number; r: number; da: number; a: number; }
export interface Segmento { tipo: 'segmento'; a: Point; b: Point; }
export type Primitiva = Cerchio | Arco | Segmento;

export interface Regolarizzazione {
  /** Il contorno ricostruito dalle primitive, in millimetri. */
  ring: Polyline;
  /** Di che cosa è fatto, in ordine. */
  pezzi: Primitiva[];
  /** Quanto il contorno ricostruito si scosta da quello di partenza, al peggio, in mm. */
  scostamentoMm: number;
  /** Vero se l'intero anello è risultato un cerchio. */
  cerchioIntero: boolean;
}

export interface RegolarizzaOptions {
  /** Quanto la primitiva può scostarsi dai punti che sostituisce. Nessun default: è LA decisione. */
  tolMm: number;
  /**
   * Punti minimi perché un **arco** sia credibile. Default 6.
   *
   * Vale per gli archi e non per i segmenti, e la differenza non è pignoleria: un lato dritto dopo
   * la semplificazione è fatto di **due** punti, e pretenderne sei significa non riconoscere mai un
   * rettangolo. Misurato: il rettangolo di prova esce dal tracciato in 5 punti in tutto, e con la
   * soglia unica a 6 il riconoscimento non partiva nemmeno.
   */
  minPunti?: number;
  /**
   * Un arco con raggio più grande di `raggioMassimoFattore` volte la sua corda è una retta
   * travestita: il fit del cerchio lì è mal condizionato e sputa raggi enormi. Default 30.
   */
  raggioMassimoFattore?: number;
  /** Passo del contorno ricostruito, in mm. Default: tolMm (la corda resta sotto la tolleranza). */
  passoMm?: number;
}

// ---------------------------------------------------------------------------------------------
// I due fit
// ---------------------------------------------------------------------------------------------

/**
 * Cerchio ai minimi quadrati (Kåsa): si risolve `x² + y² = A·x + B·y + C`, che è lineare in
 * (A, B, C), e da lì escono centro e raggio. I punti si centrano prima sul baricentro, così la
 * matrice non degenera quando la forma sta lontano dall'origine — con le coordinate in millimetri
 * di un cartamodello succede sempre.
 */
export function fitCerchio(punti: Point[]): { cx: number; cy: number; r: number; scarto: number } | null {
  const n = punti.length;
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (const p of punti) { mx += p.x; my += p.y; }
  mx /= n; my /= n;

  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
  for (const p of punti) {
    const x = p.x - mx, y = p.y - my, z = x * x + y * y;
    sxx += x * x; sxy += x * y; syy += y * y; sxz += x * z; syz += y * z;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-12) return null;                 // punti allineati: non è un cerchio
  const cx = (sxz * syy - syz * sxy) / (2 * det);
  const cy = (syz * sxx - sxz * sxy) / (2 * det);

  let sr = 0;
  for (const p of punti) sr += Math.hypot(p.x - mx - cx, p.y - my - cy);
  const r = sr / n;

  let scarto = 0;
  for (const p of punti) {
    const d = Math.abs(Math.hypot(p.x - mx - cx, p.y - my - cy) - r);
    if (d > scarto) scarto = d;
  }
  return { cx: cx + mx, cy: cy + my, r, scarto };
}

/** Retta ai minimi quadrati totali. Lo scarto è la distanza perpendicolare peggiore. */
export function fitRetta(punti: Point[]): { a: Point; b: Point; scarto: number } | null {
  const n = punti.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (const p of punti) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of punti) {
    const x = p.x - mx, y = p.y - my;
    sxx += x * x; sxy += x * y; syy += y * y;
  }
  // direzione = autovettore maggiore della matrice dei momenti secondi
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta), uy = Math.sin(theta);
  let tMin = Infinity, tMax = -Infinity, scarto = 0;
  for (const p of punti) {
    const x = p.x - mx, y = p.y - my;
    const t = x * ux + y * uy;
    const d = Math.abs(-x * uy + y * ux);
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
    if (d > scarto) scarto = d;
  }
  return {
    a: { x: mx + ux * tMin, y: my + uy * tMin },
    b: { x: mx + ux * tMax, y: my + uy * tMax },
    scarto,
  };
}

// ---------------------------------------------------------------------------------------------
// Il riconoscimento
// ---------------------------------------------------------------------------------------------

const norm = (a: number): number => {
  let v = a;
  while (v <= -Math.PI) v += 2 * Math.PI;
  while (v > Math.PI) v -= 2 * Math.PI;
  return v;
};

/** I punti di un arco da `da` a `a` (verso già deciso), passo `passoMm` sulla circonferenza. */
function puntiArco(c: { cx: number; cy: number; r: number }, da: number, a: number, passoMm: number): Point[] {
  const delta = a - da;
  const passi = Math.max(1, Math.ceil(Math.abs(delta) * c.r / Math.max(passoMm, 1e-6)));
  const out: Point[] = [];
  for (let i = 0; i <= passi; i++) {
    const t = da + (delta * i) / passi;
    out.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t) });
  }
  return out;
}

/**
 * Quanto i punti si scostano da un cerchio — **contando anche i punti di mezzo dei lati**.
 *
 * È la correzione di un errore che mi ha fatto scambiare un quadrato per un cerchio. I quattro
 * vertici di un quadrato stanno *esattamente* su una circonferenza: misurando la distanza dai soli
 * vertici, il fit era perfetto e il foro quadrato da 4 mm² usciva come un cerchio da 5,55. Ma un
 * cerchio deve somigliare alla **curva**, non ai suoi angoli: i punti di mezzo dei lati, che su un
 * quadrato stanno 0,41 mm dentro la circonferenza circoscritta, lo dicono subito.
 */
function scartoDalCerchio(punti: Point[], c: { cx: number; cy: number; r: number }, chiuso: boolean): number {
  let peggio = 0;
  const guarda = (x: number, y: number): void => {
    const d = Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r);
    if (d > peggio) peggio = d;
  };
  for (const p of punti) guarda(p.x, p.y);
  const fino = chiuso ? punti.length : punti.length - 1;
  for (let i = 0; i < fino; i++) {
    const a = punti[i], b = punti[(i + 1) % punti.length];
    guarda((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  return peggio;
}

/** Lo scostamento peggiore dei punti `punti` dal contorno `ring` (punto → segmento). */
function scostamentoDa(punti: Point[], ring: Polyline): number {
  let peggio = 0;
  for (const p of punti) {
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
      if (d < best) best = d;
    }
    if (best > peggio) peggio = best;
  }
  return peggio;
}

/**
 * Riconosce le primitive di un anello chiuso e lo ricostruisce.
 *
 * L'ordine delle prove non è casuale: prima **tutto il cerchio** (è il caso che serve alla sfera di
 * Lorenzo, e riconoscerlo intero dà un campo di direzione esatto invece che a pezzi), poi la
 * segmentazione avida in tratti — retta se basta, arco se serve, spezzata grezza se nessuna delle
 * due ce la fa. La retta ha la precedenza sull'arco a parità di lunghezza: è più semplice, e un
 * lato dritto riconosciuto come arco di raggio 900 mm è un lato dritto descritto male.
 */
export function regolarizzaAnello(ring: Polyline, opts: RegolarizzaOptions): Regolarizzazione {
  const tol = opts.tolMm;
  const minPunti = Math.max(3, Math.round(opts.minPunti ?? 6));
  const fattore = opts.raggioMassimoFattore ?? 30;
  const passo = opts.passoMm && opts.passoMm > 0 ? opts.passoMm : Math.max(tol, 1e-3);
  const n = ring.length;
  if (n < 3 || !(tol > 0)) {
    return { ring: ring.slice(), pezzi: [], scostamentoMm: 0, cerchioIntero: false };
  }

  // ---- 1. tutto l'anello è un cerchio? ----
  const intero = n >= minPunti ? fitCerchio(ring) : null;
  if (intero && scartoDalCerchio(ring, intero, true) <= tol) {
    const da = Math.atan2(ring[0].y - intero.cy, ring[0].x - intero.cx);
    // il verso di percorrenza dell'anello si conserva: il ricamo a valle ci conta
    const secondo = Math.atan2(ring[1].y - intero.cy, ring[1].x - intero.cx);
    const verso = norm(secondo - da) >= 0 ? 1 : -1;
    const punti = puntiArco(intero, da, da + verso * 2 * Math.PI, passo);
    punti.pop();                                    // anello: l'ultimo coincide col primo
    return {
      ring: punti,
      pezzi: [{ tipo: 'cerchio', cx: intero.cx, cy: intero.cy, r: intero.r }],
      scostamentoMm: scostamentoDa(ring, punti),
      cerchioIntero: true,
    };
  }

  // ---- 2. segmentazione avida ----
  const pezzi: Primitiva[] = [];
  const fuori: Point[] = [];
  let i = 0;
  while (i < n) {
    let migliore: { fine: number; prim: Primitiva; punti: Point[] } | null = null;
    // si parte da due punti: un lato dritto È due punti, e pretenderne di più significa non
    // riconoscere mai un poligono. L'arco invece ha bisogno di prove, e le chiede più sotto.
    for (let j = i + 1; j < n; j++) {
      const tratto = ring.slice(i, j + 1);
      const retta = fitRetta(tratto);
      if (retta && retta.scarto <= tol) {
        // I capi vanno rimessi nel verso in cui si PERCORRE il contorno: `fitRetta` li ordina lungo
        // la retta, che è un'altra cosa. Senza, ogni tanto si pubblica il capo sbagliato e il
        // poligono degenera — misurato: il rettangolo di prova perdeva un vertice e l'area usciva
        // esattamente dimezzata, 147 mm² invece di 294.
        const p0 = tratto[0];
        const dritto = Math.hypot(retta.a.x - p0.x, retta.a.y - p0.y) <= Math.hypot(retta.b.x - p0.x, retta.b.y - p0.y);
        const da = dritto ? retta.a : retta.b, a2 = dritto ? retta.b : retta.a;
        migliore = { fine: j, prim: { tipo: 'segmento', a: da, b: a2 }, punti: [da, a2] };
        continue;                                   // la retta vince a parità: è più semplice
      }
      if (tratto.length < minPunti) break;
      const cer = fitCerchio(tratto);
      const corda = Math.hypot(tratto[tratto.length - 1].x - tratto[0].x, tratto[tratto.length - 1].y - tratto[0].y);
      if (cer && scartoDalCerchio(tratto, cer, false) <= tol && cer.r <= corda * fattore) {
        const da = Math.atan2(tratto[0].y - cer.cy, tratto[0].x - cer.cx);
        const a2 = Math.atan2(tratto[tratto.length - 1].y - cer.cy, tratto[tratto.length - 1].x - cer.cx);
        const mezzo = tratto[Math.floor(tratto.length / 2)];
        const am = Math.atan2(mezzo.y - cer.cy, mezzo.x - cer.cx);
        // il verso è quello che fa passare l'arco dal punto di mezzo
        const avanti = norm(am - da) >= 0 && norm(a2 - am) >= 0;
        const fine = avanti ? da + norm(a2 - da) : da - norm(da - a2);
        migliore = {
          fine: j,
          prim: { tipo: 'arco', cx: cer.cx, cy: cer.cy, r: cer.r, da, a: fine },
          punti: puntiArco(cer, da, fine, passo),
        };
        continue;
      }
      break;                                        // né retta né arco: il tratto finisce qui
    }
    if (!migliore) { fuori.push(ring[i]); i += 1; continue; }
    pezzi.push(migliore.prim);
    fuori.push(...migliore.punti.slice(0, -1));
    i = migliore.fine;                              // il capo è condiviso col tratto successivo
    if (i >= n - 1) break;
  }

  if (!pezzi.length) return { ring: ring.slice(), pezzi: [], scostamentoMm: 0, cerchioIntero: false };
  return { ring: fuori, pezzi, scostamentoMm: scostamentoDa(ring, fuori), cerchioIntero: false };
}

// Cannage rafia — STOP 1 e 2: il contorno a impunture e la griglia che blocca i materiali.
//
// Letti dal DST M1404 (davanti e lato):
// - STOP 1: il contorno del pezzo a punti di 4 mm, dall'angolo in alto a sinistra in senso orario,
//   chiuso dove comincia.
// - STOP 2: di nuovo il contorno a 4 mm; poi, dopo un salto, la GRIGLIA: tutti i lati dei rombi
//   prolungati da bordo a bordo (sul reticolo entro 0,4 mm), ognuno cucito una volta sola a punti di
//   3,5 mm, fermati su un contorno rientrato — circa 6 mm nel davanti, 10 nel lato. Da una linea alla
//   successiva il filo cammina su quel contorno rientrato.
import { insetPolygon } from '@rg/core';
import type { Punto, Reticolo } from './linee';

export type ParametriStop = {
  /** Punto del contorno a impunture (stop 1 e inizio stop 2), mm. */
  puntoContorno: number;
  /** Punto delle linee della griglia e dei passaggi fra una linea e l'altra, mm. */
  puntoGriglia: number;
  /** Di quanto la griglia si ferma prima del contorno, mm. */
  rientroGriglia: number;
  /**
   * I pezzi di linea più corti di così non si cuciono, mm. Negli angoli il reticolo taglia il
   * contorno rientrato in schegge: nel davanti M1404 quelle in alto (46 mm) ci sono, quelle in basso
   * (40 e 42 mm) no. Da qui i 45 di partenza — misurati su un file solo, quindi nel pannello.
   */
  lineaMinima: number;
};

/** Il davanti M1404: contorno 4 mm, griglia 3,5 mm fermata 6 mm dentro, schegge sotto i 45 mm tolte. */
export const PARAMETRI_STOP: ParametriStop = { puntoContorno: 4, puntoGriglia: 3.5, rientroGriglia: 6, lineaMinima: 45 };

function area(c: Punto[]): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; s += p.x * q.y - q.x * p.y; }
  return s / 2;
}

/**
 * L'anello del contorno in senso ORARIO a vista (con la y verso il basso l'area viene positiva),
 * che parte dal vertice più in alto a sinistra. Senza punto di chiusura ripetuto.
 */
export function anelloOrario(contorno: Punto[]): Punto[] {
  const pulito = contorno.filter((p, i) => i === 0 || Math.hypot(p.x - contorno[i - 1].x, p.y - contorno[i - 1].y) > 1e-6);
  if (pulito.length > 1 && Math.hypot(pulito[0].x - pulito[pulito.length - 1].x, pulito[0].y - pulito[pulito.length - 1].y) < 1e-6) pulito.pop();
  const orario = area(pulito) >= 0 ? pulito : pulito.slice().reverse();
  let k = 0;
  for (let i = 1; i < orario.length; i++) if (orario[i].x + orario[i].y < orario[k].x + orario[k].y - 1e-9) k = i;
  return [...orario.slice(k), ...orario.slice(0, k)];
}

/** Da un punto all'altro a punti non più lunghi di `punto`. */
function tratto(a: Punto, b: Punto, punto: number, out: Punto[]): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.05) return;
  const n = Math.max(1, Math.ceil(len / punto - 1e-9));
  for (let i = 1; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
}

/** STOP 1 (e l'inizio dello stop 2): il contorno a impunture, chiuso. */
export function contornoImpunture(contorno: Punto[], punto: number): Punto[] {
  const anello = anelloOrario(contorno);
  const out: Punto[] = [anello[0]];
  for (let i = 1; i <= anello.length; i++) tratto(anello[i - 1], anello[i % anello.length], punto, out);
  return out;
}

/** Posizione lungo l'anello (in mm dall'inizio) del punto dell'anello più vicino a `p`. */
function ascissa(anello: Punto[], cum: number[], p: Punto): number {
  let best = Infinity, u = 0;
  for (let i = 0; i < anello.length; i++) {
    const a = anello[i], b = anello[(i + 1) % anello.length];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
    if (d < best) { best = d; u = cum[i] + t * Math.sqrt(l2); }
  }
  return u;
}

/** I vertici dell'anello da attraversare andando da u0 a u1 per la via più corta, e il punto d'arrivo. */
function camminaAnello(anello: Punto[], cum: number[], L: number, u0: number, u1: number): Punto[] {
  const avanti = (((u1 - u0) % L) + L) % L;
  const inAvanti = avanti <= L - avanti;
  const corsa = inAvanti ? avanti : L - avanti;
  const vertici: { d: number; p: Punto }[] = [];
  for (let i = 0; i < anello.length; i++) {
    // distanza del vertice da u0 nel verso di marcia
    const d = inAvanti ? (((cum[i] - u0) % L) + L) % L : (((u0 - cum[i]) % L) + L) % L;
    if (d > 1e-9 && d < corsa - 1e-9) vertici.push({ d, p: anello[i] });
  }
  return vertici.sort((a, b) => a.d - b.d).map((v) => v.p);
}

function puntoAd(anello: Punto[], cum: number[], L: number, u: number): Punto {
  const v = ((u % L) + L) % L;
  for (let i = 0; i < anello.length; i++) {
    const a = anello[i], b = anello[(i + 1) % anello.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (v <= cum[i] + l + 1e-9) {
      const t = l ? (v - cum[i]) / l : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return anello[0];
}

/** Un contorno rientrato pronto da percorrere: l'anello orario, le lunghezze progressive e il giro intero. */
export type Anello = { punti: Punto[]; cum: number[]; L: number };

/** Il contorno rientrato di `rientro` mm, o null se il pezzo è troppo piccolo per rientrare tanto. */
export function anelloRientrato(contorno: Punto[], rientro: number): Anello | null {
  const esterno = anelloOrario(contorno);
  // il rientro: `insetPolygon` rientra verso l'interno a seconda del verso; se l'area cresce, era il verso sbagliato
  let interno = insetPolygon(esterno, rientro) as Punto[];
  if (Math.abs(area(interno)) > Math.abs(area(esterno))) interno = insetPolygon(esterno.slice().reverse(), rientro) as Punto[];
  const punti = anelloOrario(interno);
  if (punti.length < 3 || Math.abs(area(punti)) < 1) return null;
  const cum: number[] = [0];
  for (let i = 1; i < punti.length; i++) cum.push(cum[i - 1] + Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y));
  const L = cum[cum.length - 1] + Math.hypot(punti[0].x - punti[punti.length - 1].x, punti[0].y - punti[punti.length - 1].y);
  return { punti, cum, L };
}

export type Griglia = { contorno: Punto[]; griglia: Punto[]; linee: number };

/**
 * STOP 2: il contorno a impunture e poi la griglia. Le linee sono i lati dei rombi del reticolo
 * (le rette per i vertici, pendenza ±b/a, una ogni 2b in verticale), tagliate sul contorno rientrato.
 * L'ordine: si parte dal capo più in alto a sinistra e, finita una linea, si va lungo il contorno
 * rientrato al capo libero più vicino. Ogni linea si cuce una volta sola.
 */
export function grigliaBloccaggio(ret: Reticolo, contorno: Punto[], par: ParametriStop): Griglia {
  const bordo = contornoImpunture(contorno, par.puntoContorno);
  const rientrato = anelloRientrato(contorno, par.rientroGriglia);
  if (!rientrato) return { contorno: bordo, griglia: [], linee: 0 };
  const { punti: anello, cum, L } = rientrato;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of anello) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }

  // ---- le linee del reticolo tagliate sull'anello
  const segmenti: [Punto, Punto][] = [];
  for (const s of [1, -1]) {
    const m = (s * ret.b) / ret.a;
    const y0 = (x: number) => ret.cy + m * (x - ret.cx - ret.a);
    // la retta k: y = y0(x) + 2b·k; k copre l'ingombro dell'anello
    const ks = [minX, maxX].flatMap((x) => [minY, maxY].map((y) => (y - y0(x)) / (2 * ret.b)));
    for (let k = Math.floor(Math.min(...ks)); k <= Math.ceil(Math.max(...ks)); k++) {
      const q = 2 * ret.b * k;
      const ts: number[] = [];
      for (let i = 0; i < anello.length; i++) {
        const a = anello[i], b = anello[(i + 1) % anello.length];
        const fa = a.y - y0(a.x) - q, fb = b.y - y0(b.x) - q;
        if ((fa <= 0 && fb > 0) || (fa > 0 && fb <= 0)) ts.push(a.x + ((b.x - a.x) * fa) / (fa - fb));
      }
      ts.sort((p, r) => p - r);
      for (let j = 0; j + 1 < ts.length; j += 2) {
        const pa = { x: ts[j], y: y0(ts[j]) + q }, pb = { x: ts[j + 1], y: y0(ts[j + 1]) + q };
        if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > Math.max(1, par.lineaMinima)) segmenti.push([pa, pb]);
      }
    }
  }
  if (!segmenti.length) return { contorno: bordo, griglia: [], linee: 0 };

  // ---- il percorso: capo più in alto a sinistra, poi il capo libero più vicino lungo l'anello
  const liberi = segmenti.map((sg) => ({ sg, u: [ascissa(anello, cum, sg[0]), ascissa(anello, cum, sg[1])] }));
  let primo = 0, capo = 0;
  liberi.forEach((l, i) => l.sg.forEach((p, c) => { const b = liberi[primo].sg[capo]; if (p.x + p.y < b.x + b.y) { primo = i; capo = c; } }));
  const out: Punto[] = [];
  let corrente = liberi.splice(primo, 1)[0];
  let da = capo;
  out.push(corrente.sg[da]);
  for (;;) {
    const a = da === 0 ? 1 : 0;
    tratto(corrente.sg[da], corrente.sg[a], par.puntoGriglia, out);
    const uFine = corrente.u[a];
    if (!liberi.length) break;
    let best = 0, bestCapo = 0, bestD = Infinity;
    liberi.forEach((l, i) => l.u.forEach((u, c) => {
      const d = Math.abs(u - uFine), dd = Math.min(d, L - d);
      if (dd < bestD) { bestD = dd; best = i; bestCapo = c; }
    }));
    const prossimo = liberi.splice(best, 1)[0];
    // lungo l'anello, vertice per vertice, fino al capo della linea successiva
    let p = out[out.length - 1];
    for (const v of camminaAnello(anello, cum, L, uFine, prossimo.u[bestCapo])) { tratto(p, v, par.puntoGriglia, out); p = v; }
    tratto(p, puntoAd(anello, cum, L, prossimo.u[bestCapo]), par.puntoGriglia, out);
    tratto(out[out.length - 1], prossimo.sg[bestCapo], par.puntoGriglia, out);
    corrente = prossimo;
    da = bestCapo;
  }
  return { contorno: bordo, griglia: out, linee: segmenti.length };
}

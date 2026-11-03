// Rete a catenella — il motore, puro e senza DOM (Lorenzo, 2026-11-03: «a partire da un contorno viene riempito, mantenendo gli
// stessi identici criteri di creazione, ma parametrizzando tutto … lavorare a moduli ed essere in grado di attaccarsi
// reciprocamente»). Il contorno si riempie di moduli in griglia; ogni modulo si cuce così: passate di base, poi catenelle e
// passaggi, nell'ordine del modulo. Quello che esce dal contorno si taglia.
//
// Il modulo arriva da fuori (`ModuloRete`): i file dei clienti non stanno nel repo, che è pubblico. Di suo il tool ha solo il
// modulo di esempio inventato di `esempio.ts`. Le misure della catenella vengono da un file vero: sapere/tool/rete-catenella.md.
import { dstFromExportLayers, misuraDst, type Contour, type ExportLayer, type Point, type Polyline } from '@rg/core';
import type { Ingresso, Motore, Risultato } from '@rg/cervello';
import { moduloDiEsempio } from './esempio';

export type Xy = [number, number];

export interface OggettoModulo {
  tipo: 'base' | 'catenella' | 'passaggio';
  /** Di una base: quale passata è, nella sua metà del modulo (1, 2, 3). */
  passata?: number;
  t: Xy[];
}
/** Un modulo: una o due varianti che si alternano a colonne, e i passi che le fanno combaciare. Fissi: sono loro gli incastri. */
export interface ModuloRete {
  formato: 'rete-modulo-1';
  nome: string;
  passi: { colonne: number; righe: number };
  varianti: { A: { oggetti: OggettoModulo[] }; B: { oggetti: OggettoModulo[] } };
  /** Dove sta la griglia sul disegno da cui viene il modulo; assente: si parte dall'angolo del contorno. */
  origine?: Xy;
}

export interface ParametriRete {
  passate: number;
  puntoBaseMm: number;
  puntoPassaggioMm: number;
  psilLunghezzaMm: number;
  psilLarghezzaMm: number;
  psilPassoMm: number;
  psilInizioMm: number;
  psilGiri: number;
  margineMm: number;
  spostaXMm: number;
  spostaYMm: number;
  moduloMinimoPct: number;
  corsie: boolean;
  primaCorsiaMm: number;
  passoCorsiaMm: number;
}

/** I valori di serie sono quelli misurati sul file di riferimento. */
export const PARAMETRI_RETE: ParametriRete = {
  passate: 3, puntoBaseMm: 2.5, puntoPassaggioMm: 2.5,
  psilLunghezzaMm: 2.5, psilLarghezzaMm: 1.3, psilPassoMm: 1.7, psilInizioMm: 0.6, psilGiri: 2,
  margineMm: 0, spostaXMm: 0, spostaYMm: 0, moduloMinimoPct: 22,
  corsie: true, primaCorsiaMm: 1, passoCorsiaMm: 1,
};

const d = (a: Xy, b: Xy): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lunghezza = (t: Xy[]): number => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);

export function ricampiona(t: Xy[], passo: number): Xy[] {
  const out: Xy[] = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / passo));
    for (let k = 1; k <= n; k++) out.push([t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n]);
  }
  return out;
}

/** La maglia misurata sul file: A, B, C per ogni giro, poi di nuovo A. La prima parte a psilInizioMm, poi una ogni psilPassoMm. */
export function catenella(t: Xy[], p: ParametriRete): Xy[] {
  const L = lunghezza(t);
  if (L <= p.psilInizioMm) return [];
  const n = Math.floor((L - p.psilInizioMm) / p.psilPassoMm) + 1;
  const cum = [0];
  for (let i = 1; i < t.length; i++) cum.push(cum[i - 1] + d(t[i - 1], t[i]));
  const su = (s: number): { q: Xy; u: Xy } => {
    let i = 1;
    while (i < t.length - 1 && cum[i] < s) i++;
    const l = cum[i] - cum[i - 1] || 1, f = Math.min(1, (s - cum[i - 1]) / l);
    return { q: [t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f], u: [(t[i][0] - t[i - 1][0]) / l, (t[i][1] - t[i - 1][1]) / l] };
  };
  const out: Xy[] = [];
  const lato = p.psilLarghezzaMm / 2;
  for (let k = 0; k < n; k++) {
    const { q, u } = su(p.psilInizioMm + k * p.psilPassoMm), nor: Xy = [-u[1], u[0]];
    const B: Xy = [q[0] + u[0] * p.psilLunghezzaMm - nor[0] * lato, q[1] + u[1] * p.psilLunghezzaMm - nor[1] * lato];
    const C: Xy = [q[0] + u[0] * p.psilLunghezzaMm + nor[0] * lato, q[1] + u[1] * p.psilLunghezzaMm + nor[1] * lato];
    for (let r = 0; r < p.psilGiri; r++) out.push(q, B, C);
    out.push(q);
  }
  return out;
}

export interface Cella { riga: number; colonna: number; variante: 'A' | 'B'; dx: number; dy: number }

/** Dove va ogni modulo: le colonne alternano le due varianti, le righe si ripetono. I passi vengono dal modulo. */
export function griglia(ingombro: [number, number, number, number], modulo: ModuloRete, origine: Xy): Cella[] {
  const celle: Cella[] = [];
  const [x0, y0, x1, y1] = ingombro;
  const { colonne, righe } = modulo.passi;
  const kMin = Math.floor((x0 - origine[0] - 130) / colonne), kMax = Math.ceil((x1 - origine[0] + 130) / colonne);
  const rMin = Math.floor((y0 - origine[1] - 70) / righe), rMax = Math.ceil((y1 - origine[1] + 70) / righe);
  for (let r = rMin; r <= rMax; r++) {
    for (let k = kMin; k <= kMax; k++) {
      const pari = ((k % 2) + 2) % 2 === 0;
      celle.push({ riga: r, colonna: k, variante: pari ? 'A' : 'B', dx: origine[0] + k * colonne, dy: origine[1] + r * righe });
    }
  }
  return celle;
}

/** Dentro il contorno, allargato del margine: una maschera a 2 pixel per mm, così un test costa uguale su qualsiasi contorno. */
export function maschera(anello: Xy[], margineMm: number): (p: Xy) => boolean {
  const K = 2, m = margineMm + 2;
  const xs = anello.map((p) => p[0]), ys = anello.map((p) => p[1]);
  const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
  const w = Math.ceil((Math.max(...xs) - x0 + m) * K), h = Math.ceil((Math.max(...ys) - y0 + m) * K);
  const celle = new Uint8Array(w * h);
  for (let Y = 0; Y < h; Y++) {
    const y = y0 + (Y + 0.5) / K, tagli: number[] = [];
    for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
      const a = anello[i], b = anello[j];
      if ((a[1] > y) !== (b[1] > y)) tagli.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    tagli.sort((p, q) => p - q);
    for (let k = 0; k + 1 < tagli.length; k += 2) {
      for (let X = Math.max(0, Math.ceil((tagli[k] - x0) * K - 0.5)); X <= Math.min(w - 1, Math.floor((tagli[k + 1] - x0) * K - 0.5)); X++) celle[Y * w + X] = 1;
    }
  }
  if (margineMm > 0) {
    for (let i = 1; i < anello.length; i++) {
      const a = anello[i - 1], b = anello[i], l = d(a, b);
      const n = Math.max(1, Math.ceil(l * K));
      for (let s = 0; s <= n; s++) {
        const cx = (a[0] + ((b[0] - a[0]) * s) / n - x0) * K, cy = (a[1] + ((b[1] - a[1]) * s) / n - y0) * K, r = margineMm * K;
        for (let Y = Math.max(0, Math.floor(cy - r)); Y <= Math.min(h - 1, Math.ceil(cy + r)); Y++) {
          for (let X = Math.max(0, Math.floor(cx - r)); X <= Math.min(w - 1, Math.ceil(cx + r)); X++) {
            if ((X - cx) ** 2 + (Y - cy) ** 2 <= r * r) celle[Y * w + X] = 1;
          }
        }
      }
    }
  }
  return (p) => { const X = Math.floor((p[0] - x0) * K), Y = Math.floor((p[1] - y0) * K); return X >= 0 && Y >= 0 && X < w && Y < h && celle[Y * w + X] === 1; };
}

/** I pezzi di una spezzata dentro il contorno. Si prova ogni mezzo mm per trovare dove si esce; nei pezzi restano solo i vertici e i tagli. */
export function pezziDentro(t: Xy[], dentro: (p: Xy) => boolean): Xy[][] {
  const pezzi: Xy[][] = [];
  let ora: Xy[] | null = null, ultimo: Xy | null = null;
  const chiudi = (): void => { if (ora) { if (ora[ora.length - 1] !== ultimo) ora.push(ultimo!); pezzi.push(ora); ora = null; } };
  const entra = (p: Xy, vertice: boolean): void => {
    if (dentro(p)) { if (!ora) ora = [p]; else if (vertice) ora.push(p); ultimo = p; } else chiudi();
  };
  entra(t[0], true);
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / 0.5));
    for (let k = 1; k <= n; k++) entra(k === n ? t[i] : [t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n], k === n);
  }
  chiudi();
  return pezzi.filter((x) => x.length > 1 && lunghezza(x) >= 1);
}

// ---- il bordo e le corsie: i passaggi lunghi vanno fuori dal contorno, ognuno sulla sua corsia ----
interface Bordo { a: Xy[]; cum: number[]; giro: number; fuori: number; occupate: Uint8Array[] }
export function preparaBordo(anello: Xy[]): Bordo {
  const a = d(anello[0], anello[anello.length - 1]) < 0.01 ? anello : [...anello, anello[0]];
  const cum = [0];
  for (let i = 1; i < a.length; i++) cum.push(cum[i - 1] + d(a[i - 1], a[i]));
  const area = a.reduce((s, p, i) => (i ? s + a[i - 1][0] * p[1] - p[0] * a[i - 1][1] : 0), 0);
  return { a, cum, giro: cum[cum.length - 1], fuori: area > 0 ? 1 : -1, occupate: [] };
}
function sulBordo(b: Bordo, q: Xy): { e: number; s: number } {
  let e = Infinity, s = 0;
  for (let i = 1; i < b.a.length; i++) {
    const l = b.cum[i] - b.cum[i - 1], dx = b.a[i][0] - b.a[i - 1][0], dy = b.a[i][1] - b.a[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((q[0] - b.a[i - 1][0]) * dx + (q[1] - b.a[i - 1][1]) * dy) / (l * l))) : 0;
    const x = d(q, [b.a[i - 1][0] + dx * f, b.a[i - 1][1] + dy * f]);
    if (x < e) { e = x; s = b.cum[i - 1] + f * l; }
  }
  return { e, s };
}
function puntoSulBordo(b: Bordo, s: number): Xy {
  const x = ((s % b.giro) + b.giro) % b.giro;
  let i = 1, lo = 1, hi = b.cum.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (b.cum[m] < x) lo = m + 1; else { i = m; hi = m - 1; } }
  const l = b.cum[i] - b.cum[i - 1] || 1, f = (x - b.cum[i - 1]) / l;
  return [b.a[i - 1][0] + (b.a[i][0] - b.a[i - 1][0]) * f, b.a[i - 1][1] + (b.a[i][1] - b.a[i - 1][1]) * f];
}
/** La strada da a a b sulla prima corsia libera. Null se i capi sono lontani dal bordo o la strada è troppo più lunga. */
export function stradaInCorsia(b: Bordo, a0: Xy, b0: Xy, p: ParametriRete): { t: Xy[]; corsia: number } | null {
  const pa = sulBordo(b, a0), pb = sulBordo(b, b0);
  if (pa.e > 10 || pb.e > 10) return null;
  const avanti = ((pb.s - pa.s) % b.giro + b.giro) % b.giro;
  const verso = avanti <= b.giro - avanti ? 1 : -1, lungo = verso > 0 ? avanti : b.giro - avanti;
  if (lungo + pa.e + pb.e > d(a0, b0) * 2.5 + 10) return null;
  const bins: number[] = [];
  for (let k = 0; k <= lungo; k += 1) bins.push(Math.floor((((pa.s + verso * k) % b.giro) + b.giro) % b.giro));
  let c = 0;
  for (; c < 40; c++) {
    if (!b.occupate[c]) b.occupate[c] = new Uint8Array(Math.ceil(b.giro) + 1);
    const libera = b.occupate[c];
    if (bins.every((x) => !libera[x])) break;
  }
  if (c === 40) c = 39;
  for (const x of bins) b.occupate[c][x] = 1;
  const off = p.primaCorsiaMm + c * p.passoCorsiaMm;
  const sposta = (s: number): Xy => {
    const q = puntoSulBordo(b, s), u = puntoSulBordo(b, s - 2), v = puntoSulBordo(b, s + 2), dx = v[0] - u[0], dy = v[1] - u[1], l = Math.hypot(dx, dy) || 1;
    return [q[0] + ((b.fuori * dy) / l) * off, q[1] + ((-b.fuori * dx) / l) * off];
  };
  const via: Xy[] = [];
  for (let k = 0; k <= lungo; k += 2) via.push(sposta(pa.s + verso * k));
  via.push(sposta(pb.s));
  return { t: [a0, ...via.filter((q) => d(q, a0) > 0.05 && d(q, b0) > 0.05), b0], corsia: c };
}

export interface OggettoRete { tipo: OggettoModulo['tipo']; t: Xy[]; punti: Xy[]; cella: Cella }
export interface ContiRete {
  moduli: number; basi: number; catenelle: number; passaggi: number; punti: number; filoMm: number;
  tagliSulleCorsie: number; corsieUsate: number; corsiaPiuLontanaMm: number; passiLunghi: number; movimentiLunghi: number;
}
export interface EsitoRete { oggetti: OggettoRete[]; conti: ContiRete; celle: Cella[]; anello: Xy[] }

/** L'anello più grande del contorno, in coordinate [x, y]. Gli altri non si usano: le aree vuote non ci sono ancora. */
export function anelloDiContorno(sagoma: Contour[]): Xy[] {
  let meglio: Point[] | null = null, area = -1;
  for (const c of sagoma) {
    const pts = c.points;
    const a = Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0));
    if (a > area) { area = a; meglio = pts; }
  }
  return (meglio ?? []).map((p) => [p.x, p.y]);
}

/** Il ricamo: ogni cella col suo modulo, tagliato sul contorno, nell'ordine di cucitura del modulo. */
export function costruisciRete(modulo: ModuloRete, anello: Xy[], p: ParametriRete): EsitoRete {
  const xs = anello.map((q) => q[0]), ys = anello.map((q) => q[1]);
  const ingombro: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const partenza = modulo.origine ?? [ingombro[0], ingombro[1]];
  const celle = griglia(ingombro, modulo, [partenza[0] + p.spostaXMm, partenza[1] + p.spostaYMm]);
  const dentro = maschera(anello, p.margineMm);
  const bordo = preparaBordo(anello);
  const catenellaIntera = (v: { oggetti: OggettoModulo[] }): number => v.oggetti.reduce((s, o) => s + (o.tipo === 'catenella' ? lunghezza(o.t) : 0), 0);
  const intere = { A: catenellaIntera(modulo.varianti.A), B: catenellaIntera(modulo.varianti.B) };
  const oggetti: OggettoRete[] = [];
  const conti: ContiRete = { moduli: 0, basi: 0, catenelle: 0, passaggi: 0, punti: 0, filoMm: 0, tagliSulleCorsie: 0, corsieUsate: 0, corsiaPiuLontanaMm: 0, passiLunghi: 0, movimentiLunghi: 0 };
  for (const cella of celle) {
    const usati: OggettoRete[] = [];
    for (const o of modulo.varianti[cella.variante].oggetti) {
      if (o.tipo === 'base' && (o.passata ?? 1) > p.passate) continue;
      const pezzi = pezziDentro(o.t.map((q): Xy => [q[0] + cella.dx, q[1] + cella.dy]), dentro);
      if (!pezzi.length) continue;
      if (o.tipo === 'catenella') {
        for (const x of pezzi) usati.push({ tipo: 'catenella', t: x, punti: catenella(x, p), cella });
        continue;
      }
      const passo = o.tipo === 'base' ? p.puntoBaseMm : p.puntoPassaggioMm;
      let punti = ricampiona(pezzi[0], passo);
      for (let i = 1; i < pezzi.length; i++) {
        const a = pezzi[i - 1][pezzi[i - 1].length - 1], b = pezzi[i][0];
        const s = p.corsie ? stradaInCorsia(bordo, a, b, p) : null;
        if (s) {
          punti = punti.concat(ricampiona(s.t, passo).slice(1));
          conti.tagliSulleCorsie++;
          conti.corsieUsate = Math.max(conti.corsieUsate, s.corsia + 1);
          conti.corsiaPiuLontanaMm = Math.max(conti.corsiaPiuLontanaMm, p.primaCorsiaMm + s.corsia * p.passoCorsiaMm);
        } else if (d(a, b) > MOVIMENTO_LUNGO_MM) conti.passiLunghi++;
        punti = punti.concat(ricampiona(pezzi[i], passo).slice(s ? 1 : 0));
      }
      usati.push({ tipo: o.tipo, t: pezzi.flat(), punti, cella });
    }
    // un pezzo di modulo sul bordo si tiene solo se porta abbastanza catenella: sul file di riferimento il taglio cade fra il 21% e il 24%
    const dentroMm = usati.reduce((s, o) => s + (o.tipo === 'catenella' ? lunghezza(o.t) : 0), 0);
    if (dentroMm <= 0 || dentroMm < (intere[cella.variante] * p.moduloMinimoPct) / 100) continue;
    conti.moduli++;
    // il filo non si taglia dentro un modulo (Lorenzo: «senza salti o passaggi»): dove il taglio sul contorno lascia un movimento lungo fra due oggetti, gira su una corsia
    const continui: OggettoRete[] = [];
    for (const o of usati) {
      if (!o.punti.length) continue;
      const prima = continui[continui.length - 1]?.punti;
      if (prima && d(prima[prima.length - 1], o.punti[0]) > MOVIMENTO_LUNGO_MM) {
        const s = p.corsie ? stradaInCorsia(bordo, prima[prima.length - 1], o.punti[0], p) : null;
        if (s) {
          continui.push({ tipo: 'passaggio', t: s.t, punti: ricampiona(s.t, p.puntoPassaggioMm), cella });
          conti.tagliSulleCorsie++;
          conti.corsieUsate = Math.max(conti.corsieUsate, s.corsia + 1);
          conti.corsiaPiuLontanaMm = Math.max(conti.corsiaPiuLontanaMm, p.primaCorsiaMm + s.corsia * p.passoCorsiaMm);
        } else conti.movimentiLunghi++;
      }
      continui.push(o);
    }
    for (const o of continui) {
      if (o.tipo === 'base') conti.basi++; else if (o.tipo === 'catenella') conti.catenelle++; else conti.passaggi++;
      conti.punti += o.punti.length;
      conti.filoMm += lunghezza(o.punti);
      oggetti.push(o);
    }
  }
  return { oggetti, conti, celle, anello };
}

const TINTE = ['#a5432f', '#2a6db0', '#1f8a5f', '#8a4fa6', '#c07a15', '#277f8e'];
/** Uno strato per modulo: nel DST ogni modulo è un cambio ago, come nel file di riferimento. */
// nel modulo di riferimento due oggetti consecutivi distano fino a 5,46 mm, senza salti; i capi delle maglie aggiungono fino a un passo
const MOVIMENTO_LUNGO_MM = 7;

/** L'ingombro di contorno e punti, 5 mm di aria. A cicli: i punti sono centinaia di migliaia e non stanno negli argomenti di Math.min. */
export function riquadroRete(anello: Xy[], oggetti: Array<{ punti: Xy[] }>): { x0: number; y0: number; w: number; h: number } {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const guarda = (p: Xy): void => { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; };
  anello.forEach(guarda);
  for (const o of oggetti) o.punti.forEach(guarda);
  return { x0: a - 5, y0: b - 5, w: c + 5 - (a - 5), h: d + 5 - (b - 5) };
}

/** Gli oggetti di un modulo in un filo solo: un tratto nuovo, e quindi un salto, solo dove resta un movimento lungo. */
function tratti(lista: OggettoRete[]): Polyline[] {
  const out: Polyline[] = [];
  let ultimo: Xy | null = null;
  for (const o of lista) {
    if (!ultimo || d(ultimo, o.punti[0]) > MOVIMENTO_LUNGO_MM) out.push([]);
    const corrente = out[out.length - 1];
    for (const [x, y] of o.punti) corrente.push({ x, y });
    ultimo = o.punti[o.punti.length - 1];
  }
  return out;
}

export function stratiRete(e: EsitoRete): ExportLayer[] {
  const perCella = new Map<Cella, OggettoRete[]>();
  for (const o of e.oggetti) { const l = perCella.get(o.cella); if (l) l.push(o); else perCella.set(o.cella, [o]); }
  const strati: ExportLayer[] = [];
  for (const [cella, lista] of perCella) {
    strati.push({
      id: `modulo-r${cella.riga}-c${cella.colonna}`, color: TINTE[((cella.colonna % TINTE.length) + TINTE.length) % TINTE.length],
      polylines: tratti(lista),
    });
  }
  return strati;
}

export interface IngressoRete extends Ingresso {
  /** Il modulo da ripetere; assente: quello di esempio. */
  modulo?: ModuloRete;
}

export const motore: Motore<IngressoRete, Partial<ParametriRete>> = {
  id: 'rete-catenella',
  async genera(ingresso, params) {
    const avvisi: string[] = [];
    const anello = anelloDiContorno(ingresso.sagoma ?? []);
    if (anello.length < 3) return { strati: [], avvisi: ['Serve un contorno chiuso.'] } satisfies Risultato;
    if ((ingresso.sagoma?.length ?? 0) > 1) avvisi.push('Il contorno ha più anelli: si usa il più grande, gli altri non contano.');
    const e = costruisciRete(ingresso.modulo ?? moduloDiEsempio(), anello, { ...PARAMETRI_RETE, ...params });
    if (e.conti.passiLunghi) avvisi.push(`${e.conti.passiLunghi} passi lunghi: i loro capi sono lontani dal bordo, le corsie non li raggiungono.`);
    const strati = stratiRete(e);
    return { strati, avvisi, misure: misuraDst(dstFromExportLayers(strati, { center: false, label: 'RETE-CATENELLA' })) };
  },
};

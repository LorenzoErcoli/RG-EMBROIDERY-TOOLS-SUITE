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
import { conDeviazioni, infittisciModulo, type Deviazione, type EsitoInfittimento } from './infittisci';

export type Xy = [number, number];

export interface OggettoModulo {
  tipo: 'base' | 'catenella' | 'passaggio';
  /** Di una base: quale passata è, nella sua metà del modulo (1, 2, 3). */
  passata?: number;
  t: Xy[];
  /** Una linea aggiunta dall'infittimento, non del modulo com'è. */
  nuovo?: boolean;
  /** Di una base: le linee nuove su cui fa andata e ritorno. */
  deviazioni?: Deviazione[];
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
  collegaModuli: boolean;
  uscitaFuoriMm: number;
  /** I pezzi dei moduli sotto la soglia si attaccano al modulo vicino, senza cambi ago in più. */
  pezziSulBordo: boolean;
  /** Un pezzo con meno catenella di così non si cuce. */
  pezzoMinimoMm: number;
  psilVero: boolean;
  infittisci: boolean;
  magliaMassimaMm2: number;
  infittisciVariante: number;
  corsie: boolean;
  primaCorsiaMm: number;
  passoCorsiaMm: number;
}

/** I valori di serie sono quelli misurati sul file di riferimento. */
export const PARAMETRI_RETE: ParametriRete = {
  passate: 3, puntoBaseMm: 2.5, puntoPassaggioMm: 2.5,
  psilLunghezzaMm: 2.5, psilLarghezzaMm: 1.3, psilPassoMm: 1.7, psilInizioMm: 0.6, psilGiri: 2,
  margineMm: 0, spostaXMm: 0, spostaYMm: 0, moduloMinimoPct: 22, pezziSulBordo: true, pezzoMinimoMm: 30, collegaModuli: false, uscitaFuoriMm: 20, psilVero: true,
  infittisci: false, magliaMassimaMm2: 20, infittisciVariante: 1,
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

export interface OggettoRete {
  tipo: OggettoModulo['tipo']; t: Xy[]; punti: Xy[]; cella: Cella;
  /** Una linea dell'infittimento. */
  nuovo?: boolean;
  /** Il filo che porta al modulo dopo. */
  collegamento?: boolean;
  /** L'uscita del modulo: sotto i moduli dopo e fuori dal contorno, dove cambia ago. */
  uscita?: boolean;
  /** Un pezzo di un modulo scartato, cucito col modulo vicino. */
  pezzo?: boolean;
}
export interface ContiRete {
  moduli: number; basi: number; catenelle: number; passaggi: number; punti: number; filoMm: number;
  tagliSulleCorsie: number; corsieUsate: number; corsiaPiuLontanaMm: number; passiLunghi: number; movimentiLunghi: number;
  /** I fili che passano da un modulo al dopo, e quanti non ce l'hanno fatta (lì si salta). */
  collegamenti: number;
  collegamentiMm: number;
  /** Le uscite: quante, i mm sotto le linee dei moduli dopo, e quelli dove i moduli dopo non ci sono più. */
  uscite: number;
  usciteSottoMm: number;
  usciteScoperteMm: number;
  saltiFraModuli: number;
  /** I pezzi attaccati ai moduli vicini, e quelli da cui il filo non arriva al modulo vicino (non si cuciono). */
  pezzi: number;
  pezziSenzaStrada: number;
  lineeNuove: number;
  /** Maglie oltre la soglia rimaste intere, in un periodo della griglia. */
  maglieIntere: number;
  catenellaPerCm2: number;
}
export interface EsitoRete { oggetti: OggettoRete[]; conti: ContiRete; celle: Cella[]; anello: Xy[]; collegati: boolean }

/** Un punto oltre il contorno, sulla normale del punto di bordo più vicino a q. */
function fuoriDalBordo(b: Bordo, q: Xy, mm: number): Xy {
  const s = sulBordo(b, q).s, c = puntoSulBordo(b, s), u = puntoSulBordo(b, s - 2), v = puntoSulBordo(b, s + 2), dx = v[0] - u[0], dy = v[1] - u[1], l = Math.hypot(dx, dy) || 1;
  return [c[0] + ((b.fuori * dy) / l) * mm, c[1] + ((-b.fuori * dx) / l) * mm];
}

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

/** Dijkstra con un mucchio binario. `costo` dà il peso di un arco dalla sua lunghezza e da chi lo possiede; si ferma al primo nodo per cui `arriva` è vero. */
function camminoMinimo(n: number, s: number, archi: Array<Array<[number, number, number?]>>, costo: (l: number, chi: number | undefined) => number, arriva: (x: number) => boolean): { dist: Float64Array; viene: Int32Array; arrivo: number; daChi: Int32Array } {
  const dist = new Float64Array(n).fill(Infinity), viene = new Int32Array(n).fill(-1), daChi = new Int32Array(n).fill(-1);
  const mucchio: Array<[number, number]> = [[0, s]];
  dist[s] = 0;
  let arrivo = -1;
  while (mucchio.length) {
    const [c, x] = mucchio[0];
    const ultimo = mucchio.pop()!;
    if (mucchio.length) {
      mucchio[0] = ultimo;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < mucchio.length && mucchio[l][0] < mucchio[m][0]) m = l;
        if (r < mucchio.length && mucchio[r][0] < mucchio[m][0]) m = r;
        if (m === i) break;
        [mucchio[i], mucchio[m]] = [mucchio[m], mucchio[i]];
        i = m;
      }
    }
    if (c > dist[x]) continue;
    if (arriva(x)) { arrivo = x; break; }
    for (const [y, l, chi] of archi[x] ?? []) {
      const w = c + costo(l, chi);
      if (w >= dist[y]) continue;
      dist[y] = w; viene[y] = x; daChi[y] = chi ?? -1;
      mucchio.push([w, y]);
      for (let i = mucchio.length - 1; i > 0;) {
        const g = (i - 1) >> 1;
        if (mucchio[g][0] <= mucchio[i][0]) break;
        [mucchio[i], mucchio[g]] = [mucchio[g], mucchio[i]];
        i = g;
      }
    }
  }
  return { dist, viene, arrivo, daChi };
}

/**
 * L'uscita di ogni modulo (Lorenzo, 2026-11-03: «alla fine di ogni modulo c'è un'impuntura che esce passando sotto quella successiva, in modo che il
 * cambio ago avviene fuori»). Sul file di riferimento corre tutta sulle linee dei moduli che arrivano dopo, poi oltre il contorno. Qui: la strada più
 * corta fino al bordo, con le linee dei moduli dopo che costano poco e quelle già cucite molto, poi fuori dal contorno.
 * Esce ai lati, a sinistra o a destra (Lorenzo, 2026-11-04: «li farei passare sempre sinistra destra, così i moduli che dovrebbero coprirli arrivano
 * prima»): salire e scendere costa di più, così la linea non attraversa le righe e non aspetta troppo chi la copre. Dove ai lati resterebbe scoperta,
 * per esempio nell'ultima riga, può uscire dal bordo più vicino.
 */
function aggiungiUscite(moduli: Array<{ cella: Cella; oggetti: OggettoRete[] }>, bordo: Bordo, dentro: (q: Xy) => boolean, p: ParametriRete, conti: ContiRete): void {
  const PASSO = 5, PONTE = 3, COSTO_IN_VERTICALE = 3, SCOPERTA_DA_EVITARE_MM = 10;
  const nodi: Xy[] = [], chiavi = new Map<string, number>(), archi: Array<Array<[number, number, number?]>> = [];
  const nodo = (q: Xy): number => {
    const k = `${Math.round(q[0] * 20)},${Math.round(q[1] * 20)}`;
    let i = chiavi.get(k);
    if (i === undefined) { i = nodi.length; nodi.push(q); chiavi.set(k, i); }
    return i;
  };
  const lega = (x: number, y: number, l: number, chi: number): void => { (archi[x] ??= []).push([y, l, chi]); (archi[y] ??= []).push([x, l, chi]); };
  moduli.forEach((m, chi) => {
    // sotto si passa alle catenelle e alla prima andata delle basi: le altre passate stanno sulle stesse linee
    const viste = new Set<OggettoRete>();
    for (const o of m.oggetti) {
      if (o.tipo === 'passaggio' || viste.has(o)) continue;
      viste.add(o);
      for (let i = 1; i < o.t.length; i++) {
        const u = o.t[i - 1], v = o.t[i], l = d(u, v);
        if (!dentro([(u[0] + v[0]) / 2, (u[1] + v[1]) / 2])) continue;
        const n = Math.max(1, Math.ceil(l / PASSO));
        let x = nodo(u);
        for (let s = 1; s <= n; s++) {
          const y = nodo([u[0] + ((v[0] - u[0]) * s) / n, u[1] + ((v[1] - u[1]) * s) / n]);
          if (y !== x) lega(x, y, l / n + COSTO_IN_VERTICALE * Math.abs(nodi[x][1] - nodi[y][1]), chi);
          x = y;
        }
      }
    }
  });
  const griglia = new Map<string, number[]>();
  nodi.forEach((q, i) => { const k = `${Math.floor(q[0] / PONTE)},${Math.floor(q[1] / PONTE)}`; const l = griglia.get(k); if (l) l.push(i); else griglia.set(k, [i]); });
  nodi.forEach((q, i) => {
    const cx = Math.floor(q[0] / PONTE), cy = Math.floor(q[1] / PONTE);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of griglia.get(`${cx + a},${cy + b}`) ?? []) {
      if (j <= i) continue;
      const l = d(q, nodi[j]);
      if (l <= PONTE) lega(i, j, l + COSTO_IN_VERTICALE * Math.abs(q[1] - nodi[j][1]), -1);
    }
  });
  const alBordo = nodi.map((q) => !dentro([q[0] + 1.5, q[1]]) || !dentro([q[0] - 1.5, q[1]]) || !dentro([q[0], q[1] + 1.5]) || !dentro([q[0], q[1] - 1.5]));
  // ai lati: da lì verso sinistra o verso destra non si rientra più nel contorno, quindi non vale il fianco di un incavo
  let x0 = Infinity, x1 = -Infinity;
  for (const q of nodi) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; }
  const libero = (q: Xy, verso: number): boolean => { for (let x = q[0] + verso * 1.5; x > x0 - 5 && x < x1 + 5; x += verso * 4) if (dentro([x, q[1]])) return false; return true; };
  const aiLati = nodi.map((q) => libero(q, -1) || libero(q, 1));
  moduli.forEach((m, i) => {
    const coda = m.oggetti[m.oggetti.length - 1]?.punti;
    if (!coda?.length || !nodi.length) return;
    const da = coda[coda.length - 1];
    let s = 0, e = Infinity;
    nodi.forEach((x, k) => { const c = d(x, da); if (c < e) { e = c; s = k; } });
    const cerca = (arriva: (x: number) => boolean): { viene: Int32Array; arrivo: number; daChi: Int32Array; sottoMm: number; scopertaMm: number } => {
      const r = camminoMinimo(nodi.length, s, archi, (l, chi) => l * (chi === undefined || chi === -1 ? 5 : chi > i ? 1 : 8), arriva);
      let sottoMm = 0, scopertaMm = 0;
      for (let x = r.arrivo; x >= 0 && r.viene[x] >= 0; x = r.viene[x]) {
        const l = d(nodi[x], nodi[r.viene[x]]);
        if (r.daChi[x] > i) sottoMm += l; else scopertaMm += l;
      }
      return { viene: r.viene, arrivo: r.arrivo, daChi: r.daChi, sottoMm, scopertaMm };
    };
    let scelta = cerca((x) => alBordo[x] && aiLati[x]);
    if (scelta.arrivo < 0 || scelta.scopertaMm > SCOPERTA_DA_EVITARE_MM) {
      const altra = cerca((x) => alBordo[x]);
      if (altra.arrivo >= 0 && (scelta.arrivo < 0 || altra.scopertaMm < scelta.scopertaMm - SCOPERTA_DA_EVITARE_MM)) scelta = altra;
    }
    const { viene, arrivo, sottoMm, scopertaMm } = scelta;
    const fine = arrivo >= 0 ? arrivo : s;
    const via: Xy[] = [];
    for (let x = fine; x >= 0; x = viene[x]) via.push(nodi[x]);
    via.reverse();
    const ultimo = via[via.length - 1];
    // la prossima uscita non batte negli stessi punti: la stessa linea costa di più, e il bordo qui intorno è già preso
    for (let x = fine; viene[x] >= 0; x = viene[x]) {
      for (const a of archi[x]) if (a[0] === viene[x]) a[1] *= 3;
      for (const a of archi[viene[x]]) if (a[0] === x) a[1] *= 3;
    }
    nodi.forEach((q, k) => { if (alBordo[k] && d(q, ultimo) < 6) alBordo[k] = false; });
    const t: Xy[] = [da, ...via, fuoriDalBordo(bordo, ultimo, p.uscitaFuoriMm)];
    const o: OggettoRete = { tipo: 'passaggio', t, punti: ricampiona(t, p.puntoPassaggioMm), cella: m.cella, uscita: true };
    m.oggetti.push(o);
    conti.uscite++;
    conti.usciteSottoMm += sottoMm;
    conti.usciteScoperteMm += scopertaMm;
    conti.punti += o.punti.length;
    conti.filoMm += lunghezza(o.punti);
  });
}

/** Il filo da un modulo al dopo: lungo le linee, soprattutto quelle del modulo che arriva, che le cucirà sopra. Null se le linee non si toccano. */
function strada(prima: OggettoRete[], dopo: OggettoRete[], da: Xy, a: Xy, dentro: (q: Xy) => boolean, pesoPrima = 3): Xy[] | null {
  const PASSO = 2.5, PONTE = 3;
  const nodi: Xy[] = [], chiavi = new Map<string, number>();
  const nodo = (q: Xy): number => {
    const k = `${Math.round(q[0] * 20)},${Math.round(q[1] * 20)}`;
    let i = chiavi.get(k);
    if (i === undefined) { i = nodi.length; nodi.push(q); chiavi.set(k, i); }
    return i;
  };
  const archi: Array<Array<[number, number, number?]>> = [];
  const lega = (x: number, y: number, c: number): void => { (archi[x] ??= []).push([y, c]); (archi[y] ??= []).push([x, c]); };
  const linee = (lista: OggettoRete[], peso: number): void => {
    for (const o of lista) {
      for (let i = 1; i < o.t.length; i++) {
        const u = o.t[i - 1], v = o.t[i], l = d(u, v);
        if (!dentro([(u[0] + v[0]) / 2, (u[1] + v[1]) / 2])) continue; // il tratto che salta un taglio sul contorno non è una linea
        const n = Math.max(1, Math.ceil(l / PASSO));
        let x = nodo(u);
        for (let s = 1; s <= n; s++) {
          const y = nodo([u[0] + ((v[0] - u[0]) * s) / n, u[1] + ((v[1] - u[1]) * s) / n]);
          if (y !== x) lega(x, y, (l / n) * peso);
          x = y;
        }
      }
    }
  };
  linee(dopo, 1);
  linee(prima, pesoPrima);
  if (!nodi.length) return null;
  // i ponti fra linee vicine, più cari di ogni linea
  const griglia = new Map<string, number[]>();
  nodi.forEach((q, i) => { const k = `${Math.floor(q[0] / PONTE)},${Math.floor(q[1] / PONTE)}`; const l = griglia.get(k); if (l) l.push(i); else griglia.set(k, [i]); });
  nodi.forEach((q, i) => {
    const cx = Math.floor(q[0] / PONTE), cy = Math.floor(q[1] / PONTE);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of griglia.get(`${cx + a},${cy + b}`) ?? []) {
      if (j <= i) continue;
      const l = d(q, nodi[j]);
      if (l <= PONTE) lega(i, j, l * 5);
    }
  });
  const vicino = (q: Xy): number => { let m = 0, e = Infinity; nodi.forEach((x, i) => { const c = d(x, q); if (c < e) { e = c; m = i; } }); return m; };
  const s = vicino(da), f = vicino(a);
  const { dist, viene } = camminoMinimo(nodi.length, s, archi, (c) => c, (x) => x === f);
  if (dist[f] === Infinity) return null;
  const via: Xy[] = [];
  for (let x = f; x >= 0; x = viene[x]) via.push(nodi[x]);
  via.reverse();
  return [da, ...via, a];
}

const infittiti = new WeakMap<ModuloRete, Map<string, EsitoInfittimento>>();
/** Il calcolo delle maglie costa: per ogni modulo e valori si fa una volta sola. */
function moduloInfittito(modulo: ModuloRete, p: ParametriRete): EsitoInfittimento {
  let m = infittiti.get(modulo);
  if (!m) { m = new Map(); infittiti.set(modulo, m); }
  const k = `${p.magliaMassimaMm2}|${p.infittisciVariante}`;
  let e = m.get(k);
  if (!e) { e = infittisciModulo(modulo, p.magliaMassimaMm2, p.infittisciVariante); m.set(k, e); }
  return e;
}

/** Le caselle da 3 mm per cui passa una linea: due linee nella stessa casella si considerano a contatto. */
function chiaviVicino(t: Xy[]): Set<string> {
  const chiavi = new Set<string>();
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / 1.5));
    for (let s = 0; s <= n; s++) chiavi.add(`${Math.floor((t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * s) / n) / 3)},${Math.floor((t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * s) / n) / 3)}`);
  }
  return chiavi;
}
/** Gli oggetti di una cella scartata che si toccano stanno insieme: ogni gruppo è un pezzo. */
function gruppiDiOggetti(og: OggettoRete[]): OggettoRete[][] {
  const padre = og.map((_, i) => i);
  const trova = (i: number): number => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
  const griglia = new Map<string, number>();
  og.forEach((o, i) => { for (const k of chiaviVicino(o.t)) { const j = griglia.get(k); if (j === undefined) griglia.set(k, i); else padre[trova(i)] = trova(j); } });
  const gruppi = new Map<number, OggettoRete[]>();
  og.forEach((o, i) => { const r = trova(i), l = gruppi.get(r); if (l) l.push(o); else gruppi.set(r, [o]); });
  return [...gruppi.values()];
}

/**
 * L'ordine dentro un pezzo: tagliato sul contorno, quello del modulo farebbe girare il filo più del ricamo. Prima le basi, che si possono cucire nei due
 * versi, poi le catenelle, ognuna la più vicina a dove si è arrivati. I passaggi del modulo collegavano linee che qui non ci sono più: non servono.
 */
function ordinaPezzo(gruppo: OggettoRete[]): OggettoRete[] {
  const fatti: OggettoRete[] = [];
  const vicina = (lista: OggettoRete[], gira: boolean): void => {
    const resto = [...lista];
    while (resto.length) {
      const coda = fatti[fatti.length - 1]?.punti, da = coda ? coda[coda.length - 1] : resto[0].punti[0];
      let k = 0, rovescia = false, e = Infinity;
      resto.forEach((o, i) => {
        const a = d(da, o.punti[0]), b = gira ? d(da, o.punti[o.punti.length - 1]) : Infinity;
        if (a < e) { e = a; k = i; rovescia = false; }
        if (b < e) { e = b; k = i; rovescia = true; }
      });
      const [o] = resto.splice(k, 1);
      fatti.push(rovescia ? { ...o, t: [...o.t].reverse(), punti: [...o.punti].reverse() } : o);
    }
  };
  vicina(gruppo.filter((o) => o.tipo === 'base'), true);
  vicina(gruppo.filter((o) => o.tipo === 'catenella'), false);
  return fatti;
}

/**
 * Il ricamo: ogni cella col suo modulo, tagliato sul contorno, nell'ordine di cucitura del modulo. Le righe vanno a serpentina, così il modulo
 * dopo è sempre vicino. `zona`: dove vale l'infittimento; assente, dappertutto.
 */
export function costruisciRete(modulo: ModuloRete, anello: Xy[], p: ParametriRete, zona?: Xy[] | null): EsitoRete {
  const xs = anello.map((q) => q[0]), ys = anello.map((q) => q[1]);
  const ingombro: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const partenza = modulo.origine ?? [ingombro[0], ingombro[1]];
  const celle = griglia(ingombro, modulo, [partenza[0] + p.spostaXMm, partenza[1] + p.spostaYMm]);
  const dentro = maschera(anello, p.margineMm);
  const bordo = preparaBordo(anello);
  const dentroZona = zona && zona.length >= 3 ? maschera(zona, 0) : null;
  const piu = p.infittisci ? moduloInfittito(modulo, p) : null;
  const lavoro = piu ? piu.modulo : modulo;
  const catenellaIntera = (v: { oggetti: OggettoModulo[] }): number => v.oggetti.reduce((s, o) => s + (o.tipo === 'catenella' && !o.nuovo ? lunghezza(o.t) : 0), 0);
  const intere = { A: catenellaIntera(modulo.varianti.A), B: catenellaIntera(modulo.varianti.B) };
  const oggetti: OggettoRete[] = [];
  const conti: ContiRete = { moduli: 0, basi: 0, catenelle: 0, passaggi: 0, punti: 0, filoMm: 0, tagliSulleCorsie: 0, corsieUsate: 0, corsiaPiuLontanaMm: 0, passiLunghi: 0, movimentiLunghi: 0, collegamenti: 0, collegamentiMm: 0, uscite: 0, usciteSottoMm: 0, usciteScoperteMm: 0, saltiFraModuli: 0, pezzi: 0, pezziSenzaStrada: 0, lineeNuove: 0, maglieIntere: piu?.intere ?? 0, catenellaPerCm2: 0 };
  // coi moduli collegati a serpentina, il dopo è sempre vicino; se no come il file di riferimento, riga per riga
  const inOrdine = [...celle].sort((a, b) => a.riga - b.riga || (p.collegaModuli && ((a.riga % 2) + 2) % 2 !== 0 ? b.colonna - a.colonna : a.colonna - b.colonna));
  const moduli: Array<{ cella: Cella; oggetti: OggettoRete[] }> = [];
  const nellaZona = (t: Xy[], c: Cella): boolean => { if (!dentroZona) return true; const q = t[t.length >> 1]; return dentroZona([q[0] + c.dx, q[1] + c.dy]); };
  let moduloPrima: OggettoRete[] | null = null;
  let catenellaMm = 0;
  // spezza: ogni tratto dentro il contorno è un oggetto a sé, senza corsie: serve per dividere una cella scartata nei suoi pezzi
  const oggettiDi = (cella: Cella, spezza: boolean): { usati: OggettoRete[]; originaleMm: number } => {
    const usati: OggettoRete[] = [];
    let originaleMm = 0;
    for (const o of lavoro.varianti[cella.variante].oggetti) {
      if (o.tipo === 'base' && (o.passata ?? 1) > p.passate) continue;
      if (o.nuovo && !nellaZona(o.t, cella)) continue;
      const attive = o.deviazioni?.filter((x) => nellaZona(x.linea, cella)) ?? [];
      const tracciato = attive.length ? conDeviazioni(o.t, attive) : o.t;
      const pezzi = pezziDentro(tracciato.map((q): Xy => [q[0] + cella.dx, q[1] + cella.dy]), dentro);
      if (!pezzi.length) continue;
      if (o.tipo === 'catenella') {
        for (const x of pezzi) {
          usati.push({ tipo: 'catenella', t: x, punti: catenella(x, p), cella, ...(o.nuovo ? { nuovo: true } : {}) });
          if (!o.nuovo) originaleMm += lunghezza(x);
        }
        continue;
      }
      const passo = o.tipo === 'base' ? p.puntoBaseMm : p.puntoPassaggioMm;
      if (spezza) {
        for (const x of pezzi) usati.push({ tipo: o.tipo, t: x, punti: ricampiona(x, passo), cella });
        continue;
      }
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
    return { usati, originaleMm };
  };
  // un pezzo di modulo sul bordo si tiene solo se porta abbastanza catenella: sul file di riferimento il taglio cade fra il 21% e il 24%
  const spezzate = inOrdine.map((cella) => ({ cella, ...oggettiDi(cella, true) }));
  const tenute = spezzate.filter((c) => c.originaleMm > 0 && c.originaleMm >= (intere[c.cella.variante] * p.moduloMinimoPct) / 100);
  // quello che resta fuori lascia bianco sul bordo (Lorenzo, 2026-11-04: «in maniera automatica si aggiungano pezzi ai moduli dove vicino ci sono i bordi e c'è del bianco»):
  // ogni pezzo va al modulo che tocca di più e si cuce subito prima di lui, così il filo arriva sulle sue linee, che lo copriranno
  const pezziDi = new Map<Cella, OggettoRete[][]>();
  if (p.pezziSulBordo) {
    const contatti = tenute.map((c) => ({ cella: c.cella, chiavi: new Set(c.usati.filter((o) => o.tipo !== 'passaggio').flatMap((o) => [...chiaviVicino(o.t)])) }));
    for (const c of spezzate) {
      if (tenute.includes(c)) continue;
      for (const gruppo of gruppiDiOggetti(c.usati)) {
        if (gruppo.reduce((s, o) => s + (o.tipo === 'catenella' ? lunghezza(o.t) : 0), 0) < p.pezzoMinimoMm) continue;
        const suoi = [...new Set(gruppo.filter((o) => o.tipo !== 'passaggio').flatMap((o) => [...chiaviVicino(o.t)]))];
        let ospite: Cella | null = null, meglio = 0;
        for (const x of contatti) { const n = suoi.reduce((s, k) => s + (x.chiavi.has(k) ? 1 : 0), 0); if (n > meglio) { meglio = n; ospite = x.cella; } }
        if (!ospite) { conti.pezziSenzaStrada++; continue; }
        const qui = ospite;
        const mio = gruppo.map((o): OggettoRete => ({ ...o, cella: qui, pezzo: true }));
        const l = pezziDi.get(ospite);
        if (l) l.push(mio); else pezziDi.set(ospite, [mio]);
      }
    }
  }
  for (const { cella } of tenute) {
    const { usati } = oggettiDi(cella, false);
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
    for (const pezzo of pezziDi.get(cella) ?? []) {
      const gruppo = ordinaPezzo(pezzo), cucito: OggettoRete[] = [];
      for (const [i, o] of gruppo.entries()) {
        const prima = cucito[cucito.length - 1]?.punti;
        if (prima && d(prima[prima.length - 1], o.punti[0]) > MOVIMENTO_LUNGO_MM) {
          const via = strada(cucito, [...gruppo.slice(i), ...continui], prima[prima.length - 1], o.punti[0], dentro, 8);
          if (via) cucito.push({ tipo: 'passaggio', t: via, punti: ricampiona(via, p.puntoPassaggioMm), cella, pezzo: true, collegamento: true });
          else conti.movimentiLunghi++;
        }
        cucito.push(o);
      }
      // dal pezzo al modulo: sulle linee del modulo, che non è ancora cucito
      const a = cucito[cucito.length - 1].punti, fine = a[a.length - 1], b = continui[0].punti[0];
      if (d(fine, b) > MOVIMENTO_LUNGO_MM) {
        const via = strada(cucito, continui, fine, b, dentro, 8);
        if (!via) { conti.pezziSenzaStrada++; continue; }
        cucito.push({ tipo: 'passaggio', t: via, punti: ricampiona(via, p.puntoPassaggioMm), cella, pezzo: true, collegamento: true });
      }
      continui.unshift(...cucito);
      conti.pezzi++;
    }
    // il filo passa al modulo dopo senza tagliarsi (Lorenzo: «i moduli sono tutti rasafilo non sono collegati non va bene»)
    if (p.collegaModuli && moduloPrima?.length && continui.length) {
      const coda = moduloPrima[moduloPrima.length - 1].punti, a = coda[coda.length - 1], b = continui[0].punti[0];
      if (d(a, b) > MOVIMENTO_LUNGO_MM) {
        // se i due moduli non si toccano, per esempio ai lati di un incavo, si cerca fra tutto quello già cucito
        const via = strada(moduloPrima, continui, a, b, dentro) ?? strada(oggetti.filter((o) => o.t.some((q) => q[0] > Math.min(a[0], b[0]) - 60 && q[0] < Math.max(a[0], b[0]) + 60 && q[1] > Math.min(a[1], b[1]) - 60 && q[1] < Math.max(a[1], b[1]) + 60)), continui, a, b, dentro) ?? (p.corsie ? stradaInCorsia(bordo, a, b, p)?.t ?? null : null);
        if (via) {
          const ponte: OggettoRete = { tipo: 'passaggio', t: via, punti: ricampiona(via, p.puntoPassaggioMm), cella, collegamento: true };
          oggetti.push(ponte);
          conti.collegamenti++;
          conti.collegamentiMm += lunghezza(via);
          conti.punti += ponte.punti.length;
          conti.filoMm += lunghezza(ponte.punti);
        } else conti.saltiFraModuli++;
      }
    }
    if (continui.length) { moduloPrima = continui; moduli.push({ cella, oggetti: continui }); }
    for (const o of continui) {
      if (o.tipo === 'base') conti.basi++; else if (o.tipo === 'catenella') { conti.catenelle++; catenellaMm += lunghezza(o.t); if (o.nuovo) conti.lineeNuove++; } else conti.passaggi++;
      conti.punti += o.punti.length;
      conti.filoMm += lunghezza(o.punti);
      oggetti.push(o);
    }
  }
  if (!p.collegaModuli) {
    aggiungiUscite(moduli, bordo, dentro, p, conti);
    oggetti.length = 0;
    for (const m of moduli) oggetti.push(...m.oggetti);
  }
  const area = Math.abs(anello.reduce((s, q, i) => { const r = anello[(i + 1) % anello.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  conti.catenellaPerCm2 = area ? catenellaMm / (area / 100) : 0;
  return { oggetti, conti, celle, anello, collegati: p.collegaModuli };
}

const TINTE = ['#a5432f', '#2a6db0', '#1f8a5f', '#8a4fa6', '#c07a15', '#277f8e'];
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

/** Coi moduli collegati è un filo solo, senza cambi ago; se no uno strato per modulo: nel DST ogni modulo è un cambio ago, come nel file di riferimento. */
export function stratiRete(e: EsitoRete): ExportLayer[] {
  if (e.collegati) return e.oggetti.length ? [{ id: 'rete', color: TINTE[0], polylines: tratti(e.oggetti) }] : [];
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

// PATTERN A MACCHIE (Lorenzo, 2026-10-08): un pannello col suo pattern di base — anche quello che cambia dal
// bordo al centro — e dentro le macchie del disegno un raso, con sopra lo STESSO punto della base.
//
// Le sue decisioni:
// - «ogni macchia riempita con il proprio punto autonomo»; tre stop: la base, il raso di tutte le macchie, il
//   punto sopra di tutte («ho bisogno che le macchie siano divise in 2 stop, lo stop del raso e lo stop del
//   punto sopra»);
// - il raso è verticale, e si può SFRANGIARE (le righe finiscono a lunghezze diverse: niente bordo netto);
// - lo stesso filo; i passaggi nascosti dove si può, altrimenti salti «che puliamo dopo»;
// - «per ora non bucare la base, lasciala tutta intera»;
// - (2026-10-08, dopo la prima prova) «non ricamare tra una macchia e l'altra»: fra due macchie si salta, mai un
//   passaggio sulla base; «puoi gestire tu ingresso e uscita»: si entra dove conviene (un passaggio SOTTO il raso
//   porta all'inizio delle righe) e si esce dal lato della macchia che viene dopo;
// - il punto sopra «fuori dalla macchia non deve mai andare: piuttosto si elimina una parte più corposa»;
// - «si potrebbero provare ad alterare le macchie per farle avvicinare»: i PONTI, facoltativi.
//
// Il punto sopra le macchie NON è un pattern nuovo: è la base stessa, generata una volta sola su tutto il
// pannello e tagliata sul contorno di ogni macchia. Così dentro la macchia il punto riprende esattamente il
// disegno di fuori, al millesimo.
import { buildParallelFill, clipSegmentToPolygon, distanceToBoundary, enforceMinStitch, pointInPolygon, polygonArea, simplifyPolyline, type Point, type Polyline } from '@rg/core';
import { generateFinalPatternPoints, type ImportedBoundary, type PatternConfig } from '@rg/pattern-grammar';

export type ParametriMacchie = {
  /**
   * Se la base si buca sotto le macchie (fermandosi `margineBase` dentro). Lorenzo, 2026-10-08: «per ora non
   * bucare la base, lasciala tutta intera» — spento; il taglio resta pronto per quando servirà.
   */
  bucaLaBase: boolean;
  /** Di quanto la base entra nella macchia quando si buca, mm: il raso la copre. */
  margineBase: number;
  /** Direzione delle righe del raso, gradi (90 = verticale). */
  rasoAngolo: number;
  /** Distanza fra le righe del raso, mm. */
  rasoInterlinea: number;
  /** Punto massimo del raso, mm: le macchie larghe non fanno punti da bordo a bordo. */
  rasoPuntoMax: number;
  /** Sfrangiatura del raso, mm: di quanto, a caso, ogni riga finisce prima o dopo il bordo. 0 = bordo netto. */
  sfrangiatura: number;
  /** Quanta parte della sfrangiatura va oltre il bordo (sulla base), %: il resto resta dentro. */
  sfrangiaturaFuori: number;
  /**
   * Il punto sopra: da un pezzo all'altro si passa SULLE LINEE DEL PUNTO (lo stesso filo sulla stessa linea) o
   * NEL VERSO DEL RASO (il filo si posa fra i fili del raso): non si vede. Fino a tanto, mm; oltre, salto.
   */
  passaggioMax: number;
  /** I gruppi del punto sopra che non si raggiungono senza salto, se più corti di tanto (mm di filo), si tolgono. */
  pezzoMinimo: number;
  /**
   * I PONTI: due macchie che si seguono e sono più vicine di tanto, mm, si uniscono con un ponte di raso — il filo
   * passa dall'una all'altra senza salto. 0 = mai: le macchie restano come nel disegno.
   */
  ponti: number;
  /** La larghezza del ponte, mm. */
  pontiLarghezza: number;
};

/** Il punto più corto del raso, mm: fra una riga e l'altra il punto è l'interlinea. */
const RASO_PUNTO_MIN = 0.3;
/**
 * Il punto più corto del punto sopra, mm. Non quello della base (1 mm): togliendo i punti a meno di 1 mm i
 * passaggi tagliavano gli angoli fino a 0,7 mm fuori dalla linea; a 0,5 restano entro 0,37 mm.
 */
const SOPRA_PUNTO_MIN = 0.5;

export const PARAMETRI_MACCHIE: ParametriMacchie = {
  bucaLaBase: false,
  margineBase: 2,
  rasoAngolo: 90,
  rasoInterlinea: 0.4,
  rasoPuntoMax: 4,
  sfrangiatura: 1,
  sfrangiaturaFuori: 50,
  passaggioMax: 100,
  pezzoMinimo: 3,
  ponti: 0,
  pontiLarghezza: 2,
};

export type Livello = {
  /** I tratti cuciti, in ordine; fra un tratto e il successivo c'è un salto. */
  tratti: Polyline[];
  punti: number;
  salti: number;
};

export type RisultatoMacchie = {
  /** Stop 1: la base su tutto il pannello. */
  base: Livello;
  /** Stop 2: il raso delle macchie, una alla volta (col passaggio sotto il raso per arrivare all'inizio delle righe). */
  raso: Livello;
  /** Stop 3: il punto sopra le macchie, una alla volta, nello stesso ordine. */
  sopra: Livello;
  /** Per vedere i fili coi loro colori: il raso, il punto sopra e i passaggi sotto il raso (sono già in `macchie`). */
  vista: { raso: Polyline[]; sopra: Polyline[]; sotto: Polyline[] };
  /** Le macchie come si cuciono (coi ponti, se ci sono), nell'indice del disegno. */
  forme: Polyline[];
  /** L'ordine delle macchie. */
  ordine: number[];
  /** Quanti ponti, e i salti: fra una macchia e l'altra (nel raso e nel punto sopra, in mm), e dentro (punto sopra in gruppi staccati). */
  ponti: number;
  saltiFra: { raso: number[]; sopra: number[] };
  saltiDentro: number;
  /** Filo del punto sopra tolto (gruppi staccati più corti di `pezzoMinimo`), mm. */
  tolto: number;
  /** I buchi della base: le macchie ristrette del margine (una macchia con un collo stretto ne può dare più d'uno). */
  buchi: Polyline[];
  tempoMs: number;
};

// ---------------------------------------------------------------------------------------------------
// La macchia ristretta: su una griglia fine, perché le macchie hanno colli stretti e un restringimento
// geometrico (`insetPolygon`, buono per le forme convesse) lì si ripiega su sé stesso. Si riempie la macchia,
// si toglie la fascia del margine con la distanza dal bordo e si ritraccia il contorno. Dove la macchia è più
// stretta di due margini il buco sparisce: lì la base resta sotto il raso, ed è quello che serve.

const PASSO_GRIGLIA = 0.1;

export function restringi(macchia: Polyline, margine: number): Polyline[] {
  if (!(margine > 0)) return [macchia];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of macchia) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const g = PASSO_GRIGLIA, W = Math.ceil((x1 - x0) / g) + 3, H = Math.ceil((y1 - y0) / g) + 3;
  const ox = x0 - g, oy = y0 - g;
  // dentro la macchia, riga per riga (pari-dispari sulle intersezioni)
  const dentro = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const y = oy + (j + 0.5) * g, xs: number[] = [];
    for (let i = 0, k = macchia.length - 1; i < macchia.length; k = i++) {
      const a = macchia[i], b = macchia[k];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let t = 0; t + 1 < xs.length; t += 2) {
      for (let i = Math.max(0, Math.ceil((xs[t] - ox) / g - 0.5)); i < W && ox + (i + 0.5) * g < xs[t + 1]; i++) dentro[j * W + i] = 1;
    }
  }
  // tenuta solo la parte più lontana del margine dal bordo: la distanza di ogni cella dentro dalla cella fuori
  // più vicina, con la trasformata esatta (due passate da una dimensione). Confrontare ogni cella con ogni lato
  // della macchia costava 6 s sul pannello di prova; così è una passata sola sulla griglia.
  const d2 = distanzeAlQuadrato(dentro, W, H);
  const soglia = (margine / g) ** 2;
  const tieni = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (dentro[k] && d2[k] > soglia) tieni[k] = 1;
  return contorni(tieni, W, H, ox, oy, g)
    .map((r) => simplifyPolyline(r, 0.05))
    .filter((r) => r.length >= 4 && polygonArea(r) > 0.5);
}

/** Per ogni cella dentro, il quadrato della distanza (in celle) dalla cella fuori più vicina (Felzenszwalb). */
function distanzeAlQuadrato(dentro: Uint8Array, W: number, H: number): Float64Array {
  const INF = 1e20;
  const f = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) f[k] = dentro[k] ? INF : 0;
  const riga = (get: (i: number) => number, set: (i: number, v: number) => void, n: number) => {
    const v = new Int32Array(n), z = new Float64Array(n + 1), val = new Float64Array(n);
    for (let i = 0; i < n; i++) val[i] = get(i);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s2 = ((val[q] + q * q) - (val[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s2 <= z[k]) { k--; s2 = ((val[q] + q * q) - (val[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s2; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; set(q, (q - v[k]) ** 2 + val[v[k]]); }
  };
  for (let i = 0; i < W; i++) riga((j) => f[j * W + i], (j, x) => { f[j * W + i] = x; }, H);
  for (let j = 0; j < H; j++) riga((i) => f[j * W + i], (i, x) => { f[j * W + i] = x; }, W);
  return f;
}

/** I contorni chiusi di una maschera (marching squares sui centri delle celle, segmenti incatenati capo a capo). */
function contorni(m: Uint8Array, W: number, H: number, ox: number, oy: number, g: number): Polyline[] {
  const v = (i: number, j: number) => (i >= 0 && j >= 0 && i < W && j < H ? m[j * W + i] : 0);
  const P = (x: number, y: number): Point => ({ x: ox + (x + 0.5) * g, y: oy + (y + 0.5) * g });
  const segmenti = new Map<string, Point[]>();
  const chiave = (p: Point) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;
  const add = (a: Point, b: Point) => { segmenti.set(chiave(a), [a, b]); };
  for (let j = -1; j < H; j++) for (let i = -1; i < W; i++) {
    const c = (v(i, j) << 3) | (v(i + 1, j) << 2) | (v(i + 1, j + 1) << 1) | v(i, j + 1);
    const t = P(i + 0.5, j), r = P(i + 1, j + 0.5), b = P(i + 0.5, j + 1), l = P(i, j + 0.5);
    switch (c) {
      case 1: add(b, l); break; case 2: add(r, b); break; case 3: add(r, l); break;
      case 4: add(t, r); break; case 5: add(t, l); add(b, r); break; case 6: add(t, b); break;
      case 7: add(t, l); break; case 8: add(l, t); break; case 9: add(b, t); break;
      case 10: add(l, b); add(r, t); break; case 11: add(r, t); break; case 12: add(l, r); break;
      case 13: add(b, r); break; case 14: add(l, b); break;
    }
  }
  const anelli: Polyline[] = [];
  while (segmenti.size) {
    const [k0, s0] = segmenti.entries().next().value as [string, Point[]];
    segmenti.delete(k0);
    const anello = [s0[0], s0[1]];
    for (let guardia = 0; guardia < 1e6; guardia++) {
      const k = chiave(anello[anello.length - 1]);
      const s = segmenti.get(k);
      if (!s) break;
      segmenti.delete(k);
      anello.push(s[1]);
    }
    if (anello.length > 3) anelli.push(anello);
  }
  return anelli;
}

// ---------------------------------------------------------------------------------------------------
// L'ordine delle macchie: la distanza vera fra i contorni, la catena del più vicino, poi migliorie 2-opt e
// or-opt (si sposta un gruppo di 1–3 macchie in un altro punto della fila). Ogni passaggio da una macchia
// all'altra è un salto, salvo dove si toccano (o le unisce un ponte): il costo è la distanza più una penale per
// ogni salto, così l'ordine cerca prima le macchie che si toccano.

const distanzaSegmento = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
};

type Ingombro = { x0: number; y0: number; x1: number; y1: number };
const ingombro = (m: Polyline): Ingombro => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of m) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
};

export function ordinaMacchie(macchie: Polyline[], partenza?: Point, senzaSalto = 0.05): number[] {
  const N = macchie.length;
  if (N < 2) return macchie.map((_, i) => i);
  const bb = macchie.map(ingombro);
  const D = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = bb[i], b = bb[j];
    let d = Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
    d = d < 25 ? distanzaFra(macchie[i], macchie[j]) : d + 5;
    D[i][j] = D[j][i] = d + (d > senzaSalto ? 5 : 0);
  }
  // si parte dalla macchia più vicina a dove finisce la base (o la prima a sinistra)
  let primo = 0;
  if (partenza) { let best = Infinity; for (let i = 0; i < N; i++) { const d = Math.hypot(Math.max(0, bb[i].x0 - partenza.x, partenza.x - bb[i].x1), Math.max(0, bb[i].y0 - partenza.y, partenza.y - bb[i].y1)); if (d < best) { best = d; primo = i; } } }
  else for (let i = 1; i < N; i++) if (bb[i].x0 < bb[primo].x0) primo = i;
  let ord = [primo];
  const visti = new Set(ord);
  while (ord.length < N) {
    const u = ord[ord.length - 1];
    let best = -1, bd = Infinity;
    for (let v = 0; v < N; v++) if (!visti.has(v) && D[u][v] < bd) { bd = D[u][v]; best = v; }
    ord.push(best); visti.add(best);
  }
  const c = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? 0 : D[a][b]);
  for (let giro = 0, meglio = true; meglio && giro < 100; giro++) {
    meglio = false;
    // 2-opt: si gira un tratto della fila (la prima macchia resta la prima)
    for (let i = 1; i < N - 1; i++) for (let j = i + 1; j < N; j++) {
      const a = ord[i - 1], b = ord[i], cc = ord[j], d = ord[j + 1];
      if (c(a, cc) + c(b, d) < c(a, b) + c(cc, d) - 1e-6) { ord = [...ord.slice(0, i), ...ord.slice(i, j + 1).reverse(), ...ord.slice(j + 1)]; meglio = true; }
    }
    // or-opt: un gruppo di 1–3 macchie tolto da dov'è e messo dove costa meno (anche girato)
    for (let L = 1; L <= 3; L++) for (let i = 1; i + L <= N; i++) {
      const gruppo = ord.slice(i, i + L), prima = ord[i - 1], dopo = ord[i + L];
      const togli = c(prima, gruppo[0]) + c(gruppo[L - 1], dopo) - c(prima, dopo);
      const resto = [...ord.slice(0, i), ...ord.slice(i + L)];
      let bestGain = 1e-6, bestJ = -1, bestRev = false;
      for (let j = 0; j < resto.length; j++) {           // dopo resto[j]
        const a = resto[j], b = resto[j + 1];
        for (const rev of [false, true]) {
          const g0 = rev ? gruppo[L - 1] : gruppo[0], g1 = rev ? gruppo[0] : gruppo[L - 1];
          const metti = c(a, g0) + c(g1, b) - c(a, b);
          if (togli - metti > bestGain) { bestGain = togli - metti; bestJ = j; bestRev = rev; }
        }
      }
      if (bestJ >= 0) {
        const g = bestRev ? gruppo.slice().reverse() : gruppo;
        ord = [...resto.slice(0, bestJ + 1), ...g, ...resto.slice(bestJ + 1)];
        meglio = true;
      }
    }
  }
  return ord;
}

/** La distanza fra i contorni di due macchie (0 se si toccano o si sovrappongono). */
function distanzaFra(a: Polyline, b: Polyline): number {
  if (pointInPolygon(a[0], b) || pointInPolygon(b[0], a)) return 0;
  let d = Infinity;
  for (const p of a) for (let k = 0; k < b.length; k++) d = Math.min(d, distanzaSegmento(p, b[k], b[(k + 1) % b.length]));
  for (const p of b) for (let k = 0; k < a.length; k++) d = Math.min(d, distanzaSegmento(p, a[k], a[(k + 1) % a.length]));
  return d;
}

/** I due punti più vicini fra i contorni di due macchie: [su a, su b]. */
function piuVicini(a: Polyline, b: Polyline): [Point, Point, number] {
  let best: [Point, Point, number] = [a[0], b[0], Infinity];
  const sul = (p: Point, q: Point, r: Point): Point => {
    const dx = r.x - q.x, dy = r.y - q.y, l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / l));
    return { x: q.x + dx * t, y: q.y + dy * t };
  };
  for (const p of a) for (let k = 0; k < b.length; k++) {
    const q = sul(p, b[k], b[(k + 1) % b.length]), d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < best[2]) best = [p, q, d];
  }
  for (const p of b) for (let k = 0; k < a.length; k++) {
    const q = sul(p, a[k], a[(k + 1) % a.length]), d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < best[2]) best = [q, p, d];
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------
// I passaggi.

/** La strada più corta SUL contorno dell'anello da `a` a `b` (tutti e due vicini al bordo), coi vertici in mezzo. */
function sulBordo(anello: Polyline, a: Point, b: Point): Polyline {
  const n = anello.length;
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(anello[i % n].x - anello[i - 1].x, anello[i % n].y - anello[i - 1].y));
  const L = cum[n];
  const pos = (p: Point) => {
    let best = { s: 0, d: Infinity, i: 0 };
    for (let i = 0; i < n; i++) {
      const q = anello[i], r = anello[(i + 1) % n], dx = r.x - q.x, dy = r.y - q.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / l2));
      const d = Math.hypot(q.x + dx * t - p.x, q.y + dy * t - p.y);
      if (d < best.d) best = { s: cum[i] + t * (cum[i + 1] - cum[i]), d, i };
    }
    return best;
  };
  const pa = pos(a), pb = pos(b);
  const avanti = ((pb.s - pa.s) % L + L) % L;
  const out: Polyline = [a];
  if (avanti <= L - avanti) for (let k = 0, i = pa.i; k < n && i !== pb.i; k++) { i = (i + 1) % n; out.push(anello[i]); }
  else for (let k = 0, i = pa.i; k < n && i !== pb.i; k++) { out.push(anello[i]); i = (i - 1 + n) % n; }
  out.push(b);
  return out;
}

const lunghezza = (l: Polyline) => { let t = 0; for (let i = 1; i < l.length; i++) t += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); return t; };

/** Una strada da cucire, divisa in punti non più lunghi di `passo`. */
function apasso(via: Polyline, passo: number): Polyline {
  const out: Polyline = [via[0]];
  for (let i = 1; i < via.length; i++) {
    const a = via[i - 1], b = via[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / passo));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

const restaDentro = (a: Point, b: Point, poly: Polyline) => {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.3));
  for (let k = 1; k < n; k++) if (!pointInPolygon({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, poly)) return false;
  return true;
};

/**
 * Cuce dei pezzi in fila dentro un livello: si attacca il pezzo al tratto corrente con `passaggio(da, a)` se
 * dà una strada, altrimenti si salta (tratto nuovo).
 */
function inFila(pezzi: Polyline[], passaggio: (da: Point, a: Point) => Polyline | null, tratti: Polyline[]): void {
  let cur = tratti.length ? tratti[tratti.length - 1] : null;
  for (const p of pezzi) {
    if (p.length < 2) continue;
    const via = cur ? passaggio(cur[cur.length - 1], p[0]) : null;
    if (cur && via) { for (const q of via.slice(1)) cur.push(q); for (const q of p.slice(1)) cur.push(q); }
    else { cur = p.slice(); tratti.push(cur); }
  }
}

const contaPunti = (t: Polyline[]) => t.reduce((s, l) => s + l.length, 0);

/**
 * LA RETE DEL PUNTO: tutte le linee della base intera, spezzate dove si incrociano e dove entrano nelle macchie.
 * Il punto sopra le macchie è cucito su queste stesse linee, e fuori dalle macchie ci sono quelle della base:
 * passare da un pezzo all'altro SOPRA una linea che c'è già, collo stesso filo, non si vede — è un filo in più
 * su una linea cucita. Così si raggiunge anche la punta di un tratto che entra nella macchia da fuori: dentro
 * la macchia è isolata, ma fuori continua nella base.
 *
 * `capi[s]` sono i punti in più sul segmento `s` (nell'ordine delle linee, poi dei segmenti): i capi dei pezzi.
 * Restituisce, da un punto, le strade più corte verso ogni altro punto della rete entro `max` mm.
 */
export type Rete = {
  /** Da un punto, le strade più corte verso gli altri punti della rete entro `max` mm (valide fino alla prossima chiamata). */
  strade: (da: Point, max: number) => (a: Point) => Polyline | null;
  /** Il gruppo di linee collegate a cui appartiene un punto della rete (-1 se non ci sta). */
  gruppo: (p: Point) => number;
};

export function reteDelPunto(linee: Polyline[], capi: Point[][] = [], aggancio = 0): Rete {
  const segs: Array<[Point, Point]> = [];
  const tagli: Array<Array<{ t: number; p: Point }>> = [];
  const proietta = (a: Point, b: Point, p: Point) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; return ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; };
  let n = 0;
  for (const l of linee) for (let k = 1; k < l.length; k++, n++) {
    const a = l[k - 1], b = l[k];
    if (Math.hypot(b.x - a.x, b.y - a.y) <= 1e-6) continue;
    segs.push([a, b]);
    tagli.push([{ t: 0, p: a }, { t: 1, p: b }, ...(capi[n] ?? []).map((p) => ({ t: proietta(a, b, p), p }))]);
  }
  // gli incroci, cercati solo fra i segmenti nella stessa cella di una griglia
  const G = 2, celle = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (let gx = Math.floor(Math.min(a.x, b.x) / G); gx <= Math.floor(Math.max(a.x, b.x) / G); gx++)
      for (let gy = Math.floor(Math.min(a.y, b.y) / G); gy <= Math.floor(Math.max(a.y, b.y) / G); gy++) {
        const k = `${gx},${gy}`, c = celle.get(k);
        if (c) c.push(i); else celle.set(k, [i]);
      }
  });
  const visti = new Set<number>();
  for (const c of celle.values()) for (let x = 0; x < c.length; x++) for (let y = x + 1; y < c.length; y++) {
    const i = c[x], j = c[y], chiaveCoppia = i * segs.length + j;
    if (visti.has(chiaveCoppia)) continue;
    visti.add(chiaveCoppia);
    const [a, b] = segs[i], [cc, d] = segs[j];
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - cc.x, sy = d.y - cc.y, den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((cc.x - a.x) * sy - (cc.y - a.y) * sx) / den, u = ((cc.x - a.x) * ry - (cc.y - a.y) * rx) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
    const p = { x: a.x + rx * t, y: a.y + ry * t };
    tagli[i].push({ t, p });
    tagli[j].push({ t: u, p });
  }
  const chiave = (p: Point) => `${Math.round(p.x * 1e3)},${Math.round(p.y * 1e3)}`;
  const nodi = new Map<string, number>(), pos: Point[] = [], adj: Array<Array<[number, number]>> = [];
  const nodo = (p: Point) => {
    const k = chiave(p);
    let m = nodi.get(k);
    if (m === undefined) { m = pos.length; nodi.set(k, m); pos.push(p); adj.push([]); }
    return m;
  };
  for (const ts of tagli) {
    ts.sort((x, y) => x.t - y.t);
    for (let k = 1; k < ts.length; k++) {
      const u = nodo(ts[k - 1].p), v = nodo(ts[k].p);
      if (u === v) continue;
      const w = Math.hypot(ts[k].p.x - ts[k - 1].p.x, ts[k].p.y - ts[k - 1].p.y);
      adj[u].push([v, w]); adj[v].push([u, w]);
    }
  }
  // un punto che non sta sulla rete (i capi delle righe del raso, sul bordo della macchia) ci si aggancia col
  // nodo più vicino entro `aggancio` mm: un punto dritto e corto, sul bordo della macchia
  const GN = 2, griglia = new Map<string, number[]>();
  pos.forEach((p, i) => { const k = `${Math.floor(p.x / GN)},${Math.floor(p.y / GN)}`, c = griglia.get(k); if (c) c.push(i); else griglia.set(k, [i]); });
  const aggancia = (p: Point): number | undefined => {
    const esatto = nodi.get(chiave(p));
    if (esatto !== undefined || aggancio <= 0) return esatto;
    let best: number | undefined, bd = aggancio;
    for (let gx = Math.floor((p.x - aggancio) / GN); gx <= Math.floor((p.x + aggancio) / GN); gx++)
      for (let gy = Math.floor((p.y - aggancio) / GN); gy <= Math.floor((p.y + aggancio) / GN); gy++)
        for (const i of griglia.get(`${gx},${gy}`) ?? []) { const d = Math.hypot(pos[i].x - p.x, pos[i].y - p.y); if (d <= bd) { bd = d; best = i; } }
    return best;
  };
  // i gruppi collegati
  const padre = new Int32Array(pos.length).map((_, i) => i);
  const radice = (i: number): number => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
  adj.forEach((vicini, u) => { for (const [v] of vicini) padre[radice(u)] = radice(v); });
  const gruppo = (p: Point) => { const n = aggancia(p); return n === undefined ? -1 : radice(n); };
  // da un punto: Dijkstra (coda a heap) fino a `max`, poi la strada verso ogni capo
  const dist = new Float64Array(pos.length).fill(Infinity), prev = new Int32Array(pos.length).fill(-1);
  let toccati: number[] = [];
  const strade = (da: Point, max: number) => {
    for (const v of toccati) { dist[v] = Infinity; prev[v] = -1; }
    toccati = [];
    const s0 = aggancia(da);
    if (s0 === undefined) return (): Polyline | null => null;
    dist[s0] = 0; toccati.push(s0);
    const heap: Array<[number, number]> = [[0, s0]];
    const su = (i: number) => { while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const giu = (i: number) => {
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) return;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    };
    while (heap.length) {
      const [du, u] = heap[0];
      const last = heap.pop()!;
      if (heap.length) { heap[0] = last; giu(0); }
      if (du > dist[u]) continue;
      if (du > max) break;
      for (const [v, w] of adj[u]) {
        const nd = du + w;
        if (nd < dist[v]) {
          if (dist[v] === Infinity) toccati.push(v);
          dist[v] = nd; prev[v] = u;
          heap.push([nd, v]); su(heap.length - 1);
        }
      }
    }
    // (valida fino alla prossima chiamata: le distanze si riusano)
    return (a: Point): Polyline | null => {
      const t0 = aggancia(a);
      if (t0 === undefined || !(dist[t0] <= max)) return null;
      const nodiVia: Point[] = [];
      for (let v = t0; v !== -1; v = prev[v]) nodiVia.push(pos[v]);
      nodiVia.reverse();
      // i capi veri al posto dei nodi (uguali al millesimo, o agganciati entro `aggancio`)
      const stesso = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;
      const via: Polyline = [da, ...nodiVia.filter((p, k) => !(k === 0 && stesso(p, da)) && !(k === nodiVia.length - 1 && stesso(p, a))), a];
      return via.length > 2 ? pulisci(via) : via;
    };
  };
  return { strade, gruppo };
}

/**
 * Una strada sulla rete, da cucire: via i punti in mezzo a un tratto dritto (gli incroci con le altre linee),
 * finché il punto che ne viene non supera `PASSAGGIO_PUNTO_MAX` — un passaggio lungo una spina dritta resta a
 * punti corti, che tengono il filo sulla linea. I punti troppo corti li toglie poi il punto minimo del livello.
 */
const PASSAGGIO_PUNTO_MAX = 4;
function pulisci(via: Polyline): Polyline {
  const out: Polyline = [via[0]];
  for (let k = 1; k < via.length - 1; k++) {
    const a = out[out.length - 1], b = via[k], c = via[k + 1];
    const dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy);
    const fuori = l < 1e-9 ? Math.hypot(b.x - a.x, b.y - a.y) : Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / l;
    if (fuori > 0.02 || l > PASSAGGIO_PUNTO_MAX) out.push(b);
  }
  out.push(via[via.length - 1]);
  return out;
}

/**
 * La base tagliata sui buchi e ricucita: dove la base entra in un buco si gira attorno al buco, sul suo
 * contorno, fino a dove ne esce. I pezzi restano quelli della base intera, al millesimo.
 */
function tagliaSuiBuchi(linee: Polyline[], buchi: Polyline[]): Polyline[] {
  const bb = buchi.map(ingombro);
  const fuori: Polyline[] = [];
  for (const l of linee) {
    let cur: Polyline | null = null;
    let buco = -1;                                   // in quale buco si è entrati, se ci si è
    for (let k = 1; k < l.length; k++) {
      const a = l[k - 1], b = l[k];
      const sx0 = Math.min(a.x, b.x), sx1 = Math.max(a.x, b.x), sy0 = Math.min(a.y, b.y), sy1 = Math.max(a.y, b.y);
      // i tratti del segmento fuori da tutti i buchi, coi buchi che lo tagliano
      let tratti: Array<[Point, Point]> = [[a, b]];
      const tocca: number[] = [];
      for (let i = 0; i < buchi.length; i++) {
        const q = bb[i];
        if (sx1 < q.x0 || sx0 > q.x1 || sy1 < q.y0 || sy0 > q.y1) continue;
        const prossimi: Array<[Point, Point]> = [];
        for (const [p, r] of tratti) prossimi.push(...meno(p, r, buchi[i]));
        if (prossimi.length !== tratti.length || prossimi.some(([p, r], z) => p !== tratti[z]?.[0] || r !== tratti[z]?.[1])) tocca.push(i);
        tratti = prossimi;
      }
      if (!tocca.length && tratti.length === 1 && tratti[0][0] === a) {
        if (!cur) { cur = [a]; fuori.push(cur); }
        cur.push(b);
        continue;
      }
      for (const [p, r] of tratti) {
        if (cur && Math.hypot(cur[cur.length - 1].x - p.x, cur[cur.length - 1].y - p.y) < 1e-9) { cur.push(r); continue; }
        if (cur && buco >= 0) {
          // si era entrati in un buco: si gira sul suo contorno fino a qui
          const via = sulBordo(buchi[buco], cur[cur.length - 1], p);
          for (const q of apasso(via, 3).slice(1)) cur.push(q);
          cur.push(r);
        } else { cur = [p, r]; fuori.push(cur); }
        buco = -1;
      }
      // il segmento finisce dentro un buco? allora il prossimo pezzo si raggiunge girandoci attorno
      const ultimo = tratti[tratti.length - 1];
      if (!ultimo || Math.hypot(ultimo[1].x - b.x, ultimo[1].y - b.y) > 1e-9) {
        buco = buco >= 0 ? buco : tocca.find((i) => pointInPolygon(b, buchi[i]) || (ultimo && distanceToBoundary(ultimo[1], buchi[i]) < 1e-6)) ?? tocca[0];
      }
    }
  }
  return fuori;
}

/** I tratti del segmento a-b FUORI dal poligono. */
function meno(a: Point, b: Point, poly: Polyline): Array<[Point, Point]> {
  const dentro = clipSegmentToPolygon(a, b, poly);
  if (!dentro.length) return [[a, b]];
  const ts: number[] = [];
  const t = (p: Point) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; return ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; };
  for (const [p, q] of dentro) ts.push(t(p), t(q));
  const out: Array<[Point, Point]> = [];
  const at = (u: number): Point => (u <= 0 ? a : u >= 1 ? b : { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  let da = 0;
  for (let i = 0; i < ts.length; i += 2) {
    if (ts[i] - da > 1e-6) out.push([at(da), at(ts[i])]);
    da = ts[i + 1];
  }
  if (1 - da > 1e-6) out.push([at(da), b]);
  return out;
}

// ---------------------------------------------------------------------------------------------------
// L'interno di una macchia, su una griglia: i passaggi SOTTO il raso (dall'ingresso all'inizio delle righe)
// stanno lontani dal bordo più della sfrangiatura, così il raso che viene dopo li copre tutti.

/** Le celle dentro uno o più poligoni (pari-dispari per poligono, unite), su una griglia di passo `g`. */
function rasterizza(poligoni: Polyline[], g: number, ox: number, oy: number, W: number, H: number): Uint8Array {
  const dentro = new Uint8Array(W * H);
  for (const poly of poligoni) for (let j = 0; j < H; j++) {
    const y = oy + (j + 0.5) * g, xs: number[] = [];
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const a = poly[i], b = poly[k];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let t = 0; t + 1 < xs.length; t += 2) {
      for (let i = Math.max(0, Math.ceil((xs[t] - ox) / g - 0.5)); i < W && ox + (i + 0.5) * g < xs[t + 1]; i++) dentro[j * W + i] = 1;
    }
  }
  return dentro;
}

class Interno {
  private readonly g = 0.2;
  private readonly W: number;
  private readonly H: number;
  private readonly ox: number;
  private readonly oy: number;
  private readonly ok: Uint8Array;
  /** L'interno com'era prima del raso: se la strada libera non c'è, si passa qui (sempre dentro la macchia). */
  private readonly tutto: Uint8Array;
  private celle: number[] = [];

  constructor(macchia: Polyline, margine: number) {
    const b = ingombro(macchia), g = this.g;
    this.W = Math.ceil((b.x1 - b.x0) / g) + 3; this.H = Math.ceil((b.y1 - b.y0) / g) + 3;
    this.ox = b.x0 - g; this.oy = b.y0 - g;
    const dentro = rasterizza([macchia], g, this.ox, this.oy, this.W, this.H);
    const d2 = distanzeAlQuadrato(dentro, this.W, this.H);
    let massimo = 0;
    for (let k = 0; k < d2.length; k++) if (dentro[k]) massimo = Math.max(massimo, d2[k]);
    // dove la macchia è più stretta di due margini, il passaggio sta nel mezzo (60% della mezza larghezza)
    const soglia = Math.min((margine / g) ** 2, massimo * 0.36);
    this.ok = new Uint8Array(d2.length);
    for (let k = 0; k < d2.length; k++) if (dentro[k] && d2[k] >= soglia) { this.ok[k] = 1; this.celle.push(k); }
    this.tutto = this.ok.slice();
    this.tutteCelle = this.celle.slice();
  }
  private readonly tutteCelle: number[];

  private centro(k: number): Point { return { x: this.ox + ((k % this.W) + 0.5) * this.g, y: this.oy + (Math.floor(k / this.W) + 0.5) * this.g }; }
  private cella(p: Point, ok: Uint8Array = this.ok): number {
    let best = -1, bd = Infinity;
    for (const k of ok === this.ok ? this.celle : this.tutteCelle) { const c = this.centro(k), d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  }
  /**
   * Il raso appena cucito non si attraversa più: le sue celle escono dall'interno, così il passaggio verso la
   * parte dopo gira attorno a quello che c'è già (dove non può, ci passa sopra, ma sempre dentro la macchia).
   */
  occupa(righe: Polyline[]): void {
    const g = this.g;
    for (const r of righe) for (let k = 1; k < r.length; k++) {
      const a = r[k - 1], b = r[k], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (g / 2)));
      for (let t = 0; t <= n; t++) {
        const i = Math.floor((a.x + ((b.x - a.x) * t) / n - this.ox) / g), j = Math.floor((a.y + ((b.y - a.y) * t) / n - this.oy) / g);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const x = i + di, y = j + dj;
          if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.ok[y * this.W + x] = 0;
        }
      }
    }
    this.celle = this.celle.filter((k) => this.ok[k]);
  }

  /** Il punto dell'interno più vicino a `p` (o `p` stesso, se la macchia non ha interno). */
  vicino(p: Point): Point { const k = this.cella(p); return k < 0 ? p : this.centro(k); }
  private libero(a: Point, b: Point, ok: Uint8Array): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (this.g / 2)));
    for (let t = 0; t <= n; t++) {
      const x = a.x + ((b.x - a.x) * t) / n, y = a.y + ((b.y - a.y) * t) / n;
      const i = Math.floor((x - this.ox) / this.g), j = Math.floor((y - this.oy) / this.g);
      if (i < 0 || j < 0 || i >= this.W || j >= this.H || !ok[j * this.W + i]) return false;
    }
    return true;
  }
  /** La strada più corta dentro, da `a` a `b` (A* sulla griglia, poi tirata dritta dove si vede). */
  strada(a: Point, b: Point): Polyline {
    const libera = this.cerca(a, b, this.ok);
    return libera ?? this.cerca(a, b, this.tutto) ?? [a, b];
  }

  private cerca(a: Point, b: Point, ok: Uint8Array): Polyline | null {
    // i capi: le celle più vicine dell'interno intero (anche se già cucite: ci si parte e ci si arriva)
    const s0 = this.cella(a, this.tutto), t0 = this.cella(b, this.tutto);
    if (s0 < 0 || t0 < 0) return null;
    if (s0 === t0) return [a, b];
    const W = this.W, n = ok.length;
    const gcost = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), chiuso = new Uint8Array(n);
    const tx = t0 % W, ty = Math.floor(t0 / W);
    const h = (k: number) => { const dx = Math.abs((k % W) - tx), dy = Math.abs(Math.floor(k / W) - ty); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
    const heap: Array<[number, number]> = [[h(s0), s0]];
    gcost[s0] = 0;
    const su = (i: number) => { while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const giu = (i: number) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) return; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
    const passi = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [, u] = heap[0];
      const last = heap.pop()!;
      if (heap.length) { heap[0] = last; giu(0); }
      if (chiuso[u]) continue;
      chiuso[u] = 1;
      if (u === t0) break;
      const ux = u % W, uy = Math.floor(u / W);
      for (const [dx, dy, w] of passi) {
        const vx = ux + dx, vy = uy + dy;
        if (vx < 0 || vy < 0 || vx >= W || vy >= this.H) continue;
        const v = vy * W + vx;
        if ((!ok[v] && v !== t0) || chiuso[v]) continue;
        const nd = gcost[u] + w;
        if (nd < gcost[v]) { gcost[v] = nd; prev[v] = u; heap.push([nd + h(v), v]); su(heap.length - 1); }
      }
    }
    if (prev[t0] < 0) return null;
    const celle: Point[] = [];
    for (let k = t0; k !== -1; k = prev[k]) celle.push(this.centro(k));
    celle.reverse();
    // tirata dritta: dall'ultimo punto tenuto, il più lontano che si vede
    const out: Polyline = [a, celle[0]];
    let i = 0;
    while (i < celle.length - 1) {
      let j = celle.length - 1;
      while (j > i + 1 && !this.libero(celle[i], celle[j], ok)) j--;
      out.push(celle[j]);
      i = j;
    }
    out.push(b);
    return out;
  }
}

/** La corda della macchia nel verso `u` che passa per `p` (p compreso come vertice): dove il filo si posa nel raso. */
function corda(macchia: Polyline, p: Point, u: Point): Polyline | null {
  const ts: number[] = [0];
  for (let i = 0, k = macchia.length - 1; i < macchia.length; k = i++) {
    const a = macchia[k], b = macchia[i], ex = b.x - a.x, ey = b.y - a.y, den = u.x * ey - u.y * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den, s2 = ((a.x - p.x) * u.y - (a.y - p.y) * u.x) / den;
    if (s2 >= -1e-9 && s2 <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const at = (t: number): Point => ({ x: p.x + u.x * t, y: p.y + u.y * t });
  let da: number | null = null, a2: number | null = null;
  for (let k = 0; k + 1 < ts.length; k++) {
    if (ts[k + 1] - ts[k] < 1e-6 || ts[k] > 1e-6 || ts[k + 1] < -1e-6) continue;   // gli intervalli che toccano p
    if (!pointInPolygon(at((ts[k] + ts[k + 1]) / 2), macchia)) continue;
    da = da === null ? ts[k] : Math.min(da, ts[k]);
    a2 = a2 === null ? ts[k + 1] : Math.max(a2, ts[k + 1]);
  }
  if (da === null || a2 === null || a2 - da < 0.05) return null;
  const out: Polyline = [];
  if (da < -1e-6) out.push(at(da));
  out.push(p);
  if (a2 > 1e-6) out.push(at(a2));
  return out.length > 1 ? out : null;
}

/** Un numero a caso fra 0 e 1, sempre lo stesso per gli stessi tre interi: stesso disegno, stesso ricamo. */
function caso(a: number, b: number, c: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Le CELLE del raso: le righe in ordine di avanzamento; una riga continua la cella della riga di prima se si
 * sovrappongono e nessun'altra delle due righe ci si sovrappone (dove la macchia si divide o si riunisce, cella
 * nuova). `u` è il verso delle righe.
 */
function celleDelRaso(righe: Polyline[], u: Point, interlinea: number): Polyline[][] {
  const n = { x: -u.y, y: u.x };
  type Info = { r: Polyline; s: number; lo: number; hi: number };
  const info: Info[] = righe.filter((r) => r.length >= 2).map((r) => {
    const a = r[0], b = r[r.length - 1], t0 = a.x * u.x + a.y * u.y, t1 = b.x * u.x + b.y * u.y;
    // tutte nello stesso verso: la serpentina la fa chi le cuce
    return { r: t0 <= t1 ? r : r.slice().reverse(), s: a.x * n.x + a.y * n.y, lo: Math.min(t0, t1), hi: Math.max(t0, t1) };
  });
  info.sort((p, q) => p.s - q.s || p.lo - q.lo);
  const celle: Array<{ righe: Info[]; ultima: Info }> = [];
  let aperte: typeof celle = [];
  for (let k = 0; k < info.length;) {
    let j = k;
    while (j < info.length && Math.abs(info[j].s - info[k].s) < interlinea * 0.25) j++;
    const livello = info.slice(k, j);
    const tocca = (a: Info, b: Info) => a.lo < b.hi && b.lo < a.hi && Math.abs(a.s - b.s) < interlinea * 1.6;
    const nuove: typeof celle = [];
    for (const x of livello) {
      const sopra = aperte.filter((c) => tocca(c.ultima, x));
      const c0 = sopra.length === 1 ? sopra[0] : null;
      if (c0 && livello.filter((y) => tocca(c0.ultima, y)).length === 1) { c0.righe.push(x); c0.ultima = x; nuove.push(c0); }
      else { const c = { righe: [x], ultima: x }; celle.push(c); nuove.push(c); }
    }
    aperte = nuove;
    k = j;
  }
  return celle.map((c) => c.righe.map((x) => x.r));
}

/**
 * LA SFRANGIATURA: ogni riga del raso finisce, a caso, un po' prima o un po' dopo il bordo — fino a `dentro` mm
 * prima, `fuori` mm dopo. Il bordo della macchia non è più una linea netta. Si spostano solo i capi della riga:
 * i punti in mezzo restano (via quelli che la riga accorciata non raggiunge più).
 */
function sfrangia(riga: Polyline, macchia: number, n: number, dentro: number, fuori: number): Polyline | null {
  if (dentro <= 0 && fuori <= 0) return riga;
  const a = riga[0], b = riga[riga.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1e-6) return null;
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const s0 = dentro - caso(macchia, n, 0) * (dentro + fuori);         // dove comincia, lungo la riga
  const s1 = L - dentro + caso(macchia, n, 1) * (dentro + fuori);     // dove finisce
  if (s1 - s0 < 0.4) return null;
  const at = (s: number): Point => ({ x: a.x + u.x * s, y: a.y + u.y * s });
  const mezzo = riga.slice(1, -1).filter((q) => { const s = (q.x - a.x) * u.x + (q.y - a.y) * u.y; return s > s0 + 0.3 && s < s1 - 0.3; });
  return [at(s0), ...mezzo, at(s1)];
}

/**
 * IL PONTE: `b` allargata fino a toccare `a` con una striscia larga `larghezza` mm fra i loro punti più vicini
 * (dentro `a` di mezzo millimetro, così il passaggio dall'una all'altra resta tutto dentro). Su griglia, come il
 * restringimento: unire due poligoni a mano non regge le macchie con le insenature.
 */
function conPonte(a: Polyline, b: Polyline, larghezza: number): { forma: Polyline; da: Point; a: Point } {
  const [pa, pb, d] = piuVicini(a, b);
  if (d < 1e-6) return { forma: b, da: pa, a: pb };
  const u = { x: (pb.x - pa.x) / d, y: (pb.y - pa.y) / d }, n = { x: -u.y, y: u.x }, w = larghezza / 2, e = 0.5;
  const striscia: Polyline = [
    { x: pa.x - u.x * e + n.x * w, y: pa.y - u.y * e + n.y * w }, { x: pb.x + u.x * e + n.x * w, y: pb.y + u.y * e + n.y * w },
    { x: pb.x + u.x * e - n.x * w, y: pb.y + u.y * e - n.y * w }, { x: pa.x - u.x * e - n.x * w, y: pa.y - u.y * e - n.y * w },
  ];
  const tutti = [...b, ...striscia], q = ingombro(tutti), g = PASSO_GRIGLIA;
  const W = Math.ceil((q.x1 - q.x0) / g) + 3, H = Math.ceil((q.y1 - q.y0) / g) + 3, ox = q.x0 - g, oy = q.y0 - g;
  const anelli = contorni(rasterizza([b, striscia], g, ox, oy, W, H), W, H, ox, oy, g).map((r) => simplifyPolyline(r, 0.05));
  anelli.sort((x, y) => Math.abs(polygonArea(y)) - Math.abs(polygonArea(x)));
  return { forma: anelli[0] && anelli[0].length >= 4 ? anelli[0] : b, da: pa, a: pb };
}

// ---------------------------------------------------------------------------------------------------

/**
 * Il programma: la base sul pannello, poi le macchie una alla volta. Per ogni macchia: si entra dal punto più
 * vicino a dove si è usciti dalla macchia di prima, si va SOTTO il raso fino all'inizio delle righe, il raso, e
 * sopra il punto della base; si esce dal lato della macchia che viene dopo.
 */
export function costruisciMacchie(
  pannello: Polyline, macchie: Polyline[], pattern: PatternConfig, par: ParametriMacchie = PARAMETRI_MACCHIE,
): RisultatoMacchie {
  const t0 = Date.now();
  const bbP = ingombro(pannello);
  const formato = { totalWidth: Math.ceil(bbP.x1) + 1, totalHeight: Math.ceil(bbP.y1) + 1 };
  const sagoma = (buchi: Polyline[]): ImportedBoundary => ({
    id: 'pannello', sourceFileName: 'pannello', sourceType: 'svg',
    paths: [{ id: 'pannello', points: pannello, closed: true }, ...buchi.map((b, i) => ({ id: `buco-${i}`, points: b, closed: true, hole: true }))],
    bounds: { minX: bbP.x0, minY: bbP.y0, maxX: bbP.x1, maxY: bbP.y1 },
  });
  const comune = { ...pattern, ...formato, shapeType: 'imported' as const, voidStitchMm: 0 };

  // 1. LA BASE INTERA, una volta sola: è la base E il punto sopra le macchie, così i due coincidono al millesimo.
  const intera = generateFinalPatternPoints({ ...comune, importedBoundary: sagoma([]) }).visualPolylines
    .map((l) => l.map((p) => ({ x: p.x, y: p.y })));

  // 2. LA BASE: intera (o, se un giorno servirà, tagliata sulle macchie ristrette del margine).
  const buchi = par.bucaLaBase ? macchie.flatMap((m) => restringi(m, par.margineBase)) : [];
  const baseLinee = buchi.length ? tagliaSuiBuchi(intera, buchi) : intera;
  const fineBase = baseLinee.length ? baseLinee[baseLinee.length - 1].at(-1) : undefined;

  // 3. L'ORDINE, e i ponti fra macchie che si seguono e sono vicine: la macchia PRIMA si allarga fino a quella
  //    dopo (ci entra di mezzo millimetro). Nella macchia prima, perché così il suo raso e il suo punto sopra
  //    possono finire dentro il ponte, cioè già dentro la macchia dopo: si continua senza salto.
  const ordine = ordinaMacchie(macchie, fineBase, Math.max(0.05, par.ponti));
  const forme = macchie.slice();
  /** Per la macchia da cui parte un ponte: la macchia dove arriva. */
  const ponteVerso = new Map<number, number>();
  /** Per la macchia da cui parte un ponte: dove parte (sul suo bordo) e dove arriva (sul bordo dell'altra). */
  const asse = new Map<number, [Point, Point]>();
  if (par.ponti > 0) for (let k = 1; k < ordine.length; k++) {
    const a = forme[ordine[k - 1]], b = forme[ordine[k]];
    const d = distanzaFra(a, b);
    if (d > 1e-6 && d <= par.ponti) {
      const pt = conPonte(b, a, par.pontiLarghezza);
      forme[ordine[k - 1]] = pt.forma;
      ponteVerso.set(ordine[k - 1], ordine[k]);
      asse.set(ordine[k - 1], [pt.a, pt.da]);
    }
  }
  const ponti = ponteVerso.size;

  // 4. I PEZZI DEL PUNTO SOPRA: la base intera tagliata su ogni macchia — solo dentro, mai fuori
  const bbM = forme.map(ingombro);
  const pezziPer: Polyline[][] = forme.map(() => []);
  for (const l of intera) for (let k = 1; k < l.length; k++) {
    const a = l[k - 1], b = l[k];
    const sx0 = Math.min(a.x, b.x), sx1 = Math.max(a.x, b.x), sy0 = Math.min(a.y, b.y), sy1 = Math.max(a.y, b.y);
    for (let i = 0; i < forme.length; i++) {
      const bb = bbM[i];
      if (sx1 < bb.x0 || sx0 > bb.x1 || sy1 < bb.y0 || sy0 > bb.y1) continue;
      for (const [p, q] of clipSegmentToPolygon(a, b, forme[i])) {
        const pezzi = pezziPer[i], ultimo = pezzi[pezzi.length - 1];
        const e = ultimo?.[ultimo.length - 1];
        if (e && Math.hypot(e.x - p.x, e.y - p.y) < 1e-6) ultimo.push({ x: q.x, y: q.y });
        else pezzi.push([{ x: p.x, y: p.y }, { x: q.x, y: q.y }]);
      }
    }
  }

  // dove il ponte entra nella macchia dopo il punto sopra c'è già (è di quella): via
  for (const [a, b] of ponteVerso) {
    const fuoriDaB: Polyline[] = [];
    for (const l of pezziPer[a]) {
      let c: Polyline | null = null;
      for (let k = 1; k < l.length; k++) for (const [p, q] of meno(l[k - 1], l[k], macchie[b])) {
        if (c && Math.hypot(c[c.length - 1].x - p.x, c[c.length - 1].y - p.y) < 1e-6) c.push(q);
        else { c = [p, q]; fuoriDaB.push(c); }
      }
    }
    pezziPer[a] = fuoriDaB;
  }

  // 5. LE MACCHIE: stop 2 il raso di tutte, stop 3 il punto sopra di tutte (Lorenzo, 2026-10-08: «ho bisogno che
  //    le macchie siano divise in 2 stop, lo stop del raso e lo stop del punto sopra»). Lo stesso ordine per tutti
  //    e due; in ognuno si entra dove conviene e si esce dal lato della macchia che viene dopo.
  const ang = (par.rasoAngolo * Math.PI) / 180, verso = { x: Math.cos(ang), y: Math.sin(ang) };
  const fuori = Math.max(0, par.sfrangiatura) * Math.min(1, Math.max(0, par.sfrangiaturaFuori / 100));
  const dentroSfr = Math.max(0, par.sfrangiatura) - fuori;
  const vista = { raso: [] as Polyline[], sopra: [] as Polyline[], sotto: [] as Polyline[] };
  const saltiFra = { raso: [] as number[], sopra: [] as number[] };
  let saltiDentro = 0, tolto = 0;

  /** Un livello che si costruisce attaccando catene: `nuovo` apre un tratto (cioè un salto). */
  const livelloCucito = () => {
    const tratti: Polyline[] = [];
    let cur: Polyline | null = null;
    const attacca = (catena: Polyline, nuovo: boolean) => {
      if (catena.length < 2 && !nuovo) return;
      if (nuovo || !cur) { cur = catena.slice(); tratti.push(cur); return; }
      const u = cur[cur.length - 1];
      for (let k = 0; k < catena.length; k++) if (k > 0 || Math.hypot(catena[0].x - u.x, catena[0].y - u.y) > 1e-6) cur.push(catena[k]);
    };
    return { tratti, attacca };
  };

  /**
   * Dove si esce dalla macchia: il suo punto più vicino alla prossima, appena dentro. Col ponte, la punta del
   * ponte: un quarto di millimetro dentro la macchia dopo.
   */
  const uscitaVerso = (k: number): Point | null => {
    if (k + 1 >= ordine.length) return null;
    const i = ordine[k], m = forme[i], prossima = forme[ordine[k + 1]];
    const ponte = asse.get(i);
    if (ponte) {
      const [pa, pb] = ponte, l = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      const punta = { x: pb.x + ((pb.x - pa.x) / l) * 0.25, y: pb.y + ((pb.y - pa.y) / l) * 0.25 };
      if (pointInPolygon(punta, m)) return punta;
    }
    const [pa, pb, dd] = piuVicini(m, prossima);
    const l = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    // appena dentro (un quarto di millimetro): sul bordo la corda nel verso del raso può non entrare nella macchia
    const dentroA = dd > 1e-6 && l > 1e-6 ? { x: pa.x - ((pb.x - pa.x) / l) * 0.25, y: pa.y - ((pb.y - pa.y) / l) * 0.25 } : pa;
    return pointInPolygon(dentroA, m) ? dentroA : pa;
  };
  /** Si passa dalla macchia di prima senza salto solo se il passaggio resta tutto dentro questa (si toccano, o c'è un ponte). */
  const unitoA = (da: Point | undefined, a: Point, m: Polyline) =>
    !!da && (pointInPolygon(da, m) || distanceToBoundary(da, m) < 0.05) && restaDentro(da, a, m);

  // ---- STOP 2: IL RASO ----
  const stopRaso = livelloCucito();
  const ultimaRigaPer = new Map<number, Polyline>();
  let uscita: Point | undefined = fineBase;
  ordine.forEach((i, k) => {
    const m = forme[i];
    const interno = new Interno(m, dentroSfr + 0.3);
    const ingresso = uscita ? interno.vicino(uscita) : interno.vicino(m[0]);
    const unito = k > 0 && unitoA(uscita, ingresso, m);
    if (k > 0 && uscita && !unito) saltiFra.raso.push(Math.hypot(ingresso.x - uscita.x, ingresso.y - uscita.y));
    const meta = uscitaVerso(k);

    // A CELLE: nelle macchie a C, a S, una riga non può andare avanti e indietro fra un braccio e l'altro (il filo
    // resterebbe di traverso sopra il raso già cucito). Ogni cella è un tratto di macchia dove le righe si
    // seguono senza interruzioni: si cuce intera, in serpentina, poi la cella più vicina. Con quale cella e da
    // quale angolo cominciare: quello che fa FINIRE il raso più vicino alla macchia dopo (all'inizio si arriva
    // comunque sotto il raso, dove il filo non si vede).
    const grezze = buildParallelFill(m, [], { angleDeg: par.rasoAngolo, spacingMm: par.rasoInterlinea, maxStitchMm: par.rasoPuntoMax, mode: 'serpentine' });
    let n = 0;
    const celle = celleDelRaso(grezze, verso, par.rasoInterlinea)
      .map((c) => c.map((r) => sfrangia(r, i, n++, dentroSfr, fuori)).filter((r): r is Polyline => !!r && r.length >= 2).map((r) => apasso(r, par.rasoPuntoMax)))
      .filter((c) => c.length);
    const capiDi = (c: Polyline[]) => [c[0][0], c[0][c[0].length - 1], c[c.length - 1][0], c[c.length - 1][c[c.length - 1].length - 1]];
    // una cella cucita da un angolo: dove finisce (serpentina: dipende da quante righe)
    const fine = (c: Polyline[], angolo: number): Point => {
      const ordinate = angolo >= 2 ? c.slice().reverse() : c, primaGirata = angolo === 1 || angolo === 3;
      const ultima = ordinate[ordinate.length - 1], girata = ((ordinate.length - 1) % 2 === 1) !== primaGirata;
      return girata ? ultima[0] : ultima[ultima.length - 1];
    };
    type Passo = { cella: number; angolo: number };
    const sequenza = (primo: Passo): { passi: Passo[]; fine: Point } => {
      const passi = [primo], fatte = new Set([primo.cella]);
      let qui = fine(celle[primo.cella], primo.angolo);
      while (fatte.size < celle.length) {
        let best: Passo | null = null, bd = Infinity;
        celle.forEach((c, z) => { if (!fatte.has(z)) capiDi(c).forEach((q, a) => { const d = Math.hypot(q.x - qui.x, q.y - qui.y); if (d < bd) { bd = d; best = { cella: z, angolo: a }; } }); });
        passi.push(best!); fatte.add(best!.cella); qui = fine(celle[best!.cella], best!.angolo);
      }
      return { passi, fine: qui };
    };
    let scelta: { passi: Passo[]; fine: Point } | null = null, sd = Infinity;
    celle.forEach((c, z) => capiDi(c).forEach((q, a) => {
      const sq = sequenza({ cella: z, angolo: a });
      // prima la fine vicina alla macchia dopo; a parità, l'inizio vicino all'ingresso
      const costo = (meta ? Math.hypot(sq.fine.x - meta.x, sq.fine.y - meta.y) : 0) * 10 + Math.hypot(q.x - ingresso.x, q.y - ingresso.y);
      if (costo < sd) { sd = costo; scelta = sq; }
    }));
    const catenaRaso: Polyline = [];
    let sotto: Polyline = [ingresso];
    let fin: Point = ingresso;
    const orienta = (c: Polyline[], angolo: number) => {
      const ordinate = angolo >= 2 ? c.slice().reverse() : c, primaGirata = angolo === 1 || angolo === 3;
      return ordinate.map((r, z) => ((z % 2 === 1) !== primaGirata ? r.slice().reverse() : r));
    };
    // i BLOCCHI: righe già girate, cucite di seguito; fra un blocco e l'altro si passa dentro la macchia
    let blocchi: Polyline[][] = ((scelta as { passi: Passo[] } | null)?.passi ?? []).map((p) => orienta(celle[p.cella], p.angolo));
    // Se il raso non finisce dove si esce (col ponte: dentro il ponte), si cerca la riga che ci finisce e si
    // cuce PER ULTIMA: la sua cella in due parti — prima le righe da una parte, poi quelle dall'altra partendo
    // dal fondo, verso di lei. Il passaggio fra le due parti corre dove il raso non c'è ancora: lo copre.
    const fineDi = (b: Polyline[][]) => { const u = b[b.length - 1]; const r = u?.[u.length - 1]; return r?.[r.length - 1]; };
    const fineOra = fineDi(blocchi);
    if (meta && fineOra && Math.hypot(fineOra.x - meta.x, fineOra.y - meta.y) > 1) {
      let bz = -1, br = -1, be = 0, bd = Math.hypot(fineOra.x - meta.x, fineOra.y - meta.y) - 0.5;
      celle.forEach((c, z) => c.forEach((r, rz) => [r[0], r[r.length - 1]].forEach((q, e) => {
        const d = Math.hypot(q.x - meta.x, q.y - meta.y);
        if (d < bd) { bd = d; bz = z; br = rz; be = e; }
      })));
      if (bz >= 0) {
        const c = celle[bz];
        // l'ultima riga finisce sul capo vicino all'uscita; le righe dall'altra parte, a ritroso, si alternano
        const verso1 = (r: Polyline, uguale: boolean) => ((be === 1) === uguale ? r : r.slice().reverse());
        const ultima = verso1(c[br], true);
        const dopo = c.slice(br + 1).reverse();                   // dal fondo verso la riga del ponte
        const parte2 = [...dopo.map((r, j) => verso1(r, (dopo.length - j) % 2 === 0)), ultima];
        const prima = c.slice(0, br);
        // le altre celle prima, dal capo più vicino all'ingresso
        const altre = celle.map((_, z) => z).filter((z) => z !== bz);
        const pre: Polyline[][] = [];
        let qui: Point = ingresso;
        while (altre.length) {
          let bz2 = 0, ba = 0, bdd = Infinity;
          altre.forEach((z, w) => capiDi(celle[z]).forEach((q, a) => { const d = Math.hypot(q.x - qui.x, q.y - qui.y); if (d < bdd) { bdd = d; bz2 = w; ba = a; } }));
          const z = altre.splice(bz2, 1)[0];
          const o = orienta(celle[z], ba);
          pre.push(o);
          qui = fineDi([o])!;
        }
        if (prima.length) {
          // la prima parte comincia dal capo più vicino a dove si è
          const capi = [prima[0][0], prima[0][prima[0].length - 1]];
          const girata = Math.hypot(capi[1].x - qui.x, capi[1].y - qui.y) < Math.hypot(capi[0].x - qui.x, capi[0].y - qui.y);
          pre.push(orienta(prima, girata ? 1 : 0));
        }
        blocchi = [...pre, parte2];
      }
    }
    for (const righe of blocchi) {
      const inizio = righe[0][0];
      if (!catenaRaso.length) sotto = interno.strada(ingresso, inizio);            // sotto il raso, fino alle righe
      else for (const q of apasso(interno.strada(fin, inizio), par.rasoPuntoMax).slice(1, -1)) catenaRaso.push(q);
      for (const r of righe) {
        const u = catenaRaso[catenaRaso.length - 1];
        if (u && Math.hypot(r[0].x - u.x, r[0].y - u.y) > par.rasoPuntoMax) for (const q of apasso([u, r[0]], par.rasoPuntoMax).slice(1, -1)) catenaRaso.push(q);
        for (const q of r) catenaRaso.push(q);
      }
      ultimaRigaPer.set(i, righe[righe.length - 1]);
      fin = catenaRaso[catenaRaso.length - 1];
      interno.occupa(righe);
    }
    const sottoCucito = enforceMinStitch(apasso(sotto, 3), RASO_PUNTO_MIN);
    stopRaso.attacca(unito && uscita ? [uscita, ...sottoCucito] : sottoCucito, !unito);
    vista.sotto.push(sottoCucito);
    const raso = enforceMinStitch(catenaRaso, RASO_PUNTO_MIN);
    if (raso.length >= 2) { stopRaso.attacca(raso, false); vista.raso.push(raso); }
    uscita = raso.length ? raso[raso.length - 1] : ingresso;
  });

  // ---- STOP 3: IL PUNTO SOPRA, sempre dentro la macchia ----
  // Da un pezzo all'altro sulle linee del punto o NEL VERSO DEL RASO (le corde della macchia per i capi dei
  // pezzi): il filo si posa sul raso fra i suoi fili, e non si vede. I gruppi che non si raggiungono: col salto
  // se sono corposi, se no si tolgono.
  const stopSopra = livelloCucito();
  uscita = undefined;
  ordine.forEach((i, k) => {
    const m = forme[i];
    const pezzi = pezziPer[i].filter((p) => lunghezza(p) > 0.05);
    const meta = uscitaVerso(k);
    const entraDaPrima = k > 0 && !!uscita && pointInPolygon(uscita, m);      // col ponte: si arriva già dentro
    if (!pezzi.length) return;
    const corde: Polyline[] = [];
    for (const q of [meta, entraDaPrima ? uscita! : null]) if (q) { const cd = corda(m, q, verso); if (cd) corde.push(cd); }
    for (const p of pezzi) for (const c of [p[0], p[p.length - 1]]) { const cd = corda(m, c, verso); if (cd) corde.push(cd); }
    // col ponte, si esce seguendo il ponte: dal suo attacco (un millimetro dentro la macchia) alla punta
    const ponte = asse.get(i);
    if (ponte && meta) {
      const [pa, pb] = ponte, l = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      corde.push([{ x: pa.x - ((pb.x - pa.x) / l), y: pa.y - ((pb.y - pa.y) / l) }, meta]);
    }
    const rete = reteDelPunto([...pezzi, ...corde], [], 0);
    const perGruppo = new Map<number, { pezzi: Polyline[]; filo: number }>();
    for (const p of pezzi) {
      const g = rete.gruppo(p[0]);
      const v = perGruppo.get(g) ?? { pezzi: [], filo: 0 };
      v.pezzi.push(p); v.filo += lunghezza(p);
      perGruppo.set(g, v);
    }
    const restano = new Set<Polyline>();
    for (const v of perGruppo.values()) {
      if (v.filo < par.pezzoMinimo) tolto += v.filo;
      else for (const p of v.pezzi) restano.add(p);
    }
    // l'USCITA: il capo più vicino alla macchia dopo; quel pezzo si cuce per ultimo, finendo lì
    let riservato: Polyline | null = null, capoRis: Point | null = null;
    if (meta && restano.size) {
      let bd = Infinity;
      for (const p of restano) for (const c of [p[0], p[p.length - 1]]) {
        const dd = Math.hypot(c.x - meta.x, c.y - meta.y);
        if (dd < bd) { bd = dd; riservato = p; capoRis = c; }
      }
    }
    let qui: Point | undefined = uscita;
    let primo = true;
    while (restano.size) {
      const soloRis = riservato && restano.size === 1 && restano.has(riservato);
      const strade = qui ? rete.strade(qui, par.passaggioMax) : () => null;
      let best: Polyline | null = null, rovescia = false, costo = Infinity, via: Polyline | null = null;
      for (const p of restano) {
        if (p === riservato && !soloRis) continue;
        for (const giu of [false, true]) {
          const capo = giu ? p[p.length - 1] : p[0];
          if (p === riservato && capo !== (capoRis === p[0] ? p[p.length - 1] : p[0])) continue;   // si entra dall'altro capo
          const v = strade(capo);
          const c = v ? lunghezza(v) : 1e6 + (qui ? Math.hypot(capo.x - qui.x, capo.y - qui.y) : 0);
          if (c < costo) { costo = c; best = p; rovescia = giu; via = v; }
        }
      }
      if (!best) break;
      // se per andare avanti serve comunque un salto, il pezzo d'uscita non si tiene più da parte: tenerlo
      // costerebbe un salto in più (tornare a prenderlo); all'uscita ci si arriva poi, se si può, sulla rete
      if (!via && riservato && restano.has(riservato) && best !== riservato) { riservato = null; continue; }
      restano.delete(best);
      const scelto = rovescia ? best.slice().reverse() : best;
      const salto = !via;
      if (salto && primo && k > 0 && qui) saltiFra.sopra.push(Math.hypot(scelto[0].x - qui.x, scelto[0].y - qui.y));
      else if (salto && !primo) saltiDentro++;
      const catena = minimoDentro(salto ? scelto : [...via!, ...scelto.slice(1)], SOPRA_PUNTO_MIN, m);
      stopSopra.attacca(catena, salto);
      vista.sopra.push(catena);
      qui = scelto[scelto.length - 1];
      primo = false;
    }
    // e dall'ultimo pezzo al punto d'uscita, nascosto
    const allUscita = meta && qui ? rete.strade(qui, par.passaggioMax)(meta) : null;
    if (meta && allUscita) {
      const catena = minimoDentro(allUscita, SOPRA_PUNTO_MIN, m);
      stopSopra.attacca(catena, false);
      vista.sopra.push(catena);
      qui = meta;
    }
    uscita = qui;
  });

  const livello = (t: Polyline[]): Livello => ({ tratti: t, punti: contaPunti(t), salti: Math.max(0, t.length - 1) });
  return {
    base: livello(baseLinee), raso: livello(stopRaso.tratti), sopra: livello(stopSopra.tratti), vista, forme, ordine, ponti,
    saltiFra, saltiDentro, tolto, buchi, tempoMs: Date.now() - t0,
  };
}

/**
 * Il punto minimo, ma senza uscire dalla macchia: un punto troppo corto si toglie solo se il punto che ne viene
 * resta dentro (togliendolo a un angolo del bordo il filo taglierebbe fuori, di qualche decimo).
 */
function minimoDentro(linea: Polyline, minimo: number, macchia: Polyline): Polyline {
  if (linea.length < 3) return linea.slice();
  const out: Polyline = [linea[0]];
  for (let i = 1; i < linea.length - 1; i++) {
    const u = out[out.length - 1], q = linea[i], dopo = linea[i + 1];
    const corto = Math.hypot(q.x - u.x, q.y - u.y) < minimo;
    const scorciatoia = { x: (u.x + dopo.x) / 2, y: (u.y + dopo.y) / 2 };
    if (!corto || !(pointInPolygon(scorciatoia, macchia) || distanceToBoundary(scorciatoia, macchia) < 0.02)) out.push(q);
  }
  out.push(linea[linea.length - 1]);
  return out;
}

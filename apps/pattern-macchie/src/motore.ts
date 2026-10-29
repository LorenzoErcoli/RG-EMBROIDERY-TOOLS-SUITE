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
  /**
   * LA FASE DEL RASO, % del punto (Lorenzo, 2026-10-29: «la fase tra i punti ricamo dovrebbe essere 30, ma vorrei
   * poterla controllare»; «sì, 30% del punto»): nelle righe più lunghe del punto massimo, gli aghi di una riga cadono
   * spostati di tanto rispetto a quelli della riga accanto. 0 = gli aghi di tutte le righe alla stessa altezza.
   */
  rasoFase: number;
  /** Sfrangiatura del raso, mm: di quanto, a caso, ogni riga finisce prima o dopo il bordo. 0 = bordo netto. */
  sfrangiatura: number;
  /** Quanta parte della sfrangiatura va oltre il bordo (sulla base), %: il resto resta dentro. */
  sfrangiaturaFuori: number;
  /** (Dal 2026-10-28 il punto sopra va sulle linee della base senza limite: vedi `sopraComeLaBase`. Non usato.) */
  passaggioMax: number;
  /** I gruppi di linee del punto sopra staccati dal resto con meno filo di tanto, mm, non si cuciono. */
  pezzoMinimo: number;
  /**
   * IL PUNTO MINIMO DEL PUNTO SOPRA, mm (Lorenzo, 2026-10-26: «ci sono davvero troppi punti corti e tanti che rischiano
   * di non lavorare bene con fili più spessi»). Al bordo della macchia la linea tagliata si ferma all'ago prima invece di
   * lasciare un puntino; dentro, gli aghi si ridistribuiscono lungo la stessa linea. Come la base: 1 mm.
   */
  sopraPuntoMin: number;
  /**
   * LO SPOSTAMENTO DEL PUNTO SOPRA, mm, verso destra (Lorenzo, 2026-10-29: «ricreare sì quel punto della grandezza come
   * la base, ma lo sfasiamo un po', in modo che non corrisponda ed il filo del punto speciale della macchia non batte
   * sul filo della base»). Il punto sopra è la base intera spostata di tanto, poi tagliata sulla macchia: non ne esce.
   * 0 e 0 = a registro con la base, come fino al 2026-10-28. Di serie 1 mm (Lorenzo: «io farei anche 1 mm a destra»).
   */
  sopraSfasaX: number;
  /**
   * Lo spostamento del punto sopra verso il basso, mm (Lorenzo, stesso giorno: «ma anche spostamento verticale in
   * realtà»). Di serie 1 mm: con 1 mm a destra, sul punto 2e4 gli aghi sul filo della base sono il 12% (verticale 0: 50%).
   */
  sopraSfasaY: number;
  /**
   * I PONTI: due macchie che si seguono e sono più vicine di tanto, mm, si uniscono con un ponte di raso — il filo
   * passa dall'una all'altra senza salto. 0 = mai: le macchie restano come nel disegno.
   */
  ponti: number;
  /** La larghezza del ponte, mm. */
  pontiLarghezza: number;
  /**
   * LE ZONE (Lorenzo, 2026-10-12): il raso e il punto sopra si dividono in zone, cucite una dopo l'altra — con 2,
   * base · raso della prima metà · punto sopra della prima metà · raso della seconda · punto sopra della seconda.
   * 1 = nessuna divisione. Ogni macchia sta nella zona del suo centro.
   */
  zone: number;
  /** Come si divide: 'verticale' = strisce da sinistra a destra, 'orizzontale' = dall'alto in basso. */
  zoneVerso: 'verticale' | 'orizzontale';
  /**
   * Le macchie da sinistra a destra, e il raso dentro le macchie da sinistra a destra dove può (Lorenzo, 2026-10-09,
   * per provare). Spento di serie dal 2026-10-12: «conviene lavorare autonomamente sinistra-destra e viceversa
   * (serpentina o qualsiasi altra forma) che permetta alle macchie di muoversi meglio» — l'ordine coi salti più corti.
   */
  daSinistra: boolean;
};

/** Il punto più corto del raso, mm: fra una riga e l'altra il punto è l'interlinea. */
const RASO_PUNTO_MIN = 0.3;

export const PARAMETRI_MACCHIE: ParametriMacchie = {
  bucaLaBase: false,
  margineBase: 2,
  rasoAngolo: 90,
  rasoInterlinea: 0.4,
  rasoPuntoMax: 4,
  rasoFase: 30,
  sfrangiatura: 1,
  sfrangiaturaFuori: 50,
  passaggioMax: 100,
  pezzoMinimo: 2,
  sopraPuntoMin: 1,
  sopraSfasaX: 1,
  sopraSfasaY: 1,
  ponti: 0,
  pontiLarghezza: 2,
  daSinistra: false,
  zone: 1,
  zoneVerso: 'verticale',
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
  /**
   * Gli stop dopo la base, in ordine: per ogni zona il raso delle sue macchie (una alla volta, col passaggio sotto il
   * raso per arrivare all'inizio delle righe) e poi il punto sopra, nello stesso ordine.
   */
  stop: Array<{ tipo: 'raso' | 'sopra'; zona: number; livello: Livello }>;
  /** Tutto il raso e tutto il punto sopra, zone insieme (per i conti e l'anteprima). */
  raso: Livello;
  sopra: Livello;
  /** Le zone: per ognuna le macchie nel loro ordine. */
  zone: number[][];
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
  /**
   * I salti dentro le macchie nel raso: dove da una parte all'altra non c'è strada SOTTO il raso (passare sopra
   * quello già cucito è un errore, Lorenzo 2026-10-09), si salta.
   */
  passaggiScoperti: number;
  /** Filo del punto sopra tolto (i gruppi staccati più corti di `pezzoMinimo`), mm. */
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

export function ordinaMacchie(macchie: Polyline[], partenza?: Point, senzaSalto = 0.05, daSinistra = false): number[] {
  const N = macchie.length;
  if (N < 2) return macchie.map((_, i) => i);
  const bb = macchie.map(ingombro);
  // (le distanze sul contorno semplificato a un decimo di millimetro, i due punti più vicini una volta sola per coppia:
  // su un pannello di 500 macchie, duecento vertici l'una e tremila coppie vicine, era quasi metà del calcolo)
  const sem = macchie.map((m) => simplifyPolyline(m, 0.1));
  const D = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = bb[i], b = bb[j];
    let d = Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
    // (fra due macchie con un'altra in mezzo il filo del salto passerebbe sopra quella, e il suo ricamo lo imprigiona:
    // Lorenzo, 2026-10-26 — metterle in fila costa come 200 mm di salto in più)
    let inMezzo = false;
    if (d < 25) {
      const [p, q, dd] = piuVicini(sem[i], sem[j]);
      if (d === 0 && (pointInPolygon(sem[i][0], sem[j]) || pointInPolygon(sem[j][0], sem[i]))) d = 0;
      else {
        d = dd;
        inMezzo = sopraAltre(p, q, sem, sem[i], sem[j]);
      }
    } else d += 5;
    // ogni salto costa; e un salto lungo (oltre 8 mm, il filo resta lungo sul ricamo) costa il triplo per il di più
    D[i][j] = D[j][i] = d + (d > senzaSalto ? 5 : 0) + 2 * Math.max(0, d - 8) + (inMezzo ? 200 : 0);
  }
  // DA SINISTRA A DESTRA (Lorenzo, 2026-10-09): tornare indietro verso sinistra costa quanto si torna indietro,
  // in più della distanza. Il costo non è più lo stesso nei due versi: si confrontano gli ordini interi.
  const cx = bb.map((q) => (q.x0 + q.x1) / 2);
  const C = (a: number, b: number) => D[a][b] + (daSinistra ? Math.max(0, cx[a] - cx[b]) : 0);
  const asimmetrico = daSinistra;
  // si parte dalla macchia più vicina a dove finisce la base (o la prima a sinistra)
  let primo = 0;
  if (daSinistra) { for (let i = 1; i < N; i++) if (bb[i].x0 < bb[primo].x0) primo = i; }
  else if (partenza) { let best = Infinity; for (let i = 0; i < N; i++) { const d = Math.hypot(Math.max(0, bb[i].x0 - partenza.x, partenza.x - bb[i].x1), Math.max(0, bb[i].y0 - partenza.y, partenza.y - bb[i].y1)); if (d < best) { best = d; primo = i; } } }
  else for (let i = 1; i < N; i++) if (bb[i].x0 < bb[primo].x0) primo = i;
  let ord = [primo];
  const visti = new Set(ord);
  while (ord.length < N) {
    const u = ord[ord.length - 1];
    let best = -1, bd = Infinity;
    for (let v = 0; v < N; v++) if (!visti.has(v) && C(u, v) < bd) { bd = C(u, v); best = v; }
    ord.push(best); visti.add(best);
  }
  const c = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? 0 : C(a, b));
  /** Il costo dentro un tratto della fila, nel verso dato. */
  const dentro = (t: number[]) => { let x = 0; for (let k = 1; k < t.length; k++) x += C(t[k - 1], t[k]); return x; };
  for (let giro = 0, meglio = true; meglio && giro < 100; giro++) {
    meglio = false;
    // 2-opt: si gira un tratto della fila (la prima macchia resta la prima)
    for (let i = 1; i < N - 1; i++) for (let j = i + 1; j < N; j++) {
      const a = ord[i - 1], b = ord[i], cc = ord[j], d = ord[j + 1];
      const tratto = ord.slice(i, j + 1), girato = asimmetrico ? dentro(tratto.slice().reverse()) - dentro(tratto) : 0;
      if (c(a, cc) + c(b, d) + girato < c(a, b) + c(cc, d) - 1e-6) { ord = [...ord.slice(0, i), ...ord.slice(i, j + 1).reverse(), ...ord.slice(j + 1)]; meglio = true; }
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
          const metti = c(a, g0) + c(g1, b) - c(a, b) + (rev && asimmetrico ? dentro(gruppo.slice().reverse()) - dentro(gruppo) : 0);
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

/**
 * Se il filo dritto da `p` a `q` (tolti 0,8 mm ai capi) passa sopra una delle `tutte` le macchie (della zona: quelle
 * delle altre zone si cuciono dopo uno stop, quando il filo del salto è già tagliato) diversa da `a` e da `b`.
 */
function sopraAltre(p: Point, q: Point, tutte: Polyline[], a: Polyline, b: Polyline): boolean {
  if (!ingombri.has(tutte)) ingombri.set(tutte, tutte.map(ingombro));
  const bt = ingombri.get(tutte)!;
  const L = Math.hypot(q.x - p.x, q.y - p.y);
  if (L <= 1.6) return false;
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  const altre = tutte.filter((f, i) => {
    if (f === a || f === b) return false;
    const k = bt[i];
    return k.x1 >= x0 && k.x0 <= x1 && k.y1 >= y0 && k.y0 <= y1;
  });
  if (!altre.length) return false;
  for (let s = 0.8; s <= L - 0.8; s += 0.2) {
    const r = { x: p.x + ((q.x - p.x) * s) / L, y: p.y + ((q.y - p.y) * s) / L };
    for (const f of altre) if (pointInPolygon(r, f) && distanceToBoundary(r, f) > 0.2) return true;
  }
  return false;
}

/** Gli ingombri di una lista di macchie, tenuti (`sopraAltre` li chiede per ogni coppia). */
const ingombri = new WeakMap<Polyline[], Ingombro[]>();

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

/** Quanto costa, per ogni passo della griglia dei passaggi, ogni millimetro di distanza dal bordo (fino a 2 mm). */
const PESO_BORDO = 5;

/**
 * DOVE IL RASO COPRIRÀ: una griglia fine sulla macchia, e per ogni cella quante righe di raso ANCORA DA CUCIRE ci
 * passano sopra (la riga e una fascia di due decimi per parte: a 0,4 mm d'interlinea le fasce si toccano). Un
 * passaggio può andare solo dove questo numero non è zero — il raso che viene dopo lo coprirà, sfrangiatura
 * compresa — più il solco dell'ultima riga appena cucita, da cui si parte. Mai attraverso il raso già fatto
 * (Lorenzo, 2026-10-09: «i passaggi devono sempre essere coperti… ripassare sopra il raso già fatto è un errore»).
 */
class SottoIlRaso {
  private readonly g = 0.2;
  private readonly W: number;
  private readonly H: number;
  private readonly ox: number;
  private readonly oy: number;
  /** Quante righe da cucire coprono la cella. */
  private readonly daCucire: Int32Array;
  /** Quale riga cucita ha coperto la cella per ultima (1, 2, …); 0 = nessuna. */
  private readonly marca: Int32Array;
  private righeCucite = 0;

  /** Quante celle attorno ai capi della strada vale anche il raso fuori dal bordo: quanto la sfrangiatura va fuori. */
  private readonly capi: number;

  constructor(macchia: Polyline, righe: Polyline[], fuori = 0) {
    const b = ingombro([...macchia, ...righe.flat()]), g = this.g;
    this.capi = Math.max(5, Math.ceil((fuori + 0.4) / g));
    this.W = Math.ceil((b.x1 - b.x0) / g) + 5; this.H = Math.ceil((b.y1 - b.y0) / g) + 5;
    this.ox = b.x0 - 2 * g; this.oy = b.y0 - 2 * g;
    this.daCucire = new Int32Array(this.W * this.H);
    this.marca = new Int32Array(this.W * this.H);
    // solo dentro la macchia: dove la sfrangiatura porta il raso oltre il bordo, il passaggio non ci va
    const dentro = rasterizza([macchia], g, this.ox, this.oy, this.W, this.H);
    this.dentro = dentro;
    const d2 = distanzeAlQuadrato(dentro, this.W, this.H);
    this.bordo = new Float32Array(this.W * this.H);
    for (let k = 0; k < d2.length; k++) this.bordo[k] = dentro[k] ? Math.max(0, Math.sqrt(d2[k]) - 0.5) * g : 0;
    this.ovunque = new Int32Array(this.W * this.H);
    this.fascia(righe, (k) => { if (dentro[k]) this.daCucire[k]++; this.ovunque[k]++; });
  }
  /** Come `daCucire` ma anche fuori dalla macchia (le punte sfrangiate in fuori): vale solo vicino ai capi della strada. */
  private readonly ovunque: Int32Array;
  private readonly dentro: Uint8Array;
  /** Quanto ogni cella è lontana dal bordo della macchia, mm (0 fuori). */
  private readonly bordo: Float32Array;

  /** Le celle della fascia di una riga (la riga e una cella per parte). */
  private fascia(righe: Polyline[], fai: (k: number, riga: number) => void): void {
    const g = this.g;
    righe.forEach((r, z) => {
      const viste = new Set<number>();
      for (let k = 1; k < r.length; k++) {
        const a = r[k - 1], b = r[k], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (g / 2)));
        for (let t = 0; t <= n; t++) {
          const i = Math.floor((a.x + ((b.x - a.x) * t) / n - this.ox) / g), j = Math.floor((a.y + ((b.y - a.y) * t) / n - this.oy) / g);
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            const x = i + di, y = j + dj;
            if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
            const c = y * this.W + x;
            if (!viste.has(c)) { viste.add(c); fai(c, z); }
          }
        }
      }
    });
  }

  /** I tratti delle righe cucite, per il controllo esatto che un passaggio non le attraversi (griglia di 2 mm). */
  /** (`dalCapo`: dove comincia il tratto lungo la sua riga; `lunga`: la riga intera, mm) */
  private readonly cucite: Array<{ a: Point; b: Point; id: number; dalCapo: number; lunga: number }> = [];
  private readonly indice = new Map<string, number[]>();
  /**
   * Le righe delle macchie cucite prima (`giaCucite`, compresa quella da cui si è usciti) si possono scavalcare entro
   * tanto dalla loro punta, mm (di solito 0).
   */
  puntaAltrui = 0;

  /** Se il tratto p-q incrocia una riga già cucita (l'ultima, da cui si riparte, solo a metà: i capi si toccano). */
  attraversa(p: Point, q: Point): boolean {
    const G = 2, ultima = this.righeCucite, visti = new Set<number>();
    for (let gx = Math.floor(Math.min(p.x, q.x) / G); gx <= Math.floor(Math.max(p.x, q.x) / G); gx++)
      for (let gy = Math.floor(Math.min(p.y, q.y) / G); gy <= Math.floor(Math.max(p.y, q.y) / G); gy++)
        for (const z of this.indice.get(`${gx},${gy}`) ?? []) {
          if (visti.has(z)) continue;
          visti.add(z);
          const { a, b, id, dalCapo, lunga } = this.cucite[z];
          const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y, den = rx * sy - ry * sx;
          if (Math.abs(den) < 1e-12) continue;
          const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den, u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den;
          if (!(t > 1e-6 && t < 1 - 1e-6 && u > -1e-6 && u < 1 + 1e-6)) continue;
          // l'ultima riga cucita è il solco da cui si riparte: la si può toccare vicino ai suoi capi (da lì si esce), ma
          // non riattraversare a metà — sarebbe un filo sopra il raso appena fatto
          if (id === ultima || (id <= 0 && this.puntaAltrui > 0)) {
            const sulla = dalCapo + u * Math.hypot(sx, sy), tolto = id === ultima ? 0.05 : this.puntaAltrui;
            if (sulla < tolto || lunga - sulla < tolto) continue;
          }
          return true;
        }
    return false;
  }

  private registra(r: Polyline, id: number): void {
    let lunga = 0;
    for (let k = 1; k < r.length; k++) lunga += Math.hypot(r[k].x - r[k - 1].x, r[k].y - r[k - 1].y);
    let dalCapo = 0;
    for (let k = 1; k < r.length; k++) {
      const a = r[k - 1], b = r[k], n = this.cucite.length;
      this.cucite.push({ a, b, id, dalCapo, lunga });
      dalCapo += Math.hypot(b.x - a.x, b.y - a.y);
      for (let gx = Math.floor(Math.min(a.x, b.x) / 2); gx <= Math.floor(Math.max(a.x, b.x) / 2); gx++)
        for (let gy = Math.floor(Math.min(a.y, b.y) / 2); gy <= Math.floor(Math.max(a.y, b.y) / 2); gy++) {
          const c = this.indice.get(`${gx},${gy}`);
          if (c) c.push(n); else this.indice.set(`${gx},${gy}`, [n]);
        }
    }
  }

  /**
   * Il raso delle macchie cucite prima che entra in questa: il ponte della macchia prima ci arriva dentro di mezzo
   * millimetro (più la sfrangiatura), e il passaggio d'ingresso non deve tagliarne le punte. Solo per `attraversa`:
   * qui sopra il raso di questa macchia è ancora tutto da fare. La riga che finisce in `partenza` (dove la macchia
   * prima è uscita) è il solco da cui si parte, come l'ultima riga cucita: finché qui non si cuce, non si conta.
   */
  giaCucite(righe: Polyline[], partenza?: Point): void {
    const da = (r: Polyline) => !!partenza && [r[0], r[r.length - 1]].some((q) => Math.hypot(q.x - partenza.x, q.y - partenza.y) < 1e-6);
    for (const r of righe) this.registra(r, da(r) ? 0 : -1);
  }

  /** Le righe appena cucite: le loro celle non sono più da cucire; l'ultima resta il solco da cui si riparte. */
  occupa(righe: Polyline[]): void {
    const base = this.righeCucite;
    righe.forEach((r, z) => this.registra(r, base + z + 1));
    this.fascia(righe, (k, z) => { if (this.daCucire[k] > 0 && this.dentro[k]) this.daCucire[k]--; if (this.ovunque[k] > 0) this.ovunque[k]--; this.marca[k] = base + z + 1; });
    this.righeCucite = base + righe.length;
  }

  private qui(p: Point): number {
    const i = Math.min(this.W - 1, Math.max(0, Math.floor((p.x - this.ox) / this.g)));
    const j = Math.min(this.H - 1, Math.max(0, Math.floor((p.y - this.oy) / this.g)));
    return j * this.W + i;
  }
  private centro(k: number): Point { return { x: this.ox + ((k % this.W) + 0.5) * this.g, y: this.oy + (Math.floor(k / this.W) + 0.5) * this.g }; }

  /** Il punto più vicino a `p` dove il raso ancora da fare coprirà (l'ingresso nella macchia). */
  vicino(p: Point): Point {
    let best = -1, bd = Infinity;
    for (let k = 0; k < this.daCucire.length; k++) if (this.daCucire[k] > 0) {
      const c = this.centro(k), d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best < 0 ? p : this.centro(best);
  }

  /** La strada più corta, coperta, da `a` a `b` (A* sulla griglia, poi tirata dritta dove resta coperta); null se non c'è. */
  strada(a: Point, b: Point): Polyline | null {
    const W = this.W, n = this.daCucire.length, ultima = this.righeCucite;
    const s0 = this.qui(a), t0 = this.qui(b);
    // vicino ai capi (le righe sfrangiate finiscono fino a quanto la sfrangiatura va fuori) vale anche il raso fuori dal
    // bordo
    const sx = s0 % W, sy = Math.floor(s0 / W), qx = t0 % W, qy = Math.floor(t0 / W), R = this.capi;
    const aiCapi = (v: number) => { const x = v % W, y = Math.floor(v / W); return Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= R || Math.max(Math.abs(x - qx), Math.abs(y - qy)) <= R; };
    const passa = (v: number) => this.daCucire[v] > 0 || v === t0 || v === s0 || (ultima > 0 && this.marca[v] === ultima) || (this.ovunque[v] > 0 && aiCapi(v));
    /**
     * Se il filo dritto da p a q resta coperto, non attraversa righe cucite e non entra nella macchia più dei suoi due
     * capi (più tre decimi): tirando dritta una strada che costeggia il bordo, non si taglia per l'interno.
     */
    const libero = (p: Point, q: Point) => {
      if (this.cucite.length > 0 && this.attraversa(p, q)) return false;
      const limite = Math.max(this.bordo[this.qui(p)], this.bordo[this.qui(q)]) + 0.3;
      const m = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / (this.g / 3)));
      for (let t = 0; t <= m; t++) {
        const k = this.qui({ x: p.x + ((q.x - p.x) * t) / m, y: p.y + ((q.y - p.y) * t) / m });
        if (!passa(k) || this.bordo[k] > limite) return false;
      }
      return true;
    };
    // prima il filo dritto: la griglia va da centro a centro di cella (0,2 mm) e, fra righe fitte, può tagliare una
    // riga che il filo dritto non tocca (la volta di mezzo millimetro dal ponte della macchia prima alla riga dopo)
    if (libero(a, b)) return [a, b];
    const gcost = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), chiuso = new Uint8Array(n);
    const tx = t0 % W, ty = Math.floor(t0 / W);
    const h = (k: number) => { const dx = Math.abs((k % W) - tx), dy = Math.abs(Math.floor(k / W) - ty); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
    const heap: Array<[number, number]> = [[h(s0), s0]];
    gcost[s0] = 0;
    const su = (i: number) => { while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const giu = (i: number) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) return; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
    // solo i quattro passi dritti: in diagonale si potrebbe scivolare fra due celle cucite che si toccano d'angolo
    const passi = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (heap.length) {
      const [, u] = heap[0];
      const last = heap.pop()!;
      if (heap.length) { heap[0] = last; giu(0); }
      if (chiuso[u]) continue;
      chiuso[u] = 1;
      if (u === t0) break;
      const ux = u % W, uy = Math.floor(u / W);
      for (const [dx, dy] of passi) {
        const vx = ux + dx, vy = uy + dy;
        if (vx < 0 || vy < 0 || vx >= W || vy >= this.H) continue;
        const v = vy * W + vx;
        if (!passa(v) || chiuso[v]) continue;
        if (this.cucite.length > 0 && this.attraversa(this.centro(u), this.centro(v))) continue;
        // (2026-10-26, dal DST di Stilista) I PASSAGGI COSTEGGIANO IL BORDO: un passo costa di più quanto più è lontano
        // dal bordo, così la strada corre nella fascia che le punte delle righe coprono, non in mezzo alla macchia
        const nd = gcost[u] + 1 + PESO_BORDO * Math.min(2, this.bordo[v]);
        if (nd < gcost[v]) { gcost[v] = nd; prev[v] = u; heap.push([nd + h(v), v]); su(heap.length - 1); }
      }
    }
    if (prev[t0] < 0) return null;
    const celle: Point[] = [];
    for (let k = t0; k !== -1; k = prev[k]) celle.push(this.centro(k));
    celle.reverse();
    // tirata dritta: dall'ultimo punto tenuto, il più lontano che si raggiunge restando coperti
    const out: Polyline = [a];
    let i = 0;
    const tutte = [a, ...celle.slice(1, -1), b];
    while (i < tutte.length - 1) {
      let j = tutte.length - 1;
      while (j > i + 1 && !libero(tutte[i], tutte[j])) j--;
      if (j === i + 1 && this.cucite.length > 0 && this.attraversa(tutte[i], tutte[j])) return null;
      out.push(tutte[j]);
      i = j;
    }
    return out;
  }
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
function celleDelRaso(righe: Polyline[], u: Point, interlinea: number, macchia?: Polyline): { celle: Polyline[][]; lati: Array<[number, number]> } {
  const n = { x: -u.y, y: u.x };
  type Info = { r: Polyline; s: number; lo: number; hi: number };
  const info: Info[] = righe.filter((r) => r.length >= 2).map((r) => {
    const a = r[0], b = r[r.length - 1], t0 = a.x * u.x + a.y * u.y, t1 = b.x * u.x + b.y * u.y;
    // tutte nello stesso verso: la serpentina la fa chi le cuce
    return { r: t0 <= t1 ? r : r.slice().reverse(), s: a.x * n.x + a.y * n.y, lo: Math.min(t0, t1), hi: Math.max(t0, t1) };
  });
  info.sort((p, q) => p.s - q.s || p.lo - q.lo);
  const celle: Array<{ righe: Info[]; ultima: Info; n: number }> = [];
  /** I vicini: [a, b] = la cella a, dalla sua ultima riga, tocca la cella b dalla sua prima. */
  const lati: Array<[number, number]> = [];
  let aperte: typeof celle = [];
  for (let k = 0; k < info.length;) {
    let j = k;
    while (j < info.length && Math.abs(info[j].s - info[k].s) < interlinea * 0.25) j++;
    const livello = info.slice(k, j);
    const tocca = (a: Info, b: Info) => a.lo < b.hi && b.lo < a.hi && Math.abs(a.s - b.s) < interlinea * 1.6;
    // la volta fra due righe (da un capo dell'una allo stesso capo dell'altra) deve restare nella macchia: dove la
    // macchia rientra (una ∩, un dente) le righe accanto hanno lunghezze molto diverse e la volta uscirebbe — lì
    // comincia un'altra cella
    const voltaDentro = (a: Info, b: Info) => !macchia || [[a.r[0], b.r[0]], [a.r[a.r.length - 1], b.r[b.r.length - 1]]].every(([p, q]) => {
      for (const t of [0.25, 0.5, 0.75]) {
        const m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
        if (!pointInPolygon(m, macchia) && distanceToBoundary(m, macchia) > 0.1) return false;
      }
      return true;
    });
    const nuove: typeof celle = [];
    for (const x of livello) {
      const sopra = aperte.filter((c) => tocca(c.ultima, x));
      const c0 = sopra.length === 1 ? sopra[0] : null;
      if (c0 && livello.filter((y) => tocca(c0.ultima, y)).length === 1 && voltaDentro(c0.ultima, x)) { c0.righe.push(x); c0.ultima = x; nuove.push(c0); }
      else {
        const c = { righe: [x], ultima: x, n: celle.length };
        celle.push(c); nuove.push(c);
        for (const a of sopra) lati.push([a.n, c.n]);
      }
    }
    aperte = nuove;
    k = j;
  }
  return { celle: celle.map((c) => c.righe.map((x) => x.r)), lati };
}

/**
 * LA STRADA VERA DI UN PASSAGGIO, per il piano: quanto è lungo andare da `a` a `b` dentro la macchia costeggiando il
 * bordo (lo stesso costo della griglia dei passaggi: vicino al bordo un millimetro vale uno, in mezzo alla macchia di
 * più). In linea d'aria il piano sbagliava: attorno al buco di una macchia a C quattro millimetri diventano dieci.
 * Una mappa delle distanze per ogni punto di partenza (Dijkstra su una griglia di un quarto di millimetro), tenuta.
 * (Griglie più grosse, da 0,4–0,5 mm, sono più svelte ma i passaggi crescevano di un sesto: provate e lasciate.)
 */
const STRADA_MAX = 150;
const STRADA_BANDA = 2;

function stradaVera(macchia: Polyline): (a: Point, b: Point) => number {
  const g = 0.25, b0 = ingombro(macchia);
  const W = Math.ceil((b0.x1 - b0.x0) / g) + 5, H = Math.ceil((b0.y1 - b0.y0) / g) + 5, ox = b0.x0 - 2 * g, oy = b0.y0 - 2 * g;
  const tutta = rasterizza([macchia], g, ox, oy, W, H);
  const d2 = distanzeAlQuadrato(tutta, W, H);
  // solo la fascia entro 2 mm dal bordo: i passaggi la costeggiano, e così le mappe costano un terzo (sul pannello di
  // prova stessi passaggi, 2.001 mm contro 1.989 con la macchia intera; 2,6 s invece di 7,9)
  const dentro = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) dentro[k] = tutta[k] && (Math.sqrt(d2[k]) - 0.5) * g <= STRADA_BANDA ? 1 : 0;
  const vicinoAlBordo = 1 + PESO_BORDO * 0.2;
  const peso = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) peso[k] = dentro[k] ? (1 + PESO_BORDO * Math.min(2, Math.max(0, Math.sqrt(d2[k]) - 0.5) * g)) / vicinoAlBordo : 0;
  /** La cella dentro più vicina a p (i capi delle righe sfrangiate stanno anche mezzo millimetro fuori). */
  const cella = (p: Point): number => {
    const i0 = Math.floor((p.x - ox) / g), j0 = Math.floor((p.y - oy) / g);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 3 && best < 0; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H || !dentro[j * W + i]) continue;
      const dd = (i - i0) ** 2 + (j - j0) ** 2;
      if (dd < bd) { bd = dd; best = j * W + i; }
    }
    return best;
  };
  const mappe = new Map<number, Float32Array>();
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  // la coda di priorità, una sola per tutte le mappe (array tipizzati: è la parte che conta nel tempo)
  let hk = new Float64Array(1024), hv = new Int32Array(1024), n = 0;
  const metti = (key: number, v: number) => {
    if (n === hk.length) { const k2 = new Float64Array(n * 2), v2 = new Int32Array(n * 2); k2.set(hk); v2.set(hv); hk = k2; hv = v2; }
    let i = n++;
    while (i > 0) { const q = (i - 1) >> 1; if (hk[q] <= key) break; hk[i] = hk[q]; hv[i] = hv[q]; i = q; }
    hk[i] = key; hv[i] = v;
  };
  const togli = () => {
    const key = hk[--n], v = hv[n];
    let i = 0;
    for (;;) { const l = 2 * i + 1; if (l >= n) break; const m = l + 1 < n && hk[l + 1] < hk[l] ? l + 1 : l; if (hk[m] >= key) break; hk[i] = hk[m]; hv[i] = hv[m]; i = m; }
    hk[i] = key; hv[i] = v;
  };
  const mappa = (s0: number): Float32Array => {
    let dist = mappe.get(s0);
    if (dist) return dist;
    dist = new Float32Array(W * H).fill(Infinity);
    dist[s0] = 0;
    n = 0; metti(0, s0);
    while (n) {
      const du = hk[0], u = hv[0];
      togli();
      if (du > dist[u]) continue;
      if (du > STRADA_MAX) break;        // (più lontano un passaggio non conviene mai: lì vale la linea d'aria per tre)
      const ux = u % W, uy = (u - ux) / W;
      for (let t = 0; t < 8; t++) {
        const vx = ux + DX[t], vy = uy + DY[t];
        if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
        const v = vy * W + vx;
        if (!dentro[v]) continue;
        const nd = du + DL[t] * g * (peso[u] + peso[v]) / 2;
        if (nd < dist[v]) { dist[v] = nd; metti(nd, v); }
      }
    }
    mappe.set(s0, dist);
    return dist;
  };
  return (a, b) => {
    const sa = cella(a), sb = cella(b);
    if (sa < 0 || sb < 0) return Math.hypot(b.x - a.x, b.y - a.y);
    // (dalla mappa della partenza o dell'arrivo, se è già pronta: la strada è la stessa nei due versi)
    const v = (mappe.get(sb) ?? mappa(sa))[mappe.has(sb) ? sa : sb];
    return Number.isFinite(v) ? v : Math.hypot(b.x - a.x, b.y - a.y) * 3;
  };
}

/** Il piano di riserva: dalla cella più vicina, poi la più vicina a dove si è finiti. */
function pianoVicino(celle: Polyline[][], ingresso: Point, meta: Point | null): Polyline[][] {
  const capiDi = (c: Polyline[]) => [c[0][0], c[0][c[0].length - 1], c[c.length - 1][0], c[c.length - 1][c[c.length - 1].length - 1]];
  const orienta = (c: Polyline[], angolo: number) => {
    const ordinate = angolo >= 2 ? c.slice().reverse() : c, primaGirata = angolo === 1 || angolo === 3;
    return ordinate.map((r, z) => ((z % 2 === 1) !== primaGirata ? r.slice().reverse() : r));
  };
  const restano = celle.map((_, z) => z), out: Polyline[][] = [];
  let qui = ingresso;
  while (restano.length) {
    let bz = 0, ba = 0, bd = Infinity;
    restano.forEach((z, w) => capiDi(celle[z]).forEach((q, a) => { const x = Math.hypot(q.x - qui.x, q.y - qui.y); if (x < bd) { bd = x; bz = w; ba = a; } }));
    const o = orienta(celle[restano.splice(bz, 1)[0]], ba);
    out.push(o);
    const r = o[o.length - 1];
    qui = r[r.length - 1];
  }
  void meta;
  return out;
}

/**
 * IL PIANO DEL RASO di una macchia: in che ordine e in che verso cucire le sue celle. Due regole di Lorenzo
 * (2026-10-09): il raso va **da sinistra a destra**; e i passaggi da una parte all'altra della macchia stanno
 * **sempre sotto il raso**, mai sopra quello già cucito. Il secondo è un vincolo: finita una cella, la prossima
 * deve essere raggiungibile passando solo per celle ancora da cucire, dal lato dove la cella è finita (il raso
 * che verrà copre il passaggio). Il primo è una preferenza, come finire dove si esce (col ponte: dentro il ponte).
 * Si cerca fra gli ordini possibili (sono poche celle) il migliore che rispetta il vincolo.
 *
 * Una U aperta a destra, per esempio: un braccio da destra verso la base, poi la base da sinistra (ci si
 * arriva sotto, attraverso la base stessa), poi l'altro braccio verso destra.
 */
/**
 * I pesi del piano (Lorenzo, 2026-10-12: «ancora troppi passaggi lunghi e rasafilo… gli ingressi e le uscite li
 * metterei nei punti più vicini alle macchie vicine»): FINIRE vicino alla macchia dopo conta più dell'andare da
 * sinistra a destra. Ogni millimetro fra la fine del raso e la macchia dopo costa come due celle cucite da destra.
 */
const PESO_USCITA = 100;
/**
 * (2026-10-26, dal DST di Stilista) CON LE PASSATE I PASSAGGI COSTANO: ogni millimetro di passaggio dentro la macchia,
 * misurato sulla strada vera lungo il bordo (`stradaVera`), costa 5; ogni millimetro di salto, all'ingresso e
 * all'uscita, 20 — non più 100 l'uscita e quasi niente i passaggi. Lorenzo: «accetto salti un po' più lunghi fra le
 * macchie». La macchia si cuce così in una passata dal lato d'ingresso a quello d'uscita, e dove la forma si divide si
 * torna all'altro ramo col passaggio più corto. Pesi scelti misurando sulle nove macchie tracciate con Stilista.
 */
const PESO_PASSAGGIO = 5;
const PESO_SALTO_MM = 80;
/**
 * IL FILO DI UN SALTO NON PASSA MAI SOPRA UNA MACCHIA (Lorenzo, 2026-10-26: «la freccia blu presenta un passaggio da
 * macchia a macchia, ma poi lì viene ricamata e quel filo si incastrerà sicuramente sotto il ricamo; questo è da
 * evitare, conviene spostare il punto di ingresso»): il raso o il punto sopra che vengono dopo lo imprigionano, e non
 * si taglia più. Un ingresso così costa quanto dieci metri di passaggio: si sceglie solo se non ce n'è un altro.
 */
const COSTO_SALTO_SOPRA = 5e4;
/** Un salto dentro la macchia, dove nessun passaggio coperto arriva: costa come 6 mm di uscita lontana. */
const COSTO_SALTO = 1e6;
const PENALE_SINISTRA = 50;

function pianoDelRaso(
  celle: Polyline[][], lati: Array<[number, number]>, ingresso: Point, meta: Point | null, ponte: boolean, u: Point,
  daSinistra = false, passate = false, ingressoCucito = false, strada?: (a: Point, b: Point) => number,
  saltoSopra?: (a: Point, b: Point) => boolean, ingressoVicino?: Point, versoDopo?: Point, ingressoCosto?: (b: Point) => number,
): Polyline[][] | null {
  // i passaggi dentro la macchia si misurano sulla strada vera (lungo il bordo); il salto d'ingresso in linea d'aria
  const lungo = (primo: boolean, a: Point, b: Point) => (strada && !(primo && !ingressoCucito) ? strada(a, b) : d(a, b));
  const PENALE_INDIETRO = daSinistra ? PENALE_SINISTRA : 0;
  // con le passate: l'uscita lontana costa come un salto più lungo, e ogni passaggio costa; si arriva alla prima riga
  // col salto (o, se la macchia è unita alla prima, con un passaggio)
  const pesoUscita = passate ? PESO_SALTO_MM : PESO_USCITA;
  const pesoVia = (primo: boolean) => (!passate ? 0.01 : primo && !ingressoCucito ? PESO_SALTO_MM : PESO_PASSAGGIO);
  // IL SALTO D'INGRESSO (con le passate): dritto all'inizio della prima riga, se il suo filo non passa sopra una macchia
  // (il ricamo che viene dopo lo imprigionerebbe); se no al punto del bordo più vicino all'uscita, e da lì un passaggio
  // sotto il raso fino alle righe. Il piano prende il meno caro dei due.
  const ingressoDiretto = (da: Point, b: Point) => {
    const dritto = PESO_SALTO_MM * d(da, b) + (saltoSopra?.(da, b) ? COSTO_SALTO_SOPRA : 0);
    const dalBordo = ingressoVicino ? PESO_SALTO_MM * d(da, ingressoVicino) + PESO_PASSAGGIO * (strada ? strada(ingressoVicino, b) : d(ingressoVicino, b)) : Infinity;
    return Math.min(dritto, dalBordo);
  };
  const conIngresso = (primo: boolean) => passate && primo && !ingressoCucito;
  const viaCosto = (primo: boolean, via: number, da: Point, b: Point) =>
    (conIngresso(primo) ? ingressoDiretto(da, b) : primo && ingressoCosto ? ingressoCosto(b) : via * lungo(primo, da, b));
  const N = celle.length;
  if (!N) return [];
  // il verso «da sinistra a destra»: perpendicolare alle righe, con la x che cresce
  let av = { x: u.y, y: -u.x };
  if (av.x < -1e-9 || (Math.abs(av.x) < 1e-9 && av.y < 0)) av = { x: -av.x, y: -av.y };
  const pos = (r: Polyline) => r[0].x * av.x + r[0].y * av.y;
  const vicini = celle.map(() => ({ fine: [] as number[], inizio: [] as number[] }));
  for (const [a, b] of lati) { vicini[a].fine.push(b); vicini[b].inizio.push(a); }
  const serp = (righe: Polyline[], primaGirata: boolean) => righe.map((r, z) => ((z % 2 === 1) !== primaGirata ? r.slice().reverse() : r));
  const fineDi = (b: Polyline[]) => { const r = b[b.length - 1]; return r[r.length - 1]; };
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const indietro = (righe: Polyline[]) => (righe.length > 1 && pos(righe[righe.length - 1]) < pos(righe[0]) - 0.5 ? 1 : 0);
  type Mossa = { blocchi: Polyline[][]; fine: Point; lato: 'fine' | 'inizio'; costo: number };
  const ultimaRiga = (m: Mossa) => { const b = m.blocchi[m.blocchi.length - 1]; return b[b.length - 1]; };

  // le mosse per una cella: il verso (dalla prima riga all'ultima, o al contrario) e da che capo cominciare
  // i blocchi girati si preparano una volta sola (la ricerca ne prova migliaia di combinazioni)
  const cache = new Map<string, Polyline[]>();
  const girato = (chiave: string, fai: () => Polyline[]) => { let b = cache.get(chiave); if (!b) { b = fai(); cache.set(chiave, b); } return b; };
  const mosse = (c: number, da: Point, ultima: boolean, primo: boolean): Mossa[] => {
    const via = pesoVia(primo);
    const out: Mossa[] = [];
    for (const dir of [0, 1]) {
      const righe = girato(`r${c}:${dir}`, () => (dir === 0 ? celle[c] : celle[c].slice().reverse()));
      const girate = [false, true].map((g) => girato(`s${c}:${dir}:${g}`, () => serp(righe, g)));
      for (const b of girate) out.push({ blocchi: [b], fine: fineDi(b), lato: dir === 0 ? 'fine' : 'inizio', costo: PENALE_INDIETRO * indietro(righe) + viaCosto(primo, via, da, b[0][0]) });
    }
    // l'ultima cella, col ponte: la riga del ponte per ultima — prima le righe da una parte, poi quelle
    // dall'altra partendo dal fondo, verso di lei (il passaggio fra le due parti corre dove il raso non c'è ancora)
    if (ultima && meta) {
      const c0 = celle[c];
      let br = 0, be = 1, bd = Infinity;
      c0.forEach((r, z) => [r[0], r[r.length - 1]].forEach((q, e) => { const x = d(q, meta); if (x < bd) { bd = x; br = z; be = e; } }));
      for (const variante of [0, 1]) {
        const A = girato(`a${c}:${variante}`, () => (variante === 0 ? c0.slice(0, br) : c0.slice(br + 1).reverse()));
        const B = girato(`b${c}:${variante}`, () => (variante === 0 ? [...c0.slice(br + 1).reverse(), c0[br]] : [...c0.slice(0, br), c0[br]]));
        const k = B.length - 1, girataB = (be === 0) !== (k % 2 === 1);
        const bB = girato(`B${c}:${variante}`, () => serp(B, girataB));
        const blocchi: Polyline[][] = [];
        let costo = PENALE_INDIETRO * indietro(B);
        if (A.length) {
          const g0 = girato(`A${c}:${variante}:0`, () => serp(A, false)), g1 = girato(`A${c}:${variante}:1`, () => serp(A, true));
          const bA = d(g0[0][0], da) <= d(g1[0][0], da) ? g0 : g1;      // dopo la parte A si attraversa la cella stessa
          blocchi.push(bA);
          costo += PENALE_INDIETRO * indietro(A) + viaCosto(primo, via, da, bA[0][0]) + (passate ? PESO_PASSAGGIO * lungo(false, fineDi(bA), bB[0][0]) : 0);
        } else costo += viaCosto(primo, via, da, bB[0][0]);
        blocchi.push(bB);
        out.push({ blocchi, fine: fineDi(bB), lato: 'fine', costo });
      }
    }
    return out;
  };

  const fatte = new Set<number>(celle.map((c, z) => (c.length ? -1 : z)).filter((z) => z >= 0));
  // le righe come segmenti, per sapere quali celle stanno subito accanto a un punto
  const segmenti = celle.map((c) => c.map((r) => [r[0], r[r.length - 1]] as [Point, Point]));
  // (un passaggio può scorrere lungo l'ultima riga cucita, nel suo stesso solco: si raggiunge ogni cella che ha una
  // riga subito accanto a quella, non solo al punto dove la riga finisce)
  const accanto = (riga: Polyline, z: number) => {
    const p = riga[0], q = riga[riga.length - 1];
    return segmenti[z].some(([a, b]) => Math.min(distanzaSegmento(p, a, b), distanzaSegmento(q, a, b), distanzaSegmento(a, p, q), distanzaSegmento(b, p, q)) <= 0.55);
  };
  /**
   * Le celle ancora da cucire raggiungibili da dove si è finiti passando solo da celle non cucite: si parte da quelle
   * che hanno una riga subito accanto all'ultima cucita (la volta del raso), fra i vicini della cella `c`.
   */
  const raggiungibili = (c: number, ultima: Polyline): Set<number> => {
    const visti = new Set<number>(), coda = [...vicini[c].fine, ...vicini[c].inizio].filter((z) => !fatte.has(z) && accanto(ultima, z));
    for (const z of coda) visti.add(z);
    while (coda.length) {
      const z = coda.pop()!;
      for (const w of [...vicini[z].fine, ...vicini[z].inizio]) if (!fatte.has(w) && !visti.has(w)) { visti.add(w); coda.push(w); }
    }
    return visti;
  };
  const BONUS = 3000;
  type Resto = { costo: number; blocchi: Polyline[][]; dopo: Resto } | null;
  // Ricerca esaustiva con memoria: lo stato è (celle già cucite, dove si è finiti). Il meglio da uno stato in
  // poi non dipende da come ci si è arrivati, quindi si calcola una volta sola. Oltre un tetto di stati (macchie
  // con più di una dozzina di parti) ci si ferma e si tiene il meglio trovato fin lì.
  const memo = new Map<string, Resto>();
  let stati = 0, troppi = false;
  // le celle cucite come maschera di bit (la chiave della memoria si calcola a ogni stato: dev'essere svelta)
  let maschera = 0n;
  for (const z of fatte) maschera |= 1n << BigInt(z);
  const chiaveFatte = () => maschera.toString(36);
  const risolvi = (cur: number, chiaveQui: string, qui: Point, riga: Polyline | null): Resto => {
    if (fatte.size === N) {
      if (!meta) return { costo: 0, blocchi: [], dopo: null };
      const x = d(qui, meta);
      // (e se da dove si finisce il salto verso la macchia dopo passa sopra una macchia — quasi sempre questa: si esce
      // dal lato lontano — costa come un ingresso così)
      const sopraUscendo = !ponte && versoDopo && saltoSopra?.(qui, versoDopo) ? COSTO_SALTO_SOPRA : 0;
      return { costo: pesoUscita * x - (ponte && x < 1 ? BONUS : 0) + sopraUscendo, blocchi: [], dopo: null };
    }
    const chiave = chiaveFatte() + '|' + chiaveQui;
    if (memo.has(chiave)) return memo.get(chiave)!;
    if (++stati > 60000) { troppi = true; return null; }
    let libere = cur < 0 || !riga ? celle.map((_, z) => z).filter((z) => !fatte.has(z)) : [...raggiungibili(cur, riga)];
    // in un vicolo cieco (nessuna cella da cucire raggiungibile restando coperti) si salta: costa, ma il piano va
    // avanti invece di arrendersi
    const salto = cur >= 0 && !libere.length;
    // (col salto si provano solo le tre celle da cucire più vicine: saltare lontano non conviene mai)
    if (salto) libere = celle.map((_, z) => z).filter((z) => !fatte.has(z))
      .map((z) => ({ z, dd: Math.min(...segmenti[z].map(([a, b]) => distanzaSegmento(qui, a, b))) }))
      .sort((a, b) => a.dd - b.dd).slice(0, 3).map((x) => x.z);
    libere.sort((a, b) => pos(celle[a][0]) - pos(celle[b][0]));            // prima quelle a sinistra
    const ultima = fatte.size === N - 1;
    // Una cella che, cucita, divide in due il raso ancora da fare si sceglie solo se non c'è altro: i pezzi separati
    // si raggiungerebbero poi solo con un salto (si passa soltanto dove il raso non c'è ancora).
    const spezza = (t: number) => {
      const resto = celle.map((_, z) => z).filter((z) => !fatte.has(z) && z !== t);
      if (resto.length < 2) return false;
      const visti = new Set([resto[0]]), coda = [resto[0]];
      while (coda.length) {
        const z = coda.pop()!;
        for (const w of [...vicini[z].fine, ...vicini[z].inizio]) if (w !== t && !fatte.has(w) && !visti.has(w)) { visti.add(w); coda.push(w); }
      }
      return visti.size < resto.length;
    };
    if (!salto) { const intere = libere.filter((t) => !spezza(t)); if (intere.length) libere = intere; }
    // Le mosse che finiscono in un vicolo cieco (cucita la cella, nessuna cella da cucire accanto alla sua ultima riga)
    // costano un salto dopo: si provano solo se non ce n'è un'altra. Un piano senza salti c'è quasi sempre (si cuce
    // una cella che non divide il resto, finendo dal lato del resto), ma nelle macchie coi ponti, a 13–17 celle,
    // provando anche i vicoli ciechi la ricerca arrivava al tetto prima di trovarlo, e teneva un piano coi salti.
    let candidate = libere.flatMap((t) => mosse(t, qui, ultima, cur < 0).map((m, mi) => ({ t, m, mi })));
    if (!salto && !ultima) {
      const aperte = candidate.filter(({ t, m }) => {
        fatte.add(t);
        const ok = raggiungibili(t, ultimaRiga(m)).size > 0;
        fatte.delete(t);
        return ok;
      });
      if (aperte.length) candidate = aperte;
    }
    let meglio: Resto = null;
    for (const { t, m, mi } of candidate) {
      fatte.add(t); maschera |= 1n << BigInt(t);
      const resto = risolvi(t, `${t}:${mi}`, m.fine, ultimaRiga(m));
      fatte.delete(t); maschera &= ~(1n << BigInt(t));
      const costo = m.costo + (salto ? COSTO_SALTO + 10 * d(qui, m.blocchi[0][0][0]) : 0);
      if (resto && (!meglio || costo + resto.costo < meglio.costo)) meglio = { costo: costo + resto.costo, blocchi: m.blocchi, dopo: resto };
    }
    if (!troppi) memo.set(chiave, meglio);
    return meglio;
  };
  const piano = risolvi(-1, 'ingresso', ingresso, null);
  if (!piano) return null;
  const out: Polyline[][] = [];
  for (let r: Resto = piano; r; r = r.dopo) out.push(...r.blocchi);
  return out;
}

/**
 * LA SFRANGIATURA: ogni riga del raso finisce, a caso, un po' prima o un po' dopo il bordo — fino a `dentro` mm
 * prima, `fuori` mm dopo. Il bordo della macchia non è più una linea netta. Si spostano solo i capi della riga:
 * i punti in mezzo restano (via quelli che la riga accorciata non raggiunge più). Dentro, al più tre decimi della riga
 * per capo: dove la macchia è più stretta della sfrangiatura le righe non spariscono (con la sfrangiatura a 5 mm, nelle
 * strozzature larghe 2 mm restavano buchi senza raso, e il passaggio sotto il raso non passava più).
 */
function sfrangia(riga: Polyline, macchia: number, n: number, dentroMax: number, fuori: number): Polyline | null {
  if (dentroMax <= 0 && fuori <= 0) return riga;
  const a = riga[0], b = riga[riga.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1e-6) return null;
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, dentro = Math.min(dentroMax, L * 0.3);
  const s0 = dentro - caso(macchia, n, 0) * (dentro + fuori);         // dove comincia, lungo la riga
  const s1 = L - dentro + caso(macchia, n, 1) * (dentro + fuori);     // dove finisce
  if (s1 - s0 < 0.4) return null;
  const at = (s: number): Point => ({ x: a.x + u.x * s, y: a.y + u.y * s });
  const mezzo = riga.slice(1, -1).filter((q) => { const s = (q.x - a.x) * u.x + (q.y - a.y) * u.y; return s > s0 + 0.3 && s < s1 - 0.3; });
  return [at(s0), ...mezzo, at(s1)];
}

/** Il punto più corto ai capi di una riga del raso con la fase, mm: un ago più vicino al capo non si mette. */
const RASO_FASE_MIN = 1;

/**
 * LA FASE DEL RASO (Lorenzo, 2026-10-29: «sì, 30% del punto»). Gli aghi di una riga stanno su una scala di passo
 * `passo`, la stessa per tutto il pannello, spostata di `fase`% del passo a ogni riga (la riga si conta
 * dall'interlinea, di traverso al raso): righe accanto non hanno gli aghi alla stessa altezza. Ai capi un ago a meno
 * di `RASO_FASE_MIN` non si mette; se così un punto supera il passo, quel punto si divide in parti uguali come prima.
 * `riga` è dritta (i capi bastano), `verso` il verso delle righe, `origine` dove sta (di traverso) la riga 0.
 */
function aFase(riga: Polyline, passo: number, fase: number, verso: Point, interlinea: number, origine: number): Polyline {
  const a = riga[0], b = riga[riga.length - 1];
  const sa = a.x * verso.x + a.y * verso.y, sb = b.x * verso.x + b.y * verso.y, L = Math.abs(sb - sa);
  if (L <= passo) return [a, b];
  const j = Math.round((-a.x * verso.y + a.y * verso.x - origine) / (interlinea || 1));
  const f = (((j * fase) / 100) % 1 + 1) % 1, s0 = Math.min(sa, sb), s1 = Math.max(sa, sb);
  const quote: number[] = [];
  for (let k = Math.ceil(s0 / passo - f); (k + f) * passo < s1; k++) {
    const s = (k + f) * passo;
    if (s - s0 >= RASO_FASE_MIN && s1 - s >= RASO_FASE_MIN) quote.push(s);
  }
  if (sb < sa) quote.reverse();
  const at = (s: number): Point => { const t = (s - sa) / (sb - sa); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
  const aghi = [a, ...quote.map(at), b];
  const out: Polyline = [a];
  for (let k = 1; k < aghi.length; k++) for (const q of apasso([aghi[k - 1], aghi[k]], passo).slice(1)) out.push(q);
  return out;
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

/**
 * Il pezzo più corto di una barretta spezzata sul bordo, mm: un pezzo dentro più corto si allunga fino a tanto (un po'
 * fuori dalla macchia, sotto le punte del raso), un pezzo fuori più corto passa dentro. Così non nascono punti corti.
 */
const BARRETTA_PEZZO_MIN = 1;

/**
 * LA BASE A DUE PASSAGGI SOTTO LE MACCHIE (Lorenzo, 2026-10-29: «la base che lateralmente è a 2 passaggi e al centro è
 * a 4 passaggi, deve prevedere però dove ci saranno le macchie sopra. Dove vi sono le macchie i passaggi rimangono a 2
 * per non sovrapporre troppo filo»). Dove la base va e torna più volte sullo stesso tratto (a, b, a, b, a: le barrette a
 * 4 passaggi del centro), dentro le macchie solo andata e ritorno; fuori resta com'è. Una barretta a cavallo del bordo
 * si spezza dove lo attraversa: fuori i suoi passaggi, dentro due (a fuori, b dentro: a, c, a, c, b, a). Dentro la
 * macchia mai 4 passaggi, nemmeno nei pezzetti sul bordo (Lorenzo, stesso giorno: «togliamo anche i pezzetti da 1 mm sul
 * bordo, non sono necessari»): un pezzo dentro più corto di `BARRETTA_PEZZO_MIN` si allunga fino a tanto, verso fuori;
 * un pezzo fuori più corto passa a due. I capi della barretta restano quelli, e la base va avanti come prima.
 */
function dueSottoLeMacchie(base: Polyline[], forme: Polyline[]): Polyline[] {
  const bb = forme.map(ingombro);
  const ug = (p: Point, q: Point) => Math.abs(p.x - q.x) < 1e-4 && Math.abs(p.y - q.y) < 1e-4;
  /** I pezzi di a→b, da 0 a 1: dentro una macchia o fuori. */
  const pezzi = (a: Point, b: Point): Array<{ t0: number; t1: number; dentro: boolean }> => {
    const L = Math.hypot(b.x - a.x, b.y - a.y), tt = (p: Point) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (L * L);
    const dentro: Array<[number, number]> = [];
    forme.forEach((f, i) => {
      const q = bb[i];
      if (Math.max(a.x, b.x) < q.x0 || Math.min(a.x, b.x) > q.x1 || Math.max(a.y, b.y) < q.y0 || Math.min(a.y, b.y) > q.y1) return;
      for (const [p, r] of clipSegmentToPolygon(a, b, f)) dentro.push([tt(p), tt(r)]);
    });
    // (un pezzo dentro corto si allunga attorno al suo mezzo, restando sulla barretta: dentro c'è tutto)
    // (un centesimo in più: il punto che nasce non scende sotto il minimo per gli arrotondamenti)
    const h = Math.min(1, (BARRETTA_PEZZO_MIN + 0.01) / L);
    for (const d of dentro) if (d[1] - d[0] < h) {
      const m = Math.min(1 - h / 2, Math.max(h / 2, (d[0] + d[1]) / 2));
      d[0] = Math.min(d[0], m - h / 2); d[1] = Math.max(d[1], m + h / 2);
    }
    dentro.sort((x, y) => x[0] - y[0]);
    let out: Array<{ t0: number; t1: number; dentro: boolean }> = [];
    let t = 0;
    for (const [s, e] of dentro) {
      if (s > t) out.push({ t0: t, t1: s, dentro: false });
      if (e > t) out.push({ t0: Math.max(t, s), t1: e, dentro: true });
      t = Math.max(t, e);
    }
    if (t < 1) out.push({ t0: t, t1: 1, dentro: false });
    // (un pezzo fuori corto, fra il bordo e un capo o fra due macchie, passa dentro: due passaggi)
    const corto = (p: { t0: number; t1: number }) => (p.t1 - p.t0) * L < BARRETTA_PEZZO_MIN;
    const unisci = (v: typeof out) => v.reduce<typeof out>((acc, p) => {
      const u = acc[acc.length - 1];
      if (u && u.dentro === p.dentro) u.t1 = p.t1; else acc.push({ ...p });
      return acc;
    }, []);
    if (dentro.length) out = unisci(out.map((p) => (!p.dentro && corto(p) ? { ...p, dentro: true } : p)));
    return out;
  };
  return base.map((l) => {
    const out: Polyline = [];
    // (`dato`: l'ultimo punto della linea già messo, che è anche dove comincia la corsa dopo)
    let i = 0, dato = -1;
    while (i < l.length) {
      // la corsa a, b, a, b, …: quante volte il filo passa su a–b
      let j = i + 1;
      while (j + 1 < l.length && ug(l[j + 1], l[j - 1])) j++;
      const n = j - i, tieni = n % 2 ? 3 : 2;
      const a = l[i], b = l[i + 1];
      const pz = j < l.length && n > tieni && Math.hypot(b.x - a.x, b.y - a.y) > 1e-6 ? pezzi(a, b) : [];
      if (!pz.some((p) => p.dentro)) { if (i !== dato) out.push(a); i++; continue; }
      // andata da a a b: su ogni pezzo fuori, i passaggi in più (avanti e indietro); poi i ritorni che restano
      const at = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const via: Polyline = [a];
      for (const p of pz) {
        if (p.dentro) continue;
        if (p.t0 > 0) via.push(at(p.t0));
        via.push(at(p.t1));
        for (let k = 0; k < (n - tieni) / 2; k++) via.push(at(p.t0), at(p.t1));
      }
      via.push(b);
      for (let k = 1; k < tieni; k++) via.push(k % 2 ? a : b);
      for (const q of via) if (!out.length || !ug(out[out.length - 1], q)) out.push(q);
      i = dato = j;
    }
    return out;
  });
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

  // 1. LA BASE INTERA, una volta sola: è la base E il punto sopra le macchie (dal 2026-10-29 spostato di
  //    `sopraSfasaX`, `sopraSfasaY`: lo stesso disegno, ma gli aghi fuori dal filo della base).
  const intera = generateFinalPatternPoints({ ...comune, importedBoundary: sagoma([]) }).visualPolylines
    .map((l) => l.map((p) => ({ x: p.x, y: p.y })));

  // 2. LA BASE: intera (o, se un giorno servirà, tagliata sulle macchie ristrette del margine).
  const buchi = par.bucaLaBase ? macchie.flatMap((m) => restringi(m, par.margineBase)) : [];
  const baseLinee = buchi.length ? tagliaSuiBuchi(intera, buchi) : intera;
  const fineBase = baseLinee.length ? baseLinee[baseLinee.length - 1].at(-1) : undefined;

  // 3. L'ORDINE, e i ponti fra macchie che si seguono e sono vicine: la macchia PRIMA si allarga fino a quella
  //    dopo (ci entra di mezzo millimetro). Nella macchia prima, perché così il suo raso e il suo punto sopra
  //    possono finire dentro il ponte, cioè già dentro la macchia dopo: si continua senza salto.
  // le zone: ogni macchia in quella del suo centro; ogni zona col suo ordine, che parte vicino a dove la zona prima finisce
  const nZone = Math.max(1, Math.min(8, Math.round(par.zone || 1)));
  const lungoX = par.zoneVerso !== 'orizzontale';
  const zone: number[][] = Array.from({ length: nZone }, () => []);
  macchie.forEach((m, i) => {
    const b = ingombro(m), c = lungoX ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2;
    const a0 = lungoX ? bbP.x0 : bbP.y0, a1 = lungoX ? bbP.x1 : bbP.y1;
    zone[Math.min(nZone - 1, Math.max(0, Math.floor(((c - a0) / (a1 - a0 || 1)) * nZone)))].push(i);
  });
  const ordini: number[][] = [];
  let partenza = fineBase;
  for (const z of zone) {
    if (!z.length) { ordini.push([]); continue; }
    const o = ordinaMacchie(z.map((i) => macchie[i]), partenza, Math.max(0.05, par.ponti), par.daSinistra === true).map((k) => z[k]);
    ordini.push(o);
    const u = ingombro(macchie[o[o.length - 1]]);
    partenza = { x: (u.x0 + u.x1) / 2, y: (u.y0 + u.y1) / 2 };
  }
  const ordine = ordini.flat();
  const forme = macchie.slice();
  /** Per la macchia da cui parte un ponte: la macchia dove arriva. */
  const ponteVerso = new Map<number, number>();
  /** Per la macchia da cui parte un ponte: dove parte (sul suo bordo) e dove arriva (sul bordo dell'altra). */
  const asse = new Map<number, [Point, Point]>();
  // (i ponti solo dentro una zona: fra due zone c'è uno stop)
  if (par.ponti > 0) for (const ordine of ordini) for (let k = 1; k < ordine.length; k++) {
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

  // 4. LA BASE SOTTO LE MACCHIE A DUE PASSAGGI (Lorenzo, 2026-10-29: «dove vi sono le macchie i passaggi rimangono a 2
  //    per non sovrapporre troppo filo»): le barrette che vanno e tornano più volte, dentro le macchie (coi ponti) una
  //    sola andata e ritorno. La base resta intera, e comincia e finisce dove prima.
  const baseCucita = dueSottoLeMacchie(baseLinee, forme);
  // IL PUNTO SOPRA SFASATO (Lorenzo, 2026-10-29: «ricreare sì quel punto della grandezza come la base, ma lo sfasiamo
  // un po', in modo che non corrisponda ed il filo del punto speciale della macchia non batte sul filo della base»): la
  // base intera spostata di (`sopraSfasaX`, `sopraSfasaY`), poi tagliata sulla macchia come prima: non ne esce.
  const sx = par.sopraSfasaX || 0, sy = par.sopraSfasaY || 0;
  const baseSopra = sx || sy ? baseLinee.map((l) => l.map((p) => ({ x: p.x + sx, y: p.y + sy }))) : baseLinee;

  // 5. LE MACCHIE: stop 2 il raso di tutte, stop 3 il punto sopra di tutte (Lorenzo, 2026-10-08: «ho bisogno che
  //    le macchie siano divise in 2 stop, lo stop del raso e lo stop del punto sopra»). Lo stesso ordine per tutti
  //    e due; in ognuno si entra dove conviene e si esce dal lato della macchia che viene dopo.
  const ang = (par.rasoAngolo * Math.PI) / 180, verso = { x: Math.cos(ang), y: Math.sin(ang) };
  const fuori = Math.max(0, par.sfrangiatura) * Math.min(1, Math.max(0, par.sfrangiaturaFuori / 100));
  const dentroSfr = Math.max(0, par.sfrangiatura) - fuori;
  const vista = { raso: [] as Polyline[], sopra: [] as Polyline[], sotto: [] as Polyline[] };
  const saltiFra = { raso: [] as number[], sopra: [] as number[] };
  let saltiDentro = 0, tolto = 0, passaggiScoperti = 0;

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
  /** I due punti più vicini fra due macchie, tenuti: servono all'uscita del raso, a quella del punto sopra e al piano. */
  const viciniTenuti = new Map<number, [Point, Point, number]>();
  const piuViciniFra = (i: number, j: number) => {
    const chiave = i * 100003 + j;
    let v = viciniTenuti.get(chiave);
    if (!v) { v = piuVicini(forme[i], forme[j]); viciniTenuti.set(chiave, v); }
    return v;
  };
  const uscitaVerso = (ordine: number[], k: number): Point | null => {
    if (k + 1 >= ordine.length) return null;
    const i = ordine[k], m = forme[i];
    const ponte = asse.get(i);
    if (ponte) {
      const [pa, pb] = ponte, l = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      const punta = { x: pb.x + ((pb.x - pa.x) / l) * 0.25, y: pb.y + ((pb.y - pa.y) / l) * 0.25 };
      if (pointInPolygon(punta, m)) return punta;
    }
    const [pa, pb, dd] = piuViciniFra(i, ordine[k + 1]);
    const l = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    // appena dentro (un quarto di millimetro): sul bordo la corda nel verso del raso può non entrare nella macchia
    const dentroA = dd > 1e-6 && l > 1e-6 ? { x: pa.x - ((pb.x - pa.x) / l) * 0.25, y: pa.y - ((pb.y - pa.y) / l) * 0.25 } : pa;
    return pointInPolygon(dentroA, m) ? dentroA : pa;
  };
  /** Si passa dalla macchia di prima senza salto solo se il passaggio resta tutto dentro questa (si toccano, o c'è un ponte). */
  /**
   * Se il filo dritto di un salto da `a` a `b` passa sopra una macchia della zona (quella dove si entra, quella da cui
   * si esce, le altre: tutte avranno sopra il raso o il punto sopra della zona, prima dello stop; quelle delle altre
   * zone si cuciono dopo uno stop, quando il filo del salto è già tagliato): tolti 0,8 mm ai due capi, che stanno sul
   * bordo o appena dentro (le righe sfrangiate), nessun punto più di due decimi dentro una macchia.
   */
  const bbF = forme.map(ingombro);
  // (sul contorno semplificato a un decimo: per ogni salto si provano decine di punti, su pannelli di centinaia di macchie)
  const formeSem = forme.map((f) => simplifyPolyline(f, 0.1));
  const memoSopra = new Map<string, boolean>();
  let zonaOra = 0;
  const saltoSopra = (a: Point, b: Point): boolean => {
    const chiave = `${zonaOra}|${a.x.toFixed(3)},${a.y.toFixed(3)},${b.x.toFixed(3)},${b.y.toFixed(3)}`;
    const v0 = memoSopra.get(chiave);
    if (v0 !== undefined) return v0;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    let esito = false;
    if (L > 1.6) {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      const vicine = ordini[zonaOra].filter((k) => bbF[k].x1 >= x0 && bbF[k].x0 <= x1 && bbF[k].y1 >= y0 && bbF[k].y0 <= y1).map((k) => formeSem[k]);
      for (let s = 0.8; s <= L - 0.8 && !esito; s += 0.25) {
        const p = { x: a.x + ((b.x - a.x) * s) / L, y: a.y + ((b.y - a.y) * s) / L };
        for (const f of vicine) if (pointInPolygon(p, f) && distanceToBoundary(p, f) > 0.2) { esito = true; break; }
      }
    }
    memoSopra.set(chiave, esito);
    return esito;
  };
  const unitoA = (da: Point | undefined, a: Point, m: Polyline) =>
    !!da && (pointInPolygon(da, m) || distanceToBoundary(da, m) < 0.05) && restaDentro(da, a, m);

  const livello = (t: Polyline[]): Livello => ({ tratti: t, punti: contaPunti(t), salti: Math.max(0, t.length - 1) });
  const stop: RisultatoMacchie['stop'] = [];
  const ultimaRigaPer = new Map<number, Polyline>();
  let fineStop: Point | undefined = fineBase;
  ordini.forEach((ordine, zona) => {
  if (!ordine.length) return;
  zonaOra = zona;

  // ---- STOP 2: IL RASO (della zona) ----
  const stopRaso = livelloCucito();
  /** Le righe di raso già cucite in questo stop (per non tagliarle entrando nelle macchie dopo). */
  const rasoCucito: Polyline[] = [];
  let uscita: Point | undefined = fineStop;
  ordine.forEach((i, k) => {
    const m = forme[i];
    const meta = uscitaVerso(ordine, k);

    // A CELLE: nelle macchie a C, a S, una riga non può andare avanti e indietro fra un braccio e l'altro (il filo
    // resterebbe di traverso sopra il raso già cucito). Ogni cella è un tratto di macchia dove le righe si
    // seguono senza interruzioni: si cuce intera, in serpentina, poi la cella più vicina. Con quale cella e da
    // quale angolo cominciare: quello che fa FINIRE il raso più vicino alla macchia dopo (all'inizio si arriva
    // comunque sotto il raso, dove il filo non si vede).
    const grezze = buildParallelFill(m, [], { angleDeg: par.rasoAngolo, spacingMm: par.rasoInterlinea, maxStitchMm: par.rasoPuntoMax, mode: 'serpentine' });
    let n = 0;
    // (la riga 0 della fase: la prima riga della macchia)
    const origine = grezze.length ? -grezze[0][0].x * verso.y + grezze[0][0].y * verso.x : 0;
    const divise = celleDelRaso(grezze, verso, par.rasoInterlinea, m);
    const celle = divise.celle
      .map((c) => c.map((r) => sfrangia(r, i, n++, dentroSfr, fuori)).filter((r): r is Polyline => !!r && r.length >= 2).map((r) => aFase(r, par.rasoPuntoMax, par.rasoFase, verso, par.rasoInterlinea, origine)));
    const interno = new SottoIlRaso(m, celle.flat(), fuori);
    const bm = ingombro(m);
    interno.giaCucite(rasoCucito.filter((r) => { const b = ingombro(r); return b.x1 > bm.x0 - 1 && b.x0 < bm.x1 + 1 && b.y1 > bm.y0 - 1 && b.y0 < bm.y1 + 1; }), uscita);
    // L'INGRESSO: il punto più vicino a dove si è usciti fra quelli che il raso coprirà. Se il passaggio da lì resta
    // dentro la macchia (le macchie si toccano, o c'è un ponte) si continua; se no è un salto.
    // (con le PASSATE — sempre, salvo «da sinistra a destra»: se non si è uniti alla macchia prima si salta dritti
    // all'inizio della prima riga, che il piano mette dal lato da cui si arriva — nessun passaggio dentro la macchia
    // per arrivarci, se il filo del salto non passa sopra una macchia)
    const passate = par.daSinistra !== true;
    const ingresso = uscita ? interno.vicino(uscita) : interno.vicino(m[0]);
    const unito = k > 0 && unitoA(uscita, ingresso, m);
    const catenaRaso: Polyline = [];
    let sotto: Polyline = [ingresso];
    let senzaSotto = false;
    let fin: Point = ingresso;
    // IL PIANO: ogni passaggio sotto il raso che verrà (vedi `pianoDelRaso`). Se non ce n'è uno (non è mai successo
    // sul pannello di prova), il vecchio modo: la cella più vicina.
    const daDove = passate && uscita ? uscita : ingresso;
    const pianifica = (ingressoCosto?: (b: Point) => number) => pianoDelRaso(celle, divise.lati, daDove, meta, asse.has(i), verso, par.daSinistra === true, passate, unito, passate ? stradaVera(m) : undefined, passate ? saltoSopra : undefined, uscita ? ingresso : undefined,
      passate && k + 1 < ordine.length ? piuViciniFra(i, ordine[k + 1])[1] : undefined, ingressoCosto);
    // il passaggio sotto il raso dall'ingresso (o, unite, da dove la macchia prima è finita) fino a `b`, se c'è
    const sottoFino = (b: Point): Polyline | null => {
      const cerca = () => (unito && uscita ? interno.strada(uscita, b) : null) ?? interno.strada(ingresso, b);
      let via = cerca();
      if (!via) { interno.puntaAltrui = 1.1; via = cerca(); interno.puntaAltrui = 0; }
      return via;
    };
    let pianoTrovato = pianifica();
    // (Lorenzo, 2026-10-28: «Il raso è facile, devi fare dei salti con il punto più vicino della macchia successiva. poi
    // fai un passaggio nascosto e ricami la macchia come preferisci») Il piano dà per scontato che dall'ingresso si
    // arrivi sotto il raso a ogni riga; dove la macchia si stringe e la sfrangiatura lascia un buco, no. Se alla prima
    // riga del piano non si arriva, si rifà il piano: una prima riga che non si raggiunge costa il salto fin lì.
    const primaDi = (p: Polyline[][] | null) => p?.find((b) => b.length)?.[0]?.[0];
    const p0 = primaDi(pianoTrovato);
    if (!passate && uscita && p0 && !sottoFino(p0)) {
      const visti = new Map<string, number>();
      const costo = (b: Point) => {
        const c = `${b.x},${b.y}`;
        let v = visti.get(c);
        if (v === undefined) {
          v = sottoFino(b) ? 0.01 * Math.hypot(b.x - ingresso.x, b.y - ingresso.y) : PESO_SALTO_MM * Math.hypot(b.x - uscita!.x, b.y - uscita!.y);
          visti.set(c, v);
        }
        return v;
      };
      pianoTrovato = pianifica(costo) ?? pianoTrovato;
    }
    let blocchi = pianoTrovato ?? pianoVicino(celle.filter((c) => c.length), daDove, meta);
    const primaRiga = blocchi.find((b) => b.length)?.[0]?.[0] ?? ingresso;
    // (dritti all'inizio della prima riga solo se il filo del salto non passa sopra una macchia: se no si entra dal punto
    // del bordo più vicino, e sotto il raso fino alle righe)
    const saltoDritto = passate && !unito && !(uscita && saltoSopra(uscita, primaRiga));
    if (k > 0 && uscita && !unito) { const a = saltoDritto ? primaRiga : ingresso; saltiFra.raso.push(Math.hypot(a.x - uscita.x, a.y - uscita.y)); }
    // i pezzi di raso separati da un salto (dove fra una parte e l'altra non c'è strada sotto il raso)
    const pezziRaso: Polyline[] = [catenaRaso];
    let catena = catenaRaso;
    /** Il passaggio coperto da `da` all'inizio delle righe: la volta accanto, o la strada dove il raso ancora manca. */
    const passaggio = (da: Point, righe: Polyline[]): Polyline | null => {
      const inizio = righe[0][0];
      // la prima riga del blocco è quella accanto all'ultima cucita: si passa di traverso (la volta del raso) e
      // poi lungo la riga da cucire, fino al suo inizio — la riga, subito dopo, copre il passaggio
      const r0 = righe[0], fineR0 = r0[r0.length - 1], L0 = Math.hypot(fineR0.x - inizio.x, fineR0.y - inizio.y) || 1;
      const ux = (fineR0.x - inizio.x) / L0, uy = (fineR0.y - inizio.y) / L0;
      const lungo = (da.x - inizio.x) * ux + (da.y - inizio.y) * uy, traverso = Math.abs((da.x - inizio.x) * uy - (da.y - inizio.y) * ux);
      const a2 = { x: inizio.x + ux * lungo, y: inizio.y + uy * lungo };
      if (traverso <= par.rasoInterlinea * 1.6 && lungo >= 0 && lungo <= L0 && !interno.attraversa(da, a2) && !interno.attraversa(a2, inizio)) return [da, a2, inizio];
      return interno.strada(da, inizio);
    };
    /** I quattro modi di cucire un blocco in serpentina: com'è, girato tutto, ogni riga girata, l'ordine girato. */
    const modi = (b: Polyline[]) => [b, b.slice().reverse().map((r) => r.slice().reverse()), b.map((r) => r.slice().reverse()), b.slice().reverse()];
    const restano = blocchi.slice();
    while (restano.length) {
      let righe = restano.shift()!;
      if (pezziRaso.length === 1 && !catena.length) {
        // sotto il raso, fino alle righe; se una strada coperta non c'è, si salta direttamente all'inizio delle righe
        // (unite alla macchia prima, si parte da dove quella è finita: anche il primo tratto resta sotto)
        const via = saltoDritto ? [righe[0][0]] : sottoFino(righe[0][0]);
        if (via) sotto = via; else { sotto = [righe[0][0]]; senzaSotto = true; }
      } else {
        let via = passaggio(fin, righe);
        if (!via) {
          // il ponte della macchia prima entra in questa fino a un millimetro (mezzo di ponte, mezzo di sfrangiatura), e
          // le punte delle sue righe possono chiudere la strada verso il blocco previsto; il piano non le conosce. Prima
          // di cambiare blocco o verso le si scavalca, entro 1,1 mm dalla punta: stanno dentro questa macchia, e il suo
          // raso le copre subito dopo.
          interno.puntaAltrui = 1.1;
          via = passaggio(fin, righe);
          interno.puntaAltrui = 0;
        }
        if (!via) {
          // la strada coperta per il blocco previsto non c'è (la griglia è più severa del piano): un altro blocco, o
          // lo stesso in un altro verso, che si raggiunga coperto — prima di arrendersi al salto
          trova: for (let z = 0; z < restano.length + 1; z++) {
            const cand = z === 0 ? righe : restano[z - 1];
            for (const mm of modi(cand)) {
              const v = passaggio(fin, mm);
              if (!v) continue;
              if (z > 0) { restano.splice(z - 1, 1); restano.unshift(righe); }
              righe = mm; via = v;
              break trova;
            }
          }
        }
        if (via) for (const q of apasso(via, par.rasoPuntoMax).slice(1, -1)) catena.push(q);
        else { catena = []; pezziRaso.push(catena); passaggiScoperti++; }       // mai sopra il raso: piuttosto un salto
      }
      const catenaRaso = catena;
      for (const r of righe) {
        const u = catenaRaso[catenaRaso.length - 1];
        if (u && Math.hypot(r[0].x - u.x, r[0].y - u.y) > par.rasoPuntoMax) for (const q of apasso([u, r[0]], par.rasoPuntoMax).slice(1, -1)) catenaRaso.push(q);
        for (const q of r) catenaRaso.push(q);
      }
      ultimaRigaPer.set(i, righe[righe.length - 1]);
      fin = catenaRaso[catenaRaso.length - 1];
      interno.occupa(righe);
    }
    rasoCucito.push(...celle.flat());
    const sottoCucito = enforceMinStitch(apasso(sotto, 3), RASO_PUNTO_MIN);
    const unisci = unito && !senzaSotto;
    if (unito && senzaSotto) passaggiScoperti++;      // (unita alla macchia prima, ma all'inizio delle righe si salta)
    stopRaso.attacca(unisci && uscita ? [uscita, ...sottoCucito] : sottoCucito, !unisci);
    vista.sotto.push(sottoCucito);
    pezziRaso.forEach((pz, z) => {
      const raso = enforceMinStitch(pz, RASO_PUNTO_MIN);
      if (raso.length < 2) return;
      stopRaso.attacca(raso, z > 0);
      vista.raso.push(raso);
      uscita = raso[raso.length - 1];
    });
    if (!pezziRaso.some((pz) => pz.length >= 2)) uscita = sotto[sotto.length - 1];
  });

  // ---- STOP 3: IL PUNTO SOPRA, che si muove come la base (vedi `sopraComeLaBase`) ----
  // Ogni macchia comincia vicino a dove è finita la prima; fra una macchia e l'altra si salta. Col ponte il punto sopra
  // sta anche sul ponte, ma non dove il ponte entra nella macchia dopo (lì è di quella).
  const stopSopra = livelloCucito();
  const minimo = Math.max(0.3, par.sopraPuntoMin);
  uscita = stopRaso.tratti.length ? stopRaso.tratti[stopRaso.tratti.length - 1].at(-1) : fineStop;
  ordine.forEach((i, k) => {
    // (il salto d'ingresso: mai sopra una macchia ancora da cucire, questa compresa)
    const daCucire = ordine.slice(k);
    const buonSalto = (a: Point, b: Point) => {
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L <= 1.6) return true;
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      const vicine = daCucire.filter((j) => bbF[j].x1 >= x0 && bbF[j].x0 <= x1 && bbF[j].y1 >= y0 && bbF[j].y0 <= y1).map((j) => formeSem[j]);
      for (let t = 0.8; t <= L - 0.8; t += 0.25) {
        const q = { x: a.x + ((b.x - a.x) * t) / L, y: a.y + ((b.y - a.y) * t) / L };
        for (const f of vicine) if (pointInPolygon(q, f) && distanceToBoundary(q, f) > 0.2) return false;
      }
      return true;
    };
    const dopo = ponteVerso.get(i);
    const r = sopraComeLaBase(baseSopra, forme[i], uscita, uscitaVerso(ordine, k), minimo, par.pezzoMinimo, buonSalto, dopo === undefined ? null : macchie[dopo]);
    const tratti = r.tratti;
    tolto += r.tolto;
    // (col ponte dalla macchia prima si arriva sul ponte, accanto a questa: si continua senza salto, con un punto sul
    // ponte, se è corto e resta dentro)
    const prima = k > 0 ? ordine[k - 1] : -1;
    const sulPonte = (t: Polyline) => !!uscita && ponteVerso.get(prima) === i && Math.hypot(t[0].x - uscita.x, t[0].y - uscita.y) <= PONTE_SOPRA
      && (cordaDentro(uscita, t[0], forme[prima]) || cordaDentro(uscita, t[0], forme[i]));
    tratti.forEach((t, n) => {
      const continua = n === 0 && sulPonte(t);
      if (n === 0 && k > 0 && uscita && !continua) saltiFra.sopra.push(Math.hypot(t[0].x - uscita.x, t[0].y - uscita.y));
      else if (n > 0) saltiDentro++;
      stopSopra.attacca(t, !continua);
      vista.sopra.push(continua ? [uscita!, ...t] : t);
    });
    if (tratti.length) uscita = tratti[tratti.length - 1].at(-1);
  });

  stop.push({ tipo: 'raso', zona, livello: livello(stopRaso.tratti) }, { tipo: 'sopra', zona, livello: livello(stopSopra.tratti) });
  fineStop = stopSopra.tratti.length ? stopSopra.tratti[stopSopra.tratti.length - 1].at(-1) : uscita;
  });

  const tutti = (tipo: 'raso' | 'sopra') => livello(stop.filter((st) => st.tipo === tipo).flatMap((st) => st.livello.tratti));
  return {
    base: livello(baseCucita), stop, raso: tutti('raso'), sopra: tutti('sopra'), zone: ordini, vista, forme, ordine, ponti,
    saltiFra, saltiDentro, tolto, passaggiScoperti, buchi, tempoMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------------------------------
// IL PUNTO SOPRA CHE SI MUOVE COME LA BASE (Lorenzo, 2026-10-28). Il ridisegno non era il punto vero: *«il punto sopra
// non sta davvero replicando la base come dovrebbe»*; e poi *«non è necessaria la copia esatta… può lavorare andata e
// ritorno, ma deve lavorare sempre con l'idea che il punto deve assomigliare alla base più per movimento che nella
// precisione. Ovviamente niente 4 passaggi, solo andata e ritorno»*. Il punto sopra sono i pezzi della base dentro la
// macchia, nell'ordine della base (le colonne da sinistra a destra); dove la base va e torna più volte sullo stesso
// tratto (le barrette a 4 passaggi), una sola andata e ritorno. Da un pezzo al successivo il filo corre sulle linee
// della base dentro la macchia (*«dentro la macchia deve essere tutto nascosto a costo di passare due volte sullo
// stesso punto»*): la rete delle linee, spezzate dove si incrociano; un tratto alla prima o seconda passata costa la
// sua lunghezza, alla terza molto di più. Mai un salto dentro la macchia, se le linee si raggiungono.

/** La volta dritta fra due gruppi di linee che non si toccano: al più tanti mm, e costa tanto al millimetro. */
const VOLTA_SOPRA_MAX = 6;
const K_VOLTA_SOPRA = 40;
/** Una passata in più oltre la seconda su un tratto costa tanto al millimetro. */
const K_TERZA_PASSATA = 20;
/** Col ponte, il punto dalla fine della macchia prima all'inizio di questa: al più tanti mm. */
const PONTE_SOPRA = 2.5;
/** All'ingresso e all'uscita, dal nodo delle linee al bordo verso l'altra macchia: un punto di al più tanti mm. */
const AL_BORDO = 4;

/** Il punto della macchia più vicino a `p`, un quarto di millimetro dentro. */
function bordoVicino(macchia: Polyline, p: Point): Point {
  let best = macchia[0], bd = Infinity;
  for (let i = 0, k = macchia.length - 1; i < macchia.length; k = i++) {
    const a = macchia[k], b = macchia[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)), q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  if (pointInPolygon(p, macchia)) return p;
  const l = bd || 1, dentro = { x: best.x + ((best.x - p.x) / l) * 0.25, y: best.y + ((best.y - p.y) / l) * 0.25 };
  return pointInPolygon(dentro, macchia) ? dentro : best;
}
/** Un punto della strada sulle linee non più lungo di tanto, mm. */
const PASSO_STRADA = 3.5;

/** Dove la linea va e torna più volte sullo stesso tratto (a, b, a, b, …), una sola andata e ritorno. */
function unaAndataERitorno(l: Polyline): Polyline {
  const out = l.slice();
  const ug = (p: Point, q: Point) => Math.abs(p.x - q.x) < 1e-4 && Math.abs(p.y - q.y) < 1e-4;
  for (let i = 0; i + 3 < out.length;) {
    if (ug(out[i], out[i + 2]) && ug(out[i + 1], out[i + 3])) { out.splice(i + 1, 2); i = Math.max(0, i - 1); } else i++;
  }
  return out;
}

/**
 * I pezzi della base dentro la macchia, nell'ordine della base, con una sola andata e ritorno. `menoDi`: la macchia
 * dove entra il ponte (lì il punto sopra è di quella).
 */
function pezziDellaBase(base: Polyline[], macchia: Polyline, menoDi: Polyline | null = null): Polyline[] {
  const bb = ingombro(macchia), out: Polyline[] = [];
  for (const l of base) {
    let cur: Polyline | null = null;
    for (let k = 1; k < l.length; k++) {
      const a = l[k - 1], b = l[k];
      if (Math.max(a.x, b.x) < bb.x0 || Math.min(a.x, b.x) > bb.x1 || Math.max(a.y, b.y) < bb.y0 || Math.min(a.y, b.y) > bb.y1) { cur = null; continue; }
      const t0 = clipSegmentToPolygon(a, b, macchia);
      const t = menoDi ? t0.flatMap(([p, q]) => meno(p, q, menoDi)) : t0;
      for (const [p, q] of t) {
        const e = cur?.[cur.length - 1];
        if (cur && e && Math.hypot(e.x - p.x, e.y - p.y) < 1e-6) cur.push({ x: q.x, y: q.y });
        else { cur = [{ x: p.x, y: p.y }, { x: q.x, y: q.y }]; out.push(cur); }
      }
      if (!t.length || Math.hypot(t[t.length - 1][1].x - b.x, t[t.length - 1][1].y - b.y) > 1e-6) cur = null;
    }
  }
  // (una barretta che esce dalla macchia ci rientra nello stesso punto del bordo: i due pezzi sono uno)
  const uniti: Polyline[] = [];
  for (const l of out) {
    const u = uniti[uniti.length - 1];
    if (u && Math.hypot(u[u.length - 1].x - l[0].x, u[u.length - 1].y - l[0].y) < 1e-6) u.push(...l.slice(1));
    else uniti.push(l);
  }
  return uniti.map(unaAndataERitorno).filter((l) => l.length > 1);
}

/**
 * LA RETE DELLE LINEE della base dentro una macchia: ogni tratto una volta, spezzato dove ne incrocia un altro; per
 * ogni tratto quante volte è già cucito. `passa` conta una passata sui tratti di un segmento; `strada` cerca la via più
 * corta sulle linee, alla terza passata cara.
 */
class ReteDellaBase {
  readonly pos: Point[] = [];
  private readonly adj: number[][] = [];
  private readonly lati: Array<{ u: number; v: number; w: number; passi: number; k: number }> = [];
  private readonly nodi = new Map<string, number>();
  private readonly perSegmento = new Map<string, number[]>();

  constructor(pezzi: Polyline[], macchia?: Polyline) {
    type Seg = { a: Point; b: Point; chiave: string; tagli: Array<{ t: number; p: Point }> };
    const segs: Seg[] = [], visti = new Set<string>();
    for (const l of pezzi) for (let k = 1; k < l.length; k++) {
      const a = l[k - 1], b = l[k];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) continue;
      const ch = this.chiaveSeg(a, b);
      if (visti.has(ch)) continue;
      visti.add(ch);
      segs.push({ a, b, chiave: ch, tagli: [{ t: 0, p: a }, { t: 1, p: b }] });
    }
    const G = 2, celle = new Map<number, number[]>();
    const cella = (gx: number, gy: number) => gx * 100003 + gy;
    segs.forEach((s, i) => {
      for (let gx = Math.floor(Math.min(s.a.x, s.b.x) / G); gx <= Math.floor(Math.max(s.a.x, s.b.x) / G); gx++)
        for (let gy = Math.floor(Math.min(s.a.y, s.b.y) / G); gy <= Math.floor(Math.max(s.a.y, s.b.y) / G); gy++) {
          const c = celle.get(cella(gx, gy));
          if (c) c.push(i); else celle.set(cella(gx, gy), [i]);
        }
    });
    const fatte = new Set<number>();
    for (const c of celle.values()) for (let x = 0; x < c.length; x++) for (let y = x + 1; y < c.length; y++) {
      const i = c[x], j = c[y], kk = i * segs.length + j;
      if (fatte.has(kk)) continue;
      fatte.add(kk);
      const t = incrocio(segs[i].a, segs[i].b, segs[j].a, segs[j].b), u = incrocio(segs[j].a, segs[j].b, segs[i].a, segs[i].b);
      if (t === null || u === null) continue;
      const p = { x: segs[i].a.x + (segs[i].b.x - segs[i].a.x) * t, y: segs[i].a.y + (segs[i].b.y - segs[i].a.y) * t };
      segs[i].tagli.push({ t, p }); segs[j].tagli.push({ t: u, p });
    }
    for (const s of segs) {
      s.tagli.sort((x, y) => x.t - y.t);
      const ids: number[] = [];
      for (let k = 1; k < s.tagli.length; k++) {
        const u = this.nodo(s.tagli[k - 1].p), v = this.nodo(s.tagli[k].p);
        if (u === v) continue;
        ids.push(this.lati.length);
        this.adj[u].push(this.lati.length); this.adj[v].push(this.lati.length);
        this.lati.push({ u, v, w: Math.hypot(s.tagli[k].p.x - s.tagli[k - 1].p.x, s.tagli[k].p.y - s.tagli[k - 1].p.y), passi: 0, k: 1 });
      }
      this.perSegmento.set(s.chiave, ids);
    }
    // fra due gruppi di linee che non si toccano (dove la macchia si stringe), una volta corta dritta: fuori dal disegno,
    // costa `K_VOLTA_SOPRA` al millimetro, ma è meglio di un salto
    if (macchia) {
      const g = this.gruppi(), GV = VOLTA_SOPRA_MAX, griglia = new Map<number, number[]>();
      const cv = (x: number, y: number) => Math.floor(x / GV) * 100003 + Math.floor(y / GV);
      this.pos.forEach((p, n) => { const k = cv(p.x, p.y), c = griglia.get(k); if (c) c.push(n); else griglia.set(k, [n]); });
      const quanti = this.pos.length;
      for (let n = 0; n < quanti; n++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
        for (const m of griglia.get(cv(this.pos[n].x + dx * GV, this.pos[n].y + dy * GV)) ?? []) {
          if (m <= n || g[m] === g[n]) continue;
          const d = Math.hypot(this.pos[m].x - this.pos[n].x, this.pos[m].y - this.pos[n].y);
          if (d > VOLTA_SOPRA_MAX || !cordaDentro(this.pos[n], this.pos[m], macchia)) continue;
          this.adj[n].push(this.lati.length); this.adj[m].push(this.lati.length);
          this.lati.push({ u: n, v: m, w: d, passi: 0, k: K_VOLTA_SOPRA });
        }
    }
  }

  private chiave(p: Point) { return `${Math.round(p.x * 1e3)},${Math.round(p.y * 1e3)}`; }
  private chiaveSeg(a: Point, b: Point) { const x = this.chiave(a), y = this.chiave(b); return x < y ? `${x}|${y}` : `${y}|${x}`; }
  private nodo(p: Point) {
    const k = this.chiave(p);
    let n = this.nodi.get(k);
    if (n === undefined) { n = this.pos.length; this.nodi.set(k, n); this.pos.push(p); this.adj.push([]); }
    return n;
  }
  trova(p: Point) { return this.nodi.get(this.chiave(p)); }
  /** Il gruppo di linee collegate di ogni nodo. */
  gruppi(): number[] {
    const g = new Array<number>(this.pos.length).fill(-1);
    let c = 0;
    for (let s = 0; s < this.pos.length; s++) {
      if (g[s] >= 0) continue;
      const st = [s]; g[s] = c;
      while (st.length) { const u = st.pop()!; for (const e of this.adj[u]) { const L = this.lati[e], w = L.u === u ? L.v : L.u; if (g[w] < 0) { g[w] = c; st.push(w); } } }
      c++;
    }
    return g;
  }
  /** Il nodo più vicino a un punto. */
  vicino(p: Point) { let b = 0, bd = Infinity; this.pos.forEach((q, n) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; b = n; } }); return b; }
  /** Una passata su una linea (i suoi segmenti in fila). */
  passa(l: Polyline) { for (let k = 1; k < l.length; k++) for (const e of this.perSegmento.get(this.chiaveSeg(l[k - 1], l[k])) ?? []) this.lati[e].passi++; }

  private dist = new Float64Array(0);
  private prev = new Int32Array(0);
  private da = -1;
  /** I nodi di un pezzo (i suoi vertici e gli incroci lungo i suoi segmenti). */
  nodiDi(l: Polyline): Set<number> {
    const out = new Set<number>();
    for (let k = 1; k < l.length; k++) for (const e of this.perSegmento.get(this.chiaveSeg(l[k - 1], l[k])) ?? []) { out.add(this.lati[e].u); out.add(this.lati[e].v); }
    return out;
  }
  /** Il costo della strada più corta sulle linee da `cerca(a)` al nodo `b` (Infinity se non c'è). */
  costo(b: number): number { return this.dist[b]; }
  /** La strada più corta sulle linee da `a` a `b` (nodi): la terza passata su un tratto costa `K_TERZA_PASSATA`. */
  strada(a: number, b: number): Polyline | null { this.cerca(a, b); return this.prendi(b); }
  /** Le strade più corte da `a` (fino a `b`, se dato). */
  cerca(a: number, b = -1): void {
    const N = this.pos.length, dist = (this.dist = new Float64Array(N).fill(Infinity)), prev = (this.prev = new Int32Array(N).fill(-1));
    this.da = a;
    const coda: Array<[number, number]> = [[0, a]];
    const su = (i: number) => { while (i > 0) { const q = (i - 1) >> 1; if (coda[q][0] <= coda[i][0]) break; [coda[q], coda[i]] = [coda[i], coda[q]]; i = q; } };
    const giu = (i: number) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < coda.length && coda[l][0] < coda[m][0]) m = l; if (r < coda.length && coda[r][0] < coda[m][0]) m = r; if (m === i) return; [coda[m], coda[i]] = [coda[i], coda[m]]; i = m; } };
    dist[a] = 0;
    while (coda.length) {
      const [du, u] = coda[0]; const ultimo = coda.pop()!; if (coda.length) { coda[0] = ultimo; giu(0); }
      if (du > dist[u]) continue;
      if (u === b) break;
      for (const e of this.adj[u]) {
        const L = this.lati[e], v = L.u === u ? L.v : L.u;
        const nd = du + L.w * (L.k > 1 ? L.k : L.passi >= 2 ? K_TERZA_PASSATA : 1);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = e; coda.push([nd, v]); su(coda.length - 1); }
      }
    }
  }
  /** La strada fino a `b` dopo `cerca` (le sue passate contate), coi soli aghi che servono. */
  prendi(b: number): Polyline | null {
    const a = this.da, dist = this.dist, prev = this.prev;
    if (dist[b] === Infinity) return null;
    const via: Polyline = [this.pos[b]];
    for (let v = b; v !== a;) { const L = this.lati[prev[v]]; L.passi++; v = L.u === v ? L.v : L.u; via.push(this.pos[v]); }
    via.reverse();
    // gli aghi: solo dove la strada gira (e almeno uno ogni `PASSO_STRADA`), non a ogni incrocio
    const aghi: Polyline = [via[0]];
    for (let k = 1; k < via.length - 1; k++) {
      const u = aghi[aghi.length - 1], p = via[k], n = via[k + 1];
      let g = Math.abs(Math.atan2(n.y - p.y, n.x - p.x) - Math.atan2(p.y - u.y, p.x - u.x)); if (g > Math.PI) g = 2 * Math.PI - g;
      if (g > (10 * Math.PI) / 180 || Math.hypot(n.x - u.x, n.y - u.y) > PASSO_STRADA) aghi.push(p);
    }
    if (via.length > 1) aghi.push(via[via.length - 1]);
    return aghi;
  }
}

/**
 * Il punto sopra di una macchia: i pezzi della base in fila, collegati sulle linee. `da`: dove si è (si entra dal bordo
 * più vicino, con un punto fino al nodo più vicino il cui salto è buono, e di lì sulle linee all'inizio); `verso`: dove
 * sta la macchia dopo (alla fine, sulle linee fino al nodo più vicino e un punto fino al bordo). Restituisce i tratti:
 * fra l'uno e l'altro un salto.
 */
function sopraComeLaBase(base: Polyline[], macchia: Polyline, da: Point | undefined, verso: Point | null, minimo: number,
  pezzoMinimo: number, buonSalto: (a: Point, b: Point) => boolean = () => true, menoDi: Polyline | null = null): { tratti: Polyline[]; tolto: number } {
  const pezzi = pezziDellaBase(base, macchia, menoDi).map((l) => {
    // (i capi tagliati sul bordo: un ultimo punto più corto del minimo non si cuce)
    const q = l.slice();
    if (q.length > 2 && Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) < minimo) q.shift();
    if (q.length > 2 && Math.hypot(q[q.length - 1].x - q[q.length - 2].x, q[q.length - 1].y - q[q.length - 2].y) < minimo) q.pop();
    return q;
  }).filter((l) => l.length > 1);
  if (!pezzi.length) return { tratti: [], tolto: 0 };
  let rete = new ReteDellaBase(pezzi);
  // I PEZZI STACCATI: le barrette che entrano dal bordo mentre la loro colonna corre fuori dalla macchia non toccano
  // nessun'altra linea, e lì non c'è strada sulle linee. Un gruppo di linee collegate col filo (andata e ritorno) sotto
  // `pezzoMinimo` non si cuce; il gruppo più grande sempre.
  let tolto = 0;
  {
    const g = rete.gruppi(), filo = new Map<number, number>();
    for (const l of pezzi) { const c = g[rete.trova(l[0])!]; filo.set(c, (filo.get(c) ?? 0) + lunghezza(l)); }
    const grande = [...filo.entries()].reduce((m, e) => (e[1] > m[1] ? e : m))[0];
    const tieni = pezzi.filter((l) => { const c = g[rete.trova(l[0])!]; if (c === grande || filo.get(c)! >= pezzoMinimo) return true; tolto += lunghezza(l); return false; });
    if (tieni.length < pezzi.length) pezzi.splice(0, pezzi.length, ...tieni);
    rete = new ReteDellaBase(pezzi, macchia);
  }
  const tratti: Polyline[] = [];
  let qui: number | null = null;
  if (da) {
    const vicini = rete.pos.map((q, n) => [Math.hypot(q.x - da.x, q.y - da.y), n] as [number, number]).sort((a, b) => a[0] - b[0]).slice(0, 80);
    qui = (vicini.find(([, n]) => buonSalto(da, rete.pos[n])) ?? vicini[0])[1];
  }
  // L'ORDINE: quello della base, ma la base fa la colonna intera del pannello, e in una macchia a C passa dal lobo di
  // sopra a quello di sotto a ogni colonna. Allora il pezzo dopo è quello che costa meno raggiungere sulle linee, più
  // tre millimetri per ogni pezzo che scavalca nell'ordine della base; e mai prima di un pezzo che viene prima nella
  // base e che tocca (le barrette scavalcano la colonna a sinistra: si lavora sempre da sinistra a destra).
  const nodi = pezzi.map((l) => rete.nodiDi(l));
  const prima = pezzi.map((_, j) => pezzi.map((_, i) => i).filter((i) => i < j && [...nodi[i]].some((n) => nodi[j].has(n))));
  const fatti = new Array<boolean>(pezzi.length).fill(false);
  // (si entra dal punto del bordo più vicino a dove si è, poi un punto fino al nodo: il salto è lungo quanto la distanza
  // fra le due macchie)
  const dalBordo = da && qui !== null ? bordoVicino(macchia, da) : null;
  const primoPunto = dalBordo && qui !== null && Math.hypot(dalBordo.x - rete.pos[qui].x, dalBordo.y - rete.pos[qui].y) > 0.3
    && Math.hypot(dalBordo.x - rete.pos[qui].x, dalBordo.y - rete.pos[qui].y) <= AL_BORDO && cordaDentro(dalBordo, rete.pos[qui], macchia)
    && buonSalto(da!, dalBordo) ? dalBordo : null;
  let ingresso = true;
  for (let fatto = 0; fatto < pezzi.length; fatto++) {
    const restano = pezzi.map((_, i) => i).filter((i) => !fatti[i]);
    const pronti = restano.filter((i) => prima[i].every((q) => fatti[q]));
    if (qui !== null) rete.cerca(qui);
    let scelto = pronti[0], migliore = Infinity;
    for (const i of pronti) {
      const n = rete.trova(pezzi[i][0]);
      const c = (qui === null || n === undefined ? Infinity : rete.costo(n)) + 3 * restano.indexOf(i);
      if (c < migliore) { migliore = c; scelto = i; }
    }
    const l = pezzi[scelto], inizio = rete.trova(l[0]);
    const via = qui !== null && inizio !== undefined && migliore < Infinity ? (qui === inizio ? [rete.pos[qui]] : rete.prendi(inizio)) : null;
    if (via && !(ingresso && !da)) {
      if (ingresso) tratti.push([...(primoPunto ? [primoPunto] : []), ...via, ...l.slice(1)]);
      else tratti[tratti.length - 1].push(...via.slice(1), ...l.slice(1));
    } else tratti.push(l.slice());
    ingresso = false;
    fatti[scelto] = true;
    rete.passa(l);
    qui = rete.trova(l[l.length - 1]) ?? null;
  }
  // L'USCITA (Lorenzo, 2026-10-28: «un passaggio che porta fino al limite della macchia verso la macchia successiva, che
  // può passare al bordo o ripassare sopra, va bene; ridurre la lunghezza dei salti è importante»): sulle linee fino al
  // nodo più vicino alla macchia dopo, e di lì un punto fino al bordo, dove la macchia dopo è più vicina
  if (verso && qui !== null) {
    const via = rete.strada(qui, rete.vicino(verso));
    if (via) {
      const ult = tratti[tratti.length - 1];
      ult.push(...via.slice(1));
      const fine = ult[ult.length - 1], d = Math.hypot(verso.x - fine.x, verso.y - fine.y);
      if (d > 0.3 && d <= AL_BORDO && cordaDentro(fine, verso, macchia)) ult.push(verso);
    }
  }
  // nessun punto più corto del minimo: si toglie l'ago, se il filo si sposta al più di mezzo minimo e resta dentro (gli
  // incroci fra barrette e zig-zag, i tagli sul bordo)
  return { tratti: tratti.map((t) => senzaPuntiCorti(t, minimo, macchia)), tolto };
}

/** Gli aghi che fanno un punto più corto del minimo, via: dove il filo si sposta al più di mezzo minimo e resta dentro. */
function senzaPuntiCorti(t: Polyline, minimo: number, macchia: Polyline): Polyline {
  const out: Polyline = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const u = out[out.length - 1], q = t[i];
    if (Math.hypot(q.x - u.x, q.y - u.y) < 1e-6) continue;
    if (i < t.length - 1) {
      const n = t[i + 1];
      const corto = Math.hypot(q.x - u.x, q.y - u.y) < minimo || Math.hypot(n.x - q.x, n.y - q.y) < minimo;
      if (corto && distanzaSegmento(q, u, n) <= Math.max(0.3, minimo / 2) && cordaDentro(u, n, macchia)) continue;
    }
    out.push(q);
  }
  return out;
}

/**
 * Se un segmento tocca il contorno: i lati del contorno su una griglia di un millimetro, così si guardano solo quelli
 * vicini (ritagliare ogni segmento sulla macchia intera era metà del calcolo).
 */
function toccaIlBordo(poly: Polyline): (a: Point, b: Point, netto?: boolean) => boolean {
  const gia = bordiTenuti.get(poly);
  if (gia) return gia;
  const G = 1, lati = new Map<number, number[]>();
  const cella = (gx: number, gy: number) => gx * 100003 + gy;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k], b = poly[i];
    for (let gx = Math.floor(Math.min(a.x, b.x) / G); gx <= Math.floor(Math.max(a.x, b.x) / G); gx++)
      for (let gy = Math.floor(Math.min(a.y, b.y) / G); gy <= Math.floor(Math.max(a.y, b.y) / G); gy++) {
        const c = lati.get(cella(gx, gy));
        if (c) c.push(k); else lati.set(cella(gx, gy), [k]);
      }
  }
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const f = (a: Point, b: Point, netto = false) => {
    for (let gx = Math.floor(Math.min(a.x, b.x) / G); gx <= Math.floor(Math.max(a.x, b.x) / G); gx++)
      for (let gy = Math.floor(Math.min(a.y, b.y) / G); gy <= Math.floor(Math.max(a.y, b.y) / G); gy++)
        for (const k of lati.get(cella(gx, gy)) ?? []) {
          const c = poly[k], d = poly[(k + 1) % poly.length];
          if (netto ? o(a, b, c) * o(a, b, d) < -1e-12 && o(c, d, a) * o(c, d, b) < -1e-12 : o(a, b, c) * o(a, b, d) <= 0 && o(c, d, a) * o(c, d, b) <= 0) return true;
        }
    return false;
  };
  bordiTenuti.set(poly, f);
  return f;
}
const bordiTenuti = new WeakMap<Polyline, (a: Point, b: Point, netto?: boolean) => boolean>();

/**
 * Se la corda a-b sta dentro la macchia, esatto: non attraversa il contorno e il suo mezzo è dentro (i capi possono
 * stare sul bordo). Campionarla non basta: certe macchie hanno sul bordo crepe strette due decimi e profonde un
 * millimetro.
 */
function cordaDentro(a: Point, b: Point, macchia: Polyline): boolean {
  if (toccaIlBordo(macchia)(a, b, true)) return false;
  // (e il mezzo e i quarti dentro: fra due capi sul bordo la corda può uscire senza attraversarlo)
  for (const t of [0.25, 0.5, 0.75]) {
    const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!pointInPolygon(m, macchia) && distanceToBoundary(m, macchia) >= 0.02) return false;
  }
  return true;
}

/** Dove il segmento a-b incrocia c-d (fra i capi, esclusi): il parametro su a-b, o null. */
function incrocio(a: Point, b: Point, c: Point, d: Point): number | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? t : null;
}

// ---------------------------------------------------------------------------------------------------
// Il contratto del motore (K1b): avvolge `costruisciMacchie`, senza cambiare niente.
import { refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import type { ExportLayer as StratoEsportato } from '@rg/core';

/** Oltre ai parametri: la sagoma del pannello, le macchie (i poligoni scelti dai ruoli dei colori) e il pattern della base. */
export interface IngressoMacchie extends Ingresso {
  pannello: Polyline;
  macchie: Polyline[];
  pattern: PatternConfig;
}

/** I tre stop come li esporta il tool: base, raso delle macchie, punto sopra (stessi id e colori di tool.ts). */
const STOP_MACCHIE = [
  { chiave: 'base', colore: '#8a6d4e' },
  { chiave: 'raso', colore: '#1f1a17' },
  { chiave: 'sopra', colore: '#c8952e' },
] as const;

export const motore: Motore<IngressoMacchie, ParametriMacchie> = {
  id: 'pattern-macchie',
  async genera(ingresso, params) {
    const r = costruisciMacchie(ingresso.pannello, ingresso.macchie, ingresso.pattern, params);
    const strati: StratoEsportato[] = STOP_MACCHIE.map((l) => ({ id: l.chiave, color: l.colore, polylines: r[l.chiave].tratti }));
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

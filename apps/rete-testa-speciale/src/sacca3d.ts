// LA SACCA APPESA (Lorenzo, 2026-10-16: «simulare una certa morbidezza del filo nel 3d… come se fosse un po' appesa»).
// Sotto-programma della sacca a rete, senza DOM: la rete diventa nodi legati da fili. Un filo NON si allunga ma si
// allenta (vincolo «al più L»), la gravità tira giù, e il calcolo lascia assestare tutto (Verlet + vincoli ripetuti).
// La morbidezza è quanto il filo resiste a piegarsi su un nodo: a 1 cede del tutto, sotto tiene un po' la forma piatta.
//
// Il fondo è quello del ricamo: i giri della spirale al loro passo e le legature con la loro profondità, con la sua rigidità: «se la base di filo a
// spirale è ben progettata diventa un appoggio perché il filo si unisce tra le varie linee di spirale» — giri
// affiancati = rigido. La testa NON si ricama («lascia stare la parte sopra, lasciamola libera»): la bocca si chiude al
// montaggio con un CORDONE che passa a zig-zag nei buchi dell'ultima fila di rombi e si stringe a strozzo.
//
// Si tiene per la bocca (l'ultimo anello fermo su un cerchio), per due punti del bordo, per il nodo del cordone, o la
// si appoggia sul fondo.
import {
  altezze, ceIlNodo, fondoDellaLegatura, lenteAlNodo, profiloPiuProfondo, puntoDelNodo, raggioDelFondo, raggioMinimo, versoIlCentro,
  type Anelli, type RegolaSovrapposizione,
} from './sacca';

export type ModoAppesa = 'bocca' | 'manici' | 'cordone' | 'appoggiata';

export interface OpzioniAppesa {
  /** Rombi per giro. */
  N: number;
  /** Lato del rombo, mm. */
  L: number;
  modo: ModoAppesa;
  /** Diametro della bocca quando è tenuta per la bocca, mm (non oltre il disco). */
  boccaMm: number;
  /** Distanza fra i due punti quando è tenuta per due punti del bordo, mm. */
  maniciMm: number;
  /** 0 = il filo tiene la forma piatta, 1 = cede del tutto. */
  morbidezza: number;
  /** Il giro d'impuntura in cima lega le punte esterne fra loro. */
  giroInCima: boolean;
  /** Spessore del filo, mm: due nodi vicini dello stesso anello non stanno più vicini di due spessori. */
  filo: number;
  /** Rigidità del fondo, 0..1: 0 = una ragnatela molle, 1 = una base che non si piega. */
  fondoRigido: number;
  /** Il cordone montato nei buchi dell'ultima fila. */
  cordone: boolean;
  /** Quanto è stretto il cordone, 0..1: 0 = lungo quanto il giro del disco piatto, 1 = bocca chiusa. */
  stretta: number;
  /** Il passo della spirale del fondo, mm (quello del ricamo; di partenza 5). */
  passoSpirale?: number;
  /** La distanza fra le legature del fondo, mm (quella del ricamo; di partenza 10). */
  legature?: number;
  /** La sovrapposizione del ricamo, mm, e la sua regola: dicono quanto è lunga la lente su ogni nodo. */
  sovrapposizione?: number;
  regola?: RegolaSovrapposizione;
  /** Fondo ovale: l'ultimo anello di ogni colonna (`cimeDelleColonne`), se le colonne dei lati si fermano prima. */
  cime?: number[];
}

export interface Nodo { x: number; y: number; z: number; px: number; py: number; pz: number; fermo: boolean }
/** Un filo fra due nodi: lungo al più `L` (si allenta, non si allunga). `tipo` dice a cosa serve, per il disegno. */
export interface Filo { a: number; b: number; L: number; tipo: 'rete' | 'fondo' | 'cima' | 'cordone' | 'capi' }
/**
 * Una «piega»: i due vicini di un nodo sulla stessa linea, alla distanza del disco piatto (molla debole, nei due versi).
 * `k` = quanto è rigido quel nodo rispetto alla media: la lente più lunga (più filo sopra filo) lo fa girare con più
 * fatica (Lorenzo, 2026-10-16: «sotto saranno molto più bloccati che sopra»).
 */
interface Piega { a: number; b: number; L: number; k: number }
/** Due nodi vicini dello stesso anello: non più vicini di così (lo spessore dei fili che ci passano). */
interface Distanza { a: number; b: number; minimo: number }
/**
 * Una forma che tiene: un gruppo di nodi tirati, a ogni ripetizione, verso la loro forma di riposo spostata e girata
 * nel modo più vicino a dove sono (la tecnica dei corpi rigidi nelle simulazioni di stoffa). `alfa` = quanto, per
 * ripetizione (1 = rigido).
 */
interface Forma { indici: number[]; riposo: Array<[number, number]>; alfa: number }

export interface SaccaAppesa {
  nodi: Nodo[];
  fili: Filo[];
  pieghe: Piega[];
  distanze: Distanza[];
  forme: Forma[];
  /** L'indice dell'ultimo anello della rete (la bocca). */
  n: number;
  /** I nodi del fondo (l'anello 0 della rete, i giri della spirale e il centro). */
  fondo: number[];
  /** L'ultima fila: il nodo più alto di ogni colonna (con tutti gli anelli, l'ultimo anello). */
  bordo: number[];
  /** I nodi della rete che non ci sono (sopra la cima della loro colonna): fermi, senza fili, non si disegnano. */
  assenti: Uint8Array;
  /**
   * Per ogni nodo libero, il punto di presa più vicino lungo i fili e quanto è lontano: più in là non può andare (un filo
   * non si allunga). Tiene ferma la catena quando tutto pende da pochi punti (il nodo del cordone, due punti del bordo):
   * coi soli fili gli errori si sommano lungo la catena (misurato: fili «allungati» fino all'86%).
   */
  ancore: Array<{ i: number; p: number; d: number }>;
  /**
   * Il cordone: i nodi dove passa (gli apici dell'ultimo anello), il punto dove esce dal giro e la mano
   * che tiene i due capi; null senza cordone.
   */
  cordone: { anelli: number[]; uscita: number; mano: number; pieno: number; chiuso: number } | null;
  /** I fili del cordone (e dei capi) e del fondo, per correggerli più spesso. */
  corde: Filo[];
  /** I soli fili del cordone e dei capi (reggono tutto con pochi tratti: si correggono ancora più spesso). */
  cordeCordone: Filo[];
  opz: OpzioniAppesa;
  /** Quanto si è mosso, in media, l'ultimo passo (mm): sotto qualche millesimo la sacca è ferma. */
  movimento: number;
  passi: number;
}

/** La rigidità del fondo che viene dal suo passo: giri affiancati (passo = spessore del filo) = rigido. */
export function rigiditaDalPasso(passoMm: number, filoMm: number): number {
  return Math.max(0, Math.min(1, filoMm / Math.max(0.01, passoMm)));
}

/** Il nodo dell'anello j, colonna k: gli anelli dispari sono sfalsati di mezzo passo. */
const indice = (N: number, j: number, k: number) => j * N + (((k % N) + N) % N);
const angolo = (N: number, j: number, k: number) => 2 * Math.PI * k / N + (j % 2 ? Math.PI / N : 0);

export function creaSaccaAppesa(A: Anelli, opz: OpzioniAppesa): SaccaAppesa {
  const N = Math.max(3, Math.round(opz.N)), n = A.rho.length - 1, r0 = raggioDelFondo(A);
  const nodi: Nodo[] = [], fili: Filo[] = [], pieghe: Piega[] = [], distanze: Distanza[] = [], forme: Forma[] = [];
  const nodo = (x: number, y: number, z: number): number => { nodi.push({ x, y, z, px: x, py: y, pz: z, fermo: false }); return nodi.length - 1; };
  const lunghezza = (a: number, b: number) => { const p = nodi[a], q = nodi[b]; return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z); };
  const filo = (a: number, b: number, tipo: Filo['tipo'], L = lunghezza(a, b)) => fili.push({ a, b, L, tipo });
  // la rete, piatta come esce dalla macchina
  for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) { const q = puntoDelNodo(A, N, j, k); nodo(q.x, q.y, 0); }
  // (le colonne che si fermano prima: solo i nodi che ci sono)
  const ce = (j: number, k: number) => ceIlNodo(opz.cime, N, j, k);
  for (let j = 0; j < n; j++) for (let k = 0; k < N; k++) for (const kk of j % 2 ? [k, k + 1] : [k, k - 1]) if (ce(j, k) && ce(j + 1, kk)) filo(indice(N, j, k), indice(N, j + 1, kk), 'rete');
  const bordo = Array.from({ length: N }, (_, k) => { let j = n; while (j > 0 && !ce(j, k)) j--; return indice(N, j, k); });
  // le pieghe: sulle due linee di ogni colonna, il nodo prima e il nodo dopo; rigide quanto è lunga la lente sul nodo
  // (sull'ovale ogni nodo ha la sua lente)
  const lente = (j: number, k: number) => (j >= 1 && j < n ? lenteAlNodo(A, N, j, opz.sovrapposizione ?? 0, opz.regola ?? 'spostamento', opz.L, k) : 0);
  const lenti = Array.from({ length: n + 1 }, (_, j) => Array.from({ length: A.punti ? N : 1 }, (_, k) => lente(j, k)));
  const interne = lenti.slice(1, n).flat(), media = interne.reduce((a, b) => a + b, 0) / Math.max(1, interne.length);
  const peso = (j: number, k: number) => (media > 0 ? lenti[j][A.punti ? ((k % N) + N) % N : 0] / media : 1);
  for (let k = 0; k < N; k++) for (const lato of [0, 1]) {
    const col = (j: number) => (j % 2 ? (lato ? k : k - 1) : k);
    const linea = Array.from({ length: n + 1 }, (_, j) => indice(N, j, col(j)));
    for (let j = 1; j < n; j++) if (ce(j + 1, col(j + 1))) pieghe.push({ a: linea[j - 1], b: linea[j + 1], L: lunghezza(linea[j - 1], linea[j + 1]), k: peso(j, col(j)) });
  }
  // i nodi di un anello non si toccano
  for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) if (ce(j, k) && ce(j, k + 1)) distanze.push({ a: indice(N, j, k), b: indice(N, j, k + 1), minimo: 2 * Math.max(0.1, opz.filo) });
  // il giro in cima, se c'è
  if (opz.giroInCima) for (let k = 0; k < N; k++) filo(bordo[k], bordo[(k + 1) % N], 'cima');
  // il fondo, quello del ricamo (Lorenzo, 2026-10-16: «il fondo nel simulatore non prende quello parametrizzato»; prima
  // era una ragnatela fissa di 4 giri e 8 raggi): i giri della spirale al loro passo (al più 12 anelli nel modello: se
  // i giri veri sono di più, ogni anello ne rappresenta alcuni), uniti fra loro solo dal filo che passa da un giro al
  // successivo e dalle LEGATURE, ognuna fino alla sua profondità (la stessa regola del ricamo)
  const passo = Math.max(0.3, opz.passoSpirale ?? 5), spaziatura = Math.max(passo, opz.legature ?? 10);
  const M = Math.max(2, Math.min(12, Math.floor(r0 / passo)));
  const raggi = Array.from({ length: M - 1 }, (_, i) => r0 * (1 - (i + 1) / M));
  const profonda = Array.from({ length: N }, (_, k) => fondoDellaLegatura(k, N, spaziatura, r0, Math.min(passo, r0 / 2)));
  const giri: number[][] = [Array.from({ length: N }, (_, k) => indice(N, 0, k))];
  for (const r of raggi) {
    // (col fondo ovale i giri sono gli ovali del fondo, come nel ricamo)
    const giro = Array.from({ length: N }, (_, k) => { const q = versoIlCentro(A, N, k, r / r0); return nodo(q.x, q.y, 0); });
    const prima = giri[giri.length - 1];
    for (let k = 0; k < N; k++) filo(giro[k], giro[(k + 1) % N], 'fondo');
    filo(prima[0], giro[0], 'fondo'); // la spirale passa da un giro al successivo
    for (let k = 0; k < N; k++) if (r >= profonda[k] - 1e-6 && k !== 0) filo(prima[k], giro[k], 'fondo'); // la legatura k arriva fin qui
    giri.push(giro);
  }
  for (let k = 0; k < N; k++) filo(indice(N, 0, k), indice(N, 0, k + 1), 'fondo');
  const centro = nodo(0, 0, 0), interno = giri[giri.length - 1];
  filo(interno[0], centro, 'fondo');
  for (let k = 1; k < N; k++) if (profonda[k] <= raggi[raggi.length - 1] / 2) filo(interno[k], centro, 'fondo');
  // il disco del fondo si sposta e si inclina ma non si piega. La rigidità cresce ripida: una forma debole, ripetuta per
  // centinaia di passi, vince comunque sulla gravità (tarata: al 20% il fondo scende ancora di 41 mm, dal 60% è piatto)
  const rig = Math.max(0, Math.min(1, opz.fondoRigido)), fondo = [...giri.flat(), centro];
  if (rig > 0) {
    let cx = 0, cy = 0; for (const i of fondo) { cx += nodi[i].x; cy += nodi[i].y; } cx /= fondo.length; cy /= fondo.length;
    forme.push({ indici: fondo, riposo: fondo.map((i) => [nodi[i].x - cx, nodi[i].y - cy]), alfa: 1e-5 * Math.pow(5e4, rig) });
  }
  // il cordone: passa a zig-zag nei buchi dell'ultima fila di rombi e, tirato, punta sugli APICI dell'ultimo anello
  // (Lorenzo, 2026-10-16: «il cordone non tocca gli apici dell'ultimo rombo, si blocca prima»: prima passava per i
  // nodi dei lati, l'anello n − 1). Scorre nei buchi, quindi si tira uguale ovunque: fili uguali fra un nodo e l'altro.
  // Il giro si chiude dove il cordone esce, e da lì i due capi salgono alla mano (CAPI mm). Il primo tentativo faceva
  // passare la presa dentro il giro: tenuta per lì la bocca pendeva come un cappio invece di chiudersi a collo.
  const CAPI = 120;
  let cordone: SaccaAppesa['cordone'] = null;
  if (opz.cordone && n >= 2) {
    const anelli = bordo.slice();
    const a0 = nodi[anelli[0]], aN = nodi[anelli[N - 1]];
    const uscita = nodo((a0.x + aN.x) / 2, (a0.y + aN.y) / 2, 0), ru = Math.hypot(nodi[uscita].x, nodi[uscita].y) || 1;
    const mano = nodo(nodi[uscita].x * (1 + CAPI / ru), nodi[uscita].y * (1 + CAPI / ru), 0);
    // il giro dell'ultimo anello piatto (sull'ovale i tratti non sono uguali: conta il giro)
    let giroPiatto = 0; for (let k = 0; k < N; k++) giroPiatto += lunghezza(anelli[k], anelli[(k + 1) % N]);
    cordone = { anelli, uscita, mano, pieno: giroPiatto * (N + 1) / N, chiuso: (N + 1) * 2 * Math.max(0.1, opz.filo) };
    for (let k = 0; k + 1 < N; k++) filo(anelli[k], anelli[k + 1], 'cordone', 0);
    filo(anelli[N - 1], uscita, 'cordone', 0); filo(uscita, anelli[0], 'cordone', 0);
    filo(uscita, mano, 'capi', CAPI);
  }

  const assenti = new Uint8Array(nodi.length);
  for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) if (!ce(j, k)) assenti[indice(N, j, k)] = 1;
  const s: SaccaAppesa = { nodi, fili, pieghe, distanze, forme, n, fondo, bordo, assenti, ancore: [], cordone, corde: fili.filter((f) => f.tipo === 'cordone' || f.tipo === 'capi' || f.tipo === 'fondo'), cordeCordone: fili.filter((f) => f.tipo === 'cordone' || f.tipo === 'capi'), opz: { ...opz, N }, movimento: Infinity, passi: 0 };
  stringi(s, opz.stretta);
  appendi(s, A);
  return s;
}

/** Quanto è stretto il cordone (0 = largo quanto il disco, 1 = chiuso): si cambia senza rifare la rete. */
export function stringi(s: SaccaAppesa, stretta: number): void {
  if (!s.cordone) return;
  s.opz.stretta = Math.max(0, Math.min(1, stretta));
  const seg = (s.cordone.pieno - s.opz.stretta * (s.cordone.pieno - s.cordone.chiuso)) / (s.opz.N + 1);
  for (const f of s.fili) if (f.tipo === 'cordone') f.L = seg;
  calcolaAncore(s);
  s.movimento = Infinity;
}

/** La distanza lungo i fili da ogni nodo al punto di presa più vicino (Dijkstra da tutti i nodi fermi). */
function calcolaAncore(s: SaccaAppesa): void {
  const V = s.nodi.length, d = new Float64Array(V).fill(Infinity), da = new Int32Array(V).fill(-1), fatto = new Uint8Array(V);
  const vicini: Array<Array<[number, number]>> = Array.from({ length: V }, () => []);
  for (const f of s.fili) { vicini[f.a].push([f.b, f.L]); vicini[f.b].push([f.a, f.L]); }
  s.nodi.forEach((q, i) => { if (q.fermo && !s.assenti[i]) { d[i] = 0; da[i] = i; } });
  for (;;) {
    let u = -1; for (let i = 0; i < V; i++) if (!fatto[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    fatto[u] = 1;
    for (const [v, w] of vicini[u]) if (d[u] + w < d[v]) { d[v] = d[u] + w; da[v] = da[u]; }
  }
  s.ancore = [];
  s.nodi.forEach((q, i) => { if (!q.fermo && da[i] >= 0) s.ancore.push({ i, p: da[i], d: d[i] }); });
}

/** Dove si tiene la sacca: i nodi fermi, nella posizione scelta. Si può richiamare per cambiare presa. */
export function appendi(s: SaccaAppesa, A: Anelli): void {
  const { N } = s.opz, n = s.n, rOut = A.rho[n];
  s.nodi.forEach((q, i) => { q.fermo = !!s.assenti[i]; });
  if (s.opz.modo === 'appoggiata') {
    // in piedi sul fondo, nella forma del secchiello dritto: poi la gravità dice quanto regge
    const R = profiloPiuProfondo(A, s.opz.L, A.rho[0], raggioMinimo(N, s.opz.filo)), z = altezze(R, A, s.opz.L);
    for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) {
      // (sull'ovale ogni anello si stringe in proporzione, dalla sua forma piatta)
      if (s.assenti[indice(N, j, k)]) continue;
      const q = s.nodi[indice(N, j, k)], p = puntoDelNodo(A, N, j, k), c = R[j] / A.rho[j];
      q.x = q.px = p.x * c; q.y = q.py = p.y * c; q.z = q.pz = z[j];
    }
    for (let i = (n + 1) * N; i < s.nodi.length; i++) { const q = s.nodi[i]; q.z = q.pz = 0; q.px = q.x; q.py = q.y; }
    if (s.cordone) for (const c of [s.nodi[s.cordone.uscita], s.nodi[s.cordone.mano]]) { const a = s.nodi[s.cordone.anelli[0]]; c.x = c.px = a.x; c.y = c.py = a.y; c.z = c.pz = a.z; }
  } else if (s.opz.modo === 'bocca') {
    const r = Math.min(rOut, Math.max(1, s.opz.boccaMm / 2));
    for (let k = 0; k < N; k++) {
      const q = s.nodi[s.bordo[k]], f = angolo(N, n, k);
      q.x = q.px = r * Math.cos(f); q.y = q.py = r * Math.sin(f); q.z = q.pz = 0; q.fermo = true;
    }
  } else if (s.opz.modo === 'cordone' && s.cordone) {
    s.nodi[s.cordone.mano].fermo = true; // tenuta per i capi del cordone, dove sono
  } else {
    const d = Math.min(2 * rOut, Math.max(1, s.opz.maniciMm)) / 2;
    for (const [k, x] of [[0, d], [Math.round(N / 2), -d]] as const) {
      const q = s.nodi[s.bordo[k]];
      q.x = q.px = x; q.y = q.py = 0; q.z = q.pz = 0; q.fermo = true;
    }
  }
  calcolaAncore(s);
  s.movimento = Infinity;
}

/**
 * Avanza la simulazione di `quanti` passi. La gravità è in «mm per passo²»: conta solo la forma finale, non il tempo.
 * Ogni passo: inerzia smorzata + gravità, poi i vincoli ripetuti (i fili non si allungano, le pieghe resistono, il
 * fondo tiene la sua forma, il piano regge la sacca appoggiata).
 */
export function avanza(s: SaccaAppesa, quanti = 1, ripetizioni = 24): void {
  const appoggiata = s.opz.modo === 'appoggiata';
  const g = 0.05, smorza = 0.94, rigidita = (1 - Math.max(0, Math.min(1, s.opz.morbidezza))) * 0.004;
  const sposta = (a: Nodo, b: Nodo, dx: number, dy: number, dz: number, c: number) => {
    const wa = a.fermo ? 0 : 1, wb = b.fermo ? 0 : 1, w = wa + wb; if (!w) return;
    a.x += dx * c * wa / w; a.y += dy * c * wa / w; a.z += dz * c * wa / w;
    b.x -= dx * c * wb / w; b.y -= dy * c * wb / w; b.z -= dz * c * wb / w;
  };
  for (let it = 0; it < quanti; it++) {
    let mosso = 0;
    for (const q of s.nodi) {
      if (q.fermo) continue;
      const vx = (q.x - q.px) * smorza, vy = (q.y - q.py) * smorza, vz = (q.z - q.pz) * smorza;
      q.px = q.x; q.py = q.y; q.pz = q.z;
      q.x += vx; q.y += vy; q.z += vz - g;
    }
    for (let r = 0; r < ripetizioni; r++) {
      // prima la forma del fondo, poi i fili: così l'ultima parola è dei fili, che non si allungano
      for (const f of s.forme) tieniLaForma(s.nodi, f);
      for (const f of s.fili) {
        const a = s.nodi[f.a], b = s.nodi[f.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d > f.L) sposta(a, b, dx, dy, dz, (d - f.L) / d); // il filo allentato non tira
      }
      // il cordone regge tutto il peso con pochi tratti in fila, e i giri del fondo pendono da poche legature: si
      // correggono più volte (costano poco). Senza, il cordone risultava «allungato» fino al 9% e i giri fino al 17%
      for (let c = 0; c < 8; c++) for (const f of c < 3 ? s.corde : s.cordeCordone) {
        const a = s.nodi[f.a], b = s.nodi[f.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d > f.L) sposta(a, b, dx, dy, dz, (d - f.L) / d);
      }
      if (rigidita > 0) for (const p of s.pieghe) {
        const a = s.nodi[p.a], b = s.nodi[p.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d > 0) sposta(a, b, dx, dy, dz, (d - p.L) / d * Math.min(0.5, rigidita * p.k)); // lo zig-zag non si raddrizza né si chiude del tutto
      }
      for (const a of s.ancore) {
        const q = s.nodi[a.i], p = s.nodi[a.p];
        const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d = Math.hypot(dx, dy, dz);
        if (d > a.d) { const c = a.d / d; q.x = p.x + dx * c; q.y = p.y + dy * c; q.z = p.z + dz * c; }
      }
      if (appoggiata) for (const q of s.nodi) if (q.z < 0) { q.z = 0; q.px = q.x; q.py = q.y; } // il piano: non si scende, non si scivola
      for (const m of s.distanze) {
        const a = s.nodi[m.a], b = s.nodi[m.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d < m.minimo && d > 0) sposta(a, b, dx, dy, dz, (d - m.minimo) / d);
      }
    }
    for (const q of s.nodi) if (!q.fermo) mosso += Math.hypot(q.x - q.px, q.y - q.py, q.z - q.pz);
    s.movimento = mosso / s.nodi.length;
    s.passi++;
  }
}

/**
 * La forma più vicina: il piano di riposo (u, v) girato nello spazio. Dai nodi si ricavano i due assi (le prime due
 * colonne della covarianza, ortonormalizzate); poi ogni nodo libero va di `alfa` verso il suo posto.
 */
function tieniLaForma(nodi: Nodo[], f: Forma): void {
  const m = f.indici.length;
  let cx = 0, cy = 0, cz = 0; for (const i of f.indici) { cx += nodi[i].x; cy += nodi[i].y; cz += nodi[i].z; } cx /= m; cy /= m; cz /= m;
  let a1x = 0, a1y = 0, a1z = 0, a2x = 0, a2y = 0, a2z = 0;
  f.indici.forEach((i, k) => {
    const [u, v] = f.riposo[k], dx = nodi[i].x - cx, dy = nodi[i].y - cy, dz = nodi[i].z - cz;
    a1x += dx * u; a1y += dy * u; a1z += dz * u; a2x += dx * v; a2y += dy * v; a2z += dz * v;
  });
  const l1 = Math.hypot(a1x, a1y, a1z); if (l1 < 1e-9) return;
  const e1 = [a1x / l1, a1y / l1, a1z / l1];
  const pr = a2x * e1[0] + a2y * e1[1] + a2z * e1[2];
  const w2 = [a2x - pr * e1[0], a2y - pr * e1[1], a2z - pr * e1[2]], l2 = Math.hypot(w2[0], w2[1], w2[2]); if (l2 < 1e-9) return;
  const e2 = [w2[0] / l2, w2[1] / l2, w2[2] / l2];
  f.indici.forEach((i, k) => {
    const q = nodi[i]; if (q.fermo) return;
    const [u, v] = f.riposo[k];
    q.x += (cx + u * e1[0] + v * e2[0] - q.x) * f.alfa; q.y += (cy + u * e1[1] + v * e2[1] - q.y) * f.alfa; q.z += (cz + u * e1[2] + v * e2[2] - q.z) * f.alfa;
  });
}

/**
 * Le misure: quanto è alta (appesa: quanto scende), quanto è larga in pianta, la bocca (dove passa il cordone, o l'ultimo
 * anello: il diametro medio), di quanto al più un filo si è allungato (dovrebbe essere ~0).
 */
export function misureAppesa(s: SaccaAppesa): { profondita: number; larghezza: number; bocca: number; allungamentoMax: number } {
  let zmin = Infinity, zmax = -Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, all = 0;
  for (const [i, q] of s.nodi.entries()) { if (s.assenti[i]) continue; zmin = Math.min(zmin, q.z); zmax = Math.max(zmax, q.z); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  for (const f of s.fili) { const a = s.nodi[f.a], b = s.nodi[f.b]; all = Math.max(all, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / f.L - 1); }
  const giro = s.cordone ? s.cordone.anelli : s.bordo;
  let cx = 0, cy = 0, cz = 0; for (const i of giro) { cx += s.nodi[i].x; cy += s.nodi[i].y; cz += s.nodi[i].z; } cx /= giro.length; cy /= giro.length; cz /= giro.length;
  let rb = 0; for (const i of giro) rb += Math.hypot(s.nodi[i].x - cx, s.nodi[i].y - cy, s.nodi[i].z - cz); rb /= giro.length;
  return { profondita: zmax - zmin, larghezza: Math.max(x1 - x0, y1 - y0), bocca: 2 * rb, allungamentoMax: all };
}

/** Lascia assestare: fino a quando la sacca è ferma, o al più `massimo` passi. */
export function assesta(s: SaccaAppesa, massimo = 4000): void {
  while (s.passi < massimo && !(s.movimento < 0.002)) avanza(s, 20);
}

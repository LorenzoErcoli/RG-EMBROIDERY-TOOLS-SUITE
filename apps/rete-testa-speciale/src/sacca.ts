// La SACCA A RETE (Lorenzo, 2026-10-15): una rete di rombi coi lati tutti uguali, ricamata piatta in un disco.
// Tolta dal telaio ogni nodo fa da cerniera, i rombi ruotano senza cambiare i lati e il disco diventa una sacca,
// senza cuciture. Qui la matematica, senza DOM: gli anelli del disco e la forma della sacca che ne esce.
//
// Gli anelli. L'anello j ha N nodi al raggio ρj, sfalsati di mezzo passo (π/N) da un anello al successivo; ogni nodo
// è legato ai due nodi dell'anello dopo che gli stanno a ±π/N, con lati lunghi esattamente L:
//   ρ(j+1)² + ρj² − 2·ρj·ρ(j+1)·cos(π/N) = L²   →   ρ(j+1) = ρj·cos(π/N) + √(L² − ρj²·sin²(π/N))
// Il disco non può superare il raggio L / sin(π/N): lì i rombi sono piatti (180°).
//
// La sacca. Ogni anello diventa un cerchio di raggio Rj all'altezza zj, sempre coi lati lunghi L:
//   (z(j+1) − zj)² + Rj² + R(j+1)² − 2·Rj·R(j+1)·cos(π/N) = L²
// Il fondo tiene il suo raggio; la bocca si sceglie. Con la bocca larga quanto il disco l'unica forma possibile è il
// disco stesso; stringendola la sacca scende. Misurato sulla simulazione (2026-10-15): nel campo da 45 cm si arriva a
// circa 8 litri, e la forma la decide quasi solo il fondo.

export interface DatiAnelli {
  /** Rombi per giro. */
  N: number;
  /** Lato del rombo, mm. */
  L: number;
  /** Raggio del fondo, mm: dove finisce la rete e comincia la spirale. */
  r0: number;
  /** Angolo massimo dei rombi in fuori, gradi (180 = piatti). */
  amax: number;
  /** Lato del campo macchina, mm: il disco ci deve stare. */
  campo: number;
}

export interface Anelli {
  /** I raggi degli anelli di nodi, dal fondo alla bocca, mm. */
  rho: number[];
  s: number;
  c: number;
  /** Il raggio oltre cui i rombi sarebbero piatti. */
  rMaxPiatto: number;
  /** Cosa ferma il disco: l'angolo massimo scelto o il campo macchina. */
  perche: 'angolo' | 'campo';
  /** Il fondo è già oltre il limite: non ci sta nemmeno un anello. */
  impossibile: boolean;
  /**
   * Con il fondo ovale, i nodi di ogni anello (centro in 0, 0); `rho` è allora il raggio medio. Senza, gli anelli sono
   * cerchi: il nodo k dell'anello j sta all'angolo 2πk/N, mezzo passo più in là negli anelli dispari.
   */
  punti?: Array<Array<{ x: number; y: number }>>;
  /** Con il fondo ovale, i suoi mezzi assi (a lungo, sull'asse x; b corto) e quanto le teste sono mezzi cerchi (0..1). */
  ovale?: { a: number; b: number; tondo: number };
}

export function anelliRadiali(d: DatiAnelli): Anelli {
  const N = Math.max(3, Math.round(d.N)), s = Math.sin(Math.PI / N), c = Math.cos(Math.PI / N);
  const rMaxPiatto = d.L / s;
  const rAngolo = d.L * Math.sin(Math.min(179.9, d.amax) * Math.PI / 360) / s, rCampo = d.campo / 2;
  const limite = Math.min(rAngolo, rCampo);
  const rho = [d.r0];
  if (d.r0 * s >= d.L) return { rho, s, c, rMaxPiatto, perche: rCampo < rAngolo ? 'campo' : 'angolo', impossibile: true };
  for (;;) {
    const r = rho[rho.length - 1], q = d.L * d.L - r * r * s * s;
    if (q < 0) break;
    const nx = r * c + Math.sqrt(q);
    if (nx > limite + 1e-9 || nx <= r + 1e-9) break;
    rho.push(nx);
  }
  return { rho, s, c, rMaxPiatto, perche: rCampo < rAngolo ? 'campo' : 'angolo', impossibile: false };
}

/**
 * Il FONDO OVALE (Lorenzo, 2026-10-16: «il centro non più per forza un cerchio ma può essere un ovale… l'ampiezza da
 * centro all'esterno più piccola rispetto al lato lungo… i lati lunghi saranno più morbidi e sembrerà molto di più una
 * borsa»). Ogni anello nasce dal precedente con un triangolo di lati L su ogni coppia di nodi vicini: rombi coi lati
 * tutti uguali su qualunque fondo convesso (una rete di Čebyšëv). Sulle teste, dove l'ovale curva di più, i rombi si
 * aprono in fretta e la fascia viene corta; sui lati lunghi restano aperti e la fascia viene lunga. Le stesse regole
 * dei cerchi: il nodo k di un anello dispari sta fra i nodi k e k + 1 del pari prima, quello di un pari fra k − 1 e k.
 * `r0` = mezzo asse lungo (sull'asse x), `b` = mezzo asse corto, `tondo` = quanto le teste sono mezzi cerchi (vedi
 * `formaDelFondo`; 0 = l'ovale).
 */
export function anelliOvali(d: DatiAnelli & { b: number; tondo?: number }): Anelli {
  const N = Math.max(3, Math.round(d.N)), s = Math.sin(Math.PI / N), c = Math.cos(Math.PI / N);
  const a = Math.max(d.r0, d.b), b = Math.min(d.r0, d.b), tondo = Math.max(0, Math.min(1, d.tondo ?? 0));
  // il fondo: N nodi a passo uguale lungo il bordo, il nodo 0 sulla testa (asse x), in verso antiorario (dove la forma
  // salta, sui lati lunghi, il passo fra i due campioni è il tratto dritto)
  const M = 4096, P: Array<{ x: number; y: number }> = [], lungo = [0];
  for (let i = 0; i <= M; i++) {
    const t = 2 * Math.PI * i / M; P.push(formaDelFondo(a, b, tondo, t, 1));
    if (i) lungo.push(lungo[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  }
  const fondo: Array<{ x: number; y: number }> = [];
  for (let k = 0, i = 0; k < N; k++) {
    const g = lungo[M] * k / N; while (lungo[i + 1] < g) i++;
    const f = (g - lungo[i]) / (lungo[i + 1] - lungo[i]); fondo.push({ x: P[i].x + f * (P[i + 1].x - P[i].x), y: P[i].y + f * (P[i + 1].y - P[i].y) });
  }
  const punti = [fondo], limite = 2 * d.L * Math.sin(Math.min(179.9, d.amax) * Math.PI / 360);
  let perche: Anelli['perche'] = 'angolo';
  const medio = (r: Array<{ x: number; y: number }>) => r.reduce((t, q) => t + Math.hypot(q.x, q.y), 0) / r.length;
  for (let giro = 0; giro < 200; giro++) {
    const j = punti.length - 1, r = punti[j], nuovo: Array<{ x: number; y: number }> = [];
    for (let k = 0; k < N; k++) {
      const p = r[j % 2 ? (k - 1 + N) % N : k], q = r[j % 2 ? k : (k + 1) % N];
      const dx = q.x - p.x, dy = q.y - p.y, corda = Math.hypot(dx, dy);
      if (corda >= limite) { perche = 'angolo'; break; }
      const h = Math.sqrt(d.L * d.L - corda * corda / 4), v = { x: (p.x + q.x) / 2 + dy / corda * h, y: (p.y + q.y) / 2 - dx / corda * h };
      if (Math.abs(v.x) > d.campo / 2 || Math.abs(v.y) > d.campo / 2) { perche = 'campo'; break; }
      nuovo.push(v);
    }
    if (nuovo.length < N) break;
    punti.push(nuovo);
  }
  const rMaxPiatto = d.L / s;
  return { rho: punti.map(medio), s, c, rMaxPiatto, perche, impossibile: punti.length < 2, punti, ovale: { a, b, tondo } };
}

/** Dove sta il nodo k dell'anello j (cerchi o ovale). */
export function puntoDelNodo(A: Anelli, N: number, j: number, k: number): { x: number; y: number } {
  const kk = ((k % N) + N) % N;
  if (A.punti) return A.punti[j][kk];
  const f = 2 * Math.PI * kk / N + (j % 2 ? Math.PI / N : 0);
  return { x: A.rho[j] * Math.cos(f), y: A.rho[j] * Math.sin(f) };
}

/**
 * La forma del fondo ovale (mezzi assi a, b), dal centro (f = 0) al bordo (f = 1), nel punto di parametro t. Le teste
 * (Lorenzo, 2026-10-16: «il fondo possa essere con i finali più tondi volendo, più mezzi cerchi appunto, ma un parametro
 * di controllo anche quello»): con `tondo` = 0 l'ovale, con 1 due mezzi cerchi di raggio b uniti da tratti dritti (lo
 * «stadio»), in mezzo due mezzi ovali staccati di 2·(a − b)·tondo e uniti da tratti dritti. Dentro, i giri restano alla
 * stessa distanza sui lati lunghi e sulle teste (mezzi assi (1 − tondo)·(a − b) + f·b e f·b; un ovale in scala li
 * avrebbe più radi sulle teste), e al centro si chiudono su un tratto dritto lungo 2·(a − b). Dove cos t cambia segno la
 * forma salta da una metà all'altra: congiunti, i due punti fanno il tratto dritto.
 */
export function formaDelFondo(a: number, b: number, tondo: number, t: number, f: number): Punto {
  const c = a - b, cs = Math.cos(t);
  return { x: c * tondo * Math.sign(cs) + ((1 - tondo) * c + f * b) * cs, y: f * b * Math.sin(t) };
}

/**
 * Il fondo, dentro l'anello 0: le forme concentriche dal centro (f = 0) al bordo (f = 1). Sul cerchio il cerchio di raggio
 * f·r0; sull'ovale `formaDelFondo`. `t` = il parametro del punto (l'angolo, sul cerchio).
 */
export function puntoDelFondo(A: Anelli, t: number, f: number): Punto {
  if (!A.ovale) return { x: f * A.rho[0] * Math.cos(t), y: f * A.rho[0] * Math.sin(t) };
  const { a, b, tondo } = A.ovale;
  return formaDelFondo(a, b, tondo, t, f);
}

/** Il parametro del nodo k dell'anello 0 sulla forma del fondo (sul cerchio, il suo angolo; sui tratti dritti ±90°). */
export function parametroDelNodo(A: Anelli, N: number, k: number): number {
  if (!A.ovale) return 2 * Math.PI * k / N;
  const q = puntoDelNodo(A, N, 0, k), { a, b, tondo } = A.ovale, d = (a - b) * tondo;
  if (Math.abs(q.x) <= d) return Math.sign(q.y) * Math.PI / 2;
  return Math.atan2(q.y / b, (q.x - Math.sign(q.x) * d) / ((1 - tondo) * (a - b) + b));
}

/**
 * Dal nodo k dell'anello 0 verso il centro, alla forma f del fondo: dove le legature entrano e dove stanno i giri. Sui
 * tratti dritti si scende dritti (stessa x), sulle teste lungo il parametro.
 */
export function versoIlCentro(A: Anelli, N: number, k: number, f: number): Punto {
  if (!A.ovale) return puntoDelFondo(A, parametroDelNodo(A, N, k), f);
  const q = puntoDelNodo(A, N, 0, k), d = (A.ovale.a - A.ovale.b) * A.ovale.tondo;
  if (d > 0 && Math.abs(q.x) <= d) return { x: q.x, y: q.y * f };
  return puntoDelFondo(A, parametroDelNodo(A, N, k), f);
}

/** Quanto è «largo» il fondo per la spirale e le legature: il raggio, o il mezzo asse corto dell'ovale. */
export function raggioDelFondo(A: Anelli): number {
  return A.ovale ? A.ovale.b : A.rho[0];
}

/**
 * LE COLONNE CHE SI FERMANO PRIMA (Lorenzo, 2026-10-16: «deve essere al contrario in realtà. meno nei lati lunghi e più
 * nei lati corti»; «Fascia sui lati lunghi è importante che me lo metti dentro»). Sull'ovale la fascia viene da sola più
 * corta sulle teste; per averla più corta sui lati lunghi le colonne dei lati si fermano a un anello più basso.
 * Ritorna, per ogni colonna k, il suo ultimo anello: sulle teste quello di tutta la rete, sui lati lunghi quello che dà la
 * fascia più vicina a `fasciaLati` mm, in mezzo a scalare (sin² del parametro). Sempre un anello PARI: lì le due linee
 * della colonna si incontrano sullo stesso nodo e il filo gira senza ripassare un tratto (su un anello dispari una linea
 * finirebbe un nodo più su dell'altra). Fra colonne vicine al più due anelli di differenza. null = nessun taglio (fascia
 * 0, o fondo tondo).
 */
export function cimeDelleColonne(A: Anelli, N: number, fasciaLati: number): number[] | null {
  const n = A.rho.length - 1;
  if (!A.punti || !A.ovale || !(fasciaLati > 0) || n < 2) return null;
  const pari = n - (n % 2), b = A.ovale.b, fascia = (j: number) => Math.max(...A.punti![j].map((q) => q.y)) - b;
  let nLati = pari, meglio = Infinity;
  for (let j = 2; j <= pari; j += 2) { const d = Math.abs(fascia(j) - fasciaLati); if (d < meglio) { meglio = d; nLati = j; } }
  const cime = Array.from({ length: N }, (_, k) => { const s = Math.sin(parametroDelNodo(A, N, k)); return 2 * Math.round((nLati + (pari - nLati) * (1 - s * s)) / 2); });
  for (let giro = 0; giro < n; giro++) for (let k = 0; k < N; k++) cime[k] = Math.min(cime[k], cime[(k + 1) % N] + 2, cime[(k + N - 1) % N] + 2);
  return cime;
}

/**
 * Le cime di tutta la rete radiale: quelle della fascia sui lati lunghi, se c'è; se no, quando gli anelli sono dispari,
 * l'ultimo anello pari (Lorenzo, 2026-10-16, sulla cima di una colonna che finiva su un anello dispari: «eliminiamo queste
 * situazioni qui, perché non è attaccato a niente rimarrebbe volante»: lì le due linee della colonna non si incontrano e
 * il filo passava dall'una all'altra lungo il bordo, senza incrociare niente). null = tutti gli anelli, già pari.
 */
export function cimeDellaRete(A: Anelli, N: number, fasciaLati: number): number[] | null {
  const tagliate = cimeDelleColonne(A, N, fasciaLati);
  if (tagliate) return tagliate;
  const n = A.rho.length - 1;
  return n % 2 && n > 2 ? Array(N).fill(n - 1) : null;
}

/**
 * C'è il nodo (j, k), con le colonne che si fermano a `cime`? I nodi pari stanno su una colonna sola; un nodo dispari sta
 * fra la colonna k (la sua linea A) e la k + 1 (la sua linea B): c'è se ci passa almeno una delle due.
 */
export function ceIlNodo(cime: number[] | null | undefined, N: number, j: number, k: number): boolean {
  if (!cime) return true;
  const kk = ((k % N) + N) % N;
  return j % 2 ? j < Math.max(cime[kk], cime[(kk + 1) % N]) : j <= cime[kk];
}

/**
 * C'è il tratto dal nodo (j, k) al nodo (j + 1, kk)? Ogni tratto è di una linea sola: agli anelli pari kk = k è la linea A
 * della colonna k e kk = k − 1 la B della colonna k; ai dispari kk = k è la A della k e kk = k + 1 la B della k + 1.
 */
export function ceIlTratto(cime: number[] | null | undefined, N: number, j: number, k: number, kk: number): boolean {
  if (!cime) return true;
  const col = j % 2 ? (kk === k ? k : k + 1) : k;
  return j < cime[((col % N) + N) % N];
}

/** Al nodo dispari (j, k) passano tutte e due le linee (A della colonna k e B della k + 1)? Solo allora s'incrociano. */
export function siIncrociano(cime: number[] | null | undefined, N: number, j: number, k: number): boolean {
  if (!cime || j % 2 === 0) return true;
  const kk = ((k % N) + N) % N;
  return j < Math.min(cime[kk], cime[(kk + 1) % N]);
}

/** L'angolo della punta interna del rombo che parte dall'anello j (le sue punte di lato stanno sull'anello j + 1). */
export function angoloDelRombo(A: Anelli, L: number, j: number): number {
  return 2 * Math.asin(Math.min(1, A.rho[j + 1] * A.s / L)) * 180 / Math.PI;
}

/**
 * Quanto dentro il fondo arriva la legatura k: la metà delle legature si ferma dove sarebbero più fitte di `passo`, poi
 * la metà della metà… La legatura 0 arriva al centro. La usano il ricamo e la sacca in 3D: una regola sola.
 */
export function fondoDellaLegatura(k: number, N: number, passo: number, r0: number, minimo: number): number {
  let livello = 0; if (k === 0) livello = 30; else while (k % 2 === 0) { k /= 2; livello++; }
  return Math.max(minimo, Math.min(0.95 * r0, passo * N / (2 * Math.PI * Math.pow(2, livello))));
}

type Punto = { x: number; y: number };

/**
 * Le due linee che passano dal nodo k dell'anello j, coi loro vicini sull'anello prima e su quello dopo. Agli anelli pari
 * vanno ai nodi k e k − 1, ai dispari ai nodi k e k + 1 (sul cerchio: mezzo passo prima e dopo).
 */
function lineeDelNodo(A: Anelli, N: number, j: number, k: number): Array<[Punto, Punto]> {
  const o = j % 2 ? 1 : -1, p = (jj: number, kk: number) => puntoDelNodo(A, N, jj, kk);
  return [[p(j - 1, k), p(j + 1, k)], [p(j - 1, k + o), p(j + 1, k + o)]];
}

/**
 * L'angolo d'incrocio sul nodo k dell'anello j: fra le due linee che lì si incrociano (l'angolo del rombo), gradi. È il
 * supplementare dell'angolo che la linea fa piegandosi sul nodo: verso il centro la linea è quasi dritta e l'incrocio è
 * stretto. (Il primo tentativo usava l'angolo della linea, e la «lente costante» faceva crescere le lenti fino a 9,85 mm.)
 * Sul cerchio è lo stesso per tutti i nodi dell'anello; sull'ovale si fa la media delle due linee.
 */
export function angoloAlNodo(A: Anelli, N: number, j: number, k = 0): number {
  const q = puntoDelNodo(A, N, j, k);
  const piega = ([a, b]: [Punto, Punto]) => {
    const ux = a.x - q.x, uy = a.y - q.y, vx = b.x - q.x, vy = b.y - q.y;
    return 180 - Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))))) * 180 / Math.PI;
  };
  const [l1, l2] = lineeDelNodo(A, N, j, k);
  return (piega(l1) + piega(l2)) / 2;
}

/** La direzione dell'anello sul nodo k dell'anello j (verso antiorario): lì le linee si spostano per sovrapporsi. */
export function tangenteAlNodo(A: Anelli, N: number, j: number, k: number): Punto {
  if (!A.punti) { const f = 2 * Math.PI * k / N + (j % 2 ? Math.PI / N : 0); return { x: -Math.sin(f), y: Math.cos(f) }; }
  const a = puntoDelNodo(A, N, j, k - 1), b = puntoDelNodo(A, N, j, k + 1), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/**
 * Che cosa resta uguale in tutta la rete, dato che l'angolo d'incrocio cambia da un anello all'altro (sul secchiello da
 * 59° verso il fondo a 149° in cima) e le tre misure non possono restare uguali insieme:
 * - `spostamento`: di quanto ogni linea va oltre il nodo, di traverso (la sovrapposizione scritta, ovunque);
 * - `lente`: il tratto da un incrocio all'altro, lungo la linea (Lorenzo, 2026-10-16: verso il centro si allungava);
 * - `aggancio`: di quanto la punta di una linea passa oltre l'altra linea, misurato di traverso a quella (Lorenzo,
 *   2026-10-16: «il rischio sennò è che non si aggancia»). Con lo spostamento fisso, in cima passa appena 0,38 mm.
 */
export type RegolaSovrapposizione = 'spostamento' | 'lente' | 'aggancio';

/**
 * Di quanto la punta passa oltre l'altra linea al nodo k dell'anello j, per ogni mm di spostamento (geometria del nodo):
 * ogni linea si sposta lungo l'anello, lontano dai suoi vicini; si misura la distanza della punta dell'altra dai lati di
 * questa. Sull'ovale, la media delle due linee.
 */
export function aggancioPerMm(A: Anelli, N: number, j: number, k = 0): number {
  const q = puntoDelNodo(A, N, j, k), t = tangenteAlNodo(A, N, j, k), h = 0.5;
  const misura = ([prima, dopo]: [Punto, Punto]) => {
    // da che parte stanno i vicini di questa linea: la sua punta va dall'altra parte, quella dell'altra linea di qua
    const lato = Math.sign(((prima.x + dopo.x) / 2 - q.x) * t.x + ((prima.y + dopo.y) / 2 - q.y) * t.y) || 1;
    const sua = { x: q.x - lato * h * t.x, y: q.y - lato * h * t.y }, punta = { x: q.x + lato * h * t.x, y: q.y + lato * h * t.y };
    const dist = (a: Punto, b: Punto) => Math.abs((b.x - a.x) * (a.y - punta.y) - (a.x - punta.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);
    return Math.min(dist(prima, sua), dist(sua, dopo)) / (2 * h);
  };
  const [l1, l2] = lineeDelNodo(A, N, j, k);
  return (misura(l1) + misura(l2)) / 2;
}

/** I riferimenti della regola, calcolati una volta per rete: il seno di mezzo incrocio in cima e l'aggancio a 90°. */
const riferimenti = new WeakMap<Anelli, { N: number; cima: number; a90: number }>();
function riferimento(A: Anelli, N: number): { cima: number; a90: number } {
  const c = riferimenti.get(A); if (c && c.N === N) return c;
  const n = A.rho.length - 1, ks = A.punti ? Array.from({ length: N }, (_, k) => k) : [0];
  const media = (f: (k: number) => number) => ks.reduce((t, k) => t + f(k), 0) / ks.length;
  const cima = media((k) => Math.sin(angoloAlNodo(A, N, n - 1, k) * Math.PI / 360));
  // l'aggancio a 90°: fra i nodi a cavallo dei 90°, in proporzione (se la rete non ci arriva, il nodo più vicino)
  const punti: Array<[number, number]> = [];
  for (let j = 1; j < n; j++) for (const k of ks) punti.push([angoloAlNodo(A, N, j, k), aggancioPerMm(A, N, j, k)]);
  punti.sort((x, y) => x[0] - y[0]);
  let a90 = punti[0][0] >= 90 ? punti[0][1] : punti[punti.length - 1][1];
  for (let i = 0; i + 1 < punti.length; i++) if (punti[i][0] <= 90 && punti[i + 1][0] >= 90) { const t = (90 - punti[i][0]) / (punti[i + 1][0] - punti[i][0] || 1); a90 = punti[i][1] + t * (punti[i + 1][1] - punti[i][1]); break; }
  const r = { N, cima, a90 }; riferimenti.set(A, r); return r;
}

/**
 * Lo spostamento al nodo k dell'anello j, mm. Con `lente` la lente resta quella in cima. Con `aggancio` la sovrapposizione
 * scritta è quella di un rombo quadrato (incrocio a 90°): ogni nodo ha l'aggancio che avrebbe lì, e verso fuori, dove
 * l'incrocio si apre, lo spostamento cresce (al più metà del lato).
 */
export function sovrapposizioneAlNodo(A: Anelli, N: number, j: number, sovrapposizione: number, regola: RegolaSovrapposizione, L = Infinity, k = 0): number {
  const n = A.rho.length - 1;
  if (regola === 'spostamento' || n < 2) return sovrapposizione;
  const jj = Math.max(1, Math.min(n - 1, j)), ref = riferimento(A, N);
  if (regola === 'lente') return sovrapposizione * Math.sin(angoloAlNodo(A, N, jj, k) * Math.PI / 360) / ref.cima;
  return Math.min(L / 2, sovrapposizione * ref.a90 / aggancioPerMm(A, N, jj, k));
}

/** La lente al nodo k dell'anello j, mm (0 se le linee non si incrociano). */
export function lenteAlNodo(A: Anelli, N: number, j: number, sovrapposizione: number, regola: RegolaSovrapposizione, L = Infinity, k = 0): number {
  const s = sovrapposizioneAlNodo(A, N, j, sovrapposizione, regola, L, k);
  return s > 0 ? s / Math.sin(angoloAlNodo(A, N, j, k) * Math.PI / 360) : 0;
}

/** I nodi di un anello non si stringono oltre lo spessore del filo. */
export function raggioMinimo(N: number, filo: number): number {
  return Math.max(N * filo / Math.PI, 0.5);
}

/** Le altezze degli anelli per un profilo di raggi. */
export function altezze(R: number[], A: Anelli, L: number): number[] {
  let z = 0; const zs = [0];
  for (let j = 0; j + 1 < R.length; j++) {
    const d2 = R[j] * R[j] + R[j + 1] * R[j + 1] - 2 * R[j] * R[j + 1] * A.c;
    z += Math.sqrt(Math.max(0, L * L - d2)); zs.push(z);
  }
  return zs;
}

/** Di quanto un lato dovrebbe allungarsi per stare nel profilo (0 = la forma è possibile). */
export function allungamento(R: number[], A: Anelli, L: number): number {
  let e = 0;
  for (let j = 0; j + 1 < R.length; j++) e = Math.max(e, Math.sqrt(R[j] * R[j] + R[j + 1] * R[j + 1] - 2 * R[j] * R[j + 1] * A.c) - L);
  return e;
}

/** Il profilo più profondo con la bocca di raggio `bocca` e il fondo fermo al suo raggio. */
export function profiloPiuProfondo(A: Anelli, L: number, bocca: number, rMin: number): number[] {
  const n = A.rho.length - 1;
  const R = A.rho.slice(); R[n] = bocca;
  if (bocca >= A.rho[n] - 1e-9) return A.rho.slice();
  const F = (R: number[]) => {
    let f = 0;
    for (let j = 0; j < n; j++) {
      const d2 = R[j] * R[j] + R[j + 1] * R[j + 1] - 2 * R[j] * R[j + 1] * A.c, q = L * L - d2;
      f += q >= 0 ? Math.sqrt(q) : -1000 * (Math.sqrt(d2) - L);
    }
    return f;
  };
  for (let j = 1; j < n; j++) R[j] = Math.max(rMin, A.rho[j] + (bocca - A.rho[n]) * j / n);
  let passo = Math.max(1, A.rho[n] / 10), f = F(R);
  for (let it = 0; it < 4000 && passo > 1e-4; it++) {
    let meglio = false;
    for (let j = 1; j < n; j++) for (const dd of [passo, -passo]) {
      const v = R[j] + dd; if (v < rMin) continue;
      const old = R[j]; R[j] = v; const g = F(R);
      if (g > f + 1e-9) { f = g; meglio = true; } else R[j] = old;
    }
    if (!meglio) passo /= 2;
  }
  return R;
}

export interface FormaSacca { bocca: number; profondita: number; larga: number; litri: number; possibile: boolean }

/** La sacca con la bocca di diametro `boccaMm`: profondità, parte più larga e capienza. */
export function formaSacca(A: Anelli, L: number, boccaMm: number, rMin: number): FormaSacca {
  const n = A.rho.length - 1, R = profiloPiuProfondo(A, L, boccaMm / 2, rMin), z = altezze(R, A, L);
  let v = 0; for (let j = 0; j < n; j++) v += Math.PI / 3 * (z[j + 1] - z[j]) * (R[j] * R[j] + R[j] * R[j + 1] + R[j + 1] * R[j + 1]);
  return { bocca: 2 * R[n], profondita: z[n], larga: 2 * Math.max(...R), litri: v / 1e6, possibile: allungamento(R, A, L) < 0.05 };
}

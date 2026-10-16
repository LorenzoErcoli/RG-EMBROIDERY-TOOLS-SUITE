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

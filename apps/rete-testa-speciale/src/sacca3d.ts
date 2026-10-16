// LA SACCA APPESA (Lorenzo, 2026-10-16: «simulare una certa morbidezza del filo nel 3d… come se fosse un po' appesa»).
// Sotto-programma della sacca a rete, senza DOM: la rete diventa nodi legati da fili. Un filo NON si allunga ma si
// allenta (vincolo «al più L»), la gravità tira giù, e il calcolo lascia assestare tutto (Verlet + vincoli ripetuti).
// La morbidezza è quanto il filo resiste a piegarsi su un nodo: a 1 cede del tutto, sotto tiene un po' la forma piatta.
//
// Appesa per la bocca (i nodi dell'ultimo anello fermi su un cerchio orizzontale del diametro scelto) o per due punti
// del bordo (come per i manici). Il fondo a spirale è una ragnatela di fili: giri concentrici e raggi, anche lei molle.
import type { Anelli } from './sacca';

export type ModoAppesa = 'bocca' | 'manici';

export interface OpzioniAppesa {
  /** Rombi per giro. */
  N: number;
  /** Lato del rombo, mm. */
  L: number;
  modo: ModoAppesa;
  /** Diametro della bocca quando è appesa per la bocca, mm (non oltre il disco). */
  boccaMm: number;
  /** Distanza fra i due punti quando è appesa per i manici, mm. */
  maniciMm: number;
  /** 0 = il filo tiene la forma piatta, 1 = cede del tutto. */
  morbidezza: number;
  /** Il giro d'impuntura in cima lega le punte esterne fra loro. */
  giroInCima: boolean;
  /** Spessore del filo, mm: due nodi vicini dello stesso anello non stanno più vicini di due spessori. */
  filo: number;
}

export interface Nodo { x: number; y: number; z: number; px: number; py: number; pz: number; fermo: boolean }
/** Un filo fra due nodi: lungo al più `L` (si allenta, non si allunga). `tipo` dice a cosa serve, per il disegno. */
export interface Filo { a: number; b: number; L: number; tipo: 'rete' | 'fondo' | 'cima' }
/** Una «piega»: i due vicini di un nodo sulla stessa linea, alla distanza del disco piatto (molla debole, nei due versi). */
interface Piega { a: number; b: number; L: number }
/** Due nodi vicini dello stesso anello: non più vicini di così (lo spessore dei fili che ci passano). */
interface Distanza { a: number; b: number; minimo: number }

export interface SaccaAppesa {
  nodi: Nodo[];
  fili: Filo[];
  pieghe: Piega[];
  distanze: Distanza[];
  opz: OpzioniAppesa;
  /** Quanto si è mosso, in media, l'ultimo passo (mm): sotto qualche millesimo la sacca è ferma. */
  movimento: number;
  passi: number;
}

/** Il nodo dell'anello j, colonna k: gli anelli dispari sono sfalsati di mezzo passo. */
const indice = (N: number, j: number, k: number) => j * N + (((k % N) + N) % N);

export function creaSaccaAppesa(A: Anelli, opz: OpzioniAppesa): SaccaAppesa {
  const N = Math.max(3, Math.round(opz.N)), n = A.rho.length - 1, r0 = A.rho[0], rOut = A.rho[n];
  const nodi: Nodo[] = [], fili: Filo[] = [], pieghe: Piega[] = [], distanze: Distanza[] = [];
  const nodo = (x: number, y: number, z: number, fermo = false): number => { nodi.push({ x, y, z, px: x, py: y, pz: z, fermo }); return nodi.length - 1; };
  const filo = (a: number, b: number, tipo: Filo['tipo']) => { const p = nodi[a], q = nodi[b]; fili.push({ a, b, L: Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z), tipo }); };
  // la rete, piatta come esce dalla macchina
  for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) {
    const f = 2 * Math.PI * k / N + (j % 2 ? Math.PI / N : 0);
    nodo(A.rho[j] * Math.cos(f), A.rho[j] * Math.sin(f), 0);
  }
  for (let j = 0; j < n; j++) for (let k = 0; k < N; k++) {
    const vicini = j % 2 ? [k, k + 1] : [k, k - 1];
    for (const kk of vicini) filo(indice(N, j, k), indice(N, j + 1, kk), 'rete');
  }
  // le pieghe: sulle due linee di ogni colonna, il nodo prima e il nodo dopo
  for (let k = 0; k < N; k++) for (const lato of [0, 1]) {
    const linea = Array.from({ length: n + 1 }, (_, j) => indice(N, j, j % 2 ? (lato ? k : k - 1) : k));
    for (let j = 1; j < n; j++) { const a = nodi[linea[j - 1]], b = nodi[linea[j + 1]]; pieghe.push({ a: linea[j - 1], b: linea[j + 1], L: Math.hypot(a.x - b.x, a.y - b.y) }); }
  }
  // i nodi di un anello non si toccano
  for (let j = 0; j <= n; j++) for (let k = 0; k < N; k++) distanze.push({ a: indice(N, j, k), b: indice(N, j, k + 1), minimo: 2 * Math.max(0.1, opz.filo) });
  // il giro in cima
  if (opz.giroInCima) for (let k = 0; k < N; k++) filo(indice(N, n, k), indice(N, n, k + 1), 'cima');
  // il fondo: giri concentrici e raggi, una ragnatela di fili
  const GIRI = 4;
  let prima = Array.from({ length: N }, (_, k) => indice(N, 0, k));
  for (let g = GIRI - 1; g >= 1; g--) {
    const r = r0 * g / GIRI, giro = Array.from({ length: N }, (_, k) => nodo(r * Math.cos(2 * Math.PI * k / N), r * Math.sin(2 * Math.PI * k / N), 0));
    for (let k = 0; k < N; k++) { filo(giro[k], giro[(k + 1) % N], 'fondo'); filo(prima[k], giro[k], 'fondo'); }
    prima = giro;
  }
  for (let k = 0; k < N; k++) filo(indice(N, 0, k), indice(N, 0, k + 1), 'fondo');
  const centro = nodo(0, 0, 0);
  for (let k = 0; k < N; k += Math.max(1, Math.round(N / 8))) filo(prima[k], centro, 'fondo');

  const s: SaccaAppesa = { nodi, fili, pieghe, distanze, opz: { ...opz, N }, movimento: Infinity, passi: 0 };
  appendi(s, A);
  return s;
}

/** Dove si tiene la sacca: i nodi fermi, nella posizione scelta. Si può richiamare per cambiare bocca o manici. */
export function appendi(s: SaccaAppesa, A: Anelli): void {
  const { N } = s.opz, n = A.rho.length - 1, rOut = A.rho[n];
  for (const q of s.nodi) q.fermo = false;
  if (s.opz.modo === 'bocca') {
    const r = Math.min(rOut, Math.max(1, s.opz.boccaMm / 2));
    for (let k = 0; k < N; k++) {
      const q = s.nodi[indice(N, n, k)], f = 2 * Math.PI * k / N + (n % 2 ? Math.PI / N : 0);
      q.x = q.px = r * Math.cos(f); q.y = q.py = r * Math.sin(f); q.z = q.pz = 0; q.fermo = true;
    }
  } else {
    const d = Math.min(2 * rOut, Math.max(1, s.opz.maniciMm)) / 2;
    for (const [k, x] of [[0, d], [Math.round(N / 2), -d]] as const) {
      const q = s.nodi[indice(N, n, k)];
      q.x = q.px = x; q.y = q.py = 0; q.z = q.pz = 0; q.fermo = true;
    }
  }
  s.movimento = Infinity;
}

/**
 * Avanza la simulazione di `quanti` passi. La gravità è in «mm per passo²»: conta solo la forma finale, non il tempo.
 * Ogni passo: inerzia smorzata + gravità, poi i vincoli ripetuti (i fili non si allungano, le pieghe resistono).
 */
export function avanza(s: SaccaAppesa, quanti = 1, ripetizioni = 24): void {
  const g = 0.05, smorza = 0.97, rigidita = (1 - Math.max(0, Math.min(1, s.opz.morbidezza))) * 0.004;
  for (let it = 0; it < quanti; it++) {
    let mosso = 0;
    for (const q of s.nodi) {
      if (q.fermo) continue;
      const vx = (q.x - q.px) * smorza, vy = (q.y - q.py) * smorza, vz = (q.z - q.pz) * smorza;
      q.px = q.x; q.py = q.y; q.pz = q.z;
      q.x += vx; q.y += vy; q.z += vz - g;
    }
    for (let r = 0; r < ripetizioni; r++) {
      for (const f of s.fili) {
        const a = s.nodi[f.a], b = s.nodi[f.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d <= f.L || d === 0) continue; // il filo allentato non tira
        const wa = a.fermo ? 0 : 1, wb = b.fermo ? 0 : 1, w = wa + wb; if (!w) continue;
        const c = (d - f.L) / d / w;
        a.x += dx * c * wa; a.y += dy * c * wa; a.z += dz * c * wa;
        b.x -= dx * c * wb; b.y -= dy * c * wb; b.z -= dz * c * wb;
      }
      if (rigidita > 0) for (const p of s.pieghe) {
        const a = s.nodi[p.a], b = s.nodi[p.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d === 0) continue; // la piega torna verso la forma del disco: lo zig-zag non si raddrizza né si chiude del tutto
        const wa = a.fermo ? 0 : 1, wb = b.fermo ? 0 : 1, w = wa + wb; if (!w) continue;
        const c = (d - p.L) / d / w * rigidita;
        a.x += dx * c * wa; a.y += dy * c * wa; a.z += dz * c * wa;
        b.x -= dx * c * wb; b.y -= dy * c * wb; b.z -= dz * c * wb;
      }
      for (const m of s.distanze) {
        const a = s.nodi[m.a], b = s.nodi[m.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
        if (d >= m.minimo || d === 0) continue;
        const wa = a.fermo ? 0 : 1, wb = b.fermo ? 0 : 1, w = wa + wb; if (!w) continue;
        const c = (d - m.minimo) / d / w;
        a.x += dx * c * wa; a.y += dy * c * wa; a.z += dz * c * wa;
        b.x -= dx * c * wb; b.y -= dy * c * wb; b.z -= dz * c * wb;
      }
    }
    for (const q of s.nodi) if (!q.fermo) mosso += Math.hypot(q.x - q.px, q.y - q.py, q.z - q.pz);
    s.movimento = mosso / s.nodi.length;
    s.passi++;
  }
}

/** Le misure della sacca appesa: quanto scende, quanto è larga, di quanto al più un filo si è allungato (dovrebbe essere ~0). */
export function misureAppesa(s: SaccaAppesa): { profondita: number; larghezza: number; allungamentoMax: number } {
  let zmin = Infinity, rmax = 0, all = 0;
  for (const q of s.nodi) { zmin = Math.min(zmin, q.z); rmax = Math.max(rmax, Math.hypot(q.x, q.y)); }
  for (const f of s.fili) { const a = s.nodi[f.a], b = s.nodi[f.b]; all = Math.max(all, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / f.L - 1); }
  return { profondita: -zmin, larghezza: 2 * rmax, allungamentoMax: all };
}

/** Lascia assestare: fino a quando la sacca è ferma, o al più `massimo` passi. */
export function assesta(s: SaccaAppesa, massimo = 4000): void {
  while (s.passi < massimo && !(s.movimento < 0.002)) avanza(s, 20);
}

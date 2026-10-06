// IL PERCORSO — in che ordine si cuciono i pallini, perche' i passaggi fra uno e l'altro siano piccoli e finiscano
// dove non si vedono (R16-R21).
//
// Strada scelta dalle simulazioni (2026-10-06, sapere/tool/razza.md):
//  1. ARCHI: si legano per primi i due pallini piu' vicini, poi i successivi, a patto che ognuno resti con al piu'
//     due legami e che non si chiuda un anello. Vengono catene di pallini a contatto.
//  2. UNIONE: le catene si uniscono dal capo piu' vicino, MAI attraverso l'esterno del pezzo ne' un vuoto.
//  3. OTTIMIZZAZIONE: 2-opt (nei due versi) + Or-opt (segmenti da 1 a 3 pallini) sull'intero percorso, solo fra vicini
//     VALIDI. Il costo e' il vuoto al quadrato: toglie gli archi lunghi prima di accorciare quelli corti. E' questo
//     passo che ha portato le giunture in vista sopra 5 mm da 15 a zero sulla sagoma vera.
// Provato e scartato: serpentina a fasce, curva di Hilbert, vicino-piu'-vicino (con e senza 2-opt), posa a file, ponti
// sopra il cucito: tutti peggiori — vedi la scheda.
import { Griglia, segmentoDentroPezzo } from './geo';
import { ruota, vuotoFra } from './pallino';
import type { ParametriRazza, Pezzo, Tondino } from './tipi';

/** Due pallini si dicono "a contatto" se il vuoto fra loro e' al piu' `gapMm + CONTATTO_MM`. */
const CONTATTO_MM = 0.6;
/** Il raggio entro cui l'ottimizzazione cerca vicini. */
const RAGGIO_VICINI_MM = 7.5;

function ordineArchi(t: Tondino[], pz: Pezzo, par: ParametriRazza): number[] {
  const n = t.length;
  if (n === 0) return [];
  const raggio = par.diamMaxMm + Math.max(0, par.gapMm) + CONTATTO_MM;
  const g = new Griglia(raggio);
  t.forEach((o, i) => g.aggiungi(i, o.cx, o.cy));
  const dentro = (i: number, j: number): boolean => segmentoDentroPezzo(pz, { x: t[i].cx, y: t[i].cy }, { x: t[j].cx, y: t[j].cy });
  const archi: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (const j of g.vicini(t[i].cx, t[i].cy, raggio)) {
      if (j <= i) continue;
      const d = vuotoFra(t[i], t[j]);
      if (d <= par.gapMm + CONTATTO_MM * 2) archi.push([d, i, j]);
    }
  }
  archi.sort((x, y) => x[0] - y[0]);
  const grado = new Uint8Array(n), padre = Int32Array.from({ length: n }, (_, i) => i);
  const trova = (x: number): number => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  const nodo: number[][] = Array.from({ length: n }, () => []);
  const lega = (i: number, j: number): void => { grado[i]++; grado[j]++; nodo[i].push(j); nodo[j].push(i); padre[trova(i)] = trova(j); };
  for (const [, i, j] of archi) {
    if (grado[i] >= 2 || grado[j] >= 2 || trova(i) === trova(j)) continue;
    if (!dentro(i, j)) continue;
    lega(i, j);
  }
  // unione delle catene dal capo piu' vicino, mai attraverso l'esterno
  for (let guardia = 0; guardia < n; guardia++) {
    const capi: number[] = []; for (let i = 0; i < n; i++) if (grado[i] < 2) capi.push(i);
    let best = Infinity, bi = -1, bj = -1;
    for (const soloDentro of [true, false]) {
      for (let x = 0; x < capi.length; x++) for (let y = x + 1; y < capi.length; y++) {
        const i = capi[x], j = capi[y];
        if (trova(i) === trova(j)) continue;
        const d = vuotoFra(t[i], t[j]);
        if (d >= best) continue;
        if (soloDentro && !dentro(i, j)) continue;
        best = d; bi = i; bj = j;
      }
      if (bi >= 0) break;
    }
    if (bi < 0) break;
    lega(bi, bj);
  }
  // si legge la catena unica da un capo: quello piu' in basso a sinistra
  let start = -1, sb = Infinity;
  for (let i = 0; i < n; i++) if (grado[i] < 2) { const d = (t[i].cx - pz.minX) + (t[i].cy - pz.minY); if (d < sb) { sb = d; start = i; } }
  if (start < 0) start = 0;
  const out: number[] = [], visto = new Uint8Array(n);
  let cur = start;
  while (cur >= 0 && !visto[cur]) { out.push(cur); visto[cur] = 1; cur = nodo[cur].find((j) => !visto[j]) ?? -1; }
  for (let i = 0; i < n; i++) if (!visto[i]) out.push(i); // un anello non dovrebbe esserci
  return out;
}

/**
 * Miglioramento del percorso con 2-opt (nei due versi) e Or-opt (segmenti da 1 a 3 pallini). Si guardano solo i vicini
 * VALIDI (il segmento fra i centri sta dentro il pezzo), cosi' un arco che attraversa un vuoto non puo' rientrare.
 */
function ottimizza(t: Tondino[], ord: number[], pz: Pezzo, par: ParametriRazza, giri = 40): number[] {
  const n = ord.length;
  if (n < 4) return ord;
  const raggio = par.diamMaxMm + Math.max(0, par.gapMm) + RAGGIO_VICINI_MM;
  const g = new Griglia(12);
  t.forEach((o, i) => g.aggiungi(i, o.cx, o.cy));
  const memo = new Map<number, boolean>();
  const valido = (a: number, b: number): boolean => {
    const k = a < b ? a * n + b : b * n + a;
    let v = memo.get(k);
    if (v === undefined) { v = segmentoDentroPezzo(pz, { x: t[a].cx, y: t[a].cy }, { x: t[b].cx, y: t[b].cy }); memo.set(k, v); }
    return v;
  };
  const nb: number[][] = t.map((o, i) => g.vicini(o.cx, o.cy, raggio).filter((j) => j !== i && vuotoFra(o, t[j]) <= raggio && valido(i, j))
    .sort((x, y) => vuotoFra(o, t[x]) - vuotoFra(o, t[y])).slice(0, 14));
  const costo = (a: number, b: number): number => {
    if (a < 0 || b < 0) return 0;
    const d = vuotoFra(t[a], t[b]);
    return d * d + (valido(a, b) ? 0 : 1e4);
  };
  const p = ord.slice();
  const pos = new Int32Array(n);
  const ricalcola = (da = 0): void => { for (let i = da; i < n; i++) pos[p[i]] = i; };
  ricalcola();
  const at = (i: number): number => (i < 0 || i >= n ? -1 : p[i]);

  for (let giro = 0; giro < giri; giro++) {
    let mosse = 0;
    // 2-opt
    for (let i = 0; i < n; i++) {
      const a = p[i];
      for (const dir of [1, -1]) {
        const b = at(i + dir);
        for (const c of nb[a]) {
          const j = pos[c];
          if (dir === 1 && j <= i + 1) continue;
          if (dir === -1 && j >= i - 1) continue;
          const d = at(j + dir);
          const delta = costo(a, c) + costo(b, d) - costo(a, b) - costo(c, d);
          if (delta < -1e-9) {
            const lo = dir === 1 ? i + 1 : j, hi = dir === 1 ? j : i - 1;
            for (let l = lo, r = hi; l < r; l++, r--) { const tmp = p[l]; p[l] = p[r]; p[r] = tmp; }
            ricalcola(Math.min(lo, hi));
            mosse++;
            break;
          }
        }
      }
    }
    // Or-opt: sposta un segmento di 1-3 pallini fra due vicini
    for (let L = 1; L <= 3; L++) {
      for (let i = 0; i + L <= n; i++) {
        const s0 = p[i], sL = p[i + L - 1], prev = at(i - 1), next = at(i + L);
        const guadagno = costo(prev, s0) + costo(sL, next) - costo(prev, next);
        if (guadagno < 1e-9) continue;
        let migliore = -1e-9, mx = -2, my = -2, inverso = false;
        const prova = (x: number, y: number): void => {
          if (x >= 0 && pos[x] >= i && pos[x] < i + L) return;
          if (y >= 0 && pos[y] >= i && pos[y] < i + L) return;
          if ((x === prev && y === next) || (x === next && y === prev)) return;
          const base = costo(x, y);
          const dritto = costo(x, s0) + costo(sL, y) - base - guadagno;
          const rovescio = costo(x, sL) + costo(s0, y) - base - guadagno;
          if (dritto < migliore) { migliore = dritto; mx = x; my = y; inverso = false; }
          if (rovescio < migliore) { migliore = rovescio; mx = x; my = y; inverso = true; }
        };
        for (const c of [...nb[s0], ...nb[sL]]) {
          if (pos[c] >= i && pos[c] < i + L) continue;
          const j = pos[c];
          prova(c, at(j + 1)); prova(at(j - 1), c);
        }
        if (mx === -2) continue;
        const seg = p.slice(i, i + L);
        if (inverso) seg.reverse();
        p.splice(i, L);
        // dopo la rimozione la posizione di x/y cambia: la si ritrova dai nodi
        let dove = mx >= 0 ? p.indexOf(mx) + 1 : 0;
        if (mx < 0 && my < 0) dove = p.length;
        p.splice(dove, 0, ...seg);
        ricalcola();
        mosse++;
      }
    }
    if (!mosse) break;
  }
  return p;
}

/** L'ordine in cui si cuciono i pallini: ad archi, poi migliorato. */
export function ordinaPallini(t: Tondino[], pz: Pezzo, par: ParametriRazza): number[] {
  return ottimizza(t, ordineArchi(t, pz, par), pz, par);
}

/** Angolo dell'asse lungo il percorso: l'ingresso guarda il pallino di prima, l'uscita quello dopo. I fissi non girano... se non per questo: la forma e' tonda, l'asse e' solo la direzione del filo. */
export function angoliSulPercorso(t: Tondino[], ord: number[]): void {
  for (let i = 0; i < ord.length; i++) {
    const prev = t[ord[Math.max(0, i - 1)]], next = t[ord[Math.min(ord.length - 1, i + 1)]];
    ruota(t[ord[i]], Math.atan2(next.cy - prev.cy, next.cx - prev.cx));
  }
}

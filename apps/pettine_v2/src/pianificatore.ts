import type { Point, DstPath } from '@rg/core';

export interface Riga {
  col: number; fi: number; id: number; d: number;
  base: Point[]; denti: Array<[Point, Point]>; sorm?: boolean;
}
export interface Operazione {
  tipo: 'ricamo' | 'passaggio' | 'taglio'; colore: number; punti: Point[];
  pezzo?: number; riga?: number; coperture?: number[];
}
export interface Pezzo {
  riga: number; col: number; fi: number; d: number;
  base: Point[]; denti: Array<[Point, Point]>; seq: Point[];
}
export interface Piano {
  paths: DstPath[]; operazioni: Operazione[]; pezzi: Pezzo[];
  precedenze: Array<[number, number]>;
  statistiche: {
    tagli: number; passaggi: number; passaggiMm: number; massimoMm: number;
    innesti: number; componenti: number; violazioni: number; filoMm: number;
    punti: number; puntiCorti: number; corridoiMm: number;
  };
}
export interface OpzioniPiano {
  /** Tolleranza geometrica di progetto, non una garanzia di coprenza del tessuto. */
  tolleranzaMm?: number;
  /** Limite di ricerca in lunghezza REALE del corridoio. */
  corridoioMaxMm?: number;
  /** Massima porzione indivisibile: la riga può essere sospesa ad ogni giunzione. */
  porzioneMm?: number;
  dentro?: (p: Point) => boolean;
}
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const lung = (ps: Point[]): number => ps.slice(1).reduce((s, p, i) => s + dist(ps[i], p), 0);
function proiezione(p: Point, a: Point, b: Point): { p: Point; d: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { p: q, d: dist(p, q) };
}
function campiona(a: Point, b: Point, passo: number): Point[] {
  const n = Math.max(1, Math.ceil(dist(a, b) / passo));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }));
}
function pulisci(ps: Point[]): Point[] {
  return ps.filter((p, i) => !i || dist(p, ps[i - 1]) > 0.001);
}
/** R3: elimina vertici di routing troppo fitti solo se il nuovo segmento
 * resta entro 0,1 mm dal percorso. Se non è possibile, la verifica segnala
 * i punti corti e il motore non rende disponibile il DST macchina. */
function semplifica(ps: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ps.length - 1;) {
    out.push(ps[i]); let best = i + 1;
    for (let j = i + 2; j < ps.length; j++) {
      if (lung(ps.slice(i, j + 1)) > 3.5) break;
      if (dist(ps[i], ps[j]) > 3.1) continue;
      const ok = campiona(ps[i], ps[j], 0.15).every(q => {
        for (let k = i + 1; k <= j; k++) if (proiezione(q, ps[k - 1], ps[k]).d <= 0.1) return true;
        return false;
      });
      if (ok) best = j;
    }
    i = best;
  }
  if (ps.length) out.push(ps.at(-1)!);
  return out;
}

/** Spezzare PRIMA dell'ordine permette di visitare un'isola all'altezza della sua riga ospite. */
export function porziona(righe: Riga[], massimo = 6): Pezzo[] {
  const out: Pezzo[] = [];
  righe.forEach((r, riga) => {
    if (!r.base.length) return;
    const denti = r.denti.filter(([a, b]) => dist(a, b) >= 1);
    // Le basi macchina passano per le radici, come nel motore originale.
    const base = pulisci(denti.length ? [r.base[0], ...denti.map(d => d[0]), r.base.at(-1)!] : r.base);
    let bs = [base[0]], ds: Array<[Point, Point]> = [], acc = 0, di = 0;
    const emetti = (): void => {
      const seq: Point[] = [];
      for (const p of bs) {
        seq.push(p);
        for (const [a, b] of ds) if (dist(a, p) < 0.001) seq.push(b, a);
      }
      if (seq.length > 1) out.push({ riga, col: r.col, fi: r.fi, d: r.d, base: [...bs], denti: [...ds], seq: pulisci(seq) });
      bs = [bs.at(-1)!]; ds = []; acc = 0;
    };
    for (let i = 0; i < base.length; i++) {
      if (i) { acc += dist(base[i - 1], base[i]); bs.push(base[i]); }
      while (di < denti.length && dist(denti[di][0], base[i]) < 0.001) ds.push(denti[di++]);
      if (acc >= massimo && i < base.length - 1) emetti();
    }
    emetti();
  });
  return out;
}

/** Rete di binari REALI: ogni arco appartiene a una porzione che lo cucirà in futuro.
 * Si passa esattamente lungo una base o un dente, mai attraverso la maschera piena di un colore.
 * Le intersezioni vengono spezzate: il corridoio segue le curve e può uscire a metà riga.
 */
export function pianifica(righe: Riga[], op: OpzioniPiano = {}): Piano {
  const tol = op.tolleranzaMm ?? 0.25;
  const limite = op.corridoioMaxMm ?? 250;
  const pezzi = porziona(righe, op.porzioneMm ?? 1.5);
  interface Seg { a: Point; b: Point; owner: number; base: boolean; tagli: Point[] }
  const segs: Seg[] = [], buckets = new Map<string, number[]>();
  const BIN = 3;
  const keys = (a: Point, b: Point, m = tol): string[] => {
    const ks: string[] = [];
    for (let y = Math.floor((Math.min(a.y, b.y) - m) / BIN); y <= Math.floor((Math.max(a.y, b.y) + m) / BIN); y++)
      for (let x = Math.floor((Math.min(a.x, b.x) - m) / BIN); x <= Math.floor((Math.max(a.x, b.x) + m) / BIN); x++) ks.push(`${x},${y}`);
    return ks;
  };
  pezzi.forEach((p, owner) => {
    const add = (a: Point, b: Point, base: boolean): void => {
      if (dist(a, b) < 0.001) return;
      const ix = segs.length;
      segs.push({ a, b, owner, base, tagli: [a, b] });
      for (const key of keys(a, b)) { const v = buckets.get(key) ?? []; v.push(ix); buckets.set(key, v); }
    };
    for (let i = 1; i < p.base.length; i++) add(p.base[i - 1], p.base[i], true);
    for (const [a, b] of p.denti) add(a, b, false);
  });
  const prec = new Set<string>();
  const links: Array<{ a: Point; b: Point; owners: [number, number] }> = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], vicini = new Set<number>();
    for (const k of keys(s.a, s.b)) for (const j of buckets.get(k) ?? []) if (j > i) vicini.add(j);
    for (const j of vicini) {
      const t = segs[j];
      if (s.owner === t.owner) continue;
      const ps = pezzi[s.owner], pt = pezzi[t.owner];
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, ex = t.b.x - t.a.x, ey = t.b.y - t.a.y;
      const cross = dx * ey - dy * ex;
      const pairs: Array<[Point, Point]> = [];
      if (Math.abs(cross) > 1e-9) {
        const qx = t.a.x - s.a.x, qy = t.a.y - s.a.y;
        const u = (qx * ey - qy * ex) / cross, v = (qx * dy - qy * dx) / cross;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          const q = { x: s.a.x + u * dx, y: s.a.y + u * dy }; pairs.push([q, q]);
        }
      }
      for (const a of [s.a, s.b]) { const q = proiezione(a, t.a, t.b); if (q.d <= tol) pairs.push([a, q.p]); }
      for (const b of [t.a, t.b]) { const q = proiezione(b, s.a, s.b); if (q.d <= tol) pairs.push([q.p, b]); }
      if (!pairs.length) continue;
      // d è confrontabile soltanto entro la sua famiglia. Tra famiglie diverse
      // il rango stabile conserva il sormonto di generazione nei soli contatti reali.
      if (ps.col === pt.col && ps.riga !== pt.riga && s.base !== t.base) {
        const ordine = ps.fi === pt.fi ? ps.d - pt.d : ps.fi - pt.fi;
        if (Math.abs(ordine) > 1e-6) prec.add(ordine < 0 ? `${s.owner},${t.owner}` : `${t.owner},${s.owner}`);
      }
      for (const [a, b] of pairs) { s.tagli.push(a); t.tagli.push(b); links.push({ a, b, owners: [s.owner, t.owner] }); }
    }
  }
  const precedenze = [...prec].map(k => k.split(',').map(Number) as [number, number]);
  const dopo: number[][] = pezzi.map(() => []), indegree = new Int32Array(pezzi.length);
  for (const [a, b] of precedenze) { dopo[a].push(b); indegree[b]++; }
  interface Edge { to: number; length: number; owners: number[] }
  const nodes: Point[] = [], adj: Edge[][] = [], ids = new Map<string, number>();
  const node = (p: Point): number => {
    // Coordinate macchina DST a 0,1 mm: la rete e la verifica usano queste coordinate.
    const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10, key = `${x},${y}`;
    let i = ids.get(key); if (i !== undefined) return i;
    i = nodes.length; ids.set(key, i); nodes.push({ x, y }); adj.push([]); return i;
  };
  const edge = (a: Point, b: Point, owners: number[]): void => {
    const ia = node(a), ib = node(b); if (ia === ib) return;
    if (op.dentro && campiona(nodes[ia], nodes[ib], 0.2).some(p => !op.dentro!(p))) return;
    const length = dist(nodes[ia], nodes[ib]);
    adj[ia].push({ to: ib, length, owners }); adj[ib].push({ to: ia, length, owners });
  };
  for (const s of segs) {
    s.tagli.sort((a, b) => dist(s.a, a) - dist(s.a, b));
    const ps = pulisci(s.tagli);
    for (let k = 1; k < ps.length; k++) edge(ps[k - 1], ps[k], [s.owner]);
  }
  for (const l of links) edge(l.a, l.b, l.owners);
  const capi = pezzi.map(p => [node(p.seq[0]), node(p.seq.at(-1)!)]);
  // La rete di un colore successivo è utilizzabile solo nella sovrapposizione
  // col filo del colore corrente, verificata lungo ogni arco (non solo ai capi).
  const vicinoColore = (q: Point, col: number): boolean => {
    const candidati = buckets.get(`${Math.floor(q.x / BIN)},${Math.floor(q.y / BIN)}`) ?? [];
    return candidati.some(i => pezzi[segs[i].owner].col === col && proiezione(q, segs[i].a, segs[i].b).d <= tol);
  };
  const done = new Uint8Array(pezzi.length);
  const extraCache = new Map<string, boolean>();
  const cover = (from: number, e: Edge, c: number): number[] => e.owners.filter(o => {
    if (done[o] || pezzi[o].col < c) return false;
    if (pezzi[o].col === c) return true;
    const key = `${Math.min(from, e.to)},${Math.max(from, e.to)},${c}`;
    let ok = extraCache.get(key);
    if (ok === undefined) { ok = campiona(nodes[from], nodes[e.to], 0.2).every(q => vicinoColore(q, c)); extraCache.set(key, ok); }
    return ok;
  });
  const operazioni: Operazione[] = [], paths: DstPath[] = [];
  let path: Array<[number, number]> = [], current = -1, lastRow = -1;
  const stat = { tagli: 0, passaggi: 0, passaggiMm: 0, massimoMm: 0, innesti: 0, componenti: 0, violazioni: 0, filoMm: 0, punti: 0, puntiCorti: 0, corridoiMm: 0 };
  const visitedRows = new Set<number>(), corridoi = new Set<string>();
  const flush = (col: number): void => { if (path.length > 1) paths.push({ needle: col + 1, points_mm: path }); path = []; };
  const append = (ps: Point[]): void => {
    for (const p of ps) {
      const q: [number, number] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
      const prev = path.at(-1), d = prev ? Math.hypot(q[0] - prev[0], q[1] - prev[1]) : 0;
      if (prev && d < 0.001) continue;
      if (prev) { stat.filoMm += d; stat.punti++; if (d < 0.999) stat.puntiCorti++; }
      path.push(q);
    }
  };
  const colors = [...new Set(pezzi.map(p => p.col))].sort((a, b) => a - b);
  for (const col of colors) {
    current = -1; lastRow = -1;
    const remaining = new Set(pezzi.map((p, i) => p.col === col ? i : -1).filter(i => i >= 0));
    while (remaining.size) {
      const ready = [...remaining].filter(i => !indegree[i]);
      if (!ready.length) throw new Error('Ciclo di copertura: impossibile cucire senza invertire il sormonto.');
      const targets = new Map<number, Array<[number, number]>>();
      for (const i of ready) capi[i].forEach((n, dir) => { const v = targets.get(n) ?? []; v.push([i, dir]); targets.set(n, v); });
      let chosen = -1, dir = 0, route: number[] = [], routeOwners: number[] = [];
      if (current >= 0) {
        // Dijkstra: prima la strada realmente cucibile più corta; a pari costo
        // continua la riga in corso. Non si paga un rasafilo per risparmiare filo.
        const dd = new Map<number, number>([[current, 0]]), prev = new Map<number, [number, number[]]>();
        const heap: Array<[number, number]> = [[0, current]];
        const push = (v: [number, number]): void => { heap.push(v); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= v[0]) break; heap[k] = heap[p]; k = p; } heap[k] = v; };
        const pop = (): [number, number] => {
          const out = heap[0], v = heap.pop()!; if (heap.length) { let k = 0; while (2 * k + 1 < heap.length) { let c = 2 * k + 1; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (v[0] <= heap[c][0]) break; heap[k] = heap[c]; k = c; } heap[k] = v; } return out;
        };
        while (heap.length) {
          const [d, n] = pop(); if (d !== dd.get(n)) continue;
          const found = targets.get(n);
          if (found?.length) {
            found.sort((a, b) => Number(pezzi[b[0]].riga === lastRow) - Number(pezzi[a[0]].riga === lastRow) || a[0] - b[0]);
            [chosen, dir] = found[0];
            let k = n; route = [k];
            while (k !== current) { const [p, cov] = prev.get(k)!; routeOwners.push(...cov); route.push(p); k = p; }
            route.reverse(); break;
          }
          for (const e of adj[n]) {
            const nd = d + e.length; if (nd > limite || nd >= (dd.get(e.to) ?? Infinity)) continue;
            const cov = cover(n, e, col); if (!cov.length) continue;
            dd.set(e.to, nd); prev.set(e.to, [n, cov]); push([nd, e.to]);
          }
        }
      }
      if (chosen < 0) {
        // Una componente senza corridoio dimostrabile resta separata, anche se è vicina.
        const contatti = (i: number): number => Math.max(...capi[i].map(n => adj[n].filter(e => e.owners.some(o => !done[o] && pezzi[o].col === col && pezzi[o].riga !== pezzi[i].riga)).length));
        ready.sort((a, b) => {
          if (current < 0) return contatti(b) - contatti(a) || pezzi[a].fi - pezzi[b].fi || pezzi[a].d - pezzi[b].d || a - b;
          const da = Math.min(...capi[a].map(n => dist(nodes[current], nodes[n])));
          const db = Math.min(...capi[b].map(n => dist(nodes[current], nodes[n])));
          return da - db || a - b;
        });
        chosen = ready[0];
        if (current < 0) {
          const cont = (n: number): number => adj[n].filter(e => e.owners.some(o => !done[o] && pezzi[o].col === col && pezzi[o].riga !== pezzi[chosen].riga)).length;
          dir = cont(capi[chosen][1]) > cont(capi[chosen][0]) ? 1 : 0;
        }
        if (current >= 0) {
          dir = dist(nodes[current], nodes[capi[chosen][1]]) < dist(nodes[current], nodes[capi[chosen][0]]) ? 1 : 0;
          operazioni.push({ tipo: 'taglio', colore: col, punti: [nodes[current], nodes[capi[chosen][dir]]] }); stat.tagli++; flush(col);
        }
        stat.componenti++;
      }
      if (route.length > 1) {
        // Semplifica soltanto se rimane sullo stesso binario: non taglia le curve.
        const raw = route.map(n => nodes[n]), ps = semplifica(raw), mm = lung(ps);
        operazioni.push({ tipo: 'passaggio', colore: col, punti: ps, coperture: [...new Set(routeOwners)] });
        append(ps); stat.passaggi++; stat.passaggiMm += mm; stat.massimoMm = Math.max(stat.massimoMm, mm);
        for (let i = 1; i < route.length; i++) {
          const key = [route[i - 1], route[i]].sort((a, b) => a - b).join(',');
          if (!corridoi.has(key)) { corridoi.add(key); stat.corridoiMm += dist(raw[i - 1], raw[i]); }
        }
      }
      const p = pezzi[chosen];
      if (lastRow !== p.riga && visitedRows.has(p.riga)) stat.innesti++;
      visitedRows.add(p.riga); lastRow = p.riga;
      // Il punto di contatto diventa la radice della visita. Prima percorriamo
      // in impuntura le due ali ancora pronte, poi le ricamiamo tornando alla
      // radice. Così la coda di una riga non lascia l'ago lontano dalla macchia.
      const ingresso = capi[chosen][dir];
      const runs: Array<Array<[number, number]>> = [];
      const inclusi = new Set<number>();
      for (const primaDir of [dir, 1 - dir]) {
        let n = ingresso;
        const run: Array<[number, number]> = [];
        for (;;) {
          const candidates = ready.filter(i => !inclusi.has(i) && pezzi[i].riga === p.riga && capi[i].includes(n));
          if (!candidates.length) break;
          const ix = candidates.includes(chosen) && !inclusi.size && primaDir === dir ? chosen : candidates[0];
          const vers = capi[ix][0] === n ? 0 : 1;
          inclusi.add(ix); run.push([ix, vers]); n = capi[ix][1 - vers];
        }
        if (run.length) runs.push(run);
      }
      const uscitaUtile = (run: Array<[number, number]>): boolean => {
        const [ix, vers] = run.at(-1)!;
        return adj[capi[ix][1 - vers]].some(e => cover(capi[ix][1 - vers], e, col).some(o => !inclusi.has(o)));
      };
      // Se l'altra estremità ha già un corridoio futuro, basta la serpentina.
      // L'ala senza uscita si serve prima con andata e ritorno.
      const aperta = runs.find(uscitaUtile) ?? (remaining.size === inclusi.size ? [...runs].sort((a, b) => b.length - a.length)[0] : undefined);
      const orderedRuns = [...runs.filter(r => r !== aperta), ...(aperta ? [aperta] : [])];
      let uscita = ingresso;
      for (const run of orderedRuns) {
        if (run === aperta) {
          for (const [ix, vers] of run) {
            const q = pezzi[ix], seq = vers ? [...q.seq].reverse() : q.seq;
            operazioni.push({ tipo: 'ricamo', colore: col, punti: seq, pezzo: ix, riga: q.riga }); append(seq);
            done[ix] = 1; remaining.delete(ix); for (const n of dopo[ix]) indegree[n]--;
            uscita = capi[ix][1 - vers];
          }
          continue;
        }
        const andata: Point[] = [];
        for (const [ix, vers] of run) andata.push(...(vers ? [...pezzi[ix].base].reverse() : pezzi[ix].base));
        const ps = semplifica(pulisci(andata)), mm = lung(ps);
        if (mm > 0.01) {
          operazioni.push({ tipo: 'passaggio', colore: col, punti: ps, coperture: run.map(([i]) => i) });
          append(ps); stat.passaggi++; stat.passaggiMm += mm; stat.massimoMm = Math.max(stat.massimoMm, mm);
        }
        for (const [ix, vers] of [...run].reverse()) {
          const q = pezzi[ix], seq = vers ? q.seq : [...q.seq].reverse();
          operazioni.push({ tipo: 'ricamo', colore: col, punti: seq, pezzo: ix, riga: q.riga }); append(seq);
          done[ix] = 1; remaining.delete(ix); for (const n of dopo[ix]) indegree[n]--;
        }
      }
      current = uscita;
    }
    flush(col);
  }
  return { paths, operazioni, pezzi, precedenze, statistiche: stat };
}

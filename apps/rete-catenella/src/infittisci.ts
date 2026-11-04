// Infittire la trama di un modulo (Lorenzo, 2026-11-03: «mi devo poter infittire le trame»). Stesso metodo provato su una copia in
// Stilista (sapere/riferimenti/rete-a-moduli.md, versione C): una maglia chiusa si divide in due con una linea storta che parte da dove
// due oggetti si incontrano, così niente va diviso; la base fa andata e ritorno sulla linea, poi entrano passaggio e catenella.
//
// Si lavora su un periodo della griglia, coi moduli vicini montati intorno: ogni maglia si divide una volta sola e tutte le copie del
// modulo ricevono le stesse linee, quindi i moduli restano uguali e continuano ad attaccarsi. Tutto puro: niente DOM.
import type { ModuloRete, OggettoModulo, Xy } from './motore';

const K = 8; // pixel per mm
const AREA_MINIMA_MM2 = 12; // sotto è una scheggia fra due linee
const MARGINE_MM = 50; // una maglia sta dentro questo margine
const GIRI = 3; // le maglie appena nate si possono ridividere

export interface Deviazione {
  /** La deviazione entra nel tratto fra il vertice `dopo` e il seguente del tracciato della base. */
  dopo: number;
  /** Dove lascia la base: quanto è avanti dentro il tratto (0–1), per le deviazioni nello stesso tratto. */
  f: number;
  /** Da dove lascia la base all'altro capo; il ritorno è la stessa linea all'indietro. */
  linea: Xy[];
}

export interface EsitoInfittimento {
  modulo: ModuloRete;
  /** Le linee nuove in un periodo della griglia (due moduli, A e B). */
  linee: number;
  /** Maglie oltre la soglia che restano intere: nessuna giunzione da cui dividerle senza sbilanciarle (Lorenzo: «lasciale intere»). */
  intere: number;
}

const d = (a: Xy, b: Xy): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** La proiezione di q su un tracciato. */
function proietta(q: Xy, t: Xy[]): { e: number; i: number; f: number } {
  let e = Infinity, i = 0, f = 0;
  for (let k = 1; k < t.length; k++) {
    const dx = t[k][0] - t[k - 1][0], dy = t[k][1] - t[k - 1][1], l2 = dx * dx + dy * dy;
    const u = l2 ? Math.max(0, Math.min(1, ((q[0] - t[k - 1][0]) * dx + (q[1] - t[k - 1][1]) * dy) / l2)) : 0;
    const x = Math.hypot(q[0] - t[k - 1][0] - u * dx, q[1] - t[k - 1][1] - u * dy);
    if (x < e) { e = x; i = k - 1; f = u; }
  }
  return { e, i, f };
}

/** Una linea piegata: il punto di mezzo spostato di lato, come i tratti della ragnatela. */
function curva(a: Xy, b: Xy, piega: number): Xy[] {
  const m: Xy = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], l = d(a, b) || 1;
  const n: Xy = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  const c: Xy = [m[0] + n[0] * piega * l, m[1] + n[1] * piega * l];
  const quarto = piega * l * 0.25;
  return [a, [(a[0] + c[0]) / 2 + n[0] * quarto, (a[1] + c[1]) / 2 + n[1] * quarto], c, [(c[0] + b[0]) / 2 + n[0] * quarto, (c[1] + b[1]) / 2 + n[1] * quarto], b];
}

interface Linea { variante: 'A' | 'B'; dopoOggetto: number; t: Xy[]; base: number; dopo: number; f: number; daCapo: boolean }

export function infittisciModulo(m: ModuloRete, magliaMassimaMm2: number, seme: number): EsitoInfittimento {
  let stato = (Math.abs(Math.round(seme)) * 2654435761 + 1424) % 2147483648;
  const caso = (): number => (stato = (stato * 1103515245 + 12345) % 2147483648) / 2147483648;
  const tra = (a: number, b: number): number => a + (b - a) * caso();

  const { colonne, righe } = m.passi;
  const periodo = 2 * colonne;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const v of [m.varianti.A, m.varianti.B]) for (const o of v.oggetti) for (const p of o.t) {
    if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
  }
  const x0 = -MARGINE_MM, y0 = -MARGINE_MM, x1 = periodo + MARGINE_MM, y1 = righe + MARGINE_MM;
  const W = Math.ceil((x1 - x0) * K), H = Math.ceil((y1 - y0) * K);
  const copie: Array<{ variante: 'A' | 'B'; dx: number; dy: number }> = [];
  for (let k = Math.floor((x0 - bx1) / colonne); k <= Math.ceil((x1 - bx0) / colonne); k++) {
    for (let r = Math.floor((y0 - by1) / righe); r <= Math.ceil((y1 - by0) / righe); r++) {
      copie.push({ variante: ((k % 2) + 2) % 2 === 0 ? 'A' : 'B', dx: k * colonne, dy: r * righe });
    }
  }
  const linee: Linea[] = [];
  const basiPrime = {
    A: m.varianti.A.oggetti.map((o, i) => ({ o, i })).filter(({ o }) => o.tipo === 'base' && (o.passata ?? 1) === 1),
    B: m.varianti.B.oggetti.map((o, i) => ({ o, i })).filter(({ o }) => o.tipo === 'base' && (o.passata ?? 1) === 1),
  };
  let intere = 0;

  for (let giro = 0; giro < GIRI; giro++) {
    // ---- il raster della rete montata, con le linee già aggiunte ----
    const linea = new Uint8Array(W * H);
    const traccia = (t: Xy[], dx: number, dy: number): void => {
      for (let i = 1; i < t.length; i++) {
        const ax = (t[i - 1][0] + dx - x0) * K, ay = (t[i - 1][1] + dy - y0) * K, bx = (t[i][0] + dx - x0) * K, by = (t[i][1] + dy - y0) * K;
        const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
        for (let s = 0; s <= n; s++) {
          const cx = Math.round(ax + ((bx - ax) * s) / n), cy = Math.round(ay + ((by - ay) * s) / n);
          for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
            const X = cx + a, Y = cy + b;
            if (X >= 0 && Y >= 0 && X < W && Y < H && a * a + b * b <= 9) linea[Y * W + X] = 1;
          }
        }
      }
    };
    for (const c of copie) {
      for (const o of m.varianti[c.variante].oggetti) if (o.tipo !== 'passaggio') traccia(o.t, c.dx, c.dy);
      for (const l of linee) if (l.variante === c.variante) traccia(l.t, c.dx, c.dy);
    }

    // ---- le maglie: le aree vuote chiuse ----
    const etichetta = new Int32Array(W * H).fill(-1);
    interface Maglia { id: number; pixel: number[]; area: number; c: Xy }
    const maglie: Maglia[] = [];
    let conta = 0;
    for (let s = 0; s < W * H; s++) {
      if (linea[s] || etichetta[s] >= 0) continue;
      const id = conta++, pila = [s], pixel: number[] = [];
      let bordo = false, sx = 0, sy = 0;
      etichetta[s] = id;
      while (pila.length) {
        const i = pila.pop()!;
        pixel.push(i);
        const X = i % W, Y = (i / W) | 0;
        sx += X; sy += Y;
        if (X === 0 || Y === 0 || X === W - 1 || Y === H - 1) bordo = true;
        if (X > 0 && !linea[i - 1] && etichetta[i - 1] < 0) { etichetta[i - 1] = id; pila.push(i - 1); }
        if (X < W - 1 && !linea[i + 1] && etichetta[i + 1] < 0) { etichetta[i + 1] = id; pila.push(i + 1); }
        if (Y > 0 && !linea[i - W] && etichetta[i - W] < 0) { etichetta[i - W] = id; pila.push(i - W); }
        if (Y < H - 1 && !linea[i + W] && etichetta[i + W] < 0) { etichetta[i + W] = id; pila.push(i + W); }
      }
      if (bordo) continue;
      const area = pixel.length / (K * K);
      const c: Xy = [sx / pixel.length / K + x0, sy / pixel.length / K + y0];
      // una volta sola per periodo: il centro nel periodo, le altre sono le stesse maglie nelle altre copie
      if (area < AREA_MINIMA_MM2 || area <= magliaMassimaMm2 || c[0] < 0 || c[1] < 0 || c[0] >= periodo || c[1] >= righe) continue;
      maglie.push({ id, pixel, area, c });
    }

    // ---- le giunzioni vicine a ogni maglia ----
    const scelte = new Map(maglie.map((x) => [x.id, x]));
    const giunti = new Map<number, Array<{ p: Xy; variante: 'A' | 'B'; dopoOggetto: number; dx: number; dy: number }>>();
    for (const c of copie) {
      const og = m.varianti[c.variante].oggetti;
      for (let i = 1; i < og.length; i++) {
        if (og[i - 1].tipo === 'base' || og[i].tipo === 'base') continue;
        const t = og[i - 1].t, p: Xy = [t[t.length - 1][0] + c.dx, t[t.length - 1][1] + c.dy];
        const X = Math.round((p[0] - x0) * K), Y = Math.round((p[1] - y0) * K);
        if (X < 8 || Y < 8 || X >= W - 8 || Y >= H - 8) continue;
        const viste = new Set<number>();
        for (let a = -8; a <= 8; a++) for (let b = -8; b <= 8; b++) {
          const e = etichetta[(Y + b) * W + X + a];
          if (e < 0 || viste.has(e) || !scelte.has(e)) continue;
          viste.add(e);
          const lista = giunti.get(e);
          const g = { p, variante: c.variante, dopoOggetto: i - 1, dx: c.dx, dy: c.dy };
          if (lista) lista.push(g); else giunti.set(e, [g]);
        }
      }
    }

    const vuoto = (q: Xy): boolean => {
      const X = Math.round((q[0] - x0) * K), Y = Math.round((q[1] - y0) * K);
      return X >= 0 && Y >= 0 && X < W && Y < H && !linea[Y * W + X];
    };
    const finoAllaLinea = (p: Xy, u: Xy): Xy | null => {
      for (let t = 0; t < 60; t += 1 / K) { const q: Xy = [p[0] + u[0] * t, p[1] + u[1] * t]; if (!vuoto(q)) return q; }
      return null;
    };
    const passaDentro = (t: Xy[], id: number): boolean => {
      let fuori = 0, tot = 0;
      for (let i = 1; i < t.length; i++) {
        const l = d(t[i - 1], t[i]);
        for (let s = 0; s <= l; s += 0.25) {
          const q: Xy = [t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * s) / l, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * s) / l];
          if (d(q, t[0]) < 1 || d(q, t[t.length - 1]) < 1) continue;
          const X = Math.round((q[0] - x0) * K), Y = Math.round((q[1] - y0) * K);
          tot++;
          if (etichetta[Y * W + X] !== id) fuori++;
        }
      }
      return tot > 0 && fuori / tot < 0.08;
    };

    // ---- ogni maglia in due, dalla giunzione che la divide meglio ----
    let nuove = 0;
    intere = 0;
    for (const x of maglie) {
      const lista = giunti.get(x.id) ?? [];
      let meglio: Linea | null = null, scarto = 0.27; // non più sbilanciata di 23% e 77%
      for (const g of [...lista].sort(() => caso() - 0.5)) {
        for (let prova = 0; prova < 6; prova++) {
          const l = d(g.p, x.c) || 1, giroAng = tra(-0.25, 0.25);
          const u: Xy = [(x.c[0] - g.p[0]) / l, (x.c[1] - g.p[1]) / l];
          const dir: Xy = [u[0] * Math.cos(giroAng) - u[1] * Math.sin(giroAng), u[0] * Math.sin(giroAng) + u[1] * Math.cos(giroAng)];
          const dentro: Xy = [g.p[0] + dir[0] * l, g.p[1] + dir[1] * l];
          if (!vuoto(dentro)) continue;
          const fine = finoAllaLinea(dentro, dir);
          if (!fine) continue;
          const punti = curva(g.p, fine, tra(-0.07, 0.07));
          if (!passaDentro(punti, x.id)) continue;
          let n = 0;
          for (const i of x.pixel) {
            const qx = (i % W) / K + x0, qy = ((i / W) | 0) / K + y0;
            if ((fine[0] - g.p[0]) * (qy - g.p[1]) - (fine[1] - g.p[1]) * (qx - g.p[0]) > 0) n++;
          }
          const s = Math.abs(n / x.pixel.length - 0.5);
          if (s >= scarto) continue;
          // la base del modulo deve passare da uno dei due capi, se no la linea resterebbe senza base
          const locale = punti.map((q): Xy => [q[0] - g.dx, q[1] - g.dy]);
          let trovata: Pick<Linea, 'base' | 'dopo' | 'f' | 'daCapo'> | null = null;
          for (const b of basiPrime[g.variante]) {
            const inizio = proietta(locale[0], b.o.t);
            if (inizio.e < 0.3) { trovata = { base: b.i, dopo: inizio.i, f: inizio.f, daCapo: true }; break; }
            const coda = proietta(locale[locale.length - 1], b.o.t);
            if (coda.e < 0.3) { trovata = { base: b.i, dopo: coda.i, f: coda.f, daCapo: false }; break; }
          }
          if (!trovata) continue;
          scarto = s;
          meglio = { variante: g.variante, dopoOggetto: g.dopoOggetto, t: locale, ...trovata };
        }
      }
      if (meglio) { linee.push(meglio); nuove++; } else intere++;
    }
    if (!nuove) break;
  }

  // ---- il modulo con le linee dentro: passaggio e catenella alla giunzione, la deviazione nella base ----
  const costruisci = (variante: 'A' | 'B'): { oggetti: OggettoModulo[] } => {
    const delle = linee.filter((l) => l.variante === variante);
    const oggetti: OggettoModulo[] = [];
    m.varianti[variante].oggetti.forEach((o, i) => {
      const deviazioni: Deviazione[] = delle.filter((l) => l.base === i).map((l) => ({ dopo: l.dopo, f: l.f, linea: l.daCapo ? l.t : [...l.t].reverse() }));
      oggetti.push(deviazioni.length ? { ...o, deviazioni } : o);
      for (const l of delle) {
        if (l.dopoOggetto !== i) continue;
        oggetti.push({ tipo: 'passaggio', t: l.t, nuovo: true }, { tipo: 'catenella', t: [...l.t].reverse(), nuovo: true });
      }
    });
    return { oggetti };
  };
  return { modulo: { ...m, varianti: { A: costruisci('A'), B: costruisci('B') } }, linee: linee.length, intere };
}

/** Il tracciato di una base con le deviazioni attive: dal punto sulla base all'altro capo e ritorno. */
export function conDeviazioni(t: Xy[], deviazioni: Deviazione[]): Xy[] {
  const perTratto = [...deviazioni].sort((a, b) => a.dopo - b.dopo || a.f - b.f);
  const out: Xy[] = [t[0]];
  let k = 0;
  for (let i = 1; i < t.length; i++) {
    while (k < perTratto.length && perTratto[k].dopo === i - 1) {
      const { f, linea } = perTratto[k++];
      out.push([t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f], ...linea.slice(1), ...[...linea].reverse().slice(1));
    }
    out.push(t[i]);
  }
  return out;
}

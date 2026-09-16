// Il PEZZO vero: non il rettangolo d'ingombro, ma l'unione delle zone del disegno.
//
// Lorenzo, 16/09: «se il rombo non è completo anche le linee e le cornici non lo devono essere» — sul
// davanti dell'M3641 il pezzo ha il bordo alto curvo e un incavo in basso, e linee e cornice andavano
// avanti anche dove il cannage non c'è.
//
// Il contorno non si incatena in un anello: ai vertici dove due rombi si toccano di punta arrivano quattro
// lati e l'anello diventa ambiguo. Si tengono i LATI DI BORDO — quelli che da una parte hanno una zona e
// dall'altra no — che bastano per le tre domande di linee e cornice: un punto è dentro? quanto dista dal
// bordo? dove una retta entra ed esce dal pezzo?
import type { Punto } from './linee';
import type { Zona } from './reticolo';

export type Sagoma = {
  /** I lati del bordo del pezzo, come segmenti. */
  lati: [Punto, Punto][];
  /** Il bordo incatenato in anelli chiusi: il primo è quello esterno. Serve a chi deve cucirlo o percorrerlo. */
  anelli: Punto[][];
  ingombro: { x0: number; y0: number; x1: number; y1: number };
  /** L'anello del contorno, se il pezzo nasce da un anello (serve alle termogarze). */
  anello?: Punto[];
  /** Distanza dal bordo, positiva dentro il pezzo. */
  distanza(p: Punto): number;
  /** I tratti di una retta orizzontale dentro il pezzo, da sinistra a destra. */
  estensioniX(y: number): [number, number][];
  /** I tratti di una retta verticale dentro il pezzo, dall'alto in basso. */
  estensioniY(x: number): [number, number][];
};

/** Due tratti separati da meno di così sono lo stesso tratto (i rombi si toccano di punta). */
const SALDA = 0.6;
/** Un tratto più corto di così non è un tratto. */
const MINIMO = 0.5;

function unisci(valori: number[]): [number, number][] {
  const out: [number, number][] = [];
  valori.sort((a, b) => a - b);
  for (let i = 0; i + 1 < valori.length; i += 2) {
    const ultimo = out[out.length - 1];
    if (ultimo && valori[i] - ultimo[1] <= SALDA) ultimo[1] = Math.max(ultimo[1], valori[i + 1]);
    else out.push([valori[i], valori[i + 1]]);
  }
  return out.filter(([a, b]) => b - a >= MINIMO);
}

/** Il passo con cui si segue il bordo per incatenarlo, mm. */
const PASSO_ANELLO = 0.5;

/**
 * I lati del bordo incatenati in anelli chiusi.
 *
 * Incatenarli attaccando capo a capo non regge: ai vertici dove due rombi si toccano di punta arrivano
 * quattro lati e la strada è ambigua, e basta un lato penzolante del disegno per spezzare tutto. Allora si
 * gira attorno al pezzo: si guarda dentro/fuori su una griglia fine, si segue il contorno della maschera
 * (marching squares: i tratti nascono già in ordine e si attaccano esatti), si semplifica e si riportano i
 * vertici sui lati veri. Lo scarto dal bordo vero resta sotto il decimo di millimetro.
 */
function anelliDaLati(lati: [Punto, Punto][]): Punto[][] {
  if (!lati.length) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [a, b] of lati) for (const p of [a, b]) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const c = PASSO_ANELLO;
  const nx = Math.ceil((x1 - x0) / c) + 3, ny = Math.ceil((y1 - y0) / c) + 3;
  const X = (i: number) => x0 - c + i * c, Y = (j: number) => y0 - c + j * c;
  // dentro/fuori riga per riga, contando gli attraversamenti
  const dentro: Uint8Array[] = [];
  for (let j = 0; j < ny; j++) {
    const y = Y(j), xs: number[] = [];
    for (const [a, b] of lati) if ((a.y <= y && y < b.y) || (b.y <= y && y < a.y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    xs.sort((p, q) => p - q);
    const riga = new Uint8Array(nx);
    for (let i = 0; i < nx; i++) {
      const x = X(i);
      let n = 0;
      for (const t of xs) if (t > x) n++;
      riga[i] = n % 2;
    }
    dentro.push(riga);
  }
  // marching squares: i tratti del contorno, coi capi sui mezzi lati delle celle (che coincidono esatti)
  const mezzo = (p: Punto, q: Punto): Punto => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const chiave = (p: Punto) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
  const tratti: [Punto, Punto][] = [];
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const A = { x: X(i), y: Y(j) }, B = { x: X(i + 1), y: Y(j) }, C = { x: X(i + 1), y: Y(j + 1) }, D = { x: X(i), y: Y(j + 1) };
    const a = dentro[j][i], b = dentro[j][i + 1], cc = dentro[j + 1][i + 1], d = dentro[j + 1][i];
    const su = mezzo(A, B), destra = mezzo(B, C), giu = mezzo(D, C), sinistra = mezzo(A, D);
    const caso = a * 8 + b * 4 + cc * 2 + d;
    if (caso === 1 || caso === 14) tratti.push([sinistra, giu]);
    if (caso === 2 || caso === 13) tratti.push([giu, destra]);
    if (caso === 3 || caso === 12) tratti.push([sinistra, destra]);
    if (caso === 4 || caso === 11) tratti.push([destra, su]);
    if (caso === 6 || caso === 9) tratti.push([giu, su]);
    if (caso === 7 || caso === 8) tratti.push([sinistra, su]);
    if (caso === 5) { tratti.push([sinistra, su]); tratti.push([giu, destra]); }
    if (caso === 10) { tratti.push([destra, su]); tratti.push([sinistra, giu]); }
  }
  // i tratti si attaccano per i capi, senza badare al verso: ogni capo ne tiene due
  const aCapo = new Map<string, number[]>();
  tratti.forEach(([p, q], i) => {
    for (const z of [p, q]) { const k = chiave(z); const l = aCapo.get(k); if (l) l.push(i); else aCapo.set(k, [i]); }
  });
  const usato = new Array(tratti.length).fill(false);
  const grezzi: Punto[][] = [];
  for (let s = 0; s < tratti.length; s++) {
    if (usato[s]) continue;
    usato[s] = true;
    const anello = [tratti[s][0], tratti[s][1]];
    for (;;) {
      const fine = anello[anello.length - 1];
      const prossimo = (aCapo.get(chiave(fine)) ?? []).find((k) => !usato[k]);
      if (prossimo === undefined) break;
      usato[prossimo] = true;
      const [p, q] = tratti[prossimo];
      anello.push(chiave(p) === chiave(fine) ? q : p);
    }
    if (anello.length > 8) grezzi.push(anello);
  }
  // semplificazione (Douglas–Peucker) e ritorno sui lati veri
  const distanzaRetta = (p: Punto, a: Punto, b: Punto) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
  };
  const semplifica = (r: Punto[], eps: number): Punto[] => {
    if (r.length < 3) return r;
    let peggio = 0, dove = 0;
    for (let i = 1; i < r.length - 1; i++) {
      const d = distanzaRetta(r[i], r[0], r[r.length - 1]);
      if (d > peggio) { peggio = d; dove = i; }
    }
    if (peggio <= eps) return [r[0], r[r.length - 1]];
    return [...semplifica(r.slice(0, dove + 1), eps).slice(0, -1), ...semplifica(r.slice(dove), eps)];
  };
  const suiLati = (p: Punto): Punto => {
    let best = p, meglio = PASSO_ANELLO * 2;
    for (const [a, b] of lati) {
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < meglio) { meglio = d; best = q; }
    }
    return best;
  };
  const area = (r: Punto[]) => { let t = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; t += p.x * q.y - q.x * p.y; } return t / 2; };
  return grezzi
    .map((r) => semplifica([...r, r[0]], PASSO_ANELLO * 0.7).slice(0, -1).map(suiLati))
    .filter((r) => r.length > 2 && Math.abs(area(r)) > 2)
    .sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
}

/**
 * Il pezzo dai suoi lati di bordo. I lati finiscono in due indici — a griglia per la distanza, a fasce
 * orizzontali e verticali per i tagli — perché a queste domande linee e cornice rispondono decine di
 * migliaia di volte e scorrere ogni volta tutto il bordo costava secondi.
 */
export function sagomaDaLati(lati: [Punto, Punto][], anello?: Punto[]): Sagoma {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [a, b] of lati) for (const p of [a, b]) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const cella = Math.max(4, Math.max(x1 - x0, y1 - y0) / 48);
  const griglia = new Map<string, number[]>();
  const fasceY: number[][] = [], fasceX: number[][] = [];
  const banda = (v: number, base: number) => Math.max(0, Math.floor((v - base) / cella));
  lati.forEach(([a, b], i) => {
    const ax = Math.min(a.x, b.x), bx = Math.max(a.x, b.x), ay = Math.min(a.y, b.y), by = Math.max(a.y, b.y);
    for (let cx = banda(ax, x0); cx <= banda(bx, x0); cx++) for (let cy = banda(ay, y0); cy <= banda(by, y0); cy++) {
      const k = `${cx},${cy}`;
      const lista = griglia.get(k);
      if (lista) lista.push(i); else griglia.set(k, [i]);
    }
    for (let cy = banda(ay, y0); cy <= banda(by, y0); cy++) (fasceY[cy] ??= []).push(i);
    for (let cx = banda(ax, x0); cx <= banda(bx, x0); cx++) (fasceX[cx] ??= []).push(i);
  });
  const taglioX = (y: number) => {
    const xs: number[] = [];
    for (const i of fasceY[banda(y, y0)] ?? []) {
      const [p, q] = lati[i];
      if ((p.y <= y && y < q.y) || (q.y <= y && y < p.y)) xs.push(p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y));
    }
    return xs;
  };
  const taglioY = (x: number) => {
    const ys: number[] = [];
    for (const i of fasceX[banda(x, x0)] ?? []) {
      const [p, q] = lati[i];
      if ((p.x <= x && x < q.x) || (q.x <= x && x < p.x)) ys.push(p.y + ((x - p.x) * (q.y - p.y)) / (q.x - p.x));
    }
    return ys;
  };
  const distanzaDa = (p: Punto, i: number) => {
    const [a, b] = lati[i];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
  };
  return {
    lati,
    anello,
    anelli: anello ? [anello] : anelliDaLati(lati),
    ingombro: { x0, y0, x1, y1 },
    estensioniX: (y) => unisci(taglioX(y)),
    estensioniY: (x) => unisci(taglioY(x)),
    distanza(p) {
      // si guarda nelle celle attorno al punto, allargando finché il giro è più lontano del meglio trovato
      const cx = banda(p.x, x0), cy = banda(p.y, y0);
      let best = Infinity;
      for (let r = 0; ; r++) {
        if (best < Infinity && (r - 1) * cella > best) break;
        let viste = false;
        for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) {
          if (r > 0 && Math.abs(i - cx) !== r && Math.abs(j - cy) !== r) continue;
          const lista = griglia.get(`${i},${j}`);
          if (!lista) continue;
          viste = true;
          for (const k of lista) best = Math.min(best, distanzaDa(p, k));
        }
        if (!viste && r * cella > Math.max(x1 - x0, y1 - y0)) break;
      }
      if (best === Infinity) for (let i = 0; i < lati.length; i++) best = Math.min(best, distanzaDa(p, i));
      const dentro = taglioX(p.y).filter((x) => x > p.x).length % 2 === 1;
      return dentro ? best : -best;
    },
  };
}

/**
 * Il pezzo da anelli chiusi già pronti: la linea di contorno che Lorenzo disegna nel file (16/09,
 * «dammi la possibilità di selezionare una linea, che deve essere seguita sia dal bordo, dalla griglia e
 * dalla termo»). Il primo anello è quello esterno.
 */
export function sagomaDaAnelli(anelli: Punto[][]): Sagoma {
  const lati: [Punto, Punto][] = [];
  for (const r of anelli) for (let i = 0; i < r.length; i++) lati.push([r[i], r[(i + 1) % r.length]]);
  const s = sagomaDaLati(lati);
  const area = (r: Punto[]) => { let t = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; t += p.x * q.y - q.x * p.y; } return Math.abs(t / 2); };
  return { ...s, anelli: anelli.slice().sort((p, q) => area(q) - area(p)) };
}

/** Il pezzo da un anello chiuso (il rettangolo d'ingombro, o un contorno già pronto). */
export function sagomaDaAnello(anello: Punto[]): Sagoma {
  const lati: [Punto, Punto][] = [];
  for (let i = 0; i < anello.length; i++) lati.push([anello[i], anello[(i + 1) % anello.length]]);
  return sagomaDaLati(lati, anello);
}

function dentroZona(p: Punto, poly: Punto[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Di quanto si sporge oltre un lato per vedere se di là c'è un'altra zona, mm. */
const SPORGENZA = 0.35;

/**
 * Il pezzo dalle zone del disegno: il bordo sono i lati che di là non hanno un'altra zona. Le tinte in
 * `escludi` (le aree di scarico, che sono contorni sopra il disegno) non fanno pezzo.
 */
export function sagomaDaZone(zone: Zona[], escludi: string[] = []): Sagoma {
  const fuori = new Set(escludi.map((c) => c.toLowerCase()));
  const piene = zone.filter((z) => !fuori.has((z.color ?? '').toLowerCase()));
  const dentro = (p: Punto) => piene.some((z) => dentroZona(p, z.points));
  const lati: [Punto, Punto][] = [];
  for (const z of piene) {
    const P = z.points;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
      if (L < 0.05) continue;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const qua = { x: m.x - (dy / L) * SPORGENZA, y: m.y + (dx / L) * SPORGENZA };
      const la = { x: m.x + (dy / L) * SPORGENZA, y: m.y - (dx / L) * SPORGENZA };
      if (dentro(qua) !== dentro(la)) lati.push([a, b]);
    }
  }
  return sagomaDaLati(lati);
}

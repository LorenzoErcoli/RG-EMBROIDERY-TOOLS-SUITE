// CURVE DI LIVELLO su una regione: rasterizzare, tagliare a una quota, ricucire i pezzi.
//
// Tre passi che vanno sempre insieme. `rasterizza` trasforma una regione (contorno e fori) nella
// griglia di celle piene; `livello` prende un campo scalare su quella griglia e ne estrae la curva
// a una quota data (marching squares, un segmento per cella); `incatena` rimette i segmenti sciolti
// in polilinee ordinate. Chi le usa ci costruisce sopra cose diverse: il Punto Pittorico il
// riempimento curvo, il Punto Pettine la crescita a passo fisso.
//
// **Nate in `apps/pittorico`, promosse qui il 2026-09-10** quando i clienti sono diventati tre:
// pettine e i suoi script le importavano dall'app con un percorso relativo, che è la dipendenza
// che l'architettura non ammette. Sono salite SOLO queste tre: `buildIsoFill` resta nel Pittorico,
// perché dipende dal suo campo di direzione e ha un cliente solo (regola di crescita 1: si estrae
// quel che serve al secondo cliente, non tutto il file). Trasloco a comportamento invariato.
//
// Nessun DOM: si prova in Node.

import type { Point, Polyline } from './types';
import { type Region, pointInRegion } from './regions';

export function rasterizza(region: Region, x0: number, y0: number, cols: number, rows: number, cella: number): Uint8Array {
  const dentro = new Uint8Array(cols * rows);
  const anelli = [region.outer, ...region.holes];
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r + 0.5) * cella;
    const incroci: number[] = [];
    for (const anello of anelli) {
      const n = anello.length;
      for (let i = 0; i < n; i++) {
        const a = anello[i], b = anello[(i + 1) % n];
        // il vertice conta una volta sola: si include l'estremo basso e si esclude l'alto
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          incroci.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
    }
    if (incroci.length < 2) continue;
    incroci.sort((p, q) => p - q);
    for (let k = 0; k + 1 < incroci.length; k += 2) {
      const da = Math.max(0, Math.ceil((incroci[k] - x0) / cella - 0.5));
      const a = Math.min(cols - 1, Math.floor((incroci[k + 1] - x0) / cella - 0.5));
      for (let c = da; c <= a; c++) dentro[r * cols + c] = 1;
    }
  }
  return dentro;
}

/**
 * La distanza ANISOTROPA dentro la maschera, a spazzate.
 *
 * Il costo di un passo non e' la sua lunghezza: e' quanto quel passo ci sposta **di traverso al
 * punto**, piu' una briciola della lunghezza per tenere il conto ben posto. Cosi' la distanza
 * misura «quante corse ho attraversato», che e' esattamente la coordinata di cui vogliamo le curve
 * di livello.
 *
 * Si passa la griglia avanti e indietro aggiornando ogni cella col minimo fra i vicini gia' visti
 * piu' il costo del passo. Su una forma convessa poche spazzate bastano; qui ne servono di piu',
 * perche' il fronte deve anche allungarsi lungo le corse, e quelle girano. Si ripete finche' non
 * cambia piu' niente, con un tetto perche' una forma patologica non blocchi il calcolo.
 *
 * E' l'approssimazione di chamfer, non la soluzione esatta dell'eiconale anisotropa: l'errore e' di
 * qualche percento, cioe' centesimi di millimetro su una spaziatura di raso, sotto la risoluzione
 * della cella.
 */
interface Segmento { a: Point; b: Point }

/**
 * Marching squares su un livello: per ogni quadrato di quattro celle si guarda quali angoli stanno
 * sotto il livello e quali sopra, e si tira il segmento fra i due lati attraversati, interpolando.
 *
 * I quadrati con un angolo fuori dalla maschera si saltano: li' il fronte non e' definito, e la
 * curva deve fermarsi al bordo della macchia invece di inventarsi un pezzo.
 */
export function livello(D: Float32Array, dentro: Uint8Array, cols: number, rows: number,
  x0: number, y0: number, cella: number, val: number,
  /**
   * Solo dentro questo rettangolo di celle [c0, r0, c1, r1]. Serve a chi tira un livello per volta su
   * una banda stretta (la crescita geodetica del punto pettine): senza, ogni giro costerebbe una
   * passata su tutta la griglia, e i giri sono centinaia. Senza il parametro il comportamento non
   * cambia: si guarda tutto.
   */
  bbox?: [number, number, number, number],
): Segmento[] {
  const out: Segmento[] = [];
  const px = (c: number): number => x0 + (c + 0.5) * cella;
  const py = (r: number): number => y0 + (r + 0.5) * cella;
  const interp = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): Point => {
    const t = Math.abs(vb - va) < 1e-12 ? 0.5 : (val - va) / (vb - va);
    return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t };
  };
  const cA = bbox ? Math.max(0, bbox[0]) : 0, rA = bbox ? Math.max(0, bbox[1]) : 0;
  const cB = bbox ? Math.min(cols - 2, bbox[2]) : cols - 2, rB = bbox ? Math.min(rows - 2, bbox[3]) : rows - 2;
  for (let r = rA; r <= rB; r++) {
    for (let c = cA; c <= cB; c++) {
      const i00 = r * cols + c, i10 = i00 + 1, i01 = i00 + cols, i11 = i01 + 1;
      if (!dentro[i00] || !dentro[i10] || !dentro[i01] || !dentro[i11]) continue;
      const v00 = D[i00], v10 = D[i10], v01 = D[i01], v11 = D[i11];
      let caso = 0;
      if (v00 > val) caso |= 1;
      if (v10 > val) caso |= 2;
      if (v11 > val) caso |= 4;
      if (v01 > val) caso |= 8;
      if (caso === 0 || caso === 15) continue;
      const x0c = px(c), x1c = px(c + 1), y0c = py(r), y1c = py(r + 1);
      const basso = (): Point => interp(x0c, y0c, v00, x1c, y0c, v10);
      const destra = (): Point => interp(x1c, y0c, v10, x1c, y1c, v11);
      const alto = (): Point => interp(x0c, y1c, v01, x1c, y1c, v11);
      const sinistra = (): Point => interp(x0c, y0c, v00, x0c, y1c, v01);
      switch (caso) {
        case 1: case 14: out.push({ a: sinistra(), b: basso() }); break;
        case 2: case 13: out.push({ a: basso(), b: destra() }); break;
        case 3: case 12: out.push({ a: sinistra(), b: destra() }); break;
        case 4: case 11: out.push({ a: destra(), b: alto() }); break;
        case 6: case 9: out.push({ a: basso(), b: alto() }); break;
        case 7: case 8: out.push({ a: sinistra(), b: alto() }); break;
        // i due casi ambigui (angoli opposti): si tirano tutti e due i segmenti
        case 5: out.push({ a: sinistra(), b: basso() }, { a: destra(), b: alto() }); break;
        case 10: out.push({ a: basso(), b: destra() }, { a: sinistra(), b: alto() }); break;
        default: break;
      }
    }
  }
  return out;
}

/**
 * I segmenti sciolti rimessi in catene. Si indicizzano i capi su una griglia grossolana e si tira
 * il filo: da un capo si cerca il segmento che comincia li', e si prosegue.
 */
export function incatena(segs: Segmento[], tol: number): Polyline[] {
  const chiave = (p: Point): string => `${Math.round(p.x / tol)},${Math.round(p.y / tol)}`;
  const per = new Map<string, number[]>();
  const usato = new Uint8Array(segs.length);
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) {
      const k = chiave(p);
      const v = per.get(k);
      if (v) v.push(i); else per.set(k, [i]);
    }
  });
  // IL PIU' VICINO, non il primo che capita: con segmenti da mezza cella e una tolleranza di una cella
  // e mezza il primo trovato era spesso quello DOPO il prossimo; la catena saltava un segmento si' e
  // uno no, arrivava in fondo e tornava indietro sugli scartati - una base doppia, a un decimo di
  // millimetro dalla prima, che nel pettine raddoppiava filo e denti (misurato: 0,98 mm/mm² di basi
  // contro 0,49 dove la catena era sana).
  const prendi = (p: Point, escluso: number): number => {
    let best = -1, bestD = Infinity;
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const k = `${Math.round(p.x / tol) + dx},${Math.round(p.y / tol) + dy}`;
        for (const i of per.get(k) ?? []) {
          if (i === escluso || usato[i]) continue;
          const d = Math.min(Math.hypot(segs[i].a.x - p.x, segs[i].a.y - p.y), Math.hypot(segs[i].b.x - p.x, segs[i].b.y - p.y));
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    return best;
  };
  const out: Polyline[] = [];
  for (let s = 0; s < segs.length; s++) {
    if (usato[s]) continue;
    usato[s] = 1;
    const catena: Point[] = [segs[s].a, segs[s].b];
    // avanti
    for (;;) {
      const coda = catena[catena.length - 1];
      const j = prendi(coda, -1);
      if (j < 0) break;
      usato[j] = 1;
      const d = Math.hypot(segs[j].a.x - coda.x, segs[j].a.y - coda.y)
        <= Math.hypot(segs[j].b.x - coda.x, segs[j].b.y - coda.y);
      catena.push(d ? segs[j].b : segs[j].a);
    }
    // indietro
    for (;;) {
      const testa = catena[0];
      const j = prendi(testa, -1);
      if (j < 0) break;
      usato[j] = 1;
      const d = Math.hypot(segs[j].a.x - testa.x, segs[j].a.y - testa.y)
        <= Math.hypot(segs[j].b.x - testa.x, segs[j].b.y - testa.y);
      catena.unshift(d ? segs[j].b : segs[j].a);
    }
    if (catena.length >= 2) out.push(catena);
  }
  return out;
}


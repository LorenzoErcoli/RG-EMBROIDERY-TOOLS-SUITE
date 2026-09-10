// LE COLONNE DI RASO — la macchia spezzata come la spezza un ricamatore, e cucita da parete a parete.
//
// Il riferimento e' il DST che Lorenzo ha fatto a mano in Stilista sullo stesso disegno: 42 blocchi
// in tutto, ogni fascia d'onda UN raso solo, coi punti che vanno da un lato all'altro e
// l'orientamento che ruota dolcemente lungo la fascia; dove la forma e' troppo curva — la sfera —
// un taglio netto e un settore col suo orientamento. Nessuna cucitura dentro un blocco. La
// densita' di quel ricamo (p95/p5 2,1×) e' quella che i motori precedenti gia' facevano: quello
// che mancava era la STRUTTURA. Questo modulo la costruisce.
//
// Tre pezzi:
//
//   1. LO SCHELETRO. L'asse della macchia, per assottigliamento su griglia (Zhang-Suen), potato
//      dai rametti che nascono da ogni sporgenza del contorno, e spezzato ai bivi. Ogni ramo e'
//      l'asse di una colonna.
//   2. I TAGLI. Automatici ai bivi e dove l'asse ruota oltre un budget di gradi — e' il settore
//      della sfera. E SONO DATI: si possono aggiungere e togliere per punto, si salvano col
//      progetto, si riaprono. Il sistema propone, Lorenzo corregge.
//   3. IL RASO DI COLONNA. Lungo l'asse a passo costante; ogni punto e' la perpendicolare all'asse
//      da parete a parete, e si ferma dove comincia il territorio di un'altra colonna — cioe' al
//      taglio. La serpentina e' gratis: i punti escono in ordine lungo l'asse.
//
// Il territorio di una colonna non si calcola tagliando poligoni: e' la mappa «asse piu' vicino»
// sulla griglia. Il confine fra due colonne consecutive e' allora la bisettrice perpendicolare
// nel punto di taglio — un taglio netto e dritto, come a mano — e ai bivi i tre territori si
// spartiscono l'incrocio da soli.
//
// Nessun DOM: si prova in Node.

import type { Point, Polyline } from './types';
import type { Region } from './regions';
import { simplifyPolyline } from './geometry';
import { resampleUniform } from './stitch';
import { regionBounds } from './regions';
import { rasterizza, livello, incatena } from './isolines';

export interface ColonneOptions {
  /** Passo fra due punti lungo l'asse (R22 `densitySpacingMm`). */
  spacingMm: number;
  /** Passo massimo lungo il punto (R4). */
  maxStitchMm?: number;
  /** Lato della cella dello scheletro. Default 0,5 mm. */
  cellMm?: number;
  /**
   * Quanto puo' ruotare l'asse dentro una colonna prima che ci vada un taglio, in gradi. Default 70.
   * E' il settore della sfera: sotto, un raso solo; sopra, si taglia e si riparte.
   */
  rotazioneMassimaGradi?: number;
  /**
   * Un ramo che finisce in un capo e' un rametto — e si pota — se e' piu' corto di questo per la
   * larghezza locale al bivio da cui parte. Default 3.
   *
   * A 1,2 lo scheletro del ritaglio restava con 157 rami su una macchia sola: ogni sporgenza del
   * contorno fa nascere un ramo lungo quanto la sporgenza, e con le macchie nate dai pixel le
   * sporgenze sono ovunque. Il riferimento a mano ha una decina di blocchi per ago.
   */
  potaturaPerLarghezza?: number;
  /**
   * Larghezza massima di una colonna, in mm. Default 24.
   *
   * Un'area piu' larga di cosi' non si cuce con un raso solo: le perpendicolari all'asse
   * sventagliano — sul disegno intero i punti dei blu scuri attraversavano mezza tavola. Si fa
   * come a mano: COLONNE PARALLELE. L'asse dello scheletro piu' le sue curve a distanza costante,
   * una ogni tanto; ogni curva e' l'asse di una striscia, i punti restano corti e tutti
   * perpendicolari allo stesso flusso, e le cuciture corrono lungo la direzione del punto, dove
   * si vedono meno. Una fascia piu' stretta di cosi' non ha offset: resta una colonna sola.
   */
  larghezzaColonnaMm?: number;
  /** Tagli in piu', per punto: si proietta sull'asse piu' vicino e si spezza li'. */
  tagliAggiunti?: Point[];
  /** Tagli automatici da togliere, per punto: si toglie il taglio piu' vicino entro 5 mm. */
  tagliRimossi?: Point[];
}

/** Una colonna: il suo asse e i suoi punti, da parete a parete. */
export interface Colonna {
  id: number;
  asse: Polyline;
  runs: Polyline[];
  /** Larghezza mediana, in mm: serve a chi decide l'ordine e i sormonti. */
  larghezzaMm: number;
}

/** Un taglio: dove sta, com'e' orientato, e se l'ha messo il sistema o Lorenzo. */
export interface Taglio {
  p: Point;
  /** Il versore del taglio (perpendicolare all'asse). */
  t: Point;
  origine: 'bivio' | 'rotazione' | 'manuale';
}

export interface ColonneResult {
  colonne: Colonna[];
  tagli: Taglio[];
  /** Lo scheletro grezzo, per l'anteprima. */
  scheletro: Polyline[];
  /** Quante celle della macchia nessuna colonna ha raggiunto: se e' tanto, lo scheletro e' povero. */
  scoperteMm2: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const lunghezza = (l: Polyline): number => {
  let m = 0;
  for (let i = 1; i < l.length; i++) m += dist(l[i - 1], l[i]);
  return m;
};

// ------------------------------------------------------------------------------------------
// 1. Lo scheletro
// ------------------------------------------------------------------------------------------

/**
 * Assottigliamento di Zhang-Suen: si tolgono a turno i pixel di bordo che non spezzano la
 * connessione, finche' resta una linea larga un pixel. E' l'algoritmo classico, e basta.
 */
function assottiglia(m: Uint8Array, cols: number, rows: number): Uint8Array {
  const s = Uint8Array.from(m);
  const at = (c: number, r: number): number => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : s[r * cols + c]);
  for (let giro = 0; giro < 500; giro++) {
    let cambiato = false;
    for (let fase = 0; fase < 2; fase++) {
      const via: number[] = [];
      for (let r = 1; r + 1 < rows; r++) {
        for (let c = 1; c + 1 < cols; c++) {
          if (!s[r * cols + c]) continue;
          const p2 = at(c, r - 1), p3 = at(c + 1, r - 1), p4 = at(c + 1, r), p5 = at(c + 1, r + 1);
          const p6 = at(c, r + 1), p7 = at(c - 1, r + 1), p8 = at(c - 1, r), p9 = at(c - 1, r - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          if (fase === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          via.push(r * cols + c);
        }
      }
      for (const i of via) s[i] = 0;
      if (via.length) cambiato = true;
    }
    if (!cambiato) break;
  }
  return s;
}

interface Ramo { punti: number[]; da: number; a: number }

/**
 * Dallo scheletro a pixel ai rami: si contano i vicini di ogni pixel, i capi (un vicino) e i bivi
 * (tre o piu') sono i nodi, e si cammina da nodo a nodo. I cicli senza nodi si spezzano in un punto.
 */
function rami(s: Uint8Array, cols: number, rows: number): { rami: Ramo[]; grado: Uint8Array } {
  const grado = new Uint8Array(cols * rows);
  const vic = (i: number): number[] => {
    const c = i % cols, r = Math.floor(i / cols);
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < cols && rr < rows && s[rr * cols + cc]) out.push(rr * cols + cc);
    }
    return out;
  };
  for (let i = 0; i < s.length; i++) if (s[i]) grado[i] = vic(i).length;
  const visitato = new Uint8Array(cols * rows);
  const out: Ramo[] = [];
  const nodo = (i: number): boolean => grado[i] !== 2;
  const cammina = (da: number, primo: number): void => {
    const punti = [da, primo];
    visitato[primo] = 1;
    let prev = da, cur = primo;
    while (!nodo(cur)) {
      const prossimi = vic(cur).filter((j) => j !== prev && !(visitato[j] && !nodo(j)));
      if (!prossimi.length) break;
      prev = cur; cur = prossimi[0];
      if (!nodo(cur)) visitato[cur] = 1;
      punti.push(cur);
    }
    out.push({ punti, da, a: cur });
  };
  for (let i = 0; i < s.length; i++) {
    if (!s[i] || !nodo(i)) continue;
    for (const j of vic(i)) if (!visitato[j] && (!nodo(j) || j > i)) cammina(i, j);
  }
  // i cicli puri: nessun nodo, tutti grado 2
  for (let i = 0; i < s.length; i++) {
    if (!s[i] || visitato[i] || nodo(i)) continue;
    const punti = [i]; visitato[i] = 1;
    let prev = -1, cur = i;
    for (;;) {
      const prossimi = vic(cur).filter((j) => j !== prev && !visitato[j]);
      if (!prossimi.length) break;
      prev = cur; cur = prossimi[0]; visitato[cur] = 1; punti.push(cur);
    }
    out.push({ punti, da: i, a: cur });
  }
  return { rami: out, grado };
}

// ------------------------------------------------------------------------------------------
// 2 e 3. Le colonne e il raso
// ------------------------------------------------------------------------------------------

export function buildColonne(region: Region, opts: ColonneOptions): ColonneResult {
  const passo = opts.spacingMm;
  const vuoto: ColonneResult = { colonne: [], tagli: [], scheletro: [], scoperteMm2: 0 };
  if (!(passo > 0)) return vuoto;
  const cella = opts.cellMm ?? 0.5;
  const bb = regionBounds(region);
  const x0 = bb.minX - cella * 2, y0 = bb.minY - cella * 2;
  const cols = Math.ceil((bb.maxX - bb.minX) / cella) + 4, rows = Math.ceil((bb.maxY - bb.minY) / cella) + 4;
  if (cols * rows > 30e6) return vuoto;
  const dentro = rasterizza(region, x0, y0, cols, rows, cella);
  const px = (i: number): Point => ({ x: x0 + ((i % cols) + 0.5) * cella, y: y0 + (Math.floor(i / cols) + 0.5) * cella });

  // la distanza dal bordo: e' la larghezza locale, e serve a potare e a fermare i punti
  const D = new Float32Array(cols * rows).fill(Infinity);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    if (!dentro[i]) { D[i] = 0; continue; }
    if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1 || !dentro[i - 1] || !dentro[i + 1] || !dentro[i - cols] || !dentro[i + cols]) D[i] = cella * 0.5;
  }
  chamfer(dentro, D, cols, rows, cella);

  // ---- 1. lo scheletro, potato -----------------------------------------------------------
  let sch = assottiglia(dentro, cols, rows);
  const soglia = opts.potaturaPerLarghezza ?? 3;
  for (let potatura = 0; potatura < 8; potatura++) {
    const { rami: rr, grado } = rami(sch, cols, rows);
    let potato = false;
    for (const ramo of rr) {
      const capoDa = grado[ramo.da] === 1, capoA = grado[ramo.a] === 1;
      if (!capoDa && !capoA) continue;                 // un ramo fra due bivi resta
      if (capoDa && capoA) continue;                   // un ramo isolato e' una colonna intera
      const nodoInterno = capoDa ? ramo.a : ramo.da;
      const lung = ramo.punti.length * cella;
      // un rametto: piu' corto della larghezza della macchia al bivio da cui parte
      if (lung < D[nodoInterno] * soglia) {
        for (const i of ramo.punti) if (i !== nodoInterno) sch[i] = 0;
        potato = true;
      }
    }
    if (!potato) break;
    sch = assottiglia(sch, cols, rows);                // dopo la potatura il bivio puo' restare «grasso»
  }
  const { rami: ramiFinali } = rami(sch, cols, rows);
  if (!ramiFinali.length) return vuoto;

  // ---- 2. gli assi, e i tagli -------------------------------------------------------------
  interface Asse { punti: Polyline; id: number }
  const assi: Asse[] = [];
  const tagli: Taglio[] = [];
  const rotMax = ((opts.rotazioneMassimaGradi ?? 70) * Math.PI) / 180;
  let prossimoId = 0;

  // i tagli manuali si proiettano sull'asse piu' vicino; quelli rimossi si tengono da parte
  const aggiunti = opts.tagliAggiunti ?? [];
  const rimossi = opts.tagliRimossi ?? [];
  const rimosso = (p: Point): boolean => rimossi.some((q) => dist(p, q) <= 5);

  for (const ramo of ramiFinali) {
    // l'asse liscio: dal pixel al millimetro, una media mobile, e via i vertici allineati
    let asse: Point[] = ramo.punti.map(px);
    asse = liscia(asse, 8, cella);
    if (lunghezza(asse) < passo * 6) continue;
    asse = resampleUniform(asse, Math.max(passo, cella));

    /*
     * Dove si spezza: per rotazione NETTA accumulata, e per taglio manuale.
     *
     * Netta, non assoluta: un asse che serpeggia di qualche grado avanti e indietro non e' una
     * curva, e' rumore dello scheletro, e sommando i valori assoluti ogni serpeggio consumava il
     * budget. Si misura la direzione su un tratto di 4 mm (non fra due campioni vicini) e si somma
     * col segno: un settore nasce dove l'asse ha girato DAVVERO di 70 gradi da una parte.
     */
    const spezzaA = new Set<number>();
    const passoAsse = Math.max(passo, cella);
    const finestra = Math.max(2, Math.round(4 / passoAsse));
    const direzione = (i: number): number => {
      const a = asse[Math.max(0, i - finestra)], b = asse[Math.min(asse.length - 1, i + finestra)];
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    let accumulo = 0, ultimoTaglio = 0;
    for (let i = 1; i < asse.length; i++) {
      let d = direzione(i) - direzione(i - 1);
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      accumulo += d;
      // un taglio non prima di 6 mm dal precedente: un settore da due passi non e' un raso
      if (Math.abs(accumulo) > rotMax && (i - ultimoTaglio) * passoAsse >= 6 && (asse.length - 1 - i) * passoAsse >= 6 && !rimosso(asse[i])) {
        spezzaA.add(i); accumulo = 0; ultimoTaglio = i;
        tagli.push({ p: asse[i], t: perpendicolare(asse, i), origine: 'rotazione' });
      }
    }
    for (const q of aggiunti) {
      let best = -1, bd = Infinity;
      for (let i = 1; i + 1 < asse.length; i++) { const d = dist(asse[i], q); if (d < bd) { bd = d; best = i; } }
      // vale solo se il punto sta davvero vicino a QUESTO asse: entro la larghezza locale
      if (best > 0) {
        const c = Math.floor((asse[best].x - x0) / cella), r = Math.floor((asse[best].y - y0) / cella);
        const largh = c >= 0 && r >= 0 && c < cols && r < rows ? D[r * cols + c] : 0;
        if (bd <= Math.max(largh * 1.5, 3)) {
          spezzaA.add(best);
          tagli.push({ p: asse[best], t: perpendicolare(asse, best), origine: 'manuale' });
        }
      }
    }
    let inizio = 0;
    const indici = [...spezzaA].sort((a, b) => a - b);
    for (const k of [...indici, asse.length - 1]) {
      const pezzo = asse.slice(inizio, k + 1);
      if (pezzo.length >= 2) assi.push({ punti: pezzo, id: prossimoId++ });
      inizio = k;
    }
    // il capo di un ramo che finisce in un bivio e' un taglio automatico
    if (ramo.punti.length > 1 && !rimosso(asse[0]) && asse.length > 2) {
      // (solo per il disegno: il territorio lo decide la mappa)
    }
  }
  if (!assi.length) return vuoto;

  /*
   * LE COLONNE PARALLELE. Dallo scheletro si misura la distanza dentro la macchia, e le sue curve
   * di livello a W, 2W, 3W... sono altri assi: ognuna e' una striscia larga W, coi punti
   * perpendicolari a lei — cioe' allo stesso flusso dello scheletro. Le curve chiuse (un anello
   * intorno a un ramo) si spezzano da sole dove girano di 180 gradi intorno al capo, per il budget
   * di rotazione; le aperte finiscono sul bordo della macchia.
   */
  const W = opts.larghezzaColonnaMm ?? 24;
  const Ds = new Float32Array(cols * rows).fill(Infinity);
  for (const a of assi) {
    for (const q of resampleUniform(a.punti, cella * 0.5)) {
      const c = Math.round((q.x - x0) / cella - 0.5), r = Math.round((q.y - y0) / cella - 0.5);
      if (c >= 0 && r >= 0 && c < cols && r < rows && dentro[r * cols + c]) Ds[r * cols + c] = 0;
    }
  }
  chamfer(dentro, Ds, cols, rows, cella);
  let maxDs = 0;
  for (let i = 0; i < Ds.length; i++) if (dentro[i] && Ds[i] < Infinity && Ds[i] > maxDs) maxDs = Ds[i];
  for (let k = 1; k * W < maxDs + W * 0.5; k++) {
    const livelloMm = k * W;
    const segs = livello(Ds, dentro, cols, rows, x0, y0, cella, livelloMm);
    for (const catena of incatena(segs, cella * 0.75)) {
      if (lunghezza(catena) < Math.max(passo * 10, 6)) continue;
      const asse = resampleUniform(liscia(catena, 8, cella), Math.max(passo, cella));
      // il budget di rotazione, come per gli assi dello scheletro: spezza le curve chiuse ai capi
      const spezzaA = new Set<number>();
      const finestra = Math.max(2, Math.round(4 / Math.max(passo, cella)));
      const direzione = (i: number): number => {
        const a = asse[Math.max(0, i - finestra)], b = asse[Math.min(asse.length - 1, i + finestra)];
        return Math.atan2(b.y - a.y, b.x - a.x);
      };
      let accumulo = 0, ultimo = 0;
      for (let i = 1; i < asse.length; i++) {
        let d = direzione(i) - direzione(i - 1);
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        accumulo += d;
        if (Math.abs(accumulo) > rotMax && (i - ultimo) * Math.max(passo, cella) >= 6 && (asse.length - 1 - i) * Math.max(passo, cella) >= 6) {
          spezzaA.add(i); accumulo = 0; ultimo = i;
          tagli.push({ p: asse[i], t: perpendicolare(asse, i), origine: 'rotazione' });
        }
      }
      let inizio = 0;
      for (const kk of [...[...spezzaA].sort((u, v) => u - v), asse.length - 1]) {
        const pezzo = asse.slice(inizio, kk + 1);
        if (pezzo.length >= 2 && lunghezza(pezzo) >= passo * 4) assi.push({ punti: pezzo, id: prossimoId++ });
        inizio = kk;
      }
    }
  }

  // ---- il territorio: l'asse piu' vicino, cella per cella --------------------------------
  const chi = new Int32Array(cols * rows).fill(-1);
  const Dt = new Float32Array(cols * rows).fill(Infinity);
  for (const a of assi) {
    for (const p of resampleUniform(a.punti, cella * 0.5)) {
      const c = Math.round((p.x - x0) / cella - 0.5), r = Math.round((p.y - y0) / cella - 0.5);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = r * cols + c;
      if (dentro[i] && Dt[i] > 0) { Dt[i] = 0; chi[i] = a.id; }
    }
  }
  propagaEtichette(dentro, Dt, chi, cols, rows, cella);
  const territorio = (p: Point): number => {
    const c = Math.floor((p.x - x0) / cella), r = Math.floor((p.y - y0) / cella);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
    return dentro[r * cols + c] ? chi[r * cols + c] : -1;
  };

  // ---- 3. il raso: la perpendicolare all'asse, da parete a parete -------------------------
  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;
  const colonne: Colonna[] = [];
  const coperto = new Uint8Array(cols * rows);
  for (const a of assi) {
    const runs: Polyline[] = [];
    const larghezze: number[] = [];
    const campioni = resampleUniform(a.punti, passo);
    for (let i = 0; i < campioni.length; i++) {
      const n = perpendicolare(campioni, i);
      const p = campioni[i];
      // si marcia nei due sensi finche' si sta nella macchia E nel proprio territorio
      const marcia = (segno: 1 | -1): Point => {
        let ultimo = p;
        for (let s = cella * 0.5; s < 400; s += cella * 0.5) {
          const q = { x: p.x + n.x * s * segno, y: p.y + n.y * s * segno };
          const t = territorio(q);
          if (t !== a.id) break;
          ultimo = q;
        }
        return ultimo;
      };
      // e non oltre una volta e mezza la semilarghezza locale: il territorio di un asse corto e' un
      // cuneo che va lontano, e senza questo tetto il punto sventagliava attraverso mezza macchia
      const cp = Math.floor((p.x - x0) / cella), rp = Math.floor((p.y - y0) / cella);
      const semi = cp >= 0 && rp >= 0 && cp < cols && rp < rows ? D[rp * cols + cp] : 0;
      // il tetto: la meta' della larghezza di colonna, o la semilarghezza locale se e' piu' piccola —
      // e mai meno di due passi
      const tetto = Math.max(passo * 2, Math.min(semi * 1.6, W));
      const limita = (q: Point): Point => {
        const l = dist(p, q);
        return l <= tetto ? q : { x: p.x + ((q.x - p.x) * tetto) / l, y: p.y + ((q.y - p.y) * tetto) / l };
      };
      const da = limita(marcia(-1)), al = limita(marcia(1));
      const l = dist(da, al);
      if (l < passo) continue;
      const run: Polyline = i % 2 === 0 ? [da, al] : [al, da];
      runs.push(maxStitch > 0 ? resampleUniform(run, maxStitch) : run);
      larghezze.push(l);
      for (const q of resampleUniform(run, cella * 0.5)) {
        const c = Math.floor((q.x - x0) / cella), r = Math.floor((q.y - y0) / cella);
        if (c >= 0 && r >= 0 && c < cols && r < rows) coperto[r * cols + c] = 1;
      }
    }
    larghezze.sort((u, v) => u - v);
    if (runs.length) colonne.push({ id: a.id, asse: a.punti, runs, larghezzaMm: larghezze[Math.floor(larghezze.length / 2)] ?? 0 });
  }
  let scoperte = 0;
  for (let i = 0; i < dentro.length; i++) if (dentro[i] && !coperto[i]) scoperte++;
  const scheletro = ramiFinali.map((r) => r.punti.map(px));
  return { colonne, tagli, scheletro, scoperteMm2: scoperte * cella * cella };
}

/**
 * Una polilinea lisciata con una media mobile larga `mm`: si ricampiona fitto, si media, si
 * semplifica. E' la stessa per gli assi dello scheletro e per le loro curve di offset, ed e' il
 * lucchetto sulla resa: lo scheletro nasce a pixel e serpeggia, e ogni serpeggio dell'asse
 * diventa un ventaglio nei punti che gli stanno perpendicolari. Con una finestra di 8 mm l'asse
 * e' una curva, e i punti girano piano come in un raso fatto a mano. I capi restano fermi.
 */
function liscia(l: Polyline, mm: number, passoMm: number): Polyline {
  if (l.length < 3 || lunghezza(l) < mm) return l;
  const fitto = resampleUniform(l, passoMm);
  const w = Math.max(1, Math.round(mm / passoMm / 2));
  const out: Point[] = [];
  for (let i = 0; i < fitto.length; i++) {
    let sx = 0, sy = 0, n = 0;
    for (let k = -w; k <= w; k++) {
      const j = i + k;
      if (j < 0 || j >= fitto.length) continue;
      sx += fitto[j].x; sy += fitto[j].y; n++;
    }
    out.push({ x: sx / n, y: sy / n });
  }
  out[0] = l[0]; out[out.length - 1] = l[l.length - 1];
  return simplifyPolyline(out, passoMm * 0.3);
}

/** La perpendicolare all'asse nel punto i, versore. */
function perpendicolare(asse: Polyline, i: number): Point {
  const a = asse[Math.max(0, i - 1)], b = asse[Math.min(asse.length - 1, i + 1)];
  const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
  return { x: -dy / m, y: dx / m };
}

/** Chamfer isotropo, a spazzate, dentro la maschera. */
function chamfer(dentro: Uint8Array, D: Float32Array, cols: number, rows: number, cella: number): void {
  const d1 = cella, d2 = cella * Math.SQRT2;
  for (let giro = 0; giro < 64; giro++) {
    let cambiato = false;
    for (let dir = 0; dir < 2; dir++) {
      const r0 = dir === 0 ? 0 : rows - 1, r1 = dir === 0 ? rows : -1, dr = dir === 0 ? 1 : -1;
      const c0 = dir === 0 ? 0 : cols - 1, c1 = dir === 0 ? cols : -1, dc = dir === 0 ? 1 : -1;
      for (let r = r0; r !== r1; r += dr) for (let c = c0; c !== c1; c += dc) {
        const i = r * cols + c;
        if (!dentro[i]) continue;
        let v = D[i];
        if (c > 0) v = Math.min(v, D[i - 1] + d1);
        if (c + 1 < cols) v = Math.min(v, D[i + 1] + d1);
        if (r > 0) { v = Math.min(v, D[i - cols] + d1); if (c > 0) v = Math.min(v, D[i - cols - 1] + d2); if (c + 1 < cols) v = Math.min(v, D[i - cols + 1] + d2); }
        if (r + 1 < rows) { v = Math.min(v, D[i + cols] + d1); if (c > 0) v = Math.min(v, D[i + cols - 1] + d2); if (c + 1 < cols) v = Math.min(v, D[i + cols + 1] + d2); }
        if (v < D[i]) { D[i] = v; cambiato = true; }
      }
    }
    if (!cambiato) break;
  }
}

/** Come il chamfer, ma porta con se' l'etichetta della sorgente piu' vicina: e' il Voronoi degli assi. */
function propagaEtichette(dentro: Uint8Array, D: Float32Array, chi: Int32Array, cols: number, rows: number, cella: number): void {
  const d1 = cella, d2 = cella * Math.SQRT2;
  for (let giro = 0; giro < 64; giro++) {
    let cambiato = false;
    for (let dir = 0; dir < 2; dir++) {
      const r0 = dir === 0 ? 0 : rows - 1, r1 = dir === 0 ? rows : -1, dr = dir === 0 ? 1 : -1;
      const c0 = dir === 0 ? 0 : cols - 1, c1 = dir === 0 ? cols : -1, dc = dir === 0 ? 1 : -1;
      for (let r = r0; r !== r1; r += dr) for (let c = c0; c !== c1; c += dc) {
        const i = r * cols + c;
        if (!dentro[i]) continue;
        const prova = (j: number, peso: number): void => {
          if (!dentro[j] || chi[j] < 0) return;
          const v = D[j] + peso;
          if (v < D[i]) { D[i] = v; chi[i] = chi[j]; cambiato = true; }
        };
        if (c > 0) prova(i - 1, d1);
        if (c + 1 < cols) prova(i + 1, d1);
        if (r > 0) { prova(i - cols, d1); if (c > 0) prova(i - cols - 1, d2); if (c + 1 < cols) prova(i - cols + 1, d2); }
        if (r + 1 < rows) { prova(i + cols, d1); if (c > 0) prova(i + cols - 1, d2); if (c + 1 < cols) prova(i + cols + 1, d2); }
      }
    }
    if (!cambiato) break;
  }
}

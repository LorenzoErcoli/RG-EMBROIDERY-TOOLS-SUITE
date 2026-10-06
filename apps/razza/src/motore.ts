// IL MOTORE — «Pelle di razza»: pallini di cordoncino, piccoli ai bordi e grandi verso il centro.
//
// Nato dalle simulazioni del 2026-10-06 (scheda: sapere/tool/razza.md). Cosa fa, in cinque passi, ognuno col suo
// parametro e la sua misura:
//   1. CAMPO    — quanto grande dev'essere un pallino in ogni punto (campo.ts): dal bordo, dalle linee di
//                 sfumatura, dai pallini fissi.
//   2. POSA     — dove stanno (posa.ts): fissi, semina, crescita, buchi riempiti.
//   3. PERCORSO — in che ordine si cuciono (percorso.ts): archi + ottimizzazione locale.
//   4. PUNTO    — ogni pallino e' UN cordoncino (pallino.ts), da che capo si entra e da che lato (Viterbi sul passaggio
//                 meno visto).
//   5. PASSAGGI — dentro il pallino appena cucito e sotto il prossimo (passaggi.ts), col minimo (R3) applicato DOPO il
//                 collegamento e il massimo (R4) anche ai passaggi.
//
// Nessun DOM. Gira in un Web Worker (razza.worker.ts) perche' sul pezzo intero ci vogliono alcuni secondi.
import type { ExportLayer, Point } from '@rg/core';
import { creaCampo } from './campo';
import { Griglia, MappaDistanze, areaPezzo, segmentoDentroPezzo } from './geo';
import { areaTondino, dentro, puntiCordoncino, puntoSullaGriglia, sullaGriglia } from './pallino';
import { angoliSulPercorso, ordinaPallini } from './percorso';
import { viaPassaggio, vistaSopra } from './passaggi';
import { posaPallini } from './posa';
import { PARAMETRI_RAZZA, type Fisso, type Misure, type ParametriRazza, type Pezzo, type PuntoCucito, type Risultato, type Sfumatura, type Tondino } from './tipi';

export * from './tipi';
export { pezzoDa, rettangolo } from './geo';

/** Se il segmento a-b e' un passaggio restituisce il pallino da cui parte, altrimenti -1 (e' dentro un cordoncino). */
export function daDiPassaggio(a: PuntoCucito, b: PuntoCucito): number {
  if (a.tipo === 't') return a.prima as number;
  if (b.tipo === 't') return b.prima as number;
  return a.tond !== b.tond ? Math.min(a.tond, b.tond) : -1;
}

/** Oltre questa larghezza il cordoncino cede (R23, `satinMaxWidthMm` della Costituzione §3.7). */
const SATIN_MAX_MM = 8;

export function costruisci(pz: Pezzo, parziali: Partial<ParametriRazza> = {}, fissi: Fisso[] = [], sfumature: Sfumatura[] = []): Risultato {
  const t0 = Date.now();
  const par: ParametriRazza = { ...PARAMETRI_RAZZA, ...parziali };
  if (par.diamMaxMm < par.diamMinMm) par.diamMaxMm = par.diamMinMm;

  // 1-2. il campo e la posa
  const mappa = new MappaDistanze(pz, 1);
  const campo = creaCampo(pz, par, fissi, sfumature, mappa);
  const posa = posaPallini(pz, par, campo, fissi, mappa);
  const tondini = posa.tondini;
  if (!tondini.length) return risultatoVuoto(par, pz, posa.avvisi, Date.now() - t0);

  // 3. l'ordine
  const ordine = ordinaPallini(tondini, pz, par);
  if (par.modoAngolo === 'percorso') angoliSulPercorso(tondini, ordine);
  const ord = ordine.map((i) => tondini[i]);

  // 4. per ogni pallino, le quattro varianti (da che capo, da che lato) e il loro ingresso/uscita
  const raggioGriglia = Math.max(...ord.map((o) => 2 * o.a)) + Math.max(0, par.gapMm);
  const gr = new Griglia(raggioGriglia);
  ord.forEach((o, i) => gr.aggiungi(i, o.cx, o.cy));
  const varianti = ord.map((o) => {
    const v: Point[][] = [];
    for (const inv of [false, true]) for (const sp of [false, true]) v.push(puntiCordoncino(o, par, inv, sp).map(puntoSullaGriglia));
    return v;
  });
  // Viterbi: la scelta delle varianti che rende minimo il passaggio PIU' VISTO, non il piu' corto — un passaggio
  // lungo che finisce sotto il prossimo pallino costa meno di uno corto che attraversa il fondo.
  const n = ord.length;
  const costoMin = new Float64Array(n * 4), da = new Uint8Array(n * 4);
  for (let k = 1; k < n; k++) {
    for (let w = 0; w < 4; w++) {
      const ing = varianti[k][w][0];
      let best = Infinity, bv = 0;
      for (let v = 0; v < 4; v++) {
        const us = varianti[k - 1][v][varianti[k - 1][v].length - 1];
        const via = viaPassaggio(par, gr, ord, k - 1, k, us, ing);
        const m = vistaSopra(par, gr, ord, k - 1, [us, ...via, ing], 0.1);
        const c = costoMin[(k - 1) * 4 + v] + 10 * m.vista + par.pesoSopra * m.sopra + 0.3 * m.tot;
        if (c < best) { best = c; bv = v; }
      }
      costoMin[k * 4 + w] = best; da[k * 4 + w] = bv;
    }
  }
  const scelta = new Array<number>(n).fill(0);
  let bw = 0, bc = Infinity;
  for (let w = 0; w < 4; w++) if (costoMin[(n - 1) * 4 + w] < bc) { bc = costoMin[(n - 1) * 4 + w]; bw = w; }
  scelta[n - 1] = bw;
  for (let k = n - 1; k > 0; k--) scelta[k - 1] = da[k * 4 + scelta[k]];

  // 5. i passaggi: per ogni giuntura la strada meno visibile
  const grezzo: PuntoCucito[] = [];
  for (let k = 0; k < n; k++) {
    const pts = varianti[k][scelta[k]];
    if (k > 0) {
      const E = grezzo[grezzo.length - 1].p, N = pts[0];
      for (const v of viaPassaggio(par, gr, ord, k - 1, k, E, N)) grezzo.push({ p: puntoSullaGriglia(v), tond: k, tipo: 't', prima: k - 1 });
    }
    for (const p of pts) grezzo.push({ p, tond: k, tipo: 's' });
  }
  // il minimo (R3) DOPO il collegamento: cade il punto che resta troppo vicino al precedente
  let caduti = 0;
  const flusso: PuntoCucito[] = [];
  for (let i = 0; i < grezzo.length; i++) {
    const c = grezzo[i];
    if (flusso.length) {
      const l = flusso[flusso.length - 1];
      if (Math.hypot(c.p.x - l.p.x, c.p.y - l.p.y) < par.minStitchMm) {
        caduti++;
        if (i < grezzo.length - 1) continue;
        flusso.pop(); // l'ultimo punto del ricamo non si perde: cade quello prima
      }
    }
    flusso.push(c);
  }
  // il massimo (R4): un tratto di passaggio oltre `maxStitchMm` si suddivide
  const punti: PuntoCucito[] = [];
  for (let i = 0; i < flusso.length; i++) {
    const c = flusso[i];
    if (i > 0) {
      const dap = daDiPassaggio(flusso[i - 1], c);
      if (dap >= 0) {
        const a = flusso[i - 1].p, d = Math.hypot(c.p.x - a.x, c.p.y - a.y);
        const m = Math.ceil(d / par.maxStitchMm);
        for (let q = 1; q < m; q++) punti.push({ p: puntoSullaGriglia({ x: a.x + ((c.p.x - a.x) * q) / m, y: a.y + ((c.p.y - a.y) * q) / m }), tond: c.tond, tipo: 't', prima: dap });
      }
    }
    punti.push(c);
  }
  const avvisi = [...posa.avvisi];
  const larghi = ord.filter((o) => 2 * o.b > SATIN_MAX_MM + 0.2).length;
  if (larghi) avvisi.push(`${larghi} pallini hanno il cordoncino piu' largo di ${SATIN_MAX_MM} mm: il punto lungo si allenta (R23, satinMaxWidthMm). Abbassa il diametro massimo o l'aspetto.`);
  return { par, pezzo: pz, tondini: ord, punti, misure: misura(par, pz, ord, punti, gr, caduti, Date.now() - t0), avvisi };
}

function risultatoVuoto(par: ParametriRazza, pz: Pezzo, avvisi: string[], ms: number): Risultato {
  const vuote: Misure = {
    tondini: 0, copertoPercento: 0, punti: 0, filoM: 0, filoSatinM: 0, filoPassaggiM: 0, passaggi: 0, passaggiMediana: 0, passaggiMax: 0,
    sottoM: 0, sopraM: 0, vistaM: 0, fuoriSagoma: 0, vistaGiuntura: { mediana: 0, p90: 0, max: 0, sotto06: 0, oltre2: 0, oltre5: 0, giunture: 0 },
    puntiSottoMinimo: 0, puntoMin: 0, puntoMax: 0, caduti: 0, millisecondi: ms,
  };
  return { par, pezzo: pz, tondini: [], punti: [], misure: vuote, avvisi: [...avvisi, 'Nessun pallino entra nel pezzo con questi parametri.'] };
}

// ---------------------------------------------------------------- le misure

/** Le misure del ricamo, e per ogni passaggio se resta in vista (`punto.vista`: il segmento che ARRIVA li'). */
function misura(par: ParametriRazza, pz: Pezzo, t: Tondino[], punti: PuntoCucito[], g: Griglia, caduti: number, ms: number): Misure {
  const raggio = Math.max(...t.map((o) => 2 * o.a));
  let filoSatin = 0, filoPass = 0, sotto = 0, sopra = 0, vista = 0, puntoMin = Infinity, puntoMax = 0, sottoMin = 0, fuoriSagoma = 0;
  const pass: number[] = [];
  const vistaDa = new Map<number, number>();
  const fuoriDa = new Set<number>();
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1], b = punti[i];
    const d = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y);
    puntoMin = Math.min(puntoMin, d); puntoMax = Math.max(puntoMax, d);
    if (d < par.minStitchMm - 1e-9) sottoMin++;
    const dap = daDiPassaggio(a, b);
    if (dap < 0) { filoSatin += d; continue; }
    filoPass += d; pass.push(d);
    if (!fuoriDa.has(dap) && !segmentoDentroPezzo(pz, a.p, b.p)) { fuoriDa.add(dap); fuoriSagoma++; }
    const m = Math.max(1, Math.ceil(d / 0.05));
    let vistaQui = 0;
    for (let q = 0; q < m; q++) {
      const x = a.p.x + ((b.p.x - a.p.x) * (q + 0.5)) / m, y = a.p.y + ((b.p.y - a.p.y) * (q + 0.5)) / m;
      let so = false, sp = false;
      for (const j of g.vicini(x, y, raggio)) {
        if (!dentro(t[j], x, y, par.profilo)) continue;
        if (j > dap) so = true; else sp = true;
      }
      const l = d / m;
      if (so) sotto += l; else if (sp) sopra += l; else { vista += l; vistaQui += l; }
    }
    if (vistaQui > 0) { vistaDa.set(dap, (vistaDa.get(dap) ?? 0) + vistaQui); if (vistaQui > 0.3) b.vista = true; }
  }
  const vg: number[] = []; for (let k = 0; k < t.length - 1; k++) vg.push(vistaDa.get(k) ?? 0);
  vg.sort((x, y) => x - y);
  const qv = (f: number): number => (vg.length ? vg[Math.min(vg.length - 1, Math.floor(f * (vg.length - 1)))] : 0);
  pass.sort((x, y) => x - y);
  const qq = (f: number): number => (pass.length ? pass[Math.min(pass.length - 1, Math.floor(f * (pass.length - 1)))] : 0);
  const areaTond = t.reduce((s, o) => s + areaTondino(o, par.profilo), 0);
  return {
    tondini: t.length, copertoPercento: (100 * areaTond) / (areaPezzo(pz) || 1), punti: punti.length,
    filoM: (filoSatin + filoPass) / 1000, filoSatinM: filoSatin / 1000, filoPassaggiM: filoPass / 1000,
    passaggi: pass.length, passaggiMediana: qq(0.5), passaggiMax: pass.length ? pass[pass.length - 1] : 0,
    sottoM: sotto / 1000, sopraM: sopra / 1000, vistaM: vista / 1000,
    fuoriSagoma,
    vistaGiuntura: { mediana: qv(0.5), p90: qv(0.9), max: qv(1), sotto06: vg.filter((v) => v <= 0.6).length, oltre2: vg.filter((v) => v > 2).length, oltre5: vg.filter((v) => v > 5).length, giunture: vg.length },
    puntiSottoMinimo: sottoMin, puntoMin: puntoMin === Infinity ? 0 : puntoMin, puntoMax, caduti, millisecondi: ms,
  };
}

// ---------------------------------------------------------------- l'export

/**
 * Il ricamo come layer d'export: UN solo tracciato continuo, senza salti (R6 vale solo per l'SVG, dove `buildSvg`
 * lo spezza). Le coordinate sono quelle del pezzo, in mm reali (R1).
 */
export function stratiDaRisultato(r: Risultato): ExportLayer[] {
  if (!r.punti.length) return [];
  return [{ id: 'razza', color: '#2b2b2b', polylines: [r.punti.map((q) => ({ x: q.p.x, y: q.p.y }))], strokeMm: 0.3 }];
}

/** Il tracciato con l'origine spostata a un multiplo di 0,1 mm: se no il centraggio del DST ri-arrotonda e il minimo non tiene piu'. */
export function stratiPerDst(r: Risultato): { layers: ExportLayer[]; cx: number; cy: number } {
  const l = stratiDaRisultato(r);
  if (!l.length) return { layers: l, cx: 0, cy: 0 };
  const p = r.pezzo;
  const cx = sullaGriglia((p.minX + p.maxX) / 2), cy = sullaGriglia((p.minY + p.maxY) / 2);
  return { layers: [{ ...l[0], polylines: l[0].polylines.map((pl) => pl.map((q) => ({ x: sullaGriglia(q.x - cx), y: sullaGriglia(q.y - cy) }))) }], cx, cy };
}

/** Il progetto, per riaprirlo da un SVG o da un DST (R9/R27): parametri, pallini fissi, sfumature e il pezzo. */
export interface ProgettoRazza {
  rgProject: 'razza';
  version: string;
  params: ParametriRazza;
  fissi: Fisso[];
  sfumature: Sfumatura[];
  contorno: Point[];
  vuoti: Point[][];
}

export const VERSIONE_RAZZA = '0.1.0';

const arrotonda = (p: Point): Point => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });

export function progetto(par: ParametriRazza, pz: Pezzo, fissi: Fisso[], sfumature: Sfumatura[]): ProgettoRazza {
  return { rgProject: 'razza', version: VERSIONE_RAZZA, params: par, fissi, sfumature, contorno: pz.contorno.map(arrotonda), vuoti: pz.vuoti.map((v) => v.map(arrotonda)) };
}

/** Rilegge un progetto dai metadati di un SVG o di un DST, scartando quello che non e' di questo tool o e' rotto. */
export function leggiProgetto(meta: Record<string, unknown> | null): ProgettoRazza | null {
  if (!meta || meta.rgProject !== 'razza') return null;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const pt = (v: unknown): v is Point => !!v && typeof v === 'object' && num((v as Point).x) && num((v as Point).y);
  const poly = (v: unknown): v is Point[] => Array.isArray(v) && v.every(pt);
  const params: ParametriRazza = { ...PARAMETRI_RAZZA };
  if (meta.params && typeof meta.params === 'object') {
    for (const k of Object.keys(PARAMETRI_RAZZA) as Array<keyof ParametriRazza>) {
      const v = (meta.params as Record<string, unknown>)[k];
      if (v !== undefined && typeof v === typeof PARAMETRI_RAZZA[k]) (params as unknown as Record<string, unknown>)[k] = v;
    }
  }
  const fissi = Array.isArray(meta.fissi) ? (meta.fissi as unknown[]).filter((f): f is Fisso => !!f && num((f as Fisso).x) && num((f as Fisso).y) && num((f as Fisso).diamMm)) : [];
  const sfumature = Array.isArray(meta.sfumature)
    ? (meta.sfumature as unknown[]).filter((s): s is Sfumatura => !!s && pt((s as Sfumatura).a) && pt((s as Sfumatura).b) && num((s as Sfumatura).diamAMm) && num((s as Sfumatura).diamBMm))
    : [];
  const contorno = poly(meta.contorno) ? meta.contorno : [];
  const vuoti = Array.isArray(meta.vuoti) ? (meta.vuoti as unknown[]).filter(poly) : [];
  return { rgProject: 'razza', version: String(meta.version ?? ''), params, fissi, sfumature, contorno, vuoti };
}


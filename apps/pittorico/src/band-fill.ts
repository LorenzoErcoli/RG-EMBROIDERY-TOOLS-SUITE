// IL RIEMPIMENTO A FRONTI — la contraddizione si spezza in fasce in cui non conta.
//
// Il punto fermo (vedi `BRIEFING-RASO-OMOGENEO/`): su un campo di direzione qualunque, «corse che
// seguono la direzione» e «corse a distanza costante» non possono essere vere tutte e due. Due corse
// vicine che seguono il campo si allontanano al ritmo della DIVERGENZA del campo: dopo un tratto L la
// loro distanza e' s·exp(∫div t). Vicino a un bordo curvo di raggio R la divergenza e' 1/R, quindi la
// deriva e' L/R. Con fasce larghe 30 mm e raggi di 20-40 mm viene da 2× a 4× — ed e' esattamente il
// 3,6× che si misurava. Il difetto non era un caso: era la larghezza della fascia divisa per il raggio.
//
// Allora la contraddizione si SPEZZA. Si parte dalla rotaia e si segue il campo, ma ogni Δ di cammino
// ci si ferma su un FRONTE — la curva fatta dai punti di tutte le corse a quella lunghezza d'arco —
// e su quel fronte si RISEMINA a spaziatura esatta. Dentro una fascia la spaziatura deriva al piu' di
// e^(Δ/R); sul fronte torna quella chiesta. E' il cuneo e la troncatura del riempimento dalla rotaia
// fatti in una volta sola e per tutta la larghezza, invece che a coppie: dove il fronte si e'
// allargato la risemina mette corse in piu', dove si e' stretto ne mette di meno.
//
// La direzione resta quella del CAMPO ARMONICO A LINEE — perpendicolare a tutti i bordi di colore,
// libero sulle testate. Il primo tentativo usava una funzione scalare da una rotaia sola, e il
// disegno l'ha bocciato prima dei numeri: su una macchia con un bordo di colore corto la direzione
// vorticava dove il disegno non vortica. Il campo a linee, nel confronto a occhio, segue tutti i
// bordi. Le fasce servono a riseminare, non a decidere la direzione.
//
// La cucitura fra due fasce e' il punto delicato ed e' trattata come nel «long and short»: i semi
// di un fronte sono sfalsati di mezzo passo rispetto al precedente, e ogni corsa sconfina oltre il
// fronte di una quantita' diversa, decisa da un hash della posizione. La giunzione non e' una
// linea, e' una zona di denti che si incastrano.
//
// Quello che la spazzata non raggiunge — l'ombra dietro un foro, l'angolo che nessuna linea di
// campo attraversa partendo dalla rotaia — lo chiude la stessa passata a setaccio del riempimento
// dalla rotaia. Quanto ha dovuto aggiungere e' un numero che si restituisce: se e' tanto, la
// rotaia era sbagliata.
//
// Nessun DOM: si prova in Node.

import { type Point, type Polyline, type Region, pointInRegion, resampleUniform } from '@rg/core';
import type { DirectionField } from './field';
import { attraversa, passiLungo, disturbo, chiudiVuoti, versoDentro, Occupato } from './rail-fill';
import { regionBounds } from '@rg/core';
import { rasterizza } from '@rg/core';

export interface BandFillOptions {
  /** Passo fra due corse (R22 `densitySpacingMm`). */
  spacingMm: number;
  /** Passo massimo lungo la corsa (R4). */
  maxStitchMm?: number;
  /**
   * La deriva massima ammessa dentro una fascia: |ln(spaziatura finale / iniziale)|. Default 0,2.
   * E' l'unico numero che decide la geometria: la spaziatura, dentro una fascia, resta in
   * [s·e^-θ, s·e^θ] — con 0,2, fra 0,82 e 1,22 volte il passo.
   */
  derivaMassima?: number;
  /** Il cammino di una fascia, in mm, da cui si parte; si accorcia da solo se la deriva e' troppa. Default 4. */
  fasciaMm?: number;
  /** Sotto questo cammino non si spezza piu': una fascia da un passo non e' un raso. Default 3 passi. */
  fasciaMinimaMm?: number;
  /** Di quanto una corsa sconfina oltre il fronte, al massimo, in mm. Default: il passo. */
  sconfinaMm?: number;
  /** Se chiudere a setaccio i vuoti che la spazzata non raggiunge. Default si'. */
  chiudiVuoti?: boolean;
}

export interface BandFillResult {
  /** Le corse, fascia per fascia, e in ordine lungo il fronte dentro ogni fascia. */
  runs: Polyline[];
  /** Quante fasce (fronti) sono servite. */
  fasce: number;
  /** Il cammino di fascia con cui ci si e' fermati, in mm. */
  fasciaMm: number;
  /** La deriva misurata, fascia per fascia (90° percentile fra semi vicini). */
  derivaPerFascia: number[];
  /** Quante corse ha dovuto aggiungere la chiusura dei vuoti: se e' tanto, la rotaia era sbagliata. */
  chiusure: number;
  /** Quante rotaie sono servite: la prima piu' quelle nate dal bordo dello scoperto. */
  rotaie: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const lunghezza = (l: Polyline): number => {
  let m = 0;
  for (let i = 1; i < l.length; i++) m += dist(l[i - 1], l[i]);
  return m;
};

/**
 * Distanza (isotropa, di chamfer) dalle celle a zero, dentro la maschera, a spazzate. Serve a
 * trovare il punto piu' profondo di un vuoto: la precisione della cella basta.
 */
function chamfer(dentro: Uint8Array, D: Float32Array, cols: number, rows: number, cella: number): void {
  const d1 = cella, d2 = cella * Math.SQRT2;
  for (let giro = 0; giro < 32; giro++) {
    let cambiato = false;
    for (let dir = 0; dir < 2; dir++) {
      const r0 = dir === 0 ? 0 : rows - 1, r1 = dir === 0 ? rows : -1, dr = dir === 0 ? 1 : -1;
      const c0 = dir === 0 ? 0 : cols - 1, c1 = dir === 0 ? cols : -1, dc = dir === 0 ? 1 : -1;
      for (let r = r0; r !== r1; r += dr) {
        for (let c = c0; c !== c1; c += dc) {
          const i = r * cols + c;
          if (!dentro[i]) continue;
          let v = D[i];
          if (c > 0 && dentro[i - 1]) v = Math.min(v, D[i - 1] + d1);
          if (c + 1 < cols && dentro[i + 1]) v = Math.min(v, D[i + 1] + d1);
          if (r > 0) {
            if (dentro[i - cols]) v = Math.min(v, D[i - cols] + d1);
            if (c > 0 && dentro[i - cols - 1]) v = Math.min(v, D[i - cols - 1] + d2);
            if (c + 1 < cols && dentro[i - cols + 1]) v = Math.min(v, D[i - cols + 1] + d2);
          }
          if (r + 1 < rows) {
            if (dentro[i + cols]) v = Math.min(v, D[i + cols] + d1);
            if (c > 0 && dentro[i + cols - 1]) v = Math.min(v, D[i + cols - 1] + d2);
            if (c + 1 < cols && dentro[i + cols + 1]) v = Math.min(v, D[i + cols + 1] + d2);
          }
          if (v < D[i]) { D[i] = v; cambiato = true; }
        }
      }
    }
    if (!cambiato) break;
  }
}

/** Il punto a lunghezza d'arco `s` lungo la linea, o null se e' piu' corta. */
function aDistanza(l: Polyline, s: number): Point | null {
  let acc = 0;
  for (let i = 1; i < l.length; i++) {
    const d = dist(l[i - 1], l[i]);
    if (acc + d >= s) {
      const t = d < 1e-12 ? 0 : (s - acc) / d;
      return { x: l[i - 1].x + (l[i].x - l[i - 1].x) * t, y: l[i - 1].y + (l[i].y - l[i - 1].y) * t };
    }
    acc += d;
  }
  return null;
}

/** La linea tagliata a lunghezza d'arco `s`, col capo esattamente li'. */
function finoA(l: Polyline, s: number): Polyline {
  const out: Point[] = [l[0]];
  let acc = 0;
  for (let i = 1; i < l.length; i++) {
    const d = dist(l[i - 1], l[i]);
    if (acc + d >= s) {
      const t = d < 1e-12 ? 0 : (s - acc) / d;
      out.push({ x: l[i - 1].x + (l[i].x - l[i - 1].x) * t, y: l[i - 1].y + (l[i].y - l[i - 1].y) * t });
      return out;
    }
    out.push(l[i]);
    acc += d;
  }
  return out;
}

/**
 * Il riempimento a fronti: dalla rotaia, seguendo il campo, riseminando ogni Δ di cammino.
 */
export function buildBandFill(
  region: Region, field: DirectionField, rotaia: Polyline, opts: BandFillOptions,
): BandFillResult {
  const passo = opts.spacingMm;
  const vuoto: BandFillResult = { runs: [], fasce: 0, fasciaMm: 0, derivaPerFascia: [], chiusure: 0, rotaie: 0 };
  if (!(passo > 0) || rotaia.length < 2) return vuoto;
  const theta = opts.derivaMassima ?? 0.2;
  const sconfina = opts.sconfinaMm ?? passo;
  const fasciaMinima = opts.fasciaMinimaMm ?? passo * 3;
  const step = Math.min(passo / 2, 0.5);
  const maxPassi = 20000;

  /**
   * Una spazzata intera con cammino di fascia Δ. Restituisce le corse e la deriva per fascia; e' il
   * chiamante che decide se Δ va bene o se va accorciato.
   */
  /*
   * IL TERRITORIO VERGINE. Una corsa avanza solo dove non c'e' ancora filo: si ferma appena si
   * avvicina a filo gia' posato sotto mezzo passo. Fa due cose insieme. Ferma i FIUMI — due corse
   * che convergono si toccano, e una delle due finisce li' invece di raddoppiare la densita'. E fa
   * MORIRE il fronte: senza, le corse scivolavano lungo i bordi liberi dove il campo e' tangente e
   * il fronte girava in tondo — misurato: 400 fronti, 360 mm di cammino in un ritaglio da 90. E'
   * la stessa regola del setaccio che chiude i vuoti, applicata a tutte le corse.
   *
   * E' condiviso fra tutte le spazzate: la seconda rotaia parte dal bordo di quello che la prima
   * ha lasciato scoperto, e deve vedere il suo filo.
   */
  const occupato = new Occupato([], Math.max(passo, 0.2));
  const troppoVicino = passo * 0.45;

  /*
   * LA MAPPA DELLA COPERTURA, tenuta aggiornata mentre si cuce. Serve al ciclo dei fronti
   * sintetici per trovare il vuoto piu' profondo. La prima versione la ricalcolava a ogni giro
   * chiedendo cella per cella «c'e' filo qui vicino?» — 125.000 celle per giro, per decine di
   * giri, per venti macchie: il disegno intero e' passato da 38 a 400 secondi. Qui invece ogni
   * corsa si STAMPA sulla griglia quando nasce, e il costo e' proporzionale al filo posato.
   */
  const cellaMappa = passo * 2;
  const bb = regionBounds(region);
  const x0 = bb.minX - cellaMappa * 2, y0 = bb.minY - cellaMappa * 2;
  const cols = Math.ceil((bb.maxX - bb.minX) / cellaMappa) + 4, rows = Math.ceil((bb.maxY - bb.minY) / cellaMappa) + 4;
  const dentro = cols * rows <= 40e6 ? rasterizza(region, x0, y0, cols, rows, cellaMappa) : null;
  const copertura = new Uint8Array(cols * rows);
  const stampa = (l: Polyline): void => {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i];
      const n = Math.max(1, Math.ceil(dist(a, b) / (cellaMappa * 0.5)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const c = Math.floor((a.x + (b.x - a.x) * t - x0) / cellaMappa);
        const r = Math.floor((a.y + (b.y - a.y) * t - y0) / cellaMappa);
        // la cella e le quattro vicine: il filo copre quasi un passo per lato
        for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
          const cc = c + dc, rr = r + dr;
          if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) copertura[rr * cols + cc] = 1;
        }
      }
    }
  };

  /** Il verso di marcia da un seme: quello del campo che entra in territorio vergine. */
  const versoVergine = (p: Point): Point | null => {
    const d = field.dirAt(p);
    const prova = passo * 0.6;
    for (const v of [d, { x: -d.x, y: -d.y }]) {
      const q = { x: p.x + v.x * prova, y: p.y + v.y * prova };
      if (pointInRegion(q, region) && !occupato.entro(q, troppoVicino)) return v;
    }
    return versoDentro(field, p, region, passo * 0.35);
  };

  const spazza = (rotaiaDi: Polyline, delta: number): { runs: Polyline[]; derive: number[] } => {
    const runs: Polyline[] = [];
    const derive: number[] = [];
    // il fronte corrente: punti in ordine, col verso di marcia di ognuno
    let fronte: Array<{ p: Point; v: Point }> = [];
    for (const s of passiLungo(rotaiaDi, passo)) {
      const v = versoVergine(s.p);
      if (v) fronte.push({ p: pointInRegion(s.p, region) ? s.p : { x: s.p.x + v.x * 1e-3, y: s.p.y + v.y * 1e-3 }, v });
    }
    for (let k = 0; k < 400 && fronte.length >= 2; k++) {
      // ogni seme marcia per Δ piu' il suo sconfinamento; si ricorda dov'era a Δ esatto
      const prossimo: Array<{ p: Point; v: Point }> = [];
      const capi: Array<{ a: Point; b: Point } | null> = [];
      for (const s of fronte) {
        const extra = sconfina * (0.35 + 0.65 * disturbo(s.p.x, s.p.y));
        // si marcia solo fin dove serve: tracciare ogni volta la corsa intera fino al bordo, per
        // poi tagliarla a Δ, costava un'ora sul ritaglio — cento fronti per trecento semi per
        // cinquecento passi
        let camminato = 0, ultimo = s.p;
        const linea = attraversa(region, field, s.p, s.v, step, maxPassi, (q) => {
          camminato += dist(ultimo, q); ultimo = q;
          // i primi passi non guardano il filo: il seme sta a un passo dal vicino appena posato
          return camminato > delta + extra + step || (camminato > passo && occupato.entro(q, troppoVicino));
        });
        const lung = lunghezza(linea);
        if (lung < passo) { capi.push(null); continue; }
        const corsa = lung > delta + extra ? finoA(linea, delta + extra) : linea;
        runs.push(corsa);
        occupato.aggiungi(corsa);
        stampa(corsa);
        const aDelta = aDistanza(linea, delta);
        if (aDelta) {
          // il verso con cui prosegue: quello del tratto finale della corsa a Δ
          const prima = aDistanza(linea, Math.max(0, delta - step)) ?? linea[0];
          const vx = aDelta.x - prima.x, vy = aDelta.y - prima.y, m = Math.hypot(vx, vy);
          prossimo.push({ p: aDelta, v: m > 1e-9 ? { x: vx / m, y: vy / m } : s.v });
          capi.push({ a: s.p, b: aDelta });
        } else capi.push(null);
      }
      // la deriva della fascia: fra semi vicini arrivati tutti e due al fronte
      const d: number[] = [];
      for (let i = 0; i + 1 < capi.length; i++) {
        const p = capi[i], q = capi[i + 1];
        if (!p || !q) continue;
        const d0 = dist(p.a, q.a), d1 = dist(p.b, q.b);
        if (d0 < 1e-6) continue;
        d.push(Math.abs(Math.log(Math.max(d1, 1e-3) / d0)));
      }
      d.sort((a, b) => a - b);
      derive.push(d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.9))] : 0);
      if (prossimo.length < 2) break;

      /*
       * LA RISEMINA. Il fronte e' la polilinea dei punti a Δ, in ordine; la si ricampiona a passo
       * costante — sfalsato di mezzo passo una fascia si' e una no — e ogni nuovo seme prende il
       * verso del punto del fronte piu' vicino. Dove il fronte si e' allargato escono piu' semi di
       * quanti erano, dove si e' stretto meno: e' tutto l'accorgimento, e vale per tutta la
       * larghezza in una volta.
       *
       * Due punti del fronte quasi coincidenti — due corse che si sono incrociate — si tengono una
       * volta sola, altrimenti la risemina li conterebbe due volte.
       */
      const curva: Point[] = [prossimo[0].p];
      for (let i = 1; i < prossimo.length; i++) {
        if (dist(curva[curva.length - 1], prossimo[i].p) < passo * 0.25) continue;
        curva.push(prossimo[i].p);
      }
      if (curva.length < 2) break;
      const tutti = passiLungo(curva, passo / 2).map((x) => x.p);
      const semi = tutti.filter((_, i) => i % 2 === k % 2);
      const nuovo: Array<{ p: Point; v: Point }> = [];
      for (const s of semi) {
        if (!pointInRegion(s, region)) continue;
        let best = prossimo[0], bd = Infinity;
        for (const q of prossimo) { const dd = dist(q.p, s); if (dd < bd) { bd = dd; best = q; } }
        nuovo.push({ p: s, v: best.v });
      }
      fronte = nuovo;
    }
    return { runs, derive };
  };

  // ---- il cammino di fascia: si prova, si misura, si accorcia finche' la deriva sta sotto θ ----
  /*
   * Il cammino di fascia. L'adattamento sulla deriva misurata e' sospeso: la deriva della PRIMA
   * fascia — il ventaglio che si apre appena si lascia la rotaia — supera sempre la soglia e faceva
   * scattare Δ al minimo, cioe' fasce da tre passi e mezzo milione di corse. Ora la convergenza la
   * ferma il territorio vergine e la divergenza la cura la risemina: Δ decide solo ogni quanto si
   * risemina, e 3 mm — dieci passi — e' un compromesso da misurare, non da adattare al buio.
   */
  const delta = opts.fasciaMm ?? 3;
  void theta; void fasciaMinima;
  const primo = spazza(rotaia, delta);
  let runs = primo.runs;
  const derive = [...primo.derive];
  let fasce = primo.derive.length;

  /*
   * LE ROTAIE SUCCESSIVE — dove la spazzata muore, si tira un fronte sintetico nel vuoto.
   *
   * Su una macchia grande con un bordo di colore corto la prima spazzata copre quello che le
   * linee di campo raggiungono dalla rotaia: sul disegno intero, tinta 0 faceva 7 fronti su
   * 45.000 mm² e poi 5.689 corse venivano dal setaccio — seme per seme, in tutte e due le
   * direzioni, fermandosi dove capitava. Erano le «macchie interne» con le linee dritte che
   * Lorenzo ha visto per primo.
   *
   * Il primo rimedio — usare come rotaia il bordo dello scoperto — non poteva funzionare, ed e'
   * geometria: una spazzata copre un TUBO di linee di campo, quindi quello che resta confina col
   * coperto lungo una linea di campo. E' sempre un fianco, mai un fronte: seminarci sopra da'
   * corse parallele al filo appena posato, che il territorio vergine ferma al primo passo.
   *
   * Quindi il fronte si COSTRUISCE. Si cerca il punto piu' profondo del vuoto — quello piu'
   * lontano da qualunque filo — e da li' si traccia la PERPENDICOLARE al campo, nei due sensi,
   * fin dove il vuoto finisce. Quella curva e' un fronte vero, e da li' parte una spazzata a
   * fasce come dalla rotaia. E' quello che fa il setaccio con un seme solo, ma un seme fa un
   * pettine intero invece di una corsa. Si ripete finche' il vuoto piu' profondo non e' una
   * briciola; per quelle resta il setaccio.
   */
  const trasversale: DirectionField = {
    dirAt: (q: Point): Point => { const d = field.dirAt(q); return { x: -d.y, y: d.x }; },
  };
  let rotaieDopo = 0;
  if (dentro) {
    for (let giro = 0; giro < 400; giro++) {
      // la profondita' del vuoto: distanza dal filo, sulle celle scoperte
      const prof = new Float32Array(cols * rows).fill(Infinity);
      let scoperte = 0;
      for (let i = 0; i < prof.length; i++) {
        if (!dentro[i]) continue;
        if (copertura[i]) prof[i] = 0; else scoperte++;
      }
      if (scoperte * cellaMappa * cellaMappa < passo * passo * 40) break;
      chamfer(dentro, prof, cols, rows, cellaMappa);
      let iMax = -1, pMax = 0;
      for (let i = 0; i < prof.length; i++) if (dentro[i] && prof[i] < Infinity && prof[i] > pMax) { pMax = prof[i]; iMax = i; }
      // un vuoto meno profondo di due passi e' una briciola: tocca al setaccio
      if (iMax < 0 || pMax < passo * 2) break;
      const seme = { x: x0 + ((iMax % cols) + 0.5) * cellaMappa, y: y0 + (Math.floor(iMax / cols) + 0.5) * cellaMappa };
      // la perpendicolare al campo, nei due sensi, finche' si sta nel vuoto
      const nelVuoto = (q: Point): boolean => occupato.entro(q, passo * 0.8);
      const t0 = trasversale.dirAt(seme);
      const avanti = attraversa(region, trasversale, seme, t0, step, maxPassi, nelVuoto);
      const indietro = attraversa(region, trasversale, seme, { x: -t0.x, y: -t0.y }, step, maxPassi, nelVuoto);
      const fronte = [...indietro.slice(1).reverse(), ...avanti];
      if (lunghezza(fronte) < passo * 3) {
        // un vuoto stretto di traverso: lo si segna come coperto per non ritrovarlo e si va avanti
        occupato.aggiungi([seme, { x: seme.x + 1e-3, y: seme.y }]);
        stampa([seme, { x: seme.x + 1e-3, y: seme.y }]);
        continue;
      }
      // la spazzata, nei DUE sensi: il fronte sta in mezzo al vuoto, e il vuoto e' da tutt'e due le parti
      const prima = spazza(fronte, delta);
      const seconda = spazza(fronte, delta);
      runs = [...runs, ...prima.runs, ...seconda.runs];
      derive.push(...prima.derive, ...seconda.derive);
      fasce += prima.derive.length + seconda.derive.length;
      rotaieDopo++;
      if (!prima.runs.length && !seconda.runs.length) {
        occupato.aggiungi([seme, { x: seme.x + 1e-3, y: seme.y }]);
        stampa([seme, { x: seme.x + 1e-3, y: seme.y }]);
      }
    }
  }

  // ---- quello che nemmeno le rotaie successive hanno raggiunto ------------------------------
  let chiusure = 0;
  if (opts.chiudiVuoti ?? true) {
    const nuove = chiudiVuoti(region, field, runs, passo, passo * 0.9, step, maxPassi);
    chiusure = nuove.length;
    runs = [...runs, ...nuove];
  }

  const maxStitch = opts.maxStitchMm && opts.maxStitchMm > 0 ? opts.maxStitchMm : 0;
  const finali = runs.map((r) => (maxStitch > 0 ? resampleUniform(r, maxStitch) : r));
  return { runs: finali, fasce, fasciaMm: delta, derivaPerFascia: derive, chiusure, rotaie: 1 + rotaieDopo };
}

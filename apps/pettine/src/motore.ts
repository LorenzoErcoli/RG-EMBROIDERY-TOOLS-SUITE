// IL MOTORE DEL PUNTO PETTINE SFRANGIATO — puro: nessun file, nessun DOM, nessun `process`.
// Lo usano sia il tool nel browser (`tool.ts`) sia lo script headless (`scripts/livelli.ts`), che
// resta il banco di prova. R28: una domanda, una risposta sola — la geometria vive qui e basta.
//
// COS'E'. Da un SVG in cui Lorenzo ha raggruppato in livelli i blocchi di colore, e da una foto,
// costruisce dentro ogni gruppo («famiglia») una sola famiglia di linee di base — che non si
// incrociano, non hanno giunture e stanno a passo fisso — e ci mette sopra un pettine di denti
// rivolti verso il chiaro. Due costruzioni, scelte dall'area del gruppo:
//   * TRASLAZIONE (gruppi piccoli, fino a `traslaMaxMm2`): il muro chiaro si sposta di un passo alla
//     volta, forma identica, tagliato dove esce dal blocco. Chiesta da Lorenzo per la sfera.
//   * CRESCITA A PASSO FISSO (gruppi grandi): la regione raggiunta cresce di un passo esatto a ogni
//     giro e si arrotondano le insenature; la linea nuova sta a un passo dalla precedente ovunque.
// Poi il RAMMENDO chiude quel che resta nudo, e il DST cuce tutto a serpentina.
//
// IL RITAGLIO (`ritaglio`): il motore lavora solo dentro un rettangolo in millimetri del disegno —
// serve per gli swatch di prova, che si cuciono in pochi minuti invece che in ore. Le coordinate
// restano quelle del disegno (la foto continua a combaciare); il DST esce traslato a partire da 0,0.

import {
  type Point, type Polyline, type PixelImage,
  polygonArea, traceRegions, buildDst, type DstPath,
} from '@rg/core';
import { parseSvgPolylines } from '@rg/pattern-grammar';
// Tre primitive nate nel Punto Pittorico e usate qui tali e quali: la rasterizzazione di una
// regione, le curve di livello di un campo (marching squares + catena) e la misura di quanto e'
// larga una transizione di colore nella foto. R28 vieta la seconda copia, quindi si importano da li'
// invece di ricopiarle; sono candidate a salire in `@rg/core` (regola di crescita 1: e' il secondo
// cliente) appena qualcuno le tocca sul serio.
import { makeRegion } from '../../pittorico/src/region';
import { rasterizza, livello, incatena } from '../../pittorico/src/iso-fill';
import { larghezzaTransizione } from '../../pittorico/src/borders';

/** Il rettangolo di lavoro, in millimetri del disegno. */
export interface Riquadro { x: number; y: number; larghezza: number; altezza: number }

export interface IngressoPettine {
  /** Il contenuto del file SVG coi gruppi (un `<g id="...">` per gruppo). */
  testoSvg: string;
  /** Quanto misura davvero, in millimetri, la larghezza del disegno. */
  larghezzaRealeMm: number;
  /** La fotografia, per decidere dove un bordo stacca e dove sfuma. Senza, i denti attraversano sempre. */
  foto?: PixelImage | null;
  /** Il ritaglio: senza, tutto il pannello. */
  ritaglio?: Riquadro | null;
  /**
   * Il PROGETTO da mettere dentro le uscite (R9/R27): finisce nel DST dopo il comando di fine — la
   * macchina lo ignora, il tool lo rilegge — e in un `<metadata>` dell'SVG. Chi chiama decide cosa
   * ci va: qui non si sa niente di nomi di file e di pannelli.
   */
  progetto?: Record<string, unknown> | null;
}

export interface ParametriPettine {
  /** Distanza fra le linee di base (mm). */
  basiMm: number;
  /** Sormonto: entro tanto, verso il chiaro, il dente si cuce anche col colore più chiaro (mm). */
  sormontoMm: number;
  /** Addolcimento: millimetri di lisciatura in più per ogni millimetro di distanza dal muro. */
  addolcisciMm: number;
  /** Tetto alla lisciatura (mm). */
  lisciaMaxMm: number;
  /** Spianatura della distanza (mm): smussa le creste fra due fronti. */
  spianaMm: number;
  /** Chiusura delle insenature nella crescita a passo fisso (mm). */
  chiudiMm: number;
  /** Fino a quest'area (mm²) un gruppo va a traslazione del muro chiaro. */
  traslaMaxMm2: number;
  /**
   * Sconfinamento oltre il bordo del gruppo (mm): quanto le righe di un gruppo entrano in quello
   * accanto, perche' la giunta non resti nuda. Misurato: a 2,5 mm il 9,7% dei punti di base ha
   * un'altra riga a meno di mezzo passo — e sono bande piu' fitte e scure che si vedono nel ricamo;
   * a 1 mm scendono al 5,5% e il pannello resta coperto lo stesso (metro del filo 0,1% in tutti e due).
   */
  sconfinaMm: number;
  /** I denti: lunghezza minima e massima (mm), passo lungo la base (mm, mai sotto 1), apertura (gradi). */
  denteMinMm: number;
  denteMaxMm: number;
  passoMm: number;
  aperturaDeg: number;
  /** Sotto questa larghezza di transizione il bordo è netto e il dente si ferma (mm). */
  nettoMm: number;
  /** Mettere i denti (senza, solo le basi: si guarda la struttura). */
  denti: boolean;
  /**
   * Come si costruiscono le righe dentro un gruppo grande (i piccoli vanno sempre a traslazione):
   *   * `auto` (uguale a `geodetica`): a ogni giro si rimisura la distanza dal fronte appena cucito.
   *     Passo esatto e forma che si propaga: e' quella buona.
   *   * `crescita`: la macchia si dilata di un passo per volta (tiene il passo ma smorza la forma).
   *   * `livelli`: le curve di livello della distanza dal muro (tiene la forma ma cambia il passo).
   * Le altre due restano per poter confrontare, e perche' ognuna dice qualcosa di vero sul disegno.
   */
  modo?: 'auto' | 'geodetica' | 'crescita' | 'livelli';
  /** Colorare di rosa, nell'anteprima, le celle a più di 0,75 mm da qualunque filo. */
  mostraNudi?: boolean;
  /**
   * Disegnare i passaggi (il filo che va da una riga all'altra invece di essere tagliato). Sono filo
   * vero e vanno guardati, ma nell'anteprima sembrano rette nette anche quando nel ricamo finiranno
   * sotto qualcosa: si distinguono perché sono più sottili e trasparenti.
   */
  mostraPassaggi?: boolean;
  /** Costruire anche il DST (costa qualche secondo in più). */
  dst?: boolean;
}

export const parametriPettineDefault: ParametriPettine = {
  basiMm: 2, sormontoMm: 4, addolcisciMm: 0.15, lisciaMaxMm: 8, spianaMm: 5, chiudiMm: 3,
  traslaMaxMm2: 9000, sconfinaMm: 1,
  denteMinMm: 3, denteMaxMm: 5, passoMm: 1.5, aperturaDeg: 40, nettoMm: 2.5,
  denti: true, modo: 'auto', mostraNudi: false, mostraPassaggi: true, dst: true,
};

export interface StatistichePettine {
  larghezzaMm: number; altezzaMm: number;
  riquadro: Riquadro;
  colori: string[];
  famiglie: number; famiglieSaltate: number;
  tratti: number; trattiCorti: number; basiM: number;
  rammendi: number;
  denti: number; filoDentiM: number; dentiFermati: number; dentiAttraversano: number;
  nudoPct: number; densoPct: number; nudoFiloPct: number;
  /** La spaziatura vera fra le righe, in millimetri, e quanto spesso si stringono. */
  spaziaturaMedianaMm: number; spaziaturaDecimoMm: number;
  righeAddossoPct: number; righeAddossoStessoGruppoPct: number;
  /** Solo col DST. */
  punti: number; filoM: number; blocchi: number; salti: number; saltiM: number;
  passaggi: number; passaggiM: number; puntiCorti: number;
  /** Metri di passaggio che nessun colore successivo coprira': devono restare vicini a zero. */
  passaggiScopertiM: number;
  /** Righe cucite fuori dall'ordine di copertura: deve essere zero. */
  righeFuoriOrdine: number;
  secondi: number;
}

export interface EsitoPettine {
  /** L'anteprima del ricamo: basi e denti, un colore per tinta. */
  svg: string;
  /** La verifica: solo le basi, coi muri, le frecce del verso e le macchie del metro. */
  svgVerifica: string;
  /** Il file per la macchina, con l'origine nell'angolo del ritaglio. */
  dst: Uint8Array | null;
  statistiche: StatistichePettine;
  note: string[];
}

export function costruisciPettine(ing: IngressoPettine, par: ParametriPettine = parametriPettineDefault): EsitoPettine {
  const note: string[] = [];
  const console = { log: (s: string): void => { note.push(s); } };
  const LARGHEZZA_REALE_MM = ing.larghezzaRealeMm;
  const CELLA = 0.5;
  const BASI_MM = Math.max(0.5, par.basiMm);
  const SORM_MM = par.sormontoMm;
  const ADDOLCISCI = par.addolcisciMm;
  const LISCIA_MM = 1.5;                 // lisciatura di base (i muri sono gia' curve)
  const LISCIA_MAX = par.lisciaMaxMm;
  const SPIANA_MM = par.spianaMm;
  const CHIUDI_MM = par.chiudiMm;
  const TRASLA_MAX_MM2 = par.traslaMaxMm2;
  const ULTIMA_BASE = false;
  const RIFERIMENTO_DEG = -90;
  const SCONFINA_MM = par.sconfinaMm;
  const DENTI = par.denti;
  const DENTE_MIN = par.denteMinMm, DENTE_MAX = par.denteMaxMm;
  const PASSO_MM = Math.max(1, par.passoMm), INCL = par.aperturaDeg, NETTO_MM = par.nettoMm;
  const t0 = Date.now();

  function caso(a: number, b: number): number {
    let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const luminosita = (hex: string): number => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  // --- 1. il file --------------------------------------------------------------------------------------
  const testo = ing.testoSvg;
  const viewBox = /viewBox="([^"]+)"/.exec(testo)![1];
  const [vbW, vbH] = viewBox.split(/\s+/).slice(2).map(Number);
  const K = LARGHEZZA_REALE_MM / vbW;
  const WM = vbW * K, HM = vbH * K;
  const stili = new Map<string, string>();
  for (const m of testo.matchAll(/\.(st\d+)\s*\{[^}]*fill:\s*([^;}\s]+)/g)) stili.set(m[1], m[2]);
  interface Forma { colore: string; punti: Polyline; area: number }
  const famiglie: Array<{ nome: string; forme: Forma[] }> = [];
  for (const m of testo.matchAll(/<g id="(Livello_\d+)"[^>]*>([\s\S]*?)(?=<g id="Livello_\d+"|<\/svg>)/g)) {
    const forme: Forma[] = [];
    for (const el of m[2].matchAll(/<(path|polygon)\b[^>]*>/g)) {
      const cls = /class="(st\d+)"/.exec(el[0])?.[1];
      const colore = (cls && stili.get(cls)) || /fill="([^"]+)"/.exec(el[0])?.[1] || '#808080';
      const letto = parseSvgPolylines(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${el[0].replace(/class="st\d+"/, 'fill="#000"')}</svg>`, {});
      for (const p of letto.polylines) {
        const pl = p.map((q) => ({ x: q.x * K, y: q.y * K }));
        const area = Math.abs(polygonArea(pl));
        if (pl.length >= 3 && area > 5) forme.push({ colore, punti: pl, area });
      }
    }
    if (forme.length) famiglie.push({ nome: m[1], forme });
  }
  const colori = [...new Set(famiglie.flatMap((f) => f.forme.map((x) => x.colore)))].sort((a, b) => luminosita(b) - luminosita(a));
  const rango = new Map(colori.map((c, i) => [c, i]));
  console.log(`${WM.toFixed(1)} × ${HM.toFixed(1)} mm · ${famiglie.length} gruppi · ${colori.join(' · ')}`);

  // --- 2. la griglia ---------------------------------------------------------------------------------------
  // IL MARGINE ATTORNO AL PANNELLO: la griglia comincia MARG mm prima del disegno, cosi' basi e denti
  // possono sconfinare anche oltre il bordo del pannello (il metro diceva: i buchi stanno quasi tutti
  // li', 4000 celle sul bordo contro 200 sulle giunte). Il pannello va ricamato fino al bordo e oltre.
  const MARG = SCONFINA_MM + SPIANA_MM + 1;   // sconfinamento + raggio di spianatura + 1
  // IL RIQUADRO DI LAVORO: tutto il disegno, o il ritaglio chiesto (per gli swatch). Le coordinate
  // restano quelle del disegno — la foto combacia comunque — e solo il DST esce traslato a 0,0.
  const RQ: Riquadro = ing.ritaglio
    ? {
        x: Math.max(0, Math.min(ing.ritaglio.x, WM)),
        y: Math.max(0, Math.min(ing.ritaglio.y, HM)),
        larghezza: Math.max(5, Math.min(ing.ritaglio.larghezza, WM - Math.max(0, Math.min(ing.ritaglio.x, WM)))),
        altezza: Math.max(5, Math.min(ing.ritaglio.altezza, HM - Math.max(0, Math.min(ing.ritaglio.y, HM)))),
      }
    : { x: 0, y: 0, larghezza: WM, altezza: HM };
  const X0 = RQ.x, Y0 = RQ.y, X1 = RQ.x + RQ.larghezza, Y1 = RQ.y + RQ.altezza;
  const ORIGX = X0 - MARG, ORIGY = Y0 - MARG;
  const COLS = Math.ceil((RQ.larghezza + 2 * MARG) / CELLA) + 2, ROWS = Math.ceil((RQ.altezza + 2 * MARG) / CELLA) + 2;
  const tinta = new Int8Array(COLS * ROWS).fill(-1);
  const famDi = new Int16Array(COLS * ROWS).fill(-1);
  famiglie.forEach((f, fi) => {
    for (const s of [...f.forme].sort((a, b) => b.area - a.area)) {
      const dentro = rasterizza(makeRegion(s.punti, []), ORIGX, ORIGY, COLS, ROWS, CELLA);
      const r = rango.get(s.colore)!;
      for (let i = 0; i < dentro.length; i++) if (dentro[i] && (famDi[i] !== fi || tinta[i] < r)) { tinta[i] = r; famDi[i] = fi; }
    }
  });
  // GLI SPAZI VUOTI FRA I GRUPPI. Fra una forma e l'altra del vettoriale restano fessure senza tinta,
  // che nessuna famiglia copre e che il metro non contava: erano i canali bianchi fra le famiglie.
  // Ogni cella vuota circondata dal disegno prende la famiglia (e la tinta) della vicina - chi viene
  // dopo copre, quindi vince la piu' scura fra le vicine. Si misura prima quanto erano.
  {
    let vuote = 0, riempite = 0;
    // «dentro il disegno» = entro 6 mm da una cella colorata (il bordo esterno della foto non conta)
    const r = Math.round(6 / CELLA);
    const vicinoAlDisegno = (i: number): boolean => {
      const c = i % COLS, rr = Math.floor(i / COLS);
      for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) {
        const x = c + dx, y = rr + dy;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && famDi[y * COLS + x] >= 0) return true;
      }
      return false;
    };
    // ...e dentro il rettangolo del pannello: il margine attorno resta senza tinta (e' fuori dal ricamo)
    const nelPannello = (i: number): boolean => { const x = ORIGX + (i % COLS) * CELLA, y = ORIGY + Math.floor(i / COLS) * CELLA; return x >= X0 && y >= Y0 && x <= X1 && y <= Y1; };
    for (let i = 0; i < COLS * ROWS; i++) if (famDi[i] < 0 && nelPannello(i) && vicinoAlDisegno(i)) vuote++;
    for (let passata = 0; passata < r; passata++) {
      const nuovaFam = new Int16Array(famDi), nuovaTinta = new Int8Array(tinta);
      for (let y = 1; y + 1 < ROWS; y++) for (let x = 1; x + 1 < COLS; x++) {
        const i = y * COLS + x;
        if (famDi[i] >= 0 || !nelPannello(i)) continue;
        let best = -1;
        for (const j of [i - 1, i + 1, i - COLS, i + COLS]) if (famDi[j] >= 0 && (best < 0 || tinta[j] > tinta[best])) best = j;
        if (best >= 0) { nuovaFam[i] = famDi[best]; nuovaTinta[i] = tinta[best]; riempite++; }
      }
      famDi.set(nuovaFam); tinta.set(nuovaTinta);
    }
    console.log(`spazi vuoti fra i gruppi: ${(vuote * CELLA * CELLA).toFixed(0)} mm² (${((vuote * CELLA * CELLA) / (RQ.larghezza * RQ.altezza) * 100).toFixed(1)}% del pannello) · riempiti ${(riempite * CELLA * CELLA).toFixed(0)} mm²`);
  }
  const cella = (p: Point): number => {
    const c = Math.round((p.x - ORIGX) / CELLA), r = Math.round((p.y - ORIGY) / CELLA);
    return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
  };
  const tintaIn = (p: Point): number => { const i = cella(p); return i < 0 ? -1 : tinta[i]; };
  const famIn = (p: Point): number => { const i = cella(p); return i < 0 ? -1 : famDi[i]; };
  // la foto, per dire dove un bordo fra famiglie stacca (il dente si ferma) e dove sfuma (attraversa)
  const img = ing.foto ?? null;
  const mmPerPx = img ? LARGHEZZA_REALE_MM / img.width : 1;
  const sfumaQui = (p: Point, n: Point): boolean => {
    if (!img) return true;
    const tr = larghezzaTransizione(img, mmPerPx, p, n, { raggioMm: 6 });
    return tr !== null && tr.larghezzaMm >= NETTO_MM;
  };
  // LA DISTANZA DAL MURO DI TUTTO IL PANNELLO, cella per cella. Dentro una famiglia serve a
  // costruire; qui fuori serve ai PASSAGGI: una cella con distanza maggiore di quella della riga
  // che si sta cucendo non e' ancora stata ricamata, quindi il filo che ci passa sopra lo
  // copriranno le righe che mancano. E' la differenza fra un passaggio che corre nella striscia
  // fra due righe (invisibile) e uno che le attraversa in diagonale (a vista).
  const distDaMuro = new Float32Array(COLS * ROWS).fill(-1);
  // DOVE C'E' GIA' UNA BASE. Un filo di passaggio che ripassa sopra una base esistente si confonde
  // con lei e sparisce: e' la strada buona per andare da un pezzo all'altro senza tagliare il campo.
  const soprafilo = new Uint8Array(COLS * ROWS);
  const stendi = (l: Point[]): void => {
    for (let k = 1; k < l.length; k++) {
      const a = l[k - 1], b = l[k];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELLA / 2)));
      for (let t = 0; t <= n; t++) {
        const i = cella({ x: a.x + ((b.x - a.x) * t) / n, y: a.y + ((b.y - a.y) * t) / n });
        if (i >= 0) soprafilo[i] = 1;
      }
    }
  };
  const perColoreDenti: string[][] = [];
  let dentiTot = 0, filoMm = 0, fermati = 0, attraversano = 0;
  // I TRATTI, strutturati, per il DST: base, denti (radice, punta) e denti di sormonto per colore piu' chiaro
  interface Tratto { col: number; fi: number; id: number; d: number; base: Point[]; denti: Array<[Point, Point]>; sotto: Map<number, Array<[Point, Point]>> }
  const trattiTutti: Tratto[] = [];
  const cucito: Point[][] = [];   // tutto cio' che si cuce (basi e denti), per il metro del filo
  // LA COPERTURA, tenuta aggiornata mentre si cuce: celle da 0,5 mm entro 0,75 mm da un filo. Serve al
  // metro finale e al rammendo per famiglia.
  const G = 0.5;
  const GW = Math.ceil(RQ.larghezza / G) + 1, GH = Math.ceil(RQ.altezza / G) + 1;
  const gx0 = (p: Point): number => Math.round((p.x - X0) / G), gy0 = (p: Point): number => Math.round((p.y - Y0) / G);
  const gPunto = (x: number, y: number): Point => ({ x: X0 + x * G, y: Y0 + y * G });
  const cop = new Uint8Array(GW * GH);
  const RF = Math.ceil(0.75 / G);
  const cuci = (seg: Point[]): void => {
    cucito.push(seg);
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1], b = seg[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / G));
      for (let k = 0; k <= n; k++) {
        const cx = gx0({ x: a.x + ((b.x - a.x) * k) / n, y: 0 }), cy = gy0({ x: 0, y: a.y + ((b.y - a.y) * k) / n });
        for (let dy = -RF; dy <= RF; dy++) for (let dx = -RF; dx <= RF; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < GW && y < GH && dx * dx + dy * dy <= RF * RF) cop[y * GW + x] = 1; }
      }
    }
  };

  // --- 3. geometria ------------------------------------------------------------------------------------------
  /**
   * LE FORCINE: dove una curva di livello gira attorno a una cresta della distanza (due fronti che si
   * incontrano) i due bracci stanno a pochi decimi l'uno dall'altro, e la lisciatura li schiacciava in
   * una base sola che passa due volte e non arriva al bordo. Qui la catena si spezza dove la direzione
   * gira di piu' di 100 gradi nel giro di 2 mm: ogni braccio diventa una base sua, che finisce alla cresta.
   */
  /** I COLORI SI STABILIZZANO lungo una base: una tinta che dura meno di `min` punti (2 mm) non spezza
   *  la linea, prende il colore del tratto che la precede (o che la segue, in testa). Senza, ogni
   *  striscia di una cella al confine fra due colori faceva un tratto di base da due punti: 2800
   *  tratti sotto 1,5 mm, ognuno coi suoi denti. */
  function stabilizza(cols: number[], min: number): number[] {
    const out = cols.slice();
    let i = 0;
    while (i < out.length) {
      let j = i;
      while (j < out.length && out[j] === out[i]) j++;
      if (j - i < min) {
        const prima = i > 0 ? out[i - 1] : j < out.length ? out[j] : out[i];
        for (let k = i; k < j; k++) out[k] = prima;
      }
      i = j;
    }
    return out;
  }
  const lunghezza = (l: Point[]): number => { let t = 0; for (let i = 1; i < l.length; i++) t += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); return t; };
  function spezzaAlleForcine(l: Point[], passo: number): Point[][] {
    const w = Math.max(1, Math.round(2 / passo));
    const out: Point[][] = [];
    let da = 0;
    for (let i = w; i + w < l.length; i++) {
      const ax = l[i].x - l[i - w].x, ay = l[i].y - l[i - w].y, bx = l[i + w].x - l[i].x, by = l[i + w].y - l[i].y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) continue;
      if ((ax * bx + ay * by) / (la * lb) < Math.cos((100 * Math.PI) / 180)) { out.push(l.slice(da, i + 1)); da = i; i += w; }
    }
    out.push(l.slice(da));
    return out;
  }
  function ricampiona(l: Point[], passo: number): Point[] {
    const out: Point[] = [l[0]];
    let acc = 0;
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < 1e-9) continue;
      let pos = 0;
      while (acc + (d - pos) >= passo) { pos += passo - acc; out.push({ x: a.x + ((b.x - a.x) * pos) / d, y: a.y + ((b.y - a.y) * pos) / d }); acc = 0; }
      acc += d - pos;
    }
    return out;
  }
  function liscia(l: Point[], sigmaMm: number, passo: number): Point[] {
    if (sigmaMm <= 0 || l.length < 3) return l;
    const raggio = Math.ceil((sigmaMm * 3) / passo);
    const pesi: number[] = [];
    for (let k = -raggio; k <= raggio; k++) pesi.push(Math.exp(-((k * passo) ** 2) / (2 * sigmaMm * sigmaMm)));
    // I CAPI: la linea si prolunga per riflessione (punto per punto attorno al capo) prima di lisciarla,
    // cosi' il capo resta dov'e'. Con l'indice bloccato al capo la media lo tirava indietro di ~0,4 sigma:
    // con sigma = 1,5 + 0,15·d, a 40 mm dal muro le basi finivano 3 mm prima del bordo (striscia nuda).
    const n = l.length, p0 = l[0], pn = l[n - 1];
    const est = (i: number): Point => {
      if (i < 0) { const q = l[Math.min(n - 1, -i)]; return { x: 2 * p0.x - q.x, y: 2 * p0.y - q.y }; }
      if (i >= n) { const q = l[Math.max(0, 2 * (n - 1) - i)]; return { x: 2 * pn.x - q.x, y: 2 * pn.y - q.y }; }
      return l[i];
    };
    return l.map((_, i) => {
      let sx = 0, sy = 0, sw = 0;
      for (let k = -raggio; k <= raggio; k++) {
        const q = est(i + k);
        sx += q.x * pesi[k + raggio]; sy += q.y * pesi[k + raggio]; sw += pesi[k + raggio];
      }
      return { x: sx / sw, y: sy / sw };
    });
  }
  const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  /**
   * IL DISEGNO NON DEVE UNIRE CIO' CHE IL FILO NON UNISCE (Lorenzo, 2026-09-10: «vedo quando genero
   * una cosa strana in basso delle diagonali che attraversano le onde»). Le corse di denti sono
   * elenchi con dei buchi — il sormonto c'e' solo dove sotto passa una tinta piu' chiara, quindi
   * salta da una zona all'altra — e `via()` li univa con una retta lunga anche 50 mm, che nel
   * ricamo non esiste: nel DST li' il filo salta. Qui la polilinea si spezza dove il salto supera
   * la soglia, e l'anteprima torna a dire la verita'.
   */
  const viaSpezzato = (pt: Point[], sogliaMm: number): string => {
    let d = '', staccato = true;
    for (let i = 0; i < pt.length; i++) {
      if (i && Math.hypot(pt[i].x - pt[i - 1].x, pt[i].y - pt[i - 1].y) > sogliaMm) staccato = true;
      d += `${staccato ? 'M' : 'L'}${pt[i].x.toFixed(1)} ${pt[i].y.toFixed(1)}`;
      staccato = false;
    }
    return d;
  };

  // --- 4. famiglia per famiglia ---------------------------------------------------------------------------------
  const perColore: string[][] = colori.map(() => []);
  colori.forEach(() => perColoreDenti.push([]));
  const sotto: string[][] = colori.map(() => []);
  const muriA: string[] = [], muriB: string[] = [], frecce: string[] = [];
  const lineeFinali: Array<{ id: number; punti: Point[] }> = [];   // id = il livello: due tratti dello stesso livello non sono due linee
  let idLivello = 0;
  let rammendi = 0;
  let famOk = 0, famSaltate = 0;

  famiglie.forEach((f, fi) => {
    const maschera = new Uint8Array(COLS * ROWS);
    let celle = 0;
    for (let i = 0; i < COLS * ROWS; i++) if (famDi[i] === fi) { maschera[i] = 1; celle++; }
    if (celle < 40) { famSaltate++; return; }
    const unioni = traceRegions(maschera, COLS, ROWS, 1, CELLA, { minAreaMm2: 10, simplifyMm: 0.3 });
    if (!unioni.length) { famSaltate++; return; }
    const u = unioni.sort((a, b) => b.areaMm2 - a.areaMm2)[0];
    u.outer = u.outer.map((p) => ({ x: p.x + ORIGX, y: p.y + ORIGY }));   // traceRegions conta dall'angolo della griglia
    const dentroFamStretto = (p: Point): boolean => { const i = cella(p); return i >= 0 && famDi[i] === fi; };
    // «dentro» con lo sconfinamento: la cella e' della famiglia, o lo e' una cella entro SCONFINA_MM
    let dentroFam = (p: Point): boolean => dentroFamStretto(p);   // viene rimpiazzata dalla maschera allargata piu' sotto

    // i due muri, come prima
    const anello = ricampiona([...u.outer, u.outer[0]], 0.5);
    const n = anello.length;
    if (n < 12) { famSaltate++; return; }
    const dentroCol = new Int8Array(n);
    const normali: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = anello[(i + n - 1) % n], c = anello[(i + 1) % n];
      let nx = c.y - a.y, ny = -(c.x - a.x);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const p = anello[i];
      if (dentroFamStretto({ x: p.x + nx * 1, y: p.y + ny * 1 })) { nx = -nx; ny = -ny; }   // stretto: il margine qui direbbe «dentro» da tutte e due le parti
      normali.push({ x: nx, y: ny });
      dentroCol[i] = tintaIn({ x: p.x - nx * 1.5, y: p.y - ny * 1.5 });
    }
    const chiaro = Math.min(...Array.from(dentroCol).filter((v) => v >= 0));
    const cerca = (pred: (i: number) => boolean): [number, number] | null => {
      let start = -1;
      for (let k = 0; k < n; k++) if (!pred(k)) { start = k; break; }
      if (start < 0) return null;
      let best: [number, number] | null = null, bestLen = 0;
      for (let k = 0; k < n; k++) {
        const idx = (start + k) % n;
        if (!pred(idx)) continue;
        let len = 0;
        while (len < n && pred((idx + len) % n)) len++;
        if (len > bestLen) { bestLen = len; best = [idx, len]; }
        k += len - 1;
      }
      return best;
    };
    const unaSolaTinta = new Set(Array.from(dentroCol).filter((v) => v >= 0)).size <= 1;
    // IL BORDO DEL PANNELLO NON E' UN MURO: il taglio del pannello non dice da dove viene la luce. Se il
    // tratto chiaro girava l'angolo e correva lungo il bordo, da li' partiva un secondo fronte di
    // livelli che incontrava il primo su una cresta diagonale: forcine, V, basi che passano due volte.
    const sulBordoPannello = (q: Point): boolean => q.x < X0 + 1 || q.y < Y0 + 1 || q.x > X1 - 1 || q.y > Y1 - 1;
    let tratto = unaSolaTinta ? null : cerca((i) => dentroCol[i] === chiaro && !sulBordoPannello(anello[i]));
    if (!tratto || tratto[1] < 6) tratto = unaSolaTinta ? null : cerca((i) => dentroCol[i] === chiaro);
    if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) {
      const rx = Math.cos((RIFERIMENTO_DEG * Math.PI) / 180), ry = Math.sin((RIFERIMENTO_DEG * Math.PI) / 180);
      tratto = cerca((i) => normali[i].x * rx + normali[i].y * ry >= 0);
      if (!tratto || tratto[1] < 6 || tratto[1] > n - 6) { famSaltate++; return; }
    }
    // IL MURO SI SPEZZA AGLI ANGOLI NETTI e si tiene il tratto piu' lungo: negli spicchi della sfera il
    // tratto chiaro era a L (arco + lato radiale), e uno spostamento lungo la sua normale media andava a
    // 45 gradi. Un angolo e' netto se la direzione gira di piu' di 60 gradi nel giro di 3 mm (6 punti).
    {
      const [s0, sl] = tratto;
      const w = 3;
      let da = 0, best: [number, number] = [s0, sl];
      let bestLen = 0;
      const dir = (k: number): Point => { const a = anello[(s0 + Math.max(0, k - w)) % n], b = anello[(s0 + Math.min(sl - 1, k + w)) % n]; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
      const tagli: number[] = [];
      for (let k = w; k + w < sl; k++) { const p1 = dir(k - w), p2 = dir(k + w); if (p1.x * p2.x + p1.y * p2.y < Math.cos(Math.PI / 3)) { tagli.push(k); k += w; } }
      bestLen = 0;
      for (const t of [...tagli, sl]) { if (t - da > bestLen) { bestLen = t - da; best = [(s0 + da) % n, t - da]; } da = t; }
      if (tagli.length && bestLen >= 6) tratto = best;
    }
    const [a0, la] = tratto;
    const A: Point[] = [], B: Point[] = [];
    for (let k = 0; k < la; k++) A.push(anello[(a0 + k) % n]);
    for (let k = 0; k < n - la; k++) B.push(anello[(a0 + la + k) % n]);
    const As = liscia(A, LISCIA_MM, 0.5);
    muriA.push(via(As)); muriB.push(via(B));
    famOk++;

    // LA DISTANZA DAL MURO, dentro la famiglia: semi = le celle attraversate dal muro liscio (e le
    // celle di bordo della famiglia entro una cella da esso). Chamfer a 16 vicini, tre giri.
    // LA MASCHERA ALLARGATA di SCONFINA_MM: la distanza e i livelli si calcolano qui, cosi' le linee
    // sconfinano davvero (col margine applicato solo al taglio, le linee finivano comunque al bordo:
    // il metro non si muoveva, 2,4% prima e dopo).
    const largo = new Uint8Array(COLS * ROWS);
    {
      const rc = Math.max(0, Math.round(SCONFINA_MM / CELLA));
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!maschera[i]) continue;
        largo[i] = 1;
        if (!rc) continue;
        const bordo = (c > 0 && !maschera[i - 1]) || (c + 1 < COLS && !maschera[i + 1]) || (r > 0 && !maschera[i - COLS]) || (r + 1 < ROWS && !maschera[i + COLS]);
        if (!bordo) continue;
        for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
          if (dx * dx + dy * dy > rc * rc) continue;
          const x = c + dx, y = r + dy;
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS) largo[y * COLS + x] = 1;   // anche fuori dal disegno: oltre il bordo del pannello e nelle fessure
        }
      }
    }
    // LA FASCIA ESTESA per spianare: la media mobile ai bordi di `largo` era storta (solo celle da
    // una parte), i livelli nel margine si spostavano e il bordo del pannello tornava nudo. D si
    // prolunga e si spiana su una fascia piu' larga del raggio di spianatura; i livelli restano su `largo`.
    const esteso = new Uint8Array(COLS * ROWS);
    {
      const rc = Math.round(SPIANA_MM / CELLA) + 1;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!largo[i]) continue;
        esteso[i] = 1;
        const bordo = (c > 0 && !largo[i - 1]) || (c + 1 < COLS && !largo[i + 1]) || (r > 0 && !largo[i - COLS]) || (r + 1 < ROWS && !largo[i + COLS]);
        if (!bordo) continue;
        for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
          if (dx * dx + dy * dy > rc * rc) continue;
          const x = c + dx, y = r + dy;
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS) esteso[y * COLS + x] = 1;
        }
      }
    }
    const nelLargo = (p: Point): boolean => { const i = cella(p); return i >= 0 && largo[i] === 1; };
    dentroFam = nelLargo;
    // la tinta della cella della famiglia piu' vicina, per chi sta nel margine
    const tintaVicina = (p: Point): number => {
      const c0 = Math.round((p.x - ORIGX) / CELLA), r0 = Math.round((p.y - ORIGY) / CELLA);
      const rMax = Math.round(SCONFINA_MM / CELLA) + 2;
      for (let rr = 1; rr <= rMax; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
        const c = c0 + dx, r = r0 + dy;
        if (c >= 0 && r >= 0 && c < COLS && r < ROWS && famDi[r * COLS + c] === fi) return tinta[r * COLS + c];
      }
      return -1;
    };
    const INF = 1e9;
    const D = new Float32Array(COLS * ROWS).fill(INF);
    for (const p of ricampiona(As, CELLA / 2)) { const i = cella(p); if (i >= 0) D[i] = 0; }
    for (let i = 0; i < COLS * ROWS; i++) if (D[i] === 0 && !largo[i]) {
      // il muro sta sul bordo: si sposta il seme sulla cella della famiglia piu' vicina
      for (const j of [i - 1, i + 1, i - COLS, i + COLS, i - COLS - 1, i - COLS + 1, i + COLS - 1, i + COLS + 1]) if (j >= 0 && j < COLS * ROWS && largo[j]) D[j] = 0;
      D[i] = INF;
    }
    const V: Array<[number, number, number]> = [[-1, 0, CELLA], [0, -1, CELLA], [-1, -1, CELLA * 1.4], [1, -1, CELLA * 1.4], [-2, -1, CELLA * 2.2], [-1, -2, CELLA * 2.2], [1, -2, CELLA * 2.2], [2, -1, CELLA * 2.2]];
    const mio = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < COLS && r < ROWS && largo[r * COLS + c] === 1;
    for (let giro = 0; giro < 3; giro++) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!mio(c, r)) continue;
        let v = D[i];
        for (const [dx, dy, w] of V) if (mio(c + dx, r + dy)) { const t = D[(r + dy) * COLS + c + dx] + w; if (t < v) v = t; }
        D[i] = v;
      }
      for (let r = ROWS - 1; r >= 0; r--) for (let c = COLS - 1; c >= 0; c--) {
        const i = r * COLS + c;
        if (!mio(c, r)) continue;
        let v = D[i];
        for (const [dx, dy, w] of V) if (mio(c - dx, r - dy)) { const t = D[(r - dy) * COLS + c - dx] + w; if (t < v) v = t; }
        D[i] = v;
      }
    }
    // LA FASCIA DI SCONFINAMENTO NON E' UN CORRIDOIO. Il chamfer misurava la distanza anche nella
    // fascia oltre il bordo, ma la fascia e' un vicolo cieco largo 2,5 mm: la si raggiunge solo dal
    // bordo, quindi D vi risaliva e i livelli ci facevano una forcina (sondato al bordo sinistro:
    // D=61,0 sul bordo, 61,5 a 2,5 mm fuori E a 2,5 mm dentro). La lisciatura, con sigma di 10 mm,
    // schiacciava la forcina e la base finiva 3 mm prima del bordo. Qui, nella fascia, D si
    // PROLUNGA LINEARMENTE dalla cella della famiglia piu' vicina col suo gradiente: la linea esce
    // dritta, come arriva.
    {
      const src = new Int32Array(COLS * ROWS).fill(-1);
      const coda: number[] = [];
      const grad = (q: number): [number, number] => {
        const c = q % COLS, r = Math.floor(q / COLS);
        const st = (cc: number, rr: number): boolean => cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && maschera[rr * COLS + cc] === 1 && D[rr * COLS + cc] < INF;
        let gx = 0, gy = 0;
        if (st(c + 1, r) && st(c - 1, r)) gx = (D[q + 1] - D[q - 1]) / (2 * CELLA);
        else if (st(c + 1, r)) gx = (D[q + 1] - D[q]) / CELLA;
        else if (st(c - 1, r)) gx = (D[q] - D[q - 1]) / CELLA;
        if (st(c, r + 1) && st(c, r - 1)) gy = (D[q + COLS] - D[q - COLS]) / (2 * CELLA);
        else if (st(c, r + 1)) gy = (D[q + COLS] - D[q]) / CELLA;
        else if (st(c, r - 1)) gy = (D[q] - D[q - COLS]) / CELLA;
        return [gx, gy];
      };
      const gradienti = new Map<number, [number, number]>();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!maschera[i] || D[i] >= INF) continue;
        const fuori = (c > 0 && esteso[i - 1] && !maschera[i - 1]) || (c + 1 < COLS && esteso[i + 1] && !maschera[i + 1]) || (r > 0 && esteso[i - COLS] && !maschera[i - COLS]) || (r + 1 < ROWS && esteso[i + COLS] && !maschera[i + COLS]);
        if (fuori) { src[i] = i; coda.push(i); gradienti.set(i, grad(i)); }
      }
      for (let k = 0; k < coda.length; k++) {
        const cur = coda[k], q = src[cur];
        const [gx, gy] = gradienti.get(q)!;
        const qc = q % COLS, qr = Math.floor(q / COLS), cc = cur % COLS, cr = Math.floor(cur / COLS);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = cc + dx, y = cr + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const n = y * COLS + x;
          if (!esteso[n] || maschera[n] || src[n] >= 0) continue;
          src[n] = q;
          D[n] = Math.max(0, D[q] + gx * (x - qc) * CELLA + gy * (y - qr) * CELLA);
          coda.push(n);
        }
      }
    }
    const D0 = new Float32Array(D);   // la distanza prima della spianatura: da qui parte la crescita
    for (let i = 0; i < COLS * ROWS; i++) if (maschera[i] && D[i] < INF) distDaMuro[i] = D[i];
    // D SI SPIANA, solo sulle celle della fascia larga: media mobile separabile di raggio SPIANA_MM,
    // tre passate (quasi una gaussiana di sigma ~ raggio/1,2). Serve a due cose: il chamfer e' a
    // gradini (somme di 0,5/0,7/1,1) e i suoi livelli uscivano doppi; e le creste fra due fronti
    // diventano dorsi tondi invece di spigoli. Le somme prefissate per riga/colonna lo rendono O(N).
    {
      const rc = Math.max(1, Math.round(SPIANA_MM / CELLA));
      const S = new Float64Array(Math.max(COLS, ROWS) + 1), C = new Int32Array(Math.max(COLS, ROWS) + 1);
      const E = new Float32Array(COLS * ROWS);
      const passata = (lungoRighe: boolean): void => {
        const n = lungoRighe ? COLS : ROWS, m = lungoRighe ? ROWS : COLS;
        for (let k = 0; k < m; k++) {
          const at = (t: number): number => (lungoRighe ? k * COLS + t : t * COLS + k);
          S[0] = 0; C[0] = 0;
          for (let t = 0; t < n; t++) { const i = at(t); const ok = esteso[i] && D[i] < INF; S[t + 1] = S[t] + (ok ? D[i] : 0); C[t + 1] = C[t] + (ok ? 1 : 0); }
          for (let t = 0; t < n; t++) {
            const i = at(t);
            if (!esteso[i] || D[i] >= INF) { E[i] = D[i]; continue; }
            const a = Math.max(0, t - rc), b = Math.min(n, t + rc + 1);
            const cnt = C[b] - C[a];
            E[i] = cnt ? (S[b] - S[a]) / cnt : D[i];
          }
        }
        D.set(E);
      };
      for (let giro = 0; giro < 3; giro++) { passata(true); passata(false); }
    }
    let dMax = 0;
    for (let i = 0; i < COLS * ROWS; i++) if (largo[i] && D[i] < INF && D[i] > dMax) dMax = D[i];
    let versoFisso: Point | null = null;   // nel modo a traslazione i denti vanno tutti contro il verso dello spostamento
    const gradVersoA = (p: Point): Point => {
      if (versoFisso) return versoFisso;
      const i = cella(p);
      if (i < 0) return { x: 0, y: 0 };
      const g = (j: number): number => (j >= 0 && j < COLS * ROWS && largo[j] && D[j] < INF ? D[j] : D[i]);
      let gx = (g(i + 1) - g(i - 1)) / (2 * CELLA), gy = (g(i + COLS) - g(i - COLS)) / (2 * CELLA);
      const l = Math.hypot(gx, gy) || 1;
      return { x: -gx / l, y: -gy / l };    // -gradiente = verso il muro = verso il chiaro
    };

    /**
     * IL PETTINE su un tratto di base: un dente ogni PASSO_MM, lungo fra min e max, aperto a caso entro
     * ±INCL attorno al verso del chiaro (-gradiente della distanza), andata e ritorno nello stesso
     * buco. Dove il dente esce dalla FAMIGLIA si guarda la foto: se il bordo stacca si ferma, se sfuma
     * attraversa. Dentro la famiglia attraversa sempre: i cambi di colore li' sono un gradiente.
     * Il SORMONTO: se verso il chiaro, entro SORM_MM, c'e' un colore piu' chiaro, il dente si cuce
     * anche con quel colore - prima, e sotto.
     */
    const pettina = (base: Point[], col: number, famiglia: number, idLiv: number): { denti: Array<[Point, Point]>; sotto: Map<number, Array<[Point, Point]>> } => {
      const dentiOut: Array<[Point, Point]> = [];
      const sottoOut = new Map<number, Array<[Point, Point]>>();
      let tot = 0;
      const cum: number[] = [0];
      for (let i = 1; i < base.length; i++) { tot += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y); cum.push(tot); }
      const punti: Point[] = [];
      const puntiSotto = new Map<number, Point[]>();
      let k = 0;
      for (let d = 0; d <= tot; d += PASSO_MM, k++) {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < d) i++;
        const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        const pa = base[i - 1], pb = base[i];
        const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
        const v = gradVersoA(p);
        if (v.x === 0 && v.y === 0) continue;
        const r1 = caso(famiglia * 7919 + idLiv, k * 2), r2 = caso(famiglia * 104729 + idLiv, k * 2 + 1);
        let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
        const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
        const ux = v.x * Math.cos(ang) - v.y * Math.sin(ang), uy = v.x * Math.sin(ang) + v.y * Math.cos(ang);
        for (let s = 0.5; s <= lung; s += 0.5) {
          const qq = { x: p.x + ux * s, y: p.y + uy * s };
          if (famIn(qq) === famiglia || dentroFam(qq)) continue;
          if (!sfumaQui(qq, { x: ux, y: uy })) { lung = Math.max(0.5, s - 0.25); fermati++; } else attraversano++;
          break;
        }
        const punta = { x: p.x + ux * lung, y: p.y + uy * lung };
        punti.push(p, punta, p);
        dentiOut.push([p, punta]);
        dentiTot++; filoMm += 2 * lung;
        const qq = { x: p.x + v.x * SORM_MM, y: p.y + v.y * SORM_MM };
        const colLa = famIn(qq) === famiglia ? tintaIn(qq) : -1;
        if (colLa >= 0 && colLa < col) { const l = puntiSotto.get(colLa) ?? []; l.push(p, punta, p); puntiSotto.set(colLa, l); const ls = sottoOut.get(colLa) ?? []; ls.push([p, punta]); sottoOut.set(colLa, ls); }
      }
      // LA SOGLIA: dentro una corsa di denti il segmento piu' lungo che il filo fa davvero e' il
      // dente stesso (radice -> punta), non il passo. Con la soglia sul passo — due volte 1,5 mm —
      // ogni dente sopra i 4 mm veniva staccato dal disegno: nell'anteprima sparivano i denti e
      // restavano le sole basi. Il passo fra due radici e' sempre piu' corto del dente, quindi la
      // soglia giusta e' la lunghezza massima del dente con un margine.
      const SOGLIA_DISEGNO = Math.max(DENTE_MAX, PASSO_MM) + 1;
      if (punti.length >= 3) { perColoreDenti[col].push(viaSpezzato(punti, SOGLIA_DISEGNO)); cuci(punti); }
      for (const [c, l] of puntiSotto) if (l.length >= 3) perColoreDenti[c].push(viaSpezzato(l, SOGLIA_DISEGNO));
      return { denti: dentiOut, sotto: sottoOut };
    };

    // I LIVELLI, uno ogni passo, ognuno addolcito in proporzione alla distanza
    // Un livello: si estrae su una maschera, si incatena, si spezza alle forcine, si liscia, si colora.
    // I SEGMENTI NULLI: dove D vale esattamente d su un angolo di cella (succede ogni 2,5 mm: il
    // chamfer somma multipli di 0,5) il marching squares emette un segmento di lunghezza zero, e la
    // catena si spezzava li'. Le basi finivano 3 mm prima del bordo: era questo, non la lisciatura.
    // Il livello si estrae un pelo (0,0137 mm) sopra il valore tondo: i valori del chamfer sono
    // somme di 0,5/0,7/1,1 e finivano ESATTAMENTE sui livelli, con tre o quattro segmenti che si
    // toccavano in un angolo e la catena che sceglieva quello sbagliato.
    const tiraLivello = (d: number, su: Uint8Array): void => {
      const segmenti = livello(D, su, COLS, ROWS, ORIGX, ORIGY, CELLA, d + 0.0137).filter((sg) => Math.hypot(sg.b.x - sg.a.x, sg.b.y - sg.a.y) > 1e-6);
      tiraLinee(incatena(segmenti, CELLA * 1.5), d);
    };
    const tiraLinee = (linee: Point[][], d: number, sigma?: number): void => {
      idLivello++;
      for (const linea of linee) {
        if (linea.length < 3) continue;
        for (const pezzo of spezzaAlleForcine(ricampiona(linea, 0.5), 0.5)) {
        if (pezzo.length < 4) continue;
        // il tetto alla lisciatura: a 140 mm dal muro sigma faceva 22 mm e un gomito dei livelli
        // diventava un arco largo, che tagliava l'angolo lasciandolo nudo (sondato a (112,250))
        const sg = sigma ?? Math.min(LISCIA_MAX, LISCIA_MM + ADDOLCISCI * d);
        const morbida = sg > 0 ? liscia(pezzo, sg, 0.5) : pezzo;
        let cur: Point[] = [], curCol = -2;
        const chiudi = (): void => {
          if (cur.length >= 2 && curCol >= 0 && lunghezza(cur) >= 1.5) {
            perColore[curCol].push(via(cur)); const copia = cur.slice(); lineeFinali.push({ id: idLivello, punti: copia }); cuci(copia); stendi(copia);
            const t: Tratto = { col: curCol, fi, id: idLivello, d, base: copia, denti: [], sotto: new Map() };
            if (DENTI) { const r = pettina(cur, curCol, fi, idLivello); t.denti = r.denti; t.sotto = r.sotto; }
            trattiTutti.push(t);
          }
          cur = []; curCol = -2;
        };
        // il colore punto per punto, poi stabilizzato. Sconfinando, il colore resta quello della
        // famiglia: si prende dalla cella piu' vicina che e' sua (un livello che corre tutto nel
        // margine, oltre il bordo del pannello, non ne tocca nessuna).
        const grezzi: number[] = [];
        for (let i = 0; i < morbida.length; i++) {
          const p = morbida[i];
          const prec = grezzi.length ? grezzi[grezzi.length - 1] : -1;
          grezzi.push(dentroFamStretto(p) ? tintaIn(p) : dentroFam(p) ? (prec >= 0 ? prec : tintaVicina(p)) : -1);
        }
        const colori = stabilizza(grezzi, 4);
        for (let i = 0; i < morbida.length; i++) {
          const p = morbida[i];
          const col = colori[i];
          if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
          if (col >= 0) cur.push(p);
          if (col >= 0) {
            const v = gradVersoA(p);
            const qq = { x: p.x + v.x * SORM_MM, y: p.y + v.y * SORM_MM };
            const colLa = dentroFam(qq) ? tintaIn(qq) : -1;
            if (colLa >= 0 && colLa < col) sotto[colLa].push(via([p, { x: p.x + v.x * 0.6, y: p.y + v.y * 0.6 }]));
            if (i % 40 === 20 && Math.round(d / BASI_MM) % 2 === 0) {
              const tip = { x: p.x + v.x * 3, y: p.y + v.y * 3 };
              const px = -v.y, py = v.x;
              frecce.push(via([p, tip]) + via([{ x: tip.x - v.x + px * 0.8, y: tip.y - v.y + py * 0.8 }, tip, { x: tip.x - v.x - px * 0.8, y: tip.y - v.y - py * 0.8 }]));
            }
          }
        }
        chiudi();
        }
      }
    };
    // LA TRASLAZIONE (prova chiesta da Lorenzo, 2026-09-09, sulla sfera): «non fare la fusione tra due
    // muri, prendi solo quello piu' chiaro e fai lo spostamento senza alterare la forma della curva,
    // solamente tagliandola dove finisce la forma». Il muro chiaro, prolungato dritto ai due capi, si
    // sposta di un passo alla volta lungo la sua normale media (verso l'interno): ogni copia e'
    // identica, si taglia dove esce dal blocco (con lo sconfinamento) e dove corre a meno di 30 gradi
    // dal verso dello spostamento (li' le copie si accavallerebbero). I denti vanno tutti contro lo
    // spostamento, cioe' verso il muro chiaro. Vale per le famiglie fino a TRASLA_MAX_MM2 (i blocchi
    // della sfera); le fasce grandi restano come prima.
    if (u.areaMm2 <= TRASLA_MAX_MM2) {
      const base = ricampiona(As, 0.5);
      // la normale media, verso l'interno della famiglia
      let ux = 0, uy = 0;
      for (let i = 1; i + 1 < base.length; i++) {
        const tx = base[i + 1].x - base[i - 1].x, ty = base[i + 1].y - base[i - 1].y;
        const l = Math.hypot(tx, ty) || 1;
        let nx = -ty / l, ny = tx / l;
        if (!dentroFamStretto({ x: base[i].x + nx * 1.5, y: base[i].y + ny * 1.5 }) && dentroFamStretto({ x: base[i].x - nx * 1.5, y: base[i].y - ny * 1.5 })) { nx = -nx; ny = -ny; }
        ux += nx; uy += ny;
      }
      const lu = Math.hypot(ux, uy) || 1; ux /= lu; uy /= lu;
      versoFisso = { x: -ux, y: -uy };
      // il muro prolungato dritto ai due capi
      const est = (a: Point, b: Point, L: number): Point[] => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; const out: Point[] = []; for (let t = L; t > 0; t -= 0.5) out.push({ x: b.x + ((b.x - a.x) / l) * t, y: b.y + ((b.y - a.y) / l) * t }); return out; };
      const n = base.length, L = 300;
      const lunga = [...est(base[Math.min(n - 1, 6)], base[0], L), ...base, ...est(base[Math.max(0, n - 7)], base[n - 1], L).reverse()];
      // dove la curva corre quasi lungo lo spostamento le copie si accavallano (distanza fra due copie =
      // passo × sin dell'angolo): li' si tiene una copia ogni tante, cosi' la distanza torna ~ un passo.
      // Toglierle e basta lasciava una colonna nuda (visto nel blocco in alto a destra della sfera).
      const ogni: number[] = lunga.map((_, i) => {
        const a = lunga[Math.max(0, i - 2)], b = lunga[Math.min(lunga.length - 1, i + 2)];
        const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
        const sin = Math.sqrt(Math.max(0, 1 - ((tx * ux + ty * uy) / l) ** 2));
        return sin >= 0.5 ? 1 : Math.min(10, Math.round(1 / Math.max(0.1, sin)));
      });
      for (let k = 0; k < 400; k++) {
        const d = k * BASI_MM + BASI_MM / 2;
        const linee: Point[][] = [];
        let cur: Point[] = [], viva = false;
        for (let i = 0; i < lunga.length; i++) {
          const q = { x: lunga[i].x + ux * d, y: lunga[i].y + uy * d };
          const ok = k % ogni[i] === 0 && nelLargo(q);
          if (ok) { cur.push(q); viva = true; } else if (cur.length) { linee.push(cur); cur = []; }
        }
        if (cur.length) linee.push(cur);
        if (!viva) { if (k > 2) break; else continue; }
        tiraLinee(linee, d, 0);
      }
    } else if (par.modo === 'geodetica' || !par.modo || par.modo === 'auto') {
      /**
       * LA CRESCITA GEODETICA. Chiesta da Lorenzo il 2026-09-10, dopo aver misurato che il 4,9% dei
       * punti di base aveva un'altra riga a meno di mezzo passo dentro lo stesso gruppo: nel ricamo
       * sono bande piu' fitte, e a occhio sembrano «linee che tagliano».
       *
       * Le due costruzioni di prima sbagliavano ognuna per un verso opposto:
       *   * i LIVELLI di una distanza spianata tengono la forma ma si allargano dove la spianatura
       *     ha abbassato la pendenza (la densita' cambia: bocciato da Lorenzo il 2026-09-09);
       *   * la CRESCITA MORFOLOGICA tiene il passo ma smorza la forma a ogni dilatazione, e lascia i
       *     fianchi dei cunei come fronti.
       * Qui il passo e' esatto PER COSTRUZIONE e la forma non si smorza: a ogni giro si ricalcola la
       * distanza geodetica dal fronte appena cucito, dentro la sola parte non ancora raggiunta, e la
       * riga nuova e' il suo livello a un passo. E' la stessa idea della distanza dal muro, ma
       * rimisurata ogni volta: cosi' non si accumula ne' l'errore della spianatura ne' quello della
       * dilatazione. Costa una propagazione per giro, ma solo su una banda larga un passo e mezzo.
       */
      const INFE = 1e9;
      const E = new Float32Array(COLS * ROWS).fill(INFE);
      const R = new Uint8Array(COLS * ROWS);
      const banda = new Uint8Array(COLS * ROWS);
      let raggiunte = 0, restanti = 0;
      for (let i = 0; i < COLS * ROWS; i++) if (largo[i]) { restanti++; if (D0[i] < INF && D0[i] <= BASI_MM / 2) { R[i] = 1; raggiunte++; } }
      // i 16 vicini del chamfer, come per la distanza dal muro: l'errore resta sotto l'1%
      const VIC: Array<[number, number, number]> = [
        [1, 0, CELLA], [-1, 0, CELLA], [0, 1, CELLA], [0, -1, CELLA],
        [1, 1, CELLA * 1.4142], [1, -1, CELLA * 1.4142], [-1, 1, CELLA * 1.4142], [-1, -1, CELLA * 1.4142],
        [2, 1, CELLA * 2.2361], [2, -1, CELLA * 2.2361], [-2, 1, CELLA * 2.2361], [-2, -1, CELLA * 2.2361],
        [1, 2, CELLA * 2.2361], [1, -2, CELLA * 2.2361], [-1, 2, CELLA * 2.2361], [-1, -2, CELLA * 2.2361],
      ];
      const LIMITE = BASI_MM * 1.6;
      for (let giro = 1; giro <= 400 && raggiunte < restanti; giro++) {
        // 1. i semi: le celle gia' raggiunte che confinano con quelle che mancano. Da li' si misura.
        const toccate: number[] = [];
        let c0 = COLS, r0 = ROWS, c1 = 0, r1 = 0;
        const heap: Array<[number, number]> = [];
        const push = (v: number, n: number): void => {
          heap.push([v, n]);
          let i = heap.length - 1;
          while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; }
        };
        const pop = (): [number, number] => {
          const top = heap[0], last = heap.pop()!;
          if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
          return top;
        };
        const segna = (i: number, v: number): void => {
          if (E[i] >= INFE) { toccate.push(i); banda[i] = 1; const c = i % COLS, r = (i - c) / COLS; if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r; }
          E[i] = v;
        };
        for (let r = 1; r + 1 < ROWS; r++) for (let c = 1; c + 1 < COLS; c++) {
          const i = r * COLS + c;
          if (!R[i]) continue;
          if ((largo[i - 1] && !R[i - 1]) || (largo[i + 1] && !R[i + 1]) || (largo[i - COLS] && !R[i - COLS]) || (largo[i + COLS] && !R[i + COLS])) {
            segna(i, 0); push(0, i);
          }
        }
        if (!heap.length) break;
        // 2. la distanza dal fronte, dentro cio' che manca, fino a un passo e mezzo
        while (heap.length) {
          const [v, i] = pop();
          if (v > E[i] + 1e-9) continue;
          if (v > LIMITE) break;
          const c = i % COLS, r = (i - c) / COLS;
          for (const [dx, dy, w] of VIC) {
            const x = c + dx, y = r + dy;
            if (x < 1 || y < 1 || x + 1 >= COLS || y + 1 >= ROWS) continue;
            const j = y * COLS + x;
            if (!largo[j] || R[j]) continue;
            const nv = v + w;
            if (nv < E[j] - 1e-9 && nv <= LIMITE) { segna(j, nv); push(nv, j); }
          }
        }
        // 3. la riga nuova e' il livello a un passo, tirato solo sulla banda
        const segmenti = livello(E, banda, COLS, ROWS, ORIGX, ORIGY, CELLA, BASI_MM, [c0 - 1, r0 - 1, c1 + 1, r1 + 1])
          .filter((sg) => Math.hypot(sg.b.x - sg.a.x, sg.b.y - sg.a.y) > 1e-6);
        tiraLinee(incatena(segmenti, CELLA * 1.5), giro * BASI_MM);
        // 4. quello che sta entro un passo e' raggiunto; il resto tornera' al giro dopo
        let cresciute = 0;
        for (const i of toccate) if (E[i] <= BASI_MM && !R[i]) { R[i] = 1; cresciute++; }
        raggiunte += cresciute;
        for (const i of toccate) { E[i] = INFE; banda[i] = 0; }
        if (!cresciute) break;
      }
    } else if (par.modo === 'livelli') {
      for (let d = BASI_MM / 2; d < dMax; d += BASI_MM) tiraLivello(d, largo);
    } else {
      // LA CRESCITA A PASSO FISSO. Lorenzo (2026-09-09): «nei punti in cui hai allentato la curva la
      // densita' non e' omogenea e si allarga nella curvatura, li' non deve succedere. La densita' deve
      // rimanere la stessa». Le curve di livello di una distanza spianata si allargano per forza dove
      // la spianatura ha abbassato la pendenza. Qui invece la regione raggiunta cresce di UN PASSO
      // esatto a ogni giro (dilatazione), e solo dopo si arrotondano le sue insenature (chiusura
      // morfologica di raggio CHIUDI_MM): la linea nuova sta a un passo dalla precedente ovunque,
      // tranne nell'insenatura riempita, che coprono i denti (verso il chiaro, cioe' verso di essa).
      // La linea e' il bordo della regione verso le celle non ancora raggiunte.
      const R = new Uint8Array(COLS * ROWS);
      let dentroR = 0, tot = 0;
      // (dalla distanza NON spianata: spianata, vicino al muro D sale sopra il mezzo passo e la regione
      // di partenza restava vuota - 9 famiglie su 19 senza una linea)
      for (let i = 0; i < COLS * ROWS; i++) if (largo[i]) { tot++; if (D0[i] < INF && D0[i] <= BASI_MM / 2) { R[i] = 1; dentroR++; } }
      const raggioCelle = (mm: number): number => Math.max(1, Math.round(mm / CELLA));
      const disco = (rc: number): Array<[number, number]> => { const out: Array<[number, number]> = []; for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) if (dx * dx + dy * dy <= rc * rc + 0.25) out.push([dx, dy]); return out; };
      // dilata `M` di rc celle, restando in `largo`; i semi sono le celle di M con un vicino fuori da M
      const dilata = (M: Uint8Array, rc: number): Uint8Array<ArrayBuffer> => {
        const out = new Uint8Array(M.length); out.set(M);
        const dd = disco(rc);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (!M[i]) continue;
          if ((c > 0 && !M[i - 1] && largo[i - 1]) || (c + 1 < COLS && !M[i + 1] && largo[i + 1]) || (r > 0 && !M[i - COLS] && largo[i - COLS]) || (r + 1 < ROWS && !M[i + COLS] && largo[i + COLS])) {
            for (const [dx, dy] of dd) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && largo[y * COLS + x]) out[y * COLS + x] = 1; }
          }
        }
        return out;
      };
      // erode `M` di rc celle: via le celle di M entro rc da una cella di largo fuori da M (fuori da largo non conta)
      const erodi = (M: Uint8Array, rc: number): Uint8Array<ArrayBuffer> => {
        const out = new Uint8Array(M.length); out.set(M);
        const dd = disco(rc);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (M[i] || !largo[i]) continue;
          if ((c > 0 && M[i - 1]) || (c + 1 < COLS && M[i + 1]) || (r > 0 && M[i - COLS]) || (r + 1 < ROWS && M[i + COLS])) {
            for (const [dx, dy] of dd) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) out[y * COLS + x] = 0; }
          }
        }
        return out;
      };
      const passoCelle = raggioCelle(BASI_MM);
      let giro = 0;
      let Rk = R;
      while (dentroR < tot && giro < 400) {
        giro++;
        const d = (giro + 0.5) * BASI_MM;
        let Rn = dilata(Rk, passoCelle);
        const rChiudi = raggioCelle(Math.min(LISCIA_MAX, CHIUDI_MM + ADDOLCISCI * d));
        if (rChiudi > 0) { const chiusa = erodi(dilata(Rn, rChiudi), rChiudi); for (let i = 0; i < COLS * ROWS; i++) if (chiusa[i]) Rn[i] = 1; }
        // il fronte: i bordi della regione che guardano celle di largo non ancora raggiunte
        const regioni = traceRegions(Rn, COLS, ROWS, 1, CELLA, { minAreaMm2: 0.5, simplifyMm: 0.3 });
        const linee: Point[][] = [];
        const guardaFuori = (p: Point): boolean => {
          const c = Math.round((p.x - ORIGX) / CELLA), r = Math.round((p.y - ORIGY) / CELLA);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { const j = y * COLS + x; if (largo[j] && !Rn[j]) return true; } }
          return false;
        };
        for (const reg of regioni) for (const anello of [reg.outer, ...reg.holes]) {
          const pts = ricampiona([...anello, anello[0]].map((q) => ({ x: q.x + ORIGX, y: q.y + ORIGY })), 0.5);
          // si taglia il giro in tratti che guardano fuori
          let cur: Point[] = [];
          const tratti: Point[][] = [];
          for (const q of pts) { if (guardaFuori(q)) cur.push(q); else { if (cur.length >= 3) tratti.push(cur); cur = []; } }
          if (cur.length >= 3) tratti.push(cur);
          // se il giro e' tutto fronte, primo e ultimo tratto sono lo stesso: si uniscono
          if (tratti.length >= 2 && guardaFuori(pts[0]) && guardaFuori(pts[pts.length - 1])) { const ultimo = tratti.pop()!; tratti[0] = [...ultimo, ...tratti[0]]; }
          for (const t of tratti) linee.push(t);
        }
        tiraLinee(linee, d);
        let n = 0;
        for (let i = 0; i < COLS * ROWS; i++) if (Rn[i]) n++;
        if (n === dentroR) break;   // non cresce piu' (regione chiusa da qualche parte): basta
        dentroR = n; Rk = Rn;
      }
    }

    // IL RAMMENDO. Dopo i livelli (e i loro denti) si guarda cosa della famiglia e' rimasto a piu' di
    // 0,75 mm da qualunque filo: ogni macchia nuda di almeno 2 mm² riceve un livello in piu', quello
    // che passa per il suo centro (la mediana di D sulla macchia), limitato a un intorno della macchia.
    // E' un livello come gli altri, coi denti verso il chiaro. Copre qualunque causa - gli apici delle U
    // sui dorsi spianati, un gomito, un capo che arriva corto - senza dover indovinare quale.
    if (DENTI) for (let giro = 0; giro < 2; giro++) {
      const visto = new Uint8Array(GW * GH);
      const toppa = new Uint8Array(COLS * ROWS);
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        const g0 = gy * GW + gx;
        if (visto[g0] || cop[g0]) continue;
        const p0 = gPunto(gx, gy);
        if (famIn(p0) !== fi) continue;
        // la macchia nuda, a 4 vicini, dentro la famiglia
        const macchia: number[] = [g0];
        visto[g0] = 1;
        for (let h = 0; h < macchia.length; h++) {
          const g = macchia[h], x = g % GW, y = Math.floor(g / GW);
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
            const gg = yy * GW + xx;
            if (visto[gg] || cop[gg] || famIn(gPunto(xx, yy)) !== fi) continue;
            visto[gg] = 1; macchia.push(gg);
          }
        }
        if (macchia.length * G * G < 2) continue;
        const valori: number[] = [];
        const celle: number[] = [];
        for (const g of macchia) { const i = cella(gPunto(g % GW, Math.floor(g / GW))); if (i >= 0 && largo[i] && D[i] < INF) { valori.push(D[i]); celle.push(i); } }
        if (!valori.length) continue;
        valori.sort((a, b) => a - b);
        const dMed = valori[Math.floor(valori.length / 2)];
        const rt = Math.round(2 / CELLA);
        const toccate: number[] = [];
        for (const i of celle) { const c = i % COLS, r = Math.floor(i / COLS); for (let dy = -rt; dy <= rt; dy++) for (let dx = -rt; dx <= rt; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && largo[y * COLS + x] && !toppa[y * COLS + x]) { toppa[y * COLS + x] = 1; toccate.push(y * COLS + x); } } }
        tiraLivello(dMed, toppa);   // `d` del tratto = dMed: si cuce al posto giusto nell'ordine
        rammendi++;
        for (const i of toccate) toppa[i] = 0;
      }
    }

    // L'ULTIMA BASE LUNGO IL MURO BLU (spenta di default, vedi ULTIMA_BASE). I denti vanno verso il chiaro, cioe' via dal blu: la striscia
    // fra l'ultimo livello e il blu non la copre nessun dente, e fra due famiglie il canale nudo si
    // raddoppia (Lorenzo: «tanti buchi, anche tra due gruppi diversi»). Qui una base corre lungo il
    // blu a mezzo passo dentro, SOLO dove la distanza dal muro rosso supera l'ultimo livello di piu'
    // di 3/4 di passo, coi denti verso il chiaro come tutte le altre: nessuna seconda direzione.
    if (ULTIMA_BASE) {
      idLivello++;
      const nB = ricampiona([...B], 0.5);
      const grezza: Point[] = [], tieni: boolean[] = [];
      for (let i = 0; i < nB.length; i++) {
        const a = nB[Math.max(0, i - 1)], c = nB[Math.min(nB.length - 1, i + 1)];
        let nx = c.y - a.y, ny = -(c.x - a.x);
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const b = nB[i];
        if (!dentroFamStretto({ x: b.x + nx * 1, y: b.y + ny * 1 })) { nx = -nx; ny = -ny; }
        const p = { x: b.x + nx * (BASI_MM / 2), y: b.y + ny * (BASI_MM / 2) };
        grezza.push(p);
        const ci = cella(p);
        const dist = ci >= 0 && famDi[ci] === fi ? D[ci] : INF;
        const ultimoLivello = dist < INF ? (Math.floor(dist / BASI_MM - 0.5) + 0.5) * BASI_MM : 0;
        tieni.push(dist < INF && dist - ultimoLivello > BASI_MM * 0.75);
      }
      const morbida = liscia(grezza, LISCIA_MM, 0.5);
      let cur: Point[] = [], curCol = -2;
      const chiudi = (): void => {
        if (cur.length >= 2 && curCol >= 0 && lunghezza(cur) >= 1.5) { perColore[curCol].push(via(cur)); const copia = cur.slice(); lineeFinali.push({ id: idLivello, punti: copia }); cuci(copia); const t: Tratto = { col: curCol, fi, id: idLivello, d: 1e9, base: copia, denti: [], sotto: new Map() }; if (DENTI) { const r = pettina(cur, curCol, fi, idLivello); t.denti = r.denti; t.sotto = r.sotto; } trattiTutti.push(t); }
        cur = []; curCol = -2;
      };
      // qui la base sta a mezzo passo dentro: ha sempre una tinta
      const colori = stabilizza(morbida.map((p, i) => (tieni[i] && dentroFam(p) ? tintaIn(p) : -1)), 4);
      for (let i = 0; i < morbida.length; i++) {
        const p = morbida[i];
        const col = colori[i];
        if (col !== curCol) { const ultimo = cur[cur.length - 1]; chiudi(); if (ultimo && col >= 0) cur.push(ultimo); curCol = col; }
        if (col >= 0) cur.push(p);
      }
      chiudi();
    }
  });
  const lung = lineeFinali.map((l) => { let t = 0; for (let i = 1; i < l.punti.length; i++) t += Math.hypot(l.punti[i].x - l.punti[i - 1].x, l.punti[i].y - l.punti[i - 1].y); return t; });
  const trattiCorti = lung.filter((v) => v < 5).length;
  const basiM = lung.reduce((a, b) => a + b, 0) / 1000;
  console.log(`${famOk} gruppi, ${famSaltate} saltati · ${lineeFinali.length} tratti di base (${trattiCorti} sotto i 5 mm) · ${basiM.toFixed(1)} m di basi · ${rammendi} rammendi`);

  // LA SPAZIATURA VERA, in millimetri. Il metro «denso» conta celle e dice poco; qui si misura, per
// ogni punto di base, quanto dista la riga più vicina che non sia la sua. Se il passo è 3 mm e il 10°
// percentile è 0,9, una riga su dieci sta addosso a un'altra: nel ricamo è una banda più fitta e
// scura, ed è quello che Lorenzo vede come «linee che tagliano strano» (2026-09-10). Si separa
// quello che succede DENTRO un gruppo — dove è un difetto — da quello che succede fra gruppi
// diversi, dove le righe si sovrappongono apposta (lo sconfinamento serve a non lasciare la giunta
// nuda) e quindi non è un difetto.
const spaziatura = { mediana: 0, decimo: 0, sottoMezzoPasso: 0, sottoMezzoPassoStessoGruppo: 0 };
{
  const C = 4;
  const griglia = new Map<string, Array<[number, number, number, number]>>();   // x, y, id, famiglia
  for (const t of trattiTutti) for (let i = 0; i < t.base.length; i += 4) {
    const q = t.base[i];
    const k = `${Math.floor(q.x / C)},${Math.floor(q.y / C)}`;
    const l = griglia.get(k) ?? []; l.push([q.x, q.y, t.id, t.fi]); griglia.set(k, l);
  }
  const dist: number[] = [];
  let vicini = 0, viciniStesso = 0, campioni = 0;
  for (const t of trattiTutti) for (let i = 0; i < t.base.length; i += 8) {
    const q = t.base[i];
    let best = Infinity, bestFam = -1;
    const cx = Math.floor(q.x / C), cy = Math.floor(q.y / C);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const [px, py, id, fam] of griglia.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (id === t.id) continue;
        const dd = Math.hypot(px - q.x, py - q.y);
        if (dd < best) { best = dd; bestFam = fam; }
      }
    }
    if (best > 12) continue;
    campioni++; dist.push(best);
    if (best < BASI_MM / 2) { vicini++; if (bestFam === t.fi) viciniStesso++; }
  }
  dist.sort((a, b) => a - b);
  if (campioni) {
    spaziatura.mediana = dist[Math.floor(campioni / 2)];
    spaziatura.decimo = dist[Math.floor(campioni / 10)];
    spaziatura.sottoMezzoPasso = (vicini / campioni) * 100;
    spaziatura.sottoMezzoPassoStessoGruppo = (viciniStesso / campioni) * 100;
    console.log(`SPAZIATURA fra le righe: mediana ${spaziatura.mediana.toFixed(2)} mm · 10° percentile ${spaziatura.decimo.toFixed(2)} · sotto mezzo passo ${spaziatura.sottoMezzoPasso.toFixed(1)}% (di cui ${spaziatura.sottoMezzoPassoStessoGruppo.toFixed(1)}% dentro lo stesso gruppo)`);
  }
}

// --- 5. il metro ------------------------------------------------------------------------------------------
  // denso = due LIVELLI diversi entro 0,35 passi. Contare le polilinee contava due volte lo stesso
  // livello spezzato a un cambio di colore: il metro diceva 27% denso su linee a 4 mm esatti.
  const ultimoId = new Int32Array(GW * GH).fill(-1);
  const conteggio = new Uint8Array(GW * GH), vicino = new Uint8Array(GW * GH);
  const r1 = Math.round((BASI_MM * 0.35) / G), r2 = Math.ceil((BASI_MM * 0.75) / G);
  for (const { id, punti: linea } of lineeFinali) {
    const toccate = new Set<number>();
    for (const p of linea) {
      const cx = gx0(p), cy = gy0(p);
      for (let dy = -r2; dy <= r2; dy++) for (let dx = -r2; dx <= r2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 * r2) vicino[y * GW + x] = 1;
        if (d2 <= r1 * r1) toccate.add(y * GW + x);
      }
    }
    for (const i of toccate) if (ultimoId[i] !== id) { ultimoId[i] = id; if (conteggio[i] < 255) conteggio[i]++; }
  }
  let nude = 0, dense = 0, dentro = 0;
  const macchie: string[] = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    if (tintaIn(gPunto(x, y)) < 0) continue;
    dentro++;
    if (!vicino[i]) { nude++; macchie.push(`<rect x="${gPunto(x, y).x.toFixed(1)}" y="${gPunto(x, y).y.toFixed(1)}" width="${G}" height="${G}" fill="#ff5fa2" opacity="0.55"/>`); }
    else if (conteggio[i] >= 2) { dense++; macchie.push(`<rect x="${gPunto(x, y).x.toFixed(1)}" y="${gPunto(x, y).y.toFixed(1)}" width="${G}" height="${G}" fill="#2bc46a" opacity="0.55"/>`); }
  }
  const nudiFilo: string[] = [];
  let nudoFiloPct = 0;
  if (DENTI) {
    // IL METRO DEL FILO: ogni segmento cucito (basi e denti) copre le celle entro 0,75 mm (`cop`,
    // tenuta aggiornata da `cuci`); cosa resta?
    let nudoFilo = 0, tot = 0;
    // (la percentuale esce dal blocco: serve alle statistiche)
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (tintaIn(gPunto(x, y)) < 0) continue; tot++; if (!cop[y * GW + x]) { nudoFilo++; nudiFilo.push(`<rect x="${gPunto(x, y).x.toFixed(1)}" y="${gPunto(x, y).y.toFixed(1)}" width="${G}" height="${G}" fill="#ff2f8f" opacity="0.7"/>`); } }
    nudoFiloPct = (nudoFilo / Math.max(1, tot)) * 100;
    console.log(`METRO DEL FILO: ${nudoFiloPct.toFixed(1)}% a piu' di 0,75 mm da qualunque filo`);
    // DOVE STANNO le celle nude: sul bordo del pannello, su una giunta fra famiglie, o dentro una famiglia?
    {
      let bordoPan = 0, giunta = 0, interno = 0;
      const R = Math.ceil(1.5 / G);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const p = gPunto(x, y);
        if (tintaIn(p) < 0 || cop[y * GW + x]) continue;
        const fam = famIn(p);
        let fuori = false, altra = false;
        for (let dy = -R; dy <= R && !fuori; dy++) for (let dx = -R; dx <= R; dx++) {
          const q = gPunto(x + dx, y + dy);
          if (tintaIn(q) < 0) { fuori = true; break; }
          if (famIn(q) !== fam) altra = true;
        }
        if (fuori) bordoPan++; else if (altra) giunta++; else interno++;

      }
      console.log(`  nude: ${bordoPan} sul bordo del pannello · ${giunta} sulle giunte fra famiglie · ${interno} dentro una famiglia (celle da 0,5 mm)`);
    }
  }
  console.log(`METRO (passo ${BASI_MM}): nudo ${((nude / dentro) * 100).toFixed(1)}% · denso ${((dense / dentro) * 100).toFixed(1)}%`);

  let svgPettine = '';
  // --- 6. l'immagine ------------------------------------------------------------------------------------------
  const pezzi: string[] = [];
  colori.forEach((c, t) => { if (perColore[t].length) pezzi.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.3"/>`); });
  const sottoTutti = sotto.flat();
  if (sottoTutti.length) pezzi.push(`<path d="${sottoTutti.join('')}" fill="none" stroke="#f08a1a" stroke-width="0.35"/>`);
  pezzi.push(`<g>${macchie.join('')}</g>`);
  pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.8"/>`);
  pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.5"/>`);
  pezzi.push(`<path d="${frecce.join('')}" fill="none" stroke="#111" stroke-width="0.35"/>`);
  const legenda = colori.map((c, i) => `<rect x="${(8 + i * 22).toFixed(1)}" y="2" width="6" height="6" fill="${c}" stroke="#333" stroke-width="0.2"/><text x="${(15 + i * 22).toFixed(1)}" y="7" font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#222">${i + 1}${i === 0 ? ' (grigio)' : ''}</text>`).join('');
  const nota = `<text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="3.6" fill="#222">livelli della distanza dal muro: ordine 1→6 dal chiaro allo scuro · ROSSO muro di partenza · BLU muro opposto · FRECCE verso del pettine · ARANCIO sovrapposizione · ROSA nudo · VERDE denso</text>`;
  const NL = String.fromCharCode(10);
  // `<metadata>` non si disegna: e' il posto dove l'SVG tiene il progetto, come il footer nel DST
  const progettoSvg = ing.progetto ? `<metadata id="rg-progetto">${JSON.stringify(ing.progetto).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</metadata>` + String.fromCharCode(10) : '';
  const svgVerifica = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(X0 - MARG).toFixed(1)} ${(Y0 - 18 - MARG).toFixed(1)} ${(RQ.larghezza + 2 * MARG).toFixed(1)} ${(RQ.altezza + 18 + 2 * MARG).toFixed(1)}" width="${(RQ.larghezza + 2 * MARG).toFixed(1)}mm" height="${(RQ.altezza + 18 + 2 * MARG).toFixed(1)}mm">` + NL +
  progettoSvg + `<rect x="${(X0 - MARG).toFixed(1)}" y="${(Y0 - 18 - MARG).toFixed(1)}" width="${(RQ.larghezza + 2 * MARG).toFixed(1)}" height="${(RQ.altezza + 18 + 2 * MARG).toFixed(1)}" fill="#faf9f7"/>` + NL +
  `<rect x="${X0.toFixed(1)}" y="${Y0.toFixed(1)}" width="${RQ.larghezza.toFixed(1)}" height="${RQ.altezza.toFixed(1)}" fill="none" stroke="#333" stroke-width="0.3" stroke-dasharray="2 1"/>` + NL +
  `<g transform="translate(${X0.toFixed(1)},${(Y0 - 18).toFixed(1)})">${legenda}${nota}</g>` + NL + pezzi.join(NL) + NL + `</svg>`;
  const passaggiSvg: string[][] = colori.map(() => []);
  let dst: Uint8Array | null = null;
  let statDst = { punti: 0, filoM: 0, blocchi: 0, salti: 0, saltiM: 0, passaggi: 0, passaggiM: 0, puntiCorti: 0, passaggiScopertiM: 0, righeFuoriOrdine: 0 };
  // --- 7. il DST ---------------------------------------------------------------------------------------------
  // Lorenzo (2026-09-09): «possiamo procedere per costruire il dst? e di conseguenza i passaggi?
  // ovviamente tutto si deve muovere a serpentina, in modo che sia tutto continuo».
  // Un tratto coi suoi denti E' gia' una linea continua: radice -> punta -> radice -> radice dopo. Le
  // basi di un blocco si cuciono in ordine di livello, una all'andata e una al ritorno (serpentina):
  // i capi di due livelli vicini stanno a un passo, e il collegamento e' un punto solo. Fra un pezzo e
  // l'altro: se il vuoto e' corto (fino a PASSAGGIO_MM) si attraversa con punti di passaggio, se e'
  // lungo si salta (la macchina taglia). I colori si cuciono dal chiaro allo scuro: il chiaro sta sotto.
  // Punto minimo 1 mm (R3): un dente tagliato sotto il millimetro non si cuce.
  if (DENTI && par.dst !== false) {
    // fino a tanto si attraversa cucendo (punti da 3 mm al massimo): i capi di due livelli vicini dello
    // stesso colore si spostano lungo il confine di colore, e con un confine obliquo lo scarto supera
    // i 4 mm (misurato: 1.064 salti fra livelli vicini con 4 mm; il passaggio corre dentro il colore)
    // Lorenzo (2026-09-10): «ti chiederei di fare i passaggi il piu' possibile e di usare anche i
    // bordi in caso di necessita'. Se invece non riesci lascia un salto lungo, quindi non inserire
    // niente, e vedro' che ci sono 2 blocchi separati». Quindi: si cerca lontano (60 mm invece di
    // 25) e si accetta anche una strada tortuosa, purche' passi dove qualcosa la coprira'.
    // Da 60 a 200 mm (2026-09-10, «fare i passaggi il piu' possibile»): i salti sul pannello passano
    // da 177 a 34, e il filo di passaggio che resta a vista sale solo da 4,5 a 5,6 m su 580 — le
    // strade coperte l'A* le trova quasi sempre, e quando non le trova salta come chiede Lorenzo.
    const PASSAGGIO_MM = 200;  // fin qui si prova a cucire il passaggio; oltre, si salta
    const CORTO_MM = 4;        // fin qui si va dritti senza cercare strade
    const MIN_MM = 1;
    const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
    const paths: DstPath[] = [];
    let corrente: Point | null = null;
    let punti = 0, filo = 0, passaggi = 0, filoPassaggi = 0, salti = 0, filoSalti = 0, corti = 0, dentiSaltati = 0;
    let cortiSormonto = 0, filoScoperto = 0, passaggiInstradati = 0, inversioni = 0, passaggiDiTraverso = 0;
    let andateRitorno = 0, filoImpuntura = 0;
    // fin qui una riga si puo' servire con andata e ritorno: piu' lunga, il filo nascosto costa piu' del salto
    const ANDATA_RITORNO_MAX = 70;
    // oltre questa distanza il pezzo dopo e' «lontano»: il passaggio, se pure si trova, sara' lungo
    const LONTANO_MM = 60;
    let saltiSerpentina = 0, saltiFamiglia = 0, saltiSormonto = 0, saltiLunghi = 0, saltiVersoRigaCorta = 0, saltiVersoRigaLunga = 0;
    let fase: 'basi' | 'sormonto' = 'basi';
    let ultimoTratto: Tratto | null = null, prossimoTratto: Tratto | null = null;
    let pathPts: Array<[number, number]> = [];
    let ago = 1;
    const apri = (): void => { if (pathPts.length >= 2) paths.push({ needle: ago, points_mm: pathPts }); pathPts = []; };
    // forza: radici e punte si cuciono sempre; un capo di base o un punto di passaggio sotto il
    // millimetro si lascia perdere (il punto dopo lo assorbe)
    const cuciA = (p: Point, forza = false): void => {
      if (corrente) { const d = dist(corrente, p); if (d < 0.05) return; if (d < MIN_MM && !forza) return; filo += d; punti++; if (d < MIN_MM) { corti++; if (fase === 'sormonto') cortiSormonto++; } }
      pathPts.push([p.x, p.y]); corrente = p;
    };
    const vaiA = (p: Point): void => {
      // il collegamento. Corto: dritto, che tanto lo coprono i denti della riga dopo. Lungo: si cerca
      // una strada che passi dove verra' coperto (`instrada`); se non c'e', si salta e la macchina taglia.
      if (!corrente) { apri(); pathPts.push([p.x, p.y]); corrente = p; return; }
      const d = dist(corrente, p);
      if (d < 0.05) return;
      let strada: Point[] | null = null;
      const dOra = fase === 'basi' && ultimoTratto ? ultimoTratto.d : Infinity;
      if (d > CORTO_MM && d <= PASSAGGIO_MM) strada = instrada(corrente, p, ago - 1, dOra);
      if (d <= CORTO_MM || strada) {
        // i punti del passaggio: uno ogni 3 mm, e l'ultimo mai sotto il millimetro (R3) — l'arrivo e'
        // il capo della riga e deve essere esatto, quindi si toglie il penultimo invece di accorciare
        const via2 = strada ?? [corrente, p];
        const passi: Point[] = [];
        for (let i = 1; i < via2.length; i++) {
          const a = via2[i - 1], b = via2[i];
          const n = Math.max(1, Math.ceil(dist(a, b) / 3));
          for (let k = 1; k <= n; k++) passi.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
        }
        // niente punti sotto il minimo, e l'arrivo esatto: si scartano i punti troppo vicini al
        // precedente tenuto, poi si tolgono gli ultimi finche' l'arrivo non e' a distanza buona
        const arrivo = passi[passi.length - 1];
        const puliti: Point[] = [];
        let ref = corrente;
        for (const q of passi) if (dist(ref, q) >= MIN_MM) { puliti.push(q); ref = q; }
        while (puliti.length && dist(puliti[puliti.length - 1], arrivo) < MIN_MM) puliti.pop();
        puliti.push(arrivo);
        let scoperti = 0;
        let da = corrente;
        passaggiSvg[ago - 1].push(via([corrente, ...puliti]));
        for (const q of puliti) {
          if (aVista({ x: (da.x + q.x) / 2, y: (da.y + q.y) / 2 }, ago - 1, dOra)) scoperti += dist(da, q);
          cuciA(q, dist(da, q) >= MIN_MM);
          da = q;
        }
        // QUANTE RIGHE TAGLIA: un passaggio che corre nella striscia fra due righe non si vede, uno
        // che le attraversa in diagonale si', ed e' quello che si vedeva nell'anteprima. Si misura
        // dall'escursione della distanza dal muro lungo il cammino.
        {
          let dmin = Infinity, dmax = -Infinity;
          for (const q of [corrente, ...puliti]) { const i = cella(q); const dd = i >= 0 ? distDaMuro[i] : -1; if (dd >= 0) { if (dd < dmin) dmin = dd; if (dd > dmax) dmax = dd; } }
          if (dmax > dmin && dmax - dmin > BASI_MM * 3) passaggiDiTraverso++;
        }
        passaggi++; filoPassaggi += lunghezza(via2); filoScoperto += scoperti;
        if (strada) passaggiInstradati++;
      }
      else {
        apri(); pathPts.push([p.x, p.y]); corrente = p; salti++; filoSalti += d;
        if (fase === 'sormonto') saltiSormonto++;
        else if (ultimoTratto && prossimoTratto && ultimoTratto.fi === prossimoTratto.fi) {
          if (Math.abs(ultimoTratto.id - prossimoTratto.id) <= 1) saltiSerpentina++; else saltiFamiglia++;
          // quanto e' lunga la riga che si va a raggiungere: se e' corta, e' una fila isolata
          if (prossimoTratto.base.length) { const lb = lunghezza(prossimoTratto.base); if (lb < 25) saltiVersoRigaCorta++; else saltiVersoRigaLunga++; }
        }
        if (d > 20) saltiLunghi++;
      }
    };
    // LA MAPPA DI CHI COPRE CHI, per instradare i passaggi. Un passaggio cucito resta a vista se
    // nessuno gli passa piu' sopra: i colori si cuciono dal chiaro allo scuro, quindi una cella di
    // tinta piu' scura di quella corrente sara' ricamata dopo e lo nascondera'; una piu' chiara e'
    // gia' fatta e lo lascerebbe scoperto; fuori dal disegno il filo si vedrebbe sul tessuto nudo.
    const costoCella = (i: number, c: number, dOra: number): number => {
      const t = i < 0 ? -1 : tinta[i];
      if (t < 0) return 30;      // tessuto nudo: mai
      if (i >= 0 && soprafilo[i]) return 1;   // c'e' gia' una base: ripassandoci sopra il filo sparisce
      if (t > c) return 1;       // piu' scuro: si cuce dopo e ci passa sopra
      if (t < c) return 14;      // piu' chiaro: gia' cucito, resterebbe a vista
      // stessa tinta: dipende da DOVE. Piu' avanti della riga in corso vuol dire che li' devono
      // ancora passare delle righe, e saranno loro a coprire il filo; indietro e' roba gia' fatta.
      // Senza questa distinzione un passaggio tagliava dritto attraverso trenta righe gia' cucite,
      // e restava a vista: sono le diagonali che Lorenzo ha visto nell'anteprima.
      const d = distDaMuro[i];
      if (d < 0) return 8;
      if (d > dOra + BASI_MM * 0.5) return 2;
      if (d > dOra - BASI_MM * 1.5) return 5;   // la striscia attorno alla riga in corso: la coprono i suoi denti
      return 12;
    };
    // A VISTA = il filo di passaggio finisce dove nessuno ci passera' piu' sopra: una tinta piu'
    // chiara (gia' cucita) o il tessuto nudo. Dentro la propria tinta non conta: li' lo coprono i
    // denti della riga successiva, che e' esattamente il motivo per cui le righe vanno in ordine.
    const aVista = (p: Point, c: number, dOra: number): boolean => {
      const i = cella(p);
      const t = i < 0 ? -1 : tinta[i];
      if (i >= 0 && soprafilo[i]) return false;                 // sopra una base esistente: sparisce
      if (t < c) return true;                                   // tinta gia' cucita, o tessuto nudo
      if (t > c) return false;                                  // la coprira' un colore piu' scuro
      const d = distDaMuro[i];                                  // stessa tinta: conta dove
      return d >= 0 && d < dOra - BASI_MM * 1.5;                // indietro: le righe sono gia' passate
    };
    /**
     * IL PASSAGGIO CHE SI NASCONDE (Lorenzo, 2026-09-10): «prevedi anche dei passaggi che passando per
     * i bordi delle figure poi vengono coperti dai ricami di colore successivo». Fra due capi si cerca
     * il cammino piu' economico sulla mappa qui sopra (A* a 8 vicini sulla griglia da mezzo millimetro,
     * dentro il rettangolo dei due capi allargato di 12 mm): passa per le zone che verranno ricamate
     * dopo — cioe' lungo i bordi delle figure scure — invece di tagliare dritto nel chiaro gia' fatto.
     * Torna null se non trova niente di decente: allora si salta, e la macchina taglia.
     */
    const instrada = (a: Point, b: Point, c: number, dOra: number): Point[] | null => {
      const ia = cella(a), ib = cella(b);
      if (ia < 0 || ib < 0) return null;
      const marg = Math.round(20 / CELLA);   // quanto ci si puo' allargare per aggirare un ostacolo
      const ca = ia % COLS, ra = Math.floor(ia / COLS), cb = ib % COLS, rb = Math.floor(ib / COLS);
      const c0 = Math.max(0, Math.min(ca, cb) - marg), c1 = Math.min(COLS - 1, Math.max(ca, cb) + marg);
      const r0 = Math.max(0, Math.min(ra, rb) - marg), r1 = Math.min(ROWS - 1, Math.max(ra, rb) + marg);
      const W = c1 - c0 + 1, H = r1 - r0 + 1;
      if (W * H > 250000) return null;
      const idx = (cc: number, rr: number): number => (rr - r0) * W + (cc - c0);
      const G0 = new Float32Array(W * H).fill(Infinity);
      const prev = new Int32Array(W * H).fill(-1);
      const chiuso = new Uint8Array(W * H);
      const h = (cc: number, rr: number): number => Math.hypot(cc - cb, rr - rb) * CELLA;
      // una coda a mucchio, piccola: i nodi esplorati sono qualche migliaio
      const heap: Array<[number, number]> = [];
      const push = (f: number, n: number): void => {
        heap.push([f, n]);
        let i = heap.length - 1;
        while (i > 0) { const p2 = (i - 1) >> 1; if (heap[p2][0] <= heap[i][0]) break; [heap[p2], heap[i]] = [heap[i], heap[p2]]; i = p2; }
      };
      const pop = (): [number, number] | null => {
        if (!heap.length) return null;
        const top = heap[0], last = heap.pop()!;
        if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
        return top;
      };
      G0[idx(ca, ra)] = 0; push(h(ca, ra), idx(ca, ra));
      let esplorati = 0;
      while (heap.length && esplorati < 80000) {
        const top = pop()!;
        const n = top[1];
        if (chiuso[n]) continue;
        chiuso[n] = 1; esplorati++;
        const cc = c0 + (n % W), rr = r0 + Math.floor(n / W);
        if (cc === cb && rr === rb) break;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cc + dx, y = rr + dy;
          if (x < c0 || y < r0 || x > c1 || y > r1) continue;
          const m = idx(x, y);
          if (chiuso[m]) continue;
          const passo = (dx && dy ? 1.414 : 1) * CELLA;
          const g = G0[n] + passo * costoCella(y * COLS + x, c, dOra);
          if (g < G0[m]) { G0[m] = g; prev[m] = n; push(g + h(x, y), m); }
        }
      }
      const fine = idx(cb, rb);
      if (!Number.isFinite(G0[fine])) return null;
      const via2: Point[] = [];
      for (let n = fine; n >= 0; n = prev[n]) {
        const cc = c0 + (n % W), rr = r0 + Math.floor(n / W);
        via2.push({ x: ORIGX + cc * CELLA, y: ORIGY + rr * CELLA });
        if (n === idx(ca, ra)) break;
      }
      via2.reverse();
      if (via2.length < 2) return null;
      // via i punti allineati: il cammino esce a mezzo millimetro per cella, e cucirlo cosi' sarebbe
      // un punto ogni mezzo millimetro (sotto il minimo di R3)
      const snello: Point[] = [via2[0]];
      for (let i = 1; i + 1 < via2.length; i++) {
        const a2 = snello[snello.length - 1], b2 = via2[i], c2 = via2[i + 1];
        const ax = b2.x - a2.x, ay = b2.y - a2.y, bx = c2.x - b2.x, by = c2.y - b2.y;
        const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
        if ((ax * bx + ay * by) / (la * lb) < 0.999) snello.push(b2);
      }
      snello.push(via2[via2.length - 1]);
      via2.length = 0; via2.push(...snello);
      // quanto costa in media: 10 e' la meta' fra «coperto» (1-4) e «a vista» (14), cioe' si accetta
      // una strada che per un pezzo passa allo scoperto se il resto e' nascosto. Sopra, meglio saltare.
      const lung = lunghezza(via2);
      if (lung < 1e-6) return null;
      if (G0[fine] / lung > 8) return null;
      if (lung > 4 * Math.max(1, dist(a, b)) + 10) return null;
      return via2;
    };
    // la sequenza di un tratto: base[0], poi radice-punta-radice per ogni dente, poi base[fine]
    const sequenza = (t: Tratto, inverso: boolean): Point[] => {
      const seq: Point[] = [];
      const denti = inverso ? [...t.denti].reverse() : t.denti;
      const b0 = inverso ? t.base[t.base.length - 1] : t.base[0], b1 = inverso ? t.base[0] : t.base[t.base.length - 1];
      seq.push(b0);
      if (!denti.length) { for (const q of ricampiona(inverso ? [...t.base].reverse() : t.base, 2)) seq.push(q); }
      for (const [r, tip] of denti) { if (dist(r, tip) < MIN_MM) { dentiSaltati++; seq.push(r); continue; } seq.push(r, tip, r); }
      seq.push(b1);
      // un capo di base a meno di un millimetro dalla prima o ultima radice si lascia: l'ultima
      // radice sta a meno di un passo dal capo, e a rovescio faceva un punto da 0,8 mm (783 casi)
      if (seq.length >= 3 && dist(seq[0], seq[1]) < MIN_MM) seq.shift();
      if (seq.length >= 3 && dist(seq[seq.length - 1], seq[seq.length - 2]) < MIN_MM) seq.pop();
      return seq;
    };
    /**
     * L'ANDATA IN IMPUNTURA E IL RITORNO COL PETTINE (Lorenzo, 2026-09-10): «per integrarla, se
     * questa e' una linea singola, puoi passare due volte sul dietro del punto pettine: un passaggio
     * di impuntura per arrivare in fondo e quindi al punto di partenza, e poi tornare indietro per
     * fare il punto pettine. Questa cosa la puoi usare per provare a non mettere rasafilo».
     *
     * Si entra da un capo, si corre fino all'altro con punti da 3 mm sulla linea stessa della riga —
     * nessun dente, e il filo resta sotto — e si torna indietro cucendo il pettine, che lo copre.
     * Il filo cosi' ESCE DA DOVE E' ENTRATO: e' questo che fa risparmiare il salto, perche' la riga
     * dopo sta quasi sempre dalla parte da cui si e' arrivati. Costa la lunghezza della riga in filo
     * nascosto, quindi si usa solo sulle righe corte e solo quando serve davvero.
     */
    const PUNTO_IMPUNTURA_MM = 3;
    const sequenzaAndataRitorno = (t: Tratto, inverso: boolean): Point[] => {
      const base = inverso ? [...t.base].reverse() : t.base;
      const seq: Point[] = ricampiona(base, PUNTO_IMPUNTURA_MM);
      const fine = base[base.length - 1];
      if (!seq.length || dist(seq[seq.length - 1], fine) > MIN_MM) seq.push(fine);
      for (const q of sequenza(t, !inverso)) seq.push(q);
      return seq;
    };
    const eDente = (t: Tratto, q: Point): boolean => t.denti.some(([r, tip]) => r === q || tip === q);
    for (let c = 0; c < colori.length; c++) {
      ago = c + 1;
      apri();
      const miei = trattiTutti.filter((t) => t.col === c);
      // per famiglia: la famiglia piu' vicina al punto corrente, poi i suoi livelli in ordine
      const perFam = new Map<number, Tratto[]>();
      for (const t of miei) { const l = perFam.get(t.fi) ?? []; l.push(t); perFam.set(t.fi, l); }
      const famiglieRimaste = new Set(perFam.keys());
      while (famiglieRimaste.size) {
        let scelta = -1, best = Infinity;
        for (const f of famiglieRimaste) { const t0 = perFam.get(f)![0]; const d = corrente ? Math.min(dist(corrente, t0.base[0]), dist(corrente, t0.base[t0.base.length - 1])) : 0; if (d < best) { best = d; scelta = f; } }
        famiglieRimaste.delete(scelta);
        // L'ORDINE E' SACRO, e viene dalla macchina (Lorenzo, 2026-09-10): «il dietro del punto pettine
        // deve essere coperto dai pettini della riga successiva, non deve mai succedere il contrario,
        // altrimenti si rovina il ricamo». I denti vanno verso il chiaro, cioe' all'indietro, sopra la
        // riga precedente: quindi le righe si cuciono a distanza CRESCENTE dal muro, sempre, e la
        // serpentina alterna solo il verso in cui si percorre la riga, mai l'ordine. Fra tratti della
        // stessa riga (un livello spezzato in due) si prende il piu' vicino: li' non si coprono.
        const tratti = perFam.get(scelta)!.sort((a, b) => a.d - b.d || a.id - b.id);
        // La bbox serve a sapere se due righe si toccano: due righe lontane non si coprono mai, e
        // fra loro l'ordine non conta. Senza questa libertà l'ordine rigido faceva 927 salti da
        // 51 mm di mediana — la macchina taglia e riparte, e il ricamo si riempie di code.
        const box = tratti.map((t) => {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const q of t.base) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
          const m = DENTE_MAX;   // i denti escono dalla base: la riga occupa anche quelli
          return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
        });
        const VICINE_MM = BASI_MM + 1;
        const distBox = (a: typeof box[0], b: typeof box[0]): number =>
          Math.hypot(Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1)), Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1)));
        const fatti = new Uint8Array(tratti.length);
        let primo = 0;
        for (let n = 0; n < tratti.length; n++) {
          while (primo < tratti.length && fatti[primo]) primo++;
          // i candidati in ordine di vicinanza al punto corrente; si prende il primo AMMISSIBILE,
          // cioe' quello che non scavalca una riga piu' vicina al muro che gli stia addosso
          const ordine: number[] = [];
          for (let i = 0; i < tratti.length; i++) if (!fatti[i]) ordine.push(i);
          ordine.sort((a, b) => {
            const da = corrente ? Math.min(dist(corrente, tratti[a].base[0]), dist(corrente, tratti[a].base[tratti[a].base.length - 1])) : tratti[a].d;
            const db = corrente ? Math.min(dist(corrente, tratti[b].base[0]), dist(corrente, tratti[b].base[tratti[b].base.length - 1])) : tratti[b].d;
            return da - db;
          });
          let scelto = -1, inverso = false;
          for (const i of ordine) {
            let ok = true;
            for (let j = primo; j < tratti.length && tratti[j].d < tratti[i].d - 1e-6; j++) {
              if (fatti[j] || j === i) continue;
              if (distBox(box[i], box[j]) < VICINE_MM) { ok = false; break; }
            }
            if (!ok) continue;
            const t = tratti[i];
            const d0 = corrente ? dist(corrente, t.base[0]) : 0, d1 = corrente ? dist(corrente, t.base[t.base.length - 1]) : 1;
            scelto = i; inverso = d1 < d0;
            break;
          }
          if (scelto < 0) { scelto = ordine[0]; inverso = false; }
          // il controllo vero: la riga scelta non deve stare addosso a una piu' vicina al muro non ancora fatta
          for (let j = primo; j < tratti.length && tratti[j].d < tratti[scelto].d - 1e-6; j++) {
            if (fatti[j] || j === scelto) continue;
            if (distBox(box[scelto], box[j]) < VICINE_MM) { inversioni++; break; }
          }
          fatti[scelto] = 1;
          prossimoTratto = tratti[scelto];
          const t = tratti[scelto];
          // conviene uscire da dove si entra? Si guarda dove sta il pezzo che verra' dopo.
          const entrata = inverso ? t.base[t.base.length - 1] : t.base[0];
          const uscita = inverso ? t.base[0] : t.base[t.base.length - 1];
          let dopoEntrata = Infinity, dopoUscita = Infinity;
          for (let i = 0; i < tratti.length; i++) {
            if (fatti[i]) continue;
            for (const q of [tratti[i].base[0], tratti[i].base[tratti[i].base.length - 1]]) {
              dopoEntrata = Math.min(dopoEntrata, dist(entrata, q));
              dopoUscita = Math.min(dopoUscita, dist(uscita, q));
            }
          }
          const lungaRiga = lunghezza(t.base);
          // Quando conviene: o il giro in piu' per tornare al capo di entrata costa piu' del filo
          // dell'impuntura, oppure uscendo dall'altra parte il pezzo dopo resta cosi' lontano che
          // quasi sicuramente si finirebbe per tagliare. Nella serpentina normale non scatta mai —
          // li' la riga dopo comincia proprio dove finisce questa — ed e' giusto cosi'.
          const andataRitorno = t.denti.length > 0
            && lungaRiga <= ANDATA_RITORNO_MAX
            && Number.isFinite(dopoUscita)
            && (dopoUscita - dopoEntrata > lungaRiga
              || (dopoUscita > LONTANO_MM && dopoEntrata < dopoUscita - CORTO_MM));
          const seq = andataRitorno ? sequenzaAndataRitorno(t, inverso) : sequenza(t, inverso);
          if (andataRitorno) { andateRitorno++; filoImpuntura += lungaRiga; }
          vaiA(seq[0]);
          for (let i = 1; i < seq.length; i++) cuciA(seq[i], eDente(t, seq[i]));
          ultimoTratto = t;
        }
      }
      // il sormonto: i denti che i colori piu' scuri cuciono anche con questo colore, prima e sotto.
      // Corrono lungo la base scura: radice-punta-radice, e fra due radici lontane si salta.
      fase = 'sormonto';
      // le corse di sormonto (una per tratto scuro) si prendono ognuna dalla piu' vicina al punto corrente
      const corse: Array<Array<[Point, Point]>> = [];
      for (const t of trattiTutti) { const l = t.sotto.get(c); if (l && l.length) corse.push(l); }
      const fatteC = new Uint8Array(corse.length);
      for (let n = 0; n < corse.length; n++) {
        let scelta = -1, inverso = false, dBest = Infinity;
        for (let i = 0; i < corse.length; i++) {
          if (fatteC[i]) continue;
          const l = corse[i];
          const d0 = corrente ? dist(corrente, l[0][0]) : 0, d1 = corrente ? dist(corrente, l[l.length - 1][0]) : 1;
          if (Math.min(d0, d1) < dBest) { dBest = Math.min(d0, d1); scelta = i; inverso = d1 < d0; }
        }
        fatteC[scelta] = 1;
        const l = inverso ? [...corse[scelta]].reverse() : corse[scelta];
        for (const [r, tip] of l) { if (dist(r, tip) < MIN_MM) { dentiSaltati++; continue; } if (!corrente || dist(corrente, r) > CORTO_MM) vaiA(r); else cuciA(r); cuciA(tip, true); cuciA(r, true); }
      }
      fase = 'basi';
      apri();
    }
    // l'origine del DST è l'angolo del riquadro: uno swatch parte da (0,0), non da dov'era nel pannello
    for (const pa of paths) for (const q of pa.points_mm) { q[0] -= X0; q[1] -= Y0; }
    dst = buildDst({ label: 'PETTINE', coordinate_system: 'svg', paths, metadata: ing.progetto ?? undefined });
    console.log(`ANDATA E RITORNO su ${andateRitorno} righe corte (${(filoImpuntura / 1000).toFixed(2)} m di impuntura nascosta sotto i denti)`);
    console.log(`SALTI per tipo: ${saltiSerpentina} fra righe vicine dello stesso gruppo · ${saltiFamiglia} fra righe lontane dello stesso gruppo · ${saltiSormonto} nel sormonto · il resto fra gruppi o colori diversi · di quelli dentro un gruppo, ${saltiVersoRigaCorta} vanno verso una riga corta (sotto 25 mm) e ${saltiVersoRigaLunga} verso una riga lunga`);
    console.log(`DST: ${punti} punti · ${(filo / 1000).toFixed(1)} m di filo · ${colori.length} aghi · ${paths.length} blocchi (${salti} salti, ${(filoSalti / 1000).toFixed(1)} m) · ${passaggi} passaggi cuciti (${(filoPassaggi / 1000).toFixed(1)} m, ${passaggiInstradati} instradati, ${passaggiDiTraverso} di traverso alle righe, ${(filoScoperto / 1000).toFixed(2)} m a vista) · ${corti} punti sotto ${MIN_MM} mm · ${inversioni} righe cucite fuori ordine · ${dentiSaltati} denti sotto il millimetro non cuciti`);
    statDst = { punti, filoM: filo / 1000, blocchi: paths.length, salti, saltiM: filoSalti / 1000, passaggi, passaggiM: filoPassaggi / 1000, puntiCorti: corti, passaggiScopertiM: filoScoperto / 1000, righeFuoriOrdine: inversioni };
  }

  // L'ANTEPRIMA si costruisce dopo il DST perche' deve mostrare anche i PASSAGGI cuciti: sono filo
  // vero, e Lorenzo deve poter guardare dove corrono prima di mandare in macchina.
  if (DENTI) {
    const pz: string[] = [];
    colori.forEach((c, t) => {
      const tratto = t === 0 ? '#9a9a9a' : c;
      if (perColore[t].length) pz.push(`<path d="${perColore[t].join('')}" fill="none" stroke="${tratto}" stroke-width="0.1"/>`);
      if (perColoreDenti[t].length) pz.push(`<path d="${perColoreDenti[t].join('')}" fill="none" stroke="${tratto}" stroke-width="0.1"/>`);
      if (par.mostraPassaggi !== false && passaggiSvg[t].length) pz.push(`<path d="${passaggiSvg[t].join('')}" fill="none" stroke="${tratto}" stroke-width="0.06" opacity="0.45"/>`);
    });
    if (par.mostraNudi) pz.push(`<g>${nudiFilo.join('')}</g>`);
    svgPettine = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(X0 - MARG).toFixed(1)} ${(Y0 - MARG).toFixed(1)} ${(RQ.larghezza + 2 * MARG).toFixed(1)} ${(RQ.altezza + 2 * MARG).toFixed(1)}" width="${(RQ.larghezza + 2 * MARG).toFixed(1)}mm" height="${(RQ.altezza + 2 * MARG).toFixed(1)}mm">` + NL +
  progettoSvg + `<rect x="${(X0 - MARG).toFixed(1)}" y="${(Y0 - MARG).toFixed(1)}" width="${(RQ.larghezza + 2 * MARG).toFixed(1)}" height="${(RQ.altezza + 2 * MARG).toFixed(1)}" fill="#f7f6f3"/>` + NL +
  `<rect x="${X0.toFixed(1)}" y="${Y0.toFixed(1)}" width="${RQ.larghezza.toFixed(1)}" height="${RQ.altezza.toFixed(1)}" fill="none" stroke="#333" stroke-width="0.3" stroke-dasharray="2 1"/>` + NL + pz.join(NL) + NL + `</svg>`;
    console.log(`DENTI: ${dentiTot} denti · ${(filoMm / 1000).toFixed(1)} m di filo nei denti · ${fermati} fermati a un bordo netto, ${attraversano} attraversano una sfumatura`);
  }


    return {
      svg: svgPettine || svgVerifica,
      svgVerifica,
      dst,
      statistiche: {
        larghezzaMm: WM, altezzaMm: HM, riquadro: RQ, colori,
        famiglie: famOk, famiglieSaltate: famSaltate,
        tratti: lineeFinali.length, trattiCorti: trattiCorti, basiM: basiM,
        rammendi,
        denti: dentiTot, filoDentiM: filoMm / 1000, dentiFermati: fermati, dentiAttraversano: attraversano,
        nudoPct: (nude / Math.max(1, dentro)) * 100,
        densoPct: (dense / Math.max(1, dentro)) * 100,
        nudoFiloPct: nudoFiloPct,
        spaziaturaMedianaMm: spaziatura.mediana,
        spaziaturaDecimoMm: spaziatura.decimo,
        righeAddossoPct: spaziatura.sottoMezzoPasso,
        righeAddossoStessoGruppoPct: spaziatura.sottoMezzoPassoStessoGruppo,
        ...statDst,
        secondi: (Date.now() - t0) / 1000,
      },
      note,
    };
  }
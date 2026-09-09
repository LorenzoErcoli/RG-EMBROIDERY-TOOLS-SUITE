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
  /**
   * Fin dove si prova a cucire un passaggio invece di tagliare (mm). Piu' e' alto, meno tagli e piu'
   * filo teso in giro: un passaggio corto sparisce fra le righe, uno lungo si vede. Misurato sul
   * pannello: a 15 mm 552 salti e nessun passaggio sopra i 3 cm; a 30 mm 377 salti; a 60 mm 223
   * salti e 154 passaggi lunghi; a 200 mm 132 salti e 245 passaggi lunghi.
   */
  passaggioMaxMm?: number;
  /**
   * Quanto deve durare una tinta lungo una riga per meritare un cambio di colore (mm). Sotto questa
   * misura la riga tiene il colore che aveva: senza, una riga che attraversa quattro tinte si spezza
   * in quattro pezzi, e i pezzetti da 5 mm costringono il filo del loro colore ad andarseli a
   * prendere uno per uno da lontano.
   */
  tintaMinimaMm?: number;
  /**
   * Fin dove si prova un passaggio che va OLTRE `passaggioMaxMm`, e che quindi si fa solo se il
   * cammino resta nascosto sotto cio' che verra' dopo. E' il baratto fra i rasafili e le linee
   * lunghe, e Lorenzo l'ha deciso guardando il ricamo (2026-09-10): «faceva i passaggi cosi' lunghi
   * che metteva i raso a filo» — cioe' un passaggio lungo non evita il taglio, ci si aggiunge.
   * Sul pannello a sei tinte: 30 mm (nessun passaggio oltre la manopola) 269 tagli · 45 mm 243 tagli
   * con 28 passaggi appena sopra i 3 cm · 90 mm 185 tagli ma 84 linee lunghe.
   */
  passaggioNascostoMm?: number;
  /**
   * IL LABORATORIO DEI CASI (Lorenzo, 2026-09-10): «creiamo un lab di studi in cui proviamo a vedere
   * come hai risolto i passaggi e io ti dico come andrebbero fatti». Quanti casi registrare per ogni
   * tipo (taglio, passaggio lungo, corridoio di una macchia), con tutto quello che c'era intorno nel
   * momento della decisione. 0 = nessuno. Escono in `esito.casi`, e `scripts/lab.ts` li disegna.
   */
  casiStudio?: number;
  /**
   * Fin dove la riga piu' esterna di una fascia attraversa una gola senza spezzarsi (mm): un tratto di
   * tinta piu' chiara, gia' cucita, o troppo addossato alla riga prima, incastrato fra due tratti della
   * stessa tinta. Lorenzo (2026-09-10): «continui quella per raggiungere l'altra». 0 = mai.
   */
  golaMm?: number;
  /**
   * Quanti ULTIMI colori non fanno passaggi liberi. Sotto di loro non viene più nessuno a coprire il
   * filo, quindi lì un passaggio si fa solo se resta corto (60 mm) e se il cammino è tutto in zona
   * ancora da ricamare, che i loro stessi denti copriranno. Lorenzo (2026-09-10): «negli ultimi 2
   * stop per ora non fare passaggi perché non riusciranno ad essere coperti».
   */
  senzaPassaggiUltimiColori?: number;
  /** Costruire anche il DST (costa qualche secondo in più). */
  dst?: boolean;
}

export const parametriPettineDefault: ParametriPettine = {
  basiMm: 2, sormontoMm: 4, addolcisciMm: 0.15, lisciaMaxMm: 8, spianaMm: 5, chiudiMm: 3,
  traslaMaxMm2: 9000, sconfinaMm: 1,
  denteMinMm: 3, denteMaxMm: 5, passoMm: 1.5, aperturaDeg: 40, nettoMm: 2.5,
  denti: true, modo: 'auto', mostraNudi: false, mostraPassaggi: true,
  passaggioMaxMm: 30, tintaMinimaMm: 6, passaggioNascostoMm: 400, senzaPassaggiUltimiColori: 0, dst: true,
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
  /** Righe cucite fuori dall'ordine di copertura DENTRO un colore, verificate dente per dente sulla cucitura vera: deve essere zero. */
  righeFuoriOrdine: number;
  /** Coppie di righe di colori diversi che si toccano dove lo scuro sta piu' vicino al muro del chiaro: li' il chiaro, cucito prima, copre il dietro dello scuro. E' la geometria del gradiente, non la sequenza. */
  copertureFraColori: number;
  /** Righe piccole cucite DENTRO una riga vicina, spezzandola, invece di raggiungerle da lontano. */
  righeInglobate: number;
  /** Il passaggio piu' lungo che si cuce: non puo' superare il tetto dei passaggi nascosti. */
  passaggioPiuLungoMm: number;
  /** Metri di strada distinta percorsa dai passaggi: meno di `passaggiM` vuol dire che si ripassano sopra. */
  corridoiM: number;
  secondi: number;
}

/** Un caso del laboratorio: la situazione nel momento in cui il filo ha deciso, e cosa ha deciso. */
export interface CasoStudio {
  /** `taglio` = la macchina ha tagliato · `passaggio` = passaggio cucito oltre la manopola · `innesto` = corridoio verso o da una macchia */
  tipo: 'taglio' | 'passaggio' | 'innesto';
  /** un nome stabile fra una corsa e l'altra: ago, riga da cui si parte, riga dove si arriva */
  nome: string;
  ago: number;
  da: [number, number]; a: [number, number];
  daId: number; aId: number;
  /** la finestra disegnata: centro e mezzo lato, in mm */
  cx: number; cy: number; R: number;
  /** le righe di questo colore nella finestra, com'erano in quel momento */
  righe: Array<{ id: number; d: number; sorm: boolean; cucita: boolean; base: number[][] }>;
  /** la strada: quella cucita, oppure la migliore trovata anche se bocciata */
  strada: number[][] | null;
  /** i punti della strada che restano a vista */
  scoperte: number[][];
  /** la mappa a mezzo millimetro: . fuori · c tinta dell'ago · s tinte dopo · l tinte prima · B dietro libero · D dente cucito · P base cucita coperta */
  mappa: string[];
  giudizio: { costoMedio: number; lung: number; aVista: number; d: number } | null;
  cosaHoFatto: string;
}

export interface EsitoPettine {
  /** L'anteprima del ricamo: basi e denti, un colore per tinta. */
  svg: string;
  /** La verifica: solo le basi, coi muri, le frecce del verso e le macchie del metro. */
  svgVerifica: string;
  /** Il file per la macchina, con l'origine nell'angolo del ritaglio. */
  dst: Uint8Array | null;
  statistiche: StatistichePettine;
  /** i casi del laboratorio, se `casiStudio` > 0 */
  casi: CasoStudio[];
  note: string[];
}

export function costruisciPettine(ing: IngressoPettine, par: ParametriPettine = parametriPettineDefault): EsitoPettine {
  const note: string[] = [];
  const casi: CasoStudio[] = [];
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
  // quanto deve durare una tinta lungo una riga per meritare un cambio di colore
  const TINTA_MINIMA_MM = Math.max(0, par.tintaMinimaMm ?? 6);
  // fin qui la riga dentata attraversa una gola (tinta piu' chiara, o troppo addosso) senza spezzarsi
  const GOLA_MM = Math.max(0, par.golaMm ?? 30);
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
  // DOVE C'E', O CI SARA', UNA BASE. Un filo di passaggio che ripassa sopra una base si confonde
  // con lei; se la base non e' ancora stata cucita, ci finisce addirittura SOTTO. Lorenzo
  // (2026-09-10): «se riesci a far coincidere i passaggi con le linee che successivamente saranno
  // il fondo del pettine successivo». Sono le strade buone per andare da un pezzo all'altro senza
  // tagliare il campo, e si segnano tutte prima di cucire, non mano a mano.
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
  interface Tratto { col: number; fi: number; id: number; d: number; base: Point[]; denti: Array<[Point, Point]>; sotto: Map<number, Array<[Point, Point]>>; sorm?: boolean; ospite?: boolean; innestato?: boolean }
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
  function stabilizza(cols: number[], min: number, gola = 0): number[] {
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
    /**
     * LA RIGA DENTATA CONTINUA ATTRAVERSO LA GOLA (Lorenzo, 2026-09-10, quindicesima tornata: «se non
     * che continui quella per raggiungere l'altra»). Una fascia sottile si restringe, e la riga piu'
     * esterna per un tratto esce nella tinta piu' chiara accanto (gia' cucita) o si ritrova addosso
     * alla riga precedente: prima si spezzava in due pezzi, e il pezzo di la' restava orfano, con un
     * taglio per raggiungerlo. Ora, se il tratto e' corto (fino a `gola` punti) e da tutte e due le
     * parti c'e' la stessa tinta, la riga lo attraversa intera: il pettine scuro passa sopra il chiaro,
     * che e' comunque l'ordine giusto, e nella gola si stringe un po' verso la riga prima. Fuori dal
     * gruppo (-2) non si va mai: quello e' territorio di un altro blocco di Lorenzo.
     */
    if (gola > 0) {
      i = 0;
      while (i < out.length) {
        let j = i;
        while (j < out.length && out[j] === out[i]) j++;
        const v = out[i];
        if (i > 0 && j < out.length && j - i <= gola && v !== -2) {
          const t1 = out[i - 1], t2 = out[j];
          if (t1 >= 0 && t1 === t2 && (v === -1 || v < t1)) for (let k = i; k < j; k++) out[k] = t1;
        }
        i = j;
      }
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
        // MAI FRAMMENTI: una tinta che dura meno di TINTA_MINIMA_MM lungo la riga non merita un cambio
      // di colore, e prende quello del tratto che la precede. Senza, una riga che attraversa quattro
      // tinte si spezzava in quattro pezzi, e i pezzetti da 5 mm costringevano il filo del loro
      // colore ad andare a prenderli uno per uno da lontano (Lorenzo, 2026-09-10: «mi stai tornando
      // su blocchi che sono vicini... i passaggi rischiano di vedersi»).
      const colori = stabilizza(grezzi, Math.max(2, Math.round(TINTA_MINIMA_MM / 0.5)), Math.round(GOLA_MM / 0.5));
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
      const colori = stabilizza(morbida.map((p, i) => (!dentroFam(p) ? -2 : tieni[i] ? tintaIn(p) : -1)), Math.max(2, Math.round(TINTA_MINIMA_MM / 0.5)), Math.round(GOLA_MM / 0.5));
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
  // tutte le basi, anche quelle che devono ancora essere cucite: sotto una di quelle il passaggio
  // finisce coperto quando lei si cuce (Lorenzo: «far coincidere i passaggi con le linee che
  // successivamente saranno il fondo del pettine successivo»)
  for (const t of trattiTutti) stendi(t.base);
  /**
   * IL SORMONTO DIVENTA UNA RIGA COME LE ALTRE. I denti che un tratto scuro fa cucire anche col
   * colore chiaro erano una fase a se', in coda al colore: corse sparse per tutto il pannello, prese
   * una per una, e su un pannello senza passaggi lunghi erano 164 tagli su 364 — il mucchio piu'
   * grosso. Il primo tentativo (2026-09-10) fu di attaccarle alle righe del loro colore, e peggiorava:
   * spezzava catene che gia' funzionavano. La risposta giusta e' un'altra: non attaccarle a niente,
   * ma farne delle righe vere. Una corsa di denti lungo una base scura ha un suo percorso, due capi e
   * una distanza dal muro, esattamente come una riga; se entra nell'elenco dei tratti, entra da sola
   * nella sequenza, nel conto dei versi, negli innesti e nei corridoi, senza codice suo.
   *
   * La distanza dal muro e' quella vera delle sue radici, e viene grande: i denti di sormonto stanno
   * oltre l'ultima riga del loro colore, e i loro denti vanno all'indietro a coprirla. Quindi l'ordine
   * di copertura li mette dopo, che e' proprio quello che serve.
   */
  // (si fa qui, dopo le misure sulla spaziatura: una corsa di denti non e' una riga di base, e
  // contata come tale direbbe che le righe si stringono)
  {
    let idSorm = 1000000;
    const nuovi: Tratto[] = [];
    for (const t of trattiTutti) {
      for (const c of [...t.sotto.keys()]) {
        const lista = t.sotto.get(c) ?? [];
        t.sotto.delete(c);
        let corsa: Array<[Point, Point]> = [];
        const chiudiCorsa = (): void => {
          if (!corsa.length) return;
          const base = corsa.map((x) => x[0]);
          let somma = 0, quanti = 0;
          for (const q of base) { const i = cella(q); if (i >= 0 && distDaMuro[i] >= 0) { somma += distDaMuro[i]; quanti++; } }
          // dove le righe non hanno una distanza vera (costruzione a livelli) l'ordine lo fa l'id,
          // e l'id del sormonto e' piu' alto di qualunque livello: viene dopo, come deve
          const dd = t.d >= 1e8 ? 1e9 : quanti ? somma / quanti : t.d;
          nuovi.push({ col: c, fi: t.fi, id: idSorm++, d: dd, base: base.length >= 2 ? base : [base[0], base[0]], denti: corsa, sotto: new Map(), sorm: true });
          corsa = [];
        };
        for (const dente of lista) {
          if (corsa.length && Math.hypot(corsa[corsa.length - 1][0].x - dente[0].x, corsa[corsa.length - 1][0].y - dente[0].y) > 4) chiudiCorsa();
          corsa.push(dente);
        }
        chiudiCorsa();
      }
    }
    trattiTutti.push(...nuovi);
    console.log(`SORMONTO: ${nuovi.length} corse diventate righe a tutti gli effetti (prima erano una fase a parte, in coda al colore)`);
  }
  const passaggiSvg: string[][] = colori.map(() => []);
  /**
   * DOVE IL FILO E' GIA' PASSATO, dentro il colore in corso. Lorenzo (2026-09-10, settima tornata):
   * «cercare di passare, a costo di passare piu' volte, sullo stesso punto del passaggio successivo
   * dello stesso colore». Un passaggio che si apre una strada nuova e' una riga in piu' che si vede;
   * dieci passaggi che percorrono lo stesso corridoio si vedono una volta sola. Quindi una cella gia'
   * battuta dal filo di questo colore costa quasi niente, e i cammini si accalcano invece di sparpagliarsi.
   */
  const battuto = new Uint8Array(COLS * ROWS);   // quante volte il filo di passaggio e' passato di li' (fino a 255)
  /**
   * DOVE C'E' GIA' UN PETTINE. Lorenzo (2026-09-10, undicesima tornata): «la linea non passa mai
   * sopra dei pettini creati ma solo sotto». Ogni punto cucito — basi e denti, di tutti i colori —
   * segna qui la sua cella, e da quel momento un passaggio non ci puo' piu' correre: passerebbe SOPRA
   * il pettine, e resterebbe li' a vista. L'unica eccezione e' la linea di base della riga appena
   * cucita (e delle future): li' il passaggio sta sul dietro del pettine, sotto i denti della riga
   * dopo, che e' proprio dove Lorenzo lo vuole.
   */
  const pettineCucito = new Uint8Array(COLS * ROWS);
  /**
   * DOVE CI SONO DENTI GIA' CUCITI, distinti dalle basi. Lorenzo (2026-09-10, quattordicesima
   * tornata): «mi verrebbe in mente di spostarmi sul dietro della riga pettine sopra, fare un
   * passaggio e poi discendere per poi proseguire». Il dietro di una riga gia' cucita e' un corridoio
   * finche' nessun dente ci sta sopra: e nella gola di una fascia sottile, dove la riga esterna manca,
   * il dietro della riga sopra e' scoperto di denti. Questa mappa serve a saperlo.
   */
  const dentiCuciti = new Uint8Array(COLS * ROWS);
  /**
   * DAVANTI E DIETRO, cella per cella. Una cella e' «davanti» se entro un passo c'e' una base del
   * colore in corso NON ANCORA CUCITA: li' i denti di quella riga, quando verra', copriranno il filo.
   * E' un conteggio, non una distanza: prima si usava la distanza dal muro dell'ultima riga cucita
   * (o il fronte della famiglia), e sbagliava ogni volta che una famiglia aveva due zone a stadi
   * diversi — la zona ancora da fare risultava «dietro» perche' l'altra era gia' salita. Ogni riga
   * del colore, all'inizio, somma 1 alle celle a un passo dalla sua base; quando viene cucita toglie 1.
   */
  const baseFutura = new Int16Array(COLS * ROWS);
  const RAGGIO_FUTURA = Math.ceil((BASI_MM * 1.1) / CELLA);
  const segnaBaseFutura = (t: Tratto, delta: number): void => {
    const viste = new Set<number>();
    for (let k = 1; k < t.base.length; k++) {
      const a = t.base[k - 1], b = t.base[k];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELLA / 2)));
      for (let u = 0; u <= n; u++) {
        const ic = cella({ x: a.x + ((b.x - a.x) * u) / n, y: a.y + ((b.y - a.y) * u) / n });
        if (ic < 0) continue;
        const cc = ic % COLS, rr = (ic - cc) / COLS;
        for (let dy = -RAGGIO_FUTURA; dy <= RAGGIO_FUTURA; dy++) for (let dx = -RAGGIO_FUTURA; dx <= RAGGIO_FUTURA; dx++) {
          if (dx * dx + dy * dy > RAGGIO_FUTURA * RAGGIO_FUTURA) continue;
          const x = cc + dx, y = rr + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          viste.add(y * COLS + x);
        }
      }
    }
    if (t.base.length === 1) { const ic = cella(t.base[0]); if (ic >= 0) viste.add(ic); }
    for (const j of viste) baseFutura[j] += delta;
  };

  let dst: Uint8Array | null = null;
  let statDst = { punti: 0, filoM: 0, blocchi: 0, salti: 0, saltiM: 0, passaggi: 0, passaggiM: 0, puntiCorti: 0, passaggiScopertiM: 0, righeFuoriOrdine: 0, copertureFraColori: 0, righeInglobate: 0, passaggioPiuLungoMm: 0, corridoiM: 0 };
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
    const PASSAGGIO_MM = Math.max(4, par.passaggioMaxMm ?? 30);  // fin qui si prova a cucire il passaggio; oltre, si salta
    const CORTO_MM = 4;        // fin qui si va dritti senza cercare strade
    const MIN_MM = 1;
    const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
    const paths: DstPath[] = [];
    let corrente: Point | null = null;
    let punti = 0, filo = 0, passaggi = 0, filoPassaggi = 0, salti = 0, filoSalti = 0, corti = 0, dentiSaltati = 0;
    let filoScoperto = 0, passaggiInstradati = 0, inversioni = 0, passaggiDiTraverso = 0;
    let andateRitorno = 0, filoImpuntura = 0, filoScopertoUltimi = 0;
    const lunghezzePassaggi: number[] = [];
    // Fin qui una riga si puo' servire con andata e ritorno. Era 70 mm, per paura del filo di
    // impuntura in piu'; misurato, conviene alzarlo quasi a togliere il limite: i tagli scendono da
    // 300 a 269 e si pagano 8 metri di impuntura, che stanno sotto i denti e non si vedono.
    const ANDATA_RITORNO_MAX = 200;
    // quanto costa un rasafilo, misurato in millimetri di filo: e' la moneta con cui si confrontano
    // un salto e i modi per evitarlo (fare un giro piu' lungo, o l'andata e ritorno in impuntura).
    // Alto apposta: Lorenzo (2026-09-10) «io devo avere pochi rasafilo e pochissimi passaggi».
    const RASAFILO_MM = 300;
    // quanti ULTIMI colori non fanno passaggi lunghi: sotto di loro non viene piu' nessuno a coprirli
    // Era 2 (Lorenzo, 2026-09-10: «negli ultimi 2 stop non fare passaggi, non verranno coperti»), ed
    // era giusto quando la mappa dava per coperto cio' che non lo era. Da quando «coperto» si decide
    // cella per cella — il dietro di una riga, la striscia davanti a una base da fare — vale per ogni
    // colore allo stesso modo, e l'eccezione era il freno piu' grosso rimasto: 148 tagli -> 40.
    const SENZA_PASSAGGI = Math.max(0, Math.round(par.senzaPassaggiUltimiColori ?? 0));
    // fin qui si prova un passaggio anche oltre la manopola, ma solo se e' tutto nascosto sotto
    // cio' che verra' dopo: e' la seconda tecnica chiesta da Lorenzo, e vale solo nei primi colori
    const PASSAGGIO_NASCOSTO_MM = Math.max(PASSAGGIO_MM, par.passaggioNascostoMm ?? 400);
    // quanto costa spostarsi di un millimetro in distanza dal muro, cioe' attraversare le righe
    // invece di correre lungo la striscia fra due di loro
    // due pezzi di uno stesso colore piu' vicini di cosi' sono la stessa zona di lavoro
    const ZONA_MM = 35;
    // un pezzo dello stesso livello entro questa distanza si fa prima di salire al livello dopo
    const STESSO_LIVELLO_MM = 30;
    // una riga fino a questa lunghezza si puo' inglobare dentro una vicina, spezzandola; e il punto
    // di innesto non puo' distare piu' di INNESTO_MM da un capo della riga da inglobare
    // una MACCHIA e' un pezzo di sequenza chiuso fra due tagli e lungo al massimo cosi': si incastra
    // dentro una riga grande vicina, andando e tornando per un corridoio nascosto
    const MACCHIA_MM = 300;
    // e il corridoio per andare a prenderla puo' essere lungo cosi', purche' resti tutto nascosto:
    // Lorenzo, «non ci interessa se questo necessita di piu' filo»
    const MACCHIA_CORRIDOIO_MM = 400;
    // di quanto si sfalsano, a destra e a sinistra, i punti di un passaggio: mosso, non dritto
    const MOSSO_MM = 0;   // lo zig zag: provato a 0,6 e 0,4, Lorenzo lo ha tolto (2026-09-10)
    let celleCorridoio = 0, celleAffollate = 0;   // celle di corridoio, e quelle dove il filo di passaggio e' passato tre o piu' volte
    let zoneTotali = 0, cambiZona = 0;
    let righeInnestate = 0, macchieInnestate = 0, macchieCandidate = 0, macchieSenzaVicina = 0, macchieNegateDallOrdine = 0, macchieSenzaCorridoio = 0;
    // e di quel cammino non piu' di tanti millimetri possono restare scoperti: e' il vero controllo,
    // il costo medio non bastava (Lorenzo: «i passaggi rischiano di vedersi»)
    const SCOPERTO_MAX_MM = 3;
    let passaggiNascosti = 0;
    let saltiSerpentina = 0, saltiFamiglia = 0, saltiSormonto = 0, saltiLunghi = 0, saltiVersoRigaCorta = 0, saltiVersoRigaLunga = 0;
    let ultimoTratto: Tratto | null = null, prossimoTratto: Tratto | null = null;
    let pathPts: Array<[number, number]> = [];
    let ago = 1;
    const apri = (): void => { if (pathPts.length >= 2) paths.push({ needle: ago, points_mm: pathPts }); pathPts = []; };
    // forza: radici e punte si cuciono sempre; un capo di base o un punto di passaggio sotto il
    // millimetro si lascia perdere (il punto dopo lo assorbe)
    let nienteFinestra = 0, nienteStrada = 0, nienteCosto = 0, nienteGiro = 0;
    // IL LABORATORIO DEI CASI: si registra la situazione nel momento della decisione
    const CASI_MAX = Math.max(0, Math.round(par.casiStudio ?? 0));
    const casiPerTipo = { taglio: 0, passaggio: 0, innesto: 0 };
    const registraCaso = (tipo: CasoStudio['tipo'], p: Point, d: number, strada: Point[] | null, dOra: number, cosaHoFatto: string): void => {
      if (!corrente || !CASI_MAX || casiPerTipo[tipo] >= CASI_MAX || !ultimoTratto || !prossimoTratto) return;
      casiPerTipo[tipo]++;
      const c = ago - 1;
      const cx = (corrente.x + p.x) / 2, cy = (corrente.y + p.y) / 2, R = Math.min(60, Math.max(30, d / 2 + 15));
      const dentro = (q: Point): boolean => Math.abs(q.x - cx) <= R && Math.abs(q.y - cy) <= R;
      const righe: CasoStudio['righe'] = [];
      for (const t of trattiTutti) {
        if (t.col !== c || !t.base.some(dentro)) continue;
        righe.push({ id: t.id, d: +t.d.toFixed(1), sorm: !!t.sorm, cucita: tempoDenti.has(t) && t !== prossimoTratto, base: ricampiona(t.base, 1.5).map((q) => [+q.x.toFixed(1), +q.y.toFixed(1)]) });
      }
      const via3 = strada ?? instrada(corrente, p, c, dOra, 1e9);
      const scoperte: number[][] = [];
      if (via3) for (let i = 1; i < via3.length; i++) {
        const a2 = via3[i - 1], b2 = via3[i];
        const n = Math.max(1, Math.ceil(dist(a2, b2) / CELLA));
        for (let k = 0; k < n; k++) { const q = { x: a2.x + ((b2.x - a2.x) * (k + 0.5)) / n, y: a2.y + ((b2.y - a2.y) * (k + 0.5)) / n }; if (aVista(q, c, dOra)) scoperte.push([+q.x.toFixed(1), +q.y.toFixed(1)]); }
      }
      const mappa: string[] = [];
      for (let y = -R; y <= R; y += 0.5) {
        let riga = '';
        for (let x = -R; x <= R; x += 0.5) {
          const ic = cella({ x: cx + x, y: cy + y });
          if (ic < 0 || tinta[ic] < 0) { riga += '.'; continue; }
          if (dentiCuciti[ic]) riga += 'D';
          else if (sulDietro(ic, c, dOra)) riga += 'B';
          else if (pettineCucito[ic]) riga += 'P';
          else riga += tinta[ic] === c ? 'c' : tinta[ic] > c ? 's' : 'l';
        }
        mappa.push(riga);
      }
      casi.push({
        tipo, nome: `a${ago}-${ultimoTratto.id}-${prossimoTratto.id}`, ago,
        da: [+corrente.x.toFixed(1), +corrente.y.toFixed(1)], a: [+p.x.toFixed(1), +p.y.toFixed(1)],
        daId: ultimoTratto.id, aId: prossimoTratto.id, cx, cy, R, righe,
        strada: via3 ? via3.map((q) => [+q.x.toFixed(1), +q.y.toFixed(1)]) : null, scoperte, mappa,
        giudizio: via3 ? { costoMedio: +costoMedio(via3, c, dOra).toFixed(2), lung: +lunghezza(via3).toFixed(1), aVista: +quantoAVista(via3, c, dOra).toFixed(1), d: +d.toFixed(1) } : null,
        cosaHoFatto,
      });
    };
    // l'orologio della cucitura: a ogni dente il momento in cui e' stato cucito, per la verifica finale
    let orologio = 0;
    const tempoDenti = new Map<Tratto, Float64Array>();
    const cuciA = (p: Point, forza = false, radice: Point | null = null): void => {
      if (corrente) {
        const d = dist(corrente, p); if (d < 0.05) return; if (d < MIN_MM && !forza) return; filo += d; punti++; if (d < MIN_MM) corti++;
        // il punto appena cucito segna dove c'e' un pettine: i passaggi di chiunque ci girano attorno.
        // Se e' un dente (`radice` e' la sua radice), lo segna anche fra i denti — sopra quelli non si
        // passa mai — MA NON ATTORNO ALLA RADICE: la radice sta sulla base, e la base e' il dietro su cui
        // si passa. Segnandola come dente il dietro di ogni riga era un corridoio interrotto ogni 1,5 mm.
        const n = Math.max(1, Math.ceil(d / (CELLA / 2)));
        for (let k = 0; k <= n; k++) {
          const q = { x: corrente.x + ((p.x - corrente.x) * k) / n, y: corrente.y + ((p.y - corrente.y) * k) / n };
          const ic = cella(q);
          if (ic < 0) continue;
          pettineCucito[ic] = 1;
          if (radice && dist(q, radice) > CELLA * 1.2) dentiCuciti[ic] = 1;
        }
      }
      pathPts.push([p.x, p.y]); corrente = p;
    };
    /**
     * C'E' UNA STRADA NASCOSTA DA QUI A LI'? Corta (fin CORTO_MM), si va dritti. Fin la manopola, si
     * cerca sulla mappa e si accetta se il costo medio e' decente. Oltre — fino al tetto dei passaggi
     * nascosti — si accetta solo se e' tutta coperta e a vista ne restano pochi millimetri, misurati.
     * Negli ultimi colori (`senzaPassaggiUltimiColori`) niente strade lunghe: sotto di loro non viene
     * piu' nessuno. Torna null quando non c'e': allora la macchina taglia.
     */
    const trovaStrada = (da: Point, a: Point, dOra: number, portata = PASSAGGIO_NASCOSTO_MM): Point[] | null => {
      const d = dist(da, a);
      if (d <= CORTO_MM) return [da, a];
      const ultimi = ago > colori.length - SENZA_PASSAGGI;
      const limite = ultimi ? Math.min(PASSAGGIO_MM, 60) : PASSAGGIO_MM;
      if (d <= limite) return instrada(da, a, ago - 1, dOra, ultimi ? 2.5 : 8);
      if (ultimi || d > portata) return null;
      const v = instrada(da, a, ago - 1, dOra, 5);
      return v && quantoAVista(v, ago - 1, dOra) <= SCOPERTO_MAX_MM ? v : null;
    };
    const vaiA = (p: Point, portata?: number): void => {
      // il collegamento. Corto: dritto, che tanto lo coprono i denti della riga dopo. Lungo: si cerca
      // una strada che passi dove verra' coperto (`instrada`); se non c'e', si salta e la macchina taglia.
      if (!corrente) { apri(); pathPts.push([p.x, p.y]); corrente = p; return; }
      const d = dist(corrente, p);
      if (d < 0.05) return;
      // la strada la decide `trovaStrada`, la stessa che usa chi pianifica gli innesti: cosi' un
      // corridoio promesso al momento di decidere e' lo stesso che si cuce davvero (R28)
      const dOra = ultimoTratto ? ultimoTratto.d : Infinity;
      const strada = trovaStrada(corrente, p, dOra, portata);
      if (strada && d > PASSAGGIO_MM) passaggiNascosti++;
      if (strada && d > PASSAGGIO_MM) registraCaso(portata === MACCHIA_CORRIDOIO_MM ? 'innesto' : 'passaggio', p, d, strada, dOra, `Passaggio cucito: ${d.toFixed(0)} mm in linea d'aria, ${lunghezza(strada).toFixed(0)} mm di strada, ${quantoAVista(strada, ago - 1, dOra).toFixed(1)} mm a vista, costo medio ${costoMedio(strada, ago - 1, dOra).toFixed(1)}.`);
      if (!strada) registraCaso('taglio', p, d, null, dOra, `Nessuna strada nascosta accettabile: la macchina taglia. Distanza ${d.toFixed(0)} mm.`);
      if (strada) {
        // i punti del passaggio: uno ogni 3 mm, e l'ultimo mai sotto il millimetro (R3) — l'arrivo e'
        // il capo della riga e deve essere esatto, quindi si toglie il penultimo invece di accorciare
        const via2 = strada;
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
        // IL PASSAGGIO E' MOSSO, NON DRITTO (Lorenzo: «facendo un passaggio mosso e non lineare»): una
        // fila di punti allineati si legge come una riga anche sotto la copertura; sfalsandoli di mezzo
        // millimetro a destra e a sinistra il filo si confonde coi denti che gli stanno sopra.
        if (d > 8) for (let i = 1; i + 1 < puliti.length; i++) {
          const a = puliti[i - 1], b = puliti[i + 1];
          const L = dist(a, b) || 1;
          const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
          const s2 = i % 2 ? MOSSO_MM : -MOSSO_MM;
          puliti[i] = { x: puliti[i].x + nx * s2, y: puliti[i].y + ny * s2 };
        }
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
        // il cammino appena cucito diventa corridoio: ogni passaggio conta una volta per cella, anche
        // se la sua strada ci gira attorno, e il conteggio dice dove il filo si ammucchia
        const celleDiQuesto = new Set<number>();
        for (let i = 1; i < via2.length; i++) {
          const a2 = via2[i - 1], b2 = via2[i];
          const n = Math.max(1, Math.ceil(dist(a2, b2) / (CELLA / 2)));
          for (let k = 0; k <= n; k++) {
            const q = { x: a2.x + ((b2.x - a2.x) * k) / n, y: a2.y + ((b2.y - a2.y) * k) / n };
            const ic = cella(q);
            if (ic >= 0) { const cc2 = ic % COLS, rr2 = (ic - cc2) / COLS;
              for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
                const jc = (rr2 + dy2) * COLS + (cc2 + dx2);
                if (jc >= 0 && jc < COLS * ROWS) celleDiQuesto.add(jc);
              } }
          }
        }
        for (const jc of celleDiQuesto) if (battuto[jc] < 255) battuto[jc]++;
        passaggi++; filoPassaggi += lunghezza(via2); filoScoperto += scoperti;
        lunghezzePassaggi.push(d);
        if (ago > colori.length - SENZA_PASSAGGI) filoScopertoUltimi += scoperti;
        if (strada.length > 2 || d > CORTO_MM) passaggiInstradati++;
      }
      else {
        apri(); pathPts.push([p.x, p.y]); corrente = p; salti++; filoSalti += d;
        if (prossimoTratto && prossimoTratto.sorm) saltiSormonto++;
        else if (ultimoTratto && prossimoTratto && ultimoTratto.fi === prossimoTratto.fi) {
          if (Math.abs(ultimoTratto.id - prossimoTratto.id) <= 1) saltiSerpentina++; else saltiFamiglia++;
          // quanto e' lunga la riga che si va a raggiungere: se e' corta, e' una fila isolata
          if (prossimoTratto.base.length) { const lb = lunghezza(prossimoTratto.base); if (lb < 25) saltiVersoRigaCorta++; else saltiVersoRigaLunga++; }
        }
        if (d > 20) saltiLunghi++;
      }
    };
    // quanto costa in media un cammino, sulla mappa di chi copre chi. Serve a GIUDICARE una strada,
    // e va tenuto separato da quello che serve a TROVARLA: la penalita' per l'attraversamento delle
    // righe guida l'A*, ma non dice niente su quanto quel filo si vedra'.
    const costoMedio = (via2: Point[], c: number, dOra: number): number => {
      let costo = 0, lung = 0;
      for (let i = 1; i < via2.length; i++) {
        const a = via2[i - 1], b = via2[i];
        const n = Math.max(1, Math.ceil(dist(a, b) / CELLA));
        for (let k = 0; k < n; k++) {
          const q = { x: a.x + ((b.x - a.x) * (k + 0.5)) / n, y: a.y + ((b.y - a.y) * (k + 0.5)) / n };
          costo += costoCella(cella(q), c, dOra) * (dist(a, b) / n);
          lung += dist(a, b) / n;
        }
      }
      return lung > 1e-6 ? costo / lung : 0;
    };
    // quanto di un cammino resterebbe scoperto, misurato a passi di mezzo millimetro
    const quantoAVista = (via2: Point[], c: number, dOra: number): number => {
      let scoperto = 0;
      for (let i = 1; i < via2.length; i++) {
        const a = via2[i - 1], b = via2[i];
        const n = Math.max(1, Math.ceil(dist(a, b) / 0.5));
        for (let k = 0; k < n; k++) {
          const q = { x: a.x + ((b.x - a.x) * (k + 0.5)) / n, y: a.y + ((b.y - a.y) * (k + 0.5)) / n };
          if (aVista(q, c, dOra)) scoperto += dist(a, b) / n;
        }
      }
      return scoperto;
    };
    /**
     * LA BANDA DI SOVRAPPOSIZIONE FRA DUE COLORI. Lorenzo (2026-09-10, nona tornata): «i passaggi non
     * si possono nascondere in quelli successivi, a meno che non si passa nei punti di sovrapposizione
     * tra il colore che stai lavorando e uno adiacente… quindi significa passare vicino ai bordi dei
     * blocchi di sfumatura. se non e' possibile allora si taglia». Il pettine e' rado: sotto una riga
     * futura dello stesso colore un passaggio si vede fra un dente e l'altro, e la vecchia mappa che
     * lo dava per coperto (1,2 e 1,5 «davanti alla riga in corso») mentiva. Dove due colori si
     * sovrappongono — i denti dell'uno che rientrano nell'altro, il sormonto — la copertura e' doppia,
     * e li' sparisce. Qui si misura, cella per cella, quanto si e' vicini a un bordo fra due tinte e
     * qual e' la tinta dall'altra parte: e' l'unica strada che un passaggio puo' prendere.
     */
    const BANDA_MM = 5;
    const BANDA_CELLE = Math.round(BANDA_MM / CELLA);
    const bordoDist = new Int16Array(COLS * ROWS).fill(32767);
    const bordoAltra = new Int8Array(COLS * ROWS).fill(-1);
    {
      const semi: Array<[number, number]> = [];
      for (let r = 1; r + 1 < ROWS; r++) for (let c2 = 1; c2 + 1 < COLS; c2++) {
        const i = r * COLS + c2;
        const t = tinta[i];
        if (t < 0) continue;
        let altra = -1;
        for (const j of [i - 1, i + 1, i - COLS, i + COLS]) { const u = tinta[j]; if (u >= 0 && u !== t && u > altra) altra = u; }
        if (altra >= 0) semi.push([altra, i]);
      }
      // i bordi con la tinta piu' scura si propagano per primi: a parita' di distanza vince il colore
      // che coprira', perche' e' quello che decide se il passaggio sparisce
      semi.sort((a, b) => b[0] - a[0]);
      let coda: number[] = [];
      for (const [altra, i] of semi) { bordoDist[i] = 0; bordoAltra[i] = altra; coda.push(i); }
      for (let passo = 1; passo <= BANDA_CELLE && coda.length; passo++) {
        const prossima: number[] = [];
        for (const i of coda) {
          const c2 = i % COLS, r = (i - c2) / COLS;
          if (c2 < 1 || r < 1 || c2 + 1 >= COLS || r + 1 >= ROWS) continue;
          for (const j of [i - 1, i + 1, i - COLS, i + COLS]) {
            if (tinta[j] < 0 || bordoDist[j] <= passo) continue;
            bordoDist[j] = passo; bordoAltra[j] = bordoAltra[i]; prossima.push(j);
          }
        }
        coda = prossima;
      }
    }
    {
      let dentro = 0, banda = 0, scura = 0;
      for (let i = 0; i < COLS * ROWS; i++) { if (tinta[i] < 0) continue; dentro++; if (bordoDist[i] <= BANDA_CELLE) { banda++; if (bordoAltra[i] > tinta[i]) scura++; } }
      console.log(`BANDA: il ${((banda / dentro) * 100).toFixed(0)}% del pannello sta a meno di ${BANDA_MM} mm da un bordo fra due tinte, e il ${((scura / dentro) * 100).toFixed(0)}% da un bordo con una tinta piu' scura (e' li' che un passaggio sparisce)`);
    }
    // SUL DIETRO DEL PETTINE: la cella sta sulla linea di base (a meno di una cella) di una riga del
    // colore c che e' quella in corso o una futura. Li' un passaggio finisce sotto i denti della riga
    // dopo. La tolleranza serve perche' un punto da 3 mm sta su una linea curva da mezzo millimetro
    // solo a meno di una cella, e senza il filo risultava «a vista» pur essendo sul dietro.
    const sulDietro = (i: number, c: number, dOra: number): boolean => {
      void dOra;
      if (i < 0 || tinta[i] !== c) return false;
      // IL DIETRO DI UNA RIGA E' UN CORRIDOIO FINCHE' SOPRA NON C'E' CUCITO ALTRO (Lorenzo, 2026-09-10,
      // quindicesima tornata: «puoi passare sul retro di qualcosa gia' cucito, basta che non ci sia
      // cucito altro sotto. A volte passi sul retro di una linea ma sotto ce n'e' una gia' cucita: e
      // dovresti far passare il filo sul dietro di quella»). Una base del nostro colore va bene se
      // ancora da fare (il pettine, quando verra', copre il filo) oppure gia' cucita ma senza i denti
      // della riga dopo sopra — cioe' l'ultima. Su una base coperta dai denti della riga dopo, mai:
      // li' il filo passerebbe sopra un pettine, e il posto giusto e' il dietro della riga dopo.
      if (dentiCuciti[i]) return false;
      const cc = i % COLS, rr = (i - cc) / COLS;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (rr + dy) * COLS + (cc + dx);
        if (j >= 0 && j < COLS * ROWS && soprafilo[j] && tinta[j] === c) return true;
      }
      return false;
    };
    // LA MAPPA DI CHI COPRE CHI, per instradare i passaggi. I colori si cuciono dal chiaro allo scuro.
    // Un passaggio sparisce solo nella banda di sovrapposizione con un colore piu' scuro (che verra'
    // dopo e ci passera' sopra coi denti fitti del bordo) o, meno bene, sotto il corpo di quel colore.
    // Dentro la propria tinta si vede, fuori dal disegno si vede sul tessuto nudo.
    const costoCella = (i: number, c: number, dOra: number): number => {
      const t = i < 0 ? -1 : tinta[i];
      if (t < 0) return 30;                    // tessuto nudo: mai
      // IL CORRIDOIO NON ATTIRA PIU' (Lorenzo, 2026-09-10, sedicesima tornata: «tanti passaggi passano
      // nella stessa linea a volte. Se si riuscisse a usare piu' linee di base dei punti pettine sarebbe
      // meglio, per creare meno densita' di filo»). Ripassare dove il filo c'e' gia' non aggiunge niente
      // da vedere, ma ammucchia: costa piu' di una base da fare (0,6) e meno della striscia (1,5), cosi'
      // il passaggio nuovo preferisce una base sua e ricade sul corridoio solo se non ce ne sono.
      if (battuto[i]) return 1.2;
      const inBanda = bordoDist[i] <= BANDA_CELLE, altra = bordoAltra[i];
      // SOPRA UN PETTINE GIA' CUCITO NON SI PASSA, di nessun colore: l'unica eccezione e' la linea di
      // base della riga in corso o di una futura del nostro colore (il dietro del pettine)
      const dietro = sulDietro(i, c, dOra);
      // PROVA: nella banda dal lato scuro i denti gia' cuciti sono il sormonto di questo colore, e il
      // colore scuro coprira' tutto, passaggio compreso: li' sopra si puo' passare
      if (pettineCucito[i] && !dietro && !(t > c && inBanda)) return 16;
      if (t > c) {
        // la banda del bordo di un colore che viene dopo: sparisce, ma e' fuori dal tracciato del
        // nostro colore, e Lorenzo preferisce il dietro dell'ultima riga nostra («magari l'ultimo,
        // che poi sara' coperto dal colore dopo»): quindi costa piu' di quella, non meno
        if (inBanda) return 2.5;
        return 8;                              // sotto il corpo di quel colore: il pettine e' rado, si vede fra i denti
      }
      if (t === c) {
        const d = distDaMuro[i];
        // IL DIETRO DEL PETTINE (Lorenzo, 2026-09-10, decima tornata: «perche' non passi sopra il
        // dietro dei pettini?»): la linea di base della riga appena cucita, e di quelle che verranno,
        // sta sotto i denti della riga dopo. E' l'unica strada dentro il proprio colore: solo sulla
        // linea, mezzo millimetro. L'area attorno resta a vista fra un dente e l'altro, e costa tanto
        // da non passare mai il giudizio: prima costava 8, quanto la soglia, e una riga dritta
        // attraverso l'interno passava — sono i passaggi «fuori dal tracciato» del primo ago.
        if (dietro) return 0.6;                // esattamente sulla linea del dietro: e' li' che si nasconde
        if (inBanda && altra > c) return 1.5;  // il nostro bordo verso lo scuro: sormonto nostro e denti suoi
        if (inBanda && altra >= 0) return 4;   // il nostro bordo verso il chiaro: i denti della riga di bordo ci arrivano
        // IL PIU' ESTERNO POSSIBILE (Lorenzo, quindicesima tornata: «non passare piu' dentro ma passa
        // piu' esterno possibile, al limite con il dietro dell'ultima linea dentata che hai»): la
        // striscia davanti all'ultima riga cucita, dove una base e' ancora da fare, e' il posto giusto
        // per un passaggio — la riga che verra' lo copre col pettine. Costa poco piu' del dietro di
        // una base da fare, e molto meno di qualunque cosa gia' cucita.
        if (baseFutura[i] > 0) return 1.5;
        return 16;                             // niente basi da fare qui vicino: si vede
      }
      if (inBanda && altra === c) return 4;    // subito oltre il nostro bordo, sul chiaro: i nostri denti ci arrivano
      return 14;                               // sul chiaro gia' fatto: a vista
    };
    // A VISTA = il filo di passaggio finisce dove nessuno ci passera' piu' sopra con abbastanza
    // fitto da nasconderlo: e' tutto tranne la banda col colore scuro accanto e il corpo di quel colore.
    const aVista = (p: Point, c: number, dOra: number): boolean => {
      const i = cella(p);
      const t = i < 0 ? -1 : tinta[i];
      // IL CORRIDOIO NON SI VEDE DUE VOLTE. Se in quel punto il filo di questo colore c'e' gia',
      // ripassarci non aggiunge niente da vedere: si vede una linea, non due.
      if (i >= 0 && battuto[i]) return false;
      if (t < 0) return true;
      const inBanda = bordoDist[i] <= BANDA_CELLE, altra = bordoAltra[i];
      const dietro = sulDietro(i, c, dOra);
      if (pettineCucito[i] && !dietro && !(t > c && inBanda)) return true;   // sopra un pettine cucito: a vista
      if (t > c) return !inBanda;
      if (t === c) return !dietro && !(inBanda && altra > c) && baseFutura[i] <= 0;
      return !(inBanda && altra === c);
    };
    /**
     * IL PASSAGGIO CHE SI NASCONDE (Lorenzo, 2026-09-10): «prevedi anche dei passaggi che passando per
     * i bordi delle figure poi vengono coperti dai ricami di colore successivo». Fra due capi si cerca
     * il cammino piu' economico sulla mappa qui sopra (A* a 8 vicini sulla griglia da mezzo millimetro,
     * dentro il rettangolo dei due capi allargato di 12 mm): passa per le zone che verranno ricamate
     * dopo — cioe' lungo i bordi delle figure scure — invece di tagliare dritto nel chiaro gia' fatto.
     * Torna null se non trova niente di decente: allora si salta, e la macchina taglia.
     */
    const instrada = (a: Point, b: Point, c: number, dOra: number, costoMax = 8): Point[] | null => {
      const ia = cella(a), ib = cella(b);
      if (ia < 0 || ib < 0) return null;
      // quanto ci si puo' allargare per aggirare un ostacolo. Un cammino che segue le righe invece di
      // tagliarle deve poter uscire parecchio dal rettangolo dei due capi: con 20 mm restava chiuso
      // dentro, e l'unica strada che trovava era quella dritta di traverso.
      const marg = Math.round(90 / CELLA);
      const ca = ia % COLS, ra = Math.floor(ia / COLS), cb = ib % COLS, rb = Math.floor(ib / COLS);
      const c0 = Math.max(0, Math.min(ca, cb) - marg), c1 = Math.min(COLS - 1, Math.max(ca, cb) + marg);
      const r0 = Math.max(0, Math.min(ra, rb) - marg), r1 = Math.min(ROWS - 1, Math.max(ra, rb) + marg);
      const W = c1 - c0 + 1, H = r1 - r0 + 1;
      if (W * H > 2500000) { nienteFinestra++; return null; }
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
      while (heap.length && esplorati < 600000) {
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
      if (!Number.isFinite(G0[fine])) { nienteStrada++; return null; }
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
      if (costoMedio(via2, c, dOra) > costoMax) { nienteCosto++; return null; }
      // un cammino che segue le righe e' per forza piu' lungo della linea d'aria: gira invece di
      // tagliare, ed e' quello che vogliamo. Il tetto serve solo a scartare i giri assurdi.
      if (lung > 6 * Math.max(1, dist(a, b)) + 20) { nienteGiro++; return null; }
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
      // la giunta fra l'andata e il ritorno: l'ultimo punto dell'impuntura e il primo del pettine
      // possono cadere a un decimo l'uno dall'altro, e sarebbe un punto sotto il millimetro (R3)
      const ritorno = sequenza(t, !inverso);
      while (seq.length > 1 && ritorno.length && dist(seq[seq.length - 1], ritorno[0]) < MIN_MM) seq.pop();
      for (const q of ritorno) seq.push(q);
      return seq;
    };
    const eDente = (ts: Tratto[], q: Point): boolean => ts.some((t) => t.denti.some(([r, tip]) => r === q || tip === q));
    const ePunta = (ts: Tratto[], q: Point): boolean => ts.some((t) => t.denti.some(([, tip]) => tip === q));
    for (let c = 0; c < colori.length; c++) {
      ago = c + 1;
      apri();
      { let n = 0; for (let i = 0; i < battuto.length; i++) if (battuto[i]) { n++; if (battuto[i] >= 3) celleAffollate++; } celleCorridoio += n; }
      battuto.fill(0);   // il corridoio vale dentro un colore: col cambio ago si ricomincia
      baseFutura.fill(0);
      for (const t of trattiTutti) if (t.col === c) segnaBaseFutura(t, 1);
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
        /**
         * PRIMA LA SEQUENZA, POI IL VERSO (Lorenzo, 2026-09-10: «io devo avere pochi rasafilo e
         * pochissimi passaggi. e' importante prima avere una sequenza sensata e usare gli strumenti
         * che abbiamo per costruirla»).
         *
         * Erano due decisioni prese insieme, una riga per volta: si sceglieva la riga piu' vicina e
         * la si entrava dal capo piu' vicino. Giusto sul momento, sbagliato una riga dopo — si usciva
         * dalla parte opposta a dove bisognava andare, e la macchina tagliava. Qui l'ordine si fissa
         * per primo (con il vincolo di copertura, che non si tocca), e poi i versi si scelgono TUTTI
         * INSIEME con una programmazione dinamica: per ogni riga tre modi — avanti, indietro, oppure
         * l'andata in impuntura e il ritorno col pettine, che fa uscire il filo da dove e' entrato —
         * e si tiene la catena che costa meno, sapendo che un rasafilo costa quanto RASAFILO_MM di
         * filo. E' l'unico punto in cui si puo' guardare avanti senza toccare l'ordine di copertura.
         */
        /**
         * PRIMA I BLOCCHI VICINI, E IL RASAFILO SOLO PER CAMBIARE BLOCCO (Lorenzo, 2026-09-10,
         * settima tornata: «cercare di lavorare per blocchi vicini e fare rasafilo solo in blocchi
         * esterni»). Le righe di un colore dentro una famiglia possono stare in pezzi staccati: se
         * l'ordine li mescola, il filo fa la spola e ogni viaggio e' un passaggio lungo o un taglio.
         * Qui si raggruppano prima in ZONE — catene di pezzi che si toccano — e una zona si finisce
         * tutta prima di cominciare la successiva. Dentro la zona i collegamenti restano corti, e il
         * taglio si paga solo al cambio di zona, che e' proprio dove Lorenzo lo accetta.
         */
        const zona = new Int32Array(tratti.length).fill(-1);
        {
          let nz = 0;
          for (let i = 0; i < tratti.length; i++) {
            if (zona[i] >= 0) continue;
            const coda = [i];
            zona[i] = nz;
            for (let h = 0; h < coda.length; h++) for (let j = 0; j < tratti.length; j++) {
              if (zona[j] >= 0) continue;
              if (distBox(box[coda[h]], box[j]) < ZONA_MM) { zona[j] = nz; coda.push(j); }
            }
            nz++;
          }
          zoneTotali += nz;
        }
        const fatti = new Uint8Array(tratti.length);
        let primo = 0;
        let sequenzaRighe: number[] = [];
        let rif: Point[] = corrente ? [corrente] : [];
        let zonaInCorso = -1;
        for (let n = 0; n < tratti.length; n++) {
          while (primo < tratti.length && fatti[primo]) primo++;
          // i candidati in ordine di vicinanza a dove il filo si trovera'; si prende il primo
          // AMMISSIBILE, cioe' quello che non scavalca una riga piu' vicina al muro che gli stia addosso
          // finita la zona in corso si passa alla piu' vicina, e non prima
          if (zonaInCorso >= 0) { let resta = false; for (let i = 0; i < tratti.length; i++) if (!fatti[i] && zona[i] === zonaInCorso) { resta = true; break; } if (!resta) zonaInCorso = -1; }
          const ordine: number[] = [];
          const daRif = (i: number): number => {
            const t2 = tratti[i];
            if (!rif.length) return t2.d;
            let m = Infinity;
            for (const q of rif) m = Math.min(m, dist(q, t2.base[0]), dist(q, t2.base[t2.base.length - 1]));
            return m;
          };
          if (zonaInCorso < 0) {
            let best = Infinity;
            for (let i = 0; i < tratti.length; i++) { if (fatti[i]) continue; const v = daRif(i); if (v < best) { best = v; zonaInCorso = zona[i]; } }
            cambiZona++;
          }
          for (let i = 0; i < tratti.length; i++) if (!fatti[i] && zona[i] === zonaInCorso) ordine.push(i);
          // PRIMA SI FINISCE IL LIVELLO, POI SI SALE (visto nei casi 6 e 7 del 2026-09-10): se il
          // livello e' spezzato in due pezzi da un vuoto e si sale al livello dopo prima di fare il
          // secondo pezzo, il vuoto si ritrova coperto dai denti gia' cuciti e non si puo' piu'
          // attraversare: taglio. Facendo tutti i pezzi del livello prima di salire, il passaggio
          // nel vuoto sta sotto i denti futuri del livello dopo, nascosto. Costa filo, non tagli.
          // Ma solo se il pezzo e' VICINO (entro STESSO_LIVELLO_MM): finire il livello su tutta la
          // zona prima di salire allungava troppi viaggi (misurato: 180 -> 212 tagli).
          const livelloDi = (i: number): number => Math.round(tratti[i].d / BASI_MM);
          const livelloUltimo = sequenzaRighe.length ? livelloDi(sequenzaRighe[sequenzaRighe.length - 1]) : -1;
          const vicinoStessoLivello = (i: number): number => (livelloDi(i) === livelloUltimo && daRif(i) <= STESSO_LIVELLO_MM ? 0 : 1);
          ordine.sort((a, b) => vicinoStessoLivello(a) - vicinoStessoLivello(b) || daRif(a) - daRif(b));
          let scelto = -1;
          for (const i of ordine) {
            let ok = true;
            for (let j = primo; j < tratti.length && tratti[j].d < tratti[i].d - 1e-6; j++) {
              if (fatti[j] || j === i) continue;
              if (distBox(box[i], box[j]) < VICINE_MM) { ok = false; break; }
            }
            if (ok) { scelto = i; break; }
          }
          if (scelto < 0) scelto = ordine[0];
          // il controllo vero: la riga scelta non deve stare addosso a una piu' vicina al muro non ancora fatta
          for (let j = primo; j < tratti.length && tratti[j].d < tratti[scelto].d - 1e-6; j++) {
            if (fatti[j] || j === scelto) continue;
            if (distBox(box[scelto], box[j]) < VICINE_MM) { inversioni++; break; }
          }
          fatti[scelto] = 1;
          sequenzaRighe.push(scelto);
          const ts = tratti[scelto];
          rif = [ts.base[0], ts.base[ts.base.length - 1]];
        }
        // i quattro modi di percorrere una riga: 0 avanti - 1 indietro - 2 andata-e-ritorno entrando
        // dal capo iniziale - 3 dal capo finale. Nei modi 2 e 3 il filo esce da dove e' entrato.
        const capiT = tratti.map((t) => [t.base[0], t.base[t.base.length - 1]] as [Point, Point]);
        const lungT = tratti.map((t) => lunghezza(t.base));
        const modiT = tratti.map((t, i) => (t.denti.length && lungT[i] <= ANDATA_RITORNO_MAX ? [0, 1, 2, 3] : [0, 1]));
        const entraT = (i: number, m: number): Point => (m === 1 || m === 3 ? capiT[i][1] : capiT[i][0]);
        const esceT = (i: number, m: number): Point => (m === 0 || m === 3 ? capiT[i][1] : capiT[i][0]);
        // quanto costa il collegamento: la sua lunghezza, piu' il rasafilo se e' troppo lungo da cucire
        const costoTra = (x: Point, y: Point): number => {
          const d = dist(x, y);
          if (d <= PASSAGGIO_MM) return d;                          // il passaggio si cuce di sicuro
          if (d <= PASSAGGIO_NASCOSTO_MM) return d + RASAFILO_MM * 0.35;  // forse si nasconde, forse no
          return d + RASAFILO_MM;                                   // troppo: la macchina taglia
        };
        // i versi si scelgono TUTTI INSIEME: per ogni riga i suoi modi, e la catena che costa meno.
        // `bloccati` fissa il modo di una riga (serve alle righe spezzate da un innesto).
        const risolviVersi = (seq: number[], bloccati: Map<number, number>, da: Point | null, fino: Point | null): { modo: number[]; attacco: number[] } => {
          const n = seq.length;
          if (!n) return { modo: [], attacco: [] };
          const mo = (k: number): number[] => { const b = bloccati.get(seq[k]); return b === undefined ? modiT[seq[k]] : [b]; };
          const G: number[][] = [], daDove: number[][] = [];
          for (let k = 0; k < n; k++) { G.push([Infinity, Infinity, Infinity, Infinity]); daDove.push([-1, -1, -1, -1]); }
          for (const m of mo(0)) G[0][m] = (m >= 2 ? lungT[seq[0]] : 0) + (da ? costoTra(da, entraT(seq[0], m)) : 0);
          for (let k = 1; k < n; k++) for (const m of mo(k)) {
            let best = Infinity, bm = -1;
            for (const pm of mo(k - 1)) { const v = G[k - 1][pm] + costoTra(esceT(seq[k - 1], pm), entraT(seq[k], m)); if (v < best) { best = v; bm = pm; } }
            G[k][m] = best + (m >= 2 ? lungT[seq[k]] : 0); daDove[k][m] = bm;
          }
          const modo = new Array<number>(n).fill(0);
          let bm = mo(n - 1)[0], best = Infinity;
          // se si sa dove il filo deve tornare (una macchia innestata), l'ultimo verso ne tiene conto
          for (const m of mo(n - 1)) { const v = G[n - 1][m] + (fino ? costoTra(esceT(seq[n - 1], m), fino) : 0); if (v < best) { best = v; bm = m; } }
          for (let k = n - 1; k >= 0; k--) { modo[k] = bm; if (k > 0) bm = daDove[k][bm]; }
          // quanto e' lontano l'attacco di ogni riga da dove il filo esce dalla precedente
          const attacco: number[] = [];
          for (let k = 0; k < n; k++) attacco.push(k === 0 ? (da ? dist(da, entraT(seq[0], modo[0])) : 0) : dist(esceT(seq[k - 1], modo[k - 1]), entraT(seq[k], modo[k])));
          return { modo, attacco };
        };
        let esito = risolviVersi(sequenzaRighe, new Map(), corrente, null);
        /**
         * LE MACCHIE SI INCASTRANO (Lorenzo, 2026-09-10, nona tornata): «nel ricamo la prima cosa che
         * si fa e' capire come poter accorpare e ricamare blocchi dello stesso colore senza mai
         * interrompere l'ago, usando passaggi sotto per arrivare a punti lontani per poi tornare
         * indietro e coprirli… il sistema deve saper incastrare le varie macchie. non ci interessa se
         * questo necessita di piu' filo… non posso avere macchiette da 1 cm isolate e non unite al
         * blocco sotto piu' grande».
         *
         * Prima si decide COSA VA CON COSA. Nella sequenza si cercano le MACCHIE: pezzi di fila di
         * righe chiusi fra due tagli (o un taglio e la fine), corti nel loro insieme. Ognuna si prende
         * la riga grande piu' comoda e ci si incastra: la grande si cuce fino al dente giusto, si esce
         * per un corridoio — un passaggio che corre nella banda fra due colori, dove sparisce — si fa
         * tutta la macchia, e per un altro corridoio si torna al dente dopo e si riprende. I corridoi
         * si cercano PRIMA di decidere, con la stessa funzione che poi li cuce: se dalla riga grande
         * alla macchia non c'e' una strada nascosta, all'andata o al ritorno, l'innesto non si fa e la
         * macchia resta un taglio. Una macchia gia' innestata puo' a sua volta ospitarne un'altra.
         *
         * L'ORDINE DI COPERTURA NON SI TOCCA. Le righe della macchia piu' lontane dal muro della riga
         * grande la coprono: l'innesto va DOPO l'ultimo dente che toccano. Quelle piu' vicine al muro
         * vanno coperte da lei: l'innesto va PRIMA del primo dente che toccano. Se le due cose non
         * stanno insieme, quella riga grande non va bene. E nessuna riga del resto del gruppo che deve
         * stare prima o dopo la macchia puo' finire dalla parte sbagliata dello spostamento.
         */
        interface Innesto { dente: number; righe: number[]; modi: number[] }
        const innesti = new Map<number, Innesto[]>();
        const versoBloccato = new Map<number, number>();
        const nuvole = new Map<number, Point[]>();
        const nuvola = (i: number): Point[] => {
          let v = nuvole.get(i);
          if (!v) { v = ricampiona(tratti[i].base, 2); for (const [r, tip] of tratti[i].denti) v.push(r, tip); nuvole.set(i, v); }
          return v;
        };
        const vicinoA = (n: Point[], q: Point): boolean => {
          for (const w of n) if (Math.abs(q.x - w.x) < VICINE_MM && Math.abs(q.y - w.y) < VICINE_MM && dist(q, w) < VICINE_MM) return true;
          return false;
        };
        const rimossi = new Set<number>();
        // dove sta davvero una riga nella cucitura: in sequenza e' la sua posizione; innestata, e' la
        // posizione di chi la ospita, poi il dente, poi il posto dentro la macchia. Una macchia gia'
        // innestata non e' piu' in sequenza, ma c'e' ancora, e va guardata li' dove verra' cucita.
        const ospiteDi = new Map<number, { host: number; dente: number; posto: number }>();
        for (let giro = 0; giro < 3 && sequenzaRighe.length > 1; giro++) {
          const pos = new Map<number, number>();
          sequenzaRighe.forEach((i, k) => pos.set(i, k));
          const chiave = (i: number): number[] => {
            const o = ospiteDi.get(i);
            if (!o) return [pos.get(i) ?? -1];
            return [...chiave(o.host), o.dente, o.posto];
          };
          const primaDi = (a: number[], b: number[]): boolean => {
            for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return a[k] < b[k];
            return a.length < b.length;
          };
          let cambiato = false;
          for (let k0 = 0; k0 < sequenzaRighe.length;) {
            let k1 = k0;
            while (k1 + 1 < sequenzaRighe.length && esito.attacco[k1 + 1] <= PASSAGGIO_MM) k1++;
            const macchia = sequenzaRighe.slice(k0, k1 + 1);
            const inizio = k0;
            k0 = k1 + 1;
            // e' una macchia se e' corta, se ci si arriva con un taglio e se non e' tutta la sequenza
            if (macchia.length === sequenzaRighe.length) continue;
            let lung = 0;
            for (const i of macchia) lung += lungT[i];
            if (lung > MACCHIA_MM) continue;
            if (inizio === 0 && !(corrente && esito.attacco[0] > PASSAGGIO_MM)) continue;
            // una riga che ospita gia' una macchia non si sposta piu' dentro un'altra: la posizione
            // vera di chi ospita e' la sua, e spostandola si farebbe un giro senza fine (visto)
            if (macchia.some((i) => tratti[i].ospite)) continue;
            macchieCandidate++;
            const inMacchia = new Set(macchia);
            let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
            for (const i of macchia) { bx0 = Math.min(bx0, box[i].x0); by0 = Math.min(by0, box[i].y0); bx1 = Math.max(bx1, box[i].x1); by1 = Math.max(by1, box[i].y1); }
            const boxM = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
            // le righe grandi candidate, dalla piu' vicina
            const ospiti: Array<[number, number]> = [];
            for (const iT of sequenzaRighe) {
              if (inMacchia.has(iT) || rimossi.has(iT) || !tratti[iT].denti.length || (innesti.get(iT)?.length ?? 0) >= 3) continue;
              const dd = distBox(box[iT], boxM);
              if (dd <= MACCHIA_CORRIDOIO_MM) ospiti.push([dd, iT]);
            }
            ospiti.sort((a, b) => a[0] - b[0]);
            let esitoMacchia: 'ok' | 'senzaVicina' | 'ordine' | 'corridoio' = ospiti.length ? 'ordine' : 'senzaVicina';
            for (const [, iT] of ospiti) {
              if (esitoMacchia === 'ok') break;
              const T = tratti[iT];
              const j = pos.get(iT)!;
              const modoT = esito.modo[j];
              const alRovescio = modoT === 1 || modoT === 3;
              const inNatura = (n: number): number => (alRovescio ? T.denti.length - 1 - n : n);
              // quali denti di T la macchia tocca, divisi fra le righe che la coprono e quelle che copre
              let denteMin = 0, denteMax = T.denti.length - 1;
              for (const iP of macchia) {
                const P = tratti[iP];
                if (Math.abs(P.d - T.d) <= 1e-6) continue;
                const nP = nuvola(iP);
                let primo = -1, ultimo = -1;
                for (let n = 0; n < T.denti.length; n++) {
                  const d2 = T.denti[inNatura(n)];
                  if (vicinoA(nP, d2[0]) || vicinoA(nP, d2[1])) { if (primo < 0) primo = n; ultimo = n; }
                }
                if (primo < 0) continue;
                if (P.d > T.d) denteMin = Math.max(denteMin, ultimo);   // P copre T: dopo l'ultimo dente toccato
                else denteMax = Math.min(denteMax, primo - 1);          // T copre P: prima del primo dente toccato
              }
              if (denteMin > denteMax) continue;
              // il resto del gruppo: spostando la macchia accanto a T non si scavalca nessuno. Si
              // guardano TUTTE le righe, anche quelle gia' innestate altrove, alla loro posizione vera.
              // Il dente di innesto non e' ancora scelto: si prova dopo, dente per dente.
              const chiaveT = chiave(iT);
              const scavalca = (n: number): boolean => {
                const chiaveNuova = [...chiaveT, n, Infinity];
                for (const iP of macchia) {
                  const P = tratti[iP];
                  for (let iR = 0; iR < tratti.length; iR++) {
                    if (inMacchia.has(iR) || iR === iT) continue;
                    if (distBox(box[iR], box[iP]) >= VICINE_MM) continue;
                    const R = tratti[iR];
                    const prima = primaDi(chiave(iR), chiaveNuova);
                    if (R.d < P.d - 1e-6 && !prima) return true;   // R deve stare sotto P, ma verrebbe dopo
                    if (R.d > P.d + 1e-6 && prima) return true;    // R deve coprire P, ma e' gia' passata
                  }
                }
                return false;
              };
              esitoMacchia = esitoMacchia === 'ordine' ? 'corridoio' : esitoMacchia;
              // i denti ammessi, dal piu' vicino alla macchia: per ognuno si prova il corridoio
              const capiM: Point[] = [];
              for (const iP of macchia) capiM.push(capiT[iP][0], capiT[iP][1]);
              const prove: Array<[number, number]> = [];
              for (let n = denteMin; n <= denteMax; n++) {
                const r = T.denti[inNatura(n)][0];
                let dd = Infinity;
                for (const q of capiM) dd = Math.min(dd, dist(r, q));
                prove.push([dd, n]);
              }
              prove.sort((a, b) => a[0] - b[0]);
              for (const [dd, n] of prove.slice(0, 3)) {
                if (dd > MACCHIA_CORRIDOIO_MM) break;
                if (scavalca(n)) continue;
                const rIn = T.denti[inNatura(n)][0];
                const rNext = n + 1 < T.denti.length ? T.denti[inNatura(n + 1)][0] : (alRovescio ? T.base[0] : T.base[T.base.length - 1]);
                const dentroM = risolviVersi(macchia, versoBloccato, rIn, rNext);
                const entrata = entraT(macchia[0], dentroM.modo[0]);
                const uscita = esceT(macchia[macchia.length - 1], dentroM.modo[macchia.length - 1]);
                if (!trovaStrada(rIn, entrata, T.d, MACCHIA_CORRIDOIO_MM)) continue;
                if (!trovaStrada(uscita, rNext, T.d, MACCHIA_CORRIDOIO_MM)) continue;
                const l = innesti.get(iT) ?? [];
                l.push({ dente: n, righe: macchia, modi: dentroM.modo });
                innesti.set(iT, l);
                T.ospite = true;
                macchia.forEach((iP, posto) => { tratti[iP].innestato = true; ospiteDi.set(iP, { host: iT, dente: n, posto }); });
                versoBloccato.set(iT, alRovescio ? 1 : 0);
                for (const iP of macchia) rimossi.add(iP);
                macchieInnestate++; righeInnestate += macchia.length;
                esitoMacchia = 'ok'; cambiato = true;
                break;
              }
            }
            if (esitoMacchia === 'senzaVicina') macchieSenzaVicina++;
            else if (esitoMacchia === 'ordine') macchieNegateDallOrdine++;
            else if (esitoMacchia === 'corridoio') macchieSenzaCorridoio++;
          }
          if (!cambiato) break;
          sequenzaRighe = sequenzaRighe.filter((i) => !rimossi.has(i));
          esito = risolviVersi(sequenzaRighe, versoBloccato, corrente, null);
        }
        // LA CUCITURA. Una riga con delle macchie innestate si cuce dente per dente: al dente segnato
        // il filo esce (con `vaiA`, che trova il corridoio o taglia), fa la macchia riga per riga, e
        // torna al dente dopo. Le macchie possono avere macchie: la funzione si richiama.
        const cuciRiga = (iT: number, m: number, portata?: number): void => {
          const t = tratti[iT];
          const dentro = (innesti.get(iT) ?? []).slice().sort((a, b) => a.dente - b.dente);
          prossimoTratto = t;
          const tempi = new Float64Array(t.denti.length);
          tempoDenti.set(t, tempi);
          if (!dentro.length) {
            tempi.fill(orologio++);
            const seq = m >= 2 ? sequenzaAndataRitorno(t, m === 3) : sequenza(t, m === 1);
            if (m >= 2) { andateRitorno++; filoImpuntura += lungT[iT]; }
            vaiA(seq[0], portata);
            // il primo punto dopo l'ingresso non si forza: `vaiA` puo' essersi fermato a un decimo dal capo
            for (let i = 1; i < seq.length; i++) cuciA(seq[i], i > 1 && eDente([t], seq[i]), ePunta([t], seq[i]) ? seq[i - 1] : ePunta([t], seq[i - 1]) ? seq[i] : null);
            ultimoTratto = t;
            segnaBaseFutura(t, -1);
            return;
          }
          const inverso = m === 1;
          const denti = inverso ? [...t.denti].reverse() : t.denti;
          const b0 = inverso ? t.base[t.base.length - 1] : t.base[0], b1 = inverso ? t.base[0] : t.base[t.base.length - 1];
          let fuori = false;   // il filo e' via, in una macchia: il prossimo punto della riga si raggiunge con un passaggio
          vaiA(denti.length && dist(b0, denti[0][0]) < MIN_MM ? denti[0][0] : b0, portata);
          for (let n = 0; n < denti.length; n++) {
            const [r, tip] = denti[n];
            tempi[inverso ? denti.length - 1 - n : n] = orologio;
            // la prima radice non si forza: `vaiA` puo' essersi fermato a un decimo dal capo (un
            // passaggio sotto il millimetro non si cuce) e un punto forzato li' sarebbe sotto R3
            if (fuori) { prossimoTratto = t; vaiA(r, MACCHIA_CORRIDOIO_MM); fuori = false; } else cuciA(r, n > 0);
            if (dist(r, tip) < MIN_MM) dentiSaltati++; else { cuciA(tip, true, r); cuciA(r, true, r); }
            for (const ins of dentro) {
              if (ins.dente !== n) continue;
              // il primo corridoio puo' essere lungo: e' quello promesso al momento di decidere
              orologio++;
              for (let q = 0; q < ins.righe.length; q++) cuciRiga(ins.righe[q], ins.modi[q], q === 0 ? MACCHIA_CORRIDOIO_MM : undefined);
              orologio++;
              fuori = true;
            }
          }
          if (fuori) { prossimoTratto = t; vaiA(b1, MACCHIA_CORRIDOIO_MM); } else cuciA(b1);
          orologio++;
          ultimoTratto = t;
          segnaBaseFutura(t, -1);
        };
        for (let k = 0; k < sequenzaRighe.length; k++) cuciRiga(sequenzaRighe[k], esito.modo[k]);
      }
      apri();
    }
    { let n = 0; for (let i = 0; i < battuto.length; i++) if (battuto[i]) { n++; if (battuto[i] >= 3) celleAffollate++; } celleCorridoio += n; }
    /**
     * LA VERIFICA CHE CONTA, sulla cucitura vera (Lorenzo, 2026-09-10: «se si rispetta la regola che
     * il pettine va sopra il dietro del pettine e mai il contrario»). Fin qui l'ordine era garantito
     * dalla costruzione della sequenza e dai controlli degli innesti: cioe' da chi decide. Qui lo si
     * misura da fuori, dente per dente, con l'orologio: per ogni coppia di righe della stessa famiglia
     * che si toccano, quella piu' lontana dal muro copre l'altra e deve essere cucita DOPO — ogni suo
     * dente dopo ogni dente dell'altra che gli sta vicino. Vale anche fra colori diversi: i colori si
     * cuciono dal chiaro allo scuro, e se da qualche parte lo scuro sta piu' vicino al muro del chiaro
     * la sequenza non puo' farci niente, e questo numero lo dice.
     */
    let copertureViolate = 0, copertureViolateFraColori = 0, coppieGuardate = 0, scuroSottoChiaro = 0, violateSormontoSotto = 0, violateRigheVicine = 0, violateRigheLontane = 0;
    let violateConOspite = 0, violateConInnestata = 0, violateSenzaInnesti = 0;
    {
      const perFamTutti = new Map<number, Tratto[]>();
      for (const t of trattiTutti) if (t.denti.length && tempoDenti.has(t)) { const l = perFamTutti.get(t.fi) ?? []; l.push(t); perFamTutti.set(t.fi, l); }
      const boxDi = (t: Tratto): { x0: number; y0: number; x1: number; y1: number } => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [r, tip] of t.denti) for (const q of [r, tip]) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
        return { x0, y0, x1, y1 };
      };
      const VIC = BASI_MM + 1;
      for (const lista of perFamTutti.values()) {
        const boxes = lista.map(boxDi);
        for (let a = 0; a < lista.length; a++) for (let b = a + 1; b < lista.length; b++) {
          const A = lista[a], B = lista[b];
          if (Math.abs(A.d - B.d) <= 1e-6) continue;
          const ba = boxes[a], bb = boxes[b];
          if (ba.x0 > bb.x1 + VIC || bb.x0 > ba.x1 + VIC || ba.y0 > bb.y1 + VIC || bb.y0 > ba.y1 + VIC) continue;
          // sotto = piu' vicina al muro, sopra = quella che copre
          const [sotto, sopra] = A.d < B.d ? [A, B] : [B, A];
          // una corsa di sormonto sta SOTTO per definizione: sono denti cuciti apposta sotto la base
          // scura che li coprira', anche se la loro distanza dal muro e' un pelo piu' grande
          if (sopra.sorm) continue;
          const tSotto = tempoDenti.get(sotto)!, tSopra = tempoDenti.get(sopra)!;
          coppieGuardate++;
          let male = 0;
          for (let i = 0; i < sopra.denti.length && !male; i++) {
            const [r, tip] = sopra.denti[i];
            for (let j = 0; j < sotto.denti.length; j++) {
              const [r2, tip2] = sotto.denti[j];
              if (dist(r, r2) < VIC || dist(tip, r2) < VIC || dist(r, tip2) < VIC || dist(tip, tip2) < VIC) {
                if (tSopra[i] <= tSotto[j]) { male = 1; break; }
              }
            }
          }
          if (male) {
            copertureViolate++;
            if (A.col !== B.col) { copertureViolateFraColori++; if (sotto.col > sopra.col) scuroSottoChiaro++; }
            else if (sotto.sorm) violateSormontoSotto++;
            else if (Math.abs(sopra.id - sotto.id) <= 1) violateRigheVicine++; else violateRigheLontane++;
            if (A.col === B.col) {
              if (sopra.ospite || sotto.ospite) violateConOspite++;
              if (sopra.innestato || sotto.innestato) violateConInnestata++;
              if (!sopra.ospite && !sotto.ospite && !sopra.innestato && !sotto.innestato) violateSenzaInnesti++;
            }
          }
        }
      }
      console.log(`COPERTURA, verificata sulla cucitura vera: ${coppieGuardate} coppie di righe che si toccano, ${copertureViolate} in cui il pettine sotto e' stato cucito dopo quello sopra · fra colori diversi ${copertureViolateFraColori} (${scuroSottoChiaro} con lo scuro piu' vicino al muro del chiaro) · nello stesso colore: ${violateSormontoSotto} con una corsa di sormonto sotto, ${violateRigheVicine} fra righe consecutive, ${violateRigheLontane} fra righe lontane — e di queste ${violateConOspite} toccano una riga che ospita una macchia, ${violateConInnestata} una riga innestata, ${violateSenzaInnesti} nessuna delle due`);
    }
    // l'origine del DST è l'angolo del riquadro: uno swatch parte da (0,0), non da dov'era nel pannello
    for (const pa of paths) for (const q of pa.points_mm) { q[0] -= X0; q[1] -= Y0; }
    dst = buildDst({ label: 'PETTINE', coordinate_system: 'svg', paths, metadata: ing.progetto ?? undefined });
    {
      const v = [...lunghezzePassaggi].sort((a, b) => a - b);
      const q = (f: number): string => (v.length ? v[Math.floor(v.length * f)].toFixed(0) : '0');
      console.log(`PASSAGGI per lunghezza: mediana ${q(0.5)} mm · 90% sotto ${q(0.9)} · il piu' lungo ${v.length ? v[v.length - 1].toFixed(0) : 0} · oltre 30 mm ne sono ${v.filter((x) => x > 30).length}`);
    }
    console.log(`CORRIDOI NEGATI: ${nienteCosto} per il costo (la strada c'e' ma passa allo scoperto) · ${nienteStrada} senza strada · ${nienteGiro} per il giro troppo lungo · ${nienteFinestra} per la finestra di ricerca`);
    console.log(`MACCHIE: ${macchieInnestate} macchie (${righeInnestate} righe) incastrate dentro una riga grande, su ${macchieCandidate} chiuse fra due tagli · ${macchieSenzaVicina} senza nessuna riga grande vicina · ${macchieNegateDallOrdine} negate dall'ordine di copertura · ${macchieSenzaCorridoio} senza un corridoio nascosto`);
    console.log(`ANDATA E RITORNO su ${andateRitorno} righe corte (${(filoImpuntura / 1000).toFixed(2)} m di impuntura nascosta sotto i denti)`);
    {
      // il pennello segna 3 celle di lato ogni mezzo millimetro: circa 6 celle per millimetro di filo
      const corridoiM = celleCorridoio / 6 / 1000;
      console.log(`ZONE: ${zoneTotali} pezzi staccati in tutto, e la cucitura ci entra ${cambiZona} volte (uguali = ogni zona fatta in un colpo solo)`);
    console.log(`CORRIDOI: ${(filoPassaggi / 1000).toFixed(1)} m di passaggio corrono dentro ${corridoiM.toFixed(1)} m di corridoi distinti · ${(celleAffollate / 6 / 1000).toFixed(2)} m dove il filo di passaggio e' passato tre o piu' volte (l'affollamento che Lorenzo non vuole)`);
    }
    console.log(`PASSAGGI LUNGHI NASCOSTI: ${passaggiNascosti} (oltre la manopola, ma tutti sotto cio' che li coprira')`);
    console.log(`SALTI per tipo: ${saltiSerpentina} fra righe vicine dello stesso gruppo · ${saltiFamiglia} fra righe lontane dello stesso gruppo · ${saltiSormonto} nel sormonto · il resto fra gruppi o colori diversi · di quelli dentro un gruppo, ${saltiVersoRigaCorta} vanno verso una riga corta (sotto 25 mm) e ${saltiVersoRigaLunga} verso una riga lunga`);
    console.log(`DST: ${punti} punti · ${(filo / 1000).toFixed(1)} m di filo · ${colori.length} aghi · ${paths.length} blocchi (${salti} salti, ${(filoSalti / 1000).toFixed(1)} m) · ${passaggi} passaggi cuciti (${(filoPassaggi / 1000).toFixed(1)} m, ${passaggiInstradati} instradati, ${passaggiDiTraverso} di traverso alle righe, ${(filoScoperto / 1000).toFixed(2)} m a vista di cui ${(filoScopertoUltimi / 1000).toFixed(2)} negli ultimi colori) · ${corti} punti sotto ${MIN_MM} mm · ${inversioni} righe cucite fuori ordine · ${dentiSaltati} denti sotto il millimetro non cuciti`);
    statDst = { punti, filoM: filo / 1000, blocchi: paths.length, salti, saltiM: filoSalti / 1000, passaggi, passaggiM: filoPassaggi / 1000, puntiCorti: corti, passaggiScopertiM: filoScoperto / 1000, righeFuoriOrdine: inversioni + (copertureViolate - copertureViolateFraColori), copertureFraColori: copertureViolateFraColori, righeInglobate: righeInnestate, passaggioPiuLungoMm: lunghezzePassaggi.length ? Math.max(...lunghezzePassaggi) : 0, corridoiM: celleCorridoio / 6000 };
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
      casi,
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
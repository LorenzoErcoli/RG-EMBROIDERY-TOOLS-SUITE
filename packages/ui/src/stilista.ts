// Il collegamento con Stilista (RG Stilista Link, strumenti-sviluppo/stilista-link): il plugin dentro
// Stilista ascolta su 127.0.0.1, una porta per finestra a partire da 5370. Un tool gli chiede la
// selezione come SVG (la legge col suo import di sempre) e gli manda indietro il lavoro.
//
// La finestra giusta: quella che ha aperto il tool (?stilista=<porta> nell'indirizzo), altrimenti
// fra quelle che rispondono quella con qualcosa selezionato, poi con un documento, poi l'ultima attivata.
import { readDstMetadata } from '@rg/core';

const PRIMA_PORTA = 5370;
const QUANTE_PORTE = 10;

export interface FinestraStilista {
  porta: number;
  documento: string;
  oggetti: number;
  selezionati: number;
  attiva_alle: number;
}

/** La porta passata dal pulsante di Stilista, se il tool è stato aperto da lì. */
export function portaDaIndirizzo(): number | null {
  const v = new URLSearchParams(location.search).get('stilista');
  const n = v ? Number(v) : NaN;
  return Number.isInteger(n) && n >= PRIMA_PORTA && n < PRIMA_PORTA + QUANTE_PORTE ? n : null;
}

async function stato(porta: number): Promise<FinestraStilista | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/stato`, { signal: AbortSignal.timeout(1500) });
    return r.ok ? { ...(await r.json()), porta } : null;
  } catch {
    return null;
  }
}

export async function trovaStilista(): Promise<FinestraStilista | null> {
  const indicata = portaDaIndirizzo();
  if (indicata) {
    const s = await stato(indicata);
    if (s) return s;
  }
  const tutte = (await Promise.all(Array.from({ length: QUANTE_PORTE }, (_, i) => stato(PRIMA_PORTA + i))))
    .filter((s): s is FinestraStilista => !!s);
  tutte.sort((a, b) =>
    Number(b.selezionati > 0) - Number(a.selezionati > 0)
    || Number(b.oggetti > 0) - Number(a.oggetti > 0)
    || b.attiva_alle - a.attiva_alle);
  return tutte[0] ?? null;
}

/** Tutte le porte del plugin rispondono: una finestra in più di Stilista non ha il collegamento, e il tool non la vede. */
export async function tutteLeFinestreOccupate(): Promise<boolean> {
  const tutte = await Promise.all(Array.from({ length: QUANTE_PORTE }, (_, i) => stato(PRIMA_PORTA + i)));
  return tutte.every(Boolean);
}

/** Nome del documento senza il prefisso della finestra («GMI Stilista 3 - C:\…\file.emg3» → «file.emg3»). */
export function nomeDocumento(f: FinestraStilista): string {
  const percorso = f.documento.split(' - ').slice(1).join(' - ');
  return percorso.split(/[\\/]/).pop() || 'documento senza nome';
}

/** I contorni selezionati in Stilista, come SVG in mm (un colore per oggetto). */
export async function selezioneDaStilista(f: FinestraStilista): Promise<string> {
  // per le prove senza mouse: ?stilista-oggetti=0,1 prende quegli oggetti del documento invece della selezione
  const prova = new URLSearchParams(location.search).get('stilista-oggetti');
  const r = await fetch(`http://127.0.0.1:${f.porta}/selezione.svg${prova ? `?oggetti=${encodeURIComponent(prova)}` : ''}`);
  if (!r.ok) {
    const errore = await r.json().catch(() => null) as { errore?: string } | null;
    throw new Error(errore?.errore ?? `Stilista ha risposto ${r.status}`);
  }
  return r.text();
}

/**
 * Dove stava, in Stilista, lo 0,0 di un SVG dato dal plugin (`data-rg-stilista-origine`, mm); null se
 * l'SVG non viene da Stilista. Il ricamo fatto su quel cartamodello torna lì, al suo posto.
 */
export function origineStilista(svg: string): [number, number] | null {
  const m = /data-rg-stilista-origine="(-?[\d.]+) (-?[\d.]+)"/.exec(svg.slice(0, 2000));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** L'ago dell'oggetto selezionato in Stilista (`data-rg-stilista-ago`), o null. */
export function agoStilista(svg: string): number | null {
  const m = /data-rg-stilista-ago="(\d+)"/.exec(svg.slice(0, 2000));
  return m ? Number(m[1]) : null;
}

/**
 * Il colore con cui il plugin disegna i fori (le aree vuote dei riempimenti) nell'SVG della selezione
 * (`data-rg-stilista-fori`, minuscolo come i colori dell'import); null se non ci sono fori.
 */
export function coloreForiStilista(svg: string): string | null {
  const m = /data-rg-stilista-fori="(#[0-9a-fA-F]{6})"/.exec(svg.slice(0, 2000));
  return m ? m[1].toLowerCase() : null;
}

/** Il colore del primo oggetto della selezione (il primo tracciato che non è un foro), o null. */
export function primoColoreStilista(svg: string): string | null {
  const fori = coloreForiStilista(svg);
  return [...svg.matchAll(/stroke="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]).find((c) => c.toLowerCase() !== fori) ?? null;
}

/**
 * L'SVG della selezione coi fori riportati al colore del loro oggetto (data-rg-stilista-di), e gli altri colori
 * com'erano: ogni stop e ogni colore resta una riga a sé. Per i tool che i vuoti li riconoscono come anelli interni
 * dello stesso colore (oblique). Da un plugin vecchio, che non dice di chi è il foro, il foro va al primo colore.
 */
export function svgForiAiLoroColori(svg: string): string {
  const fori = coloreForiStilista(svg);
  const primo = primoColoreStilista(svg);
  if (!fori || !primo) return svg;
  return svg.replace(/<path\b[^>]*>/g, (tag) => {
    if (!new RegExp(`stroke="${fori}"`, 'i').test(tag)) return tag;
    const di = /data-rg-stilista-di="(#[0-9a-fA-F]{6})"/.exec(tag)?.[1] ?? primo;
    return tag.replace(/stroke="#[0-9a-fA-F]{6}"/, `stroke="${di}"`);
  });
}

/** Le polilinee di un ricamo (mm) come punti per Stilista: il primo punto di ogni polilinea dopo la prima è un salto. */
export function puntiDaPolilinee(polilinee: Array<Array<{ x: number; y: number }>>): Array<[number, number, number]> {
  const punti: Array<[number, number, number]> = [];
  for (const linea of polilinee) {
    linea.forEach((p, i) => punti.push([Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, i === 0 && punti.length > 0 ? 1 : 0]));
  }
  return punti;
}

export interface EsitoRitorno {
  ok: boolean;
  punti_chiesti: number;
  punti_letti: number;
  salti: number;
  tipo_dopo: string;
  ago: string;
  /** Il plugin ha scritto i parametri nell'oggetto. Un plugin di prima non lo dice. */
  parametri_salvati?: boolean;
  errore?: string;
}

/** Il ricamo torna nel documento aperto in Stilista, al suo posto, come oggetto a punti fissi. */
export async function puntiAStilista(
  f: FinestraStilista,
  ricamo: { origine_mm: [number, number]; punti: Array<[number, number, number]>; nome?: string; ago?: number; parametri?: string },
): Promise<EsitoRitorno> {
  const r = await fetch(`http://127.0.0.1:${f.porta}/punti`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RG-Link': '1' },
    body: JSON.stringify(ricamo),
  });
  if (r.status === 404) throw new Error('in questa finestra c\'è il plugin di prima, che non sa rimettere il ricamo nel documento: chiudi e riapri Stilista');
  const esito = await r.json().catch(() => null) as EsitoRitorno | null;
  if (!r.ok || !esito?.ok) throw new Error(esito?.errore ?? `Stilista ha risposto ${r.status}`);
  return esito;
}

/**
 * Manda un DST a Stilista, che lo apre in un documento nuovo. I parametri vanno in coda al corpo: un plugin di
 * prima li scrive nel file dopo il DST, dove nessuno li legge, e il DST resta buono. Dice se li ha salvati.
 */
export async function dstAStilista(f: FinestraStilista, dst: Uint8Array, nome: string, parametri?: string): Promise<boolean> {
  const coda = new TextEncoder().encode(parametri ?? '');
  const corpo = new Uint8Array(dst.length + coda.length);
  corpo.set(dst);
  corpo.set(coda, dst.length);
  const r = await fetch(`http://127.0.0.1:${f.porta}/dst?nome=${encodeURIComponent(nome)}${coda.length ? `&parametri=${coda.length}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-RG-Link': '1' },
    body: corpo as unknown as BodyInit,
  });
  const esito = await r.json().catch(() => null) as { ok?: boolean; parametri_salvati?: boolean; errore?: string } | null;
  if (!r.ok || !esito?.ok) throw new Error(esito?.errore ?? `Stilista ha risposto ${r.status}`);
  return !!esito.parametri_salvati;
}

// ------------------------------------------------------------------------------------------------
// I PARAMETRI NELL'OGGETTO (2026-11-03, Lorenzo: «non so come né dove salvarmi i parametri di creazione delle cose
// fatte con i tools»). «Invia a Stilista» scrive il progetto del tool — la busta del suo DST (`conBusta`), più il
// cartamodello se la busta non ce l'ha — nell'oggetto; settimane dopo si seleziona l'oggetto e il tool riparte da
// lì. Il plugin lo tiene nella descrizione dell'oggetto: vedi sapere/codice/stilista-parametri-nell-oggetto.md.
// ------------------------------------------------------------------------------------------------

/** Il progetto come sta nell'oggetto di Stilista. */
export interface ProgettoInStilista {
  v: 1;
  /** L'id del tool, quello della busta. */
  tool: string;
  /** Quando è stato mandato (ISO). */
  quando: string;
  nome?: string;
  /** Il cartamodello da cui è partito, se la busta non porta già il disegno. */
  sorgente?: string;
  /** I metadati del DST del tool, gli stessi che legge quando riapre quel DST. */
  meta: Record<string, unknown>;
}

/** Oltre non è provato (1 MB nella descrizione torna identico): si lascia giù il cartamodello, poi tutto. */
const MASSIMO_PARAMETRI = 1_000_000;

/** Il progetto in testo: JSON compresso (gzip) in base64, una riga senza caratteri strani. */
export async function impacchettaProgetto(p: ProgettoInStilista): Promise<string> {
  const flusso = new Blob([JSON.stringify(p)]).stream().pipeThrough(new CompressionStream('gzip'));
  const byte = new Uint8Array(await new Response(flusso).arrayBuffer());
  let testo = '';
  for (let i = 0; i < byte.length; i += 0x8000) testo += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(testo);
}

/** Il contrario di `impacchettaProgetto`; null se il testo non è un progetto. */
export async function spacchettaProgetto(dati: string): Promise<ProgettoInStilista | null> {
  try {
    const byte = Uint8Array.from(atob(dati), (c) => c.charCodeAt(0));
    const flusso = new Blob([byte]).stream().pipeThrough(new DecompressionStream('gzip'));
    const p = JSON.parse(await new Response(flusso).text()) as ProgettoInStilista;
    return p?.v === 1 && typeof p.tool === 'string' && p.meta && typeof p.meta === 'object' ? p : null;
  } catch {
    return null;
  }
}

export interface ParametriLetti {
  oggetti: number;
  conParametri: number;
  /** Quanti progetti diversi ci sono nella selezione. */
  diversi: number;
  progetto: ProgettoInStilista | null;
}

/** Il progetto scritto negli oggetti selezionati; null da un plugin di prima, che non sa dirlo. */
export async function parametriDaStilista(f: FinestraStilista): Promise<ParametriLetti | null> {
  const prova = new URLSearchParams(location.search).get('stilista-oggetti');
  const r = await fetch(`http://127.0.0.1:${f.porta}/parametri${prova ? `?oggetti=${encodeURIComponent(prova)}` : ''}`);
  if (!r.ok) return null;
  const letti = await r.json() as { oggetti: number; con_parametri: number; diversi: number; parametri: string | null };
  return {
    oggetti: letti.oggetti,
    conParametri: letti.con_parametri,
    diversi: letti.diversi,
    progetto: letti.parametri ? await spacchettaProgetto(letti.parametri) : null,
  };
}

// ------------------------------------------------------------------------------------------------
// L'AGGANCIO di un tool (2026-10-21): i due pulsanti, uguali in tutti i tool. Il tool dice solo come si
// fa da lui quello che già fa — caricare un SVG come un file scelto, dare i ruoli, quali strati ha cucito,
// fare il DST — e qui si decide il resto: quale finestra, i fori, il ritorno al suo posto o in un
// documento nuovo. Il Generatore pattern è stato il primo; gli altri tool usano la stessa strada.
// ------------------------------------------------------------------------------------------------

export interface StratoPerStilista {
  /** Il nome con cui l'oggetto entra in Stilista (es. «raso», «base»). */
  nome?: string;
  /** Le polilinee cucite in mm, nel riferimento del cartamodello importato. Fra una e l'altra: salto. */
  polylines: Array<Array<{ x: number; y: number }>>;
  /**
   * Al posto dei punti, riempimenti di Stilista (2026-10-29, Pattern a macchie): ogni forma torna come una copia del
   * riempimento selezionato in Stilista, con la direzione dei punti e l'ingresso e l'uscita dati qui, nell'ordine.
   */
  riempimenti?: {
    orientamentoDeg?: number;
    forme: Array<{ contorno: Array<{ x: number; y: number }>; inizio: { x: number; y: number }; fine: { x: number; y: number } }>;
  };
}

export interface EsitoRiempimenti {
  ok: boolean;
  macchie: number;
  chieste: number;
  punti: number;
  parametri_salvati?: boolean;
  ingresso_scarto_max_mm: number;
  uscita_scarto_max_mm: number;
  errori: string[];
  errore?: string;
}

const mm = (p: { x: number; y: number }): [number, number] => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000];

/** Le forme tornano nel documento aperto come copie del riempimento selezionato in Stilista (il modello). */
export async function riempimentiAStilista(
  f: FinestraStilista,
  origine: [number, number],
  r: NonNullable<StratoPerStilista['riempimenti']>,
  extra: { nome?: string; ago?: number; parametri?: string } = {},
): Promise<EsitoRiempimenti> {
  const risposta = await fetch(`http://127.0.0.1:${f.porta}/riempimenti`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RG-Link': '1' },
    body: JSON.stringify({
      origine_mm: origine,
      ...(r.orientamentoDeg !== undefined ? { orientamento_deg: r.orientamentoDeg } : {}),
      ...extra,
      macchie: r.forme.map((m) => ({ contorno_mm: m.contorno.map(mm), inizio_mm: mm(m.inizio), fine_mm: mm(m.fine) })),
    }),
  });
  if (risposta.status === 404) throw new Error('in questa finestra c\'è il plugin di prima, che non sa fare i riempimenti: chiudi e riapri Stilista');
  const esito = await risposta.json().catch(() => null) as EsitoRiempimenti | null;
  if (!risposta.ok || !esito?.ok) throw new Error(esito?.errore ?? (esito?.errori?.length ? esito.errori.join('; ') : `Stilista ha risposto ${risposta.status}`));
  return esito;
}

export interface AggancioStilista {
  /** L'id del tool, quello della sua busta: un oggetto fatto da lui si riapre invece di ricalcarne i contorni. */
  tool?: string;
  /**
   * Rimette un progetto (i metadati del suo DST), come quando si riapre quel DST: parametri, ruoli, pattern.
   * Il cartamodello, se la busta non lo porta, è già stato caricato con `carica`. Dice se il progetto era suo.
   */
  riapri?(meta: Record<string, unknown>): boolean;
  /** Carica l'SVG della selezione esattamente come se l'utente l'avesse scelto col bottone del file. */
  carica(svg: string, nome: string): void | Promise<void>;
  /**
   * Dà i ruoli ai colori appena caricati: `fori` è il colore delle aree vuote (minuscolo), o null se non
   * ce ne sono; ogni altro colore è il contorno da lavorare. Un tool senza ruoli per colore non lo passa.
   */
  ruoli?(fori: string | null): void;
  /**
   * Cosa diventano i fori nel tool: «vuoti» (aree da non ricamare, il caso normale) o «esclusi» (il tool non
   * ha aree vuote: restano senza ruolo). Serve solo a dirlo giusto nella barra di stato.
   */
  fori?: 'vuoti' | 'esclusi';
  /** Il testo del cartamodello caricato adesso (per sapere se viene da Stilista e dov'era), o null. */
  sorgente(): string | null;
  /** Gli strati cuciti, nell'ordine di macchina: ognuno torna in Stilista come un oggetto. */
  strati(): StratoPerStilista[];
  /** Il DST del tool, per quando il cartamodello non viene da Stilista. */
  dst(): { bytes: Uint8Array; nome: string };
  /** Un messaggio nella barra di stato del tool. */
  stato(testo: string): void;
}

const NON_RISPONDE = 'non risponde: è aperto, con RG Stilista Link installato?';

/**
 * Gli strati CUCITI di un export della suite (`ExportLayer[]`), come li cuce `dstFromExportLayers`: si
 * saltano quelli di sola forma (`shapeOnly`) e quelli vuoti; uno strato = un oggetto in Stilista.
 */
export function stratiCuciti(
  layers: Array<{ id: string; shapeOnly?: boolean; polylines: Array<Array<{ x: number; y: number }>> }>,
): StratoPerStilista[] {
  return layers
    .filter((l) => !l.shapeOnly && l.polylines.some((p) => p.length > 1))
    .map((l) => ({ nome: l.id, polylines: l.polylines }));
}

let osservaRiapertura: MutationObserver | null = null;

/**
 * Dopo una riapertura, accanto a «Prendi la selezione»: di quando sono i parametri, e il bottone per chi vuole
 * l'oggetto come forma. Non basta la barra di stato: i tool che calcolano in differita ridisegnano il pannello e
 * riscrivono la barra quando il calcolo finisce, e l'avviso sparirebbe. Quindi, se il pannello si ridisegna, si
 * rimette; finché non si riprende la selezione o non si cambia tool.
 */
function notaRiapertura(a: AggancioStilista, testo: string | null): void {
  osservaRiapertura?.disconnect();
  osservaRiapertura = null;
  document.getElementById('riapertoDaStilista')?.remove();
  if (!testo) return;
  const scheda = location.hash;
  const metti = () => {
    if (location.hash !== scheda) { notaRiapertura(a, null); return; }
    const prendi = document.getElementById('fromStilista');
    if (!prendi || document.getElementById('riapertoDaStilista')) return;
    const riga = document.createElement('div');
    riga.id = 'riapertoDaStilista';
    riga.className = 'rg-field__help';
    riga.textContent = `${testo} `;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rg-button rg-button--ghost rg-button--small';
    b.title = "Riprende l'oggetto selezionato come forma, senza i parametri con cui è stato fatto";
    b.textContent = 'Prendi solo i contorni';
    b.addEventListener('click', () => { void prendiSelezioneStilista(a, { soloContorni: true }); });
    riga.append(b);
    prendi.after(riga);
  };
  osservaRiapertura = new MutationObserver(metti);
  osservaRiapertura.observe(document.body, { childList: true, subtree: true });
  metti();
}

/**
 * I contorni selezionati in Stilista diventano il cartamodello del tool. Se gli oggetti selezionati sono TUTTI
 * stati fatti da questo tool si riapre il loro progetto (Lorenzo, 2026-11-03): i contorni di un ricamo tornato
 * sono i suoi punti, un cartamodello non servirebbe. Con oggetti misti o di un altro tool si prendono i contorni.
 */
export async function prendiSelezioneStilista(a: AggancioStilista, opzioni: { soloContorni?: boolean } = {}): Promise<void> {
  a.stato('Cerco Stilista…');
  try {
    const finestra = await trovaStilista();
    if (!finestra) throw new Error(NON_RISPONDE);
    const letti = await parametriDaStilista(finestra).catch(() => null);
    const progetto = opzioni.soloContorni ? null : letti?.progetto ?? null;
    // anche quando si riapre: chiedendo la selezione il plugin ricorda da quale oggetto copiare il ritorno
    const svg = await selezioneDaStilista(finestra);
    const documento = nomeDocumento(finestra).replace(/\.[^.]+$/, '');
    if (progetto && letti?.conParametri === letti?.oggetti && progetto.tool === a.tool && a.riapri) {
      if (progetto.sorgente) {
        await a.carica(progetto.sorgente, `${documento}-stilista.svg`);
        a.ruoli?.(coloreForiStilista(progetto.sorgente));
      }
      if (!a.riapri(progetto.meta)) throw new Error('il progetto scritto in questo oggetto non si riapre qui');
      const quando = new Date(progetto.quando).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
      const altri = (letti?.diversi ?? 1) > 1 ? ` · nella selezione ci sono ${letti?.diversi} progetti: questo è il primo` : '';
      const riaperto = `Riaperto l'oggetto da Stilista (${documento}): parametri del ${quando}${altri}`;
      notaRiapertura(a, riaperto);
      a.stato(riaperto);
      return;
    }
    await a.carica(svg, `${documento}-stilista.svg`);
    a.ruoli?.(coloreForiStilista(svg));
    notaRiapertura(a, null);
    const fori = !coloreForiStilista(svg) ? '' : a.fori === 'esclusi' ? ' (i fori restano senza ruolo: qui non ci sono aree vuote)' : ', coi fori come aree vuote';
    const altro = progetto && progetto.tool !== a.tool ? ` · l'oggetto è stato fatto con ${progetto.tool}: i suoi parametri si riaprono da lì` : '';
    a.stato(`Selezione presa da Stilista (${documento})${fori}${altro}`);
  } catch (e) {
    a.stato('Stilista: ' + (e as Error).message);
  }
}

/**
 * Il progetto da scrivere nell'oggetto: la busta del DST del tool, e il cartamodello se la busta non porta il suo
 * testo. Non ferma mai l'invio: se non si può, il ricamo va lo stesso e la nota lo dice.
 */
export async function progettoDaInviare(a: Pick<AggancioStilista, 'dst' | 'sorgente'>, dst?: { bytes: Uint8Array; nome: string }): Promise<{ dati?: string; nota: string }> {
  try {
    const { bytes, nome } = dst ?? a.dst();
    const meta = readDstMetadata(bytes);
    const tool = typeof meta?.tool === 'string' ? meta.tool : typeof meta?.rgProject === 'string' ? meta.rgProject : null;
    if (!meta || !tool) return { nota: ' · parametri non salvati: il DST del tool non li ha' };
    const base: ProgettoInStilista = { v: 1, tool, quando: new Date().toISOString(), nome, meta };
    const testo = typeof (meta.drawing as { text?: unknown } | undefined)?.text === 'string' ? null : a.sorgente();
    if (testo) {
      const dati = await impacchettaProgetto({ ...base, sorgente: testo });
      if (dati.length <= MASSIMO_PARAMETRI) return { dati, nota: '' };
    }
    const dati = await impacchettaProgetto(base);
    if (dati.length > MASSIMO_PARAMETRI) return { nota: ' · parametri non salvati: troppo pesanti' };
    return { dati, nota: testo ? ' (senza il cartamodello: troppo pesante)' : '' };
  } catch (e) {
    return { nota: ` · parametri non salvati: ${(e as Error).message}` };
  }
}

/** La coda del messaggio di «Invia a Stilista»: i parametri sono al sicuro o no. */
function notaParametri(progetto: { dati?: string; nota: string }, salvati: boolean): string {
  if (!progetto.dati) return progetto.nota;
  return salvati ? ` · parametri salvati nell'oggetto${progetto.nota}` : ' · parametri NON salvati: il plugin è quello di prima, va aggiornato';
}

/**
 * Il ricamo in Stilista. Se il cartamodello è venuto da Stilista torna NEL suo documento, al suo posto,
 * a punti fissi, uno strato = un oggetto; altrimenti Stilista apre il DST in un documento nuovo.
 *
 * GLI AGHI (Lorenzo, 2026-10-21: «tanti tools prevedono già la divisione in stop e aghi, i dst fanno questo
 * appunto»): come nel DST ogni strato è un cambio ago — anche gli stop dello stesso filo, «come cambi ago» —
 * e gli aghi sono CONSECUTIVI da quello dell'oggetto selezionato (7, 8, 9…), coi colori che hanno già nel
 * documento.
 */
export async function inviaAStilista(a: AggancioStilista): Promise<void> {
  a.stato('Invio a Stilista…');
  try {
    const finestra = await trovaStilista();
    if (!finestra) throw new Error(NON_RISPONDE);
    const testo = a.sorgente();
    const origine = testo ? origineStilista(testo) : null;
    if (origine) {
      const strati = a.strati().filter((s) => s.polylines.some((l) => l.length > 1) || s.riempimenti?.forme.length);
      if (!strati.length) throw new Error('non c\'è niente da cucire');
      const agoBase = agoStilista(testo!);
      const progetto = await progettoDaInviare(a);
      let punti = 0, salti = 0, ago = '', riempite = 0, nonRiempite = 0, salvati = true;
      for (const [i, s] of strati.entries()) {
        a.stato(`Invio a Stilista… strato ${i + 1} di ${strati.length}`);
        if (s.riempimenti?.forme.length) {
          const esito = await riempimentiAStilista(finestra, origine, s.riempimenti, {
            nome: s.nome ?? `RG ${i + 1}`, ...(agoBase ? { ago: agoBase + i } : {}), ...(progetto.dati ? { parametri: progetto.dati } : {}),
          });
          punti += esito.punti; riempite += esito.macchie; nonRiempite += esito.chieste - esito.macchie;
          salvati &&= !!esito.parametri_salvati;
          continue;
        }
        const esito = await puntiAStilista(finestra, {
          origine_mm: origine, punti: puntiDaPolilinee(s.polylines), nome: s.nome ?? `RG ${i + 1}`,
          ...(agoBase ? { ago: agoBase + i } : {}), ...(progetto.dati ? { parametri: progetto.dati } : {}),
        });
        punti += esito.punti_letti; salti += esito.salti; ago = esito.ago;
        salvati &&= !!esito.parametri_salvati;
      }
      const quanti = strati.length > 1 ? `${strati.length} oggetti, ` : '';
      const aghi = strati.length > 1 && agoBase ? `aghi ${agoBase}–${agoBase + strati.length - 1}` : ago;
      const piene = riempite || nonRiempite
        ? `, ${riempite} forme come riempimenti di Stilista${nonRiempite ? ` (${nonRiempite} non riuscite: vedi il log del plugin)` : ''}` : '';
      a.stato(`Tornato in Stilista al suo posto: ${quanti}${punti.toLocaleString('it-IT')} punti (${salti} salti)${piene}, ${aghi}${notaParametri(progetto, salvati)}`);
      return;
    }
    const dst = a.dst();
    const progetto = await progettoDaInviare(a, dst);
    const salvati = await dstAStilista(finestra, dst.bytes, dst.nome, progetto.dati);
    a.stato(`Inviato a Stilista (${(dst.bytes.length / 1024).toFixed(1)} KB): si apre in un documento nuovo${notaParametri(progetto, salvati)}`);
  } catch (e) {
    a.stato('Stilista: ' + (e as Error).message);
  }
}

/**
 * Collega i due pulsanti (già nel DOM del tool) all'aggancio; e se il tool è stato aperto dal pulsante di
 * Stilista (`?stilista=<porta>`), prende subito la selezione. Restituisce la funzione «prendi» per chi
 * ricostruisce il pannello e deve ricollegare il bottone.
 */
export function collegaStilista(
  a: AggancioStilista,
  pulsanti: { prendi?: HTMLElement | null; invia?: HTMLElement | null },
  opzioni: { prendiSubito?: boolean } = {},
): () => Promise<void> {
  const prendi = () => prendiSelezioneStilista(a);
  pulsanti.prendi?.addEventListener('click', () => { void prendi(); });
  pulsanti.invia?.addEventListener('click', () => { void inviaAStilista(a); });
  if ((opzioni.prendiSubito ?? true) && portaDaIndirizzo()) void prendi();
  return prendi;
}

/** I due bottoni, con le classi del design system, da mettere accanto al file e all'export. */
export const BOTTONE_PRENDI_STILISTA = (id = 'fromStilista') =>
  `<button type="button" id="${id}" class="rg-button rg-button--ghost" title="I contorni degli oggetti selezionati in Stilista diventano il cartamodello (serve RG Stilista Link)">Prendi la selezione da Stilista</button>`;
export const BOTTONE_INVIA_STILISTA = (id = 'toStilistaBtn') =>
  `<button type="button" id="${id}" class="rg-button rg-button--outline rg-button--small" title="Il ricamo torna in Stilista: al suo posto se il cartamodello è venuto da lì, altrimenti in un documento nuovo (serve RG Stilista Link)">Invia a Stilista</button>`;

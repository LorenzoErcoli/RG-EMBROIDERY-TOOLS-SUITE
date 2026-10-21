// Il collegamento con Stilista (RG Stilista Link, strumenti-sviluppo/stilista-link): il plugin dentro
// Stilista ascolta su 127.0.0.1, una porta per finestra a partire da 5370. Un tool gli chiede la
// selezione come SVG (la legge col suo import di sempre) e gli manda indietro il lavoro.
//
// La finestra giusta: quella che ha aperto il tool (?stilista=<porta> nell'indirizzo), altrimenti
// fra quelle che rispondono quella con qualcosa selezionato, poi con un documento, poi l'ultima attivata.

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

/**
 * Il colore con cui il plugin disegna i fori (le aree vuote dei riempimenti) nell'SVG della selezione
 * (`data-rg-stilista-fori`, minuscolo come i colori dell'import); null se non ci sono fori.
 */
export function coloreForiStilista(svg: string): string | null {
  const m = /data-rg-stilista-fori="(#[0-9a-fA-F]{6})"/.exec(svg.slice(0, 2000));
  return m ? m[1].toLowerCase() : null;
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
  errore?: string;
}

/** Il ricamo torna nel documento aperto in Stilista, al suo posto, come oggetto a punti fissi. */
export async function puntiAStilista(
  f: FinestraStilista,
  ricamo: { origine_mm: [number, number]; punti: Array<[number, number, number]>; nome?: string },
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

/** Manda un DST a Stilista, che lo apre in un documento nuovo. */
export async function dstAStilista(f: FinestraStilista, dst: Uint8Array, nome: string): Promise<void> {
  const r = await fetch(`http://127.0.0.1:${f.porta}/dst?nome=${encodeURIComponent(nome)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-RG-Link': '1' },
    body: dst as unknown as BodyInit,
  });
  const esito = await r.json().catch(() => null) as { ok?: boolean; errore?: string } | null;
  if (!r.ok || !esito?.ok) throw new Error(esito?.errore ?? `Stilista ha risposto ${r.status}`);
}

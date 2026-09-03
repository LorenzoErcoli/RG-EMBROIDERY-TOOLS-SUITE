// Salvataggio file — comportamento unico per tutta la suite (R29).
// L'utente sceglie NOME e CARTELLA dal pannello del browser, invece di trovarsi
// il file in Download con un nome deciso da noi.

export type SaveOutcome = 'saved' | 'cancelled' | 'downloaded';

export interface SaveOptions {
  /** Nome proposto nella finestra di salvataggio, estensione inclusa. */
  suggestedName: string;
  mime?: string;
  /** Estensione con il punto, es. '.svg'. */
  extension?: string;
  /** Come viene chiamato il tipo di file nella finestra. */
  description?: string;
}

/**
 * Identificativo della cartella: il browser ricorda l'ultima usata *per id*.
 * Uno solo per tutta la suite → il secondo export si apre dove hai salvato il primo,
 * anche cambiando strumento.
 */
const DIR_ID = 'rg-tools-export';

type SaveFilePicker = (opts: {
  suggestedName?: string;
  id?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<{ createWritable(): Promise<{ write(data: string | BufferSource | Blob): Promise<void>; close(): Promise<void> }> }>;

/** Destinazione già scelta: fra la scelta e la scrittura ci può stare il lavoro pesante. */
export interface SaveTarget {
  /** `true` se si scriverà sul file scelto dall'utente, `false` se si ripiegherà sul download. */
  readonly picked: boolean;
  write(data: string | Uint8Array): Promise<SaveOutcome>;
}

function download(data: string | Uint8Array, name: string, mime: string): void {
  const blob = new Blob([typeof data === 'string' ? data : (data as unknown as BlobPart)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);   // revocare subito tronca il download su alcuni browser
}

/**
 * Chiede SUBITO dove salvare e ritorna la destinazione: il lavoro pesante viene DOPO.
 *
 * Serve perché la finestra di sistema pretende l'ATTIVAZIONE UTENTE, che dura pochi secondi:
 * un tool che calcola dieci secondi e poi chiama il salvataggio si vede rifiutare la finestra e
 * il file finisce zitto in Download. Misurato nel browser: al clic `userActivation.isActive` è
 * `true`, dopo 6s di lavoro sincrono è `false`. Chi ha un export lento chiama PRIMA questa,
 * poi calcola, poi `write`.
 *
 * Ritorna `null` SOLO se l'utente annulla. Se il browser non ha la finestra (Firefox, Safari)
 * ritorna una destinazione che scaricherà: il chiamante non deve saperlo.
 */
export async function pickSaveTarget(opts: SaveOptions): Promise<SaveTarget | null> {
  const { suggestedName, mime = 'application/octet-stream', extension = '.bin', description = 'File' } = opts;
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({ suggestedName, id: DIR_ID, types: [{ description, accept: { [mime]: [extension] } }] });
      return {
        picked: true,
        async write(data: string | Uint8Array): Promise<SaveOutcome> {
          try {
            const writable = await handle.createWritable();
            // cast: con le lib TS recenti Uint8Array è generico su ArrayBufferLike; a runtime è sempre BufferSource valido.
            await writable.write(typeof data === 'string' ? data : (data as unknown as BufferSource));
            await writable.close();
            return 'saved';
          } catch {
            download(data, suggestedName, mime);   // permesso revocato a metà strada: meglio il download che niente
            return 'downloaded';
          }
        },
      };
    } catch (err) {
      // L'utente ha chiuso la finestra: non è un errore, non si scarica nulla di nascosto.
      if ((err as DOMException)?.name === 'AbortError') return null;
      // Qualsiasi altro intoppo (permessi, contesto non sicuro, attivazione scaduta) → download classico.
    }
  }

  return { picked: false, async write(data: string | Uint8Array): Promise<SaveOutcome> { download(data, suggestedName, mime); return 'downloaded'; } };
}

/**
 * Salva del testo su file. Dove il browser lo consente apre la finestra di
 * salvataggio del sistema; altrimenti (Firefox, Safari) ripiega sul download
 * classico, così la funzione resta utilizzabile ovunque.
 */
export async function saveTextFile(text: string, opts: SaveOptions): Promise<SaveOutcome> {
  const target = await pickSaveTarget({ mime: 'image/svg+xml', extension: '.svg', ...opts });
  return target ? target.write(text) : 'cancelled';
}

/**
 * Salva dati BINARI (Uint8Array) su file — gemello di `saveTextFile` per formati non-testo (es. .dst).
 * Stessa finestra di sistema dove supportata, altrimenti download classico (R29).
 */
export async function saveBinaryFile(data: Uint8Array, opts: SaveOptions): Promise<SaveOutcome> {
  const target = await pickSaveTarget(opts);
  return target ? target.write(data) : 'cancelled';
}

/** Messaggio pronto per la statusbar, così tutti i tool dicono la stessa cosa. */
export function saveOutcomeMessage(outcome: SaveOutcome, name: string): string {
  if (outcome === 'saved') return `Salvato: ${name}`;
  if (outcome === 'cancelled') return 'Salvataggio annullato';
  return `Scaricato in Download: ${name}`;
}

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

/**
 * Salva del testo su file. Dove il browser lo consente apre la finestra di
 * salvataggio del sistema; altrimenti (Firefox, Safari) ripiega sul download
 * classico, così la funzione resta utilizzabile ovunque.
 */
export async function saveTextFile(text: string, opts: SaveOptions): Promise<SaveOutcome> {
  const { suggestedName, mime = 'image/svg+xml', extension = '.svg', description = 'File' } = opts;
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName,
        id: DIR_ID,
        types: [{ description, accept: { [mime]: [extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return 'saved';
    } catch (err) {
      // L'utente ha chiuso la finestra: non è un errore, non si scarica nulla di nascosto.
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Qualsiasi altro intoppo (permessi, contesto non sicuro) → download classico.
    }
  }

  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  // Revocare subito può troncare il download su alcuni browser.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/**
 * Salva dati BINARI (Uint8Array) su file — gemello di `saveTextFile` per formati non-testo (es. .dst).
 * Stessa finestra di sistema dove supportata, altrimenti download classico (R29).
 */
export async function saveBinaryFile(data: Uint8Array, opts: SaveOptions): Promise<SaveOutcome> {
  const { suggestedName, mime = 'application/octet-stream', extension = '.bin', description = 'File' } = opts;
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({ suggestedName, id: DIR_ID, types: [{ description, accept: { [mime]: [extension] } }] });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return 'saved';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }

  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Messaggio pronto per la statusbar, così tutti i tool dicono la stessa cosa. */
export function saveOutcomeMessage(outcome: SaveOutcome, name: string): string {
  if (outcome === 'saved') return `Salvato: ${name}`;
  if (outcome === 'cancelled') return 'Salvataggio annullato';
  return `Scaricato in Download: ${name}`;
}

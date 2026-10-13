// I tipi del registro dei parametri (K1 di AVVIO-CERVELLO-RICAMO.md, §3a).
//
// Chi descrive un tool scrive `DichiarazioneParametro` (un parametro in un tool). Il registro
// (`parametri.ts`) le fonde per `id` in `Parametro`: la descrizione comune sta sul parametro, quello
// che cambia da tool a tool (default, limiti, a volte l'etichetta) sta in `Parametro.tool`.

/** Unità di misura. `''` = adimensionale (un conteggio, un interruttore, una scelta). */
export type Unita = 'mm' | 'mm2' | 'deg' | '%' | 'px' | 'dpi' | 'rapporto' | 'peso' | 's' | '';

/** `int` = numero intero (un conteggio); `num` = numero reale; `enum` = una scelta fra `opzioni`. */
export type Tipo = 'num' | 'int' | 'bool' | 'enum' | 'testo';

/** Un valore salvato. Le liste (palette, matrici) non hanno ancora un tipo nel registro: stanno nel debito. */
export type Valore = number | boolean | string | null | Valore[];

/** Un parametro, come lo descrive la scheda di un tool. */
export interface DichiarazioneParametro {
  /** Il nome canonico: inglese camelCase (decisione D1, 2026-09-28). Se il tool lo salva con un altro nome, quello va in `nome`. */
  id: string;
  /** Come il tool lo SALVA nel file di progetto, se diverso da `id` (es. `sormontoMm`). Nessun parametro si rinomina: si descrive. */
  nome?: string;
  /** Dove sta nel file di progetto: `'params'` (default) oppure la chiave dell'oggetto (es. `'route'`, `'stop'`). */
  dove?: string;
  /** L'etichetta italiana, come sta nel pannello. */
  etichetta: string;
  /** Una riga: cosa controlla. Dal pannello o dal commento nel codice, mai inventata. */
  aiuto: string;
  tipo: Tipo;
  unita: Unita;
  min?: number;
  max?: number;
  passo?: number;
  /** Per `enum`: i valori ammessi, come il tool li salva. */
  opzioni?: string[];
  /** Il valore con cui il tool parte (quello che il codice ha oggi). */
  predefinito: Valore;
  /** Le regole della Costituzione da cui dipende (`'R22'`, …). */
  regole?: string[];
  /** Il concetto di mestiere (vedi `concetti.ts`): raggruppa i parenti con nomi diversi. */
  concetto: string;
  /** Altri nomi con cui lo stesso parametro è comparso: per leggere i file vecchi. */
  sinonimi?: string[];
}

/** Quello che un tool dice di un parametro: il nome con cui lo salva, il default e le differenze dalla descrizione comune. */
export interface UsoTool {
  nome: string;
  dove: string;
  predefinito: Valore;
  etichetta?: string;
  aiuto?: string;
  min?: number;
  max?: number;
  passo?: number;
  opzioni?: string[];
}

/** Un parametro del registro: la descrizione comune + chi lo usa. */
export interface Parametro {
  id: string;
  etichetta: string;
  aiuto: string;
  tipo: Tipo;
  unita: Unita;
  min?: number;
  max?: number;
  passo?: number;
  opzioni?: string[];
  regole: string[];
  concetto: string;
  sinonimi: string[];
  /** Per tool: come lo salva e con che default. */
  tool: Record<string, UsoTool>;
}

/** Un concetto di mestiere. Due parametri con lo stesso concetto e nomi diversi NON si fondono d'ufficio (D4, regola 7). */
export interface Concetto {
  id: string;
  descrizione: string;
}

/** Quello che esporta il file di ogni tool in `src/tool/`. */
export interface SchedaParametri {
  parametri: DichiarazioneParametro[];
  /** Concetti che solo questo tool usa (gli altri stanno in `concetti.ts`). */
  concetti?: Concetto[];
}

// Schema del pannello di "Cannage rafia".
// Struttura canonica DS (patterns/workspace.md, Testa A "sorgente-guidata"): la misura nasce dal disegno.
//   TESTA sempre aperta → 01 Disegno · 02 Colori e ruoli (le costruisce tool.ts).
//   CORPO in accordion → 03 Programma · 04 Stop 1 e 2 · 05 Stop 3 e 4 · 06 Stop 5 · 07 Stop 6.
// Etichette e unità come in REVISIONE-PARAMETRI.md: unità sempre nello slot, mai nel testo.
import { PARAMETRI_DAVANTI, PARAMETRI_LATO, type ParametriLinee } from './linee';
import { PARAMETRI_STOP, type ParametriStop } from './stop';
import { PARAMETRI_CORNICE, type ParametriCornice } from './cornice';

export type NumField = { kind: 'num'; name: string; label: string; unit?: string; min?: number; step: number; help?: string };
export type CheckField = { kind: 'check'; name: string; label: string };
export type Field = NumField | CheckField;

export type Valori = Record<string, number | boolean>;

/**
 * I parametri dello stop 5 (le linee). La soglia degli oggetti nel pannello è in %, nel motore è una
 * frazione: la conversione sta SOLO in `valoriDa` e `parametriDa`, così non si sbaglia da due parti.
 */
export const LINEE_FIELDS: Field[] = [
  { kind: 'num', name: 'passateCordoncino', label: 'Passate del cordoncino', min: 1, step: 2 },
  { kind: 'num', name: 'puntoMaxCordoncino', label: 'Punto massimo nel cordoncino', unit: 'mm', min: 0, step: 0.1, help: '0 = un punto per passata' },
  { kind: 'num', name: 'passateVerticali', label: 'Passate di scalette e meandri', min: 1, step: 2 },
  { kind: 'num', name: 'puntoMaxCorsa', label: 'Punto massimo del filo singolo', unit: 'mm', min: 0.5, step: 0.5 },
  { kind: 'num', name: 'lunghezzaPezzo', label: 'Lunghezza di un pezzo di cordoncino', unit: 'mm', min: 1, step: 0.1, help: 'oltre questa, più la soglia, il pezzo diventa due (con un fermo in più)' },
  { kind: 'num', name: 'lunghezzaMattoncino', label: 'Lunghezza di un mattoncino', unit: 'mm', min: 1, step: 0.1, help: 'lo stesso, per scalette e meandri' },
  { kind: 'num', name: 'sogliaOggetti', label: 'Soglia per aggiungere oggetti', unit: '%', min: 0, step: 5, help: 'di quanto un oggetto può allungarsi col rombo prima di dividersi' },
  { kind: 'num', name: 'sporgenzaSinistra', label: 'Sporgenza a sinistra', unit: 'mm', min: 0, step: 0.5, help: 'le linee partono fuori dal pezzo di tanto' },
  { kind: 'num', name: 'sporgenzaDestra', label: 'Sporgenza a destra', unit: 'mm', min: 0, step: 0.5, help: 'le linee arrivano fino in fondo e finiscono fuori dal pezzo di tanto, come a sinistra' },
  { kind: 'num', name: 'allargamentoFinestre', label: 'Allargamento delle finestre', unit: 'mm', min: 0, step: 0.5, help: 'dove la cornice attraversa la linea la finestra si allarga di tanto per parte: i fermi si allontanano e gli uncini ci stanno in mezzo; 0 = come nel DST M1404' },
  { kind: 'num', name: 'margineVerticale', label: 'Margine in alto e in basso', unit: 'mm', min: 0, step: 0.5, help: 'scalette, meandri e barre si fermano a questa distanza dal bordo' },
  { kind: 'num', name: 'puntoPassaggioBordo', label: 'Punto dei passaggi sul bordo', unit: 'mm', min: 0.5, step: 0.5 },
  { kind: 'check', name: 'termogarze', label: 'Contorno per le termogarze' },
  { kind: 'num', name: 'puntoTermogarze', label: 'Punto del contorno termogarze', unit: 'mm', min: 0.5, step: 0.5 },
];

/** I parametri degli stop 1 (contorno a impunture) e 2 (griglia che blocca i materiali). */
export const STOP_FIELDS: Field[] = [
  { kind: 'num', name: 'puntoContorno', label: 'Punto del contorno a impunture', unit: 'mm', min: 1, step: 0.5, help: 'stop 1, e il contorno all’inizio dello stop 2' },
  { kind: 'num', name: 'puntoGriglia', label: 'Punto della griglia', unit: 'mm', min: 1, step: 0.5 },
  { kind: 'num', name: 'rientroGriglia', label: 'Rientro della griglia dal contorno', unit: 'mm', min: 0, step: 0.5, help: 'la griglia si ferma a questa distanza dal bordo del pezzo; lì il filo passa da una linea all’altra' },
  { kind: 'num', name: 'lineaMinima', label: 'Linea di griglia più corta', unit: 'mm', min: 0, step: 1, help: 'i pezzi di linea più corti di così, negli angoli, non si cuciono' },
];

/**
 * Le basi: quanto scaricare nelle aree di scarico. Stesso nome, etichetta e unità di Generatore pattern
 * e Pattern a zone (R28): è la stessa domanda.
 */
export const BASI_FIELDS: Field[] = [
  { kind: 'num', name: 'reliefPercent', label: 'Scarico nelle aree', unit: '%', min: 0, step: 5, help: 'dentro le tinte marcate «Area di scarico» le basi hanno meno passate: 50 = metà; 0 = niente' },
];

/**
 * Lo stop 6, la cornice. Anche qui la soglia è in % nel pannello e frazione nel motore: la conversione
 * sta SOLO in `valoriCorniceDa` e `parametriCorniceDa`.
 */
export const CORNICE_FIELDS: Field[] = [
  { kind: 'num', name: 'passateOrizzontale', label: 'Passate dell’orizzontale', min: 1, step: 2 },
  { kind: 'num', name: 'passateVerticale', label: 'Passate della verticale', min: 1, step: 1 },
  { kind: 'num', name: 'lunghezzaOrizzontale', label: 'Lunghezza dell’orizzontale', unit: 'mm', min: 0.5, step: 0.1, help: 'metà nel pattern 1 e metà nel pattern 2: il centro sta sempre sul lato del rombo' },
  { kind: 'num', name: 'lunghezzaVerticale', label: 'Lunghezza della verticale', unit: 'mm', min: 0.5, step: 0.1 },
  { kind: 'num', name: 'irregolarita', label: 'Irregolarità', unit: 'mm', min: 0, step: 0.1, help: 'di quanto al massimo un uncino è più lungo o più corto degli altri; 0 = tutti uguali' },
  { kind: 'num', name: 'rientro', label: 'Rientro dal bordo', unit: 'mm', min: 0, step: 0.5, help: 'distanza minima dal bordo del pezzo: un’orizzontale che ci arriva più vicino non si cuce, una verticale si accorcia' },
  { kind: 'num', name: 'sogliaUncini', label: 'Soglia per aggiungere uncini', unit: '%', min: 0, step: 5, help: 'di quanto il passo può allungarsi col rombo prima che gli uncini aumentino' },
  { kind: 'num', name: 'puntoPassaggio', label: 'Punto dei passaggi', unit: 'mm', min: 0.5, step: 0.5 },
];

export function valoriCorniceDa(par: ParametriCornice): Valori {
  const src = par as unknown as Record<string, number>;
  const out: Valori = {};
  for (const f of CORNICE_FIELDS) out[f.name] = f.name === 'sogliaUncini' ? Math.round(par.sogliaUncini * 1000) / 10 : src[f.name];
  return out;
}

export function parametriCorniceDa(v: Valori): ParametriCornice {
  const p: Record<string, unknown> = { ...PARAMETRI_CORNICE };
  for (const f of CORNICE_FIELDS) {
    const x = v[f.name];
    if (typeof x === 'number' && Number.isFinite(x)) p[f.name] = f.name === 'sogliaUncini' ? x / 100 : x;
  }
  return p as ParametriCornice;
}

export function valoriDa(par: ParametriLinee): Valori {
  const src = par as unknown as Record<string, number | boolean>;
  const out: Valori = {};
  for (const f of LINEE_FIELDS) out[f.name] = f.name === 'sogliaOggetti' ? Math.round(par.sogliaOggetti * 1000) / 10 : src[f.name];
  return out;
}

export function parametriDa(v: Valori): ParametriLinee {
  const p: Record<string, unknown> = { ...PARAMETRI_DAVANTI };
  for (const f of LINEE_FIELDS) {
    const x = v[f.name];
    if (f.kind === 'check') p[f.name] = Boolean(x);
    else if (typeof x === 'number' && Number.isFinite(x)) p[f.name] = f.name === 'sogliaOggetti' ? x / 100 : x;
  }
  return p as ParametriLinee;
}

export function parametriStopDa(v: Valori): ParametriStop {
  const p: Record<string, unknown> = { ...PARAMETRI_STOP };
  for (const f of STOP_FIELDS) { const x = v[f.name]; if (typeof x === 'number' && Number.isFinite(x)) p[f.name] = x; }
  return p as ParametriStop;
}

/** I due modi di cucire le linee visti nei DST: il davanti è il riferimento (Lorenzo), il lato un'alternativa. */
export const PRESET_LINEE: { id: string; label: string; parametri: ParametriLinee }[] = [
  { id: 'davanti', label: 'Davanti — riferimento', parametri: PARAMETRI_DAVANTI },
  { id: 'lato', label: 'Lato — alternativa (punto corto)', parametri: PARAMETRI_LATO },
];

/**
 * I pattern di partenza delle basi. Nel DST M1404 la base del pattern 1 ha un punto mediano di 1,87 mm
 * e quella del pattern 2 di 2,5: sono il passo delle colonne dei due cannage di riferimento.
 */
export const BASI_PREDEFINITE = { p1: 'CANNAGE BASE — LEGGERO', p2: 'CANNAGE BASE — PIENA' };

/** Le stesse modalità di scala del Generatore pattern (è lo stesso importer). */
export const SCALE_MODES: [string, string][] = [
  ['illustrator-72dpi', 'Illustrator 72 dpi'],
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['viewbox-mm', 'ViewBox = mm'],
  ['custom-size', 'Dimensione reale custom'],
];

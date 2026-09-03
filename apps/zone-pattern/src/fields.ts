// Schema del pannello di "Pattern a zone".
// Struttura canonica DS (patterns/workspace.md, Testa A "sorgente-guidata"): la misura del
// prodotto NASCE DAL DISEGNO, quindi niente gruppo Formato —
//   TESTA sempre aperta → 01 Disegno · 02 Colori e ruoli (le costruisce tool.ts).
//   CORPO in accordion → Pattern A · Pattern B · Zone e sequenza.
//   CODA in accordion → Preset.
// Etichette e unità come in REVISIONE-PARAMETRI.md: unità sempre nello slot, mai nel testo.
export type NumField = { kind: 'num'; name: string; label: string; unit?: string; min?: number; step: number; value: number; help?: string };
export type CheckField = { kind: 'check'; name: string; label: string; value: boolean };
export type SelectField = { kind: 'select'; name: string; label: string; options: [string, string][]; value: string };
export type Field = NumField | CheckField | SelectField;
export type Group = { title: string; collapsible?: boolean; open?: boolean; fields: Field[] };

/**
 * I campi di UN pattern. Sono un sottoinsieme di `PatternConfig` del Generatore pattern:
 * mancano Formato e Sagoma, perché qui il formato e la sagoma di ogni blocco li dà la ZONA.
 */
export const PATTERN_FIELDS: Field[] = [
  { kind: 'num', name: 'parameterScalePercent', label: 'Ingrandisci tutti i parametri', unit: '%', min: 1, step: 1, value: 100 },
  { kind: 'num', name: 'horizontalZigzagWidth', label: 'Zig-zag orizzontale: larghezza', unit: 'mm', min: 0.5, step: 0.1, value: 5.5 },
  { kind: 'num', name: 'horizontalZigzagHeight', label: 'Zig-zag orizzontale: altezza', unit: 'mm', min: 0.1, step: 0.1, value: 4.3 },
  { kind: 'num', name: 'horizontalZigzagInterline', label: 'Zig-zag orizzontale: distanza tra i fili', unit: 'mm', min: 0.05, step: 0.01, value: 0.45 },
  { kind: 'num', name: 'horizontalZigzagOffsetX', label: 'Spostamento dal centro', unit: 'mm', step: 0.1, value: 0 },
  { kind: 'num', name: 'horizontalZigzagSpacing', label: 'Distanza tra gli zig-zag', unit: 'mm', min: 1, step: 0.1, value: 12 },
  { kind: 'num', name: 'verticalZigzagWidth', label: 'Zig-zag verticale: larghezza', unit: 'mm', min: 0.1, step: 0.1, value: 1.2 },
  { kind: 'num', name: 'verticalZigzagInterline', label: 'Zig-zag verticale: distanza tra i fili', unit: 'mm', min: 0.05, step: 0.01, value: 0.45 },
  { kind: 'num', name: 'verticalConnectorDiagonalOffsetY', label: 'Inclinazione del raccordo', unit: 'mm', min: 0, step: 0.1, value: 0 },
  { kind: 'num', name: 'stepX', label: 'Distanza tra le colonne', unit: 'mm', min: 0.5, step: 0.1, value: 5.2 },
  { kind: 'num', name: 'offsetY', label: 'Sfasamento tra colonne', unit: 'mm', min: 0, step: 0.1, value: 6 },
  { kind: 'num', name: 'horizontalAngleDeg', label: 'Inclinazione dello zig-zag orizzontale', unit: '°', step: 1, value: 0 },
  { kind: 'check', name: 'alternateHorizontalAngle', label: "Inverti l'inclinazione a colonne alterne", value: false },
  { kind: 'num', name: 'columnWaveAmplitude', label: "Ampiezza dell'onda", unit: 'mm', min: 0, step: 0.1, value: 0 },
  { kind: 'num', name: 'columnWaveLengthMm', label: "Lunghezza d'onda", unit: 'mm', min: 1, step: 1, value: 60, help: 'ogni quanti mm si ripete l’onda' },
  { kind: 'num', name: 'columnWavePhaseDeg', label: 'Fase', unit: '°', step: 5, value: 0 },
  { kind: 'check', name: 'repeatBack', label: 'Andata e ritorno (serpentina)', value: false },
  { kind: 'check', name: 'useConnectors', label: 'Raccorda le colonne fra loro', value: true },
  { kind: 'num', name: 'minStitchMm', label: 'Punto minimo', unit: 'mm', min: 0, step: 0.01, value: 0.4 },
  { kind: 'num', name: 'maxStitchMm', label: 'Lunghezza massima del punto', unit: 'mm', min: 0, step: 0.1, value: 6 },
  { kind: 'num', name: 'constructionStroke', label: 'Spessore di costruzione', unit: 'mm', min: 0.05, step: 0.05, value: 0.3, help: 'regola rientri, margini e raccordi — non è il filo disegnato' },
  // La pulizia del BORDO della singola zona. Stessi nomi e stesse etichette del Generatore
  // pattern: è la stessa domanda ("cosa faccio dei punti che cadono fuori dal contorno?") e
  // deve avere la stessa risposta e lo stesso vocabolario (R28).
  {
    kind: 'select', name: 'boundaryCleanupMode', label: 'Punti fuori dal contorno', value: 'adjust-then-delete',
    options: [['adjust-then-delete', 'Avvicina al bordo, poi elimina'], ['delete', 'Elimina']],
  },
  {
    kind: 'num', name: 'maxBoundaryAdjustment', label: 'Spostamento massimo verso il bordo', unit: 'mm', min: 0, step: 0.01, value: 0,
    help: 'quanto un punto può essere tirato sul bordo prima di essere eliminato; 0 = usa il punto minimo',
  },
];

/**
 * I nomi dei parametri che il pannello sa tenere. È l'UNICA lista: chi legge valori da fuori
 * (preset, SVG) deve chiedere qui cosa è tenibile, mai riscriversi un elenco per conto suo —
 * due elenchi divergono, e la divergenza si manifesta come un valore che sparisce in silenzio.
 * (Successo già pagato: `horizontalZigzagOffsetX` mancava e i file di Lorenzo lo perdevano.)
 */
export const PATTERN_FIELD_NAMES: string[] = PATTERN_FIELDS.map((f) => f.name);

/** Che TIPO ha ogni campo. Un `select` porta una stringa: tenere solo numeri e booleani
 *  farebbe sparire in silenzio proprio la scelta di pulizia del bordo. */
export const PATTERN_FIELD_KIND: Record<string, Field['kind']> =
  Object.fromEntries(PATTERN_FIELDS.map((f) => [f.name, f.kind]));

/** Come le zone diventano sequenza: gli unici parametri che non sono "pattern". */
export const ZONE_FIELDS: Field[] = [
  {
    kind: 'num', name: 'angleToleranceDeg', label: "Libertà d'angolo per zona", unit: '°', min: 0, step: 1, value: 20,
    help: '0 = tutte le zone di una tinta sullo stesso angolo (tre blocchi secchi); alzandola ogni zona segue la propria deformazione',
  },
  { kind: 'num', name: 'marginMm', label: 'Aria attorno alla zona', unit: 'mm', min: 0, step: 0.5, value: 2 },
  {
    kind: 'num', name: 'rowHeightMm', label: 'Altezza della riga', unit: 'mm', min: 0, step: 1, value: 0,
    help: 'la fascia entro cui le zone contano come "stessa riga"; 0 = la ricava dal disegno',
  },
  { kind: 'num', name: 'minAreaMm2', label: 'Ignora le zone sotto', unit: 'mm²', min: 0, step: 1, value: 0 },
  {
    kind: 'select', name: 'travelMode', label: 'Passaggi fra le zone', value: 'edges',
    options: [['edges', 'Impunture sui bordi dei rombi'], ['none', 'Nessuno (salto a filo alzato)']],
  },
  { kind: 'num', name: 'travelStitchMm', label: 'Punto dei passaggi', unit: 'mm', min: 0.5, step: 0.1, value: 3 },
  {
    kind: 'num', name: 'outerMarginMm', label: 'Margine sul bordo esterno', unit: 'mm', min: 0, step: 0.5, value: 0,
    help: 'il ricamo deborda di tanto oltre il perimetro del disegno; i bordi fra un rombo e l’altro non si toccano',
  },
  {
    kind: 'num', name: 'cleanupMinStitchMm', label: 'Pulizia punti', unit: 'mm', min: 0, step: 0.05, value: 0,
    help: 'toglie i punti più vicini di così, alla fine di tutto (passaggi compresi); 0 = non tocca niente',
  },
];

const patternGroup = (key: string, title: string, open: boolean): Group => ({
  title, collapsible: true, open,
  fields: PATTERN_FIELDS.map((f) => ({ ...f, name: `${key}.${f.name}` })),
});

export const CORPO: Group[] = [
  patternGroup('A', 'Pattern A — primo ago', true),
  patternGroup('B', 'Pattern B — secondo ago', false),
  { title: 'Zone e sequenza', collapsible: true, open: false, fields: ZONE_FIELDS },
];

/** Le stesse modalità di scala del Generatore pattern (è lo stesso importer). */
export const SCALE_MODES: [string, string][] = [
  ['illustrator-72dpi', 'Illustrator 72 dpi'],
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['viewbox-mm', 'ViewBox = mm'],
  ['custom-size', 'Dimensione reale custom'],
];

/** Cosa può fare una tinta del disegno. */
export const ROLE_OPTIONS: [string, string][] = [
  ['off', '— (non ricamare)'],
  ['A', 'Pattern A'],
  ['B', 'Pattern B'],
];

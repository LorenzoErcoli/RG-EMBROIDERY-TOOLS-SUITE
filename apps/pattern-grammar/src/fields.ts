// Schema del pannello parametri del Generatore pattern.
// Struttura canonica DS (patterns/workspace.md, Testa B "formato-guidata"):
//   TESTA sempre aperta → 01 Formato · 02 Sagoma · 03 Colori e ruoli (Sagoma+Colori li costruisce tool.ts).
//   CORPO in accordion → i gruppi di generazione qui sotto (il primo aperto, gli altri chiusi).
//   CODA in accordion → Preset (la costruisce tool.ts, chiusa).
// Etichette e unità decise con Lorenzo (REVISIONE-PARAMETRI.md); unità sempre nello slot, mai nel testo.
export type NumField = { kind: 'num'; name: string; label: string; unit?: string; min?: number; step: number; value: number; help?: string };
export type CheckField = { kind: 'check'; name: string; label: string; value: boolean };
export type SelectField = { kind: 'select'; name: string; label: string; options: [string, string][]; value: string };
export type Field = NumField | CheckField | SelectField;

export type Group = { title: string; collapsible?: boolean; open?: boolean; fields: Field[] };

/** Gruppo di testa: il Formato (misura del piano) apre il pannello — è la radice da cui il resto prende misura. */
export const FORMATO: Group = {
  title: 'Formato e scala', fields: [
    { kind: 'num', name: 'totalWidth', label: 'Larghezza totale', unit: 'mm', min: 10, step: 1, value: 120 },
    { kind: 'num', name: 'totalHeight', label: 'Altezza totale', unit: 'mm', min: 10, step: 1, value: 160 },
    { kind: 'num', name: 'parameterScalePercent', label: 'Ingrandisci tutti i parametri', unit: '%', min: 1, step: 1, value: 100, help: 'Non cambia la dimensione totale del piano.' },
  ],
};

/** Gruppi del corpo (generazione), in accordion. Il primo è aperto di default, gli altri chiusi. */
export const CORPO: Group[] = [
  {
    title: 'Zig-zag orizzontale', collapsible: true, open: true, fields: [
      { kind: 'num', name: 'horizontalZigzagWidth', label: 'Larghezza', unit: 'mm', min: 0.5, step: 0.1, value: 5.5 },
      { kind: 'num', name: 'horizontalZigzagHeight', label: 'Altezza', unit: 'mm', min: 0, step: 0.1, value: 4.3 },
      { kind: 'num', name: 'horizontalZigzagInterline', label: 'Interlinea filo', unit: 'mm', min: 0.05, step: 0.01, value: 0.25 },
      { kind: 'num', name: 'horizontalZigzagPassCount', label: 'Passaggi del filo', min: 0, step: 2, value: 0, help: 'conta ogni andata e ogni ritorno sul tratto: 2 = un’andata e un ritorno, 4 = due e due; a qualunque altezza, anche 0, e l’interlinea non conta. 0 = dall’interlinea' },
      { kind: 'num', name: 'horizontalZigzagOffsetX', label: 'Spostamento dal centro', unit: 'mm', step: 0.1, value: 0 },
      { kind: 'num', name: 'horizontalZigzagSpacing', label: 'Distanza tra gli zig-zag', unit: 'mm', min: 1, step: 0.1, value: 12 },
    ],
  },
  {
    title: 'Zig-zag verticale', collapsible: true, open: false, fields: [
      { kind: 'num', name: 'verticalZigzagWidth', label: 'Larghezza', unit: 'mm', min: 0.1, step: 0.1, value: 1.2 },
      { kind: 'num', name: 'verticalZigzagInterline', label: 'Interlinea filo', unit: 'mm', min: 0.05, step: 0.01, value: 0.25 },
      { kind: 'num', name: 'verticalConnectorDiagonalOffsetY', label: 'Inclinazione del raccordo', unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'num', name: 'stepX', label: 'Distanza tra le colonne', unit: 'mm', min: 0.5, step: 0.1, value: 5.2 },
      { kind: 'num', name: 'offsetY', label: 'Sfasamento tra colonne', unit: 'mm', min: 0, step: 0.1, value: 6 },
    ],
  },
  {
    title: 'Deformazioni creative', collapsible: true, open: false, fields: [
      { kind: 'num', name: 'horizontalAngleDeg', label: 'Inclinazione dello zig-zag orizzontale', unit: '°', step: 1, value: 0 },
      { kind: 'num', name: 'columnWaveAmplitude', label: "Ampiezza dell'onda", unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'num', name: 'columnWaveLengthMm', label: "Lunghezza d'onda", unit: 'mm', min: 1, step: 1, value: 60, help: 'ogni quanti mm si ripete l’onda' },
      { kind: 'num', name: 'columnWavePhaseDeg', label: 'Fase', unit: '°', step: 5, value: 0 },
      { kind: 'check', name: 'alternateHorizontalAngle', label: "Inverti l'inclinazione a colonne alterne", value: false },
    ],
  },
  {
    // Le misure che cambiano da sinistra a destra (Lorenzo, 2026-10-06: la pelle squamata col punto nastro).
    // Tutto a 100 e il resto a 0 = il pattern di sempre, identico.
    title: 'Variazioni nell’area', collapsible: true, open: false, fields: [
      { kind: 'num', name: 'variationSidesPercent', label: 'Misura ai lati', unit: '%', min: 10, step: 5, value: 100, help: 'tratto, distanza fra le colonne e fra i tratti ai bordi destro e sinistro; 100 = come il pattern' },
      { kind: 'num', name: 'variationCenterPercent', label: 'Misura al centro', unit: '%', min: 10, step: 5, value: 100, help: 'lo stesso al centro; in mezzo la misura sfuma da sola, senza stacchi' },
      { kind: 'num', name: 'variationIrregularityPercent', label: 'Irregolarità', unit: '%', min: 0, step: 10, value: 0, help: 'le colonne ondeggiano e le distanze respirano, in modo morbido, in tutte le direzioni; 0 = niente' },
      { kind: 'num', name: 'strokeAngleJitterDeg', label: 'Inclinazione variabile del tratto', unit: '°', min: 0, step: 0.5, value: 0, help: 'di quanto al massimo il tratto orizzontale si inclina, a zone; 0 = sempre dritto' },
      { kind: 'num', name: 'variationPassCountSides', label: 'Passaggi del filo ai lati', min: 0, step: 2, value: 0, help: 'come «Passaggi del filo» dello zig-zag orizzontale, ma solo ai lati; 0 = come il pattern' },
      { kind: 'num', name: 'variationPassCountCenter', label: 'Passaggi del filo al centro', min: 0, step: 2, value: 0, help: 'lo stesso al centro; in mezzo c’è una fascia in cui ogni tratto ne ha a volte di più a volte di meno, sempre più vicino al centro' },
      { kind: 'num', name: 'variationSeed', label: 'Variante', min: 1, step: 1, value: 1, help: 'un altro numero dà un’altra disposizione con gli stessi valori' },
    ],
  },
  {
    title: 'Percorso e confine', collapsible: true, open: false, fields: [
      { kind: 'check', name: 'repeatBack', label: 'Andata e ritorno (serpentina)', value: false },
      { kind: 'num', name: 'minStitchMm', label: 'Punto minimo', unit: 'mm', min: 0, step: 0.01, value: 0 },
      { kind: 'num', name: 'maxStitchMm', label: 'Lunghezza massima del punto', unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'num', name: 'constructionStroke', label: 'Spessore di costruzione', unit: 'mm', min: 0.05, step: 0.05, value: 0.3, help: 'regola rientri, margini e raccordi — non è il filo disegnato' },
      { kind: 'select', name: 'boundaryCleanupMode', label: 'Punti fuori dal contorno', value: 'adjust-then-delete', options: [['adjust-then-delete', 'Avvicina al bordo, poi elimina'], ['delete', 'Elimina']] },
      { kind: 'num', name: 'maxBoundaryAdjustment', label: 'Spostamento massimo verso il bordo', unit: 'mm', min: 0, step: 0.01, value: 0 },
      { kind: 'num', name: 'reliefPercent', label: 'Scarico nelle aree', unit: '%', min: 0, step: 5, value: 50, help: 'dentro le tinte marcate «Area di scarico» i zig-zag verticali e orizzontali hanno meno passate: 50 = metà; 0 = niente' },
      { kind: 'num', name: 'voidStitchMm', label: 'Impuntura nelle aree vuote', unit: 'mm', min: 0, step: 0.5, value: 0, help: 'dentro le tinte marcate «Area vuota» il pattern diventa un’impuntura dritta con questo punto, e riprende fuori; 0 = dentro non si cuce' },
      { kind: 'select', name: 'exportCompatibilityMode', label: 'Compatibilità export', value: 'illustrator-safe', options: [['normal', 'Normale'], ['illustrator-safe', 'Sicuro per Illustrator']] },
      { kind: 'select', name: 'shapeType', label: 'Sagoma di ritaglio', value: 'none', options: [['none', 'Nessuna'], ['rectangle', 'Rettangolo'], ['circle', 'Cerchio'], ['diamond', 'Rombo'], ['imported', 'Importata DXF/SVG']] },
    ],
  },
];

/** Tutti i campi che definiscono la config iniziale (testa Formato + corpo). Sagoma/Colori non hanno campi di config qui. */
export const ALL_FIELD_GROUPS: Group[] = [FORMATO, ...CORPO];

/** Opzioni della scala d'import del contorno (fuori da PatternConfig: sono opzioni dell'importer). */
export const SCALE_MODES: [string, string][] = [
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['illustrator-72dpi', 'Forza Illustrator 72 dpi'],
  ['viewbox-mm', 'ViewBox = mm'],
  ['custom-size', 'Dimensione reale custom'],
];

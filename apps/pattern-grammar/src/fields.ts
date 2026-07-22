// Schema del pannello parametri — riproduce fedelmente la UI originale di pattern-grammar-engine
// (6 gruppi, 25 controlli, stessi nomi/etichette/valori). Reso coi componenti del DS.
export type NumField = { kind: 'num'; name: string; label: string; unit?: string; min?: number; step: number; value: number; help?: string };
export type CheckField = { kind: 'check'; name: string; label: string; value: boolean };
export type SelectField = { kind: 'select'; name: string; label: string; options: [string, string][]; value: string };
export type Field = NumField | CheckField | SelectField;

export type Group = { id: string; title: string; collapsible?: boolean; open?: boolean; fields: Field[] };

export const GROUPS: Group[] = [
  {
    id: '01', title: 'Formato e scala', fields: [
      { kind: 'num', name: 'totalWidth', label: 'Larghezza pannello', unit: 'mm', min: 10, step: 1, value: 120 },
      { kind: 'num', name: 'totalHeight', label: 'Altezza pannello', unit: 'mm', min: 10, step: 1, value: 160 },
      { kind: 'num', name: 'parameterScalePercent', label: 'Ingrandimento parametri', unit: '%', min: 1, step: 1, value: 100, help: 'Non modifica la dimensione totale del pannello.' },
    ],
  },
  {
    id: '02', title: 'Zig-zag orizzontale', fields: [
      { kind: 'num', name: 'horizontalZigzagWidth', label: 'Larghezza', unit: 'mm', min: 0.5, step: 0.1, value: 5.5 },
      { kind: 'num', name: 'horizontalZigzagHeight', label: 'Altezza esatta', unit: 'mm', min: 0.1, step: 0.1, value: 4.3 },
      { kind: 'num', name: 'horizontalZigzagInterline', label: 'Interlinea fili', unit: 'mm', min: 0.05, step: 0.01, value: 0.25 },
      { kind: 'num', name: 'horizontalZigzagOffsetX', label: 'Offset X a sinistra', unit: 'mm', step: 0.1, value: 0 },
      { kind: 'num', name: 'horizontalZigzagSpacing', label: 'Distanza centro-centro', unit: 'mm', min: 1, step: 0.1, value: 12 },
    ],
  },
  {
    id: '03', title: 'Zig-zag verticale', fields: [
      { kind: 'num', name: 'verticalZigzagWidth', label: 'Larghezza', unit: 'mm', min: 0.1, step: 0.1, value: 1.2 },
      { kind: 'num', name: 'verticalZigzagInterline', label: 'Interlinea fili', unit: 'mm', min: 0.05, step: 0.01, value: 0.25 },
      { kind: 'num', name: 'verticalConnectorDiagonalOffsetY', label: 'Diagonale connector', unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'num', name: 'stepX', label: 'Distanza colonne', unit: 'mm', min: 0.5, step: 0.1, value: 5.2 },
      { kind: 'num', name: 'offsetY', label: 'Sfasamento Y', unit: 'mm', min: 0, step: 0.1, value: 6 },
      { kind: 'num', name: 'strokeWidth', label: 'Spessore tratto', unit: 'mm', min: 0.05, step: 0.05, value: 0.1 },
    ],
  },
  {
    id: '04', title: 'Deformazioni creative', collapsible: true, open: false, fields: [
      { kind: 'num', name: 'horizontalAngleDeg', label: 'Angolo orizzontale', unit: 'deg', step: 1, value: 0 },
      { kind: 'num', name: 'columnWaveAmplitude', label: 'Ampiezza onda', unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'num', name: 'columnWaveFrequency', label: 'Frequenza onda', unit: 'rad/mm', min: 0, step: 0.01, value: 0.1 },
      { kind: 'num', name: 'columnWavePhase', label: 'Fase onda', unit: 'rad', step: 0.1, value: 0 },
      { kind: 'check', name: 'alternateHorizontalAngle', label: 'Alterna angolo per colonna', value: false },
    ],
  },
  {
    id: '05', title: 'Percorso e confine', collapsible: true, open: true, fields: [
      { kind: 'check', name: 'repeatBack', label: 'Repeat back / boustrophedon', value: false },
      { kind: 'num', name: 'minPointDistance', label: 'Distanza minima punti', unit: 'mm', min: 0, step: 0.01, value: 0 },
      { kind: 'num', name: 'maxStitchLength', label: 'Puntella segmenti', unit: 'mm', min: 0, step: 0.1, value: 0 },
      { kind: 'select', name: 'boundaryCleanupMode', label: 'Cleanup bordo', value: 'adjust-then-delete', options: [['adjust-then-delete', 'Aggiusta poi elimina'], ['delete', 'Elimina']] },
      { kind: 'num', name: 'maxBoundaryAdjustment', label: 'Aggiustamento bordo', unit: 'mm', min: 0, step: 0.01, value: 0 },
      { kind: 'select', name: 'exportCompatibilityMode', label: 'Compatibilità export', value: 'illustrator-safe', options: [['normal', 'Normal'], ['illustrator-safe', 'Illustrator safe']] },
      { kind: 'select', name: 'shapeType', label: 'Forma', value: 'none', options: [['none', 'Nessuna'], ['rectangle', 'Rettangolo'], ['circle', 'Cerchio'], ['diamond', 'Rombo'], ['imported', 'Importata DXF/SVG']] },
    ],
  },
];

/** Opzioni della scala d'import del contorno (fuori da PatternConfig: sono opzioni dell'importer). */
export const SCALE_MODES: [string, string][] = [
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['illustrator-72dpi', 'Forza Illustrator 72 dpi'],
  ['viewbox-mm', 'ViewBox = mm'],
  ['custom-size', 'Dimensione reale custom'],
];

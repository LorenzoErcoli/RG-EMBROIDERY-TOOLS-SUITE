import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Il Generatore pattern salva in `params` la config del pannello (apps/pattern-grammar/src/fields.ts).
// Non sono parametri e restano fuori: importedBoundary (sagoma importata), sourceAnalysis (analisi), reliefAreas (anelli
// delle aree di scarico) e `drawing` (il disegno caricato, con scala d'import e ruoli dei colori).
const P: DichiarazioneParametro[] = [
  // --- Formato e scala ---
  { id: 'totalWidth', etichetta: 'Larghezza totale', aiuto: 'Larghezza del piano del pattern.', tipo: 'num', unita: 'mm', min: 10, passo: 1, predefinito: 120, concetto: 'formato' },
  { id: 'totalHeight', etichetta: 'Altezza totale', aiuto: 'Altezza del piano del pattern.', tipo: 'num', unita: 'mm', min: 10, passo: 1, predefinito: 160, concetto: 'formato' },
  { id: 'parameterScalePercent', etichetta: 'Ingrandisci tutti i parametri', aiuto: 'Non cambia la dimensione totale del piano.', tipo: 'num', unita: '%', min: 1, passo: 1, predefinito: 100, concetto: 'scala' },

  // --- Zig-zag orizzontale ---
  { id: 'horizontalZigzagWidth', etichetta: 'Zig-zag orizzontale: larghezza', aiuto: 'Larghezza di un modulo di zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 5.5, concetto: 'modulo' },
  { id: 'horizontalZigzagHeight', etichetta: 'Zig-zag orizzontale: altezza', aiuto: 'Altezza di un modulo di zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 4.3, concetto: 'modulo' },
  { id: 'horizontalZigzagInterline', etichetta: 'Zig-zag orizzontale: interlinea filo', aiuto: 'Distanza fra due passate adiacenti del filo del zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.01, predefinito: 0.25, concetto: 'interlinea', regole: ['R30'] },
  { id: 'horizontalZigzagPassCount', etichetta: 'Zig-zag orizzontale: passaggi del filo', aiuto: 'Conta ogni andata e ogni ritorno sul tratto: 2 = un’andata e un ritorno, 4 = due e due; a qualunque altezza, anche 0, e l’interlinea non conta. 0 = dall’interlinea', tipo: 'int', unita: '', min: 0, passo: 2, predefinito: 0, concetto: 'interlinea' },
  { id: 'horizontalZigzagOffsetX', etichetta: 'Spostamento dal centro', aiuto: 'Sposta a sinistra l’origine del zig-zag orizzontale rispetto alla sua colonna.', tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 0, concetto: 'spostamento' },
  { id: 'horizontalZigzagSpacing', etichetta: 'Distanza tra gli zig-zag', aiuto: 'Distanza, centro a centro, fra zig-zag orizzontali consecutivi.', tipo: 'num', unita: 'mm', min: 1, passo: 0.1, predefinito: 12, concetto: 'modulo' },

  // --- Zig-zag verticale ---
  { id: 'verticalZigzagWidth', etichetta: 'Zig-zag verticale: larghezza', aiuto: 'Larghezza dello zig-zag verticale.', tipo: 'num', unita: 'mm', min: 0.1, passo: 0.1, predefinito: 1.2, concetto: 'modulo' },
  { id: 'verticalZigzagInterline', etichetta: 'Zig-zag verticale: interlinea filo', aiuto: 'Distanza fra due passate adiacenti del filo del zig-zag verticale.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.01, predefinito: 0.25, concetto: 'interlinea', regole: ['R30'] },
  { id: 'verticalConnectorDiagonalOffsetY', etichetta: 'Inclinazione del raccordo', aiuto: 'Rende diagonale il raccordo fra due blocchi verticali consecutivi.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'modulo' },
  { id: 'stepX', etichetta: 'Distanza tra le colonne', aiuto: 'Distanza fra le colonne del pattern.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 5.2, concetto: 'modulo' },
  { id: 'offsetY', etichetta: 'Sfasamento tra colonne', aiuto: 'Di quanto è sfasata in verticale una colonna rispetto alla vicina.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 6, concetto: 'spostamento' },

  // --- Deformazioni creative ---
  { id: 'horizontalAngleDeg', etichetta: 'Inclinazione dello zig-zag orizzontale', aiuto: 'Inclina lo zig-zag orizzontale.', tipo: 'num', unita: 'deg', passo: 1, predefinito: 0, concetto: 'angolo' },
  { id: 'columnWaveAmplitude', etichetta: 'Ampiezza dell’onda', aiuto: 'Ampiezza dell’onda con cui ondeggiano le colonne.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'modulo' },
  { id: 'columnWaveLength', nome: 'columnWaveLengthMm', etichetta: 'Lunghezza d’onda', aiuto: 'Ogni quanti mm si ripete l’onda.', tipo: 'num', unita: 'mm', min: 1, passo: 1, predefinito: 60, concetto: 'modulo' },
  { id: 'columnWavePhase', nome: 'columnWavePhaseDeg', etichetta: 'Fase', aiuto: 'Fase dell’onda delle colonne.', tipo: 'num', unita: 'deg', passo: 5, predefinito: 0, concetto: 'angolo' },
  { id: 'alternateHorizontalAngle', etichetta: 'Inverti l’inclinazione a colonne alterne', aiuto: 'Inverte il verso dell’inclinazione dello zig-zag orizzontale una colonna sì e una no.', tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore' },

  // --- Variazioni nell'area ---
  { id: 'variationSidesPercent', etichetta: 'Misura ai lati', aiuto: 'Tratto, distanza fra le colonne e fra i tratti ai bordi destro e sinistro; 100 = come il pattern.', tipo: 'num', unita: '%', min: 10, passo: 5, predefinito: 100, concetto: 'scala' },
  { id: 'variationCenterPercent', etichetta: 'Misura al centro', aiuto: 'Lo stesso al centro; in mezzo la misura sfuma da sola, senza stacchi.', tipo: 'num', unita: '%', min: 10, passo: 5, predefinito: 100, concetto: 'scala' },
  { id: 'variationIrregularityPercent', etichetta: 'Irregolarità', aiuto: 'Le colonne ondeggiano e le distanze respirano, in modo morbido, in tutte le direzioni; 0 = niente.', tipo: 'num', unita: '%', min: 0, passo: 10, predefinito: 0, concetto: 'variazione' },
  { id: 'strokeAngleJitterDeg', etichetta: 'Inclinazione variabile del tratto', aiuto: 'Di quanto al massimo il tratto orizzontale si inclina, a zone; 0 = sempre dritto.', tipo: 'num', unita: 'deg', min: 0, passo: 0.5, predefinito: 0, concetto:  'variazione' },
  { id: 'variationPassCountSides', etichetta: 'Passaggi del filo ai lati', aiuto: 'Come «Passaggi del filo» dello zig-zag orizzontale, ma solo ai lati; 0 = come il pattern.', tipo: 'int', unita: '', min: 0, passo: 2, predefinito: 0, concetto: 'interlinea' },
  { id: 'variationPassCountCenter', etichetta: 'Passaggi del filo al centro', aiuto: 'Lo stesso al centro; in mezzo c’è una fascia in cui ogni tratto ne ha a volte di più a volte di meno, sempre più vicino al centro.', tipo: 'int', unita: '', min: 0, passo: 2, predefinito: 0, concetto: 'interlinea' },
  { id: 'variationSeed', etichetta: 'Variante', aiuto: 'Un altro numero dà un’altra disposizione con gli stessi valori.', tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 1, concetto: 'seme' },

  // --- Percorso e confine ---
  { id: 'repeatBack', etichetta: 'Andata e ritorno (serpentina)', aiuto: 'Percorre le colonne a serpentina, in andata e ritorno, senza cambiare le coordinate del modulo.', tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura' },
  { id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Lunghezza minima del punto.', tipo: 'num', unita: 'mm', min: 0, passo: 0.01, predefinito: 0, concetto: 'punto-minimo', regole: ['R3'] },
  { id: 'maxStitch', nome: 'maxStitchMm', etichetta: 'Lunghezza massima del punto', aiuto: 'Oltre questa lunghezza il punto si suddivide in punti uguali; 0 = non suddivide.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'punto-massimo', regole: ['R4'] },
  { id: 'constructionStroke', etichetta: 'Spessore di costruzione', aiuto: 'Regola rientri, margini e raccordi — non è il filo disegnato.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.05, predefinito: 0.3, concetto: 'altro' },
  { id: 'boundaryCleanupMode', etichetta: 'Punti fuori dal contorno', aiuto: 'Cosa fare dei punti che cadono fuori dal contorno.', tipo: 'enum', unita: '', opzioni: ['adjust-then-delete', 'delete'], predefinito: 'adjust-then-delete', concetto: 'tolleranza' },
  { id: 'maxBoundaryAdjustment', etichetta: 'Spostamento massimo verso il bordo', aiuto: 'Di quanto al massimo un punto fuori dal contorno viene avvicinato al bordo prima di eliminarlo.', tipo: 'num', unita: 'mm', min: 0, passo: 0.01, predefinito: 0, concetto: 'tolleranza' },
  { id: 'reliefPercent', etichetta: 'Scarico nelle aree', aiuto: 'Dentro le tinte marcate «Area di scarico» i zig-zag verticali e orizzontali hanno meno passate: 50 = metà; 0 = niente.', tipo: 'num', unita: '%', min: 0, passo: 5, predefinito: 50, concetto: 'aree-di-scarico' },
  { id: 'voidStitchMm', etichetta: 'Impuntura nelle aree vuote', aiuto: 'Dentro le tinte marcate «Area vuota» il pattern diventa un’impuntura dritta con questo punto, e riprende fuori; 0 = dentro non si cuce.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 0, concetto: 'aree-vuote', regole: ['R5'] },
  { id: 'exportCompatibilityMode', etichetta: 'Compatibilità export', aiuto: 'Come si scrive il file esportato: normale o sicuro per Illustrator.', tipo: 'enum', unita: '', opzioni: ['normal', 'illustrator-safe'], predefinito: 'illustrator-safe', concetto: 'altro' },
  { id: 'shapeType', etichetta: 'Sagoma di ritaglio', aiuto: 'La sagoma che ritaglia il pattern: nessuna, rettangolo, cerchio, rombo o il contorno importato da DXF/SVG.', tipo: 'enum', unita: '', opzioni: ['none', 'rectangle', 'circle', 'diamond', 'imported'], predefinito: 'none', concetto: 'altro' },
];

export const scheda: SchedaParametri = { parametri: P };

import type { SchedaParametri } from '../tipi';

// Rete 45° (apps/net-45). Salva in `params` (metadata rgProject 'net-45') l'oggetto NetParams di @rg/core.
// Etichette dal pannello di apps/net-45/src/tool.ts; i valori «sì/no» sono salvati come 1/0.
export const scheda: SchedaParametri = {
  parametri: [
    { id: 'squareSize', nome: 'squareSizeMm', etichetta: 'Lato del quadrato', aiuto: 'Lato del quadrato della rete («larghezza rete»).', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 0.5, predefinito: 11, concetto: 'modulo' },
    { id: 'angleA', nome: 'angleADeg', etichetta: 'Angolo diagonali principali', aiuto: 'Angolo della prima famiglia di diagonali della rete.', senzaAiuto: true, tipo: 'num', unita: 'deg', passo: 1, predefinito: 45, concetto: 'angolo' },
    { id: 'angleB', nome: 'angleBDeg', etichetta: 'Angolo diagonali secondarie', aiuto: 'Angolo della seconda famiglia di diagonali della rete.', senzaAiuto: true, tipo: 'num', unita: 'deg', passo: 1, predefinito: -45, concetto: 'angolo' },
    { id: 'netInset', nome: 'netInsetMm', etichetta: 'Rientro della rete dal bordo', aiuto: 'Inizio e fine della rete: rientro dal perimetro.', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 0.5, predefinito: 0, concetto: 'rientro' },
    { id: 'netOffsetX', nome: 'netOffsetXMm', etichetta: 'Sposta rete — orizzontale', aiuto: 'Spostamento orizzontale della griglia rispetto al disegno importato.', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 1, predefinito: 0, concetto: 'spostamento' },
    { id: 'netOffsetY', nome: 'netOffsetYMm', etichetta: 'Sposta rete — verticale', aiuto: 'Spostamento verticale della griglia rispetto al disegno importato.', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 1, predefinito: 0, concetto: 'spostamento' },
    { id: 'satinBand', nome: 'rasoBandMm', etichetta: 'Spessore della fascia di raso', aiuto: 'Spessore della fascia di bordo dove le celle diventano raso (0 = nessuna).', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 1, predefinito: 8, concetto: 'rientro' },
    { id: 'satinDownwardOnly', nome: 'rasoDownwardOnly', etichetta: 'Raso solo sui bordi bassi e laterali', aiuto: 'Il raso solo sui bordi rivolti in basso e ai lati, non in alto; spento = tutti i bordi. Salvato come 1/0.', senzaAiuto: true, tipo: 'int', unita: '', min: 0, max: 1, passo: 1, predefinito: 1, concetto: 'interruttore' },
    { id: 'cordWidth', nome: 'cordWidthMm', etichetta: 'Larghezza del cordoncino', aiuto: 'Larghezza del cordoncino della rete.', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 1.8, concetto: 'larghezza-punto' },
    { id: 'cordInterline', nome: 'cordInterlineMm', etichetta: 'Interlinea del cordoncino', aiuto: 'distanza tra un punto e il successivo lungo il filo', tipo: 'num', unita: 'mm', passo: 0.05, predefinito: 0.4, regole: ['R30'], concetto: 'interlinea' },
    { id: 'travelStitch', nome: 'travelStitchMm', etichetta: 'Lunghezza del punto nei passaggi', aiuto: 'Lunghezza dei punti dei passaggi (travel).', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 0.5, predefinito: 3, concetto: 'punto-passaggio' },
    { id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Lunghezza minima di un punto.', senzaAiuto: true, tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 1, regole: ['R3'], concetto: 'punto-minimo' },
    { id: 'realWidth', nome: 'realWidthMm', etichetta: 'Larghezza reale (0 = auto)', aiuto: '0 = usa la misura letta dal file.', tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, regole: ['R11'], concetto: 'misura-reale' },
  ],
};

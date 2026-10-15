import type { SchedaParametri } from '../tipi';

// Rete testa speciale: i parametri sono `params` = PARAMETRI_RETE (apps/rete-testa-speciale/src/motore.ts).
// Non registrati perché dati e non parametri: `ruoli` (colore → contorno / area vuota) e il disegno.
// Etichette e aiuti come nel pannello (CAMPI in apps/rete-testa-speciale/src/tool.ts).
export const scheda: SchedaParametri = {
  parametri: [
    {
      id: 'diamondWidth', nome: 'diamondWidthMm', etichetta: 'Larghezza del rombo',
      aiuto: 'Da punta a punta di una colonna, misurata sulla linea vera.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 12, concetto: 'modulo',
    },
    {
      id: 'diamondHeight', nome: 'diamondHeightMm', etichetta: 'Altezza del rombo',
      aiuto: 'Da una rientranza alla successiva, lungo la colonna.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 16, concetto: 'modulo',
    },
    {
      id: 'serpentineAngle', nome: 'angleDeg', etichetta: 'Direzione della serpentina',
      aiuto: '0 = scende in verticale, 90 = corre in orizzontale.',
      tipo: 'num', unita: 'deg', min: -90, max: 90, passo: 1, predefinito: 0, concetto: 'angolo',
    },
    {
      id: 'crossingOverlap', nome: 'overlapMm', etichetta: 'Sovrapposizione',
      aiuto: 'Una sola misura per ogni incrocio: discesa e risalita alla rientranza, e le punte di due colonne vicine. 0 = si toccano, negativo = resta una luce.',
      tipo: 'num', unita: 'mm', min: -6, max: 10, passo: 0.25, predefinito: 2, concetto: 'sovrapposizione',
    },
    {
      id: 'staggerColumns', etichetta: 'Colonne sfalsate di mezzo rombo',
      aiuto: 'Le colonne vicine spostate di mezzo rombo lungo la serpentina.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'modulo',
    },
    {
      id: 'cornerRounding', etichetta: 'Arrotondamento degli angoli',
      aiuto: '0 = spigolo vivo. Vale per punte e rientranze; larghezza e sovrapposizione restano misurate sulla curva vera.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 0, concetto: 'modulo',
    },
    {
      id: 'maxStitch', nome: 'maxStitchMm', etichetta: 'Lunghezza del punto',
      aiuto: 'Ogni tratto fra due punti fissi (punte, apici, incroci) si divide in punti uguali, non più lunghi di così.',
      tipo: 'num', unita: 'mm', min: 0.5, max: 12, passo: 0.1, predefinito: 2.5, regole: ['R4'], concetto: 'punto-massimo',
    },
    {
      id: 'overlapStitch', nome: 'overlapStitchMm', etichetta: 'Punto nelle sovrapposizioni, linea sopra',
      aiuto: 'La linea che passa dopo, e nella lente sta sopra.',
      tipo: 'num', unita: 'mm', min: 0.3, max: 12, passo: 0.1, predefinito: 1.2, concetto: 'punto-massimo',
    },
    {
      id: 'underOverlapStitch', nome: 'underOverlapStitchMm', etichetta: 'Punto nelle sovrapposizioni, linea sotto',
      aiuto: 'La linea cucita prima, che nella lente sta sotto. 0 = la lunghezza del punto.',
      tipo: 'num', unita: 'mm', min: 0, max: 12, passo: 0.1, predefinito: 0, concetto: 'punto-massimo',
    },
    {
      id: 'overlapZone', nome: 'overlapZoneMm', etichetta: 'Ampiezza della zona di sovrapposizione',
      aiuto: '0 = la zona va esattamente da un punto d’incrocio all’altro. Positivo la allarga oltre gli incroci, negativo la stringe; con le linee che si toccano soltanto è l’ampiezza attorno al contatto.',
      tipo: 'num', unita: 'mm', min: -3, max: 3, passo: 0.1, predefinito: 0, concetto: 'sovrapposizione',
    },
    {
      id: 'constructionStroke', etichetta: 'Spessore del filo',
      aiuto: 'Sul contorno le passate non si sovrappongono: dove c’è già filo la nuova passa accanto, verso l’interno, a questa distanza.',
      tipo: 'num', unita: 'mm', min: 0.1, max: 3, passo: 0.1, predefinito: 1, concetto: 'altro',
    },
    {
      id: 'voidMode', etichetta: 'All’area vuota la rete',
      aiuto: 'ritorno = la serpentina torna indietro e la parte mancante si cuce dopo; bordo = gira sul contorno del vuoto; centro = lo attraversa con un’impuntura dritta.',
      tipo: 'enum', unita: '', opzioni: ['ritorno', 'bordo', 'centro'], predefinito: 'ritorno', regole: ['R5'], concetto: 'aree-vuote',
    },
    {
      id: 'voidStitchMm', etichetta: 'Punto dell’impuntura nel vuoto',
      aiuto: 'Il punto della linea che gira sul bordo del vuoto o lo attraversa dritta.',
      tipo: 'num', unita: 'mm', min: 0.5, max: 12, passo: 0.1, predefinito: 2, regole: ['R5'], concetto: 'aree-vuote',
    },
    {
      id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo',
      aiuto: 'Si impone alla fine, dopo l’ordine di cucitura; un punto che si allunga oltre la lunghezza del punto si ridivide.',
      tipo: 'num', unita: 'mm', min: 0, max: 3, passo: 0.1, predefinito: 0.5, regole: ['R3'], concetto: 'punto-minimo',
    },
  ],
};

import type { SchedaParametri } from '../tipi';

// Rete testa speciale: i parametri sono `params` = PARAMETRI_RETE (apps/rete-testa-speciale/src/motore.ts).
// Non registrati perché dati e non parametri: `ruoli` (colore → contorno / area vuota) e il disegno.
// Etichette e aiuti come nel pannello (CAMPI in apps/rete-testa-speciale/src/tool.ts).
export const scheda: SchedaParametri = {
  parametri: [
    {
      id: 'netShape', etichetta: 'La rete',
      aiuto: 'colonne = la rete a colonne su un pezzo; radiale = un disco di rombi coi lati uguali che, tolto dal telaio, diventa una sacca.',
      tipo: 'enum', unita: '', opzioni: ['colonne', 'radiale'], predefinito: 'colonne', concetto: 'modulo',
    },
    {
      id: 'radialCount', etichetta: 'Rombi per giro', aiuto: 'Sacca: quanti rombi in ogni anello del disco.',
      tipo: 'int', unita: '', min: 3, max: 200, passo: 1, predefinito: 48, concetto: 'modulo',
    },
    {
      id: 'radialSide', nome: 'radialSideMm', etichetta: 'Lato del rombo',
      aiuto: 'Sacca: tutti i lati uguali, è quello che fa diventare il disco una sacca.',
      tipo: 'num', unita: 'mm', min: 2, max: 100, passo: 0.5, predefinito: 15, concetto: 'modulo',
    },
    {
      id: 'bottomShape', etichetta: 'Il fondo',
      aiuto: 'Sacca: tondo o ovale. Ovale: la rete diventa ovale; sulle teste la fascia è più corta che sui lati lunghi, e chiusa col cordone la sacca fa pancia sui lati lunghi e tiene tese le teste.',
      tipo: 'enum', unita: '', opzioni: ['tondo', 'ovale'], predefinito: 'tondo', concetto: 'formato',
    },
    {
      id: 'bottomLength', nome: 'bottomLengthMm', etichetta: 'Lunghezza del fondo',
      aiuto: 'Sacca, fondo ovale: da testa a testa.',
      tipo: 'num', unita: 'mm', min: 20, max: 440, passo: 5, predefinito: 260, concetto: 'formato',
    },
    {
      id: 'bottomWidth', nome: 'bottomWidthMm', etichetta: 'Larghezza del fondo',
      aiuto: 'Sacca, fondo ovale: da lato lungo a lato lungo.',
      tipo: 'num', unita: 'mm', min: 10, max: 440, passo: 5, predefinito: 140, concetto: 'formato',
    },
    {
      id: 'bottomRoundEnds', etichetta: 'Teste a mezzo cerchio',
      aiuto: 'Sacca, fondo ovale: 0 = ovale; 100 = due mezzi cerchi uniti da tratti dritti; in mezzo, teste più tonde e lati più dritti.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 0, concetto: 'formato',
    },
    {
      id: 'sideBand', nome: 'sideBandMm', etichetta: 'Fascia sui lati lunghi',
      aiuto: 'Sacca, fondo ovale: 0 = tutta la rete. Più corta: le colonne dei lati lunghi si fermano prima, le teste no (a scatti di due anelli: la più vicina); chiusa col cordone, i lati restano tesi e le teste fanno pancia.',
      tipo: 'num', unita: 'mm', min: 0, max: 300, passo: 5, predefinito: 0, concetto: 'formato',
    },
    {
      id: 'bottomRadius', nome: 'bottomRadiusMm', etichetta: 'Raggio del fondo',
      aiuto: 'Sacca: dove finisce la rete e comincia la spirale. Più è grande, più la sacca è larga e bassa.',
      tipo: 'num', unita: 'mm', min: 5, max: 300, passo: 1, predefinito: 100, concetto: 'formato',
    },
    {
      id: 'maxDiamondAngle', nome: 'maxAngleDeg', etichetta: 'Angolo massimo dei rombi in fuori',
      aiuto: 'Sacca: a 180° il rombo è piatto, il limite teorico del disco.',
      tipo: 'num', unita: 'deg', min: 60, max: 179, passo: 1, predefinito: 165, concetto: 'angolo',
    },
    {
      id: 'machineField', nome: 'fieldMm', etichetta: 'Campo macchina (lato)',
      aiuto: 'Sacca: il disco ci deve stare, ed è centrato nel campo.',
      tipo: 'num', unita: 'mm', min: 50, max: 1000, passo: 10, predefinito: 450, concetto: 'formato',
    },
    {
      id: 'spiralPitch', nome: 'spiralPitchMm', etichetta: 'Passo della spirale del fondo',
      aiuto: 'Sacca: uguale allo spessore del filo = giri affiancati, fondo pieno; più largo = fondo rado, meno filo.',
      tipo: 'num', unita: 'mm', min: 0.3, max: 30, passo: 0.1, predefinito: 5, concetto: 'densita',
    },
    {
      id: 'tieSpacing', nome: 'tieSpacingMm', etichetta: 'Distanza fra le legature del fondo',
      aiuto: 'Sacca: le legature entrano nel fondo e lo tengono insieme; dove sarebbero più fitte di così, metà si ferma.',
      tipo: 'num', unita: 'mm', min: 2, max: 100, passo: 1, predefinito: 10, concetto: 'densita',
    },
    {
      id: 'rimPass', etichetta: 'Un giro d’impuntura in cima, sulle punte esterne',
      aiuto: 'Sacca: lega le punte dell’ultimo anello; non tiene aperta la bocca (il filo si arriccia, non si allunga).',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'overlapRule', etichetta: 'Uguale in tutta la rete',
      aiuto: 'Sacca: l’incrocio cambia angolo da un anello all’altro. spostamento = la sovrapposizione scritta ovunque; lente = la lente di quella in cima; aggancio = la punta passa oltre l’altra linea della stessa misura ovunque (quella del rombo quadrato).',
      tipo: 'enum', unita: '', opzioni: ['spostamento', 'lente', 'aggancio'], predefinito: 'spostamento', concetto: 'sovrapposizione',
    },
    {
      id: 'pieceSource', etichetta: 'Il pezzo',
      aiuto: 'cartamodello = il contorno del disegno caricato, coi suoi vuoti; misure = un rettangolo di larghezza × altezza, senza vuoti.',
      tipo: 'enum', unita: '', opzioni: ['cartamodello', 'misure'], predefinito: 'cartamodello', concetto: 'formato',
    },
    {
      id: 'totalWidth', etichetta: 'Larghezza del pezzo',
      aiuto: 'La larghezza del rettangolo quando il pezzo si dà a misure.',
      tipo: 'num', unita: 'mm', min: 10, passo: 1, predefinito: 120, concetto: 'formato',
    },
    {
      id: 'totalHeight', etichetta: 'Altezza del pezzo',
      aiuto: 'L’altezza del rettangolo quando il pezzo si dà a misure.',
      tipo: 'num', unita: 'mm', min: 10, passo: 1, predefinito: 160, concetto: 'formato',
    },
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

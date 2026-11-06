import type { SchedaParametri } from '../tipi';

// Pattern a macchie: i parametri sono `params` = PARAMETRI_MACCHIE (apps/pattern-macchie/src/motore.ts).
// Non registrati perché dati e non parametri: `pattern` (preset del Generatore pattern scelto) e `ruoli`.
export const scheda: SchedaParametri = {
  parametri: [
    {
      id: 'withBase', nome: 'conBase', etichetta: 'La base',
      aiuto: 'La base col pattern su tutto il pannello. Spenta: niente base.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'withOverlay', nome: 'conSopra', etichetta: 'Il punto sopra le macchie',
      aiuto: 'Lo stesso punto della base sopra il raso, dentro le macchie. Spento: solo il raso.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'secondLevelMargin', nome: 'secondoMargine', etichetta: 'Un livello entra sotto quelli sopra di',
      aiuto: 'Dove una macchia sta sotto una di un livello più alto si ferma: ci entra solo di tanto, così non si sovrappone troppo filo.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1, concetto: 'rientro',
    },
    {
      id: 'firstLevelVisibleMax', nome: 'secondoVista', etichetta: 'Fra le macchie dei livelli sotto, a vista al più',
      aiuto: 'Il filo da una macchia alla dopo corre sotto i livelli più alti e sotto le macchie ancora da cucire. Dove nessuna lo copre attraversa lo spazio a vista, al più di tanto per volta. 0 = mai a vista: lì si salta.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 12, concetto: 'passaggi-nascosti',
    },
    {
      id: 'visiblePassagesNear', nome: 'vistaVicini', etichetta: 'I passaggi a vista si avvicinano a quelli già fatti, entro',
      aiuto: 'Attraversare lo spazio entro questa distanza da un altro passaggio a vista costa meno, e il filo ci va se può arrivarci coperto. 0 = ognuno dove è più corto.',
      tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, concetto: 'passaggi-nascosti',
    },
    {
      id: 'leftToRightOrder3', nome: 'daSinistra3', etichetta: '3° livello: le macchie da sinistra a destra',
      aiuto: 'Come «Le macchie da sinistra a destra», per il terzo livello.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura',
    },
    {
      id: 'satinAngle3', nome: 'rasoAngolo3', etichetta: '3° livello: direzione del raso',
      aiuto: 'Direzione delle righe del raso del terzo livello, gradi (90 = verticale).',
      tipo: 'num', unita: 'deg', min: -180, passo: 1, predefinito: 90, concetto: 'angolo',
    },
    {
      id: 'satinRowSpacing3', nome: 'rasoInterlinea3', etichetta: '3° livello: interlinea del raso',
      aiuto: 'Distanza fra le righe del raso del terzo livello.',
      tipo: 'num', unita: 'mm', min: 0.1, passo: 0.05, predefinito: 0.4, concetto: 'densita',
    },
    {
      id: 'satinMaxStitch3', nome: 'rasoPuntoMax3', etichetta: '3° livello: punto massimo del raso',
      aiuto: 'Le macchie larghe non fanno punti da bordo a bordo.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 4, concetto: 'punto-massimo',
    },
    {
      id: 'satinPhase3', nome: 'rasoFase3', etichetta: '3° livello: fase del raso',
      aiuto: 'Di quanto gli aghi di una riga sono spostati rispetto alla riga accanto, in % del punto.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 30, concetto: 'spostamento',
    },
    {
      id: 'fringeAmount3', nome: 'sfrangiatura3', etichetta: '3° livello: sfrangiatura',
      aiuto: 'Di quanto, a caso, ogni riga finisce prima o dopo il bordo. 0 = netto.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1, concetto: 'variazione',
    },
    {
      id: 'fringeOutsidePercent3', nome: 'sfrangiaturaFuori3', etichetta: '3° livello: …di cui oltre il bordo',
      aiuto: '0 = le righe si accorciano soltanto; 100 = si allungano soltanto.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 10, predefinito: 50, concetto: 'variazione',
    },
    {
      id: 'leftToRightOrder2', nome: 'daSinistra2', etichetta: '2° livello: le macchie da sinistra a destra',
      aiuto: 'Come «Le macchie da sinistra a destra», per il secondo livello.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura',
    },
    {
      id: 'satinAngle2', nome: 'rasoAngolo2', etichetta: '2° livello: direzione del raso',
      aiuto: 'Direzione delle righe del raso del secondo livello, gradi (90 = verticale).',
      tipo: 'num', unita: 'deg', min: -180, passo: 1, predefinito: 90, concetto: 'angolo',
    },
    {
      id: 'satinRowSpacing2', nome: 'rasoInterlinea2', etichetta: '2° livello: interlinea del raso',
      aiuto: 'Distanza fra le righe del raso del secondo livello.',
      tipo: 'num', unita: 'mm', min: 0.1, passo: 0.05, predefinito: 0.4, concetto: 'densita',
    },
    {
      id: 'satinMaxStitch2', nome: 'rasoPuntoMax2', etichetta: '2° livello: punto massimo del raso',
      aiuto: 'Le macchie larghe non fanno punti da bordo a bordo.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 4, concetto: 'punto-massimo',
    },
    {
      id: 'satinPhase2', nome: 'rasoFase2', etichetta: '2° livello: fase del raso',
      aiuto: 'Di quanto gli aghi di una riga sono spostati rispetto alla riga accanto, in % del punto.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 30, concetto: 'spostamento',
    },
    {
      id: 'fringeAmount2', nome: 'sfrangiatura2', etichetta: '2° livello: sfrangiatura',
      aiuto: 'Di quanto, a caso, ogni riga finisce prima o dopo il bordo. 0 = netto.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1, concetto: 'variazione',
    },
    {
      id: 'fringeOutsidePercent2', nome: 'sfrangiaturaFuori2', etichetta: '2° livello: …di cui oltre il bordo',
      aiuto: '0 = le righe si accorciano soltanto; 100 = si allungano soltanto.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 10, predefinito: 50, concetto: 'variazione',
    },
    {
      id: 'satinAngle', nome: 'rasoAngolo', etichetta: 'Direzione del raso',
      aiuto: 'Direzione delle righe del raso, gradi (90 = verticale).',
      tipo: 'num', unita: 'deg', min: -180, passo: 1, predefinito: 90, concetto: 'angolo',
    },
    {
      id: 'satinRowSpacing', nome: 'rasoInterlinea', etichetta: 'Interlinea del raso',
      aiuto: 'Distanza fra le righe del raso.',
      tipo: 'num', unita: 'mm', min: 0.1, passo: 0.05, predefinito: 0.4, concetto: 'densita',
    },
    {
      id: 'satinMaxStitch', nome: 'rasoPuntoMax', etichetta: 'Punto massimo del raso',
      aiuto: 'Le macchie larghe non fanno punti da bordo a bordo.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 4, concetto: 'punto-massimo',
    },
    {
      id: 'satinPhase', nome: 'rasoFase', etichetta: 'Fase del raso',
      aiuto: 'Nelle righe più lunghe del punto massimo, di quanto gli aghi di una riga sono spostati rispetto alla riga accanto, in % del punto. 0 = tutti alla stessa altezza.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 30, concetto: 'spostamento',
    },
    {
      id: 'satinByStilista', nome: 'rasoDiStilista', etichetta: 'In Stilista, il raso lo fa Stilista',
      aiuto: 'Con «Invia a Stilista» ogni macchia torna come una copia del riempimento selezionato in Stilista, con l\'ingresso, l\'uscita e l\'ordine del tool. L\'anteprima e il DST restano col raso del tool.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'fringeAmount', nome: 'sfrangiatura', etichetta: 'Sfrangiatura',
      aiuto: 'Di quanto, a caso, ogni riga finisce prima o dopo il bordo: il bordo non è più netto. 0 = netto.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1, concetto: 'variazione',
    },
    {
      id: 'fringeOutsidePercent', nome: 'sfrangiaturaFuori', etichetta: '…di cui oltre il bordo',
      aiuto: '0 = le righe si accorciano soltanto; 100 = si allungano soltanto, sulla base.',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 10, predefinito: 50, concetto: 'variazione',
    },
    {
      id: 'hiddenPassMax', nome: 'passaggioMax', etichetta: 'Passaggio nascosto, fino a',
      aiuto: 'Il punto sopra va da un pezzo all\'altro sulle linee della base, anche ripassando: dentro la macchia non salta.',
      tipo: 'num', unita: 'mm', min: 0, passo: 5, predefinito: 100, concetto: 'passaggi-nascosti',
    },
    {
      id: 'minDetachedPiece', nome: 'pezzoMinimo', etichetta: 'Togli i pezzi del punto sopra più corti di',
      aiuto: 'I pezzetti staccati dal resto (una barretta che entra dal bordo mentre la sua colonna è fuori) non si cuciono. Il punto sopra non esce mai dalla macchia.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 2, concetto: 'altro',
    },
    {
      id: 'overlayMinStitch', nome: 'sopraPuntoMin', etichetta: 'Punto minimo del punto sopra',
      aiuto: 'Al bordo della macchia la linea si ferma all’ago prima invece di lasciare un puntino; dentro, gli aghi si ridistribuiscono lungo la linea. Più alto per i fili spessi.',
      tipo: 'num', unita: 'mm', min: 0.3, passo: 0.1, predefinito: 1, concetto: 'punto-minimo',
    },
    {
      id: 'overlayShiftX', nome: 'sopraSfasaX', etichetta: 'Sposta il punto sopra verso destra di',
      aiuto: 'Il punto sopra è il disegno della base spostato: così i suoi aghi non cadono sul filo della base. Negativo = verso sinistra. 0 e 0 = sopra la base, a registro.',
      tipo: 'num', unita: 'mm', min: -5, max: 5, passo: 0.1, predefinito: 1, concetto: 'spostamento',
    },
    {
      id: 'overlayShiftY', nome: 'sopraSfasaY', etichetta: '…e verso il basso di',
      aiuto: 'Negativo = verso l\'alto. In diagonale gli aghi cadono più lontano dal filo della base che spostando in una direzione sola.',
      tipo: 'num', unita: 'mm', min: -5, max: 5, passo: 0.1, predefinito: 1, concetto: 'spostamento',
    },
    {
      id: 'bridgeMaxGap', nome: 'ponti', etichetta: 'Unisci le macchie che si seguono e distano meno di',
      aiuto: 'Un ponte di raso fra le due: il filo passa senza salto. Cambia il disegno delle macchie. 0 = mai.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 0, concetto: 'altro',
    },
    {
      id: 'bridgeWidth', nome: 'pontiLarghezza', etichetta: 'Larghezza del ponte',
      aiuto: 'La larghezza del ponte fra due macchie vicine.',
      tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 2, concetto: 'altro',
    },
    {
      id: 'leftToRightOrder', nome: 'daSinistra', etichetta: 'Le macchie da sinistra a destra',
      aiuto: 'L\'ordine delle macchie da sinistra a destra, e il raso dentro le macchie da sinistra a destra dove può. Spento: l\'ordine coi salti più corti.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura',
    },
    {
      id: 'stopZones', nome: 'zone', etichetta: 'Dividi raso e punto sopra in zone',
      aiuto: '1 = nessuna divisione. Con 2: base · raso della prima metà · punto sopra della prima metà · raso della seconda · punto sopra della seconda.',
      tipo: 'int', unita: '', min: 1, max: 8, passo: 1, predefinito: 1, concetto: 'ordine-cucitura',
    },
    {
      id: 'stopZonesDirection', nome: 'zoneVerso', etichetta: 'Le zone vanno',
      aiuto: 'verticale = strisce da sinistra a destra; orizzontale = dall\'alto in basso.',
      tipo: 'enum', unita: '', opzioni: ['verticale', 'orizzontale'], predefinito: 'verticale', concetto: 'ordine-cucitura',
    },
    {
      id: 'topStitchBandBeforeDivision', nome: 'sopraFascia', etichetta: 'Prima della divisione, punto sopra nella zona dopo: fascia di',
      aiuto: 'Una macchia che entra in questa fascia, misurata dal confine con la zona dopo, ha il raso nella sua zona e tutto il punto sopra nella zona dopo. 0 = nessuna.',
      tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, concetto: 'ordine-cucitura',
    },
    {
      id: 'cutBaseUnderSpots', nome: 'bucaLaBase', etichetta: 'Buca la base sotto le macchie',
      aiuto: 'Se la base si buca sotto le macchie (fermandosi al margine dentro). Spento: la base resta tutta intera.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'baseCutMargin', nome: 'margineBase', etichetta: 'Margine della base nella macchia',
      aiuto: 'Di quanto la base entra nella macchia quando si buca: il raso la copre.',
      tipo: 'num', unita: 'mm', predefinito: 2, concetto: 'rientro',
    },
  ],
};

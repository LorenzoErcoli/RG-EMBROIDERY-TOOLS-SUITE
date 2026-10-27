import type { SchedaParametri } from '../tipi';

// Pattern a macchie: i parametri sono `params` = PARAMETRI_MACCHIE (apps/pattern-macchie/src/motore.ts).
// Non registrati perché dati e non parametri: `pattern` (preset del Generatore pattern scelto) e `ruoli`.
export const scheda: SchedaParametri = {
  parametri: [
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

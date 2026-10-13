import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Il cannage rafia salva in sei chiavi: `params` (stop 5, le linee), `stop` (stop 1-2), `basiParams`,
// `cornice` (stop 6), `programma` e `bordatura` (stop 7-10). Testi e limiti dal pannello (fields.ts).

const linee: DichiarazioneParametro[] = [
  { id: 'cordedPasses', nome: 'passateCordoncino', etichetta: 'Passate del cordoncino', aiuto: 'Passate di ogni pezzo di cordoncino orizzontale (dispari: il pezzo finisce dall’altra parte).', tipo: 'int', unita: '', min: 1, passo: 2, predefinito: 9, concetto: 'passate-pezzo' },
  { id: 'cordedMaxStitch', nome: 'puntoMaxCordoncino', etichetta: 'Punto massimo nel cordoncino', aiuto: '0 = un punto per passata', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'punto-massimo' },
  { id: 'ladderPasses', nome: 'passateVerticali', etichetta: 'Passate di scalette e meandri', aiuto: 'Passate dei pezzi verticali (scalette e meandri).', tipo: 'int', unita: '', min: 1, passo: 2, predefinito: 11, concetto: 'passate-pezzo' },
  { id: 'runMaxStitch', nome: 'puntoMaxCorsa', etichetta: 'Punto massimo del filo singolo', aiuto: 'Punto massimo delle corse (filo singolo sulle linee e nelle finestre).', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.5, predefinito: 10, concetto: 'punto-massimo' },
  { id: 'cordedPieceLength', nome: 'lunghezzaPezzo', etichetta: 'Lunghezza di un pezzo di cordoncino', aiuto: 'Oltre questa, più la soglia, il pezzo diventa due (con un fermo in più).', tipo: 'num', unita: 'mm', min: 1, passo: 0.1, predefinito: 8.4, concetto: 'lunghezza-pezzo' },
  { id: 'brickLength', nome: 'lunghezzaMattoncino', etichetta: 'Lunghezza di un mattoncino', aiuto: 'Lo stesso, per scalette e meandri.', tipo: 'num', unita: 'mm', min: 1, passo: 0.1, predefinito: 7.5, concetto: 'lunghezza-pezzo' },
  { id: 'objectSplitThreshold', nome: 'sogliaOggetti', etichetta: 'Soglia per aggiungere oggetti', aiuto: 'Di quanto un oggetto può allungarsi col rombo prima di dividersi.', tipo: 'num', unita: '%', min: 0, passo: 5, predefinito: 50, concetto: 'soglia-divisione' },
  { id: 'overhangLeft', nome: 'sporgenzaSinistra', etichetta: 'Sporgenza a sinistra', aiuto: 'Le linee partono fuori dal pezzo di tanto.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1, concetto: 'sporgenza' },
  { id: 'overhangRight', nome: 'sporgenzaDestra', etichetta: 'Sporgenza a destra', aiuto: 'Le linee arrivano fino in fondo e finiscono fuori dal pezzo di tanto, come a sinistra.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1, concetto: 'sporgenza' },
  { id: 'windowWidening', nome: 'allargamentoFinestre', etichetta: 'Allargamento delle finestre', aiuto: 'Dove la cornice attraversa la linea la finestra si allarga di tanto per parte: i fermi si allontanano e gli uncini ci stanno in mezzo; 0 = come nel DST M1404.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1, concetto: 'altro' },
  { id: 'verticalMargin', nome: 'margineVerticale', etichetta: 'Margine in alto e in basso', aiuto: 'Scalette, meandri e barre si fermano a questa distanza dal bordo.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 3, concetto: 'rientro' },
  { id: 'edgeTravelStitch', nome: 'puntoPassaggioBordo', etichetta: 'Punto dei passaggi sul bordo', aiuto: 'Punto dei passaggi sul bordo sinistro.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.5, predefinito: 2.5, concetto: 'punto-passaggio' },
  { id: 'linesReliefPasses', nome: 'passateScarico', etichetta: 'Passate nelle aree di scarico', aiuto: 'Dentro le tinte marcate «Area di scarico» cordoncini, scalette, meandri e zig-zag (fermi e barre) si cuciono con queste passate invece di quelle sopra; 0 = come sopra.', tipo: 'int', unita: '', min: 0, passo: 1, predefinito: 5, concetto: 'aree-di-scarico' },
  { id: 'thermoOutline', nome: 'termogarze', etichetta: 'Contorno per le termogarze', aiuto: 'Il contorno ripassato a inizio fase, per le termogarze: può esserci o no.', tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore' },
  { id: 'thermoOutlineStitch', nome: 'puntoTermogarze', etichetta: 'Punto del contorno termogarze', aiuto: 'Punto del contorno per le termogarze.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.5, predefinito: 4, concetto: 'punto-corsa' },
];

const stop: DichiarazioneParametro[] = [
  { id: 'outlineStitch', nome: 'puntoContorno', dove: 'stop', etichetta: 'Punto del contorno a impunture', aiuto: 'Stop 1, e il contorno all’inizio dello stop 2.', tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 4, concetto: 'punto-corsa' },
  { id: 'gridStitch', nome: 'puntoGriglia', dove: 'stop', etichetta: 'Punto della griglia', aiuto: 'Punto della griglia che blocca i materiali (stop 2).', tipo: 'num', unita: 'mm', min: 1, passo: 0.5, predefinito: 3.5, concetto: 'punto-corsa' },
  { id: 'gridInset', nome: 'rientroGriglia', dove: 'stop', etichetta: 'Rientro della griglia dal contorno', aiuto: 'La griglia si ferma a questa distanza dal bordo del pezzo; lì il filo passa da una linea all’altra.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 6, concetto: 'rientro' },
  { id: 'gridMinLine', nome: 'lineaMinima', dove: 'stop', etichetta: 'Linea di griglia più corta', aiuto: 'I pezzi di linea più corti di così, negli angoli, non si cuciono.', tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 45, concetto: 'altro' },
];

const basi: DichiarazioneParametro[] = [
  { id: 'reliefPercent', dove: 'basiParams', etichetta: 'Scarico nelle aree', aiuto: 'Dentro le tinte marcate «Area di scarico» le basi hanno meno passate: 50 = metà; 0 = niente.', tipo: 'num', unita: '%', min: 0, passo: 5, predefinito: 50, regole: ['R28'], concetto: 'aree-di-scarico' },
];

const programma: DichiarazioneParametro[] = [
  { id: 'minStitch', nome: 'puntoMinimo', dove: 'programma', etichetta: 'Punto minimo', aiuto: 'Vale per tutti gli stop: i punti più corti di così si tolgono; 0 = niente.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0.5, regole: ['R3'], concetto: 'punto-minimo' },
];

const cornice: DichiarazioneParametro[] = [
  { id: 'hookHorizontalPasses', nome: 'passateOrizzontale', dove: 'cornice', etichetta: 'Passate dell’orizzontale', aiuto: 'Passate dell’uncino orizzontale della cornice (stop 6).', tipo: 'int', unita: '', min: 1, passo: 2, predefinito: 11, concetto: 'passate-pezzo' },
  { id: 'hookVerticalPasses', nome: 'passateVerticale', dove: 'cornice', etichetta: 'Passate della verticale', aiuto: 'Passate dell’uncino verticale della cornice (stop 6).', tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 9, concetto: 'passate-pezzo' },
  { id: 'hookHorizontalLength', nome: 'lunghezzaOrizzontale', dove: 'cornice', etichetta: 'Lunghezza dell’orizzontale', aiuto: 'Metà nel pattern 1 e metà nel pattern 2: il centro sta sempre sul lato del rombo.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 5.4, concetto: 'lunghezza-pezzo' },
  { id: 'hookVerticalLength', nome: 'lunghezzaVerticale', dove: 'cornice', etichetta: 'Lunghezza della verticale', aiuto: 'Lunghezza dell’uncino verticale della cornice.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 4.3, concetto: 'lunghezza-pezzo' },
  { id: 'hookIrregularity', nome: 'irregolarita', dove: 'cornice', etichetta: 'Irregolarità', aiuto: 'Di quanto al massimo un uncino è più lungo o più corto degli altri; 0 = tutti uguali.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0.3, concetto: 'variazione' },
  { id: 'frameInset', nome: 'rientro', dove: 'cornice', etichetta: 'Rientro dal bordo', aiuto: 'Distanza minima dal bordo del pezzo: un’orizzontale che ci arriva più vicino non si cuce, una verticale si accorcia.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1, concetto: 'rientro' },
  { id: 'hookSplitThreshold', nome: 'sogliaUncini', dove: 'cornice', etichetta: 'Soglia per aggiungere uncini', aiuto: 'Di quanto il passo può allungarsi col rombo prima che gli uncini aumentino.', tipo: 'num', unita: '%', min: 0, passo: 5, predefinito: 50, concetto: 'soglia-divisione' },
  { id: 'frameTravelStitch', nome: 'puntoPassaggio', dove: 'cornice', etichetta: 'Punto dei passaggi', aiuto: 'Punto dei passaggi della cornice.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.5, predefinito: 4, concetto: 'punto-passaggio' },
  { id: 'frameReliefPasses', nome: 'passateScarico', dove: 'cornice', etichetta: 'Passate nelle aree di scarico', aiuto: 'Dentro le tinte marcate «Area di scarico» gli uncini si cuciono con queste passate invece di quelle sopra; 0 = come sopra.', tipo: 'int', unita: '', min: 0, passo: 1, predefinito: 5, concetto: 'aree-di-scarico' },
];

const bordatura: DichiarazioneParametro[] = [
  { id: 'borderOutset', nome: 'uscita', dove: 'bordatura', etichetta: 'Uscita oltre la linea', aiuto: 'La linea disegnata o scelta è il lato esterno: la bordatura esce di tanto verso fuori e cresce verso dentro.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0.5, concetto: 'sporgenza' },
  { id: 'borderEndOverhang', nome: 'sporgenzaEstremi', dove: 'bordatura', etichetta: 'Sporgenza ai capi', aiuto: 'Di quanto va oltre i capi di una linea aperta.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1.5, concetto: 'sporgenza' },
  { id: 'obliqueSatinPitch', nome: 'passoObliquo', dove: 'bordatura', etichetta: 'Passo del raso obliquo', aiuto: 'Distanza fra due punti sullo stesso lato: densità bassa.', tipo: 'num', unita: 'mm', min: 0.2, passo: 0.1, predefinito: 1, concetto: 'interlinea' },
  { id: 'obliqueSatinAngle', nome: 'angoloObliquo', dove: 'bordatura', etichetta: 'Inclinazione del raso obliquo', aiuto: 'Inclinazione del raso obliquo della bordatura.', tipo: 'num', unita: 'deg', min: 10, passo: 5, predefinito: 45, concetto: 'angolo' },
  { id: 'straightSatinOverhang', nome: 'sbordoDritto', dove: 'bordatura', etichetta: 'Sbordo del raso dritto', aiuto: 'Di quanto il raso dritto esce oltre l’obliquo, verso fuori.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0.5, concetto: 'sporgenza' },
  { id: 'straightSatinPitch', nome: 'passoDritto', dove: 'bordatura', etichetta: 'Passo del raso dritto', aiuto: 'Passo fra i punti del raso dritto della bordatura.', tipo: 'num', unita: 'mm', min: 0.2, passo: 0.05, predefinito: 0.7, concetto: 'interlinea' },
  { id: 'cordHeight', nome: 'altezzaCordoncino', dove: 'bordatura', etichetta: 'Altezza del cordoncino', aiuto: 'A liscio sul bordo esterno.', tipo: 'num', unita: 'mm', min: 0.3, passo: 0.1, predefinito: 1.2, concetto: 'larghezza-punto' },
  { id: 'cordPitch', nome: 'passoCordoncino', dove: 'bordatura', etichetta: 'Passo del cordoncino', aiuto: 'Passo fra i punti del cordoncino della bordatura.', tipo: 'num', unita: 'mm', min: 0.2, passo: 0.05, predefinito: 0.5, concetto: 'interlinea' },
  { id: 'firstLineOffset', nome: 'primaLinea', dove: 'bordatura', etichetta: 'Prima linea dal bordo esterno', aiuto: 'Distanza della prima linea dal bordo esterno della bordatura.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1.4, concetto: 'rientro' },
  { id: 'lineSpacing', nome: 'distanzaLinee', dove: 'bordatura', etichetta: 'Distanza fra le due linee', aiuto: 'Solo nella doppia: i fermi della seconda sono a metà passo.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 2, concetto: 'altro' },
  { id: 'tackPitch', nome: 'passoFermi', dove: 'bordatura', etichetta: 'Passo dei fermi', aiuto: '0 = il pezzo più lungo delle linee orizzontali (stop 5); più alto per allargarli.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 0, concetto: 'altro' },
  { id: 'borderLinePasses', nome: 'passateLinea', dove: 'bordatura', etichetta: 'Passate delle linee', aiuto: 'Passate delle linee della bordatura.', tipo: 'int', unita: '', min: 1, passo: 2, predefinito: 11, concetto: 'passate-pezzo' },
  { id: 'tackHeight', nome: 'altezzaFermo', dove: 'bordatura', etichetta: 'Altezza dei fermi', aiuto: 'Altezza dei fermi della bordatura.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 2.3, concetto: 'altro' },
];

export const scheda: SchedaParametri = {
  parametri: [...linee, ...stop, ...basi, ...programma, ...cornice, ...bordatura],
  concetti: [
    { id: 'passate-pezzo', descrizione: 'Quante passate fa un pezzo cucito (cordoncino, scaletta, uncino, linea di bordatura).' },
    { id: 'lunghezza-pezzo', descrizione: 'Lunghezza di riferimento di un pezzo (cordoncino, mattoncino, uncino): oltre si divide.' },
    { id: 'soglia-divisione', descrizione: 'Di quanto un oggetto può allungarsi col rombo prima di dividersi o di aumentare di numero.' },
    { id: 'sporgenza', descrizione: 'Di quanto un elemento esce oltre il bordo o i capi del pezzo o della linea.' },
    { id: 'aree-di-scarico', descrizione: 'Aree di scarico: dentro le tinte marcate le passate si riducono (R28).' },
  ],
};

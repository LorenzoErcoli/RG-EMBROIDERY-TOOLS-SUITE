import type { SchedaParametri } from '../tipi';

// Punto Pittorico: i parametri salvati in `params` del file di progetto (defaultPittoricoParams, pipeline.ts).
// Non registrati perché sono liste di punti e non parametri: tagliAggiunti, tagliRimossi (tagli a mano dell'asse, per metodo «colonne»).
export const scheda: SchedaParametri = {
  concetti: [
    { id: 'sfumatura', descrizione: 'Dove il colore sfuma invece di staccare netto: soglia, frangia, sovrapposizione fra tinte.' },
    { id: 'riempimento', descrizione: 'Come si riempie una macchia di raso: metodo e parametri del metodo (colonne, fasce).' },
  ],
  parametri: [
    { id: 'realWidth', nome: 'realWidthMm', etichetta: 'Larghezza reale del ricamo', aiuto: '0 = un pixel vale un millimetro. È la misura che comanda: senza, le altre non significano niente', tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, regole: ['R11'], concetto: 'misura-reale' },
    { id: 'colorCount', etichetta: 'Quanti fili', aiuto: 'ogni tinta è un ago', tipo: 'int', unita: '', min: 2, max: 8, passo: 1, predefinito: 4, concetto: 'colori' },
    { id: 'minPatchArea', nome: 'minAreaMm2', etichetta: 'Macchia più piccola', aiuto: 'Area minima di una macchia perché valga la pena cucirla', tipo: 'num', unita: 'mm2', min: 0, passo: 10, predefinito: 400, concetto: 'immagine' },
    { id: 'lightFlattening', nome: 'flattenLightMm', etichetta: 'Pareggio della luce', aiuto: 'tienilo più grande del motivo (0 = spento)', tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 40, concetto: 'immagine' },
    { id: 'grainSmoothing', nome: 'smoothMm', etichetta: 'Attenuazione della grana', aiuto: 'Raggio dell’attenuazione della grana', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1.5, concetto: 'immagine' },
    { id: 'rowSpacing', nome: 'densitySpacingMm', etichetta: 'Distanza fra le file', aiuto: 'quanto è fitto il pieno', tipo: 'num', unita: 'mm', min: 0.1, max: 2, passo: 0.05, predefinito: 0.3, regole: ['R22'], concetto: 'densita' },
    { id: 'maxInternalTravel', nome: 'maxInternalTravelMm', etichetta: 'Passaggio scoperto massimo', aiuto: 'oltre, il filo si taglia invece di attraversare il disegno. Più basso = meno fili tesi, più rasafili', tipo: 'num', unita: 'mm', min: 5, max: 400, passo: 5, predefinito: 50, concetto: 'passaggi-nascosti' },
    { id: 'maxStitch', nome: 'maxStitchMm', etichetta: 'Punto massimo', aiuto: 'lungo il filo', tipo: 'num', unita: 'mm', min: 0.5, max: 8, passo: 0.5, predefinito: 3, regole: ['R4'], concetto: 'punto-massimo' },
    { id: 'fringeLength', nome: 'frangiaMm', etichetta: 'Lunghezza della frangia', aiuto: 'tienila sotto la sovrapposizione, o si appiattisce', tipo: 'num', unita: 'mm', min: 0, max: 12, passo: 0.5, predefinito: 5, concetto: 'sfumatura' },
    { id: 'outlineSmoothing', nome: 'lisciaBordiMm', etichetta: 'Lisciatura del contorno', aiuto: '0 = il contorno com’esce dalla tracciatura. Alzandola sparisce il dettaglio più piccolo di così', tipo: 'num', unita: 'mm', min: 0, max: 5, passo: 0.2, predefinito: 0, regole: ['R30'], concetto: 'immagine' },
    { id: 'gradientThreshold', nome: 'sogliaSfumaturaMm', etichetta: 'Da qui in su è una sfumatura', aiuto: 'sotto, il colore stacca netto', tipo: 'num', unita: 'mm', min: 0, max: 20, passo: 0.5, predefinito: 1.5, concetto: 'sfumatura' },
    { id: 'gradientOverlap', nome: 'crescitaMm', etichetta: 'Sovrapposizione dove sfuma', aiuto: 'quanto il colore sotto entra sotto quello sopra', tipo: 'num', unita: 'mm', min: 0, max: 12, passo: 0.5, predefinito: 5, concetto: 'sovrapposizione' },
    { id: 'edgeOverlap', nome: 'sormontoMm', etichetta: 'Sormonto dove stacca', aiuto: 'basta poco: serve a non far vedere la tela alla giunta', tipo: 'num', unita: 'mm', min: 0, max: 6, passo: 0.5, predefinito: 1.5, concetto: 'sovrapposizione' },
    { id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Si impone dopo il routing, mai prima', tipo: 'num', unita: 'mm', predefinito: 1, regole: ['R3'], concetto: 'punto-minimo' },
    { id: 'travelStitch', nome: 'travelStitchMm', etichetta: 'Passo dei punti di passaggio', aiuto: 'Lunghezza dei punti dei passaggi', tipo: 'num', unita: 'mm', predefinito: 2.5, concetto: 'punto-passaggio' },
    { id: 'maxVisibleTravel', nome: 'maxVisibleTravelMm', etichetta: 'Tratto scoperto massimo', aiuto: 'Oltre questo tratto scoperto il filo si stacca. Tenuto alto apposta: il giro sul contorno si paga, il taglio del filo no', tipo: 'num', unita: 'mm', predefinito: 400, regole: ['R16'], concetto: 'passaggi-nascosti' },
    { id: 'maxVisibleTravelLastNeedle', nome: 'maxVisibleTravelUltimoMm', etichetta: 'Tratto scoperto massimo, ultimo ago', aiuto: 'Come il tratto scoperto massimo, ma per l’ultimo ago: sopra non c’è niente, ogni passaggio si vede. Sotto la soglia del rasafilo della macchina', tipo: 'num', unita: 'mm', predefinito: 5, regole: ['R16'], concetto: 'passaggi-nascosti' },
    { id: 'continuousFill', nome: 'riempimentoContinuo', etichetta: 'Riempimento continuo', aiuto: 'Cucire ogni macchia con un filo solo, in serpentina, invece di lasciare le corse sciolte al routing', tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' },
    { id: 'fillMethod', nome: 'metodoRiempimento', etichetta: 'Metodo di riempimento', aiuto: 'Come si riempie una macchia: a colonne, a fasce, a curve di livello (iso) o tracciato (rotaia o distanza costante)', tipo: 'enum', unita: '', opzioni: ['colonne', 'fasce', 'iso', 'tracciato'], predefinito: 'fasce', concetto: 'riempimento' },
    { id: 'maxAxisRotation', nome: 'rotazioneMassimaGradi', etichetta: 'Rotazione massima dell’asse', aiuto: 'Solo per «colonne»: quanto può ruotare l’asse dentro una colonna prima di un taglio', tipo: 'num', unita: 'deg', predefinito: 70, concetto: 'riempimento' },
    { id: 'maxColumnWidth', nome: 'larghezzaColonnaMm', etichetta: 'Larghezza massima della colonna', aiuto: 'Solo per «colonne»: larghezza massima di una colonna; oltre, colonne parallele', tipo: 'num', unita: 'mm', predefinito: 24, concetto: 'riempimento' },
    { id: 'maxBandDrift', nome: 'derivaMassima', etichetta: 'Deriva massima della fascia', aiuto: 'Solo per «fasce»: la deriva massima ammessa dentro una fascia, |ln(spaziatura finale / iniziale)|; decide quante fasce servono', tipo: 'num', unita: '', predefinito: 0.2, concetto: 'riempimento' },
    { id: 'bandReseed', nome: 'fasciaMm', etichetta: 'Risemina della fascia', aiuto: 'Solo per «fasce»: ogni quanti mm di cammino si risemina il fronte a spaziatura esatta', tipo: 'num', unita: 'mm', predefinito: 15, concetto: 'riempimento' },
    { id: 'travelRoute', nome: 'viaPassaggi', etichetta: 'Via dei passaggi', aiuto: 'Dove passa il filo di collegamento quando non può andare dritto: «interno» taglia dentro il riempimento, «contorno» costeggia il bordo', tipo: 'enum', unita: '', opzioni: ['interno', 'contorno'], predefinito: 'interno', regole: ['R30'], concetto: 'passaggi-nascosti' },
    { id: 'travelEdgeMargin', nome: 'margineDalBordoMm', etichetta: 'Margine dal bordo dei passaggi', aiuto: 'Quanto il passaggio deve stare lontano dal bordo. Zero = basta stare dentro', tipo: 'num', unita: 'mm', predefinito: 2, concetto: 'rientro' },
    { id: 'sewTravel', nome: 'cuciPassaggi', etichetta: 'Cuci i passaggi', aiuto: 'Cucire i passaggi, o lasciare le corse staccate. Serve a misurare; in produzione resta acceso', tipo: 'bool', unita: '', predefinito: true, concetto: 'passaggi-nascosti' },
  ],
};

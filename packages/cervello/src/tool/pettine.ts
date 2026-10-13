import type { SchedaParametri } from '../tipi';

// Punto pettine sfrangiato. Il tool salva i parametri in `par` (metadata `rgProject: 'pettine'`).
// Etichette e aiuti dal pannello (apps/pettine/src/tool.ts), dove c'e'; altrimenti dai commenti di
// ParametriPettine (motore.ts). Limiti dal `CAMPI` del pannello.
export const scheda: SchedaParametri = {
  concetti: [
    { id: 'lunghezza-dente', descrizione: 'Lunghezza dei denti del pettine: si estrae fra un minimo e un massimo, e quella è la lunghezza del punto.' },
  ],
  parametri: [
    {
      id: 'baseSpacing', nome: 'basiMm', dove: 'par', etichetta: 'Distanza tra le linee',
      aiuto: 'Di quanto una linea di base dista dalla successiva, misurata di traverso. Si devono sovrastare: a 2 mm i denti di una coprono la vicina.',
      tipo: 'num', unita: 'mm', min: 0.8, max: 12, predefinito: 2, concetto: 'densita',
    },
    {
      id: 'toothSpacing', nome: 'passoMm', dove: 'par', etichetta: 'Densità del pettine',
      aiuto: 'Distanza fra un dente e il successivo lungo la linea di base. Non scende sotto 1.',
      tipo: 'num', unita: 'mm', min: 1, max: 8, predefinito: 1.5, concetto: 'interlinea',
    },
    {
      id: 'toothMinLength', nome: 'denteMinMm', dove: 'par', etichetta: 'Lunghezza minima',
      aiuto: 'Quanto è lungo un dente: si estrae fra la lunghezza minima e la massima, e quella è la lunghezza del punto.',
      tipo: 'num', unita: 'mm', min: 0.5, max: 20, predefinito: 3, concetto: 'lunghezza-dente',
    },
    {
      id: 'toothMaxLength', nome: 'denteMaxMm', dove: 'par', etichetta: 'Lunghezza massima',
      aiuto: 'Quanto è lungo un dente: si estrae fra la lunghezza minima e la massima, e quella è la lunghezza del punto.',
      tipo: 'num', unita: 'mm', min: 0.5, max: 20, predefinito: 5, concetto: 'lunghezza-dente',
    },
    {
      id: 'toothOpening', nome: 'aperturaDeg', dove: 'par', etichetta: 'Apertura',
      aiuto: 'Di quanto il dente si scosta, a caso, dal verso del chiaro. A 0 vanno tutti dritti.',
      tipo: 'num', unita: 'deg', min: 0, max: 80, predefinito: 40, concetto: 'angolo',
    },
    {
      id: 'toothSharpEdgeMm', nome: 'nettoMm', dove: 'par', etichetta: 'Bordo netto',
      aiuto: 'Sotto questa larghezza di transizione il bordo è netto e il dente si ferma.',
      tipo: 'num', unita: 'mm', predefinito: 2.5, concetto: 'tolleranza',
    },
    {
      id: 'teeth', nome: 'denti', dove: 'par', etichetta: 'Metti i denti',
      aiuto: 'Senza denti escono solo le linee di base: si guarda la struttura in un attimo, e non si costruisce il DST.',
      tipo: 'bool', unita: '', predefinito: true, concetto: 'interruttore',
    },
    {
      id: 'buildDst', nome: 'dst', dove: 'par', etichetta: 'Costruisci il DST',
      aiuto: 'Costruire anche il DST (costa qualche secondo in più). Il pannello lo tiene uguale a «Metti i denti».',
      tipo: 'bool', unita: '', predefinito: true, concetto: 'interruttore',
    },
    {
      id: 'tintOverlap', nome: 'sormontoMm', dove: 'par', etichetta: 'Sormonto',
      aiuto: 'Se entro tanto, verso il chiaro, c\'è una tinta più chiara, il dente si cuce anche con quella: prima, e sotto. È così che le tinte si mescolano dentro un gruppo.',
      tipo: 'num', unita: 'mm', min: 0, max: 20, predefinito: 4, concetto: 'sovrapposizione',
    },
    {
      id: 'blockBleed', nome: 'sconfinaMm', dove: 'par', etichetta: 'Sconfinamento fra blocchi',
      aiuto: 'Quanto le righe di un blocco entrano in quello accanto, perché la giunta non resti nuda. Alzandolo le righe dei due blocchi si affiancano e si vede una banda più fitta: a 2,5 mm sono il doppio che a 1.',
      tipo: 'num', unita: 'mm', min: 0, max: 10, predefinito: 1, concetto: 'sovrapposizione',
    },
    {
      id: 'passMaxMm', nome: 'passaggioMaxMm', dove: 'par', etichetta: 'Passaggio più lungo',
      aiuto: 'Fin dove un passaggio si cuce comunque, anche se un pezzetto si vedrà. Oltre questa misura il passaggio si fa lo stesso, ma solo se il cammino resta nascosto sotto ciò che verrà dopo e a vista ne resta meno di 3 mm. Negli ultimi due colori i passaggi lunghi non si fanno, perché lì non viene più nessuno a coprirli.',
      tipo: 'num', unita: 'mm', min: 4, max: 250, predefinito: 30, concetto: 'passaggi-nascosti',
    },
    {
      id: 'hiddenPassMaxMm', nome: 'passaggioNascostoMm', dove: 'par', etichetta: 'Passaggio nascosto più lungo',
      aiuto: 'Fin dove si prova un passaggio che va oltre la misura del passaggio più lungo, e che quindi si fa solo se resta nascosto: nella banda di sovrapposizione fra il colore in corso e uno più scuro accanto, o sulla linea esatta di una base futura dello stesso colore.',
      tipo: 'num', unita: 'mm', min: 4, max: 400, predefinito: 400, concetto: 'passaggi-nascosti',
    },
    {
      id: 'gapCrossMm', nome: 'golaMm', dove: 'par', etichetta: 'Gola attraversata',
      aiuto: 'Fin dove la riga più esterna di una fascia attraversa una gola senza spezzarsi: un tratto di tinta più chiara, già cucita, o troppo addossato alla riga prima, incastrato fra due tratti della stessa tinta. A 0 non lo fa mai.',
      tipo: 'num', unita: 'mm', min: 0, max: 100, predefinito: 30, concetto: 'ordine-cucitura',
    },
    {
      id: 'noPassLastColors', nome: 'senzaPassaggiUltimiColori', dove: 'par', etichetta: 'Ultimi colori senza passaggi liberi',
      aiuto: 'Quanti ultimi colori non fanno passaggi liberi: sotto di loro non viene più nessuno a coprire il filo, quindi lì un passaggio si fa solo se resta corto (60 mm) e se il cammino è tutto in zona ancora da ricamare.',
      tipo: 'int', unita: '', min: 0, predefinito: 0, concetto: 'passaggi-nascosti',
    },
    {
      id: 'minTintRunMm', nome: 'tintaMinimaMm', dove: 'par', etichetta: 'Tinta più corta',
      aiuto: 'Quanto deve durare una tinta lungo una riga per meritare un cambio di colore. Sotto, la riga tiene il colore che aveva: senza, restano pezzetti da 5 mm che il loro colore deve andarsi a prendere da lontano.',
      tipo: 'num', unita: 'mm', min: 0, max: 40, predefinito: 6, concetto: 'colori',
    },
    {
      id: 'smoothFlattenMm', nome: 'spianaMm', dove: 'par', etichetta: 'Spianatura',
      aiuto: 'Smussa le creste fra due fronti (spianatura della distanza). Spianatura e chiusura smussano gli spigoli.',
      tipo: 'num', unita: 'mm', min: 0.5, max: 20, predefinito: 5, concetto: 'tolleranza',
    },
    {
      id: 'smoothCloseMm', nome: 'chiudiMm', dove: 'par', etichetta: 'Chiusura',
      aiuto: 'Chiusura delle insenature nella crescita a passo fisso. Spianatura e chiusura smussano gli spigoli.',
      tipo: 'num', unita: 'mm', min: 0, max: 20, predefinito: 3, concetto: 'tolleranza',
    },
    {
      id: 'smoothGrowth', nome: 'addolcisciMm', dove: 'par', etichetta: 'Addolcimento',
      aiuto: 'Millimetri di lisciatura in più per ogni millimetro di distanza dal muro: cresce con la distanza dal muro.',
      tipo: 'num', unita: 'rapporto', min: 0, max: 1, predefinito: 0.15, concetto: 'scala',
    },
    {
      id: 'smoothMaxMm', nome: 'lisciaMaxMm', dove: 'par', etichetta: 'Tetto alla lisciatura',
      aiuto: 'Tetto alla lisciatura.',
      tipo: 'num', unita: 'mm', predefinito: 8, concetto: 'tolleranza',
    },
    {
      id: 'translateMaxAreaMm2', nome: 'traslaMaxMm2', dove: 'par', etichetta: 'Traslazione fino a',
      aiuto: 'I gruppi più piccoli della soglia si costruiscono spostando il muro chiaro senza deformarlo; i più grandi facendo crescere la macchia di un passo per volta.',
      tipo: 'num', unita: 'mm2', min: 0, max: 200000, predefinito: 9000, concetto: 'altro',
    },
    {
      id: 'buildMode', nome: 'modo', dove: 'par', etichetta: 'Come si costruiscono le righe',
      aiuto: 'Come si costruiscono le righe dentro un gruppo grande (i piccoli vanno sempre a traslazione). «auto» (uguale a «geodetica») rimisura a ogni giro la distanza dal fronte appena cucito; «crescita» dilata la macchia di un passo per volta; «livelli» segue le curve di livello della distanza dal muro.',
      tipo: 'enum', unita: '', opzioni: ['auto', 'geodetica', 'crescita', 'livelli'], predefinito: 'auto', concetto: 'ordine-cucitura',
    },
    {
      id: 'showBare', nome: 'mostraNudi', dove: 'par', etichetta: 'Segna in rosa quello che resta scoperto',
      aiuto: 'Colorare di rosa, nell\'anteprima, le celle a più di 0,75 mm da qualunque filo.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore',
    },
    {
      id: 'showPasses', nome: 'mostraPassaggi', dove: 'par', etichetta: 'Disegna i passaggi',
      aiuto: 'I passaggi sono il filo che va da una riga all\'altra invece di essere tagliato: nel disegno sono più sottili e trasparenti del ricamo, perché nel pannello finiscono sotto le righe che vengono dopo.',
      tipo: 'bool', unita: '', predefinito: true, concetto: 'interruttore',
    },
  ],
};

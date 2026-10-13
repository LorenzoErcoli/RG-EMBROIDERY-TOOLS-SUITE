import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Punto razza (cartella apps/razza). Etichette e aiuti dal pannello (CAMPI in tool.ts) e dai commenti di
// apps/razza/src/tipi.ts. Il tool salva i parametri in `params` (ParametriRazza) con nomi italiani: restano.
// Non sono parametri e non si registrano: `fissi` e `sfumature` (liste di pallini e linee messi a mano),
// `contorno` e `vuoti` (la sagoma).
const P = (d: DichiarazioneParametro): DichiarazioneParametro => d;

export const scheda: SchedaParametri = {
  concetti: [
    { id: 'pallino', descrizione: 'Misura e forma dei pallini del Punto razza: diametro, vuoto fra loro, rapporto, profilo, crescita e rimpicciolimento.' },
    { id: 'campo-misura', descrizione: 'Come la misura dei pallini cambia sul pezzo: dal bordo al centro, a chiazze, per linee di sfumatura e pallini fissi.' },
  ],
  parametri: [
    P({ id: 'seed', etichetta: 'Seme del caso', aiuto: 'stesso seme = stesso ricamo', tipo: 'int', unita: '', min: 0, max: 99999, predefinito: 1, concetto: 'seme' }),
    // — i pallini —
    P({ id: 'dotMinDiameter', nome: 'diamMinMm', etichetta: 'Pallino minimo', aiuto: 'sotto i 3 mm diventa uno zig-zag: ricamato sembra un pallino', tipo: 'num', unita: 'mm', min: 1, max: 60, predefinito: 2.4, concetto: 'pallino' }),
    P({ id: 'dotMaxDiameter', nome: 'diamMaxMm', etichetta: 'Pallino massimo', aiuto: 'oltre 8 mm il punto lungo si allenta', tipo: 'num', unita: 'mm', min: 1, max: 60, predefinito: 8, concetto: 'pallino' }),
    P({ id: 'dotGap', nome: 'gapMm', etichetta: 'Distanza fra i pallini', aiuto: 'più è piccola, meno si vedono i passaggi; negativa = si sovrappongono un poco', tipo: 'num', unita: 'mm', min: -1, max: 10, predefinito: 0, concetto: 'pallino' }),
    P({ id: 'dotAspect', nome: 'aspetto', etichetta: 'Larghezza / lunghezza', aiuto: '1 = tondo', tipo: 'num', unita: 'rapporto', min: 0.3, max: 1.5, predefinito: 1, concetto: 'pallino' }),
    P({ id: 'dotProfile', nome: 'profilo', etichetta: 'Forma del profilo', aiuto: '2 = ellisse, 1 = losanga, più alto = più squadrato', tipo: 'num', unita: '', min: 1, max: 6, predefinito: 2, concetto: 'pallino' }),
    P({ id: 'diameterIrregularity', nome: 'irregolarita', etichetta: 'Irregolarità', aiuto: 'caso per caso, attorno alla misura voluta', tipo: 'num', unita: '', min: 0, max: 1, predefinito: 0.25, concetto: 'variazione' }),
    // — dove stanno piccoli e grandi —
    P({ id: 'fieldMode', nome: 'modoCampo', etichetta: 'Misura dei pallini', aiuto: 'Piccoli ai bordi e grandi al centro, oppure tutti della stessa misura (la media).', tipo: 'enum', unita: '', opzioni: ['bordo', 'uniforme'], predefinito: 'bordo', concetto: 'campo-misura' }),
    P({ id: 'edgeDepth', nome: 'profonditaMm', etichetta: 'Distanza dal bordo del pallino massimo', aiuto: '0 = automatico (quanto è profondo il pezzo)', tipo: 'num', unita: 'mm', min: 0, max: 500, predefinito: 0, concetto: 'campo-misura' }),
    P({ id: 'edgeCurve', nome: 'curvaBordo', etichetta: 'Curva della sfumatura', aiuto: '1 = lineare; più alta = piccoli più a lungo vicino al bordo', tipo: 'num', unita: '', min: 0.3, max: 4, predefinito: 1, concetto: 'campo-misura' }),
    P({ id: 'fieldNoise', nome: 'rumoreCampo', etichetta: 'Chiazze', aiuto: '0 = tutto regolare; più alto = macchie di grandi e piccoli', tipo: 'num', unita: '', min: 0, max: 1, predefinito: 0.25, concetto: 'campo-misura' }),
    P({ id: 'fieldNoiseScale', nome: 'scalaCampoMm', etichetta: 'Dimensione delle chiazze', aiuto: 'Lunghezza d’onda delle chiazze.', tipo: 'num', unita: 'mm', min: 5, max: 400, predefinito: 40, concetto: 'campo-misura' }),
    P({ id: 'gradientWeight', nome: 'pesoSfumature', etichetta: 'Peso delle linee di sfumatura', aiuto: '1 = comandano loro; 0 = le ignora e conta solo il bordo', tipo: 'num', unita: 'peso', min: 0, max: 1, predefinito: 1, concetto: 'campo-misura' }),
    P({ id: 'fixedDotInfluence', nome: 'influenzaFissiMm', etichetta: 'Raggio dei pallini fissi', aiuto: 'fin dove la misura di un fisso tira quella dei vicini', tipo: 'num', unita: 'mm', min: 1, max: 500, predefinito: 25, concetto: 'campo-misura' }),
    // — il punto —
    P({ id: 'densitySpacing', nome: 'densitySpacingMm', etichetta: 'Spaziatura delle file', aiuto: 'tra una riga di filo e la successiva dentro il pallino', tipo: 'num', unita: 'mm', min: 0.1, max: 2, predefinito: 0.4, regole: ['R22'], concetto: 'densita' }),
    P({ id: 'minStitchLength', nome: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Nessun punto più corto di così.', tipo: 'num', unita: 'mm', min: 0.3, max: 3, predefinito: 0.8, regole: ['R3'], concetto: 'punto-minimo' }),
    P({ id: 'maxStitchLength', nome: 'maxStitchMm', etichetta: 'Punto massimo', aiuto: 'vale anche per i passaggi', tipo: 'num', unita: 'mm', min: 1, max: 12.1, predefinito: 3, regole: ['R4'], concetto: 'punto-massimo' }),
    // — i passaggi —
    P({ id: 'axisMode', nome: 'modoAngolo', etichetta: 'Asse del cordoncino', aiuto: 'Lungo il percorso (passaggi più nascosti) oppure a caso.', tipo: 'enum', unita: '', opzioni: ['percorso', 'casuale'], predefinito: 'percorso', concetto: 'angolo' }),
    P({ id: 'travelMode', nome: 'modoPassaggio', etichetta: 'Passaggio fra i pallini', aiuto: 'Il meno visibile, dentro il pallino cucito, oppure dritto.', tipo: 'enum', unita: '', opzioni: ['scegli', 'dentro', 'diretto'], predefinito: 'scegli', concetto: 'passaggi-nascosti' }),
    P({ id: 'overStitchedCost', nome: 'pesoSopra', etichetta: 'Costo del filo sopra il cucito', aiuto: 'rispetto a 10 per un mm in vista', tipo: 'num', unita: 'peso', min: 0, max: 20, predefinito: 3, concetto: 'passaggi-nascosti' }),
    // — la posa —
    P({ id: 'edgeMargin', nome: 'margineMm', etichetta: 'Margine dal bordo', aiuto: 'Margine dal bordo del pezzo.', tipo: 'num', unita: 'mm', min: 0, max: 20, predefinito: 0.3, concetto: 'rientro' }),
    P({ id: 'dotGrowth', nome: 'crescita', etichetta: 'Crescita oltre la misura voluta', aiuto: 'quanto un pallino può allargarsi per toccare i vicini', tipo: 'num', unita: 'rapporto', min: 1, max: 3, predefinito: 1.3, concetto: 'pallino' }),
    P({ id: 'dotMinRatio', nome: 'rapportoMinimo', etichetta: 'Rimpicciolimento nei buchi', aiuto: 'quanto può restringersi per entrare dove non c’è posto', tipo: 'num', unita: 'rapporto', min: 0.1, max: 1, predefinito: 0.3, concetto: 'pallino' }),
  ],
};

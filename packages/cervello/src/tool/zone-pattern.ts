import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// «Pattern a zone» salva in `params` una mappa piatta (`cfg`):
//   - i campi di «Zone e sequenza» con il loro nome (`marginMm`, `travelMode`…);
//   - i campi di OGNI pattern in uso col nome prefissato dalla lettera (`A.stepX`, `B.stepX`…): sono
//     un sottoinsieme di quelli del Generatore pattern (PATTERN_FIELDS in fields.ts), con gli stessi nomi.
// Le lettere nascono una per tinta (A, B, C…): qui si dichiara la lettera A, le altre ripetono IDENTICHE
// ogni voce (stessi limiti, stessi default) con la loro lettera davanti.
// Non sono parametri e restano fuori: `roles` (ruolo di ogni tinta), `drawing` (zone del cartamodello).

type Voce = Omit<DichiarazioneParametro, 'dove'>;

/** Un campo del pattern, salvato come `A.<nome>`. */
const p = (d: Voce & { nome: string }): DichiarazioneParametro => ({ ...d, dove: 'params', nome: `A.${d.nome}` });
/** Un campo di «Zone e sequenza», salvato col suo nome. */
const z = (d: Voce): DichiarazioneParametro => ({ ...d, dove: 'params' });

export const scheda: SchedaParametri = {
  parametri: [
    // ---- Pattern (lettera A; B, C… uguali) ----
    p({ id: 'parameterScalePercent', nome: 'parameterScalePercent', etichetta: 'Ingrandisci tutti i parametri', aiuto: 'Scala in percentuale tutti i parametri del pattern.', tipo: 'num', unita: '%', min: 1, passo: 1, predefinito: 100, concetto: 'scala' }),
    p({ id: 'horizontalZigzagWidth', nome: 'horizontalZigzagWidth', etichetta: 'Zig-zag orizzontale: larghezza', aiuto: 'Larghezza dello zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 5.5, concetto: 'modulo' }),
    p({ id: 'horizontalZigzagHeight', nome: 'horizontalZigzagHeight', etichetta: 'Zig-zag orizzontale: altezza', aiuto: 'Altezza dello zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 4.3, concetto: 'modulo' }),
    p({ id: 'horizontalZigzagInterline', nome: 'horizontalZigzagInterline', etichetta: 'Zig-zag orizzontale: interlinea filo', aiuto: 'Interlinea del filo nello zig-zag orizzontale.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.01, predefinito: 0.45, regole: ['R30'], concetto: 'interlinea' }),
    p({ id: 'horizontalZigzagPassCount', nome: 'horizontalZigzagPassCount', etichetta: 'Zig-zag orizzontale: passaggi del filo', aiuto: 'Conta ogni andata e ogni ritorno sul tratto: 2 = un’andata e un ritorno, 4 = due e due; a qualunque altezza, anche 0, e l’interlinea non conta. 0 = dall’interlinea.', tipo: 'int', unita: '', min: 0, passo: 2, predefinito: 0, concetto: 'interlinea' }),
    p({ id: 'horizontalZigzagOffsetX', nome: 'horizontalZigzagOffsetX', etichetta: 'Spostamento dal centro', aiuto: 'Sposta lo zig-zag orizzontale rispetto al centro.', tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 0, concetto: 'spostamento' }),
    p({ id: 'horizontalZigzagSpacing', nome: 'horizontalZigzagSpacing', etichetta: 'Distanza tra gli zig-zag', aiuto: 'Distanza tra uno zig-zag orizzontale e il successivo.', tipo: 'num', unita: 'mm', min: 1, passo: 0.1, predefinito: 12, concetto: 'modulo' }),
    p({ id: 'verticalZigzagWidth', nome: 'verticalZigzagWidth', etichetta: 'Zig-zag verticale: larghezza', aiuto: 'Larghezza dello zig-zag verticale.', tipo: 'num', unita: 'mm', min: 0.1, passo: 0.1, predefinito: 1.2, concetto: 'modulo' }),
    p({ id: 'verticalZigzagInterline', nome: 'verticalZigzagInterline', etichetta: 'Zig-zag verticale: interlinea filo', aiuto: 'Interlinea del filo nello zig-zag verticale.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.01, predefinito: 0.45, regole: ['R30'], concetto: 'interlinea' }),
    p({ id: 'verticalConnectorDiagonalOffsetY', nome: 'verticalConnectorDiagonalOffsetY', etichetta: 'Inclinazione del raccordo', aiuto: 'Quanto il raccordo fra le colonne è inclinato (scostamento in verticale).', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'modulo' }),
    p({ id: 'stepX', nome: 'stepX', etichetta: 'Distanza tra le colonne', aiuto: 'Distanza orizzontale fra una colonna e la successiva.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 5.2, concetto: 'modulo' }),
    p({ id: 'offsetY', nome: 'offsetY', etichetta: 'Sfasamento tra colonne', aiuto: 'Sfasamento verticale fra colonne vicine.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 6, concetto: 'spostamento' }),
    p({ id: 'horizontalAngleDeg', nome: 'horizontalAngleDeg', etichetta: 'Inclinazione dello zig-zag orizzontale', aiuto: 'Inclinazione dello zig-zag orizzontale.', tipo: 'num', unita: 'deg', passo: 1, predefinito: 0, concetto: 'angolo' }),
    p({ id: 'alternateHorizontalAngle', nome: 'alternateHorizontalAngle', etichetta: 'Inverti l’inclinazione a colonne alterne', aiuto: 'Inverte il segno dell’inclinazione a colonne alterne.', tipo: 'bool', unita: '', predefinito: false, concetto: 'interruttore' }),
    p({ id: 'columnWaveAmplitude', nome: 'columnWaveAmplitude', etichetta: 'Ampiezza dell’onda', aiuto: 'Ampiezza dell’onda lungo le colonne.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0, concetto: 'modulo' }),
    p({ id: 'columnWaveLength', nome: 'columnWaveLengthMm', etichetta: 'Lunghezza d’onda', aiuto: 'Ogni quanti mm si ripete l’onda.', tipo: 'num', unita: 'mm', min: 1, passo: 1, predefinito: 60, concetto: 'modulo' }),
    p({ id: 'columnWavePhase', nome: 'columnWavePhaseDeg', etichetta: 'Fase', aiuto: 'Fase dell’onda lungo le colonne.', tipo: 'num', unita: 'deg', passo: 5, predefinito: 0, concetto: 'angolo' }),
    p({ id: 'repeatBack', nome: 'repeatBack', etichetta: 'Andata e ritorno (serpentina)', aiuto: 'Cuce le colonne in andata e ritorno, a serpentina.', tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura' }),
    p({ id: 'useConnectors', nome: 'useConnectors', etichetta: 'Raccorda le colonne fra loro', aiuto: 'Raccorda le colonne fra loro.', tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' }),
    p({ id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Lunghezza minima di un punto.', tipo: 'num', unita: 'mm', min: 0, passo: 0.01, predefinito: 0.4, regole: ['R3'], concetto: 'punto-minimo' }),
    p({ id: 'maxStitch', nome: 'maxStitchMm', etichetta: 'Lunghezza massima del punto', aiuto: 'Lunghezza massima di un punto: oltre si suddivide.', tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 6, regole: ['R4'], concetto: 'punto-massimo' }),
    p({ id: 'constructionStroke', nome: 'constructionStroke', etichetta: 'Spessore di costruzione', aiuto: 'Regola rientri, margini e raccordi — non è il filo disegnato.', tipo: 'num', unita: 'mm', min: 0.05, passo: 0.05, predefinito: 0.3, concetto: 'altro' }),
    p({ id: 'boundaryCleanupMode', nome: 'boundaryCleanupMode', etichetta: 'Punti fuori dal contorno', aiuto: 'Cosa fare dei punti che cadono fuori dal contorno della zona.', tipo: 'enum', unita: '', opzioni: ['adjust-then-delete', 'delete'], predefinito: 'adjust-then-delete', concetto: 'tolleranza' }),
    p({ id: 'maxBoundaryAdjustment', nome: 'maxBoundaryAdjustment', etichetta: 'Spostamento massimo verso il bordo', aiuto: 'Quanto un punto può essere tirato sul bordo prima di essere eliminato; 0 = usa il punto minimo.', tipo: 'num', unita: 'mm', min: 0, passo: 0.01, predefinito: 0, concetto: 'tolleranza' }),
    p({ id: 'reliefPercent', nome: 'reliefPercent', etichetta: 'Scarico nelle aree', aiuto: 'Dentro le tinte marcate «Area di scarico» i zig-zag verticali e orizzontali hanno meno passate: 50 = metà; 0 = niente.', tipo: 'num', unita: '%', min: 0, passo: 5, predefinito: 50, concetto: 'aree-di-scarico' }),

    // ---- Zone e sequenza ----
    z({ id: 'zoneMargin', nome: 'marginMm', etichetta: 'Aria attorno alla zona', aiuto: 'Margine lasciato attorno a ogni zona.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 2, concetto: 'rientro' }),
    z({ id: 'rowHeight', nome: 'rowHeightMm', etichetta: 'Altezza della riga', aiuto: 'La fascia entro cui le zone contano come «stessa riga»; 0 = la ricava dal disegno.', tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, concetto: 'ordine-cucitura' }),
    z({ id: 'minArea', nome: 'minAreaMm2', etichetta: 'Ignora le zone sotto', aiuto: 'Le zone di area inferiore a questa si ignorano.', tipo: 'num', unita: 'mm2', min: 0, passo: 1, predefinito: 0, concetto: 'tolleranza' }),
    z({ id: 'travelMode', nome: 'travelMode', etichetta: 'Passaggi fra le zone', aiuto: 'Come ci si sposta da una zona all’altra: impunture sui bordi dei rombi, oppure salto a filo alzato.', tipo: 'enum', unita: '', opzioni: ['edges', 'none'], predefinito: 'edges', concetto: 'passaggi-nascosti' }),
    z({ id: 'travelStitch', nome: 'travelStitchMm', etichetta: 'Punto dei passaggi', aiuto: 'Lunghezza dei punti dei passaggi fra le zone.', tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 3, concetto: 'punto-passaggio' }),
    z({ id: 'outerMargin', nome: 'outerMarginMm', etichetta: 'Margine sul bordo esterno', aiuto: 'Il ricamo deborda di tanto oltre il perimetro del disegno; i bordi fra un rombo e l’altro non si toccano.', tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 0, concetto: 'rientro' }),
    z({ id: 'cleanupMinStitch', nome: 'cleanupMinStitchMm', etichetta: 'Pulizia punti', aiuto: 'Toglie i punti più vicini di così, alla fine di tutto (passaggi compresi); 0 = non tocca niente.', tipo: 'num', unita: 'mm', min: 0, passo: 0.05, predefinito: 0, regole: ['R3'], concetto: 'punto-minimo' }),
  ],
};

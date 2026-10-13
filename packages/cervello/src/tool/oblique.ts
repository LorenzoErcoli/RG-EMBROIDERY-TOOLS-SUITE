import type { DichiarazioneParametro, SchedaParametri, Tipo, Unita } from '../tipi';

// Scheda di oblique (Broderie Anglaise). Salva `params` (ObliqueParams) e `roles` (ruolo→colore: blob, non parametri).
// Aiuti: dal pannello (tool.ts) dove il parametro è esposto, altrimenti dal commento di ObliqueParams in engine.ts.

type Extra = Partial<Pick<DichiarazioneParametro, 'min' | 'max' | 'passo' | 'opzioni' | 'regole'>>;
const p = (id: string, etichetta: string, aiuto: string, tipo: Tipo, unita: Unita, predefinito: DichiarazioneParametro['predefinito'], concetto: string, extra: Extra = {}, nome?: string): DichiarazioneParametro =>
  ({ id, ...(nome ? { nome } : {}), etichetta, aiuto, tipo, unita, predefinito, concetto, ...extra });

const CLIP = ['strict_clip', 'keep_only_if_fully_inside', 'keep_if_intersects'];

export const scheda: SchedaParametri = {
  concetti: [
    { id: 'fori-laser', descrizione: 'Fori laser: filtrano piazzamento e fissaggio (R7, R12); tolleranze e abbinamento ai moduli.' },
    { id: 'ritaglio', descrizione: 'Come il ricamo si taglia al perimetro: modalità di clip e di pulizia (R5).' },
    { id: 'instradamento-passaggi', descrizione: 'Come i passaggi costeggiano il bordo tra le diagonali per tenere il filo continuo (R26).' },
  ],
  parametri: [
    // --- formato pannello
    p('panelWidth', 'Pannello larghezza', 'Larghezza del formato di lavoro; se c’è un cartamodello il formato nasce dal suo ingombro.', 'num', 'mm', 100, 'formato', { min: 1, passo: 1 }, 'formatWidth'),
    p('panelHeight', 'Pannello altezza', 'Altezza del formato di lavoro; se c’è un cartamodello il formato nasce dal suo ingombro.', 'num', 'mm', 100, 'formato', { min: 1, passo: 1 }, 'formatHeight'),
    p('panelOriginX', 'Origine pannello X', 'Origine X del formato pannello.', 'num', 'mm', 0, 'formato', {}, 'formatOriginX'),
    p('panelOriginY', 'Origine pannello Y', 'Origine Y del formato pannello.', 'num', 'mm', 0, 'formato', {}, 'formatOriginY'),
    p('realWidthMm', 'Larghezza reale del cartamodello', '0 = usa la misura letta dal file. Se l’SVG non dichiara width/height la misura è una stima: scrivi qui la larghezza vera e comanda quella.', 'num', 'mm', 0, 'misura-reale', { min: 0, passo: 0.1, regole: ['R11'] }),
    p('overflowMarginMm', 'Margine di espansione della griglia', 'Margine oltre il formato su cui si estende la griglia dei moduli (riempimento automatico).', 'num', 'mm', 80, 'rientro'),

    // --- griglia diagonale
    p('gridVectorAX', 'Vettore A, X', 'Passo X del vettore A della griglia diagonale (da un modulo al successivo lungo la diagonale).', 'num', 'mm', 18.5, 'modulo', {}, 'vectorAX'),
    p('gridVectorAY', 'Vettore A, Y', 'Passo Y del vettore A della griglia diagonale.', 'num', 'mm', -14.8, 'modulo', {}, 'vectorAY'),
    p('gridVectorBX', 'Vettore B, X', 'Passo X del vettore B della griglia (da una diagonale alla successiva).', 'num', 'mm', -8.45, 'modulo', {}, 'vectorBX'),
    p('gridVectorBY', 'Vettore B, Y', 'Passo Y del vettore B della griglia.', 'num', 'mm', 54.8, 'modulo', {}, 'vectorBY'),
    p('horizontalGap', 'Spazio orizzontale', 'Si somma al passo X del vettore A (spazio fra moduli).', 'num', 'mm', 0, 'modulo'),
    p('verticalGap', 'Spazio verticale', 'Si somma al passo Y del vettore A (spazio fra moduli).', 'num', 'mm', 0, 'modulo'),
    p('horizontalOverlap', 'Sovrapposizione orizzontale', 'Si sottrae al passo X del vettore A (moduli che si sovrappongono).', 'num', 'mm', 0, 'sovrapposizione'),
    p('verticalOverlap', 'Sovrapposizione verticale', 'Si sottrae al passo Y del vettore A (moduli che si sovrappongono).', 'num', 'mm', 0, 'sovrapposizione'),
    p('rowShiftX', 'Sfalsamento righe X', 'Si somma al passo X del vettore B (sfalsa una diagonale dalla successiva).', 'num', 'mm', 0, 'spostamento'),
    p('rowShiftY', 'Sfalsamento righe Y', 'Si somma al passo Y del vettore B (sfalsa una diagonale dalla successiva).', 'num', 'mm', 0, 'spostamento'),
    p('gridStartOffsetX', 'Partenza griglia X', 'Spostamento X del primo modulo rispetto all’angolo della griglia espansa.', 'num', 'mm', 2.8, 'spostamento', {}, 'startOffsetX'),
    p('gridStartOffsetY', 'Partenza griglia Y', 'Spostamento Y del primo modulo rispetto all’angolo della griglia espansa.', 'num', 'mm', 27.5, 'spostamento', {}, 'startOffsetY'),
    p('rotation', 'Rotazione moduli', 'Rotazione di ogni modulo attorno alla sua ancora.', 'num', 'deg', 0, 'angolo'),
    p('autoFillDiagonals', 'Numero di diagonali automatico', 'Se acceso il numero di diagonali si calcola per coprire il formato; se spento vale il numero di diagonali impostato.', 'bool', '', true, 'interruttore'),
    p('autoModulesPerDiagonal', 'Moduli per diagonale automatici', 'Se acceso il numero di moduli per diagonale si calcola per coprire il formato; se spento vale il numero impostato.', 'bool', '', true, 'interruttore'),
    p('diagonalCount', 'Numero di diagonali', 'Quante diagonali di moduli (usato se il calcolo automatico è spento).', 'int', '', 23, 'modulo', { min: 1 }),
    p('modulesPerDiagonal', 'Moduli per diagonale', 'Quanti moduli per diagonale (usato se il calcolo automatico è spento).', 'int', '', 35, 'modulo', { min: 1 }),
    p('moduleScale', 'Scala moduli', 'Fattore di scala dei moduli (vale per il Livello 1 e 2; Livello 0 e fori hanno la loro).', 'num', 'rapporto', 1, 'scala'),

    // --- ancora
    p('anchorMode', 'Ancora del modulo', 'Punto del modulo che si appoggia sulla griglia: centro del suo ingombro, manuale o origine del viewBox.', 'enum', '', 'bbox_center', 'modulo', { opzioni: ['bbox_center', 'manual', 'viewbox'] }),
    p('manualAnchorX', 'Ancora manuale X', 'Ancora X del modulo, usata con ancora manuale.', 'num', 'mm', 0, 'modulo'),
    p('manualAnchorY', 'Ancora manuale Y', 'Ancora Y del modulo, usata con ancora manuale.', 'num', 'mm', 0, 'modulo'),

    // --- micro-calibrazione per livello
    p('level0OffsetX', 'Livello 0, spostamento X', 'Micro-calibrazione fra i livelli: spostamento X del piazzamento (Livello 0).', 'num', 'mm', -6, 'spostamento'),
    p('level0OffsetY', 'Livello 0, spostamento Y', 'Micro-calibrazione fra i livelli: spostamento Y del piazzamento (Livello 0).', 'num', 'mm', 7.9, 'spostamento'),
    p('level0Scale', 'Livello 0, scala', 'Scala dei moduli del piazzamento (Livello 0).', 'num', 'rapporto', 1, 'scala'),
    p('level0AnchorX', 'Livello 0, ancora X', 'Ancora esplicita X del Livello 0 (opzionale).', 'num', 'mm', 0, 'modulo'),
    p('level0AnchorY', 'Livello 0, ancora Y', 'Ancora esplicita Y del Livello 0 (opzionale).', 'num', 'mm', 0, 'modulo'),
    p('level1OffsetX', 'Livello 1, spostamento X', 'Micro-calibrazione fra i livelli: spostamento X del fissaggio (Livello 1).', 'num', 'mm', 2.2, 'spostamento'),
    p('level1OffsetY', 'Livello 1, spostamento Y', 'Micro-calibrazione fra i livelli: spostamento Y del fissaggio (Livello 1).', 'num', 'mm', 4.8, 'spostamento'),
    p('level2OffsetX', 'Livello 2, spostamento X', 'Micro-calibrazione fra i livelli: spostamento X del ricamo oblique (Livello 2).', 'num', 'mm', 0, 'spostamento'),
    p('level2OffsetY', 'Livello 2, spostamento Y', 'Micro-calibrazione fra i livelli: spostamento Y del ricamo oblique (Livello 2).', 'num', 'mm', 0, 'spostamento'),
    p('holesOffsetX', 'Fori, spostamento X', 'Micro-calibrazione fra i livelli: spostamento X dei fori laser.', 'num', 'mm', -0.4, 'spostamento'),
    p('holesOffsetY', 'Fori, spostamento Y', 'Micro-calibrazione fra i livelli: spostamento Y dei fori laser.', 'num', 'mm', 6.7, 'spostamento'),
    p('holesScale', 'Fori, scala', 'Scala dei moduli dei fori laser.', 'num', 'rapporto', 1, 'scala'),
    p('holesAnchorX', 'Fori, ancora X', 'Ancora esplicita X dei fori (opzionale).', 'num', 'mm', 0, 'modulo'),
    p('holesAnchorY', 'Fori, ancora Y', 'Ancora esplicita Y dei fori (opzionale).', 'num', 'mm', 0, 'modulo'),

    // --- posizione globale
    p('globalPatternOffsetX', 'Offset X', 'Posizione del pattern: spostamento, non scala.', 'num', 'mm', 0, 'spostamento', { passo: 0.1 }),
    p('globalPatternOffsetY', 'Offset Y', 'Posizione del pattern: spostamento, non scala.', 'num', 'mm', 0, 'spostamento', { passo: 0.1 }),

    // --- rientri
    p('patternBorderOffset', 'Rientro taglio pattern', 'Rientro del rettangolo entro cui si realizza il pattern.', 'num', 'mm', 0, 'rientro', { min: 0, passo: 0.5 }),
    p('holesMargin', 'Rientro taglio fori', 'Rientro del rettangolo entro cui si realizzano fori, piazzamento e fissaggio.', 'num', 'mm', 0, 'rientro', { min: 0, passo: 0.5 }),

    // --- fori laser
    p('enableHolesLayer', 'Fori laser', 'Genera il livello dei fori laser (che filtrano piazzamento e fissaggio).', 'bool', '', true, 'fori-laser', { regole: ['R7'] }),
    p('holePerimeterToleranceMm', 'Tolleranza foro dal perimetro', 'Un foro resta se è dentro il boundary dei fori entro questa tolleranza.', 'num', 'mm', 2, 'tolleranza', { passo: 0.5, regole: ['R7'] }),
    p('pruneFeaturesWithoutHoles', 'Cerchi/zig-zag solo dove c’è il foro', 'Elimina dal pattern gli elementi che non hanno un foro corrispondente.', 'bool', '', false, 'fori-laser', { regole: ['R12'] }),
    p('trimDiagonalsToHoles', 'Diagonali L0/L1 solo dove ci sono fori', 'Limita le diagonali di piazzamento e fissaggio ai punti dove ci sono fori.', 'bool', '', false, 'fori-laser', { regole: ['R12'] }),
    p('holeMatchTolerance', 'Tolleranza abbinamento foro', 'Distanza entro cui un elemento si abbina al centro di un foro valido.', 'num', 'mm', 0.5, 'tolleranza'),

    // --- livelli
    p('enableLevel0', 'Livello 0 (piazzamento)', 'Genera il livello di piazzamento.', 'bool', '', true, 'interruttore'),
    p('enableLevel05', 'Impuntura di fissaggio prima dei cerchi (Livello 0.5)', 'Aggiunge l’impuntura di fissaggio prima dei cerchi.', 'bool', '', false, 'interruttore'),
    p('level05StitchLength', 'Lunghezza punto impuntura', 'Lunghezza dei punti dell’impuntura di fissaggio (Livello 0.5).', 'num', 'mm', 3, 'punto-corsa', { min: 1, passo: 0.5 }),

    // --- aree di esclusione
    p('enableExclusionAreas', 'Aree di esclusione interne', 'Le aree vuote interne al cartamodello non si ricamano.', 'bool', '', true, 'aree-vuote', { regole: ['R5'] }),
    p('reconnectVoidBorders', 'Ricollega i bordi delle aree di esclusione', 'Ricollega i bordi dei vuoti invece di sottrarre soltanto le aree.', 'bool', '', false, 'aree-vuote', { regole: ['R5'] }),

    // --- clip al perimetro
    p('cleanupMode', 'Modalità di pulizia al perimetro', 'Taglio netto (strict_clip) oppure sposta sul bordo i punti appena fuori (snap_to_edge, trim_and_close).', 'enum', '', 'strict_clip', 'ritaglio', { opzioni: ['strict_clip', 'snap_to_edge', 'trim_and_close'] }),
    p('cleanupTolerance', 'Tolleranza di pulizia', 'Tolleranza con cui un punto si considera dentro il perimetro.', 'num', 'mm', 0.25, 'tolleranza'),
    p('snapToEdgeDistance', 'Distanza di aggancio al bordo', 'Distanza entro cui un punto fuori bordo si sposta sul bordo (modalità snap/trim).', 'num', 'mm', 0.5, 'tolleranza'),
    p('perimeterCloseTolerance', 'Tolleranza di chiusura del perimetro', 'Tolleranza con cui si chiude il contorno del perimetro e si costruisce il suo grafo.', 'num', 'mm', 0.1, 'tolleranza'),
    p('level0ClipMode', 'Ritaglio Livello 0', 'strict_clip taglia netto al perimetro; le altre modalità tengono o scartano il modulo intero.', 'enum', '', 'strict_clip', 'ritaglio', { opzioni: CLIP }),
    p('level1ClipMode', 'Ritaglio Livello 1', 'strict_clip taglia netto al perimetro; le altre modalità tengono o scartano il modulo intero.', 'enum', '', 'strict_clip', 'ritaglio', { opzioni: CLIP }),

    // --- routing passaggi
    p('travelPathMode', 'Percorso dei passaggi', 'Border Following: i passaggi costeggiano il bordo; Straight: scorciatoie interne se consentite.', 'enum', '', 'Border Following', 'instradamento-passaggi', { opzioni: ['Border Following', 'Straight'], regole: ['R26'] }),
    p('travelRoutingStrategy', 'Strategia del giro sul bordo', 'Sceglie fra il giro orario e antiorario del bordo: il più corto valido, oppure forzato.', 'enum', '', 'shortest_valid', 'instradamento-passaggi', { opzioni: ['shortest_valid', 'clockwise', 'counter_clockwise'], regole: ['R26'] }),
    p('travelSideStrategy', 'Lato preferito del giro', 'Se nessun giro è valido o ci sono parità: auto, forzato orario/antiorario o preferenza per un lato (prefer_top/bottom/left/right).', 'testo', '', 'auto', 'instradamento-passaggi', { regole: ['R26'] }),
    p('allowInternalShortcuts', 'Scorciatoie interne', 'Con percorso Straight permette ai passaggi di attraversare l’interno invece di costeggiare il bordo.', 'bool', '', false, 'instradamento-passaggi', { regole: ['R26'] }),
    p('perimeterLaneWidth', 'Corsia sul perimetro', 'Larghezza della corsia dei passaggi rispetto al formato; 0 = i passaggi restano sul bordo, dentro il formato.', 'num', 'mm', 0, 'instradamento-passaggi', { regole: ['R26'] }),
    p('perimeterLaneTolerance', 'Tolleranza corsia sul perimetro', 'Distanza dal bordo entro cui un passaggio si considera sulla corsia.', 'num', 'mm', 1, 'tolleranza', { regole: ['R26'] }),
    p('technicalMaxTravelMm', 'Passaggio massimo tecnico', 'Distanza oltre cui il filo continuo si spezza fra due moduli; 0 = si calcola dal fattore di rottura.', 'num', 'mm', 0, 'instradamento-passaggi', { min: 0, regole: ['R26'] }),
    p('technicalGapBreakFactor', 'Fattore di rottura del salto', 'Moltiplicatore sul salto tipico fra moduli oltre il quale il filo si spezza (usato se il passaggio massimo è 0).', 'num', 'rapporto', 2.5, 'instradamento-passaggi', { min: 1, regole: ['R26'] }),
    p('routeAroundVoidsEnabled', 'Aggira le aree vuote', 'Devia i passaggi che attraversano un’area vuota lungo il suo bordo.', 'bool', '', false, 'instradamento-passaggi', { regole: ['R5'] }),

    // --- punti e scarico filo
    p('minimumTravelStitchLength', 'Lunghezza punti passaggi/bordi', 'Lunghezza dei punti dei passaggi che costeggiano il bordo.', 'num', 'mm', 2.25, 'punto-passaggio', { min: 1, passo: 0.05 }),
    p('minimumSegmentLength', 'Punto minimo globale', 'Punto minimo di tutto il ricamo, applicato dopo il routing: accorpa i punti più corti.', 'num', 'mm', 1, 'punto-minimo', { min: 1, passo: 0.1, regole: ['R3'] }),
    p('cutBorderStitchLength', 'Punto minimo bordi da taglio', 'Lunghezza dei punti sui bordi da taglio.', 'num', 'mm', 2.25, 'punto-minimo', { min: 1, passo: 0.1 }),
    p('startLockEnabled', 'Partenza dal bordo (scarico filo)', 'Fermatura del filo sul bordo a inizio e fine di ogni tratto.', 'bool', '', true, 'scarico-filo', { regole: ['R8'] }),
    p('startLockStitchMm', 'Punto partenza/ingresso', 'Lunghezza dei punti dello scarico filo e dell’ingresso.', 'num', 'mm', 2.25, 'scarico-filo', { min: 0.5, passo: 0.5, regole: ['R8'] }),
  ],
};

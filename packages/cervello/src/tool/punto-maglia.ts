import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Punto maglia (cartella apps/punto-maglia). Etichette e aiuti dal pannello (CAMPI in tool.ts) e dai commenti di
// apps/punto-maglia/src/motore.ts. Il tool salva i parametri in `params` (ParametriMaglia) con nomi italiani: restano.
// I default sono quelli del campione cucito (Lorenzo, 2026-10-19/20: sapere/decisioni/punto-maglia-cordoncino.md).
// Non sono parametri e non si registrano: `tratti` (le linee centrali disegnate a mano, con larghezza del centro,
// verso, inizio, mezza colonna e chiusura di ciascuno).
const P = (d: DichiarazioneParametro): DichiarazioneParametro => d;

export const scheda: SchedaParametri = {
  concetti: [
    { id: 'maglia-v', descrizione: 'La V del Punto maglia: larghezza di una colonna e altezza lungo il tratto.' },
  ],
  parametri: [
    P({ id: 'knitVWidth', nome: 'larghezzaVMm', etichetta: 'Larghezza della V', aiuto: 'Una colonna di V; il centro ne ha 1, 1,5 o 2.', tipo: 'num', unita: 'mm', min: 1, max: 6, predefinito: 2.5, concetto: 'maglia-v' }),
    P({ id: 'knitVHeight', nome: 'altezzaVMm', etichetta: 'Altezza della V', aiuto: 'Lungo il tratto, dalla base alla punta.', tipo: 'num', unita: 'mm', min: 1, max: 8, predefinito: 3.5, concetto: 'maglia-v' }),
    P({ id: 'knitRowPitch', nome: 'passoMm', etichetta: 'Passo delle righe', aiuto: 'Fra una riga di V e la successiva.', tipo: 'num', unita: 'mm', min: 0.5, max: 8, predefinito: 2.5, concetto: 'interlinea' }),
    P({ id: 'knitSideInset', nome: 'rientroMm', etichetta: 'Rientro dei lati', aiuto: 'Quanto la gamba del lato parte sotto il bordo del centro.', tipo: 'num', unita: 'mm', min: 0, max: 2, predefinito: 0.4, concetto: 'rientro' }),
    P({ id: 'knitCenterPasses', nome: 'passateCentro', etichetta: 'Passate del centro', aiuto: 'Per gamba; pari, così si torna sempre sulla punta.', tipo: 'int', unita: '', min: 2, max: 8, passo: 2, predefinito: 4, concetto: 'passate-pezzo' }),
    P({ id: 'knitSidePasses', nome: 'passateLati', etichetta: 'Passate dei lati', aiuto: 'Per gamba delle mezze catene ai lati (va e torna).', tipo: 'int', unita: '', min: 1, max: 6, passo: 1, predefinito: 2, concetto: 'passate-pezzo' }),
    P({ id: 'crossingMargin', nome: 'margineIncrocioMm', etichetta: 'Margine negli incroci', aiuto: 'Quanto oltre il bordo del tratto sopra si tolgono le righe di quello sotto.', tipo: 'num', unita: 'mm', min: -3, max: 5, predefinito: 0, concetto: 'sovrapposizione' }),
  ],
};

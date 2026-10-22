import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Broccato: salva `params` (BroccatoParams) in rgProject 'broccato'. Il blob `colors` (le righe di
// colore: hex, ruolo, densità, modo) non è un parametro e non si registra.
const p: DichiarazioneParametro[] = [
  // 01 Immagine
  { id: 'realWidthMm', etichetta: 'Larghezza reale del ricamo', aiuto: '0 = usa la stima al DPI qui sotto',
    tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, regole: ['R11'], concetto: 'misura-reale' },
  { id: 'dpiDefault', etichetta: 'DPI di stima', aiuto: 'DPI usato per stimare i mm quando la larghezza reale è 0.',
    senzaAiuto: true, tipo: 'int', unita: 'dpi', min: 1, passo: 1, predefinito: 96, regole: ['R11'], concetto: 'immagine' },
  { id: 'maxWidthPx', etichetta: 'Risoluzione di lavoro', aiuto: 'l\'immagine si analizza ridotta a questa larghezza',
    tipo: 'int', unita: 'px', min: 100, passo: 50, predefinito: 900, concetto: 'immagine' },

  // 02 Preparazione
  { id: 'flattenLightMm', etichetta: 'Pareggio della luce', aiuto: '0 = spento. Tienilo fra un quinto e un terzo del motivo',
    tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 15, concetto: 'immagine' },
  { id: 'smoothMm', etichetta: 'Attenuazione della grana', aiuto: 'spiana il tratteggio senza sbavare i contorni',
    tipo: 'num', unita: 'mm', min: 0, passo: 0.3, predefinito: 0.9, concetto: 'immagine' },
  { id: 'minBlobMm2', etichetta: 'Macchia più piccola', aiuto: 'sotto questa misura la macchia va al colore vicino',
    tipo: 'num', unita: 'mm2', min: 0, passo: 5, predefinito: 20, concetto: 'immagine' },

  // 03 Colori
  { id: 'colorCount', etichetta: 'Numero di colori', aiuto: 'da 4 a 8, base compresa',
    unitaTesto: 'aghi', tipo: 'int', unita: '', min: 4, max: 8, passo: 1, predefinito: 6, concetto: 'colori' },
  { id: 'paletteMode', etichetta: 'Da dove vengono le tinte', aiuto: 'Automatiche: le trova il sistema. Manuali: le scegli tu col contagocce, e non vengono più ricatturate.',
    tipo: 'enum', unita: '', opzioni: ['auto', 'manuale'], predefinito: 'auto', concetto: 'colori' },

  // 04 Punto
  { id: 'fillAngleDeg', etichetta: 'Orientamento delle righe', aiuto: '0 = orizzontale, uguale per tutti i colori',
    tipo: 'num', unita: 'deg', min: -90, max: 90, passo: 5, predefinito: 0, regole: ['R24'], concetto: 'angolo' },
  { id: 'maxStitchMm', etichetta: 'Lunghezza del punto', aiuto: 'Passo massimo lungo la riga: oltre si suddivide.',
    senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0.5, passo: 0.1, predefinito: 3, regole: ['R4'], concetto: 'punto-massimo' },
  { id: 'retraceOffsetMm', etichetta: 'Sfalsamento del ritorno', aiuto: 'solo a pettine: di quanto il ritorno evita i buchi dell\'andata',
    tipo: 'num', unita: 'mm', min: 0, passo: 0.05, predefinito: 0.1, concetto: 'spostamento' },
  { id: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'imposto alla fine, dopo i passaggi',
    tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1, regole: ['R3'], concetto: 'punto-minimo' },
  { id: 'endLockCount', etichetta: 'Fermatura di uscita', aiuto: '0 = nessuna. Nel riferimento sono 4, prima del cambio-colore',
    unitaTesto: 'punti', tipo: 'int', unita: '', min: 0, max: 8, passo: 1, predefinito: 4, regole: ['R8'], concetto: 'scarico-filo' },
  { id: 'endLockMm', etichetta: 'Lunghezza dei punti di fermatura', aiuto: 'Lunghezza dei punti della fermatura di uscita.',
    tipo: 'num', unita: 'mm', predefinito: 0.3, regole: ['R8'], concetto: 'scarico-filo' },

  // 05 Passaggi (nessun campo nel pannello)
  { id: 'travelStitchMm', etichetta: 'Passo dei passaggi', aiuto: 'Passo dei punti di passaggio.',
    tipo: 'num', unita: 'mm', predefinito: 3, concetto: 'punto-passaggio' },
  { id: 'voidClearanceMm', etichetta: 'Distanza di sicurezza', aiuto: 'Distanza di sicurezza dal bordo e dalle aree vuote.',
    tipo: 'num', unita: 'mm', predefinito: 0.3, regole: ['R5'], concetto: 'aree-vuote' },
];

export const scheda: SchedaParametri = { parametri: p };

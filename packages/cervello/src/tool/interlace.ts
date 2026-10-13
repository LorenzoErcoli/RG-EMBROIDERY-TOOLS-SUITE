import type { SchedaParametri } from '../tipi';

// I parametri del tool interlace (`params` del file di progetto). Default: defaultInterlaceParams (apps/interlace/src/engine.ts).
// Non registrati: colors, colorDensities, colorTolerances, zoneBans (liste, non scalari) — vedi rapporto K1.
export const scheda: SchedaParametri = {
  parametri: [
    {
      id: 'realWidth', nome: 'realWidthMm', etichetta: 'Larghezza reale (0 = auto)',
      aiuto: '0 = usa la misura letta dal file.',
      tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, regole: ['R11'], concetto: 'misura-reale',
    },
    {
      id: 'minStitch', nome: 'minStitchMm', etichetta: 'Punto minimo',
      aiuto: 'lunghezza minima di un passaggio',
      tipo: 'num', unita: 'mm', passo: 0.5, predefinito: 6, regole: ['R3'], concetto: 'punto-minimo',
    },
    {
      id: 'maxStitch', nome: 'maxStitchMm', etichetta: 'Lunghezza massima del punto',
      aiuto: 'i passaggi non superano questa misura',
      tipo: 'num', unita: 'mm', passo: 0.5, predefinito: 15, regole: ['R4'], concetto: 'punto-massimo',
    },
    {
      id: 'density', nome: 'densitySpacingMm', etichetta: 'Densità (distanza tra le file di filo)',
      aiuto: 'densità di ogni colore, ~0.8–4 mm: piccola = fitto; ~3 è il più rado ancora omogeneo (oltre si ammassa)',
      tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 2, regole: ['R22'], concetto: 'densita',
    },
    {
      id: 'voidClearance', nome: 'voidClearanceMm', etichetta: 'Distanza di sicurezza da bordi e vuoti',
      aiuto: 'distanza minima da bordi e aree vuote',
      tipo: 'num', unita: 'mm', passo: 0.1, predefinito: 0.6, regole: ['R5', 'R7'], concetto: 'aree-vuote',
    },
    {
      id: 'seed', nome: 'seed', etichetta: 'Variante',
      aiuto: 'stessa variante = stesso identico pattern; cambiala per una disposizione diversa (riproducibile, non casuale)',
      tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 1, concetto: 'seme',
    },
    {
      id: 'paletteCycles', nome: 'paletteCycles', etichetta: 'Ripetizioni della sequenza',
      aiuto: 'quante volte l’intera sequenza di colori si ripete lungo il tracciato (genera i cambi-ago)',
      tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 1, concetto: 'colori',
    },
    {
      id: 'clusterMode', nome: 'clusterMode', etichetta: 'Distribuzione dei colori',
      aiuto: 'Uniforme: mélange omogeneo. Agglomerati: ogni colore si addensa in zone → sfumature di colore.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'colori',
    },
    {
      id: 'clusterStrength', nome: 'clusterStrength', etichetta: 'Intensità agglomerati',
      aiuto: 'quanto i colori si separano in zone: basso = appena accennate, alto = molto marcate',
      tipo: 'num', unita: '%', min: 0, max: 100, passo: 5, predefinito: 60, concetto: 'colori',
    },
    {
      id: 'zoneOverlap', nome: 'zoneOverlapMm', etichetta: 'Sormonto ai bordi delle zone',
      aiuto: 'di quanto un filo sconfina oltre il bordo di una zona vietata, posandoci una passata, perché due colori testa a testa non lascino una fessura. Vuoto (null) = automatico: 0,6 × la densità, una fila di celle. 0 = confine netto.',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: null, concetto: 'sovrapposizione',
    },
    {
      id: 'maxStitchesPerArea', nome: 'maxStitchesPerMm2', etichetta: 'Tetto ai punti (buchi d’ago per mm²)',
      aiuto: 'quanti punti al massimo può prendere lo stesso millimetro quadro, contando tutti i colori insieme: è lì che il filo si spezza e l’ago soffre. Vuoto (null) = automatico. 0 = nessun tetto.',
      tipo: 'int', unita: '', min: 0, passo: 1, predefinito: null, concetto: 'altro',
    },
    {
      id: 'excludeBackground', nome: 'excludeBackground', etichetta: 'Lascia lo sfondo senza ricamo',
      aiuto: 'i punti dell’immagine vicini al colore di sfondo restano tessuto a vista: nessun filo ci cuce e nessuno ci passa sopra.',
      tipo: 'bool', unita: '', predefinito: false, concetto: 'immagine',
    },
    {
      id: 'backgroundColor', nome: 'backgroundColor', etichetta: 'Colore dello sfondo',
      aiuto: 'il colore dei punti dell’immagine che restano senza ricamo (con “Lascia lo sfondo senza ricamo”).',
      tipo: 'testo', unita: '', predefinito: '#ffffff', concetto: 'immagine',
    },
    {
      id: 'backgroundTolerance', nome: 'backgroundToleranceRgb', etichetta: 'Tolleranza dello sfondo (distanza RGB)',
      aiuto: 'quanto è largo il raggio attorno al colore di sfondo.',
      tipo: 'num', unita: '', min: 0, passo: 5, predefinito: 30, concetto: 'immagine',
    },
  ],
};

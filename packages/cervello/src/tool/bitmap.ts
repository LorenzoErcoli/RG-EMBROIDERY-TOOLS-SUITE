import type { SchedaParametri } from '../tipi';

// Bitmap → Stitch: i parametri che il tool salva in `params` (metadata rgProject 'bitmap').
// Non registrati (liste, non parametri scalari): sampleColors, manualColors, manualTolerances.
export const scheda: SchedaParametri = {
  parametri: [
    // --- 01 selezione dei pixel ---
    { id: 'coverage', etichetta: 'Cosa punciare', aiuto: 'Solo i colori scelti: in automatico usa la soglia, in manuale i pixel vicini ai colori scelti. Tutta l\'immagine: riempie tutto, ogni pixel col colore più vicino.',
      tipo: 'enum', unita: '', opzioni: ['selected', 'all'], predefinito: 'selected', concetto: 'immagine' },
    { id: 'threshold', etichetta: 'Soglia di selezione', aiuto: 'un pixel è scelto se più scuro della soglia (0–255); più alta = include più pixel chiari',
      unitaTesto: 'lum', tipo: 'int', unita: '', min: 0, max: 255, passo: 5, predefinito: 200, concetto: 'immagine' },
    { id: 'sampleToleranceRgb', etichetta: 'Tolleranza colore', aiuto: 'Tolleranza dei colori campionati, come distanza RGB euclidea.',
      tipo: 'num', unita: '', min: 0, predefinito: 24, concetto: 'immagine' },
    { id: 'excludeBackground', etichetta: 'Escludi un colore di sfondo', aiuto: 'Toglie dalla selezione i pixel dei colori di sfondo.',
      tipo: 'bool', unita: '', predefinito: true, concetto: 'immagine' },
    { id: 'backgroundColors', etichetta: 'Colori di sfondo', aiuto: 'Colori di sfondo da togliere dalla selezione (esadecimali separati da virgola).',
      senzaAiuto: true, tipo: 'testo', unita: '', predefinito: '#FFFFFF', concetto: 'immagine' },
    { id: 'backgroundToleranceRgb', etichetta: 'Tolleranza sfondo', aiuto: 'Tolleranza dei colori di sfondo, come distanza RGB.',
      senzaAiuto: true, unitaTesto: 'rgb', tipo: 'num', unita: '', min: 0, passo: 1, predefinito: 30, concetto: 'immagine' },
    // --- 03 colori ---
    { id: 'paletteMode', etichetta: 'Colori dei livelli', aiuto: 'Automatici: l\'algoritmo sceglie i colori. Manuale: li prendi dall\'immagine col contagocce, ognuno con la sua tolleranza; i pixel vicini ci rientrano.',
      tipo: 'enum', unita: '', opzioni: ['auto', 'manual'], predefinito: 'auto', concetto: 'colori' },
    { id: 'colorCount', etichetta: 'Numero di colori (cambi-ago)', aiuto: 'in quante tinte separare l\'immagine (quantizzazione)',
      unitaTesto: '#', tipo: 'int', unita: '', min: 1, max: 16, passo: 1, predefinito: 2, concetto: 'colori' },
    // --- 04 riempimento ---
    { id: 'densitySpacingMm', etichetta: 'Distanza tra i punti', aiuto: 'quanto sono distanti i punti: piccola = fitto (più punti), grande = rado (meno punti); 0 = piena risoluzione',
      tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 1.2, regole: ['R22'], concetto: 'densita' },
    { id: 'minStitchMm', etichetta: 'Punto minimo', aiuto: 'Punto minimo, applicato dopo l\'ordinamento.',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0, passo: 0.5, predefinito: 1.0, regole: ['R3'], concetto: 'punto-minimo' },
    { id: 'reinsertionRounds', etichetta: 'Reinserimenti', aiuto: 'Tentativi di reinserire i punti troppo vicini.',
      senzaAiuto: true, unitaTesto: 'giri', tipo: 'int', unita: '', min: 0, passo: 1, predefinito: 1, concetto: 'punto-minimo' },
    { id: 'maxPoints', etichetta: 'Tetto punti (0 = off)', aiuto: 'Tetto globale di punti (0 = nessun tetto).',
      senzaAiuto: true, unitaTesto: '#', tipo: 'int', unita: '', min: 0, passo: 500, predefinito: 0, concetto: 'altro' },
    { id: 'targetDensityPct', etichetta: 'Densità obiettivo (0 = off)', aiuto: 'Usa questa percentuale dei punti disponibili (0 = off).',
      senzaAiuto: true, tipo: 'num', unita: '%', min: 0, max: 100, passo: 1, predefinito: 0, concetto: 'densita' },
    // --- 05 stile e percorso ---
    { id: 'style', etichetta: 'Distribuzione dei punti', aiuto: 'Regolare: griglia uniforme. Degradé: scarto e spostamento casuali per un effetto sfumato.',
      tipo: 'enum', unita: '', opzioni: ['carpet', 'degrade'], predefinito: 'carpet', concetto: 'variazione' },
    { id: 'degradeDrop', etichetta: 'Scarto casuale', aiuto: 'Probabilità di scartare ciascun punto (solo degradé).',
      senzaAiuto: true, unitaTesto: '0–1', tipo: 'num', unita: 'rapporto', min: 0, max: 1, passo: 0.05, predefinito: 0.3, concetto: 'variazione' },
    { id: 'degradeJitterMm', etichetta: 'Spostamento casuale', aiuto: 'Ampiezza massima dello spostamento casuale (solo degradé).',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0, passo: 0.1, predefinito: 0.4, concetto: 'variazione' },
    { id: 'seed', etichetta: 'Variante', aiuto: 'stessa variante = stesso identico risultato (riproducibile)',
      unitaTesto: '#', tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 1, concetto: 'seme' },
    { id: 'ordering', etichetta: 'Ordinamento del percorso', aiuto: 'A righe: veloce e regolare. Più vicino: percorso più corto ma pesante su molte migliaia di punti.',
      tipo: 'enum', unita: '', opzioni: ['scanline', 'nearest'], predefinito: 'scanline', concetto: 'ordine-cucitura' },
    { id: 'scanlineBandMm', etichetta: 'Altezza banda (a righe)', aiuto: 'Altezza della banda dell\'ordinamento a righe.',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0.2, passo: 0.2, predefinito: 1.6, concetto: 'ordine-cucitura' },
    { id: 'serpentine', etichetta: 'Righe a serpentina (alterna il verso)', aiuto: 'Con l\'ordinamento a righe alterna il verso riga per riga (meno salti lunghi).',
      tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' },
    // --- scala / import / export ---
    { id: 'realWidthMm', etichetta: 'Larghezza reale (0 = auto)', aiuto: 'Larghezza reale della sagoma (0 = usa la stima dai dpi); fissa la scala mm/px.',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0, passo: 1, predefinito: 0, regole: ['R11'], concetto: 'misura-reale' },
    { id: 'dpiEstimate', etichetta: 'DPI di stima', aiuto: 'DPI di stima quando la larghezza reale è 0.',
      senzaAiuto: true, tipo: 'int', unita: 'dpi', min: 1, passo: 1, predefinito: 96, concetto: 'misura-reale' },
    { id: 'maxWidthPx', etichetta: 'Risoluzione di lavoro', aiuto: 'l\'immagine viene ridotta a questa larghezza per la resa (0 = nativa); più bassa = più veloce',
      tipo: 'int', unita: 'px', min: 0, passo: 50, predefinito: 1000, concetto: 'immagine' },
    { id: 'chunkSize', etichetta: 'Punti massimi per tracciato', aiuto: 'spezza i tracciati lunghi per Illustrator (R6); 0 = nessun taglio',
      unitaTesto: '#', tipo: 'int', unita: '', min: 0, passo: 500, predefinito: 5000, regole: ['R6'], concetto: 'altro' },
  ],
};

// Il debito del registro: i parametri che un tool SALVA e che il registro non descrive ancora.
//
// Il cricchetto (test/smoke.mjs, «K1 — il registro dei parametri») fa tre cose:
//   1. un parametro che un tool salva e non sta né nel registro né qui → il test FALLISCE;
//   2. un parametro che sta qui ma ormai è nel registro (o il tool non lo salva più) → FALLISCE: la voce va tolta;
//   3. la lunghezza di questa lista deve coincidere con `DEBITO_ATTUALE` nello smoke test: la lista può solo
//      scendere (per aggiungere qui serve alzare quel numero, e si vede).
//
// Chiave = tool, valore = percorsi nel file di progetto (`nome` per i `params`, `dove.nome` per il resto),
// ognuno col suo perché non è registrato.
export const DEBITO: Record<string, Record<string, string>> = {
  'net-45': {
    satinDensityMm: 'Salvato ma nessun codice lo legge e il pannello non lo mostra: «rasi per ora come forme» (params.ts di core). Il significato non è verificabile.',
    squareDensityMm: 'Come satinDensityMm: salvato, mai letto, nessuna etichetta.',
    clipStepMm: 'Salvato sotto «pulizia / clip» ma nessun codice lo legge e il pannello non lo mostra.',
  },
  interlace: {
    colors: 'Lista (palette di tinte): il registro non ha ancora un tipo lista.',
    colorDensities: 'Lista di densità per colore (parallela a colors): serve il tipo lista. È un parametro vero, non un dato.',
    colorTolerances: 'Lista di raggi di cattura per colore (parallela a colors): serve il tipo lista.',
    zoneBans: 'Matrice filo × zona di divieti di transito: serve il tipo lista.',
  },
  bitmap: {
    sampleColors: 'Lista di colori campionati: serve il tipo lista. Il pannello non la imposta mai.',
    manualColors: 'Lista (palette manuale scelta col contagocce): serve il tipo lista.',
    manualTolerances: 'Lista di tolleranze per colore (parallela a manualColors): serve il tipo lista.',
  },
  pettine: {
    larghezzaRealeMm: 'Salvato alla radice del progetto, non in `par`: il registro non ha ancora un posto per i parametri alla radice. Concetto: misura-reale (R11).',
    ritaglio: 'Riquadro {x, y, larghezza, altezza} alla radice del progetto: oggetto, non scalare.',
  },
};

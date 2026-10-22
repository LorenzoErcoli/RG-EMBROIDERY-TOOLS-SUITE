import type { SchedaParametri } from '../tipi';

// Sfrangiatura: salva `params` (7 chiavi) e `zone` (i poligoni marcati col pennello: blob, non è un parametro).
// Non salvati e quindi non registrati: puntoMassimoMm, filaMinimaSfrangiabileMm, modo (opzioni di motore senza pannello),
// aghiEsclusi (stato dell'interfaccia, non nei params).
export const scheda: SchedaParametri = {
  parametri: [
    {
      id: 'fringeLengthMin', nome: 'lunghezzaMinMm', etichetta: 'Lunghezza min',
      aiuto: 'Lunghezza della frangia: estratta a caso fra il minimo e il massimo.',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0, max: 12, passo: 0.5, predefinito: 2, concetto: 'variazione',
    },
    {
      id: 'fringeLengthMax', nome: 'lunghezzaMaxMm', etichetta: 'Lunghezza max',
      aiuto: 'Lunghezza della frangia: estratta a caso fra il minimo e il massimo.',
      senzaAiuto: true, tipo: 'num', unita: 'mm', min: 0, max: 12, passo: 0.5, predefinito: 6, concetto: 'variazione',
    },
    {
      id: 'fringeOpeningMin', nome: 'aperturaMinDeg', etichetta: 'Apertura min',
      aiuto: 'Di quanto la frangia si scosta dalla sua fila. Il verso alterna fra frange vicine: è così che nasce la X. A 0 restano parallele.',
      senzaAiuto: true, tipo: 'num', unita: 'deg', min: 0, max: 80, passo: 1, predefinito: 10, concetto: 'angolo',
    },
    {
      id: 'fringeOpeningMax', nome: 'aperturaMaxDeg', etichetta: 'Apertura max',
      aiuto: 'Di quanto la frangia si scosta dalla sua fila. Il verso alterna fra frange vicine: è così che nasce la X. A 0 restano parallele.',
      senzaAiuto: true, tipo: 'num', unita: 'deg', min: 0, max: 80, passo: 1, predefinito: 30, concetto: 'angolo',
    },
    {
      id: 'fringeOverlap', nome: 'sormontoMm', etichetta: 'Sormonto',
      aiuto: 'quanto ogni frangia entra di sicuro nella macchia vicina: alza il minimo, non il massimo',
      tipo: 'num', unita: 'mm', min: 0, max: 10, passo: 0.5, predefinito: 0, concetto: 'sovrapposizione',
    },
    {
      id: 'seed', nome: 'seme', etichetta: 'Variante',
      aiuto: 'Stessa variante = stesso identico ricamo. Cambiala per un\'altra estrazione di lunghezze e aperture.',
      unitaTesto: '#', tipo: 'int', unita: '', min: 1, max: 9999, passo: 1, predefinito: 1, concetto: 'seme',
    },
    {
      id: 'brushWidth', nome: 'pennelloMm', etichetta: 'Pennello',
      aiuto: 'è il raggio d\'azione: si sfrangia solo dove passi',
      tipo: 'num', unita: 'mm', min: 0.5, max: 40, passo: 0.5, predefinito: 6, concetto: 'altro',
    },
  ],
};

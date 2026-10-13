import type { Concetto } from './tipi';

// I concetti di mestiere comuni. Un concetto raggruppa i parametri «parenti» che oggi hanno nomi
// (e a volte misure) diverse nei vari tool: il registro li mette uno accanto all'altro, unificarli
// è una decisione per tool (D4, regola 7 di ARCHITETTURA). Se ne serve uno nuovo lo dichiara il file
// del tool (`concetti`), e deve avere una descrizione.
export const CONCETTI: Concetto[] = [
  { id: 'densita', descrizione: 'Spaziatura TRASVERSALE in mm fra file di filo adiacenti (R22).' },
  { id: 'interlinea', descrizione: 'Passo LONGITUDINALE fra due punti consecutivi lungo il filo, del cordoncino (R30).' },
  { id: 'punto-minimo', descrizione: 'Lunghezza minima di un punto; si applica dopo il routing (R3).' },
  { id: 'punto-massimo', descrizione: 'Lunghezza massima di un punto: oltre si suddivide (R4).' },
  { id: 'punto-passaggio', descrizione: 'Lunghezza dei punti di un passaggio/travel (visibile o nascosto).' },
  { id: 'punto-corsa', descrizione: 'Passo longitudinale del punto corsa o dei punti di un riempimento.' },
  { id: 'larghezza-punto', descrizione: 'Larghezza di un punto pieno: cordoncino, raso, zig-zag, croce.' },
  { id: 'misura-reale', descrizione: 'Misura fisica del pezzo o della sagoma (larghezza reale, R11).' },
  { id: 'formato', descrizione: 'Misure del pannello/piano di lavoro (larghezza, altezza, origine).' },
  { id: 'scala', descrizione: 'Un fattore di scala (percentuale o rapporto) applicato a misure o moduli.' },
  { id: 'angolo', descrizione: 'Orientamento di righe, diagonali, tratti o moduli, in gradi.' },
  { id: 'rientro', descrizione: 'Distanza di un elemento dal bordo/contorno (inset, margine).' },
  { id: 'spostamento', descrizione: 'Traslazione di un elemento o di una griglia (offset).' },
  { id: 'sovrapposizione', descrizione: 'Quanto due elementi si sovrappongono o si sormontano.' },
  { id: 'tolleranza', descrizione: 'Soglia di geometria: pulizia, snap, dedup, chiusura, abbinamento.' },
  { id: 'passaggi-nascosti', descrizione: 'Passaggi che si nascondono sotto il ricamo successivo (R16–R21): mappa di copertura, pesi, bypass.' },
  { id: 'scarico-filo', descrizione: 'Fermatura/scarico del filo a inizio e fine corsa (R8).' },
  { id: 'tiraggio', descrizione: 'Compensazione del tiro: allunga le passate perché il filo si ritira (R19).' },
  { id: 'aree-vuote', descrizione: 'Aree di esclusione e distanze da esse (R5).' },
  { id: 'seme', descrizione: 'Seme del caso: stesso seme, stesso ricamo.' },
  { id: 'variazione', descrizione: 'Quanto un valore varia (irregolarità, jitter, gradiente) rispetto al regolare.' },
  { id: 'immagine', descrizione: 'Trattamento dell’immagine in ingresso: soglia, palette, colori, dettaglio.' },
  { id: 'colori', descrizione: 'Numero, ordine o scelta dei colori/fili.' },
  { id: 'ordine-cucitura', descrizione: 'In che ordine e verso si cuce: direzione, serpentina, ripassi, salti.' },
  { id: 'modulo', descrizione: 'Forma e misure del modulo ripetuto di un pattern (zig-zag, rombo, cella).' },
  { id: 'interruttore', descrizione: 'Un’opzione acceso/spento che non è una misura.' },
  { id: 'altro', descrizione: 'Non ancora raggruppato: da assegnare quando due tool lo condividono.' },
];

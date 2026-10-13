import type { DichiarazioneParametro, SchedaParametri } from '../tipi';

// Punto croce (cross-stitch): i parametri che il tool salva nel progetto (`rgProject: 'cross-stitch'`)
// nelle chiavi `grid`, `route` (e i suoi sotto-oggetti `zones`, `strips`, `costs`), `stitch`, `knit`.
// Non sono parametri ma dati/blob, e restano fuori: `threads`, `cells`, `area`, `cuts`, `forced`,
// `module`, `shape`, e dentro `route`: base, groups, areas, passesByColor, pieceOf, mask, ecc.
const grid = (d: Omit<DichiarazioneParametro, 'dove'>): DichiarazioneParametro => ({ ...d, dove: 'grid' });
const route = (d: Omit<DichiarazioneParametro, 'dove'>): DichiarazioneParametro => ({ ...d, dove: 'route' });

const p: DichiarazioneParametro[] = [
  // 02 Misure del ricamo (griglia)
  grid({ id: 'gridCols', nome: 'cols', etichetta: 'Colonne', aiuto: 'Quante colonne di punti ha la griglia: una colonna = un punto. Si ricavano dalla larghezza del ricamo e dalla larghezza della cella.',
    tipo: 'int', unita: '', min: 1, max: 1000, passo: 1, predefinito: 24, concetto: 'formato' }),
  grid({ id: 'gridRows', nome: 'rows', etichetta: 'Righe', aiuto: 'Quante righe ha la griglia. Si ricavano dall’altezza del ricamo, dall’altezza della cella e dal sormonto.',
    tipo: 'int', unita: '', min: 1, max: 1000, passo: 1, predefinito: 16, concetto: 'formato' }),
  grid({ id: 'cellWidthMm', nome: 'cellW', etichetta: 'Larghezza cella', aiuto: 'Larghezza della cella = larghezza del punto.',
    tipo: 'num', unita: 'mm', min: 0.5, predefinito: 5, concetto: 'larghezza-punto' }),
  grid({ id: 'cellHeightMm', nome: 'cellH', etichetta: 'Altezza cella', aiuto: 'Altezza della cella.',
    tipo: 'num', unita: 'mm', min: 0.5, predefinito: 5, concetto: 'formato' }),
  grid({ id: 'rowOverlapPct', nome: 'overlapPct', etichetta: 'Sormonto righe', aiuto: 'Solo in verticale: le V si infilano. 0 = le righe si toccano, 40 = ogni riga sale del 40% dentro quella di sopra.',
    tipo: 'num', unita: '%', min: 0, max: 90, predefinito: 0, concetto: 'sovrapposizione' }),

  // 04 Passaggi
  route({ id: 'passes', nome: 'repetitions', etichetta: 'Passate su ogni diagonale', aiuto: 'Passate su ogni diagonale (avanti e indietro). Nel pannello le passate si scelgono per filo; questo vale dove il filo non ha le sue.',
    tipo: 'int', unita: '', min: 1, passo: 1, predefinito: 1, concetto: 'ordine-cucitura' }),
  route({ id: 'fixedDirection', etichetta: 'Direzione fissa', aiuto: 'Ogni diagonale si cuce solo nel suo verso («\\» dall’alto, «/» dal basso), come nella vecchia app.',
    tipo: 'bool', unita: '', predefinito: false, concetto: 'ordine-cucitura' }),
  route({ id: 'topLeg', etichetta: 'Gamba sopra nella croce', aiuto: 'La gamba che sta sopra nella croce.',
    tipo: 'enum', unita: '', opzioni: ['down', 'up'], predefinito: 'down', concetto: 'ordine-cucitura' }),
  route({ id: 'jumpMm', etichetta: 'Salta oltre', aiuto: 'Oltre questo costo di passaggio (circa mm in vista) si salta: taglio e ripartenza.',
    tipo: 'num', unita: 'mm', min: 0, predefinito: 400, concetto: 'ordine-cucitura' }),
  route({ id: 'passOrder', etichetta: 'Le passate', aiuto: 'Come si distribuiscono le passate. Lungo la riga: ogni passata è un pezzo a sé. Tutte sulla stessa V: tutte le passate sullo stesso punto prima del successivo. Automatico: per ogni filo, sulla stessa V con passate dispari, lungo la riga con pari.',
    tipo: 'enum', unita: '', opzioni: ['row', 'stitch', 'auto'], predefinito: 'auto', concetto: 'ordine-cucitura' }),
  route({ id: 'byBlocks', nome: 'blocks', etichetta: 'Per blocchi di colore', aiuto: 'Finisce ogni zona di un colore prima di passare alla successiva.',
    tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' }),
  route({ id: 'baseWhole', etichetta: 'Base in un solo stop', aiuto: 'A strisce: la base intera per prima, poi le strisce degli altri fili. Spento: una base per striscia.',
    tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' }),
  route({ id: 'trimJumps', etichetta: 'Taglio a ogni salto', aiuto: 'Nel DST ogni salto porta il taglio: nel programma di ricamo i pezzi arrivano separati. Spento: il taglio solo ai salti messi a mano.',
    tipo: 'bool', unita: '', predefinito: true, concetto: 'ordine-cucitura' }),
  { id: 'zoneGapMm', nome: 'gapMm', dove: 'route.zones', etichetta: 'Vuoto che separa', aiuto: 'Vuoto minimo per tagliare una zona: più alto, zone più grandi.',
    tipo: 'num', unita: 'mm', min: 0, predefinito: 5, concetto: 'ordine-cucitura' },
  { id: 'zoneMaxMm', nome: 'maxMm', dove: 'route.zones', etichetta: 'Zona massima', aiuto: 'Oltre questa misura una zona si taglia comunque, sulla linea meno piena.',
    tipo: 'num', unita: 'mm', min: 10, predefinito: 100, concetto: 'ordine-cucitura' },
  { id: 'stripRows', nome: 'rows', dove: 'route.strips', etichetta: 'Strisce', aiuto: 'Righe per striscia: ogni striscia ha i suoi colori, poi la successiva. 0 = tutto insieme.',
    tipo: 'int', unita: '', min: 0, passo: 1, predefinito: 0, concetto: 'ordine-cucitura' },
  { id: 'stripShiftMm', nome: 'shiftMm', dove: 'route.strips', etichetta: 'Ritiro fra strisce', aiuto: 'Compensazione del ritiro: la striscia k scende (o sale) di k volte questa misura nel file. Più allontana, meno avvicina.',
    tipo: 'num', unita: 'mm', predefinito: 0, concetto: 'spostamento' },
  { id: 'retraceCost', nome: 'retrace', dove: 'route.costs', etichetta: 'Per spostarsi', aiuto: 'Costo di passare sopra una diagonale dello stesso colore già cucita. Nel pannello tre scelte: meno in vista (0,1), equilibrio (0,25), meno ripassi (0,4). Meno ripassi sui propri punti costano più filo in vista sugli altri colori.',
    tipo: 'num', unita: '', min: 0, predefinito: 0.1, concetto: 'ordine-cucitura' },

  // 05 Macchina
  { id: 'maxStitchMm', dove: 'stitch', etichetta: 'Punto massimo', aiuto: 'Il punto più lungo che la macchina fa: oltre, la diagonale si spezza in punti uguali.',
    tipo: 'num', unita: 'mm', min: 1, max: 12, predefinito: 7, regole: ['R4'], concetto: 'punto-massimo' },
  { id: 'travelStitchMm', dove: 'stitch', etichetta: 'Punto dei passaggi', aiuto: 'Il punto dei passaggi (corsa sotto il ricamo).',
    tipo: 'num', unita: 'mm', min: 0.5, max: 12, predefinito: 2.5, concetto: 'punto-passaggio' },

  // 01 Immagine (come si legge l'immagine)
  { id: 'knitDetailPct', nome: 'detailPct', dove: 'knit', etichetta: 'Soglia del dettaglio', aiuto: 'Più bassa salva i tratti sottili.',
    tipo: 'num', unita: '%', min: 1, max: 100, predefinito: 35, concetto: 'immagine' },
  { id: 'knitStitch', nome: 'stitch', dove: 'knit', etichetta: 'Punto', aiuto: 'Il punto con cui la maglia dall’immagine riempie le celle (V, Λ, croce, diagonale discendente o ascendente).',
    tipo: 'enum', unita: '', opzioni: ['v', 'lambda', 'cross', 'down', 'up'], predefinito: 'v', concetto: 'immagine' },
];

export const scheda: SchedaParametri = { parametri: p };

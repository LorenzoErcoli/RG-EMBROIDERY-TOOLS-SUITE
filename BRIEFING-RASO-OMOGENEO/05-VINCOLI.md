# Vincoli — cosa non si negozia, e cosa invece sì

## Vincoli veri: la macchina e il filo

Questi vengono dalla fisica del ricamo industriale. Non sono scelte.

1. **Il punto ha una lunghezza minima e una massima.** Sotto ~1 mm l'ago rientra troppo vicino al
   foro precedente e strappa il tessuto; sopra ~3 mm il filo resta lasco e si impiglia. Un
   riempimento produce *punti*, non curve: qualunque curva va poi suddivisa entro il massimo.

2. **Il minimo si impone DOPO aver deciso il percorso, mai prima.** Unire due tratti crea nuove
   giunzioni, e sono quelle a reintrodurre i micro-punti. E togliere un punto in mezzo unisce due
   tratti e può sforare il massimo: si rimette suddividendo, che non sposta geometria.
   *(Regola R3/R4 della Costituzione del progetto.)*

3. **Il filo di collegamento deve finire sotto il ricamo che verrà dopo.** Un passaggio scoperto si
   vede sul davanti. Solo l'ultimo colore non ha niente sopra, e lì — se non c'è alternativa — si
   taglia il filo. *(R16.)*

4. **Un colore è un ago è un filato.** L'ordine di cucitura va dal più scuro al più chiaro, e ogni
   colore si cuce tutto prima di passare al successivo. Non si può alternare.

5. **La densità si esprime come spaziatura trasversale in mm** fra due file adiacenti — non come
   «punti per centimetro», non come interlinea lungo il filo. Sono due misure diverse e confonderle
   è un errore ricorrente. *(R22, R30.)*

6. **L'unità è il millimetro reale**, ovunque, dall'inizio alla fine. Nessun passaggio in pixel o in
   unità arbitrarie.

7. **La sorgente è un'immagine raster.** Non c'è un vettore e non ci sarà: il committente è stato
   esplicito — «il sistema deve reggere proprio senza SVG, perché se riusciamo a usare immagini per
   fare queste cose è figo». Ogni metodo deve partire da pixel o da poligoni derivati da pixel.

8. **Determinismo.** Stessi parametri, stesso ricamo, su qualunque macchina. Niente `Math.random`,
   niente `Math.sin` per generare disturbo: se serve casualità, deve venire da un hash intero della
   posizione.

## Vincoli di progetto, negoziabili ma con un costo

9. Il codice è **TypeScript, ESM, senza dipendenze** nel pacchetto core, e gira sia in Node sia nel
   browser. Nessun DOM nei motori. Una libreria esterna è possibile ma va argomentata.

10. Il motore deve stare **sotto il secondo** su un'area di qualche centimetro quadrato, e sotto il
    minuto sul disegno intero (353 mm). Oggi: 45 s sul disegno intero.

11. Il risultato finale è una lista di **polilinee in millimetri**, una per corsa, in ordine di
    cucitura. Da lì in poi la catena (serpentina, passaggi, esportazione DST) esiste già e funziona.

## Non vincoli — tutto questo si può buttare

- il **campo di direzione armonico** e il modo in cui è costruito;
- il riempimento **dalla rotaia**, i cunei, la troncatura, le ombre, la chiusura dei vuoti;
- il riempimento **a distanza costante** (Jobard & Lefer);
- il riempimento per **curve di livello**;
- l'idea stessa che ci sia un «campo di direzione» da cui derivare le corse;
- la **tracciatura delle macchie** com'è fatta oggi, e il fatto che una macchia sia una sola area
  connessa. Spezzarle in fasce è esplicitamente la direzione che il committente vuole esplorare;
- la **crescita** delle macchie l'una sotto l'altra, e le sue misure;
- qualunque parametro numerico.

## Una nota sul metodo, che qui vale come vincolo

Nessun numero si accende senza una misura che lo giustifichi, e una misura sola non basta a scegliere
un default: bisogna chiedersi **cosa peggiora mentre quella migliora**. Più volte in questo lavoro un
numero che migliorava nascondeva un altro che crollava — la troncatura a 0,9 toglie gli addensamenti
e apre i buchi; le curve di livello fanno esattamente lo stesso. `06` misura le due code apposta.

E: **la resa viene prima delle misure.** Misure verdi su un ricamo brutto non contano. È già
successo, ed è il motivo per cui gli strumenti producono anche i disegni.

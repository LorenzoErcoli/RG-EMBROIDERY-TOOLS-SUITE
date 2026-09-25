# Manuale — RG Embroidery Tools

Guida d'uso agli strumenti della suite. Ogni tool genera un **tracciato di ricamo** a partire da una sagoma o da un'immagine, e lo esporta per Illustrator/Stilista (**SVG**) o per la macchina (**DST**). Non serve installare nulla: si apre nel browser.

---

## Concetti comuni a tutti gli strumenti

Valgono ovunque; le sezioni dei singoli tool danno per scontate queste cose.

**Il cartamodello (sagoma).** Dove c'è la sezione *Cartamodello*/*Sagoma*, carichi un file **DXF o SVG** col contorno del pezzo. Se il file non dichiara la sua misura fisica, usa il campo **Larghezza reale (mm)**: è la fonte di verità, il disegno viene scalato a quella misura. `0` = usa la misura letta dal file.

**Colori → ruoli.** Ogni colore del cartamodello è un *ruolo*, non una decorazione. Nella sezione *Colori e ruoli* assegni a ciascun colore cosa rappresenta (perimetro, area da riempire, area vuota, bordo…). Il campione è sempre accompagnato dal **codice colore** e dal numero di contorni, così due colori simili non si confondono. `— (ignora)` esclude quel colore.

**Aree vuote.** Un'area assegnata come *vuota* (o un contorno interno) è "niente ago qui": il ricamo non ci entra e i passaggi ci girano intorno.

**Anteprima.** A destra vedi il risultato in tempo reale. **Trascina** per spostarti, **rotella** per lo zoom; il bottone **Adatta** rimette il disegno intero nell'inquadratura. Cambiare un parametro **non** azzera l'inquadratura.

**Il filo è disegnato sottile.** In anteprima il filo è una linea fine (~0,1 mm): è una *vista*, non lo spessore reale del punto. Serve a vedere il percorso esatto.

**Esportazione — due formati.**
- **SVG** → per Illustrator/Stilista. È **allineato al file di partenza** (stesse coordinate) e **riapribile**: ricaricandolo nel tool, i parametri si ripristinano.
- **DST** → il file macchina (Tajima). Ogni colore cucito diventa un **cambio-ago** in sequenza. Il DST **non porta** il filo reale né il colore: quelli li imposti in macchina. Anche il `.dst` è riapribile (i parametri sono nascosti in fondo al file, la macchina li ignora).

**Dove si salva.** Alla prima esportazione il browser apre la finestra **"scegli dove salvare"**: scegli cartella e nome (proposto in automatico dal nome del cartamodello). La cartella se la ricorda tra un tool e l'altro. *(Da telefono, o senza HTTPS, il file va nei Download.)*

**Preset** (dove presenti). Salvi una configurazione di parametri e la richiami. I preset **locali** restano su questo browser; i **condivisi** li vede chiunque apra il sito.

---

## Rete 45° (`net-45`)

**A cosa serve.** Genera una **rete di cordoncini a 45°** dentro una sagoma — la struttura tipo rete/cannage, con i cordoncini che arrivano al bordo e una fascia di raso sui bordi.

**Come si usa.**
1. **Cartamodello** — carica il DXF/SVG del pezzo (o *Cartamodello demo* per provare); imposta la *Larghezza reale* se serve.
2. **Colori e ruoli** — indica quale colore è il perimetro, quale l'area della rete, quali le aree di raso, ecc.
3. **Parametri** — regoli la rete: **Lato del quadrato** (dimensione della maglia), **Angolo diagonali principali/secondarie** (default 45° e −45°), **Rientro della rete dal bordo**, **Sposta rete** orizzontale/verticale, **Spessore della fascia di raso**, casella **Raso solo sui bordi bassi e laterali**, **Larghezza** e **Interlinea del cordoncino** (distanza tra un punto e il successivo lungo il filo), **Lunghezza del punto nei passaggi**, **Punto minimo**.

**Esportazione.** SVG (allineato al cartamodello) o DST (i cordoncini fanno gli aghi; i rasi restano forme da riempire a mano su Stilista).

**Consiglio.** Se la rete "sparisce", quasi sempre manca l'assegnazione del ruolo *area rete* a un colore.


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.dst` uscito da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda, e ricaricandolo tornano com'erano. Il cartamodello no — quello si ricarica a parte.
---

## Generatore pattern (`pattern-grammar`)

**A cosa serve.** Genera **pattern e basi ricamo** da una "grammatica" di zig-zag componibili (il cannage è solo uno dei risultati possibili). Il piano ha una **misura propria**; la sagoma è un ritaglio *opzionale*.

**Come si usa.** Il pannello parte dall'alto:
1. **Formato e scala** — **Larghezza/Altezza totale** del piano (esatte: quello che sborda viene tagliato al bordo), e *Ingrandisci tutti i parametri* (%).
2. **Cartamodello** — opzionale: un contorno di ritaglio (DXF/SVG) con la sua scala d'import.
3. **Colori e ruoli** — se hai importato un contorno, scegli quale usare come *Confine di ritaglio*. Una tinta marcata **Area di scarico (meno passate)** non ritaglia niente: dentro i suoi contorni i zig-zag verticali e orizzontali escono con meno passate, per scaricare i punti dove serve (di solito il montaggio). Il reticolo non si sposta e il cambio cade netto sul contorno; quanto scaricare lo dici con **Scarico nelle aree** in *Percorso e confine* (`50%` = metà delle passate, `0` = niente). È lo stesso scarico di *Pattern a zone*.
4. Gruppi di generazione (in accordion, si aprono/chiudono): **Zig-zag orizzontale**, **Zig-zag verticale**, **Deformazioni creative** (inclinazioni, onda in mm e gradi), **Percorso e confine** (punto minimo/massimo, spessore di costruzione, sagoma di ritaglio).
5. **Preset** — salva/carica/elimina; c'è anche una libreria condivisa già pronta, e *Esporta/Importa file* per scambiare preset.

**Esportazione.** SVG o DST del tracciato continuo.

**Consiglio.** Le sezioni di generazione partono chiuse: aprile una alla volta per capire cosa muove ciascun parametro guardando l'anteprima.


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.dst` uscito da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda, e ricaricandolo tornano com'erano. Il cartamodello no — quello si ricarica a parte.
---

## Interlace (`interlace`)

**A cosa serve.** Riempie un'area con un **intreccio multicolore**: passaggi brevi che si intrecciano, rispettando le **aree vuote**.

**Come si usa.**
1. **Cartamodello** — la forma da riempire (DXF o SVG), oppure l'oggetto pieno dalle misure. Per **riaprire un lavoro** c'è "Carica parametri" in fondo al pannello, come negli altri tool.
2. **Colori e ruoli** — perimetro e aree vuote.
3. **Colori del filo** — la palette multicolore: i colori si alternano negli stop di cucitura (ogni stop = un cambio-ago). Ogni riga ha il **contagocce** (prende il colore dall'immagine di riferimento con la lente sul pixel, come in Bitmap → Stitch), la **cattura ±** e la **densità**. La *cattura* è il raggio entro cui l'immagine è ancora "sua": vuota (**∞**) vince il colore più vicino, com'è sempre stato. Serve con **due tinte simili per una sfumatura**: stringila su entrambe e il passaggio fra le due non è di nessuno — i due fili ci si mescolano invece di spartirselo con un confine netto.
4. **Riempimento** — densità, lunghezza dei passaggi (punto minimo/massimo), distacco dalle aree vuote.
5. **Sfondo senza ricamo** (con gli agglomerati e un'immagine) — come l'esclusione dello sfondo nel tappeto: spunti *"Lascia lo sfondo senza ricamo"*, scegli il colore (anche col **contagocce**, dall'immagine) e la tolleranza, e i punti dell'immagine vicini a quel colore restano **tessuto a vista** — nessun filo ci cuce e nessuno ci passa sopra. Il bordo del disegno resta **netto**: lì il sormonto non si applica, perché il vuoto è voluto.
6. **Tetto ai punti (buchi d'ago per mm²)** — quanti punti al massimo può prendere lo stesso millimetro quadro, contando **tutti i colori insieme**: è lì che il filo si spezza, l'ago soffre e il tessuto si perfora. Taglia solo le punte — la disomogeneità che dà movimento resta, e il filo totale non cambia (meno dell'1%). **Vuoto = automatico** (3 × i punti che servono davvero a coprire, quindi si adatta da solo a densità, numero di colori e intensità degli agglomerati). **0** = nessun tetto. Se la macchina soffre, abbassalo: il numero è la stessa cosa che conti sul ricamo. **Occhio a non scendere troppo:** l'aiuto sotto al campo ti dice, per *queste* impostazioni, quanti punti servono come minimo perché la copertura esista e quanto vale l'automatico. Sotto il minimo le celle si saturano prima di essere coperte e **restano zone scoperte** — la barra in basso te lo dice.
7. **Sormonto ai bordi delle zone** — due colori che non si mescolano si fermano testa a testa e a ridosso del confine nessuno dei due riesce più a cucire: resta una fessura chiara. Qui ogni filo sconfina di tanto oltre il bordo vietato, posandoci una passata, e i due lati si accavallano. **Vuoto = automatico** (una fila di celle, cioè 0,6 × la densità): il difetto cresce con la densità, quindi un numero fisso non andrebbe bene a tutte. Metti **0** per il confine netto di prima.
8. **Dove passa ogni filo** (solo con gli **agglomerati**) — una tabella: righe = i fili, colonne = le zone. Spegni una casella perché quel filo **non entri** in quella zona: es. i colori scuri fuori dalle zone chiare dell'immagine. Lì il filo non cuce e non ci passa nemmeno di transito, quindi può servirgli qualche **stacco** in più — i tratti sono contati nella barra in basso. Spegnendo un'**intera colonna** quella zona resta **nuda**: tessuto a vista.

**Esportazione.** SVG o DST (un ago per stop → cambi-colore in sequenza per la macchina).


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.svg` o un `.dst` usciti da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda. Ricaricandolo tornano **parametri, colori, la tavola generata (largo×alto) e l'immagine di riferimento**, e l'anteprima si ridisegna da sola — il messaggio sotto al bottone elenca cos'è tornato. Il **cartamodello importato** no: quello è un file suo e si ricarica a parte. *I file esportati prima del 24/09/2026 non hanno dentro la tavola e l'immagine: da quelli tornano i parametri, il resto lo rimetti una volta e poi riesporti.*
---

## Oblique Pattern — Broderie Anglaise (`oblique`)

**A cosa serve.** Genera **pattern obliqui a più livelli** con **fori** (per il laser), stile Broderie Anglaise.

**Come si usa.**
1. **Cartamodello** — il pezzo.
2. **Misure e rientri** — dimensioni del pattern e margini dal bordo.
3. **Punti** — parametri del punto (lunghezza, minimo…).
4. **Posizione pattern** — dove cade il disegno sul pezzo.
5. **Livelli visibili** — accendi/spegni i livelli (ricamo, fori, riferimenti laser) per vedere e esportare solo ciò che serve.

**Esportazione.** SVG (con i livelli/fori per il laser) o DST.

**Consiglio.** I **fori** sono validi solo se stanno *interamente* dentro il perimetro entro la tolleranza: se un foro tocca il bordo viene scartato (sicurezza per il taglio laser).

---

## Bitmap → Stitch (`bitmap`)

**A cosa serve.** Trasforma un'**immagine raster** (foto/bitmap) in un tracciato di ricamo: seleziona i pixel, riduce i colori e genera i punti ordinati. È l'unico tool che parte da un'immagine invece che da un contorno.

**Come si usa.**
1. **Immagine** — carica il file raster.
2. **Selezione dei pixel** — cosa entra nel ricamo (per colore/area).
3. **Colori** — quanti colori (quantizzazione) o palette manuale col **contagocce** (scegli tu i colori-livello).
4. **Riempimento** — densità dei punti (spaziatura in mm) e punto minimo.
5. **Stile e percorso** — come sono disposti/ordinati i punti (griglia, sfumatura…).
6. **Carica parametri** — riapre un `.svg`/`.dst` esportato per ripristinare le impostazioni.
7. **Esportazione** — SVG o DST; un gruppo per stop, in ordine di cucitura.

**Consiglio.** La fase di *analisi* gira in tempo reale mentre muovi i parametri (vedi i punti colorati per tinta); l'ordinamento pesante avviene solo all'esportazione.

---

## Punto Striato (`striatura`)

**A cosa serve.** Crea **striature verticali a spola** che formano **macchie maculate** su una base di riempimento parallelo — l'effetto "striato/maculato".

**Come si usa.**
1. **Sagoma** — la forma.
2. **Colori e ruoli** — perimetro e aree.
3. **Macchie** — dimensione/distribuzione delle macchie maculate.
4. **Passaggi e frastaglio** — i passaggi verticali e quanto è "frastagliato" il bordo delle striature.
5. **Punto** — lunghezza/minimo del punto.
6. **Filo** — parametri del filo/densità.

**Esportazione.** SVG o DST.


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.dst` uscito da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda, e ricaricandolo tornano com'erano. Il cartamodello no — quello si ricarica a parte.
---

## Broccato (`broccato`)

**A cosa serve.** Da un'**immagine di tessuto** costruisce un ricamo a colori che simula il **broccato**: ogni tinta riempie le sue aree con un **raso molto rado orizzontale**, e fra una riga di filo e l’altra si intravede il fondo — è quello che dà l’effetto d’intreccio. Il raso può essere **a pettine** (va e torna sulla stessa linea, tratto più marcato) o **normale** (a serpentina, più leggero).

**Come si usa.**
1. **Immagine** — carica la foto del tessuto e di’ quanto deve venire largo il ricamo. La *larghezza reale* comanda su tutto: se la metti, la sagoma misura esattamente quella.
2. **Preparazione** — è il passaggio che fa somigliare fra loro le ripetizioni dello stesso motivo, anche dove la luce del tessuto cambia. Tre manopole: il **pareggio della luce** (toglie la variazione lenta di tono; tienilo grande almeno un terzo della macchia più grande che vuoi tenere intera, altrimenti la svuota al centro), l’**attenuazione della grana** (spiana il tratteggio fine senza sbavare i contorni) e la **macchia più piccola** (sotto quella misura la macchia sparisce e va al colore vicino — è lei a rendere il disegno ricamabile).
3. **Colori** — scegli quante tinte usare (da 4 a 8, la base compresa) e premi *Cattura colori*: il sistema le trova nell’immagine e ogni pixel va alla più vicina. L’interruttore **Automatiche / Manuali** dice da dove vengono: in *Automatiche* il sistema le ripesca ogni volta che tocchi la preparazione; in *Manuali* sono tue e non le tocca più nessuno. Ci passa da solo appena correggi una tinta. Poi, riga per riga:
   - il **contagocce** apre l’immagine vera con la lente d’ingrandimento sul pixel: clicchi e quel colore esatto diventa la tinta di quella riga (lo stesso gesto del *Bitmap → Stitch*). `Esc` annulla;
   - il **quadratino** apre il selettore se preferisci scegliere il colore a mano;
   - **cosa fa** quel colore: *Macchia* (riempie le sue aree), *Base* (riempie tutta la sagoma, sotto tutto il resto), *Escluso dall’immagine* (non si ricama — serve a togliere il colore di fondo della foto e lasciare che sia la base a coprire);
   - la **densità**, cioè quanto sono vicine le righe di filo: piccola = fitto, grande = rado. Il bottone *Applica a tutti* le mette uguali, poi ne ritocchi una o due;
   - le **frecce** cambiano l’ordine di cucitura. **L'ordine conta**: ogni colore nasconde i propri passaggi sotto i colori che vengono dopo, quindi l’ultimo della lista è quello che non ha più niente sopra.

**Cosa vedi nell’anteprima.** Quattro viste, con l’interruttore in alto: *Originale* (l’immagine com’è), *Preparata* (dopo il pareggio della luce e l’attenuazione della grana — serve a capire cosa stanno facendo quelle manopole) *Ridotta*, l’immagine portata alle tinte scelte, e **Ricamo**, il tracciato vero — un gruppo per ago nell’ordine di cucitura, col filo disegnato sottile. La barra in fondo dice quanti metri di filo, quanti punti, quanti salti e che percentuale di passaggi resta nascosta. Le zone dei colori *esclusi* restano vuote, così si vede subito cosa non si ricama. La percentuale accanto a ogni riga dice quanta parte dell’immagine ha preso quella tinta.

**Esportazione.** SVG o DST.

**4. Punto** — l’**orientamento** delle righe (uguale per tutti i colori; 0 = orizzontale), la **lunghezza del punto** e lo **sfalsamento del ritorno**, cioè di quanto il pettine sposta il viaggio di ritorno per non ricadere negli stessi buchi dell’andata.

**I passaggi.** Il filo che va da una macchia all’altra non taglia mai attraverso il ricamo: **costeggia il contorno** della macchia. Se tagliasse, in quel punto il filo sarebbe doppio e la densità non sarebbe più uniforme. Fra una macchia e l’altra costeggia il contorno di **quella che viene dopo** — è ancora vergine, e il nero che passerà sui contorni la coprirà. E **il filo non si stacca mai** dentro una macchia: il giro sul contorno si paga, il taglio no.

La barra in fondo dice quanti **salti** ci sono e che percentuale di passaggi resta nascosta.

**Il punto.** Nella sezione *Punto* regoli l’**orientamento** delle righe (uguale per tutti i colori; 0 = orizzontale), la **lunghezza del punto**, lo **sfalsamento del ritorno** — di quanto il pettine sposta il viaggio di ritorno per non ricadere negli stessi buchi dell’andata — il **punto minimo**, che viene imposto alla fine (dopo i passaggi, mai prima) e la **fermatura di uscita**: qualche punto cortissimo in fondo a ogni ago, prima del cambio-colore, perché il filo non si sfili quando la macchina taglia. `0` la toglie.

**Esportazione.** SVG per Illustrator/Stilista e DST per la macchina, dai bottoni sopra l’anteprima. L’SVG ha **un gruppo per ogni ago nell’ordine di cucitura**, e ogni gruppo esce con una tinta leggermente diversa: così, se due aghi hanno lo stesso colore, Stilista li tratta lo stesso come cambi-ago distinti. Entrambi i file sono **riapribili**: il bottone *Riapri un progetto* accetta un `.svg` o un `.dst` uscito da qui e rimette tutti i parametri. L’immagine no — quella si ricarica a parte.

---

## Cannage rafia (`cannage-rafia`)

**A cosa serve.** Costruisce il programma di una borsa in **cannage rafia** a partire da un **SVG a zone**. Il DST esce a **stop**, uno per ago, in quest'ordine:
1. **Contorno a impunture** — il contorno del pezzo a punti di 4 mm, dall'angolo in alto a sinistra in senso orario.
2. **Griglia che blocca i materiali** — di nuovo il contorno, poi tutti i **lati dei rombi** prolungati da bordo a bordo, a punti di 3,5 mm, fermati qualche millimetro prima del contorno; da una linea all'altra il filo cammina su quel bordo rientrato.
3. **Base del pattern 1** e 4. **base del pattern 2** — le zone di ogni tinta riempite col suo pattern, a righe da sinistra, coi passaggi sui bordi dei rombi: è lo stesso motore di *Pattern a zone*, con i rombi dritti.
5. **Linee orizzontali e verticali.**
6. **Cornice nei rombi.**
7–10. **Bordatura**, solo se scegli dei lati da bordare: 7 raso obliquo, 8 raso dritto, 9 cordoncino, 10 linee.

**Come sono fatte le linee** (decifrate dal DST M1404 e rifatte uguali). Tutto segue i **rombi del pattern 1**: lungo la diagonale orizzontale di ogni fila di rombi del pattern 1 corre un **gruppo di 4 linee**, due esterne e due interne. Ogni linea è un **cordoncino** — il filo ripassato più volte sullo stesso tratto — con una **finestra** di filo singolo dove attraversa il lato del rombo, per lasciare passare la cornice. All'andata si cuciono i cordoncini e, sulle linee esterne, le **scalette** verso fuori; al ritorno i **fermi** sui giunti, le **barre** sopra e sotto ogni vertice — che in testa arrivano pari ai fermi della linea esterna e verso il vertice si fermano poco prima della diagonale — e i **meandri** che legano le due linee interne. Da una linea all'altra il filo passa sul bordo sinistro, fuori dal pezzo.

**Come è fatta la cornice** (letta dal DST M1404 e rigenerata dai valori). Gira attorno a ogni **rombo del pattern 2**, righe dall'alto e rombi da sinistra, in senso orario dal vertice destro. Il pezzo che si ripete è l'**uncino**: un'**orizzontale** ripassata a cavallo del lato del rombo — **il suo centro sta sempre sul lato**, metà nel pattern 1 e metà nel pattern 2 — e una **verticale** ripassata dentro il pattern 2, che parte dalla riga dell'orizzontale. Gli uncini stanno a un passo di 1/15 del lato; verso i vertici alto e basso c'è posto solo per le orizzontali, verso quelli destro e sinistro le verticali dei due lati diventano una sola a cavallo della diagonale. Ai vertici ci sono orizzontali proprie, centrate sul vertice. Le righe vanno **a serpentina** (una da sinistra, la successiva da destra, cucita a specchio) e i **passaggi stanno sempre dentro il pezzo, sui lati dei rombi**: il filo sceglie la strada più corta preferendo lati non ancora cuciti, così resta sotto gli uncini; non cammina mai sul contorno. Un giro tagliato dal bordo si può cucire a metà, tornando al vertice, per ripartire senza passare sopra quello che ha appena fatto. Gli uncini **non passano sopra fermi e barre delle linee**: dove la linea attraversa il lato stanno dentro la finestra, fra i due fermi, e se non ci stanno si accorciano (l'orizzontale dalle due parti, così il centro resta sul lato; la verticale dal capo lontano). Le orizzontali centrate sul vertice incrociano la barra del vertice, come nel DST.

**Come è fatta la bordatura** (letta dal DST M1424 ORLATURA E MEDAGLIONE). È un orlo ricamato sui lati che scegli, in quattro stop: un **raso obliquo** a 45° a densità bassa (un punto ogni millimetro), poi un **raso dritto** fitto al ritorno che **sborda di mezzo millimetro** sopra l'obliquo verso fuori, poi un **cordoncino a liscio** sul bordo esterno, e alla fine le **linee** come le cannette: cordoncino a pezzi uguali all'andata, fermi a zig-zag sui giunti al ritorno. **Singola** = 2 mm e una linea; **doppia** = 4 mm e due linee a 2 mm, coi fermi della seconda **a metà passo** della prima, così si alternano. Singola o doppia si sceglie **linea per linea**: nello stesso programma puoi avere bordature doppie e singole, e stanno tutte negli stessi quattro stop. La linea che indichi è **sempre il lato esterno**: la bordatura esce di **0,5 mm** oltre la linea e cresce verso dentro il pezzo. Il dentro lo trova da solo, in qualunque verso sia disegnata la linea. Sui bordi curvi la bordatura segue la curva.

**Dove finisce il ricamo.** Il pezzo non è il rettangolo che contiene il disegno: è l'**unione delle zone**. Tutti gli stop lo seguono: il contorno a impunture ci gira attorno, la griglia si ferma dentro, e linee e cornice si fermano dove finisce il cannage — se un rombo è tagliato dal bordo, anche loro lo sono. Se una riga attraversa un incavo il filo **non si stacca e non passa nel vuoto**: cammina a impunture **sul bordo del pezzo** fino al tratto successivo. In nessuno stop ci sono salti: anche dal contorno alla griglia e dalle termogarze alle linee il filo resta attaccato. Scalette e meandri nascono da una linea: se il bordo taglia via quella linea ma il blocco ci starebbe, lo cuce un'altra linea della stessa riga, quella che passa più vicino.

**Come si usa.**
1. **Disegno** — carichi l'SVG (o il DXF) a zone. Se viene da Illustrator lascia *Illustrator 72 dpi*. La riga sotto dice quante zone e tinte ha trovato e quanto misura il pezzo.
2. **Colori e ruoli** — una riga per tinta, col numero di zone e di **rombi interi**. Scegli quale tinta è il **pattern 1** (griglia e linee seguono i suoi rombi, ed è la base dello stop 3) e quale il **pattern 2** (lo stop 4). Una tinta marcata **Area di scarico** — di solito un contorno senza riempimento che passa sopra le zone — non si ricama: dentro i suoi contorni escono con meno passate le **basi** (come in *Pattern a zone*), e anche **linee** e **cornice**, con le passate che scegli nelle loro sezioni. Le aree possono essere più tinte. Una tinta marcata **Contorno del pezzo** è la **linea che disegni tu**: la seguono il contorno a impunture, la griglia e il contorno per le termogarze. Se non la metti, quei tre seguono il bordo del cannage. Le tinte marcate **Bordatura doppia** e **Bordatura singola** dicono **dove bordare** e come: disegnale sul lato esterno, con una tinta per ciascun passaggio (anche una linea aperta, anche una retta sola); una tinta di sole linee aperte compare qui come *linee aperte*. Al caricamento il tool li propone da solo: le prime due tinte con rombi interi. Sotto trovi la misura del rombo letta dal disegno; se qualche rombo non sta sul reticolo te lo dice.
3. **Programma** — in cima il **Punto minimo** (0,5 mm): vale per **tutti gli stop**, basi comprese, e toglie i punti più corti (`0` = niente). Sotto, gli stop, ognuno col suo colore e i suoi punti (dal 7 al 10 la bordatura, se c'è). Le caselle servono a guardarli uno per volta in anteprima: nel DST escono comunque tutti, in ordine.
4. **Stop 1 e 2** — il punto del contorno, il punto della griglia, di quanto la griglia si ferma prima del bordo (*rientro*) e la **linea di griglia più corta**: negli angoli il reticolo taglia delle schegge, e quelle più corte di così non si cuciono. Si parte da 45 mm, come nel davanti M1404, dove le schegge in alto (46 mm) ci sono e quelle in basso (40 mm) no.
5. **Stop 3 e 4** — il pattern di ogni base, dalla libreria condivisa del *Generatore pattern*. Si parte da *CANNAGE BASE — LEGGERO* per il pattern 1 e *PIENA* per il pattern 2, che sono le basi del DST di riferimento. **Scarico nelle aree** dice quanto alleggerire dentro le aree di scarico: `50%` = metà delle passate, `0` = niente. Le basi sono lo stop più lento (qualche decimo di secondo): si rifanno solo quando cambi disegno, tinta o pattern.
6. **Stop 5 — linee** — in cima scegli il **modo di cucire**: *Davanti* è il riferimento reale, *Lato* l'alternativa a punto corto usata in alcuni modelli. Se tocchi un valore diventa *Personalizzato*. Le misure del modulo **seguono il rombo**: se il rombo cresce, tutto cresce in proporzione; ma quando un pezzo di cordoncino o un mattoncino di scaletta supera la sua **lunghezza** più la **soglia**, diventa due, con un fermo in più. Le linee vanno **da un bordo all'altro**: le due *sporgenze* dicono di quanto escono dal pezzo a sinistra e a destra (l'ultimo pezzo di cordoncino si taglia lì), il *margine* dove scalette, meandri e barre si fermano in alto e in basso. **Passate nelle aree di scarico**: dentro le tinte marcate *Area di scarico*, cordoncini, scalette, meandri e zig-zag (fermi e barre) si cuciono con queste passate invece di quelle sopra (`0` = come sopra). *Contorno per le termogarze* aggiunge il contorno ripassato a inizio fase: segue la linea marcata *Contorno del pezzo*, se c'è. **Allargamento delle finestre** (1 mm): dove la linea attraversa il lato del rombo lascia una finestra per la cornice; allargandola i due fermi si allontanano e gli uncini ci stanno in mezzo invece di passarci sopra. `0` = le finestre del DST M1404. Su un rombo più piccolo di quello di riferimento (63 × 61 mm) anche i fermi rimpiccioliscono, così ci stanno sempre gli uncini.
7. **Stop 6 — cornice** — le **passate** dell'orizzontale e della verticale e le loro **lunghezze** sul rombo di riferimento (seguono il rombo come le linee: quando il passo fra gli uncini supera la **soglia**, gli uncini aumentano invece di allungarsi). **Irregolarità** dice di quanto al massimo un uncino è più lungo o più corto degli altri: poco, per l'aria fatta a mano, e il centro dell'orizzontale resta comunque sul lato; `0` = tutti uguali. **Passate nelle aree di scarico**: dentro le tinte marcate *Area di scarico* gli uncini si cuciono con queste passate invece di quelle sopra (`0` = come sopra). **Rientro dal bordo** (1 mm): sul bordo si guarda pezzo per pezzo — un'orizzontale che ci arriva più vicino non si cuce, una verticale invece si accorcia fino a lì. Tutto quello che ci sta arriva fino in fondo.
8. **Stop 7-10 — bordatura** — due modi di dire dove, che valgono insieme: le tinte **Bordatura doppia** e **singola** nel disegno (vedi sopra) oppure **Scegli i lati in anteprima**: il contorno si divide in lati agli spigoli (una curva resta un lato solo, gli scalini fra i rombi non contano) e il clic su un lato fa il giro **doppia** (rosso) → **singola** (arancio) → tolto. I lati vicini con lo stesso passaggio diventano una bordatura sola. *Togli i lati scelti* li toglie tutti; i lati scelti viaggiano nel progetto. Sotto i valori, uguali per tutte: **uscita oltre la linea** (0,5 mm), **sporgenza ai capi** di una linea aperta, **passo** e **inclinazione** del raso obliquo, **sbordo** e **passo** del raso dritto, **altezza** e **passo** del cordoncino, dove stanno le **linee**, le loro **passate** e l'**altezza dei fermi**. **Passo dei fermi**: `0` = il pezzo più lungo delle linee orizzontali dello stop 5; alzalo per allargarli.
9. L'anteprima si aggiorna da sola a ogni modifica: linee e cornice si rifanno in pochi millesimi di secondo, le basi solo quando serve.

**Simula.** Il bottone *Simula* sopra l'anteprima mette al suo posto il **simulatore del ricamo**, lo stesso del *Pettine*: il DST che esporteresti adesso si cuce sullo schermo, punto per punto, nell'ordine della macchina. Il filo è grigio finché l'ago non ci passa, poi prende il colore del suo stop; i salti restano tratteggiati in rosso. Sotto la tela: avanti e indietro di un punto o di un blocco, la barra per andare a un punto qualsiasi e la velocità (da 10 a 20.000 punti al secondo). Se tocchi un parametro mentre simuli, il programma si rifà e la cucitura riparte dall'inizio. Premi di nuovo *Simula* per tornare all'anteprima.

**Esportazione.** *Esporta DST* (gli stop in ordine, uno per ago) e *Scarica SVG*. Tutti e due si **riaprono**: *Riapri un progetto* rimette parametri, ruoli e disegno.

**Cosa manca ancora.**
- **Le parti da togliere per il montaggio.** Il tool fa **tutto il reticolo**, anche i gruppi tagliati in alto e in basso; quelle eliminazioni si sceglieranno a mano nel prossimo passo.

## Pattern a zone (`zone-pattern`)

**A cosa serve.** Riempie di pattern le **zone colorate di un disegno**, una per una. Ogni tinta del file dice due cose: *quale* pattern va in quelle zone e *a che angolo*. I pattern sono **quanti ne servono** — A, B, C… — e ognuno è un ago. È il caso del **cannage**, dove lo stesso pattern va posato su rombi regolari, su una striscia inclinata e su una banda di celle allungate.

**L'angolo si decide a mano.** Ogni tinta parte **da 0°**: il pattern esce diritto, com'è nel *Generatore pattern*, finché non scrivi un angolo nella sua riga. Il tool continua a misurare l'inclinazione delle zone, ma solo per **suggerirti** il numero: accanto a ogni tinta trovi *suggerito …°*. La misura legge il reticolo dai lati e lo porta sulla diagonale (dentro un rombo le linee corrono **da vertice a vertice**), tranne sulle **strisce** lunghe e sottili, dove il pattern corre per il lungo. È un suggerimento, non una regola: il ricamo usa solo l'angolo che scrivi tu.

**L'idea.** Non si ruota il modulo: si ruota il **piano**. Per una zona inclinata, il tool gira il poligono fino a raddrizzarlo, genera il pattern come lo genererebbe su un rombo dritto, e rimette tutto al suo posto ruotando indietro. Il pattern è quello del *Generatore pattern*, identico: cambia solo da che parte lo guardi.

**Come si usa.**
1. **Disegno** — carichi il DXF o l'SVG a zone piene. **Appena caricato lo vedi**, ancora prima di generare: ogni zona col suo colore, inquadrata da sola. È il controllo che il file è entrato giusto — scala, forme, tinte — invece di scoprirlo dopo il calcolo. Se qualcosa non torna (mancano zone, le tinte si sono fuse in una) si vede lì. Se viene da Illustrator lascia *Illustrator 72 dpi*: la misura reale la legge dal file, non c'è da dichiararla. *La zona è definita da*: **riempimento** per un disegno a zone piene (il caso normale), **tratto** per un file di soli contorni. La riga sotto dice quante zone e quante tinte ha trovato, e quanto misura il pezzo.
2. **Colori e ruoli** — una riga per tinta, col numero di zone e l'angolo suggerito. Scegli il pattern e scrivi l'**angolo** in gradi (vuoto o `0` = diritto). Il menu offre sempre i pattern già in uso **più uno nuovo**: la prima tinta vede *Pattern A (nuovo)*; la seconda vede *Pattern A* e *Pattern B (nuovo)*; la terza anche *Pattern C (nuovo)*, e così via. Non si creano pattern vuoti in anticipo, e se lasci libera una lettera (togli la B mentre A e C restano) è quella a tornare nuova.
   In fondo al menu c'è anche **Area di scarico (meno passate)**: è per le tinte che nel disegno segnano dove **scaricare i punti**, di solito per il montaggio — un contorno senza riempimento che passa sopra le zone. Quella tinta non si ricama e non è un ago: dentro i suoi contorni i pattern delle zone sotto escono con **meno passate**, sia nei zig-zag verticali che negli orizzontali. Il reticolo non si sposta di un millimetro — cambia solo quanto filo c'è in ogni zig-zag — e il cambio cade **netto sulla linea** del contorno. Quanto scaricare lo dici in ogni pattern con **Scarico nelle aree**: `50%` = metà delle passate, `0` = niente. Al 100% resta comunque una passata: un zig-zag senza passate sarebbe un buco. Nell'anteprima le aree si vedono tratteggiate sopra il disegno, e dopo *Genera* la barra di stato dice su quante zone lo scarico è arrivato.
3. **Pattern A, B, C…** — un gruppo per ogni pattern **scelto da almeno una tinta**, uno per ago, nell'ordine delle lettere: compare quando lo assegni, sparisce quando nessuna tinta lo usa più. I valori non si perdono: se riassegni la stessa lettera ritrovi il pattern com'era. Dentro ci sono i controlli del *Generatore pattern* meno il formato e la sagoma, che qui li dà la zona. Ogni pattern nasce coi valori di partenza del pannello, oppure lo fai partire da uno già fatto — in cima a ogni gruppo ci sono due scorciatoie:
   - **Parti da un pattern esistente**: scegli uno dei preset condivisi (gli stessi del *Generatore pattern*) e i suoi valori entrano nei campi.
   - **…oppure leggi i valori da un SVG**: gli dai un SVG e lui ne ricava **i valori di costruzione**, che finiscono nei campi. Non ricalca il disegno: lo **rimisura e lo rigenera**, così il ricamo esce con filo continuo, punto minimo e bordi puliti invece che a pezzi staccati. Se l'SVG è uscito da questa suite i valori sono **esatti** (li porta scritti dentro), anche se è un file vecchio coi nomi di prima; se viene da fuori vengono **misurati** e la riga sotto dice cosa ha capito — passo delle colonne, passo delle file, larghezza dello zig-zag, distanza fra i fili — e cosa non è riuscito a misurare. Quello che non misura non se lo inventa: quel campo resta come l'hai lasciato.
   In fondo a ogni gruppo c'è la **pulizia del bordo** di quella zona, con le stesse due voci del *Generatore pattern*: *Avvicina al bordo, poi elimina* prova prima a tirare il punto sul contorno (fin dove glielo concede lo *spostamento massimo*) e lo toglie solo se non ci riesce; *Elimina* lo toglie e basta. Attenzione a una cosa: **il motore ci lavora solo sui punti più vicini fra loro del punto minimo**, quindi con un punto minimo piccolo la scelta cambia poco, e più lo alzi più pesa (sul cannage: 44 punti di differenza con 0,4 mm, **225** con 2 mm). E nessuna delle due *garantisce* il punto minimo — quella è la **pulizia punti** in *Zone e sequenza*.

   Due pattern sono già **dentro il programma**: *CANNAGE BASE — LEGGERO* e *CANNAGE BASE — PIENA*, presi dagli originali di riferimento. Stanno nella libreria condivisa, quindi li trovi anche nei preset del *Generatore pattern*. Tutti i preset condivisi partono con **punto minimo 1 mm**. In tutti i casi i valori restano **visibili e modificabili**: la scorciatoia riempie i campi, non li sostituisce. Sotto ogni gruppo c'è l'**anteprima del pattern**: un quadretto di 26 × 26 mm generato con quei valori, col numero di punti — serve a vedere che punto è, che i numeri da soli non lo dicono. La riga sotto dice **quanti** valori sono entrati e, se il file ne portava di non pertinenti qui (il formato, la sagoma), lo dice invece di ingoiarli in silenzio.
4. **Zone e sequenza** — l'**altezza della riga** è la fascia entro cui due zone contano come stessa riga; a `0` la ricava dal disegno. Qui stanno anche le tre cose che decidono come si comporta il filo fra una zona e l'altra:
   - i **passaggi**: *impunture sui bordi dei rombi* fa camminare il filo lungo le giunzioni invece di tagliare in mezzo al ricamo — il **punto dei passaggi** dice quanto sono lunghe quelle impunture; *nessuno* torna al salto a filo alzato;
   - il **margine sul bordo esterno**: il ricamo deborda di tanto oltre il perimetro del disegno, come l'*overflow* dell'Oblique Pattern. Vale **solo** sul perimetro: i bordi fra un rombo e l'altro non si muovono di un millimetro, altrimenti due zone vicine si ricamerebbero addosso;
   - la **pulizia punti**: toglie i punti più vicini della misura data, **alla fine di tutto** (passaggi compresi). A `0` non tocca niente e il disegno resta esattamente com'è. È la manopola che decide chi vince fra la macchina e il disegno: alzandola spariscono i punti nello stesso buco, che sono quelli che spezzano il filo.
5. **Genera** — il calcolo non parte a ogni tasto: si preme il bottone.

**L'ordine di cucitura.** Dentro un pattern si va **a righe: da sinistra a destra, poi si riparte da sinistra**. Ogni zona è un blocco a sé che **attacca dal suo lato sinistro**. Le zone dello stesso pattern si cuciono in sequenza continua su **un solo ago**: si cambia ago solo quando si cambia pattern.

**Esportazione.** SVG e DST, entrambi coi parametri dentro: l'SVG si riapre e rimette pannello e ruoli.

**Riapri un progetto.** Il bottone in *01 Disegno* accetta un `.svg` o un `.dst` usciti da qui e **rimette tutto com'era: parametri, ruoli dei colori e il disegno**. Non serve ricaricare il cartamodello — a differenza degli altri tool, dove l'ingresso è un'immagine e non ci sta dentro, qui l'ingresso sono poligoni e viaggiano nel file (il cannage intero costa ~11 kB). I parametri stanno **dopo il record di fine**: la macchina legge fino a lì e li ignora, quindi il file resta un DST normale da cucire. Del disegno si salva la sola geometria: centro, area e angoli si rimisurano all'apertura, così un progetto vecchio gode delle regole di oggi invece di riaprire i difetti di ieri. Se il cartamodello fosse troppo pesante (un contorno tracciato male, con decine di migliaia di punti) il file esce **coi soli parametri** e la barra di stato te lo dice: non gonfia il DST alle tue spalle.

L'**SVG** esce con **un gruppo per ogni pezzo**, numerato nell'ordine di cucitura: `0000-agoA-zona-…`, `0001-agoA-passaggio`, `0002-agoA-zona-…` e così via. Blocchi e passaggi restano quindi oggetti separati e riconoscibili — se a valle ti serve spostare un rombo o togliere un passaggio, lo trovi per nome invece di cercarlo fra tracciati anonimi. I passaggi tengono il **colore del loro ago**: sono lo stesso filo, e dargli una tinta diversa direbbe al software che è un altro ago. I colori degli aghi sono quelli della palette del design system (nero, blu, rosso, ocra, verde, sabbia, salvia); dall'ottavo pattern in poi ricominciano, e a distinguerli resta la lettera nel nome del gruppo. Il filo vero lo sceglie comunque l'operatore in macchina.

Il **DST** invece ha **un layer per ago**, cioè uno per pattern in uso: lì un gruppo per pezzo diventerebbe un cambio-colore per pezzo, cioè la macchina si fermerebbe a ogni rombo.

---

## Punto Pittorico (`pittorico`)

**A cosa serve.** Da un'immagine — una stampa, una foto, una grafica di cui il vettore non c'è più —
si ricavano i blocchi di colore e ogni blocco si riempie di ricamo **pieno che segue le curve del
disegno**. Il punto **attraversa** il passaggio di colore, come i denti di un pettine, e sono i capi
dei punti a fare il degradé: dove il colore sfuma le frange dei due colori si intrecciano, dove
stacca netto il colore si ferma preciso.

Non serve nessun file vettoriale: il cerchio, l'arco, il segmento vengono riconosciuti dai pixel.

**Come si usa.**

1. **Immagine.** Carichi il file. Poi — ed è la cosa che conta più di tutte — metti la **larghezza
   reale del ricamo in mm**. Senza quella il programma non sa quanto è grande un pixel, e ogni altra
   misura del pannello perde significato.
2. **Colori.** Quanti fili vuoi: ogni tinta è **un ago**. Il pareggio della luce e l'attenuazione
   della grana servono a leggere la forma invece della stampa — su una cianotipia, senza, una
   campitura uniforme risulta piena di centinaia di buchi che sono solo puntini d'inchiostro. Sotto
   compare l'elenco dei fili trovati, **nell'ordine in cui vanno infilati**, dal più scuro al più
   chiaro.
3. **Punto.** La distanza fra le file (quanto è fitto il pieno) e la lunghezza massima del punto.
4. **Bordi e sfumature.** La **lunghezza della frangia**; la soglia oltre la quale un passaggio è
   considerato una sfumatura invece di un taglio; e le due sovrapposizioni — quanto il colore sotto
   entra sotto quello sopra **dove sfuma** (serve alle frange per intrecciarsi) e **dove stacca**
   (basta poco: serve solo a non far vedere la tela alla giunta).
5. **Genera**, e poi **Esporta SVG** o **DST**. Tutt'e due si riaprono da *Riapri un progetto* e
   rimettono i parametri.

**Le cose da sapere.**

- **La frangia non va più lunga della sovrapposizione.** Se la superi, il taglio la appiattisce:
  tutte le punte finiscono sul bordo e la frangia sparisce, cioè ottieni l'opposto.
- **Il verso del punto è automatico.** Si posa perpendicolare dove il colore cambia e resta libero
  dove la forma semplicemente finisce — è la differenza fra un *bordo* e una *testata*, e forzare la
  perpendicolare anche sulle testate lascia scoperti gli angoli.
- **I punti partono da una rotaia**, il lato che guarda il colore già cucito, e la attraversano
  paralleli; dove la fascia si allarga si infila un **cuneo**. Sulle forme che non hanno due fianchi
  contrapposti — una macchia tonda, un'isola — l'ordine non è definibile e si riempie a distanza
  costante.
- **Quello che ancora non fa:** il **punto minimo** e i **passaggi** fra una macchia e l'altra. Le
  corse escono staccate, quindi il DST di oggi è buono per guardare e misurare, non per mandarlo in
  macchina così com'è.

---

## Sfrangiatura (`sfrangiatura`)

**A cosa serve.** A prendere un ricamo **già fatto** e aggiungerci le frange dove due macchie si
affacciano: i capi delle file di raso escono dal bordo, si incrociano a X con quelli vicini, e la
giunta fra una macchia e l'altra smette di essere una linea netta. È l'unico strumento della suite
che non genera ricamo — ne rilavora uno.

**La promessa, prima di tutto il resto: il ricamo di partenza non si tocca.** Ogni punto che c'era
resta dov'era, nello stesso ordine. Le frange si *aggiungono*: dal capo il filo esce fino alla punta
e rientra nello stesso buco. Se non marchi niente, il file che esce è identico a quello che è
entrato, byte per byte.

**Come si lavora.**
1. **Carica un DST.** Compaiono ingombro, aghi, blocchi e punti letti dal file.
2. **Aghi** — spegni quelli su cui non vuoi intervenire. Il colore del campione è quello
   dell'anteprima: un DST non porta i colori del filato, li sceglie l'operatore in macchina.
3. **Zone da sfrangiare** — scegli *Marca* e passa il pennello sull'anteprima dove vuoi le frange.
   Con *Sposta* il trascinamento torna a muovere la vista; con *Cancella* togli le zone già fatte.
   La larghezza del pennello è il raggio d'azione: si sfrangia **solo** dove passi.
4. **Frangia** — lunghezza minima e massima in mm: ogni frangia pesca a caso lì dentro, ed è la
   varietà che fa l'effetto. Il **sormonto** alza il pavimento: con 3 mm nessuna frangia si ferma
   prima di 3 mm oltre il capo, cioè entrano tutte nel territorio della macchia vicina.
5. **Incrocio** — l'apertura è di quanto la frangia si scosta dalla sua fila. Il verso **alterna** fra
   una frangia e la vicina: è questo che le fa tagliare a X invece di lasciarle parallele. Ad
   apertura 0 non si incrocia niente. La **variante** è il seme del caso: la stessa variante rifà lo
   stesso identico ricamo, cambiarla dà un'altra estrazione.
6. **Esporta DST** (o SVG per guardarlo). Il DST esce coi parametri e le zone dentro: riaprendolo
   qui, riprendi da dove avevi lasciato.

**Cosa leggere nella barra di stato.** Quante frange sono state fatte, quanti **incroci** si formano
davvero (non è un'impressione: si contano), la lunghezza media e il filo aggiunto in metri.

**Due cose che il tool non fa, apposta.**
- Non tocca l'**attacco e lo stacco** del filo di ogni blocco: lì il filo entra ed esce, e spostarli
  vorrebbe dire spostare un salto e la sua fermatura.
- Non fa mai un punto più lungo di quello che la macchina cuce (12 mm): se la frangia lo sforerebbe,
  si accorcia — e nella barra di stato lo trovi scritto invece che nascosto.

---

## Punto pettine sfrangiato (`pettine`)

**A cosa serve.** A ricamare un'immagine intera a **punto pettine**: linee di base curve, tutte alla
stessa distanza, con sopra un pettine di denti che puntano verso la zona più chiara. È lo strumento
per i pannelli grandi a sfumatura, dove il disegno è già diviso in gruppi di colore in Illustrator.

**Cosa gli serve.** Due file. Il primo è un **SVG a gruppi**: un `<g id="...">` per ogni blocco che
deve avere una direzione sola. Il secondo è la **fotografia** del soggetto, che serve a una cosa
sola: decidere dove il bordo fra due blocchi **stacca** (e allora il dente si ferma) e dove
**sfuma** (e allora lo attraversa). Senza fotografia i denti attraversano sempre.

**Come si lavora.**
1. **Blocchi e fotografia** — carica i due file e scrivi la **larghezza reale del pannello**: da
   quella viene la scala di tutto, quindi va messa prima di guardare qualunque millimetro.
   *Riapri un progetto* rimette tutto com'era partendo da un DST o da un SVG usciti da qui: dentro
   ci sono i blocchi, il ritaglio e ogni parametro. La fotografia no — pesa troppo per stare dentro
   ogni swatch — e va ricaricata; il pannello ti dice quale era.
2. **Ritaglio** — il rettangolo da generare, per provare uno **swatch** invece del pannello intero.
   Si scrive nei quattro campi (gli stessi X e Y che leggi in Illustrator) oppure si sceglie
   *Ritaglia* e lo si tira col mouse sull'anteprima. *Tutto il pannello* lo spegne. Il DST che esce
   ha l'origine **nell'angolo del ritaglio**: lo swatch parte da (0,0) e si monta senza spostare
   niente.
3. **Linee** — la distanza fra una linea di base e la successiva, misurata di traverso. Le linee si
   devono sovrastare: a 2 mm i denti di una coprono la vicina.
4. **Pettine** — la **densità** è la distanza fra un dente e il successivo lungo la linea (mai sotto
   1 mm: la macchina non ce la fa). La **lunghezza minima e massima** sono la misura del dente, che
   si estrae a caso fra le due: è la varietà a fare l'effetto sfrangiato. L'**apertura** è di quanto
   ogni dente si scosta dal verso del chiaro. Togliendo i denti restano le sole linee di base: si
   guarda la struttura in un attimo, e non si costruisce il DST.
5. **Sovrapposizione** — il sormonto: se entro tanto, verso il chiaro, c'è una tinta più chiara, il
   dente si cuce **anche** con quella, prima e sotto. È così che alla giunta non si vede la tela.
6. **Curve** — i gruppi più piccoli della soglia di *traslazione* si costruiscono spostando il muro
   chiaro senza deformarlo, gli altri facendo crescere la macchia di un passo per volta.
   *Spianatura* e *chiusura* smussano gli spigoli, l'*addolcimento* cresce con la distanza dal muro.
7. **Genera**, poi **Salva SVG** o **Salva DST** dalla barra dell'anteprima. *Verifica* mostra le
   sole linee di base coi muri e le frecce del verso: è la vista in cui si capisce cosa ha deciso il
   tool.

**Cosa leggere nell'esito.** «Scoperto» è la misura che conta: la percentuale di pannello a più di
0,75 mm da qualunque filo, cioè dove si vedrebbe la tela. Sotto lo 0,5 % è un pannello pieno. Poi i
numeri della cucitura: punti, filo, aghi, blocchi e salti. Col ritaglio acceso valgono per lo
swatch, non per il pannello.

**Il file si riapre** (R9/R27). Sia il DST sia l'SVG portano dentro il progetto: nel DST sta dopo il
comando di fine, dove la macchina non lo legge; nell'SVG in un `<metadata>`, che non si disegna.
Quindi da uno swatch di due settimane fa si torna ai suoi numeri senza doverli ricordare — e se un
file è uscito prima che esistesse questa cosa, i parametri si possono comunque **misurare dal filo**
con `apps/pettine/scripts/misura-dst.ts`.

**Come cuce, e perché in quest'ordine.** Ogni linea di base coi suoi denti è un filo continuo:
radice, punta, di nuovo la stessa radice, poi la radice dopo. Dentro un blocco le linee si cuciono
**allontanandosi dal muro**, una all'andata e una al ritorno: i denti puntano verso il chiaro, cioè
all'indietro, e così ogni riga copre il dietro della precedente. **Non deve mai succedere il
contrario**, o il ricamo si rovina — per questo l'ordine non si ottimizza mai a scapito della
copertura. Due righe lontane fra loro non si coprono, e solo lì l'ordine è libero: è quello che
tiene bassi i salti. I colori vanno dal chiaro allo scuro: il chiaro sta sotto.

**I passaggi.** Fra una riga e l'altra il filo, invece di essere tagliato, passa cucendo quando può
farlo **dove qualcosa lo coprirà**: dentro la propria tinta lo nascondono i denti della riga
successiva, e più in là lo nascondono i colori più scuri, che si cuciono dopo. Il tool cerca la
strada più economica in questo senso — di solito lungo il bordo delle figure — e se non ne trova
una decente taglia e salta. Nell'esito, «Passaggi a vista» sono i metri di filo di passaggio che
nessuno coprirà: è la voce da tenere vicino a zero. «Righe fuori ordine» deve essere zero sempre, ed
è verificata **dente per dente sulla cucitura vera**, innesti compresi, non solo sulla sequenza
decisa. «Scuro vicino al muro» conta le coppie di righe di colori diversi che si toccano dove lo
scuro sta più vicino al muro del chiaro: lì il chiaro, cucito prima, copre il dietro dello scuro,
e la base scura gli passa sopra. Non dipende dalla sequenza ma dal gradiente della foto e dalla
scelta del muro: è il punto in cui il ricamo fa la «linea diretta» vista al primo provino.

**Il simulatore.** Il bottone «Simula» sopra l'anteprima cuce sullo schermo il DST appena generato,
punto per punto, nell'ordine in cui lo farà la macchina. Tutto il filo parte grigio e prende il colore
del suo ago man mano che l'ago ci passa; i rasafili restano tratteggiati in rosso. Sotto la tela ci
sono i comandi: cuci e ferma, un punto avanti o indietro, un blocco avanti o indietro, all'inizio e
alla fine, il cursore della posizione e quello della velocità (da 10 a 20.000 punti al secondo). La
riga in fondo dice a che punto sei, con quale ago, in quale blocco, quanto filo è cucito e quanti
rasafili sono passati. Zoom e trascinamento sono quelli dell'anteprima. «Usa il pannello di esempio»,
nella sezione dei blocchi, carica il pannello a sei tinte senza fotografia: serve per provare il tool
e il simulatore senza cercare i file.

**Prima la sequenza, poi il verso.** L'ordine delle righe si fissa per primo, con la copertura come
vincolo; solo dopo si sceglie da che capo entrare in ognuna, e si scelgono tutti i versi insieme
guardando l'intera catena invece di una riga alla volta. Una riga corta può anche farsi in due
tempi: si va fino in fondo in **impuntura** sulla linea stessa, poi si torna indietro cucendo il
pettine, che la copre. Così il filo **esce da dove è entrato**, e non c'è bisogno di tagliare.

**Le macchie si incastrano nelle righe grandi.** Prima si decide cosa va con cosa. Un pezzo di
sequenza chiuso fra due tagli e corto nel suo insieme, fino a 30 cm di righe, è una **macchia**: non
la si va a prendere da lontano, la si incastra. Si cuce la riga grande più comoda fino al dente
giusto, si esce per un **corridoio** nascosto, si fa tutta la macchia riga per riga, e per un altro
corridoio si torna al dente dopo e si riprende. Il corridoio per una macchia può arrivare a 15 cm,
purché resti nascosto: costa filo, non tagli. I due corridoi si cercano **prima** di decidere, con la
stessa regola che poi li cuce: se non ci sono, la macchia resta un taglio. Il punto in cui la riga
grande si spezza lo decide la copertura, non la vicinanza: le righe della macchia che vanno sopra la
grande entrano dopo il tratto che toccano, quelle che la grande deve coprire entrano prima. Una
macchia già incastrata può ospitarne un'altra. Nell'esito, «Righe inglobate» dice quante righe sono
entrate così.

**Dove un passaggio si nasconde, e dove no.** Il pettine è rado: sotto una riga futura dello
stesso colore un filo di passaggio si vede fra un dente e l'altro. «Davanti» e «dietro» si decidono
cella per cella: una cella è davanti se entro un passo c'è una base del colore in corso non ancora
cucita, perché i denti di quella riga, quando verrà, copriranno il filo. Lì il filo può saltare da
un dietro all'altro. Per il resto si nasconde solo in due posti:
nella **banda di sovrapposizione** fra il colore in corso e uno più scuro accanto, larga 5 mm per
lato lungo il bordo, dove i denti dell'uno rientrano nell'altro e la copertura è doppia; e sulla
**linea esatta di una base futura** dello stesso colore, dove finisce sotto quel filo e sotto i denti
della riga dopo. Tutto il resto è a vista, e se non c'è una strada di quel tipo si taglia. E **sopra un pettine
già cucito, di qualunque colore, un passaggio non corre mai**: l'unica eccezione è la linea di base
della riga in corso o di una futura, il dietro del pettine, dove finisce sotto i denti della riga
dopo. I passaggi sono dritti, punti da 3 mm: lo zig zag è stato provato e tolto.

**Il passaggio lungo che sparisce sotto.** «Passaggio più lungo» dice fin dove un passaggio si cuce
comunque, anche a costo di vedersi un po'. Oltre quella misura il passaggio si fa lo stesso, ma
soltanto se il cammino è di quelli nascosti e se a vista ne rimangono meno di 3 mm; altrimenti si
taglia. Vale per tutti i colori allo stesso modo, ultimi compresi: cosa è coperto lo dice la mappa,
cella per cella, non il numero dell'ago.

**Il dietro di una riga.** Sul dietro di una riga già cucita si passa, purché sopra non ci sia
cucito altro: se i denti della riga dopo la coprono già, il filo passa sul dietro di quella dopo,
che è l'ultima e non ha ancora niente sopra. Su una riga ancora da fare si passa sempre: sarà il
suo pettine a coprire il filo. E quando un filo deve passare, passa il più esterno possibile, nella
striscia oltre l'ultima riga dentata, quella che la riga dopo coprirà, mai dentro fra righe cucite.

**La gola.** Una fascia sottile si restringe, e la riga più esterna per un tratto esce nella tinta
più chiara accanto o si ritrova troppo addosso alla riga prima. Se il tratto è corto, fino a «Gola
attraversata», la riga non si spezza: il pettine continua sopra e raggiunge l'altro pezzo, invece
di lasciarlo orfano con un taglio. Nella gola la riga si stringe un po' verso quella prima.

**Fin dove arriva un passaggio nascosto.** «Passaggio nascosto più lungo» decide quanto si può
andare lontano prima di arrendersi e tagliare. Da quando un passaggio si nasconde solo dove è
davvero coperto, la lunghezza non è più un rischio ma solo filo: il default è 250 mm, e un corridoio
per una macchia arriva a 300. Se vuoi meno filo e accetti più tagli, abbassalo.

**Il sormonto non è una fase a parte.** I denti che un colore chiaro cuce sotto il bordo di uno
scuro sono righe a tutti gli effetti: entrano nella sequenza insieme alle altre, con il loro verso,
i loro innesti e i loro corridoi. La distanza dal muro li mette dopo le righe che devono coprire.

**I passaggi si spargono sulle basi, non si accalcano.** Un passaggio corre esattamente sulla linea
del dietro di una riga, dove il pettine lo nasconde: la cella della linea costa poco, quella di
fianco costa quattro volte tanto (serve per i passi in diagonale, non per correre a mezzo millimetro
dalla linea), e la striscia fra due righe serve solo ad attraversare da una base all'altra. Nella
banda di un colore più scuro vale lo stesso: sulle sue linee di base, non a caso fra i denti. E
preferisce una base che nessun passaggio ha ancora usato: ripassare dove il filo c'è già non
aggiunge niente da vedere, ma ammucchia filo, e Lorenzo vuole meno densità. Il filo di passaggio
segna anche una fascia di 4 mm attorno a sé, così il passaggio dopo non si mette sulla base di
fianco (che a occhio è la stessa strada) ma su una linea davvero diversa. Il corridoio già battuto
resta possibile: dove non ci sono altre basi si ripassa di lì, e si vede una linea sola.

**Fuori dal blocco al massimo due linee.** Nel colore scuro accanto il filo di passaggio può entrare
per due passi di base oltre il bordo del proprio blocco, misurati dal blocco del colore in corso e
non da un bordo qualsiasi: una cella scura vicina a un terzo colore ma lontana dal nostro blocco non
è una strada. Solo quando altrimenti si taglierebbe vale la regola larga di prima (5 mm da qualunque
bordo): un passaggio che si allontana è meglio di un rasafilo, ma solo se non c'è altro, e il log
dice quanti sono e quanto filo ci finisce («Oltre le due linee»).

**Scegliere una strada e giudicarla sono due conti diversi.** I costi che spingono il filo sulla
linea esatta e lontano dai corridoi servono a scegliere; per decidere se cucire o tagliare valgono
solo quanto il filo si vedrà. E la ricerca è a scalare: prima sulla mappa che sparge, poi senza
l'affollamento, poi sui costi nudi del giudizio; si taglia solo se falliscono tutte e tre. Senza
questa scala, spargere i passaggi costava tagli, e Lorenzo i tagli non li vuole. Nell'esito la voce
«Corridoi» confronta i metri di passaggio con i metri di strada distinta.

**Si lavora per blocchi vicini.** Le righe di un colore dentro un gruppo possono stare in pezzi
staccati. Il tool li raggruppa in zone e finisce una zona prima di cominciare la successiva, così i
collegamenti restano corti e il taglio si paga solo per cambiare blocco.

## Cross-Stitch (`cross-stitch`)

**A cosa serve.** A ricamare un disegno fatto di **diagonali in una griglia**: la diagonale
singola, la **V** (il punto della **maglia**), la **Λ** e la **croce**. **Un punto per cella**:
la V sta dentro la sua cella — dall'angolo in alto a sinistra alla punta a metà del lato di sotto,
e su all'angolo in alto a destra — quindi V e croce hanno la stessa misura e si mescolano. Si
disegna a mano cella per cella, o si parte da un'immagine e la griglia si riempie da sola.

**Modificare: la barra sopra il disegno.** Sempre visibile, con gli strumenti, la grandezza del
pennello, i fili e Annulla/Rifai.
- **Sposta** (H): trascini la vista, il ricamo non si tocca. Rotella = ingrandisci.
- **Pennello** (B): trascinando, i punti sotto il pennello passano al filo scelto — per pulire
  l'interno di una scritta, bianco sopra il nero. Lavora a celle intere, una cella = un punto. Sulle celle vuote mette il punto
  scelto nella barra, alla voce *Punto* (V, Croce, Diagonale; col clic destro Λ o «/»).
- **Riempi** (F): un clic passa al filo scelto tutta la zona COLLEGATA dello stesso colore. Attento:
  segue tutto quello che si tocca, quindi va usato su zone chiuse (l'interno di una lettera); per i
  ritocchi c'è il pennello.
- **Gomma** (E): cancella, lì non si cuce niente. Con qualunque strumento, Maiuscolo cancella.
- **Gruppi** (G): trascina un rettangolo attorno a una parte del disegno che va cucita tutta insieme
  (vedi *Gruppi* più sotto). Il ricamo non cambia, cambia l'ordine dei passaggi.
- **Vista**, a destra della barra: **Griglia** (accesa, le linee si vedono anche sopra il ricamo) e
  **Passaggi** (i passaggi colorati sull'anteprima). Sotto il disegno, la barra di stato dice cosa fa
  lo strumento scelto.
- **Grandezza** 1, 2, 4, 8 punti: sotto il mouse si vede l'impronta del pennello.
- **Filo**: i quadratini dei fili, un clic sceglie quello del pennello.
- **Annulla / Rifai**: anche Ctrl+Z e Ctrl+Y. Spazio + trascina sposta la vista con ogni strumento.

Mentre trascini il pennello si ridisegnano solo i punti; i passaggi si ricalcolano quando lasci.

**Fili.** Clic su un filo per disegnare con quello. L'ordine della lista è l'**ordine degli aghi**
(↑ per anticipare un filo): i passaggi di un filo si nascondono sotto le diagonali dei fili che
vengono dopo.

**La base.** Sotto la lista dei fili, **Filo di base** fa di un filo il fondo: riempie **tutta la griglia** col
punto che scegli lì sotto (V, Λ, croce, «\», «/»), si cuce **per primo** con il suo ago, e il
disegno degli altri fili si ricama sopra, ognuno col suo punto. Le celle del disegno che hanno già
il colore della base non si cuciono due volte. Per esempio: base tutta bianca a V, e sopra il nero,
a V o con un punto diverso. Con «— nessuna» si toglie.

**Maglia dall'immagine.** Si parte da qui. In *01 Immagine* carichi la foto: la maglia si crea
subito, ogni V col filo più vicino al colore dell'immagine sotto di lei (i colori dei fili si
ricavano dall'immagine, tanti quanti sono i fili, il più chiaro per primo). Poi in *02 Misure del
ricamo* scegli **larghezza e altezza del ricamo** in mm, **larghezza e altezza della cella** e il
**sormonto delle righe**: colonne e righe le calcola il tool, e la maglia si rifà da sola. Le celle
sono intere, quindi il ricamo esce
della misura più vicina possibile: la riga sotto le misure dice quella vera. L'altezza segue le
proporzioni dell'immagine; se la scrivi a mano la proporzione si sblocca e l'immagine si stira.
Il **sormonto** è solo verticale: ogni riga sale dentro quella di sopra di quella percentuale
dell'altezza, e le V si infilano una nell'altra; in orizzontale le V si toccano e basta. Per
l'effetto maglia: celle più alte che larghe (per esempio 3 × 3,8 mm, sormonto 30%). Se ritocchi il disegno a mano,
cambiando le misure non si rifà più dall'immagine: c'è *Rifai la maglia dall'immagine*.

**Il punto della generazione.** In *01 Immagine*, *Punto*: V (la maglia, di partenza), Λ (la V
capovolta), Croce, o la sola diagonale. Uno per cella, ognuno col suo filo. Per più dettaglio
in orizzontale si stringe la cella.

**Leggere bene l'immagine.** I colori dei fili si ricavano dall'immagine e si affinano, così un
nero resta nero anche se attorno ci sono molti grigi di bordo. Il filo che copre di più va per
**ultimo, cioè sopra**: gli altri nascondono i loro passaggi sotto di lui. La **soglia del
dettaglio** dice quanta parte di un colore di dettaglio (il nero) basta dentro una cella per farla di
quel colore: più bassa salva i tratti sottili come le lettere, 50% è la maggioranza.

**Swatch: il ritaglio.** Per provare un pezzo piccolo premi **Ritaglia** e trascina un
rettangolo sul disegno: la maglia si rifà solo su quel pezzo, con le proporzioni del pezzo, e
larghezza e altezza le regoli sotto. Il pezzo si prende dall'originale a piena risoluzione, quindi
non perde dettaglio; si può ritagliare più volte, e *Immagine intera* torna all'originale.

**I passaggi si calcolano da soli.** Il filo va da una diagonale alla successiva scegliendo la
strada più nascosta: sotto una diagonale che verrà cucita dopo (grigio tratteggiato), sopra una
già cucita (arancio, ingrossa un po' il punto), lungo un bordo di cella in vista (rosso). Oltre
*Salta oltre* diventa un salto con taglio. La barra di stato dice quanti mm di ciascun tipo.
Il **ripasso** su una diagonale già cucita costa pochissimo: il filo si sposta usando i suoi
stessi punti. **Niente passaggi orizzontali**: per cambiare riga il filo scende o sale **in
verticale, dai vertici della V**: ripassa mezza V fino alla punta, scende al centro fino alla
punta della V sotto e risale (in blu nell'anteprima). Mezza V prende un passaggio in più, ma il filo
resta dentro il punto invece di scendere sul lato fra due celle. Se quel verticale passerebbe sopra una V di un colore già cucito,
lo evita. **Niente salti**: a macchina un salto lascia un filo che attraversa gli altri colori; si
salta solo oltre *Salta oltre* (400 mm di partenza). In una zona chiusa (il bianco dentro una
lettera nera) il filo che va sopra deve attraversare il contorno una volta, e lo fa nel punto più
corto.
**Per blocchi di colore** (in *04 Passaggi*, acceso di partenza): il filo lavora su tre livelli,
e ognuno lo finisce prima di passare al successivo.
1. **Zone.** Il disegno di ogni colore si taglia lungo le **strisce vuote** larghe almeno 5 mm,
   come si legge l'impaginazione di un giornale: una colonna di testo, un titolo, la montagna. Una
   zona più grande di 100 mm senza strisce vuote si taglia sulla linea meno piena. Il filo finisce
   la zona e passa alla più vicina: una colonna non si cuce un po' all'inizio e un po' alla fine.
   I due valori si regolano in *04 Passaggi*: **Vuoto che separa** (5 mm) e **Zona massima**
   (100 mm). Più alti danno zone più grandi e meno numerose: sul giornale Dior, con 8 mm o con
   200 mm le zone passano da 37 a meno di 10 e gli articoli si fondono.
2. **Pezzi che si toccano**, dentro la zona (una parola, una lettera).
3. **Tratti di riga** (celle consecutive dello stesso colore), dentro il pezzo: finisce il tratto
   in cui si trova ed entra in uno nuovo da un'estremità, così lo percorre tutto in una volta.

**Gruppi.** Nessuna regola automatica sa che un titolo è una cosa sola: sul giornale Dior il titolo
è largo quasi quanto la pagina, e qualsiasi zona massima lo divide (il filo lo cuciva in 6 volte).
Con lo strumento **Gruppi** della barra si trascina un rettangolo attorno: dentro, ogni colore è una
zona sola e il filo la finisce tutta prima di uscire (sul Dior: una volta sola, con gli stessi ripassi).
Fuori dai gruppi resta il taglio automatico. I gruppi si vedono in modalità Gruppi, col loro numero;
in *04 Passaggi* c'è la lista: passandoci sopra si evidenzia il gruppo, la freccia lo porta più su,
il cestino lo toglie, *Togli tutti* chiede conferma. **I gruppi si cuciono per primi, nell'ordine
della lista** (per ogni colore): tutto il gruppo 1, poi tutto il 2, poi il resto per vicinanza.
Imporre un ordine costa qualche ripasso in più (sul Dior, colonna e titolo: da 25,1 a 25,7–26,4 m). Se due gruppi si sovrappongono vale l'ultimo disegnato. Si salvano nel
progetto (DST e SVG) e tornano con *Carica parametri*.

**Per spostarsi** (in *04 Passaggi*) sceglie il compromesso fra ripassi e filo in vista. Il ripasso
lungo è quasi tutto strutturale: il filo finisce un tratto dal capo sbagliato e torna sopra la riga
appena cucita. Per ripassare meno deve prendere scorciatoie sopra gli altri colori. Sul giornale Dior
(450 mm, 3 passate, base bianca):

| Scelta | Ripassi | Filo in vista |
|---|---|---|
| *Meno in vista* (partenza) | 25,1 m | 0,90 m |
| *Equilibrio* | 20,7 m | 1,21 m |
| *Meno ripassi* | 18,8 m | 1,46 m |

In tutti e tre i casi niente salti e nessun ritorno in un pezzo lasciato a metà.

**Stop accesi e spenti.** Nella riga di ogni filo, **Vedi** accende o spegne quello stop
nell'anteprima (punti e passaggi), per guardare un colore alla volta. Uno stop spento **non va
nell'export** (DST e SVG): i passaggi degli altri fili si ricalcolano come se non ci fosse.

**Le passate sono per filo**: nella riga di ogni filo c'è il suo numero (*pass*) (per esempio la base a 3 e
il colore sopra a 5). Con più passate si sceglie **come** farle. *Tutte sulla stessa V* (la partenza): avanti,
indietro, avanti sugli stessi fori e poi la V dopo, come il punto triplo delle macchine. Con passate
**dispari** ogni V finisce nell'angolo dove comincia la successiva, e la riga si cuce di filato. *Lungo
la riga*: ogni passata è un pezzo a sé, la riga si fa all'andata e si ripassa al ritorno; conviene
con passate **pari**. *Direzione fissa* obbliga «\» dall'alto e «/» dal basso.

**Salvare e riaprire.** Aggiornando la pagina si riparte **sempre puliti**: il tool non tiene
niente in memoria. Per riprendere un lavoro, SVG e DST esportati da qui portano dentro tutti i
valori e il disegno: in fondo al pannello, *06 Carica parametri*, li rimette com'erano. Apre anche
i progetti `.json` della vecchia app ThreadRoute. L'immagine di partenza non è nel file: se vuoi
rifare la maglia, ricaricala.

## Se qualcosa non torna

- **"Non vedo niente in anteprima."** Controlla di aver assegnato i **ruoli** ai colori (spesso manca l'area da riempire), e prova **Adatta**.
- **"La misura non è giusta."** Imposta la **Larghezza reale (mm)** nel Cartamodello: prevale su quella letta dal file.
- **"L'export non si sovrappone al cartamodello."** L'SVG esce sempre allineato al file di partenza; se non combacia, verifica che il cartamodello importato sia quello giusto.
- **"Il file va nei Download invece di chiedermi dove."** La finestra "scegli dove salvare" richiede HTTPS o il computer locale; da telefono ripiega sul download classico. È normale.

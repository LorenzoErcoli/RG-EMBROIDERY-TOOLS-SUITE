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
3. **Colori e ruoli** — se hai importato un contorno, scegli quale usare come *Confine di ritaglio*.
4. Gruppi di generazione (in accordion, si aprono/chiudono): **Zig-zag orizzontale**, **Zig-zag verticale**, **Deformazioni creative** (inclinazioni, onda in mm e gradi), **Percorso e confine** (punto minimo/massimo, spessore di costruzione, sagoma di ritaglio).
5. **Preset** — salva/carica/elimina; c'è anche una libreria condivisa già pronta, e *Esporta/Importa file* per scambiare preset.

**Esportazione.** SVG o DST del tracciato continuo.

**Consiglio.** Le sezioni di generazione partono chiuse: aprile una alla volta per capire cosa muove ciascun parametro guardando l'anteprima.


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.dst` uscito da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda, e ricaricandolo tornano com'erano. Il cartamodello no — quello si ricarica a parte.
---

## Interlace (`interlace`)

**A cosa serve.** Riempie un'area con un **intreccio multicolore**: passaggi brevi che si intrecciano, rispettando le **aree vuote**.

**Come si usa.**
1. **Cartamodello** — la forma da riempire.
2. **Colori e ruoli** — perimetro e aree vuote.
3. **Colori del filo** — la palette multicolore: i colori si alternano negli stop di cucitura (ogni stop = un cambio-ago).
4. **Riempimento** — densità, lunghezza dei passaggi (punto minimo/massimo), distacco dalle aree vuote.

**Esportazione.** SVG o DST (un ago per stop → cambi-colore in sequenza per la macchina).


**Riaprire un progetto.** Il campo di caricamento accetta anche un `.dst` uscito da qui: i parametri stanno dopo il record di fine, dove la macchina non guarda, e ricaricandolo tornano com'erano. Il cartamodello no — quello si ricarica a parte.
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

## Pattern a zone (`zone-pattern`)

**A cosa serve.** Riempie di pattern le **zone colorate di un disegno**, una per una. Ogni tinta del file dice due cose: *quale* pattern va in quelle zone e *con che correzione d'angolo*. Il tool misura da solo l'inclinazione di ogni zona e ci ruota sopra il pattern, così il disegno rispetta le perpendicolari delle celle anche dove sono deformate — è il caso del **cannage**, dove lo stesso pattern va posato su rombi regolari a 45°, su una striscia inclinata e su una banda di celle allungate.

**L'asse del pattern.** Dentro un rombo le linee corrono **da vertice a vertice** — verticali rispetto al rombo, non parallele ai suoi lati. Il tool legge il reticolo dai lati (è il modo robusto: i lati sono lunghi e si misurano bene) e poi ruota di 45° per metterlo sulla diagonale. L'eccezione sono le **strisce**: dove la cella è lunga e sottile non c'è nessun rombo, il pattern corre per il lungo, e lì non si ruota niente. Il tool distingue i due casi dall'**allungamento** della cella, deciso per tinta e pesato sull'area — così una scheggia rifilata non cambia la regola alle sue sorelle. Se in un caso particolare sbaglia, la **correzione d'angolo** in *02 Colori e ruoli* è lì per quello: `+45` o `-45` rimette a posto.

**L'idea.** Non si ruota il modulo: si ruota il **piano**. Per una zona inclinata, il tool gira il poligono fino a raddrizzarlo, genera il pattern come lo genererebbe su un rombo dritto, e rimette tutto al suo posto ruotando indietro. Il pattern è quello del *Generatore pattern*, identico: cambia solo da che parte lo guardi.

**Come si usa.**
1. **Disegno** — carichi il DXF o l'SVG a zone piene. **Appena caricato lo vedi**, ancora prima di generare: ogni zona col suo colore, inquadrata da sola. È il controllo che il file è entrato giusto — scala, forme, tinte — invece di scoprirlo dopo il calcolo. Se qualcosa non torna (mancano zone, le tinte si sono fuse in una) si vede lì. Se viene da Illustrator lascia *Illustrator 72 dpi*: la misura reale la legge dal file, non c'è da dichiararla. *La zona è definita da*: **riempimento** per un disegno a zone piene (il caso normale), **tratto** per un file di soli contorni. La riga sotto dice quante zone e quante tinte ha trovato, e quanto misura il pezzo.
2. **Colori e ruoli** — una riga per tinta, col numero di zone e l'angolo misurato. Scegli il pattern (**A**, **B**, o *non ricamare*) e, se serve, una **correzione d'angolo** in gradi per quella tinta.
3. **Pattern A** e **Pattern B** — i due pattern, uno per ago: i controlli del *Generatore pattern* meno il formato e la sagoma, che qui li dà la zona. Non sei obbligato a compilarli a mano — in cima a ogni gruppo ci sono due scorciatoie:
   - **Parti da un pattern esistente**: scegli uno dei preset condivisi (gli stessi del *Generatore pattern*) e i suoi valori entrano nei campi.
   - **…oppure leggi i valori da un SVG**: gli dai un SVG e lui ne ricava **i valori di costruzione**, che finiscono nei campi. Non ricalca il disegno: lo **rimisura e lo rigenera**, così il ricamo esce con filo continuo, punto minimo e bordi puliti invece che a pezzi staccati. Se l'SVG è uscito da questa suite i valori sono **esatti** (li porta scritti dentro), anche se è un file vecchio coi nomi di prima; se viene da fuori vengono **misurati** e la riga sotto dice cosa ha capito — passo delle colonne, passo delle file, larghezza dello zig-zag, distanza fra i fili — e cosa non è riuscito a misurare. Quello che non misura non se lo inventa: quel campo resta come l'hai lasciato.
   In fondo a ogni gruppo c'è la **pulizia del bordo** di quella zona, con le stesse due voci del *Generatore pattern*: *Avvicina al bordo, poi elimina* prova prima a tirare il punto sul contorno (fin dove glielo concede lo *spostamento massimo*) e lo toglie solo se non ci riesce; *Elimina* lo toglie e basta. Attenzione a una cosa: **il motore ci lavora solo sui punti più vicini fra loro del punto minimo**, quindi con un punto minimo piccolo la scelta cambia poco, e più lo alzi più pesa (sul cannage: 44 punti di differenza con 0,4 mm, **225** con 2 mm). E nessuna delle due *garantisce* il punto minimo — quella è la **pulizia punti** in *Zone e sequenza*.

   Due pattern sono già **dentro il programma**: *CANNAGE BASE — LEGGERO* e *CANNAGE BASE — PIENA*, presi dagli originali di riferimento. In tutti i casi i valori restano **visibili e modificabili**: la scorciatoia riempie i campi, non li sostituisce. Sotto ogni gruppo c'è l'**anteprima del pattern**: un quadretto di 26 × 26 mm generato con quei valori, col numero di punti — serve a vedere che punto è, che i numeri da soli non lo dicono. La riga sotto dice **quanti** valori sono entrati e, se il file ne portava di non pertinenti qui (il formato, la sagoma), lo dice invece di ingoiarli in silenzio.
4. **Zone e sequenza** — la **libertà d'angolo** decide quanto ogni zona può discostarsi dalla sua famiglia: a `0` tutte le zone di una tinta prendono lo stesso angolo (i "blocchi secchi"), alzandola ognuna segue la propria deformazione. L'**altezza della riga** è la fascia entro cui due zone contano come stessa riga; a `0` la ricava dal disegno. Qui stanno anche le tre cose che decidono come si comporta il filo fra una zona e l'altra:
   - i **passaggi**: *impunture sui bordi dei rombi* fa camminare il filo lungo le giunzioni invece di tagliare in mezzo al ricamo — il **punto dei passaggi** dice quanto sono lunghe quelle impunture; *nessuno* torna al salto a filo alzato;
   - il **margine sul bordo esterno**: il ricamo deborda di tanto oltre il perimetro del disegno, come l'*overflow* dell'Oblique Pattern. Vale **solo** sul perimetro: i bordi fra un rombo e l'altro non si muovono di un millimetro, altrimenti due zone vicine si ricamerebbero addosso;
   - la **pulizia punti**: toglie i punti più vicini della misura data, **alla fine di tutto** (passaggi compresi). A `0` non tocca niente e il disegno resta esattamente com'è. È la manopola che decide chi vince fra la macchina e il disegno: alzandola spariscono i punti nello stesso buco, che sono quelli che spezzano il filo.
5. **Genera** — il calcolo non parte a ogni tasto: si preme il bottone.

**L'ordine di cucitura.** Dentro un pattern si va **a righe: da sinistra a destra, poi si riparte da sinistra**. Ogni zona è un blocco a sé che **attacca dal suo lato sinistro**. Le zone dello stesso pattern si cuciono in sequenza continua su **un solo ago**: si cambia ago solo quando si cambia pattern.

**Esportazione.** SVG e DST, entrambi coi parametri dentro: l'SVG si riapre e rimette pannello e ruoli.

**Riapri un progetto.** Il bottone in *01 Disegno* accetta un `.svg` o un `.dst` usciti da qui e **rimette tutto com'era: parametri, ruoli dei colori e il disegno**. Non serve ricaricare il cartamodello — a differenza degli altri tool, dove l'ingresso è un'immagine e non ci sta dentro, qui l'ingresso sono poligoni e viaggiano nel file (il cannage intero costa ~11 kB). I parametri stanno **dopo il record di fine**: la macchina legge fino a lì e li ignora, quindi il file resta un DST normale da cucire. Del disegno si salva la sola geometria: centro, area e angoli si rimisurano all'apertura, così un progetto vecchio gode delle regole di oggi invece di riaprire i difetti di ieri. Se il cartamodello fosse troppo pesante (un contorno tracciato male, con decine di migliaia di punti) il file esce **coi soli parametri** e la barra di stato te lo dice: non gonfia il DST alle tue spalle.

L'**SVG** esce con **un gruppo per ogni pezzo**, numerato nell'ordine di cucitura: `0000-agoA-zona-…`, `0001-agoA-passaggio`, `0002-agoA-zona-…` e così via. Blocchi e passaggi restano quindi oggetti separati e riconoscibili — se a valle ti serve spostare un rombo o togliere un passaggio, lo trovi per nome invece di cercarlo fra tracciati anonimi. I passaggi tengono il **colore del loro ago**: sono lo stesso filo, e dargli una tinta diversa direbbe al software che è un altro ago.

Il **DST** invece resta a **due layer, uno per ago**: lì un gruppo per pezzo diventerebbe un cambio-colore per pezzo, cioè la macchina si fermerebbe a ogni rombo.

---

## Se qualcosa non torna

- **"Non vedo niente in anteprima."** Controlla di aver assegnato i **ruoli** ai colori (spesso manca l'area da riempire), e prova **Adatta**.
- **"La misura non è giusta."** Imposta la **Larghezza reale (mm)** nel Cartamodello: prevale su quella letta dal file.
- **"L'export non si sovrappone al cartamodello."** L'SVG esce sempre allineato al file di partenza; se non combacia, verifica che il cartamodello importato sia quello giusto.
- **"Il file va nei Download invece di chiedermi dove."** La finestra "scegli dove salvare" richiede HTTPS o il computer locale; da telefono ripiega sul download classico. È normale.

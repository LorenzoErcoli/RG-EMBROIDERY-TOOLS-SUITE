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

---

## Interlace (`interlace`)

**A cosa serve.** Riempie un'area con un **intreccio multicolore**: passaggi brevi che si intrecciano, rispettando le **aree vuote**.

**Come si usa.**
1. **Cartamodello** — la forma da riempire.
2. **Colori e ruoli** — perimetro e aree vuote.
3. **Colori del filo** — la palette multicolore: i colori si alternano negli stop di cucitura (ogni stop = un cambio-ago).
4. **Riempimento** — densità, lunghezza dei passaggi (punto minimo/massimo), distacco dalle aree vuote.

**Esportazione.** SVG o DST (un ago per stop → cambi-colore in sequenza per la macchina).

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

---

## Broccato (`broccato`)

**A cosa serve.** Da un'**immagine di tessuto** costruisce un ricamo a colori che simula il **broccato**: ogni tinta riempie le sue aree con un **raso molto rado orizzontale**, e fra una riga di filo e l’altra si intravede il fondo — è quello che dà l’effetto d’intreccio. Il raso può essere **a pettine** (va e torna sulla stessa linea, tratto più marcato) o **normale** (a serpentina, più leggero).

**Come si usa.**
1. **Immagine** — carica la foto del tessuto e di’ quanto deve venire largo il ricamo. La *larghezza reale* comanda su tutto: se la metti, la sagoma misura esattamente quella.
2. **Colori** — scegli quante tinte usare (da 4 a 8, la base compresa) e premi *Cattura colori*: il sistema le trova nell’immagine e ogni pixel va alla più vicina. Poi, riga per riga:
   - il **quadratino** apre il selettore se vuoi correggere una tinta a mano;
   - **cosa fa** quel colore: *Macchia* (riempie le sue aree), *Base* (riempie tutta la sagoma, sotto tutto il resto), *Escluso dall’immagine* (non si ricama — serve a togliere il colore di fondo della foto e lasciare che sia la base a coprire);
   - la **densità**, cioè quanto sono vicine le righe di filo: piccola = fitto, grande = rado. Il bottone *Applica a tutti* le mette uguali, poi ne ritocchi una o due;
   - le **frecce** cambiano l’ordine di cucitura. **L'ordine conta**: ogni colore nasconde i propri passaggi sotto i colori che vengono dopo, quindi l’ultimo della lista è quello che non ha più niente sopra.

**Cosa vedi nell’anteprima.** L’immagine ridotta alle tinte scelte: è esattamente ciò che finirà sotto l’ago. Le zone dei colori *esclusi* restano vuote, così si vede subito cosa non si ricama. La percentuale accanto a ogni riga dice quanta parte dell’immagine ha preso quella tinta.

**Esportazione.** SVG o DST.

> **In costruzione.** Oggi il tool arriva fino alla riduzione dei colori. Il riempimento a raso, i passaggi nascosti e l’esportazione stanno arrivando.

---

## Se qualcosa non torna

- **"Non vedo niente in anteprima."** Controlla di aver assegnato i **ruoli** ai colori (spesso manca l'area da riempire), e prova **Adatta**.
- **"La misura non è giusta."** Imposta la **Larghezza reale (mm)** nel Cartamodello: prevale su quella letta dal file.
- **"L'export non si sovrappone al cartamodello."** L'SVG esce sempre allineato al file di partenza; se non combacia, verifica che il cartamodello importato sia quello giusto.
- **"Il file va nei Download invece di chiedermi dove."** La finestra "scegli dove salvare" richiede HTTPS o il computer locale; da telefono ripiega sul download classico. È normale.

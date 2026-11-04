---
titolo: Pattern a macchie — base a pattern, raso nelle macchie, sopra lo stesso punto a registro
tipo: tool
tool: [pattern-macchie]
data: 2026-10-08
---

**Stato: tool vero, in «In sviluppo» (2026-10-08).** `apps/pattern-macchie/` (motore in `src/motore.ts`, interfaccia
in `src/tool.ts`). Provato a macchina; dopo la prova del 2026-10-29 le decisioni 23–25. Le 27–28 (2026-11-03) non sono ancora
provate in Stilista né a macchina.

## Da dove nasce
Lorenzo, 2026-10-08, con `TEST-PIAZZEMENTO CON MACCHIE.svg` (FENDI FALL 27-28, «magic serpente ghepardato»: pannello
355 × 101 mm, contorno rosso, 84 macchie gialle): la base (per esempio il punto nastro a squame) su tutto il pannello, e
dentro ogni macchia un raso con sopra **il punto della base**, *«ogni macchia riempita con il proprio punto autonomo»*,
coi salti ridotti al minimo; *«dove le macchie si toccano conviene mettere in consecuzione»*.

## Le decisioni di Lorenzo
1. **Il raso è verticale**; lo stesso filo per tutto.
2. La base doveva fermarsi 2 mm dentro la macchia; poi *«per ora non bucare la base, lasciala tutta intera»*. Il taglio
   è pronto nel motore (`bucaLaBase`, `margineBase`), spento.
3. Dopo la prima prova: **«non ricamare tra una macchia e l'altra»** — la prima versione passava da una macchia all'altra
   sulle linee della base (nascosto, ma è ricamo fra le macchie): tolto. **«Puoi gestire tu ingresso e uscita»**.
4. Il punto sopra **«fuori dalla macchia non deve mai andare: piuttosto si elimina una parte più corposa»**.
5. **Sfrangiare il raso** per non avere bordi netti.
6. **«Alterare le macchie per farle avvicinare»**, per avere meno rasafilo: i ponti, facoltativi.
7. **Tre stop**: la base, il raso delle macchie, il punto sopra (*«ho bisogno che le macchie siano divise in 2 stop»*).
8. (2026-10-09) **Da sinistra a destra**: le macchie e il raso dentro le macchie. **I passaggi sempre sotto il raso**:
   *«in alcune situazioni ripassa sopra il raso già fatto di una parte della macchia per raggiungere l'altra parte.
   Questo è un errore.»*
9. (2026-10-12) **Ingresso e uscita nei punti più vicini alle macchie vicine**, *«lavorando a serpentina e lasciando
   solo i salti quando è impossibile altrimenti»*. E il da-sinistra-a-destra era una prova: *«conviene lavorare
   autonomamente sinistra-destra e viceversa (serpentina o qualsiasi altra forma) che permetta alle macchie di
   muoversi meglio»* — spento di serie.
10. (2026-10-12) **Dentro una macchia mai un salto**: *«i passaggi della macchia devono avvenire interni alla macchia
   stessa, e poi essere coperti»*. E **le zone**: base intera, poi raso e punto sopra della prima zona, poi della
   seconda (*«se voglio che ricami prima la prima metà e poi la seconda metà»*).
11. (2026-10-26) **Coi ponti, niente salti dentro le macchie e niente tagli sul raso**: *«togli i 7 salti dentro le
   macchie e i 2 passaggi che tagliano la punta di una riga»*. La regola 10 vale anche per le macchie allungate dal
   ponte, e quella del 2026-10-09 (mai sopra il raso già cucito) vale anche per le punte delle righe.
12. (2026-10-26) **Il calcolo in un Web Worker**: *«passa al calcolo nel Web Worker, così la pagina non si blocca»*.
13. (2026-10-26) **Come Stilista: una passata per macchia, passaggi sul bordo.** Lorenzo ha fatto tracciare a Stilista
   (software di ricamo) le nove macchie in alto a sinistra del pannello di prova (`MACCHIE-DST-GESTIONE-PASSAGGI.dst`):
   *«la divisione e i passaggi mi sembrano più precisi di quelli che il sistema crea. Soprattutto i passaggi sono vicino
   al bordo e ridotti al minimo»*. Poi: *«Sì: una passata per macchia nel verso del giro, passaggi sul bordo, ~~ordine a
   serpentina per fasce~~. Accetto salti un po' più lunghi fra le macchie»* (la serpentina è superata dalla 15). Questo
   cambia la 9: ingresso e uscita restano vicini alle macchie vicine, ma non a costo di passaggi lunghi dentro.
14. (2026-10-26) **Il filo di un salto non passa mai sopra una macchia**: *«la freccia blu presenta un passaggio da
   macchia a macchia, ma poi lì viene ricamata e quel filo si incastrerà sicuramente sotto il ricamo; questo è da
   evitare, conviene spostare il punto di ingresso»*. Vale per la macchia dove si entra, quella da cui si esce e quelle
   in mezzo, nel raso e nel punto sopra — della stessa zona: le altre zone vengono dopo uno stop, e *«i fili li taglio
   a ogni stop»* (Lorenzo, stesso giorno).
15. (2026-10-26) **Libero, ma dentro fasce: le zone.** *«ti chiederò probabilmente di fare libero ma dentro fasce di tot
   centimetri, perché devo essere sicuro che lo stop 3 combaci con lo stop 2 e se poi ritira è un casino… lavora fascia
   1 (2-3) e lo stesso per le altre 2 fasce. Dentro queste fasce può lavorare in maniera libera»*. Sono le zone della
   10, dall'alto in basso: raso e punto sopra di ogni fascia di seguito, l'ordine libero dentro. L'ordine a serpentina
   per fasce (13) è tolto.
16. (2026-10-26) **Meno punti corti nel punto sopra**: *«c'è un po' da ridefinire quel passaggio: purtroppo ci sono
   davvero troppi punti corti e tanti che rischiano di non lavorare bene con fili più spessi. Va in qualche modo cercato
   di limitare i punti piccoli pur trovando soluzioni per comunque ricamare bene»*. Un campo: *Punto minimo del punto
   sopra* (`sopraPuntoMin`, 1 mm come la base; più alto per i fili spessi). E coi ponti, nessun salto dentro le macchie
   nel punto sopra (*«sì, sistemalo»*).
17. (2026-10-27) **I pannelli grandi**: *«in un pannello grande da 400000 punti generati fa davvero fatica»*.
18. (2026-10-27) **Il raso finisce verso la macchia dopo**: *«in base alla sequenza il raso deve finire verso dove
   inizia la macchia successiva, questo permette di avere questi passaggi più brevi. Se bisogna creare passaggi sotto
   il raso ben venga, meglio sotto che sopra»*. Nel piano del raso un millimetro di salto pesa 80 (era 20).
19. (2026-10-27) **Il punto sopra sempre da sinistra a destra, coi passaggi sotto.** *«Il punto dovrebbe lavorare
   sempre da sinistra a destra, e mai al contrario, altrimenti si rovina»*; *«evitiamo assolutamente che passi più volte
   sullo stesso punto»*; *«dove i punti sono piccoli e poco pratici non rispettiamo perfettamente la posizione del punto
   speciale»*. Le colonne nell'ordine e nel verso della base, i denti andata e ritorno come nella base. Provati il
   «togli» (*«no così è un disastro»*) e le corsie sul bordo (*«il ricamo risulta molto sporco»*); poi: *«va bene con i
   passaggi sotto»* e *«accetto un po' di doppie passate sopra le linee già cucite, perché stanno sul disegno: riducile
   il più possibile e togli quasi tutti i tratti fuori dal disegno»*. Fra le due prove, *«la versione col disegno come la
   base»* (non le colonne riportate sul bordo).
20. (2026-10-28) **Il punto sopra si muove come la base.** Provata a macchina la versione a lobi: *«non ci siamo per
   niente… se ridisegnassimo per ogni macchia da zero?»*; provato il ridisegno: *«questi passaggi sono inaccettabili.
   dentro la macchia deve essere tutto nascosto a costo di passare due volte sullo stesso punto»*. Poi, mandato il DST
   del suo progetto (*TEST-PIAZZEMENTO CON MACCHIE*, punto *RG-PUNTO-SQUAMA-2e4-PASSAGGI-v2*): *«il punto sopra non sta
   davvero replicando la base come dovrebbe»*; e *«non è necessaria la copia esatta, non è importante il ritorno, può
   lavorare andata e ritorno, ma deve lavorare sempre con l'idea che il punto deve assomigliare alla base più per
   movimento che nella precisione. ovviamente niente 4 passaggi, solo andata e ritorno»*.
21. (2026-10-28) **I salti, molto più corti.** Provato il punto sopra come la base, prima chiede di vedere i salti in due
   colori (*«i salti che partono dal raso dai salti che partono dal punto speciale»*: viola e rosso), poi: *«Vanno
   assolutamente ridotti di tantissimo i salti. Il raso è facile, devi fare dei salti con il punto più vicino della
   macchia successiva. poi fai un passaggio nascosto e ricami la macchia come preferisci. Per quello superiore da capire
   come fare. Io rimango dell'idea che un passaggio che porta fino al limite della macchia verso la macchia successiva
   che può passare al bordo o ripassare sopra va bene. ridurre la lunghezza dei salti è importante»*.
22. (2026-10-28) **Aperto da Stilista, il suo punto e i suoi parametri.** Dal pulsante di Stilista (la suite su un altro
   indirizzo, senza i pattern salvati nel suo Generatore): *«non vedo la base come la vorrei io e le macchie lavorano al
   contrario»* — partiva dal punto squame e dai valori di serie (*da sinistra a destra* spento). Il tool ricorda pattern
   e parametri dell'ultimo calcolo, e *Pattern e parametri da un progetto…* li prende da un DST o SVG uscito da qui
   lasciando il disegno di adesso.
23. (2026-10-29) **Sotto le macchie la base a 2 passaggi.** Provato a macchina: *«il filo si sovrappone»*. *«La base che
   lateralmente è a 2 passaggi e al centro è a 4 passaggi, deve prevedere però dove ci saranno le macchie sopra. Dove
   vi sono le macchie i passaggi rimangono a 2 per non sovrapporre troppo filo.»* Fuori dalle macchie la base resta
   com'è, e resta intera (`bucaLaBase` spento). Poi, visti i 127 mm rimasti a 4 passaggi nei pezzetti sotto il
   millimetro sul bordo: *«togliamo anche i pezzetti da 1 mm sul bordo, non sono necessari»* — dentro le macchie mai 4
   passaggi, da nessuna parte.
24. (2026-10-29) **La fase del raso, da controllare in un campo**: *«la fase tra i punti ricamo dovrebbe essere 30, ma
   vorrei poterla controllare»*; chiesto cosa fosse il 30: *«sì, 30% del punto»* — lo sfalsamento degli aghi di una riga
   rispetto alla riga accanto, in % del punto massimo del raso. Campo *Fase del raso* (`rasoFase`), di serie 30%.
25. (2026-10-29) **Il punto sopra sfasato dalla base.** *«In questo momento va a combaciare con quello che c'è nella
   base, il problema è che il filo ribattendo dove c'è altro filo lavora male. Prevediamo quindi di ricreare sì quel
   punto della grandezza come la base, ma lo sfasiamo un po', in modo che non corrisponda ed il filo del punto speciale
   della macchia non batte sul filo della base.»* Poi: *«io farei anche 1 mm a destra va bene»* e *«ma anche
   spostamento verticale in realtà»*. Due campi, `sopraSfasaX` (di serie 1 mm a destra) e `sopraSfasaY` (di serie 1 mm
   in basso, scelto misurando: vedi sotto). Restano la 4 (mai fuori dalla macchia) e la 19 (da sinistra a destra).
26. (2026-10-29) **Una prova: il raso lo fa Stilista, gestito dal tool.** *«Invece che disegnare il raso delle macchie,
   tu saresti in grado di sfruttare la costruzione di stilista per i riempimenti, ma di scegliere tu ingresso e uscita
   delle macchie per la sequenza e anche orientamento sempre verticale e ovviamente sequenza? Quindi alla fine avere il
   riempimento raso di stilista ma gestito dal programma?»* Poi: *«sì, fallo, seleziono la macchia modello»*. Casella
   *In Stilista, il raso lo fa Stilista* (`rasoDiStilista`, di serie spenta): con «Invia a Stilista» ogni stop del raso
   torna come riempimenti di Stilista, uno per macchia nell'ordine del tool, copie del riempimento selezionato in
   Stilista (il modello, coi suoi parametri), nella direzione `rasoAngolo`, con l'ingresso e l'uscita del nostro raso
   portati sul contorno (`macchiePerStilista`; il plugin: `POST /riempimenti`). Anteprima e DST restano col nostro raso.
   Ingresso e uscita: [`sapere/codice/stilista-ingresso-uscita.md`](../codice/stilista-ingresso-uscita.md).
   Provata da Lorenzo il 2026-10-29: *«funziona. è un passaggio molto importante per lo sviluppo di tools che sono in
   grado di controllare anche stilista»* (41 macchie su 42; una è rimasta a 0 punti, da guardare).
27. (2026-11-03) **La base e il punto sopra solo se richiesti**: *«il punto speciale sopra deve essere qualcosa che non
   deve esserci per forza, ma solo se richiesto e lo stesso vale per la base. magari io chiedo solo di fare le macchie»*.
   Due caselle in *Cosa ricamare* (`conBase`, `conSopra`), spente di serie. Spente tutte e due il tool fa solo il raso, non
   mostra il pattern e non vuole il pannello. I progetti di prima, che questi campi non li hanno, si riaprono con tutte e
   due accese, e con quelle il ricamo è identico al micron a prima (provato anche con zone, ponti, da sinistra, base bucata).
28. (2026-11-03) **Due livelli di macchie**: *«la possibilità di generare 2 stop di macchie, in cui la prima i passaggi li
   fa sotto la seconda. come al solito»*. Il suo progetto: *«base ricamo da stilista, punto sfrangiato sulla base, livello
   macchie chiaro e livello macchie scuro»*. Le scelte di Lorenzo, lo stesso giorno: i livelli vanno **per colore del
   disegno** (ruolo *Macchie, 2° livello*); chiaro e scuro **si toccano o si sovrappongono**; dove si sovrappongono **il
   chiaro si ferma sotto lo scuro**, entrandoci solo di `secondoMargine` (di serie 1 mm: l'ha proposto la chat, da
   confermare a macchina); dove lo scuro non copre il passaggio **si salta, come oggi**: resta la decisione 3, mai un
   punto a vista fra le macchie (superata dalla 29). Stop: primo livello (raso, poi punto sopra se c'è), poi secondo.
29. (2026-11-03) **Zero salti nel primo livello, con punti corti a vista.** Provato in Stilista: *«funziona da stilista, ti
   chiedo però di gestire i passaggi delle macchie a livello 1, che deve passare sotto il raso che c'è sopra. andando a zero
   di salti»*. Misurato il suo disegno (62 macchie del primo livello, 177 del secondo): le macchie del secondo quasi non
   si toccano (6 su 177, staccate di 2,2 mm in mediana), quindi tutto coperto il minimo erano 51 salti. Gli ho chiesto come
   preferiva arrivare a zero e ha scelto i **punti corti a vista**, non i ponti di raso nel secondo livello. Campo
   `secondoVista` (di serie 12 mm per attraversamento, 0 = si salta). Solo per il primo livello: il secondo salta ancora.
30. (2026-11-03) **Ogni livello coi suoi parametri**: *«Vanno gestite le macchie con 2 parametri diversi, ogni livello di
   macchia deve avere il suo pannellino dei parametri»*. Due pannellini, *Raso, 1° livello* e *Raso, 2° livello* (quello
   del secondo solo se un colore ha quel ruolo): `daSinistra`, `rasoAngolo`, `rasoInterlinea`, `rasoPuntoMax`, `rasoFase`,
   `sfrangiatura`, `sfrangiaturaFuori` e gli stessi col 2 in fondo. Ponti, zone e punto sopra restano comuni: l'ho scelto
   io, da confermare. Un progetto senza i parametri del secondo gli dà quelli del primo, come lavorava allora.
31. (2026-11-03) **L'anteprima dice di chi è il salto, e il filo non salta nemmeno dentro la macchia.** *«hai risolto i
   passaggi delle macchia sotto quelle sopra? perchè ora non fa il passaggio fa dei salti»*: li guardava nell'anteprima.
   I passaggi erano spenti di serie e i tratteggi erano i 175 salti del secondo livello, contati insieme al primo: sembrava
   che il primo saltasse. Ora i passaggi fra le macchie del primo livello (`vista.fra`) sono accesi, i salti hanno un colore
   e un conto per livello, e fra due stop non c'è più un tratteggio (lì il filo è tagliato). Ma c'era anche un difetto vero:
   col raso fitto restavano salti dentro le macchie (9 a interlinea 0,25). Dove sotto il raso non c'è strada il filo
   prende la stessa strada di fra le macchie: nella parte ancora da cucire, o fuori (`giraFuori`), mai sopra le righe già
   cucite. *«considera che le macchie piccole sono quelle sotto e quelle grandi quelle sopra»*: sul suo disegno sotto
   le viola (62) e sopra le verdi (177), confermato da lui, ed è già così. Il tool però sceglie il livello dall'ordine dei
   colori, non dalla grandezza: non ho messo una regola, perché qui mediana (312 contro 242 mm²) e massimo (957 contro 1887)
   direbbero il contrario l'una dell'altro. Se un disegno viene al contrario si cambia il ruolo nel menu.
32. (2026-11-04) **Con due livelli i ponti stanno solo sul secondo, e il filo del primo li sfrutta.** *«le macchie nere più
   grandi abbiano poi dei punti in cui si creano ponti che possono essere sfruttati per i passaggi»*, poi *«i ponti li
   costruisce il sistema non è che vanno forzati per forza per far passare il filo. Deve collaborare, se non ci sono
   rimarranno i salti»*. Nera è la macchia sopra. Il sistema fa i ponti fra le nere che si seguono e dove il filo del primo
   livello dovrebbe attraversare lo spazio fra due nere, mai oltre la distanza scelta. Il primo livello si ferma anche sotto
   i ponti, e la strada del filo li conta come coperti. *«i ponti poi lo scelgo io quanto in fase di costruizione. è la logica
   che mi interessa sia insertita»*: la distanza resta il campo `ponti`, di serie 0, e senza ponti il ricamo è identico a
   prima. Alla domanda se per le macchie sotto, senza copertura, volesse il salto o i punti ha risposto *«sotto punti»*:
   `secondoVista` non cambia, di serie 12 mm, e può abbassarlo lui.
33. (2026-11-04) **Sotto la macchia è anche dove arrivano le punte del raso.** *«nella base, sotto alla macchia si crea una
   situazione strana, vengono messi dei punti in più ripetto al normale passaggio singolo che dovrebbe avere sotto la
   macchia»*. Sul suo DST (sfrangiatura 7 mm, 3,5 fuori) la barretta della foto attraversava una rientranza della macchia
   larga 2,2 mm: le punte la riempiono di raso, ma la base guardava solo il contorno e la credeva fuori (1 mm a 2 passaggi, 1,6
   a 4, 1,5 a 2, quindi due punti in mezzo). Ora conta come sotto anche la metà della sfrangiatura che va fuori, lungo il
   raso: lì arrivano almeno metà delle righe (misurato: 2,9 righe al mm dentro, 1,9 a 1 mm dal contorno, 1,2 a 2 mm, 0,4 a 3
   mm). Poi, sulle barrette a cavallo del bordo vero (fuori 4 passaggi, dentro 2): *«no quelle a cavallo toglile rendi tutto
   a 2.»* Una barretta che tocca una macchia ora è una sola andata e ritorno, tutta intera, senza punti in mezzo; tutta fuori
   resta com'è. Questo supera il «fuori resta com'è» della decisione 23 per il pezzo fuori di quelle barrette. Sul pannello: da
   796 barrette spezzate a 4 (tre o più posizioni d'ago su una riga, non nate da qui), da 4.417 a 2.061 mm ripassati, di cui
   sotto il raso pieno da 270 a 4 mm; da 26.017 a 23.265 punti, da 70,7 a 65,9 m di filo; raso, punto sopra e capi della base
   restano uguali. Non è provato a macchina: **da guardare se ai bordi delle macchie la base resta troppo leggera**.

## Come è fatto, e perché
- **I due livelli** (2026-11-03). `costruisciMacchie(…, secondo)` lavora un livello alla volta (`unLivello`), con lo stesso
  codice: un livello solo dà lo stesso ricamo di prima. Prima il primo livello si ferma sotto il secondo
  (`fermaSottoIlSecondo`): su una griglia di un decimo, la macchia meno le scure ristrette del margine; una macchia che
  non ci finisce sotto resta esatta, una tagliata in due fa due macchie, una tutta sotto sparisce, una con una scura
  dentro resta col buco (`conBuco`: un taglio nel verso delle righe, che così non ne attraversano nessuna). Tutto il resto,
  raso di Stilista compreso, vede solo macchie normali.
- **I passaggi sotto il secondo livello** (`SottoIlSecondo`). Da una macchia alla dopo si cerca una strada su una griglia di
  due decimi solo dentro le macchie del secondo livello, a `sfrangiatura dentro + 0,3 mm` dal loro contorno (dove le righe
  sfrangiate potrebbero non coprire), al più 40 mm. Se c'è, il raso finisce dove la strada comincia (la riga più vicina per
  ultima, come coi ponti), il filo la percorre, e nella macchia dopo si continua sotto il raso come sempre. Se non c'è, si
  salta. **Provato e scartato:** spingere l'ordine delle macchie verso le coppie legate da una scura: più salti e più
  lunghi (26 e 457 mm contro 23 e 223); l'ordine resta quello di sempre, dei salti più corti.
- **Col raso di Stilista i passaggi sotto il secondo livello non si cuciono.** Fra due riempimenti Stilista salta: il
  filo di un riempimento finisce all'uscita e quello dopo comincia all'ingresso, non c'è punto in mezzo. Si rispettano solo
  ingresso e uscita, che sono i capi della nostra strada. Per cucirli servirebbe un oggetto a punti fra due riempimenti
  (con `POST /punti`, un oggetto in più per macchia): non fatto, da decidere con Lorenzo.
- **Il punto sopra è la base tagliata sulla macchia**, con una sola andata e ritorno dove la base va e torna più volte
  (le barrette a 4 passaggi del punto 2e4). Dal 2026-10-29 (decisione 25) non è più a registro: è la base intera
  spostata di `sopraSfasaX` a destra e `sopraSfasaY` in basso (di serie 1 e 1 mm), poi tagliata sulla macchia,
  quindi non ne esce. 0 e 0 = a registro come prima.
- **La fase del raso** (2026-10-29, decisione 24, `aFase`). Prima ogni riga più lunga del punto massimo si divideva in
  parti uguali: righe accanto, di lunghezza simile, avevano gli aghi quasi alla stessa altezza (un solco). Ora gli
  aghi stanno su una scala di passo `rasoPuntoMax`, la stessa per la macchia, spostata di `rasoFase`% a ogni riga
  (le righe si contano dalla prima della macchia, di interlinea in interlinea). Ai capi un ago a meno di 1 mm non si
  mette; se così un punto supera il massimo, quel punto si divide in parti uguali. Le righe corte (non oltre il punto
  massimo) restano un punto solo.
- **La base sotto le macchie a due passaggi** (2026-10-29, decisione 23, `dueSottoLeMacchie`). Dopo i ponti, perché
  il raso copre le forme coi ponti: ogni corsa a, b, a, b, a della base che tocca una macchia diventa una sola
  andata e ritorno, tutta intera e senza punti in mezzo, anche il pezzo che sta fuori (decisione 33; fino al 2026-11-04
  si spezzava sul bordo: fuori 4 passaggi, dentro 2). I capi della base non cambiano: l'ordine delle macchie, che
  parte dalla fine della base, resta lo stesso. «Tocca» comprende anche le punte del raso: la barretta si sposta lungo il
  raso, ogni quarto di millimetro, fino a metà della sfrangiatura che va fuori (`PUNTE_COPRONO`), e si taglia su ogni
  macchia. Ogni macchia usa la sfrangiatura e l'angolo del suo livello.
- **Ingresso e uscita.** In ogni macchia si entra nel punto dell'interno più vicino a dove si è usciti; un passaggio
  SOTTO il raso (A* su griglia, lontano dal bordo più della sfrangiatura: il raso lo copre) porta all'inizio delle righe.
  Il raso sceglie da quale cella e da quale angolo cominciare guardando dove FINISCE: dal lato della macchia dopo. Il
  piano dà per scontato che dall'ingresso si arrivi sotto il raso a ogni riga; se alla sua prima riga non si arriva, si
  rifà il piano con la prima riga che non si raggiunge pagata come un salto fin lì (decisione 21). Vicino ai capi della
  strada vale anche il raso fuori dal bordo, fin dove la sfrangiatura va fuori (le righe cominciano lì).
- **L'ultimo punto usato** (2026-10-28, decisione 22): pattern e parametri si salvano a ogni calcolo nella memoria del
  browser (`pattern-macchie-ultimo`) e la pagina riparte da lì. È per indirizzo: la suite su `localhost:5270` e su
  `127.0.0.1:5301` hanno memorie diverse, come i pattern salvati nel Generatore. Per portarli da una all'altra, *Pattern e
  parametri da un progetto…* (un DST o SVG uscito da qui porta dentro il pattern intero, non solo il nome). Un pattern
  che non è né nella libreria condivisa né nel Generatore di quel browser compare nell'elenco sotto *Da un progetto*.
- **La sfrangiatura dentro: al più tre decimi della riga per capo** (2026-10-28). Con la sfrangiatura a 5 mm del
  progetto di Lorenzo, nelle strozzature larghe 2 mm le righe si accorciavano fino a sparire: buchi senza raso, e
  dall'una all'altra parte della macchia il passaggio sotto il raso non passava più (si saltava).
- **Il punto sopra che si muove come la base** (2026-10-28, `sopraComeLaBase`). **I pezzi**: la base tagliata sulla
  macchia (col ponte, sulla forma col ponte, meno la parte dentro la macchia dopo), nell'ordine della base; due pezzi
  che si toccano capo a capo sul bordo (una barretta che esce e rientra nello stesso punto) sono uno; dove la base va e
  torna più volte (a, b, a, b, a) una sola andata e ritorno (a, b, a). **La rete**: le linee dei pezzi, ognuna una volta,
  spezzate dove si incrociano (nel punto 2e4 le barrette scavalcano lo zig-zag della colonna accanto: tutte le linee di
  una macchia larga sono collegate); per ogni tratto quante volte è già cucito; la strada più corta sulle linee costa la
  lunghezza alla prima e seconda passata, 20 volte tanto alla terza. Fra due gruppi di linee che non si toccano (dove la
  macchia si stringe) una volta dritta fino a 6 mm, 40 al millimetro. I gruppi staccati con meno filo di `pezzoMinimo`
  (le barrette che entrano dal bordo mentre la loro colonna è fuori) non si cuciono. **L'ordine**: il pezzo dopo è
  quello che costa meno raggiungere sulle linee più 3 mm per ogni pezzo che scavalca nell'ordine della base, e mai
  prima di un pezzo che viene prima e che tocca (da sinistra a destra: in una macchia a C un lobo alla volta). **Gli
  aghi**: sulla strada solo dove gira (e uno ogni 3,5 mm); alla fine via gli aghi che fanno un punto più corto del
  minimo, se il filo si sposta al più di mezzo minimo e resta dentro. **Fra le macchie** (decisione 21): ingresso nel
  nodo più vicino il cui salto non passa sopra una macchia da cucire, e prima un punto dal bordo più vicino a dove si è
  usciti (un quarto di millimetro dentro; fino a 4 mm, se resta dentro); uscita sulle linee, senza limite, fino al nodo
  più vicino alla macchia dopo, e di lì un punto fino al bordo dove la macchia dopo è più vicina (`AL_BORDO`, 4 mm). Il
  salto è così lungo quanto la distanza fra le due macchie. Col ponte, se la macchia prima finisce accanto (2,5 mm), si
  continua senza salto.
- **Il raso a celle**: una riga continua la cella di prima se si sovrappongono e nessun'altra riga ci si sovrappone; i
  passaggi fra le celle girano attorno al raso già cucito (la griglia dell'interno perde le celle cucite).
- **I ponti** vanno nella macchia PRIMA, non in quella dopo: così il raso e il punto sopra della prima possono finire
  dentro il ponte, cioè già dentro la macchia dopo. Messi nella macchia dopo, il raso non ci arrivava (83 → 67 salti
  invece di 83 → 17).

- **Passaggi sotto il raso, davvero.** «Lontano dal bordo» non basta: un passaggio che va da una parte all'altra
  della macchia deve correre dove il raso NON è ancora stato cucito, cioè dove lo coprirà. Due pezzi: il piano
  (ordine e verso delle celle tali che, finita una, la prossima si raggiunga solo attraverso celle da cucire — una U
  aperta a destra: un braccio verso la base, la base da sinistra, l'altro braccio) e la griglia «dove il raso
  coprirà» (le fasce delle righe ancora da fare). Trappole trovate: la fine di una cella e la cella vicina possono
  stare ai capi opposti della stessa riga (il piano deve guardare il PUNTO dove si finisce, non il lato); a 0,9 mm
  di tolleranza il piano saltava sopra una riga cucita (0,55: solo la riga accanto); le righe sfrangiate in fuori
  finiscono fuori dalla macchia, e la loro punta va lasciata percorrere; nelle rientranze la volta fra due righe
  esce dalla macchia (lì la cella si divide). Dove una strada coperta non c'è: un salto, mai un filo sopra il raso.

- **L'uscita su qualsiasi riga.** L'ingresso era già libero (si arriva sotto il raso); l'uscita no: il raso finiva
  sull'ultima riga della serpentina, e il salto partiva da lì. La cella si cuce in due — un lato, poi l'altro dal
  fondo verso la riga più vicina alla macchia dopo — e il passaggio fra le due parti corre dove il raso non c'è
  ancora. Da 21 salti oltre 12 mm a 1 (che è la distanza vera fra due macchie isolate).

- **Coi ponti, le macchie hanno molte parti** (fino a 17 sul pannello di prova) e la ricerca del piano arrivava al
  tetto di 60.000 stati: perdeva il tempo sulle mosse che finiscono in un vicolo cieco (una parte cucita senza raso
  da fare accanto alla sua ultima riga: costano un salto subito dopo) e teneva il piano coi salti trovato fin lì. Ma un
  piano senza salti c'è quasi sempre: si cuce una parte che non divide il resto, finendo dal lato del resto. Quindi i
  vicoli ciechi si provano solo se non c'è altro. 7 salti → 0, nessuna macchia arriva più al tetto (la più grande
  18.000 stati), e il calcolo coi ponti a 5 mm scende da 6,2 a 3,4 s in Node.
- **Il ponte entra nella macchia dopo**, di mezzo millimetro più la sfrangiatura: le sue ultime righe sono già cucite
  quando la macchia dopo comincia. La griglia dei passaggi di una macchia deve conoscere il raso già cucito nello stop
  attorno a lei, se no il passaggio d'ingresso ne taglia le punte (erano 13 tagli, 2 oltre 0,75 mm dalla punta). La
  riga da cui si esce dalla macchia prima vale come solco di partenza (come l'ultima riga cucita dentro una macchia), e
  prima della ricerca su griglia si prova il filo dritto: la griglia va da centro a centro di cella (0,2 mm) e fra le
  righe fitte del ponte tagliava una riga che la volta dritta di mezzo millimetro non tocca.

- **Il calcolo nel worker** (`macchie.worker.ts`, come la razza). Due cose che nascono dal non bloccare più la pagina:
  gli export si spengono finché il ricamo non è quello dei parametri di adesso (se no il DST porterebbe il ricamo
  vecchio coi parametri nuovi nel progetto); e a calcolo finito si rifà solo il *Programma*, perché rifare tutto il
  pannello cancellava quello che si stava scrivendo in un campo. Un parametro cambiato a metà calcolo chiude il worker
  e ne apre un altro: il calcolo vecchio non si aspetta.

- **Il DST di Stilista, letto** (2026-10-26; allineato al nostro SVG con una traslazione: l'87% dei punti cade dentro
  le macchie, il resto sono le punte oltre il bordo). Un blocco solo, 2.502 punti, nessun salto né stop: fra una macchia
  e l'altra punti lunghi da 3 a 11 mm (7, 52 mm), che a macchina si tagliano. Ordine 0 → 1 → 2 → 4 (in alto, da sinistra
  a destra), 5 → 3 → 9 → 7 → 8 (in basso, da destra a sinistra). Il riempimento è un raso spezzato: colonne verticali a
  0,25 mm cucite su e giù, punti da 3 mm sfalsati, il cambio di colonna con un punto obliquo (noi: 0,4 mm e fino a 4 mm,
  non toccato). Ogni macchia in poche parti grandi (la 1: 30, 14 e 31 colonne), nel verso del giro; dove la forma si
  divide, un ramo e poi l'altro, col passaggio **lungo il bordo**. Misurati coi nostri stessi conti: passaggi 237 mm, a
  una mediana di 0,23 mm dal bordo, il 91% entro 1 mm, mai oltre 1,7; **nessun passaggio sopra una colonna già
  cucita** (zero incroci): la regola del 2026-10-09 vale anche per Stilista.
- **Come lo fa il motore.** (1) **La passata**: se non è unita alla macchia prima, si salta dritti all'inizio della
  prima riga, che il piano mette dal lato da cui si arriva; il piano paga ogni millimetro di passaggio dentro 5 e ogni
  millimetro di salto, all'ingresso e all'uscita, 20 (prima l'uscita 100 e i passaggi quasi niente). (2) I passaggi il
  piano li misura sulla **strada vera** (`stradaVera`: la più corta lungo il bordo, su una griglia di 0,25 mm entro 2 mm
  dal bordo): in linea d'aria, attorno al buco di una macchia a C, quattro millimetri diventano dieci. (3) La griglia
  dei passaggi costa di più quanto più ci si allontana dal bordo (`PESO_BORDO`), e la linea dritta non entra nella
  macchia più dei suoi capi: la strada costeggia il bordo, nella fascia che le punte delle righe coprono. (4) L'ultima
  riga cucita, il solco da cui si riparte, si tocca solo ai capi (con i passaggi sul bordo un passaggio la
  riattraversava a metà). (5) **Il salto non passa sopra una macchia** (`saltoSopra`, le macchie della zona): l'ingresso
  dritto che ci passerebbe costa 50.000, e allora si entra dal punto del bordo più vicino all'uscita con un passaggio
  sotto il raso fino alle righe; l'uscita da cui la macchia dopo non si raggiunge pulita costa lo stesso; l'ordine fa
  pagare 200 mm alle coppie di macchie con un'altra in mezzo (`sopraAltre`); nel punto sopra un salto così costa di più.
  (6) Le punte delle righe del ponte della macchia prima (dentro la macchia dopo fino a 1 mm) si possono scavalcare
  entro 1,1 mm prima di cambiare parte o verso: il raso della macchia dopo le copre (`puntaAltrui`).
- **Numeri** (pannello di prova, 84 macchie, senza ponti). Prima: passaggi dentro 2.875 mm, mediana 0,31 mm dal bordo,
  77% entro 1 mm; salti 274 mm, il più lungo 13,1; 1 salto sopra una macchia nel raso e 1 nel punto sopra. Dopo:
  passaggi **2.741 mm**, mediana **0,21**, **93%** entro 1 mm; salti **349 mm**, il più lungo **12,0**; **nessun salto
  sopra una macchia**. Con 3 fasce dall'alto in basso: passaggi 2.681 mm, salti 458 mm (il più lungo 29,7), nessun
  salto sopra una macchia della fascia. Sulle nove macchie di Stilista: passaggi 269 mm (Stilista 237), salti 44 mm
  (Stilista 52). Coi ponti a 5 mm: 75 ponti, raso 15 salti e punto sopra 15, nessun salto dentro le macchie nel raso.
  Il calcolo: circa 3,6 s in Node.

- **I punti corti del punto sopra** (2026-10-26). Misurati sul pannello di prova: la base, lo stesso punto intero, ha lo
  0,7% dei punti sotto il millimetro; il punto sopra il 21% (3,4% sotto 0,5 mm). Per due terzi vengono dal taglio sul
  bordo (l'ultimo punto di una linea tagliata è lungo quel che avanza, da niente a un punto intero), per un quarto dai
  passaggi, il resto dagli spigoli del disegno vicino al bordo. Ora: (1) `spuntaCapi` — se il moncone del taglio è più
  corto del minimo la linea si ferma all'ago prima (solo il moncone: togliendo anche i punti corti che seguono, col
  minimo a 1,5 se ne andava il 12% del punto sopra); (2) `puntiGiusti` — fra uno spigolo e l'altro, dove c'è un punto
  corto, gli aghi si ridistribuiscono a passo uguale lungo la stessa linea (il filo resta sulla linea, a registro); uno
  spigolo con una gambetta corta si toglie se il filo si sposta al più di metà del minimo (a 0,3 mm restava il 13,5%
  sotto il millimetro). Col minimo a 1 mm: sotto 1 mm il 9,5%, sotto 0,5 lo 0,3%, mediana 1,7 mm; 1,16 m di punto sopra
  in meno su 36 (i monconi). Col minimo a 1,5: sotto 1,5 mm il 20% (era il 40%), 2,5 m in meno; qualche spigolo tagliato
  in diagonale, da guardare.
- **Coi ponti, nessun salto dentro le macchie nel punto sopra.** Nelle macchie unite dai ponti alcuni gruppi di pezzi non
  erano collegati dalle linee del punto (uno: 29 mm sopra il raso della macchia 34, per tornare al ponte d'uscita). Ora
  una corda nel verso del raso ogni millimetro (`cordeARighe`) entra nella rete: il filo ci passa fra i fili del raso.
  Salti dentro da 6 a 0, salti del punto sopra da 17 a 8 (il più lungo da 16,8 a 9,3 mm).

- **I pannelli grandi** (2026-10-27; provato su un pannello costruito ripetendo quello di prova 3 × 2: 504 macchie,
  1.071 × 206 mm, 392.000 punti). Nel tool il calcolo durava 35 s, ma lo stesso calcolo nella pagina o in un worker
  lanciato a mano 10 s: **il contatore «Calcolo… N s»**, riscritto ogni mezzo secondo, faceva ridisegnare alla pagina
  tutto il disegno (504 contorni, 105.000 vertici) e il computer non restava al calcolo. Tolto il contatore: 9 s. Poi
  il motore: l'ordine delle macchie confrontava ogni vertice di una con ogni lato dell'altra per 3.453 coppie, due volte
  (il 42% del tempo) — ora sul contorno semplificato a un decimo di millimetro e una volta sola per coppia; i punti più
  vicini fra due macchie tenuti (servivano tre volte); il controllo dei salti sul contorno semplificato; le corde ogni
  millimetro del punto sopra solo nelle macchie dove i pezzi sono staccati. In Node da 23 a 11 s (il pannello di prova
  da 3,6 a 1,8 s). E l'anteprima: un tracciato per filo invece di una linea per tratto (da 16.600 elementi a 8, l'SVG da
  8 a 6 MB). Da sapere: con la tolleranza di semplificazione a 0,02 e 0,05 mm l'ordine sul pannello di prova cambiava
  (il salto più lungo da 12 a 20,5 mm), a 0, 0,01 e 0,1 no: l'ordinatore è sensibile alle coppie al limite.

- **Il punto sopra come la base, misurato** (2026-10-28). Sul progetto di Lorenzo (dal DST: 177 macchie, punto 2e4,
  ponti a 3 mm; la base rigenerata è identica a quella del DST, 40.594 punti): salti dentro le macchie 1, in tutto 140
  (176 fra le macchie, meno i ponti); punti sotto 1 mm 4,8%, sotto 0,5 0; filo fuori dalle linee della base oltre 0,6 mm
  0,34 m su 61 (le volte fra gruppi staccati), fra 0,15 e 0,6 mm 3,7 m (gli aghi tolti nei punti corti). Sul pannello di
  prova (punto squame): nessun salto dentro le macchie, punti sotto 1 mm 7,7%, il 96% delle linee della base dentro le
  macchie ricoperto; coi ponti a 5 mm 45 salti. Calcolo: 1,5 s sul pannello di prova, 4,5 s sul progetto.
- **I salti, misurati** (2026-10-28, decisione 21). Sul progetto di Lorenzo (le macchie consecutive distano in tutto
  240 mm): **raso** 157 salti per 1.066 mm → **74 per 267 mm** (65 → 2 dentro le macchie: erano quasi tutti i buchi
  della sfrangiatura); **punto sopra** 1.393 mm → **335 mm**, fra le macchie 1.279 → 318. Sul pannello di prova: il
  salto più lungo del punto sopra da 52 a 6,7 mm, coi ponti a 5 mm i suoi salti da 45 a 8, il 99% della base dentro le
  macchie ricoperto (era 96%); le nove macchie di Stilista: salti del raso 44 → 33 mm, passaggi 269 → 303 mm.
- **Il raso verso la macchia dopo** (2026-10-27). Col salto a 80 al millimetro nel piano del raso: salti 354 → 329 mm in
  tutto, il più lungo 13,1 mm, 62 su 83 entro 5 mm; passaggi sotto il raso 2.734 → 2.831 mm.

- **Le tre correzioni del 2026-10-29, misurate** sul pannello di prova (84 macchie), col punto 2e4 di Lorenzo (il preset
  `RG-PUNTO-SQUAMA-2e4-PASSAGGI` dell'8 ottobre: la v2 non è su disco) e col punto squame delle prove.
  (1) **La base dentro le macchie**: tracciato a 4 passaggi 2.573 → 127 mm (prima versione, coi pezzetti sul bordo)
  → **0 mm**; a 2 passaggi 2.504 → 5.078 mm; fuori dalle macchie a 4 passaggi 3.307 → 3.064 mm (la striscia di un
  millimetro accanto al bordo, dove i pezzetti dentro si allungano, passa a 2); la base intera 55,8 → **50,2 m** di filo.
  Punti della base sotto 1 mm: **52 prima e 52 dopo**, tutti fuori dalle macchie (sono del Generatore); allungando i
  pezzetti a 1 mm esatto ne nascevano 129 da 0,99–1 mm per gli arrotondamenti, da qui l'1,01. Il punto squame non ha
  barrette a 4: non cambia (200 punti sotto 1 mm prima e dopo). (2) **La fase**: aghi dentro le righe con un ago della riga accanto entro 0,3 mm di altezza
  **58% → 1,1%** (con la fase a 0, 91%); punti del raso 15.995 → 16.959 (+6%), il più lungo sempre 4 mm, sotto 1 mm
  0,7%. (3) **Il punto sopra sfasato**: aghi del punto sopra a meno di 0,2 mm dal filo della base —

  | spostamento (destra, basso) | punto 2e4 | punto squame |
  |---|---|---|
  | 0, 0 (a registro, prima) | 99,3% | 99,6% |
  | 0,5, 0 | 44,6% | 66,8% |
  | 1, 0 | 50,2% | 65,3% |
  | 1, 0,5 | 14,1% | 36,2% |
  | 1, 0,8 | 12,6% | 36,5% |
  | **1, 1 (di serie)** | **12,1%** (entro 0,1 mm: 5,1%) | **35,4%** |
  | 0,7, 0,7 | 7,2% | 34,7% |

  Spostando in una direzione sola gli aghi restano sulle linee che vanno in quella direzione (le barrette orizzontali
  del 2e4, gli zig-zag dello squame): serve la diagonale. Lo squame è fitto, sotto il 34% non si scende. Il migliore
  misurato è 0,7 e 0,7, ma Lorenzo ha chiesto 1 mm a destra: con quello, 1 mm in basso. In ogni caso il punto sopra non
  esce dalla macchia (al più 0,04 mm, come prima), nessun salto dentro le macchie, salti fra le macchie 83 come prima.
  DST di prova (fuori dal repo, col progetto dentro): `Downloads\PROVA-MACCHIE-2e4-fase30-sfasato1-1.dst` (coi
  pezzetti sul bordo a 4) e `Downloads\PROVA-MACCHIE-2e4-base2-senza-pezzetti.dst` (senza, 50.050 punti, 3 stop).

## I due livelli, misurati (2026-11-03)
Il pannello di prova ha le macchie staccate (1,6 mm in mediana) e di un colore solo: **non è il disegno di Lorenzo**. Per
provare, le 84 macchie vanno a turno ai due livelli, nell'ordine di `ordinaMacchie`, e le scure si allargano attorno al
centro finché toccano le chiare. Il numero dipende da quanto si toccano. Margine 1 mm, sfrangiatura di serie.

| Scure allargate | | Salti del primo livello | mm di salto | fuori dalle scure | Passaggi sotto il secondo |
|---|---|---|---|---|---|
| × 1,6 (le chiare diventano 45) | prima | 44 | 478 | 218 | 0 |
| | dopo | **23** | **223** | **128** | 21, 346 mm |
| × 1,35 (si toccano appena) | prima | 41 | 477 | 286 | 0 |
| | dopo | 37 | 443 | 269 | 4, 96 mm |

«Prima» è lo stesso primo livello, già fermato sotto il secondo, senza le strade. Tutti i millimetri che restano fuori
dalle scure sono **salti**: nessun punto cucito del primo livello è in vista fra le macchie (il più lontano a 0,46 mm dal
contorno, cioè la sfrangiatura). Col raso di Stilista, × 1,6: 44 salti, 552 mm, fuori dalle scure 202 mm.

La tabella qui sopra è con `secondoVista` a 0 (solo filo coperto).

**Sul disegno vero di Lorenzo** (62 macchie del primo livello, 177 del secondo, letto da Stilista, fuori dal repo):

| Parametri del raso, primo livello | Salti | Filo fra le macchie | Di cui a vista |
|---|---|---|---|
| `secondoVista` 0, di serie | 51 (1.089 mm) | 85 mm | 0 |
| di serie | **0** | 1.256 mm | 285 mm in 61 attraversamenti |
| interlinea 0,25 | **0** | 1.309 mm | 288 mm in 64 |
| interlinea 0,2 | **0** | 1.275 mm | 286 mm in 62 |
| interlinea 0,15 | 1 (0,5 mm) | 1.401 mm | 291 mm in 64 |
| angolo 45° | **0** | 1.291 mm | 290 mm in 64 |
| sfrangiatura 5 | **0** | 1.415 mm | 538 mm in 122 |
| interlinea 0,2, sfrangiatura 3 | 1 (0,6 mm) | 1.369 mm | 421 mm in 114 |

Prima di `giraFuori` (decisione 31), a parità del resto: 9 salti a interlinea 0,25, 2 a 0,2, 1 con l'angolo 45°, 3 con la sfrangiatura 5.

**Lo zero non è garantito** su ogni disegno: il limite è `secondoVista` (con 5 mm, misurato prima di `giraFuori`, 19 salti). Con la
sfrangiatura 5 la zona sicura sotto il secondo si restringe, e se chiude le strade il filo passa a 0,5 mm dal suo contorno: lì le righe
sfrangiate potrebbero non coprirlo. Da guardare a macchina. Il secondo livello salta ancora: 175 salti senza ponti.

I ponti sul secondo livello (decisione 32), stesso disegno e il resto di serie, ponti larghi 2 mm:

| Ponti fino a | Salti 2° livello | Salti 1° livello | Filo a vista | Punti 2° livello |
|---|---|---|---|---|
| Nessuno | 175 | 0 | 285 mm in 61 | 60.442 |
| 3 mm | 113 | 0 | 249 mm in 53 | 61.516 |
| 5 mm | 65 | 0 | 131 mm in 35 | 63.038 |
| 8 mm | 25 | 0 | 47 mm in 23 | 64.362 |

A 5 mm con `secondoVista` 3: 16 salti nel primo livello, 15 mm a vista; con 0: 27 salti, nessun filo a vista. Allargare i ponti non
aiuta: a 3 mm, 69 salti e 140 mm a vista. Nella pagina (col pannello) a 5 mm: 143 ponti, 65 salti, 129 mm a vista. Il calcolo dura
circa il doppio, perché prima di cucire prova i passaggi fino a tre volte (da 35 a 72 s in Node, 88 s nella pagina, sulla macchina occupata).
Le strade provate prima di cucire partono dalla macchia, non dall'uscita vera: un ponte utile può mancare.

## Strade scartate
- **Il punto sopra ridisegnato in ogni macchia** (2026-10-28): colonne che seguono la forma, denti sovrapposti, la
  scala dalla base sotto. Era fatto sul punto squame del pannello di prova: col punto 2e4 di Lorenzo (zig-zag e
  barrette) non somigliava alla base; e i passaggi fra le parti (salti e volte) erano *«inaccettabili»*.
- **Il punto sopra a lobi coi passaggi sotto, sulla base tagliata** (2026-10-27): da sinistra a destra, passaggi sotto
  le linee da cucire, doppie passate sopra quelle cucite. A macchina: *«non ci siamo per niente… ci sono troppi fili che
  passano nel punto sbagliato»*. La base tagliata sulla macchia fa denti orfani e pezzi staccati (1.035 denti orfani sul
  pannello di prova), e ogni pezzo vuole un collegamento.
- **Il Generatore dentro la macchia** (2026-10-28): lo stesso punto generato con la macchia come contorno. Collega i
  pezzi correndo lungo il bordo (una cornice: nella macchia 34 ripassa 46 mm di bordo), non va da sinistra a destra, e
  sul lato destro della macchia 2 fa zig-zag.
- **Il primo ridisegno**: denti corti fino alla spina a sinistra (*«non c'è sovrapposizione»*) e una scala sola per
  tutto il pannello (nella macchia 2 il punto veniva due volte e mezzo più rado della base).
- Passaggi fra le macchie sulle linee della base (27 salti in tutto): Lorenzo non vuole ricamo fra le macchie.
- Raso e punto sopra di ogni macchia di seguito (una macchia finita, poi la successiva): Lorenzo vuole due stop.
- Il pezzo d'uscita del punto sopra tenuto da parte a ogni costo: costringeva a tornare indietro con un salto in più;
  ora, se serve comunque un salto, la riserva cade.
- Una griglia dei passaggi «a 0,8 mm dal bordo» con una fascia intorno ai capi per uscire dalla riga: chiudeva i
  colli stretti e lasciava attraversare la riga di prima (13 incroci); sostituita dalla griglia di dove il raso coprirà.
- Il piano a ricerca cieca con un tetto di passi: su una macchia di 8 parti non trovava l'ordine giusto.
- Il punto minimo di 1 mm sul punto sopra: tagliava gli angoli fuori dalla macchia; ora 0,5 mm e solo dove la
  scorciatoia resta dentro.

- **L'ordine a serpentina per fasce** (la prima da sinistra a destra, la seconda da destra a sinistra, ogni macchia nel
  verso della sua fascia; provato il 2026-10-26). Sulle nove macchie di Stilista dava il suo stesso ordine, ma sul
  pannello intero le macchie alte stanno a cavallo di due fasce: salti fino a 41 mm (fascia per fascia, 51), 808 mm in
  tutto contro 349 dell'ordine libero, e al cambio di fascia un salto sopra due macchie che nessun ingresso evitava.
  Lorenzo: libero, dentro le zone.
- La strada vera in linea d'aria: il piano sottostimava i passaggi attorno ai buchi. Su griglie da 0,4–0,5 mm, o solo
  entro 1 mm dal bordo: più svelta, ma i passaggi crescevano del 10–15%. Su tutta la macchia: stessi passaggi della
  fascia di 2 mm, ma tre volte più lenta.
- Il salto d'ingresso sempre dritto all'inizio della prima riga: 32 salti su 83 passavano sopra la macchia (fino a
  4,8 mm dentro), perché la prima riga che il piano sceglie sta spesso dall'altra parte.
- Vietare il salto anche sopra le macchie delle altre zone: con tre zone dall'alto in basso le macchie di una fascia
  sono incastrate con quelle delle altre, e l'ordine faceva salti fino a 89 mm.

- **Il «togli»** (2026-10-27): col punto sopra da sinistra a destra e il contorno mai ripassato, togliere i pezzi corti
  che si raggiungono solo saltando. Togliendo fino a 8 mm (10,6 m di punto sopra in meno su 36) restavano 361 salti
  dentro le macchie. Il problema non erano i pezzi corti ma i lobi: 250 partenze per 84 macchie, solo 11 macchie in un
  pezzo solo. Lorenzo: *«no così è un disastro»*.
- **Le corsie sul bordo** (2026-10-27): il punto a 0,5 mm dal bordo, i passaggi fra un lobo e l'altro su due corsie
  lungo il bordo, mai due volte. 43 salti dentro (con tre corsie 10, ma le corsie a 0,15 mm l'una dall'altra), il 23%
  della superficie senza punto (le macchie sono larghe in media 4,2 mm). Lorenzo: *«il ricamo risulta molto sporco»*.
- **Le colonne riportate sul bordo fino a 1,5 mm** (2026-10-27): meno passaggi visibili (0,5 m), ma vicino al bordo
  linee che seguono il contorno e denti storti; e oltre i 2 mm due colonne finivano una sull'altra. Lorenzo ha scelto il
  disegno come la base.
- **Un ordine delle macchie apposta per il punto sopra** (dalla destra di una alla sinistra della dopo): da sinistra a
  destra lungo il pannello restavano indietro macchie da riprendere, e i salti passavano sopra le macchie (38). Meglio
  l'ordine del raso, entrando nella macchia dopo dove conviene e andando sotto le sue linee fino all'inizio.
- Il punto sopra fuori dalla striscia del ponte (tagliato sulla macchia senza ponte): i suoi pezzetti tenevano collegate
  le parti della macchia, e i salti dentro salivano da 6 a 18.

## Da guardare a macchina
- (2026-11-04) i ponti sul secondo livello: se quello largo 2 mm copre davvero il filo che ci passa sotto, e dove entra
  nella macchia dopo se il filo in più si sente;
- (2026-11-03) i due livelli sul disegno vero di Lorenzo: se 1 mm sotto lo scuro basta e non fa troppo spessore; se i
  passaggi sotto lo scuro restano davvero coperti (`sfrangiatura dentro + 0,3 mm` dal suo contorno);
- (2026-10-29) la base a 2 passaggi sotto le macchie: se il raso copre ancora bene, e le barrette spezzate sul bordo;
  la fase del raso al 30%; il punto sopra spostato di 1 e 1 mm: se il filo non ribatte più e se somiglia ancora alla
  base;
- la sfrangiatura (1 mm, metà fuori) e se il bordo così è quello che serve; con la sfrangiatura grande (5 mm) le
  strozzature, dove ora le righe si accorciano al più di tre decimi per capo;
- i salti del punto sopra (decisione 21): il passaggio sulle linee fino al bordo verso la macchia dopo, e il punto dal
  bordo al primo nodo entrando;
- i ponti: se il disegno li regge, e la larghezza (2 mm);
- il punto sopra come la base: le barrette a una sola andata e ritorno, le strade sulle linee (doppie passate), le
  volte fra gruppi di linee staccati, e il filo dei salti sopra la macchia appena finita (da tagliare);
- la copertura del raso sopra la base intera;
- i passaggi lungo il bordo (a una mediana di 0,2 mm): che le punte delle righe li coprano davvero;
- il punto sopra col punto minimo a 1 e a 1,5 mm, coi fili spessi: se si ferma troppo prima del bordo, e gli spigoli
  tagliati in diagonale.

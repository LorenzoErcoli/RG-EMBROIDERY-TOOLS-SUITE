---
titolo: Rete testa speciale — rete a rombi fatta di serpentine, filo spesso affiancato sul contorno
tipo: tool
tool: [rete-testa-speciale]
data: 2026-10-15
---

**Stato: tool vero, in «In sviluppo» (2026-10-15).** `apps/rete-testa-speciale/` (motore in `src/motore.ts`,
interfaccia in `src/tool.ts`). Provato solo su disegni sintetici e sul pannello di Pattern a macchie: **manca un DXF vero
di una testa speciale** e un DST di riferimento. Non ancora provato a macchina.

## Da dove nasce
Lorenzo, 2026-10-15: *«partendo da un dxf crea un intreccio a rete con impunture con punti parametrizzati. la rete però
non si crea ad intrecci di linee ma a serpentina verticale o orizzontale o con angolo variabile. la linea quindi scende
ma scende creando uno zig zag e poi risale con lo stesso zig zag in modo da formare dei rombi»*. Il filo delle teste
speciali è **più spesso**: *«non deve sovrapporsi ma essere vicino»*.

**Prima del codice, le simulazioni visive** (sua richiesta): una pagina con i parametri a cursore, il modulo quotato e
la cucitura animata, ripubblicata a ogni sua correzione. Le decisioni qui sotto sono nate guardandola. Il motore del tool
è il porting di quella simulazione, coi numeri ricontrollati uguali (lente 3,04 / 5,04 / 2,00 mm, partenze sul contorno).

## Le decisioni di Lorenzo (2026-10-15)
1. **Larghezza e altezza del rombo**, la **direzione** della serpentina (verticale, orizzontale, qualsiasi angolo), la
   lunghezza del punto globale e **quella nei punti di sovrapposizione**.
2. **Una sola sovrapposizione.** La prima simulazione aveva *rientranza* (fra discesa e risalita) e *sovrapposizione
   fra colonne* separate: *«devo avere la stessa rientranza. non ha senso avere due controlli»*. Ogni incrocio della
   rete è uguale: discesa e risalita si incrociano di X mm, le punte di due colonne vicine degli stessi X mm.
   **Lo stesso per l'arrotondamento**: uno solo per punte e rientranze.
3. **La zona di sovrapposizione è «tutto ciò che sta dentro i 2 punti di incrocio»**: la lente che due linee fanno
   incrociandosi. L'**ampiezza** a 0 = da incrocio a incrocio, *«può salire e scendere»*. Con le linee che si toccano
   soltanto (sovrapposizione 0) la zona è l'ampiezza attorno al punto di contatto (sua risposta).
   La prima simulazione la definiva «dove un'altra linea passa più vicina di una tolleranza»: scartata.
4. **Le linee toccano sempre il bordo**, del contorno e delle aree vuote: *«ora tagli tutto allineato tra di loro
   invece… le linee devono toccare il bordo sempre»*. Ogni linea va fino al SUO bordo; la discesa e la risalita non si
   tagliano più alla stessa altezza. Tolta l'opzione «colonna chiusa sull'ultimo rombo intero», che lasciava le linee
   staccate.
5. **Sul bordo il filo non è sovrapposizione, e non si sovrappone**: *«se c'è già qualcosa sotto il filo lo spostiamo
   dentro… lo sfasamento dei tratti sul contorno è data dallo spessore del filo»*. Parametro *Spessore del filo*
   (`constructionStroke`, lo stesso id del Generatore pattern: anche lì regola rientri e raccordi). **Gli strati
   impilati vanno bene** (con due vuoti o col giro sul vuoto si arriva a 4–5 passate affiancate).
6. **Tre comportamenti all'area vuota**: passaggio intorno al bordo, impuntura dritta al centro (come nel Generatore
   pattern), e soprattutto **la serpentina che torna indietro e riattacca dopo l'area mancante**.
7. **«Quando inserisci una parte nuova inizia sempre dal contorno esterno del cartamodello»**, se si può.
8. **Sotto e sopra nelle sovrapposizioni** (dopo il primo commit): *«dividiamo i punti di sovrapposizione tra quelli che
   stanno sotto e quelli che stanno sopra, nel senso la curva che passa dopo. nella prima di def o se non c'è specificato
   niente lunghezza punto rimane come quella globale, mentre la seconda va specificata»*. In ogni lente la linea cucita
   prima è sotto (`underOverlapStitchMm`, 0 = la lunghezza del punto), quella che passa dopo è sopra
   (`overlapStitchMm`: il nome è di prima della divisione e resta, i file salvati lo usano). «Prima» e «dopo» sono
   l'ordine di cucitura vero, dopo le parti e i ritorni.
9. **Il pezzo a misure**: *«dammi la possibilità di creare reti a partire da dimensioni mie e non solo da cartamodello»*.
   `pieceSource` = `cartamodello` o `misure`; con le misure un rettangolo `totalWidth` × `totalHeight` (gli stessi id
   del Generatore pattern), senza vuoti. Caricare un disegno riporta il pezzo al cartamodello. È fatto come rettangolo
   perché è quello che Lorenzo ha chiesto: altre forme a misure (angoli arrotondati, ovale) non sono state chieste.

## Com'è costruito (non ovvio dal solo codice)
- **Larghezza e sovrapposizione si misurano sull'apice della curva**, anche arrotondata: si risolvono i vertici veri
  che danno quegli apici. Così arrotondare non stacca le linee che si toccavano.
- **Le colonne si spezzano dove nessuna delle due linee è dentro**, non dove una delle due esce. Sul bordo inclinato le
  punte entrano ed escono: tratti separati da meno di un rombo sono la stessa colonna. Senza questa regola, misurato: 24
  parti invece di 2 sul davanti di prova.
- **Le parti (blocchi)**: la serpentina va avanti finché il tratto della colonna dopo tocca il suo; i tratti che restano
  fuori aprono una parte che si cuce dopo. Delle quattro partenze possibili di ogni parte si tiene quella sul contorno
  esterno più vicina alla fine della parte prima.
- **Le passate sul contorno si posano in ordine di cucitura** e si contano: un tratto di contorno con n passate già
  posate sposta la nuova di n spessori verso l'interno, solo dove è coperto. Tre trappole trovate misurando il filo
  sopra il filo:
  1. nel punto esatto dove una passata finisce e la successiva comincia il conteggio vede un buco di un campione, e la
     passata nuova scendeva sul bordo: i buchi di un campione si riempiono;
  2. una punta che sfiora il bordo lasciava un pezzetto di rete appoggiato sul contorno fra due passate, e la passata
     spostata tornava sul bordo per raggiungerlo: se il pezzetto sta tutto entro lo spessore, si toglie;
  3. le linee della rete che arrivano su una passata spostata si fermano su di lei (non scavalcano).
- **La lente è dove due linee si sono scambiate di posto**, non «due incroci di fila». La prima versione accoppiava
  gli incroci a due a due nell'ordine lungo la linea: una lente tagliata dal bordo, con un incrocio solo, faceva
  slittare tutte le coppie e la zona diventava il tratto FRA due lenti. Lorenzo l'ha visto stringendo il rombo
  (7,5 × 14,5 sul pezzo 200 × 160: *«tutto diventa sovrapposizione»*; misurato: zone da 13,4 mm invece di 4,0); coi
  rombi larghi non si vedeva perché una soglia di lunghezza scartava quelle coppie. Ogni linea sa la sua posizione
  (lato sinistro / destro della colonna k): fra due incroci è lente se quella di sinistra è passata a destra dell'altra.
- **Punto minimo e massimo insieme (R3, R4).** Togliere un punto corto allunga quello prima (misurati 2,75 mm con
  massimo 2,5): dopo il punto minimo i punti troppo lunghi si ridividono. `enforceMinStitch` tiene sempre l'ultimo
  punto anche se corto (misurati 0,25 mm con minimo 0,5): si toglie il penultimo.

## Le misure (test/smoke.mjs)
Lente 2 · 1 · √(7² + 8²)/7 = 3,04 mm sul rombo 12 × 16 con sovrapposizione 2, una linea sotto e una sopra per ogni
lente (sotto un punto per mezza lente, 1,52 mm; sopra due, 0,76); nessun punto della rete fuori dal pezzo o
nei vuoti; col vuoto tondo 2 parti e 1 salto; ogni parte parte sul contorno esterno; nessun filo sopra filo sul
contorno; punti fra minimo e massimo; sul pannello vero di Pattern a macchie (contorno di Lorenzo, le tre macchie più
grandi come vuoti, a 30°) le stesse regole.

## Aperto
- Un **DXF vero di una testa speciale** e, se c'è, un **DST** di riferimento: chiesti, non ancora arrivati.
- I **salti fra le parti** sono salti veri: non si nascondono ancora (sotto il ricamo, o lungo il contorno).
- Con *gira sul contorno del vuoto* e due vuoti vicini resta circa l'1% di punti sul contorno dove gli strati
  spostati si incontrano negli angoli (misurato sulla simulazione, non bloccato da un test).

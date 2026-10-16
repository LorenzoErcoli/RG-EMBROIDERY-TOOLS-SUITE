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

10. **La sacca a rete** (2026-10-15): *«creare una borsa a rete che una volta uscita dalla macchina da ricamo è già una
    sacca autonoma senza dover fare aggiunte o cuciture… uno schiacciamento del rombo dal centro a fuori in modo tale
    che i lati rimangano sempre gli stessi»*; il centro *«una spirale del filo che fa da fondo»*. Con impunture, non
    cordoncino (*«lascia stare cordoncino»*). Campo macchina circa 45 × 45 cm. Prima la simulazione
    (https://claude.ai/artifact/LkTE3AX1QzEnkXp5BgpwjT), poi la scelta: **il secchiello dritto Ø 20 cm** (48 rombi da
    15 mm, fondo Ø 200, disco Ø 449, profondo 190 mm, 5,25 litri).

11. **La sacca appesa in 3D** (2026-10-16): *«simulare una certa morbidezza del filo nel 3d… come se fosse un po'
    appesa? in ogni caso solo con un bottone attivo non sempre… dentro il tools, ma un sotto programma a parte»*.
    Sotto-programma in due file (`sacca3d.ts` la fisica, `vista3d.ts` la vista), acceso dal pulsante «Sacca 3D».

12. **La testa NON si ricama** (2026-10-16). Prima l'idea: più passate in cima per una testa che regge, poi una banda
    rigida su un anello interno della misura della bocca, con la rete oltre che ricade come un colletto. Bocciate tutte e
    due dai conti e dalla vista 3D, poi da Lorenzo: *«è impossibile questa strada. nel ricamo non posso farlo mi si
    curcirebbe sopra e sotto. lascia stare la parte sopra. lasciamola libera»*. Il giro d'impuntura in cima resta
    un'opzione, **spenta di partenza**.
13. **Il cordone a strozzo, al montaggio**: *«un cordone che passa a zig zag nei buchi dell'ultima fila dell'intreccio e
    che possiamo stringerlo… si chiude a strozzo»*. Solo nella vista 3D (non è ricamo).
15. (2026-10-16, guardando la vista) *«il cordone non tocca gli apici dell'ultimo rombo, si blocca prima. Poi il fondo nel
    simulatore non prende quello parametrizzato»*: il cordone passava per i nodi dei lati (anello n − 1), ora sugli apici
    dell'ultimo anello; il fondo era una ragnatela fissa (4 giri, 8 raggi), ora sono i giri della spirale al passo del
    ricamo (al più 12 anelli nel modello) uniti dal filo della spirale e dalle legature fino alla loro profondità — la
    regola `fondoDellaLegatura` è una sola, in `sacca.ts`, per il ricamo e per il 3D.
14. **Il fondo come appoggio**: *«se la base di filo a spirale è ben progettata diventa un appoggio perché il filo si
    unisce tra le varie linee di spirale e quindi funziona da base rigida… ovviamente con morbidezza»*.
16. **La lente costante, come opzione** (2026-10-16): *«man mano che ci si avvicina al centro noto che l'area di
    sovrapposizione giustamente aumenta… sotto saranno molto più bloccati che sopra, mi sbaglio?»* Non sbaglia: la lente
    vale sovrapposizione / sin(angolo d'incrocio / 2) e verso il centro l'incrocio è stretto (secchiello: da 2,07 a
    4,05 mm). Con «Lente uguale in tutta la rete» la sovrapposizione cala verso il centro (lenti 1,92–2,07 mm), spento di
    partenza. Nella vista 3D la rigidità dei nodi (le «pieghe») pesa la lente di ogni nodo rispetto alla media: la
    morbidezza dice quanto, la lente dove. Il primo tentativo usava l'angolo della linea invece di quello d'incrocio e le
    lenti «costanti» crescevano fino a 9,85 mm.
    Misurato (N 24, morbidezza 0): appesa per due punti la rotazione degli anelli cambia (verso il fondo 35/40° → 39/47°
    con la lente costante: i nodi interni girano di più); per la bocca o per i capi del cordone non cambia quasi niente,
    lì la forma la fanno la bocca e il peso. Il peso è relativo: raddoppiare la sovrapposizione non irrigidisce tutto,
    quello lo fa la morbidezza.
17. **L'aggancio uguale** (2026-10-16): *«anche lo spostamento cambia un po' più è vicino al centro. anche quello
    dovrebbe essere uguale il rischio sennò è che non si aggancia sull'esterno»*. Spostamento, lente e aggancio (di quanto
    la punta passa oltre l'altra linea, di traverso a quella) non possono restare uguali insieme: l'incrocio va da 59° a
    149°. Misurato con 2 mm fissi: l'aggancio va da 1,64 verso il fondo a **0,39 in cima** — il rischio era vero, e
    proprio fuori. Scelta di Lorenzo: *«teniamo uguale l'aggancio: lo spostamento cresce verso fuori quanto serve, anche
    se le lenti degli ultimi anelli si allungano»*. L'interruttore della lente è diventato una scelta a tre
    (`overlapRule`: spostamento, lente, aggancio; di partenza spostamento). Con l'aggancio la sovrapposizione scritta vale
    per un rombo quadrato (incrocio a 90°): con 2 mm l'aggancio è 1,29 ovunque, lo spostamento va da 1,57 a 6,58 e le lenti
    da 2,6 a 6,8. Lo spostamento si ferma a metà del lato.
18. **Il fondo ovale** (2026-10-16): *«il centro non più per forza un cerchio ma può essere un ovale e di conseguenza
    anche la tramatura diventa ovoidale. poi ancora più interessante è immaginare di poter avere l'ampiezza da centro
    all'esterno più piccola rispetto al lato lungo. così poi quando vado a inserire il cordoncino alla fine i lati lunghi
    saranno più morbidi e sembrerà molto di più una borsa e la tensione è tutta nei lati che rimangono rigidi»*. Provato
    prima in 2D, poi in 3D (*«prima il 3D»*), poi portato nel tool (`bottomShape`, `bottomLengthMm`, `bottomWidthMm`).

19. **Al contrario: meno fascia sui lati lunghi, più sulle teste** (2026-10-16): *«ho capito una cosa, deve essere al
    contrario in realtà. meno nei lati lunghi e più nei lati corti»*. Le teste non possono crescere oltre (lì i rombi si
    aprono per primi, e il campo le ferma): si fermano prima le colonne dei lati lunghi (`cimeDelleColonne`). Simulato
    in 3D (*«mi sembra figo»*), non ancora nel ricamo.
20. **Le teste a mezzo cerchio, con un parametro** (2026-10-16): *«mi piacerebbe però che il fondo possa essere con i
    finali più tondi volendo, più mezzi cerchi appunto, ma un parametro di controllo anche quello»* →
    `bottomRoundEnds` (0 = ovale, 100 = mezzi cerchi e tratti dritti).

## Le colonne dei lati che si fermano prima (2026-10-16, simulato)
- Ogni colonna ha il suo ultimo anello: sulle teste quello di tutta la rete, sui lati lunghi quello che dà la fascia
  chiesta, in mezzo a scalare (sin² del parametro). Fra due colonne vicine al più un anello di differenza, così ogni
  nodo ha sempre i suoi due nodi sotto e i rombi restano coi lati uguali. L'ultima fila sale e scende: il cordone passa
  dal nodo più alto di ogni colonna.
- **In 3D l'effetto si rovescia davvero**: fondo 260 × 140, 64 rombi, lati fino a 60 mm (4 anelli contro 10), bocca
  stretta a Ø 90: le teste fanno pancia 24 mm (fili tesi al 77%) e i lati lunghi 4 mm (97%). Con tutti gli anelli era il
  contrario (teste 6, lati 16).
- **Il cordone non chiude più quanto prima**: i lati corti non arrivano al centro. Col cordone all'85% i fili dovrebbero
  allungarsi del 6%; al 60% la bocca resta una fessura di circa 27 cm (fili entro il 3%). Al montaggio la bocca resta
  allungata.

## Le teste a mezzo cerchio (2026-10-16, misurato)
- La forma: due mezzi ovali staccati di 2·(a − b)·tondo e uniti da tratti dritti (a 1 due mezzi cerchi di raggio b, lo
  «stadio»). Dentro, i giri del fondo con lo stesso passo su lati e teste; sui tratti dritti le legature scendono dritte.
- **Sui tratti dritti i rombi non si aprono mai** (l'anello dopo è l'anello prima spostato), e gli anelli li fermano le
  teste: con 260 × 140 e 64 rombi, ovale 10 anelli (lati 135, teste 92), al 50% 9 (126, 93), al 100% 8 (112, 93).

## Il fondo ovale: com'è fatto (2026-10-16, misurato)
- **La regola degli anelli è una sola**: ogni nodo nuovo sta a distanza L dai due nodi vicini dell'anello prima (una rete
  di Čebyšëv). Vale su qualunque fondo convesso; sul cerchio ridà gli stessi anelli di prima (scarto 0,00002 mm, dal
  campionamento dell'ovale). Il fondo ha N nodi a passo uguale lungo l'ovale, il nodo 0 sulla testa.
- **La fascia più corta sulle teste viene da sola**, senza un parametro: dove l'ovale curva di più i rombi si aprono in
  fretta (in cima 146° sulle teste, 64° sui lati: fondo 260 × 140, 64 rombi) e gli anelli si fermano quando lì arrivano
  all'angolo massimo o al campo. Fascia: lati lunghi 135 mm, teste 92. La rete finita è più tonda del fondo (443 × 410).
  Con meno rombi la differenza cresce ma gli anelli calano (48 rombi: 112 contro 60, 9 anelli, teste a 170°).
- **In 3D, bocca stretta a Ø 90** (morbidezza 70%, fondo rigido 60%): la parete dei lati lunghi fa pancia 15 mm e i suoi
  fili sono tesi al 93%; le teste 5 mm e 97%. Sul cerchio 6 mm e 97% ovunque. Tenuta da un punto solo (i capi del
  cordone) anche la sacca tonda pende storta: per confrontare lati e teste serve la bocca chiusa al centro.
- **La spirale ovale**: i giri sono gli ovali di mezzi assi (a − b) + f·b e f·b, che restano alla stessa distanza
  sull'asse lungo e su quello corto (un ovale in scala li avrebbe più radi sulle teste del rapporto a/b); al centro si
  chiudono su un tratto dritto lungo 2·(a − b). Le legature entrano lungo questi ovali, la profondità misurata sul mezzo
  asse corto.
- **Gli incroci dell'ovale** si calcolano nodo per nodo (le due linee che passano dal nodo, la media): lente e aggancio
  della regola scelta per ogni nodo, lo spostamento lungo il suo anello. Con «lente uguale» le lenti misurate vanno da
  2,5 a 3,1 mm (sul cerchio 1,9–2,1): la media delle due linee non è esatta dove l'ovale è asimmetrico.
- **La rigidità del filo nel 3D è troppo bassa** (Lorenzo: *«la borsa sta su molto di più perché il filo è più rigido
  e resistente»*). Misurato: in piedi alta 14 mm con morbidezza 70%, 20 con 0%. Provati (e tolti): una parete che resiste
  a uscire dal piano dei vicini (22 mm: la sacca crolla tutta intera a cupola, i rombi la lasciano scendere) e nodi molto
  più rigidi (0–1 mm: si ripiega piatta sul fondo, perché la «piega» è una distanza e una linea ripiegata del tutto ha la
  stessa distanza di una dritta). Serve una piegatura ad angolo, tarata su una misura del campione vero. Da fare.
- **Da sapere**: nella vista 3D la presa «per la bocca» mette la bocca su un cerchio e «appoggiata» parte da una forma
  stretta in proporzione; la tabella delle bocche (`formaSacca`) è solo per il fondo tondo.

## Perché la testa rigida non può funzionare (2026-10-16, misurato)
**Ogni anello tenuto alla sua misura del disco piatto blocca piatta tutta la rete dentro di lui.** Il lato fra un anello
fermo e quello prima si allungherebbe se il secondo si stringesse, e così via verso il centro: la rete scende solo
stringendo gli anelli. Quindi una testa rigida sul bordo tiene la bocca alla misura del disco (Ø 449: la rete resta un
disco), e una banda rigida su un anello interno (Ø 322) lascia dentro un piatto (scende 7–19 mm, e dove sembra di più i
fili si allungherebbero del 5–20%) con il colletto che ricade 77 mm: un paralume, non una sacca. Vale anche col fondo
morbido. Una bocca fissa più stretta del disco si ottiene solo da fuori: il cordone.

## La sacca appesa: com'è fatta (2026-10-16)
- **Fili che non si allungano ma si allentano** (vincolo «al più L», Verlet + vincoli ripetuti) e la gravità. Conta solo
  la forma finale. Appesa per la bocca (ultimo anello fermo su un cerchio) o per due punti del bordo.
- **Il fondo è una ragnatela di fili** (4 giri e i raggi), non un disco rigido: appesa per la bocca Ø 200 scende 261 mm
  col filo morbido, più dei 190 della tabella (che tiene il fondo piatto). Le due cose sono vere insieme: dipende da
  quanto il fondo a spirale cede davvero, ed è da vedere a macchina.
- **La morbidezza è una piega nei due versi**: la prima versione resisteva solo a chiudersi, ma appendendo la rete le
  linee si raddrizzano, e la morbidezza non cambiava niente (misurato: 261 mm con tutti i valori). Ora 0 → 202 mm,
  0,5 → 219, 1 → 261 (scala 0,004 per ripetizione: con 0,08 tutto oltre 0,3 dava lo stesso risultato).
- **I nodi di un anello non stanno più vicini di due spessori di filo**: senza, la sacca si stringeva fino a un punto.
- **Il fondo rigido è una forma che tiene** (i nodi del disco del fondo tirati verso la loro forma piatta, spostata e
  inclinata nel modo più vicino: la tecnica dei corpi rigidi). Le molle semplici non bastavano (il fondo «rigido» si
  piegava più di quello molle: 78 contro 62 mm). Tarata ripida: al 20% scende ancora di 41 mm, dal 60% è piatto. Col
  fondo rigido e la bocca Ø 200 la sacca scende 177 mm: torna col calcolo esatto, che col fondo piatto dà al più 190.
- **Il cordone** passa fra i nodi dei lati dell'ultima fila (l'anello n − 1) con tratti uguali (scorre nei buchi), si
  chiude dove esce e da lì i capi (120 mm) salgono alla mano. Il primo tentativo faceva passare la presa dentro il giro:
  la bocca pendeva come un cappio invece di chiudersi a collo.
- **Le ancore**: appesa da pochi punti, gli errori dei vincoli si sommano lungo la catena (fili «allungati» fino
  all'86%). Ogni nodo ha la sua distanza più corta, lungo i fili, dal punto di presa, e più in là non va: un vincolo vero
  (il filo non si allunga). Il cordone, che regge tutto con pochi tratti, si corregge più volte (prima: 9%).
- **Il fondo vero pesa sul calcolo**: i giri pendono da poche legature e gli errori si sommavano (fili «allungati» fino
  al 17%); si correggono più volte i fili del fondo (3) e del cordone (8). Con 25 anelli nel modello appesa per i capi
  serviva 150 s: ora al più 12 anelli e smorzamento 0,94 (la forma finale non cambia): 2–12 s.
- **Vuota non sta in piedi**: appoggiata, le pareti ricadono sul fondo (alta 14–23 mm anche col fondo rigido). Appesa per
  i capi, morbida, pende chiusa come un fagotto (larga ~11 cm); col fondo rigido tiene la larghezza del fondo.
- **Con la bocca larga quanto il disco i fili dovrebbero allungarsi del 5%**: la vista dice che non si può, invece di
  mostrare una forma finta (la stessa scoperta della simulazione: il disco teso non scende).

## La sacca: cosa si è capito (simulazione, 2026-10-15)
- **La matematica**: anelli di nodi sfalsati di mezzo passo, lati lunghi L: ρ(j+1) = ρj·cos(π/N) + √(L² − ρj²·sin²(π/N)).
  La prova di Lorenzo (15 rombi, fondo Ø 50, disco Ø 120) torna con lato 13 mm (2 rombi per raggio) e con lato 20 mm
  (uno): la sua frase «2 per lato» non ha deciso quale, e non serve più.
- **Il disco ha un raggio massimo, L / sin(π/N)**: lì i rombi sono piatti. La prova di Lorenzo era quasi al limite.
- **Con la bocca larga quanto il disco la rete non si muove**: ogni rombo è già aperto al massimo. La sacca si forma
  solo stringendo la bocca. Un giro d'impuntura in cima non tiene aperta la bocca: il filo si arriccia, non si allunga.
  (Un primo conto con la bocca fissa dava 10 mm di profondità: erano lati allungati, impossibili; scoperto misurando.)
- **La forma la decide il fondo**: rombi più piccoli o più grandi danno quasi la stessa sacca (36×20, 48×15, 60×12).
  Nel campo da 45 cm si arriva a circa 8 litri; fondo grande = sacca larga e bassa, fondo piccolo = tubo alto.
- **Aperto**: la bocca senza qualcosa di rigido non sta aperta; la spirale del fondo regge solo con le legature, e
  dentro i 5 mm dal centro un giro resta sciolto; i nodi devono poter girare (punti corti nelle lenti = nodi rigidi).

## Com'è costruito (non ovvio dal solo codice)
- **La cucitura è una sola per le due reti** (`cuci` in `motore.ts`): la geometria (a colonne o radiale) consegna i
  pezzi in ordine di cucitura e dice come leggere le lenti (`locale`, `ordine`, `giro`); vuoti, filo affiancato sul
  bordo, lenti sotto/sopra, punti e punto minimo/massimo sono gli stessi. Lo spostamento non ha cambiato un punto della
  rete a colonne (impronta identica su cinque casi).
- **Fra due pezzi consecutivi si ignora solo il punto dove si attaccano**, non tutti gli incroci: nella rete radiale
  discesa e risalita di una colonna sono attaccate (con l'ultimo anello pari si toccano in cima), e ignorandole si
  perdevano tutte le lenti alle rientranze (misurate 672 invece di 1248).
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

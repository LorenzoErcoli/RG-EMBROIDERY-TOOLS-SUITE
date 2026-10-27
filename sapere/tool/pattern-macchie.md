---
titolo: Pattern a macchie — base a pattern, raso nelle macchie, sopra lo stesso punto a registro
tipo: tool
tool: [pattern-macchie]
data: 2026-10-08
---

**Stato: tool vero, in «In sviluppo» (2026-10-08).** `apps/pattern-macchie/` (motore in `src/motore.ts`, interfaccia
in `src/tool.ts`). Non ancora provato a macchina.

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

## Come è fatto, e perché
- **Il punto sopra è la base tagliata sulla macchia**, a registro, ma con una sola andata e ritorno dove la base va e
  torna più volte (le barrette a 4 passaggi del punto 2e4).
- **Ingresso e uscita.** In ogni macchia si entra nel punto dell'interno più vicino a dove si è usciti; un passaggio
  SOTTO il raso (A* su griglia, lontano dal bordo più della sfrangiatura: il raso lo copre) porta all'inizio delle righe.
  Il raso sceglie da quale cella e da quale angolo cominciare guardando dove FINISCE: dal lato della macchia dopo. Il
  piano dà per scontato che dall'ingresso si arrivi sotto il raso a ogni riga; se alla sua prima riga non si arriva, si
  rifà il piano con la prima riga che non si raggiunge pagata come un salto fin lì (decisione 21). Vicino ai capi della
  strada vale anche il raso fuori dal bordo, fin dove la sfrangiatura va fuori (le righe cominciano lì).
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

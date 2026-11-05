---
titolo: Punto Striato, il sesto tool — e le decisioni che ne hanno fissato il modello
tipo: tool
tool: [striatura]
data: 2026-07-31
---

**Punto Striato** (`apps/striatura`, id `striatura`) è il sesto tool della suite, avviato il
2026-07-31 dal DST di riferimento `PUNTO-STRIATURA.dst` di Lorenzo. Costruisce **striature verticali
in punto semplice** che formano **macchie maculate** su una **base di riempimento parallelo**.

## Le decisioni di Lorenzo

Prese rispondendo a domande e dopo la prima prova, bocciata:

- **Ingresso:** DXF/SVG, oppure un oggetto pieno dalle misure (come [interlace](interlace.md)); le aree
  vuote (R5) si rispettano.
- **Colore:** monocolore per ora. I 7 cambi colore del DST di riferimento erano **solo marcatori** di
  macchia e spostamento, **non colori**. Il multicolore verrà: il motore è già "a strati" per non
  doverlo riscrivere.
- **La macchia è un grappolo di striature (trattini distinti), non un riempimento pieno.** Ogni
  striatura va in **retrace**: dal centro sale e torna, scende e torna (trattino marcato).
  `stitchMode: 'retrace'` è il default.
- **Lo spostamento fra le macchie è riempimento parallelo continuo, niente salti.** Il filo resta
  cucito (corsa verticale) e si confonde con la base. **Non è un salto.**

**La lezione:** la prima prova aveva **invertito** i due ruoli (macchia = riempimento pieno,
spostamento = salto). Lorenzo l'ha bocciata chiedendo *«la visualizzazione è il ricamo reale?»* — sì:
la linea è il percorso dell'ago. Da lì il modello giusto.

## Com'è fatto

**Serpentina a righe** (riga → giù → riga, come il DST). Ogni cella (colonna × riga) è una striatura:
fitta dentro le macchie (`densitySpacingMm` 0,4–0,8 mm), rada fra una macchia e l'altra
(`fillSpacingMm` 1,7–2,0 mm), collegata da tragitti dritti in punto corsa = il riempimento continuo.
`striaturaLengthMm` è l'altezza della riga/trattino (~18 mm). Il frastaglio viene da lunghezze
variabili (`jaggedLengthMm`) e da una fase verticale per colonna (le partenze non sono allineate).
Punto ~1,9 mm, verticale al 99%. Misurato senza interfaccia: di default un filo continuo (0 salti),
0 punti nel vuoto.

Il 2026-08-25 Lorenzo ha approvato macchie e passaggi così come sono (A2 in `STATO.md`), e ha lasciato
com'è l'attraversamento orizzontale fra le righe.

## Macchie più piccole e ricamo sopra (2026-11-03)

Lorenzo: *«Poi da modificare il punto striato, in cui i parametri siano più chiari e gestibili, ora mancano
delle info, tipo non capisco come rendere le macchie più piccoline. E anche lì provare a indicare dove poi
andrà il ricamo sopra con altre grafiche, perché almeno i passaggi li faccio fare lì sotto. Considera che dovrò
fare un progetto che prevede base ricamo da Stilista, punto sfrangiato sulla base, livello macchie chiaro e
livello macchie scuro.»*

**La grandezza ora comanda davvero.** La macchia è fatta di trattini e sta su righe alte un trattino: la sola
grandezza non accorciava i trattini, e abbassarli a mano portava i salti. Sotto i 22 mm (`misureEffettive` in
`engine.ts`) `blobSizeMm` accorcia insieme `striaturaLengthMm`, il frastaglio e `passaggioAmpMm`. Da 22 in su il
ricamo non cambia: DST identici byte per byte a quelli di prima, tranne dove prima c'era un salto. Un progetto
salvato con grandezza sotto 22 riaperto viene diverso.

Rettangolo 120×150, media su 8 varianti; altezza e larghezza delle macchie sono la mediana dei grappoli di
trattini vicini, pesata sui trattini (macchie vicine si contano unite):

| | macchia alta × larga | trattino | punti | filo | salti |
|---|---|---|---|---|---|
| grandezza 22 prima e dopo | 91 × 26 mm | 17,6 mm | 10.544 / 10.555 | 19,6 m | 0,6 / 0 |
| grandezza 8 prima | 46 × 5,5 mm | 17,2 mm | 7.245 | 13,5 m | 0,3 |
| grandezza 8 e trattini a 6 a mano, prima | 31 × 6,4 mm | 6,4 mm | 10.625 | 18,0 m | **11,6** |
| grandezza 8 dopo | 21 × 5,9 mm | 6,4 mm | 9.508 | 15,2 m | 0 |
| grandezza 6 prima | 38 × 4 mm | 17,1 mm | 6.192 | 11,6 m | 0,3 |
| grandezza 6 dopo | 13 × 3,9 mm | 4,8 mm | 8.674 | 13,5 m | 0 |

Con le macchie piccole i punti sotto 1 mm nel DST sono pochi ma salgono: in media 0,1 a grandezza 22, 1,3 a 8, 4 a
6 (il più corto 0,94 mm, è l'arrotondamento del DST). Il punto più lungo arriva a 3,10 mm a 8 e 3,30 mm a 6. I
passaggi crescono perché ci sono più macchie: 1,17 m a 22, 3,06 m a 8, 4,17 m a 6.

**Provato e scartato:** ridurre in proporzione anche la distanza fra i passaggi (`fillSpacingMm`). Faceva una greca
su tutto il campo: 4,3 m di passaggi a grandezza 8 invece di 3,1. Lorenzo aveva già chiesto di evitarlo (*«evitare
tutte queste fasce di passaggi»*).

**La tasca da una cella.** La cella libera più vicina al filo poteva essere una tasca fra i buchi dei trattini,
da cui non si va da nessuna parte, anche col campo libero a due celle di distanza: il filo saltava. Ora il filo
esce verso il corridoio vero più vicino, al massimo 6 celle (~5 mm) attraverso il cucito (`fuoriDallaTasca`).
0 salti su 8 varianti, da grandezza 22 a 4, anche col vuoto (salvo un vuoto che taglia in due il pezzo). Chiude i
«rari salti da tasca murata» rimasti aperti dal 2026-08-25.

**Nuovi campi.** `blobVariationPct` («Differenza fra piccole e grandi», era fisso nel codice: ±50%) e `coverMarginMm`
(«Margine dal ricamo sopra»). Tutto quello che cambia la macchia ora sta nel gruppo *Macchie*.

**Il ricamo sopra.** Lorenzo, sempre il 2026-11-03, col programma laser aperto in Stilista: *«comunque aperto su
stilista c'è il programma con laser che dovrebbe poi creare la base del progetto. per il punto striato il punto
dovrebbe essere casuale, ma usare le macchie (che è dove verrà ricamato sopra) per andare a fare i passaggi»*.

Quindi le zone non sono una grafica grande: sono **le macchie stesse**, tante e sparse. Le striature restano casuali
e non seguono le macchie; sono i passaggi a usarle. Ruolo nuovo dei colori `COVER_AREA` («Ricamo sopra»). Prendendo la
selezione da Stilista, il contorno più grande fa la sagoma e le forme di un altro colore tutte dentro di lui
diventano Ricamo sopra (si corregge dal menu). In alternativa, il bottone *Ricamo sopra dalla selezione di Stilista*
le aggiunge dopo aver preso la sagoma.

~~**Prima versione, stesso giorno (bocciata).** Serpentina a righe, passaggi cercati col minimo di filo in vista e linee
rade spente: 1,47 m in vista a grandezza 22.~~ Lorenzo, guardandola: *«La gestione del passaggio sotto le aree di ricamo
superiori è un disastro si formano delle linee improbabili. perchè?»*. Misurato: un passaggio da 106 mm per coprirne 11
(sotto le zone un millimetro costava 1/50), 420 ingressi e uscite dalle zone con 185 passaggi, il 94% del filo in vista
storto invece del 47%. **La lezione:** i metri in vista non bastano. La forma del passaggio si guarda e si misura.

**La versione di adesso.** Lorenzo: *«sì, procedi col rifacimento, considera che se più comodo le macchie dello striato
possono costruirsi anche in base allo spazio libero lasciato dalle macchie sovrastanti. il che significa che in maniera
sempre casuale riempe solo quesgli spazi e poi fa i passaggi sotto le altre macchie. OVviamente per la sicurezza di
ricentrature la struatura deve comunque un po' entrare dentro la macchia e non essere disegnata rispetto alle macchie
superiori ma in maiera normale. non deve appunto noatarsi il fatto che sopra poi andrà una macchia guardando le striature»*.

- **I trattini sono quelli di sempre**, disegnati senza guardare le zone, e restano interi. Cade solo un trattino che sta
  tutto più dentro una zona di `coverOverlapMm` («Le striature entrano sotto il ricamo di», 3 mm di serie, numero scelto da
  me). Quelli a cavallo del bordo non si tagliano.
- **Con le zone non c'è più la serpentina a righe** (`cuciSottoLeZone`): si cuce a *file*, trattini vicini della stessa
  riga, nell'ordine che lascia meno filo in vista, a fasce (vedi «Sempre sotto, a zone» più avanti). La serpentina resta uguale senza zone:
  i DST senza zone non cambiano. Niente linee rade; l'interruttore `coverNoPassLines` della prima versione è tolto.
- **Il filo esce dal capo del trattino che entra sotto la zona**, ripassando sul trattino stesso, e arriva allo stesso modo
  sul prossimo. Lo spostamento resta cucito, mai un salto (solo se un vuoto taglia in due il pezzo).
- **La strada ha un costo:** sotto una zona un millimetro vale 0,05, in vista 1, sopra i trattini in vista 30. Si tira dritto
  dove il filo dritto non costa più della strada: niente scalini.
- **I passaggi stanno lontani dal bordo della sagoma e dai vuoti** come il ricamo (trovato dallo smoke test: cucivano sul bordo).
- **Non è un'area vuota** e `coverMarginMm` resta: i passaggi si contano nascosti solo a questa distanza dal bordo.

Il ruolo `COVER_AREA` («Ricamo sopra»), la presa da Stilista e il bottone restano come sopra. Il pannello conta i metri in
vista e sotto il ricamo, e può evidenziare i passaggi in arancione (solo a schermo).

**Lo sfrangiato aiuta.** Lorenzo, vista la versione qui sopra: *«ma come mai ci sono questi passaggi così lunghi che passano
in mezzo un po' a caso? Capisco la scelta di elimianare quelli coperti, ma secondo me è utile provare a costurire anche in
base a dove verrà coeprto, per allungare o restringere un po' lo sfrnagiato e far partire o finirte nelle vicinanze di parti
coperte»*. Misurato il perché: a grandezza 22 si cucivano 190 file, una su tre partiva nel bianco, e sotto le zone il filo
costava troppo poco (0,33) rispetto a un giro in più. Fatto:

- il primo e l'ultimo trattino di una fila, se non toccano una zona ma ne hanno una vicina, si **allungano** fin sotto, al
  massimo di quanto vale il frastaglio (`jaggedLengthMm`); non si **accorciano** (non è servito: chi attraversa una zona ha già
  un tratto coperto, e il filo ora può entrare o uscire da lì);
- il filo costa 0,9 sotto le zone invece di 0,33: un passaggio corto conta più di uno nascosto. **Scambio accettato da me, da
  giudicare a occhio:** un po' più di filo in vista, ma linee più corte.

**Provato e scartato:** cucire ogni macchia intera prima di uscire. Colonna per colonna: 1.352 passaggi e 27 m di filo in più.
Riga per riga: 1,46 m in vista contro 0,96, perché dentro una macchia grande i salti di riga restano.

**Sul pannello laser di Lorenzo** (361 × 307 mm, 177 forme, il 52% del pezzo; variante 1):

| | Grandezza 22: prima versione → rifatta → ora | Grandezza 8: prima versione → rifatta → ora |
|---|---|---|
| passaggi in tutto | 5,39 → 3,34 → 3,01 m | 18,14 → 5,33 → 5,51 m |
| in vista | 1,47 → 0,97 → 1,02 m | 4,83 → 1,48 → 1,87 m |
| il più lungo | 120 → 140 → 76 mm | 142 → 60 → 38 mm |
| oltre 60 mm | ? → 7 → 2 | ? → 1 → 0 |
| partono sotto una zona | ? → 64% → 75% | ? → 64% → 68% |
| con un giro di oltre una volta e mezza la distanza (oltre 10 mm) | 24 → 16 → 9 | 130 → 1 → 9 |
| trattini in vista attraversati | 165 → 59 → 56 | 362 → 181 → 155 |
| filo | 128,7 → 126,9 → 126,8 m | 95,7 → 84,6 → 86,1 m |

(? = non misurato su quella versione.) Su 4 varianti: 0 salti; in vista 0,86–1,03 m a grandezza 22, 1,25–1,43 a 14, 1,88–1,89 a
8, 2,35–2,49 a 6. Senza zone sono 9,6 m a grandezza 22 e 21,5 m a grandezza 8.

**Cosa non è ancora a posto:**
- in alcune varianti resta uno o due passaggi molto lunghi: il più lungo fra 67 e 132 mm a grandezza 22, fra 56 e 191 a 14, fra 38
  e 139 a 8, fra 20 e 32 a 6. Cambiando *Variante* si può evitarli;
- i passaggi in vista sono quasi tutti storti (95–98%): non si confondono con le striature;
- attraversano ancora dei trattini in vista (56 e 155), quando costa troppo aggirarli;
- il punto più lungo sul pannello arriva a 3,8 mm a grandezza 8 e 6 (chiesti 3);
- calcolo da 1,1 a 3,3 secondi a ogni modifica su quel pannello.

**Sempre sotto, a zone.** Lorenzo, 2026-11-05, su una linea in vista fra due zone: *«no ma linee che passano così in mezzo sono
inaccettabili, deve passare sempre sotto la macchia»*, e *«comunque si passa a lavorare a zone, come al solito valutando il modo
migliore per ricamare»*. Prima, su come stava cucendo: *«a me sembra davvero poco elegatne… i passaggi ora sono linee dritte, ma
potrebbero seguire in maniera pià elegante le macchie che ci sono sopra»*. Questa regola supera il costo 0,9 qui sopra: conta
quello che resta fuori a lavoro finito, non quanto è lungo il filo lì sotto. Fatto:

- sotto una zona un millimetro costa 0,05. **Le immagini con le zone trasparenti ora mostrano linee più lunghe e non
  significano niente:** si giudica con le zone piene;
- l'ordine delle file si decide sul costo vero della strada (griglia di 2,4 mm, da ogni fila fino alle 30 vicine), non sul
  filo dritto: sotto le zone si gira quasi gratis e il filo dritto non lo sapeva;
- la strada sceglie insieme da dove uscire e dove entrare, fra i capi e i tratti coperti delle due file;
- **zone di ricamo** come in Pattern a macchie (`stopZones` «Dividi in zone», `stopZonesDirection` «Le zone vanno»): una fascia
  dopo l'altra, libero dentro, la fascia dopo comincia vicino a dove è finita quella prima. Il filo esce dalla fascia al massimo
  di 12 mm. Niente stop e niente tagli fra una zona e l'altra: è lo stesso filo. Di serie 3, dall'alto in basso (numero scelto da
  me: su questo pannello sono 10 cm; da confermare). Solo col ricamo sopra: senza zone «Ricamo sopra» il DST non cambia.

**Sul pannello laser, 3 varianti, com'era → 3 zone** (con 1 zona e 6 zone i tratti in vista restano più lunghi o uguali):

| | Grandezza 22 | Grandezza 8 |
|---|---|---|
| tratto in vista più lungo | 20–35 → 12–13 mm | 16–22 → 12–18 mm |
| tratti in vista oltre 15 mm | 5–11 → 0 | 2–5 → 0–2 |
| filo in vista | 0,86–1,03 → 0,61–0,80 m | 1,88–1,89 → 1,84–2,02 m |
| filo sotto le zone | 1,92–2,13 → 3,71–3,82 m | 3,46–3,62 → 8,23–8,86 m |
| filo in tutto | 127–131 → 128–132 m | 80–86 → 85–91 m |

0 salti. **Il minimo possibile non è zero:** le 177 forme sono 176 zone staccate, e per collegarle tutte servono 175 attraversamenti,
0,76 m in tutto, il più largo 11 mm, 29 oltre 5 mm. Quindi «sempre sotto» è possibile solo a meno di questi ponti. A grandezza 8 il
filo in vista non cala: cala solo il tratto più lungo.

**Le uscite dalle punte.** Lorenzo, stesso giorno: *«ma se le uscite non fossero solo da sinistra a destra della machia striata, ma in
necessità possano passsare anche per le punte? rivedendo come si disegna magari si esce su una struatura più vicina ad un punto
coperto»*. Una fila cucita da un capo all'altro finisce per forza all'altro capo, spesso nel vuoto. `usciteDallePunte` («Uscite dalle
punte», acceso di serie, scelta mia, da confermare): se i due capi non sono già coperti, la fila parte dal mezzo del suo tratto coperto
più lungo, va e torna un trattino sì e uno no su un lato, poi sull'altro, e finisce accanto a dove è partita. Se nessuna punta è
coperta, si allunga, nei limiti del frastaglio, quella che ci arriva con meno. Ogni trattino si cuce una volta sola, come prima; fra
due trattini il filo salta due colonne invece di una.

Sul pannello laser, 3 zone, 3 varianti, spento → acceso: grandezza 22, in vista 0,61–0,80 → 0,56–0,74 m, tratti in vista oltre 5 mm
43–62 → 42–58; grandezza 8, in vista 1,84–2,02 → 1,43–1,49 m, oltre 5 mm 117–135 → 91–102. Il tratto più lungo non cambia (12–18 → 11–16
mm a 22 e 8). Filo totale uguale, 0 salti. **Non provato in macchina:** il salto di due colonne a metà dei trattini, su macchie da 0,6 mm.

**Provato il 2026-11-04 e il 2026-11-05 e tolto:**
- finire la macchia che si vede, poi uscire (l'idea di togliere del tutto il legame con le righe): in vista 1,04–1,28 m contro
  0,86–1,03 a grandezza 22, 2,6–2,8 contro 1,9 a grandezza 8;
- passaggi che seguono le zone con le curve, costo 0,3–0,8 più alto verso il bordo: 20% in meno in vista, ma linee dritte rimaste e
  a lavoro finito quasi uguale;
- macchiette (macchie minuscole al posto dei passaggi, sparse a caso): con il triplo di macchiette i passaggi oltre 30 mm restavano
  una ventina; messe come tappe sui passaggi lunghi funzionano senza zone. **Non è deciso:** la divisione denti / macchiette che
  Lorenzo ha proposto il 2026-11-04 resta da riprendere; le prove non sono nel codice.

**Da guardare:** il calcolo sale a 2,5–5 secondi a ogni modifica su quel pannello (era 1,1–3,3). Il filo sotto le zone raddoppia: da
vedere in macchina se fa spessore sotto la grafica. Non provati: Stilista, il ricamo in macchina.

**Le etichette** sono in `REVISIONE-PARAMETRI.md`. Lorenzo le ha viste come proposta e non le ha corrette.

**Provati:** la presa della selezione sul vero Stilista, in sola lettura, con la versione bocciata (i ruoli vengono giusti
da soli). **Non provati:** questa versione con Stilista, il bottone *Ricamo sopra dalla selezione di Stilista* sul vero
Stilista (solo finto plugin), il ritorno in Stilista con le zone, il ricamo in macchina.

DST di prova fuori dal repo, sul pannello: grandezza 22: 67.887 punti, 0 salti, 126,8 m, punto più lungo 3,09 mm; grandezza
8: 53.841 punti, 0 salti, 86,1 m, punto più lungo 3,50 mm. I parametri e i ruoli si rileggono dal file.

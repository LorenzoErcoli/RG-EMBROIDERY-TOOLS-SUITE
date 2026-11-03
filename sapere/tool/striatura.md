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

**Non è un'area vuota**: lì il ricamo continua, e le macchie del Punto Striato restano le stesse con le zone o senza.
Lo spostamento resta cucito, mai un salto. L'ordine resta la serpentina a righe. Il filo corre dritto sotto le zone,
anche sopra i trattini, perché la grafica lo coprirà. Con le zone si spengono **tutte** le linee rade di passaggio
(`coverNoPassLines`, «Con il ricamo sopra: niente linee di passaggio», acceso di serie), che fuori dalle zone restavano
in vista e non servivano: il filo arriva lo stesso. Senza zone non cambia niente. Il pannello conta i metri in vista e
quelli sotto il ricamo, e può evidenziare i passaggi in arancione (solo a schermo).

**Sul pannello laser di Lorenzo** (361 × 307 mm, 177 forme, il 52% del pezzo; letto da Stilista in sola lettura, varianti
1 e 2), metri di passaggi in vista:

| Grandezza | Senza zone | Solo perché le forme coprono | Passaggi instradati sotto, linee rade accese | **Linee rade spente (di serie)** |
|---|---|---|---|---|
| 22 | 9,6 / 9,1 | 4,8 / 4,4 | 4,0 / 3,7 | **1,47 / 1,29** |
| 8 | 21,5 / 21,4 | 10,3 / 10,3 | 9,4 / 9,4 | **4,83 / 4,75** |

0 salti in tutti i casi. Calcolo circa 2 secondi a ogni modifica su questo pannello, contro 0,1–0,4 senza zone.

Con una zona sola, su un rettangolo 120×150, media su 8 varianti:

| Zona | Grandezza 22: prima → dopo | Grandezza 8: prima → dopo |
|---|---|---|
| cerchio di raggio 30 al centro | 0,92 → 0,48 | 2,50 → 1,76 |
| fascia verticale larga 30 | 0,81 → 0,43 | 2,17 → 1,56 |
| fascia orizzontale alta 30 | 0,89 → 0,43 | 2,43 → 1,60 |
| due riquadri 30×30 | 1,02 → 0,51 | 2,70 → 1,87 |

*Prima* è il ricamo di prima, contando in vista solo quello fuori dalla zona. **Provato:** instradare il filo sotto
la zona tenendo le linee rade dava solo il 3–6% (cerchio a 22: 0,89 m): il guadagno viene dallo spegnerle.

**Cucire macchia per macchia (scartato per ora).** Una stima fuori dal motore dava 0,37 m invece di 0,89 col cerchio a
22. Proposta prima di queste parole di Lorenzo, che ha risposto *«avanza»*. Con le linee rade spente la serpentina arriva
a 0,48 m senza riscrivere l'ordine. Non è stata provata nel motore; la stima era ottimistica (linee dritte, senza
controllare se passano sopra altre macchie).

**Le etichette** sono in `REVISIONE-PARAMETRI.md`. Lorenzo le ha viste come proposta e non le ha corrette.

**Provato:** la presa della selezione sul vero Stilista, in sola lettura, col programma aperto: ruoli giusti da soli.
**Non provati:** il bottone *Ricamo sopra dalla selezione di Stilista* sul vero Stilista (solo con un finto plugin, che dà
la zona al posto giusto), il ritorno in Stilista con le zone e il ricamo in macchina. Il punto più lungo sul pannello arriva a 3,16 mm a grandezza 22 e 3,77 mm a 8 (chiesti 3).

DST di prova fuori dal repo, sul pannello: grandezza 22: 68.674 punti, 0 salti, 128,7 m, 1,47 m in vista, 3,92 m sotto;
grandezza 8: 57.587 punti, 0 salti, 95,7 m, 4,83 m in vista, 13,31 m sotto. I parametri e i ruoli si rileggono dal file.

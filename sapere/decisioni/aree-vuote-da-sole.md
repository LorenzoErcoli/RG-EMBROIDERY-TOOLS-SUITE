---
titolo: Un'area vuota vale anche da sola, senza confine di ritaglio
tipo: decisione
tool: [pattern-grammar]
data: 2026-10-01
---

Un tracciato marcato **Area vuota** (R5) ora toglie il suo buco **anche se nessuna tinta è marcata
*Confine di ritaglio***. Senza perimetro il bordo è il **rettangolo del pannello**: il vuoto toglie il
buco, e tutto il resto — formato, raccordi, ingombro — resta com'era.

## Perché

Lorenzo (2026-10-01): *«però io sto vedendo che non funziona. possibile che devono esserci 2 colori?»*
Sì, e il perché stava in `apps/pattern-grammar/src/tool.ts`: se nessuna tinta era *Confine di
ritaglio*, `rebuildBoundary` buttava via tutta la sagoma e rimetteva *Sagoma di ritaglio* su «nessuna»
— **in silenzio**. Un file con solo il buco veniva ricamato pieno. La domanda «dove NON ricamare» non
ha bisogno di una risposta alla domanda «fin dove ricamare»: sono due cose diverse, e prima erano
legate.

Misurato sul caso vero (buco di 30 mm in un pannello da 120): prima 720 punti dentro il buco, fino a
13,1 mm di profondità; dopo, i punti dentro restano solo quelli **appoggiati sul bordo** (profondità
≤ 0,04 mm, ed è voluto: sul bordo del vuoto ci si appoggia). Fuori dal buco **non si perde un punto** e
l'ingombro del pattern non cambia.

## Come si applica

- Nel motore (`generator/applyBoundary.ts`) c'è un posto solo che decide cos'è il perimetro quando non
  c'è: `perimetroImportato` restituisce il rettangolo del pannello. Lo usano dentro/fuori, il taglio
  dei segmenti e i raccordi — così le tre risposte non possono divergere (R28).
- In `generatePattern.ts` il contorno importato detta il **formato del pannello solo se ha un
  perimetro**: con le sole aree vuote il formato resta quello del disegno o quello scelto. Senza questa
  riga il pannello si allargava fino al buco e il formato smetteva di tagliare (visto misurando: 159,7
  → 198,3 mm di altezza).
- Restano valide le due strade di prima: **due tinte** (confine + vuoto) o **una tinta con due anelli**
  chiusi, dove vale la convenzione di Illustrator (il più grande è il perimetro, gli altri sono buchi).
- Vedi anche [aree di scarico](aree-di-scarico.md): sono un'altra cosa — lì si ricama con meno
  passate, qui non si ricama affatto.

## Il seguito: dentro il vuoto si passa a impuntura (2026-10-01)

Lorenzo, subito dopo: *«il ricamo non deve evitare del tutto di passare in quel vuoto, ma deve
diventare un'impuntura normale con distanza punto definita. Quindi se l'area è al centro di colonne di
punti particolari, dentro quell'area i punti particolari spariscono e tutto diventa un'impuntura
semplice per poi riprendere fuori dall'area.»*

Campo **Impuntura nelle aree vuote** (`voidStitchMm`): `0` = il vuoto resta vuoto (come sopra), un
valore = dentro il vuoto ogni corsa del filo diventa la **retta** da dove entra a dove esce,
ricampionata a quel passo. Il motivo per cui sono due cose e non una: il vuoto serve sia a **non
ricamare** (un'apertura, uno specchio) sia a **non ricamare il motivo** (una zona che deve restare
piatta ma tenuta). Sono due mestieri diversi, e li distingue un numero.

Due trappole pagate misurando:

1. Il taglio sui buchi va **spento** mentre si attraversa, altrimenti toglie l'impuntura appena messa.
2. La prova «la retta resta dentro il vuoto?» va fatta sulla corda fra il **primo e l'ultimo punto
   dentro**, non fra entrata e uscita: quelle due stanno fuori per definizione, e su un vuoto convesso
   la prova diceva sempre «esce» — il ripiego scattava sempre e dentro tornavano 64 cambi di direzione
   e punti da 1,23 mm invece dei 2,00 voluti.

Il ripiego serve ai vuoti **concavi** (a C, a L), dove la retta uscirebbe dall'area e si poserebbe
sopra il pattern di fuori: lì l'impuntura segue la strada che faceva il filo, allo stesso passo.

## I bordi e l'ordine (2026-10-01, sul davanti LASER-AI col punto canvas)

Lorenzo: *«c'è una sorta di spostamento, quando io vorrei che nel punto di contatto con la linea
dell'area vuota iniziasse subito l'imbastitura. E vorrei che fosse tutto ordinato: la linea
dell'imbastitura perpendicolare precisa fino all'altra parte.»*

Come si fa adesso, colonna per colonna:

1. si parte dal **punto di contatto vero** con la linea (dove il filo la attraversa, non l'ultimo punto
   fuori);
2. sulla linea fino all'**asse della colonna** (la x media dei suoi punti): una riga per colonna, a
   passo regolare;
3. **dritti** in verticale fino alla linea dall'altra parte;
4. sulla linea fino a dove il pattern riprende.

Le trappole, trovate tutte misurando sul file vero e non a occhio:

- **Il punto minimo mangiava i capi delle righe.** La pulizia del bordo del motore toglie i punti
  «boundary» più vicini del minimo al precedente: era proprio la testa della riga, e il filo
  scavalcava la linea senza toccarla. I capi sono «structural», e fra due punti fissi troppo vicini
  vince il capo. Ci sono voluti quattro giri (125 → 15 → 7 → 0): ogni giro ha rivelato un caso che
  il precedente nascondeva.
- **Una colonna che sfiora un angolo** tagliava l'angolo con una corda: ora resta sulla linea, e gli
  spigoli della linea non si tolgono.
- **Un pezzo grande fermava il motore**: un tratto continuo da oltre centomila punti passato con
  `push(...)` sfonda lo stack. Col vuoto attraversato il filo non si spezza più, quindi ci si arriva
  prima: è un rischio che cresce con questa funzione, e il test ora lo controlla.

Resta visibile, fuori dal vuoto: lo zig-zag del canvas tagliato sulla linea fa piccoli «uncini» dove
l'ultimo punto del pattern raggiunge la testa della riga (sul davanti LASER-AI: 891, da 1 a 4 mm).

**Decisione di Lorenzo (2026-10-02): gli uncini restano.** Viste le due alternative sulla stessa zona —
(1) dall'ultimo nodo un angolo retto, in orizzontale fino all'asse e poi giù dritti; (2) il canvas
tagliato esatto sulla linea, col raccordo che corre sopra la linea — ha scelto di non cambiare: *«gli
altri mi sembra vadano ad alterare troppo la forma»*. Non riproporle come miglioria: il criterio è che
la forma del pattern fuori dal vuoto conta più della pulizia del raccordo.

## Il preset è il pattern, il formato è il pezzo (2026-10-02)

Lorenzo: *«vorrei che il preset tocchi tutto tranne larghezza e altezza, così se ho già caricato un svg
non me lo toglie e non mi cambia le dimensioni»*; e importando un SVG o un DXF *«metti automaticamente
larghezza e altezza del pattern in modo che copra tutto il pezzo»*.

Come si applica: un preset descrive il **pattern** (zig-zag, colonne, deformazioni, punti); il
**pezzo** — formato, sagoma di ritaglio, cartamodello e ruoli — lo decide il disegno caricato. Caricare
un preset non tocca il pezzo; caricare un disegno porta il formato a coprirlo.

Da sapere per i file di Lorenzo: i contorni di Illustrator possono essere **aperti di poco** senza che si
veda (il rettangolo del davanti LASER-AI: 1,1 mm). Un contorno aperto non ritaglia, e il pattern esce dal
pezzo in silenzio. Il Generatore ora chiude quelli con un ruolo fino a 5 mm, e lo scrive.

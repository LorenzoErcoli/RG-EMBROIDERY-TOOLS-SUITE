# Gli obiettivi — i numeri da battere

Tutti i numeri sono misurati sullo stesso caso di prova (vedi `06`), con spaziatura **0,3 mm**,
cioè una densità chiesta di **3,33 mm di filo per mm²**.

La colonna «oggi» è quello che il sistema attuale consegna. La colonna «obiettivo» è dove deve
arrivare perché il pezzo sia ricamabile.

## A. Omogeneità — è l'obiettivo principale

| misura | oggi | obiettivo | perché |
|---|---|---|---|
| mediana / densità chiesta | 98% | **100% ± 3%** | già rispettato: il contratto medio c'è |
| p95 / p5 (dispersione) | **3,6×** | **≤ 1,5×** | è il numero che dice «omogeneo». 3,6× vuol dire che una cella su venti ha tre volte il filo di un'altra |
| celle sopra il 150% del chiesto | **17%** | **≤ 2%** | sono gli addensamenti che si vedono |
| celle sotto il 60% del chiesto | ~8% | **≤ 2%** | sono i buchi. Più gravi degli addensamenti |
| vuoto massimo fra due corse vicine | non misurato | **≤ 2 × spaziatura** | oltre, passa il tessuto |

Il numero singolo più importante è **la dispersione p95/p5**. Tutto il resto ne discende.

Nota su come si contano le celle: solo quelle **interamente dentro** l'area ricamata. Una cella a
cavallo del bordo è ricamata a metà e falserebbe la coda bassa (ci siamo cascati: era metà del
difetto apparente).

## B. Direzione — il vincolo di leggibilità

| misura | oggi | obiettivo |
|---|---|---|
| angolo fra il punto e la perpendicolare alla transizione di colore, sui bordi che separano due tinte | non misurato sistematicamente | **≤ 20° per il 90% del bordo** |
| rotazione del punto per millimetro percorso (mediana) | 3,0 °/mm | nessun obiettivo assoluto: **non deve peggiorare** rispetto a oggi |

La direzione può cedere dove è geometricamente necessario (vedi `01`), ma deve restare vera dove il
colore stacca — è lì che l'occhio la legge.

## C. Il filo e la macchina — vincoli da non peggiorare

Questi sono già a posto e vanno tenuti, non migliorati:

| misura | oggi (disegno intero, 353 mm) |
|---|---|
| filo totale | 481 m |
| filo di collegamento (passaggi) | 15,1 m = **3,1% del totale** |
| rasafili (tagli del filo) | 52 |
| punti | 199.710 |

Vincolo: **i passaggi non devono superare il 6% del filo**, e i rasafili non devono superare **150**
sul disegno intero. Un passaggio scoperto più lungo di 50 mm non è accettabile: attraversa il
disegno e si vede.

## D. Il non-obiettivo, per ora

**La sfumatura (frangia) è fuori scope.** Il committente è stato esplicito: prima l'omogeneità, poi
si torna a capire come sfrangiare. Nelle prove tienila spenta (`frangiaMm: 0`): è un parametro.

Attenzione a un effetto controintuitivo già misurato: **con la frangia accesa la densità misura
meglio** (17% di celle sopra il 150%) che con la frangia spenta (24%). Non è un merito della
frangia — accorcia le corse a profondità diverse e quindi spalma su più millimetri il filo che si
accumula in fondo alle corse. Vuol dire che una parte del difetto sta **in fondo alle corse**, cioè
nel giro del pettine, non nel corpo del riempimento.

## E. Come si dichiara una vittoria

Una proposta è accettata se, sul caso di prova di `06`:

1. la dispersione p95/p5 scende sotto 1,5×;
2. né gli addensamenti né i buchi superano il 2% delle celle;
3. i vincoli di `C` restano rispettati;
4. e **si vede**: il ricamo disegnato a filo sottile deve reggere il confronto a occhio con le
   fotografie di riferimento. I numeri verdi su un ricamo brutto non contano — è già successo, ed è
   il motivo per cui `06` produce anche i disegni e non solo le tabelle.

# Il problema, in millimetri

## Cos'è il raso

Il raso è il punto pieno del ricamo: file di filo affiancate che coprono un'area. Ogni **corsa** è un
tratto di filo che attraversa l'area; le corse stanno una accanto all'altra a una distanza costante,
la **spaziatura**. Il filo va e viene: si arriva in fondo a una corsa, si gira, si torna indietro
accanto a quella appena fatta. Il filo non si stacca.

Nel nostro caso la spaziatura di lavoro è **0,3 mm** e il punto massimo lungo la corsa è **3 mm**
(oltre, il filo resta lasco e si impiglia).

## Cosa vuol dire «omogeneo», detto in modo misurabile

Il filo posato per unità di superficie deve essere costante e pari a **1/spaziatura**. Con
spaziatura 0,3 mm: **3,33 mm di filo per mm²**.

Si misura così: si divide l'area in celle (usiamo 2 mm di lato, che è la scala a cui l'occhio legge
un addensamento), si somma il filo che cade in ogni cella, si divide per l'area della cella. Si
guarda la **distribuzione**, non la media: la media è quasi sempre giusta anche quando il ricamo è
pessimo, perché il troppo di qua compensa il troppo poco di là.

Due difetti opposti, tutti e due gravi:

- **sovrapposizione** — il filo si accavalla. Il ricamo si gonfia, tira il tessuto, e in macchina
  l'ago può rompersi sul filo già posato;
- **buco** — passa il tessuto. È il peggiore dei due: un addensamento si vede, un buco si vede *e*
  fa fallire il pezzo.

## Come deve venire

Prima di leggere il resto, guarda le fotografie in `foto-ricamo/`. Sono ricami pittorici veri, e
sono la definizione dell'obiettivo: i numeri qui sotto dicono quando un riempimento è omogeneo,
quelle dicono che aspetto deve avere. In questo lavoro è già successo di avere misure verdi su un
ricamo brutto.

## Cosa vuol dire «che curva»

Il punto deve seguire il disegno. In particolare, dove due colori si incontrano, **il punto deve
essere perpendicolare alla linea di separazione** — deve attraversarla, non correrle parallelo. È il
requisito che rende il ricamo leggibile come immagine invece che come tessitura, ed è stato ribadito
più volte dal committente.

Su un'area curva questo significa che la direzione del punto **ruota** man mano che si avanza.

## Il nodo

Queste due pretese — *distanza costante fra le corse* e *corse che seguono una direzione assegnata* —
**non sono simultaneamente soddisfacibili** su una direzione qualunque.

Formalmente: data una famiglia di curve che seguono un campo di direzione, la distanza fra due curve
vicine è costante solo se il campo è «parallelo» (curvatura geodetica nulla lungo le curve). Un campo
che nasce da un disegno non lo è quasi mai. Dove la fascia curva, le corse convergono sul lato
interno della curva e divergono su quello esterno: **per costruzione**, non per un errore.

I ricamatori risolvono empiricamente: sul lato che si apre **infilano un punto in più**; sul lato che
si stringe **fanno finire un punto prima**. Sono i due accorgimenti classici, e il sistema attuale li
ha tutti e due. Non bastano — vedi `03` per quanto non bastano, e `04` per cosa abbiamo provato
invece.

## La domanda aperta

Come si costruisce un riempimento che sia omogeneo entro le tolleranze di `02`, e che segua la
direzione del disegno abbastanza da rendere l'immagine?

Non è detto che la risposta sia «un algoritmo di riempimento migliore». Potrebbe essere:

- **cambiare la forma del problema** — spezzare le aree in fasce dove il campo *è* quasi parallelo,
  e le due pretese tornano compatibili (è quello che fa un ricamatore quando divide un petalo in
  sezioni). È la direzione che il committente ha indicato come preferita;
- **cambiare cosa si ottimizza** — costruire il riempimento a partire dalla densità voluta invece che
  dalla direzione voluta, e lasciare che la direzione emerga;
- **cambiare la geometria di partenza** — non un campo di direzione, ma una decomposizione dell'area
  in pezzi con una struttura che garantisca il risultato;
- qualcos'altro.

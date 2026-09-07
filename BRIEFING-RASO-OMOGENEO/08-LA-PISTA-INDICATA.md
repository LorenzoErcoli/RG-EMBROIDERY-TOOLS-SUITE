# La pista indicata dal committente — un'ipotesi, non un requisito

Messa in fondo apposta: va letta **dopo** aver capito il problema, e va trattata come una fra le
possibili risposte, non come la specifica.

## Da dove nasce

Dall'impossibilità geometrica descritta in `01` e confermata in `04`: su un campo di direzione
qualunque, «corse che seguono la direzione» e «corse a distanza costante» non possono essere vere
tutte e due. Il problema come lo abbiamo posto **non ha soluzione**.

A quel punto le uscite sono tre, e sono state messe sul tavolo così:

1. **omogeneo, e la direzione cede** — il punto segue il disegno quasi ovunque, ma dove il campo gira
   troppo si mette di traverso. Filo perfettamente uniforme, immagine meno leggibile;
2. **perpendicolare, e la densità cede** — dove siamo, e la strada per migliorarlo sarebbe una
   retroazione sulla copertura vera invece delle soglie locali fra coppie di vicini;
3. **cambiare la forma del problema** — spezzare le aree grandi in **fasce più strette**, dove il
   campo *è* quasi parallelo e le due pretese tornano compatibili. È quello che fa un ricamatore vero
   quando divide un petalo in sezioni.

**Il committente ha scelto la 3.**

## Cosa vuol dire, in concreto

Su una fascia stretta e poco curva, la contraddizione praticamente sparisce: le corse che
l'attraversano restano a distanza quasi costante perché non hanno spazio per divergere. Il difetto
nasce sulle aree grandi, dove il campo ha modo di ruotare parecchio da un capo all'altro.

Quindi: prima di riempire, **decomporre**. Le domande aperte, e sono tutte aperte:

- **dove si taglia.** Sull'asse mediano? Dove la curvatura del campo supera una soglia? Dove la
  larghezza cambia troppo? Dove il campo ha una singolarità?
- **quanto stretta deve essere una fascia** perché la contraddizione sia sotto tolleranza. Questo si
  può *calcolare*: la deriva della distanza fra due corse vicine dipende dalla curvatura geodetica
  del campo lungo la corsa, e dalla lunghezza della corsa. C'è un legame quantitativo fra «quanto
  ruota il campo» e «quanta densità perdo», e non l'abbiamo ancora scritto;
- **cosa succede sulla cucitura fra due fasce.** È il punto delicato: lì due riempimenti si
  incontrano, e se non si incastrano bene si ottiene esattamente il difetto che si voleva togliere,
  concentrato su una linea. Un ricamatore le fa incastrare a denti;
- **l'ordine di cucitura fra le fasce**, e come il filo passa dall'una all'altra senza vedersi. Il
  routing esiste già e funziona: gli si consegnano le corse in ordine e fa il resto.

## Perché resta un'ipotesi

Perché nessuno l'ha ancora misurata, e questo lavoro ha già smentito tre ipotesi ragionevoli su
quattro. La decomposizione in fasce potrebbe:

- risolvere il problema;
- spostarlo sulle cuciture fra fasce, dove sarebbe più visibile perché allineato;
- oppure rivelare che la cosa giusta è un'altra, per esempio riformulare il riempimento come un
  problema di ottimizzazione sulla densità e lasciare che la decomposizione emerga invece di
  imporla.

**Se, guardando il problema, la risposta giusta ti sembra un'altra, dilla.** La richiesta esplicita
del committente è stata: che veda dove siamo, ma abbia *totale libertà di esprimersi e cambiare
direzione*.

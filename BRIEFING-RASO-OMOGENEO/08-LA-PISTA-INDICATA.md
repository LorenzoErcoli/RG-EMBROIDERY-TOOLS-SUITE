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

---

## Aggiornamento: la pista e' stata battuta, e regge

Costruita in `apps/pittorico/src/band-fill.ts` («riempimento a fronti»). Tre tentativi prima di
quello giusto, e ognuno ha lasciato un numero:

1. **ψ come rapporto di distanze** dalla rotaia e dal lato opposto: satura sul bordo piu' vicino
   — da alcuni semi arriva a 1 in 4 mm, da altri in 87. Non e' una coordinata di fascia.
2. **ψ armonica** (Laplace, rotaia 0 / lato opposto 1 / derivata nulla altrove): coordinata
   giusta, e con una proprieta' vera — per una funzione armonica la spaziatura fra due corse varia
   come 1/|∇ψ| — ma la DIREZIONE che ne viene, su una macchia con un bordo di colore corto,
   vortica dove il disegno non vortica. Il disegno l'ha bocciata prima dei numeri.
3. **fronti lungo il campo armonico a linee**: si parte dalla rotaia, si segue il campo di sempre,
   ogni Δ di cammino ci si ferma sul fronte fatto dai punti di tutte le corse e lo si risemina a
   spaziatura esatta, sfalsato di mezzo passo. Piu' la regola del setaccio, estesa a tutte le
   corse: **una corsa avanza solo in territorio vergine** e si ferma a mezzo passo dal filo gia'
   posato. E' quella regola che ferma i fiumi di convergenza e fa morire i fronti (senza, il
   fronte scivolava lungo i bordi liberi e girava in tondo: 400 fronti, 360 mm di cammino in un
   ritaglio da 90).

Misurato sul ritaglio, **senza sovrapposizioni fra colori** — cioe' sul solo riempimento:

```
                    p5    mediana   p95   p95/p5   celle sopra il 150%
tracciato (prima)  2,25    101%    5,85    2,5×          10%
a fronti           2,23     96%    4,47    2,0×           2%
ago per ago        da 2,6-3,1× a 1,7-2,2×
```

L'obiettivo «≤ 2% di celle troppo dense» e' raggiunto. La dispersione p95/p5 e' a 2,0× contro
l'obiettivo 1,5×: quello che resta sono le code corte, non piu' i fiumi.

Con le sovrapposizioni accese il 18% delle celle sta ancora sopra il 150%, e il **98% di quelle
sta entro 3 mm da un bordo**: e' la crescita di un colore sotto l'altro (5 mm dove sfuma, 1,5 dove
stacca) cucita a densita' piena da tutti e due gli aghi. Non e' un difetto del riempimento — e' un
parametro, ed e' la prossima decisione: il colore che sta sotto, nella zona di sormonto, va cucito
a densita' ridotta, o la crescita va ridotta.

Δ non conta per la densita' (2% a 2, 3, 5, 8 e 15 mm) ma conta per la resa: a 3 mm il ricamo era
una maculatura di tratti corti, a 15 e' un raso con la grana continua. Default 15.

Disegno intero: 38 s, 490 m di filo, passaggi 5,6% (era 3,1%: le corse sono piu' e piu' corte,
e i fronti costano qualche salto in piu'), 55 rasafili.

Il punto di metodo che ha sbloccato tutto non e' stato una misura: e' stato **vedere il ricamo**
(`scripts/vedi.ts` scrive PNG senza librerie). Le due prime versioni avevano numeri ambigui e
un'immagine che diceva subito cosa non andava.

### Secondo giro: il disegno intero, e le «macchie interne»

Lorenzo, provando l'app sul disegno intero: «il riempimento e' diviso a macchie internamente».
Vero, e io non l'avevo visto perche' avevo guardato solo il ritaglio. Sul disegno intero la
spazzata dalla rotaia muore dopo pochi fronti (7 su una macchia da 45.000 mm²) e il resto lo
faceva il setaccio, seme per seme: 5.689 corse su tinta 0, e ognuna si ferma dove capita. Le
«macchie interne» erano colonie di corse del setaccio con la fase del pettine diversa.

Il rimedio ha avuto due tentativi:

- il bordo dello scoperto come rotaia successiva: **non puo' funzionare**, ed e' geometria. Una
  spazzata copre un tubo di linee di campo, quindi quello che resta confina col coperto lungo una
  linea di campo — sempre un fianco, mai un fronte. Seminarci sopra da' corse parallele al filo
  appena posato, che il territorio vergine ferma al primo passo;
- un **fronte sintetico**: dal punto piu' profondo del vuoto si traccia la perpendicolare al campo
  fin dove il vuoto finisce, e da li' si spazza nei due sensi. E' il setaccio con un seme che fa un
  pettine intero invece di una corsa. Setaccio su tinta 0: 5.689 -> 2.708 corse (con tetto a 40
  giri), e sul ritaglio da 1.307 a 267.

Disegno intero, solo riempimento: **p95/p5 1,8×, mediana 103%, celle sopra il 150% 3%**.

Il prezzo e' stato il tempo: ricalcolare la mappa dello scoperto cella per cella a ogni giro ha
portato il disegno intero da 38 a 400 secondi. Con una griglia di copertura aggiornata stampando
le corse man mano: 74 s. Ancora sopra il minuto, ed e' il prossimo costo da abbassare.

Resta un difetto di RESA che i numeri non vedono: dove due pettini si incontrano (un fronte
sintetico, o il capo di una spazzata) la fase cambia e a volte due corse si incrociano ad angolo
stretto. Si vede negli zoom a 24 px/mm, non nella mappa di densita'.

### Il riferimento a mano, letto (`riferimento-a-mano.dst`)

Lorenzo ha tracciato lo stesso disegno a mano in Stilista, messo il raso sulle macchie e regolato
gli orientamenti: «piu' o meno e' quello che mi aspetterei tu sia in grado di fare». Letto e
misurato con `scripts/vedidst.ts`:

```
419,7 × 353,3 mm · 4 aghi · 42 BLOCCHI in tutto · 62 salti · 513 m
punto: mediana 3,0 mm, p90 3,05 (tutto suddiviso a 3 mm)
spaziatura equivalente 0,31 mm
densita': p5 2,30 · mediana 3,25 · p95 4,93 · p95/p5 2,1× · celle sopra il 150%: 6%
```

Due cose che cambiano il quadro:

1. **I numeri di densita' del riferimento sono quelli che il sistema gia' fa** — anzi il sistema
   e' un po' meglio (1,8×, 3%). L'obiettivo 1,5× di `02` era piu' severo del ricamo fatto a mano.
   Sulle curve un raso ha il ventaglio, e un professionista lo accetta.
2. **Quello che differisce e' la STRUTTURA.** 42 blocchi per tutto il disegno: ogni fascia d'onda
   e' UN raso solo, con i punti che vanno da un lato all'altro della fascia e l'orientamento che
   ruota dolcemente lungo la fascia. Dove una forma e' troppo curva o troppo larga (la sfera a
   strisce) e' tagliata a mano in SETTORI, con un taglio netto, e ogni settore ha il suo
   orientamento. Nessuna cucitura dentro un blocco. Il fondo chiaro e' ricamato anche lui, a raso.

Quindi la pista 3 va letta cosi': non «fasce» trasversali dentro il riempimento, ma la macchia
spezzata in **colonne di raso** — ognuna con due lati lunghi e un asse — e ogni colonna cucita da
parete a parete, perpendicolare all'asse. La decomposizione e' il lavoro vero; il raso in una
colonna e' il problema classico e risolto.

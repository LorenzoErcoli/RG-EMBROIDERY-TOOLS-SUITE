# Dove siamo — com'è fatto oggi, e quanto vale

**Tutto quello che c'è in questo file è discutibile.** È descritto perché serve sapere da cosa si
parte, non perché vada conservato.

## La catena, in ordine

Da un'immagine RGB (mai un vettore: il sistema deve reggere partendo dal raster) a dei punti di
ricamo:

1. **riduzione a tinte** — median-cut deterministico, più un pareggio della luce e un'attenuazione
   della grana; ogni tinta è un ago. Tipicamente 4 tinte;
2. **regioni** — dalla mappa dei colori ai poligoni con i loro fori (contorno a 4 vicini, poi
   Douglas-Peucker a 1,5 pixel). Le chiamiamo **macchie**;
3. **larghezza della transizione** — per ogni tratto di bordo si misura sull'immagine ORIGINALE
   quanto è larga la sfumatura fra i due colori: sotto una soglia il colore stacca netto, sopra
   sfuma;
4. **crescita** — ogni macchia si allarga sotto quelle che verranno cucite dopo (1,5 mm dove stacca,
   5 mm dove sfuma), così fra un colore e l'altro non si vede il tessuto;
5. **campo di direzione** — campo armonico sull'angolo raddoppiato (cos2θ, sin2θ), risolto a cascata
   grossolano→fine. Condizione al bordo: **perpendicolare** dove il bordo separa due tinte,
   **libera** sulle testate;
6. **riempimento** — due motori, vedi sotto;
7. **frangia** — solo dove il bordo sfuma, accorcia le corse di quantità diverse per fare il degradé.
   *Fuori scope per questo lavoro*;
8. **serpentina** — le corse si uniscono in un filo continuo, girandone una su due;
9. **passaggi** — dove la serpentina si spezza, il filo va nascosto sotto i colori che verranno o
   tagliato (routing con mappa di copertura e A\*);
10. **punto minimo e massimo** — nell'ordine giusto: prima il minimo, poi si rimette il tetto
    suddividendo.

Il pezzo che non regge è il **6**.

## I due motori di riempimento

### Dalla rotaia (`rail-fill.ts`) — usato quando la macchia ha un lato che confina con un colore già cucito

- si semina a **distanza costante lungo la rotaia** (un lato del contorno);
- ogni seme **attraversa** l'area seguendo il campo di direzione;
- dove due corse vicine si allontanano oltre 1,8 volte la spaziatura, si **infila un cuneo**: una
  corsa nuova che comincia a metà, esattamente alla profondità dove il vuoto si è aperto;
- dove due corse vicine si stringono sotto 0,75 volte la spaziatura, quella di troppo si **tronca**;
- passate accessorie: le **ombre** dietro i fori (il bordo del foro fa da seconda rotaia) e una
  passata finale che **chiude i vuoti** rimasti, a setaccio sulla copertura.

### A distanza costante (`curved-fill.ts`) — usato dove non ci sono due bordi contrapposti

Jobard & Lefer, streamline evenly-spaced: le corse nascono e muoiono da sole per mantenere la
distanza. Ordina la distanza, non l'ordine di cucitura — infatti il risultato è fitto ma sparso.

## Il difetto strutturale, detto chiaro

**Tutti e due tracciano le corse e poi sperano.** I punti nascono alla distanza giusta — sui semi o
sulla rotaia — e da lì ognuno segue il campo per conto suo. Ma un campo di direzione non conserva la
distanza. Cuneo e troncatura sono due toppe sulla perdita, una per lato, e non possono chiuderla
perché intervengono *dopo* che la distanza è già stata persa, e su una coppia di vicini alla volta
invece che sulla densità vera.

## Quanto vale, oggi

Ritaglio di prova 90 × 90 mm, spaziatura 0,3 mm, frangia accesa:

```
densità chiesta 3,33 mm di filo per mm²
  p5 2,00 · p25 2,75 · mediana 3,27 (98%) · p75 4,30 · p95 7,25
  dispersione p95/p5: 3,6×
  celle sopra il 150% del chiesto: 17%
  di quelle, l'82% sta entro 3 mm dal bordo (mediana 1,0 mm)
  le celle normali stanno a 3,5 mm dal bordo
```

**Il difetto è addossato al bordo.** È l'indizio più forte che abbiamo, e nessuna delle spiegazioni
provate lo copre del tutto:

- non sono i passaggi (nel 95° percentile valgono l'8% del totale);
- non sono le sovrapposizioni fra colori diversi (la somma dei singoli aghi è il 93% del totale);
- ogni ago **da solo** consegna una mediana fra il 90% e il 112% del chiesto: il contratto medio è
  rispettato, è la dispersione che non lo è;
- il contorno delle macchie **non è frastagliato**: inverte la curvatura una volta ogni 9 mm.
  Lisciarlo peggiora (vedi `04`).

Resta in piedi il sospetto sul **giro in fondo alla corsa**: lì ogni corsa deposita un tratto
trasversale, e con la frangia spenta tutti quei giri cadono alla stessa profondità.

## Cosa c'è già di buono e converrebbe non buttare

Non è un vincolo — è un avviso su cosa costerebbe rifare:

- la **misura** (`06`): è costata più del codice ed è affidabile;
- il **routing dei passaggi**: risolto, 3,1% del filo, e vale per tutta la suite;
- la **serpentina**: se il riempimento consegna corse ordinate, il filo continuo è gratis;
- la **riduzione a tinte** e la **tracciatura delle regioni**: stabili, nel core, usate da altri due
  strumenti.

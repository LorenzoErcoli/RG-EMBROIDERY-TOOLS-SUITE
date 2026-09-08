# Raso curvo omogeneo — dossier di partenza

> **ACCANTONATO il 2026-09-08**, per decisione di Lorenzo: «non ci siamo. Mettiamo da parte questo
> progetto per ora, lo accantoniamo e lo lasciamo stare, per riprendere poi da un'altra parte una
> nuova cosa». Il tool resta nella suite e funziona (carica, genera, esporta), ma il riempimento
> non e' al livello del riferimento fatto a mano. Chi riprende parte da qui:
>
> - **dove siamo**: la coda di `08-LA-PISTA-INDICATA.md` — tre motori costruiti e misurati (fronti,
>   curve di livello, colonne), il riferimento a mano letto (`riferimento-a-mano.dst`), e il
>   verdetto: i NUMERI di densita' sono gia' quelli del riferimento (1,8× contro 2,1×), quello che
>   manca e' la STRUTTURA — pochi blocchi grandi, ognuno un raso da parete a parete;
> - **l'ultimo motore, `colonne.ts`**, ha la struttura giusta (scheletro, tagli come dati, colonne
>   parallele ogni 24 mm, 12 s sul disegno intero) ma le giunzioni sono sporche: vuoti fra strisce
>   vicine, ventagli dove un asse finisce, mediana al 116%. E' un lavoro delimitato, non fatto;
> - **il default e' tornato a `fasce`**: ha le «macchie interne» ma non ha buchi, e per chi apre il
>   tool oggi e' il male minore. `colonne` si sceglie con `metodoRiempimento`;
> - **non fatto**: l'interfaccia per correggere i tagli (i dati ci sono, la vista no), i sormonti
>   sulle colonne, la frangia sul nuovo riempimento.
>
> Tutto e' committato su `master` fino a `0450fda` piu' questo commit. Le misure si rifanno con
> gli script di `06-COME-MISURARE.md`; `scripts/vedi.ts` disegna il ricamo in PNG ed e' lo
> strumento che ha guidato ogni scelta degli ultimi due giorni: guardare prima di misurare.


Questa cartella serve a **far entrare qualcuno nel problema senza fargli rifare la strada**, e senza
legargli le mani.

Il problema è vecchio quanto il ricamo a macchina e non è risolto qui: riempire un'area con del raso
che **segue la curva del disegno** e che sia **omogeneo** — niente sovrapposizioni, niente buchi. Ci
stiamo lavorando da diverse iterazioni, abbiamo misurato molto, e siamo arrivati a un punto in cui
sappiamo *perché* il metodo attuale non basta. Non sappiamo ancora qual è quello giusto.

## Come usare questa cartella

Leggila in ordine. Ogni file risponde a una domanda:

| file | domanda |
|---|---|
| `01-IL-PROBLEMA.md` | cos'è il raso, e cosa vuol dire «omogeneo» in millimetri |
| `02-OBIETTIVI.md` | **i numeri da battere.** È la parte che conta |
| `03-DOVE-SIAMO.md` | com'è fatto il sistema oggi, e quanto vale |
| `04-VICOLI-CIECHI.md` | cosa abbiamo già provato, con le misure. Serve a non ripeterlo |
| `05-VINCOLI.md` | cosa è vincolo vero (la macchina, il filo) e cosa è solo com'è fatto adesso |
| `06-COME-MISURARE.md` | gli strumenti già scritti per verificare una proposta |
| `07-MATERIALI.md` | dove stanno i file, il codice e le immagini di riferimento |
| `08-LA-PISTA-INDICATA.md` | la direzione che il committente vuole esplorare. **Un'ipotesi, non la specifica** |
| `foto-ricamo/` | le fotografie di ricamo vero: è lì che si vede dove si vuole arrivare |

## La cosa più importante

**Tutto quello che c'è in `03` è discutibile, e quasi tutto in `05` no.**

Il codice attuale non è un punto di partenza da migliorare: è un punto di arrivo che si è rivelato
insufficiente, ed è documentato qui perché *sapere cosa non ha funzionato e perché* vale più del
codice stesso. Se la strada giusta è buttare via il campo di direzione armonico, il riempimento dalla
rotaia, la serpentina e ricominciare da un'altra idea — **è una risposta legittima e benvenuta**.

Le uniche cose che non si negoziano sono in `05-VINCOLI.md`, e sono poche: sono i fatti fisici del
ricamo a macchina e del filo, non scelte di progetto.

## Cosa si aspetta come risposta

Non necessariamente del codice. Un metodo descritto bene, con l'idea geometrica e il motivo per cui
dovrebbe reggere dove gli altri hanno ceduto, è già la cosa più utile. Se viene con una prova su un
caso semplice, meglio.

Quello che serve, in ordine di importanza:

1. **l'idea** — perché questo metodo può dare omogeneità dove gli altri la perdono;
2. **cosa cede** — vedi `04`: c'è un'impossibilità geometrica di mezzo, e ogni metodo deve dichiarare
   quale delle due pretese sacrifica e quanto;
3. **come lo si misura** — `06` ha già gli strumenti; se servono misure diverse, dillo.

## Contesto in una riga

È il nono strumento di una suite di software per ricamo industriale (Erregi, Perugia). Si chiama
**Punto Pittorico**: da un'immagine — non da un vettore, mai — deriva blocchi di colore e li riempie
di ricamo pieno che segue le curve del disegno, con le sfumature che si compenetrano dove il colore
sfuma e uno stacco netto dove il colore stacca. Il pezzo che non regge è proprio il riempimento.

---
titolo: Cross-Stitch — il bersaglio è l'effetto maglia
tipo: tool
tool: [cross-stitch]
data: 2026-09-24
---

**Il nome (2026-10-13).** Nella suite il tool si chiama **Punto croce** (Lorenzo l'ha rinominato, era «Cross-Stitch») e sta nella home con gli strumenti pronti, non più in «In sviluppo». L'id, la cartella `apps/cross-stitch` e il tipo di progetto salvato (`rgProject: 'cross-stitch'`) restano quelli: i DST e i progetti già fatti si riaprono.

Il 2026-09-24 Lorenzo ha mostrato il bersaglio del tool Cross-Stitch: la foto di un lavoro a
**maglia** (maglia rasata) con una montagna — **colonne di V impilate**, V strette e alte (cella
~1:2,5), due fili (panna e grigio scuro), il disegno dato **solo dal colore di ogni V**, le gambe piene
(più passate).

**Perché conta:** la vecchia app (ThreadRoute Grid Lab) era un editor di diagonali generico. La foto
dice che il cuore è la V, e che il flusso è immagine → V colorate → passaggi del primo filo nascosti
sotto il secondo.

**Come si applica:** ogni scelta sul Cross-Stitch (default della cella, strumenti, riconoscimento da
immagine, ordine dei fili) si misura contro la **resa maglia**, non solo contro i mm di passaggio
(vedi [la resa prima delle misure](../metodo/resa-prima-delle-misure.md)). Migrato in
`apps/cross-stitch` lo stesso giorno; la fila di lavoro è la voce N2 di `STATO.md`. Sui passaggi vedi
anche [ripassi o filo in vista](../decisioni/cross-stitch-ripassi.md) e [il gruppo è un
confine](../decisioni/cross-stitch-gruppi-confine.md). Sul Fair Isle a moduli e strisce vedi
[modulo, strisce, ordine dei fili](../decisioni/cross-stitch-fair-isle-strisce.md).

**La fascia (2026-11-24).** Lorenzo lavora anche a **fasce**: un modulo alto quanto il disegno, che si ripete solo in
larghezza, messo a un'altezza scelta su un pezzo (un DXF) ricamato tutto di base; lo stesso modulo va su pezzi diversi
coi margini che servono. Il disegno lo fa lui: il tool deve dare l'interfaccia e gli strumenti, non disegnare. Vedi
[il modulo a fascia](../decisioni/cross-stitch-modulo-a-fascia.md).

**La base non passa sopra il vuoto (2026-11-25).** Dove una forma spezza le righe (la scollatura) la base intera si
cuce a pezzi, una spalla e poi l'altra, e da un pezzo all'altro va con un'impuntura dentro la forma, sotto la base che
viene dopo. Scelta di Lorenzo, fra un salto col taglio a ogni riga e una spalla per volta: «un'impuntura continua».
Stesso file della fascia.

**La V e la Λ a metà griglia (2026-11-25).** Per rifinire i bordi ad angolo la V (o la Λ) si può spostare di mezza
cella di lato, a cavallo di due celle; i passaggi sono quelli di una V qualunque (il filo forzato dal centro della cella
accanto, provato, spezzava i passaggi).
La Λ ha il suo bottone. Vedi [la V a metà griglia](../decisioni/cross-stitch-v-a-meta-griglia.md).

**Ridisegna passaggio coi pallini da trascinare (2026-11-25).** Lorenzo, sull'editor dei passaggi: «impossibile da
usare, non si capisce come spostare, e poi le linee sono spezzate… invece di essere tutte sempre unite. Io vorrei poter
spostare i pallini e vedere come si muove». Ora i punti del passaggio scelto si trascinano (il passaggio si ricalcola a
ogni vertice nuovo), un clic sulla linea ne aggiunge uno, il doppio clic lo toglie. Le linee spezzate erano
dell'anteprima: col sormonto lo stesso vertice sta un filo più su o più giù secondo il tratto (la punta della V o
l'angolo), e ogni tratto si disegnava da solo; ora ogni tratto parte da dove è finito il precedente, come già faceva il
DST (`colorPolylinesTrim`). Due cose ancora, lo stesso giorno. *«Ancora infinitamente lento»*: trascinando si ridisegnava tutta la tela a
ogni spostamento e ogni spostamento mandava un calcolo al worker, che li faceva tutti in fila; ora trascinando si
ridisegnano solo i pallini e una linea tratteggiata, il worker tiene solo l'ultima richiesta, e il passaggio vero si
rifà lasciando il mouse (e intanto ogni 250 ms, se la tela si ridisegna in meno di 40 ms). *«Non capisco perché si
pinna in dei punti ma il filo passa in altri»*: il pallino si disegnava sulla riga, il filo in fondo alla V della riga
sopra (col sormonto sono due posti); ora il pallino sta dove l'anteprima disegna il filo di quel passaggio, e il
trascinamento si aggancia alle stesse posizioni (`pointOnRoute`, `knitVertex`). *«Il fatto che i passaggi sono pinnati
e non posso spostarli dove voglio è super fastidioso… troppo ballerino»* (2026-11-26): ora i pallini sono **liberi**,
stanno dove si lasciano (`freePoint` in model.ts). Restano numeri come i vertici, così passano per tutti i conti che
spostano i vertici fra modulo, copie, area di prova e strisce (riga · larghezza + colonna più uno scarto intero): la
parte intera è il vertice più vicino, la parte decimale lo scarto in centesimi di mezza cella e di passo di riga (meno
di 0,02 mm di errore). Un vertice vero è sempre intero (`isFreePoint`). Il ballare veniva dall'aggancio: il pallino
saltava da un vertice all'altro, e col sormonto i vertici vicini stanno ad altezze diverse. *«Ma perché fa tutti questi
scalini»*: fra due pallini il motore cercava la strada più nascosta sul reticolo (gambe, lati, verticali), a gradini
dove sotto non c'era niente, più i dentini del sormonto. Scelta di Lorenzo fra «dritto» e «strada più nascosta»:
**dritto**. Ora fra due pallini il tratto è uno solo, in linea retta (`straightKind` in routing.ts: nascosto se ogni cella
che attraversa ha un punto ancora da cucire, o di un filo dopo); nel DST si divide in punti di impuntura. Un tratto
lungo più di una riga prende i capi dove stanno nella maglia (`segmentPoints` con `knitVertex`): dentro una riga sola il
sormonto sbagliava il capo lontano di 1,5 mm per riga (valeva anche per i salti nell'anteprima). *«Mi serve molto più
veloce ancora»*: ogni gesto (scegliere un passaggio, lasciare un pallino) rifaceva il calcolo di tutti i passaggi e
ridisegnava tutta la tela. Ma un passaggio a mano non cambia niente del resto (nel motore `forced` è l'ultimo ritocco):
ora scegliere un passaggio ridisegna solo i pallini, e spostare un pallino cambia nel risultato che c'è solo i tratti di
quel passaggio (`patchPassage`), poi un disegno; il calcolo completo (che riconta filo in vista e nascosto) parte da
solo dopo 0,9 s di calma. Misurato su 400 × 300 mm con la base piena: scegliere 2 ms, aggiungere un pallino 17 ms,
trascinare ≤ 3 ms a spostamento, lasciare 4 ms. *«Ora a volte mi perde le modifiche nel ricalcolarlo più tardi»*: il
calcolo completo non applicava i passaggi a mano in due casi (la base in un solo stop, `baseWholeRoute`, li riceveva
vuoti; a strisce un passaggio con un punto fuori dalla sua striscia si buttava via), e un risultato partito prima
dell'ultima modifica la copriva arrivando dopo. Ora i passaggi a mano sono l'ultimo ritocco su tutto il percorso finito
(`applyForced` in strips.ts, in `routeAll`: vale anche per il DST), e ogni risultato che arriva nel tool li prende come
sono in quel momento (`withForcedNow`). Prove in `test/cross-stitch-passaggi-a-mano.mjs` (3): col codice di prima le due
sulla perdita sono rosse. *«Nel modulo, cambio un passaggio, poi passo a quelli successivi, succede che nel ricalcolo mi
cambia quelli precedenti»* (2026-11-26): nel modulo a fasce (`routeBands`) per ogni fascia si provano più strade (verso,
divisione in due passate, ingressi e uscite degli elementi isolati) e si tiene quella che costa meno fra filo in vista,
ripassi e salti; nel conto entravano anche i passaggi a mano, e uno che aggiungeva filo in vista faceva scegliere
un'altra strada, dove quel passaggio non c'era più (tornava automatico, e cambiavano anche gli altri). Misurato su moduli
a caso: 769 passaggi a mano persi su 1370. Ora le strade si scelgono senza i passaggi a mano e solo quelle scelte si
rifanno con loro (`bandRedo`): 0 persi su circa 10.500. Vale anche per il ricamo col modulo ripetuto. Prova: la quarta
in `test/cross-stitch-passaggi-a-mano.mjs` (col codice di prima 20 persi). *«Vorrei che il bianco passasse sotto il rosso e
sotto il marrone»* (2026-11-26, sul suo modulo a fascia): ogni filo di una fascia si calcolava con le sole V di quel
filo, quindi non sapeva che sopra verranno altri fili e passava in vista sopra di loro (sul suo modulo, il bianco nella
fascia in cima: 158 mm in vista). Ora `routeBandAt` passa al motore le V dei fili cuciti dopo (`RouteParams.cover`,
colore più alto, base esclusa, nelle due copie): coprono come gli altri fili che vengono dopo, ma non si cuciono. Sul suo
modulo il bianco in cima va a 5 mm, il filo in vista di tutto il modulo da 1779 a 513 mm. Vale anche per il ricamo col
modulo ripetuto. I fili spenti (Vedi) contano lo stesso: nel modulo si calcolano comunque. Poi, lo stesso giorno: *«l'ingresso deve
sempre essere dall'alto»* — una fascia unita fra le copie entra (ed esce, alla stessa riga) dalla riga più in alto del
motivo sulla prima o sull'ultima colonna, non più dove il disegno è più vicino ai due bordi (spesso a metà motivo, col
passaggio d'ingresso in vista); e le V della fascia nella copia accanto, che si cuce subito dopo, coprono anche loro (il
passaggio d'uscita lungo la giuntura ci passa sotto). Sul suo modulo il bianco in cima: 0 mm in vista. *«Quando ci sono
una serie di V orizzontali coperte allora mettiamo una linea… il primo V destra e sinistra lo facciamo a V»*: i passaggi
nascosti dritti (`straightHiddenRuns`) tengono a V la prima e l'ultima V della corsa, e nel tool sono accesi di base.
*«I passaggi a vista non devono esistere»* (dopo che gli avevo proposto di misurarli): `RouteParams.noVisible`, acceso
di base nel tool, toglie dal Dijkstra ogni tratto in vista (anche gli orizzontali sul bordo della cella); dove non c'è
strada nascosta il filo salta. Nel modulo una fascia di motivi staccati prova anche a unirsi alla copia accanto
(`joinAnyway` in `routeBandAt`): la tiene se non aggiunge filo in vista né salti. Sul suo modulo: 0 mm in vista (i 115
del ricamo intero sono tutti dei suoi passaggi disegnati a mano), e i salti dipendono dall'ordine dei fili (30 con il
suo ordine, 56 dal chiaro allo scuro alla lettera). *«Valutare quale filo far passare prima e quale dopo in base al minor
numero di salti… chiaro sotto scuro sopra»*: `ordine.ts`, bottone **Ordine consigliato**. Costo = salti + punti di
luminosità di scuro sotto il chiaro / 4 (con 4, sul suo modulo vince bianco, grigio, rosa, malva, marrone, verde: 42
salti e solo malva/marrone, quasi uguali, invertiti). Nel modulo i salti di un filo dipendono solo da QUALI fili vengono
dopo, non dal loro ordine: si tengono in memoria per gruppo (109 s → 35 s). Si cerca scambiando due fili alla volta,
dall'ordine di adesso e da quello dal chiaro allo scuro, al più 60 ordini; propone, non cambia. *«Come posso rimuovere
un salto? vorrei provare a toglierne alcuni»*: i salti del tool non si potevano toccare (Salti toglie solo quelli messi a
mano). Ora **Ridisegna passaggio** prende anche un salto del tool (`travelAt(p, true)`), e un passaggio a mano sui due
capi di un salto lo fa diventare quel passaggio nel motore (`routeCells`, parte dei passaggi a mano: il salto toglie
un salto dai conti). Non vale per il salto fra le copie del modulo (il capo sta nella copia accanto). *«Come poter accorciare i salti facendo
lavorare i vari blocchi in maniera che le uscite e le entrate dei successivi siano vicine… passaggi lineari prima e poi
le V dal punto più conveniente»*: misurato prima sul suo modulo (ordine consigliato, 38 salti): 777 mm di salti; solo
cambiando ordine e verso dei blocchi 633; entrando e uscendo nei punti più vicini fra blocchi 435 (il minimo con
l'ordine di adesso). Fatto il terzo: `shortenJumps` in strips.ts rifà ogni blocco (fra due salti del tool) con
`startAt` = il punto più vicino al blocco prima ed `endAt` = il punto più vicino al blocco dopo (il passaggio d'uscita è
nascosto o in ripasso), coprono i fili dopo e gli altri blocchi del filo; si tiene se i salti si accorciano senza
aumentare né mettere niente in vista. Si fa solo sulle strade di fascia già scelte (`bandRedo`): farlo su ogni strada
provata triplicava il tempo (4,5 s → 1,6 s, come senza). Risultato: 777 → 568 mm, ripassi 3,65 → 4,23 m. Tool:
**Prima il passaggio, poi le V**, acceso di base (`RouteParams.backward`). *«A volte i passaggi per tornare indietro
passano lateralmente alle V… rischia di vedersi, soprattutto se viene fatto dopo che le V sotto sono state realizzate…
niente passaggio in verticale sopra le V, altrimenti conviene replicare il punto delle V»*, e poi *«deve ragionare al
contrario, se deve fare un passaggio deve capire di farlo prima il passaggio e poi muoversi con le V»*. Misurato sul
suo ricamo (39 × 119 V, modulo 24 × 99): su 2.144 verticali solo 468 stavano sotto V cucite dopo, 809 (2,0 m) sopra V
già cucite, 799 sul lato con una V già fatta da una parte. Tre cose. (1) `verticalClass`: il verticale è coperto solo
da V che si cuciono dopo (dello stesso filo ancora da fare, o di un filo dopo), sul lato da tutte e due le parti; sopra
V già cucite costa come in vista (`over`) ma resta una strada (classe `vertical`) — solo con «mai in vista»: coi
passaggi in vista permessi è un baratto vero (sul caso del recinto: 17 mm di verticali sopra le V contro 11 mm in
vista sul bianco), lì tutto resta come prima, anche il verso all'indietro è spento —, perché in un disegno di sole V
scendere di una riga vuole per forza un verticale: vietarlo dava 596 salti invece di 92. Ripassare le gambe della V non
basta: sul reticolo le gambe non scendono di riga. (2) **All'indietro** (`routeCells` → `routeCellsOnce` due volte): per
i fili di V con verticali sopra V cucite, il percorso si cerca dalla fine (dall'uscita, con l'ingresso come arrivo,
l'ordine dei gruppi rovescio) contando «cucita dopo» quello che all'indietro è già fatto, poi si rovescia; si tiene se
non aggiunge salti né filo in vista e passa meno sopra le V cucite (`overSewnMm`). Ottimizza l'ordine (`relocate`) lì
non si fa: non guarda il tempo e rimetteva i passaggi sopra le V (provato: 0,64 → 1,49 m); con passaggi o salti a mano
vince il verso dove si ritrovano. (3) **Salti corti** rifaceva un blocco alla volta contando i blocchi PRIMA dello
stesso filo fra le V che coprono: ora sono `sewn`, cucite prima. Sul suo ricamo: verticali sopra V cucite (anche di
lato) 4,0 → 1,9 m, del tutto sopra 2,0 → 0,63 m; salti 92 → 83; ripassi 5,9 → 2,0 m; passaggi nascosti 7,4 → 19,4 m
(il filo sotto le V cresce di 8 m); il calcolo 16 → 19 s.

**Salti corti**, acceso di base (`RouteParams.shortJumps`). *«Non so che sta succedendo ma qui ora ci sono 100 salti a
caso»* (sul DST del ricamo intero, 96 salti, il più lungo 181 mm): coi passaggi mai in vista il numero è quello (prima
60 salti ma 761 mm in vista); a caso sembravano per due motivi del ricamo a modulo ripetuto: (1) `routeBands` girava una
fascia nel verso opposto se le costava un salto in meno, rompendo la serpentina, e la fascia dopo ricominciava
dall'altro lato del ricamo (salti lunghi quanto il ricamo); ora dalla seconda fascia il verso opposto deve risparmiare
anche quel salto (30 + metà della larghezza del ricamo nel conto); (2) nelle copie tagliate un pezzo che cominciava con
un salto ne faceva due di fila (`join`, e un'unione finale in `routeModuleTiled`). Sul suo DST: il più lungo 181 → 108
mm, salti in tutto 3,6 → 2,7 m (con salti corti). *«Il modulo, la dimensione reale dell'immagine è più grande di come
abbiamo disegnato… è largo 120 mm»*: l'immagine (331 × 846 px) era un modulo intero, 24 × 93 V; le V però prendono la
misura dai campi della cella (3,8 × 5 mm, sormonto 50%), non dall'immagine, quindi il modulo era largo 91,2 mm, e nel
ricamo l'immagine si stende su tutta la misura del ricamo (160 mm). Nessun errore di calcolo: manca il legame
immagine → misura delle V. Aggiunto **Misura il modulo** (editor, Aggancio fine e grandezza, campo «Larghezza reale»: le stesse parole del campo della forma, perché un'etichetta nuova andrebbe nel debito delle etichette, fermo fino alla PR #50): larghezza vera → la
percentuale di Ingrandisci (120 / 91,2 = 131,6%: V 5 × 6,58 mm, modulo 120 × 306 mm); disegno e passaggi restano.
E, per la seconda versione (*«voglio ridisegnare con le misure 3,8 × 5 ma a grandezza reale 120»*), **Rifai la
griglia**: V invariata, colonne = larghezza / cellW (32), righe dall'altezza dell'immagine in proporzione (122); stesso
pezzo d'immagine sotto la griglia nuova; modulo nuovo tutto base (disegno, salti e passaggi a mano non valgono su
un'altra griglia), con conferma e Annulla.

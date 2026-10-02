---
titolo: Cross-Stitch, Fair Isle a punto V — modulo, strisce, ordine dei fili
tipo: decisione
tool: [cross-stitch]
data: 2026-10-01
---

Il 2026-10-01 Lorenzo ha posto la sfida: rifare a punto V una grafica Fair Isle (rombi, alberelli,
fascia verde, triangoli; immagine di riferimento in `apps/cross-stitch/.lab/fairisle.webp`, fuori da
git). Le sue condizioni:

- **lavorare a moduli e a strisce di moduli**: la macchina ha i ritiri, e cucire tutto un colore e
  poi tutto un altro non riprende mai il registro;
- **una base completa** del colore più diffuso (l'azzurro), poi gli altri colori **dal chiaro allo
  scuro**, nascondendo i passaggi;
- fra una striscia e l'altra, **accorgimenti in macchina** per avvicinarle o allontanarle.

Scelte di Lorenzo: **striscia alta un modulo intero**; i colori li sceglie il tool, «poi in caso le
modifichiamo».

**Il modulo, misurato.** L'immagine si ripete ogni 429 × 657 px = **72 × 112 V** (V quasi quadrate,
5,96 × 5,87 px). Le colonne si trovano dai bordi di colore; le righe **non** si trovano dai numeri
(trama, purezza delle celle, concordanza fra copie: tutti indifferenti) ma **guardando**: con 112
righe le diagonali escono lisce, con 56 a blocchi, con 84 seghettate (vedi [la resa prima delle
misure](../metodo/resa-prima-delle-misure.md)). Una prima griglia a 36 × 28 era sbagliata: prendeva
due V per una. I 72 × 112 sono **4 copie di un modulo 36 × 56**: le differenze fra le copie (~10%
delle V) cadono al 97–98% sui bordi sfumati dei motivi, quindi rumore; il modulo si ricava per
maggioranza. Con celle 2,4 × 3,5 mm e sormonto 30% le V restano quadrate: un modulo è 86 × 137 mm.

**I colori.** 7 gruppi in Lab: uno (`#a29790`, grigio-rosato) **non è un filo**: 137 pezzi, 116 V
isole, mai più di 5 V — è il bordo sfumato fra rosa e azzurro. Tolto (ogni V prende il colore più
presente intorno): restano 6 fili. Il giallo chiaro dei puntini è finito nel crema.

**Il ricamo a strisce** (`strips.ts`): ogni striscia è una griglia a sé con la sua base e i suoi
colori, i passaggi non escono dalla striscia, nel DST gli stop si ripetono per striscia; la
compensazione del ritiro sposta la striscia k di k × mm nell'export.

**L'ordine dei fili conta più delle strisce.** Sul progetto 5 × 2 moduli (432 × 275 mm): tutto
insieme 13,1 m di filo in vista; a strisce 13,3 m (le strisce servono al registro, non al filo in
vista); tolto il colore finto 9,8 m; con l'ordine `crema, rosa, verde, marrone, ruggine` 7,5 m. Su una
striscia di 2 moduli, provati tutti i 120 ordini dei 5 colori: dal chiaro allo scuro è a metà
classifica (2,02 m), il migliore 1,38 m; quello scelto 1,43 m — è il chiaro→scuro con il **ruggine per
ultimo**: il marrone (motivi piccoli e sparsi) da ultimo non ha sotto cosa nascondere i passaggi, il
ruggine (pochi pezzi grandi) passa poco.

**Ricava modulo nel tool** (`module.ts`, 2026-10-01): fa da solo i passi qui sopra e ritrova
esattamente 429 × 657 px, 72 × 112 V, modulo 36 × 56, 6 fili, 1 colore di bordo tolto (circa 4 s).
Le righe le dà la trama del filo (che in verticale si ripete ogni 2 righe, 11,73 px) col multiplo che
fa la V quasi quadrata; colonne e righe restano correggibili a mano. Su un'immagine sintetica a bordi
netti i bordi dopo la media 5×5 facevano «pianori» e contavano 3-5 bordi spostati per uno: un bordo
solo, al centro del pianoro.

**La vista Modulo** (2026-10-01, Lorenzo: «un editor del modulo… si riverbera su tutto»; e poi «i
passaggi del filo»: si comincia dalla vista). Le giunture del modulo sono arbitrarie e tagliano i
motivi: sul Fair Isle, così come esce, la verticale taglia 25 V di disegno e l'orizzontale 7; con
*Giunture sulla base* 20 e 4. La verticale non scende sotto 20: le fasce orizzontali (verde,
triangoli) attraversano tutto il modulo e qualsiasi giuntura verticale le taglia — quando i passaggi
si calcoleranno per modulo, il passaggio da una copia all'altra lungo le fasce va gestito.

**I passaggi del modulo** (2026-10-01). Calcolati su un modulo da solo e ripetuti non funzionano:
inizio e fine di ogni filo cadono dove capita (quasi tutti a sinistra), e per passare alla copia dopo
il filo attraverserebbe il modulo. Con **ogni copia un gruppo, da sinistra a destra**, invece, il motore
dopo 2-3 copie ripete da solo lo stesso giro (sul Fair Isle, 8 copie: tutti i fili identici dalla
terza alla settima; su un modulo sintetico alcuni fili si alternano fra due giri, a serpentina). Costo
sul Fair Isle: filo in vista 6,27 → 6,77 m per striscia di 5 copie (+8%), ripassi 22,7 → 22,0 m. Un
salto deciso sul modulo si mette in ogni copia (un clic, 10 salti su 5 × 2 copie).

**Il modulo disegnato a mano** (2026-10-01, Lorenzo: «è complicato da un'immagine andare a modificare
quando c'è tanto che non va… costruire un modulo da zero… metto un'immagine sotto… disegno colore per
colore»; e «quando carico l'immagine è sgranata»; e «devo poter cambiare anche il ritaglio»). *Nuovo
modulo*: tutto base, la guida è il ritaglio di una ripetizione, stirato su ogni copia **sopra** i
punti (sotto, un modulo pieno di V la copriva). Lo sgranato veniva dalla copia a 600 px usata per
leggere i colori: ora si disegna dall'originale. Correggendo mezzo pixel nella posizione dei bordi
(contati al centro dei pixel) il colore finto del Fair Isle è passato da «mai più di 5 V» a un pezzo da
7, e non veniva più tolto: il criterio ora è la misura media dei pezzi (al più 2 V; finto 1,3, veri da
3 in su), non il pezzo più grande.

**L'editor del modulo** (2026-10-02, Lorenzo: «molto lento e davvero poco chiaro… la scelta e gestione
del modulo la prima cosa… un ritaglio ancorato alla griglia»; «schermata a sé»). Una schermata con solo
Immagine e Griglia del modulo: l'immagine non si ritaglia con un rettangolo libero ma si **aggancia
alla griglia** (px per V, px per riga, inizio; o trascinandola), e *Trova da solo* fa l'aggancio da
sé (Fair Isle: 5,96 × 5,87 px, inizio 3,1 / 1,3 px). La lentezza era il ricalcolo dei passaggi
dell'intero ricamo a ogni tocco (quasi 1 s sul Fair Isle): nell'editor non si calcolano, e un colpo di
pennello costa 30 ms. Prossime fasi decise con Lorenzo: (b) il percorso del modulo, ingresso a
sinistra e uscita a destra alla stessa altezza — col segno di dove finire —, ordine = ordine di
disegno, riordinabile; (c) i passaggi modificati a mano e i salti.

**Il percorso del modulo** (2026-10-02, fase b dell'editor; Lorenzo: «inizia dal lato sinistro e deve
finire nel lato destro alla stessa altezza»; «quello che disegno dopo va dopo»; «dammi un segno per
definire dove devo finire in base a dove ho iniziato»). Ogni filo si calcola una volta sul modulo:
ingresso a sinistra alla riga del primo pezzo, pezzi nell'ordine di disegno (riordinabili), uscita a
destra alla stessa riga = ingresso della copia accanto. Sul Fair Isle (5 copie): filo continuo, filo in
vista 6,18 m contro 6,13 del copia per copia, ripassi 21,8 contro 23,0 m, 88 ms contro 340. La copia
tagliata dal bordo all'inizio cominciava altrove (4 salti nel test): ora parte dall'uscita
dell'ultima copia intera.


**I passaggi a mano** (2026-10-02, fase c; Lorenzo: «gestire i passaggi, modificandoli a mano dove
passano dove necessario e cambiarli anche in salti quando serve»). Stanno nel modulo, non nel ricamo:
salti (coppie di vertici del reticolo del modulo) e passaggi forzati (da, a, punti di passaggio), così
valgono in ogni copia e fanno parte del percorso del modulo. Un passaggio forzato si riconosce dai due
vertici che collega: il motore, dopo aver scelto l'ordine, sostituisce quel passaggio con la strada più
economica fra i punti dati; i punti cuciti non cambiano. Se il filo non collega più quei vertici
(ordine cambiato) il forzato resta lì ma non agisce.

**Scegli modulo e leggibilità** (2026-10-02; Lorenzo: «se metto un'immagine grande… non capisco come
posso poi tagliarlo… mi aspetto che posso selezionare il perimetro che identifica il modulo»; «i tratti
non si vedono se li metto chiari»; i numeri «enormi… non so nemmeno come spegnerli»). Il riquadro si
aggancia alle V: il passo delle colonne dai bordi di colore (al baricentro della rampa, cercato su un
passo continuo e affinato: il picco è stretto e la metà del passo allinea anche lei), le righe dalla
trama del filo, il picco più forte entro il 15% di quanto la griglia si aspetta; misurati su un pezzo
fino a 1000 px intorno al riquadro (su un pezzo piccolo sbagliava), con la fase presa dal centro.
Sul Fair Isle: 5,963 × 5,869 px in ogni pezzo, riquadri storti agganciati a 36 × 56 V. Due tranelli
trovati: i bordi in verticale di una maglia sono a zig-zag (davano righe di 6,6 o 9,4 px), e la
trama ha un picco finto a 7,15 px che in certi pezzi vince su quello vero (due righe, 11,74). I tratti:
l'immagine guida ora sta sotto i fili disegnati (sopra la base) e i tratti hanno un bordo di contrasto;
numeri e segni a misura fissa sullo schermo, i numeri si spengono (*Numeri pezzi*).

**Le fasce** (2026-10-02; Lorenzo: «dello stop di questo colore prima fai la parte alta del modulo di
tutti i moduli consecutivi, poi passiamo al blocco sotto… mi permette di lavorare a fasce
orizzontali»; «fasce automatiche ma dammi un modo per modificarle»; «per ogni fascia del colore di ogni
modulo uscita e ingresso vicini… dove non è possibile facciamo i salti»; «a serpentina, base come ora»;
«per i salti per ora non mettere niente… il programma fa un salto da un blocco all'altro», cioè salto
semplice, senza taglio). Decisioni: fasce per filo (non comuni a tutti), automatiche dove il filo lascia
una riga vuota, modificabili; ogni fascia calcolata sul modulo, entra da un bordo ed esce dall'altro se
il vuoto attraverso la giuntura è al più 4 V (BAND_JOIN_V), altrimenti salti fra le copie; salto anche
fra fascia e fascia; la serpentina riparte da sinistra a ogni filo. Sul modulo di Lorenzo (24 × 37, 5
fili, 7 copie per striscia): beige 3 fasce, nocciola 3, ruggine 5, verde 3, marrone 3; salti fra le
copie proprio sui motivi isolati di ruggine, verde e marrone (come aveva previsto). Filo in vista per
modulo 1459 mm a fasce contro 1837 col percorso del modulo intero (una fascia per filo); 255 salti
nel ricamo intero.

Subito dopo (Lorenzo: «vorrei che prendesse solo il sopra e invece prende sopra e sotto», e le due
parti condividono righe) le fasce si scelgono anche **per disegno**: un clic su una V sposta la sua
forma (le V del filo che si toccano, anche in diagonale) nella fascia sotto, Maiusc+clic sopra. Lo
spostamento è salvato per V, relativo alla fascia della sua riga (bandMove), così regge se i confini
cambiano; una fascia è un insieme di V, non un intervallo di righe.

**Inizio e fine liberi** (2026-10-02; Lorenzo: «essendo a fasce il punto iniziale e finale è diverso…
dovrebbero sempre iniziare il più a sinistra possibile e finire il più a destra possibile… così se metto i
salti il salto è lineare e vicino»; «decide il tool dentro le fasce»). Prima una fascia unita entrava ed
usciva dai bordi del modulo alla stessa riga. Ora comincia dalla V più a sinistra (a parità, alla stessa
altezza dell'ultima: salto dritto) e si calcola su un modulo largo due copie con la fine obbligata
all'inizio della copia accanto; unita se il vuoto fra fine e copia accanto è al più 4 V (in larghezza o
in righe), altrimenti salto corto. Il tranello: il motore, anche sapendo dove finire, non tende verso
lì (il verde in alto finiva a sinistra, 460 salti). Rimedio: dentro la fascia l'ordine va a spicchi
verticali di 4 V nel verso della fascia; provati 2, 3, 4, 6 e 24: con 4 tutte le fasce continue restano
unite, 295 salti nel ricamo (tutti sui motivi isolati), filo in vista 58,7 m. L'ordine dei pezzi vale
solo per i fili messi in ordine a mano (ordered).

**Per forme, ingresso e uscita ai bordi** (2026-10-02, subito dopo; Lorenzo, sul DST esportato: «si passa
più volte da un oggetto compatto all'altro… faccio una parte di rombo poi vado sotto poi torno sopra; no,
ogni blocco con punti vicini deve essere concluso e poi si passa al prossimo. Importante che per ogni
fascia l'ingresso coincida con l'uscita del precedente e quindi ingresso uscita ai lati rispettivi stessa
altezza»). Gli spicchi tagliavano le forme: via. Dentro la fascia le forme (V che si toccano, anche in
diagonale) si cuciono intere una alla volta: prima quella dell'ingresso, ultima quella dell'uscita, in
mezzo per colonna media. Le fasce unite tornano a entrare ed uscire dai bordi alla stessa riga (la riga
col disegno più vicino ai due bordi); quelle a salti partono dalla V più a sinistra. Sul modulo di
Lorenzo: ritorni su e giù di più di 2 righe da 47 a 27 per modulo (quelli rimasti: forme una sopra
l'altra nelle stesse colonne, o dentro una forma, sotto i suoi punti), filo in vista per modulo da 1617 a
936 mm, nel ricamo da 58,7 a 35,1 m; salti da 295 a 270.

**Ancora aperto:** il 67% del filo in vista sta nei passaggi oltre 12 mm (32 su 116 per striscia di
2 moduli). Farli diventare salti col taglio lo porterebbe a circa un terzo, con più tagli in macchina:
da decidere con Lorenzo.

**Come si applica:** prima di un passaggio da un'immagine, cercare il modulo vero (le copie quasi
uguali sono rumore) e i colori finti (pezzi minuscoli lungo i bordi); misurare l'ordine dei fili sul
filo in vista invece di darlo per scontato.

---
titolo: La rete a moduli di una borsa, basi e catenelle psil: come è costruita in Stilista
tipo: riferimento
tool: []
data: 2026-10-29
---

Un file di Lorenzo sul server (**il file non è nel repo, e qui non si scrive il suo nome**: il repo è pubblico). Letto il 2026-10-29 dal suo
Stilista aperto **senza modificarlo**: `/selezione.json` sull'oggetto che Lorenzo aveva selezionato, poi
`/salva-copia` (una copia di quello che Stilista ha in memoria, in `%TEMP%`), letta col lettore offline del bridge
(`OfflineEmgReader.exe`). Lorenzo: *«un oggetto complicato con passaggi complicati e moduli che si ripetono, con
pulizia punti specifici in alcune parti del modulo. Ogni modulo è composto da imbastiture di basi e punti psil che
si chiamano poi punti catenella»*.

## Cosa c'è (misurato)

3.777 oggetti, 364.263 punti, nessuno stop. Tutti `running` (funzione 3) tranne 78 `manual` sull'ago 2.

**Una griglia di moduli, 5 colonne × 6 righe.** Un modulo è circa 108 × 66 mm e contiene due ripetizioni del disegno
della ragnatela. Le colonne sono a passo 100 mm (x da 20 a 530), le righe a passo 49,5 mm (y da 68 a 381): i moduli
si sovrappongono. Ogni modulo è un blocco d'ago, e l'ago dice la colonna: 1 (prima riga) o 9, poi 10, 11, 12, 11.
Nell'ultima riga manca la colonna di mezzo: è l'incavo in basso.

**Un modulo, nell'ordine in cui si cuce** (un modulo intero ha 143 oggetti):

| | quanti | parametri (insieme) | cosa sono |
|---|---|---|---|
| imbastiture di base | 6 | insieme 1: imbastitura 2,5 mm, `PIStitchStrassLaser` 0 | tutta la ragnatela del modulo in un tracciato lungo (1.380–1.520 mm, 435–486 vertici): 3 passate sulla metà sinistra e 3 sulla destra. ~~2 sulla destra, 1 su tutto~~ (corretto il 2026-11-03: la sesta coincide per il 95% con la quarta e la quinta) |
| catenelle | 82 | insieme 2: `PIStitchStrassLaser` 4, `PIWidthPsil` 2500, `PIHeightPsil` 1300, `PIFlagPsil` 32, `PIPSILRowHeight` 3700, imbastitura 2,2 mm | un tratto di ragnatela ciascuna (15–70 mm, 4–15 vertici) |
| passaggi | 54 | insieme 1 | running brevi (2–20 mm) fra una catenella e la successiva, in mezzo alle catenelle |
| uscita | 1 | insieme 3: `PIThreadDistance` 213, `PIMaxLunghezzaCasuale` 3500 | running lungo (180–300 mm, punti da 2–2,8 mm) che porta al modulo dopo, lungo il bordo destro |
| segno | 1 | insieme 1 | un trattino verticale di 7,7 mm fuori dal pannello (x −8,9) |

**La catenella (il «psil»).** Nei punti salvati ogni maglia è un triangolo di 2,45 × 1,30 × 2,45 mm, cucito **due
volte**, poi il filo avanza di 1,60 mm lungo la linea: 7 punti per maglia, circa 4,3 punti per mm (110 punti su
25 mm). Sono le misure di `PIWidthPsil` (2,5 mm) e `PIHeightPsil` (1,3 mm).

**La pulizia.** I tracciati delle imbastiture di base coprono **tutto il rettangolo** dei moduli, ma i loro punti
cuciti stanno solo **dentro la forma della borsa** (il trapezio con l'incavo): fuori, i punti sono stati tolti e il
tracciato è rimasto. Molte catenelle che cadevano fuori sono state tolte intere: nei moduli dei bordi ce ne sono 27–78
invece di 82. 216 oggetti hanno i punti a più di 3 mm dal loro tracciato. **Conseguenza: un ricalcolo di Stilista
su una base la ricucirebbe su tutto il modulo.** Le basi non vanno ricalcolate.

**La pulizia a mano, misurata (2026-11-02).** È fatta col tasto «E» (Lorenzo: *«i punti cancellati a mano con la
funzione che si attiva premendo "e", fuori dalla sagoma di ricamo del dxf»*). Sulla copia del 2026-10-29, solo basi lunghe
e catenelle: **40 basi su 172 e 113 catenelle su 2.118** hanno meno punti di quanti ne vuole il loro tracciato (sotto il
95% e l'85% della densità mediana); nessuna catenella è a zero. Il buco lasciato è un passo lungo senza un tag diverso:
fino a 45,5 mm nelle basi, 14,5 mm nelle catenelle.

La pulizia **non coincide con una sagoma**. Campioni dei tracciati ogni 2 mm, «cucito» = entro 2,5 mm da un punto
cucito dell'oggetto:

| guida (oggetto) | tolto ma dentro | cucito ma fuori, basi | cucito ma fuori, catenelle | la regola sbaglia |
|---|---|---|---|---|
| 3776, 506 × 332 mm, la più grande | 0 | 7.921 | 1.670 | 4,9% basi, 5,1% catenelle |
| 3775, 469 × 301 mm | 0 | 27.719 | 6.042 | 17,0% basi, 18,5% catenelle |

Quindi tutto quello che è stato tolto sta fuori da quelle due guide, ma una parte di quello che è fuori è rimasta.
Non è stato misurato quale contorno sia «la sagoma del dxf» di Lorenzo. **Per rifare la pulizia dopo un ricalcolo il
riferimento più fedele è la versione pulita a mano, oggetto per oggetto, non la sagoma.** Non è ancora stato provato:
il plugin non ha una strada per riscrivere i punti di un running o di una catenella che resti tale.

**Le guide.** I 78 `manual` dell'ago 2 hanno 0 punti cuciti (tutti i tag −1): sono il disegno della borsa, cioè il
bordo a onde in alto, il medaglione ovale coi fiori, le due feritoie dei manici, le bordure laterali a cordoncino e
il fondo curvo.

**L'oggetto 0** (ago 1, insieme 0) è un running di 652 punti lungo tutto il riquadro: non ancora capito.

## Non ancora saputo

- Perché Stilista 3.3 non mostra il psil. Ipotesi: `PINamePsil` è 0 e la forma del psil sta in un archivio che su
  questo Stilista non c'è. Non è provato. I punti salvati però ci sono, quindi **anche le catenelle non vanno
  ricalcolate** finché non si sa se Stilista sa rifarle.
- Perché ogni colonna ha un ago suo (1/9, 10, 11, 12, 11): i colori degli aghi nella copia non si leggono
  (tavolozza vuota nel lettore offline). L'ago 11 è `#602826`.

## La zona da infittire (Lorenzo, 2026-10-29)

*«Va rinfittito tutto ciò che sta dentro il contorno laser arancione ultimo stop»*. È l'oggetto 3.777 (aggiunto da
Lorenzo dopo la lettura): laser `#FFC20E` sull'ago 2, nell'ultimo stop, contorno di 485 vertici, 373 × 144 mm
(x 90–464, y 269–413), 294 cm². È una fascia che segue il fondo curvo della borsa, intorno all'incavo. Dentro ci sono
265 catenelle intere, 6,65 m di catenella: 22,7 mm di catenella per cm². La parte bassa della fascia, sotto il
bordo attuale della rete, oggi è vuota.

**Come infittire** (Lorenzo, 2026-10-29): *«le aree vuote che ora si creano dovrebbero essere in maniera irregolare
divise in due … vediamole comunque entrambe. Solo dove la rete già c'è»*. Due proposte calcolate con
[`strumenti-sviluppo/stilista-prove/infittisci-rete.mjs`](../../strumenti-sviluppo/stilista-prove/infittisci-rete.mjs)
sulle maglie chiuse (aree vuote circondate da linee, almeno 12 mm²) col centro nella zona: 462 maglie.

| | come | linee nuove | catenella per cm² |
|---|---|---|---|
| A, da lato a lato | linea leggermente piegata, perpendicolare al lato lungo della maglia, spostata e girata a caso | 462, 2.351 mm | 22,7 → 30,7 |
| B, da nodo a nodo | corda fra due angoli che divide la maglia più vicino a metà (una a caso fra le 2–3 migliori) | 462, 3.295 mm | 22,7 → 33,9 |

Da guardare con Lorenzo prima di andare in Stilista. In B qualche linea nelle maglie del bordo basso arriva fino
alle basi, sotto l'ultima catenella.

## La versione A in Stilista, su una copia (2026-10-29)

Lorenzo: *«A, procedi pure con la copia»*. Plugin del ramo installato, Stilista aperto sulla copia salvata alle 16:56
(`%TEMP%\rg-stilista-link\rg-copia-chat.emg3`, 3.777 oggetti).

**Il psil non si ricalcola su questo Stilista.** Copie di catenelle sui tracciati nuovi (`POST /running`): 0 punti dopo
il ricalcolo. Una catenella originale (oggetto 2332) ricalcolata: da 162 punti a 0. Le imbastiture copiate invece si
ricalcolano bene. **Nel documento vero: una catenella ricalcolata (un parametro cambiato, un nodo spostato) si svuota.**

**Quindi la catenella la calcola il tool**, con le misure dei punti salvati ([`prepara-punti.mjs`](../../strumenti-sviluppo/stilista-prove/prepara-punti.mjs)):
maglia A, B, C, A, B, C, A con B e C 2,37 mm avanti e 0,65 mm di lato, passo 1,6 mm. Per ogni linea: imbastitura (punti
≤ 2,5 mm) dall'inizio alla fine, catenella di ritorno sulla stessa linea, poi il passaggio alla linea dopo **lungo la
rete** (il percorso più corto sulle catenelle e sui passaggi che ci sono, scegliendo la linea più vicina lungo la rete).
Un oggetto a punti fissi per modulo (`POST /punti` col modello = una catenella del modulo), spostato con `POST /ordine`
subito dopo l'ultima catenella del modulo, prima del running d'uscita ([`manda-punti.mjs`](../../strumenti-sviluppo/stilista-prove/manda-punti.mjs)).

**Misurato nella copia salvata** (`/salva-copia`, letta col lettore offline): 3.785 oggetti; 8 oggetti nuovi, ognuno fra
l'ultima catenella e il running d'uscita del suo modulo, sul suo ago; 16.247 punti, tutti quelli mandati. Passaggi
lungo la rete 449 (5,4 m, in media 12 mm); salti 5 più il primo di ogni oggetto. Gli aghi dei moduli hanno colori
diversi nella tavolozza: 9 `#0072BC`, 10 `#DFA7A6`, 11 `#602826`, 12 `#22B14C`.

## Pulizia e versione A con oggetti veri, su una copia (2026-11-02)

Lorenzo: *«riesci a intervenire e lavorarlo in caso?»*, sul file con le catenelle collegate (vedi
[`../codice/stilista-psil.md`](../codice/stilista-psil.md)). Fatto da [`rete-nativa.mjs`](../../strumenti-sviluppo/stilista-prove/rete-nativa.mjs)
su una copia aperta in una finestra della chat; il documento di Lorenzo non è stato toccato.

**La pulizia si fa accorciando il tracciato, non togliendo punti.** Il riferimento è la copia del 2026-10-29, pulita a
mano con «E»: i capi di maglia cuciti dicono quali tratti tenere, e dove due capi distano più di 3,3 mm il tratto si
spezza. 125 catenelle sostituite da 123 copie sui soli tratti tenuti; 2.160 mm di tracciato tolti. 119 catenelle tengono un tratto,
2 ne tengono due, 4 (oggetti 2056, 3300, 3324, 3325) nessuno di almeno 1 mm.

**L'infittimento è fatto di oggetti calcolati da Stilista.** 462 imbastiture, 462 catenelle di ritorno, 455 passaggi lungo
la rete (5,57 m), in fondo al modulo prima del running d'uscita. Su 7 linee non c'è strada lungo la rete: niente passaggio.
Modello: la catenella dell'insieme più comune nel modulo.

**Misurato leggendo la finestra di Stilista.** 1.502 oggetti creati su 1.502, nessuno a 0 punti, 125 tolti: da 3.777 a 5.154,
punti da 363.369 a 369.178. 3.574 oggetti non toccati identici punto per punto (le 78 guide non hanno punti cuciti, e
così non si possono confrontare). Catenelle ripulite: 0 punti su 8.589 oltre 3,5 mm dalla versione a mano. Ricalcolo su 5
catenelle nuove e 5 ripulite: stessi punti prima e dopo. Salvata e riaperta in una finestra nuova: 5.154 oggetti, tutti
identici. Tempo: 9 min 23 s. **Non cucito su macchina, e non ancora guardato da Lorenzo.**

## Infittire senza salti né passaggi: andata e ritorno (2026-11-02)

Lorenzo: *«non creare salti e … far sì che il ricamo lavori precisamente come lavorava prima, quindi in maniera
consequenziale e senza salti o passaggi»*. La zona ora è un laser verde (`#22B14C`, oggetto 3.777 del documento aperto):
142 vertici, x 123,7–422,6, y 271,6–396,0, 258 cm². Dentro, 333 maglie chiuse; versione A: 1.693 mm, 16,9 → 23,4 mm di
catenella per cm².

**Il metodo.** Si ferma l'oggetto che passa sul capo A della linea nuova, in due parti: parte 1 fino ad A, imbastitura da A
a B, catenella da B ad A, parte 2 da A. Il filo torna dove era partito: nessun passaggio e nessun salto aggiunti.

**Fattibilità misurata.** Su tutte le 333 linee almeno un capo sta su una catenella o un passaggio esistente (entro 0,3 mm):
322 con entrambi i capi, 11 con uno. **Non** è ancora stato scelto in quale modulo cucire una linea dove i moduli si
sovrappongono.

**Prova su 3 linee, in una copia** ([`prova-andata-ritorno.cjs`](../../strumenti-sviluppo/stilista-prove/prova-andata-ritorno.cjs)):
due catenelle e un passaggio divisi, stesso ago.

| oggetto | punti prima → due parti | raccordi nuovi (mm) | collegamenti col resto, prima → dopo (mm) | scarto massimo dei punti |
|---|---|---|---|---|
| 2984, catenella | 70 → 21 + 49 | 1,14 · 0,60 · 1,48 | 2,02 → 2,02 · 1,13 → 1,11 | 0,12 mm |
| 3000, catenella | 77 → 56 + 21 | 1,19 · 0,60 · 1,42 | 0,30 → 0,30 · 1,26 → 1,03 | 0,74 mm |
| 2424, passaggio | 10 → 3 + 7 | 0,08 · 0,60 · 1,16 | 0,90 → 0,90 · 1,01 → 1,01 | 1,65 mm |

Quindi il numero di punti resta uguale, ma **i punti dell'oggetto diviso si spostano lungo la stessa linea** (la maggior
parte oltre 0,01 mm).

**Il prima non è senza spostamenti.** Fra una catenella o un passaggio e il seguente, nello stesso ago, 205 spostamenti su
3.457 superano i 4 mm nella versione pulita a mano e 200 nel file di oggi (fino a 47,6 mm). Sono punti a tag 0: non si sa
se in macchina escono come punto lungo o come salto. Il metodo non li tocca.

**Differenze rispetto a «come prima».** L'imbastitura nuova si cuce quando la linea parte, non con le basi all'inizio del
modulo. La pulizia delle catenelle fuori sagoma è un altro lavoro, e rimette spostamenti come quelli che lasciava «E».
Non cucito su macchina.

## Le linee nuove dentro basi e catenelle (2026-11-02)

Lorenzo: *«vorrei proprio che tu modificassi base e catenelle nei punti giusti … non devi aggiungere questi pezzi in una
seconda fase, deve essere continuo»*. L'andata e ritorno a pezzi qui sopra è quindi scartata.

**Come ragiona un modulo intero** (oggetti 2326–2468, ago 11, misurato). Tre basi di fila sulla metà sinistra (la seconda
parte dalla fine della prima e fa il cammino al contrario, senza raccordo) e tre sulla destra, l'ultima delle quali porta all'uscita. Ogni base ripassa su se stessa per circa il 20%. Lungo le catenelle passano quasi sempre 3 basi (1.995 mm
su 2.316). Poi catenelle e passaggi: 54 passaggi, mediana 15,9 mm. **Dei 991 campioni dei passaggi, 819 corrono su una linea
dove la catenella arriva dopo**: i passaggi stanno nascosti sotto una catenella che deve ancora venire.

**Prova su una linea, in una copia** (linea di 4,8 mm, basi 2326 e 2327, catenella 2335, stesso numero di oggetti). Il tracciato
di ogni oggetto, arrivato sul capo della linea, va all'altro capo, torna e prosegue.

- **Catenella:** da 182 a 203 punti, psil calcolato da Stilista su andata e ritorno; raccordi col resto 0,98 e 1,33 mm (prima
  0,98 e 1,44); un nuovo ricalcolo non la cambia. Sulla linea nuova la catenella è doppia.
- **Basi:** raccordi fra le basi invariati, 0,00 mm. Ma i punti sono tutti diversi, vedi sotto.

**In Stilista 3.3 ricalcolare una base la cambia tutta, anche senza toccarla.** Base 2328 intatta, ricalcolata: da 815 a 623
punti, mediana del punto da 1,71 a 2,22 mm, massimo da 2,70 a 3,33 mm, 2 punti uguali su 623; stessi parametri. Quindi per
mettere una linea dentro una base **non si può ricalcolarla**: i suoi punti vecchi vanno tenuti e vanno aggiunti quelli
della deviazione, con `OldPoints2StitchPath`. Così resta anche la pulizia a mano. Non è provato su un running, e il plugin
non ha ancora la strada: serve installarlo di nuovo.

## «2 basi e 1 catenella con il passaggio» (2026-11-02)

Lorenzo: *«se ti chiedessi proprio di ridisegnare in modo da avere 3 passaggi di base e 1 sola catenella? altrimenti mi devi
fare 2 basi e 1 catenella con il passaggio»*.

**3 basi non convengono.** La base passa dalla linea nuova un numero dispari di volte solo se poi torna girando intorno alla
maglia: mediana 17,6 mm, 7.694 mm per passata, 23 m su tre passate, contro 5 m di linee nuove. Calcolato col giro più semplice,
linea per linea; un cammino ottimizzato farebbe meno, non è misurato. **Con 2 basi e il passaggio i ripassi sono zero, e sotto la
catenella nuova corrono comunque 3 fili.**

**Le basi: si tengono tutti i punti.** `POST /riscrivi-punti` (`OldPoints2StitchPath`, senza ricalcolo) sulle basi 2936 e 2937
di una copia: 823 e 824 punti come chiesti, fermi dopo 1,5 s. Salvata e riaperta: 3.784 oggetti identici, e nelle due basi
tutti i punti vecchi nello stesso ordine (814 su 814, 815 su 815). Vale anche per la pulizia a mano, che sta in quei punti.

**Le catenelle divise cambiano.** Essendo psil, Stilista le rifà sul tracciato nuovo e distribuisce le maglie sulla lunghezza,
anche dopo la riscrittura e anche tagliando sul capo di una maglia:

| catenella | prima | parte 1 | ripresa |
|---|---|---|---|
| 2983 | 70 punti, passo 1,66, lato 2,52 | 21 punti, passo 1,86, lato 2,80 | 42 punti, passo 1,84, lato 2,77 |
| 2988 | 98 punti, passo 1,74, lato 2,64 | 28 punti, passo 1,89, lato 2,85 | 70 punti, passo 1,69, lato 2,56 |

Sulla 2983 si perde una maglia (70 → 63 punti). Riscrivere i punti di una catenella non serve: dopo 1,5 s può già essere rifatta.

**Quindi le linee partono dalle giunzioni.** Se la linea nuova parte da dove un oggetto finisce e il dopo comincia, non si divide
niente: passaggio e catenella nuova entrano fra i due. Versione C di [`infittisci-rete.mjs`](../../strumenti-sviluppo/stilista-prove/infittisci-rete.mjs):
282 maglie su 333 hanno una giunzione da cui dividerle (non più sbilanciate di 23% e 77%), linee da 3,6 a 11,0 mm, 1.964 mm in tutto,
catenella per cm² da 16,9 a 24,5. Le altre 51 restano da decidere. **La versione C è solo calcolata, non provata in Stilista.**

## Un modulo intero infittito, su una copia (2026-11-03)

Lorenzo: *«ok lasciale intere, prova su un modulo»*: le 51 maglie senza una divisione dalla giunzione restano intere (49 senza
nessuna giunzione, la metà sotto 22 mm²; 2 con una divisione troppo sbilanciata). Modulo ago 11, oggetti 2936–3078, 88 linee della
versione C, [`infittisci-modulo.mjs`](../../strumenti-sviluppo/stilista-prove/infittisci-modulo.mjs). La base fa la deviazione dal capo
che tocca: entrano 86 linee su 88. **Le 2 rimaste non hanno una base cucita del modulo su nessuno dei due capi: non fatte.**

**Misurato leggendo la finestra di Stilista, 15 s dopo la fine.**

- Oggetti da 3.778 a 3.950: 86 passaggi (426 punti) e 86 catenelle (2.450 punti), nessuna a 0 punti. Tempo in Stilista: 13 s.
- 3.697 oggetti non toccati identici punto per punto, nessuno cambiato. 79 guide e laser senza punti cuciti non confrontati.
- Basi 2936 (51 deviazioni, da 814 a 1.281 punti) e 2939 (35, da 792 a 1.123): tutti i punti vecchi nello stesso ordine.
- Raccordi: oggetto > passaggio mediana 1,08, massimo 1,17 mm; passaggio > catenella 0,60 mm; ritorno sul percorso (61 giunzioni)
  mediana 1,19, massimo 4,41 mm. Sopra 2 mm: 11. Peggiorati di oltre 1 mm rispetto a oggi: 13 (per esempio 1,03 → 2,65, 3,16 → 4,23).
- Punto più lungo: 3,65 mm nei passaggi, 3,18 mm nelle catenelle.

**Da guardare.** Da 61 giunzioni partono 86 linee: dove ne partono più d'una si vede una stella. Non cucito su macchina.

## Tutto il verde, su una copia (2026-11-03)

Lorenzo: *«Per ora lascerei così. Come facciamo quindi per aggiungere più linee su tutta la parte evidenziata?»*. Stesso metodo del
modulo, su tutti i moduli insieme (`infittisci-modulo.mjs … tutti`), partendo dal file delle 2026-11-02 17:25.

271 linee su 333 maglie: 51 restano intere per scelta di Lorenzo, 11 perché su nessun capo passa una base cucita del loro modulo.
7 moduli, 10 basi modificate, 542 oggetti nuovi (271 passaggi, 271 catenelle con 7.637 punti, nessuna a 0), da 3.778 a 4.320 oggetti, 82 s
compresi 15 di attesa. 3.689 oggetti non toccati identici, nessuno cambiato; le 79 guide e laser senza punti cuciti non confrontati. Nelle 10
basi tutti i punti vecchi nello stesso ordine. Salvato e riaperto: 4.320 oggetti identici.

Ritorno sul percorso (195 giunzioni): mediana 1,21 mm, massimo 5,90; 35 sopra 2 mm, 36 peggiorati di oltre 1 mm rispetto a oggi.

**Mancano:** la pulizia delle catenelle che rigenerandole sono tornate fuori sagoma (provata il 2026-11-02 su un'altra copia, qui no); le 11 linee;
un campione cucito. Il file di Lorenzo non è stato toccato.

## La pulizia delle catenelle sul verde infittito (2026-11-03)

Lorenzo: *«sì, procedi con la pulizia delle catenelle»*. [`pulisci-catenelle.mjs`](../../strumenti-sviluppo/stilista-prove/pulisci-catenelle.mjs) sulla copia con le 271
linee, riferimento la versione pulita a mano del 2026-10-29; le pulizie con «E» fatte dopo quella data non ci sono. 125 catenelle sostituite da 123 tratti (119
con uno, 2 con due, 4 senza nessuno: oggetti 2056, 3300, 3324, 3325), 2.160 mm di tracciato tolti, 49 s.

Letto dalla finestra di Stilista: 4.318 oggetti, 4.195 non toccati identici, nessuno cambiato; 123 tratti con punti, 0 punti su 8.589 oltre 3,5 mm dalla versione a mano;
271 linee nuove.

| raccordi fra catenelle e passaggi | quanti | mediana | sopra 2 mm | sopra 4 mm | massimo |
|---|---|---|---|---|---|
| pulita a mano, 2026-10-29 | 3.458 | 0,60 | 544 | 205 | 47,6 |
| file delle 17:25, psil rigenerato | 3.458 | 1,09 | 686 | 200 | 41,8 |
| ora | 3.998 | 1,04 | 673 | 184 | 48,6 |

Punti di catenella fuori dalla guida 3776: 18.300 nel file delle 17:25, 10.383 nella pulita a mano, 9.519 ora. Due linee nuove (giunzioni 3014 e 3531) hanno un capo a più di 2 mm da
ogni catenella: la prima finisce su un'asola del bordo basso senza catenella, la seconda non è stata guardata.

**Non fatto:** nessun campione cucito; 11 linee senza base; il file non è ancora nella cartella del progetto, lo salva Lorenzo.

## Punti sul bordo al posto dei passaggi lunghi (2026-11-03)

Lorenzo: *«quando pulisci potresti inserire punti sui bordi per evitare passaggi o salti troppo lunghi?»*. Lorenzo ha salvato il file pulito come
`…_infittito e pulito.emg3` (identico alla copia: 4.318 oggetti su 4.318). Prova su una copia di quello, [`ripara-bordi.mjs`](../../strumenti-sviluppo/stilista-prove/ripara-bordi.mjs).

**Il bordo è la guida 3776.** Dei capi dei buchi nelle basi, 270 su 314 stanno entro 3 mm da lì; dalla guida 3775 nessuno.

**Il metodo.** Un movimento oltre 4 mm con tutti e due i capi entro 10 mm dal bordo diventa punti ≤ 2,5 mm: al bordo, lungo il bordo dalla parte più corta, all'altro capo. Dentro basi e
passaggi si riscrivono i punti (quelli vecchi restano); fra due oggetti entra un passaggio nuovo.

**Misurato.** 160 movimenti dentro gli oggetti (39 oggetti riscritti) e 67 fra oggetti: 2.957 mm di passi lunghi diventano 3.755 mm di punti. Da 4.318 a 4.385 oggetti; 4.279 non toccati identici; i 39
riscritti con tutti i punti vecchi in ordine; raccordi dei passaggi nuovi al massimo 0,03 mm. Salvato e riaperto: identico. Dentro gli oggetti non resta nessun movimento oltre 4 mm. Fra oggetti ne restano
117, lontani dal bordo: mediana 5,4 mm, due oltre 12,1 mm (fino a 29,1).

**Da guardare.** Sul bordo i fili si sommano: dei 299 campioni ogni 2 mm toccati, 243 hanno da 3 a 8 oggetti sovrapposti, perché ogni base di ogni modulo fa la sua strada. Alcuni passaggi nuovi stanno in cima al
pannello, dove la pulizia non c'entra. Non è noto se la guida 3776 sia la linea del taglio: non cucito su macchina.

## Le corsie fuori dal bordo (2026-11-03)

Lorenzo: *«così batte troppo negli stessi punti. Per me puoi fare anche dei passaggi più esterni al bordo effettivo»*. Ogni strada ha la sua corsia fuori dal bordo: la prima libera su tutto il suo
tratto, a 1 mm dal bordo, poi una ogni 1 mm, al più 12 mm. In cima al pannello (y < 100) non si tocca niente: la pulizia lì non c'entra.

**Misurato, copia del file di Lorenzo.** 160 movimenti dentro gli oggetti e 61 fra oggetti: 2.917 mm di passi lunghi diventano 4.488 mm di punti, sul bordo erano 3.755. Da 4.318 a 4.379 oggetti; 4.279 non
toccati identici; i 39 riscritti con tutti i punti vecchi in ordine. Dei 2.232 punti aggiunti, 2.187 stanno fuori dal bordo, i più lontani a 12 mm. Salvato e riaperto: identico. Restano 113 movimenti oltre 4 mm
fra oggetti, lontani dal bordo (due oltre 12,1 mm, fino a 29,1).

| punti aggiunti con un altro punto aggiunto vicino | sul bordo | sulle corsie |
|---|---|---|
| entro 0,5 mm | 87%, fino a 14 nello stesso punto | 26%, fino a 6 |
| entro 0,2 mm | 78%, fino a 11 | 9%, fino a 3 |

**Due errori fatti e corretti in questa prova.** Il segno della normale portava le corsie dentro la rete: lo script ora si ferma se succede. Il filtro dei punti vicini toglieva il capo (un punto vecchio) su 5 basi: ora restano
sempre. **Il plugin ha solo 10 porte (5370–5379):** con tutte occupate una finestra nuova non risponde. Un file chiuso con la forza non si riapre con lo stesso nome (visto una volta, causa non cercata).

**Da guardare:** i tratti corti dalla rete alla corsia fanno una scaletta sul bordo. Non cucito su macchina.

---
titolo: Il psil (la catenella) in Stilista 3.3 — perché non si calcola, cosa c'è nella 3.2
tipo: codice
tool: []
data: 2026-10-29
---

Lorenzo (2026-10-29): *«il psil esiste sicuramente sul 3.2 e non ho capito perché non è implementato nel 3.3»*. Su
questo PC ci sono tutte e due: `C:\GMI\Stilista3.3\bin\Stilista3.3.exe` (3.3.3009.112) e
`C:\GMI\Applications\Stilista3\bin\Stilista3.exe` (3.2.1305.4991). Letto solo in lettura, niente toccato.

**Misurato.** In 3.3 una catenella del file di riferimento ricalcolata va da 162 punti a 0, e così ogni sua copia
([`../riferimenti/rete-a-moduli.md`](../riferimenti/rete-a-moduli.md)). I suoi parametri: `PIStitchStrassLaser` 4,
`PIWidthPsil` 2500, `PIHeightPsil` 1300, `PIFlagPsil` 32, `PINamePsil` 0, e nei parametri dell'oggetto c'è un
`UIPsilParamsRO` (`A_PsilParameters`) e una fermatura dei parametri paillette che si chiama **«catenella 1»**. Il nome
«catenella 1» compare 5 volte nella copia del documento.

**Il psil nella 3.3 c'è.** `W3000LineNet.dll` (la libreria che calcola i punti delle linee, riscritta in .NET nella 3.3:
la 3.2 aveva anche la nativa `W3000Line.dll`, che nella 3.3 non c'è più) ha lo spazio `W3000LineNet.Psil`, `PosaPsil`,
`NomePsil`, `PSILManual` e un errore `ERRORE_PARAMETRO_MANCA_IL_PSIL`. `GMILibraryDll.dll` (l'archivio) ha un pulsante
`btCheckOutPsil`. La cartella `C:\GMI\Stilista3.3\CHECKED_OUT\SERVICE\psil` c'è ed è **vuota**. L'archivio è sul server
(`SSLIB003\Stilib.ini`: SQL Server `SRVGMI`).

**Ipotesi, smentita il 2026-11-02 (vedi sotto):** nella 3.3 le forme dei psil si prendono dall'archivio («check out») e si tengono in
`CHECKED_OUT\SERVICE\psil`; lì non c'è niente, quindi il calcolo finisce in «manca il psil» e dà 0 punti. La 3.2
calcolava il psil nella sua libreria nativa. Da verificare con Lorenzo: aprire la catenella nella 3.2 e guardare quale
psil usa; cercare nell'archivio della 3.3 i psil e fare il check out.

**Come si applica.** Finché la forma non c'è, nella 3.3 una catenella non va ricalcolata (si svuota), e le catenelle
nuove le calcola il tool ([`prepara-punti.mjs`](../../strumenti-sviluppo/stilista-prove/prepara-punti.mjs)). Nei file di
Stilista (le sue cartelle, l'archivio) non si copia niente senza il sì di Lorenzo.

## Il file con le catenelle collegate (2026-11-02)

Lorenzo ha rifatto il psil in Stilista 3.3 e salvato un file con le catenelle collegate; dice che
3.3 con i psil *«sembra lavorare ad una lentezza atroce»*. Non ha ancora detto come li ha collegati.

**Misurato su una copia del file.** Tutti i tracciati uguali a quelli del 2026-10-29. Basi e passaggi coi punti uguali.
Le catenelle (2.118, ora in 4 insiemi di parametri) hanno tutte i punti rifatti salvo una: `PIPSILRowHeight` 0,
`PIPSILSpacing` −800, `PIDegradee*` 50, in un insieme `PIWidthPsil` 2400. La maglia è sempre triangolo doppio, ma il passo
è 1,70 mm invece di 1,60–1,63 e i lati 2,58 mm invece di 2,45–2,51.

**Qui il psil si calcola.** Ricalcolo di una catenella: da 154 a 154 punti in 0,2 s; 10 catenelle in 0,55 s. Una copia di
catenella su un tracciato nuovo (`POST /running`): 21 punti, 3 maglie. `CHECKED_OUT\SERVICE\psil` è **ancora vuota**: non
è da lì che il psil viene preso, quindi l'ipotesi sopra è sbagliata. Da dove lo prende non è misurato.

**La lentezza non è misurata.** Il calcolo della singola catenella è veloce; la lavorazione completa di 1.502 oggetti su
un documento che cresce da 3.777 a 5.279 ha preso 9 min 23 s. Dove va quel tempo non si è cercato.

**`OfflineEmgReader` non legge più la copia che ne esce** (5.154 oggetti): la scambia per un formato vecchio, 0 oggetti.
La causa non è cercata. Per controllare si leggono i punti dalla finestra (`GET /punti-cuciti`) e si riapre il file.

## I valori del psil si comandano da fuori (2026-11-03)

Lorenzo: *«i valori psil poi li mandi a stilista?»*. Prova con `POST /parametri` su una catenella di una copia (287 punti), uno dopo l'altro, senza toccare il documento di Lorenzo:

| parametro cambiato | maglia dopo (avanti · larghezza · passo, mm) | punti |
|---|---|---|
| prima: `PIWidthPsil` 2500, `PIHeightPsil` 1300, `PIPSILSpacing` −800 | 2,50 · 1,30 · 1,70 | 287 |
| `PIHeightPsil` 2000 | 2,50 · 2,00 · 1,70 | 287 |
| `PIWidthPsil` 3500 | 3,49 · 2,00 · 2,67 | 175 |
| `PIPSILSpacing` −400 | 3,49 · 1,99 · 3,05 | 154 |

Quindi `PIHeightPsil` è la larghezza della maglia, `PIWidthPsil` la sua lunghezza, e il passo è circa `PIWidthPsil` + `PIPSILSpacing`. Stilista ricalcola la catenella da solo, e un altro ricalcolo non la cambia.

**Non trovato fra i parametri:** i due giri del triangolo e la prima maglia a 0,60 mm. Non è provato da dove vengano; probabilmente dalla forma del psil. Vista su una catenella sola, non cucita.

## Come si riconosce un psil (2026-11-04)

Lorenzo: *«dice che dovrei selezionare uno psil, lo faccio ma comunque non va»*. **`PIFlagPsil` 32 non vuol dire psil.** Letto in sola lettura su dieci documenti aperti: la maggior parte dei running normali ha `PITipoPunto` 1, `PIFlagPsil` 32, `PIStitchStrassLaser` 0, altri `PIFlagPsil` 16416. L'unico oggetto psil trovato ha `PIStitchStrassLaser` 4, come le catenelle del file di riferimento. «Invia a Stilista» cercava il flag 32: in quei documenti prendeva un running normale come modello e ignorava la selezione. Ora guarda `PIStitchStrassLaser`, e la catenella selezionata ha la precedenza.

**Le finestre.** Il plugin ha 10 porte. Quel giorno le finestre erano 15: le ultime aperte non avevano il collegamento e il tool non le vedeva, quindi la selezione fatta lì non arrivava. L'esito dell'invio ora dice in quale documento è andato.

## Perché l'invio della rete intera non arriva in fondo (2026-11-04/05)

Lorenzo: *«mi stai bloccando tutto stilista»*. Invio di tutta la rete con `POST /running`, su una copia: a 1.350 oggetti su 4.138, dopo 7 minuti, la finestra occupava 19,7 GB su 32, e un blocco da 150 oggetti era passato da 9 a 162 s.

**Dove va la memoria**, prova piccola su una copia ridotta a 2 oggetti, 30 copie per tipo:

| Copia di | Memoria per oggetto | Tempo per oggetto |
|---|---|---|
| running, con ricalcolo | circa 0,6 MB | circa 20 ms |
| psil, con ricalcolo | circa 30 MB | circa 95 ms |
| psil, senza ricalcolo | circa 12 MB | circa 8 ms |

Con 2.200 catenelle sono circa 66 GB. Il file di riferimento invece ha oltre 2.000 psil e si apre in circa 700 MB. **Provato il 2026-11-05 con plugin di prova, poi rimesso quello di master:**

| Prova | Risultato |
|---|---|
| Copie coi parametri del modello invece del doppione | Uguale: 863 MB invece di 870 per 30 psil. Ipotesi dei parametri smentita |
| Pulizia forzata della memoria dopo ogni blocco | Non è roba inutile: dopo la pulizia restano circa 25 MB vivi per ogni psil copiato e ricalcolato |
| Togliere le copie dal documento, poi pulizia | La memoria viva non scende (1.697 MB prima e dopo): non sta negli oggetti del documento |
| File aperto con 3.777 oggetti | 154 MB di memoria viva: gli oggetti letti dal file pesano poco |
| Ricalcolo di 10 psil del file | +129 MB, circa 13 MB ognuno |
| `/riscrivi-punti` su psil del file | Da 5 a 9 MB ognuno, ma dopo 1,5 s Stilista li ricalcola da solo sul tracciato dato (154 punti → 98), quindi i punti scritti non restano. La misura è sporca: gli indici si spostavano fra un blocco e l'altro, e 11 dei 30 oggetti letti alla fine non erano più psil |

Anche la sospensione della cronologia di Annulla (`csUndoManager.SoftwareUndoSuspeded`) non cambia niente: stessi 25 MB.

**La causa, misurata contando la memoria per tipo prima e dopo 20 copie:** ogni copia di un psil crea circa 2.260 `cFilato`, 4.500 tipi di punto da ricamo, 5.000 `cStichingPailletteParameterRO`, 1.050 `cStitchTypePerlina` e 19 MB di immagini. Ogni tipo di punto si iscrive all'evento statico `cBaseStichTypeRO.TransparencyChanged` e da lì non si libera più: per questo togliere le copie non scendeva. **Non è provato** se succede anche fuori dal plugin, a chi lavora con le catenelle in Stilista; potrebbe spiegare il *«lavora ad una lentezza atroce»* del 2026-11-02.

**La correzione**, in `POST /running`: alla fine di ogni blocco si rimette la lista di iscritti di prima, poi si libera la memoria. Nella stessa finestra, 30 psil:

| | Memoria viva | Punti di ogni copia |
|---|---|---|
| Iscrizioni staccate | 178–180 MB, ferma | 245, ancora psil |
| Come prima | da 416 a 929 MB | 245 |

**La rete intera con la correzione:** 4.135 oggetti su 4.135, 348.556 punti, aghi compresi, 321 s, picco di memoria 6 GB, alla fine 4,5 GB; prima a 1.350 oggetti era a 19,7 GB. Le catenelle sotto 1,5 mm (3 su 2.200: a 1,46 mm 0 punti, a 1,86 mm 7) non si mandano. **Leggere tutto il documento** con `GET /selezione.json`, a blocchi da 200, lo ha portato sopra 8 GB: quella rilettura non è stata finita, quindi gli aghi di questo invio non sono stati riletti.

**Non provato:** salvare e riaprire quel documento; la trasparenza dei fili su quelle copie, che non ricevono più l'evento fino alla riapertura; il tool col plugin nella pagina vera; il campione cucito.

**Un running dal psil non si può fare** (2026-11-05). Una copia del psil con `PIStitchStrassLaser` 0 e `PIFlagPsil` 16416 sembra un running, ma ricalcolarla dà `FunzioneNonAbilitata`: le sue copie hanno il tracciato nuovo e i punti del modello. Provato sull'invio di Lorenzo: basi e passaggi restavano all'origine e da lì partiva un ventaglio di linee verso tutta la rete; quella finestra è arrivata a 18 GB, e quanto dipenda da questo errore non è misurato. Il mio controllo di prima contava i punti e non guardava dove stavano.

**Il modello giusto** è un running nativo creato con `POST /oggetti` (funzione 21 invece della 5 del psil): 30 copie in 223 ms, ognuna con i suoi punti al posto giusto, memoria ferma. Quindi al documento basta una catenella psil.

**`index` di `GET /selezione.json`** è il posto nella risposta, non nel documento: riparte da 0 a ogni richiesta e sulla selezione. Il posto vero è quello chiesto in `?oggetti=`.

**Gli aghi** (2026-11-05). `POST /ago` su tutta la rete ha portato la finestra da 2,5 GB oltre 8 GB: nella prova si è fermata lì, a 337 s. Ora ogni ago ha i suoi due modelli provvisori, e gli oggetti nascono con quello giusto.

**Il controllo dopo l'invio** (2026-11-05). Nella rete intera 1 oggetto su 4.135, la base più lunga, è risultato cucito due volte (1.734 punti invece di 867, salto di 78 mm), e 4 oggetti avevano 0 punti al momento dell'inserimento ma poi i loro punti. Probabilmente un calcolo di Stilista che finisce in ritardo. `/ricalcola` lo sistema, e l'invio ora rilegge e ricalcola da solo.

**La prova finale** (2026-11-05, copia con un solo psil, contorno e modulo del file, 29 moduli): 4.135 oggetti su 4.135, 299 s, picco 6 GB, alla fine 2,2 GB, 1 oggetto ricalcolato dal controllo. Riletti tutti: 0 all'origine, 0 col primo punto lontano dal tool, 0 vuoti, 0 passi oltre 12 mm, aghi da 1 a 5 per colonna, modelli provvisori tolti. **Non provati:** salvare e riaprire il documento, la trasparenza dei fili, il campione cucito.

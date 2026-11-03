---
titolo: Cosa si può leggere e comandare in Stilista da una chat — la mappa, voce per voce
tipo: codice
tool: []
data: 2026-10-29
---

Lorenzo (2026-10-29): *«testare delle cose legate a Stilista e a cosa possiamo controllare da chat a Stilista»*.
Questa è la mappa. Ogni voce dice **come si è saputo**:

- **provato oggi**: provato col plugin RG Stilista Link di `master` su un documento della chat (un DST mandato con
  `POST /dst` alla finestra senza documento: Stilista lo apre in una finestra sua, `%TEMP%\rg-stilista-link\rg-prove-chat-*.EMG3`);
- **ricerca del bridge**: scritto nella ricerca di settembre (`stilista-host-skeleton`, `handoff/stilista-json-bridge-clean/docs`),
  **non ancora riprovato** col plugin;
- **non provato**.

Lo script del DST di prova è [`strumenti-sviluppo/stilista-prove/dst-di-prova.ts`](../../strumenti-sviluppo/stilista-prove/dst-di-prova.ts).

## La mappa

| cosa | stato | come, e cosa si è visto |
|---|---|---|
| aprire un documento nuovo | **funziona** (provato oggi) | `POST /dst` alla finestra senza documento (porta 5370): si apre una finestra nuova, porta sua (5371). I documenti aperti non si toccano |
| creare un riempimento nativo | **funziona** (provato oggi) | `POST /oggetti`, 2 rettangoli 30 × 20 mm: nati in 2,3 s, ricalcolabili (448 e 772 punti) |
| … con i suoi parametri | **funziona** (provato oggi) | letti dopo con `/selezione.json`: `PIThreadDistance` 400 e 300, `PISngLunghezzaPunto` 4000 e 3000, `PISngSfasamentoPuntoRaso` 30 e 50, `PIDensitaImbastituraFondo` 6, tutti come chiesti. Qualsiasi altro parametro intero si passa con `managed_overrides_int` (non ancora provato) |
| … orientamento | **funziona** (provato oggi; ricerca del bridge) | `orientation_deg` 90 e 45: l'oggetto ha la sua linea d'orientamento (2 punti). Il bridge la dà con un clic simulato in `EditRdo`; assegnata per riflessione si perde al salvataggio |
| … ago e colore | **funziona** (provato oggi) | aghi 2, 3, 4 coi colori chiesti (`#00A0E0`, `#E0A000`, `#20A040`). Il colore va nella tavolozza del documento: vale per tutto l'ago |
| creare una linea (running) | **non funziona bene** (provato oggi) | `type: running` su una spezzata di 3 punti, 80 mm: l'oggetto ha **3 punti** (i vertici), anche dopo un ricalcolo forzato, e la lunghezza punto 2,5 mm non passa (resta 3000). La ricerca del bridge dice che si salva come `Manual`, non `Running` |
| ingresso e uscita | **funziona** (provato oggi) | `POST /ingresso-uscita` sui riempimenti nativi: primo punto a 0,05 mm dall'ingresso chiesto, ultimo a 0,04 mm dall'uscita (sul bordo, raso verticale); su quello a 45° 0,64 e 0,14 mm. Vedi [`stilista-ingresso-uscita.md`](stilista-ingresso-uscita.md) |
| ricalcolare | **funziona** (provato oggi) | `POST /ricalcola`, anche senza lucchetto: 441, 763, 3 punti prima e dopo |
| salvare una copia | **funziona** (provato oggi) | `POST /salva-copia`: `%TEMP%\rg-stilista-link\copia-*.emg3`; il file aperto non si tocca |
| leggere i punti generati | sì: vedi sotto `/punti-cuciti` | `/selezione.json` dà quanti sono e il riquadro, `/ingresso-uscita` il primo e l'ultimo. Tutti i punti: dalla copia salvata col lettore offline (`OfflineEmgReader.exe`, .NET 9, nella ricerca del bridge) o con `DesignObject.Stitches()` (manca una strada) |
| ricamo a punti fissi (Manual) | **funziona** | `POST /punti`: [`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md) |
| copie di un riempimento con ingresso, uscita e ordine | **funziona** | `POST /riempimenti` (Pattern a macchie, 41 macchie su 42). Vuole un riempimento **selezionato a mano** in Stilista: `?oggetti=` qui non vale |
| cambiare i parametri di una catenella psil che c'è già | **funziona** (provato il 2026-11-03, su una) | `POST /parametri`: larghezza, lunghezza e passo della maglia cambiano e Stilista ricalcola: [`stilista-psil.md`](stilista-psil.md) |
| cambiare i parametri di un oggetto che c'è già | ricerca del bridge | copia scrivibile `new UI4Parameters(Parameters)`, valore nel `ManagedParameterCollection`, `UpdateFromModifiedParams`, `new UI4ParametersRO(…)` rimesso in `Parameters`, `NeedRestitching` + `RicalcolaDiretta`. Provato solo per la densità (278 → 338 punti). Nel plugin manca una strada. Sull'oggetto ci sono anche `replaceStitchParameter(AllParams)` e `fpParamsChange` (non provati) |
| tipo di punto (`PITipoPunto`, `PILavorazione`, `PITipoImbastitura`) | non provato | i valori non sono decifrati. Visti: riempimenti `PITipoPunto` 1 (qualcuno 4), `PILavorazione` 4, `PITipoImbastitura` 0 |
| cambiare l'ago di un oggetto che c'è già | ricerca del bridge | `ListaFilati.getAgo(n-1)`, `DesignObject.CambiaAgo(ago)`, `StitchingPath.ChangeAgo(Reel)`. Solo `PINeedle` non basta |
| stop | ricerca del bridge | il tag del primo punto cucito diventa `etStop(cTarget.Embroidery, …)`, poi `RecalculateSummaryIsNeeded` |
| fermature (iniziale, finale) | non provato | sull'oggetto ci sono `setFermaturaIniziale` e `setFermaturaFinale(cLockWithPreview)` |
| cancellare un oggetto | non provato | il bridge svuota tutto il documento con `Objects.Clear()`; un oggetto solo, mai |
| cambiare l'ordine | **funziona** (provato il 2026-10-29, plugin del ramo) | `POST /ordine { da, a }`: `Remove` + `Insert`. 8 oggetti spostati dal fondo dentro i loro moduli del file di riferimento, ognuno subito prima del running d'uscita: verificato nella copia salvata |
| aprire una copia in una finestra della chat | **funziona** (provato il 2026-10-29) | `POST /apri-copia?file=…emg3`, solo file di `%TEMP%\rg-stilista-link` (`LoadNewEmb`); anche Stilista avviato con la copia come argomento |
| copiare un running su un tracciato nuovo | **funziona per l'imbastitura, non per la catenella psil** (provato il 2026-10-29) | `POST /running`: la copia di un passaggio ricalcolata ha i suoi punti; la copia di una catenella psil ricalcolata ha **0 punti**. Anche una catenella **originale** del file di riferimento ricalcolata va da 162 a 0: **questo Stilista non sa calcolare il psil** (la forma non è nel suo archivio, per ipotesi) — vedi [`../riferimenti/rete-a-moduli.md`](../riferimenti/rete-a-moduli.md) |
| leggere tutti i punti cuciti | **funziona** (provato il 2026-10-29) | `GET /punti-cuciti?oggetti=…`: `[x, y, tag]` in µm (la catenella 2332 del file di riferimento: 162 punti) |
| selezionare da codice | non provato | si legge `Box.SelectedDsgObj`; scriverla, mai |
| annulla (`createUndoPoint`) | non provato | il metodo c'è su ogni oggetto |
| esportare DST da Stilista | non provato | sull'oggetto c'è `ExportStitchesToTextFile(string, string)`; il DST lo sa già scrivere la suite |
| salvare il documento vero, chiudere, aprire un .emg3 | da non fare | i documenti di Lorenzo non si salvano e non si chiudono da qui |

## Perché metà della mappa è ancora «non provato»

Le strade di oggi creano oggetti nuovi, ma non sanno modificare, cancellare o spostare quelli che ci sono. Per
provarle serve un plugin nuovo, e un plugin nuovo lo carica solo uno Stilista **chiuso del tutto e riaperto**,
compresi i documenti aperti di Lorenzo ([`stilista-un-processo-per-documento.md`](stilista-un-processo-per-documento.md)).

Il 2026-10-29 la chat ha provato ad aggiungere una strada di ricerca generica (`POST /esegui`, chiamate per
riflessione su qualsiasi metodo degli oggetti, accesa solo con un file `ricerca.txt`). Il controllo di
sicurezza di Claude Code l'ha **bloccata**: una strada così fa eseguire qualsiasi cosa sul PC. Lorenzo ha detto
*«fai quello che ti serve, ma non toccare niente del codice nativo di stilista»*: si fanno **strade precise**, una
per voce, nel nostro plugin, e i file di Stilista non si toccano.

**Scritte e compilate** (`Collegamento.Comandi.cs`): `POST /parametri`, `POST /ago`, `POST /cancella`, `POST /ordine`,
`GET /punti-cuciti`. Il 2026-10-29 il plugin del ramo è stato installato (Lorenzo ha chiuso Stilista): `/ordine` e
`/punti-cuciti` provati; `/parametri`, `/ago`, `/cancella` ancora no. Ognuna risponde con prima e dopo. Per provarle va
installato il plugin nuovo e riaperto Stilista del tutto: lo decide Lorenzo, perché il plugin lo usa anche lui.
Restano da scrivere: stop, fermature, tipo di punto, annulla.

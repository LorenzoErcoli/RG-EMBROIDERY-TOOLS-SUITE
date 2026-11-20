---
titolo: POST /oggetti dava contorni in pixel dello schermo, perdeva managed_overrides_int e machine.needle in silenzio; com'è corretto
tipo: codice
tool: []
data: 2026-11-17
---

Trovati da chi costruisce pannelli grandi con `POST /oggetti` (708 riempimenti dal 12/11). Corretti nel plugin RG Stilista Link
([`strumenti-sviluppo/stilista-link/bridge/`](../../strumenti-sviluppo/stilista-link/bridge/ORIGINE.md)) e provati su Stilista
vero, in una finestra a parte su un documento di prova (la cornice di un pannello 358 × 681 mm vista intera).

## 1. Il contorno era in pixel dello schermo

Il bridge crea `fill` e `running` col disegno a mano di Stilista (`InputContornoAMano`), e ogni punto passava da
`ToPhysicalPoint`: **un punto per pixel, allo zoom della finestra**. Su quel pannello visto intero 1 pixel = 0,658 mm: i
contorni cadevano su quella griglia, e una macchia di 2,7 × 4,3 mm era 6,5 pixel (ricalcolo `GenericError`, 0 punti,
risposta `{"ok":false}` senza motivo).

**Com'è adesso** (`CodexTab.ContornoEsatto.cs`). Il clic a mano serve solo a far nascere l'oggetto: si immette una **copia**
della forma, portata a ~200 pixel sul lato lungo e messa al centro della parte visibile (lo zoom si misura con
`ToPhysicalPoint` su 10 cm). Poi, prima del ricalcolo, il contorno diventa quello chiesto al micron
(`SourcePath.CopyOfPoints`, coi tag che Stilista ha dato al primo, all'ultimo e ai punti di mezzo, chiuso se lui lo ha
chiuso) e la linea d'orientamento quella della forma vera (`OrientationLines.setPoints`, lo stesso segmento di prima in
micron). Alla fine si rilegge il contorno: se ha un altro numero di punti o si scosta più di 0,01 mm, è un errore.

La strada «ingrandire lo zoom durante l'inserimento» non è stata presa: a 0,02 mm per pixel l'arrotondamento è già
±0,01 mm, e un pannello di 358 mm sarebbe 17.900 pixel, quasi tutto fuori dalla finestra.

**Misurato** (2026-11-17):

| prova | prima | dopo |
|---|---|---|
| ellisse 2,7 × 4,3 mm, 48 punti, zoom 0,658 mm/px | `GenericError`, 0 punti | 49 punti di contorno (chiuso) **uguali al micron** a quelli mandati (0,0007 mm dai mm mandati: l'arrotondamento al micron), 35 punti cuciti a 30° come chiesto |
| la stessa a (−400, −300) mm, fuori dalla finestra e dal pannello | – | uguale: la copia si immette sempre al centro della vista |
| tre ellissi in un lotto, una di 0,4 mm | – | create tutte e tre (il contorno di queste non è stato riletto) |
| salvata, riaperta in un'altra finestra, ricalcolata senza lucchetto | – | punti cuciti identici, uno per uno: contorno, orientamento e parametri si salvano |

`POST /running` **non fa questa strada**: copia un running del documento e gli scrive il tracciato con `CopyOfPoints`, già
in micron. Il `type: running` di `/oggetti` invece sì, ed è corretto come il fill.

## 2. `managed_overrides_int` si leggeva vuoto

Non era l'applicazione: era la lettura. `RiceviOggetti` (in `Collegamento.cs`) legge il programma con
`DataContractJsonSerializer` **senza** `UseSimpleDictionaryFormat`, e così un `Dictionary<string, int>` si aspetta
`[{"Key":…,"Value":…}]`: da `{"PIFrastaglio": 30}` fa un dizionario **vuoto**, senza errore (provato fuori da Stilista con un
programma net48). Le altre strade del plugin usano `Leggi<T>`, che ha il formato semplice: per questo `POST /parametri`
funzionava.

**Com'è adesso.** `managed_overrides_int` è un `ParametriInteri` (`JsonBridge.cs`), che si legge come `ISerializable`:
il serializzatore gli passa ogni campo dell'oggetto JSON, con tutti e due i formati. Un valore che non è un intero a
32 bit (`1.5`, `"7"`, `3000000000`, la vecchia lista `[{Key, Value}]`) ferma il programma **prima** di creare qualcosa,
col nome del campo. Vale anche per `running` (prima lì `managed_overrides_int` non entrava proprio).

Dopo la creazione ogni parametro del piano si **rilegge** dall'oggetto: un nome che l'oggetto non ha, o un valore che
Stilista ha cambiato, è un errore col suo motivo (prima finiva solo nel log). Misurato: un riempimento con **257 parametri
interi** (tutti quelli di un riempimento di serie, con `PILarghezzaFrastaglio` +7, `PIAllungamentoPunto` +9,
`PIAbilitazioni` 6, `PIThreadDistance` 350) → tutti e 257 come chiesti.

## 3. `machine.needle` si applicava solo con una bandiera

`ApplyBatchNeedleSequence` assegnava l'ago (`CambiaAgo` + `ChangeAgo`) solo con `sequence.apply_native_needle_changes`;
senza, l'oggetto restava sull'ago corrente (l'1) e `PINeedle` da solo non basta. **Adesso l'ago si applica sempre quando c'è**,
e un ago che non resta è un errore. `require_persistent_needle_changes` vuol dire solo «ogni oggetto deve avere il suo ago».
Misurato: aghi 3, 2, 5, 6 coi loro colori, senza bandiere. Il colore va ancora nella tavolozza del documento, per tutto l'ago
(vedi [`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md)).

## Il motivo nella risposta, e tutto o niente

`RiceviOggetti` risponde solo sì o no e sta in `Collegamento.cs`, che altri lavori stanno cambiando. Il motivo arriva lo
stesso: un programma letto da JSON (`JsonBatchSpec.ArrivatoDaJson`, messo da `[OnDeserializing]`) che fallisce **lancia
un'eccezione col motivo**, e il server locale scrive il messaggio di ogni eccezione in `errore`. `Control.Invoke` ripassa
la stessa eccezione al filo del server (provato in net48), quindi non deve averne una interna.

Prima di lanciarla **toglie dal documento gli oggetti fatti da quella richiesta**: il conteggio degli oggetti resta quello di
prima, e chi lavora a lotti può ripartire. Esempi veri:

```
{"ok":false,"errore":"/oggetti non ha creato niente: parametri non applicati — oggetto 1 di 1 («E»): PINonEsiste non c'è fra
 i parametri di questo oggetto. Gli oggetti fatti da questa richiesta (1) sono stati tolti dal documento."}
```

Il lineare di riserva del ritorno a punti (`LineareNativo` in `Collegamento.Ritorno.cs`), che costruisce il programma nel
codice, continua a ricevere solo `false`.

**Trappole e limiti.**
- Il **running** di `/oggetti` non prende `stitch.stitch_length_mm`: chiesto 2500, resta 3000 (era già nella mappa di
  [`stilista-cosa-si-comanda.md`](stilista-cosa-si-comanda.md)). Adesso lo dice: `PISngLunghezzaPunto chiesto 2500, rimasto
  3000`, e non crea niente. Con 3 mm, quella di serie, passa.
- ~~`geometry.holes` non si è mai applicato: adesso un foro non vuoto è un errore prima di creare, invece di un riempimento
  pieno in silenzio.~~ **2026-11-17, più tardi**: i fori si applicano (`CodexTab.ForiEsatti.cs`). Ogni anello di `holes`
  diventa un'area vuota del riempimento (`EmptyAreaPaths`, una copia del contorno coi punti al micron), prima del ricalcolo.
  Prima di creare si controlla che ogni foro stia dentro l'esterno e non tocchi né lui né gli altri fori. Dopo l'ultimo
  ricalcolo si rileggono le aree vuote (stessi punti entro 0,01 mm) e si guarda che nessun punto cucito ci passi dentro più
  di 0,3 mm. Se no, è un errore col motivo e l'oggetto si toglie: mai un riempimento pieno. **Misurato su Stilista**
  (2026-11-17, stesso documento di prova, zoom 0,658 mm/px): un'ellisse di 30 × 20 mm con due fori, uno tondo di 40 punti
  in senso orario e un triangolo, e una macchia di 5 × 4 mm con un foro di 1,6 mm. Aree vuote uguali a quelle chieste (`/fori`:
  41 e 4 punti chiusi, 25 punti). I punti cuciti entrano nei fori al massimo **0,2 mm**, a filo del bordo: è il sormonto del
  riempimento, non un foro pieno (nessun tratto ha la metà dentro un foro). Dopo salvataggio, riapertura e ricalcolo senza
  lucchetto i punti sono identici. Un foro che esce dal contorno dà `geometry.holes: il foro 1 esce dal contorno esterno`
  e il documento non cambia.
- Un riempimento senza `orientation_deg` non si crea (era già così): adesso lo dice.
- Ricalcolare a mano non rovina niente: il contorno esatto è quello salvato.
- Questi file del bridge **non sono più uguali** a quelli del repo d'origine: vedi
  [`ORIGINE.md`](../../strumenti-sviluppo/stilista-link/bridge/ORIGINE.md).

**Come si è provato senza installare.** Un processo nuovo di Stilista legge `PLUG-INS\pluginlist.txt` quando parte. Si è
fatta una copia di sicurezza del file, si è fatta puntare per qualche secondo la riga di RG Stilista Link al plugin compilato,
si è avviato `Stilista3.3.exe --skipOpenCheck <un DST di prova>`, e appena il plugin ha aperto la sua porta si è rimesso il file
(identico byte per byte, controllato). Non sono nate riserve nuove. La finestra di prova ha preso l'ultima porta libera (5379,
con 9 documenti aperti) e ~470 MB. Prima di partire si guarda la memoria libera: quel giorno erano 2,1 GB su 31,6.

**Come si applica.** Chi usa `/oggetti` può togliere le sue protezioni contro questi difetti: lo stop sotto gli 8 pixel, e i
`POST /parametri` e `POST /ago` dopo la creazione. Deve invece leggere `errore` quando `ok` è falso: c'è sempre. Vale **solo
col plugin che contiene queste correzioni**: quello installato il 5 novembre ha ancora i tre difetti.

# RG Stilista Link

Il collegamento fra **Stilista 3.3** e i tool della suite (ramo `stilista-link`, prototipo del 2026-10-20).
Lorenzo: *«se io da Stilista selezionassi un oggetto e quindi un'area, e poi gli dico lavoriamolo con questo
tool, lo scelgo, lavoro e poi invio la lavorazione dentro Stilista. Un vero plugin, ma esterno, che non
appesantisca Stilista»*.

```
Stilista                                   browser (suite, porta 5270)
┌──────────────────────────────┐           ┌──────────────────────────────┐
│ scheda «RG_LINK»             │  apre →   │ Generatore pattern           │
│  [Lavora la selezione…]      │           │  ?stilista=<porta>           │
│ server 127.0.0.1:5370…5379   │ ← GET ─── │  «Prendi la selezione…»      │
│  /selezione.svg  /dst  …     │ ─ SVG mm →│  (import di sempre, ruoli)   │
│                              │ ← POST ── │  «Invia a Stilista» (DST)    │
│ LoadNewEmb(dst)              │           │                              │
└──────────────────────────────┘           └──────────────────────────────┘
```

Dentro Stilista non si calcola niente: c'è un ascoltatore fermo finché un tool non chiama, e quello che
tocca il documento passa dal filo dell'interfaccia di Stilista, come un clic.

## Installare

```powershell
powershell -ExecutionPolicy Bypass -File strumenti-sviluppo\stilista-link\scripts\build.ps1
powershell -ExecutionPolicy Bypass -File strumenti-sviluppo\stilista-link\scripts\install.ps1
```

`install.ps1` copia `StilistaLink.exe` in `C:\GMI\Stilista3.3\PLUG-INS\RGStilistaLink\` e lo aggiunge a
`pluginlist.txt` (con backup; gli altri plugin restano). Stilista lo carica al riavvio: compare la scheda
**RG_LINK**. Serve la suite aperta (`avvia.bat`, porta 5270).

## Le richieste

| | |
|---|---|
| `GET /stato` | documento, oggetti, selezionati, quando la finestra è stata attivata |
| `GET /selezione.svg` | i contorni degli oggetti selezionati, in mm: l'esterno col colore del filo, **ogni foro un tracciato a sé** col colore dichiarato in `data-rg-stilista-fori`; l'angolo della selezione meno 1 mm è lo 0,0, scritto in `data-rg-stilista-origine` |
| `GET /selezione.json` | gli stessi oggetti come li legge il bridge (tipo, contorno, punti cuciti, parametri) |
| `GET /fori` | per ogni oggetto con più di un anello (o per `?oggetti=…`): gli anelli, da dove vengono e quali sono fori — ricerca |
| `GET /sonda` | campi, proprietà e metodi degli oggetti selezionati e dei loro percorsi: ricerca, sola lettura |
| `POST /dst?nome=…` | un DST: Stilista lo apre in un documento nuovo (`IStilista3.LoadNewEmb`) |
| `POST /oggetti` | un programma `stilista-bridge-batch-1`: oggetti nativi `fill`/`running` aggiunti al documento aperto |
| `POST /punti` | **il ricamo di un tool torna nel documento aperto, al suo posto**, come oggetto a punti manuali: `{ origine_mm, punti: [[x, y, salto]…] }` in mm nel riferimento dell'SVG della selezione; ago e colore quelli del primo oggetto selezionato |
| `POST /salva-copia` | una copia del documento in `%TEMP%\rg-stilista-link\copia-*.emg3`, da rileggere col lettore offline (il file aperto non si tocca) |

`?oggetti=0,3` sulle GET usa quegli oggetti del documento al posto della selezione (prove senza mouse; dal
tool: `?stilista-oggetti=0,3` nell'indirizzo). Le POST vogliono l'intestazione `X-RG-Link`, e il browser
legge le risposte solo da pagine `localhost`/`127.0.0.1`.

## Fatti misurati (2026-10-20)

- **Stilista apre un processo per documento**, più un processo d'avvio e due-tre riserve `/WAIT`, e il plugin
  si carica in tutti. Il server parte solo dove la finestra è visibile, sulla prima porta libera da 5370
  (le 5270–5313 sono dei server di sviluppo della suite). Il processo d'avvio ne prende una anche lui, con
  zero oggetti: il tool sceglie la finestra con una selezione, poi con un documento, poi l'ultima attivata.
- La selezione è `Box.SelectedDsgObj`; il contorno arriva con gli stessi punti salvati (prima macchia di
  `macchie-84.emg3`: 98 punti, primo punto 8,047 · 21,059 mm, come il lettore offline).
- Andata e ritorno provati col Generatore pattern: 3 macchie → confine di ritaglio, formato 51 × 28 mm,
  773 punti → «Invia a Stilista» → Stilista apre il DST in una finestra nuova (1 oggetto).

## Il ritorno al suo posto (`POST /punti`)

«Invia a Stilista» nel Generatore: se il cartamodello è venuto da Stilista (l'SVG porta
`data-rg-stilista-origine`), il ricamo torna **nel documento di partenza**; altrimenti il DST si apre in un
documento nuovo. Nel plugin (`Collegamento.Ritorno.cs`):

1. un oggetto lineare nativo dal primo all'ultimo punto, col protocollo del bridge (ago e colore giusti);
2. `DesignObject.OldPoints2StitchPath(TAGGEDPOINT[])` coi nostri punti (`TAGGEDPOINT(x µm, y µm, tag)`:
   tag 0 punto, bit 1 = 2 salto, bit 15 STOP);
3. subito `new DsgObjCollection(lineare).MergeToManualStitch()`: un oggetto **Manual** (tipo nativo 1); il
   suo contorno diventa i nostri punti (`SourcePath.CopyOfPoints`); prende il posto del lineare, col
   lucchetto (`LockRecalc`), e i punti gli si riscrivono ora che è nel documento;
4. un **guardiano** per 15 s: Stilista ricalcola l'oggetto una volta, ~300 ms dopo l'inserimento, e se i punti
   non sono più i nostri li riscrive;
5. la risposta aspetta (fino a 4 s) due misure di fila coi punti identici ai nostri: solo allora `ok`.

`OldPoints2StitchPath` non è affidabile prima che l'oggetto stia nel documento: sul lineare della corona
(26.486 punti) non ha preso niente, sul manuale non ancora inserito ne contava 0 (sulle macchie, 773 punti,
aveva funzionato). Per questo il controllo è alla fine, sull'oggetto vero.

**Misurato** (Generatore, 3 macchie di `macchie-84.emg3`, 2026-10-20): 773 punti mandati, nella copia salvata
oggetto `manual`, ago 1 `#EDE300`, **773 punti identici al micron** a quelli mandati più l'origine; i 315 che
cadono «fuori» dalla macchia sono sul contorno (≤ 1 µm). Le strade provate e scartate, e perché, sono in
[`sapere/codice/stilista-oggetto-manuale.md`](../../sapere/codice/stilista-oggetto-manuale.md).

## I fori (2026-10-21)

Un riempimento di Stilista tiene i fori nelle sue **aree vuote**: `DesignObject.EmptyAreaPaths`, un
`GMIPath[]`. Il plugin li manda come tracciati a sé, col colore dei fori (`#FF00FF`, o `#00FFFF`/`#808080` se
un filo selezionato ha già quel colore) dichiarato nell'SVG; il Generatore dà a quel colore «Area vuota» e a
ogni altro «Confine di ritaglio». Se il contorno stesso avesse più anelli separati da un salto o da un inizio
blocco, il plugin li divide e i più piccoli che stanno dentro sono fori (non visto ancora in un file vero).

`GMIPathTAGGED.Strokes()` **non** sono gli anelli: su una macchia di 98 punti senza fori dà 11 «tratti» per
oltre 300 punti, e su SH295 non finiva più.

**Misurato** su una copia di `SH295 DAV 1984.EMG3` (206 oggetti, 4 con fori, `/fori` in meno di un secondo):
l'oggetto 11, una corona di 220 mm con un foro di 11.881 mm², arriva al Generatore come confine + area vuota,
il pattern fa 26.486 punti e nessuno nel foro; tornato in Stilista: nella copia salvata oggetto `manual`, ago 7,
**26.486 punti identici al micron**, contorno 26.486; i 647 che cadono «nel foro» stanno sul suo bordo (≤ 1 µm).
Il pattern ha 2.070 punti oltre 12 mm (fino a 48,8), tutti nella corona, nessuno attraversa il foro: nel DST
lo scrittore li divide a 12,1 mm, in Stilista restano interi.

## Cosa manca

1. **Il ricalcolo dell'oggetto tornato**: se in Stilista lo si ricalcola (cambiando i parametri), ripercorre
   i nostri punti a 3 mm e li perde. Spostarlo o salvarlo non lo ricalcola (da confermare a mano).
2. **L'annulla**: l'oggetto entra senza un punto d'annullamento di Stilista (`createUndoPoint` da provare).
3. **La posizione nella sequenza**: oggi va in fondo; potrebbe andare subito dopo l'oggetto selezionato.
4. **I fori al ritorno degli oggetti nativi** (`POST /oggetti`): il bridge dichiara `holes` ma non li immette.
   Al ritorno dei punti non servono: il tool i fori li ha già rispettati.
5. Gli altri tool: il modulo `@rg/ui/stilista` è comune, a ogni tool servono i due pulsanti.
6. Le finestre aperte prima di un'installazione tengono il plugin vecchio: dopo un aggiornamento si riapre
   Stilista (il tool lo dice). `install.ps1` mette ogni versione in una cartella con data e ora.

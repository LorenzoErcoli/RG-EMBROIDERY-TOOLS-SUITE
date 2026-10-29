# RG Stilista Link

Il collegamento fra **Stilista 3.3** e i tool della suite (ramo `stilista-link`, prototipo del 2026-10-20).
Lorenzo: *«se io da Stilista selezionassi un oggetto e quindi un'area, e poi gli dico lavoriamolo con questo
tool, lo scelgo, lavoro e poi invio la lavorazione dentro Stilista. Un vero plugin, ma esterno, che non
appesantisca Stilista»*.

```
Stilista                                   browser (suite, porta 5270)
┌──────────────────────────────┐           ┌──────────────────────────────┐
│ scheda «RG_LINK»             │  apre →   │ la home: scegli il tool      │
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

`install.ps1` è l'installazione di sviluppo: passa a `pacchetto\installa.ps1` il plugin appena compilato e
l'indirizzo della suite locale (`avvia.bat`, porta 5270). Il plugin va in
`C:\GMI\Stilista3.3\PLUG-INS\RGStilistaLink\<data-ora>\` con il suo `indirizzo.txt`, e la sua riga in
`pluginlist.txt` (gli altri plugin restano; la copia di sicurezza in `RGStilistaLink\backup\`). La versione
nuova la carica solo uno Stilista **chiuso del tutto e riaperto**: Stilista tiene dei processi di riserva già
avviati, senza finestra, che hanno letto `pluginlist.txt` prima e aprono i documenti nuovi col plugin di
prima (2026-10-28: chiudere le finestre non bastava). Le versioni vecchie si cancellano solo a Stilista
chiuso: toglierle a una riserva le rompe.

### Darlo da provare (2026-10-27)

```powershell
powershell -ExecutionPolicy Bypass -File strumenti-sviluppo\stilista-link\scripts\pacchetto.ps1
```

scrive `out\RG-Stilista-Link-<data>.zip` (fuori da git): `StilistaLink.exe`, **`Installa.cmd`**,
**`Disinstalla.cmd`**, i due script, `indirizzo.txt` (la suite online,
`https://lorenzoercoli.github.io/RG-EMBROIDERY-TOOLS-SUITE/`), `LEGGIMI.txt` e `versione.txt` (data e commit).
Chi lo prova estrae lo zip e fa doppio clic su `Installa.cmd`: niente Node, niente repo.

- **L'installazione** cerca Stilista (quello aperto, `C:\GMI\Stilista3.3`, le altre cartelle in `C:\GMI` e
  `Program Files\GMI`; o `-Stilista <cartella>`), toglie al plugin il segno «scaricato da internet» (.NET
  non lo caricherebbe) e se non può scrivere dice di rieseguirla come amministratore.
- **La disinstallazione** vuole Stilista chiuso (i processi senza finestre, d'avvio e di riserva, li chiude
  lei), toglie la riga da `pluginlist.txt` **senza rimettere una copia vecchia** (gli altri plugin restano come
  sono ora), cancella `PLUG-INS\RGStilistaLink\`, `%TEMP%\rg-stilista-link\`, `%TEMP%\rg-stilista-link.log` e
  le `pluginlist.txt.<data-ora>.bak` delle installazioni di sviluppo di prima che contengono la nostra riga.
  Non scrive niente nel registro di Windows, né prima né dopo. Restano i ricami tornati nei documenti (lavoro
  dell'utente) e, nel browser, il permesso alla rete locale dato al sito (si toglie a mano).
- **Provato** su una cartella Stilista finta con una `%TEMP%` finta: installa, reinstalla (la versione di prima
  si cancella), disinstalla → `pluginlist.txt` identico byte per byte a prima, nessun file né cartella del
  plugin rimasti, il registro del bridge intatto.

**La suite online.** Il plugin risponde alle pagine localhost e a quella del suo `indirizzo.txt` (l'origine,
`https://lorenzoercoli.github.io`, che è comune a tutti i siti GitHub Pages di quell'account), e solo a
richieste per `127.0.0.1`/`localhost` (un altro nome che punta lì, il *DNS rebinding*, ha 421). Il disegno
passa fra il browser e Stilista sullo stesso PC, non su internet. Chrome ed Edge recenti chiedono una volta il
permesso alla rete locale; il browser integrato dell'app Claude invece blocca da sé le richieste dei siti verso
`127.0.0.1` (`ERR_BLOCKED_BY_CLIENT`): la prova dalla pagina online va fatta in Chrome o Edge. **Online i
pulsanti Stilista ci sono solo quando `stilista-link` è unito in master** (la pagina si pubblica dai push su
master).

## Le richieste

| | |
|---|---|
| `GET /stato` | documento, oggetti, selezionati, quando la finestra è stata attivata, l'indirizzo della suite |
| `GET /selezione.svg` | i contorni degli oggetti selezionati, in mm: l'esterno col colore del filo (per un **laser** il colore dei suoi parametri laser, quello che si vede in Stilista), **un colore per ogni gruppo (stop, colore)** — un altro stop con lo stesso filo prende una variante più chiara o più scura, lo stop si conta lungo la sequenza a ogni cambio d'ago; **ogni foro un tracciato a sé** col colore dichiarato in `data-rg-stilista-fori` e quello del suo oggetto in `data-rg-stilista-di`; l'angolo della selezione meno 1 mm è lo 0,0, scritto in `data-rg-stilista-origine` |
| `GET /selezione.json` | gli stessi oggetti come li legge il bridge (tipo, contorno, punti cuciti, parametri) |
| `GET /fori` | per ogni oggetto con più di un anello (o per `?oggetti=…`): gli anelli, da dove vengono e quali sono fori — ricerca |
| `GET /foglie` | i valori semplici (numeri, testi, enum, colori) raggiungibili dai campi degli oggetti selezionati, col percorso (`?livelli=4`, al più 8): confrontando due oggetti si vede dove sta quello che li distingue — ricerca, così si è trovato il colore laser |
| `GET /sonda` | campi, proprietà e metodi degli oggetti selezionati e dei loro percorsi: ricerca, sola lettura |
| `POST /dst?nome=…` | un DST: Stilista lo apre in un documento nuovo (`IStilista3.LoadNewEmb`) |
| `POST /oggetti` | un programma `stilista-bridge-batch-1`: oggetti nativi `fill`/`running` aggiunti al documento aperto |
| `POST /punti` | **il ricamo di un tool torna nel documento aperto, al suo posto**, come oggetto a punti manuali: `{ origine_mm, punti: [[x, y, salto]…] }` in mm nel riferimento dell'SVG della selezione; ago e colore quelli del primo oggetto selezionato |
| `GET /ingresso-uscita` · `POST /ingresso-uscita` | **ingresso e uscita di un riempimento** (2026-10-29): leggerli (scelti, icone, primo e ultimo punto cucito) e scriverli: `{ origine_mm?, modo?: "ui"\|"diretto", oggetti: [{ indice?, inizio_mm, fine_mm }] }`, in mm nel riferimento del documento (o dell'SVG con `origine_mm`); abilita, scrive come un clic, ricalcola e rilegge subito e dopo 1,5 s. Vanno dati sul contorno: vedi [`sapere/codice/stilista-ingresso-uscita.md`](../../sapere/codice/stilista-ingresso-uscita.md) |
| `POST /ricalcola?oggetti=…[&sblocca=1]` | per le prove: ricalcola quegli oggetti come Stilista (con `sblocca` senza lucchetto) e dice i punti prima e dopo |
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

«Invia a Stilista» in un tool: se il cartamodello è venuto da Stilista (l'SVG porta
`data-rg-stilista-origine`), il ricamo torna **nel documento di partenza**, uno strato = un oggetto;
altrimenti il DST si apre in un documento nuovo. Nel plugin (`Collegamento.Ritorno.cs`):

1. l'oggetto di partenza è una **copia dell'oggetto selezionato** da cui è partito il lavoro
   (`DesignObject.Clone(EmbDesignData, bool)`: ago e colore giusti, nessun clic nell'interfaccia): il primo
   selezionato **da ricamo** (`Parameters.isConRicamo`, meglio se con punti) **che non è un laser**
   (`ContainsLaser`). Da un laser i nostri punti diventano tagli laser: Stilista li conta in
   `GetTotalNumberOfLaserCoords`, `TotalStitches` resta 0 e `Stitches()` li dà vuoti (2026-10-28, vedi sotto).
   Se i selezionati sono tutti laser, il modello si cerca negli altri oggetti del documento. Se non c'è
   nessun oggetto da ricamo, si crea un **Manual nuovo**: `new DesignObject(EmbDesignData,
   ObjectType.Manual, cTarget.Embroidery)`, come fa Stilista in `MergeToManualStitch`, poi va sull'ago
   chiesto o su quello di partenza. **L'ago di partenza** (`data-rg-stilista-ago`) è quello del modello se è
   fra i selezionati; se i selezionati sono tutti laser è **il primo ago dopo i loro** (Lorenzo, 2026-10-28:
   «il primo ago dopo quelli dei laser»), così il ricamo non va sull'ago dei tagli. Solo se anche questo non riesce, un lineare nativo «cliccando»
   `btLinear1` nella barra, che c'è solo se la barra mostra quella scheda (2026-10-21: «native function
   selection failed», ritorno fermo);
2. `OldPoints2StitchPath(TAGGEDPOINT[])` coi nostri punti (`TAGGEDPOINT(x µm, y µm, tag)`: tag 0 punto,
   bit 1 = 2 salto, bit 15 STOP);
3. `new DsgObjCollection(partenza).MergeToManualStitch()` dà un oggetto **Manual**; il suo contorno diventa i
   nostri punti (`SourcePath.CopyOfPoints`), la descrizione «RG Tools · …», il lucchetto (`LockRecalc`);
4. nel documento (in fondo; al posto del lineare se si è usata la riserva), poi i punti si riscrivono;
5. la risposta aspetta (fino a 9 s) tre misure di fila coi punti identici ai nostri: solo allora `ok`.
   Se non arriva e l'oggetto è rimasto a 0 punti, si toglie dal documento; la risposta dice anche
   `punti_laser`.

**La sentinella** (`Collegamento.Sentinella.cs`). Regola: in un oggetto la cui descrizione comincia per
«RG Tools · » i punti cuciti sono uguali al contorno. Ogni secondo li controlla, e se Stilista li ha
ricalcolati li rimette. Spostare o ruotare l'oggetto muove contorno e punti insieme, quindi non annulla niente;
per modificarne i punti a mano si toglie «RG Tools» dalla descrizione. Vale anche su un file riaperto.
Dopo **5 riscritture di fila senza effetto** l'oggetto si lascia, con una riga nel log.

**Il guasto del 2026-10-28** (Pattern a macchie, 48 oggetti selezionati: la base, 16.783 punti, tornava con
0 punti, la sentinella la riscriveva ogni secondo per sempre, raso e punto sopra non partivano). Il modello
era il primo selezionato, e il primo era un **laser**. Nel codice di Stilista (`Emg2_IO`):
`OldPoints2StitchPath` → `ElaboratedPath.ConvertOldPoints` traduce i tag coi tipi di punto dell'oggetto, e
per un laser ogni punto prende il bit `ExecuteWithLaser`; il riepilogo (`doRecalculateSummary`) li conta come
coordinate laser, non come punti, e `Stitches()` restituisce i punti solo se `TotalStitches > 0`. Quindi i
punti c'erano, ma erano tagli. Nel vecchio log ci sono gli stessi fallimenti dal 2026-10-20 (rete-1, level0,
RG pattern), sempre con più oggetti selezionati e mai con uno solo. Il log ora scrive quale oggetto fa da
modello (`RGLink.Modello`) e i punti laser accanto ai punti. La seconda prova ha mostrato che nel documento
delle macchie **tutti i 47 oggetti sono laser** (ago 1, #ED1C24): `MergeToManualStitch` prende il target
dal primo oggetto, quindi da un laser fa un manuale laser. Da qui il Manual nuovo da ricamo.

**Misurato** (2026-10-21, net-45 sulla corona di SH295): 17.201 punti tornati in 4 s; **ricalcolo forzato,
anche senza lucchetto (`/ricalcola?sblocca=1`): 17.201 prima e dopo**. Col lineare di partenza di prima, lo
stesso ricalcolo li riduceva (773 → 346, 2, 251) e Stilista lo ripeteva da sé (nel ritorno di Lorenzo delle
09:49, 70.221 punti, a 0,3, 6,9 e 11 s): la causa era l'oggetto di partenza. La sentinella resta come rete;
nelle prove non è dovuta intervenire. Le strade scartate sono in
[`sapere/codice/stilista-oggetto-manuale.md`](../../sapere/codice/stilista-oggetto-manuale.md).

## I tool agganciati

`@rg/ui/stilista` ha l'**aggancio** (`AggancioStilista`): il tool dice come carica un SVG, come dà i ruoli
(i fori → la sua area vuota, il resto → il suo contorno), quali strati ha cucito e come fa il DST; i due
bottoni (`BOTTONE_PRENDI_STILISTA`, `BOTTONE_INVIA_STILISTA`) e `collegaStilista` fanno il resto. Con
`?stilista=<porta>` nell'indirizzo il tool prende la selezione da solo: il pulsante «Lavora la selezione con RG Tools…» della scheda RG_LINK apre la HOME della suite con quel parametro, e il tool che scegli dalle schede lo tiene (i link sono `#/tool`).

| tool | i fori | il ritorno | prova sulla corona di SH295 |
|---|---|---|---|
| Generatore pattern | area vuota | al suo posto | 26.486 punti, nessuno nel foro, identici al micron nella copia salvata |
| net-45 | area vuota | al suo posto | 17.201 punti, ricalcolo forzato senza effetto |
| striatura | area vuota | al suo posto | 13.435 punti, 1 salto |
| interlace | area vuota | al suo posto, un oggetto per stop | 4 oggetti, 19.060 punti |
| rete testa speciale | area vuota | al suo posto (nel modo radiale: DST) | 4.803 punti |
| razza | area vuota (la decide la geometria) | al suo posto | 14.602 punti |
| oblique | anello interno del suo oggetto (il foro torna al colore dell'oggetto; ogni stop resta un colore per i ruoli, il primo fa il Pannello) | al suo posto, un oggetto per livello | 3 oggetti, 35.833 punti — **ma level2 ha 4 punti cuciti che attraversano il foro (254 mm)**: è del tool, uguale nel suo DST |
| pattern a macchie | senza ruolo (non ha aree vuote) | al suo posto, un oggetto per stop | corona + un oggetto grigio: 2 oggetti |
| cannage rafia | senza ruolo | al suo posto, un oggetto per stop | 234 punti (senza rombi c'è poco da fare) |
| pattern a zone | spenti, e una zona spenta dentro un'altra è un buco (2026-10-21) | al suo posto, un oggetto per ago | 19.980 punti, foro vuoto (prima 25.360, foro ricamato) |
| cross-stitch | area vuota | **DST in un documento nuovo**: la griglia parte da 0,0 nell'angolo della forma | forma 220 × 220, 1.060 celle su 1.936 |

Prende «Auto» come scala d'import chi l'aveva a Illustrator 72 dpi (rete, macchie, cannage, zone): l'SVG dichiara i mm.
La larghezza reale torna a 0 (net-45, striatura, interlace, razza, oblique, cross-stitch).
**Gli aghi** (Lorenzo, 2026-10-21): come nel DST ogni strato è un cambio ago — anche gli stop dello stesso filo — e gli aghi sono **consecutivi da quello dell'oggetto selezionato**, coi colori che hanno già nel documento (la tavolozza non si tocca; un ago che non c'era si aggiunge). Interlace sulla corona di SH295 (oggetto sull'ago 7): 4 oggetti sugli aghi 7, 8, 9, 10.
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

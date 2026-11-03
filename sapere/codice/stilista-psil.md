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

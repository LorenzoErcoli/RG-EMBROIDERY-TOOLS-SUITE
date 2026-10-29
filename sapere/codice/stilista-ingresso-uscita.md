---
titolo: Dove Stilista tiene ingresso e uscita di un riempimento (myIniEndPoint)
tipo: codice
tool: [pattern-macchie]
data: 2026-10-29
---

Misurato col plugin RG Stilista Link (`GET /foglie?livelli=6`, prima e dopo) su un riempimento raso verticale
(ago 2, `PISngSfasamentoPuntoRaso` 30) nel file di prova di Lorenzo `SWATCH V4 BASE - TEST SERPENTE
GHEPARDATO stilista.emg3`. Lorenzo ha spostato a mano l'ingresso in alto a sinistra e l'uscita in basso a destra.

**Dove sono.** Nel campo `BaseObject.myIniEndPoint` (tipo `MarkersPoints`) ci sono quattro `cMarkerPoint`:
`PuntoInizio`, `PuntoFine`, `PuntoIngresso` e `PuntoUscita`, ognuno con un `Point` in µm, nello stesso
riferimento del contorno (`SourcePath`). La y cresce verso il basso.

| | prima (automatico) | dopo (a mano) |
|---|---|---|
| `PuntoInizio/cMarkerPoint.Point` | 2147483647, 2147483647 | 34833, 64184 (in alto a sinistra) |
| `PuntoFine/cMarkerPoint.Point` | 2147483647, 2147483647 | 43912, 74767 (in basso a destra) |

`2147483647` (`int.MaxValue`) vuol dire «non scelto»: Stilista decide da sé. `PuntoIngresso` e `PuntoUscita`
hanno solo la posizione dell'icona (`IconGraphicRapr`), che segue Inizio e Fine. Il contorno della macchia
andava da 32,7 a 44,4 mm in x e da 63,1 a 76,9 mm in y.

**Spostarli ricalcola l'oggetto.** I punti cuciti sono passati da 168 a 152.

**Scriverli da codice funziona** (2026-10-29, `POST /ingresso-uscita` del plugin, `Collegamento.IngressoUscita.cs`).
Prova in un documento nuovo di Lorenzo (`Noname.emg3`), su un suo riempimento raso a 5 lati (263 × 190 mm,
35.093 punti, fase 30%, ingresso e uscita non abilitati). Prima `InizioFineStato` → `Enabled` (era `Disabled`),
poi `cMarkerPoint.setPointFromUI(Point)` su `PuntoInizio` e `PuntoFine`, poi `NeedRestitching` + `RicalcolaDiretta`:

| ingresso e uscita chiesti | primo punto cucito | ultimo punto cucito |
|---|---|---|
| sul bordo (a metà di due lati) | a 0,48 mm dall'ingresso | a 0,20 mm dall'uscita |
| dentro la forma, lontano dal bordo | a 60,8 mm: Stilista parte dal bordo, nel verso dell'orientamento | a 29,8 mm |

Con i punti sul bordo, Stilista li rispetta: uguali subito e 1,5 s dopo, e anche dopo un ricalcolo forzato
(`/ricalcola`, 35.260 punti prima e dopo, ingresso e uscita fermi). Le icone (`PuntoIngresso`, `PuntoUscita`)
vanno sui punti scritti. Ingresso e uscita vanno quindi dati **sul contorno** della macchia.

**Ancora da vedere.** Le macchie piccole a raso verticale del pannello, più macchie in fila nel nostro ordine,
e se il punto di annulla (`createUndoPoint`) funziona davvero in Stilista.
Vedi anche [`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md).

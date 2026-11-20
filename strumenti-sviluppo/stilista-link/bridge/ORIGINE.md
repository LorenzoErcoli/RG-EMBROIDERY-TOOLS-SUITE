# Da dove viene questo codice

Copia **non modificata** dei sorgenti dello Stilista JSON Bridge:

- repo `stilista-host-skeleton`, cartella `handoff/stilista-json-bridge-clean/src/`
- commit `db2722b` (2026-09-29, «Checkpoint: bridge Stilista, corpus EMG e lettore offline»)
- copiati il 2026-10-20 tutti i `.cs` **tranne** `CodexTab.cs` e `Stilista3PluginInterface.cs`: la scheda e
  il punto d'ingresso del plugin sono quelli di RG Stilista Link (`../Collegamento.cs`, `../PuntoIngresso.cs`).
- dal 2026-10-27 **anche senza `ProbeLog.cs`**: il registro è quello del plugin (`../Registro.cs`, stessa classe,
  file `%TEMP%\rg-stilista-link.log`), perché il plugin si dà ad altri e si disinstalla senza toccare il bridge.

Servono a creare oggetti nativi ricalcolabili (`fill`, `running`) col protocollo collaudato del bridge
(contorno immesso come clic sul canvas, `EditRdo` per l'orientamento, `CambiaAgo` + `ChangeAgo` per gli aghi)
e a leggere gli oggetti vivi (`EnrichEmgReadObject`).

**Non si correggono qui.** Un difetto si corregge nel bridge e si ricopia, annotando qui il nuovo commit;
altrimenti le due copie divergono in silenzio.

**Eccezione, 2026-11-17: corretti qui** (le prove di `POST /oggetti` sono state fatte col plugin, non col bridge).
Divergono dal bridge `JsonBridge.cs`, `CodexTab.NativePunch.cs`, `CodexTab.BatchImport.cs`, `CodexTab.Sequence.cs`, ed è
nuovo `CodexTab.ContornoEsatto.cs`: contorno al micron invece che in pixel dello schermo, `managed_overrides_int` letto
anche senza il formato semplice dei dizionari e ricontrollato, `machine.needle` sempre applicato, il motivo di ogni errore.
Vedi [`sapere/codice/stilista-oggetti-esatti.md`](../../../sapere/codice/stilista-oggetti-esatti.md). Da riportare nel
bridge, se si continua a usarlo da solo.

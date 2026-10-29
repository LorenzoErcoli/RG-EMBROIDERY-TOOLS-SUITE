---
titolo: Come si mette in Stilista un ricamo a punti fissi (oggetto Manual), e cosa lo rovina
tipo: codice
tool: [pattern-grammar]
data: 2026-10-20
---

Misurato col plugin RG Stilista Link ([`strumenti-sviluppo/stilista-link/`](../../strumenti-sviluppo/stilista-link/README.md),
`Collegamento.Ritorno.cs`), rimettendo nel documento i 773 punti del Generatore pattern.

**La strada che funziona** (corretta il 2026-10-21, vedi sotto). ~~Un oggetto lineare nativo (il protocollo del bridge)~~ Una copia dell'oggetto selezionato → i suoi punti cuciti
diventano i nostri con `DesignObject.OldPoints2StitchPath(TAGGEDPOINT[])` → **subito**
`new DsgObjCollection(lineare).MergeToManualStitch()` dà un oggetto **Manual** (tipo nativo 1) il cui contorno
sono i nostri punti → prende il posto del lineare → un guardiano riscrive i punti se Stilista li cambia.
Nella copia salvata: 773 punti identici al micron.

**Cosa lo rovina: il ricalcolo.** Ogni ricalcolo di un oggetto lineare o manuale **ripercorre il suo contorno
con la sua lunghezza punto**. Provato e scartato:

| tentativo | risultato |
|---|---|
| lineare coi punti cambiati + `LockRecalc` | ricalcolato dal suo contorno di 2 punti: 773 → **2** |
| manuale da `MergeToManualStitch`, lasciato com'è | ricalcolato da solo ~350 ms dopo l'inserimento, a 3 mm: 773 → **346** |
| `PISngLunghezzaPunto` a 100 mm col copiatore di parametri del bridge | il valore non cambia (resta 3000) |
| `FunctionParamIndex` 3, quello degli oggetti di un DST aperto in Stilista | ricalcolato: 773 → **251** |
| `LockRecalc` + `NeedRestitching = false` prima dell'inserimento | ricalcolato lo stesso: 346 |
| gli stessi **dopo** l'inserimento + guardiano | un solo intervento del guardiano, poi 773 stabili |

Un DST aperto in Stilista (`FunctionParamIndex` 3) tiene i punti (18.645 su 18.645) **solo perché nessuno lo
ricalcola**: non è un tipo di oggetto «immune».

**`OldPoints2StitchPath` non agisce sempre subito** (2026-10-21, corona di SH295, 26.486 punti): sul lineare
appena creato non ha preso niente (restavano 2 punti; coi 773 delle macchie aveva funzionato), sul manuale non
ancora inserito ne contava 0; inserito nel documento, sì. Quindi: il contorno del manuale si assegna
(`SourcePath.CopyOfPoints`, scrivibile), i punti si riscrivono dopo l'inserimento, e l'esito si giudica solo
alla fine, misurando l'oggetto vero finché due misure di fila danno i nostri punti (al più 4 s; ci vogliono ~3 s).

**L'oggetto di partenza decide tutto** (2026-10-21). Col lineare nativo, il manuale che ne nasce viene
ricalcolato da Stilista e ripercorso (anche più volte: 0,3, 6,9 e 11 s dopo, in un ritorno di 70.221 punti di
Lorenzo). Partendo da una **copia dell'oggetto selezionato** (`Clone(EmbDesignData, bool)`) il manuale tiene i
suoi punti: net-45 sulla corona di SH295, 17.201 punti, ricalcolo forzato anche senza lucchetto → 17.201.
Il lineare resta solo di riserva (e richiede il pulsante `btLinear1` visibile nella barra di Stilista). In
più, una sentinella rimette i punti uguali al contorno negli oggetti descritti «RG Tools · ».

**Il modello non può essere un laser** (2026-10-28). Copiato da un laser, il ricamo torna a 0 punti per
sempre e nessuna riscrittura lo aggiusta. In `Emg2_IO`: `OldPoints2StitchPath` → `ElaboratedPath.ConvertOldPoints`
(o `ConvertOldPointsFromAgo`) traduce ogni tag col tipo di punto dell'oggetto (`OldTag2NewTag`), e per un laser
prende il bit `ExecuteWithLaser`. Il riepilogo (`doRecalculateSummary`) conta quei punti in `TotalLaserCoords`,
non in `TotalStitches`, e `Stitches()` restituisce i punti solo se `TotalStitches > 0`. Quindi i punti ci sono,
ma come tagli laser. Altre due trappole silenziose della stessa funzione: non scrive niente se i tipi di
punto dell'oggetto sono vuoti, o se il percorso cucito non è di tipo 0, 14 (laser) o 19. Il modello va quindi
scelto fra i selezionati: da ricamo (`Parameters.isConRicamo`), `ContainsLaser` falso. `MergeToManualStitch`
prende il target del manuale dal primo oggetto (laser → manuale laser), e quando può copia i suoi parametri
con la funzione `Manuale`. Senza nessun oggetto da ricamo nel documento (le macchie: 47 laser) il manuale si
crea come lo crea lui: `new DesignObject(EmbDesignData, ObjectType.Manual (1), cTarget.Embroidery)`. Il
costruttore assegna l'ago corrente (`Objects.AddNeedle`).

**Come si applica.** Un ricamo calcolato fuori da Stilista entra come Manual e non va ricalcolato: chi lo
ricalcola a mano in Stilista lo perde. Il colore: il codice del bridge che assegna l'ago **scrive il colore
nella tavolozza del documento** (`TrySetNativeThreadColor`), quindi al ritorno si passa il colore che
quell'ago ha già, mai uno nuovo — altrimenti si ricolora tutto l'ago. Vedi anche
[`stilista-un-processo-per-documento.md`](stilista-un-processo-per-documento.md).

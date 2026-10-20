---
titolo: Come si mette in Stilista un ricamo a punti fissi (oggetto Manual), e cosa lo rovina
tipo: codice
tool: [pattern-grammar]
data: 2026-10-20
---

Misurato col plugin RG Stilista Link ([`strumenti-sviluppo/stilista-link/`](../../strumenti-sviluppo/stilista-link/README.md),
`Collegamento.Ritorno.cs`), rimettendo nel documento i 773 punti del Generatore pattern.

**La strada che funziona.** Un oggetto lineare nativo (il protocollo del bridge) → i suoi punti cuciti
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

**Come si applica.** Un ricamo calcolato fuori da Stilista entra come Manual e non va ricalcolato: chi lo
ricalcola a mano in Stilista lo perde. Il colore: il codice del bridge che assegna l'ago **scrive il colore
nella tavolozza del documento** (`TrySetNativeThreadColor`), quindi al ritorno si passa il colore che
quell'ago ha già, mai uno nuovo — altrimenti si ricolora tutto l'ago. Vedi anche
[`stilista-un-processo-per-documento.md`](stilista-un-processo-per-documento.md).

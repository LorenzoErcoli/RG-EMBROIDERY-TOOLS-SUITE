---
titolo: Punto Pittorico — fermato l'8 settembre, da riprendere; dove e cosa ha insegnato
tipo: tool
tool: [pittorico]
data: 2026-09-08
---

Il **Punto Pittorico** (nono tool, `apps/pittorico`) è stato **fermato il 2026-09-08** da Lorenzo:
*«non ci siamo, lo lasciamo stare, per riprendere poi da un'altra parte una nuova cosa»*. Il tool
resta nella suite (pagina *In sviluppo*) e gira; il riempimento non è al livello del suo DST fatto a
mano in Stilista.

**Il 2026-09-10** Lorenzo ha detto che **ci vuole tornare**: *«pittorico è importante, vorrei tornarci
a lavorare»* (N1 in `STATO.md`).

**Dove si riprende:** `BRIEFING-RASO-OMOGENEO/00-LEGGIMI.md` (nota in testa) e la coda di
`08-LA-PISTA-INDICATA.md`, poi [`AVVIO-PUNTO-PITTORICO.md`](../../AVVIO-PUNTO-PITTORICO.md). Ultimo
commit di quel lavoro: `a66c4c5`. Il riferimento a mano è
`BRIEFING-RASO-OMOGENEO/riferimento-a-mano.dst` (42 blocchi, rapporto di densità p95/p5 2,1×).

## Cosa ha insegnato, e vale per tutta la suite

- I numeri di densità del ricamo a mano (2,1×, 6% delle celle oltre il 150%) erano **già** raggiunti
  dai motori (1,8×, 3%): l'obiettivo 1,5× che era stato scritto era più severo del riferimento.
  **Chiedere il riferimento vero prima di fissare un numero.**
- Quello che mancava era la **struttura** (pochi blocchi grandi, raso da parete a parete), che nessuna
  misura di densità vede. `scripts/vedi.ts` (PNG senza librerie) ha guidato ogni scelta utile:
  **guardare prima di misurare**, e guardare il *disegno intero*, non solo il ritaglio — il ritaglio
  da 90 mm era un caso patologico e ci si è perso un giorno.
- Tre motori misurati e tenuti spenti/selezionabili: `iso-fill` (curve di livello: impossibilità
  geometrica, buchi), `band-fill` (fronti: numeri buoni, «macchie interne» dal setaccio), `colonne`
  (struttura giusta, giunzioni sporche). Default `fasce` perché non lascia buchi.

**Perché si è fermato:** Lorenzo ha visto il risultato in app tre volte e non era accettabile; ha
preferito fermarsi che continuare a rincorrere.

**Come si applica:** non riaprire il pittorico senza rileggere il dossier; se si riparte, partire da
`colonne.ts` (oggi in `@rg/core`) e dalle giunzioni, non da un motore nuovo. Vedi
[la resa prima delle misure](../metodo/resa-prima-delle-misure.md) e
[immagini, non vettori](../metodo/immagini-non-vettori.md).

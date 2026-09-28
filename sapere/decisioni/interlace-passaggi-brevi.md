---
titolo: Intreccio a nuvola — passaggi brevi che sembrano casuali, mai linee lunghe, e non "pettinare"
tipo: decisione
tool: [interlace]
data: 2026-07-27
---

Per l'effetto "intreccio a nuvola" il riempimento deve essere fatto di **tanti passaggi BREVI che si
muovono in modo che sembri casuale**, come nell'SVG di riferimento di Lorenzo — **mai linee lunghe e
dritte** che attraversano il pannello. La texture nasce dall'accumulo, non dalle lunghe corse. Punti
medi ~6–15 mm. "Movimenti circolari" = **vortici organici** dal campo di flusso, non cerchi disegnati.

**Perché:** alla prima prova c'erano camminate con linee lunghe e dritte (campo di flusso a passi
lunghi) e Lorenzo le ha bocciate subito. È una preferenza estetica precisa, non un dettaglio.

## Non "pettinare" il riempimento (luglio 2026, pagata con tanti giri a vuoto)

Lorenzo vuole che resti **molto disomogeneo** — è l'effetto. Ha bocciato tutto ciò che regolarizza:

- il riempimento che **segue il canale** (serpentina/tatami): *«crea linee troppo uguali»*;
- il **dither per cella**: *«mille cambi di colore»*;
- la rotazione dei colori lungo la sequenza: *«macchie»*.

**La misura utile:** il coefficiente di variazione (dev. std / media) della densità su celle di ~3 mm
del suo SVG di riferimento è **~0,52**: quello è il "buono" (casuale naturale). Puntare lì, **non a 0**.

- **Il modello colore giusto:** ogni colore = **un filo continuo su TUTTA la superficie**, passate
  sovrapposte (non frammentare, non localizzare). Vedi
  [densità per colore](interlace-densita-per-colore.md).
- **L'unica correzione ammessa sui grumi:** un **tetto ai picchi** (`CLUMP_CAP` in `engine.ts`, ~3× il
  bersaglio): il filo non passa più di N volte nella stessa cella → taglia solo gli "agglomerati
  insensati" **senza imporre una direzione**. Ha portato il coefficiente del labirinto FF da ~0,96 a
  ~0,49. Abbassare troppo il tetto frammenta in tanti stacchi (male per la macchina).
- **Il caso reale di Lorenzo sono cartamodelli a canali STRETTI** (es. le lettere FF): il caso peggiore
  del riempimento casuale.

**Come si applica:** la resa si valuta **guardandola** (render senza interfaccia, o Lorenzo con
`avvia.bat`). La copertura deve arrivare **ovunque**, anche a densità bassa e punto corto.

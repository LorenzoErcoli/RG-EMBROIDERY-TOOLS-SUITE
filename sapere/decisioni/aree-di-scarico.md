---
titolo: Aree di scarico — meno passate, netto sul contorno, una percentuale, in due tool
tipo: decisione
tool: [pattern-grammar, zone-pattern, cannage-rafia]
data: 2026-09-14
---

Dal 2026-09-14 il motore `@rg/pattern-grammar` ha le **aree di scarico** (`reliefAreas` +
`reliefPercent` in `PatternConfig`). La richiesta di Lorenzo: *«mi chiedono sempre più spesso di
scaricare i punti in determinate aree»*, di solito **per il montaggio**, dentro un pattern ma solo in
certi punti. Nel suo file (davanti-v2, ora `test/fixtures/scarico-davanti.svg`) le aree sono
rettangoli di SOLO TRATTO sopra le zone piene (lui le chiamava "verde", il file dice `#f3e600` giallo:
**fidarsi del file, non del nome**).

## Le 4 risposte di Lorenzo (2026-09-14)

1. Scaricare = **meno passate nei zig-zag** (verticali E orizzontali), stessa geometria e stesso
   reticolo. **Non** un reticolo più rado.
2. Passaggio **netto sul contorno**, non sfumato.
3. Quanto = **una percentuale** unica (50 = metà passate), non valori separati né per area.
4. In **entrambi** i tool: Generatore pattern (ruolo di tinta "Area di scarico") e Pattern a zone
   (ruolo `scarico` nella mappa colori, non è un ago). Poi anche nelle basi del cannage rafia.

## Com'è costruito (non ovvio dal solo codice)

- Quando lo scarico è attivo si genera **due volte**: la prima a piena densità solo per fissare
  l'ingombro e la traslazione, la seconda con lo scarico posata con quella traslazione → il reticolo
  non si sposta di un millesimo.
- Zig-zag orizzontale = fascio intero deciso dal centro; blocco verticale TAGLIATO dove la verticale
  incontra il contorno (altrimenti il confine slitta fino a mezzo modulo).
- In zone-pattern le aree sono escluse dal bordo esterno e dal grafo dei passaggi (stanno sopra le
  zone, non accanto).

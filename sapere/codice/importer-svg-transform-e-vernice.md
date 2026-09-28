---
titolo: Importer SVG — i transform e la vernice che identifica un elemento, due difetti silenziosi
tipo: codice
tool: [pattern-grammar, zone-pattern, cannage-rafia, pettine]
data: 2026-09-03
---

Nell'importer a stringhe di `@rg/pattern-grammar` (`importBoundary.ts`) c'erano due difetti che **non
davano errore**, corretti il 2026-09-03 lavorando sul cannage:

1. **I `transform` erano ignorati.** Illustrator scrive i rombi ruotati come
   `<rect … transform="translate(…) rotate(-45)">`: entravano come **quadrati dritti nel posto
   sbagliato**. 4 zone su 37 nel cannage. Ora c'è `parseSvgTransform` (translate/rotate/scale/skew/
   matrix) con una pila di matrici per i `<g>` annidati.
2. **La vernice che identifica un elemento era una fortuna, non una scelta.** Lo `stroke` vinceva sul
   `fill`, e il parser CSS non leggeva le regole a più selettori (`.cls-1, .cls-2 { stroke:#000 }`) —
   quindi il cannage funzionava per caso. Ora il parser legge i selettori multipli e **somma** le
   regole, e c'è l'opzione `paintPriority`: `stroke` per i contorni (default storico), `fill` per le
   zone piene.

**Perché conta:** un import sbagliato in silenzio è peggio di un errore — nessuno se ne accorge finché
il ricamo non esce storto.

**Come si applica:** un tool che legge un SVG *a zone piene* deve passare `paintPriority: 'fill'`,
altrimenti tutte le zone collassano nel nero del bordo. Nella suite gli importer SVG sono due (questo e
quello a DOM del core): è la voce P5 di `STATO.md`.

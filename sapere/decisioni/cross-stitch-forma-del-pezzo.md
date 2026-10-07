---
titolo: Cross-Stitch, la forma del pezzo (DXF o SVG) — una maschera di celle, il modulo tagliato alla forma
tipo: decisione
tool: [cross-stitch]
data: 2026-10-07
---

Il 2026-10-07 Lorenzo: «dovrei poter inserire un DXF o SVG per creare un riempimento dopo aver costruito
un modulo… sono tutti strumenti già esistenti».

**Riusato, non rifatto.** La lettura è quella della suite (`parseDxfToContours`, `parseSvgToContours`,
`applyRealWidth` di `@rg/core`: unità, Y del DXF, cerchi, archi, blocchi) e i ruoli sono quelli di
striatura e razza: il contorno chiuso più grande è il perimetro, i contorni chiusi di un altro colore
dentro di lui sono aree vuote, correggibili per colore. Il DXF ha le Y negative: i contorni si portano
con l'angolo in alto a sinistra in 0, 0 (`shape.ts`, `normalizeContours`).

**Una maschera, non celle tolte.** La forma diventa una maschera di celle (centro dentro un perimetro e
fuori dai buchi, come l'area di prova) che applica il motore (`RouteParams.mask`): la base solo dentro,
il disegno solo dentro. Le celle del disegno NON si tolgono: così il ricamo resta «il modulo ripetuto»
(designIsTiled) e vale il percorso del modulo a fasce, tagliato alla forma con la stessa regola delle
copie tagliate dal bordo (un tratto resta se la cella che attraversa, o una delle due che costeggia, è
dentro). Togliendo le celle il tool sarebbe tornato al copia per copia.

**Sposta e centra** (stesso giorno; Lorenzo: «spostare dx/sx alto/basso il pattern composto dei moduli per
fare i centraggi»). Lo spostamento è del modulo (offset {dr, dc} in V, sempre a V intere per restare sulla
griglia), non ruota il modulo come *Inizio*: tileModule ed editsOnAllCopies lo leggono dal modulo, la vista
modulo dell'editor lo ignora (il modulo sta al centro), il motore fa partire copie e strisce da lì con
copie e strisce tagliate anche a sinistra e in alto. Centra = centro del modulo sul centro delle celle
dentro la forma (o del ricamo).

**Come si applica:** un'altra «zona dove non si cuce» (per esempio un'area di prova a forma libera) va
fatta come maschera nel motore, non togliendo celle dal disegno. Vedi
[le copie tagliate dal bordo](cross-stitch-fair-isle-strisce.md).

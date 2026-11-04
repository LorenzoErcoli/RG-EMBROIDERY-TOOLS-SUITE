---
titolo: Interlace, il terzo tool — cos'è e com'è costruito
tipo: tool
tool: [interlace]
data: 2026-07-24
---

**interlace** (`apps/interlace`) è il terzo tool della suite, definito con Lorenzo in una chat
dedicata nel luglio 2026. Genera una **tessitura ricamata multicolore a più strati**: importa un
cartamodello DXF/SVG (colori → ruoli: `MASTER_OUTLINE` = area, `EXCLUSION` = area vuota) e la riempie
con un **filo continuo di passaggi brevi** che si intrecciano (vedi
[passaggi brevi](../decisioni/interlace-passaggi-brevi.md)), omogeneo, rispettando vuoti e bordo.

- **Multicolore**: un solo filo tagliato in cambi d'ago che **ruotano sulla palette** (N colori
  variabili + `paletteCycles`); ogni colore ricompare su più strati sovrapposti (l'ultimo non solo in
  cima). Un gruppo per colore nell'export SVG, come l'SVG di riferimento. Il DST è arrivato dopo, come
  per tutti i tool.
- **Il motore** sta in `apps/interlace/src/engine.ts`, **locale all'app** (regole di crescita 1–2),
  non nel core. Dal core riusa import e scala in mm, ruoli, geometria, export allineato (R27/R9); da
  `@rg/ui` il guscio, pan/zoom e il salvataggio.
- **La densità** è per colore: vedi [densità per colore](../decisioni/interlace-densita-per-colore.md).

## La sfumatura dai toni (2026-11-04)

Su un cuscino di prova, partendo da un'immagine a tinte chiare, Lorenzo ha detto: *«Devo costruire una
sfumatura a intreccio di questa immagine. Come vedi gli agglomerati non sono omogenei.»* Fra tre strade
(stesse macchie con la stessa fittezza, macchie regolari senza immagine, sfumatura dai toni) **ha scelto
la sfumatura dai toni** e dopo aver visto le prove ha detto: *«Va bene, densità 1,5»*.

**Com'è fatta** (`toneBlend` + `toneSoftnessMm`, solo con agglomerati e immagine; spenta di serie):

- Il tono si legge come **miscela dei due colori che lo rifanno meglio**, non come il colore più vicino.
  Con `1/d⁴` sul colore più vicino i passaggi restavano netti, perché il tono era quasi sempre "tutto di
  uno"; provata e scartata.
- Il **filo cucito dopo copre quello di prima**: a queste densità la proporzione del filo non è quella che
  si vede. Si parte dall'ultimo colore, gli si dà il filo che serve a coprire la sua quota, e il primo
  prende il resto: così il filo totale è pari. Il conto vale per un filo da 0,4 mm (`TONE_COVER`).
- **I divieti valgono ancora**, ma il filo vietato sfuma avvicinandosi alla zona vietata (`TONE_FADE` ×
  morbidezza). Provata senza divieti: il passaggio è più morbido, ma il filo scuro attraversa il chiaro
  in linee sciolte che si vedono sopra a tutto.
- **Dove un colore ha quota quasi nulla la cella è solo di passaggio**: non la deve coprire, ma non è un
  muro. Coprirle tutte a 1 gonfiava il filo totale dove passano più colori (8,1 contro 5,7 mm/mm²).
- **Una cella tagliata dal bordo chiede meno filo**, in proporzione alla sua parte ricamabile: senza, le
  strisce strette e le punte erano le zone più fitte.
- **Il filo non gira più a vuoto** (solo con la sfumatura): prima, davanti a celle che non raggiungeva,
  faceva 300 punti prima di staccare, e nelle rigenerazioni misurate erano fino al 41% del filo di un
  colore. Ora si arrende dopo 40, e una cella che ha già preso una passata la lascia lì senza staccare.

**Misurato sul suo DST** (32,4 m, densità 1,5) **contro la stessa prova con la sfumatura** (14,1 m), filo
per mm² su 3 mm dentro la sagoma:

| | Prima | Dopo |
|---|---|---|
| Più fitto / più rado (p95/p5) | 3,4 | 1,9 |
| Coefficiente di variazione del totale | 0,33 | 0,20 |
| Filo in zona chiara / media / scura | 10,7 / 13,7 / 15,6 | 5,3 / 6,1 / 6,0 |
| Stacchi | 15 | 6 |
| Filo su 5 varianti | 25,7–32,4 m (variante 3: 32,4 nel suo DST) | 13,9–14,3 m |

Il filo è calato perché non c'è più quello sprecato: per la fittezza media di prima serve densità 0,8
(35,0 m, 14,4 mm/mm²), ma lì i passaggi si leggono meno. **Lorenzo ha scelto 1,5.**

**Non verificato:** il risultato è stato giudicato su una simulazione col filo da 0,4 mm, non su una
prova cucita. Il coefficiente qui è misurato sfocando il filo di 3 mm, **non su celle da 3 mm** come
quello della nota sui [passaggi brevi](../decisioni/interlace-passaggi-brevi.md): i due numeri non si
confrontano.

**Il modo a zone non è cambiato:** a sfumatura spenta la cucitura è identica byte per byte su 6 casi, e
il difetto dei 300 punti resta lì, perché correggerlo cambierebbe i lavori già fatti.

**La voce C4 (densità per zona) resta aperta:** qui il filo totale è pari, mentre C4 chiede densità diverse
per regione.

Cosa resta da fare sta in `STATO.md` (C4 densità per zona, C5 vuoto dello stesso colore, C6 modello
densità unificato, A5 i nomi dei parametri "movimento").

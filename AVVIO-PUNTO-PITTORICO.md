# Avvio — "Punto Pittorico", il nono tool

> Briefing per la **chat operativa** di questo strumento. Nasce dalla progettazione fatta con Lorenzo
> nella chat globale il **2026-09-04**. Leggi prima `AVVIO-NUOVO-TOOL.md` (le regole che valgono per
> tutti i tool), poi questo.

---

## 1. Cosa deve fare

Da **un'immagine** si ricavano i blocchi di colore, e ogni blocco si riempie di ricamo **pieno** che
**segue le curve del disegno**. Sui confini fra due colori l'effetto cambia a seconda di com'è
l'immagine:

- dove il colore **sfuma**, i due riempimenti si compenetrano con i **bordi frastagliati** (punti più
  lunghi e più corti, densità un filo più aperta) e producono il **degradé**;
- dove il colore **stacca netto**, il riempimento si ferma **secco sul bordo**, senza frange.

I riferimenti visivi che Lorenzo ha portato: la grafica cianotipica con le fasce luminose e la sfera a
settori (sfumature morbide **e** tagli geometrici netti nella stessa immagine), e due fotografie di
ricamo pittorico dove i punti sono **perpendicolari al passaggio di colore**, a ventaglio lungo la
curva, coi capi sfrangiati.

**Nome proposto:** *Punto Pittorico*, id `pittorico`. Da confermare con Lorenzo.

---

## 2. Le decisioni già prese con Lorenzo

1. **Il degradé si fa col frastaglio del BORDO, non con una texture.** È stato l'errore della prima
   proposta (si era partiti dalle striature). La struttura giusta: un **riempimento pieno** i cui
   *bordi* hanno punti di lunghezza variabile, più la **sovrapposizione** fra blocchi adiacenti.
2. **Sovrapposizione: 5 mm, e il sotto più coperto del sopra.** In geometria: prima di riempire, ogni
   regione si **ingrandisce di 5 mm verso i vicini che verranno cuciti dopo**, e resta al proprio bordo
   verso quelli già cuciti. Chi sta sotto è abbondante, chi va sopra ci si appoggia: niente buchi alle
   giunte, e il degradé nasce dall'intreccio delle frange.
3. **Frastaglio: parametro di pannello** (lunghezza della frangia in mm), default da tarare sulla prima
   prova.
4. **Direzione del punto: automatica, con le linee guida come correzione.** Non un disegnatore da
   costruire: l'automatico prova a capire da solo, e dove non convince si interviene con le guide.
5. **Le forme che devono essere nette lo restano** (vedi §5): un cerchio dell'immagine deve tornare un
   cerchio, non un poligono a gradini.

---

## 3. Cosa esiste già — NON riscriverlo

| Dove | Cosa | A cosa serve qui |
|---|---|---|
| `packages/core/src/quantize.ts` | `medianCutPalette`, `nearestPaletteIndex`, `mapToPalette`, `rgbToHex`/`hexToRgb` | immagine → tinte |
| `apps/broccato/src/regions.ts` | **`traceRegions()`**: dalla maschera di un colore agli **anelli chiusi coi loro fori, in mm**, seguendo i lati dei pixel e semplificando | blocco colore → contorno vettoriale. **Da promuovere nel core**: il secondo cliente adesso c'è (regola di crescita 1) |
| `packages/core/src/fill.ts` | `buildParallelFill()`: righe parallele con angolo, passo, suddivisione R4, modalità `serpentine`/`comb`, e **fase fissa** (`gridOriginMm`, righe ancorate a una griglia assoluta perché due macchie dello stesso colore non mostrino la giunta) | è il raso "a fase fissa" già pronto: il punto di partenza da generalizzare |
| `apps/broccato/src/routing.ts` | `buildCoverGrid` e la classificazione delle celle (`CELL_COVERED`/`OWN`/`EDGE`/`BARE`): i passaggi si nascondono sotto i colori successivi (R16) | l'ordine dei colori e i passaggi nascosti |
| `apps/broccato/src/reduce.ts` | riduzione stabile a 4–8 tinte | palette di lavoro |
| `packages/core` | mm (R1/R2/R11), clip e vuoti (R5), min-stitch (R3) **dopo il routing**, `avoidVoids`, export SVG/DST riapribili (R9/R27/R31), chunk R6 | fondamenta |
| `apps/bitmap` | ingresso raster col canvas, contagocce, tolleranza per-colore | l'ingresso immagine, se serve pescarne pezzi |

---

## 4. Cosa è nuovo — sono tre cose

### 4.1 Il campo di direzione

Da dove il punto prende l'orientamento. Tre livelli, in quest'ordine:

1. **Automatico dalla forma**: **campo armonico** — si fissa la direzione **sul bordo** della regione
   (tangente al contorno) e si risolve per il campo *più liscio possibile* all'interno; l'**asse
   mediale** (scheletro) dà il verso. È l'approccio dei brevetti dei software di ricamo (spina
   dell'asse mediale + contorni concentrici) e lo standard in grafica per i campi di direzioni.
2. **Automatico dall'immagine**: direzione del gradiente di luminanza, per le zone grandi dove conta la
   sfumatura interna e non la forma.
3. **Linee guida disegnate**: sono le *linee blu* di Wilcom e le *guide line* di Ink/Stitch. Nella suite
   arrivano gratis: si importano da SVG, come già fa oblique col cartamodello a ruoli.

### 4.2 Il riempimento che segue il campo, a densità costante

**È il cuore del tool, ed è dove va speso il tempo.** Con l'angolo fisso il passo fra le righe è
costante per costruzione. Appena la direzione ruota quella garanzia salta: sul lato esterno della curva
le righe si allontanano e il filo apre, sul lato interno si stringono e il ricamo ingrossa.

La soluzione **non va inventata**: è il posizionamento di curve a distanza costante di
**Jobard & Lefer (1997)**, lo standard in visualizzazione di campi vettoriali (sta dentro VTK). Si
integra una fila lungo il campo e la si **ferma quando si avvicina a meno della distanza voluta** da una
fila esistente; poi si semina una fila nuova **esattamente a quella distanza**. Le file **nascono e
muoiono da sole** dove il ventaglio si apre e si chiude: la distanza fra vicine è costante per
costruzione, che è il "rinfittimento" chiesto da Lorenzo ottenuto senza calcolarlo a posteriori.

*Come lo fanno gli altri, per riferimento:* Ink/Stitch dichiara il compromesso senza risolverlo (`copy`
= copie della guida, copertura irregolare; `parallel offset` = distanza costante ma spigoli). Wilcom coi
*Curved Fills* (Florentine, Liquid, Contour) dichiara densità e penetrazioni uniformi ma non dice come.

### 4.3 I bordi: frastaglio e sovrapposizione

Per ogni tratto di confine si misura **quanto è larga la sfumatura nell'immagine**: larga → i due
riempimenti si compenetrano con le frange; stretta → taglio netto. Automatico con soglia in mm,
correggibile a mano per coppia di colori. Più la crescita di 5 mm della regione verso i vicini
successivi (decisione 2).

---

## 5. Le forme nette

Nell'immagine di riferimento la sfera **è un cerchio** e i tagli interni sono archi esatti: un contorno
tracciato sui pixel darebbe un poligono a gradini, e il ricamo si vedrebbe.

Tre livelli, dal più automatico:

1. **Riconoscimento delle primitive** sul contorno tracciato: si prova a interpolare **cerchi, archi e
   segmenti** entro una tolleranza in mm; se il residuo è sotto la tolleranza, la primitiva sostituisce
   la spezzata. È la "regolarizzazione delle forme" dei vettorizzatori. Non serve solo all'estetica del
   bordo: se il bordo è un cerchio vero, **anche il campo di direzione diventa esatto** (concentrico o
   radiale) invece che ballerino.
2. **SVG accanto all'immagine.** La grafica di Lorenzo nasce vettoriale: il modo più solido di avere il
   cerchio perfetto è **importarlo**, non indovinarlo. Raster per i colori e le sfumature, vettore per
   le geometrie esatte — è esattamente il modello di oblique (moduli + cartamodello con ruoli), e la
   suite lo sa già fare.
3. **Un disegnatore: no.** Non serve costruirlo. Le linee guida e le forme esatte arrivano da Illustrator
   come SVG; il pannello serve a **assegnare i ruoli** a quei contorni, non a ridisegnarli.

---

## 6. Il piano in cinque punti

1. **Prototipo headless del riempimento curvo** su UNA regione di prova, prima di qualsiasi pannello:
   campo di direzione + file a distanza costante + **misura della copertura in curva contro il
   rettilineo**. Se quella misura non regge, il tool non sta in piedi e va saputo subito.
2. **Promozione di `traceRegions` nel core** (comportamento invariato, test a lucchetto) e
   **riconoscimento delle primitive** (cerchio/arco/segmento) sul contorno.
3. **Il campo di direzione**: armonico dalla forma, con anteprima delle linee di flusso — si guarda
   *prima* di cucire — e le guide importate da SVG come correzione.
4. **I bordi**: misura secco/sfumato dall'immagine, frange, crescita di 5 mm verso i colori successivi.
5. **Pipeline, ordine dei colori, export SVG/DST, pannello** (Testa A, dal subagent `design-system`),
   **invarianti nello smoke**, `STATO.md`.

---

## 7. Le invarianti da bloccare in `test/smoke.mjs`

- **copertura uniforme**: filo per cella su una griglia; in curva non si scosta di più di una soglia
  dichiarata rispetto al rettilineo (è *la* misura che decide se il tool funziona);
- **distanza fra file vicine** sempre entro [min, max] dichiarati, anche nei ventagli;
- niente fuori dalla regione, niente dentro i vuoti (R5);
- punto entro `[minStitchMm, maxStitchMm]` (R3/R4), col minimo imposto **dopo** il routing;
- **sovrapposizione**: la regione di sotto entra davvero di 5 mm in quella di sopra, e non viceversa;
- **forme nette**: un cerchio riconosciuto resta un cerchio entro la tolleranza (niente gradini);
- determinismo: stessi parametri → stesso ricamo.

---

## 8. Fonti

- Ink/Stitch — [Guided Fill](https://inkstitch.org/docs/stitches/guided-fill/), [Contour Fill](https://inkstitch.org/docs/stitches/contour-fill/)
- Wilcom — [Curved Fills](https://wilcom.com/embroiderystudio/elements/curved-fills/), [Adjusting stitch angles](https://docs.wilcom.com/embroiderystudio/26/en/OnlineHelp/Quality/quality/Adjusting_stitch_angles.htm)
- Jobard & Lefer, *Creating Evenly-Spaced Streamlines of Arbitrary Density* (1997) — [Springer](https://link.springer.com/chapter/10.1007/978-3-7091-6876-9_5), [implementazione VTK](https://vtk.org/doc/nightly/html/classvtkEvenlySpacedStreamlines2D.html)
- USPTO 5541847 — [riempimento generato dall'asse mediale](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5541847)

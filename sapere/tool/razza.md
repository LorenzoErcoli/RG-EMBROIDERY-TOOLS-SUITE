---
titolo: Pelle di razza — tondini di cordoncino piccoli e grandi sfumati, passaggi corti e coperti
tipo: tool
tool: [razza]
data: 2026-10-06
---

**Stato: tool vero, in «In sviluppo» (2026-10-06).** `apps/razza/` (motore in `src/`, interfaccia in `src/tool.ts`, calcolo
in un Web Worker). Le simulazioni che l'hanno preceduto sono sotto, con le strade scartate. `scripts/sim.ts` resta come
prova da riga di comando sulla sagoma vera: numeri, un PNG e un DST in `scripts/out/` (non tracciato).

## Da dove nasce
Dior FALL 27, calzature, effetto *galuchat*. Riferimenti: la fotografia della pelle (tondini chiari su fondo scuro,
piccoli e grandi sfumati, una «perla» più grande), `BASE RICAMO VENERE 85 SC.dxf` (la sagoma, 326,3 × 214,1 mm,
a U) e `GALOUCHAT EFFECT.dst` (un primo ricamo a cordoncini, da **aggiustare e parametrizzare**).

## Il DST di riferimento, misurato
Swatch 101 × 41 mm, 33.028 punti, 3 aghi: l'ago 1 e 2 fanno un contorno e una griglia leggera (~580 punti), l'ago 3 fa la
pelle (32.472 punti in 25 blocchi). Ogni tondino è un **fascio di punti paralleli** (rettangolo, non tondo) ad angolo
casuale, ~1,8 × 1 mm ai lati e ~6 × 3–4 mm al centro. Difetti: passaggi diagonali fino a 11–12 mm **in vista**, 27 salti
(il più lungo 58 mm), accumulo di filo al centro, dimensione a fasce di ~10 mm invece che sfumata, forma rettangolare,
niente parametri. Il disegno è speculare: i blocchi grandi di sinistra e destra hanno gli stessi punti.

## Le decisioni di Lorenzo (2026-10-06)
1. **Il tondino è un cordoncino che parte piccolo, cresce al centro e torna piccolo** (profilo a lente/ellisse).
2. **Nessun punto sotto 0,8 mm — ma come parametro** (`minStitchMm`, R3).
3. **Il fondo non si tocca: è una base piena.** Il tool ricama solo i tondini.
4. **Tutto lo stesso ago, per ora.**
5. **Né rasafilo né passaggi lunghi: i passaggi sono piccoli e coperti il più possibile.** L'ordine di cucitura è libero
   («serpentina o in qualunque modo sia meglio»).
6. **Prima le simulazioni, poi il tool.**
7. **Parametri** (risposta del 2026-10-06, seconda tornata): la **distanza fra i pallini**, il **pallino minimo** e il
   **pallino massimo**, la densità e «tutto il resto» sono campi del tool. **Se il pallino piccolo diventa uno zig-zag va
   bene**: ricamato sembra un pallino. Il riferimento della resa è **la fotografia**.
8. **Il cordoncino in tinta base lungo l'apertura è uno stop a parte** (un secondo passaggio, non dentro i tondini).
9. **Obiettivo sui passaggi: togliere almeno quelli in vista sopra 5 mm.**
10. **La disposizione è piccoli ESTERNI, grandi verso il CENTRO** (correzione, quando ha visto la prima versione: l'ordine
    delle misure seguiva solo la x dello swatch). «Centro» = quanto sei **lontano dal bordo** (anche da quello
    dell'apertura), non il centro del rettangolo che contiene il pezzo.
11. **Si possono inserire pallini FISSI, di dimensioni sue, in alcuni punti, e da quelli nasce il ricamo del resto.**
12. **Una linea di sfumatura come il gradiente di Illustrator**: una o due linee che indicano piccoli e grandi **e il
    verso**. Strumenti sull'anteprima: Pallino fisso, Sfumatura, Seleziona.
13. **Lo costruiamo davvero** (dopo le simulazioni), con la possibilità di parametrizzare tutto.

## Cosa hanno detto le simulazioni (swatch 101 × 41,5 mm, DXF vero)
- **La posa casuale si ferma al ~50% di copertura** (limite delle posa sequenziale a caso). Facendo **crescere i tondini
  fino a toccarsi** e riempiendo i buchi con tondini più piccoli si arriva a 61–70%, come la foto.
- **Il vuoto fra tondini (`gapMm`) decide quasi tutto il passaggio in vista**: a 0,4 mm la mediana in vista per giuntura è
  0,90 mm; a 0,2 → 0,65; a 0 → ~0,2–0,4; a −0,1 (sfiorano) → ~0,05. Il vuoto è anche l'aspetto a squame (il canale
  scuro): è una scelta di **resa**, da vedere in macchina.
- **Il passaggio è nascosto solo se il tondino dopo è a contatto.** Un ordine «vicino più vicino» lascia il 20–25% di
  salti non a contatto. L'ordine **ad archi** (si legano per primi i due più vicini, a catene; le catene si uniscono dal
  capo più vicino, **mai attraverso l'esterno della sagoma**) dà **0 passaggi fuori sagoma** sul DXF.
- **Passare dentro il tondino appena cucito** (stessa tinta) e **sotto il successivo** lascia in vista solo il vuoto; il
  prezzo è filo sopra il cucito (`pesoSopra`, 3 per default).
- **Provato e scartato:** posa a file serpentina («scaffale»: ogni tondino appoggiato al precedente e alla fila sotto) —
  le file salgono in diagonale, si fermano in modo irregolare, i ritorni fra una passata e l'altra sono lunghi. Posa
  casuale + ordine ad archi è meglio. Ordini a fasce (serpentina) e a curva di Hilbert: più passaggi in vista del vicino.
- **Il DST arrotonda a 0,1 mm**: un punto da 0,80 può diventare 0,72. Il minimo si progetta con un margine di 0,15 mm e
  si tiene sulla griglia (anche il centraggio del file va sulla griglia, o ri-arrotonda). Verificato rileggendo i DST:
  min 0,80, zero sotto, un blocco, un solo salto iniziale.
- Risultati sulla sagoma vera (`gap 0`, campo misto): 1.901 tondini, 70,3% di copertura, 24.640 punti, 91,8 m di filo; per
  giuntura in vista mediana 0,20 mm, il 69% sotto 0,6 mm; **82 giunture sopra 2 mm e 15 sopra 5 mm** (le unioni fra
  catene): è la coda ancora da accorciare.

## Seconda tornata: i passaggi sopra 5 mm (2026-10-06)
Sulla sagoma vera, ordine ad archi, le giunture in vista sopra 5 mm erano **15** (le unioni fra le 204 catene, fino a 144 mm
fra i capi). **Risolte** con un miglioramento locale dell'intero percorso — 2-opt nei due versi + Or-opt di segmenti da 1 a 3
tondini, solo fra vicini **validi** (il segmento fra i centri sta dentro il pezzo) e con costo = vuoto al quadrato: giuntura
più in vista **4,6 mm**, **0 sopra 5 mm**, 0 fuori sagoma, mediana 0,40 mm, 32 sopra 2 mm.
**Provato e scartato — il ponte sopra il cucito:** per unire una catena a una già cucita, far camminare il filo sopra i
tondini già cuciti (Dijkstra sul grafo dei contatti). Peggio: i cammini diventano lunghi (fino a 266 mm), e ogni passo fra
due tondini attraversa un vuoto — i vuoti si sommano e il cammino finisce in vista (fino a 96 mm in vista, 3 passaggi
fuori sagoma). La lezione è la stessa dell'ordine: **un passaggio lungo non si nasconde camminando, si evita con un
percorso migliore**; il peso del vuoto nel cammino non basta a salvarlo.
Con pallino da 1,8 a 8 mm, campo a chiazze e vuoto 0: 3.243 tondini, 72% di copertura, 29.800 punti, 93,9 m; stitch minimo
0,80 mm riletto dal DST. Restano 1–4 «isole» di tondini senza contatto con gli altri, che portano al massimo una giuntura
fuori sagoma o sopra 5 mm: da guardare caso per caso sulla sagoma vera.

## Il tool (terza tornata, 2026-10-06)
- **Il campo dal bordo** (`campo.ts`): il diametro cresce con la distanza dal bordo (liscia, `curvaBordo`), le chiazze lo
  scalano — non lo sommano — così sul bordo i pallini restano piccoli comunque. Misurato sul pezzo vero: 2,7 → 2,9 → 3,6 →
  4,8 → 5,9 mm a 0–4 / 4–10 / 10–20 / 20–40 / oltre 40 mm dal bordo. Il test ha il **controllo negativo** (a campo uniforme la
  differenza sparisce).
- **I fissi** sono posati per primi, non crescono, e la loro misura tira quella dei vicini fino a `influenzaFissiMm`. Un fisso
  fuori dal pezzo, o troppo piccolo per avere un corpo sopra il punto minimo, dà un avviso e non viene posato.
- **Le sfumature**: valore lineare lungo la linea (tenuto fra A e B), con più linee pesate dalla distanza (comanda la più
  vicina); `pesoSfumature` le dosa contro il bordo. Misurato: da 3 mm a sinistra a 10 mm a destra, il diametro medio sale
  3,7 → 4,7 → 5,2 → 5,9 per fasce — meno di 3 → 10 perché i buchi vengono riempiti con pallini più piccoli (come nella foto).
- **I pallini larghi oltre 8 mm** (R23, `satinMaxWidthMm`): il cordoncino si allenta; il tool lo dice.
- **Dal browser** (server di sviluppo, DXF vero): 326 × 214 mm, 1 linea aperta riconosciuta, 2.803 pallini, 68%, 28.352 punti,
  88,3 m, calcolati in 8,3 s dal worker; DST da 93,8 KB e SVG da 329 KB; riaperti, tornano il progetto e la sagoma.

## Aperto
- Il vuoto fra tondini (resa), la dimensione minima e massima, il campo: **da decidere guardando il ricamo in macchina**.
- Il cordoncino «in tinta base» lungo l'apertura (scritto a mano sulla foto): **stop a parte** (decisione 8), non ancora fatto.
- Le «isole» di pallini senza contatto (1–4 sul pezzo vero) e la coda delle giunture sopra 2 mm (82 prima dell'ottimizzazione,
  32 dopo); con i fissi può uscire una giuntura sopra 5 mm.
- L'anteprima SVG con ~30.000 segmenti: non è stato possibile misurarne la fluidità (il pannello del browser era nascosto e
  rallentava le animazioni). Se pan e zoom risultano lenti sul pezzo intero, il filo passa su canvas.

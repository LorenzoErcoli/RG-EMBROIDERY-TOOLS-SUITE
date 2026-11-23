---
titolo: Il punto minimo si impone per ultimo su tutti i punti, e si misura sulla griglia del DST
tipo: decisione
tool: [pattern-grammar, pattern-macchie]
data: 2026-11-23
---

Nel motore del Generatore pattern (`@rg/pattern-grammar`, `generateFinalPatternPoints`) il punto minimo
è **l'ultimo passo**, sul filo già tagliato, connesso e suddiviso (R3), e vale **per tutti i punti**:
vertici del modulo, angoli, capi dei pezzi tagliati, raccordi sul bordo. Un tratto deve essere lungo
almeno `minStitchMm` **com'è e anche sui nodi da 0,1 mm del DST**. Il codice è
`packages/pattern-grammar/src/generator/puntoMinimo.ts`.

## Perché

Lorenzo (2026-11-23), su un DST di un pannello con buchi: *«un sacco di punti sotto il millimetro»*,
con «Elimina» acceso. Misurato dalla chat madre: 111 punti su 1.208 sotto 1 mm, con minimo 0,97. Tre
cause, tutte vere:

1. **Le pulizie di prima toglievano solo certi tipi di punto.** `cleanupPolyline` tiene sempre i
   punti del modulo; `cleanupBoundaryConnectedPath` toglie un punto troppo vicino solo se è intermedio,
   una suddivisione o un punto di bordo «togliibile». Un taglio che cade a 0,1 mm da un vertice del
   modulo lasciava un punto da 0,1 mm (i 66 da circa 0,1 mm sul bordo alto e basso). Era un
   compromesso **dichiarato** del motore migrato, rimasto aperto come decisione A6(a) di `STATO.md`
   (*«vince la macchina o vince il disegno?»*). Per il Generatore l'ha chiusa la lamentela di Lorenzo:
   vince la macchina.
2. **Il DST arrotonda ogni punto ai decimi di millimetro** (`decimiDst` nel core): un tratto da 0,97
   può uscire a 0,9 (i 25 fra 0,85 e 0,99). Pelle di razza l'aveva già trovato
   ([razza](../tool/razza.md)) e si teneva un margine; qui il margine non va bene, perché
   alcuni preset hanno punti da 1,0–1,1 mm voluti (punto nastro: 1,1) e con 0,15 mm di margine
   sparirebbero. Si misura invece **sui nodi**: il motore sa dove il DST metterà ogni punto, se
   l'export centra il disegno su un nodo (`stratiSullaGrigliaDst` nel core, poi `center: false`).
   Un tratto corto solo sui nodi non si fonde: il punto si sposta sul nodo vicino (al massimo
   0,15 mm) che tiene il minimo e sta nella sagoma.
3. **Il DST spezza un punto oltre 12,1 mm** in 12,1 più il resto, e il resto può venire 0,2–0,7 mm
   (misurato sui raccordi dritti lungo il bordo, col punto massimo spento). Ora il motore divide da
   solo in parti uguali ogni tratto oltre 12,0 mm (`PUNTO_MAX_DST_MM` meno un passo di griglia).

Trovato strada facendo: la deduplica dei punti di bordo (`removeNearDuplicateBoundaryPoints`)
toglieva un punto di bordo vicino al precedente **senza guardare la sagoma**: l'angolo di un buco a
0,9 mm dal capo del pezzo spariva e il filo tagliava dentro il vuoto (misurato 0,79 mm su un
contorno inventato). Ora lo toglie solo se il tratto che resta sta nella sagoma.

## Come si fonde

Due punti davvero troppo vicini diventano uno, **anche quando uno dei due è un angolo**. Resta il più
importante: il punto sul bordo (taglio, raccordo), poi il vertice del modulo, poi i punti messi solo
per dividere una linea; a pari importanza il primo. Solo se il tratto che ne esce sta nella sagoma;
altrimenti si prova a togliere l'altro. Il primo e l'ultimo punto del filo restano.

Misurato su un contorno inventato con due buchi (minimo 0,97, «Elimina», spostamento 0), su master →
ora: punto canvas 129 → 0 punti sotto il minimo (159 → 0 nel DST), nastro a squame 131 → 0, cannage
piena 473 → 0; il filo che esce dalla sagoma da 0,72–0,79 mm a 0 (un tratto da 0,13 mm resta col
nastro classico, ma c'era già: è il ritaglio del modulo sull'angolo del buco, non la fusione).

## Cosa cambia da vedere

- **Cannage base — leggero** ha uno zig-zag verticale stretto (largo 0,5, interlinea 0,4: punti da
  circa 0,64 mm). Col minimo 1 dei preset quei punti ora si fondono: su un pannello 120 × 160, 2.162
  punti sotto il minimo diventano 0. A occhio la trama resta quella; se a Lorenzo servisse lo zig-zag
  fitto, il punto minimo di quel pattern va abbassato.
- Vale nel **Generatore pattern** e in **Pattern a macchie** (la sua base è la base del Generatore,
  punto per punto, e il punto sopra la riprende). **Non** vale nel motore delle zone (Pattern a zone,
  basi di Cannage rafia): lì `fillZone` chiama il motore con `{ puntoMinimoFinale: false }`, perché i
  punti vengono ruotati indietro dopo (la griglia non vale più) e perché per quei tool Lorenzo ha già
  scelto: la «pulizia punti» finale, a 0 vince il disegno (decisione A6a di `STATO.md`). Estenderlo lì è
  una scelta sua.
- **Solo il DST del Generatore** è scritto sulla griglia. Pattern a macchie tiene il minimo nel
  tracciato della base, ma il suo export DST centra ancora a metà nodo e può ri-arrotondare di un decimo.

## Come si applica

- Un controllo sul punto minimo si fa sul DST riletto (`readDst`), non sul tracciato: il tracciato
  può essere giusto e il file no.
- Un tool che vuole il minimo anche nel file: punti misurati con `decimiDst`, export con
  `stratiSullaGrigliaDst` e `center: false`, `refertoDaStrati(…, { centra: false })`.
- Fra punto minimo e punto massimo, se litigano (massimo sotto il doppio del minimo), vince il minimo:
  viene per ultimo.

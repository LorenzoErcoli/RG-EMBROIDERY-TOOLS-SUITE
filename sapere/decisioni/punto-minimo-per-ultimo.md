---
titolo: Il punto minimo si impone per ultimo, con due misure (contorni e pattern), sulla griglia del DST e senza sbavature
tipo: decisione
tool: [pattern-grammar, pattern-macchie]
data: 2026-11-23
---

Nel motore del Generatore pattern (`@rg/pattern-grammar`, `generateFinalPatternPoints`) il punto minimo
è **l'ultimo passo**, sul filo già tagliato, connesso e suddiviso (R3). Ha **due misure** (Lorenzo,
2026-11-23: *«un conto è il pattern un conto è nei contorni. io devo evitare sbavature e punti troppo
corti nei contorni, in tutti, che siano aree vuote o contorni»*):

- **«Punto minimo»** (`minStitchMm`, il campo di sempre) vale **sui contorni**: ogni tratto che tocca
  il perimetro o un'area vuota (il taglio sul bordo, il raccordo che ci cammina sopra, il vertice del
  modulo accanto al taglio);
- **«Punto minimo del pattern»** (`patternMinStitchMm`, nuovo) vale **dentro**, fra due punti del
  modulo. Di serie **0: il disegno resta com'è**; i preset e i DST di prima lo riaprono a 0.

Un tratto deve essere lungo almeno il suo minimo **com'è e anche sui nodi da 0,1 mm del DST**. E sui
contorni **il filo non esce dalla sagoma**. Il codice è `packages/pattern-grammar/src/generator/puntoMinimo.ts`.

## Perché

Lorenzo (2026-11-23), su un DST di un pannello con buchi: *«un sacco di punti sotto il millimetro»*,
con «Elimina» acceso. Misurato dalla chat madre: 111 punti su 1.208 sotto 1 mm, con minimo 0,97. Tre
cause, tutte vere:

1. **Le pulizie di prima toglievano solo certi tipi di punto.** `cleanupPolyline` tiene sempre i
   punti del modulo; `cleanupBoundaryConnectedPath` toglie un punto troppo vicino solo se è intermedio,
   una suddivisione o un punto di bordo «togliibile». Un taglio che cade a 0,1 mm da un vertice del
   modulo lasciava un punto da 0,1 mm (i 66 da circa 0,1 mm sul bordo alto e basso). Era un
   compromesso **dichiarato** del motore migrato, rimasto aperto come decisione A6(a) di `STATO.md`
   (*«vince la macchina o vince il disegno?»*). Lorenzo l'ha chiusa per il Generatore dividendo: sui
   contorni vince la macchina, nel pattern decide lui col suo campo.
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

## Niente sbavature sui contorni

Tre difetti che portavano il filo fuori dalla sagoma, tutti già su master:

- **La deduplica dei punti di bordo** (`removeNearDuplicateBoundaryPoints`) toglieva un punto di bordo
  vicino al precedente senza guardare la sagoma: l'angolo di un buco spariva e il filo tagliava dentro
  il vuoto (0,79 mm). Ora lo toglie solo se il tratto che resta sta nella sagoma.
- **Il ritaglio** (`polygonSegmentInterval`) teneva il tratto intero quando un suo capo cadeva proprio
  sul bordo: misurato 3,8 mm fuori dalla punta di una sagoma a stella. Era il «difetto nel clipper
  condiviso» annotato in `STATO.md`. Ora conta solo il pezzo col punto di mezzo dentro.
- **I raccordi** tagliavano la punta stretta di un vuoto (0,55 mm). Ora un tratto di contorno che esce
  si rifà camminando sul bordo del suo anello, coi vertici (`senzaSbavature` e `stradaSulBordo`).

Fondere due punti, poi, non porta mai fuori: il controllo guarda il tratto ogni 0,1 mm, e se nessuna
fusione semplice sta dentro si tolgono anche i punti prima (fino a 5). Se nemmeno così (una punta più
stretta del punto minimo) **il punto corto resta**: meglio un punto corto che il filo sul vuoto.

## Come si fonde

Due punti davvero troppo vicini diventano uno, **anche quando uno dei due è un angolo**. Resta il più
importante: il punto sul bordo (taglio, raccordo), poi il vertice del modulo, poi i punti messi solo
per dividere una linea; a pari importanza il primo. Il primo e l'ultimo punto del filo restano.

## Misure (contorni inventati, minimo 0,97 o 1, «Elimina», spostamento 0)

- Due buchi (uno quadrato, uno storto): su master punto canvas 129 punti sotto il minimo (159 nel
  DST), nastro a squame 131, cannage piena 473. Ora 0 sui contorni; coi due minimi a 0,97, 0 anche nel
  DST. Filo fuori dalla sagoma: da 0,72–0,79 mm a 0.
- Stella con un buco tondo, tutti i preset: su master 24–121 punti corti sui contorni e il filo fuori
  fino a 3,8 mm; ora 0 punti corti sui contorni e al più 0,01 mm fuori.
- Un vuoto a punta strettissima (circa 11°) resta il caso limite: al più 0,07 mm fuori e un punto
  corto (0,29 mm) tenuto per non uscire.

## Cosa cambia da vedere

- Col «Punto minimo del pattern» a 0 il pattern è quello di prima: il *Cannage base — leggero* tiene
  il suo zig-zag verticale da circa 0,64 mm. Alzandolo, quei punti si fondono e le linee verticali si
  inclinano di circa mezzo millimetro (figura nelle note della chat madre, 2026-11-23).
- Vale nel **Generatore pattern** e in **Pattern a macchie** (la sua base è la base del Generatore,
  punto per punto, e il punto sopra la riprende). **Non** vale nel motore delle zone (Pattern a zone,
  basi di Cannage rafia): lì `fillZone` chiama il motore con `{ puntoMinimoFinale: false }`, perché i
  punti vengono ruotati indietro dopo (la griglia non vale più) e perché per quei tool Lorenzo ha già
  scelto la «pulizia punti» finale (decisione A6a di `STATO.md`). Estenderlo lì è una scelta sua. La
  correzione del ritaglio e della deduplica invece vale anche lì: è lo stesso motore.
- ~~**Solo il DST del Generatore** è scritto sulla griglia. Pattern a macchie tiene il minimo nel
  tracciato della base, ma il suo export DST centra ancora a metà nodo e può ri-arrotondare di un decimo.~~
  Dal 2026-11-23 (sera, Lorenzo: *«sistema anche il DST di pattern a macchie»*) anche il DST di Pattern a
  macchie è sulla griglia. Lì il motore non misura sui nodi, quindi lo fa l'export: `stratiSullaGrigliaDst`
  con `minimoDi` (il minimo di ogni stop, `minimoDelloStop`: base col «Punto minimo» del pattern, raso 0,3,
  punto sopra `sopraPuntoMin`) mette un punto che nel tracciato tiene il minimo sul nodo vicino che lo tiene
  ancora (entro 0,15 mm), e con `dividiPuntiLunghi` divide i punti oltre 12 mm. Misurato sul pannello di
  prova delle macchie: punti accorciati sotto il minimo dall'arrotondamento, col punto canvas 44 nel punto
  sopra e 1 nel raso, ora 0; col nastro a squame 5 e 1, ora 0.

- **Sul bordo delle macchie** (Pattern a macchie, 2026-11-23, Lorenzo: *«sì, togli i punti corti sul bordo
  delle macchie»*): il punto sopra usa la stessa funzione (`imponiPuntoMinimo`) col bordo della macchia come
  contorno, ma con `tieni: 'dentro'`: fra il taglio e l'ago prima resta l'ago prima, perché il punto sopra sul
  bordo non cammina e la colonna deve restare dritta. Vedi [pattern-macchie](../tool/pattern-macchie.md).

## Come si applica

- Un controllo sul punto minimo si fa sul DST riletto (`readDst`), non sul tracciato: il tracciato
  può essere giusto e il file no.
- Un tool che vuole il minimo anche nel file: punti misurati con `decimiDst`, export con
  `stratiSullaGrigliaDst` e `center: false`, `refertoDaStrati(…, { centra: false })`.
- Fra punto minimo e punto massimo, se litigano (massimo sotto il doppio del minimo), vince il minimo:
  viene per ultimo.

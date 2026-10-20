---
titolo: Pattern a macchie — base a pattern, raso nelle macchie, sopra lo stesso punto a registro
tipo: tool
tool: [pattern-macchie]
data: 2026-10-08
---

**Stato: tool vero, in «In sviluppo» (2026-10-08).** `apps/pattern-macchie/` (motore in `src/motore.ts`, interfaccia
in `src/tool.ts`). Non ancora provato a macchina.

## Da dove nasce
Lorenzo, 2026-10-08, con `TEST-PIAZZEMENTO CON MACCHIE.svg` (FENDI FALL 27-28, «magic serpente ghepardato»: pannello
355 × 101 mm, contorno rosso, 84 macchie gialle): la base (per esempio il punto nastro a squame) su tutto il pannello, e
dentro ogni macchia un raso con sopra **il punto della base**, *«ogni macchia riempita con il proprio punto autonomo»*,
coi salti ridotti al minimo; *«dove le macchie si toccano conviene mettere in consecuzione»*.

## Le decisioni di Lorenzo
1. **Il raso è verticale**; lo stesso filo per tutto.
2. La base doveva fermarsi 2 mm dentro la macchia; poi *«per ora non bucare la base, lasciala tutta intera»*. Il taglio
   è pronto nel motore (`bucaLaBase`, `margineBase`), spento.
3. Dopo la prima prova: **«non ricamare tra una macchia e l'altra»** — la prima versione passava da una macchia all'altra
   sulle linee della base (nascosto, ma è ricamo fra le macchie): tolto. **«Puoi gestire tu ingresso e uscita»**.
4. Il punto sopra **«fuori dalla macchia non deve mai andare: piuttosto si elimina una parte più corposa»**.
5. **Sfrangiare il raso** per non avere bordi netti.
6. **«Alterare le macchie per farle avvicinare»**, per avere meno rasafilo: i ponti, facoltativi.
7. **Tre stop**: la base, il raso delle macchie, il punto sopra (*«ho bisogno che le macchie siano divise in 2 stop»*).
8. (2026-10-09) **Da sinistra a destra**: le macchie e il raso dentro le macchie. **I passaggi sempre sotto il raso**:
   *«in alcune situazioni ripassa sopra il raso già fatto di una parte della macchia per raggiungere l'altra parte.
   Questo è un errore.»*
9. (2026-10-12) **Ingresso e uscita nei punti più vicini alle macchie vicine**, *«lavorando a serpentina e lasciando
   solo i salti quando è impossibile altrimenti»*. E il da-sinistra-a-destra era una prova: *«conviene lavorare
   autonomamente sinistra-destra e viceversa (serpentina o qualsiasi altra forma) che permetta alle macchie di
   muoversi meglio»* — spento di serie.
10. (2026-10-12) **Dentro una macchia mai un salto**: *«i passaggi della macchia devono avvenire interni alla macchia
   stessa, e poi essere coperti»*. E **le zone**: base intera, poi raso e punto sopra della prima zona, poi della
   seconda (*«se voglio che ricami prima la prima metà e poi la seconda metà»*).

## Come è fatto, e perché
- **Il punto sopra è la base stessa**, generata una volta e tagliata sulla macchia: a registro al millesimo.
- **Ingresso e uscita.** In ogni macchia si entra nel punto dell'interno più vicino a dove si è usciti; un passaggio
  SOTTO il raso (A* su griglia, lontano dal bordo più della sfrangiatura: il raso lo copre) porta all'inizio delle righe.
  Il raso sceglie da quale cella e da quale angolo cominciare guardando dove FINISCE: dal lato della macchia dopo.
- **I passaggi del punto sopra** stanno sulle linee del punto o **nel verso del raso**: per ogni capo dei pezzi la corda
  verticale della macchia entra nella rete. Il filo posato fra i fili del raso, nello stesso verso, non si vede.
- **Il raso a celle**: una riga continua la cella di prima se si sovrappongono e nessun'altra riga ci si sovrappone; i
  passaggi fra le celle girano attorno al raso già cucito (la griglia dell'interno perde le celle cucite).
- **I ponti** vanno nella macchia PRIMA, non in quella dopo: così il raso e il punto sopra della prima possono finire
  dentro il ponte, cioè già dentro la macchia dopo. Messi nella macchia dopo, il raso non ci arrivava (83 → 67 salti
  invece di 83 → 17).

- **Passaggi sotto il raso, davvero.** «Lontano dal bordo» non basta: un passaggio che va da una parte all'altra
  della macchia deve correre dove il raso NON è ancora stato cucito, cioè dove lo coprirà. Due pezzi: il piano
  (ordine e verso delle celle tali che, finita una, la prossima si raggiunga solo attraverso celle da cucire — una U
  aperta a destra: un braccio verso la base, la base da sinistra, l'altro braccio) e la griglia «dove il raso
  coprirà» (le fasce delle righe ancora da fare). Trappole trovate: la fine di una cella e la cella vicina possono
  stare ai capi opposti della stessa riga (il piano deve guardare il PUNTO dove si finisce, non il lato); a 0,9 mm
  di tolleranza il piano saltava sopra una riga cucita (0,55: solo la riga accanto); le righe sfrangiate in fuori
  finiscono fuori dalla macchia, e la loro punta va lasciata percorrere; nelle rientranze la volta fra due righe
  esce dalla macchia (lì la cella si divide). Dove una strada coperta non c'è: un salto, mai un filo sopra il raso.

- **L'uscita su qualsiasi riga.** L'ingresso era già libero (si arriva sotto il raso); l'uscita no: il raso finiva
  sull'ultima riga della serpentina, e il salto partiva da lì. La cella si cuce in due — un lato, poi l'altro dal
  fondo verso la riga più vicina alla macchia dopo — e il passaggio fra le due parti corre dove il raso non c'è
  ancora. Da 21 salti oltre 12 mm a 1 (che è la distanza vera fra due macchie isolate).

## Strade scartate
- Passaggi fra le macchie sulle linee della base (27 salti in tutto): Lorenzo non vuole ricamo fra le macchie.
- Raso e punto sopra di ogni macchia di seguito (una macchia finita, poi la successiva): Lorenzo vuole due stop.
- Il pezzo d'uscita del punto sopra tenuto da parte a ogni costo: costringeva a tornare indietro con un salto in più;
  ora, se serve comunque un salto, la riserva cade.
- Una griglia dei passaggi «a 0,8 mm dal bordo» con una fascia intorno ai capi per uscire dalla riga: chiudeva i
  colli stretti e lasciava attraversare la riga di prima (13 incroci); sostituita dalla griglia di dove il raso coprirà.
- Il piano a ricerca cieca con un tetto di passi: su una macchia di 8 parti non trovava l'ordine giusto.
- Il punto minimo di 1 mm sul punto sopra: tagliava gli angoli fuori dalla macchia; ora 0,5 mm e solo dove la
  scorciatoia resta dentro.

## Da guardare a macchina
- la sfrangiatura (1 mm, metà fuori) e se il bordo così è quello che serve;
- i ponti: se il disegno li regge, e la larghezza (2 mm);
- il filo del punto sopra posato nel verso del raso;
- la copertura del raso sopra la base intera.

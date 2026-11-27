---
titolo: Punto croce, il modulo a fascia — si ripete solo in larghezza, sta a un'altezza scelta sul pezzo
tipo: decisione
tool: [cross-stitch]
data: 2026-11-24
---

**2026-11-24.** Lorenzo, con la foto di un davanti a maglia (fasce di motivi su un fondo azzurro): «il modulo è un
modulo intero per altezza che si replica solo in orizzontale. E quando vado a disegnare (essendo molto alto) disegno
molto male perché si moltiplica il modulo anche sopra»; «nella pratica si ricama su una base più grande che viene
ricamata intera… un modulo che poi posso posizionare dopo all'interno di un DXF… e replicare in orizzontale, sapendo
che sopra e sotto ci sarà del margine della base»; «il modulo dovrò poterlo usare anche in altre parti dove i margini
sopra e sotto cambiano». E, sul lavoro: «non voglio che fai il disegno, quello lo faccio io: serve che mi migliori
l'interfaccia e le funzionalità».

**Cosa si è visto.** Con la sua immagine *Trova da solo* prendeva un modulo di 32 × 47 V, la metà alta del disegno, e
lo ripeteva anche in altezza: il tool conosceva solo il modulo che si ripete nei due sensi. L'editor mostrava il modulo
in una vista 3 × 3 copie, quindi un modulo alto diventava piccolo e circondato da copie inutili.

**Il modulo a fascia** (`KnitModule.repeat = 'x'`, `isBand`, `moduleRowOf` in `module.ts`).
- **Si ripete solo in larghezza.** `tileModule` mette le V solo nelle righe della fascia: la prima riga è `offset.dr`
  (senza giri: la fascia può anche uscire dal pezzo, e lì è tagliata); fuori c'è la base. `editsOnAllCopies` copia una
  modifica solo a destra e a sinistra; fuori dalla fascia non tocca il modulo. *Giunture sulla base* e le frecce
  *Inizio* si spostano solo di lato.
- **Il percorso** (`routeModuleTiled`, strips.ts): una striscia sola, dove sta la fascia, e la base **sempre in un
  solo stop** su tutto il pezzo, dall'alto in basso, anche se l'interruttore *Base in un solo stop* è spento (è la base
  «ricamata intera» di Lorenzo).
- **L'editor** mostra la fascia con le copie solo ai lati (`viewGridOf`, `viewRow0` = 0): niente copie sopra e sotto.
- **Nel ricamo** la fascia ha due linee tratteggiate (dove comincia e dove finisce) e in *Misure del ricamo* i
  **margini sopra e sotto** in mm, dal punto più alto e più basso della forma (o del ricamo); scrivendone uno la fascia
  si sposta a righe intere e l'altro segue. Su una forma nuova, e caricando un modulo, la fascia va al centro del pezzo.

**Trova da solo e il disegno** (`runModule`, tool.ts). *Trova da solo* ora trova il modulo (quante V, dove comincia,
la guida) e **non tocca il disegno**: un modulo vuoto prende i colori dei fili dall'immagine, uno già disegnato cambia
solo misura. Ricopiare il disegno dall'immagine è un bottone a parte, *Ricopia il disegno*, che chiede conferma se il
modulo ha già un disegno. Per la fascia (`findModule(..., { band: true })`):
- il periodo si cerca solo in larghezza; in altezza il modulo è tutto il pezzo d'immagine;
- le righe che stanno a metà fuori dall'immagine non contano (non hanno campioni: uscivano di un colore a sé);
- si tolgono le righe di sola base sopra e sotto: una riga è di base se il 95% delle sue V ha un colore a ΔE < 12 da
  quello più diffuso (la base di una foto di maglia esce in due gruppi quasi uguali: qui `#8e9cb6` e `#7f8ea8`);
- se la fascia ha già la guida agganciata (da *Trova da solo* o *Scegli modulo*), la ricerca si rifà sulla sua striscia
  **con le sue righe**: rileggendo la trama su un pezzo più basso l'altezza delle righe usciva sbagliata (9,2 px invece
  di 11,6, e la fascia passava da 73 a 92 righe). Il modulo nuovo, con l'immagine intera per guida e righe a caso, non
  vale come guida agganciata (`guideSnapped`).

Misurato sull'immagine di Lorenzo (1163 × 1301 px): fascia 32 × 72 V, una ripetizione ogni 326 px, tolte 14 righe di
base sopra e 25 sotto (dalla prima fascia di motivi a ~175 px all'ultima a ~1010 px); rifacendo la ricerca resta 72.
Senza fascia la ricerca dà ancora 32 × 47 come prima.

**Il modulo in un file a sé** (`moduleFile`, `readModuleFile`). *Salva modulo…* (nell'editor e nel pannello del ricamo)
scrive un `.json` col modulo, i fili, la base e la cella (larghezza, altezza, sormonto: così il modulo resta degli stessi
mm). Non ci sono la posizione (si sceglie in ogni pezzo) né la guida (sta su un'immagine che l'altro progetto non ha).
*Carica modulo…* prende quel file, o un DST o SVG fatti qui che hanno un modulo, e lo mette sul pezzo aperto: misure e
forma restano, la griglia si rifà con la cella del modulo. Annulla torna a prima in un passo (i fili, come sempre, no).

**L'editor in tre passi** (Lorenzo: «molto poco intuitivo come poter usare un'immagine di base, identificare il modulo e
poi iniziare a disegnare»). Il pannello dell'editor è un `rg-steps` del DS: *1 L'immagine sotto* · *2 Il modulo* (come
si ripete, la cella, *Trova da solo* o *Scegli sull'immagine*, colonne e righe; l'aggancio fine e *Ingrandisci* in una
disclosure) · *3 Disegna*. Ogni passo dice cosa c'è e ha il badge *Fatto*; si apre da solo il primo da fare (all'apertura,
dopo l'immagine, dopo aver trovato o scelto il modulo).

**La base sulla scollatura (2026-11-25).** La base in un solo stop si cuceva riga per riga dall'alto; dove la forma
spezza una riga (una scollatura) il filo andava da una parte all'altra **sopra il vuoto**, fuori dal pezzo: sul davanti
di prova (400 × 460 mm, cella 5 × 6) 44 tratti sul vuoto, più salti fra le spalle. Succedeva con ogni modulo dentro una
forma. Le due strade mostrate a Lorenzo: (a) a ogni riga un salto col taglio; (b) prima una spalla tutta, poi l'altra.
Lorenzo: «facciamo un'impuntura continua nei punti in cui c'è la scollatura». Fatto così (`baseWholeRoute`, strips.ts):
- **la base a pezzi** (`basePieces`): ogni fascia della base si divide nei pezzi che la forma lascia staccati; un pezzo
  continua quello di sopra se si toccano solo fra loro. Si cuce il pezzo più in alto fra quelli che hanno già cucito
  tutto quello che toccano sopra: la spalla sinistra tutta, la destra tutta, poi le righe intere sotto. Ognuno dall'alto
  in basso, a serpentina, col verso che parte più vicino a dove si è e finisce più vicino al pezzo dopo;
- **l'impuntura** (`baseTravel`): da un pezzo all'altro, la strada più corta sui lati e sui verticali del reticolo che
  **resta dentro la forma**, meglio dove la base non è ancora cucita (la copre dopo) e mezza cella dentro dal bordo;
  sopra la base già cucita costa sei volte, sopra il vuoto mai. Due pezzi staccati del tutto: lì si salta;
- senza forma, o con una forma che non spezza le righe, la base è un pezzo solo e il percorso è quello di prima.

Misurato sul davanti di prova con la fascia in alto: prima 44 tratti sopra il vuoto, 610 mm di salti e 308 mm in vista
nella base; ora 0, 0 e 0, un'impuntura di 160 mm dentro la spalla destra ancora da cucire. I fili del disegno, dove la
forma li interrompe, saltavano già col taglio (*Taglio a ogni salto*): non cambiano.

**Le prove** in `test/cross-stitch-fascia.mjs` (13 asserzioni): righe della fascia, fascia fuori dal pezzo, copie solo
in larghezza, giunture, percorso (una base, fili solo nella fascia), la base sulla scollatura (uno stop, nessun salto,
niente sul vuoto, una spalla poi l'altra, l'impuntura fra le due), tracce fino al DST su una forma, ricerca su
un'immagine con righe di base, file del modulo (andata e ritorno, da un progetto, file sbagliati). Rotte apposta in nove
modi (su una copia in `.lab`): tutte rosse nel punto giusto.

# Diario della conduzione

> Lo scrive la chat di conduzione ([`CONDUZIONE.md`](CONDUZIONE.md)), un paragrafo per giro, dal più
> recente. Lorenzo lo legge per sapere a che punto è il progetto e cosa aspetta lui.

## Aspetta Lorenzo

- **2026-10-21 — K4, le tecniche di punto di ogni tool.** La scheda di ogni tool ha un posto per le
  *tecniche* della tassonomia R24 (corsa · raso · cordoncino · catenella · zig-zag · tatami · croce), ma
  **quale tecnica fa quale tool è una tua mappa di mestiere**, non si legge dal codice: la voce K4 resta
  aperta su questo (debito 17 su 17). Serve per rispondere a *«ho una foto di un degradé, con cosa lo faccio?»*.
  Sotto una **bozza mia, solo dalle descrizioni dei tool: da correggere**; dove ho scritto «?» non la so.
  Rispondi anche solo «va bene», «togli X», «aggiungi Y a Z».

  | Tool | Bozza (da correggere) |
  |---|---|
  | Rete 45° | cordoncino · raso (fascia) |
  | Generatore pattern | zig-zag · corsa |
  | Interlace | ? (intreccio di passaggi brevi) |
  | Oblique | zig-zag · cordoncino |
  | Punto croce | croce |
  | Bitmap → Stitch | tatami |
  | Punto Striato | tatami (base) + ? (striature a spola) |
  | Pattern a zone | zig-zag · corsa |
  | Cannage rafia | corsa · cordoncino · raso (bordatura) |
  | Broccato | raso |
  | Sfrangiatura | raso (frange sui capi) |
  | Punto pettine sfrangiato | ? (linee di base + denti) |
  | Punto razza | cordoncino (pallini) |
  | Pattern a macchie | raso · (il punto della base) |
  | Punto Pittorico | tatami |
  | Rete testa speciale | ? (serpentine) |
  | Punto maglia | ? (la V a maglia) |

  Dove il tool fa un punto che la tassonomia **non nomina** (la V del Punto maglia, le striature, i denti del
  pettine): lo aggiungiamo alla tassonomia (una regola nuova in Costituzione, R24) o lo lasciamo fuori?

- **2026-10-21 — lo stash di pattern-macchie (non urgente).** Il lavoro di pattern-macchie è stato committato (`fe8794c`), la cartella principale non ha più modifiche sue, quindi pattern-macchie non è più occupato per le modifiche non committate (resta la regola delle 48 ore). Rimane `stash@{0}` («pattern-macchie (chat operativa): lavoro non committato, messo da parte per il merge del K1b»): confrontato con master, i due file `tool.ts` e `sapere/tool/pattern-macchie.md` sono identici e il resto è lavoro arrivato dopo. **Posso toglierlo?** (Non l'ho creato io, quindi non lo tolgo senza il tuo sì.)
- **2026-10-20 — K6, i riferimenti fuori dal repo.** `PUNTO-STRIATURA.dst` e `BROCCATO.dst` stanno solo
  sul server: per misurarli vanno copiati in `test/fixtures/` (vedi `sapere/riferimenti/LEGGIMI.md`).

## Giri

### 2026-10-21 — voce 3: K4, la scheda di ogni tool · master `53679de` (fatta in parte)

**Fatto.** Ogni tool ha ora nella scheda **cosa prende** (`ingressi`: svg · dxf · raster · dst) e **cosa dà**
(`uscite`), e i suoi parametri si leggono dal registro (`parametriDelTool(id)`). I dati dei tool sono in
`packages/ui/src/tools-dati.ts`, senza DOM (si importano anche in node); `tools.ts` li riesporta, quindi
`@rg/ui/tools` funziona come prima. **Quello che un tool dichiara si controlla contro i suoi sorgenti**: i file
che accetta e i bottoni di export che ha.

**Trovato.**
- **Prendono immagini**: interlace, cross-stitch, bitmap, broccato, pettine, pittorico, punto-maglia (come foto da
  ricalcare). **Solo un DST**: sfrangiatura. Tutti gli altri, un disegno vettoriale (SVG/DXF). **Tutti e 17 danno
  SVG e DST** (anche sfrangiatura, che pareva non avere l'SVG).
- Rotto apposta in cinque modi insieme, cinque rossi distinti (un DXF dichiarato e non accettato; un'immagine
  accettata e non dichiarata; un SVG esportato e non dichiarato; una tecnica inesistente; una mappa di tecniche
  senza abbassare il debito).
- Home controllata nel browser: «Strumenti 11 · In sviluppo 6», si apre un tool e si torna, nessun errore.
- La home **non mostra** ancora ingressi e uscite sulle carte: è una scelta di aspetto, non l'ho fatta.

**Per le altre chat.** Un tool nuovo deve avere la sua riga in `tools-dati.ts` con `ingressi` e `uscite`
(`npm test` lo verifica contro il sorgente di `tool.ts`).

### 2026-10-21 — voce 2: U1, i componenti comuni dell'interfaccia · master `040462d`

**Fatto.** `packages/ui/src/anatomia.ts` (campo numerico, sezione 01, sezione numerata, sezione Progetto,
intestazione dell'anteprima, barra di stato, scheletro) e il suo cricchetto in `smoke.mjs`: un tool che scrive a
mano un pezzo che ha un componente fa fallire `npm test`, salvo che stia nella lista del debito
(`packages/ui/src/debito-anatomia.ts`, può solo scendere). **Debito di partenza: 59 voci su 16 tool.**
Tool di prova: **net-45**, migrato per intero; nel browser, prima e dopo, stesso ricamo (20 tratti, SVG della
stessa lunghezza).

**Trovato.**
- Il campo numerico comune è un campo di testo con `inputmode="decimal"` (non `type="number"`, che vuole il
  punto): `0.5` e `0,5` danno lo stesso ricamo, ↑↓ fanno 0,55 e 0,45 senza il rumore del floating point, un testo
  non valido torna all'ultimo valore buono, la larghezza reale non scende sotto 0. Non è servito nessun componente
  nuovo nel design system (`rg-input--numeric` e `rg-field-with-unit` c'erano già).
- Un test vecchio («accetta un .dst in ingresso») leggeva `accept="….dst` dal sorgente del tool: adattato, vale
  anche l'uso di `sezioneSorgente` (che ha sempre «Apri progetto o DST…»).
- Il cricchetto non vede la sezione 01 di 5 tool (cannage, pattern-grammar, pattern-macchie, rete-testa-speciale,
  zone-pattern) perché la costruiscono con una funzione: lo dichiara, e quelle voci mancano dal debito finché
  il tool non verrà migrato.
- Rotto apposta in cinque modi, tutti rossi nel punto giusto (campo numerico a mano in net-45; un tool tolto dal
  debito; un tool messo nel debito senza motivo; i due export scambiati; le frecce senza arrotondamento).

**Per le altre chat.**
- **Chi crea un tool nuovo**: usi `scheletro` e i componenti di `@rg/ui/anatomia`; scrivere a mano
  l'intestazione, il campo numerico, la sezione 01 o la barra di stato fa fallire `npm test`.
- **Chi lavora su un tool esistente** non è obbligato a migrarlo (la U2 lo farà un tool per giro, e i tool
  occupati per ultimi), ma se lo fa deve togliere la sua riga dal debito, altrimenti il test lo dice.
- Il DST è l'unico bottone pieno dell'anteprima (decisione U-D1): *Genera* sarà un bottone con il bordo.

### 2026-10-21 — voce 0 e voce 1: sincronizzare, merge del K3 · master `0848a9e`

**Fatto.** Il K3 (il referto comune: `misuraDst`, `misure` in ogni `motore.genera`) è su master, unito col
protocollo di §4. **17 tool su 17** con `misure`.

**Trovato.**
- Conflitto solo in `test/smoke.mjs`: il blocco del K3 contro i test nuovi di rete-testa-speciale e
  punto-maglia, arrivati su master mentre il K3 era fermo sul suo ramo. Tenute tutte e due le parti.
- Il cricchetto del K3 ha segnalato da solo i due tool nuovi (`manca misure`): una riga in `genera` ciascuno
  (`misure: refertoDaStrati(strati)`; entrambi esportano con `dstFromExportLayers` senza opzioni). È il
  motivo per cui i tool nuovi non possono entrare in master senza registro (K1), motore (K1b) e referto (K3).
- Rotto apposta: punto-maglia senza `misure` → «manca `misure`: il referto del DST (K3)»; rimesso a posto.
- Browser, ramo unito e master serviti in parallelo (porte mie, `launch.json` non toccato): tutti i 17 tool
  aperti, nessun errore in console, testo di pagina e numeri identici (razza 619 pallini · 5915 punti · 17.1 m;
  striatura 37.50 m · 1 salto; interlace 221.23 m). Cambia solo lo zoom, che dipende dalla finestra.
- Fine riga: i 29 file cambiati sono LF (`git ls-files --eol`).

**Per le altre chat.**
- **Stilista Link** (cartella principale, ramo `stilista-link` a `1350fe2`): simulato il merge di master sopra
  la sua punta. Un solo conflitto, in `STATO.md` (si tengono tutte e due le parti); `smoke.mjs` si unisce da
  solo; dopo, `npm test` e `typecheck` verdi. Nessun lavoro non committato di quella chat è stato toccato (nel
  frattempo ha committato: la cartella principale è pulita).
- **Chi tocca `apps/punto-maglia/src/motore.ts` o `apps/rete-testa-speciale/src/motore.ts`**: c'è una riga
  nuova in `genera` (`misure`). Se un vostro cambio ritorna strati in un altro punto, aggiungete `misure` anche lì.
- **Chi crea un tool nuovo**: serve la scheda nel registro (`packages/cervello/src/tool/<id>.ts`), i suoi
  `salvati`, `motore.ts` + `test/prove/<id>.ts` e il referto in `genera`; il cricchetto di `npm test` lo chiede.

**Non cancellato (non è mio).** Il ramo `cervello/k3-referto` e la cartella `../RG-k3-referto` (creati dalla
chat del K3, ora tutto in master): si possono togliere. Lo stash `stash@{0}` di pattern-macchie: confrontato
con master, `tool.ts` e la nota in `sapere/` sono identici, il resto è lavoro arrivato dopo → è
praticamente tutto committato (`fe8794c`); vedi la domanda in alto.

### 2026-10-20 — il mandato (chat globale)

Nasce la conduzione. Stato di partenza: K1 e K1b su master; **K3 finito sul ramo `cervello/k3-referto`
e mai unito**; U1 mai partita; su `origin/master` è arrivato il Punto maglia (sedicesimo tool), che la
cartella principale non ha ancora.

---

## I messaggi che hanno avviato le fasi (il modello della misura giusta)

### K1b — il contratto del motore (2026-10-15)

> Lavora su un ramo tuo, in un git worktree separato; nel worktree nuovo `git submodule update --init` e
> `npm install`. […] Il contratto in packages/cervello (i tool lo importano solo come tipo): Motore =
> { id, genera(ingresso, params) → Promise<Risultato> }. Ingresso = sagoma, immagine, dst, larghezzaMm,
> più le parti proprie del tool: quello che l'utente disegna a mano fa parte dell'ingresso, non dei
> parametri. params = lo stesso oggetto che il tool salva oggi, coi nomi di oggi: nessuna rinomina. […]
> Non riscrivere niente: avvolgi. […] Non cambiare i pannelli: il passaggio lo farà la U2. […] Il
> cricchetto: per ogni tool chiama genera su un ingresso di prova e controlla strati non vuoti, un DST
> che si rilegge con gli stessi punti, il motore che gira in node. I tool non ancora fatti vanno in una
> lista del debito che può solo scendere. Prova il test rompendolo apposta. […] Per ogni tool confronta
> i punti del DST prima e dopo: devono essere identici.

### K3 — il referto comune (2026-10-15)

> Una funzione unica nel core, accanto a readDst, che dato un DST dà sempre le stesse misure. Il
> referto contiene solo quello che si misura dal DST (punti, lunghezza cucita, salti e tagli, aghi,
> ingombro, punto più corto e più lungo, punti sotto soglia). Attenzione al limite dei 12,1 mm: un salto
> lungo è più record ma conta come uno. Quello che dal DST non si misura non si inventa: il filo in
> vista lo passa il tool che lo calcola; consumo vero e tempo macchina sono domande per Lorenzo. […] Dove
> il referto non coincide coi numeri di oggi non correggere niente: è una divergenza da decidere
> (regola 7), elencala. […] Non toccare i pannelli. Il ricamo non deve cambiare.

# Rifare Stilista da zero, con i tool e l'AI dentro — studio di fattibilità e di costi

> Chiesto da Lorenzo il **2026-10-29**: *«Quanto sarebbe complicato replicare un software come Stilista da
> zero, implementando però le funzioni dei tools e assistenza AI. Oltre poi migliorare tutte le cose che
> Stilista ha ora internamente. Una questione di fattibilità e costi. Oltre che un chiaro piano di tutte le
> funzioni del ricamo base.»*
>
> È uno **studio**: nessun codice è stato toccato. Scritto da una sotto-chat della chat madre.

**Come leggere i numeri.** In tutto il documento:

- **[misurato]** = l'ho contato nel repo o letto in un documento del repo, con il file;
- **[fonte]** = l'ho letto su una pagina web, con l'indirizzo e la data (sezione 9);
- **[stima]** = è un mio giudizio. Le stime hanno sempre l'ipotesi scritta accanto. Sono stime da
  ingegnere, non preventivi: l'errore realistico è **del 50% in più o in meno**, e di solito in più.

---

## 0. Il riassunto in una pagina

**Si può fare?** Sì. Un software di ricamo è un lavoro grande ma non è un mistero: il formato DST è
semplice e già scritto nel repo, la geometria è nota, e c'è perfino un esempio libero completo
(Ink/Stitch). La parte difficile non è la teoria, è **la qualità dei punti di tutti i giorni** (il raso a
colonna, gli spigoli, i sottopunti, la compensazione) e **l'editor** (disegnare, selezionare, spostare,
ordinare, annullare, su pannelli da 400.000 punti senza rallentare). Quelle cose Stilista le fa da anni,
e la suite oggi **non le ha**.

**Quanto ne esiste già?** [stima, tabella in §3] Circa **un terzo del valore** di un software che
sostituisca Stilista per RG. Ma è un terzo strano: la suite ha **la parte rara** (17 riempimenti speciali
che Stilista non ha, i passaggi nascosti, il referto del DST, il simulatore, il contratto comune dei
motori) e le manca **la parte comune** (l'editor, il raso a colonna con le linee di direzione, i
sottopunti, il lettering, la modifica dei punti a mano, il foglio di produzione). Togliendo i tool
speciali, del software "normale" c'è **meno di un quinto**.

**Quanto costa e quanto ci vuole?** [stima, §7]

| Scenario | Chi | Tempo | Costo in euro (ordine di grandezza) |
|---|---|---|---|
| **A. MVP per RG, Lorenzo con l'AI** | Lorenzo a metà tempo + Claude | 15–24 mesi | 45–75 mila (quasi tutto è il tempo di Lorenzo) |
| **B. MVP per RG, piccolo team** | 2 sviluppatori + Lorenzo al 30% + AI | 12–18 mesi | 180–260 mila |
| **C. Il "Compositore": metà strada** | Lorenzo + AI (o 1 sviluppatore) | 5–9 mesi | 15–30 mila (o 55–80 mila con 1 persona) |
| **D. Prodotto da vendere** | 5–7 persone | 3–4 anni prima di vendere bene | 1,5–2,5 milioni, poi 0,4–0,7 milioni l'anno |

**Per confronto** [fonte, §9]: una licenza Wilcom EmbroideryStudio *Designing* costa 4.000 dollari, Tajima
DG17 *Maestro* circa 13.000 dollari canadesi; GMI fa Stilista dal 1980, Wilcom esiste dal 1979, Ink/Stitch
(libero) ha 10 anni e ~59 persone che ci hanno lavorato.

**Il punto che decide tutto:** Lorenzo è **l'unico** che sa giudicare se un ricamo è giusto. In tutti gli
scenari il collo di bottiglia non è scrivere codice (l'AI lo scrive veloce: 80.000 righe in 3 mesi e
mezzo, [misurato]) ma **le ore di Lorenzo davanti al ricamo e alla macchina**. Ogni ora che passa a
collaudare un raso a colonna è un'ora in cui non digitalizza.

**E Lorenzo cosa ha chiesto finora?** [misurato, §5] Nei documenti non c'è mai un *«Stilista non va»*.
Ha chiesto un plugin *«esterno, che non appesantisca Stilista»*, e una volta ha detto che Stilista faceva
**meglio** del tool (*«la divisione e i passaggi mi sembrano più precisi di quelli che il sistema
crea»*). I suoi bisogni veri sono: tecniche che Stilista non ha, passaggi e salti ridotti, programmi
che restano modificabili, controllo a mano sull'automatico, pannelli grandi che non rallentano.

**La raccomandazione** (§8): **non costruire adesso un sostituto completo di Stilista.** Costruire invece,
per tappe, **il pezzo che manca in mezzo**: un *Compositore* nella suite, cioè un documento con più
oggetti, che mette in fila il lavoro dei tool e quello che arriva da Stilista, con aghi, stop, tagli,
simulazione, controllo dei difetti e foglio di produzione (scenario C). È utile **subito** anche tenendo
Stilista, è il cuore di qualunque software futuro, e dopo 6–9 mesi dice con i fatti se ha senso andare
avanti fino al sostituto completo (scenario A o B). Il prodotto da vendere (D) è un'altra impresa: ha
senso solo con un socio o un investitore e con clienti che lo chiedono.

---

## 1. Da dove vengono i dati

| Cosa | Dove | Tipo |
|---|---|---|
| L'elenco dei 17 tool | `packages/ui/src/tools-dati.ts` | [misurato] |
| Lo stato di ogni pezzo | `STATO.md` §1 e §3, `ARCHITETTURA.md` | [misurato] |
| La legge del ricamo | `COSTITUZIONE-RICAMO.md` (R1–R31, tassonomia R24) | [misurato] |
| Cosa si sa di Stilista | `sapere/codice/stilista-*.md`, `strumenti-sviluppo/stilista-link/README.md` | [misurato] |
| Le parole di Lorenzo | `sapere/tool/*.md`, `sapere/decisioni/*.md`, `STATO.md` | [misurato] |
| Le righe di codice | `git ls-files` + `wc -l` sui file `.ts .js .mjs .cs .py .html .css` | [misurato] |
| Concorrenti, prezzi, stipendi | ricerca web, sezione 9 | [fonte] |
| Tempi e costi | i miei conti, con le ipotesi scritte | [stima] |

**Il codice, misurato il 2026-10-29** (righe dei file sorgente, test esclusi):

| Pezzo | Righe |
|---|---|
| I 17 tool (`apps/*`, senza la shell) | ~55.000 |
| `packages/core` (geometria, import, punti, DST, routing) | 4.932 |
| `packages/pattern-grammar` (il motore del Generatore pattern) | 4.713 |
| `packages/cervello` (registro dei parametri, contratto `Motore`) | 1.723 |
| `packages/ui` (chrome comune, simulatore, salvataggio) | 1.525 |
| `strumenti-sviluppo/stilista-link` (plugin C# dentro Stilista) | 5.767 |
| `strumenti-sviluppo/ricamo-3d` (simulatore fisico in Python) | 3.360 |
| **Totale sorgenti** (con test e script) | **~80.000** |
| Test (`test/*.mjs`) | 7.811 |
| Commit | 419, dal 2026-07-16 al 2026-10-29 (105 giorni) |

---

## 2. Il piano delle funzioni del ricamo di base

È l'elenco di **tutto quello che un software di ricamo deve saper fare per lavorare in produzione al
posto di Stilista**. Per ogni funzione: cosa fa, se la suite ce l'ha già e dove, quanto è difficile, e se
è un punto dove si può fare meglio di Stilista.

**La scala della difficoltà** [stima], per un professionista senza AI:

| Voto | Vuol dire |
|---|---|
| ● | facile — meno di 2 settimane |
| ●● | media — 2–6 settimane |
| ●●● | difficile — 2–4 mesi |
| ●●●● | molto difficile — 4–12 mesi, serve tanto collaudo col ricamo in mano |
| ●●●●● | ricerca — nessuno al mondo lo fa bene; può non riuscire |

**La colonna "Suite oggi":** ✅ c'è ed è usata · 🟡 c'è in parte, o in un tool solo · ❌ non c'è.
**La colonna "Meglio di Stilista?":** ★ = qui si può fare chiaramente meglio, con il perché.

### 2.1 File e formati

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio di Stilista? |
|---|---|---|---|---|---|
| F1 | **DST: scrivere** | il file macchina Tajima: punti, salti, cambi colore, tagli, fine | ✅ `packages/core/src/dst.ts` → `buildDst`, `dstFromExportLayers` (R31); porting byte-per-byte del writer di riferimento (`sapere/codice/dst-writer.md`); regge 457.000 punti (STATO §1) | ● | ★ i metadati nel footer: il DST **si riapre** coi parametri (R27, `readDstMetadata`) |
| F2 | **DST: leggere** | aprire un DST di qualunque software | ✅ `readDst`, `misuraDst` (`dst.ts`); il tool *sfrangiatura* lavora sopra un DST | ● | ★ il **referto** (punti, salti veri, tagli, punti corti, ingombro) è misurato dai byte, uguale per tutti (`sapere/codice/referto-dst.md`) |
| F3 | **Altri formati macchina** | DSB/DSZ (Barudan), EXP (Melco), PES (Brother), JEF, VP3, TBF (Tajima), Z00 (ZSK), TAP (Happy)… | ❌ (Costituzione §5.4: «fuori scope per ora») | ●● per formato, se documentato; ●●●–●●●● per i comandi speciali (laser, paillettes, cordonetto) | no: è parità |
| F4 | **Import vettoriale** | SVG, DXF (anche coi blocchi), AI/PDF/EPS, DWG | 🟡 SVG e DXF sì (`packages/core/src/io/svg.ts`, `dxf.ts` con `BLOCKS`/`INSERT` da ottobre, `parseSvgTransform`); AI/PDF/EPS/DWG no | ●● | ★ un import che **dice** cosa ha scartato (le due lezioni in `sapere/codice/dxf-blocchi-insert.md` e `importer-svg-transform-e-vernice.md`) |
| F5 | **Export vettoriale** | DXF/SVG per il taglio, il laser, il cartamodello | 🟡 SVG sì, allineato al cartamodello (R27); DXF no | ● | — |
| F6 | **Import immagini** | foto e disegni raster come sfondo o come sorgente | ✅ `quantize.ts`, `reduce.ts`, `regions.ts`; 7 tool prendono un'immagine | ● | ★ già usato per generare (broccato, pittorico, interlace, cross-stitch) |
| F7 | **Formato del progetto** | il file "nativo": oggetti, parametri, contorni, sequenza; si riapre e si ricalcola | 🟡 la **busta** di progetto per ogni tool (`packages/core/src/progetto.ts`, `conBusta`/`leggiProgetto`, K2): un tool, un file; un documento con **più oggetti** non c'è | ●●● (con le versioni e la compatibilità all'indietro) | ★ aperto e documentato, leggibile da un agente |
| F8 | **Leggere i file di Stilista (.EMG3)** | portarsi dietro l'archivio | 🟡 solo **dal vivo**, col Link: contorni, fori, colori laser, aghi (`Collegamento.Fori.cs`, `stilista-colore-laser.md`). Il formato .EMG3 è chiuso | ●●● col Link in blocco (finché Stilista c'è); ●●●● leggendo il file da soli | — |
| F9 | **DST di altri → oggetti** | da un DST "muto" ricostruire raso, tatami, corse modificabili | ❌ | ●●●●● | ★ se riuscisse sarebbe unico; è ricerca |

### 2.2 Disegno e geometria

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| G1 | **Disegno vettoriale** | linee, curve di Bézier, nodi, chiudere, spezzare, modificare i nodi | ❌ (il *Punto maglia* disegna tratti a mano, `apps/punto-maglia`) | ●●● | — |
| G2 | **Operazioni sulle forme** | unione, sottrazione, intersezione, rientro/allargamento (offset), ritaglio | 🟡 `clip.ts`, `insetPolygon` (con un difetto trovato in passato, ARCHITETTURA regola 8), le regioni coi fori; mancano le booleane generali | ●● (con una libreria tipo Clipper2) | — |
| G3 | **Vettorizzare un'immagine** | dal raster ai contorni | ✅ `traceRegions`, `lisciaRegione` (`regions.ts`) | ●● | — |
| G4 | **Misure, griglie, guide, aggancio** | righello, quote, aggancio ai punti | 🟡 zoom/pan comune; misure nel pannello | ●● | — |
| G5 | **Livelli, gruppi, immagine di riferimento** | tenere ordinato un pannello con centinaia di oggetti | 🟡 l'immagine sotto c'è nel *Punto croce* (`sapere/decisioni/cross-stitch-immagine-di-riferimento.md`) | ●● | — |
| G6 | **Ruoli dei colori del cartamodello** | il colore del disegno dice cosa è: perimetro, foro, zona, area di scarico | ✅ R12, in tutti i tool; i fori arrivano da Stilista (`stilista-fori.md`) | ● | ★ è già il modo in cui Lorenzo lavora (*«se ha lo stesso colore è buco se è diverso è un secondo pattern»*) |

### 2.3 Oggetti e tipi di punto

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| P1 | **Corsa / punto filza, triplo** | linee semplici, ripassi | ✅ `buildRunning`, `resampleUniform`, `enforceMinStitch` (`stitch.ts`, R3/R4) | ● | — |
| P2 | **Raso a colonna** (satin) | il punto più usato: da un bordo all'altro, con **linee di direzione** messe a mano, larghezza variabile, raso diviso quando è largo, angoli | 🟡 `buildColonne` (`colonne.ts`): scheletro, tagli automatici e correggibili, raso da parete a parete — nato da un DST di Lorenzo. **Mancano** le linee di direzione a mano, il raso diviso, il trattamento degli spigoli | ●●●● | ★ i tagli automatici "che il sistema propone e Lorenzo corregge" |
| P3 | **Riempimento tatami** (fill) | righe parallele con angolo, sfalsamento, motivi di sfalsamento, fori | 🟡 `buildParallelFill` (`fill.ts`: serpentina o pettine, coi fori, R24); manca lo sfalsamento a motivo e l'angolo che gira con la forma | ●●● | — |
| P4 | **Riempimenti che seguono la forma** | a contorno, radiale, a spirale, a onda | 🟡 isolinee (`isolines.ts`), *zone-pattern* ruota il piano sulle perpendicolari della zona | ●●● | — |
| P5 | **Riempimenti speciali e decorativi** | motivi, pattern, effetti | ✅ **è la forza della suite**: Generatore pattern, Pattern a zone, Interlace, Oblique, Striato, Razza, Pettine, Cannage rafia, Pattern a macchie, Rete testa speciale, Broccato, Pittorico, Rete 45° (`tools-dati.ts`) | (già fatto) | ★★ **qui la suite è già oltre Stilista**: sono tecniche che in Stilista Lorenzo faceva a mano o non faceva |
| P6 | **Cordoncino / zig-zag su linea** | bordo stretto lungo un tracciato | ✅ `buildCordoncino` (`stitch.ts`); il *Punto maglia* fa un cordoncino di V (`sapere/decisioni/punto-maglia-cordoncino.md`) | ●● con larghezza variabile | — |
| P7 | **Punto croce, punto a giorno, catenella** | punti a griglia, punti decorativi | 🟡 Punto croce ✅ (`apps/cross-stitch`); punto a giorno e catenella vera (macchine a catenella) ❌ | ●● | — |
| P8 | **Applicazioni** (appliqué) | linea di piazzamento → stop → fissaggio → taglio → raso di copertura | ❌ | ●● | no: Stilista 3.3 le fa già in automatico (§2.12) |
| P9 | **Laser** | tagli e fori con la testa laser, e il loro colore | 🟡 *Oblique* fa i fori laser; il Link legge i laser di Stilista (`stilista-colore-laser.md`); **come la macchina vuole i comandi laser nel file non è misurato** | ●●● (dipende dal formato della macchina) | — |
| P10 | **Teste speciali** | paillettes, cordonetto/cordoncino applicato, ciniglia, fori a lama, 3D/puff | ❌ (la *Rete testa speciale* genera la rete, non i comandi della testa) | ●●● ognuna, e serve la macchina per provare | — |
| P11 | **Sfrangiature** | raso tagliato che si apre in frange | ✅ *Sfrangiatura* (sopra un DST), raso sfrangiato del *Pattern a macchie* | (già fatto) | ★ |
| P12 | **Oggetto manuale** | punti messi uno per uno, che non si ricalcolano | 🟡 ogni tool produce punti fissi; in Stilista è il tipo `Manual` (`stilista-oggetto-manuale.md`) | ● | ★ in Stilista un ricalcolo **rovina** il manuale (773 → 2 punti): in un software nostro il punto fisso resta fisso |

### 2.4 La qualità del punto

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| Q1 | **Densità, lunghezza punto, punto minimo e massimo** | le misure di base | ✅ R3, R4, R22, R30; nel registro dei parametri (`packages/cervello`) | ● | ★ un nome solo per ogni misura in tutti i tool (registro, 327 parametri) |
| Q2 | **Sottopunti** (underlay) | corsa centrale, bordo, zig-zag, doppio zig-zag, tatami sotto, rientrati dal bordo | 🟡 R25 è scritta ma è nel core solo come regola; ci sono sottopunti locali in *Punto croce* e *Rete testa speciale* | ●●● (farli tutti, e giusti per ogni tessuto) | — |
| Q3 | **Compensazione del tiro** | allungare le passate perché il filo tira e la forma si stringe | 🟡 R19 scritta; usata in pochi tool | ●● la formula, ●●●● tararla bene per tessuto | ★ potrebbe venire **dalle misure** del simulatore fisico (`ricamo-3d`) invece che dall'occhio |
| Q4 | **Spigoli e curve strette** | punti corti dentro le curve, spigoli a mitra o tagliati | ❌ | ●●● | — |
| Q5 | **Profili di materiale** | preset per maglia, pelle, termogarza, rafia… | ❌ (`sapere/materiali/` è previsto, non c'è) | ●● il meccanismo, poi i valori li sa Lorenzo | ★ i profili con **il perché** e le prove, come le decisioni in `sapere/` |
| Q6 | **Tetto alla densità** | evitare i punti dove il filo si accumula e si rompe | 🟡 `maxStitchesPerMm2` nell'*Interlace* (*«rischio di far rompere il filo e lavorare male la macchina»*) | ●● per tutti | ★ un controllo che oggi Lorenzo fa a occhio |

### 2.5 Sequenza, aghi, stop, tagli, fermature

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| S1 | **Ordine di cucitura** | la lista degli oggetti in ordine, da spostare a mano; ordinamento automatico per colore e per vicinanza | 🟡 l'ordine **dentro** un tool sì (catena minima fra le macchie, `routing.ts`); una lista di oggetti da riordinare no | ●●● | ★ ordinamento che **sa** cosa verrà cucito sopra |
| S2 | **Entrata e uscita, passaggi fra oggetti** | da dove parte e dove finisce ogni oggetto; i passaggi da un oggetto all'altro | ✅ **avanzato**: `routing.ts` (R16–R21: mappa del coperto, A*, il passaggio va sotto quello che verrà cucito), `avoidVoids`, `routeAlongBorder` | ●●● (già fatto in buona parte) | ★★ i passaggi nascosti sotto i colori dopo sono la richiesta più frequente di Lorenzo (*«Vanno assolutamente ridotti di tantissimo i salti»*) |
| S3 | **Aghi, colori, cataloghi dei fili** | ago per oggetto, colore del filo, cataloghi Madeira/Gunold/Isacord… | 🟡 un ago per strato (`dstFromExportLayers`); niente cataloghi; il DST non porta i colori | ●● | — |
| S4 | **Stop e cambi colore** | fermare la macchina, cambiare ago | ✅ in tutti i tool (cambio quando cambia l'ago) | ● | — |
| S5 | **Tagli** (rasafilo) | tagliare il filo prima di un salto lungo | ✅ `buildDst` scrive il taglio Tajima (tre salti minimi); il referto li conta | ● | ★ regole di taglio "per blocchi vicini" come chiede Lorenzo (*«fare rasafilo solo in blocchi esterni»*) |
| S6 | **Fermature** (tie-in / tie-off) | qualche punto piccolo all'inizio e alla fine per bloccare il filo | 🟡 R8 (fermatura di scarico sul bordo) in alcuni tool | ● | — |
| S7 | **Aree di scarico** | dove si possono far partire e finire i fili, per il montaggio | ✅ (`sapere/decisioni/aree-di-scarico.md`: *«mi chiedono sempre più spesso di scaricare i punti in determinate aree»*) | ●● per tutti gli oggetti | ★ |
| S8 | **Multi-testa, ripetizioni, telai** | pannello con più teste, step & repeat, limiti del telaio | 🟡 "Testa A/B" nel pannello comune; *Rete testa speciale* | ●● | — |

### 2.6 La modifica a mano

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| M1 | **Selezionare e trasformare oggetti** | spostare, ruotare, scalare, specchiare, allineare, duplicare | ❌ (ogni tool ha il suo pezzo, non c'è un documento) | ●●● | — |
| M2 | **Modificare i punti** | spostare, aggiungere, togliere punti; spezzare un oggetto | 🟡 a pezzi: togliere punti nel *Punto maglia* (*«posso eliminare dei punti se voglio, e anche decidere inizio e fine»*), passaggi a mano nel *Punto croce* | ●●● (veloce anche su 400.000 punti) | — |
| M3 | **Annulla / ripeti** | tornare indietro senza limiti | 🟡 in 5–6 tool, ognuno a modo suo | ●● (ma va pensato dall'inizio, non dopo) | — |
| M4 | **Automatico ma correggibile** | il sistema propone, l'operatore corregge, e la correzione resta anche se si ricalcola | 🟡 tagli delle colonne, fasce del Punto croce | ●●● | ★★ è la richiesta più costante di Lorenzo (*«fasce automatiche ma dammi un modo per modificarle»*) |

### 2.7 Simulazione, anteprima, controllo

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| V1 | **Anteprima realistica del filo** | vedere il ricamo come sarà, col rilievo e la luce | 🟡 anteprima a filo sottile (R15); `ricamo-3d` è un simulatore **fisico** (in Python, fuori dalla suite) | ●● una vista veloce (WebGL); ●●●● fisica in tempo reale | ★ nessun concorrente noto simula la termogarza che si toglie |
| V2 | **Simulatore di cucitura** | l'ago che avanza, avanti/indietro, velocità | ✅ in *Pettine* e *Cannage rafia* (`packages/ui/src/simulatore.css`, `apps/pettine/src/simulatore.ts`); Lorenzo: *«lo vorrei ovunque»* | ● per portarlo dappertutto | — |
| V3 | **Controllo dei difetti prima della macchina** | punti troppo corti, salti lunghi, densità alta, passaggi a vista, fili sopra fili | 🟡 il referto conta punti sotto soglia, salti, tagli (`misuraDst`); il filo in vista lo danno *razza* e *pettine* | ●● | ★★ automatico, spiegato, su qualunque DST (anche di altri) |
| V4 | **Tempo macchina e consumo di filo** | quanto dura e quanto filo serve | ❌ (aspetta i valori di Lorenzo: STATO K3, «domande per Lorenzo») | ● coi dati | — |

### 2.8 Scala e trasformazioni

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| T1 | **Scala con ricalcolo** | ingrandire o ridurre tenendo giusta la densità | 🟡 i tool **rigenerano** dai parametri (sono generatori): scalare il cartamodello e ricalcolare funziona già; per un documento di oggetti serve il modello a oggetti (M1) | ●● dopo M1 | ★ i passaggi che **non cambiano** cambiando misura (*«se cambio le misure… i passaggi si rovinano nel finale»*) |
| T2 | **Scala di un DST muto** | scalare un DST senza oggetti | ❌ | ●●●● (dipende da F9) | — |

### 2.9 Lettering

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| L1 | **Motore del testo** | scritte su riga, arco, percorso; spaziatura, crenatura, monogrammi | ❌ | ●●● | — |
| L2 | **Font da ricamo** | alfabeti già digitalizzati, belli anche a 5 mm | ❌ | ●●●● per farne una libreria: ogni alfabeto si digitalizza lettera per lettera | — |
| L3 | **Font del computer → ricamo** | trasformare un TrueType in raso e tatami | ❌ | ●● (qualità bassa sotto ~6 mm) | — |
| L4 | **Nomi in serie** | lo stesso disegno con nomi diversi | ❌ | ●● dopo L1 | — |

> Se RG usi il lettering, e quanto, **non è scritto da nessuna parte**: è una delle domande per Lorenzo (§8.4).

### 2.10 Produzione e macchine

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| R1 | **Foglio di produzione** | immagine, misure, sequenza dei colori e degli aghi, punti, tempo, note, per l'operatore | 🟡 i dati ci sono (referto, busta), la stampa no | ●● | ★ con le misure del referto e il controllo dei difetti scritti sopra |
| R2 | **Invio alla macchina** | USB, rete, seriale; la coda dei lavori | ❌ (oggi: DST su chiavetta, o dentro Stilista) | ● la chiavetta; ●●●● i protocolli di rete proprietari | — |
| R3 | **Archivio dei disegni** | cercare, versioni, cliente, anteprima | ❌ | ●● | ★ ricerca anche per tecnica e parametri |
| R4 | **Preventivo** | costo da punti, tempo, filo | ❌ | ● dopo V4 | — |

### 2.11 La piattaforma (quello che non si vede ma regge tutto)

| # | Funzione | Cosa fa | Suite oggi | Diff. | Meglio? |
|---|---|---|---|---|---|
| X1 | **Il documento a oggetti** | il modello dei dati: oggetti con parametri, punti calcolati, ricalcolo solo di quello che cambia | ❌ (ogni tool ha il suo stato) | ●●●● | ★ il contratto `Motore` (`packages/cervello/src/motore.ts`) fa già di ogni tool un "tipo di oggetto" |
| X2 | **Prestazioni sui pannelli grandi** | disegnare e modificare 400.000–2.000.000 punti senza scatti | 🟡 Web Worker in *razza* e *pattern-macchie*; il pannello da 392.000 punti è sceso da 35 a 9 s (STATO §1) | ●●● | ★ disegno su scheda grafica (WebGL) e calcolo in parallelo |
| X3 | **Estensioni / plugin** | aggiungere tipi di punto senza toccare il resto | ✅ il contratto `Motore` + il registro dei parametri (K1, K1b) | (fatto) | ★★ in Stilista per aggiungere una cosa si passa dalla riflessione su campi offuscati |
| X4 | **Installazione, aggiornamenti, salvataggi sicuri** | installer, salvataggio automatico, recupero dopo un crash | 🟡 la suite è un sito; il Link ha `Installa.cmd`/`Disinstalla.cmd` | ●● | — |
| X5 | **Manuale e guida** | aiuto nell'app | ✅ `MANUALE.md` → bottone *Guida* | ● | — |
| X6 | **Test automatici** | ogni regola del ricamo controllata da un test | ✅ `npm test`: le primitive, le invarianti di tutti i motori, i cricchetti K1–K4 | (fatto) | ★ |

### 2.12 L'asticella: cosa Stilista 3.3 dichiara di avere

Per sostituirlo bisogna almeno pareggiarlo. Dalla brochure ufficiale di Stilista 3.3 (GMI, giugno 2023)
[fonte, §9]: autotrace e *autopunch* da disegno vettoriale; riduzione dei colori di un'immagine per
l'autotrace; **font TrueType convertiti in punti**; **380 motivi di sottopunto e 380 di bordo e di
riempimento**; **applicazioni automatiche**, degradé, 3D; **paillettes** singole e multiple, **perline**
singole e doppie, immagini convertite in paillettes e perline; una libreria dei disegni in rete; e le
edizioni separate per **strass** e per il **laser** (Laser Design). GMI lo dichiara «compatibile con
qualsiasi macchina da ricamo».

Quindi alcune righe del §2 che per la suite sono ❌ (applicazioni P8, sottopunti Q2, font L3, paillettes
P10) **in Stilista ci sono già**: lì si può solo pareggiare. Quali di queste RG usa davvero non è scritto
nel repo (domande al §8.4). Se RG usa strass o perline, il perimetro dell'MVP cresce.

---

## 3. Quanto esiste già e quanto manca

Ho pesato ogni area in **mesi-persona** che servirebbero a un professionista senza AI per farla al livello
"produzione RG", e ho stimato quanto di quel lavoro la suite ha già. **Tutta la tabella è [stima]**; le
righe "Suite oggi" della sezione 2 sono il [misurato] da cui parte.

| Area | Peso (mesi-persona) | Quanto c'è | Già fatto | Manca |
|---|---|---|---|---|
| File e formati (DST, SVG/DXF, progetto, export DXF) | 4 | 60% | 2,4 | 1,6 |
| Disegno vettoriale e geometria | 5 | 15% | 0,8 | 4,2 |
| Tipi di punto di base (corsa, raso a colonna, tatami, cordoncino, applicazioni) | 8 | 30% | 2,4 | 5,6 |
| Qualità del punto (sottopunti, compensazione, spigoli, profili) | 5 | 15% | 0,8 | 4,2 |
| **Riempimenti speciali RG (i 17 tool)** | 12 | 85% | 10,2 | 1,8 |
| Sequenza, aghi, stop, tagli, fermature, passaggi | 4 | 40% | 1,6 | 2,4 |
| Editor: documento, selezione, trasformazioni, annulla, livelli | 8 | 5% | 0,4 | 7,6 |
| Modifica dei punti a mano | 2 | 5% | 0,1 | 1,9 |
| Simulazione, anteprima, controllo dei difetti | 3 | 35% | 1,1 | 1,9 |
| Laser e teste speciali usate da RG | 3 | 20% | 0,6 | 2,4 |
| Scala con ricalcolo | 1 | 50% | 0,5 | 0,5 |
| Lettering di base (motore + pochi alfabeti) | 3 | 0% | 0 | 3 |
| Produzione (foglio, archivio, tempo e filo) | 2 | 20% | 0,4 | 1,6 |
| Prestazioni (WebGL, calcolo in parallelo) | 3 | 15% | 0,5 | 2,5 |
| Applicazione desktop, installazione, salvataggi sicuri | 2 | 10% | 0,2 | 1,8 |
| Collaudo in produzione e correzioni | 8 | 0% | 0 | 8 |
| **Totale** | **73** | | **~22 (30%)** | **~51** |
| Totale **senza** i 17 tool speciali | 61 | | ~12 (**19%**) | ~49 |

**Cosa vuol dire.**

1. **La suite ha la parte che nessuno ha**, e quella che costa di più a un concorrente: tecniche nate da
   DST di riferimento di Lorenzo, misurate e chiuse da test. Wilcom o Stilista non le hanno come oggetti.
2. **Manca la parte che hanno tutti**: l'editor e i punti di base fatti bene. Non è ricerca, è lavoro
   lungo, e ha un difetto per noi: **è fatto quasi tutto di interazione** (clic, trascinamenti, maniglie,
   annulla), proprio il tipo di lavoro che l'AI scrive bene ma che si collauda solo con le mani e gli
   occhi di Lorenzo.
3. **Il collaudo pesa da solo come l'editor** (8 mesi-persona). Un software che cuce pannelli per un grande marchio
   non può sbagliare un raso: ogni tipo di punto va provato in macchina, su tessuti diversi.

**Il ritmo misurato, per tarare le stime.** In 105 giorni Lorenzo con l'AI ha prodotto ~80.000 righe, 17
tool, il core, il cervello, il Link e il simulatore 3D [misurato]. Secondo la tabella sopra quel lavoro
vale ~22 mesi-persona di un professionista [stima]: **circa 6 volte il ritmo di una persona sola senza
AI**. Non va preso come regola per il resto, per tre ragioni: (a) i tool sono **generatori** con
ingresso e uscita chiari, il terreno migliore per l'AI; l'editor no; (b) una parte del lavoro dei tool
esisteva già in progetti precedenti e è stata migrata (`ARCHITETTURA.md`, «Stato di migrazione»); (c) il
ritmo è stato possibile perché Lorenzo ci ha messo tanto tempo. Nelle stime uso **3–6 volte** per i
generatori e **2–3 volte** per l'editor.

---

## 4. L'assistenza AI: dove serve davvero

Separo tre cose: **c'è già** (nel repo o nei concorrenti), **realistico oggi** (si costruisce con
strumenti che esistono), **ancora ricerca** (nessuno lo fa bene; può non riuscire).

### 4.1 I momenti del lavoro di un digitalizzatore

| Momento | Cosa farebbe l'AI | Stato | Note |
|---|---|---|---|
| **Dalla foto o dal disegno al ricamo** | segmentare la foto in zone, proporre oggetti e tipi di punto | 🟡 **c'è** la parte senza AI: quantizzazione, regioni, riempimento (broccato, pittorico, interlace, bitmap). **Realistico oggi**: un modello di segmentazione per le zone; dare il **tipo di punto per forma** (stretta → raso, larga → tatami, linea → corsa) con regole. **Ricerca**: un risultato che un digitalizzatore usa senza rifarlo (angoli, sottopunti, ordine come li sceglierebbe Lorenzo) | il *Punto pittorico* è stato **fermato** perché non era al livello del DST fatto a mano (`sapere/tool/pittorico.md`). È la misura onesta di quanto è difficile |
| **Dal vettoriale al ricamo** (auto-digitalizzazione di un SVG pulito) | assegnare tipi di punto, angoli, ordine | **c'è nei concorrenti**, con regole e senza AI: *autopunch* di Stilista 3.3, *Instant Smart Design* di Wilcom (§9). **Realistico per noi** con regole + un agente che prova | la qualità dipende dal raso a colonna (P2) |
| **La scelta dei parametri** | dato un brief, scegliere tool e valori, provarli, consegnare un progetto da aprire | **realistico oggi**: è la fase **K8** già disegnata (`AVVIO-CERVELLO-RICAMO.md` §5b): il registro (K1), il contratto `Motore` (K1b), la busta (K2) e il referto (K3) **ci sono già**; mancano il banco senza interfaccia (K7) e l'agente | ★ qui la suite è avanti: i pezzi per un agente che **prova invece di indovinare** sono già nel repo |
| **Il controllo dei difetti prima della macchina** | trovare punti corti, salti, accumuli, fili a vista, passaggi sopra il ricamo appena fatto, e **spiegarli** | **c'è** la misura (referto); **realistico oggi**: le regole come test (R3, R5, R16, tetto densità) + un modello che scrive la spiegazione e propone la correzione | è la funzione AI col **miglior rapporto fra utilità e rischio**: sbaglia al massimo un avviso, non un ricamo |
| **Le domande in linguaggio naturale** | *«quanti punti fa l'ago 3?»*, *«perché qui c'è un salto?»*, *«questo parametro c'è in un altro tool?»*, *«come abbiamo deciso la densità dell'interlace?»* | **realistico oggi**: le risposte stanno nel referto, nel registro e in `sapere/` | serve che il sapere resti scritto con le date e i perché, come oggi |
| **Imparare dallo stile di Lorenzo** | da centinaia di suoi DST, imparare come sceglie angoli, ordine, densità | **ricerca** | servono molti esempi accoppiati (disegno → DST), e i file dei clienti **non vanno nel repo**: andrebbero tenuti in locale |
| **Prevedere il tessuto** (arricciatura, ritiro) | simulare il tiro per calcolare la compensazione | **ricerca**, con un inizio vero: `ricamo-3d` (cucitura, garza, assestamento dei fili, in Python) | ★ potrebbe diventare una cosa che **nessun concorrente** ha |
| **Giudicare a occhio un'anteprima** | guardare il render e dire «questo raso è brutto» | **non affidabile oggi** per i dettagli fini | STATO §4: la verifica visiva automatica non è stata possibile; si usano i numeri al suo posto |

**Cosa fanno gli altri con l'AI, oggi** [fonte, §9]:

- **Wilcom** (EmbroideryStudio 2026 e Hatch 4) chiama "AI" una cosa sola: *Answers*, un assistente che
  risponde sulle domande del manuale. **Non genera punti.** La sua auto-digitalizzazione (anche da foto)
  è fatta di regole, e il suo stesso manuale avverte che il risultato dipende molto dall'immagine.
- **Stilista 3.3** ha autotrace e autopunch, e non li chiama AI.
- **Servizi web nuovi** (Figitize, EmbroidAI) promettono il DST da un'immagine per pochi dollari, con
  raso, tatami e sottopunti; tutti e due consigliano comunque una prova in macchina, e uno dice che per
  le foto complesse serve ancora un digitalizzatore. Nessuno tratta teste speciali o multi-testa.
- **La ricerca universitaria** genera quasi sempre **immagini** "che sembrano ricamo", non file macchina.
  Non risulta nessun lavoro che produca con il deep learning un DST pronto per la produzione
  industriale.

**La conclusione onesta:** oggi la "digitalizzazione con l'AI" è fatta di regole più marketing. Un
software nostro **non partirebbe in svantaggio** su questo punto, e avrebbe un vantaggio vero dove gli
altri non sono: un agente che conosce le decisioni scritte di un digitalizzatore esperto e che **prova**
i parametri sui motori invece di indovinarli (K7–K8).

### 4.2 Due regole per l'AI, prese dal modo in cui Lorenzo già lavora

1. **L'AI propone, Lorenzo decide.** È già scritto: il cervello *«non decide la resa. La resa la giudica
   Lorenzo guardando il ricamo»* (`AVVIO-CERVELLO-RICAMO.md` §2). Ogni proposta deve arrivare come
   progetto che si apre e si corregge, mai come DST finito da mandare in macchina.
2. **I file dei clienti restano in casa.** Un'AI che gira in un servizio esterno riceve i disegni. Per i
   pannelli di grandi clienti va deciso cosa può uscire (solo misure e parametri? anche i contorni?), e
   meglio scriverlo prima. Le funzioni del §4.1 che usano solo **numeri** (referto, parametri, domande sul
   sapere) non hanno questo problema.

---

## 5. Cosa migliorare rispetto a Stilista

### 5.1 Quello che Lorenzo ha detto (le sue parole)

Va detto subito, perché è importante per la decisione: **nei documenti non c'è nessuna lamentela diretta
contro Stilista** [misurato: cercato in `sapere/`, `STATO.md`, `MANUALE.md`, `CONDUZIONE*.md`,
`AVVIO-*.md`, README del Link]. Stilista compare in tre ruoli: il posto dove il lavoro arriva e torna;
**il metro di paragone** (i riferimenti sono *«quasi sempre un DST fatto in Stilista»*,
`sapere/riferimenti/LEGGIMI.md`); e il posto dove resta il lavoro a mano (i rasi di *Rete 45°* escono come
*«forme da riempire a mano su Stilista»*, STATO A4). E una volta Lorenzo ha giudicato Stilista
**migliore** del tool:

> *«la divisione e i passaggi mi sembrano più precisi di quelli che il sistema crea. Soprattutto i
> passaggi sono vicino al bordo e ridotti al minimo»* — `sapere/tool/pattern-macchie.md`, 2026-10-26

I miglioramenti, quindi, si leggono da **quello che Lorenzo chiede ai tool di fare al posto di Stilista**:

| Tema | Le sue parole | Dove | Cosa vorrebbe dire in un software nostro |
|---|---|---|---|
| **Tecniche che Stilista non ha** | *«partendo da un dxf crea un intreccio a rete con impunture con punti parametrizzati»*; *«una borsa a rete che una volta uscita dalla macchina da ricamo è già una sacca autonoma»* | `sapere/tool/rete-testa-speciale.md` (2026-10-15) | i 17 tool come tipi di oggetto nativi, non come file esterni |
| **Lavorare un oggetto di Stilista con un tool** | *«se io da Stilista selezionassi un oggetto e quindi un'area, e poi gli dico lavoriamolo con questo tool […] e poi invio la lavorazione dentro Stilista. Un vero plugin, ma esterno, che non appesantisca Stilista»* | `stilista-link/README.md` (2026-10-20) | nessun ponte: l'oggetto e il tool stanno nello stesso documento |
| **Il ritorno al suo posto** | *«ora fai tornare il ricamo nello stesso documento, al suo posto»* | STATO (2026-10-20) | — idem |
| **Salti e passaggi** | *«Vanno assolutamente ridotti di tantissimo i salti. […] ridurre la lunghezza dei salti è importante»*; *«non possiamo permetterci i salti»* | `pattern-macchie.md` (2026-10-28); STATO, striatura | il routing coperto (R16–R21) per **tutti** gli oggetti, anche fra oggetti diversi |
| **Il passaggio sotto il ricamo appena fatto** | *«quel filo si incastrerà sicuramente sotto il ricamo; questo è da evitare, conviene spostare il punto di ingresso»* | `pattern-macchie.md` (2026-10-26) | un controllo automatico (V3) che lo segnala prima della macchina |
| **Tagli per blocchi** | *«cercare di lavorare per blocchi vicini e fare rasafilo solo in blocchi esterni»* | STATO, pettine (2026-09-10) | regole di taglio scelte per tecnica |
| **Il filo e la macchina** | *«ci sono dei punti in cui la densità di filo è molto alta […] rischio di far rompere il filo e lavorare male la macchina»*; *«troppi punti corti e tanti che rischiano di non lavorare bene con fili più spessi»*; *«il filo ribattendo dove c'è altro filo lavora male»* | STATO, interlace; `pattern-macchie.md` (2026-10-26, 2026-10-29) | tetto alla densità, punto minimo per filo, controllo dei "fili sopra fili" |
| **I registri fra stop** | *«devo essere sicuro che lo stop 3 combaci con lo stop 2 e se poi ritira è un casino»* | `pattern-macchie.md` (2026-10-26) | compensazione e registro calcolati sull'insieme, non oggetto per oggetto |
| **Programmi che restano modificabili** | *«vorrei poter caricare in pattern un dst e che quindi si rigenerasse il programma»*; *«è possibile creare dei DST rileggibili e rimodificabili?»* | STATO (2026-10-07; pattern a zone) | il file macchina porta il progetto; in Stilista invece un ricamo fatto fuori entra come `Manual` e **un ricalcolo lo distrugge** (`stilista-oggetto-manuale.md`: 773 → 2 punti) |
| **Blocchi separati ma in fila** | *«è possibile mantenere separati i blocchi e i passaggi ma lasciando tutto in sequenza? ora è un'unica linea»* | STATO, pattern a zone | il documento a oggetti con la sequenza (X1 + S1) |
| **Automatico, ma correggibile** | *«fasce automatiche ma dammi un modo per modificarle»*; *«gestire i passaggi, modificandoli a mano dove passano dove necessario e cambiarli anche in salti quando serve»*; *«posso eliminare dei punti se voglio, e anche decidere inizio e fine»* | `cross-stitch-fair-isle-strisce.md` (2026-10-02); `punto-maglia-cordoncino.md` | M4: la correzione a mano è un **dato** che sopravvive al ricalcolo |
| **Le misure che cambiano** | *«se cambio le misure a partire da un modulo i passaggi si rovinano nel finale e cambiano, quando in realtà dovrebbero rimanere uguali»* | `cross-stitch-fair-isle-strisce.md` (2026-10-02) | scala con ricalcolo che tiene la struttura (T1) |
| **Aree di scarico per il montaggio** | *«mi chiedono sempre più spesso di scaricare i punti in determinate aree»* | `sapere/decisioni/aree-di-scarico.md` (2026-09-14) | aree di scarico come proprietà del documento, per tutti gli oggetti (S7) |
| **Pannelli grandi** | *«in un pannello grande da 400000 punti generati fa davvero fatica»* | `pattern-macchie.md` (2026-10-27) | X2: disegno su scheda grafica, calcolo in parallelo |
| **Vedere l'ago** | *«un sequenzatore di punti, un simulatore del ricamo che fa vedere come si muove l'ago […] con controlli su quanto andare avanti e velocità»* — poi *«lo vorrei ovunque»* | STATO (2026-09-10) | V2 in tutto il software |
| **Tutto uguale fra i tool** | *«vorrei anche che a livello estetico e di interfaccia tutto sia simile tra i vari tools»* | `AVVIO-INTERFACCIA-COMUNE.md` (2026-10-13) | un'interfaccia sola |
| **Qualcosa che non esiste** | *«cosa potremmo sviluppare che non esiste, da proporre a clienti nuovi?»* | `AVVIO-CERVELLO-RICAMO.md` (2026-10-13) | le tecniche + il cervello sono quella cosa |

### 5.2 Quello che si è misurato dentro Stilista

Questi non sono giudizi di Lorenzo: sono fatti misurati col Link mentre si costruiva il collegamento
(`sapere/codice/stilista-*.md`, `strumenti-sviluppo/stilista-link/README.md`). Dicono **dove Stilista
è scomodo da estendere**, cioè il costo nascosto della strada "continuare col Link".

| Fatto misurato | Dove | Cosa ci dice |
|---|---|---|
| Nessuna API pubblica: il plugin chiama per riflessione tipi interni (`OldPoints2StitchPath`, `MergeToManualStitch`, `LockRecalc`…); il colore di un laser sta in un campo **dal nome offuscato** | `stilista-oggetto-manuale.md`, `stilista-colore-laser.md` | un aggiornamento di Stilista può rompere il Link senza avviso |
| Il comportamento si è capito leggendo `Emg2_IO` col disassemblatore | STATO, Link (2026-10-28) | il Link vive di reverse engineering |
| **Ogni ricalcolo ripercorre il contorno**: 773 punti → 2, 346 o 251; Stilista ricalcola anche da solo (a 0,3, 6,9 e 11 s) | `stilista-oggetto-manuale.md` | ci vuole una «sentinella» che rimette i punti ogni secondo |
| Un modello copiato da un laser trasforma i punti in tagli laser (`TotalStitches` = 0) | idem (2026-10-28) | trappole silenziose |
| `GMIPathTAGGED.Strokes()` ha bloccato l'interfaccia di Stilista **oltre 4 minuti** sul pezzo D; la lettura punto per punto costa decine di µs a punto | `stilista-fori.md` | i pannelli grandi pesano anche lì |
| Un processo per documento, più riserve già avviate che tengono il plugin vecchio | `stilista-un-processo-per-documento.md` | aggiornare il plugin vuol dire chiudere tutto Stilista |
| 84 riempimenti nativi creati in **72 s**, simulando i clic | STATO, Link | creare oggetti nativi da fuori è lento |
| Mancano ancora: l'annulla del ritorno, la posizione nella sequenza (l'oggetto va in fondo), i fori al ritorno degli oggetti nativi | `stilista-link/README.md` | il Link non sarà mai "dentro" quanto un oggetto nativo |

**In breve:** Stilista non è "fatto male". È un software chiuso, pensato per il suo modo di lavorare, e
ogni cosa nuova che Lorenzo vuole **ci entra di lato**. Un software nostro farebbe meglio non perché
Stilista sbaglia, ma perché **le cose che Lorenzo chiede più spesso sono proprio quelle per cui Stilista
non ha posto**: tecniche nuove come oggetti, passaggi coperti fra oggetti, correzioni a mano che
sopravvivono, file che si riaprono, controlli prima della macchina, un cervello che sa.

---

## 6. Architettura e scelte tecniche

### 6.1 Browser o desktop

| | Solo browser (come oggi) | Desktop con dentro la stessa suite (Tauri o Electron) | Desktop nativo (C++/C#) |
|---|---|---|---|
| Riuso del codice di oggi | tutto | **tutto** | quasi niente (si riscrivono 80.000 righe) |
| File, cartelle, chiavette USB | con la finestra di sistema a ogni salvataggio (R29) | libero | libero |
| Collegamento alle macchine (rete, seriale) | molto limitato | sì | sì |
| Lavoro senza internet, file dei clienti in casa | sì, se la pagina è salvata | sì | sì |
| Prestazioni | buone con WebGL e Worker; memoria limitata per scheda | uguali + calcoli pesanti in un processo nativo | le migliori |
| Aggiornamenti | automatici | automatici con un aggiornatore | installer |

**Scelta consigliata [stima]: desktop che porta dentro la suite** (Tauri ha un eseguibile piccolo e un
lato nativo in Rust; Electron è più pesante ma più semplice). Il codice dei tool, del core e del cervello
resta **TypeScript e uguale**; il guscio desktop dà file, chiavette, rete e macchine. Il browser resta
come versione di prova e per far vedere il lavoro.

### 6.2 Il motore geometrico

- **Tenere il core TypeScript** (`packages/core`): è testato e i tool ci stanno sopra.
- **Le operazioni sulle forme generali** (unione, sottrazione, offset robusti, G2) non vanno riscritte a
  mano: si prende una libreria seria. **Clipper2** (licenza Boost, permissiva) esiste in TypeScript e in
  WebAssembly [stima: da verificare la versione TS].
- **I calcoli pesanti** (routing coperto su pannelli grandi, raso a colonna su forme complesse) si
  spostano in un **Worker** sempre, e dove serve in **WebAssembly** (Rust o C++). Il contratto `Motore`
  dice già che il motore non tocca il DOM: è pronto per girare fuori dalla pagina.

### 6.3 Le prestazioni sui pannelli grandi

Oggi [misurato, STATO §1]: il pannello di prova da **392.000 punti** del *Pattern a macchie* è sceso da 35 s
a 9 s di calcolo, e l'anteprima da 16.600 elementi SVG a 8 (un tracciato per filo). Lo zoom sul pannello
grande non è misurato.

Per un editor serve di più [stima]:

1. **Disegno su scheda grafica (WebGL2, poi WebGPU)**: i punti come un'unica geometria, un solo comando
   di disegno per filo. Due milioni di segmenti in WebGL sono normali; in SVG no.
2. **Ricalcolo solo di quello che cambia**: ogni oggetto tiene in memoria i suoi punti; si ricalcola solo
   l'oggetto toccato e i passaggi di chi gli sta accanto.
3. **Indice spaziale** (una griglia o un albero) per trovare "cosa c'è sotto il mouse" e "cosa copre
   cosa" senza scorrere tutti i punti.
4. **Obiettivo misurabile**: pannello da 1.000.000 di punti, zoom e pan a 60 immagini al secondo,
   modifica di un oggetto sotto il mezzo secondo. Va scritto come test fin dal primo giorno (regola 8 di
   ARCHITETTURA).

### 6.4 I formati macchina proprietari

- **DST** è già fatto ed è il formato che Lorenzo usa. Basta per le macchine compatibili Tajima.
- **Gli altri formati** [fonte §9]: **nessun costruttore pubblica le specifiche**. Tutto quello che si
  sa viene da chi li ha decodificati: pyembroidery (MIT) scrive PES, DST, EXP, JEF, VP3, U01, TBF e ne
  legge una quarantina; Ink/Stitch legge anche DSB, DSZ, TAP e ZHS. Si leggono come documentazione e si
  riscrivono in TypeScript, uno alla volta, solo quelli che servono.
- **TBF** (Tajima) porta l'indirizzo degli aghi e serve per le paillettes doppie e per ciniglia + ricamo:
  nel DST queste informazioni non ci stanno [fonte §9].
- **I comandi delle teste speciali** sono la parte più incerta. Esempio misurato da Wilcom: per le
  paillettes Tajima segue la specifica DST alla lettera (un salto per ogni caduta), Dahao usa più salti per
  le paillettes A/B. **Lo stesso file, due macchine, due significati.** Per il cordonetto e il laser come
  comandi nel file non si è trovata nessuna specifica pubblica. **Quali macchine e teste ha RG non è
  scritto nel repo**: è la prima domanda da fare (§8.4). Senza la macchina vera per provare, questa parte
  non si chiude.
- **Il collegamento in rete alle macchine** (Tajima LAN, Happy LAN, ZSK) usa protocolli non documentati.
  La **chiavetta USB** col file macchina funziona sempre ed è il punto di partenza giusto.

### 6.5 Le licenze

- **Ink/Stitch è GPL-3.0** [fonte §9]: si può studiare, ma il suo codice non può entrare in un prodotto
  chiuso da vendere. Per un software solo per RG (non distribuito) il vincolo pratico è minore, ma meglio
  non mescolare fin dall'inizio.
- **pyembroidery e pystitch sono MIT, libembroidery è zlib** [fonte §9]: permissive, si possono usare (o
  riscrivere) anche in un prodotto chiuso, citandole.
- **Clipper2** (geometria) è Boost, permissiva.
- **I font**: un font da ricamo è un disegno digitalizzato con la sua licenza; un font del computer
  convertito in punti può avere limiti d'uso commerciale. Per vendere, serve una libreria di alfabeti
  propri.
- **Di chi è il codice.** Oggi il codice è scritto da Lorenzo con l'AI, nel suo repo. Se è di Lorenzo o di
  RG, e cosa dicono i termini del servizio AI, **non l'ho verificato**: va scritto chiaro prima di
  coinvolgere altre persone, un socio o di vendere.

---

## 7. Costi e tempi

### 7.1 Le ipotesi, in chiaro

| Ipotesi | Valore usato | Tipo |
|---|---|---|
| Lavoro che manca per l'MVP RG (§3) | ~51 mesi-persona di un professionista senza AI | [stima] |
| Ritmo di Lorenzo con l'AI, al suo impegno di oggi | ~6 mesi-persona di lavoro per mese di calendario sui generatori (misurato sui 105 giorni, §3); **~3** sul lavoro da editor | [stima tarata sul misurato] |
| Moltiplicatore dell'AI per uno sviluppatore professionista | 2–3× | [stima] |
| Tempo di Lorenzo sul progetto | 50% nello scenario A e C, 30% nello scenario B | [ipotesi: da confermare con Lorenzo] |
| Costo aziendale di Lorenzo | 45–55 mila euro l'anno (≈ 4.200 al mese) | [ipotesi: non è scritto da nessuna parte] |
| Costo aziendale di uno sviluppatore senior in Italia | **60–70 mila euro l'anno** (≈ 5.400 al mese): RAL mediana 43–48 mila (Payscale, Levels.fyi, Indeed, Jooble) + 35–50% di contributi e TFR | [fonte per la RAL; il passaggio a costo azienda è una stima, da confermare con un consulente del lavoro] |
| Freelance in Italia | ~350 euro al giorno un programmatore, ~480 un capoprogetto (Assintel 2025) → 75–100 mila l'anno a tempo pieno | [fonte] |
| Abbonamento AI per persona | Claude Max: 100 o 200 dollari al mese (≈ 95–190 euro), IVA esclusa | [fonte] |
| Prove in macchina (ore macchina, tessuti, filo) | 5–10 mila euro per l'MVP | [stima] |
| L'MVP RG **non comprende**: altri formati oltre il DST (salvo quelli delle macchine di RG), una libreria di font, la rete delle macchine, licenze e protezione, più lingue | | [ipotesi] |

### 7.2 I quattro scenari

**A. MVP per RG, Lorenzo con l'AI, come oggi.**

| | |
|---|---|
| Cosa | tutto il §3 che manca: editor, raso a colonna e tatami di qualità, sottopunti, compensazione, sequenza, modifica dei punti, laser, simulazione, foglio di produzione, guscio desktop; i 17 tool diventano tipi di oggetto |
| Persone | Lorenzo al 50% + Claude (2 abbonamenti, uno di riserva) |
| Tempo [stima] | **15–24 mesi**. Conto: ~43 mesi-persona di sviluppo a ~3 al mese ≈ 14 mesi, più il collaudo (8 mesi-persona, quasi tutto tempo di Lorenzo in macchina, che l'AI non accorcia) |
| Costo [stima] | tempo di Lorenzo 50% × 20 mesi × 4.200 ≈ **42 mila**; AI ≈ **3–5 mila**; prove in macchina **5–10 mila**. Totale **45–75 mila euro** |
| Il costo vero | **le pratiche che Lorenzo non digitalizza** per un anno e mezzo. Va pesato contro il fatturato che porta a RG |
| Rischio principale | tutto in una persona sola (§8.1); l'editor è il lavoro dove l'AI rende meno |

**B. MVP per RG, piccolo team.**

| | |
|---|---|
| Cosa | come A |
| Persone | 2 sviluppatori senior (uno forte in geometria e grafica, uno in interfacce) + Lorenzo al 30% come esperto e collaudatore + AI per tutti |
| Tempo [stima] | **12–18 mesi**: 2 mesi per imparare il dominio (Costituzione, `sapere/`, i tool), ~10 di sviluppo (51 mesi-persona ÷ 2 persone ÷ 2,5 dell'AI), il collaudo in parallelo |
| Costo [stima] | sviluppatori 2 × 65 mila × 1,25 anni ≈ **160 mila**; Lorenzo 30% × 15 mesi ≈ **19 mila**; AI **5–7 mila**; prove e materiali **10 mila**; PC e strumenti **5 mila**. Totale **180–260 mila euro**. Con due freelance invece di due assunti: **+20–30%**, ma si ferma quando si vuole |
| Vantaggio | il software ha due persone che lo conoscono oltre a Lorenzo |
| Rischio principale | trovare due persone brave in Umbria o da remoto; il dominio si impara lentamente |

**C. Il Compositore: metà strada, Stilista resta.**

| | |
|---|---|
| Cosa | **un documento con più oggetti dentro la suite**: si importano i DST (anche di Stilista) e gli oggetti dal Link, si aggiungono gli oggetti dei tool, si mettono in fila; aghi, stop, tagli, fermature, aree di scarico; passaggi coperti **fra** oggetti; spostare, ruotare, scalare, annullare; simulatore e controllo dei difetti per tutto; foglio di produzione; anteprima su scheda grafica; export DST. **Non** comprende: disegno vettoriale completo, raso a colonna a mano, lettering, modifica fine dei punti: quelli restano in Stilista |
| Persone | Lorenzo + AI, oppure 1 sviluppatore + Lorenzo |
| Tempo [stima] | ~15 mesi-persona → **5–9 mesi** con Lorenzo e l'AI; **8–10 mesi** con 1 sviluppatore |
| Costo [stima] | Lorenzo + AI: **15–30 mila** (quasi tutto il suo tempo). Con 1 sviluppatore: **55–80 mila** |
| Perché conta | è il **cuore** di A e B (documento X1, sequenza S1, simulazione, controllo): nessuna riga si butta. Ed è utile dal primo mese anche con Stilista accanto |

**D. Un prodotto da vendere.**

| | |
|---|---|
| Cosa in più rispetto all'MVP | gli altri formati (~4 mesi-persona), lettering completo e una **libreria di alfabeti propri** (~25), la rete delle macchine (~6), più lingue e documentazione (~4), licenze, protezione, aggiornamenti (~3), prove su molte macchine e tessuti (~12), Mac (con il guscio desktop costa poco). In tutto **~110 mesi-persona** prima di vendere |
| Persone | 5–7 (sviluppo, collaudo, supporto, vendita) + Lorenzo |
| Tempo [stima] | **3–4 anni** per un prodotto che regge il confronto in fiera |
| Costo [stima] | sviluppo 15–21 anni-persona × 65 mila ≈ **1,0–1,4 milioni**; vendita, fiere, distributori, legale **0,3–0,6 milioni**; totale **1,5–2,5 milioni** prima di guadagnare. Poi supporto e sviluppo continuo **0,4–0,7 milioni l'anno** |
| Il conto dei ricavi [stima] | a 3.000–5.000 euro a licenza (fascia Wilcom Designing, §9), per pagare **solo** i 0,5 milioni l'anno di mantenimento servono **100–170 licenze nuove o aggiornamenti ogni anno**, contro Wilcom (dal 1979, «oltre 250.000 clienti» dichiarati), Tajima/Pulse, ZSK col suo software, e Stilista stessa in Italia |
| Dove potrebbe vincere | non come "un altro Wilcom", ma come **software di nicchia** per le tecniche speciali del lusso (le 17 dei tool) e per il cervello. Questo però si può vendere anche **senza** rifare un CAD intero: come servizio, o come plugin |

### 7.3 Cosa si sa e cosa si stima

| Si sa (misurato o con fonte) | Si stima |
|---|---|
| 80.000 righe, 17 tool, 419 commit in 105 giorni | il valore in mesi-persona di quel lavoro (~22) |
| cosa c'è e cosa no, funzione per funzione (§2) | quanto pesa ciò che manca (§3) |
| cosa Stilista 3.3 dichiara di fare (brochure, §9) | quali di quelle funzioni RG usa davvero |
| i prezzi pubblici dei concorrenti e dell'AI (§9) | il moltiplicatore dell'AI sull'editor |
| le RAL in Italia (§9) | il costo azienda di uno sviluppatore e di Lorenzo |
| i limiti di Stilista misurati col Link (§5.2) | quanto durerà Stilista 3.3 e il suo supporto |
| che nessun costruttore pubblica le specifiche dei formati (§9) | quanto costa far funzionare le teste speciali di RG |

---

## 8. Rischi, alternative e raccomandazione

### 8.1 I rischi

| Rischio | Quanto pesa | Cosa si può fare |
|---|---|---|
| **Una persona sola.** Tutto il sapere di mestiere è di Lorenzo; tutto il codice è scritto con un'AI di un fornitore solo | alto in A e C | il sapere è già scritto in `sapere/` e nei test, ed è il miglior antidoto; tenere il codice leggibile; in B una seconda e terza persona |
| **Il raso a colonna non arriva al livello di Stilista.** È successo col *Punto pittorico*: fermato perché non era al livello del DST fatto a mano | alto | non promettere il sostituto prima di averlo provato: lo scenario C non ne ha bisogno |
| **Le macchine e le teste speciali.** Nessuna specifica pubblica; lo stesso file vale cose diverse su macchine diverse (§6.4) | alto per laser e paillettes, basso per il ricamo normale in DST | partire da quello che si vede sulla macchina di RG, un comando alla volta, con un file di prova per ogni comando |
| **La certificazione.** Non si è trovato nessun obbligo dei costruttori per un software che scrive file macchina (§9); la rete delle macchine invece usa protocolli chiusi | basso per il file su chiavetta, alto per la rete | chiavetta USB e cartella di rete; la rete delle macchine solo se serve davvero |
| **La manutenzione.** Un CAD non è mai finito: nuovi Windows, nuove schede grafiche, nuovi formati, i difetti trovati in produzione | medio–alto | i test (regola 8 di ARCHITETTURA) e il contratto `Motore` riducono il costo; ma va messo in conto **sempre**, anche dopo |
| **Il tempo di Lorenzo.** Ogni scenario lo consuma | alto | lo scenario C ne consuma meno e dà subito qualcosa |
| **I dati dei clienti** e l'AI esterna | medio | decidere prima cosa esce (§4.2) |
| **Stilista cambia o finisce.** Il Link vive di riflessione su campi interni e offuscati (§5.2): un aggiornamento può romperlo | medio | è il motivo per tenere i tool **indipendenti** da Stilista (lo sono già: SVG/DXF/DST) e per costruire il Compositore |

### 8.2 L'alternativa: continuare con Stilista, il Link e i tool

| | Continuare col Link | Rifare tutto (A/B) | Compositore (C), poi decidere |
|---|---|---|---|
| Costo nei prossimi 12 mesi | il più basso | il più alto | basso |
| Utile da subito | sì (lo è già) | no, fra 12–24 mesi | sì, dopo 2–3 mesi |
| Dipendenza da Stilista | totale, e il Link è fragile (riflessione, ricalcoli, sentinella) | nessuna | meno: Stilista diventa "l'editor dei rasi e delle scritte" |
| Le richieste di Lorenzo (§5.1) | metà: tecniche sì, ma il ritorno è sempre "di lato" (annulla, posto nella sequenza, fori) | tutte, alla fine | la maggior parte: sequenza, passaggi fra oggetti, controllo, simulatore, file riapribili |
| Rischio | basso oggi, cresce se Stilista cambia | alto | basso |
| Cosa resta in mano a RG | i tool | un software intero | i tool + il cuore di un software |

Continuare col Link **ha senso e va fatto comunque**: è quello che Lorenzo ha chiesto (*«un vero plugin, ma
esterno, che non appesantisca Stilista»*) e funziona. Il suo limite è che **non può diventare più di un
ponte**.

### 8.3 La raccomandazione

**Non costruire adesso un sostituto completo di Stilista. Costruire il Compositore (scenario C), e
decidere dopo con i numeri in mano.**

Perché:

1. **Le cose che Lorenzo chiede di più** (salti e passaggi fra oggetti, sequenza in blocchi, controllo
   prima della macchina, simulatore ovunque, file che si riaprono) **stanno tutte nel Compositore**, non
   nel raso a colonna o nel lettering.
2. **Il Compositore non si butta**: è il documento, la sequenza e la simulazione di qualunque software
   futuro. Se poi si va avanti, A o B partono da lì.
3. **Tiene Stilista per quello in cui è bravo** (l'editor, i rasi a mano, le scritte, le funzioni del
   §2.12) e lo usa come fornitore di oggetti attraverso il Link, che già c'è.
4. **Costa poco e si vede presto**: 5–9 mesi, 15–30 mila euro di tempo di Lorenzo [stima].
5. **Il prodotto da vendere è un'altra impresa** (milioni, anni, una squadra, un mercato con Wilcom
   dentro): non è una decisione da prendere dentro uno studio tecnico. Se un giorno si vuole vendere,
   la cosa più vendibile sono **le tecniche e il cervello**, non un CAD in più.

**Le tappe, ognuna con la sua prova.**

| Tappa | Cosa | Quando [stima] | Si va avanti se… |
|---|---|---|---|
| **0** | Finire quello che è già aperto e serve a tutto: il banco senza interfaccia e l'agente (K7–K8), il simulatore in tutti i tool, il referto in ogni tool | 1–2 mesi | — |
| **1** | Il Compositore: documento, sequenza, aghi/stop/tagli, passaggi fra oggetti, controllo, foglio di produzione, anteprima WebGL, export DST; import da DST e dal Link | +4–6 mesi | Lorenzo chiude **almeno un pannello vero su tre** nel Compositore e lo manda in macchina senza ritocchi in Stilista |
| **2** | Il raso a colonna e il tatami "di produzione" con sottopunti e compensazione, la modifica dei punti | +4–8 mesi | in una prova alla cieca, Lorenzo non distingue (o preferisce) i rasi nostri da quelli di Stilista, su 10 pezzi diversi |
| **3** | Disegno vettoriale, lettering di base, laser e teste speciali di RG, guscio desktop | +6–10 mesi | a quel punto è l'MVP: si decide se staccare Stilista |

Ogni tappa è **utile da sola**: se ci si ferma dopo la 1, RG ha comunque un Compositore che Stilista non
ha.

### 8.4 Le domande per Lorenzo

Le risposte cambiano i numeri, non la raccomandazione:

1. **Che macchine ha RG** (marca, modelli, numero di teste) e **quali teste speciali** (laser, paillettes,
   cordonetto, ciniglia)? In che formato lavorano oggi: solo DST?
2. **Quali funzioni di Stilista usi ogni settimana**, e quali mai? (lettering, applicazioni, strass,
   paillettes, perline, autopunch…)
3. **Quanto tempo potresti dare** a un progetto così, per mesi: un giorno a settimana? metà?
4. **È per RG o anche da vendere?** E se da vendere: a chi (laboratori come RG, i marchi del lusso)?
5. **Quante persone** lo userebbero in RG?
6. Cosa può uscire verso un'AI esterna dei file dei clienti?

---

## 9. Mercato, concorrenti, fonti

Ricerca fatta il **2026-10-29**. **[V]** = letto sulla pagina; **[S]** = da un rivenditore o da una fonte
secondaria, da prendere con cautela. I prezzi in dollari sono quelli pubblicati, senza conversione.

### 9.1 I concorrenti

| Software | Chi | Prezzo pubblico | Note |
|---|---|---|---|
| **GMI Stilista 3.3** | GMI srl, Vittorio Veneto (TV), dal 1980 [V] | **non pubblicato** | edizioni ricamo, strass, misto, Laser Design; autotrace/autopunch, TrueType, 380 sottopunti, applicazioni, paillettes e perline [V, brochure 2023] |
| **Wilcom EmbroideryStudio 2026** | Wilcom, Sydney, dal 1979; dichiara oltre 250.000 clienti [S] | Designing **4.000 $**, Decorating 2.000 $, Editing 1.300 $, Lettering 1.000 $ (perpetue, Wilcom America) [V]; abbonamento Designing ~124 $/mese [S] | solo Windows; dal 2025 senza chiavetta; "Answers" (assistente AI sul manuale); compensazione del tiro per lato [V] |
| **Hatch 4** (Wilcom) | | Composer 699 $, Digitizer 1.199 $ [V] | fascia semi-professionale; auto-digitalizzazione da foto |
| **Tajima DG/ML by Pulse (DG17)** | Tajima ha comprato Pulse nel 2022 [V/S] | Maestro ~12.980 CAD, Creator ~3.740 CAD [S, un rivenditore] | listino ufficiale non trovato |
| **ZSK EPCwin / BasePac 10** | ZSK | non pubblicato | comandi per le teste W e K, paillettes doppie, export .z00 in rete [V] |
| **Embird** | | base 149 $, moduli a parte [V/S] | Windows |
| **Brother PE-Design 11** | | 1.500–1.780 $ [S] | fascia domestica |
| **Ricoma Chroma** | | ~999–2.799 CAD/anno; EU Inspire 999 € [S] | auto-digitalizzazione |
| **Embrilliance StitchArtist 3** | | 699 $ [V/S] | Mac e Windows |
| **Ink/Stitch** | libero, GPL-3.0, dal 2016, ~59 contributori, 3.919 commit, v3.3.0 del 2026-07-31 [V] | gratis | estensione di Inkscape; scrive DST, EXP, JEF, PES, TBF, U01, VP3; legge ~40 formati |

### 9.2 Gli indirizzi

**Stilista e GMI**
- https://www.gmi.it/en/?p=60 — profilo aziendale
- https://www.gmi.it/en/?p=40 — edizioni di Stilista 3
- https://www.gmi.it/en/wp-content/uploads/NEW-WEB-Depliant-Stilista-3.3-en.pdf — brochure 3.3 (giugno 2023)
- https://www.gmi.it/en/?p=1485 — paillettes e perline, Texprocess 2022

**Wilcom e Hatch**
- https://help.wilcom.com/portal/en/kb/articles/purchase-embroiderystudio-licenses — i livelli
- https://wilcom.com/resources/blog/should-i-get-embroiderystudio-2025 — licenze, Windows, senza chiavetta (2025-06-19)
- https://www.wilcomamerica.com/ — listino 2026 in dollari
- https://stitchfast.co.uk/wilcom/price — abbonamento [S]
- https://wilcom.com/resources/blog/10-reasons-to-love-embroiderystudio-2026 — novità 2026 e "Answers" (2025-12-08)
- https://wilcom.com/about-wilcom — l'azienda [S]
- https://docs.wilcom.com/embroiderystudio/e4/en/MainHelp/Automatic/automatic/Automatic_Digitizing.htm — auto-digitalizzazione
- https://docs.wilcom.com/embroiderystudio/e4/en/MainHelp/Automatic/automatic/Auto-digitizing_photographs.htm — da foto
- https://docs.wilcom.com/embroiderystudio/27/en/OnlineHelp/Mixed/sequin_basics/sequin_basics-4.htm — paillettes Tajima e Dahao
- https://docs.wilcom.com/embroiderystudio/e4/fr/MainHelp/Chenille/chenille_output/Chenille_machine_file_encoding.htm — TBF e ciniglia
- https://help.wilcom.com/portal/en/kb/articles/machine-connections — collegamenti alle macchine
- https://hatchembroidery.com/pricing — Hatch

**Altri**
- https://printwearandpromotion.co.uk/tajima-group-acquires-pulse-microsystems/ — Tajima compra Pulse
- https://rbdigital.ca/products/maestro-dg17-tajima-digitizing-software — prezzo DG17 [S]
- https://www.zsk.de/en/software/comparison-basepac-epcwin.php — ZSK
- https://www.embird.net/embird-basic/ — Embird
- https://ricoma.com/products/chroma — Chroma [S]
- https://embrilliance.com/product/stitchartist-level-3 — Embrilliance
- https://sai.tajima.com/en/software/index.html — software Tajima per la rete [S]

**Formati e librerie**
- https://github.com/inkstitch/inkstitch e https://inkstitch.org/docs/file-formats/ — Ink/Stitch
- https://github.com/EmbroidePy/pyembroidery — pyembroidery (MIT)
- https://github.com/inkstitch/pystitch — pystitch (MIT)
- https://github.com/Embroidermodder/libembroidery — libembroidery (zlib)
- https://edutechwiki.unige.ch/en/Embroidery_format — i formati (2019)
- https://community.kde.org/Projects/Liberty/File_Formats/Tajima_Ternary — DST

**AI e ricerca**
- https://figitize.ai/ e https://www.embroidai.com/ — servizi web "AI" (affermazioni dei venditori)
- https://arxiv.org/html/2509.18948v1 — rassegna dei lavori sul ricamo generato (settembre 2025)

**Costi del lavoro e dell'AI**
- https://www.payscale.com/research/IT/Job=Senior_Software_Engineer/Salary/2bc4ab87/C%2B%2B-Programming-Language — mediana 47 mila [S]
- https://www.levels.fyi/t/software-engineer/levels/senior/locations/italy — mediana 48,2 mila (marzo 2026) [S]
- https://it.indeed.com/career/senior-developer/salaries — media 42,7 mila (settembre 2026) [S]
- https://it.jooble.org/salary/senior-developer — 44,5 mila (luglio 2026) [S]; per l'Umbria nessun dato
- https://qonto.com/it/blog/gestione-aziendale/gestione-finanziaria/quanto-costa-un-dipendente — da RAL a costo azienda [S]
- https://pasqualepillitteri.it/news/453/tariffe-freelance-ict-italia — tariffe Assintel 2025 [V]
- https://claude.com/pricing e https://support.claude.com/en/articles/11049741 — Claude Pro e Max

**Non trovato:** il prezzo di Stilista, quanti la usano e quanti lavorano in GMI; i listini ufficiali in
euro di Wilcom, Tajima e Chroma; gli stipendi in Umbria; specifiche ufficiali dei formati e dei protocolli
di rete; obblighi di certificazione dei costruttori di macchine.

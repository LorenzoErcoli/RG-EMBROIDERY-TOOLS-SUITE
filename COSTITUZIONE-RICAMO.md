# Costituzione del Ricamo — Regole, Vocabolario e Parametri Comuni

> Riferimento condiviso per tutti i progetti di generazione pattern per ricamo.
> Estratto dal codice reale di 5 progetti: `rg-oblique-embroidery-pattern-generator`,
> `embroidery-45-grid-generator`, `cross-stitch-grid-embroidery-tool`,
> `pattern-grammar-engine`, `bitmap_to_stitch`.
>
> Questo documento è **stack-agnostic**: vale per i progetti TypeScript/JS e per quelli Python.
> Ogni nuovo progetto parte da qui, anche prima di condividere una riga di codice.

**Versione:** 0.10 · **Aggiornato:** 2026-07-23

---

## 0. Come si usa questo documento

1. **Prima di iniziare un progetto nuovo:** leggi §1 (Regole) e §4 (Pipeline). Sono le lezioni già pagate.
2. **Quando nomini un parametro:** cerca in §3 il nome canonico. Non inventarne uno nuovo per un concetto che esiste già.
3. **Quando implementi I/O:** segui §5 (contratti). L'import→mm e l'export riapribile sono identici ovunque.
4. **Quando qualcosa non torna:** probabilmente stai violando una regola di §1. Sono numerate apposta per citarle nei commit ("fix R3").

Le decisioni architetturali (core condiviso, scaffold) sono in §6.

---

## 1. Regole invarianti

Ogni regola ha un **perché** (da dove viene) e un **come applicarla**. Sono numerate `R1…Rn` — citale nei commit e nelle review.

### R1 — Tutto in millimetri reali. 1 unità SVG = 1 mm. Mai scalare per fittare.
**Perché:** l'oggetto finale è fisico (tessuto, macchina, laser). Ogni progetto lavora già così.
**Come:** nessuna trasformazione "fit-to-canvas". Lo zoom è solo vista. Le coordinate interne sono sempre mm.

### R2 — Normalizza a millimetri UNA sola volta, all'import.
**Perché:** problema affrontato in 4 progetti su 5. Normalizzare più volte introduce errori di scala cumulativi.
**Come:**
- Se il file dichiara `width`/`height` in unità fisiche (`mm`, `cm`, `in`, `pt`, `pc`) → converti in mm (`pt → n·25.4/72`).
- Se mancano le dimensioni fisiche → risolvi con `scaleMode`: **auto** (convenzione Illustrator, vedi R11), **viewBox = mm**, o **dimensione custom**.
- Conserva sul source i metadati di normalizzazione (`unitScaleX/Y`, `normalizationMethod`) per diagnostica.

### R3 — Il min-stitch si applica DOPO connessione e routing, non prima.
**Perché:** lezione esplicita dell'oblique. Le giunzioni create in fase di connessione/routing **reintroducono** micro-segmenti dopo qualsiasi pulizia precedente.
**Come:** pass finale `enforceMinStitch` endpoint-preserving, sull'output già connesso di ogni livello.

### R4 — Il resample suddivide soltanto (spaziatura MAX). Non impone mai il minimo.
**Perché:** confondere le due cose è stato un bug ricorrente. `resampleUniform`/`resampleByArcLength` spezzano segmenti lunghi ma non eliminano quelli corti.
**Come:** due funzioni separate e distinte: `resample*` (max spacing) e `enforceMinStitch` (min length). Mai una sola funzione che pretende di fare entrambe.

### R5 — Le aree di esclusione (void) sopprimono ricamo E fori; il travel ci gira attorno.
**Perché:** una zona vuota del cartamodello significa "niente ago qui", per tutti i livelli, non solo per quello che porta il colore.
**Come:**
- Taglia la geometria **esattamente sul bordo** del void (intersezione col poligono), non solo "scarta i punti dentro".
- Il travel che attraverserebbe il void viene reinstradato lungo il perimetro del void (via più corta).
- Un foro/feature è rimosso se un suo punto entra nel void oltre `voidClearanceMm` (tolleranza speculare a quella del perimetro esterno, R7).

### R6 — Max 5000 punti per path in export.
**Perché:** limite pratico di Adobe Illustrator. Ricorre identico (`maximumVerticesPerPath` / `ILLUSTRATOR_SAFE_MAX_POINTS_PER_PATH` = 5000) in due progetti.
**Come:** in export, spezza le polilinee oltre soglia in più `<path>` dello stesso gruppo. La geometria non cambia, solo la serializzazione.

### R7 — Validità di un foro/feature rispetto al perimetro = tolleranza sui PUNTI, non sul centro.
**Perché:** il criterio center-based teneva anelli per metà fuori dal taglio.
**Come:** un foro è valido se **ogni suo punto** è dentro il perimetro entro `perimeterToleranceMm`. Tolleranza **negativa** = scarta i fori troppo vicini al bordo anche se non lo toccano (utile per margini di sicurezza laser).

### R8 — Ogni run entra ed esce sul bordo del pannello con fermatura di scarico filo.
**Perché:** requisito macchina (lo scarico del filo va sul bordo, ≥3 mm).
**Come:** su ogni polilinea, in ingresso e in uscita, 3 punti di lock che marciano lungo il bordo (tangente al segmento più vicino) + travel di raccordo. Distanza lock ≥ 3 mm.

### R9 — L'export deve essere riapribile: metadati embeddati nell'SVG.
**Perché:** un SVG di produzione senza i parametri di progetto è un vicolo cieco per la ri-edizione.
**Come:** incorpora un `<metadata id="rg-project">` con `{ params, sourceGeometry (base64) }`. Alla riapertura, un extractor rileva il metadata e ripristina parametri + geometria sorgente.

### R10 — Export sul viewBox base, non su quello zoomato.
**Perché:** bug ricorrente — l'SVG esportato veniva scalato per il fattore di zoom della preview.
**Come:** in export, dopo il clone della preview, resetta `viewBox` alla regione base non-zoomata. `1 unità = 1 mm` sempre, indipendentemente dallo zoom.

### R11 — Risoluzione della scala d'import: canonica, precisa, sempre uguale.
**Perché:** ogni tool re-incontra lo STESSO problema — file (spesso Illustrator) senza dimensione fisica dichiarata, solo viewBox in punti. Va risolto **una volta nel core**, non re-inventato per tool. (Implementato in `@rg/core` modulo `imports`.)
**Come — politica canonica:**
1. Se il file dichiara una **dimensione fisica** (SVG `width`/`height` in mm/cm/in/pt/pc; DXF `$INSUNITS`) → si usa quella, **esatta** (`method: 'declared' | 'unit'`).
2. Altrimenti si **stima** da viewBox al DPI canonico — **96 dpi** default (`px·25.4/96`), **72 dpi** per il ramo Illustrator point-based (`pt·25.4/72`) — metodo **provvisorio** (`method: 'dpi'`).
3. In OGNI caso l'utente può indicare la **larghezza reale in mm** (`realWidthMm`): il core scala uniformemente così che la sagoma sia larga *esattamente* quella misura. **È la fonte di verità e prevale** su qualsiasi stima.

L'IO restituisce SEMPRE un **`ImportResult`** `{ contours (mm), widthMm, heightMm, method }`, così il tool mostra la dimensione rilevata e offre l'override. Helper: `applyRealWidth(result, realWidthMm)`.

### R12 — I colori del cartamodello sono RUOLI, non grafica.
**Perché:** il workflow cartamodello mappa colore → funzione (Pannello, Pattern, Fori, Piazzamento, Fissaggio, Satin, Cordoncino).
**Come:** un registro ruoli (`MASTER_OUTLINE`, `PATTERN_REFERENCE`, `LASER_REFERENCE`, `PLACEMENT_REFERENCE`, …). Il contorno esterno di un colore = area di realizzo; una forma più piccola dello stesso colore all'interno = area di esclusione (void, R5).

### R13 — Repo fuori da OneDrive/`Documents`, sempre sotto git.
**Perché:** instabilità file osservata — OneDrive rimpiazza i file mentre lavori; senza git non c'è rete di sicurezza.
**Come:** se un progetto deve stare in `Documents\GitHub`, assicurati che sia un repo git valido e fai backup timestamp prima di editing rischiosi. Meglio ancora: spostare i repo fuori da cartelle sincronizzate.

### R14 — Cache-bust degli asset quando cambi il core.
**Perché:** il browser serve il vecchio `app.js`/bundle dalla cache e i nuovi hook "spariscono".
**Come:** bumpare il `?v=` del tag script/bundle a ogni modifica del core consumato da una pagina statica.

### R15 — La preview è una vista, non la fonte di verità. Il filo si disegna sottile.
**Perché:** lo `stroke-width`, lo zoom, i layer nascosti non devono mai contaminare la geometria esportata. E soprattutto: **la larghezza reale del punto (cordoncino, satin, raso) è nella GEOMETRIA** (ampiezza dello zig-zag, passate), **non nello stroke**. Disegnare il filo con uno stroke spesso lo fa sembrare una banda piena invece di un tracciato.
**Come:**
- Il **filo si visualizza sempre con stroke sottile ~0.1 mm** (`THREAD_STROKE_MM`), in preview **e** in export. Vale per **tutte le app**.
- I contorni/forme di riferimento usano uno stroke appena più marcato (`SHAPE_STROKE_MM` ~0.15) per distinguerli.
- Parametri di sola preview (opacità, visibilità layer, zoom) tenuti separati e mai letti dalla pipeline geometrica.

---

> **R16–R21 — Famiglia "passaggi nascosti e tiraggio".** Sono le regole più "esperte": ciò che distingue un vero generatore da ricamo da un semplice tracciatore di linee. Riguardano la fisica del filo in macchina (visibilità del travel, ritiro sotto tensione, accumulo agli incroci). Presenti — con implementazioni diverse — in oblique, 45-grid e cross-stitch.

### R16 — Il travel deve nascondersi sotto il ricamo che lo coprirà (passaggi nascosti / covered travel).
**Perché:** un filo di collegamento visibile rovina il ricamo. Risolto in 3 progetti con 3 implementazioni: è un concetto comune forte, non un dettaglio.
**Come:**
1. **Modella esplicitamente "cosa copre cosa":** quali livelli/elementi successivi copriranno il travel corrente (es. L2 + fori coprono il travel di L0; il logo copre il passaggio sotto). Senza questo modello, "nascosto" non è calcolabile.
2. **Trasforma "nascosto" in un costo da minimizzare.** Due strategie valide:
   - *geometrica* (oblique): raster di copertura + distance transform + A* con `visibilityWeight` (peso dominante, ~100) che penalizza la vicinanza al bordo coperto e `centerWeight` che attira verso il centro. L'A* **non entra mai in una cella scoperta** (vincolo hard).
   - *topologica* (cross-stitch): costo-connettore che penalizza i salti visibili (fuori-blocco +20, orizzontale libero +25) e premia quelli nascosti (contact −14, catena di contact −18, retrace-to-contact −12).
3. **Regola d'oro:** nascondi se puoi; se proprio non puoi, **spezza il percorso** o paga un costo esplicito — **mai un travel visibile silenzioso**. Fallback graduato: 100% coperto → soglia ≥99% → ponte scoperto corto tollerato → `break_path`.

### R17 — Il travel nascosto ha requisiti diversi dal travel visibile.
**Perché:** essendo invisibile si ottimizza per filo/tempo (non per estetica), ma deve restare *davvero* coperto.
**Come:**
- **Passo più lungo** del punto visibile (`coveredTravelStitchMm` ~2 mm) → meno punti macchina.
- **Sta al centro della copertura** (ai bordi il filo affiora): usa la distance transform o preferisci ricalcare filo già esistente.
- **Entra un po' sotto il bordo** della copertura invece di fermarsi netto (reach/overlap ~0.5–1.5 mm), così il ricamo sopra lo copre senza lasciare buchi al margine.

### R18 — Passare SOTTO ≠ aggirare. Scegli in base a cosa ci sarà sopra.
**Perché:** due modi opposti di nascondere il passaggio, con requisiti diversi.
**Come:**
- **Sotto (covered):** il passaggio ricalca la **sagoma reale** della cucitura che lo coprirà — il *footprint* effettivo dei punti, non una maschera generica (es. impuntura a "S" che segue gli archi del logo). Usalo dove sopra ci sarà cucitura densa.
- **Aggira (bypass):** il travel costeggia il **perimetro** dell'ostacolo (poligono ristretto di `coverBypassClearanceMm`) senza entrarci. Usalo dove sopra **non** ci sarà copertura sufficiente.
- Il footprint reale batte sempre la maschera nominale: fallback a cascata **footprint reale → poligono nominale → maschera**.

### R19 — Compensa il tiro (pull compensation): allunga le passate perché il filo si ritira.
**Perché:** sotto tensione il filo si ritira verso il centro; una passata alla misura teorica lascia i bordi scoperti dopo il tiro.
**Come:** overshoot longitudinale — estendi ogni passata oltre i suoi estremi (`overshootMm` ~0.6 per i riempimenti, `lineOvershootMm` ~2 per le linee di griglia) così dopo il ritiro arriva al bordo previsto.

### R20 — Evita l'accumulo di filo dove gli elementi si sovrappongono.
**Perché:** dove due cuciture si incrociano o si toccano il filo accumula → spessore/bugna, la macchina tira e può increspare o rompere.
**Come:**
- **Convergenza agli incroci:** restringi la larghezza verso la centerline in una banda attorno all'incrocio (`crossingConvergeRatio` 0.5 = metà larghezza al centro; `crossingConvergeWidthMm` 3 = larghezza banda).
- **Svuotamento (flatten):** dove passa un'altra riga o sotto una cucitura densa, sostituisci lo zig-zag pieno con un passaggio dritto sulla centerline; **allarga la zona di svuotamento di ~1.5 mm PRIMA del bordo** così non resta un pezzo pieno al margine.
- **Distacco degli archi tangenti (trim):** accorcia gli archi nei punti di contatto di ~metà larghezza del cordoncino (`touchTrimFactor` 0.5) per non sovrapporre due pieni.
- **Nessun micro-punto agli inversioni:** connettore minimo tra passate (`minConnectorMm` ~1 mm).

### R21 — Interruzione e ripresa pulite attorno agli ostacoli.
**Perché:** quando una cucitura ripetitiva (es. catenella) si spezza attorno a un ostacolo, maglie forzate o tagli netti creano buchi o sovrapposizioni.
**Come:** l'ultima maglia **entra sotto la copertura** (`underCoverOverlapMm` ~1.5 — la coprirà il ricamo sopra); la ripresa **nasce già oltre il bordo** dell'ostacolo (`chainResumeShiftMm` ~3) col passo naturale, **senza maglia di aggancio forzata** sul lato di ripresa (eviti la sovrapposizione col primo modulo naturale). Un modulo interamente nascosto → collassa in un singolo punto di passaggio.

---

> **R22–R26 — Famiglia "tipi di punto, densità e concatenamento".** Riguardano *cosa* si cuce (tassonomia dei punti), *quanto fitto* (densità e le sue conseguenze fisiche) e *in che ordine* (elementi concatenati uno dopo l'altro). È l'area più sotto-sviluppata: il riempimento vero (tatami) oggi esiste solo in `bitmap_to_stitch`; queste regole sono in parte estratte, in parte **normative** (come dovrebbe essere fatto nel core).

### R22 — La densità è la spaziatura trasversale in mm tra file di filo adiacenti. È la rappresentazione canonica.
**Perché:** oggi la densità è espressa in **6 modi diversi** (numero di passate, step mm, punti/mm², % del budget, `min_dist`, interlinea) → impossibile confrontarla o riusarla tra progetti.
**Come:** parametro canonico `densitySpacingMm`. Conversioni verso il canonico:
- da **passate** su una larghezza: `spacing = width / (passes − 1)` (es. 12 passate su 2.2 mm → 0.20 mm).
- da **punti/mm²**: `spacing ≈ √(1 / densità)` (è la formula già usata nel bitmap).
- da **interlinea**: è già una spaziatura.
**Distingui sempre due assi diversi:** la **spaziatura trasversale** (quanto sono vicine le file di filo → densità/coprenza, `densitySpacingMm`) e la **lunghezza del punto** lungo la linea (`runningStitchMm` / `maxStitchMm`). Non confonderle: sono ortogonali.

### R23 — La densità ha conseguenze fisiche, non solo estetiche.
**Perché:** più densa = più filo nello stesso spazio.
**Come:** densità alta → **più tiro** sul tessuto (aggrava R19/R20), **più rigidità**, **più tempo** macchina, **più rischio** di rottura ago/filo e di increspatura. Regole pratiche:
- Satin più largo di `satinMaxWidthMm` (~8 mm) cede/si impiglia → **splittalo o convertilo in fill**.
- Fill denso → **sfalsa le righe** (brick, `fillStaggerRatio` ~0.5) per non creare una "linea di split" visibile e per distribuire il tiro.
- Densità e tiro si tarano **insieme**: convergenza e svuotamento (R20) servono proprio a smaltire l'eccesso di densità agli incroci.

### R24 — Tassonomia canonica dei tipi di punto.
**Perché:** ogni progetto reimplementa gli stessi punti con nomi diversi; serve un vocabolario unico con il relativo modello di densità.

| Tipo canonico | Cos'è | Modello di densità | Dove è già implementato |
|---|---|---|---|
| **Running / Corsa** | linea semplice di punti | passo longitudinale (`runningStitchMm`) | tutti (connettori, L0.5, border connector) |
| **Satin / Raso** | punti paralleli fitti tra due bordi, filo lucido | spaziatura trasversale (`densitySpacingMm`) | 45-grid (base raso, N passate) — nell'oblique il "satin" è **solo un bordo**, non un fill |
| **Cordoncino** | zig-zag stretto lungo una linea/bordo | step longitudinale dello zig-zag | 45-grid, oblique |
| **Catenella / Chain** | moduli-anello ripetuti lungo la linea | passo tra moduli | 45-grid |
| **Zig-zag / Fissaggio** | zig-zag di ancoraggio | spaziatura d'arco | oblique (rosette L1, bordo) |
| **Tatami / Fill** | riempimento a righe parallele angolate, serpentina, sfalsate | line spacing (trasversale) + stitch length (longitudinale) + angolo | **solo `bitmap_to_stitch`** (`hatch_fill`) → il buco da colmare nel core |
| **Cross / Punto croce** | diagonali su griglia | ripetizioni per cella | cross-stitch |

Il **fill vero (tatami)** è il grande assente: va portato nel core come primitiva di prima classe (righe parallele ad angolo, serpentina, sfalsamento, underlay).

### R25 — I punti pieni/densi richiedono un underlay (passata di sottofondo).
**Perché:** un satin/fill cucito direttamente sul tessuto affonda, si deforma e non ha corpo; l'underlay stabilizza il tessuto e "alza" il punto.
**Come:** prima del punto pieno, una passata di sottofondo (running o zig-zag rado) **rientrata di `underlayInsetMm`** dal bordo, così resta coperta dal punto sopra. Già presente: **base raso sotto il cordoncino** (45-grid), **Level 0.5 running sotto le rosette L1** (oblique). Standardizzare come `underlay` opzionale di ogni elemento denso.

### R26 — Gli elementi si concatenano: l'uscita di uno = l'ingresso del successivo.
**Perché:** obiettivo esplicito in tutti i progetti — cucire gli oggetti **in sequenza continua**, minimizzando salti e tagli.
**Come:**
- ogni elemento espone **entry/exit espliciti** (primo/ultimo punto).
- ordina gli elementi a **catena minima** (greedy nearest: dall'exit corrente all'entry più vicino) — `orderBlocks` in cross-stitch, sequenza righe in 45-grid, `perimeterRoute` in oblique.
- **preferisci iniziare esattamente dove è finito il precedente** (priorità/costo speciale ai punti coincidenti → *zero jump*): il `contactPointBonus −14` in cross-stitch, la catenella invertita che torna sull'origine in 45-grid.
- quando l'uscita non coincide con l'ingresso, il collegamento è un travel (**nascosto se possibile**, R16) o un connettore perimetrale.
- **I passaggi sono CONSECUTIVI agli oggetti** (un passaggio isolato non ha senso): ogni travel parte esattamente dalla FINE dell'oggetto precedente e arriva esattamente all'INIZIO del successivo (endpoint coincidenti). In pratica: una "penna" tiene la posizione corrente e ogni oggetto è preceduto dal passaggio che lo raggiunge.
- **I passaggi vicino al bordo corrono SUL bordo**: se la retta tra due punti uscirebbe dalla sagoma (es. l'incavo di una V concava), il travel costeggia il perimetro invece di tagliare. Helper core: `routeTravel(a, b, boundary, stitchMm)` (retta se resta dentro, altrimenti cammino lungo il perimetro, via più corta).
- l'**ordine dei livelli/fasi è esso stesso una catena**: L0 → L0.5 → L1 → L2 (oblique), raso → cordoncino → catenella (45-grid). L'underlay (R25) viene sempre **prima** del punto che copre.

---

### R27 — L'export si sovrappone all'input: stesso frame della sorgente.
**Perché:** quando importi un cartamodello e generi il ricamo, l'output deve tornare nel software a valle (Stilista/Illustrator) **allineato esattamente** al cartamodello. Un export in un frame diverso (mm, margine, origine spostata) non si sovrappone → inutilizzabile per il montaggio.
**Come:** conserva all'import la trasformazione unità-file→mm (`SourceFrame`: scale, offset, viewBox, width/height). All'export riscrivi la geometria in **unità-file** e riusa **viewBox/width/height originali**. Il round-trip della sagoma è l'**identità** (verificato: viewBox e primo punto identici tra input ed export). Helper: `buildSvgInSourceFrame`. La `realWidthMm` (R11) resta valida per i parametri in mm; l'export la reintegra dividendo per il fattore, così l'allineamento non cambia.

### R28 — Un contorno è chiuso se i capi distano meno di 1 mm, e l'anello si salda esatto.
**Perché:** i cartamodelli chiudono la sagoma ripetendo il primo punto **senza `Z`**, e con l'arrotondamento di CAD/Illustrator i due capi non coincidono mai al bit. Chi pretende l'uguaglianza esatta dichiara *aperto* un contorno chiuso e lo scarta: è il difetto che aveva fatto sparire la rete. 1 mm è enorme rispetto al filo (0.1 mm, R15) e minuscolo rispetto a qualunque apertura voluta in un cartamodello.
**Come:** `CLOSURE_TOL_MM = 1.0`, `isGeometricallyClosed()`, `closePolygon()` in `@rg/core` (`io/normalize.ts`). `closePolygon` non si limita a marcare: se i capi sono entro tolleranza **porta l'ultimo punto esattamente sul primo**, così a valle non resta un buco sub-millimetrico. Nessun tool riscrive questa domanda per conto suo — le divergenze sono coperte da `test/smoke.mjs`.

**Corollario (R12).** Stessa logica per i colori: il colore è la *chiave* con cui l'utente assegna i ruoli, quindi `red`, `#F00` e `rgb(255,0,0)` devono produrre la stessa chiave. Fonte unica: `normalizeColor()`.

### R29 — Salvare un file chiede sempre dove e con che nome.
**Perché:** un export è un pezzo di lavoro, non un allegato: finisce in una cartella di commessa, con un nome che dice a cosa serve. Scaricarlo d'ufficio in `Download` con un nome deciso dal programma sposta su chi lavora la fatica di ritrovarlo e rinominarlo, ogni volta.
**Come:** `saveTextFile()` in `@rg/ui/save` — unico punto della suite che scrive file. Apre la finestra di salvataggio del sistema (`showSaveFilePicker`); dove non c'è (Firefox, Safari) ripiega sul download classico, così la funzione resta usabile ovunque. Tre dettagli che fanno la differenza e non vanno persi:
- **il nome proposto parte dalla sagoma**: `<nome-file-importato>-rete45.svg`, non un nome fisso;
- **la cartella se la ricorda il browser**, con un `id` unico per tutta la suite: il secondo export si apre dove hai salvato il primo, anche cambiando strumento;
- **annullare non salva niente** e lo dice nella statusbar. Nessun download di nascosto come ripiego.

**Corollario (R11).** Una lunghezza senza unità fisica (`width="539"`, o `%`) **non** dice quanto è grande l'oggetto: `svgPhysicalLengthToMm()` torna `null` e chi importa deve chiedere la scala, non inventarla. `svgLengthToMm()` resta per i casi in cui è lecito ripiegare sul DPI canonico.

### R30 — Interlinea (lungo il filo) e spaziatura (di traverso) sono due misure diverse.
**Perché:** in un cordoncino zig-zag due distanze decidono la resa, e sono **ortogonali**: quanto sono ravvicinati i punti *lungo* il filo (**interlinea**) e quanto sono vicine le file di filo *di traverso* (**spaziatura**). Chiamarle entrambe "densità" — come faceva il codice — è già costato lo stesso nome per grandezze diverse: un valore giusto per una è sbagliato per l'altra. Deciso con Lorenzo che per il cordoncino la misura che governa è l'interlinea longitudinale (distanza tra due punti *consecutivi* lungo il filo, la "misura A").
**Come:** interlinea longitudinale = `cordInterlineMm` (etichetta "Interlinea del cordoncino"); spaziatura trasversale = `densitySpacingMm` (R22). Nelle etichette **non** usare "densità" da sola per nessuna delle due: dì *lungo il filo* o *tra le file*.

---

## 2. Vocabolario di dominio (glossario canonico)

Usa **questi** termini. Tra parentesi le varianti già usate nei progetti, da non proliferare.

- **Point / Stitch** — coordinata in mm. Uno *stitch* è un segmento della polilinea (un punto-ago). *(pixel→stitch nel bitmap)*
- **Polyline** — sequenza ordinata di punti; unità base di ogni geometria.
- **Module** — unità geometrica ripetuta sulla griglia. *(modulo SVG validato / cella / fase vertical-horizontal)*
- **Grid / Lattice** — reticolo di posizionamento. Varianti: **diagonal-free** (Vector A/B liberi), **45°** (angoli fissi), **orthogonal**, **bitmap** (pixel).
- **Placement** — istanza di un module su una posizione della griglia.
- **Diagonal / Row** — banda di moduli lungo una direzione del reticolo.
- **Layer** — raggruppamento **funzionale** dell'output. Convenzione oblique: L0 piazzamento, L1 fissaggio, L2 pattern, L4 fori laser.
- **Phase** — raggruppamento per **sequenza macchina**. Convenzione 45-grid: base raso → cordoncino → catenella.
- **Boundary / Cartamodello** — sagoma di taglio importata; i suoi contorni colorati definiscono i **ruoli** (R12).
- **Void / Exclusion** — area interna senza ricamo (R5).
- **Travel** — spostamento di collegamento (non cucito) tra stitch/moduli.
- **Connector** — travel strutturato tra segmenti (perimetrale, a L, verticale, retrace…).
- **Serpentine** — ordinamento riga per riga con direzione alternata.
- **Routing** — l'insieme ordinamento + connettori + perimetro che rende il tracciato percorribile.
- **Lock / Scarico filo** — fermatura in ingresso/uscita sul bordo (R8).
- **Fill primitives** — **satin** (bordo pieno), **cordoncino** (satin centrale del bordo), **catenella** (modulo ripetuto), **tatami/hatch** (riempimento a linee parallele).
- **Thread / Color-change** — un colore = un filato = un cambio-ago. *(palette/quantizzazione nel bitmap)*
- **Role** — funzione assegnata a un colore del cartamodello (R12).
- **Covered travel / Passaggio nascosto** — travel che corre sotto il ricamo che lo coprirà, così il filo di collegamento non si vede (R16).
- **Coverage map** — raster della zona che sarà coperta dai livelli successivi, con distance transform, per sapere dove il travel è nascosto e quanto è "profondo" (lontano dal bordo visibile).
- **Footprint** — ingombro **reale** dei punti effettivamente cuciti di un elemento (≠ maschera nominale). È ciò che copre davvero (R18).
- **Bypass** — travel che **aggira** a contorno un ostacolo, invece di passarci sotto (R18).
- **Pull compensation / Compensazione del tiro** — overshoot delle passate per contrastare il ritiro del filo sotto tensione (R19).
- **Convergenza / Svuotamento (flatten)** — riduzione (verso la centerline) o azzeramento della larghezza agli incroci/sotto copertura, per evitare accumulo di filo (R20).
- **Trim (distacco)** — accorciamento degli archi nei punti di tangenza per non sovrapporre due pieni (R20).
- **Overlap / Resume** — sovrapposizione d'ingresso sotto la copertura + ripresa oltre il bordo, per interruzioni pulite (R21).
- **Densità** — spaziatura trasversale in mm tra file di filo adiacenti; rappresentazione canonica di quanto è "fitto" un punto (R22). Da non confondere con la lunghezza del punto (longitudinale).
- **Underlay / Sottofondo** — passata di stabilizzazione (running o zig-zag rado) sotto un punto pieno/denso (R25). Es: base raso, Level 0.5.
- **Fill / Riempimento (tatami)** — riempimento di un'area a righe parallele angolate, serpentina e sfalsate (R24). Il tipo di punto oggi meno sviluppato.
- **Stagger / Sfalsamento (brick)** — righe di fill sfalsate tra loro per evitare la "linea di split" e distribuire il tiro (R23).
- **Entry / Exit point** — primo/ultimo punto di un elemento, usati per concatenarlo al successivo (R26).
- **Concatenamento / Zero-jump** — sequenza di elementi in cui l'uscita di uno coincide (o è vicinissima) all'ingresso del successivo, senza tagli (R26).

---

## 3. Parametri canonici

Convenzione di naming: **camelCase + suffisso `Mm`** per lunghezze in millimetri, **`Deg`** per angoli, **`Count`** per interi. Questa tabella risolve alla radice il problema "tre nomi per lo stesso concetto".

### 3.1 Stitch e pulizia
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `minStitchMm` | 1.0 | mm | `minimumSegmentLength`, `minSegmentLengthMm`, `min_dist`, `minPointDistance` | lunghezza minima di un punto (pass **dopo** routing, R3) |
| `maxStitchMm` | 3.0 | mm | `resamplePathMaxSpacing`, `baseRasoStitchLengthMm`, `maxStitchLength` | spaziatura massima → suddivisione (R4) |
| `travelStitchMm` | 3.0 | mm | `minimumTravelStitchLength`, `connectorStitchLengthMm` | passo dei punti di travel |
| `cleanupToleranceMm` | 0.25 | mm | `cleanupTolerance` | tolleranza semplificazione (Douglas-Peucker) |
| `snapToleranceMm` | 0.5 | mm | `snapToEdgeDistance`, `edgeSnapToleranceMm` | snap dei punti al bordo |
| `dedupeToleranceMm` | 0.6 | mm | `edgeDedupeToleranceMm` | dedup punti quasi coincidenti |
| `mergeGapMm` | 2.0 | mm | `mergeGapMm` | fusione di tratti vicini |

### 3.2 Boundary, fori, void
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `perimeterToleranceMm` | 2.0 | mm | `holePerimeterToleranceMm` | validità foro vs perimetro (R7); **negativo** = margine di sicurezza |
| `voidClearanceMm` | 0.5 | mm | `clearanceMm` (emptyArea) | distanza minima dal bordo di un void (R5) |
| `holeMatchToleranceMm` | 0.5 | mm | `holeMatchTolerance` | match foro ↔ feature L0/L1 |
| `perimeterLaneWidthMm` | 3.0 | mm | `perimeterLaneWidth` | corsia di routing lungo il bordo |

### 3.3 Lock / scarico filo
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `startLockEnabled` | false | bool | `startLockEnabled` | attiva lo scarico filo su bordo (R8) |
| `startLockStitchMm` | 3.0 | mm | `startLockStitchMm` | passo dei punti di lock (≥3) |

### 3.4 Unità / scala / export
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `dpiDefault` | 96 | dpi | `default_dpi` | mm↔px quando il file non dichiara DPI (R11) |
| `dpiIllustrator` | 72 | dpi | — | ramo "Illustrator point-based" (R11) |
| `scaleMode` | `auto` | enum | `scaleMode`, `import.scaleMode` | `auto \| illustrator-72 \| viewbox-mm \| custom` |
| `realWidthMm` | 0 | mm | — | larghezza reale della sagoma; 0 = usa la dimensione rilevata; se >0 scala tutto ed è la fonte di verità (R11) |
| `maxPointsPerPath` | 5000 | count | `maximumVerticesPerPath` | chunking export (R6) |
| `strokePreviewMm` / `THREAD_STROKE_MM` | 0.1 | mm | `strokeWidthMm`, `stroke_width` | spessore del **filo** in preview ed export (sottile, R15) |
| `SHAPE_STROKE_MM` | 0.15 | mm | — | spessore dei contorni/forme di riferimento (R15) |

### 3.5 Fill primitives (default indicativi, da tarare per tecnica)
| Nome canonico | Default | Unità | Cosa controlla |
|---|---|---|---|
| `satinWidthMm` | 4.0 | mm | larghezza satin |
| `satinDensityMm` | 0.8 | mm | passo satin |
| `cordWidthMm` | 2.0 | mm | larghezza cordoncino |
| `cordInterlineMm` | 0.4 | mm | **interlinea del cordoncino**: passo *longitudinale* tra due punti consecutivi lungo il filo (misura A, R30). Sostituisce `cordDensityMm`. **Non** è `densitySpacingMm` (trasversale) |
| `constructionStrokeMm` | 0.3 | mm | **spessore di costruzione** (generatore pattern): guida rientri dal bordo, margini e passo dei raccordi — *distinto* dal filo disegnato (0.1 mm, R15) |
| `zigZagWidthMm` | 2.0 | mm | larghezza zig-zag/fissaggio |
| `hatchAngleDeg` | 0 | deg | angolo del riempimento tatami |
| `hatchSpacingMm` | 0.4 | mm | passo linee tatami |

### 3.6 Passaggi nascosti e tiraggio (R16–R21)
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `coveredTravelStitchMm` | 2.0 | mm | `coveredTravelStitchLengthMm`, `level0TravelStitchLength` | passo del travel nascosto (più lungo del visibile, R17) |
| `coverageResolutionMm` | 0.5 | mm | `coverageResolutionMm` | risoluzione del raster della coverage map |
| `coverageDilationMm` | 2.0 | mm | `coverageDilationMm` | margine: il filo copre un po' oltre la linea teorica |
| `coverageGapClosingMm` | 0.2 | mm | `coverageGapClosingMm` | chiude micro-fessure tra passate adiacenti |
| `minimumCoverageWidthMm` | 1.0 | mm | `minimumCoverageWidthMm` | corridoio più stretto ritenuto capace di nascondere |
| `visibilityWeight` | 100 | peso | `visibilityWeight` | penalità vicinanza al bordo coperto (dominante, R16) |
| `centerWeight` | 80 | peso | `centerWeight` | attrazione verso il centro della copertura |
| `overshootMm` | 0.6 | mm | `overshootMm` | pull compensation longitudinale dei riempimenti (R19) |
| `lineOvershootMm` | 2.0 | mm | `lineOvershootMm` | overshoot delle linee di griglia ai bordi (R19) |
| `crossingConvergeRatio` | 0.5 | ratio | `crossingConvergeRatio` | quanto stringe la larghezza all'incrocio (0.5 = metà, R20) |
| `crossingConvergeWidthMm` | 3.0 | mm | `crossingConvergeWidthMm` | larghezza della banda di convergenza |
| `crossingFlattenDeltaMm` | 0 | mm | `crossingFlattenDeltaMm` | allarga/restringe la banda di svuotamento (R20) |
| `coverBypassClearanceMm` | 0.5 | mm | `clearanceMm` (cc) | inset del poligono aggirato dal bypass (R18) |
| `underCoverOverlapMm` | 1.5 | mm | `logoChainOverlapMm`, `cordoncinoUnderLogoOverlapMm` | quanto il passaggio entra sotto la copertura (R21) |
| `chainResumeShiftMm` | 3.0 | mm | `logoChainResumeShiftMm` | arretramento della ripresa oltre il bordo (R21) |
| `touchTrimFactor` | 0.5 | ratio | `logoTouchTrimFactor` | distacco archi tangenti (× larghezza cordoncino, R20) |
| `minConnectorMm` | 1.0 | mm | `baseRasoMinConnectorMm` | connettore minimo tra passate, no micro-punti (R20) |

### 3.7 Densità, tipi di punto e concatenamento (R22–R26)
| Nome canonico | Default | Unità | Sostituisce | Cosa controlla |
|---|---|---|---|---|
| `densitySpacingMm` | 0.4 | mm | `satinDensity`, `line_spacing`, `baseRasoPasses` (via width/(n−1)) | **spaziatura trasversale** tra file di filo (R22). **Non** l'interlinea longitudinale del cordoncino → quella è `cordInterlineMm` (R30) |
| `runningStitchMm` | 3.0 | mm | `baseRasoStitchLengthMm`, `level05StitchLength`, `connectorStitchLengthMm` | passo longitudinale del punto corsa/running |
| `satinMaxWidthMm` | 8.0 | mm | — | oltre questa larghezza il satin cede → split o converti in fill (R23) |
| `fillStaggerRatio` | 0.5 | ratio | — | sfalsamento (brick) tra righe di fill, per evitare la linea di split (R23) |
| `fillAngleDeg` | 0 | deg | `hatchAngleDeg`, `angle_deg` | angolo delle righe di riempimento (R24) |
| `underlayEnabled` | true | bool | `enableLevel05` | attiva la passata di sottofondo prima dei punti densi (R25) |
| `underlayInsetMm` | 0.5 | mm | `aCenterCordoncinoReachMm` (analogo) | rientro dell'underlay dal bordo, così resta coperto (R25) |
| `zeroJumpToleranceMm` | 0.5 | mm | `sameCoordinate` (cross-stitch) | entro questa distanza exit≈entry → nessun travel/taglio (R26) |

> ⚠️ **Debito rilevato:** in `rg-oblique-embroidery-pattern-generator` i parametri `satinDensity`/`satinOffset` sono **definiti ma mai usati** (il "satin" è in realtà un bordo zig-zag). Nel core vanno unificati sotto `densitySpacingMm` e il fill vero implementato come primitiva (R24).

> **Nota per Python (`bitmap_to_stitch`):** i default fisici (`minStitchMm`, `dpiDefault`, ecc.) valgono identici; cambia solo il naming del codice. Il core esporrà questa tabella come **schema JSON** (`params.schema.json`) così i due mondi restano allineati senza condividere codice.

---

## 4. Pipeline di riferimento

L'ordine delle operazioni è **sempre lo stesso**, cambiano solo i generatori a monte. Violare l'ordine causa i bug classici (soprattutto R3/R4).

```
1. IMPORT           parse SVG/DXF → normalizza a mm UNA volta (R2, R11)
2. ROLES            leggi i colori del cartamodello come ruoli (R12)
3. BOUNDARY         risolvi perimetro esterno + void interni (R5, R12)
4. PLACEMENT        genera la geometria del pattern (specifico del progetto)
                    ── griglia diagonale / 45° / ortogonale / bitmap / grammatica
                    ── scegli il tipo di punto + densità canonica (R22, R24)
                    ── genera underlay PRIMA dei punti densi (R25)
                    ── qui: pull compensation/overshoot (R19), overshoot linee (R19)
5. FILTER           valida fori/feature vs perimetro (R7)
6. CLIP             taglia al perimetro; sottrai i void (R5)
7. CONNECT / ROUTE  connetti moduli in run; ordina; connettori; perimetro; serpentina
                    ── concatena gli elementi exit→entry, zero-jump (R26)
                    ── qui: passaggi nascosti / covered travel (R16–R18)
                    ── qui: gestione tiraggio agli incroci/sotto copertura (R20–R21)
8. MIN-STITCH       enforceMinStitch endpoint-preserving, DOPO il routing (R3)
9. LOCK             scarico filo in ingresso/uscita sul bordo (R8)
10. EXPORT          SVG in mm, viewBox base (R10), chunk 5000 (R6), metadata riapri (R9)
```

I passi **4** (Placement) e parte del **7** (traversal + passaggi nascosti + tiraggio) sono l'unica cosa che cambia davvero da progetto a progetto — ma le *tecniche* di R16–R21 sono condivise. Tutto il resto è **core condiviso**.

---

## 5. Contratti I/O

### 5.1 Import
- **SVG:** `DOMParser` → normalizza a mm (R2). Estrai geometrie, layer per colore/path, CSS inline. Le curve (cubiche/quadratiche) si approssimano campionando; documentare la tolleranza.
- **DXF:** parser code-pair. Entità supportate: `LINE`, `LWPOLYLINE` (bit 70 = chiusura), `POLYLINE`, archi. Scala unità dall'header. Coordinate × unitScale → mm.
- Ogni source conserva: `unitScaleX/Y`, `importScaleX/Y`, `normalizationMethod`.

### 5.2 Export SVG
- **Se importato da un file:** esporta nel **frame della sorgente** (viewBox/unità/posizione originali) così l'output si sovrappone all'input (R27). Altrimenti:
- `width`/`height` in mm; `viewBox` = regione **base** (R10).
- Un gruppo per layer/phase, ordinato per sequenza reale dove applicabile.
- Chunk dei path oltre `maxPointsPerPath` (R6).
- `<metadata id="rg-project">` con params + sorgente base64 (R9).
- Salvataggio via File System Access API (`showSaveFilePicker`) con fallback a download blob.

### 5.3 Riapertura
- All'import, un extractor rileva `<metadata id="rg-project">` e ripristina params + geometria sorgente (colori originali inclusi).

### 5.4 Formati macchina (futuro)
- Nessun progetto emette ancora DST/PES nativi tranne i prototipi di `bitmap_to_stitch` (via `pyembroidery`). Quando serve: un `machine-writer` che consuma la stessa polilinea + layer + color-change. Fuori scope per ora.

---

## 6. Architettura target

Tre asset, in quest'ordine. Questo documento è l'**Asset 1**.

### Asset 1 — Costituzione (questo file)
Regole + vocabolario + parametri canonici. Stack-agnostic. **Fatto quando:** ogni nuovo progetto lo cita come riferimento e non reinventa nomi/regole.

### Asset 2 — `rg-embroidery-core` (libreria condivisa)
**Stack deciso:** TypeScript, ESM, zero-dipendenze, bundle ESM piatto consumabile sia dai monoliti vanilla JS sia dai progetti TS.
Moduli (solo primitive già duplicate — **non** i generatori):
- `units` — normalizzazione mm, DPI (R2, R11)
- `io/svg`, `io/dxf` — parsing → mm + colori/ruoli
- `geometry` — point/polyline, `pointInPolygon`, `polygonArea`, `pathLength`, `clipSegment*`, `distanceToSegment`
- `boundary` — clipping, void/exclusions (R5)
- `stitch` — `enforceMinStitch`, `resampleUniform`, `douglasPeucker`, `removeConsecutiveDuplicates` (R3, R4)
- `stitch-types` — primitive dei punti: running, satin/raso, cordoncino, catenella, zig-zag, **fill/tatami**, cross; con modello di densità canonico (R22, R24)
- `underlay` — generazione del sottofondo per i punti densi (R25)
- `routing` — nearest-neighbor, serpentine, connettori a costo minimo, perimetrale; concatenamento elementi exit→entry (R26)
- `covered-travel` — coverage map + distance transform + A* (approccio geometrico) e costo-connettore covered/contact/retrace (approccio topologico); scelta sotto-vs-bypass (R16–R18)
- `tension` — pull compensation/overshoot, convergenza e svuotamento agli incroci, trim, overlap/resume (R19–R21)
- `export/svg` — export mm + metadata (R6, R9, R10)
- `params` — schema + preset; emette `params.schema.json` per il mondo Python

### Asset 3 — Scaffold di progetto
Il vero "strumento per costruire strumenti": un template che cabla core + UI `data-param` + preview zoom/pan + params/preset + export riapribile. Ogni nuovo progetto nasce già equipaggiato. **Non** è un meta-motore che genera generatori.

### Fuori scope (per ora)
La "grammatica dichiarativa" di `pattern-grammar-engine`: ha la vocazione ma non la maturità (grammatica cablata nel codice). Se ne recupera l'infrastruttura (tipi, boundary/import, exporter) come contributo all'Asset 2. Il layer dichiarativo si affronta solo dopo che 2-3 progetti girano sul core e si vede quali regole di placement/traversal si ripetono davvero.

---

## 7. Roadmap

- [x] **Asset 1 — Costituzione** (questo file)
- [ ] Definire l'oggetto del 6° progetto → scegliere quali primitive del core estrarre per prime
- [ ] **Asset 2 — `rg-embroidery-core`**: iniziare dai leaf già duplicati (geometry, io/svg, io/dxf, stitch)
- [ ] `params.schema.json` condiviso (ponte verso Python)
- [ ] **Asset 3 — scaffold** + primo progetto costruito sopra
- [ ] Refactor incrementale dei progetti esistenti per consumare il core (uno alla volta, il più semplice per primo)

---

*Documento vivo. Ogni lezione nuova diventa una regola `Rn`. Ogni nome nuovo passa da §3 prima di entrare nel codice.*

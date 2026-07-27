# STATO — RG Embroidery Tools Suite

> Progetto: **RG-EMBROIDERY-TOOLS-SUITE** · pacchetto npm `rg-embroidery-tools-suite` · brand in interfaccia "RG Tools".
> Aggiornato: 2026-07-24 · Suite con **tre tool** funzionanti (net-45, pattern-grammar, interlace)
> Regola: **questo file si aggiorna nello stesso commit** di ogni modifica.

---

## 1. COSA FA GIÀ

**La suite gira.** `avvia.bat` apre la home `RG Tools` (porta 5270): griglia di card, clicchi uno strumento e si apre dentro la suite con la topbar RG e il link di ritorno.

**Tool `net-45` — funzionante end-to-end:**
- Importa **DXF o SVG** (cartamodello) e li normalizza in **mm reali**; se il file non dichiara la dimensione fisica, il campo *larghezza reale mm* è la fonte di verità.
- Assegnazione **colori → ruoli** (perimetro, area rete, aree raso, quadratini, bordo, area vuota).
- Genera la **rete di cordoncini a 45°** basata su celle: fascia di raso automatica sul bordo (solo lati bassi/laterali), quadrati chiusi, cordoncini che arrivano al perimetro.
- Il tracciato è un **filo continuo** (cordoncino → passaggio → cordoncino), con i passaggi che costeggiano il bordo.
- **Anteprima con pan/zoom** che non si azzera quando cambi i parametri.
- **Export SVG allineato al file di partenza** (stesso viewBox/coordinate) + metadati per riaprirlo.

**Tool `pattern-grammar` (Generatore pattern) — funzionante:**
- Genera **pattern e basi ricamo** dalla grammatica — il cannage è solo uno dei possibili; l'output è un **tracciato continuo** esportabile in SVG.
- **Pannello fedele alla UI originale**: 26 controlli nei 6 gruppi originali (Formato e scala · Zig-zag orizzontale · Zig-zag verticale · Deformazioni creative · Percorso e confine · Preset), con le due sezioni richiudibili.
- **Preset** locali: salva / carica / elimina (verificato il giro completo).
- **Import DXF/SVG** del contorno con modalità di scala (auto / Illustrator 72dpi / ViewBox=mm / dimensione custom) e scelta per colore/layer.
- Stessa ergonomia di net-45: guscio `rg-workspace`, anteprima con pan/zoom, export SVG.

**Tool `interlace` (Interlace) — motore funzionante, multicolore:**
- Riempie l'area ricamabile con un **filo continuo di passaggi brevi** (6-15mm regolabili) che vagano in modo pseudo-casuale, **omogeneo** con **vortici organici** (campo di flusso a peso basso). È l'effetto "intreccio a nuvola" dell'SVG di riferimento di Lorenzo.
- **Omogeneità indipendente dalla densità (camminata "cerca-vuoti").** La copertura si misura su griglia e il riempimento **finisce quando tutte le celle raggiungono la copertura obiettivo** (derivata dalla densità), non a lunghezza fissa; quando la zona locale è piena il filo **punta al vuoto più vicino** a passi brevi. Così anche a **bassa densità + punto corto** (il caso che prima lasciava buchi) l'area resta uniforme. Verificato headless.
- **Multicolore = PASSATE sovrapposte** (modello confermato con Lorenzo). Ogni colore è **un filo continuo** (regola 1) che percorre la superficie; i colori sovrapposti → intreccio. `densitySpacingMm` = densità **TOTALE del tessuto**, divisa tra i colori (pavimento a 1 strato/colore: con N colori il minimo è N strati) → il bilancio dei colori viene da qui (sulla sagoma demo ~21-24m per colore, prima 23-57). **Copertura piena** (0% buchi): un tentativo di fermarsi al 90% per bilanciare lasciava un **buco coerente in un angolo** (tutti i colori lasciavano scoperta la stessa zona) → tolto, ora si copre tutto. *(Tentativi scartati: rotazione-lungo-sequenza = macchie; dither per-cella = mille cambi-colore; tour = pettinato.)* **UI palette nel pannello**
  - *Densità uniforme anche in labirinto (risolto):* le zone iper-dense (autostrade dei tragitti) e rade venivano dal fatto che i tragitti verso i vuoti ignoravano il tetto ai picchi. Ora il **tetto vale anche ai tragitti** (a gradini: tetto → tetto doppio → senza tetto solo come ultima spiaggia). Sul file FF (densità 3, 4 colori): **CoV 0.38** (più uniforme del riferimento 0.52), colori bilanciati (24-33m), filo 197→115m, 0 buchi, 1 stacco/colore.
  - *Incrementi FUTURI chiesti da Lorenzo (non ora):* (a) densità **regolabile per singolo filo/colore**; (b) densità **diverse per ZONA** sui fili sopra → **macchie** volute. (sezione 03 "Colori del filo": swatch editabili col picker nativo, aggiungi/rimuovi, ripetizioni) — composta dal subagent design-system con i soli componenti v1.6.0 (`rg-color-map`, `rg-icon-button--danger`, `rg-cluster`, `rg-input--numeric`), **nessuna classe nuova, nessun commit sul DS**.
- **Export per Stilista: sequenza, non gruppo-colore.** L'anteprima resta raggruppata per colore (leggibile), ma l'**export** emette **un gruppo `<g>` per ogni stop, nell'ORDINE di cucitura** (`stop-0000`, `stop-0001`, …) — non raggruppato per colore, altrimenti si perde la sequenza. Inoltre **ogni stop ha una tinta UNICA** (piccolo scostamento base-13, ≤~5%): due stop dello stesso colore-palette (es. due "neri") escono con esadecimali diversi → Stilista li tratta come cambi-ago distinti. Verificato: 90 stop → 90 gruppi ordinati, 90 tinte tutte diverse anche con due `#000000` in palette.
- **Smoke test dedicati** (`npm test`): riempimento non vuoto, 0 punti nel vuoto (R5), 0 fuori dal bordo, 0 segmenti fuori da [min,max] (R3/R4).
- **Prestazioni: maschera a griglia.** Con cartamodelli a **molte aree vuote** (es. un file reale con 64 lettere) il vecchio motore si piantava: ogni passo testava il segmento contro *tutti* i poligoni. Ora l'area ricamabile viene "disegnata" **una volta** in una maschera a griglia (dentro il bordo, fuori dai vuoti, clearance incorporata via erosione/distance-transform); ogni controllo del motore è una **lettura O(1)**, indipendente dal numero di vuoti. Sul file reale: da *bloccato* a **~20-70ms**.
- **Filo CONTINUO (regola 1 — deciso con Lorenzo).** L'area ricamabile è un labirinto. *Prima* il motore, quando bloccato o dopo N passi fermi, **saltava** a penna alzata alla zona scoperta più vicina → tanti stacchi (~88 sul file FF): un "passaggio" che Lorenzo non vuole. *Ora* NON salta mai "di comodo": quando è bloccato/coperto **prosegue verso il vuoto più vicino ATTRAVERSANDO l'area**, preferendo le celle non ancora cucite (il tragitto è esso stesso riempimento, non sovrapposizione). Si stacca **solo** se una zona è davvero murata/irraggiungibile cucendo (raro). Risultato sul file FF: **1 stacco** (era 88), CoV 0.55 (= riferimento), 0.4% vuoti; il prezzo è più filo (i tragitti). Resta la **regola 2** (non "murarsi" chiudendo l'ultima via verso i vuoti) se restassero stacchi di troppo — da fare solo se serve.
- **Clearance PRECISA (campo di distanza con segno).** La maschera non è più "sì/no" (che, con l'erosione di sicurezza, ingrossava di ~1mm il distacco e impediva al filo di arrivare al bordo): ora è un **SDF** e la clearance si confronta sul **punto reale**. Risultato: `clearance = 0` → il filo arriva **a ridosso** del vuoto (~0.07mm, come si aspetta Lorenzo); `clearance = 1.5` → distacco **1.43mm**, preciso. Verificato sul file reale: 0 punti nel vuoto, 0 fuori dal bordo, in entrambi i casi. *(Bug trovato e corretto: la `sdf` estrapolava fuori griglia dando falsi positivi lontano dal bordo → frazioni limitate a [0,1].)*
- **Densità più uniforme (anti-grumo + controllo successivo).** Il riempimento è in **due fasi**: (1) riempimento principale con rilocazione tra le tasche; (2) **controllo successivo** che riparte sempre dalla cella più scarsa e la porta a target, tenendo la mira su di lei → **livella le valli**. Lo scoring preferisce la cella meno coperta, scoraggia i micro-giri e **frena la sovra-copertura** (una cella a target viene evitata → frena i picchi). Sul file reale: **0% di celle vuote** (prima restavano zone rade). Restano alcuni addensamenti nelle camere più piccole (CoV≈1.2) — vedi §3.
- **Lezione (da validare con Lorenzo):** la **lunghezza del punto va scelta in base al cartamodello**. Su un disegno fine (canali larghi pochi mm) i punti 6-15mm sono troppo lunghi e riempiono male; con **2-5mm** il reticolo si riempie bene. Forse serve un default adattivo o un avviso.
- **Aree vuote e bordo rispettati** (R5/R7): riusa la convenzione ruoli della suite (colore → `EXCLUSION`), nessun segmento entra nei void o esce dal bordo, con clearance. Verificato headless su file reale (64 vuoti): 0 punti nel vuoto, 0 fuori dal bordo, 0 segmenti fuori da [min,max] (R3/R4 per costruzione).
- **Pannello Testa A** (fonte-guidata): 01 Cartamodello (`rg-file-input` + `realWidthMm`), 02 Colori e ruoli (`rg-color-map`, ruoli MASTER_OUTLINE/EXCLUSION), 03 Riempimento (`rg-input--numeric`, solo parametri canonici §3). Stessa ergonomia di net-45: `rg-workspace`, pan/zoom, export SVG con salvataggio di sistema (R29).
- **Motore locale all'app** (`apps/interlace/src/engine.ts`), non nel core (regole di crescita 1-2): si promuove solo quando un 2° tool lo chiederà. Import/scala/ruoli/geometria/export vengono invece **dal core** (riuso, non copia).
- **Ancora da fare** (vedi §3): parametri "movimento/spigolosità" (nomi da decidere, processo REVISIONE-PARAMETRI), palette multicolore a stop rotanti (UI via subagent design-system) + modello densità da `bitmap_to_stitch` (R22-R26), verifica visiva in browser vero, smoke test dedicati.

**Fondamenta condivise:**
- `packages/core` (~900 righe) — unità/scala mm, import SVG+DXF, geometria, griglia 45°, clipping, punti (cordoncino/running/min-stitch), passaggi con routing sul bordo, export SVG.
- `packages/ui` — integrazione del design system + topbar condivisa + **pan/zoom** (promosso qui quando è servito al secondo tool).
- `packages/design-system` — il RG Design System come **submodule**, da GitHub, pinnato al tag **`v1.6.0`**. Da qui arrivano i componenti del pannello (`rg-file-input`, `rg-color-map`, `rg-input--numeric`) e la struttura canonica.
- `packages/pattern-grammar` — motore di generazione pattern migrato da `pattern-grammar-engine` (solo percorso browser). **Ora usa `@rg/core`** per chiusura contorni, colori e lunghezze fisiche.
- **Primitive d'import condivise** (`core/io/normalize.ts`, senza DOM così valgono anche in Node): `isGeometricallyClosed` / `closePolygon` (R28), `normalizeColor` (R12), `svgPhysicalLengthToMm` (R11). I due importer del repo — quello a DOM di net-45 e quello a testo di pattern-grammar — restano diversi *per architettura*, ma rispondono per costruzione allo stesso modo alle domande di dominio.
- **Salvataggio unico per la suite** (`@rg/ui/save`, R29): l'export apre la finestra di salvataggio del sistema — scegli **cartella e nome** — invece di scaricare d'ufficio in Download. Il nome proposto parte dalla sagoma importata (`sagoma-rete45.svg`); la cartella se la ricorda il browser tra uno strumento e l'altro. Su Firefox/Safari ripiega sul download classico. **Da provare in un browser vero** (vedi blocchi).
- **Smoke test** (`npm test`): 12 asserzioni su chiusura, colori e scala, con la fixture del difetto reale (`test/fixtures/contorno-con-scarto.svg`). Verificato che fallisce se si rimette la vecchia tolleranza.

**Regole scritte:** `COSTITUZIONE-RICAMO.md` (30 regole R1–R30 + glossario + parametri canonici) e `ARCHITETTURA.md`.

**Modello operativo:** per ogni bisogno di UI comanda il subagent `design-system`; già applicato due volte (componenti `rg-workspace` e `rg-topbar--app`).

---

## 2. STATO

**Metà strada, in salita.**
La suite ha **due tool funzionanti** (net-45 e pattern-grammar), entrambi con lo stesso guscio e la stessa ergonomia: sono **quasi usabili** da Lorenzo. Manca lo strato "usabile da altri": README, test, e le rifiniture di ricamo che solo Lorenzo può validare.

---

## 3. COSA MANCA per renderlo USABILE da qualcuno

- [ ] **README** alla radice: cos'è, come si avvia (`avvia.bat`), requisiti (Node), come si aggiunge un tool.
- [x] ~~**App `pattern-grammar`**: interfaccia nel guscio `rg-workspace` + card nella home.~~
- [ ] **Verifica visiva reale** dei due tool in un browser vero (la preview integrata è rotta, vedi blocchi).
- [x] ~~**pattern-grammar — la dimensione totale non è esatta** (200 → 209.8)~~ risolto (⑤): il formato è esatto, il resto si rifila al bordo.
- [x] ~~**pattern-grammar — preset** (salva/carica/elimina).~~
- [x] ~~**pattern-grammar — modalità di scala all'import.**~~
- [ ] **pattern-grammar — export report** (il motore lo genera già).
- [ ] **pattern-grammar — preset condivisi**: oggi sono nel browser (localStorage). Nella versione originale c'era anche il salvataggio lato server.
- [ ] **net-45 — quadrato intero garantito** sul bordo (oggi le celle di confine restano tagliate).
- [ ] **net-45 — cima col cordoncino grande** (il bordo superiore del DXF).
- [ ] **net-45 — editor delle celle** (scegliere a mano rete / raso / esclusa).
- [ ] **Riempimenti raso veri**: oggi le aree raso escono come *forme* da riempire a mano su Stilista.
- [ ] **Export DST** (oggi solo SVG); la sequenza di cucitura ordinata è già pronta per generarlo.
- [ ] **Font del DS** (AGNext, GT America): non inclusi → l'interfaccia usa i font di sistema.
- [x] ~~**Test automatici**: zero.~~ C'è `npm test` — copre le primitive d'import (chiusura, colori, scala).
- [ ] **Test — restano scoperti** i pezzi grossi: geometria/clip del core, generazione della rete 45°, generatore pattern.
- [ ] **Fixture dai file veri**: la fixture di oggi è sintetica. Servono un SVG e un DXF **reali** di Lorenzo nel repo, per bloccare i comportamenti che contano davvero.
- [ ] **`strokeWidth` di pattern-grammar: due default diversi.** L'interfaccia parte da **0.1 mm**, il motore ripiega su **0.3** (`patternGrammar.ts`, `config.strokeWidth ?? 0.3`): un preset salvato senza quel campo genera un pattern diverso da quello che vedi coi valori iniziali. Da decidere quale sia il valore giusto — attenzione, qui **non** è lo stroke di visualizzazione di R15: guida la geometria (`inset`, `marginY`, `connectorStep`) *ed* è anche lo spessore disegnato. Forse vanno separati in due parametri.
- [ ] **Archi ellittici nell'import a testo**: il parser `d` di pattern-grammar tratta il comando `A` come un segmento dritto fino al punto finale (`importBoundary.ts`, ramo `"A"`). Su una sagoma con raccordi curvi il contorno esce spigoloso. L'importer a DOM di net-45 non ha il problema (campiona con `getPointAtLength`).
- [x] ~~**Nuovo tool in arrivo**~~ → è **`interlace`** (riempimento a intreccio/nuvola multicolore). Definito con Lorenzo, piano in 5 punti confermato. **Fatto lo step 1+3 base:** scaffold + motore di riempimento a passaggi brevi su sagoma demo, vuoti/bordo rispettati, export SVG. Restano gli step successivi:
  - [ ] **interlace — parametri "movimento"**: esporre in pannello i controlli oggi interni al motore (influenza del flusso/vortici, ampiezza della virata/spigolosità, scala delle nuvole). Nomi da decidere con Lorenzo prima di entrare nel pannello (processo REVISIONE-PARAMETRI, poi §3).
  - [x] ~~**interlace — multicolore a stop rotanti**~~: ora **mélange** (dither spaziale tra le passate) → nessuna macchia; export per sequenza con tinte uniche; UI palette nel pannello (DS v1.6.0). Fatto.
  - [x] ~~**interlace — inflazione filo nel mélange**~~: risolto passando al riempimento unico ricolorato (densità esatta; 347m → 50m sui parametri densi di Lorenzo).
  - [x] ~~**interlace — buchi ai bordi**~~: le celle di bordo il cui centro cadeva in clearance erano scartate → frangia vuota. Ora la cella cerca un **sotto-punto valido** vicino al bordo (SAFE ridotto a 0.5·cella): i bordi si riempiono. Da confermare a occhio con Lorenzo.
  - [x] ~~**interlace — uniformità/grumi**~~ → **DECISO con Lorenzo:** il riempimento DEVE restare molto disomogeneo (è l'effetto); regolarizzare è vietato (ha bocciato serpentina-lungo-canale, dither, rotazione-sequenza). Soluzione tenuta: **tetto ai picchi** (`CLUMP_CAP` ~3× target) che taglia solo gli agglomerati estremi senza imporre direzione → CoV del labirinto FF da ~0.96 a ~0.49 (≈ il riferimento 0.52). Rimosse le sovra-correzioni (guida-canale, livellamento). Bordi pieni (0% buchi), niente sfori/bleed. **Da confermare a occhio da Lorenzo**; `CLUMP_CAP` è la manopola (basso = meno grumi ma più stacchi; alto = viceversa).
  - [ ] **interlace — `CLUMP_CAP` come parametro** (eventuale): oggi è costante interna; se Lorenzo vuole regolarlo, esporlo in pannello (nome da decidere).
  - [x] ~~**interlace — omogeneità a bassa densità**~~: risolto con la camminata "cerca-vuoti" (copertura per-cella + puntamento al vuoto più vicino). L'uniformità non dipende più dalla lunghezza del punto.
  - [ ] **interlace — modello densità da `bitmap_to_stitch`** (R22-R26): portare il calcolo densità/coprenza in TS, riconciliando `densitySpacingMm` (oggi guida la lunghezza filo obiettivo in modo approssimato). Solo algoritmo, niente Python.
  - [ ] **interlace — void come primitiva del core**: oggi il clip vuoti/bordo è fatto nel motore dell'app con le primitive geometriche del core; se servirà il *travel che costeggia il perimetro del void* (da oblique) si promuove `routeTravel` nel core con test (regola di crescita 1).
  - [x] ~~**interlace — smoke test dedicati**~~: invarianti bloccate in `test/smoke.mjs` (nessun punto nel vuoto, nessun segmento fuori da [min,max], filo dentro il bordo).
  - [ ] **interlace — same-color void**: oggi il void deve avere un colore diverso dall'area (i ruoli sono per-colore); il caso canonico R12 "forma più piccola dello stesso colore = esclusione" va gestito per geometria (annidamento), non solo per colore.
  - [ ] **interlace — verifica visiva in browser vero** (preview integrata rotta).
- [ ] **Migrare gli altri tool**: oblique, 45-grid, cross-stitch. (`bitmap_to_stitch` resta satellite Python.)
- [ ] **Pulizia**: `apps/net-45/src/style.css` non è più usato.

---

## 4. BLOCCHI E DECISIONI APERTE

- ~~**Submodule vs copia vendorizzata**~~ — risolto: il DS è su GitHub, il submodule punta all'URL remoto ed è **pinnato al tag `v1.6.0`**.
- **Il monorepo non è su GitHub.** Il DS sì; questo repo no → nessun backup fuori dal disco e il submodule non è ancora clonabile insieme al progetto.
- **Preview integrata rotta.** Il pannello browser dell'assistente resta a 0×0 e gli screenshot vanno in timeout → **la verifica visiva la deve fare Lorenzo** con `avvia.bat`. Le verifiche automatiche (typecheck, build, ispezione del DOM e del bundle) funzionano e vengono usate al posto suo.
- **Rifiniture di ricamo da validare**: quadrato intero in cima, cordoncino grande di bordo e comportamento dei quadrati esclusi vanno decisi guardando il DST di riferimento — servono gli occhi di Lorenzo.
- **"Fit" del pan/zoom** riporta a zoom 1 e centro, non calcola l'inquadratura sul contenuto.
- **Breaking minore del DS**: `.rg-topbar` base è passata da 56px a 64px (`--rg-layout-header`); se altri progetti usano la topbar nera, cresce di 8px.
- ~~**Proposte DS in attesa di merge**~~ — risolto: il DS è a **v1.6.0** e include tutto (1.4.0 densità pannelli, 1.5.0 componenti del pannello, 1.6.0 `rg-input--numeric`). Il submodule è già spostato al tag. Restano da fare gli **adozioni lato app**, che ora non hanno più blocchi (vedi sotto).
- **Due importer, e restano due.** net-45 importa col DOM (`getPointAtLength`: campiona qualsiasi curva, risolve il CSS, produce il `SourceFrame` per l'export allineato) ma funziona **solo nel browser**. pattern-grammar importa a stringhe (funziona in Node, quindi testabile, e ha 5 modalità di scala esplicite con warning) ma approssima le curve. **Nessuno dei due è "quello buono"**: fonderli è un lavoro vero, da fare quando serviranno le curve precise in pattern-grammar o l'export allineato. Nel frattempo condividono le primitive, che è dove stavano i danni.
- **Revisione dei parametri — 8 decisioni CHIUSE** → `REVISIONE-PARAMETRI.md` (tabella in testa). Implementazione in corso:
  1. [x] **Costituzione §3 + R30** (`cordInterlineMm` vs `densitySpacingMm`, rinomine ⑧, spessore di costruzione). Fatto.
  2. [x] **net-45**: etichette (①②③) + pannello DS (01 Sagoma con `rg-file-input` + `realWidthMm`, 02 Colori e ruoli con `rg-color-map`, 03 Parametri con `rg-input--numeric`), raso-solo-sotto come casella. `cordDensityMm → cordInterlineMm`. Fatto — **da vedere in un browser vero**.
  3. [x] **pattern-grammar** — pannello Testa B + accordion + etichette (stadio 1); ⑥ split `strokeWidth` (filo 0,1 + `constructionStroke`), ⑦ onda mm/gradi, ⑧ rinomina `minStitchMm`/`maxStitchMm` con conversione preset (stadi 6-7-8). **Da vedere in un browser vero.**
  4. **④** densità rasi/quadratini: restano nascoste finché non ci sono i riempimenti veri.
  5. [x] `test/smoke.mjs` esteso: 5 asserzioni ⑥⑦⑧ (le conversioni non cambiano la geometria).
  6. [x] **⑤ Larghezza esatta, rifila al bordo** — il formato è il pannello: se fissi 200×160 esce **200×160 esatto** e la geometria in eccesso viene **tagliata al bordo**. Completato il taglio a rettangolo che nel motore era codice morto (`isInsideBoundary`/`segmentInterval`/il connettore ignoravano `rectangle`); il "Nessuna sagoma di ritaglio" con un formato impostato è comunque delimitato dal rettangolo del pannello. **Bonus:** anche l'opzione "Rettangolo" del menu ora taglia davvero (prima era inerte). Invarianti nel test (`npm test`); **la resa del taglio va comunque guardata a occhio.**

**→ Le 8 decisioni parametri sono TUTTE implementate.** Restano solo verifiche visive e le mosse sul repo DS (di Lorenzo).
- **Struttura pannello — regola DS aggiornata (v1.7.0, docs-only)**. Risolta la riflessione di Lorenzo:
  - *Due teste*, scelte dalla domanda-radice «la misura del prodotto nasce dalla sorgente o è indipendente?». **Testa A (sorgente-guidata)**: 01 Sagoma → 02 Colori e ruoli, niente Formato (net-45, bitmap, cross-stitch da immagine). **Testa B (formato-guidata)**: 01 Formato → 02 Sagoma → 03 Colori e ruoli (pattern-grammar, oblique, 45-grid). Corpo e coda identici.
  - *Accordion*: la **testa non si chiude mai** (`<section>`); corpo e coda richiudibili **tutti o nessuno** (`<details class="rg-param-section rg-disclosure">`). Default senza memoria: testa aperta; corpo tutto aperto se **≤5 sezioni**, altrimenti (**≥6**) solo il primo gruppo aperto; coda (Esportazione, Preset) **sempre chiusa**. Stato ricordato **per tool** (localStorage) — meccanismo JS lato app, la regola la fissa il DS.
  - DS su branch `ds/workspace-order-accordion` (`ddfb6aa`), **v1.7.0 proposta, non taggata**. È **docs-only** (patterns/workspace.md, components.json, vetrina): nessun CSS/token nuovo → la composizione accordion esiste già in v1.6.0, quindi **l'app si implementa senza aspettare il tag**. Merge/tag/bump submodule a v1.7.0 = decisione di Lorenzo (per far combaciare i doc).
  - net-45 (Testa A) allineato: gruppo Parametri ora `<details open>`.
- **Struttura del pannello laterale — direttiva pronta, ora adottabile.** L'agente `design-system` ha definito l'ordine canonico (testa: Sagoma · Colori e ruoli · Formato e scala → corpo: gruppi del tool nel loro ordine → coda: Esportazione · Preset) con un *test di appartenenza* che segue il verso della lavorazione, non l'argomento. Componenti e regola sono in **v1.6.0**, già pinnato: il blocco è caduto.
  - *L'attrito che temevo non c'era*: l'agente ha verificato che il blocco d'import **non fa parte della UI originale** di pattern-grammar — è la mia ricostruzione che l'aveva parcheggiato nel gruppo 05 accanto a `shapeType`. Spostarlo in testa lascia i 6 gruppi originali nella stessa sequenza e con lo stesso contenuto.
  - *Ordini da implementare (lavoro app, non ancora fatto)*: **net-45** → 01 Sagoma (file + `realWidthMm`, che oggi sta fra i parametri, + Sagoma demo) · 02 Colori e ruoli (`rg-color-map`) · 03 Parametri. **pattern-grammar** → 01 Sagoma · 02 Colori e ruoli · 03 Formato e scala · 04–07 i gruppi attuali · 08 Preset. Con i valori numerici in `rg-input--numeric`.
  - *Conviene farlo insieme alla revisione delle etichette* (`REVISIONE-PARAMETRI.md`): riscrivere i due pannelli è l'occasione per far entrare i nomi nuovi in una passata sola, invece di toccarli due volte.
- **Lezione di metodo — le divergenze non si vedono, vanno cercate.** Il core e il motore migrato rispondevano diverso a *"questo contorno è chiuso?"* (1.0 mm contro 0.001): mille volte diverse, nessuna delle due assurda, e nessun sintomo finché un file storto non finiva nel tool sbagliato. Trovata leggendo, non perché qualcosa si fosse rotto. Da qui le regole di crescita 6 e 7 in `ARCHITETTURA.md`: **a ogni migrazione si confrontano le primitive**, e ogni divergenza numerica si decide col ricamo in mano, si scrive in Costituzione e si blocca con un test.
- **Lezione di metodo**: quando si migra un tool, la fonte di verità dell'interfaccia è **la UI esistente**, non l'API del motore. Ricostruendo il pannello dalla config avevo inventato un sottoinsieme arbitrario di parametri; la versione giusta era quella già progettata.

---

## 5. PROSSIMA SINGOLA MOSSA

Scrivere il **README** alla radice: cos'è RG Tools, come si avvia (`avvia.bat`), cosa serve (Node), quali tool ci sono e come se ne aggiunge uno. È il pezzo che manca perché qualcuno che non sia Lorenzo possa aprire il repo e usarlo.

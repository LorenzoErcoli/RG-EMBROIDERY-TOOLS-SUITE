# STATO — RG Tools (suite strumenti ricamo)

> Aggiornato: 2026-07-22 · Suite con **due tool** funzionanti
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

**Fondamenta condivise:**
- `packages/core` (~900 righe) — unità/scala mm, import SVG+DXF, geometria, griglia 45°, clipping, punti (cordoncino/running/min-stitch), passaggi con routing sul bordo, export SVG.
- `packages/ui` — integrazione del design system + topbar condivisa + **pan/zoom** (promosso qui quando è servito al secondo tool).
- `packages/design-system` — il RG Design System come **submodule**, da GitHub, pinnato al tag **`v1.2.0`**.
- `packages/pattern-grammar` — motore di generazione pattern migrato da `pattern-grammar-engine` (solo percorso browser). **Ora usa `@rg/core`** per chiusura contorni, colori e lunghezze fisiche.
- **Primitive d'import condivise** (`core/io/normalize.ts`, senza DOM così valgono anche in Node): `isGeometricallyClosed` / `closePolygon` (R28), `normalizeColor` (R12), `svgPhysicalLengthToMm` (R11). I due importer del repo — quello a DOM di net-45 e quello a testo di pattern-grammar — restano diversi *per architettura*, ma rispondono per costruzione allo stesso modo alle domande di dominio.
- **Smoke test** (`npm test`): 12 asserzioni su chiusura, colori e scala, con la fixture del difetto reale (`test/fixtures/contorno-con-scarto.svg`). Verificato che fallisce se si rimette la vecchia tolleranza.

**Regole scritte:** `COSTITUZIONE-RICAMO.md` (28 regole R1–R28 + glossario + parametri canonici) e `ARCHITETTURA.md`.

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
- [ ] **pattern-grammar — la dimensione totale non è esatta**: chiedi 200mm, escono 209.8 (il motore deriva le colonne e arrotonda per eccesso). Da decidere se rifilare al bordo.
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
- [ ] **Migrare gli altri tool**: oblique, 45-grid, cross-stitch. (`bitmap_to_stitch` resta satellite Python.)
- [ ] **Pulizia**: `apps/net-45/src/style.css` non è più usato.

---

## 4. BLOCCHI E DECISIONI APERTE

- ~~**Submodule vs copia vendorizzata**~~ — risolto: il DS è su GitHub, il submodule punta all'URL remoto ed è **pinnato al tag `v1.2.0`**.
- **Il monorepo non è su GitHub.** Il DS sì; questo repo no → nessun backup fuori dal disco e il submodule non è ancora clonabile insieme al progetto.
- **Preview integrata rotta.** Il pannello browser dell'assistente resta a 0×0 e gli screenshot vanno in timeout → **la verifica visiva la deve fare Lorenzo** con `avvia.bat`. Le verifiche automatiche (typecheck, build, ispezione del DOM e del bundle) funzionano e vengono usate al posto suo.
- **Rifiniture di ricamo da validare**: quadrato intero in cima, cordoncino grande di bordo e comportamento dei quadrati esclusi vanno decisi guardando il DST di riferimento — servono gli occhi di Lorenzo.
- **"Fit" del pan/zoom** riporta a zoom 1 e centro, non calcola l'inquadratura sul contenuto.
- **Breaking minore del DS**: `.rg-topbar` base è passata da 56px a 64px (`--rg-layout-header`); se altri progetti usano la topbar nera, cresce di 8px.
- **DS v1.3.0 in attesa di merge**: l'agente ha corretto due difetti del DS emersi dal pannello troppo stretto (token `--rg-layout-tool-panel`, e `rg-param-grid` che ora impila via *container query* sulla larghezza del pannello invece che della finestra, più `min-width: 0` sull'input con unità). Sta sul branch `ds/workspace-panel-density` (`0bd0905`, pushato), **non mergiato**: merge su `main` e tag `v1.3.0` sono decisione di Lorenzo. Il fix lato app funziona già su v1.2.0; con 1.3.0 arriva la rete di sicurezza automatica.
- **Due importer, e restano due.** net-45 importa col DOM (`getPointAtLength`: campiona qualsiasi curva, risolve il CSS, produce il `SourceFrame` per l'export allineato) ma funziona **solo nel browser**. pattern-grammar importa a stringhe (funziona in Node, quindi testabile, e ha 5 modalità di scala esplicite con warning) ma approssima le curve. **Nessuno dei due è "quello buono"**: fonderli è un lavoro vero, da fare quando serviranno le curve precise in pattern-grammar o l'export allineato. Nel frattempo condividono le primitive, che è dove stavano i danni.
- **Lezione di metodo — le divergenze non si vedono, vanno cercate.** Il core e il motore migrato rispondevano diverso a *"questo contorno è chiuso?"* (1.0 mm contro 0.001): mille volte diverse, nessuna delle due assurda, e nessun sintomo finché un file storto non finiva nel tool sbagliato. Trovata leggendo, non perché qualcosa si fosse rotto. Da qui le regole di crescita 6 e 7 in `ARCHITETTURA.md`: **a ogni migrazione si confrontano le primitive**, e ogni divergenza numerica si decide col ricamo in mano, si scrive in Costituzione e si blocca con un test.
- **Lezione di metodo**: quando si migra un tool, la fonte di verità dell'interfaccia è **la UI esistente**, non l'API del motore. Ricostruendo il pannello dalla config avevo inventato un sottoinsieme arbitrario di parametri; la versione giusta era quella già progettata.

---

## 5. PROSSIMA SINGOLA MOSSA

Scrivere il **README** alla radice: cos'è RG Tools, come si avvia (`avvia.bat`), cosa serve (Node), quali tool ci sono e come se ne aggiunge uno. È il pezzo che manca perché qualcuno che non sia Lorenzo possa aprire il repo e usarlo.

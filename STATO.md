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

**Tool `pattern-grammar` (Pattern cannage) — funzionante:**
- Genera il pattern cannage dalla grammatica; l'output è un **tracciato continuo** esportabile in SVG.
- **Pannello fedele alla UI originale**: 26 controlli nei 6 gruppi originali (Formato e scala · Zig-zag orizzontale · Zig-zag verticale · Deformazioni creative · Percorso e confine · Preset), con le due sezioni richiudibili.
- **Preset** locali: salva / carica / elimina (verificato il giro completo).
- **Import DXF/SVG** del contorno con modalità di scala (auto / Illustrator 72dpi / ViewBox=mm / dimensione custom) e scelta per colore/layer.
- Stessa ergonomia di net-45: guscio `rg-workspace`, anteprima con pan/zoom, export SVG.

**Fondamenta condivise:**
- `packages/core` (~900 righe) — unità/scala mm, import SVG+DXF, geometria, griglia 45°, clipping, punti (cordoncino/running/min-stitch), passaggi con routing sul bordo, export SVG.
- `packages/ui` — integrazione del design system + topbar condivisa + **pan/zoom** (promosso qui quando è servito al secondo tool).
- `packages/design-system` — il RG Design System come **submodule** (commit `fdb69c6`).
- `packages/pattern-grammar` — motore cannage migrato da `pattern-grammar-engine` (solo percorso browser).

**Regole scritte:** `COSTITUZIONE-RICAMO.md` (27 regole R1–R27 + glossario + parametri canonici) e `ARCHITETTURA.md`.

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
- [ ] **Test automatici**: zero. Almeno uno smoke test per il core (geometria/clip) e uno per il motore pattern-grammar.
- [ ] **Migrare gli altri tool**: oblique, 45-grid, cross-stitch. (`bitmap_to_stitch` resta satellite Python.)
- [ ] **Pulizia**: `apps/net-45/src/style.css` non è più usato.

---

## 4. BLOCCHI E DECISIONI APERTE

- **Submodule vs copia vendorizzata.** Oggi il DS è agganciato come *submodule* con path locale `../RG-DESIGN-SYSTEM`. Ma esiste una decisione annotata di adottarlo per **copia vendorizzata + sync (NON submodule)**. Da sciogliere: il submodule con path locale funziona solo su questa macchina.
- **Niente remote.** Né il monorepo né il DS sono su GitHub. Finché è così, il submodule non è condivisibile e non c'è backup fuori dal disco.
- **Preview integrata rotta.** Il pannello browser dell'assistente resta a 0×0 e gli screenshot vanno in timeout → **la verifica visiva la deve fare Lorenzo** con `avvia.bat`. Le verifiche automatiche (typecheck, build, ispezione del DOM e del bundle) funzionano e vengono usate al posto suo.
- **Rifiniture di ricamo da validare**: quadrato intero in cima, cordoncino grande di bordo e comportamento dei quadrati esclusi vanno decisi guardando il DST di riferimento — servono gli occhi di Lorenzo.
- **"Fit" del pan/zoom** riporta a zoom 1 e centro, non calcola l'inquadratura sul contenuto.
- **Breaking minore del DS**: `.rg-topbar` base è passata da 56px a 64px (`--rg-layout-header`); se altri progetti usano la topbar nera, cresce di 8px.
- **Il submodule del DS è indietro**: agganciato a `fdb69c6`, mentre il DS è già a **v1.2.0** con componenti nuovi (modal, chips, folders, app-shell, lightbox, lists) e una policy nuova: *il prefisso `rg-` appartiene solo al DS, le classi app-local usano un prefisso proprio*. Le nostre (`pg-`, `net45-`) sono già conformi. Da riallineare quando serve.
- **Lezione di metodo**: quando si migra un tool, la fonte di verità dell'interfaccia è **la UI esistente**, non l'API del motore. Ricostruendo il pannello dalla config avevo inventato un sottoinsieme arbitrario di parametri; la versione giusta era quella già progettata.

---

## 5. PROSSIMA SINGOLA MOSSA

Scrivere il **README** alla radice: cos'è RG Tools, come si avvia (`avvia.bat`), cosa serve (Node), quali tool ci sono e come se ne aggiunge uno. È il pezzo che manca perché qualcuno che non sia Lorenzo possa aprire il repo e usarlo.

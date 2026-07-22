# STATO — RG Tools (suite strumenti ricamo)

> Aggiornato: 2026-07-22 · Commit base: `565f393` + motore pattern-grammar migrato
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

**Fondamenta condivise:**
- `packages/core` (~900 righe) — unità/scala mm, import SVG+DXF, geometria, griglia 45°, clipping, punti (cordoncino/running/min-stitch), passaggi con routing sul bordo, export SVG.
- `packages/ui` — integrazione del design system + topbar condivisa.
- `packages/design-system` — il RG Design System come **submodule** (commit `fdb69c6`).
- `packages/pattern-grammar` — motore cannage migrato da `pattern-grammar-engine`: typecheck pulito, smoke test OK (genera SVG valido). **Manca la sua app.**

**Regole scritte:** `COSTITUZIONE-RICAMO.md` (27 regole R1–R27 + glossario + parametri canonici) e `ARCHITETTURA.md`.

**Modello operativo:** per ogni bisogno di UI comanda il subagent `design-system`; già applicato due volte (componenti `rg-workspace` e `rg-topbar--app`).

---

## 2. STATO

**Metà strada.**
La suite e il primo tool sono **quasi usabili** (net-45 produce output reale, esportabile e allineato). Il secondo tool è a metà (motore sì, interfaccia no). Manca tutto lo strato "usabile da altri": README, test, e le rifiniture di ricamo che solo Lorenzo sa validare.

---

## 3. COSA MANCA per renderlo USABILE da qualcuno

- [ ] **README** alla radice: cos'è, come si avvia (`avvia.bat`), requisiti (Node), come si aggiunge un tool.
- [ ] **App `pattern-grammar`**: interfaccia nel guscio `rg-workspace` + card nella home.
- [ ] **Verifica visiva reale** di net-45 e della suite in un browser vero (la preview integrata è rotta, vedi blocchi).
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

---

## 5. PROSSIMA SINGOLA MOSSA

Creare **`apps/pattern-grammar`**: l'app che monta il motore già migrato dentro il guscio `rg-workspace` (pannello parametri + canvas con anteprima), e aggiungerla come card nella home della suite.

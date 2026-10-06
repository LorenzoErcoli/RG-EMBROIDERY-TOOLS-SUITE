# Avvio — nuovo tool nella RG Embroidery Tools Suite

Stai per costruire **un nuovo strumento dentro un ecosistema già in piedi**. La regola d'oro: *aggiungere senza rompere ciò che già funziona*. Leggi tutto prima di toccare codice.

> Ultima verifica sul codice: **2026-10-06** (14 app + shell, DS checked-out a v1.19.1). Se rileggi questo file mesi dopo,
> controlla §1 e §5 contro `packages/ui/src/tools.ts` e `apps/shell`: sono le parti che invecchiano.

## 0. Cosa leggere PRIMA di scrivere una riga
In questo repo (`RG-EMBROIDERY-TOOLS-SUITE`), nell'ordine:
1. `STATO.md` — dove siamo, cosa c'è, cosa manca. **Va aggiornato nello stesso commit di ogni modifica.** È lungo (migliaia di righe): leggi l'intestazione e la lista operativa (§3), poi cerca il tool o la primitiva che ti riguarda.
2. `COSTITUZIONE-RICAMO.md` — 31 regole invarianti (R1–R31) + vocabolario (§2) + nomi canonici dei parametri (§3). Sono lezioni già pagate: si citano nei commit ("fix R3").
3. `ARCHITETTURA.md` — come cresce l'ecosistema (le *regole di crescita* sono la parte che ti riguarda di più).
4. `REVISIONE-PARAMETRI.md` — convenzioni su etichette/unità decise con Lorenzo.
5. **`sapere/`** — la giurisprudenza: cosa ha deciso Lorenzo e perché, cosa si è provato e scartato.
   Leggi `sapere/LEGGIMI.md`, tutto `sapere/metodo/` (vale per ogni tool) e le schede in `sapere/tool/` dei tool *vicini* al tuo (stessa famiglia di punto, stesso input). Una decisione nuova o una lezione di dominio **si scrive lì, nello stesso commit del codice** — non in memoria, non solo in `STATO.md`.

## 1. Dove sei
Monorepo npm workspaces (Vite + TypeScript, ESM, core zero-dipendenze).
```
packages/core            @rg/core — geometria, IO (SVG/DXF), unità mm, punti, export, fill, routing, quantize, reduce, regions… IL CUORE CONDIVISO.
packages/ui              @rg/ui — design system + topbar + registro tool + pan/zoom + salvataggio file + Guida in-app
packages/design-system   submodule git (fonte di verità del look; il pin lo decide Lorenzo)
packages/pattern-grammar @rg/pattern-grammar — motore del generatore pattern
packages/testkit         aiuti per gli SCRIPT di verifica (lettura BMP, scrittura PNG): non è ricamo, è il banco di misura.
                         Non è nei workspace: si importa per percorso relativo da script esbuild+node, mai dall'app.
apps/shell               home della suite (griglie di tool + routing a hash)
apps/<tool>              un tool per cartella — vedi la lista viva in packages/ui/src/tools.ts
strumenti-sviluppo/      strumenti Python di sviluppo, fuori da apps/*: si lanciano a mano, la suite non li esegue
test/smoke.mjs           UNA suite di test per tutto (npm test) + test/fixtures
```
**La lista dei tool non si copia qui: è `TOOLS` in `packages/ui/src/tools.ts`** (era l'elenco che invecchiava per primo). Sono due le pagine della home: `suite` (strumenti pronti per il lavoro) e `sviluppo` (progetti non finiti, che si aprono e si usano ma non sono ancora affidabili — decisione di Lorenzo, 2026-09-16).

Avvio: `avvia.bat` (home sulla porta 5270). Test: `npm test`. Tipi: `npm run typecheck`. Build: `npm run build`.
**I tre devono restare verdi a ogni passo** (la build **non** controlla i tipi: vite usa esbuild) e girano tutti e tre in CI a ogni push.

## 2. Cosa fa questo tool
> **La descrizione del tool arriva nel MESSAGGIO SUCCESSIVO** (input, output, a cosa serve).
> Questo primo messaggio è solo il *contesto del sistema e le regole*; il secondo messaggio definisce il tool.
> **Non iniziare a progettare né a scrivere codice finché non hai letto il secondo messaggio.**

## 3. Cosa riusi, e da dove
Prima di scrivere un algoritmo, **cerca in `@rg/core` e nei tool vicini**: il core ormai ha quasi tutto lo scheletro.
- **Import/scala/chiusura contorni:** `io/normalize.ts` (R2, R11, R28). Un contorno è chiuso se i capi distano < 1 mm, e l'anello si salda esatto.
- **Riempimenti:** `fill.ts` (righe parallele / raso, pettine o serpentina, dentro un poligono coi fori — R24).
- **Aree vuote (void):** R5 — sopprimono ricamo e fori, il travel ci gira attorno (`avoidVoids` in `travel.ts`, parametro `exclusions`).
- **Passaggi nascosti sotto il ricamo successivo:** `routing.ts` (R16–R21). Il chiamante consegna le corse **già in fila**.
- **Da immagine:** `quantize.ts` (palette median-cut), `reduce.ts` (tinte stabili), `regions.ts` (`traceRegions`: maschera → regioni coi fori). Il decoder dell'immagine è il **canvas del browser**; Node non decodifica JPEG (per le prove headless: BMP, via `packages/testkit`).
- **Semplificazione contorni:** `simplifyPolyline`.
- **Export:** SVG allineato alla sorgente (R10, R27) con metadati riapribili (R9, `readProjectMetadata`); DST macchina con **un solo adattatore** (R31, `dstFromExportLayers`, footer leggibile con `readDstMetadata`).
- **Salvataggio:** sempre con finestra di sistema (R29) via `@rg/ui/save` — `saveTextFile`/`saveBinaryFile`, oppure in due fasi con `pickSaveTarget` se l'export è lento (la finestra la concede solo l'attivazione fresca del clic).
- **UI:** `topbar`, `hookPanZoom`, struttura del pannello — **comanda il subagent `design-system`**.
- **Come usare un tool esistente come modello:** il più recente e completo è `apps/cross-stitch` (`tool.ts` + moduli di motore separati + worker + CSS locale). Non copiarlo: leggilo per la *forma*.
- **Satelliti Python** (`bitmap_to_stitch`, ecc.): **non si importano**. Si porta l'*algoritmo* in TypeScript rispettando i nomi canonici §3 della Costituzione. Non eseguire Python dalla suite.
- Se la primitiva che ti serve esiste solo dentro *un'altra app*: **non importarla da quell'app** (un'app non dipende da un'altra). Promuovila nel core (regola di crescita 1, sei il secondo cliente) — prima il test che la blocca, poi il trasloco, con gli stessi numeri prima e dopo (è il metodo usato per `regions`, `reduce`, `routing`).

## 4. Le regole che NON si violano (o rompi il sistema)
- **`packages/core`, `packages/ui`, `packages/design-system` sono CONDIVISI.** Li usano tutti i tool: se li rompi, li rompi tutti. Non modificarli "al volo" per un bisogno solo tuo — prima tieni la cosa locale nell'app, e promuovila nel core **solo quando serve davvero** (regola di crescita 2), con test.
- **Dopo ogni modifica: `npm run build`, `npm test` E `npm run typecheck` devono passare.**
- **Ogni divergenza numerica è una decisione, non un dettaglio** (R30 / regola di crescita 7): se due implementazioni rispondono diverso alla stessa domanda geometrica, si decide col ricamo in mano, si scrive in Costituzione, si blocca con un test in `test/smoke.mjs`. Mai "scelgo quella che sembra ragionevole". Quando migri o scrivi, **confronta le primitive** (chiusura, colori, unità, tolleranze) col core (regola 6).
- **Il test serve a scoprire i difetti, non a difendere il codice** (regola 8): ogni motore va misurato contro le regole che dice di rispettare (R3 punto minimo, R4 punto massimo, R5 vuoti, R20 accumulo…) e la misura si scrive in `test/smoke.mjs`. Fixture sintetiche **e file veri**: la sintetica prova quello a cui hai pensato, il file vero quello a cui non hai pensato.
- **La resa viene prima delle misure, una misura sola non basta, un riferimento si legge per i suoi valori** — vedi `sapere/metodo/`. Si mostra a Lorenzo qualcosa di *guardabile* (anteprima, PNG, SVG), non solo numeri.
- **UI/componenti/CSS: comanda il subagent `design-system`.** Non inventare markup o classi `rg-*` a mano. Il prefisso `rg-` è del DS. Niente hex inline: token `var(--rg-*)`.
- **Il repo del Design System NON si merge/tagga da qui.** Merge, tag e versioni li fa Lorenzo. Tu al massimo *consumi* un tag esistente.
- **`STATO.md` si aggiorna nello stesso commit.** Prima guardi il codice reale (non vai a memoria), poi spunti/aggiungi/togli. Cita le regole R nei messaggi di commit.
- **Scrivere file del repo da script: attenzione a CRLF ed escape** — `sapere/codice/scrivere-file-lf.md`.
- **Chat globale vs chat operativa** (`sapere/metodo/chat-globale-e-operative.md`): il codice di un tool si scrive nella chat dedicata a quel tool; la globale prepara il contesto.

## 5. Come si aggiunge un tool senza rompere niente
Checklist completa — **tutte** le voci; alcune (marcate ⚠️) si saltano senza che la build se ne accorga.

**La cartella `apps/<nome>`**
1. `package.json` (nome `<nome>`, script `dev`/`build`/`preview`, dipendenza `"@rg/core": "*"`), `tsconfig.json` (copia da `apps/cross-stitch`: `paths` verso `@rg/core` e `@rg/ui/*`), `vite.config.ts` con alias `@rg/core` e `@rg/ui`, `index.html`, `src/main.ts` (solo `mount<Nome>(document.getElementById('app')!)`).
2. ⚠️ **Porta Vite univoca** in `vite.config.ts` (`strictPort: true`). Le porte in uso stanno nei `vite.config.ts` delle app: `grep -rn "port:" apps/*/vite.config.ts` e prendi la prossima libera. *Oggi `pittorico` e `zone-pattern` dichiarano entrambi la 5280: con `strictPort` il secondo a partire fallisce — non rifarlo.*
   Per vederlo in anteprima aggiungi una voce in `.claude/launch.json` (`<nome>-dev`, `npm run dev --workspace apps/<nome>`, stessa porta del `vite.config.ts`). *Un server di sviluppo già in piedi non conosce gli alias aggiunti dopo la sua partenza (errore 500 su `@app/<nome>`): serve un riavvio, o l'app standalone.*
3. `src/tool.ts` esporta `mount<Nome>(root, opts?: {backHref?: string})`: il tool è **sia standalone sia integrato**. Importa `@rg/ui/rg.css` e il CSS locale; usa `topbar(titolo, backHref)` da `@rg/ui/tools`, le classi `.rg-*` e i token `var(--rg-*)`.
4. Il motore (puro, senza DOM) in moduli separati dalla UI, così `test/smoke.mjs` lo può importare. Lavoro pesante → worker (vedi `routing.worker.ts` in cross-stitch).

**La registrazione nella suite**
5. `packages/ui/src/tools.ts` → voce in `TOOLS` (`id`, `name`, `description`, `status`, `section`). Un tool nuovo e non finito va in `section: 'sviluppo'`; passa a `suite` quando Lorenzo lo decide.
6. `packages/ui/src/tool-icons.ts` → l'icona: un pittogramma che disegna *la struttura del punto* che il tool produce, chiave = `id`. Senza, la card mostra un quadrato neutro e nessuno ti avvisa.
7. `apps/shell/src/main.ts` → `import { mount<Nome> } from '@app/<nome>'` e il ramo `else if (hash === '#/<nome>')`.
8. ⚠️ **L'alias `@app/<nome>` va messo in DUE file:** `apps/shell/vite.config.ts` *e* `apps/shell/tsconfig.json`. Se salti il secondo la build passa lo stesso — se ne accorge solo `npm run typecheck`.
9. ⚠️ **Root `package.json`:** aggiungi lo script `dev:<nome>` e la voce `tsc -p apps/<nome>/tsconfig.json` nello script `typecheck` — senza, il typecheck (e quindi la CI) **non guarda il tuo tool**.
10. `MANUALE.md` → sezione `## Nome tool (`<id>`)`. È la *Guida* in-app (bottone nella topbar). ⚠️ Il bottone trova la sezione dal **titolo della topbar**: il titolo che passi a `topbar()` e il nome nell'intestazione `##` devono combaciare all'inizio (confronto senza maiuscole né punteggiatura), altrimenti la Guida si apre sulla panoramica. Scrivi per chi cuce, non per chi programma.

**Il contenuto**
11. **Pannello: struttura canonica** (testa sempre aperta → corpo in accordion → coda Preset), chiedendo la forma esatta al subagent design-system. Parametri coi **nomi canonici** della Costituzione §3 e unità in mm; etichette secondo `REVISIONE-PARAMETRI.md`.
12. **Export dal primo giorno**, non "dopo": SVG riapribile (R9/R10/R27) **e** DST (R31) **e** salvataggio con finestra (R29). Lo smoke test verifica tool per tool che l'export si riapra.
13. Se ti serve una primitiva nuova nel core: **estraila** (con test), non duplicarla.

**Il conto finale**
14. Test del motore in `test/smoke.mjs` (invarianti delle regole R che il tool dichiara di rispettare, su sintetico **e** su file vero in `test/fixtures` o `apps/<nome>/fixtures`).
15. `STATO.md` aggiornato (voce del tool + eventuale riga nella lista operativa), **scheda in `sapere/tool/<nome>.md`** (cos'è, da che riferimento è nato, decisioni di Lorenzo con la data), `ARCHITETTURA.md` (tabella di migrazione) se il tool è un'entrata nuova.
16. `npm run typecheck && npm test && npm run build` verdi; poi **guardalo nel browser** (home → card → tool → carica un file → genera → esporta → riapri l'export).

## 6. Prima mossa
Leggi i documenti del §0 e aspetta il secondo messaggio (§2). Poi, **prima di scrivere codice**, proponi un piano in 5 punti di *come* costruirai il tool, *quali* primitive del core riusi, *quali* ne promuovi, e *quale riferimento* (DST/SVG/immagine) userai per misurare la resa. Poi si procede un pezzo alla volta, con typecheck+test+build verdi e `STATO.md` aggiornato a ogni passo.

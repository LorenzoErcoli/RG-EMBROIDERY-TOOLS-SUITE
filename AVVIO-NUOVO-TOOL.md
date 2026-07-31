# Avvio — nuovo tool nella RG Embroidery Tools Suite

Stai per costruire **un nuovo strumento dentro un ecosistema già in piedi**. La regola d'oro: *aggiungere senza rompere ciò che già funziona*. Leggi tutto prima di toccare codice.

## 0. Cosa leggere PRIMA di scrivere una riga
In questo repo (`RG-EMBROIDERY-TOOLS-SUITE`), nell'ordine:
1. `STATO.md` — dove siamo, cosa c'è, cosa manca. **Va aggiornato nello stesso commit di ogni modifica.**
2. `COSTITUZIONE-RICAMO.md` — 31 regole invarianti (R1–R31) + nomi canonici dei parametri (§3). Sono lezioni già pagate: si citano nei commit ("fix R3").
3. `ARCHITETTURA.md` — come cresce l'ecosistema (le *regole di crescita* sono la parte che ti riguarda di più).
4. `REVISIONE-PARAMETRI.md` — convenzioni su etichette/unità decise con Lorenzo.

## 1. Dove sei
Monorepo npm workspaces (Vite + TypeScript, ESM, core zero-dipendenze).
```
packages/core            @rg/core — geometria, IO (SVG/DXF), unità mm, punti, export. IL CUORE CONDIVISO.
packages/ui              @rg/ui — design system + topbar + pan/zoom + salvataggio file
packages/design-system   submodule git, pinnato al tag v1.6.0 (fonte di verità del look)
packages/pattern-grammar @rg/pattern-grammar — motore del generatore pattern
apps/shell               home della suite (griglia di tool + routing)
apps/net-45              tool "Rete 45°"
apps/pattern-grammar     tool "Generatore pattern"
```
Avvio: `avvia.bat`. Test: `npm test`. Build: `npm run build`.

## 2. Cosa fa questo tool
> **La descrizione del tool arriva nel MESSAGGIO SUCCESSIVO** (input, output, a cosa serve).
> Questo primo messaggio è solo il *contesto del sistema e le regole*; il secondo messaggio definisce il tool.
> **Non iniziare a progettare né a scrivere codice finché non hai letto il secondo messaggio.**

## 3. Cosa riusi, e da dove
- **Dalla suite (import diretti):** import/scala mm e chiusura contorni (`@rg/core`, `io/normalize.ts` — R11/R28), stroke filo sottile (R15), export allineato alla sorgente (R27), salvataggio con finestra di sistema (`@rg/ui/save` — R29), struttura del pannello (Testa A/B + accordion, via il subagent design-system).
- **Da `rg-oblique-embroidery-pattern-generator` — le AREE VUOTE (void):** il concetto è già in Costituzione **R5** (le void sopprimono ricamo e fori, il travel ci gira attorno). Il *codice* però vive ancora in oblique, non nel core. Se ti serve, **portalo in `@rg/core` come primitiva** (sei il secondo tool che ne ha bisogno → è esattamente il caso della regola di crescita 1) con dei test, invece di copiarlo dentro l'app.
- **Da `bitmap_to_stitch` — il CALCOLO PUNTI:** è un **satellite Python**, non si importa. Porti l'*algoritmo* (riempimento/tatami, densità — R22–R26) in TypeScript nel core o nell'app, rispettando i nomi canonici §3 e il contratto `params.schema.json`. Non tentare di eseguire Python dalla suite.
> I due repo sorgente sono fratelli nella cartella `GitHub`: leggili come **riferimento da cui portare**, non da cui importare.

## 4. Le regole che NON si violano (o rompi il sistema)
- **`packages/core`, `packages/ui`, `packages/design-system` sono CONDIVISI.** Li usano net-45 e pattern-grammar: se li rompi, rompi loro. Non modificarli "al volo" per un bisogno solo tuo — prima tieni la cosa locale nell'app, e promuovila nel core **solo quando serve davvero** (regola di crescita 2), con test.
- **Dopo ogni modifica: `npm run build` E `npm test` devono passare.** Sono la rete che protegge le primitive condivise. Se diventano rossi, hai rotto qualcosa di condiviso.
- **Ogni divergenza numerica è una decisione, non un dettaglio** (R30): se due tool rispondono diverso alla stessa domanda geometrica, si decide col ricamo in mano, si scrive in Costituzione, si blocca con un test in `test/smoke.mjs`. Mai "scelgo quella che sembra ragionevole".
- **UI/componenti/CSS: comanda il subagent `design-system`.** Non inventare markup o classi `rg-*` a mano. Il prefisso `rg-` è del DS.
- **Il repo del Design System NON si merge/tagga da qui.** Merge, tag e versioni li fa Lorenzo. Tu al massimo *consumi* un tag esistente.
- **`STATO.md` si aggiorna nello stesso commit.** Prima guardi il codice reale (non vai a memoria), poi spunti/aggiungi/togli. Cita le regole R nei messaggi di commit.

## 5. Come si aggiunge un tool senza rompere niente
1. Nuova cartella `apps/<nome>` con il suo `vite.config.ts` (alias a `@rg/core`, `@rg/ui`), `index.html`, `main.ts`.
2. Esporta una funzione `mount<Nome>(root, {backHref})`: il tool è **sia standalone sia integrato** nella shell.
3. Importa `@rg/ui/rg.css`, usa le classi `.rg-*` e i token `var(--rg-*)`.
4. Registra il tool in `packages/ui/src/tools.ts` (card della home) e aggiungi la route in `apps/shell`.
5. Pannello: **struttura canonica** (testa sempre aperta → corpo in accordion → coda Preset), chiedendo la forma esatta al subagent design-system.
6. Se ti serve una primitiva nuova nel core: **estraila** (con test), non duplicarla.

## 6. Prima mossa
Leggi i 4 documenti del §0 e aspetta il secondo messaggio (§2). Poi, **prima di scrivere codice**, proponi un piano in 5 punti di *come* costruirai il tool e *quali* pezzi porterai da oblique e da bitmap. Poi si procede un pezzo alla volta, con build+test verdi e `STATO.md` aggiornato a ogni passo.

# RG Embroidery Tools Suite

**Strumenti per il ricamo industriale che girano nel browser.** Ogni strumento prende una sagoma
(SVG/DXF) o un'immagine e produce un **tracciato di ricamo** da esportare per Illustrator/Stilista
(**SVG**) o per la macchina (**DST** Tajima). Niente server, niente installazioni: è tutto lato browser.

Brand in interfaccia: **RG Tools**.

---

## Come si avvia

**Doppio clic su `avvia.bat`** (nella cartella del progetto).

La prima volta installa da solo le dipendenze, poi apre la home su `http://localhost:5270/`.
Per fermarlo, chiudi la finestra nera. Dalla stessa rete Wi-Fi/LAN la suite è raggiungibile anche
dagli altri dispositivi all'indirizzo che compare alla riga *Network:*.

**Requisito unico: [Node.js](https://nodejs.org) 20 o superiore** (LTS va bene).

Da terminale, l'equivalente è:

```bash
npm install && npm run suite
```

---

## Gli strumenti

| Strumento | Cosa fa | Ingresso |
|---|---|---|
| **Rete 45°** (`net-45`) | rete di cordoncini a 45° su una sagoma, filo continuo | SVG/DXF |
| **Generatore pattern** (`pattern-grammar`) | pattern e basi ricamo da grammatica (cannage e altro) | formato + sagoma opzionale |
| **Interlace** (`interlace`) | riempimento a intreccio multicolore, passaggi brevi, aree vuote | SVG/DXF o misure |
| **Bitmap → Stitch** (`bitmap`) | da immagine raster a punti ordinati | PNG/JPG |
| **Oblique Pattern** (`oblique`) | Broderie Anglaise: pattern obliquo a livelli + fori laser | SVG/DXF |
| **Punto Striato** (`striatura`) | striature verticali che formano macchie maculate | SVG/DXF o misure |

La **guida d'uso** è dentro l'applicazione (bottone *Guida* nella topbar) ed è generata da
[`MANUALE.md`](MANUALE.md): unica fonte, non si sdoppia.

---

## Com'è fatto

Monorepo a workspace npm. Il codice condiviso sta in `packages/`, gli strumenti in `apps/`.

```
apps/shell               HOME della suite (hash routing: #/net-45, #/interlace, …)
apps/<tool>              i sei strumenti; ognuno esporta mount<Tool>(root)
packages/core            @rg/core — mm, import SVG/DXF, geometria, punti, export SVG + DST
packages/ui              @rg/ui — design system + topbar + pan/zoom + salvataggio + guida
packages/pattern-grammar motore del Generatore pattern
packages/design-system   RG Design System (submodule git, pinnato a un tag)
```

Ogni strumento è **sia standalone sia integrato**: la shell lo monta dentro di sé, ma
`npm run dev:<tool>` lo apre da solo sulla sua porta.

Il **design system è un submodule**: se la cartella `packages/design-system` è vuota,

```bash
git submodule update --init --recursive
```

---

## Comandi

```bash
npm run suite        # avvia la suite e apre il browser (come avvia.bat)
npm run dev          # avvia la suite senza aprire il browser
npm run dev:oblique  # apre un singolo strumento (dev:net-45, dev:interlace, dev:bitmap, dev:striatura, …)
npm test             # smoke test delle primitive condivise e dei motori
npm run typecheck    # controllo dei tipi (la build non lo fa: vite usa esbuild)
npm run build        # sito statico in apps/shell/dist
```

`npm test` e `npm run typecheck` girano anche in CI a ogni push, insieme alla build e alla
pubblicazione su GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

---

## Aggiungere uno strumento

Il procedimento completo è in [`AVVIO-NUOVO-TOOL.md`](AVVIO-NUOVO-TOOL.md). In breve:

1. `apps/<nome>` con `vite.config.ts`, `index.html`, `main.ts`, `tsconfig.json` (copia da un tool esistente).
2. Esporta `mount<Nome>(root, { backHref })` da `src/tool.ts`.
3. Importa `@rg/ui/rg.css` e usa solo classi `.rg-*` e token `var(--rg-*)`.
4. Registra il tool in **tre punti della shell**: la card in `packages/ui/src/tools.ts`, la route in
   `apps/shell/src/main.ts`, e **l'alias `@app/<nome>` sia in `apps/shell/vite.config.ts` sia in
   `apps/shell/tsconfig.json`** (se salti il tsconfig la build passa lo stesso e solo il typecheck se ne accorge).
5. Aggiungi la sezione dello strumento in `MANUALE.md`: l'intestazione di secondo livello deve finire
   con l'id del tool fra apici inversi (come le sezioni già presenti), così la *Guida* in-app la trova.
6. Serve una primitiva nuova nel core? **Estraila con un test**, non duplicarla.

---

## I documenti

| File | A cosa serve |
|---|---|
| [`COSTITUZIONE-RICAMO.md`](COSTITUZIONE-RICAMO.md) | le regole del dominio (R1–R31), il vocabolario, i parametri canonici |
| [`ARCHITETTURA.md`](ARCHITETTURA.md) | come i tool restano un ecosistema invece che isole |
| [`STATO.md`](STATO.md) | cosa fa oggi, **cosa c'è da fare** (la lista operativa è in §3, una voce per codice: A1, B2, C3…), cosa è bloccato — **si aggiorna nello stesso commit** del codice |
| [`MANUALE.md`](MANUALE.md) | il manuale d'uso (è anche la *Guida* in-app) |
| [`REVISIONE-PARAMETRI.md`](REVISIONE-PARAMETRI.md) | nomi, etichette e unità dei parametri, decisi uno per uno |
| [`AVVIO-NUOVO-TOOL.md`](AVVIO-NUOVO-TOOL.md) | briefing per chi apre un nuovo strumento |

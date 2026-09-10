# Avvio — le primitive del Pittorico salgono nel core

> Briefing per la chat operativa. Deciso con Lorenzo nella chat globale il **2026-09-10**.
> Leggi prima `AVVIO-NUOVO-TOOL.md` e le *regole di crescita* in `ARCHITETTURA.md`.

---

## 1. Il fatto

**Trentatré import da un'app all'altra**, con percorsi relativi che scavalcano i pacchetti:
`apps/pettine` e `apps/sfrangiatura` pescano dentro `apps/pittorico/src` e `apps/pittorico/scripts`.

Non è codice sbagliato: è codice **nel posto sbagliato**. Un'app dipende dai pacchetti, mai da
un'altra app — altrimenti il grafo delle dipendenze non lo governa più nessuno, e toccare un tool ne
rompe un altro senza che niente lo dica. Il commento in cima a `apps/pettine/src/motore.ts` lo sa già:
*«sono candidate a salire in @rg/core (regola di crescita 1: è il secondo cliente) appena qualcuno le
tocca sul serio»*.

La condizione è scaduta da un pezzo: **i clienti sono tre**, non due.

*(Erano 66 import fino al 2026-09-10, quando `pettine_v2` è stato eliminato.)*

## 2. Cosa sale, e chi la usa

Dieci funzioni, in sei moduli:

| Modulo | Cosa dà | Volte importato |
|---|---|---|
| `pittorico/src/iso-fill.ts` | `rasterizza` (regione → griglia), `livello` (marching squares su un campo scalare), `incatena` (segmenti → polilinee) | 9 |
| `pittorico/src/region.ts` | `makeRegion`, `lisciaRegione`, e il **bordo indicizzato** (qual è il bordo più vicino, e come corre lì) | 8 |
| `pittorico/scripts/bmp.ts` | `leggiBmp` — leggere un'immagine negli script headless | 7 |
| `pittorico/src/borders.ts` | `larghezzaTransizione` (quanto è larga una sfumatura nella foto), `cresciVersoISuccessivi` (la crescita verso i colori cuciti dopo), `frastaglia` | 6 |
| `pittorico/src/colonne.ts` | `buildColonne` | 2 |
| `pittorico/scripts/png.ts` | `Tela`, `scriviPng` — le immagini di verifica | 1 |

## 3. La buona notizia: il rischio grosso non c'è

Il pericolo di una promozione è avere **due nozioni della stessa cosa** (R28). Qui è già stato evitato:
`pittorico/src/region.ts` **importa** `Region` e `pointInRegion` da `@rg/core` e ci aggiunge sopra —
il tipo sta nel core dal 2026-09-04, promosso da broccato insieme a `traceRegions`. Il commento in
cima al file lo dice esplicitamente.

Quindi non si tratta di fondere due implementazioni: si tratta di **spostare le aggiunte accanto alla
base che già usano**. E sono tutti moduli senza DOM, provabili in Node — il requisito del core.

## 4. Dove va cosa

- `region.ts`, `iso-fill.ts`, `borders.ts`, `colonne.ts` → **`packages/core/src/`**, accanto a
  `regions.ts` e `fill.ts`. Attenzione ai nomi: nel core c'è già `regions.ts` (con `traceRegions`) —
  il nuovo file va chiamato in modo che la differenza sia leggibile, oppure il contenuto va fuso lì
  dentro. **Decidere questo prima di spostare**, non dopo.
- `bmp.ts`, `png.ts` → **non nel core**: non servono al ricamo, servono a *verificare*. Vanno in un
  pacchetto di servizio (`packages/testkit` o simile), che è anche il posto dove finiranno gli aiuti
  degli script headless degli altri tool.

## 5. Come farlo senza rompere niente

**Sposta, non riscrivere.** In quest'ordine, un modulo alla volta:

1. si copia il file nel pacchetto e si aggiorna `packages/core/src/index.ts`;
2. si cambiano gli import nei tre clienti (`pittorico` compreso: da oggi importa dal core come tutti);
3. si cancella l'originale;
4. `npm test` + `npm run typecheck` + `npm run build` **prima di passare al modulo successivo**.

Il comportamento deve restare **identico byte per byte**: se un tool cambia uscita, la promozione è
sbagliata e va rifatta, non "aggiustata".

## 6. Perché adesso, e non "quando qualcuno lo tocca"

Perché **Lorenzo torna a lavorare sul Pittorico** (deciso il 2026-09-10). Finché le primitive stanno
dentro `apps/pittorico`, ogni modifica al tool tocca anche pettine e sfrangiatura **senza dirlo**: non
c'è confine, non c'è test di frontiera, e il typecheck non protegge da un cambio di semantica. Portarle
nel core mette un contratto in mezzo, e da lì in poi il Pittorico si può muovere in pace.

## 7. Come si verifica

- i tre comandi verdi dopo **ogni** modulo spostato;
- `grep -rn "from '\.\./\.\./" apps/*/src/*.ts apps/*/scripts/*.ts | grep -v packages/` deve tornare
  **vuoto** alla fine: è la misura della riuscita;
- le uscite dei tool non cambiano: conviene salvare un DST di riferimento di pettine **prima** di
  cominciare e confrontarlo alla fine (stessi punti, stessi salti);
- ogni primitiva che sale porta con sé almeno un'asserzione nello smoke, se non ce l'ha già: nel core
  ci sta solo ciò che è provato.

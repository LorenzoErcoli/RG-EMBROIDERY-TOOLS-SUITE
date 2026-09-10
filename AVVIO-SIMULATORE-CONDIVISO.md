# Avvio — il simulatore diventa di tutta la suite

> Briefing per la chat operativa. Deciso con Lorenzo nella chat globale il **2026-09-10**:
> *«il simulatore lo vorrei ovunque»*. Leggi prima `AVVIO-NUOVO-TOOL.md`.

---

## 1. Perché

**Undici tool su dodici producono un DST** — net-45, pattern-grammar, interlace, bitmap, oblique,
striatura, zone-pattern, broccato, sfrangiatura, pittorico, pettine — e **solo pettine può vedere il
proprio ricamo cucirsi**. Il simulatore è nato lì il 2026-09-09, ma non ha niente di pettine dentro:
legge un DST e lo disegna.

È la promozione col miglior rapporto valore/costo di tutta la suite: **158 righe che si spostano**, e
undici tool guadagnano l'unica vista che mostra *l'ordine* — cioè dove il filo salta, dove si vede, e
quanti rasafili costa un pattern. Le anteprime attuali mostrano la geometria; il simulatore mostra la
**sequenza**, che è la cosa che Lorenzo giudica.

## 2. Cosa si sposta

`apps/pettine/src/simulatore.ts` → **`packages/ui/src/simulatore.ts`**.

Dipende da due cose sole: `readDst` di `@rg/core` e il DOM. È esattamente il profilo degli altri
inquilini di `@rg/ui` (`panzoom`, `save`, `manual`), che sono aiuti DOM condivisi.

```ts
montaSimulatore(
  host: HTMLElement, controlli: HTMLElement, dst: Uint8Array,
  colori: string[], larghezzaMm: number, altezzaMm: number, stato: (s: string) => void,
): Simulatore   // { distruggi(): void }
```

Com'è fatto dentro, per chi ci mette le mani: tre tele sovrapposte — la base grigia disegnata una
volta, il filo cucito che cresce di un pezzo alla volta (avanzare costa solo i punti nuovi), l'ago
ridisegnato a ogni quadro. Tornare indietro ridisegna il cucito da capo: al massimo duecentomila
segmenti, mezzo secondo. I salti restano **tratteggiati in rosso**, perché sono la cosa da guardare.

**Sposta, non riscrivere.** Il file va bene com'è: cambia solo dove abita.

## 3. Cosa si aggiunge a ogni tool

Il modello è già scritto in `apps/pettine/src/tool.ts`: un bottone **Simula** nello stage-header
(`rg-button rg-button--ghost` con `aria-pressed`), una vista che si alterna all'anteprima, una riga di
controlli (avanzamento e velocità) nascosta finché la vista non è attiva, e `distruggi()` quando si
cambia vista o si smonta il tool.

Serve al simulatore quello che ogni tool già sa: il **DST appena generato**, i **colori** nell'ordine
degli aghi, e la **misura in mm**. Nessun tool deve calcolare niente di nuovo.

**Un tool alla volta**, in quest'ordine — dal più utile: `broccato` e `pittorico` (molti aghi, molti
passaggi), `striatura` e `interlace` (i salti sono il tema), `oblique`, `zone-pattern`, `sfrangiatura`,
`net-45`, `bitmap`, `pattern-grammar`.

## 4. Le trappole viste

- **Il DST va letto, non ricostruito.** Il valore del simulatore è che mostra *quello che va in
  macchina*: cambi-ago e salti compresi. Se un tool gli passasse le sue polilinee invece del DST,
  mostrerebbe una bugia comoda.
- **Il tool non deve generare due volte.** Il DST è già in mano al bottone "Esporta DST": si riusa
  quello, non si rigenera per la vista.
- **`distruggi()` è obbligatorio.** Il simulatore tiene un `requestAnimationFrame` e i listener dei
  controlli: senza, cambiando tool restano vivi.

## 5. Come si verifica

- `npm test`, `npm run typecheck`, `npm run build` verdi (il simulatore è DOM, quindi lo smoke non lo
  esegue: quello che si può bloccare è `readDst`, ed è già coperto);
- nel browser, su almeno **due** tool diversi: il filo si colora nell'ordine giusto, i salti si vedono
  rossi, il conteggio in stato torna con quello dell'export, e uscendo dalla vista non resta niente
  che gira;
- il numero che vale la pena guardare mentre si fa: **quanti rasafili** mostra ogni tool. È la prima
  volta che diventa visibile per tutti.

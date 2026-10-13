# Avvio — un'interfaccia sola per tutti i tool

> Briefing per la chat operativa. Chiesto da Lorenzo nella chat globale il **2026-10-13**:
> *«vorrei anche che a livello estetico e di interfaccia tutto sia simile tra i vari tools»*.
> È il gemello di [`AVVIO-CERVELLO-RICAMO.md`](AVVIO-CERVELLO-RICAMO.md): il cervello dà ai tool una
> lingua sola, questo dà loro una faccia sola. Le fasi sono in §5.

---

## 1. La ricognizione (misurata nel browser il 2026-10-13, tutti e 15 i tool)

**Lo scheletro è già comune.** Tutti e 15 usano il guscio del design system (`rg-workspace`: pannello,
intestazione dell'anteprima, tela, barra di stato) e le sezioni numerate `rg-param-section`. Il pannello
è largo 380 px in 14 tool su 15. Il design system funziona: quello che diverge è **cosa ogni tool ci
mette dentro**, perché ognuno scrive il suo HTML a mano.

| Cosa | Com'è oggi |
|---|---|
| **Bottoni dell'anteprima** | 9 combinazioni diverse per 15 tool. Ordine: net-45 *Adatta · DST · SVG*, oblique *SVG · DST · Adatta*, razza *Genera · SVG · DST · Adatta*, pattern-macchie *Simula · Adatta · Genera · DST · SVG*… Il bottone pieno è a volte l'SVG, a volte il DST, a volte *Genera*. |
| **Nome dell'export** | *Esporta* in 10 tool, *Scarica* in 4 (pattern-grammar, zone-pattern, cannage-rafia, pattern-macchie), *Salva* in pettine. Nel pittorico gli export stanno **nel pannello**, non nell'intestazione; nel cross-stitch *Adatta* sta nella barra di stato. |
| **Genera** | nell'intestazione in 6 tool, nel pannello nel pittorico, assente negli altri (ricalcolo continuo). Solo razza ha la casella *Ricalcola da solo*. |
| **Simula** | **3 tool su 15** (cannage-rafia, pettine, pattern-macchie). Lorenzo l'ha chiesto ovunque il 2026-09-10 (P1). |
| **Riaprire un progetto** | 5 forme: un bottone *Apri progetto o DST* (razza), *Riapri un progetto* (pittorico), una sezione *Progetto* (oblique), *Carica parametri* (interlace, bitmap, cross-stitch — in due senza numero di sezione), *Preset* (pattern-grammar, razza), oppure lo stesso bottone di caricamento (net-45 e altri). |
| **Demo** | 7 tool hanno un esempio pronto (*Cartamodello demo*, *Sagoma demo*, *Immagine demo*, *Usa il pannello di esempio*…), 8 no. |
| **Sezione 01** | 7 nomi: Cartamodello, Sagoma, Disegno, Immagine, Formato e scala, Blocchi e fotografia, Ricamo di partenza. |
| **Campi numerici** | campo del browser con le frecce (vuole il punto) in 12 tool, campo di testo che accetta la virgola in 3 (cross-stitch, pettine, razza). 6 campi numerici **senza lo slot dell'unità** (interlace 5, pittorico 1). |
| **Etichette** | *«Larghezza reale (0 = auto)»* in net-45 e razza: il `(0 = auto)` nell'etichetta è proprio quello che REVISIONE-PARAMETRI aveva deciso di togliere. Lo stesso campo si chiama in tre modi. |
| **Titoli** | intestazione *Anteprima* in 14 tool, *Disegno* nel cross-stitch. Topbar *Oblique* contro *Oblique Pattern* del registro. |
| **Fuori dal design system** | cross-stitch 22 classi proprie e 9 colori scritti a mano negli stili; gli altri da 0 a 5 classi proprie. (Una parte è legittima: il campione di colore di un filo è un colore vero.) |

**In una riga:** non serve rifare l'estetica, serve fissare l'**anatomia** di un tool RG e farla
costruire da `@rg/ui` invece che a mano.

---

## 2. Le decisioni di Lorenzo (2026-10-13)

| # | Domanda | Deciso |
|---|---|---|
| **U-D1** | Nome e ordine degli export | **«Esporta SVG» · «Esporta DST»**, sempre in quest'ordine a destra; **il bottone pieno è il DST** (è il programma per la macchina). |
| **U-D2** | Il campo numerico | **Uno solo per tutta la suite che accetta sia 0,4 sia 0.4**, con le frecce ↑↓ della tastiera per il passo, e lo slot dell'unità sempre. |
| **U-D3** | Il nome della sezione 01 quando entra un vettore | **Cartamodello.** Per un'immagine resta **Immagine**, per un DST **Ricamo di partenza**. |
| **U-D4** | Ricalcolo | **«Genera» ovunque, sempre allo stesso posto**, con la casella **«Ricalcola da solo»** (come in razza): accesa dove il calcolo è veloce, spenta dove è pesante. Rispetta il modello a fasi dei tool pesanti ([migrare senza appiattire](sapere/metodo/migrare-senza-appiattire.md)). |

---

## 3. L'anatomia di un tool RG

```
┌ topbar ─────────────────────────────────────────────────────────────────────────────┐
│ ← RG Tools │ <nome del registro tools.ts>                                     Guida │
├ pannello 380 px ─────────────┬ anteprima ───────────────────────────────────────────┤
│ 01 Cartamodello | Immagine | │ Anteprima  [viste: Originale·Ricamo…]                 │
│    Ricamo di partenza        │        ☐ Ricalcola da solo  [Genera]  Simula  Adatta  │
│    [Carica …]                │                          │ Esporta SVG [■ Esporta DST]│
│    [Apri progetto o DST]     ├──────────────────────────────────────────────────────┤
│    Cartamodello demo         │                                                      │
│    Larghezza reale ___ mm    │                      tela                            │
│ 02 Colori e ruoli | Colori   │                                                      │
│ 03…  le sezioni del tool     │                                                      │
│      (chiudibili)            │                                                      │
│ NN Progetto                  ├──────────────────────────────────────────────────────┤
│    preset: salva/carica…     │ messaggio          punti · filo · salti     zoom 100% │
└──────────────────────────────┴──────────────────────────────────────────────────────┘
```

- **La topbar** porta il nome del registro (`packages/ui/src/tools.ts`), uno solo.
- **La sezione 01** è uguale in tutti: caricare, riaprire (un bottone solo, *Apri progetto o DST*, che
  accetta anche l'SVG esportato), l'esempio pronto, la larghezza reale. **Ogni tool ha un esempio**:
  serve a chi lo apre la prima volta, e servirà al campionario vivo (§8 del cervello).
- **Le sezioni del tool** vengono dopo la 02, numerate di seguito, chiudibili.
- **L'ultima sezione è *Progetto*** (i preset e l'import/export dei parametri), uguale in tutti.
- **L'intestazione dell'anteprima** ha a sinistra il titolo e le eventuali viste del tool; a destra
  sempre lo stesso ordine: *Ricalcola da solo* · **Genera** · *Simula* · *Adatta* | *Esporta SVG* ·
  **Esporta DST** (pieno). Un tool che non ha una di queste cose lascia il posto vuoto, non le riordina.
- **La barra di stato**: a sinistra il messaggio, a destra il **referto** (punti · metri di filo ·
  salti: è la K3 del cervello) e lo zoom.
- **Le etichette** seguono REVISIONE-PARAMETRI: italiano, unità sempre nello slot, mai nel testo, niente
  `(0 = auto)` nell'etichetta (va nell'aiuto sotto il campo). Quando il registro dei parametri esiste
  (K1), etichetta, aiuto, unità e limiti si prendono da lì.

Le parti proprie di un tool (la barra di modifica del cross-stitch, le viste del broccato, i controlli
del simulatore) restano sue, ma usano componenti del design system e i suoi token: niente colori
scritti a mano, tranne i campioni di colore dei fili, che sono dati.

---

## 4. Il meccanismo: l'anatomia la costruisce `@rg/ui`

Come per il cervello (K1b, il contratto del motore): finché ogni tool scrive il suo HTML a mano, ogni
tool nuovo nasce un po' diverso — ed è successo, razza e pattern-macchie sono arrivati con un ordine
dei bottoni loro. Quindi i pezzi comuni diventano **funzioni di `@rg/ui`**, e il tool passa solo le sue
sezioni:

- `campoNumero({ id, etichetta, unita, passo, min, max, aiuto })` — virgola e punto, frecce ↑↓, slot
  dell'unità (U-D2);
- `sezioneSorgente({ tipo: 'cartamodello'|'immagine'|'dst', demo, accetta })` — la sezione 01 (U-D3);
- `barraAnteprima({ viste, genera, simula, adatta, esporta })` — l'intestazione nell'ordine fisso (U-D1, U-D4);
- `sezioneProgetto({ preset })` — l'ultima sezione;
- `barraStato()` con lo spazio del referto.

**Il cricchetto**, come per i parametri: un test in `test/smoke.mjs` che fallisce se un tool scrive a
mano un'intestazione dell'anteprima, un campo numerico o una sezione 01 invece di usare questi
componenti, con una lista del debito che può solo scendere. Così un tool nuovo non può nascere
diverso.

**Il design system:** l'anatomia di §3 è un *pattern* d'uso dei componenti che esistono già, e non
serve un componente nuovo nel DS per partire. Se nel lavoro ne manca uno (per esempio il campo che
accetta la virgola), lo si chiede all'agente `design-system`, come sempre.

---

## 5. Le fasi — una chat operativa, un ramo suo

| # | Fase | Fatto quando |
|---|---|---|
| **U1** | **I componenti comuni in `@rg/ui`** (§4) + il cricchetto con la lista del debito | i componenti esistono, sono usati da un tool di prova, il test è verde e diventa rosso se lo rompi apposta |
| **U2** | **Migrare i tool all'anatomia, uno alla volta**, partendo dai più lontani: cross-stitch, pittorico, pettine, razza, pattern-macchie; poi gli altri | il debito del cricchetto è a zero; per ogni tool, prima e dopo guardati nel browser |
| **U3** | **Simula in tutti i tool** (chiude P1) | il bottone c'è in 15 tool su 15 |
| **U4** | **Un esempio pronto in ogni tool** | 15 su 15 |
| **U5** | **Le etichette dal registro dei parametri** (dopo K1) — chiude anche A5 | nessuna etichetta scritta a mano nei pannelli |

**Due regole per non pestarsi i piedi:**
1. **Si lavora su un ramo proprio, in un `git worktree` separato** — nella cartella principale lavorano
   altre chat (oggi pattern-macchie ha modifiche non committate, e la chat del K1 ha il suo ramo).
2. **Un tool su cui una chat operativa sta lavorando si migra per ultimo**, o lo migra quella chat
   seguendo questo briefing. Da oggi vale per tutte le chat: *quando tocchi un tool, portalo
   all'anatomia* (regola di crescita 4).

**Cosa non cambia:** nessun motore, nessun parametro, nessun file di progetto. È solo la faccia.

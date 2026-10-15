# Avvio — il cervello del ricamo

> Briefing per le chat operative. Chiesto da Lorenzo nella chat globale il **2026-09-28**:
> *«creare un cervello che possa funzionare come agente, esperto di ricamo e in grado di
> parametrizzare i progetti di ricamo. Quindi in grado in primis di omogeneizzare tutti i tools,
> e poi di omogeneizzare le conoscenze.»*
> Leggi prima `ARCHITETTURA.md` e `COSTITUZIONE-RICAMO.md`. Le fasi sono in §6, una chat per fase.

---

## 1. Il controllo globale: com'è oggi (misurato il 2026-09-28)

| Cosa | Misura | Cosa vuol dire |
|---|---|---|
| Tool nella suite | **13** (9 in *Strumenti*, 4 in *In sviluppo*) | Tutti con motore in TS puro, tutti montati dalla shell. |
| Tool che scrivono un file riapribile | **13 su 13** (SVG col `<metadata>`, DST col footer) | La base dell'interscambio **c'è già**. |
| Tool che aprono il file di **un altro** tool | **0 su 13** | Ognuno legge solo il suo `rgProject`; tre lo dicono (*«Questo file viene da X, non da qui»*), gli altri tacciono. |
| Forma del file di progetto | solo **`rgProject`** è uguale in tutti | I parametri stanno in `params` in 11, in `par` in pettine, sparsi in 5 chiavi in cross-stitch; la versione manca o si chiama `versione` in 4. |
| Parametri fisici distinti nel codice | **211** nomi (`…Mm`, `…Deg`, `…Pct`) | Italiano e inglese mescolati. |
| Nomi canonici della Costituzione §3 | **18 su 35** controllati **non usati da nessuno** | Il vocabolario ufficiale è metà promessa: descrive una lingua che il codice parla solo in parte. |
| Stesso concetto, due nomi | `realWidthMm`/`larghezzaRealeMm` (pettine li ha tutti e due), `threadMm`/`filoMm`, `jumpMm`/`saltoMm` | È il problema che §3 diceva di risolvere «alla radice». |
| `params.schema.json` | **non esiste** | `ARCHITETTURA.md` lo disegna come contratto che governa il core; la Costituzione lo promette. |
| Simulatore | in `@rg/ui`, **usato da 2 tool** (pettine, cannage-rafia) | P1 è a metà: si è spostato, non si è diffuso. |
| Dove sta la conoscenza di mestiere | Costituzione (31 regole), STATO (2.028 righe), REVISIONE-PARAMETRI, MANUALE, 6 briefing, il laboratorio di pettine, i DST di riferimento — **e 20 note nella memoria dell'assistente, fuori dal repo** | Decisioni preziose (*«densità = cella»*, *«ruota il piano, non il modulo»*, *«immagini, non vettori»*…) le vedeva **solo l'assistente**. **Portate in [`sapere/`](sapere/LEGGIMI.md) lo stesso giorno** (D2). |

> **Aggiornamento 2026-10-13 — il debito cresce mentre il cervello aspetta.** In due settimane i tool
> sono passati da **13 a 15** (*Pelle di razza*, *Pattern a macchie*) e i nomi di parametri fisici da
> **211 a 226**; `packages/cervello` non esiste ancora. Ogni tool nuovo nasce con la sua lingua. Per
> questo il cervello va **prima** dei prodotti per i clienti (§8), non dopo.

**In una riga:** i tool hanno già un canale per parlarsi (il file riapribile) ma non una lingua
comune per farlo, e la conoscenza che li ha fatti nascere è sparsa in dieci posti, uno dei quali
fuori dal repo.

---

## 2. Cos'è il cervello

**Un pacchetto di dati, non un programma magico.** Tre strati, ognuno utile da solo, ognuno
costruito sopra il precedente:

```
  3. IL CERVELLO AL LAVORO    un agente che legge 1+2, lancia i motori senza interfaccia,
                              misura, guarda, e consegna un file di progetto che il tool apre
                                               ▲
  2. UNA CONOSCENZA SOLA      sapere/ — tecniche, decisioni di Lorenzo, riferimenti misurati,
                              materiali: in forma che si legge E si controlla
                                               ▲
  1. UNA LINGUA SOLA          il registro dei parametri + la busta di progetto comune +
                              la scheda di ogni tool (cosa prende, cosa dà, cosa sa fare)
```

L'ordine è quello chiesto da Lorenzo — prima i tool, poi le conoscenze — ed è anche l'unico che
regge: un agente che parametrizza deve sapere **che nome ha** ogni parametro in ogni tool, altrimenti
consiglia `densitySpacingMm` a un tool che lo chiama in un altro modo.

**Cosa non è.**
- **Non è un'intelligenza dentro il browser.** La suite è statica e senza server (è la sua forza, e
  la ragione per cui gira su GitHub Pages): il cervello sono **dati nel repo** che il browser usa
  per i nomi e i controlli, e che un agente fuori dal browser usa per ragionare.
- **Non decide la resa.** La resa la giudica Lorenzo guardando il ricamo: misure verdi non dicono che
  la resa sia quella giusta. Il cervello propone, misura e mostra; il sì lo dà lui, e il sì diventa
  una decisione scritta.
- **Non sostituisce i motori.** Li chiama.

---

## 3. Strato 1 — Una lingua sola (omogeneizzare i tool)

### 3a. Il registro dei parametri

Un solo file in TypeScript, `packages/cervello/src/parametri.ts`, con **ogni parametro di ogni tool
dichiarato una volta**:

```ts
{
  id: 'densitySpacingMm',                 // il nome canonico, quello del codice
  etichetta: 'Densità',                   // quella del pannello (REVISIONE-PARAMETRI → qui)
  aiuto: 'distanza di traverso tra due file di filo',
  unita: 'mm', min: 0.2, max: 2, passo: 0.05,
  regole: ['R22', 'R23'],                 // da cosa dipende
  concetto: 'densita',                    // per raggruppare i parenti (vedi sotto)
  sinonimi: ['satinDensity', 'line_spacing'],  // i nomi vecchi, per leggere i file vecchi
  tool: { interlace: 0.5, broccato: 0.45 },    // chi lo usa e con che default
}
```

Da questo file si **genera** `params.schema.json` (quello promesso, per il satellite Python e per
l'agente) e si possono generare le etichette dei pannelli: A5 e `REVISIONE-PARAMETRI.md` finiscono
qui dentro invece che in una tabella da ricopiare.

**Due parametri con lo stesso `concetto` e nomi diversi non si fondono d'ufficio.** È la regola 7
dell'architettura: una divergenza è una decisione. Il registro le rende **visibili** (il concetto
`densita` elenca tutti i modi in cui la suite la misura oggi); unificarle è lavoro per tool, col
ricamo in mano.

### 3b. Il cricchetto

Un test in `test/smoke.mjs` che legge i parametri salvati da ogni tool e **fallisce se uno non è nel
registro**. Parte verde con una lista del debito (i nomi non ancora registrati) che **può solo
scendere**: un tool nuovo non può aggiungere un parametro senza dichiararlo, uno vecchio non può
rinominarlo senza lasciare il sinonimo. È lo stesso meccanismo che ha portato gli import da un'app
all'altra da 66 a 1.

### 3c. La busta di progetto

Oggi l'unica chiave comune è `rgProject`. La busta v1 fissa il resto — **aggiungendo, non
togliendo**: ogni tool continua a leggere i suoi file vecchi.

```ts
{
  rg: 1,                                   // versione della busta
  tool: 'striatura', toolVersion: '0.1.0',
  params: { … },                           // solo id del registro
  sorgente: { tipo: 'svg'|'dxf'|'raster'|'dst', nome, larghezzaMm, altezzaMm, frame },
  ruoli: { '#ff0000': 'perimetro', … },    // R12
  fili: [{ colore, nome?, tex? }],         // aghi in ordine di cucitura
  misure: { punti, filoM, saltiN, filoInVistaMm, … },   // il referto, sempre uguale
  // + le chiavi proprie del tool, come oggi
}
```

E nel core `leggiProgetto(file)` che **accetta la busta di qualunque tool** e restituisce quello che
c'è. Da lì l'interscambio vero: aprendo in *Pattern a zone* un file di *Bitmap → Stitch*, il tool
non dice più «non è mio» ma prende **la sorgente, la misura reale, i ruoli e i fili** — le cose che
hanno lo stesso significato ovunque — e lascia stare i parametri del motore altrui.

Le `misure` sono la parte che serve all'agente: ogni tool, esportando, scrive lo stesso referto
(punti, metri di filo, salti, filo in vista), così due soluzioni si confrontano coi numeri anche
se vengono da tool diversi.

### 3d. La scheda del tool

Il registro dei tool (`packages/ui/src/tools.ts`) oggi dice nome e descrizione. Cresce con:
cosa prende (`svg`, `dxf`, `raster`, `dst`), cosa dà, quali **tecniche** della tassonomia R24 sa
fare, quali parametri usa (dal registro). È quello che permette all'agente — e alla home — di
rispondere a *«ho una foto di un degradé, con cosa lo faccio?»*.

### 3e. Il contratto del motore — quello che permette di *pilotare* i tool

Un cervello che pilota tutti i tool ha bisogno di poterli **chiamare tutti nello stesso modo**. Misurato
il 2026-10-13: **i 15 motori sono già tutti senza DOM** (nessun file fuori da `tool.ts` tocca
`document` o `window`) — la buona notizia: sono pilotabili. Ma la porta d'ingresso ha **15 forme
diverse**: `runPipeline` in tre tool, `buildPlan` nel broccato, `generaLinee`/`generaCornice`/
`generaBordatura` nel cannage, `generateStitch` in bitmap, `costruisciPettine`, `costruisciMacchie`, `sfrangia`…; nel cross-stitch
e nella razza il motore è un insieme di funzioni messe in fila dentro `tool.ts`.

Il contratto, uguale per tutti, accanto al motore che c'è già (non al suo posto):

```ts
// apps/<tool>/src/motore.ts — il tool lo esporta, la shell e il cervello lo chiamano
export const motore: Motore = {
  id: 'razza',
  scheda,                                   // 3d: ingressi, uscite, tecniche, parametri
  async genera(ingresso: Ingresso, params: Params): Promise<Risultato>,
};
// Ingresso   = { sagoma?: Contour[], immagine?: Raster, dst?: Uint8Array, larghezzaMm? }
// Risultato  = { strati: ExportLayer[], busta: Busta, misure: Referto, avvisi: string[], vista?: V }
```

**`vista`, lo spazio per il pannello** — decisione di Lorenzo del **2026-10-15** (strada A). Il pannello di un
tool può aver bisogno di più del ricamo: la razza vuole il numero dei pallini, le percentuali, i dettagli
dell'anteprima, e per questo il suo Worker chiamava `costruisci` invece di `genera`. Invece di lasciare due
strade (il pannello la sua, il cervello `genera`: col tempo si separano senza che nessuno se ne accorga),
il `Risultato` ha una parte `vista`, propria di ogni tool, che il pannello usa e il banco e l'agente
ignorano. **Una chiamata sola per tutti.** Si aggiunge nella U2, quando i pannelli passano a `genera`.

Con questo il pannello di ogni tool, il banco (K7), l'agente (K8) **e** i prodotti per i clienti (§8)
chiamano la stessa funzione: un tool non ha più un motore per l'interfaccia e un altro per i test.
Si fa **un tool alla volta**, avvolgendo quello che c'è; il segno che è fatto è un test che chiama
`genera` su ogni tool registrato con una sagoma di prova e controlla che esca un DST e un referto.

---

## 4. Strato 2 — Una conoscenza sola (omogeneizzare le conoscenze)

Una cartella **`sapere/`** alla radice. File Markdown con un'intestazione a campi, una cosa per file,
come le note di memoria che già funzionano:

```
sapere/
  tool/         cos'è ogni tool, da quale riferimento è nato, le decisioni che lo definiscono   ✅
  decisioni/    le scelte di resa e di modello, col perché e le strade provate e scartate       ✅
  metodo/       come si lavora con Lorenzo e su questo repo, valido per tutti                   ✅
  codice/       fatti del codice che non si vedono leggendolo (formati, trappole)               ✅
  riferimenti/  i DST e i file di riferimento: dove stanno; poi le loro misure (K6)             ✅ indice
  tecniche/     una per tipo di punto, coi range dei parametri presi dal registro (dopo K1)
  materiali/    fili (Cieffe Makò Ne 30/2 = 39,4 tex…), supporti (termogarza…), aghi
```

**Fatto il 2026-09-28:** le 20 note sono in `sapere/`, con la forma dei file e le regole in
[`sapere/LEGGIMI.md`](sapere/LEGGIMI.md). Restano di K5: le decisioni sparse in STATO, `tecniche/`,
`materiali/` e il test di coerenza col registro (che aspetta K1).

**Da dove arriva, senza inventare niente:**
1. le **20 note della memoria dell'assistente** → `decisioni/` e `tecniche/` (sono di Lorenzo: devono
   stare dove le vede lui e dove le vede ogni chat);
2. le **decisioni sparse in STATO** e nei blocchi per tool → `decisioni/`, con un rimando;
3. `REVISIONE-PARAMETRI.md` → nel registro (3a), e il file si cancella come dice lui stesso;
4. i **DST di riferimento** (`PUNTO-STRIATURA`, `BROCCATO`, M1404 del cannage, pettine…) → uno script
   li passa a `readDst` e scrive le misure in `riferimenti/`. Un riferimento si legge e se ne tirano
   fuori i valori, non si ricalca: qui diventa un sistema.

**E si controlla come il codice.** Un test verifica che ogni parametro citato in `sapere/` esista nel
registro, ogni tecnica punti a un tool vero, ogni riferimento a un file che c'è. Così la conoscenza
e i tool non possono divergere in silenzio — la stessa lezione dei 18 nomi canonici mai usati.

La Costituzione **resta** la legge (le regole R1–R31 non si spostano): `sapere/` è la giurisprudenza,
cioè come le regole si sono applicate caso per caso.

---

## 5. Strato 3 — Il cervello al lavoro (l'agente)

### 5a. Il banco senza interfaccia

Un comando che fa girare **qualunque** motore da riga di comando:

```bash
npm run cervello -- prova striatura sagoma.svg --densitySpacingMm 0.45 --out prova/
```

e scrive **la busta, il DST, un PNG del ricamo e il referto delle misure**. I pezzi ci sono già
tutti: i motori sono TS puro (`smoke.mjs` li fa girare con esbuild), il PNG c'è in
`packages/testkit`, il laboratorio di pettine lo fa già per un tool solo.

È la differenza fra un agente che **indovina** i parametri e uno che li **prova**: lancia, misura
contro il riferimento in `sapere/riferimenti/`, guarda il PNG, corregge, rilancia.

### 5b. L'agente

Un agente di Claude Code con la sua scheda (`esperto-ricamo.md`), come quello del design system che
già esiste. Legge il registro, le schede dei tool e `sapere/`; usa il banco. Gli si chiede:

- *«ho questa foto e questa sagoma da 300 mm, fammi un broccato su termogarza»* → sceglie il tool,
  propone i parametri citando la decisione o il riferimento da cui vengono, li prova sul banco, e
  consegna **un file di progetto** che il tool apre con *Riapri* — parametri già messi, pronto da guardare;
- *«perché in interlace la densità è per cella?»* → risponde con la decisione e la sua data;
- *«questo parametro esiste già in un altro tool?»* → risponde dal registro.

### 5c. Il giro che impara

Il laboratorio dei casi (P4) diventa il canale di ritorno: il motore registra una scelta, Lorenzo
scrive *«come andrebbe fatto»*, la risposta diventa una decisione in `sapere/decisioni/`, la
decisione diventa un test. Il cervello cresce **solo** da risposte di Lorenzo e da misure — mai da
supposizioni.

---

## 6. Le fasi — una chat operativa per fase

| # | Fase | Fatto quando | Peso |
|---|---|---|---|
| **K1** | **Registro dei parametri** (`packages/cervello`) per tutti i tool + generazione di `params.schema.json` + **il cricchetto** con la lista del debito | il test è verde, il debito è una lista scritta e può solo scendere | medio |
| **K1b** | **Il contratto del motore** (§3e): ogni tool esporta `motore.genera(ingresso, params)` con la stessa forma, avvolgendo il motore che c'è | un test chiama `genera` su tutti i tool registrati e da ognuno esce un DST e un referto | medio |
| **K2** | **La busta v1** + `leggiProgetto` nel core; ogni tool scrive la busta e legge i propri file vecchi; il primo interscambio vero (sorgente + misura + ruoli + fili da un file di qualunque tool) | un file di un tool si apre in un altro e porta con sé quello che ha senso | medio |
| **K3** | **Il referto comune** (`misure` nella busta, calcolate dal DST con una funzione sola) | due tool diversi, stesso referto, stessi numeri sullo stesso DST | piccolo |
| **K4** | **Le schede dei tool** in `tools.ts` (ingressi, uscite, tecniche R24, parametri) | la home e l'agente sanno cosa fa ogni tool senza leggere il codice | piccolo |
| **K5** *(a metà)* | **`sapere/`** + migrazione delle 20 note (✅ fatta) e delle decisioni di STATO + il test di coerenza | ogni decisione di Lorenzo ha un file, una data e un perché, nel repo | medio |
| **K6** | **I riferimenti misurati**: lo script che legge i DST di riferimento e scrive le loro misure | ogni tecnica ha i suoi numeri veri accanto | piccolo |
| **K7** | **Il banco** (`npm run cervello -- prova …`) su tutti i motori | ogni tool gira da riga di comando e dà busta + DST + PNG + referto | medio |
| **K8** | **L'agente** `esperto-ricamo` | dato un brief, consegna un file di progetto provato e motivato | medio |

**K1 è la prima e non aspetta nessuno; K1b subito dopo** (aggiunta il 2026-10-13: senza una porta
d'ingresso comune il cervello non può pilotare i tool, può solo descriverli). K2–K4 si possono fare in
qualunque ordine dopo K1. K5 è
partita (D2 decisa). K7 raccoglie P1 (simulatore) e P4 (laboratorio):
quando il banco esiste, il simulatore e il laboratorio ne sono due viste.

**Cosa non cambia:** nessun motore viene riscritto, nessun parametro viene rinominato d'ufficio,
nessun file vecchio smette di aprirsi. Tutto per aggiunta, un tool alla volta (regola di crescita 4).

---

## 7. Decisioni di Lorenzo — **tutte prese il 2026-09-28**

> Lorenzo: *«si parametri inglese, etichette italiano, D2 portale nel repo, si agente claude, ok d4»*.
> Le quattro proposte qui sotto sono passate come scritte.

| # | Domanda | Deciso |
|---|---|---|
| **D1** | Gli **id** dei parametri: inglese o italiano? Oggi sono mescolati; le etichette sono già tutte in italiano. | **Id in inglese camelCase** come dice già la Costituzione §3, **etichette in italiano** nel registro. I nomi italiani esistenti (`sormontoMm`, `passoMm`…) restano come sinonimi finché il loro tool non si tocca. |
| **D2** | Le **20 note** che oggi stanno nella memoria dell'assistente: si portano nel repo? | **Sì.** Sono decisioni tue: oggi le vede solo l'assistente e solo da questa cartella; nel repo le vedi tu, ogni chat, e il test che le controlla. |
| **D3** | Dove vive l'agente. | **Prima come agente di Claude Code** (come quello del design system): zero infrastruttura, e la suite resta senza server. Un pannello *Chiedi* dentro la suite è possibile dopo, perché il cervello sono dati — ma vuol dire un servizio e una chiave, ed è una scelta a parte. |
| **D4** | Quando due tool misurano lo stesso concetto in due modi (la densità di interlace e quella di bitmap, C6), chi vince? | Nessuno d'ufficio: il registro le mette una accanto all'altra, e si decide caso per caso col ricamo in mano (regola 7). |

---

## 8. Cosa ci si costruisce sopra — le proposte per i clienti nuovi

Nate nella chat globale il **2026-10-13**, alla domanda di Lorenzo *«cosa potremmo sviluppare che non
esiste, da proporre a clienti nuovi?»*. E la sua risposta: *«prima di fare questo non dovrebbe esserci
un cervello comune che pilota tutti i tools e che omogeneizza tutto?»* — sì: tutte e tre stanno in
piedi **solo** sopra K1–K3, ed è per questo che sono qui e non in una voce a parte.

| Proposta | Cosa vede il cliente | Di cosa ha bisogno |
|---|---|---|
| **Il campionario vivo** | un link privato: sceglie una tecnica RG sul **suo** cartamodello, muove 3–4 manopole, vede anteprima, cucitura simulata e stima (punti, filo, tempo macchina), invia la richiesta come file di progetto | K1b (`genera` uguale per tutti), K2 (busta), K3 (referto) + una versione *cliente* ridotta del tool, **senza DST in uscita**. Pilota proposto: la pelle di razza sulla Venere 85 |
| **Il pezzo unico riproducibile** | ogni pezzo di una serie ha un ricamo diverso (macchie, pallini, intreccio dal caso) con la stessa resa e un numero — il seme — per ricucirlo identico | K1b + verificare che ogni motore sia deterministico a parità di seme + un generatore di serie che scarta le varianti fuori tolleranza col referto |
| **Il ricamo che si adatta al pezzo** | un ricamo progettato una volta e rigenerato su tutte le taglie e tutti i pezzi (pallini della loro misura, nel cannage crescono gli oggetti, aree di scarico al montaggio) — non scalato | K1b + K2 + un passaggio unico per tutti i pezzi di un DXF, con una scheda che li confronta |

**Due avvertenze prima di proporle:** che non esistano è detto da quello che si sa dei software di
ricamo (Wilcom, Tajima, Pulse hanno anteprime realistiche e stime, ma per chi digitalizza, installati e
su un file): **va controllato** prima di presentarle. E un motore che gira nel browser del cliente è
codice leggibile: la versione cliente dà anteprima e stima, mai il DST, e solo i tool che si vogliono
mostrare.

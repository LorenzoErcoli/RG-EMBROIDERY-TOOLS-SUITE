# Come misurare una proposta

Gli strumenti ci sono già e sono affidabili: sono costati più del codice che misurano. Usali, e se
non bastano dillo — ma non fidarti dell'occhio da solo, e non fidarti dei numeri da soli.

## Il caso di prova

Un ritaglio di **90 × 90 mm** da una cianotipia (foto in `apps/pittorico/fixtures/`), preso al 52%
della larghezza e al 18% dell'altezza. Dà 7 macchie su 4 tinte, con curve vere e transizioni sia
sfumate sia nette. È abbastanza piccolo da girare in un paio di secondi e abbastanza vario da non
mentire.

Il disegno intero è **353 × 353 mm** e serve per i numeri finali (`RG_LATO_MM=0`).

Serve un BMP a 24 bit dell'immagine di riferimento. Gli script leggono BMP perché il core non ha
dipendenze e un decodificatore BMP sta in cinquanta righe.

## Gli strumenti

Tutti si compilano allo stesso modo, dalla radice del repo:

```bash
npx esbuild apps/pittorico/scripts/<nome>.ts --bundle --format=esm --platform=node --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/<nome>.mjs
```

### `densita.ts` — **è quello che decide**

```bash
node --max-old-space-size=4096 apps/pittorico/scripts/densita.mjs <immagine.bmp>
```

Dà, in ordine:

- i **percentili della densità** (p5, p25, mediana, p75, p95) in mm di filo per mm², contro la
  densità chiesta, e la dispersione p95/p5;
- gli stessi percentili **separando riempimento e passaggi** — serve a non attribuire al riempimento
  un difetto che è di routing. Ci siamo già cascati una volta;
- quante celle stanno **sopra il 150%** del chiesto;
- **dove** stanno le celle troppo dense, in distanza dal bordo. È il numero che ha indirizzato tutta
  l'indagine finora;
- gli stessi percentili **ago per ago**, ognuno da solo: distingue un difetto del riempimento da un
  effetto delle sovrapposizioni fra colori;
- la distribuzione delle **lunghezze dei passaggi**;
- e una pagina HTML con le **mappe di calore** (riempimento, passaggi, tutto insieme).

Solo le celle **interamente dentro** una macchia contano: una cella a cavallo del bordo è ricamata a
metà e falserebbe la coda bassa.

Variabili d'ambiente utili: `RG_LATO_MM=0` (disegno intero), `RG_FRANGIA=0` (frangia spenta, che è
come vanno fatte le prove), `RG_METODO=iso|tracciato`, `RG_LISCIA=<mm>`.

### `catena.ts` — guardare

```bash
node --max-old-space-size=4096 apps/pittorico/scripts/catena.mjs <immagine.bmp>
```

Una pagina sola con le cinque tappe affiancate: originale, divisione in colori, macchie, ricamo, e
**solo il filo di passaggio in rosso**. È il modo per vedere se un difetto è nel riempimento o nel
collegamento.

### `frangia.ts` — il profilo di densità dal bordo verso l'interno

A fette da mezzo millimetro. Serve quando il difetto è addossato al bordo, che è il caso attuale.

### `piano.ts` — la catena intera fino al DST

Dà filo, punti, salti e i passaggi ago per ago, e scrive un `.dst` vero.

### `leggidst.ts` — misurare il file che va in macchina

```bash
node apps/pittorico/scripts/leggidst.mjs apps/pittorico/scripts/out/piano.dst
```

Conta i salti sul file vero, non sulle corse in memoria. È l'unico modo per rispondere a un difetto
visto in macchina.

### `misura.ts` — il banco sulle forme sintetiche

Ventaglio, banda curva, banda curva con foro. Confronta un riempimento contro il **raso rettilineo**
del core, che ha passo costante per costruzione e quindi dà il rumore di fondo della misura. Utile
per provare un'idea nuova prima di lanciarla sull'immagine vera.

## Le funzioni di misura, se vuoi chiamarle da codice

In `apps/pittorico/src/coverage.ts`:

- `coverageStats(runs, region, spacingMm)` — copertura su griglia: coefficiente di variazione,
  percentili, frazione fuori banda;
- `neighbourSpacing(runs, spacingMm)` — distanza dalla fila più vicina, **punto-segmento** e non
  punto-punto (l'errore c'è stato: punto-punto dava 0,90 mm su un raso perfetto da 0,40);
- `containment(runs, region)` — quanto filo esce dalla regione o entra nei fori.

## Le due trappole già scattate

1. **Contare le celle di bordo.** Una cella a metà dentro sembra poco densa. Era metà del difetto
   apparente.
2. **Misurare la curvatura credendo di misurare il frastaglio.** I gradi per millimetro non
   distinguono una curva vera da uno zigzag. Il frastaglio sono le **inversioni** di curvatura.

## E poi guarda il disegno

`catena.ts` e `misura.ts` producono SVG col filo disegnato a 0,1 mm — la larghezza vera del filo, non
una linea grassa che mente sulla copertura. Un ricamo con i numeri verdi e la resa brutta è già
successo. I numeri servono a scegliere fra due cose che sembrano uguali, non a dire che una cosa
brutta è buona.

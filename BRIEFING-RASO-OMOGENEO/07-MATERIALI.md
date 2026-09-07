# Materiali — dove sta tutto

## In questa cartella

| file | cos'è |
|---|---|
| `cianotipia-originale.jpg` | l'immagine di riferimento vera, quella su cui si lavora |
| `cianotipia.bmp` | la stessa, in BMP a 24 bit: è il formato che leggono gli strumenti di misura |
| `misure-catena.html` | le cinque tappe della catena affiancate, sul ritaglio di prova. **Apri questa per prima**: fa capire il problema in dieci secondi |
| `misure-densita.html` | le mappe di calore della densità e la distribuzione delle lunghezze dei passaggi |

Le due pagine HTML sono lo **stato di oggi**, e sono fatte per essere guardate da un occhio umano —
i numeri che contano stanno tutti nei file di testo. Le genera `06`, e si rigenerano.

## Nel repository

### Il motore, che è quello in discussione

```
apps/pittorico/src/
  pipeline.ts      la catena intera: immagine -> punti. È il file da leggere per primo
  field.ts         campo di direzione armonico sull'angolo raddoppiato
  rail-fill.ts     riempimento dalla rotaia, coi cunei e la troncatura
  curved-fill.ts   riempimento a distanza costante (Jobard & Lefer)
  iso-fill.ts      curve di livello di una distanza anisotropa. Misurato e spento, vedi 04
  serpentina.ts    le corse unite in un filo continuo
  borders.ts       larghezza della transizione, crescita, frangia
  region.ts        regioni, bordo indicizzato, lisciatura del contorno
  coverage.ts      LE MISURE
  primitives.ts    riconoscimento di forme (cerchi, rette) dai pixel
  sample.ts        le forme sintetiche di prova
```

### Il nucleo condiviso, usato da tutti e nove gli strumenti della suite

```
packages/core/src/
  regions.ts    dalla mappa dei colori ai poligoni coi fori
  reduce.ts     riduzione stabile a tinte
  fill.ts       raso rettilineo (è il termine di paragone della misura)
  routing.ts    passaggi nascosti: mappa di copertura, catena minima, A*
  travel.ts     percorsi sul contorno, aggiramento dei vuoti
  stitch.ts     punto minimo e massimo
  dst.ts        scrittura del file macchina Tajima
  geometry.ts   semplificazione, punto-in-poligono, intersezioni
```

### Gli strumenti di misura

`apps/pittorico/scripts/` — `densita.ts`, `catena.ts`, `frangia.ts`, `lisciatura.ts`, `piano.ts`,
`leggidst.ts`, `misura.ts`. Come si compilano e cosa dicono: `06`.

### I documenti di progetto

| file | cosa contiene |
|---|---|
| `COSTITUZIONE-RICAMO.md` | le regole R1-R31 del ricamo in questa suite. Le rilevanti sono citate in `05` |
| `ARCHITETTURA.md` | com'è fatta la suite, e le regole di crescita del nucleo condiviso |
| `STATO.md` | cosa è fatto, cosa manca, e i lavori aperti |
| `AVVIO-PUNTO-PITTORICO.md` | il briefing originale di questo strumento, coi cinque punti del piano |
| `MANUALE.md` | il manuale utente, sezione «Punto Pittorico» |

## Come far girare qualcosa

```bash
npm install
npm run typecheck        # deve essere verde
npm test                 # 627 test, devono passare tutti
npm run dev:pittorico    # lo strumento nel browser
```

Uno strumento di misura:

```bash
npx esbuild apps/pittorico/scripts/densita.ts --bundle --format=esm --platform=node --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/densita.mjs
RG_FRANGIA=0 node --max-old-space-size=4096 apps/pittorico/scripts/densita.mjs BRIEFING-RASO-OMOGENEO/cianotipia.bmp
```

## La misura di riferimento, per confronto

Ritaglio 90 × 90 mm, spaziatura 0,3 mm, densità chiesta 3,33 mm di filo per mm².

| | frangia accesa | frangia spenta |
|---|---|---|
| p5 | 2,00 | 2,25 |
| mediana | 3,27 (98%) | 3,46 (104%) |
| p95 | 7,25 | 9,55 |
| dispersione p95/p5 | 3,6× | 4,2× |
| celle sopra il 150% | 17% | 24% |
| di quelle, entro 3 mm dal bordo | 82% | 87% |

Disegno intero 353 × 353 mm: 481 m di filo, 199.710 punti, 15,1 m di passaggi (3,1%), 52 rasafili.

Le prove vanno fatte **con la frangia spenta** (`RG_FRANGIA=0`): la sfumatura è fuori scope, e
accesa maschera parte del difetto.

# Revisione dei parametri — nomi, etichette, unità

> **Documento di lavoro, da correggere.** La colonna *Cosa fa davvero* è letta dal codice, non dalle etichette.
> La colonna *Proposta* è mia e va corretta: i termini di mestiere li sai tu.
> Quando le decisioni sono prese, i nomi canonici vanno in `COSTITUZIONE-RICAMO.md` §3 e questo file si cancella.

**Come leggerlo:** scorri la colonna *Proposta* e scrivi accanto quella giusta dove sbaglio.
I punti che richiedono una tua decisione sono marcati **①②③…** e raccolti in fondo.

---

## Tool "Rete 45°" — 13 parametri nel pannello

| Etichetta oggi | Cosa fa davvero (dal codice) | Nome interno | Proposta |
|---|---|---|---|
| `★ Larghezza reale mm (0=auto)` | Larghezza fisica della sagoma. Se >0 scala tutto e **prevale** su quanto letto dal file (R11) | `realWidthMm` ✅ §3.4 | **Larghezza reale della sagoma** · unità `mm` · aiuto: *"0 = usa la misura letta dal file"*. Via la stella e il `(0=auto)` dall'etichetta |
| `Lato quadrato (rete) mm` | Lato della cella quadrata della rete | `squareSizeMm` | **Larghezza rete** · aiuto: *"lato del quadrato"* — è il nome che usi tu **①** |
| `Angolo A °` | Prima famiglia di diagonali, default **45** | `angleADeg` | **Angolo diagonali `/`** **②** |
| `Angolo B °` | Seconda famiglia, default **−45** | `angleBDeg` | **Angolo diagonali `\`** **②** |
| `Rientro rete mm` | Di quanto la rete si ritira dal perimetro | `netInsetMm` | **Rientro della rete dal bordo** — è il tuo *"inizio/fine rete"* |
| `Sposta rete X mm` | Trasla la griglia in X | `netOffsetXMm` | **Sposta la rete →** (orizzontale) |
| `Sposta rete Y mm` | Trasla la griglia in Y | `netOffsetYMm` | **Sposta la rete ↓** (verticale) |
| `Fascia raso bordo mm` | Spessore della fascia di bordo dove le celle diventano raso | `rasoBandMm` | **Spessore della fascia di raso** · aiuto: *"0 = nessuna fascia"* |
| `Raso solo sotto (1/0)` | 1 = raso solo sui bordi bassi e laterali, non in alto | `rasoDownwardOnly` | ⚠️ **diventa una casella di spunta**: *"Raso solo sui bordi bassi e laterali"*. Oggi è un sì/no scritto come numero |
| `Largh. cordoncino mm` | Larghezza del cordoncino | `cordWidthMm` ✅ §3.5 | **Larghezza del cordoncino** (senza abbreviare) |
| `Densità cordoncino mm` | Passo **longitudinale** dello zig-zag | `cordDensityMm` | **Densità del cordoncino** · aiuto: *"distanza tra un punto e il successivo"* **③** |
| `Punto passaggi mm` | Lunghezza del punto nei passaggi | `travelStitchMm` ✅ §3.1 | **Lunghezza del punto nei passaggi** |
| `Punto minimo mm` | Lunghezza minima di un punto, applicata dopo il routing (R3) | `minStitchMm` ✅ §3.1 | **Punto minimo** |

**Tre parametri esistono ma non sono nel pannello:** `satinDensityMm`, `squareDensityMm` (densità dei rasi e dei quadratini — li avevi chiesti fin dall'inizio) e `clipStepMm` (passo di campionamento del clipping). **④**

---

## Tool "Generatore pattern" — 26 controlli in 6 gruppi

### 01 · Formato e scala

| Etichetta oggi | Cosa fa davvero | Nome interno | Proposta |
|---|---|---|---|
| `Larghezza pannello` | Larghezza totale richiesta | `totalWidth` | **Larghezza totale** (vedi **⑤**: esce 209.8 se chiedi 200) |
| `Altezza pannello` | Altezza totale richiesta | `totalHeight` | **Altezza totale** |
| `Ingrandimento parametri` % | Moltiplica **tutti** i parametri in mm; **non** cambia la dimensione totale | `parameterScalePercent` | **Ingrandisci tutti i parametri** · aiuto già presente e corretto |

### 02 · Zig-zag orizzontale

| Etichetta oggi | Cosa fa davvero | Nome interno | Proposta |
|---|---|---|---|
| `Larghezza` | Larghezza dello zig-zag orizzontale | `horizontalZigzagWidth` | **Larghezza** (il gruppo dà già il contesto) |
| `Altezza esatta` | Altezza dello zig-zag, **limitata dall'altezza del modulo** | `horizontalZigzagHeight` | **Altezza** — "esatta" non aggiunge niente e non è nemmeno vero: viene tagliata al modulo |
| `Interlinea fili` | Distanza tra i fili affiancati | `horizontalZigzagInterline` | **Distanza tra i fili** |
| `Offset X a sinistra` | Sposta l'origine dello zig-zag a sinistra del centro | `horizontalZigzagOffsetX` | **Spostamento dal centro** ← |
| `Distanza centro-centro` | Passo tra uno zig-zag e il successivo | `horizontalZigzagSpacing` | **Distanza tra gli zig-zag** |

### 03 · Zig-zag verticale

| Etichetta oggi | Cosa fa davvero | Nome interno | Proposta |
|---|---|---|---|
| `Larghezza` | Larghezza dello zig-zag verticale | `verticalZigzagWidth` | **Larghezza** |
| `Interlinea fili` | Distanza tra i fili affiancati | `verticalZigzagInterline` | **Distanza tra i fili** |
| `Diagonale connector` | Inclina il raccordo verticale abbassandone il capo di metà valore | `verticalConnectorDiagonalOffsetY` | **Inclinazione del raccordo** — "connector" è inglese |
| `Distanza colonne` | Passo orizzontale tra colonne | `stepX` | **Distanza tra le colonne** |
| `Sfasamento Y` | Sfasamento verticale tra colonne; default = mezzo passo | `offsetY` | **Sfasamento tra colonne** |
| `Spessore tratto` | ⚠️ **Non è solo grafica**: guida anche il rientro dal bordo, il margine e il passo dei raccordi | `strokeWidth` | **⑥ — da separare in due parametri** |

### 04 · Deformazioni creative *(richiudibile, chiusa)*

| Etichetta oggi | Cosa fa davvero | Nome interno | Proposta |
|---|---|---|---|
| `Angolo orizzontale` | Inclina lo zig-zag orizzontale | `horizontalAngleDeg` | **Inclinazione dello zig-zag orizzontale** |
| `Ampiezza onda` | Ampiezza dell'ondulazione delle colonne | `columnWaveAmplitude` | **Ampiezza dell'onda** |
| `Frequenza onda` **rad/mm** | Quanto è fitta l'onda | `columnWaveFrequency` | **⑦ — unità da matematico** |
| `Fase onda` **rad** | Da dove parte l'onda | `columnWavePhase` | **⑦** |
| `Alterna angolo per colonna` | Inverte l'inclinazione a colonne alterne | `alternateHorizontalAngle` | **Inverti l'inclinazione a colonne alterne** |

### 05 · Percorso e confine *(richiudibile, aperta)*

| Etichetta oggi | Cosa fa davvero | Nome interno | Proposta |
|---|---|---|---|
| `Repeat back / boustrophedon` | Percorso a serpentina: torna indietro invece di ripartire da capo | `repeatBack` | **Andata e ritorno (serpentina)** — oggi è inglese + un grecismo |
| `Distanza minima punti` | Lunghezza minima di un punto | `minPointDistance` | **Punto minimo** → rinominare `minStitchMm` ✅ §3.1 **⑧** |
| `Puntella segmenti` | Lunghezza **massima** del punto: spezza i segmenti lunghi | `maxStitchLength` | **Lunghezza massima del punto** → `maxStitchMm` ✅ §3.1 **⑧** |
| `Cleanup bordo` | Cosa fare dei punti fuori dal contorno | `boundaryCleanupMode` | **Punti fuori dal contorno** · opzioni: *"Avvicina al bordo, poi elimina"* / *"Elimina"* |
| `Aggiustamento bordo` | Di quanto un punto può essere spostato per rientrare, prima di essere eliminato | `maxBoundaryAdjustment` | **Spostamento massimo verso il bordo** |
| `Compatibilità export` | Spezza i tracciati lunghi per Illustrator (R6) | `exportCompatibilityMode` | opzioni: *"Normale"* / *"Sicuro per Illustrator"* — oggi `Normal` e `Illustrator safe` |
| `Forma` | Sagoma di ritaglio: nessuna / rettangolo / cerchio / rombo / importata | `shapeType` | **Sagoma di ritaglio** |

### 06 · Preset
Nome preset, elenco, salva/carica/elimina. Nessun problema di etichetta.

---

## Le decisioni che servono a te

**①** `squareSizeMm` — tu l'avevi chiamata **"larghezza rete"**; il codice la chiama "lato del quadrato". Sono la stessa cosa: quale nome vuoi in interfaccia?

**②** `Angolo A` / `Angolo B` — la mia proposta (`/` e `\`) funziona finché gli angoli restano 45/−45. Se li cambi diventa falsa. Alternativa: *"Angolo diagonali principali"* e *"Angolo diagonali secondarie"*. Quale rispecchia come le chiami in reparto?

**③** `cordDensityMm` — qui c'è una **contraddizione con la Costituzione**. §3.7 definisce `densitySpacingMm` come *spaziatura **trasversale** tra file di filo*; nel codice della rete è invece il *passo **longitudinale*** dello zig-zag. Sono due grandezze fisiche diverse con lo stesso nome. Qual è quella che governi tu quando dici "densità del cordoncino"?

**④** I tre parametri nascosti: **densità dei rasi** e **densità dei quadratini** li avevi chiesti nella lista iniziale, ma non sono nel pannello (oggi i rasi escono come forme vuote). Li esponiamo adesso o quando faremo i riempimenti veri?

**⑤** `totalWidth` — chiedi 200 mm e escono 209.8: il motore ricava le colonne e arrotonda per eccesso. Vuoi che il totale sia **esatto** (rifilando al bordo) o che resti **multiplo del modulo** (com'è ora)? Cambia il risultato di ogni pattern.

**⑥** `strokeWidth` — un numero solo fa due mestieri: **spessore disegnato** e **geometria** (rientro dal bordo, margine, passo dei raccordi). Più i due default che non coincidono (0.1 nell'interfaccia, 0.3 nel motore). Propongo di separarli: *spessore del filo* fisso a 0.1 mm per R15, e un parametro geometrico a parte con un nome suo. Come lo chiamiamo?

**⑦** Onda in **rad/mm** e **rad** — proposta: frequenza come **lunghezza d'onda in mm** (*"ogni quanti mm si ripete l'onda"*) e fase in **gradi**. Più vicino a come si ragiona in reparto, ma cambia i valori dei preset già salvati. Procedo?

**⑧** Due parametri sono gli stessi concetti già canonici in §3.1 con altro nome (`minPointDistance`→`minStitchMm`, `maxStitchLength`→`maxStitchMm`). Rinominarli internamente è giusto ma **invalida i preset salvati** se non aggiungo una conversione. La aggiungo, vero?

---

## Due cose valide per tutta la suite

**Le unità vanno in un posto solo.** Oggi net-45 le scrive dentro l'etichetta (`Largh. cordoncino mm`) e il generatore pattern usa lo slot apposta del design system. Da uniformare: **unità sempre nello slot**, mai nel testo.

**Niente inglese nelle etichette.** `Repeat back`, `Cleanup`, `connector`, `Normal`, `Illustrator safe` — l'unico inglese che resta è "Illustrator", che è un nome proprio.

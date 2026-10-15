---
titolo: Il referto del DST — cosa si misura dai byte, e le convenzioni del formato che lo rendono non ovvio
tipo: codice
tool: []
data: 2026-10-15
---

`misuraDst(bytes)` (`packages/core/src/dst.ts`, accanto a `readDst`) è **la** misura del ricamo: stesse voci,
stesso modo di calcolarle, per qualunque DST (di un tool della suite o di un altro software). Ogni
`motore.genera` la riporta in `misure`. Le convenzioni, perché il formato non le dice:

- **Un punto è un record-punto**, quello che la macchina cuce. Un punto più lungo di 12,1 mm per asse il
  formato lo spezza in più record, e sono davvero più punti cuciti: coi default di Interlace (`maxStitchMm`
  15) il DST ha il 18% di punti in più dei vertici del tool. Il **primo vertice di una polilinea non è un
  punto**: è dove l'ago arriva con un salto. Per questo «punti del tool» è di solito «punti del referto più
  il numero di polilinee».
- **La lunghezza cucita** è la somma dei record-punto, salti esclusi. Il DST arrotonda ogni coordinata a
  0,1 mm, quindi è di pochi millimetri più lunga della somma in mm reali (0,01–0,1%).
- **Un salto** è una serie di record-salto di fila: conta **uno** e la sua lunghezza è la distanza vera fra
  dove l'ago era e dove arriva (un salto di 30 mm scritto come tre record è un salto da 30 mm; uno di
  (30, 40) mm è 50 mm, non la somma dei pezzi). Un salto che non sposta niente non è un salto, e il
  **posizionamento iniziale** prima del primo punto non è un salto del ricamo. `salti` comprende lo
  spostamento che segue un cambio d'ago; `saltiStessoAgo` no — è quello che i tool di solito chiamano «salti».
- **Un taglio** è la sequenza di tre salti minimi che si annullano (+0,2 / −0,4 / +0,2 mm) che scrive
  `buildDst` (`trim`): conta un taglio, non tre salti, e non sposta niente.
- **Aghi** = quelli che cuciono almeno un punto; **cambiAgo** = i record di cambio-colore.
- **Ingombro** = rettangolo dei punti dove l'ago scende (non dei salti), in mm, Y verso il basso come `readDst`.
- **Non fidarsi del campo `ST:` dell'header.** Nei DST della suite è il numero di punti; in `M1424` (scritto da
  altro software) è il numero di *tutti i record* (7102, i punti sono 6988). Le estensioni `+X/−X/+Y/−Y` e
  `CO:` invece coincidono con ingombro e cambi.
- **Quello che il DST non dà**: il filo in vista (dipende da cosa copre cosa), il consumo vero di filo (bobina,
  filo che entra nel tessuto) e il tempo macchina. Il filo in vista lo passa chi lo calcola
  (`filoInVista: { mm, origine }`), con da dove viene il numero; gli altri due aspettano valori di Lorenzo.

**Il referto è dei byte veri.** Per i tool che esportano con `dstFromExportLayers` il referto degli strati è
quello del DST; per **pettine** (`es.dst`) e **sfrangiatura** (`dstDaBlocchi`) il DST si scrive per un'altra
strada, e il referto degli strati ricostruiti dà numeri diversi: va misurato sui byte che il tool salva.
Razza esporta con `center: false`.

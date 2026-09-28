---
titolo: Punto Striato, il sesto tool — e le decisioni che ne hanno fissato il modello
tipo: tool
tool: [striatura]
data: 2026-07-31
---

**Punto Striato** (`apps/striatura`, id `striatura`) è il sesto tool della suite, avviato il
2026-07-31 dal DST di riferimento `PUNTO-STRIATURA.dst` di Lorenzo. Costruisce **striature verticali
in punto semplice** che formano **macchie maculate** su una **base di riempimento parallelo**.

## Le decisioni di Lorenzo

Prese rispondendo a domande e dopo la prima prova, bocciata:

- **Ingresso:** DXF/SVG, oppure un oggetto pieno dalle misure (come [interlace](interlace.md)); le aree
  vuote (R5) si rispettano.
- **Colore:** monocolore per ora. I 7 cambi colore del DST di riferimento erano **solo marcatori** di
  macchia e spostamento, **non colori**. Il multicolore verrà: il motore è già "a strati" per non
  doverlo riscrivere.
- **La macchia è un grappolo di striature (trattini distinti), non un riempimento pieno.** Ogni
  striatura va in **retrace**: dal centro sale e torna, scende e torna (trattino marcato).
  `stitchMode: 'retrace'` è il default.
- **Lo spostamento fra le macchie è riempimento parallelo continuo, niente salti.** Il filo resta
  cucito (corsa verticale) e si confonde con la base. **Non è un salto.**

**La lezione:** la prima prova aveva **invertito** i due ruoli (macchia = riempimento pieno,
spostamento = salto). Lorenzo l'ha bocciata chiedendo *«la visualizzazione è il ricamo reale?»* — sì:
la linea è il percorso dell'ago. Da lì il modello giusto.

## Com'è fatto

**Serpentina a righe** (riga → giù → riga, come il DST). Ogni cella (colonna × riga) è una striatura:
fitta dentro le macchie (`densitySpacingMm` 0,4–0,8 mm), rada fra una macchia e l'altra
(`fillSpacingMm` 1,7–2,0 mm), collegata da tragitti dritti in punto corsa = il riempimento continuo.
`striaturaLengthMm` è l'altezza della riga/trattino (~18 mm). Il frastaglio viene da lunghezze
variabili (`jaggedLengthMm`) e da una fase verticale per colonna (le partenze non sono allineate).
Punto ~1,9 mm, verticale al 99%. Misurato senza interfaccia: di default un filo continuo (0 salti),
0 punti nel vuoto.

Il 2026-08-25 Lorenzo ha approvato macchie e passaggi così come sono (A2 in `STATO.md`), e ha lasciato
com'è l'attraversamento orizzontale fra le righe.

# Punto croce: fasce in andata e ritorno, elementi isolati dal lato giusto

**2026-10-13.** Lorenzo, sul Burminala V3 (modulo 24 × 37 V, ~6 × 4,5 copie): «anche se potrebbe lavorare tutto in
linea, quando il modulo si ripete non sfrutta il fatto che le varie fasce sono consecutive: ne finisce una, magari
tornando anche indietro nel modulo, poi ripassa sopra tutto e va avanti… si creano un sacco di punti di
sovrapassaggio innecessari»; «quando gli elementi sono isolati non partono e finiscono nei lati esterni o comunque
più vicini agli oggetti precedenti e successivi».

**Cosa si è visto.** Il ripasso stava quasi tutto *dentro* la fascia, non nel passaggio finale verso l'uscita: la
fascia alta del filo 3 (righe 3-8: una fila di coppie di V con sotto un'onda) ripassava 40 cm per copia, perché per
finire la copia il filo doveva tornare sul secondo ramo.

**Cosa fa ora `routeBands` (strips.ts).**
- **Andata e ritorno.** Per una fascia unita fra le copie con ripassi, si prova a dividerla per righe in due passate
  lungo tutta la striscia (sopra all'andata e sotto al ritorno, o viceversa); si tiene la divisione se il conto
  (ripasso + 5 × in vista + 0,2 × vertice-vertice + 30 per salto + 60 se una passata va a salti) scende sotto il 70%
  di quello della fascia intera, e almeno una passata è unita. Non per i fili con l'ordine dei pezzi a mano.
- **Il verso.** I versi si alternano per passata. Per ogni fascia si prova anche il verso opposto (il motore non è
  simmetrico: la fascia 24-25 del filo 4 aveva 7,7 cm in vista per copia da destra e niente da sinistra); si tiene se
  il guadagno supera il salto lungo che costa rompere la serpentina (0,05 × larghezza del ricamo in mm).
- **Elementi isolati.** Ingresso sul lato da cui si arriva, uscita sul lato verso la copia dopo: si provano tre
  ingressi e tre uscite (in cima, in fondo, a metà del lato) più l'uscita libera di prima, e si tiene la coppia col
  conto più basso fra ripasso, 5 × in vista e metà del salto alla copia accanto. Un anello o un motivo coi rami
  (il bastoncino del filo 5) ha ripassi comunque: lì vince spesso l'uscita libera.

**Misure sul V3** (fili colorati, tutto il ricamo):

| filo | ripasso prima → dopo | in vista prima → dopo | salti |
|---|---|---|---|
| 1 | 14,6 → 17,6 m | 9,2 → 8,4 m | 31 → 31 |
| 2 | 14,6 → 14,6 m | 3,9 → 3,9 m | 71 → 71 |
| 3 | 24,2 → 16,4 m (il più lungo 94 → 26 mm) | 2,5 → 1,8 m | 155 → 159 |
| 4 | 1,8 → 1,5 m | 0 → 0 | 119 → 119 |
| 5 | 10,6 → 10,6 m | 4,9 → 4,9 m | 39 → 39 |
| tutti | 65,8 → 60,7 m | 20,5 → 18,9 m | 415 → 419 |

Il filo 1 cambia verso a una fascia: 3 m di ripasso in più per 0,8 m in meno in vista (il conto pesa il filo in
vista 5 volte il ripasso). Dividere per righe non aiuta le fasce grandi dei fili 1, 2 e 5: restano intere. Calcolo
del ricamo intero: 0,3 s.

# Cross-Stitch: la base unica si cuce dall'alto in basso

**2026-10-13.** Lorenzo, sul ricamo alpino (150 × 168 V): «la base deve sempre lavorare da sopra a sotto. Ora non
lavora bene».

- Prima la base unica era un solo calcolo del motore su tutto il ricamo: il filo andava a blocchi dove gli
  conveniva, su e giù per il pezzo.
- Ora (`strips.ts`, `baseWholeRoute`) la base si cuce a fasce di `BASE_BAND_ROWS` righe, dall'alto in basso, a
  serpentina: la prima da sinistra a destra, la seconda da destra a sinistra… Ogni fascia parte dall'angolo
  dove è finita quella prima (`startAt`) e finisce sull'angolo in basso da cui parte la dopo (`endAt`): lo stop
  resta uno, continuo. Con la forma, l'angolo è il primo punto dentro la forma su quella riga.
- **Una riga per fascia.** Misurato sull'alpino: 1 riga → 0 ripassi, 0 in vista, 0 salti (ogni riga di V si
  cuce di filato, giù-su-giù, e si scende all'angolo: 47 cm di vertice-vertice in tutto); 2 righe → 107 m di
  ripassi; 3 righe → 0,5 m; 4 righe → 54 m. Con un numero pari di righe l'angolo d'uscita sta dalla parte
  sbagliata e il filo torna indietro sopra la fascia.
- Le croci col filo della base sopra la base si cuciono alla fine dello stesso stop, dopo tutta la base (anche
  loro dall'alto): cucite riga per riga, la V della riga sotto, col sormonto, le coprirebbe in parte.
- `RouteParams.baseBandRows` cambia le righe per fascia (per prove; il tool non lo mostra).

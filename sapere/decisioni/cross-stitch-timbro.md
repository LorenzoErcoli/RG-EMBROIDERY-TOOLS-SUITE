# Punto croce: il timbro, un pezzo da un altro progetto

**2026-10-19.** Lorenzo: «usare parti di altri programmi e inserirli in programmi nuovi: devo disegnare una nuova
grafica che ha una parte che voglio riprendere da un altro DST generato nel tool».

- Ogni DST e SVG del tool porta dentro il progetto (celle, fili, griglia): si riprende il **disegno**, non i punti
  cuciti. Il progetto aperto non cambia finché non si posa il pezzo.
- `stamp.ts` (puro, provato in `test/smoke.mjs`): `extractStamp` (riquadro di celle, senza il colore di base se
  non chiesto, stretto alle celle piene), `fitStamp` (V diversa: stesse misure in mm, cella più vicina — dichiarato
  inesatto), `flipStamp` (specchio: «\»↔«/»; sottosopra: anche V↔Λ), `proposeColorMap` (filo più vicino in Lab;
  «stesso colore» sotto 3), `stampEdits`.
- Interfaccia: la finestra composta dall'agente DS con quello che c'è nella 1.19.1 (`rg-modal`, `rg-color-map`,
  `rg-toggle`; unico CSS locale `.cs-pick__stage`); lo strumento **Timbro** compare quando c'è un pezzo.
- Del pezzo non si portano gruppi, blocchi, salti a mano e passaggi ridisegnati: nel progetto nuovo li rifà il tool
  o Lorenzo. I fili nuovi non entrano nell'Annulla (come ogni cambio di tavolozza); il pezzo posato sì.
- Provato nel tool: dal davanti (V2) la baita a sinistra, 49 × 24 V, sul retro: tre fili riconosciuti come «stesso
  colore»; posata, i passaggi si ricalcolano; Annulla la toglie.

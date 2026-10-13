# Cross-Stitch: ridisegna passaggio anche senza modulo

**2026-10-13.** Lorenzo: «ho bisogno che ridisegna passaggio sia anche nella modalità disegno normale e non
solo nel modulo».

- Fuori dall'editor i passaggi ridisegnati sono **del ricamo** (`State.forced`): vertici (riga, colonna)
  del reticolo del disegno intero, come i salti a mano (`State.cuts`). Si salvano nel progetto (`forced`)
  e rientrano nell'Annulla.
- Al motore arrivano come `RouteParams.forced`, riportati sulla griglia calcolata (area di prova) e, a
  strisce, spostati sulla striscia (`routeStrips`). Gruppi, blocchi e base unica usano la stessa griglia.
- Se il ricamo è proprio il modulo ripetuto (`modulePath`), il percorso è quello del modulo: lì i
  passaggi del ricamo non valgono e lo strumento rimanda all'editor (dove vale in ogni copia). In vista
  modulo lo strumento è spento, come gruppi e blocchi.
- Come nel modulo, un passaggio forzato vale finché il filo collega gli stessi due vertici; se il
  disegno cambia e quel passaggio sparisce, resta inattivo.

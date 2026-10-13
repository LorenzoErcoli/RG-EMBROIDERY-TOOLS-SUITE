# Cross-Stitch: l'immagine sopra un disegno già fatto è solo riferimento

**2026-10-13.** Lorenzo: «una volta caricato il DST poter inserire l'immagine senza che il sistema mi ricalcoli
tutto».

- Prima *Carica immagine…* faceva sempre tre cose: l'altezza del ricamo prendeva le proporzioni dell'immagine,
  la griglia si rifaceva e la maglia si rileggeva dall'immagine (fili e disegno nuovi). Dopo aver aperto un DST
  o un progetto, perdeva il lavoro (si tornava indietro solo con Annulla).
- Ora, se la griglia ha già un disegno (`st.cells` non vuote), l'immagine è solo **riferimento**
  (`imageAsReference`): si stende sul ricamo alla sua misura (come sempre nell'anteprima), e misure, disegno,
  fili, blocchi, gruppi e passaggi non cambiano. Anche il ritaglio, in quel caso, cambia solo il riferimento.
- *Maglia dall'immagine* (e *Maglia coi miei colori*) rifà il disegno dall'immagine quando lo si chiede, sulla
  griglia attuale; da lì l'immagine torna a guidare la maglia.
- Con la griglia vuota tutto come prima: l'immagine crea subito la maglia.
- Nell'editor del modulo l'immagine resta la guida del modulo, come prima.

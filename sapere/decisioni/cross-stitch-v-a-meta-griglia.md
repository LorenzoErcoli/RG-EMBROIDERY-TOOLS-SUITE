---
titolo: Punto croce, la V e la Λ a metà griglia — mezza cella di lato, il filo dal centro della cella accanto
tipo: decisione
tool: [cross-stitch]
data: 2026-11-25
---

**2026-11-25.** Lorenzo: «la possibilità di inserire in primis una V al contrario come punto, ma anche di attivare una
funzione di incastro a metà della griglia. Mi servirebbe soprattutto per andare a rifinire alcuni punti V finali ad
angolo. Ovviamente i passaggi in quei casi arrivano sempre dal centro per non farli mai vedere».

**Cosa si è chiesto, a disegni.** Due domande con un disegno ciascuna. (1) L'incastro: la V spostata di **mezza cella di
lato**, sulla stessa riga (non di mezza riga in altezza) — «sì, di lato». (2) Da dove arriva il filo: non dalla punta
della V spostata ma «dal centro della cella»; col secondo disegno: il centro della cella della **V intera accanto**, in
alto, dove arriva la punta della V della riga sopra. «Sì, è quello, ma provalo anche con una V invertita, sopra al
centro delle due».

**Come è fatto.**
- **La Λ** c'era già (clic destro con la V) ma non si vedeva: ora è un bottone in *Punto*, e col destro dà la V.
- **Il punto a metà** (`HalfStitch` in model.ts: `vL`, `vR`, `lambdaL`, `lambdaR`) sta in una cella come gli altri
  punti, così salvare, annullare, copiare sulle copie del modulo, timbri e DST funzionano senza cambiare: `L` =
  centrato sul lato sinistro della cella, `R` sul destro. Le gambe (`stitchLegs`) vanno dal centro di una cella alla
  punta sul lato e al centro dell'altra: sono vertici che il reticolo ha già (le metà dei lati). Alla fine della
  griglia (la cella 0 a sinistra, l'ultima a destra) non ci sta: niente gambe.
- **Il pennello a metà griglia** (`halfEdits`, interruttore *A metà griglia*): prende il lato più vicino al mouse e mette
  il punto nella cella libera delle due (prima quella a destra). Due celle piene: niente, e la barra lo dice (non si
  cancella una V intera per fare posto). Gomma: toglie solo il punto a metà su quel lato.
- **Il filo** (`halfEntry`, routing.ts): entra ed esce dal braccio che cade al centro dell'**altra** cella (quella della
  V intera accanto: lì la copre), mai da quello di fuori. Per tornare dove è entrato le passate sono pari: con un
  numero dispari ne fa una in più (con 1 passata 2). L'unità è una sola (angolo, punta, angolo, avanti e indietro),
  come una V cucita tutta insieme.
- **Col filo della base** il punto a metà non è coperto dalla base (sta a cavallo di due V della base): si cuce sopra,
  nello stop della base, come la croce col filo della base.
- **Il timbro** a specchio cambia lato (`vL` ↔ `vR`), sottosopra V ↔ Λ.

**Le prove** in `test/cross-stitch-meta-griglia.mjs` (8 asserzioni): il pennello (cella libera, destro, celle piene,
gomma), le gambe, il filo che entra ed esce dal centro della cella accanto con 1, 2 e 3 passate e sul bordo sinistro,
la Λ sopra due V, col filo della base, salvato e riaperto, il timbro. Rotte apposta in cinque modi (su una copia in
`.lab`): tutte rosse. Nel tool, a mano: due righe di V con le mezze V alla fine e una Λ sopra, 22 diagonali, 0 mm in
vista, 0 salti. **Non visto cucito.**

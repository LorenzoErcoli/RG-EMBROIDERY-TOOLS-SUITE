---
titolo: Dove Stilista tiene i fori di un riempimento (EmptyAreaPaths), e cosa NON sono gli Strokes
tipo: codice
tool: [pattern-grammar]
data: 2026-10-21
---

Misurato col plugin RG Stilista Link (`GET /fori`, [`Collegamento.Fori.cs`](../../strumenti-sviluppo/stilista-link/Collegamento.Fori.cs))
su una copia di `SH295 DAV 1984.EMG3` (206 oggetti).

**I fori sono le aree vuote.** `DesignObject.EmptyAreaPaths` è un `GMIPath[]`: ogni elemento è un foro, i
suoi punti si leggono con `GetTaggedPoints()`. Il contorno (`SourcePath`) resta l'esterno da solo. In SH295
4 oggetti ne hanno: l'11 è una corona (esterno 38.078 mm², foro 11.881 mm²), il 66 e l'80 due forme gemelle
(89 mm² con un foro di 54), il 116 (160 mm², foro 78).

**`GMIPathTAGGED.Strokes()` non sono gli anelli.** Su una macchia di 98 punti, senza fori, dà 11 «tratti»
per oltre 300 punti con aree senza senso; e su SH295, passandola a tutti gli oggetti, il filo
dell'interfaccia di Stilista è rimasto occupato oltre 4 minuti. Non si usa.

**La lettura punto per punto per riflessione è lenta**: decine di µs a punto, e un oggetto manuale di SH295
ha 129.593 punti. Un percorso dà i suoi `TAGGEDPOINT` tutti insieme con `GetTaggedPoints()`: con quello
`/fori` su 206 oggetti risponde in meno di un secondo.

**Come si applica.** Nell'SVG che il plugin dà ai tool ogni foro è un tracciato a sé col colore dichiarato in
`data-rg-stilista-fori`, e il tool gli dà il ruolo «area vuota» (R5): per il tool è un cartamodello come un
altro. Un contorno con più anelli separati da un salto o da un inizio blocco il plugin lo divide e tratta da
fori quelli dentro il più grande: non si è ancora visto in un file vero, è una cautela.
Vedi anche [`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md).

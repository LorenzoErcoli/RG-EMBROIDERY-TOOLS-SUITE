---
titolo: readDst perdeva i tagli — un DST riscritto ricollegava i pezzi staccati
tipo: codice
tool: [compositore, sfrangiatura]
data: 2026-10-29
---

Fino al 2026-10-29 `readDst` (`packages/core/src/dst.ts`) leggeva i blocchi cuciti ma **non i tagli** fra un blocco e
l'altro (la sequenza Tajima di tre salti minimi, +0,2 / −0,4 / +0,2 mm, che `buildDst` scrive e `misuraDst` conta).
Riscrivendo i blocchi con `dstProgramFromBlocks` → `buildDst`, due pezzi dello stesso ago che il file teneva staccati
col taglio tornavano **collegati da un salto**, in silenzio: i punti erano gli stessi, il referto no (tagli spariti).

Ora ogni blocco preceduto da un taglio ha `trim: true`, e `dstProgramFromBlocks` lo passa a `buildDst`. Misurato:
un programma coi tagli torna **byte per byte**; nel DST vero di Stilista del raso omogeneo i blocchi marcati sono
quanti i tagli del referto.

**Come si applica.** Chi rilegge un DST e lo riscrive (il Compositore, la Sfrangiatura) si porta dietro i tagli senza
fare niente. Il taglio prima di un cambio d'ago `buildDst` non lo scrive (il cambio taglia già): un file di un altro
software che lo scrive lo stesso, riscritto, perde quei tre record e nient'altro.

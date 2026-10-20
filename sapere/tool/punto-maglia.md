---
titolo: Punto maglia — tratti disegnati che diventano un cordoncino di V a maglia lungo le curve
tipo: tool
tool: [punto-maglia]
data: 2026-10-20
---

**Stato: nella pagina «In sviluppo» dal 2026-10-20.** `apps/punto-maglia/`: motore puro in `src/motore.ts` (anche il
contratto K1b `motore.genera`), interfaccia in `src/tool.ts`. Il calcolo è istantaneo (qualche migliaio di punti): niente
Worker.

## Da dove nasce
Il logo Dior a maglia (foto in `apps/cross-stitch/.lab/dior/maglia.jpg`, cartella non versionata). Le prove dentro
Punto croce (una griglia di celle con le V dritte) non potevano far girare le V sulle curve: da lì un tool a parte, dove
**i tratti si disegnano** (linea centrale) e il tool li riempie. Il cordoncino, le strade scartate e le scelte del tool:
[`decisioni/punto-maglia-cordoncino.md`](../decisioni/punto-maglia-cordoncino.md).

## Cosa fa
- Si disegnano le linee centrali (clic per punto, curva morbida per i punti), anche ricalcando un'immagine caricata
  sotto (larghezza in mm, opacità). Il disegno si proporziona alla V (2,5 × 3,5), non il contrario.
- Per ogni tratto: centro 1 / 1,5 / 2, verso delle punte, capo o coda, mezza colonna (col 1,5), chiuso o aperto.
- L'ordine della lista è l'ordine di cucitura e il sopra/sotto negli incroci.
- Anteprima al filo (le passate si sommano: più scuro dove ripassa), passaggi a richiesta, punti per tratto e totali.
- Export DST (un ago, taglio fra i tratti) e SVG (filo + linee), tutti e due riapribili (R27). L'immagine di
  riferimento non è nel file.

## Da fare / non deciso
- Cucire il campione (`CAMPIONE-MAGLIA-V25x35-CENTRO4.dst`) e guardare se il centro si alza.
- Quando cambiare larghezza lungo un tratto; incroci molto obliqui (passaggio oltre 12,1 mm).
- Ricalcare il Dior intero sulla foto e confrontarlo col riferimento.

---
titolo: Cross-Stitch, blocchi di ricamo e gruppi a contorno — due cose diverse
tipo: decisione
tool: [cross-stitch]
data: 2026-10-12
---

Il 2026-10-12 Lorenzo, per un paesaggio a maglia da disegnare a mano: «il gruppo per ora lavora su
rettangoli; dovrà poter lavorare anche su contorni da me disegnati. Va diviso però il gruppo per la
lavorazione e il blocco di ricamo, cioè ogni blocco deve lavorare tutti i colori prima di passare al
successivo». Scelte sue: base unica, contorno a clic.

**Due cose.** Il **gruppo** ordina le zone DENTRO un filo (com'era). Il **blocco di ricamo** è una zona
dove si cuciono TUTTI i fili prima di passare alla zona dopo: le strisce, ma a forma libera
(`RouteParams.areas`, `routeAreas` in strips.ts). Sequenza: base unica (sempre, anche se l'interruttore
della base per striscia è spento), poi blocco per blocco nell'ordine della lista tutti i fili, coi gruppi
dentro, poi il resto. Una cella va al PRIMO blocco che la contiene (i gruppi invece all'ultimo disegnato,
com'erano). Coi blocchi il percorso del modulo non vale: decide il motore, blocco per blocco.

**Contorni.** Gruppi e blocchi sono un rettangolo o un contorno (`ZoneGroup.poly`, mm): si trascina per
il rettangolo, si clicca punto per punto per il contorno (Invio chiude, Backspace toglie, Esc annulla).
Il contorno conta per le celle (centro dentro); per il recinto dei passaggi resta il rettangolo che lo
contiene.

**Nello stesso giro.** La pagina che saltava cliccando in basso nel pannello: gli input nascosti degli
interruttori del design system, senza un antenato posizionato, stavano rispetto alla pagina e la
allungavano di oltre 2000 px (scrollabile, e il focus del clic la faceva scorrere). Rimedio locale nel
CSS del tool; il difetto è del design system. E la barra di stato dice i punti come escono nel DST.

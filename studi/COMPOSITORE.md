# Il Compositore: il piano a passi

> Scritto il **2026-10-29**, dopo lo studio [`STILISTA-DA-ZERO.md`](STILISTA-DA-ZERO.md) (§8.3: *«Costruire il
> Compositore, e decidere dopo con i numeri in mano»*). Lorenzo: *«Ok, partiamo dal Compositore»*.
> Il codice è in [`apps/compositore/`](../apps/compositore/); come si usa è in [`MANUALE.md`](../MANUALE.md).

## Cos'è, in una riga

Un **documento a oggetti** nella suite: mette in fila i ricami dei tool e di Stilista, con fili, cambi d'ago,
tagli e passaggi fra un oggetto e l'altro, li controlla prima della macchina, li simula, e scrive **un DST che si
riapre**. È la **tappa 1** dello studio. La prova per andare oltre è quella dello studio: *Lorenzo chiude almeno un
pannello vero su tre nel Compositore e lo manda in macchina senza ritocchi in Stilista.*

## Le scelte di fondo (prese qui, da confermare con Lorenzo dove è scritto)

1. **Un oggetto non si ricalcola.** Entra coi suoi punti e coi suoi tagli, e il Compositore decide solo dove sta,
   con quale filo, in che ordine e come ci si arriva. È l'opposto di Stilista, dove un ricamo fatto fuori entra come
   *Manual* e un ricalcolo lo rovina (`sapere/codice/stilista-oggetto-manuale.md`: 773 → 2 punti).
   *Misurato:* il DST di Stilista del raso omogeneo (188.139 punti, 62 blocchi) passa dal Compositore e ne esce coi
   **stessi blocchi, gli stessi punti, gli stessi aghi e lo stesso referto** (test in `test/smoke.mjs`).
2. **Il filo è del documento.** Il DST non porta i colori (R31): ogni ago di un oggetto punta a un filo del
   documento; due oggetti uno dopo l'altro sullo stesso filo non fanno un cambio d'ago. I colori dei tool arrivano
   dalla busta (K2), lo stesso colore in due file è lo stesso filo.
3. **Il file che esce si riapre.** In coda al DST (dopo l'END, la macchina non la legge) c'è la descrizione del
   documento: quali blocchi sono di quale oggetto, spostamenti, fili, regole. I punti non si ripetono, sono quelli del
   DST. *Misurato:* riaperto e risalvato dà gli stessi byte.
4. **Automatico, ma correggibile** (Lorenzo: *«cambiarli anche in salti quando serve»*). La regola dei tagli vale
   per tutti, la scelta a mano su un oggetto resta anche se l'ordine cambia.
5. **Il taglio fra oggetti oltre 2 mm** — *valore mio, da confermare con Lorenzo.* Sotto i 2 mm il salto è poco più
   di un punto lungo.
6. **Il Compositore non è un tool**: non sta in `TOOLS`, non ha un motore, i suoi campi non sono parametri di punto.
   Per questo il controllo U5 (etichette = registro) non lo guarda; gli altri controlli dell'interfaccia sì.

Un pezzo è andato nel core, perché serviva a tutti: **`readDst` ora legge i tagli** (`DstBlock.trim`). Prima un DST
riscritto perdeva i tagli fra blocchi dello stesso ago: due pezzi staccati tornavano collegati da un salto.

## I passi

Ogni passo si usa da solo e ha la sua prova. Le stime sono stime [S], come nello studio.

| Passo | Cosa | Stato | La prova |
|---|---|---|---|
| **1** | Il documento: DST dentro, fila, fili, spostamento a mano, taglio/salto fra oggetti con regola e scelta a mano, proposta d'ordine, controllo, referto, simulatore, DST che si riapre, SVG | **fatto** (2026-10-29) | test nello smoke; provato nel browser con l'esempio |
| **2** | **Dalla selezione di Stilista** (il Link: `@rg/ui/stilista`, già usato dai tool) e **ritorno a Stilista** del documento intero | da fare · ~2–3 settimane [S] | un pannello vero di Lorenzo: la selezione entra, l'ordine e i tagli si decidono qui |
| **3** | **Ingresso e uscita di ogni oggetto**: per gli oggetti dei tool che lo sanno fare (il motore rigenera con un ingresso dato), il punto d'entrata più vicino all'uscita di prima; per gli altri, l'oggetto si può percorrere al contrario solo se è un'impuntura | da fare · ~3–4 settimane [S] | la strada fra oggetti cala su un pannello vero, misurata dal referto |
| **4** | **Passaggi nascosti fra oggetti** (R16–R21, `routing.ts`): al posto del salto, un passaggio sotto un oggetto che verrà cucito dopo, quando c'è | da fare · ~4–6 settimane [S] | i salti di un pannello vero calano; il controllo dice dove il passaggio resta in vista |
| **5** | **Il controllo che sa cosa copre cosa**: il passaggio sotto il ricamo appena fatto (Lorenzo: *«quel filo si incastrerà sicuramente sotto il ricamo»*), la densità dove gli oggetti si sovrappongono, i registri fra stop | da fare · ~3–4 settimane [S] | ogni avviso provato rompendo apposta la cosa che sorveglia (regola 8) |
| **6** | **Trasformazioni** (ruota, specchia, duplica, allinea), **telaio** e limiti, **pannelli grandi** (anteprima su WebGL quando l'SVG non basta) | da fare · ~4–6 settimane [S] | un pannello da 400.000 punti si sposta e si zooma senza attese |
| **7** | **Il foglio di produzione**: fili, aghi, stop, tempi (aspetta i valori macchina di Lorenzo, STATO K3) | da fare · ~1–2 settimane [S] | Lorenzo lo usa in reparto |

In tutto ~4–6 mesi dal passo 2 al 7 [S], come la tappa 1 dello studio.

## Le domande per Lorenzo

Le risposte cambiano i passi 2–7, non il passo 1:

1. **Il taglio fra oggetti**: 2 mm va bene? Le macchine di RG tagliano da sole oltre una certa lunghezza di salto?
2. **Un pannello vero** da comporre per la prima prova: quale, e da quali tool (o da Stilista) arrivano i pezzi?
3. **Dove entra e dove esce un oggetto**: oggi lo decide il tool che l'ha fatto. Va bene, o vuoi sceglierlo qui?
4. Il Compositore resta in «In sviluppo» finché non chiude il primo pannello vero?

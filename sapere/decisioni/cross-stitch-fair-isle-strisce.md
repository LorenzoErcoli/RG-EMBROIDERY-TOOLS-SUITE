---
titolo: Cross-Stitch, Fair Isle a punto V — modulo, strisce, ordine dei fili
tipo: decisione
tool: [cross-stitch]
data: 2026-10-01
---

Il 2026-10-01 Lorenzo ha posto la sfida: rifare a punto V una grafica Fair Isle (rombi, alberelli,
fascia verde, triangoli; immagine di riferimento in `apps/cross-stitch/.lab/fairisle.webp`, fuori da
git). Le sue condizioni:

- **lavorare a moduli e a strisce di moduli**: la macchina ha i ritiri, e cucire tutto un colore e
  poi tutto un altro non riprende mai il registro;
- **una base completa** del colore più diffuso (l'azzurro), poi gli altri colori **dal chiaro allo
  scuro**, nascondendo i passaggi;
- fra una striscia e l'altra, **accorgimenti in macchina** per avvicinarle o allontanarle.

Scelte di Lorenzo: **striscia alta un modulo intero**; i colori li sceglie il tool, «poi in caso le
modifichiamo».

**Il modulo, misurato.** L'immagine si ripete ogni 429 × 657 px = **72 × 112 V** (V quasi quadrate,
5,96 × 5,87 px). Le colonne si trovano dai bordi di colore; le righe **non** si trovano dai numeri
(trama, purezza delle celle, concordanza fra copie: tutti indifferenti) ma **guardando**: con 112
righe le diagonali escono lisce, con 56 a blocchi, con 84 seghettate (vedi [la resa prima delle
misure](../metodo/resa-prima-delle-misure.md)). Una prima griglia a 36 × 28 era sbagliata: prendeva
due V per una. I 72 × 112 sono **4 copie di un modulo 36 × 56**: le differenze fra le copie (~10%
delle V) cadono al 97–98% sui bordi sfumati dei motivi, quindi rumore; il modulo si ricava per
maggioranza. Con celle 2,4 × 3,5 mm e sormonto 30% le V restano quadrate: un modulo è 86 × 137 mm.

**I colori.** 7 gruppi in Lab: uno (`#a29790`, grigio-rosato) **non è un filo**: 137 pezzi, 116 V
isole, mai più di 5 V — è il bordo sfumato fra rosa e azzurro. Tolto (ogni V prende il colore più
presente intorno): restano 6 fili. Il giallo chiaro dei puntini è finito nel crema.

**Il ricamo a strisce** (`strips.ts`): ogni striscia è una griglia a sé con la sua base e i suoi
colori, i passaggi non escono dalla striscia, nel DST gli stop si ripetono per striscia; la
compensazione del ritiro sposta la striscia k di k × mm nell'export.

**L'ordine dei fili conta più delle strisce.** Sul progetto 5 × 2 moduli (432 × 275 mm): tutto
insieme 13,1 m di filo in vista; a strisce 13,3 m (le strisce servono al registro, non al filo in
vista); tolto il colore finto 9,8 m; con l'ordine `crema, rosa, verde, marrone, ruggine` 7,5 m. Su una
striscia di 2 moduli, provati tutti i 120 ordini dei 5 colori: dal chiaro allo scuro è a metà
classifica (2,02 m), il migliore 1,38 m; quello scelto 1,43 m — è il chiaro→scuro con il **ruggine per
ultimo**: il marrone (motivi piccoli e sparsi) da ultimo non ha sotto cosa nascondere i passaggi, il
ruggine (pochi pezzi grandi) passa poco.

**Ancora aperto:** il 67% del filo in vista sta nei passaggi oltre 12 mm (32 su 116 per striscia di
2 moduli). Farli diventare salti col taglio lo porterebbe a circa un terzo, con più tagli in macchina:
da decidere con Lorenzo.

**Come si applica:** prima di un passaggio da un'immagine, cercare il modulo vero (le copie quasi
uguali sono rumore) e i colori finti (pezzi minuscoli lungo i bordi); misurare l'ordine dei fili sul
filo in vista invece di darlo per scontato.

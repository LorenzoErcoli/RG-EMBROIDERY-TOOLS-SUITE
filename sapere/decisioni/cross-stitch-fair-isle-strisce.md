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

**Ricava modulo nel tool** (`module.ts`, 2026-10-01): fa da solo i passi qui sopra e ritrova
esattamente 429 × 657 px, 72 × 112 V, modulo 36 × 56, 6 fili, 1 colore di bordo tolto (circa 4 s).
Le righe le dà la trama del filo (che in verticale si ripete ogni 2 righe, 11,73 px) col multiplo che
fa la V quasi quadrata; colonne e righe restano correggibili a mano. Su un'immagine sintetica a bordi
netti i bordi dopo la media 5×5 facevano «pianori» e contavano 3-5 bordi spostati per uno: un bordo
solo, al centro del pianoro.

**La vista Modulo** (2026-10-01, Lorenzo: «un editor del modulo… si riverbera su tutto»; e poi «i
passaggi del filo»: si comincia dalla vista). Le giunture del modulo sono arbitrarie e tagliano i
motivi: sul Fair Isle, così come esce, la verticale taglia 25 V di disegno e l'orizzontale 7; con
*Giunture sulla base* 20 e 4. La verticale non scende sotto 20: le fasce orizzontali (verde,
triangoli) attraversano tutto il modulo e qualsiasi giuntura verticale le taglia — quando i passaggi
si calcoleranno per modulo, il passaggio da una copia all'altra lungo le fasce va gestito.

**I passaggi del modulo** (2026-10-01). Calcolati su un modulo da solo e ripetuti non funzionano:
inizio e fine di ogni filo cadono dove capita (quasi tutti a sinistra), e per passare alla copia dopo
il filo attraverserebbe il modulo. Con **ogni copia un gruppo, da sinistra a destra**, invece, il motore
dopo 2-3 copie ripete da solo lo stesso giro (sul Fair Isle, 8 copie: tutti i fili identici dalla
terza alla settima; su un modulo sintetico alcuni fili si alternano fra due giri, a serpentina). Costo
sul Fair Isle: filo in vista 6,27 → 6,77 m per striscia di 5 copie (+8%), ripassi 22,7 → 22,0 m. Un
salto deciso sul modulo si mette in ogni copia (un clic, 10 salti su 5 × 2 copie).

**Ancora aperto:** il 67% del filo in vista sta nei passaggi oltre 12 mm (32 su 116 per striscia di
2 moduli). Farli diventare salti col taglio lo porterebbe a circa un terzo, con più tagli in macchina:
da decidere con Lorenzo.

**Come si applica:** prima di un passaggio da un'immagine, cercare il modulo vero (le copie quasi
uguali sono rumore) e i colori finti (pezzi minuscoli lungo i bordi); misurare l'ordine dei fili sul
filo in vista invece di darlo per scontato.

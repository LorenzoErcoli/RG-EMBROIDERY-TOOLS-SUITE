---
titolo: Interlace — la densità è la cella, per colore; la densità globale divisa fra i fili è stata provata e tolta
tipo: decisione
tool: [interlace]
data: 2026-07-28
---

In interlace la **densità = dimensione della cella di copertura** (spaziatura fra le file di filo,
~0,8–3,2 mm) con un bersaglio di copertura FISSO (`COVER_TARGET = 2`). Cella piccola = fitto, più
filo; cella grande = rado, meno filo; gamma continua e monotona. Ogni colore può avere la sua densità
(`colorDensities[]`, vuoto/0 = usa `densitySpacingMm` globale); nel pannello è un campo per riga-colore.

**Perché:** il vecchio modello (densità → bersaglio di copertura, cella fissa ~2 mm) aveva solo 2
livelli, e a densità bassa il filo AUMENTAVA (dominavano i tragitti della continuità). Così ha una
manopola vera.

## Il modello scelto: solo "per colore"

Ogni colore è un filo continuo che copre TUTTA l'area alla sua densità. Con N colori la densità totale
è ~N× e nessuna manopola la abbassa (i tragitti della continuità riempiono comunque). È il look più
bello (mélange ricco) e **Lorenzo l'ha scelto**.

## La densità GLOBALE divisa fra i fili — provata a fondo e RIMOSSA, non ricostruirla

Lorenzo la voleva (*«aggiungere un colore non deve infittire»*). È stata implementata
(`fillMode: 'global'`, commit poi rimosso) in due varianti:

- **dither**: copertura divisa per cella + frammenti ricuciti con spostamenti instradati (mai salti) →
  −30% di densità, 4 stacchi, R5 rispettata. Ma **meno interessante**: dividere la densità toglie
  sovrapposizioni → mélange più piatto.
- **gap-fill**: copertura condivisa, ogni colore popola i buchi dei precedenti → ~1 strato totale, ma
  vira ai **territori a colore (macchie)** e un colore domina.

**Il nodo strutturale (la lezione):** la ricchezza del mélange = **sovrapposizione dei fili**. Leggero
e ricco sono la STESSA leva in opposizione: dividere la densità = meno sovrapposizione = meno ricco.
Non esiste "globale + ricco".

## Il tetto: cella 4 mm

Fino a ~3–3,5 mm la densità è omogenea; oltre, il filo continuo NON si dirada — per restare continuo
rimbalza in tragitti che si AMMASSANO (a densità 6, 4 colori: 147 m e disomogeneo, sinistra densa e
destra rada). **Rado + omogeneo + continuo oltre ~3,5 è impossibile.** Già provate e scartate, non
riprovarle: jitter sui pareggi di `nearestGap`, copertura T=1 a cella grande, stop anticipato della
copertura — tutte peggiorano l'omogeneità o non diradano.

## Il tetto alzato a 10 mm (2026-11-20)

Lorenzo: *«permettimi di aumentare molto di più la densità. ora si ferma a 4»*. Il campo accettava numeri più alti
ma il motore li riportava a 4 senza dirlo; la densità per colore si fermava a 3,2. Ora il tetto è
`DENSITY_MAX_MM = 10` per tutte e due.

**Misurato** (rettangolo 120×80, punti 2-5 mm, variante 3), con il motore di oggi:

- 1 colore: 4 mm → 2,99 m, 6 → 1,92 m, 8 → 1,37 m, 10 → 1,20 m, sempre un tratto. A 12 mm si ammassa: una zona
  10×10 mm 13 volte più piena della media. Per questo il tetto è 10 e non 12.
- 4 colori: 4 mm → 12,1 m, 6 → 7,7 m, 8 → 5,4 m, 10 → 6,3 m con un tratto in più. **Fino a ~8 il filo cala; oltre
  non si dirada più.**

La misura del 2026-07-28 qui sopra (densità 6 con 4 colori: 147 m) era su un pezzo più grande e con il motore di
allora. **Non visto cucito.**

Vedi [passaggi brevi](interlace-passaggi-brevi.md). Il confronto col modello di densità di bitmap è la
voce C6 di `STATO.md` (e D4 del cervello: si decide caso per caso).

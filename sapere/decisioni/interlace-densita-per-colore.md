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

Vedi [passaggi brevi](interlace-passaggi-brevi.md). Il confronto col modello di densità di bitmap è la
voce C6 di `STATO.md` (e D4 del cervello: si decide caso per caso).

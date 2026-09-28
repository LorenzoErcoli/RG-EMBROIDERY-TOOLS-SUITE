---
titolo: Migrando un tool si tengono tutte le funzioni e il suo modello a fasi
tipo: metodo
tool: [bitmap]
data: 2026-07-28
---

Migrando un tool nella suite (il primo caso è stato `bitmap_to_stitch`), Lorenzo vuole che si
mantengano **tutte le funzionalità e i parametri dell'originale**, strutturati meglio e adeguati alla
suite — non un sottoinsieme.

**In particolare va preservato il modello di interazione.** bitmap è a **due fasi**: *Analizza*
(anteprima) e poi *Genera*. L'anteprima è «importantissima»: fa vedere selezione e colori **prima** di
far girare la generazione pesante. Appiattirla nell'ergonomia "calcola sempre" della suite (come
net-45 e interlace) è stato un errore: il nearest-neighbor è O(n²) → generava a ogni modifica e **il
sistema si impallava**.

**Perché:** la "suite uniforme" non deve cancellare come lo strumento *funziona davvero*; per le
operazioni costose il calcolo continuo è dannoso.

**Come si applica:** la fase leggera (selezione, quantizzazione, anteprima) è live o con un ritardo;
la fase pesante (ordinamento, distanza minima) parte solo da un bottone. Si riporta ogni parametro
dell'originale, organizzato in sezioni. Vale per ogni migrazione (oblique, cross-stitch, 45-grid).

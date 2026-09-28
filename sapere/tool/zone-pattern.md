---
titolo: Pattern a zone, l'ottavo tool — ruota il piano, non il modulo
tipo: tool
tool: [zone-pattern, pattern-grammar]
data: 2026-09-03
---

`apps/zone-pattern` è l'**ottavo tool** della suite, aggiunto il 2026-09-03. Riempie di pattern le
**zone colorate di un disegno**, una per una, ruotando il pattern sull'inclinazione di ogni zona.
Nato dal **cannage Dior** (committato come `test/fixtures/cannage-zone.svg`; l'originale è in
[riferimenti](../riferimenti/LEGGIMI.md)).

**L'idea che regge tutto: si ruota il PIANO, non il modulo.** Zona inclinata di θ → si ruota il
*poligono* di −θ, si genera col motore di `@rg/pattern-grammar` intatto, si ruota indietro di +θ.
Nessuna riga del motore toccata.

## Le decisioni di Lorenzo (2026-09-03)

1. **Misura**: si legge dal file, non si digita. Illustrator 72 dpi sull'ingombro del disegno →
   378,421 mm (la tavola/viewBox sarebbe 378,948: la differenza è il margine).
2. ~~Rotazione automatica, con controllo~~ — **rovesciata il 2026-09-14**: *«ogni colore parte sempre
   da 0 di angolatura, quella la mettiamo a mano»*. Ora `ZoneRole = {pattern, angleDeg}` (default 0) e
   l'angolo misurato è solo "suggerito …°" nella mappa colori. I progetti vecchi: `angleOffsetDeg` →
   `angleDeg` via `normalizeRole`.
3. **Reticolo condiviso solo come SEQUENZA**: ogni modulo/rombo resta un blocco separato, *«così li
   controllo meglio»*.
4. **Sequenza continua** fra rombi dello stesso pattern; **cambio pattern = cambio ago**. Dal
   2026-09-14 i pattern sono **N, non 2**: ogni riga della mappa colori offre le lettere in uso + una
   nuova (A → A,B → A,B,C…); un gruppo nel pannello per lettera, un ago per lettera; colori degli aghi
   dalla palette categoriale del DS.
5. **Il pattern di un ago si sceglie da un preset o si legge da un SVG — ma sempre come VALORI, mai
   come geometria.** Vedi [valori, non geometria](../metodo/valori-non-geometria.md).

## La struttura del cannage, misurata

6 tinte = **2 pattern × 3 famiglie di inclinazione**: rosa/viola 45°, rosso/arancio 15°, blu/verde
~76°. Le tinte che Lorenzo accoppia (rosa-rosso-blu = pattern A, viola-arancio-verde = B) cadono sullo
**stesso reticolo** entro 1°.

**Decisione aperta**: il **punto minimo non è garantito** (il più corto misurato 0,018 mm su 0,4
chiesti, 0,17% dei segmenti) — è il caso A6a di `STATO.md` peggiorato dall'avere 37 riconnessioni al
bordo invece di una. Vince la macchina o vince il disegno?

Le aree di scarico valgono anche qui: vedi [aree di scarico](../decisioni/aree-di-scarico.md).

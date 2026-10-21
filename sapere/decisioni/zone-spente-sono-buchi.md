---
titolo: Una zona spenta dentro un'altra è un buco
tipo: decisione
tool: [zone-pattern, cannage-rafia]
data: 2026-10-21
---

Lorenzo, 2026-10-21: *«sì, una zona spenta dentro un'altra diventa un buco»*.

**Il fatto.** Nel motore delle zone (`packages/pattern-grammar/src/zone/pipeline.ts`, `buildZonePlan`) ogni
zona si riempiva col suo pattern come un poligono pieno. Una zona dentro un'altra non la bucava: se la zona
di dentro era spenta («non ricamare»), la zona di fuori la ricamava lo stesso. È venuto fuori col
collegamento a Stilista: una selezione con un foro tornava ricamata anche nel foro (corona di SH295: 25.360
punti col foro pieno, 19.980 col foro vuoto).

**La regola.** Una zona col ruolo **dichiarato** spento (`pattern: 'off'`) che sta tutta dentro un'altra zona è
un buco di quella: il pattern non ci entra (`fillZone` la passa al ritaglio del Generatore come `hole: true`, e
i raccordi ci girano attorno). In Pattern a zone ogni tinta senza pattern è spenta di serie, quindi vale
per tutte quelle. Una tinta **senza ruolo** resta com'era: Cannage rafia passa al motore solo la tinta della
sua base (e le aree di scarico), le altre non hanno ruolo e non cambiano niente.

**Perché solo le spente.** Una zona dentro un'altra *con un altro pattern* non è stata decisa: per ora le due
si sovrappongono come prima.

**Come si applica.** Smoke: un quadrato col pattern A e uno spento dentro → nessun punto nel buco; senza ruolo
→ ricamato come prima (col codice di prima: 93 punti nel buco).

---
titolo: Zone dentro altre zone — spenta o della stessa tinta è un buco, di un'altra tinta è un secondo pattern (che può svuotare il primo)
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

**Il resto della regola** (Lorenzo, 2026-10-21, lo stesso giorno, guardando i due casi disegnati: *«se ha lo
stesso colore è buco se è diverso è un secondo pattern. Importante però che il primo possa essere
svuotato»*):

- **stessa tinta dentro la stessa tinta = buco.** Conta quante volte si è dentro zone della propria tinta:
  dispari = buco (non si ricama, buca quella che lo contiene), pari = isola (si ricama). È la convenzione dei
  tracciati composti, la stessa del Generatore pattern;
- **tinta diversa = secondo pattern**, ricamato sopra il primo come prima;
- **«Svuota sotto»** (`ZoneRole.svuota`, la casella nella riga della tinta in Pattern a zone): la zona di fuori
  non si ricama sotto le zone delle altre tinte che porta dentro. Di serie spenta.

Misurato sui due quadrati (60 mm, dentro 24 mm, canvas e nastro): tinta diversa 3.342 punti fuori + 517 dentro;
con «Svuota sotto» 2.947 fuori (come col buco) + 517 dentro.

**Come si applica.** Smoke: spenta dentro → nessun punto nel buco (col codice di prima 93); senza ruolo → come
prima; stessa tinta → buco, e l'isola nel buco si ricama; tinta diversa → sopra; con «svuota» → sotto niente;
`normalizeRole` conserva `svuota` riaprendo un progetto.

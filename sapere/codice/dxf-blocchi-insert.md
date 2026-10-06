---
titolo: L'importatore DXF non legge i blocchi (INSERT): un file valido importa a zero contorni, in silenzio
tipo: codice
tool: []
data: 2026-10-06
---

**Il difetto (prima del 2026-10-06).** `parseDxfToContours` (`packages/core/src/io/dxf.ts`) saltava alla sezione `ENTITIES` e leggeva `LINE`,
`LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`. **Non conosceva `INSERT` né la sezione `BLOCKS`.** Il DXF `BASE RICAMO VENERE 85 SC.dxf` (esportato da un
CAD in formato AC1009) tiene tutto il disegno dentro un blocco `BASERICAMO_39` e in `ENTITIES` ha **solo un INSERT a (0,0)**:
l'importatore restituiva **0 contorni, 0 × 0 mm, nessun errore**. Il tool dentro cui lo si caricava vedeva «nessun contorno».

**Perché è grave:** è il caso già visto con `CIRCLE`/`ARC` (sparivano in silenzio e restava una sagoma sbagliata): un file
CAD normale non si importa e non lo dice.

**Corretto nel core il 2026-10-06** (`packages/core/src/io/dxf.ts`), perché il tool `razza` non poteva aprire il DXF di
Lorenzo: ora `parseDxfToContours` legge la sezione `BLOCKS` e gli `INSERT` — punto di inserimento, scala (anche non
uniforme), rotazione, punto base del blocco, blocchi dentro blocchi (fino a 8 livelli: oltre, o un blocco che richiama se
stesso, si ferma senza loop) e blocco inesistente (nessun contorno, nessun errore). Lucchetto in `test/smoke.mjs`
(«import DXF: blocchi e INSERT», 9 asserzioni): lo stesso quadrato letto direttamente e via blocco coincide.

**Secondo difetto trovato dal lucchetto, stesso file:** un `POLYLINE` col flag 70 bit 1 («chiusa») ma **senza** il primo
vertice ripetuto in fondo veniva letto come **aperto** — il flag era ignorato e si guardava solo se l'ultimo punto
coincideva col primo. Un DXF corretto non ripete il vertice. Ora il flag vale (e vale ancora il confronto geometrico).

**Lezione:** un importatore che salta in silenzio ciò che non riconosce è peggio di uno che si rompe. Davanti a un DXF che
importa «vuoto» la prima cosa da guardare sono le sezioni `BLOCKS` e `ENTITIES`.

Nota collegata: il parser capovolge la Y (`y: -y`) all'import, per la convenzione Y-giù della suite. L'anteprima mostra il
pezzo come nel CAD.

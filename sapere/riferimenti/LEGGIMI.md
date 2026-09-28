---
titolo: I file di riferimento — dove stanno e da quale tool sono stati letti
tipo: riferimento
tool: []
data: 2026-09-28
---

Un riferimento è un ricamo vero (quasi sempre un DST fatto in Stilista) da cui un tool è nato o contro
cui è misurato. **Si legge per i suoi valori, non si ricalca** (vedi
[valori, non geometria](../metodo/valori-non-geometria.md)).

Questo indice raccoglie quelli citati nelle note al 2026-09-28. La fase **K6** del cervello aggiungerà a
ognuno le sue misure lette da `readDst` (densità, lunghezze dei punti, angoli, salti, aghi), scritte da
uno script e non a mano.

## Nel repo

| File | Tool | Cosa è |
|---|---|---|
| `test/fixtures/m1404-dav-stop.dst` | cannage-rafia | davanti della borsa M1404, lo stop delle linee: il test ritrova il 100% degli elementi |
| `test/fixtures/m1424-orlatura.dst` | cannage-rafia | `M1424 ORLATURA E MEDAGLIONE`, da cui è letta la bordatura (stop 7–10) |
| `test/fixtures/cannage-zone.svg` | zone-pattern | il cannage Dior a zone (`Risorsa 1.svg`) |
| `test/fixtures/cannage-rafia-m3641-*.svg` | cannage-rafia | l'SVG a zone del modello M3641 Cocotte |
| `test/fixtures/scarico-davanti.svg` | pattern-grammar, zone-pattern | davanti-v2 con le aree di scarico |
| `test/fixtures/cianotipia-contorno.json` | pittorico | il contorno della sfera ricavato dai pixel |
| `BRIEFING-RASO-OMOGENEO/riferimento-a-mano.dst` | pittorico | il riempimento fatto a mano: 42 blocchi, densità p95/p5 2,1× |
| `strumenti-sviluppo/ricamo-3d/calibrazione/calibrazione.dst` | ricamo-3d | il DST di calibrazione della simulazione 3D |
| `apps/cross-stitch/.lab/lorenzo10.dst` | cross-stitch | **non tracciato** (`.lab/` è in `.gitignore`) |

## Fuori dal repo (sul server)

| File | Tool | Cosa è |
|---|---|---|
| `PUNTO-STRIATURA.dst` | striatura | il DST da cui è nato il Punto Striato (i 7 cambi colore sono marcatori, non colori) |
| `BROCCATO.dst` — `\\srv01\Condivisa\GIANLUCA E LA SQUADRA\_ERCOLI LORENZO\` | broccato | il DST decodificato: copertura dei passaggi 81 → 0% lungo i colori |
| `M1404 DAV CANNAGE RAFIA - M1.dst` e `M1404 LATO … .dst` — `\\srv01\Condivisa\ROBERTA SCHEDE TECNICHE PROVVISORIE\SUMMER 26\PELLETTERIA\DONNA\CANNAGE RAFIA\M1404 EQY M918 BEIGE\DST\` | cannage-rafia | davanti 299 × 282 mm, 235.577 punti, 8 aghi; lato 214 × 317 mm, 183.870 punti, 7 aghi |
| `MODELLO-DIVISO-ZONE-PIAZZAMENTI DEF_FONDO-BORDATO.svg` — `\\srv01\Condivisa\_2026\CAMPIONARIO\DIOR\RIVIERA 27\DONNA\PELLETTERIA\CANNAGE RAFIA\M3641 COCOTTE\AI\` | cannage-rafia | l'SVG a zone per le basi (rosso `#e42320` / blu `#2a4e9c` a scacchiera) |
| `Risorsa 1.svg` — `\\srv01\…\_2027\DIOR\CANNAGE-PATTERN-AUTOGENERATE\SVG\` | zone-pattern | il cannage Dior originale |

**Mancano** (voci di `STATO.md`): l'immagine vera del broccato (B4) e un DXF di lavorazione (B3).
Il DST di riferimento di `PUNTO-STRIATURA` e quello di `BROCCATO` non sono nel repo: se ne servono le
misure (K6), vanno copiati in `test/fixtures/`.

---
titolo: Interlace, il terzo tool — cos'è e com'è costruito
tipo: tool
tool: [interlace]
data: 2026-07-24
---

**interlace** (`apps/interlace`) è il terzo tool della suite, definito con Lorenzo in una chat
dedicata nel luglio 2026. Genera una **tessitura ricamata multicolore a più strati**: importa un
cartamodello DXF/SVG (colori → ruoli: `MASTER_OUTLINE` = area, `EXCLUSION` = area vuota) e la riempie
con un **filo continuo di passaggi brevi** che si intrecciano (vedi
[passaggi brevi](../decisioni/interlace-passaggi-brevi.md)), omogeneo, rispettando vuoti e bordo.

- **Multicolore**: un solo filo tagliato in cambi d'ago che **ruotano sulla palette** (N colori
  variabili + `paletteCycles`); ogni colore ricompare su più strati sovrapposti (l'ultimo non solo in
  cima). Un gruppo per colore nell'export SVG, come l'SVG di riferimento. Il DST è arrivato dopo, come
  per tutti i tool.
- **Il motore** sta in `apps/interlace/src/engine.ts`, **locale all'app** (regole di crescita 1–2),
  non nel core. Dal core riusa import e scala in mm, ruoli, geometria, export allineato (R27/R9); da
  `@rg/ui` il guscio, pan/zoom e il salvataggio.
- **La densità** è per colore: vedi [densità per colore](../decisioni/interlace-densita-per-colore.md).

Cosa resta da fare sta in `STATO.md` (C4 densità per zona, C5 vuoto dello stesso colore, C6 modello
densità unificato, A5 i nomi dei parametri "movimento").

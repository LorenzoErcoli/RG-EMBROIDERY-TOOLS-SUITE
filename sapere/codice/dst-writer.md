---
titolo: Il writer DST sta nel core ed è il porting byte-per-byte dello standalone
tipo: codice
tool: []
data: 2026-07-28
---

Il writer dei file Tajima `.dst` vive nel core: `packages/core/src/dst.ts` → `buildDst(program)`,
che restituisce un `Uint8Array` (sicuro nel browser, niente `fs`/`Buffer`). È un **porting
byte-per-byte identico** del writer standalone di riferimento,
`C:\Users\l.ercoli\Documents\GitHub\stilista-json-bridge-clean\standalone-dst\dst-writer.mjs` — quello
è la fonte canonica del formato: header di 512 byte, record di 3 byte in decimi di mm, al massimo ±121
per asse, fine `00 00 F3`, cambio colore quando cambia `needle`.

Il `program` in ingresso: `{ label, coordinate_system: 'svg'|'cartesian', paths: [{ needle, points_mm: [[x,y]…] }] }`
— la stessa forma del writer Node, così un program funziona identico nei due. `coordinate_system: 'svg'`
inverte la Y.

È un **mattone globale** (Lorenzo: *«pensalo globale, aggiungibile a tutte le app»*), R31:

- `buildDst(program)` — l'encoder puro;
- `dstFromExportLayers(layers, { label, metadata })` + la costante `DST_FILE` — l'adattatore da
  `ExportLayer[]` di **qualsiasi** tool: salta i `shapeOnly`, un ago per strato cucito (→ cambio
  colore in sequenza), mm reali, centrato all'origine; `metadata` finisce nel footer (R27, riapribile
  con `readDstMetadata`) e **la cucitura resta byte-identica**;
- `saveBinaryFile(bytes, opts)` in `@rg/ui` — il salvataggio.

Oggi lo usano tutti i 13 tool. Il DST non porta l'ago reale né i colori del filo (li imposta
l'operatore). **Se si cambia l'encoder, si riverifica il byte-per-byte contro lo standalone.**

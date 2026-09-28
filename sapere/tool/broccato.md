---
titolo: Broccato, il settimo tool — e le sei decisioni di Lorenzo
tipo: tool
tool: [broccato]
data: 2026-08-26
---

`apps/broccato` è il settimo tool della suite, iniziato il 2026-08-26. Da un'**immagine di tessuto**
costruisce un ricamo a colori: ogni tinta riempie le sue aree di **raso molto rado orizzontale**, a
**pettine** (va e torna sulla stessa linea) o **normale**; fra il rado si intravede il fondo → effetto
d'intreccio. Nato dalla decodifica di `BROCCATO.dst` (vedi [riferimenti](../riferimenti/LEGGIMI.md)).

## Le decisioni di Lorenzo — non si ricavano dal codice

1. **4–8 aghi in tutto**, base compresa. Non di più.
2. **Base**: 1 o 2 colori possono riempire tutta la sagoma a righe intere. Un colore si può marcare
   **escluso dall'immagine** (lo sfondo della foto): lì non nasce macchia, copre la base.
3. **Densità manuale per colore**, con un bottone "applica a tutti". **Niente** variazione automatica
   (né casuale né guidata dall'immagine): la gestisce lui.
4. **L'immagine arriva già col motivo ripetuto** (il tessuto intero), non come singolo rapporto →
   niente affiancamento di piastrelle.
5. **Il raso va nel core** (R24), **i passaggi nascosti restano locali** finché non sono confermati
   sul ricamo vero. *(Poi confermati: dal 2026-09 i passaggi nascosti sono in `core/routing.ts`, C8.)*
6. Il nome `broccato` "va bene per ora" — non è definitivo.

## Il cuore della tecnica

Misurato sul DST: la copertura dei passaggi **cala lungo l'ordine dei colori**
(81 → 77 → 66 → 53 → 51 → 29 → **0%**) — ogni colore nasconde i suoi passaggi sotto i successivi,
l'ultimo non ha niente sopra. È l'invariante su cui è bloccato il motore.

**Il problema vero non è il ricamo, è la riduzione dei colori**: su un tessuto fotografato lo stesso
motivo in due punti ha un tono diverso → cade su aghi diversi → la ripetizione non si somiglia. Vedi
[una misura sola non basta](../metodo/una-misura-sola-non-basta.md).

Manca ancora l'**immagine vera** del broccato come fixture (B4 in `STATO.md`): i default della
preparazione sono tarati su immagini sintetiche.

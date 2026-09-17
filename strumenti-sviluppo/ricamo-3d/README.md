# ricamo-3d (v0) — modulo di sviluppo RG-EMBROIDERY-TOOLS-SUITE

Visualizzazione 3D fisica di ricami su termogarza: cucitura, rimozione della garza, assestamento dei fili.

## Uso
    python esegui.py "percorso/file.dst"
Genera `rg-ricamo-3d-termogarza.html` (apribile nel browser) e stampa le metriche per
cotone 30/40 × 0/1/2 strati. Dipendenze: numpy, scipy. Il lettore DST è interno.

## Nella suite
Strumento di sviluppo, **non** un tool della home: sta fuori dai workspace npm (`apps/*`),
la suite non lo esegue e `npm test` / `typecheck` / `build` non lo toccano.
Ambiente, una volta sola, dalla radice del repo:

    python -m venv strumenti-sviluppo/ricamo-3d/.venv
    strumenti-sviluppo/ricamo-3d/.venv/Scripts/python -m pip install -r strumenti-sviluppo/ricamo-3d/requirements.txt

Poi, con l'ambiente attivo (`.venvScriptsactivate`):

    npm run sviluppo:ricamo-3d -- "percorso/file.dst"

L'HTML esce accanto a `esegui.py` ed è ignorato da git, come `.venv/`. Per guardarlo nel browser
del Code c'è la configurazione `ricamo-3d` in `.claude/launch.json` (porta 5312).

## File
- `dst_reader.py` — decodifica DST Tajima (0,1 mm).
- `parametri.py` — tutti i numeri fisici. Quelli marcati DA_MISURARE sono ipotesi.
- `modello.py` — cucitura (filo teso sopra garza compressa e fili già posati, in ordine macchina),
  rimozione garza, rilassamento con lunghezza, flessione, contatto filo-filo, appoggio sul tessuto.
- `esegui.py` — ritaglio centrale, varianti, metriche, visualizzatore.
- `viewer_template.html` — visualizzatore three.js.

## Limiti noti v0
- La lunghezza di filo è bloccata per singolo punto: il filo non scorre ancora nei fori
  verso i punti vicini o verso la spola.
- Sezione del filo circolare, nessuna torsione reale dei capi.
- Nessun parametro è calibrato su campioni reali.
- Errore residuo di lunghezza del rilassamento circa 3%.

## Prossimi passi
1. Campioni 0/1/2 strati, stesso disegno e filo: macrofoto e sezione tagliata.
2. Sostituire i DA_MISURARE, confrontare altezza arco e copertura misurate/simulate.
3. Scorrimento del filo nei fori (filo continuo), poi fibre procedurali e rendering path tracing.

# ricamo-3d (v0) — modulo di sviluppo RG-EMBROIDERY-TOOLS-SUITE

Visualizzazione 3D fisica di ricami su termogarza: cucitura, rimozione della garza, assestamento dei fili.

## Uso
    python esegui.py "percorso/file.dst"                     # cucitura rigida (predefinita, con ventaglio)
    python esegui.py "file.dst" --lato 6 --cucitura incrementale   # incrementale: solo pezzetti di pochi mm
    python esegui.py "file.dst" --centro X Y --lato 40 --senza-ventaglio
    python immagini.py "file.dst" --centro X Y --lato 40     # dall'alto e radenti con 0, 1, 2 garze (cartella immagini/)
    python test_rimozione.py                                 # con 0 strati la rimozione non deve muovere niente
Genera `rg-ricamo-3d-termogarza-rigida.html` (con `--cucitura incrementale`: `…-termogarza.html`, apribile nel browser) e
stampa le metriche per cotone 30/40 × 0/1/2 strati. Dipendenze: numpy, scipy, numba (Pillow solo
per l'anteprima della calibrazione). Il lettore DST è interno.

## Il modello, in quattro fasi
1. **DST → fori** (`fori_da_dst`).
2. **Cucitura**, in ordine macchina. *Incrementale* (`cucitura.py`): i fili già posati sono
   nodi fisici. Per ogni punto: (a) **l'ago** entra nel foro, un cilindro da `DIAMETRO_AGO`: i nodi di
   filo esistenti che tocca vengono spinti fuori radialmente, oppure, se l'asse li prende entro
   `SOGLIA_INFILZATO` × r dal centro, **infilzati** e legati al foro (i fili che hanno già un capo in
   quel foro ci stanno dentro e l'ago non li tocca); (b) **posa** del filo teso tra i due fori, sopra
   garza e fili esistenti; (c) **rilassamento locale** entro `RAGGIO_LOCALE` per `ITER_LOCALI`
   iterazioni: lunghezza, flessione, contatto comprimibile a sezione ellittica, attrito coulombiano,
   appoggio sulla garza. Fuori dal raggio i fili restano fermi. Finché il punto è in cucitura il filo
   si tende verso la corda (il tendifilo lo fa scorrere nei fori); chiuso il punto, la sua lunghezza di
   riposo è quella tesa meno `TENSIONE_CN` / EA ed è bloccata. *Rigida* (predefinita): ogni
   punto passa teso sopra la garza e i fili già posati e **si apre a ventaglio**:
   fra `SCOSTAMENTI_N` scostamenti laterali a forma sin(πt) (nulli ai fori, massimi al centro, fino a
   min(`VENTAGLIO_MAX_MM`, `VENTAGLIO_FRAZ` × corda)) sceglie quello di costo minimo, altezza media
   d'appoggio nella parte centrale + `K_VENTAGLIO` × (lunghezza in pianta − corda); a parità il più
   piccolo. Così i passaggi ripetuti sugli stessi fori non si impilano a torre (`--senza-ventaglio` lo
   spegne). **Il filo si fa spazio**: la rigida lavora in tre tempi.
   (a) *Chi sta sopra.* Ogni punto passa teso sopra la garza e sopra i fili già posati, tondi (centro a
   z + (r + r) · √(1 − ρ²/d²), ρ la distanza in pianta): fissa la pianta e l'ordine sopra/sotto. Un filo
   quasi parallelo (entro `PARALLELI_ANGOLO_GRADI`) non sale su quello vicino, gli sta di fianco, e ci sale
   solo se i centri distano meno di r (i passaggi sugli stessi fori, che il ventaglio apre); dentro
   `RAGGIO_AGO` da un foro in comune i fili non si impilano, scendono insieme nel foro.
   (b) *Compattazione.* La bobina tira giù ogni filo, che spinge giù quello che copre: un nodo con U fili
   sopra (pesati da quanto sono centrati) resta alto d · c, c = `COMPATTAZIONE_PILA_MIN` + (1 −
   `COMPATTAZIONE_PILA_MIN`) · exp(−U / `CARICO_PILA_STRATI`), e la garza sotto si comprime allo stesso modo
   fino a `GARZA_FORO`. Si rifà la posa nello stesso ordine con quelle sezioni: una pila di tanti fili
   cresce sempre meno.
   (c) *Teso, giù solo al suo foro.* Ogni filo è l'inviluppo teso dei suoi appoggi: dritto fra l'uno e
   l'altro, **nessuna onda**. Scende solo entrando nei suoi due fori, dove la bobina lo tira giù: lì non
   sta più su dell'appoggio + `IMBUTO_PENDENZA` · distanza dal foro. **Senza spigoli**: raggio minimo
   `RAGGIO_CURVA_MM` (il bordo alto di un cerchio fatto scorrere sul filo).
   Il visualizzatore disegna il filo schiacciato basso e al più 1,25 volte più largo. I **fori** hanno
   la garza schiacciata dall'ago: entro `RAGGIO_AGO` ne resta `GARZA_FORO`, fino a 2 × `RAGGIO_AGO` si
   torna alla garza piena. Nodi in griglia (celle di lato d), ricerche compilate con numba
   (`solutore.quota_fili`, `carico_sopra`, `curva`).
3. **Rimozione della garza**. La cucitura si esegue **due volte con la stessa logica** (ventaglio
   compreso): con gli strati scelti e con 0 strati. La cucitura a 0 strati è lo **stato di riposo**:
   lunghezze di riposo per lato e curvature di riposo vengono da lì, non dal filo dritto. Il **filo in
   eccesso** di ogni punto è la lunghezza cucita con la garza meno quella a 0 strati, meno la parte che
   rientra nel foro (`RIENTRO_FORO`); si aggiunge alle lunghezze di riposo. La forma di partenza è la
   cucitura a 0 strati con l'eccesso come arco, aperto di lato (verso cui il punto si è aperto a
   ventaglio) di un angolo proporzionale all'eccesso fino a `APERTURA_MAX_GRADI` (pieno a
   `APERTURA_ECCESSO_PIENO`). Niente forma casuale. **Con 0 strati non si muove niente**: lo verifica
   `test_rimozione.py`.
4. **Rilassamento finale**: lunghezza e flessione verso lo stato di riposo; contatto fra le sezioni
   della cucitura a 0 strati (rigida: tonde, distanza d; incrementale: ellittiche, dalla compattazione
   del nodo), mai più stretto della distanza che la coppia aveva
   a riposo, **con la direzione di spinta fissata dallo stato di riposo**: chi a 0 strati stava sopra
   resta sopra anche se l'arco di quello sotto sale; collare attorno ai fori;
   gli infilzati restano sul foro. La forma rilasciata si disegna con le sezioni della cucitura a 0 strati.

## Parametri (`parametri.py`)
| gruppo | parametro | valore | stato |
|---|---|---|---|
| filato | `FILATI` (tex, materiale) · `DENSITA_APPARENTE_COTONE` | 1000/30, 1000/40 cotone · 0,90 g/cm³ | densità DA_MISURARE |
| garza | `SPESSORE_GARZA_STRATO` · `COMPRESSIONE_GARZA` | 0,25 mm · 0,60 | DA_MISURARE |
| cucitura | `RAGGIO_LOCALE` · `ITER_LOCALI` (minime) · `ITER_LOCALI_MAX` · `TOLLERANZA_LOCALE_MM` · `SOLUTORE` · `FINESTRA_CONVERGENZA` | 2,5 mm · 25 · 400 · 0,001 mm · gauss-seidel · 10 | numerici |
| tensione | `TENSIONE_CN` | 90 cN | DA_MISURARE (tensiometro) |
| rigidità assiale | `MODULO_SPECIFICO_CN_TEX` (EA = modulo × tex) | cotone 270, poliestere filamento 600 cN/tex | DA_MISURARE |
| contatto | `COMPATTAZIONE_MIN` · `CARICO_COMPATTAZIONE` | 0,45 · 100 cN/mm | DA_MISURARE |
| attrito | `ATTRITO` (statico) · `ATTRITO_DINAMICO_FRAZ` | cotone 0,5, filamento 0,25 · 0,8 | DA_MISURARE |
| ago | `DIAMETRO_AGO` · `SOGLIA_INFILZATO` | 0,75 mm · cotone 0,6, filamento 0,3 | soglia DA_MISURARE |
| fori | `RAGGIO_AGO` · `GARZA_FORO` | 0,375 mm · 0,35 | DA_MISURARE (tranne il raggio) |
| rimozione | `RIENTRO_FORO` · `APERTURA_MAX_GRADI` · `APERTURA_ECCESSO_PIENO` | 0,4 · 40° · 0,25 | DA_MISURARE |
| rilassamento | `COLLARE_FRAZ` · `COLLARE_RAGGIO` · `RIGIDEZZA_FLESSIONE` · `ITERAZIONI` · `GRAVITA_PER_ITER` | 0,6 · 1,0 mm · 0,08 · 160 · 0 | collare DA_MISURARE |
| non più nella rimozione | `ALLUNGAMENTO_RECUPERATO` | 0,010 | varrebbe uguale nelle due cuciture: nell'eccesso si annulla |
| pile e fori (rigida) | `COMPATTAZIONE_PILA_MIN` · `CARICO_PILA_STRATI` · `IMBUTO_PENDENZA` · `PARALLELI_ANGOLO_GRADI` · `RAGGIO_CURVA_MM` | 0,45 · 1 filo · 0,5 · 20° · 0,25 mm | DA_MISURARE (sezione tagliata di una pila, macro di profilo e di un satin) |
| non più usati | `SCHIACCIAMENTO_FILO` · `SCHIACCIAMENTO_FORO` | 0,60 · 0,30 | il filo della rigida è tondo |
| ventaglio (rigida) | `SCOSTAMENTI_N` · `VENTAGLIO_MAX_MM` · `VENTAGLIO_FRAZ` · `VENTAGLIO_BORDO_FRAZ` · `K_VENTAGLIO` | 25 · 0,8 mm · 0,22 · 0,10 · 2,5 | max, frazione e K DA_MISURARE (macro con righello) |
| fasci (metrica) | `TOLLERANZA_FORI_FASCIO` · `FASCIO_MIN_PASSAGGI` | 0,25 mm · 4 | tolleranza da confermare |

**Legge di compattazione.** c = `COMPATTAZIONE_MIN` + (1 − `COMPATTAZIONE_MIN`) · exp(−carico /
`CARICO_COMPATTAZIONE`), con carico = tensione × angolo di curvatura del filo per mm (cN/mm): più il
filo gira attorno a un ostacolo, più lo schiaccia; la curva si irrigidisce verso il limite. La
compattazione è plastica (non torna indietro). La sezione è un'ellisse ad area costante: semiasse
verticale r·c, orizzontale r/c; la distanza di contatto fra due nodi si legge nel piano della sezione.

**Metriche** (per variante, nel visualizzatore): diametro, garza compressa, filo in più, arco medio e
p90, altezza a 0,4 mm dal foro, copertura durante/dopo, errore di lunghezza e, nuove: **altezza massima
delle fermature** (media sulle fermature del massimo di ciascuna; fermatura = almeno 3 punti
consecutivi collegati da 0,7 mm al più), **spostamento laterale medio dei fili sovrapposti** (quanto si
è mosso di traverso, a fine cucitura, un nodo toccato da un punto successivo, rispetto a dove era a fine
posa), **fili infilzati** (quanti punti l'ago ha preso, evento per evento), **iterazioni per punto**
(media e massimo) e **punti non arrivati all'equilibrio** (fermati dal tetto) — questi quattro solo con
la cucitura incrementale — e i **fasci**: gruppi di almeno `FASCIO_MIN_PASSAGGI` punti con entrambi i capi
entro `TOLLERANZA_FORI_FASCIO` da quelli di un altro, con numero, larghezza massima (ingombro di traverso,
filo compreso) e altezza massima del filo. Nei DST veri i fori ripetuti non coincidono al decimo: con
tolleranza zero né `pattern (1).dst` né il cartamodello hanno un fascio da 4.

## Nella suite
Strumento di sviluppo, **non** un tool della home: sta fuori dai workspace npm (`apps/*`),
la suite non lo esegue e `npm test` / `typecheck` / `build` non lo toccano.
Ambiente, una volta sola, dalla radice del repo:

    python -m venv strumenti-sviluppo/ricamo-3d/.venv
    strumenti-sviluppo/ricamo-3d/.venv/Scripts/python -m pip install -r strumenti-sviluppo/ricamo-3d/requirements.txt

Poi, con l'ambiente attivo (`.venv\Scripts\activate`):

    npm run sviluppo:ricamo-3d -- "percorso/file.dst"

L'HTML esce accanto a `esegui.py` ed è ignorato da git, come `.venv/`. Per guardarlo nel browser
del Code c'è la configurazione `ricamo-3d` in `.claude/launch.json` (porta 5312).

## Interfaccia: caricare un DST
    python server.py ["file.dst"]           # oppure: npm run sviluppo:ricamo-3d:app

Apre `http://127.0.0.1:5313/` (solo su questo computer). Carichi un DST (bottone o trascinandolo sulla
pagina), sulla pianta clicchi o trascini per scegliere il quadrato da simulare (rotella per ingrandire,
*Vista intera* / *Sul ritaglio*), ne scegli il lato (6–60 mm), scegli la cucitura (incrementale o
rigida, veloce) e premi *Simula*: le 6 varianti girano in parallelo sul server, la barra avanza punto
per punto con il tempo che manca, e alla fine il visualizzatore mostra il risultato. Mentre lavora il
bottone diventa *Annulla*; una simulazione nuova annulla quella in corso (il server è uno solo: due
finestre aperte si annullano a vicenda).
**Colore del filo**: uno per ago (i cambi colore del DST), dal selettore o dai campioni; cambia il 3D
e la pianta al volo, senza ricalcolare, e resta ricordato nel browser. I colori ci sono anche negli
HTML statici di `esegui.py`. Con un file sulla riga di comando la pagina si apre già caricata; la
configurazione `ricamo-3d-app` di `.claude/launch.json` apre `calibrazione.dst`.

## Calibrazione
Un DST di campioni da ricamare davvero (cotone 30 e 40, 0/1/2 strati) e confrontare con la simulazione.

    python calibrazione.py              # scrive calibrazione/calibrazione.dst, _zone.json, _anteprima.png
    python verifica_calibrazione.py     # rilegge il DST con dst_reader.py e lo confronta col JSON
    python esegui.py --zona C           # simula una zona del JSON invece del ritaglio centrale

Area 45 × 62 mm, nessun sottopunto, fermatura di 4 punti da 0,5 mm all'inizio e alla fine di ogni
blocco, salti fra le zone (nessun record oltre 12,1 mm). Zone: **A** satin 2 × 15 mm, **B** satin
6 × 15 mm (passo 0,40), **C** tatami 12 × 12 mm a 0° (righe 0,45, punto 3,5, sfalsamento 1/3),
**D** passaggi doppi come il reticolo di `pattern (1).dst`, **E** tatami 10 × 10 a 0°, cambio
colore, 10 × 10 a 90° spostato di 5/5 mm, **F** quattro croci da 3 mm agli angoli, **G** cinque
fermature isolate a 5 mm (la stessa fermatura del resto del file: il DST non può comandare quelle
automatiche della macchina), **H** incroci: 8 linee orizzontali in punto corsa da 2 mm a 2 mm l'una
dall'altra, poi 8 verticali sopra, coi fori sulle linee orizzontali ma a metà fra i loro fori (l'ago
prende il filo, non il foro) e prolungate di un punto perché le fermature stiano fuori dagli incroci.
Ordine di macchina F, A, B, C, D, G, H, E (il cambio colore di E resta l'ultimo).
Il JSON descrive i punti **come vanno in macchina** (già sulla griglia da 0,1 mm): riquadri reali,
riquadri nominali, punti per blocco, parametri. Con `--zona` la copertura si misura sul riquadro
della zona e l'HTML si chiama `rg-ricamo-3d-zona-<id>.html`.

## File
- `dst_reader.py` — decodifica DST Tajima (0,1 mm).
- `parametri.py` — tutti i numeri fisici. Quelli marcati DA_MISURARE sono ipotesi.
- `modello.py` — lettura dei fori, cucitura rigida, rimozione garza, rilassamento finale, metriche.
- `cucitura.py` — cucitura incrementale: ago, posa, rilassamento locale con contatto comprimibile e attrito.
- `esegui.py` — ritaglio centrale (o una zona con `--zona`), varianti, metriche, visualizzatore.
- `viewer_template.html` — visualizzatore three.js: pagina statica con i dati dentro, o interfaccia se aperto da `server.py`.
- `immagini.py` — tavola e singole immagini dall'alto e radenti, una riga per numero di garze (o senza/con ventaglio), Pillow. Le immagini vanno in `immagini/`, ignorata da git.
- `test_rimozione.py` — con 0 strati lo spostamento di ogni nodo dopo la rimozione deve stare sotto 0,02 mm (rigida e incrementale, zone A, D, G, H e `pattern (1).dst`).
- `server.py` — interfaccia locale per caricare un DST, scegliere il ritaglio e simulare.
- `calibrazione.py`, `verifica_calibrazione.py`, `calibrazione/` — DST di calibrazione, sua verifica, file generati.

## Limiti noti v0
- La lunghezza di filo è bloccata per singolo punto: il filo non scorre ancora nei fori
  verso i punti vicini o verso la spola.
- **Il rientro nel foro è una semplificazione.** Una frazione fissa dell'eccesso di ogni punto
  (`RIENTRO_FORO`) sparisce e non fa arco: non va da nessuna parte, non allunga i punti vicini, è
  uguale per tutti i punti. **Il passo successivo è lo scorrimento vero del filo continuo tra punti
  vicini attraverso i fori.**
- Collare, schiacciamento e garza ridotta ai fori si misurano solo sui due fori del punto stesso, non su
  quelli dei punti vicini.
- La gravità è a 0 (`GRAVITA_PER_ITER` resta solo per le prove): a questa scala domina la rigidità.
- **Contatto «a riposo».** Nel rilassamento una coppia di nodi non viene separata oltre la distanza che
  aveva nella cucitura a 0 strati. Senza questa regola la cucitura incrementale, che lascia piccole
  compenetrazioni dove non converge del tutto, spostava i fili fino a 0,13 mm anche senza garza.
- La cucitura si esegue due volte: il tempo di una variante con garza raddoppia (a 0 strati no).
- "Filo in più" è la media per punto: le fermature da 0,5 mm la gonfiano.
- Nessuna torsione reale dei capi.
- Nessun parametro è calibrato su campioni reali.
- **Altezze, vette, onde.** Sul ritaglio da 40 mm del cartamodello (cotone 30), altezza del centro filo
  (media · massimo · massimo entro 0,5 mm dai fori) e punti con almeno un'onda (scende e risale di 0,03 mm):

  | | 0 garze | 2 garze, rilasciato | onde 0 garze · 2 garze rilasciato |
  |---|---|---|---|
  | filo tondo che sale sugli incroci (af440a9) | 0,36 · 1,50 · 1,50 | 0,53 · 1,93 · 1,93 | — |
  | imbuto su tutti i fori (90a5ee8) | 0,18 · 0,69 · 0,32 | 0,25 · 0,87 · 0,36 | 97 % · 84 % |
  | teso, giù solo al suo foro (ora) | 0,28 · 0,74 · 0,72 | 0,45 · 1,16 · 1,15 | 0 % · 5 % |

  L'imbuto su tutti i fori abbassava ogni filo vicino ai fori degli altri punti: più basso, ma pieno di
  onde. **Compenetrazioni** (un filo dentro l'altro per più del 40 %): chi entra nel suo foro passa dentro
  la pila che c'è attorno. Entro 0,2 mm da un foro 62 %, fra 0,2 e 0,4 mm 25 %, fra 0,4 e 0,8 mm 7 %,
  più lontano 0 % (0 garze); con 2 garze 55 %, 17 %, 1 %, 0 %.
- Stop diversi con strati di garza aggiunti fra uno e l'altro non ci sono ancora: cambiano tutto.

**Cucitura incrementale** (`cucitura.py`):
- **Solo su pezzetti.** Su ritagli oltre pochi millimetri di un disegno fitto ci mette minuti e molti punti
  si fermano al tetto di iterazioni (ritaglio da 6 mm del cartamodello: 17 s per le 6 varianti, ma da 8 mm
  oltre 10 minuti). L'interfaccia la offre solo su un quadrato da 6 mm, per confrontarla con la rigida.
- **La tensione non è risolta come forza.** Il contatto e la lunghezza sono vincoli di posizione (PBD):
  la tensione entra nel carico che schiaccia i fili (tensione × curvatura) e nel riposo del punto
  chiuso (`TENSIONE_CN` / EA), non in un vero bilancio di forze fra filo teso e pila di fili. Il filo in
  cucitura si tende verso la corda con un passo numerico (`RITIRO_PER_PASSATA`, 5 % per passata):
  cambiandolo cambia la velocità, non dove si ferma.
- La compattazione è **plastica e per nodo**: non torna indietro togliendo la garza; nel rilassamento
  finale la distanza di contatto di un nodo è d × la sua compattazione nella cucitura a 0 strati.
- L'ago è un cilindro verticale che agisce solo al momento del foro: non trascina il filo verso il
  basso, non buca la garza. Un nodo è infilzato se l'asse dell'ago cade entro `SOGLIA_INFILZATO` × r
  dal suo centro: il risultato dipende da come cadono i nodi (uno ogni 0,09 mm). Le **fermature
  d'uscita bucano l'ultimo punto appena posato** (tornano indietro di 0,5 mm sulla sua linea): per
  questo le zone A–D contano sempre 1 infilzato, e H 80 = 64 incroci + 16 fermature delle orizzontali.
- I fili con un capo nello stesso foro dell'ago non vengono né spinti né infilzati (sono già dentro).
- Nella posa un filo sale su un altro solo se i centri si sovrappongono col semiasse stretto: i vicini
  allargati dallo schiacciamento li sposta il contatto di lato (senza questa regola il satin si
  impilava di 0,1 mm a punto).
- **Risolutore.** Il rilassamento locale gira compilato con numba (`solutore.py`) e applica i vincoli uno
  alla volta (Gauss-Seidel): a parità di iterazioni è circa 4 volte più veloce del risolutore mediato
  in numpy (Jacobi), che resta disponibile con `SOLUTORE = "jacobi"`. **I due non arrivano allo stesso
  stato**: attrito e compattazione plastica dipendono dalla storia, quindi l'ordine con cui si
  applicano i vincoli conta (fermature della zona A: 0,16 contro 0,12 mm). Quale sia più vicino al
  ricamo vero lo diranno i campioni.
- **Convergenza.** Con 25 iterazioni fisse il raso fitto non si assestava e il risultato dipendeva dal
  conteggio (sul raso zig-zag di un cartamodello Oblique la pila arrivava a 3,5 mm di media). Ora ogni
  punto itera finché nessun nodo si sposta più di `TOLLERANZA_LOCALE_MM` per iterazione, misurato in
  media sulle ultime `FINESTRA_CONVERGENZA` iterazioni (un avanti e indietro fra contatti con attrito si
  annulla, una deriva no), almeno `ITER_LOCALI` e al più `ITER_LOCALI_MAX`; le metriche riportano le
  iterazioni usate e i punti fermati dal tetto. Sulle zone di calibrazione quasi tutti i punti si
  fermano da soli. **Nel raso molto fitto no**: lì resta uno scivolamento lento vero, e fra tetto 400 e
  tetto 3.000 l'altezza media cambia ancora di circa il 18 % (0,41 → 0,34 mm sul ritaglio da 22 mm del
  cartamodello).
- **Provato e scartato**, per chi riprende: sovra-rilassamento 1,5 e 1,8 e media parziale delle correzioni
  (non accelerano, spostano il risultato); blocco del tendifilo quando il punto smette di accorciarsi
  (il filo si congela lasco, le pile risalgono); attrito proporzionale anche alla compattazione (più
  punti fermi al tetto); un punto vecchio che non può mai salire e la spinta dell'ago (nessun effetto).
- **Velocità.** Le 6 varianti girano in parallelo (un processo ciascuna; `--processi 1` per una sola
  alla volta, stessi numeri) e il rilassamento lavora solo sull'intorno del punto. Tempi per le 6
  varianti: zone di calibrazione 4–13 s, centro di `pattern (1).dst` (350 punti) 11 s, ritaglio da 22 mm
  del cartamodello (687 punti, raso fitto) 1 min 54 s; col risolutore mediato erano 3 s–2 min 40 s e
  ~11 min. Numba compila al primo avvio (qualche secondo) e tiene la compilazione in `__pycache__`.

## Prossimi passi
1. Campioni 0/1/2 strati, stesso disegno e filo: macrofoto e sezione tagliata.
2. Sostituire i DA_MISURARE, confrontare altezza arco e copertura misurate/simulate.
3. Scorrimento del filo nei fori (filo continuo), poi fibre procedurali e rendering path tracing.

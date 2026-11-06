---
titolo: Dove stanno i parametri di un oggetto mandato da un tool (la descrizione dell'oggetto), e perché gli altri posti non vanno
tipo: codice
tool: []
data: 2026-11-03
---

Lorenzo, 2026-11-03: «non so come né dove salvarmi i parametri di creazione delle cose fatte con i tools». Un DST
o un SVG esportato porta i parametri (la busta), ma «Invia a Stilista» manda solo punti o forme. Ha scelto lui la
strada, dopo le prove qui sotto: **i parametri stanno dentro l'oggetto, nella sua descrizione**.

**Com'è fatto.** `DesignObject.Description` è una stringa che Stilista salva nell'`.emg3`. Il plugin ci scrive
`<nome> #rg1:<progetto>`: il progetto è JSON compresso (gzip) in base64, e il plugin non guarda dentro.
`«RG Tools · »` resta in testa, quindi la sentinella continua a riconoscere i suoi oggetti.

**Misurato** col plugin su copie di `native-sequence-test.emg3` (fra le prove del bridge, mai documenti di Lorenzo):

| prova | descrizione dell'oggetto | `NoteCommenti` del documento | Guid dell'oggetto |
|---|---|---|---|
| 1 MB, salvato e riaperto | identico (lunghezza e impronta) | identico | – |
| salva con nome, altra cartella, file rinominato | identico | identico | – |
| ricalcolo (`/ricalcola`) | identico | identico | – |
| copia dell'oggetto (`Clone`) | la copia la tiene | – | ne ha uno nuovo |
| copia e incolla in un altro documento (`_btObjCopy`, `_btObjPaste`), poi riaperto | identico, anche da 1 MB | non viaggiano | – |
| riapertura del file | identico | identico | **cambia a ogni apertura** |

Le altre candidate provate e scartate: le due `List<string>` di `BaseObject` e le due stringhe senza nome di
`EmbDesignHeader` **non si salvano**. `Descrizione`, `IDCliente` ed `EmbAuthor` dell'intestazione si salvano ma
stanno nel documento, come le note. Il Guid non può fare da chiave: un file accanto all'`.emg3` non avrebbe niente
di stabile a cui legarsi.

**Nessuna finestra la mostra o la cambia.** Una scansione del codice di `Emg2_IO`, `Stilista3.3.exe`, `GmiGUI` e
delle DLL `GMI*` (chi chiama `get_Description` e `set_Description`) trova solo `DesignObject.CopyTo` (la copia),
`cLockStitches.get_LockPaths`, `GMICamStitch.AzioneAutomatica.Execute` e la calibrazione del laser. Limite: i tipi
che fuori da Stilista non si caricano non si leggono. Nelle finestre «Modifica parametri» e «Cambia posizione nella
sequenza» non compare. Quindi non si può rinominare a mano, e il vecchio consiglio «per modificare i punti si
toglie RG Tools dalla descrizione» si può fare solo da codice.

**Selezionare e salvare oggetti con 1 MB di descrizione non rallenta niente di visibile.**

**Nel file gli oggetti sono compressi.** Ogni oggetto sta in un blocco zlib, quindi cercare il testo nei byte dell'`.emg3`
non lo trova nemmeno quando c'è: la prima ricerca dava «zero» su un file che i parametri li aveva. Si cerca aprendo
ogni blocco (`78 01`, `78 5E`, `78 9C`, `78 DA`). Le note del documento (`NoteCommenti`) invece non sono compresse.

**Togliere i parametri, e cosa resta** (Lorenzo, 2026-11-03: «quando scriviamo nel file emg se poi posso cancellare i
dati, magari non esportarli proprio»). Misurato con una marca di 20 kB in 2 oggetti di una copia, salvando con il
`Save()` vero di Stilista:

| dove | dopo aver tolto i parametri e salvato |
|---|---|
| l'`.emg3` | **nessuna traccia** |
| `C:\GMI\Stilista3.3\Backup\<nome>.emg3.Y….Bak` | **restano**: ogni salvataggio lascia lì la versione di prima (2 su 3 dei `.Bak` della prova li avevano) |
| `TMP\EmbSharedDisegnoLavagna.emg3`, il copia e incolla | restano finché non si copia altro; poi la lavagna di prima passa anche lei in un `.Bak` |
| un altro documento dove l'oggetto era stato incollato | restano: il comando vale per il documento aperto |

La cartella `Backup` non la pulisce nessuno: il 2026-11-03 aveva 322 file e 2,6 GB, dal 15 luglio. Non esce da sola, ma
ha il documento intero, con o senza parametri. In `TMP\UNDO` la marca non c'era, ma nella prova non si sono usati
punti di annullamento; non è una prova che lì non finiscano mai.

**Le strade messe a confronto per quella domanda**: un archivio in una cartella di Lorenzo, col solo codice
nell'oggetto, sarebbe stato l'unico modo in cui i dati non possono uscire per sbaglio, ma non viaggia su un altro PC;
un file accanto all'`.emg3` si perde appena si sposta il documento o si incolla l'oggetto. **Lorenzo ha scelto
l'oggetto col comando per togliere** (2026-11-03): i parametri restano nell'`.emg3` che si manda a qualcuno, finché
non si tolgono. Il comando è il pulsante «Togli i parametri da questo documento» nella scheda RG_LINK.

**Esportare dai tool senza dati.** I DST e gli SVG dei tool portavano già il progetto: parametri, ruoli, fili, misure
e il nome del file di partenza; Pattern a macchie, Generatore pattern e Rete testa speciale anche il cartamodello
intero (fino a 256 kB), Cannage e Pattern a zone le forme del disegno, Punto razza e Punto croce il contorno del pezzo,
Interlace l'immagine di riferimento. La spunta «Esporta senza dati» nella topbar li toglie da tutti i tool, nel punto
da cui passano tutti i salvataggi (`packages/ui/src/save.ts`): un DST perde il footer `RGPROJ01` (i byte sono identici
a uno scritto senza metadati) e un SVG i suoi `<metadata>`. Restano il disegno dell'SVG, che è il lavoro stesso, e i
primi 16 caratteri del nome nell'intestazione del DST. Un file così non si riapre nel tool.

**Trappole.**
- La descrizione ora può essere lunga: nel registro e nelle risposte va `SenzaParametri()`. Con un `«RG Tools · »`
  in testa la sentinella rimette i punti uguali al contorno, quindi non va scritto su oggetti che non sono a punti
  manuali: su un riempimento di prova è passato da 67 punti a 6.
- `EmbDesignData.Save()` chiede con un dialogo se sovrascrivere il file: da codice blocca il filo dell'interfaccia.
  `Serialize(Stream)` non chiede niente.
- Una copia dell'oggetto si porta dietro la descrizione: `Clona` passa anche i parametri del modello. Il ritorno li
  sovrascrive subito con `ImpostaDescrizione`.
- Un DST si apre in un altro processo: i parametri aspettano in `<file>.dst.rgp`, e la finestra che ha aperto quel
  DST li scrive nei suoi oggetti (`ParametriDelDstAperto`, dalla sentinella). Nel titolo di quella finestra il file si
  chiama già `<nome>.EMG3`, nella stessa cartella: cercando un titolo che finisce per `.dst` non si trova mai
  (visto nella prova su Stilista del 2026-11-04).

**Come si applica.** Lato tool è tutto in `packages/ui/src/stilista.ts`: a un tool basta dire `tool` (il suo id) e
`riapri(meta)` (la riapertura che ha già per il suo DST). `Invia a Stilista` prende la busta da `a.dst()`, e ci
aggiunge il cartamodello se la busta non ha il testo del disegno. `Prendi la selezione` riapre il progetto solo se
**tutti** gli oggetti selezionati ne hanno uno, ed è di questo tool (Lorenzo, 2026-11-03: «riapre tutto da solo»,
col bottone «Prendi solo i contorni» per usare l'oggetto come forma); con oggetti misti o di un altro tool prende i
contorni come prima, così si può ancora lavorare sopra a una base fatta da un altro tool. Oltre 1 MB (non provato
oltre) lascia giù il cartamodello, poi tutto, e lo dice. «Esporta senza dati» non tocca «Invia a Stilista»: `a.dst()`
non passa dal salvataggio.

**Provato sui tool** (2026-11-03) contro un finto plugin in memoria, non contro Stilista: per ognuno degli 11 si cambia un
parametro, si manda, si ricarica la pagina, si riapre l'oggetto e si manda di nuovo. Parametro tornato e ricamo uguale
in tutti, al suo posto dove si parte dalla selezione. Punto Striato e Interlace anche con la tavola generata (documento
nuovo). Il Punto croce riscrive `passes: 1` sui fili, un valore predefinito: 11 byte a filo in più nel footer, punti uguali.

**La catena intera su Stilista vero** (2026-11-04, Rete 45° su una copia, in una finestra a parte col plugin del ramo):
cambiati angolo e maglia, «Invia a Stilista» scrive 1.352 caratteri nell'oggetto; dopo ricalcolo, salvataggio, file
spostato e rinominato, finestra chiusa e riaperta, i parametri sono identici, e aprendo il tool sull'oggetto tornano
angolo 47 e maglia 2, con l'avviso e il bottone. «Prendi solo i contorni» riprende i contorni. Dopo
`/togli-parametri` e il salvataggio, nel file nuovo non c'è traccia; c'è solo nelle copie salvate prima.
Per provare senza chiudere le finestre degli altri: `Stilista3.3.exe --skipOpenCheck <file>` fa un processo nuovo, che
legge `pluginlist.txt` in quel momento; aperto normalmente il file finisce in una riserva, col plugin che ha già.

**Trappola dei tool che calcolano in differita** (Rete testa speciale, Pattern a macchie, Punto razza): il calcolo finisce
dopo la riapertura, ridisegna il pannello e riscrive la barra di stato. L'avviso «Riaperto» e il bottone stanno quindi
in una riga accanto a «Prendi la selezione», che si rimette da sola se il pannello si ridisegna (`notaRiapertura`).

**Da sapere.** Un oggetto nato da «Unisci» è nuovo e quasi certamente non ha parametri (non provato). Gli oggetti
mandati prima del 2026-11-03 non ne hanno. Se il DST esportato da Stilista porti i parametri **non è ancora misurato**:
«Salva con nome» offre solo `.emg3`. Vedi anche [`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md).

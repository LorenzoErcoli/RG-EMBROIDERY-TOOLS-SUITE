# Punto maglia: il cordoncino (lati + centro rialzato)

**2026-10-19/20.** Nato dal logo Dior a maglia (foto `apps/cross-stitch/.lab/dior/maglia.jpg`): Lorenzo vuole
ricamare tratti che sembrano maglia vera, con le V che girano morbide lungo le curve. Le prove sono in
`apps/cross-stitch/.lab/dior/` (non versionata); da qui nasce un **tool a parte** (non dentro Punto croce, che
lavora su una griglia di celle con le V dritte).

## Cosa NON funziona (provato e scartato)

- **Due colonne di V con una linea per gamba**: dal vero è una spiga, cioè catenella, non maglia («farà catenella e
  non maglia»).
- Gambe gonfiate a ventaglio, a raso (il filo va di traverso: chicchi, non anelli) o ad anello: «niente di questo
  mi sembra aiutarci».
- Riempire una forma con colonne di V che seguono da sole la direzione (linee di flusso): dove i tratti si toccano
  viene un groviglio. **I tratti si disegnano** (linea centrale), il tool li riempie.

## Il cordoncino (deciso da Lorenzo)

- **V larga 2,5 mm, alta 3,5 mm**, una riga ogni 2,5 mm. Logo proporzionato alla V (non la V al logo).
- Ogni tratto è un **centro rialzato** + **una mezza catena per lato**:
  - **lati**: una gamba sola per riga (mezza V), inclinata **al contrario** della gamba del centro accanto; parte un
    po' sotto il bordo del centro (0,4 mm) e va verso fuori. **2 passate** (va e torna), il passaggio fra una gamba e
    l'altra **dalla parte di dentro**, sotto il centro.
  - **centro**: cucito dopo i lati, sopra. Si allarga col tratto: **1 colonna** (V da 2,5), **1,5 colonne** (una
    colonna di V intere + una di mezze V che partono dal vertice della V verso fuori; da quel lato la mezza catena
    esterna si **inverte**, così le due mezze sono opposte), **2 colonne** (due V affiancate).
  - O: centro 1; D: centro 1,5. Decidere quando cambiare larghezza lungo un tratto è ancora da fare.
- **Ordine**: lato A in giù → ritorno su per il centro (sotto le punte, coperto dal centro) → lato B in giù →
  centro dal basso verso l'alto.
- **Passaggi del centro sul vertice**: ogni V entra e esce dalla punta, da una riga all'altra si va da punta a
  punta. Per tornare sulla punta ogni gamba si cuce un numero **pari** di volte: scelto **4** (provato anche 2).
  Nel centro da 2 si passa da una V all'altra lungo le due gambe interne (3 volte ciascuna).
  Limite noto: il passaggio punta→punta cade nell'apertura della V sotto e nessuna gamba lo copre del tutto
  (succede con qualunque verso, perché le righe si sovrappongono); lo nasconde solo il gonfiore delle 4 passate.
- **Mai spezzare**: ogni gamba di V (e di mezza V) è **un punto solo**, e anche ogni passaggio («le v non vanno
  spezzate», «non spezzare nemmeno i passaggi»). Nelle curve le gambe cambiano lunghezza (3,2–4,5 mm) ma restano
  intere.

## Campione

`CAMPIONE-MAGLIA-V25x35-CENTRO4.dst` (e `-CENTRO2`): dritti con centro 1 / 1,5 / 2 (40 mm) e cerchi con centro 1
(r 9) e 2 (r 11). Generatore: `.lab/dior/campione.ts` (con `buildDst` di `packages/core`), anteprima riletta dal
file: `.lab/dior/vedi-dst.ts`. Lorenzo tiene la versione **4 passate**; da cucire e guardare se il centro si alza.

## Il tool «Punto maglia» (2026-10-20)

`apps/punto-maglia/`, pagina *sviluppo*. Lorenzo ha scelto (domande del 2026-10-20, tutte sulla proposta consigliata):

- **Larghezza del centro: una per tratto** (1, 1,5 o 2). Se in un punto serve più largo si fanno due tratti; il cambio
  di larghezza lungo un tratto resta da decidere (vedi sopra).
- **Incroci: si tolgono le righe intere** (lati e centro) del tratto sotto, dove passa quello sopra. Il tratto sotto si
  cuce prima e salta il buco con **un passaggio solo**, che resta coperto. Sopra/sotto = **ordine della lista**: chi
  viene dopo sta sopra.
  - Quale riga si toglie (scelto nel codice, da guardare cucito): la riga va via se **il centro della riga** (a metà
    della V, sull'asse) cade nella striscia del tratto sopra (mezza larghezza = centro/2 − rientro + mezza V, più il
    *Margine negli incroci*, 0 di partenza). Provata prima «basta che base, metà o punta tocchino la striscia»: in un
    incrocio a croce con un centro 2 toglieva 4 righe e lasciava un passaggio di 12,5 mm, oltre il record DST (che lo
    spezzerebbe). Col centro della riga: 3 righe, passaggio 10 mm. Le righe accanto restano e infilano un pezzo sotto
    i lati del tratto sopra.
  - Un anello con righe tolte si apre dopo il primo buco e si cuce come un tratto aperto.
  - Se un passaggio sotto un incrocio supera 12,1 mm il tool lo dice (incroci molto obliqui); cosa fare lì non è deciso.
- **Un colore, ordine a lista**: un ago, i tratti nell'ordine della lista, un taglio fra un tratto e l'altro (come il
  campione).
- **Nome: «Punto maglia»** (id `punto-maglia`).

Il motore (`src/motore.ts`) è `campione.ts` portato su una linea qualsiasi: sui dritti e sui cerchi del campione dà gli
**stessi punti** del DST cucito (test con `fixtures/campione-4.json`, rigenerato da `.lab/dior/campione.ts`). Il tratto
aperto ha le righe al passo fisso dal capo, come il campione: l'ultimo pezzo più corto di un passo resta vuoto (al più
2,5 mm). La linea centrale è una Catmull-Rom centripeta per i punti di controllo.

Il capo/coda e il verso delle punte sono indipendenti: *Punte delle V* gira il tracciato (e quindi da che parte guardano
le V), *Si comincia da* cambia solo l'ordine di cucitura. Col centro 1,5 *Mezza colonna* dice da che parte sta la colonna
di mezze V (destra = come il campione, guardando verso le punte).

## Seconda richiesta (2026-10-20): forme precise, tratti che si stringono, linee spezzate, ritocchi a mano

Lorenzo: «delle forme precise come il cerchio … diminuire lo spessore dei tratti e quindi 1, 1,5, 2 colonne sulle
estremità, poter decidere da quando si restringe … linee spezzate senza curvatura, un po' come fa Illustrator … poter
modificare a mano i punti di ricamo».

- **Cerchio preciso**: un tratto `forma: 'cerchio'` (centro + punto d'inizio, che dà il raggio e dove comincia la
  cucitura). Sui cerchi del campione dà gli stessi punti del DST (entro 0,0001 mm): è la stessa geometria.
- **Si stringe ai capi** (`strettoCapo` / `strettoCoda`): colonne al capo e distanza da cui comincia. Fra il centro e il
  capo si passa a **mezza colonna per volta in tratti uguali** (2 → 1 su 10 mm: 5 mm a 1,5, 5 mm a 1). Scelto così nel
  codice, non deciso da Lorenzo: da guardare cucito. La riga prende le colonne dalla distanza del suo centro dal capo
  disegnato; ogni riga è una riga intera del suo tipo (1, 1,5 o 2), i passaggi punta→punta collegano i tipi diversi.
  Solo sui tratti aperti.
- **Punti ad angolo** (`angoli[]`): la linea si spezza nei punti ad angolo, ogni pezzo è una curva per i suoi punti, fra
  due angoli è dritta. Negli spigoli stretti le V del lato interno si accavallano: non ancora trattato.
- **Ritocchi a mano** (`ritocchi`): si sposta un **buco**, non una passata: tutte le volte che il filo ci passa si
  sposta insieme (le 4 passate restano sullo stesso buco). Valgono solo finché il cordoncino calcolato è lo stesso
  (firma: numero di punti, primo e ultimo); se cambia, il tool li ignora e lo dice, senza cancellarli.

## Il Dior disegnato da Lorenzo (2026-10-20, terza richiesta)

Sul suo primo disegno (logo largo 43 mm, `Downloads/punto-maglia.dst`): «la I finisse con più V ma passasse secco da
1 a 2 così che sembra ci sia la base», «la stanghina gira strana, vorrei fosse più pulita», «il pallino della i … c'è
troppo filo e punti in poco spazio: alleggerirlo e omogeneizzare i bordi», «non ho idea di come vadano i passaggi da una
lettera all'altra e di inizio e fine».

- **Stretto secco** (`secco`): negli ultimi mm tutto alla larghezza del capo, senza la riga da 1,5.
- **Spigoli a pezzi**: con i punti ad angolo ogni pezzo fra due spigoli ha le sue righe, al passo, **centrate nel
  pezzo**; nessuna V a cavallo di uno spigolo (prima una riga che scavalcava l'angolo aveva base e punta girate
  diversamente: era la stanghetta «strana»). Nello spigolo le direzioni non si mediano più. Un pezzo più corto di una V
  resta senza righe.
- **Cerchio piccolo**: la mezza catena dalla parte del centro si toglie in automatico quando fra le sue punte e il
  centro resta meno di mezza V (1,75 mm): il pallino della «i» (raggio 2) la perde, la «o» (raggio 5,3) la tiene. Con un
  lato solo si cuce quel lato e poi subito il centro (niente ritorno). Le **passate del centro** si scelgono anche per
  tratto (2 = più leggero). Soglia scelta nel codice, da guardare cucita.
- **L'ordine sull'anteprima**: numero e inizio di ogni tratto, fine, salto col taglio al successivo. Fra le lettere il
  filo si taglia sempre (nessun collegamento): da decidere se e quando collegarle con un passaggio nascosto.
- Nel file il **Margine negli incroci** era −3: la «i» sopra la barra della D non toglieva righe e i cordoncini si
  accavallavano. A 0 l'incrocio è pulito, ma il margine vale per tutti gli incroci: da decidere con Lorenzo se serve
  per tratto.

## Togliere punti, scegliere inizio e fine (2026-10-20, quarta richiesta)

Lorenzo: «posso eliminare dei punti se voglio, e anche decidere inizio e fine». Fatto sul ramo `punto-maglia`.

- **Punti della linea**: «Elimina il punto scelto» (o Canc). **Punti di ricamo**: un buco si toglie (`ritocchi.tolti`)
  con tutte le passate che ci passano; due punti di fila sullo stesso buco diventano uno (niente punti fermi).
- **Inizio**: capo o coda (c'era); un tratto chiuso a mano comincia dal punto scelto («Comincia da questo punto»: i
  punti ruotano); il cerchio dal quadratino.
- **Fine** (`fine: 'altroCapo'`): l'ordine del campione finisce dove comincia (il centro sale). Per uscire dall'altro
  capo: **lato A in giù, lato B in su, centro in giù**, senza il ritorno su per il centro; il passaggio da un lato
  all'altro resta in fondo, sotto il centro. Le gambe sono le stesse, cambia solo l'ordine; ma non è cucito: da provare
  (se il centro, cucito in giù, copre i lati come quello in su del campione).

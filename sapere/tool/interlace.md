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

## La sfumatura dai toni (2026-11-04)

Su un cuscino di prova, partendo da un'immagine a tinte chiare, Lorenzo ha detto: *«Devo costruire una
sfumatura a intreccio di questa immagine. Come vedi gli agglomerati non sono omogenei.»* Fra tre strade
(stesse macchie con la stessa fittezza, macchie regolari senza immagine, sfumatura dai toni) **ha scelto
la sfumatura dai toni** e dopo aver visto le prove ha detto: *«Va bene, densità 1,5»*.

**Com'è fatta** (`toneBlend` + `toneSoftnessMm`, solo con agglomerati e immagine; spenta di serie):

- Il tono si legge come **miscela dei due colori che lo rifanno meglio**, non come il colore più vicino.
  Con `1/d⁴` sul colore più vicino i passaggi restavano netti, perché il tono era quasi sempre "tutto di
  uno"; provata e scartata.
- Il **filo cucito dopo copre quello di prima**: a queste densità la proporzione del filo non è quella che
  si vede. Si parte dall'ultimo colore, gli si dà il filo che serve a coprire la sua quota, e il primo
  prende il resto: così il filo totale è pari. Il conto vale per un filo da 0,4 mm (`TONE_COVER`).
- **I divieti valgono ancora**, ma il filo vietato sfuma avvicinandosi alla zona vietata (`TONE_FADE` ×
  morbidezza). Provata senza divieti: il passaggio è più morbido, ma il filo scuro attraversa il chiaro
  in linee sciolte che si vedono sopra a tutto.
- **Dove un colore ha quota quasi nulla la cella è solo di passaggio**: non la deve coprire, ma non è un
  muro. Coprirle tutte a 1 gonfiava il filo totale dove passano più colori (8,1 contro 5,7 mm/mm²).
- **Una cella tagliata dal bordo chiede meno filo**, in proporzione alla sua parte ricamabile: senza, le
  strisce strette e le punte erano le zone più fitte.
- **Il filo non gira più a vuoto** (solo con la sfumatura): prima, davanti a celle che non raggiungeva,
  faceva 300 punti prima di staccare, e nelle rigenerazioni misurate erano fino al 41% del filo di un
  colore. Ora si arrende dopo 40, e una cella che ha già preso una passata la lascia lì senza staccare.

**Misurato sul suo DST** (32,4 m, densità 1,5) **contro la stessa prova con la sfumatura** (14,1 m), filo
per mm² su 3 mm dentro la sagoma:

| | Prima | Dopo |
|---|---|---|
| Più fitto / più rado (p95/p5) | 3,4 | 1,9 |
| Coefficiente di variazione del totale | 0,33 | 0,20 |
| Filo in zona chiara / media / scura | 10,7 / 13,7 / 15,6 | 5,3 / 6,1 / 6,0 |
| Stacchi | 15 | 6 |
| Filo su 5 varianti | 25,7–32,4 m (variante 3: 32,4 nel suo DST) | 13,9–14,3 m |

Il filo è calato perché non c'è più quello sprecato: per la fittezza media di prima serve densità 0,8
(35,0 m, 14,4 mm/mm²), ma lì i passaggi si leggono meno. **Lorenzo ha scelto 1,5.**

**Non verificato:** il risultato è stato giudicato su una simulazione col filo da 0,4 mm, non su una
prova cucita. Il coefficiente qui è misurato sfocando il filo di 3 mm, **non su celle da 3 mm** come
quello della nota sui [passaggi brevi](../decisioni/interlace-passaggi-brevi.md): i due numeri non si
confrontano.

**Il modo a zone non è cambiato:** a sfumatura spenta la cucitura è identica byte per byte su 6 casi, e
il difetto dei 300 punti resta lì, perché correggerlo cambierebbe i lavori già fatti.

**La voce C4 (densità per zona) resta aperta:** qui il filo totale è pari, mentre C4 chiede densità diverse
per regione.

## Più fitto intorno alle aree vuote (2026-11-19)

Lorenzo: *«la costruzione di aglomerati intorno alle aree vuote. vorrei avere la possibilità di decidere la densità intorno alle aree vuote e anche per quanto estendere la sfumatura che da molto intenso torna al noramle. è una cosa che si attiva, normalmente tutta la densità è uguale, ma posso avere questo controllo.»* Alla domanda su quali aree vuote ha risposto **i buchi della forma** (non il bordo
esterno, non lo sfondo senza ricamo), e ha scelto di dire l'intensità in **volte la densità**.

**Com'è fatta** (`voidDensityBoost`, `voidDensityFactor`, `voidDensityFadeMm`; spenta di serie): l'obiettivo di
ogni cella si moltiplica per un fattore che vale `voidDensityFactor` sul bordo del buco e scende a 1 a
`voidDensityFadeMm` di distanza, con una curva morbida senza scalino. Vale in tutti i modi (mélange, agglomerati,
sfumatura dai toni). La distanza si misura dai soli buchi. Il fattore si ferma a 5.

**Misurato** su un rettangolo 140×90 con un buco tondo di raggio 10, un colore, punto 2–4, densità 1,5. I valori
sono il filo vicino al buco diviso per quello lontano:

| | 0–2 mm | 2–4 mm | 4–6 mm | 6–8 mm | oltre 8 mm |
|---|---|---|---|---|---|
| Spento | 1,50 | 1,50 | 1,09 | 1,08 | ~1 |
| Fattore 2, 8 mm | 2,34 | 2,04 | 1,24 | 1,05 | ~1 |
| Fattore 3, 8 mm | 2,96 | 2,40 | 1,59 | 1,19 | ~1 |
| Fattore 3, 15 mm | 2,66 | 2,58 | 1,93 | 1,70 | 1,38 a 8–10, 1,15 a 10–12, ~1 da 12 mm |

**Da sapere:** già spento il filo si addensa un po' attorno al buco (×1,5 nei primi 4 mm), perché ci gira
attorno. Il filo totale cresce poco (16,0 → 16,2–16,7 m), perché la corona attorno al buco è piccola rispetto al
pezzo, e resta un tratto solo. **Non visto da Lorenzo** al momento di questa nota.

## Le venature della pelle sopra Interlace (2026-11-19)

Lorenzo: *«vorrei simulare attraverso l'interance una grafica delle venature della pelle. per questo vorrei che iniziassimo a fare un po' di riceerca insieme»* La ricerca, con le sue scelte a ogni passo, è andata così:

1. Ha scelto il tipo **crepe / craquelé** e la strada **«il filo segue le venature»**. Poi ha portato una foto di pelle
   color cuoio con venature chiare (misurato: fondo circa `#874325`, venature circa `#B46F4E`, quindi più chiare).
2. *«bastano le venature lunghe, il fondo resta mélange»*.
3. Dopo una ricerca più ampia: *«il sotto lascialo stare, faremo si un interace normale. ma sopra le venature devono essere fatte di filo, con imbastiture andata e ritorno dove lo vogliamo più spesso, solo andata sul più fimo»*.
4. Sui salti ha scelto **«Un giro solo, raddoppia»**: dove il filo dovrebbe staccare, ripassa un tratto.
5. *«rifalle che attraversano. Rendili anche più naturali se riesci»*; *«più venature e falle fermare prima del bordo»*;
   poi, visto il risultato, *«l'ultimo un po' meno naturale di prima»*, e fra quattro disegni ha scelto **la A**,
   **«A così, fino al bordo»**.

**Cosa si è imparato** (la ricerca intera, coi suoi schizzi, è nelle note della chat, fuori dal repo):

- Nessuno ricama l'aspetto della pelle con le venature: in rete c'è solo il ricamo *su* pelle. La cosa più vicina è il
  ricamo cinese a punti casuali di Changzhou, cioè la famiglia di Interlace.
- Nella pelle "pull-up" le venature chiare sono **pieghe**: lì olio e cera si spostano e il colore schiarisce. Nascono a
  famiglie quasi parallele. Una venatura vera **non è una curva liscia**: è spezzata.
- **Scartate:** la rete a celle chiuse (*«più venature rami che pelle»*, per gli alberi); le fasce riempite di filo chiaro
  (il filo si ammucchia, 148 salti); la foto usata come immagine della sfumatura (rifà la patina, ma le venature non si
  vedono: l'immagine è ridotta a 256 px); fini quasi parallele ai fasci (non trovano incroci e spariscono).
- **I salti:** un filo a passata singola che finisce nel vuoto lascia un'estremità libera, cioè un nodo dispari, e lì
  deve tornare indietro. Attraversare da solo non basta: i ripassi si mandano sulle spesse (le fini costano 25 volte).

**Com'è fatta** (`venature.ts`, spenta di serie; `veinsOn`, `veinsColor`, `veinsBundles`, `veinsThin`,
`veinsAngleDeg`, `veinsSeed`). È la A portata nel motore, con le sue misure:

- fasci di 2-3 **spesse a fuso**: il ritorno corre a 0,35 mm dall'andata nel mezzo e la raggiunge alle punte, a punti
  da 2,2-3,6 mm. Ogni quinto fascio è coricato di 66°;
- **fini** a filo singolo, punti da 1,8-3,2 mm: partono da una vena (70% da una spessa), ne attraversano 0-2 e si
  fermano sulla vena dopo almeno 8 mm, oppure arrivano al bordo;
- **ponti**: se la rete resta in più pezzi (pochi fasci su un pezzo grande, o nessuna fine) una fine li collega,
  così il giro resta unico. Questo nella A non c'era: l'ho aggiunto perché sul cartamodello demo la rete si spezzava;
- **fusione**: i nodi a meno di 1 mm si uniscono, per il punto minimo (sono gli incroci doppi dove una fine taglia un fuso);
- **un giro solo**: i nodi dispari si appaiano col cammino più economico e quel cammino si ripassa.

**Misurato** sul rettangolo 120×80 (variante 8): un tratto, 1734 punti, 4,31 m, nessun punto sotto 1 mm, punto più
lungo 5,1 mm, fini 1,09 m di cui ripassate 0,30 m. Nel giro completo con Interlace sotto: da 2 a 3 stop, +4,3 m.
**Spente, la cucitura è identica byte per byte** a prima. **Non visto cucito.**

## Provato su un pezzo vero con 201 fori (2026-11-23)

Lorenzo, provando su un pezzo di 309×219 mm con 201 fori (un pezzo di prova preso da Stilista): *«L'obiettivo è avere 3 fili che si intrecciano con una copertura media, ma rimane un problema: la densità ora tocca singolarmente ogni filo, mai nel complesso. In più si creano degli agglomerati strani anche quando non richiesti. cioè io vorrei tutto normale e poi agglomerati solo intorno ai fori. La parte delle venature poi non funziona»*.
(Le sue parole, corrette solo negli errori di battitura.) Misurato su quel pezzo, tre marroni:

- **La densità era per filo.** Ora c'è **«La densità è di tutti i fili insieme»** (`densityTotal`, spenta di
  serie). Il filo di una passata **non** scende con l'inverso della distanza: un colore, punti 6-15 mm, da 1 a 6 mm
  fa 480 → 278 → 148 → 78 → 37,5 → 22,4 m (scende con la distanza alla 1,8); con punti 2-5 mm, alla 1,5. Allora ogni
  passata va a N^(1/1,7) volte la distanza: con 3 colori 1,9 volte. Densità 1,5 del totale: 258 m contro 278 di un
  filo solo.
- **Gli agglomerati strani** vengono dai **vortici** del motore (il campo di flusso che curva la camminata): a
  densità alta si vedono come nuvole a spirale. Ora c'è **«Vortici del fondo»** (`flowStrength`, 100 = come sempre,
  0 = fondo senza vortici).
- **Gli agglomerati intorno ai fori con i punti lunghi non restano lì.** Con i punti di serie (6-15 mm), più fitto
  ×3 su 4 mm: vicino ai fori 5,16, lontano 4,26 (filo per mm², fondo), e il lontano era 2,79 senza: **cresce tutto il
  pezzo**, perché un punto di 6-15 mm che parte da un foro finisce lontano. Con **punti 2-5 mm** restano intorno ai fori:
  vicino 3,34, lontano 1,55 (era 1,48). **Da dire a Lorenzo; non cambiato nel motore.**
- **Le venature si fermavano al primo foro**: 2,8 m su tutto il pezzo, e i ponti attraversavano il pezzo dritti. Ora
  davanti a un foro girano (fino a 72°, prima da un lato poi dall'altro) e proseguono; si fermano solo al bordo. Sul
  pezzo più lungo della A si allungano in proporzione (la A era 120×80). Dopo: 8,7 m, un tratto solo.
- *«perchè le venature sono solo a destra? Serve un algoritmo in grado di crearle su tutta la superficie»*. Gli
  inizi dei fasci erano pescati a caso e i coricati partivano sempre a destra, come nella A. Prima prova: la
  larghezza divisa in fette, un fascio per fetta, fasci e fini in proporzione → 13 strisce quasi parallele dall'alto
  in basso. Lorenzo: *«a me ancora così non mi sembra troppa pelle magari mi sbaglio»*: nella A i fasci si incrociano
  in direzioni diverse. Seconda prova, quella tenuta: il pezzo si divide in **riquadri della misura della A** (120 di
  traverso, 80 lungo le vene), ognuno con la sua composizione A girata un po' (16° di scarto tipo); i fasci sconfinano
  e si incrociano. Fasci e fini sono il numero **per riquadro**; con un riquadro solo è la A. Sul suo pezzo (3×3
  riquadri): circa 33 m, un tratto, nelle varianti 8, 3 e 21. Lorenzo: *«sì meglio»*.

## L'anello intorno ai fori (2026-11-23)

Lorenzo: *«quando si attiva la densità è importante che intorno ai fori deve passare bene il filo per evidenziare il foro»*. Visto da vicino, prima il filo si addensava ma nessun punto seguiva il bordo: arrivava a ~1 mm e
girava via, e il bordo del foro restava frastagliato. Fra le strade (anello, fitto fino al bordo, tutte e due) ha
scelto **«un anello che lo contorna»**.

**Com'è fatto:** con «più fitto intorno alle aree vuote» acceso, quando il filo di un colore passa vicino a un foro
che non ha ancora contornato, ci arriva con un punto, gli gira intorno a ridosso del bordo (0,15 mm oltre il
distacco) e riparte nel fondo da lì: niente stacchi. L'anello è un poligono coi lati tangenti al bordo, tanti lati
quanti ne stanno col punto minimo (almeno 3); ogni colore lo ruota un po'.

**Misurato** sul pezzo con 201 fori, tre marroni, densità 1,5 di tutti i fili insieme, più fitto ×3 su 4 mm:

- punti 2-5 mm: 199-200 fori su 201 hanno l'anello, per ogni colore (almeno 7 punti entro 1,4 mm dal bordo;
  senza anelli 129-138). I tratti non aumentano, anzi: semi 1, 2, 5 → 3, 3, 3 tratti (senza anelli 4, 3, 8).
- punti 6-15 mm: gli anelli sono quadrati o triangoli (col punto minimo di 6 mm intorno a un foro di 5 mm non ci
  stanno più lati) e il filo fa 1-2 salti in più (semi 1, 2, 5 → 6, 5, 4 tratti; senza 4, 4, 3). Questo limite è
  sparito col cambio qui sotto (3 tratti).

## Lo stesso agglomerato per ogni foro (2026-11-23)

Lorenzo, provando in macchina: *«è strano come gli agglomerati intorno alle aree vuote non sono uguali e a volte ci sono altre volte per niente»*. **Misurato** (filo nella fascia 0-3 mm da ogni foro diviso per il filo
lontano, sui 192 fori lontani dal bordo): coi punti 2-5 mm andava da 1,56 a 2,85 (5°-95° percentile), coi punti
6-15 mm da 1,09 a 2,40 e 37 fori sotto 1,3. **Perché:** il più fitto si chiedeva alle celle della copertura (~3 mm
con la densità di tutti i fili insieme) valutando la sfumatura al centro della cella; con una sfumatura di 4 mm
contava come la griglia cadeva sul foro.

**Ora:** le celle non c'entrano più. Ogni foro riceve **la stessa dose** di filo in più, posata quando il filo gli
passa accanto, insieme all'anello: prima l'anello intero, poi punti che girano intorno al foro un passo alla volta
con l'estremo a una distanza dal bordo pescata con la sfumatura, poi il fondo riprende (con l'anello dopo
l'agglomerato, 9 anelli su 72 saltavano: dal punto dove l'agglomerato finiva nessun vertice era a un punto di
distanza). Se il filo passa vicino a un foro senza poterlo agganciare, per qualche passo punta verso di lui. La dose = (volte − 1) × filo al mm² del fondo × area pesata
della sfumatura; il filo al mm² del fondo si misura facendo la passata una volta senza i fori in più. I punti in
più non contano nella copertura del fondo, così il fondo resta uniforme.

**Misurato dopo** (stessi parametri): punti 2-5 mm da 2,79 a 3,71, nessun foro sotto 1,3, 3 tratti; punti 6-15 mm
da 1,47 a 2,81, 3 tratti, e il fitto non si spande più su tutto il pezzo (filo da 399 a 281 m).

## Venature senza punti battuti (2026-11-23)

Lorenzo: *«per le venature, evitiamo il ritorno sullo stesso punto per non creare punti battuti evidenti»*. **Misurato:** prima circa **metà dei punti** delle venature cadeva a meno di 0,3 mm da un buco già
fatto (120×80: 697 su 1396; 309×219: ~6000 su ~12.600). Il grosso veniva dal fuso: il ritorno stava sugli stessi
indici dell'andata a 0,35 mm, si cuciva contro di lei, e l'unione degli incroci sotto 1 mm lo fondeva con l'andata.
Il resto: gli incroci attraversati più volte dal giro e i tratti ripassati per non staccare.

**Ora:** ogni punto del ritorno sta a metà fra due punti dell'andata, scostato di lato, e il ritorno non si cuce
contro la sua andata; poi, nell'ordine di cucitura, ogni punto che cade a meno di 0,3 mm da un buco già fatto si
sposta di lato (prima di traverso alla vena, poi tutt'intorno fino a 1,4 mm), dentro la sagoma e senza punti sotto
1 mm. **Dopo: 0 punti battuti** in tutte le prove (3 varianti, 120×80 e 309×219), nessun punto sotto 1 mm, un tratto.

Visto il risultato, Lorenzo: *«devi proprio sfalsarlo, così sono ancora in linea. il problema non era spostarlo e
metterlo vicino, ma è che doveva soprattutto orizzontalmente non essere allo stesso livello, doveva avere tipo una
fase»*. **Misurato:** spostati di traverso, il **40%** dei punti restava affiancato a un altro (a meno di 0,9 mm e
a meno di 0,4 mm lungo la vena: allo stesso livello). **Ora** il punto si sposta prima LUNGO la vena, avanti o
indietro di 0,45-1,2 mm e appena di lato (0,2 mm), così cade fra due buchi dell'altra passata; un posto si accetta
solo se non è né battuto né affiancato; se non ce n'è (vene affollate) almeno fuori dai buchi già fatti. **Dopo:**
affiancati 3-6,5% (sono vene diverse che corrono vicine), 0 battuti, nessun punto sotto 1 mm, un tratto.

## Prima i fori, poi il resto (2026-11-24)

Lorenzo: *«integriamo una nuova funzione, se sono attive le aree vuote e le densità il filo deve prima andare a fare i punti intorno alle aree vuote per fermare il materiale in quei punti e poi riprendere con tutto il resto. l'ingresso però sempre dai lati»*.

**Ora:** casella «Prima i fori, poi il resto», sotto «più fitto intorno alle aree vuote» (vale solo con quella accesa;
spenta di serie, e spenta il ricamo non cambia). Accesa, ogni filo entra dal **bordo esterno**, nel punto più vicino
a uno dei fori più vicini al bordo (ogni colore uno diverso dei primi tre, così le code non cadono una sull'altra);
poi va **di foro in foro**, sempre al più vicino non ancora fatto, e a ognuno fa anello e agglomerato. Il tragitto
fra un foro e l'altro è fondo cucito come sempre, quindi niente salti. Finiti i fori, il filo cuce il resto.

**Misurato sul pezzo di prova** (201 fori, 3 colori, densità 1,5 del totale, 3 volte, 4 mm):
- punti 6-15 mm: ingresso a 0,8 mm dal bordo (spento: 1,4 / 66 / 73 mm); i fori finiscono intorno al
  **21-22%** della cucitura di ogni colore; un tratto per colore; filo 289 m contro 279 (+3,6%);
- punti 2-5 mm: ingresso a 2,7 mm dal bordo; i fori finiscono intorno al **38-40%**, perché coi punti corti il
  tragitto fra i fori è più lungo in punti; un tratto per colore; filo uguale (149 m);
- anelli saltati perché cadono dove il tetto dei buchi d'ago è già pieno per gli altri colori: 12 contro 20 da
  spento (punti 2-5), 0 contro 1 (punti 6-15).

## Nessun anello saltato (2026-11-24)

Lorenzo, sugli anelli saltati (riportato dalla chat madre): *«C'è modo di gestire meglio questa cosa dei fori coperti? In automatico in base ai punti?»*. Un anello si saltava quando un suo punto cadeva
in un mm² dove gli altri colori avevano già messo tutti i buchi d'ago del tetto.

**Ora, in automatico:**
1. prima di cucire si calcolano gli anelli di **tutti** i colori e i loro punti si tengono da parte nel tetto dei buchi
   d'ago. Quanti posti dipende da sé dalla lunghezza dei punti: punti corti, anelli con più punti, più posti;
2. col **tetto automatico** quei posti sono **in più** del tetto, solo per gli anelli: il fondo non perde niente (la
   prima prova li toglieva al fondo e l'ultimo colore restava murato: 3 salti in più su una prova). Col tetto
   **scritto a mano** il tetto resta quello e i posti stanno dentro (al più metà);
3. se un punto dell'anello cade comunque in un mm² pieno, si sposta di poco in fuori o di lato (fino a 1,4 mm) in un
   mm² libero, coi lati sempre fra punto minimo e massimo. L'anello si salta solo se nessuno spostamento va.

**Misurato sul pezzo di prova** (201 fori, 3 colori, densità 1,5 del totale, 3 volte, 4 mm; 4 semi, con e senza
«prima i fori»):
- anelli saltati, **punti 2-5 mm**: prima 12-20 per prova, **ora 0**; **punti 6-15 mm**: prima 0-1, **ora 0**;
- tratti: 51 in tutto sulle 16 prove, prima 52; filo coi punti lunghi in media uguale (285 m, da un seme all'altro
  fra -6% e +4%), coi corti +0,8% (da 149 a 150 m);
- il prezzo: coi punti corti vicino ai fori qualche mm² ha più buchi d'ago (massimo 9 invece di 7; mm² oltre 6
  buchi: 71 invece di 6, su tutto il pezzo). Col tetto scritto a mano il massimo resta quello di prima.

Cosa resta da fare sta in `STATO.md` (C4 densità per zona, C5 vuoto dello stesso colore, C6 modello
densità unificato, A5 i nomi dei parametri "movimento").

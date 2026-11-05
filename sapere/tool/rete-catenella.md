---
titolo: Rete a catenella — un contorno riempito a moduli che si attaccano, con basi, passaggi sotto e catenelle psil
tipo: tool
tool: [rete-catenella]
data: 2026-11-03
---

**Stato: tool in prova, in «In sviluppo». Non è ancora stato cucito su macchina.** Codice in `apps/rete-catenella/`. Il riferimento:
[`../riferimenti/rete-a-moduli.md`](../riferimenti/rete-a-moduli.md).

## Da dove nasce
Lorenzo, 2026-11-03: *«un tool in cui come al solito a partire da un contorno viene riempito, mantenendo gli stessi identici criteri di creazione, ma parametrizzando tutto.
Passaggi sotto, tipo di punto psil ecc. Ovviamente deve lavorare come ora a moduli ed essere in grado di attaccarsi reciprocamente. Una versione in realtà dovrebbe avere il modulo
esattamente come questo»*.

## Come è fatto il riferimento (misurato)
- **I moduli sono copie esatte.** Nella stessa colonna, passo 49,41 mm in verticale, scarto 0,000 mm. Le colonne si alternano in due varianti: le colonne dell'ago 10 e dell'ago 12 sono uguali a passo
  200,66 mm (salvo un oggetto, scarto 0,000 mm); quelle dell'ago 11 stanno a 100,44 mm e differiscono (2 oggetti diversi, scarto fino a 2,767 mm sulle catenelle, 2,163 mm sulle basi).
- **Ingombro di un modulo:** 116,2 × 66,2 mm. Si sovrappone a 8 vicini. Dentro il modulo il disegno si ripete a circa 50,1 mm, ma non esattamente: coincide per l'81%.
- **Come si attaccano.** Dei 164 capi di catenella di un modulo centrale, 103 stanno su una linea del modulo, 44 **solo su una linea di un vicino**, 17 a più di 0,5 mm da ogni linea. I moduli si incastrano coi capi
  delle linee; le linee che coincidono coi vicini sono solo il 3%.
- **Sequenza di un modulo:** 3 passate di base su ogni metà: sinistra andata, ritorno, andata; destra andata, ritorno, andata, e quest'ultima da lì porta all'uscita. Poi 82 catenelle (da 5,3 a 70,5 mm, mediana 23,5) e 54 passaggi, quasi tutti sotto una catenella che
  arriva dopo; un running d'uscita verso il modulo dopo.
- **Catenella:** triangolo doppio, in questo file passo circa 1,70 mm e lati circa 2,58 mm, larghezza 1,30 mm.

## Le decisioni di Lorenzo
- **Col modulo esatto i passi di colonne e righe sono fissi** (2026-11-03, *«il passo colonne e righe non dovrebbe essere fisso?»*): sono loro a far combaciare gli incastri. Si può spostare solo la griglia intera.

- **Il modulo del cliente resta fuori dal repo** (il repo è pubblico): il tool lo carica da un file `.json` (`rete-modulo-1`) che si fa con `strumenti-sviluppo/stilista-prove/esporta-modulo.mjs`. Nel repo c'è solo un modulo di esempio inventato. Un DST o un SVG esportato porta dentro i parametri e il nome del modulo, non la sua geometria.
- **Il ricamo è continuo** (2026-11-03, *«deve essere continuo»*, *«senza salti o passaggi»*): dentro un modulo il filo non si taglia. Dove il taglio sul contorno lascia un movimento lungo, il filo gira su una corsia fuori dal bordo (*«puoi fare anche dei passaggi più esterni al bordo effettivo»*).
- **Un passo solo per tutte le colonne** (2026-11-03, *«i 0,22 mm non sono voluti»*): nel file le colonne alternano 100,44 e 100,218 mm. Il tool usa la metà della ripetizione A → A, che nel file è esatta: 100,329 mm. Il valore l'ho scelto io, perché tiene la larghezza del file e sposta le colonne B di 0,11 mm; il modulo non indica un passo migliore: da 100,0 a 100,7 mm i capi liberi che cadono sui vicini non cambiano in modo netto.
- **I pezzi di modulo sul bordo: 22%** (2026-11-03, *«lascia 22%»*).
- **Le corsie vanno bene anche a 18 mm dal bordo** (2026-11-03, *«corsie ok»*).
- **Ogni modulo finisce con un'uscita** (2026-11-03, *«alla fine di ogni modulo c'è un'impuntura che esce passando sotto quella successiva, in modo che il cambio ago avviene fuori»*). Corre sulle linee dei moduli che arrivano dopo, poi oltre il contorno. Di serie 20 mm oltre: valore mio, sul file i capi stanno da 14 a 114 mm oltre il bordo.
- **Filo continuo, a scelta** (2026-11-03, prima, *«i moduli sono tutti rasafilo non sono collegati non va bene»*): con la spunta il filo passa al modulo dopo lungo le linee, senza cambi ago, a serpentina.
- **La scelta psil vero o disegnato** (2026-11-03, *«sullo psil dammi la possibilità di scegliere se psil o no»*). Acceso: in Stilista oggetti psil copiati da una catenella del documento aperto. Spento: i punti del tool. Il DST ha sempre i punti del tool.
- **La trama si infittisce dal tool** (2026-11-03, *«mi devo poter infittire le trame»*). Stesso metodo della versione C su una copia in Stilista ([`../riferimenti/rete-a-moduli.md`](../riferimenti/rete-a-moduli.md)), con la soglia sull'area della maglia. Lorenzo non ha dato un valore: i 20 mm² di serie sono una scelta mia.
- **I moduli stanno in un elenco su ogni PC, con uno di serie** (2026-11-04, *«il modulo che stiamo mettendo possiamo inserirlo come def? e casomai se uno ne crea un altro lo mette»*; messo davanti alla scelta fra elenco nel browser e modulo nel repo pubblico, Lorenzo ha scelto l'elenco). Restano nel browser, non nel repo: su un altro PC o browser si caricano una volta dal file. Che il primo modulo aggiunto diventi quello di serie è una scelta mia.

- **I pezzi sul bordo si attaccano ai moduli vicini** (2026-11-04, *«in maniera automatica si aggiungano pezzi ai moduli dove vicino ci sono i bordi e c'è del bianco»*). Un pezzo sotto la soglia si cuce col modulo che tocca di più, senza cambi ago in più. Si lavora da sinistra a destra (2026-11-05, *«prima modulo e poi area infittita a destra, mentre corretto come è ora a sinistra»*): a sinistra del modulo si cuce prima, e il filo arriva sulle linee del modulo non ancora cucite; a destra si cuce dopo, e lì il filo passa sulle linee già cucite. Dentro il pezzo: prima le basi, poi le catenelle, ognuna la più vicina; i passaggi del modulo non servono più. Che sia acceso di serie è una scelta mia, come i 30 mm di catenella sotto i quali un pezzo non si cuce. Spento, il bordo è quello del file.

- **Le aree da infittire arrivano da Stilista con un laser colorato** (2026-11-04, *«come al solito farei che da stilista arriva un laser colorato e che quindi identifica un area specifica»*). Il colore del contorno più grande è il cartamodello; gli altri colori tutti dentro di lui sono aree, i fori dei riempimenti no; si corregge dal menu. Ogni colore ha la sua soglia: l'ha proposto la chat e Lorenzo non ha obiettato. Si divide fino alla soglia più bassa, e una linea vale in un'area se la maglia che divide era più grande della soglia di quell'area. Che le aree accendano da sole l'infittimento è una scelta mia.

- **La griglia si allinea al lato superiore dritto** (2026-11-04, *«dove possibile, soprattutto nei contorni che hanno un lato superiore orizzontale preciso, il modulo fosse preciso a quello così che non ci sono passaggi in quel punto»*). Il tool prova le posizioni in verticale su una striscia sotto il lato e tiene quella con meno filo sopra il lato; a parità meglio i moduli interi; sul contorno vero deve andare davvero meglio, se no la griglia resta dov'era. Un lato conta se è dritto entro mezzo mm, lungo almeno 150 mm e almeno il 40% della larghezza: valori miei, come il peso fra filo e moduli interi. Acceso di serie: sui contorni senza lato dritto non cambia niente.

- **I passaggi possono stare dentro** (2026-11-05, *«non fare i passaggi esterni al contorno quando il modulo viene tagliato, ma fare i passaggi interni ribattendo sulle linee già ricamate o che verranno ricamate in seguito. Non ci interessa se i passaggi sono più degli altri»*). Spunta spenta di serie, scelta mia. Accesa, il filo fa la strada più corta sulle linee del ricamo; le uscite per il cambio ago restano fuori, e l'allineamento al lato dritto non serve.

## Da decidere
- Come nasce la ragnatela nella versione parametrica: il modulo è disegnato a mano e la regola che lo genera non è misurata.

## Il tool sul file di riferimento (2026-11-03)

La regola della catenella, misurata sul file: prima maglia a 0,60 mm dall'inizio del tracciato, poi una ogni 1,70 mm fissi; triangolo 2,50 mm avanti e 1,30 mm di largo, cucito due volte. Sui 1.441 oggetti su 2.118 che hanno lo stesso numero di punti del file, lo scarto mediano è 0,11 mm e il massimo 2,17 mm. Non è ancora la regola esatta: negli angoli Stilista fa qualcosa di diverso.

Col modulo e il contorno del file, nella pagina del tool:

| | Tool | File |
|---|---|---|
| Moduli | 29 | 29 |
| Basi | 171 | 172 |
| Catenelle | 2.057 | 2.118 |
| Passaggi | 1.377 | 1.379 |

Il file è stato pulito a mano e l'8% dei vertici delle sue catenelle sta fuori dal contorno; il tool taglia esatto sul contorno.

**Dove cadono le catenelle.** Col passo unico tutto il tracciato del tool sta entro 0,15 mm da una catenella del file, il 63,6% entro 0,05 mm: lo scarto è il passo corretto.

**Quali pezzi di modulo si tengono sul bordo.** Riempiendo tutto il contorno venivano 42 moduli. Il file ha un modulo tagliato con dentro il 23,6% della sua catenella e non ne ha uno col 20,7%: la soglia sta fra i due. Di serie è 22% e tornano esattamente i 29 moduli. La regola è dedotta dal file e Lorenzo l'ha tenuta. Con 0 il tool riempie fino al bordo.

**Il bianco sul bordo**, sul contorno del file, su 1.237 cm² (tutto in linee di base e catenelle, passaggi esclusi):

| | Pezzi spenti | Pezzi attaccati | Soglia a 0 |
|---|---|---|---|
| Moduli, e quindi cambi ago | 29 | 29 | 39 |
| Pezzi attaccati | 0 | 10 | 0 |
| Area a più di 5 mm dalla linea più vicina | 19 cm² | 0 | 0 |
| Area a più di 12 mm | 4 cm² | 0 | 0 |
| Punto più lontano | 24 mm | 5 mm | 4 mm |
| Catenelle | 2.057 | 2.200 | 2.231 |
| Punti | 344.212 | 360.150 | |

Nei pezzi 2,06 m di catenella e 2,79 m di passaggi: 2,34 m sotto catenelle che arrivano dopo, 0,35 m sopra catenelle già cucite, 0,10 m su nessuna catenella. Nessun salto: fra due oggetti dello stesso modulo al più 6,9 mm.

**Le aree**, sul contorno e il modulo del file con due rettangoli di prova, A da 130 × 110 mm e B da 120 × 120 mm:

| Soglia di A | Soglia di B | Linee nuove in A | Linee nuove in B | Fuori dalle aree | Capi in aria |
|---|---|---|---|---|---|
| 40 mm² | 15 mm² | 0 | 219 | 0 | 0 |
| 30 mm² | 12 mm² | 50 | 361 | 0 | 0 |
| 20 mm² | 20 mm² | 172 | 150 | 0 | 0 |
| 15 mm² | 15 mm² | 242 | 219 | 0 | 0 |

Nessun salto e nessun passo lungo in nessuna delle quattro. Provato con un SVG a tre colori fatto come quello del plugin, non con una selezione vera di laser in Stilista.

**I movimenti fra oggetti.** Nel modulo due oggetti di seguito distano fino a 5,46 mm. Il tool cuce un punto solo fino a 7 mm (5,46 più circa un passo di maglia) e oltre gira sulla corsia. Sul contorno del file: nessun salto dentro un modulo, 538 tagli sulle corsie, corsia più lontana a 18 mm.

**Come passa il filo fra i moduli nel file** (misurato su 29 moduli): ogni modulo finisce con un passaggio da 83 a 322 mm. Dentro il contorno corre sulle linee dei moduli che arrivano dopo: su 27 moduli zero mm sopra linee di moduli già cuciti, sugli altri due 1,1 mm. Dove sotto non arriva più nessuno (ultima riga) corre su nessuna linea, fino a 45 mm. Poi va oltre il contorno e finisce su una verticale fissa: a sinistra per le prime due colonne, a destra per le altre tre. Le prime due colonne hanno anche un trattino a x −8,9 mm, 27,8 mm più in là. Il modulo dopo cambia ago (9, 10, 11, 12, 11 per colonna).

**Nel tool** l'uscita esce ai lati sulle linee dei moduli dopo, poi oltre il contorno: salire e scendere costa il triplo (valore mio). Dove ai lati resterebbe scoperta per più di 10 mm (valore mio) può uscire dal bordo più vicino. Non finisce su una verticale fissa come nel file; due uscite non lasciano il bordo entro 6 mm l'una dall'altra e una linea già usata da un'uscita costa di più.

Quanto aspetta l'uscita prima di essere coperta, contando i moduli cuciti in mezzo, sul contorno del file con 29 moduli (il ritiro vero non è misurato):

| | Strada più corta (prima) | Ai lati (ora) | File |
|---|---|---|---|
| Attesa massima | 16 moduli | 6 moduli | 7 moduli |
| Attesa media | 3,1 moduli | 2,3 moduli | 3,6 moduli |
| Linea che aspetta più di 5 moduli | 0,40 m | 0,01 m | 0,89 m |
| Dislivello massimo fra inizio e fine | 216 mm | 90 mm | 93 mm |
| Filo delle uscite | 3,06 m | 3,73 m | 6,32 m |
| Sotto i moduli dopo | 2,36 m | 3,00 m | 3,80 m |
| Dentro su nessuna linea dopo | 133 mm | 163 mm | 71 mm |
| Sopra moduli già cuciti | 1 mm | 3 mm | |

Sul file il tratto «su nessuna linea dopo» comprende anche quello sopra i già cuciti. Delle 29 uscite 23 finiscono ai lati, 5 della riga in cima escono in alto e una dell'ultima riga nell'incavo. Il trattino non c'è. Provata su una copia in Stilista con 4 moduli: ogni colonna col suo ago (`POST /ago`, prima non provata), i cambi ago tutti fuori dal contorno.

**Quanto si infittisce sul contorno del file.** Di partenza 40 mm di catenella per cm²:

| Maglie più grandi di | Linee nuove | Maglie rimaste intere, ogni due moduli | Catenella per cm² | Punti |
|---|---|---|---|---|
| 30 mm² | 404 | 6 | 42,8 mm | 363.694 |
| 25 mm² | 784 | 8 | 44,8 mm | 378.843 |
| 20 mm² | 1.355 | 20 | 47,9 mm | 404.399 |
| 15 mm² | 1.912 | 36 | 50,6 mm | 426.114 |
| 12 mm² | 3.043 | 58 | 55,4 mm | 467.647 |

I punti sono misurati a filo continuo; con le uscite cambiano di poco (a 20 mm²: 403.772). Oltre i 40 mm² non c'è niente da dividere. Linee da 6 a 8 mm di mediana, al massimo 11,4 mm.

La simulazione ha trovato un errore che i test non vedevano: ogni oggetto diventava un tratto a sé, e nel DST erano 3.534 rasafili. Ora un test controlla che un modulo sia un filo solo.

**Non ci sono ancora:** le aree vuote nel contorno (si usa l'anello più grande); la versione parametrica. La pulizia è il taglio esatto sul contorno, non la pulizia a mano.

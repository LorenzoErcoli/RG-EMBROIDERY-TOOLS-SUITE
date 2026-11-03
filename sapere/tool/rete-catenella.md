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

**I movimenti fra oggetti.** Nel modulo due oggetti di seguito distano fino a 5,46 mm. Il tool cuce un punto solo fino a 7 mm (5,46 più circa un passo di maglia) e oltre gira sulla corsia. Sul contorno del file: un filo per modulo, nessun salto dentro un modulo, 823 tagli sulle corsie, corsia più lontana a 18 mm.

La simulazione ha trovato un errore che i test non vedevano: ogni oggetto diventava un tratto a sé, e nel DST erano 3.534 rasafili. Ora un test controlla che un modulo sia un filo solo.

**Non ci sono ancora:** il running d'uscita verso il modulo dopo; le aree vuote nel contorno (si usa l'anello più grande); la versione parametrica; gli oggetti psil veri verso Stilista (ora arrivano come punti fissi, uno per modulo). La pulizia è il taglio esatto sul contorno, non la pulizia a mano.

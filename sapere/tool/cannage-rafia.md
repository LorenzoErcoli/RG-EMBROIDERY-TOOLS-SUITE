---
titolo: Cannage rafia — la borsa in fasi da un SVG a zone, e cosa c'è davvero nei DST di riferimento
tipo: tool
tool: [cannage-rafia, zone-pattern, pattern-grammar]
data: 2026-09-15
---

Lorenzo, 2026-09-15: nuova sotto-app **cannage-rafia**. Con [Pattern a zone](zone-pattern.md) si
faceva la sola base; la borsa vera ha **4 fasi**: base pattern 1, base pattern 2, linee orizzontali e
verticali, cornice nei rombi. Obiettivo: tutto il programma a partire da un SVG a zone, **per step
rapidi**. I file di riferimento (DST M1404 davanti e lato, SVG a zone del modello M3641) sono elencati
in [riferimenti](../riferimenti/LEGGIMI.md).

## La lettura dei DST (identica fra davanti e lato)

| Ago | Cosa fa |
|---|---|
| 3 | fase 1 (punto mediano 1,87 mm) |
| 4 | fase 2 (2,5 mm) |
| 5 | fase 3, le linee: coppie di linee orizzontali a ~2 mm con fermi, gruppi di 3 verticali; punti fino a 8 mm |
| 6 | fase 4, la cornice: zig-zag a scaletta lungo i lati dei rombi + quadratini ai nodi |
| 1 e 7 | **non fasi**: contorno di piazzamento identico a inizio e fine |
| 2 | **non fase**: reticolo diagonale sui lati dei rombi (passo perpendicolare ~43,9 mm) |
| 8 | **non fase**: logo Dior (solo davanti) |

Domanda aperta a Lorenzo: le non-fasi vanno generate?

## Fase 3, le linee (decifrata il 2026-09-15)

Verificata ricostruendola dai parametri: 2.120 elementi su 2.120 ritrovati nei due DST, scarto
≤ 0,56 mm. Tutto è agganciato ai rombi del **pattern 1** (una fila sì e una no, passo = altezza del
rombo 60,5; periodo orizzontale = larghezza del rombo 63,4). Gruppo = 4 linee a ±4,75 e ±6,7 dalla
diagonale orizzontale; ogni linea è un **cordoncino** (9–17 passate) a pezzi, con **finestre** senza
cordoncino dove la linea attraversa il lato del rombo (ci passa la cornice); ritorno con **fermi**
0,8 × 2,4 mm sui giunti; **scalette** a 3 corsie (1,6 mm) a ±8 dal centro verso fuori (base ±5,95,
altezza 15,5); **meandro** fra le linee interne a ±8; **barre** 6,5 mm sopra e sotto ogni vertice.
Ordine A→ A← B→ B← D→ D← C→ C←, cambi di linea e di gruppo sul bordo sinistro fuori pezzo. Davanti:
cordoncini orizzontali 9–10 passate da 1 punto; lato: 15–17 da 2–2,5 punti (punto massimo ~3,5) —
un'impostazione diversa, non una geometria diversa.

**Le risposte di Lorenzo (2026-09-15):**
1. misure **proporzionali al rombo**, ma oltre una certa crescita non si allungano solo i punti:
   **aumentano gli oggetti** (più pezzi, più fermi…);
2. gruppi tagliati in alto, fondo del davanti senza linee, linee accorciate nel lato = **decisioni di
   montaggio** chieste dal cliente, non regole geometriche → servono eliminazioni scelte a mano;
3. passate: il **davanti è il riferimento reale**, il lato è un'alternativa usata in alcuni modelli;
4. il contorno ripassato a inizio ago 5 serve per le **termogarze**: opzionale.

**Scelte di Lorenzo che si allontanano dal DST:** le barre ai vertici in testa pari ai fermi della
linea esterna, ma il capo verso la diagonale resta quello del DST (−1,1 / +1,5) — la prima versione le
accorciava da tutte e due le parti ed era sbagliata; linee fino in fondo a destra (sporgenza 1 mm come
a sinistra); aree di scarico nelle basi come in Pattern a zone; pulizia del bordo «Elimina» in tutti i
preset; punto minimo 1 mm nei preset.

**La lezione:** confrontare per ELEMENTI (cordoncini, fermi) non basta — i passaggi fra un pezzo e
l'altro decidono le punte delle scalette e il test non li vedeva. Ordine e capo di partenza di ogni
pezzo vanno presi dal DST, e c'è un test sulle estensioni corsia per corsia, passaggi compresi.

## Fase 4, la cornice (decifrata il 2026-09-15)

Un giro attorno a ogni rombo del **pattern 2** (non del P1), righe dall'alto, da sinistra a destra;
giro orario partendo dal vertice destro. È **un modulo unico copiato** su ogni P2: 97 tratti ripassati
(lato 95), copie entro 0,2 mm, il 100% degli elementi dei due DST è una copia del modulo. Uncino =
orizzontale 11 passate a cavallo del lato (~3 mm nel P1, ~2,5 nel P2) + verticale 9–12 passate dentro
il P2 (da ~1 a ~5 mm dal lato); passo ~1/15 del lato; 9 uncini sui lati basso-dx/alto-sx, 11 sugli
altri due; ai vertici solo orizzontali. Lunghezze irregolari (3,6–7,4). Sul bordo del pezzo nessuna
distanza fissa (lato 7–12 mm, davanti 1–11) → montaggio.

**Le risposte di Lorenzo (15/09):** rigenerare dai valori (non copiare il modulo); irregolarità volute
ma **davvero minime**; il **centro delle orizzontali deve coincidere col lato del rombo** (*«così che
venga tutto preciso»*); sul bordo un rientro unico va bene.

**Le correzioni di Lorenzo (16/09):** (1) i passaggi *«devono sempre passare dentro»* — niente cammino
sul contorno, e non ripartire ogni riga da sinistra: righe a serpentina, filo solo sui lati dei rombi,
preferendo i lati ancora da cucire (restano sotto); (2) *«tagli troppo presto»*: sul bordo si decide
pezzo per pezzo (orizzontale se ci sta, verticale accorciata), rientro 1 mm. **La lezione:** il DST
vero girava sul contorno a ogni riga — copiarne il percorso era sbagliato anche se «era nel
riferimento».

## Bordatura, stop 7–10 (16/09)

Letta dal DST `M1424 ORLATURA E MEDAGLIONE` (stop 1 = linea, 2–5 = bordatura doppia centrata sulla
linea): raso obliquo 45° passo 1 mm, raso dritto 0,7 al ritorno che sborda ~0,5 verso fuori,
cordoncino 1,2 mm (Lorenzo diceva 1,5) sul bordo esterno, linee a cordoncino 9,5 mm/11 passate + fermi
al ritorno, seconda linea a metà passo.

**Le decisioni di Lorenzo:** esce 0,5 mm oltre la linea disegnata (la linea è **sempre il lato
esterno**, cresce verso dentro); «fase a 50» = metà passo esatta; singolo = come il doppio ma 2 mm e
una linea (*«il più simile possibile, aggiustiamo dopo»*); passo dei fermi = il pezzo più lungo dello
stop 5, allargabile; dove bordare: scelta in anteprima E ruolo nell'SVG. Doppia o singola si sceglie
**linea per linea** (ruoli «Bordatura doppia/singola», clic in anteprima doppia → singola → tolta),
tutte negli stessi stop 7–10. In `bordatura.ts` (commit `6c1b724`).

**Vincolo architetturale:** le app non si importano fra loro (P2); per riusare il motore di Pattern a
zone lo si è portato in `@rg/pattern-grammar/src/zone`.

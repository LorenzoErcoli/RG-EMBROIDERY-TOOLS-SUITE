# Diario della conduzione

> Lo scrive la chat di conduzione ([`CONDUZIONE.md`](CONDUZIONE.md)), un paragrafo per giro, dal più
> recente. Lorenzo lo legge per sapere a che punto è il progetto e cosa aspetta lui.

## Aspetta Lorenzo

- **2026-10-20 — il lavoro fermo di pattern-macchie.** Nella cartella principale ci sono modifiche non
  committate di pattern-macchie (motore, pannello, manuale, STATO, test) almeno dal 2026-10-13, più una
  copia di sicurezza nello stash (`stash@{0}`, messa durante il merge del K1b). Quella chat le
  committerà, o sono da buttare? Finché non si sa, pattern-macchie è un tool **occupato** (§3).
- **2026-10-20 — K6, i riferimenti fuori dal repo.** `PUNTO-STRIATURA.dst` e `BROCCATO.dst` stanno solo
  sul server: per misurarli vanno copiati in `test/fixtures/` (vedi `sapere/riferimenti/LEGGIMI.md`).

## Giri

### 2026-10-20 — il mandato (chat globale)

Nasce la conduzione. Stato di partenza: K1 e K1b su master; **K3 finito sul ramo `cervello/k3-referto`
e mai unito**; U1 mai partita; su `origin/master` è arrivato il Punto maglia (sedicesimo tool), che la
cartella principale non ha ancora.

---

## I messaggi che hanno avviato le fasi (il modello della misura giusta)

### K1b — il contratto del motore (2026-10-15)

> Lavora su un ramo tuo, in un git worktree separato; nel worktree nuovo `git submodule update --init` e
> `npm install`. […] Il contratto in packages/cervello (i tool lo importano solo come tipo): Motore =
> { id, genera(ingresso, params) → Promise<Risultato> }. Ingresso = sagoma, immagine, dst, larghezzaMm,
> più le parti proprie del tool: quello che l'utente disegna a mano fa parte dell'ingresso, non dei
> parametri. params = lo stesso oggetto che il tool salva oggi, coi nomi di oggi: nessuna rinomina. […]
> Non riscrivere niente: avvolgi. […] Non cambiare i pannelli: il passaggio lo farà la U2. […] Il
> cricchetto: per ogni tool chiama genera su un ingresso di prova e controlla strati non vuoti, un DST
> che si rilegge con gli stessi punti, il motore che gira in node. I tool non ancora fatti vanno in una
> lista del debito che può solo scendere. Prova il test rompendolo apposta. […] Per ogni tool confronta
> i punti del DST prima e dopo: devono essere identici.

### K3 — il referto comune (2026-10-15)

> Una funzione unica nel core, accanto a readDst, che dato un DST dà sempre le stesse misure. Il
> referto contiene solo quello che si misura dal DST (punti, lunghezza cucita, salti e tagli, aghi,
> ingombro, punto più corto e più lungo, punti sotto soglia). Attenzione al limite dei 12,1 mm: un salto
> lungo è più record ma conta come uno. Quello che dal DST non si misura non si inventa: il filo in
> vista lo passa il tool che lo calcola; consumo vero e tempo macchina sono domande per Lorenzo. […] Dove
> il referto non coincide coi numeri di oggi non correggere niente: è una divergenza da decidere
> (regola 7), elencala. […] Non toccare i pannelli. Il ricamo non deve cambiare.

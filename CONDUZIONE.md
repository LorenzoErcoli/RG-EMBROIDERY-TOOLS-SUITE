# Conduzione — la chat che fa avanzare il progetto da sola

> Deciso da Lorenzo nella chat globale il **2026-10-20**: *«troviamo un modo perché la chat diventi
> autonoma e gestisca l'avanzamento del progetto da sola»*. Questo file è il suo mandato: quello che è
> scritto qui la chat di conduzione lo fa **senza chiedere**, compresi il merge su master e il push.
> Si ferma solo nei casi di §5. La chat globale resta per altro: Lorenzo segue il lavoro dal
> [diario](CONDUZIONE-DIARIO.md).

---

## 1. Cosa fa, in una riga

Prende la prima voce della coda (§2) non ancora fatta, la porta a termine su un ramo suo, la verifica
col protocollo di §4, la porta su master, la scrive nel diario e passa alla successiva. Fino alla fine
della coda, o finché non serve Lorenzo.

**Ogni giro comincia da capo**: legge questo file, il diario e la voce della fase in `STATO.md`, e
guarda lo stato vero del repo (`git fetch`, `git worktree list`, `git status`). Non si fida di quello
che ricorda: un giro può essere ripreso dopo giorni, e intanto le altre chat hanno lavorato.

## 2. La coda

| # | Voce | Da dove leggere cosa fare |
|---|---|---|
| **0** | **Sincronizzare** — a ogni giro, prima di tutto: master locale = `origin/master`, col passo 7 di §4 se nella cartella principale c'è lavoro non committato di altri | — |
| **1** | **Merge del K3** — ramo `cervello/k3-referto` (cartella `../RG-k3-referto`), finito dalla sua chat e mai unito | voce K3 di `STATO.md` |
| **2** | **U1** — i componenti comuni dell'interfaccia e il loro cricchetto | `AVVIO-INTERFACCIA-COMUNE.md` §3–§5 |
| **3** | **K4** — la scheda di ogni tool in `tools.ts` | `AVVIO-CERVELLO-RICAMO.md` §3d |
| **4** | **K2** — la busta di progetto e `leggiProgetto` | `AVVIO-CERVELLO-RICAMO.md` §3c (e la nota della chat del K1b: il confine fra `params` e `ingresso`) |
| **5** | **U2** — i tool all'anatomia, **uno per giro**, con il passaggio dei pannelli a `motore.genera` e la parte `vista` del `Risultato` (decisione razza, strada A) | `AVVIO-INTERFACCIA-COMUNE.md`, `AVVIO-CERVELLO-RICAMO.md` §3e |
| **6** | **U3** Simula ovunque · **U4** un esempio pronto in ogni tool | `AVVIO-INTERFACCIA-COMUNE.md` §5 |
| **7** | **U5** — le etichette dei pannelli dal registro dei parametri | idem; per i nomi nuovi vale §5 |
| **8** | **K5, il resto** — le decisioni sparse in `STATO.md` portate in `sapere/decisioni/`, e il test di coerenza fra `sapere/` e il registro | `sapere/LEGGIMI.md` |
| **9** | **K6** — le misure dei DST di riferimento con `misuraDst`, in `sapere/riferimenti/` (solo i DST che sono nel repo; per gli altri, §5) | `AVVIO-CERVELLO-RICAMO.md` §4 |
| **10** | **K7** — il banco senza interfaccia | `AVVIO-CERVELLO-RICAMO.md` §5a |
| **11** | **K8** — l'agente `esperto-ricamo` | `AVVIO-CERVELLO-RICAMO.md` §5b |

Ogni fase si fa **come le precedenti**: niente parametri rinominati d'ufficio, niente motori riscritti,
nessun file vecchio che smette di aprirsi; un cricchetto con la lista del debito che può solo scendere;
ogni test provato rompendolo apposta. I messaggi che hanno avviato K1, K1b e K3 (nel diario, in fondo)
sono il modello della misura giusta di una fase.

Una voce nuova entra in coda solo se la mette Lorenzo (o la chat globale per lui).

## 3. Non pestare i piedi alle altre chat

Sulla suite lavorano in parallelo chat operative, ognuna sul suo tool, alcune nella cartella principale
e alcune nelle loro cartelle in `.claude/worktrees/`.

- **Un ramo e una cartella per fase**: ramo `conduzione/<voce>`, cartella `../RG-cond-<voce>`
  (`git worktree add`), poi `git submodule update --init` e `npm install` nella cartella nuova. Mai
  lavorare sul master della cartella principale.
- **Un tool è occupato** se: ha modifiche non committate nella cartella principale, **o** ha un commit
  nelle ultime 48 ore su master o su un altro ramo, **o** c'è un ramo con commit su quel tool non ancora
  in master. Un tool occupato si salta nella U2 e si fa in fondo; nelle altre fasi si toccano i suoi file
  solo per il minimo indispensabile, e il merge passa dal passo 7 di §4.
- **Il lavoro degli altri non si committa, non si cancella, non si lascia in uno stash dimenticato.** Si
  cancellano solo rami e cartelle creati dalla conduzione, e solo dopo il merge.

## 4. Il protocollo di merge

Ogni passo è nato da un problema vero trovato nei merge del K1 e del K1b. Si fa tutto, in quest'ordine.

1. **Unire il master di adesso** nel ramo della fase. Conflitti: si tengono tutte e due le parti. Se il
   conflitto è nella logica di un tool su cui lavora un'altra chat → §5.
2. **Fine riga LF.** Nessun `\r` nei file cambiati rispetto a master. *(Il K1b aveva salvato oblique in
   CRLF: 876 righe cambiate su 66 vere.)* Vedi `sapere/codice/scrivere-file-lf.md`.
3. **`test/smoke.mjs` finisce con la sua chiusura** (`rmSync` · riepilogo · `process.exit`): niente dopo.
   *(I 7 test del cartamodello curvo stavano dopo `process.exit` e non giravano.)*
4. **`npm test`, `npm run typecheck`, `npm run build` verdi.**
5. **Rompere apposta** quello che la fase sorveglia, vedere il rosso, rimettere a posto. Scrivere nel
   commit cosa si è rotto e cosa ha detto il test.
6. **Il ricamo non cambia**, a meno che la fase non serva proprio a cambiarlo: i DST di tutti i tool
   identici (il cricchetto di `test/motore.mjs`), e **nel browser**: build unita servita da una voce
   temporanea di `.claude/launch.json` (da togliere dopo), tutti i tool aperti uno per uno, nessun errore
   in console, i numeri della barra di stato uguali a quelli di master.
7. **Il lavoro non committato di altri nella cartella principale:** salvarne il `git diff` in un file;
   applicarlo con `--3way` sopra il merge in una cartella temporanea; far girare typecheck e test per
   sapere cosa vedrà quella chat; poi, nella cartella principale: `git stash`, master in avanti, il diff
   risolto riapplicato, e **verifica file per file che le modifiche siano identiche**. Lo stash resta
   finché quella chat non ha committato. Quello che cambierà per lei (per esempio un test che diventa
   rosso) va scritto nel diario, con il messaggio pronto da passarle.
8. **`STATO.md`**: la voce della fase diventa fatta, con la data, le misure e quello che si è trovato.
   Si committano solo le proprie righe: se `STATO.md` ha modifiche di altri, si mettono in stage solo i
   propri pezzi.
9. **Push** su `origin master`. **Mai `--force`, mai riscrivere la storia.** Se il push è rifiutato
   (`origin` è andato avanti) si torna al passo 1.
10. **Pulizia**: via il ramo e la cartella della fase. Su Windows i resti si tolgono con
    `cmd /c rmdir /s /q`, che non segue i collegamenti di `node_modules`; mai `rm -rf` su una cartella con
    `node_modules` collegati ad altre.

## 5. Quando si ferma

Fermarsi vuol dire: **scrivere la domanda in cima al diario**, sotto «Aspetta Lorenzo», e passare alla
prima voce della coda che non ne dipende. Non si sta mai fermi se c'è altro da fare.

- **Decisioni di ricamo o di resa**: i nomi delle etichette (A5 e U5), valori che non si misurano (consumo
  vero del filo, velocità della macchina), una divergenza numerica fra due tool (regola 7), quale di due
  regole vince. *La resa la giudica Lorenzo guardando il ricamo* (`sapere/metodo/resa-prima-delle-misure.md`).
- **Il design system** è di Lorenzo: un componente mancante si chiede all'agente `design-system`, ma il
  merge e il tag del DS non si fanno.
- **Tutto quello che cancellerebbe lavoro non suo**, riscriverebbe la storia o richiederebbe `--force`.
- **Un conflitto di merge nella logica** di un tool su cui lavora un'altra chat.
- **Un test che era verde diventa rosso** e non si capisce perché.
- **Tutto quello che esce dal repo**: servizi esterni, chiavi, pubblicazioni diverse dal push su GitHub
  (che pubblica la suite su Pages).

## 6. Il diario

`CONDUZIONE-DIARIO.md`, in cima **«Aspetta Lorenzo»** (le domande aperte, ognuna con la data e la voce
che blocca), sotto un paragrafo per giro, dal più recente: data, voce, commit su master, cosa si è
trovato, cosa è cambiato per le altre chat. Corto: il dettaglio sta in `STATO.md` e nei commit.

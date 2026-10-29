---
titolo: Una chat madre per la suite, che apre una sotto-chat per ogni lavoro su un tool
tipo: metodo
tool: []
data: 2026-10-29
---

Il 2026-10-29 Lorenzo ha fatto pulizia delle chat. Prima c'era una chat per ogni tool (oblique,
pattern, rete testa speciale e altre) più sotto-chat sparse. **Ora ce n'è una sola, la chat madre**,
che lavora nella cartella principale del repo, sul ramo `master`. Da lì Lorenzo chiede tutto quello
che riguarda i tool. Prende il posto della [chat globale e delle chat operative](chat-globale-e-operative.md)
del 2026-08-25.

**Perché:** le chat dei tool erano tante e sparse, e il loro sapere restava chiuso dentro ognuna. Il
codice di tutte è già in `master` (`959af99`), le decisioni stanno in `sapere/`: una chat sola basta
a tenere il filo, e le sotto-chat nascono e finiscono col loro lavoro.

**Come si applica:**

- **Le cose piccole** (una domanda, una lettura, una modifica di una riga) le fa la chat madre.
- **Ogni lavoro vero su un tool** (una funzione nuova, un errore da correggere, un tool nuovo) va in
  una **sotto-chat**, aperta dalla madre nella sua cartella separata (worktree, ramo suo). Il brief
  dice il tool, i file, cosa vuole Lorenzo con le sue parole, cosa vuol dire "finito". Il contesto si
  prende da `sapere/tool/<tool>.md`, da `STATO.md` e da `MANUALE.md`.
- **Mai due sotto-chat sugli stessi file nello stesso momento.**
- **Quando una sotto-chat ha finito, la madre controlla**: guarda le differenze, fa girare
  `npm run typecheck` e `npm test`, poi apre la PR verso `master` e la unisce (Lorenzo ha autorizzato
  `gh pr merge`). Dopo propone a Lorenzo di archiviare la sotto-chat.
- **Nel worktree nuovo**, prima di provare: `git submodule update --init packages/design-system` (senza,
  `npm test` si ferma su `tokens.css`) e `npm install`, perché `node_modules/@rg/*` del checkout
  principale punta ai `packages/*` del checkout principale, non a quelli del worktree (misurato dalla
  sotto-chat di oblique il 2026-10-21).
- Le regole di sempre restano: italiano semplice; mai `git stash` senza nome; i file dei clienti
  (`.emg3`, `.dst`) non vanno nel repo; in GMI Stilista non si chiudono né si modificano i documenti
  aperti di Lorenzo, solo copie proprie.

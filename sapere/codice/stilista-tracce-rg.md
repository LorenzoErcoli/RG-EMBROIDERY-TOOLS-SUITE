---
titolo: Le tracce RG nei documenti di Stilista, l'interruttore per spegnerle e cosa resta visibile anche da spente
tipo: codice
tool: []
data: 2026-11-12
---

Lorenzo, 2026-11-12: *«per gli emg che tengono traccia dei tools. dammi la possibilità di spegnere e accendere perché
io ho paura che poi mi sgamano quelli del software di Stilista»*.

**Cosa scriveva il plugin nel documento** (su master `dc141b3`):

| traccia | dove nasce |
|---|---|
| descrizione `RG Tools · <nome>` dei ricami a punti fissi | `Collegamento.Ritorno.cs` (la sentinella li riconosceva da lì) |
| descrizione `RG raso · …`, `RG infittita · …`, `RG dst · …` | riempimenti, rete a catenella, DST aperti |
| i parametri dopo ` #rg1:` | `Collegamento.Parametri.cs`, e il file `.dst.rgp` accanto al DST |
| `Id`, `Role`, `ColorRole` = `rg-tools` nel programma del bridge | `Collegamento.Ritorno.cs`, ritorno a running: vanno solo nel registro |
| il nome di serie `rg-tools` del DST, che resta nel titolo del documento aperto | `Collegamento.cs` (vedi «Da fare») |

**L'interruttore** (`Tracce.cs`). Sta in `PLUG-INS\RGStilistaLink\tracce.txt` (`accese` o `spente`), fuori dalle cartelle
con la data: una nuova installazione non lo tocca, la disinstallazione lo cancella con tutto il resto. Si legge a ogni
scrittura, quindi vale subito per tutte le finestre aperte. **Di serie spente**: senza il file, niente di nostro nel
documento. Accenderle è una scelta di Lorenzo, che serve per ritrovare i parametri.

Da spente:
- ogni descrizione resta **vuota**. Passano tutte da `ImpostaDescrizione` (`Collegamento.Ritorno.cs`), anche quelle di
  `Collegamento.Riempimenti.cs` e `Collegamento.Running.cs`, che quindi non si sono toccati;
- il tool non manda i parametri, e il DST per un documento nuovo esce **senza la busta** e col nome `ricamo`;
- un `.rgp` rimasto si cancella senza scriverlo;
- `Id` e `Role` del bridge diventano `ricamo`.

Un test (`test/smoke.mjs`, «Tracce RG») si rompe se una descrizione si scrive senza passare dall'interruttore, se
torna `rg-tools`, o se da spente il tool manda parametri o la busta. Le prove C# dell'interruttore sono in
`strumenti-sviluppo/stilista-link-prove` e girano col test quando c'è `dotnet`.

**Le strade.** `GET /tracce`, `POST /tracce?accese=1|0`, `POST /pulisci`. Le serve `ServerLocale.cs` **prima**
dell'elenco di `Collegamento.cs` (`CodexTab.StradaDelleTracce`), perché quel file il 2026-11-12 lo stava cambiando un
altro lavoro. Nei tool c'è il bottone **«Tracce RG»** accanto a «Invia a Stilista»: stato, «Spegnile»/«Accendile» e
«Pulisci il documento», che chiede conferma.

**«Pulisci il documento»** toglie dal documento aperto ogni descrizione che comincia per `RG Tools · `, `RG raso · `,
`RG dst · `, `RG infittita · ` o che contiene ` #rg1:`, e la lascia vuota. Le altre descrizioni non si toccano. Poi
il documento va salvato. Restano i `.Bak` di Stilista e gli oggetti incollati in altri documenti
([`stilista-parametri-nell-oggetto.md`](stilista-parametri-nell-oggetto.md)).

**La sentinella.** Riconosceva i suoi oggetti dalla descrizione `RG Tools · `. Ora li ricorda anche in memoria
(`ConditionalWeakTable`, `Collegamento.Tracce.cs`), riempita al ritorno e da «Pulisci»: finché la finestra resta
aperta, la protezione è la stessa. **Chiuso e riaperto il documento, un oggetto senza nome non lo protegge più nessuno.**

**Misurato su Stilista** (2026-11-13, copia di `native-sequence-test.emg3`, plugin del ramo in una finestra a parte):

| prova | esito |
|---|---|
| senza `tracce.txt` | spente, «di serie» |
| ricamo da 100 punti con le tracce spente | arriva intero, descrizione vuota, nessun parametro |
| lo stesso con le tracce accese | descrizione `RG Tools · raso` e parametri |
| ricamo senza nome, ricalcolo forzato senza lucchetto, stessa finestra | 100 → 100 punti |
| lo stesso dopo salvataggio e riapertura in una finestra nuova (nessuna memoria) | 100 → 100; anche col lucchetto 100 → 100 |
| «Pulisci» | 1 oggetto pulito su 5 (l'altro era già senza nome); parametri 0 |
| nei byte, blocchi compressi compresi, della copia pulita e salvata | nessuna traccia né di `RG Tools` né dei parametri; restano nella copia salvata prima |

Quindi, con un ricamo che nasce da una copia dell'oggetto selezionato, **senza la sentinella non si è perso niente**:
Stilista non l'ha ripercorso neanche forzando il ricalcolo. La sentinella era nata per i ricami che nascevano da un
lineare ([`stilista-oggetto-manuale.md`](stilista-oggetto-manuale.md)), e resta come rete. La prova è su un solo
ricamo piccolo, non su un documento di lavoro. Da qui **la proposta: spente di serie**.

**La scheda macchina.** Nelle 36 librerie di `C:\GMI\Stilista3.3\bin` la descrizione la leggono solo la copia
dell'oggetto, `cLockStitches.get_LockPaths` e, in `GMICamStitch`, `AzioneAutomatica.Execute` e la calibrazione del
laser: nessuna stampa né anteprima. Ma 727 tipi non si caricano fuori da Stilista: che la scheda macchina non la mostri
**non è provato**, va guardato in Stilista.
**Lorenzo, 2026-11-17: «io ancora vedo le scritte sulle schede pdf»**: la scheda PDF della commessa
(`C:\GMI\Stilista3.3\TMP\Commessa*.pdf`) stampa la descrizione degli oggetti. Quel giorno il suo Stilista aveva
ancora il plugin del 2026-11-05, senza interruttore, e i documenti non erano puliti. Il testo di quei PDF non si legge
con una ricerca: le lettere sono codici del carattere.

**Cosa resta visibile anche da spente** (da dire a Lorenzo così):
- il plugin in `C:\GMI\Stilista3.3\PLUG-INS\RGStilistaLink\` e la sua riga in `pluginlist.txt`;
- la scheda **RG_LINK** con «Lavora la selezione con RG Tools…» e «Togli i parametri da questo documento»;
- il registro `%TEMP%\rg-stilista-link.log` e la cartella `%TEMP%\rg-stilista-link\` (DST ricevuti, copie);
- un DST aperto da un tool ha nel titolo `…\rg-stilista-link\ricamo-<ora>.EMG3`; se dentro all'`.emg3` salvato resti il
  percorso di partenza **non è misurato**;
- un ricamo tornato è un oggetto a punti manuali col contorno uguale ai punti e il lucchetto del ricalcolo: un tipo
  normale di Stilista, ma fatto così è riconoscibile da chi lo cerca;
- i documenti salvati prima, finché non si puliscono, e i loro `.Bak`.

**Da fare quando `Collegamento.cs` è libero** (il 2026-11-12 era del lavoro Allarga raso):
- il nome di serie `rg-tools` e la cartella `rg-stilista-link` del DST ricevuto (`RiceviDst`);
- i bottoni dell'interruttore e di «Pulisci» anche nella scheda RG_LINK, dentro Stilista.

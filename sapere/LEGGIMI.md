# sapere/ — la conoscenza di mestiere della suite

> Nata il **2026-09-28** (fase K5 di [`AVVIO-CERVELLO-RICAMO.md`](../AVVIO-CERVELLO-RICAMO.md), decisione
> D2 di Lorenzo: *«portale nel repo»*). Fino a quel giorno queste note stavano nella memoria
> dell'assistente, fuori dal repo: le vedeva solo lui, e solo da una cartella.

La **Costituzione** è la legge (le regole R1–R31, il vocabolario, i parametri canonici). Qui c'è la
**giurisprudenza**: come le regole si sono applicate caso per caso, cosa ha deciso Lorenzo e perché,
cosa si è provato e scartato. È la parte che nessun codice racconta da solo.

**Chi apre una chat su un tool legge prima la sua scheda in `tool/` e le note di `metodo/`.**

## Le cartelle

| Cartella | Cosa c'è | Esempio |
|---|---|---|
| [`tool/`](tool/) | cos'è ogni tool, da quale riferimento è nato, le decisioni di Lorenzo che lo definiscono | *striatura: la macchia è un grappolo di striature, lo spostamento è riempimento, mai salto* |
| [`decisioni/`](decisioni/) | una scelta di resa o di modello, col perché e le strade già provate e scartate | *interlace: la densità è per colore, la globale divisa è stata provata e tolta* |
| [`metodo/`](metodo/) | come si lavora con Lorenzo e su questo repo, valido per tutti i tool | *un riferimento si legge per i suoi valori, non si ricalca* |
| [`codice/`](codice/) | fatti del codice che non si vedono leggendolo: formati, trappole, difetti silenziosi | *il writer DST è il porting byte-per-byte dello standalone* |
| [`riferimenti/`](riferimenti/) | i DST e i file di riferimento: dove stanno, cosa ne è stato misurato | *M1404 cannage rafia: 8 aghi, cosa fa ognuno* |

Verranno (K5–K6): `tecniche/` (una per tipo di punto, coi range dei parametri presi dal registro) e
`materiali/` (fili, supporti, aghi).

## Com'è fatta una nota

Un file Markdown per cosa, con un'intestazione a campi:

```
---
titolo: una riga che dice di cosa si tratta
tipo: tool | decisione | metodo | codice | riferimento
tool: [interlace, striatura]     # i tool che riguarda; [] se vale per tutti
data: 2026-07-27                 # quando è stata decisa o scoperta
---
```

Poi il fatto, e per le decisioni e il metodo **Perché** (il motivo, spesso un tentativo bocciato) e
**Come si applica**. Le note si citano fra loro con link relativi.

## Le regole

- **Si scrive solo quello che ha detto Lorenzo o che si è misurato.** Mai supposizioni: se un valore
  non si è misurato, si dice che non è misurato.
- **Una decisione cambiata non si cancella: si barra e si scrive la nuova con la sua data** (vedi la
  decisione 2 di [`tool/zone-pattern.md`](tool/zone-pattern.md), rovesciata il 2026-09-14).
- **Si aggiorna nello stesso commit** del codice che la mette in pratica, come STATO.
- Quando esisterà il registro dei parametri (K1), un test controllerà che ogni parametro citato qui
  esista davvero: la conoscenza e i tool non devono poter divergere in silenzio.
- Le date nelle note sono quelle in cui il fatto è nato. **Una nota vecchia può descrivere un codice
  che nel frattempo è cambiato**: prima di citarne un file o una funzione, controllarla.

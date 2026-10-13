# @rg/cervello — il registro dei parametri (K1)

> Fase **K1** di [`AVVIO-CERVELLO-RICAMO.md`](../../AVVIO-CERVELLO-RICAMO.md) (§3a, §3b). Decisioni D1–D4 prese il 2026-09-28.

**Il K1 descrive, non cambia.** Nessun parametro si rinomina, nessun motore si riscrive, nessun file
salvato smette di aprirsi. Il registro dice *che nome ha* ogni parametro in ogni tool, cosa vuol dire,
in che unità, entro quali limiti, da quali regole dipende — e il cricchetto impedisce che ne nascano
di non dichiarati.

## Com'è fatto

| File | Cosa |
|---|---|
| `src/tipi.ts` | `DichiarazioneParametro` (un parametro in un tool), `Parametro` (fuso), `UsoTool` |
| `src/concetti.ts` | i concetti di mestiere che raggruppano i parenti (`densita`, `punto-minimo`, …) |
| `src/tool/<id>.ts` | **la scheda di ogni tool**: i suoi parametri, scritti col tool davanti |
| `src/parametri.ts` | fonde le 15 schede per `id` → `REGISTRO`; rifiuta (all'avvio) due tool che dicono cose diverse con lo stesso nome |
| `src/schema.ts` | genera `params.schema.json` dal registro (`npm run genera:schema`) |
| `src/debito.ts` | i parametri salvati e non ancora registrati, ognuno col suo perché; **può solo scendere** |
| `../../test/salvati/<id>.ts` | cosa il tool **salva davvero**, letto dai default del suo motore (senza DOM) |
| `../../test/registro.mjs` | il confronto fra le due cose; lo usa `npm test` (sezione «K1 — il registro») |

## Le regole di scrittura

- **`id` in inglese camelCase** (D1). Se il tool salva il parametro con un altro nome (es. `sormontoMm`,
  `passoMm`, `seme`), quel nome va in `nome` e resta com'è: *niente si rinomina*. L'`id` è il nome
  inglese che avrebbe, scelto sul significato.
- **Stesso `id` in due tool = stessa cosa** (stesso tipo, stessa unità, stesso concetto): se non lo è,
  si usano due `id` diversi. Etichetta, aiuto, limiti e default possono cambiare da tool a tool.
- **Due parametri che misurano lo stesso concetto con nomi diversi NON si fondono** (D4): restano due
  `id`, con lo stesso `concetto`. Il registro li mette uno accanto all'altro; unificarli è una decisione
  da prendere per tool, col ricamo in mano.
- **Etichetta e aiuto dal pannello del tool** (italiano, senza l'unità nel testo: sta in `unita`).
  Se il pannello non c'è, l'aiuto viene dal commento nel codice. **Mai inventare**: se non si capisce
  cosa fa, il parametro non si registra e va nel debito con il perché.
- **`predefinito` = il valore che il codice ha oggi**, e il cricchetto lo controlla contro i default del motore.
- **Limiti (`min`, `max`, `passo`)** quelli del pannello o del `clamp` nel codice; se non ce ne sono, nessuno.
- **`dove`**: `'params'` (default) per ciò che sta in `params` del file di progetto; per i tool che salvano
  in altre chiavi (`route`, `stop`, `cornice`…) il nome della chiave.

## Il cricchetto (`npm test`)

Per ogni tool, `test/salvati/<tool>.ts` dice cosa il tool salva. Il test fallisce se:
1. un parametro salvato non è nel registro **e** non è nel debito;
2. un parametro è nel debito ma ormai è registrato (o il tool non lo salva più): la voce va tolta;
3. la lunghezza del debito non coincide con `DEBITO_ATTUALE` in `test/smoke.mjs`: il debito può solo scendere;
4. il default registrato non è quello che il codice ha;
5. un parametro è registrato per un tool che non lo salva;
6. `params.schema.json` non coincide con quello generato dal registro;
7. un tool della suite (`TOOLS`) non ha scheda o non ha `salvati`.

**Aggiungere un parametro a un tool**: aggiungilo al suo motore, poi dichiaralo in `src/tool/<id>.ts`
(e rigenera lo schema). **Aggiungere un tool**: scheda in `src/tool/`, riga in `SCHEDE` (`parametri.ts`),
`test/salvati/<id>.ts` e la riga in `test/salvati/indice.ts`.

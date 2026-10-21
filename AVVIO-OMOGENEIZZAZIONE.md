# Avvio — omogeneizzare i tool, partendo da quello che K1, K1b e K3 hanno scoperto

> Riassunto di una pagina per la chat globale e per la sotto-chat che omogeneizza i tool. Scritto il
> **2026-10-20**. Ogni punto sotto è **misurato** (dettagli in `STATO.md`, voci K1, K1b, K3). Dove manca una
> decisione di Lorenzo c'è scritto «da decidere»: **non si sceglie al posto suo** (regola 7).

## Dove siamo

| Fase | Cosa c'è ora | Stato |
|---|---|---|
| **K1** | un registro con tutti i parametri dei 15 tool (327), nome inglese, etichetta italiana, unità, limiti | su master |
| **K1b** | ogni tool si chiama allo stesso modo: `motore.genera(ingresso, params)` → strati + avvisi | su master |
| **K3** | `misuraDst(bytes)`: stesse misure da qualunque DST (punti, filo, salti, tagli, aghi, ingombro…); ogni tool la riporta in `misure` | sul ramo `cervello/k3-referto`, **da portare su master** |
| **U** | interfaccia comune (barra di stato, bottone Genera): `AVVIO-INTERFACCIA-COMUNE.md` | da fare |

Tutto è stato fatto **senza cambiare il ricamo**: i DST di tutti i tool sono identici a prima.

## Cosa non è ancora omogeneo (le scoperte)

**1. Gli stessi numeri hanno definizioni diverse nei tool** (K3). È la cosa più urgente, perché la barra di
stato comune li mostrerà tutti:
- **Punti**: i tool contano i *vertici* delle linee; il file di ricamo conta i punti *cuciti*. Il primo vertice di
  ogni linea è un posizionamento, non un punto → «punti del tool = punti veri + numero di linee». Coincidono solo
  cannage-rafia e cross-stitch. *Da decidere: quale conteggio mostrare.*
- **Salti**: i tool non contano lo spostamento dopo un cambio d'ago, il referto sì. *Da decidere: cos'è «un salto» per l'utente.*
- **Metri di filo**: pochi millimetri di differenza (il formato arrotonda a 0,1 mm). Zone-pattern mostra il filo senza i passaggi e i passaggi a parte.
- **Ingombro**: alcuni tool mostrano la tela o la sagoma, non il rettangolo dei punti.
- **Aghi**: i tool contano tinte o stop, il referto gli aghi che cuciono davvero.
- Net-45 e oblique non mostrano numeri sul ricamo.

**2. Il «filo in vista» non ha una definizione unica.** Razza e pettine lo calcolano (solo i passaggi), cross-stitch
ha un suo numero con tre punti aperti, broccato e pittorico misurano i passaggi coperti. *Da decidere (domanda a
Lorenzo): cosa si intende, per ogni tecnica.*

**3. Due tool scrivono il DST per una strada diversa** (pettine, sfrangiatura): niente `dstFromExportLayers`, quindi
niente centratura e metadati uguali agli altri. Chi esportasse dagli strati avrebbe un file diverso. Razza esporta
con `center:false`. *Da omogeneizzare: un solo modo di scrivere il DST, o dichiarare le eccezioni.*

**4. Nomi diversi per la stessa cosa** (K1, regola D4, nessuno fuso d'ufficio): punto minimo/massimo, passo dei
passaggi (`travelStitch` e `travelStitchMm` sono due id per lo stesso concetto), seme, larghezza reale, densità /
interlinea (`horizontalZigzagInterline` è «interlinea» in due tool e «densità» per R22 nel codice). Il registro li
mette uno accanto all'altro per concetto: **si decide tool per tool, col ricamo in mano**.

**5. Parametri salvati ma non usati o non esposti**: net-45 ne salva 3 che nessun codice legge; pittorico 13 e
oblique ~58 senza controllo nel pannello; pettine salva parametri che alla riapertura non rilegge. Il debito del
registro è 12 voci: liste (interlace, bitmap), parametri alla radice del file (pettine), i 3 di net-45.

**6. Confine fra «parametro» e «cosa disegnata a mano»** non uniforme (tavolozza del broccato, tagli del pittorico
stanno dove capita). Serve fissarlo con la busta di progetto (K2).

**7. Rischi nascosti**: Interlace coi suoi default supera i 12,1 mm del formato → il DST ha +18% di punti. Molti rami
(sagoma importata, aree di scarico, bordatura, modulo del cross-stitch) **non sono coperti dai test**. Il razza ha
il Worker che non passa da `genera` (decisione già presa: «strada A»).

## Ordine proposto per la sotto-chat

1. **Portare K3 su master** (e `rete-testa-speciale`, tool nuovo, dovrà riempire `misure` come gli altri).
2. **Raccogliere le decisioni di Lorenzo** sui punti 1 e 2 (e le 3 domande sul consumo di filo, il tempo macchina, il filo in vista) e scriverle in `sapere/decisioni/`.
3. **Barra di stato comune sul referto** (U2) — solo dopo le decisioni del punto 2, altrimenti si porta in giro una definizione sbagliata.
4. **Un solo modo di scrivere il DST** (punto 3).
5. **Un concetto alla volta** per i nomi (punto 4), tool per tool, ognuno con test che lo blocca.
6. K2 (la busta di progetto) per fissare parametri / ingresso / misure (punti 5 e 6).

## Cosa NON fare

- Non cambiare il ricamo di un tool per far tornare un numero.
- Non fondere parametri con lo stesso concetto senza una decisione di Lorenzo.
- Non toccare le modifiche non committate delle altre chat (oggi: pattern-macchie, rete-testa-speciale).

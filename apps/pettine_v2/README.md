# Pettine V2 — esperimento di sequenza locale

**Stato: principio verificato sui casi controllati; prova reale NON superata.**

Il problema non si risolve aumentando la distanza massima dei collegamenti. Bisogna scegliere un punto di accesso condiviso fra macchia e blocco grande, pianificare anche l'uscita e rimandare la cucitura che coprirà il corridoio finché il corridoio serve.

Questa cartella è una copia isolata di `apps/pettine`. Il lavoro di questa attività riguarda soltanto questa copia e la visualizzazione della conversazione. Non sono stati modificati il motore originale, la shell o i pacchetti condivisi. Questi ultimi sono importati in lettura, come nella versione originale. Non è stata aggiunta una voce nella suite.

## Cosa prova il prototipo

- Divide le righe prima della sequenza, alle radici dei denti, invece di tentare innesti solo a ordine già deciso.
- Considera insieme tutte le famiglie dello stesso colore.
- Costruisce una rete sulle basi e sui denti reali. Ogni tratto di corridoio deve appartenere a ricamo ancora da cucire.
- Permette l'andata in impuntura e il ritorno ricamando. Serve prima un'ala senza uscita, poi prosegue a serpentina quando trova un'uscita futura.
- Usa il colore successivo solo dove il suo filo si sovrappone a quello corrente; il semplice fatto di trovarsi dentro un poligono scuro non autorizza un passaggio.
- Verifica la sequenza emessa con un secondo algoritmo, senza fidarsi dei costi o delle coperture dichiarate dal pianificatore.

La tolleranza geometrica di copertura è 0,25 mm; le coordinate di verifica sono arrotondate al decimo, come il DST. Questa è una condizione del modello, non una misura della coprenza fisica del filo. Va verificata su tessuto.

## Risultati ripetibili

Otto casi geometrici superati, più due controlli che introducono apposta errori e verificano che vengano rilevati. Nei casi positivi nessun pezzo manca o è duplicato, tutte le basi e tutti i denti mantengono la lunghezza attesa, nessuna precedenza è invertita, nessun passaggio è scoperto nel modello e non ci sono punti inferiori a 1 mm.

| Caso | Tagli | Passaggi totali | Filo di passaggio |
|---|---:|---:|---:|
| Tre righe a serpentina | 0 | 2 | 4 mm |
| Macchia da 10 mm prima del blocco grande | 0 | 3 | 24 mm |
| Macchia da 10 mm dopo il blocco grande | 0 | 5 | 64 mm |
| Macchia di una famiglia diversa | 0 | 5 | 44 mm |
| Due macchie vicine, con ripresa del blocco | 0 | 8 | 46 mm |
| Due pezzi separati da tessuto vuoto | 1 | 1 | 10 mm |
| Due pezzi senza copertura futura fra loro | 1 | 1 | 10 mm |
| Vuoto dentro un colore successivo | 1 | 0 | 0 mm |

I passaggi totali includono anche l'impuntura che ricalca una base prima di ricamarla. Non si nasconde questo consumo aggiuntivo nel conteggio del filo.

Confronto reale: `fixtures/VETTORIALE-6-colori-v2-gruppo-blocchi.svg`, larghezza 419,45 mm, ritaglio X=120, Y=120, 70×70 mm, senza foto. Parametri identici, limite ricerca 45 mm, salvati in `validation/baseline.json`.

| Misura | Riferimento V1 congelato | V2 |
|---|---:|---:|
| Tagli interni ai colori | 7 | 66 |
| Passaggi, incluse impunture V2 | 136 | 362 |
| Filo di passaggio | 1,309 m | 4,256 m |
| Punti inferiori a 1 mm | 0 | 216 |
| Precedenze invertite rilevate | 0 | 0 |

La verifica indipendente della V2 misura inoltre **0,263 mm senza copertura futura**. Il numero della V1 sulla visibilità è calcolato con una regola diversa e non costituisce un confronto equivalente. Il DST V2 di questo ritaglio non viene emesso. Non è stata fatta una prova fisica né una verifica dell'intero pannello.

Durante l'attività il file originale è cambiato per un'altra attività. Per evitare confronti mobili è stato copiato in `src/riferimento-v1.ts`. SHA-256: `6ebad54c46b123f18de069a6c14cf02da50599e816e9391251de4a03b1826f30`. Il riferimento serve solo ai test, non viene importato dall'app.

## Limite individuato e soluzione da completare

La scelta locale dell'uscita non basta: una riga può essere finita correttamente ma consumare l'unico corridoio che permetteva di accedere a un'altra zona. La V2 attuale riconosce molte connessioni locali, ma non riserva l'intera andata e il ritorno prima di ricamare. Non dimostra quindi che ogni taglio residuo sia inevitabile.

Il passo successivo necessario è una pianificazione per visite complete: associare ogni macchia a porte di ingresso e uscita sul blocco ospite; riservare entrambi i corridoi; verificare che restino coperti *dopo l'ultima percorrenza*; soltanto allora fissare quali porzioni ricamare. Le intersezioni con il corridoio devono poter spezzare una porzione anche fra due radici. La precedenza deve essere fisica e locale: `d` è confrontabile nella stessa famiglia; l'ordine stabile fra famiglie usato qui nei contatti è una scelta conservativa ancora da validare.

L'accettazione richiede contemporaneamente: casi da 1 cm collegati; nessuna perdita di punti; nessuna inversione di copertura; nessun passaggio scoperto; nessun punto sotto 1 mm; miglioramento del ritaglio reale. **Finché non accade, questo è un banco di ricerca e non una sostituzione della V1.**

## Avvio e verifica

Dalla radice del repository, senza installare altri pacchetti:

```powershell
npm run dev --workspace apps/pettine_v2
npm run test --workspace apps/pettine_v2
npm run test:reale --workspace apps/pettine_v2
npm run typecheck --workspace apps/pettine_v2
npm run build --workspace apps/pettine_v2
```

App standalone: `http://localhost:5283/`. Per vedere l'esperimento sullo stesso ritaglio, caricare il fixture, impostare 419,45 mm, ritaglio 120 / 120 / 70 / 70 e limite corridoio 45 mm, quindi Genera. L'anteprima e le misure rimangono disponibili anche quando il DST è disabilitato.

`scripts/test-v2.mjs` scrive soltanto dentro `validation/`. `--real` esegue e documenta il confronto senza considerarlo automaticamente superato; `--accettazione` esegue anche il confronto e restituisce codice 1 finché l'accettazione fallisce.

File principali: `src/pianificatore.ts` (sequenza), `src/verifica-piano.ts` (verifica indipendente), `src/motore.ts` (integrazione), `scripts/sequenza.html` (modello della visualizzazione; i dati vengono dalle operazioni dei test, non da una traiettoria disegnata a mano).

# Vicoli ciechi — cosa abbiamo già provato, e cosa hanno detto le misure

Serve a non ripetere. Ogni voce ha il numero che l'ha chiusa.

---

## 1. Lisciare il contorno delle macchie

**Ipotesi:** i bordi sono frastagliati, il campo di direzione prende la perpendicolare del gradino
invece che del bordo, il punto ruota dove il disegno non ruota.

**Fatto:** lisciatura di Taubin (λ/μ, che non restringe come farebbe una media mobile), applicata
prima della semplificazione.

**Risultato: il contorno non è frastagliato.** Misurato come inversioni di curvatura per millimetro,
campionate a passo fisso:

```
contorno com'è          0,11 inversioni/mm   = un'inversione ogni 9 mm
contorno lisciato 1,6mm 0,15 inversioni/mm   e i vertici raddoppiano
```

E sulla densità **peggiora**: con il riempimento continuo acceso, la dispersione va da 3,6× a 5,1×
(lisciatura 1,2 mm) a 5,3× (2,5 mm).

**Trappola in cui siamo caduti, vale la pena saperla:** la prima misura contava i *gradi per
millimetro* del contorno (10,35 prima, 10,21 dopo). Sembrava che la lisciatura non funzionasse. Quel
numero è **curvatura**, e una curva vera gira esattamente quanto uno zigzag. Misurava la cosa
sbagliata.

Il codice c'è (`lisciaBordiMm`, default 0).

---

## 2. Curve di livello di una distanza anisotropa

**Ipotesi — ed è la più promettente delle tre, per questo la descrizione è lunga:** non tracciare le
corse, ma costruire una funzione dentro l'area e prendere le sue **curve di livello**. Due livelli
consecutivi distano la spaziatura *ovunque*, perché il gradiente di una distanza ha modulo uno
sempre. Una garanzia geometrica, non una taratura.

Non la distanza normale — quella darebbe contorni paralleli al bordo, col punto che corre *lungo*
l'area invece di attraversarla. Si misura **solo la componente trasversale al punto**: muoversi lungo
la direzione di cucitura non costa niente, muoversi di traverso costa per intero. Così le curve di
livello corrono lungo la direzione del punto e sono le corse. E basta **un seme solo**, perché
camminare lungo il punto è gratis e il fronte si allunga da sé.

**Risultato:**

```
                 p5    mediana        p95   celle sopra il 150%
tracciato       2,25  104% del chiesto 9,55       24%
curve di livello 1,17  92%             6,66       14%
```

Il troppo pieno lo toglie. Ma **apre i buchi**: il p5 crolla a un terzo del filo promesso.

**E il perché non è un difetto da sistemare.** Un campo di direzione qualunque **non ammette** una
famiglia di curve che lo seguono e stanno tutte a distanza costante. Dove la pretesa è impossibile
nasce uno scontro fra fronti e il livello si spezza: **142 livelli su 142 spezzati**, cioè sempre.

Provato a rimuovere le due spiegazioni alternative, e nessuna delle due era la causa:

- abbassare il costo di camminare lungo il punto (0,05 → 0,01 → 0,002): **peggiora**, mediana dal 92
  al 77% del chiesto;
- allargare lo stencil da 8 a 32 direzioni, perché otto vicini non sanno rappresentare
  un'anisotropia di venti a uno: **peggiora ancora**.

Il codice c'è, misurato e spento: `apps/pittorico/src/iso-fill.ts`, con tutto il ragionamento in
testa al file. `metodoRiempimento: 'iso'` lo accende.

**Cosa resta di utile:** l'impossibilità geometrica è reale e vale per *qualunque* metodo. Ogni
proposta deve dichiarare quale delle due pretese sacrifica.

---

## 3. Toppe locali sulla distanza fra vicini

**Fatto:** cuneo dove due corse si allontanano oltre 1,8 volte la spaziatura; troncatura dove si
stringono sotto una frazione della spaziatura.

**Risultato:** la troncatura è servita — dispersione da 4,3× a 3,6×, celle sopra il 150% dal 26 al
17% — e la soglia ha un ottimo netto:

```
soglia   p5    mediana   p95   celle sopra il 150%
0       2,15   105%      9,17       26%
0,55    2,14   104%      7,73       22%
0,75    2,00    98%      6,94       17%   <- ottimo
0,90    1,25    91%      6,02       13%, ma la coda BASSA si apre
```

**Ma si ferma lì.** Sono regole su una coppia di vicini alla volta, applicate dopo che la distanza è
già stata persa. Non vedono la densità vera e non possono chiudere il 17%.

---

## 4. Ritracciare il filo sui propri passi per raggiungere una corsa lontana

**Fatto e poi rimosso.** Costava densità (celle sopra il 150% dal 28 al 32%, mediana dal 106 al 119%
del chiesto) e curava un difetto che era in realtà altrove.

---

## 5. Il difetto che sembrava di riempimento ed era di routing

Vale come avvertimento sul metodo, più che sul merito.

Sul degradé si vedeva una **linea di contorno**: il filo riempiva le valli della sfumatura. Misurato
il profilo di densità a fette da mezzo millimetro dal bordo:

```
solo riempimento, senza passaggi     7% della densità piena nel primo 0,5 mm
col filo di passaggio              213%
```

Non era il riempimento: era il filo di collegamento, tutto appoggiato sul mezzo millimetro esterno.
E la causa era piccolissima — il router faceva il giro del contorno per saltini **più corti di un
punto**, perché il contorno di una macchia nata da un'immagine è una scalinata di pixel e la corda
fra due capi vicini «esce» per una frazione di pixel. Corretto: 463 giri sul contorno → 12, e la
prima fetta da 213% a 10%.

**La lezione:** prima di attribuire un difetto al riempimento, misurare separatamente riempimento e
passaggi. Lo strumento in `06` lo fa già.

---

## Riassunto per chi ha fretta

| provato | esito |
|---|---|
| lisciare i contorni | il contorno era già liscio; peggiora |
| curve di livello anisotrope | toglie gli addensamenti, apre i buchi. Impossibilità geometrica |
| cuneo + troncatura | funziona fino a 3,6× e si ferma |
| retrace del filo | costava densità, rimosso |
| — | il difetto residuo è **addossato al bordo**: 82% entro 3 mm |

---
titolo: Un riferimento si legge per i suoi valori di costruzione, non si ricalca
tipo: metodo
tool: []
data: 2026-09-03
---

Quando Lorenzo carica un SVG come *riferimento di pattern*, non chiede di **ricalcarlo**: chiede di
capire **come è costruito** e rigenerarlo. Detto da lui il 2026-09-03, dopo aver provato la versione
che posava l'SVG a griglia dentro le zone: *«così prendi proprio l'SVG; invece a te servono solo i
valori di costruzione del modulo»*.

**Perché:** la geometria copiata è geometria **morta** — esce a pezzi staccati, senza filo continuo,
senza punto minimo, coi bordi sfrangiati. I valori invece rientrano nel motore, che sa fare il resto
(continuità, R3, R4, ritaglio pulito).

**Come si applica:** un file di riferimento va **letto**, non incollato. Se viene dalla suite i
parametri sono già scritti dentro (R27) e si prendono esatti; se viene da fuori si **misurano**, si
mostrano nei campi e restano modificabili. Quello che non si riesce a misurare **non si inventa**: si
dice che non è misurabile e il campo resta com'era.

Lo stesso vale per i percorsi di un DST: nel cannage rafia il DST vero girava sul contorno a ogni
riga, e copiarne il percorso era sbagliato anche se «era nel riferimento» (vedi
[cannage rafia](../tool/cannage-rafia.md)). Vedi [Pattern a zone](../tool/zone-pattern.md).

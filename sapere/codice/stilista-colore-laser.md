---
titolo: Il colore di un oggetto laser in Stilista non è il filo del suo ago, è nei suoi parametri laser
tipo: codice
tool: [oblique]
data: 2026-10-22
---

Misurato col plugin RG Stilista Link (`GET /foglie`, [`Collegamento.Foglie.cs`](../../strumenti-sviluppo/stilista-link/Collegamento.Foglie.cs))
su `laser-colore.emg3` di Lorenzo: 3 laser sullo stesso ago, disegnati verde, arancio e viola.

**Il filo non li distingue.** `Reel.getColor()` (il filo dell'ago, quello che usa il bridge) dà lo stesso
rosso `#ED1C24` a tutti e tre, ago 1: per gli oggetti ricamati è il colore giusto, per i laser no.

**Il colore che si vede** è nei parametri dell'oggetto: il campo di tipo `UI4ParametersRO`, poi
`A_LaserParameters` (un `UILaserParamsRO`), e lì dentro l'**unico** campo `System.Drawing.Color` (nome
offuscato): `#22B14C`, `#FFC20E`, `#6F3198`, gli stessi della finestra. Un oggetto è laser se la proprietà
`ContainsLaser` è vera; per gli altri il colore dei parametri laser non conta e si resta sul filo.

**Come si trova un campo così**: `GET /foglie?oggetti=0,1,2&livelli=5` elenca i valori semplici (numeri,
testi, enum, colori) raggiungibili dai campi di ogni oggetto, col percorso; confrontando gli oggetti resta
solo quello che li distingue. Solo campi, non proprietà (i getter possono fare cose).

**Come si applica.** Nell'SVG della selezione il colore di un oggetto è quello laser se è laser, se no il
filo; e ogni gruppo (stop, colore) ha un colore suo, così laser dello stesso stop con colori diversi sono
righe diverse nel tool (oblique: Pannello, Pattern, Fori, Piazzamento). In SH295 l'oggetto 130 è un laser
magenta `#FF00FF`, lo stesso colore dei fori: prende la variante `#FF59FF`.
Vedi anche [`stilista-fori.md`](stilista-fori.md).

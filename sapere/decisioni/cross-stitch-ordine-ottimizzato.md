# Punto croce: l'ordine dei passaggi ottimizzato

**2026-10-15.** Lorenzo, sul retro delle Alpi (BEACHTOTE-MOUNTAIN-ALPS-BACK-V1, 150 × 168 V, 3 blocchi, 10 gruppi):
«il percorso del filo torna troppe volte sulle stesse aree… un oggetto viene fatto in parte, poi il filo si sposta da
un'altra parte per poi tornare lì… guarda il blu delle finestre della casa a sinistra… non toccare il disegno»; «ogni
area limitrofa dello stesso colore dovrebbe finirsi prima di passare alla successiva».

**Perché succedeva.** Il motore sceglie il pezzo dopo uno alla volta, il più economico da raggiungere. Il ripasso
costa quasi niente (0,1/mm) e il filo in vista moltissimo (15/mm nel progetto), quindi pur di non attraversare 3 mm
di vuoto il filo ripassava 30-40 cm sopra il già cucito. Il blu scuro del retro è quasi tutto **un blocco solo**
(7.289 celle): le croci delle finestre, staccate di un vertice, restavano per la fine e il filo ci tornava.

**Cosa si è provato e scartato** (misurato su quel file: passaggi 152,6 m, 111 «va e torna»):
- il pezzo dopo il più vicino in mm invece del più economico: più filo in vista (0,07 → 0,15 m), quasi niente meno ritorni;
- aree per vicinanza (celle a ≤ 3 V) o zone tagliate anche dentro i gruppi: filo in vista ×4;
- riquadri fissi (8-24 V) da finire uno alla volta: in vista 1-1,7 m;
- fasce di spazzata (il blocco diviso dove un buco spezza la riga): peggio;
- il tratto di riga dopo il più vicino: +17 m di passaggi.

**Cosa è rimasto** (`routing.ts`):
- **Le isole vicine** (sempre): cucendo un blocco grande, un blocco di al più 120 unità a meno di 15 mm dall'ago si
  cuce subito se ci si arriva con costo ≤ 6; poi si torna al blocco lasciato a metà (`suspended`).
- **Ottimizza l'ordine** (`relocate`, interruttore nel pannello, spento di partenza): finito il percorso di un filo, un
  or-opt. Catene di 1-8 gruppi di punti (solo V e mezze diagonali, non le croci) si tolgono dal loro posto e si
  inseriscono, anche al rovescio, fra due gruppi la cui fine è vicina (caselle di 10 mm); si tiene lo spostamento se il
  passaggio si accorcia di almeno 5 mm e il filo in vista non cresce. I passaggi si ricalcolano come la strada più
  corta in mm (A*, il filo in vista pesa 200 volte, ricerca fino a 2,5 × la distanza in linea d'aria + 40 mm); dove non
  c'è una strada corta resta quella del motore. 2,5 s per filo e blocco.
- Nel tool l'export usa i passaggi già calcolati dal worker (`stratiCross(..., ready)`), per non rifarli in pagina.

**Misure sul retro** (stesso disegno):

| | prima | isole | isole + ordine ottimizzato |
|---|---|---|---|
| passaggi (m) | 152,6 | 149,6 | ~100 |
| punti sviluppati | 175.493 | 174.701 | ~163.600 |
| passaggi oltre 10 cm | 298 | 283 | ~145 |
| «va e torna» (> 30 mm via e di nuovo vicino a punti vecchi) | 111 | 97 | ~56 |
| in vista / salti | 73 mm / 12 | 73 mm / 12 | ~67 mm / 12 |

Con più tempo l'or-opt scende ancora (8 s per filo: 91 m), ma il ricalcolo diventa troppo lento.

## Il numero giusto di passate (2026-10-15)

Lorenzo: «se un colore ripassa sopra se stesso può togliere un passaggio del sotto, così rimane sempre il numero giusto».
Contate punti + ripassi per diagonale (3 passate chieste), sul retro V1: 4 volte sul 37-55% delle diagonali, 5-7 volte
su ~1.850. `trimExtraPasses` (`exactPasses`, sempre): un va-e-torna immediato sulla stessa diagonale (fra due punti, o
fra un passaggio e un punto) si toglie se lì le passate sono almeno 3 + 2. Restano le diagonali a 4: una passata sola
in più non si toglie senza cambiare il capo da cui il filo esce (la parità del percorso), cioè senza un passaggio
nuovo altrove. Sul retro, con l'ordine ottimizzato: nessuna diagonale a 5 o più (tranne 10), a 4 il 27-41%;
punti sviluppati 175.493 → 161.345; nessuna diagonale sotto 3 passate.

Nei test «gli stessi punti» vuol dire ora le stesse diagonali coperte (punti o ripassi), non lo stesso numero di passate.

// Il debito delle etichette (U5, chiude A5): le etichette dei pannelli che NON sono nel registro dei parametri.
//
// Il cricchetto (test/smoke.mjs, «U5 — le etichette») legge apps/<tool>/src/tool.ts, ne ricava le etichette dei campi
// (`etichetta: '…'` nelle tabelle dei campi, `<span class="rg-field__label">…</span>` nell'HTML) e le confronta con le
// etichette che il registro (packages/cervello) dice per quel tool:
//   1. un'etichetta nel pannello che il registro non ha e NON è qui → il test FALLISCE (le parole del pannello e del registro non si separano di nuovo);
//   2. un'etichetta qui che il pannello non scrive più o che ora il registro ha → FALLISCE: la voce va tolta (la lista può solo scendere).
// Cosa c'è qui dentro: (a) controlli che non sono parametri (strumenti, bottoni, nomi di preset), che non vanno nel registro;
// (b) parametri veri che il registro non descrive ancora, o che ha con un'altra etichetta: ogni voce è una decisione di nome (A5), di Lorenzo.
export const DEBITO_ETICHETTE: Record<string, string[]> = {
  'broccato': ["Stessa densità per tutti", "Cattura dall'immagine"],
  'cannage-rafia': ["Scala del file importato", "La zona è definita da", "Larghezza import", "Altezza import", "Pattern della base 1 (stop 3)", "Pattern della base 2 (stop 4)", "Modo di cucire le linee"],
  'cross-stitch': ["Opacità sotto la griglia", "Larghezza reale", "Larghezza", "Altezza", "Opacità immagine", "Colonne del modulo", "Righe del modulo", "Ingrandisci", "Una V nell'immagine", "Una riga nell'immagine", "Inizio x", "Inizio y", "Filo di base", "Gruppi", "Blocchi di ricamo"],
  'interlace': ["Oggetto pieno (senza fori)", "Immagine di riferimento (opzionale)", "Dove passa ogni filo"],
  'oblique': ["Passo spostamento"],
  'pattern-grammar': ["Scala del file importato", "Larghezza import", "Altezza import", "Nome preset", "Preset disponibili"],
  'pattern-macchie': ["Scala del file", "Il pattern della base (e sopra le macchie)"],
  'pettine': ["Larghezza reale del pannello", "Da sinistra", "Dall'alto", "Larghezza", "Altezza", "Strumento"],
  'pittorico': ["Fili trovati, nell'ordine di cucitura"],
  'punto-maglia': ["Larghezza V", "Altezza V", "Passo", "Larghezza", "Opacità", "Tratto selezionato", "Raggio del cerchio", "Nome del preset", "Preset salvati"],
  'razza': ["Larghezza reale (0 = auto)", "Diametro del prossimo pallino fisso", "Pallini fissi", "Linee di sfumatura", "Nome del preset", "Preset salvati"],
  'rete-testa-speciale': ["Scala del file"],
  'sfrangiatura': ["Strumento"],
  'striatura': ["Oggetto pieno (senza fori)"],
  'zone-pattern': ["Scala del file importato", "La zona è definita da", "Larghezza import", "Altezza import", "Parti da un pattern esistente"],
};

// I tool che non prendono ancora i testi dei campi (etichetta, aiuto, unità) dal registro con `testiCampo(tool, nome)` (U5).
// Un tool che passa a `testiCampo` esce da qui (la lista può solo scendere); un tool che non è qui deve usarlo e non può scrivere a mano un'etichetta del registro.
export const DEBITO_TESTI_A_MANO: string[] = [
  'cannage-rafia', 'cross-stitch', 'interlace', 'oblique', 'pattern-grammar', 'pattern-macchie', 'punto-maglia', 'razza',
  'rete-testa-speciale', 'striatura', 'zone-pattern',
];

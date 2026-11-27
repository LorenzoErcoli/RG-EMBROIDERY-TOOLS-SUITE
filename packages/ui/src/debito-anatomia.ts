// Il debito dell'interfaccia: cosa ogni tool scrive ancora a mano invece di usare i componenti di anatomia.ts (U1).
//
// Il cricchetto (test/smoke.mjs, «U1 — l'anatomia») legge apps/<tool>/src/tool.ts e fa tre cose:
//   1. un tool che scrive a mano una di queste cose e NON è qui → il test FALLISCE (un tool nuovo non può nascere diverso);
//   2. un tool che è qui ma non la scrive più → FALLISCE: la voce va tolta (la lista può solo scendere);
//   3. il numero di voci deve coincidere con DEBITO_ANATOMIA_ATTUALE nello smoke.
//
// Le quattro cose, e come si riconoscono nel sorgente (un testo che il componente produce al posto del tool):
//   intestazione    'rg-workspace__stage-header'   → barraAnteprima()
//   campo-numerico  'rg-input--numeric'            → campoNumero()
//   sezione-01      '<span class="rg-param-section__index">01</span>'  → sezioneSorgente()   (non vede le sezioni costruite da una funzione)
//   barra-stato     'rg-workspace__statusbar'      → barraStato() / scheletro()
// La migrazione (U2) porta un tool alla volta e svuota la sua riga.
export const DEBITO_ANATOMIA: Record<string, string[]> = {
  'cross-stitch': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
};

// Quanti campi numerici scritti a mano (le volte che 'rg-input--numeric' compare in tool.ts) ha ancora ogni tool
// del debito. La lista sopra dice solo SE un tool ne scrive, non QUANTI: così un tool già nel debito poteva
// aggiungerne di nuovi senza che nessun test se ne accorgesse, ed è successo (pulizia del 2026-11-24). Il
// cricchetto in test/smoke.mjs vuole il numero esatto: se sale, il test fallisce (usa campoNumero di anatomia.ts);
// se scende, abbassa il numero qui.
export const DEBITO_CAMPI_A_MANO: Record<string, number> = {
  'cross-stitch': 27,
};

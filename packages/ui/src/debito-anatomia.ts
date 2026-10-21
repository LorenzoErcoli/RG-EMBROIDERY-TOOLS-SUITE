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
  'bitmap': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'broccato': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'cannage-rafia': ['intestazione', 'campo-numerico', 'barra-stato'],
  'cross-stitch': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'interlace': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'oblique': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'pattern-grammar': ['intestazione', 'campo-numerico', 'barra-stato'],
  'pattern-macchie': ['intestazione', 'campo-numerico', 'barra-stato'],
  'punto-maglia': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'razza': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'rete-testa-speciale': ['intestazione', 'campo-numerico', 'barra-stato'],
  'striatura': ['intestazione', 'campo-numerico', 'sezione-01', 'barra-stato'],
  'zone-pattern': ['intestazione', 'campo-numerico', 'barra-stato'],
};

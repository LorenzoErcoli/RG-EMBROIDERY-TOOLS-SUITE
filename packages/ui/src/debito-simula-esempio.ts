// Il debito di U3 (Simula in ogni tool) e di U4 (un esempio pronto in ogni tool): quali tool ancora non ce l'hanno.
//
// Il cricchetto (test/smoke.mjs, «U3 e U4») legge apps/<tool>/src/tool.ts:
//   Simula   si riconosce da `collegaSimula(` o `montaSimulatore(` (il bottone e i controlli del simulatore);
//   esempio  si riconosce da `demo: '…'` (il bottone demo della sezione 01) o da un esempio proprio (`sampleContours`, `sampleImage`, il pannello di esempio).
// Un tool che ce l'ha e sta qui → il test FALLISCE: la voce va tolta (la lista può solo scendere). Un tool che non ce l'ha e non sta qui → FALLISCE: un tool nuovo nasce con Simula e con un esempio.
// Lorenzo ha chiesto Simula ovunque il 2026-09-10 (P1) e un esempio in ogni tool il 2026-10-13.
export const DEBITO_SIMULA: string[] = [
  'cross-stitch', 'interlace', 'net-45', 'oblique', 'pattern-grammar', 'punto-maglia', 'razza', 'striatura', 'zone-pattern',
];

export const DEBITO_ESEMPIO: string[] = [
  'cannage-rafia', 'oblique', 'pattern-grammar', 'pattern-macchie', 'rete-testa-speciale', 'sfrangiatura', 'zone-pattern',
];

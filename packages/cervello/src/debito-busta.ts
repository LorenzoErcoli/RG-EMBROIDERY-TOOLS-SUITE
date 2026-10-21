// Il debito della busta di progetto (K2): i tool che non scrivono ancora la busta (`conBusta()` di @rg/core) sui
// metadati del loro file di progetto. **Oggi è vuoto: 17 tool su 17 la scrivono.**
//
// Il cricchetto (test/smoke.mjs, «K2 — il cricchetto») legge apps/<tool>/src/tool.ts e motore.ts e fa tre cose:
//   1. un tool che scrive `rgProject:` e non passa i metadati da `conBusta(` → deve stare qui, altrimenti FALLISCE;
//   2. un tool che passa da `conBusta(` e sta ancora qui → FALLISCE: la voce va tolta (il debito può solo scendere);
//   3. il numero di voci deve coincidere con DEBITO_BUSTA_ATTUALE nello smoke.
// Un tool nuovo deve scrivere la busta fin dall'inizio: non si aggiunge qui.
//
// Un limite noto: l'SVG di pattern-grammar ha metadati propri generati da packages/pattern-grammar (non nel formato
// `rg-project`), e non porta la busta; il suo DST sì.
export const DEBITO_BUSTA: Record<string, string> = {};

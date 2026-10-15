// Il debito del contratto del motore (K1b): i tool che non esportano ancora `motore` da apps/<tool>/src/motore.ts.
//
// Il cricchetto (test/smoke.mjs, «K1b — il contratto del motore») fa tre cose:
//   1. un tool del registro che NON è qui deve passare `controllaMotore` (test/motore.mjs): strati non vuoti,
//      DST che rilegge gli stessi punti, strati identici alla strada diretta, tutto in node;
//   2. un tool che è qui ma ormai passa → FALLISCE: la voce va tolta;
//   3. la lunghezza di questa lista deve coincidere con `DEBITO_MOTORI_ATTUALE` nello smoke: può solo scendere.
// L'obiettivo è 15 su 15, cioè la lista vuota.
export const DEBITO_MOTORI: Record<string, string> = {};

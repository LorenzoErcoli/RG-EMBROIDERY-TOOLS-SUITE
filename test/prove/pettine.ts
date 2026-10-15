import { costruisciPettine, parametriPettineDefault, stratiDaPercorsi } from '../../apps/pettine/src/motore';

// Il pannello piccolo dello smoke (due gruppi, quattro tinte), senza foto, e i valori di partenza del tool.
export async function prova() {
  // il bundle è «neutral» (niente builtin di node nei sorgenti): si carica fs con un import non letterale
  const modulo = 'node:fs';
  const { readFileSync } = await import(modulo) as typeof import('node:fs');
  const testoSvg = readFileSync(new URL('test/fixtures/pettine-due-blocchi.svg', new URL('../../', import.meta.url)), 'utf8');
  const params = { ...parametriPettineDefault };
  return {
    ingresso: { testoSvg, larghezzaMm: 60, ritaglio: null },
    params,
    // la strada di prima: la chiamata che faceva tool.ts (costruisciPettine) e i blocchi da cui esce il DST
    diretto: () => {
      const es = costruisciPettine({ testoSvg, larghezzaRealeMm: 60, foto: null, ritaglio: null, progetto: null }, { ...params, dst: params.denti });
      return stratiDaPercorsi(es.percorsi ?? [], es.statistiche.colori);
    },
  };
}

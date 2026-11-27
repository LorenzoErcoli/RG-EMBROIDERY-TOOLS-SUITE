// Il calcolo dei passaggi in un processo a parte, così la pagina non si blocca mentre lavora
// (sul giornale Dior intero ci vuole mezzo secondo o più). Riceve griglia, celle e parametri,
// risponde col risultato; l'id serve a scartare le risposte vecchie.
// Anche il modulo dell'editor (`kind: 'module'`, Lorenzo, 2026-11-27: «disegnare nel modulo è molto più lento che
// disegnare fuori»): a ogni tratto il calcolo delle fasce bloccava la pagina 4–14 secondi.
import { routeAll, routeModuleBands } from './strips';

self.onmessage = (e: MessageEvent) => {
  const { id, kind, grid, cells, params, mp } = e.data;
  try {
    if (kind === 'module') {
      const rb = routeModuleBands(grid, mp, params);
      (self as unknown as Worker).postMessage({ id, result: { colors: rb.colors, metrics: rb.metrics }, bands: rb.bands });
      return;
    }
    (self as unknown as Worker).postMessage({ id, result: routeAll(grid, cells, params) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error)?.message ?? String(err) });
  }
};

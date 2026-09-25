// Il calcolo dei passaggi in un processo a parte, così la pagina non si blocca mentre lavora
// (sul giornale Dior intero ci vuole mezzo secondo o più). Riceve griglia, celle e parametri,
// risponde col risultato; l'id serve a scartare le risposte vecchie.
import { routeCells } from './routing';

self.onmessage = (e: MessageEvent) => {
  const { id, grid, cells, params } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, result: routeCells(grid, cells, params) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error)?.message ?? String(err) });
  }
};

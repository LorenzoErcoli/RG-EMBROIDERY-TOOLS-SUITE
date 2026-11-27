// L'ordine dei fili consigliato (ordine.ts) in un processo a parte: su un modulo grande sono decine di secondi, e la
// pagina resta libera. Manda a che punto è, poi i quattro ordini migliori.
import { suggestOrders, type OrderInput } from './ordine';

self.onmessage = (e: MessageEvent<{ id: number; input: OrderInput }>) => {
  const { id, input } = e.data;
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    const res = suggestOrders(input, (done, max) => post({ id, progress: [done, max] }));
    post({ id, result: res.slice(0, 4) });
  } catch (err) {
    post({ id, error: (err as Error)?.message ?? String(err) });
  }
};

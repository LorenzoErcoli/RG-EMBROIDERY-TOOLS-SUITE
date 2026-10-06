// Il calcolo in un processo a parte, cosi' la pagina non si blocca: sul pezzo intero ci vogliono alcuni secondi.
// Riceve pezzo, parametri, pallini fissi e sfumature; risponde col risultato. L'id serve a scartare le risposte vecchie.
import { costruisci } from './motore';

self.onmessage = (e: MessageEvent) => {
  const { id, pezzo, par, fissi, sfumature } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, result: costruisci(pezzo, par, fissi, sfumature) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error)?.message ?? String(err) });
  }
};

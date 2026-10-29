// Il calcolo in un processo a parte, così la pagina non si blocca: sul pannello di prova ci vogliono alcuni secondi.
// Riceve pannello, macchie, pattern e parametri; risponde col risultato. L'id serve a scartare le risposte vecchie.
import { costruisciMacchie } from './motore';

self.onmessage = (e: MessageEvent) => {
  const { id, pannello, macchie, pattern, par } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, result: costruisciMacchie(pannello, macchie, pattern, par) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error)?.message ?? String(err) });
  }
};

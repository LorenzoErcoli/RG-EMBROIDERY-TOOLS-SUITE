// Manda a una finestra di Stilista (una COPIA, mai un documento di Lorenzo) gli oggetti di prepara-punti.mjs:
// per ogni modulo, dall'ultimo al primo (così gli indici dei moduli prima non si spostano):
//   GET /selezione.svg?oggetti=<una catenella del modulo>  → il modello del ritorno (ago, colore)
//   POST /punti { origine_mm: [0, 0], punti, ago }          → un oggetto a punti fissi in fondo al documento
//   POST /ordine { da: in fondo, a: dopo + 1 }              → nel modulo, prima del running d'uscita
//
// Uso:  node strumenti-sviluppo/stilista-prove/manda-punti.mjs <cartella> <porta> [A|B]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, porta, versione = 'A'] = process.argv.slice(2);
const base = `http://127.0.0.1:${porta}`;
const moduli = JSON.parse(readFileSync(join(cartella, `punti-${versione}.json`), 'utf8'));
const stato = await (await fetch(`${base}/stato`)).json();
if (!/rg-stilista-link\\rg-/.test(stato.documento)) throw new Error('la finestra non è una copia della chat: ' + stato.documento);
console.log(stato.documento, '·', stato.oggetti, 'oggetti');

const posta = async (via, corpo) => {
  const r = await fetch(base + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  return r.json();
};
for (const m of [...moduli].sort((a, b) => b.dopo - a.dopo)) {
  await (await fetch(`${base}/selezione.svg?oggetti=${m.catenella}`)).text();
  const r = await posta('/punti', { origine_mm: [0, 0], punti: m.punti, ago: m.ago, nome: `infittita ${versione} · ago ${m.ago} · ${m.linee} linee` });
  if (!r.ok) { console.log('ago', m.ago, 'NON tornato:', JSON.stringify(r)); continue; }
  const o = await posta('/ordine', { da: r.indice, a: m.dopo + 1 });
  console.log(`ago ${m.ago}: ${r.punti_letti}/${r.punti_chiesti} punti, salti ${r.salti}, ago ${r.ago}, da ${r.indice} al posto ${o.ora_al_posto} (${o.ok ? 'ok' : 'NO'})`);
}
console.log('oggetti ora:', (await (await fetch(`${base}/stato`)).json()).oggetti);

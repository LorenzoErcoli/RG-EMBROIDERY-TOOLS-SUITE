// Dalle linee nuove (infittisci-rete.mjs) al programma per POST /running del plugin: ogni linea diventa
// un'imbastitura (copia di un passaggio del suo modulo, insieme 1) e sopra una catenella (copia di una catenella del
// modulo, insieme 2, coi suoi parametri psil). Il modulo è quello della catenella più vicina al primo capo della
// linea; le linee entrano in fondo alle catenelle del modulo, prima del running d'uscita (insieme 3), in fila per
// vicinanza, ognuna girata in modo da cominciare vicino a dove finisce la precedente.
//
// Uso:  node strumenti-sviluppo/stilista-prove/prepara-running.mjs <cartella> [A|B]
//       legge riferimento.json e linee-A.json, scrive running-A.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, versione = 'A'] = process.argv.slice(2);
const doc = JSON.parse(readFileSync(join(cartella, 'riferimento.json'), 'utf8'));
const { linee } = JSON.parse(readFileSync(join(cartella, `linee-${versione}.json`), 'utf8'));
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// i moduli sono i blocchi d'ago
const moduli = doc.needle_blocks.filter((b) => b.needle !== 2).map((b) => {
  const oggetti = doc.objects.slice(b.first_object_index, b.last_object_index + 1);
  const uscita = oggetti.find((o) => o.serialized_parameter_index === 3);
  const prima = uscita ? uscita.index - 1 : b.last_object_index;
  const passaggio = oggetti.find((o) => o.serialized_parameter_index === 1 && o.source_path.point_count < 20);
  const catenella = oggetti.find((o) => o.serialized_parameter_index === 2);
  return { ...b, dopo: prima, passaggio: passaggio?.index, catenella: catenella?.index, linee: [] };
});
const moduloDi = (indice) => moduli.find((m) => indice >= m.first_object_index && indice <= m.last_object_index);

const segmenti = [];
for (const o of doc.objects.filter((o) => o.serialized_parameter_index === 2)) {
  const p = o.source_path.points.map(mm);
  for (let i = 1; i < p.length; i++) segmenti.push({ a: p[i - 1], b: p[i], indice: o.index });
}
function piuVicina(p) {
  let best = null, e = Infinity;
  for (const s of segmenti) {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l2)) : 0;
    const f = d(p, [s.a[0] + t * dx, s.a[1] + t * dy]);
    if (f < e) { e = f; best = s.indice; }
  }
  return best;
}

for (const l of linee) moduloDi(piuVicina(l[0])).linee.push(l);

const programma = [];
for (const m of moduli) {
  if (!m.linee.length) continue;
  // in fila per vicinanza, dall'ultima catenella del modulo
  const fine = doc.objects[m.dopo].source_path.points.map(mm).at(-1);
  let qui = fine;
  const resto = [...m.linee];
  let n = 0;
  while (resto.length) {
    let k = 0, giro = false, e = Infinity;
    resto.forEach((l, i) => {
      if (d(qui, l[0]) < e) { e = d(qui, l[0]); k = i; giro = false; }
      if (d(qui, l.at(-1)) < e) { e = d(qui, l.at(-1)); k = i; giro = true; }
    });
    const l = resto.splice(k, 1)[0];
    const tracciato = giro ? [...l].reverse() : l;
    n++;
    programma.push({ modello: m.passaggio, dopo: m.dopo, contorno_mm: tracciato, nome: `ago ${m.needle} · base ${n}` });
    programma.push({ modello: m.catenella, dopo: m.dopo, contorno_mm: tracciato, nome: `ago ${m.needle} · catenella ${n}` });
    qui = tracciato.at(-1);
  }
  console.log(`modulo ago ${m.needle} (oggetti ${m.first_object_index}–${m.last_object_index}): ${n} linee dopo l'oggetto ${m.dopo}; modelli ${m.passaggio} e ${m.catenella}`);
}
writeFileSync(join(cartella, `running-${versione}.json`), JSON.stringify({ linee: programma }));
console.log(`${programma.length} oggetti in running-${versione}.json`);

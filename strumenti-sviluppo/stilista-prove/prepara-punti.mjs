// Dalle linee nuove (infittisci-rete.mjs) ai punti da cucire, un oggetto per modulo, per POST /punti del plugin.
// Stilista 3.3 qui non sa calcolare il psil delle catenelle (una catenella ricalcolata va a 0 punti, provato il
// 2026-10-29 su una copia del file di riferimento): la catenella si calcola qui, con le misure prese dai punti salvati nel file.
//
// Per ogni linea, in fila: l'imbastitura dall'inizio alla fine (punti ≤ 2,5 mm), poi la catenella che torna
// indietro sulla stessa linea (maglia: A, B, C, A, B, C, A con B e C 2,37 mm avanti e 0,65 mm di lato, poi avanti
// di 1,6 mm), poi il passaggio al capo della linea dopo lungo le linee della rete (il percorso più corto, punti
// ≤ 2,5 mm) o, se non c'è strada, un salto. Le linee di un modulo vanno in fila per vicinanza.
//
// Uso:  node strumenti-sviluppo/stilista-prove/prepara-punti.mjs <cartella> [A|B]
//       legge riferimento.json e linee-A.json, scrive punti-A.json: [{ ago, dopo, catenella, punti: [[x, y, salto]…] }]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, versione = 'A'] = process.argv.slice(2);
const doc = JSON.parse(readFileSync(join(cartella, 'riferimento.json'), 'utf8'));
const { linee } = JSON.parse(readFileSync(join(cartella, `linee-${versione}.json`), 'utf8'));
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const IMBASTITURA = 2.5, MAGLIA = { avanti: 2.37, lato: 0.65, passo: 1.6 };

/** Ricampiona una spezzata a passi ≤ passo, tenendo i vertici. */
function ricampiona(t, passo) {
  const out = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / passo));
    for (let k = 1; k <= n; k++) out.push([t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n]);
  }
  return out;
}

/** La catenella lungo una spezzata: una maglia ogni 1,6 mm, nella direzione del tratto dove cade. */
function catenella(t) {
  const lunghezze = [0];
  for (let i = 1; i < t.length; i++) lunghezze.push(lunghezze[i - 1] + d(t[i - 1], t[i]));
  const L = lunghezze.at(-1), out = [];
  const a = (s) => {
    let i = 1;
    while (i < t.length - 1 && lunghezze[i] < s) i++;
    const l = lunghezze[i] - lunghezze[i - 1] || 1, f = (s - lunghezze[i - 1]) / l;
    const dir = [(t[i][0] - t[i - 1][0]) / l, (t[i][1] - t[i - 1][1]) / l];
    return { p: [t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f], dir };
  };
  for (let s = 0; s < L - 0.3; s += MAGLIA.passo) {
    const { p, dir } = a(s), n = [-dir[1], dir[0]];
    const B = [p[0] + dir[0] * MAGLIA.avanti - n[0] * MAGLIA.lato, p[1] + dir[1] * MAGLIA.avanti - n[1] * MAGLIA.lato];
    const C = [p[0] + dir[0] * MAGLIA.avanti + n[0] * MAGLIA.lato, p[1] + dir[1] * MAGLIA.avanti + n[1] * MAGLIA.lato];
    out.push(p, B, C, p, B, C, p);
  }
  out.push(t.at(-1));
  return out;
}

// ---- la rete come grafo, per i passaggi ----
// le catenelle e i passaggi brevi (insieme 1, meno di 20 vertici): i passaggi uniscono i capi delle catenelle
const tratti = doc.objects.filter((o) => o.serialized_parameter_index === 2 || (o.serialized_parameter_index === 1 && o.source_path.point_count < 20)).map((o) => o.source_path.points.map(mm));
const nodi = new Map(), vicini = new Map(), pos = [];
const nodo = (p) => {
  const k = Math.round(p[0] / 0.3) + ',' + Math.round(p[1] / 0.3);
  if (!nodi.has(k)) { nodi.set(k, pos.length); pos.push(p); vicini.set(pos.length - 1, []); }
  return nodi.get(k);
};
const unisci = (a, b) => { const l = d(pos[a], pos[b]); vicini.get(a).push([b, l]); vicini.get(b).push([a, l]); };
const segmenti = [];
for (const t of tratti) for (let i = 1; i < t.length; i++) { const a = nodo(t[i - 1]), b = nodo(t[i]); if (a !== b) { unisci(a, b); segmenti.push([a, b]); } }
/** Un punto della rete (un capo di linea): un nodo nuovo legato ai due capi del segmento su cui sta. */
function aggancia(p, escludi = null) {
  let best = null, e = 1.5;
  for (const [a, b] of segmenti) {
    if (escludi && (escludi.has(a) || escludi.has(b))) continue;
    const A = pos[a], B = pos[b], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
    if (Math.abs(p[0] - A[0]) > 40 || Math.abs(p[1] - A[1]) > 40) continue;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)) : 0;
    const f = d(p, [A[0] + t * dx, A[1] + t * dy]);
    if (f < e) { e = f; best = [a, b]; }
  }
  const n = nodo(p);
  if (best) for (const m of best) if (m !== n) unisci(n, m);
  return n;
}
// i capi delle linee della rete che toccano un'altra linea «a T», senza un vertice comune
for (const t of tratti) { const suoi = new Set(t.map(nodo)); for (const p of [t[0], t.at(-1)]) aggancia(p, suoi); }

/** Le distanze lungo la rete da un nodo, fino a 60 mm (un passaggio più lungo non conviene). */
function distanze(da) {
  const dist = new Map([[da, 0]]), prima = new Map(), fatti = new Set(), coda = [[0, da]];
  while (coda.length) {
    let k = 0;
    for (let i = 1; i < coda.length; i++) if (coda[i][0] < coda[k][0]) k = i;
    const [g, u] = coda.splice(k, 1)[0];
    if (fatti.has(u)) continue;
    fatti.add(u);
    for (const [v, l] of vicini.get(u)) {
      if (g + l <= 60 && g + l < (dist.get(v) ?? Infinity)) { dist.set(v, g + l); prima.set(v, u); coda.push([g + l, v]); }
    }
  }
  return { dist, prima };
}
function strada({ dist, prima }, da, a) {
  if (!dist.has(a)) return null;
  const s = [a];
  while (s[0] !== da) s.unshift(prima.get(s[0]));
  return s.map((i) => pos[i]);
}


// ---- i moduli ----
const moduli = doc.needle_blocks.filter((b) => b.needle !== 2).map((b) => {
  const oggetti = doc.objects.slice(b.first_object_index, b.last_object_index + 1);
  const uscita = oggetti.find((o) => o.serialized_parameter_index === 3);
  return { ...b, dopo: uscita ? uscita.index - 1 : b.last_object_index, catenella: oggetti.find((o) => o.serialized_parameter_index === 2)?.index, linee: [] };
});
const moduloDi = (indice) => moduli.find((m) => indice >= m.first_object_index && indice <= m.last_object_index);
function catenellaVicina(p) {
  let best = null, e = Infinity;
  for (const o of doc.objects) {
    if (o.serialized_parameter_index !== 2) continue;
    const b = o.source_path.bounds;
    if (p[0] < b.min_x_um / 1000 - 3 || p[0] > b.max_x_um / 1000 + 3 || p[1] < b.min_y_um / 1000 - 3 || p[1] > b.max_y_um / 1000 + 3) continue;
    const q = o.source_path.points.map(mm);
    for (let i = 1; i < q.length; i++) {
      const A = q[i - 1], B = q[i], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)) : 0;
      const f = d(p, [A[0] + t * dx, A[1] + t * dy]);
      if (f < e) { e = f; best = o.index; }
    }
  }
  return best;
}
for (const l of linee) moduloDi(catenellaVicina(l[0])).linee.push(l);

const uscita = [];
let salti = 0, passaggi = 0, mmPassaggi = 0;
for (const m of moduli) {
  if (!m.linee.length) continue;
  const resto = m.linee.map((l) => ({ l, nodi: [aggancia(l[0]), aggancia(l.at(-1))] })), punti = [];
  let qui = doc.objects[m.dopo].source_path.points.map(mm).at(-1);
  let primo = true;
  while (resto.length) {
    // la linea dopo: il capo più vicino LUNGO LA RETE (in linea d'aria se la rete non ci arriva)
    const quiNodo = aggancia(qui), dq = distanze(quiNodo);
    let k = 0, giro = false, e = Infinity;
    resto.forEach((r, i) => {
      for (const [j, g] of [[0, false], [1, true]]) {
        const v = dq.dist.get(r.nodi[j]) ?? 1000 + d(qui, j ? r.l.at(-1) : r.l[0]);
        if (v < e) { e = v; k = i; giro = g; }
      }
    });
    const scelta = resto.splice(k, 1)[0];
    const l = giro ? [...scelta.l].reverse() : scelta.l;
    if (primo) {
      punti.push([...l[0], 1]); // l'oggetto comincia con un salto al primo capo
      primo = false;
    } else {
      const via = strada(dq, quiNodo, scelta.nodi[giro ? 1 : 0]);
      if (via && via.length > 1) {
        for (const p of ricampiona(via, IMBASTITURA).slice(1)) punti.push([...p, 0]);
        passaggi++;
        mmPassaggi += via.reduce((s, p, i) => (i ? s + d(via[i - 1], p) : 0), 0);
      } else {
        punti.push([...l[0], 1]);
        salti++;
      }
    }
    for (const p of ricampiona(l, IMBASTITURA).slice(1)) punti.push([...p, 0]); // l'imbastitura
    for (const p of catenella([...l].reverse()).slice(1)) punti.push([...p, 0]); // la catenella, di ritorno
    qui = l[0];
  }
  const tondo = (v) => Math.round(v * 1000) / 1000;
  uscita.push({ ago: m.needle, dopo: m.dopo, catenella: m.catenella, linee: m.linee.length, punti: punti.map(([x, y, s]) => [tondo(x), tondo(y), s]) });
  console.log(`ago ${m.needle} · dopo l'oggetto ${m.dopo} · ${m.linee.length} linee · ${punti.length} punti`);
}
writeFileSync(join(cartella, `punti-${versione}.json`), JSON.stringify(uscita));
console.log(`${uscita.length} oggetti · passaggi lungo la rete ${passaggi} (${Math.round(mmPassaggi)} mm) · salti ${salti}`);

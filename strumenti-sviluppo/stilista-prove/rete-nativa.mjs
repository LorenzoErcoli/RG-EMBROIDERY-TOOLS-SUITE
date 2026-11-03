// Rete a catenella con oggetti veri di Stilista, ora che il psil si calcola (file con le catenelle collegate, 2026-11-02).
// Su una COPIA aperta in una finestra della chat fa due cose, tutte con copie di oggetti del documento:
//
//   1. la PULIZIA: ricalcolando il psil tornano i punti tolti a mano con «E». Il riferimento è la versione pulita a
//      mano: i capi di maglia che erano cuciti dicono quali tratti del tracciato tenere. La catenella si sostituisce
//      con una o più copie sui soli tratti tenuti: il psil resta vero e la pulizia regge a un nuovo ricalcolo.
//   2. l'INFITTIMENTO: ogni linea nuova è un'imbastitura (copia di un passaggio del modulo), sopra una catenella di
//      ritorno (copia della catenella più comune del modulo) e un passaggio verso la linea dopo, lungo la rete.
//      Entrano nel modulo, prima del running d'uscita.
//
// Uso:  node strumenti-sviluppo/stilista-prove/rete-nativa.mjs <cartella> <porta> <titolo della copia> [prova|manda]
//       legge in <cartella>: corrente.json (il documento), pulita.json (la versione pulita a mano), linee-A.json
//       (lettore offline). «prova» scrive solo il programma e i conti; «manda» lo esegue.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, porta, titolo, modo = 'prova'] = process.argv.slice(2);
const leggi = (f) => JSON.parse(readFileSync(join(cartella, f), 'utf8'));
const doc = leggi('corrente.json'), pulita = leggi('pulita.json');
const { linee } = leggi('linee-A.json');
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);
const tondo = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];

// le catenelle si riconoscono dal psil: PIFlagPsil 32 nel loro insieme di parametri
const eCatenella = (o) => o.kind === 'running' && o.stitch_count > 0 && o.source_path.point_count < 20 && doc.parameter_sets[o.serialized_parameter_index].values[37] === 32; // PIFlagPsil
const catenelle = doc.objects.filter(eCatenella);
if (doc.objects.length !== pulita.objects.length) throw new Error('i due documenti non hanno gli stessi oggetti');

// ---- 1. la pulizia ----
function ascissa(p, t) {
  // la proiezione di p sul tracciato: [distanza, posizione lungo il tracciato]
  let best = [Infinity, 0], s = 0;
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]), dx = t[i][0] - t[i - 1][0], dy = t[i][1] - t[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((p[0] - t[i - 1][0]) * dx + (p[1] - t[i - 1][1]) * dy) / (l * l))) : 0;
    const e = d(p, [t[i - 1][0] + dx * f, t[i - 1][1] + dy * f]);
    if (e < best[0]) best = [e, s + f * l];
    s += l;
  }
  return best;
}
function sottotratto(t, a, b) {
  const out = [];
  let s = 0;
  const su = (i, x) => { const l = d(t[i - 1], t[i]), f = l ? (x - s) / l : 0; return [t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f]; };
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]);
    if (s + l >= a && s <= b) {
      if (!out.length) out.push(su(i, Math.max(a, s)));
      if (s + l <= b) out.push(t[i]); else { out.push(su(i, b)); break; }
    }
    s += l;
  }
  return out;
}
const PASSO_VECCHIO = 1.63, BUCO = 3.3; // due capi di maglia più lontani di due maglie: lì i punti sono stati tolti
const programma = [], daCancellare = [];
let tolti = 0;
for (const o of catenelle) {
  const t = o.source_path.points.map(mm);
  const L = lunghezza(t);
  const capi = pulita.objects[o.index].stitching_path.points.map(mm).map((p) => ascissa(p, t)).filter(([e]) => e < 0.08).map(([, s]) => s).sort((a, b) => a - b);
  if (!capi.length) continue;
  const tratti = [[capi[0], capi[0]]];
  for (const s of capi) { if (s - tratti.at(-1)[1] > BUCO) tratti.push([s, s]); else tratti.at(-1)[1] = s; }
  // l'ultima maglia copriva il tracciato fino a un passo oltre il suo capo; il capo finale va al fondo se ci arriva
  for (const r of tratti) { r[1] = L - r[1] < PASSO_VECCHIO + 0.6 ? L : r[1] + 0.3; if (r[0] < PASSO_VECCHIO + 0.6) r[0] = 0; }
  if (tratti.length === 1 && tratti[0][0] === 0 && tratti[0][1] === L) continue; // intera: non si tocca
  const buoni = tratti.filter(([a, b]) => b - a >= 1);
  tolti += L - buoni.reduce((s, [a, b]) => s + b - a, 0);
  buoni.forEach(([a, b], k) => programma.push({ modello: o.index, dopo: o.index, contorno_mm: sottotratto(t, a, b).map(tondo), nome: `pulita ${o.index}.${k + 1}` }));
  daCancellare.push(o.index);
}
console.log(`pulizia: ${daCancellare.length} catenelle, ${programma.length} tratti tenuti, ${Math.round(tolti)} mm di tracciato tolti`);

// ---- 2. l'infittimento: la rete come grafo, per i passaggi ----
const eCollegamento = (o) => o.kind === 'running' && o.source_path.point_count < 20;
const tratti = doc.objects.filter(eCollegamento).map((o) => o.source_path.points.map(mm));
const nodi = new Map(), vicini = new Map(), pos = [];
const nodo = (p) => {
  const k = Math.round(p[0] / 0.3) + ',' + Math.round(p[1] / 0.3);
  if (!nodi.has(k)) { nodi.set(k, pos.length); pos.push(p); vicini.set(pos.length - 1, []); }
  return nodi.get(k);
};
const unisci = (a, b) => { const l = d(pos[a], pos[b]); vicini.get(a).push([b, l]); vicini.get(b).push([a, l]); };
const segmenti = [];
for (const t of tratti) for (let i = 1; i < t.length; i++) { const a = nodo(t[i - 1]), b = nodo(t[i]); if (a !== b) { unisci(a, b); segmenti.push([a, b]); } }
function aggancia(p, escludi = null) {
  let best = null, e = 1.5;
  for (const [a, b] of segmenti) {
    if (escludi && (escludi.has(a) || escludi.has(b))) continue;
    const A = pos[a], B = pos[b];
    if (Math.abs(p[0] - A[0]) > 40 || Math.abs(p[1] - A[1]) > 40) continue;
    const dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)) : 0;
    const f = d(p, [A[0] + t * dx, A[1] + t * dy]);
    if (f < e) { e = f; best = [a, b]; }
  }
  const n = nodo(p);
  if (best) for (const m of best) if (m !== n) unisci(n, m);
  return n;
}
for (const t of tratti) { const suoi = new Set(t.map(nodo)); for (const p of [t[0], t.at(-1)]) aggancia(p, suoi); }
function distanze(da) {
  const dist = new Map([[da, 0]]), prima = new Map(), fatti = new Set(), coda = [[0, da]];
  while (coda.length) {
    let k = 0;
    for (let i = 1; i < coda.length; i++) if (coda[i][0] < coda[k][0]) k = i;
    const [g, u] = coda.splice(k, 1)[0];
    if (fatti.has(u)) continue;
    fatti.add(u);
    for (const [v, l] of vicini.get(u)) if (g + l <= 60 && g + l < (dist.get(v) ?? Infinity)) { dist.set(v, g + l); prima.set(v, u); coda.push([g + l, v]); }
  }
  return { dist, prima };
}
function strada({ dist, prima }, da, a) {
  if (!dist.has(a)) return null;
  const s = [a];
  while (s[0] !== da) s.unshift(prima.get(s[0]));
  return s.map((i) => pos[i]);
}

const moduli = doc.needle_blocks.filter((b) => b.needle !== 2).map((b) => {
  const oggetti = doc.objects.slice(b.first_object_index, b.last_object_index + 1);
  const uscita = oggetti.find((o) => o.serialized_parameter_index === 3);
  const suoi = oggetti.filter(eCatenella);
  const quante = {};
  for (const o of suoi) quante[o.serialized_parameter_index] = (quante[o.serialized_parameter_index] ?? 0) + 1;
  const piuComune = Number(Object.entries(quante).sort((a, c) => c[1] - a[1])[0]?.[0]);
  return { ...b, dopo: uscita ? uscita.index - 1 : b.last_object_index,
    catenella: suoi.find((o) => o.serialized_parameter_index === piuComune)?.index,
    passaggio: oggetti.find((o) => o.kind === 'running' && !eCatenella(o) && o.source_path.point_count < 20)?.index, linee: [] };
});
const moduloDi = (i) => moduli.find((m) => i >= m.first_object_index && i <= m.last_object_index);
function catenellaVicina(p) {
  let best = null, e = Infinity;
  for (const o of catenelle) {
    const b = o.source_path.bounds;
    if (p[0] < b.min_x_um / 1000 - 3 || p[0] > b.max_x_um / 1000 + 3 || p[1] < b.min_y_um / 1000 - 3 || p[1] > b.max_y_um / 1000 + 3) continue;
    const [f] = ascissa(p, o.source_path.points.map(mm));
    if (f < e) { e = f; best = o.index; }
  }
  return best;
}
for (const l of linee) moduloDi(catenellaVicina(l[0])).linee.push(l);

let passaggi = 0, mmPassaggi = 0, senzaStrada = 0;
for (const m of moduli) {
  if (!m.linee.length) continue;
  const resto = m.linee.map((l) => ({ l, nodi: [aggancia(l[0]), aggancia(l.at(-1))] }));
  let qui = doc.objects[m.dopo].source_path.points.map(mm).at(-1), n = 0;
  while (resto.length) {
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
    const via = strada(dq, quiNodo, scelta.nodi[giro ? 1 : 0]);
    n++;
    if (via && via.length > 1) {
      programma.push({ modello: m.passaggio, dopo: m.dopo, contorno_mm: via.map(tondo), nome: `ago ${m.needle} passaggio ${n}` });
      passaggi++; mmPassaggi += lunghezza(via);
    } else senzaStrada++;
    programma.push({ modello: m.passaggio, dopo: m.dopo, contorno_mm: l, nome: `ago ${m.needle} imbastitura ${n}` });
    programma.push({ modello: m.catenella, dopo: m.dopo, contorno_mm: [...l].reverse(), nome: `ago ${m.needle} catenella ${n}` });
    qui = l[0];
  }
  console.log(`modulo ago ${m.needle}, dopo ${m.dopo}: ${n} linee, catenella modello ${m.catenella}, passaggio modello ${m.passaggio}`);
}
console.log(`infittimento: ${linee.length} linee, passaggi lungo la rete ${passaggi} (${Math.round(mmPassaggi)} mm), senza strada ${senzaStrada}`);
console.log(`in tutto ${programma.length} oggetti nuovi, ${daCancellare.length} da togliere: da ${doc.objects.length} a ${doc.objects.length + programma.length - daCancellare.length}`);
writeFileSync(join(cartella, 'programma-nativo.json'), JSON.stringify({ programma, daCancellare }));

if (modo === 'manda') {
  const base = `http://127.0.0.1:${porta}`;
  const stato = await (await fetch(`${base}/stato`)).json();
  if (!stato.documento.includes(titolo) || !/rg-stilista-link/.test(stato.documento)) throw new Error('la finestra non è la copia della chat: ' + stato.documento);
  if (stato.oggetti !== doc.objects.length) throw new Error('la copia ha ' + stato.oggetti + ' oggetti');
  const posta = async (via, corpo) => (await fetch(base + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })).json();
  // a gruppi di ancora, dall'ultima alla prima: un inserimento sposta solo gli indici dopo di lui
  const gruppi = new Map();
  for (const l of programma) { if (!gruppi.has(l.dopo)) gruppi.set(l.dopo, []); gruppi.get(l.dopo).push(l); }
  const ordine = [...gruppi.keys()].sort((a, b) => b - a);
  let fatte = 0, punti = 0;
  const errori = [];
  for (const ancora of ordine) {
    const r = await posta('/running', { linee: gruppi.get(ancora) });
    fatte += r.fatte ?? 0; punti += r.punti ?? 0;
    if (r.errori?.length) errori.push(...r.errori.map((e) => `dopo ${ancora}: ${e}`));
  }
  console.log(`creati ${fatte} su ${programma.length}, ${punti} punti, errori ${errori.length}`, errori.slice(0, 5));
  // gli originali ripuliti: il loro indice è cresciuto di quanti oggetti sono entrati prima di loro
  const dopoSpostamento = daCancellare.map((i) => i + programma.filter((l) => l.dopo < i).length);
  const c = await posta(`/cancella?oggetti=${dopoSpostamento.join(',')}`);
  console.log('cancellati:', JSON.stringify(c));
}

// Pulisce le catenelle della rete di riferimento su una COPIA già infittita (2026-11-03). Rigenerando il psil sono tornati i punti tolti a
// mano con «E». Il riferimento è la versione pulita a mano: i capi di maglia che erano cuciti dicono quali tratti tenere. Ogni
// catenella da pulire si sostituisce con copie sui soli tratti tenuti: il psil resta vero e la pulizia regge a un ricalcolo.
// Le basi non si toccano: hanno ancora i punti puliti a mano.
//
// Uso:  node strumenti-sviluppo/stilista-prove/pulisci-catenelle.mjs <cartella> <porta> <titolo della copia> [prova|manda]
//       in <cartella>: corrente.json e pulita.json (lettore offline), modulo-tutti.json (da infittisci-modulo.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, porta, titolo, modo = 'prova'] = process.argv.slice(2);
const leggi = (f) => JSON.parse(readFileSync(join(cartella, f), 'utf8'));
const doc = leggi('corrente.json'), pulita = leggi('pulita.json'), lavoro = leggi('modulo-tutti.json');
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tondo = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);
const eCatenella = (o) => o.kind === 'running' && o.stitch_count > 0 && o.source_path.point_count < 20 && doc.parameter_sets[o.serialized_parameter_index].values[37] === 32;

function ascissa(p, t) {
  let e = Infinity, dove = 0, s = 0;
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]), dx = t[i][0] - t[i - 1][0], dy = t[i][1] - t[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((p[0] - t[i - 1][0]) * dx + (p[1] - t[i - 1][1]) * dy) / (l * l))) : 0;
    const x = d(p, [t[i - 1][0] + dx * f, t[i - 1][1] + dy * f]);
    if (x < e) { e = x; dove = s + f * l; }
    s += l;
  }
  return [e, dove];
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

// dove sta ora ogni oggetto del file di partenza, nella copia già infittita
const indiceOra = new Map();
lavoro.attesa.forEach((a, i) => { if (a.indice != null) indiceOra.set(a.indice, i); });

const PASSO_VECCHIO = 1.63, BUCO = 3.3; // due capi di maglia più lontani di due maglie: lì i punti sono stati tolti
const programma = [], daTogliere = [], interamenteTolte = [];
let mmTolti = 0;
for (const o of doc.objects.filter(eCatenella)) {
  const t = o.source_path.points.map(mm), L = lunghezza(t);
  const rif = pulita.objects[o.index];
  const capi = rif.stitching_path.points.map(mm).map((p) => ascissa(p, t)).filter(([e]) => e < 0.08).map(([, s]) => s).sort((a, b) => a - b);
  if (!capi.length) continue;
  const tratti = [[capi[0], capi[0]]];
  for (const s of capi) { if (s - tratti.at(-1)[1] > BUCO) tratti.push([s, s]); else tratti.at(-1)[1] = s; }
  for (const r of tratti) { r[1] = L - r[1] < PASSO_VECCHIO + 0.6 ? L : r[1] + 0.3; if (r[0] < PASSO_VECCHIO + 0.6) r[0] = 0; }
  if (tratti.length === 1 && tratti[0][0] === 0 && tratti[0][1] === L) continue; // intera: non si tocca
  const buoni = tratti.filter(([a, b]) => b - a >= 1);
  mmTolti += L - buoni.reduce((s, [a, b]) => s + b - a, 0);
  const ora = indiceOra.get(o.index);
  buoni.forEach(([a, b], k) => programma.push({ modello: ora, dopo: ora, contorno_mm: sottotratto(t, a, b).map(tondo), nome: `pulita ${o.index}.${k + 1}`, origine: o.index }));
  if (!buoni.length) interamenteTolte.push(o.index);
  daTogliere.push({ ora, origine: o.index });
}
console.log(`da pulire ${daTogliere.length} catenelle, ${programma.length} tratti tenuti, ${Math.round(mmTolti)} mm di tracciato tolti; senza tratti: ${interamenteTolte.join(', ') || 'nessuna'}`);
if (modo !== 'manda') process.exit(0);

const base = `http://127.0.0.1:${porta}`;
const stato = await (await fetch(`${base}/stato`)).json();
if (!stato.documento.includes(titolo) || !/rg-stilista-link/.test(stato.documento)) throw new Error('non è la copia della chat: ' + stato.documento);
if (stato.oggetti !== lavoro.attesa.length) throw new Error(`la copia ha ${stato.oggetti} oggetti, attesi ${lavoro.attesa.length}`);
const posta = async (via, c) => (await fetch(base + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined })).json();
const leggiTutto = async (n) => {
  const out = [];
  for (let i = 0; i < n; i += 250) {
    const ids = [];
    for (let k = i; k < Math.min(i + 250, n); k++) ids.push(k);
    out.push(...(await (await fetch(`${base}/punti-cuciti?oggetti=${ids.join(',')}`)).json()).oggetti);
  }
  return out;
};

const inizio = Date.now();
const errori = [];
for (const a of [...new Set(programma.map((l) => l.dopo))].sort((x, y) => y - x)) {
  const r = await posta('/running', { linee: programma.filter((l) => l.dopo === a).map(({ modello, dopo, contorno_mm, nome }) => ({ modello, dopo, contorno_mm, nome })) });
  if (r.errori?.length) errori.push(...r.errori.map((e) => `dopo ${a}: ${e}`));
}
const posizioni = daTogliere.map(({ ora }) => ora + programma.filter((l) => l.dopo < ora).length);
const c = await posta(`/cancella?oggetti=${posizioni.join(',')}`);
console.log(`in Stilista ${((Date.now() - inizio) / 1000).toFixed(0)} s · errori ${errori.length}`, errori.slice(0, 5), '· cancellate', JSON.stringify(c));

// ---- i controlli, dopo un'attesa ----
await new Promise((r) => setTimeout(r, 15000));
const ora2 = await (await fetch(`${base}/stato`)).json();
const letti = await leggiTutto(ora2.oggetti);
const togliere = new Set(daTogliere.map((x) => x.ora));
const perAncora = new Map();
for (const l of programma) { if (!perAncora.has(l.dopo)) perAncora.set(l.dopo, []); perAncora.get(l.dopo).push(l); }
const attesa = [];
lavoro.attesa.forEach((a, i) => { if (!togliere.has(i)) attesa.push({ ...a, prima: i }); for (const l of perAncora.get(i) ?? []) attesa.push({ pulita: l }); });

const griglia = (pts) => { const g = new Map(); for (const p of pts) { const k = Math.floor(p[0] / 4) + ',' + Math.floor(p[1] / 4); if (!g.has(k)) g.set(k, []); g.get(k).push(p); } return g; };
const vicino = (p, g, r) => { const X = Math.floor(p[0] / 4), Y = Math.floor(p[1] / 4); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of g.get((X + a) + ',' + (Y + b)) ?? []) if (d(p, q) < r) return true; return false; };
const campiona = (p) => { const o = []; for (let i = 1; i < p.length; i++) { const l = d(p[i - 1], p[i]); if (l > 4) continue; const n = Math.max(1, Math.ceil(l / 0.5)); for (let k = 0; k < n; k++) o.push([p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * k) / n, p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * k) / n]); } return o; };

let identici = 0, oltre = 0, puntiPulite = 0, aZero = 0;
const cambiati = [], peggiori = [];
attesa.forEach((a, i) => {
  const r = letti[i];
  if (a.pulita) {
    if (!r.conta) aZero++;
    const g = griglia(campiona(pulita.objects[a.pulita.origine].stitching_path.points.map(mm)));
    let e = 0;
    for (const q of r.punti) if (!vicino([q[0] / 1000, q[1] / 1000], g, 3.5)) e++;
    oltre += e; puntiPulite += r.conta;
    if (e) peggiori.push([a.pulita.origine, e, r.conta]);
    return;
  }
  const v = lavoro.letti[a.prima];
  if (r.conta === v.conta && r.punti.every((q, k) => q[0] === v.punti[k][0] && q[1] === v.punti[k][1])) identici++;
  else cambiati.push([a.prima, v.conta, r.conta]);
});
// le linee nuove che restano appese: nessuna catenella pulita o intera vicino a uno dei capi
const cucite = griglia(attesa.flatMap((a, i) => {
  const o = a.indice != null ? doc.objects[a.indice] : null;
  return a.pulita || (o && eCatenella(o)) ? campiona(letti[i].punti.map((q) => [q[0] / 1000, q[1] / 1000])) : [];
}));
let appese = 0, lineeN = 0;
const appeseDove = [];
attesa.forEach((a, i) => {
  if (!a.nome?.startsWith('catenella')) return;
  lineeN++;
  const p = letti[i].punti.map((q) => [q[0] / 1000, q[1] / 1000]);
  if (!vicino(p[0], cucite, 2) || !vicino(p.at(-1), cucite, 2)) { appese++; appeseDove.push([i, tondo(p[0]), tondo(p.at(-1))]); }
});
const esito = { oggetti: { prima: lavoro.attesa.length, attesi: attesa.length, ora: ora2.oggetti }, identici_a_prima: identici, cambiati: cambiati.length, cambiati_primi: cambiati.slice(0, 8),
  pulite: { catenelle: daTogliere.length, tratti: programma.length, a_zero_punti: aZero, punti: puntiPulite, punti_oltre_3_5_mm: oltre, peggiori: peggiori.sort((x, y) => y[1] - x[1]).slice(0, 8) },
  linee_nuove: { totale: lineeN, con_un_capo_lontano_dalla_rete: appese, dove: appeseDove.slice(0, 10) }, secondi: Math.round((Date.now() - inizio) / 1000), errori: errori.length };
console.log(JSON.stringify(esito, null, 1));
writeFileSync(join(cartella, 'pulizia-esito.json'), JSON.stringify({ esito, letti: letti.map((r) => ({ conta: r.conta, punti: r.punti })), attesa }));

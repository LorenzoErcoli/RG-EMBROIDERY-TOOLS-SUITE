// Infittisce UN modulo della rete di riferimento (2026-11-03, Lorenzo: «ok lasciale intere, prova su un modulo»): 2 basi, 1 passaggio,
// 1 catenella per ogni linea della versione C, su una COPIA aperta in una finestra della chat.
//
//   basi:      i loro punti restano tutti, nello stesso ordine; dove la base passa da un capo della linea va all'altro e
//              torna (POST /riscrivi-punti, senza ricalcolo: una base ricalcolata in 3.3 cambia tutti i punti);
//   catenelle: alla giunzione da cui parte la linea entrano passaggio e catenella nuova, copie di oggetti del modulo
//              calcolate da Stilista (POST /running); gli oggetti che c'erano non si dividono e non si ricalcolano.
//
// Con «tutti» al posto del primo oggetto lavora su tutti i moduli che hanno linee (il verde intero).
// Scrive in <cartella>/modulo-<primo>.json quello che è stato fatto e i controlli.
//
// Uso:  node strumenti-sviluppo/stilista-prove/infittisci-modulo.mjs <cartella con corrente.json e linee-C.json> <primo oggetto del modulo> <porta> <titolo della copia> [prova|manda]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, primo, porta, titolo, modo = 'prova'] = process.argv.slice(2);
const doc = JSON.parse(readFileSync(join(cartella, 'corrente.json'), 'utf8'));
const { linee } = JSON.parse(readFileSync(join(cartella, 'linee-C.json'), 'utf8'));
const blocchi = primo === 'tutti' ? doc.needle_blocks.filter((b) => b.needle !== 2) : doc.needle_blocks.filter((b) => b.first_object_index === Number(primo));
if (!blocchi.length) throw new Error('nessun modulo comincia da ' + primo);
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tondo = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);
const eCatenella = (o) => o.kind === 'running' && o.source_path.point_count < 20 && doc.parameter_sets[o.serialized_parameter_index].values[37] === 32;
const ePassaggio = (o) => o.kind === 'running' && o.source_path.point_count < 20 && o.serialized_parameter_index === 1;
const eBase = (o) => o.kind === 'running' && o.source_path.point_count >= 100;

function proietta(q, t) {
  let e = Infinity, dove = 0, s = 0;
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]), dx = t[i][0] - t[i - 1][0], dy = t[i][1] - t[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((q[0] - t[i - 1][0]) * dx + (q[1] - t[i - 1][1]) * dy) / (l * l))) : 0;
    const x = d(q, [t[i - 1][0] + dx * f, t[i - 1][1] + dy * f]);
    if (x < e) { e = x; dove = s + f * l; }
    s += l;
  }
  return { e, s: dove };
}
function ricampiona(t, passo) {
  const out = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / passo));
    for (let k = 1; k <= n; k++) out.push([t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n]);
  }
  return out;
}
/** Il tratto di punti cuciti su cui cade q: dopo quel punto entra la deviazione. Mai un buco lasciato dalla pulizia. */
function trattoCucito(q, punti) {
  let best = null, e = 0.5;
  for (let i = 1; i < punti.length; i++) {
    const l = d(punti[i - 1], punti[i]);
    if (l > 4) continue;
    const dx = punti[i][0] - punti[i - 1][0], dy = punti[i][1] - punti[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((q[0] - punti[i - 1][0]) * dx + (q[1] - punti[i - 1][1]) * dy) / (l * l))) : 0;
    const x = d(q, [punti[i - 1][0] + dx * f, punti[i - 1][1] + dy * f]);
    if (x < e) { e = x; best = i - 1; }
  }
  return best;
}

const programma = [], nuoveBasi = [];
let lineeTrovate = 0, lineePronte = 0, mmLinee = 0;
for (const blocco of blocchi) {
const oggetti = doc.objects.slice(blocco.first_object_index, blocco.last_object_index + 1);
// le giunzioni del modulo: dove un oggetto finisce e il dopo comincia
const giunzioni = [];
for (let i = 1; i < oggetti.length; i++) {
  const a = oggetti[i - 1], b = oggetti[i];
  if ((eCatenella(a) || ePassaggio(a)) && (eCatenella(b) || ePassaggio(b))) giunzioni.push({ dopo: a.index, p: mm(a.source_path.points.at(-1)) });
}
const delModulo = linee.map((l) => ({ l, g: giunzioni.find((g) => d(g.p, l[0]) < 0.01) })).filter((x) => x.g);
if (!delModulo.length) continue;

// il modello della catenella nuova: la più comune del modulo
const quante = {};
for (const o of oggetti.filter(eCatenella)) quante[o.serialized_parameter_index] = (quante[o.serialized_parameter_index] ?? 0) + 1;
const insieme = Number(Object.entries(quante).sort((a, b) => b[1] - a[1])[0][0]);
const modelloCatenella = oggetti.find((o) => eCatenella(o) && o.serialized_parameter_index === insieme).index;
const modelloPassaggio = oggetti.find(ePassaggio).index;

// la base di ogni linea: la prima del modulo cucita su uno dei due capi
const basi = oggetti.filter(eBase).map((o) => ({ o, t: o.source_path.points.map(mm), punti: o.stitching_path.points.map(mm), deviazioni: [] }));
const senzaBase = [];
for (const x of delModulo) {
  let fatta = false;
  for (const b of basi) {
    for (const lin of [x.l, [...x.l].reverse()]) {
      const j = trattoCucito(lin[0], b.punti);
      const r = proietta(lin[0], b.t);
      if (j != null && r.e < 0.3) { b.deviazioni.push({ j, s: r.s, lin }); fatta = true; break; }
    }
    if (fatta) break;
  }
  if (!fatta) senzaBase.push(x);
}
const pronte = delModulo.filter((x) => !senzaBase.includes(x));
console.log(`modulo ago ${blocco.needle}, oggetti ${blocco.first_object_index}–${blocco.last_object_index}: ${delModulo.length} linee, ${pronte.length} con la base, ${senzaBase.length} senza · catenella modello ${modelloCatenella}, passaggio modello ${modelloPassaggio}`);

// le basi nuove: i punti vecchi con le deviazioni in mezzo, e il tracciato con le stesse deviazioni
const basiDelModulo = basi.filter((b) => b.deviazioni.length).map((b) => {
  const perPunto = [...b.deviazioni].sort((x, y) => x.j - y.j);
  const punti = [];
  let k = 0;
  b.punti.forEach((p, i) => {
    punti.push(p);
    while (k < perPunto.length && perPunto[k].j === i) {
      const { lin } = perPunto[k++];
      punti.push(lin[0], ...ricampiona(lin, 2.5).slice(1), ...ricampiona([...lin].reverse(), 2.5).slice(1));
    }
  });
  const perTracciato = [...b.deviazioni].sort((x, y) => x.s - y.s);
  const contorno = [b.t[0]];
  let c = 0, m = 0;
  for (let i = 1; i < b.t.length; i++) {
    const l = d(b.t[i - 1], b.t[i]);
    while (m < perTracciato.length && perTracciato[m].s <= c + l) {
      const { s, lin } = perTracciato[m++];
      const f = l ? (s - c) / l : 0;
      contorno.push([b.t[i - 1][0] + (b.t[i][0] - b.t[i - 1][0]) * f, b.t[i - 1][1] + (b.t[i][1] - b.t[i - 1][1]) * f], ...lin.slice(1), ...[...lin].reverse());
    }
    contorno.push(b.t[i]);
    c += l;
  }
  return { indice: b.o.index, vecchi: b.punti.length, deviazioni: b.deviazioni.length, contorno_mm: contorno.map(tondo), punti_mm: punti.map(tondo) };
});
for (const b of basiDelModulo) { nuoveBasi.push(b); console.log(`  base ${b.indice}: ${b.deviazioni} deviazioni, punti ${b.vecchi} → ${b.punti_mm.length}`); }

// passaggio e catenella alle giunzioni, dall'ultima alla prima: un inserimento sposta solo gli indici dopo di lui
for (const x of [...pronte].sort((a, b) => b.g.dopo - a.g.dopo)) {
  programma.push({ modello: modelloPassaggio, dopo: x.g.dopo, contorno_mm: x.l.map(tondo), nome: `passaggio ${x.g.dopo}` });
  programma.push({ modello: modelloCatenella, dopo: x.g.dopo, contorno_mm: [...x.l].reverse().map(tondo), nome: `catenella ${x.g.dopo}` });
}
lineeTrovate += delModulo.length; lineePronte += pronte.length; mmLinee += pronte.reduce((s, x) => s + lunghezza(x.l), 0);
}
programma.sort((a, b) => b.dopo - a.dopo); // stabile: dentro una giunzione l'ordine resta
console.log(`in tutto ${lineePronte} linee su ${lineeTrovate}, ${programma.length} oggetti nuovi, ${Math.round(mmLinee)} mm di linee, ${nuoveBasi.length} basi da modificare`);
if (modo !== 'manda') process.exit(0);

// ---- in Stilista ----
const base_ = `http://127.0.0.1:${porta}`;
const stato = await (await fetch(`${base_}/stato`)).json();
if (!stato.documento.includes(titolo) || !/rg-stilista-link/.test(stato.documento)) throw new Error('non è la copia della chat: ' + stato.documento);
if (stato.oggetti !== doc.objects.length) throw new Error(`la copia ha ${stato.oggetti} oggetti, il riferimento ${doc.objects.length}`);
const posta = async (via, c) => (await fetch(base_ + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(c) })).json();
const leggiTutto = async (n) => {
  const out = [];
  for (let i = 0; i < n; i += 250) {
    const ids = [];
    for (let k = i; k < Math.min(i + 250, n); k++) ids.push(k);
    out.push(...(await (await fetch(`${base_}/punti-cuciti?oggetti=${ids.join(',')}`)).json()).oggetti);
  }
  return out;
};
const inizio = Date.now();
const errori = [];
const riscritte = await posta('/riscrivi-punti', { oggetti: nuoveBasi.map(({ indice, contorno_mm, punti_mm }) => ({ indice, contorno_mm, punti_mm })) });
const ancore = [...new Set(programma.map((l) => l.dopo))].sort((a, b) => b - a);
for (const a of ancore) {
  const r = await posta('/running', { linee: programma.filter((l) => l.dopo === a) });
  if (r.errori?.length) errori.push(...r.errori.map((e) => `dopo ${a}: ${e}`));
}
console.log(`in Stilista: ${((Date.now() - inizio) / 1000).toFixed(0)} s, errori ${errori.length}`, errori.slice(0, 5));
console.log('basi riscritte con punti diversi dai chiesti:', riscritte.oggetti.filter((o) => o.chiesti !== o.dopo_1500_ms || o.errore).length, 'su', riscritte.oggetti.length);

// ---- i controlli, dopo un'attesa: Stilista può ricalcolare da sé ----
await new Promise((r) => setTimeout(r, 15000));
const ora = await (await fetch(`${base_}/stato`)).json();
const letti = await leggiTutto(ora.oggetti);
const attesa = [];
const perAncora = new Map();
for (const l of programma) { if (!perAncora.has(l.dopo)) perAncora.set(l.dopo, []); perAncora.get(l.dopo).push(l); }
for (const o of doc.objects) { attesa.push({ o }); for (const l of perAncora.get(o.index) ?? []) attesa.push({ l }); }
const riscritti = new Map(nuoveBasi.map((b) => [b.indice, b]));
let identici = 0;
const cambiati = [], vuoti = [], basiEsito = [];
const nuovi = { passaggio: [], catenella: [] };
const raccordi = { 'oggetto>passaggio': [], 'passaggio>catenella': [], 'catenella>oggetto o passaggio': [] };
const guide = doc.objects.filter((o) => o.kind === 'manual').length;
attesa.forEach((a, i) => {
  const r = letti[i];
  if (a.o) {
    if (a.o.kind === 'manual') return; // le guide e i laser non hanno punti cuciti da confrontare
    const v = a.o.stitching_path.points;
    if (riscritti.has(a.o.index)) {
      let k = 0;
      for (const q of r.punti) if (k < v.length && Math.abs(q[0] - v[k].x_um) <= 1 && Math.abs(q[1] - v[k].y_um) <= 1) k++;
      basiEsito.push({ indice: a.o.index, punti: r.conta, chiesti: riscritti.get(a.o.index).punti_mm.length, vecchi_ritrovati: k, vecchi: v.length });
    } else if (r.conta === v.length && r.punti.every((q, k) => q[0] === v[k].x_um && q[1] === v[k].y_um)) identici++;
    else cambiati.push([a.o.index, v.length, r.conta]);
    return;
  }
  const tipo = a.l.nome.split(' ')[0];
  nuovi[tipo].push(r.conta);
  if (!r.conta) vuoti.push(i);
  const prima = letti[i - 1], dopo = letti[i + 1];
  const g = (x, y) => (x?.punti?.length && y?.punti?.length ? Math.hypot(x.punti.at(-1)[0] - y.punti[0][0], x.punti.at(-1)[1] - y.punti[0][1]) / 1000 : null);
  if (tipo === 'passaggio') { const x = g(prima, r); if (x != null) raccordi[attesa[i - 1].l ? 'catenella>oggetto o passaggio' : 'oggetto>passaggio'].push(x); }
  else { const x = g(prima, r); if (x != null) raccordi['passaggio>catenella'].push(x); const y = g(r, dopo); if (y != null && !attesa[i + 1]?.l) raccordi['catenella>oggetto o passaggio'].push(y); }
});
const sommario = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? `${s.length} · mediana ${s[s.length >> 1].toFixed(2)} · max ${s.at(-1).toFixed(2)} mm` : 'nessuno'; };
const somma = (v) => v.reduce((s, x) => s + x, 0);
const esito = { oggetti: { prima: doc.objects.length, attesi: attesa.length, ora: ora.oggetti }, identici, cambiati: cambiati.length, cambiati_primi: cambiati.slice(0, 8), guide_non_confrontate: guide, basi: basiEsito,
  nuovi: { passaggi: nuovi.passaggio.length, punti_passaggi: somma(nuovi.passaggio), catenelle: nuovi.catenella.length, punti_catenelle: somma(nuovi.catenella), a_zero_punti: vuoti.length },
  raccordi: Object.fromEntries(Object.entries(raccordi).map(([k, v]) => [k, sommario(v)])), secondi: Math.round((Date.now() - inizio) / 1000), senza_base: lineeTrovate - lineePronte };
console.log(JSON.stringify(esito, null, 1));
writeFileSync(join(cartella, `modulo-${primo}.json`), JSON.stringify({ esito, letti: letti.map((r) => ({ conta: r.conta, punti: r.punti })), attesa: attesa.map((a) => (a.o ? { indice: a.o.index } : { nome: a.l.nome })) }));

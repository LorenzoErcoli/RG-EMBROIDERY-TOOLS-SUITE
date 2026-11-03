// Una linea nuova dentro la rete di riferimento, come chiede Lorenzo (2026-11-02): «2 basi e 1 catenella con il passaggio».
// Su una COPIA aperta in una finestra della chat, senza ricalcolare niente di quello che c'è già:
//   base:      tiene tutti i suoi punti; dove passa dal capo A va a B e torna (2 fili), poi prosegue;
//   catenella: si ferma alla fine di una maglia vicino ad A, poi passaggio A→B e catenella B→A (oggetti calcolati da
//              Stilista, copie di quelli del modulo), poi riprende con le sue maglie di prima.
//
// La catenella è psil: Stilista la rifà sul suo tracciato e distribuisce le maglie sulla lunghezza. Perciò la linea nuova
// parte dal capo di una maglia: le due parti restano a maglie intere e il passo non cambia.
//
// Uso:  node strumenti-sviluppo/stilista-prove/prova-una-linea.mjs <cartella con corrente.json e linee-A.json> <porta> <titolo della copia> [catenella massima] [base da evitare]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, porta, titolo, catMax = '999999', baseNo = '-1'] = process.argv.slice(2);
const doc = JSON.parse(readFileSync(join(cartella, 'corrente.json'), 'utf8'));
const { linee } = JSON.parse(readFileSync(join(cartella, 'linee-A.json'), 'utf8'));
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tondo = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);
const eCatenella = (o) => o.kind === 'running' && o.source_path.point_count < 20 && doc.parameter_sets[o.serialized_parameter_index].values[37] === 32;
const eBase = (o) => o.kind === 'running' && o.source_path.point_count >= 100;
const ePassaggio = (o) => o.kind === 'running' && o.source_path.point_count < 20 && o.serialized_parameter_index === 1;

function proietta(q, t) {
  let e = Infinity, dove = 0, s = 0;
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]), dx = t[i][0] - t[i - 1][0], dy = t[i][1] - t[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((q[0] - t[i - 1][0]) * dx + (q[1] - t[i - 1][1]) * dy) / (l * l))) : 0;
    const x = d(q, [t[i - 1][0] + dx * f, t[i - 1][1] + dy * f]);
    if (x < e) { e = x; dove = s + f * l; }
    s += l;
  }
  return { e, s: dove, L: s };
}
function dividi(t, s) {
  const a = [t[0]], b = [];
  let c = 0, fatto = false;
  for (let i = 1; i < t.length; i++) {
    const l = d(t[i - 1], t[i]);
    if (!fatto && c + l >= s) {
      const f = l ? (s - c) / l : 0, p = [t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f];
      a.push(p); b.push(p);
      if (f < 1) b.push(t[i]);
      fatto = true;
    } else if (fatto) b.push(t[i]); else a.push(t[i]);
    c += l;
  }
  return [a, b];
}
function ricampiona(t, passo) {
  const out = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / passo));
    for (let k = 1; k <= n; k++) out.push([t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n]);
  }
  return out;
}

// la prima linea di almeno 5 mm con un capo su una base e su una catenella piena dello stesso modulo
let scelta = null;
cerca: for (const [n, l] of linee.entries()) {
  if (lunghezza(l) < 5) continue;
  for (const giro of [false, true]) {
    const lin = giro ? [...l].reverse() : l, A = lin[0];
    for (const b of doc.needle_blocks) {
      if (b.needle === 2) continue;
      const og = doc.objects.slice(b.first_object_index, b.last_object_index + 1);
      const base = og.filter(eBase).find((o) => o.index !== Number(baseNo) && proietta(A, o.source_path.points.map(mm)).e < 0.3);
      if (!base) continue;
      const passaggio = og.find(ePassaggio);
      for (const o of og.filter((c) => eCatenella(c) && c.index < Number(catMax))) {
        const t = o.source_path.points.map(mm), r = proietta(A, t);
        if (r.e < 0.1 && r.s > 6 && r.L - r.s > 6) { scelta = { n, lin, A, base, cat: o, passaggio, r, t }; break cerca; }
      }
    }
  }
}
if (!scelta) throw new Error('nessuna linea adatta');
const { base, cat, passaggio, t } = scelta;
const vecchiC = cat.stitching_path.points.map(mm);
// il capo di maglia più vicino al capo della linea: lì si taglia, e la linea parte da lì
let taglio = 7, meglio = Infinity;
for (let i = 7; i + 7 < vecchiC.length; i += 7) { const x = d(vecchiC[i], scelta.A); if (x < meglio) { meglio = x; taglio = i; } }
const A = vecchiC[taglio];
const lin = [A, ...scelta.lin.slice(1)];
const r = proietta(A, t);
const B = lin.at(-1);
console.log(`capo della linea spostato di ${meglio.toFixed(2)} mm sul capo di maglia`);
console.log(`linea ${scelta.n}, ${lunghezza(lin).toFixed(1)} mm · ago ${cat.needle} · base ${base.index} · catenella ${cat.index} (${cat.stitch_count} punti) · passaggio modello ${passaggio.index}`);

// ---- la base: i suoi punti, più la deviazione ----
const tb = base.source_path.points.map(mm), rb = proietta(A, tb);
const vecchiB = base.stitching_path.points.map(mm);
let j = 0, e = Infinity;
vecchiB.forEach((p, i) => { const x = d(p, A); if (x < e) { e = x; j = i; } });
const andata = ricampiona(lin, 2.5).slice(1), ritorno = ricampiona([...lin].reverse(), 2.5).slice(1);
const puntiBase = [...vecchiB.slice(0, j + 1), A, ...andata, ...ritorno, ...vecchiB.slice(j + 1)].map(tondo);
const [ba, bb] = dividi(tb, rb.s);
const contornoBase = [...ba, ...lin.slice(1), ...[...lin].reverse().slice(1), ...bb.slice(1)].map(tondo);
console.log(`base: punto più vicino ad A a ${e.toFixed(2)} mm, da ${vecchiB.length} a ${puntiBase.length} punti`);

// ---- la catenella: si ferma alla fine della maglia prima di A ----
const parte1 = vecchiC.slice(0, taglio), parte2 = vecchiC.slice(taglio);
const [ca, cb] = dividi(t, r.s);
console.log(`catenella: ${parte1.length} + ${parte2.length} punti, fine maglia a ${d(parte1.at(-1), A).toFixed(2)} mm da A, ripresa a ${d(parte2[0], A).toFixed(2)} mm da A`);

const base_ = `http://127.0.0.1:${porta}`;
const stato = await (await fetch(`${base_}/stato`)).json();
if (!stato.documento.includes(titolo) || !/rg-stilista-link/.test(stato.documento)) throw new Error('non è la copia della chat: ' + stato.documento);
const posta = async (via, c) => (await fetch(base_ + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(c) })).json();
const leggi = async (ids) => (await (await fetch(`${base_}/punti-cuciti?oggetti=${ids.join(',')}`)).json()).oggetti;

// dall'ultimo al primo: un inserimento sposta solo gli indici dopo di lui
const k = cat.index;
let x = await posta('/running', { linee: [
  { modello: passaggio.index, dopo: k, contorno_mm: lin, nome: 'passaggio linea nuova' },
  { modello: k, dopo: k, contorno_mm: [...lin].reverse(), nome: 'catenella linea nuova' },
] });
console.log('passaggio e catenella:', JSON.stringify(x.dettaglio), x.errori);
x = await posta('/running', { ricalcola: false, linee: [{ modello: k, dopo: k + 2, contorno_mm: cb.map(tondo), nome: 'catenella ripresa' }] });
console.log('copia per la ripresa:', JSON.stringify(x.dettaglio), x.errori);
x = await posta('/riscrivi-punti', { oggetti: [
  { indice: k + 3, contorno_mm: cb.map(tondo), punti_mm: parte2.map(tondo) },
  { indice: k, contorno_mm: ca.map(tondo), punti_mm: parte1.map(tondo) },
  { indice: base.index, contorno_mm: contornoBase, punti_mm: puntiBase },
] });
console.log('riscrittura:', JSON.stringify(x.oggetti));

// ---- il controllo ----
const [lb] = await leggi([base.index]);
const inUm = (t2) => t2.map((p) => [Math.round(p[0] * 1000), Math.round(p[1] * 1000)]);
const atteso = inUm(puntiBase);
const uguali = lb.punti.filter((p, i) => atteso[i] && Math.abs(p[0] - atteso[i][0]) <= 1 && Math.abs(p[1] - atteso[i][1]) <= 1).length;
console.log(`base: ${lb.conta} punti, come chiesti ${uguali}/${atteso.length}`);
const catena = await leggi([k - 1, k, k + 1, k + 2, k + 3, k + 4]);
const nomi = ['prima', 'parte1', 'passaggio', 'catenella nuova', 'ripresa', 'dopo'];
const salti = catena.slice(1).map((o, i) => `${nomi[i]}>${nomi[i + 1]} ${(Math.hypot(catena[i].punti.at(-1)[0] - o.punti[0][0], catena[i].punti.at(-1)[1] - o.punti[0][1]) / 1000).toFixed(2)}`);
console.log('punti', catena.map((o) => o.conta).join(','), '· aghi', catena.map((o) => o.ago).join(','));
console.log('raccordi:', salti.join(' · '));
const giaPrima = [d(mm(doc.objects[k - 1].stitching_path.points.at(-1)), vecchiC[0]), d(vecchiC.at(-1), mm(doc.objects[k + 1].stitching_path.points[0]))];
console.log(`nel file di prima: prima>catenella ${giaPrima[0].toFixed(2)} · catenella>dopo ${giaPrima[1].toFixed(2)}`);
const c1 = inUm(parte1), c2 = inUm(parte2);
const uguale = (o, a) => o.punti.filter((p, i) => a[i] && Math.abs(p[0] - a[i][0]) <= 1 && Math.abs(p[1] - a[i][1]) <= 1).length;
console.log(`catenella di prima: parte1 ${uguale(catena[1], c1)}/${c1.length}, ripresa ${uguale(catena[4], c2)}/${c2.length}`);
console.log('INDICI', JSON.stringify({ base: base.index, k, A, B }));

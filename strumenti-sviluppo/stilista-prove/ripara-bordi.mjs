// I passaggi lunghi lasciati dalla pulizia della rete di riferimento diventano punti lungo il bordo (2026-11-03, Lorenzo: «quando pulisci
// potresti inserire punti sui bordi per evitare passaggi o salti troppo lunghi?»). Su una COPIA.
//
// Il bordo è la guida 3776: 270 capi su 314 dei buchi nelle basi stanno entro 3 mm. Un movimento oltre SOGLIA diventa: dal suo capo al
// bordo, lungo il bordo dalla parte più corta, dal bordo all'altro capo, a punti ≤ 2,5 mm. Si tocca solo se tutti e due i capi sono
// entro VICINO dal bordo (i movimenti lontani sono del disegno, non della pulizia) e se la strada non è troppo più lunga. In cima al
// pannello (y < CIMA) non si tocca niente: lì la pulizia non c'entra.
//
// Lorenzo, 2026-11-03: «così batte troppo negli stessi punti … puoi fare anche dei passaggi più esterni al bordo effettivo». Ogni strada
// ha la sua corsia FUORI dal bordo: la prima libera su tutto il suo tratto, a PRIMA_CORSIA mm, poi una ogni PASSO_CORSIA mm.
//   dentro un oggetto (basi, passaggi): POST /riscrivi-punti, i punti vecchi restano tutti;
//   fra due oggetti: un passaggio nuovo in mezzo, copia di uno del modulo (POST /running).
//
// Uso:  node strumenti-sviluppo/stilista-prove/ripara-bordi.mjs <cartella> <porta> <titolo della copia> [prova|manda] [primo modulo]
//       in <cartella>: corrente.json, pulizia-esito.json. Con il primo oggetto di un modulo lavora solo su quello.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cartella, porta, titolo, modo = 'prova', soloModulo] = process.argv.slice(2);
const leggi = (f) => JSON.parse(readFileSync(join(cartella, f), 'utf8'));
const doc = leggi('corrente.json'), { letti, attesa } = leggi('pulizia-esito.json');
const mm = (q) => [q[0] / 1000, q[1] / 1000];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tondo = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0);
const SOGLIA = 4, VICINO = 10, PASSO = 2.5, CIMA = 100, PRIMA_CORSIA = 1, PASSO_CORSIA = 1, CORSIE = 12;

const eCatenella = (o) => o.kind === 'running' && o.source_path.point_count < 20 && doc.parameter_sets[o.serialized_parameter_index].values[37] === 32;
const ePassaggio = (o) => o.kind === 'running' && o.source_path.point_count < 20 && o.serialized_parameter_index === 1;
const eBase = (o) => o.kind === 'running' && o.source_path.point_count >= 100;
const genere = (a) => (a.pulita ? 'catenella' : a.nome ? (a.nome[0] === 'p' ? 'passaggio' : 'catenella') : eCatenella(doc.objects[a.indice]) ? 'catenella' : ePassaggio(doc.objects[a.indice]) ? 'passaggio' : eBase(doc.objects[a.indice]) ? 'base' : 'altro');
// l'indice nel file di partenza dell'oggetto, per sapere il modulo
const origine = (a) => (a.pulita ? a.pulita.origine : a.indice ?? Number(a.nome.split(' ')[1]));
const bloccoDi = (i) => doc.needle_blocks.find((b) => i >= b.first_object_index && i <= b.last_object_index);

// ---- il bordo ----
const anello = doc.objects[3776].source_path.points.map((q) => [q.x_um / 1000, q.y_um / 1000]);
const lunghi = [0];
for (let i = 1; i < anello.length; i++) lunghi.push(lunghi[i - 1] + d(anello[i - 1], anello[i]));
const giro = lunghi.at(-1);
function sulBordo(q) {
  let e = Infinity, s = 0, p = null;
  for (let i = 1; i < anello.length; i++) {
    const l = d(anello[i - 1], anello[i]), dx = anello[i][0] - anello[i - 1][0], dy = anello[i][1] - anello[i - 1][1];
    const f = l ? Math.max(0, Math.min(1, ((q[0] - anello[i - 1][0]) * dx + (q[1] - anello[i - 1][1]) * dy) / (l * l))) : 0;
    const c = [anello[i - 1][0] + dx * f, anello[i - 1][1] + dy * f], x = d(q, c);
    if (x < e) { e = x; s = lunghi[i - 1] + f * l; p = c; }
  }
  return { e, s, p };
}
/** I vertici del bordo fra due posizioni, dalla parte più corta. */
function arco(a, b) {
  const avanti = ((b.s - a.s) % giro + giro) % giro;
  const out = [];
  if (avanti <= giro - avanti) {
    for (let i = 0; i < anello.length; i++) if ((((lunghi[i] - a.s) % giro) + giro) % giro < avanti) out.push({ k: ((lunghi[i] - a.s) % giro + giro) % giro, p: anello[i] });
    out.sort((x, y) => x.k - y.k);
  } else {
    const dietro = giro - avanti;
    for (let i = 0; i < anello.length; i++) if (((a.s - lunghi[i]) % giro + giro) % giro < dietro) out.push({ k: ((a.s - lunghi[i]) % giro + giro) % giro, p: anello[i] });
    out.sort((x, y) => x.k - y.k);
  }
  return out.map((x) => x.p);
}
// verso fuori: dipende da come gira l'anello
const areaFirmata = anello.reduce((s, p, i) => { const q = anello[(i + 1) % anello.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const fuori = areaFirmata > 0 ? 1 : -1;
function normaleA(s) {
  const a = ((s - 2) % giro + giro) % giro, b = ((s + 2) % giro + giro) % giro;
  const su = (x) => { let i = 1; while (i < lunghi.length - 1 && lunghi[i] < x) i++; const l = lunghi[i] - lunghi[i - 1] || 1, f = (x - lunghi[i - 1]) / l; return [anello[i - 1][0] + (anello[i][0] - anello[i - 1][0]) * f, anello[i - 1][1] + (anello[i][1] - anello[i - 1][1]) * f]; };
  const p = su(a), q = su(b), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
  return [(fuori * dy) / l, (-fuori * dx) / l];
}
const dentroAnello = (p) => { let c = false; for (let i = 0, k = anello.length - 1; i < anello.length; k = i++) { const [x, y] = anello[i], [e, f] = anello[k]; if ((y > p[1]) !== (f > p[1]) && p[0] < ((e - x) * (p[1] - y)) / (f - y) + x) c = !c; } return c; };
const suAnello = (s) => { const x = ((s % giro) + giro) % giro; let i = 1; while (i < lunghi.length - 1 && lunghi[i] < x) i++; const l = lunghi[i] - lunghi[i - 1] || 1, f = (x - lunghi[i - 1]) / l; return [anello[i - 1][0] + (anello[i][0] - anello[i - 1][0]) * f, anello[i - 1][1] + (anello[i][1] - anello[i - 1][1]) * f]; };
{ // le corsie stanno FUORI: se il verso è sbagliato ci si ferma qui (2026-11-03: la prima prova le aveva messe dentro la rete)
  let sbagliate = 0;
  for (let s = 0; s < giro; s += 20) { const p = suAnello(s), n = normaleA(s); if (dentroAnello([p[0] + n[0] * PRIMA_CORSIA, p[1] + n[1] * PRIMA_CORSIA])) sbagliate++; }
  if (sbagliate > giro / 20 / 4) throw new Error('le corsie andrebbero dentro il bordo: ' + sbagliate);
}
// quali corsie sono già prese, per ogni mm di bordo
const occupate = Array.from({ length: CORSIE }, () => new Uint8Array(Math.ceil(giro) + 1));
function prendiCorsia(da, verso, lungo) {
  const bins = [];
  for (let k = 0; k <= lungo; k += 1) bins.push(Math.floor((((da + verso * k) % giro) + giro) % giro));
  let scelta = -1, meno = Infinity;
  for (let c = 0; c < CORSIE; c++) {
    let usati = 0;
    for (const b of bins) usati += occupate[c][b];
    if (usati === 0) { scelta = c; meno = 0; break; }
    if (usati < meno) { meno = usati; scelta = c; }
  }
  for (const b of bins) occupate[scelta][b] = 1;
  return scelta;
}
const corsieUsate = {};

function ricampiona(t, passo) {
  const out = [t[0]];
  for (let i = 1; i < t.length; i++) {
    const n = Math.max(1, Math.ceil(d(t[i - 1], t[i]) / passo));
    for (let k = 1; k <= n; k++) out.push([t[i - 1][0] + ((t[i][0] - t[i - 1][0]) * k) / n, t[i - 1][1] + ((t[i][1] - t[i - 1][1]) * k) / n]);
  }
  return out;
}
function strada(a, b) {
  const pa = sulBordo(a), pb = sulBordo(b);
  if (pa.e > VICINO || pb.e > VICINO) return { motivo: 'lontano dal bordo' };
  const avanti = ((pb.s - pa.s) % giro + giro) % giro;
  const verso = avanti <= giro - avanti ? 1 : -1, lungo = verso > 0 ? avanti : giro - avanti;
  const provvisoria = [a, pa.p, ...arco(pa, pb), pb.p, b];
  if (lunghezza(provvisoria) > d(a, b) * 2.5 + 10) return { motivo: 'strada troppo lunga', l: lunghezza(provvisoria), dritto: d(a, b) };
  const corsia = prendiCorsia(pa.s, verso, lungo);
  corsieUsate[corsia] = (corsieUsate[corsia] ?? 0) + 1;
  const off = PRIMA_CORSIA + corsia * PASSO_CORSIA;
  const sposta = (s) => { const p = suAnello(s), n = normaleA(s); return [p[0] + n[0] * off, p[1] + n[1] * off]; };
  const lungoLaCorsia = [];
  for (let k = 0; k <= lungo; k += 2) lungoLaCorsia.push(sposta(pa.s + verso * k));
  lungoLaCorsia.push(sposta(pb.s));
  // i due capi sono punti vecchi: restano sempre, si toglie semmai il punto della corsia troppo vicino
  const t = [a, ...lungoLaCorsia.filter((p) => d(p, a) > 0.05 && d(p, b) > 0.05), b].filter((p, i, v) => !i || i === v.length - 1 || d(p, v[i - 1]) > 0.05);
  return { t, l: lunghezza(t), dritto: d(a, b), corsia };
}

// ---- cosa cambia ----
const dentro = new Map(); // indice attuale → punti con le strade
const fra = [];
const stat = { dentro: 0, fra: 0, lontano: 0, troppo: 0, mmPrima: 0, mmDopo: 0 };
const restano = [];
const inModulo = (i) => !soloModulo || bloccoDi(origine(attesa[i]))?.first_object_index === Number(soloModulo);
letti.forEach((r, i) => {
  const g = genere(attesa[i]);
  if (g === 'altro' || !r.conta || !inModulo(i)) return;
  const p = r.punti.map(mm);
  const inCima = (q) => q[1] < CIMA;
  if (g === 'base' || g === 'passaggio') {
    const out = [p[0]];
    let cambiato = false;
    for (let k = 1; k < p.length; k++) {
      const l = d(p[k - 1], p[k]);
      if (l > SOGLIA && !inCima(p[k - 1]) && !inCima(p[k])) {
        const s = strada(p[k - 1], p[k]);
        if (s.t) { out.push(...ricampiona(s.t, PASSO).slice(1)); cambiato = true; stat.dentro++; stat.mmPrima += s.dritto; stat.mmDopo += s.l; continue; }
        stat[s.motivo === 'lontano dal bordo' ? 'lontano' : 'troppo']++;
        restano.push({ l, a: p[k - 1], b: p[k], dove: 'dentro ' + g });
      }
      out.push(p[k]);
    }
    if (cambiato) dentro.set(i, { indice: i, vecchi: p.length, punti_mm: out.map(tondo) });
  }
  const n = i + 1;
  if (n < letti.length && letti[n].conta && genere(attesa[n]) !== 'altro' && genere(attesa[n]) !== 'base' && g !== 'base' && inModulo(n)) {
    if (bloccoDi(origine(attesa[i])) !== bloccoDi(origine(attesa[n]))) return;
    const a = p.at(-1), b = mm(letti[n].punti[0]), l = d(a, b);
    if (l <= SOGLIA || inCima(a) || inCima(b)) return;
    const s = strada(a, b);
    if (s.t) {
      const blocco = bloccoDi(origine(attesa[i]));
      const modello = doc.objects.slice(blocco.first_object_index, blocco.last_object_index + 1).find(ePassaggio).index;
      // il modello adesso sta altrove: l'indice attuale del passaggio nel documento
      const ora = attesa.findIndex((x) => x.indice === modello);
      fra.push({ modello: ora, dopo: i, contorno_mm: s.t.map(tondo), nome: 'passaggio bordo' });
      stat.fra++; stat.mmPrima += s.dritto; stat.mmDopo += s.l;
    } else {
      stat[s.motivo === 'lontano dal bordo' ? 'lontano' : 'troppo']++;
      restano.push({ l, a, b, dove: 'fra oggetti' });
    }
  }
});
const s = [...restano].sort((x, y) => y.l - x.l);
console.log(`dentro basi e passaggi ${stat.dentro}, fra oggetti ${stat.fra}: da ${Math.round(stat.mmPrima)} mm in passi lunghi a ${Math.round(stat.mmDopo)} mm di punti sul bordo`);
console.log(`restano ${restano.length} movimenti oltre ${SOGLIA} mm: ${stat.lontano} lontani dal bordo, ${stat.troppo} con la strada troppo lunga; il più lungo ${s[0]?.l.toFixed(1)} mm; oltre 12,1 mm: ${s.filter((x) => x.l > 12.1).length}`);
console.log(`${dentro.size} oggetti riscritti, ${fra.length} passaggi nuovi`);
console.log(`corsie usate (strade per corsia): ${JSON.stringify(corsieUsate)} · la più esterna a ${PRIMA_CORSIA + Math.max(...Object.keys(corsieUsate).map(Number)) * PASSO_CORSIA} mm dal bordo`);
writeFileSync(join(cartella, 'ripara-restano.json'), JSON.stringify(restano));
if (modo !== 'manda') process.exit(0);

// ---- in Stilista ----
const base = `http://127.0.0.1:${porta}`;
const stato = await (await fetch(`${base}/stato`)).json();
if (!stato.documento.includes(titolo) || !/rg-stilista-link/.test(stato.documento)) throw new Error('non è la copia della chat: ' + stato.documento);
if (stato.oggetti !== attesa.length) throw new Error(`la copia ha ${stato.oggetti} oggetti, attesi ${attesa.length}`);
const posta = async (via, c) => (await fetch(base + via, { method: 'POST', headers: { 'X-RG-Link': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(c) })).json();
const inizio = Date.now();
const riscritte = await posta('/riscrivi-punti', { oggetti: [...dentro.values()].map(({ indice, punti_mm }) => ({ indice, punti_mm })) });
const errori = [];
for (const l of [...fra].sort((x, y) => y.dopo - x.dopo)) {
  const r = await posta('/running', { linee: [l] });
  if (r.errori?.length) errori.push(`dopo ${l.dopo}: ${r.errori.join(' ')}`);
}
console.log(`in Stilista ${((Date.now() - inizio) / 1000).toFixed(0)} s · errori ${errori.length}`, errori.slice(0, 5), '· riscritte diverse dai chiesti:', riscritte.oggetti.filter((o) => o.chiesti !== o.dopo_1500_ms || o.errore).length);

await new Promise((r) => setTimeout(r, 15000));
const ora = await (await fetch(`${base}/stato`)).json();
const nuovi = [];
for (let i = 0; i < ora.oggetti; i += 250) {
  const ids = [];
  for (let k = i; k < Math.min(i + 250, ora.oggetti); k++) ids.push(k);
  nuovi.push(...(await (await fetch(`${base}/punti-cuciti?oggetti=${ids.join(',')}`)).json()).oggetti);
}
const perAncora = new Map(fra.map((l) => [l.dopo, l]));
const sequenza = [];
attesa.forEach((a, i) => { sequenza.push({ prima: i }); if (perAncora.has(i)) sequenza.push({ nuovo: perAncora.get(i) }); });
let identici = 0, zero = 0;
const cambiati = [], basi = [], passi = [];
sequenza.forEach((x, i) => {
  const r = nuovi[i];
  if (x.nuovo) { if (!r.conta) zero++; return; }
  const v = letti[x.prima];
  if (dentro.has(x.prima)) {
    let k = 0;
    for (const q of r.punti) if (k < v.punti.length && Math.abs(q[0] - v.punti[k][0]) <= 1 && Math.abs(q[1] - v.punti[k][1]) <= 1) k++;
    basi.push({ indice: x.prima, chiesti: dentro.get(x.prima).punti_mm.length, ora: r.conta, vecchi_ritrovati: k, vecchi: v.conta });
  } else if (r.conta === v.conta && r.punti.every((q, k) => q[0] === v.punti[k][0] && q[1] === v.punti[k][1])) identici++;
  else cambiati.push([x.prima, v.conta, r.conta]);
});
const esito = { oggetti: { prima: attesa.length, attesi: sequenza.length, ora: ora.oggetti }, identici, cambiati: cambiati.length, cambiati_primi: cambiati.slice(0, 8), riscritti: basi.length,
  riscritti_giusti: basi.filter((b) => b.chiesti === b.ora && b.vecchi_ritrovati === b.vecchi).length, passaggi_nuovi: fra.length, a_zero_punti: zero, errori: errori.length };
console.log(JSON.stringify(esito, null, 1));
writeFileSync(join(cartella, 'ripara-esito.json'), JSON.stringify({ esito, letti: nuovi.map((r) => ({ conta: r.conta, punti: r.punti })), sequenza }));

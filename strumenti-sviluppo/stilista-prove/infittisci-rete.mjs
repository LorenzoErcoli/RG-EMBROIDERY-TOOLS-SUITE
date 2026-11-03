// Infittire una rete a catenella (2026-10-29). Lorenzo: «le aree vuote che ora si creano dovrebbero essere
// in maniera irregolare divise in due … vediamole comunque entrambe. Solo dove la rete già c'è».
//
// Legge il JSON del lettore offline (una copia del documento salvata con /salva-copia) e il contorno della zona
// (punti in mm). Disegna la rete in un raster, trova le maglie chiuse (le aree vuote circondate da linee) col
// centro dentro la zona, e ne divide ognuna in due con una linea nuova:
//   A «da lato a lato»: una linea storta e piegata che attraversa la maglia, perpendicolare al suo lato lungo;
//   B «da nodo a nodo»: la corda fra due angoli della maglia che la divide più vicino a metà;
//   C «da una giunzione»: parte da dove due oggetti della sequenza già si incontrano, così niente va diviso (2026-11-02).
// Scrive le linee nuove (mm, riferimento del documento) e un PNG per guardarle. I file del cliente restano fuori
// dal repo: si passa la cartella dove stanno.
//
// Uso:  node strumenti-sviluppo/stilista-prove/infittisci-rete.mjs <cartella con riferimento.json e zona.json> [seme]
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const cartella = process.argv[2];
let seme = Number(process.argv[3] ?? 1424);
const caso = () => ((seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648);
const tra = (a, b) => a + (b - a) * caso();

const doc = JSON.parse(readFileSync(join(cartella, 'riferimento.json'), 'utf8'));
const zona = JSON.parse(readFileSync(join(cartella, 'zona.json'), 'utf8'));
const mm = (q) => [q.x_um / 1000, q.y_um / 1000];

// le linee della rete: i tracciati delle catenelle (insieme 2) e i punti cuciti delle basi (insieme 1), senza i salti
const catenelle = doc.objects.filter((o) => o.serialized_parameter_index === 2).map((o) => o.source_path.points.map(mm));
const basi = [];
for (const o of doc.objects.filter((o) => o.serialized_parameter_index === 1)) {
  let tratto = [];
  for (const q of o.stitching_path.points) {
    const p = mm(q);
    const prima = tratto[tratto.length - 1];
    if (q.tag === -1 || (prima && Math.hypot(p[0] - prima[0], p[1] - prima[1]) > 4)) {
      if (tratto.length > 1) basi.push(tratto);
      tratto = [];
    }
    if (q.tag !== -1) tratto.push(p);
  }
  if (tratto.length > 1) basi.push(tratto);
}

const dentro = (p, poly) => {
  let c = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const [a, b] = poly[i], [e, f] = poly[k];
    if ((b > p[1]) !== (f > p[1]) && p[0] < ((e - a) * (p[1] - b)) / (f - b) + a) c = !c;
  }
  return c;
};

// ---- il raster ----
const K = 8; // pixel per mm
const MARGINE = 30;
const x0 = Math.min(...zona.map((p) => p[0])) - MARGINE, y0 = Math.min(...zona.map((p) => p[1])) - MARGINE;
const x1 = Math.max(...zona.map((p) => p[0])) + MARGINE, y1 = Math.max(...zona.map((p) => p[1])) + MARGINE;
const W = Math.ceil((x1 - x0) * K), H = Math.ceil((y1 - y0) * K);
const linea = new Uint8Array(W * H);
const px = (p) => [Math.round((p[0] - x0) * K), Math.round((p[1] - y0) * K)];
const mmDi = (X, Y) => [X / K + x0, Y / K + y0];
function traccia(punti, raggio, griglia, valore) {
  for (let i = 1; i < punti.length; i++) {
    const [ax, ay] = px(punti[i - 1]), [bx, by] = px(punti[i]);
    const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
    for (let k = 0; k <= n; k++) {
      const cx = Math.round(ax + ((bx - ax) * k) / n), cy = Math.round(ay + ((by - ay) * k) / n);
      for (let dx = -raggio; dx <= raggio; dx++) for (let dy = -raggio; dy <= raggio; dy++) {
        const X = cx + dx, Y = cy + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && dx * dx + dy * dy <= raggio * raggio) griglia[Y * W + X] = valore;
      }
    }
  }
}
for (const t of [...catenelle, ...basi]) traccia(t, 3, linea, 1); // 0,4 mm: chiude i piccoli spazi ai nodi

// ---- le maglie: le aree vuote chiuse ----
const etichetta = new Int32Array(W * H).fill(-1);
const maglie = [];
for (let s = 0; s < W * H; s++) {
  if (linea[s] || etichetta[s] >= 0) continue;
  const id = maglie.length, pila = [s], pixel = [];
  let bordo = false;
  etichetta[s] = id;
  while (pila.length) {
    const i = pila.pop();
    pixel.push(i);
    const X = i % W, Y = (i / W) | 0;
    if (X === 0 || Y === 0 || X === W - 1 || Y === H - 1) bordo = true;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= W * H || linea[j] || etichetta[j] >= 0) continue;
      if ((j === i - 1 && X === 0) || (j === i + 1 && X === W - 1)) continue;
      etichetta[j] = id;
      pila.push(j);
    }
  }
  maglie.push({ id, pixel, bordo });
}

const chiuse = [];
for (const m of maglie) {
  const area = m.pixel.length / (K * K);
  if (m.bordo || area < 12) continue; // aperta verso fuori (dove la rete non c'è), o una scheggia fra due linee
  let sx = 0, sy = 0;
  for (const i of m.pixel) { sx += i % W; sy += (i / W) | 0; }
  const c = mmDi(sx / m.pixel.length, sy / m.pixel.length);
  if (!dentro(c, zona)) continue;
  let xx = 0, yy = 0, xy = 0;
  for (const i of m.pixel) {
    const [x, y] = mmDi(i % W, (i / W) | 0);
    xx += (x - c[0]) ** 2; yy += (y - c[1]) ** 2; xy += (x - c[0]) * (y - c[1]);
  }
  const ang = 0.5 * Math.atan2(2 * xy, xx - yy); // asse lungo
  chiuse.push({ ...m, area, c, u: [Math.cos(ang), Math.sin(ang)], v: [-Math.sin(ang), Math.cos(ang)] });
}

// ---- strumenti ----
const vuoto = (p) => { const [X, Y] = px(p); return X >= 0 && Y >= 0 && X < W && Y < H && !linea[Y * W + X]; };
/** Da p lungo d finché si tocca una linea: il punto sulla linea (mm). */
function finoAllaLinea(p, d, massimo = 60) {
  for (let t = 0; t < massimo; t += 1 / K) {
    const q = [p[0] + d[0] * t, p[1] + d[1] * t];
    if (!vuoto(q)) return q;
  }
  return null;
}
// i segmenti della rete in una griglia, per agganciare i capi al centro della linea
const segmenti = [];
for (const t of catenelle) for (let i = 1; i < t.length; i++) segmenti.push([t[i - 1], t[i]]);
const cella = new Map();
const chiave = (x, y) => Math.floor(x / 5) + ',' + Math.floor(y / 5);
segmenti.forEach((s, k) => {
  const [a, b] = s;
  for (let x = Math.floor(Math.min(a[0], b[0]) / 5); x <= Math.floor(Math.max(a[0], b[0]) / 5); x++)
    for (let y = Math.floor(Math.min(a[1], b[1]) / 5); y <= Math.floor(Math.max(a[1], b[1]) / 5); y++) {
      const c = x + ',' + y;
      if (!cella.has(c)) cella.set(c, []);
      cella.get(c).push(k);
    }
});
const vicini = (p) => {
  const [cx, cy] = [Math.floor(p[0] / 5), Math.floor(p[1] / 5)], out = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const k of cella.get(cx + dx + ',' + (cy + dy)) ?? []) out.add(k);
  return [...out];
};
function sulSegmento(p) {
  let best = null, d = 1.5;
  for (const k of vicini(p)) {
    const [a, b] = segmenti[k], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    const q = [a[0] + t * dx, a[1] + t * dy], e = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (e < d) { d = e; best = q; }
  }
  return best ?? p;
}
function sulNodo(p) {
  let best = null, d = 2.5;
  for (const k of vicini(p)) for (const q of segmenti[k]) {
    const e = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (e < d) { d = e; best = q; }
  }
  return best ?? sulSegmento(p);
}
/** La linea p→q (con i punti in mezzo) passa nella maglia? Si guardano i pixel lontani dai capi. */
function passaDentro(punti, id) {
  let fuori = 0, tot = 0;
  for (let i = 1; i < punti.length; i++) {
    const [a, b] = [punti[i - 1], punti[i]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= l; t += 0.25) {
      const q = [a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l];
      const [X, Y] = px(q), e = etichetta[Y * W + X];
      if (Math.hypot(q[0] - punti[0][0], q[1] - punti[0][1]) < 1 || Math.hypot(q[0] - punti.at(-1)[0], q[1] - punti.at(-1)[1]) < 1) continue;
      tot++;
      if (e !== id) fuori++;
    }
  }
  return tot > 0 && fuori / tot < 0.08;
}
const curva = (a, b, piega) => {
  // una linea piegata: il punto di mezzo spostato di lato, come i tratti della ragnatela
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  const c = [m[0] + n[0] * piega * l, m[1] + n[1] * piega * l];
  return [a, [(a[0] + c[0]) / 2 + n[0] * piega * l * 0.25, (a[1] + c[1]) / 2 + n[1] * piega * l * 0.25], c,
          [(c[0] + b[0]) / 2 + n[0] * piega * l * 0.25, (c[1] + b[1]) / 2 + n[1] * piega * l * 0.25], b];
};

// ---- A: da lato a lato ----
function dividiA(m) {
  const lungo = Math.sqrt(m.area);
  for (let prova = 0; prova < 12; prova++) {
    const sposta = tra(-0.18, 0.18) * lungo, giro = tra(-0.25, 0.25);
    const d = [m.v[0] * Math.cos(giro) - m.v[1] * Math.sin(giro), m.v[0] * Math.sin(giro) + m.v[1] * Math.cos(giro)];
    const p = [m.c[0] + m.u[0] * sposta, m.c[1] + m.u[1] * sposta];
    if (!vuoto(p)) continue;
    const a = finoAllaLinea(p, [-d[0], -d[1]]), b = finoAllaLinea(p, d);
    if (!a || !b) continue;
    const punti = curva(sulSegmento(a), sulSegmento(b), tra(-0.07, 0.07));
    if (passaDentro(punti, m.id)) return punti;
  }
  return null;
}

// ---- B: da nodo a nodo ----
function angoli(m) {
  // i pixel di bordo, l'inviluppo convesso, semplificato: gli angoli della maglia
  const bordo = m.pixel.filter((i) => linea[i - 1] || linea[i + 1] || linea[i - W] || linea[i + W]).map((i) => mmDi(i % W, (i / W) | 0));
  bordo.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const giro = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sotto = [], sopra = [];
  for (const p of bordo) { while (sotto.length >= 2 && giro(sotto.at(-2), sotto.at(-1), p) <= 0) sotto.pop(); sotto.push(p); }
  for (const p of [...bordo].reverse()) { while (sopra.length >= 2 && giro(sopra.at(-2), sopra.at(-1), p) <= 0) sopra.pop(); sopra.push(p); }
  let anello = sotto.slice(0, -1).concat(sopra.slice(0, -1));
  // toglie i vertici quasi in linea (angolo vicino a 180°) finché ne restano di netti
  let cambiato = true;
  while (cambiato && anello.length > 3) {
    cambiato = false;
    for (let i = 0; i < anello.length; i++) {
      const a = anello[(i + anello.length - 1) % anello.length], b = anello[i], c = anello[(i + 1) % anello.length];
      const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
      if (cos < -0.94 || Math.hypot(...v1) < 1.2) { anello.splice(i, 1); cambiato = true; break; }
    }
  }
  return anello;
}
const areaDi = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
function dividiB(m) {
  const anello = angoli(m);
  if (anello.length < 4) return dividiA(m); // un triangolo non ha due angoli opposti
  const tutta = areaDi(anello), scelte = [];
  for (let i = 0; i < anello.length; i++) for (let j = i + 2; j < anello.length; j++) {
    if (i === 0 && j === anello.length - 1) continue;
    const meta = areaDi(anello.slice(i, j + 1)) / tutta;
    scelte.push({ i, j, scarto: Math.abs(meta - 0.5) });
  }
  scelte.sort((a, b) => a.scarto - b.scarto);
  // fra le due-tre più vicine a metà se ne prende una a caso: le divisioni non vengono tutte uguali
  const buone = scelte.filter((s) => s.scarto < scelte[0].scarto + 0.08).slice(0, 3);
  for (const s of [...buone].sort(() => caso() - 0.5)) {
    const a = anello[s.i], b = anello[s.j];
    // l'angolo della maglia sta sul bordo dell'area vuota: si va fino al centro della linea, sul nodo vicino
    const punti = curva(sulNodo(a), sulNodo(b), tra(-0.06, 0.06));
    if (passaDentro(punti, m.id)) return punti;
  }
  return dividiA(m);
}

// ---- C: da una giunzione ----
// i punti dove finisce un oggetto e comincia il dopo, nello stesso ago, fra catenelle e passaggi
const collega = (o) => o.serialized_parameter_index === 2 || (o.serialized_parameter_index === 1 && o.source_path.point_count < 20);
const giuntiDi = new Map();
for (let i = 1; i < doc.objects.length; i++) {
  const a = doc.objects[i - 1], b = doc.objects[i];
  if (a.needle !== b.needle || !collega(a) || !collega(b)) continue;
  const p = mm(a.source_path.points.at(-1));
  if (p[0] < x0 || p[1] < y0 || p[0] > x1 || p[1] > y1) continue;
  const [X, Y] = px(p), viste = new Set();
  for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) {
    const e = etichetta[(Y + dy) * W + X + dx];
    if (e >= 0 && !viste.has(e)) { viste.add(e); if (!giuntiDi.has(e)) giuntiDi.set(e, []); giuntiDi.get(e).push({ p, dopo: a.index }); }
  }
}
function dividiC(m) {
  const lista = giuntiDi.get(m.id) ?? [];
  const meta = (a, b) => { // quanta area sta da una parte della corda
    let n = 0;
    for (const i of m.pixel) { const q = mmDi(i % W, (i / W) | 0); if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) > 0) n++; }
    return n / m.pixel.length;
  };
  let meglio = null, scarto = 0.27; // non più sbilanciata di 23% / 77%
  for (const g of [...lista].sort(() => caso() - 0.5)) {
    for (let prova = 0; prova < 6; prova++) {
      const l = d0(g.p, m.c), giro = tra(-0.25, 0.25);
      const u = [(m.c[0] - g.p[0]) / l, (m.c[1] - g.p[1]) / l], dir = [u[0] * Math.cos(giro) - u[1] * Math.sin(giro), u[0] * Math.sin(giro) + u[1] * Math.cos(giro)];
      const dentroQ = [g.p[0] + dir[0] * l, g.p[1] + dir[1] * l];
      if (!vuoto(dentroQ)) continue;
      const fine = finoAllaLinea(dentroQ, dir);
      if (!fine) continue;
      const punti = curva(g.p, sulSegmento(fine), tra(-0.07, 0.07));
      if (!passaDentro(punti, m.id)) continue;
      const s = Math.abs(meta(g.p, punti.at(-1)) - 0.5);
      if (s < scarto) { scarto = s; meglio = punti; }
    }
  }
  return meglio;
}
const d0 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- le versioni ----
const lunghezza = (t) => t.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - t[i - 1][0], p[1] - t[i - 1][1]) : 0), 0);
const areaZona = areaDi(zona) / 100;
const prima = catenelle.filter((t) => t.every((p) => dentro(p, zona))).reduce((s, t) => s + lunghezza(t), 0);
const esito = {};
for (const [nome, dividi] of [['A', dividiA], ['B', dividiB], ['C', dividiC]]) {
  const semeDi = seme;
  const linee = [], saltate = [];
  for (const m of chiuse) {
    const l = dividi(m);
    if (l) linee.push(l.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]));
    else saltate.push(m.c);
  }
  const aggiunti = linee.reduce((s, t) => s + lunghezza(t), 0);
  esito[nome] = { maglie: chiuse.length, linee: linee.length, saltate: saltate.length, mm_nuovi: Math.round(aggiunti),
    mm_per_cm2_prima: +(prima / areaZona).toFixed(1), mm_per_cm2_dopo: +((prima + aggiunti) / areaZona).toFixed(1) };
  writeFileSync(join(cartella, `linee-${nome}.json`), JSON.stringify({ versione: nome, seme: semeDi, linee }, null, 0));
  disegna(join(cartella, `infittita-${nome}.png`), linee, saltate, [x0, y0, x1, y1], 4);
  // un dettaglio, a sinistra dell'incavo: 70 × 45 mm
  disegna(join(cartella, `infittita-${nome}-dettaglio.png`), linee, saltate, [x0 + 70, y0 + 75, x0 + 140, y0 + 120], 20);
}
console.log(JSON.stringify(esito, null, 1));

// ---- il PNG: la rete com'è (rosa), le linee nuove (blu scuro), la zona (arancio) ----
function disegna(file, linee, saltate, [x0, y0, x1, y1], S) {
  const w = Math.ceil((x1 - x0) * S), h = Math.ceil((y1 - y0) * S), b = Buffer.alloc(w * h * 3, 255);
  const metti = (pts, col, r) => {
    for (let i = 1; i < pts.length; i++) {
      const ax = (pts[i - 1][0] - x0) * S, ay = (pts[i - 1][1] - y0) * S, bx = (pts[i][0] - x0) * S, by = (pts[i][1] - y0) * S;
      const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
      for (let k = 0; k <= n; k++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const X = Math.round(ax + ((bx - ax) * k) / n) + dx, Y = Math.round(ay + ((by - ay) * k) / n) + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h) { const i = (Y * w + X) * 3; b[i] = col[0]; b[i + 1] = col[1]; b[i + 2] = col[2]; }
      }
    }
  };
  for (const t of catenelle) metti(t, [232, 150, 140], 1);
  metti([...zona, zona[0]], [255, 150, 0], 1);
  for (const t of linee) metti(t, [20, 40, 140], 1);
  for (const c of saltate) metti([[c[0] - 1, c[1] - 1], [c[0] + 1, c[1] + 1]], [0, 160, 0], 2);
  const riga = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) b.copy(riga, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (d) => { let c = 0xffffffff; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const pezzo = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', ih), pezzo('IDAT', deflateSync(riga)), pezzo('IEND', Buffer.alloc(0))]));
}

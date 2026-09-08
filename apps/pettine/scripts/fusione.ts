// LA FUSIONE FRA I DUE MURI: linee lisce, sinuose, senza epicentri.
//
// Lorenzo, sulle linee nude: «il problema sono proprio le linee, da quelle iniziali a quelle finali.
// Stai creando delle linee iniziali piene di insenature e poco lisce: devono essere super lisce,
// geometriche e sinuose. Dopo di che le curve non devono formare mai un epicentro, ma devono
// rispettarsi e creare morbidità».
//
// Due difetti, una radice. Il muro di partenza lo prendevo com'è letto dai pixel — una scalinata —
// e le linee a DISTANZA COSTANTE da un muro fanno un ventaglio attorno a ogni suo angolo, per
// definizione: è quello l'epicentro. La costruzione senza epicentri è l'oggetto fusione, che Lorenzo
// aveva nominato il primo giorno:
//
//   1. il MURO DI PARTENZA (A) è il tratto più lungo di contorno verso la tinta più chiara — per la
//      più chiara di tutte e per le isole, verso la più scura;
//   2. il MURO OPPOSTO (B) è il resto del contorno, percorso nello stesso senso;
//   3. tutti e due si LISCIANO forte (gaussiana su un raggio di qualche millimetro): diventano curve
//      geometriche, e le insenature del pixel spariscono;
//   4. le linee in mezzo sono le VIE DI MEZZO fra A e B — il punto alla frazione t fra A(u) e B(u) —
//      quindi ognuna sta fra le sue vicine e nessuna gira attorno a niente. Ne escono tante quante
//      la larghezza media divisa per il passo fra le basi.
//
// Il resto è come prima: N tinte dalla foto, sormonto a due soglie, netto o sfumato dalla foto,
// ordine dal chiaro allo scuro, la più chiara in grigio, denti dallo scuro verso il chiaro.
//
//   npx esbuild apps/pettine/scripts/fusione.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/fusione.mjs
//   SOLO_BASI=1 node --max-old-space-size=6144 apps/pettine/scripts/fusione.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato] [macchiaMin] [verso] [lisciaMm]

import { mkdirSync, writeFileSync } from 'node:fs';
import { type Point, reduceStable, rgbToHex, traceRegions } from '@rg/core';
import { larghezzaTransizione, cresciVersoISuccessivi } from '../../pittorico/src/borders.ts';
import { leggiBmp } from '../../pittorico/scripts/bmp.ts';

const LARGHEZZA_REALE_MM = 419.45;
const num = (i: number, d: number): number => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
const foto = process.argv[2];
const TINTE = Math.max(2, Math.round(num(3, 6)));
const BASI_MM = num(4, 2);
const PASSO_MM = Math.max(1, num(5, 1.5));
const DENTE_MIN = num(6, 2), DENTE_MAX = num(7, 5);
const INCL = num(8, 40);
const NETTO_MM = num(9, 2.5);
const SORM_NETTO = num(10, 0.8);
const SORM_SFUMATO = num(11, 4);
const MACCHIA_MIN_MM2 = num(12, 60);
const VERSO = num(13, 1) >= 0 ? 1 : -1;      // +1 = denti dallo scuro verso il chiaro
const LISCIA_MM = num(14, 4);                // raggio della lisciatura dei muri
const SOLO_BASI = !!process.env.SOLO_BASI;
if (!foto) { console.error('uso: node fusione.mjs <foto.bmp> ...'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- 1. la foto ridotta a N tinte ---------------------------------------------------------------
const img = leggiBmp(foto);
const mmPerPx = LARGHEZZA_REALE_MM / img.width;
const t0 = Date.now();
const rid = reduceStable(img, { colorCount: TINTE, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: MACCHIA_MIN_MM2, mmPerPx });
const W = img.width, H = img.height, N = W * H;
const lum = (c: [number, number, number]): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const ordine = rid.palette.map((_, i) => i).sort((a, b) => lum(rid.palette[b]) - lum(rid.palette[a]));
const rango = new Int8Array(rid.palette.length);
ordine.forEach((t, r) => { rango[t] = r; });
const tinta = new Int8Array(N);
for (let i = 0; i < N; i++) tinta[i] = rid.index[i] < rid.palette.length ? rango[rid.index[i]] : -1;
const colori = ordine.map((t) => rgbToHex(rid.palette[t]));
console.log(`\n${foto}\n${(W * mmPerPx).toFixed(1)} × ${(H * mmPerPx).toFixed(1)} mm · ${TINTE} tinte: ${colori.join(' · ')}`);

// --- 2. dove il bordo sfuma, misurato sulla foto ----------------------------------------------------
const sfuma = new Uint8Array(N), netto = new Uint8Array(N);
for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
  const i = y * W + x;
  if (tinta[i] < 0 || (x + y) % 3 !== 0) continue;
  let nx = 0, ny = 0;
  if (tinta[i + 1] !== tinta[i] && tinta[i + 1] >= 0) nx += 1;
  if (tinta[i - 1] !== tinta[i] && tinta[i - 1] >= 0) nx -= 1;
  if (tinta[i + W] !== tinta[i] && tinta[i + W] >= 0) ny += 1;
  if (tinta[i - W] !== tinta[i] && tinta[i - W] >= 0) ny -= 1;
  if (nx === 0 && ny === 0) continue;
  const l = Math.hypot(nx, ny);
  const tr = larghezzaTransizione(img, mmPerPx, { x: x * mmPerPx, y: y * mmPerPx }, { x: nx / l, y: ny / l }, { raggioMm: 6 });
  const s = tr !== null && tr.larghezzaMm >= NETTO_MM;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const j = (y + dy) * W + (x + dx);
    if (j >= 0 && j < N) { if (s) sfuma[j] = 1; else netto[j] = 1; }
  }
}

const cellaDi = (p: Point): number => {
  const c = Math.min(W - 1, Math.max(0, Math.round(p.x / mmPerPx)));
  const r = Math.min(H - 1, Math.max(0, Math.round(p.y / mmPerPx)));
  return r * W + c;
};
const tintaIn = (p: Point): number => {
  const c = Math.round(p.x / mmPerPx), r = Math.round(p.y / mmPerPx);
  return c < 0 || r < 0 || c >= W || r >= H ? -1 : tinta[r * W + c];
};

// --- 3. geometria: ricampionare, lisciare, fondere ----------------------------------------------------
/** Punti a passo costante lungo una polilinea (aperta). */
function ricampiona(l: Point[], passo: number): Point[] {
  const out: Point[] = [l[0]];
  let resto = 0;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let s = passo - resto;
    while (s <= d) {
      out.push({ x: a.x + ((b.x - a.x) * s) / d, y: a.y + ((b.y - a.y) * s) / d });
      s += passo;
    }
    resto = d - (s - passo);
  }
  const ultimo = l[l.length - 1];
  const fine = out[out.length - 1];
  if (Math.hypot(ultimo.x - fine.x, ultimo.y - fine.y) > passo * 0.3) out.push(ultimo);
  return out;
}

/** Lisciatura gaussiana lungo la linea: le insenature del pixel spariscono, resta la curva. */
function liscia(l: Point[], sigmaMm: number, passo: number): Point[] {
  if (sigmaMm <= 0 || l.length < 3) return l;
  const raggio = Math.ceil((sigmaMm * 3) / passo);
  const pesi: number[] = [];
  for (let k = -raggio; k <= raggio; k++) pesi.push(Math.exp(-((k * passo) ** 2) / (2 * sigmaMm * sigmaMm)));
  const out: Point[] = [];
  for (let i = 0; i < l.length; i++) {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -raggio; k <= raggio; k++) {
      const j = Math.min(l.length - 1, Math.max(0, i + k));    // ai capi si ferma sul capo
      const w = pesi[k + raggio];
      sx += l[j].x * w; sy += l[j].y * w; sw += w;
    }
    out.push({ x: sx / sw, y: sy / sw });
  }
  return out;
}

/** Il punto alla frazione u (0..1) lungo una polilinea, per lunghezza d'arco. */
function lungoLaLinea(l: Point[]): (u: number) => Point {
  const cum: number[] = [0];
  for (let i = 1; i < l.length; i++) cum.push(cum[i - 1] + Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y));
  const tot = cum[cum.length - 1] || 1;
  return (u: number): Point => {
    const d = Math.min(tot, Math.max(0, u * tot));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    return { x: l[i - 1].x + (l[i].x - l[i - 1].x) * t, y: l[i - 1].y + (l[i].y - l[i - 1].y) * t };
  };
}

// --- 4. tinta per tinta: maschera allargata → macchie → i due muri → la fusione → il pettine ---------
const indiceOrdinato = new Uint8Array(N);
for (let i = 0; i < N; i++) indiceOrdinato[i] = tinta[i] < 0 ? 255 : tinta[i];
const ordineRanghi = colori.map((_, r) => r);
const perTinta: string[][] = colori.map(() => []);
const muriA: string[] = [], muriB: string[] = [];
const CW = Math.ceil(W * mmPerPx) + 1, CH = Math.ceil(H * mmPerPx) + 1;
const coperto = new Uint8Array(CW * CH);
let denti = 0, filoMm = 0, basiTot = 0, macchieTot = 0, fermati = 0, attraversano = 0;
const via = (pt: Point[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

for (let t = 0; t < colori.length; t++) {
  const mia = cresciVersoISuccessivi(indiceOrdinato, W, H, t, ordineRanghi, mmPerPx, { crescitaMm: SORM_SFUMATO, sormontoMm: SORM_NETTO, sfuma });
  const macchie = traceRegions(mia, W, H, 1, mmPerPx, { minAreaMm2: 15, simplifyMm: 0.3 });
  for (const m of macchie) {
    macchieTot++;
    // il contorno, a passo costante, e per ogni punto: di là c'è una tinta più chiara? più scura?
    const anello = ricampiona([...m.outer, m.outer[0]], 0.5);
    anello.pop();
    const n = anello.length;
    if (n < 8) continue;
    const classe = new Int8Array(n);            // +1 chiaro di là, -1 scuro di là, 0 niente
    for (let i = 0; i < n; i++) {
      const a = anello[(i + n - 1) % n], b = anello[(i + 1) % n];
      let nx = b.y - a.y, ny = -(b.x - a.x);   // normale (da orientare verso fuori)
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const p = anello[i];
      const dentro = mia[cellaDi({ x: p.x + nx * 1.5, y: p.y + ny * 1.5 })];
      if (dentro) { nx = -nx; ny = -ny; }
      const fuori = tintaIn({ x: p.x + nx * 2.5, y: p.y + ny * 2.5 });
      classe[i] = fuori < 0 || fuori === t ? 0 : fuori < t ? 1 : -1;
    }
    // il muro A: il tratto circolare più lungo di classe +1 (o −1 se non c'è nessun +1)
    const cerca = (val: number): [number, number] | null => {
      let best: [number, number] | null = null, bestLen = 0;
      let i = 0;
      // si parte da un punto che NON è di quella classe, per non spezzare un tratto a cavallo dello 0
      let start = -1;
      for (let k = 0; k < n; k++) if (classe[k] !== val) { start = k; break; }
      if (start < 0) return [0, n - 1];
      i = start;
      for (let k = 0; k < n; k++) {
        const idx = (start + k) % n;
        if (classe[idx] === val) {
          const s0 = idx; let len = 0;
          while (len < n && classe[(s0 + len) % n] === val) len++;
          if (len > bestLen) { bestLen = len; best = [s0, (s0 + len - 1) % n]; }
          k += len - 1;
        }
      }
      void i;
      return best;
    };
    let versoChiaro = true;
    let tratto = cerca(1);
    if (!tratto) { tratto = cerca(-1); versoChiaro = false; }
    if (!tratto) continue;
    const [i0, i1] = tratto;
    const lenA = ((i1 - i0 + n) % n) + 1;
    if (lenA < 6 || lenA > n - 6) continue;  // un muro che è quasi tutto il giro non ha un opposto
    const A: Point[] = [], B: Point[] = [];
    for (let k = 0; k < lenA; k++) A.push(anello[(i0 + k) % n]);
    // il muro opposto: il resto del giro, da i1 a i0, percorso nello STESSO senso di A (quindi rovesciato)
    for (let k = 0; k < n - lenA; k++) B.push(anello[(i1 + 1 + k) % n]);
    B.reverse();
    // lisciatura forte, poi le vie di mezzo
    const As = liscia(A, LISCIA_MM, 0.5), Bs = liscia(B, LISCIA_MM, 0.5);
    const fA = lungoLaLinea(As), fB = lungoLaLinea(Bs);
    if (SOLO_BASI) { muriA.push(via(As)); muriB.push(via(Bs)); }
    // larghezza media fra i due muri → quante basi
    let larg = 0;
    const campioni = 24;
    for (let k = 0; k <= campioni; k++) { const u = k / campioni; const pa = fA(u), pb = fB(u); larg += Math.hypot(pb.x - pa.x, pb.y - pa.y); }
    larg /= campioni + 1;
    const quante = Math.max(1, Math.round(larg / BASI_MM));
    const passiU = Math.max(8, Math.round(Math.max(lungoLaLinea(As)(1).x, 1) * 0 + (As.length + Bs.length) / 2));
    const segno = (versoChiaro ? -1 : 1) * VERSO;      // -1 = verso A (il chiaro); +1 = via da A

    for (let q = 0; q < quante; q++) {
      const fr = (q + 0.5) / quante;
      // la via di mezzo: fra A(u) e B(u), tagliata dove esce dalla macchia
      const linea: Point[] = [];
      const dir: Point[] = [];
      for (let k = 0; k <= passiU; k++) {
        const u = k / passiU;
        const pa = fA(u), pb = fB(u);
        linea.push({ x: pa.x + (pb.x - pa.x) * fr, y: pa.y + (pb.y - pa.y) * fr });
        const dx = pa.x - pb.x, dy = pa.y - pb.y, l = Math.hypot(dx, dy) || 1;
        dir.push({ x: (dx / l) * -segno, y: (dy / l) * -segno });
      }
      basiTot++;
      if (SOLO_BASI) {
        // solo il tratto dentro la macchia
        let corrente: Point[] = [];
        const spezzoni: Point[][] = [];
        for (const p of linea) { if (mia[cellaDi(p)]) corrente.push(p); else if (corrente.length) { spezzoni.push(corrente); corrente = []; } }
        if (corrente.length) spezzoni.push(corrente);
        for (const sp of spezzoni) if (sp.length >= 2) perTinta[t].push(via(sp));
        continue;
      }
      // il pettine lungo la via di mezzo: un dente ogni PASSO_MM, direzione della fusione
      let tot = 0;
      const cum: number[] = [0];
      for (let i = 1; i < linea.length; i++) { tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y); cum.push(tot); }
      const punti: Point[] = [];
      let k = 0;
      for (let d = 0; d <= tot; d += PASSO_MM, k++) {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < d) i++;
        const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        const pa = linea[i - 1], pb = linea[i];
        const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
        if (!mia[cellaDi(p)]) continue;                 // la via di mezzo è uscita dalla macchia
        const dA = dir[i - 1], dB = dir[i];
        let bx = dA.x + (dB.x - dA.x) * tt, by = dA.y + (dB.y - dA.y) * tt;
        const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
        const r1 = caso(macchieTot * 7919 + q, k * 2), r2 = caso(macchieTot * 104729 + q, k * 2 + 1);
        let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
        const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
        const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);
        for (let s = mmPerPx; s <= lung; s += mmPerPx) {
          const j = cellaDi({ x: p.x + ux * s, y: p.y + uy * s });
          if (mia[j]) continue;
          if (netto[j] && !sfuma[j]) { lung = Math.max(0.5, s - mmPerPx / 2); fermati++; } else attraversano++;
          break;
        }
        punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
      }
      if (punti.length < 3) continue;
      denti += Math.floor(punti.length / 3);
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], b = punti[i];
        filoMm += Math.hypot(b.x - a.x, b.y - a.y);
        const nn = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
        for (let kk = 0; kk <= nn; kk++) {
          const x = Math.round(a.x + ((b.x - a.x) * kk) / nn), y = Math.round(a.y + ((b.y - a.y) * kk) / nn);
          if (x >= 0 && y >= 0 && x < CW && y < CH) coperto[y * CW + x] = 1;
        }
      }
      perTinta[t].push(via(punti));
    }
  }
}

// --- 5. il disegno ------------------------------------------------------------------------------
const WM = W * mmPerPx, HM = H * mmPerPx;
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (perTinta[t].length) pezzi.push(`<path d="${perTinta[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="${SOLO_BASI ? 0.25 : 0.1}"/>`);
});
if (SOLO_BASI) {
  pezzi.push(`<path d="${muriA.join('')}" fill="none" stroke="#d21" stroke-width="0.6"/>`);
  pezzi.push(`<path d="${muriB.join('')}" fill="none" stroke="#27c" stroke-width="0.4"/>`);
}
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `${SOLO_BASI ? 'basi-' : ''}fusione-t${TINTE}-b${BASI_MM}-l${LISCIA_MM}${VERSO < 0 ? '-inv' : ''}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`, 'utf8');
if (!SOLO_BASI) {
  let dentro = 0, nudo = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const px = Math.min(W - 1, Math.round(x / mmPerPx)), py = Math.min(H - 1, Math.round(y / mmPerPx));
    if (tinta[py * W + px] < 0) continue;
    dentro++;
    if (!coperto[y * CW + x]) nudo++;
  }
  console.log(`COPERTURA VERA: ${((nudo / dentro) * 100).toFixed(1)}% senza filo`);
}
console.log(`${macchieTot} macchie · ${basiTot} basi · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m · ${fermati} fermati, ${attraversano} attraversano · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

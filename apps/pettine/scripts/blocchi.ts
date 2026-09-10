// I BLOCCHI: ogni macchia spezzata in colonne, e in ogni colonna UNA direzione sola.
//
// Lorenzo, sull'ultimo giro: «le curve che crei spesso sono circolari: questo è un errore, la
// direzione deve essere una sola in ogni blocco di macchia, non deve girare. La direzione del
// pettine deve seguire la sfumatura dallo scuro al chiaro. Il problema è come identificare i vari
// blocchi con i vari colori da sfumare con unica direzione».
//
// Aveva ragione, e la causa era mia: negli ultimi tre giri le basi erano le curve di livello della
// DISTANZA DAL BORDO, e le curve di livello di una distanza girano attorno alla macchia per
// definizione — sono anelli. Da lì gli anelli concentrici e, nelle macchie convesse, i buchi al
// centro.
//
// LA STRADA GIUSTA È QUELLA DEL SUO DST FATTO A MANO: 42 blocchi, ogni fascia un raso solo con
// l'orientamento che ruota dolcemente lungo la fascia, e dove la forma gira troppo un taglio netto e
// un altro blocco. Il Punto Pittorico la ricostruisce già con `buildColonne` — lo scheletro della
// macchia, i tagli ai bivi e dove l'asse ruota oltre un budget, e per ogni colonna le traverse da
// parete a parete. Sopra le colonne il pettine è semplice:
//
//   * le BASI corrono lungo la colonna: sono la fusione fra le due pareti (la traversa k va dalla
//     parete A alla B, quindi i punti alla stessa frazione formano una linea che segue la colonna);
//   * la DIREZIONE è una per colonna: quella della traversa, col verso scelto a maggioranza guardando
//     3 mm oltre i due capi — dallo scuro verso il chiaro, come chiede Lorenzo (il verso è comunque una
//     manopola: `VERSO` = -1 lo rovescia);
//   * tutto il resto viene dai giri precedenti e resta: le N tinte dalla foto, il sormonto a due soglie,
//     netto o sfumato misurato sulla foto, l'ordine dal chiaro allo scuro, la più chiara in grigio.
//
//   npx esbuild apps/pettine/scripts/blocchi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine/scripts/blocchi.mjs
//   node --max-old-space-size=6144 apps/pettine/scripts/blocchi.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato] [macchiaMin] [verso]

import { mkdirSync, writeFileSync } from 'node:fs';
import { type Point, type Polyline, reduceStable, rgbToHex, traceRegions } from '@rg/core';
import { buildColonne } from '@rg/core';
import { lisciaRegione } from '@rg/core';
import { larghezzaTransizione, cresciVersoISuccessivi } from '@rg/core';
import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';

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
const VERSO = num(13, 1) >= 0 ? 1 : -1;   // +1 = il pelo va dallo scuro verso il chiaro; -1 = al contrario
const LISCIA_MM = num(14, 2);           // lisciatura del contorno prima dello scheletro: i pixel fanno rami finti
const POTATURA = num(15, 6);            // un rametto piu' corto di tante larghezze locali si pota
if (!foto) { console.error('uso: node blocchi.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato] [macchiaMin] [verso]'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- 1. la foto ridotta a N tinte, ordinate dal chiaro allo scuro ------------------------------------
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
const luceDiTinta = ordine.map((t) => lum(rid.palette[t]));
console.log(`\n${foto}\n${(W * mmPerPx).toFixed(1)} × ${(H * mmPerPx).toFixed(1)} mm · ${TINTE} tinte dal chiaro allo scuro: ${colori.join(' · ')}`);

// --- 2. dove il bordo sfuma, misurato sulla foto ----------------------------------------------------
const sfuma = new Uint8Array(N), netto = new Uint8Array(N);
{
  let misure = 0, sf = 0;
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
    misure++;
    const s = tr !== null && tr.larghezzaMm >= NETTO_MM;
    if (s) sf++;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const j = (y + dy) * W + (x + dx);
      if (j >= 0 && j < N) { if (s) sfuma[j] = 1; else netto[j] = 1; }
    }
  }
  console.log(`bordi misurati sulla foto: ${misure}, ${((sf / Math.max(1, misure)) * 100).toFixed(0)}% sfumati`);
}

// --- 3. la luce in un punto: serve a decidere il verso di ogni colonna -------------------------------
const luceIn = (p: Point): number => {
  const c = Math.round(p.x / mmPerPx), r = Math.round(p.y / mmPerPx);
  if (c < 0 || r < 0 || c >= W || r >= H) return 1;
  const t = tinta[r * W + c];
  return t < 0 ? 1 : luceDiTinta[t];
};
const cellaDi = (p: Point): number => {
  const c = Math.min(W - 1, Math.max(0, Math.round(p.x / mmPerPx)));
  const r = Math.min(H - 1, Math.max(0, Math.round(p.y / mmPerPx)));
  return r * W + c;
};

// --- 4. tinta per tinta: la maschera allargata (sormonto) → le macchie → le colonne → il pettine -----
const indiceOrdinato = new Uint8Array(N);
for (let i = 0; i < N; i++) indiceOrdinato[i] = tinta[i] < 0 ? 255 : tinta[i];
const ordineRanghi = colori.map((_, r) => r);
const perTinta: string[][] = colori.map(() => []);
const CW = Math.ceil(W * mmPerPx) + 1, CH = Math.ceil(H * mmPerPx) + 1;
const coperto = new Uint8Array(CW * CH);
let debugFatto = false;
let denti = 0, filoMm = 0, colonneTot = 0, macchieTot = 0, fermati = 0, attraversano = 0, tagliTot = 0, scoperteTot = 0, areaTot = 0;

for (let t = 0; t < colori.length; t++) {
  const mia = cresciVersoISuccessivi(indiceOrdinato, W, H, t, ordineRanghi, mmPerPx, { crescitaMm: SORM_SFUMATO, sormontoMm: SORM_NETTO, sfuma });
  // le macchie della maschera allargata, come poligoni coi fori: è ciò che vuole buildColonne
  const macchie = traceRegions(mia, W, H, 1, mmPerPx, { minAreaMm2: 15 });
  for (const m of macchie) {
    macchieTot++;
    let col;
    try {
      // il contorno tracciato dai pixel e' una scalinata, e ogni gradino fa nascere un ramo dello
      // scheletro: prima si liscia (come fa il Pittorico), poi si pota di piu' del default
      const liscia = LISCIA_MM > 0 ? lisciaRegione(m, LISCIA_MM, 0.5) : m;
      col = buildColonne(liscia, { spacingMm: 1, cellMm: 0.7, larghezzaColonnaMm: 24, potaturaPerLarghezza: POTATURA });
    } catch { continue; }
    colonneTot += col.colonne.length; tagliTot += col.tagli.length; scoperteTot += col.scoperteMm2; areaTot += m.areaMm2;
    if (process.env.DEBUG_MACCHIA && t === 4 && !debugFatto && m.areaMm2 > 15000) {
      debugFatto = true;
      const via = (pt: Point[], col: string, w: number): string => `<path d="${pt.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
      const d: string[] = [via([...m.outer, m.outer[0]], '#000', 0.3)];
      for (const h of m.holes) d.push(via([...h, h[0]], '#000', 0.3));
      for (const r of col.scheletro) d.push(via(r, '#d22', 0.5));
      for (const c of col.colonne) for (const r of c.runs) d.push(via(r, '#4a7', 0.12));
      for (const tg of col.tagli) d.push(`<circle cx="${tg.p.x.toFixed(1)}" cy="${tg.p.y.toFixed(1)}" r="1.5" fill="#f80"/>`);
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const q of m.outer) { mnx = Math.min(mnx, q.x); mny = Math.min(mny, q.y); mxx = Math.max(mxx, q.x); mxy = Math.max(mxy, q.y); }
      writeFileSync('apps/pettine/scripts/out/debug-macchia.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(mnx - 2).toFixed(1)} ${(mny - 2).toFixed(1)} ${(mxx - mnx + 4).toFixed(1)} ${(mxy - mny + 4).toFixed(1)}" width="1400"><rect x="${(mnx - 2).toFixed(1)}" y="${(mny - 2).toFixed(1)}" width="${(mxx - mnx + 4).toFixed(1)}" height="${(mxy - mny + 4).toFixed(1)}" fill="#fff"/>${d.join('')}</svg>`);
      console.log(`  DEBUG macchia ${m.areaMm2.toFixed(0)} mm² → debug-macchia.svg: ${col.scheletro.length} rami, ${col.colonne.length} colonne, ${col.colonne.reduce((n, c) => n + c.runs.length, 0)} traverse, scoperto ${((col.scoperteMm2 / m.areaMm2) * 100).toFixed(0)}%`);
    }
    if (process.env.DIAG2 && m.areaMm2 > 1500) console.log(`  DIAG2 tinta ${t} macchia ${m.areaMm2.toFixed(0)} mm² · ${col.colonne.length} colonne · scoperto ${col.scoperteMm2.toFixed(0)} (${((col.scoperteMm2 / m.areaMm2) * 100).toFixed(0)}%) · scheletro ${col.scheletro.length} rami`);
    if (process.env.DIAG) for (const c of col.colonne) {
      const L = c.runs.filter((r) => r.length >= 2).map((r) => Math.hypot(r[r.length - 1].x - r[0].x, r[r.length - 1].y - r[0].y)).sort((a, b) => a - b);
      let asse = 0; for (let i = 1; i < c.asse.length; i++) asse += Math.hypot(c.asse[i].x - c.asse[i - 1].x, c.asse[i].y - c.asse[i - 1].y);
      console.log(`  DIAG tinta ${t} macchia ${m.areaMm2.toFixed(0)} mm² colonna ${c.id}: larghezza ${c.larghezzaMm.toFixed(1)} · traverse ${L.length} (mediana ${L[L.length >> 1]?.toFixed(1)}, max ${L[L.length - 1]?.toFixed(1)}) · asse ${asse.toFixed(0)} mm`);
    }

    for (const c of col.colonne) {
      const runs = c.runs.filter((r) => r.length >= 2);
      if (runs.length < 2) continue;

      // IL VERSO DELLA COLONNA, a maggioranza delle sue traverse: si guarda 3 mm oltre i due capi e si
      // va dallo scuro verso il chiaro. Se non c'è un lato più chiaro (la tinta più chiara di tutte,
      // o un'isola nello scuro), si va VIA dal lato più scuro: così i denti non si incontrano di fronte.
      // PRIMA si orientano tutte le traverse nello stesso senso — i loro capi arrivano in ordine
      // arbitrario, e senza questo passo la spina salta da una parete all'altra a ogni traversa (era
      // il difetto del primo giro sulle aree: 400.000 denti dove ne servivano 25.000). Il riferimento
      // e' la prima traversa, e ognuna si allinea alla precedente gia' allineata, cosi' anche una
      // colonna che ruota di molto resta coerente.
      const grezze = runs.map((r) => {
        const a = r[0], b = r[r.length - 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
      });
      const orientate: Point[] = [];
      for (let k = 0; k < grezze.length; k++) {
        const g = grezze[k];
        if (k === 0) { orientate.push(g); continue; }
        const prev = orientate[k - 1];
        orientate.push(g.x * prev.x + g.y * prev.y >= 0 ? g : { x: -g.x, y: -g.y });
      }
      // poi il VERSO della colonna, a maggioranza: 3 mm oltre i due capi, dallo scuro verso il chiaro
      let voti = 0;
      runs.forEach((r, k) => {
        const a = r[0], b = r[r.length - 1], d = orientate[k];
        const dritto = (b.x - a.x) * d.x + (b.y - a.y) * d.y >= 0;
        const capoAvanti = dritto ? b : a, capoDietro = dritto ? a : b;
        voti += luceIn({ x: capoAvanti.x + d.x * 3, y: capoAvanti.y + d.y * 3 }) - luceIn({ x: capoDietro.x - d.x * 3, y: capoDietro.y - d.y * 3 });
      });
      const segno = (voti >= 0 ? 1 : -1) * VERSO;
      const dir = orientate.map((d) => ({ x: d.x * segno, y: d.y * segno }));

      // LE BASI: la fusione fra le due pareti, orientata così che t = 0 stia sempre sul lato da cui
      // parte il pelo. Quante: una ogni BASI_MM di larghezza.
      const quante = Math.max(1, Math.round(c.larghezzaMm / BASI_MM));
      for (let q = 0; q < quante; q++) {
        const frazione = quante === 1 ? 0.5 : (q + 0.5) / quante;
        const spina: Point[] = runs.map((r, k) => {
          const a = r[0], b = r[r.length - 1];
          const dritto = (b.x - a.x) * dir[k].x + (b.y - a.y) * dir[k].y >= 0;
          const p0 = dritto ? a : b, p1 = dritto ? b : a;
          return { x: p0.x + (p1.x - p0.x) * frazione, y: p0.y + (p1.y - p0.y) * frazione };
        });
        // il pettine sulla spina, coi denti lungo la direzione della traversa
        let tot = 0;
        const cum: number[] = [0];
        for (let i = 1; i < spina.length; i++) {
          tot += Math.hypot(spina[i].x - spina[i - 1].x, spina[i].y - spina[i - 1].y);
          cum.push(tot);
        }
        const punti: Point[] = [];
        let k = 0;
        for (let d = 0; d <= tot; d += PASSO_MM, k++) {
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
          const pa = spina[i - 1], pb = spina[i];
          const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
          const dA = dir[i - 1], dB = dir[i];
          let bx = dA.x + (dB.x - dA.x) * tt, by = dA.y + (dB.y - dA.y) * tt;
          const bl = Math.hypot(bx, by) || 1;
          bx /= bl; by /= bl;
          const r1 = caso(c.id * 7919 + t * 31 + q, k * 2), r2 = caso(c.id * 104729 + t * 31 + q, k * 2 + 1);
          let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
          const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
          const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);
          // netto o sfumato: dove il dente esce dalla macchia, se lì il bordo stacca si ferma
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
        for (let i = 1; i < punti.length; i++) filoMm += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
        perTinta[t].push(punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
        // il metro: ogni segmento cucito marca le celle che attraversa (griglia 1 mm)
        for (let i = 1; i < punti.length; i++) {
          const a = punti[i - 1], b = punti[i];
          const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
          for (let k = 0; k <= n; k++) {
            const x = Math.round(a.x + ((b.x - a.x) * k) / n), y = Math.round(a.y + ((b.y - a.y) * k) / n);
            if (x >= 0 && y >= 0 && x < CW && y < CH) coperto[y * CW + x] = 1;
          }
        }
      }
    }
  }
}

// --- 5. il disegno: dal chiaro allo scuro, la più chiara in grigio ----------------------------------
const WM = W * mmPerPx, HM = H * mmPerPx;
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (perTinta[t].length) pezzi.push(`<path d="${perTinta[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="0.1"/>`);
});
mkdirSync('apps/pettine/scripts/out', { recursive: true });
const nome = `blocchi-t${TINTE}-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-s${SORM_NETTO}_${SORM_SFUMATO}${VERSO < 0 ? '-inv' : ''}`;
writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
</svg>`, 'utf8');
console.log(`${macchieTot} macchie · ${colonneTot} colonne (${tagliTot} tagli) · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`denti al bordo: ${fermati} fermati (netto) · ${attraversano} attraversano (sfumato)`);
{
  // cosa resta nudo, contando solo dentro il disegno (le celle che hanno una tinta)
  let dentro = 0, nudo = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const px = Math.min(W - 1, Math.round(x / mmPerPx)), py = Math.min(H - 1, Math.round(y / mmPerPx));
    if (tinta[py * W + px] < 0) continue;
    dentro++;
    if (!coperto[y * CW + x]) nudo++;
  }
  console.log(`COPERTURA VERA (griglia 1 mm): ${nudo} mm² nudi su ${dentro} = ${((nudo / dentro) * 100).toFixed(1)}% del pannello senza filo`);
}
console.log(`SCOPERTO dalle colonne: ${scoperteTot.toFixed(0)} mm² su ${areaTot.toFixed(0)} (${((scoperteTot / Math.max(1, areaTot)) * 100).toFixed(1)}%)`);
console.log(`-> apps/pettine/scripts/out/${nome}.svg`);

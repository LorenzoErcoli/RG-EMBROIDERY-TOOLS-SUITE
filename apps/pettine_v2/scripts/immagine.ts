// DALL'IMMAGINE: N tinte, il sormonto fra i colori, e il pettine pieno.
//
// Lorenzo: «mettimi il sormonto regolabile, ma soprattutto il sormonto tra diversi colori. Oltre che
// la gestione della quantità di colori: tu qui ne prendi 4 ma io ne avrò bisogno di 6. E deve
// essere sfumatura molto fedele all'immagine».
//
// Con sei tinte il vettoriale a quattro non basta più: si parte dalla FOTO. E la strada esiste già,
// tutta nel core o nel Punto Pittorico, promossa lì per lo stesso disegno:
//
//   * `reduceStable`      la foto ridotta a N tinte stabili (pareggio della luce, grana attenuata,
//                         palette affinata, isole assorbite);
//   * `cresciVersoISuccessivi`  IL SORMONTO: ogni tinta si allarga sotto quelle cucite dopo di lei —
//                         di poco dove il bordo stacca (`sormontoNetto`), di molto dove sfuma
//                         (`sormontoSfumato`). È una decisione di Lorenzo già presa nel Pittorico:
//                         «far sormontare il sopra rispetto al sotto, e quindi il sotto farlo più
//                         grande». Il bordo resta netto perché a definirlo è il colore che va sopra;
//   * `larghezzaTransizione`    dove il bordo stacca e dove sfuma, misurato sulla foto.
//
// Sopra a questo, il modello del pettine pieno (`pieno.ts`): un'area una direzione, la più chiara
// verso dentro, l'ordine dal chiaro allo scuro, il dente fermato ai bordi netti.
//
// Tutto è in millimetri veri: 419,45 mm di larghezza, dichiarata da Lorenzo per questo disegno.
//
//   npx esbuild apps/pettine_v2/scripts/immagine.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pettine_v2/scripts/immagine.mjs
//   node --max-old-space-size=4096 apps/pettine_v2/scripts/immagine.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato]

import { mkdirSync, writeFileSync } from 'node:fs';
import { type Point, reduceStable, rgbToHex } from '@rg/core';
import { livello, incatena } from '../../pittorico/src/iso-fill.ts';
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
const NETTO_MM = num(9, 2.5);           // sotto questa larghezza di passaggio il bordo è uno stacco
const SORM_NETTO = num(10, 0.8);        // quanto una tinta entra sotto la successiva a un bordo netto
const SORM_SFUMATO = num(11, 4);        // ...e a un bordo sfumato
const MACCHIA_MIN_MM2 = num(12, 60);    // sotto quest'area una macchia viene assorbita dalla riduzione
const SENZA_PELO_MM2 = num(13, 0);      // sotto quest'area un'area ha solo le basi, niente denti: i dettagli restano netti
const VERSO = num(14, 1) >= 0 ? 1 : -1;   // +1 = il pelo va dallo scuro verso il chiaro (verso il muro di partenza); -1 = via da esso
const RIFERIMENTO_DEG = num(15, -90);   // dove guarda il pelo quando la forma non lo dice (un'isola tutta circondata)
if (!foto) { console.error('uso: node immagine.mjs <foto.bmp> [tinte] [basi] [passo] [dMin] [dMax] [incl] [nettoMm] [sormNetto] [sormSfumato] [macchiaMinMm2] [senzaPeloMm2]'); process.exit(1); }

function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- 1. la foto ridotta a N tinte -----------------------------------------------------------------
const img = leggiBmp(foto);
const mmPerPx = LARGHEZZA_REALE_MM / img.width;
const t0 = Date.now();
// la pulizia era a 400 mm² (2 × 2 cm): i settori della sfera sono più piccoli e sparivano
const rid = reduceStable(img, { colorCount: TINTE, flattenLightMm: 40, smoothMm: 1.5, minBlobMm2: MACCHIA_MIN_MM2, mmPerPx });
const W = img.width, H = img.height, N = W * H;
const lum = (c: [number, number, number]): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
// l'ordine delle tinte è quello della luce, dal chiaro allo scuro; l'indice viene rimappato a quel rango
const ordine = rid.palette.map((c, i) => i).sort((a, b) => lum(rid.palette[b]) - lum(rid.palette[a]));
const rango = new Int8Array(rid.palette.length);
ordine.forEach((t, r) => { rango[t] = r; });
const tinta = new Int8Array(N);
for (let i = 0; i < N; i++) tinta[i] = rid.index[i] < rid.palette.length ? rango[rid.index[i]] : -1;
const colori = ordine.map((t) => rgbToHex(rid.palette[t]));
console.log(`\n${foto}\n${W} × ${H} px · ${(W * mmPerPx).toFixed(1)} × ${(H * mmPerPx).toFixed(1)} mm · ${TINTE} tinte in ${Date.now() - t0} ms`);
console.log(`dal chiaro allo scuro: ${colori.map((c, r) => `${c} (${(ordine.map((t) => rid.counts[t])[r] * mmPerPx * mmPerPx).toFixed(0)} mm²)`).join(' · ')}`);

// --- 2. dove il bordo sfuma, misurato sulla foto ----------------------------------------------------
// Per ogni pixel di confine fra due tinte si misura la larghezza del passaggio di luce lungo la
// direzione che attraversa il confine. La maschera che ne esce serve a due cose: al sormonto (che
// deve essere largo solo dove sfuma) e ai denti (che si fermano dove stacca).
const sfuma = new Uint8Array(N);
const netto = new Uint8Array(N);
{
  let misure = 0, misureSfumate = 0;
  for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
    const i = y * W + x;
    if (tinta[i] < 0) continue;
    let nx = 0, ny = 0;
    if (tinta[i + 1] !== tinta[i] && tinta[i + 1] >= 0) nx += 1;
    if (tinta[i - 1] !== tinta[i] && tinta[i - 1] >= 0) nx -= 1;
    if (tinta[i + W] !== tinta[i] && tinta[i + W] >= 0) ny += 1;
    if (tinta[i - W] !== tinta[i] && tinta[i - W] >= 0) ny -= 1;
    if (nx === 0 && ny === 0) continue;
    // si misura un pixel su tre: il bordo è continuo e la larghezza non cambia da un pixel all'altro
    if ((x + y) % 3 !== 0) continue;
    const l = Math.hypot(nx, ny);
    const tr = larghezzaTransizione(img, mmPerPx, { x: x * mmPerPx, y: y * mmPerPx }, { x: nx / l, y: ny / l }, { raggioMm: 6 });
    misure++;
    const s = tr !== null && tr.larghezzaMm >= NETTO_MM;
    if (s) misureSfumate++;
    // si segna un intorno di 3 pixel, così anche i pixel di confine non misurati hanno una risposta
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const j = (y + dy) * W + (x + dx);
      if (j < 0 || j >= N) continue;
      if (s) sfuma[j] = 1; else netto[j] = 1;
    }
  }
  console.log(`bordi misurati sulla foto: ${misure} punti, ${((misureSfumate / Math.max(1, misure)) * 100).toFixed(0)}% sfumati (passaggio ≥ ${NETTO_MM} mm)`);
}

// --- 3. per ogni tinta: la sua maschera ALLARGATA sotto le successive (il sormonto) ---------------
// `cresciVersoISuccessivi` lavora sull'indice originale e sull'ordine di cucitura: ogni tinta cresce
// dentro quelle che vengono dopo — di `SORM_SFUMATO` dove il bordo sfuma, di `SORM_NETTO` dove stacca.
const indiceOrdinato = new Uint8Array(N);
for (let i = 0; i < N; i++) indiceOrdinato[i] = tinta[i] < 0 ? 255 : tinta[i];
const ordineRanghi = colori.map((_, r) => r);

// --- 4. il pettine, tinta per tinta, area per area --------------------------------------------------
const CELLA = mmPerPx;
const perTinta: string[][] = colori.map(() => []);
// SOLO_BASI=1: si disegnano solo le linee di base e, in rosso, il muro di partenza di ogni macchia
const SOLO_BASI = !!process.env.SOLO_BASI;
const muri: string[] = [];
const CW = Math.ceil(W * mmPerPx) + 1, CH = Math.ceil(H * mmPerPx) + 1;
const coperto = new Uint8Array(CW * CH);
let denti = 0, filoMm = 0, basiTot = 0, fermati = 0, attraversano = 0, areeTot = 0;

const cellaDi = (p: Point): number => {
  const c = Math.min(W - 2, Math.max(1, Math.round(p.x / CELLA)));
  const r = Math.min(H - 2, Math.max(1, Math.round(p.y / CELLA)));
  return r * W + c;
};

for (let t = 0; t < colori.length; t++) {
  const mia = cresciVersoISuccessivi(indiceOrdinato, W, H, t, ordineRanghi, mmPerPx, {
    crescitaMm: SORM_SFUMATO, sormontoMm: SORM_NETTO, sfuma,
  });

  // le aree: macchie connesse della maschera allargata
  const areaDi = new Int32Array(N).fill(-1);
  const aree: Array<{ id: number; celle: number }> = [];
  for (let s = 0; s < N; s++) {
    if (!mia[s] || areaDi[s] !== -1) continue;
    const id = aree.length;
    const coda = [s]; areaDi[s] = id; let celle = 0;
    while (coda.length) {
      const i = coda.pop()!; celle++;
      const x = i % W;
      if (x > 0 && mia[i - 1] && areaDi[i - 1] === -1) { areaDi[i - 1] = id; coda.push(i - 1); }
      if (x + 1 < W && mia[i + 1] && areaDi[i + 1] === -1) { areaDi[i + 1] = id; coda.push(i + 1); }
      if (i >= W && mia[i - W] && areaDi[i - W] === -1) { areaDi[i - W] = id; coda.push(i - W); }
      if (i + W < N && mia[i + W] && areaDi[i + W] === -1) { areaDi[i + W] = id; coda.push(i + W); }
    }
    aree.push({ id, celle });
  }

  for (const a of aree) {
    if (a.celle * CELLA * CELLA < 15) continue;          // sotto 15 mm² non c'è posto per un pettine
    areeTot++;
    // I SEMI: il lato dell'area che tocca una tinta PIÙ CHIARA (sull'indice originale, non allargato:
    // il sormonto sta sotto, non conta). Se i lati sono più d'uno, si tiene il gruppo più grande.
    // La più chiara, o un'area senza vicini chiari, ha per semi tutto il suo bordo e va verso dentro.
    const bordo = new Uint8Array(N), chiaro = new Uint8Array(N);
    for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
      const i = y * W + x;
      if (areaDi[i] !== a.id) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (areaDi[j] === a.id) continue;
        bordo[i] = 1;
        if (tinta[j] >= 0 && tinta[j] < t) chiaro[i] = 1;
      }
    }
    // IL MURO DI PARTENZA: uno solo, mai tutto il giro. Con tutto il giro come seme le curve di
    // livello sono ANELLI (Lorenzo: «le curve sono circolari, questo e' un errore»); con un muro solo
    // seguono quel muro, attraversano la macchia e finiscono sul lato opposto — una direzione sola,
    // e copertura totale per costruzione. Il muro e' il gruppo piu' lungo di bordo che tocca una
    // tinta piu' chiara; se non c'e' (la tinta piu' chiara, un'isola), il gruppo piu' lungo verso una
    // tinta piu' scura. E in ogni caso si tengono solo le celle del gruppo la cui normale guarda dalla
    // parte del suo verso medio: cosi' un gruppo che gira attorno all'isola non richiude l'anello.
    const candidati = new Uint8Array(N);
    let versoChiaro = false;
    for (let i = 0; i < N; i++) if (chiaro[i]) { candidati[i] = 1; versoChiaro = true; }
    if (!versoChiaro) for (let y = 1; y + 1 < H; y++) for (let x = 1; x + 1 < W; x++) {
      const i = y * W + x;
      if (!bordo[i]) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (areaDi[j] !== a.id && tinta[j] > t) { candidati[i] = 1; break; }
    }
    // il gruppo connesso piu' grande
    const gruppo = new Int32Array(N).fill(-1);
    let migliore = -1, peso = 0, ng = 0;
    for (let s0 = 0; s0 < N; s0++) {
      if (!candidati[s0] || gruppo[s0] !== -1) continue;
      const coda = [s0]; gruppo[s0] = ng; let n = 0;
      while (coda.length) {
        const i = coda.pop()!; n++;
        for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
          if (j < 0 || j >= N || !candidati[j] || gruppo[j] !== -1) continue;
          gruppo[j] = ng; coda.push(j);
        }
      }
      if (n > peso) { peso = n; migliore = ng; }
      ng++;
    }
    // la normale esterna di ogni cella del gruppo (dalla cella verso il fuori), e il loro verso medio
    let mx = 0, my = 0;
    const normali = new Map<number, [number, number]>();
    if (migliore !== -1) for (let i = 0; i < N; i++) {
      if (gruppo[i] !== migliore) continue;
      let nx = 0, ny = 0;
      if (areaDi[i + 1] !== a.id) nx += 1;
      if (areaDi[i - 1] !== a.id) nx -= 1;
      if (areaDi[i + W] !== a.id) ny += 1;
      if (areaDi[i - W] !== a.id) ny -= 1;
      const l = Math.hypot(nx, ny) || 1;
      normali.set(i, [nx / l, ny / l]); mx += nx / l; my += ny / l;
    }
    const ml = Math.hypot(mx, my);
    // se il gruppo gira attorno (verso medio quasi nullo) si usa il riferimento dichiarato
    let rx = Math.cos((RIFERIMENTO_DEG * Math.PI) / 180), ry = Math.sin((RIFERIMENTO_DEG * Math.PI) / 180);
    if (ml > 0.3 * Math.max(1, normali.size)) { rx = mx / ml; ry = my / ml; }
    const semi = new Uint8Array(N);
    let nSemi = 0;
    for (const [i, [nx, ny]] of normali) if (nx * rx + ny * ry >= 0) { semi[i] = 1; nSemi++; }
    if (nSemi === 0) {
      // nessun bordo utile (capita solo su macchie minuscole): si prende il bordo che guarda il riferimento
      for (let i = 0; i < N; i++) if (bordo[i]) semi[i] = 1;
    }
    // il verso: dallo scuro verso il chiaro = verso il muro di partenza se il muro e' il lato chiaro,
    // via dal muro se il muro e' il lato scuro. VERSO lo rovescia.
    const versoDentro = !versoChiaro;
    if (SOLO_BASI) for (let i = 0; i < N; i++) if (semi[i]) muri.push(`<rect x="${((i % W) * mmPerPx).toFixed(1)}" y="${(Math.floor(i / W) * mmPerPx).toFixed(1)}" width="${mmPerPx.toFixed(2)}" height="${mmPerPx.toFixed(2)}" fill="#d21"/>`);

    // LA DISTANZA DAL MURO, dentro l'area sola. Chamfer a 16 vicini (pesi 5-7-11, con le mosse del
    // cavallo): con 8 vicini le curve di livello sono ottagoni, e lontano dal muro si vedevano gli
    // spigoli a 45 gradi (Lorenzo: «mi fai vedere le linee di curva che crei e perche'?»). Con 16
    // l'errore sulla distanza euclidea scende sotto il 2%: le curve tornano curve.
    const INF = 1e9;
    const D = new Float32Array(N).fill(INF);
    for (let i = 0; i < N; i++) if (semi[i]) D[i] = 0;
    const c5 = CELLA, c7 = CELLA * 1.4, c11 = CELLA * 2.2;
    const V = [
      [-1, 0, c5], [0, -1, c5], [-1, -1, c7], [1, -1, c7],
      [-2, -1, c11], [-1, -2, c11], [1, -2, c11], [2, -1, c11],
    ];
    const mio = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && areaDi[y * W + x] === a.id;
    for (let giro = 0; giro < 3; giro++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (areaDi[i] !== a.id) continue;
        let v = D[i];
        for (const [dx, dy, w] of V) if (mio(x + dx, y + dy)) { const u = D[(y + dy) * W + (x + dx)] + w; if (u < v) v = u; }
        D[i] = v;
      }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (areaDi[i] !== a.id) continue;
        let v = D[i];
        for (const [dx, dy, w] of V) if (mio(x - dx, y - dy)) { const u = D[(y - dy) * W + (x - dx)] + w; if (u < v) v = u; }
        D[i] = v;
      }
    }
    const dentro = new Uint8Array(N);
    let maxD = 0;
    for (let i = 0; i < N; i++) if (areaDi[i] === a.id) { dentro[i] = 1; if (D[i] < INF && D[i] > maxD) maxD = D[i]; }
    // IL VERSO, corretto da Lorenzo: «il culo della linea serpente verso l'esterno, e così sfuma
    // comodo verso l'interno». La base sta sul bordo verso il chiaro — ed è il contorno preciso — e
    // il pelo va DENTRO l'area, via dai semi. Vale per tutte le tinte, la più chiara compresa. La
    // compenetrazione la fa il sormonto: il chiaro cucito prima si allarga sotto lo scuro, e le sue
    // ultime basi coi loro denti restano sotto la base netta dello scuro.
    const segno = (versoDentro ? 1 : -1) * VERSO;
    // IL PETTINE HA SENSO SU UNA FASCIA, non su una macchia grande quanto i suoi denti: in un settore
    // della sfera largo 15 mm con denti da 5, il pelo arriva da tutti i lati e resta un intrico di X.
    // Sotto la soglia, l'area ha solo le sue basi - un raso a curve di livello - e resta leggibile.
    const soloBasi = SOLO_BASI || a.celle * CELLA * CELLA < SENZA_PELO_MM2;

    for (let v = BASI_MM / 2; v < maxD; v += BASI_MM) {
      for (const linea of incatena(livello(D, dentro, W, H, 0, 0, CELLA, v), CELLA * 2)) {
        if (linea.length < 3) continue;
        basiTot++;
        let tot = 0;
        const cum: number[] = [0];
        for (let i = 1; i < linea.length; i++) {
          tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y);
          cum.push(tot);
        }
        const punti: Point[] = [];
        if (soloBasi) { for (const p of linea) punti.push(p); }
        let k = 0;
        for (let d = 0; d <= tot && !soloBasi; d += PASSO_MM, k++) {
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const tt = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
          const pa = linea[i - 1], pb = linea[i];
          const p = { x: pa.x + (pb.x - pa.x) * tt, y: pa.y + (pb.y - pa.y) * tt };
          const ci = cellaDi(p);
          const gx = (D[ci + 1] - D[ci - 1]) / (2 * CELLA), gy = (D[ci + W] - D[ci - W]) / (2 * CELLA);
          const gl = Math.hypot(gx, gy);
          if (!(gl > 1e-6) || !Number.isFinite(gl)) continue;
          const r1 = caso(a.id * 7919 + t * 31 + Math.round(v * 10), k * 2);
          const r2 = caso(a.id * 104729 + t * 31 + Math.round(v * 10), k * 2 + 1);
          let lung = DENTE_MIN + (DENTE_MAX - DENTE_MIN) * r1;
          const ang = ((r2 * 2 - 1) * INCL * Math.PI) / 180;
          const bx = (segno * gx) / gl, by = (segno * gy) / gl;
          const ux = bx * Math.cos(ang) - by * Math.sin(ang), uy = bx * Math.sin(ang) + by * Math.cos(ang);
          // NETTO O SFUMATO, sulla maschera misurata al passo 2: dove il dente esce dall'area, se lì il
          // bordo stacca si ferma; se sfuma attraversa.
          for (let s = CELLA; s <= lung; s += CELLA) {
            const j = cellaDi({ x: p.x + ux * s, y: p.y + uy * s });
            if (areaDi[j] === a.id) continue;
            if (netto[j] && !sfuma[j]) { lung = Math.max(0.5, s - CELLA / 2); fermati++; }
            else attraversano++;
            break;
          }
          punti.push(p, { x: p.x + ux * lung, y: p.y + uy * lung }, p);
        }
        if (punti.length < 2) continue;
        if (!soloBasi) denti += Math.floor(punti.length / 3);
        for (let i = 1; i < punti.length; i++) filoMm += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
        perTinta[t].push(punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
        for (let i = 1; i < punti.length; i++) {
          const pa = punti[i - 1], pb = punti[i];
          const n = Math.max(1, Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y)));
          for (let k = 0; k <= n; k++) {
            const x = Math.round(pa.x + ((pb.x - pa.x) * k) / n), y = Math.round(pa.y + ((pb.y - pa.y) * k) / n);
            if (x >= 0 && y >= 0 && x < CW && y < CH) coperto[y * CW + x] = 1;
          }
        }
      }
    }
  }
}

// --- 5. il disegno: dal chiaro allo scuro, la più chiara in grigio ---------------------------------
const WM = W * mmPerPx, HM = H * mmPerPx;
const pezzi: string[] = [];
colori.forEach((c, t) => {
  if (!perTinta[t].length) return;
  pezzi.push(`<path d="${perTinta[t].join('')}" fill="none" stroke="${t === 0 ? '#9a9a9a' : c}" stroke-width="${SOLO_BASI ? 0.3 : 0.1}"/>`);
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM.toFixed(1)} ${HM.toFixed(1)}" width="${WM.toFixed(1)}mm" height="${HM.toFixed(1)}mm">
<rect width="${WM.toFixed(1)}" height="${HM.toFixed(1)}" fill="#f7f6f3"/>
${pezzi.join('\n')}
${SOLO_BASI ? muri.join('') : ''}
</svg>`;
mkdirSync('apps/pettine_v2/scripts/out', { recursive: true });
const nome = `${SOLO_BASI ? 'basi-' : ''}muro-t${TINTE}-b${BASI_MM}-d${DENTE_MIN}_${DENTE_MAX}-s${SORM_NETTO}_${SORM_SFUMATO}${SENZA_PELO_MM2 ? `-np${SENZA_PELO_MM2}` : ''}${VERSO < 0 ? '-inv' : ''}`;
writeFileSync(`apps/pettine_v2/scripts/out/${nome}.svg`, svg, 'utf8');
console.log(`${areeTot} aree · ${basiTot} linee di base · ${denti} denti · ${(filoMm / 1000).toFixed(1)} m di filo · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`denti al bordo: ${fermati} fermati (netto) · ${attraversano} attraversano (sfumato)`);
{
  let dentro = 0, nudo = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const px = Math.min(W - 1, Math.round(x / mmPerPx)), py = Math.min(H - 1, Math.round(y / mmPerPx));
    if (tinta[py * W + px] < 0) continue;
    dentro++;
    if (!coperto[y * CW + x]) nudo++;
  }
  console.log(`COPERTURA VERA (griglia 1 mm): ${nudo} mm² nudi su ${dentro} = ${((nudo / dentro) * 100).toFixed(1)}% senza filo`);
}
console.log(`-> apps/pettine_v2/scripts/out/${nome}.svg`);

// Punto 2b — la prova del riconoscimento delle forme, a VERITÀ NOTA.
//
// Il punto delicato di questa misura è che non si può fare su un'immagine e basta: se traccio un
// cerchio da una foto non so quanto era il suo raggio, quindi non so se l'ho ricostruito bene —
// posso solo dire se «sembra» un cerchio. Qui invece il cerchio lo **rasterizzo io**, quindi il
// raggio vero lo conosco al millesimo, e l'errore si misura invece di stimarlo.
//
// Le tre domande, in ordine di importanza:
//   1. con che tolleranza il cerchio viene riconosciuto come tale, e quanto sbaglia il raggio;
//   2. il contorno ricostruito è più vicino alla verità della scalinata da cui viene? (se no, il
//      riconoscimento è un abbellimento inutile);
//   3. il foro quadrato che perdeva un angolo (difetto misurato in `test/smoke.mjs`) torna intero?
//
//   npx esbuild apps/pittorico/scripts/forme.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/forme.mjs
//   node apps/pittorico/scripts/forme.mjs

import { traceRegions, polygonArea, NO_COLOR, type Polyline } from '@rg/core';
import { regolarizzaAnello, fitCerchio } from '../src/primitives.ts';

const n2 = (v: number): string => v.toFixed(2);
const n3 = (v: number): string => v.toFixed(3);
const n4 = (v: number): string => v.toFixed(4);

/** Un cerchio rasterizzato: il pixel è pieno se il suo CENTRO sta dentro. Raggio noto. */
function cerchioRaster(raggioPx: number, margine = 4): { idx: Uint8Array; W: number; H: number; cxPx: number; cyPx: number } {
  const lato = Math.ceil(raggioPx * 2) + margine * 2;
  const W = lato, H = lato;
  const cx = W / 2, cy = H / 2;
  const idx = new Uint8Array(W * H).fill(NO_COLOR);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= raggioPx) idx[y * W + x] = 1;
    }
  }
  return { idx, W, H, cxPx: cx, cyPx: cy };
}

/** Lo scostamento peggiore di un contorno dal cerchio VERO, in mm. */
function scostamentoDalVero(ring: Polyline, cx: number, cy: number, r: number): number {
  let peggio = 0;
  for (const p of ring) {
    const d = Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
    if (d > peggio) peggio = d;
  }
  return peggio;
}

const area = (ring: Polyline): number => Math.abs(polygonArea(ring));

console.log('');
console.log('PUNTO PITTORICO — riconoscimento delle forme nette, contro verità nota');

// ---------------------------------------------------------------------------------------------
// 1. IL CERCHIO. Raggi diversi e scale diverse: quello che conta è quanti PIXEL fa il raggio,
//    perché è da lì che dipende quanto è grossa la scalinata rispetto alla forma.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('1. IL CERCHIO — raggio vero contro raggio ricostruito');
console.log(`   ${'raggio px'.padStart(9)} ${'mm/px'.padStart(6)} ${'raggio vero'.padStart(11)} ${'tol mm'.padStart(7)} ${'cerchio?'.padStart(8)} ${'raggio ric.'.padStart(11)} ${'errore mm'.padStart(9)} ${'scal. dal vero'.padStart(14)} ${'ric. dal vero'.padStart(13)}`);

for (const [raggioPx, mmPerPx] of [[12, 0.5], [30, 0.5], [60, 0.5], [30, 0.2], [120, 0.1]] as Array<[number, number]>) {
  const { idx, W, H, cxPx, cyPx } = cerchioRaster(raggioPx);
  const rVero = raggioPx * mmPerPx;
  const cxVero = cxPx * mmPerPx, cyVero = cyPx * mmPerPx;
  // si traccia con semplificazione FINE: il riconoscimento vuole la scalinata vera, non una già
  // smussata da una tolleranza che non ha scelto lui
  const reg = traceRegions(idx, W, H, 1, mmPerPx, { simplifyMm: mmPerPx * 0.1 })[0];
  if (!reg) { console.log(`   r=${raggioPx}px: nessuna regione`); continue; }
  const scalinata = scostamentoDalVero(reg.outer, cxVero, cyVero, rVero);

  for (const q of [0.5, 1, 1.5, 2]) {
    const tol = mmPerPx * q;
    const r = regolarizzaAnello(reg.outer, { tolMm: tol });
    const cerchio = r.pezzi.find((p) => p.tipo === 'cerchio');
    const rRic = cerchio && cerchio.tipo === 'cerchio' ? cerchio.r : (fitCerchio(r.ring)?.r ?? NaN);
    console.log(`   ${String(raggioPx).padStart(9)} ${n2(mmPerPx).padStart(6)} ${n3(rVero).padStart(11)} ${`${n3(tol)} (${q}px)`.padStart(7 + 6)} ${(r.cerchioIntero ? 'SI' : `no (${r.pezzi.length} pezzi)`).padStart(8)} ${n4(rRic).padStart(11)} ${n4(Math.abs(rRic - rVero)).padStart(9)} ${n4(scalinata).padStart(14)} ${n4(scostamentoDalVero(r.ring, cxVero, cyVero, rVero)).padStart(13)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 2. IL QUADRATO. Deve uscire in quattro segmenti, non in un arco di raggio assurdo: è la prova
//    che la retta ha davvero la precedenza sull'arco.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('2. IL RETTANGOLO — quattro segmenti, e l\'area che torna');
{
  const W = 60, H = 40, mmPerPx = 0.5;
  const idx = new Uint8Array(W * H).fill(NO_COLOR);
  for (let y = 6; y <= 33; y++) for (let x = 8; x <= 49; x++) idx[y * W + x] = 1;
  const areaVera = 42 * 28 * mmPerPx * mmPerPx;
  const reg = traceRegions(idx, W, H, 1, mmPerPx, { simplifyMm: mmPerPx * 0.1 })[0];
  console.log(`   area vera ${n3(areaVera)} mm2 · contorno tracciato ${reg.outer.length} punti, area ${n3(area(reg.outer))}`);
  for (const q of [0.5, 1, 2]) {
    const r = regolarizzaAnello(reg.outer, { tolMm: mmPerPx * q });
    const tipi = r.pezzi.map((p) => p.tipo).join('+') || '(nessuna)';
    console.log(`   tol ${n3(mmPerPx * q)} mm  →  ${String(r.pezzi.length).padStart(2)} pezzi [${tipi}]  area ${n3(area(r.ring))}  errore ${n4(Math.abs(area(r.ring) - areaVera))} mm2`);
  }
}

// ---------------------------------------------------------------------------------------------
// 3. IL FORO CHE PERDEVA UN ANGOLO. È il difetto misurato nel lucchetto di `traceRegions`: una
//    macchia 12x12 px con un foro 4x4, a 0,5 mm/px, deve dare 36 - 4 = 32 mm2 netti, e ne dava
//    32,5 perché la semplificazione toglieva un vertice all'anello del foro.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('3. IL FORO CHE PERDEVA UN ANGOLO — 36 meno 4 deve fare 32');
{
  const W = 40, H = 30, mmPerPx = 0.5;
  const idx = new Uint8Array(W * H).fill(NO_COLOR);
  for (let y = 4; y <= 15; y++) for (let x = 4; x <= 15; x++) idx[y * W + x] = 1;
  for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) idx[y * W + x] = NO_COLOR;

  const conDefault = traceRegions(idx, W, H, 1, mmPerPx)[0];
  console.log(`   semplificazione di default (${n2(Math.max(0.2, mmPerPx * 1.2))} mm): netta ${n3(conDefault.areaMm2)} mm2, foro ${n3(area(conDefault.holes[0]))} (dovrebbe essere 4,000)`);

  const fine = traceRegions(idx, W, H, 1, mmPerPx, { simplifyMm: mmPerPx * 0.1 })[0];
  for (const q of [0.5, 1, 2]) {
    const tol = mmPerPx * q;
    const outer = regolarizzaAnello(fine.outer, { tolMm: tol });
    const foro = regolarizzaAnello(fine.holes[0], { tolMm: tol });
    const netta = area(outer.ring) - area(foro.ring);
    console.log(`   riconoscimento a tol ${n3(tol)} mm: contorno [${outer.pezzi.map((p) => p.tipo).join('+') || 'grezzo'}] ${n3(area(outer.ring))} · foro [${foro.pezzi.map((p) => p.tipo).join('+') || 'grezzo'}] ${n3(area(foro.ring))} · netta ${n3(netta)}`);
  }
}
console.log('');

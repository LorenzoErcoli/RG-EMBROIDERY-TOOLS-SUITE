// PROVA DEL RICONOSCIMENTO DEI CAPI, contro verita' nota e sul ricamo vero.
//
//   npx esbuild apps/sfrangiatura/scripts/capi.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/sfrangiatura/scripts/capi.mjs
//   node apps/sfrangiatura/scripts/capi.mjs BRIEFING-RASO-OMOGENEO/riferimento-a-mano.dst
import { readFileSync } from 'node:fs';
import { buildParallelFill, buildDst, readDst, type Point } from '@rg/core';
import { leggiRaso } from '../src/rasi.ts';

const n2 = (v: number): string => v.toFixed(2);

// --- 1. verita' nota: un raso generato dal core, dove le file le conosco gia'
const larghezza = 20, altezza = 12, passo = 0.4;
const rett: Point[] = [{ x: 0, y: 0 }, { x: larghezza, y: 0 }, { x: larghezza, y: altezza }, { x: 0, y: altezza }];
const righe = buildParallelFill(rett, [], { angleDeg: 0, spacingMm: passo, maxStitchMm: 3, mode: 'serpentine' });
const attese = Math.floor(altezza / passo) + 1;
console.log(`\nVERITA' NOTA — rettangolo ${larghezza}x${altezza} mm, passo ${passo}: ${righe.length} polilinea/e, ${attese} file attese`);
// il core restituisce le righe SEPARATE; un raso cucito e' una polilinea sola, quindi si concatenano
// nell'ordine in cui verrebbero cucite - ed e' esattamente cio' che finisce dentro un blocco del DST.
const pts: Point[] = [];
for (const r of righe) for (const p of r) pts.push(p);
const letto = leggiRaso(pts);
console.log(`  punti ${pts.length} · capi trovati ${letto.capi.length}`);
const lato0 = letto.capi.filter((c) => c.lato === 0), lato1 = letto.capi.filter((c) => c.lato === 1);
const xs0 = lato0.map((c) => c.punto.x), xs1 = lato1.map((c) => c.punto.x);
const mm = (a: number[]) => `${n2(Math.min(...a))}..${n2(Math.max(...a))}`;
console.log(`  lato 0: ${lato0.length} capi, x in ${mm(xs0)} · lato 1: ${lato1.length} capi, x in ${mm(xs1)}`);
const dirs = letto.capi.slice(1).map((c) => Math.abs(c.direzione.y));
console.log(`  direzione: |y| massimo ${n2(Math.max(...dirs))} (0 = perfettamente orizzontale, come le righe)`);

// --- 2. lo stesso raso, ma passato per un DST: i capi devono restare gli stessi
const bytes = buildDst({ label: 'PROVA', coordinate_system: 'svg', paths: [{ needle: 1, points_mm: pts.map((p) => [p.x, p.y] as [number, number]) }] });
const dopo = readDst(bytes).blocks[0].points_mm.map(([x, y]) => ({ x, y }));
const letto2 = leggiRaso(dopo);
console.log(`\nDOPO IL GIRO IN DST — punti ${dopo.length} · capi ${letto2.capi.length} (prima ${letto.capi.length})`);
let scarto = 0;
for (let i = 0; i < Math.min(letto.capi.length, letto2.capi.length); i++) {
  scarto = Math.max(scarto, Math.hypot(letto.capi[i].punto.x - letto2.capi[i].punto.x, letto.capi[i].punto.y - letto2.capi[i].punto.y));
}
console.log(`  scarto massimo di un capo: ${n2(scarto)} mm (il DST arrotonda ai decimi di mm)`);

// --- 3. il ricamo vero
const percorso = process.argv[2];
if (percorso) {
  const r = readDst(new Uint8Array(readFileSync(percorso)));
  const rasi = r.blocks.filter((b) => b.points_mm.length >= 5);
  let capiTot = 0, fileTot = 0; const lung: number[] = [];
  for (const b of rasi) {
    const l = leggiRaso(b.points_mm.map(([x, y]) => ({ x, y })));
    capiTot += l.capi.length;
    for (const c of l.capi) if (c.filaMm > 0) { fileTot++; lung.push(c.filaMm); }
  }
  lung.sort((a, b) => a - b);
  const q = (t: number): number => lung[Math.min(lung.length - 1, Math.round(t * (lung.length - 1)))];
  console.log(`\nRICAMO VERO — ${rasi.length} rasi · ${capiTot} capi · ${fileTot} file`);
  console.log(`  lunghezza della fila: p10 ${n2(q(0.1))} · mediana ${n2(q(0.5))} · p90 ${n2(q(0.9))} · massimo ${n2(q(1))} mm`);
  // stabilita' della soglia: se il deserto c'e' davvero, cambiarla non cambia niente
  for (const s of [60, 80, 90, 110, 135]) {
    let n = 0;
    for (const b of rasi) n += leggiRaso(b.points_mm.map(([x, y]) => ({ x, y })), { sogliaInversioneDeg: s }).capi.length;
    console.log(`  soglia ${s}°: ${n} capi`);
  }
}

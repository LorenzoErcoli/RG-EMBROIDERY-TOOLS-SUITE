// Smoke test dell'ecosistema. Nessun framework: `node test/smoke.mjs`.
// Serve a una cosa sola ma importante: accorgersi quando due tool rispondono
// in modo diverso alla STESSA domanda geometrica (vedi COSTITUZIONE R28).
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(here, '.build');

// Il core importa senza estensioni: Node da solo non ce la fa, esbuild sì.
mkdirSync(outDir, { recursive: true });
const posix = (p) => join(root, p).replace(/\\/g, '/');
const entry = join(outDir, 'entry.ts');
writeFileSync(entry, `
export { parseImportedBoundarySource, generatePattern } from ${JSON.stringify(posix('packages/pattern-grammar/src/index.ts'))};
export { generateFill, generatePasses, defaultInterlaceParams } from ${JSON.stringify(posix('apps/interlace/src/engine.ts'))};
export { generateStitch, analyzeBitmap, buildSelectionMask, buildPalette, groupByPalette, defaultBitmapParams } from ${JSON.stringify(posix('apps/bitmap/src/engine.ts'))};
export { runBitmapPreview, runBitmapPipeline } from ${JSON.stringify(posix('apps/bitmap/src/pipeline.ts'))};
export * from ${JSON.stringify(posix('packages/core/src/index.ts'))};
`);
const bundle = join(outDir, 'bundle.mjs');
const esbuild = await import('esbuild');
await esbuild.build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', outfile: bundle,
  alias: { '@rg/core': posix('packages/core/src/index.ts') },
  logLevel: 'error',
});

const rg = await import(pathToFileURL(bundle).href);

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n         atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`}`);
};

console.log('\nR28 — chiusura del contorno, stessa risposta per tutti i tool');
const svg = readFileSync(join(here, 'fixtures/contorno-con-scarto.svg'), 'utf8');
const model = rg.parseImportedBoundarySource(svg, 'contorno-con-scarto.svg');
const path0 = model.choices[0]?.boundary.paths[0];
check('il contorno con 0.4mm di scarto è riconosciuto CHIUSO', path0?.closed, true);
check('l\'anello viene saldato esatto (ultimo punto = primo)',
  [path0?.points.at(-1)?.x, path0?.points.at(-1)?.y], [path0?.points[0].x, path0?.points[0].y]);
check('lo scarto oltre tolleranza resta aperto',
  rg.isGeometricallyClosed([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: rg.CLOSURE_TOL_MM + 0.5 }]), false);

console.log('\nR12 — colori: scritture diverse, stessa chiave di ruolo');
check('nome → hex', rg.normalizeColor('red'), '#ff0000');
check('#f00 → #ff0000', rg.normalizeColor('#F00'), '#ff0000');
check('rgb() → hex', rg.normalizeColor('rgb(255, 0, 0)'), '#ff0000');
check('alpha 0 → none', rg.normalizeColor('rgba(255,0,0,0)'), 'none');
check('il colore della fixture è normalizzato', model.choices[0]?.color, '#ff0000');

console.log('\nR11 — dimensione fisica: dichiarata vs inventata');
check('200mm → 200', rg.svgPhysicalLengthToMm('200mm'), 200);
check('numero nudo → null (scala da chiedere)', rg.svgPhysicalLengthToMm('539'), null);
check('1in → 25.4', rg.svgPhysicalLengthToMm('1in'), 25.4);
check('la fixture è larga 200mm', Math.round(model.source.widthMm), 200);

console.log('\n⑥⑦⑧ — pattern-grammar: le conversioni non cambiano la geometria');
const base = { totalWidth: 120, totalHeight: 160 };
const geom = (svg) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
const strokeOf = (svg) => /stroke-width[:="\s]*([\d.]+)/.exec(svg)[1];
// ⑥ il filo disegnato è sempre 0.1 (R15), lo spessore di costruzione non lo tocca
check('filo = 0.1 (R15) a prescindere da constructionStroke',
  strokeOf(rg.generatePattern({ ...base, constructionStroke: 3 })), '0.1');
check('constructionStroke muove la geometria',
  geom(rg.generatePattern({ ...base, constructionStroke: 0.3 })) !== geom(rg.generatePattern({ ...base, constructionStroke: 3 })), true);
// ⑦ onda: lunghezza d'onda (mm) e fase (gradi) == frequenza (rad/mm) e fase (rad)
const wv = { ...base, columnWaveAmplitude: 5, columnWaveLengthMm: 40 };
check("onda: 40mm ≡ freq 2π/40",
  geom(rg.generatePattern(wv)) === geom(rg.generatePattern({ ...base, columnWaveAmplitude: 5, columnWaveFrequency: (2 * Math.PI) / 40 })), true);
check('onda: fase 90° ≡ π/2 rad',
  geom(rg.generatePattern({ ...wv, columnWavePhaseDeg: 90 })) === geom(rg.generatePattern({ ...wv, columnWavePhase: Math.PI / 2 })), true);
// ⑧ i nomi canonici == i vecchi nomi (fallback nel motore)
check('minStitchMm/maxStitchMm ≡ minPointDistance/maxStitchLength',
  geom(rg.generatePattern({ ...base, minStitchMm: 2, maxStitchMm: 5 })) === geom(rg.generatePattern({ ...base, minPointDistance: 2, maxStitchLength: 5 })), true);

console.log('\n⑤ — larghezza esatta: il formato è il pannello, il resto si taglia al bordo');
const dims = (svg) => { const m = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg); return { w: +m[1], h: +m[2] }; };
const maxX = (svg) => { let mx = 0; for (const m of svg.matchAll(/points="([^"]+)"/g)) for (const p of m[1].trim().split(/\s+/)) { const x = +p.split(',')[0]; if (Number.isFinite(x)) mx = Math.max(mx, x); } return mx; };
const s200 = rg.generatePattern({ totalWidth: 200, totalHeight: 160 });
check('200mm chiesti → width esatta 200 (non 209.8)', dims(s200).w, 200);
check('niente geometria oltre il bordo del pannello', maxX(s200) <= 200 + 0.05, true);
check('formato più grande della geometria → esatto, senza allargare oltre', dims(rg.generatePattern({ totalWidth: 400, totalHeight: 300 })).w, 400);

console.log('\ninterlace — riempimento: dentro il bordo, fuori dai vuoti, punto in [min,max]');
const iSquare = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 100 }, { x: 0, y: 100 }];
const iVoid = (() => { const a = []; for (let i = 0; i <= 28; i++) { const t = (i / 28) * 2 * Math.PI; a.push({ x: 80 + Math.cos(t) * 18, y: 35 + Math.sin(t) * 18 }); } return a; })();
const iParams = { ...rg.defaultInterlaceParams, minStitchMm: 6, maxStitchMm: 15, densitySpacingMm: 1.2, voidClearanceMm: 0.6 };
const iRuns = rg.generateFill(iSquare, [iVoid], iParams); // lista di tratti
const iPts = iRuns.flat();
let iInVoid = 0, iOut = 0, iShort = 0, iLong = 0, iOverEscape = 0, iN = 0;
for (const p of iPts) { if (rg.pointInPolygon(p, iVoid)) iInVoid++; if (!rg.pointInPolygon(p, iSquare)) iOut++; }
// lunghezze SOLO dentro ogni tratto (tra tratti c'è un salto a penna alzata, non un punto). R4 è un tetto
// a 15mm per il punto NORMALE; le mosse di "escape" (quando il filo è bloccato e attraversa l'area per
// raggiungere un vuoto) possono arrivare a max+2 = 17mm — sono rare (<1%) e mai oltre 17.
for (const run of iRuns) for (let i = 1; i < run.length; i++) { const d = Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y); iN++; if (d < 6 - 0.01) iShort++; if (d > 15 + 0.01) iLong++; if (d > 17 + 0.01) iOverEscape++; }
check('genera un tracciato non vuoto', iPts.length > 100, true);
check('nessun punto dentro il vuoto (R5)', iInVoid, 0);
check('nessun punto fuori dal bordo', iOut, 0);
check('nessun segmento sotto il punto minimo (R3)', iShort, 0);
check('nessun segmento oltre max+2 (R4, tolleranza escape)', iOverEscape, 0);
check('segmenti oltre max solo negli escape (<1%)', iLong <= Math.ceil(iN * 0.01), true);

// interlace — AGGLOMERATI (clusterMode): zone di colore, ma NIENTE runaway (le zone hanno una base ovunque
// così il filo resta continuo/attraversabile) e i vuoti restano rispettati.
const clParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 2, voidClearanceMm: 0.4, clusterMode: true };
const clPasses = rg.generatePasses(iSquare, [iVoid], clParams, [2, 2, 2, 2]); // 4 colori a zone
let clInVoid = 0, clMm = 0;
for (const pass of clPasses) for (const run of pass) { for (const p of run) { if (rg.pointInPolygon(p, iVoid)) clInVoid++; } for (let i = 1; i < run.length; i++) clMm += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y); }
console.log('\ninterlace — agglomerati (zone di colore, no runaway)');
check('cluster: genera 4 passate', clPasses.length, 4);
check('cluster: nessun punto nel vuoto (R5)', clInVoid, 0);
check('cluster: filo entro un limite sano (no runaway)', clMm < 500000, true);

// bitmap → stitch — selezione pixel, quantizzazione, punti dentro l'immagine, punto minimo (R3), seed.
// Immagine sintetica 24×12: due blocchi di colore distinti su sfondo bianco (bianco NON selezionato).
console.log('\nbitmap — selezione, colori, punto minimo, determinismo');
const bW = 24, bH = 12;
const bBuf = new Uint8ClampedArray(bW * bH * 4);
for (let i = 0; i < bW * bH; i++) { const o = i * 4; bBuf[o] = 255; bBuf[o + 1] = 255; bBuf[o + 2] = 255; bBuf[o + 3] = 255; }
const bPut = (x, y, r, g, b) => { const o = (y * bW + x) * 4; bBuf[o] = r; bBuf[o + 1] = g; bBuf[o + 2] = b; bBuf[o + 3] = 255; };
for (let y = 2; y < 10; y++) for (let x = 2; x < 8; x++) bPut(x, y, 0x20, 0x40, 0x8a);   // navy, 48 px
for (let y = 2; y < 10; y++) for (let x = 14; x < 20; x++) bPut(x, y, 0xb0, 0x30, 0x40); // cremisi, 48 px

const bMask = rg.buildSelectionMask(bBuf, bW, bH, rg.defaultBitmapParams);
let bSel = 0; for (const v of bMask) bSel += v;
check('soglia: seleziona solo i pixel colorati (bianco escluso)', bSel, 96);
check('quantizzazione: 2 colori richiesti → 2 colori', rg.buildPalette(bBuf, bMask, 2).length, 2);

// carpet, niente griglia/filtro: i punti restano = pixel selezionati; verifico che stiano nell'immagine.
const bP0 = { ...rg.defaultBitmapParams, colorCount: 2, densitySpacingMm: 0, minStitchMm: 0, maxWidthPx: 0 };
const bR0 = rg.generateStitch(bBuf, bW, bH, bP0, 1.0);
let bTot = 0, bOut = 0;
for (const c of bR0.colors) { bTot += c.points.length; for (const p of c.points) if (p.x < 0 || p.y < 0 || p.x >= bW || p.y >= bH) bOut++; }
check('nessuna perdita di punti senza griglia/filtro', bTot, 96);
check('nessun punto fuori dall’immagine', bOut, 0);

// punto minimo (R3): mmPerPx=1 → minDistPx=2; ogni segmento consecutivo dentro un colore ≥ 2 (− ε).
const bP1 = { ...rg.defaultBitmapParams, colorCount: 2, densitySpacingMm: 0, minStitchMm: 2, ordering: 'scanline', maxWidthPx: 0 };
const bR1 = rg.generateStitch(bBuf, bW, bH, bP1, 1.0);
let bShort = 0;
for (const c of bR1.colors) for (let i = 1; i < c.points.length; i++) { const d = Math.hypot(c.points[i].x - c.points[i - 1].x, c.points[i].y - c.points[i - 1].y); if (d < 2 - 0.01) bShort++; }
check('nessun segmento sotto il punto minimo (R3)', bShort, 0);

// determinismo del seed (stile degradé): stesso seed → stesso identico risultato (riproducibile).
const bPd = { ...rg.defaultBitmapParams, colorCount: 2, style: 'degrade', degradeDrop: 0.3, degradeJitterMm: 0.5, seed: 7, maxWidthPx: 0 };
const bDa = rg.generateStitch(bBuf, bW, bH, bPd, 1.0);
const bDb = rg.generateStitch(bBuf, bW, bH, bPd, 1.0);
check('degradé: stesso seed → stesso risultato', JSON.stringify(bDa.colors), JSON.stringify(bDb.colors));

// fase PREVIEW (leggera): analizza senza ordinare → stessi colori e pixel selezionati della generazione.
const bAn = rg.analyzeBitmap(bBuf, bW, bH, bP0, 1.0);
check('preview: pixel selezionati coerenti', bAn.selectedPixels, 96);
check('preview: 2 colori come la generazione', bAn.colors.length, bR0.colors.length);
check('preview: punti dentro l’immagine', bAn.colors.every((c) => c.points.every((p) => p.x >= 0 && p.y >= 0 && p.x < bW && p.y < bH)), true);

// filtro "solo un colore" (onlyColor): la generazione emette solo la tinta richiesta.
const bOnly = bAn.colors[0].color;
const bR2 = rg.generateStitch(bBuf, bW, bH, bP0, 1.0, bOnly);
check('onlyColor: genera un solo colore', bR2.colors.length, 1);
check('onlyColor: è il colore richiesto', bR2.colors[0].color.toUpperCase(), bOnly.toUpperCase());

// densità GLOBALE (R22): dirada in modo uniforme senza far sparire i colori piccoli.
// Immagine 60×24: blocco navy grande + un piccolo punto cremisi (pochi pixel).
const gW = 60, gH = 24, gBuf = new Uint8ClampedArray(gW * gH * 4);
for (let i = 0; i < gW * gH; i++) { const o = i * 4; gBuf[o] = 255; gBuf[o + 1] = 255; gBuf[o + 2] = 255; gBuf[o + 3] = 255; }
const gPut = (x, y, r, g, b) => { const o = (y * gW + x) * 4; gBuf[o] = r; gBuf[o + 1] = g; gBuf[o + 2] = b; gBuf[o + 3] = 255; };
for (let y = 3; y < 21; y++) for (let x = 3; x < 45; x++) gPut(x, y, 0x20, 0x40, 0x8a); // navy grande (~756 px)
for (let y = 10; y < 14; y++) for (let x = 52; x < 56; x++) gPut(x, y, 0xc0, 0x20, 0x20); // cremisi piccolo (16 px)
const gP = { ...rg.defaultBitmapParams, colorCount: 2, minStitchMm: 0, maxWidthPx: 0, densitySpacingMm: 3 };
const gA = rg.analyzeBitmap(gBuf, gW, gH, gP, 1.0);            // densità grossa (cella 3px)
check('densità globale: entrambi i colori restano (piccolo non sparisce)', gA.colors.length, 2);
check('densità globale: il colore piccolo ha almeno un punto', gA.colors.every((c) => c.preparedCount >= 1), true);
// più densa (cella più piccola) → più punti totali; più rada → meno. Uniforme sul globale.
const gTot = (d) => rg.analyzeBitmap(gBuf, gW, gH, { ...gP, densitySpacingMm: d }, 1.0).colors.reduce((s, c) => s + c.preparedCount, 0);
check('densità globale: cella piccola = più punti, cella grande = meno', gTot(1.5) > gTot(4), true);

// densità: NON deve bucare un colore dove si mescola/confina con un altro (bordi sfumati delle foto).
// 64×16: base a sinistra, accento a destra, striscia centrale [24,40) a SCACCHIERA (pixel alternati).
const dW = 64, dH = 16, dBuf = new Uint8ClampedArray(dW * dH * 4);
for (let i = 0; i < dW * dH; i++) { const o = i * 4; dBuf[o] = 255; dBuf[o + 1] = 255; dBuf[o + 2] = 255; dBuf[o + 3] = 255; }
const dPut = (x, y, r, g, b) => { const o = (y * dW + x) * 4; dBuf[o] = r; dBuf[o + 1] = g; dBuf[o + 2] = b; dBuf[o + 3] = 255; };
const NAVY = [0x20, 0x40, 0x8a], BROWN = [0x9a, 0x5a, 0x2a];
for (let y = 2; y < 14; y++) for (let x = 4; x < 60; x++) {
  let c = NAVY;
  if (x >= 40) c = BROWN;
  else if (x >= 24) c = ((x + y) % 2 === 0) ? NAVY : BROWN;   // striscia a scacchiera
  dPut(x, y, c[0], c[1], c[2]);
}
const dP = { ...rg.defaultBitmapParams, colorCount: 2, minStitchMm: 0, maxWidthPx: 0, densitySpacingMm: 4 };
const dA = rg.analyzeBitmap(dBuf, dW, dH, dP, 1.0);
const midHas = (c) => c.points.some((p) => p.x >= 24 && p.x < 40);
check('densità: due colori nella scacchiera', dA.colors.length, 2);
check('densità: nessun colore si buca nella zona mista (proporzionale, no maggioranza)', dA.colors.every(midHas), true);
// nessun punto condiviso da due colori (un punto = un filo): tecnicamente corretto, no overlap.
const dPos = new Map(); let dOverlap = 0;
for (const c of dA.colors) for (const p of c.points) { const k = p.x + ',' + p.y; if (dPos.has(k) && dPos.get(k) !== c.color) dOverlap++; else dPos.set(k, c.color); }
check('densità: nessun punto condiviso da due colori (no overlap)', dOverlap, 0);

// copertura "tutta l'immagine": ignora soglia/sfondo, riduce TUTTO a N colori → ogni pixel punciato.
const bAll = { ...rg.defaultBitmapParams, coverage: 'all', colorCount: 2, densitySpacingMm: 0, minStitchMm: 0, maxWidthPx: 0 };
let selAll = 0; for (const v of rg.buildSelectionMask(bBuf, bW, bH, bAll)) selAll += v;
check('copertura "tutta": seleziona tutti i pixel (soglia/sfondo ignorati)', selAll, bW * bH);
const bRAll = rg.generateStitch(bBuf, bW, bH, bAll, 1.0);
check('copertura "tutta": ogni pixel punciato con N colori', bRAll.colors.reduce((s, c) => s + c.points.length, 0), bW * bH);

// anteprima: disegna TUTTI i punti (base inclusa), non un tetto per-colore che nasconde la base.
const bPv = rg.runBitmapPreview(bBuf, bW, bH, bAll, 1.0);
const bDrawn = (bPv.svg.match(/M/g) || []).length;
const bListed = bPv.colors.reduce((s, c) => s + c.preparedCount, 0);
check('anteprima: puntini disegnati = punti totali (niente base nascosta)', bDrawn, bListed);

// export DST (Tajima): gli stessi exportLayers dell'SVG → file .dst con header valido e byte non vuoti.
const bDstRes = rg.runBitmapPipeline(bBuf, bW, bH, bP0, 1.0);
const bDst = rg.dstFromExportLayers(bDstRes.exportLayers, { label: 'TEST' });
check('DST: header Tajima "LA:"', String.fromCharCode(bDst[0], bDst[1], bDst[2]), 'LA:');
check('DST: corpo non vuoto oltre l’header (512 byte)', bDst.length > 512, true);
check('DST: termina con END (0x00 0x00 0xF3)', [bDst.at(-3), bDst.at(-2), bDst.at(-1)], [0, 0, 0xf3]);

// core — round-trip del metadata: i parametri salvati nell'SVG si rileggono al reimport (R27).
console.log('\ncore — parametri salvati e riletti dall’SVG (R27)');
const rtParams = { densitySpacingMm: 5, colors: ['#123456'], colorDensities: [3] };
const rtSvg = rg.buildSvg(
  [{ id: 'stop-0000', color: '#123456', polylines: [[{ x: 0, y: 0 }, { x: 5, y: 0 }]], strokeMm: 0.3 }],
  { bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, marginMm: 2, metadata: { rgProject: 'interlace', params: rtParams, roles: { '#123456': 'MASTER_OUTLINE' } } },
);
const rtBack = rg.readProjectMetadata(rtSvg);
check('metadata riletto (rgProject)', rtBack?.rgProject, 'interlace');
check('metadata riletto (parametri identici)', JSON.stringify(rtBack?.params), JSON.stringify(rtParams));
check('metadata riletto (ruoli)', rtBack?.roles?.['#123456'], 'MASTER_OUTLINE');
check('SVG senza metadata → null', rg.readProjectMetadata('<svg></svg>'), null);

// core — export ricamo Tajima .dst. Output BLOCCATO al valore identico al writer standalone di riferimento
// (verificato byte-per-byte): stesso programma → 569 byte, header "LA:", record finale END (00 00 F3).
console.log('\ncore — export DST (Tajima)');
const dstProg = { label: 'RGTEST', coordinate_system: 'svg', paths: [
  { needle: 1, points_mm: [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]] },
  { needle: 1, points_mm: [[5, 5], [8, 8], [3, 11]] },
  { needle: 2, points_mm: [[30, 0], [31.3, 4.7], [28, 9]] },
] };
const dstBytes = rg.buildDst(dstProg);
check('DST byte totali (identico al writer di riferimento)', dstBytes.length, 569);
check('DST inizia con "LA:"', String.fromCharCode(dstBytes[0], dstBytes[1], dstBytes[2]), 'LA:');
check('DST termina col record END (00 00 F3)', dstBytes[dstBytes.length - 3] === 0 && dstBytes[dstBytes.length - 2] === 0 && dstBytes[dstBytes.length - 1] === 0xF3, true);

// adattatore riusabile ExportLayer[] → DST (la "possibilità" globale per tutti i tool): salta i layer
// 'shapeOnly' (riferimenti/forme), un ago per layer cucito → cambio-colore in sequenza.
const dstLayers = [
  { id: 'reference', color: '#ccc', polylines: [[{ x: 0, y: 0 }, { x: 50, y: 0 }]], shapeOnly: true }, // ignorato
  { id: 'stop-0', color: '#111', polylines: [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]] },
  { id: 'stop-1', color: '#222', polylines: [[{ x: 5, y: 5 }, { x: 8, y: 8 }]] },
];
const dl = rg.dstFromExportLayers(dstLayers, { label: 'LAYERS' });
const dlHead = String.fromCharCode(...dl.slice(0, 80));
check('DST-da-layers: header "LA:"', dlHead.startsWith('LA:'), true);
check('DST-da-layers: 2 layer cuciti → 1 cambio-colore', dlHead.includes('CO:  1'), true);
check('DST-da-layers: record END', dl[dl.length - 1], 0xF3);
let dlThrew = false;
try { rg.dstFromExportLayers([{ id: 'r', color: '#ccc', polylines: [[{ x: 0, y: 0 }, { x: 1, y: 0 }]], shapeOnly: true }]); } catch { dlThrew = true; }
check('DST-da-layers: solo forme → errore (niente da cucire)', dlThrew, true);

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `\n${failed} test falliti\n` : '\nTutti i test passati\n');
process.exit(failed ? 1 : 0);

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
export { buildRawLevels, computeGridCounts, moduleFromPolylines, parseModuleSvg, defaultObliqueParams, resolveBoundaries, buildLaserExport, filterLevelByHoles, rectBoundaryOf, boundaryFromFormat, boundaryFromPoints, contourBoundary, simplifyLoop, isInside, applyModuleClipMode, cleanupPolylines, subtractExclusions, cleanupVoids, applyVoids, generateOblique, connectLayerContinuity, connectTechnicalDiagonals, enforceMinimumStitch, reconnectCutFragmentsOnBoundary } from ${JSON.stringify(posix('apps/oblique/src/engine.ts'))};
export { runBitmapPreview, runBitmapPipeline } from ${JSON.stringify(posix('apps/bitmap/src/pipeline.ts'))};
export { buildNet } from ${JSON.stringify(posix('apps/net-45/src/net.ts'))};
export { generateStriatura, layerThreadMm, defaultStriaturaParams } from ${JSON.stringify(posix('apps/striatura/src/engine.ts'))};
export { paletteToColors, applyDensityToAll, colorsToPalette, clampColorCount, mmPerPixel, defaultBroccatoParams } from ${JSON.stringify(posix('apps/broccato/src/engine.ts'))};
export { reduceStable, prepareImage, flattenLight, despeckle, refinePalette, removeSmallBlobs, NO_COLOR } from ${JSON.stringify(posix('apps/broccato/src/reduce.ts'))};
export { traceRegions, pointInRegion, regionsAreaMm2 } from ${JSON.stringify(posix('apps/broccato/src/regions.ts'))};
export { buildCoverGrid, routeColorRuns, CELL_COVERED, CELL_OWN, CELL_EDGE, CELL_BARE } from ${JSON.stringify(posix('apps/broccato/src/routing.ts'))};
export { buildPlan } from ${JSON.stringify(posix('apps/broccato/src/pipeline.ts'))};
export { sampleImage as sampleBroccatoImage } from ${JSON.stringify(posix('apps/broccato/src/sample.ts'))};
export { runPipeline as runStriaturaPipeline } from ${JSON.stringify(posix('apps/striatura/src/pipeline.ts'))};
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

// Archi ellittici (comando `A`) nell'importer a stringhe: prima venivano TIRATI DRITTI fino al punto
// finale — su una sagoma con raccordi curvi il contorno usciva spigoloso e la misura sbagliata.
// Fixture: quadrato 100×100 con un semicerchio (r=50) attaccato sotto → la sagoma è alta 150, non 100.
console.log('\narchi ellittici: il comando A è una CURVA, non una scorciatoia');
const arcSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="150mm" viewBox="0 0 100 150">
  <path d="M 0 0 L 100 0 L 100 100 A 50 50 0 0 1 0 100 Z" fill="none" stroke="#ff0000"/>
</svg>`;
const arcBoundary = rg.parseImportedBoundarySource(arcSvg, 'arco.svg').choices[0].boundary;
const arcBelly = arcBoundary.paths[0].points.filter((p) => p.y > 100.001);
let arcErr = 0;
for (const p of arcBelly) arcErr = Math.max(arcErr, Math.abs(Math.hypot(p.x - 50, p.y - 100) - 50));
check('l\'arco è campionato (non due punti e via)', arcBelly.length >= 8, true);
check('i punti stanno sul cerchio (errore < 0.01mm)', arcErr < 0.01, true);
check('la sagoma è alta 150mm: la pancia dell\'arco NON si perde',
  Math.round(arcBoundary.bounds.maxY - arcBoundary.bounds.minY), 150);
const arcZero = rg.parseImportedBoundarySource(
  arcSvg.replace('A 50 50 0 0 1 0 100', 'A 0 0 0 0 1 0 100'), 'arco0.svg').choices[0].boundary;
check('raggio zero → segmento retto (come da specifica SVG)',
  Math.round(arcZero.bounds.maxY - arcZero.bounds.minY), 100);

// I FILE VERI di Lorenzo (gli SVG sorgente di oblique, committati in apps/oblique/fixtures/).
// Fino a ieri i test giravano solo su fixture sintetiche: qui l'importer legge i file che il tool
// riceve davvero — compreso il golden da 2MB, che lo faceva esplodere.
console.log('\nfile veri: gli SVG sorgente di oblique passano dall\'importer');
const realSvg = (name) => readFileSync(join(root, 'apps/oblique/fixtures', name), 'utf8');
const liv1 = rg.parseImportedBoundarySource(realSvg('1livello-oblique-fermatura pannello-puntoricamo.svg'), 'liv1.svg');
check('livello 1: i contorni sono chiusi (sono sagome, non tracciati)',
  liv1.choices[0].boundary.paths.every((p) => p.closed), true);
check('livello 1: misura reale ~82.6 × 74.9 mm',
  [Math.round(liv1.source.widthMm), Math.round(liv1.source.heightMm)], [83, 75]);
check('livello 1: colore Illustrator normalizzato', liv1.choices[0].color, '#e30613');
const liv2 = rg.parseImportedBoundarySource(realSvg('2livello-oblique-disegno-puntoricamo.svg'), 'liv2.svg');
check('livello 2: i 15 tracciati del disegno arrivano tutti', liv2.choices[0].boundary.paths.length, 15);
// Il golden completo (2MB, centinaia di migliaia di punti) faceva "Maximum call stack size exceeded"
// in boundsOf (`Math.min(...xs)`, uno spread con un argomento per punto). Ora è un ciclo.
const golden = rg.parseImportedBoundarySource(realSvg('oblique-punto-ricamo-completo.svg'), 'golden.svg');
check('il golden da 2MB si apre (prima: stack overflow nell\'ingombro)', golden.choices.length > 0, true);
check('il golden misura ~1178 × 1019 mm',
  [Math.round(golden.source.widthMm), Math.round(golden.source.heightMm)], [1178, 1019]);

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

// La GEOMETRIA del generatore pattern (finora si provavano solo formato e conversioni).
console.log('\npattern-grammar — la geometria generata: dentro il formato, punto massimo, manopole');
const pgLines = (svg) => {
  const out = [];
  for (const m of svg.matchAll(/points="([^"]+)"/g)) {
    out.push(m[1].trim().split(/\s+/).map((t) => { const [x, y] = t.split(',').map(Number); return { x, y }; })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
  for (const m of svg.matchAll(/ d="([^"]+)"/g)) {
    for (const sub of m[1].split(/(?=M)/)) {
      const nums = sub.match(/-?\d*\.?\d+/g); if (!nums) continue;
      const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: +nums[i], y: +nums[i + 1] });
      if (pts.length > 1) out.push(pts);
    }
  }
  return out;
};
const pgStats = (svg, W, H) => {
  let punti = 0, mm = 0, segMax = 0, segMin = Infinity, fuori = 0;
  const ls = pgLines(svg);
  for (const l of ls) {
    punti += l.length;
    for (const p of l) if (p.x < -0.05 || p.x > W + 0.05 || p.y < -0.05 || p.y > H + 0.05) fuori++;
    for (let i = 1; i < l.length; i++) {
      const d = Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y);
      mm += d; if (d > segMax) segMax = d; if (d < segMin) segMin = d;
    }
  }
  return { tracciati: ls.length, punti, mm, segMax, segMin, fuori };
};
const pgBase = { totalWidth: 120, totalHeight: 160 };
const pgDefault = pgStats(rg.generatePattern(pgBase), 120, 160);
check('un solo tracciato continuo', pgDefault.tracciati, 1);
check('nessun punto oltre il formato, in nessuna delle due direzioni', pgDefault.fuori, 0);
// R4 — il "punto massimo" ora vale DAVVERO: la suddivisione si rifà alla fine, dopo la riconnessione
// al bordo che creava segmenti nuovi (con 4mm chiesti ne uscivano da 7.9).
const pgMax4 = pgStats(rg.generatePattern({ ...pgBase, maxStitchMm: 4 }), 120, 160);
check('punto massimo 4mm: nessun segmento più lungo', pgMax4.segMax <= 4 + 1e-6, true);
check('suddividere NON cambia la forma (stessa lunghezza di filo)',
  Math.abs(pgMax4.mm - pgDefault.mm) < 0.5, true);
check('suddividere aggiunge punti, non li toglie', pgMax4.punti > pgDefault.punti, true);
check('senza punto massimo il motore non aggiunge niente',
  geom(rg.generatePattern({ ...pgBase, maxStitchMm: 0 })), geom(rg.generatePattern(pgBase)));
// il punto minimo dirada (non azzera: i punti strutturali del pattern sopravvivono — vedi §3)
const pgMin = pgStats(rg.generatePattern({ ...pgBase, minStitchMm: 1.5 }), 120, 160);
check('il punto minimo dirada i micro-segmenti', pgMin.segMin > pgDefault.segMin, true);
// ritaglio alla sagoma: col cerchio nessun punto esce dall'ellisse inscritta nel formato
const pgCircle = pgLines(rg.generatePattern({ ...pgBase, shapeType: 'circle' }));
let pgOutside = 0;
for (const l of pgCircle) for (const p of l) {
  const dx = (p.x - 60) / 60, dy = (p.y - 80) / 80;
  if (dx * dx + dy * dy > 1.02) pgOutside++;
}
check('sagoma cerchio: niente fuori dall\'ellisse inscritta', pgOutside, 0);
// le manopole fanno quello che dicono
check('zig-zag orizzontali più fitti = più filo',
  pgStats(rg.generatePattern({ ...pgBase, horizontalZigzagSpacing: 8 }), 120, 160).mm
  > pgStats(rg.generatePattern({ ...pgBase, horizontalZigzagSpacing: 20 }), 120, 160).mm, true);

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

// interlace — agglomerati GUIDATI DA IMMAGINE: ogni colore va DOVE l'immagine ha quel colore.
const imgSquare = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }, { x: 0, y: 80 }];
const imgSample = (x) => (x < 60 ? [229, 36, 33] : [43, 108, 176]); // metà sx rossa, metà dx blu
const imgParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 2, voidClearanceMm: 0.3, colors: ['#e52421', '#2b6cb0'], clusterMode: true, clusterStrength: 70 };
const imgPasses = rg.generatePasses(imgSquare, [], imgParams, [2, 2], (x) => imgSample(x));
const halfThread = (pass) => { let L = 0, R = 0; for (const r of pass) for (let i = 1; i < r.length; i++) { const mx = (r[i].x + r[i - 1].x) / 2, d = Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); if (mx < 60) L += d; else R += d; } return { L, R }; };
const redH = halfThread(imgPasses[0]), bluH = halfThread(imgPasses[1]);
console.log('\ninterlace — agglomerati guidati da immagine (rispettano l’immagine)');
check('immagine: rosso più denso a SINISTRA (dov’è rosso)', redH.L > redH.R, true);
check('immagine: blu più denso a DESTRA (dov’è blu)', bluH.R > bluH.L, true);

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

// palette MANUALE (contagocce): i colori-livello sono ESATTAMENTE quelli scelti, ogni pixel al più vicino.
const bMan = { ...rg.defaultBitmapParams, coverage: 'all', paletteMode: 'manual', manualColors: ['#20408a', '#b03040'], densitySpacingMm: 0, minStitchMm: 0, maxWidthPx: 0 };
const bManA = rg.analyzeBitmap(bBuf, bW, bH, bMan, 1.0);
check('palette manuale: i colori-livello sono quelli scelti (non median-cut)', bManA.colors.map((c) => c.color).sort(), ['#20408A', '#B03040']);
// palette manuale + "solo i colori scelti": la tolleranza per-colore filtra la selezione (raggio di cattura).
const bManSel = { ...rg.defaultBitmapParams, coverage: 'selected', paletteMode: 'manual', manualColors: ['#20408a'], manualTolerances: [5], densitySpacingMm: 0, minStitchMm: 0, maxWidthPx: 0 };
let selTight = 0; for (const v of rg.buildSelectionMask(bBuf, bW, bH, bManSel)) selTight += v;
let selWide = 0; for (const v of rg.buildSelectionMask(bBuf, bW, bH, { ...bManSel, manualTolerances: [200] })) selWide += v;
check('tolleranza per-colore: stretta prende solo il colore vicino, larga di più', selTight > 0 && selTight < selWide, true);

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
// Programma LUNGO: niente "Maximum call stack size exceeded" (era lo spread di Math.max su 100k+ punti).
const bigPts = [];
for (let i = 0; i < 200000; i++) bigPts.push([(i % 100) * 0.2, Math.floor(i / 100) % 100 * 0.2]);
let bigDstOk = false;
try { const b = rg.buildDst({ label: 'BIG', coordinate_system: 'svg', paths: [{ needle: 1, points_mm: bigPts }] }); bigDstOk = b.length > 512 && b[b.length - 1] === 0xF3; } catch { bigDstOk = false; }
check('DST programma lungo (200k punti) senza stack overflow', bigDstOk, true);

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

// metadata riapribile NEL .dst (R27): appeso dopo l'END → la macchina lo ignora, noi lo rileggiamo.
console.log('\ncore — parametri riapribili dal .dst (R27)');
const dstMetaLayers = [{ id: 'stop-0', color: '#111', polylines: [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]] }];
const dstMeta = { rgProject: 'bitmap', params: { threshold: 123, colorCount: 3, densitySpacingMm: 1.4 } };
const dstNo = rg.dstFromExportLayers(dstMetaLayers, { label: 'META' });
const dstYes = rg.dstFromExportLayers(dstMetaLayers, { label: 'META', metadata: dstMeta });
const dstReab = rg.readDstMetadata(dstYes);
check('DST metadata: rgProject riletto', dstReab?.rgProject, 'bitmap');
check('DST metadata: parametri identici', JSON.stringify(dstReab?.params), JSON.stringify(dstMeta.params));
check('DST senza metadata → null', rg.readDstMetadata(dstNo), null);
// machine-safe: il ricamo fino all'END è IDENTICO, il metadata è solo un footer in coda
check('DST con metadata: la cucitura (fino a END) è invariata', Array.from(dstYes.slice(0, dstNo.length)).join(','), Array.from(dstNo).join(','));
check('DST con metadata: END ancora presente e integro', [dstYes[dstNo.length - 3], dstYes[dstNo.length - 2], dstYes[dstNo.length - 1]], [0, 0, 0xF3]);

// oblique — griglia diagonale + placement (Fase A, sotto-step 2a). Moduli SINTETICI (l'engine è
// Node-safe: riceve geometrie già parsate; il parse SVG DOM vive in tool.ts). Verifica che la
// griglia condivisa nasca dal Livello 1, che i moduli coprano il formato e che il global offset trasli.
console.log('\noblique — griglia diagonale + placement (2a)');
{
  const square = (s) => [[{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }, { x: 0, y: 0 }]];
  const mod = rg.moduleFromPolylines(square(6));
  const sources = { level0: mod, level1: mod, level2: mod, holes: mod, panelBounds: null };
  const p = rg.defaultObliqueParams();

  const grid = rg.computeGridCounts(sources, p);
  check('griglia: diagonalCount > 0', grid.diagonalCount > 0, true);
  check('griglia: modulesPerDiagonal > 0', grid.modulesPerDiagonal > 0, true);
  check('griglia: vettore B = riga (dal Livello 1)', grid.vectorB.y, 54.8);

  const levels = rg.buildRawLevels(sources, p);
  const allPts = (arr) => arr.flatMap((r) => r.points);
  const l2 = allPts(levels.level2);
  check('placement: Livello 2 non vuoto', l2.length > 0, true);
  check('placement: numero polilinee = diag×mod×elementi', levels.level2.length, grid.diagonalCount * grid.modulesPerDiagonal * mod.elements.length);
  check('placement: tutti i punti finiti', l2.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)), true);
  // La griglia espansa (overflowMargin 80) supera il formato 100×100: copre tutta l'area utile.
  const coversFormat = l2.some((pt) => pt.x < 20) && l2.some((pt) => pt.x > 80) && l2.some((pt) => pt.y < 20) && l2.some((pt) => pt.y > 80);
  check('placement: i moduli coprono il formato 100×100', coversFormat, true);

  // Global pattern offset: trasla rigidamente tutte le polilinee.
  const shifted = rg.buildRawLevels(sources, { ...p, globalPatternOffsetX: 10, globalPatternOffsetY: -5 });
  const a = levels.level2[0].points[0];
  const b = shifted.level2[0].points[0];
  check('offset globale: trasla di (10,−5)', Math.abs(b.x - a.x - 10) < 1e-9 && Math.abs(b.y - a.y + 5) < 1e-9, true);

  // Livelli disattivati → vuoti; niente moduli holes/level0 → vuoti.
  const noHoles = rg.buildRawLevels({ ...sources, holes: undefined, level0: undefined }, p);
  check('holes assenti → nessuna polilinea holes', noHoles.holes.length, 0);
  check('level0 assente → nessuna polilinea level0', noHoles.level0.length, 0);
  check('determinismo: stessi input → stesso conteggio', rg.buildRawLevels(sources, p).level2.length, levels.level2.length);
}

// oblique — filtro fori su L0/L1 (Fase A, sotto-step 2b). Costruisco una griglia di "fori"
// sintetici e verifico: (a) i fori fuori dal boundary laser sono scartati (R7); (b) i moduli
// L0/L1 restano solo dove la loro cella di griglia ha un foro valido; (c) tolleranza negativa
// scarta i fori troppo vicini al bordo; (d) trimDiagonalsToHoles taglia gli estremi vuoti.
console.log('\noblique — filtro fori su L0/L1 (2b)');
{
  const p = rg.defaultObliqueParams();
  const b = rg.rectBoundaryOf(0, 0, 100, 100, 'test');
  // Fori: 4 celle su una diagonale; uno FUORI dal rettangolo (x≈130), uno a ridosso del bordo.
  const hole = (cx, cy, d, i) => ({ layer: 'holes', diagonal: d, index: i,
    points: [{ x: cx - 2, y: cy - 2 }, { x: cx + 2, y: cy - 2 }, { x: cx + 2, y: cy + 2 }, { x: cx - 2, y: cy + 2 }, { x: cx - 2, y: cy - 2 }] });
  const rawHoles = [hole(20, 50, 0, 0), hole(50, 50, 0, 1), hole(80, 50, 0, 2), hole(130, 50, 0, 3)];

  const laser = rg.buildLaserExport(rawHoles, b, b, 2);
  check('fori: quello fuori dal perimetro è scartato', laser.validCenters.length, 3);
  check('fori: gli id validi sono le celle dentro', laser.validIds.has('0:3'), false);
  check('fori: la cella 0:1 (centro) è valida', laser.validIds.has('0:1'), true);

  // Moduli L0/L1 sulle stesse celle di griglia (0:0..0:3) → tenuti solo dove il foro è valido.
  const modAt = (cx, cy, d, i) => ({ layer: 'level0', diagonal: d, index: i,
    points: [{ x: cx - 3, y: cy - 3 }, { x: cx + 3, y: cy - 3 }, { x: cx + 3, y: cy + 3 }, { x: cx - 3, y: cy + 3 }, { x: cx - 3, y: cy - 3 }] });
  const rawL0 = [modAt(20, 50, 0, 0), modAt(50, 50, 0, 1), modAt(80, 50, 0, 2), modAt(130, 50, 0, 3)];
  const kept = rg.filterLevelByHoles(rawL0, p, laser, true);
  check('L0: tenuti solo i moduli con foro valido (3 su 4)', kept.length, 3);
  check('L0: il modulo senza foro (0:3) è rimosso', kept.some((r) => r.diagonal === 0 && r.index === 3), false);
  check('L0: holes disattivati → nessun filtro (tutti tenuti)', rg.filterLevelByHoles(rawL0, p, laser, false).length, 4);

  // Tolleranza negativa: scarta i fori troppo vicini al bordo (dentro ma a < |tol| dal bordo).
  const nearEdge = [hole(3, 50, 0, 0), hole(50, 50, 0, 1)]; // il primo è a 1mm dal bordo sinistro
  const strict = rg.buildLaserExport(nearEdge, b, b, -5);
  check('fori: tolleranza negativa scarta quello vicino al bordo', strict.validCenters.length, 1);

  // trimDiagonalsToHoles: estremi vuoti tagliati. Celle 0..4, fori solo su 1..3 → tenute 1..3.
  const pTrim = { ...p, trimDiagonalsToHoles: true };
  const holes5 = [hole(30, 50, 0, 1), hole(50, 50, 0, 2), hole(70, 50, 0, 3)];
  const laser5 = rg.buildLaserExport(holes5, b, b, 2);
  const l0full = [modAt(10, 50, 0, 0), modAt(30, 50, 0, 1), modAt(50, 50, 0, 2), modAt(70, 50, 0, 3), modAt(90, 50, 0, 4)];
  const trimmed = rg.filterLevelByHoles(l0full, pTrim, laser5, true);
  const idxs = trimmed.map((r) => r.index).sort();
  check('trim: estremi vuoti (0 e 4) tagliati, tenute 1–3', JSON.stringify(idxs), JSON.stringify([1, 2, 3]));

  // Boundary da ruolo-colore (contorno poligonale) sostituisce il rettangolo di inset.
  const roleLaser = rg.boundaryFromFormat(rg.rectBoundaryOf(10, 10, 60, 60, 'r'), 'laser');
  const bnds = rg.resolveBoundaries(p, null, { laser: roleLaser });
  check('boundary: il ruolo LASER sostituisce il rettangolo di default', bnds.laser.minX, 10);
}

// oblique — clip al perimetro + void (Fase A, sotto-step 2c). Verifica che i moduli vengano
// tagliati NETTI sul bordo (strict_clip), che niente esca dal boundary, e che le aree vuote
// sottraggano il ricamo tagliando esatto sul loro bordo (R5).
console.log('\noblique — clip al perimetro + void (2c)');
{
  const p = rg.defaultObliqueParams();
  const b = rg.rectBoundaryOf(0, 0, 100, 100, 'perimetro');
  // Una linea che attraversa il bordo: da (-20,50) a (120,50) → tagliata a [0,100].
  const crossing = { layer: 'level2', diagonal: 0, index: 0, points: [{ x: -20, y: 50 }, { x: 120, y: 50 }] };
  const clipped = rg.cleanupPolylines([crossing], b, p);
  const xs = clipped.flatMap((r) => r.points.map((pt) => pt.x));
  check('clip: niente esce a sinistra del bordo', Math.min(...xs) >= -1e-6, true);
  check('clip: niente esce a destra del bordo', Math.max(...xs) <= 100 + 1e-6, true);
  check('clip: il tratto interno resta (non vuoto)', clipped.length > 0, true);

  // Un modulo interamente fuori → scartato del tutto.
  const outside = { layer: 'level2', diagonal: 0, index: 1, points: [{ x: 200, y: 200 }, { x: 210, y: 210 }] };
  check('clip: modulo tutto fuori → rimosso', rg.cleanupPolylines([outside], b, p).length, 0);

  // applyModuleClipMode strict_clip = cleanupPolylines.
  const strict = rg.applyModuleClipMode([crossing], b, 'strict_clip', p);
  check('applyModuleClipMode strict = cleanup', strict.length, clipped.length);

  // Void: un buco 40..60 al centro sottrae il ricamo che lo attraversa (taglio esatto sul bordo).
  const voidBox = rg.boundaryFromPoints([{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }, { x: 40, y: 40 }], 'void');
  const through = { layer: 'level2', diagonal: 0, index: 0, points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] };
  const sub = rg.subtractExclusions([through], [voidBox]);
  const inVoid = sub.flatMap((r) => r.points).some((pt) => pt.x > 41 && pt.x < 59 && pt.y > 41 && pt.y < 59);
  check('void: nessun punto dentro il vuoto', inVoid, false);
  check('void: il ricamo è spezzato ai due lati del vuoto', sub.length, 2);
  check('void: taglia esatto sul bordo del vuoto (x=40 e x=60)',
    sub.some((r) => r.points.some((pt) => Math.abs(pt.x - 40) < 1e-6)) && sub.some((r) => r.points.some((pt) => Math.abs(pt.x - 60) < 1e-6)), true);

  // applyVoids: OFF → invariato; con exclusions → sottrae. Fori soppressi dal void (R5).
  check('applyVoids OFF → invariato', rg.applyVoids([through], [voidBox], { ...p, enableExclusionAreas: false })[0].points.length, 2);
  const hole = { layer: 'holes', diagonal: 0, index: 0, points: [{ x: 48, y: 48 }, { x: 52, y: 48 }, { x: 52, y: 52 }, { x: 48, y: 52 }, { x: 48, y: 48 }] };
  const le = rg.buildLaserExport([hole], b, b, 2, [voidBox]);
  check('void: il foro dentro il vuoto è soppresso', le.validCenters.length, 0);
}

// oblique — routing continuo + min-stitch + lock + orchestratore (Fase A, sotto-step 2d).
// Integrazione con moduli sintetici su pannello 100×100: verifica che generateOblique produca
// un ricamo continuo, dentro il bordo (± corsia), coi fori che filtrano L0/L1, min-stitch e lock.
console.log('\noblique — routing + orchestratore (2d)');
{
  const p = rg.defaultObliqueParams();
  // Motivi sintetici: un quadretto per L0/L1/L2, un forellino per i buchi. Ancora = centro bbox.
  const square = (s) => [[{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }, { x: 0, y: 0 }]];
  const modBig = rg.moduleFromPolylines(square(8));
  const modHole = rg.moduleFromPolylines(square(3));
  const sources = { level0: modBig, level1: modBig, level2: modBig, holes: modHole, panelBounds: null };

  const res = rg.generateOblique(sources, p);
  check('orchestratore: griglia calcolata', res.grid.diagonalCount > 0 && res.grid.modulesPerDiagonal > 0, true);
  const l2pts = res.level2.flatMap((s) => s.points);
  check('L2: ricamo non vuoto', l2pts.length > 0, true);
  check('L2: filo continuo (pochi tratti, non un frammento per modulo)', res.level2.length < res.grid.diagonalCount + 5, true);
  // NIENTE esce dal formato. `app.js` portava i passaggi in una corsia larga 3mm FUORI dal pannello
  // (877mm di filo del pattern + 593 dei 672 di passaggi, misurati sul default 100×100): Lorenzo li
  // vuole dentro, quindi `perimeterLaneWidth` è 0 e questo test è il lucchetto della decisione.
  const travelPts = res.travel.flatMap((s) => s.points);
  const dentro = (pt) => pt.x >= -0.01 && pt.x <= 100.01 && pt.y >= -0.01 && pt.y <= 100.01;
  check('L2: niente esce dal formato (corsia 0, scelta di Lorenzo)', l2pts.every(dentro), true);
  check('passaggi: nemmeno loro escono dal formato', travelPts.every(dentro), true);
  check('L2: tutti i punti finiti', l2pts.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)), true);

  // Fori: filtrano L0/L1 → dove non c'è il foro (fuori dal pannello) niente piazzamento/fissaggio.
  check('fori: alcuni validi (dentro il pannello)', res.holes.length > 0, true);
  check('L1: non vuoto', res.level1.flatMap((s) => s.points).length > 0, true);

  // Min-stitch (R3): quasi nessun segmento sotto il minimo (endpoint esclusi).
  const p1 = { ...p };
  const segs = res.level2.flatMap((s) => s.points.slice(1).map((pt, i) => rgDist(s.points[i], pt)));
  const belowMin = segs.filter((d) => d < p1.minimumSegmentLength - 1e-6).length;
  check('min-stitch: <2% di segmenti sotto il minimo', belowMin / Math.max(1, segs.length) < 0.02, true);

  // Lock (R8): i tratti iniziano/finiscono a ridosso del bordo del pannello.
  const border = rg.rectBoundaryOf(0, 0, 100, 100, 'p');
  const near = res.level2.filter((s) => s.points.length > 2)
    .every((s) => rg.isInside(s.points[0], border, 4) === false || nearBorder(s.points[0]) && nearBorder(s.points[s.points.length - 1]));
  check('lock: i tratti partono/finiscono vicino al bordo', near, true);

  // Determinismo.
  const res2 = rg.generateOblique(sources, p);
  check('determinismo: stesso conteggio punti L2', res2.level2.flatMap((s) => s.points).length, l2pts.length);

  // Senza fori: L0/L1 non filtrati (più moduli restano).
  const noHoles = rg.generateOblique({ ...sources, holes: undefined }, { ...p, enableHolesLayer: false });
  check('senza fori: L1 presente (non filtrato dai buchi)', noHoles.level1.flatMap((s) => s.points).length > 0, true);

  function nearBorder(pt) { return Math.min(Math.abs(pt.x - 0), Math.abs(pt.x - 100), Math.abs(pt.y - 0), Math.abs(pt.y - 100)) < 8; }
  function rgDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Divergenza R3 bloccata: un modulo campionato FINE (segmenti < minStitch) tagliato dentro un
  // rettangolo NON deve sparire. app.js scartava i sub-min nel clip (ok col suo sampling grezzo);
  // col sampling fine del core (~0.6mm) cancellava tutto. La lunghezza minima è del pass finale (R3).
  const fineSquare = [];
  for (let i = 0; i <= 40; i++) fineSquare.push({ x: 20 + i * 0.6, y: 20 }); // segmenti 0.6mm, dentro [0,100]
  const fineClipped = rg.cleanupPolylines([{ layer: 'level2', diagonal: 0, index: 0, points: fineSquare }], rg.rectBoundaryOf(0, 0, 100, 100, 'p'), p);
  check('R3: modulo a sampling fine dentro il bordo NON sparisce nel clip', fineClipped.length > 0 && fineClipped.flatMap((r) => r.points).length > 2, true);

  // parseModuleSvg legge i punti delle polyline VERBATIM (come app.js), NON ri-campiona come il core
  // (che a 0.6mm dava ~2.7× i punti = ricamo troppo fitto, "il disastro"). Scala Illustrator pt→mm (72dpi).
  const modSvg = '<svg id="Livello_1" viewBox="0 0 72 72"><polyline points="0,0 72,0 72,72"/></svg>';
  const mod = rg.parseModuleSvg(modSvg);
  check('parseModuleSvg: legge le polyline verbatim (3 punti, non ri-campionati)', mod.elements[0].length, 3);
  check('parseModuleSvg: scala Illustrator pt→mm (72 → 25.4)', Math.round(mod.elements[0][1].x * 10) / 10, 25.4);
  const modMm = rg.parseModuleSvg('<svg viewBox="0 0 10 10"><polyline points="0,0 10,10"/></svg>');
  check('parseModuleSvg: non-Illustrator → viewBox come mm (nessuna scala)', modMm.elements[0][1].x, 10);

  // simplifyLoop: un rettangolo campionato fine (tanti punti collineari) torna a ~4 angoli, così il
  // boundary del pannello non fa esplodere il clip dei moduli (il "blocco" quando si assegna un ruolo).
  const fineRect = [];
  for (let i = 0; i <= 100; i++) fineRect.push({ x: i, y: 0 });
  for (let i = 1; i <= 100; i++) fineRect.push({ x: 100, y: i });
  for (let i = 1; i <= 100; i++) fineRect.push({ x: 100 - i, y: 100 });
  for (let i = 1; i <= 100; i++) fineRect.push({ x: 0, y: 100 - i });
  const simplified = rg.simplifyLoop(fineRect, 0.2);
  check('simplifyLoop: rettangolo campionato fine → pochi angoli (≤6)', simplified.length <= 6, true);
  const bnd = rg.boundaryFromPoints(fineRect, 'p');
  check('boundaryFromPoints: boundary semplificato (pochi punti, non ~400)', bnd.points.length <= 8, true);
  check('boundaryFromPoints: ingombro preservato (100×100)', Math.round(bnd.width) === 100 && Math.round(bnd.height) === 100, true);

  // …ma una CURVA deve restare curva: lo scarto dal contorno vero non può superare la tolleranza.
  // La vecchia semplificazione greedy misurava rispetto all'ultimo punto tenuto e l'errore si
  // accumulava: un cerchio di raggio 25 diventava un decagono con 1,5mm di scarto (verifica A1
  // punto 4). Con Douglas-Peucker lo scarto è garantito ≤ tolleranza.
  const fineCircle = [];
  const circleN = Math.round((2 * Math.PI * 25) / 0.6);
  for (let i = 0; i < circleN; i++) {
    const t = (i / circleN) * 2 * Math.PI;
    fineCircle.push({ x: 50 + Math.cos(t) * 25, y: 50 + Math.sin(t) * 25 });
  }
  const simpleCircle = rg.simplifyLoop(fineCircle, 0.2);
  const distSeg = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  let worstCircle = 0;
  for (const p of fineCircle) {
    let best = Infinity;
    for (let i = 0; i < simpleCircle.length; i++) best = Math.min(best, distSeg(p, simpleCircle[i], simpleCircle[(i + 1) % simpleCircle.length]));
    if (best > worstCircle) worstCircle = best;
  }
  check('simplifyLoop: una CURVA resta curva (scarto ≤ tolleranza 0.2mm)', worstCircle <= 0.2, true);
  check('simplifyLoop: e resta comunque leggera (un cerchio in ≤50 lati, non 262)', simpleCircle.length <= 50, true);
}

// ---------------------------------------------------------------------------------------------
// striatura (Punto Striato) — le invarianti conquistate a mano coi giri di feedback di Lorenzo,
// bloccate qui perché il rework dei passaggi non le possa perdere di nascosto:
// niente ago fuori dalla sagoma o dentro un vuoto (R5), punti mai più lunghi del passo (R4, chiesto
// esplicitamente), filo continuo, verticalità del punto striato, densità monotòna, seed ripetibile.
// Dati sintetici (rettangolo + vuoto circolare) come per interlace/bitmap/oblique: l'engine è TS puro.
{
  const sRect = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 150 }, { x: 0, y: 150 }];
  const sVoid = (() => { const a = []; for (let i = 0; i < 32; i++) { const t = (i / 32) * 2 * Math.PI; a.push({ x: 60 + Math.cos(t) * 22, y: 75 + Math.sin(t) * 22 }); } return a; })();
  const sP = rg.defaultStriaturaParams;
  const sStep = Math.max(sP.maxStitchMm, sP.travelStitchMm); // il passo più lungo ammesso dai parametri

  /** Misura una lista di polilinee contro la sagoma: fuori bordo, dentro/attraverso i vuoti, lunghezze. */
  const sMeasure = (polylines, outline, voids, minMm) => {
    let pts = 0, segs = 0, mm = 0, vertMm = 0, segMax = 0, fuori = 0, nelVuoto = 0, attraversa = 0, sottoMin = 0, zero = 0;
    for (const pl of polylines) {
      pts += pl.length;
      for (const q of pl) {
        if (!rg.pointInPolygon(q, outline)) fuori++;
        for (const v of voids) if (rg.pointInPolygon(q, v)) nelVuoto++;
      }
      for (let i = 1; i < pl.length; i++) {
        const a = pl[i - 1], b = pl[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        segs++; mm += d;
        if (d > segMax) segMax = d;
        if (Math.abs(b.x - a.x) < 1e-6) vertMm += d;   // il punto striato è verticale
        if (minMm && d < minMm - 1e-9) sottoMin++;
        if (d < 1e-9) zero++;
        // il segmento non deve solo AVERE gli estremi fuori dal vuoto: non deve attraversarlo (R5)
        const k = Math.max(1, Math.ceil(d / 0.4));
        for (let j = 0; j <= k; j++) {
          const t = j / k, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          let dentro = false;
          for (const v of voids) if (rg.pointInPolygon({ x, y }, v)) { dentro = true; break; }
          if (dentro) { attraversa++; break; }
        }
      }
    }
    return { blocchi: polylines.length, pts, segs, mm, vertPerc: mm ? (vertMm / mm) * 100 : 0, segMax, fuori, nelVuoto, attraversa, sottoMin, zero };
  };
  const sGen = (params, voids = []) => rg.generateStriatura({ outline: sRect, voids }, params)[0].polylines;

  console.log('\nstriatura — riempimento: dentro la sagoma, fuori dai vuoti, punto mai troppo lungo');
  const sBase = sMeasure(sGen(sP), sRect, []);
  check('genera un tracciato non vuoto', sBase.pts > 1000, true);
  check('nessun punto fuori dalla sagoma', sBase.fuori, 0);
  check('filo continuo sul pieno (un solo tratto, nessun salto)', sBase.blocchi, 1);
  check('nessun segmento oltre il passo (R4: "punti mai troppo lunghi")', sBase.segMax <= sStep + 0.01, true);
  check('il punto striato è verticale (>80% del filo)', sBase.vertPerc > 80, true);

  console.log('\nstriatura — vuoti (R5): il filo non ci entra e non ci passa sopra');
  const sHole = sMeasure(sGen(sP, [sVoid]), sRect, [sVoid]);
  check('nessun punto dentro il vuoto', sHole.nelVuoto, 0);
  check('nessun segmento ATTRAVERSA il vuoto (nemmeno un tragitto)', sHole.attraversa, 0);
  check('il vuoto spezza il filo in pochi tratti (salti attorno, non ovunque)', sHole.blocchi <= 4, true);

  // I COLLEGAMENTI fra un trattino e l'altro devono restare CORTI. Il trattino in retrace entra ed esce
  // dal proprio centro e i centri di due colonne vicine sono sfasati apposta: il collegamento diretto
  // diventava una linea verticale di 16mm in mezzo al ricamo, quattro volte gli altri e visibilmente
  // diversa (bocciata da Lorenzo). Ora il filo ripassa sul trattino appena cucito, e il collegamento
  // esposto crolla. Qui si blocca il risultato: mediana dei collegamenti sotto i 3mm.
  console.log('\nstriatura — i collegamenti fra i trattini restano corti (non linee in mezzo al ricamo)');
  {
    const pls = sGen(sP);
    const link = [];
    for (const pl of pls) {
      let run = 0;
      for (let i = 1; i < pl.length; i++) {
        const a = pl[i - 1], b = pl[i];
        if (Math.abs(b.x - a.x) < 1e-6) { if (run > 0) { link.push(run); run = 0; } }
        else run += Math.hypot(b.x - a.x, b.y - a.y);
      }
      if (run > 0) link.push(run);
    }
    link.sort((a, b) => a - b);
    const mediana = link[link.length >> 1];
    check('la mediana dei collegamenti sta sotto i 3mm', mediana <= 3, true);
    check('i collegamenti sopra i 10mm sono pochi (<2%)', link.filter((l) => l > 10).length < link.length * 0.02, true);

    // LE VOLTATE (verifica visiva A1, punto 4). Lorenzo le vuole quasi orizzontali e soprattutto NON
    // allineate in righe. Il codice diceva «SEMPRE orizzontali» e non era vero: il frastaglio muove
    // anche il capo vicino. Misurato e accettato così — qui si blocca il limite che rende accettabile
    // il compromesso: la voltata non pende MAI più di un punto di passaggio.
    const lungo = pls.reduce((a, b) => (a.length > b.length ? a : b));
    const trattini = [];
    let corsa = [lungo[0]];
    for (let i = 1; i < lungo.length; i++) {
      if (Math.abs(lungo[i].x - corsa[corsa.length - 1].x) < 1e-6) corsa.push(lungo[i]);
      else { trattini.push(corsa); corsa = [lungo[i]]; }
    }
    trattini.push(corsa);
    let pendenzaMax = 0;
    for (let k = 1; k < trattini.length; k++) {
      const a = trattini[k - 1][trattini[k - 1].length - 1], b = trattini[k][0];
      if (Math.abs(b.x - a.x) < 1e-6) continue;
      const dy = Math.abs(b.y - a.y);
      if (dy > pendenzaMax) pendenzaMax = dy;
    }
    check('nessuna voltata pende più di un punto di passaggio', pendenzaMax <= sP.travelStitchMm + 0.01, true);
    // …e i capi dei trattini NON si allineano in righe (era una richiesta esplicita, non protetta da nulla)
    const capi = trattini.map((t) => Math.min(...t.map((p) => p.y))).filter((y) => y > 60 && y < 110).sort((a, b) => a - b);
    const mediano = capi[capi.length >> 1];
    const scarti = capi.map((y) => Math.abs(y - mediano)).sort((a, b) => a - b);
    check('i capi dei trattini non si allineano in righe', scarti[scarti.length >> 1] > 5, true);
  }

  console.log('\nstriatura — le manopole fanno quello che dicono');
  const sFitto = sMeasure(sGen({ ...sP, densitySpacingMm: 0.4 }), sRect, []);
  const sRado = sMeasure(sGen({ ...sP, densitySpacingMm: 1.2 }), sRect, []);
  check('densità: colonne più fitte = più filo (monotòna)', sFitto.mm > sRado.mm * 1.5, true);
  const sSingola = sMeasure(sGen({ ...sP, stitchMode: 'boustrophedon' }), sRect, []);
  check('retrace (default) usa più filo della passata singola', sBase.mm > sSingola.mm, true);
  const sOnda = sMeasure(sGen({ ...sP, waveAmpMm: 12 }), sRect, []);
  check('onda: cambia la disposizione ma resta dentro la sagoma', [sOnda.fuori, sOnda.mm !== sBase.mm], [0, true]);

  console.log('\nstriatura — variante (seed): ripetibile e diversa');
  const sSig = (seed) => { const pl = sGen({ ...sP, seed }); return `${pl.length}:${rg.layerThreadMm({ color: '#000', polylines: pl }).toFixed(2)}`; };
  check('stesso seed → stesso ricamo', sSig(7), sSig(7));
  check('seed diverso → ricamo diverso', sSig(7) !== sSig(8), true);

  // R3 — il minimo si impone DOPO il routing, ed è la PIPELINE a farlo (passo 8 della Costituzione §4).
  // Il motore da solo lascia micro-segmenti nelle giunzioni fra celle e tragitti: qui si verifica che
  // il pass ci sia davvero e che NON allunghi i punti oltre il passo (sarebbe il difetto opposto).
  console.log('\nstriatura — R3: il punto minimo lo impone la pipeline, dopo il routing');
  const sContours = [
    { points: sRect, closed: true, color: '#000000' },
    { points: sVoid, closed: true, color: '#ff0000' },
  ];
  const sRoles = { '#000000': 'MASTER_OUTLINE', '#ff0000': 'EXCLUSION' };
  const sPipe = rg.runStriaturaPipeline(sContours, sRoles, sP);
  const sFilo = sPipe.exportLayers.find((l) => l.id === 'striatura');
  const sAfter = sMeasure(sFilo.polylines, sRect, [sVoid], sP.minStitchMm);
  const sBefore = sMeasure(sGen(sP, [sVoid]), sRect, [sVoid], sP.minStitchMm);
  check('il motore da solo lascia micro-segmenti (senza il pass non passerebbe)', sBefore.sottoMin > 0, true);
  check('nessun segmento sotto il punto minimo (R3)', sAfter.sottoMin, 0);
  check('nessun punto nello stesso buco (segmento di lunghezza zero)', sAfter.zero, 0);
  check('il pass NON allunga i punti oltre il passo (R4 resta)', sAfter.segMax <= sStep + 0.01, true);
  check('il filo cambia di pochissimo (<1%)', Math.abs(sAfter.mm - sBefore.mm) / sBefore.mm < 0.01, true);
  check('i vuoti restano rispettati anche dopo il pass (R5)', [sAfter.nelVuoto, sAfter.attraversa], [0, 0]);
  check('la statusbar conta i tratti generati', sPipe.blockCount, sFilo.polylines.length);
}

// ---------------------------------------------------------------------------------------------
// core — le primitive su cui poggiano TUTTI i tool. Finora erano provate solo di rimbalzo: se una
// si fosse rotta, il test a fallire sarebbe stato quello di un tool a caso, col difetto altrove.
{
  const cSquare = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const cHole = [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }];

  console.log('\ncore — clip: cosa resta di un segmento dentro la sagoma e fuori dai vuoti (R5)');
  const cRuns = rg.clipSegment({ x: -20, y: 50 }, { x: 120, y: 50 }, cSquare, [cHole]);
  check('un segmento che attraversa tutto → due tratti (prima e dopo il vuoto)', cRuns.length, 2);
  check('il primo tratto va dal bordo al vuoto', [Math.round(cRuns[0][0].x), Math.round(cRuns[0][1].x)], [0, 40]);
  check('il secondo dal vuoto al bordo opposto', [Math.round(cRuns[1][0].x), Math.round(cRuns[1][1].x)], [60, 100]);
  check('un segmento tutto fuori non lascia niente',
    rg.clipSegment({ x: -50, y: -50 }, { x: -10, y: -10 }, cSquare, []).length, 0);
  check('un segmento tutto dentro il vuoto non lascia niente',
    rg.clipSegment({ x: 45, y: 50 }, { x: 55, y: 50 }, cSquare, [cHole]).length, 0);

  console.log('\ncore — inset: il rientro dal perimetro è davvero quello chiesto');
  const cInset = rg.insetPolygon(cSquare, 10);
  const cInsetBounds = rg.bounds(cInset);
  // 10mm di rientro = i LATI si spostano di 10, non i vertici (che sulla diagonale fanno 14.14):
  // prima ne usciva 7.07 = 10/√2, cioè il 30% in meno di quello che chiedevi.
  check('rientro di 10mm su ogni lato',
    [+cInsetBounds.minX.toFixed(6), +cInsetBounds.maxX.toFixed(6)], [10, 90]);
  check('e anche in verticale', [+cInsetBounds.minY.toFixed(6), +cInsetBounds.maxY.toFixed(6)], [10, 90]);
  check('inset 0 = poligono invariato', rg.insetPolygon(cSquare, 0).length, cSquare.length);

  console.log('\ncore — passaggi: retta se si può, sul bordo se serve, attorno al vuoto (R5)');
  const cStraight = rg.routeTravel({ x: 10, y: 10 }, { x: 30, y: 10 }, cSquare, 3);
  check('strada libera → linea retta (solo ricampionata)',
    cStraight.every((p) => Math.abs(p.y - 10) < 1e-9), true);
  check('la retta rispetta il passo massimo (R4)',
    cStraight.every((p, i) => i === 0 || rg.distance(cStraight[i - 1], p) <= 3 + 1e-9), true);
  const cAround = rg.routeTravel({ x: 20, y: 50 }, { x: 80, y: 50 }, cSquare, 2, [cHole], 0.5);
  check('col vuoto in mezzo: nessun punto dentro il vuoto',
    cAround.filter((p) => rg.pointInPolygon(p, cHole)).length, 0);
  let cAroundMm = 0;
  for (let i = 1; i < cAround.length; i++) cAroundMm += rg.distance(cAround[i - 1], cAround[i]);
  check('il giro attorno costa più della retta (60mm)', cAroundMm > 60, true);
  check('senza esclusioni il comportamento è quello di prima (retta)',
    rg.routeTravel({ x: 20, y: 50 }, { x: 80, y: 50 }, cSquare, 2).filter((p) => rg.pointInPolygon(p, cHole)).length > 0, true);

  console.log('\ncore — punto: il minimo toglie, il resample suddivide (R3 e R4 sono due cose diverse)');
  const cLine = [{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 5, y: 0 }, { x: 5.1, y: 0 }];
  const cMin = rg.enforceMinStitch(cLine, 1);
  check('i punti troppo vicini spariscono', cMin.length, 3);
  check('gli estremi restano SEMPRE (R3)',
    [cMin[0].x, cMin[cMin.length - 1].x], [0, 5.1]);
  const cRes = rg.resampleUniform([{ x: 0, y: 0 }, { x: 10, y: 0 }], 3);
  check('il resample spezza a spaziatura massima', cRes.length, 5);
  check('il resample NON tocca i segmenti corti (R4 non impone il minimo)',
    rg.resampleUniform([{ x: 0, y: 0 }, { x: 0.1, y: 0 }], 3).length, 2);
}

// ---------------------------------------------------------------------------------------------
// net-45 (Rete 45°) — il primo tool della suite era anche l'ultimo senza rete di sicurezza sul
// proprio motore. Qui si bloccano le cose che rendono la rete UNA RETE: filo continuo, celle a 45°,
// la fascia di raso automatica sul bordo, il perimetro e i vuoti (R5).
{
  const nRect = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }, { x: 0, y: 90 }];
  const nVoid = (() => { const a = []; for (let i = 0; i < 48; i++) { const t = (i / 48) * 2 * Math.PI; a.push({ x: 60 + Math.cos(t) * 18, y: 45 + Math.sin(t) * 18 }); } return a; })();
  const nP = rg.defaultNetParams;
  const nHalfCord = nP.cordWidthMm / 2; // il cordoncino è LARGO: mezza larghezza sborda dall'asse

  const nMeasure = (res, boundary, voids) => {
    const p = res.path;
    let mm = 0, segMax = 0, oltreBordo = 0, dentroVuoto = 0, dentroVuotoProfondo = 0;
    for (const q of p) {
      if (!rg.pointInPolygon(q, boundary) && rg.distanceToBoundary(q, boundary) > nHalfCord + 0.01) oltreBordo++;
      for (const v of voids) if (rg.pointInPolygon(q, v)) {
        dentroVuoto++;
        if (rg.distanceToBoundary(q, v) > nHalfCord) dentroVuotoProfondo++; // non è il bordo del cordoncino: è dentro
      }
    }
    for (let i = 1; i < p.length; i++) { const d = rg.distance(p[i - 1], p[i]); mm += d; if (d > segMax) segMax = d; }
    return { punti: p.length, mm, segMax, oltreBordo, dentroVuoto, dentroVuotoProfondo, raso: res.rasoShapes.length };
  };
  const cy = (s) => s.reduce((a, q) => a + q.y, 0) / s.length;

  console.log('\nnet-45 — la rete: filo continuo, dentro la sagoma, punto entro il passo');
  const nBase = nMeasure(rg.buildNet(nRect, [], nP), nRect, []);
  check('genera un tracciato non vuoto', nBase.punti > 1000, true);
  // filo CONTINUO (R26): è una polilinea sola e nessun "buco" — se ci fosse un salto a penna alzata
  // si vedrebbe qui come un segmento più lungo del passo dei passaggi.
  check('nessun segmento oltre il passo dei passaggi (filo continuo, R26)', nBase.segMax <= nP.travelStitchMm + 0.01, true);
  const nSpan = rg.bounds(rg.buildNet(nRect, [], nP).path);
  check('la rete copre tutta la sagoma (non un angolo solo)',
    [nSpan.maxX - nSpan.minX > 110, nSpan.maxY - nSpan.minY > 80], [true, true]);
  check('niente oltre il perimetro (a parte mezza larghezza di cordoncino)', nBase.oltreBordo, 0);
  check('stessi parametri → stesso ricamo (nessuna casualità)',
    JSON.stringify(rg.buildNet(nRect, [], nP).path) === JSON.stringify(rg.buildNet(nRect, [], nP).path), true);

  // R5 — il difetto trovato scrivendo questi test: i passaggi tagliavano DRITTO per il vuoto
  // (fino a 16.5mm dentro un'esclusione di raggio 18, 44 punti oltre i 3mm di profondità), perché
  // `routeTravel` conosceva solo il perimetro. Ora le esclusioni arrivano al router e il filo gira attorno.
  console.log('\nnet-45 — R5: il passaggio gira ATTORNO al vuoto, non ci passa dentro');
  const nHolePath = rg.buildNet(nRect, [nVoid], nP).path;
  const nHole = nMeasure({ path: nHolePath, rasoShapes: [] }, nRect, [nVoid]);
  check('nessun punto DENTRO il vuoto (oltre lo sbordo del cordoncino)', nHole.dentroVuotoProfondo, 0);
  // e non basta guardare i punti: un passaggio lungo può SCAVALCARE il vuoto senza appoggiarci un punto.
  let nCross = 0;
  for (let i = 1; i < nHolePath.length; i++) {
    const a = nHolePath[i - 1], b = nHolePath[i];
    const k = Math.max(1, Math.ceil(rg.distance(a, b) / 0.3));
    for (let j = 0; j <= k; j++) {
      const t = j / k, q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (rg.pointInPolygon(q, nVoid) && rg.distanceToBoundary(q, nVoid) > nHalfCord) { nCross++; break; }
    }
  }
  check('nessun segmento ATTRAVERSA il vuoto (era il difetto: 44 punti fino a 16.5mm dentro)', nCross, 0);
  // il vuoto sopprime il ricamo, non solo il passaggio: senza vuoto lì c'è rete, col vuoto no.
  const nInHoleSenza = nBase.punti && rg.buildNet(nRect, [], nP).path.filter((q) => rg.pointInPolygon(q, nVoid)).length;
  check('senza vuoto quella zona è ricamata (il confronto ha senso)', nInHoleSenza > 100, true);
  check('col vuoto la zona è sgombra (R5: sopprime il ricamo)', nHole.dentroVuotoProfondo, 0);

  console.log('\nnet-45 — celle e fascia di raso');
  const nRaso = rg.buildNet(nRect, [], nP).rasoShapes;
  check('la fascia di bordo genera diamanti di raso', nRaso.length > 0, true);
  check('rasoBandMm 0 → nessun raso', rg.buildNet(nRect, [], { ...nP, rasoBandMm: 0 }).rasoShapes.length, 0);
  check('raso solo sui bordi bassi/laterali: niente raso in cima', nRaso.filter((s) => cy(s) < 12).length, 0);
  check('rasoDownwardOnly 0 → il raso arriva anche in cima',
    rg.buildNet(nRect, [], { ...nP, rasoDownwardOnly: 0 }).rasoShapes.filter((s) => cy(s) < 12).length > 0, true);
  const nDiamond = nRaso[0];
  const nAngles = [];
  for (let i = 1; i < nDiamond.length; i++) {
    const d = Math.abs(Math.atan2(nDiamond[i].y - nDiamond[i - 1].y, nDiamond[i].x - nDiamond[i - 1].x) * 180 / Math.PI);
    nAngles.push(Math.round(Math.min(d, 180 - d)));
  }
  check('le celle sono a 45° (lati del diamante)', nAngles.every((a) => a === 45), true);
  check('cella più grande → meno filo (monotòna)',
    nMeasure(rg.buildNet(nRect, [], { ...nP, squareSizeMm: 20 }), nRect, []).mm < nBase.mm, true);
  check('cella più piccola → più filo',
    nMeasure(rg.buildNet(nRect, [], { ...nP, squareSizeMm: 7 }), nRect, []).mm > nBase.mm, true);
}

// ---------------------------------------------------------------------------------------------
// core — IL RASO A RIGHE PARALLELE (R24, "il grande assente"). È una primitiva condivisa: la usa
// broccato adesso e la aspetta net-45 (A4), quindi le invarianti qui sono strette.
// ---------------------------------------------------------------------------------------------
{
  const quadrato = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 0, y: 40 }];
  const buco = [{ x: 20, y: 15 }, { x: 40, y: 15 }, { x: 40, y: 25 }, { x: 20, y: 25 }];
  const punti = (runs) => runs.flat();
  const segMax = (runs) => {
    let m = 0;
    for (const r of runs) for (let i = 1; i < r.length; i++) m = Math.max(m, Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y));
    return m;
  };

  console.log('\ncore — raso: le righe stanno dentro la forma, fuori dai fori, col passo giusto');
  const base = rg.buildParallelFill(quadrato, [buco], { spacingMm: 2, maxStitchMm: 3 });
  check('genera delle corse', base.length > 0, true);
  check('nessun punto esce dalla forma',
    punti(base).every((p) => p.x >= -0.001 && p.x <= 60.001 && p.y >= -0.001 && p.y <= 40.001), true);
  // I capi delle corse cadono ESATTAMENTE sul bordo del foro, e li' un point-in-polygon
  // risponde a caso: si misura quanto un punto ci entra DENTRO, non se ci sta.
  const dentroDi = (pt, poly) => (rg.pointInPolygon(pt, poly) ? rg.distanceToBoundary(pt, poly) : 0);
  check('nessun punto entra nel foro (mai oltre un millesimo di mm)',
    Math.max(...punti(base).map((p) => dentroDi(p, buco))) < 0.001, true);
  check('nessun SEGMENTO attraversa il foro (non basta guardare gli estremi)', (() => {
    for (const r of base) for (let i = 1; i < r.length; i++) {
      for (let t = 1; t < 8; t++) {
        const q = { x: r[i - 1].x + ((r[i].x - r[i - 1].x) * t) / 8, y: r[i - 1].y + ((r[i].y - r[i - 1].y) * t) / 8 };
        if (rg.pointInPolygon(q, buco) && rg.distanceToBoundary(q, buco) > 0.001) return false;
      }
    }
    return true;
  })(), true);
  check('il punto non supera mai il massimo chiesto (R4)', segMax(base) <= 3.0001, true);
  const quote = [...new Set(punti(base).map((p) => Math.round(p.y * 1000) / 1000))].sort((a, b) => a - b);
  const passi = quote.slice(1).map((v, i) => Math.round((v - quote[i]) * 1000) / 1000);
  check('le righe distano esattamente il passo chiesto', [...new Set(passi)], [2]);
  check('nella fascia del foro la riga si spezza in due corse', (() => {
    const suY20 = base.filter((r) => Math.abs(r[0].y - 20) < 0.001);
    return suY20.length === 2;
  })(), true);

  console.log('\ncore — raso: la griglia delle righe è ANCORATA, non parte dalla forma');
  // Due macchie separate dello stesso colore devono avere le righe alla STESSA quota: se ognuna
  // partisse dal proprio bordo, sul ricamo si vedrebbero le giunte fra una macchia e l'altra.
  const sinistra = [{ x: 0, y: 0.7 }, { x: 20, y: 0.7 }, { x: 20, y: 30.3 }, { x: 0, y: 30.3 }];
  const destra = [{ x: 40, y: 3.1 }, { x: 60, y: 3.1 }, { x: 60, y: 33.9 }, { x: 40, y: 33.9 }];
  const qs = (poly) => [...new Set(punti(rg.buildParallelFill(poly, [], { spacingMm: 2, maxStitchMm: 5 })).map((p) => Math.round(p.y * 100) / 100))];
  const qa = qs(sinistra), qb = qs(destra);
  check('le quote delle due macchie cadono sulla stessa griglia',
    qa.every((v) => Math.abs(v / 2 - Math.round(v / 2)) < 1e-6) && qb.every((v) => Math.abs(v / 2 - Math.round(v / 2)) < 1e-6), true);
  check('spostando l\'ancoraggio si spostano TUTTE le righe',
    rg.buildParallelFill(sinistra, [], { spacingMm: 2, gridOriginMm: 0.5 })[0][0].y % 2, 0.5);

  console.log('\ncore — raso: pettine e serpentina fanno cose diverse, come sul ricamo vero');
  const serp = rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 3, mode: 'serpentine' });
  const pett = rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 3, mode: 'comb', retraceOffsetMm: 0.1 });
  check('la serpentina alterna il verso riga per riga',
    serp[0][0].x < serp[0][serp[0].length - 1].x && serp[1][0].x > serp[1][serp[1].length - 1].x, true);
  check('il pettine va e TORNA sulla stessa riga (parte e finisce dalla stessa parte)',
    Math.abs(pett[0][0].x - pett[0][pett[0].length - 1].x) < 0.001, true);
  check('il ritorno del pettine è sfalsato, non ricade negli stessi buchi',
    Math.round((pett[0][pett[0].length - 1].y - pett[0][0].y) * 1000) / 1000, 0.1);
  check('il pettine costa circa il doppio di filo (è la sua ragione d\'essere)',
    Math.abs(rg.fillThreadMm(pett) / rg.fillThreadMm(serp) - 2) < 0.06, true);
  check('lo sfasamento del ritorno non può superare mezzo passo',
    rg.buildParallelFill(quadrato, [], { spacingMm: 2, mode: 'comb', retraceOffsetMm: 99 })[0].slice(-1)[0].y
      - rg.buildParallelFill(quadrato, [], { spacingMm: 2, mode: 'comb', retraceOffsetMm: 99 })[0][0].y, 1);

  // Il pettine TORNA dove e' partito: se si alternasse il verso, l'ago dovrebbe attraversare tutta
  // la macchia a ogni riga. Trovato contando il filo di passaggio, non guardando il disegno: era
  // 25,8 m su 62,9 di totale. Il DST di riferimento conferma — le righe a pettine consecutive
  // partono vicine (-50,10 / -50,70 / -49,60), non da capi opposti.
  console.log('\ncore — raso: il pettine riparte sempre dalla stessa parte, la serpentina no');
  const partenzeP = pett.slice(0, 8).map((r) => Math.round(r[0].x));
  check('le righe a pettine partono tutte dallo stesso capo', new Set(partenzeP).size, 1);
  const partenzeS = serp.slice(0, 8).map((r) => Math.round(r[0].x));
  check('quelle a serpentina si alternano', new Set(partenzeS).size, 2);
  check('e infatti il pettine NON costa passaggi per cambiare capo', (() => {
    let salto = 0;
    for (let i = 1; i < pett.length; i++) salto += Math.abs(pett[i][0].x - pett[i - 1].slice(-1)[0].x);
    return salto < 1;
  })(), true);

  // Due difetti che ha visto Lorenzo guardando l'anteprima, e che il DST di riferimento gli dava
  // ragione su entrambi.
  console.log('\ncore — raso: la voltata del pettine e\' una DIAGONALE, non un gradino');
  const barra = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 6 }, { x: 0, y: 6 }];
  const pett2 = rg.buildParallelFill(barra, [], { spacingMm: 0.9, maxStitchMm: 3.4, mode: 'comb', retraceOffsetMm: 0.1 });
  const corsa = pett2[1];
  const microVerticali = (runs) => {
    let n = 0;
    for (const r of runs) for (let i = 1; i < r.length; i++) {
      if (Math.abs(r[i].x - r[i - 1].x) < 0.001 && Math.abs(r[i].y - r[i - 1].y) > 0.001) n++;
    }
    return n;
  };
  check('nessun micro-passaggio verticale in tutta la macchia', microVerticali(pett2), 0);
  check('lo scostamento sta sull\'ULTIMO punto dell\'andata (quel punto scende di 0,1)', (() => {
    const meta = (corsa.length - 1) / 2;
    const capo = corsa[meta], prima = corsa[meta - 1];
    return Math.abs(capo.y - prima.y - 0.1) < 1e-6 && Math.abs(capo.x - prima.x) > 1;
  })(), true);
  check('...e il ritorno e\' perfettamente orizzontale', (() => {
    const meta = (corsa.length - 1) / 2;
    for (let i = meta + 1; i < corsa.length; i++) if (Math.abs(corsa[i].y - corsa[i - 1].y) > 1e-9) return false;
    return true;
  })(), true);
  check('e la corsa comincia e finisce alla stessa ascissa', Math.abs(corsa[0].x - corsa[corsa.length - 1].x) < 1e-9, true);

  console.log('\ncore — raso: si riempie a CAMERE, non riga per riga su tutta la forma');
  // Una U: due bracci verticali uniti in basso. Riga per riga l'ago salterebbe da un braccio
  // all'altro a ogni riga — «mille passaggi interni», il difetto che Lorenzo ha visto per primo.
  // A camere riempie un braccio, poi l'altro.
  const uForma = [
    { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 30 }, { x: 22, y: 30 },
    { x: 22, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }, { x: 0, y: 40 },
  ];
  const uRuns = rg.buildParallelFill(uForma, [], { spacingMm: 1, maxStitchMm: 5, mode: 'comb', retraceOffsetMm: 0.1 });
  const saltoFraCorse = (runs) => {
    let tot = 0;
    for (let i = 1; i < runs.length; i++) {
      const a = runs[i - 1][runs[i - 1].length - 1], b = runs[i][0];
      tot += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return tot;
  };
  // Il numero che conta: quanto si sposta l'ago in media da una corsa alla successiva. Col
  // riempimento a camere e' 1,72mm contro un passo di 1mm — cioe' scende di riga e basta.
  // Riga per riga su tutta la forma salterebbe da un braccio all'altro a ogni riga (14mm x 30).
  check('in media l\'ago scende di una riga, non attraversa la forma',
    saltoFraCorse(uRuns) / (uRuns.length - 1) < 2.5, true);
  check('...e il salto tipico e\' il passo fra le righe, non la larghezza della forma', (() => {
    let lunghi = 0;
    for (let i = 1; i < uRuns.length; i++) {
      const a = uRuns[i - 1][uRuns[i - 1].length - 1], b = uRuns[i][0];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 10) lunghi++;
    }
    return lunghi <= 2;                       // solo il passaggio da un braccio all'altro
  })(), true);
  check('le corse dei due bracci NON si alternano riga per riga', (() => {
    // nella parte bassa (y<30) i due bracci convivono: si contano i cambi di braccio
    const bracci = uRuns.filter((r) => r[0].y < 29.5).map((r) => (r[0].x < 15 ? 0 : 1));
    let cambi = 0;
    for (let i = 1; i < bracci.length; i++) if (bracci[i] !== bracci[i - 1]) cambi++;
    return cambi <= 2;
  })(), true);
  check('e la U resta riempita tutta (nessun pezzo perso a fare le camere)',
    rg.fillThreadMm(uRuns) > 1000, true);

  console.log('\ncore — raso: le manopole fanno quello che dicono');
  const filo = (sp) => rg.fillThreadMm(rg.buildParallelFill(quadrato, [], { spacingMm: sp, maxStitchMm: 3 }));
  check('passo più fitto = più filo (monotòna)', filo(1) > filo(2) && filo(2) > filo(4), true);
  check('e in proporzione: dimezzare il passo raddoppia il filo', Math.abs(filo(1) / filo(2) - 2) < 0.1, true);
  const pMax = (mx) => segMax(rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: mx }));
  check('il punto massimo si rispetta a qualsiasi valore', pMax(1) <= 1.0001 && pMax(5) <= 5.0001, true);
  check('suddividere NON cambia la forma: stessa lunghezza di filo, solo più punti',
    Math.abs(rg.fillThreadMm(rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 1 }))
      - rg.fillThreadMm(rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 5 }))) < 0.001, true);

  console.log('\ncore — raso: l\'orientamento');
  const orizz = rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 100, angleDeg: 0 });
  const vert = rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 100, angleDeg: 90 });
  const angoli = (runs) => [...new Set(runs.map((r) => {
    const d = Math.atan2(r[1].y - r[0].y, r[1].x - r[0].x) * 180 / Math.PI;
    return Math.round(((d % 180) + 180) % 180);
  }))];
  check('a 0° le righe sono orizzontali', angoli(orizz), [0]);
  check('a 90° le righe sono verticali', angoli(vert), [90]);
  check('ruotando, il filo resta lo stesso (è la stessa forma girata)',
    Math.abs(rg.fillThreadMm(orizz) / rg.fillThreadMm(vert) - 1) < 0.12, true);
  const obliquo = rg.buildParallelFill(quadrato, [], { spacingMm: 2, maxStitchMm: 100, angleDeg: 30 });
  check('a 30° le righe sono a 30° e restano dentro la forma',
    angoli(obliquo).length === 1 && angoli(obliquo)[0] === 30
      && punti(obliquo).every((p) => p.x >= -0.001 && p.x <= 60.001 && p.y >= -0.001 && p.y <= 40.001), true);

  console.log('\ncore — raso: i casi storti non esplodono');
  check('poligono degenere → nessuna corsa', rg.buildParallelFill([{ x: 0, y: 0 }, { x: 1, y: 1 }], [], { spacingMm: 1 }).length, 0);
  check('passo zero → nessuna corsa', rg.buildParallelFill(quadrato, [], { spacingMm: 0 }).length, 0);
  check('foro più grande della forma → nessuna corsa',
    rg.buildParallelFill(quadrato, [[{ x: -10, y: -10 }, { x: 70, y: -10 }, { x: 70, y: 50 }, { x: -10, y: 50 }]], { spacingMm: 2 })
      .flat().length, 0);
  const concava = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 35, y: 40 }, { x: 35, y: 12 }, { x: 25, y: 12 }, { x: 25, y: 40 }, { x: 0, y: 40 }];
  const conc = rg.buildParallelFill(concava, [], { spacingMm: 2, maxStitchMm: 5 });
  // Stessa cura: i capi stanno sul bordo dell'incavo. Si guarda se il filo ci passa DENTRO,
  // campionando i segmenti a meta' e non solo agli estremi.
  const incavo = [{ x: 25, y: 12 }, { x: 35, y: 12 }, { x: 35, y: 41 }, { x: 25, y: 41 }];
  check('su una U il riempimento non taglia attraverso l\'incavo', (() => {
    for (const r of conc) for (let i = 1; i < r.length; i++) {
      for (let t = 1; t < 8; t++) {
        const q = { x: r[i - 1].x + ((r[i].x - r[i - 1].x) * t) / 8, y: r[i - 1].y + ((r[i].y - r[i - 1].y) * t) / 8 };
        if (rg.pointInPolygon(q, incavo) && rg.distanceToBoundary(q, incavo) > 0.001) return false;
      }
    }
    return true;
  })(), true);
  check('stessi parametri → stesso identico risultato (deterministico)',
    JSON.stringify(rg.buildParallelFill(quadrato, [buco], { spacingMm: 2, maxStitchMm: 3, mode: 'comb', retraceOffsetMm: 0.1 })),
    JSON.stringify(rg.buildParallelFill(quadrato, [buco], { spacingMm: 2, maxStitchMm: 3, mode: 'comb', retraceOffsetMm: 0.1 })));
}

// ---------------------------------------------------------------------------------------------
// broccato (punto ①) — la cattura dei colori promossa nel core, e la riduzione dell'immagine.
// Il test che conta davvero è il PRIMO: promuovere `buildPalette` da apps/bitmap a @rg/core non
// deve cambiare una virgola di quello che bitmap produceva (ARCHITETTURA, regole di crescita 6/7 —
// le divergenze non si vedono, vanno cercate).
// ---------------------------------------------------------------------------------------------
{
  console.log('\ncore — cattura colore: la promozione dal motore di bitmap non cambia il risultato');
  const bImg = rg.sampleBroccatoImage(200, 160);
  for (const n of [3, 4, 6, 8]) {
    const daBitmap = rg.buildPalette(bImg.rgba, new Uint8Array(bImg.width * bImg.height).fill(1), n);
    const dalCore = rg.medianCutPalette(bImg.rgba, null, n);
    check(`palette a ${n} colori identica fra bitmap e core`,
      JSON.stringify(dalCore), JSON.stringify(daBitmap));
  }
  check('stessa immagine → stessa palette (deterministico: il motivo si ripete uguale)',
    JSON.stringify(rg.medianCutPalette(bImg.rgba, null, 6)),
    JSON.stringify(rg.medianCutPalette(bImg.rgba, null, 6)));

  console.log('\ncore — esadecimale e colore più vicino');
  check('rgb → hex a 6 cifre minuscole', rg.rgbToHex([12, 250, 7]), '#0cfa07');
  check('hex corto e lungo danno lo stesso colore',
    JSON.stringify(rg.hexToRgb('#0f0')), JSON.stringify(rg.hexToRgb('#00ff00')));
  check('hex non valido → null', rg.hexToRgb('non-un-colore'), null);
  const pal3 = [[0, 0, 0], [255, 0, 0], [0, 0, 255]];
  check('il colore più vicino è quello giusto', rg.nearestPaletteIndex(230, 20, 20, pal3), 1);
  check('palette vuota → nessun colore', rg.nearestPaletteIndex(1, 2, 3, []), -1);

  console.log('\nbroccato — riduzione dell\'immagine alle tinte scelte');
  const bRid = rg.reduceStable(bImg, { colorCount: 6, mmPerPx: 0.3, flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 0 });
  const pal = bRid.palette;
  check('cattura il numero di colori chiesto', pal.length, 6);
  check('ogni pixel finisce su una tinta della palette (nessuno scoperto)',
    bRid.index.every((v) => v < pal.length), true);
  check('NESSUN AGO SPRECATO: nessuna tinta resta senza pixel',
    bRid.counts.every((c) => c > 0), true);
  check('i conteggi tornano al totale dei pixel',
    bRid.counts.reduce((s, v) => s + v, 0), bImg.width * bImg.height);
  check('stessa immagine, stessi parametri → stesso identico risultato (ripetibile)',
    JSON.stringify(rg.reduceStable(bImg, { colorCount: 6, mmPerPx: 0.3, flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 0 }).palette),
    JSON.stringify(pal));

  console.log('\nbroccato — il numero di aghi resta nei limiti del sistema (4–8)');
  check('meno di 4 non si può', rg.clampColorCount(1), 4);
  check('più di 8 non si può', rg.clampColorCount(99), 8);
  check('un valore buono passa intatto', rg.clampColorCount(6), 6);

  console.log('\nbroccato — la palette diventa righe-colore senza perdere le scelte fatte');
  let cols = rg.paletteToColors(pal);
  check('una riga per tinta', cols.length, pal.length);
  check('di default sono tutte macchie', cols.every((c) => c.role === 'macchia'), true);
  cols[0] = { ...cols[0], role: 'base', densitySpacingMm: 0.8, mode: 'normale' };
  const ricatturate = rg.paletteToColors(pal, cols);
  check('ricatturare i colori NON butta via ruolo, densità e modo già scelti',
    JSON.stringify(ricatturate[0]), JSON.stringify(cols[0]));
  const tutte = rg.applyDensityToAll(cols, 0.5);
  check('«applica a tutti» mette la stessa densità ovunque',
    tutte.every((c) => c.densitySpacingMm === 0.5), true);
  check('«applica a tutti» non tocca i ruoli', tutte[0].role, 'base');
  check('le tinte tornano indietro identiche',
    JSON.stringify(rg.colorsToPalette(cols)), JSON.stringify(pal));

  // -------------------------------------------------------------------------------------------
  // Punto ② — LA RIDUZIONE STABILE. L'invariante che conta: **lo stesso motivo, ripetuto in due
  // punti dove la luce cambia, deve finire sugli STESSI aghi**. È la richiesta esplicita di Lorenzo
  // («un motivo deve ripetersi in maniera molto simile») e finora nessun test la proteggeva.
  // L'immagine di prova è fatta apposta: due piastrelle IDENTICHE (stessa grana, stesso disegno)
  // con una sola differenza — la luce che scivola da sinistra a destra.
  // -------------------------------------------------------------------------------------------
  const tileW = 150, tileH = 150;
  const motivo = (() => {
    const W = tileW * 2, H = tileH;
    const rgba = new Uint8ClampedArray(W * H * 4);
    const CUOIO = [186, 156, 120], SCURO = [64, 62, 60], ARG = [176, 176, 172], GIALLO = [226, 208, 46];
    let a = 4242 >>> 0;
    const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const grana = new Float32Array(tileW * H);
    for (let i = 0; i < tileW * H; i++) grana[i] = rnd() - 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const lx = x % tileW;                                  // stessa posizione dentro la piastrella
      const orn = Math.sin(lx * 0.062) * Math.cos(y * 0.052) + 0.5 * Math.sin((lx + y) * 0.04);
      const arg = Math.sin(lx * 0.031 + 2.1) * Math.cos(y * 0.037 - 2.1);
      const gia = Math.sin(lx * 0.019 + 4.2) * Math.cos(y * 0.021 - 4.2);
      let c = CUOIO;
      if (gia > 0.82) c = GIALLO; else if (arg > 0.72) c = ARG; else if (orn > 0.35) c = SCURO;
      const g = grana[y * tileW + lx] * (c === SCURO ? 60 : 40);
      const luce = 34 * (x / (W - 1) - 0.5);                  // la variazione LENTA: il nemico
      const o = (y * W + x) * 4;
      rgba[o] = c[0] + g + luce; rgba[o + 1] = c[1] + g + luce; rgba[o + 2] = c[2] + g + luce; rgba[o + 3] = 255;
    }
    return { rgba, width: W, height: H };
  })();
  const somiglianza = (idx) => {
    let uguali = 0, tot = 0;
    for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) { tot++; if (idx[y * tileW * 2 + x] === idx[y * tileW * 2 + x + tileW]) uguali++; }
    return 100 * uguali / tot;
  };
  const rid = (o) => rg.reduceStable(motivo, { colorCount: 6, mmPerPx: 0.3, flattenLightMm: 0, smoothMm: 0, minBlobMm2: 0, ...o });

  console.log('\nbroccato — ② lo stesso motivo, ripetuto dove la luce cambia, finisce sugli stessi aghi');
  const senza = somiglianza(rid({}).index);
  const conPareggio = somiglianza(rid({ flattenLightMm: 15, smoothMm: 0.9 }).index);
  check('senza pareggio della luce le due ripetizioni NON si somigliano (< 60%)', senza < 60, true);
  check('col pareggio della luce si somigliano (> 80%)', conPareggio > 80, true);
  check('il pareggio della luce migliora di almeno 30 punti', conPareggio - senza > 30, true);
  check('il default del pannello è già quello buono',
    somiglianza(rid({ flattenLightMm: rg.defaultBroccatoParams.flattenLightMm, smoothMm: rg.defaultBroccatoParams.smoothMm }).index) > 80, true);

  console.log('\nbroccato — ② la pulizia rende il disegno ricamabile, e CONVERGE');
  const isole = (idx, W, H, minCells) => {
    const seen = new Uint8Array(W * H); let tot = 0, sotto = 0;
    for (let s0 = 0; s0 < W * H; s0++) {
      if (seen[s0]) continue;
      const col = idx[s0]; const st = [s0]; seen[s0] = 1; let n = 0;
      while (st.length) { const i = st.pop(); n++; const x = i % W, y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
          if (j >= 0 && !seen[j] && idx[j] === col) { seen[j] = 1; st.push(j); } }
      tot++; if (n < minCells) sotto++;
    }
    return { tot, sotto };
  };
  const minCells = Math.round(20 / (0.3 * 0.3));
  const sporco = rid({ flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 0 });
  const pulito = rid({ flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 20 });
  const iSporco = isole(sporco.index, motivo.width, motivo.height, minCells);
  const iPulito = isole(pulito.index, motivo.width, motivo.height, minCells);
  check('senza pulizia il disegno è fatto di schegge (centinaia sotto misura)', iSporco.sotto > 200, true);
  check('con la pulizia NON resta nessuna isola sotto misura (converge)', iPulito.sotto, 0);
  check('e le isole crollano di almeno dieci volte', iPulito.tot * 10 < iSporco.tot, true);
  // La pulizia PAGA un prezzo in somiglianza, e va detto: due macchie gemelle che stanno una
  // sopra e una sotto la soglia vengono trattate in modo diverso, e la differenza si amplifica.
  // Misurato: da ~86% a ~67% sulla piastrella da 45 mm. Qui si blocca il pavimento, non l'illusione.
  check('anche dopo la pulizia le ripetizioni restano largamente simili (> 60%)',
    somiglianza(pulito.index) > 60, true);
  check('una passata sola NON basterebbe',
    rg.removeSmallBlobs(sporco.index, motivo.width, motivo.height, minCells, 1).removed
      < rg.removeSmallBlobs(sporco.index, motivo.width, motivo.height, minCells, 6).removed, true);

  // Questa è la misura che ha impedito di scegliere male. Guardando SOLO la somiglianza, il raggio
  // migliore sarebbe 2-3 mm; ma con un raggio così piccolo il pareggio toglie la luce **e anche il
  // colore**, e una campitura piena si svuota al centro. Serve un secondo metro.
  console.log('\nbroccato — ② un raggio troppo piccolo SVUOTA le campiture piene');
  const campitura = (() => {
    const W = 400, H = 220, rgba = new Uint8ClampedArray(W * H * 4);
    const FONDO = [186, 156, 120], PIENO = [226, 208, 46];
    let a = 77 >>> 0;
    const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const cx = 200, cy = 110, r = 45 / 2 / 0.3;                    // un cerchio pieno da 45 mm
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dentro = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      const c = dentro ? PIENO : FONDO;
      const g = (rnd() - 0.5) * 30, l = 34 * (x / (W - 1) - 0.5), o = (y * W + x) * 4;
      rgba[o] = c[0] + g + l; rgba[o + 1] = c[1] + g + l; rgba[o + 2] = c[2] + g + l; rgba[o + 3] = 255;
    }
    return { rgba, width: W, height: H, cx, cy, r };
  })();
  const tenuta = (idx) => {
    const conta = new Map(); let n = 0;
    const { cx, cy, r, width, height } = campitura;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(height, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(width, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 >= r * r * 0.81) continue;   // l'interno, non il bordo sfumato
        const v = idx[y * width + x]; conta.set(v, (conta.get(v) ?? 0) + 1); n++;
      }
    return 100 * Math.max(...conta.values()) / n;
  };
  // Tre aghi su un'immagine che di colori ne ha due: uno solo deve spaccarsi, e non dev'essere il
  // cerchio. (Con quattro o più aghi la palette è costretta a spaccare comunque il cerchio, e la
  // misura direbbe di più sul numero di aghi che sul raggio.)
  const campRid = (f) => rg.reduceStable(campitura, { colorCount: 3, mmPerPx: 0.3, flattenLightMm: f, smoothMm: 0.9, minBlobMm2: 0 }).index;
  check('con un raggio piccolo (3 mm) la campitura si svuota (meno del 70% di una tinta sola)',
    tenuta(campRid(3)) < 70, true);
  check('col default (15 mm) la campitura resta tutta di una tinta (> 95%)',
    tenuta(campRid(rg.defaultBroccatoParams.flattenLightMm)) > 95, true);
  check('e anche senza pareggio resterebbe intera: il rischio è del raggio piccolo, non del pareggio',
    tenuta(campRid(0)) > 95, true);

  console.log('\nbroccato — ② i pezzi della preparazione, uno per uno');
  const piatta = rg.flattenLight(motivo, 50);
  const gamma = (im) => { let lo = 255, hi = 0; for (let i = 0; i < im.width * im.height; i++) { const v = im.rgba[i * 4]; if (v < lo) lo = v; if (v > hi) hi = v; } return hi - lo; };
  const mediaMeta = (im, da, a) => { let s0 = 0, n = 0; for (let y = 0; y < im.height; y++) for (let x = da; x < a; x++) { s0 += im.rgba[(y * im.width + x) * 4]; n++; } return s0 / n; };
  const dislivelloPrima = Math.abs(mediaMeta(motivo, 0, tileW) - mediaMeta(motivo, tileW, tileW * 2));
  const dislivelloDopo = Math.abs(mediaMeta(piatta, 0, tileW) - mediaMeta(piatta, tileW, tileW * 2));
  check('il pareggio livella le due metà (dislivello ridotto di almeno quattro volte)',
    dislivelloDopo * 4 < dislivelloPrima, true);
  check('...senza appiattire l\'immagine (la gamma di toni resta)', gamma(piatta) > 100, true);
  const rumorosa = { width: 60, height: 60, rgba: new Uint8ClampedArray(60 * 60 * 4) };
  for (let i = 0; i < 3600; i++) { const v = (i % 97 === 0) ? 255 : 100; const o = i * 4; rumorosa.rgba[o] = v; rumorosa.rgba[o + 1] = v; rumorosa.rgba[o + 2] = v; rumorosa.rgba[o + 3] = 255; }
  const senzaGrana = rg.despeckle(rumorosa, 1);
  let picchiPrima = 0, picchiDopo = 0;
  for (let i = 0; i < 3600; i++) { if (rumorosa.rgba[i * 4] === 255) picchiPrima++; if (senzaGrana.rgba[i * 4] === 255) picchiDopo++; }
  // Questa asserzione ha trovato un difetto vero: la mediana saltava la cornice di un pixel e
  // lasciava la grana tutt'attorno all'immagine. Ora l'intorno si ferma al bordo invece di uscirne.
  check('la mediana toglie i punti isolati, bordo compreso', picchiPrima > 30 && picchiDopo === 0, true);
  const bordo = { width: 20, height: 20, rgba: new Uint8ClampedArray(20 * 20 * 4) };
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const v = x < 10 ? 30 : 220; const o = (y * 20 + x) * 4; bordo.rgba[o] = v; bordo.rgba[o + 1] = v; bordo.rgba[o + 2] = v; bordo.rgba[o + 3] = 255; }
  const bordoDopo = rg.despeckle(bordo, 3);
  let sbavato = 0;
  for (let i = 0; i < 400; i++) { const v = bordoDopo.rgba[i * 4]; if (v !== 30 && v !== 220) sbavato++; }
  check('...ma NON sbava i contorni (nessun colore intermedio inventato)', sbavato, 0);
  const palVuota = rg.refinePalette(motivo.rgba, [[0, 0, 0], [1, 1, 1], [2, 2, 2], [250, 250, 250], [251, 251, 251], [252, 252, 252]], 4);
  check('l\'affinamento non perde nessun ago', palVuota.length, 6);
  check('...e li porta su tinte diverse fra loro', new Set(palVuota.map((c) => c.join(','))).size, 6);

  // -------------------------------------------------------------------------------------------
  // Punto ③ — dalle maschere alle REGIONI. È il pezzo che nella suite non c'era: bitmap va da
  // raster a punti senza mai costruire un'area, e il raso del core vuole un poligono.
  // -------------------------------------------------------------------------------------------
  console.log('\nbroccato — ③ le maschere diventano poligoni in millimetri, coi fori');
  const W3 = 100, H3 = 80, MM = 0.5;
  const mappa = new Uint8Array(W3 * H3).fill(0);
  // un rettangolo del colore 1 da (10,10) a (60,50), con dentro un buco (25,20)-(40,35)
  for (let y = 10; y < 50; y++) for (let x = 10; x < 60; x++) mappa[y * W3 + x] = 1;
  for (let y = 20; y < 35; y++) for (let x = 25; x < 40; x++) mappa[y * W3 + x] = 0;
  // una seconda macchia dello stesso colore, staccata
  for (let y = 60; y < 70; y++) for (let x = 70; x < 90; x++) mappa[y * W3 + x] = 1;
  // due pixel che si toccano solo in diagonale: DUE macchie, non una
  mappa[5 * W3 + 90] = 1; mappa[6 * W3 + 91] = 1;

  const regs = rg.traceRegions(mappa, W3, H3, 1, MM);
  check('trova tutte le macchie, e la diagonale conta per due', regs.length, 4);
  const grande = regs[0];
  check('la più grande è quella col buco', grande.holes.length, 1);
  check('le altre non hanno buchi', regs.slice(1).every((r) => r.holes.length === 0), true);
  // area attesa: 50x40 pixel meno 15x15, in mm² con lato 0.5 → (2000-225)*0.25
  check('l\'area netta è quella giusta (il foro è sottratto)',
    Math.abs(grande.areaMm2 - (50 * 40 - 15 * 15) * MM * MM) < 3, true);
  check('il contorno è in MILLIMETRI, non in pixel (R1)', (() => {
    const xs = grande.outer.map((p) => p.x), ys = grande.outer.map((p) => p.y);
    return Math.abs(Math.min(...xs) - 5) < 0.6 && Math.abs(Math.max(...xs) - 30) < 0.6
      && Math.abs(Math.min(...ys) - 5) < 0.6 && Math.abs(Math.max(...ys) - 25) < 0.6;
  })(), true);
  check('un rettangolo torna con pochi vertici, non a gradini',
    regs[1].outer.length <= 6, true);
  check('il centro del buco NON è dentro la regione',
    rg.pointInRegion({ x: 32.5 * MM, y: 27.5 * MM }, grande), false);
  check('un punto del pieno invece sì',
    rg.pointInRegion({ x: 15 * MM, y: 15 * MM }, grande), true);
  check('stessa mappa → stesse regioni (deterministico)',
    JSON.stringify(rg.traceRegions(mappa, W3, H3, 1, MM)), JSON.stringify(regs));
  check('un colore che non c\'è → nessuna regione', rg.traceRegions(mappa, W3, H3, 7, MM).length, 0);
  check('l\'area minima scarta le macchie piccole',
    rg.traceRegions(mappa, W3, H3, 1, MM, { minAreaMm2: 100 }).length, 1);

  console.log('\nbroccato — ③ le regioni e il raso del core si parlano');
  const corse = rg.buildParallelFill(grande.outer, grande.holes, { spacingMm: 1, maxStitchMm: 3, mode: 'comb', retraceOffsetMm: 0.1 });
  check('il raso riempie la regione tracciata', corse.length > 10, true);
  check('e non entra nel buco', (() => {
    const buco = grande.holes[0];
    for (const r of corse) for (let i = 1; i < r.length; i++) {
      for (let t = 1; t < 6; t++) {
        const q = { x: r[i - 1].x + ((r[i].x - r[i - 1].x) * t) / 6, y: r[i - 1].y + ((r[i].y - r[i - 1].y) * t) / 6 };
        if (rg.pointInPolygon(q, buco) && rg.distanceToBoundary(q, buco) > 0.3) return false;
      }
    }
    return true;
  })(), true);
  // I capi delle corse stanno sul contorno: si misura di quanto lo OLTREPASSANO, non se lo toccano.
  check('e non esce dal contorno (mai oltre un millesimo di mm)',
    Math.max(...corse.flat().map((p) => (rg.pointInPolygon(p, grande.outer) ? 0 : rg.distanceToBoundary(p, grande.outer)))) < 0.001, true);

  console.log('\nbroccato — ③ due macchie dello stesso colore hanno le righe ALLINEATE');
  // Se ogni macchia partisse dal proprio bordo, sul ricamo si vedrebbe la giunta fra una e l'altra.
  const quoteDi = (r) => [...new Set(rg.buildParallelFill(r.outer, r.holes, { spacingMm: 1, maxStitchMm: 5 })
    .flat().map((p) => Math.round(p.y * 100) / 100))];
  const q1 = quoteDi(regs[0]), q2 = quoteDi(regs[1]);
  check('le quote delle due macchie stanno sulla stessa griglia da 1mm',
    q1.every((v) => Math.abs(v - Math.round(v)) < 1e-6) && q2.every((v) => Math.abs(v - Math.round(v)) < 1e-6), true);

  // -------------------------------------------------------------------------------------------
  // Punto ④ — I PASSAGGI NASCOSTI. Il cuore della tecnica: il filo di collegamento deve finire
  // sotto il ricamo che verra' dopo; l'ultimo colore non ha piu' niente sopra e cerca i bordi.
  // -------------------------------------------------------------------------------------------
  console.log('\nbroccato — ④ il passaggio COSTEGGIA il contorno, non taglia dentro');
  // La regola che Lorenzo ha corretto guardando l'anteprima: il filo di collegamento non attraversa
  // mai il riempimento. Qui una macchia lunga e stretta a U: andare dritti da un braccio all'altro
  // taglierebbe in pieno; costeggiando si gira attorno.
  const uMacchia = {
    outer: [
      { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 40 }, { x: 48, y: 40 },
      { x: 48, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 52 }, { x: 0, y: 52 },
    ],
    holes: [], areaMm2: 1000,
  };
  const CO = 60, RO = 60;
  const griglia = { cols: CO, rows: RO, cellMm: 1, kind: new Uint8Array(CO * RO).fill(rg.CELL_BARE) };
  const dueCorse = [{
    region: uMacchia,
    runs: [[{ x: 2, y: 6 }, { x: 10, y: 6 }], [{ x: 50, y: 6 }, { x: 58, y: 6 }]],
  }];
  const r4 = rg.routeColorRuns(dueCorse, griglia, { maxDirectMm: 0, cellMm: 1, travelStitchMm: 2 });
  const viaggio = r4.travels[0] ?? [];
  check('il passaggio esiste ed e\' cucito', viaggio.length > 3, true);
  // Le due cose che devono valere, misurate come PROFONDITÀ e non come appartenenza (il filo corre
  // proprio SUL contorno, e lì un point-in-polygon risponde a caso): non entra nel vuoto, e non si
  // stacca dal contorno per tagliare dentro il pieno.
  const incavo = [{ x: 12, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 40 }, { x: 12, y: 40 }];
  const dentroDi = (pt, poly) => (rg.pointInPolygon(pt, poly) ? rg.distanceToBoundary(pt, poly) : 0);
  check('non entra nel vuoto dell\'incavo (mai oltre mezzo millimetro)',
    Math.max(...viaggio.map((p) => dentroDi(p, incavo))) < 0.5, true);
  // I capi si escludono: il primo punto E' la penna (sta dentro il riempimento per forza) e
  // l'ultimo e' l'attacco della corsa successiva. Conta il tragitto in mezzo.
  check('e resta appiccicato al contorno: in mezzo non taglia dentro il pieno',
    Math.max(...viaggio.slice(1, -1).map((p) => dentroDi(p, uMacchia.outer))) < 1.5, true);
  check('il giro costa piu\' filo della retta, ed e\' il prezzo giusto', (() => {
    let lung = 0;
    for (let i = 1; i < viaggio.length; i++) lung += Math.hypot(viaggio[i].x - viaggio[i - 1].x, viaggio[i].y - viaggio[i - 1].y);
    return lung > 40 * 1.5;
  })(), true);
  check('dentro una macchia il filo NON si stacca mai', r4.jumps, 0);

  console.log('\nbroccato — ④ la mappa di copertura dice il vero');
  const mappaC = new Uint8Array(40 * 30).fill(0);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 20; x++) mappaC[y * 40 + x] = 0;   // colore 0 a sinistra
  for (let y = 0; y < 30; y++) for (let x = 20; x < 40; x++) mappaC[y * 40 + x] = 1;  // colore 1 a destra
  const tinte = [
    { hex: '#111111', role: 'macchia', densitySpacingMm: 1, mode: 'pettine' },
    { hex: '#222222', role: 'macchia', densitySpacingMm: 1, mode: 'pettine' },
  ];
  const g0 = rg.buildCoverGrid(mappaC, 40, 30, 0.5, 0, tinte, 1);
  const g1 = rg.buildCoverGrid(mappaC, 40, 30, 0.5, 1, tinte, 1);
  const conta = (g, k) => g.kind.reduce((s, v) => s + (v === k ? 1 : 0), 0);
  check('per il PRIMO ago la meta\' del secondo e\' coperta', conta(g0, rg.CELL_COVERED) > 0, true);
  check('...e la sua e\' roba propria', conta(g0, rg.CELL_OWN) > 0, true);
  check('per l\'ULTIMO ago non c\'e\' piu\' niente sopra: zero coperto', conta(g1, rg.CELL_COVERED), 0);
  check('e allora gli restano i bordi', conta(g1, rg.CELL_EDGE) > 0, true);
  const tinteBase = [
    { hex: '#111111', role: 'macchia', densitySpacingMm: 1, mode: 'pettine' },
    { hex: '#222222', role: 'base', densitySpacingMm: 1, mode: 'pettine' },
  ];
  check('una BASE cucita dopo copre tutto',
    rg.buildCoverGrid(mappaC, 40, 30, 0.5, 0, tinteBase, 1).kind.every((v) => v === rg.CELL_COVERED), true);
  const tinteEsc = [
    { hex: '#111111', role: 'macchia', densitySpacingMm: 1, mode: 'pettine' },
    { hex: '#222222', role: 'escluso', densitySpacingMm: 1, mode: 'pettine' },
  ];
  check('un colore ESCLUSO non copre niente (non si ricama)',
    rg.buildCoverGrid(mappaC, 40, 30, 0.5, 0, tinteEsc, 1).kind.every((v) => v !== rg.CELL_COVERED), true);

  console.log('\nbroccato — ④ sul lavoro intero: la copertura cala lungo l\'ordine di cucitura');
  // E' la firma della tecnica, misurata sul DST di riferimento: 81 77 66 53 51 29 0.
  const imgP = rg.sampleBroccatoImage(320, 280);
  const mmP = 0.28;
  const ridP = rg.reduceStable(imgP, { colorCount: 6, mmPerPx: mmP, flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 20 });
  const parP = { ...rg.defaultBroccatoParams, colors: rg.paletteToColors(ridP.palette) };
  const piano = rg.buildPlan(ridP, parP, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  const cop = piano.colors.map((c) => (c.travelMm > 0 ? (100 * c.travelCoveredMm) / c.travelMm : 0));
  check('ogni ago produce del filo', piano.colors.every((c) => c.threadMm > 0), true);
  check('l\'ULTIMO ago non ha piu\' niente sopra: passaggi scoperti', cop[cop.length - 1] < 1, true);
  check('i primi aghi si nascondono molto piu\' degli ultimi', (() => {
    const meta = Math.ceil(cop.length / 2);
    const primi = cop.slice(0, meta).reduce((a, b) => a + b, 0) / meta;
    const ultimi = cop.slice(meta).reduce((a, b) => a + b, 0) / (cop.length - meta);
    return primi > ultimi * 2;
  })(), true);
  // Sui passaggi INSTRADATI, cioe' quelli veri fra una macchia e l'altra. I passi da una riga
  // all'altra dentro una camera sono verticali per costruzione e non c'entrano niente.
  // L'orizzontalita' NON e' piu' la misura giusta. Lo era finche' il passaggio cercava la strada
  // piu' nascosta e si poteva spingerlo a preferire l'orizzontale; ora **costeggia il contorno**,
  // e la direzione se la detta la forma della macchia. Al suo posto si misura la cosa che conta
  // davvero, e che Lorenzo ha indicato guardando l'anteprima: quanto il filo TAGLIA DENTRO.
  const tagliaDentro = (piano, bandaMm) => {
    let pass = 0, dentro = 0;
    for (const c of piano.colors) for (const t of c.travels) {
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1], z = t[i];
        const d = Math.hypot(z.x - a.x, z.y - a.y); if (!d) continue;
        const n = Math.max(1, Math.ceil(d / 0.5));
        for (let u = 0; u < n; u++) {
          const f = (u + 0.5) / n, seg = d / n;
          const q = { x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f };
          pass += seg;
          for (const r of c.regions) {
            if (rg.pointInPolygon(q, r.outer) && rg.distanceToBoundary(q, r.outer) > bandaMm) { dentro += seg; break; }
          }
        }
      }
    }
    return pass ? (100 * dentro) / pass : 0;
  };
  check('il passaggio COSTEGGIA: quasi mai taglia dentro la macchia (misurato 6%)',
    tagliaDentro(piano, 1.5) < 12, true);
  check('e il filo non si stacca MAI (deciso da Lorenzo: niente salti)', piano.jumps, 0);
  // Il prezzo del costeggiare, misurato e accettato: su una macchia merlettata il giro sul
  // contorno e' lungo, e il passaggio sale dal 12-16% al 21% (demo grande) e fino al 42%
  // (immagine piccola, tutta filamenti). Si paga per non tagliare dentro e non staccare mai il
  // filo. La leva per farlo riscendere e' scegliere INGRESSO e USCITA di ogni macchia, che e' il
  // lavoro dopo: qui si tiene solo una guardia contro l'esplosione.
  check('il passaggio non esplode (sotto il 50% del filo)',
    piano.travelMm / piano.threadMm < 0.5, true);
  check('i salti restano rari come nel riferimento (sotto lo 0,5% dei punti)',
    piano.jumps / piano.pointCount < 0.005, true);
  check('la ricerca nasconde piu\' della via piu\' corta, sugli stessi passaggi',
    piano.routedCoveredMm >= piano.straightCoveredMm, true);

  check('stessi parametri → stesso ricamo (deterministico)',
    rg.buildPlan(ridP, parP, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP }).pointCount,
    piano.pointCount);

  console.log('\nbroccato — ④ i ruoli dei colori cambiano davvero il ricamo');
  const parBase = { ...parP, colors: parP.colors.map((c, i) => (i === 0 ? { ...c, role: 'base' } : c)) };
  const pianoBase = rg.buildPlan(ridP, parBase, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  check('un colore BASE riempie tutto il foglio (una macchia sola, molto piu\' filo)',
    pianoBase.colors[0].regions.length === 1 && pianoBase.colors[0].threadMm > piano.colors[0].threadMm * 2, true);
  const parEsc = { ...parP, colors: parP.colors.map((c, i) => (i === 0 ? { ...c, role: 'escluso' } : c)) };
  const pianoEsc = rg.buildPlan(ridP, parEsc, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  check('un colore ESCLUSO sparisce dal ricamo', pianoEsc.colors.length, piano.colors.length - 1);
  check('...e il filo cala di conseguenza', pianoEsc.threadMm < piano.threadMm, true);

  // -------------------------------------------------------------------------------------------
  // Punto ⑤ — la chiusura: punto minimo DOPO il routing (R3), fermatura di uscita (R8),
  // ed export riapribile (R9/R27/R31).
  // -------------------------------------------------------------------------------------------
  console.log('\nbroccato — ⑤ il punto minimo si impone DOPO i passaggi (R3)');
  // Non e' pignoleria: sono le giunzioni fra corse, tragitti e corridoi a reintrodurre i
  // micro-segmenti, e farlo prima non servirebbe a niente. striatura aveva gia' pagato questo
  // inciampo — il commento diceva che il pass c'era, e in pipeline non c'era.
  const sottoMinimo = (piano, minimo) => {
    let n = 0;
    for (const c of piano.colors) for (const b of c.blocks) {
      for (let i = 1; i < b.length; i++) {
        const d = Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y);
        if (d > 1e-9 && d < minimo - 1e-6) n++;
      }
    }
    return n;
  };
  const senzaMin = rg.buildPlan(ridP, { ...parP, minStitchMm: 0, endLockCount: 0 }, mmP,
    { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  const conMin = rg.buildPlan(ridP, { ...parP, minStitchMm: 1, endLockCount: 0 }, mmP,
    { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  check('senza il pass restano micro-segmenti', sottoMinimo(senzaMin, 1) > 50, true);
  check('col pass non ne resta nessuno sotto il minimo', sottoMinimo(conMin, 1), 0);
  check('e nessun punto cucito nello stesso buco (lunghezza zero)', (() => {
    for (const c of conMin.colors) for (const b of c.blocks) {
      for (let i = 1; i < b.length; i++) if (Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y) < 1e-9) return false;
    }
    return true;
  })(), true);
  check('il pass NON allunga il punto: il massimo resta quello chiesto', (() => {
    let m = 0;
    for (const c of conMin.colors) for (const b of c.blocks) {
      for (let i = 1; i < b.length; i++) m = Math.max(m, Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y));
    }
    return m <= Math.max(parP.maxStitchMm, parP.travelStitchMm) + 0.001;
  })(), true);

  console.log('\nbroccato — ⑤ la fermatura di uscita (R8), nella forma del DST');
  // Il riferimento NON ha il lock sul bordo di oblique: ha 4 punti da 0,30mm in fondo all'ago
  // (in 5 blocchi su 7) e nessuna fermatura in ingresso. Si segue quella.
  const conLock = rg.buildPlan(ridP, { ...parP, minStitchMm: 0, endLockCount: 4, endLockMm: 0.3 }, mmP,
    { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  const codaDi = (piano, k) => {
    const b = piano.colors[k].blocks[piano.colors[k].blocks.length - 1];
    const out = [];
    for (let i = Math.max(1, b.length - 4); i < b.length; i++) out.push(Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y));
    return out;
  };
  check('ogni ago finisce con punti cortissimi',
    conLock.colors.every((_, k) => codaDi(conLock, k).every((d) => d <= 0.31)), true);
  check('...che senza fermatura non ci sono',
    senzaMin.colors.every((_, k) => codaDi(senzaMin, k).every((d) => d <= 0.31)), false);
  check('la fermatura aggiunge 4 punti per ago, non di piu\'',
    conLock.pointCount - senzaMin.pointCount, 4 * senzaMin.colors.length);
  check('e NON c\'e\' fermatura in ingresso (come nel riferimento)', (() => {
    const b = conLock.colors[0].blocks[0];
    return Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) > 0.5;
  })(), true);
  check('a zero la fermatura sparisce',
    rg.buildPlan(ridP, { ...parP, endLockCount: 0 }, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP }).pointCount
      < conLock.pointCount, true);

  console.log('\nbroccato — ⑤ l\'export: un gruppo per stop, tinta unica, riapribile');
  const piano5 = rg.buildPlan(ridP, parP, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
  check('un gruppo di export per ogni ago cucito', piano5.exportLayers.length, piano5.colors.length);
  check('sono nell\'ORDINE di cucitura', piano5.exportLayers.map((l) => l.id),
    piano5.colors.map((_, k) => `stop-${String(k).padStart(4, '0')}`));
  check('ogni stop ha una tinta UNICA (due aghi dello stesso colore restano distinti)', (() => {
    const doppio = { ...parP, colors: parP.colors.map((c, i) => (i < 2 ? { ...c, hex: '#334455' } : c)) };
    const pd = rg.buildPlan(ridP, doppio, mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
    return new Set(pd.exportLayers.map((l) => l.color)).size === pd.exportLayers.length;
  })(), true);
  check('il filo si esporta SOTTILE (R15)', piano5.exportLayers.every((l) => l.strokeMm === 0.1), true);

  const svgOut = rg.buildSvg(piano5.exportLayers, {
    bounds: piano5.bounds, marginMm: 2,
    metadata: { rgProject: 'broccato', version: '0.1.0', params: parP },
  });
  const riletto = rg.readProjectMetadata(svgOut);
  check('l\'SVG si riapre e ridice da dove viene (R9/R27)', riletto && riletto.rgProject, 'broccato');
  check('...coi parametri intatti', riletto.params.colorCount, parP.colorCount);
  check('e la misura in mm è quella vera, margine compreso (R1)', (() => {
    const w = svgOut.split('width="')[1].split('mm"')[0];
    return Math.abs(Number(w) - (imgP.width * mmP + 4)) < 0.01;
  })(), true);

  const dstOut = rg.dstFromExportLayers(piano5.exportLayers, {
    label: 'BROCCATO',
    metadata: { rgProject: 'broccato', version: '0.1.0', params: parP },
  });
  check('il DST ha l\'intestazione Tajima', String.fromCharCode(...dstOut.slice(0, 3)), 'LA:');
  // Il record di fine NON e' negli ultimi byte: dopo l'END c'e' il footer dei parametri, che la
  // macchina ignora (R27). Lo si cerca dove finisce davvero la cucitura.
  const senzaMetaEnd = rg.dstFromExportLayers(piano5.exportLayers, { label: 'BROCCATO' });
  check('...e il record di fine, prima del footer dei parametri',
    [...senzaMetaEnd.slice(-3)].join(','), '0,0,243');
  const metaDst = rg.readDstMetadata(dstOut);
  check('anche il DST si riapre (R27: i parametri stanno DOPO l\'END)', metaDst && metaDst.rgProject, 'broccato');
  check('...coi parametri intatti', metaDst.params.colorCount, parP.colorCount);
  check('e il footer NON tocca la cucitura: identica fino all\'END',
    [...senzaMetaEnd].join(','), [...dstOut.slice(0, senzaMetaEnd.length)].join(','));
  check('un file che non viene da qui non confonde nessuno',
    rg.readProjectMetadata('<svg></svg>'), null);

  console.log('\nbroccato — le tinte scelte a mano non si perdono');
  // Il contagocce e' DOM, quindi qui si prova quello che sta sotto: una palette data non viene
  // ricatturata. Senza questo, muovere il pareggio della luce spazzerebbe via i colori presi a
  // mano — ed e' il motivo per cui serve la modalita' esplicita, come in `apps/bitmap`.
  const aMano = [[200, 30, 40], [20, 20, 20], [240, 230, 90], [130, 140, 200], [180, 160, 120], [90, 120, 80]];
  const conMia = rg.reduceStable(imgP, {
    colorCount: 6, mmPerPx: mmP, flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 20, palette: aMano,
  });
  check('la palette data e\' ESATTAMENTE quella che si usa',
    JSON.stringify(conMia.palette), JSON.stringify(aMano));
  check('...anche cambiando la preparazione', JSON.stringify(rg.reduceStable(imgP, {
    colorCount: 6, mmPerPx: mmP, flattenLightMm: 30, smoothMm: 1.5, minBlobMm2: 20, palette: aMano,
  }).palette), JSON.stringify(aMano));
  check('e ogni pixel finisce comunque su una di quelle tinte',
    conMia.index.every((v) => v < aMano.length), true);
  check('senza palette data, invece, le tinte le trova lui (e sono altre)',
    JSON.stringify(rg.reduceStable(imgP, { colorCount: 6, mmPerPx: mmP, flattenLightMm: 15, smoothMm: 0.9, minBlobMm2: 20 }).palette)
      !== JSON.stringify(aMano), true);
  check('il ricamo esce lo stesso con le tinte scelte a mano', (() => {
    const pm = rg.buildPlan(conMia, { ...parP, colors: rg.paletteToColors(aMano), paletteMode: 'manuale' },
      mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
    return pm.colors.length === 6 && pm.threadMm > 0;
  })(), true);
  check('e i fili escono proprio delle tinte scelte', (() => {
    const pm = rg.buildPlan(conMia, { ...parP, colors: rg.paletteToColors(aMano), paletteMode: 'manuale' },
      mmP, { widthMm: imgP.width * mmP, heightMm: imgP.height * mmP });
    return pm.colors.map((c) => c.color.hex).join(',');
  })(), aMano.map((c) => rg.rgbToHex(c)).join(','));

  console.log('\nbroccato — la misura: la larghezza reale prevale sulla stima (R11)');
  check('senza larghezza reale si stima al DPI',
    rg.mmPerPixel(960, { realWidthMm: 0, dpiDefault: 96 }).toFixed(4), (25.4 / 96).toFixed(4));
  check('con la larghezza reale la sagoma misura ESATTAMENTE quella',
    (rg.mmPerPixel(900, { realWidthMm: 270, dpiDefault: 96 }) * 900).toFixed(3), '270.000');
}

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `\n${failed} test falliti\n` : '\nTutti i test passati\n');
process.exit(failed ? 1 : 0);

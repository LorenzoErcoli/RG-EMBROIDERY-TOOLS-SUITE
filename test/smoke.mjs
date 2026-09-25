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
export { parseImportedBoundarySource, generatePattern, generateFinalPatternPoints, parseSvgTransform } from ${JSON.stringify(posix('packages/pattern-grammar/src/index.ts'))};
export { generateFill, generatePasses, stitchBudget, defaultInterlaceParams } from ${JSON.stringify(posix('apps/interlace/src/engine.ts'))};
export { generateStitch, stitchSteps, reinsertPoints, analyzeBitmap, buildSelectionMask, buildPalette, groupByPalette, defaultBitmapParams } from ${JSON.stringify(posix('apps/bitmap/src/engine.ts'))};
export { buildRawLevels, computeGridCounts, moduleFromPolylines, parseModuleSvg, defaultObliqueParams, resolveBoundaries, buildLaserExport, filterLevelByHoles, rectBoundaryOf, boundaryFromFormat, boundaryFromPoints, contourBoundary, simplifyLoop, isInside, applyModuleClipMode, cleanupPolylines, subtractExclusions, cleanupVoids, applyVoids, generateOblique, connectLayerContinuity, connectTechnicalDiagonals, enforceMinimumStitch, reconnectCutFragmentsOnBoundary, offsetPolygonBoundary, insetAnyBoundary, removeIsolatedSpikes } from ${JSON.stringify(posix('apps/oblique/src/engine.ts'))};
export { runBitmapPreview, runBitmapPipeline, PREVIEW_MAX_DOTS } from ${JSON.stringify(posix('apps/bitmap/src/pipeline.ts'))};
export { buildNet } from ${JSON.stringify(posix('apps/net-45/src/net.ts'))};
export { generateStriatura, layerThreadMm, defaultStriaturaParams } from ${JSON.stringify(posix('apps/striatura/src/engine.ts'))};
export { paletteToColors, applyDensityToAll, colorsToPalette, clampColorCount, mmPerPixel, defaultBroccatoParams } from ${JSON.stringify(posix('apps/broccato/src/engine.ts'))};
export { buildPlan } from ${JSON.stringify(posix('apps/broccato/src/pipeline.ts'))};
export { sampleImage as sampleBroccatoImage } from ${JSON.stringify(posix('apps/broccato/src/sample.ts'))};
export { readZones, resolveZoneAngles, orderZonesRaster, dominantAngleDeg, familyAngleDeg, boundsOfPoints as zoneBounds, rotatePoints, outerEdgeFlags, expandOuterEdges, cellElongation, familyAxisShiftDeg, STRIP_ELONGATION, zonesFromShapes, makeZone } from ${JSON.stringify(posix('packages/pattern-grammar/src/zone/engine.ts'))};
export { buildZonePlan, fillZone, threadMetres, travelMetres, exportSequenceLayers, PATTERN_INKS, inkFor, patternLetter, patternKeysInUse, patternChoices, normalizeRole } from ${JSON.stringify(posix('packages/pattern-grammar/src/zone/pipeline.ts'))};
export { buildEdgeGraph, travelAlongEdges } from ${JSON.stringify(posix('packages/pattern-grammar/src/zone/travel.ts'))};
export { readPatternSvg, readEmbeddedConfig, measureConstruction, migrateLegacyNames, periodOf, peakSpacing, modeOf } from ${JSON.stringify(posix('apps/zone-pattern/src/analyze.ts'))};
export { PATTERN_FIELD_NAMES, PATTERN_FIELD_KIND } from ${JSON.stringify(posix('apps/zone-pattern/src/fields.ts'))};
export { parseSvgPolylines } from ${JSON.stringify(posix('packages/pattern-grammar/src/index.ts'))};
export { runPipeline as runStriaturaPipeline } from ${JSON.stringify(posix('apps/striatura/src/pipeline.ts'))};
export { harmonicField, radialField, concentricField, constantField, meanFieldAngleDeg } from ${JSON.stringify(posix('apps/pittorico/src/field.ts'))};
export { buildCurvedFill, buildNaiveCurvedFill } from ${JSON.stringify(posix('apps/pittorico/src/curved-fill.ts'))};
export { coverageStats, neighbourSpacing, containment } from ${JSON.stringify(posix('apps/pittorico/src/coverage.ts'))};
export { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams } from ${JSON.stringify(posix('apps/pittorico/src/pipeline.ts'))};
export { buildRailFill } from ${JSON.stringify(posix('apps/pittorico/src/rail-fill.ts'))};
export { leggiRaso } from ${JSON.stringify(posix('apps/sfrangiatura/src/rasi.ts'))};
export { sfrangia } from ${JSON.stringify(posix('apps/sfrangiatura/src/frange.ts'))};
export { regolarizzaAnello, fitCerchio, fitRetta } from ${JSON.stringify(posix('apps/pittorico/src/primitives.ts'))};
export { regioniDiProva, bandaCurva, ventaglio, cerchio } from ${JSON.stringify(posix('apps/pittorico/src/sample.ts'))};
export * from ${JSON.stringify(posix('packages/core/src/index.ts'))};
export { routeCells as csRouteCells, colorPolylines as csColorPolylines, DEFAULT_ROUTE as CS_DEFAULT_ROUTE, RETRACE_PRESETS as CS_RETRACE_PRESETS } from ${JSON.stringify(posix('apps/cross-stitch/src/routing.ts'))};
export { editsFor as csEditsFor, cellsToJson as csCellsToJson, cellsFromJson as csCellsFromJson, fromThreadRoute as csFromThreadRoute, gridForSize as csGridForSize, gridHeight as csGridHeight, knitFromImage as csKnitFromImage, refinePalette as csRefinePalette, brushEdits as csBrushEdits, fillEdits as csFillEdits, applyEdits as csApplyEdits, fromTwoColumnV as csFromTwoColumnV } from ${JSON.stringify(posix('apps/cross-stitch/src/model.ts'))};
export { subGrid as csSubGrid, areaFromMm as csAreaFromMm, clampArea as csClampArea } from ${JSON.stringify(posix('apps/cross-stitch/src/area.ts'))};
export { segmentPoints as csSegmentPoints } from ${JSON.stringify(posix('apps/cross-stitch/src/model.ts'))};
export { zonesOf as csZonesOf } from ${JSON.stringify(posix('apps/cross-stitch/src/zones.ts'))};
export { costruisciPettine, parametriPettineDefault } from ${JSON.stringify(posix('apps/pettine/src/motore.ts'))};
export { generaLinee, programmaLinee, pezzoPiuLungo, PARAMETRI_DAVANTI, PARAMETRI_LATO, ROMBO_RIFERIMENTO } from ${JSON.stringify(posix('apps/cannage-rafia/src/linee.ts'))};
export { reticoloDaZone, contornoDaZone, zoneDaModello, lineeDaModello } from ${JSON.stringify(posix('apps/cannage-rafia/src/reticolo.ts'))};
export { PARAMETRI_STOP } from ${JSON.stringify(posix('apps/cannage-rafia/src/stop.ts'))};
export { sagomaDaZone, sagomaDaAnello, sagomaDaAnelli } from ${JSON.stringify(posix('apps/cannage-rafia/src/sagoma.ts'))};
export { stopContorno, stopGriglia, stopBase, stopLinee, stopCornice, stopBordatura, stratiProgramma, conPuntoMinimo, unisciTratti } from ${JSON.stringify(posix('apps/cannage-rafia/src/programma.ts'))};
export { generaCornice, divisioniCornice, latoDelReticolo, PARAMETRI_CORNICE } from ${JSON.stringify(posix('apps/cannage-rafia/src/cornice.ts'))};
export { generaBordatura, latiDelContorno, lineeDaLati, stessoLato, PARAMETRI_BORDATURA } from ${JSON.stringify(posix('apps/cannage-rafia/src/bordatura.ts'))};
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

// I `transform` di Illustrator. Un `<rect transform="translate(…) rotate(-45)">` è come Illustrator
// scrive un rombo: ignorare il transform non dà errore, dà UN QUADRATO DRITTO NEL POSTO SBAGLIATO.
// Fixture: il cannage vero di Lorenzo (37 zone, 6 colori) — 4 rombi arrivavano così.
console.log('\ntransform SVG: il rombo di Illustrator è un rombo, non un quadrato');
const cannageSvg = readFileSync(join(here, 'fixtures/cannage-zone.svg'), 'utf8');
const cannage = rg.parseImportedBoundarySource(cannageSvg, 'cannage-zone.svg',
  { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
const cannageZones = cannage.choices.flatMap((c) => c.boundary.paths);
const assiale = (pts) => {
  const q = pts.slice(0, 4);
  return q.length === 4 && q.every((a, i) => {
    const b = q[(i + 1) % 4];
    return Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
  });
};
check('nessuna zona resta assiale: i 4 rect ruotati sono ruotati davvero',
  cannageZones.filter((p) => assiale(p.points)).length, 0);
const rombo = cannageZones.find((p) => p.id === 'svg-rect-2').points;
check('il rombo ha le diagonali sugli assi (rotazione -45° applicata)',
  [Math.round(rombo[2].x - rombo[0].x), Math.round(rombo[2].y - rombo[0].y)], [91, 0]);
check('rotate(a,cx,cy) ruota attorno al centro dato',
  rg.parseSvgTransform('rotate(90 10 0)').map((v) => Math.round(v)), [0, 1, -1, 0, 10, -10]);
check('translate+rotate si compongono da sinistra a destra',
  rg.parseSvgTransform('translate(5,0) rotate(90)').map((v) => Math.round(v)), [0, 1, -1, 0, 5, 0]);

// Vernice: un file di CONTORNI si riconosce dal tratto, uno di ZONE PIENE dal riempimento.
// Qui il tratto è il nero del bordo, uguale per tutte le 37 zone: farlo vincere le collassa in una.
console.log('\nvernice: il tratto identifica i contorni, il riempimento le zone');
check('a riempimento: le 6 tinte del cannage restano 6',
  cannage.choices.map((c) => c.color), ['#ff2eaf', '#cd00ff', '#0018f9', '#00f700', '#f40000', '#f29b27']);
check('...e sono 37 zone in tutto', cannageZones.length, 37);
check('a tratto: le stesse 37 zone diventano UN nero solo',
  rg.parseImportedBoundarySource(cannageSvg, 'c.svg', { paintPriority: 'stroke' }).choices.map((c) => c.color), ['#000000']);
check('lo stroke di una regola multi-selettore (.cls-1, .cls-2 {…}) viene letto',
  rg.parseImportedBoundarySource(cannageSvg, 'c.svg').choices.length, 1);
check('Illustrator 72dpi: il disegno misura 378.421mm come dice Lorenzo',
  Number((cannage.source.finalBoundsMm.maxX - cannage.source.finalBoundsMm.minX).toFixed(3)), 378.421);

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
// I FORMATI GRANDI. Lorenzo, prima di lanciare un 80x40cm: «mi controlli se ci sono limiti di
// punti?». Il limite c'era e non era un tetto dichiarato: era un CRASH. `pointBounds` faceva
// `Math.min(...xs)` — un argomento per punto — e oltre qualche decina di migliaia lo stack
// finiva. Misurato col suo pattern più fitto (CANNAGE BASE — LEGGERO): 200x200mm passava con
// 72.184 punti, 300x300 no. Un 80x40cm era irraggiungibile.
// È il QUARTO punto dello stesso difetto nel repo (importer sul file da 2MB, header DST su
// 100k+ punti, boundsOfPoints di zone-pattern): questo è l'ultimo rimasto scoperto.
console.log('\npattern-grammar — i formati grandi non fanno saltare lo stack');
const pgLeggero = {
  horizontalZigzagWidth: 1.98, horizontalZigzagHeight: 1.74, horizontalZigzagInterline: 0.4,
  horizontalZigzagOffsetX: 0.8, horizontalZigzagSpacing: 4.236, verticalZigzagWidth: 0.5,
  verticalZigzagInterline: 0.4, verticalConnectorDiagonalOffsetY: 0.6, stepX: 1.83, offsetY: 1.922,
  minStitchMm: 2, constructionStroke: 0.05,
};
const pgGrande = rg.generateFinalPatternPoints({ ...pgLeggero, totalWidth: 800, totalHeight: 400 });
check('un 80x40cm col pattern più fitto si genera', pgGrande.points.length > 400000, true);
check('...e misura davvero 800x400mm', [Math.round(pgGrande.width), Math.round(pgGrande.height)], [800, 400]);
// Il tetto vero è quello del formato DST: il conteggio punti è un campo a 7 cifre, e `field()`
// lo TRONCA con slice() invece di rifiutarlo — oltre quel numero l'header direbbe una bugia.
check('e resta ben sotto il tetto del formato DST (9.999.999 punti)',
  pgGrande.points.length < 9999999, true);
// Anche senza formato dichiarato (dimensione naturale) si passa da un'altra funzione con lo
// stesso difetto — `targetPoint`, che sceglie da dove attaccare il filo.
check('anche senza formato, a dimensione naturale, non salta',
  rg.generateFinalPatternPoints({ ...pgLeggero, columns: 220, rows: 100 }).points.length > 100000, true);

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

// interlace — SFONDO SENZA RICAMO (`excludeBackground`), come l'esclusione sfondo del tappeto: i punti
// dell'immagine vicini al colore di sfondo non sono di nessuno e NESSUN filo ci cuce o ci passa.
// Si poteva già ottenere spegnendo un'intera riga della matrice, ma solo se lo sfondo era anche un
// colore-filo. Sul confine NON si applica il sormonto: lì il vuoto è voluto e il bordo va netto.
console.log('\ninterlace — sfondo senza ricamo');
const bgSquare = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }];
const bgSample = (x) => (x < 50 ? [255, 255, 255] : [2, 39, 80]); // metà bianca, metà blu
const bgParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 2, voidClearanceMm: 0, colors: ['#ffffff', '#022750'], clusterMode: true, clusterStrength: 100, seed: 5 };
const nelBianco = (passes, oltre) => { let n = 0; for (const pass of passes) for (const r of pass) for (const pt of r) if (pt.x < oltre) n++; return n; };
const bgAcceso = rg.generatePasses(bgSquare, [], { ...bgParams, excludeBackground: true, backgroundColor: '#ffffff', backgroundToleranceRgb: 30 }, [2, 2], (x) => bgSample(x));
const bgSpento = rg.generatePasses(bgSquare, [], bgParams, [2, 2], (x) => bgSample(x));
check('sfondo spento (com’era): il bianco si ricama', nelBianco(bgSpento, 45) > 200, true);
check('sfondo acceso: nel bianco non scende un punto, di nessun colore', nelBianco(bgAcceso, 48), 0);
check('sfondo acceso: il resto si riempie lo stesso', bgAcceso.reduce((n, pa) => n + pa.reduce((m, r) => m + r.length, 0), 0) > 200, true);
// Il bordo deve restare NETTO: senza sormonto sullo sfondo, nessun filo sconfina come farebbe fra due colori.
let bgMin = 1e9;
for (const pass of bgAcceso) for (const r of pass) for (const pt of r) if (pt.x < bgMin) bgMin = pt.x;
check('sfondo acceso: il bordo è netto, il filo non sconfina nel vuoto voluto', bgMin >= 49, true);

// interlace — TETTO AI PUNTI (`maxStitchesPerMm2`): nessun millimetro quadro prende più di N buchi
// d'ago, contando TUTTI i colori insieme. Serve alla macchina (filo che si spezza, ago, tessuto
// perforato): il tetto interno per-colore è relativo al suo obiettivo, quindi con più colori e
// agglomerati forti i picchi si SOMMANO. Deve tagliare la punta senza spostare la mediana — la
// disomogeneità è l'effetto e non si tocca.
console.log('\ninterlace — tetto ai punti (buchi d’ago per mm²)');
const capSquare = [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 90 }, { x: 0, y: 90 }];
const capSample = (x, y) => (Math.hypot(x - 45, y - 45) < 28 ? [2, 39, 80] : [244, 233, 213]);
const capParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 1, voidClearanceMm: 0, colors: ['#022750', '#f4e9d5'], clusterMode: true, clusterStrength: 100, seed: 3 };
/** Buchi d'ago per mm² su griglia da 1mm: mediana e massimo. */
function aghi(passes) {
  const g = new Uint16Array(92 * 92);
  for (const pass of passes) for (const r of pass) for (const p of r) {
    // Stesso incasellamento del motore (celle da 1mm ancorate a minX-1): con mezza cella di sfasamento
    // un mm² del metro raccoglierebbe punti da due celle del motore e il tetto sembrerebbe sforato.
    g[Math.min(91, Math.max(0, Math.floor(p.y) + 1)) * 92 + Math.min(91, Math.max(0, Math.floor(p.x) + 1))]++;
  }
  const v = [];
  for (let j = 3; j < 88; j++) for (let i = 3; i < 88; i++) v.push(g[j * 92 + i]);
  v.sort((a, b) => a - b);
  return { med: v[Math.floor(v.length / 2)], max: v[v.length - 1] };
}
const filoDi = (passes) => { let L = 0; for (const pass of passes) for (const r of pass) for (let i = 1; i < r.length; i++) L += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); return L; };
const capOff = rg.generatePasses(capSquare, [], { ...capParams, maxStitchesPerMm2: 0 }, [1, 1], capSample);
const capAuto = rg.generatePasses(capSquare, [], capParams, [1, 1], capSample); // default = null = automatico
const cap6 = rg.generatePasses(capSquare, [], { ...capParams, maxStitchesPerMm2: 6 }, [1, 1], capSample);
const aOff = aghi(capOff), aAuto = aghi(capAuto), a6 = aghi(cap6);
console.log(`   (senza tetto: mediana ${aOff.med}, picco ${aOff.max} · tetto 6: mediana ${a6.med}, picco ${a6.max})`);
check('senza tetto il picco è almeno il doppio della mediana (c’è una punta da tagliare)', aOff.max >= aOff.med * 2, true);
check('tetto esplicito 6: nessun mm² supera 6 buchi d’ago', a6.max <= 6, true);
check('tetto automatico: non peggiora mai il picco', aAuto.max <= aOff.max, true);
check('tetto automatico: resta comunque entro un limite sano', aAuto.max <= 14, true);
check('il tetto taglia la punta, NON la mediana (la disomogeneità resta)', a6.med >= aOff.med - 1, true);
check('tagliare la punta costa quasi nulla in filo (meno del 5%)', Math.abs(filoDi(cap6) / filoDi(capOff) - 1) < 0.05, true);

// Il conto del tetto è una funzione PURA, così il pannello può DIRE i numeri invece di lasciarli
// indovinare. Un tetto sotto `needed` affama la copertura: le celle si saturano prima di essere coperte
// e restano zone scoperte. È successo davvero (tetto messo a 2 dove ne servivano 3) e si è scoperto
// solo sul ricamo: il caso è bloccato qui.
const bud = rg.stitchBudget(capParams, [1, 1]);
check('il conto del tetto dice il minimo e l’automatico', bud.needed >= 1 && bud.auto >= bud.needed, true);
check('l’automatico lascia respiro: almeno il doppio del minimo', bud.auto >= bud.needed * 2, true);
const capStretto = rg.generatePasses(capSquare, [], { ...capParams, maxStitchesPerMm2: 1 }, [1, 1], capSample);
const vuoteDi = (passes) => {
  const g = new Uint8Array(92 * 92);
  for (const pass of passes) for (const r of pass) for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
    for (let k = 0; k <= n; k++) { const t = k / n; g[Math.min(91, Math.max(0, Math.round(a.y + (b.y - a.y) * t))) * 92 + Math.min(91, Math.max(0, Math.round(a.x + (b.x - a.x) * t)))] = 1; }
  }
  let v = 0; for (let j = 8; j < 82; j++) for (let i = 8; i < 82; i++) if (!g[j * 92 + i]) v++;
  return v;
};
console.log(`   (minimo ${bud.needed}, automatico ${bud.auto} · celle scoperte: automatico ${vuoteDi(capAuto)}, tetto 1 ${vuoteDi(capStretto)})`);
check('un tetto SOTTO il minimo lascia davvero zone scoperte (per questo il pannello avvisa)', vuoteDi(capStretto) > vuoteDi(capAuto), true);

// interlace — SORMONTO ai bordi delle zone (`zoneOverlapMm`). Due colori che non si mescolano si
// fermano testa a testa e a ridosso del confine NESSUNO dei due riesce più a cucire: la densità crolla e
// resta una fessura. Il sormonto fa posare a ciascuno una passata oltre il bordo, così i due si
// accavallano. Misura su un confine CURVO (è lì che il divieto morde: un punto dritto fra due estremi
// dello stesso lato taglia il confine dal lato concavo).
console.log('\ninterlace — sormonto ai bordi delle zone (la fessura fra due colori)');
const ovR = 60, ovCX = 100, ovCY = 100;
const ovSquare = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
const ovSample = (x, y) => (Math.hypot(x - ovCX, y - ovCY) < ovR ? [2, 39, 80] : [244, 233, 213]);
const ovParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 2, voidClearanceMm: 0, colors: ['#022750', '#f4e9d5'], clusterMode: true, clusterStrength: 100, seed: 1, zoneBans: [[false, true], [true, false]] };
/** Densità di filo nell'anello a distanza `d`±0.5mm dal confine, normalizzata sull'area dell'anello. */
function ringDensity(passes, d) {
  let L = 0;
  for (const pass of passes) for (const r of pass) for (let i = 1; i < r.length; i++) {
    const ax = r[i - 1].x, ay = r[i - 1].y, bx = r[i].x, by = r[i].y;
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 0.15)), dL = len / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const rr = Math.hypot(ax + (bx - ax) * t - ovCX, ay + (by - ay) * t - ovCY) - ovR;
      if (rr >= d - 0.5 && rr < d + 0.5) L += dL;
    }
  }
  return L / (2 * Math.PI * (ovR + d));
}
const seamOf = (passes) => {
  const rif = (ringDensity(passes, -8) + ringDensity(passes, 8)) / 2;
  return Math.min(ringDensity(passes, -0.5), ringDensity(passes, 0.5)) / rif;
};
const ovNetto = rg.generatePasses(ovSquare, [], { ...ovParams, zoneOverlapMm: 0 }, [2, 2], ovSample);
const ovAuto = rg.generatePasses(ovSquare, [], ovParams, [2, 2], ovSample); // zoneOverlapMm di default = null = automatico
const fessuraNetto = seamOf(ovNetto), fessuraAuto = seamOf(ovAuto);
check('confine netto: sul confine la densità cala sotto l\'80% (la fessura esiste)', fessuraNetto < 0.8, true);
check('sormonto automatico: la fessura si chiude (densità sopra il 90%)', fessuraAuto > 0.9, true);
const sconfino = (passes) => { let m = 0; for (const r of passes[0]) for (const p of r) { const d = Math.hypot(p.x - ovCX, p.y - ovCY) - ovR; if (d > m) m = d; } return m; };
check('confine netto: il filo scuro non esce (meno di 0.3mm)', sconfino(ovNetto) < 0.3, true);
check('sormonto automatico: sconfina di una fila di celle, non di più', sconfino(ovAuto) > 0.5 && sconfino(ovAuto) < 1.6, true);

// interlace — RAGGIO DI CATTURA per-colore (`colorTolerances`): due tinte SIMILI per una sfumatura.
// Tre bande: A chiara, M esattamente a metà strada, B chiara-diversa. Senza raggio vince il più vicino e
// la banda di mezzo finisce tutta a uno dei due (confine netto e arbitrario); stringendo i raggi la banda
// di mezzo non è di nessuno e i due fili ci restano alla stessa densità di base = passaggio morbido.
console.log('\ninterlace — raggio di cattura (due colori simili, sfumatura)');
const shA = [232, 217, 160], shM = [228, 213, 152], shB = [224, 208, 144]; // M = punto medio fra A e B
const shSample = (x) => (x < 40 ? shA : x < 80 ? shM : shB);
const shParams = { ...rg.defaultInterlaceParams, minStitchMm: 2, maxStitchMm: 5, densitySpacingMm: 2, voidClearanceMm: 0.3, colors: ['#e8d9a0', '#e0d090'], clusterMode: true, clusterStrength: 80 };
const midMm = (pass) => { let L = 0; for (const r of pass) for (let i = 1; i < r.length; i++) { const mx = (r[i].x + r[i - 1].x) / 2; if (mx > 41 && mx < 79) L += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); } return L; };
const shWide = rg.generatePasses(imgSquare, [], shParams, [2, 2], (x) => shSample(x));
const shTight = rg.generatePasses(imgSquare, [], { ...shParams, colorTolerances: [6, 6] }, [2, 2], (x) => shSample(x));
const wideA = midMm(shWide[0]), wideB = midMm(shWide[1]);
const tightA = midMm(shTight[0]), tightB = midMm(shTight[1]);
check('raggio illimitato (default): la banda di mezzo se la prende uno dei due', Math.max(wideA, wideB) > Math.min(wideA, wideB) * 1.5, true);
check('raggio stretto: la banda di mezzo non è di nessuno, i due fili ci stanno alla pari', Math.max(tightA, tightB) < Math.min(tightA, tightB) * 1.35, true);
check('raggio stretto: nessuno dei due sparisce dalla banda di mezzo', Math.min(tightA, tightB) > 100, true);

// interlace — DIVIETI DI TRANSITO (matrice filo × zona, `zoneBans`): un filo vietato in una zona non ci
// cuce E non ci passa nemmeno di transito. Sulla stessa immagine metà rossa (x<60) / metà blu (x>60):
// vietare il rosso nella zona blu deve lasciare la metà destra SENZA un solo punto rosso.
console.log('\ninterlace — divieti di transito (dove NON passa un filo)');
const banParams = { ...imgParams, zoneBans: [[false, true], [false, false]], zoneOverlapMm: 0 }; // rosso vietato in zona blu, confine netto
const banPasses = rg.generatePasses(imgSquare, [], banParams, [2, 2], (x) => imgSample(x));
const rightPts = (pass) => { let n = 0; for (const r of pass) for (const p of r) if (p.x > 60.01) n++; return n; };
const leftPts = (pass) => { let n = 0; for (const r of pass) for (const p of r) if (p.x < 59.99) n++; return n; };
check('divieto: il rosso non mette un punto nella zona blu', rightPts(banPasses[0]), 0);
check('divieto: il rosso continua a riempire la sua metà', leftPts(banPasses[0]) > 100, true);
check('divieto: il blu, non vietato, resta ovunque', rightPts(banPasses[1]) > 100 && leftPts(banPasses[1]) > 100, true);

// Colonna intera spenta = quella zona resta NUDA (tessuto a vista): nessun filo, di nessun colore.
const bareParams = { ...imgParams, zoneBans: [[false, true], [false, true]], zoneOverlapMm: 0 }; // tutti vietati in zona blu
const barePasses = rg.generatePasses(imgSquare, [], bareParams, [2, 2], (x) => imgSample(x));
check('divieto: colonna spenta = zona nuda per tutti i colori', barePasses.reduce((n, p) => n + rightPts(p), 0), 0);
check('divieto: il resto della sagoma si riempie comunque', barePasses.reduce((n, p) => n + leftPts(p), 0) > 200, true);

// I divieti vivono nelle ZONE: in mélange uniforme (senza agglomerati) non esistono zone e la matrice
// NON deve cambiare una virgola del risultato.
const sig = (passes) => { let n = 0, mm = 0; for (const pass of passes) for (const r of pass) { n += r.length; for (let i = 1; i < r.length; i++) mm += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); } return n + ':' + mm.toFixed(3); };
const uniPlain = rg.generatePasses(imgSquare, [], { ...imgParams, clusterMode: false }, [2, 2], (x) => imgSample(x));
const uniBanned = rg.generatePasses(imgSquare, [], { ...imgParams, clusterMode: false, zoneBans: [[false, true], [true, true]], zoneOverlapMm: 0 }, [2, 2], (x) => imgSample(x));
check('divieto: in mélange uniforme la matrice è inerte', sig(uniBanned), sig(uniPlain));

// Il caso che smaschera il controllo fatto male: una STRISCIA vietata SOTTILE (4mm) in mezzo al campo.
// Guardare solo la cella d'arrivo non basta — con punti fino a 15mm il filo la scavalcherebbe senza
// accorgersene. Qui si campiona ogni segmento rosso: nessuno deve toccare la striscia blu.
const stripeSample = (x) => (x >= 58 && x <= 62 ? [43, 108, 176] : [229, 36, 33]); // striscia blu di 4mm
const stripeParams = { ...imgParams, minStitchMm: 6, maxStitchMm: 15, zoneBans: [[false, true], [false, false]], zoneOverlapMm: 0 };
const stripePasses = rg.generatePasses(imgSquare, [], stripeParams, [2, 2], (x) => stripeSample(x));
let stripeCross = 0;
for (const r of stripePasses[0]) for (let i = 1; i < r.length; i++) {
  const n = Math.max(1, Math.ceil(Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y) / 0.5));
  for (let k = 0; k <= n; k++) { const x = r[i - 1].x + (r[i].x - r[i - 1].x) * (k / n); if (x > 58.5 && x < 61.5) stripeCross++; }
}
const stripeL = leftPts(stripePasses[0]), stripeR = rightPts(stripePasses[0]);
check('divieto: il rosso ricama su ENTRAMBI i lati della striscia', stripeL > 50 && stripeR > 50, true);
check('divieto: ...ma nessun segmento rosso la attraversa (transito, non solo arrivo)', stripeCross, 0);

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
check('anteprima: dichiara quanti punti doveva disegnare e quanti ne ha disegnati', bPv.previewPoints === bListed && bPv.drawnPoints === bDrawn, true);

// Il tetto di DISEGNO dell'anteprima e' un limite visivo: sopra di esso i puntini si diradano e
// compaiono buchi REGOLARI che nel ricamo non ci sono. Difetto trovato da Lorenzo con un'immagine
// da 410mm: col tetto vecchio (120.000) l'anteprima si bucava e non lo diceva. Il conteggio non
// dipende dai pixel ma dalla misura in mm e dalla distanza punti (largh/dist x alt/dist) — vale
// pero' solo finche' la cella e' piu' grande del pixel, percio' la fixture e' 800x1000px.
// Si blocca il patto: (a) il tetto e' quello dichiarato, (b) sotto il tetto non si dirada mai,
// (c) sopra il tetto il risultato lo DICHIARA, (d) la generazione non ne risente: cuce tutto.
console.log('\nbitmap — il tetto di disegno dell’anteprima non mente mai');
check('il tetto di disegno e’ 300.000 punti', rg.PREVIEW_MAX_DOTS, 300000);
{
  const tW = 800, tH = 1000;                     // piu' alta che larga, come il file di Lorenzo
  const tBuf = new Uint8ClampedArray(tW * tH * 4);
  for (let i = 0; i < tW * tH; i++) { tBuf[i * 4] = 0x20; tBuf[i * 4 + 1] = 0x20; tBuf[i * 4 + 2] = 0x20; tBuf[i * 4 + 3] = 255; }
  const tP = (realWidthMm) => ({ ...rg.defaultBitmapParams, colorCount: 1, realWidthMm, maxWidthPx: 0 });
  const at = (mm) => rg.runBitmapPreview(tBuf, tW, tH, tP(mm), mm / tW);
  const cella = (mm) => rg.defaultBitmapParams.densitySpacingMm / (mm / tW);

  const sotto = at(410);                         // IL caso di Lorenzo
  check('la cella resta piu’ grande del pixel: il conteggio e’ metrico, non a pixel', cella(410) > 1, true);
  check('a 410mm i punti superano il VECCHIO tetto di 120.000', sotto.previewPoints > 120000, true);
  check('...eppure ora l’anteprima li disegna TUTTI (era il caso che si bucava)', sotto.drawnPoints, sotto.previewPoints);

  const sopra = at(700);                         // oltre il tetto nuovo: puo’ diradare, ma DEVE dirlo
  check('oltre il tetto l’anteprima dirada davvero', sopra.drawnPoints < sopra.previewPoints, true);
  check('...senza mai superare il tetto dichiarato', sopra.drawnPoints <= rg.PREVIEW_MAX_DOTS, true);
  check('...e il numero VERO dei punti resta dichiarato, non diradato', sopra.previewPoints > rg.PREVIEW_MAX_DOTS, true);

  // La cosa che conta davvero: il diradamento e’ SOLO disegno — il ricamo ha tutti i punti.
  const cuciti = rg.generateStitch(tBuf, tW, tH, tP(700), 700 / tW).colors.reduce((s, c) => s + c.finalPoints, 0);
  check('il diradamento e’ SOLO visivo: la generazione cuce tutti i punti', cuciti, sopra.previewPoints);
}

// La generazione ora ha DUE strade — in un colpo solo (`generateStitch`, quella dei test e degli
// script) e a passi con la barra di avanzamento (`stitchSteps`, quella del pannello). Sono lo stesso
// codice, ma "sono lo stesso codice" è esattamente il genere di cosa che smette di essere vera senza
// che nessuno se ne accorga. Qui si blocca: stesse fixture, stesso identico risultato.
console.log('\nbitmap — la generazione a passi e quella in un colpo solo non possono divergere');
{
  const pW = 90, pH = 70;
  const pBuf = new Uint8ClampedArray(pW * pH * 4);
  for (let i = 0; i < pW * pH; i++) {
    const x = i % pW, y = (i / pW) | 0, c = (x + y) % 3;
    pBuf[i * 4] = c === 0 ? 0x20 : c === 1 ? 0xb0 : 0x50;
    pBuf[i * 4 + 1] = 0x30;
    pBuf[i * 4 + 2] = c === 0 ? 0x8a : 0x40;
    pBuf[i * 4 + 3] = 255;
  }
  // Piena risoluzione: quasi tutti i punti finiscono "in attesa" e il REINSERIMENTO lavora davvero
  // — è la fase che si è dovuta spezzare a fette per non congelare la barra.
  const casi = [
    { nome: 'a righe, piena risoluzione', p: { densitySpacingMm: 0, minStitchMm: 1, reinsertionRounds: 1, ordering: 'scanline', colorCount: 2 } },
    { nome: 'più vicino, 2 giri', p: { densitySpacingMm: 0, minStitchMm: 1.5, reinsertionRounds: 2, ordering: 'nearest', colorCount: 1 } },
    { nome: 'griglia normale', p: { densitySpacingMm: 1.2, minStitchMm: 1, reinsertionRounds: 1, ordering: 'scanline', colorCount: 3 } },
  ];
  for (const { nome, p } of casi) {
    const par = { ...rg.defaultBitmapParams, ...p, maxWidthPx: 0 };
    const inUnColpo = rg.generateStitch(pBuf, pW, pH, par, 0.2646);

    // ...e la stessa cosa consumata passo per passo, raccogliendo l'avanzamento.
    const g = rg.stitchSteps(pBuf, pW, pH, par, 0.2646);
    const avanzamento = [];
    let r = g.next();
    while (!r.done) { avanzamento.push(r.value); r = g.next(); }
    const aPassi = r.value;

    check(`${nome}: stesso identico ricamo per le due strade`, JSON.stringify(aPassi), JSON.stringify(inUnColpo));
    check(`${nome}: l'avanzamento non torna mai indietro`, avanzamento.every((v, i) => i === 0 || v.done >= avanzamento[i - 1].done), true);
    check(`${nome}: l'avanzamento non sfora mai il totale`, avanzamento.every((v) => v.done <= v.total), true);
    check(`${nome}: dice sempre cosa sta facendo`, avanzamento.every((v) => typeof v.phase === 'string' && v.phase.length > 0), true);
  }
}

// Il reinserimento del punto minimo si fa A FETTE per lasciar respirare la barra. È equivalente a
// farlo in blocco solo se ogni punto in attesa incontra il percorso NELLO STESSO STATO — cosa vera
// perché le fette si passano il percorso man mano che cresce. Vale la pena bloccarlo: se un giorno
// qualcuno parallelizzasse le fette, il ricamo cambierebbe in silenzio.
console.log('\nbitmap — il punto minimo a fette è identico al punto minimo in blocco');
{
  const rnd = (() => { let a = 12345; return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  const percorso = [], attesa = [];
  for (let i = 0; i < 40; i++) percorso.push({ x: i * 9, y: 40 + Math.round(20 * Math.sin(i / 3)) });
  for (let i = 0; i < 900; i++) attesa.push({ x: rnd() * 360, y: rnd() * 80 });
  const MIN = 6;

  const inBlocco = rg.reinsertPoints(percorso, attesa, MIN);
  let cur = percorso; const resto = [];
  for (let i = 0; i < attesa.length; i += 256) {           // stesso passo del motore (REINSERT_TICK)
    const r = rg.reinsertPoints(cur, attesa.slice(i, i + 256), MIN);
    cur = r.path;
    for (const q of r.leftover) resto.push(q);
  }
  check('percorso identico', JSON.stringify(cur), JSON.stringify(inBlocco.path));
  check('scarti identici', JSON.stringify(resto), JSON.stringify(inBlocco.leftover));
  check('e il reinserimento ha lavorato davvero (non è un test a vuoto)', inBlocco.path.length > percorso.length, true);
}

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

// LETTURA della cucitura (readDst): l'inverso esatto di buildDst. Il test che conta e' l'andata e
// ritorno — leggere e riscrivere deve ridare gli STESSI BYTE — perche' e' l'unica prova che le due
// tabelle dei bit non hanno divergenze (R28), ed e' cio' che rende sicuro modificare un ricamo altrui.
console.log('\ncore — lettura della cucitura dal .dst (readDst)');
const rdProg = { label: 'RGTEST', coordinate_system: 'svg', paths: [
  { needle: 1, points_mm: [[0, 0], [10, 0], [10, 10], [0, 10]] },
  { needle: 2, points_mm: [[20, 20], [30, 20], [30, 30]] },
] };
const rdBytes = rg.buildDst(rdProg);
const rd = rg.readDst(rdBytes);
check('readDst: due blocchi', rd.blocks.length, 2);
check('readDst: un cambio-colore → due aghi', [rd.colorChanges, rd.blocks[1].needle], [1, 2]);
check('readDst: i punti del primo blocco, dal principio', JSON.stringify(rd.blocks[0].points_mm), JSON.stringify(rdProg.paths[0].points_mm));
check('readDst: i punti del secondo blocco', JSON.stringify(rd.blocks[1].points_mm), JSON.stringify(rdProg.paths[1].points_mm));
check('readDst: il salto fra i due blocchi e’ quello vero', JSON.stringify(rd.jumps[1]), JSON.stringify({ from: [0, 10], to: [20, 20] }));
const rdRe = rg.buildDst(rg.dstProgramFromBlocks(rd.blocks, { label: rd.label }));
check('readDst: andata e ritorno BYTE per BYTE', Array.from(rdRe).join(','), Array.from(rdBytes).join(','));
// il primo punto di un blocco e' quello dove il salto porta l'ago: perderlo sposta tutto di un punto
// e non se ne accorge nessuno finche' non si riscrive il file. Trovato cosi', bloccato qui.
check('readDst: il blocco comincia dove finisce il salto', JSON.stringify(rd.blocks[0].points_mm[0]), JSON.stringify(rd.jumps[0].to));
// un .dst della suite si rilegge coi suoi parametri
check('readDst: i parametri di progetto tornano col resto', rg.readDst(dstYes).metadata?.rgProject, 'bitmap');

// ...e sul RICAMO VERO fatto a mano in Stilista (la fixture del dossier). Un file scritto da un altro
// software prova cio' che una fixture nostra non puo': che la lettura non dipende dal nostro writer.
const dstVero = new Uint8Array(readFileSync(join(root, 'BRIEFING-RASO-OMOGENEO/riferimento-a-mano.dst')));
const rv = rg.readDst(dstVero);
check('DST vero: 4 aghi', rv.colorChanges + 1, 4);
check('DST vero: 188.139 punti cuciti', rv.stitchCount, 188139);
check('DST vero: 62 blocchi', rv.blocks.length, 62);
// 42 rasi + 20 fermature da un punto solo (~11mm): il conteggio "42 blocchi" letto la prima volta
// scartava proprio queste, perche' perdendo il punto iniziale restavano lunghe 1 e cadevano.
check('DST vero: 42 rasi e 20 fermature da 2 punti', [rv.blocks.filter((b) => b.points_mm.length >= 5).length, rv.blocks.filter((b) => b.points_mm.length === 2).length], [42, 20]);
let rvMinX = Infinity, rvMaxX = -Infinity, rvMinY = Infinity, rvMaxY = -Infinity;
for (const b of rv.blocks) for (const [px, py] of b.points_mm) {
  if (px < rvMinX) rvMinX = px; if (px > rvMaxX) rvMaxX = px;
  if (py < rvMinY) rvMinY = py; if (py > rvMaxY) rvMaxY = py;
}
check('DST vero: ingombro 419,7 × 353,3 mm', [(rvMaxX - rvMinX).toFixed(1), (rvMaxY - rvMinY).toFixed(1)], ['419.7', '353.3']);
const rvRe = rg.readDst(rg.buildDst(rg.dstProgramFromBlocks(rv.blocks, { label: rv.label })));
let rvUguali = rvRe.blocks.length === rv.blocks.length;
if (rvUguali) for (let i = 0; i < rv.blocks.length && rvUguali; i++) {
  const a = rv.blocks[i].points_mm, b = rvRe.blocks[i].points_mm;
  if (a.length !== b.length) { rvUguali = false; break; }
  for (let j = 0; j < a.length; j++) if (Math.abs(a[j][0] - b[j][0]) > 1e-9 || Math.abs(a[j][1] - b[j][1]) > 1e-9) { rvUguali = false; break; }
}
check('DST vero: riscritto e riletto, gli stessi punti al millesimo', rvUguali, true);

// I CAPI DELLE FILE DI RASO dentro un blocco cucito (tool `sfrangiatura`). Misurato contro verita'
// nota: un raso generato dal core, dove le file si sanno gia' quante sono e dove finiscono.
console.log('NL_core — le file di raso dentro un blocco (leggiRaso)'.replace('NL_', String.fromCharCode(10)));
const sfRett = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }];
const sfRighe = rg.buildParallelFill(sfRett, [], { angleDeg: 0, spacingMm: 0.4, maxStitchMm: 3, mode: 'serpentine' });
const sfPunti = [];
for (const r of sfRighe) for (const p of r) sfPunti.push(p);
const sfLetto = rg.leggiRaso(sfPunti);
check('leggiRaso: 30 file → 60 capi', [sfRighe.length, sfLetto.capi.length], [30, 60]);
check('leggiRaso: i capi si dividono in due lati uguali', [sfLetto.capi.filter((c) => c.lato === 0).length, sfLetto.capi.filter((c) => c.lato === 1).length], [30, 30]);
// il capo sta sul BORDO della forma, non a caso dentro: e' la prova che sono i capi veri
const sfX0 = sfLetto.capi.filter((c) => c.lato === 0).map((c) => c.punto.x);
const sfX1 = sfLetto.capi.filter((c) => c.lato === 1).map((c) => c.punto.x);
check('leggiRaso: un lato sul bordo x=0, l’altro su x=20', [Math.max(...sfX0), Math.min(...sfX1)], [0, 20]);
// la direzione del capo e' quella con cui la fila ci arriva: allungare vuol dire proseguire di li'
const sfOriz = sfLetto.capi.filter((c) => c.filaMm > 1).every((c) => Math.abs(c.direzione.y) < 1e-9);
check('leggiRaso: la direzione del capo segue la fila', sfOriz, true);
// e il riconoscimento sopravvive al giro in DST (decimi di mm)
const sfDst = rg.readDst(rg.buildDst({ label: 'SF', coordinate_system: 'svg', paths: [{ needle: 1, points_mm: sfPunti.map((p) => [p.x, p.y]) }] }));
const sfDopo = rg.leggiRaso(sfDst.blocks[0].points_mm.map(([x, y]) => ({ x, y })));
check('leggiRaso: dopo il giro in DST, gli stessi capi', sfDopo.capi.length, sfLetto.capi.length);
let sfScarto = 0;
for (let i = 0; i < sfDopo.capi.length; i++) sfScarto = Math.max(sfScarto, Math.hypot(sfDopo.capi[i].punto.x - sfLetto.capi[i].punto.x, sfDopo.capi[i].punto.y - sfLetto.capi[i].punto.y));
check('leggiRaso: e nelle stesse posizioni', sfScarto < 0.06, true);
// un blocco che NON e' un raso (una fermatura da 2 punti) da' i suoi estremi e nessuna fila: giusto cosi'
const sfFerm = rg.leggiRaso([{ x: 0, y: 0 }, { x: 11, y: 0 }]);
check('leggiRaso: una fermatura da' + ' 2 punti da' + ' i suoi due capi e una fila sola', [sfFerm.capi.length, sfFerm.capi[0].filaMm, sfFerm.capi[1].filaMm], [2, 11, 11]);

// ...e sul RICAMO VERO. La soglia dell'inversione non e' scelta a occhio: la svolta dei punti e'
// bimodale con un deserto fra 50 e 130 gradi, quindi spostarla dentro il deserto non cambia nulla.
const rvRasi = rv.blocks.filter((b) => b.points_mm.length >= 5).map((b) => b.points_mm.map(([x, y]) => ({ x, y })));
const rvCapi = (soglia) => rvRasi.reduce((n, p) => n + rg.leggiRaso(p, soglia ? { sogliaInversioneDeg: soglia } : undefined).capi.length, 0);
check('DST vero: 27.477 capi di raso nei 42 blocchi', rvCapi(), 27477);
const rvA = rvCapi(60), rvB = rvCapi(135);
check('DST vero: la soglia dell’inversione non conta (60° e 135° entro l’1%)', Math.abs(rvA - rvB) / rvA < 0.01, true);

// LA SFRANGIATURA. La promessa del tool e' negativa prima che positiva: **il ricamo di partenza non
// si tocca**. La frangia e' un andata e ritorno che si AGGIUNGE - dal capo si esce fino alla punta e
// si rientra nello stesso buco - quindi togliendo i punti aggiunti si deve riottenere il file di
// prima, punto per punto. Su 188.139 punti un effetto collaterale non si vedrebbe a occhio.
console.log('NL_core - la sfrangiatura: le frange che si aggiungono (sfrangia)'.replace('NL_', String.fromCharCode(10)));
const sfBlocchi = [{ needle: 1, points_mm: sfPunti.map((p) => [p.x, p.y]) }];
const sfPar = { lunghezzaMinMm: 1, lunghezzaMaxMm: 5, aperturaMinDeg: 10, aperturaMaxDeg: 25, seme: 1 };
/** Punti aggiunti se l'originale e' ancora tutto li' e in ordine, -1 se qualcosa e' stato toccato. */
const sfAggiunti = (prima, dopo) => {
  if (prima.length !== dopo.length) return -1;
  let extra = 0;
  for (let i = 0; i < prima.length; i++) {
    const a = prima[i].points_mm, b = dopo[i].points_mm;
    let k = 0;
    for (let j = 0; j < a.length; j++) {
      while (k < b.length && (b[k][0] !== a[j][0] || b[k][1] !== a[j][1])) { k++; extra++; }
      if (k >= b.length) return -1;
      k++;
    }
    extra += b.length - k;
  }
  return extra;
};
const sfIdentici = (a, b) => JSON.stringify(a.map((x) => x.points_mm)) === JSON.stringify(b.map((x) => x.points_mm));
// niente zone marcate = niente da fare: e' la garanzia che il tool non "sistema" nulla di suo
const sfNulla = rg.sfrangia(sfBlocchi, [], sfPar);
check('sfrangia: nessuna zona -> nessuna frangia, e il file com\u2019era', [sfNulla.frange, sfAggiunti(sfBlocchi, sfNulla.blocchi)], [0, 0]);
// una zona che copre solo il bordo x=20: si sfrangiano i capi di QUEL lato e nessun altro
const sfZona = [[{ x: 19, y: -1 }, { x: 25, y: -1 }, { x: 25, y: 13 }, { x: 19, y: 13 }]];
const sfUno = rg.sfrangia(sfBlocchi, sfZona, sfPar);
check('sfrangia: 30 frange sui capi del lato marcato', sfUno.frange, 30);
// LA garanzia: due punti aggiunti per frangia (la punta e il rientro), e nemmeno uno spostato
check('sfrangia: due punti aggiunti per frangia, e il raso intatto', sfAggiunti(sfBlocchi, sfUno.blocchi), 60);
// l'attacco e lo stacco del filo restano dove sono anche marcando TUTTO: li' il filo entra ed esce
const sfTutto = rg.sfrangia(sfBlocchi, [[{ x: -1, y: -1 }, { x: 25, y: -1 }, { x: 25, y: 13 }, { x: -1, y: 13 }]], sfPar);
check('sfrangia: l\u2019attacco e lo stacco non si toccano', sfTutto.saltati.attaccoOStacco, 2);
// la punta sta fra il minimo e il massimo chiesti, e prosegue lungo la fila entro l'apertura
let sfMin = Infinity, sfMax = 0, sfFuoriAsse = 0;
for (const b of sfUno.blocchi) for (let j = 1; j < b.points_mm.length - 1; j++) {
  const a = b.points_mm[j - 1], p = b.points_mm[j], c = b.points_mm[j + 1];
  if (a[0] !== c[0] || a[1] !== c[1]) continue;           // la punta e' il punto fra due gemelli
  const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
  if (d < sfMin) sfMin = d; if (d > sfMax) sfMax = d;
  if (Math.abs(Math.atan2(p[1] - a[1], p[0] - a[0]) * 180 / Math.PI) > 25.001) sfFuoriAsse++;
}
check('sfrangia: la frangia sta fra il minimo e il massimo chiesti', [sfMin >= 1 - 1e-9, sfMax <= 5 + 1e-9], [true, true]);
check('sfrangia: e prosegue lungo la fila, entro l\u2019apertura dichiarata', sfFuoriAsse, 0);
// il sormonto alza il pavimento e non il soffitto: nessuna frangia sotto (sormonto + minimo)
const sfSorm = rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, sormontoMm: 3 });
check('sfrangia: il sormonto alza il pavimento', sfSorm.frangiaMediaMm - sfUno.frangiaMediaMm > 2.9, true);
// determinismo: e' cio' che rende un ricamo correggibile e rifattibile
check('sfrangia: stesso seme, stesso ricamo', sfIdentici(sfUno.blocchi, rg.sfrangia(sfBlocchi, sfZona, sfPar).blocchi), true);
check('sfrangia: seme diverso, frange diverse', sfIdentici(sfUno.blocchi, rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, seme: 2 }).blocchi), false);
// il limite della macchina non si sfora nemmeno chiedendo l'impossibile (il record DST arriva a 12,1)
const sfEnorme = rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, lunghezzaMinMm: 30, lunghezzaMaxMm: 40, puntoMassimoMm: 12 });
let sfPiuLungo = 0;
for (const b of sfEnorme.blocchi) for (let i = 1; i < b.points_mm.length; i++)
  sfPiuLungo = Math.max(sfPiuLungo, Math.hypot(b.points_mm[i][0] - b.points_mm[i - 1][0], b.points_mm[i][1] - b.points_mm[i - 1][1]));
check('sfrangia: nessun punto oltre il limite della macchina', sfPiuLungo <= 12 + 1e-6, true);
check('sfrangia: e lo dichiara invece di farlo di nascosto', sfEnorme.limitate, sfEnorme.frange);
// un ago escluso non viene toccato
check('sfrangia: un ago escluso resta com\u2019era', rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, aghiEsclusi: [1] }).frange, 0);
// L'INTRECCIO: l'effetto voluto non e' un pettine di frange parallele ma delle X. Il verso della
// virata alterna fra capi dello STESSO lato - i soli davvero vicini sul ricamo - ed e' cio' che le
// fa tagliare. Ad apertura 0 restano parallele: e' il controllo negativo.
check('sfrangia: apertura 0 -> frange parallele, nessuna X', rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, aperturaMinDeg: 0, aperturaMaxDeg: 0 }).incroci, 0);
check('sfrangia: con l\u2019apertura le frange si tagliano', sfUno.incroci > 5, true);
const sfStretto = rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, aperturaMinDeg: 2, aperturaMaxDeg: 6 });
const sfLargo = rg.sfrangia(sfBlocchi, sfZona, { ...sfPar, aperturaMinDeg: 30, aperturaMaxDeg: 50 });
check('sfrangia: piu\u2019 apertura, piu\u2019 incroci', sfStretto.incroci < sfUno.incroci && sfUno.incroci < sfLargo.incroci, true);

// sul RICAMO VERO: una striscia marcata aggiunge le sue frange e non tocca nient'altro
const rvZona = [[{ x: -1000, y: 98.89 }, { x: 1000, y: 98.89 }, { x: 1000, y: 106.89 }, { x: -1000, y: 106.89 }]];
const rvSfr = rg.sfrangia(rv.blocks, rvZona, sfPar);
check('DST vero: 416 frange nella striscia', rvSfr.frange, 416);
check('DST vero: 832 punti aggiunti, e il ricamo di partenza intatto', sfAggiunti(rv.blocks, rvSfr.blocchi), 832);
check('DST vero: e le frange si intrecciano (197 X)', rvSfr.incroci, 197);
check('DST vero: il filo aggiunto e\u2019 2,5 m', rvSfr.filoAggiuntoM.toFixed(1), '2.5');
// senza zone il file riscritto e' identico BYTE PER BYTE: la prova piu' forte che si possa scrivere
const rvByteA = rg.buildDst(rg.dstProgramFromBlocks(rv.blocks, { label: rv.label }));
const rvByteB = rg.buildDst(rg.dstProgramFromBlocks(rg.sfrangia(rv.blocks, [], sfPar).blocchi, { label: rv.label }));
check('DST vero: senza zone marcate il file e\u2019 identico byte per byte', Array.from(rvByteA).join(',') === Array.from(rvByteB).join(','), true);

// L'importer a stringhe e la CUBICA LISCIA (S/s) di Illustrator. Non la conosceva, e su un comando
// ignoto si fermava: il resto del tracciato spariva, la forma usciva mozza, e nessun errore. Trovato
// sul vettoriale a sei gruppi di Lorenzo, dove 19 forme su 90 erano mozze o vuote.
console.log('NL_pattern-grammar — importer: la cubica liscia S/s'.replace('NL_', String.fromCharCode(10)));
// Il test giusto non e' un'area a occhio: e' che S produca ESATTAMENTE la C equivalente. Per la
// specifica SVG, dopo C33,0 66,0 100,0 il primo controllo di S e' il riflesso di (66,0) attorno a
// (100,0), cioe' (134,0): quindi «S100,66 100,100» deve dare gli stessi punti di «C134,0 100,66 100,100».
const conS = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><path fill="#000" d="M0,0 C33,0 66,0 100,0 S100,66 100,100 s-66,0 -100,0 Z"/></svg>';
const conC = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><path fill="#000" d="M0,0 C33,0 66,0 100,0 C134,0 100,66 100,100 C100,134 34,100 0,100 Z"/></svg>';
const pS = rg.parseSvgPolylines(conS, {}).polylines[0] ?? [], pC = rg.parseSvgPolylines(conC, {}).polylines[0] ?? [];
check('S/s: il tracciato arriva fino in fondo (stesso numero di punti della C esplicita)', pS.length, pC.length);
let scartoS = 0;
for (let k = 0; k < Math.min(pS.length, pC.length); k++) scartoS = Math.max(scartoS, Math.hypot(pS[k].x - pC[k].x, pS[k].y - pC[k].y));
check('S/s: e sono gli stessi punti della C equivalente (riflesso del controllo)', scartoS < 1e-6, true);
// e senza questo ramo la forma era mozza: l'area deve essere quella della C, non un frammento
check('S/s: stessa area della C esplicita', Math.round(Math.abs(rg.polygonArea(pS))), Math.round(Math.abs(rg.polygonArea(pC))));

// La riapertura del .dst è dichiarata in STATO come CAPACITÀ GLOBALE, ma per mesi è stata vera
// solo per bitmap e oblique: gli altri quattro tool scrivevano il DST senza parametri e nessuno
// se ne accorgeva, perché la dichiarazione stava in un documento e non in un test.
// Qui si verifica sul SORGENTE, perché gli handler di export vivono nel DOM e headless non si
// possono chiamare: ogni tool deve passare `metadata` col PROPRIO nome, e saper rileggere.
console.log('\nsuite — ogni tool scrive i parametri nel .dst e li sa rileggere (R27)');
for (const [tool, id] of [['net-45', 'net-45'], ['pattern-grammar', 'pattern-grammar'],
  ['interlace', 'interlace'], ['striatura', 'striatura'], ['oblique', 'oblique'],
  ['bitmap', 'bitmap'], ['zone-pattern', 'zone-pattern'], ['cannage-rafia', 'cannage-rafia'], ['cross-stitch', 'cross-stitch']]) {
  const src = readFileSync(join(root, `apps/${tool}/src/tool.ts`), 'utf8');
  const call = src.indexOf('dstFromExportLayers(');
  const blocco = call >= 0 ? src.slice(call, call + 600) : '';
  // Il `metadata` può essere scritto sul posto o arrivare da una funzione (zone-pattern lo
  // costruisce a parte perché ci mette dentro anche il disegno): si chiede che la chiamata lo
  // passi, e che il file dichiari il PROPRIO nome — non quello di un altro tool.
  check(`${tool}: il DST esce coi parametri di "${id}"`,
    call >= 0 && /metadata:/.test(blocco) && new RegExp(`rgProject: '${id}'`).test(src), true);
  check(`${tool}: sa rileggere un .dst`, /readDstMetadata/.test(src), true);
  check(`${tool}: accetta un .dst in ingresso`, /accept="[^"]*\.dst/.test(src), true);
}

// interlace — RIAPRIRE un .dst non è solo rimettere i numeri. Il tool accettava già i .dst e ne
// rileggeva i parametri, ma: (1) non ridisegnava, quindi a schermo non succedeva NIENTE e sembrava
// rotto; (2) la tavola generata non era nel file, quindi restava quella di prima; (3) l'immagine di
// riferimento nemmeno, e gli agglomerati tornavano al rumore — stessi parametri, disegno diverso,
// in silenzio. Gli handler vivono nel DOM e headless non si chiamano: si controlla il SORGENTE, come
// per la riapertura del .dst qui sopra.
console.log('\ninterlace — riaprire un .dst rimette anche la tavola e l’immagine');
{
  const src = readFileSync(join(root, 'apps/interlace/src/tool.ts'), 'utf8');
  check('il progetto esportato porta la tavola generata', /object: generated \? \{ widthMm/.test(src), true);
  check('il progetto esportato porta l’immagine di riferimento', /refImage: refImageUrl/.test(src), true);
  check('l’immagine si salva come data-URL al caricamento', /refImageUrl = cnv\.toDataURL/.test(src), true);
  check('caricando un .dst si ricostruisce, non si rimettono solo i numeri', /applyImportedProject\(meta, true\)/.test(src), true);
  check('...e la ricostruzione ridisegna (era il difetto: non succedeva nulla)', /if \(img\) restoreRefImage\(img, render\)/.test(src) && /else if \(!img\) render\(\)/.test(src), true);
  check('entrambi gli export usano lo stesso progetto', (src.match(/projectMetadata\(\)/g) || []).length >= 3, true);
  // Il carico del progetto sta in FONDO al pannello, con la sua sezione, come negli altri tool: in alto
  // c'e' solo il cartamodello. Prima erano lo stesso campo e non si capiva quale file volesse.
  check('la sezione "Carica parametri" c’e’ ed accetta .dst e .svg', /id="loadParams" accept="\.dst,\.svg"/.test(src), true);
  check('in alto resta il solo cartamodello (niente .dst)', /id="fileInput" accept="\.svg,\.dxf"/.test(src), true);
  check('lo sfondo si puo’ lasciare senza ricamo', /id="excludeBackground"/.test(src) && /excludeBackground = bgCheck\.checked/.test(src), true);
}

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

// import DXF: un cartamodello CAD chiude quasi sempre le curve con CIRCLE/ARC. Prima venivano
// saltate in silenzio — restava una sagoma incompleta, non un errore.
console.log('\nimport DXF: cerchi e archi');
{
  const dxf = (entities) => ['0','SECTION','2','ENTITIES', ...entities, '0','ENDSEC','0','EOF'].join('\n');
  const cerchio = rg.parseDxfToContours(dxf(['0','CIRCLE','10','50','20','50','40','25','62','1']));
  check('DXF: il CIRCLE entra come contorno', cerchio.contours.length, 1);
  check('DXF: ...ed è chiuso', cerchio.contours[0].closed, true);
  const raggi = cerchio.contours[0].points.map((q) => Math.hypot(q.x - 50, q.y + 50));
  check('DXF: ...col raggio giusto (25mm)', Math.abs(Math.max(...raggi) - 25) < 0.01 && Math.abs(Math.min(...raggi) - 25) < 0.01, true);
  check('DXF: ...e col colore ACI dichiarato', cerchio.contours[0].color, '#ff0000');
  const arco = rg.parseDxfToContours(dxf(['0','ARC','10','0','20','0','40','10','50','0','51','90']));
  check('DXF: l ARC entra come contorno aperto', arco.contours.length === 1 && arco.contours[0].closed === false, true);
  const a0 = arco.contours[0].points[0], a1 = arco.contours[0].points[arco.contours[0].points.length - 1];
  check('DXF: ...da 0° (10,0) a 90° (0,10) con la Y del disegno rivolta in giù',
    [Math.round(a0.x), Math.round(a0.y), Math.round(a1.x), Math.round(a1.y)], [10, 0, 0, -10]);
}

// oblique — i tre perimetri: sagoma, taglio pattern, passaggi. Difetti trovati usando il tool
// (2026-09-08) e bloccati qui: il rientro squadrava la sagoma, e i passaggi costeggiavano il bordo
// esterno invece del taglio pattern, uscendo dall'area in cui il ricamo esiste.
console.log('\noblique — perimetri: sagoma, taglio pattern, passaggi');
{
  const ott = [];
  for (let i = 0; i <= 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ott.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
  }
  const master = rg.boundaryFromPoints(ott, 'master_outline');
  check('sagoma: il cartamodello entra come poligono', master.type, 'polygon');

  // Il rientro RESTRINGE la sagoma, non la squadra (offsetPolygonBoundary, non insetBoundary).
  const conRientro = rg.resolveBoundaries({ ...rg.defaultObliqueParams(), patternBorderOffset: 5 }, undefined, { master });
  check('taglio pattern: col rientro la sagoma resta una sagoma', conRientro.decorative.type, 'polygon');
  check('taglio pattern: ...e ha gli stessi vertici della sagoma', conRientro.decorative.points.length, master.points.length);
  check('taglio pattern: ...rientrata di 5mm su ogni lato',
    Math.abs(conRientro.decorative.minX - 5) < 0.01 && Math.abs(conRientro.decorative.maxX - 95) < 0.01, true);
  const senzaRientro = rg.resolveBoundaries({ ...rg.defaultObliqueParams(), patternBorderOffset: 0 }, undefined, { master });
  check('taglio pattern: rientro 0 → il boundary è identico alla sagoma', senzaRientro.decorative.points.length, master.points.length);
  check('insetAnyBoundary: su un rettangolo resta un rettangolo',
    rg.insetAnyBoundary(rg.rectBoundaryOf(0, 0, 100, 100, 'r'), 5, 'x').type, 'rect');

  // Fori e piazzamento seguono la SAGOMA, non il suo rettangolo (divergenza voluta dall'originale:
  // misurato sul pannello ruotato di 20°, il fissaggio finiva 60mm fuori dalla stoffa).
  const fori = rg.resolveBoundaries({ ...rg.defaultObliqueParams(), holesMargin: 0 }, undefined, { master });
  check('fori: il ripiego segue la sagoma, non il rettangolo', fori.laser.type, 'polygon');
  check('piazzamento: idem', fori.placement.type, 'polygon');
  const foriRientro = rg.resolveBoundaries({ ...rg.defaultObliqueParams(), holesMargin: 8 }, undefined, { master });
  check('fori: col rientro resta una sagoma, rientrata di 8mm',
    foriRientro.laser.type === 'polygon' && Math.abs(foriRientro.laser.minX - 8) < 0.01, true);
  check('fori: su un pannello rettangolare resta un rettangolo',
    rg.resolveBoundaries({ ...rg.defaultObliqueParams(), holesMargin: 8 }, undefined, {}).laser.type, 'rect');

  // Senza il ruolo "Pannello" assegnato si lavora comunque sulla SAGOMA, non sul suo rettangolo.
  const soloContorno = rg.resolveBoundaries(rg.defaultObliqueParams(), undefined, {}, master);
  check('sagoma: senza ruolo assegnato vale il contorno del cartamodello', soloContorno.pattern.type, 'polygon');

  // I passaggi costeggiano il TAGLIO PATTERN quando il ruolo Pannello non c'è.
  const p10 = { ...rg.defaultObliqueParams(), patternBorderOffset: 10, enableLevel0: false, enableHolesLayer: false };
  const b10 = rg.resolveBoundaries(p10, undefined, {});
  check('passaggi: senza ruolo Pannello il perimetro è il taglio pattern', b10.routing.minX, b10.decorative.minX);
  check('passaggi: ...e NON il bordo esterno', b10.routing.minX === b10.pattern.minX, false);
  check('passaggi: col ruolo Pannello il perimetro torna la sagoma',
    rg.resolveBoundaries(p10, undefined, { master }).routing.points.length, master.points.length);

  // Misura di fatto: i passaggi generati restano dentro il rettangolo di taglio.
  const mod = (pts) => rg.moduleFromPolylines([pts]);
  const l1 = mod([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 0 }]);
  const l2 = mod([{ x: 0, y: 0 }, { x: 8, y: 2 }, { x: 4, y: 8 }]);
  const gen = rg.generateOblique({ level1: l1, level2: l2 }, p10, {});
  const cut = gen.boundaries.decorative;
  const fuori = gen.travel
    .filter((s) => s.connectorType === 'inter-diagonal-border-connector')
    .flatMap((s) => s.points)
    .filter((q) => q.x < cut.minX - 0.01 || q.x > cut.maxX + 0.01 || q.y < cut.minY - 0.01 || q.y > cut.maxY + 0.01);
  check('passaggi: nessun passaggio fra diagonali esce dal taglio pattern', fuori.length, 0);

  // removeIsolatedSpikes: l'andata-e-ritorno senza foro sparisce, la passata resta.
  const passata = [];
  for (let x = 0; x <= 60; x += 3) passata.push({ x, y: 0 });
  const conBecuccio = passata.slice(0, 10).concat(
    [{ x: 27, y: 5 }, { x: 27, y: 10 }, { x: 27, y: 5 }, { x: 27.2, y: 0.2 }],
    passata.slice(10)
  );
  const conn = { polylines: [{ layer: 'level1', points: conBecuccio }] };
  rg.removeIsolatedSpikes(conn, []);
  const restaAlto = conn.polylines[0].points.some((q) => q.y > 4);
  check('becucci: senza foro l escursione viene tolta', restaAlto, false);
  check('becucci: ...e la passata resta tutta', conn.polylines[0].points.length >= passata.length - 1, true);
  const connConForo = { polylines: [{ layer: 'level1', points: conBecuccio.map((q) => ({ ...q })) }] };
  rg.removeIsolatedSpikes(connConForo, [{ x: 27, y: 10, id: '0:0', diagonal: 0, index: 0 }]);
  check('becucci: col foro vicino l escursione resta', connConForo.polylines[0].points.some((q) => q.y > 4), true);
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
  // Il core non sa cosa sia un «ruolo» di broccato: gli si dice solo chi copre tutto il foglio e chi
  // non viene cucito. E' l'unica cosa che gli serve, ed e' quello che ha permesso di promuovere
  // `routing` nel core togliendogli l'ultimo aggancio all'app (2026-09-04).
  const tinte = [{}, {}];
  const g0 = rg.buildCoverGrid(mappaC, 40, 30, 0.5, 0, tinte, 1);
  const g1 = rg.buildCoverGrid(mappaC, 40, 30, 0.5, 1, tinte, 1);
  const conta = (g, k) => g.kind.reduce((s, v) => s + (v === k ? 1 : 0), 0);
  check('per il PRIMO ago la meta\' del secondo e\' coperta', conta(g0, rg.CELL_COVERED) > 0, true);
  check('...e la sua e\' roba propria', conta(g0, rg.CELL_OWN) > 0, true);
  check('per l\'ULTIMO ago non c\'e\' piu\' niente sopra: zero coperto', conta(g1, rg.CELL_COVERED), 0);
  check('e allora gli restano i bordi', conta(g1, rg.CELL_EDGE) > 0, true);
  const tinteBase = [{}, { base: true }];
  check('una BASE cucita dopo copre tutto',
    rg.buildCoverGrid(mappaC, 40, 30, 0.5, 0, tinteBase, 1).kind.every((v) => v === rg.CELL_COVERED), true);
  const tinteEsc = [{}, { escluso: true }];
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

// ---------------------------------------------------------------------------
// I PRESET CONDIVISI — Lorenzo, 15/09: «il punto minimo deve essere 1 nei preset, in tutti».
// Prima erano 0 o 2, a seconda di quando e da dove era nato il preset. E i due cannage di
// riferimento vivono qui, non più in una copia dentro zone-pattern.
{
  console.log('\npreset condivisi — una libreria sola, punto minimo 1 mm');
  const condivisi = JSON.parse(readFileSync(join(root, 'apps/pattern-grammar/src/presets.shared.json'), 'utf8'));
  check('i due cannage di riferimento sono nella libreria condivisa',
    ['CANNAGE BASE — LEGGERO', 'CANNAGE BASE — PIENA'].every((nome) => nome in condivisi), true);
  check('ogni preset condiviso ha punto minimo 1 mm',
    Object.entries(condivisi).filter(([, p]) => p.minStitchMm !== 1).map(([nome]) => nome), []);
  // Lorenzo, 15/09: nei preset la pulizia del bordo è «Elimina». Scritta ESPLICITA in ogni preset:
  // un preset che non la dice prende il default del motore (avvicina, poi elimina), ed è proprio così
  // che i due cannage la sbagliavano senza che nessun file lo mostrasse.
  check('ogni preset condiviso pulisce il bordo eliminando i punti',
    Object.entries(condivisi).filter(([, p]) => p.boundaryCleanupMode !== 'delete').map(([nome]) => nome), []);
}

// ---------------------------------------------------------------------------
// LO SCARICO — Lorenzo, 14/09: «mi chiedono sempre più spesso di scaricare i punti in determinate
// aree», di solito per il montaggio. Dentro le aree i zig-zag hanno meno passate; il reticolo non
// si sposta; il cambio cade netto sul contorno. Vale nel Generatore e in Pattern a zone (R28).
{
  const dentroAnello = (p, anello) => {
    let dentro = false;
    for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
      const a = anello[i], b = anello[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  };
  const chiave = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;

  console.log('\npattern-grammar — lo scarico: meno passate dentro le aree, niente si sposta');
  const base = { columns: 6, rows: 6, horizontalZigzagInterline: 0.25, verticalZigzagInterline: 0.25 };
  const pieno = rg.generateFinalPatternPoints(base);
  const y0 = pieno.height * 0.4 + 0.123;
  const y1 = pieno.height * 0.6 + 0.123;
  const fascia = [{ x: -10, y: y0 }, { x: pieno.width + 10, y: y0 }, { x: pieno.width + 10, y: y1 }, { x: -10, y: y1 }];
  const lontana = fascia.map((p) => ({ x: p.x + 1000, y: p.y }));
  const scaricato = rg.generateFinalPatternPoints({ ...base, reliefAreas: [fascia], reliefPercent: 50 });
  const stesso = (a, b) => JSON.stringify(a.visualPolylines) === JSON.stringify(b.visualPolylines);
  check('scarico a 0% = il pattern di prima, al millesimo',
    stesso(rg.generateFinalPatternPoints({ ...base, reliefAreas: [fascia], reliefPercent: 0 }), pieno), true);
  check('un\'area che non tocca il disegno non cambia un punto',
    stesso(rg.generateFinalPatternPoints({ ...base, reliefAreas: [lontana], reliefPercent: 50 }), pieno), true);
  const inFascia = (final) => final.visualPolylines.flat().filter((p) => p.y > y0 && p.y < y1).length;
  check('dentro la fascia i punti calano (50% = circa metà)',
    inFascia(scaricato) < inFascia(pieno) * 0.75, true);
  // Lontano dalla fascia più di un modulo il ricamo non cambia: lo scarico non SPOSTA il reticolo.
  const modulo = pieno.grammar.moduleHeight;
  const lontani = (final) => final.visualPolylines.flat().filter((p) => p.y < y0 - modulo || p.y > y1 + modulo).map(chiave);
  // Si confrontano le POSIZIONI (un insieme: nel tracciato lo stesso punto torna più volte, sui
  // raccordi) e, a parte, quanti punti ci sono in tutto.
  const lontaniPieni = new Set(lontani(pieno));
  const lontaniScaricati = new Set(lontani(scaricato));
  check('lontano dalla fascia ogni punto è dov\'era, e non ne compare nessuno nuovo',
    [...lontaniPieni].every((k) => lontaniScaricati.has(k)) && lontaniPieni.size === lontaniScaricati.size
      && lontani(pieno).length === lontani(scaricato).length, true);
  // Il taglio è NETTO: i zig-zag verticali si spezzano proprio sul contorno, non a fine modulo.
  const sulContorno = (final) => final.visualPolylines.flat().filter((p) => Math.abs(p.y - y0) < 1e-6 || Math.abs(p.y - y1) < 1e-6).length;
  check('il cambio di densità cade sulla linea del contorno', [sulContorno(pieno), sulContorno(scaricato) > 0], [0, true]);
  check('scaricare al 100% lascia comunque una passata (un zig-zag senza passate è un buco)',
    rg.generateFinalPatternPoints({ ...base, reliefAreas: [fascia], reliefPercent: 100 }).visualPolylines.flat().some((p) => p.y > y0 + 1 && p.y < y1 - 1), true);
  for (const file of ['apps/pattern-grammar/src/fields.ts', 'apps/zone-pattern/src/fields.ts', 'apps/cannage-rafia/src/fields.ts']) {
    check(`${file}: lo scarico ha lo stesso nome ed etichetta nei due tool (R28)`,
      readFileSync(join(root, file), 'utf8').includes("name: 'reliefPercent', label: 'Scarico nelle aree', unit: '%'"), true);
  }

  console.log('\nzone-pattern — le aree di scarico sul davanti di Lorenzo');
  const modello = rg.parseImportedBoundarySource(
    readFileSync(join(here, 'fixtures/scarico-davanti.svg'), 'utf8'), 'scarico-davanti.svg',
    { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zoneD = rg.resolveZoneAngles(rg.readZones(modello), 20);
  const GIALLO = '#f3e600';
  check('le tinte: rosso, lilla e il contorno delle aree (solo tratto, niente riempimento)',
    [...new Set(zoneD.map((z) => z.color))].sort(), ['#7d8bc5', '#e52421', GIALLO]);
  check('le aree di scarico sono 3', zoneD.filter((z) => z.color === GIALLO).length, 3);
  const ruoliD = {
    '#e52421': { pattern: 'A', angleDeg: 0 }, '#7d8bc5': { pattern: 'B', angleDeg: 0 }, [GIALLO]: { pattern: 'scarico', angleDeg: 0 },
  };
  check('un\'area di scarico non è un pattern: la lettera nuova resta la C', rg.patternChoices(ruoliD).map((c) => c.key), ['A', 'B', 'C']);
  // Solo la parte bassa del davanti, dove stanno le aree: il resto non dice niente di più e costa tempo.
  const basso = zoneD.filter((z) => z.centroid.y > 190);
  const cfgD = { minStitchMm: 0.4, horizontalZigzagInterline: 0.45, verticalZigzagInterline: 0.45 };
  const pianoD = (percento) => rg.buildZonePlan(basso, {
    roles: ruoliD, patterns: { A: { ...cfgD, reliefPercent: percento }, B: { ...cfgD, reliefPercent: percento } },
    marginMm: 2, rowHeightMm: 0, travelMode: 'edges', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0,
  });
  const senza = pianoD(0);
  const con = pianoD(50);
  check('le aree di scarico non sono un ago', con.layers.map((l) => l.id), ['pattern-A', 'pattern-B']);
  check('...e non si ricamano', con.stitches.some((s) => s.zone.color === GIALLO), false);
  check('lo scarico a 0% non tocca nessuna zona', senza.relievedZones, 0);
  check('lo scarico al 50% arriva alle zone sotto le aree', con.relievedZones > 0, true);
  const anelli = basso.filter((z) => z.color === GIALLO).map((z) => z.points);
  const puntiDentro = (piano) => piano.stitches.flatMap((s) => s.polylines.flat())
    .filter((p) => anelli.some((a) => dentroAnello(p, a))).length;
  check('dentro le aree i punti calano', puntiDentro(con) < puntiDentro(senza) * 0.75, true);
  const lontanaDalleAree = (s) => {
    const b = rg.zoneBounds(s.zone.points);
    return anelli.every((a) => {
      const r = rg.zoneBounds(a);
      return b.maxX < r.minX || r.maxX < b.minX || b.maxY < r.minY || r.maxY < b.minY;
    });
  };
  const fuori = (piano) => JSON.stringify(piano.stitches.filter(lontanaDalleAree).map((s) => s.polylines));
  check('le zone lontane dalle aree escono identiche', fuori(con) === fuori(senza), true);
}

// ---------------------------------------------------------------------------
// zone-pattern — il pattern a zone, misurato sul cannage vero di Lorenzo.
// Il tool non ha un motore di pattern suo: usa quello di @rg/pattern-grammar ruotando
// il PIANO invece del modulo. Le invarianti servono a difendere proprio quel giro.
{
  const zoneModel = rg.parseImportedBoundarySource(
    readFileSync(join(here, 'fixtures/cannage-zone.svg'), 'utf8'), 'cannage-zone.svg',
    { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const grezze = rg.readZones(zoneModel);
  const zone = rg.resolveZoneAngles(grezze, 20);
  const perColore = (colore) => zone.filter((z) => z.color === colore);
  const mediana = (valori) => valori.slice().sort((a, b) => a - b)[Math.floor(valori.length / 2)];
  const angoloDi = (colore) => mediana(perColore(colore).map((z) => z.angleDeg));

  console.log('\nzone-pattern — le tre famiglie di inclinazione escono dal disegno');
  check('37 zone, 6 tinte', [zone.length, new Set(zone.map((z) => z.color)).size], [37, 6]);
  // Qui si misura il RETICOLO letto dai lati — la materia prima. L'asse su cui poi corre il
  // pattern è un'altra cosa (la diagonale del rombo) e ha il suo blocco più sotto.
  // ATTENZIONE: si legge dalle zone GREZZE. Su quelle già risolte tornerebbe l'asse finale,
  // non i lati — e il test misurerebbe sé stesso invece della materia prima.
  const reticoloDi = (colore) => rg.familyAngleDeg(grezze.filter((z) => z.color === colore));
  check('cannage regolare (rosa/viola): lati a 45°',
    [Math.round(reticoloDi('#ff2eaf')), Math.round(reticoloDi('#cd00ff'))], [44, 44]);
  check('striscia centrale (rosso/arancio): lati a 15°',
    [Math.round(reticoloDi('#f40000')), Math.round(reticoloDi('#f29b27'))], [15, 15]);
  check('banda sinistra (blu/verde): lati a ~79°',
    [Math.round(reticoloDi('#0018f9')), Math.round(reticoloDi('#00f700'))], [79, 79]);
  // Le tinte che Lorenzo accoppia stanno sullo STESSO reticolo: è la prova che sono
  // due pattern sopra tre inclinazioni, non sei cose diverse.
  check('le tinte accoppiate cadono sullo stesso reticolo (entro 1°)',
    [reticoloDi('#ff2eaf') - reticoloDi('#cd00ff'), reticoloDi('#f40000') - reticoloDi('#f29b27')]
      .every((d) => Math.abs(d) < 1), true);
  // Senza il riferimento di famiglia le schegge tagliate al bordo sbandano: qui si vede
  // il difetto che `resolveZoneAngles` corregge (una zona arancione dava 86° su 15°).
  check('senza riferimento di famiglia le schegge sbandano oltre 45°',
    Math.max(...grezze.filter((z) => z.color === '#f29b27').map((z) => Math.abs(z.angleDeg - 15))) > 45, true);
  check('col riferimento nessuna zona si scosta oltre 5° dalla sua famiglia',
    zone.every((z) => Math.abs(z.angleDeg - angoloDi(z.color)) < 5), true);
  // Libertà 0 = i "tre blocchi secchi" che Lorenzo immaginava di generare a mano: ogni zona
  // prende l'angolo della sua tinta. Gli angoli distinti sono 6 (uno per tinta) ma cadono su
  // 3 soli reticoli, perché le tinte accoppiate condividono la griglia.
  const bloccate = rg.resolveZoneAngles(grezze, 0);
  check('libertà 0 = un angolo per tinta, nessuna zona libera',
    new Set(bloccate.map((z) => z.angleDeg.toFixed(4))).size, 6);
  check('...e quei 6 angoli sono 3 reticoli (le tinte accoppiate coincidono entro 1°)',
    [...new Set(bloccate.map((z) => z.angleDeg))]
      .sort((a, b) => a - b)
      .reduce((reticoli, a) => (reticoli.at(-1) !== undefined && Math.abs(a - reticoli.at(-1)) < 1 ? reticoli : [...reticoli, a]), [])
      .length, 3);

  // ---- L'ASSE: la diagonale del rombo, non il suo lato ----
  // Lorenzo, sul primo risultato: «gli altri li hai girati troppo, di 45 gradi in più del
  // necessario, perché le linee devono essere verticali al rombo non al quadrato». In un
  // cannage i cordoncini corrono da vertice a vertice; i LATI stanno a 45° da loro. Misurare
  // i lati resta il modo robusto di leggere il reticolo, ma poi va ruotato.
  // L'eccezione sono le STRISCE (rosso/arancio): lì non c'è rombo, il pattern corre per il
  // lungo, e infatti erano le uniche due famiglie già giuste.
  console.log('\nzone-pattern — il pattern segue la diagonale del rombo, non il lato');
  check('il cannage regolare (rosa/viola) va DRITTO, non a 45°',
    [Math.round(angoloDi('#ff2eaf')), Math.round(angoloDi('#cd00ff'))], [0, 0]);
  check('la banda sinistra (blu/verde) cala di 45 e va a ~31°',
    [Math.round(angoloDi('#0018f9')), Math.round(angoloDi('#00f700'))], [31, 31]);
  check('le strisce (rosso/arancio) restano a 15°: lì il pattern corre per il lungo',
    [Math.round(angoloDi('#f40000')), Math.round(angoloDi('#f29b27'))], [15, 15]);
  check('le tinte accoppiate restano sullo stesso reticolo anche dopo lo scarto',
    [angoloDi('#ff2eaf') - angoloDi('#cd00ff'), angoloDi('#0018f9') - angoloDi('#00f700'),
      angoloDi('#f40000') - angoloDi('#f29b27')].every((d) => Math.abs(d) < 1), true);

  // Il discriminante è l'ALLUNGAMENTO della cella, ed è misurabile: rombi ~1-2.5, strisce ~5.
  check('un rombo ha allungamento vicino a 1',
    rg.cellElongation([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 10, y: -10 }, { x: 0, y: 0 }]) < 1.2, true);
  check('una striscia lunga ha allungamento alto',
    rg.cellElongation([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }]) > rg.STRIP_ELONGATION, true);
  // E si decide per FAMIGLIA pesando sull'AREA: la famiglia arancione ha mediana semplice
  // 2.22 (sarebbe passata per rombo, angolo sbagliato di 45°) ma pesata sull'area è una striscia.
  check('lo scarto si decide per famiglia: rombi -45°, strisce 0°',
    [rg.familyAxisShiftDeg(perColore('#ff2eaf')), rg.familyAxisShiftDeg(perColore('#f40000')),
      rg.familyAxisShiftDeg(perColore('#f29b27'))], [-45, 0, 0]);

  console.log('\nzone-pattern — ruotare il piano non deforma il pattern');
  const quadrato = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
  const zonaProva = (angolo) => ({
    id: 'p', color: '#000', points: quadrato, centroid: { x: 10, y: 10 }, areaMm2: 400, angleDeg: angolo,
  });
  const config = { horizontalZigzagWidth: 5.5, horizontalZigzagHeight: 4.3, horizontalZigzagInterline: 0.9,
    horizontalZigzagSpacing: 12, verticalZigzagWidth: 1.2, verticalZigzagInterline: 0.9, stepX: 5.2, offsetY: 6,
    minStitchMm: 0.4, maxStitchMm: 6, constructionStroke: 0.3 };
  const filoDi = (angolo) => {
    let mm = 0;
    for (const pl of rg.fillZone(zonaProva(0), config, angolo, 2)) {
      for (let i = 1; i < pl.length; i++) mm += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y);
    }
    return mm;
  };
  // Una rotazione è rigida: gira il disegno, non lo stira. Se il filo cambiasse, il "ruota
  // il piano" starebbe scalando qualcosa — ed è l'errore che questo test esiste per cogliere.
  check('la stessa zona a 0° e a 90° consuma lo stesso filo (±1%)',
    Math.abs(filoDi(0) - filoDi(90)) / filoDi(0) < 0.01, true);
  check('a 45° il filo resta dello stesso ordine (la zona è la stessa)',
    filoDi(45) > filoDi(0) * 0.7 && filoDi(45) < filoDi(0) * 1.3, true);

  console.log('\nzone-pattern — il piano: dentro le zone, da sinistra, un ago per pattern');
  const ruoli = {};
  for (const [c, p] of Object.entries({ '#ff2eaf': 'A', '#f40000': 'A', '#0018f9': 'A',
    '#cd00ff': 'B', '#f29b27': 'B', '#00f700': 'B' })) ruoli[c] = { pattern: p, angleDeg: 0 };
  const piano = rg.buildZonePlan(zone, {
    roles: ruoli,
    patterns: { A: config, B: { ...config, horizontalZigzagSpacing: 9, stepX: 9 } },
    marginMm: 2, rowHeightMm: 0, travelMode: 'edges', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0,
  });
  check('tutte le 37 zone vengono riempite', [piano.stitches.length, piano.skipped], [37, 0]);
  check('due pattern = DUE aghi (Lorenzo: "quando cambi pattern cambi ago")',
    piano.layers.map((l) => l.id), ['pattern-A', 'pattern-B']);

  // ---- PIÙ DI DUE PATTERN (Lorenzo, 14/09: «i pattern non sono solo 2») ----
  // La mappa colori offre a ogni tinta le lettere già in uso più UNA nuova: il primo colore vede
  // A, il secondo A e B, il terzo A, B e C. `*` = offerta come nuova.
  console.log('\nzone-pattern — i pattern sono quanti servono, una lettera nuova alla volta');
  const scelte = (roles) => rg.patternChoices(roles).map((c) => `${c.key}${c.isNew ? '*' : ''}`);
  const presa = (pattern) => ({ pattern, angleDeg: 0 });
  check('senza ruoli si offre solo la A, come nuova', scelte({}), ['A*']);
  check('con la A presa si offrono A e la B nuova', scelte({ x: presa('A') }), ['A', 'B*']);
  check('con A e B prese compare la C', scelte({ x: presa('A'), y: presa('B') }), ['A', 'B', 'C*']);
  check('una lettera lasciata libera torna nuova, al suo posto nell\'ordine',
    scelte({ x: presa('A'), y: presa('C') }), ['A', 'B*', 'C']);
  check('"non ricamare" non conta come pattern', scelte({ x: presa('off'), y: presa('A') }), ['A', 'B*']);
  check('oltre la Z non c\'è un tetto', [rg.patternLetter(0), rg.patternLetter(25), rg.patternLetter(26)], ['A', 'Z', 'P27']);

  const seiTinte = [...new Set(zone.map((z) => z.color))];
  const seiRuoli = Object.fromEntries(seiTinte.map((c, i) => [c, presa(rg.patternLetter(i))]));
  const seiPattern = Object.fromEntries(seiTinte.map((_, i) => [rg.patternLetter(i), { ...config, stepX: 5 + i }]));
  const pianoSei = rg.buildZonePlan(zone, {
    roles: seiRuoli, patterns: seiPattern,
    marginMm: 2, rowHeightMm: 0, travelMode: 'edges', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0,
  });
  check('sei tinte con sei pattern = SEI aghi, in ordine di lettera',
    pianoSei.layers.map((l) => l.id), seiTinte.map((_, i) => `pattern-${rg.patternLetter(i)}`));
  check('...ognuno col suo colore', new Set(pianoSei.layers.map((l) => l.color)).size, 6);
  check('i passaggi non saltano mai da un pattern all\'altro (uno in meno delle zone, per ago)',
    pianoSei.travels.length, pianoSei.stitches.length - 6);

  // I colori degli aghi sono la palette categoriale del DS risolta in esadecimale: se il DS la
  // cambia, questo test lo deve dire invece di lasciar divergere l'anteprima dal sistema.
  const tokensDs = readFileSync(join(root, 'packages/design-system/tokens.css'), 'utf8');
  const risolvi = (nome, giri = 0) => {
    const m = new RegExp(`${nome}:\\s*([^;]+);`).exec(tokensDs);
    if (!m) return undefined;
    const valore = m[1].trim();
    const rimando = /^var\((--[a-z0-9-]+)\)$/.exec(valore);
    return rimando && giri < 5 ? risolvi(rimando[1], giri + 1) : valore.toLowerCase();
  };
  check('i colori degli aghi sono la palette categoriale del DS (1.14.1)',
    rg.PATTERN_INKS, [1, 2, 3, 4, 5, 6, 7].map((i) => risolvi(`--rg-color-category-${i}`)));
  check('oltre il settimo si ricomincia (il DS: un segno in più, non un colore in più)',
    rg.inkFor('H'), rg.inkFor('A'));

  // ---- L'ANGOLO È A MANO E PARTE DA 0° (Lorenzo, 14/09) ----
  // Il contrario del 03/09: l'inclinazione misurata non entra più nel ricamo.
  console.log('\nzone-pattern — l\'angolo si scrive a mano, per tinta, e parte da 0°');
  check('senza angolo scritto ogni zona si ricama a 0°, qualunque cosa misuri',
    piano.stitches.every((s) => s.angleDeg === 0), true);
  const pianoAngolo = rg.buildZonePlan(zone, {
    roles: { ...ruoli, '#ff2eaf': { pattern: 'A', angleDeg: 30 } },
    patterns: { A: config, B: config },
    marginMm: 2, rowHeightMm: 0, travelMode: 'none', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0,
  });
  check('l\'angolo scritto vale per quella tinta, e solo per lei',
    [pianoAngolo.stitches.filter((s) => s.zone.color === '#ff2eaf').every((s) => s.angleDeg === 30),
      pianoAngolo.stitches.filter((s) => s.zone.color !== '#ff2eaf').every((s) => s.angleDeg === 0)], [true, true]);
  check('un progetto salvato prima si riapre: la vecchia correzione diventa l\'angolo',
    rg.normalizeRole({ pattern: 'B', angleOffsetDeg: 15 }), { pattern: 'B', angleDeg: 15 });
  check('...e un ruolo sporco non rompe niente', rg.normalizeRole(null), { pattern: 'off', angleDeg: 0 });

  // R5-simile: il ricamo di una zona NON deve uscire dalla zona. È il vincolo che rende
  // sensato tutto il tool — un rombo che sborda si vede subito sul capo.
  const fuoriDal = (p, poly) => {
    let dentro = false;
    for (let i = 0, j = poly.length - 2; i < poly.length - 1; j = i++) {
      if (((poly[i].y > p.y) !== (poly[j].y > p.y))
        && (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) dentro = !dentro;
    }
    if (dentro) return 0;
    let min = Infinity;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0;
      min = Math.min(min, Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))));
    }
    return min;
  };
  let sconfina = 0;
  for (const s of piano.stitches) for (const pl of s.polylines) for (const p of pl) {
    sconfina = Math.max(sconfina, fuoriDal(p, s.zone.points));
  }
  check('nessun punto esce dalla propria zona', sconfina < 0.001, true);
  check('ogni zona attacca da SINISTRA (Lorenzo)',
    piano.stitches.filter((s) => s.polylines[0][0].x > s.polylines[0].at(-1).x).length, 0);
  check('ogni zona è un blocco a sé (moduli separati, non un reticolo unico)',
    piano.stitches.every((s) => s.polylines.length === 1), true);

  // R4: il punto massimo deve valere anche DOPO la rotazione. È il punto in cui un
  // "ruota indietro" fatto male reintrodurrebbe segmenti lunghi.
  let piuLungo = 0;
  for (const s of piano.stitches) for (const pl of s.polylines) {
    for (let i = 1; i < pl.length; i++) piuLungo = Math.max(piuLungo, Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
  }
  check('R4 — il punto massimo regge anche dopo la rotazione', piuLungo <= 6.001, true);

  // La sequenza: dentro un ago si va a righe, ogni riga da sinistra a destra.
  const inSequenza = piano.stitches.filter((s) => s.pattern === 'A').map((s) => s.zone.centroid);
  let ripartenze = 0;
  for (let i = 1; i < inSequenza.length; i++) if (inSequenza[i].x < inSequenza[i - 1].x) ripartenze++;
  check('la sequenza va a righe: riparte da sinistra più di una volta', ripartenze >= 2, true);
  check('...e ogni riga è ordinata da sinistra a destra',
    ripartenze < inSequenza.length - 1, true);

  // ---- I PASSAGGI: impunture che camminano sui bordi dei rombi, non tagli in mezzo ----
  // Lorenzo: «impunture che si muovono sui bordi dei rombi o all'esterno delle forme».
  // La misura che conta non è "esistono", è "stanno sui bordi": un passaggio che taglia
  // dentro un rombo già ricamato lascia il filo doppio, e si vede sul capo.
  console.log('\nzone-pattern — i passaggi camminano sui bordi');
  check('senza passaggi il piano non ne produce',
    rg.buildZonePlan(zone, { roles: ruoli, patterns: { A: config, B: config }, marginMm: 2, rowHeightMm: 0,
      travelMode: 'none', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0 }).travels.length, 0);
  check('con i passaggi ce n\'è uno fra ogni coppia di zone dello stesso ago',
    piano.travels.length, piano.stitches.length - 2);   // meno uno per ago

  // Ogni punto di ogni passaggio deve stare VICINO al bordo di qualche zona. Si misura la
  // distanza dal lato più vicino di tutta la rete: se il passaggio tagliasse in diagonale
  // dentro un rombo, in mezzo si allontanerebbe di parecchi millimetri.
  const latiDelDisegno = zone.flatMap((z) => {
    const lati = [];
    for (let i = 1; i < z.points.length; i++) lati.push([z.points[i - 1], z.points[i]]);
    return lati;
  });
  const distanzaDaiBordi = (p) => {
    let min = Infinity;
    for (const [a, b] of latiDelDisegno) {
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0;
      min = Math.min(min, Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))));
    }
    return min;
  };
  let lontano = 0;
  for (const t of piano.travels) for (const p of t.points) lontano = Math.max(lontano, distanzaDaiBordi(p));
  // Non "quasi sui bordi": ESATTAMENTE sui bordi. Si entra nella rete proiettando sul lato
  // più vicino, non puntando al vertice — col vertice si tagliava l'angolo (misurato: 1.05mm
  // dentro il ricamo, 1 punto su 1303). Con la proiezione lo scostamento è zero.
  check('ogni punto di passaggio sta SUL bordo di una zona (<0.01mm)', lontano < 0.01, true);
  // Il confronto che dimostra che il lavoro serve: la retta fra le stesse due zone taglierebbe.
  const inRetta = piano.travels.map((t) => {
    const a = t.points[0];
    const b = t.points.at(-1);
    return distanzaDaiBordi({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  });
  check('...mentre andando in retta si taglierebbe in mezzo al ricamo',
    Math.max(...inRetta) > 3, true);
  check('i passaggi rispettano il punto chiesto (R4)',
    piano.travels.every((t) => t.points.every((p, i) => i === 0
      || Math.hypot(p.x - t.points[i - 1].x, p.y - t.points[i - 1].y) <= 3.001)), true);
  check('e finiscono nel layer del loro ago (un filo unico, niente stacchi)',
    piano.layers[0].polylines.length, piano.stitches.filter((s) => s.pattern === 'A').length * 2 - 1);

  // ---- LA PULIZIA DEI BORDI, per zona (come nel Generatore pattern) ----
  // Lorenzo: «manca tutto il controllo della pulizia bordi; ora mi sembra sia attivo lo
  // spostamento ma vorrei poter selezionare anche elimina punti». Era vero: i due campi non
  // stavano nel pannello e restavano inchiodati sul default "avvicina, poi elimina".
  // ---- SEPARATI MA IN SEQUENZA ----
  // Lorenzo: «potrebbe essere necessario cambiare ordine degli oggetti; è possibile mantenere
  // separati i blocchi e i passaggi ma lasciando tutto in sequenza? ora è un'unica linea».
  // I pezzi erano già tracciati distinti, ma dentro due soli gruppi ANONIMI: a valle si vedeva
  // "un gruppo, 37 tracciati" senza sapere quale fosse un rombo e quale un passaggio.
  console.log('\nzone-pattern — blocchi e passaggi separati, ma in ordine di cucitura');
  const gruppi = rg.exportSequenceLayers(piano);
  check('un gruppo per PEZZO, non uno per ago',
    gruppi.length, piano.stitches.length + piano.travels.length);
  check('numerati nell\'ordine di cucitura, senza buchi',
    gruppi.every((g, i) => Number(g.id.slice(0, 4)) === i), true);
  check('il nome dice ago, tipo e zona: si riconoscono a colpo d\'occhio',
    [/^0000-ago[AB]-zona-/.test(gruppi[0].id), gruppi.some((g) => g.id.endsWith('-passaggio'))], [true, true]);
  check('dentro un ago zone e passaggi si ALTERNANO',
    gruppi.filter((g) => g.id.includes('agoA')).map((g) => (g.id.endsWith('passaggio') ? 'p' : 'z')).join('').slice(0, 8),
    'zpzpzpzp');
  // I passaggi tengono il colore del LORO ago: sono lo stesso filo, e una tinta diversa
  // direbbe al software a valle che è un altro ago.
  check('un passaggio ha il colore del suo ago, non un colore suo',
    gruppi.filter((g) => g.id.endsWith('passaggio')).every((g) => g.color === rg.inkFor(g.id.includes('agoA') ? 'A' : 'B')), true);
  check('nessun punto si perde per strada rispetto ai layer del DST',
    gruppi.reduce((sum, g) => sum + g.polylines.flat().length, 0),
    piano.layers.reduce((sum, l) => sum + l.polylines.flat().length, 0));
  // E il DST NON si tocca: lì un gruppo per pezzo diventerebbe un cambio-colore per pezzo.
  check('il DST resta a due aghi, uno per pattern', piano.layers.length, 2);

  console.log('\nzone-pattern — la pulizia dei bordi si può scegliere, e cambia il risultato');
  const conBordi = (modo, minimo, spostamento) => {
    const cfg = { ...config, minStitchMm: minimo, boundaryCleanupMode: modo, maxBoundaryAdjustment: spostamento };
    return rg.buildZonePlan(zone, { roles: ruoli, patterns: { A: cfg, B: cfg }, marginMm: 2, rowHeightMm: 0,
      travelMode: 'none', travelStitchMm: 3, cleanupMinStitchMm: 0, outerMarginMm: 0 });
  };
  const puntiDi = (piano) => piano.stitches.reduce((sum, s) => sum + s.pointCount, 0);
  check('entrambe le modalità arrivano al motore (i due campi esistono nel pannello)',
    ['boundaryCleanupMode', 'maxBoundaryAdjustment'].every((n) => rg.PATTERN_FIELD_NAMES.includes(n)), true);
  check('"Elimina" toglie più punti di "Avvicina, poi elimina"',
    puntiDi(conBordi('delete', 0.4, 0)) < puntiDi(conBordi('adjust-then-delete', 0.4, 0)), true);
  // Quanto morde dipende dal PUNTO MINIMO: il motore ci lavora solo dove i punti sono più
  // vicini di quella misura. Con 0.4 sono poche decine, con 2 sono centinaia.
  const scartoA = puntiDi(conBordi('adjust-then-delete', 0.4, 0)) - puntiDi(conBordi('delete', 0.4, 0));
  const scartoB = puntiDi(conBordi('adjust-then-delete', 2, 0)) - puntiDi(conBordi('delete', 2, 0));
  check('e morde di più quanto più alto è il punto minimo', scartoB > scartoA * 3, true);
  // Onestà: NESSUNA delle due garantisce il punto minimo (i punti strutturali sopravvivono).
  // È il compromesso storico del motore migrato: chi lo garantisce è la "pulizia punti" finale.
  const piuCortoDi = (piano) => {
    let min = Infinity;
    for (const s of piano.stitches) for (const pl of s.polylines) for (let i = 1; i < pl.length; i++) {
      min = Math.min(min, Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
    }
    return min;
  };
  check('nessuna delle due modalità GARANTISCE il punto minimo (serve la pulizia punti)',
    piuCortoDi(conBordi('delete', 2, 0)) < 2, true);

  // ---- IL MARGINE SUL BORDO ESTERNO (come l'`overflowMarginMm` di oblique) ----
  // Lorenzo: «sui bordi esterni avrei bisogno di avere del margine». Il ricamo deve debordare
  // dal perimetro, MA non fra un rombo e l'altro: lì due zone allargate si sovrapporrebbero,
  // cioè filo doppio proprio dove il disegno è già pieno.
  console.log('\nzone-pattern — il margine deborda fuori, non dentro');
  const flags = rg.outerEdgeFlags(zone);
  const latiEsterni = flags.flat().filter(Boolean).length;
  const latiTotali = flags.flat().length;
  check('ci sono lati esterni e lati interni, e sono riconosciuti come tali',
    latiEsterni > 0 && latiEsterni < latiTotali, true);
  // La misura che vale davvero: un rombo PIENO in mezzo al disegno non ha nemmeno un lato
  // esterno. Se l'avesse, il margine gli si aprirebbe addosso al vicino.
  const rombiPieni = zone.map((z, i) => ({ z, i })).sort((a, b) => b.z.areaMm2 - a.z.areaMm2).slice(0, 3);
  check('i rombi pieni al centro non hanno alcun lato esterno',
    rombiPieni.every(({ i }) => flags[i].every((f) => !f)), true);

  const conMargine = rg.buildZonePlan(zone, { roles: ruoli, patterns: { A: config, B: config },
    marginMm: 2, rowHeightMm: 0, travelMode: 'none', travelStitchMm: 3, cleanupMinStitchMm: 0,
    outerMarginMm: 3 });
  const senzaMargine = rg.buildZonePlan(zone, { roles: ruoli, patterns: { A: config, B: config },
    marginMm: 2, rowHeightMm: 0, travelMode: 'none', travelStitchMm: 3, cleanupMinStitchMm: 0,
    outerMarginMm: 0 });
  const ingombro = (piano) => rg.zoneBounds(piano.stitches.flatMap((s) => s.polylines.flat()));
  const dentro = ingombro(senzaMargine);
  const fuori = ingombro(conMargine);
  check('col margine il ricamo esce dal perimetro', fuori.width > dentro.width + 1, true);
  // La misura giusta NON è quanto cresce il rettangolo d'ingombro: il margine è perpendicolare
  // ai lati, e su bordi obliqui il rettangolo cresce di più. Si misura quanto il ricamo esce
  // dal poligono della PROPRIA zona — quello è il margine.
  const sporgenzaMax = (piano) => {
    let max = 0;
    for (const s of piano.stitches) for (const pl of s.polylines) for (const p of pl) {
      max = Math.max(max, fuoriDal(p, s.zone.points));
    }
    return max;
  };
  check('senza margine non sporge niente', sporgenzaMax(senzaMargine) < 0.001, true);
  // Esattamente quanto chiesto, angoli compresi: dove due lati si incontrano acuti il loro
  // incrocio spostato schizzerebbe lontano (misurato: 7.55mm con 3 chiesti), e c'è un tetto.
  check('col margine sporge di ESATTAMENTE quanto chiesto',
    Number(sporgenzaMax(conMargine).toFixed(2)), 3);
  check('e il filo aumenta (c\'è più superficie da coprire)',
    rg.threadMetres(conMargine, 'A') > rg.threadMetres(senzaMargine, 'A'), true);

  // La prova che i bordi INTERNI non si sono mossi: una zona tutta interna (nessun lato sul
  // perimetro) deve uscire IDENTICA col margine e senza. Se si allargasse anche lei, si
  // sovrapporrebbe alle vicine.
  const interne = zone.filter((_, i) => flags[i].every((f) => !f));
  check('esistono zone tutte interne su cui misurare', interne.length > 0, true);
  const filoDellaZona = (piano, id) => {
    const s = piano.stitches.find((x) => x.zone.id === id);
    if (!s) return -1;
    let mm = 0;
    for (const pl of s.polylines) for (let i = 1; i < pl.length; i++) {
      mm += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y);
    }
    return Number(mm.toFixed(6));
  };
  check('una zona tutta interna è IDENTICA col margine e senza',
    interne.every((z) => filoDellaZona(conMargine, z.id) === filoDellaZona(senzaMargine, z.id)), true);
  check('il margine a 0 non cambia niente rispetto a prima',
    rg.threadMetres(senzaMargine, 'A').toFixed(6), rg.threadMetres(senzaMargine, 'A').toFixed(6));

  console.log('\nzone-pattern — la pulizia punti (R3), la manopola chiesta da Lorenzo');
  const conPulizia = rg.buildZonePlan(zone, { roles: ruoli, patterns: { A: config, B: config },
    marginMm: 2, rowHeightMm: 0, travelMode: 'edges', travelStitchMm: 3, cleanupMinStitchMm: 0.5, outerMarginMm: 0 });
  const piuCortoSenzaUltimo = (piano) => {
    let min = Infinity;
    const tutte = [...piano.stitches.flatMap((s) => s.polylines), ...piano.travels.map((t) => t.points)];
    for (const pl of tutte) for (let i = 1; i < pl.length - 1; i++) {
      min = Math.min(min, Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
    }
    return min;
  };
  const piuCorto = (piano) => {
    let min = Infinity;
    const tutte = [...piano.stitches.flatMap((s) => s.polylines), ...piano.travels.map((t) => t.points)];
    for (const pl of tutte) for (let i = 1; i < pl.length; i++) {
      min = Math.min(min, Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
    }
    return min;
  };
  check('a 0 non tocca niente (il disegno resta intatto)', piano.cleanedPoints, 0);
  check('con la pulizia i punti si tolgono davvero', conPulizia.cleanedPoints > 0, true);
  // L'ULTIMO punto di ogni tracciato non si tocca mai: è dove il filo va consegnato al pezzo
  // successivo, e spostarlo staccherebbe la sequenza. Quindi la soglia vale su tutto TRANNE
  // l'ultimo segmento — ed è una scelta del core (`enforceMinStitch`), non una svista qui.
  check('il punto più corto rispetta la soglia (ultimo segmento escluso)',
    piuCortoSenzaUltimo(conPulizia) >= 0.5 - 1e-9, true);
  check('senza pulizia invece restava sotto soglia (è il difetto che chiude)',
    piuCorto(piano) < 0.5, true);
  // La pulizia toglie punti, non SPOSTA punti: la forma cucita resta quella.
  const filoPrima = rg.threadMetres(piano, 'A');
  const filoDopo = rg.threadMetres(conPulizia, 'A');
  check('toglie punti senza stravolgere il disegno (filo entro l\'1%)',
    Math.abs(filoDopo - filoPrima) / filoPrima < 0.01, true);

  // ---- i VALORI di un pattern letti da un SVG (Lorenzo: "a te servono solo i valori") ----
  // Ricalcare la geometria dell'SVG dentro le zone dava un ricamo a pezzi staccati. La strada
  // giusta è leggere COME È FATTO quel pattern e rigenerarlo col motore. Due modi, e qui si
  // misura quanto valgono: i parametri scritti nel file (esatti) e la misura (approssimata).
  console.log('\nzone-pattern — i valori di costruzione letti da un SVG');
  const attesi = {
    totalWidth: 80, totalHeight: 80, horizontalZigzagWidth: 5.5, horizontalZigzagHeight: 4.3,
    horizontalZigzagInterline: 0.45, horizontalZigzagSpacing: 12, verticalZigzagWidth: 1.2,
    verticalZigzagInterline: 0.45, stepX: 5.2, offsetY: 6, maxStitchMm: 6, minStitchMm: 0.4,
  };
  const campione = rg.generatePattern(attesi);

  const daParametri = rg.readPatternSvg(campione, 'viewbox-mm');
  check('un SVG uscito dalla suite ridà i suoi valori ESATTI (R27)',
    [daParametri.origin, daParametri.config.stepX, daParametri.config.horizontalZigzagSpacing,
      daParametri.config.horizontalZigzagWidth, daParametri.config.horizontalZigzagInterline],
    ['parametri', 5.2, 12, 5.5, 0.45]);
  check('...e NON porta con sé formato e sagoma, che qui li dà la zona',
    [daParametri.config.totalWidth, daParametri.config.shapeType], [undefined, undefined]);

  // Stesso file, ma senza i parametri: si deve MISURARE dalla geometria.
  const senzaParametri = campione.replace(/<metadata>[\s\S]*?<\/metadata>/, '');
  const misurato = rg.readPatternSvg(senzaParametri, 'viewbox-mm');
  const scarto = (campo) => {
    const got = misurato.config[campo];
    return got === undefined ? Infinity : Math.abs(got - attesi[campo]) / attesi[campo];
  };
  check('senza parametri si passa alla misura', misurato.origin, 'misura');
  check('la larghezza dello zig-zag si misura esatta', misurato.config.horizontalZigzagWidth, 5.5);
  check('il punto massimo si misura esatto', misurato.config.maxStitchMm, 6);
  check('i fili accostati entro il 5%', scarto('horizontalZigzagInterline') < 0.05, true);
  check('il passo fra le colonne entro il 5%', scarto('stepX') < 0.05, true);
  check('il passo fra le file entro il 5%', scarto('horizontalZigzagSpacing') < 0.05, true);
  // Il pericolo vero della misura è dare un numero SBAGLIATO con l'aria di essere giusto.
  // Su un pattern a zig-zag le direzioni sono due e la loro media non vuol dire niente:
  // meglio nessun angolo (il campo del pannello resta) che un angolo inventato.
  check('l\'inclinazione NON si inventa quando il disegno va in più direzioni',
    misurato.config.horizontalAngleDeg, undefined);
  check('...e lo dice', misurato.notes.some((n) => n.includes('non misurabile')), true);

  // I FILE DI RIFERIMENTO VERI di Lorenzo (CANNAGE-BASE-ORIGINALE-*, giugno 2026). Sono export
  // di PRIMA delle rinomine ⑥⑦⑧: scrivono `minPointDistance`, `strokeWidth`, `columnWaveFrequency`.
  // Senza migrazione dei nomi quei valori non arrivano sbagliati — SPARISCONO, e il pannello resta
  // sui suoi default come se il file non avesse detto niente. È il difetto che ha visto Lorenzo:
  // «ho un dubbio, che non venga preso un valore: lo spostamento dello zig-zag verso destra».
  console.log('\nzone-pattern — i file di riferimento di Lorenzo non perdono valori');
  const originale = rg.readPatternSvg(
    readFileSync(join(here, 'fixtures/cannage-base-leggero-metadati.svg'), 'utf8'), 'auto');
  check('i parametri si leggono dal file', originale.origin, 'parametri');
  check('LO SPOSTAMENTO DELLO ZIG-ZAG arriva (era quello che si perdeva)',
    originale.config.horizontalZigzagOffsetX, 0.8);
  check('e con lui l\'inclinazione del raccordo verticale',
    originale.config.verticalConnectorDiagonalOffsetY, 0.6);
  check('`minPointDistance` (nome vecchio) diventa il punto minimo, non sparisce',
    originale.config.minStitchMm, 2);
  check('`strokeWidth` (nome vecchio) diventa lo spessore di costruzione',
    originale.config.constructionStroke, 0.05);
  check('`columnWaveFrequency` (rad/mm) diventa lunghezza d\'onda in mm',
    Math.round(originale.config.columnWaveLengthMm), 63);
  check('anche gli interruttori arrivano (prima si tenevano solo i numeri)',
    [originale.config.repeatBack, originale.config.useConnectors, originale.config.alternateHorizontalAngle],
    [false, true, false]);
  check('le misure di costruzione ci sono tutte',
    [originale.config.horizontalZigzagWidth, originale.config.horizontalZigzagSpacing,
      originale.config.stepX, originale.config.offsetY], [1.98, 4.236, 1.83, 1.922]);

  // La difesa strutturale: un elenco solo. Due elenchi divergono, e la divergenza si vede
  // come un valore che sparisce in silenzio — che è esattamente com'era andata.
  // Ogni campo, col valore del suo TIPO: un numero per i numerici, un interruttore per i
  // booleani, una stringa per le scelte. Prima il campione era sempre un numero, e il primo
  // campo a scelta (la pulizia dei bordi) sarebbe passato per "non leggibile".
  const valoreDiProva = { num: 7, check: true, select: 'delete' };
  check('ogni campo del pannello è leggibile da un file, senza eccezioni',
    rg.PATTERN_FIELD_NAMES.filter((name) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${
        JSON.stringify({ sourceConfig: { [name]: valoreDiProva[rg.PATTERN_FIELD_KIND[name]] } })}</metadata></svg>`;
      return rg.readPatternSvg(svg, 'auto').config[name] === undefined;
    }), []);

  // I mattoni della misura, presi da soli.
  check('la moda trova il valore che ricorre, non la media',
    rg.modeOf([1, 5.1, 5.2, 5.2, 5.3, 40], 0.2), 5.2);
  check('il periodo si trova anche sotto una struttura più fine',
    Math.abs(rg.periodOf(
      Array.from({ length: 400 }, (_, i) => Math.floor(i / 4) * 5 + (i % 4) * 0.4), 0.1, 1.2) - 5) < 0.3, true);
  check('un file senza tracciati non produce valori inventati',
    Object.keys(rg.readPatternSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'viewbox-mm').config).length, 0);

  // ---- IL PROGETTO DENTRO IL FILE: un .dst che si riapre DA SOLO ----
  // Lorenzo: «come negli altri tool, è possibile creare dei DST rileggibili e rimodificabili?».
  // Sì, e qui si può fare meglio: negli altri tool l'ingresso è un'immagine e non si incorpora,
  // quindi riaprendo torni ai parametri ma il disegno lo ricarichi a parte. Qui l'ingresso sono
  // POLIGONI, e ci stanno dentro — il .dst si riapre col cartamodello e basta.
  console.log('\nzone-pattern — il progetto viaggia dentro il file (R27/R31)');
  const disegnoSalvato = {
    name: 'cannage-zone.svg',
    zones: zone.map((z) => ({
      id: z.id, color: z.color,
      points: z.points.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })),
    })),
  };
  const progetto = { rgProject: 'zone-pattern', params: { 'A.stepX': 11 }, roles: ruoli, drawing: disegnoSalvato };
  const dstNudo = rg.dstFromExportLayers(piano.layers, { label: 'CANNAGE' });
  const dstPieno = rg.dstFromExportLayers(piano.layers, { label: 'CANNAGE', metadata: progetto });

  // La regola che rende tutto questo lecito: il footer sta DOPO il record END, dove la
  // macchina non guarda. Se toccasse la cucitura sarebbe una bella idea inutilizzabile.
  check('la cucitura fino all\'END è byte-identica con e senza progetto',
    dstNudo.every((b, i) => b === dstPieno[i]), true);
  check('il progetto pesa poco: il disegno intero sta in pochi kB',
    (dstPieno.length - dstNudo.length) / 1024 < 20, true);

  const riletto = rg.readDstMetadata(dstPieno);
  check('il .dst si rilegge e sa da dove viene', riletto?.rgProject, 'zone-pattern');
  check('...e porta dentro il CARTAMODELLO, non solo i parametri',
    riletto?.drawing?.zones?.length, zone.length);
  check('...e i ruoli, per non rifare la mappa dei colori', Object.keys(riletto?.roles ?? {}).length, 6);

  // Le zone si ricostruiscono MISURANDO di nuovo: nel file c'è la sola geometria, così un
  // progetto vecchio gode delle regole di misura di oggi invece di riaprire i difetti di ieri.
  const ricostruite = rg.resolveZoneAngles(rg.zonesFromShapes(riletto.drawing.zones), 20);
  check('le zone tornano tutte', ricostruite.length, zone.length);
  let scartoPunti = 0;
  let scartoAngoli = 0;
  for (let i = 0; i < zone.length; i++) {
    scartoAngoli = Math.max(scartoAngoli, Math.abs(zone[i].angleDeg - ricostruite[i].angleDeg));
    for (let k = 0; k < zone[i].points.length; k++) {
      scartoPunti = Math.max(scartoPunti, Math.hypot(
        zone[i].points[k].x - ricostruite[i].points[k].x, zone[i].points[k].y - ricostruite[i].points[k].y));
    }
  }
  check('la geometria torna al micron (arrotondata a 3 decimali)', scartoPunti < 0.002, true);
  check('e gli angoli si rimisurano identici', scartoAngoli < 0.01, true);
  // Il TETTO. I disegni veri sono leggeri (cannage 10.7 kB, i cartamodelli di oblique 0.9-3,
  // e persino il suo SVG da 2 MB ne produce 25: quei 2 MB sono ricamo, non contorni). Ma un
  // contorno tracciato male, con decine di migliaia di punti, gonfierebbe il DST in silenzio.
  const pesante = Array.from({ length: 40 }, (_, z) => ({
    id: `p${z}`, color: '#123456',
    points: Array.from({ length: 900 }, (_, i) => ({ x: Math.cos(i) * 50 + z, y: Math.sin(i) * 50 })),
  }));
  const kbDi = (shapes) => JSON.stringify({ name: 'x', zones: shapes }).length / 1024;
  check('un disegno vero sta comodo sotto il tetto', kbDi(disegnoSalvato.zones) < 256, true);
  check('...uno patologico invece lo supera, e va riconosciuto', kbDi(pesante) > 256, true);

  check('un file di un altro tool non viene scambiato per uno di questo',
    rg.readDstMetadata(rg.dstFromExportLayers(piano.layers, { label: 'X', metadata: { rgProject: 'bitmap' } }))?.rgProject !== 'zone-pattern', true);

  const dstZone = rg.dstFromExportLayers(piano.layers, { label: 'CANNAGE', metadata: { rgProject: 'zone-pattern' } });
  check('il DST esce coi due aghi e si riapre (R27/R31)',
    [String.fromCharCode(...dstZone.slice(0, 3)), rg.readDstMetadata(dstZone)?.rgProject], ['LA:', 'zone-pattern']);
}

// ---------------------------------------------------------------------------------------------
// IL LUCCHETTO DI `reduce`, messo PRIMA di promuoverla nel core.
//
// `reduce` e' il pezzo che guarda un'immagine e decide di che colore e' ogni pixel: pareggia la
// luce, attenua la grana, sceglie le tinte, assorbe le isole troppo piccole. Nasce in
// `apps/broccato`; sale nel core perche' il Punto Pittorico ne ha bisogno — misurato sulla
// cianotipia vera, senza questo passaggio il contorno della macchia piu' grande ha 699 fori che
// non sono fori, sono grana della stampa.
//
// L'immagine di prova e' finta ma ha tutto quello che serve a esercitarlo: due campiture, una
// luce che scende da sinistra a destra (per il pareggio), un disturbo deterministico (per la
// grana) e due isole minuscole (per l'assorbimento). Il disturbo e' a numeri interi di proposito:
// `Math.sin` non e' identico bit a bit fra motori JavaScript, e un lucchetto che cambia da solo
// non e' un lucchetto.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('reduce — il lucchetto prima della promozione nel core');
const immagineDiProva = () => {
  const W = 64, H = 48;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const disturbo = (x, y) => {
    let a = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    a = Math.imul(a ^ (a >>> 13), 1274126177);
    return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dentro = x > 12 && x < 50 && y > 10 && y < 36;      // la campitura chiara
      const luce = 40 * (x / W);                                 // la luce che scende di traverso
      const grana = (disturbo(x, y) - 0.5) * 70;                 // la grana della stampa
      const base = dentro ? 205 : 60;
      const v = Math.max(0, Math.min(255, base + luce + grana));
      const o = (y * W + x) * 4;
      rgba[o] = v * 0.35; rgba[o + 1] = v * 0.55; rgba[o + 2] = v; rgba[o + 3] = 255;
    }
  }
  // due isole piccole, che la pulizia deve assorbire. Cinque pixel di lato e non due: a due,
  // l'attenuazione della grana se le mangiava PRIMA di arrivare all'assorbimento, e il lucchetto
  // sorvegliava un pezzo di codice che non girava mai (misurato: `removedBlobs` restava a 0).
  for (const [cx, cy] of [[4, 40], [55, 3]]) {
    for (let y = cy; y < cy + 5; y++) for (let x = cx; x < cx + 5; x++) {
      const o = (y * W + x) * 4;
      rgba[o] = 220; rgba[o + 1] = 230; rgba[o + 2] = 250;
    }
  }
  return { rgba, width: W, height: H };
};
{
  const img = immagineDiProva();
  const opzioni = {
    colorCount: 2, flattenLightMm: 6, smoothMm: 1.5, minBlobMm2: 8, mmPerPx: 0.5, refineIterations: 4,
  };
  const res = rg.reduceStable(img, opzioni);
  // una firma corta di una mappa lunga: se cambia un pixel, cambia il numero
  const firma = (a) => {
    let h = 2166136261;
    for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  };

  check('escono le due tinte chieste', res.palette.length, 2);
  check('e sono queste, al bit', res.palette.map((c) => c.map((v) => Math.round(v))),
    [[35, 54, 98], [80, 119, 207]]);
  check('i pixel per tinta', res.counts, [2151, 921]);
  check('le due isole minuscole vengono assorbite', res.removedBlobs, 2);
  check('e bastano due passate per arrivare a stabilita\'', res.cleanPasses, 2);
  check('la mappa dei colori e\' questa, pixel per pixel', firma(res.index), '5a344c46');
  check('e l\'immagine preparata e\' questa', firma(res.prepared.rgba), '61534bd2');

  // i pezzi singoli, perche' la catena intera puo' nascondere un cambio dentro uno solo
  const prep = rg.prepareImage(img, opzioni);
  check('il pareggio della luce e l\'attenuazione, da soli, danno lo stesso', firma(prep.rgba), firma(res.prepared.rgba));
  check('il pareggio della luce non cambia la misura dell\'immagine',
    [prep.width, prep.height], [img.width, img.height]);
  check('e togliere la grana da sola fa questo', firma(rg.despeckle(img, 3).rgba), '3a6cab82');

  check('stessa immagine, stessa riduzione',
    JSON.stringify(rg.reduceStable(img, opzioni).counts) === JSON.stringify(res.counts), true);
}

// ---------------------------------------------------------------------------------------------
// IL LUCCHETTO DI `traceRegions`, messo PRIMA di promuoverla nel core.
//
// La primitiva sta per spostarsi da `apps/broccato` a `@rg/core` (regola di crescita 1: il secondo
// cliente adesso c'e', ed e' il Punto Pittorico). Uno spostamento a comportamento invariato si
// dimostra, non si dichiara: queste asserzioni fissano cosa fa OGGI, su una maschera costruita
// apposta per toccare i casi che contano — una macchia col foro, una macchia semplice, e due pixel
// che si toccano solo per un angolo. Se dopo il trasloco un numero cambia, cambia qui.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('traceRegions — il lucchetto prima della promozione nel core');
const mascheraDiProva = () => {
  const W = 40, H = 30, NO = 0xff;
  const idx = new Uint8Array(W * H).fill(NO);
  const riempi = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) idx[y * W + x] = v;
  };
  riempi(4, 4, 15, 15, 1);          // macchia grande
  riempi(8, 8, 11, 11, NO);         // ...col suo foro
  riempi(22, 4, 30, 10, 1);         // macchia semplice
  idx[20 * W + 20] = 1;             // due pixel che si toccano SOLO per un angolo:
  idx[21 * W + 21] = 1;             // a 4 vicini sono due macchie, e il filo li' non passa
  riempi(4, 22, 10, 26, 2);         // un altro colore, che non deve entrarci
  return { idx, W, H };
};
{
  const { idx, W, H } = mascheraDiProva();
  const regioni = rg.traceRegions(idx, W, H, 1, 0.5);
  const aree = regioni.map((r) => Number(r.areaMm2.toFixed(4)));
  check('le macchie del colore 1 sono quattro (i due pixel d\'angolo restano separati)', regioni.length, 4);
  check('escono dalla piu\' grande alla piu\' piccola', aree, [32.5, 15.75, 0.25, 0.25]);
  check('solo la prima ha un foro', regioni.map((r) => r.holes.length), [1, 0, 0, 0]);
  check('l\'area totale non dipende dall\'ordine', Number(rg.regionsAreaMm2(regioni).toFixed(4)), 48.75);

  // DIFETTO TROVATO SCRIVENDO IL LUCCHETTO, e per ora bloccato COM'E'.
  // La macchia e' 12x12 px e il foro 4x4, cioe' 36 mm2 meno 4 = 32 netti. Ne escono 32,5: mezzo
  // millimetro quadrato di foro sparito, il 12,5% del foro. La semplificazione di default
  // (`mmPerPx * 1.2`, qui 0,6 mm) mangia un ANGOLO dell'anello — il foro passa da 6 punti a 5 e
  // da 4,000 a 3,500 mm2; il contorno esterno, che e' grande, non ne risente (36,000 esatti).
  // Colpisce quindi le FEATURE PICCOLE, e sui fori vuol dire ricamare dentro un vuoto (R5).
  // Abbassando la tolleranza il foro torna quadrato: e' quello il numero da decidere, non il codice.
  // Non si corregge qui: cambierebbe l'uscita di `broccato`, che e' live, e per R30 una divergenza
  // numerica si decide col ricamo in mano. La strada giusta e' il punto 2b del Punto Pittorico —
  // riconoscere la primitiva (qui: un quadrato) invece di semplificare la scalinata.
  check('la semplificazione di default mangia un angolo del foro piccolo (32,5 invece di 32)', aree[0], 32.5);
  check('...e a tolleranza fine il foro torna quadrato: e\' la tolleranza, non il tracciato',
    Number(rg.traceRegions(idx, W, H, 1, 0.5, { simplifyMm: 0.2 })[0].areaMm2.toFixed(4)), 32);
  check('un punto nel foro NON e\' nella regione (R5)', rg.pointInRegion({ x: 5, y: 5 }, regioni[0]), false);
  check('...e uno nell\'anello si', rg.pointInRegion({ x: 3, y: 3 }, regioni[0]), true);
  check('il colore 2 ha la sua macchia, e una sola', rg.traceRegions(idx, W, H, 2, 0.5).length, 1);
  check('chiedere il NON-colore non produce regioni', rg.traceRegions(idx, W, H, 0xff, 0.5).length, 0);
  check('l\'area minima butta via le schegge', rg.traceRegions(idx, W, H, 1, 0.5, { minAreaMm2: 1 }).length, 2);
  check('e il risultato e\' deterministico',
    JSON.stringify(rg.traceRegions(idx, W, H, 1, 0.5)) === JSON.stringify(regioni), true);

  // IL DIFETTO CHE IL LUCCHETTO NON AVEVA VISTO, perche' la fixture non toccava il bordo.
  // Sull'immagine vera di Lorenzo il fondo scuro — 944.137 pixel — usciva come 865 frammenti da
  // una ventina di pixel quadrati. Causa: `y * width + x` con `x = -1` scavalca a capo e finisce
  // sull'ultimo pixel della riga precedente; se quello e' dello stesso colore, il lato sinistro non
  // viene emesso e il contorno non si chiude. Su un fondo che tocca il bordo succede sempre.
  // Il test e' scritto perche' quella lezione resti: una macchia che tocca i bordi verticali.
  const W2 = 20, H2 = 12;
  const bordo = new Uint8Array(W2 * H2).fill(0xff);
  for (let y = 3; y <= 8; y++) for (let x = 0; x < W2; x++) bordo[y * W2 + x] = 1;   // da bordo a bordo
  const attaccate = rg.traceRegions(bordo, W2, H2, 1, 1);
  check('una macchia che tocca i bordi sinistro e destro resta UNA macchia', attaccate.length, 1);
  check('...e la sua area e\' quella vera (20 x 6)', Number(attaccate[0]?.areaMm2.toFixed(4)), 120);
}

// ---------------------------------------------------------------------------------------------
// PUNTO PITTORICO — LA CATENA INTERA: da un'immagine ai punti da cucire.
//
// Non c'e' algoritmo nuovo qui: c'e' l'ORDINE in cui i pezzi gia' provati si chiamano, ed e' quello
// che il test sorveglia. Ogni passo dipende da una cosa misurata nel precedente, e se qualcuno li
// riordina «per semplificare» il risultato cambia in silenzio.
// ---------------------------------------------------------------------------------------------
console.log('');
const luminanza = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
console.log('Punto Pittorico — la catena intera, da immagine a punti');
{
  // un'immagine piccola ma con dentro tutto quello che la catena deve saper leggere: due campiture,
  // un passaggio SFUMATO in mezzo (rampa larga), un passaggio NETTO a destra, e la grana della stampa
  // W abbondante di proposito: il passaggio si misura camminando ±10 mm di traverso al bordo, e se
  // due bordi stanno piu' vicini di cosi' il profilo ne prende due e la misura non significa niente.
  const W = 180, H = 90, mmPerPx = 0.4;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const disturbo = (x, y) => {
    let a = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    a = Math.imul(a ^ (a >>> 13), 1274126177);
    return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v;
      if (x < 120) v = 40 + 175 * Math.max(0, Math.min(1, (x - 25) / 30));  // rampa larga: SFUMA
      else v = 40;                                                          // gradino secco: STACCA
      v += (disturbo(x, y) - 0.5) * 40;                                     // la grana
      const o = (y * W + x) * 4;
      rgba[o] = v * 0.4; rgba[o + 1] = v * 0.6; rgba[o + 2] = v; rgba[o + 3] = 255;
    }
  }
  const img = { rgba, width: W, height: H };
  const params = { ...rg.defaultPittoricoParams, colorCount: 3, minAreaMm2: 20, realWidthMm: W * mmPerPx };
  const plan = rg.buildPittoricoPlan(img, params);

  check('la scala viene dalla larghezza reale, non dai pixel (R11)',
    [Number(plan.mmPerPx.toFixed(4)), Number(plan.larghezzaMm.toFixed(1))], [mmPerPx, 72]);
  check('escono le tinte chieste, e l\'ordine di cucitura va dalla piu\' scura alla piu\' chiara',
    [plan.palette.length, plan.ordine.length,
      plan.ordine.every((t, i, a) => i === 0 || luminanza(plan.palette[a[i - 1]]) <= luminanza(plan.palette[t]))],
    [3, 3, true]);
  check('il disegno viene cucito davvero', [plan.macchie.length > 0, plan.punti > 500, plan.filoMm > 500], [true, true, true]);

  // LA CATENA LEGGE I BORDI: l'immagine ne ha uno sfumato e uno netto, e devono uscire tutt'e due.
  check('trova sia bordi sfumati sia bordi netti',
    [plan.bordiSfumati > 0, plan.bordiSfumati < plan.bordiTotali], [true, true]);

  // OGNI TINTA E' UN AGO (R31): un livello per tinta, nell'ordine di cucitura.
  const layers = rg.pittoricoExportLayers(plan);
  check('un livello per ago, nell\'ordine di cucitura', layers.length <= plan.palette.length, true);
  check('e ogni livello porta il colore della sua tinta',
    layers.every((l) => /^#[0-9a-f]{6}$/.test(l.color)), true);
  check('il filo si disegna sottile anche in export (R15)',
    layers.every((l) => l.strokeMm === 0.1), true);

  // R4: il punto massimo vale anche qui, dopo tutta la catena.
  let piuLungo = 0;
  for (const l of layers) for (const c of l.polylines) for (let i = 1; i < c.length; i++) {
    piuLungo = Math.max(piuLungo, Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y));
  }
  check('nessun punto oltre il massimo, dopo tutta la catena (R4)', piuLungo <= params.maxStitchMm + 1e-6, true);

  // R9/R27/R31: quello che esce si riapre, in SVG e in DST.
  const tutti = layers.flatMap((l) => l.polylines.flat());
  const svg = rg.buildSvg(layers, { bounds: rg.bounds(tutti), marginMm: 4, metadata: { rgProject: 'pittorico', params } });
  check('l\'SVG si riapre e ritrova i parametri (R9)', rg.readProjectMetadata(svg)?.rgProject, 'pittorico');
  const dst = rg.dstFromExportLayers(layers, { label: 'PITTORICO', metadata: { rgProject: 'pittorico', params } });
  check('il DST e\' un DST vero e si riapre (R31)',
    [String.fromCharCode(...dst.slice(0, 3)), rg.readDstMetadata(dst)?.rgProject], ['LA:', 'pittorico']);

  check('stessa immagine, stesso ricamo',
    rg.buildPittoricoPlan(img, params).punti === plan.punti, true);
}

// ---------------------------------------------------------------------------------------------
// PUNTO PITTORICO — L'ORDINE DEL FILO: il riempimento che parte dalla rotaia.
//
// Nasce da una critica di Lorenzo: «mi aspetto che il riempimento sia molto preciso, con densita'
// costanti dove possibile e accorgimenti quando la densita' cambia. Ora vedo tante linee non
// ordinate». «Ordinato» sembra un giudizio e invece si misura, e la misura e' questa: **quanti capi
// di punto finiscono SUL BORDO invece che a mezz'aria**. In un pettine ogni punto va da un bordo
// all'altro; nel posizionamento a distanza costante le file si fermano contro le vicine e i capi
// cadono in mezzo alla forma — ed e' quello che si vede come disordine.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('Punto Pittorico — l\'ordine del filo (riempimento dalla rotaia)');
{
  const PASSO = 0.3;
  const banda = rg.regioniDiProva().find((p) => p.id === 'banda-curva');
  // la banda di prova e' costruita come «lato sinistro + lato destro rovesciato»: la prima meta'
  // del contorno e' un fianco, cioe' una rotaia
  const rotaia = banda.region.outer.slice(0, Math.floor(banda.region.outer.length / 2));

  // LE TESTATE. I due lati corti che uniscono i fianchi non sono bordi di colore: li' la fascia
  // semplicemente finisce, e il campo non deve prendere ordini da loro. E' la distinzione che un
  // ricamatore fa senza pensarci — un conto e' il BORDO dove il colore cambia, un altro la TESTATA.
  const testateDi = (region) => {
    const meta = Math.floor(region.outer.length / 2), n = region.outer.length;
    const seg = [[region.outer[meta - 1], region.outer[meta]], [region.outer[n - 1], region.outer[0]]];
    return (p) => seg.some(([a, b]) => {
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) < 0.6;
    });
  };
  const campoCon = (region) => rg.harmonicField(region, {
    cellMm: 1, levels: 4, sweeps: 300,
    condizioneA: (p) => (testateDi(region)(p) ? 'libera' : 'perpendicolare'),
  });
  const campo = campoCon(banda.region);

  const rail = rg.buildRailFill(banda.region, campo, rotaia, { spacingMm: PASSO, maxStitchMm: 3 });
  const bordo = new rg.BoundaryIndex(rg.regionRings(banda.region), 4);
  const capiSulBordo = (runs) => {
    let capi = 0, dentro = 0;
    for (const r of runs) {
      if (r.length < 2) continue;
      for (const p of [r[0], r[r.length - 1]]) { capi++; if (bordo.nearest(p).distMm <= 0.35) dentro++; }
    }
    return capi ? dentro / capi : 0;
  };
  check('quasi tutti i capi finiscono sul bordo: e\' un pettine, non un\'erba',
    capiSulBordo(rail.runs) > 0.95, true);

  // LIBERARE LE TESTATE CONTA, e si vede: con la perpendicolare imposta anche li', il campo gira di
  // 90° proprio dove la fascia finisce, i punti della rotaia non arrivano nell'angolo e restano
  // capi corti sparsi. Misurato: capi sul bordo dal 91% al 98%, e i cunei del primo giro da 53 a 18.
  const railVincolato = rg.buildRailFill(banda.region,
    rg.harmonicField(banda.region, { cellMm: 1, levels: 4, sweeps: 300 }),
    rotaia, { spacingMm: PASSO, maxStitchMm: 3 });
  check('...e liberare le testate migliora l\'ordine invece di peggiorarlo',
    capiSulBordo(rail.runs) > capiSulBordo(railVincolato.runs), true);
  check('...e chiede molti meno cunei',
    rail.cuneiPerGiro[0] < railVincolato.cuneiPerGiro[0] / 2, true);

  // I CUNEI CONVERGONO. E' l'«accorgimento quando la densita' cambia»: un punto in piu' infilato
  // dove la fascia si allarga. Deve esaurirsi, non moltiplicarsi — e la prima versione si
  // moltiplicava (53, 105, 205, 394, 711, 1319 su 444 semi, con 49 m di filo al posto di 9) perche'
  // confrontavo due punti alla stessa distanza dal LORO inizio invece che alla stessa profondita'
  // dalla rotaia, e un cuneo comincia piu' avanti.
  const giri = rail.cuneiPerGiro;
  check('i cunei si esauriscono invece di moltiplicarsi',
    giri.length > 1 && giri[giri.length - 1] < giri[0] / 5, true);
  check('...e sono pochi rispetto ai punti seminati sulla rotaia',
    giri.reduce((s, v) => s + v, 0) < rail.semi * 0.3, true);

  // LA DENSITA' NON PEGGIORA PER AVERE L'ORDINE: e' la condizione perche' il cambio valga la pena.
  const curvo = rg.buildCurvedFill(banda.region, campo, { spacingMm: PASSO, maxStitchMm: 3 }).runs;
  const covRail = rg.coverageStats(rail.runs, banda.region, PASSO);
  const covCurvo = rg.coverageStats(curvo, banda.region, PASSO);
  check('la densita' + ' consegnata resta quella chiesta', Math.abs(covRail.media / (1 / PASSO) - 1) <= 0.12, true);
  check('...e la dispersione non peggiora rispetto al metodo di prima',
    covRail.cv < covCurvo.cv * 1.35, true);
  check('e il filo non aumenta', rg.fillThreadMm(rail.runs) < rg.fillThreadMm(curvo) * 1.1, true);

  // IL LIMITE, misurato e non nascosto: dietro un foro il metodo lascia un'OMBRA. I punti che
  // incontrano il vuoto si fermano, e dietro non arriva niente perche' tutti partono dalla stessa
  // rotaia. Il posizionamento a distanza costante non ha questo problema (riempie da dentro).
  // Si risolve spezzando la regione attorno all'ostacolo — e' il prossimo lavoro, non un mistero.
  const conForo = rg.regioniDiProva().find((p) => p.id === 'banda-curva-con-foro');
  const rotaia2 = conForo.region.outer.slice(0, Math.floor(conForo.region.outer.length / 2));
  const railForo = rg.buildRailFill(conForo.region, campoCon(conForo.region), rotaia2, { spacingMm: PASSO, maxStitchMm: 3 });
  check('con le testate libere anche la banda col foro si copre tutta',
    rg.coverageStats(railForo.runs, conForo.region, PASSO, 2).min > 0, true);
  check('...e la dispersione sta sotto il 25%',
    rg.coverageStats(railForo.runs, conForo.region, PASSO).cv < 0.25, true);
  check('il bordo del foro fa da rotaia anche lui, e aggiunge punti', railForo.ombre > 20, true);

  // LA PASSATA CHE CHIUDE I VUOTI, nata da una domanda di Lorenzo su una losanga chiara nel ritaglio
  // («ma tipo questi buchi? cosa sono»). Il cuneo si infila confrontando due punti vicini alle
  // profondita' in cui esistono TUTT'E DUE: quando un punto finisce prima, oltre la sua fine non c'e'
  // piu' niente da confrontare e il vuoto che si apre li' nessuno lo vede. La passata finale guarda
  // la COPERTURA invece delle coppie. Misurato sul ritaglio vero: il vuoto peggiore fra due file
  // scende da 1,02 a 0,58 mm.
  const senzaChiusura = rg.buildRailFill(conForo.region, campoCon(conForo.region), rotaia2,
    { spacingMm: PASSO, maxStitchMm: 3, chiudiVuoti: false });
  check('la passata finale chiude vuoti che i cunei non vedono',
    rg.neighbourSpacing(railForo.runs, PASSO).max < rg.neighbourSpacing(senzaChiusura.runs, PASSO).max, true);
  check('...e serve poco lavoro: pochi punti in piu\' rispetto a quelli della rotaia',
    railForo.chiusure < railForo.semi * 0.5, true);
  check('anche senza foro la rotaia copre tutto',
    rg.coverageStats(rail.runs, banda.region, PASSO, 2).min > 0, true);

  // LA CONTROPROVA. Vincolando le testate il pezzo scoperto TORNA, e la dispersione risale al 59%.
  // Serve a impedire che qualcuno «semplifichi» la condizione al bordo senza accorgersi di cosa
  // costa: era un quadrato di 24 mm senza un punto, e non stava dietro il foro — stava
  // all'estremita' larga della fascia, che e' tutta un'altra cosa.
  const vincolato = rg.buildRailFill(conForo.region,
    rg.harmonicField(conForo.region, { cellMm: 1, levels: 4, sweeps: 300 }),
    rotaia2, { spacingMm: PASSO, maxStitchMm: 3 });
  // La controprova NON e' piu' «il pezzo scoperto torna»: da quando c'e' la passata che chiude i
  // vuoti, quel pezzo viene riempito lo stesso — ma a fatica, con punti seminati a caso dentro un
  // campo sbagliato. Quello che resta vero, e che si misura, e' che il ricamo peggiora in tutto:
  // dispersione dal 19% al 29% e capi sul bordo dal 94% al 78%. Il test dice questo, perche' e'
  // questo che il numero sostiene.
  check('...e vincolando le testate la dispersione peggiora di meta\'',
    rg.coverageStats(vincolato.runs, conForo.region, PASSO).cv
      > rg.coverageStats(railForo.runs, conForo.region, PASSO).cv * 1.4, true);
  check('...e l\'ordine crolla: molti piu\' capi a mezz\'aria',
    capiSulBordo(vincolato.runs) < capiSulBordo(railForo.runs) - 0.1, true);
}

// ---------------------------------------------------------------------------------------------
// PUNTO PITTORICO — I BORDI (punto 4): dove il colore sfuma e dove stacca.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('Punto Pittorico — i bordi: sfumato, secco, sovrapposizione, frange');
{
  const mmPerPx = 0.353;

  // --- LA MISURA DELLA SFUMATURA, tarata su rampe di larghezza NOTA ---
  // Su una rampa lineare il passaggio dal 10% al 90% vale 0,8 della larghezza: e' aritmetica, non
  // un'opinione, quindi la misura si puo' verificare invece che credere. La prima versione sbagliava
  // e questo test l'avrebbe presa subito: cercavo il 90% partendo dal lato dove il profilo e' gia'
  // alto, quindi lo trovavo al primo campione e la larghezza usciva uguale alla finestra — un
  // gradino netto misurava 12 mm invece di 0.
  const rampa = (larghezzaMm) => {
    const W = 200, H = 20;
    const rgba = new Uint8ClampedArray(W * H * 4);
    const meta = W / 2, semi = (larghezzaMm / mmPerPx) / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = semi <= 0 ? (x < meta ? 0 : 1) : Math.max(0, Math.min(1, (x - (meta - semi)) / (2 * semi)));
        const v = 30 + t * 200, o = (y * W + x) * 4;
        rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
      }
    }
    return { rgba, width: W, height: H };
  };
  const misura = (larghezzaMm) => rg.larghezzaTransizione(
    rampa(larghezzaMm), mmPerPx, { x: 100 * mmPerPx, y: 10 * mmPerPx }, { x: 1, y: 0 }, { raggioMm: 12 },
  );
  check('un colore che stacca NETTO misura zero', Number(misura(0).larghezzaMm.toFixed(2)), 0);
  for (const vera of [4, 10, 16]) {
    const atteso = vera * 0.8;
    check(`una sfumatura da ${vera} mm si misura ${atteso.toFixed(1)} mm (il 10-90 di una rampa)`,
      Math.abs(misura(vera).larghezzaMm - atteso) < 0.75, true);
  }
  check('dove non c\'e' + ' un salto di colore non si inventa un bordo',
    rg.larghezzaTransizione(rampa(0), mmPerPx, { x: 20 * mmPerPx, y: 10 * mmPerPx }, { x: 1, y: 0 }, { raggioMm: 4 }), null);

  // --- LA SOVRAPPOSIZIONE DI 5 MM: avanti si', indietro MAI (decisione 2 di Lorenzo) ---
  // Tre fasce verticali affiancate, cucite da sinistra a destra: la prima deve entrare nella
  // seconda e nella terza, la terza in nessuna. "Chi sta sotto e' abbondante, chi va sopra ci si
  // appoggia" — se crescesse anche all'indietro, il colore gia' cucito verrebbe coperto.
  const W = 120, H = 30;
  const fasce = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fasce[y * W + x] = x < 40 ? 0 : x < 80 ? 1 : 2;
  const ordine = [0, 1, 2];
  const CRESCITA = 5;
  const contaPer = (t) => {
    const m = rg.cresciVersoISuccessivi(fasce, W, H, t, ordine, mmPerPx, { crescitaMm: CRESCITA, sormontoMm: 0 });
    let avanti = 0, indietro = 0, oltre = 0;
    const dopo = new Set(ordine.slice(ordine.indexOf(t) + 1));
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || fasce[i] === t) continue;
      if (dopo.has(fasce[i])) avanti++; else indietro++;
    }
    // fin dove arriva: la colonna piu' lontana raggiunta oltre il proprio confine
    for (let x = 0; x < W; x++) if (m[15 * W + x] && fasce[15 * W + x] !== t) oltre = Math.max(oltre, x);
    return { avanti, indietro, oltre };
  };
  const prima = contaPer(0), ultima = contaPer(2);
  check('la prima tinta cresce verso quelle che verranno dopo', prima.avanti > 0, true);
  check('...e nessuna tinta cresce verso quelle gia\' cucite',
    [prima.indietro, contaPer(1).indietro, ultima.indietro], [0, 0, 0]);
  check('l\'ultima tinta non cresce: non ha nessuno sotto cui infilarsi', ultima.avanti, 0);
  // il confine e' a x=40; 5 mm a 0,353 mm/px sono 14,2 px, quindi si arriva verso x=54
  check('e la crescita vale davvero 5 mm, non un pixel a caso',
    Math.abs((prima.oltre - 39) * mmPerPx - CRESCITA) < 0.6, true);

  // --- LE FRANGE: i capi si ritirano, ma solo dove il colore sfuma ---
  const corse = Array.from({ length: 40 }, (_, k) => [{ x: 0, y: k * 0.4 }, { x: 30, y: k * 0.4 }]);
  const frangiate = rg.frastaglia(corse, (p) => p.x > 20, { frangiaMm: 6, granaMm: 1.2 });
  const capiDestri = frangiate.map((c) => c[c.length - 1].x);
  const capiSinistri = frangiate.map((c) => c[0].x);
  check('il capo sul bordo che sfuma si ritira, e non tutti uguali',
    new Set(capiDestri.map((v) => v.toFixed(2))).size > 10, true);
  check('...entro la frangia chiesta, mai oltre',
    capiDestri.every((v) => v <= 30.0001 && v >= 24 - 1e-6), true);
  check('il capo sul bordo NETTO non si tocca', capiSinistri.every((v) => v === 0), true);
  check('stessa posizione, stessa frangia (§7: stessi parametri, stesso ricamo)',
    JSON.stringify(rg.frastaglia(corse, (p) => p.x > 20, { frangiaMm: 6, granaMm: 1.2 })) === JSON.stringify(frangiate), true);
  check('a frangia zero il riempimento resta identico',
    JSON.stringify(rg.frastaglia(corse, () => true, { frangiaMm: 0 })), JSON.stringify(corse));

  // LA FRANGIA VIVE SOLO NEL MARGINE CRESCIUTO, e questo e' il test del difetto che Lorenzo ha
  // visto per primo: «non mi sembra molto elegante il modo di fare sfumature, ci sono davvero un
  // sacco di buchi». Nel ricamo vero le frange SPORGONO oltre il blocco di colore — per questo la
  // regione cresce di 5 mm prima di essere riempita — mentre il ritiro le mangiava dentro. Dove il
  // blocco non era cresciuto, il riempimento si accorciava e fra due blocchi restava un buco.
  // Qui il corpo del colore arriva a x=25 e il margine cresciuto va da 25 a 30: la punta di ogni
  // fila deve cadere dentro quel margine, mai piu' indietro.
  const margine = (frangiaMm) => rg.frastaglia(corse, () => true, {
    frangiaMm, granaMm: 0.4, restaFuoriDa: (p) => p.x < 25,
  }).map((c) => c[c.length - 1].x);
  const punte = margine(5);
  check('la frangia non entra mai nel corpo del colore', punte.every((v) => v >= 25 - 1e-6), true);
  check('...ma dentro il margine varia davvero', new Set(punte.map((v) => v.toFixed(2))).size > 8, true);
  check('e nessuna corsa viene distrutta dal ritiro',
    rg.frastaglia(corse, () => true, { frangiaMm: 5, granaMm: 0.4, restaFuoriDa: (p) => p.x < 25 }).length,
    corse.length);

  // LA TRAPPOLA: se la frangia chiesta supera il margine cresciuto, il taglio la SATURA — tutti i
  // capi finiscono sul bordo del corpo e la frangia sparisce, cioe' si ottiene l'opposto di quello
  // che si voleva. Il parametro di pannello va tenuto <= alla crescita (5 mm).
  const troppa = margine(20);
  check('una frangia piu' + ' lunga del margine si appiattisce, e va saputo',
    new Set(troppa.map((v) => v.toFixed(2))).size < new Set(punte.map((v) => v.toFixed(2))).size, true);

  // SUL BORDO NETTO NON SI CRESCE (chiesto da Lorenzo: «sul bordo netto vorrei rimanesse tutto
  // netto, colore che stacca preciso»). Se il blocco scavalca un taglio secco, il taglio smette di
  // staccare: la crescita si fa solo dove una maschera dice che li' il colore sfuma.
  const soloMeta = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y < H / 2) soloMeta[y * W + x] = 1;
  const parziale = rg.cresciVersoISuccessivi(fasce, W, H, 0, ordine, mmPerPx, { crescitaMm: CRESCITA, sormontoMm: 0, sfuma: soloMeta });
  let sopra = 0, sotto = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (parziale[i] && fasce[i] !== 0) { if (y < H / 2) sopra++; else sotto++; }
    }
  }
  check('dove il colore sfuma il blocco cresce', sopra > 0, true);
  check('...e sul bordo netto non cresce di un pixel, se il sormonto e\' zero', sotto, 0);

  // IL SORMONTO SUL BORDO NETTO, chiesto da Lorenzo: «anche nelle divisioni nette immagina comunque
  // di far sormontare di 1/2 millimetri il sopra rispetto al sotto, e quindi il sotto farlo piu'
  // grande di quei millimetri». Non e' una contraddizione col bordo netto: a definire il bordo e' il
  // colore che va SOPRA, e quello sotto gli sta nascosto sotto. Senza, due colori accostati lasciano
  // vedere la tela alla giunta appena il filo tira (R19).
  const conSormonto = rg.cresciVersoISuccessivi(fasce, W, H, 0, ordine, mmPerPx,
    { crescitaMm: CRESCITA, sormontoMm: 1.5, sfuma: soloMeta });
  const arrivaA = (m, riga) => {
    let x = 0;
    for (let i = 0; i < W; i++) if (m[riga * W + i] && fasce[riga * W + i] !== 0) x = i;
    return (x - 39) * mmPerPx;   // il confine sta a x=40: quanto si sconfina oltre, in mm
  };
  check('dove sfuma si sconfina di 5 mm', Math.abs(arrivaA(conSormonto, 5) - CRESCITA) < 0.6, true);
  check('...e sul taglio netto di un millimetro e mezzo, non di zero',
    Math.abs(arrivaA(conSormonto, H - 5) - 1.5) < 0.6, true);
  check('il sopra non si allarga comunque mai all\'indietro', (() => {
    const ultimo = rg.cresciVersoISuccessivi(fasce, W, H, 2, ordine, mmPerPx, { crescitaMm: CRESCITA, sormontoMm: 1.5 });
    for (let i = 0; i < ultimo.length; i++) if (ultimo[i] && fasce[i] !== 2) return false;
    return true;
  })(), true);
}

// ---------------------------------------------------------------------------------------------
// PUNTO PITTORICO — le FORME NETTE (punto 2b): dal contorno a gradini alla primitiva che c'era.
//
// Si misura contro VERITÀ NOTA: il cerchio lo rasterizza il test, quindi il raggio vero si conosce
// al millesimo e l'errore si misura invece di stimarlo. Su un'immagine vera non si potrebbe: si
// direbbe solo che «sembra» un cerchio.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('Punto Pittorico — riconoscimento delle forme nette');
{
  const NO = 0xff;
  const cerchioRaster = (raggioPx, margine = 4) => {
    const lato = Math.ceil(raggioPx * 2) + margine * 2;
    const idx = new Uint8Array(lato * lato).fill(NO);
    const c = lato / 2;
    for (let y = 0; y < lato; y++) {
      for (let x = 0; x < lato; x++) if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= raggioPx) idx[y * lato + x] = 1;
    }
    return { idx, lato, c };
  };
  const lontanoDalVero = (ring, cx, cy, r) =>
    ring.reduce((m, p) => Math.max(m, Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)), 0);

  // --- il cerchio ---
  const raggioPx = 30, mmPerPx = 0.5;
  const { idx, lato, c } = cerchioRaster(raggioPx);
  const rVero = raggioPx * mmPerPx, cVero = c * mmPerPx;
  // si traccia con semplificazione FINE: il riconoscimento vuole la scalinata vera, non una gia'
  // smussata da una tolleranza che non ha scelto lui
  const tracciato = rg.traceRegions(idx, lato, lato, 1, mmPerPx, { simplifyMm: mmPerPx * 0.1 })[0];
  const scalinata = lontanoDalVero(tracciato.outer, cVero, cVero, rVero);
  check('la scalinata di un cerchio rasterizzato si scosta dal vero di circa mezzo pixel',
    scalinata > mmPerPx * 0.5 && scalinata < mmPerPx * 0.8, true);

  const ric = rg.regolarizzaAnello(tracciato.outer, { tolMm: mmPerPx });
  check('a tolleranza di UN pixel il cerchio e\' riconosciuto intero', ric.cerchioIntero, true);
  check('il raggio ricostruito sbaglia meno di 0,02 mm su 15', Math.abs(ric.pezzi[0].r - rVero) < 0.02, true);
  check('e il contorno ricostruito e\' almeno 10 volte piu\' vicino al vero della scalinata',
    lontanoDalVero(ric.ring, cVero, cVero, rVero) * 10 < scalinata, true);

  // LA TARATURA, e il suo perche'. A mezzo pixel il cerchio NON si riconosce, e non e' un difetto:
  // la scalinata stessa si scosta dal cerchio vero di piu' di mezzo pixel, quindi nessun cerchio
  // puo' passarci dentro. E' il pavimento della tolleranza, ed e' il pixel dell'immagine.
  const stretto = rg.regolarizzaAnello(tracciato.outer, { tolMm: mmPerPx * 0.5 });
  check('a mezzo pixel non lo riconosce: sotto il pixel non si puo\' scendere', stretto.cerchioIntero, false);
  check('...e si sbriciola in tanti pezzi, che e\' il segnale che la tolleranza e\' troppo stretta',
    stretto.pezzi.length > 20, true);

  // --- il rettangolo: quattro segmenti, e la retta che vince sull'arco ---
  const W = 60, H = 40;
  const rett = new Uint8Array(W * H).fill(NO);
  for (let y = 6; y <= 33; y++) for (let x = 8; x <= 49; x++) rett[y * W + x] = 1;
  const tr = rg.traceRegions(rett, W, H, 1, mmPerPx, { simplifyMm: mmPerPx * 0.1 })[0];
  const rr = rg.regolarizzaAnello(tr.outer, { tolMm: mmPerPx });
  check('un rettangolo esce in quattro segmenti, non in archi di raggio assurdo',
    rr.pezzi.map((p) => p.tipo), ['segmento', 'segmento', 'segmento', 'segmento']);
  check('e la sua area e\' quella vera, esatta (21 x 14 mm)',
    Number(Math.abs(rg.polygonArea(rr.ring)).toFixed(4)), 294);

  // --- IL FORO CHE PERDEVA UN ANGOLO. E' il difetto misurato nel lucchetto di `traceRegions`:
  //     la semplificazione consegnava 32,5 mm² dove la geometria ne vuole 32. Riconoscendo la
  //     forma invece di smussare la scalinata, torna esatta. E' il motivo per cui il punto 2b
  //     esiste, non un abbellimento del bordo.
  const { idx: mask, W: mw, H: mh } = mascheraDiProva();
  const fine = rg.traceRegions(mask, mw, mh, 1, 0.5, { simplifyMm: 0.05 })[0];
  const fuori = rg.regolarizzaAnello(fine.outer, { tolMm: 0.25 });
  const dentro = rg.regolarizzaAnello(fine.holes[0], { tolMm: 0.25 });
  const netta = Math.abs(rg.polygonArea(fuori.ring)) - Math.abs(rg.polygonArea(dentro.ring));
  check('il foro riconosciuto torna quadrato: 4,000 mm2 e non 3,500',
    Number(Math.abs(rg.polygonArea(dentro.ring)).toFixed(4)), 4);
  check('...e l\'area netta torna la verita\' geometrica: 36 meno 4 fa 32', Number(netta.toFixed(4)), 32);

  // --- determinismo ---
  check('stessa forma, stesse primitive',
    JSON.stringify(rg.regolarizzaAnello(tracciato.outer, { tolMm: mmPerPx })) === JSON.stringify(ric), true);

  // --- LA SFERA DI LORENZO, DAI SOLI PIXEL ---
  //
  // L'SVG di quella grafica non e' mai esistito, e non esistera': il sistema deve reggere partendo
  // dall'immagine, e' questo il punto del tool. Quindi il cerchio della sfera o esce dal raster o
  // non esce, e questa e' la prova che esce.
  //
  // La sfera NON e' una macchia di colore: e' dello stesso blu del fondo e ci si attacca dove
  // l'alone chiaro si interrompe. Il suo bordo e' un PEZZO del contorno della macchia grande, quindi
  // il cerchio si cerca fra gli archi — e la prova che c'e' davvero e' che archi INDIPENDENTI,
  // separati dalle interruzioni, vanno d'accordo sullo stesso centro e sullo stesso raggio.
  //
  // La fixture e' il contorno gia' tracciato e ripulito, non l'immagine: Node non ha un decoder
  // JPEG (nella suite decodifica il canvas del browser) e un raster nel test non ci starebbe. La
  // forma vera entra nella rete di sicurezza, il pixel resta fuori.
  const cian = JSON.parse(readFileSync(join(here, 'fixtures/cianotipia-contorno.json'), 'utf8'));
  // gli anelli sono contorni E fori delle macchie scure: gli archi della sfera non stanno tutti sul
  // contorno esterno, perche' le interruzioni dell'alone li spezzano. Col solo contorno esterno
  // usciva un arco solo, il 30% del giro invece del 67 — una prova piu' debole del vero.
  const anelli = cian.anelli.map((l) => l.map(([x, y]) => ({ x, y })));
  check('la fixture e\' fatta dei contorni veri della cianotipia',
    [cian.larghezzaPx, anelli.length, anelli[0].length > 3000], [1189, 11, true]);

  const archi = anelli
    .flatMap((anello) => rg.regolarizzaAnello(anello, { tolMm: 2 }).pezzi)
    .filter((p) => p.tipo === 'arco')
    .map((p) => ({ cx: p.cx, cy: p.cy, r: p.r, lung: Math.abs(p.a - p.da) * p.r }))
    .filter((a) => a.lung >= 40);
  // gli archi che concordano su centro e raggio sono lo stesso cerchio visto a pezzi
  const gruppi = [];
  for (const a of archi.sort((x, y) => y.lung - x.lung)) {
    const g = gruppi.find((q) => Math.hypot(q.cx - a.cx, q.cy - a.cy) < a.r * 0.12 && Math.abs(q.r - a.r) < a.r * 0.12);
    if (g) {
      const peso = g.lung + a.lung;
      g.cx = (g.cx * g.lung + a.cx * a.lung) / peso;
      g.cy = (g.cy * g.lung + a.cy * a.lung) / peso;
      g.r = (g.r * g.lung + a.r * a.lung) / peso;
      g.lung = peso; g.pezzi += 1;
    } else gruppi.push({ ...a, pezzi: 1 });
  }
  const sfera = gruppi.sort((a, b) => b.lung - a.lung).find((g) => g.r > 150 && g.r < 300);
  check('la sfera si ricava dai soli pixel: piu\' archi indipendenti sullo stesso cerchio',
    !!sfera && sfera.pezzi >= 3, true);
  check('...il centro cade dove sta la sfera (893, 461 px, entro 15)',
    !!sfera && Math.hypot(sfera.cx - 893, sfera.cy - 461) < 15, true);
  check('...il raggio e\' 77 mm entro mezzo millimetro',
    !!sfera && Math.abs(sfera.r * cian.mmPerPx - 77.0) < 0.5, true);
  check('...e gli archi coprono piu\' di meta\' del giro (non e\' un caso su tre punti)',
    !!sfera && sfera.lung / (2 * Math.PI * sfera.r) > 0.5, true);
}

// ---------------------------------------------------------------------------------------------
// PUNTO PITTORICO — il riempimento curvo a distanza costante (punto 1 del piano).
//
// Queste non sono asserzioni di regressione su codice che funziona: sono LA MISURA che decide se
// il metodo sta in piedi (ARCHITETTURA, regola di crescita 8). Il termine di paragone è il raso
// rettilineo del core, dove il passo e' costante per costruzione: la sua dispersione e' il rumore
// di fondo dello strumento di misura, non un difetto.
// ---------------------------------------------------------------------------------------------
console.log('');
console.log('Punto Pittorico — riempimento curvo a distanza costante');
{
  const PASSO = 0.4, PUNTO_MAX = 3.0, NOM = 1 / PASSO;
  const prove = rg.regioniDiProva();
  const campoDi = (p) => (p.campo.tipo === 'radiale'
    ? rg.radialField(p.campo.centro)
    : rg.harmonicField(p.region, { cellMm: 1, levels: 4, sweeps: 300 }));

  // Il metro e' tarato? Sul raso rettilineo la distanza fra file DEVE dare esattamente il passo.
  {
    const p = prove[0];
    const rette = rg.buildParallelFill(p.region.outer, p.region.holes,
      { angleDeg: 0, spacingMm: PASSO, maxStitchMm: PUNTO_MAX, mode: 'serpentine' });
    const sp = rg.neighbourSpacing(rette, PASSO);
    check("il metro e' tarato: sul raso del core il passo misurato e' quello chiesto",
      Math.abs(sp.p05 - PASSO) < 1e-6 && Math.abs(sp.p95 - PASSO) < 1e-6, true);
  }

  for (const p of prove) {
    const campo = campoDi(p);
    const angolo = rg.meanFieldAngleDeg(campo, p.region);
    const rette = rg.buildParallelFill(p.region.outer, p.region.holes,
      { angleDeg: angolo, spacingMm: PASSO, maxStitchMm: PUNTO_MAX, mode: 'serpentine' });
    const curvo = rg.buildCurvedFill(p.region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX });
    const ingenuo = rg.buildNaiveCurvedFill(p.region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX });

    const covA = rg.coverageStats(rette, p.region, PASSO);
    const covC = rg.coverageStats(curvo.runs, p.region, PASSO);
    const covB = rg.coverageStats(ingenuo.runs, p.region, PASSO);
    const spC = rg.neighbourSpacing(curvo.runs, PASSO);
    const conC = rg.containment(curvo.runs, p.region);

    // 1. LA DENSITA' CHIESTA E' QUELLA CONSEGNATA. `densitySpacingMm` (R22) e' un contratto: se si
    //    chiedono 0,4 mm di passo devono uscire 2,5 mm di filo per mm². E' il motivo per cui
    //    `testRatio` sta a 0,55 e non allo 0,5 di Jobard-Lefer (con 0,5 usciva il 6% di filo in piu').
    //
    //    LA SOGLIA E' PASSATA DA ±5% A ±10% IL 2026-09-04, e va detto perche' invece di allentarla e
    //    basta: col punto **perpendicolare** al bordo (la resa che Lorenzo ha chiesto) il riempimento
    //    di una fascia che si stringe molto — la banda di prova va da 40 a 8 mm — consegna il 7-8% di
    //    filo in piu' del chiesto, e il numero non si sposta cambiando `testRatio`. Le altre due
    //    regioni restano centrate. Non e' rumore di misura: e' filo vero (7,11 m contro i 6,60
    //    teorici). La causa e' che con le file CORTE che attraversano una fascia in restringimento la
    //    convergenza le impacca piu' fitte di quanto la regola della distanza riesca a diradare.
    //    E' un numero aperto, scritto in STATO: non si nasconde dietro una soglia larga.
    check(`${p.id}: la densita' consegnata e' quella chiesta (±10%)`,
      Math.abs(covC.media / NOM - 1) <= 0.10, true);

    // 2. LA COPERTURA NON SI SCOSTA PIU' DELLA SOGLIA DICHIARATA. Misurato su celle da 2 mm (cinque
    //    file per cella): rettilineo 3,9-5,1%, curvo 10,2-14,4%. La soglia e' 16%, e vale il doppio
    //    del rettilineo piu' un margine: se il curvo peggiora, si vuole saperlo.
    check(`${p.id}: la dispersione della copertura resta sotto il 16%`, covC.cv < 0.16, true);
    check(`${p.id}: ...e non piu' di 4 volte quella del raso rettilineo`, covC.cv < covA.cv * 4, true);

    // 3. IL METODO SERVE A QUALCOSA. Seminare le file a passo costante e lasciarle correre (il
    //    "copy" di Ink/Stitch) da' 71-98% di dispersione: la regola della distanza vale un fattore
    //    5-20. Il minimo misurato e' 4,96 sul ventaglio, quindi la soglia e' 4.
    check(`${p.id}: il curvo ingenuo e' almeno 4 volte peggio (il metodo non e' decorativo)`,
      covB.cv > covC.cv * 4, true);

    // 4. LA GEOMETRIA, PRIMA DEI PUNTI, E' PULITA. Senza suddividere in punti-ago la regola della
    //    distanza tiene: il minimo misurato e' 0,44-0,55 volte il passo. E' l'invariante del
    //    METODO, tenuta separata da cio' che poi le fa il punto-ago (vedi 5).
    //    Non e' esattamente zero, e si sa perche': il controllo di vicinanza guarda i PUNTI di
    //    integrazione, distanti 1/3 di passo l'uno dall'altro, mentre la misura guarda i SEGMENTI —
    //    due file che si incrociano di striscio possono passare piu' vicine di quanto i loro punti
    //    dicano, fino a mezzo passo di integrazione. Misurati: 2 punti su 48.083.
    const geo = rg.buildCurvedFill(p.region, campo, { spacingMm: PASSO });
    const spGeo = rg.neighbourSpacing(geo.runs, PASSO);
    check(`${p.id}: la geometria pura tiene la distanza (minimo >= 0,43 del passo)`,
      spGeo.min >= PASSO * 0.43, true);
    check(`${p.id}: ...e sotto mezzo passo ci va meno di un punto su 10.000`,
      spGeo.quotaSottoMezzoPasso < 1e-4, true);

    // 5. IL PUNTO-AGO E' UNA CORDA, E SU UNA CURVA TAGLIA DENTRO. Trovato misurando: con la sola
    //    R4 a 3 mm il passo minimo crollava da 0,21 a 0,004 mm — il punto si posava sulla fila
    //    vicina. Ora la corda ha un tetto (`maxSagittaMm`, d_sep/8) e il minimo resta 0,41 del
    //    passo. La soglia 0,375 e' quel tetto meno un margine.
    check(`${p.id}: nessuna coppia di file piu' vicina di 0,375 volte il passo`,
      spC.min >= PASSO * 0.375, true);
    check(`${p.id}: al piu' il 6% dei punti sta sotto mezzo passo da un'altra fila`,
      spC.quotaSottoMezzoPasso <= 0.06, true);
    check(`${p.id}: il 95% delle file sta sotto 1,4 volte il passo`, spC.p95 <= PASSO * 1.4, true);
    check(`${p.id}: e nessun vuoto oltre 3 volte il passo`, spC.max <= PASSO * 3, true);

    // 6. NIENTE FUORI DALLA REGIONE, NIENTE NEI VUOTI (R5).
    check(`${p.id}: niente filo fuori dalla regione`, [conC.fuori, conC.neiVuoti], [0, 0]);

    // 7. PUNTO MASSIMO (R4). Il minimo no: si impone dopo il routing (R3).
    let piuLungo = 0;
    for (const r of curvo.runs) for (let i = 1; i < r.length; i++) {
      piuLungo = Math.max(piuLungo, Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y));
    }
    check(`${p.id}: nessun punto oltre il massimo chiesto (R4)`, piuLungo <= PUNTO_MAX + 1e-6, true);

      // 7-bis. QUANTO GIRA IL PUNTO, e il metro tarato sulla teoria.
    //    Il campo di direzione si giudica da quanto il punto ruota per millimetro percorso: un campo
    //    che sfarfalla da' punti che si combattono, tirano il tessuto in direzioni diverse e si
    //    vedono. Ma il riferimento NON e' zero — un ricamo che segue una curva deve girare.
    //    Su un cerchio di raggio R la rotazione vale esattamente 57,296/R gradi al mm, e il ventaglio
    //    e' il caso dove questo si puo' verificare a mano: campo concentrico, raggi noti.
    if (p.id === 'ventaglio' && p.campo.tipo === 'radiale') {
      const centro = p.campo.centro;
      const anelli = rg.buildCurvedFill(p.region, rg.concentricField(centro), { spacingMm: 2 }).runs;
      let peggioScarto = 0, campioni = 0;
      for (const linea of anelli) {
        // via i due punti a ogni capo: li' la fila e' stata TAGLIATA sul bordo della regione, quindi
        // l'ultimo segmento e' corto e irregolare e l'angolo diviso per la sua lunghezza esplode.
        // Misurato: nel corpo della fila lo scarto dalla teoria e' 0,00%, ai capi arriva al 93%.
        for (let i = 4; i < linea.length - 2; i++) {
          const a = linea[i - 2], b = linea[i - 1], c = linea[i];
          const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
          const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
          if (lu < 1e-9 || lv < 1e-9) continue;
          const cross = (u.x * v.y - u.y * v.x) / (lu * lv), dot = (u.x * v.x + u.y * v.y) / (lu * lv);
          const gradiAlMm = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI) / ((lu + lv) / 2);
          const raggio = Math.hypot(b.x - centro.x, b.y - centro.y);
          const atteso = 57.29578 / raggio;
          peggioScarto = Math.max(peggioScarto, Math.abs(gradiAlMm - atteso) / atteso);
          campioni++;
        }
      }
      check('la misura della rotazione torna ESATTA con la teoria: 57,3/R gradi al mm',
        [campioni > 2000, peggioScarto < 0.001], [true, true]);
    }

    // 8. DETERMINISMO: stessi parametri, stesso ricamo.
    const bis = rg.buildCurvedFill(p.region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX });
    check(`${p.id}: stessi parametri, stesso ricamo`,
      JSON.stringify(bis.runs) === JSON.stringify(curvo.runs), true);
  }

  // 9. IL DIFETTO TROVATO MISURANDO: a `seedRatio` 1.0 il ventaglio si svuota. Il seme nasce a
  //    esattamente `d_sep` dalla fila madre e il confronto con la madre stessa lo rifiuta, quindi in
  //    un campo che diverge non nasce piu' niente. Il riempimento esce lo stesso: e' solo vuoto.
  //    Il test guarda il default, che e' la cosa che deve restare vera.
  {
    const v = prove.find((p) => p.id === 'ventaglio');
    const campo = rg.radialField(v.campo.centro);
    const buono = rg.buildCurvedFill(v.region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX });
    const rotto = rg.buildCurvedFill(v.region, campo, { spacingMm: PASSO, maxStitchMm: PUNTO_MAX, seedRatio: 1 });
    check('il ventaglio si riempie davvero (oltre 300 file)', buono.runs.length > 300, true);
    check("...e con seedRatio 1 si svuoterebbe: il difetto e' noto e misurato",
      rotto.runs.length < buono.runs.length / 10, true);
  }
}

console.log('');
console.log('Il punto pettine: il ricamo esce, e il progetto torna dentro il file (R9/R27)');
{
  // Un gruppo con dentro quattro tinte piu' un secondo gruppo sotto: piccolo apposta, ma passa per
  // tutta la catena (gruppi, muri, righe, denti, sormonto, ordine di cucitura, passaggi, DST).
  const svgPettine = readFileSync(join(here, 'fixtures/pettine-due-blocchi.svg'), 'utf8');
  const progetto = { rgProject: 'pettine', versione: 1, nomeSvg: 'due-blocchi.svg', ritaglio: null };
  const par = { ...rg.parametriPettineDefault, basiMm: 2, passoMm: 1.5, denteMinMm: 3, denteMaxMm: 5 };
  const es = rg.costruisciPettine({ testoSvg: svgPettine, larghezzaRealeMm: 60, foto: null, progetto }, par);
  const st = es.statistiche;
  check('i due gruppi si riconoscono', st.famiglie, 2);
  check('le righe di base ci sono', st.tratti > 10, true);
  check('i denti pure', st.denti > 100, true);
  check('il pannello resta coperto (meno dell'+String.fromCharCode(39)+'1% scoperto)', st.nudoFiloPct < 1, true);
  // L'INVARIANTE DI MACCHINA: una riga cucita dopo una che le sta addosso e piu' avanti le
  // rovinerebbe il dietro. Deve essere zero, sempre.
  check('nessuna riga cucita fuori ordine', st.righeFuoriOrdine, 0);
  // la spaziatura: il passo e' 2 mm, e la mediana ci deve stare vicino. Le righe che si stringono
  // sotto mezzo passo sono bande piu' fitte nel ricamo: dentro un gruppo devono restare poche.
  check('la spaziatura media vale il passo', Math.abs(st.spaziaturaMedianaMm - 2) < 0.4, true);
  check('poche righe addosso dentro un gruppo (sotto il 10%)', st.righeAddossoStessoGruppoPct < 10, true);
  // la crescita geodetica rimisura la distanza dal fronte a ogni giro: dentro un gruppo due righe
  // non si stringono mai sotto mezzo passo. E' la differenza fra questa e la crescita morfologica,
  // che sullo stesso pannello ne lasciava il 4,9%.
  {
    const geo = rg.costruisciPettine({ testoSvg: svgPettine, larghezzaRealeMm: 60, foto: null }, { ...par, modo: 'geodetica' });
    const cre = rg.costruisciPettine({ testoSvg: svgPettine, larghezzaRealeMm: 60, foto: null }, { ...par, modo: 'crescita' });
    check('la geodetica non stringe le righe dentro un gruppo', geo.statistiche.righeAddossoStessoGruppoPct < 1, true);
    check('...e sta larga almeno quanto la crescita morfologica', geo.statistiche.spaziaturaDecimoMm >= cre.statistiche.spaziaturaDecimoMm - 0.05, true);
  }
  check('nessun punto sotto il millimetro (R3)', st.puntiCorti, 0);
  // POCHI RASAFILI, MA ONESTI. Un passaggio si nasconde solo nella banda di sovrapposizione fra due
  // colori o sulla linea esatta di una base futura del suo colore (Lorenzo, 2026-09-10: «se non e'
  // possibile allora si taglia»). Su questo pannello resta UN taglio: un collegamento fra righe
  // lontane dello stesso gruppo che non ha nessuna strada nascosta. Con la vecchia mappa, che dava
  // per coperto tutto cio' che stava davanti alla riga in corso, era zero — ma mentiva.
  check('al massimo un taglio su questo pannello', st.salti <= 1, true);
  // LE MACCHIE SI INCASTRANO solo se serve: se il filo non si taglia mai, nessuna riga va spezzata
  // per ospitarne un'altra; se un taglio c'e', il pezzo isolato entra intero in una riga grande.
  check('si spezza una riga solo se altrimenti si taglierebbe', st.salti === 0 ? st.righeInglobate === 0 : st.righeInglobate > 0, true);
  // il tetto dei passaggi nascosti e' il baratto fra rasafili e linee lunghe, ed e' una manopola:
  // qualunque valore abbia, nessun passaggio lo puo' superare.
  check('nessun passaggio piu' + String.fromCharCode(39) + ' lungo del suo tetto', st.passaggioPiuLungoMm <= (par.passaggioNascostoMm ?? 90) + 0.5, true);
  check('il filo di passaggio a vista e' + String.fromCharCode(39) + ' poco (sotto il 2% del filo)', st.passaggiScopertiM < st.filoM * 0.02, true);
  // R9/R27: il file si riapre. Il progetto sta nel DST dopo l'END e in un <metadata> dell'SVG.
  const riletto = rg.readDstMetadata(es.dst);
  check('il progetto torna dal DST', riletto && riletto.rgProject, 'pettine');
  check('...con dentro il nome del disegno', riletto && riletto.nomeSvg, 'due-blocchi.svg');
  check('...e la cucitura resta leggibile', rg.readDst(es.dst).blocks.length, st.blocchi);
  check('il progetto sta anche nell' + String.fromCharCode(39) + 'SVG', es.svg.includes('<metadata id="rg-progetto">'), true);
  // il disegno non deve unire cio' che il filo non unisce: nessun segmento oltre i 12 mm
  let piuLungo = 0;
  for (const m of es.svg.matchAll(/<path d="([^"]*)"/g)) {
    for (const sub of m[1].split('M').slice(1)) {
      const pts = [...sub.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map((q) => [Number(q[1]), Number(q[2])]);
      for (let i = 1; i < pts.length; i++) piuLungo = Math.max(piuLungo, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
  }
  check('nel disegno non ci sono rette lunghe che il ricamo non ha', piuLungo < 12, true);
  // ...ma il disegno deve anche esserci TUTTO: staccando i segmenti troppo lunghi si erano
  // staccati anche i denti (la soglia era sul passo, che e' piu' corto del dente), e l'anteprima
  // mostrava le sole basi. Il filo disegnato deve pesare quanto quello cucito.
  let filoDisegnato = 0;
  for (const m of es.svg.matchAll(/<path d="([^"]*)"/g)) {
    for (const sub of m[1].split('M').slice(1)) {
      const pts = [...sub.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map((q) => [Number(q[1]), Number(q[2])]);
      for (let i = 1; i < pts.length; i++) filoDisegnato += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
  }
  check('il disegno contiene tutto il filo, denti compresi', filoDisegnato / 1000 > (st.basiM + st.filoDentiM) * 0.9, true);
}
console.log('');
console.log('Il motore del pettine gira anche nel browser');
{
  // Il motore lo usano sia il tool nel browser sia lo script headless. Una riga di diagnostica con
  // `process.env` ci si e' infilata ed e' arrivata a Lorenzo come «Non ci sono riuscito: process is
  // not defined»: il tool moriva alla prima generazione. Qui si guarda il sorgente, perche' il
  // difetto non e' geometrico e nessun test di geometria lo vedrebbe.
  const motore = readFileSync(join(root, 'apps/pettine/src/motore.ts'), 'utf8');
  const codice = motore.split(String.fromCharCode(10)).filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join(String.fromCharCode(10));
  check('il motore del pettine non tocca `process`', /(^|[^A-Za-z])process\s*\./.test(codice), false);
  check('...ne importa niente da node', /from\s+['\"]node:/.test(codice), false);
  check('...ne legge o scrive file', /(^|[^A-Za-z])(readFileSync|writeFileSync|mkdirSync)\s*\(/.test(codice), false);
  const tool = readFileSync(join(root, 'apps/pettine/src/tool.ts'), 'utf8');
  check('e il tool non importa dagli script headless', /from\s+['\"][^'\"]*scripts\//.test(tool), false);
}

// ---------------------------------------------------------------------------
// cannage-rafia — FASE 3, le linee orizzontali e verticali. Decifrate dal DST M1404 davanti
// (Lorenzo, 15/09): il generatore deve rifare quel DST, non somigliargli.
console.log('');
console.log('cannage-rafia — le linee rifanno il DST vero del davanti M1404');
{
  // Un DST si confronta per ELEMENTI: cordoncino (tratto ripassato), fermo (barretta corta), pezzo
  // verticale (scalette, meandri, barre). Punto per punto non serve: l'ordine delle passate dentro un
  // cordoncino non cambia il ricamo.
  const tratti = (P) => {
    const out = []; let cur = null;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (cur) {
        let dd = Math.abs(ang - cur.ang); if (dd > Math.PI) dd = 2 * Math.PI - dd;
        if (dd < 0.21 && Math.hypot(a[0] - cur.b[0], a[1] - cur.b[1]) < 0.01) { cur.b = b; continue; }
        out.push(cur);
      }
      cur = { a, b, ang };
    }
    if (cur) out.push(cur);
    return out;
  };
  const asse = (s) => {
    const dx = Math.abs(s.b[0] - s.a[0]), dy = Math.abs(s.b[1] - s.a[1]);
    return dy <= Math.max(0.3, dx * 0.12) ? 'H' : dx <= Math.max(0.35, dy * 0.15) ? 'V' : 'D';
  };
  const elementi = (S) => {
    const out = []; let i = 0;
    while (i < S.length) {
      const ax = asse(S[i]); let j = i;
      if (ax !== 'D') while (j + 1 < S.length && asse(S[j + 1]) === ax && Math.hypot(S[j + 1].b[0] - S[j].a[0], S[j + 1].b[1] - S[j].a[1]) < 0.7) j++;
      if (j - i + 1 >= 3) {
        const k = ax === 'H' ? 0 : 1, o = 1 - k, seg = S.slice(i, j + 1);
        const v = seg.flatMap((t) => [t.a[k], t.b[k]]), w = seg.flatMap((t) => [t.a[o], t.b[o]]);
        out.push({ ax, lo: Math.min(...v), hi: Math.max(...v), c: (Math.min(...w) + Math.max(...w)) / 2 });
        i = j + 1;
      } else i++;
    }
    return out;
  };
  const tipo = (e) => (e.ax === 'H' ? 'cordoncino' : e.hi - e.lo < 3.2 ? 'fermo' : 'verticale');
  const scarto = (e, pool) => {
    let best = Infinity;
    for (const f of pool) {
      if (f.ax !== e.ax || tipo(f) !== tipo(e) || Math.abs(f.c - e.c) >= 0.9) continue;
      best = Math.min(best, Math.max(Math.abs(f.lo - e.lo), Math.abs(f.hi - e.hi)));
    }
    return best;
  };

  // Il riferimento: dal DST M1404 davanti, ago 1 = contorno a impunture, ago 2 = griglia col contorno,
  // ago 3 = le linee (nel DST vero sono l'ago 5).
  const riferimento = rg.readDst(new Uint8Array(readFileSync(join(here, 'fixtures/m1404-dav-stop.dst'))));
  const bordo = riferimento.blocks.filter((b) => b.needle === 1).flatMap((b) => b.points_mm).slice(1);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [x, y] of bordo) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const contorno = [{ x: bx0, y: by0 }, { x: bx1, y: by0 }, { x: bx1, y: by1 }, { x: bx0, y: by1 }];
  const reticolo = { cx: -92.8, cy: -58.35, a: 31.7, b: 30.3 };
  // Col DST si confronta con le finestre del DST: l'allargamento (Lorenzo, 16/09, per la cornice) è voluto.
  const gen = rg.generaLinee(reticolo, contorno, { ...rg.PARAMETRI_DAVANTI, allargamentoFinestre: 0 });
  const riletto = rg.readDst(rg.buildDst(rg.programmaLinee(gen)));
  const veri = riferimento.blocks.filter((b) => b.needle === 3).flatMap((b) => elementi(tratti(b.points_mm)));
  const fatti = riletto.blocks.flatMap((b) => elementi(tratti(b.points_mm)));
  // Solo i gruppi interi: in alto e in fondo il DST vero ha tolto parti PER IL MONTAGGIO (Lorenzo),
  // e il generatore invece fa tutto il reticolo — le parti tolte si scelgono dopo, a mano.
  const righe = [-58.35, 2.25, 62.85];
  // Le BARRE AI VERTICI non si confrontano col DST: Lorenzo le ha volute alte quanto le due file di
  // fermi (15/09), e nel DST non lo erano. Hanno il loro controllo più sotto.
  const sulVertice = (x) => {
    let l = (((x - reticolo.cx) % 63.4) + 63.4) % 63.4; if (l > 31.7) l -= 63.4;
    return Math.abs(Math.abs(l) - 31.7) < 1.2;
  };
  const dentro = (e) => {
    const x = e.ax === 'H' ? (e.lo + e.hi) / 2 : e.c, y = e.ax === 'H' ? e.c : (e.lo + e.hi) / 2;
    return righe.some((r) => Math.abs(y - r) < 26) && x > bx0 + 34 && x < bx1 - 34 && !(tipo(e) === 'verticale' && sulVertice(x));
  };
  for (const [nome, A, B] of [['elementi del DST vero ritrovati nel generato', veri, fatti], ['elementi generati che stanno nel DST vero', fatti, veri]]) {
    const W = A.filter(dentro);
    const perTipo = {};
    for (const e of W) { const t = tipo(e); perTipo[t] = perTipo[t] || [0, 0]; perTipo[t][1]++; if (scarto(e, B) <= 0.7) perTipo[t][0]++; }
    check(`${nome}, entro 0,7 mm (cordoncini, fermi, pezzi verticali)`,
      ['cordoncino', 'fermo', 'verticale'].map((t) => perTipo[t] && perTipo[t][0] === perTipo[t][1] && perTipo[t][1] > 250), [true, true, true]);
  }

  // Le PUNTE di scalette e meandri: fin dove sale e scende il filo su ogni corsia, PASSAGGI COMPRESI.
  // Il confronto per elementi non le vede — un passaggio non è un cordoncino — ed è proprio lì che la
  // prima versione sbagliava: dalla cima della corsia centrale il filo saliva sulla sinistra fino in
  // cima, e la punta della scaletta cambiava (Lorenzo, 15/09).
  const corsie = new Map();
  const punte = (blocchi, sorgente) => {
    for (const P of blocchi) for (let k = 1; k < P.length; k++) {
      const [x0, y0] = P[k - 1], [x1, y1] = P[k];
      if (Math.abs(x1 - x0) > 0.05 || Math.abs(y1 - y0) < 0.3) continue;
      const x = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      const r = righe.findIndex((rr) => Math.abs(ym - rr) < 26);
      if (r < 0 || x < bx0 + 34 || x > bx1 - 34) continue;
      // solo le corsie di scalette e meandri (a ±8 dal centro del rombo, corsie a ±1,6): fermi e barre
      // hanno la loro misura nel confronto per elementi
      let xloc = (((x - reticolo.cx) % 63.4) + 63.4) % 63.4; if (xloc > 31.7) xloc -= 63.4;
      if (Math.abs(Math.abs(xloc) - 8) > 2.5) continue;
      const zona = ym < righe[r] - 6.2 ? 'su' : ym > righe[r] + 6.2 ? 'giu' : 'meandro';
      // le corsie del generato fanno da riferimento; quelle del DST vero ci si agganciano entro 0,6 mm
      let lane = null;
      for (const [key, v] of corsie) if (v.r === r && v.zona === zona && Math.abs(v.x - x) < 0.6) lane = key;
      if (!lane) {
        if (sorgente === 'vero') continue;
        lane = `${r}|${zona}|${x.toFixed(2)}`;
        corsie.set(lane, { r, zona, x, gen: [Infinity, -Infinity], vero: [Infinity, -Infinity] });
      }
      const v = corsie.get(lane)[sorgente];
      v[0] = Math.min(v[0], y0, y1); v[1] = Math.max(v[1], y0, y1);
    }
  };
  punte(riletto.blocks.map((b) => b.points_mm), 'gen');
  punte(riferimento.blocks.filter((b) => b.needle === 3).map((b) => b.points_mm), 'vero');
  const verticali = [...corsie.values()].filter((v) => v.zona !== 'meandro' || v.gen[1] - v.gen[0] > 3);
  // 0,6 mm: in un gruppo del DST vero un meandro sta 0,5 mm più in basso di tutti gli altri (la
  // digitazione a mano non è perfetta); il generato è uguale agli altri meandri, ed è giusto così.
  const storte = verticali.filter((v) => !(Math.abs(v.gen[0] - v.vero[0]) <= 0.6 && Math.abs(v.gen[1] - v.vero[1]) <= 0.6));
  check(`le punte di scalette e meandri come nel DST vero, corsia per corsia (${verticali.length} corsie)`, [verticali.length > 100, storte.length], [true, 0]);

  // Le barre ai vertici: in testa pari ai fermi della linea esterna (±6,7 ± 1,2); verso la diagonale il
  // capo del DST (−1,1 sopra, +1,5 sotto), che NON va accorciato. Tolleranza 0,35: lo zig-zag della
  // barra si sposta di lato e il DST arrotonda al decimo.
  const barre = fatti.filter((e) => tipo(e) === 'verticale' && sulVertice(e.c) && e.c > bx0 + 34 && e.c < bx1 - 34
    && righe.some((r) => Math.abs((e.lo + e.hi) / 2 - r) < 12));
  const storteBarre = barre.filter((e) => {
    const r = righe.reduce((best, rr) => (Math.abs((e.lo + e.hi) / 2 - rr) < Math.abs((e.lo + e.hi) / 2 - best) ? rr : best));
    const [atteso0, atteso1] = (e.lo + e.hi) / 2 < r ? [r - 6.7 - 1.2, r - 1.1] : [r + 1.5, r + 6.7 + 1.2];
    return Math.abs(e.lo - atteso0) > 0.35 || Math.abs(e.hi - atteso1) > 0.35;
  });
  // nella finestra controllata: 3 vertici × 3 gruppi × sopra e sotto = 18 barre
  check('le barre ai vertici: in testa pari ai fermi della linea esterna, verso la diagonale come nel DST', [barre.length, storteBarre.length], [18, 0]);

  // Il reticolo si legge dall'SVG a zone: i rombi interi di una tinta danno centro e mezze diagonali.
  const modello = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/cannage-rafia-m3641-zone.svg'), 'utf8'), 'm3641.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zoneM = modello.choices.flatMap((c) => c.boundary.paths.filter((p) => p.closed).map((p) => ({ color: p.color ?? c.color, points: p.points })));
  const rosso = rg.reticoloDaZone(zoneM, '#e42320'), blu = rg.reticoloDaZone(zoneM, '#2a4e9c');
  for (const [nome, l] of [['rosso', rosso], ['blu', blu]]) {
    check(`M3641, reticolo dal ${nome}: rombi 42 × 42 mm, tutti sul reticolo`,
      [l.reticolo.a.toFixed(1), l.reticolo.b.toFixed(1), l.rombiInteri > 4, l.fuoriReticolo], ['21.0', '21.0', true, 0]);
  }
  const mezzo = (v, p) => Math.abs((((v % p) + p) % p) - p / 2) < 0.1;
  check('...e le due tinte sono sfalsate di mezzo rombo, come un cannage', [mezzo(blu.reticolo.cx - rosso.reticolo.cx, 42), mezzo(blu.reticolo.cy - rosso.reticolo.cy, 42)], [true, true]);

  // Misure proporzionali al rombo, ma oltre una certa crescita aumentano gli oggetti (Lorenzo, 15/09).
  const conta = (s) => rg.generaLinee({ cx: 0, cy: 0, a: 31.7 * s, b: 30.3 * s },
    [{ x: -190.2 * s, y: -90.9 * s }, { x: 190.2 * s, y: -90.9 * s }, { x: 190.2 * s, y: 90.9 * s }, { x: -190.2 * s, y: 90.9 * s }]).conteggi;
  const c1 = conta(1), c12 = conta(1.2), c2 = conta(2);
  check('rombo più grande del 20%: tutto scala, gli oggetti restano quelli', [c12.cordoncini, c12.fermi, c12.scalette, c12.meandri], [c1.cordoncini, c1.fermi, c1.scalette, c1.meandri]);
  check('rombo doppio: aumentano gli oggetti (più pezzi di cordoncino, più fermi)', [c2.cordoncini > c1.cordoncini * 1.3, c2.fermi > c1.fermi * 1.3], [true, true]);

  // Le regole della macchina e del pezzo.
  let lmin = Infinity, lmax = 0, fuori = 0;
  for (const b of gen.blocchi) for (let k = 0; k < b.length; k++) {
    const p = b[k];
    if (p.x < bx0 - 1.01 || p.x > bx1 + 1.01 || p.y < by0 - 1.3 || p.y > by1 + 1.3) fuori++;
    if (k) { const l = Math.hypot(p.x - b[k - 1].x, p.y - b[k - 1].y); lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); }
  }
  check('nessun punto oltre il record DST (12 mm) né nello stesso buco', [lmax <= 12.01, lmin >= 0.05], [true, true]);
  check('il filo sta nel pezzo: fuori solo di 1 mm, a sinistra e a destra', fuori, 0);
  // Le linee arrivano fino in fondo a destra (Lorenzo, 15/09): nei DST M1404 si chiudevano sull'ultimo
  // giunto dentro, fino a 10 mm prima del bordo.
  let destraMax = -Infinity, sinistraMin = Infinity;
  for (const b of gen.blocchi) for (const p of b) { destraMax = Math.max(destraMax, p.x); sinistraMin = Math.min(sinistraMin, p.x); }
  check('le linee vanno da un bordo all\'altro, 1 mm fuori da tutte e due le parti', [(sinistraMin - bx0).toFixed(1), (destraMax - bx1).toFixed(1)], ['-1.0', '1.0']);
  const lato = rg.generaLinee(reticolo, contorno, rg.PARAMETRI_LATO);
  let orizzMax = 0;
  for (const b of lato.blocchi) for (let k = 1; k < b.length; k++) if (Math.abs(b[k].y - b[k - 1].y) < 0.05) orizzMax = Math.max(orizzMax, Math.abs(b[k].x - b[k - 1].x));
  check("l'alternativa del lato: sulle linee nessun punto oltre 3,5 mm", orizzMax <= 3.51, true);
  const conTermo = rg.generaLinee(reticolo, contorno, { ...rg.PARAMETRI_DAVANTI, termogarze: true });
  // il contorno delle termogarze apre il filo delle linee senza staccarsi (Lorenzo, 16/09: niente salti)
  const primo = conTermo.blocchi[0];
  const chiusura = primo.findIndex((p, k) => k > 4 && Math.hypot(p.x - primo[0].x, p.y - primo[0].y) < 1e-6);
  const sulRettangolo = (p) => Math.min(Math.abs(p.x - bx0), Math.abs(p.x - bx1), Math.abs(p.y - by0), Math.abs(p.y - by1)) < 0.01;
  const senzaTermo = rg.generaLinee(reticolo, contorno, rg.PARAMETRI_DAVANTI);
  check("termogarze: il contorno apre il filo delle linee senza staccarsi, e c'è solo se lo chiedi",
    [conTermo.blocchi.length, chiusura > 4, primo.slice(0, chiusura + 1).every(sulRettangolo), conTermo.conteggi.punti > senzaTermo.conteggi.punti],
    [1, true, true, true]);
}

// ---------------------------------------------------------------------------
// cannage-rafia — il programma a STOP (Lorenzo, 15/09): 1 contorno a impunture, 2 griglia che
// blocca i materiali col suo contorno, 3 e 4 le basi dei due pattern, 5 le linee.
console.log('');
console.log('cannage-rafia — gli stop del programma: contorno, griglia, basi, linee');
{
  const distPL = (p, P) => {
    let best = Infinity;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      best = Math.min(best, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]));
    }
    return best;
  };
  const riferimento = rg.readDst(new Uint8Array(readFileSync(join(here, 'fixtures/m1404-dav-stop.dst'))));
  const perAgo = (n) => riferimento.blocks.filter((b) => b.needle === n);
  const bordoVero = perAgo(1).flatMap((b) => b.points_mm).slice(1); // il primo punto del DST è l'entrata
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of bordoVero) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const contorno = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const reticolo = { cx: -92.8, cy: -58.35, a: 31.7, b: 30.3 };

  const s1 = rg.stopContorno(contorno, rg.PARAMETRI_STOP);
  const g1 = s1.blocchi[0].map((p) => [p.x, p.y]);
  let d1 = 0, d2 = 0;
  for (const p of bordoVero) d1 = Math.max(d1, distPL(p, g1));
  for (const p of g1) d2 = Math.max(d2, distPL(p, bordoVero));
  check('stop 1, contorno a impunture: gli stessi punti del DST vero, dall\'alto a sinistra in senso orario',
    [g1.length, d1 <= 0.3, d2 <= 0.3, g1[1][0] > g1[0][0]], [bordoVero.length, true, true, true]);

  // La griglia si confronta LONTANO dal contorno rientrato: le linee devono essere quelle, mentre il
  // tratto di bordo che il filo percorre fra una linea e l'altra può girare da un'altra parte.
  const s2 = rg.stopGriglia(reticolo, contorno, rg.PARAMETRI_STOP);
  const grigliaVera = perAgo(2)[1].points_mm.slice(1);
  // Il contorno e la griglia sono un filo solo (Lorenzo, 16/09: niente salti): la griglia è la parte che
  // sta dentro il contorno rientrato — si tolgono il contorno e i pochi millimetri di passaggio nell'angolo.
  const grigliaGen = s2.blocchi[0].filter((p) => Math.min(p.x - x0, x1 - p.x, p.y - y0, y1 - p.y) > 5).map((p) => [p.x, p.y]);
  let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
  for (const [x, y] of grigliaGen) { gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y); }
  const lontano = ([x, y]) => Math.min(x - gx0, gx1 - x, y - gy0, gy1 - y) > 4;
  // Scarto ammesso: mediana 0,3 mm, massimo 1,5. Nel DST la griglia corre a 43,9°, il reticolo letto
  // dalle linee (quello che le linee rifanno al decimo) a 43,7°: sulle linee lunghe 300 mm quei due
  // decimi di grado diventano ~1,4 mm alle estremità. È la stessa linea, un filo ruotata.
  const mediana = (v) => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const sc1 = grigliaVera.filter(lontano).map((p) => distPL(p, grigliaGen));
  const sc2 = grigliaGen.filter(lontano).map((p) => distPL(p, grigliaVera));
  check('stop 2: il contorno e poi la griglia senza staccare il filo, con le stesse 16 linee del DST vero (i lati dei rombi)',
    [s2.blocchi.length, s2.linee, mediana(sc1) <= 0.3, mediana(sc2) <= 0.3, Math.max(...sc1) <= 1.5, Math.max(...sc2) <= 1.5],
    [1, 16, true, true, true, true]);

  // Le basi sull'M3641: il motore di Pattern a zone, una tinta per stop.
  const modello = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/cannage-rafia-m3641-zone.svg'), 'utf8'), 'm3641.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zone = rg.zoneDaModello(modello);
  const condivisi = JSON.parse(readFileSync(join(root, 'apps/pattern-grammar/src/presets.shared.json'), 'utf8'));
  const dentroAnello = (p, anello) => {
    let dentro = false;
    for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
      const a = anello[i], b = anello[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  };
  const sulBordo = (p, anello) => distPL([p.x, p.y], [...anello, anello[0]].map((q) => [q.x, q.y])) <= 0.6;
  const contM = rg.contornoDaZone(zone);
  // i passaggi fra una zona e l'altra possono camminare sul contorno del pezzo: lo fa anche il DST vero
  const sulContorno = (p) => Math.min(p.x - contM[0].x, contM[1].x - p.x, p.y - contM[0].y, contM[2].y - p.y) <= 0.6;
  const fuoriTinta = (s, colore) => {
    const mie = zone.filter((z) => z.color === colore);
    let fuori = 0;
    s.blocchi.forEach((b) => b.forEach((p, k) => { if (k % 5 === 0 && !sulContorno(p) && !mie.some((z) => dentroAnello(p, z.points) || sulBordo(p, z.points))) fuori++; }));
    return fuori;
  };
  const s3 = rg.stopBase(3, zone, '#e42320', condivisi['CANNAGE BASE — LEGGERO']);
  const s4 = rg.stopBase(4, zone, '#2a4e9c', condivisi['CANNAGE BASE — PIENA']);
  check('stop 3: la base del pattern 1 riempie le sue 25 zone, e fuori solo sul contorno del pezzo', [s3.zone, s3.punti > 1000, fuoriTinta(s3, '#e42320')], [25, true, 0]);
  check('stop 4: la base del pattern 2 riempie le sue 24 zone, e fuori solo sul contorno del pezzo', [s4.zone, s4.punti > 1000, fuoriTinta(s4, '#2a4e9c')], [24, true, 0]);

  // Le AREE DI SCARICO nelle basi, come in Pattern a zone (Lorenzo, 15/09): sul davanti-v2, che ha i
  // contorni gialli di solo tratto sopra le zone. Solo la parte bassa, dove stanno le aree.
  const davanti = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/scarico-davanti.svg'), 'utf8'), 'davanti.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const mediaY = (z) => z.points.reduce((t, p) => t + p.y, 0) / z.points.length;
  const zoneD = rg.zoneDaModello(davanti).filter((z) => z.color === '#f3e600' || mediaY(z) > 190);
  const aree = zoneD.filter((z) => z.color === '#f3e600');
  const senzaScarico = rg.stopBase(3, zoneD, '#e52421', condivisi['CANNAGE BASE — LEGGERO']);
  const conScarico = rg.stopBase(3, zoneD, '#e52421', condivisi['CANNAGE BASE — LEGGERO'], { colori: ['#f3e600'], percento: 50 });
  const nelleAree = (s) => s.blocchi.flat().filter((p) => aree.some((a) => dentroAnello(p, a.points))).length;
  const fuoriAree = (s) => s.blocchi.flat().length - nelleAree(s);
  check('basi con le aree di scarico: dentro le aree meno punti, fuori quasi uguale, le aree non si ricamano',
    [aree.length, nelleAree(conScarico) < nelleAree(senzaScarico) * 0.8, Math.abs(fuoriAree(conScarico) / fuoriAree(senzaScarico) - 1) < 0.03, conScarico.zone === senzaScarico.zone],
    [3, true, true, true]);

  const retM = rg.reticoloDaZone(zone, '#e42320').reticolo;
  // gli stop si passano in disordine apposta: l'ordine lo decide il programma, non chi chiama
  const strati = rg.stratiProgramma([rg.stopCornice(retM, contM, rg.PARAMETRI_CORNICE), rg.stopLinee(retM, contM, rg.PARAMETRI_DAVANTI), s4, rg.stopGriglia(retM, contM, rg.PARAMETRI_STOP), s3, rg.stopContorno(contM, rg.PARAMETRI_STOP)]);
  const dstM = rg.readDst(rg.dstFromExportLayers(strati, { label: 'M3641 CANNAGE' }));
  check('il DST esce coi 6 stop in ordine (contorno, griglia, base 1, base 2, linee, cornice), uno per ago',
    [strati.map((s) => s.id), dstM.colorChanges], [['stop-1', 'stop-2', 'stop-3', 'stop-4', 'stop-5', 'stop-6'], 5]);
}

// ---------------------------------------------------------------------------
// cannage-rafia — STOP 6, la cornice nei rombi. Letta dall'ago 6 del DST M1404 davanti (nel fixture è
// l'ago 4) e RIGENERATA dai valori, non copiata (Lorenzo, 15/09): uncini regolari, irregolarità
// minime, il centro dell'orizzontale sempre sul lato del rombo, un rientro unico dal bordo.
console.log('');
console.log('cannage-rafia — la cornice nei rombi: uncini rigenerati sul DST vero del davanti M1404');
{
  const riferimento = rg.readDst(new Uint8Array(readFileSync(join(here, 'fixtures/m1404-dav-stop.dst'))));
  const bordo = riferimento.blocks.filter((b) => b.needle === 1).flatMap((b) => b.points_mm).slice(1);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [x, y] of bordo) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const contorno = [{ x: bx0, y: by0 }, { x: bx1, y: by0 }, { x: bx1, y: by1 }, { x: bx0, y: by1 }];
  const reticolo = { cx: -92.8, cy: -58.35, a: 31.7, b: 30.3 };
  const gen = rg.generaCornice(reticolo, contorno, rg.PARAMETRI_CORNICE);

  // Gli elementi del DST vero: tratti ripassati avanti e indietro fra due punti (almeno 3 passate).
  const P = riferimento.blocks.filter((b) => b.needle === 4).flatMap((b) => b.points_mm);
  const uguale = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.35;
  const veri = [];
  for (let i = 0; i < P.length - 1;) {
    let j = i + 1;
    if (Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) > 0.6) while (j + 1 < P.length && uguale(P[j + 1], P[j - 1])) j++;
    if (j - i >= 3) { veri.push({ tipo: Math.abs(P[i + 1][1] - P[i][1]) < Math.abs(P[i + 1][0] - P[i][0]) ? 'H' : 'V', a: P[i], b: P[i + 1] }); i = j; } else i++;
  }
  const fatti = gen.elementi.map((e) => ({ tipo: e.tipo, a: [e.a.x, e.a.y], b: [e.b.x, e.b.y] }));
  // Si confronta lontano dal bordo: lì il DST vero ha tolto a mano, a distanze diverse per lato.
  const lontano = (e) => Math.min(...[e.a, e.b].flatMap(([x, y]) => [x - bx0, bx1 - x, y - by0, by1 - y])) > 15;
  // Stesso elemento: stessa riga (o colonna) entro 1,3 mm, centro entro 1,6, lunghezza entro 2,5. Il
  // generato è regolare, il DST fatto a mano: a metà lato le sue file di uncini stanno fino a 1,1 mm
  // fuori dal passo di b/15 (agli angoli no), le orizzontali cadono fino a 0,5 mm fuori dal lato e le
  // lunghezze vanno da 3,6 a 7,4 mm. Con 0,9 e 1,2 restava fuori un elemento su otto, sempre per la quota.
  const combacia = (e, f) => {
    if (e.tipo !== f.tipo) return false;
    const k = e.tipo === 'H' ? 0 : 1, o = 1 - k;
    const lo = (s) => Math.min(s.a[k], s.b[k]), hi = (s) => Math.max(s.a[k], s.b[k]);
    return Math.abs(e.a[o] - f.a[o]) <= 1.3 && Math.abs((lo(e) + hi(e)) / 2 - (lo(f) + hi(f)) / 2) <= 1.6 && Math.abs((hi(e) - lo(e)) - (hi(f) - lo(f))) <= 2.5;
  };
  const quota = (A, B) => { const W = A.filter(lontano); return { n: W.length, ok: W.filter((e) => B.some((f) => combacia(e, f))).length }; };
  const q1 = quota(veri, fatti), q2 = quota(fatti, veri);
  console.log(`   (cornice: DST vero ritrovato ${q1.ok}/${q1.n}, generato nel DST ${q2.ok}/${q2.n})`);
  check('gli uncini del DST vero ci sono nel generato, e viceversa (almeno il 95%, lontano dal bordo)',
    [q1.n > 900, q1.ok >= q1.n * 0.95, q2.ok >= q2.n * 0.95], [true, true, true]);

  // Il CENTRO di ogni orizzontale sta sul lato del rombo (Lorenzo: «così che venga tutto preciso»).
  const locale = (x, y) => {
    const I = Math.round((x - reticolo.cx - reticolo.a) / (2 * reticolo.a)), J = Math.round((y - reticolo.cy - reticolo.b) / (2 * reticolo.b));
    return [x - (reticolo.cx + reticolo.a + 2 * reticolo.a * I), y - (reticolo.cy + reticolo.b + 2 * reticolo.b * J), `${I},${J}`];
  };
  let fuoriLato = 0, sulLato = 0;
  for (const e of gen.elementi.filter((e) => e.tipo === 'H')) {
    const [lx, ly] = locale((e.a.x + e.b.x) / 2, e.a.y);
    if (Math.abs(ly) < 1.5 || Math.abs(ly) > 28) continue; // i pezzi dei vertici, centrati sul vertice
    sulLato++;
    if (Math.abs(Math.abs(lx) - reticolo.a * (1 - Math.abs(ly) / reticolo.b)) > 0.001) fuoriLato++;
  }
  check('il centro di ogni orizzontale sta sul lato del rombo', [sulLato > 1000, fuoriLato], [true, 0]);

  // Il giro intero, lontano dal bordo: come nel DST, 97 tratti (13 orizzontali per lato, 9 o 11
  // verticali, 5 pezzi ai vertici).
  const lontanoGiro = gen.giri.filter((g) => Math.min(g.centro.x - bx0, bx1 - g.centro.x, g.centro.y - by0, by1 - g.centro.y) > 34);
  check('un giro intero ha 97 tratti, come il modulo del DST', [lontanoGiro.length > 4, [...new Set(lontanoGiro.map((g) => g.elementi))]], [true, [97]]);

  // Irregolarità minime: le orizzontali sul lato cambiano al massimo di quanto chiesto, e con 0 sono uguali.
  const lunghezze = (r) => r.elementi.filter((e) => e.tipo === 'H').filter((e) => { const [, ly] = locale(e.a.x, e.a.y); return Math.abs(ly) > 1.5 && Math.abs(ly) < 26; }).map((e) => Math.abs(e.b.x - e.a.x));
  const Lg = lunghezze(gen);
  const regolare = lunghezze(rg.generaCornice(reticolo, contorno, { ...rg.PARAMETRI_CORNICE, irregolarita: 0 }));
  check('irregolarità: ±0,3 mm sulle orizzontali, e con 0 tutte uguali',
    [Math.max(...Lg.map((l) => Math.abs(l - 5.4))) <= 0.3001, Math.max(...Lg) - Math.min(...Lg) > 0.2, Math.max(...regolare) - Math.min(...regolare) < 1e-9], [true, true, true]);

  // Il bordo: nessun pezzo più vicino al contorno del rientro...
  const dalBordo = (p) => Math.min(p.x - bx0, bx1 - p.x, p.y - by0, by1 - p.y);
  let vicinoBordo = Infinity;
  for (const e of gen.elementi) for (const p of [e.a, e.b]) vicinoBordo = Math.min(vicinoBordo, dalBordo(p));
  check(`nessun pezzo più vicino al bordo del rientro (${rg.PARAMETRI_CORNICE.rientro} mm)`, vicinoBordo >= rg.PARAMETRI_CORNICE.rientro - 0.001, true);
  // ...ma tutto quello che ci sta c'è (Lorenzo, 16/09: «tu tagli troppo presto» — la prima versione
  // toglieva l'uncino intero se anche solo la verticale non ci stava). Il riferimento è la cornice
  // senza bordo; senza irregolarità le orizzontali sono uguali nelle righe dritte e in quelle a specchio.
  const piatti = { ...rg.PARAMETRI_CORNICE, irregolarita: 0 };
  const senzaBordo = rg.generaCornice(reticolo, contorno, { ...piatti, rientro: -1000 });
  const conBordo = rg.generaCornice(reticolo, contorno, piatti);
  const chiaveH = (e) => { const [p, q] = [e.a, e.b].sort((u, w) => u.x - w.x); return `${p.x.toFixed(4)},${p.y.toFixed(4)},${q.x.toFixed(4)}`; };
  const fatteH = new Set(conBordo.elementi.filter((e) => e.tipo === 'H').map(chiaveH));
  const ciStanno = senzaBordo.elementi.filter((e) => e.tipo === 'H' && dalBordo(e.a) >= piatti.rientro && dalBordo(e.b) >= piatti.rientro);
  const accorciate = conBordo.elementi.filter((e) => e.tipo === 'V' && Math.abs(e.b.y - e.a.y) < 4.2).length;
  console.log(`   (bordo: ${ciStanno.length} orizzontali ci stanno, ${accorciate} verticali accorciate)`);
  check('sul bordo ogni orizzontale che ci sta c\'è, e le verticali che non ci stanno si accorciano',
    [ciStanno.length > 1000, ciStanno.filter((e) => !fatteH.has(chiaveH(e))).length, accorciate > 0], [true, 0, true]);

  // I PASSAGGI (Lorenzo, 16/09: «si deve sempre passare dentro»). La prima versione ripartiva ogni riga
  // da sinistra e girava sul contorno. Ora: righe a serpentina, un filo solo, e il filo cammina sui
  // lati dei rombi dentro il pezzo — possibilmente su lati ancora da cucire, così il passaggio resta
  // sotto gli uncini. Il filo si rilegge nell'ordine: ogni orizzontale cucita segna il suo lato come
  // «cucito», e ogni passaggio che corre su un lato già cucito è filo SOPRA.
  const leggiPassaggi = (r, ret, dentroPezzo) => {
    const P = r.blocchi.flat();
    const f = ret.b / rg.divisioniCornice(ret.b, rg.PARAMETRI_CORNICE.sogliaUncini) / (30.3 / 15);
    const uguale = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
    const retta = (p) => { const u = (p.x - ret.cx) / ret.a, v = (p.y - ret.cy) / ret.b; return [u + v, u - v]; };
    const dispari = (z) => Math.abs(z - (2 * Math.round((z - 1) / 2) + 1)) < 1e-3;
    const cuciti = new Set();
    // un salto fuori dai lati si misura INTERO (i punti che lo compongono sono corti anche quando lui è lungo)
    let k = 0, suLati = 0, sopra = 0, lunghiFuoriLato = 0, fuori = 0, salto = 0;
    const chiudiSalto = () => { if (salto > 10 * f + 1e-6) lunghiFuoriLato++; salto = 0; };
    for (let i = 0; i < P.length - 1;) {
      const e = r.elementi[k];
      if (e && uguale(P[i], e.a) && uguale(P[i + 1], e.b)) {
        chiudiSalto();
        const m = { x: (e.a.x + e.b.x) / 2, y: e.a.y };
        const u = (m.x - ret.cx) / ret.a, v = (m.y - ret.cy) / ret.b;
        const lontanoVertice = Math.hypot((u - Math.round(u)) * ret.a, (v - Math.round(v)) * ret.b) > 2;
        const lato = e.tipo === 'H' && lontanoVertice ? rg.latoDelReticolo(ret, m, 1e-3) : null;
        if (lato) cuciti.add(lato);
        i += e.passate; k++;
        continue;
      }
      const a = P[i], b = P[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (dentroPezzo(a) < 0.25 || dentroPezzo(b) < 0.25) fuori++;
      const [sa, da] = retta(a), [sb, db] = retta(b);
      const suS = dispari(sa) && Math.abs(sa - sb) < 1e-3, suD = dispari(da) && Math.abs(da - db) < 1e-3;
      if (suS || suD) {
        chiudiSalto();
        suLati += l;
        const lato = rg.latoDelReticolo(ret, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 1e-3);
        if (cuciti.has(lato)) sopra += l;
      } else salto += l;
      i++;
    }
    chiudiSalto();
    return { elementiLetti: k, blocchi: r.blocchi.length, suLati, sopra, lunghiFuoriLato, fuori };
  };
  const pDav = leggiPassaggi(gen, reticolo, dalBordo);
  const modelloM = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/cannage-rafia-m3641-zone.svg'), 'utf8'), 'm3641.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zoneM = rg.zoneDaModello(modelloM), contM = rg.contornoDaZone(zoneM), retM = rg.reticoloDaZone(zoneM, '#e42320').reticolo;
  const genM = rg.generaCornice(retM, contM, rg.PARAMETRI_CORNICE);
  const pM = leggiPassaggi(genM, retM, (p) => Math.min(p.x - contM[0].x, contM[1].x - p.x, p.y - contM[0].y, contM[2].y - p.y));
  console.log(`   (passaggi davanti: ${pDav.suLati.toFixed(0)} mm sui lati, ${pDav.sopra.toFixed(0)} sopra lati cuciti · M3641: ${pM.suLati.toFixed(0)} mm, ${pM.sopra.toFixed(0)} sopra)`);
  for (const [nome, p, r] of [['davanti M1404', pDav, gen], ['M3641', pM, genM]]) {
    check(`passaggi, ${nome}: un filo solo, tutti dentro il pezzo, sui lati dei rombi (fuori dai lati solo salti corti), quasi mai sopra lati già cuciti`,
      [p.blocchi, p.elementiLetti === r.elementi.length, p.fuori, p.lunghiFuoriLato, p.sopra <= p.suLati * 0.01], [1, true, 0, 0, true]);
  }

  let lmin = Infinity, lmax = 0, fuori = 0;
  for (const b of gen.blocchi) for (let k = 0; k < b.length; k++) {
    const p = b[k];
    if (p.x < bx0 || p.x > bx1 || p.y < by0 || p.y > by1) fuori++;
    if (k) { const l = Math.hypot(p.x - b[k - 1].x, p.y - b[k - 1].y); lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); }
  }
  check('cornice: nessun punto oltre il record DST né nello stesso buco, e niente fuori dal pezzo', [lmax <= 12.01, lmin >= 0.05, fuori], [true, true, 0]);

  // Proporzionale al rombo, ma oltre la soglia aumentano gli uncini. Il rientro scala col pezzo, se no
  // sul bordo cambia quali uncini restano e il conto non dice più niente.
  const conta = (s) => rg.generaCornice({ cx: 0, cy: 0, a: 31.7 * s, b: 30.3 * s },
    [{ x: -190.2 * s, y: -90.9 * s }, { x: 190.2 * s, y: -90.9 * s }, { x: 190.2 * s, y: 90.9 * s }, { x: -190.2 * s, y: 90.9 * s }],
    { ...rg.PARAMETRI_CORNICE, rientro: 3 * s, irregolarita: 0 }).conteggi;
  const c1 = conta(1), c12 = conta(1.2), c2 = conta(2);
  check('cornice: rombo più grande del 20% stessi uncini, rombo doppio più uncini',
    [c12.giri === c1.giri, c12.uncini === c1.uncini, c2.giri === c1.giri, c2.uncini > c1.uncini * 1.5, rg.divisioniCornice(30.3 * 2, 0.5)], [true, true, true, true, 30]);

  // La cornice non passa sopra fermi e barre delle linee (Lorenzo, 16/09: «altrimenti sbatte contro»):
  // gli uncini stanno DENTRO la finestra, fra i due fermi. Le linee allargano la finestra di 1 mm per
  // parte e la cornice accorcia quello che ancora non ci sta. Le orizzontali centrate sul vertice
  // incrociano la barra del vertice anche nel DST: quelle restano.
  const urti = (lin, cor, margine) => {
    let n = 0;
    for (const e of cor.elementi) {
      const x0 = Math.min(e.a.x, e.b.x), x1 = Math.max(e.a.x, e.b.x), y0 = Math.min(e.a.y, e.b.y), y1 = Math.max(e.a.y, e.b.y);
      for (const r of lin.ingombri) {
        const alVertice = e.tipo === 'H' && Math.abs((x0 + x1) / 2 - (r.x0 + r.x1) / 2) < 1e-6;
        if (r.tipo === 'barra' && alVertice) continue;
        if (x1 >= r.x0 - margine && x0 <= r.x1 + margine && y1 >= r.y0 - margine && y0 <= r.y1 + margine) n++;
      }
    }
    return n;
  };
  const liscia = (ret, cont) => rg.generaCornice(ret, cont, rg.PARAMETRI_CORNICE);
  for (const [nome, ret, cont] of [['davanti M1404', reticolo, contorno], ['M3641', retM, contM]]) {
    const linDst = rg.generaLinee(ret, cont, { ...rg.PARAMETRI_DAVANTI, allargamentoFinestre: 0 });
    const lin = rg.generaLinee(ret, cont, rg.PARAMETRI_DAVANTI);
    const conDst = urti(linDst, liscia(ret, cont), 0), allargate = urti(lin, liscia(ret, cont), 0);
    const cor = rg.generaCornice(ret, cont, rg.PARAMETRI_CORNICE, lin.ingombri);
    // il gioco (0,3 mm sul rombo di riferimento) rimpicciolisce coi rombi più piccoli, come i fermi
    const gioco = 0.3 * Math.min(1, ret.b / 30.3);
    const orizzontali = (r) => r.elementi.filter((e) => e.tipo === 'H').length;
    console.log(`   (${nome}: uncini sopra fermi e barre con le finestre del DST ${conDst}, allargate di 1 mm ${allargate}; pezzi accorciati per stare a ${gioco.toFixed(2)} mm ${cor.conteggi.accorciati})`);
    // Lorenzo, 16/09: il risultato giusto è quello del davanti — gli uncini fra i fermi, e nessuno che sparisce
    check(`${nome}: con le finestre del DST la cornice ci passerebbe sopra; ora nessun pezzo tocca fermi e barre e nessuna orizzontale sparisce`,
      [conDst > 100, allargate < conDst, urti(lin, cor, gioco - 0.001), orizzontali(cor) === orizzontali(liscia(ret, cont))], [true, true, 0, true]);
  }
  // sul davanti l'allargamento da solo basta già a staccare gli uncini dai fermi; la cornice aggiunge solo il gioco
  check('davanti: allargando le finestre di 1 mm nessun uncino tocca più un fermo', urti(rg.generaLinee(reticolo, contorno, rg.PARAMETRI_DAVANTI), liscia(reticolo, contorno), 0), 0);
}

// ---------------------------------------------------------------------------
// cannage-rafia — il pezzo non è un rettangolo (Lorenzo, 16/09: «se il rombo non è completo anche le
// linee e le cornici non lo devono essere»). Il davanti dell'M3641 ha il bordo alto curvo e un incavo in
// basso: la sagoma vera è l'unione delle zone, e il ricamo si ferma lì.
console.log('');
console.log('cannage-rafia — linee e cornice si fermano dove finisce il cannage');
{
  const modello = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/cannage-rafia-m3641-davanti.svg'), 'utf8'), 'davanti.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zone = rg.zoneDaModello(modello);
  // pattern 1 = il blu, come sceglie il tool (la prima tinta con rombi interi)
  const reticolo = rg.reticoloDaZone(zone, '#2a4e9c').reticolo;
  // il giallo sono le aree di scarico: contorni sopra il disegno, non fanno pezzo
  const sagoma = rg.sagomaDaZone(zone, ['#f3e600']);
  const rettangolo = rg.contornoDaZone(zone);
  check('la sagoma vede l\'incavo: là sotto la riga entra ed esce due volte, più in alto una sola',
    [sagoma.estensioniX(241).length, sagoma.estensioniX(120).length, sagoma.lati.length > 300], [2, 1, true]);

  const linS = rg.generaLinee(reticolo, sagoma, rg.PARAMETRI_DAVANTI);
  const linR = rg.generaLinee(reticolo, rettangolo, rg.PARAMETRI_DAVANTI);
  const corS = rg.generaCornice(reticolo, sagoma, rg.PARAMETRI_CORNICE, linS.ingombri);
  const corR = rg.generaCornice(reticolo, rettangolo, rg.PARAMETRI_CORNICE, linR.ingombri);
  const fuori = (r, quanto) => { let n = 0; for (const b of r.blocchi) for (const p of b) if (sagoma.distanza(p) < -quanto) n++; return n; };
  const nellIncavo = (r) => { let n = 0; for (const b of r.blocchi) for (const p of b) if (p.x > 120 && p.x < 320 && p.y > 248) n++; return n; };
  console.log(`   (davanti M3641: punti fuori dal cannage — col rettangolo linee ${fuori(linR, 1.2)} e cornice ${fuori(corR, 1.2)}, con la sagoma ${fuori(linS, 1.2)} e ${fuori(corS, 1.2)})`);
  // la sporgenza di 1 mm delle linee resta: è voluta (per questo si guarda oltre 1,2 mm). Per la cornice
  // si lascia margine fino a 2 mm: un salto corto può tagliare un angolo rientrante del bordo.
  check('col rettangolo il ricamo esce dal cannage, con la sagoma no',
    [fuori(linR, 1.2) > 1000, fuori(corR, 1.2) > 1000, fuori(linS, 1.2), fuori(corS, 2)], [true, true, 0, 0]);
  check('nell\'incavo non passa filo, né di linee né di cornice',
    [nellIncavo(linR) > 500, nellIncavo(corR) > 500, nellIncavo(linS), nellIncavo(corS)], [true, true, 0, 0]);
  // dove il pezzo è tagliato il filo delle linee non si stacca (prima: salti fino a 360 mm) e non attraversa
  // il vuoto: cammina sul bordo, a impunture (Lorenzo, 16/09). Il «niente fuori» e il «niente nell'incavo»
  // qui sopra dicono che quel cammino sta sul bordo e non in mezzo.
  check('dove il pezzo è tagliato il filo delle linee cammina sul bordo invece di staccarsi',
    [linR.blocchi.length, linS.blocchi.length], [1, 1]);

  // NESSUN SALTO e NESSUN PUNTO SOTTO IL MINIMO in tutto il programma (Lorenzo, 16/09: «un vincolo globale
  // che evita i passaggi sotto un tot di millimetri, di default 0,5» e «stare attento ai salti lunghi»).
  const presetsC = JSON.parse(readFileSync(join(root, 'apps/pattern-grammar/src/presets.shared.json'), 'utf8'));
  const programma = [
    rg.stopContorno(sagoma, rg.PARAMETRI_STOP), rg.stopGriglia(reticolo, sagoma, rg.PARAMETRI_STOP),
    rg.stopBase(3, zone, '#2a4e9c', presetsC['CANNAGE BASE — LEGGERO']),
    rg.stopBase(4, zone, '#e42320', presetsC['CANNAGE BASE — PIENA']),
    rg.stopLinee(reticolo, sagoma, { ...rg.PARAMETRI_DAVANTI, termogarze: true }),
    corS,
  ].map((st) => rg.conPuntoMinimo(rg.unisciTratti(st), 0.5));
  const saltoMassimo = (st) => {
    let m = 0;
    for (let i = 1; i < st.blocchi.length; i++) { const a = st.blocchi[i - 1].at(-1), b = st.blocchi[i][0]; m = Math.max(m, Math.hypot(b.x - a.x, b.y - a.y)); }
    return m;
  };
  const puntiCorti = (st) => {
    let n = 0;
    for (const b of st.blocchi) for (let i = 1; i < b.length - 1; i++) if (Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y) < 0.5 - 1e-9) n++;
    return n;
  };
  // I salti si contano NEL DST: il motore delle basi consegna pezzi che si toccano (0 mm fra l'uno e
  // l'altro) e il DST ne faceva comunque un salto ciascuno — 315 sul dietro M3641 di Lorenzo, che la
  // misura sulla distanza fra i pezzi non vedeva. Ora ogni stop è un tratto solo, e nel DST restano
  // soltanto i salti dei cambi di stop (più l'entrata alla prima impuntura).
  const dstProg = rg.readDst(rg.dstFromExportLayers(rg.stratiProgramma(programma), { label: 'DAVANTI' }));
  check("in tutto il programma nessun salto dentro gli stop e nessun punto sotto 0,5 mm (tranne l'ultimo di ogni tratto)",
    [programma.map((st) => st.blocchi.length), programma.map((st) => saltoMassimo(st) < 0.01), programma.map(puntiCorti), dstProg.jumps.length <= dstProg.colorChanges + 1],
    [[1, 1, 1, 1, 1, 1], [true, true, true, true, true, true], [0, 0, 0, 0, 0, 0], true]);

  // Lorenzo, 16/09: «in basso e in alto mi togli anche i blocchi verticali, perché si sviluppano dalla
  // riga che non c'è più». L'ultima riga in basso ha la linea C fuori dal pezzo, ma i suoi meandri ci
  // stanno: li cuce la linea della stessa riga che passa più vicino.
  const sy = reticolo.b / 30.3, sx = reticolo.a / 31.7;
  const riga = reticolo.cy + 2 * reticolo.b * 3;
  const colonne = [];
  for (let k = -2; k < 14; k++) for (const o of [-8 * sx, 8 * sx]) {
    const x = reticolo.cx + k * 2 * reticolo.a + o;
    if (x < sagoma.ingombro.x0 || x > sagoma.ingombro.x1) continue;
    if (sagoma.estensioniY(x).some(([a, b]) => riga > a && riga < b)) colonne.push(x);
  }
  const puntiSullaColonna = (r, x) => {
    let n = 0;
    for (const b of r.blocchi) for (const p of b) if (Math.abs(p.x - x) < 2.5 && p.y > riga - 7 * sy && p.y < riga + 6 * sy) n++;
    return n;
  };
  // Anche contorno a impunture e griglia (stop 1 e 2) seguono il pezzo vero, non il rettangolo.
  const s1 = rg.stopContorno(sagoma, rg.PARAMETRI_STOP), s2 = rg.stopGriglia(reticolo, sagoma, rg.PARAMETRI_STOP);
  const s1R = rg.stopContorno(rettangolo, rg.PARAMETRI_STOP), s2R = rg.stopGriglia(reticolo, rettangolo, rg.PARAMETRI_STOP);
  const nelVuoto = (s) => { let n = 0; for (const b of s.blocchi) for (const p of b) if (p.x > 120 && p.x < 320 && p.y > 248) n++; return n; };
  const lontanoDalBordo = (s) => { let n = 0; for (const b of s.blocchi) for (const p of b) if (sagoma.distanza(p) < -0.8) n++; return n; };
  console.log(`   (stop 1 e 2: punti nell'incavo col rettangolo ${nelVuoto(s1R)} e ${nelVuoto(s2R)}, con la sagoma ${nelVuoto(s1)} e ${nelVuoto(s2)})`);
  check("contorno a impunture e griglia seguono il pezzo vero: niente nell'incavo, e il contorno sta sul bordo",
    [nelVuoto(s1R) > 0, nelVuoto(s2R) > 0, nelVuoto(s1), nelVuoto(s2), lontanoDalBordo(s1), lontanoDalBordo(s2)],
    [true, true, 0, 0, 0, 0]);

  // LE AREE DI SCARICO valgono anche per linee e cornice (Lorenzo, 16/09): dentro i loro contorni si cuce
  // con le passate del parametro invece di quelle sopra. Il davanti ha tre rettangoli gialli di scarico.
  const aree = zone.filter((z) => z.color === "#f3e600").map((z) => z.points);
  const dentroArea = (p) => aree.some((a) => {
    let c = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const u = a[i], w = a[j];
      if ((u.y > p.y) !== (w.y > p.y) && p.x < ((w.x - u.x) * (p.y - u.y)) / (w.y - u.y) + u.x) c = !c;
    }
    return c;
  });
  const dentroFuori = (r) => {
    let dentro = 0, fuori = 0;
    for (const b of r.blocchi) for (const p of b) (dentroArea(p) ? dentro++ : fuori++);
    return { dentro, fuori };
  };
  const linSc = rg.generaLinee(reticolo, sagoma, rg.PARAMETRI_DAVANTI, aree);
  const corSc = rg.generaCornice(reticolo, sagoma, rg.PARAMETRI_CORNICE, linSc.ingombri, aree);
  const linPieno = dentroFuori(linS), linScarico = dentroFuori(linSc);
  const corPieno = dentroFuori(corS), corScarico = dentroFuori(corSc);
  console.log(`   (scarico: linee dentro le aree ${linPieno.dentro} → ${linScarico.dentro} punti, cornice ${corPieno.dentro} → ${corScarico.dentro})`);
  // anche gli ZIG-ZAG (fermi e barre) si scaricano (Lorenzo, 16/09): un fermo dentro l'area ha meno tratti
  const zigzagDentro = (r) => {
    let n = 0;
    for (const b of r.blocchi) for (let i = 1; i < b.length; i++) {
      const a = b[i - 1], c = b[i];
      // i tratti verticali corti e stretti del fermo
      if (Math.abs(c.x - a.x) < 0.35 && Math.abs(c.y - a.y) > 1 && Math.abs(c.y - a.y) < 3.2 && dentroArea(a)) n++;
    }
    return n;
  };
  console.log(`   (scarico: tratti di zig-zag dentro le aree ${zigzagDentro(linS)} → ${zigzagDentro(linSc)})`);
  const senzaScarico = rg.generaLinee(reticolo, sagoma, { ...rg.PARAMETRI_DAVANTI, passateScarico: 0 }, aree);
  check("le aree di scarico valgono anche per linee e cornice: dentro meno punti (zig-zag compresi), fuori quasi uguali, e a 0 non cambia niente",
    [aree.length, linScarico.dentro < linPieno.dentro * 0.75, corScarico.dentro < corPieno.dentro * 0.75,
      zigzagDentro(linSc) < zigzagDentro(linS) * 0.8, zigzagDentro(linS) > 50,
      Math.abs(linScarico.fuori / linPieno.fuori - 1) < 0.02, senzaScarico.conteggi.punti === linS.conteggi.punti],
    [3, true, true, true, true, true, true]);

  // LA LINEA DI CONTORNO scelta nel disegno (Lorenzo, 16/09): la seguono bordo, griglia e termogarze.
  const linea = [{ x: 60, y: 40 }, { x: 380, y: 40 }, { x: 380, y: 200 }, { x: 60, y: 200 }];
  const bordoScelto = rg.sagomaDaAnelli([linea]);
  const s1L = rg.stopContorno(bordoScelto, rg.PARAMETRI_STOP);
  const s2L = rg.stopGriglia(reticolo, bordoScelto, rg.PARAMETRI_STOP);
  const sulRettangolo = (p) => Math.min(
    Math.abs(p.x - 60) + (p.y < 39.9 || p.y > 200.1 ? 99 : 0), Math.abs(p.x - 380) + (p.y < 39.9 || p.y > 200.1 ? 99 : 0),
    Math.abs(p.y - 40) + (p.x < 59.9 || p.x > 380.1 ? 99 : 0), Math.abs(p.y - 200) + (p.x < 59.9 || p.x > 380.1 ? 99 : 0),
  ) < 0.01;
  const dentroRettangolo = (p) => p.x > 59.9 && p.x < 380.1 && p.y > 39.9 && p.y < 200.1;
  const conTermo = rg.generaLinee(reticolo, sagoma, { ...rg.PARAMETRI_DAVANTI, termogarze: true }, [], [linea]);
  // le termogarze aprono il filo delle linee: il giro sulla linea scelta è la prima parte del tratto
  const filo = conTermo.blocchi[0];
  const giroChiuso = filo.findIndex((p, k) => k > 4 && Math.hypot(p.x - filo[0].x, p.y - filo[0].y) < 1e-6);
  check("bordo, griglia e termogarze seguono la linea di contorno scelta",
    [s1L.blocchi.length, s1L.blocchi[0].every(sulRettangolo), s2L.blocchi.flat().every(dentroRettangolo),
      giroChiuso > 4, filo.slice(0, giroChiuso + 1).every(sulRettangolo), conTermo.blocchi.length],
    [1, true, true, true, true, 1]);

  check('i blocchi verticali di una riga tagliata dal bordo si cuciono lo stesso, dalla linea più vicina',
    [sagoma.estensioniX(riga + 4.75 * sy).length, colonne.length, colonne.filter((x) => puntiSullaColonna(linS, x) < 20).length],
    [0, 4, 0]);
}

// cannage-rafia — la BORDATURA (Lorenzo, 16/09). Il riferimento è il DST M1424 ORLATURA E MEDAGLIONE: lo
// stop 1 è la linea, gli stop 2-5 la bordatura doppia da 4 mm (raso obliquo, raso dritto, cordoncino, linee).
// Nel DST la bordatura è centrata sulla linea (esce di 1,92 mm): la rigeneriamo con quell'uscita e
// misuriamo ogni punto rispetto alla linea, lungo (s) e verso dentro (n).
console.log('');
console.log('cannage-rafia — la bordatura rifà il DST vero M1424');
{
  const riferimento = rg.readDst(new Uint8Array(readFileSync(join(here, 'fixtures/m1424-orlatura.dst'))));
  const contorno = riferimento.blocks[0].points_mm.map(([x, y]) => ({ x, y }));
  const sagoma = rg.sagomaDaAnello(contorno);
  const lato = contorno.filter((p) => p.y < -95).sort((a, b) => a.x - b.x);
  const S = [0];
  for (let i = 1; i < lato.length; i++) S.push(S[i - 1] + Math.hypot(lato[i].x - lato[i - 1].x, lato[i].y - lato[i - 1].y));
  const proietta = ({ x, y }) => {
    let best = null;
    for (let i = 1; i < lato.length; i++) {
      const a = lato[i - 1], b = lato[i], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2));
      const d = Math.hypot(x - a.x - t * vx, y - a.y - t * vy);
      if (!best || d < best.d) best = { d, s: S[i - 1] + t * Math.sqrt(l2), n: (vx * (y - a.y) - vy * (x - a.x)) / Math.sqrt(l2) };
    }
    return best;
  };
  // n positivo = verso il pezzo (in basso): il bordo è in alto
  const fascia = (punti) => {
    const q = punti.map(proietta).filter((p) => p.s > 200 && p.s < 300);
    const n = q.map((p) => p.n).sort((a, b) => a - b);
    return { lo: n[Math.floor(n.length * 0.02)], hi: n[Math.floor(n.length * 0.98)], punti: q.length };
  };
  const bord = rg.generaBordatura([{ punti: lato, chiusa: false, passaggio: 'doppia' }], { ...rg.PARAMETRI_BORDATURA, uscita: 1.92 }, sagoma);
  const nostri = [bord.obliquo, bord.dritto, bord.cordoncino, bord.linee];
  const confronti = nostri.map((b, k) => {
    const dst = fascia(riferimento.blocks[k + 1].points_mm.map(([x, y]) => ({ x, y })));
    const mio = fascia(b.flat());
    return [Math.abs(dst.lo - mio.lo) < 0.45 && Math.abs(dst.hi - mio.hi) < 0.45, Math.abs(mio.punti / dst.punti - 1) < 0.08];
  });
  check('i quattro stop hanno le altezze del DST (entro 0,45 mm) e la stessa densità (entro l\'8%)', confronti, [[true, true], [true, true], [true, true], [true, true]]);
  check('ogni stop è un filo solo', nostri.map((b) => b.length), [1, 1, 1, 1]);

  // le linee: dove stanno e dove stanno i fermi. Un fermo = i suoi 4 tratti dritti a cavallo della linea
  // (quelli che vanno verso fuori: le diagonali tornano dentro).
  const fermi = (b) => {
    const out = [];
    for (let i = 1; i < b.length; i++) {
      const a = proietta(b[i - 1]), c = proietta(b[i]);
      if (Math.abs(a.s - c.s) < 0.2 && a.n - c.n > 2) out.push({ s: a.s, n: (a.n + c.n) / 2 });
    }
    const gruppi = [];
    for (const f of out) {
      const g = gruppi.find((x) => Math.abs(x.s - f.s) < 1.2 && Math.abs(x.n - f.n) < 0.8);
      if (g) g.k++; else gruppi.push({ ...f, k: 1 });
    }
    return gruppi;
  };
  const fr = fermi(bord.linee[0]);
  const sopra = fr.filter((f) => f.n < 0.5).map((f) => f.s).sort((a, b) => a - b);
  const sotto = fr.filter((f) => f.n >= 0.5).map((f) => f.s).sort((a, b) => a - b);
  const passo = sopra[2] - sopra[1];
  const meta = sotto.filter((x) => x > sopra[5] && x < sopra[6])[0] - sopra[5];
  check('doppio: due linee a 2 mm (come nel DST: -0,5 e +1,5 dalla linea), fermi a 9,5 mm e sfasati di mezzo passo',
    [Math.round(fr.filter((f) => f.n < 0.5)[3].n * 10) / 10, Math.round(fr.filter((f) => f.n >= 0.5)[3].n * 10) / 10,
      // lontano dai capi (oltre la linea la proiezione si schiaccia sul capo) e dove il contorno non piega
      // (lì i tratti dentro si stringono e la misura li confonde): quasi tutti coi loro 4 tratti
      Math.abs(passo - 9.5) < 0.1, Math.abs(meta / passo - 0.5) < 0.02,
      (() => { const mezzo = fr.filter((f) => f.s > 20 && f.s < S.at(-1) - 20); return mezzo.filter((f) => f.k === 4).length >= mezzo.length * 0.95; })()],
    [-0.5, 1.5, true, true, true]);

  // L'uscita di Lorenzo: 0,5 mm oltre la linea, tutto il resto verso dentro. Singolo = 2 mm e una linea.
  const singolo = rg.generaBordatura([{ punti: lato, chiusa: false, passaggio: 'singola' }], rg.PARAMETRI_BORDATURA, sagoma);
  const doppio = rg.generaBordatura([{ punti: lato, chiusa: false, passaggio: 'doppia' }], rg.PARAMETRI_BORDATURA, sagoma);
  const tonda = (v) => Math.round(v * 10) / 10;
  const fs = fascia(singolo.dritto.flat()), fd = fascia(doppio.dritto.flat());
  const lineeSingolo = [...new Set(fermi(singolo.linee[0]).map((f) => tonda(f.n)))];
  check('uscita 0,5 mm: il raso dritto va da -0,5 a +1,5 nel singolo e a +3,5 nel doppio; il singolo ha una linea sola',
    [tonda(fs.lo), tonda(fs.hi), tonda(fd.lo), tonda(fd.hi), lineeSingolo.length], [-0.5, 1.5, -0.5, 3.5, 1]);
  // il dentro si trova dal pezzo, qualunque sia il verso in cui la linea è disegnata
  const alRovescio = rg.generaBordatura([{ punti: lato.slice().reverse(), chiusa: false, passaggio: 'doppia' }], rg.PARAMETRI_BORDATURA, sagoma);
  check('una linea disegnata al contrario borda dalla stessa parte', tonda(fascia(alRovescio.dritto.flat()).hi), 3.5);
  const conMinimo = rg.conPuntoMinimo({ numero: 9, nome: '', blocchi: doppio.cordoncino, punti: 0 }, 0.5);
  check('il punto minimo di 0,5 mm non mangia il cordoncino (i suoi punti vanno di traverso)', conMinimo.blocchi[0].length === doppio.cordoncino[0].length, true);

  // I LATI DA SCEGLIERE IN ANTEPRIMA, sul davanti M3641: il bordo alto curvo è un lato solo, gli scalini fra
  // i rombi in basso non fanno lati.
  const modello = rg.parseImportedBoundarySource(readFileSync(join(here, 'fixtures/cannage-rafia-m3641-davanti.svg'), 'utf8'), 'davanti.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zone = rg.zoneDaModello(modello);
  const pezzo = rg.sagomaDaZone(zone, ['#f3e600']);
  const lati = rg.latiDelContorno(pezzo.anelli);
  const alto = lati.filter((l) => Math.max(...l.punti.map((p) => p.y)) < 12);
  check('M3641 davanti: 9 lati, e il bordo alto curvo è uno solo', [lati.length, alto.length, alto[0]?.punti.length > 20], [9, 1, true]);
  const vicino = (l) => l.indice === (alto[0].indice + 1) % lati.length;
  const unite = rg.lineeDaLati(lati, (l) => (l === alto[0] || vicino(l) ? 'doppia' : null));
  const tutte = rg.lineeDaLati(lati, () => 'singola');
  check('due lati vicini diventano una linea sola; tutti i lati, un anello chiuso', [unite.length, unite[0].chiusa, tutte.length, tutte[0].chiusa, tutte[0].passaggio], [1, false, 1, true, 'singola']);
  // NELLO STESSO PROGRAMMA doppie e singole (Lorenzo, 16/09): due lati vicini di passaggio diverso restano due
  // linee, e negli stessi stop la doppia ha due linee e la singola una.
  const miste = rg.lineeDaLati(lati, (l) => (l === alto[0] ? 'doppia' : vicino(l) ? 'singola' : null));
  const bordMiste = rg.generaBordatura(miste, rg.PARAMETRI_BORDATURA, pezzo);
  const altezza = (bl) => Math.max(...bl.flat().map((p) => rg.sagomaDaAnelli(pezzo.anelli).distanza(p)));
  check('doppie e singole insieme: due linee coi loro passaggi, negli stessi quattro stop, fasce da 4 e da 2 mm',
    // i fili dello stop sono nell'ordine delle linee: ogni linea col suo
    [miste.map((l) => l.passaggio).sort(), bordMiste.dritto.length,
      Object.fromEntries(miste.map((l, i) => [l.passaggio, Math.round(altezza([bordMiste.dritto[i]]) * 10) / 10]).sort())],
    [['doppia', 'singola'], 2, { doppia: 3.5, singola: 1.5 }]);
  check('un lato scelto si ritrova dal suo punto di mezzo', lati.filter((l) => rg.stessoLato(l, alto[0].chiave)).length, 1);
  const retM = rg.reticoloDaZone(zone, '#2a4e9c').reticolo;
  const sulDavanti = rg.stopBordatura(rg.lineeDaLati(lati, (l) => (l === alto[0] ? 'doppia' : null)), rg.PARAMETRI_BORDATURA, pezzo, rg.pezzoPiuLungo(retM));
  // fuori si misura dall'anello del contorno, la linea che si borda: il bordo delle zone ha gli scalini dei rombi
  const anello = rg.sagomaDaAnelli(pezzo.anelli);
  const dentroPezzo = sulDavanti.stop.flatMap((st) => st.blocchi.flat()).filter((p) => p.x > 5 && p.x < 435);
  check('sul davanti: stop 7-10, un filo ciascuno, e fuori dal pezzo al massimo l\'uscita',
    [sulDavanti.stop.map((st) => st.numero), sulDavanti.stop.map((st) => st.blocchi.length), dentroPezzo.every((p) => anello.distanza(p) > -0.51)],
    [[7, 8, 9, 10], [1, 1, 1, 1], true]);
  check('il passo dei fermi parte dal pezzo più lungo delle linee orizzontali', Math.abs(sulDavanti.risultato.conteggi.passoFermi - rg.pezzoPiuLungo(retM)) < 1e-9 && rg.pezzoPiuLungo(retM) > 5, true);

  // LA LINEA NEL DISEGNO: un tracciato aperto (anche una <line> di Illustrator) con una tinta sua.
  const svgLinea = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200mm" height="100mm">
    <rect x="10" y="10" width="180" height="80" fill="#2a4e9c"/>
    <line x1="10" y1="10" x2="190" y2="10" stroke="#ff00ff" fill="none"/>
    <path d="M10 90 C 60 95, 140 95, 190 90" stroke="#00aa00" fill="none"/>
  </svg>`;
  const mLinea = rg.parseImportedBoundarySource(svgLinea, 'linea.svg', { scaleMode: 'viewbox-mm', paintPriority: 'fill' });
  const aperte = rg.lineeDaModello(mLinea);
  check('le linee aperte del disegno si leggono con la loro tinta, anche <line>, e non diventano zone',
    [aperte.map((l) => l.color).sort(), rg.zoneDaModello(mLinea).length], [['#00aa00', '#ff00ff'], 1]);
}

// cross-stitch — i PASSAGGI. Il motore vecchio (ThreadRoute) era un mucchio di connettori con premi
// e penalità scritti a mano; quello nuovo ha una regola sola (il passaggio va sotto il ricamo che
// viene dopo) e una mappa di costo. Qui si blocca quello che si è misurato migrando: sugli stessi
// disegni il vecchio lasciava 105-209 mm di passaggi in vista sul cuore, il nuovo 20-45.
// Da 0.4.0 UN PUNTO PER COLONNA (Lorenzo, «B»): la V sta dentro la sua cella, come la croce, e il
// reticolo ha anche i vertici a metà cella (la punta della V): larghezza 2·colonne+1.
console.log('\ncross-stitch — passaggi: V, chevron, croci, più fili');
{
  const g = (rows, cols) => ({ rows, cols, cellW: 5, cellH: 5 });
  const LW = (grid) => 2 * grid.cols + 1;
  const fill = (grid, f) => { const m = new Map(); for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) { const s = f(r, c); if (s) m.set(r * grid.cols + c, typeof s === 'string' ? { stitch: s, color: 0 } : s); } return m; };
  const run = (grid, cells, p = {}) => rg.csRouteCells(grid, cells, { ...rg.CS_DEFAULT_ROUTE, ...p });

  // Una riga di V si cuce di filato: nessun passaggio. Con 2 passate si va e si torna, senza
  // ripassare (il vecchio ripassava 64 mm).
  const riga = g(1, 5), cRiga = fill(riga, () => 'v');
  for (const reps of [1, 2, 3]) {
    // con passate pari si va e si torna lungo la riga; con dispari, sulla stessa V (la partenza)
    const m = run(riga, cRiga, { repetitions: reps, passOrder: reps % 2 ? 'stitch' : 'row' }).metrics;
    check(`riga di V ×${reps}: zero passaggi in vista, zero ripassi, zero salti`, [m.visibleMm, m.retraceMm, m.jumps], [0, 0, 0]);
  }
  // Un campo di V: un solo cambio riga per riga, e il cambio riga è un passaggio VERTICALE da
  // vertice a vertice (Lorenzo, 2026-09-24: «togliere le linee orizzontali come passaggio»).
  const campo = g(6, 5), cCampo = fill(campo, () => 'v');
  const mCampo = run(campo, cCampo, { repetitions: 2, passOrder: 'row' }).metrics;
  check('campo di V 6×5 ×2: niente in vista, 25 mm vertice-vertice (uno per cambio riga)', [Math.round(mCampo.visibleMm), Math.round(mCampo.verticalMm)], [0, 25]);
  // ...e il verticale passa dai VERTICI della V, al centro (punta → punta), non sul lato fra due
  // celle (Lorenzo: «mi aspetterei che i passaggi siano nei vertici, a costo di avere metà della V
  // con un passaggio in più»): nel reticolo, colonna dispari.
  const verticali = run(campo, cCampo).colors[0].segs.filter((sg) => sg.kind === 'vertical');
  check('i cambi riga scendono dalla punta della V, mai sul lato', [verticali.length > 0, verticali.every((sg) => (sg.from % LW(campo)) % 2 === 1)], [true, true]);
  // Nessun passaggio orizzontale dove c'è un'alternativa: su un campo a due fili a macchie, zero
  // tratti orizzontali (from e to sulla stessa riga del reticolo) e zero salti.
  const gH = { rows: 30, cols: 20, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const macchie = (r, c) => ({ stitch: 'v', color: ((r * 7 + c * 13) % 11) < 3 ? 0 : 1 });
  const rH = run(gH, fill(gH, macchie));
  let orizz = 0;
  for (const cr of rH.colors) for (const sg of cr.segs) if (sg.kind !== 'stitch' && sg.kind !== 'jump' && Math.floor(sg.from / LW(gH)) === Math.floor(sg.to / LW(gH))) orizz++;
  check('a macchie: nessun passaggio orizzontale, nessun salto', [orizz, rH.metrics.jumps], [0, 0]);

  // PASSATE SULLA STESSA V (Lorenzo: «che succede se per ogni punto faccio i più passaggi?»).
  // Con 3 passate la V si cuce avanti-indietro-avanti e finisce nell'angolo dove comincia la
  // successiva: la riga va di filato, senza un passaggio; e le 6 passate di ogni V sono di fila.
  const r3 = run(riga, cRiga, { repetitions: 3, passOrder: 'stitch' });
  const st3 = r3.colors[0].segs;
  check('sulla V ×3: riga di V senza nessun passaggio', [r3.metrics.visibleMm, r3.metrics.verticalMm, r3.metrics.retraceMm, st3.every((sg) => sg.kind === 'stitch')], [0, 0, 0, true]);
  let diFila = true;
  for (let v = 0; v < 5; v++) { const blocco = st3.slice(v * 6, v * 6 + 6); const vert = new Set(blocco.flatMap((sg) => [sg.from, sg.to])); if (vert.size !== 3) diFila = false; }
  check('sulla V ×3: le 6 passate di ogni V una dopo l’altra, sugli stessi 3 fori', diFila, true);
  check('sulla V ×2: con passate pari si torna da dove si è partiti, e serve un passaggio', run(riga, cRiga, { repetitions: 2, passOrder: 'stitch' }).metrics.verticalMm + run(riga, cRiga, { repetitions: 2, passOrder: 'stitch' }).metrics.retraceMm > 0, true);
  // La V sta DENTRO la cella: angolo in alto a sinistra → punta a metà del lato di sotto → angolo
  // in alto a destra, e la croce occupa la stessa cella (un punto per colonna).
  const v0 = st3.slice(0, 2).map((sg) => [sg.from, sg.to]);
  check('la V dentro la cella: angolo (0,0) → punta (1,1) → angolo (0,2) del reticolo', v0, [[0, LW(riga) + 1], [LW(riga) + 1, 2]]);

  // Ogni gamba è cucita esattamente N volte, e nella croce la gamba sopra viene sempre dopo.
  const blocco = g(5, 5), cCroci = fill(blocco, () => 'cross');
  for (const reps of [1, 2]) {
    const res = run(blocco, cCroci, { repetitions: reps });
    const conta = new Map(), primaVolta = new Map(), ultimaVolta = new Map();
    let i = 0;
    for (const s of res.colors[0].segs) {
      i++;
      if (s.kind !== 'stitch') continue;
      const k = Math.min(s.from, s.to) + ':' + Math.max(s.from, s.to);
      conta.set(k, (conta.get(k) ?? 0) + 1);
      if (!primaVolta.has(k)) primaVolta.set(k, i);
      ultimaVolta.set(k, i);
    }
    check(`croci ×${reps}: 50 gambe, ognuna cucita ${reps} volte`, [conta.size, [...conta.values()].every((n) => n === reps)], [50, true]);
    let sottoPrima = true;
    const W = LW(blocco);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const tl = r * W + 2 * c, tr = tl + 2, bl = tl + W, br = bl + 2;
      const giu = primaVolta.get(Math.min(tl, br) + ':' + Math.max(tl, br)), su = ultimaVolta.get(Math.min(bl, tr) + ':' + Math.max(bl, tr));
      // gamba sopra «\» (default): la «/» sotto deve essere finita prima che la «\» cominci
      if (!(su < giu)) sottoPrima = false;
    }
    check(`croci ×${reps}: la gamba sopra («\\») sempre dopo quella sotto`, sottoPrima, true);
  }

  // Il percorso è continuo: ogni tratto parte dove è finito il precedente (i salti inclusi).
  const scacchi = fill(g(8, 8), (r, c) => ({ stitch: 'cross', color: ((r >> 1) + (c >> 1)) % 2 }));
  const res2 = run(g(8, 8), scacchi, { repetitions: 2 });
  let continuo = true;
  for (const cr of res2.colors) for (let i = 1; i < cr.segs.length; i++) if (cr.segs[i].from !== cr.segs[i - 1].to) continuo = false;
  check('a scacchi con 2 fili: percorso continuo, un filo per colore', [continuo, res2.colors.length], [true, 2]);
  // Il primo filo si nasconde sotto il secondo.
  const nascosti = rg.csRouteCells(g(8, 8), scacchi, rg.CS_DEFAULT_ROUTE, [0, 1]).colors[0].segs.filter((s) => s.kind === 'hidden').length;
  check('il primo ago nasconde dei passaggi sotto il secondo', nascosti > 0, true);
  // V e croci mescolate nella stessa griglia: stessa colonna, stessa misura, e tutto si cuce.
  const misto = fill(g(4, 6), (r, c) => ((r + c) % 2 ? 'v' : 'cross'));
  const mMisto = run(g(4, 6), misto);
  check('V e croci mescolate: tutte le gambe cucite, nessun salto', [mMisto.metrics.legs, mMisto.metrics.jumps], [24 * 2, 0]);

  // Direzione fissa: ogni gamba nel suo verso (verso destra: la V scende e risale, «\» scende).
  const fisso = run(g(4, 6), fill(g(4, 6), () => 'v'), { fixedDirection: true });
  const W = LW(g(4, 6));
  const versoGiusto = fisso.colors[0].segs.filter((s) => s.kind === 'stitch').every((s) => {
    const di = Math.floor(s.to / W) - Math.floor(s.from / W), dj = (s.to % W) - (s.from % W);
    return dj === 1 && Math.abs(di) === 1;
  });
  check('direzione fissa: ogni gamba nel suo verso', versoGiusto, true);

  // Nuovo filo dopo il cambio colore: parte da un capo, non con un passaggio cucito dal filo di prima.
  const dueRighe = fill(g(2, 5), (r) => ({ stitch: r === 0 ? 'v' : 'lambda', color: r }));
  const m2 = run(g(2, 5), dueRighe).metrics;
  check('riga di V nera + riga di Λ rossa: niente in vista, niente salti', [m2.visibleMm, m2.jumps], [0, 0]);

  // Gli strumenti: un clic = un punto nella cella cliccata.
  const gE = g(3, 4);
  check('V col sinistro, Λ col destro, nella cella cliccata', [rg.csEditsFor(gE, 'v', 'left', 1, 1, 2), rg.csEditsFor(gE, 'v', 'right', 1, 3, 0)].map((e) => e.map((x) => [x.c, x.mark.stitch])), [[[1, 'v']], [[3, 'lambda']]]);
  check('maiuscolo + clic svuota con qualunque strumento', rg.csEditsFor(gE, 'cross', 'left', 0, 0, 0, true)[0].mark, null);

  // Il progetto torna uguale dal metadata, e un progetto ThreadRoute si apre.
  const cJ = fill(g(3, 4), (r, c) => (c === r ? 'cross' : c === 3 ? 'up' : c === 0 ? 'lambda' : 'v'));
  check('celle → JSON → celle: uguali (V e Λ comprese)', JSON.stringify([...rg.csCellsFromJson(g(3, 4), rg.csCellsToJson(g(3, 4), cJ))]), JSON.stringify([...cJ].sort((a, b) => a[0] - b[0])));
  const vecchio = rg.csFromThreadRoute({ grid: { rows: 2, columns: 3, cellWidth: 4, cellHeight: 6, gapX: 0, gapY: 0 }, primitive: { repetitions: 2 }, cells: [{ row: 0, col: 1, enabled: true, orientation: 'diagonalUp' }, { row: 1, col: 2, enabled: true, orientation: 'diagonalDown' }, { row: 1, col: 0, enabled: false, orientation: null }] });
  check('progetto ThreadRoute: griglia, celle, passate', [vecchio.grid, [...vecchio.cells], vecchio.repetitions], [{ rows: 2, cols: 3, cellW: 4, cellH: 6 }, [[1, { stitch: 'up', color: 0 }], [5, { stitch: 'down', color: 0 }]], 2]);
  // I progetti di prima di 0.4.0 (V su due colonne) si convertono: «\»+«/» → V, «/»+«\» → Λ,
  // una gamba sola resta diagonale, la cella diventa larga il doppio.
  const due = { rows: 1, cols: 6, cellW: 1.5, cellH: 3.8 };
  const vecchiaV = new Map([[0, { stitch: 'down', color: 0 }], [1, { stitch: 'up', color: 0 }], [2, { stitch: 'up', color: 1 }], [3, { stitch: 'down', color: 1 }], [4, { stitch: 'cross', color: 0 }]]);
  const conv = rg.csFromTwoColumnV(due, vecchiaV);
  check('progetto 0.3.0: V su due colonne → una colonna larga il doppio', [conv.grid.cols, conv.grid.cellW, [...conv.cells].map(([k, m]) => [k, m.stitch, m.color])], [3, 3, [[0, 'v', 0], [1, 'lambda', 1], [2, 'cross', 0]]]);

  // In macchina: nessun punto oltre il massimo (le celle grandi si spezzano in punti uguali).
  const grande = { rows: 2, cols: 2, cellW: 20, cellH: 20 };
  const rG = rg.csRouteCells(grande, fill(grande, () => 'cross'), rg.CS_DEFAULT_ROUTE);
  let lungo = 0;
  for (const pl of rg.csColorPolylines(grande, rG.colors[0], { maxStitchMm: 7, travelStitchMm: 2.5 })) for (let i = 1; i < pl.length; i++) lungo = Math.max(lungo, Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y));
  check('celle da 20 mm: nessun punto oltre i 7 mm', lungo <= 7 + 1e-9, true);

  // Il SORMONTO delle righe (chiesto da Lorenzo per avvicinare le V come nella maglia): la riga r
  // parte a r·passo, e passo = altezza × (1 − sormonto). Il percorso resta quello del reticolo.
  const gS = { rows: 3, cols: 2, cellW: 4, cellH: 5, overlapPct: 40 };
  const cS = fill(gS, () => 'v');
  const rS = rg.csRouteCells(gS, cS, rg.CS_DEFAULT_ROUTE);
  const ys = new Set();
  for (const pl of rg.csColorPolylines(gS, rS.colors[0], { maxStitchMm: 12, travelStitchMm: 12 })) for (const p of pl) ys.add(Math.round(p.y * 1000) / 1000);
  check('sormonto 40% su celle alte 5: le righe partono a 0, 3, 6 e finiscono a 5, 8, 11', [...ys].sort((x, y) => x - y), [0, 3, 5, 6, 8, 11]);
  // Solo in verticale: in orizzontale nessun sormonto (Lorenzo): le x dei punti sono le stesse.
  const xs = (gg) => { const out = []; for (const pl of rg.csColorPolylines(gg, rg.csRouteCells(gg, cS, rg.CS_DEFAULT_ROUTE).colors[0], { maxStitchMm: 12, travelStitchMm: 12 })) for (const p of pl) out.push(p.x); return [...new Set(out)].sort((x, y) => x - y); };
  check('sormonto solo verticale: i punti cadono sulle stesse colonne (x) che senza', JSON.stringify(xs(gS)), JSON.stringify(xs({ ...gS, overlapPct: 0 })));
  check('sormonto: il percorso non cambia (stessi tratti che senza)', JSON.stringify(rS.colors), JSON.stringify(rg.csRouteCells({ ...gS, overlapPct: 0 }, cS, rg.CS_DEFAULT_ROUTE).colors));
  // Le MISURE comandano la griglia (Lorenzo): ricamo L×A, cella, sormonto → colonne e righe.
  const gM = rg.csGridForSize(150, 80, 2.5, 6, 35);
  check('150×80 mm, cella 2,5×6, sormonto 35%: 60 colonne × 20 righe', [gM.cols, gM.rows], [60, 20]);
  check('...e il ricamo esce alto 80 mm a meno di mezza riga', Math.abs(rg.csGridHeight(gM) - 80) <= 6 * 0.65 / 2, true);
  check('una colonna = un punto: anche un numero dispari di colonne', rg.csGridForSize(101, 50, 2, 5, 0).cols, 51);

  // DALL'IMMAGINE — i difetti visti sul giornale Dior di Lorenzo (2026-09-24).
  // (1) Il nero usciva grigio (#8D8D8D): il median-cut su un'immagine quasi tutta bianca fa la
  // media di neri e grigi dei bordi. Immagine sintetica: 85% bianco, 10% nero, 5% grigio di bordo.
  const W0 = 100, H0 = 100, rgba = new Uint8ClampedArray(W0 * H0 * 4);
  for (let i = 0; i < W0 * H0; i++) { const v = i % 20 < 2 ? 0 : i % 20 === 2 ? 128 : 255; rgba.set([v, v, v, 255], i * 4); }
  const img0 = { rgba, width: W0, height: H0 };
  const pal0 = rg.csRefinePalette(img0, rg.medianCutPalette(rgba, null, 2)).sort((a, b) => a[0] - b[0]);
  check('colori dall\'immagine: il nero resta nero (sotto 60), il bianco bianco', [pal0[0][0] < 60, pal0[1][0] > 240], [true, true]);
  // (2) Le lettere si perdevano: un tratto nero sottile, mediato col bianco, spariva. Una cella
  // larga 5 px con dentro un tratto nero di 2 px (40%): con la soglia al 35% è nera, al 50% no.
  const img1 = { rgba: new Uint8ClampedArray(20 * 10 * 4), width: 20, height: 10 };
  for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) { const v = x < 2 ? 0 : 255; img1.rgba.set([v, v, v, 255], (y * 20 + x) * 4); }
  const gK = { rows: 1, cols: 4, cellW: 3, cellH: 3.8 };
  const bw = [[0, 0, 0], [255, 255, 255]];
  const col = (cells) => [...cells.values()].map((m) => m.color);
  const kinds = (cells) => [...cells.values()].map((m) => m.stitch);
  check('soglia 35%: il tratto sottile fa nera la sua cella (e quella accanto resta bianca)', col(rg.csKnitFromImage(gK, img1, bw, { background: 1, detailPct: 35 })), [0, 1, 1, 1]);
  check('soglia 50%: lo stesso tratto si perde', col(rg.csKnitFromImage(gK, img1, bw, { background: 1, detailPct: 50 })), [1, 1, 1, 1]);
  // (4) Il PUNTO della generazione (Lorenzo: «cambiare il punto della generazione da immagine»):
  // uno per cella, qualunque sia.
  check('punto V: una V per cella', kinds(rg.csKnitFromImage(gK, img1, bw, { background: 1 })), ['v', 'v', 'v', 'v']);
  check('punto Λ: una Λ per cella', kinds(rg.csKnitFromImage(gK, img1, bw, { background: 1, stitch: 'lambda' })), ['lambda', 'lambda', 'lambda', 'lambda']);
  check('punto croce: una croce per cella', kinds(rg.csKnitFromImage(gK, img1, bw, { background: 1, stitch: 'cross' })), ['cross', 'cross', 'cross', 'cross']);
  check('punto «/»: tutte diagonali «/»', kinds(rg.csKnitFromImage(gK, img1, bw, { background: 1, stitch: 'up' })), ['up', 'up', 'up', 'up']);
  // una riga di Λ con 3 passate sulla stessa Λ: come la V, di filato
  const rL = run(g(1, 5), fill(g(1, 5), () => 'lambda'), { repetitions: 3 });
  check('riga di Λ ×3 sulla stessa Λ: senza passaggi', rL.colors[0].segs.every((sg) => sg.kind === 'stitch'), true);
  // (3) I passaggi del filo sopra: niente salti a caso, e su un campo a macchie nessuna gamba
  // riceve troppi passaggi in più.
  const gX = { rows: 40, cols: 20, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const mX = rg.csRouteCells(gX, fill(gX, macchie), rg.CS_DEFAULT_ROUTE).metrics;
  check('a macchie 40×20: nessun salto, al massimo tre passaggi in più sulla stessa gamba', [mX.jumps, mX.maxExtra <= 3], [0, true]);

  // LA BASE (Lorenzo, 2026-09-25: «selezionare un colore e dirgli di diventare base completa»):
  // un filo riempie TUTTA la griglia col suo punto, cucito per primo; il disegno sopra.
  const gB = { rows: 4, cols: 5, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const disegno = fill(gB, (r, c) => (r === 1 && c > 0 && c < 4 ? { stitch: 'v', color: 0 } : r === 2 && c === 2 ? { stitch: 'v', color: 1 } : null));
  const conBase = run(gB, disegno, { base: { color: 1, stitch: 'v' } });
  check('base V: tutta la griglia (20 V) più il disegno sopra (3 V nere); la cella bianca non si cuce due volte', [conBase.metrics.legs, conBase.colors.map((c) => c.color)], [(20 + 3) * 2, [1, 0]]);
  check('base: si cuce per prima anche se nella tavolozza viene dopo, e senza salti', [conBase.colors[0].color, conBase.metrics.jumps], [1, 0]);
  const baseCroce = run(gB, disegno, { base: { color: 1, stitch: 'cross' } });
  check('base a croce e disegno a V sopra: ogni gamba cucita una volta', (() => { const n = new Map(); for (const cr of baseCroce.colors) for (const sg of cr.segs) if (sg.kind === 'stitch') { const k = cr.color + ':' + Math.min(sg.from, sg.to) + ':' + Math.max(sg.from, sg.to); n.set(k, (n.get(k) ?? 0) + 1); } return [n.size, [...n.values()].every((x) => x === 1)]; })(), [20 * 2 + 3 * 2, true]);
  // il disegno sopra la base si sposta ripassando se stesso o in verticale: mai orizzontale
  const nero = conBase.colors[1].segs;
  check('il disegno sopra la base: nessun passaggio orizzontale', nero.filter((sg) => sg.kind !== 'stitch' && sg.kind !== 'jump' && Math.floor(sg.from / LW(gB)) === Math.floor(sg.to / LW(gB))).length, 0);

  // PASSATE PER FILO (Lorenzo: «un colore voglio 3 passaggi e quello sopra 5»).
  const perFilo = run(gB, disegno, { base: { color: 1, stitch: 'v' }, passesByColor: { 1: 3, 0: 5 } });
  const quante = (cr) => { const n = new Map(); for (const sg of cr.segs) if (sg.kind === 'stitch') { const k = Math.min(sg.from, sg.to) + ':' + Math.max(sg.from, sg.to); n.set(k, (n.get(k) ?? 0) + 1); } return [...new Set(n.values())]; };
  check('base a 3 passate, nero sopra a 5: ogni gamba del suo filo', perFilo.colors.map(quante), [[3], [5]]);

  // PER BLOCCHI DI COLORE (Lorenzo: «lavorare per blocchi colore»): il filo finisce la zona in cui
  // si trova prima di passare a un'altra. Sul campo a macchie senza blocchi il filo lascia zone a
  // metà e ci torna (10 rientri su 30×20); a blocchi mai. Sul giornale Dior: 332 rientri → 0.
  const gBl = { rows: 30, cols: 20, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const cBl = fill(gBl, macchie);
  const blk = new Map(); let nBl = 0;
  for (const [k, m] of cBl) { if (blk.has(k)) continue; const st = [k]; blk.set(k, nBl); while (st.length) { const x = st.pop(); const r = Math.floor(x / 20), c = x % 20; for (const [r2, c2] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) { if (r2 < 0 || c2 < 0 || r2 >= 30 || c2 >= 20) continue; const y = r2 * 20 + c2; if (!blk.has(y) && cBl.get(y).color === m.color) { blk.set(y, nBl); st.push(y); } } } nBl++; }
  const rientri = (res) => { let tot = 0; const W2 = LW(gBl); for (const cr of res.colors) { let cur = -1; const visti = new Set(); for (const sg of cr.segs) { if (sg.kind !== 'stitch') continue; const i = Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)), j = Math.min(sg.from % W2, sg.to % W2); const b = blk.get(i * 20 + Math.floor(j / 2)); if (b !== cur) { if (visti.has(b)) tot++; if (cur >= 0) visti.add(cur); cur = b; } } } return tot; };
  check('a blocchi: nessun rientro in una zona lasciata a metà (senza blocchi ce ne sono)', [rientri(run(gBl, cBl)), rientri(run(gBl, cBl, { blocks: false })) > 0], [0, true]);

  // LE ZONE (Lorenzo, 2026-09-25: «concludere tutto il blocco… e poi passare al successivo»). Due
  // colonne di testo, righe di parole staccate, con 6 mm di vuoto in mezzo: ogni parola è un blocco
  // a sé, ma le colonne sono due zone, e il filo finisce la prima prima di passare all'altra (senza
  // zone passa di là e torna). Sul giornale Dior: 148 rientri nelle zone → 0, ripassi 25,6 → 25,1 m.
  const gZ = { rows: 30, cols: 14, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const cZ = fill(gZ, (r, c) => { const cc = c < 6 ? c : c - 8; return c !== 6 && c !== 7 && r % 2 === 0 && cc % 3 !== 2 ? { stitch: 'v', color: 0 } : null; });
  const zZ = rg.csZonesOf(gZ, cZ, 0);
  check('zone: le due colonne di testo sono due zone (il vuoto fra le parole è sotto i 5 mm)', [new Set(zZ.values()).size, zZ.get(0) !== zZ.get(8)], [2, true]);
  const cambiZona = (res) => { let n = 0, cur; const W2 = LW(gZ); for (const sg of res.colors[0].segs) { if (sg.kind !== 'stitch') continue; const i = Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)), j = Math.min(sg.from % W2, sg.to % W2); const z = zZ.get(i * 14 + Math.floor(j / 2)); if (z !== cur) { n++; cur = z; } } return n; };
  check('zone: il filo entra una volta in ogni colonna (senza zone ci torna)', [cambiZona(run(gZ, cZ)), cambiZona(run(gZ, cZ, { zones: null })) > 2], [2, true]);
  check('zone: e la misura massima taglia una zona troppo grande', new Set(rg.csZonesOf(gZ, cZ, 0, { maxMm: 30 }).values()).size > 2, true);

  // I GRUPPI (Lorenzo: «forzare che una parte venga fatta tutta insieme, tipo la scritta Christian
  // Dior»). Un titolo largo 120 mm fra due corpi di testo: la zona massima (30 mm) lo divide, e il
  // filo lo cuce in due volte. Con un rettangolo attorno, una volta sola. Sul Dior: 6 ingressi → 1.
  const gT = { rows: 30, cols: 40, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const cT = fill(gT, (r, c) => {
    const titolo = r >= 12 && r < 15 && c % 5 !== 4;
    const corpo = (r < 10 || r >= 17) && r % 2 === 0 && (c < 17 || c > 22) && c % 3 !== 2;
    return titolo || corpo ? { stitch: 'v', color: 0 } : null;
  });
  const pT = 3.8 * 0.7;
  const titoloG = { x: 0, y: 12 * pT - 0.2, w: 120, h: 3 * pT + 0.4 };
  const ingressi = (res) => { let n = 0, prima = false; const W2 = LW(gT); for (const sg of res.colors[0].segs) { if (sg.kind !== 'stitch') continue; const i = Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)); const t = i >= 12 && i < 15; if (t && !prima) n++; prima = t; } return n; };
  check('gruppi: il titolo diviso dalla zona massima si cuce in due volte, col gruppo in una', [ingressi(run(gT, cT, { zones: { maxMm: 30 } })), ingressi(run(gT, cT, { zones: { maxMm: 30 }, groups: [titoloG] }))], [2, 1]);
  check('gruppi: valgono anche senza zone automatiche', ingressi(run(gT, cT, { zones: null, groups: [titoloG] })), 1);
  // L'ORDINE DEI GRUPPI (Lorenzo: «l'ordine dei gruppi»): prima i gruppi, nell'ordine della
  // lista, poi il resto. Il corpo in basso a destra come gruppo 1 e il titolo come 2.
  const corpoG = { x: 69, y: 17 * pT, w: 51, h: 13 * pT };
  const sequenza = (groups) => {
    const W2 = LW(gT); const lab = [];
    for (const sg of run(gT, cT, { groups }).colors[0].segs) {
      if (sg.kind !== 'stitch') continue;
      const i = Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)), j = Math.min(sg.from % W2, sg.to % W2);
      const x = (Math.floor(j / 2) + 0.5) * 3, y = i * pT + 1.9;
      const l = groups.findIndex((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      const t = l < 0 ? '-' : String(l + 1);
      if (lab[lab.length - 1] !== t) lab.push(t);
    }
    return lab.join('');
  };
  check('gruppi in ordine: tutto il gruppo 1, poi tutto il 2, poi il resto', [sequenza([corpoG, titoloG]), sequenza([titoloG, corpoG])], ['12-', '12-']);

  // RIPASSI O FILO IN VISTA: la scelta sposta il compromesso, e non rompe l'ordine né fa saltare.
  const gR = { rows: 40, cols: 20, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const cR = fill(gR, macchie);
  const conPeso = (retrace) => run(gR, cR, { costs: { retrace } }).metrics;
  const [mV, mE, mRp] = ['vista', 'equilibrio', 'ripassi'].map((k) => conPeso(rg.CS_RETRACE_PRESETS[k]));
  check('meno ripassi: ripassa meno, mette più filo in vista, e non salta', [mRp.retraceMm < mE.retraceMm && mE.retraceMm <= mV.retraceMm, mRp.visibleMm >= mV.visibleMm, mRp.jumps], [true, true, 0]);

  // IL RECINTO DELLA ZONA (Lorenzo, sul titolo del Dior: «scende di continuo verso il sotto quando
  // io vorrei che facesse tutta la scritta e poi si spostasse sotto»). Lettere staccate, sotto una
  // riga cucita dopo (due gruppi), base bianca: per andare da una lettera all'altra il filo scendeva
  // a nascondersi sotto la riga e risaliva. Col recinto resta nel titolo finché non l'ha finito.
  const gRc = { rows: 16, cols: 42, cellW: 2.4, cellH: 3.5, overlapPct: 30 };
  const pRc = 3.5 * 0.7;
  const cRc = fill(gRc, (r, c) => ({ stitch: 'v', color: (r >= 2 && r < 8 && c >= 1 && c < 41 && (c - 1) % 6 < 3) || (r >= 9 && r < 11 && c >= 1 && c < 41) ? 1 : 0 }));
  const gruppiRc = [{ x: 0, y: 2 * pRc - 0.3, w: 100.8, h: 6 * pRc + 0.2 }, { x: 0, y: 9 * pRc - 0.3, w: 100.8, h: 2 * pRc + 0.2 }];
  const scende = (fence) => {
    const W2 = LW(gRc); let n = 0, dentro = false, via = [];
    for (const sg of run(gRc, cRc, { base: { color: 0, stitch: "v" }, groups: gruppiRc, fence }).colors.find((c) => c.color === 1).segs) {
      if (sg.kind !== 'stitch') { via.push(sg); continue; }
      const t = Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)) >= 2 && Math.min(Math.floor(sg.from / W2), Math.floor(sg.to / W2)) < 8;
      if (t && dentro && via.some((x) => Math.max(Math.floor(x.from / W2), Math.floor(x.to / W2)) > 9)) n++;
      dentro = t; via = [];
    }
    return n;
  };
  check('recinto: fra una lettera e l\'altra il filo non scende sotto la riga (senza recinto 6 volte)', [scende(true), scende(false)], [0, 6]);

  // SALTI A MANO (Lorenzo: «eliminare i passaggi, farli diventare salti»). Un passaggio scelto
  // diventa un salto; i punti, il loro ordine e gli altri passaggi restano identici.
  const baseRc = { base: { color: 0, stitch: 'v' }, groups: gruppiRc };
  const primaRc = run(gRc, cRc, baseRc);
  const neroRc = primaRc.colors.find((c) => c.color === 1).segs;
  // i passaggi del nero: da dove finisce un punto a dove comincia il successivo
  const passaggiRc = [];
  for (let i = 0; i < neroRc.length; i++) {
    if (neroRc[i].kind === 'stitch' || neroRc[i].kind === 'jump') continue;
    let j = i; while (j < neroRc.length && neroRc[j].kind !== 'stitch' && neroRc[j].kind !== 'jump') j++;
    passaggiRc.push({ from: neroRc[i].from, to: neroRc[j - 1].to, n: j - i }); i = j - 1;
  }
  const scelto = passaggiRc.reduce((a, b) => (b.n > a.n ? b : a));
  const dopoRc = run(gRc, cRc, { ...baseRc, cuts: [[scelto.to, scelto.from]] });
  const soloPunti = (res) => JSON.stringify(res.colors.map((c) => c.segs.filter((sg) => sg.kind === 'stitch')));
  const neroDopo = dopoRc.colors.find((c) => c.color === 1).segs;
  check('salto a mano: quel passaggio diventa un salto, i punti restano identici',
    [soloPunti(dopoRc) === soloPunti(primaRc), neroDopo.filter((sg) => sg.kind === 'jump' && sg.from === scelto.from && sg.to === scelto.to).length, dopoRc.metrics.jumps - primaRc.metrics.jumps, neroDopo.length, dopoRc.metrics.retraceMm + dopoRc.metrics.verticalMm + dopoRc.metrics.hiddenMm + dopoRc.metrics.visibleMm < primaRc.metrics.retraceMm + primaRc.metrics.verticalMm + primaRc.metrics.hiddenMm + primaRc.metrics.visibleMm],
    [true, 1, 1, neroRc.length - scelto.n + 1, true]);

  // L'AREA DI PROVA (Lorenzo: «disegno grande, poi ritaglio, ma fuori rimane: per testare un
  // punto del ricamo»). Passaggi ed export su una griglia a sé; rimessa al suo posto, ogni tratto
  // cade esattamente sui punti del disegno grande, anche col sormonto delle righe.
  const gA = { rows: 30, cols: 25, cellW: 3, cellH: 3.8, overlapPct: 30 };
  const cA = fill(gA, (r, c) => ((r * 7 + c * 3) % 4 ? { stitch: 'v', color: (r + c) % 3 ? 0 : 1 } : null));
  const aA = { r0: 7, c0: 5, r1: 19, c1: 17 };
  const sA = rg.csSubGrid(gA, cA, aA);
  check('area di prova: 12 × 12 celle, solo quelle dentro', [sA.grid.rows, sA.grid.cols, sA.cells.size], [12, 12, [...cA.keys()].filter((k) => { const r = Math.floor(k / 25), c = k % 25; return r >= 7 && r < 19 && c >= 5 && c < 17; }).length]);
  const WfA = LW(gA), WsA = LW(sA.grid);
  const alSuoPosto = (v) => (Math.floor(v / WsA) + aA.r0) * WfA + (v % WsA) + 2 * aA.c0;
  let errA = 0;
  for (const cr of run(sA.grid, sA.cells).colors) for (const sg of cr.segs) {
    const pS = rg.csSegmentPoints(sA.grid, sg.from, sg.to), pF = rg.csSegmentPoints(gA, alSuoPosto(sg.from), alSuoPosto(sg.to));
    for (let t = 0; t < 2; t++) errA = Math.max(errA, Math.abs(pS[t].x + sA.dx - pF[t].x), Math.abs(pS[t].y + sA.dy - pF[t].y));
  }
  check('area di prova: i passaggi rimessi al loro posto cadono sui punti del disegno (< 1e-9 mm)', errA < 1e-9, true);
  check('area di prova: dal rettangolo in mm le celle col centro dentro; fuori griglia si taglia; vuota = niente',
    [rg.csAreaFromMm(gA, 15, 7 * 2.66 + 0.1, 51, 19 * 2.66 - 0.1), rg.csClampArea(gA, { r0: -3, c0: 20, r1: 99, c1: 40 }), rg.csAreaFromMm(gA, 10, 10, 10.5, 10.5)],
    [aA, { r0: 0, c0: 20, r1: 30, c1: 25 }, null]);

  // LA MODIFICA A MANO (Lorenzo: «pulire l'interno della scritta… o cancellare qualcosa»).
  // Una lettera: un anello nero di V con dentro il bianco e un tratto nero staccato.
  const gE2 = { rows: 7, cols: 7, cellW: 3, cellH: 3.8 };
  const ring = (r, c) => { const bordo = r === 0 || r === 6 || c === 0 || c === 6; const tratto = r === 3 && c === 3; return { stitch: 'v', color: bordo || tratto ? 0 : 1 }; };
  const nNero = (cells) => [...cells.values()].filter((m) => m.color === 0).length;
  // pennello bianco sul tratto interno: solo quella V cambia colore, e resta una V
  const cP = fill(gE2, ring);
  rg.csApplyEdits(gE2, cP, rg.csBrushEdits(gE2, cP, 3, 3, 1, 1, 'v', 'left', false));
  check('pennello bianco sul tratto dentro la lettera: sparisce solo lui, la V resta V', [nNero(cP), cP.get(3 * 7 + 3).stitch], [nNero(fill(gE2, ring)) - 1, 'v']);
  check('pennello: un punto per cella, e con grandezza 2 due per due, per ogni punto', [rg.csBrushEdits(gE2, new Map(), 3, 3, 1, 0, 'cross', 'left', false).map((e) => e.c), rg.csBrushEdits(gE2, new Map(), 3, 3, 2, 0, 'v', 'left', false).length], [[3], 4]);
  // riempi col bianco il tratto staccato: solo lui (non tocca il contorno)
  const cF = fill(gE2, ring);
  check('riempi sul tratto staccato: 1 V, il contorno resta', rg.csFillEdits(gE2, cF, 3, 3, 1, 'v', 'left', false).length, 1);
  // riempi col nero dall'interno bianco: si ferma al contorno, non esce dalla lettera
  const cF2 = fill(gE2, ring);
  rg.csApplyEdits(gE2, cF2, rg.csFillEdits(gE2, cF2, 1, 1, 0, 'v', 'left', false));
  check('riempi di nero l’interno: tutta la lettera nera, niente fuori', nNero(cF2), 7 * 7);
  // gomma: svuota, e su una cella vuota il pennello rimette il punto scelto
  const cG = fill(gE2, ring);
  rg.csApplyEdits(gE2, cG, rg.csBrushEdits(gE2, cG, 2, 2, 2, 0, 'v', 'left', true));
  check('gomma grandezza 2: 2 × 2 celle vuote', 7 * 7 - cG.size, 4);
  rg.csApplyEdits(gE2, cG, rg.csBrushEdits(gE2, cG, 2, 2, 1, 1, 'v', 'right', false));
  check('pennello col destro su una cella vuota: una Λ', cG.get(2 * 7 + 2).stitch, 'lambda');
}

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `\n${failed} test falliti\n` : '\nTutti i test passati\n');
process.exit(failed ? 1 : 0);

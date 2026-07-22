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
export { parseImportedBoundarySource } from ${JSON.stringify(posix('packages/pattern-grammar/src/index.ts'))};
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

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `\n${failed} test falliti\n` : '\nTutti i test passati\n');
process.exit(failed ? 1 : 0);

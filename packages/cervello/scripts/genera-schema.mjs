// Scrive packages/cervello/params.schema.json dal registro. `npm run genera:schema`.
// Con `--stampa` scrive il JSON su stdout invece che sul file (lo usa lo smoke test per confrontarlo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

/** Il testo esatto che deve stare nel file: JSON a due spazi, newline finale, LF (le righe non cambiano da Windows). */
export async function testoSchema(nome = 'schema-' + process.pid) {
  const outDir = join(root, 'test', '.build');
  mkdirSync(outDir, { recursive: true });
  const esbuild = await import('esbuild');
  const outfile = join(outDir, `${nome}.mjs`);
  await esbuild.build({
    entryPoints: [join(root, 'packages/cervello/src/schema.ts')],
    bundle: true, format: 'esm', platform: 'neutral', outfile, logLevel: 'error',
  });
  const m = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  return JSON.stringify(m.generaSchema(), null, 2) + '\n';
}

export const FILE_SCHEMA = join(root, 'packages', 'cervello', 'params.schema.json');

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const testo = await testoSchema();
  if (process.argv.includes('--stampa')) process.stdout.write(testo);
  else {
    writeFileSync(FILE_SCHEMA, testo, 'utf8');
    console.log(`params.schema.json scritto (${(testo.length / 1024).toFixed(0)} kB)`);
  }
}

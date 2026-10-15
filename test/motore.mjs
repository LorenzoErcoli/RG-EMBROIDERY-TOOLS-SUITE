// Il cricchetto del contratto del motore (K1b): per un tool, importa apps/<tool>/src/motore.ts e test/prove/<tool>.ts,
// chiama `genera` coi valori di partenza su un ingresso di prova e controlla che esca un ricamo vero.
// Lo usano lo smoke test (`npm test`) e la riga di comando `node test/motore.mjs <tool>`, per chi sta avvolgendo un tool.
//
// Cosa deve fare test/prove/<tool>.ts:  export async function prova(): Promise<{
//   ingresso, params,                         // l'ingresso di prova e i valori di partenza (come li salva il tool)
//   diretto(): ExportLayer[] | Promise<...>,  // gli strati come li dava la strada di PRIMA (la porta d'ingresso vecchia)
// }>
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const posix = (p) => join(root, p).replace(/\\/g, '/');

/** Costruisce (esbuild) e carica `motore` + `prova` di un tool, più `dstFromExportLayers` e `readDst` del core. */
export async function caricaMotore(tool) {
  const outDir = join(here, '.build');
  mkdirSync(outDir, { recursive: true });
  const esbuild = await import('esbuild');
  const outfile = join(outDir, `motore-${tool}-${process.pid}.mjs`);
  await esbuild.build({
    stdin: {
      contents: `export { motore } from ${JSON.stringify(posix(`apps/${tool}/src/motore.ts`))};
export { prova } from ${JSON.stringify(posix(`test/prove/${tool}.ts`))};
export { dstFromExportLayers, readDst, misuraDst } from ${JSON.stringify(posix('packages/core/src/index.ts'))};`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'neutral', outfile, logLevel: 'silent',
    alias: { '@rg/core': posix('packages/core/src/index.ts'), '@rg/pattern-grammar': posix('packages/pattern-grammar/src/index.ts'), '@rg/cervello': posix('packages/cervello/src/index.ts') },
  });
  const { pathToFileURL: u } = await import('node:url');
  return import(u(outfile).href + `?t=${Date.now()}`);
}

const puntiCuciti = (strati) => strati.filter((l) => !l.shapeOnly).reduce((n, l) => n + l.polylines.reduce((m, pl) => m + pl.length, 0), 0);
const stessiStrati = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Ritorna l'elenco dei problemi (vuoto = il tool rispetta il contratto). Se il tool non ha ancora motore/prova
 * il problema è il caricamento stesso: così un tool nel debito «fallisce» e uno finito «passa».
 */
export async function controllaMotore(tool) {
  const guai = [];
  let m;
  try { m = await caricaMotore(tool); } catch (e) { return [`non si carica: ${String(e.message ?? e).split('\n')[0]}`]; }
  if (!m.motore || typeof m.motore.genera !== 'function') return ['apps/' + tool + '/src/motore.ts non esporta `motore` con `genera`'];
  if (m.motore.id !== tool) guai.push(`motore.id è «${m.motore.id}», dovrebbe essere «${tool}»`);
  if (typeof document !== 'undefined' || typeof window !== 'undefined') guai.push('il test gira con un DOM: non prova niente');
  let p;
  try { p = await m.prova(); } catch (e) { return [`la prova non parte: ${String(e.message ?? e).split('\n')[0]}`]; }
  let r;
  try { r = await m.motore.genera(p.ingresso, p.params); } catch (e) { return [`genera ha lanciato: ${String(e.message ?? e).split('\n')[0]}`]; }
  if (!Array.isArray(r?.strati)) return ['genera non ritorna `strati`'];
  if (!Array.isArray(r.avvisi)) guai.push('genera non ritorna `avvisi` (anche vuoto)');
  if (r.busta !== undefined) guai.push('la busta deve restare vuota fino alla K2');
  const n = puntiCuciti(r.strati);
  if (n === 0) return [...guai, 'gli strati sono vuoti: nessun punto cucito'];
  // Il DST che esce si rilegge con lo stesso numero di punti.
  try {
    const dst = m.dstFromExportLayers(r.strati, { label: tool.toUpperCase().slice(0, 16) });
    const letto = m.readDst(dst);
    const rilet = letto.blocks.reduce((k, b) => k + b.points_mm.length, 0);
    if (rilet !== n) guai.push(`il DST rilegge ${rilet} punti, gli strati ne hanno ${n}`);
  } catch (e) { guai.push(`il DST non si fa: ${String(e.message ?? e).split('\n')[0]}`); }
  // Il referto (K3): c'è, ed è quello dei byte del DST che il tool esporta davvero (non di una ricostruzione).
  try {
    if (!r.misure) guai.push('manca `misure`: il referto del DST (K3)');
    else {
      const vero = typeof p.dst === 'function' ? await p.dst() : m.dstFromExportLayers(r.strati, { label: tool.toUpperCase().slice(0, 16) });
      const atteso = m.misuraDst(vero);
      const { filoInVista, ...dato } = r.misure; // il filo in vista lo passa il tool: dal DST non si ricava
      if (JSON.stringify(dato) !== JSON.stringify(atteso)) {
        const chiavi = Object.keys(atteso).filter((k) => JSON.stringify(atteso[k]) !== JSON.stringify(dato[k]));
        guai.push('misure diverse da misuraDst del DST del tool: ' + chiavi.join(', '));
      }
    }
  } catch (e) { guai.push(`il referto non si confronta: ${String(e.message ?? e).split('\n')[0]}`); }
  // Lo stesso ricamo di prima dell'avvolgimento.
  if (typeof p.diretto === 'function') {
    const prima = await p.diretto();
    if (!stessiStrati(prima, r.strati)) guai.push(`gli strati non sono identici a quelli della strada diretta (${puntiCuciti(prima)} punti prima, ${n} dopo)`);
  } else guai.push('la prova non dice la strada diretta (`diretto`): senza, non si confronta il prima col dopo');
  return guai;
}

// --- riga di comando -------------------------------------------------------------------------------------
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const tool = process.argv[2];
  if (!tool) { console.log('uso: node test/motore.mjs <tool>'); process.exit(2); }
  const guai = await controllaMotore(tool);
  console.log(guai.length ? `${tool}: ${guai.length} problemi\n  - ${guai.join('\n  - ')}` : `${tool}: ok`);
  process.exit(guai.length ? 1 : 0);
}

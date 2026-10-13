// Il cricchetto del registro dei parametri (K1): carica il registro e ciò che i tool salvano, e li confronta.
// Lo usano lo smoke test (`npm test`) e la riga di comando `node test/registro.mjs <tool> [--salvati]`,
// che serve a chi sta descrivendo un tool per vedere cosa manca senza far girare tutto.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Costruisce (esbuild) e carica il registro + `SALVATI`. `nome` evita che due chiamate si pestino il file. */
export async function caricaRegistro(nome = 'registro-' + process.pid) {
  const outDir = join(here, '.build');
  mkdirSync(outDir, { recursive: true });
  const esbuild = await import('esbuild');
  const outfile = join(outDir, `${nome}.mjs`);
  await esbuild.build({
    stdin: {
      contents: `export * from './packages/cervello/src/index.ts'; export { SALVATI } from './test/salvati/indice.ts';`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'neutral', outfile, logLevel: 'error',
    alias: { '@rg/core': join(root, 'packages/core/src/index.ts').replace(/\\/g, '/'), '@rg/pattern-grammar': join(root, 'packages/pattern-grammar/src/index.ts').replace(/\\/g, '/') },
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

/** Gli id dei tool della suite, letti da `packages/ui/src/tools.ts` (il file tocca il DOM: non si importa, si legge). */
export function toolDellaSuite() {
  const src = readFileSync(join(root, 'packages/ui/src/tools.ts'), 'utf8');
  const blocco = src.slice(src.indexOf('export const TOOLS'), src.indexOf('];', src.indexOf('export const TOOLS')));
  return [...blocco.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]);
}

const UNITA = ['mm', 'mm2', 'deg', '%', 'px', 'dpi', 'rapporto', 'peso', 's', ''];
const TIPI = ['num', 'int', 'bool', 'enum', 'testo'];

/** Controlli sul registro in sé. Ritorna l'elenco dei problemi (vuoto = a posto). */
export function controllaRegistro(r) {
  const guai = [];
  const concetti = new Set(r.ELENCO_CONCETTI.map((c) => c.id));
  for (const c of r.ELENCO_CONCETTI) if (!c.descrizione?.trim()) guai.push(`concetto «${c.id}» senza descrizione`);
  for (const p of r.REGISTRO) {
    const q = (m) => guai.push(`${p.id}: ${m}`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.id)) q('id non è camelCase inglese (D1)');
    if (!p.etichetta?.trim()) q('manca l’etichetta');
    if (!p.aiuto?.trim()) q('manca l’aiuto');
    if (!TIPI.includes(p.tipo)) q(`tipo «${p.tipo}» sconosciuto`);
    if (!UNITA.includes(p.unita)) q(`unità «${p.unita}» sconosciuta`);
    if (!concetti.has(p.concetto)) q(`concetto «${p.concetto}» non dichiarato`);
    for (const x of p.regole) if (!/^R([1-9]|[12]\d|3[01])$/.test(x)) q(`regola «${x}» non esiste (R1–R31)`);
    if (p.min !== undefined && p.max !== undefined && p.min > p.max) q('min > max');
    if (p.tipo === 'enum' && !p.opzioni?.length) q('enum senza opzioni');
    if (p.tipo !== 'enum' && p.opzioni) q('opzioni su un parametro che non è enum');
    if ((p.tipo === 'bool' || p.tipo === 'enum' || p.tipo === 'testo') && p.unita) q('unità su un parametro che non è un numero');
    if (!Object.keys(p.tool).length) q('nessun tool lo usa');
    for (const [t, u] of Object.entries(p.tool)) {
      const v = u.predefinito;
      const tipo = p.tipo;
      if (tipo === 'bool' && typeof v !== 'boolean') q(`[${t}] default ${JSON.stringify(v)} non è un booleano`);
      if ((tipo === 'num' || tipo === 'int') && v !== null && typeof v !== 'number') q(`[${t}] default ${JSON.stringify(v)} non è un numero`);
      if (tipo === 'int' && typeof v === 'number' && !Number.isInteger(v)) q(`[${t}] default ${v} non è intero`);
      if (tipo === 'enum' && !(u.opzioni ?? p.opzioni ?? []).includes(v)) q(`[${t}] default ${JSON.stringify(v)} fuori dalle opzioni`);
      const lo = u.min ?? p.min, hi = u.max ?? p.max;
      if (typeof v === 'number' && lo !== undefined && v < lo) q(`[${t}] default ${v} sotto il minimo ${lo}`);
      if (typeof v === 'number' && hi !== undefined && v > hi) q(`[${t}] default ${v} sopra il massimo ${hi}`);
    }
  }
  return guai;
}

/**
 * Il cricchetto per un tool: cosa il tool salva (dai suoi default) contro cosa il registro descrive.
 * Ritorna { salvati, nonRegistrati, registratiMaNonSalvati, defaultDiversi, debitoSuperato, debitoVecchio }.
 */
export function confronta(r, tool) {
  const fn = r.SALVATI[tool];
  const salvati = fn ? fn() : null;
  const debito = r.DEBITO[tool] ?? {};
  if (!salvati) return { tool, salvati: null, nonRegistrati: [], registratiMaNonSalvati: [], defaultDiversi: [], debitoSuperato: [], debitoVecchio: [] };
  const registrati = new Map(r.REGISTRO.filter((p) => p.tool[tool]).map((p) => [r.percorso(p.tool[tool]), p]));
  const nonRegistrati = Object.keys(salvati).filter((k) => !registrati.has(k) && !(k in debito));
  const registratiMaNonSalvati = [...registrati.keys()].filter((k) => !(k in salvati));
  const defaultDiversi = [...registrati.keys()].filter((k) => k in salvati && JSON.stringify(registrati.get(k).tool[tool].predefinito) !== JSON.stringify(salvati[k]))
    .map((k) => `${k}: registro ${JSON.stringify(registrati.get(k).tool[tool].predefinito)}, codice ${JSON.stringify(salvati[k])}`);
  const debitoSuperato = Object.keys(debito).filter((k) => registrati.has(k));
  const debitoVecchio = Object.keys(debito).filter((k) => !(k in salvati));
  return { tool, salvati, nonRegistrati, registratiMaNonSalvati, defaultDiversi, debitoSuperato, debitoVecchio };
}

// --- riga di comando -------------------------------------------------------------------------------------
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [tool, ...opz] = process.argv.slice(2);
  const r = await caricaRegistro();
  if (!tool) {
    const guai = controllaRegistro(r);
    console.log(`registro: ${r.REGISTRO.length} parametri · ${guai.length} problemi`);
    for (const g of guai) console.log('  - ' + g);
    for (const t of r.ORDINE_TOOL) {
      const c = confronta(r, t);
      console.log(`${t}: salva ${Object.keys(c.salvati ?? {}).length} · non registrati ${c.nonRegistrati.length} · registrati ma non salvati ${c.registratiMaNonSalvati.length} · default diversi ${c.defaultDiversi.length}`);
    }
  } else {
    const c = confronta(r, tool);
    if (opz.includes('--salvati')) console.log(JSON.stringify(c.salvati, null, 1));
    else {
      console.log(`${tool}: salva ${Object.keys(c.salvati ?? {}).length} parametri`);
      for (const [k, v] of Object.entries(c)) if (Array.isArray(v) && k !== 'salvati') console.log(`  ${k} (${v.length})${v.length ? ':\n    ' + v.join('\n    ') : ''}`);
      const guai = controllaRegistro(r).filter((g) => true);
      console.log(`problemi interni al registro (tutti i tool): ${guai.length}${guai.length ? '\n  - ' + guai.join('\n  - ') : ''}`);
    }
  }
}

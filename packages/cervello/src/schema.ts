// params.schema.json, generato dal registro (mai a mano). Serve al satellite Python (bitmap_to_stitch) e all'agente.
// Si rigenera con `npm run genera:schema`; lo smoke test fallisce se il file committato non coincide.
import { REGISTRO, ELENCO_CONCETTI, ORDINE_TOOL, percorso } from './parametri';
import type { Parametro, UsoTool } from './tipi';

type Json = Record<string, unknown>;

const tipoJson = (p: Parametro): string => (p.tipo === 'int' ? 'integer' : p.tipo === 'num' ? 'number' : p.tipo === 'bool' ? 'boolean' : 'string');

function definizione(p: Parametro): Json {
  return {
    type: tipoJson(p),
    title: p.etichetta,
    description: p.aiuto,
    ...(p.unita ? { 'x-unita': p.unita } : {}),
    ...(p.min !== undefined ? { minimum: p.min } : {}),
    ...(p.max !== undefined ? { maximum: p.max } : {}),
    ...(p.passo !== undefined ? { 'x-passo': p.passo } : {}),
    ...(p.opzioni ? { enum: p.opzioni } : {}),
    ...(p.regole.length ? { 'x-regole': p.regole } : {}),
    'x-concetto': p.concetto,
    ...(p.sinonimi.length ? { 'x-sinonimi': p.sinonimi } : {}),
  };
}

function voceTool(p: Parametro, u: UsoTool): Json {
  return {
    $ref: `#/$defs/${p.id}`,
    ...(u.predefinito !== null ? { default: u.predefinito } : {}),
    ...(u.etichetta ? { title: u.etichetta } : {}),
    ...(u.aiuto ? { description: u.aiuto } : {}),
    ...(u.min !== undefined ? { minimum: u.min } : {}),
    ...(u.max !== undefined ? { maximum: u.max } : {}),
    ...(u.opzioni ? { enum: u.opzioni } : {}),
    ...(u.nome !== p.id ? { 'x-id': p.id } : {}),
  };
}

export function generaSchema(): Json {
  const defs: Json = {};
  for (const p of REGISTRO) defs[p.id] = definizione(p);

  const strumenti: Json = {};
  for (const t of ORDINE_TOOL) {
    const props: Json = {};
    for (const p of REGISTRO) if (p.tool[t]) props[percorso(p.tool[t])] = voceTool(p, p.tool[t]);
    strumenti[t] = { type: 'object', properties: props };
  }

  const concetti: Json = {};
  for (const c of ELENCO_CONCETTI) concetti[c.id] = { descrizione: c.descrizione, parametri: REGISTRO.filter((p) => p.concetto === c.id).map((p) => p.id) };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'RG Tools — parametri del ricamo',
    description: 'GENERATO da packages/cervello/src/parametri.ts (npm run genera:schema): non si modifica a mano. Per ogni tool, i parametri che salva nel file di progetto, col nome con cui li salva (la chiave), il default e la definizione comune in $defs.',
    type: 'object',
    properties: strumenti,
    $defs: defs,
    'x-concetti': concetti,
  };
}

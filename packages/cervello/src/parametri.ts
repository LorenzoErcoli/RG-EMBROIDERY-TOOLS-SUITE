// Il registro dei parametri: ogni parametro di ogni tool, dichiarato una volta (AVVIO-CERVELLO-RICAMO §3a).
//
// Le dichiarazioni stanno in `tool/<id>.ts`, una per tool, perché ognuna si scrive con quel tool
// davanti. Qui si fondono per `id`. Regola di fusione:
//   - lo stesso `id` in due tool vuol dire la stessa cosa: devono concordare su tipo, unità e concetto,
//     altrimenti il registro NON si carica (una divergenza è una decisione, non un dettaglio: regola 7);
//   - etichetta, aiuto, limiti e default possono cambiare da tool a tool: la prima dichiarazione
//     (nell'ordine di `ORDINE_TOOL`) è la descrizione comune, le altre lasciano la loro differenza in `tool[...]`;
//   - nomi diversi per lo stesso concetto NON si fondono: restano parametri distinti, con lo stesso `concetto`.
import type { Concetto, DichiarazioneParametro, Parametro, SchedaParametri, UsoTool } from './tipi';
import { CONCETTI } from './concetti';
import { scheda as net45 } from './tool/net-45';
import { scheda as patternGrammar } from './tool/pattern-grammar';
import { scheda as interlace } from './tool/interlace';
import { scheda as oblique } from './tool/oblique';
import { scheda as crossStitch } from './tool/cross-stitch';
import { scheda as bitmap } from './tool/bitmap';
import { scheda as striatura } from './tool/striatura';
import { scheda as zonePattern } from './tool/zone-pattern';
import { scheda as cannageRafia } from './tool/cannage-rafia';
import { scheda as broccato } from './tool/broccato';
import { scheda as sfrangiatura } from './tool/sfrangiatura';
import { scheda as pettine } from './tool/pettine';
import { scheda as razza } from './tool/razza';
import { scheda as patternMacchie } from './tool/pattern-macchie';
import { scheda as pittorico } from './tool/pittorico';
import { scheda as reteTestaSpeciale } from './tool/rete-testa-speciale';
import { scheda as puntoMaglia } from './tool/punto-maglia';

/** Le schede dei tool, nell'ordine della suite (`TOOLS` in `packages/ui/src/tools.ts`). */
export const SCHEDE: Record<string, SchedaParametri> = {
  'net-45': net45,
  'pattern-grammar': patternGrammar,
  interlace,
  oblique,
  'cross-stitch': crossStitch,
  bitmap,
  striatura,
  'zone-pattern': zonePattern,
  'cannage-rafia': cannageRafia,
  broccato,
  sfrangiatura,
  pettine,
  razza,
  'pattern-macchie': patternMacchie,
  pittorico,
  'rete-testa-speciale': reteTestaSpeciale,
  'punto-maglia': puntoMaglia,
};

export const ORDINE_TOOL = Object.keys(SCHEDE);

/** Dove un parametro sta nel file di progetto: `params` è la radice, il resto è una chiave a parte. */
export function percorso(uso: Pick<UsoTool, 'nome' | 'dove'>): string {
  return uso.dove === 'params' ? uso.nome : `${uso.dove}.${uso.nome}`;
}

const stessa = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function fondi(): { parametri: Parametro[]; concetti: Concetto[] } {
  const concetti = new Map<string, Concetto>();
  for (const c of CONCETTI) concetti.set(c.id, c);
  for (const t of ORDINE_TOOL) {
    for (const c of SCHEDE[t].concetti ?? []) {
      const gia = concetti.get(c.id);
      if (gia && gia.descrizione !== c.descrizione) throw new Error(`Registro: il concetto «${c.id}» è descritto in due modi (tool ${t}).`);
      concetti.set(c.id, c);
    }
  }

  const perId = new Map<string, Parametro>();
  for (const t of ORDINE_TOOL) {
    for (const d of SCHEDE[t].parametri as DichiarazioneParametro[]) {
      const dove = d.dove ?? 'params';
      const uso: UsoTool = { nome: d.nome ?? d.id, dove, predefinito: d.predefinito };
      let p = perId.get(d.id);
      if (!p) {
        p = {
          id: d.id, etichetta: d.etichetta, aiuto: d.aiuto, tipo: d.tipo, unita: d.unita,
          ...(d.min !== undefined ? { min: d.min } : {}), ...(d.max !== undefined ? { max: d.max } : {}),
          ...(d.passo !== undefined ? { passo: d.passo } : {}), ...(d.opzioni ? { opzioni: d.opzioni } : {}),
          regole: [...(d.regole ?? [])], concetto: d.concetto, sinonimi: [...(d.sinonimi ?? [])], tool: {},
        };
        perId.set(d.id, p);
      } else {
        const dove0 = `«${d.id}» (tool ${t})`;
        if (p.tipo !== d.tipo) throw new Error(`Registro: ${dove0} ha tipo ${d.tipo}, ma altrove è ${p.tipo}. Stesso nome, cose diverse: serve una decisione (regola 7).`);
        if (p.unita !== d.unita) throw new Error(`Registro: ${dove0} ha unità «${d.unita}», ma altrove è «${p.unita}». Stesso nome, cose diverse: serve una decisione (regola 7).`);
        if (p.concetto !== d.concetto) throw new Error(`Registro: ${dove0} ha concetto «${d.concetto}», ma altrove è «${p.concetto}».`);
        if (d.etichetta !== p.etichetta) uso.etichetta = d.etichetta;
        if (d.aiuto !== p.aiuto) uso.aiuto = d.aiuto;
        if (d.min !== p.min && d.min !== undefined) uso.min = d.min;
        if (d.max !== p.max && d.max !== undefined) uso.max = d.max;
        if (d.passo !== p.passo && d.passo !== undefined) uso.passo = d.passo;
        if (d.opzioni && !stessa(d.opzioni, p.opzioni)) uso.opzioni = d.opzioni;
        for (const r of d.regole ?? []) if (!p.regole.includes(r)) p.regole.push(r);
        for (const s of d.sinonimi ?? []) if (!p.sinonimi.includes(s)) p.sinonimi.push(s);
      }
      if (p.tool[t]) throw new Error(`Registro: «${d.id}» è dichiarato due volte nel tool ${t}.`);
      p.tool[t] = uso;
    }
  }
  return { parametri: [...perId.values()], concetti: [...concetti.values()] };
}

const fuso = fondi();

/** Tutti i parametri di tutti i tool, fusi per `id`. */
export const REGISTRO: Parametro[] = fuso.parametri;
export const ELENCO_CONCETTI: Concetto[] = fuso.concetti;

/** Il parametro che un tool salva con quel percorso (`nome` o `dove.nome`), se è registrato. */
export function trova(tool: string, salvatoCome: string): Parametro | undefined {
  return REGISTRO.find((p) => p.tool[tool] && percorso(p.tool[tool]) === salvatoCome);
}

/** I parametri che un tool usa (K4: la parte «quali parametri» della scheda del tool), col come li salva e col suo default. */
export function parametriDelTool(tool: string): Parametro[] {
  return REGISTRO.filter((p) => p.tool[tool]);
}

/** I percorsi che un tool dichiara di salvare. */
export function percorsiRegistrati(tool: string): string[] {
  return REGISTRO.filter((p) => p.tool[tool]).map((p) => percorso(p.tool[tool]));
}

/** Per ogni concetto, i parametri che lo misurano oggi (`densita` → tutti i modi in cui la suite la misura). */
export function perConcetto(): Record<string, { id: string; tool: string[] }[]> {
  const out: Record<string, { id: string; tool: string[] }[]> = {};
  for (const p of REGISTRO) (out[p.concetto] ??= []).push({ id: p.id, tool: Object.keys(p.tool) });
  return out;
}

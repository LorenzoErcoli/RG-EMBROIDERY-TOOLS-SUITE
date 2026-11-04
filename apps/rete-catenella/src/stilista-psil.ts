// Le catenelle in Stilista come oggetti psil veri (Lorenzo, 2026-11-03: «sullo psil dammi la possibilità di scegliere se psil o no»).
// Il psil non si può creare da zero: si copia una catenella del documento aperto (POST /running), coi valori della maglia del tool
// (POST /parametri, misurati in sapere/codice/stilista-psil.md). Basi e passaggi sono copie di un running del documento.
import { trovaStilista, type FinestraStilista } from '@rg/ui/stilista';
import type { EsitoRete, ParametriRete, Xy } from './motore';

const POSTA = { 'X-RG-Link': '1', 'Content-Type': 'application/json' };
const PER_VOLTA = 150; // un invio blocca Stilista finché non ha finito

interface Stato { oggetti: number }
interface OggettoLetto { index: number; needle?: number; stitch_count?: number; parameters?: Array<{ Key: string; Value: string }> }

async function posta<T>(f: FinestraStilista, via: string, corpo: unknown): Promise<T> {
  const r = await fetch(`http://127.0.0.1:${f.porta}${via}`, { method: 'POST', headers: POSTA, body: JSON.stringify(corpo) });
  const j = await r.json() as T & { errore?: string };
  if (!r.ok) throw new Error(j.errore ?? `Stilista ha risposto ${r.status}`);
  return j;
}

/** Cerca nel documento una catenella psil e un running qualsiasi da copiare. */
async function trovaModelli(f: FinestraStilista, oggetti: number): Promise<{ catenella: number | null; running: number | null; ago: number }> {
  let catenella: number | null = null, running: number | null = null, ago = 1;
  for (let i = 0; i < oggetti && (catenella === null || running === null); i += 100) {
    const ids = Array.from({ length: Math.min(100, oggetti - i) }, (_, k) => i + k).join(',');
    const r = await fetch(`http://127.0.0.1:${f.porta}/selezione.json?oggetti=${ids}`);
    if (!r.ok) throw new Error(`Stilista ha risposto ${r.status}`);
    const j = await r.json() as { oggetti: OggettoLetto[] };
    for (const o of j.oggetti) {
      const par = new Map((o.parameters ?? []).map((x) => [x.Key, x.Value]));
      if (par.get('PITipoPunto') !== '1' || !o.stitch_count) continue; // una catenella a 0 punti: lì Stilista il psil non lo sa calcolare
      if (par.get('PIFlagPsil') === '32' && catenella === null) { catenella = o.index; ago = o.needle ?? 1; }
      else running ??= o.index;
    }
  }
  return { catenella, running, ago };
}

/** Una linea per ogni oggetto del ricamo, nell'ordine: basi e passaggi coi punti del tool, le catenelle col loro tracciato, che il psil lo calcola Stilista. */
export function lineePerStilista(e: EsitoRete, origine: Xy | null, modelli: { catenella: number; running: number }, dopo: number): Array<{ modello: number; dopo: number; contorno_mm: Xy[]; nome: string }> {
  const [ox, oy] = origine ?? [0, 0];
  const nel = (t: Xy[]): Xy[] => t.map(([x, y]) => [Math.round((x + ox) * 1000) / 1000, Math.round((y + oy) * 1000) / 1000]);
  return e.oggetti.filter((o) => o.t.length >= 2).map((o, i) => (o.tipo === 'catenella'
    ? { modello: modelli.catenella, dopo, contorno_mm: nel(o.t), nome: `catenella ${i + 1}` }
    : { modello: modelli.running, dopo, contorno_mm: nel(o.punti), nome: `${o.tipo} ${i + 1}` }));
}

export async function reteAStilista(e: EsitoRete, par: ParametriRete, origine: Xy | null, stato: (t: string) => void): Promise<void> {
  stato('Cerco Stilista…');
  try {
    const f = await trovaStilista();
    if (!f) throw new Error('non risponde: è aperto, con RG Stilista Link installato?');
    const s = await (await fetch(`http://127.0.0.1:${f.porta}/stato`)).json() as Stato;
    const { catenella, running, ago } = await trovaModelli(f, s.oggetti);
    if (catenella === null || running === null) {
      stato(`Stilista: il psil si copia da una catenella del documento aperto, e qui ${catenella === null ? 'non ce n’è una' : 'manca un running da copiare per le basi'}. Apri un file con le catenelle psil, o togli «Psil vero».`);
      return;
    }
    // una copia della catenella coi valori del tool fa da modello per tutte: l'originale non si tocca
    const prima = await posta<{ ok: boolean; oggetti_dopo: number; errori: string[] }>(f, '/running', { linee: [{ modello: catenella, dopo: s.oggetti - 1, contorno_mm: [[0, 0], [10, 0]], nome: 'modello catenella' }] });
    if (!prima.ok) throw new Error(prima.errori.join(' · ') || 'la copia del modello non è riuscita');
    const modello = prima.oggetti_dopo - 1;
    await posta(f, '/parametri', { oggetti: [{ indice: modello, parametri: {
      PIWidthPsil: Math.round(par.psilLunghezzaMm * 1000), PIHeightPsil: Math.round(par.psilLarghezzaMm * 1000), PIPSILSpacing: Math.round((par.psilPassoMm - par.psilLunghezzaMm) * 1000),
    } }] });
    const linee = lineePerStilista(e, origine, { catenella: modello, running }, 0);
    let dopo = modello, fatte = 0, punti = 0;
    const errori: string[] = [];
    for (let i = 0; i < linee.length; i += PER_VOLTA) {
      stato(`Invio a Stilista… ${i.toLocaleString('it-IT')} oggetti su ${linee.length.toLocaleString('it-IT')}`);
      const parte = linee.slice(i, i + PER_VOLTA).map((l) => ({ ...l, dopo }));
      const r = await posta<{ fatte: number; punti: number; oggetti_dopo: number; errori: string[] }>(f, '/running', { linee: parte });
      fatte += r.fatte; punti += r.punti; errori.push(...r.errori);
      dopo = r.oggetti_dopo - 1;
    }
    // come nel file ogni colonna ha il suo ago: il cambio avviene alla fine dell'uscita, fuori dal contorno
    if (!e.collegati && !errori.length) {
      stato('Invio a Stilista… gli aghi delle colonne');
      const buone = e.oggetti.filter((o) => o.t.length >= 2);
      const colonne = [...new Set(buone.map((o) => o.cella.colonna))].sort((a, b) => a - b);
      for (const [k, c] of colonne.entries()) {
        const indici = buone.flatMap((o, i) => (o.cella.colonna === c ? [modello + 1 + i] : []));
        await posta(f, '/ago', { oggetti: indici, ago: ago + k });
      }
    }
    await posta(f, `/cancella?oggetti=${modello}`, {});
    stato(`In Stilista: ${fatte.toLocaleString('it-IT')} oggetti su ${linee.length.toLocaleString('it-IT')}, ${punti.toLocaleString('it-IT')} punti, catenelle psil vere${errori.length ? `; ${errori.length} non riusciti: ${errori[0]}` : ''}`);
  } catch (x) {
    stato('Stilista: ' + (x as Error).message);
  }
}

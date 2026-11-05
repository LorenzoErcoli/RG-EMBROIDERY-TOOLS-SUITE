// Le catenelle in Stilista come oggetti psil veri (Lorenzo, 2026-11-03: «sullo psil dammi la possibilità di scegliere se psil o no»).
// Il psil non si può creare da zero: si copia una catenella del documento aperto (POST /running), coi valori della maglia del tool
// (POST /parametri, misurati in sapere/codice/stilista-psil.md). Basi e passaggi sono copie di un running del documento.
import { nomeDocumento, tutteLeFinestreOccupate, trovaStilista, type FinestraStilista } from '@rg/ui/stilista';
import type { EsitoRete, ParametriRete, Xy } from './motore';

const POSTA = { 'X-RG-Link': '1', 'Content-Type': 'application/json' };
const PER_VOLTA = 150; // un invio blocca Stilista finché non ha finito
// misurato: a 1,46 mm una catenella in Stilista resta a 0 punti, a 1,86 mm ne ha 7
const CATENELLA_MINIMA_MM = 1.5;

interface Stato { oggetti: number }
interface OggettoLetto { index: number; needle?: number; stitch_count?: number; source_point_count?: number; source_path?: { points?: Array<{ x_um: number; y_um: number }> }; parameters?: Array<{ Key: string; Value: string }> }

async function posta<T>(f: FinestraStilista, via: string, corpo: unknown): Promise<T> {
  const r = await fetch(`http://127.0.0.1:${f.porta}${via}`, { method: 'POST', headers: POSTA, body: JSON.stringify(corpo) });
  const j = await r.json() as T & { errore?: string };
  if (!r.ok) throw new Error(j.errore ?? `Stilista ha risposto ${r.status}`);
  return j;
}

/**
 * I modelli fra gli oggetti letti. Il psil vero ha `PIStitchStrassLaser` 4: `PIFlagPsil` 32 ce l'hanno anche i running normali (misurato il 2026-11-04 su
 * documenti di Lorenzo). Una catenella a 0 punti non serve: lì Stilista il psil non lo sa calcolare.
 */
export function scegliModelli(oggetti: OggettoLetto[]): { catenella: number | null; running: number | null; ago: number } {
  let catenella: number | null = null, running: number | null = null, ago = 1;
  for (const o of oggetti) {
    const par = new Map((o.parameters ?? []).map((x) => [x.Key, x.Value]));
    if (par.get('PITipoPunto') !== '1' || !o.stitch_count) continue;
    if (par.get('PIStitchStrassLaser') === '4') { if (catenella === null) { catenella = o.index; ago = o.needle ?? 1; } }
    else if (par.get('PIStitchStrassLaser') === '0') running ??= o.index;
  }
  return { catenella, running, ago };
}

/** La catenella selezionata in Stilista fa da modello; se non ce n'è una selezionata, si cerca nel documento. `index` nella risposta è il posto nella risposta, non nel documento: il posto vero è quello chiesto. */
async function trovaModelli(f: FinestraStilista, oggetti: number): Promise<{ catenella: number | null; running: number | null; ago: number; selezionata: boolean }> {
  const inizio = (o: OggettoLetto): string => { const q = o.source_path?.points?.[0]; return q ? `${q.x_um},${q.y_um},${o.source_point_count},${o.stitch_count}` : ''; };
  let cercata = '';
  if (f.selezionati > 0) {
    const r = await fetch(`http://127.0.0.1:${f.porta}/selezione.json`);
    if (r.ok) {
      const lette = (await r.json() as { oggetti: OggettoLetto[] }).oggetti;
      const k = scegliModelli(lette.map((o, n) => ({ ...o, index: n }))).catenella;
      if (k !== null) cercata = inizio(lette[k]);
    }
  }
  const scelta: ReturnType<typeof scegliModelli> = { catenella: null, running: null, ago: 1 };
  let selezionata = false;
  for (let i = 0; i < oggetti && (scelta.catenella === null || scelta.running === null || (cercata && !selezionata)); i += 100) {
    const ids = Array.from({ length: Math.min(100, oggetti - i) }, (_, k) => i + k);
    const r = await fetch(`http://127.0.0.1:${f.porta}/selezione.json?oggetti=${ids.join(',')}`);
    if (!r.ok) throw new Error(`Stilista ha risposto ${r.status}`);
    const lette = (await r.json() as { oggetti: OggettoLetto[] }).oggetti.map((o, n) => ({ ...o, index: ids[n] }));
    const trovati = scegliModelli(lette);
    if (scelta.catenella === null && trovati.catenella !== null) { scelta.catenella = trovati.catenella; scelta.ago = trovati.ago; }
    scelta.running ??= trovati.running;
    const quella = cercata && !selezionata ? lette.find((o) => inizio(o) === cercata) : undefined;
    if (quella) { scelta.catenella = quella.index; scelta.ago = quella.needle ?? 1; selezionata = true; }
  }
  return { ...scelta, selezionata };
}

/** Gli oggetti che vanno davvero in Stilista: una catenella troppo corta per una maglia lì resterebbe un oggetto vuoto. */
export function oggettiDaMandare(e: EsitoRete): EsitoRete['oggetti'] {
  return e.oggetti.filter((o) => {
    if (o.t.length < 2) return false;
    if (o.tipo !== 'catenella') return true;
    let l = 0;
    for (let i = 1; i < o.t.length; i++) l += Math.hypot(o.t[i][0] - o.t[i - 1][0], o.t[i][1] - o.t[i - 1][1]);
    return l >= CATENELLA_MINIMA_MM;
  });
}

interface Modelli { catenella: number; running: number }

/** Una linea per ogni oggetto del ricamo, nell'ordine: basi e passaggi coi punti del tool, le catenelle col loro tracciato, che il psil lo calcola Stilista. */
export function lineePerStilista(e: EsitoRete, origine: Xy | null, modelli: Modelli | ((colonna: number) => Modelli), dopo: number): Array<{ modello: number; dopo: number; contorno_mm: Xy[]; nome: string }> {
  const [ox, oy] = origine ?? [0, 0];
  const nel = (t: Xy[]): Xy[] => t.map(([x, y]) => [Math.round((x + ox) * 1000) / 1000, Math.round((y + oy) * 1000) / 1000]);
  const di = (c: number): Modelli => (typeof modelli === 'function' ? modelli(c) : modelli);
  return oggettiDaMandare(e).map((o, i) => (o.tipo === 'catenella'
    ? { modello: di(o.cella.colonna).catenella, dopo, contorno_mm: nel(o.t), nome: `catenella ${i + 1}` }
    : { modello: di(o.cella.colonna).running, dopo, contorno_mm: nel(o.punti), nome: `${o.tipo} ${i + 1}` }));
}

/**
 * Il controllo dopo l'invio: Stilista può finire un calcolo in ritardo, e un oggetto resta vuoto o cucito due volte (misurato il 2026-11-05: 1 su 4.135, la base più lunga,
 * con un salto di 78 mm; un ricalcolo lo sistema). Si leggono i punti di tutti e si ricalcolano quelli sbagliati. Dice quanti restano sbagliati.
 */
async function controllaPunti(f: FinestraStilista, primo: number, oggetti: EsitoRete['oggetti']): Promise<{ rifatti: number; sbagliati: number }> {
  const sbagliati = async (quali: number[]): Promise<number[]> => {
    const fuori: number[] = [];
    for (let i = 0; i < quali.length; i += 40) {
      const ids = quali.slice(i, i + 40);
      const r = await fetch(`http://127.0.0.1:${f.porta}/punti-cuciti?oggetti=${ids.map((k) => primo + k).join(',')}`);
      if (!r.ok) throw new Error(`Stilista ha risposto ${r.status}`);
      const lette = (await r.json() as { oggetti: Array<{ punti?: unknown[] }> }).oggetti;
      lette.forEach((o, n) => {
        const quanti = o.punti?.length ?? 0, b = oggetti[ids[n]];
        if (quanti === 0 || (b.tipo !== 'catenella' && quanti > b.punti.length * 1.5)) fuori.push(ids[n]);
      });
    }
    return fuori;
  };
  const prima = await sbagliati(oggetti.map((_, i) => i));
  if (!prima.length) return { rifatti: 0, sbagliati: 0 };
  for (let i = 0; i < prima.length; i += 40) await posta(f, `/ricalcola?oggetti=${prima.slice(i, i + 40).map((k) => primo + k).join(',')}`, {});
  const dopo = await sbagliati(prima);
  return { rifatti: prima.length - dopo.length, sbagliati: dopo.length };
}

export async function reteAStilista(e: EsitoRete, par: ParametriRete, origine: Xy | null, stato: (t: string) => void): Promise<void> {
  stato('Cerco Stilista…');
  try {
    const f = await trovaStilista();
    if (!f) throw new Error('non risponde: è aperto, con RG Stilista Link installato?');
    const s = await (await fetch(`http://127.0.0.1:${f.porta}/stato`)).json() as Stato;
    const documento = nomeDocumento(f);
    const { catenella, running, ago, selezionata } = await trovaModelli(f, s.oggetti);
    if (catenella === null) {
      const pieno = await tutteLeFinestreOccupate();
      stato(`Stilista, «${documento}»: qui non c’è una catenella psil con i suoi punti da copiare. Mettine una in questo documento, o togli «Psil vero».${pieno ? ' Se il tuo documento è un altro: ci sono già 10 finestre collegate e le altre il tool non le vede, chiudine qualcuna e riaprilo.' : ''}`);
      return;
    }
    // una copia della catenella coi valori del tool fa da modello per tutte: l'originale non si tocca
    const prima = await posta<{ ok: boolean; oggetti_dopo: number; errori: string[] }>(f, '/running', { linee: [{ modello: catenella, dopo: s.oggetti - 1, contorno_mm: [[0, 0], [10, 0]], nome: 'modello catenella' }] });
    if (!prima.ok) throw new Error(prima.errori.join(' · ') || 'la copia del modello non è riuscita');
    const modello = prima.oggetti_dopo - 1;
    await posta(f, '/parametri', { oggetti: [{ indice: modello, parametri: {
      PIWidthPsil: Math.round(par.psilLunghezzaMm * 1000), PIHeightPsil: Math.round(par.psilLarghezzaMm * 1000), PIPSILSpacing: Math.round((par.psilPassoMm - par.psilLunghezzaMm) * 1000),
    } }] });
    // senza un running nel documento se ne crea uno nativo: da una copia del psil non va, Stilista non la ricalcola e le copie restano coi punti del modello
    let modelloBasi = running;
    let ultimo = modello;
    const provvisori = [modello];
    if (modelloBasi === null) {
      await posta(f, '/oggetti', { schema_version: 'stilista-bridge-batch-1', type: 'batch', id: 'rg-modello-basi', objects: [{ create_new: true, type: 'running', id: 'modello basi', role: 'rg-tools', color_role: 'rg-tools', geometry: { kind: 'open_path', outer: [[0, 0], [10, 0]] }, stitch: { stitch_length_mm: par.puntoBaseMm }, machine: { needle: ago } }] });
      const dopoIlModello = await (await fetch(`http://127.0.0.1:${f.porta}/stato`)).json() as Stato;
      if (dopoIlModello.oggetti !== modello + 2) throw new Error('il modello delle basi non è entrato nel documento');
      modelloBasi = ultimo = modello + 1;
      provvisori.push(modelloBasi);
    }
    // come nel file ogni colonna ha il suo ago, e il cambio avviene alla fine dell'uscita, fuori dal contorno. Un modello per ago: ogni oggetto nasce con quello giusto.
    // Cambiare l'ago dopo su tutta la rete porta Stilista oltre 8 GB (sapere/codice/stilista-psil.md)
    const colonne = e.collegati ? [] : [...new Set(oggettiDaMandare(e).map((o) => o.cella.colonna))].sort((a, b) => a - b);
    const perColonna = new Map<number, Modelli>();
    for (const [k, c] of colonne.entries()) {
      const copie = await posta<{ ok: boolean; oggetti_dopo: number; errori: string[] }>(f, '/running', { linee: [
        { modello, dopo: ultimo, contorno_mm: [[0, 0], [10, 0]], nome: `modello catenella ago ${ago + k}` },
        { modello: modelloBasi, dopo: ultimo, contorno_mm: [[0, 0], [10, 0]], nome: `modello basi ago ${ago + k}` },
      ] });
      if (copie.oggetti_dopo !== ultimo + 3) throw new Error(copie.errori.join(' · ') || 'i modelli degli aghi non sono entrati nel documento');
      const m: Modelli = { catenella: ultimo + 1, running: ultimo + 2 };
      await posta(f, '/ago', { oggetti: [m.catenella, m.running], ago: ago + k });
      perColonna.set(c, m);
      provvisori.push(m.catenella, m.running);
      ultimo += 2;
    }
    const basi = modelloBasi;
    const linee = lineePerStilista(e, origine, (c) => perColonna.get(c) ?? { catenella: modello, running: basi }, 0);
    const primoIndice = ultimo + 1;
    let dopo = primoIndice - 1, punti = 0;
    for (let i = 0; i < linee.length; i += PER_VOLTA) {
      stato(`Invio a Stilista… ${i.toLocaleString('it-IT')} oggetti su ${linee.length.toLocaleString('it-IT')}`);
      const parte = linee.slice(i, i + PER_VOLTA).map((l) => ({ ...l, dopo }));
      const r = await posta<{ punti: number; oggetti_dopo: number }>(f, '/running', { linee: parte });
      punti += r.punti;
      dopo = r.oggetti_dopo - 1;
    }
    await posta(f, `/cancella?oggetti=${provvisori.join(',')}`, {});
    stato('Invio a Stilista… controllo i punti');
    const controllo = await controllaPunti(f, modello, oggettiDaMandare(e));
    stato(`In «${documento}»${selezionata ? ', col psil selezionato' : ''}: ${linee.length.toLocaleString('it-IT')} oggetti, ${punti.toLocaleString('it-IT')} punti, catenelle psil vere${e.oggetti.length > linee.length ? `; ${e.oggetti.length - linee.length} troppo corte non mandate` : ''}${controllo.rifatti ? `; ${controllo.rifatti} ricalcolati` : ''}${controllo.sbagliati ? `; ATTENZIONE: ${controllo.sbagliati} ancora sbagliati` : ''}`);
  } catch (x) {
    stato('Stilista: ' + (x as Error).message);
  }
}

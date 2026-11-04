// L'elenco dei moduli di questo PC (Lorenzo, 2026-11-04: «il modulo che stiamo mettendo possiamo inserirlo come def? e casomai se uno ne crea
// un altro lo mette»). I moduli dei clienti non stanno nel repo, che è pubblico: restano nel browser, e sugli altri PC si caricano una volta dal file.
import type { ModuloRete } from './motore';

/** Dove stava il modulo quando se ne ricordava uno solo. */
const MODULO_RICORDATO = 'rg-rete-catenella-modulo';
const ELENCO = 'rg-rete-catenella-moduli';

export interface ModuloSalvato { id: string; nome: string; testo: string }
export interface ElencoModuli {
  moduli: ModuloSalvato[];
  /** Il modulo con cui si apre il tool; null: quello di esempio. */
  diSerie: string | null;
}
export type Memoria = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Il modulo dentro un testo, se è un modulo di Rete a catenella. */
export function leggiModulo(testo: string): ModuloRete | null {
  try {
    const m = JSON.parse(testo) as ModuloRete;
    return m.formato === 'rete-modulo-1' && m.varianti?.A?.oggetti?.length && m.varianti?.B?.oggetti?.length && m.passi?.colonne > 0 && m.passi?.righe > 0 ? m : null;
  } catch {
    return null;
  }
}

/** L'elenco salvato. Un modulo ricordato col vecchio sistema entra nell'elenco e resta quello di serie. */
export function leggiElenco(mem: Memoria | null): ElencoModuli {
  const vuoto: ElencoModuli = { moduli: [], diSerie: null };
  if (!mem) return vuoto;
  let elenco = vuoto;
  try {
    const salvato = JSON.parse(mem.getItem(ELENCO) ?? 'null') as ElencoModuli | null;
    if (salvato && Array.isArray(salvato.moduli)) {
      const moduli = salvato.moduli.filter((x) => leggiModulo(x.testo));
      elenco = { moduli, diSerie: moduli.some((x) => x.id === salvato.diSerie) ? salvato.diSerie : null };
    }
  } catch { /* un elenco rovinato non ferma il tool */ }
  const vecchio = mem.getItem(MODULO_RICORDATO);
  if (vecchio && leggiModulo(vecchio)) {
    const prima = elenco.moduli.length;
    const { elenco: nuovo, id } = aggiungiModulo(elenco, vecchio, '');
    elenco = nuovo.moduli.length > prima && !elenco.diSerie ? { ...nuovo, diSerie: id } : nuovo;
    if (scriviElenco(mem, elenco)) mem.removeItem(MODULO_RICORDATO);
  }
  return elenco;
}

/** Salva l'elenco. False se non ci sta: la memoria del browser ha un limite. */
export function scriviElenco(mem: Memoria | null, elenco: ElencoModuli): boolean {
  if (!mem) return false;
  try {
    mem.setItem(ELENCO, JSON.stringify(elenco));
    return true;
  } catch {
    return false;
  }
}

/** Aggiunge un modulo, col nome del suo file: quello scritto dentro di solito è generico. Lo stesso file due volte resta uno solo; lo stesso nome con un disegno diverso prende un numero. */
export function aggiungiModulo(elenco: ElencoModuli, testo: string, nomeFile: string): { elenco: ElencoModuli; id: string } {
  const uguale = elenco.moduli.find((x) => x.testo === testo);
  if (uguale) return { elenco, id: uguale.id };
  const base = nomeFile.replace(/\.[^.]+$/, '') || leggiModulo(testo)?.nome || 'modulo';
  let nome = base;
  for (let n = 2; elenco.moduli.some((x) => x.nome === nome); n++) nome = `${base} (${n})`;
  let k = elenco.moduli.length + 1;
  while (elenco.moduli.some((x) => x.id === `m${k}`)) k++;
  const id = `m${k}`;
  return { elenco: { ...elenco, moduli: [...elenco.moduli, { id, nome, testo }] }, id };
}

/** Toglie un modulo. Se era quello di serie, di serie torna quello di esempio. */
export function togliModulo(elenco: ElencoModuli, id: string): ElencoModuli {
  return { moduli: elenco.moduli.filter((x) => x.id !== id), diSerie: elenco.diSerie === id ? null : elenco.diSerie };
}

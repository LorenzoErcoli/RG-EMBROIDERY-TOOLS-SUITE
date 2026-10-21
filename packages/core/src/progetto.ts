// La busta di progetto (K2 del cervello, AVVIO-CERVELLO-RICAMO §3c): quello che ha lo STESSO significato in
// ogni file di progetto della suite — il tool, la versione, la sorgente, i ruoli dei colori, i fili, il referto —
// scritto sempre con gli stessi nomi, accanto a quello che è proprio del tool.
//
// Si AGGIUNGE, non si toglie: `conBusta()` prende i metadati che un tool scrive oggi (`{ rgProject, version, params,
// roles… }`) e ci mette sopra le chiavi comuni; le chiavi vecchie restano com'erano, quindi ogni tool continua a
// leggere i suoi file vecchi e nuovi. E `leggiProgetto()` legge il file di QUALUNQUE tool (anche uno scritto prima
// della busta) e restituisce quello che c'è, con gli stessi nomi: da lì l'interscambio.
import type { ExportLayer } from './types';
import { readProjectMetadata } from './export';
import { readDstMetadata, misuraDst, refertoDaStrati, type Referto } from './dst';

/** La versione della busta che scrive questo codice. */
export const VERSIONE_BUSTA = 1;

export type TipoSorgenteProgetto = 'svg' | 'dxf' | 'raster' | 'dst';

/** Da cosa è partito il ricamo: un disegno, un'immagine, un altro ricamo. */
export interface SorgenteProgetto {
  tipo: TipoSorgenteProgetto;
  nome?: string;
  /** La misura reale in mm (R11), non quella dichiarata dal file. */
  larghezzaMm?: number;
  altezzaMm?: number;
  /** Il frame del file di partenza, se il tool esporta nello stesso riquadro (R27). */
  frame?: { scaleX: number; scaleY: number; offsetX: number; offsetY: number; viewBox: string | null; widthAttr: string | null; heightAttr: string | null };
}

/** Un filo, nell'ordine di cucitura (l'ago 1 è il primo). Il DST non porta i colori: qui sì. */
export interface FiloProgetto {
  colore: string;
  nome?: string;
  tex?: number;
}

/** Le chiavi comuni della busta. Un file ha anche le chiavi proprie del tool, come oggi. */
export interface Busta {
  rg: number;
  /** L'id del tool (quello di `TOOLS` e del registro dei parametri). */
  tool: string;
  toolVersion?: string;
  /** I parametri, coi nomi con cui il tool li salva (il registro dei parametri dice cosa sono). */
  params?: Record<string, unknown>;
  sorgente?: SorgenteProgetto;
  /** Colore → ruolo (R12), coi nomi di ruolo del tool. */
  ruoli?: Record<string, string>;
  fili?: FiloProgetto[];
  /** Il referto del DST (K3), uguale per tutti i tool. */
  misure?: Referto;
}

export interface OpzioniBusta {
  /** L'id del tool, se i metadati non hanno `rgProject`. */
  tool?: string;
  /** Gli strati che il tool esporta: ne vengono i fili e, se non c'è `misure`, il referto. */
  strati?: ExportLayer[];
  sorgente?: SorgenteProgetto;
  /** Se il tool conosce i colori dei suoi fili meglio degli strati. */
  fili?: FiloProgetto[];
  /** Il referto già calcolato dai byte veri (pettine, sfrangiatura); altrimenti si calcola dagli strati. */
  misure?: Referto;
}

const oggetto = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/** I fili di un ricamo dagli strati che `dstFromExportLayers` cuce (stessa scelta: non le forme, solo gli strati con tracciati), in ordine d'ago. */
export function filiDaStrati(strati: ExportLayer[]): FiloProgetto[] {
  return (strati || []).filter((l) => !l.shapeOnly && l.polylines && l.polylines.length > 0).map((l) => ({ colore: l.color }));
}

/**
 * Mette la busta sui metadati di un tool. Aggiunge `rg`, `tool`, `toolVersion`, `ruoli`, `sorgente`, `fili`,
 * `misure`; **non toglie niente** (`rgProject`, `version`, `roles`, le chiavi proprie restano). Se un'opzione manca
 * e i metadati hanno già la chiave, resta quella.
 */
export function conBusta(meta: Record<string, unknown>, opz: OpzioniBusta = {}): Record<string, unknown> & Busta {
  const tool = opz.tool ?? (typeof meta.rgProject === 'string' ? meta.rgProject : typeof meta.tool === 'string' ? meta.tool : undefined);
  if (!tool) throw new Error('conBusta: manca l’id del tool (né rgProject nei metadati né opz.tool).');
  const versione = meta.toolVersion ?? meta.version ?? meta.versione;
  const ruoli = oggetto(meta.ruoli) ?? oggetto(meta.roles);
  const out: Record<string, unknown> = { ...meta, rg: VERSIONE_BUSTA, tool };
  if (typeof versione === 'string' || typeof versione === 'number') out.toolVersion = String(versione);
  if (ruoli) out.ruoli = { ...ruoli };
  const sorgente = opz.sorgente ?? oggetto(meta.sorgente);
  if (sorgente) out.sorgente = sorgente;
  const fili = opz.fili ?? (opz.strati ? filiDaStrati(opz.strati) : (meta.fili as FiloProgetto[] | undefined));
  if (fili) out.fili = fili;
  const misure = opz.misure ?? (opz.strati ? refertoDaStrati(opz.strati) : (meta.misure as Referto | undefined));
  if (misure) out.misure = misure;
  return out as Record<string, unknown> & Busta;
}

/** Un progetto letto da un file della suite, con i nomi comuni; `propri` sono le chiavi che sono solo di quel tool. */
export interface ProgettoLetto {
  /** `busta` = scritto con la busta (rg: 1); `vecchio` = scritto prima, letto con gli stessi nomi dove si può. */
  origine: 'busta' | 'vecchio';
  tool: string;
  versione?: string;
  params?: Record<string, unknown>;
  ruoli?: Record<string, string>;
  sorgente?: SorgenteProgetto;
  fili?: FiloProgetto[];
  /** Se il file è un DST, il referto dei suoi byte (la verità); altrimenti quello scritto nel file, se c'è. */
  misure?: Referto;
  /** Le chiavi del file che non sono comuni: sono del tool che le ha scritte. */
  propri: Record<string, unknown>;
}

const COMUNI = new Set(['rg', 'rgProject', 'tool', 'toolVersion', 'version', 'versione', 'params', 'par', 'ruoli', 'roles', 'sorgente', 'fili', 'misure']);

function eDst(b: Uint8Array): boolean {
  return b.length >= 512 && b[0] === 0x4c && b[1] === 0x41 && b[2] === 0x3a; // "LA:"
}

/**
 * Legge il progetto di un file della suite: un SVG (come testo) o un DST (come byte), di QUALUNQUE tool, anche
 * scritto prima della busta. Ritorna null se il file non viene dalla suite (nessun metadato `rgProject`/`tool`).
 * Non interpreta i parametri e le chiavi proprie: li restituisce, e chi li capisce è il tool che li ha scritti.
 */
export function leggiProgetto(file: string | Uint8Array): ProgettoLetto | null {
  let meta: Record<string, unknown> | null;
  let dst: Uint8Array | null = null;
  if (typeof file === 'string') meta = readProjectMetadata(file);
  else if (eDst(file)) { dst = file; meta = readDstMetadata(file); }
  else meta = readProjectMetadata(new TextDecoder().decode(file));
  if (!meta) return null;

  const tool = typeof meta.tool === 'string' ? meta.tool : typeof meta.rgProject === 'string' ? meta.rgProject : '';
  if (!tool) return null;
  const versione = meta.toolVersion ?? meta.version ?? meta.versione;
  const disegno = oggetto(meta.drawing);
  const sorgente = (oggetto(meta.sorgente) as SorgenteProgetto | undefined)
    ?? (typeof disegno?.name === 'string' && disegno.name ? { tipo: 'svg' as const, nome: disegno.name } : undefined);
  const propri: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) if (!COMUNI.has(k)) propri[k] = v;

  let misure = oggetto(meta.misure) as Referto | undefined;
  if (dst) {
    const dai = misuraDst(dst);
    misure = misure?.filoInVista ? { ...dai, filoInVista: misure.filoInVista } : dai;
  }
  return {
    origine: meta.rg === VERSIONE_BUSTA || typeof meta.rg === 'number' ? 'busta' : 'vecchio',
    tool,
    ...(versione !== undefined ? { versione: String(versione) } : {}),
    ...((oggetto(meta.params) ?? oggetto(meta.par)) ? { params: (oggetto(meta.params) ?? oggetto(meta.par))! } : {}),
    ...((oggetto(meta.ruoli) ?? oggetto(meta.roles)) ? { ruoli: (oggetto(meta.ruoli) ?? oggetto(meta.roles)) as Record<string, string> } : {}),
    ...(sorgente ? { sorgente } : {}),
    ...(Array.isArray(meta.fili) ? { fili: meta.fili as FiloProgetto[] } : {}),
    ...(misure ? { misure } : {}),
    propri,
  };
}

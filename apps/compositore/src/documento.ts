// IL DOCUMENTO DEL COMPOSITORE: più ricami (oggetti) in fila, ognuno coi suoi fili, e le regole per passare
// dall'uno all'altro. È il pezzo che mancava fra i tool e la macchina (studi/STILISTA-DA-ZERO.md §8.3): ogni tool
// fa bene il suo pezzo, ma un pannello vero ne mette insieme tanti, e fino a oggi la fila si faceva in Stilista.
//
// Qui dentro non c'è DOM: si legge un DST, si compone, si misura, si scrive. L'interfaccia è in `tool.ts`.
//
// Tre scelte, dette perché il formato non le dice:
// 1. **Un oggetto non si ricalcola.** I suoi blocchi restano quelli del file, punto per punto (anche i tagli che il
//    tool aveva messo, letti da `readDst`). Il Compositore decide solo dove sta, con che filo e come ci si arriva.
// 2. **Il filo è del documento, non del file.** Il DST non porta i colori (R31): ogni ago di un oggetto punta a un
//    filo del documento. Due oggetti sullo stesso filo, uno dopo l'altro, non fanno un cambio d'ago.
// 3. **Il file che esce si riapre.** Il DST porta in coda (dopo l'END, la macchina non lo vede) la descrizione del
//    documento: quali blocchi sono di quale oggetto, gli spostamenti, i fili. I punti non si ripetono: sono quelli
//    del DST stesso. Solo gli oggetti spenti, che nel DST non ci sono, si portano dietro i loro punti.
import {
  readDst, buildDst, misuraDst, appendDstMetadata, leggiProgetto, conBusta,
  type DstPath, type Referto, type FiloProgetto,
} from '@rg/core';

/** La versione della descrizione del documento scritta in coda al DST. */
export const VERSIONE_DOCUMENTO = 1;

/** Tinte dei fili nuovi, quando il file non dice il colore: servono a distinguere, non sono il filato (R31). */
export const TINTE = ['#283e6e', '#b0413e', '#5c8a4a', '#c99a10', '#8a6f8f', '#3d8a96', '#96b0c8', '#6b4f2a'];

export interface Filo {
  /** Il numero del filo nel documento (1, 2, 3…): non è l'ago della macchina. */
  id: number;
  colore: string;
  nome?: string;
}

/** Un blocco cucito di un oggetto, nelle coordinate del suo file (mm, Y verso il basso). */
export interface Blocco {
  /** L'ago nel file di partenza (1 = primo). */
  ago: number;
  punti: Array<[number, number]>;
  /** Il file tagliava il filo prima di questo blocco. */
  taglio?: boolean;
}

/**
 * Come si arriva a un oggetto da quello prima, sullo stesso filo. `auto` = decide la regola del documento (si taglia
 * oltre `tagliaOltreMm`); `taglio` e `salto` sono la scelta fatta a mano, che resta anche se l'ordine cambia.
 * Lorenzo, sul Punto croce: «gestire i passaggi, modificandoli a mano dove passano dove necessario e cambiarli anche in
 * salti quando serve».
 */
export type Arrivo = 'auto' | 'taglio' | 'salto';

export interface Oggetto {
  id: string;
  nome: string;
  /** Il file da cui viene. */
  file?: string;
  /** Il tool della suite che l'ha fatto (dalla busta del DST), se si sa. */
  tool?: string;
  blocchi: Blocco[];
  /** Per ogni ago del file (indice 0 = ago 1), il filo del documento. */
  fili: number[];
  /** Lo spostamento in mm rispetto a dove lo mette il file (al decimo: è la risoluzione del DST). */
  dx: number;
  dy: number;
  /** Resta nel documento ma non si cuce. */
  spento?: boolean;
  arrivo: Arrivo;
}

export interface Regole {
  /** Fra due oggetti sullo stesso filo, un salto più lungo di così porta il taglio. */
  tagliaOltreMm: number;
}

/** 2 mm: sotto, il salto è poco più di un punto lungo. Valore di partenza, da confermare con Lorenzo. */
export const REGOLE_DEFAULT: Regole = { tagliaOltreMm: 2 };

export interface Documento {
  nome: string;
  fili: Filo[];
  oggetti: Oggetto[];
  regole: Regole;
}

export function documentoVuoto(nome = 'composizione'): Documento {
  return { nome, fili: [], oggetti: [], regole: { ...REGOLE_DEFAULT } };
}

const al10 = (v: number): number => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------------------------------------
// Entrare: un DST diventa un oggetto, o (se l'ha scritto il Compositore) torna il documento intero
// ---------------------------------------------------------------------------------------------------------

/** Il filo del documento per un colore: quello che c'è già con lo stesso colore, o uno nuovo. */
function filoPer(fili: Filo[], colore: string | undefined, nome?: string): number {
  const c = colore?.toLowerCase();
  if (c) {
    const gia = fili.find((f) => f.colore.toLowerCase() === c);
    if (gia) return gia.id;
  }
  const id = fili.reduce((m, f) => Math.max(m, f.id), 0) + 1;
  fili.push({ id, colore: c ?? TINTE[(id - 1) % TINTE.length], ...(nome ? { nome } : {}) });
  return id;
}

function nuovoId(doc: Documento): string {
  let n = doc.oggetti.length + 1;
  while (doc.oggetti.some((o) => o.id === `o${n}`)) n++;
  return `o${n}`;
}

/**
 * Aggiunge al documento il ricamo di un DST, come un oggetto in fondo alla fila. I fili: se il file viene dalla suite
 * e la busta dice i colori, un colore già nel documento riusa il suo filo; altrimenti ogni ago diventa un filo nuovo.
 * Modifica `doc` e ritorna l'oggetto.
 */
export function aggiungiDst(doc: Documento, bytes: Uint8Array, file?: string): Oggetto {
  const letto = readDst(bytes);
  if (!letto.blocks.length) throw new Error('nel file non c’è niente di cucito');
  const progetto = leggiProgetto(bytes);
  const aghi = letto.colorChanges + 1;
  const fili: number[] = [];
  for (let i = 0; i < aghi; i++) {
    const f = progetto?.fili?.[i];
    fili.push(filoPer(doc.fili, f?.colore, f?.nome));
  }
  const nome = (file ?? letto.label ?? 'ricamo').replace(/\.dst$/i, '') || 'ricamo';
  const o: Oggetto = {
    id: nuovoId(doc), nome, ...(file ? { file } : {}), ...(progetto?.tool ? { tool: progetto.tool } : {}),
    blocchi: letto.blocks.map((b) => ({ ago: b.needle, punti: b.points_mm, ...(b.trim ? { taglio: true } : {}) })),
    fili, dx: 0, dy: 0, arrivo: 'auto',
  };
  doc.oggetti.push(o);
  return o;
}

/** Quello che si scrive in coda al DST per riaprire il documento. */
interface Descrizione {
  versione: number;
  nome: string;
  fili: Filo[];
  regole: Regole;
  oggetti: Array<Omit<Oggetto, 'blocchi'> & {
    /** Acceso: gli aghi dei suoi blocchi, a corse [ago, quanti]. Spento: i blocchi interi. */
    aghi?: Array<[number, number]>;
    blocchi?: Blocco[];
  }>;
}

/**
 * Il documento scritto in un DST dal Compositore, o null se il file non viene da qui (o non torna: un DST
 * modificato fuori, coi blocchi che non sono più quelli descritti, si apre come ricamo qualunque).
 */
export function documentoDaDst(bytes: Uint8Array): Documento | null {
  const letto = readDst(bytes);
  const d = (letto.metadata as { rgProject?: string; documento?: Descrizione } | null);
  if (d?.rgProject !== 'compositore' || !d.documento || d.documento.versione !== VERSIONE_DOCUMENTO) return null;
  const desc = d.documento;
  const oggetti: Oggetto[] = [];
  let k = 0;
  for (const od of desc.oggetti) {
    const { aghi, blocchi: propri, ...resto } = od;
    let blocchi: Blocco[];
    if (od.spento) {
      blocchi = propri ?? [];
    } else {
      blocchi = [];
      for (const [ago, quanti] of aghi ?? []) {
        for (let i = 0; i < quanti; i++) {
          const b = letto.blocks[k++];
          if (!b) return null;
          blocchi.push({
            ago,
            punti: b.points_mm.map(([x, y]) => [al10(x - od.dx), al10(y - od.dy)] as [number, number]),
            // il taglio del primo blocco è il collegamento fra oggetti: lo decide di nuovo la regola
            ...(b.trim && blocchi.length > 0 ? { taglio: true } : {}),
          });
        }
      }
    }
    oggetti.push({ ...resto, blocchi });
  }
  if (k !== letto.blocks.length) return null;
  return { nome: desc.nome, fili: desc.fili.map((f) => ({ ...f })), regole: { ...REGOLE_DEFAULT, ...desc.regole }, oggetti };
}

/**
 * Apre un DST nel documento: se l'ha scritto il Compositore, i suoi oggetti si aggiungono in fondo (in un documento
 * vuoto il documento torna com'era, nome e regole compresi); altrimenti il ricamo diventa un oggetto nuovo.
 * Ritorna gli oggetti aggiunti.
 */
export function apriDst(doc: Documento, bytes: Uint8Array, file?: string): Oggetto[] {
  const altro = documentoDaDst(bytes);
  if (!altro) return [aggiungiDst(doc, bytes, file)];
  if (!doc.oggetti.length) {
    doc.nome = altro.nome;
    doc.regole = altro.regole;
    doc.fili = altro.fili;
    doc.oggetti = altro.oggetti;
    return doc.oggetti;
  }
  const nuovi: Oggetto[] = [];
  for (const o of altro.oggetti) {
    const fili = o.fili.map((id) => {
      const f = altro.fili.find((x) => x.id === id);
      return filoPer(doc.fili, f?.colore, f?.nome);
    });
    const n: Oggetto = { ...o, id: nuovoId(doc), fili };
    doc.oggetti.push(n);
    nuovi.push(n);
  }
  return nuovi;
}

// ---------------------------------------------------------------------------------------------------------
// Comporre: la fila di oggetti diventa la fila di blocchi del DST
// ---------------------------------------------------------------------------------------------------------

/** Il passaggio da un oggetto al successivo. */
export interface Giunto {
  /** L'oggetto da cui si parte (null = l'inizio del ricamo). */
  da: string | null;
  a: string;
  /** Dall'ultimo punto di `da` al primo di `a`, in mm. */
  distanzaMm: number;
  /** `cambio` = cambia il filo (la macchina si ferma e cambia ago); `taglio` e `salto` sullo stesso filo. */
  tipo: 'inizio' | 'cambio' | 'taglio' | 'salto';
  /** La scelta l'ha fatta qualcuno a mano (non la regola). */
  aMano: boolean;
  da_xy: [number, number] | null;
  a_xy: [number, number];
}

export interface Composizione {
  /** I blocchi pronti per `buildDst`: `needle` è l'id del filo del documento. */
  paths: DstPath[];
  /** Per ogni blocco, l'oggetto da cui viene. */
  oggettoDi: string[];
  giunti: Giunto[];
  /** Il filo di ogni ago progressivo del DST (l'ago 1 è il primo): la sequenza dei colori in macchina. */
  sequenzaFili: number[];
}

/** Il filo di un blocco: quello dell'ago nel suo oggetto (un ago senza filo prende il primo filo dell'oggetto). */
const filoDi = (o: Oggetto, ago: number): number => o.fili[ago - 1] ?? o.fili[0] ?? 1;

export function componi(doc: Documento): Composizione {
  const paths: DstPath[] = [];
  const oggettoDi: string[] = [];
  const giunti: Giunto[] = [];
  const sequenzaFili: number[] = [];
  let ultimo: [number, number] | null = null;
  let filoPrima: number | null = null;
  let daPrima: string | null = null;

  for (const o of doc.oggetti) {
    if (o.spento) continue;
    let agoPrima: number | null = null;
    for (const b of o.blocchi) {
      if (b.punti.length < 2) continue;
      const filo = filoDi(o, b.ago);
      const punti = b.punti.map(([x, y]) => [x + o.dx, y + o.dy] as [number, number]);
      let trim: boolean;
      if (paths.length === 0) {
        giunti.push({ da: null, a: o.id, distanzaMm: 0, tipo: 'inizio', aMano: false, da_xy: null, a_xy: punti[0] });
        trim = false;
      } else if (agoPrima === null) {
        // il primo blocco dell'oggetto: il giunto fra oggetti
        const d = Math.hypot(punti[0][0] - ultimo![0], punti[0][1] - ultimo![1]);
        let tipo: Giunto['tipo'];
        if (filo !== filoPrima) tipo = 'cambio';
        else if (o.arrivo === 'taglio') tipo = 'taglio';
        else if (o.arrivo === 'salto') tipo = 'salto';
        else tipo = d > doc.regole.tagliaOltreMm ? 'taglio' : 'salto';
        giunti.push({ da: daPrima, a: o.id, distanzaMm: d, tipo, aMano: tipo !== 'cambio' && o.arrivo !== 'auto', da_xy: ultimo, a_xy: punti[0] });
        trim = tipo === 'taglio';
      } else {
        // dentro l'oggetto: il taglio del file resta; e se nel file qui cambiava l'ago ma il filo è lo stesso, la
        // macchina non si ferma più, quindi si taglia (il cambio d'ago tagliava)
        trim = !!b.taglio || (b.ago !== agoPrima && filo === filoPrima);
      }
      if (filo !== filoPrima) sequenzaFili.push(filo);
      paths.push({ needle: filo, points_mm: punti, ...(trim ? { trim: true } : {}) });
      oggettoDi.push(o.id);
      ultimo = punti[punti.length - 1];
      filoPrima = filo;
      agoPrima = b.ago;
    }
    if (agoPrima !== null) daPrima = o.id;
  }
  return { paths, oggettoDi, giunti, sequenzaFili };
}

// ---------------------------------------------------------------------------------------------------------
// Uscire: il DST del documento, che si riapre
// ---------------------------------------------------------------------------------------------------------

function descrivi(doc: Documento): Descrizione {
  return {
    versione: VERSIONE_DOCUMENTO,
    nome: doc.nome,
    fili: doc.fili,
    regole: doc.regole,
    oggetti: doc.oggetti.map((o) => {
      const { blocchi, ...resto } = o;
      if (o.spento) return { ...resto, blocchi };
      const aghi: Array<[number, number]> = [];
      for (const b of blocchi) {
        if (b.punti.length < 2) continue;
        const c = aghi[aghi.length - 1];
        if (c && c[0] === b.ago) c[1]++; else aghi.push([b.ago, 1]);
      }
      return { ...resto, aghi };
    }),
  };
}

const etichetta = (nome: string): string => (nome.replace(/[^A-Za-z0-9 _-]/g, '').toUpperCase() || 'COMPOSIZIONE').slice(0, 16);

/** I byte del DST senza la descrizione in coda: quello che la macchina legge. Null se non c'è niente da cucire. */
export function dstNudo(doc: Documento, c: Composizione = componi(doc)): Uint8Array | null {
  if (!c.paths.length) return null;
  return buildDst({ label: etichetta(doc.nome), coordinate_system: 'svg', paths: c.paths });
}

/** I fili nell'ordine della macchina, coi loro colori: la busta del DST (K2). */
export function filiInMacchina(doc: Documento, c: Composizione): FiloProgetto[] {
  return c.sequenzaFili.map((id) => {
    const f = doc.fili.find((x) => x.id === id);
    return { colore: f?.colore ?? '#000000', ...(f?.nome ? { nome: f.nome } : {}) };
  });
}

/** Il DST del documento, con la busta e la descrizione per riaprirlo. Lancia se non c'è niente da cucire. */
export function dstDocumento(doc: Documento): Uint8Array {
  const c = componi(doc);
  const nudo = dstNudo(doc, c);
  if (!nudo) throw new Error('Niente da cucire: il documento non ha oggetti accesi.');
  const meta = conBusta(
    { rgProject: 'compositore', version: VERSIONE_DOCUMENTO, documento: descrivi(doc) },
    { tool: 'compositore', fili: filiInMacchina(doc, c), misure: misuraDst(nudo) },
  );
  return appendDstMetadata(nudo, meta);
}

// ---------------------------------------------------------------------------------------------------------
// Ordinare e controllare
// ---------------------------------------------------------------------------------------------------------

/** Il primo e l'ultimo punto cucito di un oggetto, con lo spostamento. */
export function capi(o: Oggetto): { primo: [number, number]; ultimo: [number, number] } | null {
  const cuciti = o.blocchi.filter((b) => b.punti.length >= 2);
  if (!cuciti.length) return null;
  const p = cuciti[0].punti[0], u = cuciti[cuciti.length - 1].punti[cuciti[cuciti.length - 1].punti.length - 1];
  return { primo: [p[0] + o.dx, p[1] + o.dy], ultimo: [u[0] + o.dx, u[1] + o.dy] };
}

/** I salti fra oggetti e i cambi di filo di una composizione: la misura che il riordino deve abbassare. */
export function contaGiunti(c: Composizione): { cambi: number; tagli: number; salti: number; mm: number } {
  let cambi = 0, tagli = 0, salti = 0, mm = 0;
  for (const g of c.giunti) {
    if (g.tipo === 'inizio') continue;
    if (g.tipo === 'cambio') cambi++; else if (g.tipo === 'taglio') tagli++; else salti++;
    mm += g.distanzaMm;
  }
  return { cambi, tagli, salti, mm };
}

/**
 * Un nuovo ordine degli oggetti: prima per filo (i fili nell'ordine in cui compaiono la prima volta, così i cambi
 * calano), poi dentro ogni filo il più vicino a dove l'ago si trova (così i salti si accorciano). Gli oggetti con più
 * fili vanno col loro primo. Non cambia il documento: ritorna gli oggetti in ordine nuovo.
 *
 * Attenzione, ed è detto anche nell'interfaccia: l'ordine decide cosa copre cosa. Il riordino non lo sa, quindi è
 * una proposta che si guarda e si annulla, non una regola.
 */
export function ordineProposto(doc: Documento): Oggetto[] {
  const accesi = doc.oggetti.filter((o) => !o.spento && capi(o));
  const primoFilo = (o: Oggetto): number => filoDi(o, o.blocchi.find((b) => b.punti.length >= 2)!.ago);
  const ordineFili: number[] = [];
  for (const o of accesi) { const f = primoFilo(o); if (!ordineFili.includes(f)) ordineFili.push(f); }

  const fuori: Oggetto[] = [];
  let qui: [number, number] = capi(accesi[0] ?? doc.oggetti[0])?.primo ?? [0, 0];
  for (const f of ordineFili) {
    const resto = accesi.filter((o) => primoFilo(o) === f);
    while (resto.length) {
      let mi = 0, md = Infinity;
      resto.forEach((o, i) => {
        const p = capi(o)!.primo;
        const d = Math.hypot(p[0] - qui[0], p[1] - qui[1]);
        if (d < md) { md = d; mi = i; }
      });
      const [o] = resto.splice(mi, 1);
      fuori.push(o);
      qui = capi(o)!.ultimo;
    }
  }
  // gli spenti (e quelli vuoti) restano in fondo, nel loro ordine
  for (const o of doc.oggetti) if (!fuori.includes(o)) fuori.push(o);
  return fuori;
}

export interface Avviso {
  livello: 'errore' | 'attenzione' | 'info';
  testo: string;
  /** L'oggetto a cui si riferisce, per selezionarlo. */
  oggetto?: string;
}

/**
 * Il controllo prima della macchina (V3 dello studio): quello che si misura dal documento e dal DST che ne esce.
 * Ogni avviso dice il numero e il perché; il nome dell'oggetto, quando c'è, porta a lui.
 */
export function controlla(doc: Documento, c: Composizione, referto: Referto | null): Avviso[] {
  const out: Avviso[] = [];
  const nome = (id: string | null): string => doc.oggetti.find((o) => o.id === id)?.nome ?? '?';
  const mm = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  if (!c.paths.length) {
    out.push({ livello: 'info', testo: doc.oggetti.length ? 'Tutti gli oggetti sono spenti: non c’è niente da cucire.' : 'Aggiungi uno o più DST per cominciare.' });
    return out;
  }
  for (const g of c.giunti) {
    if (g.tipo === 'salto' && g.distanzaMm > doc.regole.tagliaOltreMm) {
      out.push({ livello: 'attenzione', oggetto: g.a, testo: `Da «${nome(g.da)}» a «${nome(g.a)}»: salto di ${mm(g.distanzaMm)} mm senza taglio (scelto a mano). Resta un filo da tagliare dopo, se non lo copre niente.` });
    }
  }
  const viste = new Map<number, number>();
  for (const f of c.sequenzaFili) viste.set(f, (viste.get(f) ?? 0) + 1);
  const tornano = [...viste.entries()].filter(([, n]) => n > 1);
  if (tornano.length) {
    const risparmio = tornano.reduce((s, [, n]) => s + n - 1, 0);
    out.push({ livello: 'info', testo: `${tornano.length === 1 ? 'Un filo torna' : `${tornano.length} fili tornano`} più volte nella fila: raggruppando per filo si risparmiano fino a ${risparmio} cambi d’ago (se l’ordine di copertura lo permette).` });
  }
  if (referto) {
    if (referto.sottoSoglia.punti > 0) {
      out.push({ livello: 'attenzione', testo: `${referto.sottoSoglia.punti.toLocaleString('it-IT')} punti più corti di ${mm(referto.sottoSoglia.sogliaMm)} mm: con fili spessi rischiano di non lavorare bene.` });
    }
    if (referto.saltoPiuLungoMm > 100) {
      out.push({ livello: 'info', testo: `Il salto più lungo è di ${mm(referto.saltoPiuLungoMm)} mm.` });
    }
  }
  const sovrapposti = sovrapposizioni(doc);
  for (const [a, b] of sovrapposti) {
    out.push({ livello: 'info', oggetto: b, testo: `«${nome(b)}» si sovrappone a «${nome(a)}», che è cucito prima: controlla che l’ordine sia quello voluto.` });
  }
  return out;
}

/** Le coppie di oggetti accesi i cui ingombri si sovrappongono, nell'ordine di cucitura. */
function sovrapposizioni(doc: Documento): Array<[string, string]> {
  const r = doc.oggetti.filter((o) => !o.spento).map((o) => ({ id: o.id, b: ingombro(o) })).filter((x) => x.b);
  const out: Array<[string, string]> = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i].b!, b = r[j].b!;
    if (a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY) out.push([r[i].id, r[j].id]);
  }
  return out;
}

/** L'ingombro dei punti di un oggetto, con lo spostamento. */
export function ingombro(o: Oggetto): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of o.blocchi) for (const [x, y] of b.punti) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX + o.dx, minY: minY + o.dy, maxX: maxX + o.dx, maxY: maxY + o.dy };
}

/** Sposta un oggetto, al decimo di mm (la risoluzione del DST: così riaprendo torna uguale). */
export function sposta(o: Oggetto, dx: number, dy: number): void {
  o.dx = al10(dx);
  o.dy = al10(dy);
}

/** Quanti punti ha un oggetto (i record-punto che scriverà nel DST, senza contare i punti di partenza). */
export function puntiDi(o: Oggetto): number {
  return o.blocchi.reduce((s, b) => s + Math.max(0, b.punti.length - 1), 0);
}

// ---------------------------------------------------------------------------------------------------------
// L'esempio: tre oggetti piccoli, fatti qui, per provare il Compositore senza file
// ---------------------------------------------------------------------------------------------------------

/** Un documento d'esempio: un raso e un cerchio sul filo 1, un riquadro a punto dritto sul filo 2. */
export function documentoEsempio(): Documento {
  const doc = documentoVuoto('esempio');
  doc.fili.push({ id: 1, colore: TINTE[0], nome: 'Blu' }, { id: 2, colore: TINTE[1], nome: 'Rosso' });
  const raso: Array<[number, number]> = [];
  for (let i = 0; i <= 60; i++) { const x = al10(i * 0.5); raso.push([x, i % 2 ? 8 : 0]); }
  const cerchio: Array<[number, number]> = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; cerchio.push([al10(15 + 10 * Math.cos(a)), al10(15 + 10 * Math.sin(a))]); }
  const riquadro: Array<[number, number]> = [];
  for (const [x0, y0, x1, y1] of [[0, 0, 40, 0], [40, 0, 40, 25], [40, 25, 0, 25], [0, 25, 0, 0]]) {
    for (let t = 0; t < 10; t++) riquadro.push([al10(x0 + ((x1 - x0) * t) / 10), al10(y0 + ((y1 - y0) * t) / 10)]);
  }
  riquadro.push([0, 0]);
  doc.oggetti.push(
    { id: 'o1', nome: 'Raso', blocchi: [{ ago: 1, punti: raso }], fili: [1], dx: 0, dy: 0, arrivo: 'auto' },
    { id: 'o2', nome: 'Riquadro', blocchi: [{ ago: 1, punti: riquadro }], fili: [2], dx: -5, dy: 15, arrivo: 'auto' },
    { id: 'o3', nome: 'Cerchio', blocchi: [{ ago: 1, punti: cerchio }], fili: [1], dx: 40, dy: -5, arrivo: 'auto' },
  );
  return doc;
}

/** Il referto del documento (K3), dai byte che vanno in macchina. Null se non c'è niente da cucire. */
export function refertoDi(doc: Documento, c: Composizione = componi(doc)): Referto | null {
  const nudo = dstNudo(doc, c);
  return nudo ? misuraDst(nudo) : null;
}

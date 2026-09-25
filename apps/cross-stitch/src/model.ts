// Il modello del Cross-Stitch: una griglia di celle, e in ogni cella un punto di un colore.
//
// Nessun DOM. È il contratto fra l'editor (tool.ts), il motore dei passaggi (routing.ts) e i test.
//
// UN PUNTO PER COLONNA (Lorenzo, 2026-09-24, «B, un punto per colonna»). Ogni cella è larga quanto
// il suo punto: la V sta dentro la cella — dall'angolo in alto a sinistra alla punta al centro in
// basso, e su all'angolo in alto a destra — come la croce e la diagonale. Così V e croce hanno la
// stessa misura e si mescolano nella stessa griglia. Fino a 0.3.0 la V occupava due colonne (una
// gamba per colonna): quei progetti si convertono all'apertura (`fromTwoColumnV`).
//
// Coordinate. La griglia ha `rows × cols` celle di `cellW × cellH` mm. Il filo entra ed esce dal
// tessuto negli angoli delle celle e a METÀ dei loro lati orizzontali (dove cade la punta della V):
// il reticolo ha quindi `(rows+1) × (2·cols+1)` vertici, a passo di mezza cella in orizzontale. Un
// vertice si indica con un intero `i * (2·cols+1) + j` (i = riga del reticolo, j = mezza colonna):
// j pari = angolo di cella, j dispari = metà del lato.
//
// Nella vecchia app (ThreadRoute) c'erano anche gli spazi fra le celle (gapX/gapY). Qui non ci
// sono: con uno spazio due celle vicine non condividono più gli angoli.

/** Una diagonale di una cella. `down` = «\» (da alto-sinistra a basso-destra), `up` = «/». */
export type Leg = 'down' | 'up';

/**
 * Il punto che sta in una cella: la diagonale «\» o «/», la croce (prima la gamba sotto, poi
 * quella sopra), la V e la Λ (la V capovolta), ognuna dentro la sua cella.
 */
export type Stitch = Leg | 'cross' | 'v' | 'lambda';

export interface GridSpec {
  cols: number;
  rows: number;
  /** Larghezza della cella = larghezza del punto, mm. */
  cellW: number;
  /** Altezza della cella, mm. */
  cellH: number;
  /**
   * Sormonto delle righe, in % dell'altezza della cella: 0 = le righe si toccano, 40 = ogni riga
   * sale del 40% dentro quella di sopra, e le V si infilano una nell'altra come nella maglia.
   */
  overlapPct?: number;
}

/** Cosa c'è in una cella: il punto e l'indice del suo colore nella tavolozza. */
export interface CellMark {
  stitch: Stitch;
  color: number;
}

/** Le celle occupate, per indice `r * cols + c`. Le vuote non ci sono. */
export type Cells = Map<number, CellMark>;

/** Un filo della tavolozza. L'ordine della tavolozza è l'ordine degli aghi. */
export interface Thread {
  hex: string;
  /** Passate su ogni diagonale di questo filo (Lorenzo: «un colore 3 passaggi, quello sopra 5»). */
  passes?: number;
}

export const DEFAULT_GRID: GridSpec = { cols: 24, rows: 16, cellW: 5, cellH: 5 };

export const cellIndex = (g: GridSpec, r: number, c: number): number => r * g.cols + c;
/** Vertici per riga del reticolo: angoli e metà dei lati. */
export const latticeWidth = (g: GridSpec): number => 2 * g.cols + 1;
/** Il vertice alla riga `i` e alla mezza colonna `j` (j pari = angolo, dispari = metà lato). */
export const vertexIndex = (g: GridSpec, i: number, j: number): number => i * latticeWidth(g) + j;
export const vertexCount = (g: GridSpec): number => (g.rows + 1) * latticeWidth(g);

/** Il punto in mm di un vertice del reticolo, senza sormonto. */
export function vertexPoint(g: GridSpec, v: number): { x: number; y: number } {
  const W = latticeWidth(g);
  const i = Math.floor(v / W);
  return { x: (v - i * W) * (g.cellW / 2), y: i * g.cellH };
}

// ------------------------------------------------------------
// Il sormonto delle righe
//
// Il routing ragiona sul reticolo, dove il fondo di una riga e la cima della riga dopo sono lo
// STESSO vertice. Col sormonto in millimetri non lo sono più: la riga r occupa da r·passo a
// r·passo + altezza, e passo < altezza. Quindi la posizione di un vertice dipende dalla riga di cui
// fa parte il tratto: `pointInRow`. Il percorso non cambia; dove un tratto finisce in una riga e il
// successivo parte dalla riga dopo, fra i due c'è il piccolo scarto del sormonto, e il filo lo
// copre dritto (dentro la zona dove le due righe si sovrappongono).
// ------------------------------------------------------------

/** Di quanto scende ogni riga, mm. */
export function rowPitch(g: GridSpec): number {
  const pct = Math.min(90, Math.max(0, g.overlapPct ?? 0));
  return g.cellH * (1 - pct / 100);
}

/** Altezza totale della griglia, mm. */
export function gridHeight(g: GridSpec): number {
  return g.rows > 0 ? (g.rows - 1) * rowPitch(g) + g.cellH : 0;
}

/** Il vertice `v` visto dalla riga `r` (in alto se è sulla riga r, in basso se è sulla r+1). */
export function pointInRow(g: GridSpec, v: number, r: number): { x: number; y: number } {
  const W = latticeWidth(g);
  const i = Math.floor(v / W);
  return { x: (v - i * W) * (g.cellW / 2), y: r * rowPitch(g) + (i - r) * g.cellH };
}

/** I due capi in mm di un tratto fra due vertici del reticolo, ognuno nella riga giusta. */
export function segmentPoints(g: GridSpec, from: number, to: number): [{ x: number; y: number }, { x: number; y: number }] {
  const W = latticeWidth(g);
  const i1 = Math.floor(from / W), i2 = Math.floor(to / W);
  const j1 = from - i1 * W, j2 = to - i2 * W;
  // Passaggio VERTICALE, da vertice a vertice (Lorenzo, 2026-09-24): a metà cella c'è la PUNTA
  // della V (in fondo alla riga di sopra), sugli angoli la cima della V. Così il tratto va dalla
  // punta di una V alla punta della V sotto (o da angolo ad angolo), lungo quanto il passo della
  // riga, senza scarti.
  if (j1 === j2 && i1 !== i2) return [knitVertex(g, from), knitVertex(g, to)];
  // diagonale: la riga è quella fra i due; bordo orizzontale: la riga che parte lì
  const r = i1 !== i2 ? Math.min(i1, i2) : Math.min(i1, g.rows - 1);
  return [pointInRow(g, from, r), pointInRow(g, to, r)];
}

/**
 * Dove sta un vertice nella maglia: a metà cella (j dispari) la punta della V della riga di sopra
 * (i−1), sull'angolo (j pari) la cima della V della riga i. In fondo alla griglia, il fondo
 * dell'ultima riga.
 */
export function knitVertex(g: GridSpec, v: number): { x: number; y: number } {
  const W = latticeWidth(g);
  const i = Math.floor(v / W), j = v - i * W;
  const p = rowPitch(g);
  const x = j * (g.cellW / 2);
  if (j % 2 === 1 && i >= 1) return { x, y: (i - 1) * p + g.cellH };
  if (i >= g.rows) return { x, y: (g.rows - 1) * p + g.cellH };
  return { x, y: i * p };
}

/**
 * Le diagonali di una croce, nell'ordine in cui vanno cucite. La gamba sopra si cuce per seconda
 * — e deve essere la stessa in tutte le croci, altrimenti la luce le fa sembrare due punti
 * diversi (la regola del punto croce a mano, che a macchina si vede uguale).
 */
export function legsOf(stitch: Stitch, topLeg: Leg): Leg[] {
  if (stitch === 'cross') return topLeg === 'down' ? ['up', 'down'] : ['down', 'up'];
  if (stitch === 'down' || stitch === 'up') return [stitch];
  return [];
}

/**
 * Le gambe del punto nella cella (r, c), come coppie di vertici del reticolo, nell'ordine in cui
 * vanno cucite. `a` è l'inizio "naturale" (quello della direzione fissa).
 *
 * - diagonale «\»: angolo in alto a sinistra → angolo in basso a destra; «/» dal basso a sinistra;
 * - croce: le due diagonali, prima quella sotto;
 * - V: angolo in alto a sinistra → punta a metà del lato di sotto → angolo in alto a destra;
 * - Λ: angolo in basso a sinistra → punta a metà del lato di sopra → angolo in basso a destra.
 */
export function stitchLegs(g: GridSpec, r: number, c: number, stitch: Stitch, topLeg: Leg): Array<{ a: number; b: number }> {
  const j = 2 * c;
  const V = (i: number, jj: number) => vertexIndex(g, i, jj);
  const diag = (leg: Leg) => (leg === 'down' ? { a: V(r, j), b: V(r + 1, j + 2) } : { a: V(r + 1, j), b: V(r, j + 2) });
  if (stitch === 'v') return [{ a: V(r, j), b: V(r + 1, j + 1) }, { a: V(r + 1, j + 1), b: V(r, j + 2) }];
  if (stitch === 'lambda') return [{ a: V(r + 1, j), b: V(r, j + 1) }, { a: V(r, j + 1), b: V(r + 1, j + 2) }];
  return legsOf(stitch, topLeg).map(diag);
}

// ------------------------------------------------------------
// Gli strumenti di disegno
// ------------------------------------------------------------

/** Lo strumento attivo nell'editor. */
export type Tool = 'diag' | 'v' | 'cross' | 'erase';

export type Button = 'left' | 'right';

/** Una modifica a una cella: `null` = svuota. */
export interface CellEdit { r: number; c: number; mark: CellMark | null; }

/**
 * Cosa fa un clic in una cella, per ogni strumento. È qui (e non nell'editor) perché è la parte
 * che si decide con Lorenzo, e così si prova senza browser.
 *
 * - **Diagonale**: sinistro «\», destro «/» (come nella vecchia app).
 * - **V**: sinistro V, destro Λ — dentro la cella cliccata.
 * - **Croce**: sinistro e destro mettono la croce (le gambe hanno già il loro ordine).
 * - **Gomma**: svuota. Maiuscolo + clic svuota con qualunque strumento.
 */
export function editsFor(g: GridSpec, tool: Tool, button: Button, r: number, c: number, color: number, erase = false): CellEdit[] {
  if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return [];
  if (erase || tool === 'erase') return [{ r, c, mark: null }];
  if (tool === 'diag') return [{ r, c, mark: { stitch: button === 'left' ? 'down' : 'up', color } }];
  if (tool === 'cross') return [{ r, c, mark: { stitch: 'cross', color } }];
  return [{ r, c, mark: { stitch: button === 'left' ? 'v' : 'lambda', color } }];
}

export function applyEdits(g: GridSpec, cells: Cells, edits: CellEdit[]): boolean {
  let changed = false;
  for (const e of edits) {
    const k = cellIndex(g, e.r, e.c);
    const old = cells.get(k);
    if (e.mark === null) {
      if (old) { cells.delete(k); changed = true; }
    } else if (!old || old.stitch !== e.mark.stitch || old.color !== e.mark.color) {
      cells.set(k, e.mark);
      changed = true;
    }
  }
  return changed;
}

/** Ridimensiona la griglia tenendo le celle che ci stanno ancora, al loro posto (riga, colonna). */
export function resizeCells(from: GridSpec, to: GridSpec, cells: Cells): Cells {
  const out: Cells = new Map();
  for (const [k, m] of cells) {
    const r = Math.floor(k / from.cols), c = k - r * from.cols;
    if (r < to.rows && c < to.cols) out.set(cellIndex(to, r, c), m);
  }
  return out;
}

// ------------------------------------------------------------
// Serializzazione (nel metadata di SVG e DST, R27)
// ------------------------------------------------------------

const STITCH_CODE: Record<Stitch, string> = { down: 'd', up: 'u', cross: 'x', v: 'v', lambda: 'l' };
const CODE_STITCH: Record<string, Stitch> = { d: 'down', u: 'up', x: 'cross', v: 'v', l: 'lambda' };

/** Le celle in forma compatta: `[r, c, 'd'|'u'|'x'|'v'|'l', colore]`. */
export function cellsToJson(g: GridSpec, cells: Cells): Array<[number, number, string, number]> {
  return [...cells.entries()].sort((a, b) => a[0] - b[0]).map(([k, m]) => {
    const r = Math.floor(k / g.cols);
    return [r, k - r * g.cols, STITCH_CODE[m.stitch], m.color];
  });
}

export function cellsFromJson(g: GridSpec, data: unknown): Cells {
  const out: Cells = new Map();
  if (!Array.isArray(data)) return out;
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    const [r, c, s, color] = row as [number, number, string, number];
    const stitch = CODE_STITCH[s];
    if (!stitch || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue;
    out.set(cellIndex(g, r, c), { stitch, color: Number.isInteger(color) && color >= 0 ? color : 0 });
  }
  return out;
}

/**
 * Converte un progetto di prima di 0.4.0, quando la V occupava DUE colonne (una gamba per
 * colonna), al modello «un punto per colonna»: ogni coppia di colonne diventa una colonna larga il
 * doppio. «\» + «/» dello stesso colore → V, «/» + «\» → Λ; una gamba da sola resta una diagonale
 * (ora larga tutta la cella), una croce resta croce.
 */
export function fromTwoColumnV(g: GridSpec, cells: Cells): { grid: GridSpec; cells: Cells } {
  const grid: GridSpec = { ...g, cols: Math.max(1, Math.ceil(g.cols / 2)), cellW: g.cellW * 2 };
  const out: Cells = new Map();
  for (let r = 0; r < g.rows; r++) {
    for (let p = 0; p < grid.cols; p++) {
      const L = cells.get(r * g.cols + 2 * p), R = 2 * p + 1 < g.cols ? cells.get(r * g.cols + 2 * p + 1) : undefined;
      let mark: CellMark | null = null;
      if (L && R && L.color === R.color && L.stitch === 'down' && R.stitch === 'up') mark = { stitch: 'v', color: L.color };
      else if (L && R && L.color === R.color && L.stitch === 'up' && R.stitch === 'down') mark = { stitch: 'lambda', color: L.color };
      else if (L || R) mark = { ...(L ?? R)! };
      if (mark) out.set(cellIndex(grid, r, p), mark);
    }
  }
  return { grid, cells: out };
}

/**
 * Un progetto della vecchia app ThreadRoute (file .json, versione 3.x): griglia, celle con la loro
 * diagonale, ripetizioni. Si porta dentro così com'è, tutto nel primo colore. Gli spazi fra le
 * celle e i passaggi modificati a mano non si portano (vedi in cima al file).
 */
export function fromThreadRoute(data: unknown): { grid: GridSpec; cells: Cells; repetitions: number } | null {
  const p = data as { grid?: { rows?: number; columns?: number; cellWidth?: number; cellHeight?: number }; cells?: Array<{ row: number; col: number; enabled: boolean; orientation: string | null }>; primitive?: { repetitions?: number } };
  if (!p || !p.grid || !Array.isArray(p.cells)) return null;
  const grid: GridSpec = {
    rows: Math.max(1, Math.round(p.grid.rows ?? 1)),
    cols: Math.max(1, Math.round(p.grid.columns ?? 1)),
    cellW: Math.max(0.5, p.grid.cellWidth ?? 5),
    cellH: Math.max(0.5, p.grid.cellHeight ?? 5),
  };
  const cells: Cells = new Map();
  for (const cell of p.cells) {
    if (!cell.enabled || !cell.orientation) continue;
    if (cell.row < 0 || cell.col < 0 || cell.row >= grid.rows || cell.col >= grid.cols) continue;
    cells.set(cellIndex(grid, cell.row, cell.col), { stitch: cell.orientation === 'diagonalUp' ? 'up' : 'down', color: 0 });
  }
  return { grid, cells, repetitions: Math.max(1, Math.round(p.primitive?.repetitions ?? 1)) };
}

// ------------------------------------------------------------
// Dall'immagine alla maglia
// ------------------------------------------------------------

/** Pixel RGBA riga per riga (lo stesso contratto di `PixelImage` in @rg/core). */
export interface Pixels { rgba: Uint8ClampedArray | number[]; width: number; height: number; }

type Rgb3 = [number, number, number];

const nearest = (r: number, g: number, b: number, palette: Rgb3[]): number => {
  let best = 0, bestD = Infinity;
  for (let k = 0; k < palette.length; k++) {
    const d = (r - palette[k][0]) ** 2 + (g - palette[k][1]) ** 2 + (b - palette[k][2]) ** 2;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
};

/**
 * Affina una tavolozza con qualche giro di k-medie (Lloyd): ogni colore diventa la media dei
 * pixel che gli sono più vicini. Serve perché il median-cut, su un'immagine quasi tutta bianca,
 * mette il bianco da una parte e TUTTO il resto dall'altra — neri e grigi dei bordi insieme — e
 * la media di quella scatola è un grigio: sul giornale Dior il "nero" usciva #8D8D8D. Dopo
 * l'affinamento i grigi dei bordi vanno col colore a cui somigliano, e il nero torna nero.
 * Deterministico: pixel campionati a passo fisso.
 */
export function refinePalette(img: Pixels, palette: Rgb3[], rounds = 8, maxSample = 60000): Rgb3[] {
  const n = Math.floor(img.rgba.length / 4);
  if (!n || !palette.length) return palette.map((c) => [...c] as Rgb3);
  const step = Math.max(1, Math.floor(n / maxSample));
  let pal = palette.map((c) => [...c] as Rgb3);
  for (let it = 0; it < rounds; it++) {
    const sum = pal.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i += step) {
      const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2];
      const s = sum[nearest(r, g, b, pal)];
      s[0] += r; s[1] += g; s[2] += b; s[3]++;
    }
    pal = pal.map((c, k) => (sum[k][3] ? [Math.round(sum[k][0] / sum[k][3]), Math.round(sum[k][1] / sum[k][3]), Math.round(sum[k][2] / sum[k][3])] : c));
  }
  return pal;
}

/** Quanta parte dell'immagine va a ciascun colore della tavolozza (0..1). */
export function paletteShares(img: Pixels, palette: Rgb3[], maxSample = 60000): number[] {
  const n = Math.floor(img.rgba.length / 4);
  const step = Math.max(1, Math.floor(n / maxSample));
  const count = palette.map(() => 0);
  let tot = 0;
  for (let i = 0; i < n; i += step) { count[nearest(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2], palette)]++; tot++; }
  return count.map((c) => (tot ? c / tot : 0));
}

/** Il punto della generazione da immagine. */
export type KnitStitch = 'v' | 'lambda' | 'cross' | 'down' | 'up';

export interface KnitOptions {
  /**
   * Il colore di FONDO (indice nella tavolozza): una cella lo prende a meno che un altro colore
   * non occupi almeno `detailPct` della sua area. Di solito è quello che copre di più.
   */
  background: number;
  /**
   * La soglia del dettaglio, in %: basta questa parte di nero in una cella per farla nera. Col 50%
   * è la maggioranza; più basso salva i tratti sottili (le lettere del giornale), più alto li perde.
   */
  detailPct: number;
  /**
   * Il punto della generazione (Lorenzo, 2026-09-24): `v` la maglia (default), `lambda` la V
   * capovolta, `cross` la croce, `down`/`up` la sola diagonale «\» o «/». Uno per cella.
   */
  stitch: KnitStitch;
}

export const DEFAULT_KNIT: Omit<KnitOptions, 'background'> = { detailPct: 35, stitch: 'v' };

/**
 * La MAGLIA da un'immagine: ogni cella della griglia prende il punto scelto e un filo.
 * L'immagine è stirata sulla griglia, come nell'anteprima.
 *
 * Come si sceglie il filo. Non col colore MEDIO dell'area: un tratto nero sottile, mediato col
 * bianco intorno, diventa bianco e sparisce — era il difetto sul giornale Dior, dove le lettere
 * si perdevano. Si conta invece quanti pixel dell'area somigliano a ciascun filo, e un filo di
 * dettaglio vince se ne ha almeno `detailPct`; altrimenti resta il fondo.
 *
 * `palette` = i fili in RGB, nell'ordine della tavolozza.
 */
export function knitFromImage(g: GridSpec, img: Pixels, palette: Rgb3[], opts: Partial<KnitOptions> = {}): Cells {
  const out: Cells = new Map();
  if (!palette.length || img.width < 1 || img.height < 1) return out;
  const background = Math.min(palette.length - 1, Math.max(0, opts.background ?? 0));
  const detail = Math.min(100, Math.max(1, opts.detailPct ?? DEFAULT_KNIT.detailPct)) / 100;
  const stitch: Stitch = opts.stitch ?? DEFAULT_KNIT.stitch;
  const count = new Array<number>(palette.length);

  /** Il filo dell'area di immagine [x0,x1) × [y0,y1). */
  const pick = (x0: number, x1: number, y0: number, y1: number): number => {
    count.fill(0);
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      count[nearest(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], palette)]++;
      n++;
    }
    let best = background, bestN = -1;
    for (let k = 0; k < palette.length; k++) if (k !== background && count[k] > bestN) { bestN = count[k]; best = k; }
    return n && best !== background && bestN / n >= detail ? best : background;
  };
  const xAt = (c: number) => Math.floor((c * img.width) / g.cols);

  for (let r = 0; r < g.rows; r++) {
    const y0 = Math.floor((r * img.height) / g.rows), y1 = Math.max(y0 + 1, Math.floor(((r + 1) * img.height) / g.rows));
    for (let c = 0; c < g.cols; c++) {
      out.set(cellIndex(g, r, c), { stitch, color: pick(xAt(c), Math.max(xAt(c) + 1, xAt(c + 1)), y0, y1) });
    }
  }
  return out;
}

/**
 * La griglia che serve per un ricamo di `widthMm × heightMm` con celle `cellW × cellH` e il
 * sormonto dato: si parte dalle misure del ricamo, non dal numero di celle (decisione di Lorenzo,
 * 2026-09-24). Una colonna = un punto; le righe tengono conto del sormonto, che è solo verticale:
 * altezza = (righe − 1) × passo + altezza cella. Il ricamo esce della misura più vicina
 * possibile, non esatta: le celle sono intere.
 */
export function gridForSize(widthMm: number, heightMm: number, cellW: number, cellH: number, overlapPct: number): GridSpec {
  const w = Math.max(0.5, cellW), h = Math.max(0.5, cellH);
  const pct = Math.min(90, Math.max(0, overlapPct));
  const pitch = h * (1 - pct / 100);
  const cols = Math.min(1000, Math.max(1, Math.round(Math.max(0, widthMm) / w)));
  const rows = Math.min(1000, Math.max(1, Math.round((Math.max(h, heightMm) - h) / pitch) + 1));
  return { cols, rows, cellW: w, cellH: h, overlapPct: pct };
}

// ------------------------------------------------------------
// La modifica a mano: pennello, riempimento, gomma
//
// Chiesta da Lorenzo dopo la prima maglia dal giornale Dior: «se voglio pulire l'interno della
// scritta che mi mette il nero e invece voglio il bianco devo poterlo fare, o se voglio proprio
// cancellare qualcosa». Si lavora a celle intere: ogni cella è un punto.
// ------------------------------------------------------------

/** Il punto che il pennello mette su una cella vuota. */
export type BrushStitch = 'v' | 'diag' | 'cross';

/** Il punto nuovo per una cella vuota: V/Λ, «\»/«/», o croce, secondo il tasto. */
function freshStitch(stitch: BrushStitch, button: Button): Stitch {
  if (stitch === 'cross') return 'cross';
  if (stitch === 'diag') return button === 'left' ? 'down' : 'up';
  return button === 'left' ? 'v' : 'lambda';
}

/** Le celle sotto un pennello di `size` × `size` punti, centrato sulla cella (r, c). */
export function brushArea(g: GridSpec, r: number, c: number, size: number): Array<{ r: number; c: number }> {
  const n = Math.max(1, Math.round(size));
  const r0 = r - Math.floor((n - 1) / 2);
  const c0 = c - Math.floor((n - 1) / 2);
  const out: Array<{ r: number; c: number }> = [];
  for (let rr = r0; rr < r0 + n; rr++) {
    if (rr < 0 || rr >= g.rows) continue;
    for (let cc = c0; cc < c0 + n; cc++) if (cc >= 0 && cc < g.cols) out.push({ r: rr, c: cc });
  }
  return out;
}

/**
 * Il pennello: ricolora col filo `color` quello che c'è sotto (il punto resta quello che è), e
 * sulle celle vuote mette il punto scelto. `erase` = gomma: svuota.
 */
export function brushEdits(g: GridSpec, cells: Cells, r: number, c: number, size: number, color: number, stitch: BrushStitch, button: Button, erase: boolean): CellEdit[] {
  return brushArea(g, r, c, size).map(({ r: rr, c: cc }) => {
    if (erase) return { r: rr, c: cc, mark: null };
    const old = cells.get(cellIndex(g, rr, cc));
    return { r: rr, c: cc, mark: { stitch: old ? old.stitch : freshStitch(stitch, button), color } };
  });
}

/**
 * Il riempimento: dalla cella (r, c) si allarga alle celle vicine (sopra, sotto, destra, sinistra)
 * che hanno lo STESSO colore — o sono vuote, se si parte da una vuota — e le passa tutte al filo
 * `color` (o le svuota, con `erase`). È il modo di pulire l'interno di una lettera con un clic.
 */
export function fillEdits(g: GridSpec, cells: Cells, r: number, c: number, color: number, stitch: BrushStitch, button: Button, erase: boolean): CellEdit[] {
  if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return [];
  const keyOf = (rr: number, cc: number) => cells.get(cellIndex(g, rr, cc))?.color ?? -1;
  const target = keyOf(r, c);
  if (!erase && target === color) return [];
  if (erase && target === -1) return [];
  const seen = new Uint8Array(g.rows * g.cols);
  const edits: CellEdit[] = [];
  const stack: Array<[number, number]> = [[r, c]];
  seen[r * g.cols + c] = 1;
  while (stack.length) {
    const [rr, cc] = stack.pop()!;
    const old = cells.get(cellIndex(g, rr, cc));
    edits.push({ r: rr, c: cc, mark: erase ? null : { stitch: old ? old.stitch : freshStitch(stitch, button), color } });
    for (const [nr, nc] of [[rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]] as Array<[number, number]>) {
      if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols || seen[nr * g.cols + nc]) continue;
      seen[nr * g.cols + nc] = 1;
      if (keyOf(nr, nc) === target) stack.push([nr, nc]);
    }
  }
  return edits;
}

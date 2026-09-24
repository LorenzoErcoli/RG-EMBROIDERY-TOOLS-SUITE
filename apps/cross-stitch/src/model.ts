// Il modello del Cross-Stitch: una griglia di celle, e in ogni cella un punto di un colore.
//
// Nessun DOM. È il contratto fra l'editor (tool.ts), il motore dei passaggi (routing.ts) e i test.
//
// Coordinate. La griglia ha `rows × cols` celle di `cellW × cellH` mm. I suoi ANGOLI sono i
// vertici del reticolo, `(rows+1) × (cols+1)`: è lì che il filo entra ed esce dal tessuto. Un
// vertice si indica con un intero `i * (cols+1) + j` (i = riga del reticolo, j = colonna).
//
// Nella vecchia app (ThreadRoute) c'erano anche gli spazi fra le celle (gapX/gapY). Qui non ci
// sono: con uno spazio due celle vicine non condividono più gli angoli, e la V — il punto che
// nasce proprio dall'angolo in comune — non esiste più.

/** Una diagonale di una cella. `down` = «\» (da alto-sinistra a basso-destra), `up` = «/». */
export type Leg = 'down' | 'up';

/** Il punto che sta in una cella. `cross` = le due diagonali, prima quella sotto e poi quella sopra. */
export type Stitch = Leg | 'cross';

export interface GridSpec {
  cols: number;
  rows: number;
  /** Larghezza della cella, mm. */
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
}

export const DEFAULT_GRID: GridSpec = { cols: 24, rows: 16, cellW: 5, cellH: 5 };

export const cellIndex = (g: GridSpec, r: number, c: number): number => r * g.cols + c;
export const vertexIndex = (g: GridSpec, i: number, j: number): number => i * (g.cols + 1) + j;
export const vertexCount = (g: GridSpec): number => (g.rows + 1) * (g.cols + 1);

/** Il punto in mm di un vertice del reticolo. */
export function vertexPoint(g: GridSpec, v: number): { x: number; y: number } {
  const i = Math.floor(v / (g.cols + 1));
  const j = v - i * (g.cols + 1);
  return { x: j * g.cellW, y: i * g.cellH };
}

// ------------------------------------------------------------
// Il sormonto delle righe
//
// Il routing ragiona sul reticolo degli angoli, dove l'angolo in basso di una riga e quello in alto
// della riga dopo sono lo STESSO vertice. Col sormonto in millimetri non lo sono più: la riga r
// occupa da r·passo a r·passo + altezza, e passo < altezza. Quindi la posizione di un vertice
// dipende dalla riga di cui fa parte il tratto: `pointInRow`. Il percorso non cambia; dove un
// tratto finisce in una riga e il successivo parte dalla riga dopo, fra i due c'è il piccolo
// scarto del sormonto, e il filo lo copre dritto (dentro la zona dove le due righe si sovrappongono).
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

/** Il vertice `v` visto come angolo della riga `r` (in alto se è sulla riga r, in basso se è sulla r+1). */
export function pointInRow(g: GridSpec, v: number, r: number): { x: number; y: number } {
  const i = Math.floor(v / (g.cols + 1));
  const j = v - i * (g.cols + 1);
  return { x: j * g.cellW, y: r * rowPitch(g) + (i - r) * g.cellH };
}

/** I due capi in mm di un tratto fra due vertici vicini del reticolo, ognuno nella riga giusta. */
export function segmentPoints(g: GridSpec, from: number, to: number): [{ x: number; y: number }, { x: number; y: number }] {
  const W = g.cols + 1;
  const i1 = Math.floor(from / W), i2 = Math.floor(to / W);
  const j1 = from - i1 * W, j2 = to - i2 * W;
  // Passaggio VERTICALE, da vertice a vertice (Lorenzo, 2026-09-24): nella maglia le colonne
  // dispari del reticolo sono le PUNTE delle V (in fondo alla riga di sopra), le pari gli ANGOLI
  // in alto. Così il tratto va esattamente dalla punta di una V alla punta della V sotto (o da
  // angolo ad angolo), lungo quanto il passo della riga, senza scarti.
  if (j1 === j2 && i1 !== i2) return [knitVertex(g, from), knitVertex(g, to)];
  // diagonale: la riga è quella fra i due; bordo orizzontale: la riga che parte lì
  const r = i1 !== i2 ? Math.min(i1, i2) : Math.min(i1, g.rows - 1);
  return [pointInRow(g, from, r), pointInRow(g, to, r)];
}

/**
 * Dove sta un vertice del reticolo nella maglia: colonna dispari = la punta della V della riga di
 * sopra (i−1), colonna pari = l'angolo in alto della V della riga i. In fondo alla griglia, il
 * fondo dell'ultima riga.
 */
export function knitVertex(g: GridSpec, v: number): { x: number; y: number } {
  const W = g.cols + 1;
  const i = Math.floor(v / W), j = v - i * W;
  const p = rowPitch(g);
  if (j % 2 === 1 && i >= 1) return { x: j * g.cellW, y: (i - 1) * p + g.cellH };
  if (i >= g.rows) return { x: j * g.cellW, y: (g.rows - 1) * p + g.cellH };
  return { x: j * g.cellW, y: i * p };
}

/** Gli estremi di una diagonale: `a` è l'inizio "naturale" (quello della direzione fissa). */
export function legEnds(g: GridSpec, r: number, c: number, leg: Leg): { a: number; b: number } {
  return leg === 'down'
    ? { a: vertexIndex(g, r, c), b: vertexIndex(g, r + 1, c + 1) }        // alto-sx → basso-dx
    : { a: vertexIndex(g, r + 1, c), b: vertexIndex(g, r, c + 1) };       // basso-sx → alto-dx
}

/**
 * Le diagonali di un punto, nell'ordine in cui vanno cucite. Nella croce la gamba sopra si cuce
 * per seconda — e deve essere la stessa in tutte le croci, altrimenti la luce le fa sembrare
 * due punti diversi (la regola del punto croce a mano, che a macchina si vede uguale).
 */
export function legsOf(stitch: Stitch, topLeg: Leg): Leg[] {
  if (stitch !== 'cross') return [stitch];
  return topLeg === 'down' ? ['up', 'down'] : ['down', 'up'];
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
 * - **V**: un clic mette DUE celle — quella cliccata e la sua vicina a destra — che si toccano
 *   nell'angolo in comune. Sinistro = V («\» poi «/»), destro = Λ («/» poi «\»).
 * - **Croce**: sinistro e destro mettono la croce (le gambe hanno già il loro ordine).
 * - **Gomma**: svuota. Maiuscolo + clic svuota con qualunque strumento.
 */
export function editsFor(g: GridSpec, tool: Tool, button: Button, r: number, c: number, color: number, erase = false): CellEdit[] {
  if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return [];
  if (erase || tool === 'erase') return [{ r, c, mark: null }];
  if (tool === 'diag') return [{ r, c, mark: { stitch: button === 'left' ? 'down' : 'up', color } }];
  if (tool === 'cross') return [{ r, c, mark: { stitch: 'cross', color } }];
  // V / Λ: la seconda metà solo se la griglia continua a destra.
  const first: Leg = button === 'left' ? 'down' : 'up';
  const second: Leg = first === 'down' ? 'up' : 'down';
  const edits: CellEdit[] = [{ r, c, mark: { stitch: first, color } }];
  if (c + 1 < g.cols) edits.push({ r, c: c + 1, mark: { stitch: second, color } });
  return edits;
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

const STITCH_CODE: Record<Stitch, string> = { down: 'd', up: 'u', cross: 'x' };
const CODE_STITCH: Record<string, Stitch> = { d: 'down', u: 'up', x: 'cross' };

/** Le celle in forma compatta: `[r, c, 'd'|'u'|'x', colore]`. */
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

export interface KnitOptions {
  /**
   * Il colore di FONDO (indice nella tavolozza): una V lo prende a meno che un altro colore non
   * occupi almeno `detailPct` della sua area. Di solito è quello che copre di più.
   */
  background: number;
  /**
   * La soglia del dettaglio, in %: basta questa parte di nero in una V per farla nera. Col 50% è
   * la maggioranza; più basso salva i tratti sottili (le lettere del giornale), più alto li perde.
   */
  detailPct: number;
  /** Vero = il colore si decide per ogni GAMBA (mezza V, una colonna): il doppio di dettaglio in orizzontale. */
  perLeg: boolean;
}

export const DEFAULT_KNIT: Omit<KnitOptions, 'background'> = { detailPct: 35, perLeg: false };

/**
 * La MAGLIA da un'immagine: la griglia si riempie di V — «\» e «/» in due colonne vicine, come
 * i punti di un lavoro a maglia — e ogni V (o ogni sua gamba, con `perLeg`) prende un filo.
 * L'immagine è stirata sulla griglia, come nell'anteprima.
 *
 * Come si sceglie il filo. Non col colore MEDIO dell'area: un tratto nero sottile, mediato col
 * bianco intorno, diventa bianco e sparisce — era il difetto sul giornale Dior, dove le lettere
 * si perdevano. Si conta invece quanti pixel dell'area somigliano a ciascun filo, e un filo di
 * dettaglio vince se ne ha almeno `detailPct`; altrimenti resta il fondo.
 *
 * `palette` = i fili in RGB, nell'ordine della tavolozza. Con un numero dispari di colonne
 * l'ultima resta vuota (mezza V non è un punto di maglia), anche con `perLeg`.
 */
export function knitFromImage(g: GridSpec, img: Pixels, palette: Rgb3[], opts: Partial<KnitOptions> = {}): Cells {
  const out: Cells = new Map();
  if (!palette.length || img.width < 1 || img.height < 1) return out;
  const background = Math.min(palette.length - 1, Math.max(0, opts.background ?? 0));
  const detail = Math.min(100, Math.max(1, opts.detailPct ?? DEFAULT_KNIT.detailPct)) / 100;
  const perLeg = opts.perLeg ?? DEFAULT_KNIT.perLeg;
  const pairs = Math.floor(g.cols / 2);
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
    for (let p = 0; p < pairs; p++) {
      const c0 = 2 * p, c1 = c0 + 1;
      let left: number, right: number;
      if (perLeg) {
        left = pick(xAt(c0), Math.max(xAt(c0) + 1, xAt(c1)), y0, y1);
        right = pick(xAt(c1), Math.max(xAt(c1) + 1, xAt(c1 + 1)), y0, y1);
      } else {
        left = right = pick(xAt(c0), Math.max(xAt(c0) + 1, xAt(c1 + 1)), y0, y1);
      }
      out.set(cellIndex(g, r, c0), { stitch: 'down', color: left });
      out.set(cellIndex(g, r, c1), { stitch: 'up', color: right });
    }
  }
  return out;
}

/**
 * La griglia che serve per un ricamo di `widthMm × heightMm` con celle `cellW × cellH` e il
 * sormonto dato: si parte dalle misure del ricamo, non dal numero di celle (decisione di Lorenzo,
 * 2026-09-24). Le colonne sono PARI (una V occupa due colonne); le righe tengono conto del
 * sormonto, che è solo verticale: altezza = (righe − 1) × passo + altezza cella.
 * Il ricamo esce della misura più vicina possibile, non esatta: le celle sono intere.
 */
export function gridForSize(widthMm: number, heightMm: number, cellW: number, cellH: number, overlapPct: number): GridSpec {
  const w = Math.max(0.5, cellW), h = Math.max(0.5, cellH);
  const pct = Math.min(90, Math.max(0, overlapPct));
  const pitch = h * (1 - pct / 100);
  const cols = Math.min(1000, Math.max(2, 2 * Math.round(Math.max(0, widthMm) / w / 2)));
  const rows = Math.min(1000, Math.max(1, Math.round((Math.max(h, heightMm) - h) / pitch) + 1));
  return { cols, rows, cellW: w, cellH: h, overlapPct: pct };
}

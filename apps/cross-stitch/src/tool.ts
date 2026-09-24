import '@rg/ui/rg.css';
import './cross-stitch.css';
import {
  type ExportLayer,
  buildSvg, dstFromExportLayers, DST_FILE, readProjectMetadata, readDstMetadata, medianCutPalette, rgbToHex,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  type Button, type Cells, type GridSpec, type Leg, type Thread, type Tool,
  type Pixels, DEFAULT_GRID, applyEdits, knitFromImage, gridForSize, cellIndex, cellsFromJson, cellsToJson, editsFor, fromThreadRoute, legEnds, legsOf,
  resizeCells, pointInRow, segmentPoints, rowPitch, gridHeight,
} from './model';
import {
  type RouteParams, type RouteResult, type SegKind, type StitchParams,
  DEFAULT_ROUTE, DEFAULT_STITCH, colorPolylines, routeCells,
} from './routing';

const VERSION = '0.1.0';
const AUTOSAVE_KEY = 'rg-cross-stitch-autosave';

/** I fili di partenza: l'ordine è l'ordine degli aghi. */
const DEFAULT_THREADS: Thread[] = [{ hex: '#1a1a1a' }, { hex: '#b3261e' }];

const TOOL_HELP: Record<Tool, string> = {
  diag: 'Clic sinistro «\\», clic destro «/». Maiuscolo + clic cancella.',
  v: 'Un clic mette due celle che si toccano nell’angolo: sinistro V, destro Λ.',
  cross: 'Clic: la croce, con la gamba sopra sempre dallo stesso lato.',
  erase: 'Clic o trascina per svuotare le celle.',
};

/** Come si disegna ogni tipo di passaggio nell'anteprima (colori dai token del DS). */
const SEG_STYLE: Record<Exclude<SegKind, 'stitch'>, string> = {
  visible: 'stroke:var(--rg-color-danger);stroke-width:2',
  retrace: 'stroke:var(--rg-color-warning);stroke-width:2',
  hidden: 'stroke:var(--rg-color-neutral-600);stroke-width:1;stroke-dasharray:3 2',
  jump: 'stroke:var(--rg-color-neutral-400);stroke-width:1;stroke-dasharray:1 3',
};

interface State {
  grid: GridSpec;
  cells: Cells;
  threads: Thread[];
  route: RouteParams;
  stitch: StitchParams;
}

/** Monta il tool "Cross-Stitch" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountCrossStitch(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Cross-Stitch', opts.backHref)}
  <div class="rg-workspace cs-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="imageInput" accept="image/*" />
              <span class="rg-button rg-button--primary">Carica immagine…</span>
            </label>
            <p class="rg-file-input__status" id="imageStatus" role="status">Carica la foto o il disegno: la maglia si crea da sola, poi regoli le misure qui sotto.</p>
          </div>
          <label class="rg-field"><span class="rg-field__label">Opacità sotto la griglia</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="imageOpacity" type="number" min="0" max="100" step="5" value="0"><span>%</span></span></label>
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" id="knitBtn" class="rg-button rg-button--outline rg-button--small">Rifai la maglia dall’immagine</button>
            <button type="button" id="removeImageBtn" class="rg-button rg-button--ghost rg-button--small">Togli l’immagine</button>
          </div>
          <small class="rg-field__help rg-param-grid__wide">Ogni V prende il filo più vicino al colore dell’immagine sotto di lei. I colori dei fili si ricavano dall’immagine, tanti quanti sono i fili (sezione 03): il più chiaro per primo, così i suoi passaggi finiscono sotto quelli scuri.</small>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Misure del ricamo</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Larghezza ricamo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sizeW" type="number" min="1" step="1"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Altezza ricamo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sizeH" type="number" min="1" step="1"><span>mm</span></span></label>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="keepRatio" checked><span class="rg-toggle__track"></span><span>Altezza in proporzione all’immagine</span>
          </label>
          <label class="rg-field"><span class="rg-field__label">Larghezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="cellW" type="number" min="0.5" step="0.5"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Altezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="cellH" type="number" min="0.5" step="0.5"><span>mm</span></span></label>
          <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Sormonto delle righe</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="overlap" type="number" min="0" max="90" step="5"><span>%</span></span>
            <small class="rg-field__help">Solo in verticale: quanto ogni riga sale dentro quella di sopra, così le V si avvicinano e si infilano una nell’altra. In orizzontale le V si toccano e basta.</small></label>
          <p class="rg-field__help rg-param-grid__wide" id="formatInfo"></p>
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="projectInput" accept=".svg,.dst,.json" />
              <span class="rg-button rg-button--ghost rg-button--small">Apri progetto…</span>
            </label>
            <p class="rg-file-input__status" id="projectStatus" role="status">SVG o DST esportati da qui, o un progetto ThreadRoute (.json).</p>
          </div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Fili</h3></div>
        <ul class="rg-color-map" id="threads"></ul>
        <div class="rg-cluster"><button type="button" id="addThread" class="rg-button rg-button--ghost rg-button--small">Aggiungi filo</button></div>
        <p class="rg-field__help">Clic su un filo per disegnare con quello. L’ordine è l’ordine degli aghi: i passaggi di un filo si nascondono sotto quelli che vengono dopo.</p>
      </section>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Punto</span></summary>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <div class="rg-segmented" id="toolSel" role="group" aria-label="Strumento">
              <button type="button" class="rg-segmented__item" data-tool="diag">Diagonale</button>
              <button type="button" class="rg-segmented__item" data-tool="v">V</button>
              <button type="button" class="rg-segmented__item" data-tool="cross">Croce</button>
              <button type="button" class="rg-segmented__item" data-tool="erase">Gomma</button>
            </div>
            <small class="rg-field__help" id="toolHelp"></small>
          </div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Gamba sopra nella croce</span>
            <div class="rg-segmented" id="topLegSel" role="group" aria-label="Gamba sopra nella croce">
              <button type="button" class="rg-segmented__item" data-leg="down">«\\»</button>
              <button type="button" class="rg-segmented__item" data-leg="up">«/»</button>
            </div>
          </div>
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" id="undoBtn" class="rg-button rg-button--outline rg-button--small">Annulla</button>
            <button type="button" id="clearBtn" class="rg-button rg-button--ghost rg-button--small">Svuota tutto</button>
          </div>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Passaggi</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Passate per diagonale</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="reps" type="number" min="1" max="8" step="1"><span>n</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Salta oltre</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="jumpMm" type="number" min="0" step="1"><span>mm</span></span></label>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="fixedDir"><span class="rg-toggle__track"></span><span>Direzione fissa («\\» dall’alto, «/» dal basso)</span>
          </label>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="showPaths" checked><span class="rg-toggle__track"></span><span>Mostra i passaggi</span>
          </label>
          <small class="rg-field__help rg-param-grid__wide">Un passaggio più caro di «Salta oltre» (in mm di filo in vista) diventa un salto con taglio.</small>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Macchina</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Punto massimo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxStitch" type="number" min="1" max="12" step="0.5"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Punto dei passaggi</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="travelStitch" type="number" min="0.5" max="12" step="0.5"><span>mm</span></span></label>
          <small class="rg-field__help rg-param-grid__wide">Le diagonali più lunghe del punto massimo si spezzano in punti uguali.</small>
        </div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Disegno</h2>
        <div class="rg-cluster">
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Esporta SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">Pronto</span>
        <span class="cs-legend" id="legend">
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.visible}"/></svg>in vista</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.retrace}"/></svg>ripasso</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.hidden}"/></svg>nascosto</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.jump}"/></svg>salto</span>
        </span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => $<HTMLInputElement>(id);

  // ---- stato ------------------------------------------------------------------
  const st: State = {
    grid: { ...DEFAULT_GRID },
    cells: new Map(),
    threads: DEFAULT_THREADS.map((t) => ({ ...t })),
    route: { ...DEFAULT_ROUTE },
    stitch: { ...DEFAULT_STITCH },
  };
  let tool: Tool = 'v';
  let activeThread = 0;
  let showPaths = true;
  let image: { url: string; w: number; h: number; px: Pixels } | null = null;
  let imageOpacity = 0;
  /** Le misure del ricamo chieste (mm): la griglia se ne ricava. */
  let target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
  /** Vero finché il disegno è quello uscito dall'immagine: cambiando le misure si rifà. */
  let fromImage = false;
  let result: RouteResult | null = null;
  let sourceName = '';
  const undo: Array<{ grid: GridSpec; cells: Cells }> = [];

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  // ---- disegno dell'anteprima -------------------------------------------------
  const margin = () => Math.max(2, Math.min(st.grid.cellW, st.grid.cellH));
  const sizeMm = () => ({ w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) });
  const f = (n: number) => Number(n.toFixed(3));

  function svgMarkup(): string {
    const g = st.grid;
    const { w, h } = sizeMm();
    const m = margin();
    const pitch = rowPitch(g);
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${f(w + 2 * m)}mm" height="${f(h + 2 * m)}mm" viewBox="${f(-m)} ${f(-m)} ${f(w + 2 * m)} ${f(h + 2 * m)}">`);
    parts.push(`<rect x="0" y="0" width="${f(w)}" height="${f(h)}" style="fill:var(--rg-color-white)"/>`);
    if (image) parts.push(`<image href="${image.url}" x="0" y="0" width="${f(w)}" height="${f(h)}" preserveAspectRatio="none" opacity="${imageOpacity}"/>`);
    // la griglia: un pattern per le celle, una riga più scura ogni 10
    parts.push(`<defs><pattern id="cs-cell" width="${f(g.cellW)}" height="${f(pitch)}" patternUnits="userSpaceOnUse"><path d="M ${f(g.cellW)} 0 L 0 0 0 ${f(pitch)}" fill="none" style="stroke:var(--rg-color-neutral-200)" stroke-width="0.6" vector-effect="non-scaling-stroke"/></pattern>`
      + `<pattern id="cs-major" width="${f(g.cellW * 10)}" height="${f(pitch * 10)}" patternUnits="userSpaceOnUse"><path d="M ${f(g.cellW * 10)} 0 L 0 0 0 ${f(pitch * 10)}" fill="none" style="stroke:var(--rg-color-neutral-400)" stroke-width="0.8" vector-effect="non-scaling-stroke"/></pattern></defs>`);
    parts.push(`<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="url(#cs-cell)"/>`);
    parts.push(`<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="url(#cs-major)" style="stroke:var(--rg-color-neutral-600)" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
    // i punti, colore per colore nell'ordine degli aghi; nella croce la gamba sopra per seconda
    const sw = f(Math.min(g.cellW, g.cellH) * 0.13);
    const byColor = new Map<number, string[]>();
    for (const [k, mark] of st.cells) {
      const r = Math.floor(k / g.cols), c = k - r * g.cols;
      const list = byColor.get(mark.color) ?? [];
      for (const leg of legsOf(mark.stitch, st.route.topLeg)) {
        const { a, b } = legEnds(g, r, c, leg);
        const pa = pointInRow(g, a, r), pb = pointInRow(g, b, r);
        list.push(`M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`);
      }
      byColor.set(mark.color, list);
    }
    [...byColor.keys()].sort((x, y) => x - y).forEach((ci) => {
      const hex = st.threads[ci]?.hex ?? '#000000';
      parts.push(`<path d="${byColor.get(ci)!.join('')}" stroke="${hex}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`);
    });
    // i passaggi
    if (showPaths && result) {
      const paths: Record<string, string[]> = { visible: [], retrace: [], hidden: [], jump: [] };
      for (const cr of result.colors) {
        for (const s of cr.segs) {
          if (s.kind === 'stitch') continue;
          const [pa, pb] = segmentPoints(g, s.from, s.to);
          paths[s.kind].push(`M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`);
        }
      }
      for (const kind of ['jump', 'hidden', 'retrace', 'visible'] as const) {
        if (paths[kind].length) parts.push(`<path d="${paths[kind].join('')}" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" style="${SEG_STYLE[kind]}"/>`);
      }
      // dove parte ogni filo
      for (const cr of result.colors) {
        const first = cr.segs[0];
        if (!first) continue;
        const p = segmentPoints(g, first.from, first.to)[0];
        parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(Math.min(g.cellW, g.cellH) * 0.18)}" fill="${st.threads[cr.color]?.hex ?? '#000000'}" style="stroke:var(--rg-color-white)" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
      }
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function recompute(): void {
    try {
      result = routeCells(st.grid, st.cells, st.route);
    } catch (e) {
      result = null;
      $('status').textContent = 'Errore nei passaggi: ' + (e as Error).message;
      console.error(e);
    }
  }

  function draw(): void {
    $('layer').innerHTML = svgMarkup();
    const { w, h } = sizeMm();
    $('formatInfo').textContent = `Griglia: ${st.grid.cols} colonne (${Math.floor(st.grid.cols / 2)} V) × ${st.grid.rows} righe · il ricamo esce ${f(w)} × ${f(h)} mm (le celle sono intere)`;
    if (!result) return;
    const m = result.metrics;
    if (!m.legs) { $('status').textContent = 'Griglia vuota: disegna con il clic.'; return; }
    const mm = (x: number) => `${Math.round(x)} mm`;
    $('status').textContent = `${m.legs} diagonali · passaggi in vista ${mm(m.visibleMm)} · ripassi ${mm(m.retraceMm)} · nascosti ${mm(m.hiddenMm)} · ${m.jumps} salt${m.jumps === 1 ? 'o' : 'i'}`;
  }

  function autosave(): void {
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectMetadata())); } catch { /* niente spazio: pazienza */ }
  }

  /** Ricalcola e ridisegna; `save` = salva anche in automatico. */
  function update(save = true): void {
    recompute();
    draw();
    if (save) autosave();
  }

  // ---- campi ------------------------------------------------------------------
  function syncFields(): void {
    num('sizeW').value = String(f(target.w));
    num('sizeH').value = String(f(target.h));
    num('cellW').value = String(st.grid.cellW);
    num('cellH').value = String(st.grid.cellH);
    num('overlap').value = String(st.grid.overlapPct ?? 0);
    num('reps').value = String(st.route.repetitions);
    num('jumpMm').value = String(st.route.jumpMm);
    num('maxStitch').value = String(st.stitch.maxStitchMm);
    num('travelStitch').value = String(st.stitch.travelStitchMm);
    $<HTMLInputElement>('fixedDir').checked = st.route.fixedDirection;
    syncSegmented();
  }

  function syncSegmented(): void {
    root.querySelectorAll<HTMLButtonElement>('#toolSel .rg-segmented__item').forEach((b) => {
      const on = b.dataset.tool === tool;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    root.querySelectorAll<HTMLButtonElement>('#topLegSel .rg-segmented__item').forEach((b) => {
      const on = b.dataset.leg === st.route.topLeg;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('toolHelp').textContent = TOOL_HELP[tool];
  }

  const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

  /** Con l'immagine e la proporzione bloccata, l'altezza del ricamo segue la larghezza. */
  function ratioHeight(w: number): number {
    return image && $<HTMLInputElement>('keepRatio').checked ? (w * image.h) / image.w : target.h;
  }

  /**
   * Le misure comandano la griglia (Lorenzo, 2026-09-24): larghezza e altezza del ricamo, cella e
   * sormonto → colonne e righe. Se il disegno è ancora quello uscito dall'immagine, si rifà sulla
   * griglia nuova; se l'hai ritoccato a mano, si tiene com'è e si taglia/allarga.
   */
  function onSizeChange(ev?: Event): void {
    const id = (ev?.target as HTMLElement | undefined)?.id;
    const w = Math.max(1, Number(num('sizeW').value) || target.w);
    let h = Math.max(1, Number(num('sizeH').value) || target.h);
    if (id !== 'sizeH') h = ratioHeight(w);
    else if (image) $<HTMLInputElement>('keepRatio').checked = false; // l'altezza scritta a mano sblocca la proporzione
    target = { w, h };
    const next = gridForSize(w, h, Number(num('cellW').value) || st.grid.cellW, Number(num('cellH').value) || st.grid.cellH, Number(num('overlap').value) || 0);
    pushUndo();
    if (image && fromImage) st.cells = knitFromImage(next, image.px, threadRgb());
    else st.cells = resizeCells(st.grid, next, st.cells);
    st.grid = next;
    syncFields();
    update();
  }
  for (const id of ['sizeW', 'sizeH', 'cellW', 'cellH', 'overlap']) num(id).addEventListener('change', onSizeChange);
  $<HTMLInputElement>('keepRatio').addEventListener('change', () => { if ($<HTMLInputElement>('keepRatio').checked) onSizeChange(); });

  num('reps').addEventListener('change', () => { st.route.repetitions = clampInt(Number(num('reps').value) || 1, 1, 8); syncFields(); update(); });
  num('jumpMm').addEventListener('change', () => { st.route.jumpMm = Math.max(0, Number(num('jumpMm').value) || 0); syncFields(); update(); });
  num('maxStitch').addEventListener('change', () => { st.stitch.maxStitchMm = Math.min(12, Math.max(1, Number(num('maxStitch').value) || DEFAULT_STITCH.maxStitchMm)); syncFields(); autosave(); });
  num('travelStitch').addEventListener('change', () => { st.stitch.travelStitchMm = Math.min(12, Math.max(0.5, Number(num('travelStitch').value) || DEFAULT_STITCH.travelStitchMm)); syncFields(); autosave(); });
  $<HTMLInputElement>('fixedDir').addEventListener('change', (e) => { st.route.fixedDirection = (e.target as HTMLInputElement).checked; update(); });
  $<HTMLInputElement>('showPaths').addEventListener('change', (e) => { showPaths = (e.target as HTMLInputElement).checked; draw(); });

  root.querySelectorAll<HTMLButtonElement>('#toolSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool as Tool;
    syncSegmented();
  }));
  root.querySelectorAll<HTMLButtonElement>('#topLegSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    st.route.topLeg = b.dataset.leg as Leg;
    syncSegmented();
    update();
  }));

  // ---- fili -------------------------------------------------------------------
  const asHex6 = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#1a1a1a');

  function buildThreads(): void {
    const host = $('threads');
    host.innerHTML = '';
    const used = new Map<number, number>();
    for (const m of st.cells.values()) used.set(m.color, (used.get(m.color) ?? 0) + 1);
    st.threads.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'rg-color-map__row cs-thread' + (i === activeThread ? ' cs-thread--active' : '');
      li.setAttribute('aria-current', i === activeThread ? 'true' : 'false');
      li.addEventListener('click', () => { activeThread = i; buildThreads(); });

      const sw = document.createElement('label');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', t.hex);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'rg-u-visually-hidden';
      picker.value = asHex6(t.hex);
      picker.setAttribute('aria-label', `Colore del filo ${i + 1}`);
      picker.addEventListener('input', () => {
        t.hex = picker.value;
        sw.style.setProperty('--swatch', t.hex);
        code.firstChild!.textContent = t.hex.toUpperCase() + ' ';
        draw();
      });
      picker.addEventListener('change', autosave);
      sw.appendChild(picker);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.append(document.createTextNode(t.hex.toUpperCase() + ' '));
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = `ago ${i + 1} · ${used.get(i) ?? 0} celle`;
      code.appendChild(meta);

      const aside = document.createElement('span');
      aside.className = 'rg-color-map__aside rg-cluster';
      if (i > 0) {
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'rg-button rg-button--ghost rg-button--small';
        up.textContent = '↑';
        up.title = 'Cuci prima questo filo';
        up.setAttribute('aria-label', `Sposta il filo ${i + 1} prima`);
        up.addEventListener('click', (e) => { e.stopPropagation(); swapThreads(i - 1, i); });
        aside.appendChild(up);
      }
      if (st.threads.length > 1) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'rg-button rg-button--ghost rg-button--small';
        del.textContent = '×';
        del.title = 'Togli il filo (le sue celle si svuotano)';
        del.setAttribute('aria-label', `Togli il filo ${i + 1}`);
        del.addEventListener('click', (e) => { e.stopPropagation(); removeThread(i); });
        aside.appendChild(del);
      }
      li.append(sw, code, aside);
      host.appendChild(li);
    });
  }

  /** Scambia due aghi: cambia l'ordine di cucitura, non il disegno. */
  function swapThreads(a: number, b: number): void {
    [st.threads[a], st.threads[b]] = [st.threads[b], st.threads[a]];
    for (const m of st.cells.values()) m.color = m.color === a ? b : m.color === b ? a : m.color;
    if (activeThread === a) activeThread = b; else if (activeThread === b) activeThread = a;
    buildThreads();
    update();
  }

  function removeThread(i: number): void {
    pushUndo();
    st.threads.splice(i, 1);
    for (const [k, m] of [...st.cells]) {
      if (m.color === i) st.cells.delete(k);
      else if (m.color > i) m.color--;
    }
    activeThread = Math.min(activeThread, st.threads.length - 1);
    buildThreads();
    update();
  }

  $('addThread').addEventListener('click', () => {
    const palette = ['#2b6cb0', '#2f855a', '#b7791f', '#6b46c1', '#c05621', '#1a1a1a'];
    st.threads.push({ hex: palette[(st.threads.length - 2 + palette.length) % palette.length] });
    activeThread = st.threads.length - 1;
    buildThreads();
    autosave();
  });

  // ---- annulla ----------------------------------------------------------------
  function cloneCells(c: Cells): Cells { return new Map([...c].map(([k, m]) => [k, { ...m }])); }
  function pushUndo(): void {
    undo.push({ grid: { ...st.grid }, cells: cloneCells(st.cells) });
    if (undo.length > 100) undo.shift();
  }
  function doUndo(): void {
    const prev = undo.pop();
    if (!prev) return;
    st.grid = prev.grid;
    st.cells = prev.cells;
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    update();
  }
  $('undoBtn').addEventListener('click', doUndo);
  $('clearBtn').addEventListener('click', () => {
    if (!st.cells.size) return;
    pushUndo();
    st.cells.clear();
    buildThreads();
    update();
  });

  // ---- il disegno col mouse ---------------------------------------------------
  const canvas = $('canvas');
  let spaceDown = false;
  let painting: { button: Button; erase: boolean; last: number; lastCell: { r: number; c: number } | null; changed: boolean } | null = null;

  /** La cella sotto il puntatore, o null se fuori griglia. */
  function cellAt(e: PointerEvent): { r: number; c: number } | null {
    const svg = $('layer').querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const { w, h } = sizeMm();
    const m = margin();
    const x = -m + ((e.clientX - rect.left) / rect.width) * (w + 2 * m);
    const y = -m + ((e.clientY - rect.top) / rect.height) * (h + 2 * m);
    // col sormonto le righe si sovrappongono: vince quella che parte più in basso (è cucita sopra)
    const c = Math.floor(x / st.grid.cellW), r = Math.min(st.grid.rows - 1, Math.floor(y / rowPitch(st.grid)));
    if (y < 0 || y > h) return null;
    if (r < 0 || c < 0 || r >= st.grid.rows || c >= st.grid.cols) return null;
    return { r, c };
  }

  /** Mette il punto in una cella durante il gesto; vero se ha cambiato qualcosa. */
  function paintCell(r: number, c: number): boolean {
    if (!painting) return false;
    const k = cellIndex(st.grid, r, c);
    if (k === painting.last) return false;
    // Con la V si trascina a passo di due celle, così le V si mettono una accanto all'altra.
    if (tool === 'v' && !painting.erase && painting.last >= 0) {
      const lr = Math.floor(painting.last / st.grid.cols), lc = painting.last - lr * st.grid.cols;
      if (lr === r && Math.abs(lc - c) < 2) return false;
    }
    painting.last = k;
    return applyEdits(st.grid, st.cells, editsFor(st.grid, tool, painting.button, r, c, activeThread, painting.erase));
  }

  function paintAt(e: PointerEvent): void {
    if (!painting) return;
    const at = cellAt(e);
    if (!at) return;
    // Il mouse veloce salta delle celle fra un evento e l'altro: si riempiono tutte quelle sulla
    // linea dall'ultima cella, altrimenti un tratto trascinato esce a buchi.
    const from = painting.lastCell ?? at;
    const n = Math.max(Math.abs(at.r - from.r), Math.abs(at.c - from.c));
    let changed = false;
    for (let s = n === 0 ? 0 : 1; s <= n; s++) {
      const r = Math.round(from.r + ((at.r - from.r) * s) / Math.max(1, n));
      const c = Math.round(from.c + ((at.c - from.c) * s) / Math.max(1, n));
      if (paintCell(r, c)) changed = true;
    }
    painting.lastCell = at;
    if (changed) {
      painting.changed = true;
      fromImage = false; // ritoccato a mano: cambiando le misure non si rifà più dall'immagine
      update(false);
    }
  }

  // In cattura: il gesto di disegno è nostro, il pan/zoom non lo deve nemmeno vedere. Restano al
  // pan il tasto centrale e lo spazio + trascina.
  canvas.addEventListener('pointerdown', (e) => {
    if (spaceDown || (e.button !== 0 && e.button !== 2)) return;
    if (!cellAt(e)) return;
    e.stopPropagation(); e.preventDefault();
    pushUndo();
    painting = { button: e.button === 2 ? 'right' : 'left', erase: e.shiftKey, last: -1, lastCell: null, changed: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    paintAt(e);
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (!painting) return;
    e.stopPropagation();
    paintAt(e);
  }, true);
  const endPaint = (e: PointerEvent) => {
    if (!painting) return;
    e.stopPropagation();
    if (!painting.changed) undo.pop();
    else { buildThreads(); autosave(); }
    painting = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  canvas.addEventListener('pointerup', endPaint, true);
  canvas.addEventListener('pointercancel', endPaint, true);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!root.isConnected) { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); return; }
    if (isTyping(e.target)) return;
    if (e.code === 'Space') { spaceDown = true; canvas.classList.add('cs-pan'); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') { spaceDown = false; canvas.classList.remove('cs-pan'); }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ---- immagine di riferimento -----------------------------------------------
  $<HTMLInputElement>('imageInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => {
        // i pixel, ridotti: per il colore medio di una V bastano e avanzano
        const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
        const cnv = document.createElement('canvas');
        cnv.width = Math.max(1, Math.round(img.naturalWidth * scale));
        cnv.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = cnv.getContext('2d')!;
        ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
        const data = ctx.getImageData(0, 0, cnv.width, cnv.height);
        image = { url, w: img.naturalWidth, h: img.naturalHeight, px: { rgba: data.data, width: cnv.width, height: cnv.height } };
        // L'altezza del ricamo prende le proporzioni dell'immagine, la griglia si ricalcola e la
        // maglia si crea subito: poi si regolano le misure.
        $<HTMLInputElement>('keepRatio').checked = true;
        target = { w: target.w, h: ratioHeight(target.w) };
        st.grid = gridForSize(target.w, target.h, st.grid.cellW, st.grid.cellH, st.grid.overlapPct ?? 0);
        syncFields();
        knitNow();
        $('imageStatus').textContent = `${file.name}: ${img.naturalWidth}×${img.naturalHeight} px.`;
        requestAnimationFrame(() => pz.fit());
      };
      img.onerror = () => { $('imageStatus').textContent = `${file.name}: immagine non leggibile.`; };
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
  num('imageOpacity').addEventListener('change', () => {
    imageOpacity = Math.min(100, Math.max(0, Number(num('imageOpacity').value) || 0)) / 100;
    draw();
  });
  /** I fili attuali in RGB, per assegnare le V. */
  function threadRgb(): Array<[number, number, number]> {
    return st.threads.map((t) => {
      const h = asHex6(t.hex);
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    });
  }

  /** La maglia dall'immagine: i colori dei fili dall'immagine (chiaro prima), poi una V per cella. */
  function knitNow(): void {
    if (!image) { $('imageStatus').textContent = 'Carica prima un’immagine.'; return; }
    const luma = (c: [number, number, number]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const pal = medianCutPalette(image.px.rgba, null, st.threads.length).sort((a, b) => luma(b) - luma(a));
    if (!pal.length) return;
    pushUndo();
    st.threads = pal.map((c) => ({ hex: rgbToHex(c) }));
    st.cells = knitFromImage(st.grid, image.px, pal);
    fromImage = true;
    buildThreads();
    update();
  }
  $('knitBtn').addEventListener('click', knitNow);
  $('removeImageBtn').addEventListener('click', () => { image = null; fromImage = false; $('imageStatus').textContent = 'Nessuna immagine.'; draw(); });

  // ---- progetto: riapertura (R27) ---------------------------------------------
  function projectMetadata(): Record<string, unknown> {
    return {
      rgProject: 'cross-stitch',
      version: VERSION,
      grid: st.grid,
      threads: st.threads,
      route: st.route,
      stitch: st.stitch,
      cells: cellsToJson(st.grid, st.cells),
    };
  }

  function applyProject(meta: Record<string, unknown>): boolean {
    if (meta.rgProject !== 'cross-stitch') return false;
    const g = meta.grid as Partial<GridSpec> | undefined;
    if (g && g.cols && g.rows && g.cellW && g.cellH) st.grid = { cols: clampInt(g.cols, 1, 1000), rows: clampInt(g.rows, 1, 1000), cellW: g.cellW, cellH: g.cellH, overlapPct: Math.min(90, Math.max(0, Number(g.overlapPct) || 0)) };
    if (Array.isArray(meta.threads) && meta.threads.length) st.threads = (meta.threads as Thread[]).map((t) => ({ hex: asHex6(String(t.hex)) }));
    if (meta.route && typeof meta.route === 'object') st.route = { ...DEFAULT_ROUTE, ...(meta.route as Partial<RouteParams>) };
    if (meta.stitch && typeof meta.stitch === 'object') st.stitch = { ...DEFAULT_STITCH, ...(meta.stitch as Partial<StitchParams>) };
    st.cells = cellsFromJson(st.grid, meta.cells);
    for (const m of st.cells.values()) if (m.color >= st.threads.length) m.color = 0;
    activeThread = 0;
    return true;
  }

  function afterLoad(): void {
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    update();
    requestAnimationFrame(() => pz.fit());
  }

  $<HTMLInputElement>('projectInput').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const isDst = /\.dst$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        pushUndo();
        let ok = false;
        if (isDst) {
          const meta = readDstMetadata(new Uint8Array(reader.result as ArrayBuffer));
          ok = !!meta && applyProject(meta);
        } else if (/\.json$/i.test(file.name)) {
          const old = fromThreadRoute(JSON.parse(String(reader.result)));
          if (old) {
            st.grid = old.grid; st.cells = old.cells; st.route.repetitions = old.repetitions;
            ok = true;
          }
        } else {
          const meta = readProjectMetadata(String(reader.result));
          ok = !!meta && applyProject(meta);
        }
        if (!ok) {
          undo.pop();
          $('projectStatus').textContent = `${file.name}: non è un progetto Cross-Stitch.`;
          return;
        }
        sourceName = file.name.replace(/\.[^.]+$/, '').replace(/-cross-stitch$/, '');
        $('projectStatus').textContent = `${file.name}: progetto aperto (${st.cells.size} celle).`;
        afterLoad();
      } catch (e) {
        undo.pop();
        $('projectStatus').textContent = 'Errore apertura: ' + (e as Error).message;
        console.error(e);
      }
    };
    if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  });

  // ---- esportazione -----------------------------------------------------------
  function exportLayers(): ExportLayer[] {
    const res = routeCells(st.grid, st.cells, st.route);
    const sw = Math.min(st.grid.cellW, st.grid.cellH) * 0.13;
    return res.colors.map((cr) => ({
      id: `filo-${cr.color + 1}`,
      color: st.threads[cr.color]?.hex ?? '#000000',
      polylines: colorPolylines(st.grid, cr, st.stitch),
      strokeMm: sw,
    }));
  }

  $('exportBtn').addEventListener('click', async () => {
    const layers = exportLayers();
    if (!layers.length) { $('status').textContent = 'Niente da esportare: la griglia è vuota.'; return; }
    const { w, h } = sizeMm();
    const svg = buildSvg(layers, { bounds: { minX: 0, minY: 0, maxX: w, maxY: h }, marginMm: 5, metadata: projectMetadata() });
    const name = `${sourceName || 'cross-stitch'}-cross-stitch.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, mime: 'image/svg+xml', extension: '.svg', description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  $('exportDstBtn').addEventListener('click', async () => {
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(exportLayers(), {
        label: (sourceName || 'CROSS-STITCH').toUpperCase().slice(0, 16),
        metadata: projectMetadata(),
      });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${sourceName || 'cross-stitch'}-cross-stitch.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  $('fitBtn').addEventListener('click', () => pz.fit());

  // ---- avvio: l'ultimo lavoro, o una riga di V di esempio ---------------------
  let restored = false;
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) restored = applyProject(JSON.parse(saved));
  } catch { /* autosave illeggibile: si riparte puliti */ }
  if (!restored) {
    const r = 3;
    for (let c = 2; c < 20; c += 2) applyEdits(st.grid, st.cells, editsFor(st.grid, 'v', 'left', r, c, 0));
    for (let c = 2; c < 20; c += 2) applyEdits(st.grid, st.cells, editsFor(st.grid, 'v', 'right', r + 1, c, 1));
  }
  afterLoad();
}

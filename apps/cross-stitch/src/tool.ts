import '@rg/ui/rg.css';
import './cross-stitch.css';
import {
  type ExportLayer,
  buildSvg, dstFromExportLayers, DST_FILE, readProjectMetadata, readDstMetadata, medianCutPalette, rgbToHex,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import ICONS from '../../../packages/design-system/icons/rg-icons.svg?url';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  type Button, type Cells, type GridSpec, type Leg, type Stitch, type Thread, type Tool,
  type Pixels, type BrushStitch, type KnitStitch, DEFAULT_GRID, applyEdits, brushArea, brushEdits, fillEdits, knitFromImage, gridForSize, refinePalette, paletteShares, DEFAULT_KNIT, cellIndex, cellsFromJson, cellsToJson, editsFor, fromThreadRoute, fromTwoColumnV, stitchLegs,
  resizeCells, pointInRow, segmentPoints, rowPitch, gridHeight,
} from './model';
import {
  type RouteParams, type RouteResult, type SegKind, type StitchParams,
  DEFAULT_ROUTE, DEFAULT_STITCH, colorPolylines, routeCells,
} from './routing';
import { DEFAULT_ZONES, type ZoneGroup } from './zones';

// 0.4.0: un punto per colonna (la V dentro la sua cella). I progetti di prima si convertono.
const VERSION = '0.4.0';
/**
 * Il vecchio salvataggio automatico. Tolto su richiesta di Lorenzo (2026-09-24): «cancella sempre
 * tutto» a ogni aggiornamento della pagina; per riprendere un lavoro si ricarica il DST o l'SVG
 * esportato (sezione 06). La chiave serve solo a cancellare quello che era rimasto nel browser.
 */
const OLD_AUTOSAVE_KEY = 'rg-cross-stitch-autosave';

/** I fili di partenza: l'ordine è l'ordine degli aghi. */
const DEFAULT_THREADS: Thread[] = [{ hex: '#1a1a1a' }, { hex: '#b3261e' }];

/** Gli strumenti della barra di modifica. */
type Mode = 'pan' | 'paint' | 'fill' | 'erase' | 'group';

const MODE_HELP: Record<Mode, string> = {
  pan: 'Sposta: trascina per muovere la vista, rotella per ingrandire. Il ricamo non si tocca.',
  paint: 'Pennello: trascina per passare le V al filo scelto. Sulle celle vuote mette il punto scelto qui a fianco (V, croce, diagonale). Maiuscolo + trascina cancella.',
  fill: 'Riempi: un clic passa al filo scelto tutta la zona collegata dello stesso colore — per esempio l’interno di una lettera.',
  erase: 'Gomma: trascina per cancellare; lì non si cuce niente.',
  group: 'Gruppi: trascina un rettangolo attorno a una parte (per esempio un titolo): il filo di ogni colore la cuce tutta insieme. Si tolgono in 04 Passaggi.',
};

/** Come si disegna ogni tipo di passaggio nell'anteprima (colori dai token del DS). */
const SEG_STYLE: Record<Exclude<SegKind, 'stitch'>, string> = {
  visible: 'stroke:var(--rg-color-danger);stroke-width:2',
  retrace: 'stroke:var(--rg-color-warning);stroke-width:2',
  vertical: 'stroke:var(--rg-color-info);stroke-width:2',
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
      <!-- La testa (01-03) resta sempre aperta; corpo (04-05) e coda (06) si richiudono e si ricordano. -->
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="imageInput" accept="image/*" />
              <span class="rg-button rg-button--primary">Carica immagine…</span>
            </label>
            <p class="rg-file-input__status" id="imageStatus" role="status">Nessuna immagine: la maglia si crea appena la carichi.</p>
          </div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lbl-kstitch">Punto</span>
            <div class="rg-segmented" id="knitStitchSel" role="group" aria-labelledby="lbl-kstitch">
              <button type="button" class="rg-segmented__item" data-kstitch="v">V</button>
              <button type="button" class="rg-segmented__item" data-kstitch="lambda">Λ</button>
              <button type="button" class="rg-segmented__item" data-kstitch="cross">Croce</button>
              <button type="button" class="rg-segmented__item" data-kstitch="down" aria-label="Diagonale discendente">«\\»</button>
              <button type="button" class="rg-segmented__item" data-kstitch="up" aria-label="Diagonale ascendente">«/»</button>
            </div>
          </div>
          <label class="rg-field"><span class="rg-field__label">Soglia del dettaglio</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="detailPct" type="text" inputmode="numeric" aria-describedby="h-soglia"><span>%</span></span>
            <span class="rg-field__help" id="h-soglia">Più bassa salva i tratti sottili</span></label>
          <div class="rg-cluster rg-param-grid__wide">
            <span class="rg-tooltip"><button type="button" id="cropBtn" class="rg-button rg-button--outline rg-button--small" aria-pressed="false" aria-describedby="tip-crop">Ritaglia</button><span class="rg-tooltip__text" role="tooltip" id="tip-crop">Trascina un rettangolo sul disegno: la maglia si rifà su quel pezzo</span></span>
            <button type="button" id="uncropBtn" class="rg-button rg-button--ghost rg-button--small">Immagine intera</button>
            <button type="button" id="removeImageBtn" class="rg-button rg-button--ghost rg-button--small">Togli</button>
          </div>
          <details class="rg-disclosure rg-param-grid__wide">
            <summary class="rg-disclosure__trigger">Altro</summary>
            <div class="rg-disclosure__content rg-param-grid">
              <label class="rg-field"><span class="rg-field__label">Opacità sotto la griglia</span>
                <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="imageOpacity" type="text" inputmode="numeric" value="0"><span>%</span></span></label>
              <div class="rg-cluster rg-param-grid__wide">
                <span class="rg-tooltip"><button type="button" id="knitBtn" class="rg-button rg-button--outline rg-button--small" aria-describedby="tip-knit">Rifai la maglia dall’immagine</button><span class="rg-tooltip__text" role="tooltip" id="tip-knit">Rilegge l’immagine e ricalcola i colori dei fili: i ritocchi a mano si perdono</span></span>
              </div>
            </div>
          </details>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Misure del ricamo</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Larghezza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sizeW" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Altezza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sizeH" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="keepRatio" checked><span class="rg-toggle__track"></span><span>Altezza in proporzione all’immagine</span>
          </label>
          <label class="rg-field"><span class="rg-field__label">Larghezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="cellW" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Altezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="cellH" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Sormonto righe</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="overlap" type="text" inputmode="numeric" aria-describedby="h-sorm"><span>%</span></span>
            <span class="rg-field__help" id="h-sorm">Solo in verticale: le V si infilano</span></label>
          <output class="rg-technical rg-param-grid__wide" id="formatInfo" aria-live="polite"></output>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Fili</h3></div>
        <ul class="rg-color-map" id="threads"></ul>
        <div class="rg-param-grid">
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" id="addThread" class="rg-button rg-button--outline rg-button--small"><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-aggiungi"></use></svg>Aggiungi filo</button>
          </div>
          <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Filo di base</span>
            <select class="rg-select" id="baseSel" aria-describedby="h-base"></select>
            <span class="rg-field__help" id="h-base">Riempie tutta la griglia, sotto al disegno</span></label>
          <div class="rg-field rg-param-grid__wide" id="baseBox" hidden>
            <span class="rg-field__label" id="baseLabel">Punto della base</span>
            <div class="rg-segmented" id="baseStitchSel" role="group" aria-labelledby="baseLabel">
              <button type="button" class="rg-segmented__item" data-bstitch="v">V</button>
              <button type="button" class="rg-segmented__item" data-bstitch="lambda">Λ</button>
              <button type="button" class="rg-segmented__item" data-bstitch="cross">Croce</button>
              <button type="button" class="rg-segmented__item" data-bstitch="down" aria-label="Diagonale discendente">«\\»</button>
              <button type="button" class="rg-segmented__item" data-bstitch="up" aria-label="Diagonale ascendente">«/»</button>
            </div>
          </div>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" id="sec-passaggi" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Passaggi</span></summary>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lbl-order">Le passate</span>
            <div class="rg-segmented" id="passOrderSel" role="group" aria-labelledby="lbl-order">
              <button type="button" class="rg-segmented__item" data-order="stitch">Tutte sulla stessa V</button>
              <button type="button" class="rg-segmented__item" data-order="row">Lungo la riga</button>
            </div>
            <span class="rg-field__help">Sulla stessa V con passate dispari, lungo la riga con pari</span>
          </div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lbl-top">Gamba sopra nella croce</span>
            <div class="rg-segmented" id="topLegSel" role="group" aria-labelledby="lbl-top">
              <button type="button" class="rg-segmented__item" data-leg="down">«\\»</button>
              <button type="button" class="rg-segmented__item" data-leg="up">«/»</button>
            </div>
          </div>
          <label class="rg-field"><span class="rg-field__label">Salta oltre</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="jumpMm" type="text" inputmode="numeric" aria-describedby="h-jump"><span>mm</span></span>
            <span class="rg-field__help" id="h-jump">Oltre, salto con taglio</span></label>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="byBlocks" checked aria-describedby="h-blocks"><span class="rg-toggle__track"></span><span>Per blocchi di colore</span>
          </label>
          <span class="rg-field__help rg-param-grid__wide" id="h-blocks">Finisce ogni zona di un colore prima di passare alla successiva</span>
          <label class="rg-field"><span class="rg-field__label">Vuoto che separa</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="zoneGap" type="text" inputmode="decimal" aria-describedby="h-zoneGap"><span>mm</span></span>
            <span class="rg-field__help" id="h-zoneGap">Più alto, zone più grandi</span></label>
          <label class="rg-field"><span class="rg-field__label">Zona massima</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="zoneMax" type="text" inputmode="decimal" aria-describedby="h-zoneMax"><span>mm</span></span>
            <span class="rg-field__help" id="h-zoneMax">Oltre, la zona si divide</span></label>
          <div class="rg-field rg-param-grid__wide cs-groups" id="groupsBox">
            <span class="rg-field__label">Gruppi</span>
            <ul class="rg-list" id="groupList" aria-label="Gruppi"></ul>
            <div class="rg-empty" id="groupEmpty">Nessun gruppo. Scegli «Gruppi» nella barra e trascina un rettangolo sul disegno: quella parte si cuce tutta insieme.</div>
            <button type="button" class="rg-button rg-button--small rg-button--ghost rg-button--danger" id="groupClear"><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-elimina"></use></svg>Togli tutti</button>
          </div>
          <label class="rg-toggle rg-param-grid__wide">
            <input type="checkbox" id="fixedDir"><span class="rg-toggle__track"></span><span>Direzione fissa («\\» dall’alto, «/» dal basso)</span>
          </label>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" id="sec-macchina">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Macchina</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Punto massimo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxStitch" type="text" inputmode="decimal" aria-describedby="h-max"><span>mm</span></span>
            <span class="rg-field__help" id="h-max">Oltre, la diagonale si spezza</span></label>
          <label class="rg-field"><span class="rg-field__label">Punto dei passaggi</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="travelStitch" type="text" inputmode="decimal"><span>mm</span></span></label>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" id="sec-carica">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Carica parametri</span></summary>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="projectInput" accept=".dst,.svg,.json" />
              <span class="rg-button rg-button--outline">Carica DST o SVG…</span>
            </label>
            <p class="rg-file-input__status" id="projectStatus" role="status">Un file esportato da qui rimette valori e disegno.</p>
          </div>
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
      <div class="rg-toolbar cs-editbar" role="group" aria-label="Modifica del disegno">
        <div class="rg-cluster">
          <div class="rg-segmented" id="modeSel" role="group" aria-label="Strumento">
            <button type="button" class="rg-segmented__item" data-mode="pan" title="Sposta (H)">Sposta</button>
            <button type="button" class="rg-segmented__item" data-mode="paint" title="Pennello (B)">Pennello</button>
            <button type="button" class="rg-segmented__item" data-mode="fill" title="Riempi (F)">Riempi</button>
            <button type="button" class="rg-segmented__item" data-mode="erase" title="Gomma (E)">Gomma</button>
            <button type="button" class="rg-segmented__item" data-mode="group" title="Gruppi (G)">Gruppi</button>
          </div>
          <div class="cs-editbar__group" role="group" aria-labelledby="eb-gr"><span class="rg-label" id="eb-gr">Grandezza</span>
            <div class="rg-segmented" id="sizeSel">
              <button type="button" class="rg-segmented__item" data-size="1">1</button>
              <button type="button" class="rg-segmented__item" data-size="2">2</button>
              <button type="button" class="rg-segmented__item" data-size="4">4</button>
              <button type="button" class="rg-segmented__item" data-size="8">8</button>
            </div></div>
          <div class="cs-editbar__group" role="group" aria-labelledby="eb-pt"><span class="rg-label" id="eb-pt">Punto</span>
            <div class="rg-segmented" id="stitchSel">
              <button type="button" class="rg-segmented__item" data-stitch="v" title="V. Clic destro: Λ">V</button>
              <button type="button" class="rg-segmented__item" data-stitch="cross" title="Croce">Croce</button>
              <button type="button" class="rg-segmented__item" data-stitch="diag" title="Diagonale. Sinistro «\\», destro «/»">Diagonale</button>
            </div></div>
          <div class="cs-editbar__group" role="group" aria-labelledby="eb-fi"><span class="rg-label" id="eb-fi">Filo</span>
            <div class="rg-segmented cs-swatch-seg" id="editThreads"></div></div>
          <div class="rg-action-group">
            <button type="button" id="undoBtn" class="rg-button rg-button--ghost rg-button--small" title="Annulla (Ctrl+Z)">Annulla</button>
            <button type="button" id="redoBtn" class="rg-button rg-button--ghost rg-button--small" title="Rifai (Ctrl+Y)">Rifai</button>
          </div>
          <div class="rg-action-group"><button type="button" id="clearBtn" class="rg-button rg-button--ghost rg-button--small">Svuota</button></div>
        </div>
        <div class="cs-editbar__group" role="group" aria-labelledby="eb-vista"><span class="rg-label" id="eb-vista">Vista</span>
          <label class="rg-toggle"><input type="checkbox" id="showGrid" checked><span class="rg-toggle__track"></span><span>Griglia</span></label>
          <label class="rg-toggle"><input type="checkbox" id="showPaths" checked><span class="rg-toggle__track"></span><span>Passaggi</span></label>
        </div>
      </div>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span class="cs-status"><span id="modeHelp" class="cs-status__help"></span><span id="status">Pronto</span></span>
        <span class="cs-legend" id="legend">
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.visible}"/></svg>in vista</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.retrace}"/></svg>ripasso</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.vertical}"/></svg>vertice-vertice</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.hidden}"/></svg>nascosto</span>
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${SEG_STYLE.jump}"/></svg>salto</span>
        </span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const num = (id: string) => $<HTMLInputElement>(id);
  /** Un numero scritto all'italiana (virgola) o col punto. NaN se non è un numero. */
  const parseNum = (v: string) => Number(String(v).trim().replace(',', '.'));
  const readNum = (id: string) => parseNum(num(id).value);
  /** Un numero da mostrare nei campi, con la virgola. */
  const fmtNum = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

  // ---- stato ------------------------------------------------------------------
  const st: State = {
    grid: { ...DEFAULT_GRID },
    cells: new Map(),
    threads: DEFAULT_THREADS.map((t) => ({ ...t })),
    route: { ...DEFAULT_ROUTE },
    stitch: { ...DEFAULT_STITCH },
  };
  let mode: Mode = 'paint';
  let brushSize = 1;
  let brushStitch: BrushStitch = 'v';
  let activeThread = 0;
  let showPaths = true;
  let showGrid = true;
  let image: { url: string; w: number; h: number; px: Pixels } | null = null;
  let imageOpacity = 0;
  /** Le misure del ricamo chieste (mm): la griglia se ne ricava. */
  let target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
  /** Vero finché il disegno è quello uscito dall'immagine: cambiando le misure si rifà. */
  let fromImage = false;
  /** Come si legge l'immagine: il punto e la soglia del dettaglio. */
  const knit = { ...DEFAULT_KNIT };
  /** L'immagine originale e il pezzo ritagliato (px dell'originale); null = tutta. */
  let source: { img: HTMLImageElement; name: string } | null = null;
  let crop: { x: number; y: number; w: number; h: number } | null = null;
  let cropping = false;
  let cropDrag: { a: { x: number; y: number }; b: { x: number; y: number } } | null = null;
  /** Il rettangolo di un gruppo che si sta tirando (modalità Gruppi). */
  let groupDrag: { a: { x: number; y: number }; b: { x: number; y: number } } | null = null;
  /** Il gruppo evidenziato dalla lista (passandoci sopra col mouse). */
  let groupHover = -1;
  let result: RouteResult | null = null;
  let sourceName = '';
  const undo: Array<{ grid: GridSpec; cells: Cells }> = [];
  const redo: Array<{ grid: GridSpec; cells: Cells }> = [];

  // Le sezioni richiudibili si ricordano (solo l'aperto/chiuso: il lavoro no, si riparte puliti).
  for (const id of ['sec-passaggi', 'sec-macchina', 'sec-carica']) {
    const d = $<HTMLDetailsElement>(id);
    const key = `rg-cross-stitch-sezione-${id}`;
    try { const v = localStorage.getItem(key); if (v !== null) d.open = v === '1'; } catch { /* niente memoria: default */ }
    d.addEventListener('toggle', () => { try { localStorage.setItem(key, d.open ? '1' : '0'); } catch { /* pazienza */ } });
  }

  /** Chiamato a ogni cambio di zoom: il canvas si ridisegna nitido quando la rotella si ferma. */
  let onZoomHook: () => void = () => { /* finché la scena non c'è */ };
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; onZoomHook(); });

  // ---- disegno dell'anteprima -------------------------------------------------
  const margin = () => Math.max(2, Math.min(st.grid.cellW, st.grid.cellH));
  const sizeMm = () => ({ w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) });
  const f = (n: number) => Number(n.toFixed(3));
  /**
   * Lo spessore del filo nell'anteprima, in mm: circa mezza cella, di più con più passate. Prima
   * era un capello (0,13 della cella): su 450 mm di giornale le lettere sembravano perse anche
   * dove c'erano, perché il filo non copriva niente.
   */
  const threadWidth = (color = 0) => Math.min(st.grid.cellW / 2, st.grid.cellH) * Math.min(0.9, 0.5 * (1 + 0.15 * (passesOf(color) - 1)));
  /** Le passate di un filo: le sue, o quelle generali dei progetti di prima. */
  const passesOf = (color: number) => Math.max(1, Math.round(st.threads[color]?.passes ?? st.route.repetitions ?? 1));
  /** I parametri del routing con le passate di ogni filo. */
  const routeParams = (): RouteParams => ({ ...st.route, passesByColor: Object.fromEntries(st.threads.map((_, i) => [i, passesOf(i)])) });

  // ---- L'anteprima --------------------------------------------------------------
  //
  // I punti, l'immagine e i passaggi si disegnano su un CANVAS; sopra c'è un SVG leggero con la
  // griglia, il pennello e il ritaglio. Prima era tutto un SVG: sul giornale Dior (450 mm) pesava
  // 2,3 MB e il browser impiegava 1,5-2 secondi solo a ridisegnarlo a ogni modifica (Lorenzo: «la
  // visualizzazione è abbastanza lenta»). Il canvas si ridisegna alla risoluzione dello zoom del
  // momento, così resta nitido quando si ingrandisce. L'export SVG/DST non passa di qui.

  /** Il colore di un token del DS, per il canvas (che le variabili CSS non le legge da solo). */
  const token = (name: string, fallback: string) => {
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  };
  const PATH_STYLE: Record<Exclude<SegKind, 'stitch'>, { color: string; width: number; dash: number[] }> = {
    visible: { color: token('--rg-color-danger', '#b3261e'), width: 2, dash: [] },
    retrace: { color: token('--rg-color-warning', '#b7791f'), width: 2, dash: [] },
    vertical: { color: token('--rg-color-info', '#2b6cb0'), width: 2, dash: [] },
    hidden: { color: token('--rg-color-neutral-600', '#555555'), width: 1, dash: [3, 2] },
    jump: { color: token('--rg-color-neutral-400', '#999999'), width: 1, dash: [1, 3] },
  };
  const BG = token('--rg-color-neutral-200', '#e6e6e6');

  let imageEl: HTMLImageElement | null = null;   // l'immagine di riferimento, pronta per il canvas
  let imageElUrl = '';
  let renderZoom = 1;                            // lo zoom a cui è stato disegnato il canvas
  let zoomTimer = 0;

  /** La scena: un contenitore con il canvas e l'SVG sopra, grande quanto il ricamo nella tela. */
  function ensureScene(): { wrap: HTMLDivElement; canvasEl: HTMLCanvasElement; overlay: SVGSVGElement } {
    const layer = $('layer');
    let wrap = layer.querySelector<HTMLDivElement>('.cs-scene');
    if (!wrap) {
      layer.innerHTML = '<div class="cs-scene"><canvas></canvas><svg xmlns="http://www.w3.org/2000/svg"></svg></div>';
      wrap = layer.querySelector<HTMLDivElement>('.cs-scene')!;
    }
    return { wrap, canvasEl: wrap.querySelector('canvas')!, overlay: wrap.querySelector('svg')! };
  }

  /** La misura della scena in px CSS: quella naturale in mm, ridotta se non entra nella tela. */
  function sceneSize(): { cssW: number; cssH: number } {
    const { w, h } = sizeMm();
    const m = margin();
    const pxPerMm = 96 / 25.4;
    const natW = (w + 2 * m) * pxPerMm, natH = (h + 2 * m) * pxPerMm;
    const box = $('layer').getBoundingClientRect();
    const z = pz?.getZoom() || 1;
    const availW = box.width / z || natW, availH = box.height / z || natH;
    const k = Math.min(1, availW / natW, availH / natH);
    return { cssW: natW * k, cssH: natH * k };
  }

  function draw(): void {
    const g = st.grid;
    const { w, h } = sizeMm();
    const m = margin();
    const { wrap, canvasEl, overlay } = ensureScene();
    const { cssW, cssH } = sceneSize();
    wrap.style.width = `${cssW}px`;
    wrap.style.height = `${cssH}px`;

    // --- il canvas, alla risoluzione dello zoom corrente (con un tetto di pixel) ---
    const dpr = window.devicePixelRatio || 1;
    const z = pz?.getZoom() || 1;
    let s = dpr * z;
    const MAX_PX = 16_000_000;
    if (cssW * s * cssH * s > MAX_PX) s = Math.sqrt(MAX_PX / (cssW * cssH));
    renderZoom = z;
    canvasEl.width = Math.max(1, Math.round(cssW * s));
    canvasEl.height = Math.max(1, Math.round(cssH * s));
    const ctx = canvasEl.getContext('2d')!;
    const k = canvasEl.width / (w + 2 * m);         // px del canvas per mm
    const X = (x: number) => (x + m) * k, Y = (y: number) => (y + m) * k;
    const screenPx = canvasEl.width / (cssW * z);  // px del canvas per px dello schermo (larghezze fisse)
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillStyle = BG;
    ctx.fillRect(X(0), Y(0), w * k, h * k);
    if (image && imageOpacity > 0) {
      if (imageElUrl !== image.url) { imageEl = new Image(); imageEl.onload = () => draw(); imageEl.src = image.url; imageElUrl = image.url; }
      if (imageEl?.complete && imageEl.naturalWidth) {
        ctx.globalAlpha = imageOpacity;
        ctx.drawImage(imageEl, X(0), Y(0), w * k, h * k);
        ctx.globalAlpha = 1;
      }
    }
    // i punti, colore per colore nell'ordine degli aghi (la base per prima); i fili spenti no
    ctx.lineCap = 'round';
    const strokeLegs = (color: number, each: (fn: (r: number, c: number, stitch: Stitch) => void) => void) => {
      if (st.threads[color]?.hidden) return;
      ctx.strokeStyle = st.threads[color]?.hex ?? '#000000';
      ctx.lineWidth = threadWidth(color) * k;
      ctx.beginPath();
      each((r, c, stitch) => {
        for (const { a, b } of stitchLegs(g, r, c, stitch, st.route.topLeg)) {
          const pa = pointInRow(g, a, r), pb = pointInRow(g, b, r);
          ctx.moveTo(X(pa.x), Y(pa.y));
          ctx.lineTo(X(pb.x), Y(pb.y));
        }
      });
      ctx.stroke();
    };
    const base = st.route.base ?? null;
    if (base) strokeLegs(base.color, (fn) => { for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) fn(r, c, base.stitch); });
    const byColor = new Map<number, number[]>();
    for (const [key, mark] of st.cells) {
      if (base && mark.color === base.color) continue; // già coperta dalla base
      const list = byColor.get(mark.color);
      if (list) list.push(key); else byColor.set(mark.color, [key]);
    }
    for (const ci of [...byColor.keys()].sort((x, y) => x - y)) {
      strokeLegs(ci, (fn) => { for (const key of byColor.get(ci)!) { const r = Math.floor(key / g.cols); fn(r, key - r * g.cols, st.cells.get(key)!.stitch); } });
    }
    // i passaggi (dei fili accesi), con la larghezza fissa sullo schermo
    if (showPaths && result) {
      for (const kind of ['jump', 'hidden', 'retrace', 'vertical', 'visible'] as const) {
        const style = PATH_STYLE[kind];
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width * screenPx;
        ctx.setLineDash(style.dash.map((d) => d * screenPx));
        ctx.beginPath();
        for (const cr of result.colors) {
          if (st.threads[cr.color]?.hidden) continue;
          for (const sg of cr.segs) {
            if (sg.kind !== kind) continue;
            const [pa, pb] = segmentPoints(g, sg.from, sg.to);
            ctx.moveTo(X(pa.x), Y(pa.y));
            ctx.lineTo(X(pb.x), Y(pb.y));
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // dove parte ogni filo
      for (const cr of result.colors) {
        const first = cr.segs[0];
        if (!first || st.threads[cr.color]?.hidden) continue;
        const p = segmentPoints(g, first.from, first.to)[0];
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), Math.min(g.cellW, g.cellH) * 0.18 * k, 0, Math.PI * 2);
        ctx.fillStyle = st.threads[cr.color]?.hex ?? '#000000';
        ctx.fill();
        ctx.lineWidth = screenPx;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    // --- l'SVG sopra: solo la griglia (il pennello e il ritaglio ci si aggiungono) ---
    const pitch = rowPitch(g);
    overlay.setAttribute('viewBox', `${f(-m)} ${f(-m)} ${f(w + 2 * m)} ${f(h + 2 * m)}`);
    overlay.innerHTML = `<defs><pattern id="cs-cell" width="${f(g.cellW)}" height="${f(pitch)}" patternUnits="userSpaceOnUse"><path d="M ${f(g.cellW)} 0 L 0 0 0 ${f(pitch)}" fill="none" style="stroke:var(--rg-color-neutral-400)" stroke-width="0.6" vector-effect="non-scaling-stroke"/></pattern>`
      + `<pattern id="cs-major" width="${f(g.cellW * 10)}" height="${f(pitch * 10)}" patternUnits="userSpaceOnUse"><path d="M ${f(g.cellW * 10)} 0 L 0 0 0 ${f(pitch * 10)}" fill="none" style="stroke:var(--rg-color-neutral-800)" stroke-width="0.9" vector-effect="non-scaling-stroke"/></pattern></defs>`
      + (showGrid ? `<g opacity="0.55" pointer-events="none"><rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="url(#cs-cell)"/><rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="url(#cs-major)"/></g>` : '')
      + `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="none" style="stroke:var(--rg-color-neutral-800)" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;

    drawGroups();
    $('formatInfo').textContent = `Griglia: ${st.grid.cols} colonne × ${st.grid.rows} righe, un punto per cella · il ricamo esce ${fmtNum(w)} × ${fmtNum(h)} mm (le celle sono intere)`;
    showStatus();
  }

  /** I numeri dei passaggi nella barra di stato (o che si stanno calcolando). */
  function showStatus(): void {
    if (routing) { $('status').textContent = 'Calcolo dei passaggi…'; return; }
    if (!result) return;
    const m = result.metrics;
    if (!m.legs) { $('status').textContent = 'Griglia vuota: disegna con il clic.'; return; }
    const mm = (x: number) => `${Math.round(x)} mm`;
    $('status').textContent = `${m.legs} diagonali · passaggi in vista ${mm(m.visibleMm)} · ripassi ${mm(m.retraceMm)} · vertice-vertice ${mm(m.verticalMm)} · nascosti ${mm(m.hiddenMm)} · ${m.jumps} salt${m.jumps === 1 ? 'o' : 'i'}`;
  }

  // ---- I passaggi in un processo a parte (Web Worker) ----------------------------
  // Il calcolo sul giornale intero prende mezzo secondo o più: fatto qui bloccava la pagina. Nel
  // worker la pagina resta libera: i punti si vedono subito, i passaggi arrivano appena pronti.
  // Una richiesta vecchia che arriva dopo una nuova si scarta.
  let routing = false;
  let routeRequest = 0;
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./routing.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: RouteResult; error?: string }>) => {
      if (e.data.id !== routeRequest) return;
      routing = false;
      if (e.data.error) { result = null; $('status').textContent = 'Errore nei passaggi: ' + e.data.error; return; }
      result = e.data.result ?? null;
      draw();
    };
  } catch { worker = null; /* senza worker si calcola qui, come prima */ }

  function recompute(): void {
    routeRequest++;
    if (worker) {
      routing = true;
      worker.postMessage({ id: routeRequest, grid: st.grid, cells: st.cells, params: routeParams() });
      return;
    }
    try {
      result = routeCells(st.grid, st.cells, routeParams());
    } catch (e) {
      result = null;
      $('status').textContent = 'Errore nei passaggi: ' + (e as Error).message;
      console.error(e);
    }
  }

  /** Ricalcola e ridisegna: i punti subito, i passaggi quando il worker ha finito. */
  function update(): void {
    recompute();
    draw();
  }

  // Ridisegna nitido dopo uno zoom (quando la rotella si ferma) e quando la tela cambia misura.
  function onZoom(): void {
    window.clearTimeout(zoomTimer);
    zoomTimer = window.setTimeout(() => { if (Math.abs((pz?.getZoom() || 1) - renderZoom) > 1e-3) draw(); }, 150);
  }
  onZoomHook = onZoom;
  new ResizeObserver(() => { if (root.isConnected) draw(); }).observe($('canvas'));

  // ---- campi ------------------------------------------------------------------
  function syncFields(): void {
    num('sizeW').value = fmtNum(Math.round(target.w * 10) / 10);
    num('sizeH').value = fmtNum(Math.round(target.h * 10) / 10);
    num('cellW').value = fmtNum(st.grid.cellW);
    num('cellH').value = fmtNum(st.grid.cellH);
    num('overlap').value = fmtNum(st.grid.overlapPct ?? 0);
    num('jumpMm').value = fmtNum(st.route.jumpMm);
    num('maxStitch').value = fmtNum(st.stitch.maxStitchMm);
    num('travelStitch').value = fmtNum(st.stitch.travelStitchMm);
    $<HTMLInputElement>('fixedDir').checked = st.route.fixedDirection;
    $<HTMLInputElement>('byBlocks').checked = st.route.blocks !== false;
    num('zoneGap').value = fmtNum(st.route.zones?.gapMm ?? DEFAULT_ZONES.gapMm);
    num('zoneMax').value = fmtNum(st.route.zones?.maxMm ?? DEFAULT_ZONES.maxMm);
    num('zoneGap').disabled = num('zoneMax').disabled = st.route.blocks === false;
    syncSegmented();
  }

  function syncSegmented(): void {
    const mark = (sel: string, on: (b: HTMLButtonElement) => boolean) => root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => {
      const yes = on(b);
      b.classList.toggle('rg-segmented__item--active', yes);
      b.setAttribute('aria-pressed', yes ? 'true' : 'false');
    });
    mark('#modeSel .rg-segmented__item', (b) => b.dataset.mode === mode);
    mark('#sizeSel .rg-segmented__item', (b) => Number(b.dataset.size) === brushSize);
    mark('#stitchSel .rg-segmented__item', (b) => b.dataset.stitch === brushStitch);
    mark('#topLegSel .rg-segmented__item', (b) => b.dataset.leg === st.route.topLeg);
    mark('#passOrderSel .rg-segmented__item', (b) => b.dataset.order === (st.route.passOrder ?? DEFAULT_ROUTE.passOrder));
    $('modeHelp').textContent = MODE_HELP[mode];
    const cv = root.querySelector('#canvas');
    if (cv) for (const m of ['pan', 'paint', 'fill', 'erase', 'group']) cv.classList.toggle('cs-mode-' + m, m === mode);
    for (const id of ['sizeSel', 'stitchSel', 'editThreads']) root.querySelectorAll<HTMLButtonElement>('#' + id + ' button').forEach((b) => { b.disabled = mode === 'group'; });
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
    const w = Math.max(1, readNum('sizeW') || target.w);
    let h = Math.max(1, readNum('sizeH') || target.h);
    if (id !== 'sizeH') h = ratioHeight(w);
    else if (image) $<HTMLInputElement>('keepRatio').checked = false; // l'altezza scritta a mano sblocca la proporzione
    target = { w, h };
    const next = gridForSize(w, h, readNum('cellW') || st.grid.cellW, readNum('cellH') || st.grid.cellH, readNum('overlap') || 0);
    pushUndo();
    if (image && fromImage) st.cells = knitFromImage(next, image.px, threadRgb(), knitOpts());
    else st.cells = resizeCells(st.grid, next, st.cells);
    st.grid = next;
    syncFields();
    update();
  }
  for (const id of ['sizeW', 'sizeH', 'cellW', 'cellH', 'overlap']) num(id).addEventListener('change', onSizeChange);
  $<HTMLInputElement>('keepRatio').addEventListener('change', () => { if ($<HTMLInputElement>('keepRatio').checked) onSizeChange(); });

  num('jumpMm').addEventListener('change', () => { st.route.jumpMm = Math.max(0, readNum('jumpMm') || 0); syncFields(); update(); });
  num('maxStitch').addEventListener('change', () => { st.stitch.maxStitchMm = Math.min(12, Math.max(1, readNum('maxStitch') || DEFAULT_STITCH.maxStitchMm)); syncFields(); });
  num('travelStitch').addEventListener('change', () => { st.stitch.travelStitchMm = Math.min(12, Math.max(0.5, readNum('travelStitch') || DEFAULT_STITCH.travelStitchMm)); syncFields(); });
  $<HTMLInputElement>('byBlocks').addEventListener('change', (e) => { st.route.blocks = (e.target as HTMLInputElement).checked; syncFields(); update(); });
  const setZones = () => {
    st.route.zones = {
      gapMm: Math.max(0, readNum('zoneGap') ?? DEFAULT_ZONES.gapMm),
      maxMm: Math.max(10, readNum('zoneMax') ?? DEFAULT_ZONES.maxMm),
    };
    syncFields(); update();
  };
  num('zoneGap').addEventListener('change', setZones);
  num('zoneMax').addEventListener('change', setZones);
  $<HTMLInputElement>('fixedDir').addEventListener('change', (e) => { st.route.fixedDirection = (e.target as HTMLInputElement).checked; update(); });
  $<HTMLInputElement>('showPaths').addEventListener('change', (e) => { showPaths = (e.target as HTMLInputElement).checked; draw(); });
  $<HTMLInputElement>('showGrid').addEventListener('change', (e) => { showGrid = (e.target as HTMLInputElement).checked; draw(); });

  const setMode = (m: Mode) => { mode = m; syncSegmented(); hideBrush(); drawGroups(); };
  root.querySelectorAll<HTMLButtonElement>('#modeSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as Mode)));
  root.querySelectorAll<HTMLButtonElement>('#sizeSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => { brushSize = Number(b.dataset.size) || 1; syncSegmented(); }));
  root.querySelectorAll<HTMLButtonElement>('#passOrderSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => { st.route.passOrder = b.dataset.order as 'row' | 'stitch'; syncSegmented(); update(); }));
  root.querySelectorAll<HTMLButtonElement>('#stitchSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => { brushStitch = b.dataset.stitch as BrushStitch; syncSegmented(); }));
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
      const active = i === activeThread;
      const isBase = st.route.base?.color === i;
      const li = document.createElement('li');
      li.className = 'rg-color-map__row cs-thread' + (active ? ' cs-thread--active' : '');

      // il colore: il quadratino apre il selettore del colore
      const colorLbl = document.createElement('label');
      colorLbl.className = 'cs-thread__color';
      const sw = document.createElement('span');
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
        hex.textContent = t.hex.toUpperCase() + ' ';
        draw();
      });
      picker.addEventListener('change', () => buildThreads());
      colorLbl.append(sw, picker);

      // il codice è il bottone che sceglie il filo del pennello (raggiungibile da tastiera)
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rg-color-map__code cs-thread__pick';
      pick.setAttribute('aria-pressed', active ? 'true' : 'false');
      const hex = document.createTextNode(t.hex.toUpperCase() + ' ');
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      const who = active ? 'pennello · ' : '';
      meta.textContent = who + (isBase ? 'base · tutta la griglia · primo ago' : `ago ${i + 1} · ${used.get(i) ?? 0} celle`);
      pick.append(hex, meta);
      pick.addEventListener('click', () => { activeThread = i; buildThreads(); });

      const aside = document.createElement('span');
      aside.className = 'rg-cluster cs-thread__controls'; // seconda riga, sotto il codice: in una riga sola schiacciava il testo
      // le passate di questo filo
      const pass = document.createElement('span');
      pass.className = 'rg-field-with-unit rg-field-with-unit--compact';
      const passIn = document.createElement('input');
      passIn.type = 'text';
      passIn.inputMode = 'numeric';
      passIn.maxLength = 1;
      passIn.className = 'rg-input rg-input--numeric';
      passIn.value = String(passesOf(i));
      passIn.setAttribute('aria-label', `Passate del filo ${i + 1}, da 1 a 9`);
      passIn.title = 'Passate su ogni diagonale di questo filo';
      passIn.addEventListener('change', () => {
        t.passes = clampInt(parseNum(passIn.value) || 1, 1, 9);
        passIn.value = String(t.passes);
        update();
      });
      const passU = document.createElement('span');
      passU.textContent = 'pass';
      pass.append(passIn, passU);
      aside.appendChild(pass);
      // lo stop acceso o spento nell'anteprima
      const vis = document.createElement('label');
      vis.className = 'rg-toggle';
      vis.title = 'Mostra o nascondi questo stop nell’anteprima (il ricamo non cambia)';
      const visIn = document.createElement('input');
      visIn.type = 'checkbox';
      visIn.checked = !t.hidden;
      visIn.setAttribute('aria-label', `Mostra lo stop del filo ${i + 1}`);
      visIn.addEventListener('change', () => { t.hidden = !visIn.checked; draw(); });
      const visTrack = document.createElement('span');
      visTrack.className = 'rg-toggle__track';
      const visTxt = document.createElement('span');
      visTxt.textContent = 'Vedi';
      vis.append(visIn, visTrack, visTxt);
      aside.appendChild(vis);
      // ordine e togli: bottoni a icona con suggerimento (DS)
      const iconBtn = (tip: string, id: string, svg: string, danger: boolean, onClick: () => void) => {
        const grp = document.createElement('span');
        grp.className = 'rg-action-group';
        const wrap = document.createElement('span');
        wrap.className = 'rg-tooltip rg-tooltip--end'; // in fondo alla riga: il suggerimento si apre verso sinistra, non sborda
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rg-icon-button rg-icon-button--full' + (danger ? ' rg-icon-button--danger' : '');
        b.setAttribute('aria-labelledby', id);
        b.innerHTML = svg;
        b.addEventListener('click', onClick);
        const tt = document.createElement('span');
        tt.className = 'rg-tooltip__text';
        tt.setAttribute('role', 'tooltip');
        tt.id = id;
        tt.textContent = tip;
        wrap.append(b, tt);
        grp.appendChild(wrap);
        return grp;
      };
      if (i > 0) {
        // la freccia su non c'è nello sprite del DS: tratto disegnato come le sue icone (24, 1.5, squadrato)
        aside.appendChild(iconBtn(`Cuci prima il filo ${i + 1}`, `tip-su-${i}`,
          '<svg class="rg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
          false, () => swapThreads(i - 1, i)));
      }
      if (st.threads.length > 1) {
        aside.appendChild(iconBtn(`Togli il filo ${i + 1} (si annulla con Annulla)`, `tip-via-${i}`,
          `<svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-elimina"></use></svg>`,
          true, () => removeThread(i)));
      }
      li.append(colorLbl, pick, aside);
      host.appendChild(li);
    });
    buildEditThreads();
    syncBase();
  }

  /** La scelta «Filo di base»: nessuna, o uno dei fili. */
  function syncBase(): void {
    const base = st.route.base ?? null;
    const sel = $<HTMLSelectElement>('baseSel');
    sel.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— nessuna';
    sel.appendChild(none);
    st.threads.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `Filo ${i + 1} · ${t.hex.toUpperCase()}`;
      sel.appendChild(o);
    });
    sel.value = base ? String(base.color) : '';
    $('baseBox').hidden = !base;
    if (!base) return;
    root.querySelectorAll<HTMLButtonElement>('#baseStitchSel .rg-segmented__item').forEach((b) => {
      const on = b.dataset.bstitch === base.stitch;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $<HTMLSelectElement>('baseSel').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    // il punto della base parte da quello della generazione
    st.route.base = v === '' ? null : { color: Number(v), stitch: st.route.base?.stitch ?? knit.stitch };
    buildThreads();
    update();
  });
  root.querySelectorAll<HTMLButtonElement>('#baseStitchSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    if (!st.route.base) return;
    st.route.base = { ...st.route.base, stitch: b.dataset.bstitch as Stitch };
    syncBase();
    update();
  }));

  /** I fili nella barra di modifica: un segmented di campioni, un clic sceglie quello del pennello. */
  function buildEditThreads(): void {
    const host = $('editThreads');
    host.innerHTML = '';
    st.threads.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rg-segmented__item' + (i === activeThread ? ' rg-segmented__item--active' : '');
      b.setAttribute('aria-label', `Filo ${i + 1} ${t.hex.toUpperCase()}`);
      b.setAttribute('aria-pressed', i === activeThread ? 'true' : 'false');
      b.title = `Filo ${i + 1} (${t.hex.toUpperCase()})`;
      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', t.hex);
      b.appendChild(sw);
      b.addEventListener('click', () => { activeThread = i; buildThreads(); if (mode === 'pan' || mode === 'erase') setMode('paint'); });
      host.appendChild(b);
    });
  }

  /** Scambia due aghi: cambia l'ordine di cucitura, non il disegno. */
  function swapThreads(a: number, b: number): void {
    [st.threads[a], st.threads[b]] = [st.threads[b], st.threads[a]];
    for (const m of st.cells.values()) m.color = m.color === a ? b : m.color === b ? a : m.color;
    if (activeThread === a) activeThread = b; else if (activeThread === b) activeThread = a;
    const bc = st.route.base?.color;
    if (st.route.base && (bc === a || bc === b)) st.route.base = { ...st.route.base, color: bc === a ? b : a };
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
    if (st.route.base) {
      if (st.route.base.color === i) st.route.base = null;
      else if (st.route.base.color > i) st.route.base = { ...st.route.base, color: st.route.base.color - 1 };
    }
    buildThreads();
    update();
  }

  $('addThread').addEventListener('click', () => {
    const palette = ['#2b6cb0', '#2f855a', '#b7791f', '#6b46c1', '#c05621', '#1a1a1a'];
    st.threads.push({ hex: palette[(st.threads.length - 2 + palette.length) % palette.length], passes: passesOf(activeThread) });
    activeThread = st.threads.length - 1;
    buildThreads();
  });

  // ---- annulla ----------------------------------------------------------------
  function cloneCells(c: Cells): Cells { return new Map([...c].map(([k, m]) => [k, { ...m }])); }
  function pushUndo(): void {
    undo.push({ grid: { ...st.grid }, cells: cloneCells(st.cells) });
    if (undo.length > 100) undo.shift();
    redo.length = 0;
  }
  function restore(snap: { grid: GridSpec; cells: Cells }): void {
    st.grid = snap.grid;
    st.cells = snap.cells;
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    update();
  }
  function doUndo(): void {
    const prev = undo.pop();
    if (!prev) return;
    redo.push({ grid: { ...st.grid }, cells: cloneCells(st.cells) });
    restore(prev);
  }
  function doRedo(): void {
    const next = redo.pop();
    if (!next) return;
    undo.push({ grid: { ...st.grid }, cells: cloneCells(st.cells) });
    restore(next);
  }
  $('undoBtn').addEventListener('click', doUndo);
  $('redoBtn').addEventListener('click', doRedo);
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
  /** Il punto in mm sotto il puntatore, nel sistema della griglia (anche fuori griglia). */
  function mmAt(e: PointerEvent): { x: number; y: number } | null {
    const svg = $('layer').querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const { w, h } = sizeMm();
    const m = margin();
    return {
      x: -m + ((e.clientX - rect.left) / rect.width) * (w + 2 * m),
      y: -m + ((e.clientY - rect.top) / rect.height) * (h + 2 * m),
    };
  }

  function cellAt(e: PointerEvent): { r: number; c: number } | null {
    const p = mmAt(e);
    if (!p) return null;
    const { x, y } = p;
    const { h } = sizeMm();
    // col sormonto le righe si sovrappongono: vince quella che parte più in basso (è cucita sopra)
    const c = Math.floor(x / st.grid.cellW), r = Math.min(st.grid.rows - 1, Math.floor(y / rowPitch(st.grid)));
    if (y < 0 || y > h) return null;
    if (r < 0 || c < 0 || r >= st.grid.rows || c >= st.grid.cols) return null;
    return { r, c };
  }

  /** L'impronta del pennello sotto il mouse: si vede dove si sta per modificare. */
  function showBrush(at: { r: number; c: number } | null): void {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    let rect = svg.querySelector<SVGRectElement>('#cs-brush');
    if (!at || mode === 'pan' || mode === 'group' || cropping) { rect?.remove(); return; }
    if (!rect) {
      rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.id = 'cs-brush';
      rect.setAttribute('vector-effect', 'non-scaling-stroke');
      rect.setAttribute('pointer-events', 'none');
      svg.appendChild(rect);
    }
    const cellsIn = brushArea(st.grid, at.r, at.c, mode === 'fill' ? 1 : brushSize);
    if (!cellsIn.length) { rect.remove(); return; }
    const p = rowPitch(st.grid);
    const c0 = Math.min(...cellsIn.map((x) => x.c)), c1 = Math.max(...cellsIn.map((x) => x.c)) + 1;
    const r0 = Math.min(...cellsIn.map((x) => x.r)), r1 = Math.max(...cellsIn.map((x) => x.r));
    rect.setAttribute('x', String(c0 * st.grid.cellW));
    rect.setAttribute('y', String(r0 * p));
    rect.setAttribute('width', String((c1 - c0) * st.grid.cellW));
    rect.setAttribute('height', String(r1 * p + st.grid.cellH - r0 * p));
    rect.setAttribute('style', mode === 'erase'
      ? 'fill:none;stroke:var(--rg-color-danger);stroke-width:2;stroke-dasharray:4 3'
      : `fill:none;stroke:var(--rg-color-focus);stroke-width:2`);
  }
  function hideBrush(): void { showBrush(null); }

  /** Il pennello (o la gomma) su una cella; vero se ha cambiato qualcosa. */
  function paintCell(r: number, c: number): boolean {
    if (!painting) return false;
    const key = r * st.grid.cols + c; // una cella = un punto
    if (key === painting.last) return false;
    painting.last = key;
    return applyEdits(st.grid, st.cells, brushEdits(st.grid, st.cells, r, c, brushSize, activeThread, brushStitch, painting.button, painting.erase));
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
      const rr = Math.round(from.r + ((at.r - from.r) * s) / Math.max(1, n));
      const cc = Math.round(from.c + ((at.c - from.c) * s) / Math.max(1, n));
      if (paintCell(rr, cc)) changed = true;
    }
    painting.lastCell = at;
    if (changed) {
      painting.changed = true;
      fromImage = false; // ritoccato a mano: cambiando le misure non si rifà più dall'immagine
      // Mentre si trascina si ridisegnano solo i punti: i passaggi si ricalcolano quando si lascia
      // (sul giornale Dior sono 56.000 diagonali, e ricalcolarli a ogni mossa rallentava il pennello).
      result = null;
      draw();
    }
    showBrush(at);
  }

  // In cattura: il gesto di modifica è nostro, il pan/zoom non lo deve nemmeno vedere. Restano al
  // pan lo strumento Sposta, il tasto centrale e lo spazio + trascina.
  canvas.addEventListener('pointerdown', (e) => {
    if (spaceDown || (e.button !== 0 && e.button !== 2)) return;
    if (cropping) {
      const p = mmAt(e);
      if (!p || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const { w, h } = sizeMm();
      const cl = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      cropDrag = { a: cl, b: cl };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (mode === 'pan') return;
    if (mode === 'group') {
      const p = mmAt(e);
      if (!p || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const { w, h } = sizeMm();
      const cl = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      groupDrag = { a: cl, b: cl };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    const at = cellAt(e);
    if (!at) return;
    e.stopPropagation(); e.preventDefault();
    const button: Button = e.button === 2 ? 'right' : 'left';
    if (mode === 'fill') {
      const edits = fillEdits(st.grid, st.cells, at.r, at.c, activeThread, brushStitch, button, e.shiftKey);
      if (!edits.length) return;
      pushUndo();
      applyEdits(st.grid, st.cells, edits);
      fromImage = false;
      buildThreads();
      update();
      $('status').textContent = `Riempite ${Math.round(edits.length / 2)} V. ` + $('status').textContent;
      return;
    }
    pushUndo();
    painting = { button, erase: mode === 'erase' || e.shiftKey, last: -1, lastCell: null, changed: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    paintAt(e);
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (cropDrag) {
      e.stopPropagation();
      const p = mmAt(e);
      if (!p) return;
      const { w, h } = sizeMm();
      cropDrag.b = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      drawCropRect(cropDrag.a, cropDrag.b);
      return;
    }
    if (groupDrag) {
      e.stopPropagation();
      const p = mmAt(e);
      if (!p) return;
      const { w, h } = sizeMm();
      groupDrag.b = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      drawGroups();
      return;
    }
    if (!painting) { showBrush(spaceDown ? null : cellAt(e)); return; }
    e.stopPropagation();
    paintAt(e);
  }, true);
  canvas.addEventListener('pointerleave', () => { if (!painting) hideBrush(); });
  const endPaint = (e: PointerEvent) => {
    if (cropDrag) {
      e.stopPropagation();
      const d = cropDrag;
      cropDrag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      finishCrop(d.a, d.b);
      return;
    }
    if (groupDrag) {
      e.stopPropagation();
      const d = groupDrag;
      groupDrag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const q: ZoneGroup = { x: Math.min(d.a.x, d.b.x), y: Math.min(d.a.y, d.b.y), w: Math.abs(d.b.x - d.a.x), h: Math.abs(d.b.y - d.a.y) };
      // un clic senza trascinare non fa un gruppo: serve almeno una cella per lato
      if (q.w >= st.grid.cellW && q.h >= rowPitch(st.grid)) {
        const r1 = (n: number) => Math.round(n * 10) / 10;
        st.route.groups = [...(st.route.groups ?? []), { x: r1(q.x), y: r1(q.y), w: r1(q.w), h: r1(q.h) }];
        buildGroups();
        update();
      } else drawGroups();
      return;
    }
    if (!painting) return;
    e.stopPropagation();
    const changed = painting.changed;
    painting = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!changed) { undo.pop(); return; }
    buildThreads();
    update();
  };
  canvas.addEventListener('pointerup', endPaint, true);
  canvas.addEventListener('pointercancel', endPaint, true);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!root.isConnected) { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); return; }
    if (isTyping(e.target)) return;
    if (e.code === 'Space') { spaceDown = true; canvas.classList.add('cs-pan'); e.preventDefault(); }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'b') setMode('paint');
    else if (k === 'f') setMode('fill');
    else if (k === 'e') setMode('erase');
    else if (k === 'h') setMode('pan');
    else if (k === 'g') setMode('group');
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
      const img = new Image();
      img.onload = () => {
        source = { img, name: file.name };
        crop = null;
        applySource();
      };
      img.onerror = () => { $('imageStatus').textContent = `${file.name}: immagine non leggibile.`; };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  /**
   * L'immagine di lavoro = l'originale, ritagliata se c'è un ritaglio. Il ritaglio si prende
   * sempre dall'ORIGINALE a piena risoluzione (non dai pixel già ridotti), così anche uno swatch
   * piccolo ha abbastanza dettaglio; poi si riduce a 600 px, che per il colore di una V bastano.
   * L'altezza del ricamo prende le proporzioni del pezzo, la griglia si ricalcola e la maglia si
   * rifà subito: poi si regolano le misure.
   */
  function applySource(): void {
    if (!source) return;
    const { img } = source;
    const cr = crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const scale = Math.min(1, 600 / Math.max(cr.w, cr.h));
    const cnv = document.createElement('canvas');
    cnv.width = Math.max(1, Math.round(cr.w * scale));
    cnv.height = Math.max(1, Math.round(cr.h * scale));
    const ctx = cnv.getContext('2d')!;
    ctx.drawImage(img, cr.x, cr.y, cr.w, cr.h, 0, 0, cnv.width, cnv.height);
    const data = ctx.getImageData(0, 0, cnv.width, cnv.height);
    image = { url: cnv.toDataURL('image/png'), w: cr.w, h: cr.h, px: { rgba: data.data, width: cnv.width, height: cnv.height } };
    $<HTMLInputElement>('keepRatio').checked = true;
    target = { w: target.w, h: ratioHeight(target.w) };
    st.grid = gridForSize(target.w, target.h, st.grid.cellW, st.grid.cellH, st.grid.overlapPct ?? 0);
    syncFields();
    knitNow();
    $('imageStatus').textContent = crop
      ? `${source.name}: ritaglio di ${Math.round(cr.w)}×${Math.round(cr.h)} px su ${img.naturalWidth}×${img.naturalHeight}.`
      : `${source.name}: ${img.naturalWidth}×${img.naturalHeight} px.`;
    requestAnimationFrame(() => pz.fit());
  }

  function setCropping(on: boolean): void {
    cropping = on && !!image;
    const b = $('cropBtn');
    b.setAttribute('aria-pressed', cropping ? 'true' : 'false');
    b.classList.toggle('rg-button--primary', cropping);
    b.classList.toggle('rg-button--outline', !cropping);
    canvas.classList.toggle('cs-crop', cropping);
    if (cropping) $('imageStatus').textContent = 'Trascina un rettangolo sul disegno: la maglia si rifà su quel pezzo.';
  }
  $('cropBtn').addEventListener('click', () => {
    if (!image) { $('imageStatus').textContent = 'Carica prima un’immagine.'; return; }
    setCropping(!cropping);
  });
  $('uncropBtn').addEventListener('click', () => {
    if (!source || !crop) return;
    crop = null;
    setCropping(false);
    applySource();
  });

  /**
   * I gruppi sopra l'anteprima (in modalità Gruppi, o quello evidenziato dalla lista): un
   * rettangolo continuo nel colore di categoria col suo numero, diverso dal ritaglio tratteggiato.
   */
  function drawGroups(): void {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    svg.querySelector('#cs-groups')?.remove();
    const groups = st.route.groups ?? [];
    if ((mode !== 'group' && groupHover < 0) || (!groups.length && !groupDrag)) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.id = 'cs-groups';
    layer.setAttribute('pointer-events', 'none');
    const fs = Math.max(4, sizeMm().w / 45);
    const box = (q: ZoneGroup, strong: boolean, label: string) => {
      const rc = document.createElementNS(ns, 'rect');
      rc.setAttribute('x', String(q.x)); rc.setAttribute('y', String(q.y));
      rc.setAttribute('width', String(q.w)); rc.setAttribute('height', String(q.h));
      rc.setAttribute('vector-effect', 'non-scaling-stroke');
      rc.setAttribute('style', `fill:none;stroke:var(--rg-color-category-2);stroke-width:${strong ? 3 : 2}`);
      layer.appendChild(rc);
      if (!label) return;
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(q.x + fs * 0.3)); t.setAttribute('y', String(q.y + fs * 1.05));
      t.setAttribute('font-size', String(fs));
      t.setAttribute('style', 'fill:var(--rg-color-category-2);font-family:var(--rg-font-mono);paint-order:stroke;stroke:var(--rg-color-white);stroke-width:3px;stroke-linejoin:round');
      t.textContent = label;
      layer.appendChild(t);
    };
    groups.forEach((q, i) => { if (mode === 'group' || i === groupHover) box(q, i === groupHover, String(i + 1)); });
    if (groupDrag) {
      const d = groupDrag;
      box({ x: Math.min(d.a.x, d.b.x), y: Math.min(d.a.y, d.b.y), w: Math.abs(d.b.x - d.a.x), h: Math.abs(d.b.y - d.a.y) }, true, '');
    }
    svg.appendChild(layer);
  }

  /** La lista dei gruppi nel pannello (04 Passaggi). */
  function buildGroups(): void {
    const groups = st.route.groups ?? [];
    const list = $('groupList');
    list.innerHTML = '';
    list.hidden = !groups.length;
    $('groupEmpty').hidden = groups.length > 0;
    $('groupClear').hidden = !groups.length;
    groups.forEach((q, i) => {
      const li = document.createElement('li');
      li.className = 'rg-list-row';
      li.innerHTML = `<div class="rg-list-row__head"><span class="rg-list-row__title">Gruppo ${i + 1}</span><span class="rg-mono">${fmtNum(Math.round(q.w))} × ${fmtNum(Math.round(q.h))} mm</span>`
        + `<span class="rg-list-row__actions"><span class="rg-tooltip rg-tooltip--end"><button type="button" class="rg-icon-button rg-icon-button--danger" aria-labelledby="tip-gdel-${i}">`
        + `<svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-elimina"></use></svg></button>`
        + `<span class="rg-tooltip__text" role="tooltip" id="tip-gdel-${i}">Elimina Gruppo ${i + 1}</span></span></span></div>`;
      li.addEventListener('mouseenter', () => { groupHover = i; drawGroups(); });
      li.addEventListener('mouseleave', () => { groupHover = -1; drawGroups(); });
      li.querySelector('button')!.addEventListener('click', () => {
        st.route.groups = groups.filter((_, j) => j !== i);
        groupHover = -1;
        buildGroups();
        update();
      });
      list.appendChild(li);
    });
    drawGroups();
  }
  $('groupClear').addEventListener('click', () => {
    const n = (st.route.groups ?? []).length;
    if (!n || !window.confirm(n === 1 ? 'Togliere il gruppo?' : `Togliere tutti i ${n} gruppi?`)) return;
    st.route.groups = [];
    buildGroups();
    update();
  });

  /** Il rettangolo che si sta tirando, disegnato sopra l'anteprima. */
  function drawCropRect(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    let r = svg.querySelector<SVGRectElement>('#cs-crop-rect');
    if (!r) {
      r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.id = 'cs-crop-rect';
      r.setAttribute('style', 'fill:none;stroke:var(--rg-color-focus);stroke-width:2;stroke-dasharray:6 4');
      r.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(r);
    }
    r.setAttribute('x', String(Math.min(a.x, b.x)));
    r.setAttribute('y', String(Math.min(a.y, b.y)));
    r.setAttribute('width', String(Math.abs(b.x - a.x)));
    r.setAttribute('height', String(Math.abs(b.y - a.y)));
  }

  /** Chiude il ritaglio: il rettangolo (in mm sulla griglia) diventa un pezzo dell'immagine. */
  function finishCrop(a: { x: number; y: number }, b: { x: number; y: number }): void {
    if (!source || !image) return;
    const { w, h } = sizeMm();
    const fx0 = Math.min(a.x, b.x) / w, fx1 = Math.max(a.x, b.x) / w;
    const fy0 = Math.min(a.y, b.y) / h, fy1 = Math.max(a.y, b.y) / h;
    if (fx1 - fx0 < 0.02 || fy1 - fy0 < 0.02) { draw(); return; } // un clic, non un rettangolo
    // L'immagine è stirata sulla griglia: le frazioni della griglia sono frazioni del pezzo attuale.
    const cur = crop ?? { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight };
    crop = { x: cur.x + fx0 * cur.w, y: cur.y + fy0 * cur.h, w: (fx1 - fx0) * cur.w, h: (fy1 - fy0) * cur.h };
    setCropping(false);
    applySource();
  }
  num('imageOpacity').addEventListener('change', () => {
    imageOpacity = Math.min(100, Math.max(0, readNum('imageOpacity') || 0)) / 100;
    draw();
  });
  /** Le opzioni della lettura: il fondo è l'ultimo filo, quello che sta sopra. */
  function knitOpts() {
    return { ...knit, background: st.threads.length - 1 };
  }

  /** Rilegge l'immagine coi fili che ci sono (senza ricalcolarne i colori). */
  function reknit(): void {
    if (!image) return;
    pushUndo();
    st.cells = knitFromImage(st.grid, image.px, threadRgb(), knitOpts());
    fromImage = true;
    buildThreads();
    update();
  }

  function syncKnit(): void {
    num('detailPct').value = fmtNum(knit.detailPct);
    root.querySelectorAll<HTMLButtonElement>('#knitStitchSel .rg-segmented__item').forEach((b) => {
      const on = b.dataset.kstitch === knit.stitch;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  root.querySelectorAll<HTMLButtonElement>('#knitStitchSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    knit.stitch = b.dataset.kstitch as KnitStitch;
    syncKnit();
    reknit();
  }));
  num('detailPct').addEventListener('change', () => {
    knit.detailPct = Math.min(100, Math.max(1, readNum('detailPct') || DEFAULT_KNIT.detailPct));
    syncKnit();
    reknit();
  });
  syncKnit();

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
    // I colori: median-cut, poi affinati (senza, il nero del giornale usciva grigio #8D8D8D).
    // L'ordine: chi copre di più va per ULTIMO, sopra (Lorenzo: «il bianco sopra il nero, c'è più
    // bianco e lo posso far muovere meglio»). Gli altri nascondono i passaggi sotto di lui.
    const pal = refinePalette(image.px, medianCutPalette(image.px.rgba, null, st.threads.length));
    if (!pal.length) return;
    const shares = paletteShares(image.px, pal);
    const order = pal.map((_, k) => k).sort((a, b) => shares[a] - shares[b]);
    const sorted = order.map((k) => pal[k]);
    pushUndo();
    // i colori nuovi, le passate di prima (per posizione)
    st.threads = sorted.map((c, i) => ({ hex: rgbToHex(c), passes: passesOf(i) }));
    st.cells = knitFromImage(st.grid, image.px, sorted, knitOpts());
    fromImage = true;
    buildThreads();
    update();
  }
  $('knitBtn').addEventListener('click', knitNow);
  $('removeImageBtn').addEventListener('click', () => { image = null; source = null; crop = null; setCropping(false); fromImage = false; $('imageStatus').textContent = 'Nessuna immagine.'; draw(); });

  // ---- progetto: riapertura (R27) ---------------------------------------------
  function projectMetadata(): Record<string, unknown> {
    return {
      rgProject: 'cross-stitch',
      version: VERSION,
      grid: st.grid,
      threads: st.threads,
      route: st.route,
      stitch: st.stitch,
      knit,
      cells: cellsToJson(st.grid, st.cells),
    };
  }

  function applyProject(meta: Record<string, unknown>): boolean {
    if (meta.rgProject !== 'cross-stitch') return false;
    const g = meta.grid as Partial<GridSpec> | undefined;
    if (g && g.cols && g.rows && g.cellW && g.cellH) st.grid = { cols: clampInt(g.cols, 1, 1000), rows: clampInt(g.rows, 1, 1000), cellW: g.cellW, cellH: g.cellH, overlapPct: Math.min(90, Math.max(0, Number(g.overlapPct) || 0)) };
    const repsOld = Math.max(1, Math.round(Number((meta.route as { repetitions?: number } | undefined)?.repetitions) || 1));
    // le passate per filo; nei progetti di prima c'era un valore solo per tutti
    if (Array.isArray(meta.threads) && meta.threads.length) st.threads = (meta.threads as Thread[]).map((t) => ({ hex: asHex6(String(t.hex)), passes: Math.max(1, Math.round(Number(t.passes) || repsOld)) }));
    if (meta.route && typeof meta.route === 'object') st.route = { ...DEFAULT_ROUTE, ...(meta.route as Partial<RouteParams>) };
    // Le versioni prima saltavano oltre 12 (0.1.0) o 30 (0.2.0): erano i default di allora, non
    // scelte. Da 0.3.0 niente salti (Lorenzo: si vedono, passano sopra gli altri colori).
    const old = { '0.1.0': 12, '0.2.0': 30 } as Record<string, number>;
    if (typeof meta.version === 'string' && old[meta.version] === st.route.jumpMm) st.route.jumpMm = DEFAULT_ROUTE.jumpMm;
    if (meta.stitch && typeof meta.stitch === 'object') st.stitch = { ...DEFAULT_STITCH, ...(meta.stitch as Partial<StitchParams>) };
    // una base che punta a un filo che non c'è (file ritoccato a mano, fili tolti): niente base
    if (st.route.base && !(Number.isInteger(st.route.base.color) && st.route.base.color >= 0 && st.route.base.color < st.threads.length)) st.route.base = null;
    if (meta.knit && typeof meta.knit === 'object') {
      const mk = meta.knit as Record<string, unknown>;
      Object.assign(knit, DEFAULT_KNIT, { detailPct: mk.detailPct ?? DEFAULT_KNIT.detailPct, stitch: mk.stitch ?? DEFAULT_KNIT.stitch });
    }
    syncKnit();
    st.cells = cellsFromJson(st.grid, meta.cells);
    // Fino a 0.3.0 la V occupava due colonne: si converte a «un punto per colonna».
    if (typeof meta.version === 'string' && ['0.1.0', '0.2.0', '0.3.0'].includes(meta.version)) {
      const conv = fromTwoColumnV(st.grid, st.cells);
      st.grid = conv.grid;
      st.cells = conv.cells;
    }
    for (const m of st.cells.values()) if (m.color >= st.threads.length) m.color = 0;
    activeThread = 0;
    return true;
  }

  function afterLoad(): void {
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    buildGroups();
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
  /**
   * Le tracce da esportare: solo gli stop accesi (Vedi). Uno stop spento non esiste nel file, e i
   * passaggi degli altri si ricalcolano come se non ci fosse: quello che copriva non copre più.
   */
  function exportLayers(): ExportLayer[] {
    const on = (color: number) => !st.threads[color]?.hidden;
    const cells: Cells = new Map([...st.cells].filter(([, m]) => on(m.color)));
    const params = routeParams();
    if (params.base && !on(params.base.color)) params.base = null;
    const res = routeCells(st.grid, cells, params);
    return res.colors.map((cr) => ({
      id: `filo-${cr.color + 1}`,
      color: st.threads[cr.color]?.hex ?? '#000000',
      polylines: colorPolylines(st.grid, cr, st.stitch),
      strokeMm: threadWidth(cr.color),
    }));
  }

  $('exportBtn').addEventListener('click', async () => {
    const layers = exportLayers();
    if (!layers.length) { $('status').textContent = 'Niente da esportare: la griglia è vuota o gli stop sono spenti.'; return; }
    const { w, h } = sizeMm();
    const svg = buildSvg(layers, { bounds: { minX: 0, minY: 0, maxX: w, maxY: h }, marginMm: 5, metadata: projectMetadata() });
    const name = `${sourceName || 'cross-stitch'}-cross-stitch.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, mime: 'image/svg+xml', extension: '.svg', description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  $('exportDstBtn').addEventListener('click', async () => {
    let bytes: Uint8Array;
    try {
      const layers = exportLayers();
      if (!layers.length) { $('status').textContent = 'Niente da esportare: la griglia è vuota o gli stop sono spenti.'; return; }
      bytes = dstFromExportLayers(layers, {
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

  // ---- avvio: sempre puliti ----------------------------------------------------
  try { localStorage.removeItem(OLD_AUTOSAVE_KEY); } catch { /* browser senza memoria: niente da togliere */ }
  afterLoad();
  $('status').textContent = 'Griglia vuota: carica un’immagine (01) o disegna con la barra qui sopra.';
}

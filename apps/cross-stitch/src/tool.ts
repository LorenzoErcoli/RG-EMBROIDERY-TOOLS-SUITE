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
  type Button, type CellEdit, type Cells, type GridSpec, type Leg, type Stitch, type Thread, type Tool,
  type Pixels, type BrushStitch, type KnitStitch, DEFAULT_GRID, applyEdits, brushArea, brushEdits, fillEdits, knitFromImage, gridForSize, refinePalette, paletteShares, DEFAULT_KNIT, cellIndex, cellsFromJson, cellsToJson, editsFor, fromThreadRoute, fromTwoColumnV, stitchLegs,
  resizeCells, pointInRow, segmentPoints, rowPitch, gridHeight,
} from './model';
import {
  type RouteParams, type RouteResult, type RouteSeg, type SegKind, type StitchParams,
  DEFAULT_ROUTE, DEFAULT_STITCH, RETRACE_PRESETS, colorPolylines, routeCells, type RetracePreset,
} from './routing';
import { entryRows, routeAll, routeModule, stripRanges, type ModulePath } from './strips';
import { editsOnAllCopies, findModule, movePiece, piecesOf, resizeModule, seamShift, shiftModule, tileModule, type KnitModule } from './module';
import { DEFAULT_ZONES, type ZoneGroup } from './zones';
import { areaFromMm, clampArea, subGrid, type TestArea } from './area';

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
type Mode = 'pan' | 'paint' | 'fill' | 'erase' | 'group' | 'cut' | 'image' | 'order' | 'reroute';

const MODE_HELP: Record<Mode, string> = {
  pan: 'Sposta: trascina per muovere la vista, rotella per ingrandire. Il ricamo non si tocca.',
  paint: 'Pennello: trascina per passare le V al filo scelto. Sulle celle vuote mette il punto scelto qui a fianco (V, croce, diagonale). Maiuscolo + trascina cancella.',
  fill: 'Riempi: un clic passa al filo scelto tutta la zona collegata dello stesso colore — per esempio l’interno di una lettera.',
  erase: 'Gomma: trascina per cancellare; lì non si cuce niente.',
  cut: 'Salti: clicca un passaggio e diventa un salto (la macchina taglia il filo); clicca un salto fatto a mano e torna passaggio. Si tolgono tutti in 04 Passaggi.',
  reroute: 'Ridisegna passaggio: clicca un passaggio, poi i punti da cui deve passare, in ordine. Invio finisce, Esc toglie i punti appena messi, Canc rimette il passaggio automatico.',
  order: 'Ordine pezzi: clicca i pezzi del filo scelto nell’ordine in cui vuoi cucirli (il primo clic è il primo pezzo). Il primo pezzo dà l’ingresso: il filo entra lì a sinistra ed esce a destra alla stessa altezza.',
  image: 'Sposta immagine: trascina l’immagine sotto la griglia finché il motivo cade giusto sulle V del modulo.',
  group: 'Gruppi: trascina un rettangolo attorno a una parte (per esempio un titolo): il filo di ogni colore la cuce tutta insieme, prima del resto e nell’ordine della lista in 04 Passaggi.',
};

/** Come si disegna ogni tipo di passaggio nell'anteprima (colori dai token del DS). */
const SEG_STYLE: Record<Exclude<SegKind, 'stitch'>, string> = {
  visible: 'stroke:var(--rg-color-danger);stroke-width:2',
  retrace: 'stroke:var(--rg-color-warning);stroke-width:2',
  vertical: 'stroke:var(--rg-color-info);stroke-width:2',
  hidden: 'stroke:var(--rg-color-neutral-600);stroke-width:1;stroke-dasharray:3 2',
  jump: 'stroke:var(--rg-color-neutral-400);stroke-width:1;stroke-dasharray:1 3',
};
/** Il salto messo a mano: si distingue da quello automatico anche per il tratteggio. */
const CUT_STYLE = 'stroke:var(--rg-color-accent-blue);stroke-width:2;stroke-dasharray:6 3';

interface State {
  grid: GridSpec;
  cells: Cells;
  threads: Thread[];
  route: RouteParams;
  stitch: StitchParams;
  /** Il modulo che si ripete (module.ts): il ricamo è il modulo ripetuto. null = niente modulo. */
  module: KnitModule | null;
  /** I salti a mano: passaggi fra due vertici (riga, colonna del reticolo del disegno intero). */
  cuts: Array<[number, number, number, number]>;
  /** L'area di prova (area.ts): passaggi ed export solo lì, il disegno resta tutto. */
  area: TestArea | null;
}

/** Monta il tool "Cross-Stitch" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountCrossStitch(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Cross-Stitch', opts.backHref)}
  <div class="rg-workspace cs-workspace">
    <aside class="rg-workspace__panel">
      <!-- La testa (01-03) resta sempre aperta; corpo (04-05) e coda (06) si richiudono e si ricordano. -->
      <section class="rg-param-section" id="sec-immagine">
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
            <span class="rg-tooltip"><button type="button" id="editorBtn" class="rg-button rg-button--outline rg-button--small" aria-describedby="tip-editor">Editor modulo</button><span class="rg-tooltip__text" role="tooltip" id="tip-editor">Una schermata per fare il modulo che si ripete: griglia, immagine sotto, disegno</span></span>
            <span class="rg-tooltip"><button type="button" id="cropBtn" class="rg-button rg-button--outline rg-button--small" aria-pressed="false" aria-describedby="tip-crop">Ritaglia</button><span class="rg-tooltip__text" role="tooltip" id="tip-crop">Trascina un rettangolo sul disegno: la maglia si rifà su quel pezzo</span></span>
            <button type="button" id="uncropBtn" class="rg-button rg-button--ghost rg-button--small">Immagine intera</button>
            <button type="button" id="removeImageBtn" class="rg-button rg-button--ghost rg-button--small">Togli</button>
          </div>
          <output class="rg-technical rg-param-grid__wide" id="moduleInfo" aria-live="polite" hidden></output>
          <div class="rg-param-grid rg-param-grid__wide" id="moduleBox" hidden>
            <div class="rg-cluster rg-param-grid__wide">
              <button type="button" id="moduleOffBtn" class="rg-button rg-button--ghost rg-button--small">Maglia normale dall'immagine</button>
            </div>
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

      <section class="rg-param-section" id="sec-misure">
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

      <section class="rg-param-section" id="ed-immagine" hidden>
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" id="edLoadBtn" class="rg-button rg-button--outline rg-button--small">Carica immagine…</button>
            <span class="rg-tooltip" id="edFindWrap" hidden><button type="button" id="edFindBtn" class="rg-button rg-button--outline rg-button--small" aria-describedby="tip-edfind">Trova da solo</button><span class="rg-tooltip__text" role="tooltip" id="tip-edfind">Il tool trova il motivo che si ripete, sistema griglia e immagine e ricopia i colori (qualche secondo)</span></span>
            <button type="button" id="edPaletteBtn" class="rg-button rg-button--ghost rg-button--small">Colori dall'immagine</button>
          </div>
          <label class="rg-field"><span class="rg-field__label">Opacità immagine</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edOpacity" type="text" inputmode="numeric"><span>%</span></span></label>
          <output class="rg-technical rg-param-grid__wide" id="edImageInfo" aria-live="polite"></output>
        </div>
      </section>

      <section class="rg-param-section" id="ed-griglia" hidden>
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Griglia</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Larghezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edCellW" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Altezza cella</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edCellH" type="text" inputmode="decimal"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Sormonto righe</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edOverlap" type="text" inputmode="numeric"><span>%</span></span></label>
          <span></span>
          <label class="rg-field"><span class="rg-field__label">Colonne del modulo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edCols" type="text" inputmode="numeric"><span>V</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Righe del modulo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edRows" type="text" inputmode="numeric"><span>V</span></span></label>
          <span class="rg-field__help rg-param-grid__wide">L'immagine si aggancia alla griglia: quanti pixel è una V, e dove comincia il modulo. Si sposta anche trascinandola con «Sposta immagine».</span>
          <label class="rg-field"><span class="rg-field__label">Una V nell'immagine</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edVpx" type="text" inputmode="decimal"><span>px</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Una riga nell'immagine</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edRowPx" type="text" inputmode="decimal"><span>px</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Inizio x</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edX" type="text" inputmode="decimal"><span>px</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Inizio y</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="edY" type="text" inputmode="decimal"><span>px</span></span></label>
        </div>
      </section>

      <section class="rg-param-section" id="sec-fili">
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
            <span class="rg-field__label" id="lbl-retrace">Per spostarsi</span>
            <div class="rg-segmented" id="retraceSel" role="group" aria-labelledby="lbl-retrace">
              <button type="button" class="rg-segmented__item" data-retrace="vista">Meno in vista</button>
              <button type="button" class="rg-segmented__item" data-retrace="equilibrio">Equilibrio</button>
              <button type="button" class="rg-segmented__item" data-retrace="ripassi">Meno ripassi</button>
            </div>
            <span class="rg-field__help">Meno ripassi sui propri punti costano più filo in vista sugli altri colori</span>
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
          <label class="rg-field"><span class="rg-field__label">Strisce</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="stripRows" type="text" inputmode="numeric" aria-describedby="h-stripRows"><span>righe</span></span>
            <span class="rg-field__help" id="h-stripRows">Ogni striscia: base e colori, poi la dopo. 0 = tutto insieme</span></label>
          <label class="rg-field"><span class="rg-field__label">Ritiro fra strisce</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="stripShift" type="text" inputmode="decimal" aria-describedby="h-stripShift"><span>mm</span></span>
            <span class="rg-field__help" id="h-stripShift">Sposta ogni striscia nel file: + allontana, − avvicina</span></label>
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
          <div class="rg-field rg-param-grid__wide cs-cuts">
            <span class="rg-field__label" id="lbl-cuts">Salti a mano</span>
            <span class="rg-mono" id="cutCount" aria-labelledby="lbl-cuts">0</span>
            <span class="rg-field__help">Scegli «Salti» nella barra e clicca un passaggio: diventa salto. Riclicca per tornare indietro.</span>
            <button type="button" class="rg-button rg-button--small rg-button--ghost rg-button--danger" id="cutClear" disabled><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-elimina"></use></svg>Togli tutti</button>
          </div>
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
        <h2 class="rg-h3" id="stageTitle" tabindex="-1">Disegno</h2>
        <div class="rg-cluster" id="stageActions">
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Esporta SVG</button>
        </div>
        <div class="rg-cluster" id="editorActions" hidden>
          <button type="button" id="editorCancelBtn" class="rg-button rg-button--ghost"><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-indietro"></use></svg>Torna al ricamo</button>
          <span class="rg-tooltip rg-tooltip--below rg-tooltip--end"><button type="button" id="editorApplyBtn" class="rg-button rg-button--primary" aria-describedby="tip-apply">Ripeti nel ricamo</button><span class="rg-tooltip__text" role="tooltip" id="tip-apply">Il ricamo diventa il modulo ripetuto: i ritocchi fatti fuori dal modulo si perdono</span></span>
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
            <button type="button" class="rg-segmented__item" data-mode="cut" title="Salti (T)">Salti</button>
            <button type="button" class="rg-segmented__item" data-mode="image" hidden>Sposta immagine</button>
            <button type="button" class="rg-segmented__item" data-mode="order" hidden>Ordine pezzi</button>
            <button type="button" class="rg-segmented__item" data-mode="reroute" hidden>Ridisegna passaggio</button>
          </div>
          <div class="cs-editbar__group" id="moduleEditGroup" role="group" aria-labelledby="eb-mod" hidden><span class="rg-label" id="eb-mod">Modulo</span>
            <div class="rg-segmented" id="moduleViewSel" role="group" aria-label="Vista">
              <button type="button" class="rg-segmented__item" data-view="ricamo" aria-pressed="true">Ricamo</button>
              <button type="button" class="rg-segmented__item" data-view="modulo" aria-pressed="false">Modulo</button>
            </div>
            <label class="rg-toggle">
              <input type="checkbox" id="editAllCopies" checked><span class="rg-toggle__track"></span><span>Su tutte le copie</span>
            </label>
          </div>
          <div class="cs-editbar__group" id="moduleStartGroup" role="group" aria-labelledby="eb-start" hidden><span class="rg-label" id="eb-start">Inizio</span>
            <div class="rg-action-group" role="group" aria-label="Sposta l'inizio del modulo di una V">
              <span class="rg-tooltip rg-tooltip--below"><button type="button" class="rg-icon-button rg-icon-button--full" data-shift="left" aria-labelledby="tip-sh-l"><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-indietro"></use></svg></button><span class="rg-tooltip__text" role="tooltip" id="tip-sh-l">A sinistra</span></span>
              <span class="rg-tooltip rg-tooltip--below"><button type="button" class="rg-icon-button rg-icon-button--full" data-shift="right" aria-labelledby="tip-sh-r"><svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-avanti"></use></svg></button><span class="rg-tooltip__text" role="tooltip" id="tip-sh-r">A destra</span></span>
              <span class="rg-tooltip rg-tooltip--below"><button type="button" class="rg-icon-button rg-icon-button--full" data-shift="up" aria-labelledby="tip-sh-u"><svg class="rg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M12 20V5M6 11l6-6 6 6"/></svg></button><span class="rg-tooltip__text" role="tooltip" id="tip-sh-u">Su</span></span>
              <span class="rg-tooltip rg-tooltip--below"><button type="button" class="rg-icon-button rg-icon-button--full" data-shift="down" aria-labelledby="tip-sh-d"><svg class="rg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M12 4v15M6 13l6 6 6-6"/></svg></button><span class="rg-tooltip__text" role="tooltip" id="tip-sh-d">Giù</span></span>
            </div>
            <span class="rg-tooltip rg-tooltip--below rg-tooltip--end"><button type="button" id="seamBaseBtn" class="rg-button rg-button--outline rg-button--small" aria-describedby="tip-seam">Giunture sulla base</button><span class="rg-tooltip__text" role="tooltip" id="tip-seam">Sposta l'inizio perché i bordi del modulo cadano il più possibile sul colore di base</span></span>
          </div>
          <div class="cs-editbar__group" role="group" aria-labelledby="eb-area"><span class="rg-label" id="eb-area">Area</span>
            <span class="rg-tooltip rg-tooltip--below"><button type="button" id="areaBtn" class="rg-button rg-button--outline rg-button--small" aria-pressed="false" aria-describedby="tip-area">Area di prova</button><span class="rg-tooltip__text" role="tooltip" id="tip-area">Trascina un rettangolo: passaggi ed export solo lì, il disegno fuori resta</span></span>
            <button type="button" id="areaAllBtn" class="rg-button rg-button--ghost rg-button--small" hidden>Tutto il disegno</button>
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
          <label class="rg-toggle"><input type="checkbox" id="showGuide" checked><span class="rg-toggle__track"></span><span>Immagine</span></label>
          <label class="rg-toggle"><input type="checkbox" id="showOrder"><span class="rg-toggle__track"></span><span>Ordine</span></label>
          <span class="cs-scrub" id="orderScrub" hidden>
            <input type="range" class="cs-scrub__range" id="orderUpTo" min="0" max="1" step="1" value="1" aria-label="Mostra fino al punto" aria-describedby="orderNow">
            <output class="rg-mono cs-scrub__value" id="orderNow" for="orderUpTo">0 / 0</output>
            <span class="cs-order-legend" aria-hidden="true">prima<span class="cs-order-legend__steps"><i></i><i></i><i></i><i></i><i></i></span>dopo</span>
          </span>
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
          <span class="cs-legend__item"><svg viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" style="${CUT_STYLE}"/></svg>salto a mano</span>
        </span>
        <span class="cs-viewctl"><span id="zoom" class="rg-mono">zoom 100%</span><button type="button" id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button></span>
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
    area: null,
    cuts: [],
    module: null,
  };
  let mode: Mode = 'paint';
  let brushSize = 1;
  let brushStitch: BrushStitch = 'v';
  let activeThread = 0;
  let showPaths = true;
  /** La vista dell'ordine: i punti dal primo (azzurro) all'ultimo (nero), fino a orderUpTo. */
  let showOrder = false;
  let orderUpTo = Infinity;
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
  /** Si sta scegliendo l'area di prova (il prossimo trascinamento la disegna). */
  let areaPicking = false;
  let areaDrag: { a: { x: number; y: number }; b: { x: number; y: number } } | null = null;
  /** Dove stanno i passaggi calcolati: la griglia su cui sono fatti e lo spostamento per l'anteprima. */
  let routeGeom: { grid: GridSpec; dx: number; dy: number; i0: number; j0: number } = { grid: DEFAULT_GRID, dx: 0, dy: 0, i0: 0, j0: 0 };
  /** Il passaggio che si sta ridisegnando (vertici del modulo), e i suoi punti all'inizio (per Esc). */
  let reroute: { from: number; to: number; before: number[] } | null = null;
  /** Il vertice del reticolo della vista più vicino a un punto (mm). */
  function vertexNear(p: { x: number; y: number }): number {
    const g = routeGeom.grid, W = 2 * g.cols + 1, pa = rowPitch(g);
    p = { x: p.x - routeGeom.dx, y: p.y - routeGeom.dy };
    let best = -1, bd = Infinity;
    const i0 = Math.round(p.y / pa), j0 = Math.round(p.x / (g.cellW / 2));
    for (let i = i0 - 2; i <= i0 + 2; i++) for (let j = j0 - 2; j <= j0 + 2; j++) {
      if (i < 0 || i > g.rows || j < 0 || j > 2 * g.cols) continue;
      const v = i * W + j, q = segmentPoints(g, v, v)[0];
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function rerouteClick(p: { x: number; y: number }): void {
    const m = st.module;
    if (!m) return;
    if (!reroute) {
      const t = travelAt(p);
      if (!t) { $('status').textContent = 'Clicca sopra una linea di passaggio del modulo al centro.'; return; }
      const a = viewToMod(t.from), b = viewToMod(t.to);
      if (a < 0 || b < 0) { $('status').textContent = 'Il passaggio non è dentro il modulo al centro: cliccalo lì.'; return; }
      const f = (m.forced ?? []).find((q) => (q.from === a && q.to === b) || (q.from === b && q.to === a));
      reroute = { from: f ? f.from : a, to: f ? f.to : b, before: f ? [...f.via] : [] };
      update();
      return;
    }
    const v = viewToMod(vertexNear(p));
    if (v < 0) { $('status').textContent = 'Il punto deve stare nel modulo al centro.'; return; }
    pushUndo();
    const list = m.forced ?? [];
    const cur = list.find((q) => q.from === reroute!.from && q.to === reroute!.to);
    if (cur) cur.via.push(v); else list.push({ from: reroute.from, to: reroute.to, via: [v] });
    m.forced = list;
    if (editorSnap) editorSnap.changed = true;
    update();
  }
  function rerouteKey(k: string): boolean {
    const m = st.module;
    if (!reroute || !m) return false;
    const list = m.forced ?? [];
    const idx = list.findIndex((q) => q.from === reroute!.from && q.to === reroute!.to);
    if (k === 'Escape') { pushUndo(); if (idx >= 0) { if (reroute.before.length) list[idx].via = [...reroute.before]; else list.splice(idx, 1); } }
    else if (k === 'Delete' || k === 'Backspace') { pushUndo(); if (idx >= 0) list.splice(idx, 1); }
    else if (k !== 'Enter') return false;
    m.forced = list;
    reroute = null;
    update();
    return true;
  }
  /** Il pezzo che si sta disegnando (editor), e quanti pezzi si sono già messi in ordine (strumento Ordine pezzi). */
  let currentPiece = 0;
  let orderClicks = 0;
  /** Il trascinamento dell'immagine (strumento «Sposta immagine» dell'editor). */
  let imageDrag: { x0: number; y0: number; gx: number; gy: number } | null = null;
  /** Il gruppo evidenziato dalla lista (passandoci sopra col mouse). */
  let groupHover = -1;
  let result: RouteResult | null = null;
  let sourceName = '';
  const undo: Array<{ grid: GridSpec; cells: Cells; module?: KnitModule | null }> = [];
  const redo: Array<{ grid: GridSpec; cells: Cells; module?: KnitModule | null }> = [];

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
  /**
   * Cosa si passa al motore: tutto il disegno, o solo l'area di prova (una griglia a sé che parte
   * da 0; i gruppi, in mm, si spostano con lei).
   */
  /** Il modulo come percorso: pezzi e riga d'ingresso di ogni filo (il primo pezzo dice dove). */
  const modulePathOf = (m: KnitModule): ModulePath => ({ cols: m.cols, rows: m.rows, marks: m.marks, pieceOf: m.seq, entryRow: entryRows({ cols: m.cols, marks: m.marks, pieceOf: m.seq, starts: m.starts }), cuts: m.cuts, forced: m.forced });
  /** Il ricamo è proprio il modulo ripetuto (nessuna V ritoccata su una copia sola)? */
  const designIsTiled = (): boolean => {
    const m = st.module; if (!m) return false;
    const t = tileModule(st.grid, m);
    if (t.size !== st.cells.size) return false;
    for (const [k, v] of t) { const c = st.cells.get(k); if (!c || c.color !== v.color || c.stitch !== v.stitch) return false; }
    return true;
  };
  const routeInput = (cells: Cells = st.cells) => {
    const params = routeParams();
    // IL PERCORSO DEL MODULO RIPETUTO (strips.ts): con un modulo, senza gruppi a mano e senza area di
    // prova, ogni filo si calcola una volta sul modulo (ingresso a sinistra, uscita a destra alla stessa
    // altezza) e si ripete identico in ogni copia.
    if (st.module && !(params.groups && params.groups.length) && !clampArea(st.grid, st.area) && designIsTiled()) {
      params.modulePath = modulePathOf(st.module);
    }
    // COPIA PER COPIA (Lorenzo, 2026-10-01: i passaggi del modulo). Con un modulo, ogni striscia si
    // cuce una copia alla volta, da sinistra a destra: dopo 2-3 copie il motore ripete da solo lo
    // stesso giro in ogni copia (misurato sul Fair Isle: copie identiche fino al bordo). Costa +8%
    // di filo in vista sulla striscia libera. Se ci sono gruppi disegnati a mano, valgono quelli.
    if (st.module && !params.modulePath && !(params.groups && params.groups.length)) {
      const C = st.module.cols, n = Math.ceil(st.grid.cols / C), h = gridHeight(st.grid);
      params.groups = Array.from({ length: n }, (_, k) => ({ x: k * C * st.grid.cellW + 0.01, y: -1, w: C * st.grid.cellW - 0.02, h: h + 2 }));
    }
    const a = clampArea(st.grid, st.area);
    const toIndex = (grid: GridSpec, i0: number, j0: number) => (i: number, j: number) => {
      const ii = i - i0, jj = j - j0;
      return ii < 0 || ii > grid.rows || jj < 0 || jj > 2 * grid.cols ? -1 : ii * (2 * grid.cols + 1) + jj;
    };
    const withCuts = (grid: GridSpec, i0: number, j0: number) => {
      const ix = toIndex(grid, i0, j0);
      params.cuts = st.cuts.map(([i1, j1, i2, j2]) => [ix(i1, j1), ix(i2, j2)] as [number, number]).filter(([x, y]) => x >= 0 && y >= 0);
    };
    if (!a) { withCuts(st.grid, 0, 0); return { grid: st.grid, cells, params, dx: 0, dy: 0 }; }
    const sub = subGrid(st.grid, cells, a);
    if (params.groups) params.groups = params.groups.map((q) => ({ ...q, x: q.x - sub.dx, y: q.y - sub.dy }));
    withCuts(sub.grid, a.r0, 2 * a.c0);
    return { ...sub, params };
  };

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
  const CUT_PATH = { color: token('--rg-color-accent-blue', '#6f8fa6'), width: 2, dash: [6, 3] };
  /** Un colore dei token in [r, g, b] (il canvas normalizza il formato). */
  const rgbOf = (c: string): [number, number, number] => {
    const x = document.createElement('canvas').getContext('2d')!;
    x.fillStyle = '#000'; x.fillStyle = c;
    const v = String(x.fillStyle);
    if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
    const m = v.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const ORDER_FROM = rgbOf(token('--rg-color-accent-blue', '#8fb3cc'));
  const ORDER_TO = rgbOf(token('--rg-color-black', '#000000'));
  const orderColor = (t: number) => `rgb(${ORDER_FROM.map((a, i) => Math.round(a + (ORDER_TO[i] - a) * t)).join(',')})`;
  /** Il salto a mano (vertici del reticolo calcolato) come chiave. */
  const cutKeyOf = (from: number, to: number) => {
    const Wr = 2 * routeGeom.grid.cols + 1;
    const a = [Math.floor(from / Wr) + routeGeom.i0, (from % Wr) + routeGeom.j0], b = [Math.floor(to / Wr) + routeGeom.i0, (to % Wr) + routeGeom.j0];
    return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? `${a[0]},${a[1]},${b[0]},${b[1]}` : `${b[0]},${b[1]},${a[0]},${a[1]}`;
  };
  const cutKeyNorm = (i1: number, j1: number, i2: number, j2: number) => (i1 < i2 || (i1 === i2 && j1 <= j2) ? `${i1},${j1},${i2},${j2}` : `${i2},${j2},${i1},${j1}`);
  /** I salti a mano come chiavi; in vista modulo, riportati sul modulo al centro. */
  /** Un vertice del modulo (indice del suo reticolo) nella vista, sul modulo al centro, e ritorno. */
  const modToView = (v: number) => { const m = st.module!, Wm = 2 * m.cols + 1, Wv = 2 * (3 * m.cols) + 1; const i = Math.floor(v / Wm), j = v - i * Wm; return (i + m.rows) * Wv + j + 2 * m.cols; };
  const viewToMod = (v: number) => { const m = st.module!, Wm = 2 * m.cols + 1, Wv = 2 * (3 * m.cols) + 1; const i = Math.floor(v / Wv) - m.rows, j = v % Wv - 2 * m.cols; return i < 0 || i > m.rows || j < 0 || j > 2 * m.cols ? -1 : i * Wm + j; };
  const cutSet = () => {
    if (editorOpen && st.module) {
      const Wv = 2 * (3 * st.module.cols) + 1;
      return new Set((st.module.cuts ?? []).map(([a, b]) => { const va = modToView(a), vb = modToView(b); return cutKeyNorm(Math.floor(va / Wv), va % Wv, Math.floor(vb / Wv), vb % Wv); }));
    }
    if (moduleView && st.module) {
      const R = st.module.rows, C = st.module.cols;
      return new Set(st.cuts.map(([i1, j1, i2, j2]) => { const a = moduleRel(i1, j1, i2, j2); return cutKeyNorm(a[0] + R, a[1] + 2 * C, a[2] + R, a[3] + 2 * C); }));
    }
    return new Set(st.cuts.map(([i1, j1, i2, j2]) => cutKeyNorm(i1, j1, i2, j2)));
  };
  /** Un passaggio (vertici del ricamo) relativo alla sua copia del modulo: la copia del primo vertice. */
  const moduleRel = (i1: number, j1: number, i2: number, j2: number): [number, number, number, number] => {
    const R = st.module!.rows, C = st.module!.cols;
    const s0 = Math.floor(Math.min(i1, i2) / R), k0 = Math.floor(Math.min(j1, j2) / (2 * C));
    return [i1 - s0 * R, j1 - 2 * C * k0, i2 - s0 * R, j2 - 2 * C * k0];
  };
  /** Lo stesso passaggio (relativo al modulo) in ogni copia del ricamo vero. */
  const allCopiesOf = (rel: [number, number, number, number]): Array<[number, number, number, number]> => {
    const g0 = moduleView && realDesign ? realDesign.grid : st.grid;
    const R = st.module!.rows, C = st.module!.cols, out: Array<[number, number, number, number]> = [];
    for (let s0 = 0; s0 * R <= g0.rows; s0++) for (let k0 = 0; k0 * C <= g0.cols; k0++) {
      const q: [number, number, number, number] = [rel[0] + s0 * R, rel[1] + 2 * C * k0, rel[2] + s0 * R, rel[3] + 2 * C * k0];
      if (q[0] >= 0 && q[2] >= 0 && q[0] <= g0.rows && q[2] <= g0.rows && q[1] >= 0 && q[3] >= 0 && q[1] <= 2 * g0.cols && q[3] <= 2 * g0.cols) out.push(q);
    }
    return out;
  };

  /** La guida: il pezzo d'immagine del modulo, sopra i punti (Vista → Immagine). */
  let showGuide = true;
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
      // dall'originale a piena risoluzione (prima era la copia ridotta a 600 px per leggere i colori:
      // Lorenzo, 2026-10-01, «è sgranata e non è facile da capire»)
      if (source && !st.module) {
        const cr = crop ?? { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight };
        ctx.save();
        ctx.globalAlpha = imageOpacity;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source.img, cr.x, cr.y, cr.w, cr.h, X(0), Y(0), w * k, h * k);
        ctx.restore();
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
    const byOrder = showOrder && !!result;
    // la vista dell'ordine: i punti dal risultato, nel tempo; oltre il cursore in grigio chiaro
    let orderTotal = 0;
    if (byOrder) {
      for (const cr of result!.colors) if (!st.threads[cr.color]?.hidden) for (const sg of cr.segs) if (sg.kind === 'stitch') orderTotal++;
      const upTo = Math.min(orderUpTo, orderTotal);
      const BUCKETS = 48;
      const [lr, lg, lb] = rgbOf(token('--rg-color-neutral-400', '#9a9a94'));
      const later = `rgba(${lr},${lg},${lb},0.45)`;
      const done = token('--rg-color-neutral-100', '#efefec');
      // La scala colora solo il filo che si sta cucendo al cursore; i fili già finiti in grigio
      // medio, quelli da fare in grigio chiaro. Con una sola scala per tutto, la base (tre quarti
      // dei punti sul Dior) e il disegno sopra si confondevano.
      let n = 0;
      for (const cr of result!.colors) {
        if (st.threads[cr.color]?.hidden) continue;
        let total = 0;
        for (const sg of cr.segs) if (sg.kind === 'stitch') total++;
        const start = n;
        const state = upTo >= start + total ? (upTo === orderTotal && start + total === orderTotal ? 'active' : 'done') : upTo > start ? 'active' : 'later';
        const paths: Path2D[] = Array.from({ length: BUCKETS + 1 }, () => new Path2D());
        let nc = 0;
        for (const sg of cr.segs) {
          if (sg.kind !== 'stitch') continue;
          const [pa, pb] = segmentPoints(routeGeom.grid, sg.from, sg.to);
          const b = state === 'active' && n < upTo ? Math.min(BUCKETS - 1, Math.floor((nc / Math.max(1, total - 1)) * BUCKETS)) : BUCKETS;
          paths[b].moveTo(X(pa.x + routeGeom.dx), Y(pa.y + routeGeom.dy));
          paths[b].lineTo(X(pb.x + routeGeom.dx), Y(pb.y + routeGeom.dy));
          n++; nc++;
        }
        ctx.lineWidth = threadWidth(cr.color) * k;
        ctx.strokeStyle = state === 'done' ? done : later;
        ctx.stroke(paths[BUCKETS]);
        for (let b = 0; b < BUCKETS; b++) { ctx.strokeStyle = orderColor(b / (BUCKETS - 1)); ctx.stroke(paths[b]); }
      }
    }
    if (!byOrder && base) strokeLegs(base.color, (fn) => { for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) fn(r, c, base.stitch); });
    const byColor = new Map<number, number[]>();
    for (const [key, mark] of st.cells) {
      if (base && mark.color === base.color) continue; // già coperta dalla base
      const list = byColor.get(mark.color);
      if (list) list.push(key); else byColor.set(mark.color, [key]);
    }
    if (!byOrder) for (const ci of [...byColor.keys()].sort((x, y) => x - y)) {
      strokeLegs(ci, (fn) => { for (const key of byColor.get(ci)!) { const r = Math.floor(key / g.cols); fn(r, key - r * g.cols, st.cells.get(key)!.stitch); } });
    }
    // LA GUIDA DEL MODULO (Lorenzo: «metto un'immagine sotto… disegno colore per colore il modulo»):
    // il pezzo d'immagine del modulo stirato su ogni copia, SOPRA i punti a metà trasparenza (sotto,
    // un modulo pieno di V la copriva tutta). Mentre si sceglie il ritaglio: l'immagine intera.
    if (source && st.module) {
      ctx.save();
      ctx.beginPath(); ctx.rect(X(0), Y(0), w * k, h * k); ctx.clip();
      ctx.imageSmoothingQuality = 'high';
      if (cropping) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(source.img, X(0), Y(0), w * k, h * k);
      } else if (showGuide && st.module.guide) {
        const gd = st.module.guide, pa = rowPitch(g);
        const mw = st.module.cols * g.cellW, mh = st.module.rows * pa;
        ctx.globalAlpha = imageOpacity > 0 ? imageOpacity : 0.5;
        for (let y0 = 0; y0 < h; y0 += mh) for (let x0 = 0; x0 < w; x0 += mw) ctx.drawImage(source.img, gd.x, gd.y, gd.w, gd.h, X(x0), Y(y0), mw * k, mh * k);
      }
      ctx.restore();
    }
    // fuori dall'area di prova il disegno resta, velato
    const area = moduleView && st.module
      ? { r0: st.module.rows, c0: st.module.cols, r1: st.module.rows * 2, c1: st.module.cols * 2 }
      : clampArea(g, st.area);
    if (area) {
      const pa = rowPitch(g);
      const ax0 = area.c0 * g.cellW, ax1 = area.c1 * g.cellW, ay0 = area.r0 * pa, ay1 = (area.r1 - 1) * pa + g.cellH;
      ctx.save();
      ctx.globalAlpha = moduleView ? 0.45 : 0.72; // in vista modulo le copie vicine si devono leggere: si vedono le giunture
      ctx.fillStyle = BG;
      ctx.beginPath();
      ctx.rect(X(0), Y(0), w * k, h * k);
      ctx.rect(X(ax0), Y(ay0), (ax1 - ax0) * k, (ay1 - ay0) * k);
      ctx.fill('evenodd');
      ctx.restore();
    }
    // i passaggi (dei fili accesi), con la larghezza fissa sullo schermo
    const rg0 = routeGeom.grid, odx = routeGeom.dx, ody = routeGeom.dy;
    const cutsNow = cutSet();
    if (showPaths && result) {
      for (const kind of ['jump', 'cut', 'hidden', 'retrace', 'vertical', 'visible'] as const) {
        const style = kind === 'cut' ? CUT_PATH : PATH_STYLE[kind];
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width * screenPx;
        ctx.setLineDash(style.dash.map((d) => d * screenPx));
        ctx.beginPath();
        let n = 0;
        const upTo = byOrder ? Math.min(orderUpTo, orderTotal) : Infinity;
        for (const cr of result.colors) {
          if (st.threads[cr.color]?.hidden) continue;
          for (const sg of cr.segs) {
            if (sg.kind === 'stitch') { n++; continue; }
            if (n >= upTo) continue;
            const isCut = sg.kind === 'jump' && cutsNow.has(cutKeyOf(sg.from, sg.to));
            if (kind === 'cut' ? !isCut : sg.kind !== kind || isCut) continue;
            const [pa, pb] = segmentPoints(rg0, sg.from, sg.to);
            ctx.moveTo(X(pa.x + odx), Y(pa.y + ody));
            ctx.lineTo(X(pb.x + odx), Y(pb.y + ody));
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // dove parte ogni filo
      for (const cr of result.colors) {
        const first = cr.segs[0];
        if (!first || st.threads[cr.color]?.hidden) continue;
        const p = segmentPoints(rg0, first.from, first.to)[0];
        ctx.beginPath();
        ctx.arc(X(p.x + odx), Y(p.y + ody), Math.min(g.cellW, g.cellH) * 0.18 * k, 0, Math.PI * 2);
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

    if (area) {
      const pa = rowPitch(g);
      overlay.insertAdjacentHTML('beforeend', `<rect x="${f(area.c0 * g.cellW)}" y="${f(area.r0 * pa)}" width="${f((area.c1 - area.c0) * g.cellW)}" height="${f((area.r1 - 1 - area.r0) * pa + g.cellH)}" fill="none" style="stroke:var(--rg-color-focus)" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`);
    }
    if (!moduleView) drawGroups();
    drawAreaDrag();
    $('orderScrub').hidden = !showOrder;
    if (showOrder) {
      const range = $<HTMLInputElement>('orderUpTo');
      range.max = String(orderTotal);
      const v = Math.min(orderUpTo, orderTotal);
      range.value = String(v);
      $('orderNow').textContent = `${v} / ${orderTotal}`;
    }
    $('cutCount').textContent = String(st.cuts.length);
    $<HTMLButtonElement>('cutClear').disabled = !st.cuts.length;
    $('formatInfo').textContent = `Griglia: ${st.grid.cols} colonne × ${st.grid.rows} righe, un punto per cella · il ricamo esce ${fmtNum(w)} × ${fmtNum(h)} mm (le celle sono intere)`
      + (area ? ` · area di prova ${area.c1 - area.c0} × ${area.r1 - area.r0} celle, ${fmtNum(Math.round(subGrid(g, new Map(), area).grid.cols * g.cellW))} × ${fmtNum(Math.round(gridHeight(subGrid(g, new Map(), area).grid)))} mm: passaggi ed export solo lì` : '');
    $('areaAllBtn').hidden = !area || moduleView;
    drawEditorMarks();
    if (moduleView && st.module) $('formatInfo').textContent = `Vista modulo: ${st.module.cols} × ${st.module.rows} V al centro, intorno le copie vicine. Ogni modifica vale su tutto il ricamo.`;
    showStatus();
  }

  /** I numeri dei passaggi nella barra di stato (o che si stanno calcolando). */
  function showStatus(): void {
    if (editorOpen && st.module && reroute) { $('status').textContent = `Ridisegni un passaggio (filo in vista ${Math.round(editorVisible)} mm per modulo): clicca i punti da cui deve passare, in ordine. Invio finisce, Esc toglie i punti messi, Canc rimette il passaggio automatico.`; return; }
    if (editorOpen && st.module) { const g0 = realGrid(); const nP = piecesOf(st.module, activeThread).length; $('status').textContent = `Modulo ${st.module.cols} × ${st.module.rows} V · ${fmtNum(Math.round(st.module.cols * g0.cellW))} × ${fmtNum(Math.round(st.module.rows * rowPitch(g0)))} mm · filo in vista ${Math.round(editorVisible)} mm per modulo · filo scelto: ${nP} pezz${nP === 1 ? 'o' : 'i'}; pieno = ingresso, anello = dove finire`; return; }
    if (routing) { $('status').textContent = 'Calcolo dei passaggi…'; return; }
    if (moduleView) { $('status').textContent = moduleCopyNote; return; }
    if (!result) return;
    const m = result.metrics;
    if (!m.legs) { $('status').textContent = 'Griglia vuota: disegna con il clic.'; return; }
    const mm = (x: number) => `${Math.round(x)} mm`;
    const nStrips = st.route.strips ? stripRanges(routeGeom.grid, st.route.strips.rows).length : 0;
    const stops = result.colors.length;
    $('status').textContent = (nStrips > 1 ? `${nStrips} strisce, ${stops} stop · ` : '') + `${m.legs} diagonali · passaggi in vista ${mm(m.visibleMm)} · ripassi ${mm(m.retraceMm)} · vertice-vertice ${mm(m.verticalMm)} · nascosti ${mm(m.hiddenMm)} · ${m.jumps} salt${m.jumps === 1 ? 'o' : 'i'}`;
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
      lastReal = result ? { result, geom: { ...requestGeom } } : null; // la geometria della richiesta, non quella di adesso
      if (editorOpen) { editorRoute(); draw(); return; } // nell'editor vale il percorso del modulo
      if (moduleView) showModulePasses();
      draw();
    };
  } catch { worker = null; /* senza worker si calcola qui, come prima */ }

  function recompute(): void {
    routeRequest++;
    // in vista modulo si calcola il ricamo vero (il modulo ripetuto), non la vista
    const saved = moduleView && realDesign && st.module ? { grid: st.grid, cells: st.cells } : null;
    if (saved) { st.grid = realDesign!.grid; st.cells = tileModule(realDesign!.grid, st.module!); }
    const inp = routeInput();
    if (saved) { st.grid = saved.grid; st.cells = saved.cells; }
    const ar = clampArea(st.grid, st.area);
    routeGeom = { grid: inp.grid, dx: inp.dx, dy: inp.dy, i0: ar ? ar.r0 : 0, j0: ar ? 2 * ar.c0 : 0 };
    requestGeom = { ...routeGeom };
    if (worker) {
      routing = true;
      worker.postMessage({ id: routeRequest, grid: inp.grid, cells: inp.cells, params: inp.params });
      return;
    }
    try {
      result = routeAll(inp.grid, inp.cells, inp.params);
      lastReal = { result, geom: { ...requestGeom } };
      if (moduleView) showModulePasses();
    } catch (e) {
      result = null;
      $('status').textContent = 'Errore nei passaggi: ' + (e as Error).message;
      console.error(e);
    }
  }

  /** Ricalcola e ridisegna: i punti subito, i passaggi quando il worker ha finito. */
  function update(): void {
    if (editorOpen) { editorRoute(); draw(); return; } // nell'editor: solo il modulo, pochi millesimi
    if (moduleView) { result = null; recompute(); draw(); return; }
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
    num('stripRows').value = String(st.route.strips?.rows ?? 0);
    num('stripShift').value = fmtNum(st.route.strips?.shiftMm ?? 0);
    num('stripShift').disabled = !st.route.strips;
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
    const rt = st.route.costs?.retrace ?? RETRACE_PRESETS.vista;
    mark('#retraceSel .rg-segmented__item', (b) => RETRACE_PRESETS[b.dataset.retrace as RetracePreset] === rt);
    $('modeHelp').textContent = MODE_HELP[mode];
    const cv = root.querySelector('#canvas');
    if (cv) for (const m of ['pan', 'paint', 'fill', 'erase', 'group', 'cut']) cv.classList.toggle('cs-mode-' + m, m === mode);
    for (const id of ['sizeSel', 'stitchSel', 'editThreads']) root.querySelectorAll<HTMLButtonElement>('#' + id + ' button').forEach((b) => { b.disabled = mode === 'group' || mode === 'cut'; });
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
    if (moduleView) exitModuleView();
    const id = (ev?.target as HTMLElement | undefined)?.id;
    const w = Math.max(1, readNum('sizeW') || target.w);
    let h = Math.max(1, readNum('sizeH') || target.h);
    if (id !== 'sizeH') h = ratioHeight(w);
    else if (image) $<HTMLInputElement>('keepRatio').checked = false; // l'altezza scritta a mano sblocca la proporzione
    target = { w, h };
    const next = gridForSize(w, h, readNum('cellW') || st.grid.cellW, readNum('cellH') || st.grid.cellH, readNum('overlap') || 0);
    pushUndo();
    if (st.module) st.cells = tileModule(next, st.module);
    else if (image && fromImage) st.cells = knitFromImage(next, image.px, threadRgb(), knitOpts());
    else st.cells = resizeCells(st.grid, next, st.cells);
    st.grid = next;
    st.area = clampArea(st.grid, st.area);
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
  const setStrips = () => {
    const rows = Math.max(0, Math.round(readNum('stripRows') || 0));
    const shiftMm = Number.isFinite(readNum('stripShift')) ? readNum('stripShift') : 0;
    st.route.strips = rows > 0 ? { rows, shiftMm } : null;
    syncFields(); update();
  };
  num('stripRows').addEventListener('change', setStrips);
  num('stripShift').addEventListener('change', setStrips);
  $<HTMLInputElement>('fixedDir').addEventListener('change', (e) => { st.route.fixedDirection = (e.target as HTMLInputElement).checked; update(); });
  $<HTMLInputElement>('showPaths').addEventListener('change', (e) => { showPaths = (e.target as HTMLInputElement).checked; draw(); });
  $<HTMLInputElement>('showGuide').addEventListener('change', (e) => { showGuide = (e.target as HTMLInputElement).checked; draw(); });
  $<HTMLInputElement>('showOrder').addEventListener('change', (e) => { showOrder = (e.target as HTMLInputElement).checked; orderUpTo = Infinity; draw(); });
  $<HTMLInputElement>('orderUpTo').addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const v = Number(el.value);
    orderUpTo = v >= Number(el.max) ? Infinity : v;
    draw();
  });
  $('cutClear').addEventListener('click', () => {
    const n = st.cuts.length;
    if (!n || !window.confirm(n === 1 ? 'Togliere il salto a mano?' : `Togliere tutti i ${n} salti a mano?`)) return;
    st.cuts = [];
    update();
  });
  $<HTMLInputElement>('showGrid').addEventListener('change', (e) => { showGrid = (e.target as HTMLInputElement).checked; draw(); });

  const setMode = (m: Mode) => {
    mode = m;
    if (m === 'order') orderClicks = 0;
    if (m !== 'reroute') reroute = null;
    // senza passaggi visibili non c'è niente da cliccare
    if (m === 'cut' && !showPaths) { showPaths = true; $<HTMLInputElement>('showPaths').checked = true; draw(); }
    syncSegmented(); hideBrush(); drawGroups();
  };
  root.querySelectorAll<HTMLButtonElement>('#modeSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as Mode)));
  root.querySelectorAll<HTMLButtonElement>('#sizeSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => { brushSize = Number(b.dataset.size) || 1; syncSegmented(); }));
  root.querySelectorAll<HTMLButtonElement>('#retraceSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    st.route.costs = { ...(st.route.costs ?? {}), retrace: RETRACE_PRESETS[b.dataset.retrace as RetracePreset] };
    syncSegmented(); update();
  }));
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
      b.addEventListener('click', () => { activeThread = i; orderClicks = 0; buildThreads(); if (editorOpen) draw(); if (mode === 'pan' || mode === 'erase') setMode('paint'); });
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
  /** Cosa salva l'Annulla: il ricamo vero (in vista modulo è da parte), e il modulo. */
  const snapshot = () => (moduleView && realDesign && st.module
    ? { grid: { ...realDesign.grid }, cells: tileModule(realDesign.grid, st.module), module: cloneModule(st.module) }
    : { grid: { ...st.grid }, cells: cloneCells(st.cells), module: cloneModule(st.module) });
  const cloneModule = (m: KnitModule | null): KnitModule | null => (m ? { cols: m.cols, rows: m.rows, marks: m.marks.map((x) => (x ? { ...x } : null)), guide: m.guide ? { ...m.guide } : m.guide, drawn: m.drawn, seq: m.seq ? [...m.seq] : m.seq, starts: m.starts ? { ...m.starts } : m.starts, cuts: m.cuts ? m.cuts.map((q) => [q[0], q[1]] as [number, number]) : m.cuts, forced: m.forced ? m.forced.map((q) => ({ from: q.from, to: q.to, via: [...q.via] })) : m.forced } : null);
  function pushUndo(): void {
    undo.push(snapshot());
    if (undo.length > 100) undo.shift();
    redo.length = 0;
  }
  function restore(snap: { grid: GridSpec; cells: Cells; module?: KnitModule | null }): void {
    st.grid = snap.grid;
    st.cells = snap.cells;
    if (snap.module !== undefined) { st.module = snap.module; syncModuleUI(); }
    if (moduleView) {
      // in vista modulo: il ricamo vero torna da parte, la tela si rifà dal modulo
      if (!st.module) { moduleView = false; syncModuleUI(); }
      else { realDesign = { grid: snap.grid, cells: snap.cells }; st.grid = viewGridOf(snap.grid, st.module); st.cells = tileModule(st.grid, st.module); draw(); return; }
    }
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    update();
  }
  function doUndo(): void {
    const prev = undo.pop();
    if (!prev) return;
    redo.push(snapshot());
    restore(prev);
  }
  function doRedo(): void {
    const next = redo.pop();
    if (!next) return;
    undo.push(snapshot());
    restore(next);
  }
  $('undoBtn').addEventListener('click', doUndo);
  $('redoBtn').addEventListener('click', doRedo);
  $('clearBtn').addEventListener('click', () => {
    if (moduleView) exitModuleView();
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
    if (!at || mode === 'pan' || mode === 'group' || mode === 'cut' || cropping) { rect?.remove(); return; }
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

  /** Le modifiche a mano: con un modulo e «Su tutte le copie», in ogni copia (e nel modulo). */
  function applyUserEdits(edits: CellEdit[]): boolean {
    if (editorSnap) editorSnap.changed = true;
    const all = st.module && (moduleView || $<HTMLInputElement>('editAllCopies').checked);
    return applyEdits(st.grid, st.cells, all ? editsOnAllCopies(st.grid, st.module!, edits, editorOpen ? currentPiece : 0) : edits);
  }

  /** Il pennello (o la gomma) su una cella; vero se ha cambiato qualcosa. */
  function paintCell(r: number, c: number): boolean {
    if (!painting) return false;
    const key = r * st.grid.cols + c; // una cella = un punto
    if (key === painting.last) return false;
    painting.last = key;
    return applyUserEdits(brushEdits(st.grid, st.cells, r, c, brushSize, activeThread, brushStitch, painting.button, painting.erase));
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
    if (areaPicking) {
      const p = mmAt(e);
      if (!p || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const { w, h } = sizeMm();
      const cl = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      areaDrag = { a: cl, b: cl };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
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
    if (mode === 'reroute') {
      const p = mmAt(e);
      if (!p || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      rerouteClick(p);
      return;
    }
    if (mode === 'cut') {
      const p = mmAt(e);
      if (!p || e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      toggleCutAt(p);
      return;
    }
    if (mode === 'image') {
      const p = mmAt(e);
      if (!p || e.button !== 0 || !st.module?.guide) return;
      e.stopPropagation(); e.preventDefault();
      pushUndo();
      imageDrag = { x0: p.x, y0: p.y, gx: st.module.guide.x, gy: st.module.guide.y };
      $('canvas').classList.add('is-dragging');
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
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
    if (mode === 'order' && st.module) {
      // il pezzo cliccato diventa il prossimo nell'ordine del suo filo
      const m = st.module, idx = (((at.r % m.rows) + m.rows) % m.rows) * m.cols + (((at.c % m.cols) + m.cols) % m.cols);
      const mk = m.marks[idx];
      if (!mk || !(m.seq?.[idx] ?? 0)) { $('status').textContent = 'Qui non c’è un pezzo disegnato: clicca una V disegnata col pennello o col riempi.'; return; }
      if (mk.color !== activeThread) { activeThread = mk.color; orderClicks = 0; buildThreads(); }
      pushUndo();
      orderClicks++;
      movePiece(m, idx, orderClicks);
      if (editorSnap) editorSnap.changed = true;
      update();
      return;
    }
    // nell'editor ogni tratto (pennello, riempi) è un pezzo nuovo, cucito dopo i precedenti
    if (editorOpen && st.module) currentPiece = (mode === 'erase' || e.shiftKey) ? 0 : Math.max(0, ...(st.module.seq ?? [0])) + 1;
    if (mode === 'fill') {
      const edits = fillEdits(st.grid, st.cells, at.r, at.c, activeThread, brushStitch, button, e.shiftKey);
      if (!edits.length) return;
      pushUndo();
      applyUserEdits(edits);
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
    if (areaDrag) {
      e.stopPropagation();
      const p = mmAt(e);
      if (!p) return;
      const { w, h } = sizeMm();
      areaDrag.b = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      drawAreaDrag();
      return;
    }
    if (cropDrag) {
      e.stopPropagation();
      const p = mmAt(e);
      if (!p) return;
      const { w, h } = sizeMm();
      cropDrag.b = { x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) };
      drawCropRect(cropDrag.a, cropDrag.b);
      return;
    }
    if (imageDrag && st.module?.guide) {
      e.stopPropagation();
      const p = mmAt(e);
      if (!p) return;
      const g0 = realGrid(), m = st.module, gd = m.guide!;
      // un mm di trascinamento = quanti px d'immagine (la guida è stirata su un modulo)
      const kx = gd.w / (m.cols * g0.cellW), ky = gd.h / (m.rows * rowPitch(g0));
      gd.x = imageDrag.gx - (p.x - imageDrag.x0) * kx;
      gd.y = imageDrag.gy - (p.y - imageDrag.y0) * ky;
      syncEditorFields();
      draw();
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
    if (areaDrag) {
      e.stopPropagation();
      const d = areaDrag;
      areaDrag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const a = areaFromMm(st.grid, d.a.x, d.a.y, d.b.x, d.b.y);
      setAreaPicking(false);
      if (a) { st.area = a; update(); } else draw();
      return;
    }
    if (cropDrag) {
      e.stopPropagation();
      const d = cropDrag;
      cropDrag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      finishCrop(d.a, d.b);
      return;
    }
    if (imageDrag) {
      e.stopPropagation();
      imageDrag = null;
      $('canvas').classList.remove('is-dragging');
      if (editorSnap) editorSnap.changed = true;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
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
    if (mode === 'reroute' && rerouteKey(e.key)) { e.preventDefault(); return; }
    if (k === 'b') setMode('paint');
    else if (k === 'f') setMode('fill');
    else if (k === 'e') setMode('erase');
    else if (k === 'h') setMode('pan');
    else if (k === 'g') setMode('group');
    else if (k === 't') setMode('cut');
    else if (k === 'm' && editorOpen) setMode('image');
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
    if (editorOpen && st.module) {
      const full = { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight };
      const pitch = rowPitch(realGrid());
      const vpx = full.w / st.module.cols;
      st.module.guide = { x: 0, y: 0, w: full.w, h: vpx * (pitch / realGrid().cellW) * st.module.rows };
      $('edImageInfo').textContent = `${source.name}: ${full.w} × ${full.h} px. Aggancia l'immagine alla griglia (campi qui sotto o «Sposta immagine»), oppure «Trova da solo».`;
      refreshEditorView();
      return;
    }
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
    if (cropping && areaPicking) setAreaPicking(false);
    const b = $('cropBtn');
    b.setAttribute('aria-pressed', cropping ? 'true' : 'false');
    b.classList.toggle('rg-button--primary', cropping);
    b.classList.toggle('rg-button--outline', !cropping);
    canvas.classList.toggle('cs-crop', cropping);
    if (cropping) $('imageStatus').textContent = st.module
      ? 'Trascina un rettangolo sull’immagine intera: diventa la guida del modulo (il modulo resta com’è).'
      : 'Trascina un rettangolo sul disegno: la maglia si rifà su quel pezzo.';
  }
  $('cropBtn').addEventListener('click', () => {
    if (!image) { $('imageStatus').textContent = 'Carica prima un’immagine.'; return; }
    setCropping(!cropping);
  });
  $('uncropBtn').addEventListener('click', () => {
    if (source && st.module) { pushUndo(); crop = null; st.module.guide = { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight }; setCropping(false); draw(); return; }
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
        + `<span class="rg-list-row__actions">`
        + (i > 0 ? `<span class="rg-tooltip rg-tooltip--end"><button type="button" class="rg-icon-button" data-up aria-labelledby="tip-gup-${i}">`
          + '<svg class="rg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M12 20V5M6 11l6-6 6 6"/></svg></button>'
          + `<span class="rg-tooltip__text" role="tooltip" id="tip-gup-${i}">Cuci prima il gruppo ${i + 1}</span></span>` : '')
        + `<span class="rg-tooltip rg-tooltip--end"><button type="button" class="rg-icon-button rg-icon-button--danger" data-del aria-labelledby="tip-gdel-${i}">`
        + `<svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-elimina"></use></svg></button>`
        + `<span class="rg-tooltip__text" role="tooltip" id="tip-gdel-${i}">Elimina Gruppo ${i + 1}</span></span></span></div>`;
      li.addEventListener('mouseenter', () => { groupHover = i; drawGroups(); });
      li.addEventListener('mouseleave', () => { groupHover = -1; drawGroups(); });
      li.querySelector('[data-up]')?.addEventListener('click', () => {
        const next = [...groups];
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
        st.route.groups = next;
        groupHover = -1;
        buildGroups();
        update();
      });
      li.querySelector('[data-del]')!.addEventListener('click', () => {
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

  /**
   * Il passaggio (o il salto a mano) più vicino al clic, entro 8 px sullo schermo: un passaggio
   * diventa salto, un salto a mano torna passaggio.
   */
  /** Il passaggio (o salto a mano) più vicino al clic, entro 8 px: i vertici che collega (reticolo di routeGeom). */
  function travelAt(p: { x: number; y: number }): { from: number; to: number; key: string } | null {
    if (!result) return null;
    const { w } = sizeMm();
    const pxPerMm = ($('layer').querySelector('svg')!.getBoundingClientRect().width || 1) / (w + 2 * margin());
    const tol = 8 / pxPerMm;
    const cuts = cutSet();
    const dSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
      const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
      return Math.hypot(a.x + t * vx - p.x, a.y + t * vy - p.y);
    };
    let best: { from: number; to: number; key: string; d: number } | null = null;
    for (const cr of result.colors) {
      if (st.threads[cr.color]?.hidden) continue;
      const segs = cr.segs;
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].kind === 'stitch') continue;
        let j = i, d = Infinity;
        if (segs[i].kind === 'jump') { j = i + 1; if (!cuts.has(cutKeyOf(segs[i].from, segs[i].to))) continue; }
        else while (j < segs.length && segs[j].kind !== 'stitch' && segs[j].kind !== 'jump') j++;
        for (let q = i; q < j; q++) {
          const [a, b] = segmentPoints(routeGeom.grid, segs[q].from, segs[q].to);
          d = Math.min(d, dSeg({ x: a.x + routeGeom.dx, y: a.y + routeGeom.dy }, { x: b.x + routeGeom.dx, y: b.y + routeGeom.dy }));
        }
        if (d <= tol && (!best || d < best.d)) best = { from: segs[i].from, to: segs[j - 1].to, key: cutKeyOf(segs[i].from, segs[j - 1].to), d };
        i = j - 1;
      }
    }
    return best;
  }
  function toggleCutAt(p: { x: number; y: number }): void {
    if (!result) return;
    // nell'editor: il salto è del modulo (vale in ogni copia, è nel percorso del modulo)
    if (editorOpen && st.module) {
      const t = travelAt(p);
      if (!t) { $('status').textContent = 'Nessun passaggio qui: clicca sopra una linea di passaggio.'; return; }
      const a = viewToMod(t.from), b = viewToMod(t.to);
      if (a < 0 || b < 0) { $('status').textContent = 'Il passaggio non è dentro il modulo al centro: cliccalo lì.'; return; }
      pushUndo();
      const m = st.module, list = m.cuts ?? [];
      const same = (q: [number, number]) => (q[0] === a && q[1] === b) || (q[0] === b && q[1] === a);
      m.cuts = list.some(same) ? list.filter((q) => !same(q)) : [...list, [a, b]];
      if (editorSnap) editorSnap.changed = true;
      update();
      return;
    }
    const { w } = sizeMm();
    const pxPerMm = ($('layer').querySelector('svg')!.getBoundingClientRect().width || 1) / (w + 2 * margin());
    const tol = 8 / pxPerMm;
    const cuts = cutSet();
    const dSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
      const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
      return Math.hypot(a.x + t * vx - p.x, a.y + t * vy - p.y);
    };
    let best: { key: string; d: number } | null = null;
    for (const cr of result.colors) {
      if (st.threads[cr.color]?.hidden) continue;
      const segs = cr.segs;
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].kind === 'stitch') continue;
        let j = i, d = Infinity;
        if (segs[i].kind === 'jump') {
          j = i + 1;
          const key = cutKeyOf(segs[i].from, segs[i].to);
          if (!cuts.has(key)) { continue; } // i salti automatici non si toccano
        } else while (j < segs.length && segs[j].kind !== 'stitch' && segs[j].kind !== 'jump') j++;
        for (let q = i; q < j; q++) {
          const [a, b] = segmentPoints(routeGeom.grid, segs[q].from, segs[q].to);
          d = Math.min(d, dSeg({ x: a.x + routeGeom.dx, y: a.y + routeGeom.dy }, { x: b.x + routeGeom.dx, y: b.y + routeGeom.dy }));
        }
        const key = cutKeyOf(segs[i].from, segs[j - 1].to);
        if (d <= tol && (!best || d < best.d)) best = { key, d };
        i = j - 1;
      }
    }
    if (!best) { $('status').textContent = 'Nessun passaggio qui: clicca sopra una linea di passaggio.'; return; }
    const [i1, j1, i2, j2] = best.key.split(',').map(Number);
    const had = cuts.has(best.key);
    if (st.module && (moduleView || $<HTMLInputElement>('editAllCopies').checked)) {
      // con un modulo il salto vale in ogni copia: si toglie o si mette in tutte
      const R = st.module.rows, C = st.module.cols;
      const rel: [number, number, number, number] = moduleView ? [i1 - R, j1 - 2 * C, i2 - R, j2 - 2 * C] : moduleRel(i1, j1, i2, j2);
      const keys = new Set(allCopiesOf(rel).map((q) => cutKeyNorm(...q)));
      st.cuts = had ? st.cuts.filter((c) => !keys.has(cutKeyOf2(c))) : [...st.cuts.filter((c) => !keys.has(cutKeyOf2(c))), ...allCopiesOf(rel)];
    } else {
      st.cuts = had
        ? st.cuts.filter((c) => cutKeyOf2(c) !== best!.key)
        : [...st.cuts, [i1, j1, i2, j2]];
    }
    update();
  }
  const cutKeyOf2 = ([i1, j1, i2, j2]: [number, number, number, number]) => (i1 < i2 || (i1 === i2 && j1 <= j2) ? `${i1},${j1},${i2},${j2}` : `${i2},${j2},${i1},${j1}`);

  /** Il rettangolo dell'area che si sta tirando. */
  function drawAreaDrag(): void {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    svg.querySelector('#cs-area-drag')?.remove();
    if (!areaDrag) return;
    const d = areaDrag;
    const rc = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rc.id = 'cs-area-drag';
    rc.setAttribute('x', String(Math.min(d.a.x, d.b.x))); rc.setAttribute('y', String(Math.min(d.a.y, d.b.y)));
    rc.setAttribute('width', String(Math.abs(d.b.x - d.a.x))); rc.setAttribute('height', String(Math.abs(d.b.y - d.a.y)));
    rc.setAttribute('vector-effect', 'non-scaling-stroke');
    rc.setAttribute('pointer-events', 'none');
    rc.setAttribute('style', 'fill:none;stroke:var(--rg-color-focus);stroke-width:2');
    svg.appendChild(rc);
  }
  function setAreaPicking(on: boolean): void {
    areaPicking = on;
    if (on) setCropping(false);
    const b = $('areaBtn');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('rg-button--primary', on);
    b.classList.toggle('rg-button--outline', !on);
    canvas.classList.toggle('cs-crop', on || cropping);
    if (on) $('status').textContent = 'Trascina un rettangolo sul disegno: passaggi ed export solo lì, il resto rimane.';
  }
  $('areaBtn').addEventListener('click', () => setAreaPicking(!areaPicking));
  $('areaAllBtn').addEventListener('click', () => { st.area = null; setAreaPicking(false); update(); });

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
    // Con un modulo il ritaglio è la GUIDA: si sceglie sull'immagine intera e cambia solo lei, il
    // modulo resta (Lorenzo: «devo poter cambiare anche il ritaglio se vedo che è necessario»).
    if (st.module) {
      const full = { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight };
      crop = { x: full.x + fx0 * full.w, y: full.y + fy0 * full.h, w: (fx1 - fx0) * full.w, h: (fy1 - fy0) * full.h };
      pushUndo();
      st.module.guide = { ...crop };
      // un modulo disegnato ancora vuoto (tutto base) prende le proporzioni del ritaglio nuovo
      if (st.module.drawn && st.module.marks.every((m) => m && m.color === 0)) {
        const rows = Math.max(2, Math.round(st.module.cols * (crop.h / crop.w) * (st.grid.cellW / rowPitch(moduleView && realDesign ? realDesign.grid : st.grid))));
        if (rows !== st.module.rows) {
          st.module = resizeModule(st.module, st.module.cols, rows, { stitch: 'v', color: 0 });
          st.route.strips = { rows, shiftMm: st.route.strips?.shiftMm ?? 0 };
          if (moduleView && realDesign) st.grid = viewGridOf(realDesign.grid, st.module);
          syncModuleUI();
          setCropping(false);
          moduleChanged();
          $('imageStatus').textContent = `Guida del modulo: il pezzo ${Math.round(crop.w)} × ${Math.round(crop.h)} px dell’immagine; il modulo vuoto ora è ${st.module.cols} × ${rows} V.`;
          $('moduleInfo').textContent = newModuleInfo(st.module.cols, rows);
          return;
        }
      }
      setCropping(false);
      $('imageStatus').textContent = `Guida del modulo: il pezzo ${Math.round(crop.w)} × ${Math.round(crop.h)} px dell’immagine, stirato su ogni copia.`;
      draw();
      return;
    }
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
    if (moduleView) exitModuleView();
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

  // ---- ricava modulo (module.ts) ----------------------------------------------
  // ---- la VISTA MODULO (Lorenzo, 2026-10-01: «un editor del modulo… si riverbera su tutto») ----
  // La tela mostra il modulo al centro con le 8 copie vicine velate (le giunture si vedono). Il
  // ricamo vero resta da parte in `realDesign` e si rifà dal modulo quando si torna al Ricamo.
  let moduleView = false;
  /** L'ultimo calcolo dei passaggi sul ricamo vero, con la sua geometria. */
  let lastReal: { result: RouteResult; geom: typeof routeGeom } | null = null;
  let moduleCopyNote = '';
  /** La geometria del ricamo per cui è stato chiesto l'ultimo calcolo (in vista modulo routeGeom è quella della vista). */
  let requestGeom: typeof routeGeom = { grid: DEFAULT_GRID, dx: 0, dy: 0, i0: 0, j0: 0 };
  /** In vista modulo: quale copia del ricamo si mostra al centro (colonna di copie, striscia 0). */
  let shownCopy = -1;
  /**
   * I passaggi del modulo, in vista modulo: quelli di una copia «a regime» del ricamo vero (la
   * terza, se ce ne sono almeno 4: le prime si assestano, l'ultima tocca il bordo), della prima
   * striscia, riportati sul modulo al centro.
   */
  function showModulePasses(): void {
    if (!moduleView || !st.module || !realDesign || !lastReal || editorOpen) { result = null; return; } // nell'editor niente passaggi (sarebbero vecchi)
    const m = st.module, rg = realDesign.grid, geom = lastReal.geom;
    const R = m.rows, C = m.cols;
    const full = Math.floor(rg.cols / C);
    if (rg.rows < R || full < 1 || geom.grid.cols !== rg.cols || geom.i0 !== 0) { result = null; moduleCopyNote = 'Vista modulo: i passaggi si vedono con almeno un modulo intero nel ricamo (e senza area di prova).'; return; }
    const kc = full >= 4 ? 2 : Math.max(0, full - 2);
    shownCopy = kc;
    const Wr = 2 * rg.cols + 1, Wv = 2 * (3 * C) + 1;
    const toView = (v: number) => { const i = Math.floor(v / Wr), j = v % Wr; return (i + R) * Wv + (j - 2 * C * kc + 2 * C); };
    const copyOf = (sg: { from: number; to: number }) => Math.floor(Math.min(sg.from % Wr, sg.to % Wr) / 2 / C);
    const rowOf = (sg: { from: number; to: number }) => Math.min(Math.floor(sg.from / Wr), Math.floor(sg.to / Wr));
    const colors: RouteResult['colors'] = [];
    for (const cr of lastReal.result.colors) {
      if ((cr.strip ?? 0) !== 0) continue;
      const segs: RouteSeg[] = []; let pend: RouteSeg[] = [];
      for (const sg of cr.segs) {
        if (sg.kind !== 'stitch') { pend.push(sg); continue; }
        if (copyOf(sg) === kc && rowOf(sg) < R) for (const t of [...pend, sg]) segs.push({ kind: t.kind, from: toView(t.from), to: toView(t.to) });
        pend = [];
      }
      if (segs.length) colors.push({ color: cr.color, segs });
    }
    result = { colors, metrics: { ...lastReal.result.metrics } };
    routeGeom = { grid: st.grid, dx: 0, dy: 0, i0: 0, j0: 0 };
    moduleCopyNote = `Vista modulo: i passaggi di una copia del ricamo (la ${kc + 1}ª della prima striscia). I salti messi qui valgono su tutte le copie.`;
  }
  let realDesign: { grid: GridSpec; cells: Cells } | null = null;
  const viewGridOf = (g: GridSpec, m: KnitModule): GridSpec => ({ ...g, cols: m.cols * 3, rows: m.rows * 3 });
  function enterModuleView(): void {
    if (!st.module || moduleView) return;
    realDesign = { grid: st.grid, cells: st.cells };
    st.grid = viewGridOf(st.grid, st.module);
    st.cells = tileModule(st.grid, st.module);
    moduleView = true;
    result = null;
    showModulePasses();
    if (mode === 'group') setMode('paint');
    if (areaPicking) setAreaPicking(false);
    syncModuleUI();
    draw();
    showStatus();
    requestAnimationFrame(() => pz.fit());
  }
  function exitModuleView(): void {
    if (!moduleView) return;
    moduleView = false;
    st.grid = realDesign!.grid;
    st.cells = st.module ? tileModule(st.grid, st.module) : realDesign!.cells;
    realDesign = null;
    syncModuleUI();
    update();
    requestAnimationFrame(() => pz.fit());
  }
  /** Il modulo è cambiato (spostato): la tela si rifà. */
  function moduleChanged(): void {
    if (!st.module) return;
    if (moduleView) { st.cells = tileModule(st.grid, st.module); update(); } // update in vista: ricalcola il ricamo vero
    else { st.cells = tileModule(st.grid, st.module); update(); }
  }
  root.querySelectorAll<HTMLButtonElement>('#moduleViewSel .rg-segmented__item').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.view === 'modulo') enterModuleView(); else exitModuleView();
  }));
  /** La guida spostata col modulo resta dentro l'immagine: un periodo più in là il motivo è uguale. */
  function wrapGuide(): void {
    const gd = st.module?.guide;
    if (!gd || !source) return;
    const W0 = source.img.naturalWidth, H0 = source.img.naturalHeight;
    while (gd.x + gd.w > W0 + 0.5 && gd.x - gd.w >= -0.5) gd.x -= gd.w;
    while (gd.x < -0.5 && gd.x + 2 * gd.w <= W0 + 0.5) gd.x += gd.w;
    while (gd.y + gd.h > H0 + 0.5 && gd.y - gd.h >= -0.5) gd.y -= gd.h;
    while (gd.y < -0.5 && gd.y + 2 * gd.h <= H0 + 0.5) gd.y += gd.h;
  }
  root.querySelectorAll<HTMLButtonElement>('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    if (!st.module) return;
    pushUndo();
    const d = b.dataset.shift;
    // «a sinistra»: il disegno scorre a sinistra di una V (l'inizio va una V più a destra)
    st.module = shiftModule(st.module, d === 'up' ? 1 : d === 'down' ? -1 : 0, d === 'left' ? 1 : d === 'right' ? -1 : 0);
    wrapGuide();
    moduleChanged();
  }));
  $('seamBaseBtn').addEventListener('click', () => {
    if (!st.module) return;
    const sh = seamShift(st.module, st.route.base?.color ?? 0);
    pushUndo();
    st.module = shiftModule(st.module, sh.dr, sh.dc);
    wrapGuide();
    moduleChanged();
    $('status').textContent = `Giunture: la verticale taglia ${sh.cutCols} V del disegno, l'orizzontale ${sh.cutRows}`
      + (sh.cutCols || sh.cutRows ? ' (meno di così non si può: i motivi attraversano tutto il modulo).' : '.');
  });

  /** Le V del motivo nell'immagine per V del modulo (2 se il modulo è metà del motivo): per le correzioni a mano. */
  let moduleFactor = { c: 1, r: 1 };
  function syncModuleUI(): void {
    const m = st.module;
    $('moduleBox').hidden = !m;
    $('moduleEditGroup').hidden = !m;
    $('moduleStartGroup').hidden = !m || !moduleView;
    root.querySelectorAll<HTMLButtonElement>('#moduleViewSel .rg-segmented__item').forEach((b) => {
      const on = (b.dataset.view === 'modulo') === moduleView;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const all = $<HTMLInputElement>('editAllCopies');
    if (moduleView) all.checked = true;
    all.disabled = moduleView;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="group"]')!.disabled = moduleView;
    $<HTMLButtonElement>('areaBtn').disabled = moduleView;
    if (!m) { $('moduleInfo').hidden = true; return; }
    if (editorOpen) syncEditorFields();
  }
  /** I pixel dell'originale a piena risoluzione (ritagliato se c'è un ritaglio): le V possono essere di 6 px. */
  function sourcePixels(maxSide = 2000): (Pixels & { scale: number; cr: { x: number; y: number; w: number; h: number } }) | null {
    if (!source) return null;
    const { img } = source;
    const cr = crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const scale = Math.min(1, maxSide / Math.max(cr.w, cr.h));
    const cnv = document.createElement('canvas');
    cnv.width = Math.max(1, Math.round(cr.w * scale)); cnv.height = Math.max(1, Math.round(cr.h * scale));
    const ctx = cnv.getContext('2d')!;
    ctx.drawImage(img, cr.x, cr.y, cr.w, cr.h, 0, 0, cnv.width, cnv.height);
    const d = ctx.getImageData(0, 0, cnv.width, cnv.height);
    return { rgba: d.data, width: cnv.width, height: cnv.height, scale, cr };
  }
  function runModule(force?: { cols: number; rows: number }): void {
    if (moduleView && !editorOpen) exitModuleView();
    const px = sourcePixels();
    if (!px) { $('imageStatus').textContent = 'Carica prima un’immagine.'; return; }
    const info = editorOpen ? $('edImageInfo') : $('moduleInfo');
    info.hidden = false;
    info.textContent = 'Cerco il modulo… (qualche secondo)';
    $<HTMLButtonElement>('edFindBtn').disabled = true;
    window.setTimeout(() => {
      const found = findModule(px, { colors: 7, cols: force?.cols, rows: force?.rows });
      moduleFactor = { c: found.imageCells.cols / found.cols, r: found.imageCells.rows / found.rows };
      pushUndo();
      const stitch = knit.stitch === 'cross' || knit.stitch === 'down' || knit.stitch === 'up' || knit.stitch === 'lambda' ? knit.stitch : 'v';
      const gp = found.guidePx;
      st.module = { cols: found.cols, rows: found.rows, marks: found.map.map((k) => ({ stitch, color: k })), guide: { x: px.cr.x + gp.x / px.scale, y: px.cr.y + gp.y / px.scale, w: gp.w / px.scale, h: gp.h / px.scale }, drawn: false };
      st.threads = found.palette.map((hex, i) => ({ hex, passes: passesOf(i) }));
      st.route.base = { color: 0, stitch: 'v' };
      st.route.strips = { rows: found.rows, shiftMm: st.route.strips?.shiftMm ?? 0 };
      const rgrid = realGrid();
      fromImage = false;
      $<HTMLButtonElement>('edFindBtn').disabled = false;
      const rx = (rgrid.cols / found.cols), ry = (rgrid.rows / found.rows);
      const fmt1 = (v: number) => fmtNum(Math.round(v * 10) / 10);
      info.textContent = `Modulo ${found.cols} × ${found.rows} V (nell'immagine il motivo è ${found.imageCells.cols} × ${found.imageCells.rows} V, ${found.periodPx.w} × ${found.periodPx.h} px), ripetuto ${fmt1(rx)} × ${fmt1(ry)}; ${found.palette.length} fili, base il più diffuso`
        + (found.removed ? `; tolt${found.removed === 1 ? 'o 1 colore' : `i ${found.removed} colori`} di bordo` : '')
        + `. Strisce di ${found.rows} righe.`;
      buildThreads();
      syncFields();
      syncModuleUI();
      if (editorOpen) refreshEditorView();
      else { st.cells = tileModule(st.grid, st.module); update(); }
    }, 30);
  }
  $('edFindBtn').addEventListener('click', () => runModule());

  /**
   * NUOVO MODULO (Lorenzo, 2026-10-01: «costruire un modulo da zero. Metto un'immagine sotto…
   * disegno colore per colore il modulo e poi lo facciamo ripetere»). Un modulo tutto base; la guida è
   * il ritaglio (o l'immagine intera). Le colonne: quelle del modulo di prima, o 24; le righe dalle
   * proporzioni del ritaglio e della cella. I fili proposti dai colori del ritaglio.
   */
  const newModuleInfo = (cols: number, rows: number) => `Modulo nuovo ${cols} × ${rows} V: disegnalo in vista Modulo, con l'immagine sopra come guida (Vista → Immagine). Colonne e righe si cambiano qui sotto; con Ritaglia cambi la guida.`;
  /** I colori dei fili dal pezzo d'immagine del modulo: la base è il più diffuso, poi dal chiaro allo scuro. */
  function paletteFromGuide(): void {
    if (!source) return;
    const gd = st.module?.guide;
    const saved = crop;
    if (gd) crop = { x: Math.max(0, gd.x), y: Math.max(0, gd.y), w: Math.min(gd.w, source.img.naturalWidth - Math.max(0, gd.x)), h: Math.min(gd.h, source.img.naturalHeight - Math.max(0, gd.y)) };
    const px = sourcePixels(600)!;
    crop = saved;
    const pal = refinePalette(px, medianCutPalette(px.rgba, null, Math.max(st.threads.length, 6)));
    if (!pal.length) return;
    const sh = paletteShares(px, pal);
    const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const baseK = pal.map((_, k2) => k2).sort((a, b) => sh[b] - sh[a])[0];
    const order = [baseK, ...pal.map((_, k2) => k2).filter((k2) => k2 !== baseK).sort((a, b) => lum(pal[b]) - lum(pal[a]))];
    st.threads = order.map((k2, i) => ({ hex: rgbToHex(pal[k2]), passes: passesOf(i) }));
  }
  /** Un modulo nuovo, tutto base, agganciato all'immagine intera (o al ritaglio). */
  function newModule(): void {
    const pitch = rowPitch(realGrid());
    const cr = source ? (crop ?? { x: 0, y: 0, w: source.img.naturalWidth, h: source.img.naturalHeight }) : null;
    const cols = st.module?.cols ?? 24;
    const rows = cr ? Math.max(2, Math.round(cols * (cr.h / cr.w) * (realGrid().cellW / pitch))) : cols;
    if (cr) {
      const px = sourcePixels(600)!;
      const pal = refinePalette(px, medianCutPalette(px.rgba, null, Math.max(st.threads.length, 6)));
      if (pal.length) {
        const sh = paletteShares(px, pal);
        const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
        const baseK = pal.map((_, k2) => k2).sort((a, b) => sh[b] - sh[a])[0];
        const order = [baseK, ...pal.map((_, k2) => k2).filter((k2) => k2 !== baseK).sort((a, b) => lum(pal[b]) - lum(pal[a]))];
        st.threads = order.map((k2, i) => ({ hex: rgbToHex(pal[k2]), passes: passesOf(i) }));
      }
    }
    st.module = { cols, rows, marks: Array.from({ length: cols * rows }, () => ({ stitch: 'v' as const, color: 0 })), guide: cr ? { ...cr } : null, drawn: true };
    st.route.base = { color: 0, stitch: 'v' };
    st.route.strips = { rows, shiftMm: st.route.strips?.shiftMm ?? 0 };
    fromImage = false;
    showGuide = true; $<HTMLInputElement>('showGuide').checked = true;
    const info = $('moduleInfo');
    info.hidden = false;
    info.textContent = newModuleInfo(cols, rows);
  }
  // ---- L'EDITOR DEL MODULO (Lorenzo, 2026-10-02: «schermata a sé»; «da un'immagine e dalla griglia
  // che io voglio ottenere dovrei poter facilmente scegliere il ritaglio… ancorato alla griglia»; e
  // «molto lento e poco chiaro»). Riusa la vista Modulo (tela, strumenti, fili); il pannello mostra
  // Immagine e Griglia del modulo; NON si calcolano i passaggi (il calcolo sul ricamo intero, quasi un
  // secondo a ogni tocco, era la lentezza). L'immagine si aggancia alla griglia: quanti px è una V, una
  // riga, e dove comincia il modulo — campi o trascinando con «Sposta immagine».
  let editorOpen = false;
  /** Nell'editor: il percorso del modulo (sul modulo solo) riportato sul modulo al centro della vista. */
  let editorEntry: Record<number, number> = {};
  let editorVisible = 0;
  function editorRoute(): void {
    const m = st.module;
    if (!m || !moduleView) { result = null; return; }
    const mp = modulePathOf(m);
    editorEntry = mp.entryRow;
    let res: RouteResult;
    try { res = routeModule(realGrid(), mp, routeParams()); } catch { result = null; return; }
    const R = m.rows, C = m.cols, Wm = 2 * C + 1, Wv = 2 * (3 * C) + 1;
    const toView = (v: number) => { const i = Math.floor(v / Wm), j = v - i * Wm; return (i + R) * Wv + j + 2 * C; };
    result = { colors: res.colors.map((cr) => ({ color: cr.color, segs: cr.segs.map((sg) => ({ kind: sg.kind, from: toView(sg.from), to: toView(sg.to) })) })), metrics: res.metrics };
    editorVisible = res.metrics.visibleMm;
    routeGeom = { grid: st.grid, dx: 0, dy: 0, i0: 0, j0: 0 };
  }
  /** I segni dell'editor per il filo scelto: ingresso (pieno) a sinistra, arrivo (anello) a destra, numeri dei pezzi. */
  function drawEditorMarks(): void {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    svg.querySelector('#cs-ed-marks')?.remove();
    const m = st.module;
    if (!editorOpen || !m) return;
    const g = st.grid, pa = rowPitch(g), R = m.rows, C = m.cols;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.id = 'cs-ed-marks';
    layer.setAttribute('pointer-events', 'none');
    const col = st.threads[activeThread]?.hex ?? '#000';
    const rad = Math.max(g.cellW, pa) * 0.9;
    const row = editorEntry[activeThread];
    if (row !== undefined) {
      const y = (R + row) * pa; // il vertice in alto della riga d'ingresso
      const x0 = C * g.cellW, x1 = 2 * C * g.cellW;
      layer.insertAdjacentHTML('beforeend',
        `<circle cx="${x0}" cy="${y}" r="${rad}" fill="${col}" style="stroke:var(--rg-color-white)" stroke-width="2" vector-effect="non-scaling-stroke"/>`
        + `<circle cx="${x1}" cy="${y}" r="${rad * 1.3}" fill="none" style="stroke:var(--rg-color-focus)" stroke-width="3" vector-effect="non-scaling-stroke"/>`
        + `<circle cx="${x1}" cy="${y}" r="${rad * 0.45}" fill="${col}"/>`);
    }
    const fs = Math.max(3, g.cellW * 1.6);
    for (const pc of piecesOf(m, activeThread)) {
      if (pc.start < 0) continue;
      const r0 = Math.floor(pc.start / C) + R, c0 = (pc.start % C) + C;
      const x = (c0 + 0.5) * g.cellW, y = r0 * pa + g.cellH / 2;
      layer.insertAdjacentHTML('beforeend', `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--rg-color-black);font-family:var(--rg-font-mono);paint-order:stroke;stroke:var(--rg-color-white);stroke-width:3px;stroke-linejoin:round">${pc.position}</text>`);
    }
    if (reroute) {
      const pts = [reroute.from, ...((m.forced ?? []).find((q) => q.from === reroute!.from && q.to === reroute!.to)?.via ?? []), reroute.to];
      const xy = pts.map((v) => segmentPoints(g, modToView(v), modToView(v))[0]);
      layer.insertAdjacentHTML('beforeend', xy.map((q, n) => `<circle cx="${q.x}" cy="${q.y}" r="${rad * (n === 0 || n === xy.length - 1 ? 0.8 : 0.55)}" fill="${n === 0 || n === xy.length - 1 ? 'none' : 'var(--rg-color-focus)'}" style="stroke:var(--rg-color-focus)" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join(''));
    }
    svg.appendChild(layer);
  }
  let editorSnap: { grid: GridSpec; cells: Cells; module: KnitModule | null; threads: Thread[]; route: RouteParams; changed: boolean } | null = null;
  const realGrid = (): GridSpec => (moduleView && realDesign ? realDesign.grid : st.grid);
  /** La tela dell'editor rifatta dal modulo (dopo un cambio di misure, di griglia, di modulo). */
  function refreshEditorView(): void {
    if (!st.module) return;
    if (!moduleView) { enterModuleView(); return; }
    st.grid = viewGridOf(realDesign!.grid, st.module);
    st.cells = tileModule(st.grid, st.module);
    syncEditorFields();
    update();
    if (editorSnap) editorSnap.changed = true;
  }
  function syncEditorFields(): void {
    const g = realGrid(), m = st.module;
    num('edCellW').value = fmtNum(g.cellW); num('edCellH').value = fmtNum(g.cellH); num('edOverlap').value = fmtNum(g.overlapPct ?? 0);
    num('edOpacity').value = String(Math.round((imageOpacity > 0 ? imageOpacity : 0.5) * 100));
    $('edFindWrap').hidden = !source;
    $<HTMLButtonElement>('edPaletteBtn').hidden = !source;
    if (!m) return;
    num('edCols').value = String(m.cols); num('edRows').value = String(m.rows);
    const gd = m.guide;
    for (const id of ['edVpx', 'edRowPx', 'edX', 'edY']) num(id).disabled = !gd;
    if (gd) {
      const r1 = (v: number) => fmtNum(Math.round(v * 100) / 100);
      num('edVpx').value = r1(gd.w / m.cols); num('edRowPx').value = r1(gd.h / m.rows); num('edX').value = r1(gd.x); num('edY').value = r1(gd.y);
    }
  }
  function openEditor(): void {
    if (editorOpen) return;
    editorSnap = { grid: { ...st.grid }, cells: cloneCells(st.cells), module: cloneModule(st.module), threads: st.threads.map((t) => ({ ...t })), route: JSON.parse(JSON.stringify(st.route)), changed: false };
    editorOpen = true;
    if (!st.module) { newModule(); buildThreads(); syncFields(); }
    for (const id of ['sec-immagine', 'sec-misure', 'sec-passaggi', 'sec-macchina', 'sec-carica']) $(id).hidden = true;
    for (const id of ['ed-immagine', 'ed-griglia']) $(id).hidden = false;
    $('stageTitle').textContent = 'Modulo';
    $('stageActions').hidden = true; $('editorActions').hidden = false;
    document.title = 'Modulo · Cross-Stitch';
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="image"]')!.hidden = false;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="order"]')!.hidden = false;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="group"]')!.hidden = true;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="reroute"]')!.hidden = false;
    $('moduleViewSel').hidden = true;
    $('areaBtn').closest('.cs-editbar__group')!.setAttribute('hidden', '');

    showGrid = true; $<HTMLInputElement>('showGrid').checked = true;
    showGuide = true; $<HTMLInputElement>('showGuide').checked = true;
    if (imageOpacity <= 0) imageOpacity = 0.5;
    enterModuleView();
    setMode('paint');
    syncEditorFields();
    update();
    $('stageTitle').focus();
  }
  function closeEditor(apply: boolean): void {
    if (!editorOpen) return;
    if (!apply && editorSnap?.changed && !window.confirm('Le modifiche fatte al modulo si perdono. Tornare al ricamo?')) return;
    editorOpen = false;
    for (const id of ['sec-immagine', 'sec-misure', 'sec-passaggi', 'sec-macchina', 'sec-carica']) $(id).hidden = false;
    for (const id of ['ed-immagine', 'ed-griglia']) $(id).hidden = true;
    $('stageTitle').textContent = 'Disegno';
    $('stageActions').hidden = false; $('editorActions').hidden = true;
    document.title = 'Cross-Stitch — RG Tools';
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="image"]')!.hidden = true;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="order"]')!.hidden = true;
    root.querySelector<HTMLButtonElement>('#modeSel [data-mode="reroute"]')!.hidden = true;
    for (const sel of ['[data-mode="group"]', '[data-mode="cut"]']) root.querySelector<HTMLButtonElement>('#modeSel ' + sel)!.hidden = false;
    $('moduleViewSel').hidden = false;
    $('areaBtn').closest('.cs-editbar__group')!.removeAttribute('hidden');

    if (mode === 'image' || mode === 'order' || mode === 'reroute') setMode('paint');
    if (apply) { exitModuleView(); }
    else if (editorSnap) {
      // si torna com'era all'apertura
      moduleView = false; realDesign = null;
      st.grid = editorSnap.grid; st.cells = editorSnap.cells; st.module = editorSnap.module; st.threads = editorSnap.threads; st.route = editorSnap.route;
      syncFields(); buildThreads(); syncModuleUI(); update();
      requestAnimationFrame(() => pz.fit());
    }
    editorSnap = null;
    syncModuleUI();
    $('editorBtn').focus();
  }
  $('editorBtn').addEventListener('click', openEditor);
  $('editorApplyBtn').addEventListener('click', () => closeEditor(true));
  $('editorCancelBtn').addEventListener('click', () => closeEditor(false));
  $('edLoadBtn').addEventListener('click', () => $<HTMLInputElement>('imageInput').click());
  $('edPaletteBtn').addEventListener('click', () => { pushUndo(); paletteFromGuide(); buildThreads(); refreshEditorView(); });
  num('edOpacity').addEventListener('change', () => { imageOpacity = Math.min(100, Math.max(5, readNum('edOpacity') || 50)) / 100; num('imageOpacity').value = String(Math.round(imageOpacity * 100)); draw(); });
  // la griglia: celle (il ricamo vero si rifà alle stesse misure) e misura del modulo (si allarga, il disegno resta)
  const edCells = () => {
    const g0 = realGrid();
    const cw = readNum('edCellW') || g0.cellW, chh = readNum('edCellH') || g0.cellH, ov = Number.isFinite(readNum('edOverlap')) ? readNum('edOverlap') : (g0.overlapPct ?? 0);
    pushUndo();
    const next = gridForSize(target.w, target.h, cw, chh, ov);
    if (moduleView && realDesign) realDesign.grid = next; else st.grid = next;
    num('cellW').value = fmtNum(cw); num('cellH').value = fmtNum(chh); num('overlap').value = fmtNum(ov);
    refreshEditorView();
  };
  for (const id of ['edCellW', 'edCellH', 'edOverlap']) num(id).addEventListener('change', edCells);
  const edSize = () => {
    if (!st.module) return;
    const c = Math.max(2, Math.round(readNum('edCols') || st.module.cols)), rr = Math.max(2, Math.round(readNum('edRows') || st.module.rows));
    if (c === st.module.cols && rr === st.module.rows) return;
    pushUndo();
    // l'immagine resta agganciata: stessa misura di una V, il pezzo cresce con il modulo
    const gd = st.module.guide;
    const vpx = gd ? gd.w / st.module.cols : 0, rpx = gd ? gd.h / st.module.rows : 0;
    st.module = resizeModule(st.module, c, rr, { stitch: 'v', color: 0 });
    if (gd && st.module.guide) st.module.guide = { ...st.module.guide, w: vpx * c, h: rpx * rr };
    st.route.strips = { rows: rr, shiftMm: st.route.strips?.shiftMm ?? 0 };
    refreshEditorView();
  };
  num('edCols').addEventListener('change', edSize);
  num('edRows').addEventListener('change', edSize);
  const edAnchor = () => {
    const m = st.module, gd = m?.guide;
    if (!m || !gd) return;
    pushUndo();
    const vpx = readNum('edVpx'), rpx = readNum('edRowPx'), x = readNum('edX'), y = readNum('edY');
    m.guide = { x: Number.isFinite(x) ? x : gd.x, y: Number.isFinite(y) ? y : gd.y, w: (vpx > 0 ? vpx : gd.w / m.cols) * m.cols, h: (rpx > 0 ? rpx : gd.h / m.rows) * m.rows };
    refreshEditorView();
  };
  for (const id of ['edVpx', 'edRowPx', 'edX', 'edY']) num(id).addEventListener('change', edAnchor);
  $('moduleOffBtn').addEventListener('click', () => { if (moduleView) exitModuleView(); pushUndo(); st.module = null; syncModuleUI(); knitNow(); });
  $('removeImageBtn').addEventListener('click', () => { image = null; source = null; crop = null; setCropping(false); fromImage = false; $('imageStatus').textContent = 'Nessuna immagine.'; draw(); });

  // ---- progetto: riapertura (R27) ---------------------------------------------
  function projectMetadata(): Record<string, unknown> {
    return {
      rgProject: 'cross-stitch',
      version: VERSION,
      grid: moduleView && realDesign ? realDesign.grid : st.grid,
      threads: st.threads,
      route: st.route,
      stitch: st.stitch,
      area: st.area,
      cuts: st.cuts,
      module: st.module,
      knit,
      cells: moduleView && realDesign && st.module ? cellsToJson(realDesign.grid, tileModule(realDesign.grid, st.module)) : cellsToJson(st.grid, st.cells),
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
    st.area = clampArea(st.grid, meta.area as Partial<TestArea> | null);
    {
      const m = meta.module as KnitModule | null | undefined;
      st.module = m && Number.isInteger(m.cols) && Number.isInteger(m.rows) && Array.isArray(m.marks) && m.marks.length === m.cols * m.rows
        ? { cols: m.cols, rows: m.rows, marks: m.marks.map((x) => (x && typeof x === 'object' ? { stitch: x.stitch, color: Number(x.color) } : null)),
          guide: m.guide && typeof m.guide === 'object' && [m.guide.x, m.guide.y, m.guide.w, m.guide.h].every((v) => Number.isFinite(Number(v))) ? { x: Number(m.guide.x), y: Number(m.guide.y), w: Number(m.guide.w), h: Number(m.guide.h) } : null,
          drawn: !!m.drawn,
          seq: Array.isArray(m.seq) && m.seq.length === m.cols * m.rows ? m.seq.map((v) => Math.max(0, Math.round(Number(v) || 0))) : undefined,
          starts: m.starts && typeof m.starts === 'object' ? Object.fromEntries(Object.entries(m.starts).map(([k, v]) => [Number(k), Number(v)])) : undefined,
          cuts: Array.isArray(m.cuts) ? m.cuts.filter((q) => Array.isArray(q) && q.length === 2).map((q) => [Number(q[0]), Number(q[1])] as [number, number]) : undefined,
          forced: Array.isArray(m.forced) ? m.forced.filter((q) => q && Array.isArray(q.via)).map((q) => ({ from: Number(q.from), to: Number(q.to), via: q.via.map(Number) })) : undefined }
        : null;
    }
    st.cuts = Array.isArray(meta.cuts) ? (meta.cuts as unknown[]).filter((c): c is [number, number, number, number] => Array.isArray(c) && c.length === 4 && c.every((x) => Number.isInteger(x))) : [];
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
    if (moduleView) { moduleView = false; realDesign = null; }
    target = { w: st.grid.cols * st.grid.cellW, h: gridHeight(st.grid) };
    syncFields();
    buildThreads();
    buildGroups();
    syncModuleUI();
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
    if (moduleView) exitModuleView(); // si esporta sempre il ricamo, non la vista del modulo
    const on = (color: number) => !st.threads[color]?.hidden;
    const cells: Cells = new Map([...st.cells].filter(([, m]) => on(m.color)));
    const inp = routeInput(cells);
    if (inp.params.base && !on(inp.params.base.color)) inp.params.base = null;
    const res = routeAll(inp.grid, inp.cells, inp.params);
    // la compensazione del ritiro: la striscia k scende (o sale) di k × shiftMm
    const shift = inp.params.strips?.shiftMm ?? 0;
    return res.colors.map((cr) => {
      const dy = (cr.strip ?? 0) * shift;
      const polylines = colorPolylines(inp.grid, cr, st.stitch).map((pl) => (dy ? pl.map((q) => ({ x: q.x, y: q.y + dy })) : pl));
      return {
        id: cr.strip === undefined ? `filo-${cr.color + 1}` : `striscia-${cr.strip + 1}-filo-${cr.color + 1}`,
        color: st.threads[cr.color]?.hex ?? '#000000',
        polylines,
        strokeMm: threadWidth(cr.color),
      };
    });
  }

  $('exportBtn').addEventListener('click', async () => {
    const layers = exportLayers();
    if (!layers.length) { $('status').textContent = 'Niente da esportare: la griglia è vuota o gli stop sono spenti.'; return; }
    const a = clampArea(st.grid, st.area);
    const eg = a ? subGrid(st.grid, new Map(), a).grid : st.grid;
    const w = eg.cols * eg.cellW, h = gridHeight(eg);
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

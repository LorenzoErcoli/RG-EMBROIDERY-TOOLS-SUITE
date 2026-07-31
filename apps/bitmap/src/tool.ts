import '@rg/ui/rg.css';
import './bitmap.css';
import { buildSvg, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { runBitmapPipeline, runBitmapPreview, type BitmapPreviewColor } from './pipeline';
import { defaultBitmapParams, type BitmapParams } from './engine';
import { sampleImage, type PixelImage } from './sample';

/** Sorgente pixel: la demo o un'immagine decodificata, rasterizzabile alla larghezza voluta. */
interface Source {
  name: string;
  pixelsAt: (maxWidthPx: number) => PixelImage;
}

// Campi numerici cablati genericamente: id nel DOM ↔ chiave del parametro. Unità nello slot (mai nell'etichetta).
interface NumBind { id: string; key: keyof BitmapParams; int?: boolean; min?: number; max?: number; }

// Icona contagocce (pipette, stile Lucide) per il bottone "campiona" delle righe-colore manuali.
const EYEDROPPER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>'
  + '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

export function mountBitmap(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Bitmap → Stitch', opts.backHref)}
  <div class="rg-workspace bitmap-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif,.svg,.dst" />
              <span class="rg-button rg-button--outline">Carica un'immagine…</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus" role="status">Nessun file: uso l'immagine demo.</p>
          </div>
          <label class="rg-field">
            <span class="rg-field__label">Larghezza reale (0 = auto)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidth" type="number" min="0" step="1"><span>mm</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">DPI di stima</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="dpiEstimate" type="number" min="1" step="1"><span>dpi</span></span>
          </label>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Risoluzione di lavoro</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxWidthPx" type="number" min="0" step="50"><span>px</span></span>
            <small class="rg-field__help">l'immagine viene ridotta a questa larghezza per la resa (0 = nativa); più bassa = più veloce</small>
          </label>
          <div class="rg-cluster rg-param-grid__wide"><button id="sampleBtn" class="rg-button rg-button--ghost" type="button">Immagine demo</button></div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Selezione dei pixel</h3></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Cosa punciare</span>
            <div><div class="rg-segmented" id="coverageMode" role="group" aria-label="Cosa punciare">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-coverage="selected" aria-pressed="true">Solo i colori scelti</button>
              <button type="button" class="rg-segmented__item" data-coverage="all" aria-pressed="false">Tutta l'immagine</button>
            </div></div>
            <small class="rg-field__help">Solo i colori scelti: in automatico usa la soglia, in manuale i pixel vicini ai colori scelti. Tutta l'immagine: riempie tutto, ogni pixel col colore più vicino.</small>
          </div>
          <label class="rg-field rg-param-grid__wide" id="thresholdField">
            <span class="rg-field__label">Soglia di selezione</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="threshold" type="number" min="0" max="255" step="5"><span>lum</span></span>
            <small class="rg-field__help">un pixel è scelto se più scuro della soglia (0–255); più alta = include più pixel chiari</small>
          </label>
          <label class="rg-choice rg-param-grid__wide" id="excludeBackgroundField">
            <input type="checkbox" id="excludeBackground" />
            <span>Escludi un colore di sfondo</span>
          </label>
          <label class="rg-field" id="bgColorsField">
            <span class="rg-field__label">Colori di sfondo</span>
            <input class="rg-input" id="backgroundColors" type="text" placeholder="#ffffff" />
          </label>
          <label class="rg-field" id="bgToleranceField">
            <span class="rg-field__label">Tolleranza sfondo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="backgroundTolerance" type="number" min="0" step="1"><span>rgb</span></span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Colori</h3></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Colori dei livelli</span>
            <div><div class="rg-segmented" id="paletteMode" role="group" aria-label="Colori dei livelli">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-palette="auto" aria-pressed="true">Automatici</button>
              <button type="button" class="rg-segmented__item" data-palette="manual" aria-pressed="false">Manuale</button>
            </div></div>
            <small class="rg-field__help">Automatici: l'algoritmo sceglie i colori. Manuale: li prendi dall'immagine col contagocce, ognuno con la sua tolleranza; i pixel vicini ci rientrano.</small>
          </div>
          <label class="rg-field rg-param-grid__wide" id="colorCountField">
            <span class="rg-field__label">Numero di colori (cambi-ago)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="colorCount" type="number" min="1" max="16" step="1"><span>#</span></span>
            <small class="rg-field__help">in quante tinte separare l'immagine (quantizzazione)</small>
          </label>
        </div>
        <div id="manualPalette" hidden>
          <ul class="rg-color-map" id="manualList"></ul>
          <div class="rg-cluster">
            <button type="button" id="addManualBtn" class="rg-button rg-button--ghost rg-button--small">Aggiungi colore</button>
          </div>
        </div>
        <ul class="rg-color-map" id="stopList"></ul>
      </section>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Riempimento</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Distanza tra i punti</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="densitySpacingMm" type="number" min="0" step="0.1"><span>mm</span></span>
            <small class="rg-field__help">quanto sono distanti i punti: piccola = fitto (più punti), grande = rado (meno punti); 0 = piena risoluzione</small>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Punto minimo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="minStitchMm" type="number" min="0" step="0.5"><span>mm</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Reinserimenti</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="reinsertionRounds" type="number" min="0" step="1"><span>giri</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Tetto punti (0 = off)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxPoints" type="number" min="0" step="500"><span>#</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Densità obiettivo (0 = off)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="targetDensityPct" type="number" min="0" max="100" step="1"><span>%</span></span>
          </label>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Stile e percorso</span></summary>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Distribuzione dei punti</span>
            <div><div class="rg-segmented" id="styleMode" role="group" aria-label="Distribuzione dei punti">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-style="carpet" aria-pressed="true">Regolare</button>
              <button type="button" class="rg-segmented__item" data-style="degrade" aria-pressed="false">Degradé</button>
            </div></div>
            <small class="rg-field__help">Regolare: griglia uniforme. Degradé: scarto e spostamento casuali per un effetto sfumato.</small>
          </div>
          <label class="rg-field" id="degradeDropField" hidden>
            <span class="rg-field__label">Scarto casuale</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="degradeDrop" type="number" min="0" max="1" step="0.05"><span>0–1</span></span>
          </label>
          <label class="rg-field" id="degradeJitterField" hidden>
            <span class="rg-field__label">Spostamento casuale</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="degradeJitter" type="number" min="0" step="0.1"><span>mm</span></span>
          </label>
          <label class="rg-field rg-param-grid__wide" id="seedField" hidden>
            <span class="rg-field__label">Variante</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="seed" type="number" min="1" step="1"><span>#</span></span>
              <button type="button" id="newSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova variante</button>
            </div>
            <small class="rg-field__help">stessa variante = stesso identico risultato (riproducibile)</small>
          </label>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Ordinamento del percorso</span>
            <div><div class="rg-segmented" id="orderMode" role="group" aria-label="Ordinamento del percorso">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-order="scanline" aria-pressed="true">A righe</button>
              <button type="button" class="rg-segmented__item" data-order="nearest" aria-pressed="false">Più vicino</button>
            </div></div>
            <small class="rg-field__help">A righe: veloce e regolare. Più vicino: percorso più corto ma pesante su molte migliaia di punti.</small>
          </div>
          <label class="rg-field" id="scanlineBandField">
            <span class="rg-field__label">Altezza banda (a righe)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="scanlineBandMm" type="number" min="0.2" step="0.2"><span>mm</span></span>
          </label>
          <label class="rg-choice rg-param-grid__wide" id="serpentineField">
            <input type="checkbox" id="serpentine" />
            <span>Righe a serpentina (alterna il verso)</span>
          </label>
        </div>
      </details>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><h3 class="rg-param-section__title">Carica parametri</h3></div>
        <div class="rg-file-input">
          <label class="rg-file-input__control">
            <input type="file" id="loadParams" accept=".dst,.svg" />
            <span class="rg-button rg-button--outline rg-button--small">Carica da .dst o .svg…</span>
          </label>
          <p class="rg-file-input__status" id="loadParamsStatus" role="status">Ripristina le impostazioni da un file esportato dalla suite (i parametri, non l'immagine).</p>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Esportazione</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Punti massimi per tracciato</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="chunkSize" type="number" min="0" step="500"><span>#</span></span>
            <small class="rg-field__help">spezza i tracciati lunghi per Illustrator (R6); 0 = nessun taglio</small>
          </label>
        </div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="analyzeBtn" class="rg-button rg-button--outline rg-button--small">Analizza</button>
          <button id="generateBtn" class="rg-button rg-button--primary rg-button--small">Genera</button>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportBtn" class="rg-button rg-button--ghost rg-button--small">Esporta SVG</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">Pronto</span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  const params: BitmapParams = { ...defaultBitmapParams };
  let source: Source = demoSource();
  let sourceName = '';
  let onlyColor = '';                 // '' = tutti i colori (filtro di sola generazione, come "Solo SVG")
  let lastGenerated: { svg: string; stopCount: number } | null = null;
  let analyzeTimer: number | undefined;

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function demoSource(): Source {
    const img = sampleImage();
    return { name: '', pixelsAt: () => img };
  }

  /** mm per pixel: da realWidthMm (fonte di verità, R11) o stima al DPI di `dpiEstimate`. */
  function mmPerPx(widthPx: number): number {
    if (params.realWidthMm > 0 && widthPx > 0) return params.realWidthMm / widthPx;
    return 25.4 / (params.dpiEstimate > 0 ? params.dpiEstimate : 96);
  }

  // ---- FASE LEGGERA: preview (aggiornata in tempo reale, niente ordinamento). ----
  let currentPreviewColors: BitmapPreviewColor[] = [];   // colori dell'ultima preview (per ridisegnare le righe onlyColor)
  function renderPreview() {
    try {
      const px = source.pixelsAt(params.maxWidthPx);
      const prev = runBitmapPreview(px.rgba, px.width, px.height, params, mmPerPx(px.width));
      currentPreviewColors = prev.colors;
      $('layer').innerHTML = prev.svg;
      buildStopList(prev.colors);
      const selPct = prev.totalPixels ? (100 * prev.selectedPixels / prev.totalPixels).toFixed(1) : '0';
      const genTip = lastGenerated ? '' : ' · premi Genera per il tracciato';
      $('status').textContent = prev.colors.length
        ? `Preview: ${prev.colors.length} colori · ${prev.selectedPixels} pixel (${selPct}%)${genTip}`
        : 'Nessun colore selezionato: abbassa la soglia o cambia immagine';
    } catch (e) {
      $('status').textContent = 'Errore preview: ' + (e as Error).message;
      console.error(e);
    }
  }

  function scheduleAnalyze() {
    lastGenerated = null;                         // ogni cambio invalida il tracciato generato
    if (analyzeTimer !== undefined) clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(renderPreview, 150) as unknown as number;
  }

  // ---- FASE PESANTE: generazione del tracciato (solo su richiesta). ----
  function generate(): { svg: string; stopCount: number } {
    const px = source.pixelsAt(params.maxWidthPx);
    const res = runBitmapPipeline(px.rgba, px.width, px.height, params, mmPerPx(px.width), onlyColor || undefined);
    const cap = params.chunkSize > 0 ? params.chunkSize : 5000;
    const svg = buildSvg(res.exportLayers, { bounds: res.bounds, marginMm: 4, maxPointsPerPath: cap });
    lastGenerated = { svg, stopCount: res.stopCount };
    $('layer').innerHTML = buildSvg(res.layers, { bounds: res.bounds, marginMm: 4, maxPointsPerPath: cap });
    const only = onlyColor ? ` · solo ${onlyColor}` : '';
    $('status').textContent = res.stopCount
      ? `Generato: ${res.stopCount} stop · filo ${(res.threadMm / 1000).toFixed(2)} m${only}`
      : 'Niente da generare: controlla soglia e colori';
    return lastGenerated;
  }

  /** Elenco dei colori (stop) rilevati con conteggio/area% e la scelta "solo questo colore". */
  function buildStopList(colors: BitmapPreviewColor[]) {
    const host = $('stopList');
    host.innerHTML = '';
    if (!colors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun colore selezionato: abbassa la soglia o cambia immagine.</p></li>';
      return;
    }
    // riga "Tutti i colori"
    host.appendChild(stopRow('', 'Tutti i colori', colors.reduce((s, c) => s + c.preparedCount, 0), null));
    for (const c of colors) host.appendChild(stopRow(c.color, c.color.toUpperCase(), c.preparedCount, c.areaPct));
  }

  function stopRow(color: string, label: string, count: number, areaPct: number | null): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'rg-color-map__row';
    const sw = document.createElement('span');
    sw.className = 'rg-color-map__swatch' + (color ? '' : ' rg-color-map__swatch--none');
    if (color) sw.style.setProperty('--swatch', color);
    const code = document.createElement('span');
    code.className = 'rg-color-map__code';
    code.textContent = label + ' ';
    const meta = document.createElement('span');
    meta.className = 'rg-color-map__meta';
    meta.textContent = areaPct === null ? `${count} punti` : `${count} punti · ${areaPct.toFixed(1)}%`;
    code.appendChild(meta);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rg-button rg-button--ghost rg-button--small';
    const active = onlyColor.toUpperCase() === color.toUpperCase();
    btn.textContent = active ? 'attivo' : (color ? 'solo' : 'tutti');
    btn.disabled = active;
    btn.addEventListener('click', () => { onlyColor = color; lastGenerated = null; buildStopList(currentPreviewColors); });
    row.append(sw, code, btn);
    return row;
  }

  // ---- cablaggio dei campi numerici (id ↔ chiave param). ----
  const NUMS: NumBind[] = [
    { id: 'realWidth', key: 'realWidthMm', min: 0 },
    { id: 'dpiEstimate', key: 'dpiEstimate', int: true, min: 1 },
    { id: 'maxWidthPx', key: 'maxWidthPx', int: true, min: 0 },
    { id: 'threshold', key: 'threshold', int: true, min: 0, max: 255 },
    { id: 'backgroundTolerance', key: 'backgroundToleranceRgb', min: 0 },
    { id: 'colorCount', key: 'colorCount', int: true, min: 1, max: 16 },
    { id: 'densitySpacingMm', key: 'densitySpacingMm', min: 0 },
    { id: 'minStitchMm', key: 'minStitchMm', min: 0 },
    { id: 'reinsertionRounds', key: 'reinsertionRounds', int: true, min: 0 },
    { id: 'maxPoints', key: 'maxPoints', int: true, min: 0 },
    { id: 'targetDensityPct', key: 'targetDensityPct', min: 0, max: 100 },
    { id: 'degradeDrop', key: 'degradeDrop', min: 0, max: 1 },
    { id: 'degradeJitter', key: 'degradeJitterMm', min: 0 },
    { id: 'seed', key: 'seed', int: true, min: 1 },
    { id: 'scanlineBandMm', key: 'scanlineBandMm', min: 0.2 },
    { id: 'chunkSize', key: 'chunkSize', int: true, min: 0 },
  ];
  function wireNums() {
    for (const b of NUMS) {
      const el = $(b.id) as HTMLInputElement;
      el.value = String(params[b.key]);
      el.addEventListener('change', () => {
        let v = b.int ? parseInt(el.value, 10) : parseFloat(el.value);
        if (Number.isNaN(v)) v = defaultBitmapParams[b.key] as number;
        if (b.min !== undefined) v = Math.max(b.min, v);
        if (b.max !== undefined) v = Math.min(b.max, v);
        (params[b.key] as number) = v;
        el.value = String(v);
        if (b.id === 'realWidth' || b.id === 'dpiEstimate' || b.id === 'maxWidthPx') updateFileStatus();
        scheduleAnalyze();
      });
    }
  }

  function wireText(id: string, apply: (parts: string[]) => void) {
    ($(id) as HTMLInputElement).addEventListener('change', () => {
      const parts = ($(id) as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
      apply(parts);
      scheduleAnalyze();
    });
  }
  wireText('backgroundColors', (p) => { params.backgroundColors = p; });

  function wireCheck(id: string, apply: (on: boolean) => void) {
    ($(id) as HTMLInputElement).addEventListener('change', () => { apply(($(id) as HTMLInputElement).checked); scheduleAnalyze(); });
  }
  wireCheck('excludeBackground', (on) => { params.excludeBackground = on; applySelectionVisibility(); });
  wireCheck('serpentine', (on) => { params.serpentine = on; });

  /**
   * Visibilità dei controlli di SELEZIONE e PALETTE in un colpo solo:
   *  - soglia + sfondo servono SOLO in AUTO + "solo i colori scelti" (in manuale la selezione è per
   *    vicinanza ai colori scelti; in "tutta l'immagine" si prende tutto);
   *  - numero colori (auto) vs lista manuale (contagocce).
   */
  function applySelectionVisibility() {
    const all = params.coverage === 'all';
    const manual = params.paletteMode === 'manual';
    const showThreshold = !all && !manual;                 // soglia/sfondo solo in auto + selezione
    ($('thresholdField') as HTMLElement).hidden = !showThreshold;
    ($('excludeBackgroundField') as HTMLElement).hidden = !showThreshold;
    ($('bgColorsField') as HTMLElement).hidden = !showThreshold || !params.excludeBackground;
    ($('bgToleranceField') as HTMLElement).hidden = !showThreshold || !params.excludeBackground;
    ($('colorCountField') as HTMLElement).hidden = manual;
    ($('manualPalette') as HTMLElement).hidden = !manual;
  }

  // ---- segmented: stile e ordinamento ----
  function wireSegmented(id: string, attr: string, get: () => string, set: (v: string) => void, after: () => void) {
    const btns = Array.from($(id).querySelectorAll('.rg-segmented__item')) as HTMLButtonElement[];
    const sync = () => btns.forEach((b) => {
      const on = b.dataset[attr] === get();
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    btns.forEach((b) => b.addEventListener('click', () => {
      const want = b.dataset[attr]!;
      if (get() === want) return;
      set(want); sync(); after(); scheduleAnalyze();
    }));
    sync();
    return sync;
  }
  const syncStyle = wireSegmented('styleMode', 'style', () => params.style, (v) => { params.style = v as BitmapParams['style']; }, () => {
    const deg = params.style === 'degrade';
    ($('degradeDropField') as HTMLElement).hidden = !deg;
    ($('degradeJitterField') as HTMLElement).hidden = !deg;
    ($('seedField') as HTMLElement).hidden = !deg;
  });
  const syncOrder = wireSegmented('orderMode', 'order', () => params.ordering, (v) => { params.ordering = v as BitmapParams['ordering']; }, () => {
    ($('scanlineBandField') as HTMLElement).hidden = params.ordering !== 'scanline';
    ($('serpentineField') as HTMLElement).hidden = params.ordering !== 'scanline';
  });

  const syncCoverage = wireSegmented('coverageMode', 'coverage', () => params.coverage, (v) => { params.coverage = v as BitmapParams['coverage']; }, applySelectionVisibility);

  // ---- Colori dei livelli: switch Automatici / Manuale (palette scelta col contagocce) ----
  const MAX_MANUAL = 16;
  const asHex6 = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : '#808080');

  const syncPalette = wireSegmented('paletteMode', 'palette', () => params.paletteMode,
    (v) => { params.paletteMode = v as BitmapParams['paletteMode']; },
    () => {
      // passando a "Manuale" con lista vuota, parto dai colori automatici correnti (così li posso ritoccare)
      if (params.paletteMode === 'manual' && !params.manualColors.length && currentPreviewColors.length) {
        params.manualColors = currentPreviewColors.map((c) => asHex6(c.color));
        params.manualTolerances = params.manualColors.map(() => 30);
      }
      applySelectionVisibility();
      buildManualList();
    });

  function buildManualList() {
    const host = $('manualList');
    host.innerHTML = '';
    if (!params.manualTolerances) params.manualTolerances = [];
    params.manualColors.forEach((col, i) => {
      if (params.manualTolerances[i] === undefined) params.manualTolerances[i] = 30;
      const li = document.createElement('li');
      li.className = 'rg-color-map__row';

      const sw = document.createElement('label');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', col);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'rg-u-visually-hidden';
      picker.value = asHex6(col);
      picker.setAttribute('aria-label', `Colore livello ${i + 1}`);
      picker.addEventListener('input', () => {
        params.manualColors[i] = picker.value.toUpperCase();
        sw.style.setProperty('--swatch', picker.value);
        code.textContent = picker.value.toUpperCase();
        scheduleAnalyze();
      });
      sw.appendChild(picker);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = col.toUpperCase();

      // Tolleranza per-colore (distanza RGB): quanto largo è il "raggio di cattura" del colore.
      const tolGroup = document.createElement('span');
      tolGroup.className = 'bitmap-tol';
      const tolPre = document.createElement('span');
      tolPre.className = 'bitmap-tol__pre';
      tolPre.textContent = '±';
      const tol = document.createElement('input');
      tol.type = 'number'; tol.min = '0'; tol.step = '5';
      tol.className = 'rg-input rg-input--numeric bitmap-tol__input';
      tol.value = String(params.manualTolerances[i]);
      tol.setAttribute('aria-label', `Tolleranza colore ${i + 1} (raggio di cattura RGB)`);
      tol.title = 'Tolleranza: quanto largo è il raggio di cattura di questo colore (distanza RGB)';
      tol.addEventListener('change', () => {
        const v = parseFloat(tol.value);
        params.manualTolerances[i] = Number.isNaN(v) ? 30 : Math.max(0, v);
        tol.value = String(params.manualTolerances[i]);
        scheduleAnalyze();
      });
      tolGroup.append(tolPre, tol);

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rg-icon-button';
      pick.innerHTML = EYEDROPPER_SVG;
      pick.title = 'Campiona dall\'immagine';
      pick.setAttribute('aria-label', `Campiona il colore ${i + 1} dall'immagine`);
      pick.addEventListener('click', () => enterPickMode(i));

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rg-icon-button rg-icon-button--danger bitmap-tol__remove';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Rimuovi colore ${i + 1}`);
      rm.addEventListener('click', () => { params.manualColors.splice(i, 1); params.manualTolerances.splice(i, 1); buildManualList(); scheduleAnalyze(); });

      li.append(sw, code, tolGroup, pick, rm);
      host.appendChild(li);
    });
    if (!params.manualColors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun colore scelto: premi “Aggiungi colore” e campiona dall’immagine.</p></li>';
    }
    ($('addManualBtn') as HTMLButtonElement).disabled = params.manualColors.length >= MAX_MANUAL;
  }

  $('addManualBtn').addEventListener('click', () => {
    if (params.manualColors.length >= MAX_MANUAL) return;
    params.manualColors.push('#808080');
    params.manualTolerances.push(30);
    buildManualList();
    enterPickMode(params.manualColors.length - 1);   // creo il colore ed entro subito nel contagocce
  });

  // ---- Contagocce: mostra l'immagine vera, lente sul pixel + codice, clic = quel colore diventa il livello ----
  function enterPickMode(index: number) {
    const px = source.pixelsAt(params.maxWidthPx);
    const W = px.width, H = px.height, SAMPLE = 15, HALF = 7, LENS = 132;
    const img = document.createElement('canvas');
    img.width = W; img.height = H;
    img.className = 'bitmap-pick__img';
    img.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.rgba), W, H), 0, 0);

    const overlay = document.createElement('div');
    overlay.className = 'bitmap-pick';
    const hint = document.createElement('div');
    hint.className = 'bitmap-pick__hint';
    hint.textContent = 'Muovi sul pixel, clicca per campionare il colore · Esc per annullare';
    const lens = document.createElement('canvas');
    lens.className = 'bitmap-pick__lens';
    lens.width = LENS; lens.height = LENS;
    const lctx = lens.getContext('2d')!;
    lctx.imageSmoothingEnabled = false;
    const tag = document.createElement('div');
    tag.className = 'bitmap-pick__tag';
    overlay.append(img, hint, lens, tag);
    $('canvas').appendChild(overlay);

    const colorAt = (sx: number, sy: number): string => {
      const o = (sy * W + sx) * 4;
      const h = (v: number) => v.toString(16).padStart(2, '0');
      return `#${h(px.rgba[o])}${h(px.rgba[o + 1])}${h(px.rgba[o + 2])}`.toUpperCase();
    };
    const pixelOf = (e: MouseEvent) => {
      const rect = img.getBoundingClientRect();
      const sx = Math.max(0, Math.min(W - 1, Math.floor((e.clientX - rect.left) / rect.width * W)));
      const sy = Math.max(0, Math.min(H - 1, Math.floor((e.clientY - rect.top) / rect.height * H)));
      return { sx, sy };
    };
    const onMove = (e: MouseEvent) => {
      const { sx, sy } = pixelOf(e);
      lctx.clearRect(0, 0, LENS, LENS);
      lctx.drawImage(img, sx - HALF, sy - HALF, SAMPLE, SAMPLE, 0, 0, LENS, LENS);
      const cell = LENS / SAMPLE;
      lctx.strokeStyle = '#000'; lctx.lineWidth = 1; lctx.strokeRect(HALF * cell + 0.5, HALF * cell + 0.5, cell, cell);
      lctx.strokeStyle = '#fff'; lctx.strokeRect(HALF * cell + 1.5, HALF * cell + 1.5, cell - 2, cell - 2);
      const hex = colorAt(sx, sy);
      tag.textContent = hex; tag.style.setProperty('--c', hex);
      const orect = overlay.getBoundingClientRect();
      const lx = Math.min(orect.width - LENS - 8, e.clientX - orect.left + 18);
      const ly = Math.min(orect.height - LENS - 28, e.clientY - orect.top + 18);
      lens.style.left = `${lx}px`; lens.style.top = `${ly}px`;
      tag.style.left = `${lx}px`; tag.style.top = `${ly + LENS + 4}px`;
    };
    const exit = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    const onClick = (e: MouseEvent) => {
      const { sx, sy } = pixelOf(e);
      params.manualColors[index] = colorAt(sx, sy);
      exit(); buildManualList(); scheduleAnalyze();
    };
    img.addEventListener('mousemove', onMove);
    img.addEventListener('click', onClick);
    // Il canvas ha pan/zoom (pointerdown → setPointerCapture): se non lo fermo, cattura il puntatore e il
    // click non arriva all'immagine → il colore non si campiona. Blocco i gesti puntatore/rotella
    // sull'overlay durante il contagocce.
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    overlay.addEventListener('pointerup', (e) => e.stopPropagation());
    overlay.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    document.addEventListener('keydown', onKey);
  }

  $('newSeedBtn').addEventListener('click', () => {
    params.seed = (params.seed % 999999) + 1;
    ($('seed') as HTMLInputElement).value = String(params.seed);
    scheduleAnalyze();
  });

  // ---- import immagine: File → <canvas> → ImageData → pixel (l'unico pezzo legato al DOM) ----
  function decodeToSource(imgEl: HTMLImageElement, name: string): Source {
    return {
      name,
      pixelsAt: (maxWidthPx: number) => {
        let w = imgEl.naturalWidth || imgEl.width;
        let h = imgEl.naturalHeight || imgEl.height;
        if (maxWidthPx > 0 && w > maxWidthPx) { const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s)); }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(imgEl, 0, 0, w, h);
        return { rgba: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
      },
    };
  }

  function updateFileStatus() {
    const px = source.pixelsAt(params.maxWidthPx);
    const mmpp = mmPerPx(px.width);
    const wmm = Math.round(px.width * mmpp), hmm = Math.round(px.height * mmpp);
    const hint = params.realWidthMm > 0 ? 'reale' : `stima ${params.dpiEstimate} dpi`;
    $('fileStatus').textContent = `${sourceName || 'Immagine demo'}: ${px.width}×${px.height} px → ${wmm}×${hmm} mm (${hint})`;
  }

  /** Ripristina i parametri dal metadata di un file esportato dalla suite (R27). Ritorna false se non è nostro. */
  function restoreParams(meta: Record<string, unknown> | null): boolean {
    if (!meta || meta.rgProject !== 'bitmap') return false;
    const mp = meta.params;
    if (mp && typeof mp === 'object') {
      for (const k of Object.keys(defaultBitmapParams) as (keyof BitmapParams)[]) {
        const v = (mp as Record<string, unknown>)[k];
        if (v !== undefined) (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    reflectAllControls();
    return true;
  }

  /** Riallinea TUTTI i controlli del pannello ai `params` correnti (dopo un ripristino). */
  function reflectAllControls() {
    for (const b of NUMS) ($(b.id) as HTMLInputElement).value = String(params[b.key]);
    reflectStaticControls();
    syncStyle(); syncOrder(); syncCoverage(); syncPalette();
    applySelectionVisibility();
    (['degradeDropField', 'degradeJitterField', 'seedField'] as const).forEach((id) => { ($(id) as HTMLElement).hidden = params.style !== 'degrade'; });
    (['scanlineBandField', 'serpentineField'] as const).forEach((id) => { ($(id) as HTMLElement).hidden = params.ordering !== 'scanline'; });
    buildManualList();
  }

  /**
   * Ripristina i parametri da un file .dst/.svg esportato dalla suite (R27). Il .dst porta i parametri nel
   * footer dopo l'END; l'SVG nel `<metadata>`. L'immagine sorgente non è nel file → si ricarica a parte.
   * Ritorna il messaggio di esito. `false` non-nostro/assente.
   */
  async function restoreFromFile(file: File): Promise<string> {
    if (/\.dst$/i.test(file.name)) {
      const meta = readDstMetadata(new Uint8Array(await file.arrayBuffer()));
      if (restoreParams(meta)) { renderPreview(); return `${file.name}: parametri ripristinati dal DST · ricarica l'immagine per rigenerare`; }
      return `${file.name}: nessun parametro RG nel DST`;
    }
    if (/\.svg$/i.test(file.name)) {
      const meta = readProjectMetadata(await file.text());
      if (restoreParams(meta)) { renderPreview(); return `${file.name}: parametri ripristinati dall'SVG · ricarica l'immagine per rigenerare`; }
      return `${file.name}: nessun parametro RG nell'SVG`;
    }
    return '';
  }

  $('fileInput').addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (/\.(dst|svg)$/i.test(file.name)) { $('fileStatus').textContent = await restoreFromFile(file); return; }

    const url = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = () => {
      URL.revokeObjectURL(url);
      sourceName = file.name.replace(/\.[^.]+$/, '');
      source = decodeToSource(imgEl, sourceName);
      onlyColor = '';
      renderPreview(); updateFileStatus(); pz.fit();
    };
    imgEl.onerror = () => { URL.revokeObjectURL(url); $('fileStatus').textContent = 'Errore: immagine non leggibile.'; };
    imgEl.src = url;
  });

  $('loadParams').addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    $('loadParamsStatus').textContent = (await restoreFromFile(file)) || `${file.name}: formato non riconosciuto (serve .dst o .svg)`;
    (ev.target as HTMLInputElement).value = '';
  });

  $('sampleBtn').addEventListener('click', () => {
    sourceName = ''; source = demoSource(); onlyColor = '';
    renderPreview(); updateFileStatus(); pz.fit();
  });
  $('analyzeBtn').addEventListener('click', () => { if (analyzeTimer !== undefined) clearTimeout(analyzeTimer); renderPreview(); });
  $('generateBtn').addEventListener('click', () => generate());
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('exportBtn').addEventListener('click', async () => {
    const gen = lastGenerated ?? generate();
    const name = sourceName ? `${sourceName}-bitmap.svg` : 'bitmap.svg';
    // metadata riapribile (R27): riscrive l'SVG generato con il blocco rg-project
    const withMeta = injectMetadata(gen.svg, { rgProject: 'bitmap', version: '0.1.0', params });
    const outcome = await saveTextFile(withMeta, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${gen.stopCount} stop in sequenza`;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    // Export ricamo Tajima .dst tramite la "possibilità" globale del core: gli exportLayers sono già in mm
    // reali; l'adattatore fa un blocco per polilinea, un ago per stop (cambio-colore in sequenza).
    const px = source.pixelsAt(params.maxWidthPx);
    const res = runBitmapPipeline(px.rgba, px.width, px.height, params, mmPerPx(px.width), onlyColor || undefined);
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(res.exportLayers, {
        label: (sourceName || 'BITMAP').toUpperCase().slice(0, 16),
        metadata: { rgProject: 'bitmap', version: '0.1.0', params },   // parametri riapribili dal .dst (R27)
      });
    } catch (e) {
      $('status').textContent = (e as Error).message;   // niente da cucire → messaggio, non file vuoto
      return;
    }
    const name = sourceName ? `${sourceName}-bitmap.dst` : 'bitmap.dst';
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${res.stopCount} stop · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  /** Inserisce il metadata rg-project subito dopo il tag <svg> (R27), come fa buildSvg quando gli si passa metadata. */
  function injectMetadata(svg: string, meta: Record<string, unknown>): string {
    const block = `\n  <metadata id="rg-project">${JSON.stringify(meta)}</metadata>`;
    return svg.replace(/(<svg\b[^>]*>)/, `$1${block}`);
  }

  // riallinea i controlli statici ai default e collega la preview alla lista colori
  function reflectStaticControls() {
    ($('backgroundColors') as HTMLInputElement).value = params.backgroundColors.join(', ');
    ($('excludeBackground') as HTMLInputElement).checked = params.excludeBackground;
    ($('serpentine') as HTMLInputElement).checked = params.serpentine;
  }

  wireNums();
  reflectStaticControls();
  syncStyle();
  syncOrder();
  syncCoverage();
  syncPalette();
  applySelectionVisibility();
  buildManualList();
  renderPreview();
  updateFileStatus();
}

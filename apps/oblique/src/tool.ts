import '@rg/ui/rg.css';
import './oblique.css';
import {
  parseSvgToContours, parseDxfToContours, buildSvg, buildSvgInSourceFrame, readProjectMetadata,
  dstFromExportLayers, DST_FILE, THREAD_STROKE_MM, SHAPE_STROKE_MM,
  type ImportResult, type ExportLayer,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  generateOblique, defaultObliqueParams, moduleFromPolylines, parseModuleSvg, contourBoundary, rectBounds,
  type ObliqueParams, type ObliqueModule, type ObliqueSources, type RoleBoundaries, type Boundary,
  type Stroke, type RawPolyline, type ObliqueResult,
} from './engine';

// I 4 moduli built-in del motivo oblique (asset fissi: nell'easy l'utente dà solo il pannello).
import level0Svg from './modules/level0.svg?raw';
import level1Svg from './modules/level1.svg?raw';
import level2Svg from './modules/level2.svg?raw';
import holesSvg from './modules/holes.svg?raw';

type ObliqueRole = 'MASTER_OUTLINE' | 'PATTERN_REFERENCE' | 'LASER_REFERENCE' | 'PLACEMENT_REFERENCE';
const ROLE_ORDER: ObliqueRole[] = ['MASTER_OUTLINE', 'PATTERN_REFERENCE', 'LASER_REFERENCE', 'PLACEMENT_REFERENCE'];

// Colori di anteprima per livello (la preview è una vista, il filo si disegna sottile — R15).
const LAYER_COLOR: Record<string, string> = {
  level0: '#1a9e5f', level05: '#12b5b5', level1: '#2277cc', level2: '#111111',
  holes: '#e52421', travel: '#c98a2b', boundary: '#9aa0a6',
};

const isIllustrator = (text: string): boolean => /Adobe Illustrator|Illustrator/i.test(text) || /id="Livello_/i.test(text);

/** Parsa un modulo built-in leggendo i punti delle polyline VERBATIM (come app.js, no ri-sampling).
 *  Fallback al parser del core solo se il modulo non fosse polyline-only (es. contenesse path/curve). */
function parseModule(svgText: string): ObliqueModule {
  const m = parseModuleSvg(svgText);
  if (m.elements.length) return m;
  const res = parseSvgToContours(svgText, isIllustrator(svgText) ? 72 : 96);
  return moduleFromPolylines(res.contours.map((c) => c.points));
}

export function mountOblique(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const params: ObliqueParams = defaultObliqueParams();
  const modules = {
    level0: parseModule(level0Svg),
    level1: parseModule(level1Svg),
    level2: parseModule(level2Svg),
    holes: parseModule(holesSvg),
  };

  // Stato del cartamodello utente, delle assegnazioni ruolo→colore, della UI (preview-only) e visibilità.
  let panel: ImportResult | null = null;
  let panelName = '';
  const roleColor: Partial<Record<ObliqueRole, string>> = {};
  const ui = { showPanelShapeOverlay: false, panelShapeOverlayColor: '#e52421', nudgeStep: 1 };
  const layerVisible: Record<string, boolean> = { level0: true, level05: true, level1: true, level2: true, holes: true, travel: false, boundary: false };

  const num = (label: string, key: keyof ObliqueParams, step: string, min?: string): string =>
    `<label class="rg-field rg-param-grid__wide"><span class="rg-field__label">${label}</span>
      <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" step="${step}"${min !== undefined ? ` min="${min}"` : ''} data-param="${key}" value="${params[key]}"><span>mm</span></span></label>`;
  const check = (label: string, key: string, checked = false): string =>
    `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-param="${key}"${checked ? ' checked' : ''}> ${label}</label>`;
  const roleRow = (role: ObliqueRole, label: string): string =>
    `<li class="rg-color-map__row">
      <span class="rg-color-map__swatch" data-role-swatch="${role}" style="--swatch:transparent"></span>
      <span class="rg-color-map__code">${label}</span>
      <select class="rg-select rg-color-map__target" data-param="role.${role}" aria-label="Colore per il ruolo ${label}"><option value="">— (nessun colore)</option></select>
    </li>`;

  root.innerHTML = `
  ${topbar('Oblique', opts.backHref)}
  <div class="rg-workspace oblique-workspace" style="height: calc(100vh - var(--rg-layout-header))">
    <aside class="rg-workspace__panel">

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Cartamodello</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="panelInput" accept=".svg,.dxf,image/svg+xml">
              <span class="rg-button rg-button--outline">Carica SVG o DXF…</span>
            </label>
            <p class="rg-file-input__status" id="panelStatus" role="status">Nessun cartamodello: uso il formato ${params.formatWidth}×${params.formatHeight} mm.</p>
          </div>
          <div class="rg-cluster rg-param-grid__wide">
            <label class="rg-choice"><input type="checkbox" data-param="showPanelShapeOverlay"> Mostra cartamodello</label>
            <input type="color" data-param="panelShapeOverlayColor" value="#e52421" aria-label="Colore anteprima cartamodello">
          </div>
          <ul class="rg-color-map rg-param-grid__wide" id="roleColorMap">
            ${roleRow('MASTER_OUTLINE', 'Pannello')}
            ${roleRow('PATTERN_REFERENCE', 'Pattern')}
            ${roleRow('LASER_REFERENCE', 'Fori')}
            ${roleRow('PLACEMENT_REFERENCE', 'Piazzamento e fissaggio')}
          </ul>
          ${check("Cerchi/zig-zag solo dove c'è il foro", 'pruneFeaturesWithoutHoles')}
          ${check('Diagonali L0/L1 solo dove ci sono fori', 'trimDiagonalsToHoles')}
          ${check('Impuntura di fissaggio prima dei cerchi (Livello 0.5)', 'enableLevel05')}
          ${num('Lunghezza punto impuntura', 'level05StitchLength', '0.5', '1')}
          ${num('Tolleranza foro dal perimetro', 'holePerimeterToleranceMm', '0.5')}
          ${check('Aree di esclusione interne', 'enableExclusionAreas', params.enableExclusionAreas)}
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Misure e rientri</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Pannello larghezza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" min="1" step="1" data-param="formatWidth" value="${params.formatWidth}"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Pannello altezza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" min="1" step="1" data-param="formatHeight" value="${params.formatHeight}"><span>mm</span></span></label>
          ${num('Rientro taglio pattern', 'patternBorderOffset', '0.5', '0')}
          ${num('Rientro taglio fori', 'holesMargin', '0.5', '0')}
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Punti</span></summary>
        <div class="rg-param-grid">
          ${num('Lunghezza punti passaggi/bordi', 'minimumTravelStitchLength', '0.05', '1')}
          ${num('Punto minimo globale', 'minimumSegmentLength', '0.1', '1')}
          ${num('Punto minimo bordi da taglio', 'cutBorderStitchLength', '0.1', '1')}
          ${check('Partenza dal bordo (scarico filo)', 'startLockEnabled', params.startLockEnabled)}
          ${num('Punto partenza/ingresso', 'startLockStitchMm', '0.5', '0.5')}
        </div>
      </details>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">04</span><h3 class="rg-param-section__title">Posizione pattern</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field"><span class="rg-field__label">Offset X</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" step="0.1" data-param="globalPatternOffsetX" value="${params.globalPatternOffsetX}"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Offset Y</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" step="0.1" data-param="globalPatternOffsetY" value="${params.globalPatternOffsetY}"><span>mm</span></span></label>
          <label class="rg-field"><span class="rg-field__label">Passo spostamento</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" min="0" step="0.1" data-ui="nudgeStep" value="1"><span>mm</span></span></label>
          <div class="oblique-nudge" role="group" aria-label="Sposta pattern del passo">
            <button type="button" class="rg-icon-button oblique-nudge__up" data-nudge="0,-1" aria-label="Sposta su">↑</button>
            <button type="button" class="rg-icon-button oblique-nudge__left" data-nudge="-1,0" aria-label="Sposta a sinistra">←</button>
            <button type="button" class="rg-icon-button oblique-nudge__right" data-nudge="1,0" aria-label="Sposta a destra">→</button>
            <button type="button" class="rg-icon-button oblique-nudge__down" data-nudge="0,1" aria-label="Sposta giù">↓</button>
          </div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">05</span><h3 class="rg-param-section__title">Livelli visibili</h3></div>
        <div class="rg-param-grid">
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="level0" checked> Piazzamento</label>
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="level1" checked> Fissaggio</label>
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="level2" checked> Ricamo oblique</label>
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="holes" checked> Fori laser</label>
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="travel"> Passaggi</label>
          <label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-layer="boundary"> Rettangoli cartamodello</label>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Esportazione</span></summary>
        <div class="rg-param-grid">
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" class="rg-button rg-button--primary" id="exportSvgBtn">Esporta tutto (SVG)</button>
            <button type="button" class="rg-button rg-button--outline" id="exportDstBtn">Esporta DST</button>
          </div>
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="reopenInput" accept=".svg,image/svg+xml">
              <span class="rg-button rg-button--outline">Riapri progetto salvato (SVG)…</span>
            </label>
          </div>
        </div>
      </details>

    </aside>

    <section class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster"><button type="button" id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button></div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px">
          <svg id="preview" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${params.formatWidth} ${params.formatHeight}"></svg>
        </div>
      </div>
      <footer class="rg-workspace__statusbar"><span id="status">Pronto</span><span id="zoom" class="rg-mono">zoom 100%</span></footer>
    </section>
  </div>`;

  const $ = (id: string): HTMLElement => root.querySelector('#' + id) as HTMLElement;
  const qp = (name: string): HTMLInputElement | null => root.querySelector(`[data-param="${name}"]`);
  const setStatus = (m: string): void => { $('status').textContent = m; };

  // ---- Parametri dell'engine: lettura/scrittura generica dei [data-param] (esclusi role.* e UI-only) ----
  const isEngineParam = (key: string): key is keyof ObliqueParams => key in params;
  function applyParamsToControls(): void {
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((el) => {
      const key = el.dataset.param!;
      if (!isEngineParam(key)) return;
      const v = params[key];
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(v);
      else el.value = String(v);
    });
  }
  function readParams(): void {
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((el) => {
      const key = el.dataset.param!;
      if (!isEngineParam(key)) return;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') (params[key] as boolean) = el.checked;
      else if (el instanceof HTMLInputElement && el.type === 'number') { const n = Number(el.value); if (Number.isFinite(n)) (params[key] as number) = n; }
      else (params[key] as string) = (el as HTMLInputElement).value;
    });
    // UI-only (preview): overlay cartamodello + passo nudge.
    const ov = qp('showPanelShapeOverlay'); if (ov) ui.showPanelShapeOverlay = ov.checked;
    const oc = qp('panelShapeOverlayColor'); if (oc) ui.panelShapeOverlayColor = oc.value;
    const ns = root.querySelector<HTMLInputElement>('[data-ui="nudgeStep"]'); if (ns) ui.nudgeStep = Number(ns.value) || 1;
  }

  // ---- Colori → ruoli: popola i 4 select coi colori unici del cartamodello + aggiorna gli swatch ----
  function uniqueColors(): string[] {
    if (!panel) return [];
    return Array.from(new Set(panel.contours.map((c) => c.color))).filter((c) => c !== 'none');
  }
  function refreshRoleSelects(): void {
    const colors = uniqueColors();
    for (const role of ROLE_ORDER) {
      const sel = root.querySelector<HTMLSelectElement>(`[data-param="role.${role}"]`);
      if (!sel) continue;
      const current = roleColor[role] || '';
      sel.innerHTML = '<option value="">— (nessun colore)</option>' + colors.map((c) => `<option value="${c}"${c === current ? ' selected' : ''}>${c.toUpperCase()}</option>`).join('');
      const sw = root.querySelector<HTMLElement>(`[data-role-swatch="${role}"]`);
      if (sw) sw.style.setProperty('--swatch', current || 'transparent');
    }
  }

  function colorOf(role: ObliqueRole): string | null { return roleColor[role] || null; }
  function roleBoundary(role: ObliqueRole): Boundary | undefined {
    if (!panel) return undefined;
    const color = colorOf(role);
    if (!color) return undefined;
    const pts = panel.contours.filter((c) => c.color === color).map((c) => c.points);
    return contourBoundary(pts, role.toLowerCase(), params.perimeterCloseTolerance) ?? undefined;
  }
  function buildRoles(): RoleBoundaries {
    return { master: roleBoundary('MASTER_OUTLINE'), pattern: roleBoundary('PATTERN_REFERENCE'), laser: roleBoundary('LASER_REFERENCE'), placement: roleBoundary('PLACEMENT_REFERENCE') };
  }
  function panelBounds(): ObliqueSources['panelBounds'] {
    if (!panel) return undefined;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of panel.contours) for (const p of c.points) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return Number.isFinite(minX) ? rectBounds(minX, minY, maxX - minX, maxY - minY) : undefined;
  }

  // ---- Generazione + preview ----
  function currentSources(): ObliqueSources {
    return { level0: modules.level0, level1: modules.level1, level2: modules.level2, holes: modules.holes, panelBounds: panelBounds() };
  }
  const strokesToLayer = (id: string, strokes: Stroke[]): ExportLayer => ({ id, color: LAYER_COLOR[id] || '#111', polylines: strokes.map((s) => s.points), strokeMm: THREAD_STROKE_MM });
  const holesToLayer = (holes: RawPolyline[]): ExportLayer => ({ id: 'holes', color: LAYER_COLOR.holes, polylines: holes.map((h) => h.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  function exportLayersFor(res: ObliqueResult): ExportLayer[] {
    const layers: ExportLayer[] = [];
    if (res.level0.length) layers.push(strokesToLayer('level0', res.level0));
    if (res.level05.length) layers.push(strokesToLayer('level05', res.level05));
    if (res.level1.length) layers.push(strokesToLayer('level1', res.level1));
    if (res.level2.length) layers.push(strokesToLayer('level2', res.level2));
    if (res.holes.length) layers.push(holesToLayer(res.holes));
    return layers;
  }

  let lastResult: ObliqueResult | null = null;
  function render(): void {
    readParams();
    refreshRoleSelects();
    try {
      const placementFollows = colorOf('PLACEMENT_REFERENCE') !== null && colorOf('PLACEMENT_REFERENCE') === colorOf('PATTERN_REFERENCE');
      const res = generateOblique(currentSources(), params, { roles: buildRoles(), placementFollowsPattern: placementFollows });
      lastResult = res;
      const layers: ExportLayer[] = [];
      if (panel && ui.showPanelShapeOverlay) layers.push({ id: 'panel-overlay', color: ui.panelShapeOverlayColor, strokeMm: SHAPE_STROKE_MM, shapeOnly: true, polylines: panel.contours.map((c) => c.points) });
      if (layerVisible.boundary) layers.push({ id: 'boundary', color: LAYER_COLOR.boundary, strokeMm: SHAPE_STROKE_MM, shapeOnly: true, polylines: [res.boundaries.pattern.points, res.boundaries.laser.points, res.boundaries.placement.points] });
      if (layerVisible.level0 && res.level0.length) layers.push(strokesToLayer('level0', res.level0));
      if (layerVisible.level05 && res.level05.length) layers.push(strokesToLayer('level05', res.level05));
      if (layerVisible.level1 && res.level1.length) layers.push(strokesToLayer('level1', res.level1));
      if (layerVisible.travel && res.travel.length) layers.push({ id: 'travel', color: LAYER_COLOR.travel, strokeMm: THREAD_STROKE_MM, polylines: res.travel.map((s) => s.points) });
      if (layerVisible.level2 && res.level2.length) layers.push(strokesToLayer('level2', res.level2));
      if (layerVisible.holes && res.holes.length) layers.push(holesToLayer(res.holes));
      const b = res.boundaries.pattern;
      $('layer').innerHTML = buildSvg(layers, { bounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }, marginMm: 10 });
      setStatus(`${res.grid.diagonalCount * res.grid.modulesPerDiagonal} celle · pattern ${Math.round(b.width)}×${Math.round(b.height)} mm`);
    } catch (e) {
      setStatus('Errore: ' + (e as Error).message);
    }
  }

  // ---- Import cartamodello + riapri progetto ----
  function loadPanel(result: ImportResult, name: string): void {
    panel = result;
    panelName = name;
    const colors = uniqueColors();
    if (colors.length === 1 && !colorOf('MASTER_OUTLINE')) roleColor.MASTER_OUTLINE = colors[0];
    $('panelStatus').textContent = `${name} · ${result.contours.length} contorni · ${Math.round(result.widthMm)}×${Math.round(result.heightMm)} mm`;
    refreshRoleSelects();
    render();
  }
  function restoreProject(meta: Record<string, unknown>): void {
    const p = meta.params as Partial<ObliqueParams> | undefined;
    if (p) Object.assign(params, p);
    const r = meta.roles as Partial<Record<ObliqueRole, string>> | undefined;
    if (r) { for (const k of ROLE_ORDER) delete roleColor[k]; Object.assign(roleColor, r); }
    applyParamsToControls();
  }

  $('panelInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const meta = readProjectMetadata(text);
      if (meta && meta.rgProject === 'oblique') restoreProject(meta);
      const result = /\.dxf$/i.test(file.name) ? parseDxfToContours(text) : parseSvgToContours(text, isIllustrator(text) ? 72 : 96);
      loadPanel(result, file.name);
    });
  });
  $('reopenInput').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      if (text.indexOf('rgProject') === -1) { setStatus('SVG senza parametri di progetto: impossibile ripristinare.'); input.value = ''; return; }
      const meta = readProjectMetadata(text);
      if (meta && meta.rgProject === 'oblique') restoreProject(meta);
      loadPanel(parseSvgToContours(text, isIllustrator(text) ? 72 : 96), file.name);
      input.value = '';
    });
  });

  // ---- Export ----
  async function doExportSvg(): Promise<void> {
    readParams();
    const res = lastResult ?? generateOblique(currentSources(), params, { roles: buildRoles() });
    const layers = exportLayersFor(res);
    const metadata = { rgProject: 'oblique', version: '0.1.0', params, roles: roleColor };
    let svg: string;
    if (panel?.frame) svg = buildSvgInSourceFrame(layers, { frame: panel.frame, realWidthFactor: 1, metadata });
    else { const b = res.boundaries.pattern; svg = buildSvg(layers, { bounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }, marginMm: 10, metadata }); }
    const base = (panelName ? panelName.replace(/\.[^.]+$/, '') : 'oblique') + '-oblique.svg';
    setStatus(saveOutcomeMessage(await saveTextFile(svg, { suggestedName: base, description: 'Immagine SVG' }), base));
  }
  async function doExportDst(): Promise<void> {
    readParams();
    const res = lastResult ?? generateOblique(currentSources(), params, { roles: buildRoles() });
    const bytes = dstFromExportLayers(exportLayersFor(res), { label: 'OBLIQUE' });
    const base = (panelName ? panelName.replace(/\.[^.]+$/, '') : 'oblique') + '.dst';
    setStatus(saveOutcomeMessage(await saveBinaryFile(bytes, { suggestedName: base, ...DST_FILE }), base));
  }
  $('exportSvgBtn').addEventListener('click', () => { void doExportSvg(); });
  $('exportDstBtn').addEventListener('click', () => { void doExportDst(); });

  // ---- Interazioni ----
  // Parametri normali → render. I select dei RUOLI (data-param="role.X") hanno un handler dedicato:
  // aggiornano roleColor PRIMA del render (altrimenti refreshRoleSelects rimetterebbe il valore a vuoto).
  root.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => {
    if (el.dataset.param!.startsWith('role.')) return;
    el.addEventListener('change', render);
  });
  root.querySelectorAll<HTMLSelectElement>('[data-param^="role."]').forEach((sel) => sel.addEventListener('change', () => {
    const role = sel.dataset.param!.slice('role.'.length) as ObliqueRole;
    if (sel.value) roleColor[role] = sel.value; else delete roleColor[role];
    const sw = root.querySelector<HTMLElement>(`[data-role-swatch="${role}"]`);
    if (sw) sw.style.setProperty('--swatch', sel.value || 'transparent');
    render();
  }));
  root.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((el) => el.addEventListener('change', () => { layerVisible[el.dataset.layer!] = el.checked; render(); }));
  root.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach((btn) => btn.addEventListener('click', () => {
    const [dx, dy] = btn.dataset.nudge!.split(',').map(Number);
    const step = ui.nudgeStep || 1;
    params.globalPatternOffsetX = Math.round((params.globalPatternOffsetX + dx * step) * 100) / 100;
    params.globalPatternOffsetY = Math.round((params.globalPatternOffsetY + dy * step) * 100) / 100;
    applyParamsToControls();
    render();
  }));

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });
  $('fitBtn').addEventListener('click', () => pz.fit());

  applyParamsToControls();
  refreshRoleSelects();
  render();
}

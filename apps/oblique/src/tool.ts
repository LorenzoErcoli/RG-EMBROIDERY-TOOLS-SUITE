import '@rg/ui/rg.css';
import './oblique.css';
import {
  parseSvgToContours, parseDxfToContours, buildSvg, buildSvgInSourceFrame, readProjectMetadata, readDstMetadata,
  dstFromExportLayers, conBusta, DST_FILE, THREAD_STROKE_MM, SHAPE_STROKE_MM, DPI_ILLUSTRATOR, applyRealWidth,
  type ImportResult, type ExportLayer, type SvgImportOptions, type Contour,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { collegaStilista, stratiCuciti, svgForiAiLoroColori, primoColoreStilista, type AggancioStilista } from '@rg/ui/stilista';
import {
  defaultObliqueParams, moduleFromPolylines, parseModuleSvg,
  type ObliqueParams, type ObliqueModule, type ObliqueResult,
} from './engine';
import {
  LAYER_COLOR, strokesToLayer, holesToLayer, exportLayersFor, generaOblique, type ObliqueRole,
} from './motore';

// I 4 moduli built-in del motivo oblique (asset fissi: nell'easy l'utente dà solo il pannello).
import level0Svg from './modules/level0.svg?raw';
import level1Svg from './modules/level1.svg?raw';
import level2Svg from './modules/level2.svg?raw';
import holesSvg from './modules/holes.svg?raw';
import { barraAnteprima, barraStato, sezioneSorgente, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero } from '@rg/ui/anatomia';

const ROLE_ORDER: ObliqueRole[] = ['MASTER_OUTLINE', 'PATTERN_REFERENCE', 'LASER_REFERENCE', 'PLACEMENT_REFERENCE'];

const isIllustrator = (text: string): boolean => /Adobe Illustrator|Illustrator/i.test(text) || /id="Livello_/i.test(text);

/**
 * Scala d'import del cartamodello, come l'originale (inferUndeclaredSvgScale): se il file dichiara
 * width/height comanda quella misura; se non la dichiara, un file Illustrator ha il viewBox in
 * PUNTI, tutto il resto ce l'ha già in MILLIMETRI. Il vecchio ripiego a 96dpi faceva entrare un
 * cartamodello senza misure al 26% della sua taglia — e nessuno vedeva un errore.
 */
const svgImportOptions = (text: string): SvgImportOptions =>
  isIllustrator(text) ? { dpi: DPI_ILLUSTRATOR, scaleMode: 'illustrator-72' } : { scaleMode: 'viewbox-mm' };

/** Parsa un modulo built-in leggendo i punti delle polyline VERBATIM (come app.js, no ri-sampling).
 *  Fallback al parser del core solo se il modulo non fosse polyline-only (es. contenesse path/curve). */
function parseModule(svgText: string): ObliqueModule {
  const m = parseModuleSvg(svgText);
  if (m.elements.length) return m;
  const res = parseSvgToContours(svgText, svgImportOptions(svgText));
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
  // I contorni del cartamodello alla misura VERA: `realWidthMm` è la fonte di verità (R11).
  // Un SVG che non dichiara width/height non dice in che unità è il suo viewBox — punti, mm o px
  // danno tre misure diverse dello stesso disegno — e indovinarlo in silenzio è peggio di chiedere.
  let panelScaled: Contour[] = [];
  let panelName = '';
  const roleColor: Partial<Record<ObliqueRole, string>> = {};
  const ui = { showPanelShapeOverlay: false, panelShapeOverlayColor: '#e52421', nudgeStep: 1 };
  const layerVisible: Record<string, boolean> = { level0: true, level05: true, level1: true, level2: true, holes: true, travel: false, boundary: false };

  /** Un campo numerico in mm legato a un parametro dell'engine (`data-param`): il campo della suite, virgola o punto. */
  const num = (label: string, key: keyof ObliqueParams, step: number, min?: number, largo = true): string =>
    campoNumero({ id: 'p-' + key, etichetta: label, unita: 'mm', valore: params[key] as number, passo: step, min, largo, attributi: `data-param="${key}"` });
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

      ${sezioneSorgente({
        tipo: 'cartamodello', accetta: '.svg,.dxf,image/svg+xml', etichettaCarica: 'Carica SVG o DXF…',
        statoIniziale: `Nessun cartamodello: uso il formato ${params.formatWidth}×${params.formatHeight} mm.`, stilista: true,
        extra: `<div class="rg-cluster rg-param-grid__wide">
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
          ${num('Lunghezza punto impuntura', 'level05StitchLength', 0.5, 1)}
          ${num('Tolleranza foro dal perimetro', 'holePerimeterToleranceMm', 0.5)}
          ${check('Aree di esclusione interne', 'enableExclusionAreas', params.enableExclusionAreas)}`,
      })}

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Misure e rientri</h3></div>
        <div class="rg-param-grid">
          ${num('Pannello larghezza', 'formatWidth', 1, 1, false)}
          ${num('Pannello altezza', 'formatHeight', 1, 1, false)}
          ${num('Rientro taglio pattern', 'patternBorderOffset', 0.5, 0)}
          ${num('Rientro taglio fori', 'holesMargin', 0.5, 0)}
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Punti</span></summary>
        <div class="rg-param-grid">
          ${num('Lunghezza punti passaggi/bordi', 'minimumTravelStitchLength', 0.05, 1)}
          ${num('Punto minimo globale', 'minimumSegmentLength', 0.1, 1)}
          ${num('Punto minimo bordi da taglio', 'cutBorderStitchLength', 0.1, 1)}
          ${check('Partenza dal bordo (scarico filo)', 'startLockEnabled', params.startLockEnabled)}
          ${num('Punto partenza/ingresso', 'startLockStitchMm', 0.5, 0.5)}
        </div>
      </details>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">04</span><h3 class="rg-param-section__title">Posizione pattern</h3></div>
        <div class="rg-param-grid">
          ${num('Offset X', 'globalPatternOffsetX', 0.1, undefined, false)}
          ${num('Offset Y', 'globalPatternOffsetY', 0.1, undefined, false)}
          ${campoNumero({ id: 'nudgeStep', etichetta: 'Passo spostamento', unita: 'mm', valore: 1, passo: 0.1, min: 0, attributi: 'data-ui="nudgeStep"' })}
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

    </aside>

    <section class="rg-workspace__stage">
      ${barraAnteprima({ inviaStilista: true })}
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px">
          <svg id="preview" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${params.formatWidth} ${params.formatHeight}"></svg>
        </div>
      </div>
      ${barraStato()}
    </section>
  </div>`;

  attivaCampiNumero(root);
  const $ = (id: string): HTMLElement => root.querySelector('#' + id) as HTMLElement;
  // La larghezza reale della sezione 01 comune è un parametro dell'engine: la legge e la scrive il giro dei [data-param].
  $('realWidth').setAttribute('data-param', 'realWidthMm');
  $('realWidth-aiuto').innerHTML = "0 = usa la misura letta dal file. Se l'SVG non dichiara <code>width</code>/<code>height</code> la misura è una stima (lo dice la riga qui sopra): scrivi qui la larghezza vera e comanda quella.";
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
      else if (el instanceof HTMLInputElement && el.hasAttribute('data-numero')) impostaNumero(el, v as number);
      else el.value = String(v);
    });
  }
  function readParams(): void {
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((el) => {
      const key = el.dataset.param!;
      if (!isEngineParam(key)) return;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') (params[key] as boolean) = el.checked;
      else if (el instanceof HTMLInputElement && el.hasAttribute('data-numero')) { const n = leggiCampo(el); if (Number.isFinite(n)) (params[key] as number) = n; }
      else (params[key] as string) = (el as HTMLInputElement).value;
    });
    // UI-only (preview): overlay cartamodello + passo nudge.
    const ov = qp('showPanelShapeOverlay'); if (ov) ui.showPanelShapeOverlay = ov.checked;
    const oc = qp('panelShapeOverlayColor'); if (oc) ui.panelShapeOverlayColor = oc.value;
    const ns = root.querySelector<HTMLInputElement>('[data-ui="nudgeStep"]'); if (ns) ui.nudgeStep = leggiCampo(ns) || 1;
    refreshPanelScale();
  }

  // ---- Colori → ruoli: popola i 4 select coi colori unici del cartamodello + aggiorna gli swatch ----
  /** Quanto va scalato il file per arrivare alla misura vera (1 = si usa la misura letta). */
  function realWidthFactor(): number {
    return panel && params.realWidthMm > 0 && panel.widthMm > 0 ? params.realWidthMm / panel.widthMm : 1;
  }
  /** Ricalcola i contorni alla misura vera. Da chiamare dopo ogni import e ogni lettura parametri. */
  function refreshPanelScale(): void {
    panelScaled = panel ? applyRealWidth(panel, params.realWidthMm) : [];
  }
  /**
   * Dice COME è stata misurata la sagoma, non solo quanto misura: `declared` = il file dichiara la
   * sua dimensione fisica, `stima` = non la dichiara e l'abbiamo dedotta dal viewBox. La stima può
   * sbagliare di 2,8× (un viewBox in punti letto come mm) e senza questa riga non si vede.
   */
  function updatePanelStatus(): void {
    if (!panel) { $('fileStatus').textContent = `Nessun cartamodello: uso il formato ${params.formatWidth}×${params.formatHeight} mm.`; return; }
    const f = realWidthFactor();
    const letta = `${round1(panel.widthMm)}×${round1(panel.heightMm)} mm`;
    const come = panel.method === 'declared' ? 'misura dichiarata nel file' : 'stima dal viewBox — controllala';
    const reale = f !== 1 ? ` → reale ${round1(panel.widthMm * f)}×${round1(panel.heightMm * f)} mm` : '';
    $('fileStatus').textContent = `${panelName} · ${panel.contours.length} contorni · ${letta} (${come})${reale}`;
  }
  const round1 = (v: number): number => Math.round(v * 10) / 10;

  function uniqueColors(): string[] {
    if (!panel) return [];
    return Array.from(new Set(panelScaled.map((c) => c.color))).filter((c) => c !== 'none');
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

  // ---- Generazione + preview ----
  // La sequenza che dà il ricamo (confini dai ruoli, ingombro, generateOblique) sta in motore.ts, uguale per tutti.
  const generate = (): ObliqueResult => generaOblique(modules, panelScaled, roleColor, params);

  let lastResult: ObliqueResult | null = null;
  function render(): void {
    readParams();
    refreshRoleSelects();
    updatePanelStatus();
    try {
      const res = generate();
      lastResult = res;
      const layers: ExportLayer[] = [];
      if (panel && ui.showPanelShapeOverlay) layers.push({ id: 'panel-overlay', color: ui.panelShapeOverlayColor, strokeMm: SHAPE_STROKE_MM, shapeOnly: true, polylines: panelScaled.map((c) => c.points) });
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
    svgStilista = null; // ogni caricamento: solo il caricamento da Stilista la rimette, subito dopo
    panel = result;
    panelName = name;
    refreshPanelScale();
    const colors = uniqueColors();
    if (colors.length === 1 && !colorOf('MASTER_OUTLINE')) roleColor.MASTER_OUTLINE = colors[0];
    updatePanelStatus();
    refreshRoleSelects();
    render();
  }
  function restoreProject(meta: Record<string, unknown>): void {
    const p = meta.params as Partial<ObliqueParams> | undefined;
    if (p) Object.assign(params, p);
    const r = meta.roles as Partial<Record<ObliqueRole, string>> | undefined;
    if (r) { for (const k of ROLE_ORDER) delete roleColor[k]; Object.assign(roleColor, r); }
    applyParamsToControls();
    refreshPanelScale();
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const meta = readProjectMetadata(text);
      if (meta && meta.rgProject === 'oblique') restoreProject(meta);
      const result = /\.dxf$/i.test(file.name) ? parseDxfToContours(text) : parseSvgToContours(text, svgImportOptions(text));
      loadPanel(result, file.name);
    });
  });
  // «Apri progetto o DST…» della sezione 01. Riapre un progetto esportato dalla suite: dall'SVG (parametri nel <metadata>, e il disegno si
  // ricarica come cartamodello) oppure dal .dst (parametri nel footer dopo l'END, R27: il file di
  // macchina si rigenera identico senza avere l'SVG sotto mano).
  $('progettoInput').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (/\.dst$/i.test(file.name)) {
      file.arrayBuffer().then((buf) => {
        const meta = readDstMetadata(new Uint8Array(buf));
        if (meta && meta.rgProject === 'oblique') { restoreProject(meta); render(); setStatus(`${file.name}: parametri ripristinati dal DST`); }
        else setStatus(`${file.name}: nessun parametro RG nel DST`);
        input.value = '';
      });
      return;
    }
    file.text().then((text) => {
      if (text.indexOf('rgProject') === -1) { setStatus('SVG senza parametri di progetto: impossibile ripristinare.'); input.value = ''; return; }
      const meta = readProjectMetadata(text);
      if (meta && meta.rgProject === 'oblique') restoreProject(meta);
      loadPanel(parseSvgToContours(text, svgImportOptions(text)), file.name);
      input.value = '';
    });
  });

  // ---- Export ----
  // Da cosa è partito il ricamo: il cartamodello caricato (misura REALE), niente se è a formato.
  const sorgenteBusta = () => panel ? { tipo: /\.dxf$/i.test(panelName) ? 'dxf' as const : 'svg' as const, nome: panelName,
    larghezzaMm: round1(panel.widthMm * realWidthFactor()), altezzaMm: round1(panel.heightMm * realWidthFactor()) } : undefined;
  async function doExportSvg(): Promise<void> {
    readParams();
    const res = lastResult ?? generate();
    const layers = exportLayersFor(res);
    const metadata = conBusta({ rgProject: 'oblique', version: '0.1.0', params, roles: roleColor }, { strati: layers, sorgente: sorgenteBusta() });
    let svg: string;
    if (panel?.frame) svg = buildSvgInSourceFrame(layers, { frame: panel.frame, realWidthFactor: realWidthFactor(), metadata });
    else { const b = res.boundaries.pattern; svg = buildSvg(layers, { bounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }, marginMm: 10, metadata }); }
    const base = (panelName ? panelName.replace(/\.[^.]+$/, '') : 'oblique') + '-oblique.svg';
    setStatus(saveOutcomeMessage(await saveTextFile(svg, { suggestedName: base, description: 'Immagine SVG' }), base));
  }
  // I parametri viaggiano ANCHE nel DST (R27), nel footer dopo l'END: la macchina lo ignora, noi lo
  // rileggiamo. Senza, il .dst era l'unico file della suite che non sapeva da dove veniva.
  // Lo usano «Esporta DST» e «Invia a Stilista».
  function costruisciDst(): Uint8Array {
    readParams();
    const res = lastResult ?? generate();
    const layers = exportLayersFor(res);
    return dstFromExportLayers(layers, {
      label: 'OBLIQUE',
      metadata: conBusta({ rgProject: 'oblique', version: '0.1.0', params, roles: roleColor }, { strati: layers, sorgente: sorgenteBusta() }),
    });
  }

  // ---- Stilista (RG Stilista Link, @rg/ui/stilista): ogni stop e ogni colore della selezione arriva con un
  // colore suo, da dare a Pannello, Pattern, Fori o Piazzamento. Il primo oggetto fa il Pannello; i vuoti sono
  // gli anelli interni del loro oggetto: tornano al suo colore e le aree di esclusione interne si accendono.
  let svgStilista: string | null = null;
  const aggancio: AggancioStilista = {
    tool: 'oblique',
    riapri(meta) {
      restoreProject(meta);
      render();
      return true;
    },
    carica(svg, nome) {
      const coiFori = svgForiAiLoroColori(svg);
      // l'SVG dichiara le sue misure: una larghezza reale lo riscalerebbe e il ritorno non cadrebbe più al suo posto
      params.realWidthMm = 0;
      params.enableExclusionAreas = true;
      for (const k of ROLE_ORDER) delete roleColor[k];
      const primo = primoColoreStilista(coiFori);
      if (primo) roleColor.MASTER_OUTLINE = primo.toLowerCase();
      applyParamsToControls();
      loadPanel(parseSvgToContours(coiFori), nome);
      svgStilista = coiFori;
    },
    sorgente: () => svgStilista,
    strati() {
      readParams();
      return stratiCuciti(exportLayersFor(lastResult ?? generate()));
    },
    dst: () => ({ bytes: costruisciDst(), nome: (panelName ? panelName.replace(/\.[^.]+$/, '') : 'oblique') + '-oblique' }),
    stato: (testo) => setStatus(testo),
  };

  async function doExportDst(): Promise<void> {
    const bytes = costruisciDst();
    const base = (panelName ? panelName.replace(/\.[^.]+$/, '') : 'oblique') + '.dst';
    setStatus(saveOutcomeMessage(await saveBinaryFile(bytes, { suggestedName: base, ...DST_FILE }), base));
  }
  $('exportBtn').addEventListener('click', () => { void doExportSvg(); });
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
  collegaStilista(aggancio, { prendi: $('fromStilista'), invia: $('toStilistaBtn') });
}

import '@rg/ui/rg.css';
import './pg.css';
import {
  generatePattern, parseImportedBoundarySource,
  type PatternConfig, type ImportedBoundaryModel, type ImportScaleMode,
} from '@rg/pattern-grammar';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveOutcomeMessage } from '@rg/ui/save';
import { FORMATO, CORPO, ALL_FIELD_GROUPS, SCALE_MODES, type Field, type Group } from './fields';

const PRESET_KEY = 'pattern-grammar-engine-presets';

/** Config iniziale = i valori di default dichiarati nello schema dei campi. */
function initialConfig(): PatternConfig {
  const cfg: Record<string, unknown> = {};
  for (const g of ALL_FIELD_GROUPS) for (const f of g.fields) cfg[f.name] = f.value;
  return cfg as PatternConfig;
}

/** Monta il tool "Generatore pattern" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountPatternGrammar(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Generatore pattern', opts.backHref)}
  <div class="rg-workspace pg-workspace">
    <aside class="rg-workspace__panel" id="panel"></aside>
    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Scarica SVG</button>
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
  const cfg = initialConfig() as Record<string, unknown>;
  let boundaryModel: ImportedBoundaryModel | null = null;
  let boundarySource: { text: string; name: string } | null = null;
  let lastSvg = '';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  // ---- un campo, reso coi componenti DS; il valore mostrato è SEMPRE quello della config corrente ----
  function fieldEl(f: Field): HTMLElement {
    if (f.kind === 'check') {
      const lab = document.createElement('label');
      lab.className = 'rg-choice rg-param-grid__wide';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.id = 'f-' + f.name;
      inp.checked = Boolean(cfg[f.name]);
      inp.addEventListener('change', () => { cfg[f.name] = inp.checked; render(); });
      lab.append(inp, document.createTextNode(' ' + f.label));
      return lab;
    }

    const lab = document.createElement('label');
    lab.className = 'rg-field' + (f.kind === 'select' ? ' rg-param-grid__wide' : (f.help ? ' rg-param-grid__wide' : ''));
    const name = document.createElement('span');
    name.className = 'rg-field__label';
    name.textContent = f.label;
    lab.appendChild(name);

    if (f.kind === 'select') {
      const sel = document.createElement('select');
      sel.className = 'rg-select';
      sel.id = 'f-' + f.name;
      for (const [v, l] of f.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (v === String(cfg[f.name])) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { cfg[f.name] = sel.value; render(); });
      lab.appendChild(sel);
      return lab;
    }

    const wrap = document.createElement('span');
    wrap.className = 'rg-field-with-unit';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'rg-input rg-input--numeric';
    inp.id = 'f-' + f.name;
    inp.step = String(f.step);
    if (f.min !== undefined) inp.min = String(f.min);
    inp.value = String(cfg[f.name] ?? f.value);
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isNaN(v)) { cfg[f.name] = v; render(); }
    });
    const unit = document.createElement('span');
    unit.textContent = f.unit ?? '';
    wrap.append(inp, unit);
    lab.appendChild(wrap);
    if (f.help) {
      const help = document.createElement('small');
      help.className = 'rg-field__help';
      help.textContent = f.help;
      lab.appendChild(help);
    }
    return lab;
  }

  const gridOf = (g: Group): HTMLElement => {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    for (const f of g.fields) grid.appendChild(fieldEl(f));
    return grid;
  };

  /** Sezione di testa (sempre aperta): un semplice gruppo di campi. */
  function headSection(index: string, g: Group): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'rg-param-section';
    sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-param-section__index">${index}</span><h3 class="rg-param-section__title">${g.title}</h3></div>`;
    sec.appendChild(gridOf(g));
    return sec;
  }

  /** Sezione del corpo o della coda: accordion (aperto se `open`). */
  function accordionSection(index: string, title: string, body: HTMLElement, open: boolean): HTMLElement {
    const det = document.createElement('details');
    det.className = 'rg-param-section rg-disclosure';
    det.open = open;
    const sum = document.createElement('summary');
    sum.className = 'rg-param-section__header rg-disclosure__trigger';
    sum.innerHTML = `<span class="rg-param-section__index">${index}</span><span class="rg-param-section__title">${title}</span>`;
    det.append(sum, body);
    return det;
  }

  // ---- Sagoma (testa): import del contorno di ritaglio, opzionale ----
  function sagomaGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="boundaryFile" accept=".svg,.dxf" />
          <span class="rg-button rg-button--outline">Carica DXF o SVG…</span>
        </label>
        <p class="rg-file-input__status" id="boundaryStatus" role="status">Nessun contorno: il piano non viene ritagliato.</p>
      </div>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Scala del file importato</span>
        <select id="scaleMode" class="rg-select">${SCALE_MODES.map(([v, l]) => `<option value="${v}"${v === 'illustrator-72dpi' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="rg-field"><span class="rg-field__label">Larghezza import</span>
        <span class="rg-field-with-unit"><input id="customW" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>
      <label class="rg-field"><span class="rg-field__label">Altezza import</span>
        <span class="rg-field-with-unit"><input id="customH" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>`;
    return box;
  }

  // ---- Colori e ruoli (testa): righe = contorni del file; bersaglio = ignora / confine di ritaglio ----
  function colorMap(): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'rg-color-map';
    ul.id = 'boundaryColors';
    return ul;
  }

  function renderColorMap() {
    const ul = root.querySelector<HTMLElement>('#boundaryColors');
    if (!ul) return;
    ul.innerHTML = '';
    const choices = boundaryModel?.choices ?? [];
    if (!choices.length) {
      ul.innerHTML = '<li><p class="rg-color-map__empty">Nessuna sagoma importata: il piano non viene ritagliato.</p></li>';
      return;
    }
    choices.forEach((c, i) => {
      const active = cfg.importedBoundary === c.boundary && cfg.shapeType === 'imported';
      const none = !c.color;
      const row = document.createElement('li');
      row.className = 'rg-color-map__row';

      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch' + (none ? ' rg-color-map__swatch--none' : '');
      if (!none) sw.style.setProperty('--swatch', c.color!);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = (c.color ? c.color.toUpperCase() : c.label) + ' ';
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = `${c.pathCount} path`;
      code.appendChild(meta);

      const sel = document.createElement('select');
      sel.className = 'rg-select rg-color-map__target';
      sel.setAttribute('aria-label', `Ruolo per ${c.label}`);
      for (const [v, l] of [['', '— (ignora)'], ['confine', 'Confine di ritaglio']] as [string, string][]) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if ((v === 'confine') === active) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        if (sel.value === 'confine') applyChoice(i);
        else clearBoundary();
        renderColorMap();
      });

      row.append(sw, code, sel);
      ul.appendChild(row);
    });
  }

  function buildPanel() {
    const panel = $('panel');
    panel.innerHTML = '';
    const n = (i: number) => String(i).padStart(2, '0');

    // TESTA (sempre aperta): 01 Formato · 02 Sagoma · 03 Colori e ruoli
    panel.appendChild(headSection(n(1), FORMATO));

    const sagoma = headSection(n(2), { title: 'Sagoma', fields: [] });
    sagoma.appendChild(sagomaGrid());
    panel.appendChild(sagoma);

    const colori = headSection(n(3), { title: 'Colori e ruoli', fields: [] });
    colori.appendChild(colorMap());
    panel.appendChild(colori);

    // CORPO (accordion): il primo gruppo aperto, gli altri chiusi
    CORPO.forEach((g, k) => {
      panel.appendChild(accordionSection(n(4 + k), g.title, gridOf(g), !!g.open));
    });

    // CODA (accordion, chiusa): Preset
    panel.appendChild(accordionSection(n(4 + CORPO.length), 'Preset', presetGrid(), false));

    wirePanel();      // il pannello è ricostruibile: gli eventi si ricollegano sempre qui
    renderColorMap();
  }

  function presetGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    grid.innerHTML = `
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome preset</span>
        <input id="presetName" class="rg-input" type="text" placeholder="Es. Base rete"></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Preset disponibili</span>
        <select id="presetList" class="rg-select"><option value="">Seleziona preset</option></select></label>
      <div class="rg-cluster rg-param-grid__wide">
        <button id="savePreset" class="rg-button rg-button--secondary rg-button--small">Salva</button>
        <button id="loadPreset" class="rg-button rg-button--ghost rg-button--small">Carica</button>
        <button id="deletePreset" class="rg-button rg-button--ghost rg-button--small">Elimina</button>
      </div>`;
    return grid;
  }

  // ---- contorno importato ----
  function reparseBoundary() {
    if (!boundarySource) return;
    boundaryModel = parseImportedBoundarySource(boundarySource.text, boundarySource.name, {
      scaleMode: ($('scaleMode') as HTMLSelectElement).value as ImportScaleMode,
      customWidthMm: parseFloat(($('customW') as HTMLInputElement).value),
      customHeightMm: parseFloat(($('customH') as HTMLInputElement).value),
    });
    $('boundaryStatus').textContent = `${boundarySource.name}: ${boundaryModel.choices.length} contorni. ${boundaryModel.warning ?? ''}`;
    if (boundaryModel.choices.length) applyChoice(0);
    renderColorMap();
  }

  function applyChoice(i: number) {
    const c = boundaryModel?.choices[i];
    if (!c) return;
    cfg.importedBoundary = c.boundary;
    cfg.shapeType = 'imported';
    const shapeSel = root.querySelector<HTMLSelectElement>('#f-shapeType');
    if (shapeSel) shapeSel.value = 'imported';
    render();
  }

  function clearBoundary() {
    cfg.importedBoundary = undefined;
    if (cfg.shapeType === 'imported') cfg.shapeType = 'none';
    const shapeSel = root.querySelector<HTMLSelectElement>('#f-shapeType');
    if (shapeSel) shapeSel.value = 'none';
    render();
  }

  // ---- preset ----
  /** Porta un preset salvato coi vecchi nomi/unità sui campi nuovi (⑥⑦⑧), senza perdere i valori. */
  function migratePreset(p: PatternConfig): PatternConfig {
    const c = { ...p } as Record<string, unknown>;
    if (c.minStitchMm === undefined && c.minPointDistance !== undefined) c.minStitchMm = c.minPointDistance;
    if (c.maxStitchMm === undefined && c.maxStitchLength !== undefined) c.maxStitchMm = c.maxStitchLength;
    if (c.constructionStroke === undefined && c.strokeWidth !== undefined) c.constructionStroke = c.strokeWidth;
    if (c.columnWaveLengthMm === undefined && typeof c.columnWaveFrequency === 'number') {
      c.columnWaveLengthMm = c.columnWaveFrequency > 0 ? (2 * Math.PI) / c.columnWaveFrequency : 60;
    }
    if (c.columnWavePhaseDeg === undefined && typeof c.columnWavePhase === 'number') {
      c.columnWavePhaseDeg = (c.columnWavePhase * 180) / Math.PI;
    }
    // Via i nomi vecchi, così il pannello legge solo i nuovi.
    delete c.minPointDistance; delete c.minSegmentLength; delete c.maxStitchLength;
    delete c.strokeWidth; delete c.columnWaveFrequency; delete c.columnWavePhase;
    return c as PatternConfig;
  }

  const readPresets = (): Record<string, PatternConfig> => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch { return {}; }
  };
  function refreshPresetList() {
    const sel = root.querySelector<HTMLSelectElement>('#presetList');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleziona preset</option>';
    for (const name of Object.keys(readPresets())) {
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      sel.appendChild(o);
    }
  }

  /** Ricollega gli eventi degli elementi generati (il pannello può essere ricostruito). */
  function wirePanel() {
    $('boundaryFile').addEventListener('change', (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { boundarySource = { text: String(reader.result), name: file.name }; reparseBoundary(); }
        catch (e) { $('boundaryStatus').textContent = 'Errore import: ' + (e as Error).message; }
      };
      reader.readAsText(file);
    });
    $('scaleMode').addEventListener('change', reparseBoundary);
    $('customW').addEventListener('change', reparseBoundary);
    $('customH').addEventListener('change', reparseBoundary);

    $('savePreset').addEventListener('click', () => {
      const name = ($('presetName') as HTMLInputElement).value.trim();
      if (!name) { $('status').textContent = 'Dai un nome al preset.'; return; }
      const presets = readPresets();
      presets[name] = { ...(cfg as PatternConfig) };
      localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
      refreshPresetList();
      $('status').textContent = `Preset "${name}" salvato.`;
    });
    $('loadPreset').addEventListener('click', () => {
      const name = ($('presetList') as HTMLSelectElement).value;
      const preset = readPresets()[name];
      if (!preset) return;
      Object.assign(cfg, migratePreset(preset));
      buildPanel();          // ricostruisce coi valori del preset (e ricollega gli eventi)
      refreshPresetList();
      render();
      $('status').textContent = `Preset "${name}" caricato.`;
    });
    $('deletePreset').addEventListener('click', () => {
      const name = ($('presetList') as HTMLSelectElement).value;
      if (!name) return;
      const presets = readPresets();
      delete presets[name];
      localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
      refreshPresetList();
    });

    refreshPresetList();
  }

  function render() {
    try {
      lastSvg = generatePattern(cfg as PatternConfig);
      $('layer').innerHTML = lastSvg;
      const w = /width="([\d.]+)mm"/.exec(lastSvg)?.[1];
      const h = /height="([\d.]+)mm"/.exec(lastSvg)?.[1];
      $('status').textContent = `${w ?? '?'} × ${h ?? '?'} mm`;
    } catch (e) {
      $('status').textContent = 'Errore: ' + (e as Error).message;
      console.error(e);
    }
  }

  // azioni fisse (non rigenerate)
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('exportBtn').addEventListener('click', async () => {
    if (!lastSvg) return;
    const base = boundarySource?.name.replace(/\.[^.]+$/, '');
    const name = base ? `${base}-pattern.svg` : 'pattern.svg';
    const outcome = await saveTextFile(lastSvg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  buildPanel();
  render();
}

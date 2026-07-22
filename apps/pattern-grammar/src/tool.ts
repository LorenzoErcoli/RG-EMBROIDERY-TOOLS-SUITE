import '@rg/ui/rg.css';
import './pg.css';
import {
  generatePattern, parseImportedBoundarySource,
  type PatternConfig, type ImportedBoundaryModel, type ImportScaleMode,
} from '@rg/pattern-grammar';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveOutcomeMessage } from '@rg/ui/save';
import { GROUPS, SCALE_MODES, type Field } from './fields';

const PRESET_KEY = 'pattern-grammar-engine-presets';

/** Config iniziale = i valori di default dichiarati nello schema dei campi. */
function initialConfig(): PatternConfig {
  const cfg: Record<string, unknown> = {};
  for (const g of GROUPS) for (const f of g.fields) cfg[f.name] = f.value;
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
        <h2 class="rg-h3">Pannello generato</h2>
        <div class="pg__actions">
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

  // ---- campi, resi coi componenti DS; il valore mostrato è SEMPRE quello della config corrente ----
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
    lab.className = 'rg-field' + (f.kind === 'select' ? ' rg-param-grid__wide' : '');
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
    inp.className = 'rg-input rg-mono';
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
      help.className = 'rg-caption rg-u-muted';
      help.textContent = f.help;
      lab.appendChild(help);
    }
    return lab;
  }

  function boundaryBlock(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Import boundary DXF/SVG</span>
        <span class="pg__file"><input type="file" id="boundaryFile" accept=".svg,.dxf" /><span class="rg-button rg-button--outline rg-button--small">Scegli file…</span></span>
        <small id="boundaryStatus" class="rg-caption rg-u-muted">Nessun contorno importato.</small></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Scala SVG importato</span>
        <select id="scaleMode" class="rg-select">${SCALE_MODES.map(([v, l]) => `<option value="${v}"${v === 'illustrator-72dpi' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="rg-field"><span class="rg-field__label">Larghezza import</span>
        <span class="rg-field-with-unit"><input id="customW" class="rg-input rg-mono" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>
      <label class="rg-field"><span class="rg-field__label">Altezza import</span>
        <span class="rg-field-with-unit"><input id="customH" class="rg-input rg-mono" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Colore / layer clipping</span>
        <select id="boundaryChoice" class="rg-select"><option value="">Carica un file boundary</option></select></label>`;
    return box;
  }

  function presetBlock(): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'rg-param-section';
    sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-mono">06</span><h3 class="rg-h3">Preset</h3></div>
      <div class="rg-param-grid">
        <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome preset</span>
          <input id="presetName" class="rg-input" type="text" placeholder="Es. Base rete"></label>
        <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Preset disponibili</span>
          <select id="presetList" class="rg-select"><option value="">Seleziona preset</option></select></label>
        <div class="rg-param-grid__wide pg__actions">
          <button id="savePreset" class="rg-button rg-button--secondary rg-button--small">Salva</button>
          <button id="loadPreset" class="rg-button rg-button--ghost rg-button--small">Carica</button>
          <button id="deletePreset" class="rg-button rg-button--ghost rg-button--small">Elimina</button>
        </div>
      </div>`;
    return sec;
  }

  function buildPanel() {
    const panel = $('panel');
    panel.innerHTML = '';
    for (const g of GROUPS) {
      const grid = document.createElement('div');
      grid.className = 'rg-param-grid';
      for (const f of g.fields) grid.appendChild(fieldEl(f));

      if (g.collapsible) {
        const det = document.createElement('details');
        det.className = 'rg-disclosure rg-param-section';
        det.open = !!g.open;
        const sum = document.createElement('summary');
        sum.className = 'rg-disclosure__trigger';
        sum.innerHTML = `<span class="rg-mono">${g.id}</span> ${g.title}`;
        const body = document.createElement('div');
        body.className = 'rg-disclosure__content';
        body.appendChild(grid);
        if (g.id === '05') body.appendChild(boundaryBlock());
        det.append(sum, body);
        panel.appendChild(det);
      } else {
        const sec = document.createElement('section');
        sec.className = 'rg-param-section';
        sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-mono">${g.id}</span><h3 class="rg-h3">${g.title}</h3></div>`;
        sec.appendChild(grid);
        panel.appendChild(sec);
      }
    }
    panel.appendChild(presetBlock());
    wirePanel(); // il pannello è ricostruibile: gli eventi si ricollegano sempre qui
  }

  // ---- contorno importato ----
  function reparseBoundary() {
    if (!boundarySource) return;
    boundaryModel = parseImportedBoundarySource(boundarySource.text, boundarySource.name, {
      scaleMode: ($('scaleMode') as HTMLSelectElement).value as ImportScaleMode,
      customWidthMm: parseFloat(($('customW') as HTMLInputElement).value),
      customHeightMm: parseFloat(($('customH') as HTMLInputElement).value),
    });
    const sel = $('boundaryChoice') as HTMLSelectElement;
    sel.innerHTML = '';
    boundaryModel.choices.forEach((c, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `${c.label} (${c.pathCount} path)`;
      sel.appendChild(o);
    });
    $('boundaryStatus').textContent = `${boundarySource.name}: ${boundaryModel.choices.length} contorni. ${boundaryModel.warning ?? ''}`;
    if (boundaryModel.choices.length) applyChoice(0);
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

  // ---- preset ----
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
    $('boundaryChoice').addEventListener('change', (ev) => applyChoice(Number((ev.target as HTMLSelectElement).value)));

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
      Object.assign(cfg, preset);
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

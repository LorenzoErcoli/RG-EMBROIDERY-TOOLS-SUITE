import '@rg/ui/rg.css';
import './interlace.css';
import {
  type Role, type ImportResult,
  ROLE_LABELS, polygonArea, pointInPolygon,
  buildSvg, buildSvgInSourceFrame,
  parseSvgToContours, parseDxfToContours,
  applyRealWidth, importResultFromContours, measureContours,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveOutcomeMessage } from '@rg/ui/save';
import { runPipeline, type RoleAssignment } from './pipeline';
import { defaultInterlaceParams, type InterlaceParams } from './engine';
import { sampleContours } from './sample';

/** Un campo numerico del gruppo "Riempimento". L'unità va nello slot del DS, mai nell'etichetta. */
interface Field { key: keyof InterlaceParams; label: string; unit: string; step: number; help?: string; }

// Solo parametri canonici §3 in questa prima versione. "Movimento/spigolosità" e palette in commit successivi.
const PARAMS: Field[] = [
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.5, help: 'lunghezza minima di un passaggio' },
  { key: 'maxStitchMm', label: 'Lunghezza massima del punto', unit: 'mm', step: 0.5, help: 'i passaggi non superano questa misura' },
  { key: 'densitySpacingMm', label: 'Densità (distanza tra le file di filo)', unit: 'mm', step: 0.1, help: 'più piccola = più fitto e coprente' },
  { key: 'voidClearanceMm', label: 'Distanza di sicurezza da bordi e vuoti', unit: 'mm', step: 0.1 },
];

// Questo tool usa solo due ruoli: l'area da ricamare e le aree vuote.
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'EXCLUSION'];

/** Monta il tool "Interlace" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountInterlace(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Interlace', opts.backHref)}
  <div class="rg-workspace interlace-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Cartamodello</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="fileInput" accept=".svg,.dxf" />
              <span class="rg-button rg-button--outline">Carica DXF o SVG…</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus" role="status">Nessun file: uso il cartamodello demo.</p>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Larghezza reale (0 = auto)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidth" type="number" min="0" step="1" value="0"><span>mm</span></span>
            <small class="rg-field__help">0 = usa la misura letta dal file.</small>
          </label>
          <div class="rg-cluster rg-param-grid__wide"><button id="sampleBtn" class="rg-button rg-button--ghost" type="button">Cartamodello demo</button></div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Colori e ruoli</h3></div>
        <ul class="rg-color-map" id="roles"></ul>
      </section>

      <details class="rg-param-section rg-disclosure" id="paletteSection" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Colori del filo</span></summary>
        <ul class="rg-color-map" id="paletteList"></ul>
        <div class="rg-cluster">
          <button type="button" id="addColorBtn" class="rg-button rg-button--ghost rg-button--small">Aggiungi colore</button>
        </div>
        <div class="rg-param-grid">
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Ripetizioni della sequenza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="paletteCycles" type="number" min="1" step="1" value="1"><span>cicli</span></span>
            <small class="rg-field__help">quante volte l’intera sequenza di colori si ripete lungo il tracciato (genera i cambi-ago)</small>
          </label>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Riempimento</span></summary>
        <div id="params" class="rg-param-grid"></div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Esporta SVG</button>
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

  let imported: ImportResult = importResultFromContours(sampleContours());
  let roles: RoleAssignment = {};
  const params: InterlaceParams = { ...defaultInterlaceParams };

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const contourColors = () => imported.contours.map((c) => c.color);
  const uniqueColors = () => [...new Set(contourColors())];

  // Pan/zoom del canvas (la vista non si azzera rigenerando l'SVG).
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  // Auto-assegna: il contorno di area maggiore = area da ricamare; una forma di altro colore
  // interamente dentro di esso = area vuota (R12). L'utente può correggere.
  function autoAssign() {
    const cs = currentContours().filter((c) => c.closed);
    if (!cs.length) return;
    let big = cs[0];
    for (const c of cs) if (polygonArea(c.points) > polygonArea(big.points)) big = c;
    if (roles[big.color] === undefined) roles[big.color] = 'MASTER_OUTLINE';
    for (const c of cs) {
      if (c.color !== big.color && roles[c.color] === undefined && c.points.length && pointInPolygon(c.points[0], big.points)) {
        roles[c.color] = 'EXCLUSION';
      }
    }
  }

  function buildParamUI() {
    const host = $('params');
    host.innerHTML = '';
    for (const f of PARAMS) {
      const lab = document.createElement('label');
      lab.className = 'rg-field' + (f.help ? ' rg-param-grid__wide' : '');
      const name = document.createElement('span');
      name.className = 'rg-field__label';
      name.textContent = f.label;
      const wrap = document.createElement('span');
      wrap.className = 'rg-field-with-unit';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'rg-input rg-input--numeric';
      inp.step = String(f.step);
      inp.value = String(params[f.key]);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!Number.isNaN(v)) { (params[f.key] as number) = v; render(); }
      });
      const unit = document.createElement('span');
      unit.textContent = f.unit;
      wrap.append(inp, unit);
      lab.append(name, wrap);
      if (f.help) {
        const help = document.createElement('small');
        help.className = 'rg-field__help';
        help.textContent = f.help;
        lab.appendChild(help);
      }
      host.appendChild(lab);
    }
  }

  function buildRoleUI() {
    const host = $('roles');
    host.innerHTML = '';
    const colors = uniqueColors();
    if (!colors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun cartamodello: carica un DXF o un SVG.</p></li>';
      return;
    }
    const counts = contourColors().reduce<Record<string, number>>((m, c) => (m[c] = (m[c] ?? 0) + 1, m), {});
    for (const color of colors) {
      const none = color === 'none';
      const row = document.createElement('li');
      row.className = 'rg-color-map__row';

      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch' + (none ? ' rg-color-map__swatch--none' : '');
      if (!none) sw.style.setProperty('--swatch', color);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = none ? 'nessun colore ' : color.toUpperCase() + ' ';
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = `${counts[color]} contorni`;
      code.appendChild(meta);

      const sel = document.createElement('select');
      sel.className = 'rg-select rg-color-map__target';
      sel.setAttribute('aria-label', `Ruolo per ${none ? 'i contorni senza colore' : color}`);
      for (const r of ROLE_OPTIONS) {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = r === '' ? '— (ignora)' : ROLE_LABELS[r];
        if (roles[color] === r || (r === '' && roles[color] === undefined)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { roles[color] = (sel.value || undefined) as Role | undefined; render(); });

      row.append(sw, code, sel);
      host.appendChild(row);
    }
  }

  // ---- Palette "Colori del filo": righe rg-color-map con picker nativo (markup del subagent design-system) ----
  const MAX_COLORS = 8;
  const NEW_COLORS = ['#8a5a44', '#4f7d9c', '#b0863b', '#6a7d4f', '#9c4f6a', '#3f6f7d'];
  const asHex6 = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#888888');

  function buildPaletteUI() {
    const host = $('paletteList');
    host.innerHTML = '';
    params.colors.forEach((col, i) => {
      const li = document.createElement('li');
      li.className = 'rg-color-map__row';
      li.dataset.colorIndex = String(i);

      const sw = document.createElement('label');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', col);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'rg-u-visually-hidden';
      picker.value = asHex6(col);
      picker.setAttribute('aria-label', `Colore ${i + 1}`);

      const cluster = document.createElement('span');
      cluster.className = 'rg-cluster';
      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = col.toUpperCase();
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rg-icon-button rg-icon-button--danger';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Rimuovi colore ${i + 1} (${col.toUpperCase()})`);
      rm.disabled = params.colors.length <= 1;
      rm.addEventListener('click', () => {
        if (params.colors.length <= 1) return;
        params.colors.splice(i, 1);
        buildPaletteUI();
        render();
      });
      picker.addEventListener('input', () => {
        params.colors[i] = picker.value;
        sw.style.setProperty('--swatch', picker.value);
        code.textContent = picker.value.toUpperCase();
        rm.setAttribute('aria-label', `Rimuovi colore ${i + 1} (${picker.value.toUpperCase()})`);
        render();
      });

      sw.appendChild(picker);
      cluster.append(code, rm);
      li.append(sw, cluster);
      host.appendChild(li);
    });
    ($('addColorBtn') as HTMLButtonElement).disabled = params.colors.length >= MAX_COLORS;
  }

  function render() {
    try {
      const { layers, bounds, threadMm } = runPipeline(currentContours(), roles, params);
      $('layer').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
      $('status').textContent = threadMm > 0 ? `Filo generato: ${(threadMm / 1000).toFixed(2)} m` : 'Assegna un colore all’area da ricamare';
    } catch (e) {
      $('status').textContent = 'Errore render: ' + (e as Error).message;
      console.error(e);
    }
  }

  let sourceName = '';

  function updateFileStatus(label: string) {
    const eff = measureContours(currentContours());
    const detected = `${Math.round(imported.widthMm)}×${Math.round(imported.heightMm)} mm (${imported.method})`;
    const effStr = params.realWidthMm > 0 ? ` → reale ${Math.round(eff.widthMm)}×${Math.round(eff.heightMm)} mm` : '';
    const hint = imported.method === 'dpi' && !params.realWidthMm ? ' · imposta la larghezza reale' : '';
    $('fileStatus').textContent = `${label}: ${detected}${effStr} · ${imported.contours.length} contorni${hint}`;
  }

  function loadImport(result: ImportResult, label: string) {
    imported = result;
    autoAssign();
    buildRoleUI();
    render();
    updateFileStatus(label);
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const result = /\.dxf$/i.test(file.name) ? parseDxfToContours(text) : parseSvgToContours(text);
        sourceName = file.name.replace(/\.[^.]+$/, '');
        loadImport(result, file.name);
      } catch (e) {
        $('fileStatus').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    reader.readAsText(file);
  });

  $('realWidth').addEventListener('change', () => {
    const v = parseFloat(($('realWidth') as HTMLInputElement).value);
    params.realWidthMm = Number.isNaN(v) ? 0 : Math.max(0, v);
    render();
    updateFileStatus(sourceName || 'Cartamodello');
  });

  $('addColorBtn').addEventListener('click', () => {
    if (params.colors.length >= MAX_COLORS) return;
    params.colors.push(NEW_COLORS[(params.colors.length - 1) % NEW_COLORS.length]);
    buildPaletteUI();
    render();
  });
  ($('paletteCycles') as HTMLInputElement).value = String(params.paletteCycles);
  $('paletteCycles').addEventListener('change', () => {
    const v = parseInt(($('paletteCycles') as HTMLInputElement).value, 10);
    params.paletteCycles = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });

  $('sampleBtn').addEventListener('click', () => { roles = {}; sourceName = ''; loadImport(importResultFromContours(sampleContours()), 'Cartamodello demo'); });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    const { layers, bounds } = runPipeline(currentContours(), roles, params);
    const metadata = { rgProject: 'interlace', version: '0.1.0', params, roles };
    let svg: string;
    if (imported.frame) {
      const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
      svg = buildSvgInSourceFrame(layers, { frame: imported.frame, realWidthFactor: r, metadata });
    } else {
      svg = buildSvg(layers, { bounds, marginMm: 8, metadata });
    }
    const name = sourceName ? `${sourceName}-interlace.svg` : 'interlace.svg';
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  buildParamUI();
  buildPaletteUI();
  loadImport(imported, 'Cartamodello demo');
}

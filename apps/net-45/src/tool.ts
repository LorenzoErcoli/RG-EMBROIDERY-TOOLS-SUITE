import '@rg/ui/rg.css';
import './net45.css';
import {
  type Role, type NetParams, type ImportResult,
  ROLE_LABELS, defaultNetParams, buildSvg, buildSvgInSourceFrame,
  parseSvgToContours, parseDxfToContours,
  applyRealWidth, importResultFromContours, measureContours,
  dstFromExportLayers, DST_FILE,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { runPipeline, type RoleAssignment } from './pipeline';
import { sampleContours } from './sample';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';

/** Un campo del gruppo "Parametri". `check` = sì/no (interno 1/0). `unit` va nello slot del DS, mai nell'etichetta (R-panello). */
type Field =
  | { key: keyof NetParams; label: string; unit: string; step: number; help?: string; kind?: 'num' }
  | { key: keyof NetParams; label: string; kind: 'check' };

// Ordine e nomi decisi con Lorenzo (REVISIONE-PARAMETRI.md). `realWidthMm` sta nel gruppo Sagoma, non qui.
const PARAMS: Field[] = [
  { key: 'squareSizeMm', label: 'Lato del quadrato', unit: 'mm', step: 0.5 },
  { key: 'angleADeg', label: 'Angolo diagonali principali', unit: '°', step: 1 },
  { key: 'angleBDeg', label: 'Angolo diagonali secondarie', unit: '°', step: 1 },
  { key: 'netInsetMm', label: 'Rientro della rete dal bordo', unit: 'mm', step: 0.5 },
  { key: 'netOffsetXMm', label: 'Sposta rete — orizzontale', unit: 'mm', step: 1 },
  { key: 'netOffsetYMm', label: 'Sposta rete — verticale', unit: 'mm', step: 1 },
  { key: 'rasoBandMm', label: 'Spessore della fascia di raso', unit: 'mm', step: 1 },
  { key: 'rasoDownwardOnly', label: 'Raso solo sui bordi bassi e laterali', kind: 'check' },
  { key: 'cordWidthMm', label: 'Larghezza del cordoncino', unit: 'mm', step: 0.1 },
  { key: 'cordInterlineMm', label: 'Interlinea del cordoncino', unit: 'mm', step: 0.05, help: 'distanza tra un punto e il successivo lungo il filo' },
  { key: 'travelStitchMm', label: 'Lunghezza del punto nei passaggi', unit: 'mm', step: 0.5 },
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.1 },
];
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'NET_AREA', 'SATIN_AREA', 'SQUARE_AREA', 'BORDER', 'EXCLUSION'];

/** Monta il tool "Rete 45°" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountNet45(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Rete 45°', opts.backHref)}
  <div class="rg-workspace net45-workspace">
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

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Parametri</span></summary>
        <div id="params" class="rg-param-grid"></div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
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
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  let imported: ImportResult = importResultFromContours(sampleContours());
  let roles: RoleAssignment = {};
  const params: NetParams = { ...defaultNetParams };

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const contourColors = () => imported.contours.map((c) => c.color);
  const uniqueColors = () => [...new Set(contourColors())];

  // Pan/zoom del canvas (la vista non si azzera rigenerando l'SVG).
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function autoAssign() {
    const colors = uniqueColors();
    if (colors.length === 1 && roles[colors[0]] === undefined) roles[colors[0]] = 'MASTER_OUTLINE';
  }

  // ---- Parametri: componenti DS, unità nello slot, sì/no come casella di spunta ----
  function buildParamUI() {
    const host = $('params');
    host.innerHTML = '';
    for (const f of PARAMS) {
      if (f.kind === 'check') {
        const lab = document.createElement('label');
        lab.className = 'rg-choice rg-param-grid__wide';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.checked = (params[f.key] as number) !== 0;
        inp.addEventListener('change', () => { (params[f.key] as number) = inp.checked ? 1 : 0; render(); });
        lab.append(inp, document.createTextNode(' ' + f.label));
        host.appendChild(lab);
        continue;
      }
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

  // ---- Colori → ruoli: componente DS rg-color-map (campione + codice colore + conteggio + bersaglio) ----
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

  function render() {
    try {
      const { layers, bounds } = runPipeline(currentContours(), roles, params);
      $('layer').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
    } catch (e) {
      $('status').textContent = 'Errore render: ' + (e as Error).message;
      console.error(e);
    }
  }

  /** Nome del file di partenza (senza estensione): serve a proporre un nome d'export sensato. */
  let sourceName = '';

  /** Aggiorna la riga di provenienza del file (nome, misura, metodo, quantità) — è lo status del componente Sagoma. */
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

  $('sampleBtn').addEventListener('click', () => { roles = {}; sourceName = ''; loadImport(importResultFromContours(sampleContours()), 'Cartamodello demo'); });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    const { layers, bounds } = runPipeline(currentContours(), roles, params);
    const metadata = { rgProject: 'net-45', version: '0.1.0', params, roles, generatedAt: Date.now() };
    let svg: string;
    if (imported.frame) {
      const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
      svg = buildSvgInSourceFrame(layers, { frame: imported.frame, realWidthFactor: r, metadata });
    } else {
      svg = buildSvg(layers, { bounds, marginMm: 8, metadata });
    }
    const name = sourceName ? `${sourceName}-rete45.svg` : 'rete-45.svg';
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  $('exportDstBtn').addEventListener('click', async () => {
    // Export ricamo Tajima .dst tramite la "possibilità" globale del core: i layer del pipeline sono già in
    // mm reali; l'adattatore cuce i layer non-forma (rete/cordoncini), un blocco per polilinea.
    const { layers } = runPipeline(currentContours(), roles, params);
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(layers, { label: (sourceName || 'RETE45').toUpperCase().slice(0, 16) });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = sourceName ? `${sourceName}-rete45.dst` : 'rete-45.dst';
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  buildParamUI();
  loadImport(imported, 'Cartamodello demo');
}

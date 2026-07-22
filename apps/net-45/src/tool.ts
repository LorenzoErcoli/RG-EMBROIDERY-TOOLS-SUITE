import '@rg/ui/rg.css';
import './net45.css';
import {
  type Role, type NetParams, type ImportResult,
  ROLE_LABELS, defaultNetParams, buildSvg, buildSvgInSourceFrame,
  parseSvgToContours, parseDxfToContours,
  applyRealWidth, importResultFromContours, measureContours,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { runPipeline, type RoleAssignment } from './pipeline';
import { sampleContours } from './sample';
import { hookPanZoom } from '@rg/ui/panzoom';

const PARAM_UI: { key: keyof NetParams; label: string; step: number }[] = [
  { key: 'realWidthMm', label: '★ Larghezza reale mm (0=auto)', step: 1 },
  { key: 'squareSizeMm', label: 'Lato quadrato (rete) mm', step: 0.5 },
  { key: 'angleADeg', label: 'Angolo A °', step: 1 },
  { key: 'angleBDeg', label: 'Angolo B °', step: 1 },
  { key: 'netInsetMm', label: 'Rientro rete mm', step: 0.5 },
  { key: 'netOffsetXMm', label: 'Sposta rete X mm', step: 1 },
  { key: 'netOffsetYMm', label: 'Sposta rete Y mm', step: 1 },
  { key: 'rasoBandMm', label: 'Fascia raso bordo mm', step: 1 },
  { key: 'rasoDownwardOnly', label: 'Raso solo sotto (1/0)', step: 1 },
  { key: 'cordWidthMm', label: 'Largh. cordoncino mm', step: 0.1 },
  { key: 'cordDensityMm', label: 'Densità cordoncino mm', step: 0.05 },
  { key: 'travelStitchMm', label: 'Punto passaggi mm', step: 0.5 },
  { key: 'minStitchMm', label: 'Punto minimo mm', step: 0.1 },
];
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'NET_AREA', 'SATIN_AREA', 'SQUARE_AREA', 'BORDER', 'EXCLUSION'];

/** Monta il tool "Rete 45°" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountNet45(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Rete 45°', opts.backHref)}
  <div class="rg-workspace net45-workspace" style="--rg-workspace-panel: var(--rg-layout-sidebar)">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">01</span><h3 class="rg-h3">Sagoma</h3></div>
        <label class="net45__file"><input type="file" id="fileInput" accept=".svg,.dxf" /><span class="rg-button rg-button--outline rg-button--small">Carica DXF o SVG…</span></label>
        <button id="sampleBtn" class="rg-button rg-button--ghost rg-button--small">Sagoma demo</button>
      </section>
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">02</span><h3 class="rg-h3">Colori → ruoli</h3></div>
        <div id="roles"></div>
      </section>
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">03</span><h3 class="rg-h3">Parametri</h3></div>
        <div id="params" class="rg-param-grid"></div>
      </section>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="net45__actions">
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Esporta SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">—</span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  let imported: ImportResult = importResultFromContours(sampleContours());
  let roles: RoleAssignment = {};
  const params: NetParams = { ...defaultNetParams };

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const uniqueColors = () => [...new Set(imported.contours.map((c) => c.color))];

  // Pan/zoom del canvas (la vista non si azzera rigenerando l'SVG).
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function autoAssign() {
    const colors = uniqueColors();
    if (colors.length === 1 && roles[colors[0]] === undefined) roles[colors[0]] = 'MASTER_OUTLINE';
  }

  function buildParamUI() {
    const host = $('params');
    host.innerHTML = '';
    for (const d of PARAM_UI) {
      const field = document.createElement('label');
      field.className = 'rg-field rg-param-grid__wide';
      const lab = document.createElement('span');
      lab.className = 'rg-field__label';
      lab.textContent = d.label;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'rg-input rg-mono';
      inp.step = String(d.step);
      inp.value = String(params[d.key]);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!Number.isNaN(v)) { (params[d.key] as number) = v; render(); }
      });
      field.append(lab, inp);
      host.appendChild(field);
    }
  }

  function buildRoleUI() {
    const host = $('roles');
    host.innerHTML = '';
    const colors = uniqueColors();
    if (!colors.length) { host.innerHTML = '<div class="rg-caption rg-u-muted">Nessuna sagoma.</div>'; return; }
    for (const color of colors) {
      const row = document.createElement('div');
      row.className = 'net45__rrow';
      const sw = document.createElement('span');
      sw.className = 'net45__swatch';
      sw.style.background = color === 'none' ? 'transparent' : color;
      const sel = document.createElement('select');
      sel.className = 'rg-select';
      for (const r of ROLE_OPTIONS) {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = r === '' ? '— (ignora)' : ROLE_LABELS[r];
        if (roles[color] === r || (r === '' && roles[color] === undefined)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { roles[color] = (sel.value || undefined) as Role | undefined; render(); });
      row.append(sw, sel);
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

  function loadImport(result: ImportResult, label: string) {
    imported = result;
    autoAssign();
    buildRoleUI();
    render();
    const eff = measureContours(currentContours());
    const detected = `${Math.round(result.widthMm)}×${Math.round(result.heightMm)} mm (${result.method})`;
    const effStr = params.realWidthMm > 0 ? ` → reale ${Math.round(eff.widthMm)}×${Math.round(eff.heightMm)} mm` : '';
    const hint = result.method === 'dpi' && !params.realWidthMm ? ' · imposta ★ larghezza reale' : '';
    $('status').textContent = `${label}: ${detected}${effStr}. ${result.contours.length} contorni.${hint}`;
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const result = /\.dxf$/i.test(file.name) ? parseDxfToContours(text) : parseSvgToContours(text);
        loadImport(result, file.name);
      } catch (e) {
        $('status').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    reader.readAsText(file);
  });

  $('sampleBtn').addEventListener('click', () => { roles = {}; loadImport(importResultFromContours(sampleContours()), 'Sagoma demo'); });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', () => {
    const { layers, bounds } = runPipeline(currentContours(), roles, params);
    const metadata = { rgProject: 'net-45', version: '0.1.0', params, roles, generatedAt: Date.now() };
    let svg: string;
    if (imported.frame) {
      const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
      svg = buildSvgInSourceFrame(layers, { frame: imported.frame, realWidthFactor: r, metadata });
    } else {
      svg = buildSvg(layers, { bounds, marginMm: 8, metadata });
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rete-45.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  buildParamUI();
  loadImport(imported, 'Sagoma demo');
}

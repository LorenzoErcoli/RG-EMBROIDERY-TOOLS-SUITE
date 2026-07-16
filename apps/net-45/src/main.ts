import {
  type Role, type NetParams, type ImportResult,
  ROLE_LABELS, defaultNetParams, buildSvg, buildSvgInSourceFrame,
  parseSvgToContours, parseDxfToContours,
  applyRealWidth, importResultFromContours, measureContours,
} from '@rg/core';
import { runPipeline, type RoleAssignment } from './pipeline';
import { sampleContours } from './sample';

let imported: ImportResult = importResultFromContours(sampleContours());
let roles: RoleAssignment = {};
const params: NetParams = { ...defaultNetParams };

const $ = (id: string) => document.getElementById(id)!;

const PARAM_UI: { key: keyof NetParams; label: string; step: number }[] = [
  { key: 'realWidthMm', label: '★ Larghezza reale mm (0=auto)', step: 1 },
  { key: 'squareSizeMm', label: 'Lato quadrato (rete) mm', step: 0.5 },
  { key: 'angleADeg', label: 'Angolo A °', step: 1 },
  { key: 'angleBDeg', label: 'Angolo B °', step: 1 },
  { key: 'netInsetMm', label: 'Rientro rete mm', step: 0.5 },
  { key: 'netOffsetXMm', label: 'Sposta rete X mm', step: 1 },
  { key: 'netOffsetYMm', label: 'Sposta rete Y mm', step: 1 },
  { key: 'cordWidthMm', label: 'Largh. cordoncino mm', step: 0.1 },
  { key: 'cordDensityMm', label: 'Densità cordoncino mm', step: 0.05 },
  { key: 'travelStitchMm', label: 'Punto passaggi mm', step: 0.5 },
  { key: 'satinDensityMm', label: 'Densità raso mm', step: 0.05 },
  { key: 'squareDensityMm', label: 'Densità quadratini mm', step: 0.05 },
  { key: 'minStitchMm', label: 'Punto minimo mm', step: 0.1 },
];

const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'NET_AREA', 'SATIN_AREA', 'SQUARE_AREA', 'BORDER', 'EXCLUSION'];

const currentContours = () => applyRealWidth(imported, params.realWidthMm);
const uniqueColors = () => [...new Set(imported.contours.map((c) => c.color))];

function autoAssign() {
  const colors = uniqueColors();
  if (colors.length === 1 && roles[colors[0]] === undefined) roles[colors[0]] = 'MASTER_OUTLINE';
}

function buildParamUI() {
  const host = $('params');
  host.innerHTML = '';
  for (const d of PARAM_UI) {
    const row = document.createElement('div');
    row.className = 'p';
    const lab = document.createElement('label');
    lab.textContent = d.label;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = String(d.step);
    inp.value = String(params[d.key]);
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isNaN(v)) { (params[d.key] as number) = v; render(); }
    });
    row.append(lab, inp);
    host.appendChild(row);
  }
}

function buildRoleUI() {
  const host = $('roles');
  host.innerHTML = '';
  const colors = uniqueColors();
  if (!colors.length) { host.innerHTML = '<div class="status">Nessuna sagoma.</div>'; return; }
  for (const color of colors) {
    const row = document.createElement('div');
    row.className = 'role-row';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = color === 'none' ? 'transparent' : color;
    const sel = document.createElement('select');
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
    $('preview').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
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

$('exportBtn').addEventListener('click', () => {
  const { layers, bounds } = runPipeline(currentContours(), roles, params);
  const metadata = { rgProject: 'net-45', version: '0.1.0', params, roles, generatedAt: Date.now() };
  // R27: se importato da file, esporta nel frame della sorgente → si sovrappone all'input.
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

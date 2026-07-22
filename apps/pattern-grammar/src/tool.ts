import '@rg/ui/rg.css';
import './pg.css';
import {
  generatePattern, parseImportedBoundarySource,
  type PatternConfig, type ShapeType, type ImportedBoundaryModel,
} from '@rg/pattern-grammar';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';

type NumKey = 'totalWidth' | 'totalHeight' | 'horizontalZigzagWidth' | 'horizontalZigzagHeight'
  | 'horizontalZigzagSpacing' | 'verticalZigzagWidth' | 'cellWidth' | 'parameterScalePercent'
  | 'strokeWidth' | 'maxStitchLength' | 'minSegmentLength';

const PARAMS: { key: NumKey; label: string; step: number; group: number }[] = [
  { key: 'totalWidth', label: 'Larghezza totale mm', step: 5, group: 2 },
  { key: 'totalHeight', label: 'Altezza totale mm', step: 5, group: 2 },
  { key: 'cellWidth', label: 'Passo colonna mm', step: 0.1, group: 3 },
  { key: 'horizontalZigzagSpacing', label: 'Passo riga mm', step: 0.5, group: 3 },
  { key: 'horizontalZigzagWidth', label: 'Largh. zig-zag orizz. mm', step: 0.1, group: 3 },
  { key: 'horizontalZigzagHeight', label: 'Alt. zig-zag orizz. mm', step: 0.1, group: 3 },
  { key: 'verticalZigzagWidth', label: 'Largh. zig-zag vert. mm', step: 0.1, group: 3 },
  { key: 'parameterScalePercent', label: 'Scala parametri %', step: 5, group: 3 },
  { key: 'strokeWidth', label: 'Spessore tratto mm', step: 0.05, group: 4 },
  { key: 'maxStitchLength', label: 'Punto massimo mm (0=off)', step: 0.5, group: 4 },
  { key: 'minSegmentLength', label: 'Punto minimo mm (0=off)', step: 0.1, group: 4 },
];

const SHAPES: { value: ShapeType; label: string }[] = [
  { value: 'none', label: 'Nessuna (rettangolo pieno)' },
  { value: 'rectangle', label: 'Rettangolo' },
  { value: 'circle', label: 'Cerchio' },
  { value: 'diamond', label: 'Rombo' },
  { value: 'imported', label: 'Sagoma importata' },
];

/** Monta il tool "Pattern cannage" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountPatternGrammar(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Pattern cannage', opts.backHref)}
  <div class="rg-workspace pg-workspace" style="--rg-workspace-panel: var(--rg-layout-sidebar)">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">01</span><h3 class="rg-h3">Sagoma</h3></div>
        <label class="rg-field"><span class="rg-field__label">Forma</span>
          <select id="shapeType" class="rg-select"></select></label>
        <label class="pg__file"><input type="file" id="fileInput" accept=".svg,.dxf" /><span class="rg-button rg-button--outline rg-button--small">Importa DXF o SVG…</span></label>
        <label class="rg-field" id="choiceField" hidden><span class="rg-field__label">Contorno</span>
          <select id="boundaryChoice" class="rg-select"></select></label>
      </section>
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">02</span><h3 class="rg-h3">Dimensioni</h3></div>
        <div id="g2" class="rg-param-grid"></div>
      </section>
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">03</span><h3 class="rg-h3">Modulo e densità</h3></div>
        <div id="g3" class="rg-param-grid"></div>
      </section>
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-mono">04</span><h3 class="rg-h3">Tracciato</h3></div>
        <div id="g4" class="rg-param-grid"></div>
      </section>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="pg__actions">
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

  const config: PatternConfig = {
    totalWidth: 200, totalHeight: 150,
    cellWidth: 5.2, horizontalZigzagSpacing: 12,
    horizontalZigzagWidth: 5.5, horizontalZigzagHeight: 4.3,
    verticalZigzagWidth: 1.2, parameterScalePercent: 100,
    strokeWidth: 0.3, maxStitchLength: 0, minSegmentLength: 0,
    shapeType: 'none',
  };
  let boundaryModel: ImportedBoundaryModel | null = null;
  let lastSvg = '';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function render() {
    try {
      lastSvg = generatePattern(config);
      $('layer').innerHTML = lastSvg;
      const w = /width="([\d.]+)mm"/.exec(lastSvg)?.[1];
      const h = /height="([\d.]+)mm"/.exec(lastSvg)?.[1];
      const els = (lastSvg.match(/<(polyline|path)\b/g) || []).length;
      $('status').textContent = `${w ?? '?'} × ${h ?? '?'} mm · ${els} tracciat${els === 1 ? 'o' : 'i'}`;
    } catch (e) {
      $('status').textContent = 'Errore: ' + (e as Error).message;
      console.error(e);
    }
  }

  function buildParams() {
    for (const g of [2, 3, 4]) {
      const host = $('g' + g);
      host.innerHTML = '';
      for (const d of PARAMS.filter((p) => p.group === g)) {
        const field = document.createElement('label');
        field.className = 'rg-field rg-param-grid__wide';
        const lab = document.createElement('span');
        lab.className = 'rg-field__label';
        lab.textContent = d.label;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'rg-input rg-mono';
        inp.step = String(d.step);
        inp.value = String(config[d.key] ?? 0);
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value);
          if (!Number.isNaN(v)) { (config[d.key] as number) = v; render(); }
        });
        field.append(lab, inp);
        host.appendChild(field);
      }
    }
  }

  // Forma
  const shapeSel = $('shapeType') as HTMLSelectElement;
  for (const s of SHAPES) {
    const o = document.createElement('option');
    o.value = s.value; o.textContent = s.label;
    if (config.shapeType === s.value) o.selected = true;
    shapeSel.appendChild(o);
  }
  shapeSel.addEventListener('change', () => { config.shapeType = shapeSel.value as ShapeType; render(); });

  // Import sagoma
  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        boundaryModel = parseImportedBoundarySource(String(reader.result), file.name);
        const sel = $('boundaryChoice') as HTMLSelectElement;
        sel.innerHTML = '';
        boundaryModel.choices.forEach((c, i) => {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = `${c.label} (${c.pathCount} path)`;
          sel.appendChild(o);
        });
        $('choiceField').hidden = boundaryModel.choices.length === 0;
        if (boundaryModel.choices.length) {
          config.importedBoundary = boundaryModel.choices[0].boundary;
          config.shapeType = 'imported';
          shapeSel.value = 'imported';
        }
        render();
        $('status').textContent = `${file.name}: ${boundaryModel.choices.length} contorni. ${boundaryModel.warning ?? ''}`;
      } catch (e) {
        $('status').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    reader.readAsText(file);
  });

  ($('boundaryChoice') as HTMLSelectElement).addEventListener('change', (ev) => {
    const i = Number((ev.target as HTMLSelectElement).value);
    if (boundaryModel?.choices[i]) {
      config.importedBoundary = boundaryModel.choices[i].boundary;
      config.shapeType = 'imported';
      shapeSel.value = 'imported';
      render();
    }
  });

  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', () => {
    if (!lastSvg) return;
    const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pattern-cannage.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  buildParams();
  render();
}

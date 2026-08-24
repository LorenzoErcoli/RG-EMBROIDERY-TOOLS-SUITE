import '@rg/ui/rg.css';
import './interlace.css';
import {
  type Role, type ImportResult, type Contour,
  ROLE_LABELS, polygonArea, pointInPolygon,
  buildSvg, buildSvgInSourceFrame, dstFromExportLayers, DST_FILE,
  parseSvgToContours, parseDxfToContours, readProjectMetadata,
  applyRealWidth, importResultFromContours, measureContours,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { runPipeline, type RoleAssignment } from './pipeline';
import { defaultInterlaceParams, type InterlaceParams } from './engine';
import { sampleContours } from './sample';

/** Un campo numerico del gruppo "Riempimento". L'unità va nello slot del DS, mai nell'etichetta. */
interface Field { key: keyof InterlaceParams; label: string; unit: string; step: number; help?: string; }

// Solo parametri canonici §3 in questa prima versione. "Movimento/spigolosità" e palette in commit successivi.
const PARAMS: Field[] = [
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.5, help: 'lunghezza minima di un passaggio' },
  { key: 'maxStitchMm', label: 'Lunghezza massima del punto', unit: 'mm', step: 0.5, help: 'i passaggi non superano questa misura' },
  { key: 'densitySpacingMm', label: 'Densità (distanza tra le file di filo)', unit: 'mm', step: 0.1, help: 'densità di ogni colore, ~0.8–4 mm: piccola = fitto; ~3 è il più rado ancora omogeneo (oltre si ammassa)' },
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
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Oggetto pieno (senza fori)</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="objW" type="number" min="1" step="1" value="100"><span>mm</span></span>
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="objH" type="number" min="1" step="1" value="100"><span>mm</span></span>
            </div>
            <div class="rg-cluster"><button type="button" id="objBtn" class="rg-button rg-button--outline rg-button--small">Genera oggetto</button></div>
            <small class="rg-field__help">larghezza × altezza: crea un rettangolo pieno da riempire, senza importare un file</small>
          </div>
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
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Distribuzione dei colori</span>
            <div>
              <div class="rg-segmented" id="clusterMode" role="group" aria-label="Distribuzione dei colori">
                <button type="button" class="rg-segmented__item rg-segmented__item--active" data-cluster="off" aria-pressed="true">Uniforme</button>
                <button type="button" class="rg-segmented__item" data-cluster="on" aria-pressed="false">Agglomerati</button>
              </div>
            </div>
            <small class="rg-field__help">Uniforme: mélange omogeneo. Agglomerati: ogni colore si addensa in zone → sfumature di colore.</small>
          </div>
          <div class="rg-field rg-param-grid__wide" id="clusterImageField" hidden>
            <span class="rg-field__label">Immagine di riferimento (opzionale)</span>
            <div class="rg-file-input">
              <label class="rg-file-input__control">
                <input type="file" id="clusterImage" accept="image/*" />
                <span class="rg-button rg-button--outline rg-button--small">Carica immagine…</span>
              </label>
              <p class="rg-file-input__status" id="clusterImageStatus" role="status">Nessuna: agglomerati casuali (per variante).</p>
            </div>
            <div>
              <div class="rg-segmented" id="colorMode" role="group" aria-label="Scelta colori">
                <button type="button" class="rg-segmented__item rg-segmented__item--active" data-cmode="auto" aria-pressed="true">Automatica</button>
                <button type="button" class="rg-segmented__item" data-cmode="manual" aria-pressed="false">Manuale</button>
              </div>
            </div>
            <div class="rg-cluster" id="autoColorControls">
              <span class="rg-field-with-unit" style="--rg-input-numeric-width:6ch"><input class="rg-input rg-input--numeric" id="colorCount" type="number" min="1" max="12" step="1" value="4"><span>col</span></span>
              <button type="button" id="captureColorsBtn" class="rg-button rg-button--outline rg-button--small" disabled>Cattura colori</button>
            </div>
            <div id="imagePicker" hidden>
              <canvas id="pickerCanvas" style="max-width:100%;display:block;cursor:crosshair;border:1px solid var(--rg-color-border-strong);border-radius:var(--rg-radius-md)"></canvas>
              <div class="rg-cluster">
                <button type="button" id="clearPaletteBtn" class="rg-button rg-button--ghost rg-button--small">Svuota palette</button>
                <small class="rg-field__help">clicca sull’immagine per aggiungere quel colore alla palette</small>
              </div>
            </div>
            <div class="rg-cluster">
              <button type="button" id="clearImageBtn" class="rg-button rg-button--ghost rg-button--small" disabled>Rimuovi immagine</button>
            </div>
            <small class="rg-field__help">Automatica: “Numero colori” (1–12) + “Cattura colori” quantizza l’immagine (esclude lo sfondo bianco). Manuale: clicchi i colori sull’immagine. Gli agglomerati poi RISPETTANO l’immagine (ogni colore va dove l’immagine ha quel colore).</small>
          </div>
          <label class="rg-field rg-param-grid__wide" id="clusterStrengthField" hidden>
            <span class="rg-field__label">Intensità agglomerati</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="clusterStrength" type="number" min="0" max="100" step="5" value="60"><span>%</span></span>
            <small class="rg-field__help">quanto i colori si separano in zone: basso = appena accennate, alto = molto marcate</small>
          </label>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Variante</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="seed" type="number" min="1" step="1" value="1"><span>#</span></span>
              <button type="button" id="newSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova variante</button>
            </div>
            <small class="rg-field__help">stessa variante = stesso identico pattern; cambiala per una disposizione diversa (riproducibile, non casuale)</small>
          </div>
        </div>
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
  const params: InterlaceParams = { ...defaultInterlaceParams };
  // Immagine di riferimento per gli agglomerati (opzionale): pixel RGBA campionati da un canvas.
  let refImage: { data: Uint8ClampedArray; w: number; h: number } | null = null;

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const contourColors = () => imported.contours.map((c) => c.color);
  const uniqueColors = () => [...new Set(contourColors())];

  /** Bounding box del disegno (mm) su cui mappare l'immagine. */
  function designBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of currentContours()) for (const p of c.points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  /** Campionatore colore immagine per gli agglomerati (mm → RGB), o undefined se non c'è immagine/agglomerati. */
  function imageSampler() {
    if (!refImage || !params.clusterMode) return undefined;
    const { data, w, h } = refImage;
    const b = designBounds();
    const dw = b.maxX - b.minX || 1, dh = b.maxY - b.minY || 1;
    return (x: number, y: number): [number, number, number] | null => {
      const u = (x - b.minX) / dw, v = (y - b.minY) / dh;
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) return null; // trasparente
      return [data[i], data[i + 1], data[i + 2]];
    };
  }

  /**
   * Cattura-colore stile carpet: QUANTIZZA l'immagine in `n` colori (k-means, 1–12), escludendo lo sfondo
   * bianco. Init deterministico (farthest-point) → stessa immagine = stessa palette. Ordina per numerosità.
   */
  function extractPalette(data: Uint8ClampedArray, n: number): string[] {
    n = Math.max(1, Math.min(12, n | 0));
    const pts: number[][] = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 240 && g > 240 && b > 240) continue; // salta lo sfondo bianco
      pts.push([r, g, b]);
    }
    if (!pts.length) return [];
    // sotto-campiona per velocità (max ~20k pixel), passo costante
    const step = pts.length > 20000 ? Math.ceil(pts.length / 20000) : 1;
    const sample: number[][] = []; for (let i = 0; i < pts.length; i += step) sample.push(pts[i]);
    // init k-means++ deterministico: primo = mediano, poi il più LONTANO dai centroidi già scelti
    const cents: number[][] = [sample[(sample.length / 2) | 0].slice()];
    while (cents.length < n && cents.length < sample.length) {
      let far: number[] | null = null, farD = -1;
      for (const p of sample) {
        let dmin = Infinity;
        for (const c of cents) { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < dmin) dmin = d; }
        if (dmin > farD) { farD = dmin; far = p; }
      }
      if (!far) break; cents.push(far.slice());
    }
    // iterazioni k-means
    const counts = new Array(cents.length).fill(0);
    for (let it = 0; it < 10; it++) {
      const sum = cents.map(() => [0, 0, 0, 0]);
      for (const p of sample) {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < cents.length; c++) { const d = (p[0] - cents[c][0]) ** 2 + (p[1] - cents[c][1]) ** 2 + (p[2] - cents[c][2]) ** 2; if (d < bd) { bd = d; bi = c; } }
        const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      for (let c = 0; c < cents.length; c++) if (sum[c][3]) { cents[c] = [Math.round(sum[c][0] / sum[c][3]), Math.round(sum[c][1] / sum[c][3]), Math.round(sum[c][2] / sum[c][3])]; counts[c] = sum[c][3]; }
    }
    // ordina per numerosità (colori più presenti prima), scarta i cluster vuoti
    const order = cents.map((c, i) => ({ c, n: counts[i] })).filter((e) => e.n > 0).sort((a, z) => z.n - a.n);
    return order.map((e) => '#' + e.c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''));
  }

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
        if (!Number.isNaN(v)) {
          (params[f.key] as number) = v;
          // la densità globale è il placeholder "eredita" di ogni riga colore → riallinealo
          if (f.key === 'densitySpacingMm') buildPaletteUI();
          render();
        }
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
    if (!params.colorDensities) params.colorDensities = [];
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
        params.colorDensities.splice(i, 1);
        buildPaletteUI();
        render();
      });

      // Densità PER-COLORE (spaziatura file, mm): vuoto = usa la densità globale. Campo compatto con le
      // sole classi DS v1.6.0 (`rg-field-with-unit` + `rg-input--numeric`), stretto via il token DS
      // `--rg-input-numeric-width` (nessuna classe inventata). Vedi proposta DS `ds/color-map-aside` (§7).
      const dwrap = document.createElement('span');
      dwrap.className = 'rg-field-with-unit';
      dwrap.style.setProperty('--rg-input-numeric-width', '8ch');
      const dens = document.createElement('input');
      dens.type = 'number';
      dens.className = 'rg-input rg-input--numeric';
      dens.min = '0.8'; dens.max = '3.2'; dens.step = '0.1';
      dens.inputMode = 'decimal';
      dens.placeholder = String(params.densitySpacingMm);
      const dv = params.colorDensities[i];
      dens.value = dv && dv > 0 ? String(dv) : '';
      dens.setAttribute('aria-label', `Densità per ${col.toUpperCase()} in mm (vuoto: usa la densità globale ${params.densitySpacingMm} mm)`);
      dens.addEventListener('change', () => {
        const v = parseFloat(dens.value);
        if (dens.value.trim() === '' || Number.isNaN(v)) { params.colorDensities[i] = 0; dens.value = ''; }
        else { const c = Math.max(0.8, Math.min(3.2, v)); params.colorDensities[i] = c; dens.value = String(c); }
        render();
      });
      const dunit = document.createElement('span');
      dunit.textContent = 'mm';
      dwrap.append(dens, dunit);
      picker.addEventListener('input', () => {
        params.colors[i] = picker.value;
        sw.style.setProperty('--swatch', picker.value);
        code.textContent = picker.value.toUpperCase();
        rm.setAttribute('aria-label', `Rimuovi colore ${i + 1} (${picker.value.toUpperCase()})`);
        render();
      });

      sw.appendChild(picker);
      cluster.append(code, dwrap, rm);
      li.append(sw, cluster);
      host.appendChild(li);
    });
    ($('addColorBtn') as HTMLButtonElement).disabled = params.colors.length >= MAX_COLORS;
  }

  function render() {
    try {
      const { layers, bounds, threadMm } = runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
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

  /** Ripristina parametri e ruoli dal metadata di un SVG esportato dalla suite (R27: file riapribile). */
  function applyImportedProject(meta: Record<string, unknown>): boolean {
    if (meta.rgProject !== 'interlace') return false;
    const mp = meta.params;
    if (mp && typeof mp === 'object') {
      for (const k of Object.keys(defaultInterlaceParams) as (keyof InterlaceParams)[]) {
        const v = (mp as Record<string, unknown>)[k];
        if (v !== undefined) (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    if (meta.roles && typeof meta.roles === 'object') roles = { ...(meta.roles as RoleAssignment) };
    // riallinea i controlli statici e ricostruisci i gruppi guidati dai parametri
    ($('realWidth') as HTMLInputElement).value = String(params.realWidthMm);
    ($('paletteCycles') as HTMLInputElement).value = String(params.paletteCycles);
    ($('seed') as HTMLInputElement).value = String(params.seed);
    ($('clusterStrength') as HTMLInputElement).value = String(params.clusterStrength);
    syncCluster(); // switch agglomerati + visibilità intensità
    buildParamUI();
    buildPaletteUI();
    return true;
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const isDxf = /\.dxf$/i.test(file.name);
        const result = isDxf ? parseDxfToContours(text) : parseSvgToContours(text);
        sourceName = file.name.replace(/\.[^.]+$/, '');
        // Se è un SVG esportato dalla suite, rileggi i parametri salvati PRIMA di caricare (così
        // realWidth/ruoli restaurati valgono già; autoAssign non sovrascrive i ruoli ripristinati).
        let restored = false;
        if (!isDxf) { const meta = readProjectMetadata(text); if (meta) restored = applyImportedProject(meta); }
        loadImport(result, file.name);
        if (restored) $('fileStatus').textContent = `${file.name} · parametri ripristinati dal file`;
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
    params.colorDensities.push(0); // 0 = eredita la densità globale finché non lo si imposta
    buildPaletteUI();
    render();
  });
  ($('paletteCycles') as HTMLInputElement).value = String(params.paletteCycles);
  $('paletteCycles').addEventListener('change', () => {
    const v = parseInt(($('paletteCycles') as HTMLInputElement).value, 10);
    params.paletteCycles = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });

  // Switch distribuzione colori (rg-segmented): 'off' = mélange uniforme | 'on' = agglomerati a zone.
  const clusterBtns = Array.from($('clusterMode').querySelectorAll('.rg-segmented__item')) as HTMLButtonElement[];
  const syncCluster = () => {
    clusterBtns.forEach((b) => {
      const on = (b.dataset.cluster === 'on') === params.clusterMode;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    ($('clusterStrengthField') as HTMLElement).hidden = !params.clusterMode; // intensità solo se attivo
    ($('clusterImageField') as HTMLElement).hidden = !params.clusterMode; // immagine solo se attivo
  };
  clusterBtns.forEach((b) => b.addEventListener('click', () => {
    const want = b.dataset.cluster === 'on';
    if (params.clusterMode === want) return;
    params.clusterMode = want;
    syncCluster();
    render();
  }));
  syncCluster();

  ($('clusterStrength') as HTMLInputElement).value = String(params.clusterStrength);
  $('clusterStrength').addEventListener('change', () => {
    const v = parseFloat(($('clusterStrength') as HTMLInputElement).value);
    params.clusterStrength = Number.isNaN(v) ? 60 : Math.max(0, Math.min(100, v));
    if (params.clusterMode) render();
  });

  // Variante = seed: pattern DIVERSO ma RIPRODUCIBILE (stesso seed → stesso identico risultato).
  ($('seed') as HTMLInputElement).value = String(params.seed);
  $('seed').addEventListener('change', () => {
    const v = parseInt(($('seed') as HTMLInputElement).value, 10);
    params.seed = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });
  $('newSeedBtn').addEventListener('click', () => {
    params.seed = (params.seed % 999999) + 1; // avanza a una variante nuova, deterministica
    ($('seed') as HTMLInputElement).value = String(params.seed);
    render();
  });

  // Immagine di riferimento per gli agglomerati: campionata su canvas (ridotta a ≤256px per velocità).
  $('clusterImage').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
      const cnv = document.createElement('canvas');
      cnv.width = w; cnv.height = h;
      const cx = cnv.getContext('2d');
      if (!cx) { $('clusterImageStatus').textContent = 'Canvas non disponibile'; URL.revokeObjectURL(url); return; }
      cx.drawImage(img, 0, 0, w, h);
      refImage = { data: cx.getImageData(0, 0, w, h).data, w, h };
      $('clusterImageStatus').textContent = `Immagine ${img.width}×${img.height} — gli agglomerati la rispettano`;
      ($('captureColorsBtn') as HTMLButtonElement).disabled = false;
      ($('clearImageBtn') as HTMLButtonElement).disabled = false;
      URL.revokeObjectURL(url);
      drawPicker(); // aggiorna l'anteprima per l'eyedropper (modalità Manuale)
      // Proporziona la TAVOLA all'immagine (larghezza invariata, altezza = larghezza × aspect) così
      // l'immagine mappa 1:1 senza deformarsi. Solo su tavola generata: un cartamodello importato si rispetta.
      const aspect = img.height / img.width;
      if (!imported.frame && aspect > 0 && Number.isFinite(aspect)) {
        const bw = Math.max(1, parseFloat(($('objW') as HTMLInputElement).value) || 100);
        generateObject(bw, Math.max(1, Math.round(bw * aspect))); // fa già render()
      } else {
        render();
      }
    };
    img.onerror = () => { $('clusterImageStatus').textContent = 'Immagine non valida'; URL.revokeObjectURL(url); };
    img.src = url;
  });
  $('captureColorsBtn').addEventListener('click', () => {
    if (!refImage) return;
    const n = Math.max(1, Math.min(12, parseInt(($('colorCount') as HTMLInputElement).value, 10) || 4));
    const cols = extractPalette(refImage.data, n);
    if (!cols.length) { $('clusterImageStatus').textContent = 'Nessun colore catturato (immagine tutta sfondo?)'; return; }
    params.colors = cols;
    params.colorDensities = cols.map(() => 0);
    buildPaletteUI();
    render();
  });
  $('clearImageBtn').addEventListener('click', () => {
    refImage = null;
    $('clusterImageStatus').textContent = 'Nessuna: agglomerati casuali (per variante).';
    ($('captureColorsBtn') as HTMLButtonElement).disabled = true;
    ($('clearImageBtn') as HTMLButtonElement).disabled = true;
    render();
  });

  // Scelta colori: Automatica (quantizza) | Manuale (eyedropper: si vede l'immagine e si clicca il colore).
  const pickerCanvas = $('pickerCanvas') as HTMLCanvasElement;
  let colorMode: 'auto' | 'manual' = 'auto';
  function drawPicker() {
    if (!refImage) return;
    const scale = Math.min(1, 280 / refImage.w);
    const cw = Math.max(1, Math.round(refImage.w * scale)), ch = Math.max(1, Math.round(refImage.h * scale));
    pickerCanvas.width = cw; pickerCanvas.height = ch;
    const cx = pickerCanvas.getContext('2d'); if (!cx) return;
    const tmp = document.createElement('canvas'); tmp.width = refImage.w; tmp.height = refImage.h;
    const tcx = tmp.getContext('2d'); if (!tcx) return;
    tcx.putImageData(new ImageData(new Uint8ClampedArray(refImage.data), refImage.w, refImage.h), 0, 0);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(tmp, 0, 0, cw, ch);
  }
  const colorModeBtns = Array.from($('colorMode').querySelectorAll('.rg-segmented__item')) as HTMLButtonElement[];
  function syncColorMode() {
    colorModeBtns.forEach((b) => { const on = b.dataset.cmode === colorMode; b.classList.toggle('rg-segmented__item--active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    ($('autoColorControls') as HTMLElement).hidden = colorMode !== 'auto';
    ($('imagePicker') as HTMLElement).hidden = colorMode !== 'manual';
    if (colorMode === 'manual') { drawPicker(); $('clusterImageStatus').textContent = refImage ? 'Manuale: clicca i colori sull’immagine' : 'Carica un’immagine, poi clicca i colori'; }
  }
  colorModeBtns.forEach((b) => b.addEventListener('click', () => { const m = b.dataset.cmode === 'manual' ? 'manual' : 'auto'; if (colorMode === m) return; colorMode = m; syncColorMode(); }));
  pickerCanvas.addEventListener('click', (ev) => {
    if (!refImage || params.colors.length >= MAX_COLORS) return;
    const rect = pickerCanvas.getBoundingClientRect();
    const u = (ev.clientX - rect.left) / rect.width, v = (ev.clientY - rect.top) / rect.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const px = Math.min(refImage.w - 1, Math.max(0, Math.floor(u * refImage.w)));
    const py = Math.min(refImage.h - 1, Math.max(0, Math.floor(v * refImage.h)));
    const i = (py * refImage.w + px) * 4;
    const hex = '#' + [refImage.data[i], refImage.data[i + 1], refImage.data[i + 2]].map((c) => c.toString(16).padStart(2, '0')).join('');
    params.colors.push(hex);
    params.colorDensities.push(0);
    buildPaletteUI();
    render();
  });
  $('clearPaletteBtn').addEventListener('click', () => {
    params.colors = [];
    params.colorDensities = [];
    buildPaletteUI();
    render();
  });
  syncColorMode();

  $('sampleBtn').addEventListener('click', () => { roles = {}; sourceName = ''; loadImport(importResultFromContours(sampleContours()), 'Cartamodello demo'); });

  // Oggetto pieno: genera un rettangolo largo×alto (mm) senza fori, da riempire subito (nessun file).
  function generateObject(w: number, h: number) {
    const rect: Contour[] = [{ points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], closed: true, color: '#2b6cb0' }];
    roles = {}; sourceName = `oggetto-${w}x${h}`; params.realWidthMm = 0;
    ($('realWidth') as HTMLInputElement).value = '0';
    ($('objW') as HTMLInputElement).value = String(w);
    ($('objH') as HTMLInputElement).value = String(h);
    loadImport(importResultFromContours(rect), `Oggetto pieno ${w}×${h} mm`);
  }
  $('objBtn').addEventListener('click', () => {
    const w = Math.max(1, parseFloat(($('objW') as HTMLInputElement).value) || 100);
    const h = Math.max(1, parseFloat(($('objH') as HTMLInputElement).value) || 100);
    generateObject(w, h);
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    // Export per Stilista: un gruppo per STOP, in ordine di cucitura, con tinta unica (vedi pipeline).
    // Sotto try/catch: nessun export deve fallire in silenzio.
    try {
      const { exportLayers, bounds, stopCount } = runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
      const metadata = { rgProject: 'interlace', version: '0.1.0', params, roles };
      let svg: string;
      if (imported.frame) {
        const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
        svg = buildSvgInSourceFrame(exportLayers, { frame: imported.frame, realWidthFactor: r, metadata });
      } else {
        svg = buildSvg(exportLayers, { bounds, marginMm: 8, metadata });
      }
      const name = sourceName ? `${sourceName}-interlace.svg` : 'interlace.svg';
      const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
      $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${stopCount} stop in sequenza`;
    } catch (e) {
      $('status').textContent = 'Errore export SVG: ' + (e as Error).message;
      console.error(e);
    }
  });

  $('exportDstBtn').addEventListener('click', async () => {
    // Export ricamo Tajima .dst tramite la "possibilità" globale del core: l'export dell'interlace è già
    // in mm reali; l'adattatore fa un blocco per polilinea, un ago per stop (cambio-colore in sequenza).
    // Tutto sotto try/catch: un export non deve MAI fallire in silenzio (l'errore va in statusbar).
    try {
      $('status').textContent = 'Genero il DST…';
      const { exportLayers, stopCount } = runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
      const bytes = dstFromExportLayers(exportLayers, { label: (sourceName || 'INTERLACE').toUpperCase().slice(0, 16) });
      const name = sourceName ? `${sourceName}-interlace.dst` : 'interlace.dst';
      const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
      $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${stopCount} stop · ${(bytes.length / 1024).toFixed(1)} KB`;
    } catch (e) {
      $('status').textContent = 'Errore export DST: ' + (e as Error).message;
      console.error(e);
    }
  });

  buildParamUI();
  buildPaletteUI();
  loadImport(imported, 'Cartamodello demo');
}

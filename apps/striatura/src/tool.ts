import '@rg/ui/rg.css';
import './striatura.css';
import {
  type Role, type ImportResult, type Contour,
  ROLE_LABELS, polygonArea, pointInPolygon,
  buildSvg, buildSvgInSourceFrame, dstFromExportLayers, DST_FILE,
  parseSvgToContours, parseDxfToContours, readProjectMetadata, readDstMetadata,
  applyRealWidth, importResultFromContours, measureContours,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { runPipeline, type RoleAssignment } from './pipeline';
import { defaultStriaturaParams, type StriaturaParams } from './engine';
import { sampleContours } from './sample';

/** Un campo numerico. L'unità va nello slot del DS, mai nell'etichetta (REVISIONE-PARAMETRI). */
interface Field { key: keyof StriaturaParams; label: string; unit: string; step: number; min?: number; help?: string; }

// Parametri raggruppati come li ragiona Lorenzo (macchia · passaggi · frastaglio · punto). Etichette da
// validare col processo REVISIONE-PARAMETRI.
const MACCHIA_PARAMS: Field[] = [
  { key: 'blobSizeMm', label: 'Grandezza delle macchie', unit: 'mm', step: 1, min: 2 },
  { key: 'blobSpacingMm', label: 'Distanza tra le macchie', unit: 'mm', step: 1, min: 0 },
  { key: 'densitySpacingMm', label: 'Densità della macchia', unit: 'mm', step: 0.1, min: 0.2, help: 'passo tra le striature dentro la macchia: piccolo = più fitta' },
];
const PASSAGGI_PARAMS: Field[] = [
  { key: 'fillSpacingMm', label: 'Densità dei passaggi', unit: 'mm', step: 0.1, min: 0.4, help: 'passo del raso tra le macchie: grande = meno passaggi' },
  { key: 'passaggioAmpMm', label: 'Ampiezza del passaggio', unit: 'mm', step: 1, min: 2, help: 'altezza del raso di passaggio: piccola = meno invadente' },
  { key: 'striaturaLengthMm', label: 'Lunghezza della striatura', unit: 'mm', step: 1, min: 4, help: 'altezza dei trattini della macchia (la riga)' },
];
const FRASTAGLIO_PARAMS: Field[] = [
  { key: 'jaggedLengthMm', label: 'Frastaglio — variazione di lunghezza', unit: 'mm', step: 1, min: 0 },
  { key: 'jaggedStartMm', label: 'Frastaglio — sfasamento delle partenze', unit: 'mm', step: 1, min: 0 },
];
const MOVIMENTO_PARAMS: Field[] = [
  { key: 'waveAmpMm', label: 'Movimento (ampiezza onda)', unit: 'mm', step: 1, min: 0, help: '0 = fasce dritte; alza per far ondulare le fasce delle macchie' },
  { key: 'waveLenMm', label: 'Lunghezza d’onda', unit: 'mm', step: 5, min: 10, help: 'ogni quanti mm si ripete l’ondulazione' },
];
const PUNTO_PARAMS: Field[] = [
  { key: 'maxStitchMm', label: 'Lunghezza del punto', unit: 'mm', step: 0.5, min: 0.5, help: 'passo lungo la striatura' },
  { key: 'travelStitchMm', label: 'Punto degli spostamenti', unit: 'mm', step: 0.5, min: 0.5, help: 'i tragitti non superano mai questa misura' },
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.5, min: 0.2 },
  { key: 'voidClearanceMm', label: 'Distanza di sicurezza da bordi e vuoti', unit: 'mm', step: 0.1, min: 0 },
];

// Questo tool usa solo due ruoli: l'area da ricamare e le aree vuote.
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'EXCLUSION'];

/** Monta il tool "Punto Striato" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountStriatura(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Punto Striato', opts.backHref)}
  <div class="rg-workspace striatura-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Sagoma</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="fileInput" accept=".svg,.dxf,.dst" />
              <span class="rg-button rg-button--outline">Carica DXF o SVG…</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus" role="status">Nessun file: uso la sagoma demo.</p>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Larghezza reale (0 = auto)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidth" type="number" min="0" step="1" value="0"><span>mm</span></span>
            <small class="rg-field__help">0 = usa la misura letta dal file.</small>
          </label>
          <div class="rg-cluster rg-param-grid__wide"><button id="sampleBtn" class="rg-button rg-button--ghost" type="button">Sagoma demo</button></div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Oggetto pieno (senza fori)</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="objW" type="number" min="1" step="1" value="120"><span>mm</span></span>
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="objH" type="number" min="1" step="1" value="150"><span>mm</span></span>
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

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Macchie</span></summary>
        <div id="macchiaParams" class="rg-param-grid"></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Costruzione della striatura</span>
            <div class="rg-segmented" id="stitchMode" role="group" aria-label="Costruzione della striatura">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-mode="retrace" aria-pressed="true">Ritorno al centro</button>
              <button type="button" class="rg-segmented__item" data-mode="boustrophedon" aria-pressed="false">Passata singola</button>
            </div>
            <small class="rg-field__help">Ritorno al centro = trattino doppio/marcato (come il tuo DST). Passata singola = più magra.</small>
          </div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Variante</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="seed" type="number" min="1" step="1" value="1"><span>#</span></span>
              <button type="button" id="newSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova variante</button>
            </div>
            <small class="rg-field__help">stessa variante = stesso identico pattern; cambiala per una disposizione diversa (riproducibile)</small>
          </div>
        </div>
        <div id="movimentoParams" class="rg-param-grid"></div>
      </details>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Passaggi e frastaglio</span></summary>
        <div id="passaggiParams" class="rg-param-grid"></div>
        <div id="frastaglioParams" class="rg-param-grid"></div>
      </details>

      <details class="rg-param-section rg-disclosure">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Punto</span></summary>
        <div id="puntoParams" class="rg-param-grid"></div>
      </details>

      <details class="rg-param-section rg-disclosure">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Filo</span></summary>
        <ul class="rg-color-map" id="threadColor"></ul>
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
  const params: StriaturaParams = { ...defaultStriaturaParams };

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

  function buildParamGrid(hostId: string, fields: Field[]) {
    const host = $(hostId);
    host.innerHTML = '';
    for (const f of fields) {
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
      if (f.min !== undefined) inp.min = String(f.min);
      inp.value = String(params[f.key]);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!Number.isNaN(v)) {
          const clamped = f.min !== undefined ? Math.max(f.min, v) : v;
          (params[f.key] as number) = clamped;
          inp.value = String(clamped);
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

  function buildAllParams() {
    buildParamGrid('macchiaParams', MACCHIA_PARAMS);
    buildParamGrid('movimentoParams', MOVIMENTO_PARAMS);
    buildParamGrid('passaggiParams', PASSAGGI_PARAMS);
    buildParamGrid('frastaglioParams', FRASTAGLIO_PARAMS);
    buildParamGrid('puntoParams', PUNTO_PARAMS);
  }

  function buildRoleUI() {
    const host = $('roles');
    host.innerHTML = '';
    const colors = uniqueColors();
    if (!colors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessuna sagoma: carica un DXF o un SVG.</p></li>';
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

  // ---- "Filo": una riga rg-color-map con picker nativo per il colore unico (mono ora). ----
  const asHex6 = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#1a1a1a');
  function buildThreadUI() {
    const host = $('threadColor');
    host.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'rg-color-map__row';
    const sw = document.createElement('label');
    sw.className = 'rg-color-map__swatch';
    sw.style.setProperty('--swatch', params.color);
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'rg-u-visually-hidden';
    picker.value = asHex6(params.color);
    picker.setAttribute('aria-label', 'Colore del filo');
    const code = document.createElement('span');
    code.className = 'rg-color-map__code';
    code.textContent = params.color.toUpperCase();
    picker.addEventListener('input', () => {
      params.color = picker.value;
      sw.style.setProperty('--swatch', picker.value);
      code.textContent = picker.value.toUpperCase();
      render();
    });
    sw.appendChild(picker);
    li.append(sw, code);
    host.appendChild(li);
  }

  function render() {
    try {
      const { layers, bounds, threadMm, blockCount } = runPipeline(currentContours(), roles, params);
      $('layer').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
      if (threadMm > 0) {
        const jumps = Math.max(0, blockCount - 1);
        $('status').textContent = `Filo: ${(threadMm / 1000).toFixed(2)} m · ${jumps} salt${jumps === 1 ? 'o' : 'i'}`;
      } else {
        $('status').textContent = 'Assegna un colore all’area da ricamare';
      }
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

  // Switch movimento (rg-segmented): 'retrace' | 'boustrophedon'.
  const modeBtns = Array.from($('stitchMode').querySelectorAll('.rg-segmented__item')) as HTMLButtonElement[];
  const syncMode = () => modeBtns.forEach((b) => {
    const on = b.dataset.mode === params.stitchMode;
    b.classList.toggle('rg-segmented__item--active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    const want = b.dataset.mode as StriaturaParams['stitchMode'];
    if (params.stitchMode === want) return;
    params.stitchMode = want;
    syncMode();
    render();
  }));

  /** Ripristina parametri e ruoli dal metadata di un SVG esportato dalla suite (R27: file riapribile). */
  function applyImportedProject(meta: Record<string, unknown>): boolean {
    if (meta.rgProject !== 'striatura') return false;
    const mp = meta.params;
    if (mp && typeof mp === 'object') {
      for (const k of Object.keys(defaultStriaturaParams) as (keyof StriaturaParams)[]) {
        const v = (mp as Record<string, unknown>)[k];
        if (v !== undefined) (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    if (meta.roles && typeof meta.roles === 'object') roles = { ...(meta.roles as RoleAssignment) };
    ($('realWidth') as HTMLInputElement).value = String(params.realWidthMm);
    ($('seed') as HTMLInputElement).value = String(params.seed);
    syncMode();
    buildAllParams();
    buildThreadUI();
    return true;
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const isDst = /\.dst$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // Un .dst uscito da qui non è un cartamodello: è un PROGETTO. Si legge il footer e si
        // rimettono i parametri, senza toccare il disegno che c'è già.
        if (isDst) {
          const meta = readDstMetadata(new Uint8Array(reader.result as ArrayBuffer));
          $('fileStatus').textContent = meta && applyImportedProject(meta)
            ? `${file.name}: parametri ripristinati dal DST`
            : `${file.name}: nessun parametro di questo tool nel DST`;
          if (meta) render();
          return;
        }
        const text = String(reader.result);
        const isDxf = /\.dxf$/i.test(file.name);
        const result = isDxf ? parseDxfToContours(text) : parseSvgToContours(text);
        sourceName = file.name.replace(/\.[^.]+$/, '');
        let restored = false;
        if (!isDxf) { const meta = readProjectMetadata(text); if (meta) restored = applyImportedProject(meta); }
        loadImport(result, file.name);
        if (restored) $('fileStatus').textContent = `${file.name} · parametri ripristinati dal file`;
      } catch (e) {
        $('fileStatus').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  });

  $('realWidth').addEventListener('change', () => {
    const v = parseFloat(($('realWidth') as HTMLInputElement).value);
    params.realWidthMm = Number.isNaN(v) ? 0 : Math.max(0, v);
    render();
    updateFileStatus(sourceName || 'Sagoma');
  });

  // Variante = seed: pattern DIVERSO ma RIPRODUCIBILE.
  $('seed').addEventListener('change', () => {
    const v = parseInt(($('seed') as HTMLInputElement).value, 10);
    params.seed = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });
  $('newSeedBtn').addEventListener('click', () => {
    params.seed = (params.seed % 999999) + 1;
    ($('seed') as HTMLInputElement).value = String(params.seed);
    render();
  });

  $('sampleBtn').addEventListener('click', () => { roles = {}; sourceName = ''; loadImport(importResultFromContours(sampleContours()), 'Sagoma demo'); });

  // Oggetto pieno: rettangolo largo×alto (mm) senza fori, da riempire subito (nessun file).
  $('objBtn').addEventListener('click', () => {
    const w = Math.max(1, parseFloat(($('objW') as HTMLInputElement).value) || 120);
    const h = Math.max(1, parseFloat(($('objH') as HTMLInputElement).value) || 150);
    const rect: Contour[] = [{ points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], closed: true, color: '#2b6cb0' }];
    roles = {}; sourceName = `oggetto-${w}x${h}`; params.realWidthMm = 0;
    ($('realWidth') as HTMLInputElement).value = '0';
    loadImport(importResultFromContours(rect), `Oggetto pieno ${w}×${h} mm`);
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    const { exportLayers, bounds, blockCount } = runPipeline(currentContours(), roles, params);
    const metadata = { rgProject: 'striatura', version: '0.1.0', params, roles };
    let svg: string;
    if (imported.frame) {
      const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
      svg = buildSvgInSourceFrame(exportLayers, { frame: imported.frame, realWidthFactor: r, metadata });
    } else {
      svg = buildSvg(exportLayers, { bounds, marginMm: 8, metadata });
    }
    const name = sourceName ? `${sourceName}-striatura.svg` : 'striatura.svg';
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    const jumps = Math.max(0, blockCount - 1);
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${jumps} salti`;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    const { exportLayers, blockCount } = runPipeline(currentContours(), roles, params);
    let bytes: Uint8Array;
    try {
      // I parametri viaggiano ANCHE nel DST (R27), nel footer dopo l'END: la macchina legge
      // fino all'END e lo ignora, noi lo rileggiamo. Senza, il .dst non sapeva da dove veniva.
      bytes = dstFromExportLayers(exportLayers, {
        label: (sourceName || 'STRIATURA').toUpperCase().slice(0, 16),
        metadata: { rgProject: 'striatura', version: '0.1.0', params, roles },
      });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = sourceName ? `${sourceName}-striatura.dst` : 'striatura.dst';
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    const jumps = Math.max(0, blockCount - 1);
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${jumps} salti · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  syncMode();
  buildAllParams();
  buildThreadUI();
  loadImport(imported, 'Sagoma demo');
}

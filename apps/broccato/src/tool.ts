// Guscio del tool "Broccato" (DOM/browser). Il motore è in engine.ts + reduce.ts e resta puro.
//
// Punti ①-② del piano: si carica un'immagine, la si **prepara** (pareggio della luce, attenuazione
// della grana), si catturano 4-8 tinte e si ripuliscono le macchie troppo piccole. L'anteprima
// mostra l'immagine ridotta — cioè esattamente cosa finirà sotto l'ago. Riempimento a raso,
// passaggi coperti ed export arrivano ai punti ③-⑤.
//
// Il pannello usa solo classi verificate nel DS v1.6.0 (nessuna inventata), ma la COMPOSIZIONE
// definitiva (Testa A + accordion) la detta il subagent `design-system` al punto ⑤.

import '@rg/ui/rg.css';
import './broccato.css';
import { buildSvg } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import {
  type BroccatoParams, type BroccatoColorRole, type FillMode, type PixelImage,
  COLOR_ROLE_LABELS, FILL_MODE_LABELS, MIN_COLORS, MAX_COLORS,
  defaultBroccatoParams, paletteToColors, applyDensityToAll,
  colorsToPalette, mmPerPixel, clampColorCount,
} from './engine';
import { reduceStable, type ReduceResult } from './reduce';
import { buildPlan, type BroccatoPlan } from './pipeline';
import { sampleImage } from './sample';

/** Sorgente pixel: la demo o un'immagine caricata, rasterizzabile alla larghezza di lavoro. */
interface Source {
  name: string;
  pixelsAt: (maxWidthPx: number) => PixelImage;
}

/** Cosa si guarda nell'anteprima. Serve a *vedere* cosa fa la preparazione, non a indovinarlo. */
type Vista = 'originale' | 'preparata' | 'ridotta' | 'ricamo';

interface NumBind { id: string; key: keyof BroccatoParams; int?: boolean; min?: number; max?: number; }

const NUM_BINDS: NumBind[] = [
  { id: 'realWidthMm', key: 'realWidthMm', min: 0 },
  { id: 'dpiDefault', key: 'dpiDefault', int: true, min: 1 },
  { id: 'maxWidthPx', key: 'maxWidthPx', int: true, min: 100 },
  { id: 'flattenLightMm', key: 'flattenLightMm', min: 0 },
  { id: 'smoothMm', key: 'smoothMm', min: 0 },
  { id: 'minBlobMm2', key: 'minBlobMm2', min: 0 },
  { id: 'fillAngleDeg', key: 'fillAngleDeg', min: -90, max: 90 },
  { id: 'maxStitchMm', key: 'maxStitchMm', min: 0.5 },
  { id: 'retraceOffsetMm', key: 'retraceOffsetMm', min: 0 },
];

export function mountBroccato(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Broccato', opts.backHref)}
  <div class="rg-workspace broccato-workspace">
    <aside class="rg-workspace__panel">

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="file" accept="image/*">
              <span class="rg-button rg-button--outline rg-button--small">Scegli un'immagine</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus">Immagine dimostrativa</p>
          </div>
          <label class="rg-field">
            <span class="rg-field__label">Larghezza reale del ricamo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidthMm" type="number" min="0" step="1"><span>mm</span></span>
            <span class="rg-field__help">0 = usa la stima al DPI qui sotto</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">DPI di stima</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="dpiDefault" type="number" min="1" step="1"><span>dpi</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Risoluzione di lavoro</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxWidthPx" type="number" min="100" step="50"><span>px</span></span>
            <span class="rg-field__help">l'immagine si analizza ridotta a questa larghezza</span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Preparazione</h3></div>
        <div class="rg-param-grid">
          <p class="rg-field__help rg-param-grid__wide">Serve a far cadere sugli stessi aghi lo stesso motivo ripetuto in punti diversi del tessuto, dove la luce cambia.</p>
          <label class="rg-field">
            <span class="rg-field__label">Pareggio della luce</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="flattenLightMm" type="number" min="0" step="1"><span>mm</span></span>
            <span class="rg-field__help">0 = spento. Tienilo fra un quinto e un terzo del motivo</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Attenuazione della grana</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="smoothMm" type="number" min="0" step="0.3"><span>mm</span></span>
            <span class="rg-field__help">spiana il tratteggio senza sbavare i contorni</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Macchia più piccola</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="minBlobMm2" type="number" min="0" step="5"><span>mm²</span></span>
            <span class="rg-field__help">sotto questa misura la macchia va al colore vicino</span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Colori</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field">
            <span class="rg-field__label">Numero di colori</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="colorCount" type="number" min="${MIN_COLORS}" max="${MAX_COLORS}" step="1"><span>aghi</span></span>
            <span class="rg-field__help">da ${MIN_COLORS} a ${MAX_COLORS}, base compresa</span>
          </label>
          <div class="rg-field">
            <span class="rg-field__label">Cattura dall'immagine</span>
            <button type="button" id="captureBtn" class="rg-button rg-button--outline rg-button--small">Cattura colori</button>
          </div>
          <ul class="rg-color-map rg-param-grid__wide" id="paletteList"></ul>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Stessa densità per tutti</span>
            <span class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="densityAll" type="number" min="0.2" max="3" step="0.1" value="0.6"><span>mm</span></span>
              <button type="button" id="densityAllBtn" class="rg-button rg-button--outline rg-button--small">Applica a tutti</button>
            </span>
            <span class="rg-field__help">poi ritocca le righe che vuoi diverse</span>
          </div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">04</span><h3 class="rg-param-section__title">Punto</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field">
            <span class="rg-field__label">Orientamento delle righe</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="fillAngleDeg" type="number" min="-90" max="90" step="5"><span>\u00b0</span></span>
            <span class="rg-field__help">0 = orizzontale, uguale per tutti i colori</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Lunghezza del punto</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxStitchMm" type="number" min="0.5" step="0.1"><span>mm</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Sfalsamento del ritorno</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="retraceOffsetMm" type="number" min="0" step="0.05"><span>mm</span></span>
            <span class="rg-field__help">solo a pettine: di quanto il ritorno evita i buchi dell'andata</span>
          </label>
        </div>
      </section>

    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <div>
            <div class="rg-segmented" role="group" aria-label="Cosa guardare">
              <button type="button" class="rg-segmented__item" data-vista="originale" aria-pressed="false">Originale</button>
              <button type="button" class="rg-segmented__item" data-vista="preparata" aria-pressed="false">Preparata</button>
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-vista="ridotta" aria-pressed="true">Ridotta</button>
              <button type="button" class="rg-segmented__item" data-vista="ricamo" aria-pressed="false">Ricamo</button>
            </div>
          </div>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
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

  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const params: BroccatoParams = { ...defaultBroccatoParams, colors: [] };
  let vista: Vista = 'ridotta';
  let ultimo: { res: ReduceResult; img: PixelImage; mmpp: number; plan: BroccatoPlan } | null = null;

  let source: Source = { name: '', pixelsAt: () => sampleImage() };
  let sourceName = '';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => {
    $('zoom').textContent = `zoom ${Math.round(z * 100)}%`;
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  // ---- campi numerici ------------------------------------------------------
  for (const b of NUM_BINDS) {
    const el = $(b.id) as HTMLInputElement;
    el.value = String(params[b.key]);
    el.addEventListener('change', () => {
      let v = b.int ? Math.round(Number(el.value)) : Number(el.value);
      if (!Number.isFinite(v)) v = Number(defaultBroccatoParams[b.key]);
      if (b.min !== undefined) v = Math.max(b.min, v);
      if (b.max !== undefined) v = Math.min(b.max, v);
      (params[b.key] as number) = v;
      el.value = String(v);
      // Cambiare la preparazione cambia l'immagine su cui si sono decise le tinte → si ricattura.
      scheduleAnalyze(b.key === 'flattenLightMm' || b.key === 'smoothMm' || b.key === 'maxWidthPx');
    });
  }

  const countEl = $('colorCount') as HTMLInputElement;
  countEl.value = String(params.colorCount);
  countEl.addEventListener('change', () => {
    params.colorCount = clampColorCount(Number(countEl.value));
    countEl.value = String(params.colorCount);
    scheduleAnalyze(true);
  });

  $('captureBtn').addEventListener('click', () => scheduleAnalyze(true));

  $('densityAllBtn').addEventListener('click', () => {
    const v = Number(($('densityAll') as HTMLInputElement).value);
    if (!Number.isFinite(v) || v <= 0) return;
    params.colors = applyDensityToAll(params.colors, v);
    buildPaletteUI();
    scheduleAnalyze(false);
  });

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-vista]')) {
    b.addEventListener('click', () => {
      vista = b.dataset.vista as Vista;
      for (const o of root.querySelectorAll('[data-vista]')) {
        const on = o === b;
        o.classList.toggle('rg-segmented__item--active', on);
        o.setAttribute('aria-pressed', String(on));
      }
      if (ultimo) paint();
    });
  }

  // ---- palette: una riga per ago, e l'ORDINE della lista è l'ordine di cucitura ----
  function buildPaletteUI(): void {
    const host = $('paletteList');
    host.innerHTML = '';
    if (!params.colors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun colore: premi «Cattura colori».</p></li>';
      return;
    }
    params.colors.forEach((col, i) => {
      const li = document.createElement('li');
      li.className = 'rg-color-map__row';

      const sw = document.createElement('label');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', col.hex);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'rg-u-visually-hidden';
      picker.value = col.hex;
      picker.setAttribute('aria-label', `Colore ${i + 1}`);
      picker.addEventListener('input', () => {
        params.colors[i].hex = picker.value.toLowerCase();
        sw.style.setProperty('--swatch', params.colors[i].hex);
        code.textContent = params.colors[i].hex.toUpperCase();
        scheduleAnalyze(false);
      });
      sw.appendChild(picker);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = col.hex.toUpperCase();

      // Cosa fa questo colore: macchia · base (tutta la sagoma) · escluso dall'immagine.
      const role = document.createElement('select');
      role.className = 'rg-select rg-color-map__target';
      role.setAttribute('aria-label', `Ruolo del colore ${i + 1}`);
      for (const r of Object.keys(COLOR_ROLE_LABELS) as BroccatoColorRole[]) {
        const o = document.createElement('option');
        o.value = r; o.textContent = COLOR_ROLE_LABELS[r];
        if (r === col.role) o.selected = true;
        role.appendChild(o);
      }
      role.addEventListener('change', () => {
        params.colors[i].role = role.value as BroccatoColorRole;
        buildPaletteUI();
        scheduleAnalyze(false);
      });

      // Come si costruisce la striscia: pettine (va e torna) o normale.
      const mode = document.createElement('select');
      mode.className = 'rg-select';
      mode.setAttribute('aria-label', `Costruzione del colore ${i + 1}`);
      for (const m of Object.keys(FILL_MODE_LABELS) as FillMode[]) {
        const o = document.createElement('option');
        o.value = m; o.textContent = FILL_MODE_LABELS[m];
        if (m === col.mode) o.selected = true;
        mode.appendChild(o);
      }
      mode.disabled = col.role === 'escluso';
      mode.addEventListener('change', () => { params.colors[i].mode = mode.value as FillMode; scheduleAnalyze(false); });

      // Densità per-colore (R22): il campo compatto con le sole classi DS, come in interlace.
      const dwrap = document.createElement('span');
      dwrap.className = 'rg-field-with-unit';
      dwrap.style.setProperty('--rg-input-numeric-width', '7ch');
      const dens = document.createElement('input');
      dens.type = 'number';
      dens.className = 'rg-input rg-input--numeric';
      dens.min = '0.2'; dens.max = '3'; dens.step = '0.1';
      dens.value = String(col.densitySpacingMm);
      dens.disabled = col.role === 'escluso';
      dens.setAttribute('aria-label', `Densità del colore ${i + 1}`);
      dens.addEventListener('change', () => {
        const v = Number(dens.value);
        if (Number.isFinite(v) && v > 0) params.colors[i].densitySpacingMm = v;
        dens.value = String(params.colors[i].densitySpacingMm);
        scheduleAnalyze(false);
      });
      const unit = document.createElement('span');
      unit.textContent = 'mm';
      dwrap.append(dens, unit);

      // Ordine di cucitura: chi va prima nasconde i propri passaggi sotto chi viene dopo (R16).
      const up = document.createElement('button');
      up.type = 'button'; up.className = 'rg-icon-button'; up.textContent = '↑';
      up.disabled = i === 0;
      up.setAttribute('aria-label', `Cuci prima il colore ${i + 1}`);
      up.addEventListener('click', () => { swap(i, i - 1); });
      const down = document.createElement('button');
      down.type = 'button'; down.className = 'rg-icon-button'; down.textContent = '↓';
      down.disabled = i === params.colors.length - 1;
      down.setAttribute('aria-label', `Cuci dopo il colore ${i + 1}`);
      down.addEventListener('click', () => { swap(i, i + 1); });

      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.id = `share-${i}`;

      const cluster = document.createElement('span');
      cluster.className = 'rg-cluster';
      cluster.append(code, meta, dwrap, mode, up, down);

      li.append(sw, cluster, role);
      host.appendChild(li);
    });
    aggiornaPercentuali();
  }

  function swap(a: number, b: number): void {
    if (b < 0 || b >= params.colors.length) return;
    const t = params.colors[a];
    params.colors[a] = params.colors[b];
    params.colors[b] = t;
    buildPaletteUI();
    // Scambiare due righe scambia anche le loro tinte: la mappa dei colori va rifatta.
    scheduleAnalyze(false);
  }

  // ---- analisi (fase leggera, con debounce: la catena costa centinaia di ms) ----
  let timer = 0;
  function scheduleAnalyze(ricattura: boolean): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => analyze(ricattura), 200);
  }

  function analyze(ricattura: boolean): void {
    const img = source.pixelsAt(params.maxWidthPx);
    const mmpp = mmPerPixel(img.width, params);
    const nuova = ricattura || !params.colors.length;
    const t0 = performance.now();
    const res = reduceStable(img, {
      colorCount: params.colorCount,
      flattenLightMm: params.flattenLightMm,
      smoothMm: params.smoothMm,
      minBlobMm2: params.minBlobMm2,
      mmPerPx: mmpp,
      palette: nuova ? undefined : colorsToPalette(params.colors),
    });
    if (nuova) params.colors = paletteToColors(res.palette, params.colors);
    const plan = buildPlan(res, params, mmpp, {
      widthMm: img.width * mmpp,
      heightMm: img.height * mmpp,
    });
    ultimo = { res, img, mmpp, plan };
    if (nuova) buildPaletteUI();
    paint(performance.now() - t0);
  }

  // ---- anteprima ------------------------------------------------------------
  function paint(ms?: number): void {
    if (!ultimo) return;
    const { res, img, mmpp, plan } = ultimo;
    const w = img.width, h = img.height;
    const wmm = w * mmpp, hmm = h * mmpp;

    if (vista === 'ricamo') {
      // Il ricamo vero: un gruppo per ago, nell'ordine di cucitura, filo sottile (R15).
      const layer = $('layer');
      layer.innerHTML = buildSvg(plan.previewLayers, {
        bounds: { minX: 0, minY: 0, maxX: wmm, maxY: hmm },
        marginMm: 2,
      });
      aggiornaPercentuali();
      const tempo = ms === undefined ? '' : ` \u00b7 ${Math.round(ms)} ms`;
      $('status').textContent =
        `${wmm.toFixed(0)} \u00d7 ${hmm.toFixed(0)} mm \u00b7 filo ${(plan.threadMm / 1000).toFixed(1)} m \u00b7 `
        + `${plan.pointCount.toLocaleString('it-IT')} punti \u00b7 ${plan.runCount.toLocaleString('it-IT')} corse da collegare${tempo}`;
      updateFileStatus(img, wmm, hmm);
      return;
    }

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.style.width = `${wmm.toFixed(2)}mm`;
    cv.style.height = `${hmm.toFixed(2)}mm`;
    const out = new ImageData(w, h);

    if (vista === 'originale' || vista === 'preparata') {
      const src = vista === 'originale' ? img.rgba : res.prepared.rgba;
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        out.data[o] = src[o]; out.data[o + 1] = src[o + 1]; out.data[o + 2] = src[o + 2]; out.data[o + 3] = 255;
      }
    } else {
      // I colori "esclusi" restano vuoti: si vede subito cosa NON si ricama.
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const v = res.index[i];
        const col = v < params.colors.length ? params.colors[v] : undefined;
        if (!col || col.role === 'escluso') {
          out.data[o] = 250; out.data[o + 1] = 248; out.data[o + 2] = 244; out.data[o + 3] = 255;
        } else {
          const rgb = res.palette[v];
          out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2]; out.data[o + 3] = 255;
        }
      }
    }
    cv.getContext('2d')!.putImageData(out, 0, 0);

    const layer = $('layer');
    layer.innerHTML = '';
    layer.appendChild(cv);

    aggiornaPercentuali();
    const aghi = params.colors.filter((c) => c.role !== 'escluso').length;
    const tempo = ms === undefined ? '' : ` · ${Math.round(ms)} ms`;
    const pulizia = res.removedBlobs > 0 ? ` · ${res.removedBlobs.toLocaleString('it-IT')} macchie assorbite` : '';
    $('status').textContent =
      `${wmm.toFixed(0)} × ${hmm.toFixed(0)} mm · ${aghi} aghi su ${params.colors.length} colori${pulizia}${tempo}`;
    updateFileStatus(img, wmm, hmm);
  }

  function aggiornaPercentuali(): void {
    if (!ultimo) return;
    const tot = ultimo.res.counts.reduce((s, v) => s + v, 0) || 1;
    params.colors.forEach((_, i) => {
      const el = root.querySelector(`#share-${i}`);
      if (el) el.textContent = `${((100 * (ultimo!.res.counts[i] ?? 0)) / tot).toFixed(0)}%`;
    });
  }

  function updateFileStatus(img: PixelImage, wmm: number, hmm: number): void {
    const come = params.realWidthMm > 0 ? 'misura reale' : `stima ${params.dpiDefault} dpi`;
    $('fileStatus').textContent =
      `${sourceName || 'Immagine dimostrativa'}: ${img.width}×${img.height} px → ${wmm.toFixed(0)}×${hmm.toFixed(0)} mm (${come})`;
  }

  // ---- import: File → <img> → <canvas> → pixel (l'unico pezzo legato al DOM) ----
  ($('file') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url);
      sourceName = f.name;
      source = {
        name: f.name,
        pixelsAt: (maxWidthPx: number) => {
          let w = el.naturalWidth || el.width;
          let h = el.naturalHeight || el.height;
          if (maxWidthPx > 0 && w > maxWidthPx) { const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s)); }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(el, 0, 0, w, h);
          return { rgba: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
        },
      };
      analyze(true);
      pz.fit();
    };
    el.onerror = () => { $('status').textContent = 'Immagine non leggibile'; URL.revokeObjectURL(url); };
    el.src = url;
  });

  analyze(true);
  requestAnimationFrame(() => pz.fit());
}

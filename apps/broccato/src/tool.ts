// Guscio del tool "Broccato" (DOM/browser). Il motore è in engine.ts e resta puro.
//
// Punto ① del piano: si carica un'immagine, si catturano 4–8 tinte, e l'anteprima mostra
// l'immagine RIDOTTA a quelle tinte — cioè esattamente cosa finirà sotto l'ago, prima ancora di
// calcolare un punto. Riempimento, passaggi coperti ed export arrivano ai punti ③–⑤.
//
// Il pannello qui sotto usa solo classi verificate nel DS v1.6.0 (nessuna inventata), ma la
// COMPOSIZIONE definitiva (Testa A + accordion) la detta il subagent `design-system` al punto ⑤,
// come si è fatto per striatura.

import '@rg/ui/rg.css';
import './broccato.css';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import {
  type BroccatoParams, type BroccatoColor, type BroccatoColorRole, type FillMode, type PixelImage,
  COLOR_ROLE_LABELS, FILL_MODE_LABELS, MIN_COLORS, MAX_COLORS,
  defaultBroccatoParams, capturePalette, paletteToColors, applyDensityToAll,
  colorsToPalette, reduceImage, colorCounts, mmPerPixel, clampColorCount,
} from './engine';
import { sampleImage } from './sample';

/** Sorgente pixel: la demo o un'immagine caricata, rasterizzabile alla larghezza di lavoro. */
interface Source {
  name: string;
  pixelsAt: (maxWidthPx: number) => PixelImage;
}

interface NumBind { id: string; key: keyof BroccatoParams; int?: boolean; min?: number; max?: number; }

const NUM_BINDS: NumBind[] = [
  { id: 'realWidthMm', key: 'realWidthMm', min: 0 },
  { id: 'dpiDefault', key: 'dpiDefault', int: true, min: 1 },
  { id: 'maxWidthPx', key: 'maxWidthPx', int: true, min: 100 },
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
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Colori</h3></div>
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

    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
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
      render();
    });
  }

  const countEl = $('colorCount') as HTMLInputElement;
  countEl.value = String(params.colorCount);
  countEl.addEventListener('change', () => {
    params.colorCount = clampColorCount(Number(countEl.value));
    countEl.value = String(params.colorCount);
    capture();
  });

  $('captureBtn').addEventListener('click', () => capture());

  $('densityAllBtn').addEventListener('click', () => {
    const v = Number(($('densityAll') as HTMLInputElement).value);
    if (!Number.isFinite(v) || v <= 0) return;
    params.colors = applyDensityToAll(params.colors, v);
    buildPaletteUI();
    render();
  });

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
        render();
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
        render();
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
      mode.addEventListener('change', () => { params.colors[i].mode = mode.value as FillMode; render(); });

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
        render();
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
  }

  function swap(a: number, b: number): void {
    if (b < 0 || b >= params.colors.length) return;
    const t = params.colors[a];
    params.colors[a] = params.colors[b];
    params.colors[b] = t;
    buildPaletteUI();
    render();
  }

  function capture(): void {
    const img = source.pixelsAt(params.maxWidthPx);
    const palette = capturePalette(img, params.colorCount);
    params.colors = paletteToColors(palette, params.colors);
    buildPaletteUI();
    render();
  }

  // ---- anteprima: l'immagine ridotta alle tinte scelte -----------------------
  function render(): void {
    const img = source.pixelsAt(params.maxWidthPx);
    const mmpp = mmPerPixel(img.width, params);
    const wmm = img.width * mmpp, hmm = img.height * mmpp;

    if (!params.colors.length) {
      $('status').textContent = 'Nessun colore catturato';
      updateFileStatus(img, wmm, hmm);
      return;
    }

    const palette = colorsToPalette(params.colors);
    const idx = reduceImage(img, palette);
    const counts = colorCounts(idx, palette.length);
    const total = counts.reduce((s, v) => s + v, 0) || 1;

    // Dipingo la riduzione. I colori "esclusi" restano vuoti: si vede subito cosa NON si ricama.
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.style.width = `${wmm.toFixed(2)}mm`;
    cv.style.height = `${hmm.toFixed(2)}mm`;
    const out = new ImageData(img.width, img.height);
    for (let i = 0; i < idx.length; i++) {
      const o = i * 4;
      const v = idx[i];
      const col = v < params.colors.length ? params.colors[v] : undefined;
      if (!col || col.role === 'escluso') {
        out.data[o] = 250; out.data[o + 1] = 248; out.data[o + 2] = 244; out.data[o + 3] = 255;
      } else {
        const rgb = palette[v];
        out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2]; out.data[o + 3] = 255;
      }
    }
    cv.getContext('2d')!.putImageData(out, 0, 0);

    const layer = $('layer');
    layer.innerHTML = '';
    layer.appendChild(cv);

    params.colors.forEach((_, i) => {
      const el = root.querySelector(`#share-${i}`);
      if (el) el.textContent = `${((100 * counts[i]) / total).toFixed(0)}%`;
    });

    const aghi = params.colors.filter((c) => c.role !== 'escluso').length;
    $('status').textContent = `${wmm.toFixed(0)} × ${hmm.toFixed(0)} mm · ${aghi} aghi su ${params.colors.length} colori`;
    updateFileStatus(img, wmm, hmm);
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
      capture();
      pz.fit();
    };
    el.onerror = () => { $('status').textContent = 'Immagine non leggibile'; URL.revokeObjectURL(url); };
    el.src = url;
  });

  capture();
  requestAnimationFrame(() => pz.fit());
}

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
import { buildSvg, conBusta, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { scheletro, sezioneSorgente, sezione, campoNumero, campoNumeroInline, attivaCampiNumero, leggiCampo, impostaNumero, type OpzioniCampoNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  type BroccatoParams, type BroccatoColorRole, type FillMode, type PixelImage,
  COLOR_ROLE_LABELS, FILL_MODE_LABELS, MIN_COLORS, MAX_COLORS,
  defaultBroccatoParams, paletteToColors, applyDensityToAll,
  colorsToPalette, mmPerPixel, clampColorCount,
} from './engine';
import { reduceStable, type ReduceResult } from '@rg/core';
import { buildPlan, type BroccatoPlan } from './pipeline';
import { sampleImage } from './sample';
import { calcolaPiano } from './motore';

// Icona contagocce (pipette, stile Lucide): la stessa di `apps/bitmap`, cosi' il gesto e' quello
// che Lorenzo conosce gia' dal punto tappeto.
const EYEDROPPER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>'
  + '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

/** Sorgente pixel: la demo o un'immagine caricata, rasterizzabile alla larghezza di lavoro. */
interface Source {
  name: string;
  pixelsAt: (maxWidthPx: number) => PixelImage;
}

/** Cosa si guarda nell'anteprima. Serve a *vedere* cosa fa la preparazione, non a indovinarlo. */
type Vista = 'originale' | 'preparata' | 'ridotta' | 'ricamo';

interface NumBind { id: string; key: keyof BroccatoParams; int?: boolean; min?: number; max?: number; }

// Testi, unità e limiti dei campi numerici (le stesse parole di prima, ora costruite da campoNumero). Il valore parte dai default del motore.
const DATI_CAMPI: Record<string, Omit<OpzioniCampoNumero, 'id' | 'valore'>> = {
  realWidth: {etichetta:"Larghezza reale del ricamo",unita:"mm",passo:1,min:0,aiuto:"0 = usa la stima al DPI qui sotto",largo:false},
  dpiDefault: {etichetta:"DPI di stima",unita:"dpi",passo:1,min:1,largo:false},
  maxWidthPx: {etichetta:"Risoluzione di lavoro",unita:"px",passo:50,min:100,aiuto:"l'immagine si analizza ridotta a questa larghezza",largo:false},
  flattenLightMm: {etichetta:"Pareggio della luce",unita:"mm",passo:1,min:0,aiuto:"0 = spento. Tienilo fra un quinto e un terzo del motivo",largo:false},
  smoothMm: {etichetta:"Attenuazione della grana",unita:"mm",passo:0.3,min:0,aiuto:"spiana il tratteggio senza sbavare i contorni",largo:false},
  minBlobMm2: {etichetta:"Macchia più piccola",unita:"mm²",passo:5,min:0,aiuto:"sotto questa misura la macchia va al colore vicino",largo:false},
  fillAngleDeg: {etichetta:"Orientamento delle righe",unita:"°",passo:5,min:-90,max:90,aiuto:"0 = orizzontale, uguale per tutti i colori",largo:false},
  maxStitchMm: {etichetta:"Lunghezza del punto",unita:"mm",passo:0.1,min:0.5,largo:false},
  retraceOffsetMm: {etichetta:"Sfalsamento del ritorno",unita:"mm",passo:0.05,min:0,aiuto:"solo a pettine: di quanto il ritorno evita i buchi dell'andata",largo:false},
  minStitchMm: {etichetta:"Punto minimo",unita:"mm",passo:0.1,min:0,aiuto:"imposto alla fine, dopo i passaggi",largo:false},
  endLockCount: {etichetta:"Fermatura di uscita",unita:"punti",passo:1,min:0,max:8,aiuto:"0 = nessuna. Nel riferimento sono 4, prima del cambio-colore",largo:false},
  colorCount: { etichetta: 'Numero di colori', unita: 'aghi', passo: 1, min: MIN_COLORS, max: MAX_COLORS, aiuto: `da ${MIN_COLORS} a ${MAX_COLORS}, base compresa`, largo: false },
  densityAll: { etichetta: 'Stessa densità per tutti', unita: 'mm', passo: 0.1, min: 0.2, max: 3, aiuto: 'poi ritocca le righe che vuoi diverse', largo: true },
};

const NUM_BINDS: NumBind[] = [
  { id: 'realWidth', key: 'realWidthMm', min: 0 },
  { id: 'dpiDefault', key: 'dpiDefault', int: true, min: 1 },
  { id: 'maxWidthPx', key: 'maxWidthPx', int: true, min: 100 },
  { id: 'flattenLightMm', key: 'flattenLightMm', min: 0 },
  { id: 'smoothMm', key: 'smoothMm', min: 0 },
  { id: 'minBlobMm2', key: 'minBlobMm2', min: 0 },
  { id: 'fillAngleDeg', key: 'fillAngleDeg', min: -90, max: 90 },
  { id: 'maxStitchMm', key: 'maxStitchMm', min: 0.5 },
  { id: 'retraceOffsetMm', key: 'retraceOffsetMm', min: 0 },
  { id: 'minStitchMm', key: 'minStitchMm', min: 0 },
  { id: 'endLockCount', key: 'endLockCount', int: true, min: 0, max: 8 },
];

export function mountBroccato(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const CHIAVE: Record<string, string> = { realWidth: 'realWidthMm' };
  const campo = (id: string): string => {
    const valore = id === 'densityAll' ? 0.6 : Number((defaultBroccatoParams as unknown as Record<string, unknown>)[CHIAVE[id] ?? id]);
    return campoNumero({ id, ...DATI_CAMPI[id], valore });
  };
  root.innerHTML = scheletro({
    topbar: topbar('Broccato', opts.backHref),
    classe: 'broccato-workspace',
    pannello: [
      sezioneSorgente({
        tipo: 'immagine', accetta: 'image/*', etichettaCarica: "Scegli un'immagine", statoIniziale: 'Immagine dimostrativa',
        larghezzaReale: false,
        extra: `${campo('realWidth')}
          ${campo('dpiDefault')}
          ${campo('maxWidthPx')}`,
      }),
      sezione({
        indice: 2, titolo: "Preparazione", apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid">
    <p class="rg-field__help rg-param-grid__wide">Serve a far cadere sugli stessi aghi lo stesso motivo ripetuto in punti diversi del tessuto, dove la luce cambia.</p>
    ${campo('flattenLightMm')}
    ${campo('smoothMm')}
    ${campo('minBlobMm2')}
  </div>`,
      }),
      sezione({
        indice: 3, titolo: "Colori",
        contenuto: `<div class="rg-param-grid">
    ${campo('colorCount')}
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Da dove vengono le tinte</span>
      <div><div class="rg-segmented" id="paletteMode" role="group" aria-label="Da dove vengono le tinte">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-palette="auto" aria-pressed="true">Automatiche</button>
        <button type="button" class="rg-segmented__item" data-palette="manuale" aria-pressed="false">Manuali</button>
      </div></div>
      <span class="rg-field__help">Automatiche: le trova il sistema. Manuali: le scegli tu col contagocce, e non vengono più ricatturate.</span>
    </div>
    <div class="rg-field">
      <span class="rg-field__label">Cattura dall'immagine</span>
      <button type="button" id="captureBtn" class="rg-button rg-button--outline rg-button--small">Cattura colori</button>
    </div>
    <ul class="rg-color-map rg-param-grid__wide" id="paletteList"></ul>
    ${campo('densityAll')}
  <div class="rg-cluster rg-param-grid__wide"><button type="button" id="densityAllBtn" class="rg-button rg-button--outline rg-button--small">Applica a tutti</button></div>
  </div>`,
      }),
      sezione({
        indice: 4, titolo: "Punto", apribile: true, aperta: false,
        contenuto: `<div class="rg-param-grid">
    ${campo('fillAngleDeg')}
    ${campo('maxStitchMm')}
    ${campo('retraceOffsetMm')}
    ${campo('minStitchMm')}
    ${campo('endLockCount')}
  </div>`,
      }),
    ],
    // L'anteprima si rifà da sola a ogni cambio: niente Genera. Le quattro viste stanno a sinistra.
    anteprima: {
      viste: `<div>
        <div class="rg-segmented" role="group" aria-label="Cosa guardare">
          <button type="button" class="rg-segmented__item" data-vista="originale" aria-pressed="false">Originale</button>
          <button type="button" class="rg-segmented__item" data-vista="preparata" aria-pressed="false">Preparata</button>
          <button type="button" class="rg-segmented__item rg-segmented__item--active" data-vista="ridotta" aria-pressed="true">Ridotta</button>
          <button type="button" class="rg-segmented__item" data-vista="ricamo" aria-pressed="false">Ricamo</button>
        </div>
        </div>`,
    },
  });
  attivaCampiNumero(root);

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
    impostaNumero(el, params[b.key] as number);
    el.addEventListener('change', () => {
      let v = b.int ? Math.round(leggiCampo(el)) : leggiCampo(el);
      if (!Number.isFinite(v)) v = Number(defaultBroccatoParams[b.key]);
      if (b.min !== undefined) v = Math.max(b.min, v);
      if (b.max !== undefined) v = Math.min(b.max, v);
      (params[b.key] as number) = v;
      impostaNumero(el, v);
      // Cambiare la preparazione cambia l'immagine su cui si sono decise le tinte → si ricattura.
      scheduleAnalyze(b.key === 'flattenLightMm' || b.key === 'smoothMm' || b.key === 'maxWidthPx');
    });
  }

  const countEl = $('colorCount') as HTMLInputElement;
  impostaNumero(countEl, params.colorCount);
  countEl.addEventListener('change', () => {
    params.colorCount = clampColorCount(leggiCampo(countEl));
    impostaNumero(countEl, params.colorCount);
    scheduleAnalyze(true);
  });

  function setPaletteMode(m: 'auto' | 'manuale'): void {
    params.paletteMode = m;
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-palette]')) {
      const on = b.dataset.palette === m;
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-palette]')) {
    b.addEventListener('click', () => {
      setPaletteMode(b.dataset.palette as 'auto' | 'manuale');
      // tornando in automatico le tinte si ripescano dall'immagine
      scheduleAnalyze(params.paletteMode === 'auto');
    });
  }

  // Il bottone ricattura sempre, e riporta la palette in automatico: e' quello che uno si aspetta
  // premendo «Cattura colori».
  $('captureBtn').addEventListener('click', () => { setPaletteMode('auto'); scheduleAnalyze(true); });

  /**
   * Contagocce — la vista passa all'IMMAGINE VERA, con la lente d'ingrandimento sul pixel sotto il
   * puntatore e il codice colore; il clic prende quel colore esatto. Ricalca `apps/bitmap`.
   */
  function enterPickMode(index: number): void {
    const px = source.pixelsAt(params.maxWidthPx);
    const W = px.width, H = px.height, SAMPLE = 15, HALF = 7, LENS = 132;
    const img = document.createElement('canvas');
    img.width = W; img.height = H;
    img.className = 'broccato-pick__img';
    img.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.rgba), W, H), 0, 0);

    const overlay = document.createElement('div');
    overlay.className = 'broccato-pick';
    const hint = document.createElement('div');
    hint.className = 'broccato-pick__hint';
    hint.textContent = 'Muovi sul pixel, clicca per campionare il colore · Esc per annullare';
    const lens = document.createElement('canvas');
    lens.className = 'broccato-pick__lens';
    lens.width = LENS; lens.height = LENS;
    const lctx = lens.getContext('2d')!;
    lctx.imageSmoothingEnabled = false;
    const tag = document.createElement('div');
    tag.className = 'broccato-pick__tag';
    overlay.append(img, hint, lens, tag);
    $('canvas').appendChild(overlay);

    const colorAt = (sx: number, sy: number): string => {
      const o = (sy * W + sx) * 4;
      const h = (v: number) => v.toString(16).padStart(2, '0');
      return `#${h(px.rgba[o])}${h(px.rgba[o + 1])}${h(px.rgba[o + 2])}`;
    };
    const pixelOf = (e: MouseEvent) => {
      const rect = img.getBoundingClientRect();
      const sx = Math.max(0, Math.min(W - 1, Math.floor(((e.clientX - rect.left) / rect.width) * W)));
      const sy = Math.max(0, Math.min(H - 1, Math.floor(((e.clientY - rect.top) / rect.height) * H)));
      return { sx, sy };
    };
    const onMove = (e: MouseEvent): void => {
      const { sx, sy } = pixelOf(e);
      lctx.clearRect(0, 0, LENS, LENS);
      lctx.drawImage(img, sx - HALF, sy - HALF, SAMPLE, SAMPLE, 0, 0, LENS, LENS);
      const cell = LENS / SAMPLE;
      lctx.strokeStyle = '#000'; lctx.lineWidth = 1;
      lctx.strokeRect(HALF * cell + 0.5, HALF * cell + 0.5, cell, cell);
      lctx.strokeStyle = '#fff';
      lctx.strokeRect(HALF * cell + 1.5, HALF * cell + 1.5, cell - 2, cell - 2);
      const hex = colorAt(sx, sy);
      tag.textContent = hex.toUpperCase(); tag.style.setProperty('--c', hex);
      const orect = overlay.getBoundingClientRect();
      const lx = Math.min(orect.width - LENS - 8, e.clientX - orect.left + 18);
      const ly = Math.min(orect.height - LENS - 28, e.clientY - orect.top + 18);
      lens.style.left = `${lx}px`; lens.style.top = `${ly}px`;
      tag.style.left = `${lx}px`; tag.style.top = `${ly + LENS + 4}px`;
    };
    const esci = (): void => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') esci(); };
    img.addEventListener('mousemove', onMove);
    img.addEventListener('click', (e) => {
      const { sx, sy } = pixelOf(e);
      params.colors[index].hex = colorAt(sx, sy);
      setPaletteMode('manuale');
      esci();
      buildPaletteUI();
      scheduleAnalyze(false);
    });
    // La tela ha il pan/zoom (pointerdown → setPointerCapture): senza fermarlo si prende il
    // puntatore e il clic non arriva mai all'immagine. Lezione gia' pagata in bitmap.
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    overlay.addEventListener('pointerup', (e) => e.stopPropagation());
    overlay.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    document.addEventListener('keydown', onKey);
  }

  $('densityAllBtn').addEventListener('click', () => {
    const v = leggiCampo($('densityAll') as HTMLInputElement);
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
        setPaletteMode('manuale');          // l'hai scelto tu: non te lo ricatturo piu'
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
      const modello = document.createElement('template');
      modello.innerHTML = campoNumeroInline({
        aria: `Densità del colore ${i + 1}`, unita: 'mm', valore: col.densitySpacingMm, passo: 0.1, min: 0.2, max: 3,
        larghezza: '7ch', disabilitato: col.role === 'escluso',
      });
      const dwrap = modello.content.firstElementChild as HTMLElement;
      const dens = dwrap.querySelector('input') as HTMLInputElement;
      dens.addEventListener('change', () => {
        const v = leggiCampo(dens);
        if (Number.isFinite(v) && v > 0) params.colors[i].densitySpacingMm = v;
        impostaNumero(dens, params.colors[i].densitySpacingMm);
        scheduleAnalyze(false);
      });

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

      // Contagocce: prende la tinta dall'immagine vera, con la lente sul pixel. Stesso gesto di
      // `apps/bitmap`, e come li' passa la palette in MANUALE — altrimenti la prima ricattura
      // butterebbe via il colore appena scelto.
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rg-icon-button';
      pick.innerHTML = EYEDROPPER_SVG;
      pick.title = 'Campiona dall\'immagine';
      pick.setAttribute('aria-label', `Campiona il colore ${i + 1} dall'immagine`);
      pick.addEventListener('click', () => enterPickMode(i));

      const cluster = document.createElement('span');
      cluster.className = 'rg-cluster';
      cluster.append(code, meta, dwrap, mode, pick, up, down);

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
    // In manuale le tinte sono di Lorenzo e non si toccano; si ricattura solo se non ce n'e' nessuna.
    const nuova = (ricattura || !params.colors.length) && (params.paletteMode === 'auto' || !params.colors.length);
    const t0 = performance.now();
    const { res, mmpp, plan, colors } = calcolaPiano(img, params, ricattura);
    if (nuova) params.colors = colors;
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
      const nasc = plan.travelMm > 0 ? Math.round((100 * plan.travelCoveredMm) / plan.travelMm) : 100;
      $('status').textContent =
        `${wmm.toFixed(0)} \u00d7 ${hmm.toFixed(0)} mm \u00b7 filo ${(plan.threadMm / 1000).toFixed(1)} m \u00b7 `
        + `${plan.pointCount.toLocaleString('it-IT')} punti \u00b7 ${plan.jumps} salti \u00b7 `
        + `passaggi nascosti ${nasc}%${tempo}`;
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
  ($('fileInput') as HTMLInputElement).addEventListener('change', (ev) => {
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

  // ---- esportazione: SVG per Illustrator/Stilista, DST per la macchina --------
  const nomeBase = (): string => (sourceName ? sourceName.replace(/\.[^.]+$/, '') : 'broccato');

  /** I parametri che vale la pena rimettere riaprendo il file: tutto tranne i pixel. */
  const paramsSalvabili = (): Record<string, unknown> => ({ ...params });

  /** Da cosa è partito il ricamo (busta K2): l'immagine caricata; con l'immagine dimostrativa niente sorgente. */
  const sorgenteBusta = () => {
    if (!sourceName || !ultimo) return undefined;
    const reale = params.realWidthMm > 0; // senza misura reale la larghezza sarebbe una stima a dpi: non la dichiaro
    return {
      tipo: 'raster' as const,
      nome: sourceName,
      ...(reale ? { larghezzaMm: ultimo.img.width * ultimo.mmpp, altezzaMm: ultimo.img.height * ultimo.mmpp } : {}),
    };
  };

  $('exportBtn').addEventListener('click', async () => {
    try {
      if (!ultimo) { $('status').textContent = 'Niente da esportare'; return; }
      const { plan, img, mmpp } = ultimo;
      const svg = buildSvg(plan.exportLayers, {
        bounds: plan.bounds,
        marginMm: 2,
        metadata: conBusta({ rgProject: 'broccato', version: '0.1.0', params: paramsSalvabili() }, { strati: plan.exportLayers, sorgente: sorgenteBusta() }),
      });
      const esito = await saveTextFile(svg, {
        suggestedName: `${nomeBase()}-broccato.svg`,
        description: 'Immagine SVG',
      });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}-broccato.svg`);
      void img; void mmpp;
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });

  $('exportDstBtn').addEventListener('click', async () => {
    try {
      if (!ultimo) { $('status').textContent = 'Niente da esportare'; return; }
      const bytes = dstFromExportLayers(ultimo.plan.exportLayers, {
        label: 'BROCCATO',
        // parametri riapribili dal .dst (R27): stanno DOPO l'END, la macchina li ignora
        metadata: conBusta({ rgProject: 'broccato', version: '0.1.0', params: paramsSalvabili() }, { strati: ultimo.plan.exportLayers, sorgente: sorgenteBusta() }),
      });
      const esito = await saveBinaryFile(bytes, { suggestedName: `${nomeBase()}.dst`, ...DST_FILE });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}.dst`);
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });

  // ---- riapertura: da un .svg o .dst esportato da qui tornano i parametri (R27/R9) ----
  function applicaParametri(meta: Record<string, unknown> | null): boolean {
    if (!meta || meta.rgProject !== 'broccato') return false;
    const salvati = meta.params as Partial<BroccatoParams> | undefined;
    if (!salvati) return false;
    Object.assign(params, salvati);
    for (const b of NUM_BINDS) impostaNumero($(b.id) as HTMLInputElement, params[b.key] as number);
    impostaNumero(countEl, params.colorCount);
    setPaletteMode(params.paletteMode ?? 'auto');
    buildPaletteUI();
    scheduleAnalyze(false);
    return true;
  }

  ($('progettoInput') as HTMLInputElement).addEventListener('change', async (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const meta = /\.dst$/i.test(f.name)
        ? readDstMetadata(new Uint8Array(await f.arrayBuffer()))
        : readProjectMetadata(await f.text());
      $('progettoStatus').textContent = applicaParametri(meta)
        ? `Parametri ripristinati da ${f.name} — l'immagine va ricaricata a parte`
        : `${f.name} non contiene i parametri di questo strumento`;
    } catch (e) {
      $('progettoStatus').textContent = `Non riesco a leggere ${f.name}: ${(e as Error).message}`;
    }
  });

  analyze(true);
  requestAnimationFrame(() => pz.fit());
}

// Guscio del tool "Punto Pittorico" (DOM/browser). Il motore è in `pipeline.ts` e resta puro:
// qui dentro non si calcola niente di geometrico, si carica un'immagine, si girano le manopole e si
// guarda il risultato.
//
// Il pannello segue la forma canonica della suite — testa sempre aperta, poi le sezioni — e usa solo
// classi del Design System. La **validazione della composizione** dal subagent `design-system` è
// l'ultimo passo, insieme ai nomi dei parametri col processo di `REVISIONE-PARAMETRI.md`.
//
// Due cose che questo tool ancora non fa, e che si vedono nell'anteprima: il **punto minimo** (R3) e
// i **passaggi** fra una macchia e l'altra (R16/R26). Le corse escono staccate; in macchina servono
// i collegamenti nascosti sotto i colori successivi.

import '@rg/ui/rg.css';
import './pittorico.css';
import {
  buildSvg, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata,
  bounds, rgbToHex, type PixelImage, type Point,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams,
  type PittoricoParams, type PittoricoPlan,
} from './pipeline';

/** Sorgente pixel: rasterizzabile alla larghezza di lavoro. */
interface Sorgente { name: string; pixelsAt: (maxWidthPx: number) => PixelImage; }

interface Campo { id: string; key: keyof PittoricoParams; int?: boolean; min?: number; max?: number; }

const CAMPI: Campo[] = [
  { id: 'realWidthMm', key: 'realWidthMm', min: 0 },
  { id: 'colorCount', key: 'colorCount', int: true, min: 2, max: 8 },
  { id: 'densitySpacingMm', key: 'densitySpacingMm', min: 0.1, max: 2 },
  { id: 'maxStitchMm', key: 'maxStitchMm', min: 0.5, max: 8 },
  { id: 'frangiaMm', key: 'frangiaMm', min: 0, max: 12 },
  { id: 'crescitaMm', key: 'crescitaMm', min: 0, max: 12 },
  { id: 'sormontoMm', key: 'sormontoMm', min: 0, max: 6 },
  { id: 'sogliaSfumaturaMm', key: 'sogliaSfumaturaMm', min: 0, max: 20 },
  { id: 'flattenLightMm', key: 'flattenLightMm', min: 0 },
  { id: 'smoothMm', key: 'smoothMm', min: 0 },
  { id: 'minAreaMm2', key: 'minAreaMm2', min: 0 },
];

/** Larghezza di lavoro in pixel: sopra i ~900 il calcolo si allunga senza aggiungere forma. */
const MAX_WIDTH_PX = 900;

export function mountPittorico(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Punto Pittorico', opts.backHref)}
  <div class="rg-workspace pittorico-workspace">
    <aside class="rg-workspace__panel">

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Immagine</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="file" accept="image/*">
              <span class="rg-button rg-button--outline rg-button--small">Scegli un'immagine</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus">Nessuna immagine: caricane una per cominciare</p>
          </div>
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="reopen" accept=".svg,.dst">
              <span class="rg-button rg-button--ghost rg-button--small">Riapri un progetto</span>
            </label>
            <p class="rg-file-input__status" id="reopenStatus">un .svg o .dst uscito da qui rimette i suoi parametri</p>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Larghezza reale del ricamo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidthMm" type="number" min="0" step="1"><span>mm</span></span>
            <span class="rg-field__help">0 = un pixel vale un millimetro. È la misura che comanda: senza, le altre non significano niente</span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Colori</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field">
            <span class="rg-field__label">Quanti fili</span>
            <input class="rg-input rg-input--numeric" id="colorCount" type="number" min="2" max="8" step="1">
            <span class="rg-field__help">ogni tinta è un ago</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Macchia più piccola</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="minAreaMm2" type="number" min="0" step="10"><span>mm²</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Pareggio della luce</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="flattenLightMm" type="number" min="0" step="1"><span>mm</span></span>
            <span class="rg-field__help">tienilo più grande del motivo</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Attenuazione della grana</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="smoothMm" type="number" min="0" step="0.5"><span>mm</span></span>
          </label>
          <div class="rg-param-grid__wide">
            <p class="rg-field__label">Fili trovati, nell'ordine di cucitura</p>
            <div class="pittorico-aghi" id="aghi"><p class="rg-field__help">carica un'immagine</p></div>
          </div>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Punto</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field">
            <span class="rg-field__label">Distanza fra le file</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="densitySpacingMm" type="number" min="0.1" max="2" step="0.05"><span>mm</span></span>
            <span class="rg-field__help">quanto è fitto il pieno</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Punto massimo</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="maxStitchMm" type="number" min="0.5" max="8" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">lungo il filo</span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">04</span><h3 class="rg-param-section__title">Bordi e sfumature</h3></div>
        <div class="rg-param-grid">
          <label class="rg-field">
            <span class="rg-field__label">Lunghezza della frangia</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="frangiaMm" type="number" min="0" max="12" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">tienila sotto la sovrapposizione, o si appiattisce</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Da qui in su è una sfumatura</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sogliaSfumaturaMm" type="number" min="0" max="20" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">sotto, il colore stacca netto</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Sovrapposizione dove sfuma</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="crescitaMm" type="number" min="0" max="12" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">quanto il colore sotto entra sotto quello sopra</span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Sormonto dove stacca</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sormontoMm" type="number" min="0" max="6" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">basta poco: serve a non far vedere la tela alla giunta</span>
          </label>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">05</span><h3 class="rg-param-section__title">Genera ed esporta</h3></div>
        <div class="rg-param-grid">
          <div class="rg-param-grid__wide rg-button-row">
            <button class="rg-button rg-button--primary" id="genBtn" type="button">Genera</button>
            <button class="rg-button rg-button--outline rg-button--small" id="exportBtn" type="button">Esporta SVG</button>
            <button class="rg-button rg-button--outline rg-button--small" id="exportDstBtn" type="button">Esporta DST</button>
          </div>
          <p class="rg-field__help rg-param-grid__wide">Il ricamo non parte da solo: su un disegno grande costa qualche secondo, e conviene aver messo prima la larghezza reale.</p>
        </div>
      </section>

    </aside>

    <main class="rg-workspace__canvas" id="canvas">
      <div class="rg-workspace__layer" id="layer"></div>
      <div class="rg-statusbar">
        <span id="status">Carica un'immagine, poi premi Genera</span>
        <span class="rg-mono" id="zoom">zoom 100%</span>
        <button class="rg-button rg-button--ghost rg-button--small" id="fitBtn" type="button">Adatta</button>
      </div>
    </main>
  </div>`;

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const params: PittoricoParams = { ...defaultPittoricoParams };
  let sorgente: Sorgente | null = null;
  let nomeFile = '';
  let piano: PittoricoPlan | null = null;

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => {
    $('zoom').textContent = `zoom ${Math.round(z * 100)}%`;
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  // ---- i campi ---------------------------------------------------------------
  for (const c of CAMPI) {
    const el = $(c.id) as HTMLInputElement;
    el.value = String(params[c.key]);
    el.addEventListener('change', () => {
      let v = c.int ? Math.round(Number(el.value)) : Number(el.value);
      if (!Number.isFinite(v)) v = Number(defaultPittoricoParams[c.key]);
      if (c.min !== undefined) v = Math.max(c.min, v);
      if (c.max !== undefined) v = Math.min(c.max, v);
      (params[c.key] as number) = v;
      el.value = String(v);
      $('status').textContent = 'Parametri cambiati: premi Genera';
    });
  }
  const rileggiCampi = (): void => {
    for (const c of CAMPI) ($(c.id) as HTMLInputElement).value = String(params[c.key]);
  };

  // ---- import: File → <img> → <canvas> → pixel (l'unico pezzo legato al DOM) ----
  ($('file') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url);
      nomeFile = f.name;
      sorgente = {
        name: f.name,
        pixelsAt: (maxWidthPx: number) => {
          let w = el.naturalWidth || el.width;
          let h = el.naturalHeight || el.height;
          if (maxWidthPx > 0 && w > maxWidthPx) {
            const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s));
          }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(el, 0, 0, w, h);
          return { rgba: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
        },
      };
      const px = el.naturalWidth || el.width;
      $('fileStatus').textContent = `${f.name} · ${px} × ${el.naturalHeight || el.height} px`;
      $('status').textContent = params.realWidthMm > 0
        ? 'Immagine caricata: premi Genera'
        : 'Immagine caricata. Metti la larghezza reale in mm, poi premi Genera';
      mostraImmagine(el);
      pz.fit();
    };
    el.onerror = () => { $('status').textContent = 'Immagine non leggibile'; URL.revokeObjectURL(url); };
    el.src = url;
  });

  /** L'immagine appena caricata si VEDE subito: serve a capire se è entrata giusta. */
  function mostraImmagine(el: HTMLImageElement): void {
    const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
    const larg = params.realWidthMm > 0 ? params.realWidthMm : w;
    const alt = (h / w) * larg;
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${larg.toFixed(1)}mm" height="${alt.toFixed(1)}mm" viewBox="0 0 ${larg.toFixed(1)} ${alt.toFixed(1)}">`
      + `<image href="${el.src}" x="0" y="0" width="${larg.toFixed(1)}" height="${alt.toFixed(1)}" /></svg>`;
  }

  // ---- genera ----------------------------------------------------------------
  $('genBtn').addEventListener('click', () => {
    if (!sorgente) { $('status').textContent = 'Prima carica un\'immagine'; return; }
    $('status').textContent = 'Calcolo il ricamo…';
    // un giro di rendering prima di bloccare il thread, così il messaggio si vede davvero
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const img = (sorgente as Sorgente).pixelsAt(MAX_WIDTH_PX);
        // la larghezza reale vale per l'immagine INTERA: se qui è ridotta, il rapporto non cambia
        const p: PittoricoParams = { ...params, realWidthMm: params.realWidthMm > 0 ? params.realWidthMm : img.width };
        piano = buildPittoricoPlan(img, p);
        disegna(piano);
        mostraAghi(piano);
        const ms = Math.round(performance.now() - t0);
        $('status').textContent = `${piano.macchie.length} macchie · ${piano.ordine.length} aghi · `
          + `${(piano.filoMm / 1000).toFixed(1)} m di filo · ${piano.punti.toLocaleString('it-IT')} punti · ${ms} ms`;
        pz.fit();
      } catch (e) {
        $('status').textContent = `Non ce l'ho fatta: ${(e as Error).message}`;
      }
    }, 20);
  });

  function disegna(pl: PittoricoPlan): void {
    const layers = pittoricoExportLayers(pl);
    const corpi = layers.map((l) => {
      const d = l.polylines
        .map((c) => `<polyline points="${c.map((p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" />`)
        .join('');
      return `<g fill="none" stroke="${l.color}" stroke-width="${l.strokeMm}" stroke-linejoin="round" stroke-linecap="round">${d}</g>`;
    }).join('');
    // il fondo è la tinta più scura: è quella che in macchina va giù per prima e fa da campo
    const fondo = rgbToHex(pl.palette[pl.ordine[0]]);
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${pl.larghezzaMm.toFixed(1)}mm" height="${pl.altezzaMm.toFixed(1)}mm" viewBox="0 0 ${pl.larghezzaMm.toFixed(1)} ${pl.altezzaMm.toFixed(1)}">`
      + `<rect x="0" y="0" width="${pl.larghezzaMm.toFixed(1)}" height="${pl.altezzaMm.toFixed(1)}" fill="${fondo}" opacity="0.12" />`
      + `${corpi}</svg>`;
  }

  function mostraAghi(pl: PittoricoPlan): void {
    const righe = pl.ordine.map((t, i) => {
      const macchie = pl.macchie.filter((m) => m.tinta === t);
      let mm = 0;
      for (const m of macchie) for (const c of m.corse) {
        for (let k = 1; k < c.length; k++) mm += Math.hypot(c[k].x - c[k - 1].x, c[k].y - c[k - 1].y);
      }
      const dalla = macchie.filter((m) => m.metodo === 'rotaia').length;
      return `<div class="pittorico-ago">
        <span class="pittorico-ago__n">${i + 1}</span>
        <span class="pittorico-ago__swatch" style="background:${rgbToHex(pl.palette[t])}"></span>
        <span>${macchie.length} macchie<span class="rg-field__help"> · ${dalla} ordinate dalla rotaia</span></span>
        <span class="pittorico-ago__mis rg-mono">${(mm / 1000).toFixed(1)} m</span>
      </div>`;
    }).join('');
    $('aghi').innerHTML = righe
      + `<p class="rg-field__help">${pl.bordiSfumati} bordi su ${pl.bordiTotali} sfumano: lì il ricamo si compenetra con le frange.</p>`;
  }

  // ---- riapertura di un progetto ---------------------------------------------
  ($('reopen') as HTMLInputElement).addEventListener('change', async (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const meta = f.name.toLowerCase().endsWith('.dst')
        ? readDstMetadata(new Uint8Array(await f.arrayBuffer()))
        : readProjectMetadata(await f.text());
      const salvati = meta?.params as Partial<PittoricoParams> | undefined;
      if (!meta || meta.rgProject !== 'pittorico' || !salvati) {
        $('reopenStatus').textContent = 'Questo file non viene dal Punto Pittorico';
        return;
      }
      for (const c of CAMPI) {
        const v = salvati[c.key];
        if (typeof v === 'number' && Number.isFinite(v)) (params[c.key] as number) = v;
      }
      rileggiCampi();
      $('reopenStatus').textContent = `Parametri ripresi da ${f.name}`;
      $('status').textContent = 'Parametri ripresi: ricarica l\'immagine e premi Genera';
    } catch (e) {
      $('reopenStatus').textContent = `Non riesco a leggerlo: ${(e as Error).message}`;
    }
  });

  // ---- esportazione ----------------------------------------------------------
  const nomeBase = (): string => (nomeFile ? nomeFile.replace(/\.[^.]+$/, '') : 'pittorico');
  const metadati = (): Record<string, unknown> => ({ rgProject: 'pittorico', version: '0.1.0', params: { ...params } });

  $('exportBtn').addEventListener('click', async () => {
    if (!piano) { $('status').textContent = 'Niente da esportare: premi Genera'; return; }
    try {
      const layers = pittoricoExportLayers(piano);
      const svg = buildSvg(layers, {
        bounds: bounds(layers.flatMap((l) => l.polylines.flat())),
        marginMm: 4,
        metadata: metadati(),
      });
      const esito = await saveTextFile(svg, { suggestedName: `${nomeBase()}-pittorico.svg`, description: 'Immagine SVG' });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}-pittorico.svg`);
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!piano) { $('status').textContent = 'Niente da esportare: premi Genera'; return; }
    try {
      const bytes = dstFromExportLayers(pittoricoExportLayers(piano), { label: 'PITTORICO', metadata: metadati() });
      const esito = await saveBinaryFile(bytes, { suggestedName: `${nomeBase()}.dst`, ...DST_FILE });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}.dst`);
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });
}

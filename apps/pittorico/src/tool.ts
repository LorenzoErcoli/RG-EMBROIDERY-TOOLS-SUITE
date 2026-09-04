// Guscio del tool "Punto Pittorico" (DOM/browser). Il motore è in `pipeline.ts` e resta puro:
// qui dentro non si calcola niente di geometrico, si carica un'immagine, si girano le manopole e si
// guarda il risultato.
//
// Il pannello segue la forma canonica della suite — testa sempre aperta, poi le sezioni — e usa solo
// classi del Design System. La **validazione della composizione** dal subagent `design-system` è
// l'ultimo passo, insieme ai nomi dei parametri col processo di `REVISIONE-PARAMETRI.md`.
//
// L'anteprima ha cinque VISTE, ed e' il modo per capire cosa sta facendo il sistema invece di
// fidarsi: come divide l'immagine in colori, come quei colori diventano macchie cucibili, dov'e' il
// ricamo e - la piu' importante - dove passa il filo di collegamento. Un difetto come la linea sul
// bordo si misura, ma prima si guarda.

import '@rg/ui/rg.css';
import './pittorico.css';
import {
  buildSvg, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata,
  bounds, rgbToHex, type PixelImage,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams,
  type PittoricoParams, type PittoricoPlan,
} from './pipeline';
// Le viste NON stanno qui: le usano in due — questo guscio e lo script che ne fa una pagina da
// guardare senza aprire l'app — e due copie divergono sempre.
import { svgMacchie, svgRicamo, svgPassaggi, pixelDeiColori } from './viste';

/**
 * Le cinque viste dell'anteprima, in ordine di catena: l'immagine com'e' entrata, come viene divisa
 * in tinte, come le tinte diventano macchie cucibili, il ricamo, e dove passa il filo fra una corsa
 * e l'altra.
 */
type Vista = 'originale' | 'colori' | 'macchie' | 'ricamo' | 'passaggi';

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
  { id: 'lisciaBordiMm', key: 'lisciaBordiMm', min: 0, max: 5 },
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
            <span class="rg-field__label">Lisciatura del contorno</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="lisciaBordiMm" type="number" min="0" max="5" step="0.2"><span>mm</span></span>
            <span class="rg-field__help">0 = il contorno com'esce dalla tracciatura. Alzandola sparisce il dettaglio più piccolo di così</span>
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

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <!-- ECCEZIONE DICHIARATA (regola 12). Il segmented del DS e' documentato per 2-4 opzioni
               sorelle e qui ne porta 5. Sono le cinque tappe della catena, e fonderne due
               nasconderebbe proprio il passo che si vuole guardare: fra Colori e Macchie sta la
               tracciatura, ed e' li' che una linea netta si perde. Il controllo regge: il track e'
               inline-flex, e sotto i 1300px il cluster manda a capo il blocco intero invece di
               spezzarlo. Ambito: solo questo tool. Se un terzo tool chiedera' la stessa cosa,
               l'eccezione va promossa a variante documentata del DS.
               Il div attorno non e' decorativo: tiene il gruppo come UN solo item del cluster. -->
          <div>
            <div class="rg-segmented" role="group" aria-label="Cosa guardare">
              <button type="button" class="rg-segmented__item" data-vista="originale" aria-pressed="false">Originale</button>
              <button type="button" class="rg-segmented__item" data-vista="colori" aria-pressed="false">Colori</button>
              <button type="button" class="rg-segmented__item" data-vista="macchie" aria-pressed="false">Macchie</button>
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-vista="ricamo" aria-pressed="true">Ricamo</button>
              <button type="button" class="rg-segmented__item" data-vista="passaggi" aria-pressed="false">Passaggi</button>
            </div>
          </div>
          <button class="rg-button rg-button--ghost rg-button--small" id="fitBtn" type="button">Adatta</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">Carica un'immagine, poi premi Genera</span>
        <span class="rg-mono" id="zoom">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const params: PittoricoParams = { ...defaultPittoricoParams };
  let sorgente: Sorgente | null = null;
  let nomeFile = '';
  let piano: PittoricoPlan | null = null;
  let immagine: HTMLImageElement | null = null;
  let vista: Vista = 'ricamo';

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
      immagine = el;
      vista = 'originale';
      segnaVista();
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
        // dall'immagine si passa da soli al ricamo: e' quello che si e' appena chiesto di calcolare
        if (vista === 'originale') vista = 'ricamo';
        segnaVista();
        disegna();
        mostraAghi(piano);
        const ms = Math.round(performance.now() - t0);
        const nasc = piano.saltoMm > 0
          ? Math.round((100 * piano.passaggiPerAgo.reduce((s, a) => s + a.passaggiCopertiMm, 0)) / piano.saltoMm)
          : 100;
        $('status').textContent = `${piano.macchie.length} macchie · ${piano.ordine.length} aghi · `
          + `${(piano.filoMm / 1000).toFixed(1)} m di filo · ${piano.punti.toLocaleString('it-IT')} punti · `
          + `passaggi ${(piano.saltoMm / 1000).toFixed(1)} m (${nasc}% nascosti) · ${piano.salti} salti · ${ms} ms`;
        pz.fit();
      } catch (e) {
        $('status').textContent = `Non ce l'ho fatta: ${(e as Error).message}`;
      }
    }, 20);
  });

  // ---- le viste ---------------------------------------------------------------

  /**
   * Segna la vista corrente e spegne quelle che non hanno ancora niente da mostrare: prima di
   * Genera, "Ricamo" e "Passaggi" darebbero un canvas vuoto, che non e' un'informazione — e' un
   * dubbio. Classe e `aria-pressed` si aggiornano insieme su TUTTI gli item: il CSS del DS aggancia
   * l'uno o l'altro, e tenerne solo uno lascerebbe due voci accese.
   */
  function segnaVista(): void {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-vista]')) {
      const attiva = b.dataset.vista === vista;
      b.classList.toggle('rg-segmented__item--active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
      b.disabled = b.dataset.vista === 'originale' ? !immagine : !piano;
    }
  }

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-vista]')) {
    b.addEventListener('click', () => {
      vista = b.dataset.vista as Vista;
      segnaVista();
      disegna();
    });
  }

  /** La divisione in tinte e' una mappa di pixel: nel browser va in un canvas, non in un SVG. */
  function vistaColori(pl: PittoricoPlan): void {
    const cv = document.createElement('canvas');
    cv.width = pl.larghezzaPx; cv.height = pl.altezzaPx;
    cv.style.width = `${pl.larghezzaMm.toFixed(2)}mm`;
    cv.style.height = `${pl.altezzaMm.toFixed(2)}mm`;
    const dati = cv.getContext('2d')!.createImageData(pl.larghezzaPx, pl.altezzaPx);
    dati.data.set(pixelDeiColori(pl));
    cv.getContext('2d')!.putImageData(dati, 0, 0);
    $('layer').innerHTML = '';
    $('layer').appendChild(cv);
  }

  /**
   * Cambiare vista ridisegna DENTRO il layer e non tocca pan e zoom: e' tutto il senso di avere
   * cinque viste, perche' confrontarne due senza spostare l'inquadratura e' l'unico modo per vedere
   * dove il filo di passaggio finisce rispetto al riempimento.
   */
  function disegna(): void {
    if (vista === 'originale') {
      if (immagine) mostraImmagine(immagine);
      return;
    }
    if (!piano) { $('status').textContent = 'Per questa vista serve il ricamo: premi Genera'; return; }
    if (vista === 'colori') { vistaColori(piano); return; }
    const strati = vista === 'macchie' ? [] : pittoricoExportLayers(piano);
    $('layer').innerHTML = vista === 'macchie' ? svgMacchie(piano)
      : vista === 'passaggi' ? svgPassaggi(piano, strati)
        : svgRicamo(piano, strati);
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

import '@rg/ui/rg.css';
import './bitmap.css';
import { buildSvg, conBusta, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { scheletro, sezioneSorgente, sezione, campoNumero, campoNumeroInline, attivaCampiNumero, leggiCampo, impostaNumero, type OpzioniCampoNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { pickSaveTarget, saveOutcomeMessage } from '@rg/ui/save';
import { runBitmapPreview, bitmapPipelineSteps, PREVIEW_MAX_DOTS, type BitmapPreviewColor, type BitmapPipelineResult } from './pipeline';
import { defaultBitmapParams, type BitmapParams, type StitchProgress } from './engine';
import { sampleImage, type PixelImage } from './sample';

/** Sorgente pixel: la demo o un'immagine decodificata, rasterizzabile alla larghezza voluta. */
interface Source {
  name: string;
  pixelsAt: (maxWidthPx: number) => PixelImage;
}

// Campi numerici cablati genericamente: id nel DOM ↔ chiave del parametro. Unità nello slot (mai nell'etichetta).
interface NumBind { id: string; key: keyof BitmapParams; int?: boolean; min?: number; max?: number; }

// Testi, unità e limiti dei campi numerici (le stesse parole di prima, ora costruite da campoNumero). Il valore parte dai default del motore.
const DATI_CAMPI: Record<string, Omit<OpzioniCampoNumero, 'id' | 'valore'>> = {
  realWidth: {etichetta:"Larghezza reale (0 = auto)",unita:"mm",passo:1,min:0},
  dpiEstimate: {etichetta:"DPI di stima",unita:"dpi",passo:1,min:1},
  maxWidthPx: {etichetta:"Risoluzione di lavoro",unita:"px",passo:50,min:0,aiuto:"l'immagine viene ridotta a questa larghezza per la resa (0 = nativa); più bassa = più veloce"},
  threshold: {etichetta:"Soglia di selezione",unita:"lum",passo:5,min:0,max:255,aiuto:"un pixel è scelto se più scuro della soglia (0–255); più alta = include più pixel chiari"},
  backgroundTolerance: {etichetta:"Tolleranza sfondo",unita:"rgb",passo:1,min:0},
  colorCount: {etichetta:"Numero di colori (cambi-ago)",unita:"#",passo:1,min:1,max:16,aiuto:"in quante tinte separare l'immagine (quantizzazione)"},
  densitySpacingMm: {etichetta:"Distanza tra i punti",unita:"mm",passo:0.1,min:0,aiuto:"quanto sono distanti i punti: piccola = fitto (più punti), grande = rado (meno punti); 0 = piena risoluzione"},
  minStitchMm: {etichetta:"Punto minimo",unita:"mm",passo:0.5,min:0},
  reinsertionRounds: {etichetta:"Reinserimenti",unita:"giri",passo:1,min:0},
  maxPoints: {etichetta:"Tetto punti (0 = off)",unita:"#",passo:500,min:0},
  targetDensityPct: {etichetta:"Densità obiettivo (0 = off)",unita:"%",passo:1,min:0,max:100},
  degradeDrop: {etichetta:"Scarto casuale",unita:"0–1",passo:0.05,min:0,max:1},
  degradeJitter: {etichetta:"Spostamento casuale",unita:"mm",passo:0.1,min:0},
  seed: {etichetta:"Variante",unita:"#",passo:1,min:1,aiuto:"stessa variante = stesso identico risultato (riproducibile)"},
  scanlineBandMm: {etichetta:"Altezza banda (a righe)",unita:"mm",passo:0.2,min:0.2},
  chunkSize: {etichetta:"Punti massimi per tracciato",unita:"#",passo:500,min:0,aiuto:"spezza i tracciati lunghi per Illustrator (R6); 0 = nessun taglio"},
};

// Icona contagocce (pipette, stile Lucide) per il bottone "campiona" delle righe-colore manuali.
const EYEDROPPER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>'
  + '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

export function mountBitmap(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const CHIAVE: Record<string, string> = { realWidth: 'realWidthMm', backgroundTolerance: 'backgroundToleranceRgb', degradeJitter: 'degradeJitterMm' };
  const campo = (id: string): string =>
    campoNumero({ id, ...DATI_CAMPI[id], valore: Number((defaultBitmapParams as unknown as Record<string, unknown>)[CHIAVE[id] ?? id]) });
  root.innerHTML = scheletro({
    topbar: topbar('Bitmap → Stitch', opts.backHref),
    classe: 'bitmap-workspace',
    pannello: [
      sezioneSorgente({
        tipo: 'immagine', accetta: 'image/png,image/jpeg,image/webp,image/bmp,image/gif,.svg,.dst',
        etichettaCarica: "Carica un'immagine…", statoIniziale: "Nessun file: uso l'immagine demo.",
        demo: 'Immagine demo', larghezzaReale: false,
        extra: `${campo('realWidth')}
          ${campo('dpiEstimate')}
          ${campo('maxWidthPx')}`,
      }),
      sezione({
        indice: 2, titolo: "Selezione dei pixel",
        contenuto: `<div class="rg-param-grid">
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Cosa punciare</span>
      <div><div class="rg-segmented" id="coverageMode" role="group" aria-label="Cosa punciare">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-coverage="selected" aria-pressed="true">Solo i colori scelti</button>
        <button type="button" class="rg-segmented__item" data-coverage="all" aria-pressed="false">Tutta l'immagine</button>
      </div></div>
      <small class="rg-field__help">Solo i colori scelti: in automatico usa la soglia, in manuale i pixel vicini ai colori scelti. Tutta l'immagine: riempie tutto, ogni pixel col colore più vicino.</small>
    </div>
    <div id="thresholdField" class="rg-param-grid__wide">${campo('threshold')}</div>
    <label class="rg-choice rg-param-grid__wide" id="excludeBackgroundField">
      <input type="checkbox" id="excludeBackground" />
      <span>Escludi un colore di sfondo</span>
    </label>
    <label class="rg-field" id="bgColorsField">
      <span class="rg-field__label">Colori di sfondo</span>
      <input class="rg-input" id="backgroundColors" type="text" placeholder="#ffffff" />
    </label>
    <div id="bgToleranceField" class="">${campo('backgroundTolerance')}</div>
  </div>`,
      }),
      sezione({
        indice: 3, titolo: "Colori",
        contenuto: `<div class="rg-param-grid">
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Colori dei livelli</span>
      <div><div class="rg-segmented" id="paletteMode" role="group" aria-label="Colori dei livelli">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-palette="auto" aria-pressed="true">Automatici</button>
        <button type="button" class="rg-segmented__item" data-palette="manual" aria-pressed="false">Manuale</button>
      </div></div>
      <small class="rg-field__help">Automatici: l'algoritmo sceglie i colori. Manuale: li prendi dall'immagine col contagocce, ognuno con la sua tolleranza; i pixel vicini ci rientrano.</small>
    </div>
    <div id="colorCountField" class="rg-param-grid__wide">${campo('colorCount')}</div>
  </div>
  <div id="manualPalette" hidden>
    <ul class="rg-color-map" id="manualList"></ul>
    <div class="rg-cluster">
      <button type="button" id="addManualBtn" class="rg-button rg-button--ghost rg-button--small">Aggiungi colore</button>
    </div>
  </div>
  <ul class="rg-color-map" id="stopList"></ul>`,
      }),
      sezione({
        indice: 4, titolo: "Riempimento", apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid">
    ${campo('densitySpacingMm')}
    ${campo('minStitchMm')}
    ${campo('reinsertionRounds')}
    ${campo('maxPoints')}
    ${campo('targetDensityPct')}
  </div>`,
      }),
      sezione({
        indice: 5, titolo: "Stile e percorso", apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid">
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Distribuzione dei punti</span>
      <div><div class="rg-segmented" id="styleMode" role="group" aria-label="Distribuzione dei punti">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-style="carpet" aria-pressed="true">Regolare</button>
        <button type="button" class="rg-segmented__item" data-style="degrade" aria-pressed="false">Degradé</button>
      </div></div>
      <small class="rg-field__help">Regolare: griglia uniforme. Degradé: scarto e spostamento casuali per un effetto sfumato.</small>
    </div>
    <div id="degradeDropField" class="" hidden>${campo('degradeDrop')}</div>
    <div id="degradeJitterField" class="" hidden>${campo('degradeJitter')}</div>
    <div id="seedField" class="rg-param-grid__wide" hidden>${campo('seed')}
  <div class="rg-cluster"><button type="button" id="newSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova variante</button></div></div>
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Ordinamento del percorso</span>
      <div><div class="rg-segmented" id="orderMode" role="group" aria-label="Ordinamento del percorso">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-order="scanline" aria-pressed="true">A righe</button>
        <button type="button" class="rg-segmented__item" data-order="nearest" aria-pressed="false">Più vicino</button>
      </div></div>
      <small class="rg-field__help">A righe: veloce e regolare. Più vicino: percorso più corto ma pesante su molte migliaia di punti.</small>
    </div>
    <div id="scanlineBandField" class="">${campo('scanlineBandMm')}</div>
    <label class="rg-choice rg-param-grid__wide" id="serpentineField">
      <input type="checkbox" id="serpentine" />
      <span>Righe a serpentina (alterna il verso)</span>
    </label>
  </div>`,
      }),
      sezione({
        indice: 6, titolo: "Esportazione", apribile: true, aperta: false,
        contenuto: `<div class="rg-param-grid">
    ${campo('chunkSize')}
  </div>`,
      }),
    ],
    // Analizza (l'anteprima rapida) è di bitmap: sta a sinistra, fra le viste. L'anteprima si rifà già da sola a ogni cambio: niente «Ricalcola da solo».
    anteprima: { viste: '<button id="analyzeBtn" class="rg-button rg-button--outline rg-button--small" type="button">Analizza</button>', genera: true },
  });
  attivaCampiNumero(root);
  // i due pezzi che il guscio comune non ha: l'avviso sopra la tela e la barra di avanzamento sotto
  const avviso = document.createElement('div');
  avviso.className = 'bitmap-alert'; avviso.id = 'previewAlert'; avviso.setAttribute('role', 'status'); avviso.setAttribute('aria-live', 'polite');
  root.querySelector('#canvas')!.before(avviso);
  const avanzamento = document.createElement('div');
  avanzamento.className = 'bitmap-progress'; avanzamento.id = 'progress';
  (root.querySelector('#status')!.parentElement as HTMLElement).before(avanzamento);

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  const params: BitmapParams = { ...defaultBitmapParams };
  let source: Source = demoSource();
  let sourceName = '';
  let onlyColor = '';                 // '' = tutti i colori (filtro di sola generazione, come "Solo SVG")
  /**
   * L'ULTIMO tracciato generato, tenuto per INTERO (risultato + SVG + i parametri con cui è nato):
   * così "Esporta" dopo "Genera" non ricalcola niente — prima l'SVG riusava e il DST no, e rifaceva
   * tutto da capo. Lo azzera `scheduleAnalyze()` a ogni cambio di parametro: non può essere stantio.
   */
  let lastGenerated: { res: BitmapPipelineResult; svg: string; params: BitmapParams } | null = null;
  let analyzeTimer: number | undefined;
  let busy = false;                   // una generazione alla volta
  let cambiatoDurante = false;        // parametri toccati MENTRE si generava → il risultato non si tiene

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function demoSource(): Source {
    const img = sampleImage();
    return { name: '', pixelsAt: () => img };
  }

  /** mm per pixel: da realWidthMm (fonte di verità, R11) o stima al DPI di `dpiEstimate`. */
  function mmPerPx(widthPx: number): number {
    if (params.realWidthMm > 0 && widthPx > 0) return params.realWidthMm / widthPx;
    return 25.4 / (params.dpiEstimate > 0 ? params.dpiEstimate : 96);
  }

  // ---- FASE LEGGERA: preview (aggiornata in tempo reale, niente ordinamento). ----
  let currentPreviewColors: BitmapPreviewColor[] = [];   // colori dell'ultima preview (per ridisegnare le righe onlyColor)
  function renderPreview() {
    if (busy) return;                 // durante la generazione la tela mostra il tracciato, non i puntini
    try {
      const px = source.pixelsAt(params.maxWidthPx);
      const prev = runBitmapPreview(px.rgba, px.width, px.height, params, mmPerPx(px.width));
      currentPreviewColors = prev.colors;
      $('layer').innerHTML = prev.svg;
      buildStopList(prev.colors);
      showThinningAlert(prev.previewPoints, prev.drawnPoints);
      const selPct = prev.totalPixels ? (100 * prev.selectedPixels / prev.totalPixels).toFixed(1) : '0';
      const genTip = lastGenerated ? '' : ' · premi Genera per il tracciato';
      $('status').textContent = prev.colors.length
        ? `Preview: ${prev.colors.length} colori · ${prev.selectedPixels} pixel (${selPct}%)${genTip}`
        : 'Nessun colore selezionato: abbassa la soglia o cambia immagine';
    } catch (e) {
      $('status').textContent = 'Errore preview: ' + (e as Error).message;
      console.error(e);
    }
  }

  /**
   * L'anteprima ha un tetto di DISEGNO (`PREVIEW_MAX_DOTS`): oltre quello dirada i puntini in modo
   * proporzionale, e sullo schermo compaiono buchi regolari che NEL RICAMO NON CI SONO. Il difetto
   * non è il diradamento, è che prima taceva: qui lo dichiara, con la via d'uscita (Genera).
   */
  function showThinningAlert(previewPoints: number, drawnPoints: number) {
    const host = $('previewAlert');
    if (drawnPoints >= previewPoints) { host.innerHTML = ''; return; }
    const n = (v: number) => v.toLocaleString('it-IT');
    const pct = Math.round((100 * drawnPoints) / previewPoints);
    host.innerHTML = `<div class="rg-alert rg-alert--warning">
      <div>
        <p class="rg-alert__title">Anteprima diradata: ne vedi il ${pct}%</p>
        <p class="rg-alert__message">I punti sono ${n(previewPoints)}, oltre il tetto di disegno (${n(PREVIEW_MAX_DOTS)}): l'anteprima ne mostra ${n(drawnPoints)}, quindi i buchi che vedi non sono nel ricamo. Premi <strong>Genera</strong> per il tracciato completo, oppure aumenta la distanza tra i punti.</p>
      </div>
    </div>`;
  }

  function scheduleAnalyze() {
    lastGenerated = null;                         // ogni cambio invalida il tracciato generato
    if (busy) cambiatoDurante = true;             // ...compreso quello che si sta generando proprio ora
    if (analyzeTimer !== undefined) clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(renderPreview, 150) as unknown as number;
  }

  // ---- BARRA DI AVANZAMENTO: cosa sta facendo, e che sta andando avanti. ----
  let progLabel: HTMLElement | null = null, progPct: HTMLElement | null = null, progValue: HTMLElement | null = null;

  function showProgress(): void {
    const host = $('progress');
    host.innerHTML = `<div class="rg-progress">
      <div class="rg-progress__meta"><span data-p="label"></span><span class="rg-mono" data-p="pct"></span></div>
      <div class="rg-progress__track"><div class="rg-progress__value" data-p="value" style="--progress:0%"></div></div>
    </div>`;
    progLabel = host.querySelector('[data-p="label"]');
    progPct = host.querySelector('[data-p="pct"]');
    progValue = host.querySelector('[data-p="value"]');
  }

  function setProgress(label: string, pct: number): void {
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    if (progLabel) progLabel.textContent = label;
    if (progPct) progPct.textContent = `${v}%`;
    if (progValue) progValue.style.setProperty('--progress', `${v}%`);
  }

  function hideProgress(): void {
    $('progress').innerHTML = '';
    progLabel = progPct = progValue = null;
  }

  const BOTTONI = ['analyzeBtn', 'genBtn', 'exportBtn', 'exportDstBtn'] as const;
  function setBusy(on: boolean): void {
    for (const id of BOTTONI) ($(id) as HTMLButtonElement).disabled = on;
  }

  /**
   * Cede il turno al browser e torna appena può.
   *
   * NON usa `setTimeout`: in una scheda in secondo piano i timer vengono strozzati a un secondo,
   * e misurandolo si vede — con la scheda nascosta gli aggiornamenti della barra passavano da 60ms
   * a 1000ms l'uno dall'altro e la generazione si trascinava per minuti invece che per secondi.
   * Un messaggio su MessageChannel è un compito normale, non un timer: non viene strozzato.
   */
  function respira(): Promise<void> {
    return new Promise((res) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); res(); };
      ch.port2.postMessage(0);
    });
  }

  /**
   * Consuma il motore a passi mostrando la barra. Il respiro ogni ~60ms non è una pausa decorativa:
   * è l'unico modo di lasciar DIPINGERE il browser. Senza, il lavoro sincrono tiene il filo occupato
   * dall'inizio alla fine e la barra resterebbe ferma sullo 0% — cioè il contrario di quello che
   * deve fare. Con l'ordinamento "Più vicino" (O(n²)) si parla di secondi veri.
   */
  async function runWithProgress<T>(steps: Generator<StitchProgress, T, void>): Promise<T> {
    showProgress();
    setProgress('Avvio…', 0);
    let ultimoRespiro = 0;              // 0 = il primo passo respira SUBITO, così la prima etichetta si vede
    let r = steps.next();
    while (!r.done) {
      const p = r.value;
      setProgress(p.phase, p.total ? (100 * p.done) / p.total : 0);
      if (performance.now() - ultimoRespiro > 60) {
        await respira();
        ultimoRespiro = performance.now();
      }
      r = steps.next();
    }
    return r.value;
  }

  // ---- FASE PESANTE: generazione del tracciato (solo su richiesta). ----
  async function generate(): Promise<{ res: BitmapPipelineResult; svg: string; params: BitmapParams } | null> {
    if (busy) return null;
    busy = true; cambiatoDurante = false; setBusy(true);
    try {
      const px = source.pixelsAt(params.maxWidthPx);
      // I parametri si CONGELANO qui. Finché la generazione era sincrona nessuno poteva toccarli a
      // metà strada; ora che cede il turno al browser, sì — e il motore li leggerebbe cambiati a
      // lavoro iniziato. Si copiano anche gli array: le liste di colori si modificano sul posto.
      const snap: BitmapParams = {
        ...params,
        sampleColors: [...params.sampleColors],
        backgroundColors: [...params.backgroundColors],
        manualColors: [...params.manualColors],
        manualTolerances: [...params.manualTolerances],
      };
      const res = await runWithProgress(bitmapPipelineSteps(px.rgba, px.width, px.height, snap, mmPerPx(px.width), onlyColor || undefined));
      const cap = snap.chunkSize > 0 ? snap.chunkSize : 5000;
      setProgress('Costruzione del tracciato', 100);
      const svg = buildSvg(res.exportLayers, { bounds: res.bounds, marginMm: 4, maxPointsPerPath: cap });
      $('layer').innerHTML = buildSvg(res.layers, { bounds: res.bounds, marginMm: 4, maxPointsPerPath: cap });
      $('previewAlert').innerHTML = '';        // il tracciato generato è completo: niente da avvisare
      const only = onlyColor ? ` · solo ${onlyColor}` : '';
      $('status').textContent = res.stopCount
        ? `Generato: ${res.stopCount} stop · filo ${(res.threadMm / 1000).toFixed(2)} m${only}`
        : 'Niente da generare: controlla soglia e colori';
      // Parametri cambiati mentre si generava? Allora questo tracciato è già vecchio: non si tiene in
      // cache, altrimenti un export lo userebbe credendolo aggiornato.
      lastGenerated = cambiatoDurante ? null : { res, svg, params: snap };
      return lastGenerated;
    } catch (e) {
      $('status').textContent = 'Errore in generazione: ' + (e as Error).message;
      console.error(e);
      return null;
    } finally {
      busy = false; setBusy(false); hideProgress();
      if (cambiatoDurante) { cambiatoDurante = false; renderPreview(); }
    }
  }

  /** Elenco dei colori (stop) rilevati con conteggio/area% e la scelta "solo questo colore". */
  function buildStopList(colors: BitmapPreviewColor[]) {
    const host = $('stopList');
    host.innerHTML = '';
    if (!colors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun colore selezionato: abbassa la soglia o cambia immagine.</p></li>';
      return;
    }
    // riga "Tutti i colori"
    host.appendChild(stopRow('', 'Tutti i colori', colors.reduce((s, c) => s + c.preparedCount, 0), null));
    for (const c of colors) host.appendChild(stopRow(c.color, c.color.toUpperCase(), c.preparedCount, c.areaPct));
  }

  function stopRow(color: string, label: string, count: number, areaPct: number | null): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'rg-color-map__row';
    const sw = document.createElement('span');
    sw.className = 'rg-color-map__swatch' + (color ? '' : ' rg-color-map__swatch--none');
    if (color) sw.style.setProperty('--swatch', color);
    const code = document.createElement('span');
    code.className = 'rg-color-map__code';
    code.textContent = label + ' ';
    const meta = document.createElement('span');
    meta.className = 'rg-color-map__meta';
    meta.textContent = areaPct === null ? `${count} punti` : `${count} punti · ${areaPct.toFixed(1)}%`;
    code.appendChild(meta);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rg-button rg-button--ghost rg-button--small';
    const active = onlyColor.toUpperCase() === color.toUpperCase();
    btn.textContent = active ? 'attivo' : (color ? 'solo' : 'tutti');
    btn.disabled = active;
    btn.addEventListener('click', () => { onlyColor = color; lastGenerated = null; buildStopList(currentPreviewColors); });
    row.append(sw, code, btn);
    return row;
  }

  // ---- cablaggio dei campi numerici (id ↔ chiave param). ----
  const NUMS: NumBind[] = [
    { id: 'realWidth', key: 'realWidthMm', min: 0 },
    { id: 'dpiEstimate', key: 'dpiEstimate', int: true, min: 1 },
    { id: 'maxWidthPx', key: 'maxWidthPx', int: true, min: 0 },
    { id: 'threshold', key: 'threshold', int: true, min: 0, max: 255 },
    { id: 'backgroundTolerance', key: 'backgroundToleranceRgb', min: 0 },
    { id: 'colorCount', key: 'colorCount', int: true, min: 1, max: 16 },
    { id: 'densitySpacingMm', key: 'densitySpacingMm', min: 0 },
    { id: 'minStitchMm', key: 'minStitchMm', min: 0 },
    { id: 'reinsertionRounds', key: 'reinsertionRounds', int: true, min: 0 },
    { id: 'maxPoints', key: 'maxPoints', int: true, min: 0 },
    { id: 'targetDensityPct', key: 'targetDensityPct', min: 0, max: 100 },
    { id: 'degradeDrop', key: 'degradeDrop', min: 0, max: 1 },
    { id: 'degradeJitter', key: 'degradeJitterMm', min: 0 },
    { id: 'seed', key: 'seed', int: true, min: 1 },
    { id: 'scanlineBandMm', key: 'scanlineBandMm', min: 0.2 },
    { id: 'chunkSize', key: 'chunkSize', int: true, min: 0 },
  ];
  function wireNums() {
    for (const b of NUMS) {
      const el = $(b.id) as HTMLInputElement;
      impostaNumero(el, params[b.key] as number);
      el.addEventListener('change', () => {
        let v = b.int ? Math.trunc(leggiCampo(el)) : leggiCampo(el);
        if (Number.isNaN(v)) v = defaultBitmapParams[b.key] as number;
        if (b.min !== undefined) v = Math.max(b.min, v);
        if (b.max !== undefined) v = Math.min(b.max, v);
        (params[b.key] as number) = v;
        impostaNumero(el, v);
        if (b.id === 'realWidth' || b.id === 'dpiEstimate' || b.id === 'maxWidthPx') updateFileStatus();
        scheduleAnalyze();
      });
    }
  }

  function wireText(id: string, apply: (parts: string[]) => void) {
    ($(id) as HTMLInputElement).addEventListener('change', () => {
      const parts = ($(id) as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
      apply(parts);
      scheduleAnalyze();
    });
  }
  wireText('backgroundColors', (p) => { params.backgroundColors = p; });

  function wireCheck(id: string, apply: (on: boolean) => void) {
    ($(id) as HTMLInputElement).addEventListener('change', () => { apply(($(id) as HTMLInputElement).checked); scheduleAnalyze(); });
  }
  wireCheck('excludeBackground', (on) => { params.excludeBackground = on; applySelectionVisibility(); });
  wireCheck('serpentine', (on) => { params.serpentine = on; });

  /**
   * Visibilità dei controlli di SELEZIONE e PALETTE in un colpo solo:
   *  - soglia + sfondo servono SOLO in AUTO + "solo i colori scelti" (in manuale la selezione è per
   *    vicinanza ai colori scelti; in "tutta l'immagine" si prende tutto);
   *  - numero colori (auto) vs lista manuale (contagocce).
   */
  function applySelectionVisibility() {
    const all = params.coverage === 'all';
    const manual = params.paletteMode === 'manual';
    const showThreshold = !all && !manual;                 // soglia/sfondo solo in auto + selezione
    ($('thresholdField') as HTMLElement).hidden = !showThreshold;
    ($('excludeBackgroundField') as HTMLElement).hidden = !showThreshold;
    ($('bgColorsField') as HTMLElement).hidden = !showThreshold || !params.excludeBackground;
    ($('bgToleranceField') as HTMLElement).hidden = !showThreshold || !params.excludeBackground;
    ($('colorCountField') as HTMLElement).hidden = manual;
    ($('manualPalette') as HTMLElement).hidden = !manual;
  }

  // ---- segmented: stile e ordinamento ----
  function wireSegmented(id: string, attr: string, get: () => string, set: (v: string) => void, after: () => void) {
    const btns = Array.from($(id).querySelectorAll('.rg-segmented__item')) as HTMLButtonElement[];
    const sync = () => btns.forEach((b) => {
      const on = b.dataset[attr] === get();
      b.classList.toggle('rg-segmented__item--active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    btns.forEach((b) => b.addEventListener('click', () => {
      const want = b.dataset[attr]!;
      if (get() === want) return;
      set(want); sync(); after(); scheduleAnalyze();
    }));
    sync();
    return sync;
  }
  const syncStyle = wireSegmented('styleMode', 'style', () => params.style, (v) => { params.style = v as BitmapParams['style']; }, () => {
    const deg = params.style === 'degrade';
    ($('degradeDropField') as HTMLElement).hidden = !deg;
    ($('degradeJitterField') as HTMLElement).hidden = !deg;
    ($('seedField') as HTMLElement).hidden = !deg;
  });
  const syncOrder = wireSegmented('orderMode', 'order', () => params.ordering, (v) => { params.ordering = v as BitmapParams['ordering']; }, () => {
    ($('scanlineBandField') as HTMLElement).hidden = params.ordering !== 'scanline';
    ($('serpentineField') as HTMLElement).hidden = params.ordering !== 'scanline';
  });

  const syncCoverage = wireSegmented('coverageMode', 'coverage', () => params.coverage, (v) => { params.coverage = v as BitmapParams['coverage']; }, applySelectionVisibility);

  // ---- Colori dei livelli: switch Automatici / Manuale (palette scelta col contagocce) ----
  const MAX_MANUAL = 16;
  const asHex6 = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : '#808080');

  const syncPalette = wireSegmented('paletteMode', 'palette', () => params.paletteMode,
    (v) => { params.paletteMode = v as BitmapParams['paletteMode']; },
    () => {
      // passando a "Manuale" con lista vuota, parto dai colori automatici correnti (così li posso ritoccare)
      if (params.paletteMode === 'manual' && !params.manualColors.length && currentPreviewColors.length) {
        params.manualColors = currentPreviewColors.map((c) => asHex6(c.color));
        params.manualTolerances = params.manualColors.map(() => 30);
      }
      applySelectionVisibility();
      buildManualList();
    });

  function buildManualList() {
    const host = $('manualList');
    host.innerHTML = '';
    if (!params.manualTolerances) params.manualTolerances = [];
    params.manualColors.forEach((col, i) => {
      if (params.manualTolerances[i] === undefined) params.manualTolerances[i] = 30;
      const li = document.createElement('li');
      li.className = 'rg-color-map__row';

      const sw = document.createElement('label');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', col);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'rg-u-visually-hidden';
      picker.value = asHex6(col);
      picker.setAttribute('aria-label', `Colore livello ${i + 1}`);
      picker.addEventListener('input', () => {
        params.manualColors[i] = picker.value.toUpperCase();
        sw.style.setProperty('--swatch', picker.value);
        code.textContent = picker.value.toUpperCase();
        scheduleAnalyze();
      });
      sw.appendChild(picker);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = col.toUpperCase();

      // Tolleranza per-colore (distanza RGB): quanto largo è il "raggio di cattura" del colore.
      const tolGroup = document.createElement('span');
      tolGroup.className = 'bitmap-tol';
      const tolPre = document.createElement('span');
      tolPre.className = 'bitmap-tol__pre';
      tolPre.textContent = '±';
      const modelloTol = document.createElement('template');
      modelloTol.innerHTML = campoNumeroInline({
        aria: `Tolleranza colore ${i + 1} (raggio di cattura RGB)`, unita: '', valore: params.manualTolerances[i], passo: 5, min: 0,
        larghezza: '5ch', titolo: 'Tolleranza: quanto largo è il raggio di cattura di questo colore (distanza RGB)',
      });
      const tolCampo = modelloTol.content.firstElementChild as HTMLElement;
      const tol = tolCampo.querySelector('input') as HTMLInputElement;
      tol.addEventListener('change', () => {
        const v = leggiCampo(tol);
        params.manualTolerances[i] = Number.isNaN(v) ? 30 : Math.max(0, v);
        impostaNumero(tol, params.manualTolerances[i]);
        scheduleAnalyze();
      });
      tolGroup.append(tolPre, tolCampo);

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rg-icon-button';
      pick.innerHTML = EYEDROPPER_SVG;
      pick.title = 'Campiona dall\'immagine';
      pick.setAttribute('aria-label', `Campiona il colore ${i + 1} dall'immagine`);
      pick.addEventListener('click', () => enterPickMode(i));

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rg-icon-button rg-icon-button--danger bitmap-tol__remove';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Rimuovi colore ${i + 1}`);
      rm.addEventListener('click', () => { params.manualColors.splice(i, 1); params.manualTolerances.splice(i, 1); buildManualList(); scheduleAnalyze(); });

      li.append(sw, code, tolGroup, pick, rm);
      host.appendChild(li);
    });
    if (!params.manualColors.length) {
      host.innerHTML = '<li><p class="rg-color-map__empty">Nessun colore scelto: premi “Aggiungi colore” e campiona dall’immagine.</p></li>';
    }
    ($('addManualBtn') as HTMLButtonElement).disabled = params.manualColors.length >= MAX_MANUAL;
  }

  $('addManualBtn').addEventListener('click', () => {
    if (params.manualColors.length >= MAX_MANUAL) return;
    params.manualColors.push('#808080');
    params.manualTolerances.push(30);
    buildManualList();
    enterPickMode(params.manualColors.length - 1);   // creo il colore ed entro subito nel contagocce
  });

  // ---- Contagocce: mostra l'immagine vera, lente sul pixel + codice, clic = quel colore diventa il livello ----
  function enterPickMode(index: number) {
    const px = source.pixelsAt(params.maxWidthPx);
    const W = px.width, H = px.height, SAMPLE = 15, HALF = 7, LENS = 132;
    const img = document.createElement('canvas');
    img.width = W; img.height = H;
    img.className = 'bitmap-pick__img';
    img.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.rgba), W, H), 0, 0);

    const overlay = document.createElement('div');
    overlay.className = 'bitmap-pick';
    const hint = document.createElement('div');
    hint.className = 'bitmap-pick__hint';
    hint.textContent = 'Muovi sul pixel, clicca per campionare il colore · Esc per annullare';
    const lens = document.createElement('canvas');
    lens.className = 'bitmap-pick__lens';
    lens.width = LENS; lens.height = LENS;
    const lctx = lens.getContext('2d')!;
    lctx.imageSmoothingEnabled = false;
    const tag = document.createElement('div');
    tag.className = 'bitmap-pick__tag';
    overlay.append(img, hint, lens, tag);
    $('canvas').appendChild(overlay);

    const colorAt = (sx: number, sy: number): string => {
      const o = (sy * W + sx) * 4;
      const h = (v: number) => v.toString(16).padStart(2, '0');
      return `#${h(px.rgba[o])}${h(px.rgba[o + 1])}${h(px.rgba[o + 2])}`.toUpperCase();
    };
    const pixelOf = (e: MouseEvent) => {
      const rect = img.getBoundingClientRect();
      const sx = Math.max(0, Math.min(W - 1, Math.floor((e.clientX - rect.left) / rect.width * W)));
      const sy = Math.max(0, Math.min(H - 1, Math.floor((e.clientY - rect.top) / rect.height * H)));
      return { sx, sy };
    };
    const onMove = (e: MouseEvent) => {
      const { sx, sy } = pixelOf(e);
      lctx.clearRect(0, 0, LENS, LENS);
      lctx.drawImage(img, sx - HALF, sy - HALF, SAMPLE, SAMPLE, 0, 0, LENS, LENS);
      const cell = LENS / SAMPLE;
      lctx.strokeStyle = '#000'; lctx.lineWidth = 1; lctx.strokeRect(HALF * cell + 0.5, HALF * cell + 0.5, cell, cell);
      lctx.strokeStyle = '#fff'; lctx.strokeRect(HALF * cell + 1.5, HALF * cell + 1.5, cell - 2, cell - 2);
      const hex = colorAt(sx, sy);
      tag.textContent = hex; tag.style.setProperty('--c', hex);
      const orect = overlay.getBoundingClientRect();
      const lx = Math.min(orect.width - LENS - 8, e.clientX - orect.left + 18);
      const ly = Math.min(orect.height - LENS - 28, e.clientY - orect.top + 18);
      lens.style.left = `${lx}px`; lens.style.top = `${ly}px`;
      tag.style.left = `${lx}px`; tag.style.top = `${ly + LENS + 4}px`;
    };
    const exit = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    const onClick = (e: MouseEvent) => {
      const { sx, sy } = pixelOf(e);
      params.manualColors[index] = colorAt(sx, sy);
      exit(); buildManualList(); scheduleAnalyze();
    };
    img.addEventListener('mousemove', onMove);
    img.addEventListener('click', onClick);
    // Il canvas ha pan/zoom (pointerdown → setPointerCapture): se non lo fermo, cattura il puntatore e il
    // click non arriva all'immagine → il colore non si campiona. Blocco i gesti puntatore/rotella
    // sull'overlay durante il contagocce.
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    overlay.addEventListener('pointerup', (e) => e.stopPropagation());
    overlay.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    document.addEventListener('keydown', onKey);
  }

  $('newSeedBtn').addEventListener('click', () => {
    params.seed = (params.seed % 999999) + 1;
    impostaNumero($('seed') as HTMLInputElement, params.seed);
    scheduleAnalyze();
  });

  // ---- import immagine: File → <canvas> → ImageData → pixel (l'unico pezzo legato al DOM) ----
  function decodeToSource(imgEl: HTMLImageElement, name: string): Source {
    return {
      name,
      pixelsAt: (maxWidthPx: number) => {
        let w = imgEl.naturalWidth || imgEl.width;
        let h = imgEl.naturalHeight || imgEl.height;
        if (maxWidthPx > 0 && w > maxWidthPx) { const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s)); }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(imgEl, 0, 0, w, h);
        return { rgba: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
      },
    };
  }

  function updateFileStatus() {
    const px = source.pixelsAt(params.maxWidthPx);
    const mmpp = mmPerPx(px.width);
    const wmm = Math.round(px.width * mmpp), hmm = Math.round(px.height * mmpp);
    const hint = params.realWidthMm > 0 ? 'reale' : `stima ${params.dpiEstimate} dpi`;
    $('fileStatus').textContent = `${sourceName || 'Immagine demo'}: ${px.width}×${px.height} px → ${wmm}×${hmm} mm (${hint})`;
  }

  /** Ripristina i parametri dal metadata di un file esportato dalla suite (R27). Ritorna false se non è nostro. */
  function restoreParams(meta: Record<string, unknown> | null): boolean {
    if (!meta || meta.rgProject !== 'bitmap') return false;
    const mp = meta.params;
    if (mp && typeof mp === 'object') {
      for (const k of Object.keys(defaultBitmapParams) as (keyof BitmapParams)[]) {
        const v = (mp as Record<string, unknown>)[k];
        if (v !== undefined) (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    reflectAllControls();
    return true;
  }

  /** Riallinea TUTTI i controlli del pannello ai `params` correnti (dopo un ripristino). */
  function reflectAllControls() {
    for (const b of NUMS) impostaNumero($(b.id) as HTMLInputElement, params[b.key] as number);
    reflectStaticControls();
    syncStyle(); syncOrder(); syncCoverage(); syncPalette();
    applySelectionVisibility();
    (['degradeDropField', 'degradeJitterField', 'seedField'] as const).forEach((id) => { ($(id) as HTMLElement).hidden = params.style !== 'degrade'; });
    (['scanlineBandField', 'serpentineField'] as const).forEach((id) => { ($(id) as HTMLElement).hidden = params.ordering !== 'scanline'; });
    buildManualList();
  }

  /**
   * Ripristina i parametri da un file .dst/.svg esportato dalla suite (R27). Il .dst porta i parametri nel
   * footer dopo l'END; l'SVG nel `<metadata>`. L'immagine sorgente non è nel file → si ricarica a parte.
   * Ritorna il messaggio di esito. `false` non-nostro/assente.
   */
  async function restoreFromFile(file: File): Promise<string> {
    if (/\.dst$/i.test(file.name)) {
      const meta = readDstMetadata(new Uint8Array(await file.arrayBuffer()));
      if (restoreParams(meta)) { renderPreview(); return `${file.name}: parametri ripristinati dal DST · ricarica l'immagine per rigenerare`; }
      return `${file.name}: nessun parametro RG nel DST`;
    }
    if (/\.svg$/i.test(file.name)) {
      const meta = readProjectMetadata(await file.text());
      if (restoreParams(meta)) { renderPreview(); return `${file.name}: parametri ripristinati dall'SVG · ricarica l'immagine per rigenerare`; }
      return `${file.name}: nessun parametro RG nell'SVG`;
    }
    return '';
  }

  $('fileInput').addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (/\.(dst|svg)$/i.test(file.name)) { $('fileStatus').textContent = await restoreFromFile(file); return; }

    const url = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = () => {
      URL.revokeObjectURL(url);
      sourceName = file.name.replace(/\.[^.]+$/, '');
      source = decodeToSource(imgEl, sourceName);
      onlyColor = '';
      renderPreview(); updateFileStatus(); pz.fit();
    };
    imgEl.onerror = () => { URL.revokeObjectURL(url); $('fileStatus').textContent = 'Errore: immagine non leggibile.'; };
    imgEl.src = url;
  });

  $('progettoInput').addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    $('progettoStatus').textContent = (await restoreFromFile(file)) || `${file.name}: formato non riconosciuto (serve .dst o .svg)`;
    (ev.target as HTMLInputElement).value = '';
  });

  $('demoBtn').addEventListener('click', () => {
    sourceName = ''; source = demoSource(); onlyColor = '';
    renderPreview(); updateFileStatus(); pz.fit();
  });
  $('analyzeBtn').addEventListener('click', () => { if (analyzeTimer !== undefined) clearTimeout(analyzeTimer); renderPreview(); });
  $('genBtn').addEventListener('click', () => { void generate(); });
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('exportBtn').addEventListener('click', async () => {
    if (busy) return;
    const name = sourceName ? `${sourceName}-bitmap.svg` : 'bitmap.svg';
    // La finestra "dove salvo" si apre SUBITO, prima di qualsiasi calcolo: il browser la concede solo
    // finché l'attivazione del clic è fresca (pochi secondi). Chiedendola DOPO una generazione lunga
    // veniva rifiutata e il file finiva zitto in Download — che è esattamente il difetto segnalato.
    const target = await pickSaveTarget({ suggestedName: name, description: 'Immagine SVG' });
    if (!target) { $('status').textContent = saveOutcomeMessage('cancelled', name); return; }
    const gen = lastGenerated ?? await generate();      // già generato? non si ricalcola niente
    if (!gen) return;
    // metadata riapribile (R27): riscrive l'SVG generato con il blocco rg-project
    const withMeta = injectMetadata(gen.svg, conBusta({ rgProject: 'bitmap', version: '0.1.0', params: gen.params }, { strati: gen.res.exportLayers, sorgente: sorgenteBusta(gen.params) }));
    const outcome = await target.write(withMeta);
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${gen.res.stopCount} stop in sequenza`;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    // Export ricamo Tajima .dst tramite la "possibilità" globale del core: gli exportLayers sono già in mm
    // reali; l'adattatore fa un blocco per polilinea, un ago per stop (cambio-colore in sequenza).
    if (busy) return;
    const name = sourceName ? `${sourceName}-bitmap.dst` : 'bitmap.dst';
    const target = await pickSaveTarget({ suggestedName: name, ...DST_FILE });   // destinazione PRIMA del calcolo
    if (!target) { $('status').textContent = saveOutcomeMessage('cancelled', name); return; }
    // Prima qui si rigenerava SEMPRE da zero, anche subito dopo aver premuto Genera. Ora riusa.
    const gen = lastGenerated ?? await generate();
    if (!gen) return;
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(gen.res.exportLayers, {
        label: (sourceName || 'BITMAP').toUpperCase().slice(0, 16),
        metadata: conBusta({ rgProject: 'bitmap', version: '0.1.0', params: gen.params }, { strati: gen.res.exportLayers, sorgente: sorgenteBusta(gen.params) }),   // parametri riapribili dal .dst (R27)
      });
    } catch (e) {
      $('status').textContent = (e as Error).message;   // niente da cucire → messaggio, non file vuoto
      return;
    }
    const outcome = await target.write(bytes);
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${gen.res.stopCount} stop · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  /** Sorgente per la busta K2: l'immagine caricata (raster) con la larghezza reale se nota; nessuna per la demo. */
  function sorgenteBusta(p: { realWidthMm?: number }) {
    if (!sourceName) return undefined;
    return { tipo: 'raster' as const, nome: sourceName, ...(p.realWidthMm && p.realWidthMm > 0 ? { larghezzaMm: p.realWidthMm } : {}) };
  }

  /** Inserisce il metadata rg-project subito dopo il tag <svg> (R27), come fa buildSvg quando gli si passa metadata. */
  function injectMetadata(svg: string, meta: Record<string, unknown>): string {
    const block = `\n  <metadata id="rg-project">${JSON.stringify(meta)}</metadata>`;
    return svg.replace(/(<svg\b[^>]*>)/, `$1${block}`);
  }

  // riallinea i controlli statici ai default e collega la preview alla lista colori
  function reflectStaticControls() {
    ($('backgroundColors') as HTMLInputElement).value = params.backgroundColors.join(', ');
    ($('excludeBackground') as HTMLInputElement).checked = params.excludeBackground;
    ($('serpentine') as HTMLInputElement).checked = params.serpentine;
  }

  wireNums();
  reflectStaticControls();
  syncStyle();
  syncOrder();
  syncCoverage();
  syncPalette();
  applySelectionVisibility();
  buildManualList();
  renderPreview();
  updateFileStatus();
}

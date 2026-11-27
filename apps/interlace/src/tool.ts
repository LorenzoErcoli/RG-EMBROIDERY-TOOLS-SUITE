import '@rg/ui/rg.css';
import './interlace.css';
import {
  type Role, type ImportResult, type Contour,
  ROLE_LABELS, polygonArea, pointInPolygon,
  buildSvg, buildSvgInSourceFrame, dstFromExportLayers, DST_FILE,
  parseSvgToContours, parseDxfToContours, readProjectMetadata, readDstMetadata,
  applyRealWidth, importResultFromContours, measureContours, conBusta,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { collegaStilista, stratiCuciti, type AggancioStilista } from '@rg/ui/stilista';
import { runPipeline, type RoleAssignment } from './pipeline';
import { defaultInterlaceParams, DENSITY_MIN_MM, DENSITY_MAX_MM, type InterlaceParams } from './engine';
import { sampleContours } from './sample';
import { campionatoreImmagine } from './motore';
import {
  barraAnteprima, barraStato, sezioneSorgente, campoNumero, campoNumeroInline,
  attivaCampiNumero, leggiCampo, impostaNumero, scriviNumero,
} from '@rg/ui/anatomia';

/** `campoNumeroInline` non ha id (sta nelle righe di lista): i campi compatti che il tool cerca per id lo ricevono qui. */
const conId = (html: string, id: string): string => html.replace('<input ', `<input id="${id}" `);

/** Un pezzo di HTML (un solo elemento) come elemento, per le righe costruite col DOM. */
function elementoDa(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/** Un campo numerico del gruppo "Riempimento". L'unità va nello slot del DS, mai nell'etichetta. */
interface Field { key: keyof InterlaceParams; label: string; unit: string; step: number; help?: string; }

// Solo parametri canonici §3 in questa prima versione. "Movimento/spigolosità" e palette in commit successivi.
const PARAMS: Field[] = [
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.5, help: 'lunghezza minima di un passaggio' },
  { key: 'maxStitchMm', label: 'Lunghezza massima del punto', unit: 'mm', step: 0.5, help: 'i passaggi non superano questa misura' },
  { key: 'densitySpacingMm', label: 'Densità (distanza tra le file di filo)', unit: 'mm', step: 0.1, help: 'densità di ogni colore, 0,8–10 mm: piccola = fitto, grande = rado; fino a ~8 il filo cala, oltre non si dirada più' },
  { key: 'voidClearanceMm', label: 'Distanza di sicurezza da bordi e vuoti', unit: 'mm', step: 0.1 },
];

// Icona contagocce (pipette, stile Lucide), la stessa del bottone "campiona" di bitmap.
const EYEDROPPER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>'
  + '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

// Questo tool usa solo due ruoli: l'area da ricamare e le aree vuote.
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'EXCLUSION'];

/** Monta il tool "Interlace" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountInterlace(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Interlace', opts.backHref)}
  <div class="rg-workspace interlace-workspace">
    <aside class="rg-workspace__panel">
      ${sezioneSorgente({
        tipo: 'cartamodello', accetta: '.svg,.dxf', statoIniziale: 'Nessun file: uso il cartamodello demo.',
        demo: 'Cartamodello demo', stilista: true,
        extra: `<div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Oggetto pieno (senza fori)</span>
            <div class="rg-cluster">
              ${conId(campoNumeroInline({ aria: 'Larghezza dell’oggetto pieno', unita: 'mm', valore: 100, passo: 1, min: 1 }), 'objW')}
              ${conId(campoNumeroInline({ aria: 'Altezza dell’oggetto pieno', unita: 'mm', valore: 100, passo: 1, min: 1 }), 'objH')}
            </div>
            <div class="rg-cluster"><button type="button" id="objBtn" class="rg-button rg-button--outline rg-button--small">Genera oggetto</button></div>
            <small class="rg-field__help">larghezza × altezza: crea un rettangolo pieno da riempire, senza importare un file</small>
          </div>`,
      })}

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
          ${campoNumero({ id: 'paletteCycles', etichetta: 'Ripetizioni della sequenza', unita: 'cicli', valore: 1, passo: 1, min: 1, aiuto: 'quante volte l’intera sequenza di colori si ripete lungo il tracciato (genera i cambi-ago)' })}
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
              ${conId(campoNumeroInline({ aria: 'Numero colori', unita: 'col', valore: 4, passo: 1, min: 1, max: 12, larghezza: '6ch' }), 'colorCount')}
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
            <label class="rg-choice">
              <input type="checkbox" id="excludeBackground" />
              <span>Lascia lo sfondo senza ricamo</span>
            </label>
            <div class="rg-cluster" id="bgField" hidden>
              <label class="rg-color-map__swatch" id="bgSwatch">
                <input type="color" id="bgColor" class="rg-u-visually-hidden" aria-label="Colore dello sfondo" />
              </label>
              <span class="rg-color-map__code" id="bgCode">#FFFFFF</span>
              <button type="button" id="bgPickBtn" class="rg-icon-button" aria-label="Prendi il colore dello sfondo dall’immagine"></button>
              <span class="interlace-tol"><span class="interlace-tol__pre">±</span>${conId(campoNumeroInline({ aria: 'Tolleranza dello sfondo (distanza RGB)', unita: '', valore: '', passo: 5, min: 0 }), 'bgTolerance')}</span>
            </div>
            <label class="rg-choice">
              <input type="checkbox" id="toneBlend" />
              <span>Sfumatura dai toni</span>
            </label>
            ${campoNumero({ id: 'toneSoftness', etichetta: 'Morbidezza della sfumatura', unita: 'mm', valore: 4, passo: 1, min: 0, largo: false })}
            <small class="rg-field__help" id="toneHelp">spunta per non dare più ogni punto a un colore solo: i fili si dividono il ricamo in proporzione al tono dell’immagine e il filo totale resta pari ovunque. I divieti della tabella valgono ancora: il filo vietato sfuma avvicinandosi alla zona vietata. La morbidezza è quanto si sfoca l’immagine: poco = segue ogni variazione, tanto = passaggi larghi. Serve un’immagine.</small>
            <small class="rg-field__help" id="bgHelp" hidden>i punti dell’immagine vicini a questo colore restano <strong>tessuto a vista</strong>: nessun filo ci cuce e nessuno ci passa sopra. Il bordo del disegno resta netto (lì il sormonto non si applica: il vuoto è voluto). La tolleranza è quanto largo è il raggio attorno al colore.</small>
          </div>
          ${campoNumero({ id: 'clusterStrength', etichetta: 'Intensità agglomerati', unita: '%', valore: 60, passo: 5, min: 0, max: 100, aiuto: 'quanto i colori si separano in zone: basso = appena accennate, alto = molto marcate. Con la sfumatura dai toni: quanto filo in tutto (la proporzione la decide l’immagine).' })}
          <div class="rg-field rg-param-grid__wide" id="zoneBanField" hidden>
            <span class="rg-field__label">Dove passa ogni filo</span>
            <div class="rg-table-wrap" id="zoneBanTable"></div>
            <div class="rg-cluster"><button type="button" id="zoneBanResetBtn" class="rg-button rg-button--ghost rg-button--small">Consenti tutto</button></div>
            <small class="rg-field__help">righe = fili, colonne = zone. Spegni una casella perché quel filo NON entri in quella zona: lì non cuce e non ci passa nemmeno di transito, quindi può costare qualche stacco in più (i tratti sono contati in basso). Spegnendo un’intera colonna quella zona resta nuda, tessuto a vista.</small>
          </div>
          ${campoNumero({ id: 'zoneOverlap', etichetta: 'Sormonto ai bordi delle zone', unita: 'mm', valore: '', passo: 0.1, min: 0, attributi: 'placeholder="auto"', aiuto: 'due colori che si fermano testa a testa lasciano una fessura: a ridosso del confine nessuno dei due riesce più a cucire. Qui ogni filo sconfina di tanto oltre il bordo vietato, posandoci una passata, e i due lati si accavallano. Vuoto = automatico (una fila di celle, cioè 0,6 × la densità: il difetto cresce con la densità, quindi un numero fisso non andrebbe bene a tutte). 0 = confine netto, come prima.' })}
          ${campoNumero({ id: 'maxStitches', etichetta: 'Tetto ai punti (buchi d’ago per mm²)', unita: 'pt/mm²', valore: '', passo: 1, min: 0, attributi: 'placeholder="auto"', aiuto: 'quanti punti al massimo può prendere lo stesso millimetro quadro, contando tutti i colori insieme: è lì che il filo si spezza e l’ago soffre. Vuoto = automatico. 0 = nessun tetto.' })}
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Variante</span>
            <div class="rg-cluster">
              ${conId(campoNumeroInline({ aria: 'Variante', unita: '#', valore: 1, passo: 1, min: 1 }), 'seed')}
              <button type="button" id="newSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova variante</button>
            </div>
            <small class="rg-field__help">stessa variante = stesso identico pattern; cambiala per una disposizione diversa (riproducibile, non casuale)</small>
          </div>
        </div>
        <div id="params" class="rg-param-grid"></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <label class="rg-choice">
              <input type="checkbox" id="veinsOn" />
              <span>Venature sopra</span>
            </label>
            <small class="rg-field__help">venature di filo cucite per ultime, sopra al ricamo, come le pieghe chiare della pelle: fasci di venature spesse (andata e ritorno) e venature fini (solo andata), tutte in un giro senza salti. Spento, il ricamo è quello di sempre.</small>
          </div>
          <div class="rg-field rg-param-grid__wide" id="veinsFields" hidden>
            <span class="rg-field__label">Colore delle venature</span>
            <div class="rg-cluster">
              <label class="rg-color-map__swatch" id="veinsSwatch">
                <input type="color" id="veinsColor" class="rg-u-visually-hidden" aria-label="Colore delle venature" />
              </label>
              <span class="rg-color-map__code" id="veinsCode">#C4845C</span>
            </div>
          </div>
          ${campoNumero({ id: 'veinsBundles', etichetta: 'Fasci di venature spesse', unita: '#', valore: 5, passo: 1, min: 0, largo: false, aiuto: 'per riquadro di 120×80 mm (la misura della A): un pezzo più grande si divide in riquadri, ognuno con i suoi fasci, girati un po\'.' })}
          ${campoNumero({ id: 'veinsThin', etichetta: 'Venature fini', unita: '#', valore: 52, passo: 1, min: 0, largo: false, aiuto: 'per riquadro, come i fasci.' })}
          ${campoNumero({ id: 'veinsAngle', etichetta: 'Direzione delle venature', unita: '°', valore: 82, passo: 5, largo: false, aiuto: '90 = scendono dritte, 0 = in orizzontale.' })}
          <div class="rg-field" id="veinsSeedField" hidden>
            <span class="rg-field__label">Variante delle venature</span>
            <div class="rg-cluster">
              ${conId(campoNumeroInline({ aria: 'Variante delle venature', unita: '#', valore: 8, passo: 1, min: 1 }), 'veinsSeed')}
              <button type="button" id="veinsNewSeedBtn" class="rg-button rg-button--outline rg-button--small">Nuova</button>
            </div>
          </div>
        </div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <label class="rg-choice">
              <input type="checkbox" id="densityTotal" />
              <span>La densità è di tutti i fili insieme</span>
            </label>
            <small class="rg-field__help">spento, ogni filo ha la sua densità e aggiungere un colore infittisce. Acceso, la densità (anche quella di ogni colore) vale per tutti i fili insieme: con 3 colori ognuno cuce a 3 volte la distanza.</small>
          </div>
          ${campoNumero({ id: 'flowStrength', etichetta: 'Vortici del fondo', unita: '%', valore: 100, passo: 10, min: 0, max: 100, largo: false, aiuto: 'quanto il filo gira in nuvole e vortici. 100 = come sempre; 0 = nessun vortice, il fondo resta uniforme.' })}
        </div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <label class="rg-choice">
              <input type="checkbox" id="voidDensityBoost" />
              <span>Più fitto intorno alle aree vuote</span>
            </label>
            <small class="rg-field__help">spento, la densità è uguale ovunque. Acceso, il filo si addensa attorno a ogni area vuota del cartamodello e torna alla densità normale allontanandosi, e ogni colore contorna ogni foro con un anello a ridosso del bordo. Il bordo esterno non conta.</small>
          </div>
          ${campoNumero({ id: 'voidDensityFactor', etichetta: 'Quanto più fitto vicino al vuoto', unita: '×', valore: 2, passo: 0.1, min: 1, max: 5, largo: false, aiuto: 'volte la densità normale, proprio a ridosso del vuoto (2 = il doppio del filo; massimo 5).' })}
          ${campoNumero({ id: 'voidDensityFade', etichetta: 'In quanti mm torna normale', unita: 'mm', valore: 8, passo: 1, min: 0, largo: false, aiuto: 'la sfumatura da molto fitto a normale: oltre questa distanza dal vuoto la densità è quella di sempre.' })}
          <div class="rg-field rg-param-grid__wide" id="voidsFirstField" hidden>
            <label class="rg-choice">
              <input type="checkbox" id="voidsFirst" />
              <span>Prima i fori, poi il resto</span>
            </label>
            <small class="rg-field__help">il filo entra dal bordo esterno, va prima di foro in foro a fare anello e agglomerato, così il materiale è fermato lì, e solo dopo cuce tutto il resto. Spento, i fori si contornano quando il filo ci passa accanto.</small>
          </div>
        </div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      ${barraAnteprima({ inviaStilista: true })}
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      ${barraStato()}
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  // I campi che si vedono solo con la loro opzione: il contenitore del campo (fatto da `campoNumero`) prende
  // l'id di sempre (`…Field`), con cui lo accendono i `sync…`, e parte nascosto.
  for (const id of ['toneSoftness', 'clusterStrength', 'zoneOverlap', 'veinsBundles', 'veinsThin', 'veinsAngle', 'voidDensityFactor', 'voidDensityFade']) {
    const f = $(id).closest('.rg-field') as HTMLElement;
    f.id = `${id}Field`;
    f.hidden = true;
  }

  // I campi dove VUOTO vuol dire «automatico» (o «eredita», «nessun limite»): `attivaCampiNumero`, uscendo da un
  // campo vuoto, lo rimetterebbe all'ultimo numero e il tool non vedrebbe il cambio. Qui il vuoto passa prima:
  // questo ascoltatore è registrato PRIMA (stessa fase di cattura, stesso nodo), quindi gira prima, e chiama
  // l'handler del campo, che legge NaN (`leggiCampo('')`) e lo tratta come vuoto, come prima.
  const suVuoto = new WeakMap<HTMLInputElement, () => void>();
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.value.trim() !== '') return;
    const fai = suVuoto.get(el);
    if (!fai) return;
    e.stopImmediatePropagation();
    el.value = '';
    el.dataset.ultimo = '';
    fai();
  }, true);
  attivaCampiNumero(root);
  /** Collega un campo dove il vuoto ha un senso: l'handler gira anche quando lo si svuota. */
  function campoVuotoAuto(el: HTMLInputElement, fai: () => void) {
    suVuoto.set(el, fai);
    el.addEventListener('change', fai);
  }

  let imported: ImportResult = importResultFromContours(sampleContours());
  let roles: RoleAssignment = {};
  const params: InterlaceParams = { ...defaultInterlaceParams };
  // Immagine di riferimento per gli agglomerati (opzionale): pixel RGBA campionati da un canvas.
  let refImage: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  /** L'immagine ridotta come data-URL: è la SOLA forma in cui può viaggiare nel file esportato, e senza
   *  di lei riaprire un progetto ad agglomerati-da-immagine dava un disegno DIVERSO, in silenzio. */
  let refImageUrl: string | null = null;
  /** Misure della tavola generata (0 = c'è un cartamodello importato, che non sta nel DST). Senza queste
   *  il .dst rimetteva i parametri ma lasciava la sagoma demo: sembrava che non funzionasse. */
  let generated: { w: number; h: number } | null = null;

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const contourColors = () => imported.contours.map((c) => c.color);
  const uniqueColors = () => [...new Set(contourColors())];

  /** Campionatore colore immagine per gli agglomerati (mm → RGB), o undefined se non c'è immagine/agglomerati. */
  function imageSampler() {
    return campionatoreImmagine(refImage ? { pixel: refImage.data, larghezza: refImage.w, altezza: refImage.h } : undefined, currentContours(), params.clusterMode);
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
    host.innerHTML = PARAMS.map((f) => campoNumero({
      id: f.key, etichetta: f.label, unita: f.unit, valore: params[f.key] as number, passo: f.step, aiuto: f.help,
    })).join('');
    for (const f of PARAMS) {
      const inp = $(f.key) as HTMLInputElement;
      inp.addEventListener('change', () => {
        const v = leggiCampo(inp);
        if (!Number.isNaN(v)) {
          (params[f.key] as number) = v;
          // la densità globale è il placeholder "eredita" di ogni riga colore → riallinealo
          if (f.key === 'densitySpacingMm') buildPaletteUI();
          render();
        }
      });
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
        params.colorTolerances.splice(i, 1);
        // La matrice dei divieti è quadrata sulla palette: via la riga del colore E la sua colonna-zona.
        if (Array.isArray(params.zoneBans)) {
          params.zoneBans.splice(i, 1);
          for (const row of params.zoneBans) if (Array.isArray(row)) row.splice(i, 1);
        }
        buildPaletteUI();
        render();
      });

      // Densità PER-COLORE (spaziatura file, mm): vuoto = usa la densità globale. Il campo compatto della suite
      // (`campoNumeroInline`), stretto via il token DS `--rg-input-numeric-width`. Vedi proposta DS `ds/color-map-aside` (§7).
      const dpre = document.createElement('span');
      dpre.className = 'interlace-tol__pre';
      dpre.textContent = 'densità';
      const dv = params.colorDensities[i];
      const dwrap = elementoDa(campoNumeroInline({
        aria: `Densità per ${col.toUpperCase()} in mm (vuoto: usa la densità globale ${params.densitySpacingMm} mm)`,
        unita: 'mm', valore: dv && dv > 0 ? dv : '', passo: 0.1, min: DENSITY_MIN_MM, max: DENSITY_MAX_MM, larghezza: '4ch',
      }));
      const dens = dwrap.querySelector('input')!;
      dens.placeholder = scriviNumero(params.densitySpacingMm);
      campoVuotoAuto(dens, () => {
        const v = leggiCampo(dens);
        if (Number.isNaN(v)) { params.colorDensities[i] = 0; impostaNumero(dens, NaN); }
        else { const c = Math.max(DENSITY_MIN_MM, Math.min(DENSITY_MAX_MM, v)); params.colorDensities[i] = c; impostaNumero(dens, c); }
        render();
      });

      // RAGGIO DI CATTURA (distanza RGB), come la tolleranza del contagocce di bitmap: vuoto = nessun
      // limite (vince il più vicino). Con due colori simili per una sfumatura, stringerlo su entrambi
      // lascia neutro il passaggio fra i due invece di spaccarlo a metà.
      if (!params.colorTolerances) params.colorTolerances = [];
      const tolGroup = document.createElement('span');
      tolGroup.className = 'interlace-tol';
      const tolPre = document.createElement('span');
      tolPre.className = 'interlace-tol__pre';
      tolPre.textContent = 'cattura ±';
      const tv = params.colorTolerances[i];
      const tolWrap = elementoDa(campoNumeroInline({
        aria: `Raggio di cattura di ${col.toUpperCase()} (distanza RGB; vuoto = nessun limite)`,
        titolo: 'Raggio di cattura: quanto lontano da questo colore l’immagine è ancora “sua”. Vuoto = nessun limite.',
        unita: '', valore: tv && tv > 0 ? tv : '', passo: 5, min: 0,
      }));
      const tol = tolWrap.querySelector('input')!;
      tol.classList.add('interlace-tol__input');
      tol.placeholder = '∞';
      campoVuotoAuto(tol, () => {
        const v = leggiCampo(tol);
        if (Number.isNaN(v) || v <= 0) { params.colorTolerances[i] = 0; impostaNumero(tol, NaN); }
        else { params.colorTolerances[i] = Math.max(0, v); impostaNumero(tol, params.colorTolerances[i]); }
        render();
      });
      tolGroup.append(tolPre, tolWrap);

      // Contagocce: prende il colore dall'immagine di riferimento con la lente sul pixel (come bitmap).
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rg-icon-button';
      pick.innerHTML = EYEDROPPER_SVG;
      pick.disabled = !refImage;
      pick.title = refImage ? 'Campiona dall’immagine di riferimento' : 'Carica un’immagine di riferimento per campionare';
      pick.setAttribute('aria-label', `Campiona il colore ${i + 1} dall’immagine`);
      pick.addEventListener('click', () => enterPickMode((hex) => { params.colors[i] = hex; }));

      picker.addEventListener('input', () => {
        params.colors[i] = picker.value;
        sw.style.setProperty('--swatch', picker.value);
        code.textContent = picker.value.toUpperCase();
        rm.setAttribute('aria-label', `Rimuovi colore ${i + 1} (${picker.value.toUpperCase()})`);
        buildZoneBanUI(); // le pastiglie della matrice sono questi stessi colori: vanno riallineate
        render();
      });

      sw.appendChild(picker);
      cluster.append(code, pick, rm);
      const knobs = document.createElement('span');
      knobs.className = 'rg-cluster rg-color-map__target';
      knobs.append(tolGroup, dpre, dwrap);
      li.append(sw, cluster, knobs);
      host.appendChild(li);
    });
    ($('addColorBtn') as HTMLButtonElement).disabled = params.colors.length >= MAX_COLORS;
    buildZoneBanUI(); // righe e colonne della matrice sono gli stessi colori: si rifà con la palette
  }

  /** Allinea la matrice dei divieti alla palette (righe = fili, colonne = zone, entrambe i colori),
   *  riempiendo di `false` ciò che manca: aggiungere o togliere un colore non la lascia storta, e un
   *  progetto riaperto con una matrice di misura diversa si rimette a posto invece di rompere. */
  function normalizeBans() {
    const n = params.colors.length;
    if (!Array.isArray(params.zoneBans)) params.zoneBans = [];
    params.zoneBans.length = n;
    for (let i = 0; i < n; i++) {
      const row = Array.isArray(params.zoneBans[i]) ? params.zoneBans[i] : [];
      row.length = n;
      for (let j = 0; j < n; j++) row[j] = row[j] === true;
      params.zoneBans[i] = row;
    }
  }

  /** Matrice "dove passa ogni filo": casella ACCESA = quel filo entra in quella zona (stato di partenza,
   *  = comportamento storico); spenta = vietato. Solo classi DS esistenti: `rg-table` compatta, `rg-choice`
   *  per le caselle, lo swatch di `rg-color-map` per i colori. Nessuna classe nuova. */
  function buildZoneBanUI() {
    const host = $('zoneBanTable');
    normalizeBans();
    host.innerHTML = '';
    const cols = params.colors;
    if (cols.length < 2) {
      const msg = document.createElement('p');
      msg.className = 'rg-field__help';
      msg.textContent = 'Servono almeno due colori del filo perché ci siano zone da vietare.';
      host.appendChild(msg);
      return;
    }
    const swatch = (col: string) => {
      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', col);
      return sw;
    };
    const table = document.createElement('table');
    table.className = 'rg-table rg-table--compact';
    const cap = document.createElement('caption');
    cap.textContent = 'Spunta = ci passa · togli la spunta = vietato';
    table.appendChild(cap);

    const thead = document.createElement('thead');
    const hrow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.textContent = 'filo ↓ / zona →';
    hrow.appendChild(corner);
    for (const zc of cols) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.title = `Zona ${zc.toUpperCase()}`;
      // Lo swatch del DS è uno <span>: dentro una <th> resterebbe inline e si schiaccerebbe a zero.
      // Nella riga sta dentro un rg-cluster (flex) e si vede: qui si fa lo stesso, senza classi nuove.
      const cell = document.createElement('span');
      cell.className = 'rg-cluster';
      cell.appendChild(swatch(zc));
      th.appendChild(cell);
      hrow.appendChild(th);
    }
    thead.appendChild(hrow);

    const tbody = document.createElement('tbody');
    cols.forEach((tc, i) => {
      const tr = document.createElement('tr');
      const head = document.createElement('td');
      const cl = document.createElement('span');
      cl.className = 'rg-cluster';
      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = tc.toUpperCase();
      cl.append(swatch(tc), code);
      head.appendChild(cl);
      tr.appendChild(head);
      cols.forEach((zc, j) => {
        const td = document.createElement('td');
        const lab = document.createElement('label');
        lab.className = 'rg-choice';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !params.zoneBans[i][j];
        cb.setAttribute('aria-label', `Il filo ${tc.toUpperCase()} passa nelle zone ${zc.toUpperCase()}`);
        lab.title = i === j
          ? `Filo ${tc.toUpperCase()} nella SUA zona — spunta = ci passa`
          : `Filo ${tc.toUpperCase()} nella zona ${zc.toUpperCase()} — spunta = ci passa`;
        cb.addEventListener('change', () => { params.zoneBans[i][j] = !cb.checked; render(); });
        lab.appendChild(cb);
        td.appendChild(lab);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    host.appendChild(table);
  }

  /**
   * CONTAGOCCE con LENTE (lo stesso gesto di bitmap): mette l'immagine di riferimento sopra l'anteprima,
   * ingrandisce il pixel sotto il puntatore mostrandone il codice, e col clic lo assegna al colore
   * `index`. Serve per prendere due tinte SIMILI con precisione — a occhio, sulla miniatura del pannello,
   * non si distinguono. Resta locale all'app: al terzo tool che lo chiede si promuove in @rg/ui (regola 1).
   */
  function enterPickMode(apply: (hex: string) => void) {
    if (!refImage) return;
    const W = refImage.w, H = refImage.h, SAMPLE = 15, HALF = 7, LENS = 132;
    const img = document.createElement('canvas');
    img.width = W; img.height = H;
    img.className = 'interlace-pick__img';
    img.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(refImage.data), W, H), 0, 0);

    const overlay = document.createElement('div');
    overlay.className = 'interlace-pick';
    const hint = document.createElement('div');
    hint.className = 'interlace-pick__hint';
    hint.textContent = 'Muovi sul pixel, clicca per campionare il colore · Esc per annullare';
    const lens = document.createElement('canvas');
    lens.className = 'interlace-pick__lens';
    lens.width = LENS; lens.height = LENS;
    const lctx = lens.getContext('2d')!;
    lctx.imageSmoothingEnabled = false;
    const tag = document.createElement('div');
    tag.className = 'interlace-pick__tag';
    overlay.append(img, hint, lens, tag);
    $('canvas').appendChild(overlay);

    const colorAt = (sx: number, sy: number): string => {
      const o = (sy * W + sx) * 4;
      const h = (v: number) => v.toString(16).padStart(2, '0');
      return `#${h(refImage!.data[o])}${h(refImage!.data[o + 1])}${h(refImage!.data[o + 2])}`.toUpperCase();
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
    img.addEventListener('mousemove', onMove);
    img.addEventListener('click', (e) => {
      const { sx, sy } = pixelOf(e);
      apply(colorAt(sx, sy));
      exit(); buildPaletteUI(); render();
    });
    // Il canvas ha pan/zoom (pointerdown → setPointerCapture): senza fermarlo il clic non arriva
    // all'immagine e il colore non si campiona. Stesso accorgimento di bitmap.
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    overlay.addEventListener('pointerup', (e) => e.stopPropagation());
    overlay.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    document.addEventListener('keydown', onKey);
  }

  function render() {
    try {
      const { layers, bounds, threadMm, runCount, budget } = runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
      $('layer').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
      // Il tetto ai punti non deve poter affamare la copertura IN SILENZIO: con queste impostazioni
      // servono almeno `needed` punti/mm² perché la copertura chiesta esista. Sotto quel numero le celle
      // si saturano prima di essere coperte e restano zone scoperte — è un difetto che si scopre sul
      // ricamo, quindi va detto qui, coi numeri.
      const cap = params.maxStitchesPerMm2;
      const avviso = cap == null || cap === 0 ? ''
        : cap < budget.needed ? ` · attenzione: tetto ${cap} sotto il minimo ${budget.needed} — restano zone scoperte`
        : cap < budget.auto ? ` · tetto ${cap} sotto l’automatico ${budget.auto} — qualche zona può restare scoperta`
        : '';
      $('maxStitches-aiuto').textContent =
        `quanti punti al massimo può prendere lo stesso millimetro quadro, contando tutti i colori insieme: è lì che il filo si spezza e l’ago soffre. `
        + `Con queste impostazioni servono almeno ${budget.needed} pt/mm² perché la copertura esista, e l’automatico è ${budget.auto}. `
        + `Sotto il minimo restano zone scoperte. Vuoto = automatico. 0 = nessun tetto.`;
      $('status').textContent = threadMm > 0
        ? `Filo generato: ${(threadMm / 1000).toFixed(2)} m · ${runCount} ${runCount === 1 ? 'tratto' : 'tratti'}${avviso}`
        : 'Assegna un colore all’area da ricamare';
    } catch (e) {
      $('status').textContent = 'Errore render: ' + (e as Error).message;
      console.error(e);
    }
  }

  let sourceName = '';
  let sourceIsDxf = false;
  /** Il cartamodello da cui parte il ricamo (K2); niente per il demo e per l'oggetto pieno generato. */
  function sorgenteProgetto() {
    if (!sourceName || generated) return undefined;
    const eff = measureContours(currentContours());
    return { tipo: sourceIsDxf ? 'dxf' as const : 'svg' as const, nome: sourceName, larghezzaMm: eff.widthMm, altezzaMm: eff.heightMm };
  }

  function updateFileStatus(label: string) {
    const eff = measureContours(currentContours());
    const detected = `${Math.round(imported.widthMm)}×${Math.round(imported.heightMm)} mm (${imported.method})`;
    const effStr = params.realWidthMm > 0 ? ` → reale ${Math.round(eff.widthMm)}×${Math.round(eff.heightMm)} mm` : '';
    const hint = imported.method === 'dpi' && !params.realWidthMm ? ' · imposta la larghezza reale' : '';
    $('fileStatus').textContent = `${label}: ${detected}${effStr} · ${imported.contours.length} contorni${hint}`;
  }

  function loadImport(result: ImportResult, label: string) {
    svgStilista = null; // ogni caricamento: solo il caricamento da Stilista la rimette, subito dopo
    imported = result;
    autoAssign();
    buildRoleUI();
    render();
    updateFileStatus(label);
  }

  /** Tutto quello che serve a RIAPRIRE il progetto: parametri, ruoli, la tavola generata e l'immagine di
   *  riferimento. Viaggia nel footer del DST (che la macchina legge fino all'END e ignora) e nel
   *  `<metadata>` dell'SVG. Il cartamodello importato NO: quello si ricarica a parte, è un file suo. */
  function projectMetadata() {
    return {
      rgProject: 'interlace', version: '0.1.0', params, roles,
      object: generated ? { widthMm: generated.w, heightMm: generated.h } : undefined,
      refImage: refImageUrl ?? undefined,
    };
  }

  /**
   * Rimette l'immagine di riferimento salvata nel file. Va DECODIFICATA, quindi è asincrona e ridisegna
   * da sola quando è pronta. Senza di lei riaprire un progetto ad agglomerati-da-immagine tornava al
   * rumore: stessi parametri, disegno diverso, e nessuno lo diceva.
   */
  function restoreRefImage(dataUrl: string, done: () => void) {
    const img = new Image();
    img.onload = () => {
      const cnv = document.createElement('canvas');
      cnv.width = img.width; cnv.height = img.height;
      const cx = cnv.getContext('2d');
      if (!cx) { done(); return; }
      cx.drawImage(img, 0, 0);
      refImage = { data: cx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
      refImageUrl = dataUrl;
      ($('captureColorsBtn') as HTMLButtonElement).disabled = false;
      ($('clearImageBtn') as HTMLButtonElement).disabled = false;
      $('clusterImageStatus').textContent = `Immagine ripristinata dal progetto (${img.width}×${img.height})`;
      drawPicker();
      done();
    };
    img.onerror = () => done();
    img.src = dataUrl;
  }

  /** Ripristina un progetto esportato da qui (R27). Con `rebuild` rimette anche la TAVOLA e l'IMMAGINE e
   *  ridisegna: serve al `.dst`, che non porta contorni e quindi da solo non farebbe succedere nulla. */
  function applyImportedProject(meta: Record<string, unknown>, rebuild = false): boolean {
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
    impostaNumero($('realWidth') as HTMLInputElement, params.realWidthMm);
    impostaNumero($('paletteCycles') as HTMLInputElement, params.paletteCycles);
    impostaNumero($('seed') as HTMLInputElement, params.seed);
    impostaNumero($('clusterStrength') as HTMLInputElement, params.clusterStrength);
    syncOverlap();
    syncCap();
    syncBackground();
    syncTone();
    syncVoidDensity();
    syncTotalFlow();
    syncVeins();
    syncCluster(); // switch agglomerati + visibilità intensità
    buildParamUI();
    buildPaletteUI();
    if (!rebuild) return true; // dall'SVG il disegno arriva coi contorni: ci pensa loadImport

    const obj = meta.object as { widthMm?: number; heightMm?: number } | undefined;
    const img = typeof meta.refImage === 'string' ? meta.refImage : null;
    if (img) restoreRefImage(img, render);
    // La tavola generata sono due misure e stanno nel file; i ruoli restaurati non si toccano.
    if (obj && obj.widthMm && obj.heightMm) generateObject(obj.widthMm, obj.heightMm, { keepRoles: true });
    else if (!img) render(); // senza tavola e senza immagine, almeno ridisegna: prima non lo faceva
    return true;
  }

  // --- 01: il CARTAMODELLO. Solo la sagoma; per riaprire un lavoro c'è «Apri progetto o DST…» qui sotto. ---
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
        sourceIsDxf = isDxf;
        generated = null; // da qui in poi la sagoma è quella del file, non una tavola generata
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

  /** Legge il progetto da un file esportato da qui (`.dst` dal footer, `.svg` dal metadata) e lo rimette
   *  per intero — parametri, colori, tavola, immagine — ridisegnando. Ritorna il messaggio da mostrare. */
  function restoreProjectFromFile(file: File, done: (msg: string) => void) {
    const isDst = /\.dst$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const meta = isDst
          ? readDstMetadata(new Uint8Array(reader.result as ArrayBuffer))
          : readProjectMetadata(String(reader.result));
        if (!meta || !applyImportedProject(meta, true)) {
          done(`${file.name}: non è un progetto di questo tool`);
          return;
        }
        const obj = meta.object as { widthMm?: number; heightMm?: number } | undefined;
        const pezzi = ['parametri e colori'];
        if (obj && obj.widthMm) pezzi.push(`tavola ${obj.widthMm}×${obj.heightMm} mm`);
        if (typeof meta.refImage === 'string') pezzi.push('immagine di riferimento');
        // Senza `object` il disegno è (o era) un cartamodello importato: quello va ricaricato in alto.
        const coda = obj && obj.widthMm ? '' : ' · il cartamodello ricaricalo in alto (è un file suo)';
        done(`${file.name}: ripristinati ${pezzi.join(', ')}${coda}`);
      } catch (e) {
        done('Errore: ' + (e as Error).message);
        console.error(e);
      }
    };
    if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  // «Apri progetto o DST…» della sezione 01: riapre un lavoro esportato da qui (prima era «Carica parametri» in fondo).
  $('progettoInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    restoreProjectFromFile(file, (msg) => { $('progettoStatus').textContent = msg; });
  });

  $('realWidth').addEventListener('change', () => {
    const v = leggiCampo($('realWidth') as HTMLInputElement);
    params.realWidthMm = Number.isNaN(v) ? 0 : Math.max(0, v);
    render();
    updateFileStatus(sourceName || 'Cartamodello');
  });

  $('addColorBtn').addEventListener('click', () => {
    if (params.colors.length >= MAX_COLORS) return;
    params.colors.push(NEW_COLORS[(params.colors.length - 1) % NEW_COLORS.length]);
    params.colorDensities.push(0); // 0 = eredita la densità globale finché non lo si imposta
    params.colorTolerances.push(0); // 0 = nessun raggio di cattura finché non lo si stringe
    buildPaletteUI();
    render();
  });
  impostaNumero($('paletteCycles') as HTMLInputElement, params.paletteCycles);
  $('paletteCycles').addEventListener('change', () => {
    const v = Math.trunc(leggiCampo($('paletteCycles') as HTMLInputElement));
    params.paletteCycles = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });

  // SFONDO senza ricamo: interruttore + colore (anche col contagocce) + tolleranza. Ha senso solo con
  // gli agglomerati e un'immagine da leggere: senza immagine non c'è nessuno sfondo da riconoscere.
  const bgCheck = $('excludeBackground') as HTMLInputElement;
  const bgColor = $('bgColor') as HTMLInputElement;
  const bgTol = $('bgTolerance') as HTMLInputElement;
  ($('bgPickBtn') as HTMLButtonElement).innerHTML = EYEDROPPER_SVG;
  function syncBackground() {
    const attivo = params.excludeBackground;
    bgCheck.checked = attivo;
    ($('bgField') as HTMLElement).hidden = !attivo;
    ($('bgHelp') as HTMLElement).hidden = !attivo;
    const hex = asHex6(params.backgroundColor || '#ffffff');
    bgColor.value = hex;
    $('bgSwatch').style.setProperty('--swatch', hex);
    $('bgCode').textContent = hex.toUpperCase();
    impostaNumero(bgTol, params.backgroundToleranceRgb);
    ($('bgPickBtn') as HTMLButtonElement).disabled = !refImage;
    ($('bgPickBtn') as HTMLButtonElement).title = refImage ? 'Prendi il colore dello sfondo dall’immagine' : 'Serve un’immagine di riferimento';
  }
  const veinsCheck = $('veinsOn') as HTMLInputElement;
  const veinsNum: Array<[string, 'veinsBundles' | 'veinsThin' | 'veinsAngleDeg' | 'veinsSeed', number]> = [
    ['veinsBundles', 'veinsBundles', 5], ['veinsThin', 'veinsThin', 52], ['veinsAngle', 'veinsAngleDeg', 82], ['veinsSeed', 'veinsSeed', 8],
  ];
  function syncVeins() {
    veinsCheck.checked = params.veinsOn;
    for (const id of ['veinsFields', 'veinsBundlesField', 'veinsThinField', 'veinsAngleField', 'veinsSeedField']) ($(id) as HTMLElement).hidden = !params.veinsOn;
    ($('veinsColor') as HTMLInputElement).value = params.veinsColor;
    ($('veinsSwatch') as HTMLElement).style.setProperty('--rg-swatch-color', params.veinsColor);
    ($('veinsSwatch') as HTMLElement).style.background = params.veinsColor;
    $('veinsCode').textContent = params.veinsColor.toUpperCase();
    for (const [id, key] of veinsNum) impostaNumero($(id) as HTMLInputElement, params[key]);
  }
  syncVeins();
  veinsCheck.addEventListener('change', () => { params.veinsOn = veinsCheck.checked; syncVeins(); render(); });
  $('veinsColor').addEventListener('input', () => { params.veinsColor = ($('veinsColor') as HTMLInputElement).value; syncVeins(); render(); });
  for (const [id, key, def] of veinsNum) {
    $(id).addEventListener('change', () => {
      const v = leggiCampo($(id) as HTMLInputElement);
      params[key] = Number.isNaN(v) ? def : key === 'veinsAngleDeg' ? v : Math.max(key === 'veinsSeed' ? 1 : 0, Math.round(v));
      syncVeins();
      if (params.veinsOn) render();
    });
  }
  $('veinsNewSeedBtn').addEventListener('click', () => { params.veinsSeed = Math.floor(Math.random() * 9999) + 1; syncVeins(); if (params.veinsOn) render(); });
  const totalCheck = $('densityTotal') as HTMLInputElement;
  const flowInput = $('flowStrength') as HTMLInputElement;
  function syncTotalFlow() {
    totalCheck.checked = !!params.densityTotal;
    impostaNumero(flowInput, params.flowStrength ?? 100);
  }
  syncTotalFlow();
  totalCheck.addEventListener('change', () => { params.densityTotal = totalCheck.checked; render(); });
  flowInput.addEventListener('change', () => {
    const v = leggiCampo(flowInput);
    params.flowStrength = Number.isNaN(v) ? 100 : Math.max(0, Math.min(100, v));
    syncTotalFlow();
    render();
  });
  const voidCheck = $('voidDensityBoost') as HTMLInputElement;
  const voidFactor = $('voidDensityFactor') as HTMLInputElement;
  const voidFade = $('voidDensityFade') as HTMLInputElement;
  const voidsFirst = $('voidsFirst') as HTMLInputElement;
  function syncVoidDensity() {
    voidCheck.checked = params.voidDensityBoost;
    impostaNumero(voidFactor, params.voidDensityFactor);
    impostaNumero(voidFade, params.voidDensityFadeMm);
    ($('voidDensityFactorField') as HTMLElement).hidden = !params.voidDensityBoost;
    ($('voidDensityFadeField') as HTMLElement).hidden = !params.voidDensityBoost;
    voidsFirst.checked = !!params.voidsFirst;
    ($('voidsFirstField') as HTMLElement).hidden = !params.voidDensityBoost;
  }
  syncVoidDensity();
  voidCheck.addEventListener('change', () => { params.voidDensityBoost = voidCheck.checked; syncVoidDensity(); render(); });
  voidsFirst.addEventListener('change', () => { params.voidsFirst = voidsFirst.checked; if (params.voidDensityBoost) render(); });
  voidFactor.addEventListener('change', () => {
    const v = leggiCampo(voidFactor);
    params.voidDensityFactor = Number.isNaN(v) ? 2 : Math.max(1, Math.min(5, v));
    syncVoidDensity();
    if (params.voidDensityBoost) render();
  });
  voidFade.addEventListener('change', () => {
    const v = leggiCampo(voidFade);
    params.voidDensityFadeMm = Number.isNaN(v) ? 8 : Math.max(0, v);
    syncVoidDensity();
    if (params.voidDensityBoost) render();
  });
  const toneCheck = $('toneBlend') as HTMLInputElement;
  const toneSoft = $('toneSoftness') as HTMLInputElement;
  function syncTone() {
    toneCheck.checked = params.toneBlend;
    impostaNumero(toneSoft, params.toneSoftnessMm);
    ($('toneSoftnessField') as HTMLElement).hidden = !params.toneBlend;
  }
  syncTone();
  toneCheck.addEventListener('change', () => { params.toneBlend = toneCheck.checked; syncTone(); render(); });
  toneSoft.addEventListener('change', () => {
    const v = leggiCampo(toneSoft);
    params.toneSoftnessMm = Number.isNaN(v) ? 4 : Math.max(0, v);
    syncTone();
    if (params.toneBlend) render();
  });
  bgCheck.addEventListener('change', () => { params.excludeBackground = bgCheck.checked; syncBackground(); render(); });
  bgColor.addEventListener('input', () => { params.backgroundColor = bgColor.value; syncBackground(); render(); });
  bgTol.addEventListener('change', () => {
    const v = leggiCampo(bgTol);
    params.backgroundToleranceRgb = Number.isNaN(v) ? 30 : Math.max(0, v);
    syncBackground();
    if (params.excludeBackground) render();
  });
  $('bgPickBtn').addEventListener('click', () => enterPickMode((hex) => { params.backgroundColor = hex; syncBackground(); }));

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
    syncBackground();
    ($('zoneBanField') as HTMLElement).hidden = !params.clusterMode; // senza zone non c'è nulla da vietare
    ($('zoneOverlapField') as HTMLElement).hidden = !params.clusterMode; // il sormonto è fra zone
  };
  clusterBtns.forEach((b) => b.addEventListener('click', () => {
    const want = b.dataset.cluster === 'on';
    if (params.clusterMode === want) return;
    params.clusterMode = want;
    syncCluster();
    render();
  }));
  syncCluster();

  impostaNumero($('clusterStrength') as HTMLInputElement, params.clusterStrength);
  $('clusterStrength').addEventListener('change', () => {
    const v = leggiCampo($('clusterStrength') as HTMLInputElement);
    params.clusterStrength = Number.isNaN(v) ? 60 : Math.max(0, Math.min(100, v));
    if (params.clusterMode) render();
  });

  const capInput = $('maxStitches') as HTMLInputElement;
  const syncCap = () => { impostaNumero(capInput, params.maxStitchesPerMm2 ?? NaN); }; // NaN = vuoto = automatico
  syncCap();
  campoVuotoAuto(capInput, () => {
    const v = leggiCampo(capInput);
    params.maxStitchesPerMm2 = Number.isNaN(v) ? null : Math.max(0, Math.round(v));
    syncCap();
    render();
  });

  const overlapInput = $('zoneOverlap') as HTMLInputElement;
  const syncOverlap = () => { impostaNumero(overlapInput, params.zoneOverlapMm ?? NaN); }; // NaN = vuoto = automatico
  syncOverlap();
  campoVuotoAuto(overlapInput, () => {
    const v = leggiCampo(overlapInput);
    params.zoneOverlapMm = Number.isNaN(v) ? null : Math.max(0, v);
    syncOverlap();
    render();
  });

  $('zoneBanResetBtn').addEventListener('click', () => {
    params.zoneBans = [];
    buildZoneBanUI();
    render();
  });

  // Variante = seed: pattern DIVERSO ma RIPRODUCIBILE (stesso seed → stesso identico risultato).
  impostaNumero($('seed') as HTMLInputElement, params.seed);
  $('seed').addEventListener('change', () => {
    const v = Math.trunc(leggiCampo($('seed') as HTMLInputElement));
    params.seed = Number.isNaN(v) ? 1 : Math.max(1, v);
    render();
  });
  $('newSeedBtn').addEventListener('click', () => {
    params.seed = (params.seed % 999999) + 1; // avanza a una variante nuova, deterministica
    impostaNumero($('seed') as HTMLInputElement, params.seed);
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
      refImageUrl = cnv.toDataURL('image/png'); // già ridotta a ≤256px: è quella che viaggia nel file
      $('clusterImageStatus').textContent = `Immagine ${img.width}×${img.height} — gli agglomerati la rispettano`;
      ($('captureColorsBtn') as HTMLButtonElement).disabled = false;
      ($('clearImageBtn') as HTMLButtonElement).disabled = false;
      syncBackground();
      URL.revokeObjectURL(url);
      drawPicker(); // aggiorna l'anteprima per l'eyedropper (modalità Manuale)
      // Proporziona la TAVOLA all'immagine (larghezza invariata, altezza = larghezza × aspect) così
      // l'immagine mappa 1:1 senza deformarsi. Solo su tavola generata: un cartamodello importato si rispetta.
      const aspect = img.height / img.width;
      if (!imported.frame && aspect > 0 && Number.isFinite(aspect)) {
        const bw = Math.max(1, leggiCampo($('objW') as HTMLInputElement) || 100);
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
    const n = Math.max(1, Math.min(12, Math.trunc(leggiCampo($('colorCount') as HTMLInputElement)) || 4));
    const cols = extractPalette(refImage.data, n);
    if (!cols.length) { $('clusterImageStatus').textContent = 'Nessun colore catturato (immagine tutta sfondo?)'; return; }
    params.colors = cols;
    params.colorDensities = cols.map(() => 0);
    params.colorTolerances = cols.map(() => 0);
    params.zoneBans = []; // palette nuova = zone nuove: i divieti vecchi non vorrebbero dire niente
    buildPaletteUI();
    render();
  });
  $('clearImageBtn').addEventListener('click', () => {
    refImage = null;
    refImageUrl = null;
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
    params.colorTolerances.push(0);
    buildPaletteUI();
    render();
  });
  $('clearPaletteBtn').addEventListener('click', () => {
    params.colors = [];
    params.colorDensities = [];
    params.colorTolerances = [];
    params.zoneBans = [];
    buildPaletteUI();
    render();
  });
  syncColorMode();

  $('demoBtn').addEventListener('click', () => { roles = {}; sourceName = ''; generated = null; loadImport(importResultFromContours(sampleContours()), 'Cartamodello demo'); });

  // Oggetto pieno: genera un rettangolo largo×alto (mm) senza fori, da riempire subito (nessun file).
  function generateObject(w: number, h: number, opts: { keepRoles?: boolean } = {}) {
    const rect: Contour[] = [{ points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], closed: true, color: '#2b6cb0' }];
    if (!opts.keepRoles) { roles = {}; params.realWidthMm = 0; }
    sourceName = `oggetto-${w}x${h}`;
    generated = { w, h };
    impostaNumero($('realWidth') as HTMLInputElement, params.realWidthMm);
    impostaNumero($('objW') as HTMLInputElement, w);
    impostaNumero($('objH') as HTMLInputElement, h);
    loadImport(importResultFromContours(rect), `Oggetto pieno ${w}×${h} mm`);
  }
  $('objBtn').addEventListener('click', () => {
    const w = Math.max(1, leggiCampo($('objW') as HTMLInputElement) || 100);
    const h = Math.max(1, leggiCampo($('objH') as HTMLInputElement) || 100);
    generateObject(w, h);
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    // Export per Stilista: un gruppo per STOP, in ordine di cucitura, con tinta unica (vedi pipeline).
    // Sotto try/catch: nessun export deve fallire in silenzio.
    try {
      const { exportLayers, bounds, stopCount } = runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
      const metadata = conBusta(projectMetadata(), { strati: exportLayers, sorgente: sorgenteProgetto() });
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

  // Export ricamo Tajima .dst tramite la "possibilità" globale del core: l'export dell'interlace è già
  // in mm reali; l'adattatore fa un blocco per polilinea, un ago per stop (cambio-colore in sequenza).
  // I parametri viaggiano ANCHE nel DST (R27), nel footer dopo l'END: la macchina legge fino all'END e
  // lo ignora, noi lo rileggiamo. Lo usano «Esporta DST» e «Invia a Stilista».
  const esporta = () => runPipeline(currentContours(), roles, params, { imageColorAt: imageSampler() });
  function costruisciDst(exportLayers = esporta().exportLayers): Uint8Array {
    return dstFromExportLayers(exportLayers, {
      label: (sourceName || 'INTERLACE').toUpperCase().slice(0, 16),
      metadata: conBusta(projectMetadata(), { strati: exportLayers, sorgente: sorgenteProgetto() }),
    });
  }

  // ---- Stilista (RG Stilista Link, @rg/ui/stilista): la selezione è il cartamodello, i fori le aree vuote.
  // Ogni stop torna come un oggetto a sé, nell'ordine, sull'ago dell'oggetto selezionato.
  let svgStilista: string | null = null;
  const aggancio: AggancioStilista = {
    tool: 'interlace',
    riapri(meta) {
      // senza cartamodello il disegno è la tavola generata, che sta nel progetto
      if (!applyImportedProject(meta, !svgStilista)) return false;
      render();
      return true;
    },
    carica(svg, nome) {
      // l'SVG dichiara le sue misure: una larghezza reale lo riscalerebbe e il ritorno non cadrebbe più al suo posto
      params.realWidthMm = 0;
      impostaNumero($('realWidth') as HTMLInputElement, 0);
      roles = {};
      generated = null;
      sourceName = nome.replace(/\.[^.]+$/, '');
      loadImport(parseSvgToContours(svg), nome);
      svgStilista = svg;
    },
    ruoli(fori) {
      for (const c of uniqueColors()) roles[c] = c === fori ? 'EXCLUSION' : 'MASTER_OUTLINE';
      buildRoleUI();
      render();
    },
    sorgente: () => svgStilista,
    strati: () => stratiCuciti(esporta().exportLayers),
    dst: () => ({ bytes: costruisciDst(), nome: `${sourceName || 'interlace'}-interlace` }),
    stato: (testo) => { $('status').textContent = testo; },
  };

  $('exportDstBtn').addEventListener('click', async () => {
    // Tutto sotto try/catch: un export non deve MAI fallire in silenzio (l'errore va in statusbar).
    try {
      $('status').textContent = 'Genero il DST…';
      const { exportLayers, stopCount } = esporta();
      const bytes = costruisciDst(exportLayers);
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
  collegaStilista(aggancio, { prendi: $('fromStilista'), invia: $('toStilistaBtn') });
}

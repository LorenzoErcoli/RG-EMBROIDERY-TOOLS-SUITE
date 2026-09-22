import '@rg/ui/rg.css';
import './cannage.css';
import { parseImportedBoundarySource, type ImportScaleMode, type PatternConfig } from '@rg/pattern-grammar';
import { buildSvg, dstFromExportLayers, DST_FILE, readProjectMetadata, readDstMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { montaSimulatore, type Simulatore } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
// La libreria dei pattern è quella del Generatore pattern, letta dal suo file (come fa Pattern a zone):
// un preset pubblicato lì è subito disponibile per le basi, senza un doppione da tenere allineato.
import sharedPresetsRaw from '../../pattern-grammar/src/presets.shared.json?raw';
import { PARAMETRI_DAVANTI, pezzoPiuLungo, type Ingombro, type Punto } from './linee';
import { PARAMETRI_STOP } from './stop';
import { PARAMETRI_CORNICE } from './cornice';
import { PARAMETRI_BORDATURA, latiDelContorno, lineeDaLati, stessoLato, type LatoContorno, type LineaBordo, type Passaggio } from './bordatura';
import { coloreStop, conPuntoMinimo, unisciTratti, stopBase, stopBordatura, stopContorno, stopCornice, stopGriglia, stopLinee, stratiProgramma, NOMI_BORDATURA, type Stop } from './programma';
import { reticoloDaZone, contornoDaZone, lineeDaModello, zoneDaModello, type LetturaReticolo, type LineaAperta, type Zona } from './reticolo';
import { sagomaDaAnelli, sagomaDaZone, type Sagoma } from './sagoma';
import {
  BASI_FIELDS, BASI_PREDEFINITE, BORDATURA_FIELDS, CORNICE_FIELDS, LINEE_FIELDS, PRESET_LINEE, PROGRAMMA_FIELDS, SCALE_MODES, STOP_FIELDS,
  parametriBordaturaDa, parametriCorniceDa, parametriDa, parametriStopDa, valoriCorniceDa, valoriDa, type Field, type Valori,
} from './fields';

/**
 * Cosa fa una tinta del disegno: il pattern 1 comanda griglia e linee e fa lo stop 3, il pattern 2 lo
 * stop 4; le aree di scarico (anche più di una tinta) alleggeriscono basi, linee e cornice dentro i loro
 * contorni; il contorno del pezzo è la linea che seguono bordo, griglia e termogarze; le due bordature sono
 * il lato esterno da bordare (una linea aperta o chiusa), doppia o singola.
 */
type Ruolo = '' | 'pattern1' | 'pattern2' | 'scarico' | 'contorno' | 'bordaturaDoppia' | 'bordaturaSingola';
const RUOLI: [Ruolo, string][] = [
  ['', '— (ignora)'],
  ['pattern1', 'Pattern 1 — griglia e linee seguono questi rombi'],
  ['pattern2', 'Pattern 2'],
  ['scarico', 'Area di scarico (meno passate)'],
  ['contorno', 'Contorno del pezzo (bordo, griglia e termogarze)'],
  ['bordaturaDoppia', 'Bordatura doppia — la linea è il lato esterno'],
  ['bordaturaSingola', 'Bordatura singola — la linea è il lato esterno'],
];

/** Il passaggio di una tinta di bordatura, o null se la tinta non borda. */
const passaggioDi = (r: Ruolo | undefined): Passaggio | null => (r === 'bordaturaDoppia' ? 'doppia' : r === 'bordaturaSingola' ? 'singola' : null);

const NOMI_STOP: Record<number, string> = {
  1: 'Contorno a impunture',
  2: 'Griglia che blocca i materiali',
  3: 'Base pattern 1',
  4: 'Base pattern 2',
  5: 'Linee orizzontali e verticali',
  6: 'Cornice nei rombi',
  ...NOMI_BORDATURA,
};

const PRESETS: Record<string, PatternConfig> = (() => {
  try { return JSON.parse(sharedPresetsRaw) as Record<string, PatternConfig>; } catch { return {}; }
})();

/** Tetto al disegno incorporato nei metadati, come in Pattern a zone: oltre, il file porta i soli parametri. */
const MAX_DRAWING_KB = 256;

/** Monta il tool "Cannage rafia" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountCannageRafia(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Cannage rafia', opts.backHref)}
  <div class="rg-workspace cannage-workspace">
    <aside class="rg-workspace__panel" id="panel"></aside>
    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="simulaBtn" class="rg-button rg-button--ghost rg-button--small" aria-pressed="false" title="Il simulatore: il filo si cuce sullo schermo nell'ordine del DST">Simula</button>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Scarica SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <div id="simControlli" class="sim-controlli" hidden></div>
      <footer class="rg-workspace__statusbar">
        <span><span id="status">Carica il disegno a zone (SVG o DXF).</span><span id="points" class="rg-mono"></span></span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const cfg: Valori = valoriDa(PARAMETRI_DAVANTI);
  const cfgStop: Valori = { ...PARAMETRI_STOP };
  const cfgBasi: Valori = { reliefPercent: 50 };
  const cfgCornice: Valori = valoriCorniceDa(PARAMETRI_CORNICE);
  /** Il vincolo globale: il punto minimo di tutto il programma (Lorenzo, 16/09). */
  const cfgProgramma: Valori = { puntoMinimo: 0.5 };
  /** La bordatura, stop 7-10 (Lorenzo, 16/09): i valori del DST M1424. */
  const cfgBordatura: Valori = { ...PARAMETRI_BORDATURA };
  /**
   * I lati da bordare scelti in anteprima, per il loro punto di mezzo (così si ritrovano anche quando il
   * contorno si ricalcola), ognuno col suo passaggio. `scegliLati` = il clic sull'anteprima prende un lato.
   */
  let latiScelti: (Punto & { passaggio: Passaggio })[] = [];
  let scegliLati = false;
  let cacheLati: { chiave: string; lati: LatoContorno[] } | null = null;
  const primoPreset = Object.keys(PRESETS)[0] ?? '';
  const basi = {
    p1: BASI_PREDEFINITE.p1 in PRESETS ? BASI_PREDEFINITE.p1 : primoPreset,
    p2: BASI_PREDEFINITE.p2 in PRESETS ? BASI_PREDEFINITE.p2 : primoPreset,
  };
  const ruoli: Record<string, Ruolo> = {};
  const visibili: Record<number, boolean> = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true, 10: true };
  const importa = { scaleMode: 'illustrator-72dpi', paintPriority: 'fill', customW: 100, customH: 100 };
  let source: { text: string; name: string } | null = null;
  let zone: Zona[] = [];
  /** I tracciati aperti del disegno: servono solo alla bordatura. */
  let linee: LineaAperta[] = [];
  /** Rombi interi per tinta: si misurano una volta al caricamento, non a ogni ridisegno della mappa. */
  let tinte: { color: string; zone: number; linee: number; rombi: number }[] = [];
  let lettura: LetturaReticolo | null = null;
  let avviso = '';
  let stop: Stop[] = [];
  /**
   * Le basi sono lo stop che costa (qualche decimo di secondo su un pezzo intero): si rifanno solo se
   * cambiano disegno, tinta, pattern o scarico — non quando si tocca un parametro delle linee.
   */
  const cacheBasi = new Map<string, Stop>();
  /**
   * La sagoma del pezzo: l'unione delle zone, non il rettangolo. Linee e cornice si fermano dove finisce
   * il cannage (Lorenzo, 16/09). Si ricava una volta per disegno, non a ogni ridisegno.
   */
  let cacheSagoma: { chiave: string; sagoma: Sagoma } | null = null;
  let versioneZone = 0;
  let zoneStatusText = 'Nessun disegno caricato.';
  /** Il simulatore (lo stesso del Pettine): al posto dell'anteprima, il DST che si cuce sullo schermo. */
  let simulando = false;
  let simulatore: Simulatore | null = null;
  let drawingNote = '';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });
  const fmt = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  const conRuolo = (r: Ruolo) => Object.keys(ruoli).find((c) => ruoli[c] === r) ?? '';
  const areeScarico = () => Object.keys(ruoli).filter((c) => ruoli[c] === 'scarico').sort();
  /** I contorni delle aree di scarico, per alleggerire linee e cornice dentro di loro. */
  const poligoniScarico = () => zone.filter((z) => ruoli[(z.color ?? '')] === 'scarico').map((z) => z.points);
  /** La linea di contorno scelta nel disegno: la seguono bordo, griglia e termogarze. */
  const anelliContorno = () => zone.filter((z) => ruoli[(z.color ?? '')] === 'contorno').map((z) => z.points);
  const sagomaBordo = () => {
    const anelli = anelliContorno();
    return anelli.length ? sagomaDaAnelli(anelli) : sagomaPezzo();
  };
  const sagomaPezzo = () => {
    // il pezzo è il cannage: le zone dei due pattern. Finché non sono scelti tutti e due, tutte le zone
    // tranne le aree di scarico (che sono contorni sopra il disegno, non pezzo).
    const pattern = [conRuolo('pattern1'), conRuolo('pattern2')].filter(Boolean);
    const fuoriPezzo = Object.keys(ruoli).filter((c) => ruoli[c] === 'scarico' || ruoli[c] === 'contorno' || passaggioDi(ruoli[c]) !== null).sort();
    const escludi = pattern.length === 2 ? tinte.map((t) => t.color).filter((c) => !pattern.includes(c)) : fuoriPezzo;
    const chiave = `${versioneZone}|${escludi.join(',')}`;
    if (cacheSagoma?.chiave !== chiave) cacheSagoma = { chiave, sagoma: sagomaDaZone(zone, escludi) };
    return cacheSagoma.sagoma;
  };
  /** I lati del contorno che si possono scegliere in anteprima: quelli della linea che segue il bordo. */
  const latiContorno = (): LatoContorno[] => {
    const chiave = `${versioneZone}|${JSON.stringify(ruoli)}`;
    if (cacheLati?.chiave !== chiave) cacheLati = { chiave, lati: zone.length ? latiDelContorno(sagomaBordo().anelli) : [] };
    return cacheLati.lati;
  };
  const sceltaDi = (l: LatoContorno): Passaggio | null => latiScelti.find((k) => stessoLato(l, k))?.passaggio ?? null;
  /** Le linee da bordare: quelle col ruolo nel disegno e i lati scelti in anteprima. */
  const lineeBordatura = (): LineaBordo[] => [
    ...linee.filter((l) => passaggioDi(ruoli[l.color])).map((l) => ({ punti: l.points, chiusa: false, passaggio: passaggioDi(ruoli[l.color])! })),
    ...zone.filter((z) => passaggioDi(ruoli[z.color ?? ''])).map((z) => ({ punti: z.points, chiusa: true, passaggio: passaggioDi(ruoli[z.color ?? ''])! })),
    ...(latiScelti.length ? lineeDaLati(latiContorno(), sceltaDi) : []),
  ];

  // ---- un campo, reso coi componenti DS; il valore mostrato è SEMPRE quello della config corrente ----
  function fieldEl(f: Field, store: Valori, onChange: () => void, prefisso = ''): HTMLElement {
    if (f.kind === 'check') {
      const lab = document.createElement('label');
      lab.className = 'rg-choice rg-param-grid__wide';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.id = 'f-' + prefisso + f.name;
      inp.checked = Boolean(store[f.name]);
      inp.addEventListener('change', () => { store[f.name] = inp.checked; onChange(); });
      lab.append(inp, document.createTextNode(' ' + f.label));
      return lab;
    }
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
    inp.id = 'f-' + prefisso + f.name;
    inp.step = String(f.step);
    if (f.min !== undefined) inp.min = String(f.min);
    inp.value = String(store[f.name]);
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (Number.isNaN(v)) return;
      store[f.name] = v;
      onChange();
    });
    const unit = document.createElement('span');
    unit.textContent = f.unit ?? '';
    wrap.append(inp, unit);
    lab.append(name, wrap);
    if (f.help) {
      const help = document.createElement('small');
      help.className = 'rg-field__help';
      help.textContent = f.help;
      lab.appendChild(help);
    }
    return lab;
  }

  function headSection(index: string, title: string): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'rg-param-section';
    sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-param-section__index">${index}</span><h3 class="rg-param-section__title">${title}</h3></div>`;
    return sec;
  }

  function accordionSection(index: string, title: string, body: HTMLElement, open: boolean, chiave: string): HTMLDetailsElement {
    const det = document.createElement('details');
    det.className = 'rg-param-section rg-disclosure';
    det.dataset.sezione = chiave;
    det.open = open;
    const sum = document.createElement('summary');
    sum.className = 'rg-param-section__header rg-disclosure__trigger';
    sum.innerHTML = `<span class="rg-param-section__index">${index}</span><span class="rg-param-section__title">${title}</span>`;
    det.append(sum, body);
    return det;
  }

  // ---- 01 Disegno ----
  function disegnoGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="zoneFile" accept=".svg,.dxf" />
          <span class="rg-button rg-button--outline">Carica SVG o DXF a zone…</span>
        </label>
        <p class="rg-file-input__status" id="zoneStatus" role="status">${zoneStatusText}</p>
      </div>
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="reopenFile" accept=".dst,.svg" />
          <span class="rg-button rg-button--ghost">Riapri un progetto (SVG o DST)…</span>
        </label>
        <p class="rg-file-input__status" id="reopenStatus" role="status">Un file uscito da qui torna com'era: parametri, ruoli e disegno.</p>
      </div>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Scala del file importato</span>
        <select id="scaleMode" class="rg-select">${SCALE_MODES.map(([v, l]) => `<option value="${v}"${v === importa.scaleMode ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">La zona è definita da</span>
        <select id="paintPriority" class="rg-select">
          <option value="fill"${importa.paintPriority === 'fill' ? ' selected' : ''}>Riempimento (zone piene)</option>
          <option value="stroke"${importa.paintPriority === 'stroke' ? ' selected' : ''}>Tratto (contorni)</option>
        </select></label>
      <label class="rg-field"><span class="rg-field__label">Larghezza import</span>
        <span class="rg-field-with-unit"><input id="customW" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="${importa.customW}"><span>mm</span></span></label>
      <label class="rg-field"><span class="rg-field__label">Altezza import</span>
        <span class="rg-field-with-unit"><input id="customH" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="${importa.customH}"><span>mm</span></span></label>`;
    return box;
  }

  // ---- 02 Colori e ruoli ----
  function coloriGrid(): HTMLElement {
    const box = document.createElement('div');
    box.innerHTML = `<ul class="rg-color-map" id="zoneColors"></ul>
      <p class="rg-field__help" id="retStatus" role="status"></p>`;
    return box;
  }

  function renderColorMap() {
    const ul = root.querySelector<HTMLElement>('#zoneColors');
    if (!ul) return;
    ul.innerHTML = '';
    if (!zone.length) {
      ul.innerHTML = '<li><p class="rg-color-map__empty">Nessun disegno caricato: qui compariranno le tinte trovate.</p></li>';
      return;
    }
    for (const t of tinte) {
      const row = document.createElement('li');
      row.className = 'rg-color-map__row';
      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', t.color);
      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = t.color.toUpperCase() + ' ';
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = t.linee && !t.zone ? `${t.linee} linee aperte` : `${t.zone} zone · ${t.rombi} rombi interi`;
      code.appendChild(meta);
      const sel = document.createElement('select');
      sel.className = 'rg-select rg-color-map__target';
      sel.setAttribute('aria-label', `Ruolo per ${t.color.toUpperCase()}`);
      for (const [v, l] of RUOLI) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        o.selected = (ruoli[t.color] ?? '') === v;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        const v = sel.value as Ruolo;
        // un solo pattern 1 e un solo pattern 2: scegliendolo qui si toglie dall'altra tinta.
        // Le aree di scarico invece possono essere più d'una.
        if (v === 'pattern1' || v === 'pattern2') for (const c of Object.keys(ruoli)) if (ruoli[c] === v) ruoli[c] = '';
        ruoli[t.color] = v;
        renderColorMap();
        aggiorna();
      });
      row.append(sw, code, sel);
      ul.appendChild(row);
    }
  }

  // ---- 03 Programma: gli stop, coi punti, e cosa si vede in anteprima ----
  function programmaGrid(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.appendChild(gridOf(PROGRAMMA_FIELDS, cfgProgramma, 'programma-'));
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.id = 'stopList';
    wrap.appendChild(box);
    return wrap;
  }

  function scriviStop() {
    const box = root.querySelector<HTMLElement>('#stopList');
    if (!box) return;
    box.innerHTML = '';
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const s = stop.find((x) => x.numero === n);
      const lab = document.createElement('label');
      lab.className = 'rg-choice rg-param-grid__wide';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = visibili[n];
      inp.setAttribute('aria-label', `Mostra lo stop ${n} in anteprima`);
      inp.addEventListener('change', () => { visibili[n] = inp.checked; disegna(); });
      const ink = document.createElement('span');
      ink.className = 'cannage-stop-ink';
      ink.style.setProperty('--ink', coloreStop(n));
      const testo = s && s.punti
        ? ` Stop ${n} — ${NOMI_STOP[n]} · ${s.punti.toLocaleString('it-IT')} punti`
        : ` Stop ${n} — ${NOMI_STOP[n]} · ${!zone.length ? 'in attesa del disegno' : n > 6 ? 'niente da cucire (scegli i lati da bordare)' : 'niente da cucire (controlla i ruoli)'}`;
      lab.append(inp, ink, document.createTextNode(testo));
      box.appendChild(lab);
    }
    const help = document.createElement('small');
    help.className = 'rg-field__help rg-param-grid__wide';
    help.textContent = 'Nel DST escono tutti, in quest’ordine, uno stop per ago. Le caselle cambiano solo l’anteprima.';
    box.appendChild(help);
  }

  // ---- 05 Stop 3 e 4: i pattern delle basi e lo scarico ----
  function basiGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const opzioni = (scelto: string) => Object.keys(PRESETS).map((n) => `<option value="${n}"${n === scelto ? ' selected' : ''}>${n}</option>`).join('');
    box.innerHTML = `
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Pattern della base 1 (stop 3)</span>
        <select id="baseP1" class="rg-select">${opzioni(basi.p1)}</select></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Pattern della base 2 (stop 4)</span>
        <select id="baseP2" class="rg-select">${opzioni(basi.p2)}</select></label>`;
    for (const f of BASI_FIELDS) box.appendChild(fieldEl(f, cfgBasi, () => aggiorna()));
    const help = document.createElement('small');
    help.className = 'rg-field__help rg-param-grid__wide';
    help.textContent = 'Le basi riempiono le zone della loro tinta, a righe da sinistra, coi passaggi sui bordi dei rombi: lo stesso motore di Pattern a zone. I pattern vengono dalla libreria condivisa del Generatore pattern. Le aree di scarico si marcano in 02 Colori e ruoli.';
    box.appendChild(help);
    return box;
  }

  // ---- 06 Stop 5: le linee ----
  function lineeGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    const lab = document.createElement('label');
    lab.className = 'rg-field rg-param-grid__wide';
    lab.innerHTML = `<span class="rg-field__label">Modo di cucire le linee</span>
      <select id="presetLinee" class="rg-select">
        ${PRESET_LINEE.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}
        <option value="">Personalizzato</option>
      </select>`;
    grid.appendChild(lab);
    for (const f of LINEE_FIELDS) grid.appendChild(fieldEl(f, cfg, () => { segnaPreset(); aggiorna(); }));
    return grid;
  }

  // ---- 08 Stop 7-10: la bordatura ----
  function bordaturaGrid(): HTMLElement {
    const wrap = document.createElement('div');
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <div class="rg-cluster rg-param-grid__wide">
        <button type="button" id="scegliLati" class="rg-button rg-button--outline rg-button--small" aria-pressed="${scegliLati}">${scegliLati ? 'Fine scelta dei lati' : 'Scegli i lati in anteprima'}</button>
        <button type="button" id="togliLati" class="rg-button rg-button--ghost rg-button--small">Togli i lati scelti</button>
      </div>
      <p class="rg-field__help rg-param-grid__wide" id="latiStatus" role="status"></p>`;
    wrap.append(box, gridOf(BORDATURA_FIELDS, cfgBordatura, 'bordatura-'));
    return wrap;
  }

  function scriviLati() {
    const st = root.querySelector('#latiStatus');
    if (!st) return;
    const daSvg = linee.filter((l) => passaggioDi(ruoli[l.color])).length + zone.filter((z) => passaggioDi(ruoli[z.color ?? ''])).length;
    const scelte = latiContorno().map(sceltaDi);
    const parti = [
      scegliLati ? 'Clicca un lato: il primo clic lo fa doppio (rosso), il secondo singolo (arancio), il terzo lo toglie' : '',
      `in anteprima ${scelte.filter((t) => t === 'doppia').length} lati doppi e ${scelte.filter((t) => t === 'singola').length} singoli`,
      `${daSvg} linee con un ruolo di bordatura nel disegno`,
    ].filter(Boolean);
    st.textContent = parti.join(' · ') + '. La linea è sempre il lato esterno: la bordatura esce di poco e cresce verso dentro.';
  }

  /** Il prefisso tiene gli id distinti quando due sezioni hanno un campo con lo stesso nome (lo scarico). */
  function gridOf(fields: Field[], store: Valori, prefisso = ''): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    for (const f of fields) grid.appendChild(fieldEl(f, store, () => aggiorna(), prefisso));
    return grid;
  }

  /** Il preset mostrato è quello che coincide coi valori; se ne tocchi uno diventa "Personalizzato". */
  function segnaPreset() {
    const sel = root.querySelector<HTMLSelectElement>('#presetLinee');
    if (!sel) return;
    const uguale = PRESET_LINEE.find((p) => {
      const v = valoriDa(p.parametri);
      return LINEE_FIELDS.every((f) => v[f.name] === cfg[f.name]);
    });
    sel.value = uguale?.id ?? '';
  }

  function buildPanel() {
    const panel = $('panel');
    const aperte = new Map([...panel.querySelectorAll<HTMLDetailsElement>('details[data-sezione]')].map((d) => [d.dataset.sezione!, d.open]));
    panel.innerHTML = '';
    const disegno = headSection('01', 'Disegno');
    disegno.appendChild(disegnoGrid());
    panel.appendChild(disegno);
    const colori = headSection('02', 'Colori e ruoli');
    colori.appendChild(coloriGrid());
    panel.appendChild(colori);
    panel.appendChild(accordionSection('03', 'Programma — gli stop del DST', programmaGrid(), aperte.get('programma') ?? true, 'programma'));
    panel.appendChild(accordionSection('04', 'Stop 1 e 2 — contorno e griglia', gridOf(STOP_FIELDS, cfgStop), aperte.get('stop12') ?? false, 'stop12'));
    panel.appendChild(accordionSection('05', 'Stop 3 e 4 — basi', basiGrid(), aperte.get('basi') ?? false, 'basi'));
    panel.appendChild(accordionSection('06', 'Stop 5 — linee orizzontali e verticali', lineeGrid(), aperte.get('linee') ?? false, 'linee'));
    panel.appendChild(accordionSection('07', 'Stop 6 — cornice nei rombi', gridOf(CORNICE_FIELDS, cfgCornice, 'cornice-'), aperte.get('cornice') ?? false, 'cornice'));
    panel.appendChild(accordionSection('08', 'Stop 7-10 — bordatura', bordaturaGrid(), aperte.get('bordatura') ?? false, 'bordatura'));
    wirePanel();
    renderColorMap();
    segnaPreset();
    scriviReticolo();
    scriviStop();
    scriviLati();
  }

  // ---- import ----
  function misuraTinte() {
    const conte = new Map<string, number>();
    for (const z of zone) conte.set(z.color ?? '', (conte.get(z.color ?? '') ?? 0) + 1);
    const aperte = new Map<string, number>();
    for (const l of linee) aperte.set(l.color, (aperte.get(l.color) ?? 0) + 1);
    tinte = [...new Set([...conte.keys(), ...aperte.keys()])].map((color) => {
      let rombi = 0;
      if (conte.has(color)) try { rombi = reticoloDaZone(zone, color).rombiInteri; } catch { /* nessun rombo intero di questa tinta */ }
      return { color, zone: conte.get(color) ?? 0, linee: aperte.get(color) ?? 0, rombi };
    });
    // al primo caricamento: le prime due tinte che hanno rombi interi diventano pattern 1 e pattern 2
    for (const t of tinte) {
      if (t.color in ruoli) continue;
      const presi = Object.values(ruoli);
      ruoli[t.color] = t.rombi > 0 && !presi.includes('pattern1') ? 'pattern1' : t.rombi > 0 && !presi.includes('pattern2') ? 'pattern2' : '';
    }
    versioneZone++;
    cacheBasi.clear();
  }

  function reparse() {
    if (!source) return;
    const model = parseImportedBoundarySource(source.text, source.name, {
      scaleMode: importa.scaleMode as ImportScaleMode,
      paintPriority: importa.paintPriority as 'fill' | 'stroke',
      customWidthMm: importa.customW,
      customHeightMm: importa.customH,
    });
    zone = zoneDaModello(model);
    linee = lineeDaModello(model);
    misuraTinte();
    const b = model.source?.finalBoundsMm;
    const misura = b ? ` · ${fmt(b.maxX - b.minX)} × ${fmt(b.maxY - b.minY)} mm` : '';
    zoneStatusText = zone.length
      ? `${source.name}: ${zone.length} zone, ${tinte.length} tinte${misura}`
      : `${source.name}: nessuna zona chiusa trovata — prova a cambiare "La zona è definita da".`;
    root.querySelector('#zoneStatus')!.textContent = zoneStatusText;
    renderColorMap();
    aggiorna(true);
  }

  // ---- il programma: si rifà a ogni modifica, le basi solo quando serve ----
  function scriviReticolo() {
    const st = root.querySelector('#retStatus');
    if (!st) return;
    if (!zone.length) { st.textContent = ''; return; }
    st.textContent = lettura
      ? `Reticolo dal pattern 1: rombo ${fmt(2 * lettura.reticolo.a)} × ${fmt(2 * lettura.reticolo.b)} mm, misurato su ${lettura.rombiInteri} rombi interi.${avviso ? ' ' + avviso : ''}`
      : avviso;
  }

  function base(numero: 3 | 4, colore: string, preset: string): Stop {
    const colori = areeScarico();
    const percento = Number(cfgBasi.reliefPercent) || 0;
    const chiave = `${numero}|${colore}|${preset}|${colori.join(',')}|${percento}|${versioneZone}`;
    let s = cacheBasi.get(chiave);
    if (!s) {
      const config = PRESETS[preset];
      try {
        s = colore && config ? stopBase(numero, zone, colore, config, { colori, percento }) : { numero, nome: NOMI_STOP[numero], blocchi: [], punti: 0 };
      } catch (e) {
        avviso = `Stop ${numero}: ${(e as Error).message}`;
        s = { numero, nome: NOMI_STOP[numero], blocchi: [], punti: 0 };
      }
      cacheBasi.set(chiave, s);
    }
    return s;
  }

  function aggiorna(adatta = false) {
    lettura = null;
    avviso = '';
    stop = [];
    if (zone.length) {
      const contorno = contornoDaZone(zone);
      const parStop = parametriStopDa(cfgStop);
      // contorno e griglia seguono la sagoma vera del pezzo, non il rettangolo (Lorenzo, 16/09)
      stop.push(stopContorno(sagomaBordo(), parStop));
      const p1 = conRuolo('pattern1');
      if (!p1) avviso = 'Scegli la tinta del pattern 1: griglia e linee seguono i suoi rombi.';
      else {
        try {
          lettura = reticoloDaZone(zone, p1);
          if (lettura.fuoriReticolo) avviso = `${lettura.fuoriReticolo} rombi non stanno sul reticolo: controlla il disegno.`;
          stop.push(stopGriglia(lettura.reticolo, sagomaBordo(), parStop));
        } catch (e) {
          avviso = (e as Error).message;
        }
      }
      stop.push(base(3, p1, basi.p1), base(4, conRuolo('pattern2'), basi.p2));
      if (lettura) {
        // la cornice non passa sopra fermi e barre delle linee: glieli passa lo stop 5
        let ingombri: Ingombro[] = [];
        const sagoma = sagomaPezzo();
        const scarico = poligoniScarico();
        try {
          const s5 = stopLinee(lettura.reticolo, sagoma, parametriDa(cfg), scarico, anelliContorno());
          ingombri = s5.risultato.ingombri;
          stop.push(s5);
        } catch (e) { avviso = (e as Error).message; }
        try { stop.push(stopCornice(lettura.reticolo, sagoma, parametriCorniceDa(cfgCornice), ingombri, scarico)); } catch (e) { avviso = (e as Error).message; }
      }
      // la bordatura, sui lati scelti: il passo dei fermi parte dal pezzo più lungo delle linee (stop 5)
      const daBordare = lineeBordatura();
      if (daBordare.length) {
        try {
          const passo = lettura ? pezzoPiuLungo(lettura.reticolo, parametriDa(cfg)) : undefined;
          stop.push(...stopBordatura(daBordare, parametriBordaturaDa(cfgBordatura), sagomaBordo(), passo).stop);
        } catch (e) { avviso = `Bordatura: ${(e as Error).message}`; }
      }
    }
    // i tratti che si toccano diventano uno (niente salti da 0 mm nel DST), poi il punto minimo per tutti
    const minimo = Number(cfgProgramma.puntoMinimo) || 0;
    stop = stop.map((s) => conPuntoMinimo(unisciTratti(s), minimo));
    scriviReticolo();
    scriviStop();
    scriviLati();
    disegna(adatta);
    scriviStato();
  }

  function scriviStato() {
    if (!zone.length) {
      $('status').textContent = source ? zoneStatusText : 'Carica il disegno a zone (SVG o DXF).';
      $('points').textContent = '';
      return;
    }
    const pieni = stop.filter((s) => s.punti > 0);
    const totale = pieni.reduce((t, s) => t + s.punti, 0);
    const aree = zone.filter((z) => ruoli[z.color ?? ''] === 'scarico').length;
    const previsti = pieni.some((s) => s.numero > 6) ? 10 : 6;
    $('status').textContent = `${pieni.length} stop su ${previsti}` + (aree ? ` · ${aree} aree di scarico` : '') + (avviso ? ` · ${avviso}` : '');
    $('points').textContent = ` · ${totale.toLocaleString('it-IT')} punti`;
  }

  // ---- anteprima: le zone chiare sotto, gli stop coi loro colori, le aree di scarico tratteggiate sopra ----
  const d = (pl: Punto[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  function disegna(adatta = false) {
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    if (!zone.length) { $('layer').innerHTML = ''; return; }
    if (simulando && simula()) { if (adatta) pz.fit(); return; }
    const c = contornoDaZone(zone);
    const x0 = c[0].x - 6, y0 = c[0].y - 6, w = c[2].x - c[0].x + 12, h = c[2].y - c[0].y + 12;
    const p1 = conRuolo('pattern1');
    const scarico = (z: Zona) => ruoli[z.color ?? ''] === 'scarico';
    const zs = zone.filter((z) => !scarico(z)).map((z) => `<polygon points="${d(z.points)}" fill="${z.color}" fill-opacity="${z.color === p1 ? 0.14 : 0.06}" stroke="none"/>`).join('');
    const fili = stop
      .filter((s) => visibili[s.numero])
      .sort((a, b) => a.numero - b.numero)
      .map((s) => s.blocchi.map((b) => `<polyline points="${d(b)}" fill="none" stroke="${coloreStop(s.numero)}" stroke-width="${s.numero >= 5 ? 0.15 : 0.12}"/>`).join(''))
      .join('');
    // le aree di scarico stanno SOPRA le zone: col riempimento nasconderebbero proprio il ricamo che alleggeriscono
    const aree = zone.filter(scarico).map((z) => `<polygon points="${d(z.points)}" fill="none" stroke="${z.color}" stroke-width="0.6" stroke-dasharray="3 1.5"/>`).join('');
    // i lati del contorno: quelli scelti sempre, gli altri solo mentre si sceglie
    const lati = latiScelti.length || scegliLati
      ? latiContorno().map((l) => sceltaDi(l)
        ? `<polyline points="${d(l.punti)}" fill="none" stroke="${sceltaDi(l) === 'doppia' ? '#c0392b' : '#d68910'}" stroke-opacity="0.5" stroke-width="${sceltaDi(l) === 'doppia' ? 1.6 : 1}" stroke-linejoin="round"/>`
        : scegliLati ? `<polyline points="${d(l.punti)}" fill="none" stroke="#5a6b7a" stroke-opacity="0.5" stroke-width="0.8" stroke-dasharray="2 1"/>` : '').join('')
      : '';
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${zs}${lati}${fili}${aree}</svg>`;
    if (adatta) pz.fit();
  }

  /**
   * Il DST di adesso, cucito sullo schermo punto per punto nell'ordine della macchina (Lorenzo, 17/09). Il
   * DST della suite è centrato sullo zero: il riquadro del simulatore parte da lì, con 5 mm di margine.
   * Toccando un parametro il programma si rifà e la simulazione riparte dall'inizio.
   */
  function simula(): boolean {
    const strati = stratiProgramma(stop);
    if (!strati.length) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of strati) for (const pl of l.polylines) for (const p of pl) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    const margine = 5, w = x1 - x0 + 2 * margine, h = y1 - y0 + 2 * margine;
    try {
      // lo stesso file di «Esporta DST», metadati compresi: si simula quello che va in macchina
      const bytes = dstFromExportLayers(strati, { label: nomeBase().toUpperCase().slice(0, 16), metadata: progetto() });
      simulatore = montaSimulatore($('layer'), $('simControlli'), bytes, strati.map((l) => l.color), w, h,
        (t) => { $('status').textContent = t; }, { x: -w / 2, y: -h / 2 });
      return true;
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return false;
    }
  }

  // ---- progetto riapribile (R9/R27/R31): parametri, pattern delle basi, ruoli e — se ci sta — il disegno ----
  function progetto(): Record<string, unknown> {
    const base = {
      rgProject: 'cannage-rafia', params: cfg, stop: cfgStop, basi, basiParams: cfgBasi, cornice: cfgCornice, programma: cfgProgramma,
      bordatura: cfgBordatura, latiBordatura: latiScelti, ruoli,
    };
    const arrotonda = (pl: Punto[]) => pl.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) }));
    const drawing = {
      name: source?.name ?? '',
      zones: zone.map((z) => ({ color: z.color, points: arrotonda(z.points) })),
      lines: linee.map((l) => ({ color: l.color, points: arrotonda(l.points) })),
    };
    const kb = JSON.stringify(drawing).length / 1024;
    if (kb > MAX_DRAWING_KB) {
      drawingNote = ` · disegno troppo pesante (${Math.round(kb)} kB): nel file solo i parametri`;
      return base;
    }
    drawingNote = zone.length ? ` · col disegno (${Math.round(kb)} kB)` : '';
    return { ...base, drawing };
  }

  function restore(metadata: Record<string, unknown> | null): boolean {
    const params = metadata?.params as Valori | undefined;
    const parStop = metadata?.stop as Valori | undefined;
    const parBasi = metadata?.basiParams as Valori | undefined;
    const parCornice = metadata?.cornice as Valori | undefined;
    const parProgramma = metadata?.programma as Valori | undefined;
    const parBordatura = metadata?.bordatura as Valori | undefined;
    const lati = metadata?.latiBordatura as (Punto & { passaggio?: Passaggio })[] | undefined;
    const salvateBasi = metadata?.basi as { p1?: string; p2?: string } | undefined;
    const salvati = metadata?.ruoli as Record<string, Ruolo> | undefined;
    const drawing = metadata?.drawing as { name?: string; zones?: Zona[]; lines?: LineaAperta[] } | undefined;
    if (!params && !salvati && !drawing?.zones?.length) return false;
    if (params) for (const f of LINEE_FIELDS) if (f.name in params) cfg[f.name] = params[f.name];
    if (parStop) for (const f of STOP_FIELDS) if (f.name in parStop) cfgStop[f.name] = parStop[f.name];
    if (parBasi) for (const f of BASI_FIELDS) if (f.name in parBasi) cfgBasi[f.name] = parBasi[f.name];
    if (parCornice) for (const f of CORNICE_FIELDS) if (f.name in parCornice) cfgCornice[f.name] = parCornice[f.name];
    if (parProgramma) for (const f of PROGRAMMA_FIELDS) if (f.name in parProgramma) cfgProgramma[f.name] = parProgramma[f.name];
    if (parBordatura) for (const f of BORDATURA_FIELDS) if (f.name in parBordatura) cfgBordatura[f.name] = parBordatura[f.name];
    if (Array.isArray(lati)) {
      latiScelti = lati
        .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
        .map((p) => ({ x: p.x, y: p.y, passaggio: p.passaggio === 'singola' ? 'singola' : 'doppia' }));
    }
    if (salvateBasi?.p1 && salvateBasi.p1 in PRESETS) basi.p1 = salvateBasi.p1;
    if (salvateBasi?.p2 && salvateBasi.p2 in PRESETS) basi.p2 = salvateBasi.p2;
    if (salvati) {
      // il primo giorno la bordatura era un ruolo solo, sempre doppia
      for (const [c, r] of Object.entries(salvati)) ruoli[c] = (r as string) === 'bordatura' ? 'bordaturaDoppia' : r;
    }
    if (drawing?.zones?.length) {
      source = { text: '', name: drawing.name || 'progetto' };
      zone = drawing.zones;
      linee = drawing.lines ?? [];
      misuraTinte();
      zoneStatusText = `${source.name} (riaperto): ${zone.length} zone, ${tinte.length} tinte`;
    }
    cacheBasi.clear();
    buildPanel();
    aggiorna(true);
    return true;
  }

  const nomeBase = () => source?.name.replace(/\.[^.]+$/, '') ?? 'cannage';

  function wirePanel() {
    $('zoneFile').addEventListener('change', (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result);
          const meta = readProjectMetadata(text) as Record<string, unknown> | null;
          if (meta?.rgProject === 'cannage-rafia') restore({ ...meta, drawing: undefined });
          source = { text, name: file.name };
          reparse();
        } catch (e) {
          $('zoneStatus').textContent = 'Errore import: ' + (e as Error).message;
        }
      };
      reader.readAsText(file);
    });
    const leggiImport = () => {
      importa.scaleMode = (root.querySelector('#scaleMode') as HTMLSelectElement).value;
      importa.paintPriority = (root.querySelector('#paintPriority') as HTMLSelectElement).value;
      importa.customW = parseFloat((root.querySelector('#customW') as HTMLInputElement).value) || importa.customW;
      importa.customH = parseFloat((root.querySelector('#customH') as HTMLInputElement).value) || importa.customH;
      reparse();
    };
    for (const id of ['scaleMode', 'paintPriority', 'customW', 'customH']) $(id).addEventListener('change', leggiImport);

    $('reopenFile').addEventListener('change', (ev) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      const isDst = /\.dst$/i.test(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const metadata = isDst
            ? readDstMetadata(new Uint8Array(reader.result as ArrayBuffer))
            : (readProjectMetadata(String(reader.result)) as Record<string, unknown> | null);
          if (metadata?.rgProject !== 'cannage-rafia') {
            $('reopenStatus').textContent = metadata
              ? `Questo file viene da "${String(metadata.rgProject ?? 'un altro tool')}", non da qui.`
              : 'Nessun progetto dentro questo file: non è uscito dalla suite.';
            return;
          }
          const conDisegno = ((metadata.drawing as { zones?: unknown[] } | undefined)?.zones?.length ?? 0) > 0;
          restore(metadata);
          $('reopenStatus').textContent = `${file.name}: riaperto` + (conDisegno ? ' col disegno.' : ' — senza disegno: caricalo a parte.');
        } catch (e) {
          $('reopenStatus').textContent = 'Errore: ' + (e as Error).message;
        }
        input.value = '';
      };
      if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    });

    $('scegliLati').addEventListener('click', () => {
      scegliLati = !scegliLati;
      $('canvas').classList.toggle('cannage-scegli-lati', scegliLati);
      const b = $('scegliLati');
      b.setAttribute('aria-pressed', String(scegliLati));
      b.textContent = scegliLati ? 'Fine scelta dei lati' : 'Scegli i lati in anteprima';
      scriviLati();
      disegna();
    });
    $('togliLati').addEventListener('click', () => { latiScelti = []; aggiorna(); });
    $('baseP1').addEventListener('change', (ev) => { basi.p1 = (ev.target as HTMLSelectElement).value; aggiorna(); });
    $('baseP2').addEventListener('change', (ev) => { basi.p2 = (ev.target as HTMLSelectElement).value; aggiorna(); });
    $('presetLinee').addEventListener('change', (ev) => {
      const p = PRESET_LINEE.find((x) => x.id === (ev.target as HTMLSelectElement).value);
      if (!p) return;
      Object.assign(cfg, valoriDa(p.parametri));
      buildPanel();
      aggiorna();
    });
  }

  $('fitBtn').addEventListener('click', () => pz.fit());
  $('simulaBtn').addEventListener('click', () => {
    simulando = !simulando;
    $('simulaBtn').setAttribute('aria-pressed', String(simulando));
    ($('simControlli') as HTMLElement).hidden = !simulando;
    disegna(true);
  });

  // Scegliere un lato: un clic (non un trascinamento) sull'anteprima prende il lato più vicino. Il clic si
  // legge sulla tela e si riporta in mm, perché il pan cattura il puntatore e il bersaglio non è il lato.
  let premuto: { x: number; y: number } | null = null;
  $('canvas').addEventListener('pointerdown', (e) => { premuto = { x: e.clientX, y: e.clientY }; });
  $('canvas').addEventListener('click', (e) => {
    const da = premuto;
    premuto = null;
    if (!scegliLati || !da || Math.hypot(e.clientX - da.x, e.clientY - da.y) > 5) return;
    const svg = $('layer').querySelector('svg');
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const tolleranza = Math.max(1, 10 / Math.hypot(ctm.a, ctm.b));
    let meglio: LatoContorno | null = null, dist = tolleranza;
    for (const l of latiContorno()) {
      for (let i = 1; i < l.punti.length; i++) {
        const a = l.punti[i - 1], b = l.punti[i];
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
        const q = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
        if (q < dist) { dist = q; meglio = l; }
      }
    }
    if (!meglio) return;
    const lato = meglio;
    // il clic fa il giro: doppia, singola, tolto
    const prima = sceltaDi(lato);
    latiScelti = latiScelti.filter((k) => !stessoLato(lato, k));
    if (prima !== 'singola') latiScelti.push({ ...lato.chiave, passaggio: prima === 'doppia' ? 'singola' : 'doppia' });
    aggiorna();
  });

  $('exportBtn').addEventListener('click', async () => {
    const strati = stratiProgramma(stop);
    if (!strati.length) { $('status').textContent = 'Niente da esportare: carica il disegno e scegli i pattern.'; return; }
    const c = contornoDaZone(zone);
    const svg = buildSvg(strati, {
      bounds: { minX: c[0].x, minY: c[0].y, maxX: c[2].x, maxY: c[2].y },
      marginMm: 5,
      metadata: progetto(),
    });
    const name = `${nomeBase()}-cannage.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name) + drawingNote;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    const strati = stratiProgramma(stop);
    if (!strati.length) { $('status').textContent = 'Niente da esportare: carica il disegno e scegli i pattern.'; return; }
    let bytes: Uint8Array;
    try {
      // Uno stop per ago, in ordine: contorno, griglia, base 1, base 2, linee, cornice, bordatura (R31).
      bytes = dstFromExportLayers(strati, { label: nomeBase().toUpperCase().slice(0, 16), metadata: progetto() });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${nomeBase()}-cannage.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${strati.length} stop · ${(bytes.length / 1024).toFixed(1)} KB` + drawingNote;
  });

  buildPanel();
}

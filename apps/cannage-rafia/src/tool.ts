import '@rg/ui/rg.css';
import './cannage.css';
import { parseImportedBoundarySource, type ImportScaleMode, type PatternConfig } from '@rg/pattern-grammar';
import { buildSvg, dstFromExportLayers, DST_FILE, readProjectMetadata, readDstMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
// La libreria dei pattern è quella del Generatore pattern, letta dal suo file (come fa Pattern a zone):
// un preset pubblicato lì è subito disponibile per le basi, senza un doppione da tenere allineato.
import sharedPresetsRaw from '../../pattern-grammar/src/presets.shared.json?raw';
import { PARAMETRI_DAVANTI, type Ingombro, type Punto } from './linee';
import { PARAMETRI_STOP } from './stop';
import { PARAMETRI_CORNICE } from './cornice';
import { coloreStop, conPuntoMinimo, unisciTratti, stopBase, stopContorno, stopCornice, stopGriglia, stopLinee, stratiProgramma, type Stop } from './programma';
import { reticoloDaZone, contornoDaZone, zoneDaModello, type LetturaReticolo, type Zona } from './reticolo';
import { sagomaDaAnelli, sagomaDaZone, type Sagoma } from './sagoma';
import {
  BASI_FIELDS, BASI_PREDEFINITE, CORNICE_FIELDS, LINEE_FIELDS, PRESET_LINEE, PROGRAMMA_FIELDS, SCALE_MODES, STOP_FIELDS,
  parametriCorniceDa, parametriDa, parametriStopDa, valoriCorniceDa, valoriDa, type Field, type Valori,
} from './fields';

/**
 * Cosa fa una tinta del disegno: il pattern 1 comanda griglia e linee e fa lo stop 3, il pattern 2 lo
 * stop 4; le aree di scarico (anche più di una tinta) alleggeriscono basi, linee e cornice dentro i loro
 * contorni; il contorno del pezzo è la linea che seguono bordo, griglia e termogarze.
 */
type Ruolo = '' | 'pattern1' | 'pattern2' | 'scarico' | 'contorno';
const RUOLI: [Ruolo, string][] = [
  ['', '— (ignora)'],
  ['pattern1', 'Pattern 1 — griglia e linee seguono questi rombi'],
  ['pattern2', 'Pattern 2'],
  ['scarico', 'Area di scarico (meno passate)'],
  ['contorno', 'Contorno del pezzo (bordo, griglia e termogarze)'],
];

const NOMI_STOP: Record<number, string> = {
  1: 'Contorno a impunture',
  2: 'Griglia che blocca i materiali',
  3: 'Base pattern 1',
  4: 'Base pattern 2',
  5: 'Linee orizzontali e verticali',
  6: 'Cornice nei rombi',
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
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Scarica SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
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
  const primoPreset = Object.keys(PRESETS)[0] ?? '';
  const basi = {
    p1: BASI_PREDEFINITE.p1 in PRESETS ? BASI_PREDEFINITE.p1 : primoPreset,
    p2: BASI_PREDEFINITE.p2 in PRESETS ? BASI_PREDEFINITE.p2 : primoPreset,
  };
  const ruoli: Record<string, Ruolo> = {};
  const visibili: Record<number, boolean> = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
  const importa = { scaleMode: 'illustrator-72dpi', paintPriority: 'fill', customW: 100, customH: 100 };
  let source: { text: string; name: string } | null = null;
  let zone: Zona[] = [];
  /** Rombi interi per tinta: si misurano una volta al caricamento, non a ogni ridisegno della mappa. */
  let tinte: { color: string; zone: number; rombi: number }[] = [];
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
    const fuoriPezzo = Object.keys(ruoli).filter((c) => ruoli[c] === 'scarico' || ruoli[c] === 'contorno').sort();
    const escludi = pattern.length === 2 ? tinte.map((t) => t.color).filter((c) => !pattern.includes(c)) : fuoriPezzo;
    const chiave = `${versioneZone}|${escludi.join(',')}`;
    if (cacheSagoma?.chiave !== chiave) cacheSagoma = { chiave, sagoma: sagomaDaZone(zone, escludi) };
    return cacheSagoma.sagoma;
  };

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
      meta.textContent = `${t.zone} zone · ${t.rombi} rombi interi`;
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
    for (const n of [1, 2, 3, 4, 5, 6]) {
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
        : ` Stop ${n} — ${NOMI_STOP[n]} · ${zone.length ? 'niente da cucire (controlla i ruoli)' : 'in attesa del disegno'}`;
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
    wirePanel();
    renderColorMap();
    segnaPreset();
    scriviReticolo();
    scriviStop();
  }

  // ---- import ----
  function misuraTinte() {
    const conte = new Map<string, number>();
    for (const z of zone) conte.set(z.color ?? '', (conte.get(z.color ?? '') ?? 0) + 1);
    tinte = [...conte].map(([color, n]) => {
      let rombi = 0;
      try { rombi = reticoloDaZone(zone, color).rombiInteri; } catch { /* nessun rombo intero di questa tinta */ }
      return { color, zone: n, rombi };
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
    }
    // i tratti che si toccano diventano uno (niente salti da 0 mm nel DST), poi il punto minimo per tutti
    const minimo = Number(cfgProgramma.puntoMinimo) || 0;
    stop = stop.map((s) => conPuntoMinimo(unisciTratti(s), minimo));
    scriviReticolo();
    scriviStop();
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
    $('status').textContent = `${pieni.length} stop su 6` + (aree ? ` · ${aree} aree di scarico` : '') + (avviso ? ` · ${avviso}` : '');
    $('points').textContent = ` · ${totale.toLocaleString('it-IT')} punti`;
  }

  // ---- anteprima: le zone chiare sotto, gli stop coi loro colori, le aree di scarico tratteggiate sopra ----
  const d = (pl: Punto[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  function disegna(adatta = false) {
    if (!zone.length) { $('layer').innerHTML = ''; return; }
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
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="${x0.toFixed(2)} ${y0.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${zs}${fili}${aree}</svg>`;
    if (adatta) pz.fit();
  }

  // ---- progetto riapribile (R9/R27/R31): parametri, pattern delle basi, ruoli e — se ci sta — il disegno ----
  function progetto(): Record<string, unknown> {
    const base = { rgProject: 'cannage-rafia', params: cfg, stop: cfgStop, basi, basiParams: cfgBasi, cornice: cfgCornice, programma: cfgProgramma, ruoli };
    const drawing = {
      name: source?.name ?? '',
      zones: zone.map((z) => ({ color: z.color, points: z.points.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })) })),
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
    const salvateBasi = metadata?.basi as { p1?: string; p2?: string } | undefined;
    const salvati = metadata?.ruoli as Record<string, Ruolo> | undefined;
    const drawing = metadata?.drawing as { name?: string; zones?: Zona[] } | undefined;
    if (!params && !salvati && !drawing?.zones?.length) return false;
    if (params) for (const f of LINEE_FIELDS) if (f.name in params) cfg[f.name] = params[f.name];
    if (parStop) for (const f of STOP_FIELDS) if (f.name in parStop) cfgStop[f.name] = parStop[f.name];
    if (parBasi) for (const f of BASI_FIELDS) if (f.name in parBasi) cfgBasi[f.name] = parBasi[f.name];
    if (parCornice) for (const f of CORNICE_FIELDS) if (f.name in parCornice) cfgCornice[f.name] = parCornice[f.name];
    if (parProgramma) for (const f of PROGRAMMA_FIELDS) if (f.name in parProgramma) cfgProgramma[f.name] = parProgramma[f.name];
    if (salvateBasi?.p1 && salvateBasi.p1 in PRESETS) basi.p1 = salvateBasi.p1;
    if (salvateBasi?.p2 && salvateBasi.p2 in PRESETS) basi.p2 = salvateBasi.p2;
    if (salvati) Object.assign(ruoli, salvati);
    if (drawing?.zones?.length) {
      source = { text: '', name: drawing.name || 'progetto' };
      zone = drawing.zones;
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
      // Uno stop per ago, in ordine: contorno, griglia, base 1, base 2, linee, cornice (R31).
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

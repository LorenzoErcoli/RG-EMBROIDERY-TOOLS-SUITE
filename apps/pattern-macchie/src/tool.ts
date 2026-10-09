import '@rg/ui/rg.css';
import './macchie.css';
import {
  generateFinalPatternPoints, parseImportedBoundarySource,
  type BoundaryChoice, type ImportedBoundaryModel, type ImportScaleMode, type PatternConfig,
} from '@rg/pattern-grammar';
import { buildSvg, dstFromExportLayers, DST_FILE, polygonArea, readDstMetadata, readProjectMetadata, type ExportLayer, type Polyline } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { montaSimulatore, type Simulatore } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import sharedPresetsRaw from '../../pattern-grammar/src/presets.shared.json?raw';
import { costruisciMacchie, PARAMETRI_MACCHIE, type ParametriMacchie, type RisultatoMacchie } from './motore';

/** I pattern pronti: la libreria condivisa del Generatore pattern, e quelli salvati nel Generatore su questo computer. */
const PRESET_CONDIVISI: Record<string, PatternConfig> = (() => {
  try { return JSON.parse(sharedPresetsRaw) as Record<string, PatternConfig>; } catch { return {}; }
})();
const PRESET_LOCALI_KEY = 'pattern-grammar-engine-presets';
const presetLocali = (): Record<string, PatternConfig> => {
  try { return JSON.parse(localStorage.getItem(PRESET_LOCALI_KEY) || '{}') as Record<string, PatternConfig>; } catch { return {}; }
};
/** Il pattern di partenza: quello delle prove di Lorenzo (punto nastro a squame). */
const PRESET_INIZIALE = 'RG-PUNTO NASTRO — SQUAME';

/** Il disegno nel file riapribile, se non pesa troppo (come nel Generatore pattern). */
const MAX_DRAWING_KB = 256;

type Ruolo = '' | 'pannello' | 'macchie';
const RUOLI: Array<[Ruolo, string]> = [['', '— (non usare)'], ['pannello', 'Pannello (contorno)'], ['macchie', 'Macchie']];

const SCALE_MODES: Array<[string, string]> = [
  ['illustrator-72dpi', 'Illustrator 72 dpi'],
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['viewbox-mm', 'ViewBox = mm'],
];

/** I tre stop del DST (Lorenzo: la base, il raso delle macchie, il punto sopra), e i fili dell'anteprima. */
const STOP = [
  { chiave: 'base', nome: 'Base', colore: '#8a6d4e' },
  { chiave: 'raso', nome: 'Raso delle macchie', colore: '#1f1a17' },
  { chiave: 'sopra', nome: 'Punto sopra le macchie', colore: '#c8952e' },
] as const;
const FILI = [
  { chiave: 'base', nome: 'Base', colore: '#8a6d4e' },
  { chiave: 'raso', nome: 'Raso', colore: '#1f1a17' },
  { chiave: 'sopra', nome: 'Punto sopra', colore: '#c8952e' },
  { chiave: 'sotto', nome: 'Passaggi sotto il raso', colore: '#3b78c4' },
] as const;
type ChiaveFilo = typeof FILI[number]['chiave'];

type Campo = { nome: keyof ParametriMacchie; etichetta: string; unita: string; passo: number; min: number; max?: number; aiuto?: string };
const CAMPI_RASO: Campo[] = [
  { nome: 'rasoAngolo', etichetta: 'Direzione del raso', unita: '°', passo: 1, min: -180, aiuto: '90 = verticale.' },
  { nome: 'rasoInterlinea', etichetta: 'Interlinea del raso', unita: 'mm', passo: 0.05, min: 0.1 },
  { nome: 'rasoPuntoMax', etichetta: 'Punto massimo del raso', unita: 'mm', passo: 0.5, min: 1 },
  { nome: 'sfrangiatura', etichetta: 'Sfrangiatura', unita: 'mm', passo: 0.1, min: 0,
    aiuto: 'Di quanto, a caso, ogni riga finisce prima o dopo il bordo: il bordo non è più netto. 0 = netto.' },
  { nome: 'sfrangiaturaFuori', etichetta: '…di cui oltre il bordo', unita: '%', passo: 10, min: 0, max: 100,
    aiuto: '0 = le righe si accorciano soltanto; 100 = si allungano soltanto, sulla base.' },
];
const CAMPI_SOPRA: Campo[] = [
  { nome: 'passaggioMax', etichetta: 'Passaggio nascosto, fino a', unita: 'mm', passo: 5, min: 0,
    aiuto: 'Da un pezzo all\'altro sulle linee del punto o nel verso del raso: il filo non si vede. Oltre: salto.' },
  { nome: 'pezzoMinimo', etichetta: 'Togli i pezzi staccati più corti di', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'I pezzi che non si raggiungono senza salto: se sono corti si tolgono. Il punto sopra non esce mai dalla macchia.' },
];
const CAMPI_PONTI: Campo[] = [
  { nome: 'ponti', etichetta: 'Unisci le macchie che si seguono e distano meno di', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'Un ponte di raso fra le due: il filo passa senza salto. Cambia il disegno delle macchie. 0 = mai.' },
  { nome: 'pontiLarghezza', etichetta: 'Larghezza del ponte', unita: 'mm', passo: 0.5, min: 1 },
];

/** Monta il tool "Pattern a macchie" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountPatternMacchie(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Pattern a macchie', opts.backHref)}
  <div class="rg-workspace macchie-workspace">
    <aside class="rg-workspace__panel" id="panel"></aside>
    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="simulaBtn" class="rg-button rg-button--ghost rg-button--small" aria-pressed="false" title="Il simulatore: il filo si cuce sullo schermo nell'ordine del DST">Simula</button>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="genBtn" class="rg-button rg-button--secondary rg-button--small">Genera</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Scarica SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <div id="simControlli" class="sim-controlli" hidden></div>
      <footer class="rg-workspace__statusbar">
        <span><span id="status">Carica un SVG o DXF: un colore per il pannello, uno per le macchie.</span><span id="points" class="rg-mono"></span></span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  // ---- lo stato ----
  let source: { text: string; name: string } | null = null;
  let model: ImportedBoundaryModel | null = null;
  const scala = { scaleMode: 'illustrator-72dpi' };
  const ruoli: Record<string, Ruolo> = {};
  const par: ParametriMacchie = { ...PARAMETRI_MACCHIE };
  let pattern: { nome: string; config: PatternConfig } = PRESET_CONDIVISI[PRESET_INIZIALE]
    ? { nome: PRESET_INIZIALE, config: PRESET_CONDIVISI[PRESET_INIZIALE] }
    : { nome: Object.keys(PRESET_CONDIVISI)[0] ?? '', config: Object.values(PRESET_CONDIVISI)[0] ?? ({} as PatternConfig) };
  let risultato: RisultatoMacchie | null = null;
  const visibili: Record<ChiaveFilo | 'salti' | 'contorni', boolean> = { base: true, raso: true, sopra: true, sotto: false, salti: true, contorni: false };
  let testoDisegno = 'Nessun disegno caricato.';
  let simulando = false;
  let simulatore: Simulatore | null = null;

  /** Il contorno del pannello (il più grande fra quelli col ruolo) e le macchie. */
  function geometria(): { pannello: Polyline | null; macchie: Polyline[] } {
    const anelli = (r: Ruolo) => (model?.choices ?? []).filter((c) => ruoli[c.id] === r)
      .flatMap((c) => c.boundary.paths.filter((p) => p.points.length >= 3).map((p) => p.points));
    const pannelli = anelli('pannello').sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    return { pannello: pannelli[0] ?? null, macchie: anelli('macchie') };
  }

  // ---- il pannello dei parametri ----
  function headSection(index: string, title: string): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'rg-param-section';
    sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-param-section__index">${index}</span><h3 class="rg-param-section__title">${title}</h3></div>`;
    return sec;
  }
  function accordionSection(index: string, title: string, body: HTMLElement, open: boolean): HTMLDetailsElement {
    const det = document.createElement('details');
    det.className = 'rg-param-section rg-disclosure';
    det.open = open;
    const sum = document.createElement('summary');
    sum.className = 'rg-param-section__header rg-disclosure__trigger';
    sum.innerHTML = `<span class="rg-param-section__index">${index}</span><span class="rg-param-section__title">${title}</span>`;
    det.append(sum, body);
    return det;
  }
  function campi(lista: Campo[]): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    for (const f of lista) {
      const lab = document.createElement('label');
      lab.className = 'rg-field rg-param-grid__wide';
      lab.innerHTML = `<span class="rg-field__label">${f.etichetta}</span>`;
      const wrap = document.createElement('span');
      wrap.className = 'rg-field-with-unit';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'rg-input rg-input--numeric';
      inp.id = 'f-' + f.nome;
      inp.step = String(f.passo);
      inp.min = String(f.min);
      inp.value = String(par[f.nome]);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v)) { (par as Record<string, unknown>)[f.nome] = Math.min(f.max ?? Infinity, Math.max(f.min, v)); genera(); }
      });
      const unit = document.createElement('span');
      unit.textContent = f.unita;
      wrap.append(inp, unit);
      lab.appendChild(wrap);
      if (f.aiuto) {
        const help = document.createElement('small');
        help.className = 'rg-field__help';
        help.textContent = f.aiuto;
        lab.appendChild(help);
      }
      grid.appendChild(lab);
    }
    return grid;
  }

  function disegnoGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="fileInput" accept=".svg,.dxf" />
          <span class="rg-button rg-button--outline">Carica SVG o DXF…</span>
        </label>
        <p class="rg-file-input__status" id="fileStatus" role="status">${testoDisegno}</p>
      </div>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Scala del file</span>
        <select id="scaleMode" class="rg-select">${SCALE_MODES.map(([v, l]) => `<option value="${v}"${v === scala.scaleMode ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <ul class="rg-color-map rg-param-grid__wide" id="colori"></ul>
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="reopenFile" accept=".dst,.svg" />
          <span class="rg-button rg-button--ghost">Riapri un progetto (DST o SVG)…</span>
        </label>
        <p class="rg-file-input__status" id="reopenStatus" role="status">Un file uscito da qui torna com'era: disegno, ruoli, pattern e parametri.</p>
      </div>`;
    return box;
  }

  function renderColori() {
    const ul = root.querySelector<HTMLElement>('#colori');
    if (!ul) return;
    ul.innerHTML = '';
    const choices = model?.choices ?? [];
    if (!choices.length) { ul.innerHTML = '<li><p class="rg-color-map__empty">Qui compariranno i colori del disegno.</p></li>'; return; }
    for (const c of choices) {
      const row = document.createElement('li');
      row.className = 'rg-color-map__row';
      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch' + (c.color ? '' : ' rg-color-map__swatch--none');
      if (c.color) sw.style.setProperty('--swatch', c.color);
      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = (c.color ? c.color.toUpperCase() : c.label) + ' ';
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = `${c.pathCount} path`;
      code.appendChild(meta);
      const sel = document.createElement('select');
      sel.className = 'rg-select rg-color-map__target';
      sel.setAttribute('aria-label', `Ruolo per ${c.label}`);
      for (const [v, l] of RUOLI) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (v === (ruoli[c.id] ?? '')) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { ruoli[c.id] = sel.value as Ruolo; disegnaContorni(); genera(); });
      row.append(sw, code, sel);
      ul.appendChild(row);
    }
  }

  function patternGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const opzioni = (gruppo: string, nomi: string[], origine: string) => nomi.length
      ? `<optgroup label="${gruppo}">${nomi.map((n) => `<option value="${origine}:${n}"${n === pattern.nome ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>` : '';
    box.innerHTML = `
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Il pattern della base (e sopra le macchie)</span>
        <select id="presetList" class="rg-select">
          ${opzioni('Condivisi', Object.keys(PRESET_CONDIVISI), 'shared')}
          ${opzioni('Salvati nel Generatore pattern', Object.keys(presetLocali()), 'local')}
        </select>
        <small class="rg-field__help">I pattern si preparano nel Generatore pattern; qui si sceglie quale usare.</small></label>`;
    box.appendChild(campione());
    return box;
  }

  /** Un quadretto del pattern scelto, 26 × 26 mm: lo stesso motore della base. */
  function campione(lato = 26): HTMLElement {
    const box = document.createElement('div');
    box.className = 'macchie-swatch rg-param-grid__wide';
    try {
      const q = [{ x: 0, y: 0 }, { x: lato, y: 0 }, { x: lato, y: lato }, { x: 0, y: lato }, { x: 0, y: 0 }];
      const linee = generateFinalPatternPoints({
        ...pattern.config, totalWidth: lato, totalHeight: lato, shapeType: 'imported', voidStitchMm: 0,
        importedBoundary: { id: 'q', sourceFileName: 'q', sourceType: 'svg', paths: [{ id: 'q', points: q, closed: true }], bounds: { minX: 0, minY: 0, maxX: lato, maxY: lato } },
      }).visualPolylines;
      box.innerHTML = `<svg viewBox="0 0 ${lato} ${lato}" role="img" aria-label="Anteprima del pattern">`
        + linee.map((l) => `<polyline points="${d(l)}" fill="none" stroke="${FILI[0].colore}" stroke-width="0.12"/>`).join('')
        + `</svg><small class="rg-field__help">${pattern.nome} · ${lato} × ${lato} mm</small>`;
    } catch (e) {
      box.innerHTML = `<small class="rg-field__help">Anteprima non disponibile: ${(e as Error).message}</small>`;
    }
    return box;
  }

  function livelliGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const r = risultato;
    const stop = STOP.map((l, i) => {
      const v = r?.[l.chiave];
      return `<p class="rg-field__help rg-param-grid__wide">Stop ${i + 1}<span class="macchie-ink" style="--ink:${l.colore}"></span>${l.nome}`
        + (v ? ` — ${v.punti.toLocaleString('it-IT')} punti, ${v.salti} salti` : '') + '</p>';
    }).join('');
    const descrivi = (v: number[]) => { const f = v.slice().sort((a, b) => a - b); return `${f.length}` + (f.length ? ` (fino a 5 mm ${f.filter((d) => d <= 5).length}, oltre 12 mm ${f.filter((d) => d > 12).length}, il più lungo ${f[f.length - 1].toFixed(1)} mm)` : ''); };
    const dettaglio = r
      ? `<p class="rg-field__help rg-param-grid__wide">Salti fra una macchia e l'altra — raso: ${descrivi(r.saltiFra.raso)}; punto sopra: ${descrivi(r.saltiFra.sopra)}`
        + ` · dentro le macchie: ${r.saltiDentro}` + (r.ponti ? ` · ponti: ${r.ponti}` : '')
        + (r.tolto > 0.5 ? ` · punto sopra tolto: ${r.tolto.toFixed(0)} mm` : '') + '</p>'
      : '';
    const caselle = FILI.map((l) => `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="${l.chiave}"${visibili[l.chiave] ? ' checked' : ''}>`
      + `<span class="macchie-ink" style="--ink:${l.colore}"></span>${l.nome}</label>`).join('');
    box.innerHTML = stop + dettaglio + caselle
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="salti"${visibili.salti ? ' checked' : ''}> I salti, in rosso</label>`
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="contorni"${visibili.contorni ? ' checked' : ''}> Il contorno delle macchie (coi ponti)</label>`;
    return box;
  }

  function buildPanel() {
    const panel = $('panel');
    const aperti = new Set([...panel.querySelectorAll<HTMLDetailsElement>('details[data-sezione]')].filter((x) => x.open).map((x) => x.dataset.sezione!));
    const primaVolta = !panel.childElementCount;
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    const disegno = headSection('01', 'Disegno');
    disegno.appendChild(disegnoGrid());
    panel.appendChild(disegno);
    const sezioni: Array<[string, string, HTMLElement]> = [
      ['pattern', 'Pattern della base', patternGrid()],
      ['raso', 'Raso delle macchie', campi(CAMPI_RASO)],
      ['sopra', 'Punto sopra le macchie', campi(CAMPI_SOPRA)],
      ['ponti', 'Macchie vicine', campi(CAMPI_PONTI)],
      ['programma', 'Programma', livelliGrid()],
    ];
    sezioni.forEach(([chiave, titolo, corpo], k) => {
      const det = accordionSection(String(k + 2).padStart(2, '0'), titolo, corpo, primaVolta ? chiave === 'pattern' || chiave === 'programma' : aperti.has(chiave));
      det.dataset.sezione = chiave;
      panel.appendChild(det);
    });
    wirePanel();
    renderColori();
    panel.scrollTop = scroll;
  }

  // ---- import ----
  function reparse() {
    if (!source) return;
    model = parseImportedBoundarySource(source.text, source.name, { scaleMode: scala.scaleMode as ImportScaleMode });
    // i ruoli: quelli già dati restano; un colore nuovo, il più grande fa il pannello e gli altri le macchie
    const nuovi = model.choices.filter((c) => !(c.id in ruoli));
    if (nuovi.length === model.choices.length) {
      const area = (c: BoundaryChoice) => (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
      const grande = model.choices.slice().sort((a, b) => area(b) - area(a))[0];
      for (const c of model.choices) ruoli[c.id] = c === grande ? 'pannello' : 'macchie';
    } else for (const c of nuovi) ruoli[c.id] = '';
    const b = model.source?.finalBoundsMm;
    testoDisegno = `${source.name}: ${model.choices.length} colori` + (b ? ` · ${(b.maxX - b.minX).toFixed(1)} × ${(b.maxY - b.minY).toFixed(1)} mm` : '')
      + (model.warning ? ` · ${model.warning}` : '');
    risultato = null;
    buildPanel();
    disegnaContorni();
    genera();
  }

  // ---- il calcolo ----
  let attesa = 0;
  function genera() {
    const { pannello, macchie } = geometria();
    if (!pannello) { $('status').textContent = model ? 'Dai a un colore il ruolo «Pannello».' : 'Carica prima un disegno.'; return; }
    if (!macchie.length) { $('status').textContent = 'Dai a un colore il ruolo «Macchie».'; return; }
    $('status').textContent = 'Calcolo…';
    // un attimo perché la riga di stato si veda: il calcolo blocca la pagina per un secondo o due
    window.clearTimeout(attesa);
    attesa = window.setTimeout(() => {
      try {
        risultato = costruisciMacchie(pannello, macchie, pattern.config, par);
      } catch (e) {
        risultato = null;
        $('status').textContent = 'Errore: ' + (e as Error).message;
        console.error(e);
        return;
      }
      const r = risultato;
      const punti = r.base.punti + r.raso.punti + r.sopra.punti;
      $('status').textContent = `${macchie.length} macchie · 3 stop · salti: raso ${r.raso.salti}, punto sopra ${r.sopra.salti}`
        + (r.ponti ? ` · ${r.ponti} ponti` : '') + ` · ${(r.tempoMs / 1000).toFixed(1)} s`;
      $('points').textContent = ` · ${punti.toLocaleString('it-IT')} punti`;
      buildPanel();
      disegna();
    }, 30);
  }

  // ---- l'anteprima ----
  const d = (pl: { x: number; y: number }[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  function cornice(corpo: string): string {
    const { pannello } = geometria();
    const pts = pannello ?? (model?.choices ?? []).flatMap((c) => c.boundary.paths.flatMap((p) => p.points));
    if (!pts.length) return '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const w = x1 - x0 + 10, h = y1 - y0 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="${(x0 - 5).toFixed(2)} ${(y0 - 5).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${corpo}</svg>`;
  }

  /** Il disegno com'è arrivato: il pannello col tratto, le macchie in trasparenza. */
  function contorniSvg(opacita: number): string {
    const { pannello, macchie } = geometria();
    return (pannello ? `<polygon points="${d(pannello)}" fill="none" stroke="#c0392b" stroke-width="0.3"/>` : '')
      + macchie.map((m) => `<polygon points="${d(m)}" fill="#e8c547" fill-opacity="${opacita}" stroke="#b8941f" stroke-width="0.15"/>`).join('');
  }

  function disegnaContorni() {
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    $('layer').innerHTML = cornice(contorniSvg(0.35));
    pz.fit();
  }

  function disegna(adatta = false) {
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    if (!risultato) { disegnaContorni(); return; }
    if (simulando && simula()) { if (adatta) pz.fit(); return; }
    const r = risultato;
    const linee: Record<ChiaveFilo, Polyline[]> = { base: r.base.tratti, raso: r.vista.raso, sopra: r.vista.sopra, sotto: r.vista.sotto };
    const fili = FILI.filter((l) => visibili[l.chiave])
      .map((l) => linee[l.chiave].map((t) => `<polyline points="${d(t)}" fill="none" stroke="${l.colore}" stroke-width="${l.chiave === 'raso' ? 0.1 : l.chiave === 'sotto' ? 0.2 : 0.14}"/>`).join(''))
      .join('');
    const salti = visibili.salti
      ? [r.raso.tratti, r.sopra.tratti].flatMap((tr) => tr.slice(1).map((t, i) => {
        const a = tr[i].at(-1)!, b = t[0];
        return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#d62020" stroke-width="0.3" stroke-dasharray="1 0.6"/>`;
      })).join('')
      : '';
    const forme = visibili.contorni ? r.forme.map((f) => `<polygon points="${d(f)}" fill="none" stroke="#2e8b57" stroke-width="0.15"/>`).join('') : '';
    $('layer').innerHTML = cornice(contorniSvg(0.12) + fili + forme + salti);
    if (adatta) pz.fit();
  }

  /** Gli strati da esportare: uno per livello, quindi uno stop ciascuno. */
  function strati(): ExportLayer[] {
    if (!risultato) return [];
    return STOP.map((l) => ({ id: l.chiave, color: l.colore, polylines: risultato![l.chiave].tratti }));
  }

  const nomeBase = () => (source?.name.replace(/\.[^.]+$/, '') ?? 'macchie');

  /** Il DST di adesso, cucito sullo schermo (lo stesso simulatore del Pettine e di Cannage rafia). */
  function simula(): boolean {
    const layers = strati();
    if (!layers.length) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of layers) for (const pl of l.polylines) for (const p of pl) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    const margine = 5, w = x1 - x0 + 2 * margine, h = y1 - y0 + 2 * margine;
    try {
      const bytes = dstFromExportLayers(layers, { label: nomeBase().toUpperCase().slice(0, 16), metadata: progetto() });
      simulatore = montaSimulatore($('layer'), $('simControlli'), bytes, layers.map((l) => l.color), w, h,
        (t) => { $('status').textContent = t; }, { x: -w / 2, y: -h / 2 });
      return true;
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return false;
    }
  }

  // ---- il progetto riapribile (R9/R27): disegno, ruoli, pattern e parametri ----
  let notaDisegno = '';
  function progetto(): Record<string, unknown> {
    const base = { rgProject: 'pattern-macchie', params: par, pattern, ruoli };
    if (!source) return base;
    const drawing = { name: source.name, text: source.text, scale: scala };
    const kb = JSON.stringify(drawing).length / 1024;
    if (kb > MAX_DRAWING_KB) {
      notaDisegno = ` · disegno troppo pesante (${Math.round(kb)} kB): nel file solo i parametri`;
      return base;
    }
    notaDisegno = ` · col disegno (${Math.round(kb)} kB)`;
    return { ...base, drawing };
  }

  function riapri(meta: Record<string, unknown>): void {
    const drawing = meta.drawing as { name?: string; text?: string; scale?: { scaleMode?: string } } | undefined;
    if (meta.params && typeof meta.params === 'object') Object.assign(par, PARAMETRI_MACCHIE, meta.params);
    const p = meta.pattern as { nome?: string; config?: PatternConfig } | undefined;
    if (p?.config) pattern = { nome: p.nome ?? 'dal file', config: p.config };
    if (meta.ruoli && typeof meta.ruoli === 'object') {
      for (const k of Object.keys(ruoli)) delete ruoli[k];
      Object.assign(ruoli, meta.ruoli);
    }
    if (drawing?.text) {
      if (drawing.scale?.scaleMode) scala.scaleMode = drawing.scale.scaleMode;
      source = { text: drawing.text, name: drawing.name || 'progetto' };
      reparse();
    } else {
      buildPanel();
      genera();
    }
  }

  function leggiFile(file: File, comeByte: boolean, fatto: (r: string | ArrayBuffer) => void) {
    const reader = new FileReader();
    reader.onload = () => fatto(reader.result as string | ArrayBuffer);
    if (comeByte) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  function wirePanel() {
    $('fileInput').addEventListener('change', (ev) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      leggiFile(file, false, (text) => {
        try {
          // un SVG uscito da qui si riapre come progetto
          const meta = readProjectMetadata(String(text)) as Record<string, unknown> | null;
          if (meta?.rgProject === 'pattern-macchie') { riapri(meta); return; }
          for (const k of Object.keys(ruoli)) delete ruoli[k];
          source = { text: String(text), name: file.name };
          reparse();
        } catch (e) {
          $('fileStatus').textContent = 'Errore import: ' + (e as Error).message;
        }
        input.value = '';
      });
    });
    $('scaleMode').addEventListener('change', () => { scala.scaleMode = ($('scaleMode') as HTMLSelectElement).value; reparse(); });
    $('reopenFile').addEventListener('change', (ev) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      const isDst = /\.dst$/i.test(file.name);
      leggiFile(file, isDst, (letto) => {
        try {
          const meta = isDst ? readDstMetadata(new Uint8Array(letto as ArrayBuffer)) : (readProjectMetadata(String(letto)) as Record<string, unknown> | null);
          if (meta?.rgProject !== 'pattern-macchie') {
            $('reopenStatus').textContent = meta
              ? `Questo file viene da "${String(meta.rgProject ?? 'un altro tool')}", non da qui.`
              : 'Nessun progetto dentro questo file: non è uscito dalla suite.';
            return;
          }
          riapri(meta);
          $('reopenStatus').textContent = `${file.name}: riaperto` + (meta.drawing ? ' col disegno.' : ' — senza disegno: caricalo a parte.');
        } catch (e) {
          $('reopenStatus').textContent = 'Errore: ' + (e as Error).message;
        }
        input.value = '';
      });
    });
    $('presetList').addEventListener('change', () => {
      const raw = ($('presetList') as HTMLSelectElement).value;
      const sep = raw.indexOf(':');
      const origine = raw.slice(0, sep), nome = raw.slice(sep + 1);
      const config = origine === 'shared' ? PRESET_CONDIVISI[nome] : presetLocali()[nome];
      if (!config) return;
      pattern = { nome, config };
      buildPanel();
      genera();
    });
    for (const inp of root.querySelectorAll<HTMLInputElement>('input[data-livello]')) {
      inp.addEventListener('change', () => { visibili[inp.dataset.livello as ChiaveFilo | 'salti' | 'contorni'] = inp.checked; disegna(); });
    }
  }

  // ---- azioni fisse ----
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('genBtn').addEventListener('click', genera);
  $('simulaBtn').addEventListener('click', () => {
    simulando = !simulando;
    $('simulaBtn').setAttribute('aria-pressed', String(simulando));
    ($('simControlli') as HTMLElement).hidden = !simulando;
    disegna(true);
  });

  $('exportBtn').addEventListener('click', async () => {
    if (!risultato) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    const { pannello } = geometria();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pannello ?? []) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const svg = buildSvg(strati(), { bounds: { minX: x0, minY: y0, maxX: x1, maxY: y1 }, marginMm: 5, metadata: progetto() });
    const name = `${nomeBase()}-macchie.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name) + notaDisegno;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!risultato) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    let bytes: Uint8Array;
    try {
      // tre strati → tre stop: la base, il raso delle macchie, il punto sopra (lo stesso filo)
      bytes = dstFromExportLayers(strati(), { label: nomeBase().toUpperCase().slice(0, 16), metadata: progetto() });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${nomeBase()}-macchie.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB · 3 stop` + notaDisegno;
  });

  buildPanel();
}

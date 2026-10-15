import '@rg/ui/rg.css';
import './rete.css';
import { parseImportedBoundarySource, type BoundaryChoice, type ImportedBoundaryModel, type ImportScaleMode } from '@rg/pattern-grammar';
import { buildSvg, dstFromExportLayers, DST_FILE, polygonArea, readDstMetadata, readProjectMetadata, type Polyline } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { montaSimulatore, type Simulatore } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { costruisciRete, stratiRete, COLORE_RETE, PARAMETRI_RETE, type ParametriRete, type PuntoAgo, type RisultatoRete } from './motore';

/** Il disegno nel file riapribile, se non pesa troppo (come negli altri tool). */
const MAX_DRAWING_KB = 256;

type Ruolo = '' | 'contorno' | 'vuoto';
const RUOLI: Array<[Ruolo, string]> = [['', '— (non usare)'], ['contorno', 'Contorno del cartamodello'], ['vuoto', 'Area vuota']];

const SCALE_MODES: Array<[string, string]> = [
  ['illustrator-72dpi', 'Illustrator 72 dpi'],
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['viewbox-mm', 'ViewBox = mm'],
];

/** I tratti dell'anteprima: il filo è uno solo, i colori dicono che cosa fa ogni pezzo. */
const VISTE = [
  { chiave: 'rete', nome: 'La rete', colore: COLORE_RETE },
  { chiave: 'sotto', nome: 'Sovrapposizioni: la linea sotto', colore: '#e0a458' },
  { chiave: 'sopra', nome: 'Sovrapposizioni: la linea sopra', colore: '#c0471b' },
  { chiave: 'bordo', nome: 'Passate sul contorno', colore: '#7d8681' },
  { chiave: 'vuoto', nome: 'Impuntura nelle aree vuote', colore: '#6f88a8' },
] as const;
type ChiaveVista = typeof VISTE[number]['chiave'];

type Campo = { nome: keyof ParametriRete; etichetta: string; unita: string; passo: number; min: number; max?: number; aiuto?: string; scelte?: Array<[string, string]> };
const CAMPI_ROMBO: Campo[] = [
  { nome: 'diamondWidthMm', etichetta: 'Larghezza del rombo', unita: 'mm', passo: 0.5, min: 1, aiuto: 'Da punta a punta di una colonna, misurata sulla linea vera.' },
  { nome: 'diamondHeightMm', etichetta: 'Altezza del rombo', unita: 'mm', passo: 0.5, min: 1, aiuto: 'Da una rientranza alla successiva, lungo la colonna.' },
  { nome: 'angleDeg', etichetta: 'Direzione della serpentina', unita: '°', passo: 1, min: -90, max: 90, aiuto: '0 = scende in verticale, 90 = corre in orizzontale.' },
  { nome: 'overlapMm', etichetta: 'Sovrapposizione', unita: 'mm', passo: 0.25, min: -6, max: 10,
    aiuto: 'Una sola misura per ogni incrocio: discesa e risalita alla rientranza, e le punte di due colonne vicine. 0 = si toccano, negativo = resta una luce.' },
  { nome: 'cornerRounding', etichetta: 'Arrotondamento degli angoli', unita: '%', passo: 5, min: 0, max: 100,
    aiuto: '0 = spigolo vivo. Vale per punte e rientranze; larghezza e sovrapposizione restano misurate sulla curva vera.' },
  { nome: 'staggerColumns', etichetta: 'Colonne sfalsate di mezzo rombo', unita: '', passo: 1, min: 0 },
];
const CAMPI_PUNTI: Campo[] = [
  { nome: 'maxStitchMm', etichetta: 'Lunghezza del punto', unita: 'mm', passo: 0.1, min: 0.5, max: 12,
    aiuto: 'Ogni tratto fra due punti fissi (punte, apici, incroci) si divide in punti uguali, non più lunghi di così.' },
  { nome: 'underOverlapStitchMm', etichetta: 'Punto nelle sovrapposizioni, linea sotto', unita: 'mm', passo: 0.1, min: 0, max: 12,
    aiuto: 'La linea cucita prima, che nella lente sta sotto. 0 = la lunghezza del punto.' },
  { nome: 'overlapStitchMm', etichetta: 'Punto nelle sovrapposizioni, linea sopra', unita: 'mm', passo: 0.1, min: 0.3, max: 12,
    aiuto: 'La linea che passa dopo, e nella lente sta sopra.' },
  { nome: 'overlapZoneMm', etichetta: 'Ampiezza della zona di sovrapposizione', unita: 'mm', passo: 0.1, min: -3, max: 3,
    aiuto: '0 = la zona va esattamente da un punto d’incrocio all’altro. Positivo la allarga oltre gli incroci, negativo la stringe; con le linee che si toccano soltanto è l’ampiezza attorno al contatto.' },
  { nome: 'constructionStroke', etichetta: 'Spessore del filo', unita: 'mm', passo: 0.1, min: 0.1, max: 3,
    aiuto: 'Sul contorno le passate non si sovrappongono: dove c’è già filo la nuova passa accanto, verso l’interno, a questa distanza.' },
  { nome: 'minStitchMm', etichetta: 'Punto minimo', unita: 'mm', passo: 0.1, min: 0, max: 3,
    aiuto: 'Si impone alla fine, dopo l’ordine di cucitura; un punto che si allunga oltre la lunghezza del punto si ridivide.' },
];
const CAMPI_VUOTI: Campo[] = [
  { nome: 'voidMode', etichetta: 'All’area vuota la rete', unita: '', passo: 1, min: 0,
    scelte: [['ritorno', 'torna indietro, e la parte mancante si cuce dopo'], ['bordo', 'gira sul contorno del vuoto'], ['centro', 'lo attraversa con un’impuntura dritta']] },
  { nome: 'voidStitchMm', etichetta: 'Punto dell’impuntura nel vuoto', unita: 'mm', passo: 0.1, min: 0.5, max: 12,
    aiuto: 'Il punto della linea che gira sul bordo del vuoto o lo attraversa dritta.' },
];

/** Monta il tool "Rete testa speciale" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountReteTestaSpeciale(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Rete testa speciale', opts.backHref)}
  <div class="rg-workspace rete-workspace">
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
        <span><span id="status">Carica un SVG o DXF: un colore per il contorno del cartamodello, uno per le aree vuote.</span><span id="points" class="rg-mono"></span></span>
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
  const par: ParametriRete = { ...PARAMETRI_RETE };
  let risultato: RisultatoRete | null = null;
  const visibili: Record<ChiaveVista | 'salti' | 'punti', boolean> = { rete: true, sotto: true, sopra: true, bordo: true, vuoto: true, salti: true, punti: false };
  let testoDisegno = 'Nessun disegno caricato.';
  let simulando = false;
  let simulatore: Simulatore | null = null;

  /**
   * Il contorno (il più grande fra gli anelli col ruolo) e le aree vuote: quelle col ruolo, più gli altri anelli
   * del colore del contorno (la convenzione di Illustrator: il più grande è il perimetro, gli altri sono buchi).
   */
  function geometria(): { contorno: Polyline | null; vuoti: Polyline[] } {
    const anelli = (r: Ruolo) => (model?.choices ?? []).filter((c) => ruoli[c.id] === r)
      .flatMap((c) => c.boundary.paths.filter((p) => p.points.length >= 3).map((p) => p.points));
    const contorni = anelli('contorno').sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    return { contorno: contorni[0] ?? null, vuoti: [...contorni.slice(1), ...anelli('vuoto')] };
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
      if (f.scelte) {
        const lab = document.createElement('label');
        lab.className = 'rg-field rg-param-grid__wide';
        lab.innerHTML = `<span class="rg-field__label">${f.etichetta}</span>`;
        const sel = document.createElement('select');
        sel.className = 'rg-select';
        sel.id = 'f-' + f.nome;
        for (const [v, l] of f.scelte) { const o = document.createElement('option'); o.value = v; o.textContent = l; o.selected = String(par[f.nome]) === v; sel.appendChild(o); }
        sel.addEventListener('change', () => { (par as Record<string, unknown>)[f.nome] = sel.value; genera(); });
        lab.appendChild(sel);
        grid.appendChild(lab);
        continue;
      }
      if (typeof par[f.nome] === 'boolean') {
        const lab = document.createElement('label');
        lab.className = 'rg-choice rg-param-grid__wide';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.id = 'f-' + f.nome;
        inp.checked = Boolean(par[f.nome]);
        inp.addEventListener('change', () => { (par as Record<string, unknown>)[f.nome] = inp.checked; genera(); });
        lab.append(inp, document.createTextNode(' ' + f.etichetta));
        grid.appendChild(lab);
        if (f.aiuto) { const help = document.createElement('small'); help.className = 'rg-field__help rg-param-grid__wide'; help.textContent = f.aiuto; grid.appendChild(help); }
        continue;
      }
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
      if (f.max !== undefined) inp.max = String(f.max);
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
        <p class="rg-file-input__status" id="reopenStatus" role="status">Un file uscito da qui torna com'era: disegno, ruoli e parametri.</p>
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

  function vistaGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const r = risultato;
    const misure = r
      ? `<p class="rg-field__help rg-param-grid__wide">${r.misure.punti.toLocaleString('it-IT')} punti, di cui ${r.misure.puntiSovrapposti.toLocaleString('it-IT')} nelle sovrapposizioni (${r.misure.puntiSopra.toLocaleString('it-IT')} sopra) · filo ${(r.misure.filoMm / 1000).toFixed(2)} m`
        + ` · punto da ${r.misure.puntoMinMm.toFixed(2)} a ${r.misure.puntoMaxMm.toFixed(2)} mm · ${r.blocchi.length} parti, ${r.misure.salti} salti (${(r.misure.saltiMm / 10).toFixed(1)} cm)`
        + (r.misure.stratiMax ? ` · sul contorno fino a ${r.misure.stratiMax} passate affiancate` : '') + '</p>'
      : '';
    const caselle = VISTE.map((l) => `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-vista="${l.chiave}"${visibili[l.chiave] ? ' checked' : ''}>`
      + `<span class="rete-ink" style="--ink:${l.colore}"></span>${l.nome}</label>`).join('');
    box.innerHTML = misure + caselle
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-vista="salti"${visibili.salti ? ' checked' : ''}> I salti fra le parti, in rosso</label>`
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-vista="punti"${visibili.punti ? ' checked' : ''}> I punti ago</label>`;
    return box;
  }

  function buildPanel() {
    const panel = $('panel');
    const aperti = new Set([...panel.querySelectorAll<HTMLDetailsElement>('details[data-sezione]')].filter((x) => x.open).map((x) => x.dataset.sezione!));
    const primaVolta = !panel.childElementCount;
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    const disegno = headSection('01', 'Cartamodello');
    disegno.appendChild(disegnoGrid());
    panel.appendChild(disegno);
    const sezioni: Array<[string, string, HTMLElement]> = [
      ['rombo', 'Rombo e serpentina', campi(CAMPI_ROMBO)],
      ['punti', 'Punti', campi(CAMPI_PUNTI)],
      ['vuoti', 'Aree vuote', campi(CAMPI_VUOTI)],
      ['vista', 'Programma e vista', vistaGrid()],
    ];
    sezioni.forEach(([chiave, titolo, corpo], k) => {
      const det = accordionSection(String(k + 2).padStart(2, '0'), titolo, corpo, primaVolta ? chiave === 'rombo' || chiave === 'vista' : aperti.has(chiave));
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
    // i ruoli: quelli già dati restano; un disegno nuovo, il colore più grande fa il contorno e gli altri le aree vuote
    const nuovi = model.choices.filter((c) => !(c.id in ruoli));
    if (nuovi.length === model.choices.length) {
      const area = (c: BoundaryChoice) => (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
      const grande = model.choices.slice().sort((a, b) => area(b) - area(a))[0];
      for (const c of model.choices) ruoli[c.id] = c === grande ? 'contorno' : 'vuoto';
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
    const { contorno, vuoti } = geometria();
    if (!contorno) { $('status').textContent = model ? 'Dai a un colore il ruolo «Contorno del cartamodello».' : 'Carica prima un disegno.'; return; }
    $('status').textContent = 'Calcolo…';
    window.clearTimeout(attesa);
    attesa = window.setTimeout(() => {
      try {
        risultato = costruisciRete(contorno, vuoti, par);
      } catch (e) {
        risultato = null;
        $('status').textContent = 'Errore: ' + (e as Error).message;
        console.error(e);
        return;
      }
      const r = risultato;
      $('status').textContent = `${vuoti.length} aree vuote · ${r.blocchi.length} parti · ${r.misure.salti} salti · ${r.misure.tempoMs} ms`;
      $('points').textContent = ` · ${r.misure.punti.toLocaleString('it-IT')} punti`;
      buildPanel();
      disegna();
    }, 30);
  }

  // ---- l'anteprima ----
  const d = (pl: { x: number; y: number }[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  function cornice(corpo: string): string {
    const { contorno } = geometria();
    const pts = contorno ?? (model?.choices ?? []).flatMap((c) => c.boundary.paths.flatMap((p) => p.points));
    if (!pts.length) return '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const w = x1 - x0 + 10, h = y1 - y0 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="${(x0 - 5).toFixed(2)} ${(y0 - 5).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${corpo}</svg>`;
  }

  /** Il disegno com'è arrivato: il contorno col tratto, le aree vuote in trasparenza. */
  function contorniSvg(opacita: number): string {
    const { contorno, vuoti } = geometria();
    return (contorno ? `<polygon points="${d(contorno)}" fill="none" stroke="#c0392b" stroke-width="0.3"/>` : '')
      + vuoti.map((m) => `<polygon points="${d(m)}" fill="#9aa49e" fill-opacity="${opacita}" stroke="#7f8a83" stroke-width="0.15" stroke-dasharray="1 0.6"/>`).join('');
  }

  function disegnaContorni() {
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    $('layer').innerHTML = cornice(contorniSvg(0.35));
    pz.fit();
  }

  const vistaDi = (q: PuntoAgo): ChiaveVista => (q.tipo === 'vuoto' ? 'vuoto' : q.tipo === 'bordo' ? 'bordo' : q.sovrapposto ? (q.sopra ? 'sopra' : 'sotto') : 'rete');

  function disegna(adatta = false) {
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    if (!risultato) { disegnaContorni(); return; }
    if (simulando && simula()) { if (adatta) pz.fit(); return; }
    const r = risultato;
    // ogni tratto col colore di quello che fa: si spezza la parte dove cambia
    const pezzi: Array<{ vista: ChiaveVista; pts: PuntoAgo[] }> = [];
    for (const b of r.blocchi) for (let i = 1; i < b.length; i++) {
      const v = vistaDi(b[i]), ultimo = pezzi[pezzi.length - 1];
      if (ultimo && ultimo.vista === v && ultimo.pts[ultimo.pts.length - 1] === b[i - 1]) ultimo.pts.push(b[i]);
      else pezzi.push({ vista: v, pts: [b[i - 1], b[i]] });
    }
    const colore = Object.fromEntries(VISTE.map((l) => [l.chiave, l.colore])) as Record<ChiaveVista, string>;
    const fili = pezzi.filter((t) => visibili[t.vista])
      .map((t) => `<polyline points="${d(t.pts)}" fill="none" stroke="${colore[t.vista]}" stroke-width="${t.vista === 'sopra' ? 0.24 : t.vista === 'sotto' ? 0.2 : 0.16}" stroke-linejoin="round"/>`).join('');
    const salti = visibili.salti
      ? r.blocchi.slice(1).map((b, i) => {
        const a = r.blocchi[i][r.blocchi[i].length - 1], c = b[0];
        return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${c.x.toFixed(2)}" y2="${c.y.toFixed(2)}" stroke="#d62020" stroke-width="0.3" stroke-dasharray="1 0.6"/>`;
      }).join('')
      : '';
    const punti = visibili.punti
      ? r.blocchi.flat().map((q) => `<circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="0.12" fill="${q.sovrapposto ? colore[q.sopra ? 'sopra' : 'sotto'] : '#1f1a17'}"/>`).join('')
      : '';
    // dove comincia ogni parte: il numero, nell'ordine di cucitura
    const inizi = r.blocchi.map((b, i) => `<circle cx="${b[0].x.toFixed(2)}" cy="${b[0].y.toFixed(2)}" r="1.6" fill="#ffffff" stroke="#d62020" stroke-width="0.3"/>`
      + `<text x="${b[0].x.toFixed(2)}" y="${(b[0].y + 0.7).toFixed(2)}" font-size="2" text-anchor="middle" fill="#1f1a17">${i + 1}</text>`).join('');
    $('layer').innerHTML = cornice(contorniSvg(0.18) + fili + salti + punti + inizi);
    if (adatta) pz.fit();
  }

  const nomeBase = () => (source?.name.replace(/\.[^.]+$/, '') ?? 'rete');

  /** Il DST di adesso, cucito sullo schermo (lo stesso simulatore degli altri tool). */
  function simula(): boolean {
    if (!risultato) return false;
    const layers = stratiRete(risultato);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of layers) for (const pl of l.polylines) for (const p of pl) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    if (!Number.isFinite(x0)) return false;
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

  // ---- il progetto riapribile (R9/R27): disegno, ruoli e parametri ----
  let notaDisegno = '';
  function progetto(): Record<string, unknown> {
    const base = { rgProject: 'rete-testa-speciale', params: par, ruoli };
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
    if (meta.params && typeof meta.params === 'object') Object.assign(par, PARAMETRI_RETE, meta.params);
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
          if (meta?.rgProject === 'rete-testa-speciale') { riapri(meta); return; }
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
          if (meta?.rgProject !== 'rete-testa-speciale') {
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
    for (const inp of root.querySelectorAll<HTMLInputElement>('input[data-vista]')) {
      inp.addEventListener('change', () => { visibili[inp.dataset.vista as ChiaveVista | 'salti' | 'punti'] = inp.checked; disegna(); });
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
    const { contorno } = geometria();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of contorno ?? []) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const svg = buildSvg(stratiRete(risultato), { bounds: { minX: x0, minY: y0, maxX: x1, maxY: y1 }, marginMm: 5, metadata: progetto() });
    const name = `${nomeBase()}-rete.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name) + notaDisegno;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!risultato) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    let bytes: Uint8Array;
    try {
      // un filo solo: un tratto per parte, fra due parti la macchina salta
      bytes = dstFromExportLayers(stratiRete(risultato), { label: nomeBase().toUpperCase().slice(0, 16), metadata: progetto() });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${nomeBase()}-rete.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB · ${risultato.blocchi.length} parti` + notaDisegno;
  });

  buildPanel();
}

import '@rg/ui/rg.css';
import './macchie.css';
import {
  generateFinalPatternPoints, parseImportedBoundarySource,
  type BoundaryChoice, type ImportedBoundaryModel, type ImportScaleMode, type PatternConfig,
} from '@rg/pattern-grammar';
import { buildSvg, conBusta, dstFromExportLayers, DST_FILE, polygonArea, readDstMetadata, readProjectMetadata, type ExportLayer, type Polyline } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { montaSimulatore, type Simulatore } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { collegaStilista, prendiSelezioneStilista, stratiCuciti, BOTTONE_PRENDI_STILISTA, BOTTONE_INVIA_STILISTA, type AggancioStilista } from '@rg/ui/stilista';
import sharedPresetsRaw from '../../pattern-grammar/src/presets.shared.json?raw';
import { costruisciMacchie, macchiePerStilista, tagliDeiSalti, PARAMETRI_MACCHIE, type ParametriMacchie, type RisultatoMacchie, type Strato } from './motore';

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
/**
 * L'ULTIMO PUNTO USATO (Lorenzo, 2026-10-28, aperto da Stilista: «non vedo la base come la vorrei io e le macchie
 * lavorano al contrario»): pattern e parametri dell'ultimo calcolo, su questo computer. Un disegno nuovo, un file o la
 * selezione di Stilista, parte da lì e non dai valori di serie.
 */
const ULTIMO_KEY = 'pattern-macchie-ultimo';
type Punto = { pattern: { nome: string; config: PatternConfig }; params: Partial<ParametriMacchie> };
const ultimoPunto = (): Punto | null => {
  try {
    const u = JSON.parse(localStorage.getItem(ULTIMO_KEY) || 'null') as Punto | null;
    return u?.pattern?.config && u.params && typeof u.params === 'object' ? u : null;
  } catch { return null; }
};

/** Il disegno nel file riapribile, se non pesa troppo (come nel Generatore pattern). */
const MAX_DRAWING_KB = 256;

type Ruolo = '' | 'pannello' | 'macchie' | 'macchie2' | 'macchie3';
const RUOLI: Array<[Ruolo, string]> = [['', '— (non usare)'], ['pannello', 'Pannello (contorno)'], ['macchie', 'Macchie'], ['macchie2', 'Macchie, 2° livello'], ['macchie3', 'Macchie, 3° livello (il più alto)']];

/** I parametri del raso che ogni livello ha per sé: il secondo e il terzo hanno gli stessi nomi con un 2 o un 3 in fondo. */
const DEL_LIVELLO = ['daSinistra', 'rasoAngolo', 'rasoInterlinea', 'rasoPuntoMax', 'rasoFase', 'sfrangiatura', 'sfrangiaturaFuori'] as const;
/**
 * Un progetto (o l'ultimo punto ricordato) di prima: base e punto sopra c'erano sempre, e si riapre così; un secondo
 * livello senza parametri suoi lavora come il primo, come lavorava allora, e un terzo come il secondo.
 */
const conQuelliDiPrima = (p: Partial<ParametriMacchie>): Partial<ParametriMacchie> => {
  const out: Record<string, unknown> = { conBase: true, conSopra: true, ...p };
  for (const k of DEL_LIVELLO) {
    if (out[`${k}2`] === undefined && out[k] !== undefined) out[`${k}2`] = out[k];
    if (out[`${k}3`] === undefined && out[`${k}2`] !== undefined) out[`${k}3`] = out[`${k}2`];
  }
  return out as Partial<ParametriMacchie>;
};

const SCALE_MODES: Array<[string, string]> = [
  ['illustrator-72dpi', 'Illustrator 72 dpi'],
  ['auto', 'Auto: unità fisiche, altrimenti ViewBox = mm'],
  ['viewbox-mm', 'ViewBox = mm'],
];

/** I colori degli stop: la base, il raso delle macchie, il punto sopra (con le zone, raso e punto sopra si ripetono). */
const COLORI_STOP = { base: '#8a6d4e', raso: '#1f1a17', raso2: '#6b3fa0', raso3: '#0f7a5a', sopra: '#c8952e' } as const;
const FILI = [
  { chiave: 'base', nome: 'Base', colore: '#8a6d4e' },
  { chiave: 'raso', nome: 'Raso', colore: '#1f1a17' },
  { chiave: 'raso2', nome: 'Raso, 2° livello', colore: '#6b3fa0' },
  { chiave: 'raso3', nome: 'Raso, 3° livello', colore: '#0f7a5a' },
  { chiave: 'sopra', nome: 'Punto sopra', colore: '#c8952e' },
  { chiave: 'sotto', nome: 'Passaggi sotto il raso', colore: '#3b78c4' },
  { chiave: 'fra', nome: 'Passaggi fra le macchie, livelli sotto', colore: '#0a9396' },
  { chiave: 'aVista', nome: 'Passaggi a vista, da rifilare', colore: '#e0115f' },
] as const;
type ChiaveFilo = typeof FILI[number]['chiave'];
/** I salti nell'anteprima: quelli del raso viola (del secondo livello arancio, del terzo verdi), quelli del punto sopra rossi. */
const COLORE_SALTI_RASO = '#8e3fd0';
const COLORE_SALTI_RASO_2 = '#ee7a12';
const COLORE_SALTI_RASO_3 = '#12a150';
/** I livelli di macchie del ricamo, dal primo in su. */
const livelliDi = (r: RisultatoMacchie): Strato[] => ([1, 2, 3] as const).filter((n) => r.stop.some((st) => st.strato === n));
const saltiDelRaso = (r: RisultatoMacchie, strato: Strato) => r.stop.filter((st) => st.tipo === 'raso' && st.strato === strato).reduce((n, st) => n + st.livello.salti, 0);
const COLORE_SALTI_SOPRA = '#d62020';

type Campo = { nome: keyof ParametriMacchie; etichetta: string; unita: string; passo: number; min: number; max?: number; aiuto?: string; scelte?: Array<[string, string]> };
const CAMPI_COSA: Campo[] = [
  { nome: 'conBase', etichetta: 'La base', unita: '', passo: 1, min: 0,
    aiuto: 'La base col pattern su tutto il pannello. Spenta: niente base.' },
  { nome: 'conSopra', etichetta: 'Il punto sopra le macchie', unita: '', passo: 1, min: 0,
    aiuto: 'Lo stesso punto della base sopra il raso, dentro le macchie. Spento: solo il raso. Spenti tutti e due, il pattern e il pannello non servono.' },
  { nome: 'rasoDiStilista', etichetta: 'In Stilista, il raso lo fa Stilista', unita: '', passo: 1, min: 0,
    aiuto: 'Con «Invia a Stilista» ogni macchia torna come una copia del riempimento selezionato in Stilista (il modello: selezionalo prima di inviare), nella direzione del raso, con l’ingresso, l’uscita e l’ordine di qui. L’anteprima e il DST restano col raso di qui. Con più livelli il modello è uno solo, e fra un riempimento e l’altro Stilista salta: i passaggi fra le macchie non si cuciono.' },
  { nome: 'tagliaOltre', etichetta: 'Nel DST, taglia i salti più lunghi di', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'Un salto più lungo porta il taglio del filo; uno più corto resta un salto. Non cambia il ricamo: non serve rigenerare. 0 = mai.' },
];
const CAMPI_RASO: Campo[] = [
  { nome: 'daSinistra', etichetta: 'Le macchie da sinistra a destra', unita: '', passo: 1, min: 0,
    aiuto: 'L’ordine delle macchie va da sinistra a destra (vale per il raso e per il punto sopra); dentro ogni macchia il raso va da sinistra a destra dove può. Senza: l’ordine coi salti più corti.' },
  { nome: 'rasoAngolo', etichetta: 'Direzione del raso', unita: '°', passo: 1, min: -180, aiuto: '90 = verticale.' },
  { nome: 'rasoInterlinea', etichetta: 'Interlinea del raso', unita: 'mm', passo: 0.05, min: 0.1 },
  { nome: 'rasoPuntoMax', etichetta: 'Punto massimo del raso', unita: 'mm', passo: 0.5, min: 1 },
  { nome: 'rasoFase', etichetta: 'Fase del raso', unita: '%', passo: 5, min: 0, max: 100,
    aiuto: 'Nelle righe più lunghe del punto massimo, di quanto gli aghi di una riga sono spostati rispetto alla riga accanto, in % del punto. 0 = tutti alla stessa altezza.' },
  { nome: 'sfrangiatura', etichetta: 'Sfrangiatura', unita: 'mm', passo: 0.1, min: 0,
    aiuto: 'Di quanto, a caso, ogni riga finisce prima o dopo il bordo: il bordo non è più netto. 0 = netto.' },
  { nome: 'sfrangiaturaFuori', etichetta: '…di cui oltre il bordo', unita: '%', passo: 10, min: 0, max: 100,
    aiuto: '0 = le righe si accorciano soltanto; 100 = si allungano soltanto, sulla base.' },
];
/** Il pannellino del secondo livello: gli stessi campi, coi parametri suoi (Lorenzo, 2026-11-03: «ogni livello di macchia deve avere il suo pannellino dei parametri»). */
const CAMPI_RASO_2: Campo[] = CAMPI_RASO.map((f) => ({ ...f, nome: `${f.nome}2` as keyof ParametriMacchie }));
const CAMPI_RASO_3: Campo[] = CAMPI_RASO.map((f) => ({ ...f, nome: `${f.nome}3` as keyof ParametriMacchie }));
const CAMPI_FRA_I_LIVELLI: Campo[] = [
  { nome: 'sovrapposti', etichetta: 'I livelli sotto restano interi: quelli sopra si cuciono sopra', unita: '', passo: 1, min: 0,
    aiuto: 'Spenta: dove una macchia sta sotto una di un livello più alto si ferma, e ci entra solo di «Un livello entra sotto quelli sopra di».' },
  { nome: 'secondoMargine', etichetta: 'Un livello entra sotto quelli sopra di', unita: 'mm', passo: 0.1, min: 0,
    aiuto: 'Solo coi livelli sotto non interi: dove una macchia sta sotto una di un livello più alto si ferma, e ci entra solo di tanto.' },
  { nome: 'secondoVista', etichetta: 'Fra le macchie dei livelli sotto, a vista al più', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'Il filo da una macchia alla dopo corre sotto i livelli più alti e sotto le macchie ancora da cucire. Dove nessuna lo copre attraversa lo spazio a vista, il meno possibile e al più di tanto per volta: così non si salta. Mai sopra il raso già cucito. 0 = mai a vista: lì si salta.' },
  { nome: 'vistaVicini', etichetta: 'I passaggi a vista si avvicinano a quelli già fatti, entro', unita: 'mm', passo: 1, min: 0,
    aiuto: 'Per rifilare a mano più in fretta: attraversare lo spazio entro questa distanza da un altro passaggio a vista costa meno, e il filo ci va se può arrivarci coperto. Non è forzato. 0 = ognuno dove è più corto.' },
];
const CAMPI_SOPRA: Campo[] = [
  { nome: 'passaggioMax', etichetta: 'Passaggio nascosto, fino a', unita: 'mm', passo: 5, min: 0,
    aiuto: 'Il punto sopra va da un pezzo all\'altro sulle linee della base, anche ripassando: dentro la macchia non salta.' },
  { nome: 'sopraPuntoMin', etichetta: 'Punto minimo del punto sopra', unita: 'mm', passo: 0.1, min: 0.3,
    aiuto: 'Al bordo della macchia la linea si ferma all’ago prima invece di lasciare un puntino; dentro, gli aghi si ridistribuiscono lungo la linea. Più alto per i fili spessi.' },
  { nome: 'sopraSfasaX', etichetta: 'Sposta il punto sopra verso destra di', unita: 'mm', passo: 0.1, min: -5, max: 5,
    aiuto: 'Il punto sopra è il disegno della base spostato: così i suoi aghi non cadono sul filo della base. Negativo = verso sinistra. 0 e 0 = sopra la base, a registro.' },
  { nome: 'sopraSfasaY', etichetta: '…e verso il basso di', unita: 'mm', passo: 0.1, min: -5, max: 5,
    aiuto: 'Negativo = verso l’alto. In diagonale gli aghi cadono più lontano dal filo della base che spostando in una direzione sola.' },
  { nome: 'pezzoMinimo', etichetta: 'Togli i pezzi del punto sopra più corti di', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'I pezzetti staccati dal resto (una barretta che entra dal bordo mentre la sua colonna è fuori) non si cuciono. Il punto sopra non esce mai dalla macchia.' },
];
const CAMPI_ZONE: Campo[] = [
  { nome: 'zone', etichetta: 'Dividi raso e punto sopra in zone', unita: '', passo: 1, min: 1, max: 8,
    aiuto: '1 = nessuna divisione. Con 2: base · raso della prima metà · punto sopra della prima metà · raso della seconda · punto sopra della seconda.' },
  { nome: 'zoneVerso', etichetta: 'Le zone vanno', unita: '', passo: 1, min: 0,
    scelte: [['verticale', 'da sinistra a destra (strisce verticali)'], ['orizzontale', 'dall’alto in basso (strisce orizzontali)']] },
  { nome: 'sopraFascia', etichetta: 'Prima della divisione, punto sopra nella zona dopo: fascia di', unita: 'mm', passo: 1, min: 0,
    aiuto: 'Una macchia che entra in questa fascia, misurata dal confine con la zona dopo, ha il raso nella sua zona e tutto il punto sopra nella zona dopo, anche la parte lontana dal confine. Serve almeno a 2 zone. 0 = nessuna.' },
];
const CAMPI_PONTI: Campo[] = [
  { nome: 'ponti', etichetta: 'Unisci le macchie che si seguono e distano meno di', unita: 'mm', passo: 0.5, min: 0,
    aiuto: 'Un ponte di raso fra le due: il filo passa senza salto. Cambia il disegno delle macchie. Con più livelli i ponti stanno solo sul più alto, anche dove il filo di quelli sotto ci può passare sotto. Oltre questa distanza nessun ponte: lì resta il salto o il filo a vista. 0 = mai.' },
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
          <label class="rg-choice" title="Se è spenta, il ricamo si rifà solo quando premi Genera: così cambi i campi senza aspettare il calcolo."><input type="checkbox" id="autoCalcolo"><span>Ricalcola da solo</span></label>
          <button id="genBtn" class="rg-button rg-button--secondary rg-button--small">Genera</button>
          ${BOTTONE_INVIA_STILISTA()}
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
  const ultimo = ultimoPunto();
  const par: ParametriMacchie = { ...PARAMETRI_MACCHIE, ...(ultimo ? conQuelliDiPrima(ultimo.params) : {}) };
  let pattern: { nome: string; config: PatternConfig } = ultimo ? ultimo.pattern : PRESET_CONDIVISI[PRESET_INIZIALE]
    ? { nome: PRESET_INIZIALE, config: PRESET_CONDIVISI[PRESET_INIZIALE] }
    : { nome: Object.keys(PRESET_CONDIVISI)[0] ?? '', config: Object.values(PRESET_CONDIVISI)[0] ?? ({} as PatternConfig) };
  const ricordaPunto = () => { try { localStorage.setItem(ULTIMO_KEY, JSON.stringify({ pattern, params: par })); } catch { /* senza memoria si riparte dai valori di serie */ } };
  let risultato: RisultatoMacchie | null = null;
  const visibili: Record<ChiaveFilo | 'salti' | 'contorni', boolean> = { base: true, raso: true, raso2: true, raso3: true, sopra: true, sotto: false, fra: true, aVista: true, salti: true, contorni: false };
  let testoDisegno = 'Nessun disegno caricato.';
  let simulando = false;
  let simulatore: Simulatore | null = null;

  /** Base e punto sopra sono quelli che chiedono il pattern e il pannello. */
  const serveIlPattern = () => par.conBase || par.conSopra;
  /** Il contorno del pannello (il più grande fra quelli col ruolo) e le macchie dei tre livelli. */
  function geometria(): { pannello: Polyline | null; macchie: Polyline[]; secondo: Polyline[]; terzo: Polyline[] } {
    const anelli = (r: Ruolo) => (model?.choices ?? []).filter((c) => ruoli[c.id] === r)
      .flatMap((c) => c.boundary.paths.filter((p) => p.points.length >= 3).map((p) => p.points));
    const pannelli = anelli('pannello').sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    return { pannello: pannelli[0] ?? null, macchie: anelli('macchie'), secondo: anelli('macchie2'), terzo: anelli('macchie3') };
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
        sel.addEventListener('change', () => { (par as Record<string, unknown>)[f.nome] = sel.value; daRifare(); });
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
        inp.addEventListener('change', () => {
          (par as Record<string, unknown>)[f.nome] = inp.checked;
          if (f.nome === 'conBase' || f.nome === 'conSopra') buildPanel();   // (il pattern e il punto sopra compaiono solo se servono)
          daRifare();
        });
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
      inp.value = String(par[f.nome]);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v)) { (par as Record<string, unknown>)[f.nome] = Math.min(f.max ?? Infinity, Math.max(f.min, v)); if (f.nome === 'tagliaOltre') aggiornaProgramma(); else daRifare(); }
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
        ${BOTTONE_PRENDI_STILISTA()}
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
      </div>
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="puntoFile" accept=".dst,.svg" />
          <span class="rg-button rg-button--ghost">Pattern e parametri da un progetto…</span>
        </label>
        <p class="rg-file-input__status" id="puntoStatus" role="status">Da un file uscito da qui prende solo pattern e parametri: il disegno resta questo. L'ultimo punto usato resta per la volta dopo.</p>
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
      // (col ruolo di un livello compaiono i suoi parametri)
      sel.addEventListener('change', () => { ruoli[c.id] = sel.value as Ruolo; buildPanel(); disegnaContorni(); daRifare(); });
      row.append(sw, code, sel);
      ul.appendChild(row);
    }
  }

  /** Da dove viene il pattern di adesso: la libreria condivisa, il Generatore su questo computer, o un progetto. */
  function origineDelPattern(): 'shared' | 'local' | 'file' {
    const uguale = (c?: PatternConfig) => !!c && JSON.stringify(c) === JSON.stringify(pattern.config);
    if (uguale(PRESET_CONDIVISI[pattern.nome])) return 'shared';
    if (uguale(presetLocali()[pattern.nome])) return 'local';
    return 'file';
  }

  function patternGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const da = origineDelPattern();
    const opzioni = (gruppo: string, nomi: string[], origine: string) => nomi.length
      ? `<optgroup label="${gruppo}">${nomi.map((n) => `<option value="${origine}:${n}"${n === pattern.nome && origine === da ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>` : '';
    box.innerHTML = `
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Il pattern della base (e sopra le macchie)</span>
        <select id="presetList" class="rg-select">
          ${opzioni('Condivisi', Object.keys(PRESET_CONDIVISI), 'shared')}
          ${opzioni('Salvati nel Generatore pattern', Object.keys(presetLocali()), 'local')}
          ${da === 'file' ? opzioni('Da un progetto', [pattern.nome], 'file') : ''}
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

  /** Quanti salti dello stop portano il taglio nel DST. */
  const tagliTesto = (tratti: Polyline[]) => { const n = tagliDeiSalti(tratti, par.tagliaOltre).filter(Boolean).length; return n ? `, di cui ${n} col taglio` : ''; };
  function livelliGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    const r = risultato;
    const stop = elencoStop().map((l, i) => `<p class="rg-field__help rg-param-grid__wide">Stop ${i + 1}<span class="macchie-ink" style="--ink:${l.colore}"></span>${l.nome}`
      + (l.livello ? ` — ${l.livello.punti.toLocaleString('it-IT')} punti, ${l.livello.salti} salti` + tagliTesto(l.livello.tratti) : '') + '</p>').join('');
    const descrivi = (v: number[]) => { const f = v.slice().sort((a, b) => a - b); return `${f.length}` + (f.length ? ` (fino a 5 mm ${f.filter((d) => d <= 5).length}, oltre 12 mm ${f.filter((d) => d > 12).length}, il più lungo ${f[f.length - 1].toFixed(1)} mm)` : ''); };
    const dettaglio = r
      ? `<p class="rg-field__help rg-param-grid__wide">Salti fra una macchia e l'altra — ${livelliDi(r).length > 1 ? livelliDi(r).map((n) => `raso del ${n}° livello: ${descrivi(n === 3 ? r.saltiFra.raso3 : n === 2 ? r.saltiFra.raso2 : r.saltiFra.raso)}`).join('; ') + ' (l’ultimo sopra non ha niente che copra il filo)' : `raso: ${descrivi([...r.saltiFra.raso, ...r.saltiFra.raso2, ...r.saltiFra.raso3])}`}; punto sopra: ${descrivi(r.saltiFra.sopra)}`
        + ` · dentro le macchie: raso ${r.passaggiScoperti}, punto sopra ${r.saltiDentro}` + (r.ponti ? ` · ponti: ${r.ponti}` : '')
        + (r.tolto > 0.5 ? ` · punto sopra tolto: ${r.tolto.toFixed(0)} mm` : '') + '</p>'
      + (r.sottoIlSecondo.collegate ? `<p class="rg-field__help rg-param-grid__wide">Livelli sotto: ${r.sottoIlSecondo.collegate} passaggi invece di un salto, ${r.sottoIlSecondo.mm.toFixed(0)} mm di filo`
        + (r.sottoIlSecondo.attraversamenti ? `, di cui a vista ${r.sottoIlSecondo.aVista.toFixed(0)} mm in ${r.sottoIlSecondo.attraversamenti} attraversamenti (il giro per rifilarli a mano: ${r.sottoIlSecondo.giro.toFixed(0)} mm)` : ', tutti coperti')
        + (par.rasoDiStilista ? ' (non col raso di Stilista: lì si salta)' : '') + '</p>' : '')
      : '';
    const caselle = FILI.map((l) => `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="${l.chiave}"${visibili[l.chiave] ? ' checked' : ''}>`
      + `<span class="macchie-ink" style="--ink:${l.colore}"></span>${l.nome}</label>`).join('');
    box.innerHTML = stop + dettaglio + caselle
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="salti"${visibili.salti ? ' checked' : ''}> I salti, tratteggiati:`
      + ` <span class="macchie-ink" style="--ink:${COLORE_SALTI_RASO}"></span>del raso${r && r.stop.some((st) => st.strato === 2) ? `, <span class="macchie-ink" style="--ink:${COLORE_SALTI_RASO_2}"></span>del raso del 2° livello` : ''}${r && r.stop.some((st) => st.strato === 3) ? `, <span class="macchie-ink" style="--ink:${COLORE_SALTI_RASO_3}"></span>del raso del 3° livello` : ''}, <span class="macchie-ink" style="--ink:${COLORE_SALTI_SOPRA}"></span>del punto sopra</label>`
      + `<label class="rg-choice rg-param-grid__wide"><input type="checkbox" data-livello="contorni"${visibili.contorni ? ' checked' : ''}> Il contorno delle macchie (coi ponti)</label>`;
    return box;
  }

  function buildPanel() {
    const panel = $('panel');
    const aperti = new Set([...panel.querySelectorAll<HTMLDetailsElement>('details[data-sezione]')].filter((x) => x.open).map((x) => x.dataset.sezione!));
    const primaVolta = !panel.childElementCount;
    // (quando compaiono più livelli, i loro pannellini si aprono)
    const cerano = new Set([...panel.querySelectorAll<HTMLDetailsElement>('details[data-sezione^="raso"]')].map((x) => x.dataset.sezione!));
    const scroll = panel.scrollTop;
    panel.innerHTML = '';
    const disegno = headSection('01', 'Disegno');
    disegno.appendChild(disegnoGrid());
    panel.appendChild(disegno);
    const g = geometria();
    const piuLivelli = [g.macchie, g.secondo, g.terzo].filter((m) => m.length).length > 1;
    const sezioni: Array<[string, string, HTMLElement]> = [
      ['cosa', 'Cosa ricamare', campi(CAMPI_COSA)],
      ...(serveIlPattern() ? [['pattern', 'Pattern della base', patternGrid()] as [string, string, HTMLElement]] : []),
      ...(piuLivelli
        ? [
          ...(g.macchie.length ? [['raso', 'Raso, 1° livello', campi(CAMPI_RASO)]] : []),
          ...(g.secondo.length ? [['raso2', 'Raso, 2° livello', campi(CAMPI_RASO_2)]] : []),
          ...(g.terzo.length ? [['raso3', 'Raso, 3° livello', campi(CAMPI_RASO_3)]] : []),
          ['livelli', 'Fra i livelli', campi(CAMPI_FRA_I_LIVELLI)],
        ] as Array<[string, string, HTMLElement]>
        : g.terzo.length ? [['raso3', 'Raso delle macchie', campi(CAMPI_RASO_3)]] as Array<[string, string, HTMLElement]>
          : g.secondo.length ? [['raso2', 'Raso delle macchie', campi(CAMPI_RASO_2)]] as Array<[string, string, HTMLElement]>
            : [['raso', 'Raso delle macchie', campi(CAMPI_RASO)]] as Array<[string, string, HTMLElement]>),
      ...(par.conSopra ? [['sopra', 'Punto sopra le macchie', campi(CAMPI_SOPRA)] as [string, string, HTMLElement]] : []),
      ['ponti', 'Macchie vicine', campi(CAMPI_PONTI)],
      ['zone', 'Zone', campi(CAMPI_ZONE)],
      ['programma', 'Programma', livelliGrid()],
    ];
    sezioni.forEach(([chiave, titolo, corpo], k) => {
      const det = accordionSection(String(k + 2).padStart(2, '0'), titolo, corpo, (piuLivelli && !cerano.has(chiave) && chiave.startsWith('raso')) || (primaVolta ? chiave === 'cosa' || chiave === 'pattern' || chiave === 'programma' : aperti.has(chiave) || chiave === 'cosa'));
      det.dataset.sezione = chiave;
      panel.appendChild(det);
    });
    wirePanel();
    renderColori();
    panel.scrollTop = scroll;
  }

  /**
   * I ruoli di un disegno nuovo. Il colore più grande fa il pannello: con la base o il punto sopra sempre, senza solo se è
   * davvero un contorno (un tracciato solo, attorno a tutto il resto). Degli altri, se sono due o tre, il primo sono le macchie
   * e i seguenti il 2° e il 3° livello (dalla selezione di Stilista: gli stop, nell'ordine); se no, tutti macchie.
   */
  function ruoliDiSerie(colori: BoundaryChoice[]) {
    const area = (c: BoundaryChoice) => (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
    const grande = colori.slice().sort((a, b) => area(b) - area(a))[0];
    const contiene = (a: BoundaryChoice, b: BoundaryChoice) => a.bounds.minX <= b.bounds.minX && a.bounds.minY <= b.bounds.minY && a.bounds.maxX >= b.bounds.maxX && a.bounds.maxY >= b.bounds.maxY;
    const pannello = colori.length > 1 && (serveIlPattern() || (grande.pathCount === 1 && colori.every((c) => contiene(grande, c)))) ? grande : null;
    const resto = colori.filter((c) => c !== pannello);
    for (const c of colori) ruoli[c.id] = c === pannello ? 'pannello' : resto.length >= 2 && resto.length <= 3 && c === resto[1] ? 'macchie2' : resto.length === 3 && c === resto[2] ? 'macchie3' : 'macchie';
  }

  // ---- import ----
  function reparse() {
    if (!source) return;
    model = parseImportedBoundarySource(source.text, source.name, { scaleMode: scala.scaleMode as ImportScaleMode });
    // i ruoli: quelli già dati restano; se il disegno è nuovo, quelli di serie
    const nuovi = model.choices.filter((c) => !(c.id in ruoli));
    if (nuovi.length === model.choices.length) ruoliDiSerie(model.choices);
    else for (const c of nuovi) ruoli[c.id] = '';
    const b = model.source?.finalBoundsMm;
    testoDisegno = `${source.name}: ${model.choices.length} colori` + (b ? ` · ${(b.maxX - b.minX).toFixed(1)} × ${(b.maxY - b.minY).toFixed(1)} mm` : '')
      + (model.warning ? ` · ${model.warning}` : '');
    risultato = null;
    buildPanel();
    disegnaContorni();
    daRifare();
  }

  // ---- il calcolo, in un processo a parte (Web Worker): la pagina resta libera ----
  let worker: Worker | null = null;
  /** Se il worker sta calcolando: un calcolo nuovo butta via quello vecchio invece di aspettarlo. */
  let occupato = false;
  /** Se il worker non parte (il browser non lo carica): si calcola nella pagina, come prima. */
  let senzaWorker = false;
  let idCalcolo = 0, attesa = 0;
  /** Gli export valgono solo col ricamo dei parametri di adesso: mentre si calcola, si fermano. */
  function exportPronti(si: boolean) {
    for (const id of ['exportBtn', 'exportDstBtn']) ($(id) as HTMLButtonElement).disabled = !si;
  }
  /**
   * Il ricamo si rifà solo con «Genera», salvo «Ricalcola da solo» (Lorenzo, 2026-11-06: «appena modifico una cosa lui
   * inizia a calcolare. invece dovrebbe calcolare solo se avvio genera»). Quando cambia qualcosa l'anteprima resta quella
   * di prima, lo si dice, e gli export si fermano finché non si rigenera: varrebbero per i parametri vecchi.
   */
  let superato = false;
  let autoCalcolo = false;
  try { autoCalcolo = localStorage.getItem('pattern-macchie.auto') === '1'; } catch { /* senza archivio resta spento */ }
  function daRifare() {
    if (autoCalcolo) { genera(); return; }
    // (un calcolo partito prima non serve più: si ferma, così non tiene occupato il computer)
    idCalcolo++;
    window.clearTimeout(attesa);
    if (occupato) { worker?.terminate(); worker = null; occupato = false; }
    superato = true;
    exportPronti(false);
    $('genBtn').classList.replace('rg-button--secondary', 'rg-button--primary');
    if (!model) return;
    $('status').textContent = risultato ? "Cambiato qualcosa: premi Genera per rifare il ricamo (l'anteprima è quella di prima)." : 'Premi Genera per fare il ricamo.';
  }
  function genera() {
    const { pannello, macchie, secondo, terzo } = geometria();
    if (!model) { $('status').textContent = 'Carica prima un disegno.'; return; }
    if (!pannello && serveIlPattern()) { $('status').textContent = 'Dai a un colore il ruolo «Pannello»: serve per la base e il punto sopra.'; return; }
    if (!macchie.length && !secondo.length && !terzo.length) { $('status').textContent = 'Dai a un colore il ruolo «Macchie».'; return; }
    ricordaPunto();
    const mioId = ++idCalcolo;
    window.clearTimeout(attesa);
    if (occupato) { worker?.terminate(); worker = null; occupato = false; }
    if (!worker && !senzaWorker) {
      try { worker = new Worker(new URL('./macchie.worker.ts', import.meta.url), { type: 'module' }); } catch { worker = null; }
    }
    exportPronti(false);
    // (senza contatore dei secondi: riscrivere la riga di stato ogni mezzo secondo faceva ridisegnare alla pagina tutto
    // il disegno, e su un pannello di 500 macchie il calcolo passava da 10 a 35 s — 2026-10-27)
    $('status').textContent = 'Calcolo…';
    const finito = (r: RisultatoMacchie | null, errore?: string) => {
      occupato = false;
      superato = false;
      $('genBtn').classList.replace('rg-button--primary', 'rg-button--secondary');
      exportPronti(true);
      risultato = r;
      if (!r) { $('status').textContent = 'Errore: ' + errore; return; }
      const punti = r.base.punti + r.raso.punti + r.sopra.punti;
      $('status').textContent = `${macchie.length + secondo.length + terzo.length} macchie · ${(par.conBase ? 1 : 0) + r.stop.length} stop · salti: ${livelliDi(r).length > 1 ? 'raso ' + livelliDi(r).map((n) => `${n}° livello ${saltiDelRaso(r, n)}`).join(', ') : `raso ${r.raso.salti}`}` + (par.conSopra ? `, punto sopra ${r.sopra.salti}` : '')
        + (r.ponti ? ` · ${r.ponti} ponti` : '') + ` · ${(r.tempoMs / 1000).toFixed(1)} s`;
      $('points').textContent = ` · ${punti.toLocaleString('it-IT')} punti`;
      aggiornaProgramma();
      disegna();
    };
    if (!worker) {
      // senza worker si calcola qui, come prima (un attimo perché la riga di stato si veda: la pagina si blocca)
      attesa = window.setTimeout(() => {
        if (mioId !== idCalcolo) return;
        try { finito(costruisciMacchie(pannello ?? [], macchie, pattern.config, par, secondo, terzo)); } catch (e) { console.error(e); finito(null, (e as Error).message); }
      }, 30);
      return;
    }
    occupato = true;
    worker.onmessage = (e: MessageEvent<{ id: number; result?: RisultatoMacchie; error?: string }>) => {
      if (e.data.id !== mioId) return;
      finito(e.data.result ?? null, e.data.error);
    };
    // (gli errori del calcolo tornano nel messaggio: qui arriva solo un worker che non è partito)
    worker.onerror = (e) => {
      console.error(e);
      worker?.terminate(); worker = null; occupato = false;
      senzaWorker = true;
      if (mioId === idCalcolo) genera();
    };
    worker.postMessage({ id: mioId, pannello: pannello ?? [], macchie, secondo, terzo, pattern: pattern.config, par: { ...par } });
  }

  // ---- l'anteprima ----
  const d = (pl: { x: number; y: number }[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  /** Tante linee in un tracciato solo (`M x y L x y …`), al decimo di millimetro. */
  const percorso = (linee: Array<{ x: number; y: number }[]>) =>
    linee.filter((t) => t.length > 1).map((t) => 'M' + t.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')).join('');

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
    const { pannello, macchie, secondo, terzo } = geometria();
    return (pannello ? `<polygon points="${d(pannello)}" fill="none" stroke="#c0392b" stroke-width="0.3"/>` : '')
      + (macchie.length ? `<path d="${percorso(macchie.map((m) => [...m, m[0]]))}" fill="#e8c547" fill-opacity="${opacita}" stroke="#b8941f" stroke-width="0.15"/>` : '')
      + (secondo.length ? `<path d="${percorso(secondo.map((m) => [...m, m[0]]))}" fill="#8e6bbf" fill-opacity="${opacita}" stroke="#6b3fa0" stroke-width="0.15"/>` : '')
      + (terzo.length ? `<path d="${percorso(terzo.map((m) => [...m, m[0]]))}" fill="#4fae8c" fill-opacity="${opacita}" stroke="#0f7a5a" stroke-width="0.15"/>` : '');
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
    const linee: Record<ChiaveFilo, Polyline[]> = { base: r.base.tratti, raso: r.vista.raso, raso2: r.vista.raso2, raso3: r.vista.raso3, sopra: r.vista.sopra, sotto: r.vista.sotto, fra: r.vista.fra, aVista: r.vista.aVista };
    // un solo tracciato per filo, al decimo di millimetro: su un pannello di 400.000 punti l'anteprima a una linea per
    // tratto era un SVG da 8 MB con 16.600 elementi, pesante da ridisegnare a ogni zoom (2026-10-27)
    const fili = FILI.filter((l) => visibili[l.chiave])
      .map((l) => `<path d="${percorso(linee[l.chiave])}" fill="none" stroke="${l.colore}" stroke-width="${l.chiave === 'raso' || l.chiave === 'raso2' || l.chiave === 'raso3' ? 0.1 : l.chiave === 'sotto' ? 0.2 : l.chiave === 'fra' ? 0.3 : l.chiave === 'aVista' ? 0.6 : 0.14}" stroke-linejoin="round"/>`)
      .join('');
    // (i salti del raso e quelli del punto sopra di colori diversi: Lorenzo, 2026-10-28, «per capire perché ci sono più
    // salti che escono dalla stessa macchia»)
    const saltiDi = (tr: Polyline[], colore: string) => `<path d="${tr.slice(1).map((t, i) => percorso([[tr[i].at(-1)!, t[0]]])).join('')}" fill="none" stroke="${colore}" stroke-width="0.3" stroke-dasharray="1 0.6"/>`;
    // (uno stop alla volta: fra due stop il filo è tagliato, non è un salto)
    const delRaso = (strato: Strato, colore: string) => r.stop.filter((st) => st.tipo === 'raso' && st.strato === strato).map((st) => saltiDi(st.livello.tratti, colore)).join('');
    const salti = visibili.salti ? delRaso(1, COLORE_SALTI_RASO) + delRaso(2, COLORE_SALTI_RASO_2) + delRaso(3, COLORE_SALTI_RASO_3) + saltiDi(r.sopra.tratti, COLORE_SALTI_SOPRA) : '';
    const forme = visibili.contorni ? `<path d="${percorso(r.forme.map((f) => [...f, f[0]]))}" fill="none" stroke="#2e8b57" stroke-width="0.15"/>` : '';
    $('layer').innerHTML = cornice(contorniSvg(0.12) + fili + forme + salti);
    if (adatta) pz.fit();
  }

  /**
   * Gli stop, in ordine: la base (se richiesta), poi per ogni livello di macchie e per ogni zona il raso e il punto sopra
   * (se richiesto). Senza risultato, quelli previsti dai parametri (per mostrarli nel programma).
   */
  function elencoStop(): Array<{ id: string; nome: string; colore: string; livello: RisultatoMacchie['base'] | null }> {
    const r = risultato;
    const { macchie, secondo, terzo } = geometria();
    const previsti = ([[1, macchie], [2, secondo], [3, terzo]] as Array<[Strato, Polyline[]]>).filter(([, m]) => m.length).map(([n]) => n);
    const piuLivelli = (r ? livelliDi(r).length : previsti.length) > 1;
    const n = r ? new Set(r.stop.map((st) => st.zona)).size : Math.max(1, Math.round(par.zone || 1));
    const nome = (tipo: 'raso' | 'sopra', strato: Strato, z: number) => (tipo === 'raso' ? 'Raso delle macchie' : 'Punto sopra le macchie')
      + (piuLivelli ? `, ${strato}° livello` : '') + (n > 1 ? ` — zona ${z + 1} di ${n}` : '');
    const voce = (tipo: 'raso' | 'sopra', strato: Strato, z: number, livello: RisultatoMacchie['base'] | null) => ({
      id: `${tipo}${strato > 1 ? strato : ''}-${z + 1}`, nome: nome(tipo, strato, z),
      colore: tipo === 'raso' && strato === 2 ? COLORI_STOP.raso2 : tipo === 'raso' && strato === 3 ? COLORI_STOP.raso3 : COLORI_STOP[tipo], livello,
    });
    const out: Array<{ id: string; nome: string; colore: string; livello: RisultatoMacchie['base'] | null }> = par.conBase ? [{ id: 'base', nome: 'Base', colore: COLORI_STOP.base, livello: r?.base ?? null }] : [];
    if (r) for (const st of r.stop) out.push(voce(st.tipo, st.strato, st.zona, st.livello));
    else for (const strato of previsti.length ? previsti : [1] as Strato[]) for (let z = 0; z < n; z++) {
      out.push(voce('raso', strato, z, null));
      if (par.conSopra) out.push(voce('sopra', strato, z, null));
    }
    return out;
  }

  /** Gli strati da esportare: uno per stop. */
  function strati(): ExportLayer[] {
    if (!risultato) return [];
    return elencoStop().filter((l) => l.livello && l.livello.tratti.length).map((l) => ({ id: l.id, color: l.colore, polylines: l.livello!.tratti, trims: tagliDeiSalti(l.livello!.tratti, par.tagliaOltre) }));
  }

  const nomeBase = () => (source?.name.replace(/\.[^.]+$/, '') ?? 'macchie');

  // uno strato per stop: la base, il raso delle macchie, il punto sopra (lo stesso filo), quelli richiesti.
  // Lo usano «Esporta DST» e «Invia a Stilista».
  const costruisciDst = (layers = strati()) => dstFromExportLayers(layers, { label: nomeBase().toUpperCase().slice(0, 16), metadata: conBusta(progetto(), { strati: layers, sorgente: sorgenteBusta() }) });

  // ---- Stilista (RG Stilista Link, @rg/ui/stilista): la selezione è il disegno — il colore più grande il
  // pannello, gli altri le macchie, come per un file. Le macchie non hanno aree vuote: i fori restano fuori.
  // Ogni stop torna come un oggetto a sé, nell'ordine (base, raso, sopra…).
  const aggancio: AggancioStilista = {
    tool: 'pattern-macchie',
    riapri(meta) {
      riapri(meta);
      return true;
    },
    fori: 'esclusi',
    carica(svg, nome) {
      for (const k of Object.keys(ruoli)) delete ruoli[k];
      scala.scaleMode = 'auto'; // l'SVG del plugin dichiara width/height in mm (Illustrator 72 dpi lo scalerebbe)
      source = { text: svg, name: nome };
      reparse();
    },
    ruoli(fori) {
      if (!fori) return;
      // (i ruoli di serie, senza il colore dei fori: non è né il pannello né un livello di macchie)
      ruoliDiSerie((model?.choices ?? []).filter((c) => c.color?.toLowerCase() !== fori));
      for (const c of model?.choices ?? []) if (c.color?.toLowerCase() === fori) ruoli[c.id] = '';
      buildPanel();
      disegnaContorni();
      daRifare();
    },
    sorgente: () => source?.text ?? null,
    // col raso fatto da Stilista (rasoDiStilista) ogni stop del raso torna come riempimenti, uno per macchia
    strati: () => {
      if (!risultato || superato) throw new Error(risultato ? 'i parametri sono cambiati: premi Genera' : 'premi prima Genera');
      const cuciti = stratiCuciti(strati());
      if (!risultato || !par.rasoDiStilista) return cuciti;
      const perZona = new Map(macchiePerStilista(risultato).map((z) => [`raso${z.strato > 1 ? z.strato : ''}-${z.zona + 1}`, z.macchie]));
      return cuciti.map((s) => {
        const forme = s.nome ? perZona.get(s.nome) : undefined;
        return forme ? { ...s, polylines: [], riempimenti: { orientamentoDeg: s.nome?.startsWith('raso3-') ? par.rasoAngolo3 : s.nome?.startsWith('raso2-') ? par.rasoAngolo2 : par.rasoAngolo, forme } } : s;
      });
    },
    dst() {
      if (!risultato || superato) throw new Error(risultato ? 'i parametri sono cambiati: premi Genera' : 'premi prima Genera');
      return { bytes: costruisciDst(), nome: `${nomeBase()}-macchie` };
    },
    stato: (testo) => { $('status').textContent = testo; },
  };

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
  /** Il disegno caricato per la busta di progetto (K2): nome e misura reale in mm. */
  function sorgenteBusta() {
    if (!source) return undefined;
    const b = model?.source?.finalBoundsMm;
    return { tipo: /\.dxf$/i.test(source.name) ? 'dxf' as const : 'svg' as const, nome: source.name,
      ...(b ? { larghezzaMm: b.maxX - b.minX, altezzaMm: b.maxY - b.minY } : {}) };
  }

  /** Riapre un progetto; con `soloPunto` ne prende solo pattern e parametri, e il disegno resta quello di adesso. */
  function riapri(meta: Record<string, unknown>, soloPunto = false): void {
    const drawing = meta.drawing as { name?: string; text?: string; scale?: { scaleMode?: string } } | undefined;
    if (meta.params && typeof meta.params === 'object') Object.assign(par, PARAMETRI_MACCHIE, conQuelliDiPrima({ sovrapposti: false, tagliaOltre: 0, ...(meta.params as Partial<ParametriMacchie>) }));
    const p = meta.pattern as { nome?: string; config?: PatternConfig } | undefined;
    if (p?.config) pattern = { nome: p.nome ?? 'dal file', config: p.config };
    if (soloPunto) { buildPanel(); daRifare(); return; }
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
      daRifare();
    }
  }

  function leggiFile(file: File, comeByte: boolean, fatto: (r: string | ArrayBuffer) => void) {
    const reader = new FileReader();
    reader.onload = () => fatto(reader.result as string | ArrayBuffer);
    if (comeByte) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }

  function wirePanel() {
    root.querySelector('#fromStilista')?.addEventListener('click', () => { void prendiSelezioneStilista(aggancio); });
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
    /** Il progetto dentro un DST o un SVG uscito da qui: `fatto` riceve i metadati; gli errori si scrivono in `stato`. */
    const leggiProgetto = (idInput: string, stato: string, fatto: (meta: Record<string, unknown>, nome: string) => void) => {
      $(idInput).addEventListener('change', (ev) => {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const isDst = /\.dst$/i.test(file.name);
        leggiFile(file, isDst, (letto) => {
          try {
            const meta = isDst ? readDstMetadata(new Uint8Array(letto as ArrayBuffer)) : (readProjectMetadata(String(letto)) as Record<string, unknown> | null);
            if (meta?.rgProject !== 'pattern-macchie') {
              $(stato).textContent = meta
                ? `Questo file viene da "${String(meta.rgProject ?? 'un altro tool')}", non da qui.`
                : 'Nessun progetto dentro questo file: non è uscito dalla suite.';
              return;
            }
            fatto(meta, file.name);
          } catch (e) {
            $(stato).textContent = 'Errore: ' + (e as Error).message;
          }
          input.value = '';
        });
      });
    };
    leggiProgetto('reopenFile', 'reopenStatus', (meta, nome) => {
      riapri(meta);
      $('reopenStatus').textContent = `${nome}: riaperto` + (meta.drawing ? ' col disegno.' : ' — senza disegno: caricalo a parte.');
    });
    leggiProgetto('puntoFile', 'puntoStatus', (meta, nome) => {
      riapri(meta, true);
      $('puntoStatus').textContent = `${nome}: presi il pattern «${pattern.nome}» e i parametri; il disegno è quello di prima.`;
    });
    root.querySelector('#presetList')?.addEventListener('change', () => {
      const raw = ($('presetList') as HTMLSelectElement).value;
      const sep = raw.indexOf(':');
      const origine = raw.slice(0, sep), nome = raw.slice(sep + 1);
      const config = origine === 'shared' ? PRESET_CONDIVISI[nome] : origine === 'local' ? presetLocali()[nome] : pattern.config;
      if (!config) return;
      pattern = { nome, config };
      buildPanel();
      daRifare();
    });
    wireLivelli(root);
  }
  function wireLivelli(dove: ParentNode) {
    for (const inp of dove.querySelectorAll<HTMLInputElement>('input[data-livello]')) {
      inp.addEventListener('change', () => { visibili[inp.dataset.livello as ChiaveFilo | 'salti' | 'contorni'] = inp.checked; disegna(); });
    }
  }
  /**
   * A calcolo finito si rifà solo il Programma: il resto del pannello resta com'è (col calcolo nel worker si può
   * scrivere in un campo mentre si calcola, e rifare tutto il pannello lo cancellerebbe).
   */
  function aggiornaProgramma() {
    const det = $('panel').querySelector<HTMLDetailsElement>('details[data-sezione="programma"]');
    const vecchia = det?.querySelector(':scope > .rg-param-grid');
    if (!det || !vecchia) { buildPanel(); return; }
    const nuova = livelliGrid();
    vecchia.replaceWith(nuova);
    wireLivelli(nuova);
  }

  // ---- azioni fisse ----
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('genBtn').addEventListener('click', genera);
  ($('autoCalcolo') as HTMLInputElement).checked = autoCalcolo;
  $('autoCalcolo').addEventListener('change', () => {
    autoCalcolo = ($('autoCalcolo') as HTMLInputElement).checked;
    try { localStorage.setItem('pattern-macchie.auto', autoCalcolo ? '1' : '0'); } catch { /* idem */ }
    if (autoCalcolo && superato) genera();
  });
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
    for (const p of pannello ?? risultato.forme.flat()) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const svg = buildSvg(strati(), { bounds: { minX: x0, minY: y0, maxX: x1, maxY: y1 }, marginMm: 5, metadata: conBusta(progetto(), { strati: strati(), sorgente: sorgenteBusta() }) });
    const name = `${nomeBase()}-macchie.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name) + notaDisegno;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!risultato) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    let bytes: Uint8Array;
    try {
      bytes = costruisciDst();
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${nomeBase()}-macchie.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB · ${strati().length} stop` + notaDisegno;
  });

  buildPanel();
  // «Invia a Stilista»; e aperto dal pulsante di Stilista (?stilista=…) la selezione si prende da sola.
  // «Prendi la selezione» vive nel pannello, che si ricostruisce: lo ricollega wirePanel.
  collegaStilista(aggancio, { invia: $('toStilistaBtn') });
}

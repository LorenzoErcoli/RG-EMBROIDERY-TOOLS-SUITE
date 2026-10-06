import '@rg/ui/rg.css';
import './razza.css';
import {
  type ImportResult, type Point, type Polyline,
  applyRealWidth, buildSvg, buildSvgInSourceFrame, dstFromExportLayers, DST_FILE,
  parseDxfToContours, parseSvgToContours, pointInPolygon, polygonArea, readDstMetadata, readProjectMetadata,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import ICONS from '../../../packages/design-system/icons/rg-icons.svg?url';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveBinaryFile, saveOutcomeMessage, saveTextFile } from '@rg/ui/save';
import {
  PARAMETRI_RAZZA, VERSIONE_RAZZA, daDiPassaggio, leggiProgetto, pezzoDa, progetto, stratiDaRisultato, stratiPerDst,
  type Fisso, type ParametriRazza, type Pezzo, type Risultato, type Sfumatura,
} from './motore';

// ---------------------------------------------------------------- i campi del pannello

interface CampoNum { chiave: keyof ParametriRazza; etichetta: string; unita?: string; min: number; max: number; aiuto?: string; largo?: boolean }
interface CampoSel { chiave: keyof ParametriRazza; etichetta: string; opzioni: Array<[string, string]>; aiuto?: string }
type Campo = CampoNum | CampoSel;

// Nomi e ordine: parametri canonici della Costituzione §3 dove esistono (minStitchMm, maxStitchMm, densitySpacingMm), il resto
// con le parole di Lorenzo (2026-10-06: «distanza», «pallino minimo», «pallino massimo»). L'unita' sta nello slot, mai nell'etichetta.
const PALLINI: Campo[] = [
  { chiave: 'diamMinMm', etichetta: 'Pallino minimo', unita: 'mm', min: 1, max: 60, aiuto: 'sotto i 3 mm diventa uno zig-zag: ricamato sembra un pallino' },
  { chiave: 'diamMaxMm', etichetta: 'Pallino massimo', unita: 'mm', min: 1, max: 60, aiuto: 'oltre 8 mm il punto lungo si allenta' },
  { chiave: 'gapMm', etichetta: 'Distanza fra i pallini', unita: 'mm', min: -1, max: 10, aiuto: 'più è piccola, meno si vedono i passaggi; negativa = si sovrappongono un poco' },
  { chiave: 'densitySpacingMm', etichetta: 'Spaziatura delle file', unita: 'mm', min: 0.1, max: 2, aiuto: 'tra una riga di filo e la successiva dentro il pallino' },
  { chiave: 'minStitchMm', etichetta: 'Punto minimo', unita: 'mm', min: 0.3, max: 3 },
  { chiave: 'maxStitchMm', etichetta: 'Punto massimo', unita: 'mm', min: 1, max: 12.1, aiuto: 'vale anche per i passaggi' },
];
const DISPOSIZIONE: Campo[] = [
  { chiave: 'modoCampo', etichetta: 'Misura dei pallini', opzioni: [['bordo', 'Piccoli ai bordi, grandi al centro'], ['uniforme', 'Tutti uguali']] },
  { chiave: 'profonditaMm', etichetta: 'Distanza dal bordo del pallino massimo', unita: 'mm', min: 0, max: 500, aiuto: '0 = automatico (quanto è profondo il pezzo)' },
  { chiave: 'curvaBordo', etichetta: 'Curva della sfumatura', min: 0.3, max: 4, aiuto: '1 = lineare; più alta = piccoli più a lungo vicino al bordo' },
  { chiave: 'rumoreCampo', etichetta: 'Chiazze', min: 0, max: 1, aiuto: '0 = tutto regolare; più alto = macchie di grandi e piccoli' },
  { chiave: 'scalaCampoMm', etichetta: 'Dimensione delle chiazze', unita: 'mm', min: 5, max: 400 },
  { chiave: 'irregolarita', etichetta: 'Irregolarità', min: 0, max: 1, aiuto: 'caso per caso, attorno alla misura voluta' },
  { chiave: 'pesoSfumature', etichetta: 'Peso delle linee di sfumatura', min: 0, max: 1, aiuto: '1 = comandano loro; 0 = le ignora e conta solo il bordo' },
  { chiave: 'influenzaFissiMm', etichetta: 'Raggio dei pallini fissi', unita: 'mm', min: 1, max: 500, aiuto: 'fin dove la misura di un fisso tira quella dei vicini' },
];
const AVANZATE: Campo[] = [
  { chiave: 'aspetto', etichetta: 'Larghezza / lunghezza', min: 0.3, max: 1.5, aiuto: '1 = tondo' },
  { chiave: 'profilo', etichetta: 'Forma del profilo', min: 1, max: 6, aiuto: '2 = ellisse, 1 = losanga, più alto = più squadrato' },
  { chiave: 'modoAngolo', etichetta: 'Asse del cordoncino', opzioni: [['percorso', 'Lungo il percorso (passaggi più nascosti)'], ['casuale', 'A caso']] },
  { chiave: 'modoPassaggio', etichetta: 'Passaggio fra i pallini', opzioni: [['scegli', 'Il meno visibile'], ['dentro', 'Dentro il pallino cucito'], ['diretto', 'Dritto']] },
  { chiave: 'pesoSopra', etichetta: 'Costo del filo sopra il cucito', min: 0, max: 20, aiuto: 'rispetto a 10 per un mm in vista' },
  { chiave: 'margineMm', etichetta: 'Margine dal bordo', unita: 'mm', min: 0, max: 20 },
  { chiave: 'crescita', etichetta: 'Crescita oltre la misura voluta', min: 1, max: 3, aiuto: 'quanto un pallino può allargarsi per toccare i vicini' },
  { chiave: 'rapportoMinimo', etichetta: 'Rimpicciolimento nei buchi', min: 0.1, max: 1, aiuto: 'quanto può restringersi per entrare dove non c’è posto' },
  { chiave: 'seed', etichetta: 'Seme del caso', min: 0, max: 99999, aiuto: 'stesso seme = stesso ricamo' },
];

const fmt = (v: number): string => String(Math.round(v * 1000) / 1000).replace('.', ',');
const leggi = (s: string): number => parseFloat(s.trim().replace(',', '.'));

type Modo = 'seleziona' | 'pallino' | 'sfumatura';
type Selezione = { tipo: 'fisso' | 'sfumatura'; i: number } | null;

/** Un pezzo demo, per partire subito: un'ellisse con un'area vuota. */
function pezzoDemo(): Pezzo {
  const el: Polyline = []; for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2; el.push({ x: 70 + 70 * Math.cos(a), y: 45 + 45 * Math.sin(a) }); }
  const vuoto: Polyline = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; vuoto.push({ x: 95 + 12 * Math.cos(a), y: 50 + 12 * Math.sin(a) }); }
  return pezzoDa(el, [vuoto]);
}

/** Dal risultato di un import al pezzo: il contorno chiuso piu' grande e, dentro, quelli chiusi piu' piccoli come aree vuote. */
function pezzoDaContorni(contorni: ImportResult['contours']): { pezzo: Pezzo | null; aperte: Polyline[]; chiusi: number } {
  const quasiChiuso = (p: Polyline): boolean => p.length >= 3 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 5;
  const chiusi = contorni.filter((c) => c.points.length >= 3 && (c.closed || quasiChiuso(c.points))).map((c) => c.points)
    .sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  const aperte = contorni.filter((c) => c.points.length >= 2 && !c.closed && !quasiChiuso(c.points)).map((c) => c.points);
  if (!chiusi.length) return { pezzo: null, aperte, chiusi: 0 };
  const perimetro = chiusi[0];
  const vuoti = chiusi.slice(1).filter((p) => pointInPolygon(p[0], perimetro));
  return { pezzo: pezzoDa(perimetro, vuoti), aperte, chiusi: chiusi.length };
}

/** Monta il tool "Pelle di razza" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountRazza(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const icona = (nome: string): string => `<svg class="rg-icon" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-${nome}"></use></svg>`;
  const campiHtml = (id: string): string => `<div id="${id}" class="rg-param-grid"></div>`;
  root.innerHTML = `
  ${topbar('Pelle di razza', opts.backHref)}
  <div class="rg-workspace razza-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Sagoma</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="fileInput" accept=".dxf,.svg,.dst" />
              <span class="rg-button rg-button--outline">Carica DXF o SVG…</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus" role="status">Nessun file: uso la sagoma demo.</p>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Larghezza reale (0 = auto)</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="realWidth" type="text" inputmode="decimal" value="0"><span>mm</span></span>
            <span class="rg-field__help">0 = usa la misura letta dal file.</span>
          </label>
          <div class="rg-cluster rg-param-grid__wide">
            <button id="demoBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Sagoma demo</button>
            <button id="apertaBtn" class="rg-button rg-button--ghost rg-button--small" type="button" hidden>Usa le linee aperte come sfumature</button>
          </div>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" data-sez="pallini" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">02</span><span class="rg-param-section__title">Pallini</span></summary>
        ${campiHtml('campiPallini')}
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="disposizione">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Disposizione</span></summary>
        ${campiHtml('campiDisposizione')}
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="interventi">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Interventi</span></summary>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lblStrumento">Strumento sull’anteprima</span>
            <div class="rg-segmented" id="strumenti" role="group" aria-labelledby="lblStrumento">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-modo="seleziona" aria-pressed="true">Seleziona</button>
              <button type="button" class="rg-segmented__item" data-modo="pallino" aria-pressed="false">Pallino fisso</button>
              <button type="button" class="rg-segmented__item" data-modo="sfumatura" aria-pressed="false">Sfumatura</button>
            </div>
            <span class="rg-field__help" id="aiutoStrumento"></span>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Diametro del prossimo pallino fisso</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="nuovoDiam" type="text" inputmode="decimal" value="6"><span>mm</span></span>
          </label>
          <div class="rg-param-grid__wide">
            <span class="rg-field__label">Pallini fissi</span>
            <ul class="rg-color-map" id="listaFissi"></ul>
          </div>
          <div class="rg-param-grid__wide">
            <span class="rg-field__label">Linee di sfumatura</span>
            <ul class="rg-color-map" id="listaSfumature"></ul>
          </div>
          <p class="rg-field__help rg-param-grid__wide" id="avvisi" role="status"></p>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="avanzate">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Avanzate</span></summary>
        ${campiHtml('campiAvanzate')}
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="preset">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">06</span><span class="rg-param-section__title">Preset</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome del preset</span><input class="rg-input" id="presetNome" type="text" /></label>
          <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Preset salvati</span><select class="rg-select" id="presetLista"></select></label>
          <div class="rg-cluster rg-param-grid__wide">
            <button id="presetSalva" class="rg-button rg-button--secondary rg-button--small" type="button">Salva</button>
            <button id="presetCarica" class="rg-button rg-button--ghost rg-button--small" type="button">Carica</button>
            <button id="presetElimina" class="rg-button rg-button--ghost rg-button--small" type="button">Elimina</button>
            <button id="presetEsporta" class="rg-button rg-button--ghost rg-button--small" type="button">Esporta file</button>
            <label class="rg-file-input__control"><input type="file" id="presetImporta" accept=".json" hidden><span class="rg-button rg-button--ghost rg-button--small">Importa file</span></label>
          </div>
        </div>
      </details>
    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <label class="rg-choice" title="Se è spenta, il ricamo si rifà solo quando premi Genera: così puoi mettere pallini e sfumature senza aspettare."><input type="checkbox" id="autoCalcolo"><span>Ricalcola da solo</span></label>
          <button id="genBtn" class="rg-button rg-button--primary rg-button--small" type="button">Genera</button>
          <button id="exportBtn" class="rg-button rg-button--outline rg-button--small" type="button" disabled>Esporta SVG</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small" type="button" disabled>Esporta DST</button>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Adatta</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">Pronto</span>
        <span id="misure" class="rg-mono"></span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => root.querySelector<T>('#' + id)!;

  // ---------------------------------------------------------------- lo stato
  let pezzo: Pezzo = pezzoDemo();
  const par: ParametriRazza = { ...PARAMETRI_RAZZA };
  let fissi: Fisso[] = [];
  let sfumature: Sfumatura[] = [];
  let risultato: Risultato | null = null;
  let modo: Modo = 'seleziona';
  let selezione: Selezione = null;
  let importato: ImportResult | null = null;
  let aperte: Polyline[] = [];
  let nomeFile = '';
  let larghezzaReale = 0;
  let fattoreScala = 1;

  // ---------------------------------------------------------------- il pannello
  const salvaApertura = (): void => {
    try { const o: Record<string, boolean> = {}; root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => { o[d.dataset.sez as string] = d.open; }); localStorage.setItem('razza.sezioni', JSON.stringify(o)); } catch { /* senza archivio il pannello resta com'e' */ }
  };
  try {
    const o = JSON.parse(localStorage.getItem('razza.sezioni') ?? 'null') as Record<string, boolean> | null;
    if (o) root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => { if (o[d.dataset.sez as string] !== undefined) d.open = o[d.dataset.sez as string]; });
  } catch { /* idem */ }
  root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => d.addEventListener('toggle', salvaApertura));

  function costruisciCampi(host: HTMLElement, campi: Campo[]): void {
    host.innerHTML = '';
    for (const c of campi) {
      const lab = document.createElement('label');
      lab.className = 'rg-field' + (c.aiuto ? ' rg-param-grid__wide' : '');
      const nome = document.createElement('span'); nome.className = 'rg-field__label'; nome.textContent = c.etichetta;
      lab.appendChild(nome);
      if ('opzioni' in c) {
        lab.classList.add('rg-param-grid__wide');
        const sel = document.createElement('select'); sel.className = 'rg-select';
        for (const [v, l] of c.opzioni) { const o = document.createElement('option'); o.value = v; o.textContent = l; if (String(par[c.chiave]) === v) o.selected = true; sel.appendChild(o); }
        sel.addEventListener('change', () => { (par as unknown as Record<string, unknown>)[c.chiave] = sel.value; pianifica(); });
        lab.appendChild(sel);
      } else {
        const wrap = document.createElement('span'); wrap.className = 'rg-field-with-unit';
        const inp = document.createElement('input'); inp.type = 'text'; inp.setAttribute('inputmode', 'decimal'); inp.className = 'rg-input rg-input--numeric';
        inp.value = fmt(par[c.chiave] as number);
        const aiuto = document.createElement('span'); aiuto.className = 'rg-field__help';
        const testoAiuto = c.aiuto ?? '';
        aiuto.textContent = testoAiuto;
        inp.addEventListener('change', () => {
          const v = leggi(inp.value);
          if (Number.isNaN(v)) { aiuto.textContent = 'Scrivi un numero.'; return; }
          const k = Math.max(c.min, Math.min(c.max, v));
          aiuto.textContent = k !== v ? `Va da ${fmt(c.min)} a ${fmt(c.max)}: ho messo ${fmt(k)}.` : testoAiuto;
          inp.value = fmt(k);
          (par as unknown as Record<string, number>)[c.chiave] = k;
          pianifica();
        });
        wrap.appendChild(inp);
        if (c.unita) { const u = document.createElement('span'); u.textContent = c.unita; wrap.appendChild(u); }
        lab.appendChild(wrap);
        if (c.aiuto) lab.appendChild(aiuto);
      }
      host.appendChild(lab);
    }
  }
  function costruisciPannello(): void {
    costruisciCampi($('campiPallini'), PALLINI);
    costruisciCampi($('campiDisposizione'), DISPOSIZIONE);
    costruisciCampi($('campiAvanzate'), AVANZATE);
  }

  // ---------------------------------------------------------------- l'anteprima
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; disegnaSovrapposti(); });
  const MARGINE_MM = 6;

  const percorso = (poly: Polyline, chiudi: boolean): string => poly.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('') + (chiudi ? 'Z' : '');

  function disegnaAnteprima(): void {
    const w = pezzo.maxX - pezzo.minX + 2 * MARGINE_MM, h = pezzo.maxY - pezzo.minY + 2 * MARGINE_MM;
    const sagome = [percorso(pezzo.contorno, true), ...pezzo.vuoti.map((v) => percorso(v, true))].join('');
    let filo = '', vista = '';
    if (risultato) {
      let corsa = '';
      const chiudiCorsa = (): void => { if (corsa) { filo += corsa; corsa = ''; } };
      for (let i = 1; i < risultato.punti.length; i++) {
        const a = risultato.punti[i - 1], b = risultato.punti[i];
        if (b.vista && daDiPassaggio(a, b) >= 0) { chiudiCorsa(); vista += `M${a.p.x.toFixed(2)} ${a.p.y.toFixed(2)}L${b.p.x.toFixed(2)} ${b.p.y.toFixed(2)}`; continue; }
        corsa += corsa ? `L${b.p.x.toFixed(2)} ${b.p.y.toFixed(2)}` : `M${a.p.x.toFixed(2)} ${a.p.y.toFixed(2)}L${b.p.x.toFixed(2)} ${b.p.y.toFixed(2)}`;
      }
      chiudiCorsa();
    }
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" id="rzSvg" width="${w}mm" height="${h}mm" viewBox="${pezzo.minX - MARGINE_MM} ${pezzo.minY - MARGINE_MM} ${w} ${h}">
      <path class="rz-sagoma" fill-rule="evenodd" d="${sagome}" />
      <path class="rz-filo" d="${filo}" />
      <path class="rz-vista" d="${vista}" />
      <g id="rzOver"></g>
    </svg>`;
    disegnaSovrapposti();
  }

  /** Quanto e' grande un pixel dello schermo, in mm del disegno. */
  function mmPerPixel(): number {
    const svg = root.querySelector<SVGSVGElement>('#rzSvg');
    if (!svg) return 1;
    const m = svg.getScreenCTM();
    return m ? 1 / Math.max(1e-6, Math.hypot(m.a, m.b)) : 1;
  }

  function disegnaSovrapposti(bozza?: { a: Point; b: Point }): void {
    const g = root.querySelector<SVGGElement>('#rzOver');
    if (!g) return;
    const px = mmPerPixel(), rH = 6 * px;
    let s = '';
    fissi.forEach((f, i) => {
      const sel = selezione?.tipo === 'fisso' && selezione.i === i;
      s += `<g class="rz-fisso${sel ? ' is-sel' : ''}"><circle data-hit="fisso:${i}" cx="${f.x}" cy="${f.y}" r="${f.diamMm / 2}" /><circle class="rz-punto" data-hit="fisso:${i}" cx="${f.x}" cy="${f.y}" r="${rH * 0.55}" /><text x="${f.x + rH}" y="${f.y - rH}" font-size="${rH * 1.7}">${i + 1}</text></g>`;
    });
    sfumature.forEach((sf, i) => {
      const sel = selezione?.tipo === 'sfumatura' && selezione.i === i;
      const L = Math.hypot(sf.b.x - sf.a.x, sf.b.y - sf.a.y) || 1, ux = (sf.b.x - sf.a.x) / L, uy = (sf.b.y - sf.a.y) / L;
      const fx = sf.b.x - ux * rH * 2, fy = sf.b.y - uy * rH * 2;
      s += `<g class="rz-sfum${sel ? ' is-sel' : ''}">
        <circle class="rz-misura" cx="${sf.a.x}" cy="${sf.a.y}" r="${sf.diamAMm / 2}" /><circle class="rz-misura" cx="${sf.b.x}" cy="${sf.b.y}" r="${sf.diamBMm / 2}" />
        <line data-hit="sfum:${i}" x1="${sf.a.x}" y1="${sf.a.y}" x2="${sf.b.x}" y2="${sf.b.y}" />
        <path d="M${sf.b.x} ${sf.b.y}L${fx - uy * rH} ${fy + ux * rH}L${fx + uy * rH} ${fy - ux * rH}Z" />
        <circle class="rz-punto" data-hit="sfum-a:${i}" cx="${sf.a.x}" cy="${sf.a.y}" r="${rH * 0.7}" /><circle class="rz-punto rz-punto--b" data-hit="sfum-b:${i}" cx="${sf.b.x}" cy="${sf.b.y}" r="${rH * 0.7}" />
        <text x="${sf.a.x + rH}" y="${sf.a.y - rH}" font-size="${rH * 1.5}">${i + 1}</text></g>`;
    });
    if (bozza) s += `<g class="rz-sfum"><line x1="${bozza.a.x}" y1="${bozza.a.y}" x2="${bozza.b.x}" y2="${bozza.b.y}" /><circle class="rz-punto" cx="${bozza.a.x}" cy="${bozza.a.y}" r="${rH * 0.7}" /></g>`;
    g.innerHTML = s;
  }

  // ---------------------------------------------------------------- il calcolo, in un processo a parte
  let worker: Worker | null = null;
  let idCalcolo = 0, timer = 0, tInizio = 0, tick = 0;

  /**
   * Una modifica. Di default NON ricalcola: segna il ricamo come vecchio e aspetta che Lorenzo premi Genera, cosi' puo' mettere
   * pallini e sfumature senza aspettare qualche secondo a ogni clic (2026-10-06). Con «Ricalcola da solo» aspetta che smetta
   * di toccare per un secondo e mezzo. `subito` = un'azione che ha senso solo col ricamo fresco (nuovo pezzo, Genera).
   */
  let autoCalcolo = false;
  try { autoCalcolo = localStorage.getItem('razza.auto') === '1'; } catch { /* senza archivio resta spento */ }
  ($('autoCalcolo') as HTMLInputElement).checked = autoCalcolo;
  ($('autoCalcolo') as HTMLInputElement).addEventListener('change', () => {
    autoCalcolo = ($('autoCalcolo') as HTMLInputElement).checked;
    try { localStorage.setItem('razza.auto', autoCalcolo ? '1' : '0'); } catch { /* idem */ }
    if (autoCalcolo && vecchio) pianifica();
  });
  let vecchio = false;

  /** Il ricamo che si vede non e' piu' quello dei parametri: un calcolo in corso e' da buttare, e l'export non e' piu' fedele. */
  function invalida(): void {
    idCalcolo++;
    worker?.terminate(); worker = null;
    window.clearInterval(tick);
    vecchio = true;
    ($('exportBtn') as HTMLButtonElement).disabled = true;
    ($('exportDstBtn') as HTMLButtonElement).disabled = true;
    $('genBtn').classList.toggle('rg-button--primary', true);
  }

  function pianifica(subito = false): void {
    window.clearTimeout(timer);
    if (subito) { genera(); return; }
    invalida();
    if (autoCalcolo) { $('status').textContent = 'Da ricalcolare…'; timer = window.setTimeout(genera, 1500); }
    else $('status').textContent = 'Modificato: premi Genera per ricalcolare';
    $('misure').classList.add('razza-vecchio');
  }

  function genera(): void {
    window.clearTimeout(timer);
    idCalcolo++;
    worker?.terminate(); // un calcolo vecchio non serve piu': si butta via invece di aspettarlo
    worker = new Worker(new URL('./razza.worker.ts', import.meta.url), { type: 'module' });
    const mioId = idCalcolo;
    tInizio = Date.now();
    window.clearInterval(tick);
    tick = window.setInterval(() => { $('status').textContent = `Calcolo… ${Math.round((Date.now() - tInizio) / 1000)} s`; }, 500);
    $('status').textContent = 'Calcolo…';
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.id !== mioId) return;
      window.clearInterval(tick);
      if (e.data.error) { $('status').textContent = 'Errore: ' + e.data.error; return; }
      risultato = e.data.result as Risultato;
      vecchio = false; $('misure').classList.remove('razza-vecchio');
      disegnaAnteprima();
      mostraMisure();
      ($('exportBtn') as HTMLButtonElement).disabled = !risultato.punti.length;
      ($('exportDstBtn') as HTMLButtonElement).disabled = !risultato.punti.length;
    };
    worker.onerror = (e) => { window.clearInterval(tick); $('status').textContent = 'Errore nel calcolo: ' + e.message; };
    worker.postMessage({ id: mioId, pezzo, par: { ...par }, fissi: fissi.map((f) => ({ ...f })), sfumature: sfumature.map((s) => ({ ...s, a: { ...s.a }, b: { ...s.b } })) });
  }

  function mostraMisure(): void {
    if (!risultato) return;
    const m = risultato.misure;
    const n = (v: number): string => v.toLocaleString('it-IT');
    $('status').textContent = `Fatto in ${(m.millisecondi / 1000).toFixed(1)} s`;
    $('misure').textContent = `${n(m.tondini)} pallini · ${m.copertoPercento.toFixed(0)}% · ${n(m.punti)} punti · ${m.filoM.toFixed(1)} m · in vista ${m.vistaGiuntura.mediana.toFixed(2)} mm (max ${m.vistaGiuntura.max.toFixed(1)})`;
    $('avvisi').textContent = risultato.avvisi.join(' ');
  }

  // ---------------------------------------------------------------- pallini fissi e sfumature: le liste
  const campoCompatto = (valore: number, etichetta: string, onChange: (v: number) => void): HTMLElement => {
    const w = document.createElement('span'); w.className = 'rg-field-with-unit rg-field-with-unit--compact';
    const i = document.createElement('input'); i.type = 'text'; i.setAttribute('inputmode', 'decimal'); i.className = 'rg-input rg-input--numeric'; i.value = fmt(valore); i.setAttribute('aria-label', etichetta);
    i.addEventListener('change', () => { const v = leggi(i.value); if (!Number.isNaN(v) && v > 0) onChange(v); else i.value = fmt(valore); });
    const u = document.createElement('span'); u.textContent = 'mm';
    w.append(i, u); return w;
  };
  const bottoneElimina = (etichetta: string, onClick: () => void): HTMLElement => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rg-icon-button rg-icon-button--danger rg-icon-button--full'; b.setAttribute('aria-label', etichetta);
    b.innerHTML = icona('elimina'); b.addEventListener('click', onClick); return b;
  };

  function costruisciListe(): void {
    const lf = $('listaFissi'), ls = $('listaSfumature');
    lf.innerHTML = fissi.length ? '' : '<li><p class="rg-color-map__empty">Nessuno. Scegli «Pallino fisso» e fai clic sull’anteprima.</p></li>';
    fissi.forEach((f, i) => {
      const li = document.createElement('li'); li.className = 'rg-color-map__row' + (selezione?.tipo === 'fisso' && selezione.i === i ? ' is-selected' : '');
      const sw = document.createElement('span'); sw.className = 'rg-color-map__swatch rg-color-map__swatch--none';
      const code = document.createElement('span'); code.className = 'rg-color-map__code'; code.innerHTML = `Fisso ${i + 1} <span class="rg-color-map__meta">x ${fmt(f.x)} · y ${fmt(f.y)}</span>`;
      const aside = document.createElement('span'); aside.className = 'rg-color-map__aside rg-cluster';
      aside.append(campoCompatto(f.diamMm, `Diametro del pallino fisso ${i + 1} in mm`, (v) => { f.diamMm = v; disegnaSovrapposti(); pianifica(); }),
        bottoneElimina(`Elimina il pallino fisso ${i + 1}`, () => { fissi.splice(i, 1); selezione = null; costruisciListe(); disegnaSovrapposti(); pianifica(); }));
      li.append(sw, code, aside);
      li.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('input,button')) return; selezione = { tipo: 'fisso', i }; costruisciListe(); disegnaSovrapposti(); });
      lf.appendChild(li);
    });
    ls.innerHTML = sfumature.length ? '' : '<li><p class="rg-color-map__empty">Nessuna. Scegli «Sfumatura» e trascina sull’anteprima: da piccolo (A) a grande (B).</p></li>';
    sfumature.forEach((s, i) => {
      const li = document.createElement('li'); li.className = 'rg-color-map__row' + (selezione?.tipo === 'sfumatura' && selezione.i === i ? ' is-selected' : '');
      const sw = document.createElement('span'); sw.className = 'rg-color-map__swatch rg-color-map__swatch--none';
      const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      const code = document.createElement('span'); code.className = 'rg-color-map__code'; code.innerHTML = `Sfumatura ${i + 1} <span class="rg-color-map__meta">lunga ${fmt(L)} mm</span>`;
      const aside = document.createElement('span'); aside.className = 'rg-color-map__aside rg-cluster';
      const inverti = document.createElement('button'); inverti.type = 'button'; inverti.className = 'rg-button rg-button--ghost rg-button--small'; inverti.textContent = 'Inverti';
      inverti.addEventListener('click', () => { [s.a, s.b] = [s.b, s.a]; [s.diamAMm, s.diamBMm] = [s.diamBMm, s.diamAMm]; costruisciListe(); disegnaSovrapposti(); pianifica(); });
      aside.append(campoCompatto(s.diamAMm, `Diametro in A della sfumatura ${i + 1} in mm`, (v) => { s.diamAMm = v; disegnaSovrapposti(); pianifica(); }),
        campoCompatto(s.diamBMm, `Diametro in B della sfumatura ${i + 1} in mm`, (v) => { s.diamBMm = v; disegnaSovrapposti(); pianifica(); }),
        inverti, bottoneElimina(`Elimina la sfumatura ${i + 1}`, () => { sfumature.splice(i, 1); selezione = null; costruisciListe(); disegnaSovrapposti(); pianifica(); }));
      li.append(sw, code, aside);
      li.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('input,button')) return; selezione = { tipo: 'sfumatura', i }; costruisciListe(); disegnaSovrapposti(); });
      ls.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- gli strumenti sull'anteprima
  const AIUTI: Record<Modo, string> = {
    seleziona: 'Trascina un pallino fisso o i capi di una sfumatura per spostarli. Trascina lo sfondo (o tieni Spazio) per spostare la vista.',
    pallino: 'Fai clic dove vuoi un pallino: avrà il diametro scritto qui sopra. Il resto del ricamo nasce da lì.',
    sfumatura: 'Trascina da A a B: piccolo in A, grande in B. Il verso è quello in cui trascini.',
  };
  function impostaModo(m: Modo): void {
    modo = m;
    root.querySelectorAll<HTMLElement>('#strumenti .rg-segmented__item').forEach((b) => {
      const on = b.dataset.modo === m; b.classList.toggle('rg-segmented__item--active', on); b.setAttribute('aria-pressed', String(on));
    });
    $('aiutoStrumento').textContent = AIUTI[m];
    const c = $('canvas'); c.classList.remove('razza-modo-pallino', 'razza-modo-sfumatura'); if (m !== 'seleziona') c.classList.add('razza-modo-' + m);
  }
  root.querySelectorAll<HTMLElement>('#strumenti .rg-segmented__item').forEach((b) => b.addEventListener('click', () => impostaModo(b.dataset.modo as Modo)));

  const nuovoDiametro = (): number => { const v = leggi(($('nuovoDiam') as HTMLInputElement).value); return Number.isNaN(v) || v <= 0 ? 6 : v; };

  function aMm(e: PointerEvent): Point {
    const svg = root.querySelector<SVGSVGElement>('#rzSvg')!;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  let spazio = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,select,textarea,button')) spazio = true;
    if (e.key === 'Escape') { selezione = null; impostaModo('seleziona'); costruisciListe(); disegnaSovrapposti(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selezione && !(e.target as HTMLElement).closest('input,select,textarea')) {
      if (selezione.tipo === 'fisso') fissi.splice(selezione.i, 1); else sfumature.splice(selezione.i, 1);
      selezione = null; costruisciListe(); disegnaSovrapposti(); pianifica(); e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spazio = false; });

  type Trascina = { tipo: 'fisso' | 'sfum-a' | 'sfum-b' | 'sfum' | 'nuova'; i: number; da?: Point; copia?: Sfumatura };
  let trascina: Trascina | null = null;

  // in cattura e PRIMA del pan: se l'azione e' dello strumento, il pan non parte
  $('canvas').addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || spazio || !root.querySelector('#rzSvg')) return;
    const hit = (e.target as Element).closest('[data-hit]') as SVGElement | null;
    const p = aMm(e);
    if (hit) {
      const [t, is] = (hit.dataset.hit as string).split(':'); const i = Number(is);
      selezione = t === 'fisso' ? { tipo: 'fisso', i } : { tipo: 'sfumatura', i };
      trascina = { tipo: t as Trascina['tipo'], i, da: p, copia: t.startsWith('sfum') ? JSON.parse(JSON.stringify(sfumature[i])) : undefined };
      costruisciListe(); disegnaSovrapposti();
    } else if (modo === 'pallino') {
      fissi.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, diamMm: nuovoDiametro() });
      selezione = { tipo: 'fisso', i: fissi.length - 1 };
      costruisciListe(); disegnaSovrapposti(); pianifica();
    } else if (modo === 'sfumatura') {
      trascina = { tipo: 'nuova', i: -1, da: p };
    } else return; // seleziona sullo sfondo: pan
    $('canvas').setPointerCapture(e.pointerId);
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);

  $('canvas').addEventListener('pointermove', (e: PointerEvent) => {
    if (!trascina) return;
    const p = aMm(e);
    if (trascina.tipo === 'nuova') { disegnaSovrapposti({ a: trascina.da as Point, b: p }); return; }
    if (trascina.tipo === 'fisso') { fissi[trascina.i].x = Math.round(p.x * 10) / 10; fissi[trascina.i].y = Math.round(p.y * 10) / 10; }
    else {
      const s = sfumature[trascina.i], c = trascina.copia as Sfumatura, d = trascina.da as Point;
      if (trascina.tipo === 'sfum-a') s.a = p; else if (trascina.tipo === 'sfum-b') s.b = p;
      else { const dx = p.x - d.x, dy = p.y - d.y; s.a = { x: c.a.x + dx, y: c.a.y + dy }; s.b = { x: c.b.x + dx, y: c.b.y + dy }; }
    }
    disegnaSovrapposti();
  });
  const finisciTrascina = (e: PointerEvent): void => {
    if (!trascina) return;
    const t = trascina; trascina = null;
    try { $('canvas').releasePointerCapture(e.pointerId); } catch { /* gia' rilasciato */ }
    if (t.tipo === 'nuova') {
      const a = t.da as Point, b = aMm(e);
      if (Math.hypot(b.x - a.x, b.y - a.y) >= 3) {
        sfumature.push({ a, b, diamAMm: par.diamMinMm, diamBMm: par.diamMaxMm });
        selezione = { tipo: 'sfumatura', i: sfumature.length - 1 };
        costruisciListe(); pianifica();
      }
      disegnaSovrapposti(); return;
    }
    costruisciListe(); disegnaSovrapposti(); pianifica();
  };
  $('canvas').addEventListener('pointerup', finisciTrascina);
  $('canvas').addEventListener('pointercancel', finisciTrascina);

  // ---------------------------------------------------------------- caricare una sagoma o un progetto
  function nuovoPezzo(p: Pezzo, etichetta: string, azzera = true): void {
    pezzo = p;
    if (azzera) { fissi = []; sfumature = []; selezione = null; }
    costruisciListe();
    risultato = null; ($('exportBtn') as HTMLButtonElement).disabled = true; ($('exportDstBtn') as HTMLButtonElement).disabled = true;
    $('misure').textContent = '';
    disegnaAnteprima(); pz.fit();
    $('apertaBtn').hidden = aperte.length === 0;
    $('fileStatus').textContent = `${etichetta}: ${Math.round(p.maxX - p.minX)}×${Math.round(p.maxY - p.minY)} mm${p.vuoti.length ? ` · ${p.vuoti.length} aree vuote` : ''}${aperte.length ? ` · ${aperte.length} linee aperte` : ''}`;
    pianifica(true);
  }

  /** Ricalcola il pezzo dall'import applicando la larghezza reale (R11) e spostando di pari passo fissi e sfumature. */
  function applicaImport(etichetta: string, azzera: boolean): void {
    if (!importato) return;
    const nuovo = importato.widthMm > 0 && larghezzaReale > 0 ? larghezzaReale / importato.widthMm : 1;
    const contorni = applyRealWidth(importato, larghezzaReale);
    const { pezzo: p, aperte: ap, chiusi } = pezzoDaContorni(contorni);
    aperte = ap;
    if (!p) { $('fileStatus').textContent = `${etichetta}: nessun contorno chiuso (${contorni.length} linee). Serve il contorno del pezzo.`; return; }
    if (!azzera && nuovo !== fattoreScala) {
      const k = nuovo / fattoreScala;
      fissi.forEach((f) => { f.x *= k; f.y *= k; f.diamMm *= k; });
      sfumature.forEach((s) => { s.a = { x: s.a.x * k, y: s.a.y * k }; s.b = { x: s.b.x * k, y: s.b.y * k }; s.diamAMm *= k; s.diamBMm *= k; });
    }
    fattoreScala = nuovo;
    nuovoPezzo(p, etichetta, azzera);
    if (chiusi > 1 && p.vuoti.length === 0) $('fileStatus').textContent += ' · gli altri contorni chiusi stanno fuori dal contorno grande: li ignoro';
  }

  /** Rimette in piedi un progetto uscito da qui: parametri, pallini fissi, sfumature e il pezzo. */
  function riapriProgetto(meta: Record<string, unknown>, nome: string): boolean {
    const pr = leggiProgetto(meta);
    if (!pr) return false;
    Object.assign(par, pr.params);
    fissi = pr.fissi; sfumature = pr.sfumature; selezione = null;
    if (pr.contorno.length >= 3) { importato = null; fattoreScala = 1; aperte = []; nuovoPezzo(pezzoDa(pr.contorno, pr.vuoti), nome, false); }
    costruisciPannello(); costruisciListe(); disegnaSovrapposti();
    $('fileStatus').textContent = `${nome}: progetto riaperto (${pr.fissi.length} fissi, ${pr.sfumature.length} sfumature)`;
    return true;
  }

  $('fileInput').addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const isDst = /\.dst$/i.test(file.name), isDxf = /\.dxf$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        nomeFile = file.name.replace(/\.[^.]+$/, '');
        if (isDst) {
          const meta = readDstMetadata(new Uint8Array(reader.result as ArrayBuffer));
          if (!meta || !riapriProgetto(meta, file.name)) $('fileStatus').textContent = `${file.name}: nessun progetto di questo tool nel DST`;
          return;
        }
        const testo = String(reader.result);
        if (!isDxf) { const meta = readProjectMetadata(testo); if (meta && riapriProgetto(meta, file.name)) return; }
        importato = isDxf ? parseDxfToContours(testo) : parseSvgToContours(testo);
        if (!importato.contours.length) { $('fileStatus').textContent = `${file.name}: nessun contorno letto${isDxf ? '' : ' (e non è un SVG di questa suite)'}`; return; }
        fattoreScala = importato.widthMm > 0 && larghezzaReale > 0 ? larghezzaReale / importato.widthMm : 1;
        applicaImport(file.name, true);
      } catch (e) {
        $('fileStatus').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file, isDxf ? 'windows-1252' : 'utf-8');
  });

  $('realWidth').addEventListener('change', () => {
    const v = leggi(($('realWidth') as HTMLInputElement).value);
    larghezzaReale = Number.isNaN(v) ? 0 : Math.max(0, v);
    ($('realWidth') as HTMLInputElement).value = fmt(larghezzaReale);
    applicaImport(nomeFile || 'Sagoma', false);
  });
  $('demoBtn').addEventListener('click', () => { importato = null; aperte = []; fattoreScala = 1; nomeFile = ''; nuovoPezzo(pezzoDemo(), 'Sagoma demo'); });
  $('apertaBtn').addEventListener('click', () => {
    for (const l of aperte) sfumature.push({ a: l[0], b: l[l.length - 1], diamAMm: par.diamMinMm, diamBMm: par.diamMaxMm });
    aperte = []; $('apertaBtn').hidden = true; costruisciListe(); disegnaSovrapposti(); pianifica();
  });
  $('genBtn').addEventListener('click', () => pianifica(true));
  $('fitBtn').addEventListener('click', () => pz.fit());
  ($('nuovoDiam') as HTMLInputElement).addEventListener('change', () => { ($('nuovoDiam') as HTMLInputElement).value = fmt(nuovoDiametro()); });

  // ---------------------------------------------------------------- esportare
  const datiProgetto = () => progetto(par, pezzo, fissi, sfumature);
  const nomeBase = (): string => nomeFile || 'pelle-di-razza';

  $('exportBtn').addEventListener('click', async () => {
    if (!risultato || !risultato.punti.length) return;
    const chiusa = (p: Polyline): Polyline => [...p, p[0]];
    const layers = [...stratiDaRisultato(risultato), { id: 'sagoma', color: '#8a8a8a', polylines: [chiusa(pezzo.contorno), ...pezzo.vuoti.map(chiusa)], strokeMm: 0.3, shapeOnly: true }];
    const metadata = datiProgetto();
    const svg = importato?.frame
      ? buildSvgInSourceFrame(layers, { frame: importato.frame, realWidthFactor: importato.widthMm > 0 && larghezzaReale > 0 ? larghezzaReale / importato.widthMm : 1, metadata: metadata as unknown as Record<string, unknown> })
      : buildSvg(layers, { bounds: { minX: pezzo.minX, minY: pezzo.minY, maxX: pezzo.maxX, maxY: pezzo.maxY }, marginMm: 8, metadata: metadata as unknown as Record<string, unknown> });
    const name = `${nomeBase()}-razza.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!risultato || !risultato.punti.length) return;
    // Il tracciato e' gia' sulla griglia da 0,1 mm del DST e centrato su un multiplo di 0,1: se no il centraggio ri-arrotonda
    // e il punto minimo non tiene piu' (R3). I parametri viaggiano nel footer (R27).
    const { layers } = stratiPerDst(risultato);
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(layers, { label: (nomeBase() || 'RAZZA').toUpperCase().slice(0, 16), center: false, metadata: datiProgetto() as unknown as Record<string, unknown> });
    } catch (e) { $('status').textContent = (e as Error).message; return; }
    const name = `${nomeBase()}-razza.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  // ---------------------------------------------------------------- i preset (solo i parametri: il pezzo e gli interventi restano)
  const CHIAVE_PRESET = 'razza.presets';
  const leggiPreset = (): Record<string, ParametriRazza> => { try { return JSON.parse(localStorage.getItem(CHIAVE_PRESET) ?? '{}') as Record<string, ParametriRazza>; } catch { return {}; } };
  const scriviPreset = (o: Record<string, ParametriRazza>): void => { try { localStorage.setItem(CHIAVE_PRESET, JSON.stringify(o)); } catch { $('status').textContent = 'Il browser non lascia salvare i preset.'; } };
  function elencaPreset(): void {
    const sel = $('presetLista') as HTMLSelectElement; sel.innerHTML = '';
    for (const nome of Object.keys(leggiPreset()).sort()) { const o = document.createElement('option'); o.value = nome; o.textContent = nome; sel.appendChild(o); }
  }
  const applicaParametri = (p: Partial<ParametriRazza>): void => { Object.assign(par, p); costruisciPannello(); pianifica(); };
  $('presetSalva').addEventListener('click', () => {
    const nome = ($('presetNome') as HTMLInputElement).value.trim();
    if (!nome) { $('status').textContent = 'Dai un nome al preset.'; return; }
    const o = leggiPreset(); o[nome] = { ...par }; scriviPreset(o); elencaPreset(); ($('presetLista') as HTMLSelectElement).value = nome; $('status').textContent = `Preset «${nome}» salvato.`;
  });
  $('presetCarica').addEventListener('click', () => { const nome = ($('presetLista') as HTMLSelectElement).value; const p = leggiPreset()[nome]; if (p) { applicaParametri(p); $('status').textContent = `Preset «${nome}» caricato.`; } });
  $('presetElimina').addEventListener('click', () => { const nome = ($('presetLista') as HTMLSelectElement).value; const o = leggiPreset(); if (nome in o) { delete o[nome]; scriviPreset(o); elencaPreset(); } });
  $('presetEsporta').addEventListener('click', async () => {
    const nome = ($('presetLista') as HTMLSelectElement).value || 'preset'; const p = leggiPreset()[nome] ?? { ...par };
    const outcome = await saveTextFile(JSON.stringify({ [nome]: p }, null, 2), { suggestedName: `preset-razza-${nome}.json`, description: 'Preset JSON' });
    $('status').textContent = saveOutcomeMessage(outcome, `preset-razza-${nome}.json`);
  });
  ($('presetImporta') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(String(r.result)) as Record<string, Partial<ParametriRazza>>; const mio = leggiPreset();
        for (const [nome, p] of Object.entries(o)) if (p && typeof p === 'object') mio[nome] = { ...PARAMETRI_RAZZA, ...p };
        scriviPreset(mio); elencaPreset(); $('status').textContent = 'Preset importati.';
      } catch { $('status').textContent = 'Quel file non è un preset.'; }
    };
    r.readAsText(f);
  });

  // ---------------------------------------------------------------- partenza
  costruisciPannello(); costruisciListe(); elencaPreset(); impostaModo('seleziona');
  disegnaAnteprima(); pz.fit();
  $('fileStatus').textContent = `Sagoma demo: ${Math.round(pezzo.maxX - pezzo.minX)}×${Math.round(pezzo.maxY - pezzo.minY)} mm · ${pezzo.vuoti.length} area vuota · versione ${VERSIONE_RAZZA}`;
  pianifica(true);
}

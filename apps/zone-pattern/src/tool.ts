import '@rg/ui/rg.css';
import './zone.css';
import {
  parseImportedBoundarySource,
  type ImportedBoundaryModel, type ImportScaleMode, type PatternConfig,
} from '@rg/pattern-grammar';
import { buildSvg, dstFromExportLayers, DST_FILE, readProjectMetadata, readDstMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { readZones, resolveZoneAngles, zonesFromShapes, boundsOfPoints, type Zone, type ZoneShape } from './engine';
import { buildZonePlan, exportSequenceLayers, threadMetres, travelMetres, PATTERN_INK, PATTERN_KEYS, type PatternKey, type ZonePlan, type ZoneRole } from './pipeline';
import { readPatternSvg, migrateLegacyNames } from './analyze';
import { generateFinalPatternPoints } from '@rg/pattern-grammar';
import sharedPresetsRaw from '../../pattern-grammar/src/presets.shared.json?raw';
import zonePresetsRaw from './presets.zone.json?raw';
import { CORPO, ROLE_OPTIONS, SCALE_MODES, type Field, type Group } from './fields';

type Flat = Record<string, number | string | boolean>;

/** Config iniziale = i valori di default dichiarati nello schema dei campi (chiavi `A.x` / `B.x` / `x`). */
function initialConfig(): Flat {
  const cfg: Flat = {};
  for (const group of CORPO) for (const field of group.fields) cfg[field.name] = field.value;
  return cfg;
}

/** Estrae il `PatternConfig` di un ago dalle chiavi prefissate (`A.x` → `x`), saltando i campi non-grammatica. */
function patternOf(cfg: Flat, key: PatternKey): PatternConfig {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(cfg)) {
    if (name.startsWith(`${key}.`)) out[name.slice(2)] = value;
  }
  return out as PatternConfig;
}

/**
 * Campi che un pattern-sorgente può portare e che QUI non hanno senso: il formato e la sagoma
 * li dà la zona, l'export lo decide questo tool. Elencarli serve a non allarmare per niente
 * quando si segnala ciò che è rimasto fuori.
 */
const IGNORABLE = new Set([
  'totalWidth', 'totalHeight', 'columns', 'rows', 'shapeType', 'importedBoundary',
  'exportCompatibilityMode', 'sourceAnalysis',
  'minPointDistance', 'minSegmentLength', 'maxStitchLength', 'strokeWidth',
  'columnWaveFrequency', 'columnWavePhase',
]);

/**
 * I pattern pronti. Due sorgenti:
 *  - `presets.zone.json` — i DUE CANNAGE DI RIFERIMENTO di Lorenzo (LEGGERO e PIENA), presi dai
 *    parametri dei suoi SVG originali: sono i default di questo tool, non c'è da caricare niente;
 *  - la libreria condivisa del Generatore pattern, letta dal suo file: quello che pubblichi lì
 *    compare anche qui, senza un doppione da mantenere.
 */
/**
 * Quanto può pesare il cartamodello incorporato nel file, in kB.
 *
 * Misurato sui disegni veri del repo: il cannage di Lorenzo costa 10.7 kB, i cartamodelli di
 * oblique 0.9–3 kB, e persino il suo SVG da 2 MB ne produce 25 (quei 2 MB sono geometria di
 * ricamo, non contorni). Il tetto è quindi ~10× il caso peggiore reale: non scatta mai per
 * un file sano, ma impedisce che un contorno tracciato male — decine di migliaia di punti —
 * gonfi il DST in silenzio. Superato il tetto il progetto viaggia lo stesso, ma senza disegno.
 */
const MAX_DRAWING_KB = 256;

const PRESETS: Record<string, Record<string, unknown>> = (() => {
  const parse = (raw: string) => {
    try { return JSON.parse(raw) as Record<string, Record<string, unknown>>; } catch { return {}; }
  };
  return { ...parse(zonePresetsRaw), ...parse(sharedPresetsRaw) };
})();

/** Monta il tool "Pattern a zone" dentro `root`. `backHref` = ritorno alla home suite. */
export function mountZonePattern(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Pattern a zone', opts.backHref)}
  <div class="rg-workspace zone-workspace">
    <aside class="rg-workspace__panel" id="panel"></aside>
    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small">Adatta</button>
          <button id="genBtn" class="rg-button rg-button--secondary rg-button--small">Genera</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small">Esporta DST</button>
          <button id="exportBtn" class="rg-button rg-button--primary rg-button--small">Scarica SVG</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span><span id="status">Carica un disegno a zone (DXF o SVG).</span><span id="points" class="rg-mono"></span></span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const cfg = initialConfig();
  const roles: Record<string, ZoneRole> = {};
  let model: ImportedBoundaryModel | null = null;
  let source: { text: string; name: string } | null = null;
  let zones: Zone[] = [];
  /** La geometria grezza del cartamodello: UNICA fonte delle zone, sia che venga da un file
   *  importato sia che venga da un progetto riaperto. Le zone si ricalcolano da qui ogni
   *  volta che cambia una manopola di lettura (libertà d'angolo, area minima). */
  let shapes: ZoneShape[] = [];
  let plan: ZonePlan | null = null;
  /** Da dove vengono i valori di ciascun ago: si mostra in chiaro, non si nasconde. */
  const patternOrigin: Record<PatternKey, string> = { A: '', B: '' };
  /** Cosa dice la riga di stato del disegno. Vive fuori dal DOM perché il pannello si RICOSTRUISCE
   *  (caricando un preset, per esempio) e una riga ricostruita da zero direbbe "nessun disegno"
   *  con il disegno caricato: una bugia, piccola ma bugia. */
  let zoneStatusText = 'Nessun disegno caricato.';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  // ---- un campo, reso coi componenti DS; il valore mostrato è SEMPRE quello della config corrente ----
  function fieldEl(f: Field): HTMLElement {
    if (f.kind === 'check') {
      const lab = document.createElement('label');
      lab.className = 'rg-choice rg-param-grid__wide';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.id = 'f-' + f.name;
      inp.checked = Boolean(cfg[f.name]);
      inp.addEventListener('change', () => { cfg[f.name] = inp.checked; });
      lab.append(inp, document.createTextNode(' ' + f.label));
      return lab;
    }

    const lab = document.createElement('label');
    lab.className = 'rg-field' + (f.kind === 'select' || f.help ? ' rg-param-grid__wide' : '');
    const name = document.createElement('span');
    name.className = 'rg-field__label';
    name.textContent = f.label;
    lab.appendChild(name);

    if (f.kind === 'select') {
      const sel = document.createElement('select');
      sel.className = 'rg-select';
      sel.id = 'f-' + f.name;
      for (const [v, l] of f.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (v === String(cfg[f.name])) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { cfg[f.name] = sel.value; });
      lab.appendChild(sel);
      return lab;
    }

    const wrap = document.createElement('span');
    wrap.className = 'rg-field-with-unit';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'rg-input rg-input--numeric';
    inp.id = 'f-' + f.name;
    inp.step = String(f.step);
    if (f.min !== undefined) inp.min = String(f.min);
    inp.value = String(cfg[f.name] ?? f.value);
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isNaN(v)) cfg[f.name] = v;
    });
    const unit = document.createElement('span');
    unit.textContent = f.unit ?? '';
    wrap.append(inp, unit);
    lab.appendChild(wrap);
    if (f.help) {
      const help = document.createElement('small');
      help.className = 'rg-field__help';
      help.textContent = f.help;
      lab.appendChild(help);
    }
    return lab;
  }

  const gridOf = (g: Group): HTMLElement => {
    const grid = document.createElement('div');
    grid.className = 'rg-param-grid';
    for (const f of g.fields) grid.appendChild(fieldEl(f));
    return grid;
  };

  /** Sezione di testa (sempre aperta). */
  function headSection(index: string, title: string): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'rg-param-section';
    sec.innerHTML = `<div class="rg-param-section__header"><span class="rg-param-section__index">${index}</span><h3 class="rg-param-section__title">${title}</h3></div>`;
    return sec;
  }

  /** Sezione del corpo o della coda: accordion (aperto se `open`). */
  function accordionSection(index: string, title: string, body: HTMLElement, open: boolean): HTMLElement {
    const det = document.createElement('details');
    det.className = 'rg-param-section rg-disclosure';
    det.open = open;
    const sum = document.createElement('summary');
    sum.className = 'rg-param-section__header rg-disclosure__trigger';
    sum.innerHTML = `<span class="rg-param-section__index">${index}</span><span class="rg-param-section__title">${title}</span>`;
    det.append(sum, body);
    return det;
  }

  // ---- 01 Disegno: import del file a zone ----
  function disegnoGrid(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid';
    box.innerHTML = `
      <div class="rg-file-input rg-param-grid__wide">
        <label class="rg-file-input__control">
          <input type="file" id="zoneFile" accept=".svg,.dxf" />
          <span class="rg-button rg-button--outline">Carica DXF o SVG…</span>
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
        <select id="scaleMode" class="rg-select">${SCALE_MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">La zona è definita da</span>
        <select id="paintPriority" class="rg-select"><option value="fill">Riempimento (zone piene)</option><option value="stroke">Tratto (contorni)</option></select></label>
      <label class="rg-field"><span class="rg-field__label">Larghezza import</span>
        <span class="rg-field-with-unit"><input id="customW" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>
      <label class="rg-field"><span class="rg-field__label">Altezza import</span>
        <span class="rg-field-with-unit"><input id="customH" class="rg-input rg-input--numeric" type="number" min="0.001" step="0.1" value="100"><span>mm</span></span></label>`;
    return box;
  }

  // ---- 02 Colori e ruoli: una riga per tinta → pattern + correzione d'angolo ----
  function colorMap(): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'rg-color-map';
    ul.id = 'zoneColors';
    return ul;
  }

  function renderColorMap() {
    const ul = root.querySelector<HTMLElement>('#zoneColors');
    if (!ul) return;
    ul.innerHTML = '';
    if (!zones.length) {
      ul.innerHTML = '<li><p class="rg-color-map__empty">Nessun disegno caricato: qui compariranno le tinte trovate.</p></li>';
      return;
    }
    const byColor = new Map<string, Zone[]>();
    for (const zone of zones) byColor.set(zone.color, [...(byColor.get(zone.color) ?? []), zone]);

    for (const [color, group] of byColor) {
      const angles = group.map((z) => z.angleDeg).sort((a, b) => a - b);
      const row = document.createElement('li');
      row.className = 'rg-color-map__row';

      const sw = document.createElement('span');
      sw.className = 'rg-color-map__swatch';
      sw.style.setProperty('--swatch', color);

      const code = document.createElement('span');
      code.className = 'rg-color-map__code';
      code.textContent = color.toUpperCase() + ' ';
      const meta = document.createElement('span');
      meta.className = 'rg-color-map__meta';
      meta.textContent = `${group.length} zone · ${angles[Math.floor(angles.length / 2)].toFixed(1)}°`;
      code.appendChild(meta);

      const sel = document.createElement('select');
      sel.className = 'rg-select rg-color-map__target';
      sel.setAttribute('aria-label', `Pattern per ${color}`);
      for (const [v, l] of ROLE_OPTIONS) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (v === (roles[color]?.pattern ?? 'off')) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        roles[color] = { pattern: sel.value as ZoneRole['pattern'], angleOffsetDeg: roles[color]?.angleOffsetDeg ?? 0 };
      });

      const offset = document.createElement('input');
      offset.type = 'number';
      offset.className = 'rg-input rg-input--numeric';
      offset.step = '1';
      offset.value = String(roles[color]?.angleOffsetDeg ?? 0);
      offset.setAttribute('aria-label', `Correzione d'angolo per ${color}, in gradi`);
      offset.addEventListener('change', () => {
        const v = parseFloat(offset.value);
        roles[color] = { pattern: roles[color]?.pattern ?? 'off', angleOffsetDeg: Number.isNaN(v) ? 0 : v };
      });

      row.append(sw, code, sel, offset);
      ul.appendChild(row);
    }
  }

  // ---- da dove prende i valori un ago: un preset della libreria, o un SVG ----
  /**
   * Mette nei campi dell'ago `key` i valori arrivati da fuori. NON si ricalca la geometria:
   * si prendono i VALORI DI COSTRUZIONE e li rigenera il motore (Lorenzo: «a te servono solo
   * i valori di costruzione del modulo»). Così il pattern esce col filo continuo, il punto
   * minimo e il bordo puliti, invece che a pezzi staccati.
   */
  function applyValues(key: PatternKey, values: PatternConfig, origin: string) {
    const migrated = migrateLegacyNames(values as Record<string, unknown>);
    const applied: string[] = [];
    const ignored: string[] = [];
    for (const [name, value] of Object.entries(migrated)) {
      const usable = typeof value === 'boolean' || typeof value === 'string'
        || (typeof value === 'number' && Number.isFinite(value));
      if (!usable) continue;
      if (!(`${key}.${name}` in cfg)) {
        // Il pannello non ha quel campo. Non si ignora in silenzio: si DICE, perché è così che
        // un valore sparisce senza che nessuno se ne accorga.
        if (!IGNORABLE.has(name)) ignored.push(name);
        continue;
      }
      cfg[`${key}.${name}`] = value;
      applied.push(name);
    }
    patternOrigin[key] = `${origin} · ${applied.length} valori nei campi`
      + (ignored.length ? ` · non usati qui: ${ignored.join(', ')}` : '');
    buildPanel();
  }

  /**
   * L'ANTEPRIMA DEL MODELLO: un quadretto di pattern generato dai valori dell'ago.
   *
   * Serve a vedere cosa si è caricato senza dover generare tutto il ricamo: i numeri da soli
   * non dicono che aspetto ha il punto. Si genera su un quadrato di `sideMm`, che è la stessa
   * strada della zona vera (stesso motore, stesso ritaglio) — quindi quello che vedi qui è
   * quello che finirà nei rombi.
   */
  function swatch(key: PatternKey, sideMm = 26): HTMLElement {
    const box = document.createElement('div');
    box.className = 'zone-swatch rg-param-grid__wide';
    try {
      const square = [{ x: 0, y: 0 }, { x: sideMm, y: 0 }, { x: sideMm, y: sideMm }, { x: 0, y: sideMm }, { x: 0, y: 0 }];
      const final = generateFinalPatternPoints({
        ...patternOf(cfg, key),
        shapeType: 'imported',
        importedBoundary: {
          id: 'swatch', sourceFileName: 'swatch', sourceType: 'svg',
          paths: [{ id: 'swatch', points: square, closed: true }],
          bounds: { minX: 0, minY: 0, maxX: sideMm, maxY: sideMm },
        },
        totalWidth: sideMm, totalHeight: sideMm, columns: undefined, rows: undefined,
      });
      const d = (pl: { x: number; y: number }[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const lines = final.visualPolylines
        .map((pl) => `<polyline points="${d(pl)}" fill="none" stroke="${PATTERN_INK[key]}" stroke-width="0.12"/>`)
        .join('');
      const points = final.visualPolylines.reduce((sum, pl) => sum + pl.length, 0);
      box.innerHTML = `<svg viewBox="0 0 ${sideMm} ${sideMm}" role="img" aria-label="Anteprima del pattern ${key}">`
        + `<rect width="${sideMm}" height="${sideMm}" fill="none" stroke="var(--rg-color-border, #ccc)" stroke-width="0.15"/>`
        + `${lines}</svg><small class="rg-field__help">${sideMm} × ${sideMm} mm · ${points.toLocaleString('it-IT')} punti</small>`;
    } catch (e) {
      box.innerHTML = `<small class="rg-field__help">Anteprima non disponibile: ${(e as Error).message}</small>`;
    }
    return box;
  }

  function patternPicker(key: PatternKey): HTMLElement {
    const box = document.createElement('div');
    box.className = 'rg-param-grid__wide';
    box.innerHTML = `
      <label class="rg-field"><span class="rg-field__label">Parti da un pattern esistente</span>
        <select id="preset-${key}" class="rg-select">
          <option value="">Valori del pannello</option>
          ${Object.keys(PRESETS).map((n) => `<option value="${n}">${n}</option>`).join('')}
        </select></label>
      <div class="rg-file-input">
        <label class="rg-file-input__control">
          <input type="file" id="svg-${key}" accept=".svg" />
          <span class="rg-button rg-button--outline">…oppure leggi i valori da un SVG</span>
        </label>
        <p class="rg-file-input__status" id="svgStatus-${key}" role="status">${patternOrigin[key] || 'Valori del pannello.'}</p>
      </div>`;

    box.querySelector<HTMLSelectElement>(`#preset-${key}`)!.addEventListener('change', (ev) => {
      const name = (ev.target as HTMLSelectElement).value;
      if (!name) return;
      applyValues(key, PRESETS[name] as PatternConfig, `Preset "${name}"`);
    });

    box.querySelector<HTMLInputElement>(`#svg-${key}`)!.addEventListener('change', (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result);
          // Stessa regola che `oblique` applica ai suoi moduli (R28: una domanda, una risposta):
          // se il file dichiara le unità vincono quelle, se è roba di Illustrator senza unità
          // è in punti a 72 dpi.
          const scaleMode: ImportScaleMode =
            /Adobe Illustrator|id="Livello_/i.test(text) && !/width="[\d.]+(mm|cm|in|pt)"/i.test(text)
              ? 'illustrator-72dpi' : 'auto';
          const read = readPatternSvg(text, scaleMode);
          if (!Object.keys(read.config).length) {
            $(`svgStatus-${key}`).textContent = read.notes.join(' · ');
            return;
          }
          const label = read.origin === 'parametri'
            ? `${file.name}: parametri letti dal file`
            : `${file.name}: valori MISURATI (${read.notes.join('; ')})`;
          applyValues(key, read.config, label);
        } catch (e) {
          $(`svgStatus-${key}`).textContent = 'Errore: ' + (e as Error).message;
        }
      };
      reader.readAsText(file);
    });
    return box;
  }

  function buildPanel() {
    const panel = $('panel');
    panel.innerHTML = '';
    const n = (i: number) => String(i).padStart(2, '0');

    const disegno = headSection(n(1), 'Disegno');
    disegno.appendChild(disegnoGrid());
    panel.appendChild(disegno);

    const colori = headSection(n(2), 'Colori e ruoli');
    colori.appendChild(colorMap());
    panel.appendChild(colori);

    CORPO.forEach((g, k) => {
      const body = gridOf(g);
      // I due gruppi-pattern hanno in cima il caricatore del modulo SVG.
      const key = (['A', 'B'] as PatternKey[])[k];
      if (key) { body.prepend(patternPicker(key)); body.appendChild(swatch(key)); }
      panel.appendChild(accordionSection(n(3 + k), g.title, body, !!g.open));
    });

    wirePanel();
    renderColorMap();
  }

  // ---- import ----
  function reparse() {
    if (!source) return;
    model = parseImportedBoundarySource(source.text, source.name, {
      scaleMode: ($('scaleMode') as HTMLSelectElement).value as ImportScaleMode,
      paintPriority: ($('paintPriority') as HTMLSelectElement).value as 'fill' | 'stroke',
      customWidthMm: parseFloat(($('customW') as HTMLInputElement).value),
      customHeightMm: parseFloat(($('customH') as HTMLInputElement).value),
    });
    shapes = readZones(model).map((z) => ({ id: z.id, color: z.color, points: z.points }));
    refreshZones();
    const bounds = model.source?.finalBoundsMm;
    const size = bounds ? `${(bounds.maxX - bounds.minX).toFixed(1)} × ${(bounds.maxY - bounds.minY).toFixed(1)} mm` : '';
    zoneStatusText = `${source.name}: ${zones.length} zone, ${new Set(zones.map((z) => z.color)).size} tinte · ${size}`;
    $('zoneStatus').textContent = zoneStatusText;
    renderColorMap();
    plan = null;          // il piano di prima non vale più: il disegno è cambiato
    $('points').textContent = '';
    drawZones();          // il cartamodello si vede SUBITO, senza aspettare "Genera"
    $('status').textContent = zones.length
      ? `${zones.length} zone lette. Assegna i pattern in 02, poi premi Genera.`
      : 'Nessuna zona chiusa trovata: prova a cambiare "La zona è definita da".';
  }

  /** Rilegge le zone dalla geometria grezza applicando le manopole di lettura correnti. */
  function refreshZones() {
    if (!shapes.length) return;
    zones = resolveZoneAngles(zonesFromShapes(shapes, Number(cfg.minAreaMm2) || 0), Number(cfg.angleToleranceDeg));
    for (const zone of zones) roles[zone.color] ??= { pattern: 'off', angleOffsetDeg: 0 };
  }

  // ---- generazione ----
  function generate() {
    if (!zones.length) { $('status').textContent = 'Carica prima un disegno.'; return; }
    if (!Object.values(roles).some((r) => r.pattern !== 'off')) {
      $('status').textContent = 'Assegna un pattern ad almeno una tinta (02 Colori e ruoli).';
      return;
    }
    refreshZones();
    try {
      plan = buildZonePlan(zones, {
        roles,
        patterns: { A: patternOf(cfg, 'A'), B: patternOf(cfg, 'B') },
        marginMm: Number(cfg.marginMm),
        rowHeightMm: Number(cfg.rowHeightMm),
        travelMode: cfg.travelMode === 'none' ? 'none' : 'edges',
        travelStitchMm: Number(cfg.travelStitchMm),
        cleanupMinStitchMm: Number(cfg.cleanupMinStitchMm),
        outerMarginMm: Number(cfg.outerMarginMm),
      });
    } catch (e) {
      $('status').textContent = 'Errore: ' + (e as Error).message;
      console.error(e);
      return;
    }
    draw();
    const points = plan.stitches.reduce((sum, s) => sum + s.pointCount, 0);
    const filo = PATTERN_KEYS
      .filter((k) => plan!.stitches.some((s) => s.pattern === k))
      .map((k) => `${k} ${threadMetres(plan!, k).toFixed(1)}m`)
      .join(' · ');
    const passaggi = plan.travels.length
      ? ` · ${plan.travels.length} passaggi (${PATTERN_KEYS.map((k) => travelMetres(plan!, k))
        .reduce((a, b) => a + b, 0).toFixed(1)}m)`
      : ' · nessun passaggio';
    const pulizia = plan.cleanedPoints ? ` · pulizia -${plan.cleanedPoints.toLocaleString('it-IT')} punti` : '';
    $('status').textContent = `${plan.stitches.length} zone · ${plan.layers.length} aghi · filo ${filo}`
      + passaggi + pulizia + (plan.warnings.length ? ` · ${plan.warnings[0]}` : '');
    $('points').textContent = ` · ${points.toLocaleString('it-IT')} punti`;
  }

  /** L'anteprima: le zone in trasparenza sotto, il ricamo sopra, tinta per ago. */
  const d = (pl: { x: number; y: number }[]) => pl.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  /** Le zone così come sono arrivate dal file: è il CARTAMODELLO, il disegno d'ingresso. */
  const zonesSvg = (fillOpacity: number) => zones
    .map((z) => `<polygon points="${d(z.points)}" fill="${z.color}" fill-opacity="${fillOpacity}" stroke="${z.color}" stroke-width="0.3"/>`)
    .join('');

  /** L'SVG che avvolge il disegno, in mm reali attorno all'ingombro delle zone. */
  function frame(body: string): string {
    const b = boundsOfPoints(zones.flatMap((z) => z.points));
    const w = (b.width + 10).toFixed(2);
    const h = (b.height + 10).toFixed(2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" `
      + `viewBox="${(b.minX - 5).toFixed(2)} ${(b.minY - 5).toFixed(2)} ${w} ${h}">${body}</svg>`;
  }

  /**
   * Il CARTAMODELLO appena caricato, prima di generare qualsiasi cosa.
   *
   * Serve a vedere subito se il file è entrato giusto — scala, forme, tinte — invece di
   * scoprirlo dopo un minuto di calcolo. È anche il controllo che l'import ha funzionato:
   * un `transform` non applicato o una tinta collassata si vedono qui a colpo d'occhio.
   */
  function drawZones() {
    if (!zones.length) { $('layer').innerHTML = ''; return; }
    $('layer').innerHTML = frame(zonesSvg(0.18));
    pz.fit();
  }

  function draw() {
    if (!plan) return;
    const stitch = plan.stitches
      .map((s) => s.polylines.map((pl) => `<polyline points="${d(pl)}" fill="none" stroke="${PATTERN_INK[s.pattern]}" stroke-width="0.2"/>`).join(''))
      .join('');
    // I passaggi si vedono a parte, tratteggiati: sono filo anche loro, ma vanno riconosciuti
    // a colpo d'occhio — è tutto il senso di "prevedere i passaggi".
    const travel = plan.travels
      .map((t) => `<polyline points="${d(t.points)}" fill="none" stroke="${PATTERN_INK[t.pattern]}"`
        + ` stroke-width="0.35" stroke-dasharray="1.2 0.8" opacity="0.75"/>`)
      .join('');
    $('layer').innerHTML = frame(zonesSvg(0.10) + stitch + travel);
  }

  /**
   * I metadati che rendono l'export riapribile (R9/R27) — e qui più che negli altri tool:
   * dentro ci va anche il **cartamodello**, non solo i parametri.
   *
   * Negli altri tool l'ingresso è un'immagine e non si può incorporare, quindi riaprendo un
   * file torni ai parametri ma il disegno lo ricarichi a parte. Qui l'ingresso sono poligoni:
   * il cannage intero pesa 5,6 kB, sta comodo nel footer. Quindi un `.dst` uscito da qui si
   * riapre DA SOLO, disegno compreso, e si rimette a lavorare.
   *
   * Si salva la sola GEOMETRIA (id, tinta, punti): centro, area e angolo si rimisurano
   * all'apertura — se una regola migliora, il progetto vecchio ne gode invece di riaprire
   * i difetti del giorno in cui è stato salvato.
   */
  /** Ultimo esito dell'incorporamento del disegno: si dice, non si nasconde. */
  let drawingNote = '';

  function projectMetadata(): Record<string, unknown> {
    const base = { rgProject: 'zone-pattern', params: cfg, roles };
    const drawing = {
      name: source?.name ?? '',
      zones: zones.map((z): ZoneShape => ({
        id: z.id,
        color: z.color,
        points: z.points.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })),
      })),
    };
    const kb = JSON.stringify(drawing).length / 1024;
    if (kb > MAX_DRAWING_KB) {
      drawingNote = ` · disegno troppo pesante (${Math.round(kb)} kB): nel file solo i parametri`;
      return base;
    }
    drawingNote = zones.length ? ` · col disegno (${Math.round(kb)} kB)` : '';
    return { ...base, drawing };
  }

  /**
   * Rimette in piedi un progetto salvato: parametri, ruoli e — se c'è — il cartamodello.
   * Vale sia per un `.svg` che per un `.dst` usciti da qui: i metadati sono gli stessi.
   */
  function restore(metadata: Record<string, unknown> | null): boolean {
    const params = metadata?.params as Flat | undefined;
    const saved = metadata?.roles as Record<string, ZoneRole> | undefined;
    const drawing = metadata?.drawing as { name?: string; zones?: ZoneShape[] } | undefined;
    if (!params && !saved && !drawing?.zones?.length) return false;
    if (params) Object.assign(cfg, params);
    if (saved) Object.assign(roles, saved);
    if (drawing?.zones?.length) {
      model = null;                       // il disegno non viene più da un import: viene dal file
      source = { text: '', name: drawing.name || 'progetto' };
      shapes = drawing.zones;
      refreshZones();
      const b = boundsOfPoints(zones.flatMap((z) => z.points));
      zoneStatusText = `${source.name} (riaperto): ${zones.length} zone, `
        + `${new Set(zones.map((z) => z.color)).size} tinte · ${b.width.toFixed(1)} × ${b.height.toFixed(1)} mm`;
      plan = null;
      $('points').textContent = '';
    }
    buildPanel();
    if (zones.length) {
      drawZones();
      $('status').textContent = `Progetto riaperto: ${zones.length} zone. Premi Genera.`;
    }
    return true;
  }

  function wirePanel() {
    $('zoneFile').addEventListener('change', (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result);
          // R27: se l'SVG viene dalla suite, i parametri tornano com'erano.
          restore(readProjectMetadata(text) as Record<string, unknown> | null);
          source = { text, name: file.name };
          reparse();
        } catch (e) {
          $('zoneStatus').textContent = 'Errore import: ' + (e as Error).message;
        }
      };
      reader.readAsText(file);
    });
    for (const id of ['scaleMode', 'paintPriority', 'customW', 'customH']) $(id).addEventListener('change', reparse);

    // RIAPRI UN PROGETTO. Un `.svg` si legge come testo, un `.dst` come byte: i parametri
    // stanno nel footer dopo il record END, dove la macchina non guarda (R27/R31).
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
          if (metadata?.rgProject !== 'zone-pattern') {
            $('reopenStatus').textContent = metadata
              ? `Questo file viene da "${String(metadata.rgProject ?? 'un altro tool')}", non da qui.`
              : 'Nessun progetto dentro questo file: non è uscito dalla suite.';
            return;
          }
          const drawing = (metadata.drawing as { zones?: unknown[] } | undefined)?.zones?.length ?? 0;
          restore(metadata);
          $('reopenStatus').textContent = `${file.name}: riaperto`
            + (drawing ? ` col disegno (${drawing} zone).` : ' — senza disegno: caricalo a parte.');
        } catch (e) {
          $('reopenStatus').textContent = 'Errore: ' + (e as Error).message;
        }
        input.value = '';
      };
      if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    });
  }

  // azioni fisse (non rigenerate)
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('genBtn').addEventListener('click', generate);

  $('exportBtn').addEventListener('click', async () => {
    if (!plan) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    const base = source?.name.replace(/\.[^.]+$/, '') ?? 'zone';
    const b = boundsOfPoints(zones.flatMap((z) => z.points));
    // Nell'SVG un gruppo per PEZZO, in ordine di cucitura: i blocchi e i passaggi restano
    // separati e riconoscibili, quindi riordinabili a valle. Nel DST invece i layer sono due
    // (uno per ago): lì un gruppo per pezzo diventerebbe un cambio-colore per pezzo.
    const svg = buildSvg(exportSequenceLayers(plan), {
      bounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY },
      marginMm: 5,
      metadata: projectMetadata(),
    });
    const name = `${base}-zone.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name) + drawingNote;
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!plan) { $('status').textContent = 'Genera prima il ricamo.'; return; }
    const base = source?.name.replace(/\.[^.]+$/, '') ?? 'zone';
    let bytes: Uint8Array;
    try {
      // Un layer per ago, in ordine → i cambi-pattern diventano cambi-ago in sequenza (R31).
      bytes = dstFromExportLayers(plan.layers, { label: base.toUpperCase().slice(0, 16), metadata: projectMetadata() });
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = `${base}-zone.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB · ${plan.layers.length} aghi`
      + drawingNote;
  });

  buildPanel();
}

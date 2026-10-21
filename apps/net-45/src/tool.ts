import '@rg/ui/rg.css';
import './net45.css';
import {
  type Role, type NetParams, type ImportResult,
  ROLE_LABELS, defaultNetParams, buildSvg, buildSvgInSourceFrame,
  parseSvgToContours, parseDxfToContours, readProjectMetadata, readDstMetadata,
  applyRealWidth, importResultFromContours, measureContours,
  dstFromExportLayers, DST_FILE, conBusta,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { scheletro, sezioneSorgente, sezione, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero } from '@rg/ui/anatomia';
import { runPipeline, type RoleAssignment } from './pipeline';
import { sampleContours } from './sample';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { collegaStilista, stratiCuciti, type AggancioStilista } from '@rg/ui/stilista';

/** Un campo del gruppo "Parametri". `check` = sì/no (interno 1/0). `unit` va nello slot del DS, mai nell'etichetta (R-panello). */
type Field =
  | { key: keyof NetParams; label: string; unit: string; step: number; help?: string; kind?: 'num' }
  | { key: keyof NetParams; label: string; kind: 'check' };

// Ordine e nomi decisi con Lorenzo (REVISIONE-PARAMETRI.md). `realWidthMm` sta nel gruppo Sagoma, non qui.
const PARAMS: Field[] = [
  { key: 'squareSizeMm', label: 'Lato del quadrato', unit: 'mm', step: 0.5 },
  { key: 'angleADeg', label: 'Angolo diagonali principali', unit: '°', step: 1 },
  { key: 'angleBDeg', label: 'Angolo diagonali secondarie', unit: '°', step: 1 },
  { key: 'netInsetMm', label: 'Rientro della rete dal bordo', unit: 'mm', step: 0.5 },
  { key: 'netOffsetXMm', label: 'Sposta rete — orizzontale', unit: 'mm', step: 1 },
  { key: 'netOffsetYMm', label: 'Sposta rete — verticale', unit: 'mm', step: 1 },
  { key: 'rasoBandMm', label: 'Spessore della fascia di raso', unit: 'mm', step: 1 },
  { key: 'rasoDownwardOnly', label: 'Raso solo sui bordi bassi e laterali', kind: 'check' },
  { key: 'cordWidthMm', label: 'Larghezza del cordoncino', unit: 'mm', step: 0.1 },
  { key: 'cordInterlineMm', label: 'Interlinea del cordoncino', unit: 'mm', step: 0.05, help: 'distanza tra un punto e il successivo lungo il filo' },
  { key: 'travelStitchMm', label: 'Lunghezza del punto nei passaggi', unit: 'mm', step: 0.5 },
  { key: 'minStitchMm', label: 'Punto minimo', unit: 'mm', step: 0.1 },
];
const ROLE_OPTIONS: (Role | '')[] = ['', 'MASTER_OUTLINE', 'NET_AREA', 'SATIN_AREA', 'SQUARE_AREA', 'BORDER', 'EXCLUSION'];

/** Monta il tool "Rete 45°" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountNet45(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = scheletro({
    topbar: topbar('Rete 45°', opts.backHref),
    classe: 'net45-workspace',
    pannello: [
      sezioneSorgente({ tipo: 'cartamodello', accetta: '.svg,.dxf,.dst', statoIniziale: 'Nessun file: uso il cartamodello demo.', demo: 'Cartamodello demo', stilista: true }),
      sezione({ indice: 2, titolo: 'Colori e ruoli', contenuto: '<ul class="rg-color-map" id="roles"></ul>' }),
      sezione({ indice: 3, titolo: 'Parametri', contenuto: '<div id="params" class="rg-param-grid"></div>', apribile: true, aperta: true }),
    ],
    anteprima: { inviaStilista: true },
  });
  attivaCampiNumero(root);

  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  let imported: ImportResult = importResultFromContours(sampleContours());
  let roles: RoleAssignment = {};
  const params: NetParams = { ...defaultNetParams };

  const currentContours = () => applyRealWidth(imported, params.realWidthMm);
  const contourColors = () => imported.contours.map((c) => c.color);
  const uniqueColors = () => [...new Set(contourColors())];

  // Pan/zoom del canvas (la vista non si azzera rigenerando l'SVG).
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });

  function autoAssign() {
    const colors = uniqueColors();
    if (colors.length === 1 && roles[colors[0]] === undefined) roles[colors[0]] = 'MASTER_OUTLINE';
  }

  // ---- Parametri: componenti DS, unità nello slot, sì/no come casella di spunta ----
  /**
   * Rimette in piedi un progetto uscito da qui: parametri e ruoli dei colori.
   *
   * Vale sia per un `.svg` (parametri nel `<metadata>`) sia per un `.dst` (nel footer dopo
   * l'END, R27). Il disegno no: net-45 lavora sul cartamodello importato, che resta quello
   * caricato — il progetto ripristina COME ricamarlo, non COSA.
   */
  function applyImportedProject(meta: Record<string, unknown>): boolean {
    if (meta.rgProject !== 'net-45') return false;
    const mp = meta.params;
    if (mp && typeof mp === 'object') {
      for (const k of Object.keys(defaultNetParams) as (keyof NetParams)[]) {
        const v = (mp as Record<string, unknown>)[k];
        if (v !== undefined) (params as unknown as Record<string, unknown>)[k] = v;
      }
    }
    if (meta.roles && typeof meta.roles === 'object') roles = { ...(meta.roles as RoleAssignment) };
    impostaNumero($('realWidth') as HTMLInputElement, params.realWidthMm);
    buildParamUI();
    buildRoleUI();
    return true;
  }

  function buildParamUI() {
    const host = $('params');
    host.innerHTML = '';
    for (const f of PARAMS) {
      if (f.kind === 'check') {
        const lab = document.createElement('label');
        lab.className = 'rg-choice rg-param-grid__wide';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.checked = (params[f.key] as number) !== 0;
        inp.addEventListener('change', () => { (params[f.key] as number) = inp.checked ? 1 : 0; render(); });
        lab.append(inp, document.createTextNode(' ' + f.label));
        host.appendChild(lab);
        continue;
      }
      host.insertAdjacentHTML('beforeend', campoNumero({
        id: 'p-' + f.key, etichetta: f.label, unita: f.unit, valore: params[f.key] as number, passo: f.step, aiuto: f.help,
        attributi: 'data-param="' + f.key + '"',
      }));
      const inp = host.querySelector<HTMLInputElement>('[data-param="' + f.key + '"]')!;
      inp.addEventListener('change', () => {
        const v = leggiCampo(inp);
        if (!Number.isNaN(v)) { (params[f.key] as number) = v; render(); }
      });
    }
  }

  // ---- Colori → ruoli: componente DS rg-color-map (campione + codice colore + conteggio + bersaglio) ----
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

  function render() {
    try {
      const { layers, bounds } = runPipeline(currentContours(), roles, params);
      $('layer').innerHTML = buildSvg(layers, { bounds, marginMm: 8 });
    } catch (e) {
      $('status').textContent = 'Errore render: ' + (e as Error).message;
      console.error(e);
    }
  }

  /** Nome del file di partenza (senza estensione): serve a proporre un nome d'export sensato. */
  let sourceName = '';
  let sourceTipo: 'svg' | 'dxf' = 'svg';
  /** La sorgente per la busta di progetto: solo se c'è un file caricato; misura REALE (R11). */
  const sorgenteBusta = () => {
    if (!sourceName) return undefined;
    const eff = measureContours(currentContours());
    return { tipo: sourceTipo, nome: sourceName, larghezzaMm: eff.widthMm, altezzaMm: eff.heightMm };
  };

  /** Aggiorna la riga di provenienza del file (nome, misura, metodo, quantità) — è lo status del componente Sagoma. */
  function updateFileStatus(label: string) {
    const eff = measureContours(currentContours());
    const detected = `${Math.round(imported.widthMm)}×${Math.round(imported.heightMm)} mm (${imported.method})`;
    const effStr = params.realWidthMm > 0 ? ` → reale ${Math.round(eff.widthMm)}×${Math.round(eff.heightMm)} mm` : '';
    const hint = imported.method === 'dpi' && !params.realWidthMm ? ' · imposta la larghezza reale' : '';
    $('fileStatus').textContent = `${label}: ${detected}${effStr} · ${imported.contours.length} contorni${hint}`;
  }

  function loadImport(result: ImportResult, label: string) {
    imported = result;
    autoAssign();
    buildRoleUI();
    render();
    updateFileStatus(label);
  }

  const apriFile = (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const isDst = /\.dst$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // Un .dst uscito da qui non è un cartamodello: è un PROGETTO. Si legge il footer e si
        // rimettono parametri e ruoli, senza toccare il disegno che c'è già.
        if (isDst) {
          const meta = readDstMetadata(new Uint8Array(reader.result as ArrayBuffer));
          if (meta && applyImportedProject(meta)) {
            render();
            $('fileStatus').textContent = `${file.name}: parametri ripristinati dal DST`;
          } else $('fileStatus').textContent = `${file.name}: nessun parametro di questo tool nel DST`;
          return;
        }
        const text = String(reader.result);
        const isDxf = /\.dxf$/i.test(file.name);
        const result = isDxf ? parseDxfToContours(text) : parseSvgToContours(text);
        sourceName = file.name.replace(/\.[^.]+$/, '');
        sourceTipo = isDxf ? 'dxf' : 'svg';
        svgStilista = null;
        // Se l'SVG viene dalla suite, i parametri si rimettono PRIMA di caricare, così valgono
        // già quando il disegno entra (e l'assegnazione automatica non li sovrascrive).
        let restored = false;
        if (!isDxf) { const meta = readProjectMetadata(text); if (meta) restored = applyImportedProject(meta); }
        loadImport(result, file.name);
        if (restored) $('fileStatus').textContent = `${file.name} · parametri ripristinati dal file`;
      } catch (e) {
        $('fileStatus').textContent = 'Errore import: ' + (e as Error).message;
        console.error(e);
      }
    };
    if (isDst) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };
  $('fileInput').addEventListener('change', apriFile);
  $('progettoInput').addEventListener('change', apriFile);

  $('realWidth').addEventListener('change', () => {
    const v = leggiCampo($('realWidth') as HTMLInputElement);
    params.realWidthMm = Number.isNaN(v) ? 0 : Math.max(0, v);
    render();
    updateFileStatus(sourceName || 'Cartamodello');
  });

  $('demoBtn').addEventListener('click', () => { roles = {}; sourceName = ''; svgStilista = null; loadImport(importResultFromContours(sampleContours()), 'Cartamodello demo'); });
  $('fitBtn').addEventListener('click', () => pz.fit());

  $('exportBtn').addEventListener('click', async () => {
    const { layers, bounds } = runPipeline(currentContours(), roles, params);
    const metadata = conBusta({ rgProject: 'net-45', version: '0.1.0', params, roles, generatedAt: Date.now() }, { strati: layers, sorgente: sorgenteBusta() });
    let svg: string;
    if (imported.frame) {
      const r = params.realWidthMm > 0 && imported.widthMm > 0 ? params.realWidthMm / imported.widthMm : 1;
      svg = buildSvgInSourceFrame(layers, { frame: imported.frame, realWidthFactor: r, metadata });
    } else {
      svg = buildSvg(layers, { bounds, marginMm: 8, metadata });
    }
    const name = sourceName ? `${sourceName}-rete45.svg` : 'rete-45.svg';
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  // Export ricamo Tajima .dst tramite la "possibilità" globale del core: i layer del pipeline sono già in
  // mm reali; l'adattatore cuce i layer non-forma (rete/cordoncini), un blocco per polilinea. I parametri
  // viaggiano ANCHE nel DST (R27), nel footer dopo l'END: la macchina legge fino all'END e lo ignora, noi
  // lo rileggiamo. Lo usano «Esporta DST» e «Invia a Stilista».
  function costruisciDst(): Uint8Array {
    const { layers } = runPipeline(currentContours(), roles, params);
    return dstFromExportLayers(layers, {
      label: (sourceName || 'RETE45').toUpperCase().slice(0, 16),
      metadata: conBusta({ rgProject: 'net-45', version: '0.1.0', params, roles }, { strati: layers, sorgente: sorgenteBusta() }),
    });
  }

  // ---- Stilista (RG Stilista Link, @rg/ui/stilista): la selezione è il cartamodello, i fori le aree vuote ----
  let svgStilista: string | null = null;
  const aggancio: AggancioStilista = {
    carica(svg, nome) {
      svgStilista = svg;
      // l'SVG dichiara le sue misure: una larghezza reale lo riscalerebbe e il ritorno non cadrebbe più al suo posto
      params.realWidthMm = 0;
      impostaNumero($('realWidth') as HTMLInputElement, 0);
      roles = {};
      sourceName = nome.replace(/\.[^.]+$/, '');
      sourceTipo = 'svg';
      loadImport(parseSvgToContours(svg), nome);
    },
    ruoli(fori) {
      for (const c of uniqueColors()) roles[c] = c === fori ? 'EXCLUSION' : 'MASTER_OUTLINE';
      buildRoleUI();
      render();
    },
    sorgente: () => svgStilista,
    strati: () => stratiCuciti(runPipeline(currentContours(), roles, params).layers),
    dst: () => ({ bytes: costruisciDst(), nome: `${sourceName || 'rete'}-rete45` }),
    stato: (testo) => { $('status').textContent = testo; },
  };

  $('exportDstBtn').addEventListener('click', async () => {
    let bytes: Uint8Array;
    try {
      bytes = costruisciDst();
    } catch (e) {
      $('status').textContent = (e as Error).message;
      return;
    }
    const name = sourceName ? `${sourceName}-rete45.dst` : 'rete-45.dst';
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  buildParamUI();
  loadImport(imported, 'Cartamodello demo');
  collegaStilista(aggancio, { prendi: $('fromStilista'), invia: $('toStilistaBtn') });
}

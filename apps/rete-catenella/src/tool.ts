// Guscio del tool "Rete a catenella" (DOM/browser). La geometria è in `motore.ts`, che resta puro. Il modulo si carica da un file che
// resta fuori dal repo (`rete-modulo-1`, vedi strumenti-sviluppo/stilista-prove/esporta-modulo.mjs); di suo il tool ha
// solo un modulo di esempio inventato. I passi del modulo non si toccano: sono loro a far combaciare gli incastri (Lorenzo, 2026-11-03).
import '@rg/ui/rg.css';
import './rete-catenella.css';
import { parseImportedBoundarySource, type ImportedBoundaryModel } from '@rg/pattern-grammar';
import { buildSvg, conBusta, dstFromExportLayers, DST_FILE, polygonArea, readDstMetadata, readProjectMetadata } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { testiCampo } from '@rg/cervello';
import { scheletro, sezioneSorgente, sezione, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { collegaSimula, type DatiSimulazione } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { collegaStilista, inviaAStilista, origineStilista, stratiCuciti, type AggancioStilista } from '@rg/ui/stilista';
import { reteAStilista } from './stilista-psil';
import { costruisciRete, stratiRete, PARAMETRI_RETE, type EsitoRete, type ModuloRete, type ParametriRete, type Xy, riquadroRete } from './motore';
import { moduloDiEsempio } from './esempio';

type CampoNum = { [K in keyof ParametriRete]: ParametriRete[K] extends number ? K : never }[keyof ParametriRete];
const LIMITI: Array<{ key: CampoNum; passo: number; min: number; max: number }> = [
  { key: 'spostaXMm', passo: 1, min: -200, max: 200 }, { key: 'spostaYMm', passo: 1, min: -100, max: 100 }, { key: 'moduloMinimoPct', passo: 1, min: 0, max: 100 }, { key: 'uscitaFuoriMm', passo: 1, min: 2, max: 150 }, { key: 'magliaMassimaMm2', passo: 5, min: 12, max: 500 }, { key: 'infittisciVariante', passo: 1, min: 1, max: 99 },
  { key: 'passate', passo: 1, min: 1, max: 3 }, { key: 'puntoBaseMm', passo: 0.1, min: 1, max: 6 }, { key: 'puntoPassaggioMm', passo: 0.1, min: 1, max: 6 },
  { key: 'psilLunghezzaMm', passo: 0.05, min: 1, max: 6 }, { key: 'psilLarghezzaMm', passo: 0.05, min: 0.4, max: 4 }, { key: 'psilPassoMm', passo: 0.05, min: 0.8, max: 5 },
  { key: 'psilInizioMm', passo: 0.05, min: 0, max: 3 }, { key: 'psilGiri', passo: 1, min: 1, max: 3 },
  { key: 'margineMm', passo: 0.5, min: 0, max: 20 }, { key: 'primaCorsiaMm', passo: 0.5, min: 0, max: 10 }, { key: 'passoCorsiaMm', passo: 0.1, min: 0.3, max: 3 },
];
const COLORI = { base: '#7fb0e6', passaggio: '#1f9a55', catenella: '#a5432f', uscita: '#d6009a', contorno: '#2c2b28' };
const n0 = (v: number): string => Math.round(v).toLocaleString('it-IT');
// il modulo del cliente non sta nel repo: una volta caricato resta in questo browser, su questo PC
const MODULO_RICORDATO = 'rg-rete-catenella-modulo';

/** Un contorno di esempio inventato: un trapezio coi lati un po' curvi. */
const CONTORNO_ESEMPIO = (): string => '<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="280mm" viewBox="0 0 420 280"><path fill="none" stroke="#c0392b" d="M10 10 L410 10 L340 270 L80 270 Z"/></svg>';

export function mountReteCatenella(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const campo = (key: CampoNum): string => {
    const l = LIMITI.find((x) => x.key === key)!;
    const t = testiCampo('rete-catenella', key);
    return campoNumero({ id: key, etichetta: t.etichetta, unita: t.unita, valore: PARAMETRI_RETE[key], passo: l.passo, min: l.min, max: l.max, aiuto: t.aiuto });
  };
  const griglia = (keys: CampoNum[], dopo = ''): string => `<div class="rg-param-grid" style="--rg-input-numeric-width: 7ch">${keys.map(campo).join('\n')}${dopo}</div>`;
  const tCorsie = testiCampo('rete-catenella', 'corsie');
  const tCollega = testiCampo('rete-catenella', 'collegaModuli');
  const tPsil = testiCampo('rete-catenella', 'psilVero');
  const tInfittisci = testiCampo('rete-catenella', 'infittisci');

  root.innerHTML = scheletro({
    classe: 'rete-catenella-workspace',
    topbar: topbar('Rete a catenella', opts.backHref),
    pannello: [
      sezioneSorgente({ tipo: 'cartamodello', accetta: '.svg,.dxf', statoIniziale: 'Nessun contorno: c’è quello di esempio.', larghezzaReale: false, demo: 'Contorno di esempio', stilista: true }),
      sezione({ indice: 2, titolo: 'Modulo', contenuto: `<div class="rg-param-grid">
        <div class="rg-file-input rg-param-grid__wide">
          <label class="rg-file-input__control"><input type="file" id="moduloInput" accept=".json" /><span class="rg-button rg-button--outline">Carica un modulo…</span></label>
          <p class="rg-file-input__status" id="moduloStatus" role="status">Modulo di esempio.</p>
        </div>
        <button type="button" id="moduloEsempioBtn" class="rg-button rg-button--ghost rg-param-grid__wide" hidden>Torna al modulo di esempio</button>
        <dl class="rg-key-value rg-param-grid__wide"><dt>Passo colonne (fisso)</dt><dd id="passoColonne"></dd><dt>Passo righe (fisso)</dt><dd id="passoRighe"></dd></dl>
      </div>` }),
      sezione({ indice: 3, titolo: 'Griglia', apribile: true, aperta: true, contenuto: griglia(['spostaXMm', 'spostaYMm', 'moduloMinimoPct', 'uscitaFuoriMm'], `
        <label class="rg-choice rg-param-grid__wide" title="${tCollega.aiuto ?? ''}"><input type="checkbox" id="collegaModuli"> ${tCollega.etichetta}</label>`) }),
      sezione({ indice: 4, titolo: 'Basi e passaggi', apribile: true, aperta: true, contenuto: griglia(['passate', 'puntoBaseMm', 'puntoPassaggioMm']) }),
      sezione({ indice: 5, titolo: 'Catenella (psil)', apribile: true, aperta: true, contenuto: griglia(['psilLunghezzaMm', 'psilLarghezzaMm', 'psilPassoMm', 'psilInizioMm', 'psilGiri'], `
        <label class="rg-choice rg-param-grid__wide" title="${tPsil.aiuto ?? ''}"><input type="checkbox" id="psilVero" checked> ${tPsil.etichetta}</label>`) }),
      sezione({ indice: 6, titolo: 'Trama', apribile: true, aperta: true, contenuto: griglia(['magliaMassimaMm2', 'infittisciVariante'], `
        <label class="rg-choice rg-param-grid__wide" title="${tInfittisci.aiuto ?? ''}"><input type="checkbox" id="infittisci"> ${tInfittisci.etichetta}</label>
        <div class="rg-file-input rg-param-grid__wide">
          <label class="rg-file-input__control"><input type="file" id="zonaInput" accept=".svg,.dxf" /><span class="rg-button rg-button--outline">Solo in questa zona…</span></label>
          <p class="rg-file-input__status" id="zonaStatus" role="status">Dappertutto.</p>
        </div>
        <button type="button" id="zonaViaBtn" class="rg-button rg-button--ghost rg-param-grid__wide" hidden>Infittisci dappertutto</button>`) }),
      sezione({ indice: 7, titolo: 'Bordo', apribile: true, aperta: true, contenuto: griglia(['margineMm', 'primaCorsiaMm', 'passoCorsiaMm'], `
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="corsie" checked> ${tCorsie.etichetta}</label>
        ${tCorsie.aiuto ? `<small class="rg-field__help rg-param-grid__wide">${tCorsie.aiuto}</small>` : ''}`) }),
      sezione({ indice: 7, titolo: 'Si vede', apribile: true, aperta: true, contenuto: `<div class="rg-param-grid">
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="vBasi" checked> Basi</label>
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="vPassaggi" checked> Passaggi</label>
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="vCatenelle" checked> Catenelle</label>
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="vUscite" checked> Uscite dei moduli</label>
        <label class="rg-choice rg-param-grid__wide"><input type="checkbox" id="vMaglie"> Le maglie, punto per punto</label>
      </div>` }),
      sezione({ indice: 9, titolo: 'I conti', contenuto: '<dl class="rg-key-value" id="conti"></dl>' }),
    ],
    anteprima: { simula: true, inviaStilista: true },
  });
  attivaCampiNumero(root);

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const stato = (t: string): void => { $('status').textContent = t; };
  const par: ParametriRete = { ...PARAMETRI_RETE };
  let modulo: ModuloRete = moduloDiEsempio();
  let zona: Xy[] | null = null;
  let model: ImportedBoundaryModel | null = null;
  let anello: Xy[] = [];
  let sorgente: { text: string; name: string } | null = null;
  let esito: EsitoRete | null = null;
  let sim: { ferma(): void } | null = null;
  let adattaDopo = true;

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });
  $('fitBtn').addEventListener('click', () => pz.fit());

  const mostraPassi = (): void => {
    const p = modulo.passi;
    $('passoColonne').textContent = `${p.colonne} mm`;
    $('passoRighe').textContent = `${p.righe} mm`;
  };

  // ---- il contorno ------------------------------------------------------------
  const anelliDi = (m: ImportedBoundaryModel) => m.choices.flatMap((c) => c.boundary.paths.filter((p) => p.points.length >= 3).map((p) => p.points));
  function caricaContorno(text: string, name: string): void {
    model = parseImportedBoundarySource(text, name, { scaleMode: 'auto' });
    const anelli = anelliDi(model);
    if (!anelli.length) { $('fileStatus').textContent = `${name}: nessun contorno chiuso.`; return; }
    anelli.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    anello = anelli[0].map((p): Xy => [p.x, p.y]);
    sorgente = { text, name };
    const xs = anello.map((p) => p[0]), ys = anello.map((p) => p[1]);
    $('fileStatus').textContent = `${name}: ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(0)} mm${anelli.length > 1 ? ` · uso l’anello più grande, gli altri ${anelli.length - 1} no` : ''}.`;
    adattaDopo = true;
    genera();
  }
  ($('fileInput') as HTMLInputElement).addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) caricaContorno(await f.text(), f.name);
  });
  $('demoBtn').addEventListener('click', () => caricaContorno(CONTORNO_ESEMPIO(), 'contorno-di-esempio.svg'));

  // ---- il modulo: resta in un file fuori dal repo ----------------------------------
  function usaModulo(testo: string, nome: string): void {
    const m = JSON.parse(testo) as ModuloRete;
    if (m.formato !== 'rete-modulo-1' || !m.varianti?.A?.oggetti?.length || !m.varianti?.B?.oggetti?.length || !(m.passi?.colonne > 0) || !(m.passi?.righe > 0)) throw new Error('non è un modulo');
    modulo = m;
    $('moduloStatus').textContent = `${m.nome || nome}: ${m.varianti.A.oggetti.length} oggetti. Resta su questo PC anche alla prossima apertura.`;
    $('moduloEsempioBtn').hidden = false;
    mostraPassi();
  }
  $('moduloEsempioBtn').addEventListener('click', () => {
    try { localStorage.removeItem(MODULO_RICORDATO); } catch { /* niente da togliere */ }
    modulo = moduloDiEsempio();
    $('moduloStatus').textContent = 'Modulo di esempio.';
    $('moduloEsempioBtn').hidden = true;
    mostraPassi();
    genera();
  });
  // ---- la zona da infittire ------------------------------------------------------
  ($('zonaInput') as HTMLInputElement).addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const anelli = anelliDi(parseImportedBoundarySource(await f.text(), f.name, { scaleMode: 'auto' }));
    if (!anelli.length) { $('zonaStatus').textContent = `${f.name}: nessun contorno chiuso.`; return; }
    anelli.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    zona = anelli[0].map((p): Xy => [p.x, p.y]);
    $('zonaStatus').textContent = `Solo dentro ${f.name}.`;
    $('zonaViaBtn').hidden = false;
    genera();
  });
  $('zonaViaBtn').addEventListener('click', () => {
    zona = null;
    $('zonaStatus').textContent = 'Dappertutto.';
    $('zonaViaBtn').hidden = true;
    genera();
  });
  ($('moduloInput') as HTMLInputElement).addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const testo = await f.text();
      usaModulo(testo, f.name);
      try { localStorage.setItem(MODULO_RICORDATO, testo); } catch { /* senza memoria va ricaricato ogni volta */ }
      adattaDopo = true;
      genera();
    } catch {
      $('moduloStatus').textContent = `${f.name}: non è un modulo di Rete a catenella.`;
    }
  });

  // ---- i campi ------------------------------------------------------------------
  let attesa = 0;
  const genera = (): void => { window.clearTimeout(attesa); attesa = window.setTimeout(calcola, 80); };
  for (const l of LIMITI) {
    const el = $(l.key) as HTMLInputElement;
    el.addEventListener('change', () => {
      let v = leggiCampo(el);
      if (!Number.isFinite(v)) v = PARAMETRI_RETE[l.key];
      v = Math.max(l.min, Math.min(l.max, l.passo === 1 && (l.key === 'passate' || l.key === 'psilGiri' || l.key === 'infittisciVariante') ? Math.round(v) : v));
      par[l.key] = v;
      impostaNumero(el, v);
      genera();
    });
  }
  for (const k of ['corsie', 'collegaModuli', 'psilVero', 'infittisci'] as const) ($(k) as HTMLInputElement).addEventListener('change', (e) => { par[k] = (e.target as HTMLInputElement).checked; genera(); });
  for (const id of ['vBasi', 'vPassaggi', 'vCatenelle', 'vUscite', 'vMaglie']) $(id).addEventListener('change', () => { sim?.ferma(); disegna(); });

  // ---- il calcolo e il disegno ------------------------------------------------------
  function calcola(): void {
    sim?.ferma();
    if (anello.length < 3) return;
    const t0 = performance.now();
    esito = costruisciRete(modulo, anello, par, zona);
    const c = esito.conti;
    const righe: Array<[string, string]> = [['Moduli', n0(c.moduli)], ...(par.collegaModuli ? [['Fili fra i moduli', `${n0(c.collegamenti)}, ${n0(c.collegamentiMm / 1000)} m`] as [string, string], ['Rasafili fra i moduli', n0(c.saltiFraModuli)] as [string, string]] : [['Uscite fuori dal contorno', n0(c.uscite)] as [string, string], ['Uscite sotto i moduli dopo', `${n0(c.usciteSottoMm / 1000)} m`] as [string, string], ['Uscite dove non c’è un modulo dopo', `${n0(c.usciteScoperteMm / 1000)} m`] as [string, string]]), ['Basi', n0(c.basi)], ['Catenelle', n0(c.catenelle)], ['Passaggi', n0(c.passaggi)], ['Punti', n0(c.punti)], ['Filo', `${n0(c.filoMm / 1000)} m`],
      ['Tagli delle basi sulle corsie', n0(c.tagliSulleCorsie)], ['Corsia più lontana', `${c.corsiaPiuLontanaMm} mm`], ['Passi lunghi rimasti', n0(c.passiLunghi)], ['Salti rimasti nei moduli', n0(c.movimentiLunghi)], ['Catenella per cm²', `${n0(c.catenellaPerCm2)} mm`], ...(par.infittisci ? [['Linee nuove', n0(c.lineeNuove)] as [string, string], ['Maglie rimaste intere, ogni due moduli', n0(c.maglieIntere)] as [string, string]] : [])];
    $('conti').innerHTML = righe.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('misure').textContent = `${n0(c.punti)} punti · ${n0(c.filoMm / 1000)} m`;
    stato(`${n0(c.moduli)} moduli in ${Math.round(performance.now() - t0)} ms.${c.passiLunghi ? ` ${n0(c.passiLunghi)} passi lunghi: i capi sono lontani dal bordo.` : ''}`);
    (['exportBtn', 'exportDstBtn'] as const).forEach((id) => { ($(id) as HTMLButtonElement).disabled = !c.punti; });
    disegna();
    if (adattaDopo) { pz.fit(); adattaDopo = false; }
  }
  const riquadro = (): { x0: number; y0: number; w: number; h: number } => riquadroRete(anello, esito?.oggetti ?? []);
  function disegna(): void {
    if (!esito) return;
    const maglie = ($('vMaglie') as HTMLInputElement).checked;
    const d = (t: Xy[]): string => t.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('');
    const pezzi: Record<'base' | 'passaggio' | 'catenella' | 'uscita', string[]> = { base: [], passaggio: [], catenella: [], uscita: [] };
    for (const o of esito.oggetti) pezzi[o.uscita ? 'uscita' : o.tipo].push(d(o.tipo === 'catenella' && !maglie ? o.t : o.punti));
    const r = riquadro();
    const strato = (chi: 'base' | 'passaggio' | 'catenella' | 'uscita', id: string, largo: number): string => (($(id) as HTMLInputElement).checked ? `<path fill="none" stroke="${COLORI[chi]}" stroke-width="${largo}" stroke-linejoin="round" d="${pezzi[chi].join('')}"/>` : '');
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}mm" height="${r.h}mm" viewBox="${r.x0} ${r.y0} ${r.w} ${r.h}">${strato('base', 'vBasi', 0.2)}${strato('passaggio', 'vPassaggi', 0.25)}${strato('catenella', 'vCatenelle', maglie ? 0.12 : 0.35)}${strato('uscita', 'vUscite', 0.7)}<path fill="none" stroke="${COLORI.contorno}" stroke-width="0.4" d="${d(anello)}Z"/></svg>`;
  }

  // ---- gli export: i parametri nel file (R27), il modulo no: è del cliente ------------------
  const progetto = (): Record<string, unknown> => ({ rgProject: 'rete-catenella', params: { ...par }, modulo: modulo.nome, ...(zona ? { zona } : {}) });
  const nomeBase = (): string => (sorgente?.name ?? 'rete-catenella').replace(/\.[^.]+$/, '');
  const dstBytes = (): Uint8Array => {
    const strati = stratiRete(esito!);
    return dstFromExportLayers(strati, { center: false, label: nomeBase().toUpperCase().slice(0, 16), metadata: conBusta(progetto(), { strati }) });
  };
  $('exportBtn').addEventListener('click', async () => {
    if (!esito) return;
    const strati = stratiRete(esito), r = riquadro();
    const svg = buildSvg(strati, { bounds: { minX: r.x0, minY: r.y0, maxX: r.x0 + r.w, maxY: r.y0 + r.h }, marginMm: 0, metadata: conBusta(progetto(), { strati }) });
    const nome = `${nomeBase()}-rete.svg`;
    stato(saveOutcomeMessage(await saveTextFile(svg, { suggestedName: nome, description: 'Immagine SVG' }), nome));
  });
  $('exportDstBtn').addEventListener('click', async () => {
    if (!esito) return;
    const nome = `${nomeBase()}-rete.dst`;
    stato(saveOutcomeMessage(await saveBinaryFile(dstBytes(), { suggestedName: nome, ...DST_FILE }), nome));
  });
  const riapri = (m: Record<string, unknown> | null, da: string): void => {
    if (!m || m.rgProject !== 'rete-catenella') { $('progettoStatus').textContent = `${da} non porta dentro un progetto di Rete a catenella.`; return; }
    Object.assign(par, m.params as Partial<ParametriRete>);
    for (const l of LIMITI) impostaNumero($(l.key) as HTMLInputElement, par[l.key]);
    for (const k of ['corsie', 'collegaModuli', 'psilVero', 'infittisci'] as const) ($(k) as HTMLInputElement).checked = par[k];
    zona = Array.isArray(m.zona) ? m.zona as Xy[] : null;
    $('zonaStatus').textContent = zona ? 'Solo dentro la zona del progetto.' : 'Dappertutto.';
    $('zonaViaBtn').hidden = !zona;
    $('progettoStatus').textContent = `${da}: parametri ripresi. Il modulo era «${String(m.modulo ?? '?')}»: se non è questo, ricaricalo.`;
    genera();
  };
  ($('progettoInput') as HTMLInputElement).addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (/\.dst$/i.test(f.name)) riapri(readDstMetadata(new Uint8Array(await f.arrayBuffer())), f.name);
    else riapri(readProjectMetadata(await f.text()) as Record<string, unknown> | null, f.name);
  });

  // ---- la simulazione e Stilista ----------------------------------------------------
  sim = collegaSimula({
    pulsante: $('simBtn') as HTMLButtonElement, host: $('layer'), controlli: $('simControlli'), stato,
    dati: (): DatiSimulazione | null => {
      if (!esito?.conti.punti) return null;
      const strati = stratiRete(esito), r = riquadro();
      return { dst: dstBytes(), colori: strati.map((s) => s.color), larghezzaMm: r.w, altezzaMm: r.h, origine: { x: r.x0, y: r.y0 } };
    },
    ripristina: () => disegna(),
    senzaDati: 'Niente da simulare: serve un contorno.',
  });
  const aggancio: AggancioStilista = {
    carica: (svg, nome) => caricaContorno(svg, nome),
    sorgente: () => sorgente?.text ?? null,
    strati: () => stratiCuciti(esito ? stratiRete(esito) : []),
    dst: () => ({ bytes: dstBytes(), nome: nomeBase() }),
    stato,
  };
  collegaStilista(aggancio, { prendi: $('fromStilista') });
  // col psil vero le catenelle sono oggetti di Stilista; senza, tutto il ricamo arriva coi punti del tool
  $('toStilistaBtn').addEventListener('click', () => {
    if (!par.psilVero || !esito) { void inviaAStilista(aggancio); return; }
    void reteAStilista(esito, par, sorgente ? origineStilista(sorgente.text) : null, stato);
  });

  try {
    const ricordato = localStorage.getItem(MODULO_RICORDATO);
    if (ricordato) usaModulo(ricordato, 'modulo');
  } catch { /* si riparte dal modulo di esempio */ }
  mostraPassi();
  caricaContorno(CONTORNO_ESEMPIO(), 'contorno-di-esempio.svg');
}

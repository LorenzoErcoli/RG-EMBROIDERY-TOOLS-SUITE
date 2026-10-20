import '@rg/ui/rg.css';
import './punto-maglia.css';
import { buildSvg, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata, type ExportLayer } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import ICONS from '../../../packages/design-system/icons/rg-icons.svg?url';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveBinaryFile, saveOutcomeMessage, saveTextFile } from '@rg/ui/save';
import {
  PARAMETRI_MAGLIA, VERSIONE_MAGLIA, cerchio, cuci, latoInternoCi, curva, eChiuso, leggiProgetto, lineaTratto, progetto, strati,
  type Colonne, type ParametriMaglia, type Pt, type Risultato, type Tratto,
} from './motore';

// ---------------------------------------------------------------- i campi del pannello

interface Campo { chiave: keyof ParametriMaglia; etichetta: string; unita?: string; min: number; max: number; intero?: boolean; aiuto?: string; largo?: boolean }
// Etichette e limiti come nel registro (packages/cervello/src/tool/punto-maglia.ts). I default sono quelli del campione.
const CAMPI: Campo[] = [
  { chiave: 'larghezzaVMm', etichetta: 'Larghezza V', unita: 'mm', min: 1, max: 6 },
  { chiave: 'altezzaVMm', etichetta: 'Altezza V', unita: 'mm', min: 1, max: 8 },
  { chiave: 'passoMm', etichetta: 'Passo', unita: 'mm', min: 0.5, max: 8 },
  { chiave: 'rientroMm', etichetta: 'Rientro dei lati', unita: 'mm', min: 0, max: 2 },
  { chiave: 'passateCentro', etichetta: 'Passate del centro', min: 2, max: 8, intero: true, aiuto: 'per gamba; pari, così si torna sulla punta' },
  { chiave: 'passateLati', etichetta: 'Passate dei lati', min: 1, max: 6, intero: true },
  { chiave: 'margineIncrocioMm', etichetta: 'Margine negli incroci', unita: 'mm', min: -3, max: 5, largo: true, aiuto: 'oltre il bordo del tratto sopra si tolgono le righe di quello sotto' },
];

const fmt = (v: number): string => String(Math.round(v * 1000) / 1000).replace('.', ',');
const leggi = (s: string): number => parseFloat(s.trim().replace(',', '.'));
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

type Modo = 'modifica' | 'nuovo' | 'cerchio' | 'aggiungi' | 'punti';
const AIUTI: Record<Modo, string> = {
  modifica: 'Trascina un punto per spostarlo; clic su un tratto per sceglierlo. Alt+clic o doppio clic su un punto: ad angolo ↔ morbido. Canc toglie il punto scelto.',
  nuovo: 'Clic per mettere i punti della linea centrale (Alt+clic: l’altro tipo di punto); Invio o doppio clic per finire, Esc per annullare.',
  cerchio: 'Premi sul centro e trascina fino al raggio: dove lasci il mouse comincia la cucitura.',
  aggiungi: 'Clic vicino al tratto scelto: aggiunge un punto dove passa la curva.',
  punti: 'I punti di ricamo del tratto scelto: trascinane uno per spostarlo a mano (tutte le passate che ci passano si spostano insieme).',
};

/** La tela vuota di partenza, in mm. */
const TELA = { w: 160, h: 120 };
const MARGINE_MM = 10;

/** Monta il tool "Punto maglia" dentro `root`. `backHref` = link di ritorno alla home suite. */
export function mountPuntoMaglia(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const icona = (nome: string, cls = ''): string => `<svg class="rg-icon${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="${ICONS}#rg-icon-${nome}"></use></svg>`;
  root.innerHTML = `
  ${topbar('Punto maglia', opts.backHref)}
  <div class="rg-workspace pm-workspace">
    <aside class="rg-workspace__panel">
      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Disegno</h3></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lblStrumento">Strumento sull’anteprima</span>
            <div class="rg-segmented pm-segmented" id="strumenti" role="group" aria-labelledby="lblStrumento" aria-describedby="aiutoStrumento">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-modo="modifica" aria-pressed="true">Modifica</button>
              <button type="button" class="rg-segmented__item" data-modo="nuovo" aria-pressed="false">Nuovo tratto</button>
              <button type="button" class="rg-segmented__item" data-modo="cerchio" aria-pressed="false">Cerchio</button>
              <button type="button" class="rg-segmented__item" data-modo="aggiungi" aria-pressed="false">Aggiungi punto</button>
              <button type="button" class="rg-segmented__item" data-modo="punti" aria-pressed="false">Punti di ricamo</button>
            </div>
            <span class="rg-field__help" id="aiutoStrumento" role="status"></span>
          </div>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label" id="lblTipoPunto">Punti nuovi</span>
            <div class="rg-segmented" id="tipoPunto" role="group" aria-labelledby="lblTipoPunto">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-v="morbido" aria-pressed="true">Morbidi (curva)</button>
              <button type="button" class="rg-segmented__item" data-v="angolo" aria-pressed="false">Ad angolo (dritti)</button>
            </div>
          </div>
          <div class="rg-cluster rg-param-grid__wide">
            <button id="annullaBtn" class="rg-button rg-button--ghost rg-button--small" type="button" disabled>Annulla</button>
            <button id="esempioBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Esempio</button>
            <button id="svuotaBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Svuota</button>
          </div>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" data-sez="riferimento" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">02</span><span class="rg-param-section__title">Immagine di riferimento</span></summary>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="rifFile" accept="image/*" hidden>
              <span class="rg-button rg-button--outline">Carica immagine…</span>
            </label>
            <p class="rg-file-input__status" id="rifStatus" role="status">Nessuna immagine.</p>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Larghezza</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="rifLarghezza" type="text" inputmode="decimal" value="110"><span>mm</span></span>
            <span class="rg-field__help">La misura vera del logo: la V resta di 2,5 mm, il disegno si proporziona alla V.</span>
          </label>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Opacità</span>
            <span class="pm-range"><input type="range" id="rifOpacita" min="0" max="100" step="5" value="50"><output class="rg-mono" for="rifOpacita" id="rifOpacitaVal">50 %</output></span>
          </label>
          <div class="rg-cluster rg-param-grid__wide">
            <label class="rg-choice"><input type="checkbox" id="rifMostra" checked><span>Mostra</span></label>
            <button id="rifTogli" class="rg-button rg-button--ghost rg-button--small" type="button">Togli</button>
          </div>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="tratti" open>
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">03</span><span class="rg-param-section__title">Tratti</span></summary>
        <div class="rg-param-grid">
          <div class="rg-param-grid__wide">
            <span class="rg-field__label" id="lblTratti">Ordine (i successivi stanno sopra negli incroci)</span>
            <ol class="rg-list" id="listaTratti" aria-labelledby="lblTratti"></ol>
            <div class="rg-empty pm-empty" id="trattiVuoto" hidden><p>Nessun tratto. Scegli «Nuovo tratto» e fai clic sull’anteprima.</p></div>
          </div>
          <fieldset class="pm-tratto-sel rg-param-grid__wide" id="trattoSel">
            <legend class="rg-field__label">Tratto selezionato</legend>
            <div class="rg-field"><span class="rg-field__label" id="lblCentro">Centro</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblCentro" data-campo="colonne">
                <button type="button" class="rg-segmented__item" data-v="1" aria-pressed="false">1</button>
                <button type="button" class="rg-segmented__item" data-v="1.5" aria-pressed="false">1,5</button>
                <button type="button" class="rg-segmented__item" data-v="2" aria-pressed="false">2</button>
              </div><span class="rg-field__help">colonne di V</span></div>
            <div class="rg-field"><span class="rg-field__label" id="lblPunte">Punte delle V</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblPunte" data-campo="versoV">
                <button type="button" class="rg-segmented__item" data-v="avanti" aria-pressed="false">Avanti</button>
                <button type="button" class="rg-segmented__item" data-v="indietro" aria-pressed="false">Indietro</button>
              </div><span class="rg-field__help">avanti = verso l’ultimo punto disegnato</span></div>
            <div class="rg-field"><span class="rg-field__label" id="lblInizio">Si comincia da</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblInizio" data-campo="inizio">
                <button type="button" class="rg-segmented__item" data-v="capo" aria-pressed="false">Capo</button>
                <button type="button" class="rg-segmented__item" data-v="coda" aria-pressed="false">Coda</button>
              </div><span class="rg-field__help">il capo è il primo punto disegnato (quadrato)</span></div>
            <div class="rg-field" id="rigaFine"><span class="rg-field__label" id="lblFine">Finisce</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblFine" data-fine>
                <button type="button" class="rg-segmented__item" data-v="" aria-pressed="false">Dove comincia</button>
                <button type="button" class="rg-segmented__item" data-v="altroCapo" aria-pressed="false">All’altro capo</button>
              </div><span class="rg-field__help" id="aiutoFine"></span></div>
            <div class="rg-field" id="rigaMezza" hidden><span class="rg-field__label" id="lblMezza">Mezza colonna</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblMezza" data-campo="mezza">
                <button type="button" class="rg-segmented__item" data-v="destra" aria-pressed="false">Destra</button>
                <button type="button" class="rg-segmented__item" data-v="sinistra" aria-pressed="false">Sinistra</button>
              </div><span class="rg-field__help">guardando verso le punte</span></div>
            <label class="rg-choice" id="rigaChiuso"><input type="checkbox" id="trattoChiuso"><span>Tratto chiuso</span></label>
            <label class="rg-field" id="rigaRaggio" hidden>
              <span class="rg-field__label">Raggio del cerchio</span>
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="raggio" type="text" inputmode="decimal"><span>mm</span></span>
              <span class="rg-field__help">sulla linea centrale; il quadratino dice dove si comincia</span>
            </label>
            <label class="rg-choice" id="rigaAngolo" hidden><input type="checkbox" id="puntoAngolo"><span>Punto scelto ad angolo</span></label>
            <div class="rg-cluster" id="rigaPunto" hidden>
              <button id="eliminaPunto" class="rg-button rg-button--ghost rg-button--small" type="button">Elimina il punto scelto</button>
              <button id="cominciaQui" class="rg-button rg-button--ghost rg-button--small" type="button">Comincia da questo punto</button>
            </div>
            <div id="righeStretto">
              ${['Capo', 'Coda'].map((c) => `<div class="rg-field pm-stretto"><span class="rg-field__label" id="lblStretto${c}">Al ${c.toLowerCase()} si stringe a</span>
                <div class="rg-segmented" role="group" aria-labelledby="lblStretto${c}" data-stretto="${c}">
                  <button type="button" class="rg-segmented__item" data-v="" aria-pressed="false">No</button>
                  <button type="button" class="rg-segmented__item" data-v="1" aria-pressed="false">1</button>
                  <button type="button" class="rg-segmented__item" data-v="1.5" aria-pressed="false">1,5</button>
                  <button type="button" class="rg-segmented__item" data-v="2" aria-pressed="false">2</button>
                </div>
                <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="strettoMm${c}" type="text" inputmode="decimal" aria-label="Da quanti mm prima del ${c.toLowerCase()} comincia a stringersi"><span>mm</span></span>
                <label class="rg-choice"><input type="checkbox" id="strettoSecco${c}"><span>Secco (senza passi di mezza colonna)</span></label>
                <span class="rg-field__help">comincia a cambiare a questa distanza dal ${c.toLowerCase()}</span></div>`).join('')}
            </div>
            <div class="rg-field"><span class="rg-field__label" id="lblPassate">Passate del centro</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblPassate" data-passate>
                <button type="button" class="rg-segmented__item" data-v="" aria-pressed="false">Come il cordoncino</button>
                <button type="button" class="rg-segmented__item" data-v="2" aria-pressed="false">2</button>
                <button type="button" class="rg-segmented__item" data-v="4" aria-pressed="false">4</button>
              </div><span class="rg-field__help">2 = più leggero (per i pezzi piccoli)</span></div>
            <div class="rg-field" id="rigaInterno" hidden><span class="rg-field__label" id="lblInterno">Lato verso il centro</span>
              <div class="rg-segmented" role="group" aria-labelledby="lblInterno" data-interno>
                <button type="button" class="rg-segmented__item" data-v="" aria-pressed="false">Automatico</button>
                <button type="button" class="rg-segmented__item" data-v="si" aria-pressed="false">Sì</button>
                <button type="button" class="rg-segmented__item" data-v="no" aria-pressed="false">No</button>
              </div><span class="rg-field__help" id="aiutoInterno"></span></div>
            <div class="rg-cluster" id="rigaNodo" hidden>
              <button id="togliNodo" class="rg-button rg-button--ghost rg-button--small" type="button">Togli il punto di ricamo scelto</button>
            </div>
            <div class="rg-cluster" id="rigaRitocchi" hidden>
              <span class="rg-field__help" id="contaRitocchi"></span>
              <button id="togliRitocchi" class="rg-button rg-button--ghost rg-button--small" type="button">Togli i ritocchi</button>
            </div>
          </fieldset>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="cordoncino">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">04</span><span class="rg-param-section__title">Cordoncino</span></summary>
        <div class="rg-param-grid" id="campi"></div>
      </details>

      <details class="rg-param-section rg-disclosure" data-sez="preset">
        <summary class="rg-param-section__header rg-disclosure__trigger"><span class="rg-param-section__index">05</span><span class="rg-param-section__title">Preset</span></summary>
        <div class="rg-param-grid">
          <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome del preset</span><input class="rg-input" id="presetNome" type="text"></label>
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
          <label class="rg-choice" title="Lati (mezze catene) in ocra e centro rialzato in blu, come lo schema approvato; spenta = il filo tutto di un colore."><input type="checkbox" id="schema" checked><span>Schema a colori</span></label>
          <label class="rg-choice"><input type="checkbox" id="mostraPassaggi"><span>Mostra i passaggi</span></label>
          <label class="rg-choice"><input type="checkbox" id="mostraLinee" checked><span>Mostra le linee</span></label>
          <label class="rg-choice" title="Dove comincia (numero) e finisce (quadratino) ogni tratto, e il salto col taglio da un tratto al successivo."><input type="checkbox" id="mostraOrdine" checked><span>Mostra l’ordine</span></label>
          <label class="rg-file-input__control"><input type="file" id="apriProgetto" accept=".svg,.dst" hidden><span class="rg-button rg-button--ghost rg-button--small">Apri progetto…</span></label>
          <button id="exportBtn" class="rg-button rg-button--outline rg-button--small" type="button" disabled>Esporta SVG</button>
          <button id="exportDstBtn" class="rg-button rg-button--outline rg-button--small" type="button" disabled>Esporta DST</button>
          <button id="fitBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Adatta</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status" role="status">Pronto</span>
        <span id="punti" class="rg-mono">0 punti</span>
        <span id="zoom" class="rg-mono">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => root.querySelector<T>('#' + id)!;

  // ---------------------------------------------------------------- lo stato
  let tratti: Tratto[] = [];
  const par: ParametriMaglia = { ...PARAMETRI_MAGLIA };
  let sel = -1;            // tratto scelto
  let selPunto = -1;       // punto scelto del tratto scelto
  let modo: Modo = 'modifica';
  let bozza: Pt[] | null = null; // il tratto che si sta disegnando
  let bozzaAngoli: boolean[] = [];
  let tipoNuovo: 'morbido' | 'angolo' = 'morbido';
  let cerchioBozza: { c: Pt; p: Pt } | null = null; // il cerchio che si sta tirando
  let risultato: Risultato | null = null;
  let nomeFile = '';
  const rif = { url: '', larghezzaMm: 110, aspetto: 1, opacita: 0.5, mostra: true };
  const storia: string[] = [];

  /** Prima di una modifica: si mette da parte lo stato per Annulla. */
  const ricorda = (): void => { storia.push(JSON.stringify({ tratti, sel })); if (storia.length > 100) storia.shift(); ($('annullaBtn') as HTMLButtonElement).disabled = false; };
  const annulla = (): void => {
    const s = storia.pop(); if (!s) return;
    const o = JSON.parse(s) as { tratti: Tratto[]; sel: number }; tratti = o.tratti; sel = o.sel; selPunto = -1; bozza = null;
    ($('annullaBtn') as HTMLButtonElement).disabled = !storia.length;
    tuttoDaCapo();
  };

  // ---------------------------------------------------------------- il pannello
  const salvaApertura = (): void => {
    try { const o: Record<string, boolean> = {}; root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => { o[d.dataset.sez as string] = d.open; }); localStorage.setItem('punto-maglia.sezioni', JSON.stringify(o)); } catch { /* senza archivio il pannello resta com'e' */ }
  };
  try {
    const o = JSON.parse(localStorage.getItem('punto-maglia.sezioni') ?? 'null') as Record<string, boolean> | null;
    if (o) root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => { if (o[d.dataset.sez as string] !== undefined) d.open = o[d.dataset.sez as string]; });
  } catch { /* idem */ }
  root.querySelectorAll<HTMLDetailsElement>('details[data-sez]').forEach((d) => d.addEventListener('toggle', salvaApertura));

  function costruisciCampi(): void {
    const host = $('campi'); host.innerHTML = '';
    for (const c of CAMPI) {
      const lab = document.createElement('label');
      lab.className = 'rg-field' + (c.largo || c.aiuto ? ' rg-param-grid__wide' : '');
      const inp = `<input class="rg-input rg-input--numeric" data-chiave="${c.chiave}" type="text" inputmode="${c.intero ? 'numeric' : 'decimal'}" value="${fmt(par[c.chiave])}">`;
      lab.innerHTML = `<span class="rg-field__label">${c.etichetta}</span>${c.unita ? `<span class="rg-field-with-unit">${inp}<span>${c.unita}</span></span>` : inp}${c.aiuto ? `<span class="rg-field__help">${c.aiuto}</span>` : ''}`;
      host.appendChild(lab);
    }
  }
  $('campi').addEventListener('change', (e) => {
    const inp = e.target as HTMLInputElement; const c = CAMPI.find((q) => q.chiave === inp.dataset.chiave); if (!c) return;
    let v = leggi(inp.value);
    if (Number.isNaN(v)) v = par[c.chiave];
    v = Math.min(c.max, Math.max(c.min, c.intero ? Math.round(v) : v));
    if (c.chiave === 'passateCentro' && v % 2) v += v < c.max ? 1 : -1; // pari: si torna sulla punta
    par[c.chiave] = v; inp.value = fmt(v);
    ricalcola();
  });

  const impostaSegmented = (g: HTMLElement, v: string): void => {
    g.querySelectorAll<HTMLButtonElement>('.rg-segmented__item').forEach((b) => { const on = (b.dataset.v ?? b.dataset.modo) === v; b.classList.toggle('rg-segmented__item--active', on); b.setAttribute('aria-pressed', String(on)); });
  };

  function impostaModo(m: Modo): void {
    if (modo === 'nuovo' && m !== 'nuovo') finisciBozza();
    modo = m;
    impostaSegmented($('strumenti'), m);
    $('aiutoStrumento').textContent = AIUTI[m];
    const cv = $('canvas'); cv.classList.toggle('pm-modo-nuovo', m === 'nuovo' || m === 'cerchio'); cv.classList.toggle('pm-modo-aggiungi', m === 'aggiungi');
    if (m !== 'punti') selNodo = null;
    costruisciTrattoSel(); // i bottoni del punto scelto cambiano con lo strumento
    disegna(); // le maniglie fuori da «Nuovo tratto»; i passaggi coi «Punti di ricamo»
  }
  $('strumenti').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-modo]'); if (b) impostaModo(b.dataset.modo as Modo); });
  $('tipoPunto').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-v]'); if (!b) return;
    tipoNuovo = b.dataset.v as 'morbido' | 'angolo'; impostaSegmented($('tipoPunto'), tipoNuovo);
  });

  function costruisciLista(): void {
    const ol = $('listaTratti');
    $('trattiVuoto').hidden = tratti.length > 0; ol.hidden = !tratti.length;
    ol.innerHTML = tratti.map((t, i) => {
      const n = risultato?.tratti[i]?.cucitura;
      const meta = n ? `${n.punti.length} punti${n.righeTolte ? ` · ${n.righeTolte} righe sotto` : ''}` : '';
      return `<li class="rg-list-row${i === sel ? ' is-selected' : ''}"${i === sel ? ' aria-current="true"' : ''} data-i="${i}">
        <div class="rg-list-row__head">
          <span class="pm-tratto__num rg-mono" aria-hidden="true">${i + 1}</span>
          <input class="rg-input pm-tratto__nome" type="text" value="${esc(t.nome)}" aria-label="Nome del tratto ${i + 1}">
        </div>
        <div class="rg-list-row__meta">
          <span class="rg-mono">${meta}</span>
          <span class="rg-list-row__actions">
            <button type="button" class="rg-icon-button" data-az="su" aria-label="Sposta su: va sotto negli incroci"${i === 0 ? ' disabled' : ''}>${icona('indietro', 'pm-icona-su')}</button>
            <button type="button" class="rg-icon-button" data-az="giu" aria-label="Sposta giù: va sopra negli incroci"${i === tratti.length - 1 ? ' disabled' : ''}>${icona('avanti', 'pm-icona-giu')}</button>
            <button type="button" class="rg-icon-button rg-icon-button--danger" data-az="elimina" aria-label="Elimina il tratto ${i + 1}">${icona('elimina')}</button>
          </span>
        </div>
      </li>`;
    }).join('');
    costruisciTrattoSel();
  }
  function costruisciTrattoSel(): void {
    const t = tratti[sel];
    ($('trattoSel') as HTMLFieldSetElement).disabled = !t;
    const fs = $('trattoSel');
    fs.querySelectorAll<HTMLElement>('[data-campo]').forEach((g) => impostaSegmented(g, t ? String(t[g.dataset.campo as keyof Tratto]) : ''));
    const cerchio = t?.forma === 'cerchio', chiuso = !!t && eChiuso(t);
    $('rigaMezza').hidden = !t || (t.colonne !== 1.5 && t.strettoCapo?.colonne !== 1.5 && t.strettoCoda?.colonne !== 1.5);
    $('rigaChiuso').hidden = cerchio;
    ($('trattoChiuso') as HTMLInputElement).checked = !!t?.chiuso;
    $('rigaRaggio').hidden = !cerchio;
    if (cerchio) ($('raggio') as HTMLInputElement).value = fmt(Math.round(raggioDi(t) * 100) / 100);
    $('rigaAngolo').hidden = !t || cerchio || selPunto < 0;
    $('rigaPunto').hidden = !t || selPunto < 0 || modo === 'punti';
    ($('eliminaPunto') as HTMLButtonElement).hidden = !t || cerchio || t.punti.length <= 2;
    // da dove comincia: un tratto chiuso a mano da qualunque suo punto; il cerchio dal quadratino (trascinalo)
    ($('cominciaQui') as HTMLButtonElement).hidden = !t || cerchio || !t.chiuso || selPunto <= 0;
    $('rigaFine').hidden = !t || chiuso;
    impostaSegmented(root.querySelector<HTMLElement>('[data-fine]')!, t?.fine ?? '');
    $('aiutoFine').textContent = t?.fine === 'altroCapo' ? 'lato A in giù, lato B in su, centro in giù: niente ritorno, si esce dall’altro capo' : 'come il campione: lato A in giù, ritorno, lato B in giù, centro in su';
    $('rigaNodo').hidden = !t || modo !== 'punti' || !selNodo;
    ($('puntoAngolo') as HTMLInputElement).checked = !!t?.angoli?.[selPunto];
    // il tratto che si stringe ai capi: solo sui tratti aperti
    $('righeStretto').hidden = !t || chiuso;
    for (const c of ['Capo', 'Coda'] as const) {
      const st = t?.[c === 'Capo' ? 'strettoCapo' : 'strettoCoda'];
      impostaSegmented(root.querySelector<HTMLElement>(`[data-stretto="${c}"]`)!, st ? String(st.colonne) : '');
      const inp = $(`strettoMm${c}`) as HTMLInputElement; inp.value = st ? fmt(st.mm) : ''; inp.disabled = !st; inp.placeholder = st ? '' : '—';
      const sec = $(`strettoSecco${c}`) as HTMLInputElement; sec.checked = !!st?.secco; sec.disabled = !st;
    }
    impostaSegmented(root.querySelector<HTMLElement>('[data-passate]')!, t?.passateCentro ? String(t.passateCentro) : '');
    $('rigaInterno').hidden = !cerchio;
    if (cerchio) {
      impostaSegmented(root.querySelector<HTMLElement>('[data-interno]')!, t.latoInterno === undefined ? '' : t.latoInterno ? 'si' : 'no');
      $('aiutoInterno').textContent = latoInternoCi(raggioDi(t), t.colonne, par) ? 'automatico: c’è posto, resta' : 'automatico: qui non ci sta (si ammucchierebbe al centro), si toglie';
    }
    const nr = (t?.ritocchi?.spostati.length ?? 0) + (t?.ritocchi?.tolti?.length ?? 0);
    $('rigaRitocchi').hidden = !nr;
    const ns = t?.ritocchi?.spostati.length ?? 0, nt = t?.ritocchi?.tolti?.length ?? 0;
    $('contaRitocchi').textContent = [ns ? `${ns} ${ns === 1 ? 'punto spostato' : 'punti spostati'}` : '', nt ? `${nt} ${nt === 1 ? 'punto tolto' : 'punti tolti'}` : ''].filter(Boolean).join(', ') + ' a mano';
  }
  const raggioDi = (t: Tratto): number => Math.hypot(t.punti[1][0] - t.punti[0][0], t.punti[1][1] - t.punti[0][1]);
  $('listaTratti').addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (!li) return;
    const i = Number(li.dataset.i);
    const az = (e.target as HTMLElement).closest<HTMLElement>('[data-az]')?.dataset.az;
    if (az === 'su' && i > 0) { ricorda(); [tratti[i - 1], tratti[i]] = [tratti[i], tratti[i - 1]]; sel = i - 1; ricalcola(); return; }
    if (az === 'giu' && i < tratti.length - 1) { ricorda(); [tratti[i + 1], tratti[i]] = [tratti[i], tratti[i + 1]]; sel = i + 1; ricalcola(); return; }
    if (az === 'elimina') { ricorda(); tratti.splice(i, 1); sel = Math.min(sel, tratti.length - 1); selPunto = -1; ricalcola(); return; }
    if (sel !== i) { sel = i; selPunto = -1; costruisciLista(); disegna(); }
  });
  $('listaTratti').addEventListener('focusin', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (!li) return;
    const i = Number(li.dataset.i); if (sel === i) return;
    sel = i; selPunto = -1;
    root.querySelectorAll('#listaTratti .rg-list-row').forEach((r, k) => { r.classList.toggle('is-selected', k === i); if (k === i) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current'); });
    costruisciTrattoSel(); disegna();
  });
  $('listaTratti').addEventListener('change', (e) => {
    const inp = e.target as HTMLInputElement; if (!inp.classList.contains('pm-tratto__nome')) return;
    const i = Number(inp.closest<HTMLElement>('[data-i]')!.dataset.i); ricorda(); tratti[i].nome = inp.value.trim() || `Tratto ${i + 1}`;
  });
  $('trattoSel').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-v]'); const t = tratti[sel];
    if (b && t && b.closest('[data-fine]')) { ricorda(); if (b.dataset.v) t.fine = 'altroCapo'; else delete t.fine; ricalcola(); return; }
    if (b && t && b.closest('[data-passate]')) { ricorda(); if (b.dataset.v) t.passateCentro = Number(b.dataset.v); else delete t.passateCentro; ricalcola(); return; }
    if (b && t && b.closest('[data-interno]')) { ricorda(); if (b.dataset.v) t.latoInterno = b.dataset.v === 'si'; else delete t.latoInterno; ricalcola(); return; }
    const gs = b?.closest<HTMLElement>('[data-stretto]');
    if (b && gs && t) { // si stringe al capo / alla coda: colonne (No = non si stringe) e da quanti mm
      ricorda();
      const chiave = gs.dataset.stretto === 'Capo' ? 'strettoCapo' : 'strettoCoda';
      if (!b.dataset.v) delete t[chiave];
      else t[chiave] = { colonne: Number(b.dataset.v) as Colonne, mm: t[chiave]?.mm ?? 10, ...(t[chiave]?.secco ? { secco: true } : {}) };
      ricalcola(); return;
    }
    const g = b?.closest<HTMLElement>('[data-campo]');
    if (!b || !g || !t) return;
    ricorda();
    const campo = g.dataset.campo as 'colonne' | 'versoV' | 'inizio' | 'mezza', v = b.dataset.v as string;
    if (campo === 'colonne') t.colonne = Number(v) as Colonne;
    else if (campo === 'versoV') t.versoV = v as Tratto['versoV'];
    else if (campo === 'inizio') t.inizio = v as Tratto['inizio'];
    else t.mezza = v as Tratto['mezza'];
    ricalcola();
  });
  $('trattoChiuso').addEventListener('change', () => { const t = tratti[sel]; if (!t) return; ricorda(); t.chiuso = ($('trattoChiuso') as HTMLInputElement).checked; ricalcola(); });
  $('raggio').addEventListener('change', () => {
    const t = tratti[sel]; if (t?.forma !== 'cerchio') return;
    const r = leggi(($('raggio') as HTMLInputElement).value), r0 = raggioDi(t);
    if (Number.isNaN(r) || r <= 0 || r0 <= 0) { costruisciTrattoSel(); return; }
    ricorda();
    const [c, p] = t.punti; t.punti[1] = [c[0] + ((p[0] - c[0]) * r) / r0, c[1] + ((p[1] - c[1]) * r) / r0]; // stessa direzione: il capo resta lì
    ricalcola();
  });
  $('puntoAngolo').addEventListener('change', () => {
    const t = tratti[sel]; if (!t || selPunto < 0) return;
    ricorda(); cambiaAngolo(t, selPunto, ($('puntoAngolo') as HTMLInputElement).checked); ricalcola();
  });
  for (const c of ['Capo', 'Coda'] as const) $(`strettoSecco${c}`).addEventListener('change', () => {
    const t = tratti[sel]; const st = t?.[c === 'Capo' ? 'strettoCapo' : 'strettoCoda']; if (!st) return;
    ricorda(); if (($(`strettoSecco${c}`) as HTMLInputElement).checked) st.secco = true; else delete st.secco; ricalcola();
  });
  for (const c of ['Capo', 'Coda'] as const) $(`strettoMm${c}`).addEventListener('change', () => {
    const t = tratti[sel]; const st = t?.[c === 'Capo' ? 'strettoCapo' : 'strettoCoda']; if (!st) return;
    const v = leggi(($(`strettoMm${c}`) as HTMLInputElement).value);
    if (!Number.isNaN(v) && v >= 0) { ricorda(); st.mm = v; }
    ricalcola();
  });
  $('togliRitocchi').addEventListener('click', () => { const t = tratti[sel]; if (!t?.ritocchi) return; ricorda(); delete t.ritocchi; selNodo = null; ricalcola(); });
  $('eliminaPunto').addEventListener('click', () => eliminaPunto());
  $('cominciaQui').addEventListener('click', () => {
    const t = tratti[sel]; if (!t || !t.chiuso || t.forma === 'cerchio' || selPunto <= 0) return;
    ricorda();
    t.punti = [...t.punti.slice(selPunto), ...t.punti.slice(0, selPunto)];
    if (t.angoli) t.angoli = [...t.angoli.slice(selPunto), ...t.angoli.slice(0, selPunto)];
    delete t.ritocchi; selPunto = 0; ricalcola();
  });
  $('togliNodo').addEventListener('click', () => togliNodo());

  /** Toglie il punto scelto della linea (non il cerchio, e un tratto resta di almeno due punti). */
  function eliminaPunto(): void {
    const t = tratti[sel]; if (!t || selPunto < 0) return;
    if (t.forma === 'cerchio') { $('status').textContent = 'Il cerchio ha il centro e il punto d’inizio: per toglierlo usa il cestino nella lista.'; return; }
    if (t.punti.length <= 2) { $('status').textContent = 'Un tratto ha almeno due punti: per toglierlo usa il cestino nella lista.'; return; }
    ricorda(); t.punti.splice(selPunto, 1); t.angoli?.splice(selPunto, 1); selPunto = -1; ricalcola();
  }

  /** Toglie il punto di ricamo scelto: il filo non passa più da quel buco (tutte le passate). */
  function togliNodo(): void {
    const t = tratti[sel], c = risultato?.tratti[sel]?.cucitura;
    if (!t || !selNodo || !c?.firma) return;
    ricorda();
    const r = t.ritocchi?.firma === c.firma ? t.ritocchi : { firma: c.firma, spostati: [] };
    const da = selNodo;
    r.spostati = r.spostati.filter((q) => !(Math.abs(q.da[0] - da[0]) < 0.005 && Math.abs(q.da[1] - da[1]) < 0.005));
    r.tolti = [...(r.tolti ?? []), [da[0], da[1]]];
    t.ritocchi = r; selNodo = null; ricalcola();
  }

  /** Un punto ad angolo o morbido (l'elenco degli angoli si crea solo quando serve). */
  function cambiaAngolo(t: Tratto, k: number, angolo: boolean): void {
    const a = t.angoli ?? t.punti.map(() => false);
    a[k] = angolo; t.angoli = a.some(Boolean) ? a : undefined;
    if (!t.angoli) delete t.angoli;
  }

  // ---------------------------------------------------------------- il calcolo e l'anteprima
  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; disegnaSopra(); });

  function ricalcola(): void {
    risultato = tratti.length ? cuci(tratti, par) : null;
    const n = risultato?.punti ?? 0;
    $('punti').textContent = `${n.toLocaleString('it-IT')} punti`;
    ($('exportBtn') as HTMLButtonElement).disabled = !n; ($('exportDstBtn') as HTMLButtonElement).disabled = !n;
    $('status').textContent = risultato?.avvisi.length ? risultato.avvisi.join(' · ') : tratti.length ? `${tratti.length} tratti` : 'Pronto';
    costruisciLista(); disegna();
  }
  const tuttoDaCapo = (): void => ricalcola();

  /** L'area di lavoro: la tela, l'immagine e tutti i tratti, con un margine. Cresce, non si stringe mentre si disegna. */
  let area = { x: 0, y: 0, w: TELA.w, h: TELA.h };
  function calcolaArea(): void {
    let x0 = 0, y0 = 0, x1 = TELA.w, y1 = TELA.h;
    if (rif.url) { x1 = Math.max(x1, rif.larghezzaMm); y1 = Math.max(y1, rif.larghezzaMm * rif.aspetto); }
    for (const t of tratti) {
      const pts = t.forma === 'cerchio' && t.punti.length >= 2 ? (() => { const [c] = t.punti, r = raggioDi(t); return [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]] as Pt[]; })() : t.punti;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    area = { x: x0 - MARGINE_MM, y: y0 - MARGINE_MM, w: x1 - x0 + 2 * MARGINE_MM, h: y1 - y0 + 2 * MARGINE_MM };
  }

  const percorso = (pts: Pt[], chiudi = false): string => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('') + (chiudi ? 'Z' : '');

  function disegna(): void {
    if (!trascina) calcolaArea();
    let filo = '', lati = '', pass = '';
    for (const rt of risultato?.tratti ?? []) {
      const c = rt.cucitura;
      for (let i = 1; i < c.punti.length; i++) {
        const s = `M${c.punti[i - 1][0].toFixed(2)} ${c.punti[i - 1][1].toFixed(2)}L${c.punti[i][0].toFixed(2)} ${c.punti[i][1].toFixed(2)}`;
        if (c.tipi[i] === 'gamba') filo += s; else if (c.tipi[i] === 'lato') lati += s; else pass += s;
      }
    }
    const mostraPass = ($('mostraPassaggi') as HTMLInputElement).checked || modo === 'punti';
    const img = rif.url && rif.mostra ? `<image class="pm-rif-img" href="${rif.url}" x="0" y="0" width="${rif.larghezzaMm}" height="${rif.larghezzaMm * rif.aspetto}" opacity="${rif.opacita}" preserveAspectRatio="none" />` : '';
    const schema = ($('schema') as HTMLInputElement).checked;
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" id="pmSvg"${schema ? ' class="pm-schema"' : ''} width="${area.w}mm" height="${area.h}mm" viewBox="${area.x} ${area.y} ${area.w} ${area.h}">
      <rect class="pm-tela" x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" />
      ${img}
      <path class="pm-filo pm-filo--lati" d="${lati}" />
      <path class="pm-filo pm-filo--centro" d="${filo}" />
      ${mostraPass ? `<path class="pm-passaggi" d="${pass}" />` : ''}
      <g id="pmOver"></g>
    </svg>`;
    disegnaSopra();
  }

  /** Quanto e' grande un pixel dello schermo, in mm del disegno. */
  function mmPerPixel(): number {
    const svg = root.querySelector<SVGSVGElement>('#pmSvg'); const m = svg?.getScreenCTM();
    return m ? 1 / Math.max(1e-6, Math.hypot(m.a, m.b)) : 1;
  }

  /** Una maniglia: quadrato = capo (dove comincia), rombo = punto ad angolo, tondo = punto morbido, croce = centro del cerchio. */
  const maniglia = (x: number, y: number, r: number, forma: 'capo' | 'angolo' | 'morbido' | 'centro', cls: string, hit: string): string => {
    const h = hit ? ` data-hit="${hit}"` : '';
    if (forma === 'capo') return `<rect class="${cls}"${h} x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" />`;
    if (forma === 'angolo') { const q = r * 1.3; return `<path class="${cls}"${h} d="M${x} ${y - q}L${x + q} ${y}L${x} ${y + q}L${x - q} ${y}Z" />`; }
    if (forma === 'centro') return `<path class="${cls} pm-maniglia--centro"${h} d="M${x - r} ${y}h${2 * r}M${x} ${y - r}v${2 * r}" /><circle class="${cls}"${h} cx="${x}" cy="${y}" r="${r * 0.6}" />`;
    return `<circle class="${cls}"${h} cx="${x}" cy="${y}" r="${r}" />`;
  };

  /** Le linee centrali, le maniglie del tratto scelto, la bozza: si ridisegnano da sole, senza ricalcolare il filo. */
  function disegnaSopra(cursore?: Pt): void {
    const g = root.querySelector<SVGGElement>('#pmOver'); if (!g) return;
    const px = mmPerPixel(), r = 5 * px;
    const linee = ($('mostraLinee') as HTMLInputElement).checked;
    let s = '';
    tratti.forEach((t, i) => {
      if (t.punti.length < 2) return;
      const d = percorso(lineaTratto(t), eChiuso(t));
      if (linee || (i === sel && modo !== 'punti')) s += `<path class="pm-linea${i === sel ? ' is-sel' : ''}" d="${d}" />`;
      if (modo !== 'punti') s += `<path class="pm-hit" data-hit="linea:${i}" d="${d}" />`;
    });
    const t = tratti[sel];
    if (t && modo === 'punti') {
      // i punti di ricamo del tratto scelto: uno per buco (le passate che ci tornano sono lo stesso punto)
      const c = risultato?.tratti[sel]?.cucitura;
      const visti = new Set<string>();
      c?.punti.forEach(([x, y], i) => {
        const k = `${x.toFixed(3)},${y.toFixed(3)}`; if (visti.has(k)) return; visti.add(k);
        const spostato = !!t.ritocchi?.spostati.some((q) => Math.abs(q.a[0] - x) < 0.005 && Math.abs(q.a[1] - y) < 0.005);
        const o = c.originali?.[i], scelto = !!(selNodo && o && Math.abs(o[0] - selNodo[0]) < 0.005 && Math.abs(o[1] - selNodo[1]) < 0.005);
        s += `<circle class="pm-nodo${spostato ? ' is-spostato' : ''}${scelto ? ' is-sel' : ''}" data-hit="nodo:${i}" cx="${x}" cy="${y}" r="${r * (scelto ? 0.8 : 0.55)}" />`;
      });
    } else if (t && modo !== 'nuovo' && modo !== 'cerchio') {
      if (t.forma === 'cerchio' && t.punti.length >= 2) {
        s += maniglia(t.punti[0][0], t.punti[0][1], r, 'centro', `pm-maniglia${selPunto === 0 ? ' is-sel' : ''}`, 'punto:0');
        s += maniglia(t.punti[1][0], t.punti[1][1], r, 'capo', `pm-maniglia${selPunto === 1 ? ' is-sel' : ''}`, 'punto:1');
      } else t.punti.forEach(([x, y], k) => {
        s += maniglia(x, y, k === selPunto ? r * 1.2 : r, k === 0 ? 'capo' : t.angoli?.[k] ? 'angolo' : 'morbido', `pm-maniglia${k === selPunto ? ' is-sel' : ''}`, `punto:${k}`);
      });
    }
    if (bozza?.length) {
      const pts = cursore ? [...bozza, cursore] : bozza;
      const ang = cursore ? [...bozzaAngoli, false] : bozzaAngoli;
      s += `<path class="pm-bozza" d="${percorso(pts.length >= 2 ? curva(pts, false, ang) : pts)}" />`;
      bozza.forEach(([x, y], k) => { s += maniglia(x, y, r, k === 0 ? 'capo' : bozzaAngoli[k] ? 'angolo' : 'morbido', 'pm-maniglia', ''); });
    }
    if (cerchioBozza) {
      const { c, p } = cerchioBozza;
      s += `<path class="pm-bozza" d="${percorso(cerchio(c, p), true)}" />` + maniglia(c[0], c[1], r, 'centro', 'pm-maniglia', '') + maniglia(p[0], p[1], r, 'capo', 'pm-maniglia', '');
    }
    if (($('mostraOrdine') as HTMLInputElement).checked && modo !== 'punti') s += ordine(px);
    g.innerHTML = s;
  }

  /**
   * L'ordine di cucitura sull'anteprima: dove comincia ogni tratto (il suo numero), dove finisce (quadratino) e il salto
   * col taglio dalla fine di un tratto all'inizio del successivo (tratteggio). Il primo è l'inizio di tutto, l'ultimo la fine.
   */
  function ordine(px: number): string {
    const fatti = (risultato?.tratti ?? []).map((rt, i) => ({ i, c: rt.cucitura.punti })).filter((q) => q.c.length >= 2);
    let s = '';
    const fs = 11 * px, r = 7 * px;
    fatti.forEach((q, j) => {
      const a = q.c[0], b = q.c[q.c.length - 1];
      const dopo = fatti[j + 1];
      if (dopo) s += `<path class="pm-salto" d="M${b[0]} ${b[1]}L${dopo.c[0][0]} ${dopo.c[0][1]}" />`;
      s += `<rect class="pm-fine" x="${b[0] - r * 0.6}" y="${b[1] - r * 0.6}" width="${r * 1.2}" height="${r * 1.2}" />`;
      s += `<circle class="pm-inizio" cx="${a[0]}" cy="${a[1]}" r="${r}" /><text class="pm-ordine-num" x="${a[0]}" y="${a[1] + fs * 0.36}" font-size="${fs}">${q.i + 1}</text>`;
      if (j === 0) s += `<text class="pm-ordine-etichetta" x="${a[0] + r * 1.4}" y="${a[1] - r}" font-size="${fs}">inizio</text>`;
      if (j === fatti.length - 1) s += `<text class="pm-ordine-etichetta" x="${b[0] + r * 1.2}" y="${b[1] + r * 1.6}" font-size="${fs}">fine</text>`;
    });
    return s;
  }

  // ---------------------------------------------------------------- il disegno sull'anteprima
  function aMm(e: MouseEvent): Pt {
    const svg = root.querySelector<SVGSVGElement>('#pmSvg'); const m = svg?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
  }

  const nuovoTratto = (punti: Pt[], o: Partial<Tratto> = {}): Tratto => ({ nome: `Tratto ${tratti.length + 1}`, punti, chiuso: false, colonne: 1, versoV: 'avanti', inizio: 'capo', mezza: 'destra', ...o });

  function finisciBozza(): void {
    if (!bozza) return;
    const b = bozza, a = bozzaAngoli; bozza = null; bozzaAngoli = [];
    if (b.length >= 2) {
      ricorda();
      tratti.push(nuovoTratto(b, a.some(Boolean) ? { angoli: a } : {}));
      sel = tratti.length - 1; selPunto = -1;
      ricalcola();
    } else disegnaSopra();
  }

  /** Dove infilare un punto nuovo fra i punti di controllo: fra i due che si allungano meno. */
  function dovInserire(t: Tratto, p: Pt): number {
    const d = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const n = t.punti.length, segs = t.chiuso ? n : n - 1;
    let best = 1, costo = Infinity;
    for (let i = 0; i < segs; i++) { const a = t.punti[i], b = t.punti[(i + 1) % n]; const c = d(a, p) + d(p, b) - d(a, b); if (c < costo) { costo = c; best = i + 1; } }
    // oltre i capi di un tratto aperto: si allunga
    if (!t.chiuso) { if (d(p, t.punti[0]) < costo && d(p, t.punti[0]) < d(p, t.punti[1])) return 0; }
    return best;
  }

  let spazio = false;
  let trascina: { k: number; mosso: boolean; da?: Pt[] } | null = null;
  let trascinaNodo: { i: number; mosso: boolean } | null = null;
  /** Il punto di ricamo scelto (dove stava nel cordoncino calcolato), per toglierlo. */
  let selNodo: Pt | null = null;
  window.addEventListener('keydown', (e) => {
    const inCampo = !!(e.target as HTMLElement).closest('input,select,textarea');
    if (e.code === 'Space' && !inCampo && !(e.target as HTMLElement).closest('button')) spazio = true;
    if (!root.isConnected) return;
    if (e.key === 'Enter' && modo === 'nuovo' && !inCampo) { finisciBozza(); e.preventDefault(); }
    if (e.key === 'Escape') { if (bozza || cerchioBozza) { bozza = null; bozzaAngoli = []; cerchioBozza = null; disegnaSopra(); } else { selPunto = -1; impostaModo('modifica'); costruisciTrattoSel(); } }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !inCampo) { annulla(); e.preventDefault(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inCampo && modo === 'punti' && selNodo) { togliNodo(); e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inCampo && tratti[sel] && selPunto >= 0 && modo !== 'punti') {
      const t = tratti[sel];
      if (t.forma === 'cerchio') $('status').textContent = 'Il cerchio ha il centro e il punto d’inizio: per toglierlo usa il cestino nella lista.';
      else if (t.punti.length > 2) { ricorda(); t.punti.splice(selPunto, 1); t.angoli?.splice(selPunto, 1); selPunto = -1; ricalcola(); }
      else $('status').textContent = 'Un tratto ha almeno due punti: per toglierlo usa il cestino nella lista.';
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spazio = false; });
  window.addEventListener('blur', () => { spazio = false; });

  // in cattura e PRIMA del pan: se l'azione e' dello strumento, il pan non parte
  $('canvas').addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || spazio || !root.querySelector('#pmSvg')) return;
    const hit = (e.target as Element).closest('[data-hit]') as SVGElement | null;
    const [tipo, is] = (hit?.dataset.hit ?? ':').split(':'); const i = Number(is);
    const p = aMm(e);
    if (modo === 'nuovo') {
      bozza ??= [];
      const q = bozza.at(-1);
      // Alt+clic mette l'altro tipo di punto (come il tasto Alt della penna di Illustrator)
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) { bozza.push(p); bozzaAngoli.push((tipoNuovo === 'angolo') !== e.altKey); }
      disegnaSopra();
    } else if (modo === 'cerchio') {
      cerchioBozza = { c: p, p };
    } else if (modo === 'aggiungi') {
      if (tipo === 'linea') { sel = i; }
      const t = tratti[sel];
      if (!t) { $('status').textContent = 'Scegli prima un tratto.'; return; }
      if (t.forma === 'cerchio') { $('status').textContent = 'Il cerchio è una forma precisa: non prende punti in più.'; return; }
      ricorda();
      const k = dovInserire(t, p); t.punti.splice(k, 0, p);
      if (t.angoli) t.angoli.splice(k, 0, (tipoNuovo === 'angolo') !== e.altKey); else if ((tipoNuovo === 'angolo') !== e.altKey) cambiaAngolo(t, k, true);
      selPunto = k;
      ricalcola();
    } else if (modo === 'punti') {
      if (tipo !== 'nodo') return; // sullo sfondo: pan
      trascinaNodo = { i, mosso: false };
    } else if (tipo === 'punto') {
      const t = tratti[sel];
      if (e.altKey && t && t.forma !== 'cerchio') { ricorda(); cambiaAngolo(t, i, !t.angoli?.[i]); selPunto = i; ricalcola(); }
      else { selPunto = i; trascina = { k: i, mosso: false, da: t?.punti.map((q) => [q[0], q[1]] as Pt) }; costruisciTrattoSel(); disegnaSopra(); }
    } else if (tipo === 'linea') {
      sel = i; selPunto = -1; costruisciLista(); disegnaSopra(); return;
    } else return; // modifica sullo sfondo: pan
    $('canvas').setPointerCapture(e.pointerId);
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);

  let rinfresco = 0;
  const rifaiPresto = (): void => { if (!rinfresco) rinfresco = requestAnimationFrame(() => { rinfresco = 0; risultato = cuci(tratti, par); disegna(); }); };
  $('canvas').addEventListener('pointermove', (e: PointerEvent) => {
    if (modo === 'nuovo' && bozza?.length) { disegnaSopra(aMm(e)); return; }
    if (cerchioBozza) { cerchioBozza.p = aMm(e); disegnaSopra(); return; }
    if (trascinaNodo) {
      const t = tratti[sel], c = risultato?.tratti[sel]?.cucitura;
      if (!t || !c?.originali || !c.firma) return;
      if (!trascinaNodo.mosso) { ricorda(); trascinaNodo.mosso = true; }
      const da = c.originali[trascinaNodo.i], a = aMm(e);
      // i ritocchi valgono per QUESTO cordoncino: se erano di uno vecchio, si ricomincia
      const r = t.ritocchi?.firma === c.firma ? t.ritocchi : { firma: c.firma, spostati: [] };
      const q = r.spostati.find((s) => Math.abs(s.da[0] - da[0]) < 0.005 && Math.abs(s.da[1] - da[1]) < 0.005);
      if (q) q.a = a; else r.spostati.push({ da: [da[0], da[1]], a });
      t.ritocchi = r;
      rifaiPresto(); return;
    }
    if (!trascina || !tratti[sel]) return;
    const t = tratti[sel];
    if (!trascina.mosso) { ricorda(); trascina.mosso = true; }
    const p = aMm(e);
    if (t.forma === 'cerchio' && trascina.k === 0 && trascina.da) { // il centro si porta dietro il cerchio intero
      const dx = p[0] - trascina.da[0][0], dy = p[1] - trascina.da[0][1];
      t.punti = trascina.da.map(([x, y]) => [x + dx, y + dy] as Pt);
    } else t.punti[trascina.k] = p;
    // il filo si rifà al ritmo dello schermo, le maniglie subito
    disegnaSopra();
    rifaiPresto();
  });
  const finisciTrascina = (e: PointerEvent): void => {
    try { $('canvas').releasePointerCapture(e.pointerId); } catch { /* gia' rilasciato */ }
    if (cerchioBozza) {
      const { c, p } = cerchioBozza; cerchioBozza = null;
      if (Math.hypot(p[0] - c[0], p[1] - c[1]) >= 2) {
        ricorda();
        tratti.push(nuovoTratto([c, p], { forma: 'cerchio', nome: `Cerchio ${tratti.length + 1}` }));
        sel = tratti.length - 1; selPunto = -1; ricalcola();
      } else { $('status').textContent = 'Trascina dal centro fino al raggio (almeno 2 mm).'; disegnaSopra(); }
      return;
    }
    if (trascinaNodo) {
      const { i, mosso } = trascinaNodo; trascinaNodo = null;
      const o = risultato?.tratti[sel]?.cucitura.originali?.[i];
      selNodo = o ? [o[0], o[1]] : null; // il punto appena preso resta scelto: Canc o il bottone lo tolgono
      if (mosso) ricalcola(); else { costruisciTrattoSel(); disegnaSopra(); }
      return;
    }
    if (!trascina) return;
    const t = trascina; trascina = null;
    if (t.mosso) ricalcola();
  };
  $('canvas').addEventListener('pointerup', finisciTrascina);
  $('canvas').addEventListener('pointercancel', finisciTrascina);
  $('canvas').addEventListener('dblclick', (e) => {
    if (modo === 'nuovo') { finisciBozza(); e.preventDefault(); return; }
    // doppio clic su un punto: ad angolo ↔ morbido
    const hit = (e.target as Element).closest('[data-hit^="punto:"]') as SVGElement | null; const t = tratti[sel];
    if (modo === 'modifica' && hit && t && t.forma !== 'cerchio') {
      const k = Number((hit.dataset.hit as string).split(':')[1]);
      ricorda(); cambiaAngolo(t, k, !t.angoli?.[k]); selPunto = k; ricalcola();
    }
  });

  $('mostraPassaggi').addEventListener('change', disegna);
  $('schema').addEventListener('change', disegna);
  $('mostraLinee').addEventListener('change', () => disegnaSopra());
  $('mostraOrdine').addEventListener('change', () => disegnaSopra());
  $('fitBtn').addEventListener('click', () => pz.fit());
  $('annullaBtn').addEventListener('click', annulla);
  $('svuotaBtn').addEventListener('click', () => { if (!tratti.length) return; ricorda(); tratti = []; sel = -1; selPunto = -1; ricalcola(); });
  $('esempioBtn').addEventListener('click', () => {
    ricorda();
    const T = (nome: string, punti: Pt[], o: Partial<Tratto> = {}): Tratto => ({ nome, punti, chiuso: false, colonne: 1, versoV: 'avanti', inizio: 'capo', mezza: 'destra', ...o });
    // una «D» (la gamba sotto, l'arco sopra), una «o» a cerchio, una «i» che si stringe ai capi e una «z» ad angoli
    tratti = [T('D gamba', [[30, 15], [30, 55], [30, 95]], { colonne: 2 }), T('D arco', [[15, 22], [55, 22], [85, 55], [55, 90], [15, 90]], { colonne: 1.5 }), T('o', [[120, 70], [120, 60]], { forma: 'cerchio' }), T('i', [[150, 40], [150, 95]], { colonne: 2, strettoCapo: { colonne: 1, mm: 12 }, strettoCoda: { colonne: 1, mm: 12 } }), T('z', [[165, 40], [195, 40], [165, 95], [195, 95]], { angoli: [false, true, true, false] })];
    sel = 1; selPunto = -1; ricalcola(); pz.fit();
  });

  // ---------------------------------------------------------------- l'immagine di riferimento
  const aggiornaRif = (): void => {
    $('rifStatus').textContent = rif.url ? `${nomeImmagine} · ${fmt(rif.larghezzaMm)} × ${fmt(Math.round(rif.larghezzaMm * rif.aspetto * 10) / 10)} mm` : 'Nessuna immagine.';
    disegna();
  };
  let nomeImmagine = '';
  $('rifFile').addEventListener('change', () => {
    const f = ($('rifFile') as HTMLInputElement).files?.[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const url = String(fr.result); const im = new Image();
      im.onload = () => { rif.url = url; rif.aspetto = im.naturalHeight / Math.max(1, im.naturalWidth); nomeImmagine = f.name; aggiornaRif(); pz.fit(); };
      im.onerror = () => { $('rifStatus').textContent = 'Immagine non leggibile.'; };
      im.src = url;
    };
    fr.readAsDataURL(f);
    ($('rifFile') as HTMLInputElement).value = '';
  });
  $('rifLarghezza').addEventListener('change', () => {
    const v = leggi(($('rifLarghezza') as HTMLInputElement).value);
    if (!Number.isNaN(v) && v > 0) rif.larghezzaMm = v;
    ($('rifLarghezza') as HTMLInputElement).value = fmt(rif.larghezzaMm); aggiornaRif();
  });
  $('rifOpacita').addEventListener('input', () => {
    const v = Number(($('rifOpacita') as HTMLInputElement).value); rif.opacita = v / 100; $('rifOpacitaVal').textContent = `${v} %`;
    const im = root.querySelector('.pm-rif-img'); if (im) im.setAttribute('opacity', String(rif.opacita));
  });
  $('rifMostra').addEventListener('change', () => { rif.mostra = ($('rifMostra') as HTMLInputElement).checked; disegna(); });
  $('rifTogli').addEventListener('click', () => { rif.url = ''; nomeImmagine = ''; aggiornaRif(); });

  // ---------------------------------------------------------------- export e progetto
  const datiProgetto = (): Record<string, unknown> => ({ ...progetto(par, tratti), immagine: rif.url ? { larghezzaMm: rif.larghezzaMm } : undefined }) as unknown as Record<string, unknown>;
  const nomeBase = (): string => nomeFile || 'punto-maglia';

  $('exportBtn').addEventListener('click', async () => {
    if (!risultato || !risultato.punti) return;
    const linee: ExportLayer = { id: 'linee', color: '#8a8a8a', strokeMm: 0.2, shapeOnly: true, polylines: tratti.filter((t) => t.punti.length >= 2).map((t) => lineaTratto(t).map(([x, y]) => ({ x, y }))) };
    const layers = [...strati(risultato), linee];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of layers) for (const pl of l.polylines) for (const p of pl) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    const svg = buildSvg(layers, { bounds: { minX, minY, maxX, maxY }, marginMm: 5, metadata: datiProgetto() });
    const name = `${nomeBase()}.svg`;
    const outcome = await saveTextFile(svg, { suggestedName: name, description: 'Immagine SVG' });
    $('status').textContent = saveOutcomeMessage(outcome, name);
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!risultato || !risultato.punti) return;
    // un ago, un tratto per blocco col taglio prima (come il campione); i parametri e i tratti nel footer (R27)
    let bytes: Uint8Array;
    try {
      bytes = dstFromExportLayers(strati(risultato), { label: (nomeBase() || 'MAGLIA').toUpperCase().slice(0, 16), metadata: datiProgetto() });
    } catch (e) { $('status').textContent = (e as Error).message; return; }
    const name = `${nomeBase()}.dst`;
    const outcome = await saveBinaryFile(bytes, { suggestedName: name, ...DST_FILE });
    $('status').textContent = `${saveOutcomeMessage(outcome, name)} · ${risultato.punti.toLocaleString('it-IT')} punti · ${(bytes.length / 1024).toFixed(1)} KB`;
  });

  $('apriProgetto').addEventListener('change', async () => {
    const f = ($('apriProgetto') as HTMLInputElement).files?.[0]; if (!f) return;
    ($('apriProgetto') as HTMLInputElement).value = '';
    const meta = f.name.toLowerCase().endsWith('.dst') ? readDstMetadata(new Uint8Array(await f.arrayBuffer())) : readProjectMetadata(await f.text());
    const p = leggiProgetto(meta);
    if (!p) { $('status').textContent = `«${f.name}» non è un progetto Punto maglia (un SVG o un DST usciti da qui).`; return; }
    ricorda();
    Object.assign(par, p.params); tratti = p.tratti; sel = tratti.length ? 0 : -1; selPunto = -1;
    nomeFile = f.name.replace(/\.(svg|dst)$/i, '');
    const im = (meta as { immagine?: { larghezzaMm?: number } }).immagine;
    if (im?.larghezzaMm) { rif.larghezzaMm = im.larghezzaMm; ($('rifLarghezza') as HTMLInputElement).value = fmt(im.larghezzaMm); }
    costruisciCampi(); ricalcola(); pz.fit();
    $('status').textContent = `Aperto «${f.name}»: ${tratti.length} tratti${im ? ' (l’immagine di riferimento non è nel file: ricaricala)' : ''}.`;
  });

  // ---------------------------------------------------------------- i preset (solo i parametri del cordoncino)
  const CHIAVE_PRESET = 'punto-maglia.preset';
  const leggiPreset = (): Record<string, ParametriMaglia> => { try { return JSON.parse(localStorage.getItem(CHIAVE_PRESET) ?? '{}') as Record<string, ParametriMaglia>; } catch { return {}; } };
  const scriviPreset = (o: Record<string, ParametriMaglia>): void => { try { localStorage.setItem(CHIAVE_PRESET, JSON.stringify(o)); } catch { $('status').textContent = 'Preset non salvato: archivio del browser non disponibile.'; } };
  function elencaPreset(): void {
    const nomi = Object.keys(leggiPreset());
    $('presetLista').innerHTML = nomi.length ? nomi.map((n) => `<option>${esc(n)}</option>`).join('') : '<option value="">(nessuno)</option>';
  }
  const applicaParametri = (p: Partial<ParametriMaglia>): void => {
    const l = leggiProgetto({ rgProject: 'punto-maglia', params: p as Record<string, unknown> });
    if (l) Object.assign(par, l.params);
    costruisciCampi(); ricalcola();
  };
  $('presetSalva').addEventListener('click', () => {
    const nome = ($('presetNome') as HTMLInputElement).value.trim(); if (!nome) { $('status').textContent = 'Dai un nome al preset.'; return; }
    const o = leggiPreset(); o[nome] = { ...par }; scriviPreset(o); elencaPreset(); ($('presetLista') as HTMLSelectElement).value = nome;
  });
  $('presetCarica').addEventListener('click', () => { const p = leggiPreset()[($('presetLista') as HTMLSelectElement).value]; if (p) applicaParametri(p); });
  $('presetElimina').addEventListener('click', () => { const o = leggiPreset(); delete o[($('presetLista') as HTMLSelectElement).value]; scriviPreset(o); elencaPreset(); });
  $('presetEsporta').addEventListener('click', async () => {
    const nome = ($('presetLista') as HTMLSelectElement).value || 'corrente';
    const p = leggiPreset()[nome] ?? par;
    const outcome = await saveTextFile(JSON.stringify({ [nome]: p }, null, 2), { suggestedName: `preset-punto-maglia-${nome}.json`, description: 'Preset JSON' });
    $('status').textContent = saveOutcomeMessage(outcome, `preset-punto-maglia-${nome}.json`);
  });
  $('presetImporta').addEventListener('change', async () => {
    const f = ($('presetImporta') as HTMLInputElement).files?.[0]; if (!f) return;
    try { const o = JSON.parse(await f.text()) as Record<string, ParametriMaglia>; const tutti = leggiPreset(); Object.assign(tutti, o); scriviPreset(tutti); elencaPreset(); }
    catch { $('status').textContent = 'File di preset non leggibile.'; }
    ($('presetImporta') as HTMLInputElement).value = '';
  });

  // ---------------------------------------------------------------- avvio
  costruisciCampi(); elencaPreset(); impostaModo('modifica');
  ricalcola(); pz.fit();
  $('status').textContent = `Pronto · versione ${VERSIONE_MAGLIA}: carica una foto da ricalcare o scegli «Nuovo tratto».`;
}

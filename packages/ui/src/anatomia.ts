// L'anatomia di un tool RG (U1, AVVIO-INTERFACCIA-COMUNE §3–§4): i pezzi comuni di ogni tool, costruiti qui
// invece che a mano in ogni `tool.ts`. Un tool passa le sue sezioni e questi pezzi mettono ciò che è uguale
// per tutti — l'ordine dei bottoni, i nomi, la sezione 01, il campo numerico — così un tool nuovo non può
// nascere diverso (lo sorveglia il cricchetto «U1» di test/smoke.mjs, con la lista del debito dei tool che
// ancora scrivono a mano).
//
// Le decisioni di Lorenzo (2026-10-13) che questo file mette in pratica:
//   U-D1  export: «Esporta SVG» · «Esporta DST», sempre in quest'ordine a destra; il bottone pieno è il DST;
//   U-D2  un solo campo numerico per tutta la suite, che accetta sia 0,4 sia 0.4, con le frecce ↑↓ per il passo
//         e lo slot dell'unità sempre;
//   U-D3  la sezione 01 si chiama Cartamodello (vettore), Immagine, o Ricamo di partenza (DST);
//   U-D4  «Genera» sempre allo stesso posto, con «Ricalcola da solo».
//
// Le funzioni che costruiscono HTML ritornano stringhe (come `topbar()`): niente DOM, si provano in node.
// Quelle che toccano la pagina (`attivaCampiNumero`, `impostaNumero`) sono in fondo e sono sottili.

import { BOTTONE_INVIA_STILISTA, BOTTONE_PRENDI_STILISTA } from './stilista';

// ---------------------------------------------------------------------------------------------------------
// Numeri: virgola e punto, frecce, limiti — funzioni pure
// ---------------------------------------------------------------------------------------------------------

/**
 * Legge un numero scritto come lo scrive chi lavora in italiano: `0,4` e `0.4` sono la stessa cosa. Un solo
 * separatore (virgola o punto) è decimale. Con tutti e due, l'ultimo è il decimale e l'altro separa le migliaia
 * (`1.000,5` e `1,000.5` fanno 1000,5). Ritorna NaN se non è un numero.
 */
export function leggiNumero(testo: string): number {
  let s = String(testo ?? '').trim().replace(/\s+/g, '');
  if (!s) return NaN;
  const virgole = (s.match(/,/g) ?? []).length;
  const punti = (s.match(/\./g) ?? []).length;
  if (virgole && punti) {
    const decimale = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const migliaia = decimale === ',' ? '.' : ',';
    if ((s.match(decimale === ',' ? /,/g : /\./g) ?? []).length > 1) return NaN;
    s = s.split(migliaia).join('').replace(decimale, '.');
  } else if (virgole > 1 || punti > 1) {
    return NaN;
  } else {
    s = s.replace(',', '.');
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

/** Scrive un numero per il campo: virgola decimale, niente zeri in coda, niente rumore del floating point. */
export function scriviNumero(v: number, decimali?: number): string {
  if (!Number.isFinite(v)) return '';
  const d = decimali ?? 6;
  const t = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  const pulito = t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
  return (pulito === '-0' ? '0' : pulito).replace('.', ',');
}

export interface LimitiNumero { passo?: number; min?: number; max?: number; decimali?: number }

/** Quanti decimali ha un passo (0,05 → 2): servono perché 0,3 − 0,1 non diventi 0,19999999999999998. */
function decimaliDi(passo: number): number {
  const s = String(passo);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return s.split('.')[1]?.length ?? 0;
}

/** Porta un valore dentro min e max (se ci sono). */
export function limitaNumero(v: number, { min, max }: LimitiNumero): number {
  let r = v;
  if (min !== undefined && r < min) r = min;
  if (max !== undefined && r > max) r = max;
  return r;
}

/**
 * Il valore che esce premendo ↑ (`+1`) o ↓ (`-1`) su un campo, come testo. Parte dal numero scritto (se non è un
 * numero, da min o da 0), somma il passo, resta nei limiti. Ritorna null se non c'è un passo.
 */
export function passoNumero(testo: string, direzione: 1 | -1, lim: LimitiNumero): string | null {
  const passo = lim.passo;
  if (!passo || !Number.isFinite(passo) || passo <= 0) return null;
  const letto = leggiNumero(testo);
  const base = Number.isNaN(letto) ? (lim.min ?? 0) : letto;
  const d = lim.decimali ?? Math.max(decimaliDi(passo), decimaliDi(base));
  const nuovo = limitaNumero(Math.round((base + direzione * passo) * 10 ** d) / 10 ** d, lim);
  return scriviNumero(nuovo, d);
}

// ---------------------------------------------------------------------------------------------------------
// HTML: i pezzi
// ---------------------------------------------------------------------------------------------------------

const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const due = (n: number): string => String(n).padStart(2, '0');

export interface OpzioniCampoNumero {
  id: string;
  etichetta: string;
  /** Lo slot dell'unità c'è sempre: per un campo senza unità si passa `''`. L'unità non va mai nell'etichetta. */
  unita: string;
  valore: number | string;
  passo?: number;
  min?: number;
  max?: number;
  /** Una riga sotto il campo (per esempio «0 = usa la misura letta dal file»): NON nell'etichetta. */
  aiuto?: string;
  /** Il campo occupa tutta la riga della griglia. Default: sì se c'è l'aiuto. */
  largo?: boolean;
  /** Attributi in più, già scritti (`data-param="squareSizeMm"`). */
  attributi?: string;
}

/** Il campo numerico della suite (U-D2): `0,4` o `0.4`, frecce ↑↓, unità nello slot. */
export function campoNumero(o: OpzioniCampoNumero): string {
  const largo = o.largo ?? Boolean(o.aiuto);
  const valore = typeof o.valore === 'number' ? scriviNumero(o.valore) : o.valore;
  const dati = [
    'data-numero',
    o.passo !== undefined ? `data-passo="${o.passo}"` : '',
    o.min !== undefined ? `data-min="${o.min}"` : '',
    o.max !== undefined ? `data-max="${o.max}"` : '',
    o.aiuto ? `aria-describedby="${esc(o.id)}-aiuto"` : '',
    o.attributi ?? '',
  ].filter(Boolean).join(' ');
  return `<label class="rg-field${largo ? ' rg-param-grid__wide' : ''}">`
    + `<span class="rg-field__label">${esc(o.etichetta)}</span>`
    + `<span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="${esc(o.id)}" type="text" inputmode="decimal" autocomplete="off" value="${esc(valore)}" ${dati}><span>${esc(o.unita)}</span></span>`
    + (o.aiuto ? `<span class="rg-field__help" id="${esc(o.id)}-aiuto">${esc(o.aiuto)}</span>` : '')
    + `</label>`;
}

export interface OpzioniCampoNumeroInline {
  /** Cosa misura, per chi usa lo screen reader: il campo non ha un'etichetta visibile (sta in una riga di lista). */
  aria: string;
  /** Lo slot dell'unità c'è sempre: per un campo senza unità si passa `''`. */
  unita: string;
  valore: number | string;
  passo?: number;
  min?: number;
  max?: number;
  /** La larghezza del campo (`7ch`), se quella di default è troppo larga per la riga. */
  larghezza?: string;
  titolo?: string;
  disabilitato?: boolean;
}

/**
 * Il campo numerico compatto, per una riga di lista (la densità di un colore, la tolleranza di un campione): lo
 * stesso comportamento di `campoNumero` (virgola o punto, frecce ↑↓, limiti — lo accende `attivaCampiNumero`, anche se la
 * riga nasce dopo), senza etichetta e senza id. Ritorna HTML: si mette in una riga con `innerHTML`.
 */
export function campoNumeroInline(o: OpzioniCampoNumeroInline): string {
  const valore = typeof o.valore === 'number' ? scriviNumero(o.valore) : o.valore;
  const dati = [
    'data-numero',
    o.passo !== undefined ? `data-passo="${o.passo}"` : '',
    o.min !== undefined ? `data-min="${o.min}"` : '',
    o.max !== undefined ? `data-max="${o.max}"` : '',
  ].filter(Boolean).join(' ');
  return `<span class="rg-field-with-unit"${o.larghezza ? ` style="--rg-input-numeric-width: ${esc(o.larghezza)}"` : ''}>`
    + `<input class="rg-input rg-input--numeric" type="text" inputmode="decimal" autocomplete="off" value="${esc(valore)}" aria-label="${esc(o.aria)}"${o.titolo ? ` title="${esc(o.titolo)}"` : ''}${o.disabilitato ? ' disabled' : ''} ${dati}>`
    + `<span>${esc(o.unita)}</span></span>`;
}

export interface OpzioniSezione {
  /** Il numero della sezione (1, 2, 3…): si scrive a due cifre. */
  indice: number;
  titolo: string;
  /** L'HTML dentro la sezione. */
  contenuto: string;
  /** Una sezione che si chiude (`<details>`). La 01 e la 02 di solito no. */
  apribile?: boolean;
  aperta?: boolean;
  /** Un nome stabile per ricordare se è aperta (`data-sez`). */
  id?: string;
}

/** Una sezione numerata del pannello. */
export function sezione(o: OpzioniSezione): string {
  const idx = `<span class="rg-param-section__index">${due(o.indice)}</span>`;
  const sez = o.id ? ` data-sez="${esc(o.id)}"` : '';
  if (!o.apribile) {
    return `<section class="rg-param-section"${sez}>\n  <div class="rg-param-section__header">${idx}<h3 class="rg-param-section__title">${esc(o.titolo)}</h3></div>\n  ${o.contenuto}\n</section>`;
  }
  return `<details class="rg-param-section rg-disclosure"${sez}${o.aperta ? ' open' : ''}>\n  <summary class="rg-param-section__header rg-disclosure__trigger">${idx}<span class="rg-param-section__title">${esc(o.titolo)}</span></summary>\n  ${o.contenuto}\n</details>`;
}

export type TipoSorgente = 'cartamodello' | 'immagine' | 'dst';

/** Il nome della sezione 01 (U-D3). */
export const TITOLO_SORGENTE: Record<TipoSorgente, string> = {
  cartamodello: 'Cartamodello',
  immagine: 'Immagine',
  dst: 'Ricamo di partenza',
};

const CARICA_DEFAULT: Record<TipoSorgente, string> = {
  cartamodello: 'Carica DXF o SVG…',
  immagine: 'Carica immagine…',
  dst: 'Carica DST…',
};

export interface OpzioniSorgente {
  tipo: TipoSorgente;
  /** L'attributo `accept` del file (`.svg,.dxf`). */
  accetta: string;
  /** Il testo del bottone (default per tipo). */
  etichettaCarica?: string;
  /** La riga di stato prima di aver caricato qualcosa. */
  statoIniziale: string;
  /** «Apri progetto o DST…» (default sì). */
  progetto?: boolean;
  /** La larghezza reale in mm (default sì). */
  larghezzaReale?: boolean;
  /** Il bottone dell'esempio pronto: la sua etichetta («Cartamodello demo»). Ogni tool dovrebbe averlo. */
  demo?: string;
  /** HTML in più della sezione, dopo i pezzi comuni. */
  extra?: string;
  /** «Prendi la selezione da Stilista» (RG Stilista Link, `@rg/ui/stilista`), accanto all'esempio pronto. */
  stilista?: boolean;
}

/**
 * La sezione 01, uguale in tutti: caricare, riaprire un progetto, la larghezza reale, l'esempio pronto.
 * Gli id sono fissi (`fileInput`, `fileStatus`, `progettoInput`, `progettoStatus`, `realWidth`, `demoBtn`): il
 * tool li cerca con `$()` come sempre.
 */
export function sezioneSorgente(o: OpzioniSorgente): string {
  const carica = o.etichettaCarica ?? CARICA_DEFAULT[o.tipo];
  const pezzi: string[] = [
    `<div class="rg-file-input rg-param-grid__wide">\n    <label class="rg-file-input__control">\n      <input type="file" id="fileInput" accept="${esc(o.accetta)}" />\n      <span class="rg-button rg-button--outline">${esc(carica)}</span>\n    </label>\n    <p class="rg-file-input__status" id="fileStatus" role="status">${esc(o.statoIniziale)}</p>\n  </div>`,
  ];
  if (o.progetto !== false) {
    pezzi.push(`<div class="rg-file-input rg-param-grid__wide">\n    <label class="rg-file-input__control">\n      <input type="file" id="progettoInput" accept=".svg,.dst" />\n      <span class="rg-button rg-button--outline">Apri progetto o DST…</span>\n    </label>\n    <p class="rg-field__help" id="progettoStatus" role="status">Un SVG o un DST usciti da qui tornano com’erano.</p>\n  </div>`);
  }
  if (o.larghezzaReale !== false) {
    pezzi.push(campoNumero({ id: 'realWidth', etichetta: 'Larghezza reale', unita: 'mm', valore: 0, passo: 1, min: 0, aiuto: '0 = usa la misura letta dal file.', largo: true }));
  }
  if (o.demo || o.stilista) {
    const demo = o.demo ? `<button id="demoBtn" class="rg-button rg-button--ghost rg-button--small" type="button">${esc(o.demo)}</button>` : '';
    pezzi.push(`<div class="rg-cluster rg-param-grid__wide">${demo}${o.stilista ? BOTTONE_PRENDI_STILISTA() : ''}</div>`);
  }
  if (o.extra) pezzi.push(o.extra);
  return sezione({ indice: 1, titolo: TITOLO_SORGENTE[o.tipo], contenuto: `<div class="rg-param-grid">\n  ${pezzi.join('\n  ')}\n</div>` });
}

export interface OpzioniProgetto {
  indice: number;
  /** HTML in più, dopo i preset. */
  extra?: string;
}

/** L'ultima sezione, uguale in tutti: i preset (salva, carica, elimina) e l'import/export dei parametri. */
export function sezioneProgetto(o: OpzioniProgetto): string {
  const contenuto = `<div class="rg-param-grid">
    <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome del preset</span><input class="rg-input" id="presetNome" type="text" /></label>
    <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Preset salvati</span><select class="rg-select" id="presetLista"></select></label>
    <div class="rg-cluster rg-param-grid__wide">
      <button id="presetSalva" class="rg-button rg-button--secondary rg-button--small" type="button">Salva</button>
      <button id="presetCarica" class="rg-button rg-button--ghost rg-button--small" type="button">Carica</button>
      <button id="presetElimina" class="rg-button rg-button--ghost rg-button--small" type="button">Elimina</button>
      <button id="presetEsporta" class="rg-button rg-button--ghost rg-button--small" type="button">Esporta file</button>
      <label class="rg-file-input__control"><input type="file" id="presetImporta" accept=".json" hidden><span class="rg-button rg-button--ghost rg-button--small">Importa file</span></label>
    </div>${o.extra ? '\n    ' + o.extra : ''}
  </div>`;
  return sezione({ indice: o.indice, titolo: 'Progetto', contenuto, apribile: true, aperta: false, id: 'progetto' });
}

export interface OpzioniBarraAnteprima {
  /** Il titolo (default «Anteprima»). */
  titolo?: string;
  /** Le viste proprie del tool (HTML), a sinistra, dopo il titolo. */
  viste?: string;
  /** La casella «Ricalcola da solo»: acceso o spento all'avvio. Assente = il tool ricalcola sempre. */
  ricalcolaDaSolo?: { acceso: boolean; aiuto?: string };
  genera?: boolean;
  simula?: boolean;
  /** Default sì. */
  adatta?: boolean;
  /** Default sì, tutti e due. */
  esportaSvg?: boolean;
  esportaDst?: boolean;
  /** I due export partono spenti, finché non c'è un ricamo. */
  esportaSpenti?: boolean;
  /** «Invia a Stilista» (RG Stilista Link, `@rg/ui/stilista`), subito prima dei due export. */
  inviaStilista?: boolean;
}

/**
 * L'intestazione dell'anteprima, nell'ordine fisso (U-D1, U-D4): titolo e viste a sinistra; a destra
 * «Ricalcola da solo» · Genera · Simula · Adatta · [Invia a Stilista] · Esporta SVG · **Esporta DST** (pieno). Un tool che non ha una
 * cosa lascia il posto vuoto, non riordina. Gli id sono fissi: `autoCalcolo`, `genBtn`, `simBtn`, `fitBtn`,
 * `exportBtn` (SVG), `exportDstBtn`.
 */
export function barraAnteprima(o: OpzioniBarraAnteprima = {}): string {
  const spenti = o.esportaSpenti ? ' disabled' : '';
  const b: string[] = [];
  if (o.ricalcolaDaSolo) {
    const aiuto = o.ricalcolaDaSolo.aiuto ? ` title="${esc(o.ricalcolaDaSolo.aiuto)}"` : '';
    b.push(`<label class="rg-choice"${aiuto}><input type="checkbox" id="autoCalcolo"${o.ricalcolaDaSolo.acceso ? ' checked' : ''}><span>Ricalcola da solo</span></label>`);
  }
  if (o.genera) b.push('<button id="genBtn" class="rg-button rg-button--outline rg-button--small" type="button">Genera</button>');
  if (o.simula) b.push('<button id="simBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Simula</button>');
  if (o.adatta !== false) b.push('<button id="fitBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Adatta</button>');
  if (o.inviaStilista) b.push(BOTTONE_INVIA_STILISTA());
  if (o.esportaSvg !== false) b.push(`<button id="exportBtn" class="rg-button rg-button--outline rg-button--small" type="button"${spenti}>Esporta SVG</button>`);
  if (o.esportaDst !== false) b.push(`<button id="exportDstBtn" class="rg-button rg-button--primary rg-button--small" type="button"${spenti}>Esporta DST</button>`);
  return `<header class="rg-workspace__stage-header">\n        <h2 class="rg-h3">${esc(o.titolo ?? 'Anteprima')}</h2>${o.viste ? '\n        ' + o.viste : ''}\n        <div class="rg-cluster">\n          ${b.join('\n          ')}\n        </div>\n      </header>`;
}

/**
 * La barra di stato: a sinistra il messaggio (`#status`), poi lo spazio del referto (`#misure`: punti · metri di
 * filo · salti, dalla K3) e lo zoom (`#zoom`).
 */
export function barraStato(): string {
  return `<footer class="rg-workspace__statusbar">\n        <span id="status">Pronto</span>\n        <span id="misure" class="rg-mono"></span>\n        <span id="zoom" class="rg-mono">zoom 100%</span>\n      </footer>`;
}

export interface OpzioniScheletro {
  /** La topbar già fatta (`topbar('Rete 45°', backHref)` di `@rg/ui/tools`). */
  topbar: string;
  /** Una classe del tool sul `rg-workspace` (`net45-workspace`), per i suoi stili. */
  classe?: string;
  /** Le sezioni del pannello, già fatte (`sezioneSorgente(...)`, `sezione(...)`…), in ordine. */
  pannello: string[];
  anteprima?: OpzioniBarraAnteprima;
  /** Quello che sta dentro la tela, se non è il solo strato `#layer`. */
  tela?: string;
}

/** Tutto il tool: topbar, pannello, intestazione dell'anteprima, tela, barra di stato. Si assegna a `root.innerHTML`. */
export function scheletro(o: OpzioniScheletro): string {
  const tela = o.tela ?? '<div class="rg-workspace__layer" id="layer" style="--rg-zoom:1;--rg-pan-x:0px;--rg-pan-y:0px"></div>';
  return `${o.topbar}
  <div class="rg-workspace${o.classe ? ' ' + o.classe : ''}">
    <aside class="rg-workspace__panel">
      ${o.pannello.join('\n\n      ')}
    </aside>

    <div class="rg-workspace__stage">
      ${barraAnteprima(o.anteprima)}
      <div class="rg-workspace__canvas" id="canvas">
        ${tela}
      </div>
      ${o.anteprima?.simula ? '<div id="simControlli" class="sim-controlli" hidden></div>\n      ' : ''}${barraStato()}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------------------------------------
// Il comportamento dei campi numerici (la parte che tocca la pagina)
// ---------------------------------------------------------------------------------------------------------

function limitiDi(el: HTMLInputElement): LimitiNumero {
  const n = (k: string): number | undefined => (el.dataset[k] !== undefined && el.dataset[k] !== '' ? Number(el.dataset[k]) : undefined);
  return { passo: n('passo'), min: n('min'), max: n('max') };
}

/** Il numero scritto in un campo (NaN se non lo è). */
export function leggiCampo(el: HTMLInputElement): number {
  return leggiNumero(el.value);
}

/** Scrive un numero in un campo, come si scrive in italiano, e ricorda che è l'ultimo valore buono. */
export function impostaNumero(el: HTMLInputElement, v: number): void {
  el.value = scriviNumero(v);
  el.dataset.ultimo = el.value;
}

/**
 * Accende i campi numerici di `root` (anche quelli aggiunti dopo): le frecce ↑↓ cambiano il valore del passo e
 * lanciano `change`; quando si esce dal campo il testo diventa un numero in regola (virgola, entro min e max) o
 * torna all'ultimo valore buono. Va chiamata una volta, dopo aver messo l'HTML. Il `change` normalizzato arriva
 * ai listener del tool già pulito, perché questo gira prima (fase di cattura).
 */
export function attivaCampiNumero(root: HTMLElement): void {
  const campo = (t: EventTarget | null): HTMLInputElement | null =>
    t instanceof HTMLInputElement && t.hasAttribute('data-numero') ? t : null;

  root.addEventListener('focusin', (e) => {
    const el = campo(e.target);
    if (el && el.dataset.ultimo === undefined) el.dataset.ultimo = el.value;
  });

  root.addEventListener('keydown', (e) => {
    const el = campo(e.target);
    if (!el || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const nuovo = passoNumero(el.value, e.key === 'ArrowUp' ? 1 : -1, limitiDi(el));
    if (nuovo === null) return;
    e.preventDefault();
    el.value = nuovo;
    el.dataset.ultimo = nuovo;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  root.addEventListener('change', (e) => {
    const el = campo(e.target);
    if (!el) return;
    const letto = leggiNumero(el.value);
    if (Number.isNaN(letto)) {
      // non è un numero: si torna all'ultimo valore buono e il tool non vede nessun cambio
      el.value = el.dataset.ultimo ?? '';
      e.stopImmediatePropagation();
      return;
    }
    const lim = limitiDi(el);
    el.value = scriviNumero(limitaNumero(letto, lim));
    el.dataset.ultimo = el.value;
  }, true);
}

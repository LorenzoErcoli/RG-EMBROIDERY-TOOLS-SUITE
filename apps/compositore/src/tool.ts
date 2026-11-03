// Guscio del Compositore (DOM/browser). Il documento è in `documento.ts` e resta puro: qui si aprono i file, si
// sceglie, si trascina, e a ogni cambio si ricompone e si rimisura.
//
// Il Compositore non è un tool come gli altri: non genera punti, mette in fila quelli che i tool (e Stilista) hanno
// già fatto. Per questo non sta nel registro dei tool (`TOOLS`): non ha parametri di punto, né un motore.
//
// Il pannello, in ordine di lavoro:
// 01 Oggetti — si aggiungono i DST e si ordinano (la fila è l'ordine di cucitura);
// 02 Oggetto — quello selezionato: dove sta, con che fili, come ci si arriva;
// 03 Fili — i colori del documento;
// 04 Passaggi — la regola dei tagli e la proposta di un ordine;
// 05 Controllo — quello che conviene guardare prima della macchina.
import '@rg/ui/rg.css';
import './compositore.css';
import { DST_FILE, type Referto } from '@rg/core';
import { topbar, TOOLS } from '@rg/ui/tools';
import { scheletro, sezione, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { collegaSimula, type DatiSimulazione } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  documentoVuoto, documentoEsempio, apriDst, componi, dstNudo, dstDocumento, refertoDi, controlla, contaGiunti,
  ordineProposto, ingombro, sposta, puntiDi, TINTE,
  type Documento, type Oggetto, type Composizione, type Arrivo,
} from './documento';
import { riquadroDi, svgAnteprima, svgEsporta, gruppoSelezione, type Riquadro } from './vista';

const n0 = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 0 });
const n1 = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function unisci(a: Riquadro, b: Riquadro): Riquadro {
  const minX = Math.min(a.minX, b.minX), minY = Math.min(a.minY, b.minY);
  return { minX, minY, larghezza: Math.max(a.minX + a.larghezza, b.minX + b.larghezza) - minX, altezza: Math.max(a.minY + a.altezza, b.minY + b.altezza) - minY };
}

/** Una copia del documento per l'annulla: i blocchi non cambiano mai, quindi si condividono. */
function istantanea(d: Documento): Documento {
  return { nome: d.nome, regole: { ...d.regole }, fili: d.fili.map((f) => ({ ...f })), oggetti: d.oggetti.map((o) => ({ ...o, fili: [...o.fili] })) };
}

export function mountCompositore(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = scheletro({
    topbar: topbar('Compositore', opts.backHref),
    classe: 'cmp-workspace',
    pannello: [
      sezione({
        indice: 1, titolo: 'Oggetti',
        contenuto: `<div class="rg-param-grid">
    <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome del documento</span><input class="rg-input" id="nomeDoc" type="text" value="composizione"></label>
    <div class="rg-file-input rg-param-grid__wide">
      <label class="rg-file-input__control">
        <input type="file" id="fileInput" accept=".dst" multiple />
        <span class="rg-button rg-button--outline">Aggiungi DST…</span>
      </label>
      <p class="rg-file-input__status" id="fileStatus" role="status">I DST dei tool, di Stilista o di una composizione di prima. Si aggiungono in fondo alla fila.</p>
    </div>
    <div class="rg-cluster rg-param-grid__wide">
      <button id="demoBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Esempio</button>
      <button id="nuovoBtn" class="rg-button rg-button--ghost rg-button--small" type="button">Nuovo documento</button>
    </div>
    <ol class="rg-list rg-param-grid__wide cmp-oggetti" id="oggetti"></ol>
    <p class="rg-field__help rg-param-grid__wide">L’ordine della lista è l’ordine di cucitura: il primo si cuce per primo.</p>
  </div>`,
      }),
      sezione({ indice: 2, titolo: 'Oggetto', contenuto: '<div class="rg-param-grid" id="selezionato"></div>' }),
      sezione({ indice: 3, titolo: 'Fili', apribile: true, aperta: true, contenuto: '<ul class="rg-color-map" id="fili"></ul>' }),
      sezione({
        indice: 4, titolo: 'Passaggi', apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid" style="--rg-input-numeric-width: 7ch">
    ${campoNumero({ id: 'tagliaOltre', etichetta: 'Taglia i salti più lunghi di', unita: 'mm', valore: 2, passo: 0.5, min: 0, max: 100, aiuto: 'Fra due oggetti sullo stesso filo. Un salto più corto resta collegato. Si può cambiare a mano oggetto per oggetto (02).' })}
    <dl class="rg-key-value rg-param-grid__wide" id="passaggi"></dl>
    <div class="rg-cluster rg-param-grid__wide">
      <button id="ordinaBtn" class="rg-button rg-button--outline rg-button--small" type="button">Proponi un ordine</button>
      <button id="annullaBtn" class="rg-button rg-button--ghost rg-button--small" type="button" disabled>Annulla</button>
    </div>
    <p class="rg-field__help rg-param-grid__wide">La proposta raggruppa per filo e poi va al più vicino: meno cambi d’ago e salti più corti. Non sa cosa deve coprire cosa: guardala, e se non va annullala.</p>
  </div>`,
      }),
      sezione({ indice: 5, titolo: 'Controllo', apribile: true, aperta: true, contenuto: '<div class="cmp-avvisi" id="avvisi"></div><dl class="rg-key-value" id="referto"></dl>' }),
    ],
    anteprima: {
      simula: true, esportaSpenti: true,
      viste: `<div class="rg-segmented" id="modo" role="group" aria-label="Cosa fa il trascinamento">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-modo="vista" aria-pressed="true">Muovi la vista</button>
        <button type="button" class="rg-segmented__item" data-modo="sposta" aria-pressed="false">Sposta l’oggetto</button>
      </div>`,
    },
  });
  attivaCampiNumero(root);

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const stato = (t: string): void => { $('status').textContent = t; };

  let doc: Documento = documentoVuoto();
  let sel: string | null = null;
  let c: Composizione = componi(doc);
  let referto: Referto | null = null;
  let riquadro: Riquadro = riquadroDi(doc);
  const storia: Documento[] = [];
  let modo: 'vista' | 'sposta' = 'vista';

  const selezionato = (): Oggetto | null => doc.oggetti.find((o) => o.id === sel) ?? null;
  /** Prima di ogni cambio: così «Annulla» torna indietro di un passo. */
  const ricorda = (): void => {
    storia.push(istantanea(doc));
    if (storia.length > 100) storia.shift();
    ($('annullaBtn') as HTMLButtonElement).disabled = false;
  };

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });
  $('fitBtn').addEventListener('click', () => pz.fit());
  const sim = collegaSimula({
    pulsante: $('simBtn') as HTMLButtonElement, host: $('layer'), controlli: $('simControlli'), stato,
    dati: (): DatiSimulazione | null => {
      const dst = dstNudo(doc, c);
      if (!dst) return null;
      const colori = c.sequenzaFili.map((id) => doc.fili.find((f) => f.id === id)?.colore ?? '#000000');
      return { dst, colori, larghezzaMm: riquadro.larghezza, altezzaMm: riquadro.altezza, origine: { x: riquadro.minX, y: riquadro.minY } };
    },
    ripristina: () => disegna(),
    senzaDati: 'Niente da simulare: aggiungi un DST, o accendi un oggetto.',
  });

  // ---- il disegno e i pannelli ----------------------------------------------------------------------
  const disegna = (): void => {
    sim.ferma();
    $('layer').innerHTML = svgAnteprima(doc, c, riquadro, selezionato());
  };

  const nomeTool = (id?: string): string => (id ? TOOLS.find((t) => t.id === id)?.name ?? id : '');
  const tintaFilo = (id: number): string => doc.fili.find((f) => f.id === id)?.colore ?? '#000000';

  const elencoOggetti = (): void => {
    const el = $('oggetti');
    if (!doc.oggetti.length) {
      el.innerHTML = '<li class="rg-field__help">Nessun oggetto: aggiungi un DST o prova l’esempio.</li>';
      return;
    }
    el.innerHTML = doc.oggetti.map((o, i) => {
      const fili = [...new Set(o.fili)].map((f) => `<span class="cmp-tinta" style="background:${tintaFilo(f)}" title="Filo ${f}"></span>`).join('');
      const da = o.tool ? `<span class="rg-badge">${esc(nomeTool(o.tool))}</span>` : '';
      return `<li class="rg-list-row${o.id === sel ? ' is-selected' : ''}${o.spento ? ' cmp-spento' : ''}" data-ogg="${o.id}" aria-selected="${o.id === sel}">
        <div class="rg-list-row__head">
          <button type="button" class="cmp-scegli rg-list-row__title" data-azione="scegli">${i + 1}. ${esc(o.nome)}</button>
          <span class="rg-list-row__actions">
            <button type="button" class="rg-button rg-button--ghost rg-button--small" data-azione="su" aria-label="Sposta prima"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="rg-button rg-button--ghost rg-button--small" data-azione="giu" aria-label="Sposta dopo"${i === doc.oggetti.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" class="rg-button rg-button--ghost rg-button--small" data-azione="accendi" aria-pressed="${!o.spento}">${o.spento ? 'Spento' : 'Acceso'}</button>
            <button type="button" class="rg-button rg-button--ghost rg-button--small" data-azione="togli" aria-label="Togli ${esc(o.nome)}">✕</button>
          </span>
        </div>
        <div class="rg-list-row__meta"><span>${fili} ${n0(puntiDi(o))} punti</span>${da}</div>
      </li>`;
    }).join('');
  };

  const pannelloSelezionato = (): void => {
    const el = $('selezionato');
    const o = selezionato();
    if (!o) { el.innerHTML = '<p class="rg-field__help rg-param-grid__wide">Scegli un oggetto nella lista o sull’anteprima.</p>'; return; }
    const b = ingombro(o);
    const aghi = Math.max(1, ...o.blocchi.map((x) => x.ago));
    const scelte = (attuale: number): string => doc.fili.map((f) => `<option value="${f.id}"${f.id === attuale ? ' selected' : ''}>Filo ${f.id}${f.nome ? ' · ' + esc(f.nome) : ''}</option>`).join('') + '<option value="nuovo">Filo nuovo…</option>';
    const righeAghi = Array.from({ length: aghi }, (_, i) => `<label class="rg-field"><span class="rg-field__label">Ago ${i + 1} del file <span class="cmp-tinta" style="background:${tintaFilo(o.fili[i] ?? o.fili[0])}"></span></span><select class="rg-select" data-ago="${i + 1}">${scelte(o.fili[i] ?? o.fili[0])}</select></label>`).join('');
    const arrivo = (v: Arrivo, t: string): string => `<option value="${v}"${o.arrivo === v ? ' selected' : ''}>${t}</option>`;
    el.innerHTML = `
    <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Nome</span><input class="rg-input" id="selNome" type="text" value="${esc(o.nome)}"></label>
    <dl class="rg-key-value rg-param-grid__wide">
      ${o.file ? `<dt>File</dt><dd>${esc(o.file)}</dd>` : ''}
      ${o.tool ? `<dt>Fatto con</dt><dd>${esc(nomeTool(o.tool))}</dd>` : ''}
      <dt>Punti</dt><dd class="rg-mono">${n0(puntiDi(o))}</dd>
      <dt>Blocchi</dt><dd class="rg-mono">${n0(o.blocchi.length)}</dd>
      ${b ? `<dt>Ingombro</dt><dd class="rg-mono">${n1(b.maxX - b.minX)} × ${n1(b.maxY - b.minY)} mm</dd>` : ''}
    </dl>
    ${campoNumero({ id: 'selDx', etichetta: 'Spostamento X', unita: 'mm', valore: o.dx, passo: 0.5 })}
    ${campoNumero({ id: 'selDy', etichetta: 'Spostamento Y', unita: 'mm', valore: o.dy, passo: 0.5 })}
    <label class="rg-field rg-param-grid__wide"><span class="rg-field__label">Come si arriva qui dall’oggetto prima</span>
      <select class="rg-select" id="selArrivo">${arrivo('auto', 'Come dice la regola (04)')}${arrivo('taglio', 'Sempre col taglio')}${arrivo('salto', 'Salto senza taglio')}</select>
      <span class="rg-field__help">Conta solo se l’oggetto prima finisce sullo stesso filo; se il filo cambia, la macchina si ferma comunque.</span>
    </label>
    ${righeAghi}`;
  };

  const elencoFili = (): void => {
    const usi = (id: number): number => doc.oggetti.filter((o) => o.fili.includes(id)).length;
    $('fili').innerHTML = doc.fili.length ? doc.fili.map((f) => `<li class="rg-color-map__row">
      <input type="color" class="cmp-colore" data-filo="${f.id}" value="${f.colore}" aria-label="Colore del filo ${f.id}">
      <span class="rg-color-map__code">Filo ${f.id} <span class="rg-color-map__meta rg-mono">${usi(f.id) ? `in ${usi(f.id)} ${usi(f.id) === 1 ? 'oggetto' : 'oggetti'}` : 'non usato'}</span></span>
      <input class="rg-input cmp-nome-filo" type="text" data-filo="${f.id}" value="${esc(f.nome ?? '')}" placeholder="nome" aria-label="Nome del filo ${f.id}">
    </li>`).join('') : '<li><p class="rg-color-map__empty">I fili arrivano coi DST.</p></li>';
  };

  const pannelloPassaggi = (): void => {
    const g = contaGiunti(c);
    const sequenza = c.sequenzaFili.map((id) => `<span class="cmp-tinta" style="background:${tintaFilo(id)}" title="Filo ${id}"></span>`).join('');
    $('passaggi').innerHTML = `
      <dt>Fili in macchina, in ordine</dt><dd>${sequenza || '—'}</dd>
      <dt>Cambi d’ago fra oggetti</dt><dd class="rg-mono">${g.cambi}</dd>
      <dt>Tagli fra oggetti</dt><dd class="rg-mono">${g.tagli}</dd>
      <dt>Salti senza taglio</dt><dd class="rg-mono">${g.salti}</dd>
      <dt>Strada fra oggetti</dt><dd class="rg-mono">${n1(g.mm)} mm</dd>`;
  };

  const pannelloControllo = (): void => {
    const avvisi = controlla(doc, c, referto);
    const classe = { errore: 'rg-alert--error', attenzione: 'rg-alert--warning', info: 'rg-alert--info' } as const;
    $('avvisi').innerHTML = avvisi.length
      ? avvisi.map((a) => `<div class="rg-alert ${classe[a.livello]}"${a.oggetto ? ` data-ogg="${a.oggetto}"` : ''}><p class="rg-body">${esc(a.testo)}</p></div>`).join('')
      : '<div class="rg-alert rg-alert--success"><p class="rg-body">Niente da segnalare.</p></div>';
    const r = referto;
    $('referto').innerHTML = r ? `
      <dt>Punti</dt><dd class="rg-mono">${n0(r.punti)}</dd>
      <dt>Filo cucito</dt><dd class="rg-mono">${r.lunghezzaCucitaM.toFixed(2)} m</dd>
      <dt>Salti</dt><dd class="rg-mono">${r.salti} · ${n1(r.saltiMm)} mm</dd>
      <dt>Tagli</dt><dd class="rg-mono">${r.trim}</dd>
      <dt>Cambi d’ago</dt><dd class="rg-mono">${r.cambiAgo}</dd>
      ${r.ingombro ? `<dt>Ingombro</dt><dd class="rg-mono">${n1(r.ingombro.larghezzaMm)} × ${n1(r.ingombro.altezzaMm)} mm</dd>` : ''}
      <dt>Punto più corto</dt><dd class="rg-mono">${r.puntoPiuCortoMm !== null ? n1(r.puntoPiuCortoMm) + ' mm' : '—'}</dd>
      <dt>Punto più lungo</dt><dd class="rg-mono">${r.puntoPiuLungoMm !== null ? n1(r.puntoPiuLungoMm) + ' mm' : '—'}</dd>` : '';
    $('misure').textContent = r ? `${n0(r.punti)} punti · ${r.lunghezzaCucitaM.toFixed(1)} m · ${r.salti} salti · ${r.trim} tagli · ${r.cambiAgo} cambi` : '';
  };

  /** Dopo ogni cambio: si ricompone, si rimisura, si ridisegna tutto. `adatta` rimette la vista sul documento. */
  const aggiorna = (adatta = false): void => {
    c = componi(doc);
    referto = refertoDi(doc, c);
    // il riquadro si allarga quando un oggetto esce, ma non si stringe da solo: la vista non salta a ogni spostamento
    const nuovo = riquadroDi(doc);
    riquadro = adatta ? nuovo : unisci(riquadro, nuovo);
    elencoOggetti();
    pannelloSelezionato();
    elencoFili();
    pannelloPassaggi();
    pannelloControllo();
    impostaNumero($('tagliaOltre') as HTMLInputElement, doc.regole.tagliaOltreMm);
    ($('nomeDoc') as HTMLInputElement).value = doc.nome;
    const pieno = c.paths.length > 0;
    ($('exportDstBtn') as HTMLButtonElement).disabled = !pieno;
    ($('exportBtn') as HTMLButtonElement).disabled = !pieno;
    disegna();
    if (adatta) pz.fit();
  };

  // ---- aprire --------------------------------------------------------------------------------------
  ($('fileInput') as HTMLInputElement).addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    ricorda();
    const errori: string[] = [];
    let aggiunti = 0;
    for (const f of files) {
      try {
        const nuovi = apriDst(doc, new Uint8Array(await f.arrayBuffer()), f.name);
        aggiunti += nuovi.length;
        sel = nuovi[nuovi.length - 1]?.id ?? sel;
      } catch (e) {
        errori.push(`«${f.name}»: ${(e as Error).message}`);
      }
    }
    const s = $('fileStatus');
    s.classList.toggle('rg-file-input__status--error', errori.length > 0);
    s.textContent = errori.length
      ? `Non letti: ${errori.join('; ')}.${aggiunti ? ` Aggiunti ${aggiunti} oggetti.` : ''}`
      : `${aggiunti === 1 ? 'Aggiunto 1 oggetto' : `Aggiunti ${aggiunti} oggetti`}: in tutto ${doc.oggetti.length}.`;
    aggiorna(true);
  });
  $('demoBtn').addEventListener('click', () => { ricorda(); doc = documentoEsempio(); sel = 'o1'; aggiorna(true); stato('L’esempio: tre oggetti su due fili. Prova a riordinarli, a spostarli, a cambiare i passaggi.'); });
  $('nuovoBtn').addEventListener('click', () => { ricorda(); doc = documentoVuoto(); sel = null; aggiorna(true); stato('Documento nuovo.'); });
  $('nomeDoc').addEventListener('change', () => { ricorda(); doc.nome = ($('nomeDoc') as HTMLInputElement).value.trim() || 'composizione'; aggiorna(); });

  // ---- la lista degli oggetti ---------------------------------------------------------------------
  $('oggetti').addEventListener('click', (e) => {
    const bottone = (e.target as HTMLElement).closest('[data-azione]') as HTMLElement | null;
    const riga = (e.target as HTMLElement).closest('[data-ogg]') as HTMLElement | null;
    if (!riga) return;
    const id = riga.dataset.ogg!;
    const i = doc.oggetti.findIndex((o) => o.id === id);
    const azione = bottone?.dataset.azione ?? 'scegli';
    if (azione === 'scegli') { sel = id; aggiorna(); return; }
    ricorda();
    if (azione === 'su' && i > 0) [doc.oggetti[i - 1], doc.oggetti[i]] = [doc.oggetti[i], doc.oggetti[i - 1]];
    else if (azione === 'giu' && i < doc.oggetti.length - 1) [doc.oggetti[i + 1], doc.oggetti[i]] = [doc.oggetti[i], doc.oggetti[i + 1]];
    else if (azione === 'accendi') doc.oggetti[i].spento = !doc.oggetti[i].spento;
    else if (azione === 'togli') { doc.oggetti.splice(i, 1); if (sel === id) sel = null; }
    aggiorna();
  });

  // ---- l'oggetto selezionato -----------------------------------------------------------------------
  $('selezionato').addEventListener('change', (e) => {
    const o = selezionato();
    if (!o) return;
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    ricorda();
    if (t.id === 'selNome') o.nome = t.value.trim() || o.nome;
    else if (t.id === 'selDx' || t.id === 'selDy') {
      const v = leggiCampo(t as HTMLInputElement);
      if (Number.isFinite(v)) sposta(o, t.id === 'selDx' ? v : o.dx, t.id === 'selDy' ? v : o.dy);
    } else if (t.id === 'selArrivo') o.arrivo = t.value as Arrivo;
    else if (t.dataset.ago) {
      const ago = Number(t.dataset.ago);
      let filo: number;
      if (t.value === 'nuovo') {
        filo = doc.fili.reduce((m, f) => Math.max(m, f.id), 0) + 1;
        doc.fili.push({ id: filo, colore: TINTE[(filo - 1) % TINTE.length] });
      } else filo = Number(t.value);
      while (o.fili.length < ago) o.fili.push(o.fili[0] ?? filo);
      o.fili[ago - 1] = filo;
    }
    aggiorna();
  });

  // ---- i fili --------------------------------------------------------------------------------------
  $('fili').addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const f = doc.fili.find((x) => x.id === Number(t.dataset.filo));
    if (!f) return;
    ricorda();
    if (t.type === 'color') f.colore = t.value;
    else f.nome = t.value.trim() || undefined;
    aggiorna();
  });

  // ---- i passaggi ----------------------------------------------------------------------------------
  $('tagliaOltre').addEventListener('change', () => {
    const v = leggiCampo($('tagliaOltre') as HTMLInputElement);
    if (!Number.isFinite(v)) return;
    ricorda();
    doc.regole.tagliaOltreMm = v;
    aggiorna();
  });
  $('ordinaBtn').addEventListener('click', () => {
    if (doc.oggetti.length < 2) { stato('Per riordinare servono almeno due oggetti.'); return; }
    const prima = contaGiunti(c);
    ricorda();
    doc.oggetti = ordineProposto(doc);
    aggiorna();
    const dopo = contaGiunti(c);
    stato(`Ordine proposto: cambi d’ago ${prima.cambi} → ${dopo.cambi}, strada fra oggetti ${n1(prima.mm)} → ${n1(dopo.mm)} mm. Se non va, «Annulla».`);
  });
  const annulla = (): void => {
    const d = storia.pop();
    if (!d) return;
    doc = d;
    if (sel && !doc.oggetti.some((o) => o.id === sel)) sel = null;
    ($('annullaBtn') as HTMLButtonElement).disabled = storia.length === 0;
    aggiorna();
    stato('Annullato.');
  };
  $('annullaBtn').addEventListener('click', annulla);
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(t instanceof HTMLInputElement) && !(t instanceof HTMLSelectElement)) { e.preventDefault(); annulla(); }
  });

  // ---- il controllo porta all'oggetto ---------------------------------------------------------------
  $('avvisi').addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-ogg]') as HTMLElement | null;
    if (a) { sel = a.dataset.ogg!; aggiorna(); }
  });

  // ---- l'anteprima: scegliere e spostare ------------------------------------------------------------
  for (const b of Array.from($('modo').querySelectorAll('.rg-segmented__item'))) {
    b.addEventListener('click', () => {
      modo = (b as HTMLElement).dataset.modo as typeof modo;
      for (const altro of Array.from($('modo').querySelectorAll('.rg-segmented__item'))) {
        const attivo = altro === b;
        altro.classList.toggle('rg-segmented__item--active', attivo);
        altro.setAttribute('aria-pressed', String(attivo));
      }
      $('canvas').classList.toggle('cmp-sposta', modo === 'sposta');
    });
  }

  /** Dallo schermo ai millimetri: si passa per il riquadro dell'SVG, che è in mm reali (R1). */
  const inMm = (e: PointerEvent): [number, number] | null => {
    const svg = $('layer').querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return [riquadro.minX + ((e.clientX - r.left) / r.width) * riquadro.larghezza, riquadro.minY + ((e.clientY - r.top) / r.height) * riquadro.altezza];
  };
  /** L'oggetto sotto il puntatore: il selezionato se ci sta dentro, se no l'ultimo cucito (quello che sta sopra). */
  const sotto = (p: [number, number]): Oggetto | null => {
    const dentro = (o: Oggetto): boolean => { const b = ingombro(o); return !!b && p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY; };
    const s = selezionato();
    if (s && dentro(s)) return s;
    for (let i = doc.oggetti.length - 1; i >= 0; i--) if (dentro(doc.oggetti[i])) return doc.oggetti[i];
    return null;
  };

  const canvas = $('canvas');
  let presa: { o: Oggetto; da: [number, number]; dx: number; dy: number; mosso: boolean } | null = null;
  let giu: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (sim.attiva()) return;
    giu = { x: e.clientX, y: e.clientY };
    if (modo !== 'sposta') return;
    const p = inMm(e);
    const o = p ? sotto(p) : null;
    if (!o || !p) return;
    // in cattura: il gesto è nostro, il pan non lo deve vedere
    e.stopPropagation(); e.preventDefault();
    presa = { o, da: p, dx: o.dx, dy: o.dy, mosso: false };
    if (sel !== o.id) { sel = o.id; elencoOggetti(); pannelloSelezionato(); }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (!presa) return;
    e.stopPropagation();
    const p = inMm(e);
    if (!p) return;
    if (!presa.mosso) { ricorda(); presa.mosso = true; }
    sposta(presa.o, presa.dx + p[0] - presa.da[0], presa.dy + p[1] - presa.da[1]);
    // si muove solo il gruppo dell'oggetto e la sua cornice: i punti non si ridisegnano
    const svg = $('layer').querySelector('svg');
    svg?.querySelector(`[data-ogg="${presa.o.id}"]`)?.setAttribute('transform', `translate(${presa.o.dx} ${presa.o.dy})`);
    const gSel = svg?.querySelector('#selezione');
    if (gSel) gSel.outerHTML = gruppoSelezione(presa.o);
  }, true);
  const lascia = (e: PointerEvent): void => {
    if (presa) {
      e.stopPropagation();
      const mosso = presa.mosso;
      const presa0 = presa.o;
      presa = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      aggiorna();
      if (mosso) stato(`Spostato: ${n1(presa0.dx)} · ${n1(presa0.dy)} mm dalla posizione del file.`);
      return;
    }
    // un clic senza trascinare, con «Muovi la vista»: sceglie l'oggetto
    if (giu && Math.hypot(e.clientX - giu.x, e.clientY - giu.y) < 4 && !sim.attiva()) {
      const p = inMm(e);
      const o = p ? sotto(p) : null;
      if ((o?.id ?? null) !== sel) { sel = o?.id ?? null; aggiorna(); }
    }
    giu = null;
  };
  canvas.addEventListener('pointerup', lascia, true);
  canvas.addEventListener('pointercancel', (e) => { if (presa) lascia(e); giu = null; }, true);

  // ---- esportare -----------------------------------------------------------------------------------
  const nomeFile = (est: string): string => `${doc.nome.replace(/[\\/:*?"<>|]/g, '-') || 'composizione'}${est}`;
  $('exportDstBtn').addEventListener('click', () => {
    let bytes: Uint8Array;
    try { bytes = dstDocumento(doc); } catch (e) { stato((e as Error).message); return; }
    const nome = nomeFile('.dst');
    saveBinaryFile(bytes, { suggestedName: nome, ...DST_FILE }).then((r) => stato(saveOutcomeMessage(r, nome)));
  });
  $('exportBtn').addEventListener('click', () => {
    const nome = nomeFile('.svg');
    saveTextFile(svgEsporta(doc), { suggestedName: nome, mime: 'image/svg+xml', extension: '.svg', description: 'Immagine SVG' })
      .then((r) => stato(saveOutcomeMessage(r, nome)));
  });

  aggiorna(true);
  stato('Aggiungi i DST da mettere in fila, o prova l’esempio.');
}

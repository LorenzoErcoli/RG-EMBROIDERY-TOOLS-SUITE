// Guscio del tool "Sfrangiatura" (DOM/browser). Il motore è in `rasi.ts` e `frange.ts` e resta puro:
// qui dentro non si calcola geometria, si apre un DST, si marca col pennello e si girano le manopole.
//
// È il primo tool della suite che NON genera ricamo: ne rilavora uno già cucito. La forma del
// pannello viene dal subagent `design-system`, che ha deciso tre cose degne di nota:
//
// 1. È **Testa A al grado massimo** — il DST *è* il prodotto, l'ingombro è quello e basta — ma i
//    titoli canonici sarebbero falsi: «Sagoma» dice che il file serve da perimetro, e «Colori e
//    ruoli» promette dei ruoli che qui non esistono (un DST non porta né colore né ago reale, R31).
//    Quindi `01 Ricamo di partenza` e `02 Aghi`.
// 2. Le **zone marcate stanno in testa**, non fra i parametri: sono l'unica cosa che l'utente fa a
//    mano e che il tool non sa rigenerare, e la testa è «la garanzia che il lavoro non sparisce».
// 3. Gli **export stanno nella barra dell'anteprima**, non nel pannello: sono azioni sull'anteprima,
//    e due bottoni non fanno una sezione di coda (che esiste per le *opzioni* di export, qui assenti).
//
// Il pennello e il pan si contendono lo stesso trascinamento, e la scelta è esplicita in un
// `rg-segmented` a tre voci — Sposta / Marca / Cancella — invece che con un tasto modificatore, che
// in reparto non si ricorda nessuno.

import '@rg/ui/rg.css';
import './sfrangiatura.css';
import {
  readDst, buildDst, dstProgramFromBlocks, DST_FILE,
  type DstBlock, type Point,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { sfrangia, type FrangiaParams, type EsitoSfrangiatura } from './frange';
import { riquadroDi, gruppoRicamo, gruppoFrange, gruppoZone, svgDocumento, TINTE, type Riquadro } from './vista';

export const defaultSfrangiaturaParams: FrangiaParams & { pennelloMm: number } = {
  lunghezzaMinMm: 2,
  lunghezzaMaxMm: 6,
  aperturaMinDeg: 10,
  aperturaMaxDeg: 30,
  sormontoMm: 0,
  seme: 1,
  pennelloMm: 6,
};

interface Campo { id: string; key: keyof typeof defaultSfrangiaturaParams; min?: number; max?: number; int?: boolean }
const CAMPI: Campo[] = [
  { id: 'lunghezzaMinMm', key: 'lunghezzaMinMm', min: 0, max: 12 },
  { id: 'lunghezzaMaxMm', key: 'lunghezzaMaxMm', min: 0, max: 12 },
  { id: 'aperturaMinDeg', key: 'aperturaMinDeg', min: 0, max: 80 },
  { id: 'aperturaMaxDeg', key: 'aperturaMaxDeg', min: 0, max: 80 },
  { id: 'sormontoMm', key: 'sormontoMm', min: 0, max: 10 },
  { id: 'pennelloMm', key: 'pennelloMm', min: 0.5, max: 40 },
  { id: 'seme', key: 'seme', min: 1, max: 9999, int: true },
];

const n1 = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });

export function mountSfrangiatura(root: HTMLElement, opts: { backHref?: string } = {}): void {
  root.innerHTML = `
  ${topbar('Sfrangiatura', opts.backHref)}
  <div class="rg-workspace sfr-workspace">
    <aside class="rg-workspace__panel">

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">01</span><h3 class="rg-param-section__title">Ricamo di partenza</h3></div>
        <div class="rg-param-grid">
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="file" accept=".dst">
              <span class="rg-button rg-button--outline">Carica un DST…</span>
            </label>
            <p class="rg-file-input__status" id="fileStatus" role="status">Nessun file caricato.</p>
          </div>
          <dl class="rg-key-value rg-param-grid__wide" id="fileInfo" hidden></dl>
        </div>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">02</span><h3 class="rg-param-section__title">Aghi</h3></div>
        <ul class="rg-color-map" id="aghi">
          <li><p class="rg-color-map__empty">Nessun DST caricato: qui compariranno gli aghi del file.</p></li>
        </ul>
      </section>

      <section class="rg-param-section">
        <div class="rg-param-section__header"><span class="rg-param-section__index">03</span><h3 class="rg-param-section__title">Zone da sfrangiare</h3></div>
        <div class="rg-param-grid">
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Strumento</span>
            <div class="rg-segmented" id="modo" role="group" aria-label="Strumento sull'anteprima">
              <button type="button" class="rg-segmented__item rg-segmented__item--active" data-modo="sposta" aria-pressed="true">Sposta</button>
              <button type="button" class="rg-segmented__item" data-modo="marca" aria-pressed="false">Marca</button>
              <button type="button" class="rg-segmented__item" data-modo="cancella" aria-pressed="false">Cancella</button>
            </div>
            <span class="rg-field__help">Con «Sposta» il trascinamento muove la vista; con «Marca» disegna la zona.</span>
          </div>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Pennello</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="pennelloMm" type="number" min="0.5" max="40" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">è il raggio d'azione: si sfrangia solo dove passi</span>
          </label>
          <dl class="rg-key-value rg-param-grid__wide"><dt>Zone marcate</dt><dd id="zoneCount">0</dd></dl>
          <div class="rg-cluster rg-param-grid__wide">
            <button type="button" id="puliBtn" class="rg-button rg-button--danger" disabled>Cancella tutte le zone</button>
          </div>
        </div>
      </section>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header"><span class="rg-param-section__index">04</span><h3 class="rg-param-section__title">Frangia</h3></summary>
        <div class="rg-param-grid" style="--rg-input-numeric-width: 7ch">
          <label class="rg-field">
            <span class="rg-field__label">Lunghezza min</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="lunghezzaMinMm" type="number" min="0" max="12" step="0.5"><span>mm</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Lunghezza max</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="lunghezzaMaxMm" type="number" min="0" max="12" step="0.5"><span>mm</span></span>
          </label>
          <label class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Sormonto</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="sormontoMm" type="number" min="0" max="10" step="0.5"><span>mm</span></span>
            <span class="rg-field__help">quanto ogni frangia entra di sicuro nella macchia vicina: alza il minimo, non il massimo</span>
          </label>
        </div>
      </details>

      <details class="rg-param-section rg-disclosure" open>
        <summary class="rg-param-section__header"><span class="rg-param-section__index">05</span><h3 class="rg-param-section__title">Incrocio</h3></summary>
        <div class="rg-param-grid" style="--rg-input-numeric-width: 7ch">
          <label class="rg-field">
            <span class="rg-field__label">Apertura min</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="aperturaMinDeg" type="number" min="0" max="80" step="1"><span>°</span></span>
          </label>
          <label class="rg-field">
            <span class="rg-field__label">Apertura max</span>
            <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="aperturaMaxDeg" type="number" min="0" max="80" step="1"><span>°</span></span>
          </label>
          <p class="rg-field__help rg-param-grid__wide">Di quanto la frangia si scosta dalla sua fila. Il verso alterna fra frange vicine: è così che nasce la X. A 0 restano parallele.</p>
          <div class="rg-field rg-param-grid__wide">
            <span class="rg-field__label">Variante</span>
            <div class="rg-cluster">
              <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" id="seme" type="number" min="1" max="9999" step="1"><span>#</span></span>
              <button type="button" id="rigeneraBtn" class="rg-button rg-button--outline rg-button--small">Rigenera</button>
            </div>
            <span class="rg-field__help">Stessa variante = stesso identico ricamo. Cambiala per un'altra estrazione di lunghezze e aperture.</span>
          </div>
        </div>
      </details>

    </aside>

    <div class="rg-workspace__stage">
      <header class="rg-workspace__stage-header">
        <h2 class="rg-h3">Anteprima</h2>
        <div class="rg-cluster">
          <button class="rg-button rg-button--ghost rg-button--small" id="fitBtn" type="button">Adatta</button>
          <button class="rg-button rg-button--outline rg-button--small" id="exportSvgBtn" type="button">Esporta SVG</button>
          <button class="rg-button rg-button--primary rg-button--small" id="exportDstBtn" type="button">Esporta DST</button>
        </div>
      </header>
      <div class="rg-workspace__canvas" id="canvas">
        <div class="rg-workspace__layer" id="layer"></div>
      </div>
      <footer class="rg-workspace__statusbar">
        <span id="status">Carica un DST per cominciare.</span>
        <span class="rg-mono" id="zoom">zoom 100%</span>
      </footer>
    </div>
  </div>`;

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const params = { ...defaultSfrangiaturaParams };
  let originali: DstBlock[] = [];
  let etichetta = '';
  let nomeFile = '';
  let riquadro: Riquadro = { minX: 0, minY: 0, larghezza: 1, altezza: 1 };
  let zone: Point[][] = [];
  let esito: EsitoSfrangiatura | null = null;
  const aghiEsclusi = new Set<number>();
  let modo: 'sposta' | 'marca' | 'cancella' = 'sposta';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => {
    $('zoom').textContent = `zoom ${Math.round(z * 100)}%`;
  });
  $('fitBtn').addEventListener('click', () => pz.fit());

  // ---- i campi ---------------------------------------------------------------
  for (const c of CAMPI) {
    const el = $(c.id) as HTMLInputElement;
    el.value = String(params[c.key]);
    el.addEventListener('change', () => {
      let v = c.int ? Math.round(Number(el.value)) : Number(el.value);
      if (!Number.isFinite(v)) v = Number(defaultSfrangiaturaParams[c.key]);
      if (c.min !== undefined) v = Math.max(c.min, v);
      if (c.max !== undefined) v = Math.min(c.max, v);
      (params[c.key] as number) = v;
      el.value = String(v);
      controllaIntervalli();
      rigenera();
    });
  }
  const rileggiCampi = (): void => {
    for (const c of CAMPI) ($(c.id) as HTMLInputElement).value = String(params[c.key]);
  };
  /** Un minimo sopra il massimo è un errore da dire, non da correggere di nascosto (regola DS). */
  const controllaIntervalli = (): void => {
    const coppie: Array<[string, string, boolean]> = [
      ['lunghezzaMinMm', 'lunghezzaMaxMm', params.lunghezzaMinMm > params.lunghezzaMaxMm],
      ['aperturaMinDeg', 'aperturaMaxDeg', params.aperturaMinDeg > params.aperturaMaxDeg],
    ];
    for (const [a, b, rotto] of coppie) {
      for (const id of [a, b]) $(id).closest('.rg-field')?.classList.toggle('is-error', rotto);
    }
  };

  // ---- il disegno ------------------------------------------------------------
  // Il ricamo di partenza si disegna UNA volta: è quello che non cambia mai. A ogni giro di manopola
  // si rifanno solo le frange e le zone, e su 188.000 punti è la differenza fra scattare e arrancare.
  const disegnaTutto = (): void => {
    $('layer').innerHTML = svgDocumento(riquadro, `${gruppoRicamo(originali)}<g id="frange"></g><g id="zone"></g>`);
    pz.fit();
  };
  const ridisegna = (): void => {
    const svg = $('layer').querySelector('svg');
    if (!svg) return;
    const gF = svg.querySelector('#frange');
    if (gF) gF.outerHTML = esito ? gruppoFrange(originali, esito.blocchi, '#b02030') : '<g id="frange"></g>';
    const gZ = svg.querySelector('#zone');
    if (gZ) gZ.outerHTML = gruppoZone(zone);
  };

  const rigenera = (): void => {
    ($('puliBtn') as HTMLButtonElement).disabled = zone.length === 0;
    $('zoneCount').textContent = String(zone.length);
    if (!originali.length) return;
    const t0 = performance.now();
    esito = sfrangia(originali, zone, { ...params, aghiEsclusi: [...aghiEsclusi] });
    ridisegna();
    const ms = Math.round(performance.now() - t0);
    // I tre stati sono dichiarati apposta: lo stato vuoto va detto, non mascherato da «pronto».
    $('status').innerHTML = zone.length
      ? `Frange <span class="rg-mono">${n1(esito.frange)}</span> · Incroci <span class="rg-mono">${n1(esito.incroci)}</span> · Frangia media <span class="rg-mono">${esito.frangiaMediaMm.toFixed(1)} mm</span> · Filo aggiunto <span class="rg-mono">+${esito.filoAggiuntoM.toFixed(2)} m</span> · <span class="rg-mono">${ms} ms</span>`
      : 'Nessuna zona marcata: il file uscirebbe identico all’originale.';
  };

  // ---- apertura del file -----------------------------------------------------
  const apri = (bytes: Uint8Array, nome: string): void => {
    const letto = readDst(bytes);
    if (!letto.blocks.length) throw new Error('nessun blocco cucito');
    originali = letto.blocks;
    etichetta = letto.label;
    nomeFile = nome;
    riquadro = riquadroDi(originali);
    zone = [];
    aghiEsclusi.clear();
    esito = null;

    // se il file viene da qui, si riprende da dove si era lasciato (R9/R27)
    const meta = letto.metadata as { rgProject?: string; params?: Partial<typeof params>; zone?: Point[][] } | null;
    const ripreso = meta?.rgProject === 'sfrangiatura';
    if (ripreso) {
      Object.assign(params, meta?.params ?? {});
      zone = Array.isArray(meta?.zone) ? (meta?.zone as Point[][]) : [];
      rileggiCampi();
    }

    const aghi = letto.colorChanges + 1;
    $('fileStatus').classList.remove('rg-file-input__status--error');
    $('fileStatus').innerHTML = `${nome} <span class="rg-badge rg-badge--parsed">letto dal file</span>${ripreso ? ' <span class="rg-badge">coi parametri di prima</span>' : ''}`;
    const info = $('fileInfo');
    info.hidden = false;
    info.innerHTML = `
      <dt>Ingombro</dt><dd>${riquadro.larghezza.toFixed(1)} × ${riquadro.altezza.toFixed(1)} mm</dd>
      <dt>Aghi</dt><dd>${aghi}</dd>
      <dt>Blocchi</dt><dd>${n1(letto.blocks.length)}</dd>
      <dt>Punti</dt><dd>${n1(letto.stitchCount)}</dd>`;

    $('aghi').innerHTML = Array.from({ length: aghi }, (_, i) => {
      const n = i + 1;
      const miei = originali.filter((b) => b.needle === n);
      const punti = miei.reduce((s, b) => s + b.points_mm.length, 0);
      // il DST non porta i colori: la tinta è quella dell'anteprima, e il numero d'ago accanto non è
      // un vezzo — un campione di colore da solo non si legge in scala di grigi (regola DS 10).
      return `<li class="rg-color-map__row">
        <span class="rg-color-map__swatch" style="--swatch:${TINTE[i % TINTE.length]};background:${TINTE[i % TINTE.length]}"></span>
        <span class="rg-color-map__code">Ago ${n} <span class="rg-color-map__meta rg-mono">${miei.length} blocchi · ${n1(punti)} punti</span></span>
        <label class="rg-toggle rg-color-map__target">
          <input type="checkbox" data-ago="${n}" checked aria-label="Sfrangia l'ago ${n}">
          <span class="rg-toggle__track"></span><span>Sfrangiabile</span>
        </label>
      </li>`;
    }).join('');
    for (const el of Array.from($('aghi').querySelectorAll('input[type=checkbox]'))) {
      el.addEventListener('change', () => {
        const n = Number((el as HTMLInputElement).dataset.ago);
        if ((el as HTMLInputElement).checked) aghiEsclusi.delete(n); else aghiEsclusi.add(n);
        rigenera();
      });
    }
    disegnaTutto();
    rigenera();
    if (!zone.length) $('status').textContent = 'Nessuna zona marcata: scegli «Marca» e passa il pennello dove vuoi le frange.';
  };

  ($('file') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    f.arrayBuffer().then((buf) => {
      try {
        apri(new Uint8Array(buf), f.name);
      } catch (e) {
        const s = $('fileStatus');
        s.classList.add('rg-file-input__status--error');
        s.setAttribute('role', 'alert');
        s.textContent = `Errore: non riesco a leggere «${f.name}» come DST (${(e as Error).message}).`;
      }
    });
  });

  // ---- il pennello -----------------------------------------------------------
  // Una passata di pennello diventa un poligono: la striscia percorsa dal puntatore, allargata di
  // mezza larghezza per parte.
  for (const b of Array.from($('modo').querySelectorAll('.rg-segmented__item'))) {
    b.addEventListener('click', () => {
      modo = (b as HTMLElement).dataset.modo as typeof modo;
      for (const altro of Array.from($('modo').querySelectorAll('.rg-segmented__item'))) {
        const attivo = altro === b;
        altro.classList.toggle('rg-segmented__item--active', attivo);
        altro.setAttribute('aria-pressed', String(attivo));
      }
      $('canvas').classList.toggle('sfr-marcatura', modo !== 'sposta');
    });
  }
  $('puliBtn').addEventListener('click', () => { zone = []; rigenera(); });
  $('rigeneraBtn').addEventListener('click', () => {
    params.seme = ((params.seme ?? 1) % 9999) + 1;
    rileggiCampi();
    rigenera();
  });

  /** Dallo schermo ai millimetri del ricamo: si passa per il riquadro dell'SVG, che è in mm reali (R1). */
  const inMm = (e: PointerEvent): Point | null => {
    const svg = $('layer').querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: riquadro.minX + ((e.clientX - r.left) / r.width) * riquadro.larghezza,
      y: riquadro.minY + ((e.clientY - r.top) / r.height) * riquadro.altezza,
    };
  };

  let tratto: Point[] = [];
  const canvas = $('canvas');
  // in cattura: col pennello acceso il gesto è nostro e il pan/zoom non lo deve nemmeno vedere
  canvas.addEventListener('pointerdown', (e) => {
    if (modo === 'sposta' || !originali.length) return;
    e.stopPropagation(); e.preventDefault();
    tratto = [];
    const p = inMm(e);
    if (p) tratto.push(p);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (modo === 'sposta' || !tratto.length) return;
    e.stopPropagation();
    const p = inMm(e);
    if (!p) return;
    const ultimo = tratto[tratto.length - 1];
    if (Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 0.5) return;   // niente punti inutili
    tratto.push(p);
    // si vede dove si sta marcando, mentre lo si fa
    const svg = $('layer').querySelector('svg');
    const gZ = svg?.querySelector('#zone');
    if (gZ) gZ.outerHTML = gruppoZone([...zone, strisciaAPoligono(tratto, params.pennelloMm / 2)]);
  }, true);
  const chiudiTratto = (e: PointerEvent): void => {
    if (modo === 'sposta' || !tratto.length) return;
    e.stopPropagation();
    const poligono = strisciaAPoligono(tratto, params.pennelloMm / 2);
    if (poligono.length >= 3) {
      if (modo === 'marca') zone.push(poligono);
      else zone = zone.filter((z) => !z.some((q) => dentroPoligono(q, poligono)));
    }
    tratto = [];
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    rigenera();
  };
  canvas.addEventListener('pointerup', chiudiTratto, true);
  canvas.addEventListener('pointercancel', chiudiTratto, true);

  // ---- esportazione ----------------------------------------------------------
  const metadata = (): Record<string, unknown> => ({ rgProject: 'sfrangiatura', params, zone });
  const nomeProposto = (est: string): string => `${nomeFile.replace(/\.dst$/i, '') || 'ricamo'}-sfrangiato${est}`;

  $('exportDstBtn').addEventListener('click', () => {
    if (!esito) return;
    const bytes = buildDst(dstProgramFromBlocks(esito.blocchi, { label: etichetta || 'SFRANGIATO', metadata: metadata() }));
    const nome = nomeProposto('.dst');
    saveBinaryFile(bytes, { suggestedName: nome, ...DST_FILE }).then((r) => {
      $('status').textContent = saveOutcomeMessage(r, nome);
    });
  });
  $('exportSvgBtn').addEventListener('click', () => {
    if (!esito) return;
    const nome = nomeProposto('.svg');
    saveTextFile(svgDocumento(riquadro, gruppoRicamo(esito.blocchi)), {
      suggestedName: nome, mime: 'image/svg+xml', extension: '.svg', description: 'Immagine SVG',
    }).then((r) => { $('status').textContent = saveOutcomeMessage(r, nome); });
  });
}

/** La striscia percorsa dal pennello, allargata di `raggio` per parte: un poligono chiuso. */
function strisciaAPoligono(tratto: Point[], raggio: number): Point[] {
  if (tratto.length === 1) {
    // un clic solo è un tondo: dodici lati bastano, la marcatura non è un disegno tecnico
    const c = tratto[0];
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: c.x + Math.cos(a) * raggio, y: c.y + Math.sin(a) * raggio };
    });
  }
  const su: Point[] = [], giu: Point[] = [];
  for (let i = 0; i < tratto.length; i++) {
    const p = tratto[i];
    const a = tratto[Math.max(0, i - 1)], b = tratto[Math.min(tratto.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    su.push({ x: p.x + nx * raggio, y: p.y + ny * raggio });
    giu.push({ x: p.x - nx * raggio, y: p.y - ny * raggio });
  }
  return [...su, ...giu.reverse()];
}

function dentroPoligono(p: Point, poly: Point[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

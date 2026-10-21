// Guscio del tool "Punto Pittorico" (DOM/browser). Il motore è in `pipeline.ts` e resta puro:
// qui dentro non si calcola niente di geometrico, si carica un'immagine, si girano le manopole e si
// guarda il risultato.
//
// Il pannello segue la forma canonica della suite — testa sempre aperta, poi le sezioni — e usa solo
// classi del Design System. La **validazione della composizione** dal subagent `design-system` è
// l'ultimo passo, insieme ai nomi dei parametri col processo di `REVISIONE-PARAMETRI.md`.
//
// L'anteprima ha cinque VISTE, ed e' il modo per capire cosa sta facendo il sistema invece di
// fidarsi: come divide l'immagine in colori, come quei colori diventano macchie cucibili, dov'e' il
// ricamo e - la piu' importante - dove passa il filo di collegamento. Un difetto come la linea sul
// bordo si misura, ma prima si guarda.

import '@rg/ui/rg.css';
import './pittorico.css';
import {
  buildSvg, conBusta, dstFromExportLayers, DST_FILE, readDstMetadata, readProjectMetadata,
  bounds, rgbToHex, type PixelImage,
} from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { disegnaDemo } from './demo';
import { scheletro, sezioneSorgente, sezione, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { collegaSimula, datiDaStrati, type DatiSimulazione } from '@rg/ui/simulatore';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import {
  buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams,
  type PittoricoParams, type PittoricoPlan,
} from './pipeline';
// Le viste NON stanno qui: le usano in due — questo guscio e lo script che ne fa una pagina da
// guardare senza aprire l'app — e due copie divergono sempre.
import { svgMacchie, svgRicamo, svgPassaggi, pixelDeiColori } from './viste';

/**
 * Le cinque viste dell'anteprima, in ordine di catena: l'immagine com'e' entrata, come viene divisa
 * in tinte, come le tinte diventano macchie cucibili, il ricamo, e dove passa il filo fra una corsa
 * e l'altra.
 */
type Vista = 'originale' | 'colori' | 'macchie' | 'ricamo' | 'passaggi';

/** Sorgente pixel: rasterizzabile alla larghezza di lavoro. */
interface Sorgente { name: string; pixelsAt: (maxWidthPx: number) => PixelImage; }

interface Campo {
  id: string; key: keyof PittoricoParams; etichetta: string; unita: string; passo: number;
  int?: boolean; min?: number; max?: number; aiuto?: string;
}

const CAMPI: Campo[] = [
  { id: 'realWidth', key: 'realWidthMm', etichetta: 'Larghezza reale', unita: 'mm', passo: 1, min: 0, aiuto: '0 = un pixel vale un millimetro. È la misura che comanda: senza, le altre non significano niente' },
  { id: 'colorCount', key: 'colorCount', etichetta: 'Quanti fili', unita: '', passo: 1, int: true, min: 2, max: 8, aiuto: 'ogni tinta è un ago' },
  { id: 'densitySpacingMm', key: 'densitySpacingMm', etichetta: 'Distanza fra le file', unita: 'mm', passo: 0.05, min: 0.1, max: 2, aiuto: 'quanto è fitto il pieno' },
  { id: 'maxStitchMm', key: 'maxStitchMm', etichetta: 'Punto massimo', unita: 'mm', passo: 0.5, min: 0.5, max: 8, aiuto: 'lungo il filo' },
  { id: 'frangiaMm', key: 'frangiaMm', etichetta: 'Lunghezza della frangia', unita: 'mm', passo: 0.5, min: 0, max: 12, aiuto: 'tienila sotto la sovrapposizione, o si appiattisce' },
  { id: 'crescitaMm', key: 'crescitaMm', etichetta: 'Sovrapposizione dove sfuma', unita: 'mm', passo: 0.5, min: 0, max: 12, aiuto: 'quanto il colore sotto entra sotto quello sopra' },
  { id: 'sormontoMm', key: 'sormontoMm', etichetta: 'Sormonto dove stacca', unita: 'mm', passo: 0.5, min: 0, max: 6, aiuto: 'basta poco: serve a non far vedere la tela alla giunta' },
  { id: 'sogliaSfumaturaMm', key: 'sogliaSfumaturaMm', etichetta: 'Da qui in su è una sfumatura', unita: 'mm', passo: 0.5, min: 0, max: 20, aiuto: 'sotto, il colore stacca netto' },
  { id: 'lisciaBordiMm', key: 'lisciaBordiMm', etichetta: 'Lisciatura del contorno', unita: 'mm', passo: 0.2, min: 0, max: 5, aiuto: "0 = il contorno com'esce dalla tracciatura. Alzandola sparisce il dettaglio più piccolo di così" },
  { id: 'maxInternalTravelMm', key: 'maxInternalTravelMm', etichetta: 'Passaggio scoperto massimo', unita: 'mm', passo: 5, min: 5, max: 400, aiuto: 'oltre, il filo si taglia invece di attraversare il disegno. Più basso = meno fili tesi, più rasafili' },
  { id: 'flattenLightMm', key: 'flattenLightMm', etichetta: 'Pareggio della luce', unita: 'mm', passo: 1, min: 0, aiuto: 'tienilo più grande del motivo' },
  { id: 'smoothMm', key: 'smoothMm', etichetta: 'Attenuazione della grana', unita: 'mm', passo: 0.5, min: 0 },
  { id: 'minAreaMm2', key: 'minAreaMm2', etichetta: 'Macchia più piccola', unita: 'mm²', passo: 10, min: 0 },
];

/** Larghezza di lavoro in pixel: sopra i ~900 il calcolo si allunga senza aggiungere forma. */
const MAX_WIDTH_PX = 900;

export function mountPittorico(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const campo = (id: string): string => {
    const c = CAMPI.find((x) => x.id === id)!;
    return campoNumero({ id: c.id, etichetta: c.etichetta, unita: c.unita, valore: defaultPittoricoParams[c.key] as number, passo: c.passo, min: c.min, max: c.max, aiuto: c.aiuto });
  };
  const sezioneCampi = (indice: number, titolo: string, ids: string[], dopo = ''): string =>
    sezione({ indice, titolo, contenuto: `<div class="rg-param-grid">\n    ${ids.map(campo).join('\n    ')}${dopo}\n  </div>` });

  // ECCEZIONE DICHIARATA (regola 12). Il segmented del DS e' documentato per 2-4 opzioni sorelle e qui ne porta 5.
  // Sono le cinque tappe della catena, e fonderne due nasconderebbe proprio il passo che si vuole guardare: fra
  // Colori e Macchie sta la tracciatura, ed e' li' che una linea netta si perde. Il controllo regge: il track e'
  // inline-flex. Ambito: solo questo tool. Se un terzo tool chiedera' la stessa cosa, l'eccezione va promossa a
  // variante documentata del DS. Il div attorno non e' decorativo: tiene il gruppo come UN solo item della barra.
  const viste = `<div>
          <div class="rg-segmented" role="group" aria-label="Cosa guardare">
            <button type="button" class="rg-segmented__item" data-vista="originale" aria-pressed="false">Originale</button>
            <button type="button" class="rg-segmented__item" data-vista="colori" aria-pressed="false">Colori</button>
            <button type="button" class="rg-segmented__item" data-vista="macchie" aria-pressed="false">Macchie</button>
            <button type="button" class="rg-segmented__item rg-segmented__item--active" data-vista="ricamo" aria-pressed="true">Ricamo</button>
            <button type="button" class="rg-segmented__item" data-vista="passaggi" aria-pressed="false">Passaggi</button>
          </div>
        </div>`;

  root.innerHTML = scheletro({
    topbar: topbar('Punto Pittorico', opts.backHref),
    classe: 'pittorico-workspace',
    pannello: [
      sezioneSorgente({
        tipo: 'immagine', accetta: 'image/*', statoIniziale: 'Nessuna immagine: caricane una per cominciare',
        larghezzaReale: false, extra: campo('realWidth'), demo: 'Immagine demo',
      }),
      sezioneCampi(2, 'Colori', ['colorCount', 'minAreaMm2', 'flattenLightMm', 'smoothMm'], `
    <div class="rg-param-grid__wide">
      <p class="rg-field__label">Fili trovati, nell'ordine di cucitura</p>
      <div class="pittorico-aghi" id="aghi"><p class="rg-field__help">carica un'immagine</p></div>
    </div>`),
      sezioneCampi(3, 'Punto', ['densitySpacingMm', 'maxInternalTravelMm', 'maxStitchMm']),
      sezioneCampi(4, 'Bordi e sfumature', ['frangiaMm', 'lisciaBordiMm', 'sogliaSfumaturaMm', 'crescitaMm', 'sormontoMm']),
    ],
    anteprima: {
      viste, genera: true, simula: true, esportaSpenti: true,
      ricalcolaDaSolo: { acceso: false, aiuto: 'Su un disegno grande costa qualche secondo: di solito conviene premere Genera dopo aver messo la larghezza reale.' },
    },
  });
  attivaCampiNumero(root);
  // la simulazione (U3): si collega più sotto, quando la tela e le viste esistono; fino ad allora non c'è niente da fermare
  let sim: { ferma(): void } | null = null;
  root.querySelector('#status')!.textContent = "Carica un'immagine, poi premi Genera";

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const params: PittoricoParams = { ...defaultPittoricoParams };
  let sorgente: Sorgente | null = null;
  let nomeFile = '';
  let piano: PittoricoPlan | null = null;
  let immagine: HTMLImageElement | null = null;
  let vista: Vista = 'ricamo';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => {
    $('zoom').textContent = `zoom ${Math.round(z * 100)}%`;
  });
  $('fitBtn').addEventListener('click', () => pz.fit());
  sim = collegaSimula({
    pulsante: $('simBtn') as HTMLButtonElement, host: $('layer'), controlli: $('simControlli'),
    stato: (t) => { $('status').textContent = t; },
    dati: (): DatiSimulazione | null => (piano ? datiDaStrati(pittoricoExportLayers(piano), { label: 'PITTORICO' }) : null),
    ripristina: () => disegna(),
    senzaDati: "Niente da simulare: prima premi Genera.",
  });

  // ---- i campi ---------------------------------------------------------------
  for (const c of CAMPI) {
    const el = $(c.id) as HTMLInputElement;
    impostaNumero(el, params[c.key] as number);
    el.addEventListener('change', () => {
      let v = c.int ? Math.round(leggiCampo(el)) : leggiCampo(el);
      if (!Number.isFinite(v)) v = Number(defaultPittoricoParams[c.key]);
      if (c.min !== undefined) v = Math.max(c.min, v);
      if (c.max !== undefined) v = Math.min(c.max, v);
      (params[c.key] as number) = v;
      impostaNumero(el, v);
      $('status').textContent = 'Parametri cambiati: premi Genera';
      if (($('autoCalcolo') as HTMLInputElement).checked && sorgente) $('genBtn').click();
    });
  }
  const rileggiCampi = (): void => {
    for (const c of CAMPI) impostaNumero($(c.id) as HTMLInputElement, params[c.key] as number);
  };

  // ---- import: File → <img> → <canvas> → pixel (l'unico pezzo legato al DOM) ----
  const apriImmagine = (url: string, nome: string, rilascia: boolean): void => {
    const el = new Image();
    el.onload = () => {
      if (rilascia) URL.revokeObjectURL(url);
      nomeFile = nome;
      sorgente = {
        name: nome,
        pixelsAt: (maxWidthPx: number) => {
          let w = el.naturalWidth || el.width;
          let h = el.naturalHeight || el.height;
          if (maxWidthPx > 0 && w > maxWidthPx) {
            const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s));
          }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(el, 0, 0, w, h);
          return { rgba: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
        },
      };
      const px = el.naturalWidth || el.width;
      $('fileStatus').textContent = `${nome} · ${px} × ${el.naturalHeight || el.height} px`;
      $('status').textContent = params.realWidthMm > 0
        ? 'Immagine caricata: premi Genera'
        : 'Immagine caricata. Metti la larghezza reale in mm, poi premi Genera';
      immagine = el;
      vista = 'originale';
      segnaVista();
      mostraImmagine(el);
      pz.fit();
    };
    el.onerror = () => { $('status').textContent = 'Immagine non leggibile'; if (rilascia) URL.revokeObjectURL(url); };
    el.src = url;
  };
  ($('fileInput') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    apriImmagine(URL.createObjectURL(f), f.name, true);
  });
  $('demoBtn').addEventListener('click', () => apriImmagine(disegnaDemo().toDataURL('image/png'), 'immagine-demo.png', false));

  /** L'immagine appena caricata si VEDE subito: serve a capire se è entrata giusta. */
  function mostraImmagine(el: HTMLImageElement): void {
    const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
    const larg = params.realWidthMm > 0 ? params.realWidthMm : w;
    const alt = (h / w) * larg;
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${larg.toFixed(1)}mm" height="${alt.toFixed(1)}mm" viewBox="0 0 ${larg.toFixed(1)} ${alt.toFixed(1)}">`
      + `<image href="${el.src}" x="0" y="0" width="${larg.toFixed(1)}" height="${alt.toFixed(1)}" /></svg>`;
  }

  // ---- genera ----------------------------------------------------------------
  $('genBtn').addEventListener('click', () => {
    sim?.ferma();
    if (!sorgente) { $('status').textContent = 'Prima carica un\'immagine'; return; }
    $('status').textContent = 'Calcolo il ricamo…';
    // un giro di rendering prima di bloccare il thread, così il messaggio si vede davvero
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const img = (sorgente as Sorgente).pixelsAt(MAX_WIDTH_PX);
        // la larghezza reale vale per l'immagine INTERA: se qui è ridotta, il rapporto non cambia
        const p: PittoricoParams = { ...params, realWidthMm: params.realWidthMm > 0 ? params.realWidthMm : img.width };
        piano = buildPittoricoPlan(img, p);
        // dall'immagine si passa da soli al ricamo: e' quello che si e' appena chiesto di calcolare
        if (vista === 'originale') vista = 'ricamo';
        segnaVista();
        disegna();
        mostraAghi(piano);
        ($('exportBtn') as HTMLButtonElement).disabled = false;
        ($('exportDstBtn') as HTMLButtonElement).disabled = false;
        const ms = Math.round(performance.now() - t0);
        const nasc = piano.saltoMm > 0
          ? Math.round((100 * piano.passaggiPerAgo.reduce((s, a) => s + a.passaggiCopertiMm, 0)) / piano.saltoMm)
          : 100;
        $('status').textContent = `${piano.macchie.length} macchie · ${piano.ordine.length} aghi · `
          + `${(piano.filoMm / 1000).toFixed(1)} m di filo · ${piano.punti.toLocaleString('it-IT')} punti · `
          + `passaggi ${(piano.saltoMm / 1000).toFixed(1)} m (${nasc}% nascosti) · ${piano.salti} salti · ${ms} ms`;
        pz.fit();
      } catch (e) {
        $('status').textContent = `Non ce l'ho fatta: ${(e as Error).message}`;
      }
    }, 20);
  });

  // ---- le viste ---------------------------------------------------------------

  /**
   * Segna la vista corrente e spegne quelle che non hanno ancora niente da mostrare: prima di
   * Genera, "Ricamo" e "Passaggi" darebbero un canvas vuoto, che non e' un'informazione — e' un
   * dubbio. Classe e `aria-pressed` si aggiornano insieme su TUTTI gli item: il CSS del DS aggancia
   * l'uno o l'altro, e tenerne solo uno lascerebbe due voci accese.
   */
  function segnaVista(): void {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-vista]')) {
      const attiva = b.dataset.vista === vista;
      b.classList.toggle('rg-segmented__item--active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
      b.disabled = b.dataset.vista === 'originale' ? !immagine : !piano;
    }
  }

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-vista]')) {
    b.addEventListener('click', () => {
      vista = b.dataset.vista as Vista;
      segnaVista();
      disegna();
    });
  }

  /** La divisione in tinte e' una mappa di pixel: nel browser va in un canvas, non in un SVG. */
  function vistaColori(pl: PittoricoPlan): void {
    const cv = document.createElement('canvas');
    cv.width = pl.larghezzaPx; cv.height = pl.altezzaPx;
    cv.style.width = `${pl.larghezzaMm.toFixed(2)}mm`;
    cv.style.height = `${pl.altezzaMm.toFixed(2)}mm`;
    const dati = cv.getContext('2d')!.createImageData(pl.larghezzaPx, pl.altezzaPx);
    dati.data.set(pixelDeiColori(pl));
    cv.getContext('2d')!.putImageData(dati, 0, 0);
    $('layer').innerHTML = '';
    $('layer').appendChild(cv);
  }

  /**
   * Cambiare vista ridisegna DENTRO il layer e non tocca pan e zoom: e' tutto il senso di avere
   * cinque viste, perche' confrontarne due senza spostare l'inquadratura e' l'unico modo per vedere
   * dove il filo di passaggio finisce rispetto al riempimento.
   */
  function disegna(): void {
    sim?.ferma();
    if (vista === 'originale') {
      if (immagine) mostraImmagine(immagine);
      return;
    }
    if (!piano) { $('status').textContent = 'Per questa vista serve il ricamo: premi Genera'; return; }
    if (vista === 'colori') { vistaColori(piano); return; }
    const strati = vista === 'macchie' ? [] : pittoricoExportLayers(piano);
    $('layer').innerHTML = vista === 'macchie' ? svgMacchie(piano)
      : vista === 'passaggi' ? svgPassaggi(piano, strati)
        : svgRicamo(piano, strati);
  }

  function mostraAghi(pl: PittoricoPlan): void {
    const righe = pl.ordine.map((t, i) => {
      const macchie = pl.macchie.filter((m) => m.tinta === t);
      let mm = 0;
      for (const m of macchie) for (const c of m.corse) {
        for (let k = 1; k < c.length; k++) mm += Math.hypot(c[k].x - c[k - 1].x, c[k].y - c[k - 1].y);
      }
      const dalla = macchie.filter((m) => m.metodo === 'rotaia').length;
      return `<div class="pittorico-ago">
        <span class="pittorico-ago__n">${i + 1}</span>
        <span class="pittorico-ago__swatch" style="background:${rgbToHex(pl.palette[t])}"></span>
        <span>${macchie.length} macchie<span class="rg-field__help"> · ${dalla} ordinate dalla rotaia</span></span>
        <span class="pittorico-ago__mis rg-mono">${(mm / 1000).toFixed(1)} m</span>
      </div>`;
    }).join('');
    $('aghi').innerHTML = righe
      + `<p class="rg-field__help">${pl.bordiSfumati} bordi su ${pl.bordiTotali} sfumano: lì il ricamo si compenetra con le frange.</p>`;
  }

  // ---- riapertura di un progetto ---------------------------------------------
  ($('progettoInput') as HTMLInputElement).addEventListener('change', async (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const meta = f.name.toLowerCase().endsWith('.dst')
        ? readDstMetadata(new Uint8Array(await f.arrayBuffer()))
        : readProjectMetadata(await f.text());
      const salvati = meta?.params as Partial<PittoricoParams> | undefined;
      if (!meta || meta.rgProject !== 'pittorico' || !salvati) {
        $('progettoStatus').textContent = 'Questo file non viene dal Punto Pittorico';
        return;
      }
      for (const c of CAMPI) {
        const v = salvati[c.key];
        if (typeof v === 'number' && Number.isFinite(v)) (params[c.key] as number) = v;
      }
      rileggiCampi();
      $('progettoStatus').textContent = `Parametri ripresi da ${f.name}`;
      $('status').textContent = 'Parametri ripresi: ricarica l\'immagine e premi Genera';
    } catch (e) {
      $('progettoStatus').textContent = `Non riesco a leggerlo: ${(e as Error).message}`;
    }
  });

  // ---- esportazione ----------------------------------------------------------
  const nomeBase = (): string => (nomeFile ? nomeFile.replace(/\.[^.]+$/, '') : 'pittorico');
  const metadati = (): Record<string, unknown> => ({ rgProject: 'pittorico', version: '0.1.0', params: { ...params } });
  /** La sorgente della busta: l'immagine caricata, con la larghezza reale se c'e'. Senza file, niente. */
  const sorgenteBusta = () => (nomeFile
    ? { tipo: 'raster' as const, nome: nomeFile, ...(params.realWidthMm > 0 ? { larghezzaMm: params.realWidthMm } : {}) }
    : undefined);

  $('exportBtn').addEventListener('click', async () => {
    if (!piano) { $('status').textContent = 'Niente da esportare: premi Genera'; return; }
    try {
      const layers = pittoricoExportLayers(piano);
      const svg = buildSvg(layers, {
        bounds: bounds(layers.flatMap((l) => l.polylines.flat())),
        marginMm: 4,
        metadata: conBusta(metadati(), { strati: layers, sorgente: sorgenteBusta() }),
      });
      const esito = await saveTextFile(svg, { suggestedName: `${nomeBase()}-pittorico.svg`, description: 'Immagine SVG' });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}-pittorico.svg`);
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });

  $('exportDstBtn').addEventListener('click', async () => {
    if (!piano) { $('status').textContent = 'Niente da esportare: premi Genera'; return; }
    try {
      const strati = pittoricoExportLayers(piano);
      const bytes = dstFromExportLayers(strati, { label: 'PITTORICO', metadata: conBusta(metadati(), { strati, sorgente: sorgenteBusta() }) });
      const esito = await saveBinaryFile(bytes, { suggestedName: `${nomeBase()}.dst`, ...DST_FILE });
      $('status').textContent = saveOutcomeMessage(esito, `${nomeBase()}.dst`);
    } catch (e) {
      $('status').textContent = `Esportazione non riuscita: ${(e as Error).message}`;
    }
  });
}

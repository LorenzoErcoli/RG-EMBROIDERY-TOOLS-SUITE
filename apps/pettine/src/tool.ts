// Guscio del tool "Punto pettine" (DOM/browser). La geometria non è qui: è in `motore.ts`, lo stesso
// codice che gira headless negli script (R28). Qui si caricano i due file, si girano le manopole, si
// sceglie il ritaglio e si esporta.
//
// LA FORMA DEL PANNELLO viene dal subagent `design-system`, che ha deciso quattro cose degne di nota:
//
// 1. È **Testa A a due sezioni** — `01 Blocchi e fotografia` (il titolo canonico «Sagoma» sarebbe
//    falso: i file sono due e solo uno è la sagoma) e `02 Ritaglio`, che sta in testa perché senza i
//    file quei millimetri non vogliono dire niente, e perché è lui a decidere quanto costa «Genera».
// 2. Gli **export stanno nella barra dell'anteprima**, con «Genera»: sono azioni sull'anteprima e
//    devono restare raggiungibili mentre il pannello scorre. La coda `07 Esito` tiene i numeri.
// 3. **Niente `type="number"`** (DS 1.15.0): scorrendo il pannello con la rotellina sopra un campo a
//    fuoco il valore cambiava da solo, e la virgola italiana veniva rifiutata. Qui i campi sono
//    `type="text" inputmode="decimal"` e la validazione la fa l'app, non il browser.
// 4. **Il minimo sopra il massimo non si corregge di nascosto**: si dice, con l'aiuto del campo che
//    cambia testo e i due campi in stato d'errore.
//
// IL RITAGLIO è il motivo per cui il tool nasce adesso (Lorenzo, 2026-09-09): *«devo chiederti un
// favore, di darmi la possibilità di croppare l'immagine originale così che posso provare a fare
// degli swatch più piccoli»*. Si scrive nei quattro campi oppure si tira col mouse sull'anteprima.
// Il DST che esce ha l'origine nell'angolo del ritaglio: lo swatch parte da (0,0) e si monta in
// macchina senza spostare niente.

import '@rg/ui/rg.css';
import './pettine.css';
import { DST_FILE, readDstMetadata, conBusta, type PixelImage } from '@rg/core';
import { topbar } from '@rg/ui/tools';
import { scheletro, sezioneSorgente, sezione, campoNumero, attivaCampiNumero, leggiCampo, impostaNumero, type OpzioniCampoNumero } from '@rg/ui/anatomia';
import { hookPanZoom } from '@rg/ui/panzoom';
import { saveTextFile, saveBinaryFile, saveOutcomeMessage } from '@rg/ui/save';
import { montaSimulatore, type Simulatore } from '@rg/ui/simulatore';
// il pannello di esempio, per provare il tool senza cercare i file (e per il simulatore)
const ESEMPIO_SVG = new URL('../fixtures/VETTORIALE-6-colori-v2-gruppo-blocchi.svg', import.meta.url).href;
import {
  costruisciPettine, parametriPettineDefault,
  type ParametriPettine, type Riquadro, type EsitoPettine,
} from './motore';

interface Campo { id: string; key: keyof ParametriPettine; min: number; max: number }
const CAMPI: Campo[] = [
  { id: 'densitySpacingMm', key: 'basiMm', min: 0.8, max: 12 },
  { id: 'denteInterlineMm', key: 'passoMm', min: 1, max: 8 },
  { id: 'denteMinMm', key: 'denteMinMm', min: 0.5, max: 20 },
  { id: 'denteMaxMm', key: 'denteMaxMm', min: 0.5, max: 20 },
  { id: 'aperturaDeg', key: 'aperturaDeg', min: 0, max: 80 },
  { id: 'sormontoMm', key: 'sormontoMm', min: 0, max: 20 },
  { id: 'sconfinamentoMm', key: 'sconfinaMm', min: 0, max: 10 },
  { id: 'passaggioMaxMm', key: 'passaggioMaxMm', min: 4, max: 250 },
  { id: 'passaggioNascostoMm', key: 'passaggioNascostoMm', min: 4, max: 400 },
  { id: 'tintaMinimaMm', key: 'tintaMinimaMm', min: 0, max: 40 },
  { id: 'golaMm', key: 'golaMm', min: 0, max: 100 },
  { id: 'spianaturaMm', key: 'spianaMm', min: 0.5, max: 20 },
  { id: 'addolcimentoMmMm', key: 'addolcisciMm', min: 0, max: 1 },
  { id: 'chiusuraMm', key: 'chiudiMm', min: 0, max: 20 },
  { id: 'traslazioneMm2', key: 'traslaMaxMm2', min: 0, max: 200000 },
];

// Testi, unità e limiti dei campi numerici (le stesse parole di prima, ora costruite da campoNumero).
const DATI_CAMPI: Record<string, Omit<OpzioniCampoNumero, 'id'>> = {
  realWidth: {etichetta:"Larghezza reale del pannello",unita:"mm",valore:419.45,passo:1,min:10,aiuto:"Comanda la scala di tutto: i millimetri del ritaglio e dei punti sono misurati su questa.",largo:true},
  ritaglioXMm: {etichetta:"Da sinistra",unita:"mm",valore:0,passo:1,min:0,attributi:"aria-describedby=\"aiutoRitaglio\""},
  ritaglioYMm: {etichetta:"Dall'alto",unita:"mm",valore:0,passo:1,min:0,attributi:"aria-describedby=\"aiutoRitaglio\""},
  ritaglioLarghezzaMm: {etichetta:"Larghezza",unita:"mm",valore:0,passo:1,min:0,attributi:"aria-describedby=\"aiutoRitaglio\""},
  ritaglioAltezzaMm: {etichetta:"Altezza",unita:"mm",valore:0,passo:1,min:0,attributi:"aria-describedby=\"aiutoRitaglio\""},
  densitySpacingMm: {etichetta:"Distanza tra le linee",unita:"mm",valore:2,passo:0.5,min:0.8,max:12,aiuto:"Di quanto una linea di base dista dalla successiva, misurata di traverso. Si devono sovrastare: a 2 mm i denti di una coprono la vicina."},
  denteInterlineMm: {etichetta:"Densità del pettine",unita:"mm",valore:1.5,passo:0.1,min:1,max:8,aiuto:"Distanza fra un dente e il successivo lungo la linea di base. Non scende sotto 1."},
  denteMinMm: {etichetta:"Lunghezza minima",unita:"mm",valore:3,passo:0.5,min:0.5,max:20,attributi:"aria-describedby=\"aiutoDente\""},
  denteMaxMm: {etichetta:"Lunghezza massima",unita:"mm",valore:5,passo:0.5,min:0.5,max:20,attributi:"aria-describedby=\"aiutoDente\""},
  aperturaDeg: {etichetta:"Apertura",unita:"°",valore:40,passo:1,min:0,max:80,aiuto:"Di quanto il dente si scosta, a caso, dal verso del chiaro. A 0 vanno tutti dritti."},
  sormontoMm: {etichetta:"Sormonto",unita:"mm",valore:4,passo:0.5,min:0,max:20,aiuto:"Se entro tanto, verso il chiaro, c'è una tinta più chiara, il dente si cuce anche con quella: prima, e sotto. È così che le tinte si mescolano dentro un gruppo."},
  sconfinamentoMm: {etichetta:"Sconfinamento fra blocchi",unita:"mm",valore:1,passo:0.5,min:0,max:10,aiuto:"Quanto le righe di un blocco entrano in quello accanto, perché la giunta non resti nuda. Alzandolo le righe dei due blocchi si affiancano e si vede una banda più fitta: a 2,5 mm sono il doppio che a 1."},
  passaggioMaxMm: {etichetta:"Passaggio più lungo",unita:"mm",valore:30,passo:1,min:4,max:250,aiuto:"Fin dove un passaggio si cuce comunque, anche se un pezzetto si vedrà. Oltre questa misura il passaggio si fa lo stesso, ma solo se il cammino resta nascosto sotto ciò che verrà dopo e a vista ne resta meno di 3 mm: sul pannello a sei tinte i tagli passano da 424 a 168. Negli ultimi due colori i passaggi lunghi non si fanno, perché lì non viene più nessuno a coprirli."},
  passaggioNascostoMm: {etichetta:"Passaggio nascosto più lungo",unita:"mm",valore:400,passo:5,min:4,max:400,aiuto:"Fin dove si prova un passaggio che va oltre la misura qui sopra, e che quindi si fa solo se resta nascosto. Nascosto vuol dire: nella banda di sovrapposizione fra il colore in corso e uno più scuro accanto, o sulla linea esatta di una base futura dello stesso colore. Dentro il proprio colore un passaggio si vede fra un dente e l’altro, e allora si taglia. Le macchie piccole non contano qui: per incastrarle in una riga grande il corridoio può arrivare a 15 cm."},
  golaMm: {etichetta:"Gola attraversata",unita:"mm",valore:30,passo:1,min:0,max:100,aiuto:"Fin dove la riga più esterna di una fascia attraversa una gola senza spezzarsi: un tratto di tinta più chiara, già cucita, o troppo addossato alla riga prima, incastrato fra due tratti della stessa tinta. La riga dentata continua sopra e raggiunge l’altro pezzo, invece di lasciarlo orfano con un taglio. A 0 non lo fa mai."},
  tintaMinimaMm: {etichetta:"Tinta più corta",unita:"mm",valore:6,passo:1,min:0,max:40,aiuto:"Quanto deve durare una tinta lungo una riga per meritare un cambio di colore. Sotto, la riga tiene il colore che aveva: senza, restano pezzetti da 5 mm che il loro colore deve andarsi a prendere da lontano."},
  spianaturaMm: {etichetta:"Spianatura",unita:"mm",valore:5,passo:0.5,min:0.5,max:20},
  chiusuraMm: {etichetta:"Chiusura",unita:"mm",valore:3,passo:0.5,min:0,max:20},
  addolcimentoMmMm: {etichetta:"Addolcimento",unita:"mm/mm",valore:0.15,passo:0.05,min:0,max:1},
  traslazioneMm2: {etichetta:"Traslazione fino a",unita:"mm²",valore:9000,passo:1000,min:0,max:200000},
};

/** I numeri si scrivono e si leggono all'italiana: 0,15 e 419,45. */
const n1 = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 2 });
const n0 = (v: number): string => v.toLocaleString('it-IT', { maximumFractionDigits: 0 });

/** La foto, decodificata dal canvas del browser: è l'unico pezzo a DOM di tutta la catena. */
async function leggiImmagine(file: File): Promise<PixelImage> {
  const bitmap = await createImageBitmap(file);
  // oltre i 2000 px non serve: la foto dice solo dove un bordo stacca e dove sfuma
  const scala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scala));
  const height = Math.max(1, Math.round(bitmap.height * scala));
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
}

export function mountPettine(root: HTMLElement, opts: { backHref?: string } = {}): void {
  const campo = (id: string): string => campoNumero({ id, ...DATI_CAMPI[id] });
  root.innerHTML = scheletro({
    topbar: topbar('Punto pettine sfrangiato', opts.backHref),
    classe: 'pettine-workspace',
    pannello: [
      sezioneSorgente({
        tipo: 'cartamodello', accetta: '.svg,image/svg+xml', etichettaCarica: 'Carica i blocchi…',
        statoIniziale: "Nessun file caricato. Serve l'SVG con i gruppi di colore.",
        demo: 'Usa il pannello di esempio', larghezzaReale: false,
        extra: `${campo('realWidth')}
          <dl class="rg-key-value rg-param-grid__wide" id="infoBlocchi" hidden></dl>
          <div class="rg-file-input rg-param-grid__wide">
            <label class="rg-file-input__control">
              <input type="file" id="fileFoto" accept="image/*,.bmp">
              <span class="rg-button rg-button--outline">Carica la fotografia…</span>
            </label>
            <p class="rg-file-input__status" id="statoFoto" role="status">Nessun file caricato. Senza, i denti attraversano ogni bordo invece di fermarsi dove la foto stacca.</p>
          </div>`,
      }),
      sezione({
        indice: 2, titolo: "Ritaglio",
        contenuto: `<div class="rg-param-grid">
    <p class="rg-field__help rg-param-grid__wide" id="aiutoRitaglio">
      Il rettangolo da generare, misurato sul pannello intero: «da sinistra» e «dall'alto» sono l'angolo
      in alto a sinistra, gli stessi X e Y che leggi in Illustrator. A larghezza e altezza zero il
      ritaglio è spento. Si può anche tirare col mouse sull'anteprima.
    </p>
    <div class="rg-field rg-param-grid__wide">
      <span class="rg-field__label">Strumento</span>
      <div class="rg-segmented" id="modo" role="group" aria-label="Strumento sull'anteprima">
        <button type="button" class="rg-segmented__item rg-segmented__item--active" data-modo="sposta" aria-pressed="true">Sposta</button>
        <button type="button" class="rg-segmented__item" data-modo="ritaglia" aria-pressed="false">Ritaglia</button>
      </div>
    </div>
    ${campo('ritaglioXMm')}
    ${campo('ritaglioYMm')}
    ${campo('ritaglioLarghezzaMm')}
    ${campo('ritaglioAltezzaMm')}
    <p class="rg-field__help rg-param-grid__wide" id="statoRitaglio" role="status">Ritaglio spento: si genera tutto il pannello, e ci vuole qualche secondo.</p>
    <div class="rg-cluster rg-param-grid__wide">
      <button type="button" id="tuttoBtn" class="rg-button rg-button--outline" disabled>Tutto il pannello</button>
    </div>
  </div>`,
      }),
      sezione({
        indice: 3, titolo: "Linee", id: 'sezLinee', apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid">
    ${campo('densitySpacingMm')}
  </div>`,
      }),
      sezione({
        indice: 4, titolo: "Pettine", id: 'sezPettine', apribile: true, aperta: true,
        contenuto: `<div class="rg-param-grid">
    ${campo('denteInterlineMm')}
    ${campo('denteMinMm')}
    ${campo('denteMaxMm')}
    <p class="rg-field__help rg-param-grid__wide" id="aiutoDente">Quanto è lungo un dente: si estrae fra questi due, e quella è la lunghezza del punto.</p>
    ${campo('aperturaDeg')}
    <label class="rg-toggle rg-param-grid__wide">
      <input type="checkbox" id="denti" checked><span class="rg-toggle__track"></span><span>Metti i denti</span>
    </label>
    <p class="rg-field__help rg-param-grid__wide">Senza denti escono solo le linee di base: si guarda la struttura in un attimo, e non si costruisce il DST.</p>
  </div>`,
      }),
      sezione({
        indice: 5, titolo: "Sovrapposizione", id: 'sezSormonto', apribile: true, aperta: false,
        contenuto: `<div class="rg-param-grid">
    ${campo('sormontoMm')}
    ${campo('sconfinamentoMm')}
    ${campo('passaggioMaxMm')}
    ${campo('passaggioNascostoMm')}
    ${campo('golaMm')}
    ${campo('tintaMinimaMm')}
  </div>`,
      }),
      sezione({
        indice: 6, titolo: "Curve", id: 'sezCurve', apribile: true, aperta: false,
        contenuto: `<div class="rg-param-grid">
    ${campo('spianaturaMm')}
    ${campo('chiusuraMm')}
    ${campo('addolcimentoMmMm')}
    ${campo('traslazioneMm2')}
    <p class="rg-field__help rg-param-grid__wide">I gruppi più piccoli della soglia si costruiscono spostando il muro chiaro senza deformarlo; i più grandi facendo crescere la macchia di un passo per volta. Spianatura e chiusura smussano gli spigoli; l'addolcimento cresce con la distanza dal muro.</p>
  </div>`,
      }),
      sezione({
        indice: 7, titolo: "Esito", id: 'sezEsito', apribile: true, aperta: false,
        contenuto: `<div class="rg-param-grid">
    <div class="rg-alert rg-alert--warning rg-param-grid__wide" id="esitoVecchio" hidden>
      <p class="rg-alert__message">Parametri cambiati dopo l'ultima generazione: questi numeri sono di prima. Premi «Genera».</p>
    </div>
    <p class="rg-field__help rg-param-grid__wide" id="esitoVuoto">Nessuna generazione ancora: premi «Genera» e qui compaiono i numeri della cucitura.</p>
    <dl class="rg-key-value rg-param-grid__wide" id="esito" hidden></dl>
    <label class="rg-toggle rg-param-grid__wide">
      <input type="checkbox" id="mostraNudi"><span class="rg-toggle__track"></span><span>Segna in rosa quello che resta scoperto</span>
    </label>
    <label class="rg-toggle rg-param-grid__wide">
      <input type="checkbox" id="mostraPassaggi" checked><span class="rg-toggle__track"></span><span>Disegna i passaggi</span>
    </label>
    <p class="rg-field__help rg-param-grid__wide">I passaggi sono il filo che va da una riga all'altra invece di essere tagliato: nel disegno sono più sottili e trasparenti del ricamo, perché nel pannello finiscono sotto le righe che vengono dopo.</p>
  </div>`,
      }),
    ],
    anteprima: {
      viste: '<button type="button" id="vistaBtn" class="rg-button rg-button--ghost rg-button--small" aria-pressed="false" disabled>Verifica</button>',
      ricalcolaDaSolo: { acceso: false, aiuto: 'Tutto il pannello costa qualche secondo: di solito conviene premere Genera dopo aver scelto il ritaglio.' },
      genera: true, simula: true, esportaSpenti: true,
    },
  });
  attivaCampiNumero(root);
  // i bottoni spenti finché non c'è un esito
  (root.querySelector('#genBtn') as HTMLButtonElement).disabled = true;
  (root.querySelector('#simBtn') as HTMLButtonElement).disabled = true;
  root.querySelector('#status')!.textContent = 'Carica i blocchi e la fotografia, poi premi «Genera».';
  root.querySelector('#progettoStatus')!.textContent = 'Un DST o un SVG usciti da qui riportano dentro i blocchi, il ritaglio e tutti i parametri. La fotografia no: va ricaricata.';

  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`) as HTMLElement;
  const input = (id: string): HTMLInputElement => $(id) as HTMLInputElement;
  const par: ParametriPettine = { ...parametriPettineDefault };
  let testoSvg = '';
  let nomeSvg = '';
  let foto: PixelImage | null = null;
  let nomeFoto = '';
  let larghezzaRealeMm = 419.45;
  let disegno = { larghezza: 0, altezza: 0 };
  // I QUATTRO NUMERI si tengono da parte, e `ritaglio` e' quello che ne esce (spento se larghezza o
  // altezza sono a zero). Rileggendoli invece dal ritaglio, scrivere «da sinistra» azzerava «larghezza»:
  // il campo appena compilato tornava a zero sotto le dita.
  const rit = { x: 0, y: 0, larghezza: 0, altezza: 0 };
  const ritaglioDa = (): Riquadro | null =>
    rit.larghezza <= 0 || rit.altezza <= 0 ? null : { x: Math.max(0, rit.x), y: Math.max(0, rit.y), larghezza: Math.max(5, rit.larghezza), altezza: Math.max(5, rit.altezza) };
  let ritaglio: Riquadro | null = null;
  let esito: EsitoPettine | null = null;
  let vista: 'pettine' | 'verifica' | 'simulatore' = 'pettine';
  let simulatore: Simulatore | null = null;
  let modo: 'sposta' | 'ritaglia' = 'sposta';

  const pz = hookPanZoom($('canvas'), $('layer'), (z) => { $('zoom').textContent = `zoom ${Math.round(z * 100)}%`; });
  $('fitBtn').addEventListener('click', () => pz.fit());

  // le sezioni richiudibili si ricordano come le hai lasciate
  for (const d of Array.from(root.querySelectorAll<HTMLDetailsElement>('details.rg-param-section'))) {
    const chiave = `pettine:${d.dataset.sez ?? d.id}`;
    const salvato = localStorage.getItem(chiave);
    if (salvato !== null) d.open = salvato === '1';
    d.addEventListener('toggle', () => localStorage.setItem(chiave, d.open ? '1' : '0'));
  }

  // ---- i campi ---------------------------------------------------------------
  const controllaDente = (): void => {
    const rotto = par.denteMinMm > par.denteMaxMm;
    for (const id of ['denteMinMm', 'denteMaxMm']) {
      input(id).closest('.rg-field')?.classList.toggle('is-error', rotto);
      input(id).setAttribute('aria-invalid', String(rotto));
    }
    $('aiutoDente').textContent = rotto
      ? 'La lunghezza minima è sopra la massima: correggi uno dei due, altrimenti i denti restano tutti della misura minima.'
      : 'Quanto è lungo un dente: si estrae fra questi due, e quella è la lunghezza del punto.';
  };
  for (const c of CAMPI) {
    const el = input(c.id);
    impostaNumero(el, Number(par[c.key]));
    el.addEventListener('change', () => {
      let v = leggiCampo(el);
      if (!Number.isFinite(v)) v = Number(parametriPettineDefault[c.key]);
      v = Math.min(c.max, Math.max(c.min, v));
      (par[c.key] as number) = v;
      impostaNumero(el, v);
      controllaDente();
      daRifare();
    });
  }
  input('realWidth').addEventListener('change', () => {
    const v = leggiCampo(input('realWidth'));
    if (Number.isFinite(v) && v >= 10) { larghezzaRealeMm = v; misuraDisegno(); mostraRitaglio(); mostraDisegno(); }
    impostaNumero(input('realWidth'), larghezzaRealeMm);
    daRifare();
  });
  for (const id of ['denti', 'mostraNudi', 'mostraPassaggi'] as const) {
    const el = input(id);
    el.checked = Boolean(par[id]);
    el.addEventListener('change', () => { (par[id] as boolean) = el.checked; par.dst = par.denti; daRifare(); });
  }

  // ---- il ritaglio -----------------------------------------------------------
  const CAMPI_RITAGLIO = ['ritaglioXMm', 'ritaglioYMm', 'ritaglioLarghezzaMm', 'ritaglioAltezzaMm'] as const;
  const mostraRitaglio = (): void => {
    ritaglio = ritaglioDa();
    const r = ritaglio;
    impostaNumero(input('ritaglioXMm'), rit.x);
    impostaNumero(input('ritaglioYMm'), rit.y);
    impostaNumero(input('ritaglioLarghezzaMm'), rit.larghezza);
    impostaNumero(input('ritaglioAltezzaMm'), rit.altezza);
    $('statoRitaglio').textContent = r
      ? `Si genera un riquadro di ${n1(r.larghezza)} × ${n1(r.altezza)} mm a ${n1(r.x)} / ${n1(r.y)}.`
      : disegno.larghezza
        ? `Ritaglio spento: tutto il pannello, ${n1(disegno.larghezza)} × ${n1(disegno.altezza)} mm.`
        : 'Ritaglio spento: si genera tutto il pannello, e ci vuole qualche secondo.';
    ($('tuttoBtn') as HTMLButtonElement).disabled = !r;
    disegnaCornice();
  };
  for (const id of CAMPI_RITAGLIO) {
    $(id).addEventListener('change', () => {
      const v = CAMPI_RITAGLIO.map((k) => leggiCampo(input(k)));
      if (v.some((x) => !Number.isFinite(x))) { mostraRitaglio(); return; }
      [rit.x, rit.y, rit.larghezza, rit.altezza] = [Math.max(0, v[0]), Math.max(0, v[1]), Math.max(0, v[2]), Math.max(0, v[3])];
      mostraRitaglio(); daRifare();
    });
  }
  $('tuttoBtn').addEventListener('click', () => { rit.x = 0; rit.y = 0; rit.larghezza = 0; rit.altezza = 0; mostraRitaglio(); daRifare(); });

  for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('#modo .rg-segmented__item'))) {
    b.addEventListener('click', () => {
      modo = (b.dataset.modo as 'sposta' | 'ritaglia') ?? 'sposta';
      for (const x of Array.from(root.querySelectorAll<HTMLButtonElement>('#modo .rg-segmented__item'))) {
        const attivo = x === b;
        x.classList.toggle('rg-segmented__item--active', attivo);
        x.setAttribute('aria-pressed', String(attivo));
      }
      $('canvas').classList.toggle('pettine-ritaglio', modo === 'ritaglia');
    });
  }

  /** Dal punto sullo schermo ai millimetri del disegno: si legge la geometria dell'SVG mostrato. */
  const inMm = (e: PointerEvent): { x: number; y: number } | null => {
    const svg = $('layer').querySelector('svg');
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    if (!vb || vb.length < 4 || box.width < 1) return null;
    return { x: vb[0] + ((e.clientX - box.left) / box.width) * vb[2], y: vb[1] + ((e.clientY - box.top) / box.height) * vb[3] };
  };
  let tiro: { x: number; y: number } | null = null;
  $('canvas').addEventListener('pointerdown', (e) => {
    if (modo !== 'ritaglia' || !testoSvg) return;
    e.stopPropagation(); e.preventDefault();
    tiro = inMm(e);
    try { $('canvas').setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, true);
  const tira = (e: PointerEvent): void => {
    if (!tiro) return;
    const p = inMm(e);
    if (!p) return;
    rit.x = Math.max(0, Math.min(tiro.x, p.x)); rit.y = Math.max(0, Math.min(tiro.y, p.y));
    rit.larghezza = Math.max(5, Math.abs(p.x - tiro.x)); rit.altezza = Math.max(5, Math.abs(p.y - tiro.y));
    mostraRitaglio();
  };
  $('canvas').addEventListener('pointermove', (e) => { if (modo === 'ritaglia' && tiro) { e.stopPropagation(); tira(e); } }, true);
  const finisciTiro = (e: PointerEvent): void => {
    if (!tiro) return;
    e.stopPropagation(); tira(e); tiro = null;
    try { $('canvas').releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    daRifare();
  };
  $('canvas').addEventListener('pointerup', finisciTiro, true);
  $('canvas').addEventListener('pointercancel', finisciTiro, true);

  // ---- i file ----------------------------------------------------------------
  const misuraDisegno = (): void => {
    const vb = /viewBox="([^"]+)"/.exec(testoSvg)?.[1];
    if (!vb) { disegno = { larghezza: 0, altezza: 0 }; return; }
    const [, , w, h] = vb.split(/[\s,]+/).map(Number);
    const k = larghezzaRealeMm / w;
    disegno = { larghezza: w * k, altezza: h * k };
  };
  // i blocchi arrivano da un file o dal pannello di esempio: da qui in poi e' la stessa strada
  const blocchiCaricati = (testo: string, nome: string): void => {
    testoSvg = testo;
    nomeSvg = nome;
    const file = { name: nome };
    const gruppi = (testoSvg.match(/<g\s+id="/g) ?? []).length;
    misuraDisegno();
    rit.x = 0; rit.y = 0; rit.larghezza = 0; rit.altezza = 0;
    if (!gruppi || !disegno.larghezza) {
      $('fileStatus').textContent = `${file.name} — non ci trovo gruppi con un id, o manca il viewBox.`;
      $('fileStatus').parentElement?.classList.add('rg-file-input--error');
      return;
    }
    $('fileStatus').parentElement?.classList.remove('rg-file-input--error');
    $('fileStatus').textContent = `${file.name} — ${gruppi} gruppi`;
    const info = $('infoBlocchi') as HTMLElement;
    info.hidden = false;
    info.innerHTML = `<dt>Misura</dt><dd>${n1(disegno.larghezza)} × ${n1(disegno.altezza)} mm</dd><dt>Gruppi</dt><dd>${gruppi}</dd>`;
    ($('genBtn') as HTMLButtonElement).disabled = false;
    $('status').textContent = 'Pronto: premi «Genera».';
    mostraRitaglio();
    mostraDisegno();
  };
  $('fileInput').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    blocchiCaricati(await file.text(), file.name);
  });
  $('demoBtn').addEventListener('click', () => {
    fetch(ESEMPIO_SVG).then((r) => r.text()).then((t) => {
      larghezzaRealeMm = 419.45;
      impostaNumero(input('realWidth'), 419.45);
      blocchiCaricati(t, 'VETTORIALE-6-colori-v2-gruppo-blocchi.svg');
      $('status').textContent = 'Pannello di esempio caricato, senza fotografia: premi «Genera».';
    }).catch((err) => { $('status').textContent = `Non ho trovato il pannello di esempio: ${(err as Error).message}`; });
  });
  $('fileFoto').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      foto = await leggiImmagine(file);
      nomeFoto = file.name;
      $('statoFoto').textContent = `${file.name} — ${foto.width} × ${foto.height} px`;
      $('statoFoto').parentElement?.classList.remove('rg-file-input--error');
    } catch {
      foto = null;
      $('statoFoto').textContent = 'Non sono riuscito a leggere questa immagine.';
      $('statoFoto').parentElement?.classList.add('rg-file-input--error');
    }
    daRifare();
  });

  // ---- l'anteprima -----------------------------------------------------------
  /** Prima di generare si guarda il disegno caricato, con sopra la cornice del ritaglio. */
  const mostraDisegno = (): void => {
    if (!testoSvg || !disegno.larghezza) return;
    const src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(testoSvg)))}`;
    $('layer').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${disegno.larghezza.toFixed(1)} ${disegno.altezza.toFixed(1)}" width="${disegno.larghezza.toFixed(1)}mm" height="${disegno.altezza.toFixed(1)}mm">
      <image href="${src}" x="0" y="0" width="${disegno.larghezza.toFixed(1)}" height="${disegno.altezza.toFixed(1)}"/>
      <g id="cornice"></g>
    </svg>`;
    disegnaCornice();
    pz.fit();
  };
  /** La cornice del ritaglio, dentro l'SVG che c'è (il disegno o il risultato). */
  const disegnaCornice = (): void => {
    const g = $('layer').querySelector('#cornice');
    if (!g) return;
    if (!ritaglio) { g.innerHTML = ''; return; }
    const r = ritaglio;
    g.innerHTML = `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.larghezza.toFixed(1)}" height="${r.altezza.toFixed(1)}"
      fill="none" stroke="#e0007f" stroke-width="${Math.max(0.4, disegno.larghezza / 500).toFixed(2)}" stroke-dasharray="3 2"/>`;
  };
  const mostraEsito = (): void => {
    if (!esito) return;
    if (simulatore) { simulatore.distruggi(); simulatore = null; }
    ($('simControlli') as HTMLElement).hidden = vista !== 'simulatore';
    $('simBtn').setAttribute('aria-pressed', String(vista === 'simulatore'));
    $('vistaBtn').setAttribute('aria-pressed', String(vista === 'verifica'));
    $('vistaBtn').textContent = vista === 'verifica' ? 'Ricamo' : 'Verifica';
    if (vista === 'simulatore' && esito.dst) {
      // IL SIMULATORE (Lorenzo, 2026-09-10): il DST appena generato si cuce sullo schermo, punto
      // per punto, nell'ordine in cui lo fara' la macchina; il filo e' grigio finche' l'ago non ci passa
      const rq = esito.statistiche.riquadro;
      simulatore = montaSimulatore($('layer'), $('simControlli'), esito.dst, esito.statistiche.colori, rq.larghezza, rq.altezza, (s) => { $('status').textContent = s; });
    } else {
      $('layer').innerHTML = vista === 'verifica' ? esito.svgVerifica : esito.svg;
    }
    pz.fit();
  };
  $('vistaBtn').addEventListener('click', () => {
    vista = vista === 'verifica' ? 'pettine' : 'verifica';
    mostraEsito();
  });
  $('simBtn').addEventListener('click', () => {
    vista = vista === 'simulatore' ? 'pettine' : 'simulatore';
    mostraEsito();
  });

  /** I numeri mostrati sono di prima: lo si dice, non si cancellano. */
  const daRifare = (): void => {
    const auto = $('autoCalcolo') as HTMLInputElement;
    const genera = $('genBtn') as HTMLButtonElement;
    if (auto.checked && testoSvg && !genera.disabled) { genera.click(); return; }
    if (!esito) return;
    ($('esitoVecchio') as HTMLElement).hidden = false;
    $('status').textContent = 'Parametri cambiati: premi «Genera».';
  };

  // ---- il progetto dentro il file (R9/R27) ------------------------------------
  /**
   * Cosa si porta dietro un file salvato. I BLOCCHI ci stanno dentro: l'SVG dei gruppi pesa 50 kB
   * contro i 600 kB del DST, e senza di lui il file si riaprirebbe a meta'. La FOTOGRAFIA no —
   * sarebbero altri 300 kB dentro ogni swatch — e va ricaricata a mano: lo dice il pannello.
   */
  const MAX_SVG_DENTRO = 400_000;
  const progetto = (): Record<string, unknown> => conBusta({
    rgProject: 'pettine',
    versione: 1,
    salvato: new Date().toISOString().slice(0, 10),
    par,
    ritaglio,
    larghezzaRealeMm,
    nomeSvg,
    nomeFoto,
    blocchi: testoSvg.length <= MAX_SVG_DENTRO ? testoSvg : null,
  }, { sorgente: { tipo: 'svg', nome: nomeSvg || undefined, larghezzaMm: larghezzaRealeMm } });
  const riapri = (p: Record<string, unknown> | null, da: string): void => {
    if (!p || p.rgProject !== 'pettine') {
      $('progettoStatus').textContent = `${da} non porta dentro un progetto del punto pettine.`;
      $('progettoStatus').parentElement?.classList.add('rg-file-input--error');
      return;
    }
    $('progettoStatus').parentElement?.classList.remove('rg-file-input--error');
    const sp = p.par as Partial<ParametriPettine> | undefined;
    if (sp) for (const c of CAMPI) {
      const v = sp[c.key];
      if (typeof v === 'number' && Number.isFinite(v)) { (par[c.key] as number) = Math.min(c.max, Math.max(c.min, v)); impostaNumero(input(c.id), par[c.key] as number); }
    }
    if (sp && typeof sp.denti === 'boolean') { par.denti = sp.denti; input('denti').checked = sp.denti; }
    if (sp && typeof sp.mostraNudi === 'boolean') { par.mostraNudi = sp.mostraNudi; input('mostraNudi').checked = sp.mostraNudi; }
    if (sp && typeof sp.mostraPassaggi === 'boolean') { par.mostraPassaggi = sp.mostraPassaggi; input('mostraPassaggi').checked = sp.mostraPassaggi; }
    if (typeof p.larghezzaRealeMm === 'number' && p.larghezzaRealeMm >= 10) { larghezzaRealeMm = p.larghezzaRealeMm; impostaNumero(input('realWidth'), larghezzaRealeMm); }
    if (typeof p.blocchi === 'string' && p.blocchi.length > 20) {
      testoSvg = p.blocchi;
      nomeSvg = typeof p.nomeSvg === 'string' ? p.nomeSvg : 'blocchi.svg';
      misuraDisegno();
      const gruppi = (testoSvg.match(/<g\s+id="/g) ?? []).length;
      $('fileStatus').textContent = `${nomeSvg} — ${gruppi} gruppi (dal progetto)`;
      const info = $('infoBlocchi') as HTMLElement;
      info.hidden = false;
      info.innerHTML = `<dt>Misura</dt><dd>${n1(disegno.larghezza)} × ${n1(disegno.altezza)} mm</dd><dt>Gruppi</dt><dd>${gruppi}</dd>`;
      ($('genBtn') as HTMLButtonElement).disabled = false;
    }
    const r = p.ritaglio as Riquadro | null | undefined;
    if (r && typeof r.larghezza === 'number') { rit.x = r.x; rit.y = r.y; rit.larghezza = r.larghezza; rit.altezza = r.altezza; }
    else { rit.x = 0; rit.y = 0; rit.larghezza = 0; rit.altezza = 0; }
    controllaDente();
    mostraRitaglio();
    mostraDisegno();
    const senzaFoto = p.nomeFoto ? ` La fotografia («${String(p.nomeFoto)}») va ricaricata a mano.` : '';
    $('progettoStatus').textContent = `Riaperto da ${da}${p.salvato ? `, salvato il ${String(p.salvato)}` : ''}.${senzaFoto}`;
    $('status').textContent = 'Progetto riaperto: premi «Genera».';
  };
  $('progettoInput').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (/\.dst$/i.test(file.name)) {
      riapri(readDstMetadata(new Uint8Array(await file.arrayBuffer())), file.name);
    } else {
      const testo = await file.text();
      const m = /<metadata id="rg-progetto">([\s\S]*?)<\/metadata>/.exec(testo);
      let letto: Record<string, unknown> | null = null;
      if (m) {
        try { letto = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')) as Record<string, unknown>; } catch { letto = null; }
      }
      riapri(letto, file.name);
    }
  });

  // ---- la generazione --------------------------------------------------------
  $('genBtn').addEventListener('click', () => {
    if (!testoSvg) return;
    const btn = $('genBtn') as HTMLButtonElement;
    btn.disabled = true;
    $('status').textContent = ritaglio ? 'Sto costruendo il ritaglio…' : 'Sto costruendo tutto il pannello: ci vuole qualche secondo…';
    // un giro di ridisegno prima di bloccare il thread col conto
    setTimeout(() => {
      try {
        esito = costruisciPettine({ testoSvg, larghezzaRealeMm, foto, ritaglio, progetto: progetto() }, { ...par, dst: par.denti });
        const s = esito.statistiche;
        const righe: Array<[string, string]> = [
          ['Gruppi', `${s.famiglie}${s.famiglieSaltate ? ` (${s.famiglieSaltate} saltati)` : ''}`],
          ['Linee di base', `${n0(s.tratti)} · ${n1(s.basiM)} m`],
        ];
        if (s.denti) righe.push(['Denti', `${n0(s.denti)} · ${n1(s.filoDentiM)} m`]);
        righe.push(['Scoperto', `${n1(s.nudoFiloPct)} %`]);
        righe.push(['Spaziatura', `${n1(s.spaziaturaMedianaMm)} mm · il 10% sotto ${n1(s.spaziaturaDecimoMm)}`]);
        righe.push(['Righe addosso', `${n1(s.righeAddossoPct)} % · in un gruppo ${n1(s.righeAddossoStessoGruppoPct)} %`]);
        if (s.punti) righe.push(
          ['Punti', n0(s.punti)],
          ['Filo', `${n1(s.filoM)} m`],
          ['Aghi', String(s.colori.length)],
          ['Blocchi', n0(s.blocchi)],
          ['Salti', `${n0(s.salti)} · ${n1(s.saltiM)} m`],
          ['Passaggi cuciti', `${n0(s.passaggi)} · ${n1(s.passaggiM)} m`],
          ['Passaggi a vista', `${n1(s.passaggiScopertiM)} m`],
          ['Corridoi', `${n1(s.corridoiM)} m di strada distinta · il più lungo ${n0(s.passaggioPiuLungoMm)} mm`],
          ['Righe inglobate', n0(s.righeInglobate)],
          ['Righe fuori ordine', n0(s.righeFuoriOrdine)],
          ['Scuro vicino al muro', `${n0(s.copertureFraColori)} coppie di righe`],
        );
        righe.push(['Tempo', `${n1(s.secondi)} s`]);
        const dl = $('esito') as HTMLElement;
        dl.hidden = false;
        dl.innerHTML = righe.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
        ($('esitoVuoto') as HTMLElement).hidden = true;
        ($('esitoVecchio') as HTMLElement).hidden = true;
        (root.querySelector('[data-sez="sezEsito"]') as HTMLDetailsElement).open = true;
        mostraEsito();
        ($('exportBtn') as HTMLButtonElement).disabled = false;
        ($('exportDstBtn') as HTMLButtonElement).disabled = !esito.dst;
        ($('vistaBtn') as HTMLButtonElement).disabled = false;
        ($('simBtn') as HTMLButtonElement).disabled = !esito.dst;
        if (vista === 'simulatore' && !esito.dst) vista = 'pettine';
        $('status').textContent = s.punti
          ? `Fatto in ${n1(s.secondi)} s: ${n0(s.punti)} punti, ${n1(s.filoM)} m di filo, ${s.colori.length} aghi.`
          : `Fatto in ${n1(s.secondi)} s: ${n0(s.tratti)} linee di base, ${n1(s.basiM)} m.`;
      } catch (err) {
        $('status').textContent = `Non ci sono riuscito: ${(err as Error).message}`;
      } finally {
        btn.disabled = false;
      }
    }, 30);
  });

  // ---- esportazione ----------------------------------------------------------
  const nomeProposto = (est: string): string => {
    const base = nomeSvg.replace(/\.svg$/i, '') || 'pettine';
    const r = ritaglio ? `-${n0(ritaglio.x)}_${n0(ritaglio.y)}-${n0(ritaglio.larghezza)}x${n0(ritaglio.altezza)}` : '';
    return `${base}-pettine${r}${est}`;
  };
  $('exportBtn').addEventListener('click', () => {
    if (!esito) return;
    const nome = nomeProposto('.svg');
    saveTextFile(vista === 'verifica' ? esito.svgVerifica : esito.svg, {
      suggestedName: nome, mime: 'image/svg+xml', extension: '.svg', description: 'Disegno SVG',
    }).then((r) => { $('status').textContent = saveOutcomeMessage(r, nome); });
  });
  $('exportDstBtn').addEventListener('click', () => {
    if (!esito?.dst) return;
    const nome = nomeProposto('.dst');
    saveBinaryFile(esito.dst, { suggestedName: nome, ...DST_FILE }).then((r) => {
      $('status').textContent = saveOutcomeMessage(r, nome);
    });
  });

  controllaDente();
  mostraRitaglio();
}

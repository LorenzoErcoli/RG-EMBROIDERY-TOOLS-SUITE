// IL BANCO DI PROVA — una pagina sola che mostra cosa sa fare il Punto Pittorico oggi.
//
// Nasce da una domanda di Lorenzo: «come posso vedere visivamente gli avanzamenti?». Fino a qui gli
// mandavo SVG sciolti, uno alla volta, senza i numeri accanto: si guarda un disegno e non si sa se
// è buono. Qui disegno e misura stanno nella stessa riga, e la pagina **si rigenera**: ogni passo
// avanti aggiunge un pannello invece di aggiungere un file da cercare.
//
// Non è l'interfaccia del tool (quella è il punto 5 del piano, e vive nella shell): è il banco su
// cui si guardano i pezzi mentre si costruiscono.
//
//   node apps/pittorico/scripts/misura.mjs                    (rigenera gli SVG dei riempimenti)
//   node apps/pittorico/scripts/immagine.mjs <cianotipia.bmp> (rigenera i contorni della foto)
//   npx esbuild apps/pittorico/scripts/banco.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/pittorico/scripts/banco.mjs
//   node apps/pittorico/scripts/banco.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const dir = (process.env.RG_OUT ?? new URL('./out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .replace(/\/?$/, '/');
mkdirSync(dir, { recursive: true });

/**
 * Prende un SVG generato e lo rende adatto a una pagina che ha due temi: i colori fissi diventano
 * `currentColor` e una tinta di contorno, così il filo si vede tanto su carta chiara quanto su
 * fondo scuro. Senza questo, sul tema scuro il disegno sparirebbe: nero su nero.
 */
function svgInline(nome: string, altezzaMax = 0): string {
  const f = `${dir}${nome}`;
  if (!existsSync(f)) return `<p class="manca">manca <code>${nome}</code>: rigeneralo con lo script che lo produce.</p>`;
  let s = readFileSync(f, 'utf8')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/stroke="#111111"/g, 'stroke="currentColor"')
    .replace(/stroke="#bbbbbb"/g, 'stroke="var(--traccia)"')
    .replace(/stroke="#d02020"/g, 'stroke="var(--misura)"')
    .replace(/font-family="monospace"/g, 'font-family="var(--mono)" fill="currentColor"')
    .replace(/width="[^"]*"\s+height="[^"]*"/, 'width="100%"');
  if (altezzaMax) s = s.replace('<svg ', `<svg style="max-height:${altezzaMax}px" `);
  return s;
}

const pagina = `<title>Banco del Punto Pittorico</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Spectral:wght@300;400;600&display=swap">
<style>
  :root {
    /* Una cianotipia è UN pigmento su carta: la pagina fa lo stesso, e l'unico colore che non è
       blu è quello della misura — lo stesso rosso col quale il cerchio ritrovato è disegnato. */
    --carta: #efe8d8;
    --carta-alta: #f7f2e6;
    --inchiostro: #0d2340;
    --inchiostro-2: #3d567a;
    --riga: #cabfa6;
    --traccia: #a99e86;
    --misura: #b3341f;
    --fatto: #2f5d4a;

    --serif: "Spectral", Georgia, "Times New Roman", serif;
    --display: "Instrument Serif", Georgia, serif;
    --mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --carta: #0a1626;
      --carta-alta: #101f34;
      --inchiostro: #e6ded0;
      --inchiostro-2: #93a7c2;
      --riga: #23374f;
      --traccia: #55677f;
      --misura: #e8735c;
      --fatto: #7fbfa2;
    }
  }
  :root[data-theme="dark"] {
    --carta: #0a1626;
    --carta-alta: #101f34;
    --inchiostro: #e6ded0;
    --inchiostro-2: #93a7c2;
    --riga: #23374f;
    --traccia: #55677f;
    --misura: #e8735c;
    --fatto: #7fbfa2;
  }

  * { box-sizing: border-box; }
  body {
    background: var(--carta);
    color: var(--inchiostro);
    font-family: var(--serif);
    font-weight: 300;
    font-size: 17px;
    line-height: 1.62;
    margin: 0;
    padding: 0 24px 96px;
  }
  .foglio { max-width: 980px; margin: 0 auto; }
  p, li { max-width: 66ch; }

  header.testa {
    padding: 56px 0 28px;
    border-bottom: 1px solid var(--riga);
    display: grid;
    gap: 18px;
  }
  .occhiello {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--inchiostro-2);
  }
  h1 {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(40px, 7vw, 68px);
    line-height: 1.02;
    letter-spacing: -0.01em;
    margin: 0;
    text-wrap: balance;
  }
  h1 em { font-style: italic; }
  .sottotitolo { color: var(--inchiostro-2); margin: 0; }

  /* I fatti fissi del pezzo: non sono "big number tile" decorative, sono le costanti che ogni
     misura della pagina usa — la scala del disegno e la rete di sicurezza. */
  .fatti {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border-top: 1px solid var(--riga);
    margin-top: 6px;
  }
  .fatto {
    flex: 1 1 150px;
    padding: 14px 18px 12px 0;
  }
  .fatto dt {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--inchiostro-2);
    margin: 0 0 3px;
  }
  .fatto dd {
    margin: 0;
    font-family: var(--mono);
    font-size: 19px;
    font-variant-numeric: tabular-nums;
  }

  section.passo {
    display: grid;
    grid-template-columns: 74px 1fr;
    gap: 0 26px;
    padding: 46px 0;
    border-bottom: 1px solid var(--riga);
  }
  @media (max-width: 640px) { section.passo { grid-template-columns: 1fr; gap: 10px; } }
  .numero {
    font-family: var(--display);
    font-size: 46px;
    line-height: 1;
    color: var(--inchiostro-2);
    font-variant-numeric: lining-nums;
  }
  .corpo > *:first-child { margin-top: 0; }
  h2 {
    font-family: var(--display);
    font-weight: 400;
    font-size: 30px;
    line-height: 1.14;
    margin: 0 0 4px;
    text-wrap: balance;
  }
  h3 {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--inchiostro-2);
    margin: 34px 0 10px;
    font-weight: 500;
  }
  .stato {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 8px;
    border: 1px solid currentColor;
    margin-bottom: 12px;
  }
  .stato.si { color: var(--fatto); }
  .stato.no { color: var(--inchiostro-2); }

  figure { margin: 22px 0 0; }
  .lastra {
    background: var(--carta-alta);
    border: 1px solid var(--riga);
    padding: 16px;
    overflow: auto;
  }
  /* La striscia dei tre riempimenti è alta il triplo di quanto è larga: a larghezza piena
     occuperebbe mezza pagina da sola, quindi scorre dentro il suo riquadro. */
  .lastra.striscia { max-height: 660px; }
  .lastra svg { display: block; width: 100%; height: auto; }
  figcaption {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--inchiostro-2);
    margin-top: 8px;
    max-width: 66ch;
  }

  .tabella { overflow-x: auto; margin: 18px 0 0; }
  table { border-collapse: collapse; font-family: var(--mono); font-size: 13px; width: 100%; }
  th, td { text-align: right; padding: 7px 12px 7px 0; border-bottom: 1px solid var(--riga); white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  thead th {
    font-weight: 500;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--inchiostro-2);
  }
  td { font-variant-numeric: tabular-nums; }
  tr.chiave td { color: var(--misura); }
  .nota { font-size: 15px; color: var(--inchiostro-2); }
  code { font-family: var(--mono); font-size: 0.9em; }
  strong { font-weight: 600; }
  .manca { font-family: var(--mono); font-size: 13px; color: var(--misura); }

  footer {
    padding: 40px 0 0;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--inchiostro-2);
  }
</style>

<div class="foglio">

<header class="testa">
  <p class="occhiello">RG Tools · nono strumento · banco di prova</p>
  <h1>Punto <em>Pittorico</em></h1>
  <p class="sottotitolo">Da un'immagine, riempimenti pieni che seguono le curve del disegno. Questa pagina
  mostra i pezzi già in piedi, ognuno con la misura che dice se regge. Si rigenera dagli script: quello
  che vedi è quello che il codice produce oggi, non un disegno fatto per l'occasione.</p>
  <dl class="fatti">
    <div class="fatto"><dt>Il disegno</dt><dd>419,45 × 353,1 mm</dd></div>
    <div class="fatto"><dt>Un pixel vale</dt><dd>0,353 mm</dd></div>
    <div class="fatto"><dt>Passo del filo</dt><dd>0,4 mm</dd></div>
    <div class="fatto"><dt>Rete di sicurezza</dt><dd>591 controlli</dd></div>
  </dl>
</header>

<section class="passo">
  <div class="numero">1</div>
  <div class="corpo">
    <span class="stato si">fatto e misurato</span>
    <h2>Il filo segue la curva senza aprire né ingrossare</h2>
    <p>Con l'angolo fisso, la distanza fra due file di filo è costante perché la griglia la impone.
    Appena il punto ruota, quella garanzia sparisce: sul lato esterno della curva le file si allontanano
    e si vede il tessuto, su quello interno si stringono e il ricamo ingrossa. Qui le file
    <strong>nascono e muoiono da sole</strong> dove il ventaglio si apre e si chiude, e la distanza
    resta quella chiesta.</p>

    <figure>
      <div class="lastra striscia">${svgInline('banda-curva-con-foro.svg')}</div>
      <figcaption>La stessa forma riempita tre volte. In alto il raso dritto, che è il metro di
      paragone. In mezzo il modo ingenuo — si seminano le file e si lasciano correre — dove il filo si
      accavalla e lascia buchi. In basso il metodo vero.</figcaption>
    </figure>

    <h3>Quanto varia la copertura, cella per cella</h3>
    <div class="tabella">
      <table>
        <thead><tr><th>forma</th><th>raso dritto</th><th>curvo ingenuo</th><th>curvo, distanza costante</th></tr></thead>
        <tbody>
          <tr><td>banda che curva</td><td>5,1%</td><td>79,1%</td><td>10,3%</td></tr>
          <tr><td>banda con un vuoto</td><td>5,0%</td><td>98,5%</td><td>9,7%</td></tr>
          <tr><td>ventaglio che si apre 3,9 volte</td><td>3,9%</td><td>71,0%</td><td>14,3%</td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">Il raso dritto non è "il migliore": è lo zero dello strumento, perché lì il passo è
    costante per costruzione. Quel 4–5% è il rumore della misura. Il metodo vale un fattore 5–20
    contro il modo ingenuo, e resta sotto il 16% dichiarato.</p>

    <h3>Due cose imparate strada facendo</h3>
    <p>La distanza che si chiede <strong>non è quella che esce</strong>: coi numeri di partenza della
    letteratura il riempimento consegnava il 6% di filo in più di quello richiesto, sempre, su tutte le
    forme. Corretto, ora consegna quello che chiedi entro l'1%.</p>
    <p>E il punto-ago è una <strong>corda</strong>: su una curva taglia dentro, e con punti da 3 mm si
    posava sulla fila vicina — due punti nello stesso buco. Ora la corda ha un tetto, e la distanza
    minima fra file è tornata al 41% del passo invece dell'1%.</p>
  </div>
</section>

<section class="passo">
  <div class="numero">2</div>
  <div class="corpo">
    <span class="stato si">fatto e misurato</span>
    <h2>Un cerchio del disegno torna un cerchio, non una scalinata</h2>
    <p>Il contorno letto dai pixel è una scalinata. Sul tuo disegno <strong>un pixel vale 0,353 mm</strong>,
    cioè quasi il passo fra due file di filo: la scalinata è larga come un filo, e sul ricamo si
    vedrebbe. Riconoscere la forma — dire «questo è un cerchio di raggio tale» invece di smussare i
    gradini — porta lo scostamento da un filo a un ventesimo di filo.</p>

    <h3>Provato contro cerchi di raggio noto, non a occhio</h3>
    <div class="tabella">
      <table>
        <thead><tr><th>raggio vero</th><th>errore sul raggio</th><th>la scalinata sbaglia di</th><th>la forma riconosciuta sbaglia di</th></tr></thead>
        <tbody>
          <tr><td>6,0 mm</td><td>0,049 mm</td><td>0,343 mm</td><td>0,049 mm</td></tr>
          <tr><td>15,0 mm</td><td>0,010 mm</td><td>0,305 mm</td><td>0,010 mm</td></tr>
          <tr><td>30,0 mm</td><td>0,021 mm</td><td>0,318 mm</td><td>0,021 mm</td></tr>
          <tr class="chiave"><td>12,0 mm (fitto)</td><td>0,0006 mm</td><td>0,067 mm</td><td>0,0006 mm</td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">Il cerchio non viene da una foto: lo disegna il test, quindi il raggio vero si conosce
    e l'errore si misura invece di stimarlo. La tolleranza ha un pavimento e non è un'opinione: vale
    almeno un pixel, perché la scalinata stessa è larga 0,6 pixel e sotto quella misura non ci passa
    nessun cerchio.</p>
  </div>
</section>

<section class="passo">
  <div class="numero">3</div>
  <div class="corpo">
    <span class="stato si">fatto e misurato</span>
    <h2>La sfera esce dalla tua cianotipia, senza nessun vettore</h2>
    <p>Non c'è un SVG dietro quel disegno e non ci sarà: il cerchio o si ricava dai pixel o non si
    ricava. Difficoltà in più: la sfera <strong>non è una macchia di colore</strong>, è dello stesso blu
    del fondo e ci si attacca dove l'alone chiaro si interrompe. Quindi il suo bordo è solo un pezzo di
    un contorno più grande, spezzato in più tratti.</p>
    <p>La prova che il cerchio c'è davvero non è che uno dei tratti ci somiglia: è che
    <strong>quattro tratti indipendenti dicono lo stesso cerchio</strong>.</p>

    <figure>
      <div class="lastra">${svgInline('cianotipia-contorni.svg')}</div>
      <figcaption>In nero i contorni letti dai pixel. In rosso il cerchio ricavato da soli quattro archi
      del contorno: raggio 77,0 mm, diametro 154. Guarda anche le fasce ondulate — un lato è una linea
      netta, l'altro una nuvola di puntini: quella nuvola è la sfumatura, e la sua larghezza è già la
      misura del degradé che serviva più avanti.</figcaption>
    </figure>

    <h3>Prima però va tolta la grana della stampa</h3>
    <div class="tabella">
      <table>
        <thead><tr><th>come si legge l'immagine</th><th>buchi falsi</th><th>pezzi riconosciuti</th><th>la sfera</th></tr></thead>
        <tbody>
          <tr><td>soglia secca, nessuna pulizia</td><td>699</td><td>1.267</td><td>57% del giro</td></tr>
          <tr><td>pulizia grossolana, 3 passate</td><td>22</td><td>430</td><td>67%</td></tr>
          <tr><td>riduzione vera, 2 tinte</td><td>10</td><td>408</td><td>61%</td></tr>
          <tr class="chiave"><td>riduzione vera, 4 tinte</td><td>9</td><td>817</td><td>71,5%</td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">699 buchi in una campitura uniforme non sono buchi: sono i puntini della stampa. Con
    quattro tinte la sfera esce meglio che con due, e non è un caso — gli archi dentro la sfera sono veri
    gradini di tono, e schiacciare tutto a due colori li butta via.</p>
    <p class="nota"><strong>Quanto è preciso il raggio, oggi: 76–77 mm, circa l'1%.</strong> Lo scarto non
    viene dal calcolo del cerchio, viene da come si sceglie di ridurre l'immagine.</p>
  </div>
</section>

<section class="passo">
  <div class="numero">4</div>
  <div class="corpo">
    <span class="stato si">fatto e misurato</span>
    <h2>In che verso corre il punto, guardato prima di cucire</h2>
    <p>Il campo di direzione decide l'orientamento del punto in ogni millimetro del disegno: si fissa
    sul bordo e si risolve verso l'interno cercando il verso più liscio possibile. Qui sotto è il tuo
    disegno con le linee di flusso disegnate sopra: è quello che l'ago farebbe, guardato prima che
    tocchi il tessuto.</p>
    <p><strong>Sul bordo il punto si posa perpendicolare, non parallelo</strong> — attraversa il
    passaggio di colore come i denti di un pettine, a ventaglio lungo la curva. È la resa delle
    fotografie di ricamo pittorico, ed è quella che fa la frangia: sono i capi delle file, non una
    texture, a costruire il degradé. La prima versione aveva il punto tangente al contorno, quindi il
    filo correva <em>lungo</em> la fascia invece che attraverso: sbagliato, e corretto.</p>

    <figure>
      <div class="lastra">${svgInline('cianotipia-campo.svg')}</div>
      <figcaption>Tutte e 27 le zone sopra i 400 mm², coi colori veri della riduzione a quattro tinte.
      Una linea ogni 4 mm: è un'anteprima, il ricamo vero ne ha una ogni 0,4. Le linee non vengono da un
      disegnatore a parte — sono lo stesso riempimento del punto 1 chiesto a passo largo, altrimenti
      l'anteprima mostrerebbe una cosa e l'ago ne cucirebbe un'altra.</figcaption>
    </figure>

    <h3>Quanto gira il punto, per millimetro</h3>
    <p>Un campo che sfarfalla dà punti che si combattono, tirano il tessuto in direzioni diverse e si
    vedono. Ma il riferimento non è zero: un ricamo che segue una curva <em>deve</em> girare — su un
    cerchio di raggio R esattamente 57,3/R gradi al millimetro. Quello che non deve esserci è la
    rotazione grande su tratto corto.</p>
    <div class="tabella">
      <table>
        <thead><tr><th>com'è il contorno</th><th>punti</th><th>gira (metà dei casi)</th><th>nel 5% peggiore</th><th>scarto dalla perpendicolare</th></tr></thead>
        <tbody>
          <tr><td>scalinata, come letta dai pixel</td><td>2.420</td><td>2,28 °/mm</td><td>21,1</td><td>38,3°</td></tr>
          <tr><td>semplificata</td><td>991</td><td>2,26 °/mm</td><td>19,3</td><td>23,7°</td></tr>
          <tr class="chiave"><td>con le forme riconosciute</td><td>554</td><td>2,02 °/mm</td><td>16,8</td><td>14,9°</td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">È la prova che il lavoro sulle forme nette serviva a qualcosa di più del bordo: il
    campo <strong>nasce dalla direzione del contorno</strong>, e su una scalinata quella direzione salta
    di 90° a ogni gradino. Riconoscere le forme taglia lo sfarfallio di un quinto e lo scarto dalla
    perpendicolare di due terzi. Resta una coda del 5% che è lavoro da fare.</p>
  </div>
</section>

<section class="passo">
  <div class="numero">5</div>
  <div class="corpo">
    <span class="stato si">fatto e misurato</span>
    <h2>I bordi: il degradé dove il colore sfuma, il taglio secco dove stacca</h2>
    <p>Qui sotto, un ritaglio da 70 mm del tuo disegno cucito davvero: passo 0,4 mm, 10 metri di filo
    su 49 cm². I punti <strong>attraversano</strong> il passaggio di colore e i loro capi
    <strong>si ritirano di quantità diverse e si intrecciano</strong> con quelli della tinta accanto —
    è il degradé fatto col frastaglio del bordo, come avevi detto tu, e non con una texture.</p>

    <figure>
      <div class="lastra">${svgInline('cianotipia-degrade.svg')}</div>
      <figcaption>La frangia non è lunga a caso e non è un numero fisso: è lunga quanto il passaggio
      di colore misurato in quel punto. Il parametro del pannello fa da tetto — si prende il più corto
      fra quello che concedi tu e quello che chiede l'immagine.</figcaption>
    </figure>

    <h3>Come fa il programma a sapere dove sfuma</h3>
    <p>Cammina di traverso al bordo e guarda quanti millimetri servono perché la luce passi da una
    tinta all'altra. Sulla tua cianotipia le due popolazioni si separano da sole:</p>
    <div class="tabella">
      <table>
        <thead><tr><th>fra quali tinte</th><th>campioni</th><th>quanto è largo il passaggio</th><th>in fili da 0,4 mm</th><th>che bordo è</th></tr></thead>
        <tbody>
          <tr><td>1 e 2 (toni vicini)</td><td>1.333</td><td>9,47 mm</td><td>24</td><td>sfumato</td></tr>
          <tr><td>2 e 3 (toni vicini)</td><td>1.390</td><td>9,12 mm</td><td>23</td><td>sfumato</td></tr>
          <tr><td>0 e 1 (toni vicini)</td><td>1.346</td><td>7,37 mm</td><td>18</td><td>sfumato</td></tr>
          <tr class="chiave"><td>0 e 3 (scuro contro chiaro)</td><td>786</td><td>0,70 mm</td><td>2</td><td>secco</td></tr>
          <tr class="chiave"><td>1 e 3 (toni lontani)</td><td>120</td><td>0,70 mm</td><td>2</td><td>secco</td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">Con soglia 1,5 mm: <strong>18% dei bordi è secco, 82% sfumato</strong> — ed è il
    taglio verticale della sfera contro le fasce luminose. La percentuale non cambia alzando la soglia
    fino a 4 mm, cioè le due famiglie sono davvero separate e la soglia non è un numero delicato.</p>

    <h3>La sovrapposizione di 5 mm</h3>
    <p>Prima di riempire, ogni zona si ingrandisce di 5 mm <em>verso i colori che verranno cuciti dopo
    di lei</em>, e resta al proprio bordo verso quelli già fatti. Chi sta sotto è abbondante, chi va
    sopra ci si appoggia: niente buchi alle giunte. Verificato sul tuo disegno — nessuna tinta cresce
    all'indietro, nemmeno di un pixel, e l'ultima non cresce affatto.</p>

    <h3>Due decisioni che aspettano te</h3>
    <p class="nota">Quante tinte per la cianotipia: quattro danno una sfera migliore di due, ma è una
    scelta di resa e va guardata sul ricamo. E il ventaglio mostra <strong>anelli concentrici</strong>
    dove tutte le file nascono allo stesso raggio: i numeri li vedono appena, l'occhio sì. Il rimedio
    ovvio l'ho provato e peggiora — quindi resta lì, spento, finché non lo guardi tu.</p>
  </div>
</section>

<section class="passo">
  <div class="numero">6</div>
  <div class="corpo">
    <span class="stato no">il prossimo</span>
    <h2>Metterlo insieme: la pipeline, l'export, il pannello</h2>
    <p>I cinque pezzi ci sono tutti e ognuno ha la sua misura. Resta da montarli in un tool vero:
    l'ordine dei colori, i passaggi nascosti fra una macchia e l'altra, l'export in SVG e in DST
    riapribili, e il pannello dentro la suite — così invece di lanciare quattro script carichi
    l'immagine, giri le manopole e premi Genera.</p>
  </div>
</section>

<footer>
  <p>Generato da <code>apps/pittorico/scripts/banco.ts</code> · le misure vengono da
  <code>misura.mjs</code> e <code>immagine.mjs</code> · rete di sicurezza <code>npm test</code></p>
</footer>

</div>
`;

const uscita = `${dir}banco.html`;
writeFileSync(uscita, pagina);
console.log(`banco → ${uscita}  (${(pagina.length / 1024).toFixed(0)} kB)`);

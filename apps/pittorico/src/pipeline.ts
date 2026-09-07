// LA CATENA — da un'immagine ai punti da cucire, in un pezzo solo e senza DOM.
//
// Qui non c'è algoritmo nuovo: c'è l'ordine in cui i pezzi già provati si chiamano, ed è quello
// l'oggetto di questo file. L'ordine non è arbitrario, ogni passo dipende da una cosa misurata nel
// precedente:
//
//   1. **riduzione** (`reduce`, core) — senza, il contorno è la grana della stampa e non la forma:
//      misurato sulla cianotipia, 699 fori falsi in una campitura uniforme;
//   2. **regioni** (`traceRegions`, core) — dalla mappa dei colori ai poligoni coi loro fori;
//   3. **larghezza dei passaggi** (`borders`) — quali bordi sfumano e quali staccano. Si misura
//      sull'immagine ORIGINALE, perché dopo la riduzione la sfumatura non esiste più;
//   4. **crescita** — 5 mm dove sfuma, 1,5 dove stacca, e solo verso i colori che verranno dopo;
//   5. **campo di direzione** (`field`) — perpendicolare sui bordi di colore, libero sulle testate;
//   6. **riempimento dalla rotaia** (`rail-fill`) — l'ordine viene da lì, coi cunei dove la fascia
//      si allarga; sulle forme che non sono fasce si torna al riempimento a distanza costante;
//   7. **frastaglio** (`borders`) — solo dove sfuma, e solo dentro il margine cresciuto.
//
// Quello che NON c'è ancora, e va detto: il **punto minimo** (R3), che per regola si impone dopo il
// routing, e i **passaggi** fra una macchia e l'altra (R16/R26). Sono il pezzo successivo.

import {
  type PixelImage, type Polyline, type Point, type Region, type ExportLayer, type Rgb,
  reduceStable, prepareImage, traceRegions, rgbToHex,
} from '@rg/core';
import { lisciaRegione } from './region';
import { serpentina } from './serpentina';
import { buildIsoFill } from './iso-fill';
import { buildBandFill } from './band-fill';
import { harmonicField, type CondizioneAlBordo } from './field';
import { buildRailFill } from './rail-fill';
import { buildCurvedFill } from './curved-fill';
import { larghezzaTransizione, cresciVersoISuccessivi, frastaglia } from './borders';
// I passaggi NON si riscrivono: sono R16-R21 e R26, e vivono nel core da quando `routing` è stato
// promosso da broccato. Mappa di copertura, catena minima fra le macchie, e i tre casi in ordine —
// dritto, nascosto con l'A*, staccato solo se non c'è strada.
import {
  buildCoverGrid, routeColorRuns, enforceMinStitch, resampleUniform, distance, type RegionRuns,
} from '@rg/core';

/**
 * L'ORDINE DELLE CORSE dentro una macchia.
 *
 * `routeColorRuns` mette in fila le MACCHIE a catena minima, ma dentro una macchia cuce le corse
 * nell'ordine in cui gliele si passa: è il patto giusto, perché quell'ordine lo sa solo chi ha
 * generato il riempimento. Dalla rotaia le corse escono già in fila — è il senso di quel motore —
 * ma il riempimento a distanza costante le semina dove servono alla distanza, non in sequenza, e
 * consegnate così fanno pagare un passaggio lungo a ogni corsa.
 *
 * Qui si mettono in fila e basta: dal capo dov'è finito il filo all'estremo più vicino che resta,
 * girando la corsa se conviene entrarci dall'altra parte. Non si cuce niente — quello è mestiere di
 * `routeColorRuns` — si decide solo la sequenza, così i tratti che dovrà coprire sono i più corti.
 */
/** Quanto filo di collegamento chiede una sequenza di corse, capo dopo capo. */
function costoDellOrdine(runs: Polyline[]): number {
  let mm = 0;
  for (let i = 1; i < runs.length; i++) {
    mm += distance(runs[i - 1][runs[i - 1].length - 1], runs[i][0]);
  }
  return mm;
}

function inFila(runs: Polyline[]): Polyline[] {
  if (runs.length < 2) return [...runs];
  const restano = runs.map((r, i) => ({ r, i }));
  const out: Polyline[] = [restano.shift()!.r];
  while (restano.length) {
    const coda = out[out.length - 1][out[out.length - 1].length - 1];
    let best = 0, bestD = Infinity, gira = false;
    for (let k = 0; k < restano.length; k++) {
      const r = restano[k].r;
      const dA = distance(coda, r[0]), dB = distance(coda, r[r.length - 1]);
      if (dA < bestD) { bestD = dA; best = k; gira = false; }
      if (dB < bestD) { bestD = dB; best = k; gira = true; }
    }
    const scelta = restano.splice(best, 1)[0].r;
    out.push(gira ? [...scelta].reverse() : scelta);
  }
  return out;
}

/**
 * IL GIRO IN FONDO ALLA CORSA — dove nasceva la linea di contorno sul degrade'.
 *
 * Il riempimento e' un pettine: corse perpendicolari al bordo, e la frangia si fa **accorciandole**
 * di quantita' diverse, cosi' le punte fanno i denti. Il problema e' cosa succede fra un dente e il
 * successivo. Se il filo va dritto dalla punta di una corsa alla punta della prossima, quella corda
 * **attraversa la valle fra i due denti** — e la riempie. Fatto migliaia di volte lungo tutto il
 * bordo, il risultato non e' una sfumatura: e' una linea di contorno. E' esattamente quello che
 * Lorenzo ha visto, e sul blu si vede di piu' perche' quell'ago ha poco colore sopra a coprirlo.
 *
 * La cura e' quella del ricamo vero: invece della corda, si **ritorna sui propri passi**. Dalla
 * punta si rientra lungo la corsa appena cucita fino all'altezza dove la prossima comincia, e da li'
 * si passa. Il filo si raddoppia per un tratto, ma si raddoppia **sopra se stesso**, dello stesso
 * colore: non si vede. La valle fra i denti resta vuota, che e' il suo mestiere.
 *
 * Il prezzo e' filo in piu', limitato dalla profondita' della frangia; il ritorno e' che il
 * degrade' resta un degrade'.
 */
function giroSullaFrangia(runs: Polyline[], soglia: number): Polyline[] {
  if (runs.length < 2) return runs;
  const out: Polyline[] = [];
  for (let i = 0; i < runs.length; i++) {
    const corsa = runs[i];
    const prossima = runs[i + 1];
    if (!prossima || corsa.length < 2) { out.push(corsa); continue; }
    const meta = prossima[0];
    // il punto della corsa piu' vicino all'inizio della prossima: e' li' che il giro costa meno
    let vicino = corsa.length - 1, minD = distance(corsa[corsa.length - 1], meta);
    for (let k = corsa.length - 2; k >= 0; k--) {
      const d = distance(corsa[k], meta);
      if (d < minD) { minD = d; vicino = k; }
    }
    // se il capo e' gia' il punto piu' vicino, il giro e' quello normale del pettine: non si tocca
    if (vicino === corsa.length - 1
        || distance(corsa[corsa.length - 1], meta) - minD < soglia) { out.push(corsa); continue; }
    out.push([...corsa, ...corsa.slice(vicino, corsa.length - 1).reverse()]);
  }
  return out;
}

/**
 * R3 e R4 insieme, nell'ordine giusto — stesso passo 8 del broccato.
 *
 * `enforceMinStitch` tiene SEMPRE gli estremi, quindi non puo' togliere una coda corta in fondo: la
 * si toglie arretrando il PENULTIMO punto, mai l'ultimo. Poi si rimette il tetto (R4), perche'
 * togliere un punto in mezzo unisce due tratti e puo' allungare il punto oltre il massimo;
 * `resampleUniform` **suddivide soltanto** (R4), quindi non sposta un millimetro di geometria.
 */
function minEMax(pl: Polyline, minMm: number, maxMm: number): Polyline {
  const out = enforceMinStitch(pl, minMm);
  while (out.length >= 3 && distance(out[out.length - 1], out[out.length - 2]) < minMm) {
    out.splice(out.length - 2, 1);
  }
  while (out.length >= 2 && distance(out[out.length - 1], out[out.length - 2]) < 1e-9) out.pop();
  return maxMm > 0 ? resampleUniform(out, maxMm) : out;
}

export interface PittoricoParams {
  /** Quante tinte: ogni tinta è un ago. */
  colorCount: number;
  /** Passo fra due file di filo (R22). Scelto da Lorenzo sui provini: 0,3. */
  densitySpacingMm: number;
  /** Lunghezza massima del punto (R4). */
  maxStitchMm: number;
  /** Quanto sporgono le frange dove il colore sfuma. Scelto sui provini: 5. */
  frangiaMm: number;
  /** Quanto il colore sotto sborda sotto quello sopra dove il colore SFUMA. */
  crescitaMm: number;
  /** ...e dove il colore STACCA NETTO: il bordo resta preciso, ma senza far vedere la tela. */
  sormontoMm: number;
  /** Sopra questa larghezza il passaggio è considerato una sfumatura. */
  sogliaSfumaturaMm: number;
  /** Raggio del pareggio della luce, in mm (0 = spento). */
  flattenLightMm: number;
  /** Raggio dell'attenuazione della grana, in mm. */
  smoothMm: number;
  /** Area minima di una macchia perché valga la pena cucirla, in mm². */
  minAreaMm2: number;
  /**
   * Raggio della LISCIATURA DEL CONTORNO, in mm: quanto grande e' il dettaglio del bordo che
   * sparisce. Zero lascia la scalinata dei pixel com'e'.
   *
   * Chiesto da Lorenzo guardando le macchie: «i bordi sono davvero frastagliati e questo crea un
   * sacco di caos al ricamo; possiamo appiattire le frastaglie e vedere come si muove il ricamo con
   * bordi precisi?». Non e' una rifinitura estetica — il gradino di un pixel e' gia' costato due
   * volte, al routing (la corda taglia lo scalino e risulta «fuori») e al campo di direzione (la
   * perpendicolare del gradino non e' quella del bordo, e il raso ruota dove il disegno non ruota).
   */
  lisciaBordiMm: number;
  /** Larghezza reale del disegno in mm (R11): è la fonte di verità. */
  realWidthMm: number;
  /** Punto minimo (R3): si impone DOPO il routing, mai prima. */
  minStitchMm: number;
  /** Passo dei punti di passaggio (§3.1 `travelStitchMm`). */
  travelStitchMm: number;
  /**
   * Oltre questo tratto SCOPERTO il filo si stacca (R16, fallback graduato). Tenuto alto apposta:
   * il giro sul contorno si paga, il taglio del filo no — ed è la regola che Lorenzo ha ribadito
   * («solo l'ultimo livello, se non c'è soluzione, mettiamo rasafilo»).
   */
  maxVisibleTravelMm: number;
  /**
   * Lo stesso, ma per l'ULTIMO ago: sopra di lui non c'è niente, quindi ogni passaggio si vede.
   * Tenuto sotto la soglia del rasafilo della macchina (5-10 mm): il tratto corto lo si cuce, il
   * resto si taglia. È l'unico livello dove il taglio è la risposta giusta.
   */
  maxVisibleTravelUltimoMm: number;
  /**
   * Quanto puo' essere lungo il tratto SCOPERTO di un passaggio che taglia dentro la macchia.
   * Oltre, si stacca il filo: un filo teso per venti centimetri attraverso il disegno costa piu' di
   * un rasafilo.
   */
  maxInternalTravelMm: number;
  /**
   * Cucire ogni macchia con un filo solo, in serpentina, invece di lasciare le corse sciolte al
   * routing. E' il raso come lo cuce un ricamatore: si arriva in fondo, si gira, si torna accanto.
   */
  riempimentoContinuo: boolean;
  /**
   * Come si riempie.
   *
   * `'tracciato'` (default) — rotaia o distanza costante: si tracciano le corse seguendo il campo,
   * e la distanza si aggiusta con cunei e troncature.
   *
   * `'iso'` — curve di livello di una distanza anisotropa. **Misurato e non promosso**: sul disegno
   * vero toglie il troppo pieno (celle sopra il 150% dal 24 al 14%) ma apre i buchi (mediana dal 104
   * all'88-92% del chiesto, p5 da 2,25 a 1,17), e un buco e' peggio di un addensamento. Il perche' e'
   * scritto in testa a `iso-fill.ts`, ed e' un limite geometrico, non un difetto da sistemare.
   */
  metodoRiempimento: 'fasce' | 'iso' | 'tracciato';
  /**
   * Solo per `'fasce'`: la deriva massima ammessa dentro una fascia, |ln(spaziatura finale /
   * iniziale)|. E' l'unico numero che decide quante fasce servono: la spaziatura resta entro
   * e^(±deriva) per costruzione.
   */
  derivaMassima: number;
  /** Solo per `'fasce'`: ogni quanti mm di cammino si risemina il fronte a spaziatura esatta. */
  fasciaMm: number;
  /**
   * Dove passa il filo di collegamento quando non puo' andare dritto: `'interno'` taglia dentro il
   * riempimento, `'contorno'` costeggia il bordo. Qui il bordo e' la frangia, quindi il default e'
   * `'interno'` — vedi il commento al punto d'uso.
   */
  viaPassaggi: 'interno' | 'contorno';
  /** Quanto il passaggio deve stare lontano dal bordo. Zero = basta stare dentro. */
  margineDalBordoMm: number;
  /**
   * Cucire i passaggi, o lasciare le corse staccate. Serve a MISURARE: col profilo della frangia
   * si vuole sapere quanto della densita' sul bordo e' riempimento e quanto e' filo di passaggio,
   * e l'unico modo e' guardare le due cose separate. In produzione resta acceso.
   */
  cuciPassaggi: boolean;
}

export const defaultPittoricoParams: PittoricoParams = {
  colorCount: 4,
  densitySpacingMm: 0.3,
  maxStitchMm: 3,
  frangiaMm: 5,
  crescitaMm: 5,
  sormontoMm: 1.5,
  sogliaSfumaturaMm: 1.5,
  flattenLightMm: 40,
  smoothMm: 1.5,
  minAreaMm2: 400,
  // SPENTA di default, e non per prudenza: la misura non la giustifica (R30). Sul ritaglio vero il
  // contorno inverte la curvatura una volta ogni 9 mm — cioe' e' gia' liscio — e lisciarlo non
  // migliora quel numero, lo peggiora appena (0,11 -> 0,15 inversioni/mm) e raddoppia i vertici.
  // Aiuta un po' il routing (25 giri sul contorno -> 21), ma non abbastanza da accenderla da sola.
  // Resta la manopola per provare: e' cosi' che si e' scoperto che il frastaglio non e' li'.
  lisciaBordiMm: 0,
  realWidthMm: 0,
  minStitchMm: 1,
  travelStitchMm: 2.5,
  maxVisibleTravelMm: 400,
  maxVisibleTravelUltimoMm: 5,
  /*
   * 50 mm, e il numero viene da una curva misurata sul disegno intero — un limite piu' stretto
   * toglie fili tesi ma li paga in rasafili, e la scelta e' un compromesso, non un ottimo (R30):
   *
   *   nessun limite   9 rasafili · 599 m di filo · il piu' lungo passaggio scoperto 241 mm
   *   50 mm          86 rasafili · 583 m
   *   25 mm         234 rasafili · 577 m
   *
   * Lorenzo il rasafilo lo vuole evitare — «solo l'ultimo livello, se non c'e' soluzione» — ma un
   * filo teso per venti centimetri attraverso il disegno e' peggio di una ripresa. 50 mm sta dalla
   * parte della sua preferenza senza lasciare passare i mostri.
   */
  maxInternalTravelMm: 50,
  riempimentoContinuo: true,
  /*
   * A FRONTI, e non piu' tracciato: misurato sul ritaglio senza sovrapposizioni fra colori, cioe'
   * sul solo riempimento, le celle sopra il 150% del chiesto scendono dal 10% al 2% e la
   * dispersione p95/p5 da 2,5× a 2,0×; ago per ago da 2,6-3,1× a 1,7-2,2×. Con le
   * sovrapposizioni accese il 98% di quello che resta sopra il 150% sta entro 3 mm da un bordo:
   * e' la crescita di un colore sotto l'altro, che e' voluta, non un difetto del riempimento.
   */
  metodoRiempimento: 'fasce',
  derivaMassima: 0.2,
  /*
   * 15 mm, e non per la densita' — che fra 2 e 15 mm non cambia (2% di celle sopra il 150% a
   * qualunque Δ: la convergenza la ferma il territorio vergine, la divergenza la cura la
   * risemina) — ma per la RESA: a 3 mm il riempimento era una maculatura di tratti corti che
   * partivano ognuno con un angolo un po' diverso, a 15 e' un raso con la grana continua. Si e'
   * visto, non misurato.
   */
  fasciaMm: 15,
  viaPassaggi: 'interno',
  margineDalBordoMm: 2,
  cuciPassaggi: true,
};

export interface MacchiaCucita {
  tinta: number;
  region: Region;
  corse: Polyline[];
  /** Come è stata riempita: dalla rotaia (ordinata) o a distanza costante (forma senza fianchi). */
  metodo: 'fasce' | 'iso' | 'rotaia' | 'distanza';
}

export interface PittoricoPlan {
  palette: Rgb[];
  /** L'ordine di cucitura: dalla tinta più scura alla più chiara. Ogni tinta è un ago. */
  ordine: number[];
  macchie: MacchiaCucita[];
  mmPerPx: number;
  larghezzaMm: number;
  altezzaMm: number;
  /** Quanti campioni di bordo sono risultati sfumati, e quanti in tutto. */
  bordiSfumati: number;
  bordiTotali: number;
  filoMm: number;
  punti: number;
  /** Quanti salti restano dopo aver cucito i passaggi, e quanto sono lunghi in tutto. */
  salti: number;
  saltoMm: number;
  saltoMassimoMm: number;
  /** Come sono andati i passaggi, ago per ago: è la misura che dice se il routing sta reggendo. */
  passaggiPerAgo: PassaggiAgo[];
  /**
   * La mappa dei colori: per ogni pixel, la tinta che gli è toccata (`NO_COLOR` se nessuna). È
   * quello che l'anteprima «Colori» disegna — come il sistema divide l'immagine prima di cucirla.
   */
  indice: Uint8Array;
  larghezzaPx: number;
  altezzaPx: number;
}

/** Il conto dei passaggi di un ago (R16): quanto filo si spende per andare, e quanto se ne vede. */
export interface PassaggiAgo {
  tinta: number;
  corse: number;
  riempimentoMm: number;
  passaggiMm: number;
  /** Di quei passaggi, quanto corre sotto un colore che verrà: quello non si vede. */
  passaggiCopertiMm: number;
  /** Quante volte il filo si è dovuto staccare: sull'ultimo ago è un rasafilo vero. */
  stacchi: number;
  /** Quale dei tre casi ha pagato quei millimetri: dritto, dentro il riempimento, sul contorno. */
  perCaso: { dritto: { volte: number; mm: number }; interno: { volte: number; mm: number }; contorno: { volte: number; mm: number } };
  /** Il filo di collegamento, disegnabile: serve all'anteprima «Passaggi». */
  vie: Polyline[];
}

const luce = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * Dall'immagine al piano di cucitura.
 *
 * `mmPerPx` esce da `realWidthMm` (R11): se non è dato si usa la larghezza dichiarata dal file, che
 * è una stima e non una misura — il chiamante deve saperlo e offrire l'override.
 */
export function buildPittoricoPlan(img: PixelImage, p: PittoricoParams): PittoricoPlan {
  const larghezzaMm = p.realWidthMm > 0 ? p.realWidthMm : img.width;
  const mmPerPx = larghezzaMm / img.width;


  // 1. le tinte, stabili
  const res = reduceStable(img, {
    colorCount: p.colorCount, flattenLightMm: p.flattenLightMm, smoothMm: p.smoothMm,
    minBlobMm2: Math.max(1, p.minAreaMm2 / 40), mmPerPx,
  });
  const ordine = res.palette.map((_, i) => i).sort((a, b) => luce(res.palette[a]) - luce(res.palette[b]));

  // 3. i passaggi: si misurano sull'immagine com'è, tolta solo la grana (vedi `borders`)
  const perMisurare = prepareImage(img, { flattenLightMm: 0, smoothMm: p.smoothMm, mmPerPx });
  const idx = res.index;
  const tintaIn = (x: number, y: number): number =>
    (x < 0 || y < 0 || x >= img.width || y >= img.height) ? -1 : idx[y * img.width + x];

  /** 1 dove il colore sfuma: è lì che si cresce di 5 mm e che si frastaglia. */
  const sfuma = new Uint8Array(img.width * img.height);
  let bordiSfumati = 0, bordiTotali = 0;
  {
    const raggio = Math.ceil(p.crescitaMm / mmPerPx) + 2;
    for (let t = 0; t < res.palette.length; t++) {
      for (const r of traceRegions(idx, img.width, img.height, t, mmPerPx, { simplifyMm: mmPerPx * 0.8, minAreaMm2: p.minAreaMm2 })) {
        for (const anello of [r.outer, ...r.holes]) {
          let percorsa = 0;
          for (let i = 0; i < anello.length; i++) {
            const a = anello[i], b = anello[(i + 1) % anello.length];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            percorsa += len;
            if (percorsa < 2 || len < 1e-9) continue;
            percorsa = 0;
            const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
            const px = q.x / mmPerPx, py = q.y / mmPerPx;
            const t1 = tintaIn(Math.round(px + n.x * 2.5), Math.round(py + n.y * 2.5));
            const t2 = tintaIn(Math.round(px - n.x * 2.5), Math.round(py - n.y * 2.5));
            const altra = t1 === t ? t2 : t1;
            if (altra < 0 || altra === t) continue;
            const tr = larghezzaTransizione(perMisurare, mmPerPx, q, n, { raggioMm: 10 });
            if (!tr) continue;
            bordiTotali++;
            if (tr.larghezzaMm <= p.sogliaSfumaturaMm) continue;
            bordiSfumati++;
            const cx = Math.round(px), cy = Math.round(py);
            for (let dy = -raggio; dy <= raggio; dy++) {
              const y = cy + dy;
              if (y < 0 || y >= img.height) continue;
              const mezzo = Math.floor(Math.sqrt(Math.max(0, raggio * raggio - dy * dy)));
              for (let dx = -mezzo; dx <= mezzo; dx++) {
                const x = cx + dx;
                if (x >= 0 && x < img.width) sfuma[y * img.width + x] = 1;
              }
            }
          }
        }
      }
    }
  }

  // 4-7. tinta per tinta, nell'ordine di cucitura
  const macchie: MacchiaCucita[] = [];
  for (const t of ordine) {
    const mio = ordine.indexOf(t);
    const cresciuta = cresciVersoISuccessivi(idx, img.width, img.height, t, ordine, mmPerPx, {
      crescitaMm: p.crescitaMm, sormontoMm: p.sormontoMm, sfuma,
    });
    /*
     * L'ORDINE CONTA, e mi e' costato una misura per capirlo: **prima si liscia, poi si semplifica**.
     *
     * `traceRegions` semplifica il contorno a un pixel e mezzo, e sembra poco. Ma sul ritaglio vero
     * quei 282 vertici su 1.400 mm di perimetro sono facce dritte da 5 mm che si incontrano a
     * cinquanta gradi l'una con l'altra: il contorno gira **10,35 gradi per millimetro**, dove una
     * curva vera da un centimetro di raggio ne farebbe 5,7. Non e' una scalinata di pixel — e' uno
     * zigzag grosso, e si vede a occhio: e' quello che Lorenzo chiama frastaglio.
     *
     * Lisciare DOPO non lo toglie (10,35 -> 8,67, misurato): a quel punto l'informazione e' gia'
     * stata buttata, e si arrotondano solo gli spigoli di un poligono che resta a facce. Quindi
     * quando la lisciatura e' accesa si chiede la tracciatura **cruda**, col contorno ancora a
     * gradini, e si lascia fare tutto a `lisciaRegione`: media che non restringe, e semplificazione
     * alla fine, quando i vertici sono davvero allineati.
     */
    const crudo = p.lisciaBordiMm > 0 ? mmPerPx * 0.2 : mmPerPx * 1.5;
    for (const region of traceRegions(cresciuta, img.width, img.height, 1, mmPerPx, {
      simplifyMm: crudo, minAreaMm2: p.minAreaMm2,
    }).map((r) => lisciaRegione(r, p.lisciaBordiMm, mmPerPx))) {
      /** Che tinta c'è appena fuori dal contorno, in questo punto. −1 = niente. */
      const fuori = (q: Point): number => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        /*
         * Un punto sul BORDO DELL'IMMAGINE non guarda nessun colore: li' il disegno finisce, non
         * cambia. Senza questa riga il bordo veniva scambiato per un confine di colore — guardando
         * lungo il bordo si trovava la tinta accanto — e diventava la rotaia: su tinta 0 del
         * ritaglio la rotaia era il lato x=90 per 33 mm, il campo li' e' libero, e le corse ci
         * correvano lungo e finivano subito (mediana 8 mm su una fascia da 87).
         */
        if (x <= 1 || y <= 1 || x >= img.width - 2 || y >= img.height - 2) return -1;
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as Array<[number, number]>) {
          const v = tintaIn(x + dx, y + dy);
          if (v >= 0 && v !== t) return v;
        }
        return -1;
      };
      // 5. il campo: perpendicolare dove il colore cambia, LIBERO sulle testate
      const campo = harmonicField(region, {
        cellMm: Math.max(0.8, mmPerPx * 3), levels: 4, sweeps: 220,
        condizioneA: (q): CondizioneAlBordo => (fuori(q) >= 0 ? 'perpendicolare' : 'libera'),
      });

      /*
       * 6. IL RIEMPIMENTO. Due motori, e il primo e' quello che si prova a far diventare l'unico.
       *
       * `iso` costruisce la distanza geodetica da una testata e prende le sue curve di livello: due
       * livelli consecutivi distano la spaziatura OVUNQUE, per definizione di curva di livello di
       * una distanza. E' l'unico dei tre che non puo' addensarsi ne' aprirsi — gli altri due
       * tracciano le corse e sperano che restino distanti, e la distanza la perdono dove il campo
       * converge o diverge.
       *
       * Serve una testata da cui partire. Dove non c'e' — una macchia chiusa da ogni lato di
       * colore — si torna ai motori di prima.
       */
      /*
       * Il seme: **un punto solo**, e sta al centro della macchia. Lungo il punto camminare non
       * costa niente, quindi il fronte si allunga da solo per tutta la corsa che passa di li' e poi
       * avanza di lato: da dove si parte cambia la numerazione dei livelli, non il ricamo.
       */
      const bbm = region.outer.reduce((a, q) => ({
        x0: Math.min(a.x0, q.x), y0: Math.min(a.y0, q.y),
        x1: Math.max(a.x1, q.x), y1: Math.max(a.y1, q.y),
      }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const seme = { x: (bbm.x0 + bbm.x1) / 2, y: (bbm.y0 + bbm.y1) / 2 };
      const daIso = p.metodoRiempimento === 'iso';
      const iso = daIso
        ? buildIsoFill(region, campo, seme, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
          costoLungoIlPunto: 0.05,
        })
        : null;

      // la rotaia: UN lato, quello che guarda il colore già cucito
      const prima = trattoVerso(region.outer, fuori, ordine, mio, 'prima');
      const dopo = trattoVerso(region.outer, fuori, ordine, mio, 'dopo');
      const rotaia = prima ?? dopo;
      const daRotaia = !!rotaia && rotaia.length < region.outer.length * 0.75;

      /*
       * A FASCE: la contraddizione fra direzione e distanza si spezza in pezzi in cui la deriva
       * L/R sta sotto soglia. Parte dalla rotaia e va verso il lato opposto; se un solo lato guarda
       * un altro colore, la fascia finisce dove finisce la macchia.
       */
      const fasce = p.metodoRiempimento === 'fasce' && daRotaia
        ? buildBandFill(region, campo, rotaia as Polyline, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
          derivaMassima: p.derivaMassima,
          fasciaMm: p.fasciaMm,
        })
        : null;
      if (fasce && process.env.RG_DIAGFASCE) {
        // eslint-disable-next-line no-console
        console.log(`  tinta ${t}: ${fasce.fasce} fasce da ${fasce.fasciaMm.toFixed(1)} mm · deriva `
          + `${fasce.derivaPerFascia.map((d) => d.toFixed(2)).join(' ')} · ${fasce.runs.length} corse, ${fasce.chiusure} di chiusura`);
      }

      const corse = fasce && fasce.runs.length ? fasce.runs : iso && iso.runs.length ? iso.runs : daRotaia
        ? buildRailFill(region, campo, rotaia as Polyline, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
          /*
           * 0,75 e non un valore a caso: e' l'unico della curva misurata dove si stringono TUTT'E
           * DUE le code. Sotto resta il troppo pieno, sopra si taglia cosi' tanto da riaprire i
           * vuoti — e una misura sola non lo avrebbe visto (R30).
           *
           *   0      p5 2,15 · mediana 105% · p95 9,17 · 26% delle celle troppo dense
           *   0,55   p5 2,14 · mediana 104% · p95 7,73 · 22%
           *   0,75   p5 2,00 · mediana  98% · p95 6,94 · 17%   <-
           *   0,90   p5 1,25 · mediana  91% · p95 6,02 · 13%, ma la coda BASSA si apre
           */
          troncaSotto: 0.75,
        }).runs
        : buildCurvedFill(region, campo, {
          spacingMm: p.densitySpacingMm, maxStitchMm: p.maxStitchMm,
        }).runs;

      // 7. il frastaglio: solo dove sfuma, e solo dentro il margine cresciuto
      const quiSfuma = (q: Point): boolean => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        return x >= 0 && y >= 0 && x < img.width && y < img.height && sfuma[y * img.width + x] === 1;
      };
      const corpo = (q: Point): boolean => {
        const x = Math.round(q.x / mmPerPx), y = Math.round(q.y / mmPerPx);
        return tintaIn(x, y) === t;
      };
      const frangiate = frastaglia(corse, quiSfuma, {
        frangiaMm: Math.min(p.frangiaMm, p.crescitaMm),   // oltre il margine la frangia si appiattisce
        granaMm: Math.max(p.densitySpacingMm * 4, 0.8),
        restaFuoriDa: corpo,
      });

      macchie.push({
        tinta: t, region, corse: frangiate,
        metodo: fasce && fasce.runs.length ? 'fasce' : iso && iso.runs.length ? 'iso' : daRotaia ? 'rotaia' : 'distanza',
      });
    }
  }

  /*
   * I PASSAGGI (R16-R21, R26) — il pezzo che il primo DST vero non aveva, e che l'ha reso
   * inutilizzabile: 15.449 salti e 569 m di spostamenti a vuoto contro 355 m di filo cucito.
   *
   * Non c'è niente di nuovo da scrivere: `routeColorRuns` del core fa esattamente questo. Per ogni
   * ago costruisce la mappa di cosa gli verrà cucito SOPRA, visita le macchie a catena minima, e
   * fra una corsa e l'altra sceglie fra tre cose in ordine — dritto se il salto è corto e resta
   * dentro la macchia, altrimenti la strada meno visibile con l'A*, e solo se nemmeno quella regge
   * il filo si stacca.
   *
   * La mappa vuole gli indici **in ordine di cucitura**, non quelli della palette: `ordine` è una
   * permutazione, e passare gli indici grezzi vorrebbe dire dire al core che «dopo» è un altro.
   */
  const inOrdine = new Uint8Array(idx.length).fill(0xff);
  for (let i = 0; i < idx.length; i++) {
    const pos = ordine.indexOf(idx[i]);
    if (pos >= 0) inOrdine[i] = pos;
  }
  const aghi = ordine.map(() => ({}));

  let filoMm = 0, punti = 0, salti = 0, saltoMm = 0, saltoMassimoMm = 0;
  const passaggiPerAgo: PassaggiAgo[] = [];
  for (let k = 0; k < ordine.length; k++) {
    const t = ordine[k];
    const gruppi: RegionRuns[] = macchie
      .filter((m) => m.tinta === t && m.corse.length)
      .map((m) => {
        /*
         * L'ordine delle corse: quello con cui sono nate, o la catena al piu' vicino? **Si misura.**
         *
         * Non c'e' un vincitore fisso, e crederlo mi e' costato due volte. La rotaia le fa uscire
         * gia' in fila, ed e' il senso di quel motore: rimescolarle la peggiorava (41,8 -> 53,5 m).
         * Ma non tutte le macchie dalla rotaia sono ordinate bene, e su una di quelle tenere
         * l'ordine di nascita costava 1.769 m contro 30. Due misure opposte, stessa domanda: allora
         * la domanda si fa fare al conto, macchia per macchia. Costa una passata sui capi.
         */
        const nate = m.corse;
        const incatenate = inFila(nate);
        const scelte = costoDellOrdine(nate) <= costoDellOrdine(incatenate) ? nate : incatenate;
        // prima l'ordine, poi il giro: il giro dipende da CHI viene dopo, quindi va deciso dopo
        const girate = giroSullaFrangia(scelte, p.densitySpacingMm * 2);
        if (!p.riempimentoContinuo) return { region: m.region, runs: girate };
        /*
         * IL FILO CONTINUO. Le corse non si consegnano piu' sciolte: si uniscono in serpentina
         * PRIMA del routing, cosi' non c'e' niente da ricucire dopo.
         *
         * Il giro in fondo puo' essere lungo quanto la spaziatura — e' il normale giro del pettine —
         * piu' il gioco che la frangia introduce accorciando le corse in modo diverso l'una
         * dall'altra. Oltre, le due corse non si toccano davvero e la catena si spezza: attaccarle
         * lo stesso vorrebbe dire tirare un filo attraverso il vuoto.
         */
        const maxGiro = Math.max(p.densitySpacingMm * 4, p.frangiaMm * 1.2);
        return { region: m.region, runs: serpentina(girate, maxGiro).tracciati };
      });
    if (!gruppi.length) continue;
    const grid = buildCoverGrid(inOrdine, img.width, img.height, mmPerPx, k, aghi, 1.5);
    /*
     * Quanto passaggio SCOPERTO si accetta prima di staccare il filo (R16, fallback graduato).
     *
     * Non è un numero solo, perché non tutti gli aghi sono nella stessa condizione. Sotto un colore
     * che verrà, un passaggio lungo sparisce: si può essere generosi, e conviene, perché un taglio
     * costa una ripresa e un capo da fissare. Sull'ULTIMO ago non c'è niente che copra: lì un
     * passaggio è filo che si vede sul davanti, e la regola di Lorenzo è quella — «solo l'ultimo
     * livello, se non c'è soluzione, mettiamo rasafilo». Quindi lì si tiene la soglia sotto il
     * rasafilo della macchina: il tratto corto passa, il resto si taglia.
     */
    const ultimo = k === ordine.length - 1;
    if (!p.cuciPassaggi) {
      // solo per misurare: le corse restano com'erano, senza un millimetro di filo di collegamento
      const blocchi = gruppi.flatMap((g) => g.runs).map((b) => minEMax(b, p.minStitchMm, p.maxStitchMm));
      for (const m of macchie) if (m.tinta === t) m.corse = [];
      const prima = macchie.find((m) => m.tinta === t);
      if (prima) prima.corse = blocchi;
      passaggiPerAgo.push({
        tinta: t, corse: blocchi.length, stacchi: blocchi.length,
        riempimentoMm: 0, passaggiMm: 0, passaggiCopertiMm: 0,
        perCaso: { dritto: { volte: 0, mm: 0 }, interno: { volte: 0, mm: 0 }, contorno: { volte: 0, mm: 0 } },
        vie: [],
      });
      for (const b of blocchi) {
        punti += b.length;
        for (let i = 1; i < b.length; i++) filoMm += distance(b[i], b[i - 1]);
      }
      continue;
    }
    const routed = routeColorRuns(gruppi, grid, {
      travelStitchMm: p.travelStitchMm,
      maxVisibleTravelMm: ultimo ? p.maxVisibleTravelUltimoMm : p.maxVisibleTravelMm,
      /*
       * Sul bordo il filo NON ci va (R30 — la scelta opposta a quella del broccato, e per un motivo
       * preciso). Nel broccato il contorno e' il posto piu' nascosto: il nero ci passera' sopra.
       * Qui il contorno e' la frangia, cioe' il degrade' stesso: un filo che lo costeggia riempie i
       * vuoti fra i denti e la sfumatura diventa una linea. Lorenzo l'ha visto sul blu, dov'e' piu'
       * evidente perche' quell'ago ha meno colore sopra a coprirlo.
       *
       * Il margine e' la frangia: il passaggio deve stare piu' dentro di quanto la frangia arrivi
       * a mordere, altrimenti la tocca lo stesso.
       */
      viaPreferita: p.viaPassaggi,
      margineDalBordoMm: p.margineDalBordoMm,
      maxInternalTravelMm: p.maxInternalTravelMm,
    });
    // R3 DOPO il routing, mai prima: sono le giunzioni appena create a reintrodurre i micro-punti
    const blocchi = routed.blocks
      .map((b) => minEMax(b, p.minStitchMm, p.maxStitchMm))
      .filter((b) => b.length >= 2);
    // i blocchi cuciti stanno tutti sulla prima macchia dell'ago: da qui in poi contano gli AGHI
    for (const m of macchie) if (m.tinta === t) m.corse = [];
    const prima = macchie.find((m) => m.tinta === t);
    if (prima) prima.corse = blocchi;

    salti += routed.jumps;
    saltoMm += routed.travelMm;
    passaggiPerAgo.push({
      tinta: t,
      corse: gruppi.reduce((a, g) => a + g.runs.length, 0),
      riempimentoMm: gruppi.reduce((a, g) => a + g.runs.reduce((b, r) => {
        let m = 0; for (let i = 1; i < r.length; i++) m += distance(r[i], r[i - 1]); return b + m;
      }, 0), 0),
      passaggiMm: routed.travelMm,
      passaggiCopertiMm: routed.travelCoveredMm,
      stacchi: routed.jumps,
      perCaso: routed.perCaso,
      vie: routed.allTravels,
    });
    for (let i = 1; i < blocchi.length; i++) {
      const d = Math.hypot(blocchi[i][0].x - blocchi[i - 1][blocchi[i - 1].length - 1].x,
        blocchi[i][0].y - blocchi[i - 1][blocchi[i - 1].length - 1].y);
      if (d > saltoMassimoMm) saltoMassimoMm = d;
    }
    for (const b of blocchi) {
      punti += b.length;
      for (let i = 1; i < b.length; i++) filoMm += Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y);
    }
  }

  return {
    palette: res.palette, ordine, macchie, mmPerPx,
    larghezzaMm, altezzaMm: img.height * mmPerPx,
    bordiSfumati, bordiTotali, filoMm, punti,
    salti, saltoMm, saltoMassimoMm, passaggiPerAgo,
    indice: idx, larghezzaPx: img.width, altezzaPx: img.height,
  };
}

/**
 * Il tratto di contorno più lungo che guarda una tinta **prima** (già cucita) o **dopo** di questa.
 * È la rotaia: un lato solo. Prendere tutto il contorno che guarda un'altra tinta sembra equivalente
 * e non lo è — su una regione interna è quasi tutto l'anello, e si finisce per seminare da ogni lato.
 */
/**
 * LE TESTATE: i tratti di contorno dove NON c'e' un altro colore.
 *
 * Sono i capi della fascia — dove il ricamo comincia e dove finisce — in contrapposizione ai lati
 * lunghi, che confinano con un'altra tinta. Il riempimento per curve di livello parte da qui: il
 * fronte entra da un capo, cammina lungo la fascia, e le sue curve di livello la attraversano. E'
 * cosi' che il punto viene perpendicolare alla transizione di colore senza doverglielo chiedere.
 *
 * Si restituisce **una sola** testata, la piu' lunga. Seminandole tutte i fronti partirebbero dai
 * due capi e si scontrerebbero a meta' fascia, spezzando ogni livello in due: il ricamo si
 * spaccherebbe in mezzo invece di correre da un capo all'altro.
 */
function testataPiuLunga(anello: Polyline, fuori: (p: Point) => number): Polyline | null {
  const libero = anello.map((p) => fuori(p) < 0);
  let inizio = 0, lungh = 0, corrente = 0, iniz = 0;
  for (let i = 0; i < libero.length * 2; i++) {
    if (libero[i % libero.length]) {
      if (corrente === 0) iniz = i;
      corrente++;
      if (corrente > lungh) { lungh = corrente; inizio = iniz; }
    } else corrente = 0;
  }
  if (lungh < 3) return null;
  return Array.from({ length: Math.min(lungh, libero.length) }, (_, k) => anello[(inizio + k) % libero.length]);
}

function trattoVerso(
  anello: Polyline, fuori: (p: Point) => number, ordine: number[], mio: number, verso: 'prima' | 'dopo',
): Polyline | null {
  const guarda = anello.map((p) => {
    const q = fuori(p);
    if (q < 0) return false;
    const suo = ordine.indexOf(q);
    return verso === 'prima' ? suo >= 0 && suo < mio : suo > mio;
  });
  let inizio = 0, lungh = 0, corrente = 0, iniz = 0;
  for (let i = 0; i < guarda.length * 2; i++) {
    if (guarda[i % guarda.length]) {
      if (corrente === 0) iniz = i;
      corrente++;
      if (corrente > lungh) { lungh = corrente; inizio = iniz; }
    } else corrente = 0;
  }
  if (lungh < 6) return null;
  return Array.from({ length: Math.min(lungh, guarda.length) }, (_, k) => anello[(inizio + k) % guarda.length]);
}

/**
 * I livelli da esportare: **uno per tinta**, perché una tinta è un filato è un ago (R31). Le macchie
 * della stessa tinta stanno nello stesso livello, in ordine di cucitura.
 */
export function pittoricoExportLayers(plan: PittoricoPlan): ExportLayer[] {
  const THREAD_STROKE_MM = 0.1;                       // R15: il filo si disegna sottile
  return plan.ordine.map((t, i) => ({
    id: `ago-${String(i).padStart(2, '0')}-tinta-${t}`,
    color: rgbToHex(plan.palette[t]),
    strokeMm: THREAD_STROKE_MM,
    polylines: plan.macchie.filter((m) => m.tinta === t).flatMap((m) => m.corse),
  })).filter((l) => l.polylines.length > 0);
}

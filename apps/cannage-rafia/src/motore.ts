// Il contratto del motore (K1b) per il Cannage rafia: il programma a stop (contorno, griglia, basi, linee,
// cornice, bordatura) che prima stava dentro tool.ts, mescolato al pannello. Qui è funzione pura: dal disegno
// letto (zone, linee, ruoli, basi, lati scelti) e dalle sei chiavi di parametri escono gli stop e gli strati.
// tool.ts chiama `programmaCannage`; `motore.genera` ne ricava gli strati (stratiProgramma), come l'export.
import type { PatternConfig } from '@rg/pattern-grammar';
import type { Ingresso, Motore } from '@rg/cervello';
import { pezzoPiuLungo, type Ingombro, type Punto } from './linee';
import { latiDelContorno, lineeDaLati, stessoLato, type LatoContorno, type LineaBordo, type Passaggio } from './bordatura';
import { conPuntoMinimo, unisciTratti, stopBase, stopBordatura, stopContorno, stopCornice, stopGriglia, stopLinee, stratiProgramma, NOMI_BORDATURA, type Stop } from './programma';
import { reticoloDaZone, type LetturaReticolo, type LineaAperta, type Zona } from './reticolo';
import { sagomaDaAnelli, sagomaDaZone, type Sagoma } from './sagoma';
import { parametriBordaturaDa, parametriCorniceDa, parametriDa, parametriStopDa, type Valori } from './fields';

/**
 * Cosa fa una tinta del disegno: il pattern 1 comanda griglia e linee e fa lo stop 3, il pattern 2 lo
 * stop 4; le aree di scarico (anche più di una tinta) alleggeriscono basi, linee e cornice dentro i loro
 * contorni; il contorno del pezzo è la linea che seguono bordo, griglia e termogarze; le due bordature sono
 * il lato esterno da bordare (una linea aperta o chiusa), doppia o singola.
 */
export type Ruolo = '' | 'pattern1' | 'pattern2' | 'scarico' | 'contorno' | 'bordaturaDoppia' | 'bordaturaSingola';

/** Il passaggio di una tinta di bordatura, o null se la tinta non borda. */
export const passaggioDi = (r: Ruolo | undefined): Passaggio | null => (r === 'bordaturaDoppia' ? 'doppia' : r === 'bordaturaSingola' ? 'singola' : null);

export const NOMI_STOP: Record<number, string> = {
  1: 'Contorno a impunture',
  2: 'Griglia che blocca i materiali',
  3: 'Base pattern 1',
  4: 'Base pattern 2',
  5: 'Linee orizzontali e verticali',
  6: 'Cornice nei rombi',
  ...NOMI_BORDATURA,
};

/** Le sei chiavi che il cannage salva nel file di progetto, coi nomi di oggi (`dove`). */
export interface ParamsCannage {
  /** Stop 5, le linee. */
  params: Valori;
  /** Stop 1-2. */
  stop: Valori;
  basiParams: Valori;
  /** Stop 6. */
  cornice: Valori;
  programma: Valori;
  /** Stop 7-10. */
  bordatura: Valori;
}

/** Il disegno e le scelte a mano dell'utente: zone, linee aperte, ruoli delle tinte, pattern delle basi, lati scelti. */
export interface IngressoCannage extends Ingresso {
  zone: Zona[];
  /** I tracciati aperti del disegno: servono solo alla bordatura. */
  linee?: LineaAperta[];
  ruoli: Record<string, Ruolo>;
  /** I nomi dei pattern delle due basi (chiavi di `presets`). */
  basi: { p1: string; p2: string };
  /** La libreria dei pattern (presets.shared.json). */
  presets: Record<string, PatternConfig>;
  /** I lati da bordare scelti in anteprima, per il loro punto di mezzo. */
  latiScelti?: (Punto & { passaggio: Passaggio })[];
}

/**
 * Le cose che costano e che il pannello tiene da una chiamata all'altra (le basi, la sagoma, i lati): senza,
 * il risultato è lo stesso, solo più lento. Si azzera da sé quando cambia il disegno (`zone`).
 */
export interface Memoria {
  zone: Zona[] | null;
  basi: Map<string, Stop>;
  sagoma: { chiave: string; sagoma: Sagoma } | null;
  lati: { chiave: string; lati: LatoContorno[] } | null;
}
export const nuovaMemoria = (): Memoria => ({ zone: null, basi: new Map(), sagoma: null, lati: null });
const sveglia = (m: Memoria, zone: Zona[]) => {
  if (m.zone !== zone) { m.zone = zone; m.basi.clear(); m.sagoma = null; m.lati = null; }
};

export const conRuolo = (ruoli: Record<string, Ruolo>, r: Ruolo) => Object.keys(ruoli).find((c) => ruoli[c] === r) ?? '';
export const areeScarico = (ruoli: Record<string, Ruolo>) => Object.keys(ruoli).filter((c) => ruoli[c] === 'scarico').sort();
/** I contorni delle aree di scarico, per alleggerire linee e cornice dentro di loro. */
export const poligoniScarico = (ing: IngressoCannage) => ing.zone.filter((z) => ing.ruoli[z.color ?? ''] === 'scarico').map((z) => z.points);
/** La linea di contorno scelta nel disegno: la seguono bordo, griglia e termogarze. */
export const anelliContorno = (ing: IngressoCannage) => ing.zone.filter((z) => ing.ruoli[z.color ?? ''] === 'contorno').map((z) => z.points);

/** La sagoma del pezzo: l'unione delle zone dei due pattern (finché non sono scelti, tutte tranne scarico/contorno/bordature). */
export function sagomaPezzo(ing: IngressoCannage, memo: Memoria = nuovaMemoria()): Sagoma {
  sveglia(memo, ing.zone);
  const { ruoli } = ing;
  const pattern = [conRuolo(ruoli, 'pattern1'), conRuolo(ruoli, 'pattern2')].filter(Boolean);
  const fuoriPezzo = Object.keys(ruoli).filter((c) => ruoli[c] === 'scarico' || ruoli[c] === 'contorno' || passaggioDi(ruoli[c]) !== null).sort();
  const tinte = [...new Set([...ing.zone.map((z) => z.color ?? ''), ...(ing.linee ?? []).map((l) => l.color)])];
  const escludi = pattern.length === 2 ? tinte.filter((c) => !pattern.includes(c)) : fuoriPezzo;
  const chiave = escludi.join(',');
  if (memo.sagoma?.chiave !== chiave) memo.sagoma = { chiave, sagoma: sagomaDaZone(ing.zone, escludi) };
  return memo.sagoma.sagoma;
}

/** La sagoma che seguono contorno e griglia: la linea di contorno scelta, o il pezzo. */
export function sagomaBordo(ing: IngressoCannage, memo: Memoria = nuovaMemoria()): Sagoma {
  const anelli = anelliContorno(ing);
  return anelli.length ? sagomaDaAnelli(anelli) : sagomaPezzo(ing, memo);
}

/** I lati del contorno che si possono scegliere in anteprima: quelli della linea che segue il bordo. */
export function latiContorno(ing: IngressoCannage, memo: Memoria = nuovaMemoria()): LatoContorno[] {
  sveglia(memo, ing.zone);
  const chiave = JSON.stringify(ing.ruoli);
  if (memo.lati?.chiave !== chiave) memo.lati = { chiave, lati: ing.zone.length ? latiDelContorno(sagomaBordo(ing, memo).anelli) : [] };
  return memo.lati.lati;
}

export const sceltaDi = (ing: IngressoCannage, l: LatoContorno): Passaggio | null => (ing.latiScelti ?? []).find((k) => stessoLato(l, k))?.passaggio ?? null;

/** Le linee da bordare: quelle col ruolo nel disegno e i lati scelti in anteprima. */
export function lineeBordatura(ing: IngressoCannage, memo: Memoria = nuovaMemoria()): LineaBordo[] {
  const { ruoli } = ing;
  return [
    ...(ing.linee ?? []).filter((l) => passaggioDi(ruoli[l.color])).map((l) => ({ punti: l.points, chiusa: false, passaggio: passaggioDi(ruoli[l.color])! })),
    ...ing.zone.filter((z) => passaggioDi(ruoli[z.color ?? ''])).map((z) => ({ punti: z.points, chiusa: true, passaggio: passaggioDi(ruoli[z.color ?? ''])! })),
    ...(ing.latiScelti?.length ? lineeDaLati(latiContorno(ing, memo), (l) => sceltaDi(ing, l)) : []),
  ];
}

export interface Programma {
  /** Gli stop, già con i tratti uniti e il punto minimo. */
  stop: Stop[];
  /** La lettura del reticolo dal pattern 1, se c'è. */
  lettura: LetturaReticolo | null;
  /** Tutto quello che il programma ha dovuto dire (nell'ordine in cui è successo): il pannello mostra l'ultimo. */
  avvisi: string[];
}

/** Il programma a stop di adesso: la sequenza che tool.ts faceva in `aggiorna()`, senza il DOM. */
export function programmaCannage(ing: IngressoCannage, par: ParamsCannage, memo: Memoria = nuovaMemoria()): Programma {
  sveglia(memo, ing.zone);
  const { zone, ruoli } = ing;
  const avvisi: string[] = [];
  let lettura: LetturaReticolo | null = null;
  let stop: Stop[] = [];

  const base = (numero: 3 | 4, colore: string, preset: string): Stop => {
    const colori = areeScarico(ruoli);
    const percento = Number(par.basiParams.reliefPercent) || 0;
    const chiave = `${numero}|${colore}|${preset}|${colori.join(',')}|${percento}`;
    let s = memo.basi.get(chiave);
    if (!s) {
      const config = ing.presets[preset];
      try {
        s = colore && config ? stopBase(numero, zone, colore, config, { colori, percento }) : { numero, nome: NOMI_STOP[numero], blocchi: [], punti: 0 };
      } catch (e) {
        avvisi.push(`Stop ${numero}: ${(e as Error).message}`);
        s = { numero, nome: NOMI_STOP[numero], blocchi: [], punti: 0 };
      }
      memo.basi.set(chiave, s);
    }
    return s;
  };

  if (zone.length) {
    const parStop = parametriStopDa(par.stop);
    // contorno e griglia seguono la sagoma vera del pezzo, non il rettangolo (Lorenzo, 16/09)
    stop.push(stopContorno(sagomaBordo(ing, memo), parStop));
    const p1 = conRuolo(ruoli, 'pattern1');
    if (!p1) avvisi.push('Scegli la tinta del pattern 1: griglia e linee seguono i suoi rombi.');
    else {
      try {
        lettura = reticoloDaZone(zone, p1);
        if (lettura.fuoriReticolo) avvisi.push(`${lettura.fuoriReticolo} rombi non stanno sul reticolo: controlla il disegno.`);
        stop.push(stopGriglia(lettura.reticolo, sagomaBordo(ing, memo), parStop));
      } catch (e) {
        avvisi.push((e as Error).message);
      }
    }
    stop.push(base(3, p1, ing.basi.p1), base(4, conRuolo(ruoli, 'pattern2'), ing.basi.p2));
    if (lettura) {
      // la cornice non passa sopra fermi e barre delle linee: glieli passa lo stop 5
      let ingombri: Ingombro[] = [];
      const sagoma = sagomaPezzo(ing, memo);
      const scarico = poligoniScarico(ing);
      try {
        const s5 = stopLinee(lettura.reticolo, sagoma, parametriDa(par.params), scarico, anelliContorno(ing));
        ingombri = s5.risultato.ingombri;
        stop.push(s5);
      } catch (e) { avvisi.push((e as Error).message); }
      try { stop.push(stopCornice(lettura.reticolo, sagoma, parametriCorniceDa(par.cornice), ingombri, scarico)); } catch (e) { avvisi.push((e as Error).message); }
    }
    // la bordatura, sui lati scelti: il passo dei fermi parte dal pezzo più lungo delle linee (stop 5)
    const daBordare = lineeBordatura(ing, memo);
    if (daBordare.length) {
      try {
        const passo = lettura ? pezzoPiuLungo(lettura.reticolo, parametriDa(par.params)) : undefined;
        stop.push(...stopBordatura(daBordare, parametriBordaturaDa(par.bordatura), sagomaBordo(ing, memo), passo).stop);
      } catch (e) { avvisi.push(`Bordatura: ${(e as Error).message}`); }
    }
  }
  // i tratti che si toccano diventano uno (niente salti da 0 mm nel DST), poi il punto minimo per tutti
  const minimo = Number(par.programma.puntoMinimo) || 0;
  stop = stop.map((s) => conPuntoMinimo(unisciTratti(s), minimo));
  return { stop, lettura, avvisi };
}

export const motore: Motore<IngressoCannage, ParamsCannage> = {
  id: 'cannage-rafia',
  async genera(ingresso, params) {
    const { stop, avvisi } = programmaCannage(ingresso, params);
    return { strati: stratiProgramma(stop), avvisi };
  },
};

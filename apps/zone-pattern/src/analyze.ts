// Da un SVG ai VALORI DI COSTRUZIONE del pattern.
//
// Lorenzo: «dovresti prendere solo i valori, perché così prendi proprio l'SVG. A te servono
// solo i valori di costruzione del modulo». Ha ragione: posare la geometria dell'SVG dentro
// le zone la RICALCA — esce a pezzi staccati, senza filo continuo, senza punto minimo, coi
// bordi sfrangiati. Quello che serve è LEGGERE come è fatto quel pattern e poi RIGENERARLO
// col motore, che sa fare tutto il resto.
//
// Due strade, in quest'ordine:
//  1. l'SVG viene dalla suite → i parametri sono già scritti dentro, si prendono ESATTI (R27);
//  2. l'SVG viene da fuori → si MISURANO dalla geometria (periodi, ampiezze, punto min/max).
import { parseSvgPolylines, type ImportScaleMode, type PatternConfig, type Point } from '@rg/pattern-grammar';
import { PATTERN_FIELD_KIND, PATTERN_FIELD_NAMES } from './fields';

export type ReadPattern = {
  config: PatternConfig;
  /** Come si è arrivati a quei valori: cambia quanto ci si può fidare. */
  origin: 'parametri' | 'misura';
  /** Cosa si è capito, in italiano: va mostrato, non nascosto. */
  notes: string[];
};

/**
 * Porta i valori scritti coi NOMI VECCHI sui nomi di oggi.
 *
 * Serve sul serio: gli SVG di riferimento di Lorenzo (`CANNAGE-BASE-ORIGINALE-*`) sono export
 * di prima delle rinomine ⑥⑦⑧ e scrivono `minPointDistance`, `strokeWidth`,
 * `columnWaveFrequency`, `columnWavePhase`. Senza questo passaggio quei valori non è che
 * arrivano sbagliati: **spariscono**, e il pannello resta sui suoi default come se il file non
 * avesse detto niente (misurato: `minPointDistance: 2` diventava punto minimo 0.4).
 * È la stessa conversione che `apps/pattern-grammar` fa sui preset salvati.
 */
export function migrateLegacyNames(source: Record<string, unknown>): Record<string, unknown> {
  const c = { ...source };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  c.minStitchMm ??= num(c.minPointDistance) ?? num(c.minSegmentLength);
  c.maxStitchMm ??= num(c.maxStitchLength);
  c.constructionStroke ??= num(c.strokeWidth);
  const frequency = num(c.columnWaveFrequency);
  if (c.columnWaveLengthMm === undefined && frequency !== undefined) {
    c.columnWaveLengthMm = frequency > 0 ? (2 * Math.PI) / frequency : 60;
  }
  const phase = num(c.columnWavePhase);
  if (c.columnWavePhaseDeg === undefined && phase !== undefined) c.columnWavePhaseDeg = (phase * 180) / Math.PI;
  return c;
}

/**
 * Tiene solo i campi che il pannello sa mostrare e scarta i vuoti: un valore assente è meglio
 * di un valore inventato. L'elenco NON è scritto qui — arriva da `PATTERN_FIELD_NAMES`, cioè
 * dal pannello stesso, così non possono divergere.
 */
function keepUsable(source: Record<string, unknown>): PatternConfig {
  const migrated = migrateLegacyNames(source);
  const out: Record<string, unknown> = {};
  for (const key of PATTERN_FIELD_NAMES) {
    const value = migrated[key];
    const kind = PATTERN_FIELD_KIND[key];
    if (kind === 'select' && typeof value === 'string' && value) out[key] = value;
    else if (kind === 'check' && typeof value === 'boolean') out[key] = value;
    else if (kind === 'num' && typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out as PatternConfig;
}

/** I parametri scritti dentro l'SVG dalla suite, se ci sono. */
export function readEmbeddedConfig(svgText: string): PatternConfig | null {
  const raw = /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i.exec(svgText)?.[1];
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
    // `sourceConfig` sono i valori COME LI HA SCRITTI L'UTENTE; `grammar`/`parameters` sono
    // gli stessi già risolti. I primi sono quelli da rimettere nel pannello.
    const source = meta.sourceConfig ?? meta.params ?? meta.grammar ?? meta.parameters;
    if (!source || typeof source !== 'object') return null;
    const config = keepUsable(source as Record<string, unknown>);
    return Object.keys(config).length ? config : null;
  } catch {
    return null;
  }
}

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

/**
 * Il valore che RICORRE di più in una lista, a meno di `tolerance`.
 *
 * È il cuore della misura: un pattern è fatto di distanze che si ripetono, e la distanza
 * che si ripete di più È il passo. La media sarebbe sbagliata (i valori sporchi la tirano),
 * la mediana pure quando ci sono due famiglie di distanze; la moda no.
 */
export function modeOf(values: number[], tolerance: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  let best = { value: sorted[0], count: 0 };
  let start = 0;
  for (let i = 0; i < sorted.length; i++) {
    while (sorted[i] - sorted[start] > tolerance) start++;
    const count = i - start + 1;
    if (count > best.count) {
      const middle = sorted.slice(start, i + 1);
      best = { value: middle[Math.floor(middle.length / 2)], count };
    }
  }
  return best.count >= 2 ? best.value : undefined;
}

/**
 * Direzione dominante dei tracciati, in gradi (periodo 180°), con quanto è CONCENTRATA.
 *
 * La concentrazione (0..1) serve più della direzione: un pattern a zig-zag ha due famiglie
 * di direzioni e la media fra le due non vuol dire niente — misurata su un pattern dritto
 * dava -4.5°, su uno inclinato di 30° dava 46.4°. Sotto una certa concentrazione l'angolo
 * NON si usa: meglio nessun valore che un valore sbagliato.
 */
export function dominantDirectionDeg(polylines: Point[][]): { deg: number; concentration: number } {
  let sumSin = 0;
  let sumCos = 0;
  let total = 0;
  for (const polyline of polylines) {
    for (let i = 1; i < polyline.length; i++) {
      const dx = polyline[i].x - polyline[i - 1].x;
      const dy = polyline[i].y - polyline[i - 1].y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) continue;
      const angle = Math.atan2(dy, dx);
      sumSin += length * Math.sin(2 * angle);
      sumCos += length * Math.cos(2 * angle);
      total += length;
    }
  }
  if (!total) return { deg: 0, concentration: 0 };
  return {
    deg: ((Math.atan2(sumSin, sumCos) / 2) * 180) / Math.PI,
    concentration: Math.hypot(sumSin, sumCos) / total,
  };
}

/**
 * Il PERIODO con cui il disegno si ripete lungo un asse.
 *
 * Non è la distanza fra due righe vicine: dentro una colonna ci sono i fili accostati a
 * frazioni di millimetro, e cercare "la distanza che ricorre" trova quelli (misurato: 1.39mm
 * dove il passo vero era 5.2). Il periodo è la distanza di cui puoi TRASLARE il disegno e
 * ritrovarlo sopra sé stesso: si costruisce l'istogramma dei vertici e si cerca lo scorrimento
 * che lo fa combaciare meglio con sé stesso (autocorrelazione), tenendo il periodo PIÙ PICCOLO
 * fra quelli buoni — i suoi multipli combaciano altrettanto bene, ma il fondamentale è lui.
 */
export function periodOf(values: number[], binMm: number, blurMm = 0): number | undefined {
  if (values.length < 8) return undefined;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  if (span < binMm * 4) return undefined;
  const bins = Math.ceil(span / binMm) + 1;
  const raw = new Float64Array(bins);
  for (const value of values) raw[Math.round((value - min) / binMm)] += 1;

  // SFOCATURA. Senza, l'autocorrelazione trova un periodo VERO ma non quello che serve: dentro
  // ogni colonna i fili accostati si ripetono a frazioni di mm e combaciano quasi perfettamente
  // (misurato: 0.92mm dove il passo delle colonne era 5.2). Sfocando alla scala dei fili quella
  // struttura sparisce e restano i gruppi, che sono le colonne vere.
  const radius = Math.max(0, Math.round(blurMm / binMm));
  const histogram = radius > 0 ? boxBlur(boxBlur(raw, radius), radius) : raw;

  const maxShift = Math.floor(bins / 2);
  const minShift = Math.max(1, Math.round(Math.max(0.3, blurMm) / binMm));
  let best = 0;
  const scores = new Float64Array(maxShift + 1);
  for (let shift = minShift; shift <= maxShift; shift++) {
    let score = 0;
    for (let i = 0; i + shift < bins; i++) score += histogram[i] * histogram[i + shift];
    scores[shift] = score / (bins - shift);
    if (scores[shift] > best) best = scores[shift];
  }
  if (best <= 0) return undefined;
  // Il primo picco che arriva al 90% del migliore: è il fondamentale, non un suo multiplo.
  for (let shift = minShift; shift <= maxShift; shift++) {
    const isPeak = scores[shift] >= best * 0.9
      && scores[shift] >= (scores[shift - 1] ?? 0)
      && scores[shift] >= (scores[shift + 1] ?? 0);
    if (isPeak) return shift * binMm;
  }
  return undefined;
}

/**
 * La distanza fra le FASCE DENSE lungo un asse.
 *
 * L'autocorrelazione fallisce quando il disegno riempie un asse in modo quasi uniforme: le
 * colonne verticali coprono tutta l'altezza, quindi lungo y il segnale è quasi piatto e il
 * periodo che esce è il primo sottomultiplo rumoroso (misurato: 4.13mm dove le file erano a
 * 12 — cioè l'altezza del gruppo, non la distanza fra i gruppi). Qui invece si cercano le
 * GOBBE: dove il filo si infittisce c'è una fila, e la distanza fra le gobbe è il passo.
 */
export function peakSpacing(values: number[], binMm: number, blurMm: number): number | undefined {
  if (values.length < 12) return undefined;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (max - min < blurMm * 4) return undefined;
  const bins = Math.ceil((max - min) / binMm) + 1;
  const raw = new Float64Array(bins);
  for (const value of values) raw[Math.round((value - min) / binMm)] += 1;
  const radius = Math.max(1, Math.round(blurMm / binMm));
  const histogram = boxBlur(boxBlur(raw, radius), radius);

  let mean = 0;
  for (const value of histogram) mean += value;
  mean /= bins;
  const peaks: number[] = [];
  for (let i = 1; i < bins - 1; i++) {
    if (histogram[i] > mean * 1.1 && histogram[i] >= histogram[i - 1] && histogram[i] > histogram[i + 1]) {
      peaks.push(i * binMm);
    }
  }
  if (peaks.length < 3) return undefined;
  const gaps: number[] = [];
  for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
  return modeOf(gaps, Math.max(blurMm, binMm * 3));
}

function boxBlur(source: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(source.length);
  for (let i = 0; i < source.length; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < source.length) { sum += source[j]; count++; }
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

/**
 * I valori di costruzione MISURATI da un pattern qualsiasi.
 *
 * Si guarda il disegno nel suo verso (ruotato sulla direzione dominante) e si cerca ciò che
 * si ripete: il passo fra le colonne, il passo fra le file, l'ampiezza dello zig-zag, la
 * distanza fra i fili accostati, il punto più corto e il più lungo. Quello che non si riesce
 * a misurare NON si inventa: resta fuori, e il campo del pannello tiene il suo valore.
 */
export function measureConstruction(polylines: Point[][]): ReadPattern {
  const notes: string[] = [];
  const config: Record<string, number> = {};
  const direction = dominantDirectionDeg(polylines);
  // Si raddrizza sempre per misurare (i periodi vanno cercati nel verso del disegno), ma
  // l'angolo si TIENE come parametro solo se le direzioni sono davvero concentrate.
  const angle = direction.deg;
  const rad = (-angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local = polylines.map((polyline) =>
    polyline.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos })));

  const lengths: number[] = [];
  const spans: number[] = [];
  for (const polyline of local) {
    for (let i = 1; i < polyline.length; i++) {
      const dx = polyline[i].x - polyline[i - 1].x;
      const dy = polyline[i].y - polyline[i - 1].y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;
      lengths.push(length);
      if (Math.abs(dx) > 1e-6) spans.push(Math.abs(dx));
    }
  }
  if (!lengths.length) {
    return { config: {} as PatternConfig, origin: 'misura', notes: ['Nessun tracciato: niente da misurare.'] };
  }

  const sortedLengths = lengths.slice().sort((a, b) => a - b);
  config.minStitchMm = round(sortedLengths[0], 2);
  config.maxStitchMm = round(sortedLengths.at(-1)!, 1);
  notes.push(`punto da ${config.minStitchMm} a ${config.maxStitchMm} mm`);

  if (direction.concentration > 0.6 && Math.abs(angle) > 0.5) {
    config.horizontalAngleDeg = round(angle, 1);
    notes.push(`il disegno corre a ${config.horizontalAngleDeg}°`);
  } else if (direction.concentration <= 0.6) {
    notes.push("inclinazione non misurabile (il disegno va in più direzioni): resta quella del pannello");
  }

  // 1) Le AMPIEZZE. L'ampiezza dello zig-zag è l'escursione orizzontale che RICORRE fra le
  //    corse lunghe; i micro-scarti dei fili accostati sono un'altra famiglia di numeri, ed
  //    è quella che dà l'interlinea. Vanno misurate per prime perché l'interlinea dà anche
  //    la scala a cui sfocare per trovare i passi.
  const tolerance = Math.max(0.05, sortedLengths[Math.floor(sortedLengths.length / 2)] / 4);
  let interline: number | undefined;
  if (spans.length) {
    const sortedSpans = spans.slice().sort((a, b) => a - b);
    const width = modeOf(sortedSpans.slice(Math.floor(sortedSpans.length * 0.6)), Math.max(0.1, tolerance));
    if (width) {
      config.horizontalZigzagWidth = round(width, 2);
      notes.push(`zig-zag largo ${config.horizontalZigzagWidth} mm`);
    }
    const small = modeOf(sortedSpans.slice(0, Math.max(1, Math.floor(sortedSpans.length * 0.25))), 0.05);
    if (small && small < (width ?? Infinity) / 2) {
      interline = small;
      config.horizontalZigzagInterline = round(small, 2);
      config.verticalZigzagInterline = round(small, 2);
      notes.push(`fili accostati a ${config.horizontalZigzagInterline} mm`);
    }
  }

  // 2) I PASSI, cercati dopo aver sfocato alla scala dei fili accostati.
  const vertices = local.flat();
  const bin = Math.max(0.05, tolerance / 3);
  const blur = Math.max(bin * 2, (interline ?? bin) * 3);
  // Le due misure si coprono a vicenda: l'autocorrelazione è più precisa quando l'asse ha
  // una struttura netta, le gobbe reggono quando l'asse è quasi pieno. Si prende la prima
  // che risponde, nell'ordine giusto per quell'asse.
  const xs = vertices.map((p) => p.x);
  const ys = vertices.map((p) => p.y);
  const stepX = periodOf(xs, bin, blur) ?? peakSpacing(xs, bin, blur);
  const stepY = peakSpacing(ys, bin, blur) ?? periodOf(ys, bin, blur);
  if (stepX) {
    config.stepX = round(stepX, 2);
    notes.push(`colonne ogni ${config.stepX} mm`);
  } else notes.push('passo fra le colonne non riconosciuto: resta quello del pannello');
  if (stepY) {
    config.horizontalZigzagSpacing = round(stepY, 2);
    notes.push(`file ogni ${config.horizontalZigzagSpacing} mm`);
  } else notes.push('passo fra le file non riconosciuto: resta quello del pannello');

  return { config: keepUsable(config), origin: 'misura', notes };
}

/** La lettura completa di un SVG-pattern: prima i parametri scritti dentro, poi la misura. */
export function readPatternSvg(svgText: string, scaleMode: ImportScaleMode): ReadPattern {
  const embedded = readEmbeddedConfig(svgText);
  if (embedded) {
    return {
      config: embedded,
      origin: 'parametri',
      notes: ['I parametri erano scritti nel file: presi esatti, senza misurare.'],
    };
  }
  const read = parseSvgPolylines(svgText, { scaleMode });
  if (!read.polylines.length) {
    return { config: {} as PatternConfig, origin: 'misura', notes: ['Nessun tracciato leggibile nell\'SVG.'] };
  }
  return measureConstruction(read.polylines);
}

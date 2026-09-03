// Da zone a ricamo: per ogni zona si genera il pattern col motore di @rg/pattern-grammar
// e lo si rimette in piano ruotato come vuole la zona.
//
// L'IDEA CHIAVE — non si ruota il modulo, si ruota il PIANO. Per una zona inclinata di θ:
// si ruota il POLIGONO di -θ, si genera il pattern "dritto" (esattamente come per il
// cannage regolare), e si ruotano indietro i punti di +θ. Il motore non sa niente di
// tutto questo e resta intatto: ritaglio al bordo, punto minimo (R3) e punto massimo (R4)
// continuano a valere come sempre. È il "prendo il pattern e ruoto tutto il blocco".
import { generateFinalPatternPoints, type GeneratedPoint, type ImportedBoundary, type PatternConfig, type Point } from '@rg/pattern-grammar';
import { enforceMinStitch, type ExportLayer } from '@rg/core';
import { boundsOfPoints, expandOuterEdges, orderZonesRaster, outerEdgeFlags, rotatePoints, type Zone } from './engine';
import { buildEdgeGraph, travelAlongEdges } from './travel';

/** Un pattern = un ago. Lorenzo: "quando cambi pattern cambi ago". */
export type PatternKey = 'A' | 'B';
export const PATTERN_KEYS: PatternKey[] = ['A', 'B'];

/** Cosa fa una tinta del disegno: quale pattern porta e con che correzione d'angolo. */
export type ZoneRole = { pattern: PatternKey | 'off'; angleOffsetDeg: number };

export type ZonePlanParams = {
  /** Ruolo per tinta: la mappa che compili nel pannello (02 Colori e ruoli). */
  roles: Record<string, ZoneRole>;
  /** I due pattern, uno per ago. Sono `PatternConfig` interi: i valori del Generatore pattern. */
  patterns: Record<PatternKey, PatternConfig>;
  /** Aria attorno alla zona nel piano di generazione, in mm. */
  marginMm: number;
  /** Altezza della fascia per l'ordine a righe; 0 = la ricava dal disegno. */
  rowHeightMm: number;
  /** I passaggi fra una zona e l'altra: impunture sui bordi, o niente (salti a filo alzato). */
  travelMode: 'edges' | 'none';
  /** Lunghezza del punto dei passaggi, in mm. */
  travelStitchMm: number;
  /** Pulizia punti (R3): sotto questa distanza i punti si tolgono. 0 = non si tocca niente. */
  cleanupMinStitchMm: number;
  /** Margine sul BORDO ESTERNO del disegno: il ricamo deborda di tanto, e solo lì. */
  outerMarginMm: number;
};

export type ZoneStitch = {
  zone: Zone;
  pattern: PatternKey;
  /** Angolo effettivamente applicato (zona + correzione della tinta). */
  angleDeg: number;
  polylines: Point[][];
  pointCount: number;
};

/** Un passaggio fra due zone: si disegna a parte perché va guardato, non confuso col ricamo. */
export type Travel = { pattern: PatternKey; points: Point[]; lengthMm: number };

/**
 * Un pezzo della sequenza di cucitura: o il ricamo di una zona, o il passaggio che porta
 * alla successiva. Serve a tenerli SEPARATI pur restando in ordine — Lorenzo deve poter
 * riordinare gli oggetti a valle, e per farlo deve prima poterli distinguere.
 */
export type SequenceStep = {
  order: number;
  kind: 'zona' | 'passaggio';
  pattern: PatternKey;
  zoneId?: string;
  polylines: Point[][];
};

export type ZonePlan = {
  stitches: ZoneStitch[];
  travels: Travel[];
  /** L'ordine di cucitura, pezzo per pezzo: è quello che va nell'SVG. */
  sequence: SequenceStep[];
  /** Punti tolti dalla pulizia: dice a colpo d'occhio quanto ha inciso. */
  cleanedPoints: number;
  /** Un layer per ago, nell'ordine di cucitura. È quello che va in SVG e in DST. */
  layers: ExportLayer[];
  width: number;
  height: number;
  skipped: number;
  warnings: string[];
};

/** Colore d'anteprima di ciascun ago (il filo vero lo mette l'operatore in macchina). */
export const PATTERN_INK: Record<PatternKey, string> = { A: '#005f27', B: '#1f4bd8' };

/**
 * Il pattern di UNA zona, in mm reali e già ruotato al suo posto.
 *
 * L'attacco è forzato a SINISTRA (Lorenzo: "i vari pattern dentro ogni rombo devono
 * sempre iniziare dalla parte sinistra"): se il tracciato finisce più a sinistra di dove
 * comincia, lo si percorre al contrario. Invertire un tracciato non sposta un punto —
 * la forma cucita è identica, cambia solo da che capo la si comincia.
 */
export function fillZone(
  zone: Zone, config: PatternConfig, angleDeg: number, marginMm = 2, polygon = zone.points,
): Point[][] {
  const local = rotatePoints(polygon, -angleDeg, zone.centroid);
  const bounds = boundsOfPoints(local);
  const shift = { x: marginMm - bounds.minX, y: marginMm - bounds.minY };
  const placed = local.map((point) => ({ x: point.x + shift.x, y: point.y + shift.y }));
  const area = { width: bounds.width + marginMm * 2, height: bounds.height + marginMm * 2, inset: 0 };
  const importedBoundary: ImportedBoundary = {
    id: zone.id,
    sourceFileName: 'zona',
    sourceType: 'svg',
    color: zone.color,
    paths: [{ id: zone.id, points: placed, closed: true }],
    bounds: { minX: marginMm, minY: marginMm, maxX: marginMm + bounds.width, maxY: marginMm + bounds.height },
  };

  const drawn = generateFinalPatternPoints({
    ...config,
    shapeType: 'imported',
    importedBoundary,
    totalWidth: area.width,
    totalHeight: area.height,
    columns: undefined,
    rows: undefined,
  }).visualPolylines;

  return drawn.map((polyline) => {
    const back = polyline.map((point) => ({ x: point.x - shift.x, y: point.y - shift.y }));
    const oriented = back.length > 1 && back[0].x > back.at(-1)!.x ? back.slice().reverse() : back;
    return rotatePoints(oriented, angleDeg, zone.centroid);
  });
}

/**
 * Il piano completo: ogni zona riempita col pattern della sua tinta, tutte le zone di uno
 * stesso pattern in SEQUENZA CONTINUA (un ago solo, a righe da sinistra a destra), e il
 * cambio pattern come cambio ago.
 */
export function buildZonePlan(zones: Zone[], params: ZonePlanParams): ZonePlan {
  const warnings: string[] = [];
  const stitches: ZoneStitch[] = [];
  let skipped = 0;

  // Il MARGINE ESTERNO: le zone sul perimetro si allargano verso fuori prima di essere
  // riempite. Il contorno disegnato resta quello vero — deborda il ricamo, non la sagoma.
  const outer = params.outerMarginMm > 0 ? outerEdgeFlags(zones) : null;
  const fillPolygon = new Map<string, Point[]>();
  if (outer) {
    zones.forEach((zone, i) => {
      fillPolygon.set(zone.id, expandOuterEdges(zone.points, outer[i], params.outerMarginMm));
    });
  }

  for (const key of PATTERN_KEYS) {
    const ofPattern = zones.filter((zone) => params.roles[zone.color]?.pattern === key);
    for (const zone of orderZonesRaster(ofPattern, params.rowHeightMm)) {
      const angleDeg = zone.angleDeg + (params.roles[zone.color]?.angleOffsetDeg ?? 0);
      let polylines: Point[][] = [];
      try {
        polylines = fillZone(zone, params.patterns[key], angleDeg, params.marginMm,
          fillPolygon.get(zone.id) ?? zone.points).filter((p) => p.length > 1);
      } catch (error) {
        warnings.push(`Zona ${zone.id}: ${(error as Error).message}`);
      }
      if (!polylines.length) {
        skipped++;
        continue;
      }
      stitches.push({
        zone,
        pattern: key,
        angleDeg,
        polylines,
        pointCount: polylines.reduce((sum, p) => sum + p.length, 0),
      });
    }
  }

  // ---- I PASSAGGI. Fra la fine di una zona e l'inizio della successiva, sullo stesso ago,
  //      il filo cammina SUI BORDI dei rombi invece di tagliare in mezzo al ricamo.
  const travels: Travel[] = [];
  const graph = params.travelMode === 'edges' && zones.length ? buildEdgeGraph(zones) : null;
  if (graph) {
    for (const key of PATTERN_KEYS) {
      const sequence = stitches.filter((s) => s.pattern === key);
      for (let i = 1; i < sequence.length; i++) {
        const from = sequence[i - 1].polylines.at(-1)!.at(-1)!;
        const to = sequence[i].polylines[0][0];
        const points = travelAlongEdges(graph, from, to, params.travelStitchMm);
        let lengthMm = 0;
        for (let k = 1; k < points.length; k++) {
          lengthMm += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
        }
        if (points.length > 1) travels.push({ pattern: key, points, lengthMm });
      }
    }
  }

  // ---- LA PULIZIA PUNTI (R3), applicata ALLA FINE: prima ci sono i passaggi, che creano
  //      giunzioni nuove. È lo stesso inciampo già pagato in R3/R4 — pulire prima non basta.
  let cleanedPoints = 0;
  if (params.cleanupMinStitchMm > 0) {
    const clean = (points: Point[]) => {
      const out = enforceMinStitch(points, params.cleanupMinStitchMm);
      cleanedPoints += points.length - out.length;
      return out;
    };
    for (const stitch of stitches) {
      stitch.polylines = stitch.polylines.map(clean).filter((p) => p.length > 1);
      stitch.pointCount = stitch.polylines.reduce((sum, p) => sum + p.length, 0);
    }
    for (const travel of travels) travel.points = clean(travel.points);
  }

  // Un ago = una sequenza sola: zona, passaggio, zona, passaggio… La sequenza si costruisce
  // una volta e serve a due cose diverse: i LAYER per il DST (uno per ago, altrimenti ogni
  // pezzo diventerebbe un cambio-colore) e i GRUPPI per l'SVG (uno per pezzo, così si
  // riconoscono e si riordinano).
  const sequence: SequenceStep[] = [];
  for (const key of PATTERN_KEYS) {
    const blocks = stitches.filter((s) => s.pattern === key);
    const ofPattern = travels.filter((t) => t.pattern === key);
    blocks.forEach((stitch, i) => {
      sequence.push({ order: sequence.length, kind: 'zona', pattern: key, zoneId: stitch.zone.id, polylines: stitch.polylines });
      if (ofPattern[i]) {
        sequence.push({ order: sequence.length, kind: 'passaggio', pattern: key, polylines: [ofPattern[i].points] });
      }
    });
  }

  const layers: ExportLayer[] = PATTERN_KEYS
    .map((key) => ({
      id: `pattern-${key}`,
      color: PATTERN_INK[key],
      polylines: sequence.filter((s) => s.pattern === key).flatMap((s) => s.polylines),
    }))
    .filter((layer) => layer.polylines.length > 0);

  const all = zones.flatMap((zone) => zone.points);
  const bounds = all.length ? boundsOfPoints(all) : { maxX: 0, maxY: 0, width: 0, height: 0, minX: 0, minY: 0 };
  if (skipped) warnings.push(`${skipped} zone senza punti: pattern troppo rado per la loro misura?`);

  return { stitches, travels, sequence, cleanedPoints, layers, width: bounds.maxX, height: bounds.maxY, skipped, warnings };
}

/**
 * I gruppi dell'export SVG: UNO PER PEZZO, nell'ordine di cucitura.
 *
 * Lorenzo: «potrebbe essere necessario cambiare ordine degli oggetti, è possibile mantenere
 * separati i blocchi e i passaggi ma lasciando tutto in sequenza?». Prima i pezzi erano già
 * tracciati distinti, ma tutti dentro due soli gruppi anonimi: a valle si vedeva "un gruppo,
 * 37 tracciati" e non si capiva quale fosse un rombo e quale un passaggio, né in che ordine.
 * Ora ogni pezzo è un gruppo con un nome che dice **numero d'ordine, tipo e zona** — così si
 * riconosce e si riordina. È lo stesso mestiere degli `stop-0000` di broccato.
 *
 * Il COLORE resta quello dell'ago, anche per i passaggi: sono lo stesso filo, e dare loro una
 * tinta diversa direbbe al software a valle che è un altro ago.
 */
export function exportSequenceLayers(plan: ZonePlan): ExportLayer[] {
  return plan.sequence.map((step) => ({
    id: [
      String(step.order).padStart(4, '0'),
      `ago${step.pattern}`,
      step.kind,
      step.zoneId ?? '',
    ].filter(Boolean).join('-'),
    color: PATTERN_INK[step.pattern],
    polylines: step.polylines,
  }));
}

/** Metri di passaggio di un ago: il filo che non ricama ma serve ad arrivare. */
export function travelMetres(plan: ZonePlan, key: PatternKey): number {
  return plan.travels.filter((t) => t.pattern === key).reduce((sum, t) => sum + t.lengthMm, 0) / 1000;
}

/** Metri di filo di un piano, per ago. Serve a leggere subito se un pattern è troppo fitto. */
export function threadMetres(plan: ZonePlan, key: PatternKey): number {
  let total = 0;
  for (const stitch of plan.stitches) {
    if (stitch.pattern !== key) continue;
    for (const polyline of stitch.polylines) {
      for (let i = 1; i < polyline.length; i++) {
        total += Math.hypot(polyline[i].x - polyline[i - 1].x, polyline[i].y - polyline[i - 1].y);
      }
    }
  }
  return total / 1000;
}

export type { GeneratedPoint };

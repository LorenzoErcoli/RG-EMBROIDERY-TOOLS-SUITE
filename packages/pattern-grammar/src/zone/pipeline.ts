// Da zone a ricamo: per ogni zona si genera il pattern col motore di @rg/pattern-grammar
// e lo si rimette in piano all'angolo scelto per la sua tinta.
//
// L'IDEA CHIAVE — non si ruota il modulo, si ruota il PIANO. Per una zona inclinata di θ:
// si ruota il POLIGONO di -θ, si genera il pattern "dritto" (esattamente come per il
// cannage regolare), e si ruotano indietro i punti di +θ. Il motore non sa niente di
// tutto questo e resta intatto: ritaglio al bordo, punto minimo (R3) e punto massimo (R4)
// continuano a valere come sempre. È il "prendo il pattern e ruoto tutto il blocco".
import { generateFinalPatternPoints } from '../generator/generatePattern.ts';
import type { GeneratedPoint, ImportedBoundary, PatternConfig, Point } from '../grammar/types.ts';
import { enforceMinStitch, type ExportLayer } from '@rg/core';
import { boundsOfPoints, expandOuterEdges, orderZonesRaster, outerEdgeFlags, rotatePoints, type Zone } from './engine.ts';
import { buildEdgeGraph, travelAlongEdges } from './travel.ts';

/**
 * Un pattern = un ago, e i pattern sono QUANTI SERVONO. Lorenzo, 14/09: «i pattern non sono solo
 * 2 ma possono essere più di due». Il nome è una lettera — A, B, C… — che nasce nella mappa
 * colori quando una tinta la sceglie.
 */
export type PatternKey = string;

/** La lettera del pattern numero `index` (0 → A). Oltre la Z si prosegue con P27, P28…: nessun tetto. */
export function patternLetter(index: number): PatternKey {
  return index < 26 ? String.fromCharCode(65 + index) : `P${index + 1}`;
}

/** Posizione di una lettera nella sequenza A, B, … Z, P27, … (le chiavi sconosciute vanno in coda). */
function letterIndex(key: PatternKey): number {
  if (/^[A-Z]$/.test(key)) return key.charCodeAt(0) - 65;
  const extra = /^P(\d+)$/.exec(key);
  return extra ? Number(extra[1]) - 1 : Number.MAX_SAFE_INTEGER;
}

/**
 * Cosa fa una tinta del disegno: quale pattern porta e a che angolo.
 *
 * L'angolo è deciso A MANO e parte sempre da 0°. Lorenzo, 14/09: «ogni colore parte direttamente
 * e sempre da 0 di angolatura, quella la mettiamo a mano». È il contrario della decisione del
 * 03/09 (rotazione misurata sulla zona, con correzione): la misura resta, ma solo come angolo
 * SUGGERITO nella mappa colori — non tocca più il ricamo.
 */
export type ZoneRole = { pattern: PatternKey | 'off' | typeof RELIEF_ROLE; angleDeg: number };

/**
 * Il ruolo delle AREE DI SCARICO. Una tinta così non si ricama e non è un ago: i suoi contorni
 * dicono dove i pattern delle zone sotto hanno meno passate (di solito per il montaggio).
 * Lorenzo, 14/09: «mi chiedono sempre più spesso di scaricare i punti in determinate aree».
 */
export const RELIEF_ROLE = 'scarico';

/**
 * Un ruolo letto da un progetto salvato. Fino al 14/09 il campo era `angleOffsetDeg`, una correzione
 * SOPRA l'angolo misurato: riaprendo, quel numero diventa l'angolo intero. Chi aveva lasciato 0 si
 * ritrova il pattern diritto — che è esattamente la regola nuova.
 */
export function normalizeRole(raw: unknown): ZoneRole {
  const r = (raw ?? {}) as { pattern?: unknown; angleDeg?: unknown; angleOffsetDeg?: unknown };
  const angle = typeof r.angleDeg === 'number' ? r.angleDeg
    : typeof r.angleOffsetDeg === 'number' ? r.angleOffsetDeg : 0;
  return {
    pattern: typeof r.pattern === 'string' && r.pattern ? r.pattern : 'off',
    angleDeg: Number.isFinite(angle) ? angle : 0,
  };
}

/** I pattern in uso nei ruoli, in ordine di lettera: è anche l'ordine degli aghi. */
export function patternKeysInUse(roles: Record<string, ZoneRole>): PatternKey[] {
  const used = new Set<PatternKey>();
  for (const role of Object.values(roles)) {
    if (role?.pattern && role.pattern !== 'off' && role.pattern !== RELIEF_ROLE) used.add(role.pattern);
  }
  return [...used].sort((a, b) => letterIndex(a) - letterIndex(b));
}

/**
 * Cosa può scegliere una tinta: i pattern già in uso, più UNA lettera nuova — la prima libera.
 *
 * È il meccanismo chiesto da Lorenzo: il primo colore vede A; il secondo vede A e B, che compare
 * come nuovo; il terzo A, B e C… Si offre sempre una sola lettera nuova, quindi non si creano
 * pattern vuoti in anticipo; e una lettera rimasta libera (B tolta, A e C in uso) torna a essere
 * quella nuova, al suo posto nell'ordine.
 */
export function patternChoices(roles: Record<string, ZoneRole>): { key: PatternKey; isNew: boolean }[] {
  const used = patternKeysInUse(roles);
  const taken = new Set(used);
  let free = 0;
  while (taken.has(patternLetter(free))) free++;
  return [...used.map((key) => ({ key, isNew: false })), { key: patternLetter(free), isNew: true }]
    .sort((a, b) => letterIndex(a.key) - letterIndex(b.key));
}

/**
 * Colore d'anteprima e d'export di ciascun ago: la PALETTE CATEGORIALE del DS (1.14.1, §4), cioè
 * i sette `--rg-color-category-*` risolti in esadecimale — l'SVG esportato vuole colori concreti,
 * non variabili CSS. Un test li confronta con `tokens.css`, così se il DS li cambia lo si sa.
 * Oltre il settimo si ripetono: il DS lo prescrive («una categoria in più chiede un segno in più,
 * non un colore in più»), e il segno qui c'è già — la lettera nel nome di ogni gruppo esportato.
 * Il filo vero lo sceglie comunque l'operatore in macchina.
 */
export const PATTERN_INKS: string[] = ['#000000', '#36596b', '#8a2e2e', '#7a5a16', '#365c45', '#b79a62', '#89958a'];

export function inkFor(key: PatternKey): string {
  return PATTERN_INKS[letterIndex(key) % PATTERN_INKS.length];
}

export type ZonePlanParams = {
  /** Ruolo per tinta: la mappa che compili nel pannello (02 Colori e ruoli). */
  roles: Record<string, ZoneRole>;
  /** Un `PatternConfig` per ogni lettera in uso: i valori del Generatore pattern. */
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
  /** Angolo applicato: quello scritto a mano per la tinta della zona. */
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
  /** Le lettere in uso, nell'ordine degli aghi. */
  patternOrder: PatternKey[];
  /** Punti tolti dalla pulizia: dice a colpo d'occhio quanto ha inciso. */
  cleanedPoints: number;
  /** Zone ricamate che un'area di scarico tocca: dice se lo scarico è arrivato dove doveva. */
  relievedZones: number;
  /** Un layer per ago, nell'ordine di cucitura. È quello che va in DST. */
  layers: ExportLayer[];
  width: number;
  height: number;
  skipped: number;
  warnings: string[];
};

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
  reliefAreas: Point[][] = [],
): Point[][] {
  const local = rotatePoints(polygon, -angleDeg, zone.centroid);
  const bounds = boundsOfPoints(local);
  const shift = { x: marginMm - bounds.minX, y: marginMm - bounds.minY };
  const toLocal = (points: Point[]) => rotatePoints(points, -angleDeg, zone.centroid)
    .map((point) => ({ x: point.x + shift.x, y: point.y + shift.y }));
  const placed = local.map((point) => ({ x: point.x + shift.x, y: point.y + shift.y }));
  // Le aree di scarico seguono la zona nel suo piano ruotato: sono geometria del disegno come
  // la zona, quindi girano con lei. Si passano solo quelle che la toccano.
  const localRelief = reliefAreas.filter((ring) => boxesOverlap(ring, polygon)).map(toLocal);
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
    reliefAreas: localRelief.length ? localRelief : undefined,
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
 * cambio pattern come cambio ago — tanti aghi quante lettere in uso.
 */
export function buildZonePlan(zones: Zone[], params: ZonePlanParams): ZonePlan {
  const warnings: string[] = [];
  const stitches: ZoneStitch[] = [];
  const order = patternKeysInUse(params.roles);
  let skipped = 0;

  // Le AREE DI SCARICO stanno SOPRA le zone, non accanto: per il bordo esterno e per i
  // passaggi non esistono. Se contassero, un rettangolo di scarico sul fondo farebbe credere
  // interni i lati del perimetro, e i passaggi potrebbero camminare sul suo contorno.
  const isRelief = (zone: Zone) => params.roles[zone.color]?.pattern === RELIEF_ROLE;
  const reliefRings = zones.filter(isRelief).map((zone) => zone.points);
  const solid = zones.filter((zone) => !isRelief(zone));
  let relievedZones = 0;

  // Il MARGINE ESTERNO: le zone sul perimetro si allargano verso fuori prima di essere
  // riempite. Il contorno disegnato resta quello vero — deborda il ricamo, non la sagoma.
  const outer = params.outerMarginMm > 0 ? outerEdgeFlags(solid) : null;
  const fillPolygon = new Map<string, Point[]>();
  if (outer) {
    solid.forEach((zone, i) => {
      fillPolygon.set(zone.id, expandOuterEdges(zone.points, outer[i], params.outerMarginMm));
    });
  }

  for (const key of order) {
    const ofPattern = zones.filter((zone) => params.roles[zone.color]?.pattern === key);
    for (const zone of orderZonesRaster(ofPattern, params.rowHeightMm)) {
      // L'angolo è quello scritto a mano per la tinta; l'inclinazione misurata della zona non
      // entra più nel ricamo (decisione di Lorenzo del 14/09, vedi `ZoneRole`).
      const angleDeg = params.roles[zone.color]?.angleDeg ?? 0;
      let polylines: Point[][] = [];
      const polygon = fillPolygon.get(zone.id) ?? zone.points;
      if ((params.patterns[key]?.reliefPercent ?? 0) > 0 && reliefRings.some((ring) => boxesOverlap(ring, polygon))) {
        relievedZones++;
      }
      try {
        polylines = fillZone(zone, params.patterns[key] ?? {}, angleDeg, params.marginMm,
          polygon, reliefRings).filter((p) => p.length > 1);
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
  const graph = params.travelMode === 'edges' && solid.length ? buildEdgeGraph(solid) : null;
  if (graph) {
    for (const key of order) {
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
  for (const key of order) {
    const blocks = stitches.filter((s) => s.pattern === key);
    const ofPattern = travels.filter((t) => t.pattern === key);
    blocks.forEach((stitch, i) => {
      sequence.push({ order: sequence.length, kind: 'zona', pattern: key, zoneId: stitch.zone.id, polylines: stitch.polylines });
      if (ofPattern[i]) {
        sequence.push({ order: sequence.length, kind: 'passaggio', pattern: key, polylines: [ofPattern[i].points] });
      }
    });
  }

  const layers: ExportLayer[] = order
    .map((key) => ({
      id: `pattern-${key}`,
      color: inkFor(key),
      polylines: sequence.filter((s) => s.pattern === key).flatMap((s) => s.polylines),
    }))
    .filter((layer) => layer.polylines.length > 0);

  const all = zones.flatMap((zone) => zone.points);
  const bounds = all.length ? boundsOfPoints(all) : { maxX: 0, maxY: 0, width: 0, height: 0, minX: 0, minY: 0 };
  if (skipped) warnings.push(`${skipped} zone senza punti: pattern troppo rado per la loro misura?`);

  return {
    stitches, travels, sequence, patternOrder: order, cleanedPoints, relievedZones, layers,
    width: bounds.maxX, height: bounds.maxY, skipped, warnings,
  };
}

/** Due forme si toccano, a grandi linee: bastano i rettangoli d'ingombro per scartare le lontane. */
function boxesOverlap(a: Point[], b: Point[]): boolean {
  const ba = boundsOfPoints(a);
  const bb = boundsOfPoints(b);
  return ba.minX <= bb.maxX && bb.minX <= ba.maxX && ba.minY <= bb.maxY && bb.minY <= ba.maxY;
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
    color: inkFor(step.pattern),
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

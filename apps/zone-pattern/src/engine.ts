// Motore di "Pattern a zone": legge un disegno a ZONE PIENE (una tinta = un ruolo),
// misura l'inclinazione di ogni zona e le mette in sequenza.
//
// Il modello nasce dal cannage Dior di Lorenzo: 6 tinte = 2 PATTERN × 3 FAMIGLIE di
// inclinazione. Rosa/rosso/blu sono lo stesso pattern in tre orientamenti; viola/
// arancio/verde sono l'altro. Il tool non conosce quei colori: conosce "ogni zona ha
// una tinta, ogni tinta ha un pattern e una correzione d'angolo" — il cannage è solo
// il primo caso.
import type { ImportedBoundaryModel, Point } from '@rg/pattern-grammar';

/** Una zona = un poligono chiuso del disegno, con la sua tinta e la sua inclinazione. */
export type Zone = {
  id: string;
  /** Tinta di riempimento nel file: è la chiave con cui si sceglie il pattern. */
  color: string;
  /** Contorno chiuso, in mm reali. */
  points: Point[];
  centroid: Point;
  areaMm2: number;
  /** Inclinazione del reticolo della zona, in gradi [0..90). Misurata, non dichiarata. */
  angleDeg: number;
};

export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return sum / 2;
}

export function polygonCentroid(points: Point[]): Point {
  const area = polygonArea(points);
  if (Math.abs(area) < 1e-9) {
    // Poligono degenere: la media dei vertici è sempre meglio di un NaN.
    const n = Math.max(1, points.length - 1);
    return {
      x: points.slice(0, n).reduce((s, p) => s + p.x, 0) / n,
      y: points.slice(0, n).reduce((s, p) => s + p.y, 0) / n,
    };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const cross = points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
    cx += (points[i].x + points[i + 1].x) * cross;
    cy += (points[i].y + points[i + 1].y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * Inclinazione del RETICOLO della zona, in gradi [0..90).
 *
 * "Ruota il blocco per rispettare le perpendicolari dei rombi" (Lorenzo): la direzione
 * giusta è quella dei LATI, e i lati di un rombo sono due famiglie perpendicolari fra
 * loro. Perpendicolare = stesso reticolo, quindi l'angolo ha periodo 90°, non 360°:
 * si fa la media circolare su `4·θ` e si divide per 4, pesando ogni lato per la sua
 * lunghezza (i lati lunghi contano di più, i tagli corti al bordo non spostano l'asse).
 * Su un rombo a 45° torna 45; su una cella allungata torna la direzione del lato lungo.
 */
export function dominantAngleDeg(points: Point[]): number {
  let sumSin = 0;
  let sumCos = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const angle = Math.atan2(dy, dx);
    sumSin += length * Math.sin(4 * angle);
    sumCos += length * Math.cos(4 * angle);
  }
  if (sumSin === 0 && sumCos === 0) return 0;
  const mean = Math.atan2(sumSin, sumCos) / 4;
  const deg = ((mean * 180) / Math.PI) % 90;
  return deg < 0 ? deg + 90 : deg;
}

/** Differenza fra due angoli con periodo 90°, in [-45..45]. */
export function angleDelta90(a: number, b: number): number {
  const d = ((((a - b) % 90) + 135) % 90) - 45;
  return d;
}

/**
 * Angolo di riferimento di una FAMIGLIA (tutte le zone di una tinta), pesato sull'AREA.
 *
 * Serve perché `dominantAngleDeg` da sola sbaglia sulle zone rifilate al bordo: un rombo
 * tagliato dal ventaglio ha lati di taglio lunghi, che tirano la media dove vogliono loro
 * (misurato sul cannage: una scheggia arancione dava 86.3° in una famiglia da 15°).
 * Le CELLE PIENE hanno l'area grande e l'angolo giusto, le schegge hanno area minuscola:
 * pesare sull'area lascia decidere alle celle piene.
 */
export function familyAngleDeg(zones: Zone[]): number {
  let sumSin = 0;
  let sumCos = 0;
  for (const zone of zones) {
    const rad = (zone.angleDeg * Math.PI) / 180;
    sumSin += zone.areaMm2 * Math.sin(4 * rad);
    sumCos += zone.areaMm2 * Math.cos(4 * rad);
  }
  if (sumSin === 0 && sumCos === 0) return zones[0]?.angleDeg ?? 0;
  const deg = ((Math.atan2(sumSin, sumCos) / 4) * 180) / Math.PI % 90;
  return deg < 0 ? deg + 90 : deg;
}

/**
 * L'angolo della singola zona, raffinato sul riferimento della famiglia: si rifà la media
 * usando SOLO i lati che stanno entro `toleranceDeg` dal riferimento — cioè i lati veri
 * del rombo, non i tagli del bordo. Se non ne resta nessuno (zona tutta di taglio) vince
 * il riferimento. Così il pattern segue la deformazione del ventaglio cella per cella,
 * senza inseguire il rumore.
 */
export function refineAngleDeg(points: Point[], referenceDeg: number, toleranceDeg: number): number {
  let sumSin = 0;
  let sumCos = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (Math.abs(angleDelta90(deg, referenceDeg)) > toleranceDeg) continue;
    const rad = (deg * Math.PI) / 180;
    sumSin += length * Math.sin(4 * rad);
    sumCos += length * Math.cos(4 * rad);
  }
  if (sumSin === 0 && sumCos === 0) return referenceDeg;
  const deg = ((Math.atan2(sumSin, sumCos) / 4) * 180) / Math.PI % 90;
  return deg < 0 ? deg + 90 : deg;
}

/**
 * Quanto una cella è ALLUNGATA: 1 = quadrata/rombica, grande = striscia sottile.
 * Si ricava dai momenti secondi dei vertici (il rapporto fra i due assi della forma).
 */
export function cellElongation(points: Point[]): number {
  const v = points.slice(0, points.length - 1);
  if (v.length < 3) return 1;
  const cx = v.reduce((s, p) => s + p.x, 0) / v.length;
  const cy = v.reduce((s, p) => s + p.y, 0) / v.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of v) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const half = (sxx + syy) / 2;
  const gap = Math.hypot((sxx - syy) / 2, sxy);
  return half - gap > 1e-9 ? Math.sqrt((half + gap) / (half - gap)) : Infinity;
}

/** Soglia oltre la quale una cella è una STRISCIA e non un rombo. Misurata sul cannage:
 *  rombi 1.0–2.1, strisce di transizione 5.6 — in mezzo non c'è niente, la soglia è comoda. */
export const STRIP_ELONGATION = 3;

/**
 * L'asse del pattern dentro una cella: **la diagonale del rombo, non il suo lato.**
 *
 * Lorenzo, guardando il primo risultato: «gli altri li hai girati troppo, di 45 gradi in più
 * del necessario, perché le linee devono essere verticali al rombo non al quadrato». Ha
 * ragione: in un cannage i cordoncini corrono da vertice a vertice, e i lati della cella
 * stanno a 45° da loro. Misurare i lati (che è il modo robusto di leggere il reticolo) dà
 * quindi un angolo che va poi RUOTATO DI 45°.
 *
 * L'eccezione sono le celle a striscia: lì non c'è nessun rombo, il pattern corre per il
 * lungo, e i lati lunghi SONO già l'asse giusto. Il discriminante è l'allungamento —
 * misurato sul cannage: rombi 1.0–2.1, strisce 5.6, e infatti erano proprio le strisce
 * rossa e arancione le uniche già giuste.
 */
export function familyAxisShiftDeg(zones: Zone[]): number {
  // Mediana PESATA SULL'AREA, non semplice: le schegge rifilate al bordo sono tante e corte,
  // e la loro forma non dice niente della famiglia. Misurato: la famiglia arancione ha
  // mediana semplice 2.22 (→ sarebbe passata per rombo) ma pesata sull'area 4.7 (striscia,
  // che è quello che è). È la stessa medicina già usata per l'angolo di riferimento.
  const sorted = zones
    .map((z) => ({ elongation: cellElongation(z.points), area: z.areaMm2 }))
    .sort((a, b) => a.elongation - b.elongation);
  const total = sorted.reduce((sum, z) => sum + z.area, 0);
  if (!total) return -45;
  let seen = 0;
  let median = sorted.at(-1)!.elongation;
  for (const z of sorted) {
    seen += z.area;
    if (seen >= total / 2) { median = z.elongation; break; }
  }
  return median >= STRIP_ELONGATION ? 0 : -45;
}

/**
 * Assegna a ogni zona l'angolo definitivo: riferimento di famiglia (per tinta) + raffinamento
 * sulla singola zona + lo scarto di 45° che porta dai lati alla diagonale dove serve.
 * `toleranceDeg` a 0 blocca tutte le zone della tinta sul riferimento (le inclinazioni "a
 * blocchi"); alzandola le zone tornano libere di seguire la propria deformazione.
 */
export function resolveZoneAngles(zones: Zone[], toleranceDeg = 20): Zone[] {
  const families = new Map<string, Zone[]>();
  for (const zone of zones) families.set(zone.color, [...(families.get(zone.color) ?? []), zone]);
  const reference = new Map<string, number>();
  const shift = new Map<string, number>();
  for (const [color, group] of families) {
    reference.set(color, familyAngleDeg(group));
    // Lo scarto si decide per FAMIGLIA, non per zona: dentro una tinta le celle sono la
    // stessa cosa, e una scheggia rifilata non deve cambiare regola alle sue sorelle.
    shift.set(color, familyAxisShiftDeg(group));
  }
  return zones.map((zone) => {
    const ref = reference.get(zone.color) ?? zone.angleDeg;
    const onEdges = toleranceDeg > 0 ? refineAngleDeg(zone.points, ref, toleranceDeg) : ref;
    return { ...zone, angleDeg: onEdges + (shift.get(zone.color) ?? 0) };
  });
}

/** La sola geometria di una zona: quanto basta a ricostruirla. È ciò che si salva nel file. */
export type ZoneShape = { id: string; color: string; points: Point[] };

/** Da geometria a zona: tutto il resto (centro, area, angolo) si MISURA, non si conserva. */
export function makeZone(shape: ZoneShape): Zone {
  return {
    ...shape,
    centroid: polygonCentroid(shape.points),
    areaMm2: Math.abs(polygonArea(shape.points)),
    angleDeg: dominantAngleDeg(shape.points),
  };
}

/**
 * Ricostruisce le zone dalla sola geometria (è la strada del "riapri progetto").
 *
 * Si ricalcola tutto invece di conservare i valori: se una regola di misura migliora, il
 * progetto riaperto ne gode. Congelare gli angoli dentro il file vorrebbe dire riaprire
 * anche i difetti del giorno in cui è stato salvato.
 */
export function zonesFromShapes(shapes: ZoneShape[], minAreaMm2 = 0): Zone[] {
  return shapes
    .filter((s) => Array.isArray(s?.points) && s.points.length >= 4)
    .map(makeZone)
    .filter((z) => z.areaMm2 >= minAreaMm2);
}

/** Le zone del disegno: ogni path chiuso di ogni tinta diventa una zona a sé. */
export function readZones(model: ImportedBoundaryModel, minAreaMm2 = 0): Zone[] {
  const shapes: ZoneShape[] = [];
  for (const choice of model.choices) {
    for (const path of choice.boundary.paths) {
      if (!path.closed || path.points.length < 4) continue;
      shapes.push({ id: path.id, color: path.color ?? choice.color ?? '#000000', points: path.points });
    }
  }
  return zonesFromShapes(shapes, minAreaMm2);
}

/**
 * L'ordine di cucitura chiesto da Lorenzo: "si parte da sinistra e si arriva a destra,
 * poi si ricomincia a sinistra e si torna a destra, a righe". Quindi RASTER, non
 * serpentina: ogni riga riparte da sinistra.
 *
 * Le righe non sono date dal file: si ricavano raggruppando i centri per fascia
 * orizzontale. L'altezza della fascia è `rowHeightMm`; se non la si dà, si usa la
 * mediana delle altezze delle zone — la misura del disegno stesso, non un numero fisso.
 */
export function orderZonesRaster(zones: Zone[], rowHeightMm?: number): Zone[] {
  if (zones.length <= 1) return zones.slice();
  const band = rowHeightMm && rowHeightMm > 0 ? rowHeightMm : medianZoneHeight(zones);
  const row = (zone: Zone) => Math.round(zone.centroid.y / band);
  return zones
    .slice()
    .sort((a, b) => (row(a) - row(b)) || (a.centroid.x - b.centroid.x) || (a.centroid.y - b.centroid.y));
}

function medianZoneHeight(zones: Zone[]): number {
  const heights = zones
    .map((zone) => {
      const ys = zone.points.map((p) => p.y);
      let lo = Infinity, hi = -Infinity;
      for (const y of ys) { if (y < lo) lo = y; if (y > hi) hi = y; }
      return hi - lo;
    })
    .sort((a, b) => a - b);
  return Math.max(0.001, heights[Math.floor(heights.length / 2)]);
}

/**
 * Quali lati di ogni zona stanno sul BORDO ESTERNO del disegno.
 *
 * Un lato in comune fra due rombi compare due volte fra tutte le zone; un lato del perimetro
 * compare una volta sola. È la distinzione che serve per il margine: solo i lati esterni si
 * possono allargare — allargare anche quelli interni farebbe sovrapporre i pattern di due
 * zone vicine, cioè filo doppio proprio dove il disegno è già pieno.
 */
export function outerEdgeFlags(zones: Zone[], probeMm = 0.4): boolean[][] {
  // Confrontare i lati per VERTICI non funziona: Illustrator disegna ogni rombo per conto suo
  // e i rombi rifilati spezzano il lato in modo diverso dal vicino. Misurato sul cannage: solo
  // 64 lati su 327 combaciano, e gli altri 263 sarebbero passati per "esterni" pur essendo in
  // mezzo al disegno. Quindi si chiede alla GEOMETRIA: si sporge di un soffio oltre il lato e
  // si guarda se si finisce dentro un'altra zona. Se sì, di là c'è ricamo: quel lato è interno.
  return zones.map((zone) => {
    const flags: boolean[] = [];
    for (let i = 1; i < zone.points.length; i++) {
      const a = zone.points[i - 1];
      const b = zone.points[i];
      // "Fuori" non si deduce dal verso di avvolgimento (in SVG la y cresce all'ingiù e il
      // ragionamento si ribalta): si prova, e se il punto di prova cade DENTRO la zona stessa
      // vuol dire che si è andati dalla parte sbagliata.
      const probe = probePoint(a, b, probeMm);
      const outside = pointInPolygon(probe, zone.points) ? probePoint(a, b, -probeMm) : probe;
      flags.push(!zones.some((other) => other !== zone && pointInPolygon(outside, other.points)));
    }
    return flags;
  });
}

/** Il punto a distanza `offsetMm` dal centro del lato a→b, sulla sua perpendicolare. */
function probePoint(a: Point, b: Point, offsetMm: number): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return {
    x: (a.x + b.x) / 2 + ((b.y - a.y) / length) * offsetMm,
    y: (a.y + b.y) / 2 - ((b.x - a.x) / length) * offsetMm,
  };
}

export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length - 1; j = i++) {
    if (((polygon[i].y > p.y) !== (polygon[j].y > p.y))
      && (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * La zona allargata di `marginMm` sui soli lati esterni (il margine chiesto da Lorenzo, lo
 * stesso mestiere dell'`overflowMarginMm` di oblique: il ricamo non si ferma esatto sul filo
 * del bordo, deborda un po', così al taglio e al montaggio non resta scoperto).
 *
 * Si spostano le RETTE dei lati esterni verso fuori e si ricalcolano i vertici come loro
 * intersezione: spostare i vertici uno a uno aprirebbe delle fessure negli angoli.
 */
export function expandOuterEdges(points: Point[], outer: boolean[], marginMm: number): Point[] {
  // Zona tutta interna: si restituisce l'originale IDENTICO, non una sua ricostruzione.
  // Ricostruirla darebbe punti diversi all'ultima cifra, e "identico" deve voler dire identico.
  if (marginMm <= 0 || points.length < 4 || !outer.some(Boolean)) return points;

  const build = (sign: number): Point[] => {
    const n = points.length - 1;                  // l'ultimo ripete il primo
    type Line = { px: number; py: number; dx: number; dy: number };
    const lines: Line[] = [];
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dx = (b.x - a.x) / length;
      const dy = (b.y - a.y) / length;
      const shift = outer[i] ? marginMm * sign : 0;
      lines.push({ px: a.x + dy * shift, py: a.y - dx * shift, dx, dy });
    }
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      const previous = lines[(i - 1 + n) % n];
      const current = lines[i];
      const cross = previous.dx * current.dy - previous.dy * current.dx;
      if (Math.abs(cross) < 1e-9) {
        // Lati paralleli (angolo piatto): l'intersezione non c'è, si tiene il punto spostato.
        out.push({ x: current.px, y: current.py });
        continue;
      }
      const t = ((current.px - previous.px) * current.dy - (current.py - previous.py) * current.dx) / cross;
      const meeting = { x: previous.px + previous.dx * t, y: previous.py + previous.dy * t };
      // TETTO ALLA PUNTA. Dove due lati si incontrano ad angolo acuto, il loro incrocio
      // spostato schizza lontanissimo: misurato, un margine di 3mm produceva punte da 7.55mm
      // sulla punta del ventaglio. "3mm di margine" deve voler dire 3mm dappertutto, quindi
      // il vertice si tira indietro sulla stessa direzione fino alla misura chiesta.
      const origin = points[i];
      const reach = Math.hypot(meeting.x - origin.x, meeting.y - origin.y);
      out.push(reach > marginMm && reach > 1e-9
        ? {
          x: origin.x + (meeting.x - origin.x) * (marginMm / reach),
          y: origin.y + (meeting.y - origin.y) * (marginMm / reach),
        }
        : meeting);
    }
    out.push(out[0]);
    return out;
  };

  // Il verso "fuori" non si deduce dall'avvolgimento (in SVG la y cresce all'ingiù): si
  // costruiscono tutte e due e si tiene quella che è CRESCIUTA. Un margine che rimpicciolisce
  // la zona non è un margine, è un rientro — ed è l'errore che si farebbe a occhio.
  const grown = build(1);
  return Math.abs(polygonArea(grown)) >= Math.abs(polygonArea(points)) ? grown : build(-1);
}

/** Rotazione di `points` di `deg` attorno a `pivot`. È l'unica trasformazione del tool. */
export function rotatePoints<T extends Point>(points: T[], deg: number, pivot: Point): T[] {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((point) => {
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    return { ...point, x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
  });
}

/** Ingombro. A ciclo, non con lo spread: su liste lunghe lo spread fa saltare lo stack
 *  (è il difetto già pagato in `boundsOf` dell'importer sul file da 2MB). */
export function boundsOfPoints(points: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

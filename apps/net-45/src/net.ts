// Costruzione della rete di cordoncini a 45° — TRAVERSATA ESATTA, come PERCORSO CONTINUO.
//
// BINARIO (diagonale intera) = "/"; PIOLI = l'altra direzione ("\"). Sweep SINISTRA → DESTRA.
// Per ogni binario, da cima (y minore) a fondo:
//   - ci si porta sul nodo (passaggio), ANDATA lungo il piolo fino al fondo, RITORNO con cordoncino;
//   - si scende al nodo successivo;
// poi RISALITA con cordoncino sul binario; poi spostamento al binario successivo.
//
// Percorso CONTINUO (R26): una "penna" tiene la posizione corrente; ogni cordoncino è preceduto dal
// passaggio che lo raggiunge (consecutività garantita). I passaggi che uscirebbero dalla sagoma
// costeggiano il perimetro (routeTravel).
import {
  type Polyline, type Point, type NetParams, type Bounds,
  generateFamily, clipSegment, buildCordoncino, routeTravel, routeAlongBorder,
  bounds as boundsOf, insetPolygon, segmentIntersection, pointInPolygon, distance,
} from '@rg/core';

export interface NetResult {
  /** Filo CONTINUO: cordoncino → passaggio → cordoncino → passaggio… in un'unica polilinea (R26). */
  path: Polyline;
}

interface RailNode { p: Point; q: Point | null; }

const dirOf = (deg: number): Point => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function buildNet(boundary: Polyline, exclusions: Polyline[], params: NetParams): NetResult {
  const bnds: Bounds = boundsOf(boundary);
  const center: Point = { x: (bnds.minX + bnds.maxX) / 2, y: (bnds.minY + bnds.maxY) / 2 };
  const spacing = Math.max(1, params.squareSizeMm);
  const clipBoundary = insetPolygon(boundary, params.netInsetMm);
  const inside = (p: Point) =>
    pointInPolygon(p, clipBoundary) && !exclusions.some((ex) => pointInPolygon(p, ex));

  // BINARIO = diagonale "/" (dir.x·dir.y < 0); PIOLI = l'altra.
  const dA = dirOf(params.angleADeg);
  const railAngle = dA.x * dA.y < 0 ? params.angleADeg : params.angleBDeg;
  const rungAngle = railAngle === params.angleADeg ? params.angleBDeg : params.angleADeg;

  // Spostamento della griglia rispetto al DXF (X/Y).
  const origin: Point = { x: center.x + params.netOffsetXMm, y: center.y + params.netOffsetYMm };
  const rails = generateFamily(railAngle, spacing, bnds, origin, 'A')
    .slice()
    .sort((r1, r2) => mid(r1.a, r1.b).x - mid(r2.a, r2.b).x);
  const rungs = generateFamily(rungAngle, spacing, bnds, origin, 'B');

  const path: Point[] = [];
  let pen: Point | null = null;

  // Aggiunge punti al filo continuo, evitando il doppione nel punto di giunzione.
  const append = (pts: Point[]) => {
    if (!pts.length) return;
    let start = 0;
    if (path.length && distance(path[path.length - 1], pts[0]) < 1e-4) start = 1;
    for (let i = start; i < pts.length; i++) path.push(pts[i]);
  };
  // Penna: raggiunge un punto con un PASSAGGIO (consecutivo, sul bordo se serve).
  const goTravel = (to: Point) => {
    if (pen && distance(pen, to) > 1e-4) {
      append(routeTravel(pen, to, clipBoundary, params.travelStitchMm));
    } else if (!pen) {
      path.push(to);
    }
    pen = to;
  };
  // CORDONCINO da a a b, preceduto dal passaggio che porta ad a → filo continuo.
  const goCord = (a: Point, b: Point) => {
    goTravel(a);
    append(buildCordoncino(a, b, params.cordWidthMm, params.cordDensityMm));
    pen = b;
  };

  for (let i = 0; i < rails.length; i++) {
    const rail = rails[i];
    const railNext = i + 1 < rails.length ? rails[i + 1] : null;

    const nodes: RailNode[] = [];
    for (const B of rungs) {
      const hitP = segmentIntersection(rail.a, rail.b, B.a, B.b);
      if (!hitP || !inside(hitP.point)) continue;
      let q: Point | null = null;
      if (railNext) {
        const hitQ = segmentIntersection(railNext.a, railNext.b, B.a, B.b);
        if (hitQ) q = hitQ.point;
      }
      nodes.push({ p: hitP.point, q });
    }
    nodes.sort((a, b) => a.p.y - b.p.y); // cima → fondo
    if (!nodes.length) continue;

    // Passaggio inter-diagonale: SEMPRE sul bordo (costeggia il contorno, poi entra al primo piolo).
    if (pen) { append(routeAlongBorder(pen, nodes[0].p, clipBoundary, params.travelStitchMm)); pen = nodes[0].p; }

    // Discesa: per ogni nodo, piolo (andata travel + ritorno cordoncino).
    for (const node of nodes) {
      goTravel(node.p); // scivola/arriva sul nodo
      if (node.q) {
        const runs = clipSegment(node.p, node.q, clipBoundary, exclusions);
        if (runs.length) {
          const far = runs[0][1];
          if (distance(node.p, far) > 0.5) goCord(far, node.p); // andata (travel) + ritorno cordoncino
        }
      }
    }

    // Risalita: il binario, cordoncino fondo → cima. Prende il tratto più lungo interno.
    const railRuns = clipSegment(rail.a, rail.b, clipBoundary, exclusions)
      .map(([a, b]) => (a.y >= b.y ? [a, b] : [b, a]) as [Point, Point]) // [fondo, cima]
      .sort((r1, r2) => distance(r2[0], r2[1]) - distance(r1[0], r1[1]));
    if (railRuns.length) {
      const [fondo, cima] = railRuns[0];
      goCord(fondo, cima);
    }
  }

  return { path };
}

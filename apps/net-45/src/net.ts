// Rete a 45° BASATA SU CELLE, che ARRIVA AI BORDI.
// La griglia (binari "/" × pioli "\") definisce celle-diamante con stato: 'rete'/'raso'/'escluso'.
// Automazione: celle entro `rasoBandMm` dal bordo → RASO (solo bordi rivolti in basso/lati se rasoDownwardOnly).
// La rete (binari + pioli) è CLIPPATA AL PERIMETRO nelle zone di rete → i cordoncini toccano i bordi
// (anche in cima, per incastrarci lo strass). Filo continuo (penna), passaggi sul binario/bordo (R26,R27).
import {
  type Polyline, type Point, type NetParams, type Bounds,
  generateFamily, clipSegment, buildCordoncino, routeTravel, routeAlongBorder,
  bounds as boundsOf, insetPolygon, lineIntersection, pointInPolygon, distance,
  distanceToBoundary, nearestEdgeNormal, unit,
} from '@rg/core';

export type CellState = 'rete' | 'raso' | 'escluso';

export interface NetResult {
  path: Polyline;
  rasoShapes: Polyline[];
}

const dirOf = (deg: number): Point => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function buildNet(boundary: Polyline, exclusions: Polyline[], params: NetParams): NetResult {
  const bnds: Bounds = boundsOf(boundary);
  const center: Point = { x: (bnds.minX + bnds.maxX) / 2, y: (bnds.minY + bnds.maxY) / 2 };
  const spacing = Math.max(1, params.squareSizeMm);
  const clipBoundary = insetPolygon(boundary, params.netInsetMm);
  const inside = (p: Point) =>
    pointInPolygon(p, clipBoundary) && !exclusions.some((ex) => pointInPolygon(p, ex));

  // Stato della cella che contiene il punto p.
  const stateAt = (p: Point): CellState => {
    if (!inside(p)) return 'escluso';
    const nearBand = params.rasoBandMm > 0 && distanceToBoundary(p, clipBoundary) < params.rasoBandMm;
    const facingOk = params.rasoDownwardOnly ? nearestEdgeNormal(p, clipBoundary).y > -0.3 : true;
    return nearBand && facingOk ? 'raso' : 'rete';
  };

  // Un lato del reticolo si disegna se UNA delle due celle adiacenti è 'rete'
  // (controlla i due lati offsettando perpendicolarmente di ~mezza cella). Così i quadrati si CHIUDONO
  // e i lati sul confine rete/raso e sul bordo vengono disegnati.
  const off = spacing * 0.45;
  const edgeBordersRete = (m: Point, dir: Point): boolean => {
    const n = { x: -dir.y, y: dir.x };
    return stateAt({ x: m.x + n.x * off, y: m.y + n.y * off }) === 'rete'
      || stateAt({ x: m.x - n.x * off, y: m.y - n.y * off }) === 'rete';
  };

  const dA = dirOf(params.angleADeg);
  const railAngle = dA.x * dA.y < 0 ? params.angleADeg : params.angleBDeg; // "/"
  const rungAngle = railAngle === params.angleADeg ? params.angleBDeg : params.angleADeg; // "\"
  const origin: Point = { x: center.x + params.netOffsetXMm, y: center.y + params.netOffsetYMm };

  const rails = generateFamily(railAngle, spacing, bnds, origin, 'A').sort((r1, r2) => mid(r1.a, r1.b).x - mid(r2.a, r2.b).x);
  const rungs = generateFamily(rungAngle, spacing, bnds, origin, 'B').sort((r1, r2) => mid(r1.a, r1.b).x - mid(r2.a, r2.b).x);
  const NA = rails.length, NB = rungs.length;

  const node: (Point | null)[][] = [];
  const nIn: boolean[][] = [];
  for (let a = 0; a < NA; a++) {
    node[a] = []; nIn[a] = [];
    for (let b = 0; b < NB; b++) {
      const p = lineIntersection(rails[a].a, rails[a].b, rungs[b].a, rungs[b].b);
      node[a][b] = p; nIn[a][b] = !!p && inside(p);
    }
  }

  // Celle → diamanti di RASO (forme).
  const rasoShapes: Polyline[] = [];
  for (let a = 0; a < NA - 1; a++) {
    for (let b = 0; b < NB - 1; b++) {
      const c00 = node[a][b], c10 = node[a + 1][b], c11 = node[a + 1][b + 1], c01 = node[a][b + 1];
      if (!c00 || !c10 || !c11 || !c01) continue;
      const ctr = { x: (c00.x + c10.x + c11.x + c01.x) / 4, y: (c00.y + c10.y + c11.y + c01.y) / 4 };
      if (stateAt(ctr) === 'raso') rasoShapes.push([c00, c10, c11, c01, c00]);
    }
  }

  // --- Filo continuo ---
  const path: Point[] = [];
  let pen: Point | null = null;
  const append = (pts: Point[]) => {
    if (!pts.length) return;
    const s = path.length && distance(path[path.length - 1], pts[0]) < 1e-4 ? 1 : 0;
    for (let i = s; i < pts.length; i++) path.push(pts[i]);
  };
  const goTravel = (to: Point) => {
    if (pen && distance(pen, to) > 1e-4) append(routeTravel(pen, to, clipBoundary, params.travelStitchMm));
    else if (!pen) path.push(to);
    pen = to;
  };
  const goCord = (a: Point, b: Point) => {
    goTravel(a);
    append(buildCordoncino(a, b, params.cordWidthMm, params.cordDensityMm));
    pen = b;
  };

  for (let a = 0; a < NA; a++) {
    const bList: number[] = [];
    for (let b = 0; b < NB; b++) if (nIn[a][b]) bList.push(b);
    bList.sort((x, y) => node[a][x]!.y - node[a][y]!.y);
    if (!bList.length) continue;

    if (pen) { append(routeAlongBorder(pen, node[a][bList[0]]!, clipBoundary, params.travelStitchMm)); pen = node[a][bList[0]]!; }

    // Pioli: dal nodo verso il binario successivo, clippati al bordo; disegnati se il lato confina con rete.
    for (const b of bList) {
      let rd = { x: rungs[b].b.x - rungs[b].a.x, y: rungs[b].b.y - rungs[b].a.y };
      const rl = Math.hypot(rd.x, rd.y) || 1; rd = { x: rd.x / rl, y: rd.y / rl };
      if (rd.x < 0) rd = { x: -rd.x, y: -rd.y }; // verso il binario successivo (+x)
      const far = { x: node[a][b]!.x + rd.x * spacing, y: node[a][b]!.y + rd.y * spacing };
      const runs = clipSegment(node[a][b]!, far, clipBoundary, exclusions);
      if (!runs.length) continue;
      const end = runs[0][1];
      if (distance(node[a][b]!, end) <= 0.5 || !edgeBordersRete(mid(node[a][b]!, end), rd)) continue;
      goTravel(node[a][b]!);
      goCord(end, node[a][b]!);
    }

    // Risalita: segmenti del binario tra nodi consecutivi + STUB fino al bordo, se il lato confina con rete.
    // (Controllo al punto medio del segmento, ben dentro la cella → niente frammentazione / interruzioni.)
    const rDir = unit(rails[a].a, rails[a].b);
    const segs: [Point, Point][] = [];
    for (let bi = 0; bi < bList.length - 1; bi++) {
      const p0 = node[a][bList[bi]]!, p1 = node[a][bList[bi + 1]]!;
      if (edgeBordersRete(mid(p0, p1), rDir)) segs.push([p0, p1]);
    }
    // Stub verso il bordo: dal nodo estremo (cima/fondo) al punto del binario clippato sul perimetro.
    const railRuns = clipSegment(rails[a].a, rails[a].b, clipBoundary, exclusions);
    if (railRuns.length) {
      const ends = railRuns.flat();
      let top = ends[0], bot = ends[0];
      for (const e of ends) { if (e.y < top.y) top = e; if (e.y > bot.y) bot = e; }
      const topNode = node[a][bList[0]]!, botNode = node[a][bList[bList.length - 1]]!;
      if (distance(top, topNode) > 0.5 && edgeBordersRete(mid(top, topNode), rDir)) segs.push([top, topNode]);
      if (distance(bot, botNode) > 0.5 && edgeBordersRete(mid(bot, botNode), rDir)) segs.push([bot, botNode]);
    }
    // Orienta fondo→cima e cuce dal più in basso.
    const oriented = segs.map(([p, q]) => (p.y >= q.y ? [p, q] : [q, p]) as [Point, Point]);
    oriented.sort((s1, s2) => s2[0].y - s1[0].y);
    for (const [f, c] of oriented) goCord(f, c);
  }

  return { path, rasoShapes };
}

// I PASSAGGI: come il filo va da una zona alla successiva.
//
// Lorenzo: «sarebbe incredibile se si riuscisse anche a prevedere i passaggi, cioè impunture
// che si muovono sui bordi dei rombi o all'esterno delle forme». Non un salto a filo alzato:
// una IMPUNTURA vera, che cammina dove non dà fastidio — sul bordo dei rombi, dove il filo
// sparisce nella riga di giunzione, invece che tagliare in mezzo al ricamo.
//
// Il core sa già costeggiare UN contorno (`routeAlongBorder`, R5). Qui la domanda è un'altra:
// i bordi di tutte le zone formano una RETE, e si cerca la strada più corta dentro quella rete.
// È un problema di grafo, non di poligono: sta qui in locale finché non lo chiede un secondo
// tool (regola di crescita 2), e allora si promuove nel core.
import type { Point } from '@rg/pattern-grammar';
import type { Zone } from './engine';

// La "pulizia punti" NON si riscrive qui: `enforceMinStitch` sta nel core e risponde già a
// questa domanda (R28 — stessa domanda, stessa risposta). Riscriverla avrebbe creato la
// seconda implementazione di R3 nel repo, che è precisamente quello che la Costituzione vieta.
// Scoperto sbattendoci: la mia copia oscurava quella del core e ne rompeva il test.
export { enforceMinStitch } from '@rg/core';

type NodeId = number;
type Edge = { to: NodeId; cost: number };

export type EdgeGraph = {
  points: Point[];
  adjacency: Edge[][];
  /** Passo della griglia con cui i vertici vicini vengono considerati lo stesso nodo. */
  weldMm: number;
};

const key = (p: Point, weld: number) => `${Math.round(p.x / weld)}|${Math.round(p.y / weld)}`;

/**
 * La rete dei bordi: ogni lato di ogni zona è un arco, i vertici che coincidono (a meno di
 * `weldMm`) sono lo stesso nodo. Due rombi che si toccano condividono così i loro vertici, ed
 * è quello che rende la rete percorribile da una parte all'altra del disegno.
 */
export function buildEdgeGraph(zones: Zone[], weldMm = 0.15): EdgeGraph {
  const points: Point[] = [];
  const adjacency: Edge[][] = [];
  const index = new Map<string, NodeId>();

  const node = (p: Point): NodeId => {
    const k = key(p, weldMm);
    const found = index.get(k);
    if (found !== undefined) return found;
    const id = points.length;
    points.push(p);
    adjacency.push([]);
    index.set(k, id);
    return id;
  };

  const link = (a: NodeId, b: NodeId) => {
    if (a === b) return;
    const cost = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
    if (!adjacency[a].some((e) => e.to === b)) adjacency[a].push({ to: b, cost });
    if (!adjacency[b].some((e) => e.to === a)) adjacency[b].push({ to: a, cost });
  };

  for (const zone of zones) {
    for (let i = 1; i < zone.points.length; i++) link(node(zone.points[i - 1]), node(zone.points[i]));
  }
  return { points, adjacency, weldMm };
}

/**
 * Il punto della rete più vicino a `p`, e i due nodi del lato su cui cade.
 *
 * Si entra nella rete DOVE SI È, non dal vertice più vicino: puntare al vertice fa tagliare
 * l'angolo del rombo (misurato: fino a 1.05mm dentro il ricamo). Proiettando sul lato, il filo
 * sale sul bordo lì dove si trova e poi cammina — che è quello che fa una mano.
 */
function enterNetwork(graph: EdgeGraph, p: Point): { at: Point; ends: NodeId[] } | undefined {
  let best: { at: Point; ends: NodeId[] } | undefined;
  let bestDistance = Infinity;
  for (let a = 0; a < graph.adjacency.length; a++) {
    for (const edge of graph.adjacency[a]) {
      if (edge.to < a) continue;                       // ogni lato una volta sola
      const p0 = graph.points[a];
      const p1 = graph.points[edge.to];
      const l2 = (p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - p0.x) * (p1.x - p0.x) + (p.y - p0.y) * (p1.y - p0.y)) / l2)) : 0;
      const at = { x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) };
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d < bestDistance) { bestDistance = d; best = { at, ends: [a, edge.to] }; }
    }
  }
  return best;
}

/** Dijkstra sulla rete dei bordi. Grafo piccolo (qualche centinaio di archi): basta e avanza. */
function shortestPath(graph: EdgeGraph, from: NodeId, to: NodeId): NodeId[] | undefined {
  const distance = new Float64Array(graph.points.length).fill(Infinity);
  const previous = new Int32Array(graph.points.length).fill(-1);
  const visited = new Uint8Array(graph.points.length);
  distance[from] = 0;
  for (;;) {
    let current = -1;
    let best = Infinity;
    for (let i = 0; i < distance.length; i++) {
      if (!visited[i] && distance[i] < best) { best = distance[i]; current = i; }
    }
    if (current < 0) break;
    if (current === to) break;
    visited[current] = 1;
    for (const edge of graph.adjacency[current]) {
      const candidate = distance[current] + edge.cost;
      if (candidate < distance[edge.to]) { distance[edge.to] = candidate; previous[edge.to] = current; }
    }
  }
  if (distance[to] === Infinity) return undefined;
  const path: NodeId[] = [];
  for (let at: number = to; at >= 0; at = previous[at]) {
    path.push(at);
    if (at === from) break;
  }
  return path.reverse();
}

/** Spezza i tratti lunghi: un passaggio è fatto di punti, non di un salto (R4). */
export function resample(points: Point[], stitchMm: number): Point[] {
  if (stitchMm <= 0 || points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const parts = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stitchMm);
    for (let k = 1; k <= parts; k++) {
      out.push({ x: a.x + (b.x - a.x) * (k / parts), y: a.y + (b.y - a.y) * (k / parts) });
    }
  }
  return out;
}

/**
 * Il passaggio da `from` a `to` che cammina SUI BORDI.
 *
 * Si entra nella rete dal nodo più vicino alla partenza, si esce da quello più vicino
 * all'arrivo, e in mezzo si va per la strada più corta fra i lati dei rombi. I due tratti
 * agli estremi (dal punto al nodo) sono gli unici che attraversano, e sono corti per
 * costruzione: partenza e arrivo stanno già sul bordo della propria zona.
 *
 * Se la rete non collega i due punti (zone staccate) si torna alla linea dritta: meglio un
 * passaggio onesto che nessun passaggio.
 */
export function travelAlongEdges(graph: EdgeGraph, from: Point, to: Point, stitchMm: number): Point[] {
  const start = enterNetwork(graph, from);
  const end = enterNetwork(graph, to);
  if (!start || !end) return resample([from, to], stitchMm);

  // Si entra e si esce sui due lati proiettati; in mezzo si sceglie, fra le quattro
  // combinazioni di estremi, quella che costa meno filo.
  const span = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  let best: { cost: number; way: Point[] } | undefined;
  for (const a of start.ends) {
    for (const b of end.ends) {
      const middle = a === b ? [a] : shortestPath(graph, a, b);
      if (!middle) continue;
      const way = [from, start.at, ...middle.map((id) => graph.points[id]), end.at, to];
      let cost = 0;
      for (let i = 1; i < way.length; i++) cost += span(way[i - 1], way[i]);
      if (!best || cost < best.cost) best = { cost, way };
    }
  }
  if (!best) return resample([from, to], stitchMm);
  return resample(dedupe(best.way), stitchMm);
}

function dedupe(points: Point[], tolerance = 1e-4): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > tolerance) out.push(point);
  }
  return out;
}

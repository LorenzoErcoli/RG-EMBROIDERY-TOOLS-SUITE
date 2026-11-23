import { decimiDst, GRIGLIA_DST_MM, PUNTO_MAX_DST_MM } from "@rg/core";
import type { GeneratedPoint, Point } from "../grammar/types.ts";
import { isInsideBoundary, type BoundaryOptions } from "./applyBoundary.ts";
import { subdivideLongSegments } from "./subdivideLongSegments.ts";

/**
 * IL PUNTO MINIMO, PER ULTIMO E SULLA GRIGLIA DEL DST (R3; Lorenzo, 2026-11-23, su un DST di un pannello
 * con buchi: «un sacco di punti sotto il millimetro» con l'eliminazione accesa).
 *
 * Le pulizie di prima (`cleanupPolyline` sui pezzi tagliati, `cleanupBoundaryConnectedPath` sul filo
 * riconnesso) tolgono un punto troppo vicino solo se è di un certo tipo: un punto del modulo, un angolo di
 * bordo, il capo di un pezzo tagliato restano sempre. Un taglio che cade a 0,1 mm da un vertice del modulo
 * lasciava così un punto da 0,1 mm, e nel DST i punti giusti per un soffio (0,97) uscivano a 0,9 perché il
 * file arrotonda ogni punto ai decimi di millimetro.
 *
 * Qui il filo, già connesso, si percorre una volta e ogni punto deve stare ad almeno `minMm` dall'ultimo
 * tenuto, sia com'è sia sul suo nodo della griglia del DST (`decimiDst`, lo stesso arrotondamento del file).
 * Il primo e l'ultimo punto restano. Quando due punti sono troppo vicini:
 * - se lo sono solo sulla griglia, il punto si sposta sul nodo vicino più prossimo che tiene il minimo e
 *   sta nella sagoma (al massimo 0,15 mm, sotto lo spessore del filo);
 * - se lo sono davvero, si fondono in uno, anche quando uno dei due è un angolo: resta il più importante
 *   (il bordo, poi i vertici del modulo, poi i punti intermedi), a pari importanza il primo; e solo se il
 *   tratto che ne esce sta nella sagoma, altrimenti si prova l'altro. Il bordo non esce dalla sagoma.
 *
 * La griglia è assoluta (nodi a multipli di 0,1 mm nelle coordinate del pannello): il DST la rispetta solo
 * se l'export centra il disegno su un nodo, con `stratiSullaGrigliaDst` del core e `center: false`.
 */

/**
 * Quanto un punto spostato o un tratto fuso può uscire dalla sagoma: niente, a meno degli errori di calcolo
 * (la stessa tolleranza di `segmentStaysInside`). Il disegno del motore resta dentro; nel DST lo scarto è
 * quello dell'arrotondamento, al più mezza diagonale di un nodo, come per qualunque punto.
 */
const TOLLERANZA_SAGOMA_MM = 1e-5;
/** Fin dove si cerca un nodo vicino quando il punto è corto solo sulla griglia. */
const SPOSTAMENTO_MAX_MM = GRIGLIA_DST_MM * 1.5;
const EPS = 1e-9;

const distanza = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
const distanzaSullaGriglia = (a: Point, b: Point): number =>
  Math.hypot(decimiDst(b.x) - decimiDst(a.x), decimiDst(b.y) - decimiDst(a.y)) * GRIGLIA_DST_MM;

/**
 * Quale dei due punti resta, quando si fondono: quelli sul bordo (il taglio, il raccordo) contano più dei
 * vertici del modulo, che contano più dei punti messi solo per dividere una linea (intermedi, suddivisioni).
 */
function peso(p: GeneratedPoint): number {
  if (p.role === "boundary" || p.role === "boundaryConnector") return 2;
  if (p.role === "intermediate" || p.role === "subdivision") return 0;
  return 1;
}

/** Il tratto a→b è lungo almeno `minMm` com'è e anche nel DST. */
export function trattoAlMinimo(a: Point, b: Point, minMm: number): boolean {
  return distanza(a, b) >= minMm - EPS && distanzaSullaGriglia(a, b) >= minMm - EPS;
}

function dentro(p: Point, sagoma: BoundaryOptions): boolean {
  return isInsideBoundary(p, sagoma, TOLLERANZA_SAGOMA_MM);
}

function trattoDentro(a: Point, b: Point, sagoma: BoundaryOptions): boolean {
  if (sagoma.shapeType === "none") return true;
  const passi = Math.max(2, Math.ceil(distanza(a, b) / 0.5));
  for (let i = 0; i <= passi; i++) {
    const t = i / passi;
    if (!dentro({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, sagoma)) return false;
  }
  return true;
}

/** Il nodo della griglia più vicino a `p` (entro 0,15 mm) che sta ad almeno `minMm` da `prima`, nella sagoma. */
function nodoVicino(prima: Point, p: GeneratedPoint, minMm: number, sagoma: BoundaryOptions): GeneratedPoint | undefined {
  const nx = decimiDst(p.x), ny = decimiDst(p.y);
  const nodi: Array<{ q: GeneratedPoint; d: number }> = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    if (dx === 0 && dy === 0) continue;
    const q = { ...p, x: (nx + dx) / 10, y: (ny + dy) / 10 };
    const d = distanza(p, q);
    if (d <= SPOSTAMENTO_MAX_MM + EPS) nodi.push({ q, d });
  }
  nodi.sort((a, b) => a.d - b.d);
  return nodi.find(({ q }) => trattoAlMinimo(prima, q, minMm) && dentro(q, sagoma) && trattoDentro(prima, q, sagoma))?.q;
}

/** Una passata: nessun tratto sotto `minMm`, né com'è né sulla griglia del DST. Gli estremi restano. */
export function imponiPuntoMinimo(path: GeneratedPoint[], minMm: number, sagoma: BoundaryOptions): GeneratedPoint[] {
  if (!(minMm > 0) || path.length < 2) return path.slice();
  const out: GeneratedPoint[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const ultimo = out[out.length - 1];
    if (trattoAlMinimo(ultimo, p, minMm)) { out.push(p); continue; }
    if (i === path.length - 1) {
      // l'ultimo punto del filo resta: si tolgono i punti tenuti prima, finché il tratto basta
      while (out.length > 1 && !trattoAlMinimo(out[out.length - 1], p, minMm)) out.pop();
      if (trattoAlMinimo(out[out.length - 1], p, minMm)) out.push(p);
      // un filo intero più corto del minimo non si cuce: resta il solo primo punto e chi chiama lo scarta
      continue;
    }
    if (distanza(ultimo, p) >= minMm - EPS) {
      const q = nodoVicino(ultimo, p, minMm, sagoma);
      if (q) { out.push(q); continue; }
    }
    // due punti quasi coincidenti: se ne tiene uno, il più importante (`peso`); a pari peso se ne va il
    // secondo. Così resta il taglio sul bordo invece del vertice a 0,8 mm (il filo corre sul bordo) e
    // l'angolo dello zig-zag invece del punto messo a metà della linea.
    const dopo = path[i + 1];
    const prima = out[out.length - 2];
    const togliQuesto = () => trattoDentro(ultimo, dopo, sagoma);
    const togliIlPrecedente = () => Boolean(prima) && trattoAlMinimo(prima, p, minMm) && trattoDentro(prima, p, sagoma);
    if (peso(p) > peso(ultimo)) {
      if (togliIlPrecedente()) { out[out.length - 1] = p; continue; }
      if (togliQuesto()) continue;
    } else {
      if (togliQuesto()) continue;
      if (togliIlPrecedente()) { out[out.length - 1] = p; continue; }
    }
    // nessuna delle due strade sta nella sagoma (un angolo rientrante stretto): il minimo vince, lo scarto
    // resta sotto la distanza fra i due punti
  }
  return out;
}

/**
 * Il punto più lungo che il Generatore lascia al DST: un passo di griglia sotto il record, così anche dopo
 * l'arrotondamento il punto resta uno solo. Oltre, `buildDst` lo spezzerebbe in 12,1 mm più un resto corto
 * (misurato: 0,2–0,7 mm sui raccordi dritti lungo il bordo, col punto massimo spento).
 */
const PUNTO_LUNGO_MAX_MM = PUNTO_MAX_DST_MM - GRIGLIA_DST_MM;

/**
 * Il passo finale del Generatore: punto minimo, poi il punto massimo (quello scelto, e comunque non oltre
 * quello che sta in un record del DST) sui tratti lunghi, poi di nuovo il minimo sui punti appena aggiunti.
 * Il minimo viene per ultimo: se i due limiti litigano (un punto massimo sotto il doppio del minimo) vince
 * lui, come vuole R3.
 */
export function puntoMinimoFinale(path: GeneratedPoint[], minMm: number, maxMm: number, sagoma: BoundaryOptions): GeneratedPoint[] {
  const massimo = maxMm > 0 ? Math.min(maxMm, PUNTO_LUNGO_MAX_MM) : PUNTO_LUNGO_MAX_MM;
  const primo = minMm > 0 ? imponiPuntoMinimo(path, minMm, sagoma) : path;
  const suddiviso = subdivideLongSegments(primo, massimo);
  return minMm > 0 ? imponiPuntoMinimo(suddiviso, minMm, sagoma) : suddiviso;
}

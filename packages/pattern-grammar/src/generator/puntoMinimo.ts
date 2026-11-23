import { decimiDst, GRIGLIA_DST_MM, PUNTO_MAX_DST_MM } from "@rg/core";
import type { GeneratedPoint, Point } from "../grammar/types.ts";
import { isInsideBoundary, stradaSulBordo, type BoundaryOptions } from "./applyBoundary.ts";
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
 * Qui il filo, già connesso, si percorre una volta e ogni punto deve stare abbastanza lontano dall'ultimo
 * tenuto, sia com'è sia sul suo nodo della griglia del DST (`decimiDst`, lo stesso arrotondamento del file).
 *
 * DUE MISURE (Lorenzo, 2026-11-23: «un conto è il pattern un conto è nei contorni… devo evitare sbavature e
 * punti troppo corti nei contorni, che siano aree vuote o contorni»): un tratto che tocca un contorno (un
 * taglio sul bordo, un raccordo che ci cammina sopra, il vertice del modulo accanto al taglio) deve essere
 * lungo almeno `minimi.contorni`, il «Punto minimo»; un tratto fra due punti del modulo almeno
 * `minimi.pattern`, il «Punto minimo del pattern» (0 = il disegno resta com'è).
 *
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
 * Quale dei due punti resta, quando si fondono. Di serie quelli sul bordo (il taglio, il raccordo) contano più
 * dei vertici del modulo, che contano più dei punti messi solo per dividere una linea (intermedi, suddivisioni):
 * nel Generatore il filo corre sul contorno. Con `tieni: "dentro"` il punto sul bordo conta meno del vertice:
 * la linea tagliata si ferma all'ago prima del bordo invece di piegare la linea verso il taglio (il punto
 * sopra di Pattern a macchie, che sul bordo della macchia non cammina).
 */
function peso(p: GeneratedPoint, tieni: "bordo" | "dentro"): number {
  if (p.role === "boundary" || p.role === "boundaryConnector") return tieni === "dentro" ? 0.5 : 2;
  if (p.role === "intermediate" || p.role === "subdivision") return 0;
  return 1;
}

/** Un punto del contorno: il taglio sul bordo, il raccordo che ci cammina sopra, e i punti che lo dividono. */
function sulContorno(p: GeneratedPoint): boolean {
  return p.role === "boundary" || p.role === "boundaryConnector" || (p.role === "subdivision" && p.source === "connector");
}

/** Le due misure del punto minimo: sui contorni e dentro il pattern. */
export type Minimi = { contorni: number; pattern: number };

/** Il minimo che vale per il tratto a→b: quello dei contorni se uno dei due capi ci sta, se no quello del pattern. */
const minimoDel = (a: GeneratedPoint, b: GeneratedPoint, minimi: Minimi): number =>
  (sulContorno(a) || sulContorno(b) ? minimi.contorni : minimi.pattern);

/** Il tratto a→b è lungo almeno `minMm` com'è e anche nel DST (0 = nessun minimo). */
export function trattoAlMinimo(a: Point, b: Point, minMm: number): boolean {
  if (!(minMm > 0)) return true;
  return distanza(a, b) >= minMm - EPS && distanzaSullaGriglia(a, b) >= minMm - EPS;
}

function dentro(p: Point, sagoma: BoundaryOptions): boolean {
  return isInsideBoundary(p, sagoma, TOLLERANZA_SAGOMA_MM);
}

function trattoDentro(a: Point, b: Point, sagoma: BoundaryOptions): boolean {
  if (sagoma.shapeType === "none") return true;
  // fitto, ogni 0,1 mm: la punta stretta di un vuoto sta in pochi decimi
  const passi = Math.max(4, Math.ceil(distanza(a, b) / 0.1));
  for (let i = 0; i <= passi; i++) {
    const t = i / passi;
    if (!dentro({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, sagoma)) return false;
  }
  return true;
}

/** Il nodo della griglia più vicino a `p` (entro 0,15 mm) che sta ad almeno `minMm` da `prima`, nella sagoma. */
function nodoVicino(prima: GeneratedPoint, p: GeneratedPoint, minimi: Minimi, sagoma: BoundaryOptions): GeneratedPoint | undefined {
  const minMm = minimoDel(prima, p, minimi);
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

/** Una passata: nessun tratto sotto il suo minimo (`minimoDel`), né com'è né sulla griglia del DST. Gli estremi restano. */
export function imponiPuntoMinimo(path: GeneratedPoint[], minimi: Minimi, sagoma: BoundaryOptions, tieni: "bordo" | "dentro" = "bordo"): GeneratedPoint[] {
  if (!(minimi.contorni > 0 || minimi.pattern > 0) || path.length < 2) return path.slice();
  const basta = (a: GeneratedPoint, b: GeneratedPoint) => trattoAlMinimo(a, b, minimoDel(a, b, minimi));
  const out: GeneratedPoint[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const ultimo = out[out.length - 1];
    if (basta(ultimo, p)) { out.push(p); continue; }
    if (i === path.length - 1) {
      // l'ultimo punto del filo resta: si tolgono i punti tenuti prima, finché il tratto basta
      while (out.length > 1 && !basta(out[out.length - 1], p)) out.pop();
      if (basta(out[out.length - 1], p)) out.push(p);
      // un filo intero più corto del minimo non si cuce: resta il solo primo punto e chi chiama lo scarta
      continue;
    }
    if (distanza(ultimo, p) >= minimoDel(ultimo, p, minimi) - EPS) {
      const q = nodoVicino(ultimo, p, minimi, sagoma);
      if (q) { out.push(q); continue; }
    }
    // due punti quasi coincidenti: se ne tiene uno, il più importante (`peso`); a pari peso se ne va il
    // secondo. Così resta il taglio sul bordo invece del vertice a 0,8 mm (il filo corre sul bordo) e
    // l'angolo dello zig-zag invece del punto messo a metà della linea.
    const dopo = path[i + 1];
    const prima = out[out.length - 2];
    const togliQuesto = () => trattoDentro(ultimo, dopo, sagoma);
    const togliIlPrecedente = () => Boolean(prima) && basta(prima, p) && trattoDentro(prima, p, sagoma);
    if (peso(p, tieni) > peso(ultimo, tieni)) {
      if (togliIlPrecedente()) { out[out.length - 1] = p; continue; }
      if (togliQuesto()) continue;
    } else {
      if (togliQuesto()) continue;
      if (togliIlPrecedente()) { out[out.length - 1] = p; continue; }
    }
    // nessuna delle due strade sta nella sagoma (la punta stretta di un vuoto): si torna indietro di qualche
    // punto, finché il tratto fino a questo basta e sta dentro
    let indietro = 0;
    for (let k = 2; k <= 6 && k < out.length + 1; k++) {
      const da = out[out.length - k];
      if (da && basta(da, p) && trattoDentro(da, p, sagoma)) { indietro = k - 1; break; }
    }
    if (indietro) { out.length -= indietro; out.push(p); continue; }
    // nemmeno così: il punto resta, corto, piuttosto che portare il filo fuori dalla sagoma (succede solo su
    // una punta più stretta del punto minimo: lì nessuna strada è insieme dentro e abbastanza lunga)
    out.push(p);
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
export function puntoMinimoFinale(path: GeneratedPoint[], minimi: Minimi, maxMm: number, sagoma: BoundaryOptions): GeneratedPoint[] {
  const massimo = maxMm > 0 ? Math.min(maxMm, PUNTO_LUNGO_MAX_MM) : PUNTO_LUNGO_MAX_MM;
  const riparato = senzaSbavature(path, sagoma);
  return imponiPuntoMinimo(subdivideLongSegments(imponiPuntoMinimo(riparato, minimi, sagoma), massimo), minimi, sagoma);
}

/** Un tratto esce dalla sagoma? Si guarda fitto (ogni 0,1 mm): una punta stretta di un vuoto sta in pochi decimi. */
function esce(a: Point, b: Point, sagoma: BoundaryOptions): boolean {
  if (sagoma.shapeType === "none") return false;
  const passi = Math.max(4, Math.ceil(distanza(a, b) / 0.1));
  for (let i = 1; i < passi; i++) {
    const t = i / passi;
    if (!dentro({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, sagoma)) return true;
  }
  return false;
}

/**
 * NIENTE SBAVATURE SUI CONTORNI (Lorenzo, 2026-11-23). Un tratto che tocca un contorno ed esce dalla sagoma
 * (un raccordo che taglia la punta di un vuoto, un angolo perso per strada) si rifà camminando sul bordo del
 * suo anello, coi vertici in mezzo (`stradaSulBordo`). I tratti del pattern non si toccano: se escono, è il
 * ritaglio che va corretto.
 */
export function senzaSbavature(path: GeneratedPoint[], sagoma: BoundaryOptions): GeneratedPoint[] {
  if (sagoma.shapeType === "none" || sagoma.shapeType === "circle" || path.length < 2) return path;
  const out: GeneratedPoint[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if ((sulContorno(a) || sulContorno(b)) && esce(a, b, sagoma)) {
      const strada = stradaSulBordo(a, b, sagoma);
      if (strada) for (const p of strada) out.push(p);
    }
    out.push(b);
  }
  return out;
}

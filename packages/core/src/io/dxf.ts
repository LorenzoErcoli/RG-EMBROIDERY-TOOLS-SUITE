// Import DXF → contorni in mm, con colore (ACI) come ruolo. Regole R2, R12.
// Parser code-pair minimale: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, e INSERT di blocchi (traslazione, scala, rotazione). Y invertita (DXF Y-up → interno Y-down).
import type { Contour, Point, ImportResult } from '../types';
import { measureContours } from '../imports';

function geoClosed(pts: Point[]): boolean {
  if (pts.length < 3) return false;
  const a = pts[0], b = pts[pts.length - 1];
  return Math.hypot(a.x - b.x, a.y - b.y) < 1.0;
}

/** Passo di campionamento delle curve DXF (mm): come il resto della suite, ~0.6mm. */
const ARC_STEP_MM = 0.6;

const ACI: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff',
  5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0',
};
function aciToHex(i: number): string {
  if (ACI[i]) return ACI[i];
  const h = (i * 47) % 360;
  return `hsl-${h}`; // marker; convertito sotto
}
function hslMarkerToHex(s: string): string {
  const m = /^hsl-(\d+)$/.exec(s);
  if (!m) return s;
  const h = parseInt(m[1], 10) / 360, sat = 0.65, l = 0.5;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const r = hue(p, q, h + 1 / 3), g = hue(p, q, h), b = hue(p, q, h - 1 / 3);
  const hx = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

export function parseDxfToContours(dxfText: string): ImportResult {
  const lines = dxfText.split(/\r\n|\r|\n/);
  const pairs: { code: number; value: string }[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    pairs.push({ code, value: lines[i + 1] });
  }

  // scala unità da $INSUNITS (default mm)
  let unitScale = 1;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i].code === 9 && pairs[i].value.trim() === '$INSUNITS') {
      const u = parseInt(pairs[i + 1].value.trim(), 10);
      unitScale = u === 1 ? 25.4 : u === 4 ? 1 : u === 5 ? 10 : u === 6 ? 1000 : 1;
      break;
    }
  }

  const contours: Contour[] = [];

  // I BLOCCHI (sezione BLOCKS): un CAD che esporta «tutto il disegno dentro un blocco» lascia in ENTITIES un
  // solo INSERT. Senza questo il file importava a ZERO contorni, in silenzio (difetto trovato il 2026-10-06 sul
  // DXF di Dior, `BASERICAMO_39`). Per ogni blocco si ricorda il punto base e dove comincia il corpo.
  const blocchi = new Map<string, { baseX: number; baseY: number; corpo: number }>();
  for (let k = 0; k < pairs.length; k++) {
    if (pairs[k].code !== 0 || pairs[k].value.trim() !== 'BLOCK') continue;
    let nome = '', baseX = 0, baseY = 0, j = k + 1;
    for (; j < pairs.length && pairs[j].code !== 0; j++) {
      if (pairs[j].code === 2 && !nome) nome = pairs[j].value.trim();
      else if (pairs[j].code === 10) baseX = parseFloat(pairs[j].value) || 0;
      else if (pairs[j].code === 20) baseY = parseFloat(pairs[j].value) || 0;
    }
    if (nome) blocchi.set(nome, { baseX, baseY, corpo: j });
  }
  const PROFONDITA_MAX = 8; // blocchi dentro blocchi: oltre, probabilmente un giro

  /** Legge le entita' da `inizio` fino a ENDSEC/ENDBLK; `toPt` porta le coordinate CAD di QUESTO spazio al punto finale. */
  const leggi = (inizio: number, toPt: (x: number, y: number) => Point, profondita: number): void => {
  let i = inizio;
  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0) {
      const type = p.value.trim();
      if (type === 'ENDSEC' || type === 'ENDBLK') break;
      if (type === 'INSERT') {
        const e = readEntity(pairs, i + 1);
        let nome = '';
        for (let j = i + 1; j < e.next; j++) if (pairs[j].code === 2) { nome = pairs[j].value.trim(); break; }
        const b = blocchi.get(nome);
        if (b && profondita < PROFONDITA_MAX) {
          const ix = e.num[10] ?? 0, iy = e.num[20] ?? 0;
          const sx = e.num[41] ?? 1, sy = e.num[42] ?? e.num[41] ?? 1;
          const a = ((e.num[50] ?? 0) * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
          leggi(b.corpo, (x, y) => {
            const lx = (x - b.baseX) * sx, ly = (y - b.baseY) * sy;
            return toPt(ix + co * lx - si * ly, iy + si * lx + co * ly);
          }, profondita + 1);
        }
        i = e.next; continue;
      }
      if (type === 'LINE') {
        const e = readEntity(pairs, i + 1);
        const x1 = e.num[10], y1 = e.num[20], x2 = e.num[11], y2 = e.num[21];
        if ([x1, y1, x2, y2].every((v) => v !== undefined)) {
          contours.push({ points: [toPt(x1, y1), toPt(x2, y2)], closed: false, color: colorOf(e) });
        }
        i = e.next; continue;
      }
      if (type === 'LWPOLYLINE') {
        const e = readEntity(pairs, i + 1);
        const pts = e.vertices.map((v) => toPt(v.x, v.y));
        const closed = ((e.num[70] ?? 0) & 1 ? true : false) || geoClosed(pts);
        if (pts.length >= 2) contours.push({ points: pts, closed, color: colorOf(e) });
        i = e.next; continue;
      }
      if (type === 'CIRCLE' || type === 'ARC') {
        // Cerchi e archi: un cartamodello CAD chiude quasi sempre le curve così. Senza questo ramo
        // sparivano in silenzio — restava la sagoma sbagliata, non un errore.
        const e = readEntity(pairs, i + 1);
        const cx = e.num[10], cy = e.num[20], r = e.num[40];
        if (cx !== undefined && cy !== undefined && r !== undefined && r > 0) {
          const start = type === 'ARC' ? (e.num[50] ?? 0) : 0;
          const rawEnd = type === 'ARC' ? (e.num[51] ?? 360) : 360;
          const sweep = type === 'ARC' ? ((rawEnd - start) + 360) % 360 || 360 : 360;
          const arcMm = (Math.PI * 2 * r * unitScale) * (sweep / 360);
          const steps = Math.max(8, Math.ceil(arcMm / ARC_STEP_MM));
          const pts: Point[] = [];
          for (let k = 0; k <= steps; k++) {
            const a = ((start + (sweep * k) / steps) * Math.PI) / 180;
            pts.push(toPt(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
          }
          contours.push({ points: pts, closed: type === 'CIRCLE', color: colorOf(e) });
        }
        i = e.next; continue;
      }
      if (type === 'POLYLINE') {
        // vertici in entità VERTEX successive fino a SEQEND
        // Il flag 70 (bit 1) dice «chiusa»: un DXF corretto NON ripete il primo vertice in fondo. Prima il flag era
        // ignorato e si guardava solo se l'ultimo punto coincideva col primo (trovato dal lucchetto sui blocchi).
        const chiusaDaFlag = (((readEntity(pairs, i + 1).num[70] ?? 0) as number) & 1) === 1;
        let j = i + 1;
        const pts: Point[] = [];
        let color = '#000000';
        while (j < pairs.length && !(pairs[j].code === 0 && pairs[j].value.trim() === 'SEQEND')) {
          if (pairs[j].code === 0 && pairs[j].value.trim() === 'VERTEX') {
            const e = readEntity(pairs, j + 1);
            if (e.num[10] !== undefined && e.num[20] !== undefined) pts.push(toPt(e.num[10], e.num[20]));
            color = colorOf(e) !== '#000000' ? colorOf(e) : color;
            j = e.next;
          } else j++;
        }
        if (pts.length >= 2) contours.push({ points: pts, closed: chiusaDaFlag || geoClosed(pts), color });
        i = j + 1; continue;
      }
    }
    i++;
  }
  };

  let inizio = 0;
  // salta all'ENTITIES
  while (inizio < pairs.length && !(pairs[inizio].code === 2 && pairs[inizio].value.trim() === 'ENTITIES')) inizio++;
  leggi(inizio, (x, y) => ({ x: x * unitScale, y: -y * unitScale }), 0);
  return { contours, ...measureContours(contours), method: 'unit' };
}

interface EntityData { num: Record<number, number>; vertices: { x: number; y: number }[]; next: number; }
function readEntity(pairs: { code: number; value: string }[], start: number): EntityData {
  const num: Record<number, number> = {};
  const vertices: { x: number; y: number }[] = [];
  let i = start;
  let pendingX: number | undefined;
  for (; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 0) break;
    const v = parseFloat(value);
    if (code === 10) { // X di un vertice (LWPOLYLINE) o del punto principale
      pendingX = v;
      if (num[10] === undefined) num[10] = v;
    } else if (code === 20) {
      if (num[20] === undefined) num[20] = v;
      if (pendingX !== undefined) { vertices.push({ x: pendingX, y: v }); pendingX = undefined; }
    } else {
      num[code] = v;
    }
  }
  return { num, vertices, next: i };
}

function colorOf(e: EntityData): string {
  const aci = e.num[62];
  if (aci === undefined) return '#000000';
  return hslMarkerToHex(aciToHex(aci));
}

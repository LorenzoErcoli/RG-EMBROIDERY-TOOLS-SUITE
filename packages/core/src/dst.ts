// Scrittura file ricamo Tajima .dst — porting browser-safe (Uint8Array, niente fs/Buffer) del writer
// standalone `stilista-json-bridge-clean/standalone-dst/dst-writer.mjs`. Stesso formato di input, così un
// `program` funziona identico qui e nel writer Node. Pensato come mattone GLOBALE della suite (R27/R29).
//
// Un record DST = 3 byte, delta RELATIVI in decimi di millimetro, max ±121 (12,1mm) per asse; i movimenti
// più lunghi si spezzano in più record. Header ASCII da 512 byte + record finale END (00 00 F3).

export interface DstPath {
  /** Numero ago: serve a ORDINARE i blocchi e a inserire un cambio-colore quando cambia (non è l'ago reale). */
  needle?: number;
  /** Punti in millimetri ASSOLUTI. */
  points_mm: Array<[number, number]>;
}
export interface DstProgram {
  label?: string;
  /** 'svg' (Y verso il basso, invertita per il DST) | 'cartesian' (Y verso l'alto). Default 'svg'. */
  coordinate_system?: 'svg' | 'cartesian';
  paths: DstPath[];
}

const WEIGHTS = [81, 27, 9, 3, 1];
// Mappa (peso→bit) per i due assi, identica al writer Node. [byteIndex, bitIndex].
const BIT_X: Record<string, [number, number]> = {
  '-9': [0, 3], '9': [0, 2], '-1': [0, 1], '1': [0, 0],
  '-27': [1, 3], '27': [1, 2], '-3': [1, 1], '3': [1, 0], '-81': [2, 3], '81': [2, 2],
};
const BIT_Y: Record<string, [number, number]> = {
  '1': [0, 7], '-1': [0, 6], '9': [0, 5], '-9': [0, 4],
  '3': [1, 7], '-3': [1, 6], '27': [1, 5], '-27': [1, 4], '81': [2, 5], '-81': [2, 4],
};

function decompose(value: number): number[] {
  if (!Number.isInteger(value) || value < -121 || value > 121) throw new Error(`Delta DST fuori range: ${value}`);
  const parts: number[] = [];
  let rest = value;
  for (const w of WEIGHTS) {
    if (rest > w / 2) { parts.push(w); rest -= w; }
    else if (rest < -w / 2) { parts.push(-w); rest += w; }
  }
  if (rest !== 0) throw new Error(`Delta DST non decomponibile: ${value}`);
  return parts;
}

type Cmd = 'stitch' | 'jump' | 'color_change';
function encodeRecord(dx: number, dy: number, cmd: Cmd): [number, number, number] {
  const bytes: [number, number, number] = [0, 0, 0x03];
  for (const p of decompose(dx)) { const b = BIT_X[String(p)]; if (b) bytes[b[0]] |= 1 << b[1]; }
  for (const p of decompose(dy)) { const b = BIT_Y[String(p)]; if (b) bytes[b[0]] |= 1 << b[1]; }
  if (cmd === 'jump') bytes[2] |= 1 << 7;
  else if (cmd === 'color_change') { bytes[2] |= 1 << 7; bytes[2] |= 1 << 6; }
  return bytes;
}

function splitDelta(dx: number, dy: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let rx = dx, ry = dy;
  while (rx !== 0 || ry !== 0) {
    const sx = Math.max(-121, Math.min(121, rx));
    const sy = Math.max(-121, Math.min(121, ry));
    out.push([sx, sy]); rx -= sx; ry -= sy;
  }
  return out.length ? out : [[0, 0]];
}

function toPoint(p: [number, number], coord: string): [number, number] {
  const x = Math.round(Number(p[0]) * 10);
  const rawY = Math.round(Number(p[1]) * 10);
  const y = coord === 'svg' ? -rawY : rawY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Coordinate DST non numeriche: ${JSON.stringify(p)}`);
  return [x, y];
}

function ascii(s: string, into: Uint8Array, at: number): void {
  for (let i = 0; i < s.length; i++) into[at + i] = s.charCodeAt(i) & 0xff;
}
function field(name: string, value: number | string, width: number): string {
  return `${name}:${String(value).slice(0, width).padStart(width, ' ')}\r`;
}
function signedField(name: string, value: number, width: number): string {
  const sign = value < 0 ? '-' : '+';
  return `${name}:${sign}${String(Math.abs(value)).padStart(width - 1, '0')}\r`;
}

/** Costruisce i byte di un file .dst dal `program` (mm assoluti). Restituisce l'intero file (header+corpo+END). */
export function buildDst(program: DstProgram): Uint8Array {
  const coord = program.coordinate_system || 'svg';
  if (coord !== 'svg' && coord !== 'cartesian') throw new Error('coordinate_system deve essere "svg" o "cartesian".');
  const label = String(program.label || 'DESIGN').slice(0, 16);
  const paths = (program.paths || []).map((item, idx) => {
    const pts = item.points_mm;
    if (!Array.isArray(pts) || pts.length < 2) throw new Error(`paths[${idx}] deve avere almeno 2 punti.`);
    return { needle: item.needle, points: pts.map((p) => toPoint(p, coord)) };
  });
  if (!paths.length) throw new Error('Programma DST vuoto: serve almeno un path.');

  // Corpo: per ogni blocco → cambio-colore se cambia ago, salto al primo punto, poi punti-cucitura.
  const body: number[] = [];
  const push = (r: [number, number, number]) => { body.push(r[0], r[1], r[2]); };
  const addMove = (from: [number, number], to: [number, number], cmd: Cmd): number => {
    const steps = splitDelta(to[0] - from[0], to[1] - from[1]);
    for (const [sx, sy] of steps) push(encodeRecord(sx, sy, cmd));
    return cmd === 'stitch' ? steps.length : 0;
  };
  let current: [number, number] = [0, 0];
  let prevNeedle: number | undefined;
  let stitchCount = 0, colorChanges = 0;
  const stitched: Array<[number, number]> = [];
  for (const seg of paths) {
    if (prevNeedle !== undefined && seg.needle !== prevNeedle) { push(encodeRecord(0, 0, 'color_change')); colorChanges++; }
    prevNeedle = seg.needle;
    addMove(current, seg.points[0], 'jump'); current = seg.points[0];
    for (let i = 1; i < seg.points.length; i++) { stitchCount += addMove(current, seg.points[i], 'stitch'); current = seg.points[i]; stitched.push(current); }
  }
  body.push(0x00, 0x00, 0xf3); // END

  // Header ASCII (512 byte, riempito di spazi, terminato da 0x1A).
  const xs = stitched.map((p) => p[0]), ys = stitched.map((p) => p[1]);
  const plusX = xs.length ? Math.max(0, ...xs) : 0, minusX = xs.length ? Math.abs(Math.min(0, ...xs)) : 0;
  const plusY = ys.length ? Math.max(0, ...ys) : 0, minusY = ys.length ? Math.abs(Math.min(0, ...ys)) : 0;
  const text =
    `LA:${label.padEnd(16, ' ')}\r` +
    field('ST', stitchCount, 7) + field('CO', colorChanges, 3) +
    signedField('+X', plusX, 5) + signedField('-X', minusX, 5) +
    signedField('+Y', plusY, 5) + signedField('-Y', minusY, 5) +
    signedField('AX', current[0], 6) + signedField('AY', current[1], 6) +
    signedField('MX', 0, 6) + signedField('MY', 0, 6) + 'PD:******\r';
  if (text.length + 1 > 512) throw new Error('Header DST troppo lungo.');
  const header = new Uint8Array(512).fill(0x20);
  ascii(text, header, 0);
  header[text.length] = 0x1a;

  const out = new Uint8Array(512 + body.length);
  out.set(header, 0);
  out.set(Uint8Array.from(body), 512);
  return out;
}

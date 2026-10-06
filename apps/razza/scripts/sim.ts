// PROVE DEL MOTORE sulla sagoma vera, da riga di comando: numeri, un PNG da guardare e un DST da aprire.
//
//   npx esbuild apps/razza/scripts/sim.ts --bundle --format=esm --platform=node \
//     --alias:@rg/core=./packages/core/src/index.ts --outfile=apps/razza/scripts/sim.mjs
//   node apps/razza/scripts/sim.mjs [file.dxf] [gruppo]      gruppo: base | fissi | sfumatura | tutto
//
// Scrive in apps/razza/scripts/out/ (non tracciato). Per il resto vedi sapere/tool/razza.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildDst, parseDxfToContours } from '@rg/core';
import { Tela } from '../../../packages/testkit/src/png.ts';
import { costruisci, pezzoDa, stratiPerDst, daDiPassaggio, type Fisso, type ParametriRazza, type Pezzo, type Risultato, type Sfumatura } from '../src/motore.ts';

const OUT = 'apps/razza/scripts/out';
mkdirSync(OUT, { recursive: true });
const FILE = process.argv[2] && !['base', 'fissi', 'sfumatura', 'tutto'].includes(process.argv[2]) ? process.argv[2] : 'C:/Users/l.ercoli/AppData/Local/Temp/BASE RICAMO VENERE 85 SC.dxf';
const GRUPPO = process.argv.find((a) => ['base', 'fissi', 'sfumatura', 'tutto'].includes(a)) ?? 'tutto';

function pezzoDaDxf(file: string): Pezzo {
  const imp = parseDxfToContours(readFileSync(file, 'latin1'));
  const chiusi = imp.contours.filter((c) => c.closed).sort((a, b) => b.points.length - a.points.length);
  return pezzoDa(chiusi[0].points, chiusi.slice(1).map((c) => c.points));
}

const FONDO: [number, number, number] = [70, 48, 30], FILO: [number, number, number] = [232, 200, 140], VISTO: [number, number, number] = [235, 40, 40];
function disegna(r: Risultato, file: string, px: number, fissi: Fisso[] = [], sfumature: Sfumatura[] = []): void {
  const pz = r.pezzo, m = 3;
  const t = new Tela(pz.maxX - pz.minX + 2 * m, pz.maxY - pz.minY + 2 * m, px);
  for (let i = 0; i < t.rgb.length; i += 3) { t.rgb[i] = FONDO[0]; t.rgb[i + 1] = FONDO[1]; t.rgb[i + 2] = FONDO[2]; }
  const X = (x: number): number => x - pz.minX + m, Y = (y: number): number => y - pz.minY + m; // y verso il basso, come lo schermo
  for (let i = 1; i < r.punti.length; i++) {
    const a = r.punti[i - 1], b = r.punti[i];
    const c = daDiPassaggio(a, b) >= 0 && b.vista ? VISTO : FILO;
    t.linea([{ x: X(a.p.x), y: Y(a.p.y) }, { x: X(b.p.x), y: Y(b.p.y) }], ...c);
  }
  for (const f of fissi) { const cerchio = []; for (let k = 0; k <= 48; k++) cerchio.push({ x: X(f.x + (f.diamMm / 2) * Math.cos((k / 48) * 2 * Math.PI)), y: Y(f.y + (f.diamMm / 2) * Math.sin((k / 48) * 2 * Math.PI)) }); t.linea(cerchio, 80, 160, 255); }
  for (const s of sfumature) t.linea([{ x: X(s.a.x), y: Y(s.a.y) }, { x: X(s.b.x), y: Y(s.b.y) }], 80, 255, 160);
  t.salva(file);
}

function scriviDst(r: Risultato, file: string, etichetta: string): void {
  const { layers } = stratiPerDst(r);
  const cx = Math.round(((r.pezzo.minX + r.pezzo.maxX) / 2) / 0.1) * 0.1, cy = Math.round(((r.pezzo.minY + r.pezzo.maxY) / 2) / 0.1) * 0.1;
  void cx; void cy;
  writeFileSync(file, buildDst({ label: etichetta, coordinate_system: 'svg', paths: [{ needle: 1, points_mm: layers[0].polylines[0].map((p) => [p.x, p.y] as [number, number]) }] }));
}

const f1 = (v: number): string => v.toFixed(1), f2 = (v: number): string => v.toFixed(2);
function riga(nome: string, r: Risultato): string {
  const m = r.misure;
  return `${nome.padEnd(30)} ${String(m.tondini).padStart(5)} pallini ${f1(m.copertoPercento).padStart(5)}% ${String(m.punti).padStart(7)} punti ${f1(m.filoM).padStart(6)} m | passaggi in vista per giuntura: med ${f2(m.vistaGiuntura.mediana)} p90 ${f2(m.vistaGiuntura.p90)} max ${f1(m.vistaGiuntura.max)} >5mm: ${m.vistaGiuntura.oltre5} | fuori sagoma ${m.fuoriSagoma} | punto min ${f2(m.puntoMin)} max ${f2(m.puntoMax)} | ${m.millisecondi} ms`;
}

const pz = pezzoDaDxf(FILE);
console.log(`Pezzo: ${(pz.maxX - pz.minX).toFixed(1)} × ${(pz.maxY - pz.minY).toFixed(1)} mm, ${pz.contorno.length} punti, ${pz.vuoti.length} vuoti`);
const centro = { x: (pz.minX + pz.maxX) / 2, y: (pz.minY + pz.maxY) / 2 };

function prova(nome: string, par: Partial<ParametriRazza>, fissi: Fisso[] = [], sfumature: Sfumatura[] = []): Risultato {
  const r = costruisci(pz, par, fissi, sfumature);
  console.log(riga(nome, r));
  for (const a of r.avvisi) console.log('   avviso:', a);
  disegna(r, `${OUT}/${nome}.png`, 5, fissi, sfumature);
  scriviDst(r, `${OUT}/${nome}.dst`, nome.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
  return r;
}

if (GRUPPO === 'base' || GRUPPO === 'tutto') {
  // il campo dal bordo: piccoli ai bordi, grandi verso il centro. Misura: il diametro medio dei pallini per fascia di
  // distanza dal bordo deve CRESCERE.
  const r = prova('base', {});
  const fasce = [[0, 4], [4, 10], [10, 20], [20, 40], [40, 200]];
  const dist = (x: number, y: number): number => { let d = Infinity; const c = pz.contorno; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)); d = Math.min(d, Math.hypot(x - a.x - dx * t, y - a.y - dy * t)); } return d; };
  console.log('   diametro medio per distanza dal bordo:', fasce.map(([a, b]) => { const v = r.tondini.filter((o) => { const d = dist(o.cx, o.cy); return d >= a && d < b; }); return `${a}-${b} mm: ${v.length ? f1(v.reduce((s, o) => s + 2 * o.a, 0) / v.length) : '-'} (${v.length})`; }).join(' | '));
}
if (GRUPPO === 'fissi' || GRUPPO === 'tutto') {
  const fissi: Fisso[] = [{ x: centro.x + 60, y: centro.y, diamMm: 14 }, { x: centro.x - 20, y: centro.y - 55, diamMm: 3 }];
  const r = prova('fissi', {}, fissi);
  for (const f of fissi) { const o = r.tondini.find((t) => t.fisso && Math.hypot(t.cx - f.x, t.cy - f.y) < 0.01); console.log(`   fisso (${f1(f.x)}, ${f1(f.y)}) ${f.diamMm} mm → nel ricamo: ${o ? f1(2 * o.a) + ' mm, nel punto esatto' : 'NON POSATO'}`); }
}
if (GRUPPO === 'sfumatura' || GRUPPO === 'tutto') {
  const sf: Sfumatura[] = [{ a: { x: centro.x - 100, y: centro.y }, b: { x: centro.x + 100, y: centro.y }, diamAMm: 3, diamBMm: 10 }];
  const r = prova('sfumatura', { diamMaxMm: 10 }, [], sf);
  const medio = (x0: number, x1: number): string => { const v = r.tondini.filter((o) => o.cx >= x0 && o.cx < x1); return v.length ? f1(v.reduce((s, o) => s + 2 * o.a, 0) / v.length) : '-'; };
  console.log(`   sfumatura da sinistra (3 mm) a destra (10 mm): diametro medio per fascia di x: ${[0, 1, 2, 3].map((k) => medio(centro.x - 100 + k * 50, centro.x - 50 + k * 50)).join(' → ')}`);
}

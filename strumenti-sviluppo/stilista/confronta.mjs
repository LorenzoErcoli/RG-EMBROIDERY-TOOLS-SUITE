// Confronta il programma passato al bridge con l'EMG3 che Stilista ne ha fatto, riletto dal lettore
// offline del bridge (stilista-emg-offline-3): oggetti, aghi, e quanto i contorni salvati si
// scostano dai nostri. Scrive anche un SVG: i nostri contorni, quelli di Stilista e i suoi punti.
//
// Uso:  node strumenti-sviluppo/stilista/confronta.mjs out/macchie.batch.json out/macchie.offline.json
import { readFileSync, writeFileSync } from 'node:fs';

const [fileProgramma, fileLettura] = process.argv.slice(2);
const programma = JSON.parse(readFileSync(fileProgramma, 'utf8'));
const lettura = JSON.parse(readFileSync(fileLettura, 'utf8'));

const daMicron = (p) => [p.x_um / 1000, p.y_um / 1000];
function distanzaDalSegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function distanzaDalContorno(p, anello) {
  let d = Infinity;
  for (let i = 0; i < anello.length; i += 1) d = Math.min(d, distanzaDalSegmento(p, anello[i], anello[(i + 1) % anello.length]));
  return d;
}

const righe = [];
let peggiore = 0;
programma.objects.forEach((atteso, i) => {
  const letto = lettura.objects[i];
  const nostro = atteso.geometry.outer;
  const suo = letto.source_path.points.map(daMicron);
  // in tutte e due le direzioni: i suoi punti dal nostro contorno, i nostri dal suo
  const andata = Math.max(...suo.map((p) => distanzaDalContorno(p, nostro)));
  const ritorno = Math.max(...nostro.map((p) => distanzaDalContorno(p, suo)));
  const scarto = Math.max(andata, ritorno);
  peggiore = Math.max(peggiore, scarto);
  righe.push({
    id: atteso.id,
    tipo: `${atteso.type} → ${letto.kind}`,
    ago: `${atteso.machine.needle} → ${letto.needle}`,
    colore: letto.thread_color === atteso.machine.thread_color ? 'ok' : letto.thread_color,
    punti: `${nostro.length} → ${suo.length}`,
    'scarto mm': scarto.toFixed(3),
    'punti cuciti': letto.stitch_count,
  });
});
console.table(righe);
console.log(`oggetti ${programma.objects.length} → ${lettura.declared_object_count} · STOP ${lettura.stop_count} · punti cuciti ${lettura.total_stitches} · scarto massimo dei contorni ${peggiore.toFixed(3)} mm`);

const { width, height } = programma.target_size_mm;
const d = (pts, chiuso) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ') + (chiuso ? ' Z' : '');
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 4}" height="${height * 4}">`,
  '<rect width="100%" height="100%" fill="#fff"/>',
  ...lettura.objects.map((o) => `<path d="${d(o.stitching_path.points.map(daMicron), false)}" fill="none" stroke="#b39b00" stroke-width="0.12"/>`),
  ...programma.objects.map((o) => `<path d="${d(o.geometry.outer, true)}" fill="none" stroke="#1f6fd1" stroke-width="0.25"/>`),
  ...lettura.objects.map((o) => `<path d="${d(o.source_path.points.map(daMicron), true)}" fill="none" stroke="#e52521" stroke-width="0.1" stroke-dasharray="0.4 0.3"/>`),
  '</svg>',
].join('\n');
const fileSvg = fileLettura.replace(/\.json$/, '.confronto.svg');
writeFileSync(fileSvg, svg);
console.log(`blu = i nostri contorni · rosso tratteggiato = il contorno salvato da Stilista · oro = i punti calcolati da Stilista\nscritto ${fileSvg}`);

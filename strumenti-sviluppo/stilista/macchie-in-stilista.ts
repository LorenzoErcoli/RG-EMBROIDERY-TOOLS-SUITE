// Prima prova di integrazione con Stilista (2026-10-20): le macchie del pannello di prova di
// pattern-macchie diventano un programma per lo Stilista JSON Bridge (stilista-bridge-batch-1):
// un'area nativa `fill` per macchia, orientata in verticale come il raso del tool. Stilista poi
// le costruisce e le ricalcola da sé: nel file restano oggetti modificabili, non punti.
//
// Uso:  npm run prova:stilista -- [quante macchie, di serie 12]
// Esce: strumenti-sviluppo/stilista/out/macchie.batch.json (+ .svg per guardarlo senza Stilista)
import { simplifyPolyline } from '@rg/core';
import type { Point } from '@rg/core';
import { parseImportedBoundarySource } from '@rg/pattern-grammar';

const modulo = 'node:fs';
const { readFileSync, writeFileSync, mkdirSync } = await import(modulo) as typeof import('node:fs');
const radice = new URL('../../../', import.meta.url); // gira dal bundle in out/
const uscita = new URL('strumenti-sviluppo/stilista/out/', radice);

const quante = Number(process.argv[2] ?? 12);
const MAX_PUNTI = 256; // limite dello schema del bridge per contorno

const pm = parseImportedBoundarySource(readFileSync(new URL('test/fixtures/macchie-pannello.svg', radice), 'utf8'), 'macchie.svg', { scaleMode: 'illustrator-72dpi' });
const pannello = pm.choices.find((c) => c.color === '#e52521')!.boundary.paths[0].points;
const tutte = pm.choices.find((c) => c.color === '#ede300')!.boundary.paths.map((p) => p.points);
const macchie = tutte.slice(0, quante);

/** Contorno chiuso senza il punto di chiusura ripetuto, semplificato finché sta nel limite del bridge. */
function contorno(punti: Point[]): Point[] {
  const ultimo = punti[punti.length - 1];
  const anello = ultimo.x === punti[0].x && ultimo.y === punti[0].y ? punti.slice(0, -1) : punti;
  let tolleranza = 0.02;
  let fuori = simplifyPolyline(anello, tolleranza);
  while (fuori.length > MAX_PUNTI) fuori = simplifyPolyline(anello, (tolleranza *= 1.5));
  return fuori;
}

const mm = (v: number) => Math.round(v * 1000) / 1000;
const xs = pannello.map((p) => p.x), ys = pannello.map((p) => p.y);
const larghezza = Math.max(...xs), altezza = Math.max(...ys);

const programma = {
  schema_version: 'stilista-bridge-batch-1',
  create_new: true,
  type: 'batch',
  id: `RG-MACCHIE-${quante}`,
  source_image: 'test/fixtures/macchie-pannello.svg',
  target_size_mm: { width: mm(larghezza), height: mm(altezza) },
  sequence: { apply_native_needle_changes: true, require_persistent_needle_changes: true },
  objects: macchie.map((m, i) => ({
    create_new: true,
    type: 'fill',
    id: `macchia-${String(i + 1).padStart(2, '0')}`,
    role: 'macchia-raso',
    color_role: 'giallo-macchia',
    orientation_deg: 90, // raso verticale, come in pattern-macchie
    geometry: { kind: 'polygon', outer: contorno(m).map((p) => [mm(p.x), mm(p.y)]) },
    // la ricetta collaudata di FIORE-04: è una prova di trasporto, non di resa
    stitch: {
      thread_distance_um: 455,
      stitch_length_mm: 2.8,
      min_stitch_length_mm: 0.3,
      max_stitch_length_mm: null,
      elongation_pct: null,
      pull_x_pct: 100,
      pull_y_pct: 100,
      underlay: { density_pt_cm: 8, edge_distance_mm: null },
    },
    machine: { needle: 1, thread_color: '#ede300' },
    covered_by_object_id: null,
    visibility_policy: 'visible',
    confidence: 'high',
  })),
};

mkdirSync(uscita, { recursive: true });
writeFileSync(new URL('macchie.batch.json', uscita), JSON.stringify(programma, null, 2));

// la stessa cosa da guardare: pannello, macchie passate al bridge, e la direzione del raso
const tracciato = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z';
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mm(larghezza)} ${mm(altezza)}" width="${mm(larghezza)}mm" height="${mm(altezza)}mm">`,
  `<path d="${tracciato(pannello.map((p) => [mm(p.x), mm(p.y)]))}" fill="none" stroke="#e52521" stroke-width="0.3"/>`,
  ...programma.objects.map((o) => `<path d="${tracciato(o.geometry.outer)}" fill="#ede300" fill-opacity="0.6" stroke="#8a7a00" stroke-width="0.15"><title>${o.id} · ${o.geometry.outer.length} punti</title></path>`),
  '</svg>',
].join('\n');
writeFileSync(new URL('macchie.batch.svg', uscita), svg);

const punti = programma.objects.map((o) => o.geometry.outer.length);
console.log(`${programma.objects.length} macchie su ${tutte.length} · pannello ${mm(larghezza)} × ${mm(altezza)} mm · punti per contorno ${Math.min(...punti)}–${Math.max(...punti)}`);
console.log(`scritto ${new URL('macchie.batch.json', uscita).pathname}`);

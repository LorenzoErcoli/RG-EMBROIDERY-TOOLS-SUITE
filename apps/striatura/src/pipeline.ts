// Orchestrazione Punto Striato: contorni importati + ruoli-colore + parametri → layer di output.
// Segue la pipeline della COSTITUZIONE §4 (import→ruoli→boundary→placement→export).
import {
  type Contour, type Role, type ExportLayer, type Bounds, type Polyline,
  bounds as boundsOf, pointInPolygon, polygonArea, distance, enforceMinStitch,
  THREAD_STROKE_MM, SHAPE_STROKE_MM,
} from '@rg/core';
import { generateStriatura, layerThreadMm, parametriSecondoLivello, type StriaturaParams } from './engine';

export type RoleAssignment = Record<string, Role | undefined>;

export interface PipelineResult {
  /** Layer per l'ANTEPRIMA a schermo: riferimento + striature (filo) + contorno dei vuoti. */
  layers: ExportLayer[];
  /** Layer per l'EXPORT (SVG/DST): riferimento (shapeOnly) + le striature come un ago unico (mono). */
  exportLayers: ExportLayer[];
  bounds: Bounds;
  /** Lunghezza totale del filo generato (mm), per la statusbar. */
  threadMm: number;
  /** Numero di tratti (polilinee), contati come un filo solo: 1 = nessun salto; >1 = ci sono salti (es. attorno ai vuoti).
   *  Il cambio di filo fra un livello e l'altro non è un salto. */
  blockCount: number;
  /** I passaggi fra le macchie, già cuciti nelle striature: per misurarli e per evidenziarli nell'anteprima. */
  passaggi: Polyline[];
  /** Filo di passaggio che resta in vista (mm) e filo che il ricamo sopra coprirà (mm). */
  passaggiInVistaMm: number;
  passaggiCopertiMm: number;
}

const COLORS = {
  reference: '#d0d0d0',
  fillFallback: '#1a1a1a',
  voidOutline: '#e06666',
  coverOutline: '#2f9e6e',
  passaggi: '#e8590c',
};

function contoursWithRole(contours: Contour[], roles: RoleAssignment, role: Role): Contour[] {
  return contours.filter((c) => roles[c.color] === role);
}

/**
 * Passo 8 della pipeline canonica — MIN-STITCH (R3): il minimo si impone **dopo** connessione e
 * routing, mai prima. Il motore campiona a passo massimo (R4) e le giunzioni fra celle, tragitti e
 * corridoi reintroducono micro-segmenti: è qui che spariscono.
 * `enforceMinStitch` del core preserva gli estremi (R3) — per questo non può togliere da solo un
 * ultimo punto duplicato, e lo togliamo noi: un segmento di lunghezza zero è un punto nello stesso
 * buco. Misurato sul rettangolo di prova: 204 segmenti sotto il minimo → 0, filo −0,25%, e il passo
 * massimo resta identico (2.999mm), cioè il pass NON allunga i punti (vincolo di Lorenzo).
 */
function minStitched(pl: Polyline, minMm: number): Polyline {
  return senzaDoppi(enforceMinStitch(pl, minMm));
}
function senzaDoppi(pl: Polyline): Polyline {
  const out = pl.slice();
  while (out.length >= 2 && distance(out[out.length - 1], out[out.length - 2]) < 1e-9) out.pop();
  return out;
}

/** Quanti mm dei passaggi restano fuori dalle zone del ricamo sopra, e quanti ci stanno sotto. */
function misuraPassaggi(passaggi: Polyline[], coperte: Polyline[]): { inVista: number; coperti: number } {
  let inVista = 0, coperti = 0;
  const scatole = coperte.map((z) => ({ z, b: boundsOf(z) }));
  const sotto = (q: { x: number; y: number }) => scatole.some(({ z, b }) =>
    q.x >= b.minX && q.x <= b.maxX && q.y >= b.minY && q.y <= b.maxY && pointInPolygon(q, z));
  for (const pl of passaggi) {
    for (let i = 1; i < pl.length; i++) {
      const a = pl[i - 1], b = pl[i];
      const d = distance(a, b);
      const n = coperte.length ? Math.max(1, Math.ceil(d / 0.5)) : 1;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (sotto(q)) coperti += d / n; else inVista += d / n;
      }
    }
  }
  return { inVista, coperti };
}

export function runPipeline(
  contours: Contour[],
  roles: RoleAssignment,
  params: StriaturaParams,
): PipelineResult {
  const all: Polyline = contours.flatMap((c) => c.points);
  const bnds: Bounds = all.length ? boundsOf(all) : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const master = contoursWithRole(contours, roles, 'MASTER_OUTLINE').filter((c) => c.closed);
  const exclusions = contoursWithRole(contours, roles, 'EXCLUSION').filter((c) => c.closed).map((c) => c.points);
  const coperte = contoursWithRole(contours, roles, 'COVER_AREA').filter((c) => c.closed).map((c) => c.points);
  const fillColor = params.color && params.color !== 'none' ? params.color : COLORS.fillFallback;

  const layers: ExportLayer[] = [];
  // Riferimento: tutti i contorni importati, tenui (aiuta a leggere l'anteprima).
  layers.push({
    id: 'reference', color: COLORS.reference,
    polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true,
  });

  // GENERA: un filo di striature per ogni contorno-area (MASTER_OUTLINE), rispettando i vuoti interni (R5).
  // Aree più grandi prima (stabilità), come per gli altri tool.
  const areas = master.slice().sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  const passaggi: Polyline[] = [];
  const unLivello = (p: StriaturaParams, giaCucito: Polyline[]): Polyline[] => {
    const fatti: Polyline[] = [];
    for (const m of areas) {
      const innerVoids = exclusions.filter((v) => v.length > 0 && pointInPolygon(v[0], m.points));
      for (const gl of generateStriatura({ outline: m.points, voids: innerVoids, coperte, giaCucito }, p)) {
        for (const pl of gl.polylines) {
          const s = gl.minimoFatto ? senzaDoppi(pl) : minStitched(pl, p.minStitchMm);
          if (s.length >= 2) fatti.push(s);
        }
        if (gl.passaggi) passaggi.push(...gl.passaggi);
      }
    }
    return fatti;
  };
  const allPolylines = unLivello({ ...params, color: fillColor }, []);
  const color2 = params.color2 && params.color2 !== 'none' ? params.color2 : COLORS.fillFallback;
  // Il secondo sta tutto dopo il primo: le striature dei due non vanno a registro, non serve alternarli zona per zona.
  const secondo = params.secondLevel ? unLivello({ ...parametriSecondoLivello(params), color: color2 }, allPolylines) : [];
  const threadMm = layerThreadMm({ color: fillColor, polylines: allPolylines }) + layerThreadMm({ color: color2, polylines: secondo });

  // --- ANTEPRIMA: il filo si disegna sottile (R15); contorno dei vuoti tenue per mostrare che sono rispettati. ---
  if (allPolylines.length) {
    layers.push({ id: 'striatura', color: fillColor, polylines: allPolylines, strokeMm: THREAD_STROKE_MM });
  }
  if (secondo.length) {
    layers.push({ id: 'striatura2', color: color2, polylines: secondo, strokeMm: THREAD_STROKE_MM });
  }
  if (exclusions.length) {
    layers.push({ id: 'void', color: COLORS.voidOutline, polylines: exclusions, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }
  if (coperte.length) {
    layers.push({ id: 'ricamo-sopra', color: COLORS.coverOutline, polylines: coperte, strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
  }
  if (passaggi.length) {
    layers.push({ id: 'passaggi', color: COLORS.passaggi, polylines: passaggi, strokeMm: THREAD_STROKE_MM, shapeOnly: true });
  }

  // --- EXPORT: riferimento (shapeOnly, non cucito) + le striature come UN ago (mono). I salti tra le
  //     polilinee diventano jump macchina; il multicolore futuro aggiungerà altri layer/aghi. ---
  const exportLayers: ExportLayer[] = [
    { id: 'reference', color: COLORS.reference, polylines: contours.map((c) => c.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true },
  ];
  if (allPolylines.length) {
    exportLayers.push({ id: 'striatura', color: fillColor, polylines: allPolylines, strokeMm: THREAD_STROKE_MM });
  }
  if (secondo.length) {
    exportLayers.push({ id: 'striatura2', color: color2, polylines: secondo, strokeMm: THREAD_STROKE_MM });
  }

  const { inVista, coperti } = misuraPassaggi(passaggi, coperte);
  return {
    layers, exportLayers, bounds: bnds, threadMm, blockCount: allPolylines.length + Math.max(0, secondo.length - 1),
    passaggi, passaggiInVistaMm: inVista, passaggiCopertiMm: coperti,
  };
}

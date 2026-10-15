// Il contratto del motore (K1b) per Oblique (Broderie Anglaise): avvolge `generateOblique`, senza cambiare niente.
// Qui stanno anche i passi puri che tool.ts faceva prima di chiamarlo (confini dai ruoli, ingombro del cartamodello,
// piazzamento che segue il pattern) e come i livelli diventano strati: tool.ts li chiama da qui.
import { THREAD_STROKE_MM, SHAPE_STROKE_MM, type Contour, type ExportLayer, refertoDaStrati } from '@rg/core';
import type { Ingresso, Motore } from '@rg/cervello';
import {
  generateOblique, contourBoundary, rectBounds,
  type ObliqueParams, type ObliqueModule, type ObliqueSources, type RoleBoundaries, type Boundary,
  type Stroke, type RawPolyline, type ObliqueResult,
} from './engine';

export type ObliqueRole = 'MASTER_OUTLINE' | 'PATTERN_REFERENCE' | 'LASER_REFERENCE' | 'PLACEMENT_REFERENCE';

/** I 4 moduli del motivo (asset fissi del tool: livello 0, 1, 2 e fori). */
export interface ModuliOblique {
  level0: ObliqueModule;
  level1: ObliqueModule;
  level2: ObliqueModule;
  holes: ObliqueModule;
}

/**
 * Oltre ai moduli, quello che l'utente porta o sceglie a mano: il cartamodello (`sagoma`, contorni GIÀ alla misura
 * vera, R11) e il colore di ogni ruolo (confine, pattern, fori, piazzamento). Senza sagoma il formato è quello dei params.
 */
export interface IngressoOblique extends Ingresso {
  moduli: ModuliOblique;
  ruoli: Partial<Record<ObliqueRole, string>>;
}

// Colori di anteprima per livello (la preview è una vista, il filo si disegna sottile — R15).
export const LAYER_COLOR: Record<string, string> = {
  level0: '#1a9e5f', level05: '#12b5b5', level1: '#2277cc', level2: '#111111',
  holes: '#e52421', travel: '#c98a2b', boundary: '#9aa0a6',
};

export function roleBoundary(sagoma: Contour[] | undefined, ruoli: IngressoOblique['ruoli'], role: ObliqueRole, tol: number): Boundary | undefined {
  if (!sagoma?.length) return undefined;
  const color = ruoli[role] || null;
  if (!color) return undefined;
  const pts = sagoma.filter((c) => c.color === color).map((c) => c.points);
  return contourBoundary(pts, role.toLowerCase(), tol) ?? undefined;
}

/**
 * Contorno più grande del cartamodello, ricavato da TUTTI i suoi tracciati (porting di
 * sourceContourBoundary sul pannello intero). È il gradino di mezzo dell'originale: finché
 * l'utente non assegna il colore "Pannello" si lavora comunque sulla sagoma vera, non sul
 * rettangolo che la contiene.
 */
export function panelContour(sagoma: Contour[] | undefined, tol: number): Boundary | undefined {
  if (!sagoma?.length) return undefined;
  return contourBoundary(sagoma.map((c) => c.points), 'pattern', tol) ?? undefined;
}

export function buildRoles(sagoma: Contour[] | undefined, ruoli: IngressoOblique['ruoli'], tol: number): RoleBoundaries {
  return {
    master: roleBoundary(sagoma, ruoli, 'MASTER_OUTLINE', tol), pattern: roleBoundary(sagoma, ruoli, 'PATTERN_REFERENCE', tol),
    laser: roleBoundary(sagoma, ruoli, 'LASER_REFERENCE', tol), placement: roleBoundary(sagoma, ruoli, 'PLACEMENT_REFERENCE', tol),
  };
}

export function panelBounds(sagoma: Contour[] | undefined): ObliqueSources['panelBounds'] {
  if (!sagoma?.length) return undefined;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of sagoma) for (const p of c.points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return Number.isFinite(minX) ? rectBounds(minX, minY, maxX - minX, maxY - minY) : undefined;
}

export function obliqueSources(moduli: ModuliOblique, sagoma: Contour[] | undefined): ObliqueSources {
  return { level0: moduli.level0, level1: moduli.level1, level2: moduli.level2, holes: moduli.holes, panelBounds: panelBounds(sagoma) };
}

/** Piazzamento e pattern dello stesso colore: il piazzamento segue il perimetro del pattern. */
export const placementFollows = (ruoli: IngressoOblique['ruoli']): boolean =>
  !!ruoli.PLACEMENT_REFERENCE && ruoli.PLACEMENT_REFERENCE === ruoli.PATTERN_REFERENCE;

/** La generazione completa, come la chiamava tool.ts (render). */
export function generaOblique(moduli: ModuliOblique, sagoma: Contour[] | undefined, ruoli: IngressoOblique['ruoli'], params: ObliqueParams): ObliqueResult {
  const tol = params.perimeterCloseTolerance;
  return generateOblique(obliqueSources(moduli, sagoma), params, {
    roles: buildRoles(sagoma, ruoli, tol), panelContour: panelContour(sagoma, tol), placementFollowsPattern: placementFollows(ruoli),
  });
}

export const strokesToLayer = (id: string, strokes: Stroke[]): ExportLayer => ({ id, color: LAYER_COLOR[id] || '#111', polylines: strokes.map((s) => s.points), strokeMm: THREAD_STROKE_MM });
export const holesToLayer = (holes: RawPolyline[]): ExportLayer => ({ id: 'holes', color: LAYER_COLOR.holes, polylines: holes.map((h) => h.points), strokeMm: SHAPE_STROKE_MM, shapeOnly: true });
export function exportLayersFor(res: ObliqueResult): ExportLayer[] {
  const layers: ExportLayer[] = [];
  if (res.level0.length) layers.push(strokesToLayer('level0', res.level0));
  if (res.level05.length) layers.push(strokesToLayer('level05', res.level05));
  if (res.level1.length) layers.push(strokesToLayer('level1', res.level1));
  if (res.level2.length) layers.push(strokesToLayer('level2', res.level2));
  if (res.holes.length) layers.push(holesToLayer(res.holes));
  return layers;
}

export const motore: Motore<IngressoOblique, ObliqueParams> = {
  id: 'oblique',
  async genera(ingresso, params) {
    const res = generaOblique(ingresso.moduli, ingresso.sagoma, ingresso.ruoli, params);
    const strati = exportLayersFor(res);
    return { strati, avvisi: [], misure: refertoDaStrati(strati) };
  },
};

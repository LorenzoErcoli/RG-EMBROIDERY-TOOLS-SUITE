import { parseImportedBoundarySource, readZones, resolveZoneAngles, zonesFromShapes, buildZonePlan, patternKeysInUse, type ZoneRole } from '@rg/pattern-grammar';
import { PATTERN_FIELDS, ZONE_GROUP } from '../../apps/zone-pattern/src/fields';

// Il cannage di Lorenzo (37 zone, 6 tinte), tre tinte con un pattern (A, B) e le altre accoppiate;
// i valori di partenza sono quelli che il tool mette nella config (campi delle zone + quelli di ogni ago in uso).
export async function prova() {
  // il bundle è «neutral»: fs si carica con un import non letterale
  const modulo = 'node:fs';
  const { readFileSync } = await import(modulo) as typeof import('node:fs');
  const svg = readFileSync(new URL('../fixtures/cannage-zone.svg', import.meta.url), 'utf8');
  const modello = parseImportedBoundarySource(svg, 'cannage-zone.svg', { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zone = readZones(modello).map((z) => ({ id: z.id, color: z.color, points: z.points }));
  const ruoli: Record<string, ZoneRole> = {
    '#ff2eaf': { pattern: 'A', angleDeg: 45 }, '#cd00ff': { pattern: 'A', angleDeg: 45 },
    '#f40000': { pattern: 'B', angleDeg: 15 }, '#f29b27': { pattern: 'B', angleDeg: 15 },
    '#0018f9': { pattern: 'off', angleDeg: 0 }, '#00f700': { pattern: 'off', angleDeg: 0 },
  };
  const params: Record<string, number | string | boolean> = {};
  for (const f of ZONE_GROUP.fields) params[f.name] = f.value;
  for (const k of patternKeysInUse(ruoli)) for (const f of PATTERN_FIELDS) params[`${k}.${f.name}`] = f.value;
  return {
    ingresso: { zone, ruoli },
    params,
    // la strada di prima: la chiamata che faceva tool.ts (refreshZones + buildZonePlan), strati = plan.layers (il DST)
    diretto: () => {
      const zoneRisolte = resolveZoneAngles(zonesFromShapes(zone, Number(params.minAreaMm2) || 0), 20);
      const keys = patternKeysInUse(ruoli);
      const patternOf = (key: string) => {
        const out: Record<string, unknown> = {};
        for (const [n, v] of Object.entries(params)) if (n.startsWith(`${key}.`)) out[n.slice(key.length + 1)] = v;
        return out;
      };
      return buildZonePlan(zoneRisolte, {
        roles: ruoli,
        patterns: Object.fromEntries(keys.map((k) => [k, patternOf(k) as never])),
        marginMm: Number(params.marginMm),
        rowHeightMm: Number(params.rowHeightMm),
        travelMode: params.travelMode === 'none' ? 'none' : 'edges',
        travelStitchMm: Number(params.travelStitchMm),
        cleanupMinStitchMm: Number(params.cleanupMinStitchMm),
        outerMarginMm: Number(params.outerMarginMm),
      }).layers;
    },
  };
}

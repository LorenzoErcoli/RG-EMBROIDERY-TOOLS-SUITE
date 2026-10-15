// Il contratto del motore (K1b) per Pattern a zone: avvolge `buildZonePlan`, senza cambiare niente.
// La sequenza «zone → piano» sta qui (funzioni pure, niente DOM) e la chiama anche tool.ts.
import type { Ingresso, Motore } from '@rg/cervello';
import {
  buildZonePlan, patternKeysInUse, resolveZoneAngles, zonesFromShapes,
  type PatternConfig, type PatternKey, type Zone, type ZonePlan, type ZoneRole, type ZoneShape,
} from '@rg/pattern-grammar';

/** La config piatta del tool (`params` nel file di progetto): `marginMm`… più `A.stepX`, `B.stepX`… per ogni ago. */
export type ParamsZone = Record<string, number | string | boolean>;

/** Estrae il `PatternConfig` di un ago dalle chiavi prefissate (`C.stepX` → `stepX`). */
export function patternOf(cfg: ParamsZone, key: PatternKey): PatternConfig {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(cfg)) {
    if (name.startsWith(`${key}.`)) out[name.slice(key.length + 1)] = value;
  }
  return out as PatternConfig;
}

/** Le zone dalla geometria grezza del cartamodello (area minima, angoli di famiglia a 20°). */
export function zoneDaForme(forme: ZoneShape[], cfg: ParamsZone): Zone[] {
  return resolveZoneAngles(zonesFromShapes(forme, Number(cfg.minAreaMm2) || 0), 20);
}

/** Il piano: ogni zona riempita col pattern della sua tinta, un ago per lettera in uso. */
export function pianoDelleZone(zone: Zone[], ruoli: Record<string, ZoneRole>, cfg: ParamsZone): ZonePlan {
  const keys = patternKeysInUse(ruoli);
  return buildZonePlan(zone, {
    roles: ruoli,
    patterns: Object.fromEntries(keys.map((key) => [key, patternOf(cfg, key)])),
    marginMm: Number(cfg.marginMm),
    rowHeightMm: Number(cfg.rowHeightMm),
    travelMode: cfg.travelMode === 'none' ? 'none' : 'edges',
    travelStitchMm: Number(cfg.travelStitchMm),
    cleanupMinStitchMm: Number(cfg.cleanupMinStitchMm),
    outerMarginMm: Number(cfg.outerMarginMm),
  });
}

/** Oltre al disegno: le zone (geometria grezza) e il ruolo di ogni tinta (pattern/angolo/scarico), scelti a mano. */
export interface IngressoZone extends Ingresso {
  zone: ZoneShape[];
  ruoli: Record<string, ZoneRole>;
}

export const motore: Motore<IngressoZone, ParamsZone> = {
  id: 'zone-pattern',
  async genera(ingresso, params) {
    const piano = pianoDelleZone(zoneDaForme(ingresso.zone, params), ingresso.ruoli, params);
    // Gli strati sono quelli del DST: un layer per ago, in ordine.
    return { strati: piano.layers, avvisi: [...piano.warnings] };
  },
};

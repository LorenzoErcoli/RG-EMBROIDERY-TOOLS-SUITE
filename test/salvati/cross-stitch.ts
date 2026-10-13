import type { Valore } from '../../packages/cervello/src/tipi';
import { DEFAULT_GRID, DEFAULT_KNIT } from '../../apps/cross-stitch/src/model';
import { DEFAULT_ROUTE, DEFAULT_STITCH, RETRACE_PRESETS } from '../../apps/cross-stitch/src/routing';
import { DEFAULT_ZONES } from '../../apps/cross-stitch/src/zones';

// Cosa salva il Punto croce nel progetto (metadata `rgProject: 'cross-stitch'`), dai suoi default:
// grid, route (+ zones, strips, costs.retrace che il pannello scrive), stitch, knit.
// Fuori perché dati e non parametri: threads, cells, area, cuts, forced, module, shape, e in route
// base/groups/areas/passesByColor/pieceOf/mask. Nel progetto di default il pannello mostra questi valori
// anche dove l'oggetto non c'è ancora (zones, strips, costs, trimJumps, baseWhole, blocks, overlapPct).
export function salvati(): Record<string, Valore> {
  const out: Record<string, Valore> = {};
  const metti = (dove: string, o: object) => { for (const [k, v] of Object.entries(o)) out[`${dove}.${k}`] = v as Valore; };
  metti('grid', { ...DEFAULT_GRID, overlapPct: DEFAULT_GRID.overlapPct ?? 0 });
  metti('route', { ...DEFAULT_ROUTE, blocks: true, baseWhole: true, trimJumps: true });
  metti('route.zones', DEFAULT_ZONES);
  metti('route.strips', { rows: 0, shiftMm: 0 });
  metti('route.costs', { retrace: RETRACE_PRESETS.vista });
  metti('stitch', DEFAULT_STITCH);
  metti('knit', DEFAULT_KNIT);
  return out;
}

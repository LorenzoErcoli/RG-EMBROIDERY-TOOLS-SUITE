import { parseImportedBoundarySource, type PatternConfig } from '@rg/pattern-grammar';
import { PARAMETRI_DAVANTI } from '../../apps/cannage-rafia/src/linee';
import { PARAMETRI_STOP } from '../../apps/cannage-rafia/src/stop';
import { PARAMETRI_CORNICE } from '../../apps/cannage-rafia/src/cornice';
import { PARAMETRI_BORDATURA } from '../../apps/cannage-rafia/src/bordatura';
import { BASI_PREDEFINITE, BASI_VALORI, PROGRAMMA_VALORI, valoriCorniceDa, valoriDa } from '../../apps/cannage-rafia/src/fields';
import { reticoloDaZone, zoneDaModello } from '../../apps/cannage-rafia/src/reticolo';
import { sagomaDaZone } from '../../apps/cannage-rafia/src/sagoma';
import { stopBase, stopContorno, stopCornice, stopGriglia, stopLinee, stratiProgramma, conPuntoMinimo, unisciTratti, type Stop } from '../../apps/cannage-rafia/src/programma';
import { parametriCorniceDa, parametriDa, parametriStopDa } from '../../apps/cannage-rafia/src/fields';
import type { Ruolo } from '../../apps/cannage-rafia/src/motore';

// Il cannage vero di Lorenzo (fixture: 37 zone, 6 tinte): rosa = pattern 1, viola = pattern 2, come al primo
// caricamento nel tool (le prime due tinte con rombi interi), e i valori di partenza di ognuna delle sei chiavi.
export async function prova() {
  // il bundle è «neutral» (niente builtin di node nei sorgenti): si carica fs con un import non letterale
  const modulo = 'node:fs';
  const { readFileSync } = await import(modulo) as typeof import('node:fs');
  const radice = new URL('../../', import.meta.url);
  const model = parseImportedBoundarySource(readFileSync(new URL('test/fixtures/cannage-zone.svg', radice), 'utf8'), 'cannage-zone.svg',
    { scaleMode: 'illustrator-72dpi', paintPriority: 'fill' });
  const zone = zoneDaModello(model);
  const presets = JSON.parse(readFileSync(new URL('apps/pattern-grammar/src/presets.shared.json', radice), 'utf8')) as Record<string, PatternConfig>;
  const ruoli: Record<string, Ruolo> = {};
  for (const c of [...new Set(zone.map((z) => z.color ?? ''))]) {
    let rombi = 0;
    try { rombi = reticoloDaZone(zone, c).rombiInteri; } catch { /* nessun rombo intero */ }
    const presi = Object.values(ruoli);
    ruoli[c] = rombi > 0 && !presi.includes('pattern1') ? 'pattern1' : rombi > 0 && !presi.includes('pattern2') ? 'pattern2' : '';
  }
  const basi = { p1: BASI_PREDEFINITE.p1 in presets ? BASI_PREDEFINITE.p1 : Object.keys(presets)[0], p2: BASI_PREDEFINITE.p2 in presets ? BASI_PREDEFINITE.p2 : Object.keys(presets)[0] };
  const params = {
    params: valoriDa(PARAMETRI_DAVANTI), stop: { ...PARAMETRI_STOP }, basiParams: { ...BASI_VALORI },
    cornice: valoriCorniceDa(PARAMETRI_CORNICE), programma: { ...PROGRAMMA_VALORI }, bordatura: { ...PARAMETRI_BORDATURA },
  };
  return {
    ingresso: { zone, linee: [], ruoli, basi, presets, latiScelti: [] },
    params,
    // la strada di prima: la sequenza che faceva aggiorna() in tool.ts (stop 1-6, nessuna bordatura), poi stratiProgramma
    diretto: () => {
      const p1 = Object.keys(ruoli).find((c) => ruoli[c] === 'pattern1') ?? '';
      const p2 = Object.keys(ruoli).find((c) => ruoli[c] === 'pattern2') ?? '';
      const pattern = [p1, p2].filter(Boolean);
      const tinte = [...new Set(zone.map((z) => z.color ?? ''))];
      const sagoma = sagomaDaZone(zone, pattern.length === 2 ? tinte.filter((c) => !pattern.includes(c)) : []);
      const parStop = parametriStopDa(params.stop);
      const lettura = reticoloDaZone(zone, p1);
      const scarico = { colori: [] as string[], percento: Number(params.basiParams.reliefPercent) || 0 };
      const stop: Stop[] = [stopContorno(sagoma, parStop), stopGriglia(lettura.reticolo, sagoma, parStop),
        stopBase(3, zone, p1, presets[basi.p1], scarico), stopBase(4, zone, p2, presets[basi.p2], scarico)];
      const s5 = stopLinee(lettura.reticolo, sagoma, parametriDa(params.params), [], []);
      stop.push(s5, stopCornice(lettura.reticolo, sagoma, parametriCorniceDa(params.cornice), s5.risultato.ingombri, []));
      const minimo = Number(params.programma.puntoMinimo) || 0;
      return stratiProgramma(stop.map((s) => conPuntoMinimo(unisciTratti(s), minimo)));
    },
  };
}

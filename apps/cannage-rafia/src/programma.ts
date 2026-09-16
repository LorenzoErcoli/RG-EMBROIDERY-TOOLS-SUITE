// Cannage rafia — il programma completo, stop per stop, come esce in DST (Lorenzo, 15/09):
//   1. contorno a impunture
//   2. griglia che blocca i materiali, col suo contorno
//   3. base del pattern 1
//   4. base del pattern 2
//   5. linee orizzontali e verticali
//   6. cornice nei rombi
// Le basi le fa il motore delle zone di @rg/pattern-grammar (lo stesso di Pattern a zone), con angolo 0:
// nel cannage rafia i rombi sono dritti e le colonne del pattern verticali.
import { buildZonePlan, makeZone, PATTERN_INKS, RELIEF_ROLE, type PatternConfig, type ZoneRole } from '@rg/pattern-grammar';
import { enforceMinStitch, type ExportLayer } from '@rg/core';
import { generaLinee, type Ingombro, type ParametriLinee, type Punto, type Reticolo, type RisultatoLinee } from './linee';
import { contornoImpunture, grigliaBloccaggio, type ParametriStop } from './stop';
import { generaCornice, type ParametriCornice, type RisultatoCornice } from './cornice';
import type { Sagoma } from './sagoma';
import type { Zona } from './reticolo';

export type Stop = { numero: number; nome: string; blocchi: Punto[][]; punti: number };

const conta = (blocchi: Punto[][]) => blocchi.reduce((s, b) => s + Math.max(0, b.length - 1), 0);

export function stopContorno(contorno: Punto[] | Sagoma, par: ParametriStop): Stop {
  const blocchi = contornoImpunture(contorno, par.puntoContorno);
  return { numero: 1, nome: 'Contorno a impunture', blocchi, punti: conta(blocchi) };
}

export function stopGriglia(ret: Reticolo, contorno: Punto[] | Sagoma, par: ParametriStop): Stop & { linee: number } {
  const g = grigliaBloccaggio(ret, contorno, par);
  const blocchi = [...g.contorno, g.griglia].filter((b) => b.length > 1);
  // dal contorno alla griglia il filo non si stacca: pochi millimetri di impuntura sul bordo
  if (g.contorno.length === 1 && g.griglia.length > 1 && blocchi.length === 2) {
    const [bordo, griglia] = blocchi;
    const da = bordo[bordo.length - 1], a = griglia[0];
    const n = Math.max(1, Math.ceil(Math.hypot(a.x - da.x, a.y - da.y) / par.puntoGriglia));
    const passaggio = Array.from({ length: n }, (_, i) => ({ x: da.x + ((a.x - da.x) * (i + 1)) / n, y: da.y + ((a.y - da.y) * (i + 1)) / n }));
    blocchi.splice(0, 2, [...bordo, ...passaggio.slice(0, -1), ...griglia]);
  }
  return { numero: 2, nome: 'Griglia che blocca i materiali', blocchi, punti: conta(blocchi), linee: g.linee };
}

/** Le aree di scarico: le tinte che le segnano e quanto alleggerire (50 = metà delle passate). */
export type Scarico = { colori: string[]; percento: number };

/**
 * Una base: le zone di una tinta riempite col suo pattern, a righe da sinistra, coi passaggi sui bordi
 * dei rombi — esattamente come Pattern a zone con quella tinta su un ago solo. Con le AREE DI SCARICO
 * (Lorenzo, 15/09: «come in Pattern a zone») dentro i loro contorni i zig-zag hanno meno passate: è lo
 * stesso ruolo e lo stesso motore, non una copia.
 */
export function stopBase(numero: 3 | 4, zone: Zona[], colore: string, config: PatternConfig, scarico?: Scarico): Stop & { zone: number } {
  const nome = numero === 3 ? 'Base pattern 1' : 'Base pattern 2';
  if (!colore) return { numero, nome, blocchi: [], punti: 0, zone: 0 };
  const zz = zone.map((z, i) => makeZone({ id: `z${i}`, color: z.color ?? '', points: z.points }));
  const roles: Record<string, ZoneRole> = { [colore]: { pattern: 'A', angleDeg: 0 } };
  const alleggerisci = scarico && scarico.percento > 0 && scarico.colori.length > 0;
  if (alleggerisci) for (const c of scarico.colori) if (c !== colore) roles[c] = { pattern: RELIEF_ROLE, angleDeg: 0 };
  const piano = buildZonePlan(zz, {
    roles,
    patterns: { A: alleggerisci ? { ...config, reliefPercent: scarico.percento } : config },
    marginMm: 2,
    rowHeightMm: 0,
    travelMode: 'edges',
    travelStitchMm: 3,
    cleanupMinStitchMm: 0,
    outerMarginMm: 0,
  });
  const blocchi = (piano.layers[0]?.polylines ?? []).map((pl) => pl.map((p) => ({ x: p.x, y: p.y })));
  return { numero, nome, blocchi, punti: conta(blocchi), zone: piano.stitches.length };
}

export function stopLinee(
  ret: Reticolo, contorno: Punto[] | Sagoma, par: ParametriLinee,
  scarico: Punto[][] = [], contornoTermogarze: Punto[][] = [],
): Stop & { risultato: RisultatoLinee } {
  const risultato = generaLinee(ret, contorno, par, scarico, contornoTermogarze);
  return { numero: 5, nome: 'Linee orizzontali e verticali', blocchi: risultato.blocchi, punti: risultato.conteggi.punti, risultato };
}

/** Lo stop 6. `ingombri` sono fermi e barre dello stop 5: la cornice non ci passa sopra. */
export function stopCornice(
  ret: Reticolo, contorno: Punto[] | Sagoma, par: ParametriCornice, ingombri: Ingombro[] = [], scarico: Punto[][] = [],
): Stop & { risultato: RisultatoCornice } {
  const risultato = generaCornice(ret, contorno, par, ingombri, scarico);
  return { numero: 6, nome: 'Cornice nei rombi', blocchi: risultato.blocchi, punti: risultato.conteggi.punti, risultato };
}

/**
 * Il PUNTO MINIMO di tutto il programma (Lorenzo, 16/09: «un vincolo globale che evita i passaggi sotto
 * un tot di millimetri, di default 0,5»): nessun punto più corto, in nessuno stop. È la pulizia del core
 * (R3), la stessa degli altri tool: il primo e l'ultimo punto di ogni tratto restano.
 */
export function conPuntoMinimo(s: Stop, minimoMm: number): Stop {
  if (!(minimoMm > 0)) return s;
  const blocchi = s.blocchi.map((b) => enforceMinStitch(b, minimoMm) as Punto[]);
  return { ...s, blocchi, punti: conta(blocchi) };
}

/**
 * I tratti che si toccano diventano un tratto solo. Le basi escono dal motore delle zone a pezzi (una zona,
 * un passaggio), attaccati capo a capo; ma nel DST ogni pezzo nuovo è un SALTO, anche se lungo 0 mm: sul
 * dietro M3641 erano 315 salti fra base 1 e base 2 (Lorenzo, 16/09: «fa ancora tanti salti»).
 */
export function unisciTratti(s: Stop, tolleranzaMm = 0.05): Stop {
  const blocchi: Punto[][] = [];
  for (const b of s.blocchi) {
    if (b.length < 2) continue;
    const prima = blocchi[blocchi.length - 1];
    const fine = prima?.[prima.length - 1];
    if (prima && Math.hypot(b[0].x - fine.x, b[0].y - fine.y) <= tolleranzaMm) prima.push(...b.slice(1));
    else blocchi.push(b.slice());
  }
  return { ...s, blocchi, punti: conta(blocchi) };
}

/** Colore d'anteprima e d'export dello stop: la palette categoriale del DS, uno per stop. */
export const coloreStop = (numero: number) => PATTERN_INKS[(numero - 1) % PATTERN_INKS.length];

/** Gli stop in ordine, uno strato per stop: in DST ogni strato è un cambio-colore (R31). */
export function stratiProgramma(stop: Stop[]): ExportLayer[] {
  return stop
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .filter((s) => s.blocchi.some((b) => b.length > 1))
    .map((s) => ({ id: `stop-${s.numero}`, color: coloreStop(s.numero), polylines: s.blocchi }));
}

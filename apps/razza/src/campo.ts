// IL CAMPO DEI DIAMETRI — quanto dev'essere grande un pallino in ogni punto del pezzo.
//
// Regola di Lorenzo (2026-10-06): **piccoli ai bordi, grandi verso il centro**. «Centro» qui non e' il centro
// del rettangolo che contiene il pezzo: e' quanto sei LONTANO DAL BORDO, cosi' una sagoma a U ha i pallini
// grandi nel mezzo di ogni braccio e piccoli lungo tutti i suoi bordi, compreso quello dell'apertura.
// (La prima versione guardava solo la x: dava grandi nel mezzo dello swatch e piccoli ai due lati corti — non
// «verso il centro» del pezzo vero.)
//
// Due modi di dirgli diversamente cosa fare, come in Illustrator:
//  - le LINEE DI SFUMATURA: una linea da A a B, diametro piccolo in A e grande in B (o viceversa) — il verso
//    e' la linea. Con piu' linee comanda quella piu' vicina.
//  - i PALLINI FISSI: misura e posizione scelte da lui; la loro misura tira quella dei vicini (`influenzaFissiMm`)
//    e da li' nasce il resto del ricamo.
import type { Point } from '@rg/core';
import { MappaDistanze, rumore } from './geo';
import type { Fisso, ParametriRazza, Pezzo, Sfumatura } from './tipi';

const liscio = (t: number): number => t * t * (3 - 2 * t);
const limita = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Il valore (da 0 a 1) di una sfumatura in un punto: la posizione lungo la linea, tenuta fra A e B. */
function posizioneLungoLinea(s: Sfumatura, x: number, y: number): { t: number; distanza: number } {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) return { t: 0, distanza: Math.hypot(x - s.a.x, y - s.a.y) };
  const t = limita(((x - s.a.x) * dx + (y - s.a.y) * dy) / L2, 0, 1);
  return { t, distanza: Math.hypot(x - (s.a.x + dx * t), y - (s.a.y + dy * t)) };
}

export interface CampoDiametri {
  /** Il diametro voluto in (x,y). */
  (x: number, y: number): number;
}

export function creaCampo(pz: Pezzo, par: ParametriRazza, fissi: Fisso[], sfumature: Sfumatura[], mappa: MappaDistanze): CampoDiametri {
  const profondita = Math.max(1, par.profonditaMm > 0 ? par.profonditaMm : mappa.massima * 0.9);
  const media = (par.diamMinMm + par.diamMaxMm) / 2;
  const basso = Math.min(par.diamMinMm, ...fissi.map((f) => f.diamMm), ...sfumature.flatMap((s) => [s.diamAMm, s.diamBMm]));
  const alto = Math.max(par.diamMaxMm, ...fissi.map((f) => f.diamMm), ...sfumature.flatMap((s) => [s.diamAMm, s.diamBMm]));

  const dalBordo = (x: number, y: number): number => {
    if (par.modoCampo === 'uniforme') return media;
    let t = liscio(limita(mappa.alla(x, y) / profondita, 0, 1));
    t = Math.pow(t, Math.max(0.2, par.curvaBordo));
    if (par.rumoreCampo > 0) {
      // chiazze: il rumore SCALA il valore, cosi' sul bordo (t = 0) i pallini restano piccoli comunque
      const n = 0.65 * rumore(x / par.scalaCampoMm, y / par.scalaCampoMm, par.seed) + 0.35 * rumore((2.3 * x) / par.scalaCampoMm, (2.3 * y) / par.scalaCampoMm, par.seed + 7);
      t = limita(t * (1 + par.rumoreCampo * 2.2 * (n - 0.5) * 2), 0, 1);
    }
    return par.diamMinMm + (par.diamMaxMm - par.diamMinMm) * t;
  };

  const daSfumature = (x: number, y: number): number => {
    let somma = 0, peso = 0;
    for (const s of sfumature) {
      const { t, distanza } = posizioneLungoLinea(s, x, y);
      const w = 1 / (1 + (distanza / 15) ** 2);
      somma += w * (s.diamAMm + (s.diamBMm - s.diamAMm) * t); peso += w;
    }
    return peso > 0 ? somma / peso : media;
  };

  return (x: number, y: number): number => {
    let d = dalBordo(x, y);
    if (sfumature.length && par.pesoSfumature > 0) d = d * (1 - par.pesoSfumature) + daSfumature(x, y) * par.pesoSfumature;
    if (fissi.length) {
      // la misura di un fisso tira quella dei vicini: del tutto sopra di lui, per niente oltre la sua influenza
      let kMax = 0, sf = 0, sk = 0;
      for (const f of fissi) {
        const k = 1 - liscio(limita((Math.hypot(x - f.x, y - f.y) - f.diamMm / 2) / Math.max(1, par.influenzaFissiMm), 0, 1));
        if (k > 0) { sf += k * f.diamMm; sk += k; if (k > kMax) kMax = k; }
      }
      if (sk > 0) d = d * (1 - kMax) + (sf / sk) * kMax;
    }
    return limita(d, basso, alto);
  };
}

/** Un angolo di comodo per i test e per l'anteprima: il diametro lungo una linea che parte da `da` e va a `a`. */
export function campionaLungo(campo: CampoDiametri, da: Point, a: Point, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); out.push(campo(da.x + (a.x - da.x) * t, da.y + (a.y - da.y) * t)); }
  return out;
}

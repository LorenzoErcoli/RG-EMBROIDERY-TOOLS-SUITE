// Le REGIONI DI PROVA del prototipo. Sintetiche di proposito: servono a misurare, non a piacere.
//
// La forma che conta è la **banda curva che si allarga**. Ha le due proprietà che rompono il raso
// a angolo fisso, e le ha separate, così quando una misura peggiora si sa quale delle due l'ha
// fatto peggiorare:
//   - **ruota** (la direzione giusta a un capo non è quella giusta all'altro);
//   - **si allarga** (le file divergono: è lì che il passo costante si perde).
// Il **ventaglio** aggiunge il caso in cui la divergenza è nota in anticipo — le file corrono lungo
// i raggi, quindi da r=18 a r=70 il passo di chi le segue senza correggere cresce esattamente di
// 70/18 = 3,9 volte. Un numero da confrontare con la misura: se non esce quello, sbaglia la misura.

import { type Point, type Polyline } from '@rg/core';
import { makeRegion, type Region } from '@rg/core';

const gradi = (d: number): number => (d * Math.PI) / 180;

/** Banda curva che si allarga: centro dell'arco, raggio, apertura, semi-larghezza ai due capi. */
export function bandaCurva(
  center: Point, raggio: number, da: number, a: number, w0: number, w1: number, passi = 160,
): Polyline {
  const sinistra: Point[] = [], destra: Point[] = [];
  for (let i = 0; i <= passi; i++) {
    const t = i / passi;
    const ang = gradi(da + (a - da) * t);
    const c = { x: center.x + raggio * Math.cos(ang), y: center.y + raggio * Math.sin(ang) };
    const n = { x: Math.cos(ang), y: Math.sin(ang) };          // il raggio è la normale alla curva
    const w = w0 + (w1 - w0) * t;
    sinistra.push({ x: c.x + n.x * w, y: c.y + n.y * w });
    destra.push({ x: c.x - n.x * w, y: c.y - n.y * w });
  }
  return [...sinistra, ...destra.reverse()];
}

/** Settore di corona circolare: il ventaglio. */
export function ventaglio(
  center: Point, rIn: number, rOut: number, da: number, a: number, passi = 160,
): Polyline {
  const out: Point[] = [];
  for (let i = 0; i <= passi; i++) {
    const ang = gradi(da + (a - da) * (i / passi));
    out.push({ x: center.x + rOut * Math.cos(ang), y: center.y + rOut * Math.sin(ang) });
  }
  for (let i = passi; i >= 0; i--) {
    const ang = gradi(da + (a - da) * (i / passi));
    out.push({ x: center.x + rIn * Math.cos(ang), y: center.y + rIn * Math.sin(ang) });
  }
  return out;
}

export function cerchio(center: Point, raggio: number, passi = 64): Polyline {
  const out: Point[] = [];
  for (let i = 0; i < passi; i++) {
    const ang = (2 * Math.PI * i) / passi;
    out.push({ x: center.x + raggio * Math.cos(ang), y: center.y + raggio * Math.sin(ang) });
  }
  return out;
}

export interface RegioneDiProva {
  id: string;
  descrizione: string;
  region: Region;
  /** Quale campo di direzione ha senso qui: `armonico` dalla forma, `radiale` attorno a un centro. */
  campo: { tipo: 'armonico' } | { tipo: 'radiale'; centro: Point };
}

export function regioniDiProva(): RegioneDiProva[] {
  const centroBanda = { x: 95, y: 105 };
  const centroVentaglio = { x: 80, y: 80 };
  return [
    {
      id: 'banda-curva',
      descrizione: 'banda che curva di 105° e si allarga da 8 a 40 mm',
      region: makeRegion(bandaCurva(centroBanda, 60, 185, 290, 4, 20)),
      campo: { tipo: 'armonico' },
    },
    {
      id: 'banda-curva-con-foro',
      descrizione: 'la stessa banda con un vuoto di 7 mm di raggio (R5)',
      region: makeRegion(
        bandaCurva(centroBanda, 60, 185, 290, 4, 20),
        [cerchio({ x: centroBanda.x + 60 * Math.cos(gradi(255)), y: centroBanda.y + 60 * Math.sin(gradi(255)) }, 7)],
      ),
      campo: { tipo: 'armonico' },
    },
    {
      id: 'ventaglio',
      descrizione: 'settore di corona, raggi da 18 a 70 mm: le file divergono di 3,9 volte',
      region: makeRegion(ventaglio(centroVentaglio, 18, 70, 200, 340)),
      campo: { tipo: 'radiale', centro: centroVentaglio },
    },
  ];
}

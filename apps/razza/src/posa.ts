// LA POSA — dove stanno i pallini.
//
// Prima i pallini FISSI di Lorenzo (misura e posizione sue, non crescono), poi il resto: semina a caso, un
// pallino entra se ci sta almeno `soglia` volte quello che il campo chiede; poi i pallini CRESCONO fino a
// toccare i vicini (la sola semina a caso si ferma al ~50% di copertura: misurato), poi si riempiono i buchi
// con pallini piu' piccoli, come nella fotografia della pelle. Deterministico a parita' di `seed`.
import { type CampoDiametri } from './campo';
import { Griglia, MappaDistanze, dentroPezzo, distanzaBordo, mulberry32 } from './geo';
import { creaTondino, diametroMinimoPossibile } from './pallino';
import type { Fisso, ParametriRazza, Pezzo, Tondino } from './tipi';

export interface Posa { tondini: Tondino[]; avvisi: string[] }

export function posaPallini(pz: Pezzo, par: ParametriRazza, campo: CampoDiametri, fissi: Fisso[], mappa: MappaDistanze): Posa {
  const rnd = mulberry32(par.seed);
  const avvisi: string[] = [];
  const raggioMax = Math.max(par.diamMaxMm, ...fissi.map((f) => f.diamMm)) / 2;
  const griglia = new Griglia(raggioMax * 2 + Math.max(0, par.gapMm));
  const t: Tondino[] = [];
  const aMin = par.diamMinMm / 2;
  const raggioRicerca = raggioMax * 2 + Math.max(0, par.gapMm);
  const larghezza = pz.maxX - pz.minX, altezza = pz.maxY - pz.minY;

  // 1. i fissi, dove li ha messi lui
  fissi.forEach((f, i) => {
    const nuovo = creaTondino(f.x, f.y, f.diamMm, par, 0, true);
    if (!nuovo) { avvisi.push(`Pallino fisso ${i + 1}: ${f.diamMm.toFixed(1)} mm e' troppo piccolo per avere un corpo sopra il punto minimo (almeno ${diametroMinimoPossibile(par).toFixed(1)} mm).`); return; }
    if (!dentroPezzo(pz, { x: f.x, y: f.y })) { avvisi.push(`Pallino fisso ${i + 1}: e' fuori dal pezzo (o dentro un'area vuota): non lo ricamo.`); return; }
    griglia.aggiungi(t.length, f.x, f.y);
    t.push(nuovo);
  });

  /** Semina a caso: un pallino entra se ci sta almeno `soglia` volte quello che il campo chiede. */
  const semina = (soglia: number, quanti: number): void => {
    for (let n = 0; n < quanti; n++) {
      const x = pz.minX + rnd() * larghezza, y = pz.minY + rnd() * altezza;
      const voluto = campo(x, y) / 2;
      const minimo = Math.max(aMin, voluto * soglia);
      let a = voluto;
      for (const j of griglia.vicini(x, y, raggioRicerca)) {
        const o = t[j];
        a = Math.min(a, Math.hypot(x - o.cx, y - o.cy) - o.a - par.gapMm);
        if (a < minimo) break;
      }
      if (a < minimo) continue;
      if (!dentroPezzo(pz, { x, y })) continue;
      a = Math.min(a, distanzaBordo(pz, { x, y }) - par.margineMm);
      if (a < minimo) continue;
      const nuovo = creaTondino(x, y, 2 * a, par, rnd() * Math.PI);
      if (!nuovo) continue;
      griglia.aggiungi(t.length, x, y);
      t.push(nuovo);
    }
  };

  /** Fa crescere ogni pallino (non i fissi) fino a toccare i vicini o il campo che lo limita. */
  const cresci = (): void => {
    const ordine = t.map((_, i) => i).filter((i) => !t[i].fisso);
    for (let i = ordine.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = ordine[i]; ordine[i] = ordine[j]; ordine[j] = tmp; }
    for (const i of ordine) {
      const o = t[i];
      let amax = distanzaBordo(pz, { x: o.cx, y: o.cy }) - par.margineMm;
      for (const j of griglia.vicini(o.cx, o.cy, raggioRicerca)) if (j !== i) amax = Math.min(amax, Math.hypot(o.cx - t[j].cx, o.cy - t[j].cy) - t[j].a - par.gapMm);
      const voluto = campo(o.cx, o.cy) / 2;
      const obiettivo = Math.min(amax, voluto * par.crescita, raggioMax);
      if (obiettivo > o.a + 0.02) { const nuovo = creaTondino(o.cx, o.cy, 2 * obiettivo, par, o.ang); if (nuovo) t[i] = nuovo; }
    }
  };

  void mappa;
  const base = Math.min(500_000, Math.ceil(((larghezza * altezza) / (Math.PI * aMin * aMin)) * 8));
  semina(0.97, base); semina(0.85, base); semina(0.65, base);
  cresci();
  semina(0.5, base); semina(par.rapportoMinimo, base);
  cresci();
  semina(par.rapportoMinimo, base);
  return { tondini: t, avvisi };
}

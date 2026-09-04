// LE VISTE dell'anteprima, disegnate una volta sola.
//
// Nascono da una richiesta di Lorenzo: «dammi le visualizzazioni che mi davi nel broccato, per
// capire come il sistema divide in colori e poi fa il ricamo con i passaggi». Sono quattro tappe
// della stessa catena, e servono a guardare invece di fidarsi:
//
//   colori    come l'immagine viene divisa in tinte, pixel per pixel
//   macchie   come quelle tinte diventano forme cucibili, col loro contorno e i loro fori
//   ricamo    il filo com'e', un gruppo per ago nell'ordine di cucitura
//   passaggi  il ricamo smorzato e sopra SOLO il filo di collegamento, acceso
//
// L'ultima e' quella che mancava davvero. La linea di contorno sul degrade' si vedeva in macchina e
// non nell'anteprima, perche' il filo di passaggio era disegnato uguale al riempimento: separato, si
// vede subito se corre sul bordo o se sta dentro.
//
// Stanno qui e non nel guscio perche' le usano in due — il tool nel browser e lo script che ne fa
// una pagina da guardare senza aprire l'app — e due copie divergono sempre. Nessun DOM: entra un
// piano, esce una stringa SVG.

import { rgbToHex, NO_COLOR, THREAD_STROKE_MM, type Point, type Polyline } from '@rg/core';
import type { PittoricoPlan } from './pipeline';

/** Il rosso dei passaggi: non e' un colore di filo, e non deve poter essere scambiato per uno. */
export const COLORE_PASSAGGI = '#e0245e';

const punti = (c: Polyline): string =>
  c.map((p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

/** Il foglio, alla misura vera del ricamo: 1 unita' = 1 mm, come in tutta la suite. */
export function foglio(pl: PittoricoPlan, dentro: string): string {
  const w = pl.larghezzaMm.toFixed(1), h = pl.altezzaMm.toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">${dentro}</svg>`;
}

/**
 * MACCHIE — le forme che il ricamo cucira' davvero.
 *
 * Fra questa e «colori» si vede cosa la tracciatura ha tenuto e cosa ha buttato: una macchia sotto
 * l'area minima sparisce, e un bordo che nei colori era netto qui puo' essere gia' diventato una
 * scalinata di pixel. E' la vista dove si va a cercare perche' una linea secca non viene letta.
 */
export function svgMacchie(pl: PittoricoPlan): string {
  const corpi = pl.ordine.map((t) => {
    const col = rgbToHex(pl.palette[t]);
    const forme = pl.macchie.filter((m) => m.tinta === t).map((m) => {
      const anelli = [m.region.outer, ...m.region.holes]
        .map((r) => `M ${punti(r).replace(/ /g, ' L ')} Z`).join(' ');
      return `<path d="${anelli}" fill="${col}" fill-opacity="0.25" fill-rule="evenodd" stroke="${col}" stroke-width="0.4" />`;
    }).join('');
    return `<g>${forme}</g>`;
  }).join('');
  return foglio(pl, corpi);
}

/** RICAMO — il filo com'e', disegnato sottile (R15: 0,1 mm, mai una linea grassa che mente). */
export function svgRicamo(pl: PittoricoPlan, strati: StratoDisegnabile[]): string {
  const corpi = strati.map((l) => {
    const d = l.polylines.map((c) => `<polyline points="${punti(c)}" />`).join('');
    return `<g fill="none" stroke="${l.color}" stroke-width="${spessore(l)}" stroke-linejoin="round" stroke-linecap="round">${d}</g>`;
  }).join('');
  // il fondo e' la tinta piu' scura: e' quella che in macchina va giu' per prima e fa da campo
  const fondo = rgbToHex(pl.palette[pl.ordine[0]]);
  return foglio(pl,
    `<rect x="0" y="0" width="${pl.larghezzaMm.toFixed(1)}" height="${pl.altezzaMm.toFixed(1)}" fill="${fondo}" opacity="0.12" />${corpi}`);
}

/** PASSAGGI — il ricamo smorzato, e sopra solo il filo di collegamento. */
export function svgPassaggi(pl: PittoricoPlan, strati: StratoDisegnabile[]): string {
  const sfondo = strati.map((l) => {
    const d = l.polylines.map((c) => `<polyline points="${punti(c)}" />`).join('');
    return `<g fill="none" stroke="${l.color}" stroke-width="${spessore(l)}" opacity="0.18">${d}</g>`;
  }).join('');
  const vie = pl.passaggiPerAgo.map((a) => {
    const d = a.vie.filter((v) => v.length > 1).map((v) => `<polyline points="${punti(v)}" />`).join('');
    return `<g fill="none" stroke="${COLORE_PASSAGGI}" stroke-width="0.22" stroke-linecap="round">${d}</g>`;
  }).join('');
  return foglio(pl, `${sfondo}${vie}`);
}

/**
 * Quel poco che serve di un livello d'esportazione per disegnarlo. `strokeMm` e' opzionale come in
 * `ExportLayer`, e quando manca vale il filo di R15: 0,1 mm, mai una linea grassa che mente sulla
 * copertura.
 */
export interface StratoDisegnabile { color: string; strokeMm?: number; polylines: Polyline[] }

const spessore = (l: StratoDisegnabile): number => l.strokeMm ?? THREAD_STROKE_MM;

/**
 * COLORI — la divisione in tinte, pixel per pixel, come pixel RGBA pronti da mettere in un canvas.
 *
 * E' il primo passo della catena e quello che decide tutto il resto: se qui una linea netta non
 * c'e', non ci sara' nemmeno nel ricamo, e nessun riempimento potra' inventarla. I pixel senza
 * tinta restano quasi bianchi, cosi' si vede subito cosa NON si ricama.
 */
export function pixelDeiColori(pl: PittoricoPlan): Uint8ClampedArray {
  const n = pl.larghezzaPx * pl.altezzaPx;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4, v = pl.indice[i];
    if (v === NO_COLOR || v >= pl.palette.length) {
      out[o] = 250; out[o + 1] = 248; out[o + 2] = 244;
    } else {
      const rgb = pl.palette[v];
      out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2];
    }
    out[o + 3] = 255;
  }
  return out;
}

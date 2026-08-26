// Immagine dimostrativa: si apre il tool e c'è già qualcosa da guardare, senza cercare un file.
// Non è un broccato vero — è un finto tessuto con le caratteristiche che contano per provare il
// motore: poche tinte dominanti, macchie dal bordo frastagliato, e una GRANA fitta sopra a tutto
// (è la grana che, su un'immagine vera, frammenta le aree: serve per tarare la pulizia del punto ②).

import type { PixelImage } from './engine';

/** Rumore deterministico (mulberry32, come in bitmap/striatura): stessa demo a ogni apertura. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUOIO: [number, number, number] = [186, 156, 120];
const SCURO: [number, number, number] = [64, 62, 60];
const ARGENTO: [number, number, number] = [176, 176, 172];
const GIALLO: [number, number, number] = [226, 208, 46];

export function sampleImage(width = 420, height = 380): PixelImage {
  const rand = rng(20260826);
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Onde sfasate: danno macchie organiche invece di cerchi, come le chiazze di un broccato.
  const field = (x: number, y: number, fx: number, fy: number, ph: number): number =>
    Math.sin(x * fx + ph) * Math.cos(y * fy - ph) + 0.5 * Math.sin((x + y) * fx * 0.7 + ph * 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const orn = field(x, y, 0.055, 0.048, 0.0);       // l'ornato scuro
      const arg = field(x, y, 0.031, 0.037, 2.1);       // i fiori argento
      const gia = field(x, y, 0.017, 0.019, 4.2);       // le chiazze gialle

      let c = CUOIO;
      if (gia > 0.85) c = GIALLO;
      else if (arg > 0.75) c = ARGENTO;
      else if (orn > 0.35) c = SCURO;

      // Grana: variazione fine di tono, più marcata sull'ornato (è il tratteggio del disegno).
      const grana = (rand() - 0.5) * (c === SCURO ? 70 : 44);
      // Illuminazione lenta: un angolo più chiaro dell'altro. È la variazione che il punto ②
      // dovrà pareggiare, altrimenti lo stesso motivo cade su tinte diverse a seconda di dov'è.
      const luce = 26 * ((x / width) * 0.6 + (1 - y / height) * 0.4 - 0.5);

      const o = (y * width + x) * 4;
      rgba[o] = c[0] + grana + luce;
      rgba[o + 1] = c[1] + grana + luce;
      rgba[o + 2] = c[2] + grana + luce;
      rgba[o + 3] = 255;
    }
  }
  return { rgba, width, height };
}

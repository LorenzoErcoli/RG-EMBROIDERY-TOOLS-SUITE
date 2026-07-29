// Immagine demo sintetica (nessun DOM): un buffer RGBA con qualche zona colorata su sfondo bianco,
// così il tool rende subito qualcosa senza dover caricare un file (come il cartamodello demo di interlace).
export interface PixelImage { rgba: Uint8ClampedArray; width: number; height: number; }

export function sampleImage(): PixelImage {
  const width = 240, height = 160;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const o = (y * width + x) * 4;
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
  };
  // sfondo bianco (luminanza alta → NON selezionato con soglia 200)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, 255, 255, 255);

  const rect = (x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, r, g, b);
  };
  const disc = (cx: number, cy: number, rad: number, r: number, g: number, b: number) => {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(x, y, r, g, b);
    }
  };
  rect(24, 30, 108, 128, 0x20, 0x40, 0x8a);    // blocco blu navy
  disc(168, 80, 46, 0xb0, 0x30, 0x40);         // disco cremisi
  rect(120, 24, 132, 136, 0x20, 0x20, 0x20);   // barra scura (nera)
  return { rgba, width, height };
}

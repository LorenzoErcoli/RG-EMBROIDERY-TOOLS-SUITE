import { defaultBitmapParams } from '../../apps/bitmap/src/engine';
import { runBitmapPipeline } from '../../apps/bitmap/src/pipeline';

// L'immagine sintetica dello smoke (24x12, due rettangoli su bianco), 1 px = 1 mm, e i valori di partenza del tool.
export async function prova() {
  const w = 24, h = 12;
  const pixel = new Uint8ClampedArray(w * h * 4).fill(255);
  const put = (x: number, y: number, r: number, g: number, b: number) => { const o = (y * w + x) * 4; pixel[o] = r; pixel[o + 1] = g; pixel[o + 2] = b; pixel[o + 3] = 255; };
  for (let y = 2; y < 10; y++) for (let x = 2; x < 8; x++) put(x, y, 0x20, 0x40, 0x8a);
  for (let y = 2; y < 10; y++) for (let x = 14; x < 20; x++) put(x, y, 0xb0, 0x30, 0x40);
  const params = { ...defaultBitmapParams, colorCount: 2, maxWidthPx: 0 };
  return {
    ingresso: { immagine: { larghezza: w, altezza: h, pixel, pxPerMm: 1 } },
    params,
    // la strada di prima: la chiamata che faceva tool.ts (gli strati dell'export)
    diretto: () => runBitmapPipeline(pixel, w, h, params, 1).exportLayers,
  };
}

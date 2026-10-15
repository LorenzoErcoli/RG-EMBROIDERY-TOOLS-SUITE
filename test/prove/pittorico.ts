import { buildPittoricoPlan, pittoricoExportLayers, defaultPittoricoParams } from '../../apps/pittorico/src/pipeline';

// L'immagine sintetica dello smoke (due campiture, una rampa che sfuma, un gradino netto, la grana) e i valori di partenza.
export async function prova() {
  const W = 180, H = 90, mmPerPx = 0.4;
  const pixel = new Uint8ClampedArray(W * H * 4);
  const disturbo = (x: number, y: number) => {
    let a = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    a = Math.imul(a ^ (a >>> 13), 1274126177);
    return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = x < 120 ? 40 + 175 * Math.max(0, Math.min(1, (x - 25) / 30)) : 40;
      v += (disturbo(x, y) - 0.5) * 40;
      const o = (y * W + x) * 4;
      pixel[o] = v * 0.4; pixel[o + 1] = v * 0.6; pixel[o + 2] = v; pixel[o + 3] = 255;
    }
  }
  const { tagliAggiunti, tagliRimossi, ...base } = defaultPittoricoParams;
  const params = { ...base, colorCount: 3, minAreaMm2: 20, realWidthMm: W * mmPerPx };
  return {
    ingresso: { immagine: { larghezza: W, altezza: H, pixel, pxPerMm: 1 / mmPerPx }, tagliAggiunti, tagliRimossi },
    params,
    // la strada di prima: la chiamata che faceva tool.ts
    diretto: () => pittoricoExportLayers(buildPittoricoPlan({ rgba: pixel, width: W, height: H }, { ...params, tagliAggiunti, tagliRimossi })),
  };
}

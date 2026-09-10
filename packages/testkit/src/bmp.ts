// AIUTI PER GLI SCRIPT DI VERIFICA — non fanno ricamo, servono a GUARDARLO.
//
// Leggere un'immagine e scriverne una: quello che serve ai motori headless per rileggere i propri
// risultati e produrre le prove da mostrare a Lorenzo. Stanno fuori da `@rg/core` apposta — il core
// e' il ricamo, questo e' il banco di misura — e fuori dalle app perche' li usano gia' pettine,
// pittorico e sfrangiatura: un'app non dipende da un'altra app.
//
// Nati in `apps/pittorico/scripts`, promossi qui il 2026-09-10. Si importano per percorso relativo
// (`../../../packages/testkit/src/...`), come gia' si fa con `packages/pattern-grammar`: gli script
// girano con esbuild, senza bisogno di un alias.

// Lettura di un BMP a 24 bit, per le prove headless.
//
// Perché un BMP e non il JPG di Lorenzo: il decoder JPEG non ce l'ha né Node né il core, e va bene
// così — nella suite le immagini le decodifica il **canvas del browser** (`apps/bitmap`,
// `apps/broccato`), che è l'unico pezzo a DOM di tutta la catena. Per provare in Node il file si
// converte una volta in BMP, che non ha compressione e si legge in venti righe:
//
//   powershell -c "Add-Type -AssemblyName System.Drawing;
//     $i=[System.Drawing.Image]::FromFile('...jpg');
//     $b=New-Object System.Drawing.Bitmap($i.Width,$i.Height,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb);
//     ([System.Drawing.Graphics]::FromImage($b)).DrawImage($i,0,0,$i.Width,$i.Height);
//     $b.Save('...bmp',[System.Drawing.Imaging.ImageFormat]::Bmp)"
//
// Sta qui, e non dentro uno degli script, perché stava per diventare la terza copia della stessa
// funzione: è esattamente il modo in cui nascono le divergenze che R28 vieta.

import { readFileSync } from 'node:fs';
import { type PixelImage } from '@rg/core';

export function leggiBmp(percorso: string): PixelImage {
  const b = readFileSync(percorso);
  if (b[0] !== 0x42 || b[1] !== 0x4d) throw new Error('non è un BMP');
  const dati = b.readUInt32LE(10);
  const width = b.readInt32LE(18);
  const altezza = b.readInt32LE(22);
  const bpp = b.readUInt16LE(28);
  if (bpp !== 24) throw new Error(`servono 24 bit per pixel, questo ne ha ${bpp}`);
  const height = Math.abs(altezza);
  const dalBasso = altezza > 0;                     // altezza positiva = righe salvate dal basso
  const passo = Math.ceil((width * 3) / 4) * 4;     // ogni riga è allineata a 4 byte
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const riga = dati + (dalBasso ? height - 1 - y : y) * passo;
    for (let x = 0; x < width; x++) {
      const s = riga + x * 3, d = (y * width + x) * 4;
      rgba[d] = b[s + 2]; rgba[d + 1] = b[s + 1]; rgba[d + 2] = b[s]; rgba[d + 3] = 255;  // BMP è BGR
    }
  }
  return { rgba, width, height };
}

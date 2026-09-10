// UN PNG SENZA LIBRERIE — per guardare il ricamo, non solo misurarlo.
//
// Gli SVG che gli script producono si guardano nel browser, e va bene per Lorenzo. Ma per chi lavora
// dal terminale un'immagine raster e' l'unico modo per VEDERE cosa e' uscito — e in questo lavoro
// «la resa viene prima delle misure» e' scritto come regola perche' ci si e' gia' scottati.
//
// Node ha `zlib` e nient'altro serve: un PNG e' un'intestazione, i pixel deflati riga per riga con
// un byte di filtro, e tre CRC. Sono quaranta righe e non aggiungono dipendenze.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import type { Polyline } from '@rg/core';

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(tipo: string, dati: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + dati.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, dati.length);
  out.set([tipo.charCodeAt(0), tipo.charCodeAt(1), tipo.charCodeAt(2), tipo.charCodeAt(3)], 4);
  out.set(dati, 8);
  dv.setUint32(8 + dati.length, crc32(out.subarray(4, 8 + dati.length)));
  return out;
}

/** Scrive pixel RGB (3 byte per pixel, riga per riga) come PNG. */
export function scriviPng(percorso: string, rgb: Uint8Array, w: number, h: number): void {
  const grezzo = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    grezzo[y * (w * 3 + 1)] = 0;                           // filtro: nessuno
    grezzo.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bit, RGB
  const firma = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parti = [firma, chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(grezzo))), chunk('IEND', new Uint8Array(0))];
  const tot = parti.reduce((s, p) => s + p.length, 0);
  const file = new Uint8Array(tot);
  let off = 0;
  for (const p of parti) { file.set(p, off); off += p.length; }
  writeFileSync(percorso, file);
}

/** Una tela RGB con sfondo chiaro, e una penna per tracciare polilinee in mm. */
export class Tela {
  readonly w: number;
  readonly h: number;
  readonly rgb: Uint8Array;
  constructor(readonly larghezzaMm: number, readonly altezzaMm: number, readonly pxPerMm: number) {
    this.w = Math.max(1, Math.ceil(larghezzaMm * pxPerMm));
    this.h = Math.max(1, Math.ceil(altezzaMm * pxPerMm));
    this.rgb = new Uint8Array(this.w * this.h * 3).fill(248);
  }
  punto(x: number, y: number, r: number, g: number, b: number): void {
    const px = Math.round(x * this.pxPerMm), py = Math.round(y * this.pxPerMm);
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const i = (py * this.w + px) * 3;
    this.rgb[i] = r; this.rgb[i + 1] = g; this.rgb[i + 2] = b;
  }
  /** Traccia la polilinea campionandola a un terzo di pixel: niente buchi, niente antialias. */
  linea(l: Polyline, r: number, g: number, b: number): void {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], c = l[i];
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      const n = Math.max(1, Math.ceil(d * this.pxPerMm * 3));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        this.punto(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t, r, g, b);
      }
    }
  }
  salva(percorso: string): void { scriviPng(percorso, this.rgb, this.w, this.h); }
}

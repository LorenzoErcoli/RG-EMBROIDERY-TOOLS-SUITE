// Un DST minimo (una L di 40 × 20 mm a punti da 1 mm) da mandare a Stilista con POST /dst: Stilista lo
// apre in un documento nuovo, che è nostro. Lì si fanno le prove, senza toccare i documenti aperti di Lorenzo.
//
// Uso:  npm run prova:stilista-dst   →   strumenti-sviluppo/stilista-prove/out/prova.dst
import { buildDst } from '@rg/core';

const modulo = 'node:fs';
const { writeFileSync, mkdirSync } = await import(modulo) as typeof import('node:fs');
const uscita = new URL('../../../strumenti-sviluppo/stilista-prove/out/', import.meta.url); // gira dal bundle in out/

const punti: Array<[number, number]> = [];
for (let x = 0; x <= 40; x += 1) punti.push([x, 0]);
for (let y = 1; y <= 20; y += 1) punti.push([40, y]);
mkdirSync(uscita, { recursive: true });
writeFileSync(new URL('prova.dst', uscita), buildDst({ label: 'rg-prova', paths: [{ needle: 1, points_mm: punti }] }));
console.log('scritto', new URL('prova.dst', uscita).pathname);

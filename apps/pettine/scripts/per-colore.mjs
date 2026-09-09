// UN'IMMAGINE PER OGNI COLORE DI FILO, coi passaggi in rosa. Lorenzo (2026-09-10): «mi crei 6 immagini
// una per colore filo dove in rosa metti i passaggi dove li hai creati». Legge l'SVG del pettine
// (che ha, per ogni colore, un tracciato per le basi, uno per i denti e uno per i passaggi) e scrive
// un SVG per colore: le basi di tutti in grigio chiaro per orientarsi, le basi e i denti del colore
// nella sua tinta, i suoi passaggi in rosa, spessi, sopra a tutto.
//
//   node apps/pettine/scripts/per-colore.mjs apps/pettine/scripts/out/pannello.svg
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('uso: node per-colore.mjs <pettine.svg>'); process.exit(1); }
const svg = readFileSync(file, 'utf8');
const testa = svg.slice(0, svg.indexOf('>') + 1);                       // il tag <svg ...>
const rects = [...svg.matchAll(/<rect [^>]*\/>/g)].map((m) => m[0]);
const paths = [...svg.matchAll(/<path d="([^"]*)" fill="none" stroke="([^"]*)" stroke-width="([^"]*)"( opacity="[^"]*")?\/>/g)]
  .map((m) => ({ d: m[1], stroke: m[2], w: m[3], passaggio: m[3] === '0.06' }));
// i colori, nell'ordine in cui compaiono (il primo e' il chiaro, disegnato in grigio)
const colori = [];
for (const p of paths) if (!colori.includes(p.stroke)) colori.push(p.stroke);
const ROSA = '#ff2d95';
colori.forEach((col, t) => {
  const pezzi = [];
  // tutte le basi, in grigio chiaro: sono le righe senza denti (il primo tracciato di ogni colore)
  for (const c2 of colori) { const basi = paths.find((p) => p.stroke === c2 && !p.passaggio); if (basi) pezzi.push(`<path d="${basi.d}" fill="none" stroke="#dcdcdc" stroke-width="0.08"/>`); }
  // le basi e i denti di questo colore, nella sua tinta
  for (const p of paths) if (p.stroke === col && !p.passaggio) pezzi.push(`<path d="${p.d}" fill="none" stroke="${col === '#9a9a9a' ? '#8a8a8a' : col}" stroke-width="0.1" opacity="0.8"/>`);
  // i suoi passaggi, in rosa, sopra a tutto
  const pas = paths.filter((p) => p.stroke === col && p.passaggio);
  for (const p of pas) pezzi.push(`<path d="${p.d}" fill="none" stroke="${ROSA}" stroke-width="0.45" stroke-linecap="round"/>`);
  const vb = /viewBox="([^"]*)"/.exec(testa)[1].split(/\s+/).map(Number);
  const titolo = `<text x="${(vb[0] + 3).toFixed(1)}" y="${(vb[1] + 7).toFixed(1)}" font-family="Helvetica,Arial" font-size="6" fill="#222">ago ${t + 1} · ${col} · passaggi in rosa</text>`;
  const out = testa + rects.join('') + pezzi.join('\n') + titolo + '</svg>';
  const nome = file.replace(/\.svg$/, `-ago${t + 1}.svg`);
  writeFileSync(nome, out);
  console.log('->', nome, `(${pas.length ? 'con passaggi' : 'senza passaggi'})`);
});

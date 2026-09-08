// QUATTRO FOGLI PER CAPIRSI, prima di scrivere qualunque tool.
//
// Lorenzo ha descritto a parole una cosa che a parole non si chiude: «un punto pettine che si mischia
// e si sfrangia», «una curvatura omogenea», «come l'oggetto fusione di Illustrator», «che sfumi dal
// chiaro allo scuro». Questi fogli provano a disegnare esattamente quello, così si può dire «sì, è
// così» oppure «no, è un'altra cosa» — che è l'unica risposta utile a questo punto.
//
// I numeri NON sono inventati: vengono dal suo `PUNTO-SFRANGIATO-CASUALE.svg`, misurato.
//   passo sulla base   8,00 esatto, sempre
//   dente              mediana 24 (min 16, max 31) = TRE VOLTE il passo, con ±25% di variazione
//   inclinazione       da −52° a +48° rispetto alla perpendicolare alla base
//   la base            non è dritta: nell'ultimo caso ondeggia di 13,8 su 168
//
// Le unità sono quelle del suo file (viewBox 170,3 × 128,9). Quanto valgano in millimetri è la prima
// domanda da fargli: a 8 mm di passo il dente sarebbe lungo 24 mm, che per un ricamo è enorme.
//
//   npx esbuild apps/pettine/scripts/provino.ts --bundle --format=esm --platform=node \
//     --outfile=apps/pettine/scripts/provino.mjs
//   node apps/pettine/scripts/provino.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

interface P { x: number; y: number }

/** Caso deterministico: gli stessi fogli si rigenerano identici. */
function caso(a: number, b: number): number {
  let h = (a * 0x9e3779b1) ^ (b * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Punti equidistanti lungo una polilinea, con la loro tangente: è la spina su cui nasce il pettine. */
function passeggia(linea: P[], passo: number): Array<{ p: P; tx: number; ty: number; t: number }> {
  const out: Array<{ p: P; tx: number; ty: number; t: number }> = [];
  let tot = 0;
  const lung: number[] = [0];
  for (let i = 1; i < linea.length; i++) {
    tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y);
    lung.push(tot);
  }
  for (let d = 0; d <= tot; d += passo) {
    let i = 1;
    while (i < lung.length - 1 && lung[i] < d) i++;
    const t = (d - lung[i - 1]) / Math.max(1e-9, lung[i] - lung[i - 1]);
    const a = linea[i - 1], b = linea[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    out.push({ p: { x: a.x + dx * t, y: a.y + dy * t }, tx: dx / l, ty: dy / l, t: d / tot });
  }
  return out;
}

/**
 * IL PUNTO PETTINE SFRANGIATO. Una spina (la linea di base) e i suoi denti: ogni dente esce dalla
 * spina, arriva alla punta e rientra nello stesso buco — andata e ritorno, come nel file di Lorenzo.
 * Lunghezza e inclinazione sono estratte a caso dentro gli intervalli misurati.
 */
function pettine(
  spina: P[],
  opts: { passo: number; lungMin: number; lungMax: number; inclDeg: number; verso?: number; seme?: number },
): P[] {
  const seme = opts.seme ?? 1;
  const verso = opts.verso ?? -1;
  const punti: P[] = [];
  passeggia(spina, opts.passo).forEach((s, i) => {
    const r1 = caso(seme, i * 2), r2 = caso(seme, i * 2 + 1);
    const lung = opts.lungMin + (opts.lungMax - opts.lungMin) * r1;
    const ang = ((r2 * 2 - 1) * opts.inclDeg * Math.PI) / 180;
    // la normale alla spina, poi ruotata: il dente segue la spina, non l'asse Y
    const nx = -s.ty * verso, ny = s.tx * verso;
    const dx = nx * Math.cos(ang) - ny * Math.sin(ang);
    const dy = nx * Math.sin(ang) + ny * Math.cos(ang);
    punti.push(s.p, { x: s.p.x + dx * lung, y: s.p.y + dy * lung }, s.p);
  });
  return punti;
}

function ricampiona(linea: P[], n: number): P[] {
  let tot = 0;
  const lung: number[] = [0];
  for (let i = 1; i < linea.length; i++) {
    tot += Math.hypot(linea[i].x - linea[i - 1].x, linea[i].y - linea[i - 1].y);
    lung.push(tot);
  }
  const out: P[] = [];
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * tot;
    let i = 1;
    while (i < lung.length - 1 && lung[i] < d) i++;
    const t = (d - lung[i - 1]) / Math.max(1e-9, lung[i] - lung[i - 1]);
    out.push({
      x: linea[i - 1].x + (linea[i].x - linea[i - 1].x) * t,
      y: linea[i - 1].y + (linea[i].y - linea[i - 1].y) * t,
    });
  }
  return out;
}

/**
 * LA FUSIONE, che è quello che Lorenzo ha chiamato «l'oggetto fusione di Illustrator»: date due
 * curve, le curve intermedie che passano dall'una all'altra. Si campionano tutte e due sullo stesso
 * numero di punti e si mescolano in proporzione — è la stessa cosa che fa Illustrator, ed è il
 * motivo per cui le linee in mezzo si «adeguano» invece di restare parallele.
 */
function fusione(a: P[], b: P[], quante: number, campioni = 140): P[][] {
  const ca = ricampiona(a, campioni), cb = ricampiona(b, campioni);
  const out: P[][] = [];
  for (let k = 0; k <= quante + 1; k++) {
    const t = k / (quante + 1);
    out.push(ca.map((p, i) => ({ x: p.x + (cb[i].x - p.x) * t, y: p.y + (cb[i].y - p.y) * t })));
  }
  return out;
}

/** Una curva comoda per fare le guide: sinusoide campionata. */
function onda(x0: number, x1: number, y: number, ampiezza: number, fase: number, n = 90): P[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: x0 + (x1 - x0) * t, y: y + Math.sin(t * Math.PI * 2 + fase) * ampiezza };
  });
}

// ---------------------------------------------------------------------------------------------
// il disegno: QUATTRO FOGLI, uno per domanda. Un foglio solo lungo due metri non si guarda.
// ---------------------------------------------------------------------------------------------

const FILO = 0.35;
const via = (pt: P[], colore: string, larghezza = FILO): string =>
  `<path d="${pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')}" fill="none" stroke="${colore}" stroke-width="${larghezza}"/>`;
const testo = (x: number, y: number, s: string, size = 5): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" fill="#1d1d1b">${s}</text>`;
const nota = (x: number, y: number, s: string): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="3.4" fill="#6b6b6b">${s}</text>`;

const SCURO = '#132237', BLU = '#1b3257', CELESTE = '#a3d6d8', PANNA = '#dddbd3';
const TINTE = [PANNA, CELESTE, BLU, SCURO];

mkdirSync('apps/pettine/scripts/out', { recursive: true });
const foglio = (nome: string, w: number, h: number, pezzi: string[]): void => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">
<rect width="${w}" height="${h}" fill="#faf9f7"/>
${pezzi.join('\n')}
</svg>`;
  writeFileSync(`apps/pettine/scripts/out/${nome}.svg`, svg, 'utf8');
  console.log(`-> apps/pettine/scripts/out/${nome}.svg`);
};

// --- FOGLIO 1: il pettine. Il TUO accanto al mio, per vedere se ho preso i numeri giusti --------
{
  const q: string[] = [];
  q.push(testo(8, 12, '1 - IL PUNTO PETTINE'));
  q.push(nota(8, 18, 'i tuoi numeri, misurati dal file: passo 8,00 esatto - dente da 16 a 31 (mediana 24, cioe tre volte il passo) - inclinazione fino a 50 gradi'));

  const sorgente = readFileSync('apps/pettine/fixtures/PUNTO-SFRANGIATO-CASUALE.svg', 'utf8');
  const polys = [...sorgente.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => {
    const n = m[1].trim().split(/\s+/).map(Number);
    const pts: P[] = [];
    for (let i = 0; i < n.length; i += 2) pts.push({ x: n[i], y: n[i + 1] });
    return pts;
  });
  q.push(testo(8, 32, 'IL TUO', 4));
  q.push(via(polys[1].map((p) => ({ x: p.x + 8, y: p.y - 15 })), SCURO));
  q.push(nota(8, 70, 'PUNTO-SFRANGIATO-CASUALE.svg, la seconda riga'));

  q.push(testo(8, 88, 'IL MIO, ricostruito dai numeri (non ricalcato)', 4));
  q.push(via(pettine([{ x: 9.5, y: 122 }, { x: 169.5, y: 122 }], { passo: 8, lungMin: 16, lungMax: 31, inclDeg: 50, seme: 7 }), SCURO));
  q.push(nota(8, 128, 'stesso passo, stessi estremi di lunghezza e inclinazione, altra estrazione del caso'));

  q.push(testo(8, 148, 'per confronto, il pettine REGOLARE (la tua prima riga)', 4));
  q.push(via(pettine([{ x: 9.5, y: 182 }, { x: 169.5, y: 182 }], { passo: 8, lungMin: 27, lungMax: 27, inclDeg: 0 }), SCURO));
  q.push(nota(8, 188, 'dente fisso, perpendicolare: nessun incrocio'));
  foglio('1-pettine', 186, 196, q);
}

// --- FOGLIO 2: la fusione ----------------------------------------------------------------------
{
  const q: string[] = [];
  q.push(testo(8, 12, '2 - LA FUSIONE fra due curve guida'));
  q.push(nota(8, 18, 'le due NERE le disegni tu; quelle in mezzo le calcola il tool e si adeguano gradualmente dall una all altra: l oggetto fusione di Illustrator'));

  fusione(onda(10, 176, 44, 9, 0), onda(10, 176, 104, 4, Math.PI * 0.9), 10).forEach((linea, i, tutte) => {
    const guida = i === 0 || i === tutte.length - 1;
    q.push(via(linea, guida ? '#1d1d1b' : '#b9bec4', guida ? 0.8 : 0.4));
  });
  q.push(nota(8, 120, 'le sole linee, per guardare la curvatura: e OMOGENEA, nessuna sta storta rispetto alle vicine'));

  q.push(testo(8, 140, 'e con il pettine sopra ogni linea:', 4));
  fusione(onda(10, 176, 170, 9, 0), onda(10, 176, 230, 4, Math.PI * 0.9), 10).forEach((linea, i) => {
    q.push(via(pettine(linea, { passo: 8, lungMin: 10, lungMax: 20, inclDeg: 50, seme: 10 + i }), SCURO));
  });
  foglio('2-fusione', 186, 246, q);
}

// --- FOGLIO 3: la sfumatura, tre modi ----------------------------------------------------------
{
  const q: string[] = [];
  q.push(testo(8, 12, '3 - LA SFUMATURA dal chiaro allo scuro: tre modi. Quale e il tuo?'));
  q.push(nota(8, 18, 'oppure due insieme, o tutti e tre: la domanda e quale COMANDA'));
  const larg = 54, gap = 6, y0 = 34;
  const modi: Array<[string, string]> = [
    ['A - cambia il FILO', 'stesso pettine, il colore passa|da un ago all altro'],
    ['B - cambia la DENSITA', 'stesso filo, le righe si stringono|verso lo scuro'],
    ['C - cambiano i DENTI', 'stesso filo e passo: i denti si|accorciano e si diradano'],
  ];
  modi.forEach(([titolo, spiega], k) => {
    const x0 = 8 + k * (larg + gap);
    q.push(testo(x0, y0 - 6, titolo, 4));
    spiega.split('|').forEach((r, i) => q.push(nota(x0, y0 + 104 + i * 4.5, r)));
    const righe = 16;
    for (let i = 0; i < righe; i++) {
      const t = i / (righe - 1);
      const c = TINTE[Math.min(3, Math.floor(t * 3.999))];
      if (k === 0) {
        const y = y0 + 6 + t * 88;
        q.push(via(pettine([{ x: x0, y }, { x: x0 + larg, y }], { passo: 4, lungMin: 5, lungMax: 11, inclDeg: 50, seme: 30 + i }), c));
      } else if (k === 1) {
        const y = y0 + 6 + t * t * 88;
        q.push(via(pettine([{ x: x0, y }, { x: x0 + larg, y }], { passo: 4, lungMin: 5, lungMax: 11, inclDeg: 50, seme: 60 + i }), BLU));
      } else {
        const y = y0 + 6 + t * 88;
        q.push(via(pettine([{ x: x0, y }, { x: x0 + larg, y }], {
          passo: 3 + (1 - t) * 5, lungMin: 3 + t * 5, lungMax: 5 + t * 9, inclDeg: 50, seme: 90 + i,
        }), BLU));
      }
    }
  });
  foglio('3-sfumatura', 186, 132, q);
}

// --- FOGLIO 4: tutto insieme su una zona -------------------------------------------------------
{
  const q: string[] = [];
  q.push(testo(8, 12, '4 - TUTTO INSIEME: una zona con la sua curvatura, sfumata'));
  q.push(nota(8, 18, 'le guide (nere) danno la curvatura, la fusione la porta a tutte le righe in mezzo, il colore sfuma lungo la fusione'));
  const zA = onda(10, 176, 42, 12, 0.3);
  const zB = onda(10, 176, 132, 6, Math.PI * 1.2);
  const zone = fusione(zA, zB, 22);
  zone.forEach((linea, i) => {
    const t = i / (zone.length - 1);
    q.push(via(pettine(linea, { passo: 4, lungMin: 6, lungMax: 14, inclDeg: 50, seme: 200 + i }), TINTE[Math.min(3, Math.floor(t * 3.999))]));
  });
  q.push(via(zA, '#1d1d1b', 0.7));
  q.push(via(zB, '#1d1d1b', 0.7));
  q.push(nota(8, 154, 'nota: qui il colore cambia a scalini (quattro fili). Se lo vuoi piu morbido, nella fascia di passaggio si mescolano le righe dei due fili vicini.'));
  foglio('4-insieme', 186, 162, q);
}

// LO SCHEMA delle due tecniche per non tagliare il filo, da guardare prima di scriverle.
//
// Lorenzo (2026-09-10): «ti do due possibilita' da integrare per ridurre i passaggi… per ognuno di
// questi prima prepariamo una visualizzazione per capire se hai capito come fare». Questo file
// disegna quello che ho capito, su una geometria inventata apposta perche' si legga: non e' il
// motore, e' un foglio di spiegazione. I numeri in fondo invece sono veri, misurati sul pannello.
//
//   npx esbuild apps/pettine/scripts/schema-passaggi.ts --bundle --format=esm --platform=node \
//     --outfile=apps/pettine/scripts/schema-passaggi.mjs
//   node apps/pettine/scripts/schema-passaggi.mjs

import { mkdirSync, writeFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
interface P { x: number; y: number }
const via = (pt: P[]): string => pt.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
const SCURO = '#1b3257', CHIARO = '#7fc4c8', ROSA = '#e0007f', VERDE = '#0a8f5b', NERO = '#111';

const riga = (x0: number, x1: number, y: number, amp: number, fase: number): P[] => {
  const out: P[] = [];
  for (let x = x0; x <= x1; x += 1) out.push({ x, y: y + amp * Math.sin((x / 24) * Math.PI + fase) });
  return out;
};
const casuale = (k: number, seme: number): number => Math.abs((Math.sin(k * 12.9898 + seme * 78.233) * 43758.5453) % 1);
const denti = (base: P[], passo: number, lmin: number, lmax: number, seme: number): P[][] => {
  const out: P[][] = [];
  let acc = 0, k = 0;
  for (let i = 1; i < base.length; i++) {
    acc += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y);
    if (acc < passo) continue;
    acc = 0; k++;
    const r = casuale(k, seme);
    const l = lmin + (lmax - lmin) * r;
    const ang = ((r - 0.5) * 45 * Math.PI) / 180;
    out.push([base[i], { x: base[i].x + Math.sin(ang) * l, y: base[i].y - Math.cos(ang) * l }]);
  }
  return out;
};
const pettine = (b: P[], col: number, seme: number, spessore = 0.45): string => {
  const c = col === 0 ? CHIARO : SCURO;
  let d = via(b);
  for (const t of denti(b, 2.2, 4.5, 8, seme)) d += via(t);
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${spessore}"/>`;
};
const testo = (x: number, y: number, s: string, size = 3.2, col = NERO, peso = 'normal'): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" fill="${col}" font-weight="${peso}">${s}</text>`;
const bollo = (x: number, y: number, n: string, col = NERO): string =>
  `<circle cx="${x}" cy="${y}" r="3.2" fill="${col}"/><text x="${x}" y="${y + 1.2}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="3.8" fill="#fff" font-weight="bold">${n}</text>`;
const freccia = (a: P, b: P, col: string, w = 0.7): string => {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const p1 = { x: b.x - 2.6 * Math.cos(ang - 0.42), y: b.y - 2.6 * Math.sin(ang - 0.42) };
  const p2 = { x: b.x - 2.6 * Math.cos(ang + 0.42), y: b.y - 2.6 * Math.sin(ang + 0.42) };
  return `<path d="${via([a, b])}" fill="none" stroke="${col}" stroke-width="${w}"/><path d="${via([p1, b, p2])}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
};
const riquadro = (x: number, y: number, w: number, h: number, titolo: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#d8d5cf" stroke-width="0.4"/>` + testo(x + 3, y + 6.5, titolo, 3.6, NERO, 'bold');

const pz: string[] = [];
const RW = 96, RH = 62;

// ══ A · LA FILA ISOLATA ════════════════════════════════════════════════════════════════════════
pz.push(testo(8, 12, 'A · UNA FILA ISOLATA, RAGGIUNTA SENZA TAGLIARE IL FILO', 5.2, NERO, 'bold'));
pz.push(testo(8, 18.5, 'Si arriva in fondo cucendo sul dietro del pettine (impuntura), poi si torna indietro facendo i denti sopra quello stesso filo.', 3.4));

const rigaFatta = (dx: number, dy: number, i: number): P[] => riga(4, 84, dy + i * 6, 1.5, i * 0.35).map((p) => ({ x: p.x + dx, y: p.y }));
const isolata = (dx: number, dy: number): P[] => riga(22, 72, dy + 30, 1.2, 1.1).map((p) => ({ x: p.x + dx, y: p.y }));

// A1 — com'e' adesso
{
  const x = 8, y = 24;
  pz.push(riquadro(x, y, RW, RH, 'oggi: si taglia'));
  for (let i = 0; i < 3; i++) pz.push(pettine(rigaFatta(x, y + 12, i), 1, i));
  pz.push(pettine(isolata(x, y + 12), 1, 7));
  const a = { x: x + 84, y: y + 24 + 1.5 * Math.sin((84 / 24) * Math.PI + 0.7) };
  const b = isolata(x, y + 12)[0];
  pz.push(`<path d="${via([a, b])}" fill="none" stroke="${ROSA}" stroke-width="0.8" stroke-dasharray="3 2"/>`);
  pz.push(testo(x + 3, y + RH - 3, 'salto: taglia, riparte, due code da rifinire', 3.2, ROSA));
}
// A2 — andata in impuntura
{
  const x = 8 + RW + 6, y = 24;
  pz.push(riquadro(x, y, RW, RH, 'andata: impuntura sul dietro'));
  for (let i = 0; i < 3; i++) pz.push(pettine(rigaFatta(x, y + 12, i), 1, i));
  const iso = isolata(x, y + 12);
  pz.push(`<path d="${via(iso)}" fill="none" stroke="#cfcabf" stroke-width="0.45"/>`);
  const a = { x: x + 84, y: y + 24 + 1.5 * Math.sin((84 / 24) * Math.PI + 0.7) };
  pz.push(`<path d="${via([a, iso[iso.length - 1], ...[...iso].reverse()])}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7"/>`);
  pz.push(freccia({ x: x + 60, y: y + 44.4 }, { x: x + 38, y: y + 44.8 }, VERDE, 0.8));
  pz.push(bollo(x + 88, y + 26, '1', VERDE));
  pz.push(testo(x + 3, y + RH - 8, 'punti lunghi sulla linea della riga da fare:', 3.2, VERDE));
  pz.push(testo(x + 3, y + RH - 3.5, 'nessun dente, e resta sotto', 3.2, VERDE));
}
// A3 — ritorno col pettine
{
  const x = 8 + 2 * (RW + 6), y = 24;
  pz.push(riquadro(x, y, RW, RH, 'ritorno: il pettine'));
  for (let i = 0; i < 3; i++) pz.push(pettine(rigaFatta(x, y + 12, i), 1, i));
  const iso = isolata(x, y + 12);
  pz.push(`<path d="${via(iso)}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7" opacity="0.45"/>`);
  pz.push(pettine(iso, 1, 7));
  pz.push(freccia({ x: x + 30, y: y + 38 }, { x: x + 56, y: y + 37.6 }, ROSA, 0.8));
  pz.push(bollo(x + 24, y + 42, '2', ROSA));
  pz.push(testo(x + 3, y + RH - 8, 'i denti coprono l\'impuntura: la riga e\' cucita', 3.2, ROSA));
  pz.push(testo(x + 3, y + RH - 3.5, 'e il filo non e\' mai stato tagliato', 3.2, NERO, 'bold'));
}

// A4 — la riga si spezza, se serve
{
  const y = 24 + RH + 8;
  pz.push(testo(8, y + 5, 'Se la fila isolata sta in mezzo, la riga che si sta cucendo si spezza: si va a prenderla, e poi si riprende da dove si era rimasti.', 3.4));
  const x = 8, yy = y + 9;
  pz.push(riquadro(x, yy, RW * 2 + 6, 46, 'la riga si spezza per andare a prendere quella isolata'));
  const lunga = riga(4, 180, yy + 16, 1.5, 0.3).map((p) => ({ x: p.x + x, y: p.y }));
  const sx = lunga.filter((p) => p.x <= x + 70), dx2 = lunga.filter((p) => p.x >= x + 118);
  pz.push(pettine(sx, 1, 2));
  pz.push(pettine(dx2, 1, 5));
  const iso = riga(76, 112, yy + 32, 0.8, 0.9).map((p) => ({ x: p.x + x, y: p.y }));
  pz.push(`<path d="${via([sx[sx.length - 1], iso[0]])}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7"/>`);
  pz.push(`<path d="${via(iso)}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7"/>`);
  pz.push(pettine(iso, 1, 11));
  pz.push(`<path d="${via([iso[iso.length - 1], dx2[0]])}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7"/>`);
  pz.push(bollo(x + 60, yy + 20, '1', SCURO));
  pz.push(bollo(x + 94, yy + 38, '2', VERDE));
  pz.push(bollo(x + 128, yy + 20, '3', SCURO));
  pz.push(testo(x + RW * 2 + 12, yy + 14, '1  la riga in corso si ferma qui', 3.2));
  pz.push(testo(x + RW * 2 + 12, yy + 21, '2  si scende, si fa la fila isolata', 3.2, VERDE));
  pz.push(testo(x + RW * 2 + 18, yy + 26, 'andata e ritorno, e si risale', 3.2, VERDE));
  pz.push(testo(x + RW * 2 + 12, yy + 33, '3  la riga riprende da dove era', 3.2));
  pz.push(testo(x + RW * 2 + 12, yy + 41, 'un filo solo, nessun taglio', 3.2, NERO, 'bold'));
}

// ══ B · L'IMPUNTURA SOTTO IL COLORE CHE VIENE DOPO ═════════════════════════════════════════════
{
  const y0 = 24 + RH + 8 + 60;
  pz.push(testo(8, y0, 'B · IL PASSAGGIO CHE SI NASCONDE SOTTO IL COLORE CHE VIENE DOPO', 5.2, NERO, 'bold'));
  pz.push(testo(8, y0 + 6.5, 'Il chiaro si cuce per primo. Invece di tagliare fra una sua macchia e l\'altra, cammina in impuntura dentro il blocco scuro, lungo il confine.', 3.4));

  const disegna = (x: number, y: number, conScuro: boolean): void => {
    const confine = riga(4, 84, y + 30, 2.6, 0.2).map((p) => ({ x: p.x + x, y: p.y }));
    pz.push(`<path d="${via(confine)}" fill="none" stroke="#999" stroke-width="0.4" stroke-dasharray="2 1.5"/>`);
    for (const [a, b] of [[4, 32], [56, 84]] as Array<[number, number]>) {
      for (let i = 0; i < 3; i++) pz.push(pettine(riga(a, b, y + 12 + i * 5, 1.2, i * 0.4).map((p) => ({ x: p.x + x, y: p.y })), 0, i + a));
    }
    const dentro = riga(4, 84, y + 33.5, 2.6, 0.2).map((p) => ({ x: p.x + x, y: p.y })).filter((p) => p.x >= x + 30 && p.x <= x + 58);
    pz.push(`<path d="${via([{ x: x + 30, y: y + 27 }, ...dentro, { x: x + 58, y: y + 27 }])}" fill="none" stroke="${VERDE}" stroke-width="1" stroke-dasharray="2.6 1.7" opacity="${conScuro ? 0.4 : 1}"/>`);
    if (conScuro) for (let i = 0; i < 4; i++) pz.push(pettine(riga(4, 84, y + 34 + i * 5, 2.4, 0.2).map((p) => ({ x: p.x + x, y: p.y })), 1, i + 21));
  };
  const y = y0 + 10;
  pz.push(riquadro(8, y, RW * 1.5, 58, 'appena cucito il chiaro'));
  disegna(8, y, false);
  pz.push(bollo(8 + 44, y + 40, '1', VERDE));
  pz.push(testo(11, y + 54, 'l\'impuntura corre dentro lo scuro, sotto il confine', 3.2, VERDE));

  const x2 = 8 + RW * 1.5 + 6;
  pz.push(riquadro(x2, y, RW * 1.5, 58, 'dopo che lo scuro e\' stato cucito'));
  disegna(x2, y, true);
  pz.push(bollo(x2 + 44, y + 40, '2', SCURO));
  pz.push(testo(x2 + 3, y + 54, 'i denti dello scuro ci passano sopra: sparisce', 3.2, SCURO));

  const x3 = 8 + 2 * (RW * 1.5 + 6);
  pz.push(testo(x3, y + 12, 'Dove conviene', 3.6, NERO, 'bold'));
  pz.push(testo(x3, y + 19, 'Nei primi colori, che hanno sotto', 3.2));
  pz.push(testo(x3, y + 24, 'di se\' tutti gli altri: piu\' il colore', 3.2));
  pz.push(testo(x3, y + 29, 'e\' chiaro, piu\' strade ha.', 3.2));
  pz.push(testo(x3, y + 39, 'L\'impuntura entra di 2-3 mm nel', 3.2));
  pz.push(testo(x3, y + 44, 'blocco vicino: abbastanza da finire', 3.2));
  pz.push(testo(x3, y + 49, 'sotto i suoi denti, non tanto da', 3.2));
  pz.push(testo(x3, y + 54, 'sporcare il confine.', 3.2));
}

// ══ i numeri veri ══════════════════════════════════════════════════════════════════════════════
{
  const y = 24 + RH + 8 + 60 + 78;
  pz.push(testo(8, y, 'QUANTO PESANO, sul pannello di oggi: 177 salti in tutto', 4.4, NERO, 'bold'));
  const righe: Array<[string, string, string]> = [
    ['89', 'salti dentro uno stesso gruppo', 'li prende la tecnica A: 49 vanno verso una riga corta, 40 verso una lunga'],
    ['55', 'salti nel sormonto', 'corse spezzettate: le unisce la tecnica B, che le fa correre sotto lo scuro'],
    ['33', 'salti fra gruppi o colori diversi', 'la tecnica B, se fra i due c\'e\' un colore che si cuce dopo'],
  ];
  righe.forEach(([n, che, come], i) => {
    const yy = y + 9 + i * 9;
    pz.push(testo(8, yy, n, 5, VERDE, 'bold'));
    pz.push(testo(20, yy, che, 3.4, NERO, 'bold'));
    pz.push(testo(20, yy + 4.6, come, 3.2, '#555'));
  });
  pz.push(testo(8, y + 40, 'Quello che non si riesce a cucire resta un salto, come chiesto: meglio due blocchi separati che un filo a vista.', 3.4));
}

const W = 348, H = 300;
mkdirSync('apps/pettine/scripts/out', { recursive: true });
writeFileSync('apps/pettine/scripts/out/schema-passaggi.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">` + NL +
  `<rect width="${W}" height="${H}" fill="#faf9f7"/>` + NL + pz.join(NL) + NL + '</svg>', 'utf8');
console.log('-> apps/pettine/scripts/out/schema-passaggi.svg');

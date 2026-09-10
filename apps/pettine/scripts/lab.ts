// IL LABORATORIO DEI CASI. Lorenzo (2026-09-10): «creiamo un lab di studi in cui proviamo a vedere come
// hai risolto i passaggi e io ti dico come andrebbero fatti, cosi' nei casi studi tu impari e provi ad
// applicare». Fa girare il motore sul pannello registrando i casi (tagli, passaggi lunghi, corridoi
// delle macchie), disegna ognuno con tutto quello che c'era intorno nel momento della decisione, e
// scrive una pagina con lo spazio per la risposta. Le risposte stanno in `apps/pettine/lab/RISPOSTE.md`,
// una sezione per caso: si scrivono li' e alla corsa dopo compaiono accanto al disegno.
//
//   npm run lab:pettine            (casi: 6 per tipo; CASI=n per cambiarli; RITAGLIO=x,y,w,h per uno swatch)
//
// Il nome di un caso e' stabile fra una corsa e l'altra (ago, riga da cui si parte, riga dove si
// arriva): quando il motore cambia, lo stesso caso si ritrova con la sua risposta gia' scritta.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { leggiBmp } from '../../../packages/testkit/src/bmp.ts';
import { costruisciPettine, parametriPettineDefault, type CasoStudio, type Riquadro } from '../src/motore.ts';

const FILE = process.argv[2] ?? 'apps/pettine/fixtures/VETTORIALE-6-colori-v2-gruppo-blocchi.svg';
const FOTO = process.env.FOTO ?? 'BRIEFING-RASO-OMOGENEO/cianotipia.bmp';
const CASI = process.env.CASI !== undefined ? Number(process.env.CASI) : 6;
const LAB = 'apps/pettine/lab';
mkdirSync(`${LAB}/casi`, { recursive: true });

let ritaglio: Riquadro | null = null;
if (process.env.RITAGLIO) { const [x, y, w, h] = process.env.RITAGLIO.split(',').map(Number); ritaglio = { x, y, larghezza: w, altezza: h }; }
const foto = FOTO !== 'no' && existsSync(FOTO) ? leggiBmp(FOTO) : null;
const es = costruisciPettine(
  { testoSvg: readFileSync(FILE, 'utf8'), larghezzaRealeMm: 419.45, foto, ritaglio },
  { ...parametriPettineDefault, denti: true, dst: true, casiStudio: CASI },
);
const st = es.statistiche;
console.log(`${es.casi.length} casi · ${st.salti} tagli · ${st.passaggi} passaggi · ${st.passaggiScopertiM.toFixed(2)} m a vista`);

// ---- le risposte di Lorenzo, una sezione per caso ----------------------------------------------
const fileRisposte = `${LAB}/RISPOSTE.md`;
const risposte = new Map<string, string>();
let testoRisposte = existsSync(fileRisposte) ? readFileSync(fileRisposte, 'utf8') : '# Le risposte del laboratorio\n\nUna sezione per caso. Sotto «Come andrebbe fatto» scrivi tu; il resto lo scrive lo script.\n';
for (const m of testoRisposte.matchAll(/^## (\S+)[^\n]*\n([\s\S]*?)(?=^## |\Z)/gm)) {
  const corpo = m[2].replace(/^_Cosa ha fatto il sistema:_[^\n]*\n?/m, '').replace(/^_Come andrebbe fatto:_\s*/m, '').trim();
  if (corpo) risposte.set(m[1], corpo);
}
for (const k of es.casi) {
  if (testoRisposte.includes(`## ${k.nome} `) || testoRisposte.includes(`## ${k.nome}\n`)) continue;
  testoRisposte += `\n## ${k.nome} — ${k.tipo}, ago ${k.ago}, da riga ${k.daId} a riga ${k.aId}\n\n_Cosa ha fatto il sistema:_ ${k.cosaHoFatto}\n\n_Come andrebbe fatto:_\n\n`;
}
writeFileSync(fileRisposte, testoRisposte);

// ---- il disegno di un caso -----------------------------------------------------------------------
const COL: Record<string, string | null> = { '.': null, c: '#fff3c4', s: '#c9d3e6', l: '#eeeeee', D: '#7a7a7a', B: '#7dd87d', P: '#bfbfbf' };
const disegna = (k: CasoStudio): string => {
  const S = 6;                       // px per cella da mezzo millimetro: 12 px/mm
  const N = k.mappa.length, W = N * S;
  const X = (x: number): string => ((x - (k.cx - k.R)) * 2 * S).toFixed(1);
  const Y = (y: number): string => ((y - (k.cy - k.R)) * 2 * S).toFixed(1);
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}"><rect width="100%" height="100%" fill="#fff"/>`];
  k.mappa.forEach((r, yy) => {
    let x0 = 0;
    while (x0 < r.length) { const ch = r[x0]; let x1 = x0; while (x1 < r.length && r[x1] === ch) x1++; const col = COL[ch]; if (col) out.push(`<rect x="${x0 * S}" y="${yy * S}" width="${(x1 - x0) * S}" height="${S}" fill="${col}"/>`); x0 = x1; }
  });
  for (const r of k.righe) {
    const d = 'M' + r.base.map((q) => X(q[0]) + ',' + Y(q[1])).join('L');
    const col = r.cucita ? '#333' : '#2a8fd8';
    out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4" ${r.sorm ? 'stroke-dasharray="4 3"' : ''} opacity="0.9"/>`);
    const q = r.base[Math.floor(r.base.length / 2)];
    out.push(`<text x="${X(q[0])}" y="${Y(q[1])}" font-size="9" font-family="Helvetica,Arial" fill="${col}">${r.id}</text>`);
  }
  if (k.strada) out.push(`<path d="M${k.strada.map((q) => X(q[0]) + ',' + Y(q[1])).join('L')}" fill="none" stroke="#f08a1a" stroke-width="2.5"/>`);
  for (const q of k.scoperte) out.push(`<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="2.2" fill="#e01b24"/>`);
  if (k.tipo === 'taglio') out.push(`<line x1="${X(k.da[0])}" y1="${Y(k.da[1])}" x2="${X(k.a[0])}" y2="${Y(k.a[1])}" stroke="#e01b24" stroke-width="1.5" stroke-dasharray="6 4"/>`);
  out.push(`<circle cx="${X(k.da[0])}" cy="${Y(k.da[1])}" r="6" fill="#2ecc40"/><circle cx="${X(k.a[0])}" cy="${Y(k.a[1])}" r="6" fill="#ff2d95"/>`);
  out.push('</svg>');
  return out.join('\n');
};

// ---- la pagina -----------------------------------------------------------------------------------
// dove si scrivono le risposte, da qualunque pc: il file su GitHub, gia' in modifica
const EDIT = 'https://github.com/LorenzoErcoli/RG-EMBROIDERY-TOOLS-SUITE/edit/master/apps/pettine/lab/RISPOSTE.md';
const schede: string[] = [];
es.casi.forEach((k, n) => {
  const nome = `caso-${String(n + 1).padStart(2, '0')}-${k.nome}`;
  writeFileSync(`${LAB}/casi/${nome}.svg`, disegna(k));
  const g = k.giudizio;
  const risposta = risposte.get(k.nome);
  schede.push(`<section class="caso caso--${k.tipo}">
  <h2>${n + 1} · <code>${k.nome}</code> · ${k.tipo} · ago ${k.ago} · da riga ${k.daId} a riga ${k.aId}</h2>
  <div class="riga">
    <img src="casi/${nome}.svg" alt="${k.nome}">
    <div class="testo">
      <p class="fatto"><b>Cosa ha fatto il sistema.</b> ${k.cosaHoFatto}</p>
      ${g ? `<p class="numeri">strada ${g.lung} mm per ${g.d} mm in linea d'aria · a vista ${g.aVista} mm · costo medio ${g.costoMedio}</p>` : ''}
      <p class="risposta"><b>Come andrebbe fatto (Lorenzo).</b> ${risposta ? risposta.replace(/</g, '&lt;').replace(/\n/g, '<br>') : `<i>ancora da scrivere</i> · <a href="${EDIT}" target="_blank">scrivi la risposta per <code>${k.nome}</code></a>`}</p>
    </div>
  </div>
</section>`);
});
const legenda = `<p class="legenda"><span style="background:#fff3c4">tinta dell'ago, libera</span> <span style="background:#7dd87d">dietro libero: base senza denti sopra</span> <span style="background:#7a7a7a;color:#fff">denti già cuciti</span> <span style="background:#bfbfbf">base cucita coperta</span> <span style="background:#c9d3e6">tinte dopo</span> <span style="background:#eeeeee">tinte prima</span> · <span style="color:#333">— riga cucita</span> <span style="color:#2a8fd8">— riga da fare</span> (tratteggio = sormonto) · <span style="color:#f08a1a">— strada</span> <span style="color:#e01b24">● a vista</span> · <span style="color:#2ecc40">● dove il filo è</span> <span style="color:#ff2d95">● dove deve andare</span></p>`;
const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Laboratorio dei casi · pettine</title>
<style>body{font-family:Helvetica,Arial,sans-serif;margin:24px;color:#222;background:#fff;max-width:1400px}h1{font-size:22px}h2{font-size:15px;margin:0 0 8px}code{background:#f3f3f3;padding:1px 4px}
.caso{border:1px solid #ddd;padding:14px;margin:18px 0;border-radius:6px}.caso--taglio{border-left:6px solid #e01b24}.caso--passaggio{border-left:6px solid #f08a1a}.caso--innesto{border-left:6px solid #2a8fd8}
.riga{display:flex;gap:18px;align-items:flex-start}.riga img{width:520px;max-width:45%;border:1px solid #ccc}.testo{flex:1;font-size:14px;line-height:1.45}.numeri{color:#555;font-size:13px}.risposta{background:#f7fbe9;padding:10px;border-radius:4px}
.legenda span{padding:2px 6px;border-radius:3px;margin-right:4px;font-size:12px}.sommario{color:#444}.come{background:#eef4ff;padding:10px 12px;border-radius:4px}a{color:#1b6fb0}</style></head><body>
<h1>Laboratorio dei casi · punto pettine</h1>
<p class="sommario">${FILE}${ritaglio ? ` · ritaglio ${process.env.RITAGLIO}` : ''} · ${st.salti} tagli · ${st.passaggi} passaggi cuciti · ${st.passaggiScopertiM.toFixed(2)} m a vista · ${es.casi.length} casi registrati (${CASI} per tipo)</p>
<p>Ogni scheda è il momento di una decisione del filo: cosa c'era intorno, cosa ha fatto il sistema, e sotto lo spazio per come andrebbe fatto.</p>
<p class="come"><b>Come si risponde, da qualunque pc.</b> Apri <a href="${EDIT}" target="_blank">RISPOSTE.md su GitHub</a> (si apre già in modifica), cerca la sezione col nome del caso, scrivi sotto «Come andrebbe fatto» e premi <i>Commit changes</i>. Al commit il sito si rigenera da solo: dopo qualche minuto la tua risposta compare qui, accanto al disegno, e Claude la legge dal repo. Se un caso vuole un disegno, mettilo nella cartella <code>apps/pettine/lab/da-lorenzo/</code> e nominalo nella risposta.</p>
${legenda}
${schede.join('\n')}
</body></html>`;
writeFileSync(`${LAB}/index.html`, html);
console.log(`-> ${LAB}/index.html · ${LAB}/RISPOSTE.md (${risposte.size} risposte gia' scritte)`);

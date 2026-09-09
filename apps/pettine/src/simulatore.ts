// IL SIMULATORE DEL RICAMO. Lorenzo (2026-09-10): «un sequenzatore di punti, un simulatore del ricamo
// che fa vedere come si muove l'ago e quindi si riempie il filo: da grigio rende il filo colorato, con
// controlli su quanto andare avanti e sulla velocita'». Legge il DST appena generato — quindi mostra
// esattamente la sequenza che andra' in macchina, salti e cambi-ago compresi — e lo cuce sullo schermo:
// tutto il filo in grigio, e man mano che l'ago avanza il filo prende il colore del suo ago. I salti,
// cioe' i rasafili, restano tratteggiati in rosso: sono la cosa da guardare.
//
// Tre tele sovrapposte: la base grigia (disegnata una volta), il filo cucito (si aggiunge un pezzo alla
// volta: avanzare costa solo i punti nuovi), e l'ago (ridisegnato a ogni quadro). Tornare indietro
// ridisegna il cucito da capo fino al punto: sono al massimo duecentomila segmenti, mezzo secondo.
import { readDst } from '@rg/core';

export interface Simulatore {
  /** ferma l'animazione e stacca i controlli */
  distruggi(): void;
}

interface Segmento { x0: number; y0: number; x1: number; y1: number; ago: number; salto: boolean; blocco: number }

export function montaSimulatore(
  host: HTMLElement, controlli: HTMLElement, dst: Uint8Array, colori: string[], larghezzaMm: number, altezzaMm: number, stato: (s: string) => void,
): Simulatore {
  const letto = readDst(dst);
  // la sequenza: un segmento per punto, piu' un segmento di salto fra un blocco e il successivo
  const seg: Segmento[] = [];
  const inizioBlocco: number[] = [];
  let prev: [number, number] | null = null;
  letto.blocks.forEach((b, bi) => {
    inizioBlocco.push(seg.length);
    const p = b.points_mm;
    if (prev && p.length) seg.push({ x0: prev[0], y0: prev[1], x1: p[0][0], y1: p[0][1], ago: b.needle, salto: true, blocco: bi });
    for (let i = 1; i < p.length; i++) seg.push({ x0: p[i - 1][0], y0: p[i - 1][1], x1: p[i][0], y1: p[i][1], ago: b.needle, salto: false, blocco: bi });
    if (p.length) prev = p[p.length - 1];
  });
  const N = seg.length;
  const filoTot = seg.reduce((a, s) => a + (s.salto ? 0 : Math.hypot(s.x1 - s.x0, s.y1 - s.y0)), 0);

  // ---- le tele -----------------------------------------------------------------------------------
  const PXMM = Math.min(4, 2400 / Math.max(larghezzaMm, altezzaMm, 1));
  const W = Math.max(1, Math.round(larghezzaMm * PXMM)), H = Math.max(1, Math.round(altezzaMm * PXMM));
  host.innerHTML = '';
  const cornice = document.createElement('div');
  cornice.className = 'sim-cornice';
  cornice.style.width = `${larghezzaMm.toFixed(1)}mm`;
  cornice.style.height = `${altezzaMm.toFixed(1)}mm`;
  const tela = (): CanvasRenderingContext2D => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.className = 'sim-tela';
    cornice.appendChild(c);
    const g = c.getContext('2d')!;
    g.scale(PXMM, PXMM);
    g.lineCap = 'round'; g.lineJoin = 'round';
    return g;
  };
  const base = tela(), filo = tela(), ago = tela();
  host.appendChild(cornice);
  base.fillStyle = '#f7f6f3'; base.fillRect(0, 0, larghezzaMm, altezzaMm);
  base.strokeStyle = '#d9d9d9'; base.lineWidth = 0.12;
  base.beginPath();
  for (const s of seg) if (!s.salto) { base.moveTo(s.x0, s.y0); base.lineTo(s.x1, s.y1); }
  base.stroke();

  const colore = (n: number): string => colori[n - 1] ?? '#333';
  const tratto = (n: number): string => (n === 1 && /^#(d|e|f)/i.test(colore(n)) ? '#9a9a9a' : colore(n));
  let disegnato = 0;   // quanti segmenti sono gia' sul filo cucito
  const disegnaFino = (fino: number): void => {
    if (fino < disegnato) { filo.clearRect(0, 0, larghezzaMm, altezzaMm); disegnato = 0; }
    let i = disegnato;
    while (i < fino) {
      // un tratto per ogni corsa di segmenti dello stesso tipo e dello stesso ago
      const s0 = seg[i];
      let j = i;
      while (j < fino && seg[j].ago === s0.ago && seg[j].salto === s0.salto) j++;
      filo.beginPath();
      for (let k = i; k < j; k++) { filo.moveTo(seg[k].x0, seg[k].y0); filo.lineTo(seg[k].x1, seg[k].y1); }
      if (s0.salto) { filo.strokeStyle = '#e01b24'; filo.lineWidth = 0.25; filo.setLineDash([1.2, 0.8]); }
      else { filo.strokeStyle = tratto(s0.ago); filo.lineWidth = 0.28; filo.setLineDash([]); }
      filo.stroke();
      i = j;
    }
    disegnato = fino;
  };
  const disegnaAgo = (pos: number): void => {
    ago.clearRect(0, 0, larghezzaMm, altezzaMm);
    if (!N) return;
    const s = seg[Math.min(N - 1, Math.max(0, pos - 1))];
    const x = pos > 0 ? s.x1 : seg[0].x0, y = pos > 0 ? s.y1 : seg[0].y0;
    ago.beginPath(); ago.arc(x, y, 1.6, 0, Math.PI * 2);
    ago.fillStyle = 'rgba(255,45,149,0.35)'; ago.fill();
    ago.beginPath(); ago.arc(x, y, 0.5, 0, Math.PI * 2);
    ago.fillStyle = '#ff2d95'; ago.fill();
  };

  // ---- i controlli -------------------------------------------------------------------------------
  controlli.innerHTML = `
    <div class="sim-barra">
      <div class="rg-cluster sim-tasti">
        <button type="button" class="rg-button rg-button--ghost" data-sim="inizio" title="all'inizio">⏮</button>
        <button type="button" class="rg-button rg-button--ghost" data-sim="blocco-" title="blocco prima">⏪</button>
        <button type="button" class="rg-button rg-button--ghost" data-sim="-1" title="un punto indietro">◀</button>
        <button type="button" class="rg-button rg-button--primary" data-sim="play" title="cuci">▶ Cuci</button>
        <button type="button" class="rg-button rg-button--ghost" data-sim="+1" title="un punto avanti">▶</button>
        <button type="button" class="rg-button rg-button--ghost" data-sim="blocco+" title="blocco dopo">⏩</button>
        <button type="button" class="rg-button rg-button--ghost" data-sim="fine" title="alla fine">⏭</button>
      </div>
      <label class="sim-campo"><span>Punto</span><input type="range" id="simPos" min="0" max="${N}" value="0" step="1"></label>
      <label class="sim-campo"><span>Velocità</span><input type="range" id="simVel" min="0" max="100" value="55" step="1"><span class="rg-mono" id="simVelTxt"></span></label>
      <span class="rg-mono sim-lettura" id="simLettura"></span>
    </div>`;
  const q = (sel: string): HTMLElement => controlli.querySelector(sel) as HTMLElement;
  const slPos = q('#simPos') as HTMLInputElement, slVel = q('#simVel') as HTMLInputElement;
  const velocita = (): number => Math.round(Math.pow(10, 1 + (Number(slVel.value) / 100) * 3.3));   // 10 … 20000 punti al secondo
  let pos = 0, inCorsa = false, ultimoT = 0, resto = 0, raf = 0;

  const aggiorna = (): void => {
    disegnaFino(pos); disegnaAgo(pos);
    slPos.value = String(pos);
    q('#simVelTxt').textContent = `${velocita()} punti/s`;
    const s = pos > 0 ? seg[pos - 1] : null;
    let filoCucito = 0, salti = 0;
    for (let i = 0; i < pos; i++) { const t = seg[i]; if (t.salto) salti++; else filoCucito += Math.hypot(t.x1 - t.x0, t.y1 - t.y0); }
    q('#simLettura').innerHTML = s
      ? `punto ${pos} / ${N} · ago <span class="sim-ago" style="background:${colore(s.ago)}"></span> ${s.ago} · blocco ${s.blocco + 1} / ${letto.blocks.length} · filo ${(filoCucito / 1000).toFixed(1)} / ${(filoTot / 1000).toFixed(1)} m · rasafili passati ${salti} / ${letto.jumps.length}`
      : `${N} punti · ${letto.blocks.length} blocchi · ${letto.jumps.length} rasafili · ${(filoTot / 1000).toFixed(1)} m di filo`;
  };
  const vaiA = (p: number): void => { pos = Math.max(0, Math.min(N, Math.round(p))); aggiorna(); };
  const quadro = (t: number): void => {
    if (!inCorsa) return;
    const dt = ultimoT ? (t - ultimoT) / 1000 : 0;
    ultimoT = t;
    resto += dt * velocita();
    const passi = Math.floor(resto);
    if (passi > 0) { resto -= passi; vaiA(pos + passi); }
    if (pos >= N) { ferma(); stato('Cucitura finita.'); return; }
    raf = requestAnimationFrame(quadro);
  };
  const avvia = (): void => { if (inCorsa) return; if (pos >= N) pos = 0; inCorsa = true; ultimoT = 0; resto = 0; q('[data-sim=play]').textContent = '⏸ Ferma'; raf = requestAnimationFrame(quadro); };
  const ferma = (): void => { inCorsa = false; cancelAnimationFrame(raf); q('[data-sim=play]').textContent = '▶ Cuci'; };
  const bloccoDi = (p: number): number => { let b = 0; while (b + 1 < inizioBlocco.length && inizioBlocco[b + 1] <= p) b++; return b; };
  controlli.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-sim]') as HTMLElement | null;
    if (!b) return;
    const k = b.dataset.sim;
    if (k === 'play') { if (inCorsa) ferma(); else avvia(); return; }
    ferma();
    if (k === 'inizio') vaiA(0);
    else if (k === 'fine') vaiA(N);
    else if (k === '-1') vaiA(pos - 1);
    else if (k === '+1') vaiA(pos + 1);
    else if (k === 'blocco-') { const bl = bloccoDi(Math.max(0, pos - 1)); vaiA(inizioBlocco[pos > inizioBlocco[bl] ? bl : Math.max(0, bl - 1)]); }
    else if (k === 'blocco+') { const bl = bloccoDi(pos); vaiA(bl + 1 < inizioBlocco.length ? inizioBlocco[bl + 1] : N); }
  });
  slPos.addEventListener('input', () => { ferma(); vaiA(Number(slPos.value)); });
  slVel.addEventListener('input', () => { q('#simVelTxt').textContent = `${velocita()} punti/s`; });
  aggiorna();
  return { distruggi: () => { ferma(); controlli.innerHTML = ''; } };
}

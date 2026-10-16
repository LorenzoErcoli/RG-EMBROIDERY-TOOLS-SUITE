// La vista della SACCA APPESA: sotto-programma della sacca a rete, acceso dal pulsante «Sacca 3D» (Lorenzo,
// 2026-10-16: «solo con un bottone attivo non sempre»). Disegna la simulazione di sacca3d.ts e la fa girare solo
// finché è aperta e la sacca si sta ancora muovendo; trascinando si gira la vista.
import type { Anelli } from './sacca';
import { appendi, avanza, creaSaccaAppesa, misureAppesa, type ModoAppesa, type SaccaAppesa } from './sacca3d';

export interface DatiVista3d { anelli: Anelli; N: number; L: number; giroInCima: boolean; filo: number }

const COLORI = { rete: '#1f4e79', fondo: '#8a6a1f', cima: '#c0392b', fermo: '#c0392b' } as const;

/** Monta la vista dentro `box`. Ritorna `distruggi` (ferma il calcolo e libera la vista). */
export function montaVista3d(box: HTMLElement, dati: DatiVista3d): { distruggi: () => void } {
  const rOut = dati.anelli.rho[dati.anelli.rho.length - 1];
  const stato = { modo: 'bocca' as ModoAppesa, bocca: Math.round(2 * dati.anelli.rho[0]), manici: Math.round(rOut), morbidezza: 70 };
  box.innerHTML = `
    <div class="rete-vista3d__controlli rg-cluster">
      <label class="rg-field"><span class="rg-field__label">Appesa</span>
        <select class="rg-select" id="v3-modo"><option value="bocca">per la bocca</option><option value="manici">per due punti del bordo</option></select></label>
      <label class="rg-field" id="v3-bocca-campo"><span class="rg-field__label">Bocca</span>
        <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" id="v3-bocca" min="20" max="${Math.floor(2 * rOut)}" step="5" value="${stato.bocca}"><span>mm</span></span></label>
      <label class="rg-field" id="v3-manici-campo" hidden><span class="rg-field__label">Fra i due punti</span>
        <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" id="v3-manici" min="20" max="${Math.floor(2 * rOut)}" step="5" value="${stato.manici}"><span>mm</span></span></label>
      <label class="rg-field"><span class="rg-field__label">Morbidezza del filo</span>
        <span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" id="v3-morbido" min="0" max="100" step="5" value="${stato.morbidezza}"><span>%</span></span></label>
      <button class="rg-button rg-button--ghost rg-button--small" id="v3-ricomincia">Ricomincia dal disco piatto</button>
    </div>
    <canvas class="rete-vista3d__tela" id="v3-tela" aria-label="La sacca appesa, in 3D: trascina per girarla"></canvas>
    <p class="rg-field__help rete-vista3d__stato" id="v3-stato" role="status"></p>`;
  const $ = <T extends HTMLElement>(id: string) => box.querySelector<T>('#' + id)!;
  const tela = $<HTMLCanvasElement>('v3-tela');
  let sacca: SaccaAppesa = nuova();
  let yaw = 0.6, pitch = 0.35, giro = 0, vivo = true;

  function nuova(): SaccaAppesa {
    return creaSaccaAppesa(dati.anelli, {
      N: dati.N, L: dati.L, giroInCima: dati.giroInCima, filo: dati.filo,
      modo: stato.modo, boccaMm: stato.bocca, maniciMm: stato.manici, morbidezza: stato.morbidezza / 100,
    });
  }
  function riappendi() {
    sacca.opz = { ...sacca.opz, modo: stato.modo, boccaMm: stato.bocca, maniciMm: stato.manici, morbidezza: stato.morbidezza / 100 };
    appendi(sacca, dati.anelli);
    parti();
  }

  function disegna() {
    const r = tela.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    tela.width = Math.max(1, Math.round(r.width * dpr)); tela.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = tela.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height;
    ctx.clearRect(0, 0, w, h);
    let zmin = 0, rmax = 1;
    for (const q of sacca.nodi) { zmin = Math.min(zmin, q.z); rmax = Math.max(rmax, Math.hypot(q.x, q.y)); }
    const scala = Math.min(w / (2.3 * rmax), h / (1.25 * (rmax * 0.6 - zmin + 10)));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), zc = zmin / 2;
    const P = (x: number, y: number, z: number): [number, number, number] => {
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy, zz = z - zc;
      return [w / 2 + x1 * scala, h / 2 - (zz * cp - y1 * sp) * scala, y1 * cp + zz * sp];
    };
    const pr = sacca.nodi.map((q) => P(q.x, q.y, q.z));
    const fili = sacca.fili.map((f) => ({ f, d: (pr[f.a][2] + pr[f.b][2]) / 2 })).sort((a, b) => b.d - a.d);
    const dmax = Math.max(...fili.map((x) => Math.abs(x.d))) || 1;
    ctx.lineCap = 'round';
    for (const { f, d } of fili) {
      ctx.strokeStyle = COLORI[f.tipo]; ctx.globalAlpha = 0.35 + 0.65 * (1 - (d / dmax + 1) / 2);
      ctx.lineWidth = f.tipo === 'rete' ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(pr[f.a][0], pr[f.a][1]); ctx.lineTo(pr[f.b][0], pr[f.b][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = COLORI.fermo;
    sacca.nodi.forEach((q, i) => { if (q.fermo) { ctx.beginPath(); ctx.arc(pr[i][0], pr[i][1], 3, 0, 7); ctx.fill(); } });
    const m = misureAppesa(sacca);
    $('v3-stato').textContent = (m.allungamentoMax > 0.03
      ? `Così non si può: i fili dovrebbero allungarsi del ${(m.allungamentoMax * 100).toFixed(0)}%. Stringi la bocca o avvicina i due punti.`
      : `Scende ${m.profondita.toFixed(0)} mm, larga al più Ø ${m.larghezza.toFixed(0)} mm`)
      + (sacca.movimento < 0.002 ? ' · ferma' : ' · si sta assestando…');
  }

  function ciclo() {
    giro = 0;
    if (!vivo) return;
    avanza(sacca, 4);
    disegna();
    if (sacca.movimento >= 0.002 && sacca.passi < 8000) giro = requestAnimationFrame(ciclo);
  }
  function parti() { if (!giro && vivo) giro = requestAnimationFrame(ciclo); }

  $<HTMLSelectElement>('v3-modo').addEventListener('change', (e) => {
    stato.modo = (e.target as HTMLSelectElement).value as ModoAppesa;
    $('v3-bocca-campo').hidden = stato.modo !== 'bocca'; $('v3-manici-campo').hidden = stato.modo !== 'manici';
    riappendi();
  });
  const numero = (id: string, chiave: 'bocca' | 'manici' | 'morbidezza', min: number, max: number) =>
    $<HTMLInputElement>(id).addEventListener('change', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value); if (!Number.isFinite(v)) return;
      stato[chiave] = Math.min(max, Math.max(min, v)); riappendi();
    });
  numero('v3-bocca', 'bocca', 20, 2 * rOut);
  numero('v3-manici', 'manici', 20, 2 * rOut);
  numero('v3-morbido', 'morbidezza', 0, 100);
  $('v3-ricomincia').addEventListener('click', () => { sacca = nuova(); parti(); });

  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  tela.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; tela.setPointerCapture(e.pointerId); });
  tela.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01; pitch = Math.max(-0.2, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.01));
    if (!giro) disegna();
  });
  tela.addEventListener('pointerup', () => { drag = null; });
  const ridisegna = () => { if (!giro) disegna(); };
  addEventListener('resize', ridisegna);

  parti();
  return {
    distruggi: () => { vivo = false; if (giro) cancelAnimationFrame(giro); giro = 0; removeEventListener('resize', ridisegna); box.innerHTML = ''; },
  };
}

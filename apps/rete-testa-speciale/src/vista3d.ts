// La vista della SACCA APPESA: sotto-programma della sacca a rete, acceso dal pulsante «Sacca 3D» (Lorenzo,
// 2026-10-16: «solo con un bottone attivo non sempre»). Disegna la simulazione di sacca3d.ts e la fa girare solo
// finché è aperta e la sacca si sta ancora muovendo; trascinando si gira la vista. Il cordone si monta e si stringe qui:
// è un'aggiunta al montaggio, non un ricamo.
import type { Anelli, RegolaSovrapposizione } from './sacca';
import { appendi, avanza, creaSaccaAppesa, misureAppesa, rigiditaDalPasso, stringi, type ModoAppesa, type SaccaAppesa } from './sacca3d';

export interface DatiVista3d { anelli: Anelli; N: number; L: number; giroInCima: boolean; filo: number; passoSpirale: number; legature: number; sovrapposizione: number; regola: RegolaSovrapposizione }

const COLORI = { rete: '#1f4e79', fondo: '#8a6a1f', cima: '#7d8681', cordone: '#b8327a', capi: '#b8327a', fermo: '#c0392b' } as const;

/** Monta la vista dentro `box`. Ritorna `distruggi` (ferma il calcolo e libera la vista). */
export function montaVista3d(box: HTMLElement, dati: DatiVista3d): { distruggi: () => void } {
  const rOut = dati.anelli.rho[dati.anelli.rho.length - 1];
  const stato = {
    modo: 'cordone' as ModoAppesa, cordone: true, stretta: 50,
    bocca: Math.round(2 * dati.anelli.rho[0]), manici: Math.round(rOut), morbidezza: 70,
    fondo: Math.round(100 * rigiditaDalPasso(dati.passoSpirale, dati.filo)),
  };
  const numero = (id: string, etichetta: string, valore: number, min: number, max: number, passo: number, unita: string, nascosto = false) =>
    `<label class="rg-field" id="${id}-campo"${nascosto ? ' hidden' : ''}><span class="rg-field__label">${etichetta}</span>`
    + `<span class="rg-field-with-unit"><input class="rg-input rg-input--numeric" type="number" id="${id}" min="${min}" max="${max}" step="${passo}" value="${valore}"><span>${unita}</span></span></label>`;
  box.innerHTML = `
    <div class="rete-vista3d__controlli rg-cluster">
      <label class="rg-choice"><input type="checkbox" id="v3-cordone" checked> Cordone nell’ultima fila</label>
      ${numero('v3-stretta', 'Stringi il cordone', stato.stretta, 0, 100, 5, '%')}
      <label class="rg-field"><span class="rg-field__label">Tenuta</span>
        <select class="rg-select" id="v3-modo">
          <option value="cordone">per i capi del cordone</option>
          <option value="bocca">per la bocca</option>
          <option value="manici">per due punti del bordo</option>
          <option value="appoggiata">appoggiata sul fondo</option>
        </select></label>
      ${numero('v3-bocca', 'Bocca', stato.bocca, 20, Math.floor(2 * rOut), 5, 'mm', true)}
      ${numero('v3-manici', 'Fra i due punti', stato.manici, 20, Math.floor(2 * rOut), 5, 'mm', true)}
      ${numero('v3-morbido', 'Morbidezza del filo', stato.morbidezza, 0, 100, 5, '%')}
      ${numero('v3-fondo', 'Rigidità del fondo', stato.fondo, 0, 100, 5, '%')}
      <button class="rg-button rg-button--ghost rg-button--small" id="v3-ricomincia">Ricomincia dal disco piatto</button>
    </div>
    <canvas class="rete-vista3d__tela" id="v3-tela" aria-label="La sacca, in 3D: trascina per girarla"></canvas>
    <p class="rg-field__help rete-vista3d__stato" id="v3-stato" role="status"></p>`;
  const $ = <T extends HTMLElement>(id: string) => box.querySelector<T>('#' + id)!;
  const tela = $<HTMLCanvasElement>('v3-tela');
  let sacca: SaccaAppesa = nuova();
  let yaw = 0.6, pitch = 0.35, giro = 0, vivo = true;

  function nuova(): SaccaAppesa {
    return creaSaccaAppesa(dati.anelli, {
      N: dati.N, L: dati.L, giroInCima: dati.giroInCima, filo: dati.filo,
      modo: stato.modo, boccaMm: stato.bocca, maniciMm: stato.manici, morbidezza: stato.morbidezza / 100,
      fondoRigido: stato.fondo / 100, cordone: stato.cordone, stretta: stato.stretta / 100,
      passoSpirale: dati.passoSpirale, legature: dati.legature, sovrapposizione: dati.sovrapposizione, regola: dati.regola,
    });
  }
  /** Le scelte che cambiano com'è fatta (non solo dove la si tiene): si riparte dal disco. */
  function rifai() { sacca = nuova(); parti(); }
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
    // si centra sulla sacca com'è adesso (appesa al nodo non sta sull'asse)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [i, q] of sacca.nodi.entries()) { if (sacca.assenti[i]) continue; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2, raggio = Math.max(x1 - x0, y1 - y0, z1 - z0, 1) / 2;
    const scala = Math.min(w, h) / (2.3 * raggio);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const P = (x: number, y: number, z: number): [number, number, number] => {
      const xx = x - mx, yy = y - my, zz = z - mz, x1r = xx * cy - yy * sy, y1r = xx * sy + yy * cy;
      return [w / 2 + x1r * scala, h / 2 - (zz * cp - y1r * sp) * scala, y1r * cp + zz * sp];
    };
    const pr = sacca.nodi.map((q) => P(q.x, q.y, q.z));
    const fili = sacca.fili.map((f) => ({ f, d: (pr[f.a][2] + pr[f.b][2]) / 2 })).sort((a, b) => b.d - a.d);
    const dmax = Math.max(...fili.map((x) => Math.abs(x.d))) || 1;
    ctx.lineCap = 'round';
    for (const { f, d } of fili) {
      ctx.strokeStyle = COLORI[f.tipo]; ctx.globalAlpha = f.tipo === 'cordone' || f.tipo === 'capi' ? 1 : 0.35 + 0.65 * (1 - (d / dmax + 1) / 2);
      ctx.lineWidth = f.tipo === 'cordone' || f.tipo === 'capi' ? 2.6 : f.tipo === 'rete' ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(pr[f.a][0], pr[f.a][1]); ctx.lineTo(pr[f.b][0], pr[f.b][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = COLORI.fermo;
    sacca.nodi.forEach((q, i) => { if (q.fermo && !sacca.assenti[i]) { ctx.beginPath(); ctx.arc(pr[i][0], pr[i][1], 3, 0, 7); ctx.fill(); } });
    const m = misureAppesa(sacca);
    $('v3-stato').textContent = (m.allungamentoMax > 0.03
      ? `Così non si può: i fili dovrebbero allungarsi del ${(m.allungamentoMax * 100).toFixed(0)}%.`
        + (stato.cordone && stato.stretta > 90 ? ' Il cordone non chiude del tutto: allentalo un po’.' : ' Stringi la bocca o avvicina i due punti.')
      : `${stato.modo === 'appoggiata' ? 'Alta' : 'Scende'} ${m.profondita.toFixed(0)} mm · bocca Ø ${m.bocca.toFixed(0)} mm · larga ${m.larghezza.toFixed(0)} mm`)
      + (sacca.movimento < 0.002 ? ' · ferma' : ' · si sta assestando…');
  }

  function ciclo() {
    giro = 0;
    if (!vivo) return;
    avanza(sacca, 4);
    disegna();
    if (sacca.movimento >= 0.002 && sacca.passi < 10000) giro = requestAnimationFrame(ciclo);
  }
  function parti() { if (!giro && vivo) giro = requestAnimationFrame(ciclo); }

  const campiVisibili = () => {
    $('v3-bocca-campo').hidden = stato.modo !== 'bocca';
    $('v3-manici-campo').hidden = stato.modo !== 'manici';
    $('v3-stretta-campo').hidden = !stato.cordone;
    const sel = $<HTMLSelectElement>('v3-modo');
    sel.querySelector<HTMLOptionElement>('option[value="cordone"]')!.disabled = !stato.cordone;
    if (!stato.cordone && stato.modo === 'cordone') { stato.modo = 'bocca'; sel.value = 'bocca'; }
    $('v3-bocca-campo').hidden = stato.modo !== 'bocca';
  };
  $<HTMLInputElement>('v3-cordone').addEventListener('change', (e) => { stato.cordone = (e.target as HTMLInputElement).checked; campiVisibili(); rifai(); });
  $<HTMLSelectElement>('v3-modo').addEventListener('change', (e) => {
    const prima = stato.modo; stato.modo = (e.target as HTMLSelectElement).value as ModoAppesa; campiVisibili();
    if (prima === 'appoggiata' || stato.modo === 'appoggiata') rifai(); else riappendi();
  });
  const leggi = (id: string, min: number, max: number, fatto: (v: number) => void) =>
    $<HTMLInputElement>(id).addEventListener('change', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(v)) fatto(Math.min(max, Math.max(min, v)));
    });
  leggi('v3-stretta', 0, 100, (v) => { stato.stretta = v; stringi(sacca, v / 100); parti(); });
  leggi('v3-bocca', 20, 2 * rOut, (v) => { stato.bocca = v; riappendi(); });
  leggi('v3-manici', 20, 2 * rOut, (v) => { stato.manici = v; riappendi(); });
  leggi('v3-morbido', 0, 100, (v) => { stato.morbidezza = v; riappendi(); });
  leggi('v3-fondo', 0, 100, (v) => { stato.fondo = v; rifai(); });
  $('v3-ricomincia').addEventListener('click', rifai);

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

  campiVisibili();
  parti();
  return {
    distruggi: () => { vivo = false; if (giro) cancelAnimationFrame(giro); giro = 0; removeEventListener('resize', ridisegna); box.innerHTML = ''; },
  };
}

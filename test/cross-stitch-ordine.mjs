// L'ORDINE DEI FILI CONSIGLIATO del Punto croce (ordine.ts; Lorenzo, 2026-11-26: «valutare quale filo far passare
// prima e quale dopo in base al minor numero di salti… chiaro sotto scuro sopra»). Un blocco di prove che smoke.mjs
// chiama con il suo bundle (`rg`) e il suo `check`.
export function proveOrdine(rg, check) {
  console.log('\nPunto croce — l\u2019ordine dei fili consigliato');
  check('luminosità: il bianco più chiaro del nero, il formato corto vale come il lungo',
    [rg.csLumaOf('#ffffff') > rg.csLumaOf('#000000'), Math.round(rg.csLumaOf('#fff')), Math.round(rg.csLumaOf('#000'))], [true, 255, 0]);
  // un modulo 8 × 3: filo 1 (chiaro) ai due lati, filo 2 (scuro) in mezzo. Col filo 2 sopra, il filo 1 passa sotto di
  // lui da un lato all'altro; col filo 2 sotto, no: salta
  const C = 8, R = 3;
  const marks = Array.from({ length: C * R }, (_, i) => { const c = i % C, r = Math.floor(i / C); return r !== 1 ? null : { stitch: 'v', color: c === 0 || c === C - 1 ? 1 : 2 }; });
  const grid = { cols: 3 * C, rows: R, cellW: 2.5, cellH: 3, overlapPct: 0 };
  const params = { ...rg.CS_DEFAULT_ROUTE, noVisible: true, base: { color: 0, stitch: 'v' } }; // il filo 0 è la base: resta primo
  const input = { grid, cells: new Map(), params, module: { cols: C, rows: R, marks }, realGrid: grid, hex: ['#888888', '#eeeeee', '#222222'] };
  const giusto = rg.csEvalOrder(input, [0, 1, 2]), rovescio = rg.csEvalOrder(input, [0, 2, 1]);
  check('ordine: chiaro sotto e scuro sopra non conta niente contro la regola; il contrario sì',
    [giusto.darkUnder, rovescio.darkUnder > 100], [0, true]);
  const memo = new Map();
  const conMemo = [rg.csEvalOrder(input, [0, 1, 2], memo).jumps, rg.csEvalOrder(input, [0, 2, 1], memo).jumps, rg.csEvalOrder(input, [0, 1, 2], memo).jumps];
  check('ordine: i conti riusati (memo) danno gli stessi salti di quelli rifatti', conMemo, [giusto.jumps, rovescio.jumps, giusto.jumps]);
  const sug = rg.csSuggestOrders(input);
  check('ordine consigliato: il primo è quello che costa meno, ed è chiaro sotto scuro sopra',
    [sug.length >= 2, sug.every((r, k) => k === 0 || r.cost >= sug[0].cost), sug[0].order], [true, true, [0, 1, 2]]);
}

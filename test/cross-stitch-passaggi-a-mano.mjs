// I PASSAGGI RIDISEGNATI A MANO del Punto croce (Lorenzo, 2026-11-25: «ma perché fa tutti questi scalini» → dritti da
// un pallino all'altro; «a volte mi perde le modifiche nel ricalcolarlo più tardi» → applicati per ultimi su tutto il
// percorso, anche a strisce e sulla base in un solo stop). Un blocco di prove che smoke.mjs chiama con il suo bundle
// (`rg`) e il suo `check`.
export function provePassaggiAMano(rg, check) {
  console.log('\nPunto croce — i passaggi ridisegnati a mano');
  const g = { cols: 12, rows: 8, cellW: 2.5, cellH: 3, overlapPct: 30 };
  const W = 2 * g.cols + 1;
  // due pezzi del filo 1, lontani: in alto a sinistra e in basso a destra
  const cells = new Map();
  for (const c of [1, 2]) cells.set(1 * g.cols + c, { stitch: 'v', color: 1 });
  for (const c of [9, 10]) cells.set(6 * g.cols + c, { stitch: 'v', color: 1 });
  const runOf = (segs) => {
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].kind === 'stitch' || segs[i].kind === 'jump') continue;
      let j = i; while (j < segs.length && segs[j].kind !== 'stitch' && segs[j].kind !== 'jump') j++;
      if (segs[i].from !== segs[j - 1].to) return { from: segs[i].from, to: segs[j - 1].to, segs: segs.slice(i, j) };
      i = j - 1;
    }
    return null;
  };
  const route = { ...rg.CS_DEFAULT_ROUTE, jumpMm: 1000 };
  const free = runOf(rg.csRouteAll(g, cells, route).colors.find((cr) => cr.color === 1).segs);
  const via = [2 * W + 14, 5 * W + 6]; // due pallini
  const forcedOf = (r) => [{ from: r.from, to: r.to, via }];
  const pathOf = (res, color = 1) => runOf(res.colors.find((cr) => cr.color === color).segs);
  const dritto = pathOf(rg.csRouteAll(g, cells, { ...route, forced: forcedOf(free) }));
  check('passaggio a mano: dritto da un pallino all\'altro (un tratto fra due pallini), dai capi di prima',
    dritto ? dritto.segs.map((sg) => [sg.from, sg.to]) : null, [[free.from, via[0]], [via[0], via[1]], [via[1], free.to]]);

  // a strisce di 3 righe: due pezzi nella prima striscia (righe 0 e 2), il pallino nella terza (riga 7); prima il
  // passaggio a mano si buttava via
  const cs = new Map();
  for (const c of [1, 2]) cs.set(0 * g.cols + c, { stitch: 'v', color: 1 });
  for (const c of [9, 10]) cs.set(2 * g.cols + c, { stitch: 'v', color: 1 });
  const strisce = rg.csRouteAll(g, cs, { ...route, strips: { rows: 3 } });
  const perStriscia = strisce.colors.filter((cr) => cr.color === 1).map((cr) => runOf(cr.segs)).find((r) => r);
  const conStrisce = perStriscia ? rg.csRouteAll(g, cs, { ...route, strips: { rows: 3 }, forced: [{ from: perStriscia.from, to: perStriscia.to, via: [7 * W + 2] }] }) : null;
  const passa = conStrisce ? conStrisce.colors.filter((cr) => cr.color === 1).some((cr) => cr.segs.some((sg) => sg.kind !== 'stitch' && sg.to === 7 * W + 2)) : false;
  check('passaggio a mano a strisce, con un pallino fuori dalla sua striscia: resta (prima si perdeva ricalcolando)', [!!perStriscia, passa], [true, true]);

  // sulla base in un solo stop (a strisce la base è intera, prima delle strisce): anche i suoi passaggi
  const conBase = { ...route, base: { color: 0, stitch: 'v' }, strips: { rows: 4 }, mask: (() => { const m = new Uint8Array(g.rows * g.cols).fill(1); for (let r = 0; r < 3; r++) for (let c = 4; c <= 7; c++) m[r * g.cols + c] = 0; return m; })() };
  const base0 = rg.csRouteAll(g, cells, conBase);
  const bRun = runOf(base0.colors.find((cr) => cr.color === 0).segs);
  const viaB = bRun ? bRun.from + 2 * W : -1;
  const base1 = bRun ? rg.csRouteAll(g, cells, { ...conBase, forced: [{ from: bRun.from, to: bRun.to, via: [viaB] }] }) : null;
  check('passaggio a mano sulla base in un solo stop: resta (la base non riceveva i passaggi a mano)',
    base1 ? base1.colors.find((cr) => cr.color === 0).segs.some((sg) => sg.kind !== 'stitch' && sg.to === viaB) : null, true);
}

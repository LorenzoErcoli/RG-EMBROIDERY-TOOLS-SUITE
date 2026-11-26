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

  // NEL MODULO A FASCE (Lorenzo, 2026-11-26: «cambio un passaggio, poi passo a quelli successivi, succede che nel
  // ricalcolo mi cambia quelli precedenti»): verso, divisione, ingressi e uscite di una fascia si sceglievano contando
  // anche i passaggi a mano; uno che aggiungeva filo in vista faceva cambiare strada, e lì non c'era più. Un modulo
  // fisso, due fili: ogni passaggio dentro il modulo, ridisegnato da solo con un pallino in alto a sinistra, deve
  // esserci dopo il ricalcolo, dritto dal suo capo al pallino all'altro capo
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const C = 10, R = 8, Wm = 2 * C + 1;
  const marks = Array.from({ length: R * C }, () => { const x = rnd(); return x < 0.3 ? { stitch: 'v', color: 1 } : x < 0.45 ? { stitch: 'v', color: 2 } : null; });
  const gm = { cols: 4 * C, rows: R, cellW: 2.5, cellH: 3, overlapPct: 30 };
  const mod = (q) => q[0] * Wm + q[1];
  const runsOf = (bands) => {
    const out = [];
    for (const b of bands) {
      const s = [...b.body, ...b.tail];
      for (let i = 0; i < s.length; i++) {
        if (s[i].kind === 'stitch' || s[i].kind === 'jump') continue;
        let j = i; while (j < s.length && s[j].kind !== 'stitch' && s[j].kind !== 'jump') j++;
        const pts = [s[i].from, ...s.slice(i, j).map((q) => q.to)];
        if (pts.every((q) => q[1] >= 0 && q[1] <= 2 * C) && mod(pts[0]) !== mod(pts[pts.length - 1])) out.push(pts.map(mod));
        i = j - 1;
      }
    }
    return out;
  };
  let provati = 0, persi = 0;
  for (const color of [1, 2]) {
    const mp = { cols: C, rows: R, marks, entryRow: {} };
    for (const run of runsOf(rg.csRouteBands(gm, mp, color, route))) {
      const via = [Wm + 1];
      if (run.includes(via[0])) continue;
      const want = [run[0], ...via, run[run.length - 1]];
      const dopo = runsOf(rg.csRouteBands(gm, { ...mp, forced: [{ from: want[0], to: want[2], via }] }, color, route));
      provati++;
      if (!dopo.some((r) => JSON.stringify(r) === JSON.stringify(want) || JSON.stringify(r) === JSON.stringify([...want].reverse()))) persi++;
    }
  }
  check('modulo a fasce: un passaggio ridisegnato a mano resta dopo il ricalcolo (prima la fascia cambiava strada e lo perdeva)',
    [provati > 5, persi], [true, 0]);

  // SOTTO I FILI CHE VENGONO DOPO, nel modulo a fasce (Lorenzo, 2026-11-26: «vorrei che il bianco passasse sotto il
  // rosso e sotto il marrone»): ogni filo si calcolava da solo, senza sapere che sopra di lui verranno altri fili, e
  // andava in vista sopra di loro. Due colonne del filo 1 (colonne 0 e 6), tutto intorno il filo 2, che viene dopo:
  // da una colonna all'altra il filo 1 passa sotto il 2, niente in vista
  {
    const Cc = 12, Rr = 6;
    const mk = Array.from({ length: Cc * Rr }, (_, i) => {
      const r = Math.floor(i / Cc), c = i % Cc;
      if ((c === 0 || c === 6) && r >= 1 && r <= 4) return { stitch: 'v', color: 1 };
      return { stitch: 'v', color: 2 };
    });
    const gs = { cols: 4 * Cc, rows: Rr, cellW: 2.5, cellH: 3, overlapPct: 30 };
    const bands = rg.csRouteBands(gs, { cols: Cc, rows: Rr, marks: mk, entryRow: {} }, 1, route);
    const vis = bands.reduce((t, b) => t + b.metrics.visibleMm, 0), hid = bands.reduce((t, b) => t + b.metrics.hiddenMm, 0);
    check('modulo a fasce: il filo passa sotto i fili che vengono dopo (niente in vista fra le due colonne, prima 33 mm)',
      [Math.round(vis), hid > 10], [0, true]);
  }

  // MAI IN VISTA (Lorenzo, 2026-11-26: «i passaggi a vista non devono esistere»): due pezzi del filo 1 lontani, nel
  // vuoto. Senza la regola il filo ci va in vista (il salto costa di più); con la regola salta. Col filo 2 (dopo) in
  // mezzo, la strada nascosta c'è: niente salto e niente in vista
  {
    const gv = { cols: 14, rows: 4, cellW: 2.5, cellH: 3, overlapPct: 0 };
    const vuoto = new Map(), coperto = new Map();
    for (const c of [0, 1, 12, 13]) { vuoto.set(1 * 14 + c, { stitch: 'v', color: 1 }); coperto.set(1 * 14 + c, { stitch: 'v', color: 1 }); }
    for (let c = 2; c < 12; c++) coperto.set(1 * 14 + c, { stitch: 'v', color: 2 });
    const m = (cells, nv) => { const r = rg.csRouteAll(gv, cells, { ...route, noVisible: nv }).metrics; return [Math.round(r.visibleMm), r.jumps]; };
    const [a1, a2, b1, b2] = [m(vuoto, false), m(vuoto, true), m(coperto, false), m(coperto, true)];
    check('mai in vista: nel vuoto il filo salta invece di andare in vista; sotto un filo che viene dopo passa nascosto, senza salti',
      [a1[0] > 0, a1[1], a2, b2], [true, 0, [0, 1], [0, 0]]);
    // il salto si toglie ridisegnandolo (Lorenzo: «come posso rimuovere un salto? vorrei provare a toglierne alcuni»):
    // un passaggio a mano sui due capi del salto lo fa diventare quel passaggio, dritto da un pallino all'altro
    const conSalto = rg.csRouteAll(gv, vuoto, { ...route, noVisible: true }).colors.find((cr) => cr.color === 1).segs;
    const salto = conSalto.find((sg, n) => n > 0 && sg.kind === 'jump');
    const via = 3 * (2 * 14 + 1) + 14;
    const tolto = salto ? rg.csRouteAll(gv, vuoto, { ...route, noVisible: true, forced: [{ from: salto.from, to: salto.to, via: [via] }] }) : null;
    const segT = tolto ? tolto.colors.find((cr) => cr.color === 1).segs : [];
    check('mai in vista: un salto del tool con un passaggio ridisegnato a mano diventa quel passaggio (niente salto, passa dal pallino)',
      [!!salto, tolto ? tolto.metrics.jumps : null, segT.some((sg) => sg.kind !== 'stitch' && sg.kind !== 'jump' && sg.to === via)], [true, 0, true]);
  }

  // SALTI PIÙ CORTI (Lorenzo, 2026-11-26: «accorciare i salti facendo lavorare i vari blocchi in maniera che le uscite
  // e le entrate dei successivi siano vicine»): su moduli a caso, coi passaggi mai in vista, i salti non sono mai più
  // lunghi né di più, niente in vista in più, e su qualcuno si accorciano
  {
    let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    let peggio = 0, meglio = 0;
    for (let t = 0; t < 6; t++) {
      const Cm = 12, Rm = 8;
      const mk = Array.from({ length: Cm * Rm }, () => { const x = rn(); return x < 0.18 ? { stitch: 'v', color: 1 } : x < 0.3 ? { stitch: 'v', color: 2 } : null; });
      const gs = { cols: 3 * Cm, rows: Rm, cellW: 2.5, cellH: 3, overlapPct: 30 };
      const tot = (sj) => {
        let n = 0, mm = 0, vis = 0;
        for (const color of [1, 2]) for (const b of rg.csRouteBands(gs, { cols: Cm, rows: Rm, marks: mk, entryRow: {} }, color, { ...route, noVisible: true, shortJumps: sj })) { n += b.metrics.jumps; mm += b.metrics.jumpMm; vis += b.metrics.visibleMm; }
        return { n, mm, vis };
      };
      const a0 = tot(false), a1 = tot(true);
      if (a1.n > a0.n || a1.mm > a0.mm + 1e-6 || a1.vis > a0.vis + 1e-6) peggio++;
      if (a1.mm < a0.mm - 1) meglio++;
    }
    check('salti corti: su 6 moduli a caso mai salti più lunghi o di più, e su qualcuno più corti', [peggio, meglio > 0], [0, true]);
  }

  // IL RICAMO A MODULO RIPETUTO, mai in vista (Lorenzo, 2026-11-26: «ora ci sono 100 salti a caso»): mai due salti di
  // fila (le copie tagliate dal bordo ne facevano due), su moduli a caso in un ricamo con l'ultima copia tagliata
  {
    let sd = 11; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    let doppi = 0, salti = 0;
    for (let t = 0; t < 4; t++) {
      const Cm = 10, Rm = 6;
      const mk = Array.from({ length: Cm * Rm }, () => { const x = rn(); return x < 0.2 ? { stitch: 'v', color: 1 } : x < 0.32 ? { stitch: 'v', color: 2 } : null; });
      const gr = { cols: 25, rows: 12, cellW: 2.5, cellH: 3, overlapPct: 30 };
      const cellsR = new Map();
      for (let r = 0; r < gr.rows; r++) for (let c = 0; c < gr.cols; c++) { const m = mk[(r % Rm) * Cm + (c % Cm)]; if (m) cellsR.set(r * gr.cols + c, m); }
      const res = rg.csRouteAll(gr, cellsR, { ...route, noVisible: true, shortJumps: true, modulePath: { cols: Cm, rows: Rm, marks: mk, entryRow: {} } });
      for (const cr of res.colors) cr.segs.forEach((sg, n) => { if (sg.kind === 'jump') { salti++; if (n > 0 && cr.segs[n - 1].kind === 'jump') doppi++; } });
    }
    check('modulo ripetuto, mai in vista: mai due salti di fila (ce ne sono, ma uno alla volta)', [salti > 0, doppi], [true, 0]);
  }

  // I PALLINI LIBERI (Lorenzo, 2026-11-26: «i passaggi sono pinnati e non posso spostarli dove voglio»): un pallino
  // sta dove lo si lascia, non sul vertice più vicino; il filo ci passa esattamente, anche nei punti del DST, e
  // spostato nel modulo (in una copia, a strisce) resta lo stesso punto
  if (rg.csFreePoint) {
    const libero = rg.csFreePoint(g, 7.3, 5.1);
    const conLibero = pathOf(rg.csRouteAll(g, cells, { ...route, forced: [{ from: free.from, to: free.to, via: [libero] }] }));
    const doveSta = conLibero ? rg.csSegmentPoints(g, conLibero.segs[0].from, conLibero.segs[0].to)[1] : null;
    const linee = rg.csColorPolylines(g, rg.csRouteAll(g, cells, { ...route, forced: [{ from: free.from, to: free.to, via: [libero] }] }).colors.find((cr) => cr.color === 1), { maxStitchMm: 7, travelStitchMm: 2.5 });
    const nelDst = linee.some((pl) => pl.some((q) => Math.hypot(q.x - 7.3, q.y - 5.1) < 0.03));
    // nel modulo: lo stesso punto in un'altra copia è il punto spostato di una copia
    const Wb = 2 * 3 * g.cols + 1, spost = (v) => { const i = Math.floor(v / W); return i * Wb + (v - i * W) + 2 * g.cols; };
    const gb = { ...g, cols: 3 * g.cols };
    const qa = rg.csSegmentPoints(g, free.from, libero)[1], qb = rg.csSegmentPoints(gb, spost(free.from), spost(libero))[1];
    check('pallino libero: il filo ci passa dove lo lasci (entro 0,03 mm), anche nei punti del DST, e una copia più in là è lo stesso punto',
      [conLibero ? conLibero.segs.length : 0, !!doveSta && Math.hypot(doveSta.x - 7.3, doveSta.y - 5.1) < 0.03, nelDst, Math.abs(qb.x - qa.x - g.cols * g.cellW) < 1e-6 && Math.abs(qb.y - qa.y) < 1e-6],
      [2, true, true, true]);
  }
}

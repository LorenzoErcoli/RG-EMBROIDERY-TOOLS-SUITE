// LA V A METÀ GRIGLIA del Punto croce (Lorenzo, 2026-11-25: «una funzione di incastro a metà della griglia… per
// rifinire alcuni punti V finali ad angolo», «provalo anche con una V invertita, sopra al centro delle due»; i passaggi
// come per la V intera, sotto le V disegnate).
// Un blocco di prove che smoke.mjs chiama con il suo bundle (`rg`) e il suo `check`.
export function proveMetaGriglia(rg, check) {
  console.log('\nPunto croce — la V e la Λ a metà griglia');
  const g = { cols: 4, rows: 2, cellW: 2.5, cellH: 3, overlapPct: 0 };
  const W = 2 * g.cols + 1;
  const at = (v) => [Math.floor(v / W), v % W];
  // una riga di due V (celle 0 e 1 della riga 1)
  const twoV = () => new Map([[4, { stitch: 'v', color: 0 }], [5, { stitch: 'v', color: 0 }]]);

  // il pennello a metà griglia: sul lato fra le celle 1 e 2 va nella cella libera (la 2), a sinistra; col destro la Λ;
  // sul lato fra 0 e 1, tutte e due occupate, niente; la gomma toglie solo il punto a metà
  const cells = twoV();
  const put = rg.csHalfEdits(g, cells, 1, 2, 0, 'v', 'left', false);
  const leftFree = rg.csHalfEdits(g, new Map([[5, { stitch: 'v', color: 0 }], [6, { stitch: 'v', color: 0 }]]), 1, 1, 0, 'v', 'left', false);
  check('a metà griglia: va nella cella libera accanto (destra: lato sinistro; sinistra: lato destro), col destro la Λ, fra due celle piene niente',
    [put.map((x) => [x.c, x.mark.stitch]), leftFree.map((x) => [x.c, x.mark.stitch]), rg.csHalfEdits(g, cells, 1, 2, 0, 'v', 'right', false)[0]?.mark.stitch, rg.csHalfEdits(g, cells, 1, 1, 0, 'v', 'left', false).length, rg.csHalfEdits(g, cells, 1, 0, 0, 'v', 'left', false).length],
    [[[2, 'vL']], [[0, 'vR']], 'lambdaL', 0, 0]);
  for (const x of put) cells.set(x.r * g.cols + x.c, x.mark);
  check('a metà griglia, la gomma: toglie il punto a metà su quel lato, non le V intere',
    [rg.csHalfEdits(g, cells, 1, 2, 0, 'v', 'left', true).map((x) => [x.c, x.mark]), rg.csHalfEdits(g, cells, 1, 1, 0, 'v', 'left', true).length], [[[2, null]], 0]);

  // le gambe: i bracci al centro delle due celle, la punta sul lato fra le due; fuori dalla griglia niente
  check('a metà griglia, le gambe: V da (1,3) a (2,4) a (1,5); Λ da (1,3) a (0,4) a (1,5); al bordo niente',
    [rg.csStitchLegs(g, 1, 2, 'vL', 'down').flatMap(({ a, b }) => [at(a), at(b)]), rg.csStitchLegs(g, 0, 1, 'lambdaR', 'down').flatMap(({ a, b }) => [at(a), at(b)]), rg.csStitchLegs(g, 0, 0, 'vL', 'down').length, rg.csStitchLegs(g, 0, 3, 'vR', 'down').length],
    [[[1, 3], [2, 4], [2, 4], [1, 5]], [[1, 3], [0, 4], [0, 4], [1, 5]], 0, 0]);

  // IL PERCORSO come per la V intera (Lorenzo, 2026-11-25: l'entrata forzata dal centro della cella accanto spezzava i
  // passaggi, «ripristina la gestione dei passaggi come era all'inizio… i passaggi passano sotto le V disegnate come
  // sempre»): le passate del filo (1 → 2 tratti, 2 → 4, 3 → 6), nessun salto, niente in vista
  const halfStitches = (res, isHalf) => res.colors.flatMap((cr) => cr.segs).filter((sg) => sg.kind === 'stitch' && isHalf(sg)).length;
  const isRightHalf = (sg) => [sg.from, sg.to].some((v) => at(v)[1] === 5 || (at(v)[0] === 2 && at(v)[1] === 4));
  const runs = [1, 2, 3].map((reps) => rg.csRouteCells(g, cells, { ...rg.CS_DEFAULT_ROUTE, repetitions: reps }));
  check('a metà griglia, i passaggi come la V intera: le passate del filo (1 → 2 tratti, 2 → 4, 3 → 6), nessun salto, niente in vista',
    runs.map((res) => [halfStitches(res, isRightHalf), res.metrics.jumps, res.metrics.visibleMm]), [[2, 0, 0], [4, 0, 0], [6, 0, 0]]);
  // e sul bordo sinistro (V nelle celle 1 e 2, la V a metà nella cella 0 sul suo lato destro)
  const leftEdge = new Map([[5, { stitch: 'v', color: 0 }], [6, { stitch: 'v', color: 0 }]]);
  for (const x of leftFree) leftEdge.set(x.r * g.cols + x.c, x.mark);
  const le = rg.csRouteCells(g, leftEdge, { ...rg.CS_DEFAULT_ROUTE, repetitions: 1 });
  check('a metà griglia sul bordo sinistro: cucita, nessun salto, niente in vista',
    [halfStitches(le, (sg) => [sg.from, sg.to].some((v) => at(v)[1] === 1 || (at(v)[0] === 2 && at(v)[1] === 2))), le.metrics.jumps, le.metrics.visibleMm], [2, 0, 0]);

  // la Λ a metà sopra, al centro delle due V: dai piedi nei centri delle due celle sotto alla punta sul lato fra le due
  const withL = twoV();
  const e2 = rg.csHalfEdits(g, withL, 0, 1, 1, 'lambda', 'left', false);
  for (const x of e2) withL.set(x.r * g.cols + x.c, x.mark);
  const lam = rg.csRouteCells(g, withL, { ...rg.CS_DEFAULT_ROUTE, repetitions: 1 }).colors.find((cr) => cr.color === 1).segs;
  check('la Λ a metà sopra due V: nella cella 1 (lato sinistro), dai piedi (1,1) e (1,3) alla punta (0,2), una passata',
    [e2.map((x) => [x.r, x.c, x.mark.stitch]), lam.filter((sg) => sg.kind === 'stitch').flatMap((sg) => [at(sg.from), at(sg.to)]).map(String).sort()],
    [[[0, 1, 'lambdaL']], ['0,2', '0,2', '1,1', '1,3']]);

  // col filo della base: si cuce (sopra la base), non è coperto come la V intera della base
  const onBase = rg.csRouteCells(g, new Map([[6, { stitch: 'vL', color: 0 }]]), { ...rg.CS_DEFAULT_ROUTE, base: { color: 0, stitch: 'v' } });
  check('a metà griglia col filo della base: si cuce sopra la base (8 V di base + i 2 bracci)', onBase.metrics.legs, 18);

  // salvato e riaperto, e il timbro a specchio e sottosopra
  const back = rg.csCellsFromJson(g, rg.csCellsToJson(g, withL));
  const stamp = { rows: 1, cols: 3, marks: [{ stitch: 'vR', color: 0 }, null, { stitch: 'lambdaL', color: 1 }], cellW: 2.5, cellH: 3, overlapPct: 0 };
  check('a metà griglia: si salva e si riapre; il timbro a specchio cambia lato, sottosopra V ↔ Λ',
    [[...back].map(([k, m]) => [k, m.stitch]), rg.csFlipStamp(stamp, 'h').marks.map((m) => m && m.stitch), rg.csFlipStamp(stamp, 'v').marks.map((m) => m && m.stitch)],
    [[[1, 'lambdaL'], [4, 'v'], [5, 'v']], ['lambdaR', null, 'vL'], ['lambdaR', null, 'vL']]);
}

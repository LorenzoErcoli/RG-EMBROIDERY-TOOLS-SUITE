// IL MODULO A FASCIA del Punto croce (Lorenzo, 2026-11-24: «il modulo è un modulo intero per altezza che si replica
// solo in orizzontale… si ricama su una base più grande che viene ricamata intera… il modulo dovrò poterlo usare anche
// in altre parti dove i margini sopra e sotto cambiano»). Un blocco di prove che smoke.mjs chiama con il suo bundle
// (`rg`) e il suo `check`.
export function proveFascia(rg, check) {
  console.log('\nPunto croce — il modulo a fascia (si ripete solo in larghezza)');
  // una fascia 4 × 3 V: colore 1 in alto a sinistra e in basso a destra, colore 2 al centro, il resto base (0)
  const marks = () => Array.from({ length: 12 }, (_, i) => ({ stitch: 'v', color: i === 0 || i === 11 ? 1 : i === 5 ? 2 : 0 }));
  const band = { cols: 4, rows: 3, marks: marks(), repeat: 'x', offset: { dr: 4, dc: 0 } };
  const xy = { cols: 4, rows: 3, marks: marks(), offset: { dr: 4, dc: 0 } };
  const g = { cols: 10, rows: 12, cellW: 2.5, cellH: 3, overlapPct: 0 };
  const tb = rg.csTileModule(g, band), tx = rg.csTileModule(g, xy);
  const rowsOf = (cells) => [...new Set([...cells.keys()].map((k) => Math.floor(k / g.cols)))].sort((a, b) => a - b);
  check('fascia: le V solo nelle righe della fascia (4-6), ripetute in larghezza; il modulo di sempre riempie tutte le righe',
    [rowsOf(tb), tb.get(4 * 10 + 0)?.color, tb.get(4 * 10 + 4)?.color, tb.get(4 * 10 + 8)?.color, tb.get(5 * 10 + 5)?.color, tb.size, rowsOf(tx).length, tx.get(1 * 10 + 0)?.color],
    [[4, 5, 6], 1, 1, 1, 2, 30, 12, 1]);
  check('fascia che esce dal pezzo: restano le righe dentro (dr = -1 → righe 0-1; dr = 11 → riga 11)',
    [rowsOf(rg.csTileModule(g, band, { dr: -1, dc: 0 })), rowsOf(rg.csTileModule(g, band, { dr: 11, dc: 0 }))], [[0, 1], [11]]);
  // modifica su tutte le copie: dentro la fascia si ripete solo in larghezza, fuori non tocca il modulo
  const mb = { ...band, marks: marks() };
  const e1 = rg.csEditsOnAllCopies(g, mb, [{ r: 6, c: 1, mark: { stitch: 'v', color: 3 } }]);
  const e2 = rg.csEditsOnAllCopies(g, mb, [{ r: 1, c: 1, mark: { stitch: 'v', color: 3 } }]);
  check('fascia, su tutte le copie: la V (6,1) cambia in ogni copia della stessa riga e nel modulo; fuori dalla fascia nessuna modifica',
    [e1.map((e) => e.r + ',' + e.c).join(' '), mb.marks[2 * 4 + 1].color, e2.length], ['6,1 6,5 6,9', 3, 0]);
  // un motivo nella colonna 0, righe 0 e 2: per un modulo che si ripete in altezza la giuntura giusta è prima della
  // riga 1 (dr 1); la fascia non gira in altezza e resta dov'è
  const seamMarks = Array.from({ length: 12 }, (_, i) => ({ stitch: 'v', color: i === 0 || i === 8 ? 1 : 0 }));
  check('fascia: le giunture sulla base si spostano solo di lato (il modulo di sempre anche in altezza)',
    [rg.csSeamShift({ cols: 4, rows: 3, marks: seamMarks, repeat: 'x' }, 0).dr, rg.csSeamShift({ cols: 4, rows: 3, marks: seamMarks }, 0).dr], [0, 1]);
  check('fascia: spostare l’inizio o cambiare righe e colonne la lascia fascia', [rg.csShiftModule(band, 0, 1).repeat, rg.csResizeModule(band, 5, 3, null).repeat], ['x', 'x']);

  // i passaggi: la base intera in un solo stop (anche con la base per striscia), il disegno solo nella fascia
  const route = { ...rg.CS_DEFAULT_ROUTE, base: { color: 0, stitch: 'v' }, baseWhole: false, strips: null };
  const mp = { cols: 4, rows: 3, marks: band.marks, entryRow: rg.csEntryRows({ cols: 4, marks: band.marks }), offset: band.offset, repeat: 'x' };
  const res = rg.csRouteAll(g, tb, { ...route, modulePath: mp });
  const W = 2 * g.cols + 1;
  const stitchRows = (cr) => [...new Set(cr.segs.filter((sg) => sg.kind === 'stitch').map((sg) => Math.floor(Math.min(sg.from, sg.to) / W)))].sort((a, b) => a - b);
  const baseStops = res.colors.filter((cr) => cr.color === 0);
  const design = res.colors.filter((cr) => cr.color !== 0);
  check('fascia nel ricamo: la base è uno stop solo su tutte le 12 righe; i fili del disegno cuciono solo nelle righe 4-6',
    [baseStops.length, stitchRows(baseStops[0]).length, [...new Set(design.flatMap(stitchRows))].sort((a, b) => a - b), design.length > 0],
    [1, 12, [4, 5, 6], true]);

  // fino alle tracce da cucire (la strada del DST e dell'SVG), su una forma a trapezio: la base dentro la forma, il
  // disegno solo nelle righe della fascia, ripetuto in larghezza e tagliato dalla forma
  {
    const forma = { contours: [{ points: [{ x: 0, y: 0 }, { x: 25, y: 0 }, { x: 22, y: 36 }, { x: 3, y: 36 }], closed: true, color: '#000000' }], roles: { '#000000': 'outline' } };
    const threads = [{ hex: '#8e9cb6', passes: 1 }, { hex: '#ffffff', passes: 1 }, { hex: '#6a442c', passes: 1 }];
    const mod = { ...band, marks: marks() };
    const s0 = { grid: g, cells: rg.csTileModule(g, mod), threads, route: { ...rg.CS_DEFAULT_ROUTE, base: { color: 0, stitch: 'v' } }, stitch: rg.CS_DEFAULT_STITCH, area: null, cuts: [], forced: [], module: mod, shape: forma };
    const strati = rg.csStratiCross(s0);
    const ys = (l) => l.polylines.flat().map((q) => q.y);
    const pitch = 3, y0 = 4 * pitch, y1 = 6 * pitch + 3;
    const disegno = strati.filter((l) => l.id !== 'filo-1');
    check('tracce della fascia: prima la base (uno stop, alta quanto la forma), poi i fili solo fra 12 e 21 mm',
      [strati[0].id, Math.min(...ys(strati[0])) <= 1, Math.max(...ys(strati[0])) >= 33, disegno.length > 0, disegno.every((l) => ys(l).every((y) => y >= y0 - 0.01 && y <= y1 + 0.01))],
      ['filo-1', true, true, true, true]);
  }

  // la ricerca nell'immagine: una fascia (righe di base sopra e sotto) che si ripete solo in larghezza
  {
    const CP = 6, MC = 8, top = 5, MR = 6, bottom = 7, RX = 6;
    const COL = [[140, 156, 182], [230, 222, 210], [110, 70, 45]];
    // il motivo della fascia, 8 × 6 V: un rombo panna col cuore marrone, a pezzi veri (le V isolate sarebbero un
    // colore finto, e con bordi troppo regolari la ricerca delle colonne prende due V per una)
    const MOT = ['00111100', '01122110', '11222211', '01122110', '00111100', '10011001'];
    const pat = (r, c) => (r < top || r >= top + MR ? 0 : Number(MOT[r - top][c % MC]));
    const Wt = MC * CP * RX, Ht = (top + MR + bottom) * CP;
    const rgba = new Uint8ClampedArray(Wt * Ht * 4);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
      const k = pat(Math.floor(y / CP), Math.floor(x / CP)), i = 4 * (y * Wt + x);
      rgba[i] = COL[k][0]; rgba[i + 1] = COL[k][1]; rgba[i + 2] = COL[k][2]; rgba[i + 3] = 255;
    }
    // le righe le dà la trama del filo, che un'immagine finta non ha: si danno, come fa il tool con la guida agganciata
    const fb = rg.csFindModule({ rgba, width: Wt, height: Ht }, { colors: 3, band: true, rows: top + MR + bottom });
    // il modulo ritrovato può cominciare da un'altra colonna e numerare i fili in un altro ordine (la base è il filo
    // più diffuso nella fascia): si confronta a meno di uno spostamento di lato e di uno scambio di fili
    const sameUpToShift = (f) => Array.from({ length: MC }, (_, dc) => dc).some((dc) => {
      const perm = new Map();
      return MOT.every((row, r) => [...row].every((d, c) => {
        const got = f.map[r * f.cols + ((c - dc + MC) % MC)];
        if (perm.has(d)) return perm.get(d) === got;
        if ([...perm.values()].includes(got)) return false;
        perm.set(d, got); return true;
      }));
    });
    const fx = rg.csFindModule({ rgba, width: Wt, height: Ht }, { colors: 3, rows: top + MR + bottom });
    check('trova la fascia: il periodo solo in larghezza, tolte le righe di base sopra e sotto, la guida sulla prima riga del disegno, il disegno giusto',
      [fb.periodPx.w, fb.cols, fb.rows, fb.trimmed, Math.round(fb.guidePx.y), Math.round(fb.guidePx.h), fb.palette.length, sameUpToShift(fb)],
      [MC * CP, MC, MR, { top, bottom }, top * CP, MR * CP, 3, true]);
    check('senza fascia la ricerca cerca anche in altezza (come prima): nessuna riga tolta', [fx.trimmed, fx.cols], [undefined, MC]);
  }

  // il modulo in un file a sé: va e torna; da un progetto; un file che non è un modulo
  {
    const mod = { ...band, marks: marks(), guide: { x: 1, y: 2, w: 3, h: 4 }, seq: Array(12).fill(0), cuts: [[1, 2]] };
    const threads = [{ hex: '#8e9cb6', passes: 3 }, { hex: '#ffffff', passes: 3 }, { hex: '#6a442c', passes: 5 }, { hex: '#a66b68', passes: 3 }];
    const file = JSON.parse(JSON.stringify(rg.csModuleFile(mod, threads, { color: 0, stitch: 'v' }, { cellW: 2.8, cellH: 4, overlapPct: 30 })));
    const back = rg.csReadModuleFile(file);
    check('salva modulo: fascia, V, fili, base e cella tornano; posizione e guida no (si scelgono nel pezzo)',
      [back.module.repeat, back.module.cols, back.module.rows, back.module.marks[5].color, back.module.cuts, back.threads[2], back.base, back.cell, back.module.offset, back.module.guide, 'offset' in file.module, 'guide' in file.module],
      ['x', 4, 3, 2, [[1, 2]], { hex: '#6a442c', passes: 5 }, { color: 0, stitch: 'v' }, { cellW: 2.8, cellH: 4, overlapPct: 30 }, undefined, null, false, false]);
    const proj = { rgProject: 'cross-stitch', grid: { cols: 40, rows: 50, cellW: 2.4, cellH: 3.5, overlapPct: 20 }, threads, route: { base: { color: 0, stitch: 'cross' } }, module: mod };
    const fromProj = rg.csReadModuleFile(proj);
    check('carica modulo da un progetto (DST o SVG fatti qui): il suo modulo, coi fili, la base e la cella del progetto',
      [fromProj.module.cols, fromProj.base, fromProj.cell, fromProj.module.offset], [4, { color: 0, stitch: 'cross' }, { cellW: 2.4, cellH: 3.5, overlapPct: 20 }, undefined]);
    check('carica modulo: un progetto senza modulo, un file d’altro, un modulo con fili mancanti → niente',
      [rg.csReadModuleFile({ ...proj, module: null }), rg.csReadModuleFile({ rgProject: 'razza', module: mod }), rg.csReadModuleFile({ ...file, threads: threads.slice(0, 2) }), rg.csReadModuleFile(null)],
      [null, null, null, null]);
  }
}

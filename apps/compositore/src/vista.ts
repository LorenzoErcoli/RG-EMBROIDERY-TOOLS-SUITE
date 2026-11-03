// Come si DISEGNA il documento: una funzione sola, per l'anteprima e per l'export SVG (lo stesso motivo per cui il
// decoder del DST è uno solo — R28).
//
// Ogni oggetto è un gruppo con il suo `transform`: spostarlo col mouse cambia un attributo, non ridisegna i suoi
// punti. Su un pannello da 400.000 punti è la differenza fra trascinare e aspettare. Dentro il gruppo, un tracciato
// per filo (non uno per blocco): l'SVG regge poche linee lunghe, non migliaia di corte.
import type { Documento, Oggetto, Composizione } from './documento';
import { ingombro } from './documento';

/** Filo sottile, in anteprima e in export (R15): la larghezza vera del punto è nella geometria. */
const FILO_MM = 0.1;

export interface Riquadro { minX: number; minY: number; larghezza: number; altezza: number }

/** Il riquadro di tutti gli oggetti (anche spenti: si vedono in grigio), con un margine. */
export function riquadroDi(doc: Documento, margine = 5): Riquadro {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of doc.oggetti) {
    const b = ingombro(o);
    if (!b) continue;
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return { minX: -50, minY: -50, larghezza: 100, altezza: 100 };
  return { minX: minX - margine, minY: minY - margine, larghezza: maxX - minX + 2 * margine, altezza: maxY - minY + 2 * margine };
}

const n3 = (v: number): string => v.toFixed(3);

/** Il gruppo di un oggetto: un tracciato per filo, colorato col filo (grigio se spento). */
export function gruppoOggetto(doc: Documento, o: Oggetto): string {
  const perFilo = new Map<number, string[]>();
  for (const b of o.blocchi) {
    if (b.punti.length < 2) continue;
    const f = o.fili[b.ago - 1] ?? o.fili[0] ?? 1;
    let d = perFilo.get(f);
    if (!d) { d = []; perFilo.set(f, d); }
    d.push(b.punti.map(([x, y], i) => `${i ? 'L' : 'M'}${n3(x)} ${n3(y)}`).join(''));
  }
  const path = [...perFilo.entries()].map(([f, d]) => {
    const colore = o.spento ? '#c3c8ce' : (doc.fili.find((x) => x.id === f)?.colore ?? '#000000');
    return `<path d="${d.join('')}" fill="none" stroke="${colore}" stroke-width="${FILO_MM}"/>`;
  }).join('');
  return `<g data-ogg="${o.id}" transform="translate(${n3(o.dx)} ${n3(o.dy)})">${path}</g>`;
}

/**
 * I giunti fra oggetti: il taglio tratteggiato in rosso (come nel simulatore), il salto senza taglio pieno in
 * arancio (è filo che resta), il cambio d'ago in grigio leggero. Lo spessore non segue lo zoom: si devono vedere.
 */
export function gruppoGiunti(c: Composizione): string {
  const linee = c.giunti.filter((g) => g.da_xy).map((g) => {
    const [x0, y0] = g.da_xy!, [x1, y1] = g.a_xy;
    const stile = g.tipo === 'taglio'
      ? 'stroke="#c0392b" stroke-dasharray="4 3"'
      : g.tipo === 'salto' ? 'stroke="#d68910"' : 'stroke="#9aa3ad" stroke-dasharray="1 3"';
    return `<line x1="${n3(x0)}" y1="${n3(y0)}" x2="${n3(x1)}" y2="${n3(y1)}" ${stile} stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  return `<g id="giunti">${linee}</g>`;
}

/** Il rettangolo attorno all'oggetto selezionato. */
export function gruppoSelezione(o: Oggetto | null): string {
  const b = o ? ingombro(o) : null;
  if (!b) return '<g id="selezione"></g>';
  const m = 1;
  return `<g id="selezione"><rect x="${n3(b.minX - m)}" y="${n3(b.minY - m)}" width="${n3(b.maxX - b.minX + 2 * m)}" height="${n3(b.maxY - b.minY + 2 * m)}" fill="none" stroke="#111111" stroke-dasharray="6 4" stroke-width="1" vector-effect="non-scaling-stroke"/></g>`;
}

/** L'SVG completo, in millimetri reali (R1): 1 unità = 1 mm, viewBox sul riquadro. */
export function svgDocumento(r: Riquadro, contenuto: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.larghezza.toFixed(2)}mm" height="${r.altezza.toFixed(2)}mm" viewBox="${r.minX.toFixed(2)} ${r.minY.toFixed(2)} ${r.larghezza.toFixed(2)} ${r.altezza.toFixed(2)}">${contenuto}</svg>`;
}

/** L'anteprima intera: oggetti, giunti, selezione. */
export function svgAnteprima(doc: Documento, c: Composizione, r: Riquadro, selezionato: Oggetto | null): string {
  return svgDocumento(r, `<g id="oggetti">${doc.oggetti.map((o) => gruppoOggetto(doc, o)).join('')}</g>${gruppoGiunti(c)}${gruppoSelezione(selezionato)}`);
}

/** L'SVG da esportare: solo il ricamo acceso, senza giunti né selezione. */
export function svgEsporta(doc: Documento): string {
  const accesi = { ...doc, oggetti: doc.oggetti.filter((o) => !o.spento) };
  return svgDocumento(riquadroDi(accesi, 0), accesi.oggetti.map((o) => gruppoOggetto(doc, o)).join(''));
}

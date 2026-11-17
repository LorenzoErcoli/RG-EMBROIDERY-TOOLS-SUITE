// Le misure del contorno che arriva da un file.
import type { ImportScaleMode } from '@rg/pattern-grammar';

/**
 * Come leggere le misure di un SVG. Stessa regola di Zone pattern e Oblique (R28): se il file dichiara le unità
 * vincono quelle; se viene da Illustrator senza unità è in punti, 72 per pollice. Un file di Illustrator con solo
 * il viewBox, letto come millimetri, veniva 2,83 volte più grande (Lorenzo, 2026-11-17: «sembra non prendere le
 * dimensioni svg giuste»).
 */
export const scalaDelFile = (text: string): ImportScaleMode =>
  /Adobe Illustrator|id="Livello_/i.test(text) && !/<svg\b[^>]*\swidth="[\d.]+\s*(mm|cm|in|pt)"/i.test(text) ? 'illustrator-72dpi' : 'auto';

/** Quanto scalare il disegno perché il contorno sia largo `realeMm`. 0, o niente da misurare: com'è nel file. */
export const fattoreLarghezza = (realeMm: number, nelFileMm: number): number => (realeMm > 0 && nelFileMm > 0 ? realeMm / nelFileMm : 1);

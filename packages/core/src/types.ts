// Tipi di dominio condivisi. Vedi COSTITUZIONE §2 (vocabolario).

/** Coordinata in millimetri reali (R1). */
export interface Point {
  x: number;
  y: number;
}

/** Sequenza ordinata di punti = unità base di ogni geometria. */
export type Polyline = Point[];

/**
 * Ruoli del cartamodello (R12): un colore del file importato = un ruolo.
 * Il contorno esterno di un colore = area di realizzo;
 * una forma più piccola dello stesso colore all'interno = esclusione (void, R5).
 */
export type Role =
  | 'MASTER_OUTLINE' // perimetro esterno / sagoma del pezzo
  | 'NET_AREA'       // area dove generare la rete a 45°
  | 'SATIN_AREA'     // area di riempimento raso di fondo (generata come FORMA)
  | 'SQUARE_AREA'    // area dei quadratini strass (generata come FORMA)
  | 'BORDER'         // bordo perimetrale
  | 'EXCLUSION';     // area vuota (niente ricamo)

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_OUTLINE: 'Perimetro / sagoma',
  NET_AREA: 'Area rete 45°',
  SATIN_AREA: 'Area raso di fondo',
  SQUARE_AREA: 'Quadratini',
  BORDER: 'Bordo',
  EXCLUSION: 'Area vuota',
};

/** Un contorno estratto da un file importato (SVG/DXF), in mm. */
export interface Contour {
  points: Polyline;
  closed: boolean;
  color: string;   // colore normalizzato #rrggbb (o 'none')
  role?: Role;     // assegnato dall'utente via UI
}

/** Un layer di output pronto per l'export. */
export interface ExportLayer {
  id: string;
  color: string;
  polylines: Polyline[];
  strokeMm?: number;
  /** true = solo contorno/forma (rasi come forme), false = punti cuciti */
  shapeOnly?: boolean;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Risultato canonico di un import (R2, R11). L'IO restituisce SEMPRE questo:
 * i contorni già in mm con la migliore stima disponibile, + la dimensione rilevata
 * e il metodo, così il tool può mostrarla e permettere l'override "larghezza reale".
 */
export interface ImportResult {
  contours: Contour[];
  widthMm: number;
  heightMm: number;
  /** 'declared' = dimensione fisica dichiarata nel file (esatta);
   *  'unit' = da unità DXF ($INSUNITS);
   *  'dpi' = stima da viewBox a DPI canonico (provvisoria, da confermare con larghezza reale). */
  method: 'declared' | 'unit' | 'dpi';
  /** Frame della sorgente, per esportare allineati all'input (R27). */
  frame?: SourceFrame;
}

/**
 * Trasformazione unità-file → mm applicata all'import: `mm = (fileCoord - offset) * scale`.
 * Conservarla permette l'export nel frame originale così l'output si sovrappone all'input (R27).
 */
export interface SourceFrame {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  viewBox: string | null;
  widthAttr: string | null;
  heightAttr: string | null;
}

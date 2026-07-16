// Parametri canonici (COSTITUZIONE §3). Nomi con suffisso Mm/Deg.

/**
 * Stroke di visualizzazione del FILO (R15): sempre sottile (~0.1mm), per tutte le app.
 * La larghezza del punto (es. cordoncino) sta nella GEOMETRIA, non nello stroke.
 */
export const THREAD_STROKE_MM = 0.1;
/** Stroke per i contorni/forme di riferimento (leggermente più marcato per distinguerli). */
export const SHAPE_STROKE_MM = 0.15;
export interface NetParams {
  // Griglia / rete
  squareSizeMm: number;   // lato del quadrato = "larghezza rete"
  angleADeg: number;      // prima famiglia (default 45)
  angleBDeg: number;      // seconda famiglia (default -45)
  netInsetMm: number;     // inizio/fine rete: rientro dal perimetro
  netOffsetXMm: number;   // spostamento della griglia rispetto al DXF (X)
  netOffsetYMm: number;   // spostamento della griglia rispetto al DXF (Y)

  // Cordoncino
  cordWidthMm: number;
  cordDensityMm: number;  // passo longitudinale dello zig-zag (densità)

  // Passaggi / travel
  travelStitchMm: number; // lunghezza punto dei passaggi

  // Rasi (per ora come FORME, densità pronta per il futuro)
  satinDensityMm: number;
  squareDensityMm: number;

  // Pulizia / clip
  minStitchMm: number;
  clipStepMm: number;

  // Import: larghezza reale della sagoma in mm (0 = usa la dimensione rilevata). Regola R11.
  realWidthMm: number;
}

export const defaultNetParams: NetParams = {
  squareSizeMm: 11,
  angleADeg: 45,
  angleBDeg: -45,
  netInsetMm: 0,
  netOffsetXMm: 0,
  netOffsetYMm: 0,
  cordWidthMm: 1.8,
  cordDensityMm: 0.4,
  travelStitchMm: 3,
  satinDensityMm: 0.4,
  squareDensityMm: 0.4,
  minStitchMm: 1,
  clipStepMm: 0.9,
  realWidthMm: 0,
};

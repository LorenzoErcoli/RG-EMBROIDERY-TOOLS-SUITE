// L'immagine demo del Punto Pittorico (U4: un esempio pronto in ogni tool): quattro tinte nette su un fondo chiaro — un
// cerchio, un rettangolo, un triangolo — così basta premere Genera per vedere il tool lavorare. È un disegno, non una
// fotografia: non dice niente su come il tool se la cava con una foto vera.

/** Disegna l'immagine demo su un canvas 240 × 160. Ritorna il canvas. */
export function disegnaDemo(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 240; cv.height = 160;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f2e6c9'; g.fillRect(0, 0, 240, 160);
  g.fillStyle = '#b3402a'; g.beginPath(); g.arc(80, 80, 50, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a5f8f'; g.fillRect(130, 30, 80, 100);
  g.fillStyle = '#3f7a3a'; g.beginPath(); g.moveTo(20, 150); g.lineTo(120, 100); g.lineTo(200, 150); g.closePath(); g.fill();
  return cv;
}

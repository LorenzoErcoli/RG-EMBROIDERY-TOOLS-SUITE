import type { Point } from "../grammar/types.ts";

/**
 * Ingombro di una nuvola di punti. A CICLO, mai con lo spread.
 *
 * `Math.min(...xs)` passa un argomento per punto: oltre qualche decina di migliaia il motore
 * JS esaurisce lo stack e lancia "Maximum call stack size exceeded". Non è un limite
 * dichiarato da nessuna parte — è un crash, e arriva senza preavviso quando il disegno cresce.
 * Misurato su questo motore col pattern più fitto di Lorenzo: 200×200mm passava (72.184 punti),
 * 300×300 no. Un formato da 80×40cm era quindi semplicemente irraggiungibile.
 *
 * È il QUARTO punto dello stesso difetto in questo repo — `boundsOf` dell'importer sul file da
 * 2MB, le estensioni dell'header DST su 100k+ punti, `boundsOfPoints` di zone-pattern (scritta
 * a ciclo apposta) — e l'unico rimasto scoperto. Il ciclo non ha tetto: costa O(n) e basta.
 */
export function pointBounds(points: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Uniformly fits geometry inside an exact physical canvas. The returned
 * coordinates, including the requested inset, are guaranteed to stay inside.
 */
export function fitPatternPoints<T extends Point>(
  points: T[],
  width: number,
  height: number,
  inset = 0
): T[] {
  const bounds = pointBounds(points);
  const availableWidth = Math.max(0, width - inset * 2);
  const availableHeight = Math.max(0, height - inset * 2);
  const scale = Math.min(
    bounds.width > 0 ? availableWidth / bounds.width : 1,
    bounds.height > 0 ? availableHeight / bounds.height : 1
  );
  const fittedWidth = bounds.width * scale;
  const fittedHeight = bounds.height * scale;
  const offsetX = inset + (availableWidth - fittedWidth) / 2;
  const offsetY = inset + (availableHeight - fittedHeight) / 2;
  return points.map((point) => ({
    ...point,
    x: (point.x - bounds.minX) * scale + offsetX,
    y: (point.y - bounds.minY) * scale + offsetY
  }));
}

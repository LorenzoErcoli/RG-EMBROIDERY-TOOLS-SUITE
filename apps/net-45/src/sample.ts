import type { Contour } from '@rg/core';

// Sagoma demo: una punta a "V" (chevron), simile alla punta di scarpa, per vedere subito la rete.
export function sampleContours(): Contour[] {
  const master: Contour = {
    points: [
      { x: 15, y: 15 }, { x: 185, y: 15 }, { x: 185, y: 70 },
      { x: 100, y: 150 }, { x: 15, y: 70 }, { x: 15, y: 15 },
    ],
    closed: true,
    color: '#e73433',
  };
  return [master];
}

// Le icone dei tool: un pittogramma per strumento, che disegna la STRUTTURA DEL PUNTO che produce.
//
// Regola del DS (`design-rules.md`): icone geometriche, coerenti, accompagnate da testo. Qui il
// testo è il nome della card, quindi l'SVG è decorativo (`aria-hidden`) e non ripete l'etichetta.
// Tutte sullo stesso telaio: 32×32, margine 4, tratto 1,5 in `currentColor`, niente riempimenti
// — così prendono il colore del testo e restano nere/bianche come il resto della suite.

const svg = (body: string): string =>
  `<svg class="suite-card__icon" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const ICONS: Record<string, string> = {
  // Rete 45°: il reticolo di cordoncini a rombi.
  'net-45':
    '<path d="M4 16 16 4 28 16 16 28Z"/><path d="M10 10 22 22M22 10 10 22"/>',

  // Generatore pattern: la grammatica di zig-zag — due fasce orizzontali e una colonna verticale.
  'pattern-grammar':
    '<path d="M4 8 8 4 12 8 16 4 20 8 24 4 28 8"/><path d="M4 28 8 24 12 28 16 24 20 28 24 24 28 28"/><path d="M16 11 20 14 16 17 20 20"/>',

  // Interlace: passaggi che si incrociano e si intrecciano.
  interlace:
    '<path d="M4 8c8 0 8 16 16 16c5 0 8-4 8-4"/><path d="M4 24c8 0 8-16 16-16c5 0 8 4 8 4"/><path d="M4 16h5M23 16h5"/>',

  // Oblique: diagonali parallele coi fori laser.
  oblique:
    '<path d="M4 20 16 8M10 26 24 12M18 28 28 18"/><circle cx="22" cy="8" r="2"/><circle cx="8" cy="12" r="1.5"/>',

  // Bitmap → Stitch: la griglia dei pixel diventa punti.
  bitmap:
    '<rect x="4" y="4" width="24" height="24"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="24" cy="24" r="1"/>',

  // Punto Striato: striature verticali di lunghezza diversa, fitte a macchia.
  striatura:
    '<path d="M7 9v14M11 6v20M15 10v12M19 5v18M23 11v10M27 14v6"/>',

  // Pattern a zone: una sagoma divisa in due zone, ognuna col suo verso.
  'zone-pattern':
    '<path d="M4 6h24v20H4Z"/><path d="M16 6v20"/><path d="M4 12 10 6M4 18 16 6M4 24 16 12M8 26 16 18"/><path d="M19 9h6M19 14h9M19 19h9M19 24h6"/>',

  // Cannage rafia: l'intreccio di verticali, orizzontali e diagonali del cannage.
  'cannage-rafia':
    '<path d="M11 4v24M21 4v24M4 11h24M4 21h24"/><path d="M4 4l24 24M28 4 4 28"/>',

  // Punto pettine sfrangiato: la linea di base coi denti del pettine.
  pettine:
    '<path d="M4 24h24"/><path d="M6 24V10M10 24V14M14 24V8M18 24V12M22 24V9M26 24V15"/>',

  // Broccato: raso rado orizzontale in due blocchi di colore.
  broccato:
    '<path d="M4 7h11M4 12h11M4 17h11"/><path d="M17 15h11M17 20h11M17 25h11"/>',

  // Sfrangiatura: un raso pieno con le frange a X sui capi.
  sfrangiatura:
    '<path d="M4 6h14M4 10h14M4 14h14"/><path d="M18 18l6 6M24 18l-6 6M10 20l5 5M15 20l-5 5"/>',

  // Punto Pittorico: il ventaglio di punti che segue la curva e sfuma.
  pittorico:
    '<path d="M6 26C6 15 15 6 26 6"/><path d="M11 26c0-8 7-15 15-15"/><path d="M16 26c0-5 5-10 10-10"/><path d="M4 20l4-1M7 13l4 1M13 7l2 3"/>',

  // Cross-Stitch: la griglia con le croci.
  'cross-stitch':
    '<path d="M4 4h24v24H4Z"/><path d="M16 4v24M4 16h24"/><path d="M7 7l6 6M13 7l-6 6M19 19l6 6M25 19l-6 6"/>',
};

/** L'icona del tool, oppure un quadrato neutro se non ne ha ancora una. */
export function toolIcon(id: string): string {
  return svg(ICONS[id] ?? '<rect x="6" y="6" width="20" height="20"/>');
}

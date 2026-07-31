// Registro dei tool della suite RG Tools + chrome condiviso (topbar).
export interface ToolDef {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'soon';
}

export const TOOLS: ToolDef[] = [
  { id: 'net-45', name: 'Rete 45°', description: 'Genera la rete di cordoncini a 45° su una sagoma DXF/SVG.', status: 'live' },
  { id: 'pattern-grammar', name: 'Generatore pattern', description: 'Genera pattern e basi ricamo da grammatica, con sagoma importabile.', status: 'live' },
  { id: 'interlace', name: 'Interlace', description: 'Riempimento a intreccio multicolore: passaggi brevi che si intrecciano, con aree vuote.', status: 'live' },
  { id: 'oblique', name: 'Oblique Pattern', description: 'Pattern obliqui a più livelli (Broderie Anglaise) con fori laser.', status: 'live' },
  { id: 'cross-stitch', name: 'Cross-Stitch', description: 'Griglia a punto croce con routing ottimizzato.', status: 'soon' },
  { id: 'bitmap', name: 'Bitmap → Stitch', description: 'Da immagine raster a tracciato di ricamo: selezione pixel, colori e punti ordinati in SVG.', status: 'live' },
  { id: 'striatura', name: 'Punto Striato', description: 'Striature verticali a spola che formano macchie maculate su base di riempimento parallelo.', status: 'live' },
];

/**
 * Topbar dell'applicazione — componente DS `rg-topbar` variante `--app` (direttiva agente design-system).
 * `backHref` = link "torna alla home suite" (assente nella home, dove si mostra il brand).
 * Il titolo è `<h1>` dentro un tool (lì è il titolo di pagina) e `<span>` nella home (che ha già il suo h1).
 */
export function topbar(title: string, backHref?: string): string {
  const lead = backHref
    ? `<a class="rg-topbar__back" href="${backHref}" aria-label="Torna a RG Tools">← RG Tools</a>`
    : `<span class="rg-topbar__brand">RG Tools</span>`;
  const tag = backHref ? 'h1' : 'span';
  return `<header class="rg-topbar rg-topbar--app">
    ${lead}
    <${tag} class="rg-topbar__title">${title}</${tag}>
    <div class="rg-topbar__actions" id="topbarSlot"></div>
  </header>`;
}

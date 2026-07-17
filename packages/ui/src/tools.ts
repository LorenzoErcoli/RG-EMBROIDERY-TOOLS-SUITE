// Registro dei tool della suite RG Tools + chrome condiviso (topbar).
export interface ToolDef {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'soon';
}

export const TOOLS: ToolDef[] = [
  { id: 'net-45', name: 'Rete 45°', description: 'Genera la rete di cordoncini a 45° su una sagoma DXF/SVG.', status: 'live' },
  { id: 'oblique', name: 'Oblique Pattern', description: 'Pattern obliqui a più livelli con fori laser.', status: 'soon' },
  { id: 'cross-stitch', name: 'Cross-Stitch', description: 'Griglia a punto croce con routing ottimizzato.', status: 'soon' },
  { id: 'bitmap', name: 'Bitmap → Stitch', description: 'Da immagine a tracciato di ricamo.', status: 'soon' },
];

/** Topbar RG condivisa. `backHref` = link "torna alla home suite" (assente nella home). */
export function topbar(title: string, backHref?: string): string {
  const back = backHref
    ? `<a class="rg-topbar__back rg-mono" href="${backHref}" aria-label="Torna a RG Tools">← RG Tools</a>`
    : `<span class="rg-topbar__brand">RG Tools</span>`;
  return `<header class="rg-topbar suite-topbar">
    ${back}
    <span class="suite-topbar__title rg-h3">${title}</span>
    <span class="suite-topbar__slot" id="topbarSlot"></span>
  </header>`;
}

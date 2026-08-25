// Pan/zoom del pattern rg-workspace (JS di riferimento, indipendente da librerie).
// La vista vive SOLO sulle variabili CSS del layer (--rg-pan-x/-y/--rg-zoom): rigenerando il
// contenuto dentro il layer la vista NON si azzera. Aggiornare solo su gesti utente o fit().
export interface PanZoom {
  fit: () => void;
  getZoom: () => number;
}

export function hookPanZoom(canvas: HTMLElement, layer: HTMLElement, onChange?: (zoom: number) => void): PanZoom {
  let panX = 0, panY = 0, zoom = 1;
  let dragging = false, startX = 0, startY = 0;

  const apply = () => {
    layer.style.setProperty('--rg-pan-x', `${panX}px`);
    layer.style.setProperty('--rg-pan-y', `${panY}px`);
    layer.style.setProperty('--rg-zoom', String(zoom));
    onChange?.(zoom);
  };

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; startX = e.clientX - panX; startY = e.clientY - panY;
    canvas.classList.add('is-dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    panX = e.clientX - startX; panY = e.clientY - startY; apply();
  });
  const stop = (e: PointerEvent) => {
    dragging = false; canvas.classList.remove('is-dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const next = Math.min(8, Math.max(0.2, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const ratio = next / zoom;
    panX = cx - (cx - panX) * ratio;
    panY = cy - (cy - panY) * ratio;
    zoom = next; apply();
  }, { passive: false });

  /**
   * "Adatta" = inquadra il CONTENUTO, non "torna a zoom 1". Il layer è `inset: 0` (grande quanto la
   * tela) e centra il disegno in flex: la misura da guardare è quella del figlio — l'SVG generato,
   * che è dimensionato in mm. Si divide per lo zoom corrente per tornare alla taglia naturale, poi
   * si sceglie il fattore che fa entrare tutto con un margine di respiro.
   * Senza contenuto (o con misure a zero, es. tela non ancora visibile) si ricade sul vecchio reset.
   */
  const fit = () => {
    panX = 0; panY = 0;
    const content = layer.firstElementChild as HTMLElement | null;
    const view = canvas.getBoundingClientRect();
    const box = content?.getBoundingClientRect();
    if (content && box && box.width > 0 && box.height > 0 && view.width > 0 && view.height > 0) {
      const naturalW = box.width / zoom, naturalH = box.height / zoom;
      const margin = 0.98; // un filo di aria attorno al disegno
      const wanted = Math.min((view.width * margin) / naturalW, (view.height * margin) / naturalH);
      zoom = Math.min(8, Math.max(0.2, wanted));
    } else {
      zoom = 1;
    }
    apply();
  };
  apply();
  return { fit, getZoom: () => zoom };
}

// Registro dei tool della suite RG Tools + chrome condiviso (topbar).
// I DATI dei tool (nome, descrizione, cosa prendono e cosa danno) stanno in `tools-dati.ts`, senza DOM, così si
// importano anche in node (test, banco, agente). Qui restano la topbar e la riesportazione: chi importava
// `@rg/ui/tools` continua a funzionare.
export * from './tools-dati';

/**
 * Topbar dell'applicazione — componente DS `rg-topbar` variante `--app` (direttiva agente design-system).
 * `backHref` = link "torna alla home suite" (assente nella home, dove si mostra il brand).
 * Il titolo è `<h1>` dentro un tool (lì è il titolo di pagina) e `<span>` nella home (che ha già il suo h1).
 */
import './manual'; // installa la Guida (delega globale sui [data-guide]); il bottone è qui sotto

export function topbar(title: string, backHref?: string): string {
  const lead = backHref
    ? `<a class="rg-topbar__back" href="${backHref}" aria-label="Torna a RG Tools">← RG Tools</a>`
    : `<span class="rg-topbar__brand">RG Tools</span>`;
  const tag = backHref ? 'h1' : 'span';
  // Bottone Guida: apre il manuale della sezione giusta (il tool corrente, o la panoramica in home).
  return `<header class="rg-topbar rg-topbar--app">
    ${lead}
    <${tag} class="rg-topbar__title">${title}</${tag}>
    <div class="rg-topbar__actions" id="topbarSlot">
      <button class="rg-button rg-button--ghost rg-button--small" type="button" data-guide="${title}" aria-label="Apri la guida">Guida</button>
    </div>
  </header>`;
}

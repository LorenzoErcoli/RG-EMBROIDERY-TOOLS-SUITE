import { TOOLS, topbar, type ToolDef } from '@rg/ui/tools';
import { toolIcon } from '@rg/ui/tool-icons';

/**
 * La home della suite ha due pagine (decisione di Lorenzo, 2026-09-16):
 * - `suite` (`#/`) — gli strumenti pronti per il lavoro;
 * - `sviluppo` (`#/sviluppo`) — i progetti non finiti: si aprono e si usano, ma stanno a parte
 *   perché non sono ancora strumenti su cui contare.
 *
 * Le due pagine sono viste sorelle dello stesso catalogo, quindi si passa dall'una all'altra con le
 * `rg-tabs` del DS in forma di link (`aria-current`): lo stato sopravvive al refresh e al link.
 */
export type HomePage = 'suite' | 'sviluppo';

function card(t: ToolDef): string {
  const soon = t.status === 'soon';
  const esterno = !soon && !!t.href;
  // Il badge dice lo stato del tool, e non deve contraddire la pagina: un progetto non finito non è
  // "Disponibile" anche se si apre.
  const badge = soon
    ? '<span class="rg-badge">In arrivo</span>'
    : esterno
      ? '<span class="rg-badge">App esterna</span>'
      : t.section === 'sviluppo'
        ? '<span class="rg-badge">In sviluppo</span>'
        : '<span class="rg-badge rg-badge--validated">Disponibile</span>';
  const inner = `${toolIcon(t.id)}<div class="rg-h3">${t.name}</div><p class="rg-body suite-card__desc">${t.description}</p>${badge}`;
  if (soon) return `<div class="rg-card rg-card--technical suite-card suite-card--soon">${inner}</div>`;
  if (esterno) return `<a class="rg-card rg-card--technical suite-card" href="${t.href}" target="_blank" rel="noopener">${inner}</a>`;
  return `<a class="rg-card rg-card--technical suite-card" href="#/${t.id}">${inner}</a>`;
}

export function renderHome(root: HTMLElement, page: HomePage = 'suite'): void {
  const tools = TOOLS.filter((t) => t.section === page);
  const quanti = (p: HomePage) => TOOLS.filter((t) => t.section === p).length;
  const tab = (p: HomePage, href: string, label: string) =>
    `<a class="rg-tab${page === p ? ' is-active' : ''}" href="${href}"${page === p ? ' aria-current="page"' : ''}>${label} <span class="rg-u-muted">${quanti(p)}</span></a>`;

  const intro = page === 'suite'
    ? 'Scegli lo strumento da usare.'
    : 'Progetti non ancora finiti: si aprono e si provano, ma non sono ancora strumenti su cui contare per il lavoro.';

  root.innerHTML = `
    ${topbar('Suite strumenti ricamo')}
    <main class="suite-home">
      <h1 class="rg-h1">RG Tools</h1>
      <nav class="rg-tabs suite-home__tabs" aria-label="Pagine della suite">
        ${tab('suite', '#/', 'Strumenti')}
        ${tab('sviluppo', '#/sviluppo', 'In sviluppo')}
      </nav>
      <p class="rg-body rg-u-muted suite-home__sub">${intro}</p>
      <div class="rg-grid rg-grid--2 suite-grid">${tools.map(card).join('')}</div>
    </main>`;
}

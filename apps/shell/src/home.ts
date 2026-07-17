import { TOOLS, topbar } from '@rg/ui/tools';

/** Home della suite: griglia di card, una per tool. */
export function renderHome(root: HTMLElement): void {
  const cards = TOOLS.map((t) => {
    const soon = t.status === 'soon';
    const badge = `<span class="rg-badge ${soon ? '' : 'rg-badge--validated'}">${soon ? 'In arrivo' : 'Disponibile'}</span>`;
    const inner = `<div class="rg-h3">${t.name}</div><p class="rg-body suite-card__desc">${t.description}</p>${badge}`;
    return soon
      ? `<div class="rg-card rg-card--technical suite-card suite-card--soon">${inner}</div>`
      : `<a class="rg-card rg-card--technical suite-card" href="#/${t.id}">${inner}</a>`;
  }).join('');

  root.innerHTML = `
    ${topbar('Suite strumenti ricamo')}
    <main class="suite-home">
      <h1 class="rg-h1">RG Tools</h1>
      <p class="rg-body rg-u-muted suite-home__sub">Scegli lo strumento da usare.</p>
      <div class="rg-grid rg-grid--2 suite-grid">${cards}</div>
    </main>`;
}

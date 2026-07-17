import '@rg/ui/rg.css';
import './shell.css';
import { renderHome } from './home';
import { mountNet45 } from '@app/net-45';

const app = document.getElementById('app')!;

function route(): void {
  const hash = location.hash || '#/';
  if (hash === '#/net-45') mountNet45(app, { backHref: '#/' });
  else renderHome(app);
}

window.addEventListener('hashchange', route);
route();

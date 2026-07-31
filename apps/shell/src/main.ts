import '@rg/ui/rg.css';
import './shell.css';
import { renderHome } from './home';
import { mountNet45 } from '@app/net-45';
import { mountPatternGrammar } from '@app/pattern-grammar';
import { mountInterlace } from '@app/interlace';
import { mountBitmap } from '@app/bitmap';
import { mountOblique } from '@app/oblique';
import { mountStriatura } from '@app/striatura';

const app = document.getElementById('app')!;

function route(): void {
  const hash = location.hash || '#/';
  if (hash === '#/net-45') mountNet45(app, { backHref: '#/' });
  else if (hash === '#/pattern-grammar') mountPatternGrammar(app, { backHref: '#/' });
  else if (hash === '#/interlace') mountInterlace(app, { backHref: '#/' });
  else if (hash === '#/bitmap') mountBitmap(app, { backHref: '#/' });
  else if (hash === '#/oblique') mountOblique(app, { backHref: '#/' });
  else if (hash === '#/striatura') mountStriatura(app, { backHref: '#/' });
  else renderHome(app);
}

window.addEventListener('hashchange', route);
route();

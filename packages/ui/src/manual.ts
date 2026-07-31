// Guida in-app: legge MANUALE.md (UNICA fonte, R30-style: niente manuale sdoppiato), lo rende in HTML
// e lo mostra nella finestra rg-modal del DS. Un bottone "Guida" nella topbar (vedi tools.ts) apre
// la sezione del tool corrente; in home apre la panoramica. Delega globale sui `[data-guide]`.
import manualMd from '../../../MANUALE.md?raw';
import './guide.css';

type Section = { key: string; display: string; md: string };

// --- parsing di MANUALE.md in sezioni, chiave = id del tool tra backtick nell'intestazione ## ---
function parseSections(md: string): { intro: string; sections: Section[] } {
  let intro = '';
  const sections: Section[] = [];
  let cur: { display: string; key: string; body: string[] } | null = null;
  const flush = () => { if (cur) sections.push({ key: cur.key, display: cur.display, md: cur.body.join('\n') }); };
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      flush();
      const heading = h2[1].trim();
      const idm = /\(`([\w-]+)`\)/.exec(heading);
      const display = heading.replace(/\s*\(`[\w-]+`\)\s*/, '').trim();
      let key = idm ? idm[1] : '';
      if (!key) key = /concetti comuni/i.test(display) ? 'comuni' : /non torna/i.test(display) ? 'problemi' : display.toLowerCase().replace(/[^\w]+/g, '-');
      cur = { display, key, body: ['## ' + display] }; // heading ripulito dall'id
    } else if (cur) {
      cur.body.push(line);
    } else {
      intro += line + '\n';
    }
  }
  flush();
  return { intro, sections };
}

// --- renderer di un sottoinsieme di markdown → HTML (contenuto FIDATO: lo scriviamo noi) ---
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

function renderMd(md: string): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    if (!line.trim()) { flushPara(); closeList(); continue; }
    if ((m = /^(#{1,4})\s+(.+)$/.exec(line))) { flushPara(); closeList(); const lvl = m[1].length <= 2 ? 3 : 4; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue; }
    if (/^---+$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }
    if ((m = /^\s*[-*]\s+(.+)$/.exec(line))) { flushPara(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = /^\s*\d+\.\s+(.+)$/.exec(line))) { flushPara(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if (list) closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}

const { intro, sections } = parseSections(manualMd);
const byKey = new Map(sections.map((s) => [s.key, s]));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Dal titolo mostrato nella topbar risale al tool (best-effort, robusto per i titoli attuali). */
function resolveKey(title?: string): string | null {
  if (!title) return null;
  const n = norm(title);
  for (const s of sections) {
    if (s.key === 'comuni' || s.key === 'problemi') continue;
    if (norm(s.display).startsWith(n) || n.startsWith(norm(s.key))) return s.key;
  }
  return null;
}

// --- finestra ---
let backdrop: HTMLElement | null = null;
function ensureModal(): HTMLElement {
  if (backdrop) return backdrop;
  backdrop = document.createElement('div');
  backdrop.className = 'rg-modal-backdrop';
  backdrop.innerHTML = `<div class="rg-modal rg-modal--lg" role="dialog" aria-modal="true" aria-labelledby="rg-guide-title">
    <header class="rg-modal__header"><h2 class="rg-modal__title" id="rg-guide-title">Guida</h2><button class="rg-modal__close" type="button" aria-label="Chiudi" data-guide-close>×</button></header>
    <div class="rg-modal__body manual-body" id="rg-guide-body"></div>
    <footer class="rg-modal__footer"><button class="rg-button rg-button--primary" type="button" data-guide-close>Chiudi</button></footer>
  </div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === backdrop || t.closest('[data-guide-close]')) closeGuide();
  });
  return backdrop;
}

/** Apre la guida: sezione del tool (`title`) + concetti comuni + problemi; senza title → panoramica intera. */
export function openGuide(title?: string): void {
  const key = resolveKey(title);
  const b = ensureModal();
  let heading: string, html: string;
  if (key && byKey.has(key)) {
    heading = `Guida — ${byKey.get(key)!.display}`;
    html = [byKey.get(key), byKey.get('comuni'), byKey.get('problemi')].filter(Boolean).map((s) => renderMd(s!.md)).join('\n');
  } else {
    heading = 'Guida — RG Embroidery Tools';
    html = renderMd(intro) + '\n' + sections.map((s) => renderMd(s.md)).join('\n');
  }
  b.querySelector<HTMLElement>('#rg-guide-title')!.textContent = heading;
  const body = b.querySelector<HTMLElement>('#rg-guide-body')!;
  body.innerHTML = html;
  body.scrollTop = 0;
  b.classList.add('is-open');
}

export function closeGuide(): void { backdrop?.classList.remove('is-open'); }

// Delega globale: qualunque `[data-guide]` (il bottone nella topbar) apre la guida; Esc chiude.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-guide]') as HTMLElement | null;
    if (el) { e.preventDefault(); openGuide(el.dataset.guide || undefined); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeGuide(); });
}

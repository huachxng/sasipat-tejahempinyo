// Pagefind UI inside the search <dialog>. Assets load once, on the first open.
export {};
declare global {
  interface Window {
    PagefindUI?: new (opts: Record<string, unknown>) => unknown;
  }
}

const dlg = document.getElementById('search-dialog') as HTMLDialogElement | null;
const host = dlg?.querySelector<HTMLElement>('[data-search-host]') ?? null;
const statusEl = dlg?.querySelector<HTMLElement>('[data-search-status]') ?? null;
let ready: Promise<void> | null = null;

const say = (msg: string) => {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
};

const loadStyles = (href: string) =>
  new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // styling failing should not block search
    document.head.append(link);
  });

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });

function mount(): Promise<void> {
  if (ready) return ready;
  say('Loading search…');
  ready = Promise.all([loadStyles('/pagefind/pagefind-ui.css'), loadScript('/pagefind/pagefind-ui.js')])
    .then(() => {
      if (!window.PagefindUI || !host) throw new Error('Pagefind UI missing');
      new window.PagefindUI({
        element: host,
        bundlePath: '/pagefind/',
        showImages: false,
        showSubResults: true,
        showEmptyFilters: false,
        excerptLength: 24,
        autofocus: true,
        translations: { placeholder: 'Search notes, essays, achievements', zero_results: 'Nothing for “[SEARCH_TERM]”', clear_search: 'Clear', load_more: 'More results', filters_label: 'Filter' },
        processResult: (r: { url: string }) => {
          r.url = r.url.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
          return r;
        },
      });
      say('');
    })
    .catch(() => {
      ready = null;
      say('Search index is generated at build time. Run a build and open the preview to try it.');
    });
  return ready;
}

const focusInput = () => dlg?.querySelector<HTMLInputElement>('input[type="text"], .pagefind-ui__search-input')?.focus();

function open() {
  if (!dlg || dlg.open) return;
  dlg.showModal();
  void mount().then(focusInput);
}

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement | null;
  if (!t || !dlg) return;
  if (t.closest('[data-search-open]')) {
    e.preventDefault();
    open();
  } else if (t.closest('[data-search-close]')) {
    dlg.close();
  } else if (t === dlg) {
    dlg.close();
  }
});

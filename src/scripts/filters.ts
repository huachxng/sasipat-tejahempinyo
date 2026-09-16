// Year tabs + category chips for /achievements. State lives in the query string (?year=2024&cat=athletics) via
// history.replaceState; every <article> stays in the DOM and is toggled with `hidden` inside a view transition.
const motionOff = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

const root = document.querySelector<HTMLElement>('[data-filters]');
const timeline = document.querySelector<HTMLElement>('[data-timeline]');

if (root && timeline) {
  const yearBtns = [...root.querySelectorAll<HTMLButtonElement>('button[data-year]')];
  const catBtns = [...root.querySelectorAll<HTMLButtonElement>('button[data-cat]')];
  const entries = [...timeline.querySelectorAll<HTMLElement>('article.entry')];
  const groups = [...timeline.querySelectorAll<HTMLElement>('[data-year-group]')];
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const empty = timeline.querySelector<HTMLElement>('[data-filter-empty]');
  const earlierBefore = Number(root.dataset.earlierBefore ?? 0);
  const validYears = new Set(yearBtns.map((b) => b.dataset.year));
  const validCats = new Set(catBtns.map((b) => b.dataset.cat));

  const read = () => {
    const p = new URLSearchParams(location.search);
    const y = p.get('year') ?? 'all';
    const c = (p.get('cat') ?? 'all').toLowerCase();
    return { year: validYears.has(y) ? y : 'all', cat: validCats.has(c) ? c : 'all' };
  };
  let state = read();

  const matches = (el: HTMLElement) => {
    const y = Number(el.dataset.year);
    const yOk = state.year === 'all' || (state.year === 'earlier' ? y < earlierBefore : y === Number(state.year));
    const cOk = state.cat === 'all' || el.dataset.cat === state.cat;
    return yOk && cOk;
  };

  const paint = () => {
    let n = 0;
    for (const e of entries) {
      const show = matches(e);
      e.hidden = !show;
      if (show) n++;
    }
    for (const g of groups) g.hidden = ![...g.querySelectorAll<HTMLElement>('article.entry')].some((e) => !e.hidden);
    for (const b of yearBtns) b.setAttribute('aria-pressed', String(b.dataset.year === state.year));
    for (const b of catBtns) b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat));
    if (status) status.textContent = n === entries.length ? `${n} entries` : `${n} of ${entries.length} entries`;
    if (empty) empty.hidden = n > 0;
    root.dataset.filtered = String(state.year !== 'all' || state.cat !== 'all');
  };

  const sync = () => {
    const p = new URLSearchParams();
    if (state.year !== 'all') p.set('year', state.year);
    if (state.cat !== 'all') p.set('cat', state.cat);
    const q = p.toString();
    history.replaceState(history.state, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  };

  const apply = (animate: boolean) => {
    const run = () => {
      paint();
      dispatchEvent(new CustomEvent('ach:filter'));
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (animate && doc.startViewTransition && !motionOff()) {
      document.documentElement.classList.add('is-filtering');
      doc.startViewTransition(run).finished.finally(() => document.documentElement.classList.remove('is-filtering'));
    } else run();
  };

  for (const b of yearBtns)
    b.addEventListener('click', () => {
      state = { ...state, year: b.dataset.year ?? 'all' };
      sync();
      apply(true);
    });
  for (const b of catBtns)
    b.addEventListener('click', () => {
      const cat = b.dataset.cat ?? 'all';
      state = { ...state, cat: cat !== 'all' && state.cat === cat ? 'all' : cat };
      sync();
      apply(true);
    });
  root.querySelectorAll<HTMLButtonElement>('[data-filter-clear]').forEach((b) =>
    b.addEventListener('click', () => {
      state = { year: 'all', cat: 'all' };
      sync();
      apply(true);
    }),
  );
  timeline.querySelectorAll<HTMLButtonElement>('[data-filter-clear]').forEach((b) =>
    b.addEventListener('click', () => {
      state = { year: 'all', cat: 'all' };
      sync();
      apply(true);
      root.querySelector<HTMLButtonElement>('button[data-year="all"]')?.focus();
    }),
  );
  // Category labels inside entries filter in place instead of reloading.
  timeline.querySelectorAll<HTMLAnchorElement>('a[data-cat-link]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const cat = a.dataset.catLink ?? '';
      if (!validCats.has(cat)) return;
      e.preventDefault();
      state = { ...state, cat };
      sync();
      apply(true);
      root.scrollIntoView({ block: 'start', behavior: motionOff() ? 'auto' : 'smooth' });
    }),
  );
  addEventListener('popstate', () => {
    state = read();
    apply(false);
  });

  // Deep links (/achievements?cat=athletics) apply on load, without animation.
  apply(false);
}

export {};

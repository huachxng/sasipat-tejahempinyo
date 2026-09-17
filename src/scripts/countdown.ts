// The countdown numeral (spec §8.2): index of the entry nearest the viewport centre, counting down from N (newest)
// to 01 (oldest), with rolling digits, the year beneath, and the gold rail whose fill follows chapter progress.
// Phones get a fixed badge + 2 px top bar. Re-indexes after every filter change (`ach:filter` event).
const motionOff = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

const timeline = document.querySelector<HTMLElement>('[data-timeline]');
const cd = document.querySelector<HTMLElement>('[data-countdown]');

if (timeline && cd) {
  const digitsEl = cd.querySelector<HTMLElement>('[data-digits]')!;
  const yearEl = cd.querySelector<HTMLElement>('[data-countdown-year]');
  const railFill = cd.querySelector<HTMLElement>('[data-rail-fill]');
  const markers = [...cd.querySelectorAll<HTMLElement>('[data-marker]')];
  const badge = document.querySelector<HTMLElement>('[data-countdown-badge]');
  const badgeNum = badge?.querySelector<HTMLElement>('[data-badge-num]') ?? null;
  const badgeTotal = badge?.querySelector<HTMLElement>('[data-badge-total]') ?? null;
  const bar = document.querySelector<HTMLElement>('[data-countdown-bar]');
  const nowText = document.querySelector<HTMLElement>('[data-now-text]');
  const nowPrefix = cd.dataset.nowPrefix ?? 'Achievements';
  const all = [...timeline.querySelectorAll<HTMLElement>('article.entry')];
  const markerFor = new Map(markers.map((m) => [m.dataset.for ?? '', m]));

  let visible: HTMLElement[] = [];
  let current: HTMLElement | null = null;
  let shown = -1;
  let total = all.length;

  const pad = (n: number) => String(n).padStart(2, '0');

  // --- rolling digits -------------------------------------------------------------
  const slots = () => [...digitsEl.querySelectorAll<HTMLElement>('.digit')];
  const ensureSlots = (count: number) => {
    let s = slots();
    while (s.length < count) {
      const d = document.createElement('span');
      d.className = 'digit';
      d.innerHTML = '<span class="d d-cur">0</span><span class="d d-in"></span>';
      digitsEl.prepend(d);
      s = slots();
    }
    while (s.length > count && s.length > 2) {
      s[0].remove();
      s = slots();
    }
  };
  const timers = new WeakMap<HTMLElement, number>();
  const roll = (slot: HTMLElement, ch: string, dir: 'up' | 'down') => {
    const cur = slot.querySelector<HTMLElement>('.d-cur')!;
    const inc = slot.querySelector<HTMLElement>('.d-in')!;
    const pending = timers.get(slot);
    if (pending) {
      clearTimeout(pending);
      cur.textContent = inc.textContent;
      slot.classList.remove('is-rolling');
      void slot.offsetWidth;
    }
    if (cur.textContent === ch) return;
    if (motionOff()) {
      cur.textContent = ch;
      return;
    }
    inc.textContent = ch;
    slot.dataset.dir = dir;
    void slot.offsetWidth;
    slot.classList.add('is-rolling');
    timers.set(
      slot,
      window.setTimeout(() => {
        cur.textContent = ch;
        slot.classList.remove('is-rolling');
        inc.textContent = '';
        timers.delete(slot);
      }, 300),
    );
  };
  const setNumber = (n: number) => {
    const dir: 'up' | 'down' = shown >= 0 && n > shown ? 'up' : 'down';
    const text = pad(n);
    ensureSlots(Math.max(2, text.length));
    const s = slots();
    for (let i = 0; i < s.length; i++) roll(s[i], text[i] ?? '0', dir);
    shown = n;
    if (badgeNum) badgeNum.textContent = text;
  };

  // --- current entry ------------------------------------------------------------
  const setCurrent = (el: HTMLElement | null) => {
    if (!el || el.hidden) return;
    current = el;
    const n = Number(el.dataset.count || 0);
    if (n) setNumber(n);
    const year = el.dataset.year ?? '';
    if (yearEl && yearEl.textContent !== year) yearEl.textContent = year;
    if (nowText) nowText.textContent = `${nowPrefix} / ${year}`;
    for (const m of markers) m.classList.toggle('is-active', m.dataset.for === el.id);
    for (const m of markers) m.classList.toggle('is-past', Number(m.dataset.count || 0) > n);
  };

  const nearestToCentre = () => {
    const mid = innerHeight / 2;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const e of visible) {
      const r = e.getBoundingClientRect();
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  };

  // --- rail + progress ------------------------------------------------------------
  let ticking = false;
  const progress = () => {
    ticking = false;
    const r = timeline.getBoundingClientRect();
    const mid = innerHeight / 2;
    const p = r.height > 0 ? Math.min(1, Math.max(0, (mid - r.top) / r.height)) : 0;
    if (railFill) railFill.style.transform = `scaleY(${p.toFixed(4)})`;
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const inView = r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4;
    badge?.classList.toggle('is-visible', inView);
    bar?.classList.toggle('is-visible', inView);
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(progress);
  };

  // --- (re)index after filters --------------------------------------------------
  const refresh = () => {
    visible = all.filter((e) => !e.hidden);
    total = visible.length;
    visible.forEach((e, i) => {
      const n = total - i;
      e.dataset.count = String(n);
      const no = e.querySelector<HTMLElement>('[data-entry-no]');
      if (no) no.textContent = `Nº ${pad(n)}`;
      const m = markerFor.get(e.id);
      if (m) {
        m.hidden = false;
        m.dataset.count = String(n);
        m.style.top = `${total > 1 ? (i / (total - 1)) * 100 : 0}%`;
      }
    });
    for (const e of all) if (e.hidden) {
      const m = markerFor.get(e.id);
      if (m) m.hidden = true;
    }
    if (badgeTotal) badgeTotal.textContent = pad(total);
    cd.dataset.total = String(total);
    const next = current && !current.hidden ? current : nearestToCentre();
    if (next) setCurrent(next);
    else if (visible[0]) setCurrent(visible[0]);
    onScroll();
  };

  const io = new IntersectionObserver(
    (entries) => {
      let pick: HTMLElement | null = null;
      for (const en of entries) if (en.isIntersecting) pick = en.target as HTMLElement;
      if (pick) setCurrent(pick);
    },
    { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
  );
  for (const e of all) io.observe(e);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  addEventListener('ach:filter', refresh);
  refresh();
  // Before the timeline is reached the numeral shows N (the newest entry).
  if (visible[0] && timeline.getBoundingClientRect().top > innerHeight / 2) setCurrent(visible[0]);
}

export {};

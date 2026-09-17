// Interactive layer for the BIS chart. The figure is server-rendered by src/lib/bis.ts; this script adds zoom (viewBox
// writes only, paths are never rebuilt), pillar toggles, a pointer/touch cursor with tooltip, a keyboard cursor with a
// live region, signature jumps and URL state (?zoom=dotcom&pillars=v,l). Vanilla TS, budget ≤ 8 KB gz.

/** month, BIS, V, L, S, C */
type Row = [string, number | null, number | null, number | null, number | null, number | null];
type Key = 'bis' | 'v' | 'l' | 's' | 'c';
const KEYS: Key[] = ['bis', 'v', 'l', 's', 'c'];
const LABELS = ['BIS', 'V', 'L', 'S', 'C'];
const PILLARS: Key[] = ['v', 'l', 's', 'c'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (v: number | null) => (v == null ? 'n/a' : (v < 0 && Math.abs(v) >= 0.005 ? '−' : '') + Math.abs(v).toFixed(2));
const ord = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
const longMonth = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const pair = (s: string | undefined): [number, number] => {
  const [a, b] = (s ?? '0 0').split(' ').map(Number);
  return [a, b];
};

function init(fig: HTMLElement, primary: boolean) {
  const rows: Row[] = JSON.parse(fig.querySelector('[data-bis-data]')?.textContent || '[]');
  const N = rows.length;
  if (N < 2) return;
  const W = N - 1;
  const $ = <T extends Element>(sel: string) => fig.querySelector<T>(sel)!;
  const svg = $<SVGSVGElement>('svg');
  const plot = $<HTMLElement>('[data-plot]');
  const frame = $<HTMLElement>('[data-bis-frame]');
  const xAxis = $<HTMLElement>('[data-x-axis]');
  const yAxis = $<HTMLElement>('[data-y-axis]');
  const cursor = $<HTMLElement>('[data-cursor]');
  const tip = $<HTMLElement>('[data-tip]');
  const live = $<HTMLElement>('[data-bis-live]');
  const status = $<HTMLElement>('[data-bis-status]');
  const paths = Object.fromEntries(KEYS.map((k) => [k, fig.querySelector<SVGPathElement>(`path[data-series="${k}"]`)])) as Record<Key, SVGPathElement | null>;
  const zoomBtns = [...fig.querySelectorAll<HTMLButtonElement>('[data-zoom]')];
  const chips = [...fig.querySelectorAll<HTMLButtonElement>('[data-pillar]')];
  const sigs = [...fig.querySelectorAll<HTMLButtonElement>('.bis-sig')];
  const yComp = pair(fig.dataset.yComposite);
  const yAll = pair(fig.dataset.yAll);
  const danger = Number(fig.dataset.danger || 1.5);
  const episodes: Record<string, [number, number]> = JSON.parse(fig.dataset.episodes || '{}');
  const first = rows[0][0];
  const indexOf = (m: string) => ord(m) - ord(first);

  const state = { zoom: 'all', i0: 0, i1: W, pillars: new Set<Key>(), cursor: null as number | null, kb: false };

  // ---- URL state (primary chart only)
  if (primary) {
    const p = new URLSearchParams(location.search);
    const z = p.get('zoom');
    if (z && episodes[z]) state.zoom = z;
    for (const k of (p.get('pillars') || '').split(',')) if (PILLARS.includes(k as Key)) state.pillars.add(k as Key);
  } else {
    for (const c of chips) if (c.getAttribute('aria-pressed') === 'true') state.pillars.add(c.dataset.pillar as Key);
    const z = zoomBtns.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.zoom;
    if (z && episodes[z]) state.zoom = z;
  }
  const syncUrl = () => {
    if (!primary) return;
    const p = new URLSearchParams(location.search);
    state.zoom === 'all' ? p.delete('zoom') : p.set('zoom', state.zoom);
    const on = PILLARS.filter((k) => state.pillars.has(k));
    on.length ? p.set('pillars', on.join(',')) : p.delete('pillars');
    const q = p.toString().replace(/%2C/g, ',');
    history.replaceState(history.state, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  };

  // ---- domain
  const yDom = () => (state.pillars.size ? yAll : yComp);
  const setVB = (v: number[]) => svg.setAttribute('viewBox', v.map((n) => Math.round(n * 1000) / 1000).join(' '));
  let raf = 0;
  const tween = (to: number[]) => {
    cancelAnimationFrame(raf);
    const from = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
    if (from.length !== 4 || from.some((n) => !Number.isFinite(n)) || motionOff()) return setVB(to);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = clamp((t - t0) / 280, 0, 1);
      const e = 1 - (1 - k) ** 3;
      setVB(from.map((f, j) => f + (to[j] - f) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const frac = () => {
    const [y0, yh] = yDom();
    const hi = -y0 / 100;
    const lo = hi - yh / 100;
    const span = Math.max(1, state.i1 - state.i0);
    return { xf: (i: number) => ((i - state.i0) / span) * 100, yf: (v: number) => ((hi - v) / (hi - lo)) * 100, hi, lo };
  };
  const pct = (n: number) => `${Math.round(n * 1000) / 1000}%`;
  const span = (text: string, style: string, cls?: string) => {
    const s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = style;
    if (cls) s.className = cls;
    return s;
  };

  function layout() {
    const { xf, yf, hi, lo } = frac();
    // x ticks: every 5 years for All, yearly (2-yearly on narrow plots) inside an episode
    const step = state.zoom === 'all' ? 5 : plot.clientWidth < 480 ? 2 : 1;
    const y0 = Number(rows[state.i0][0].slice(0, 4));
    const y1 = Number(rows[state.i1][0].slice(0, 4));
    const xs: HTMLElement[] = [];
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      const i = indexOf(`${y}-01`);
      if (i >= state.i0 && i <= state.i1) xs.push(span(String(y), `left:${pct(xf(i))}`));
    }
    xAxis.replaceChildren(...xs);
    // y ticks: every integer; on a narrow plot with the wide pillar domain, every other one, and never within 0.5 of the danger label
    const ys: HTMLElement[] = [];
    const stepY = hi - lo > 8 && plot.clientWidth < 480 ? 2 : 1;
    for (let v = hi; v >= lo; v--) {
      if ((hi - v) % stepY || (stepY > 1 && Math.abs(v - danger) < 0.75)) continue;
      ys.push(span(`${v > 0 ? '+' : ''}${v}`, `top:${pct(yf(v))}`));
    }
    ys.push(span(`+${danger.toFixed(1)}`, `top:${pct(yf(danger))}`, 'bis-y-danger'));
    yAxis.replaceChildren(...ys);
    for (const b of sigs) {
      const i = Number(b.dataset.index);
      const r = rows[i];
      const out = i < state.i0 || i > state.i1;
      b.hidden = out;
      if (out) continue;
      b.style.left = pct(xf(i));
      b.style.top = pct(yf(r?.[1] ?? 0));
    }
    if (state.cursor != null) setCursor(state.cursor);
  }

  function applyDomain() {
    const [y0, yh] = yDom();
    tween([state.i0, y0, state.i1 - state.i0, yh]);
    if (state.cursor != null) state.cursor = clamp(state.cursor, state.i0, state.i1);
    layout();
  }

  // ---- cursor + tooltip
  let liveTimer = 0;
  const sentence = (r: Row) => `${r[0]} · ${LABELS.map((l, j) => `${l} ${fmt(r[(j + 1) as 1])}`).join(' · ')}`;
  function setCursor(i: number | null, announce = false) {
    if (i == null) {
      state.cursor = null;
      cursor.hidden = true;
      tip.hidden = true;
      return;
    }
    i = clamp(i, state.i0, state.i1);
    state.cursor = i;
    const r = rows[i];
    const { xf, yf } = frac();
    const x = xf(i);
    cursor.hidden = false;
    cursor.style.left = pct(x);
    cursor.style.setProperty('--cy', r[1] == null ? '50%' : pct(yf(r[1])));
    cursor.dataset.month = r[0];
    const head = document.createElement('div');
    head.className = 'bis-tip-month';
    head.textContent = longMonth(r[0]);
    const lines = KEYS.map((k, j) => {
      const v = r[(j + 1) as 1];
      const row = document.createElement('div');
      row.className = `bis-tip-row${k === 'bis' ? ' is-bis' : state.pillars.has(k) ? '' : ' is-off'}${v != null && v >= danger ? ' is-hot' : ''}`;
      row.dataset.s = k;
      const sw = document.createElement('i');
      sw.className = 'sw';
      const kk = document.createElement('span');
      kk.className = 'k';
      kk.textContent = LABELS[j];
      const vv = document.createElement('span');
      vv.className = 'v';
      vv.textContent = fmt(v);
      row.append(sw, kk, vv);
      return row;
    });
    tip.replaceChildren(head, ...lines);
    tip.hidden = false;
    tip.style.setProperty('--tx', pct(x));
    tip.classList.toggle('is-flipped', x > 65);
    const text = sentence(r);
    status.textContent = text;
    if (announce) {
      clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => (live.textContent = text), 150);
    }
  }

  // ---- pointer / touch
  const onPointer = (e: PointerEvent) => {
    const b = plot.getBoundingClientRect();
    if (!b.width) return;
    state.kb = false;
    setCursor(Math.round(state.i0 + clamp((e.clientX - b.left) / b.width, 0, 1) * (state.i1 - state.i0)));
  };
  plot.addEventListener('pointermove', onPointer, { passive: true });
  plot.addEventListener('pointerdown', onPointer, { passive: true });
  plot.addEventListener('pointerleave', () => {
    if (!state.kb) setCursor(null);
  });

  // ---- keyboard on the frame
  frame.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    let i = state.cursor;
    const at = i ?? (k === 'ArrowLeft' || k === 'PageUp' || k === 'End' ? state.i1 + 1 : state.i0 - 1);
    if (k === 'ArrowRight') i = at + (e.shiftKey ? 12 : 1);
    else if (k === 'ArrowLeft') i = at - (e.shiftKey ? 12 : 1);
    else if (k === 'PageDown') i = at + 60;
    else if (k === 'PageUp') i = at - 60;
    else if (k === 'Home') i = state.i0;
    else if (k === 'End') i = state.i1;
    else if (k === 'Escape') i = null;
    else return;
    e.preventDefault();
    state.kb = i != null;
    setCursor(i, true);
  });
  frame.addEventListener('blur', () => {
    if (state.kb) {
      state.kb = false;
      setCursor(null);
    }
  });
  for (const b of sigs) {
    b.addEventListener('click', () => {
      state.kb = true;
      setCursor(Number(b.dataset.index), true);
      frame.focus({ preventScroll: true });
    });
  }

  // ---- toggles
  const showPillar = (k: Key, on: boolean) => {
    on ? state.pillars.add(k) : state.pillars.delete(k);
    paths[k]?.toggleAttribute('hidden', !on);
    chips.find((c) => c.dataset.pillar === k)?.setAttribute('aria-pressed', String(on));
  };
  for (const c of chips) {
    c.addEventListener('click', () => {
      showPillar(c.dataset.pillar as Key, c.getAttribute('aria-pressed') !== 'true');
      applyDomain();
      syncUrl();
    });
  }
  const setZoom = (z: string) => {
    state.zoom = episodes[z] ? z : 'all';
    [state.i0, state.i1] = state.zoom === 'all' ? [0, W] : episodes[state.zoom];
    for (const b of zoomBtns) b.setAttribute('aria-pressed', String(b.dataset.zoom === state.zoom));
  };
  for (const b of zoomBtns) {
    b.addEventListener('click', () => {
      setZoom(b.dataset.zoom || 'all');
      applyDomain();
      syncUrl();
    });
  }

  // ---- first paint from state
  for (const k of PILLARS) paths[k]?.toggleAttribute('hidden', !state.pillars.has(k));
  for (const c of chips) c.setAttribute('aria-pressed', String(state.pillars.has(c.dataset.pillar as Key)));
  setZoom(state.zoom);
  const [y0, yh] = yDom();
  setVB([state.i0, y0, state.i1 - state.i0, yh]);
  layout();
  addEventListener('resize', layout, { passive: true });
  addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) layout();
  });
  fig.classList.add('is-live');
}

document.querySelectorAll<HTMLElement>('[data-bis]').forEach((fig, i) => {
  try {
    init(fig, i === 0);
  } catch (e) {
    console.error('bis-chart', e);
  }
});

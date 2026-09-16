// /notes 2D map: shared renderer in mode '2d' (p2, fit to box), kind filters, title highlight, ?focus=<id> / data-focus.
import { bindPointer, createRenderer, type GraphJson, type Kind } from './graph-render.ts';

const root = document.querySelector<HTMLElement>('[data-graph2d]');
if (root) init(root).catch((err) => console.warn('graph 2d: not mounted', err));

async function init(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-g2-canvas]')!;
  const stage = root.querySelector<HTMLElement>('[data-g2-stage]')!;
  const res = await fetch('/graph.json');
  if (!res.ok) throw new Error(`graph.json ${res.status}`);
  const g: GraphJson = await res.json();
  const r = createRenderer(canvas, g, '2d');
  const hubs = new Set(g.hubs);
  for (const n of g.nodes) if (hubs.has(n.i) || n.k === 'tag') r.labels[n.i] = 1;

  let raf = 0;
  const tick = (now: number) => { raf = 0; if (r.draw(now)) raf = requestAnimationFrame(tick); };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const chip = {
    root: stage.querySelector<HTMLElement>('[data-hg-chip]')!,
    kind: stage.querySelector<HTMLElement>('[data-hg-kind]')!,
    title: stage.querySelector<HTMLElement>('[data-hg-title]')!,
    date: stage.querySelector<HTMLElement>('[data-hg-date]')!,
  };
  const ptr = bindPointer(r, canvas, chip, { host: stage, onChange: redraw });

  // filters
  const show: Record<Kind, boolean> = { note: true, post: true, ach: true, tag: true };
  const apply = () => {
    for (const n of g.nodes) r.hidden[n.i] = show[n.k] ? 0 : 1;
    r.tagEdges = show.tag;
    if (ptr.hovered >= 0 && r.hidden[ptr.hovered]) ptr.release();
    redraw();
  };
  root.querySelectorAll<HTMLInputElement>('input[data-kind]').forEach((cb) =>
    cb.addEventListener('change', () => { show[cb.dataset.kind as Kind] = cb.checked; apply(); }),
  );
  // title highlight
  root.querySelector<HTMLInputElement>('[data-g2-search]')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (!q) r.match = null;
    else { r.match = new Uint8Array(g.nodes.length); for (const n of g.nodes) r.match[n.i] = n.t.toLowerCase().includes(q) ? 1 : 0; }
    redraw();
  });

  const ro = new ResizeObserver(() => { r.resize(); ptr.refresh(); r.draw(performance.now()); redraw(); });
  ro.observe(stage);
  r.resize();
  r.draw(performance.now());
  document.fonts?.ready.then(redraw);

  // focus: ?focus=<id> beats data-focus; the /notes page may also set data-focus at runtime
  const applyFocus = (id: string | undefined) => {
    const n = id ? g.nodes.find((x) => x.id === id) : undefined;
    if (n) { ptr.hover(n.i, true); redraw(); }
  };
  applyFocus(new URLSearchParams(location.search).get('focus') || root.dataset.focus);
  new MutationObserver(() => applyFocus(root.dataset.focus)).observe(root, { attributes: true, attributeFilter: ['data-focus'] });
}

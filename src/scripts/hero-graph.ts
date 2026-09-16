// Home hero choreography (spec §7.2–7.5). Gates → fetch → first frame at the poster's camera → crossfade. Any exception
// leaves the SVG poster in place. All motion is time-based: v += (target − v)·(1 − e^(−λ·dt)).
import { CAM0, VB, bindPointer, clamp01, createRenderer, easeOutExpo, type GraphJson, type Pointer, type Renderer } from './graph-render.ts';

const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

{
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const box = hero?.querySelector<HTMLElement>('[data-hg-box]');
  const canvas = hero?.querySelector<HTMLCanvasElement>('.hero-gl');
  const svg = hero?.querySelector<SVGSVGElement>('.hg-svg');
  const list = hero?.querySelector<HTMLElement>('[data-hg-hubs]');
  if (hero && box && canvas && svg && list) init(hero, box, canvas, svg, list);
}

function init(hero: HTMLElement, box: HTMLElement, canvas: HTMLCanvasElement, svg: SVGSVGElement, list: HTMLElement) {
  let live: { r: Renderer; ptr: Pointer; stop: () => void } | null = null;

  // Keyboard / AT: focusing a hub in the hidden list golds the poster node and, when live, applies the canvas hover state.
  const svgNode = (i: string) => svg.querySelector(`[data-i="${i}"]`);
  list.addEventListener('focusin', (e) => {
    const i = (e.target as HTMLElement).dataset.i;
    if (i) { svgNode(i)?.classList.add('is-focus'); live?.ptr.hover(+i); }
  });
  list.addEventListener('focusout', (e) => {
    const i = (e.target as HTMLElement).dataset.i;
    if (i) { svgNode(i)?.classList.remove('is-focus'); live?.ptr.release(); }
  });

  const visible = () => {
    const b = hero.getBoundingClientRect();
    return Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) / Math.max(1, b.height);
  };
  const gate = () => !motionOff() && !(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData && visible() >= 0.25;
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
  const teardown = () => {
    live?.stop();
    live = null;
    hero.classList.remove('is-live');
    hero.style.removeProperty('--hg-p');
    svg.removeAttribute('inert');
    canvas.hidden = true;
  };
  const boot = () => idle(() => {
    if (live || !gate()) return;
    mount().catch((err) => { teardown(); console.warn('hero graph: keeping the poster', err); });
  });
  if (document.readyState === 'complete') boot();
  else addEventListener('load', boot, { once: true });
  addEventListener('motionchange', () => (motionOff() ? teardown() : boot()));
  addEventListener('pagehide', teardown);
  addEventListener('pageshow', (e) => { if (e.persisted) boot(); });

  async function mount() {
    const res = await fetch('/graph.json');
    if (!res.ok) throw new Error(`graph.json ${res.status}`);
    const g: GraphJson = await res.json();
    canvas.hidden = false;
    const r = createRenderer(canvas, g, '3d');
    r.resize();

    const chip = {
      root: box.querySelector<HTMLElement>('[data-hg-chip]')!,
      kind: box.querySelector<HTMLElement>('[data-hg-kind]')!,
      title: box.querySelector<HTMLElement>('[data-hg-title]')!,
      date: box.querySelector<HTMLElement>('[data-hg-date]')!,
    };
    const slow = (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(pointer: coarse)').matches;
    const ac = new AbortController();
    const { signal } = ac;
    let raf = 0, running = false, lastFrame = 0, t0 = 0;
    let lastInput = performance.now();
    let tx = 0, ty = 0, fx = 0, fy = 0, px = 0; // cursor target, damped, parallax px
    let spin = 0, vel = 0, dragging = false; // rad, rad/s
    let inView = true, pageVisible = !document.hidden, p = 0, lastP = -1; // scroll recede
    // idle tour: seeded shuffle of the hubs
    const tour = [...g.hubs];
    for (let i = tour.length - 1, s = 7; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [tour[i], tour[j]] = [tour[j], tour[i]]; }
    let touring = false, tourIdx = 0, tourAt = 0;
    /** scroll recede p = clamp(scrollY / .8·innerHeight); the box fades via --hg-p even when the loop is stopped */
    const recede = () => {
      p = clamp01(scrollY / (0.8 * innerHeight));
      if (p !== lastP) { hero.style.setProperty('--hg-p', p.toFixed(3)); lastP = p; }
    };

    const activity = () => {
      lastInput = performance.now();
      if (touring) { touring = false; if (ptr.hovered >= 0) ptr.hover(-1); }
      wake();
    };
    const ptr = bindPointer(r, canvas, chip, {
      host: box,
      onActivity: activity,
      onDrag: (dx, _dy, dt) => { dragging = true; const d = dx * 0.005; spin += d; vel = Math.max(-2.5, Math.min(2.5, d / dt)); },
      onDragEnd: () => { dragging = false; },
    });

    const frame = (now: number) => {
      raf = 0;
      if (!running) return;
      const capped = slow || now - lastInput > 20000;
      if (capped && now - lastFrame < 31) { raf = requestAnimationFrame(frame); return; }
      const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
      lastFrame = now;
      recede();
      if (p >= 1) { running = false; return; } // receded: the loop stops until the page scrolls back
      const e = easeOutExpo(Math.min(1, (now - t0) / 900));
      const k5 = 1 - Math.exp(-5 * dt), k4 = 1 - Math.exp(-4 * dt);
      fx += (tx - fx) * k5;
      fy += (ty - fy) * k5;
      if (!dragging) { spin += (0.04 + vel) * dt; vel *= Math.exp(-2 * dt); }
      const R = VB.r * Math.max(r.w / VB.w, r.h / VB.h);
      px += (fx * 0.04 * R - px) * k4;
      r.cam.yaw = CAM0.yaw + spin + fx * 0.45;
      r.cam.pitch = CAM0.pitch - fy * 0.3 + 0.25 * p;
      r.cam.scale = (0.97 + 0.03 * e) * (1 - 0.15 * p);
      r.cam.edgeMul = 0.6 + 0.4 * e;
      r.cam.px = px;
      if (!touring && ptr.hovered < 0 && now - lastInput > 4000) { touring = true; tourAt = now - 3200; }
      if (touring) {
        const el = now - tourAt;
        if (el >= 3200) { tourAt = now; ptr.hover(tour[tourIdx++ % tour.length]); }
        else if (el >= 2400 && ptr.hovered >= 0) ptr.hover(-1);
      }
      r.draw(now);
      ptr.refresh();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!live) return;
      recede();
      running = inView && pageVisible && p < 1;
      if (running && !raf) { lastFrame = 0; raf = requestAnimationFrame(frame); }
    };

    // cursor follow on the window; outside the hero the target eases back to 0
    addEventListener('pointermove', (ev) => {
      const b = hero.getBoundingClientRect();
      const inside = ev.clientY >= b.top && ev.clientY <= b.bottom;
      tx = inside ? (ev.clientX / innerWidth) * 2 - 1 : 0;
      ty = inside ? (ev.clientY / innerHeight) * 2 - 1 : 0;
      activity();
    }, { passive: true, signal });
    document.documentElement.addEventListener('mouseleave', () => { tx = ty = 0; }, { signal });
    addEventListener('scroll', wake, { passive: true, signal });
    document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; wake(); }, { signal });
    const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting && en.intersectionRatio >= 0.05; wake(); }, { threshold: [0, 0.05, 0.3] });
    io.observe(hero);
    const ro = new ResizeObserver(() => { r.resize(); if (!running) r.draw(performance.now()); });
    ro.observe(canvas);

    // first frame at the poster's camera, then reveal
    t0 = performance.now();
    r.cam.scale = 0.97;
    r.cam.edgeMul = 0.6;
    r.draw(t0);
    live = { r, ptr, stop: () => { running = false; cancelAnimationFrame(raf); raf = 0; io.disconnect(); ro.disconnect(); ac.abort(); ptr.release(); } };
    hero.classList.add('is-live');
    svg.setAttribute('inert', '');
    wake();
  }
}

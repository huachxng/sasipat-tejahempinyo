// Shared scroll-scene primitive (plan §2). Each `[data-scene]` section is a track whose `.scene-stage` is sticky;
// while the section is armed this writes `--scene-p` (0 → 1 over the pinned distance) on the section and toggles
// `is-done` at p ≥ 0.98. Per-scene visuals are pure CSS from `--scene-p`; the only JS-driven text is the
// Achievements numeral pre-roll. IntersectionObserver + passive scroll + one rAF per frame; no scroll libraries.
// Reduced motion and `html[data-motion=off]` never arm, and a `motionchange` flip un-arms (or re-arms) live.
// Each opener also carries a tiny inline pre-arm script (same conditions) so the first paint is already at p = 0.
const motionOff = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Progress of the sub-segment [a, b] of p, clamped to 0–1. */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const pad = (n: number) => String(n).padStart(2, '0');

interface Hook { frame(p: number): void; disarm(): void }
type HookFactory = (section: HTMLElement) => Hook;

const hooks: Record<string, HookFactory> = {
  // Numeral pre-roll: 00 → N between p = .10 and .75 (the sticky Countdown then shows N at the same x).
  achievements(section) {
    const num = section.querySelector<HTMLElement>('[data-open-num]');
    const total = Number(section.dataset.total || 0);
    let shown = num?.textContent ?? '';
    const write = (text: string) => {
      if (num && shown !== text) {
        num.textContent = text;
        shown = text;
      }
    };
    return {
      frame: (p) => write(pad(Math.round(seg(p, 0.1, 0.75) * total))),
      disarm: () => write(pad(total)),
    };
  },
  research: () => ({ frame() {}, disarm() {} }),
};

function mount(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('.scene-stage');
  if (!stage) return;
  const hook = (hooks[section.dataset.scene ?? ''] ?? hooks.research)(section);
  let armed = false;
  let active = true;
  let ticking = false;
  let last = -1;
  let io: IntersectionObserver | null = null;

  const frame = () => {
    ticking = false;
    if (!armed) return;
    const r = section.getBoundingClientRect();
    const range = Math.max(1, r.height - stage.clientHeight);
    const p = clamp01(-r.top / range);
    if (last >= 0 && Math.abs(p - last) < 0.001) return;
    last = p;
    section.style.setProperty('--scene-p', p.toFixed(3));
    section.classList.toggle('is-done', p >= 0.98);
    hook.frame(p);
  };
  const schedule = () => {
    if (!armed || !active || ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };
  const disarm = () => {
    if (!armed) return;
    armed = false;
    last = -1;
    io?.disconnect();
    io = null;
    section.classList.remove('is-armed', 'is-done');
    section.style.removeProperty('--scene-p');
    hook.disarm();
  };
  const arm = () => {
    if (armed || motionOff() || !('IntersectionObserver' in window)) return;
    try {
      armed = true;
      last = -1;
      section.classList.add('is-armed');
      io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) active = en.isIntersecting;
          if (active) schedule();
        },
        { rootMargin: '0px', threshold: 0 },
      );
      io.observe(section);
      active = true;
      frame(); // reload mid-page: correct p before the first paint after arming
    } catch {
      disarm(); // static frame stays
    }
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', () => {
    last = -1;
    active = true;
    frame();
  });
  const onMotion = () => (motionOff() ? disarm() : arm());
  addEventListener('motionchange', onMotion);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', onMotion);

  if (motionOff()) {
    // A stale pre-arm (e.g. bfcache) must never pin: mirror disarm's DOM effects.
    section.classList.remove('is-armed', 'is-done');
    section.style.removeProperty('--scene-p');
    hook.disarm();
  } else arm();
}

for (const s of document.querySelectorAll<HTMLElement>('[data-scene]')) mount(s);

export {};

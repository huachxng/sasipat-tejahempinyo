// Pixel-mosaic reveal for <Mosaic> (spec §6.5). Waits for ≥ 30 % visibility and img.decode(), overlays a canvas
// (device pixels capped at 1×, no smoothing), draws the image at 1/64, 1/32, 1/16, 1/8, 1/4 then full size at
// 110 ms steps (660 ms), fades the canvas out in 240 ms and removes it. Never runs under reduced motion.
const motionOff = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

const STEPS = [64, 32, 16, 8, 4, 1];
const STEP_MS = 110;
const FADE_MS = 240;

const wraps = [...document.querySelectorAll<HTMLElement>('.mosaic[data-mosaic]')].filter((w) => !w.classList.contains('is-done'));

const finish = (wrap: HTMLElement) => {
  wrap.classList.remove('is-armed', 'is-revealing');
  wrap.classList.add('is-done');
  wrap.querySelector('.mosaic-canvas')?.remove();
};

function reveal(wrap: HTMLElement) {
  const img = wrap.querySelector('img');
  if (!img || motionOff()) return finish(wrap);
  const decoded = img.decode ? img.decode() : Promise.resolve();
  const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('decode timeout')), 5000));
  Promise.race([decoded, timeout])
    .then(() => {
      if (motionOff() || !img.naturalWidth) return finish(wrap);
      const rect = wrap.getBoundingClientRect();
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      const canvas = document.createElement('canvas');
      canvas.className = 'mosaic-canvas';
      canvas.width = W;
      canvas.height = H;
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d');
      const tiny = document.createElement('canvas');
      const tctx = tiny.getContext('2d');
      if (!ctx || !tctx) return finish(wrap);
      const draw = (step: number) => {
        ctx.imageSmoothingEnabled = false;
        if (step === 1) {
          ctx.drawImage(img, 0, 0, W, H);
          return;
        }
        const tw = Math.max(1, Math.ceil(W / step));
        const th = Math.max(1, Math.ceil(H / step));
        tiny.width = tw;
        tiny.height = th;
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(img, 0, 0, tw, th);
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(tiny, 0, 0, tw, th, 0, 0, W, H);
      };
      try {
        draw(STEPS[0]);
      } catch {
        return finish(wrap);
      }
      wrap.append(canvas);
      wrap.classList.add('is-revealing');
      let drawn = 0;
      const t0 = performance.now();
      const tick = (now: number) => {
        const step = Math.min(STEPS.length - 1, Math.floor((now - t0) / STEP_MS));
        while (drawn < step) {
          drawn++;
          try {
            draw(STEPS[drawn]);
          } catch {
            return finish(wrap);
          }
        }
        if (now - t0 < STEPS.length * STEP_MS) return requestAnimationFrame(tick);
        canvas.classList.add('is-fading');
        setTimeout(() => finish(wrap), FADE_MS + 40);
      };
      requestAnimationFrame(tick);
    })
    .catch(() => finish(wrap));
}

if (wraps.length && !motionOff() && 'IntersectionObserver' in window) {
  for (const w of wraps) w.classList.add('is-armed');
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        // ≥ 30 % visible, or a tall image already filling a good part of the viewport
        if (en.intersectionRatio < 0.3 && en.intersectionRect.height < innerHeight * 0.4) continue;
        io.unobserve(en.target);
        reveal(en.target as HTMLElement);
      }
    },
    { threshold: [0, 0.3, 0.6] },
  );
  for (const w of wraps) io.observe(w);
  addEventListener('motionchange', () => {
    if (!motionOff()) return;
    io.disconnect();
    for (const w of wraps) if (!w.classList.contains('is-done')) finish(w);
  });
} else {
  for (const w of wraps) finish(w);
}

export {};

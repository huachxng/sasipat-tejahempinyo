// Footer toggle for motion. The early inline script in Base.astro applies the stored value before paint.
const KEY = 'motion';
const html = document.documentElement;
const btn = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
const render = () => {
  const off = html.dataset.motion === 'off';
  if (btn) { btn.textContent = `Motion: ${off ? 'off' : 'on'}`; btn.setAttribute('aria-pressed', String(off)); }
};
btn?.addEventListener('click', () => {
  const off = html.dataset.motion === 'off';
  if (off) { delete html.dataset.motion; try { localStorage.removeItem(KEY); } catch {} }
  else { html.dataset.motion = 'off'; try { localStorage.setItem(KEY, 'off'); } catch {} }
  render();
  dispatchEvent(new CustomEvent('motionchange'));
});
render();

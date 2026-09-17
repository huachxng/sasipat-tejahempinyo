// STUB — replaced by the hero builder (Feature B). Toggle + storage only; no audio yet.
const KEY = 'sound';
const html = document.documentElement;
const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'off';
const btns = document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]');
const render = () => {
  const on = html.dataset.sound === 'on';
  btns.forEach((b) => { b.textContent = `Sound: ${on ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(on)); b.toggleAttribute('aria-disabled', motionOff()); });
};
btns.forEach((b) => b.addEventListener('click', () => {
  if (motionOff()) return;
  const on = html.dataset.sound === 'on';
  if (on) { delete html.dataset.sound; try { localStorage.removeItem(KEY); } catch {} }
  else { html.dataset.sound = 'on'; try { localStorage.setItem(KEY, 'on'); } catch {} }
  render(); dispatchEvent(new CustomEvent('soundchange'));
}));
addEventListener('motionchange', () => { if (motionOff()) delete html.dataset.sound; render(); });
render();

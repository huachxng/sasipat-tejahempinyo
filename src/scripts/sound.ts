// Opt-in synthesized sound (v0.2 Feature B): the footer "Sound" chip, storage, and a tiny Web Audio synth.
// Stored preference: localStorage['sound'] = 'on' (absent = off). Effective state = stored on AND motion allowed
// (no prefers-reduced-motion, html[data-motion] !== 'off'); html[data-sound="on"] mirrors it (Base.astro sets it pre-paint).
// Nothing is constructed before a gesture: the AudioContext is created in the chip's click, or, for a returning visitor,
// on the first pointerdown/keydown. Callers never import this module; they dispatch on window:
//   dispatchEvent(new CustomEvent('sfx', { detail: 'tap' | 'release' | 'drone:on' | 'drone:off' }))
// Levels: tap −30 dB (2 kHz square, 3 ms), release "thock" peak ≈ −14 dB (120 ms), drone −36 dB (110 Hz beat, breathing).
export type Sfx = 'tap' | 'release' | 'drone:on' | 'drone:off';
export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const effectiveSound = (o: { stored: string | null; motionOff: boolean }) => o.stored === 'on' && !o.motionOff;

const KEY = 'sound';
let ctx: AudioContext | null = null, master: GainNode | null = null, noise: AudioBuffer | null = null;
let drone: { osc: OscillatorNode[]; fade: GainNode } | null = null, droneWanted = false, droneStop = 0, lastTap = 0;
let btns: HTMLButtonElement[] = [];

const on = () => document.documentElement.dataset.sound === 'on';
const mirror = () => { for (const b of btns) b.dataset.audioState = ctx?.state ?? 'none'; };
/** Create the context (only ever called inside a user gesture). */
function ensureCtx(): AudioContext | null {
  if (!ctx && 'AudioContext' in window) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    ctx.onstatechange = mirror;
    mirror();
  }
  return ctx;
}
const env = (c: AudioContext, t: number, peak: number, attack: number, end: number) => {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, end);
  return g;
};
function tap() {
  const c = ctx!, t = c.currentTime;
  if (t - lastTap < 0.04) return;
  lastTap = t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square';
  o.frequency.value = 2000;
  g.gain.setValueAtTime(dbToGain(-30), t);
  g.gain.linearRampToValueAtTime(0, t + 0.003);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.004);
}
function release() {
  const c = ctx!, t = c.currentTime;
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.06), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource(), bp = c.createBiquadFilter();
  src.buffer = noise;
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 1.2;
  src.connect(bp).connect(env(c, t, 0.5, 0.001, t + 0.045)).connect(master!);
  src.start(t);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  o.connect(env(c, t, 0.35, 0.002, t + 0.12)).connect(master!);
  o.start(t);
  o.stop(t + 0.13);
}
function setDrone(want: boolean) {
  const c = ctx;
  if (!c) return;
  const t = c.currentTime, target = dbToGain(-36);
  clearTimeout(droneStop);
  if (want) {
    if (!drone) {
      const g = c.createGain(), fade = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
      g.gain.value = target;
      fade.gain.value = 0;
      lfo.frequency.value = 0.08;
      depth.gain.value = target * 0.25;
      lfo.connect(depth).connect(g.gain);
      const osc = [110, 110.6].map((f) => { const o = c.createOscillator(); o.frequency.value = f; o.connect(g); return o; });
      g.connect(fade).connect(master!);
      osc.push(lfo);
      for (const o of osc) o.start(t);
      drone = { osc, fade };
    }
    drone.fade.gain.cancelScheduledValues(t);
    drone.fade.gain.setValueAtTime(drone.fade.gain.value, t);
    drone.fade.gain.linearRampToValueAtTime(1, t + 2);
  } else if (drone) {
    const d = drone;
    d.fade.gain.cancelScheduledValues(t);
    d.fade.gain.setValueAtTime(d.fade.gain.value, t);
    d.fade.gain.linearRampToValueAtTime(0, t + 0.6);
    droneStop = window.setTimeout(() => { for (const o of d.osc) o.stop(); d.fade.disconnect(); if (drone === d) drone = null; }, 700);
  }
}
/** Direct API (the `sfx` event is the normal route). Silent while sound is off or no gesture has created the context yet. */
export const sfx = {
  tap: () => { if (on() && ctx) tap(); },
  release: () => { if (on() && ctx) release(); },
  drone: (want: boolean) => { droneWanted = want; if (on()) setDrone(want); },
};

if (typeof document !== 'undefined') {
  const html = document.documentElement;
  const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'off';
  btns = [...document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')];
  const store = (v: string | null) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const render = () => {
    const e = on(), mo = motionOff();
    for (const b of btns) {
      b.textContent = `Sound: ${e ? 'on' : 'off'}`;
      b.setAttribute('aria-pressed', String(e));
      if (mo) { b.setAttribute('aria-disabled', 'true'); b.title = 'Turn motion on to enable sound'; }
      else { b.removeAttribute('aria-disabled'); b.removeAttribute('title'); }
    }
  };
  /** Returning visitor: the stored "on" may only make sound after the first interaction on this page. */
  const arm = () => {
    const go = () => {
      removeEventListener('pointerdown', go, true);
      removeEventListener('keydown', go, true);
      if (!on()) return;
      ensureCtx()?.resume();
      if (droneWanted) setDrone(true);
    };
    addEventListener('pointerdown', go, true);
    addEventListener('keydown', go, true);
  };
  const changed = () => dispatchEvent(new CustomEvent('soundchange'));
  for (const b of btns) b.addEventListener('click', () => {
    if (motionOff()) return;
    if (on()) { delete html.dataset.sound; store(null); setDrone(false); ctx?.suspend(); }
    else { html.dataset.sound = 'on'; store('on'); ensureCtx()?.resume(); }
    render();
    changed();
  });
  addEventListener('sfx', (e) => {
    const d = (e as CustomEvent<Sfx>).detail;
    if (d === 'drone:on') droneWanted = true;
    else if (d === 'drone:off') droneWanted = false;
    if (!on() || !ctx) return;
    if (d === 'tap') tap();
    else if (d === 'release') release();
    else setDrone(droneWanted);
  });
  // motion off (footer chip or OS setting) silences and disables the chip; the stored preference survives and returns with motion
  const motion = () => {
    const e = effectiveSound({ stored: stored(), motionOff: motionOff() });
    if (e) { html.dataset.sound = 'on'; if (ctx || navigator.userActivation?.isActive) ensureCtx()?.resume(); else arm(); }
    else { delete html.dataset.sound; setDrone(false); ctx?.suspend(); }
    render();
    changed();
  };
  addEventListener('motionchange', motion);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', motion);
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx?.suspend(); else if (on()) ctx?.resume(); });
  if (on()) arm();
  render();
}

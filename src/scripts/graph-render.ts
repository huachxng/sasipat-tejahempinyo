// Shared Canvas 2D graph renderer: the home hero uses mode '3d' (p3, perspective camera; graph-gl.ts is the WebGL2 upgrade
// and shares the helpers below), /notes uses mode '2d' (p2, fit to box).
// The pure projection helpers at the top have no DOM access: HeroGraphSvg.astro imports them on the server so the inline SVG
// poster and the canvas's first frame are pixel-identical (same camera, same coordinate space, same radii).

export type Kind = 'note' | 'post' | 'ach' | 'tag';
export interface GNode { i: number; id: string; t: string; k: Kind; u: string; c?: string; y?: number; deg: number; p3: [number, number, number]; p2: [number, number] }
export interface GEdge { s: number; t: number; k: 'link' | 'tag'; w: number }
export interface GraphJson { v: 1; built: string; nodes: GNode[]; edges: GEdge[]; hubs: number[]; tags: Record<string, number> }

/** Starting camera shared by poster and canvas. */
export const CAM0 = { yaw: 0.35, pitch: -0.18, d: 2.8 };
/** Poster/canvas coordinate space: a 1600×1000 box (`preserveAspectRatio: slice`), object centre (800, 500), unit radius R. */
export const VB = { w: 1600, h: 1000, r: 370 };
export const KIND_LABEL: Record<Kind, string> = { note: 'Note', post: 'Essay', ach: 'Achievement', tag: 'Tag' };
/** Node radius in box units. The spec's (1.6 + .9·log2(1+deg)) px is scaled by 1/.8 so it lands at those px at a typical 1280 px desktop box. */
export const nodeRadius = (deg: number) => 2 + 1.1 * Math.log2(1 + deg);
/** 0 = tag spoke (touches a hub), 1 = wikilink, 2 = small-clique tag edge. */
export const edgeClass = (e: GEdge, nodes: GNode[]) => (e.k === 'link' ? 1 : nodes[e.s].k === 'tag' || nodes[e.t].k === 'tag' ? 0 : 2);
export const EDGE_ALPHA = [0.4, 0.8, 0.5];
/** Depth fog: nearer nodes (z < 0) opaque, farthest .35. */
export const fog = (z: number) => 1 - 0.65 * Math.min(1, Math.max(0, (z + 1.15) / 2.3));
/** Rotate by Ry(yaw)·Rx(pitch) and apply perspective. Returns [x·s, y·s, z, s] in unit space. */
export function project(p: [number, number, number], yaw: number, pitch: number): [number, number, number, number] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
  const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
  const s = CAM0.d / (CAM0.d + z2);
  return [x1 * s, y2 * s, z2, s];
}
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Quantise an alpha into 8 bins (edge batching). */
const bin = (a: number) => Math.min(7, Math.floor(a * 8));

export interface Cam { yaw: number; pitch: number; scale: number; px: number; edgeMul: number }

/* ---------- helpers shared by the Canvas 2D and WebGL renderers (DOM-free) ---------- */
/** Emphasis tween times (s): hover glow in / out. */
export const EM_IN = 0.2, EM_OUT = 0.15;
/** Advance every node's emphasis towards 1 (the highlighted node) or 0. Returns true while any node is still tweening. */
export function stepEmphasis(em: Float32Array, hl: number, dt: number): boolean {
  let anim = false;
  for (let i = 0; i < em.length; i++) {
    const t = i === hl ? 1 : 0, v = em[i];
    if (v !== t) { em[i] = t ? Math.min(1, v + dt / EM_IN) : Math.max(0, v - dt / EM_OUT); anim = true; }
  }
  return anim;
}
/** Edge alpha: class alpha × mean fog × entrance multiplier, ×(1 − .65·dim) when a node is lit and this edge is not incident, ×.35 when a search query does not match both ends. */
export function edgeAlpha(cls: number, fs: number, ft: number, edgeMul: number, dim: number, inc: boolean, matched: boolean): number {
  let a = EDGE_ALPHA[cls] * (fs + ft) * 0.5 * edgeMul;
  if (dim && !inc) a *= 1 - 0.65 * dim;
  if (!matched) a *= 0.35;
  return a;
}
/** 3D projection of every node into canvas CSS px (`unit` = px per box unit, see `createRenderer.resize`). Fills X/Y (px), Z (unit space), F (fog), R (px, before emphasis). */
export function projectScene(g: GraphJson, cam: Cam, w: number, h: number, unit: number, X: Float32Array, Y: Float32Array, Z: Float32Array, F: Float32Array, R: Float32Array): void {
  const Rpx = VB.r * unit * cam.scale;
  const cx = w / 2 + cam.px, cy = h / 2;
  const nodes = g.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const [x, y, z, s] = project(n.p3, cam.yaw, cam.pitch);
    X[i] = cx + x * Rpx; Y[i] = cy + y * Rpx; Z[i] = z; F[i] = fog(z);
    R[i] = nodeRadius(n.deg) * s * unit * cam.scale;
  }
}
/** `#rrggbb` → [r, g, b] in 0..1 (falls back to gold for anything else). */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#e8b84a';
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
}
export interface Tokens { fg: string; fg2: string; gold: string; gold2: string; goldDim: string; edge: string; mono: string }
/** Design tokens the renderers paint with (read from `:root`; browser only). */
export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const t = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { fg: t('--fg', '#f2f0ea'), fg2: t('--fg-2', '#a8a59d'), gold: t('--gold', '#e8b84a'), gold2: t('--gold-2', '#f6d36b'), goldDim: t('--gold-dim', '#8a6d2b'), edge: t('--edge', '#3a3a40'), mono: t('--font-mono', 'monospace') };
}
/** Open a node: the `sfx` release sound first; when sound is on the navigation waits 80 ms so the thock is not cut by unload. */
export function openNode(url: string): void {
  dispatchEvent(new CustomEvent('sfx', { detail: 'release' }));
  if (document.documentElement.dataset.sound === 'on') setTimeout(() => location.assign(url), 80);
  else location.assign(url);
}
export interface Renderer {
  g: GraphJson;
  cam: Cam;
  /** highlighted node (hover / tour / focus) or -1 */
  hl: number;
  /** 2d: hidden nodes (filters); search matches (null = no query); labelled nodes; draw tag edges */
  hidden: Uint8Array;
  match: Uint8Array | null;
  labels: Uint8Array;
  tagEdges: boolean;
  w: number;
  h: number;
  resize(): void;
  /** Draw a frame; returns true while a tween is still running. */
  draw(now: number): boolean;
  /** Nearest visible node within r px of (x, y) in canvas CSS px, or -1. */
  pick(x: number, y: number, r: number): number;
  /** Last projected position of node i in canvas CSS px. */
  pos(i: number): [number, number];
}

/** Sprite atlas (64 px cells): 0 off-white disc, 1 warm-grey disc, 2 gold disc, 3 gold-2 disc, 4 gold-dim ring, 5 gold ring, 6 additive glow. */
function makeAtlas(colors: string[], glow: string): HTMLCanvasElement {
  const S = 64, c = document.createElement('canvas');
  c.width = S * 7;
  c.height = S;
  const x = c.getContext('2d')!;
  colors.forEach((col, i) => {
    const cx = i * S + S / 2, cy = S / 2;
    if (i >= 4) {
      x.strokeStyle = col;
      x.lineWidth = 6;
      x.beginPath();
      x.arc(cx, cy, 25, 0, 7);
      x.stroke();
      return;
    }
    const grd = x.createRadialGradient(cx - 7, cy - 8, 2, cx, cy, 31);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.25, col);
    grd.addColorStop(0.9, col);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd;
    x.fillRect(i * S, 0, S, S);
  });
  const gx = 6 * S + S / 2;
  const grd = x.createRadialGradient(gx, S / 2, 0, gx, S / 2, S / 2);
  grd.addColorStop(0, glow);
  grd.addColorStop(0.35, glow.replace('rgb(', 'rgba(').replace(')', ',.35)'));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grd;
  x.fillRect(6 * S, 0, S, S);
  return c;
}

export function createRenderer(canvas: HTMLCanvasElement, g: GraphJson, mode: '3d' | '2d'): Renderer {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const { fg, fg2, gold, gold2, goldDim, edge: edgeCol, mono } = readTokens();
  const atlas = makeAtlas([fg, fg2, gold, gold2, goldDim, gold], `rgb(${hexToRgb01(gold).map((v) => Math.round(v * 255)).join(',')})`);
  const S = 64;
  const N = g.nodes.length, E = g.edges.length;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), F = new Float32Array(N), R = new Float32Array(N);
  const em = new Float32Array(N); // per-node emphasis 0..1
  const ecls = new Uint8Array(E), ekey = new Int16Array(E);
  const base = new Uint8Array(N); // sprite index at rest
  const nb: number[][] = Array.from({ length: N }, () => []);
  const order: number[] = [];
  for (let i = 0; i < N; i++) {
    const k = g.nodes[i].k;
    base[i] = k === 'tag' ? 4 : k === 'ach' ? 1 : 0;
    order.push(i);
  }
  g.edges.forEach((e, j) => {
    ecls[j] = edgeClass(e, g.nodes);
    nb[e.s].push(e.t);
    nb[e.t].push(e.s);
  });
  // 2d fit box
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const n of g.nodes) {
    minx = Math.min(minx, n.p2[0]); maxx = Math.max(maxx, n.p2[0]);
    miny = Math.min(miny, n.p2[1]); maxy = Math.max(maxy, n.p2[1]);
  }
  let prev = -1, last = 0, unit = 1;
  const r: Renderer = {
    g,
    cam: { yaw: CAM0.yaw, pitch: CAM0.pitch, scale: 1, px: 0, edgeMul: 1 },
    hl: -1,
    hidden: new Uint8Array(N),
    match: null,
    labels: new Uint8Array(N),
    tagEdges: true,
    w: 0,
    h: 0,
    resize() {
      r.w = canvas.clientWidth;
      r.h = canvas.clientHeight;
      canvas.width = Math.round(r.w * dpr);
      canvas.height = Math.round(r.h * dpr);
      unit = mode === '3d' ? Math.max(r.w / VB.w, r.h / VB.h) : Math.min((r.w - 48) / (maxx - minx || 1), (r.h - 48) / (maxy - miny || 1));
    },
    draw(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const { cam } = r;
      const nodes = g.nodes;
      const hl = r.hl;
      if (hl >= 0) prev = hl;
      const anim = stepEmphasis(em, hl, dt);
      const act = hl >= 0 ? hl : prev; // node whose neighbourhood is (still) lit
      const dim = act >= 0 ? em[act] : 0;
      // project
      if (mode === '3d') projectScene(g, cam, r.w, r.h, unit, X, Y, Z, F, R);
      else {
        const cx = r.w / 2 + cam.px, cy = r.h / 2;
        for (let i = 0; i < N; i++) {
          const n = nodes[i];
          X[i] = cx + (n.p2[0] - (minx + maxx) / 2) * unit; Y[i] = cy + (n.p2[1] - (miny + maxy) / 2) * unit; Z[i] = 0; F[i] = 1;
          R[i] = nodeRadius(n.deg) * 1.1;
        }
      }
      for (let i = 0; i < N; i++) R[i] *= 1 + 0.6 * em[i];
      if (mode === '3d') order.sort((a, b) => Z[b] - Z[a]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.w, r.h);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      // edges: batched by class × quantised alpha (≤ 24 strokes) + one gold batch for incident edges
      const m = r.match, hid = r.hidden;
      for (let j = 0; j < E; j++) {
        const e = g.edges[j];
        if (hid[e.s] || hid[e.t] || (!r.tagEdges && e.k === 'tag')) { ekey[j] = -1; continue; }
        const inc = act >= 0 && (e.s === act || e.t === act);
        const a = edgeAlpha(ecls[j], F[e.s], F[e.t], cam.edgeMul, dim, inc, !m || !!(m[e.s] && m[e.t]));
        ekey[j] = inc && dim ? 24 : ecls[j] * 8 + bin(Math.min(1, a));
      }
      ctx.strokeStyle = edgeCol;
      for (let k = 0; k < 24; k++) {
        ctx.globalAlpha = ((k % 8) + 0.5) / 8;
        let any = false;
        ctx.beginPath();
        for (let j = 0; j < E; j++) if (ekey[j] === k) { const e = g.edges[j]; ctx.moveTo(X[e.s], Y[e.s]); ctx.lineTo(X[e.t], Y[e.t]); any = true; }
        if (any) ctx.stroke();
      }
      if (act >= 0 && dim) {
        ctx.strokeStyle = gold;
        ctx.globalAlpha = dim;
        ctx.beginPath();
        for (let j = 0; j < E; j++) if (ekey[j] === 24) { const e = g.edges[j]; ctx.moveTo(X[e.s], Y[e.s]); ctx.lineTo(X[e.t], Y[e.t]); }
        ctx.stroke();
      }
      // nodes, back to front
      const near = act >= 0 ? nb[act] : null;
      for (const i of order) {
        if (hid[i]) continue;
        const rad = R[i];
        let a = F[i];
        const isHl = i === act && em[i] > 0, isNb = !!near && near.includes(i);
        if (dim && !isHl && !isNb) a *= 1 - 0.55 * dim;
        if (m && !m[i]) a *= 0.3;
        const x = X[i] - rad, y = Y[i] - rad, d = rad * 2;
        if (isHl) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = em[i] * 0.9;
          ctx.drawImage(atlas, 6 * S, 0, S, S, X[i] - rad * 3, Y[i] - rad * 3, d * 3, d * 3);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = a;
        ctx.drawImage(atlas, base[i] * S, 0, S, S, x, y, d, d);
        const over = isHl ? em[i] : isNb ? 0.8 * dim : m && m[i] ? 1 : 0;
        if (over > 0) {
          ctx.globalAlpha = a * over;
          ctx.drawImage(atlas, (base[i] === 4 ? 5 : isNb && !isHl ? 3 : 2) * S, 0, S, S, x, y, d, d);
        }
      }
      // 2d labels: hovered/matched first (always drawn), then hubs, skipping any that would overlap a placed label
      if (mode === '2d') {
        ctx.font = `500 11px ${mono}`;
        ctx.textBaseline = 'middle';
        const placed: number[][] = [];
        const lit = (i: number) => i === hl || !!(m && m[i]);
        const cand = order.filter((i) => !hid[i] && (lit(i) || r.labels[i])).sort((a, b) => +lit(b) - +lit(a) || nodes[b].deg - nodes[a].deg);
        for (const i of cand) {
          const t = nodes[i].t, txt = t.length > 34 ? t.slice(0, 33) + '…' : t;
          const x = X[i] + R[i] + 5, w = ctx.measureText(txt).width + 4, y0 = Y[i] - 9, y1 = Y[i] + 9;
          if (!lit(i) && placed.some(([a, b, c, d]) => x < c && x + w > a && y0 < d && y1 > b)) continue;
          placed.push([x, y0, x + w, y1]);
          ctx.globalAlpha = lit(i) ? 1 : dim || m ? 0.35 : 0.8;
          ctx.fillStyle = lit(i) ? gold : fg2;
          ctx.fillText(txt, x, Y[i]);
        }
      }
      ctx.globalAlpha = 1;
      return anim;
    },
    pick(x, y, rad) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < N; i++) {
        if (r.hidden[i]) continue;
        const d = Math.hypot(X[i] - x, Y[i] - y) - R[i] + Z[i] * 2; // slight bias towards nearer nodes
        if (d < rad && d < bd) { bd = d; best = i; }
      }
      return best;
    },
    pos: (i) => [X[i], Y[i]],
  };
  return r;
}

/* ---------- shared pointer / chip behaviour (hero + 2D) ---------- */
export interface Chip { root: HTMLElement; kind: HTMLElement; title: HTMLElement; date: HTMLElement }
export interface PointerOpts {
  /** offset parent of the chip (position: relative/absolute) */
  host: HTMLElement;
  /** any pointer input (the hero cancels its idle tour) */
  onActivity?: () => void;
  onDrag?: (dx: number, dy: number, dt: number) => void;
  onDragEnd?: () => void;
  onChange?: () => void;
}
export interface Pointer {
  hover(i: number, tap?: boolean): void;
  release(): void;
  /** re-place the chip after the node moved under it */
  refresh(): void;
  readonly hovered: number;
}

export function bindPointer(r: Renderer, canvas: HTMLCanvasElement, chip: Chip, o: PointerOpts): Pointer {
  const nowEl = document.querySelector<HTMLElement>('[data-now-text]');
  let hovered = -1, selected = -1, tap = false;
  let down: { x: number; y: number; t: number; drag: boolean; lx: number; ly: number; lt: number } | null = null;
  const place = (i: number) => {
    const [x, y] = r.pos(i);
    const cb = canvas.getBoundingClientRect(), hb = o.host.getBoundingClientRect();
    const ox = cb.left - hb.left, oy = cb.top - hb.top;
    const st = chip.root.style;
    st.top = `${oy + y - 14}px`;
    st.transform = 'translateY(-100%)';
    if (x > cb.width - 220) { st.left = 'auto'; st.right = `${hb.width - ox - x + 14}px`; }
    else { st.right = 'auto'; st.left = `${ox + x + 14}px`; }
  };
  const api: Pointer = {
    get hovered() { return hovered; },
    hover(i, isTap = false) {
      hovered = i;
      tap = isTap;
      r.hl = i;
      canvas.classList.toggle('is-pointer', i >= 0);
      if (i < 0) {
        chip.root.hidden = true;
        if (nowEl) nowEl.textContent = nowEl.dataset.nowDefault ?? '';
        o.onChange?.();
        return;
      }
      const n = r.g.nodes[i];
      chip.kind.textContent = `${KIND_LABEL[n.k]} · ${n.deg} ${n.deg === 1 ? 'link' : 'links'}`;
      chip.title.textContent = n.t;
      chip.date.textContent = n.y ? String(n.y) : '';
      chip.date.hidden = !n.y;
      chip.root.classList.toggle('is-tap', isTap);
      chip.root.hidden = false;
      place(i);
      if (nowEl) nowEl.textContent = `${KIND_LABEL[n.k]} · ${n.t}`;
      o.onChange?.();
    },
    release() { selected = -1; api.hover(-1); },
    refresh() { if (hovered >= 0) place(hovered); },
  };
  const local = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
  canvas.addEventListener('pointermove', (e) => {
    o.onActivity?.();
    const [x, y] = local(e);
    if (down) {
      if (!down.drag && Math.hypot(x - down.x, y - down.y) > 6) { down.drag = true; api.hover(-1); }
      if (down.drag) { const t = performance.now(); o.onDrag?.(x - down.lx, y - down.ly, Math.max(1, t - down.lt) / 1000); down.lx = x; down.ly = y; down.lt = t; }
      return;
    }
    if (e.pointerType === 'touch') return;
    const i = r.pick(x, y, 14);
    if (i !== hovered) api.hover(i);
    else if (i >= 0) place(i);
  });
  canvas.addEventListener('pointerdown', (e) => {
    o.onActivity?.();
    const [x, y] = local(e);
    const t = performance.now();
    down = { x, y, t, drag: false, lx: x, ly: y, lt: t };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const d = down;
    down = null;
    if (d.drag) { o.onDragEnd?.(); return; }
    if (performance.now() - d.t > 400) return;
    const [x, y] = local(e);
    if (e.pointerType === 'touch') {
      const i = r.pick(x, y, 24);
      if (i >= 0 && i === selected) openNode(r.g.nodes[i].u);
      else if (i >= 0) { selected = i; api.hover(i, true); }
      else api.release();
    } else if (hovered >= 0) openNode(r.g.nodes[hovered].u);
  });
  canvas.addEventListener('pointercancel', () => { if (down?.drag) o.onDragEnd?.(); down = null; });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !tap) api.hover(-1); });
  return api;
}

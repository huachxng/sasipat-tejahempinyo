// Hand-written WebGL2 renderer for the home hero (mode '3d' only). A lazy chunk: hero-graph.ts imports it after the idle
// gate when WebGL2 exists and falls back to the Canvas 2D renderer when this returns null or the context is lost.
// Positions are projected on the CPU with the same helpers the Canvas renderer and the SVG poster use, so the crossfade is
// pixel-identical; the GPU only shades: lit sphere impostors (diffuse, rim, specular, gold mix), GL_LINES edges with
// per-end fog alpha drawn as 1 CSS px instanced quads (GL line width is 1 device px, which would thin the poster's
// non-scaling 1 px strokes at DPR 2), and an additive glow for the highlighted node and its neighbours. The top section is DOM-free and
// exported for unit tests; everything that touches a context lives in createGLRenderer.
import { CAM0, VB, EDGE_ALPHA, edgeAlpha, edgeClass, hexToRgb01, projectScene, readTokens, stepEmphasis, type GraphJson, type Renderer } from './graph-render.ts';

/** Floats per sphere instance: x y z rad alpha base(3) hi(3) mix glow kind. */
export const INSTANCE_STRIDE = 14;
/** Context attributes: software GL (SwiftShader, blocklisted drivers) returns null → Canvas 2D; low-power keeps dual-GPU laptops on the integrated GPU. */
export const GL_ATTRS: WebGLContextAttributes = { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true };
/** Glow quad size as a multiple of the node radius. */
export const GLOW_SCALE = 3.2;

const HEAD = '#version 300 es\nprecision highp float;\n';
const CLIP = 'vec2 clip(vec2 px){vec2 c=px/u_res*2.0-1.0;return vec2(c.x,-c.y);}\n';
// One vertex shader serves spheres (u_scale 1) and glow (u_scale GLOW_SCALE); glow culls instances with no glow strength.
export const VS_SPHERE = HEAD + `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec2 a_pos;
layout(location=2) in float a_z;
layout(location=3) in float a_rad;
layout(location=4) in float a_alpha;
layout(location=5) in vec3 a_base;
layout(location=6) in vec3 a_hi;
layout(location=7) in float a_mix;
layout(location=8) in float a_glow;
layout(location=9) in float a_kind;
uniform vec2 u_res;
uniform float u_scale;
out vec2 v_p;
out float v_alpha;
out vec3 v_base;
out vec3 v_hi;
out float v_mix;
out float v_glow;
out float v_kind;
out float v_rad;
${CLIP}
void main(){
  v_p=a_corner;v_alpha=a_alpha;v_base=a_base;v_hi=a_hi;v_mix=a_mix;v_glow=a_glow;v_kind=a_kind;v_rad=a_rad;
  if(u_scale>1.0&&a_glow<=0.0){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
  gl_Position=vec4(clip(a_pos+a_corner*a_rad*u_scale),clamp(a_z/1.6,-1.0,1.0),1.0);
}`;
export const FS_SPHERE = HEAD + `
in vec2 v_p;
in float v_alpha;
in vec3 v_base;
in vec3 v_hi;
in float v_mix;
in float v_glow;
in float v_kind;
in float v_rad;
uniform vec3 u_gold;
uniform vec3 u_goldDim;
uniform float u_depth;
out vec4 o;
void main(){
  float r2=dot(v_p,v_p);
  if(r2>1.0)discard;
  float rr=sqrt(r2);
  float fw=fwidth(rr)*1.5;
  float aa=1.0-smoothstep(1.0-fw,1.0,rr);
  vec3 col;
  if(v_kind>0.5){
    float hw=max(0.095,0.6/v_rad);
    aa*=smoothstep(0.78-hw-fw,0.78-hw,rr)*(1.0-smoothstep(0.78+hw-fw,0.78+hw,rr));
    col=mix(u_goldDim,u_gold,v_mix);
    gl_FragDepth=gl_FragCoord.z;
  }else{
    float nz=sqrt(1.0-r2);
    vec3 n=vec3(v_p,nz);
    vec3 L=normalize(vec3(-0.45,-0.55,0.7));
    float diff=max(dot(n,L),0.0);
    float spec=pow(max(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0),28.0);
    float rim=pow(1.0-nz,2.5);
    vec3 base=mix(v_base,v_hi,v_mix);
    col=base*(0.42+0.62*diff)+rim*0.35*mix(vec3(1.0),u_gold,v_mix)+spec*(0.22+0.35*v_mix)+u_gold*v_mix*0.45;
    gl_FragDepth=gl_FragCoord.z-nz*v_rad*u_depth;
  }
  float a=v_alpha*aa;
  o=vec4(col*a,a);
}`;
export const VS_GLOW = VS_SPHERE;
export const FS_GLOW = HEAD + `
in vec2 v_p;
in float v_alpha;
in vec3 v_base;
in vec3 v_hi;
in float v_mix;
in float v_glow;
in float v_kind;
in float v_rad;
uniform vec3 u_gold;
uniform vec3 u_gold2;
out vec4 o;
void main(){
  float r2=dot(v_p,v_p);
  float core=exp(-4.5*r2),halo=0.25*exp(-1.2*r2);
  float g=(core+halo)*v_glow;
  vec3 col=(u_gold*core+u_gold2*halo)/max(core+halo,1e-4);
  o=vec4(col*g,g*0.6);
}`;
// Edges: one quad per edge, 1 CSS px core + 1 px AA skirt, ends extended half a pixel (caps). Alpha interpolates from
// the source end's fog to the target end's, which reproduces the Canvas midpoint average.
export const VS_EDGE = HEAD + `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_seg;
layout(location=2) in vec2 a_alpha;
layout(location=3) in float a_gold;
uniform vec2 u_res;
out float v_alpha;
out float v_gold;
out float v_d;
${CLIP}
void main(){
  vec2 d=a_seg.zw-a_seg.xy;
  vec2 t=d/max(length(d),1e-3);
  vec2 n=vec2(-t.y,t.x);
  float u=a_corner.x*0.5+0.5;
  v_alpha=mix(a_alpha.x,a_alpha.y,u);v_gold=a_gold;v_d=a_corner.y;
  gl_Position=vec4(clip(mix(a_seg.xy,a_seg.zw,u)+t*a_corner.x*0.5+n*a_corner.y),0.0,1.0);
}`;
export const FS_EDGE = HEAD + `
in float v_alpha;
in float v_gold;
in float v_d;
uniform vec3 u_edge;
uniform vec3 u_gold;
out vec4 o;
void main(){float a=v_alpha*clamp(1.0-abs(v_d),0.0,1.0);o=vec4(mix(u_edge,u_gold,v_gold)*a,a);}`;

/** Write one sphere instance (INSTANCE_STRIDE floats) at `off`. */
export function packInstance(out: Float32Array, off: number, x: number, y: number, z: number, r: number, alpha: number, rgb: readonly number[], hiRgb: readonly number[], mix: number, glow: number, kind: number): void {
  out[off] = x; out[off + 1] = y; out[off + 2] = z; out[off + 3] = r; out[off + 4] = alpha;
  out[off + 5] = rgb[0]; out[off + 6] = rgb[1]; out[off + 7] = rgb[2];
  out[off + 8] = hiRgb[0]; out[off + 9] = hiRgb[1]; out[off + 10] = hiRgb[2];
  out[off + 11] = mix; out[off + 12] = glow; out[off + 13] = kind;
}
/** Per-edge class and the rest-state alpha at both vertices (what the poster draws). */
export function buildEdgeStatic(g: GraphJson): { alpha: Float32Array; cls: Uint8Array } {
  const E = g.edges.length, alpha = new Float32Array(2 * E), cls = new Uint8Array(E);
  g.edges.forEach((e, j) => { cls[j] = edgeClass(e, g.nodes); alpha[2 * j] = alpha[2 * j + 1] = EDGE_ALPHA[cls[j]]; });
  return { alpha, cls };
}

/* ---------- context-bound part ---------- */
interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
const EDGE_STRIDE = 7; // per edge instance: x1 y1 x2 y2 alpha1 alpha2 gold

export function createGLRenderer(canvas: HTMLCanvasElement, g: GraphJson, opts: { onLost(): void }): Renderer | null {
  const gl = canvas.getContext('webgl2', GL_ATTRS);
  if (!gl) return null;
  const tk = readTokens();
  const C = { fg: hexToRgb01(tk.fg), fg2: hexToRgb01(tk.fg2), gold: hexToRgb01(tk.gold), gold2: hexToRgb01(tk.gold2), goldDim: hexToRgb01(tk.goldDim), edge: hexToRgb01(tk.edge) };
  const N = g.nodes.length, E = g.edges.length;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), F = new Float32Array(N), R = new Float32Array(N);
  const em = new Float32Array(N), nbm = new Uint8Array(N);
  const inst = new Float32Array(N * INSTANCE_STRIDE), edges = new Float32Array(E * EDGE_STRIDE);
  const { cls: ecls } = buildEdgeStatic(g);
  const nb: number[][] = Array.from({ length: N }, () => []);
  g.edges.forEach((e) => { nb[e.s].push(e.t); nb[e.t].push(e.s); });
  const order = g.nodes.map((n) => n.i);
  let prev = -1, last = 0, unit = 1, lost = false, timer = 0;
  let sphere: Prog, glow: Prog, edge: Prog, vaoQ: WebGLVertexArrayObject, vaoE: WebGLVertexArrayObject, bufI: WebGLBuffer, bufE: WebGLBuffer;

  const compile = (vs: string, fs: string, names: string[]): Prog | null => {
    const mk = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) { console.warn('hero gl:', gl.getProgramInfoLog(p)); return null; }
    const u: Prog['u'] = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  };
  const attr = (loc: number, size: number, stride: number, off: number, div: number) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off * 4);
    gl.vertexAttribDivisor(loc, div);
  };
  /** Programs, buffers and vertex arrays; rerun after a context restore. */
  const setup = (): boolean => {
    const s = compile(VS_SPHERE, FS_SPHERE, ['u_res', 'u_scale', 'u_gold', 'u_goldDim', 'u_depth']);
    const gp = compile(VS_GLOW, FS_GLOW, ['u_res', 'u_scale', 'u_gold', 'u_gold2']);
    const ep = compile(VS_EDGE, FS_EDGE, ['u_res', 'u_edge', 'u_gold']);
    if (!s || !gp || !ep) return false;
    sphere = s; glow = gp; edge = ep;
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    vaoQ = gl.createVertexArray()!;
    gl.bindVertexArray(vaoQ);
    attr(0, 2, 2, 0, 0);
    bufI = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufI);
    gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    const S = INSTANCE_STRIDE;
    attr(1, 2, S, 0, 1); attr(2, 1, S, 2, 1); attr(3, 1, S, 3, 1); attr(4, 1, S, 4, 1);
    attr(5, 3, S, 5, 1); attr(6, 3, S, 8, 1); attr(7, 1, S, 11, 1); attr(8, 1, S, 12, 1); attr(9, 1, S, 13, 1);
    vaoE = gl.createVertexArray()!;
    gl.bindVertexArray(vaoE);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    attr(0, 2, 2, 0, 0);
    bufE = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufE);
    gl.bufferData(gl.ARRAY_BUFFER, edges.byteLength, gl.DYNAMIC_DRAW);
    attr(1, 4, EDGE_STRIDE, 0, 1); attr(2, 2, EDGE_STRIDE, 4, 1); attr(3, 1, EDGE_STRIDE, 6, 1);
    gl.bindVertexArray(null);
    for (const p of [sphere, glow, edge]) { gl.useProgram(p.p); gl.uniform3fv(p.u.u_gold, C.gold); }
    gl.useProgram(sphere.p); gl.uniform3fv(sphere.u.u_goldDim, C.goldDim); gl.uniform1f(sphere.u.u_scale, 1);
    gl.useProgram(glow.p); gl.uniform3fv(glow.u.u_gold2, C.gold2); gl.uniform1f(glow.u.u_scale, GLOW_SCALE);
    gl.useProgram(edge.p); gl.uniform3fv(edge.u.u_edge, C.edge);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    if (r.w) r.resize();
    return true;
  };
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    timer = window.setTimeout(() => { timer = 0; opts.onLost(); }, 1500);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(timer);
    timer = 0;
    if (setup()) lost = false;
    else opts.onLost();
  });

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
      unit = Math.max(r.w / VB.w, r.h / VB.h);
      if (lost) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      for (const p of [sphere, glow, edge]) { gl.useProgram(p.p); gl.uniform2f(p.u.u_res, r.w, r.h); }
    },
    draw(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const { cam } = r, nodes = g.nodes, hl = r.hl, m = r.match, hid = r.hidden;
      if (hl >= 0) prev = hl;
      const anim = stepEmphasis(em, hl, dt);
      if (lost) return anim;
      const act = hl >= 0 ? hl : prev;
      const dim = act >= 0 ? em[act] : 0;
      projectScene(g, cam, r.w, r.h, unit, X, Y, Z, F, R);
      for (let i = 0; i < N; i++) R[i] *= 1 + 0.6 * em[i];
      order.sort((a, b) => Z[b] - Z[a]);
      nbm.fill(0);
      if (act >= 0) for (const j of nb[act]) nbm[j] = 1;
      // edges: one instance per edge; each end carries its own fog alpha; incident edges blend towards solid gold with dim
      for (let j = 0, o = 0; j < E; j++, o += EDGE_STRIDE) {
        const e = g.edges[j];
        const show = !(hid[e.s] || hid[e.t] || (!r.tagEdges && e.k === 'tag'));
        const inc = act >= 0 && (e.s === act || e.t === act);
        const matched = !m || !!(m[e.s] && m[e.t]);
        const gold = inc ? dim : 0;
        let as = show ? edgeAlpha(ecls[j], F[e.s], F[e.s], cam.edgeMul, dim, inc, matched) : 0;
        let at = show ? edgeAlpha(ecls[j], F[e.t], F[e.t], cam.edgeMul, dim, inc, matched) : 0;
        if (gold) { as += (1 - as) * gold; at += (1 - at) * gold; }
        edges[o] = X[e.s]; edges[o + 1] = Y[e.s]; edges[o + 2] = X[e.t]; edges[o + 3] = Y[e.t];
        edges[o + 4] = as; edges[o + 5] = at; edges[o + 6] = gold;
      }
      // spheres, back to front
      let n = 0;
      for (const i of order) {
        if (hid[i]) continue;
        const k = nodes[i].k;
        const isHl = i === act && em[i] > 0, isNb = nbm[i] === 1;
        let a = F[i];
        if (dim && !isHl && !isNb) a *= 1 - 0.55 * dim;
        if (m && !m[i]) a *= 0.3;
        const over = isHl ? em[i] : isNb ? 0.8 * dim : m && m[i] ? 1 : 0;
        const gw = isHl ? em[i] * 0.9 : isNb ? 0.22 * dim : 0;
        packInstance(inst, n * INSTANCE_STRIDE, X[i], Y[i], Z[i], R[i], a, k === 'tag' ? C.goldDim : k === 'ach' ? C.fg2 : C.fg, isNb && !isHl ? C.gold2 : C.gold, over, gw, k === 'tag' ? 1 : 0);
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bufE);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, edges);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufI);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, n * INSTANCE_STRIDE);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(edge.p);
      gl.bindVertexArray(vaoE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, E);
      gl.bindVertexArray(vaoQ);
      if (dim > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(glow.p);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(sphere.p);
      gl.uniform1f(sphere.u.u_depth, 1 / (GLOW_SCALE * VB.r * unit * cam.scale));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.bindVertexArray(null);
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
  if (!setup()) return null;
  return r;
}

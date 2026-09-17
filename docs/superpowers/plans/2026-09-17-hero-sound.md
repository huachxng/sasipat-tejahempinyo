I have everything needed. Before the plan, the facts I verified that shape it (beyond the ones supplied):

- Current chunk inventory (gz): photoswipe 16.9 KB, graph-render 3.5 KB, hero-graph 2.0 KB, lightbox 1.8 KB, graph-2d 0.9 KB. `dist/index.html` references only the HeroGraph script via `<script src>`; there are no `import()` chunks today except photoswipe (loaded from lightbox.ts on first click, the established lazy pattern).
- `createRenderer` already duplicates nothing with the poster because the projection loop, emphasis tween and edge-alpha logic live inside the closure; a GL renderer would need the same three pieces, so they should be lifted into the DOM-free top section of graph-render.ts (the file is already imported server-side by HeroGraphSvg.astro, so its top level must stay DOM-free, which also makes it vitest-friendly under `environment: 'node'`).
- CI (`.github/workflows/quality.yml`) runs vitest, `astro check`, `npm run build` (check-dist), `npx size-limit`, Playwright on chromium + webkit, then Lighthouse.
- The Motion chip sets `aria-pressed="true"` when motion is off (pressed = non-default state). The Sound chip should follow the same rule (pressed = on).
- `.chip[aria-pressed='true']` is styled gold in base.css; the mobile menu is a native `<dialog id="site-menu">` in Nav.astro with no settings row yet.
- One important browser gotcha for Feature A: a `<canvas>` that has had a `webgl2` context can never return a `2d` context afterwards, so every GL→Canvas-2D fallback must replace the canvas element.

---

# Feature A: "real 3D" hero

## Route evaluation and recommendation

| | Route 1: hand-written WebGL2 | Route 2: three.js with budget exception |
|---|---|---|
| Added JS (gz) | ~5–7 KB lazy chunk (budget 15 KB) | 120–150 KB lazy chunk + ~3 KB adapter |
| Budget rules | Unchanged; size-limit total goes from 24.5 to ~31 KB | Needs an allow-list in check-dist and a negative glob in .size-limit.json; the 60 KB "sum" guard becomes a fiction for the home page |
| Dependency policy | None added (CLAUDE.md: exact pins, no upgrades before 2026-11-01; BUILD-BRIEF: no Three on the client) | Adds a ~1 MB package during the freeze; the spec explicitly lists it as post-Nov-1 backlog |
| Fidelity to poster | Positions come from the same `project()` call, so the crossfade stays pixel-identical | Requires re-deriving the camera in three's matrix conventions and proving equality |
| Bloom | Additive sprite quads, no render targets, ~0.3 KB | UnrealBloomPass = EffectComposer + 5 mip render targets, the worst mobile-GPU cost in the whole design |
| Scene size | 70 spheres + 264 lines: two `drawArraysInstanced` and one `drawArrays(LINES)` | Scene graph, matrix updates and material system buy nothing at this size |
| Fallback | Same `Renderer` interface; Canvas-2D stays as-is | Same interface, but the adapter is a fourth code path to keep in sync |
| Effort | 1.5–2 days incl. tests | ~1 day, but plus budget-rule work, and mobile perf tuning of bloom |

Recommendation: Route 1. It satisfies every stated requirement (shaded spheres, depth test, fog, gold glow, smoother inertia, same data, same poster, same reduced-motion path) at roughly 5 % of the payload of route 2, without touching the budget rules or the dependency freeze, and keeps a single source of truth for projection. Route 2 only becomes worthwhile if the client later wants shadows, environment lighting, 3D text labels or a post-processing chain; at that point add the allow-list (check-dist: a `LAZY_EXCEPTIONS` map keyed by chunk basename prefix that skips the per-chunk rule and is reported separately; .size-limit.json: a `!dist/_astro/three.*.js` negative glob plus a dedicated entry).

## Module layout

| File | Status | Role |
|---|---|---|
| `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-render.ts` | modify (small) | Stays the home of the pure helpers, the Canvas-2D `createRenderer` and `bindPointer`. Lift three closure pieces into exported, DOM-free helpers so both renderers share them: `projectScene(g, cam, w, h, unit, X, Y, Z, F, R)` (the per-node loop currently at lines 166–177, 3D branch only), `stepEmphasis(em, hl, dt): boolean` (lines 153–160), `edgeAlpha(cls, fs, ft, edgeMul, dim, inc, matched)` (line 189–191). Also export `readTokens()` (the `token()` + `getComputedStyle` block, lines 95–97) and a `hexToRgb01(hex): [r,g,b]` helper. `createRenderer` calls the lifted helpers; behaviour unchanged. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-gl.ts` | new (lazy chunk) | `createGLRenderer(canvas, g, opts: { onLost(): void }): Renderer \| null`. Top section DOM-free and exported for unit tests: GLSL source strings (`VS_SPHERE`, `FS_SPHERE`, `VS_GLOW`, `FS_GLOW`, `VS_EDGE`, `FS_EDGE`), `INSTANCE_STRIDE`, `packInstance(out, off, x, y, z, r, fog, rgb, hiRgb, mix, em, kind)`, `buildEdgeStatic(g): { alpha: Float32Array(2E), cls: Uint8Array(E) }` (alpha = `EDGE_ALPHA[edgeClass(e)]` per vertex), `GL_ATTRS` (context attributes object). Bottom section: context creation, program/buffer setup, `resize/draw/pick/pos`, context-loss handling. Implements mode `'3d'` only. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/hero-graph.ts` | modify | Renderer selection after the idle gate, `import()` of graph-gl only when WebGL2 exists, canvas swap on fallback, `onLost` → fallback, `data-renderer` attribute on `[data-hero]`, smoother inertia. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-2d.ts`, `src/components/Graph2D.astro` | unchanged | `/notes` keeps `createRenderer(canvas, g, '2d')`. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/src/components/HeroGraph.astro`, `HeroGraphSvg.astro`, `src/styles/hero.css` | unchanged | Poster, markup, crossfade CSS all stay. (Optional: one CSS line `.hero[data-renderer] .hero-gl { background: transparent }` is not needed; GL clears to transparent.) |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/.size-limit.json` | modify | Add an entry `{ name: "Hero WebGL renderer (lazy)", path: ["dist/_astro/graph-gl.*.js"], limit: "15 KB", gzip: true }`. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/scripts/check-dist.ts` | modify (optional) | In section 5, add a `NAMED_CHUNK_LIMITS: Record<string, number> = { 'graph-gl': 15 * KB, 'sound': 2 * KB }` matched by basename prefix, reported in `info` and erroring when exceeded. Also list lazy chunks ("not loaded by index.html") for visibility. |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/tests/unit/graph-render.test.ts`, `tests/unit/graph-gl.test.ts` | new | Pure-helper tests (below). |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/tests/e2e/home.spec.ts` | modify | New assertions (below). |
| `/Users/huachengt./Sites/sasipat-tejahempinyo/docs/HANDOFF-hero.md`, spec §7.5 | modify | Record that a WebGL branch now exists and what its fallbacks are. |

## Renderer-interface implementation strategy (graph-gl.ts)

Keep the `Renderer` interface exactly as declared in graph-render.ts lines 36–55; hero-graph.ts and bindPointer need no changes to talk to it. `hidden`, `match`, `labels`, `tagEdges` are honoured minimally (hidden/match dim as in Canvas; labels ignored because 3D mode never draws labels).

Positions: CPU projection, not GPU. Each frame call the lifted `projectScene()` to fill `X, Y, Z, F, R` in CSS px exactly as the Canvas renderer does, then upload. This keeps `pick()` and `pos()` byte-for-byte the copies of lines 253–262, keeps the poster crossfade exact, and means fog and radius come from `fog()` and `nodeRadius()` with no GLSL re-implementation to drift. At N = 70 the upload is ~3 KB per frame; irrelevant.

Buffers:
- Static unit quad (2 triangles, `a_corner` in [-1, 1]²).
- Instance buffer (DYNAMIC_DRAW), interleaved, stride 12 floats per node: `a_pos` (x, y px), `a_z`, `a_rad` (px, already ×(1+0.6·em)), `a_alpha` (fog × dim × match, computed exactly as lines 214–217), `a_base` rgb, `a_hi` rgb, `a_mix` (the `over` value from line 227), `a_kind` (0 disc, 1 ring). Instances are written in back-to-front order (reuse the `order` sort) so alpha blending is correct even with the depth test on.
- Glow uses the same quad and the same instance buffer with a second program; instances with `em == 0` and non-neighbours are culled in the vertex shader by emitting a clip-space position outside the frustum (`gl_Position = vec4(2.0)`), so there is no per-frame instance list to maintain.
- Edge buffer: positions (DYNAMIC, 2 vertices × 2 floats per edge, rewritten each frame from X/Y), per-vertex `a_z` for fog... simpler: per-vertex `a_alpha` (DYNAMIC, = `edgeAlpha()` result at that endpoint using F[endpoint], so linear interpolation across the line equals the Canvas midpoint average `(F[s]+F[t])/2`), per-vertex `a_gold` (0/1 incident flag × dim), static `a_cls` alpha from `buildEdgeStatic`. Hidden/tag-filtered edges get alpha 0. No quantisation into bins: bins exist only to batch Canvas strokes; the GL attribute carries `EDGE_ALPHA[cls]` exactly, which is the property the poster and Canvas agree on.

Draw order per frame: `clear(0,0,0,0)` → edges (`LINES`, depth test off, blend ONE / ONE_MINUS_SRC_ALPHA) → glow (`drawArraysInstanced`, depth test off, blend ONE / ONE) → spheres (`drawArraysInstanced`, depth test LESS, depth write on, blend ONE / ONE_MINUS_SRC_ALPHA). All fragment outputs premultiplied because the context uses `premultipliedAlpha: true` (the default) and composites over the page.

Depth: `gl_Position.z = clamp(a_z / 1.6, -1, 1) * w` gives a real depth buffer; impostors additionally write `gl_FragDepth` offset by the sphere's local `nz · rad` in normalised depth so intersecting spheres cut correctly (WebGL2 supports `gl_FragDepth` natively; can be dropped if it costs early-Z on mobile since overlaps are rare at this density).

Shading model (`FS_SPHERE`): `p = a_corner`, `r2 = dot(p,p)`; `discard` when `r2 > 1`; `n = vec3(p, sqrt(1 - r2))`; light fixed in view space `L = normalize(vec3(-0.45, 0.55, 0.7))` (up-left-front, matching the atlas highlight offset `fx .39 / fy .37` so the GL and poster highlight sit in the same place regardless of yaw); `diff = max(dot(n, L), 0)`; `spec = pow(max(dot(reflect(-L, n), vec3(0,0,1)), 0), 28)`; `rim = pow(1 - n.z, 2.5)`; `base = mix(a_base, a_hi, a_mix)`; `col = base * (0.32 + 0.68 * diff) + rim * 0.35 * mix(vec3(1), GOLD, a_mix) + spec * (0.18 + 0.35 * a_mix)`; emissive `col += GOLD * a_mix * 0.45` so hovered nodes read as lit from inside; edge AA `aa = 1 - smoothstep(1 - fw, 1, sqrt(r2))` with `fw = fwidth(sqrt(r2)) * 1.5`; ring kind: `aa *= smoothstep(0.59 - fw, 0.59, sqrt(r2))` and radius/stroke ratios 0.78 / 0.19 as in the SVG, flat shaded (gold-dim, gold when highlighted). Output `vec4(col * a, a)` with `a = a_alpha * aa`.

Glow (`FS_GLOW`): quad at 3.2 × radius; `g = exp(-4.5 * r2)` core plus `0.25 * exp(-1.2 * r2)` halo; strength `em * 0.9` for the highlighted node, `0.35 * dim` for neighbours; colour gold (`--gold`) with the halo tinted toward `--gold-2`; additive. This is the "cheap bloom". The quarter-res two-pass blur is explicitly a stretch item (task A9), only if the look review asks for glow bleeding across edges; it costs two FBOs, two programs and ~1.5 KB.

Antialiasing: `antialias: true` gives MSAA on the default framebuffer for edge lines; sphere silhouettes come from the `fwidth` smoothstep (MSAA does not help `discard` edges). If `gl.getParameter(gl.SAMPLES) === 0` nothing else changes.

Edges caveat (decision point for the look review): GL line width is 1 device pixel on every major implementation, so at DPR 2 edges are half the width of the poster's 1 CSS px `non-scaling-stroke` and the crossfade will show a slight thinning. Fallback if rejected: render edges as instanced screen-space quads (unit quad extruded along the segment normal by `0.5 * dpr` px in the vertex shader, ~30 lines, +0.5 KB) which gives exact width and `fwidth` AA. Keep GL_LINES as v1 per the brief.

Context loss: `webglcontextlost` → `preventDefault()`, `lost = true`, `draw()` returns false without touching GL, start a 1500 ms timer. `webglcontextrestored` → rerun `setup()` (programs, buffers, uniforms, viewport), clear timer. Timer fires first → `opts.onLost()`. hero-graph.ts handles `onLost` by `teardown()`, setting a module flag `glFailed = true`, swapping the canvas node, and calling `mount()` again, which now selects Canvas 2D.

Context attributes: `{ alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true }`. The last returns null on software GL (SwiftShader, blocklisted drivers) → Canvas-2D fallback; `low-power` keeps dual-GPU laptops on the integrated GPU for a decorative hero.

DPR / fps policy: unchanged and still owned by hero-graph.ts (30 fps on ≤ 4 cores or coarse pointer and after 20 s idle; pause when < 5 % visible, hidden tab, `pagehide`; stop at recede `p ≥ 1`). DPR cap stays `min(devicePixelRatio, coarse ? 1.5 : 2)` inside the renderer; GL fill cost is dominated by the glow quads (≤ 13 lit nodes × 3.2² × radius²), which is small at this cap. `resize()` sets `canvas.width/height`, `gl.viewport`, and the `u_res` uniform.

Lazy-loading gate in hero-graph.ts `mount()`:
1. Existing gate (`load` → idle → `!motionOff()` → `!saveData` → hero ≥ 25 % visible) is unchanged and runs before any import or fetch.
2. `const wantGL = !glFailed && 'WebGL2RenderingContext' in window;`
3. `const [res, glMod] = await Promise.all([fetch('/graph.json'), wantGL ? import('./graph-gl.ts') : null])` so the chunk downloads in parallel with the data.
4. `let r = glMod?.createGLRenderer(canvas, g, { onLost }) ?? null; if (!r) { glFailed = true; canvas = swapCanvas(canvas); r = createRenderer(canvas, g, '3d'); }` where `swapCanvas` does `const c = canvas.cloneNode(false) as HTMLCanvasElement; canvas.replaceWith(c); return c;`. `canvas` becomes a `let` scoped in `init`; `teardown()` also swaps the canvas so a re-mount after `motionchange` never inherits a stale context type.
5. `hero.dataset.renderer = r === gl ? 'gl' : '2d'` (removed in teardown) so tests and the look review can see which path ran.
6. Everything else (first frame at the poster camera, `is-live`, `inert` on the SVG) is unchanged.

Smoother inertia (hero-graph.ts, `onDrag`/frame): replace the single-sample `vel = d / dt` with an exponentially smoothed estimate `vel += (d / dt - vel) * (1 - exp(-dt * 25))` inside `onDrag`, lower the coast decay from `exp(-2 dt)` to `exp(-1.3 dt)`, keep the ±2.5 rad/s clamp, and ease the idle spin back in with the same λ so there is no step when inertia dies out. Also make the hover emphasis out-tween 300 ms (currently 150 ms) if the gold bloom looks abrupt; that constant is in the lifted `stepEmphasis`.

2D mode (`/notes`): untouched; `graph-2d.ts` never imports graph-gl. The `Graph2D` canvas keeps Canvas 2D because it needs text labels, filter states and a fit-to-box layout that gain nothing from GL.

Fallback matrix after the change: no JS / reduced motion / motion off / saveData → SVG poster (unchanged, never imports the GL chunk or fetches graph.json); WebGL2 missing, `failIfMajorPerformanceCaveat` null, shader compile failure, or context lost > 1.5 s → Canvas 2D (existing renderer); any exception anywhere in `mount()` → poster stays (existing `catch`).

## Size budget table (Feature A)

| Chunk | Loaded | Today (gz) | Estimate after | Enforced limit |
|---|---|---|---|---|
| `HeroGraph…hero-graph` | eager, counted by check-dist home JS | 2.0 KB | ~2.6 KB | part of 60 KB home JS |
| `graph-render` | eager (shared by hero + /notes) | 3.5 KB | ~3.7 KB (lifted helpers, token reader) | part of 60 KB / ≤ 30 KB chunk |
| `graph-gl` | lazy `import()` after idle gate, only with WebGL2 | – | ~5–7 KB (GLSL ~1.5, GL plumbing ~1.5, draw/pack ~2, loss handling ~0.3) | new size-limit entry 15 KB; check-dist named limit 15 KB; generic 30 KB chunk rule |
| `graph-2d` | /notes only | 0.9 KB | 0.9 KB | – |
| size-limit sum of `dist/_astro/*.js` | CI | 24.5 KB | ~31 KB | 60 KB |
| Home JS per check-dist | postbuild | unchanged by the lazy chunk | +~0.8 KB | 60 KB |

## Tests (Feature A)

Unit (`tests/unit/graph-render.test.ts`, node env, imports the DOM-free helpers):
- `project([0,0,0], CAM0.yaw, CAM0.pitch)` → `[0,0,0,1]`; `project([0,0,-1],0,0)[3]` → `2.8/1.8`; yaw π/2 maps x to −z; pitch sign convention; `s` decreases with z.
- `fog(-1.15) === 1`, `fog(1.15) === 0.35`, clamped beyond, monotonic.
- `nodeRadius(0) === 2`, `nodeRadius(1) ≈ 3.1`.
- `edgeClass` returns 1 for link, 0 for tag-hub spoke, 2 for clique.
- `stepEmphasis`: reaches 1 in 200 ms, 0 in 150 ms, returns false at rest.
- `edgeAlpha` reproduces the Canvas formula including the dim and match multipliers.
- `projectScene` on a 3-node fixture reproduces X/Y/R computed by hand for `w=1600, h=1000, unit=1`.

Unit (`tests/unit/graph-gl.test.ts`):
- `buildEdgeStatic(g)` alpha array has length 2E and equals `EDGE_ALPHA[edgeClass(e)]` at both vertices.
- `packInstance` writes `INSTANCE_STRIDE` floats and round-trips a known record.
- `hexToRgb01('#e8b84a')` ≈ `[0.9098, 0.7216, 0.2902]`.
- Shader sources: each `FS_*` string contains `#version 300 es` as its first line and `precision`, and `FS_SPHERE` references every attribute-derived varying it declares (a cheap guard against typos, since shaders cannot compile in node).

E2E (`tests/e2e/home.spec.ts`):
- Keep "poster before JS" (JS disabled: SVG visible, poster links, canvas hidden).
- "canvas after load": keep visibility, `aria-hidden`, poster opacity < .05; add `await expect(hero).toHaveAttribute('data-renderer', /^(gl|2d)$/)`; then compute in-page `const gl = !!document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })` and assert `data-renderer` equals `gl ? 'gl' : '2d'` (CI Chromium runs SwiftShader, so this typically exercises the 2D path there; the conditional keeps the test honest on developer machines with real GPUs).
- New "falls back to Canvas 2D when WebGL2 is unavailable": `addInitScript` patches `HTMLCanvasElement.prototype.getContext` to return null for `'webgl2'`; assert canvas visible and `data-renderer="2d"`, and that no request URL matches `/graph-gl/` is not required (the import may still happen; assert only the attribute).
- New "survives context loss" (chromium only, skipped when `data-renderer !== 'gl'`): `page.evaluate` gets the live context via `canvas.getContext('webgl2')` (returns the existing one) and calls `getExtension('WEBGL_lose_context').loseContext()` then `restoreContext()` after 200 ms; assert the canvas is still visible and `data-renderer` is still `gl`. Second variant without restore: poll for `data-renderer="2d"` within 5 s.
- Reduced motion (`test.use({ reducedMotion: 'reduce' })`) and `motion=off`: keep "canvas hidden, no visible canvases"; add a `page.on('request')` collector asserting no request to `/graph.json` and none whose URL contains `graph-gl`.
- Keep keyboard order and poster gold tests unchanged.

## Ordered task list (Feature A, ~1.5–2 days)

1. A1 (1 h): Lift `projectScene`, `stepEmphasis`, `edgeAlpha`, `readTokens`, `hexToRgb01` into the DOM-free section of graph-render.ts; `createRenderer` consumes them. Write `tests/unit/graph-render.test.ts`. Acceptance: vitest green, `npm run build` output byte-identical poster (`dist/index.html` SVG diff empty), hero looks unchanged.
2. A2 (2 h): graph-gl.ts skeleton: context creation with `GL_ATTRS`, `compile(vs, fs)` helper returning program + attribute/uniform lookups, buffers, `resize`, a `draw` that renders spheres flat-shaded from CPU-projected positions, `pick`/`pos` copied from Canvas. `createGLRenderer` returns null when `getContext` fails.
3. A3 (1 h): hero-graph.ts selection logic, `Promise.all` import + fetch, canvas swap, `glFailed`, `data-renderer`. Acceptance: on a GPU machine `data-renderer="gl"`; with DevTools "Disable WebGL" → `2d`; reduced motion → no import request in the Network panel.
4. A4 (3 h): Shading: impostor normals, light/rim/spec, gold mix and emissive, fog alpha, `fwidth` AA, ring kind for tags, back-to-front instance order, depth test + `gl_FragDepth`. Acceptance: first GL frame overlays the poster with no visible jump at 1280×800 and 375×812 (screenshot diff by eye in the crossfade with the transition slowed via DevTools).
5. A5 (1.5 h): Edges as GL_LINES with dynamic positions, per-vertex alpha from `edgeAlpha`, incident-gold attribute; verify hover dims/lights edges as before.
6. A6 (1.5 h): Glow program (additive, culled in VS), tune strengths against the Canvas glow; neighbour halo.
7. A7 (1 h): Context loss (events, timer, `setup()` re-run, `onLost` → fallback); manual test with `WEBGL_lose_context` in the console.
8. A8 (1.5 h): Inertia smoothing; e2e additions; `.size-limit.json` entry; optional check-dist named limits; `npm run build` + `npx size-limit` + `npx playwright test` green; update docs/HANDOFF-hero.md and spec §7.5 note.
9. A9 (stretch, 2 h): quarter-res two-pass Gaussian bloom, gated behind a constant, only if the look review wants glow bleeding.

## Risks (Feature A)

- GL_LINES hairline at DPR 2 vs the 1 CSS px poster lines (mitigation: A5 fallback to instanced quads).
- `failIfMajorPerformanceCaveat` makes CI exercise the Canvas path more than the GL path; the conditional e2e assertion plus a developer-machine run cover GL. Consider one CI job launching Chromium with `--use-angle=swiftshader --ignore-gpu-blocklist` only if GL coverage in CI is wanted.
- Safari/WebKit WebGL2 specifics: `gl_FragDepth` and `fwidth` are core in WebGL2, but Safari's `low-power` hint is ignored and its MSAA on transparent default framebuffers has had premultiplication bugs; keep the shader premultiplied and verify in Safari 17+.
- Canvas swap and pointer bindings: `bindPointer` and the `ResizeObserver` must attach to the new node; keep them inside `mount()` after renderer selection (they already are).
- Depth test with translucent far nodes: solved by back-to-front instance order; if `gl_FragDepth` disables early-Z on a phone, drop it (overlaps are rare at 70 nodes).
- Spec §7.5 currently says "There is no WebGL branch to test"; update the doc so the next builder is not surprised.

---

# Feature B: opt-in synthesized sound

## Design

State model: stored preference `localStorage['sound'] = 'on'` (absent = off). Effective state = stored on AND motion allowed (`!prefers-reduced-motion` and `html[data-motion] !== 'off'`). `html[data-sound="on"]` reflects the effective state, so CSS and other scripts read the truth; the stored preference survives a motion-off period and returns when motion comes back.

Pre-paint (Base.astro inline script, line 41 area, +1 statement): `if (localStorage.getItem('sound') === 'on' && localStorage.getItem('motion') !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.dataset.sound = 'on'`. No AudioContext here; attribute only.

Why one eager module rather than lazy: the AudioContext must be created and resumed inside the click's user activation, and Safari has historically been strict about resuming after an awaited `import()`. The whole module fits in the 2 KB counted budget, so `sound.ts` is loaded eagerly from Footer.astro exactly like motion.ts and does both the toggle and the synthesis. It creates nothing until needed.

### `src/scripts/sound.ts` API (new)

Exports (for tests and for any future direct caller): `sfx = { tap(), release(), drone(on: boolean) }`, plus pure helpers `dbToGain(db)`, `effectiveSound({ stored, motionOff }): boolean`. Internals:
- `ctx: AudioContext | null`, `master: GainNode`, created by `ensureCtx()` only when effective state is on and a sound is requested; `ensureCtx()` is also called synchronously in the chip click handler when turning on (the gesture), followed by `ctx.resume()`.
- Return-visit policy: if `ctx.state === 'suspended'` (no gesture yet on this page load), register one-time `pointerdown` and `keydown` listeners on window that call `resume()`; the drone request is remembered and starts after that first interaction. This satisfies "no autoplay" while letting a returning user hear the ambience after their first click or keypress.
- `ctx.onstatechange` mirrors `ctx.state` to `btn.dataset.audioState` on every `[data-sound-toggle]` (test hook; harmless in production).
- Event bus: `addEventListener('sfx', (e: CustomEvent<'tap' | 'release' | 'drone:on' | 'drone:off'>) => …)`; ignored entirely when effective state is off (no context created).
- `tap()`: rate-limited to one per 40 ms; oscillator `square` at 2 kHz, `start(t)`, `stop(t + 0.002)`, gain `dbToGain(-30)` ≈ 0.0316 with a 1 ms linear release.
- `release()` ("thock", ~120 ms): (a) noise burst from a once-generated 60 ms white-noise `AudioBuffer` through a `BiquadFilter` bandpass (900 Hz, Q 1.2) into a gain with envelope 0 → 0.5 in 1 ms then `exponentialRampToValueAtTime(0.001, t + 0.045)`; (b) sine oscillator at 110 Hz with `frequency.exponentialRampToValueAtTime(70, t + 0.12)`, gain 0 → 0.35 in 2 ms then exponential decay to 0.001 at t + 0.12, `stop(t + 0.13)`. Peak ≈ −14 dBFS; both routed to `master`.
- `drone(on)`: two `sine` oscillators at 110 Hz and 110.6 Hz (≈ 0.6 Hz beat) → `droneGain`; an LFO (`sine` 0.08 Hz) → `lfoGain` (depth 0.3) → `droneGain.gain` so the level breathes between roughly 0.7× and 1.0× of target; target `dbToGain(-36)` ≈ 0.0158; fade in `linearRampToValueAtTime(target, now + 2)`; `drone(false)` ramps to 0 over 0.6 s and stops/nulls the oscillators after 0.7 s. `visibilitychange` hidden → `drone(false)` and `ctx.suspend()`; visible → `ctx.resume()` (the hero's `wake()` re-dispatches `drone:on` if it is running).
- `motionchange` listener: recompute effective state; if now off → `drone(false)`, `ctx?.suspend()`, remove `data-sound`; if on and stored → set `data-sound`, `ctx?.resume()` (the motion chip click is a gesture, so this resumes), then `dispatchEvent(new CustomEvent('soundchange'))`. hero-graph listens to `soundchange` and calls `syncDrone()`.
- Chip render: text `Sound: on|off`, `aria-pressed = String(effective)`; while motion is off the chip gets `aria-disabled="true"`, `title="Turn motion on to enable sound"`, and clicks are ignored (stays focusable, unlike `disabled`).

### Callers (no import of sound.ts anywhere)

- `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-render.ts` `bindPointer`, at both `location.assign(...)` sites (lines 357 and 360): `dispatchEvent(new CustomEvent('sfx', { detail: 'release' }))` before navigating; when `document.documentElement.dataset.sound === 'on'` wrap the `location.assign` in `setTimeout(…, 80)` so the thock is not cut by unload (default users see no change). This gives the thock on both the hero and the /notes map, which is "a graph node is clicked/opened".
- `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/hero-graph.ts`: `syncDrone()` dispatches `drone:on` when `running` flips true and `drone:off` when it flips false, in `teardown()`, and on `soundchange`; called from `wake()` and the `p >= 1` stop branch in `frame()`. Optional: `tap` when the idle tour moves to a new hub (only if the client wants it; default no, to keep the tour silent).
- `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/countdown.ts` `setNumber()` (line 77): when `n !== shown && shown >= 0` dispatch `tap` (not on the initial index).
- `/Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/filters.ts`: in the year/cat/clear click handlers (or once in `apply(true)`), dispatch `tap`; never on `popstate` or the deep-link `apply(false)`.

### UI

- `/Users/huachengt./Sites/sasipat-tejahempinyo/src/components/Footer.astro` Settings column: a second chip `<button type="button" class="chip" data-sound-toggle aria-pressed="false">Sound: off</button>` next to the Motion chip (wrap both in a `.settings` flex row with `gap: .5rem`), and `<script src="../scripts/sound.ts"></script>` after motion.ts.
- Optional: Nav.astro `<dialog id="site-menu">` gets a `.menu-settings` row with both chips (same `data-motion-toggle` / `data-sound-toggle` attributes). This requires motion.ts to move from `querySelector` to `querySelectorAll` and re-render every button; sound.ts is written with `querySelectorAll` from the start.
- No `motion.css` change needed; a `[data-sound="on"]` hook is available for any future indicator.

### Accessibility

`aria-pressed` mirrors the effective state (pressed = on, the non-default, matching the Motion chip's convention); text label changes too, so AT gets both. No autoplay: nothing is constructed before a gesture, and a stored "on" only produces sound after the first interaction on that page. Respects `prefers-reduced-motion` and the motion toggle via `effectiveSound()`; the chip is `aria-disabled` with a reason while motion is off. Levels: tick −30 dB, drone −36 dB, thock peak about −14 dB with a 120 ms tail; all below the OS alert level. Axe: the new button has a text label; `aria-disabled` on a `<button>` is valid.

### Budget (Feature B)

| Item | Estimate (gz) | Limit |
|---|---|---|
| `sound.ts` (toggle + synth + bus), eager, every page | ~1.5–1.8 KB | 2 KB (check-dist named limit if emitted as its own chunk; otherwise visible in the home JS list) |
| Base.astro inline pre-paint addition | ~60 B | inline script counted |
| Dispatch sites in hero-graph / graph-render / countdown / filters | ~40 B each | – |
| Home JS total | +~1.9 KB | 60 KB |

### Tests (Feature B)

Unit (`tests/unit/sound.test.ts`, node env, imports only the pure exports): `dbToGain(-30) ≈ 0.0316`, `dbToGain(-36) ≈ 0.0158`, `dbToGain(0) === 1`; `effectiveSound({ stored: 'on', motionOff: false }) === true`, false when `motionOff`, false when stored is null. (The DOM parts of sound.ts must sit below the pure exports and guard on `typeof document !== 'undefined'`, following the graph-render.ts pattern.)

E2E (new `tests/e2e/sound.spec.ts`, plus one axe run of `/` already covering the footer):
- Default off: `addInitScript` wraps `window.AudioContext` in a counting proxy (`window.__acCount`); load `/`, wait for the hero to go live, click a poster/hub link is not needed; assert `__acCount === 0`, `html` has no `data-sound`, chip `aria-pressed="false"`, text `Sound: off`.
- Toggle on: click `[data-sound-toggle]`; assert `aria-pressed="true"`, `html[data-sound="on"]`, `localStorage.sound === 'on'`, `__acCount === 1`, and `expect.poll(() => btn.getAttribute('data-audio-state')).toBe('running')` (chromium; webkit gets the same assertion but marked `test.fixme` if it proves flaky in headless).
- Persists: reload with the preference → `html[data-sound="on"]` before scripts (check via `page.on('domcontentloaded')` evaluation) and `__acCount === 0` until a gesture; after `page.mouse.click` somewhere neutral, `data-audio-state` becomes `running` within 2 s (drone request honoured after the first interaction).
- Forced off: `localStorage.motion='off'` + stored sound on → no `data-sound`, chip `aria-disabled="true"`, clicking it creates no AudioContext; `reducedMotion: 'reduce'` → same.
- Dispatch smoke: on `/achievements`, click a filter chip and assert an `sfx` event fired (`addInitScript` adds a window listener that pushes `e.detail` to `window.__sfx`), and that with sound off no AudioContext exists afterwards.

## Ordered task list (Feature B, ~1 day)

1. B1 (1 h): Base.astro pre-paint line; Footer chip + script tag; sound.ts with toggle, storage, `soundchange`, `motionchange` handling, `effectiveSound`, `dbToGain`; unit test. Acceptance: chip toggles, attribute and storage agree, motion-off disables it.
2. B2 (2 h): Synth: `ensureCtx`, `tap`, `release`, `drone`, LFO, visibility pause, resume-on-first-gesture, `data-audio-state` mirror; event bus. Acceptance: manual listen in Chrome and Safari; levels metered roughly via the Web Audio inspector or by ear at system volume 50 %.
3. B3 (1 h): Dispatch sites (graph-render `bindPointer` with the 80 ms defer when on, hero-graph `syncDrone`, countdown, filters). Acceptance: hero drone fades in within 2 s of turning sound on while the hero is in view, stops on scroll recede and tab hide, resumes on scroll back; numeral changes tick at most every 40 ms.
4. B4 (1 h): e2e `sound.spec.ts`; run the axe spec; `npm run build` shows the sound chunk/inline ≤ 2 KB in the check-dist list; `npx size-limit` green.
5. B5 (optional, 45 min): chips in the mobile menu dialog; motion.ts to `querySelectorAll`; mobile e2e assertion that the menu shows both chips.
6. B6 (15 min): docs: HANDOFF note listing the `sfx` event contract (`'tap' | 'release' | 'drone:on' | 'drone:off'`) and the storage key.

## Risks (Feature B)

- The thock on click races navigation; the 80 ms defer when sound is on is a deliberate, documented trade-off (default users unaffected).
- Return-visit drone cannot start before a gesture under autoplay policy; documented behaviour, covered by a test.
- Headless WebKit AudioContext `running` state may be flaky; assert on chromium first.
- `motionchange` currently fires only from motion.ts; if the OS `prefers-reduced-motion` flips at runtime nothing re-evaluates. Add a `matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', …)` in sound.ts that re-runs the same handler (hero-graph has the same gap today; out of scope but worth one line).
- Two footer chips on a 320 px viewport must wrap, hence the flex row with `flex-wrap`.

---

### Critical Files for Implementation
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-render.ts
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/hero-graph.ts
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/graph-gl.ts (new)
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/sound.ts (new) with /Users/huachengt./Sites/sasipat-tejahempinyo/src/components/Footer.astro and /Users/huachengt./Sites/sasipat-tejahempinyo/src/layouts/Base.astro
- /Users/huachengt./Sites/sasipat-tejahempinyo/tests/e2e/home.spec.ts (plus new tests/e2e/sound.spec.ts, tests/unit/graph-render.test.ts, tests/unit/graph-gl.test.ts, and the budget entries in /Users/huachengt./Sites/sasipat-tejahempinyo/.size-limit.json and /Users/huachengt./Sites/sasipat-tejahempinyo/scripts/check-dist.ts)
# HANDOFF — hero-gl (v0.2: WebGL2 hero renderer + opt-in sound)

Plan: `docs/superpowers/plans/2026-09-17-hero-sound.md` (Feature A route 1, Feature B). No dependencies added, no git commands run.

## What changed

| File | Status | What |
|---|---|---|
| `src/scripts/graph-render.ts` | modified | Lifted DOM-free helpers shared by both renderers: `stepEmphasis(em, hl, dt)` (`EM_IN` .2 s / `EM_OUT` .15 s), `edgeAlpha(cls, fs, ft, edgeMul, dim, inc, matched)`, `projectScene(g, cam, w, h, unit, X, Y, Z, F, R)`, `hexToRgb01(hex)`, `readTokens()`, `openNode(url)`. `createRenderer` now calls them (Canvas 2D behaviour unchanged, `/notes` still Canvas 2D). `bindPointer` opens nodes through `openNode`: dispatches `sfx: 'release'` and, only when `html[data-sound="on"]`, defers `location.assign` by 80 ms so the thock is not cut by unload. |
| `src/scripts/graph-gl.ts` | new (lazy chunk) | `createGLRenderer(canvas, g, { onLost }): Renderer \| null`, same `Renderer` interface. CPU projection via `projectScene` (poster/canvas/GL share one coordinate space; `pick`/`pos` are byte-identical to Canvas). Sphere impostors (`drawArraysInstanced`, 14 floats per instance, back-to-front, depth test + `gl_FragDepth`), lighting: diffuse + rim + spec, gold mix/emissive on hover, `fwidth` AA, ring kind for tags with a ≥ 0.6 px minimum band. Edges: **instanced 1 CSS px quads** (see deviations). Additive glow program (culled in the vertex shader when strength is 0) for the highlighted node (`em × .9`) and its neighbours (`.22 × dim`). Context attributes `GL_ATTRS` include `failIfMajorPerformanceCaveat: true` and `powerPreference: 'low-power'`. Context loss: `preventDefault`, 1.5 s timer → `onLost()`; restore re-runs `setup()`. Exports for tests: GLSL strings, `INSTANCE_STRIDE`, `GL_ATTRS`, `GLOW_SCALE`, `packInstance`, `buildEdgeStatic`. |
| `src/scripts/hero-graph.ts` | modified | After the existing idle gate: `wantGL = !glFailed && 'WebGL2RenderingContext' in window`; `Promise.all([fetch('/graph.json'), wantGL ? import('./graph-gl.ts') : null])`; null renderer → `glFailed = true`, canvas swapped, Canvas 2D. `hero.dataset.renderer = 'gl' \| '2d'` (removed in teardown). `swapCanvas()` on every teardown/fallback (a canvas that had a webgl2 context can never return a 2d one). `onLost` → teardown + remount on Canvas 2D. Smoother inertia: exponentially smoothed drag velocity (λ 25), coast decay `exp(−1.3 dt)` (was 2), ±2.5 rad/s clamp kept. `setRunning()` dispatches `sfx: 'drone:on' / 'drone:off'` whenever the loop starts/stops (scroll recede, tab hidden, teardown), and re-dispatches on `soundchange`. |
| `src/scripts/sound.ts` | replaced stub | Pure exports `dbToGain`, `effectiveSound`, `sfx = { tap, release, drone }`, type `Sfx`. DOM part guarded by `typeof document`. AudioContext is created only inside the chip click or, for a returning visitor with a stored "on", on the first `pointerdown`/`keydown` (capture); a `drone:on` request arriving earlier is remembered. `ctx.onstatechange` mirrors to `data-audio-state` on every `[data-sound-toggle]`. `motionchange` and a `prefers-reduced-motion` change listener recompute the effective state (chip `aria-disabled` + title while motion is off; stored preference survives). `visibilitychange` suspends/resumes. Synth per plan: tap (2 kHz square, −30 dB, 40 ms rate limit), release thock (band-passed noise burst + 110→70 Hz sine, ~120 ms), drone (110 + 110.6 Hz sines, 0.08 Hz LFO breathing, −36 dB, 2 s fade in / 0.6 s fade out). |
| `src/scripts/countdown.ts` | one line | `sfx: 'tap'` in `setNumber` when `n !== shown && shown >= 0`. |
| `src/scripts/filters.ts` | one line | `sfx: 'tap'` once in `apply(true)` (never on popstate or the deep-link `apply(false)`). |
| `scripts/check-dist.ts` | modified | `NAMED_CHUNK_LIMITS = { 'graph-gl': 15 KB, sound: 2 KB }` (basename prefix; reported in info, error when exceeded). Home JS now also counts the **static imports** of the scripts index.html references (graph-render, preload-helper), so the number is honest; dynamic `import()` chunks are listed separately under "chunks not loaded by index.html". The inline sound script is labelled `(sound.ts)` and checked against the 2 KB limit. |
| `.size-limit.json` | modified | Added `Hero WebGL renderer (lazy)` → `dist/_astro/graph-gl.*.js`, 15 KB gz. (No entry for sound: Astro inlines it into every page, so there is no `sound.*.js` chunk; check-dist enforces its budget.) |
| `tests/unit/graph-render.test.ts`, `tests/unit/graph-gl.test.ts`, `tests/unit/sound.test.ts` | new | 31 tests over the pure helpers, packing, shader-source sanity and the sound pure parts. |
| `tests/e2e/home.spec.ts` | modified | `data-renderer` assertion (conditional on real WebGL2 availability), forced-null webgl2 fallback, context loss (restored and unrestored; chromium, skipped on the Canvas path), request collectors for reduced motion and `motion=off` (no `/graph.json`, no `graph-gl`). |
| `tests/e2e/sound.spec.ts` | new | Default off / no context; toggle creates exactly one context and reaches `running`; drone request on the bus; stored preference pre-paint but no context until a gesture; motion off and reduced motion disable; filter tap dispatch smoke. |
| `docs/HANDOFF-hero-gl.md` | new | This file. |

Untouched, as required: `graph-2d.ts`, `Graph2D.astro`, `HeroGraph.astro`, `HeroGraphSvg.astro`, `hero.css`, `Footer.astro`, `Base.astro`, `motion.ts`.

## Deviations from the plan (deliberate)

1. **Edges are instanced quads, not `GL_LINES`.** The first build used `GL_LINES`; at DPR 2 (every retina Mac and phone) GL lines are 1 device px = half the poster's `non-scaling-stroke` 1 CSS px, so the crossfade visibly thinned every edge. The plan lists this exact fallback under A5; it cost ~0.4 KB. Each edge is one quad with a 1 px core + 1 px AA skirt and half-pixel end caps; per-end alpha interpolates from source to target fog, which equals the Canvas midpoint average. Verified pixel-equal weight against the Canvas frame at DSF 2.
2. `INSTANCE_STRIDE` is 14 floats (the plan's field list adds up to 13 + a separate glow strength); glow strength is packed per instance instead of being derived in the shader.
3. Tag rings use the SVG's real ratios (band 0.685–0.875 of the radius) with a minimum half-band of 0.6 px so small rings do not vanish (the plan's 0.59 threshold was a typo).
4. Sphere base lighting is `0.42 + 0.62·diff` (plan: `.32 + .68`) so rest-state brightness matches the poster's flat fill; light direction is up-left in screen space to match the poster gradient's focal offset.
5. `sound.ts` never creates a context from a scroll-driven `tap`: before the first gesture, taps are dropped and the drone request is remembered; this keeps Chrome's autoplay warning out of the console and satisfies "AudioContext only from the toggle gesture / first interaction".
6. When motion comes back on with a stored "on" and no context exists yet, the context is created only if `navigator.userActivation.isActive` (the motion chip click); otherwise the first-gesture listener is armed again.

## Measured sizes (`/tmp/dist-hero`, `gzip -c | wc -c`)

| Chunk | gz | Limit |
|---|---|---|
| `graph-gl.*.js` (lazy) | **3 706 B** | 15 KB (target 6) |
| `graph-render.*.js` | 3 777 B (was 3 471) | shared |
| `HeroGraph…hero-graph` | 2 398 B (was 2 005) | home JS |
| `sound.ts` (inlined in every page) | **1.5 KB** | 2 KB |
| Home JS per check-dist | 12.2 KB (now includes the statically imported graph-render + preload-helper) | 60 KB |
| size-limit `dist/_astro/*.js` sum | 24.9 KB | 60 KB |

## How to verify

```
npx vitest run                                   # 196 tests green
npx astro check                                  # 0 errors
npx astro build --outDir /tmp/dist-hero && node scripts/check-dist.ts --dist /tmp/dist-hero
ASTRO_DEV_BACKGROUND=1 npx astro dev --port 4311 --ignore-lock      # or astro preview --outDir /tmp/dist-hero --port 4311
E2E_BASE_URL=http://localhost:4311 E2E_SERVER_CMD=true npx playwright test tests/e2e/home.spec.ts tests/e2e/sound.spec.ts
```
Result this session: 26 passed, 2 skipped (webkit context-loss by design, webkit keyboard pre-existing) on chromium + webkit; notes + axe specs still pass (14). Headless Chromium on this Mac takes the GL path (`data-renderer="gl"`); WebKit too. CI Chromium (SwiftShader) will take the Canvas path because of `failIfMajorPerformanceCaveat`; the e2e assertion is conditional so both are covered.

Look review (screenshots in `/tmp/hero-gl-shots/`: `chromium-1280.png`, `chromium-1280-hover.png`, `chromium-375.png`, `crop-gl.png` vs `crop-2d.png` at DSF 2, `crop-crossfade.png`, `webkit-1280.png`): positions identical to the Canvas frame, edges same weight, rings same size; GL spheres show diffuse shading, a specular highlight and a rim, hover gives a gold emissive sphere with an additive glow, gold-2 neighbours and gold incident edges. No jump at the crossfade.

Manual listen (not automatable): Chrome/Safari with system volume ~50 %: tick is a faint click, thock is a soft low knock, drone is a barely-there 110 Hz hum that breathes. Levels are below the OS alert level.

## Event contract for other builders

- `window.dispatchEvent(new CustomEvent('sfx', { detail: 'tap' | 'release' | 'drone:on' | 'drone:off' }))` — never import `sound.ts`. Ignored entirely while sound is off or before the first gesture.
- `soundchange` fires on `window` whenever the effective state flips (chip, motion toggle, OS reduced-motion change).
- Storage key `localStorage.sound = 'on'` (absent = off). `html[data-sound="on"]` is the effective state (Base.astro already sets it pre-paint when motion is not off).
- `[data-hero][data-renderer="gl"|"2d"]` tells you which hero renderer ran; `[data-sound-toggle][data-audio-state]` mirrors `AudioContext.state` (test hook).

## For the coordinator

- Nothing outside my ownership row was edited except the plan-allowed lines: `countdown.ts` and `filters.ts` (one dispatch line each), `scripts/check-dist.ts` and `.size-limit.json` (budget entries; the research builder's BIS entry is preserved), and `tests/**` (the plan's test list).
- `docs/superpowers/specs/2026-09-16-portfolio-site-design.md` §7.5 still says "There is no WebGL branch to test"; suggested replacement: "WebGL2 (hand-written, `graph-gl.ts`, lazy ≤ 15 KB gz) is preferred when `failIfMajorPerformanceCaveat` allows it; otherwise, or after a context loss longer than 1.5 s, Canvas 2D on a fresh canvas. `[data-hero][data-renderer]` reports which ran." I did not edit the spec.
- Optional B5 (chips in the mobile menu dialog) was not done; `sound.ts` already uses `querySelectorAll`, so adding a second `[data-sound-toggle]` needs no script change (motion.ts would need `querySelectorAll`).
- Backlog: quarter-res two-pass bloom (A9) not needed after the look review; the additive glow reads well. Frame-time measurement on a real phone remains open from v0.1.

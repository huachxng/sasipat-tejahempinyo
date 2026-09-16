# HANDOFF — hero (3D note-graph hero, 2D map, local graph)

## What was built (all files in the hero row of the ownership table)

| File | Purpose |
|---|---|
| `src/lib/graph.ts` | Tuned layout (see below), category hubs, deterministic PCA orientation pass, empty-input guard in `layout()`, defensive vault fallback. All existing exports/shapes kept. |
| `src/pages/graph.json.ts` | Static endpoint, `export const GET` → `toPublicGraph(getGraph())` as JSON. 27.5 KB raw / 6.7 KB gz. |
| `src/components/HeroGraphSvg.astro` | Server-rendered inline SVG poster, `viewBox 0 0 1600 1000`, camera yaw .35 / pitch −.18 / d 2.8. Edges as `<line>` grouped in 8 alpha bins, nodes as `<a href><circle/><title/></a>` with depth opacity .35–1, 6 highest-degree nodes gold, 12 hubs in the tab order, the rest `tabindex="-1"`. Imports the projection from `graph-render.ts`, so poster and first canvas frame are pixel-identical. 29.6 KB raw / 5.8 KB gz / 4.5 KB br. |
| `src/components/HeroGraph.astro` | 100svh hero: wordmark (line 1 `SASIPAT` + mono superscript `(Hua · writes as Noah)`, line 2 `TEJAHEMPINYO`, no portrait), poster, `<canvas class="hero-gl" aria-hidden hidden>`, label chip, sr-only "Most connected notes" list (12 real links), visible "Explore the 2D map →" → `/notes#graph`, scroll hint. |
| `src/scripts/hero-graph.ts` | Gates and choreography (§7.2–7.5). 2.0 KB gz. |
| `src/scripts/graph-render.ts` | Shared Canvas 2D renderer (3D + 2D modes) and the shared pointer/chip behaviour. 3.5 KB gz. |
| `src/components/Graph2D.astro` + `src/scripts/graph-2d.ts` | /notes map: checkboxes Notes · Blog · Achievements · Tag links, title highlight box, legend, `?focus=<nodeId>` and `data-focus` (prop, and observed at runtime via MutationObserver), labels for hubs with collision avoidance, same hover/click/touch semantics. 60vh / 40vh. Canvas `aria-hidden`, one-line text summary. 0.9 KB gz. |
| `src/components/LocalGraph.astro` | Static SVG, zero JS: centre node + up to 12 neighbours on a 90 px ring, each `<a>` with `<title>`, gold on hover/focus. ~4 KB raw / 1.0 KB gz. Renders nothing for nodes with no connections. |
| `src/styles/hero.css` | Imported by HeroGraph. |

### Measured sizes (from `/tmp/dist-hero`, `gzip -c | wc -c`)
- `hero-graph` 2 005 B gz + `graph-render` 3 469 B gz = **5.1 KB gz combined** (concatenated; budget ≤ 10 KB).
- `graph-2d` 913 B gz (shares `graph-render`). `graph.json` 6 680 B gz. Poster 5 819 B gz. Hero CSS lands in the shared page stylesheet (`index.*.css`, 2.4 KB gz total for the home page).

## Graph data — real numbers and the tuning I did
Real vault: 12 notes, 2 essays, 44 achievements → **70 nodes / 264 edges** (53 wikilinks, 211 tag edges, no orphans, degree median 7, max 22). Before tuning: 64 nodes, only 2 of 8 categories reached the hub threshold of 7, the 3D cloud was a flat disc (axis sd .50/.30/.42).

1. **Category hubs at ≥ 3 members** (`CATEGORY_HUB_MIN = 3` in graph.ts; `GRAPH.tagHubMin = 7` in site.config still governs plain tags). All eight categories are now hub nodes (`tag:category/<x>`, url `/achievements?cat=<x>`), each sitting 0.10–0.36 from its cluster centroid with centroids ~0.95 apart, so achievements visibly cluster by category. Plain-tag hubs: #archery 9, #recurve 9, #competition 11, #research 7.
2. **Radial strength .04 → .12** for connected nodes (spec value left the object flat) and a **deterministic post-pass `orient()`**: PCA-rotate the centred cloud (3D: longest axis vertical because the hero spins about y; 2D: longest axis horizontal because the panel is wide) plus a mild per-axis gain `(mean/sd)^.5` in 3D only (≤ 13 %). Result: axis sd .43/.47/.37 (min/max ratio .78, was .64), median nearest-neighbour distance .20 (not a hairball), p95 radius = 1, max 1.14. Same seeded d3 LCG, so output is stable across builds. `layout()` returns early on zero nodes (requested by the notes builder).
3. Layout takes ~140 ms in Node.

## Deviations from the spec (deliberate, all local to hero files)
- **Poster edge opacity** matches the canvas's rest state (kind alpha × depth fog, 8 bins) instead of a flat .55 so the crossfade is invisible; canvas edge alphas are .8 link / .4 spoke / .5 clique (spec .28/.10/.14 was invisible on `--edge` #3a3a40 over #0a0a0b).
- **Node radius** is `2 + 1.1·log2(1+deg)` in viewBox units (= the spec's px formula ÷ .8, the poster scale at a 1280 px desktop box) so poster and canvas share one coordinate space; unit radius `VB.r = 370`.
- **2D labels**: "hubs (deg ≥ 4)" would label 55 of 70 nodes; labels are the 12 `hubs` ∪ tag hubs + hovered/matched, with greedy overlap skipping.
- **Breakpoints**: the top-55 % graph layout applies below **1024 px** (a 768 px portrait tablet in the desktop layout produced a 422×1024 box that clipped the object). On desktop the box height is `min(100%, 64.7vw)`, vertically centred, so the box is never taller than 1.18× its width and the object always fits it at every viewport (tested 1024×768 → 1920×1080).
- The hero is `min-height: 100svh` with `margin-top: -var(--nav-h)` so the graph runs behind the transparent nav.
- Idle-tour release is the renderer's 150 ms out-tween (spec 400 ms) — trivial to change (`em` decay in `graph-render.ts`).
- The scroll hint is decorative (`aria-hidden`) because the id of the chapter index below is owned by the pages builder.

## Behaviour checklist (implemented)
Gates: after `load` → `requestIdleCallback` (1.5 s timeout, `setTimeout 200` fallback); skipped on reduced motion / `data-motion=off` / `saveData` / hero < 25 % visible. DPR cap 1.5 coarse / 2 fine. 30 fps cap on ≤ 4 cores or coarse pointer and after 20 s idle. Pause < 5 % visible or hidden tab; `pagehide` tears down (bfcache `pageshow` re-boots); `motionchange` mounts/tears down live. Sprite atlas (7 sprites), depth fog, edges batched into ≤ 24 strokes + 1 gold batch, one additive glow sprite, no `shadowBlur`. Entrance: poster scale .97→1 (CSS) in lockstep with the canvas tween, opacity crossfade 500 ms, edge alpha ×.6→1. Cursor follow λ 5, parallax λ 4, spin .04 rad/s, drag with inertia (λ 2, velocity clamped). Hover/pick 14 px (24 px touch) with chip (kind · links, title, year) and Now-indicator text (`[data-now-text]`, restored from `data-now-default`). Click opens; drag > 6 px never opens. Idle tour: seeded shuffle of the 12 hubs after 4 s, 3.2 s cadence, 2.4 s hold. Scroll recede: scale, `--hg-p` box opacity, pitch; loop stops at p ≥ 1 and restarts on scroll back. Touch: `touch-action: pan-y`, horizontal drag rotates, tap selects + "Open →", second tap opens. Keyboard: focusing a hub in the sr list golds the poster node (`.is-focus`) and, when live, applies the canvas hover; when live the poster gets `inert` so there is one set of tab stops. Any exception → poster stays (canvas only revealed after the first successful frame).

## How to verify
```
npx astro build --outDir /tmp/dist-hero          # passes, 226 pages
npx astro check                                   # only diagnostic in hero files: pre-existing missing types for d3-force-3d (see below)
npx astro dev --port 4311
node <scratchpad>/shoot.mjs http://localhost:4311 / /notes   # Playwright: 35 assertions, all pass, no console errors
```
The Playwright script (screenshots at 1280×800, 375×812 touch, 320, 768, 1024, 1920, reduced-motion, /notes?focus=…, a note page) is not committed (tests/** belongs to quality); a copy is at the scratchpad path used in this session and is easy to recreate from the description above. Screenshots reviewed: `/tmp/hero-*.png`.

## Shared-file changes the coordinator should apply
1. **`src/lib/vault.ts`** — already fixed by the coordinator (CONTENT_DIR from `process.cwd()`); the previous `import.meta.url` resolution pointed into `.astro/.prerender/chunks/`, so every build-time `getGraph()` saw an empty vault. `graph.ts` still carries a defensive fallback (`vaultIndex()`: uses `getVault()` and, if it is empty, `buildVaultIndex(resolve(process.cwd(), 'content'))`). It is harmless and can be deleted once vault.ts is confirmed.
2. **Types for `d3-force-3d`** (pre-existing `ts(7016)` on `src/lib/graph.ts:3`): add a file outside hero ownership, e.g. `src/types/d3-force-3d.d.ts`:
   ```ts
   declare module 'd3-force-3d';
   ```
   (`tsconfig.json` already includes `src/**/*`.)
3. **Category hub URL** is `/achievements?cat=<category>` (pre-existing in graph.ts). Achievements builder: please confirm the filter query param name, or tell me the right one and I will change it.
4. `/notes` already has `<section id="graph">` wrapping `<Graph2D />` (the hero link targets `/notes#graph`); Graph2D therefore has no id of its own.

## Not done / backlog
- Frame-time measurement on an iPhone SE-class device (week-2 gate in the spec) — no device here. The cap fallback (DPR 1, always-30 fps on coarse) is a one-line change in `createRenderer` / `hero-graph.ts`.
- Pan/zoom in the 2D map (backlog per spec).

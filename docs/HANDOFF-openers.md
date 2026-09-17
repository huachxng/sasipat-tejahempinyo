# Handoff — openers (scroll scenes for /achievements and /research)

Plan: `docs/superpowers/plans/2026-09-17-research-openers.md` §2, §3, §6, §8, §9 (openers part).

## What was built

| File | Role |
|---|---|
| `src/scripts/scroll-scene.ts` (new) | Shared primitive. For every `[data-scene]`: arms (`is-armed`), computes `p = clamp01(-rect.top / (track − stage))` per frame (IntersectionObserver gate + passive `scroll`/`resize` + one rAF), writes `--scene-p` on the section only when it changes ≥ 0.001, toggles `is-done` at p ≥ 0.98, calls a per-scene hook. Never arms under `prefers-reduced-motion` or `html[data-motion=off]`; `motionchange` (and the media-query `change`) un-arm / re-arm live; `pageshow` recomputes after bfcache; `try/catch` around arming leaves the static frame. Astro emits it as one shared chunk `_astro/scroll-scene.*.js` (1.7 KB raw, 0.9 KB gz), imported by both openers. |
| `src/styles/scene.css` (new) | `.scene` track + sticky `.scene-stage`. Desktop: stage `100svh`, track `200svh`. Phones (< 1024): stage `70svh` (may grow if the type needs it), track `140svh`. Nav overlaid like `.hero` (negative top margin + padding). Static frame rules for `:not(.is-armed)`, `html[data-motion=off]` and `prefers-reduced-motion` (no track, no pin). |
| `src/components/AchievementsOpener.astro` (replaced stub; props `{ entries, total, firstYear, lastYear }`) | WAYC cover via `entryMedia` + `OPENERS.achievements.entryId` (falls back to the newest `featured` entry with a photo cover; renders type-only if none). `ChapterHeader` stays inside the stage (h1, `view-transition-name: chapter-01`, `.reveal` untouched). Numeral pre-rolls 00 → N (p .10 → .75), photo reveals from a 16 % centre band (p 0 → .55), monochrome → colour (p .45 → .90), caption chip fades in. Slot content (the page intro) renders **after** the scene in `.container.ach-open-intro`, so phones fit inside the 70svh stage. |
| `src/components/ResearchOpener.astro` (replaced stub; no props) | Imports `loadBis, pathD, yOf, episodeRange, signatureRows, fmtZ, monthName, BIS_DANGER, BIS_EPISODES` from `src/lib/bis.ts` (the research builder's file was present; no fallback reader was needed). Episode bands, danger rule (HTML span scaled by `--p-danger`, draws over p 0 → .15), composite path with `pathLength="1"` and `stroke-dashoffset: calc(1 − var(--p-line))` (p .10 → .95), three signature labels + gold dots. Labels appear when the pen passes them: `--at` is the **cumulative user-space path-length fraction** (dashes are laid along the user-space path, so this is exact and viewport-independent). Low readings (BIS < 1, i.e. Dec 2007) hang below-left so the text never sits on the line. Phones: labels in a 3-column row under the plot. Styles are scoped in the component (research.css is not mine). |
| `src/styles/achievements.css` | Appended an "Opener" block only. |
| `src/pages/achievements/index.astro` | Imports `scene.css`; `<AchievementsOpener …>` replaces the bare `<ChapterHeader>`, intro paragraph passed as its slot; `.ach-intro` margin set to 0 (the wrapper provides the spacing). Filters/Timeline/Countdown untouched. |
| `tests/e2e/openers.spec.ts` (new) | 21 tests × 2 projects (see below). |

Both openers carry a tiny `is:inline` pre-arm script (same conditions as `scroll-scene.ts`) that adds `is-armed`, `--scene-p: 0` and, for achievements, writes `00` before first paint, so there is no flash from the static frame (full photo / drawn line / "43") to p = 0 once the module runs. No-JS, reduced motion and motion-off never see it.

## Design decisions worth knowing

- **Photo clip, not veils.** The reveal is a scaled overflow box (`.ach-open-clip { transform: scaleY(k) }` with the `img` counter-scaled `scaleY(1/k)`), so it is compositor-only *and* a real clip. Chromium ignores occlusion for LCP but honours clipping, so the LCP candidate is the visible band only (704 × 128 px at 1280×800), not the whole image.
- **LCP element.** Measured with `PerformanceObserver` on the preview build: `/achievements` LCP = the 16 % photo band (`img`, 90 112 px², ~80–100 ms locally, preloaded `fetchpriority=high`); `/research` LCP = the "03" numeral text. The h1 title cannot be the LCP element on any chapter page because `.reveal` clips it at first paint (site-wide behaviour, not changed here); the next-largest text ("00" numeral, ≈ 50 k px²) is smaller than a 16 % band. If the coordinator prefers a text LCP over the ≥ 16 % first-paint band, set `--k: calc(0.08 + 0.92 * var(--p-img))` in `achievements.css` (an 8 % band is ≈ 45 k px², below the numeral). LHCI (`lighthouserc.json`, mobile) should still pass either way: the mobile band is 375 × 42 px and the 768w webp is ~30 KB. `@lhci/cli` is not installed locally, so run LHCI in CI to confirm the 2.5 s budget.
- **Numeral handoff (v1 "simple").** The opener numeral sits in grid column 1 / span 4 with the same `--t-numeral`, letter-spacing and `−0.04em` offset as `.countdown-num`, so when the sticky Countdown takes over the number reappears at the same x. The view-transition handoff (`ach-count`) from the plan is still backlog.
- **`--bis-L` colour hook.** The Dec 2007 label's `L 2.11` uses `color: var(--bis-L, var(--gold-2))`. If `research.css` defines a pillar-L custom property under another name, either rename it to `--bis-L` on `:root`/`.page-research` or tell me the name.
- Intro copy after the scene rather than inside `ChapterHeader`'s slot: the 70svh phone stage cannot hold h1 + dek + intro + numeral without clipping, and the paragraph reads well as the lead-in to the filters.

## How to verify

```
npx astro build --outDir /tmp/dist-openers          # passes (223 pages)
npx astro check                                     # 0 errors
npx astro preview --outDir /tmp/dist-openers --port 4316
E2E_BASE_URL=http://localhost:4316 npx playwright test tests/e2e/openers.spec.ts tests/e2e/achievements.spec.ts
# → 42 passed (chromium + webkit): arm/pin/--scene-p→1, numeral 00→N, dashoffset 1→0, three labels at opacity 1,
#   reduced motion / data-motion=off / live un-arm / no-JS static frames, phone stage ≤ 70 % vh and track ≤ 1.5 vh,
#   no horizontal scroll; the existing countdown + filters tests still pass.
```

Visual check done with Playwright screenshots at 1280×800 and 375×812 at p = 0 / .25 / .5 / 1 / after, plus reduced-motion and no-JS variants, for both pages.

## Notes for the coordinator

- Nothing outside my ownership was edited. No dependencies added. No git commands were run.
- `/research` on phones briefly overflowed horizontally during my run (the BIS table, `TABLE.bis-table right=493`); the research builder's later page fixed it and the phone test now passes. If it regresses, the openers phone test for `/research` will fail on the `noHorizontalScroll` assertion — that is the page, not the opener (the opener's own `scrollWidth` is clean).
- Smooth scrolling (`html { scroll-behavior: smooth }`) means a single `scrollTo` lands a few px short for a frame; the spec polls, and `is-done` flips at p ≥ 0.98 as planned.
- Budgets: `scroll-scene.*.js` chunk 0.9 KB gz (limit 30 KB); `scene.css` 0.7 KB gz; opener image 1479w webp q70 = 92 KB (768w ≈ 30 KB).
- Backlog (unchanged from the plan): view-transition numeral handoff, pixel-mosaic-by-scroll variant, `animation-timeline: scroll()` branch under `@supports`.

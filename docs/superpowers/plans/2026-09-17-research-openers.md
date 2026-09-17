I have everything I need; the OG check settled the last open question (the cards print the chapter number, so About and Resume cards must be re-made, not just a Research card added). Here is the plan.

---

# Implementation plan: chapter 03 Research, scroll openers, BIS chart

## 0. What the exploration established

- `CHAPTERS` in `/Users/huachengt./Sites/sasipat-tejahempinyo/src/site.config.ts` is read by `Nav`, `Footer`, `ChapterHeader`, `ChapterNext`, `ChapterIndex`; `Base`'s `active` prop and the sitemap follow automatically once a page exists. `ChapterHeader` derives `view-transition-name: chapter-${c.num}` and the `01 / 05` progress mark from the array, so renumbering there is mechanical.
- Hardcoded chapter numbers that do not follow the array (grep results, all to be replaced with `chapterBySlug(...).num`):
  - `src/components/Countdown.astro:5` default `nowPrefix = '01 / Achievements'` and `src/scripts/countdown.ts:20` fallback.
  - `src/pages/achievements/index.astro:43` `now={`01 / Achievements / …`}`.
  - `src/pages/achievements/[id].astro:100` (`now`) and `:115` (`<a href="/achievements">01 Achievements</a>` crumb).
  - `src/pages/notes/[id].astro:70` and `src/pages/blog/[id].astro:82` eyebrow `<span class="num">02</span>`.
  - Comments only: `achievements.css:1`, `notes.css:1`, `resume.css:1`, `Timeline.astro:2`, `docs/MORNING.md:7-9`.
  - After renumbering, 01 and 02 keep their values; About 03→04, Resume 04→05, Contact 05→06. `public/og/about.png` and `resume.png` print the number, so they must be regenerated; `research.png` is new; `contact` uses `default.png`.
  - Tests that enumerate chapters: `tests/e2e/routes.spec.ts:10` (prefix list), `tests/e2e/axe.spec.ts:5-12` (PAGES), `tests/e2e/mobile.spec.ts:7` (paths).
- Existing patterns to reuse: `motionOff()` helper + `motionchange` teardown (`mosaic.ts`, `hero-graph.ts`), a scroll-progress custom property already exists (`--hg-p` in `hero-graph.ts:80-83`), the nav-overlay hero geometry (`hero.css .hero { margin-top: calc(-1 * var(--nav-h)); padding-top: var(--nav-h) }`), server-rendered inline SVG (`HeroGraphSvg.astro`), static endpoints (`graph.json.ts`), build-time `node:fs` reads anchored on `process.cwd()` (`vault.ts:37 CONTENT_DIR`, with `VAULT_DIR` override for tests), and `is-armed`-style "JS opts in, CSS default is the static frame" (`Mosaic.astro:74`).
- Node 24 runs `scripts/*.ts` directly (erasable syntax only). Current budgets have lots of headroom: home JS 5.9 KB gz of 60; largest chunk is photoswipe at 16.9 KB gz.
- Source content: WAYC entry id `thailand-youth-national-archery-team-wayc-2025` with `cover: thailand-youth-national-archery-team-wayc-2025-01.jpg` and alt text in the body; BIS achievement id `ai-bubble-mere-future-crisis-research` (SSRN placeholder lives in a `%%` comment, `links` has only GitHub); notes `Bubble Intensity Score`, `AI Bubble Research`, `Reproducible Research in R` are published. `content/data/` does not exist yet; the CSV is an input the client must provide.

## 1. Chapter renumbering

**`src/site.config.ts`**
- `ChapterSlug` gains `'research'`. Insert `{ num: '03', slug: 'research', title: 'Research', href: '/research', dek: 'The Bubble Intensity Score: one number, four pillars, three episodes.' }` at index 2; bump About/Resume/Contact to 04/05/06.
- Add `OPENERS = { achievements: { entryId: 'thailand-youth-national-archery-team-wayc-2025' } } as const` so the opener photo is configuration, not a component literal.
- Optional guard: `tests/unit/chapters.test.ts` asserting `CHAPTERS[i].num === String(i+1).padStart(2,'0')`, slugs unique, hrefs start with `/`.

**Replace literals** (files listed in §0) with `chapterBySlug('achievements').num` / `chapterBySlug('notes').num`. In `Countdown.astro` compute the default from `chapterBySlug('achievements')`; in `countdown.ts` keep the dataset value as the only source (drop the string fallback or derive it from `data-now-prefix`, which is always set).

**OG cards**: add `scripts/og-cards.ts` (dev-only, run by hand, output committed): Sharp rasterises an SVG template (1200×630, `--bg`, faint column rules, numeral in `--fg-3`, uppercase Inter Tight title, dek, gold square + host in JetBrains Mono, matching the existing cards) for every chapter in `CHAPTERS` plus `default`. Regenerates `about.png`, `resume.png`, creates `research.png`. Fonts: point librsvg at `node_modules/@fontsource-variable/*` files via `fontconfig`, or fall back to the static TTFs in `src/assets/fonts/`. Not part of the Vercel build (postbuild stays as is).

**Tests**: add `/research` to `routes.spec.ts` prefix list, `axe.spec.ts` PAGES, `mobile.spec.ts` paths. Nothing else references numbers.

**Nav width risk**: six chapters plus Search at ≥1024 px. Check at 1024–1200 px; mitigation is `.chapters ul { gap: clamp(.75rem, 1.6vw, 2rem) }` or raising the desktop-nav breakpoint in `Nav.astro:58` to 1152 px.

## 2. Shared scroll-scene primitive

**`src/scripts/scroll-scene.ts`** (≈1 KB gz; imported by both opener components; Astro dedupes)

- Selects `[data-scene]`. If `motionOff()` or no `IntersectionObserver`: do nothing (static frame stays). Otherwise adds `is-armed`, computes `p` immediately (handles reload mid-page and bfcache `pageshow`), then:
  - `IntersectionObserver` on the section toggles an `active` flag (rootMargin `0px`, threshold 0).
  - `scroll` and `resize` listeners (`{ passive: true }`) set a `ticking` flag and schedule one `requestAnimationFrame` (same shape as `countdown.ts:117-132`).
  - Per frame: `const r = section.getBoundingClientRect(); const stageH = stage.clientHeight; const range = Math.max(1, r.height - stageH); p = clamp01(-r.top / range);` then, only when `p` changed by ≥ 0.001, `section.style.setProperty('--scene-p', p.toFixed(3))`, toggle `is-done` at `p ≥ 0.98`, and call the scene's `onProgress(p)` hook (found by `data-scene="achievements" | "research"`).
  - `motionchange` → if off: remove `is-armed`/`is-done`, clear `--scene-p`, disconnect. If back on: re-arm.
- Segment helper used by both scenes: `seg(p, a, b) = clamp01((p - a) / (b - a))`.

**Shared CSS** (in `src/styles/scene.css`, imported by both pages, ≈1 KB):

```
.scene { position: relative; margin-top: calc(-1 * var(--nav-h)); height: calc(var(--scene-len) * 100svh); }
.scene-stage { position: sticky; top: 0; height: var(--scene-h); padding-top: var(--nav-h); overflow: hidden; isolation: isolate; display: grid; }
:root { --scene-h: 100svh; --scene-len: 2; }          /* desktop: pinned for one viewport of scroll */
@media (max-width: 1023px) { :root { --scene-h: 70svh; --scene-len: 1.4; } }  /* track 140svh ≤ 1.5 viewports, stage 70svh */
.scene:not(.is-armed) { height: auto; }               /* static frame: no track, no pin */
.scene:not(.is-armed) .scene-stage { position: static; height: auto; min-height: var(--scene-h); }
```
Reduced motion and `html[data-motion='off']` need no extra CSS because the script never arms; add the two selectors anyway as belt-and-braces so a stale `is-armed` can never pin.

Custom properties: `--scene-p` (0–1, set by JS), per-scene derived properties below are computed in CSS with `calc(clamp(...))` from `--scene-p`, so the only JS-written property is `--scene-p` (plus numeral text).

CSS scroll-timeline: not in v1. Double-driving `--scene-p` from both `animation-timeline` and rAF would fight; revisit as a `@supports (animation-timeline: scroll())` branch that disables the rAF writer once Firefox ships it.

## 3. Achievements opener

**`src/components/AchievementsOpener.astro`** — props `{ entries: Achievement[]; total: number; firstYear: number; lastYear: number }`.

- Resolves the photo: `entries.find(e => e.id === OPENERS.achievements.entryId)` → `entryMedia(e.data, e.body).cover` (skip if `isCertificateName`), alt from `gallery.find(g => g.name === cover.name)?.alt`; fallback: newest `featured` entry with a photo cover; if none, render the scene without an image (type-only).
- Markup:
  ```
  <section class="scene scene--ach" data-scene="achievements" data-total={total}>
    <div class="scene-stage container-bleed">
      <div class="ach-open-img" aria-hidden="true">      <!-- right 55% desktop / top 55% phone, like .hero -->
        <Image src={cover.meta} alt="" widths={[768,1280,1920]} sizes="(min-width:1024px) 58vw, 100vw" loading="eager" fetchpriority="high" decoding="sync" quality={70} format="webp" fit="cover" />
        <span class="ach-open-veil ach-open-veil--top"></span><span class="ach-open-veil ach-open-veil--bottom"></span>
      </div>
      <ChapterHeader slug="achievements"> <p class="ach-intro">…existing intro…</p> </ChapterHeader>
      <p class="ach-open-count numeral" aria-hidden="true"><span data-open-num>{pad(total)}</span></p>
      <p class="ach-open-label mono"><span class="sr-only">{total} entries, </span>{firstYear}–{lastYear}</p>
      <figcaption class="ach-open-cap mono">{alt}</figcaption>
    </div>
  </section>
  ```
  The `ChapterHeader` moves inside the stage so the `h1`, `view-transition-name: chapter-01`, and the `.reveal` title stay exactly where the site expects them; `/achievements` therefore still begins with `ChapterHeader` semantically.
- Static frame (no JS, reduced motion, motion off, script error): photo fully revealed in monochrome (site `.photo` convention), numeral already `44`, no pin. The server renders the numeral as `pad(total)`; the script sets it to `00` only after arming, so no-JS users never see `00`.
- Scroll choreography (`achievements.css` additions, all driven by `--scene-p`):
  ```
  .scene--ach { --p-img: 1; --p-col: 0; --p-num: 1; }                          /* static frame */
  .scene--ach.is-armed { --p-img: clamp(0, (var(--scene-p) - 0) / .55, 1);
                         --p-col: clamp(0, (var(--scene-p) - .45) / .45, 1);
                         --p-num: clamp(0, (var(--scene-p) - .10) / .65, 1); }
  .ach-open-img img { filter: grayscale(calc(1 - var(--p-col))) contrast(1.06); }
  .ach-open-veil { position:absolute; left:0; right:0; height:42%; background: var(--bg); transform: scaleY(calc(1 - var(--p-img))); }
  .ach-open-veil--top { top:0; transform-origin: top } .ach-open-veil--bottom { bottom:0; transform-origin: bottom }
  .ach-open-count { transform: translateY(calc((1 - var(--p-num)) * .15em)); }
  ```
  A 16 % band of the photo is visible at `p = 0` so the first paint is never blank; veils are `transform`-only (compositor), colour uses `filter` (composited in Chromium/WebKit). This is the "clipped + monochrome-to-colour" variant; the pixel-mosaic-by-scroll variant is listed as backlog (it would need a canvas and `img.decode()` and gives no first-paint benefit).
- Numeral pre-roll in the scene hook: `n = Math.round(seg(p, .10, .75) * total)`; write `pad(n)` to `[data-open-num]` only when it changes. Rolling-digit markup is not reused here (a value per frame would thrash the 300 ms roll).
- Handoff: v1 is the "simple handoff": the opener numeral is set in the same grid column (1 / span 4 at ≥1024 px), same `--t-numeral`, same left offset as `.countdown-num`, and simply scrolls away with the scene; the sticky `Countdown` already shows `N` before the timeline is reached (`countdown.ts:177`), so the number reappears at the same x. Optional v1.1 (≤ 15 lines, Chromium/Safari only): when `is-done` flips, wrap a class toggle in `document.startViewTransition()` with `view-transition-name: ach-count` on both numerals so the number visibly slides down into the column; guarded by `motionOff()`.
- Page changes in `src/pages/achievements/index.astro`: import `scene.css`, replace the bare `<ChapterHeader>` with `<AchievementsOpener entries={entries} total={entries.length} firstYear={oldestYear} lastYear={newestYear} />`, keep `Filters` and `Timeline` after it, `now` from `chapterBySlug`.
- LCP: with the veils covering most of the image at first paint, the LCP candidate is the `h1`, which is text and fast; the eager `fetchpriority="high"` image still preloads. Verify in LHCI (`/achievements` is one of the three audited URLs).

## 4. Data: `content/data/bis_panel_monthly.csv` and `src/lib/bis.ts`

**Location decision**: `content/data/bis_panel_monthly.csv` (recommended) over `src/data/`. Reasons: the author replaces it by copying `output/panel` from the R pipeline into a folder they already own and push with GitHub Desktop; check-content validates it with the same friendly file/fix messages as everything else in the vault; it stays a plain CSV (no code). Confirmed safe: `vault.ts` only globs `notes|blog|achievements/**/*.md` and `media/**`; `content.config.ts` globs are collection-scoped; check-content's filesystem pass has no rule that fires on `.csv`; `.gitignore` does not exclude it. `src/data/` would put an author-owned artefact under `src/`, which the brief forbids them from touching. Add one line to `content/README.md` ("`data/` holds the CSV behind the Research chart; replace the file, keep the columns").

**`src/lib/bis.ts`** (pure TS, no Astro imports, so scripts and vitest can import it; mirrors `jsonld.ts`):
- `BIS_CSV = join(CONTENT_DIR, 'data', 'bis_panel_monthly.csv')` (reuse `CONTENT_DIR` from `vault.ts` so `VAULT_DIR` fixtures work).
- `parseBisCsv(text): BisRow[]` — `{ month: 'YYYY-MM', index: number, V: number|null, L, S, C, BIS }`; tolerant of BOM, CRLF, quoted fields, `NA`/`NaN`/empty → `null`; throws `BisCsvError` with `{ line, message, fix }`.
- `validateBisCsv(rows | text): Problem[]` — required header exactly `month,V,L,S,C,BIS` (order-insensitive, extra columns warn), month regex, strictly consecutive months (`+1` each row, no gaps/dupes/out-of-order), numeric or NA cells, ≥ 120 rows, at least one non-NA BIS at or after 1995-01, non-NA BIS values within `[-10, 10]` (sanity), `NA` only permitted in leading and trailing runs (warning if interior).
- `loadBis(): BisData` memoised: `{ rows, plot: rows.filter(month >= '1995-01'), first, last, lastScored (last non-NA BIS), episodes, signatures, yDomains }`. Throws a clear build error if the file is missing ("content/data/bis_panel_monthly.csv is missing; the Research chapter cannot build").
- Constants: `BIS_DANGER = 1.5`; `BIS_EPISODES = [{ key:'dotcom', label:'Dot-com', from:'1995-01', to:'2003-12' }, { key:'gfc', label:'2008', from:'2003-01', to:'2010-12' }, { key:'ai', label:'AI', from:'2019-01', to:'2026-08' }]` (the `to` of `ai` clamps to `last`); `BIS_SIGNATURES = [{ month:'2000-02', label:'Dot-com peak' }, { month:'2007-12', label:'Credit-crunch onset', highlight:'L' }, { month:'2020-12', label:'AI-era maximum' }]`; `BIS_WARNINGS = ['1999-07','2020-08']` (first crossings, optional overlay).
- Lookups: `rowAt(month)`, `episodeRange(key) → { i0, i1 }` (indices into `plot`), `signatureRows()` (values read from the CSV, never hardcoded; the brief's 2.201 / 0.345 / 2.107 / 1.625 become unit-test expectations), `threeWay()` for the comparison table.
- Geometry (shared by chart and opener): SVG user units are `x = plot index`, `y = -value * 100`. `pathD(series, rows)` builds `M x y L x y …` with a new `M` after every null (gaps). `niceDomain(values) → [lo, hi]` at integer z steps; `yDomains = { composite: niceDomain(BIS), all: niceDomain(all five) }` (expected ≈ [-2, 3] and [-3, 6]).
- `bisChartHtml(data, opts): string` — the whole chart markup as a string (so a future remark fence can emit it; see §10). `BisChart.astro` calls it with `set:html`.

**`src/pages/data/bis_panel_monthly.csv.ts`** — static endpoint returning the raw file with `content-type: text/csv; charset=utf-8` (pattern: `graph.json.ts`). check-dist resolves `/data/bis_panel_monthly.csv` because the path has an extension; `.csv` is not in `TEXT_EXT`, so the PII text scan is skipped (fine; add `.csv` to `TEXT_EXT` if the quality owner prefers the 13-digit scan to run on it).

**check-content rule** (in `scripts/check-content.ts`, after profile.md): if `data/bis_panel_monthly.csv` is absent → *warning* ("the Research chart has no data yet; the site build will fail on /research until the file is added"; fix: copy `output/panel/bis_panel_monthly.csv` from the R project into `content/data/`); if present → `validateBisCsv` problems as errors with line numbers. Missing is a warning so the five fixture vaults keep exiting 0 and the author's unrelated pushes are not blocked by a rule they cannot see; the page's `loadBis()` still fails the real build loudly.

## 5. Research page `/research`

**`src/pages/research/index.astro`** (folder, to leave room for sub-pages), `active="research"`, `image="/og/research.png"`, `bodyClass="page-research"`, `now={`${num} / Research / BIS v1.0`}`, imports `scene.css` and `src/styles/research.css`.

Order:
1. `<ResearchOpener />` (§6) — contains `<ChapterHeader slug="research">` with a one-paragraph dek.
2. `<BisChart />` inside `<section class="bis-section container ruled" aria-labelledby="bis-title">`.
3. Method: `<section class="prose research-method" data-pagefind-body data-pagefind-filter="type:Research">` with four `h2 + p` blocks: Pillars (V CAPE; L corporate debt growth averaged with NFCI leverage; S inverted VIX averaged with inverted GPR; C Nasdaq/S&P), Z-scores (trailing 120-month mean and population SD, min 36, equal-weighted mean), Danger line (+1.5; first crossings 1999-07 and 2020-08), Limits (C is a proxy, L sees listed debt only, N = 3, resemblance not forecast). v1 hardcodes these in the page, sourced from the published notes; see backlog for moving them to an author-owned `content/research.md`.
4. Three-way table (values from `threeWay()`): rows Dot-com 2000-02 · 2008 2007-12 · AI 2020-12 (and a fourth "latest" row = `lastScored`), columns BIS, V, L, S, C; `<caption>`, `th scope`, mono numerals, cells ≥ +1.5 marked with a gold `▲` and `class="is-hot"`.
5. Links: `Bubble Intensity Score`, `AI Bubble Research`, `Reproducible Research in R` (via `resolveWikilink` from `src/lib/wikilinks.ts` so unpublished → plain text, same guarantee as notes; never hardcode `/notes/...`), the achievement entry (`/achievements/ai-bubble-mere-future-crisis-research`), SSRN: read `links` of the achievement via `parseLink` and show the SSRN chip only if a link whose host contains `ssrn` exists; otherwise a muted mono line "SSRN working paper: October 2026" (placeholder text lives in the page, the real URL will arrive in frontmatter `links`).
6. Attribution block (`.label` + list): CBOE (VIX), Federal Reserve Bank of Chicago (NFCI leverage subindex), Federal Reserve Z.1 (nonfinancial corporate debt), Robert Shiller (CAPE), Caldara & Iacoviello 2022 (GPR), Nasdaq Composite and S&P 500 via Yahoo Finance; "retrieved 2026-08-26". Also `Download CSV` link.
7. `<ChapterNext current="research" />` (→ 04 About).

**JSON-LD** — add `dataset()` to `src/lib/jsonld.ts` and emit on the page:
```
{ '@context':'https://schema.org', '@type':'Dataset',
  name:'Bubble Intensity Score — monthly panel, v1.0',
  description:'Monthly composite (BIS) and four pillar z-scores (V valuation, L leverage, S sentiment, C concentration), 1985-01 to <last>, computed from public data.',
  url: absUrl('/research'), sameAs?: SSRN when known,
  creator:{ '@type':'Person', '@id':PERSON_ID, name:PERSON.legalName },
  temporalCoverage:`${first}/${last}`, dateModified:`${last}-01`,
  measurementTechnique:'Trailing 120-month z-scores, equal-weighted mean of four pillars',
  variableMeasured:[{ '@type':'PropertyValue', name:'BIS', description:'Composite bubble intensity (z-score units)' }, …V,L,S,C],
  distribution:[{ '@type':'DataDownload', encodingFormat:'text/csv', contentUrl: absUrl('/data/bis_panel_monthly.csv') }],
  isBasedOn:['CBOE VIX', 'Chicago Fed NFCI leverage subindex', 'Federal Reserve Z.1', 'Shiller CAPE', 'Caldara & Iacoviello (2022) Geopolitical Risk Index'],
  keywords:['asset bubbles','composite index','z-scores','AI bubble'], license: <ask client; suggest CC BY 4.0> }
```
Plus the existing `BreadcrumbList` pattern is not used on chapter pages, so none here. `e2e` asserts the string `"Dataset"` appears in one ld+json block.

## 6. Research opener

**`src/components/ResearchOpener.astro`** — no props; calls `loadBis()`.
- Stage layout: `ChapterHeader` top-left; the line drawing fills the lower ~60 % of the stage full-bleed; three signature labels as HTML positioned by percent; danger line label "+1.5" at right.
- SVG: `viewBox="0 0 {N-1} {yh}"` in the same unit system as the chart, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke` on every stroke, `aria-hidden="true"` (the h1/dek and the chart below carry the meaning). Children: `<rect>` episode bands (`fill: var(--rule)`), `<line data-danger>` at `y = -150` (`stroke: var(--gold)`, dashed), `<path data-line pathLength="1" d={pathD('BIS')}>` (`stroke: var(--fg)`, 1.5 px).
- Draw-in:
  ```
  .scene--res { --p-line: 1; --p-danger: 1; }
  .scene--res.is-armed { --p-danger: clamp(0, var(--scene-p) / .15, 1); --p-line: clamp(0, (var(--scene-p) - .10) / .85, 1); }
  .scene--res [data-line]   { stroke-dasharray: 1 1; stroke-dashoffset: calc(1 - var(--p-line)); }
  .scene--res [data-danger] { stroke-dasharray: 1 1; stroke-dashoffset: calc(1 - var(--p-danger)); pathLength: 1 (attribute) }
  .res-sig { --at: <index fraction>; opacity: clamp(0, (var(--p-line) - var(--at)) * 12, 1); transform: translateY(calc((1 - clamp(0, (var(--p-line) - var(--at)) * 12, 1)) * 6px)); }
  ```
  `pathLength="1"` normalises the dash maths regardless of the real length (Chromium, WebKit, Firefox all support it). Label `--at` = `(signatureIndex) / (N-1)` computed at build (≈ .16, .41, .82). Static frame: fully drawn, all labels visible.
- Label content: month, `BIS 2.20` (from CSV, 2 dp), and for 2007-12 the leverage reading `L 2.11` in the pillar-L colour; mono at `--t-label`.
- Phone: stage 70svh, labels stack at the bottom in a row instead of floating over the line (they would overlap at 375 px).

## 7. The interactive chart

**`src/components/BisChart.astro`** (thin: `set:html={bisChartHtml(loadBis(), { id: 'bis' })}` + `<script src="../scripts/bis-chart.ts">`).

Markup emitted by `bisChartHtml` (HTML for everything that carries text, SVG only for geometry):
```
<figure class="bis" id="bis" data-bis data-n={N} data-first="1995-01" data-y-composite="-200 500" data-y-all="-600 900" data-domain="0 {N-1}">
  <figcaption class="bis-head"><h2 id="bis-title" class="display t-3">Bubble Intensity Score, 1995–2026</h2><p class="mono small muted">…one sentence…</p></figcaption>
  <div class="bis-tools">
    <div role="group" aria-label="Zoom" class="bis-zoom">   <button class="tab mono" data-zoom="all" aria-pressed="true">All</button> …dotcom/gfc/ai… </div>
    <div role="group" aria-label="Pillars" class="bis-pillars"> <button class="chip bis-chip" data-pillar="v" aria-pressed="false"><i class="bis-swatch bis-swatch--v"></i>V Valuation</button> …L S C… </div>
  </div>
  <div class="bis-frame" data-bis-frame tabindex="0" aria-roledescription="interactive chart" aria-label="Bubble Intensity Score by month. Use left and right arrow keys to move the cursor." aria-describedby="bis-desc">
    <div class="bis-y" data-y-axis> <span style="top:%">+3</span> … </div>
    <div class="bis-plot" data-plot>
      <svg viewBox="0 -200 {N-1} 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g data-episodes> <rect class="bis-band" x y width height/> ×3 </g>
        <line class="bis-danger" x1="0" x2="{N-1}" y1="-150" y2="-150"/>
        <line class="bis-zero" …/>
        <path class="bis-series bis-series--v" data-series="v" d="…" hidden/> … l s c …
        <path class="bis-series bis-series--bis" data-series="bis" d="…"/>
        <g data-warnings> <line class="bis-warn" x="idx(1999-07)"/> … </g>
      </svg>
      <div class="bis-marks"> <button class="bis-sig" data-month="2000-02" style="left:%;top:%" aria-label="February 2000, BIS 2.20, Dot-com peak"></button> ×3 </div>
      <div class="bis-cursor" data-cursor hidden aria-hidden="true"></div>
      <div class="bis-tip mono" data-tip hidden aria-hidden="true">…</div>
    </div>
    <div class="bis-x" data-x-axis> <span style="left:%">1995</span> … every 5 years … </div>
  </div>
  <p id="bis-desc" class="sr-only">…composite in white, danger line at +1.5 in gold, shaded bands for the dot-com, 2008 and AI windows; signature months …</p>
  <output class="sr-only" aria-live="polite" data-bis-live></output>
  <p class="bis-foot mono small"><a href="/data/bis_panel_monthly.csv" download>Download CSV</a> · <span data-bis-status>Hover or focus the chart and use arrow keys</span></p>
  <script type="application/json" data-bis-data>[["1995-01",BIS,V,L,S,C],…]</script>
</figure>
```
- Why HTML labels + `preserveAspectRatio="none"`: a 1200-unit viewBox at 375 px would scale 12-unit text to ~4 px; with HTML labels, typography stays `--font-mono` at `--t-label` at every width, and the plot can change aspect per breakpoint (`aspect-ratio: 12/5` desktop, `4/3` phones) with no re-render. Strokes stay crisp via `vector-effect: non-scaling-stroke`.
- Why `x = index, y = -value*100`: zooming and y-rescaling are then just `viewBox` attribute writes; the script never rebuilds paths.
- Accessible equivalent: the visible three-way table plus the CSV download plus `#bis-desc`; a 500-row `sr-only` table is deliberately avoided (poor screen-reader experience, +10 KB). Signature markers are real `<button>`s so keyboard users can jump to them.
- Colours (`research.css`, scoped to `.bis` and `.scene--res`): composite `var(--fg)`, danger line + cursor + hover marker `var(--gold)`, bands `var(--rule)`, zero line `var(--rule-strong)`, axes text `var(--fg-3)`, pillars:

  | token | hex | contrast on `#0a0a0b` | redundant encoding |
  |---|---|---|---|
  | `--bis-v` (Valuation) | `#7fb3d5` | ≈ 8.7:1 | solid, 1 px |
  | `--bis-l` (Leverage) | `#e07a5f` | ≈ 6.7:1 | dashed 6 3 |
  | `--bis-s` (Sentiment) | `#8fbf8f` | ≈ 9.4:1 | dotted 1.5 3 |
  | `--bis-c` (Concentration) | `#b39ddb` | ≈ 8.2:1 | dash-dot 6 3 1.5 3 |

  All clear WCAG 1.4.11 (3:1) with margin; L/S differ in lightness as well as hue and carry different dash patterns so the pair survives deuteranopia. Legend chips show the swatch with its dash pattern.

**`src/scripts/bis-chart.ts`** (target ≤ 8 KB gz, estimate 3–4 KB):
- Parse `[data-bis-data]` once. State `{ i0, i1, pillars:Set, cursor:number|null }`; read/write `?zoom=dotcom&pillars=v,l` with `history.replaceState` (pattern: `filters.ts`).
- `setDomain(i0,i1)`: `svg.setAttribute('viewBox', `${i0} ${y0} ${i1-i0} ${yh}`)` where `[y0,yh]` = composite or all domain depending on whether any pillar is on; reposition x ticks (compute year ticks inside the domain: every 5 y for All, yearly for episodes), y ticks, signature buttons (`left = (idx - i0)/(i1-i0)`), warning lines are inside the SVG so they move for free. Optional 280 ms rAF interpolation of viewBox when `!motionOff()`.
- Pointer: `pointermove`/`pointerdown` on `[data-plot]` → `idx = i0 + round(xFrac * (i1 - i0))` → `setCursor(idx)`: cursor `left`, tooltip text `2000-02 · BIS 2.20 · V 1.97 · L 1.77 · S −0.15 · C 5.22` (NA → "n/a"), tooltip flips side past 65 % width, `pointerleave` hides. Touch: `pointerdown` + `pointermove` with `touch-action: pan-y` on the plot.
- Keyboard on `[data-bis-frame]`: ArrowLeft/Right ±1, Shift ±12, PageUp/Down ±60, Home/End domain ends; keeps the cursor inside the domain; updates the tooltip and writes the same sentence to `[data-bis-live]` (debounced 150 ms). Signature buttons: click → `setCursor` + focus frame.
- Toggles: chip click flips `aria-pressed`, toggles `hidden` on `path[data-series=x]`, recomputes the y domain, syncs URL. Zoom buttons set `aria-pressed` exclusively.
- `motionchange`: only affects the viewBox tween.

## 8. Accessibility and fallback matrix

| Condition | Achievements opener | Research opener | Chart |
|---|---|---|---|
| No JS | Static frame: photo revealed (mono), numeral = N, no pin, `h1` first | Line fully drawn, labels visible, no pin | SVG + bands + danger line render; pillars hidden; table, CSV, description present; tools inert |
| `prefers-reduced-motion` | Same static frame (script never arms) | Same | Interactive, no viewBox tween |
| `html[data-motion=off]` | Same; flipping the toggle mid-page un-arms live via `motionchange` | Same | Same |
| Phone (< 1024) | Stage 70svh, track 140svh (≤ 1.5 vp), photo top 55 %, type below on solid `--bg` | Stage 70svh, labels in a row under the line | Aspect 4/3, tooltip anchored to plot edges, touch drag |
| Keyboard | Tab order: skip → nav → `h1` region (nothing focusable inside the scene) | Same | Frame focusable, arrows move cursor, live region announces; chips/tabs are buttons with `aria-pressed` |
| Screen reader | `h1` "Chapter 1: Achievements", `sr-only` "44 entries", numeral/photo `aria-hidden` | `h1` "Chapter 3: Research", SVG `aria-hidden` | `figure` + heading + `#bis-desc` + table + CSV; tooltip `aria-hidden`, `output` live |
| Script throws | `try/catch` around arming → static frame remains | Same | Chart stays static |
| bfcache restore | `pageshow` re-computes `p` | Same | State re-read from URL |

## 9. Tests

**Unit** — `tests/unit/bis.test.ts` with `tests/fixtures/data/bis_small.csv` (≈ 160 rows, hand-made, NA head/tail, one known peak) and the real file:
- parses header/rows, BOM/CRLF, `NA` → `null`; rejects missing column, bad month, gap, duplicate, out-of-order, non-numeric with the expected `line` and message text.
- `plot` starts at `1995-01`; `episodeRange('dotcom')` = indices of 1995-01…2003-12; `ai` clamps to `last`.
- `signatureRows()` on the real CSV: 2000-02 BIS ≈ 2.201, 2007-12 BIS ≈ 0.345 and L ≈ 2.107, 2020-12 BIS ≈ 1.625 (`toBeCloseTo(…, 2)`); test is skipped with a clear message if the file is absent, so CI is green before the client delivers it.
- `pathD` inserts `M` after nulls, emits `N` points, no `NaN`; `niceDomain` rounds outward to integers.
- `bisChartHtml` output: contains `data-series="bis"`, three `.bis-sig` buttons, `viewBox` string matches the composite domain, JSON payload parses and has `N` rows.
- `tests/unit/check-content.test.ts`: add a case with a fixture vault containing a broken `data/bis_panel_monthly.csv` (gap month) → `✖ content/data/bis_panel_monthly.csv:<line> — …` and exit 1; and confirm the clean fixture (no `data/`) still prints `0 errors`.
- `tests/unit/chapters.test.ts` (sequential nums) and extend `tests/unit/resume.test.ts`? No — resume unaffected.

**E2E** — `tests/e2e/openers.spec.ts`:
- `/achievements` and `/research` at 1280×800 and at 375×720 (`isMobile`): `scrollWidth ≤ clientWidth + 1` after load and after scrolling to the end of the track.
- Motion on: `[data-scene]` has `is-armed`; opener numeral reads `00` after arm; `window.scrollTo(0, section.offsetTop + section.offsetHeight - stage.offsetHeight)`; `expect.poll(numeral text) === pad(main article count)`; `getComputedStyle(section).getPropertyValue('--scene-p')` ≥ 0.98; research: `getComputedStyle(path[data-line]).strokeDashoffset` → `0` (or `0px`), three `.res-sig` with opacity 1.
- `test.use({ reducedMotion: 'reduce' })`: no `is-armed`, numeral equals total before any scroll, `getComputedStyle(stage).position !== 'sticky'`, `.scene img` visible, `--scene-p` empty; research line dashoffset already 0.
- `data-motion=off` via `addInitScript` (same as `home.spec.ts:39-48`): identical assertions.
- No-JS context (`javaScriptEnabled: false`): image visible, numeral = total; `/research`: `svg[data-line]`/chart `svg` attached.
- Phone: `section.offsetHeight ≤ innerHeight * 1.5 + 1`, `stage.offsetHeight ≤ innerHeight * 0.7 + 2`.

`tests/e2e/research.spec.ts`:
- No-JS: `figure[data-bis] svg path[data-series="bis"]` attached; `path[data-series="v"]` hidden; `Download CSV` link → `request.get` 200 with `text/csv`; four method `h2`s; table has ≥ 3 rows; ld+json includes `"Dataset"`; `h1` contains "Research"; legal-name check not required (research byline is the achievements convention → assert body contains "Sasipat" if a byline is added).
- Hover: `page.mouse.move` to plot centre → `[data-tip]` visible, text matches `/\d{4}-\d{2}/` and `/BIS/` and each of `V`, `L`, `S`, `C`.
- Keyboard: focus `[data-bis-frame]`, press `ArrowRight` ×3 → `[data-cursor]` `data-month` advanced by three months; `[data-bis-live]` non-empty; `End` → last month of the domain.
- Toggles: click chip `V` → `aria-pressed="true"`, `path[data-series="v"]` visible, URL has `pillars=v`; click zoom `Dot-com` → `viewBox` width < `N-1`, URL has `zoom=dotcom`; `All` restores.
- WebKit project included (Playwright config already runs both).

Existing spec edits: `routes.spec.ts` prefixes + `/research`; `axe.spec.ts` PAGES + `['/research', null]`; `mobile.spec.ts` paths + `/research`.

## 10. Budget table

| Item | Limit | Estimate | Enforced by |
|---|---|---|---|
| Home JS (index.html) | 60 KB gz | unchanged 5.9 KB (+~0.2 KB HTML for one index row) | check-dist |
| `dist/index.html` | 60 KB gz | +0.2 KB | size-limit |
| `bis-chart.ts` chunk | 8 KB gz (self-imposed), 30 KB hard | 3–4 KB | check-dist (30), new `.size-limit.json` entry `dist/_astro/BisChart*.js ≤ 8 KB` |
| `scroll-scene.ts` | 30 KB | ≈ 1 KB (likely inlined into the page) | check-dist |
| Inline JSON data on `/research` | none | ≈ 17 KB raw / 5 KB gz | note in handoff |
| `/research` HTML total | none | ≈ 70 KB raw / 20 KB gz (5 paths × 380 pts) | manual |
| `research.css` + `scene.css` | 40 KB total CSS | +4 KB gz | size-limit |
| Opener image | 2 MB/asset | 1920w webp q70 ≈ 250–350 KB; 768w ≈ 70 KB | check-dist |
| `/data/bis_panel_monthly.csv` | 2 MB | ≈ 25 KB | check-dist |
| LHCI `/achievements` | LCP ≤ 2.5 s, CLS ≤ .05 | LCP = h1 text; CLS 0 (all sizes fixed) | lighthouserc |

## 11. Risks

1. **CSV not yet delivered**: the whole chapter depends on it. Mitigation: `loadBis()` fails the build with a one-line fix; unit tests skip gracefully; ask the client for `output/panel` now (task 0).
2. **LCP on `/achievements`** if the browser picks the partly veiled image: keep the visible band ≤ 20 % at `p = 0` and the `h1` above the fold; verify in LHCI before merging.
3. **Nav overflow at 1024–1200 px** with six chapters: measure; adjust gap or breakpoint.
4. **`preserveAspectRatio="none"` + non-uniform scaling**: any `<circle>`/text inside the SVG would distort, hence markers and labels are HTML. Enforce in `bisChartHtml` (no text/circle elements).
5. **Sticky + `overflow-x: clip` on `body`** works (`clip` does not create a scroll container); do not switch to `hidden`.
6. **iOS URL-bar height changes** mid-scroll shift `p` slightly; `svh` units and per-frame `getBoundingClientRect` keep it stable; no `100vh` anywhere.
7. **View-transition name collision**: `chapter-03` moves from About to Research automatically; no page renders two headers. `ach-count` (optional handoff) must exist on exactly one visible element per state.
8. **Filter reflow view transition** (`html.is-filtering`) now also snapshots the opener; it is above the timeline and static by then, so unaffected, but confirm no flash.
9. **Prose ownership**: method paragraphs in `.astro` are not author-editable; agreed as v1, backlog item below.
10. **Pagefind**: adding `data-pagefind-body` to the method section indexes it; without it the page is excluded (pages with the attribute anywhere on the site make others opt-in). Decide; default: include.
11. **`pathLength` + `stroke-dasharray` on a 380-point path**: fine in all engines; test in WebKit via the Playwright project.

## 12. Ordered task list

0. Inputs from client: `bis_panel_monthly.csv` (v1.0 run), confirm dek text for 03, licence for the dataset (suggest CC BY 4.0), confirm "Research" as the SSRN placeholder wording.
1. `site.config.ts`: add `research`, renumber, `OPENERS`; replace literals in `Countdown.astro`, `countdown.ts`, `achievements/index.astro`, `achievements/[id].astro`, `notes/[id].astro`, `blog/[id].astro`; update CSS header comments; `tests/unit/chapters.test.ts`. Build passes with a temporary placeholder `research/index.astro` (header + next only) so nav links resolve for check-dist.
2. `scripts/og-cards.ts`; regenerate `about.png`, `resume.png`, add `research.png`; commit.
3. `src/lib/bis.ts` + `tests/fixtures/data/bis_small.csv` + `tests/unit/bis.test.ts` (TDD: parser, validation, lookups, geometry, HTML string).
4. `content/data/bis_panel_monthly.csv` (from client) + `content/README.md` line; check-content rule + fixture + test case.
5. `src/pages/data/bis_panel_monthly.csv.ts`; `jsonld.ts dataset()`.
6. `research.css`, `BisChart.astro` (static first paint), `research/index.astro` with method, table, links, attribution, JSON-LD, `ChapterNext`; axe pass locally.
7. `bis-chart.ts` (pointer, keyboard, toggles, zoom, URL state); `.size-limit.json` entry.
8. `scene.css`, `scroll-scene.ts`; `AchievementsOpener.astro` + `achievements.css` additions; rewire `achievements/index.astro`; verify countdown behaviour and filters still pass `achievements.spec.ts`.
9. `ResearchOpener.astro` + draw-in CSS; phone layout.
10. E2E: `openers.spec.ts`, `research.spec.ts`; edit `routes/axe/mobile` specs; run Chromium + WebKit.
11. Full `npm run build` (check-content → build → PDF → check-dist), LHCI on `/achievements`; record numbers in the handoff.
12. `docs/HANDOFF-research.md`; update `docs/BUILD-BRIEF.md` ownership table (new "research" area: `src/pages/research/**`, `src/components/{BisChart,ResearchOpener,AchievementsOpener}.astro`, `src/scripts/{bis-chart,scroll-scene}.ts`, `src/lib/bis.ts`, `src/styles/{research,scene}.css`, `content/data/**` author-owned) and `CLAUDE.md` (data file rule).

**Backlog (not now)**
- ```` ```bis-chart ```` fence in notes: a `remark-bis-chart.ts` plugin in `remarkPlugins` before the highlighter (verify where Shiki sits in the `unified()` custom processor) replaces `code` nodes with `lang === 'bis-chart'` by an `html` node from `bisChartHtml(loadBis(), { id: 'bis-' + n, zoom: meta.zoom, pillars: meta.pillars })`; `notes/[id].astro` includes `research.css` + `bis-chart.ts` when `note.body.includes('```bis-chart')`; `bis-chart.ts` already initialises every `[data-bis]`. Requires that `bisChartHtml` stays Astro-free, which §4 guarantees.
- Author-owned method copy: singleton `content/research.md` (profile-style collection + `getResearchPage()` in `published.ts`, allow-list in `check-content.ts:178`).
- Pixel-mosaic-by-scroll variant of the achievements reveal (shared `drawPixelated()` extracted from `mosaic.ts`).
- Same-document view-transition handoff of the numeral (`ach-count`).
- CSS `animation-timeline: scroll()` branch under `@supports`.
- `ScholarlyArticle` JSON-LD once the SSRN URL exists (`sameAs`, `citation`).

### Critical Files for Implementation
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/site.config.ts
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/lib/bis.ts (new; parser, validation, lookups, geometry, `bisChartHtml`)
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/pages/research/index.astro (new; page, JSON-LD, method, table, links)
- /Users/huachengt./Sites/sasipat-tejahempinyo/src/scripts/scroll-scene.ts (new; shared `--scene-p` writer) with /Users/huachengt./Sites/sasipat-tejahempinyo/src/pages/achievements/index.astro (rewired to the opener)
- /Users/huachengt./Sites/sasipat-tejahempinyo/scripts/check-content.ts (CSV rule) and /Users/huachengt./Sites/sasipat-tejahempinyo/src/components/Countdown.astro (hardcoded `01 / Achievements`)
# Handoff — achievements (Chapter 01)

## What was built

Pages (`src/pages/achievements/`)
- `index.astro` — timeline: `<ChapterHeader slug="achievements">` (+ one intro paragraph in the slot), `<Filters>`, `<Timeline>`, `<ChapterNext>`. ItemList JSON-LD via Base `jsonLd`; Now indicator text `01 / Achievements / <year>` via Base `now` (updated live by `countdown.ts`). Description and OG image `/og/achievements.png`.
- `[id].astro` — detail page: breadcrumb, mono kicker (date · category), title, result badge, thai line, cover (`<Mosaic>`: landscape photos cropped 2:1 full-width, portrait photos at natural ratio ≤ 560 px, certificate covers uncropped in colour), sticky metadata `dl` (date, organisation, location, result, category link, external link chips) + Byline (`BYLINE.achievements`) + Share / All achievements, body `<Content />`, certificate slot (`<Gallery>`), Connected notes (backlinks with context + related chips from `getGraph()`, plus `<LocalGraph nodeId>` in the right column), prev/next in time, BreadcrumbList JSON-LD, `og:image` = cover via `getImage({ width: 1200, height: 630, fit: 'cover', format: 'jpeg' })`, `type="article"`, `published`. Pagefind: `data-pagefind-body data-pagefind-filter="type:Achievement" data-pagefind-meta/sort="date:YYYY-MM-DD"` on the `<article>`; `data-pagefind-ignore` on the certificate slot, lightbox data, Connected notes and prev/next.
- `_shared.ts` — helpers (sorting, year tabs, category counts, link parsing, graph "connected" lookup, `Slide` type). Underscore = not a route.

Components
- `Timeline.astro` — 12-col grid: sticky aside (cols 1–4, `<Countdown>`) + entries (cols 5–12) grouped by year with a mono year rule; empty-state message with a "Show all" button.
- `Entry.astro` — `article.entry#<id>` with `data-year`, `data-cat`, `data-count`, `view-transition-name: ach-<id>`; mono date (`dateRange`), `Nº NN` (`data-entry-no`, rewritten on filter), h2 title, result badge, org · location, summary, category label (filters in place), thai line, media block (cover 3:2 `<Mosaic>` + up to 3 square thumbs + certificate tile labelled "Certificate"), external link chips, "Details →", "Connected" chips (backlinks + outgoing + graph neighbours, max 4).
- `Filters.astro` — year tabs (All · four most recent years · Earlier, computed from data; today exactly `All · 2026 · 2025 · 2024 · 2023 · Earlier`) and the 8 category chips with counts, all `<button aria-pressed>`; live status "n of N entries" + Clear.
- `Countdown.astro` — numeral (rolling digit slots), year, gold rail with server-rendered 6 px markers (one per entry); phone badge (48 px, bottom-right) + 2 px top progress bar. Whole block `aria-hidden` (the per-entry `Nº` is the AT-visible index).
- `Mosaic.astro` — replaces the stub, same props (`src alt widths? sizes? class? loading? aspect?`) plus optional `photo?` (default true; false = colour/`is-certificate`), `quality?`, `fetchpriority?`. When `aspect` is given the image is cropped at build (`width/height` + `fit="cover"`), so the intrinsic ratio matches the box and the canvas overlay maps 1:1. Explicit `widths` are honoured under the global `layout: 'constrained'`.
- `Gallery.astro` — certificate slot (`#certificate`, always colour, widths `[800, 1600]`, quality 80), part of the page's single lightbox.
- `Lightbox.astro` — imports `photoswipe/style.css` and emits the slide JSON (`getImage()` 1600 w photos / 2000 w certificates, capped at the source width) + a body-order → slide index map.

Scripts (`src/scripts/`, vanilla TS, all honour reduced motion / `data-motion="off"` / `motionchange`)
- `filters.ts` — state in `?year=&cat=` via `history.replaceState`; toggles `hidden` on articles and year groups inside `document.startViewTransition` when available (class `html.is-filtering` scopes the 300 ms `--ease-in-out-quart` group animation and suppresses the root fade); dispatches `ach:filter`; deep links apply on load; entry category labels filter in place; `popstate` re-reads the URL.
- `countdown.ts` — IntersectionObserver (`rootMargin: '-50% 0px -50% 0px'`) picks the entry at the viewport centre; digits roll as two stacked spans (280 ms `--ease-out-expo`, direction flips); year + Now indicator update; rail fill `scaleY` and phone bar `scaleX` follow chapter progress (passive scroll + rAF); markers re-spaced and `Nº` labels rewritten after every `ach:filter`.
- `mosaic.ts` — ≥ 30 % visibility (or a tall image filling 40 % of the viewport) + `img.decode()`, canvas at 1× drawn at 1/64 → 1/32 → 1/16 → 1/8 → 1/4 → full at 110 ms steps, 240 ms fade, removed. The `<img>` is hidden only after the script arms (`is-armed`), so there is no flash and no-JS shows the image. Canvas gets the `.photo` filter so it matches the monochrome image.
- `lightbox.ts` — PhotoSwipe 5 core dynamically imported on first click (16.9 KB gz chunk, only on click), one gallery per page (cover + body photos + certificates), caption element (`Certificate — <title>` / alt), `returnFocus`, `showHideAnimationType: 'none'` under reduced motion; body `<img>`s get wrapped in `<a class="lb-trigger" href=<full>>`.

Styles: `src/styles/achievements.css` (timeline, entry grid, countdown, view-transition scoping, detail page, PhotoSwipe skin). No border radius; photos monochrome via `.photo`, certificates always colour.

## Verification done

- `npx astro build --outDir /tmp/dist-ach` → Complete, 44 detail pages + `achievements.html`. `npx astro check` → no diagnostics in achievements files.
- Playwright (Chromium) at 1280×800 and 375×812 on `/achievements`, `/achievements?cat=athletics`, `/achievements/navy-archer-open-2024`: no console errors / page errors / failed requests; `scrollWidth === 375` at phone width (no horizontal scroll); deep link shows 6 of 44 with the Athletics chip `aria-pressed="true"`; numeral 44 at top → 25 mid-page (year 2025, Now indicator updated), 03/02/01 after `?year=2024&cat=athletics`; empty state + Clear work; phone badge 48×48 bottom-right and 2 px top bar render; lightbox opens 1/6 from the cover, arrows to 5/6 "Certificate — …", Esc closes and focus returns to the trigger. Screenshots: `/tmp/ach-*.png`.
- Built HTML: 2 `loading="eager"` covers, the rest lazy; `sizes="(min-width:1024px) 46vw, 100vw"` on covers; ItemList + BreadcrumbList JSON-LD; `og:image` is a build-time JPEG.
- Budget: the achievements pages load only small inlined module scripts; the only chunk is PhotoSwipe (16.9 KB gz) on first click. `achievements.css` 3.3 KB gz.

## Things the coordinator should know / do

1. **`rehype-gallery` misses runs of embeds** (shared plugin, not edited). `remark-breaks` turns consecutive `![[a.jpg]]\n![[b.jpg]]` lines into one `<p>` with `<br>`s, so `isImageParagraph()` fails and no `.gallery` wrapper / `.is-certificate` figure is emitted (only 5 of 44 built pages contain `gallery-item`). Suggested one-line fix in `src/plugins/rehype-gallery.ts`:
   ```ts
   const isImageParagraph = (n) => n.type === 'element' && n.tagName === 'p' && n.children.length > 0 &&
     n.children.every((c) => isImg(c) || (c.type === 'text' && !c.value.trim()) || (c.type === 'element' && c.tagName === 'br'));
   ```
   and drop `br` children when collecting figures (they are already skipped by `filter(isImg)`). Until then `achievements.css` has a CSS fallback (`.ach-body p:has(> img.vault-img:first-child)` → same 2-col grid, `<br>` hidden, `img[src*="certificate"]` hidden because the certificate slot shows them).
2. `og:image` is exactly 1200×630 only when the cover is ≥ 1200 px wide; Astro's Sharp service never enlarges (e.g. `navy-archer-open-2024-01` yields 1189×630). `Seo.astro` still advertises 1200×630; harmless for scrapers, but if exactness matters, upscale small covers at import time.
3. Dev server: Astro 7's single-instance lock refuses a second `astro dev` in an agent shell. `ASTRO_DEV_BACKGROUND=1 npx astro dev --port 4312 --ignore-lock` runs a foreground server alongside the others.
4. The category link inside entries points at `/achievements?cat=<key>` (works without JS); year breadcrumbs on detail pages use `?year=earlier` for years older than the four tabs.
5. No shared files were edited and no dependencies were added (`photoswipe@5.4.4` was already in `package.json`).

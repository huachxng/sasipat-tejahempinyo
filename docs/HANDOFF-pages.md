# HANDOFF — pages (home, about, contact, 404, JSON-LD)

## Built
| File | What |
|---|---|
| `src/pages/index.astro` | Home: `<HeroGraph />` → `ChapterIndex` → `FeaturedStrip` → `Latest`. Title `Sasipat "Hua" Tejahempinyo — Achievements, Notes & Essays`, JSON-LD Person. Counts come from `getPublished()` (44 entries · 12 notes · 2 essays today) and are passed in as strings. |
| `src/components/ChapterIndex.astro` | Five rows at `--t-1` with mono count, dek and arrow. Numerals carry `view-transition-name: chapter-NN` (same names `ChapterHeader` uses) so they morph on navigation. Hover/focus: numeral gold, arrow `translateX(8px)`. Phones (< 640): numeral stacks above the title and the count drops to its own line, so `Achievements` never breaks mid-word at 375. Prop: `counts?: Partial<Record<ChapterSlug, string>>`. |
| `src/components/FeaturedStrip.astro` | Up to 4 `featured: true` achievements, newest first; cover via `<Mosaic aspect="3 / 2">` (`is-certificate` class when the cover is a certificate so it stays in colour), category · date, title (3-line clamp), `result` as a `.badge`. Prop: `entries` (all achievements), `limit = 4`. Renders nothing when there are no featured entries. |
| `src/components/Latest.astro` | 3 most recent notes/essays by `updated ?? date`; ties → essays first, then title A–Z (stable between builds). Kind · date/`Updated …` · reading time, title at `--t-2`, summary. Props: `notes`, `posts`, `limit = 3`. |
| `src/styles/home.css` | Styles for the three home sections; imported only by `index.astro`. Left columns are one grid column wide (`--col`) so numerals line up with `.ruled` rules. |
| `src/pages/about.astro` | Chapter 03. Names block as a mono `<dl>` (Sasipat "Hua" Tejahempinyo · writes as Noah · Stanford Summer Session attended as Landa Tejahempinyo), profile body via `render(profile)` in `.prose`, Now list (leading "Now — " stripped), Education (empty `()` from the template dropped), Skills + Languages chips, empty ruled portrait slot (desktop only, `aria-hidden`), `Byline` with the legal name, JSON-LD Person, `<ChapterNext current="about" />`. `og:type profile`, image `/og/about.png`. |
| `src/pages/contact.astro` | Chapter 05. Email (mailto + Copy button: Clipboard API → `execCommand` over a selection → leaves the address selected; hidden under `html.no-js`; `role=status` announces the result), GitHub, LinkedIn only when `PERSON.linkedin` is non-empty, `/resume.pdf` "for application readers" with a link to `/resume`, response-time line. No form. |
| `src/pages/404.astro` | `noindex`, `404` at `--t-numeral`, "Page not found", Home chip, a Search chip that forwards to the nav's `[data-search-open]`, `/` and `⌘K` hint, compact chapter list. |
| `src/lib/jsonld.ts` | `person(profile?)`, `breadcrumb(items)`, `itemList(items, opts?)`, `article(input)`, plus `absUrl(href)` and `PERSON_ID`. Plain objects, no Astro imports; JSDoc on each. Other builders: `article({ title, href, published, modified, description, image, tags })` for posts (author defaults to "Noah" → `/about`), `article({ …, type: 'Article', authorName: PERSON.legalName })` for achievements, `itemList` on `/achievements`, `breadcrumb` on detail pages. |

## Verified
- `npx astro build --outDir /tmp/dist-pages` — 0 errors, 17 pages at 22:50 (before the achievements/notes/blog pages landed). **A rebuild at 23:02 fails, outside pages-owned files** — see item 0 below; `404.html` and `about.html` are emitted before the crash, `index.html`/`contact.html` are not because the build aborts at `/achievements/…`.
- `npx astro check` — no diagnostics in pages-owned files (the remaining errors are in `graph.ts`, `scripts/search.ts`, `astro.config.mjs`, owned elsewhere). One intentional deprecation warning: `document.execCommand` in the contact copy fallback.
- Playwright (Chromium 1243) screenshots at 1280×800 and 375×812 of `/`, `/about`, `/contact`, `/404-test` → `/tmp/pages-{home,about,contact,404-test}-{desktop,mobile}.png`. Checked: no console/page errors, no failed requests, `document.documentElement.scrollWidth === innerWidth` at 375 on every page, all `.fade/.reveal` elements reveal after scrolling, JSON-LD parses (`Person` on `/` and `/about`), `robots` is `noindex,nofollow` on 404 and `index,follow` elsewhere, view-transition names present. Script: `pages-shots.mjs` in the session scratchpad (needs `BASE=http://localhost:4316`).
- Reproduce: `npx astro dev --port 4316` then `BASE=http://localhost:4316 node <scratchpad>/pages-shots.mjs`.

## Coordinator, please apply (shared files I do not own)
0. **Build is currently red for every page that calls `getGraph()`** (achievements, notes, blog, graph.json, HeroGraph): `TypeError: Cannot read properties of undefined (reading 'map')` at `src/lib/graph.ts:179` (`pts[0].map` in `layout()`, zero nodes). Root cause is in `src/lib/vault.ts:37`: `CONTENT_DIR` is `fileURLToPath(new URL('../../content/', import.meta.url))`, which survives bundling verbatim (see `.astro/.prerender/chunks/tags_*.mjs`) and from `.astro/.prerender/chunks/` resolves to `<repo>/.astro/content/` — nonexistent — so `getVault()` returns 0 entries at build time (58 at the CLI). Fix: resolve against the project root instead of the module URL, e.g. `resolve(process.cwd(), 'content') + sep` (Astro runs the build from the project root), and have `graph.ts` `layout()` return early when `nodes.length === 0`.
1. **`src/styles/base.css` — prose paragraphs have no spacing site-wide.** `.prose p { margin-block: 0; }` (specificity 0,1,1) outranks `.prose > * + * { margin-top: 1.1em; }` (0,1,0), so every `<p>` gap collapses in notes, posts, achievements and About. Fix:
   ```diff
   -.prose > * + * { margin-top: 1.1em; }
   +.prose > * { margin-block: 0; }
   +.prose > * + * { margin-top: 1.1em; }
   ...
   -.prose p { margin-block: 0; }
   ```
   (`.prose h2/h3/h4 { margin-top: 2em }` and `.prose blockquote { margin: 1.5em 0 }` still win because they are more specific.) `about.astro` carries a scoped workaround `.about-prose > :global(* + *) { margin-top: 1.1em }` with a comment; delete it once base.css is fixed.
2. **Astro 7 dev-server lock.** `astro dev` refuses to start a second server in the same checkout ("Dev server already running at … pid …") and `astro dev stop` from any builder kills whoever started first. Builders running concurrently need `npx astro dev --port <port> --ignore-lock`. Worth adding to the brief.
3. The session scratchpad is shared between the parallel builders: files named `shots.mjs` / `dev.log` were overwritten mid-run by another builder. Prefix scratch files with the area name.

## Notes for other builders
- `HeroGraph` is rendered first inside `<main>`, which has `padding-top: var(--nav-h)` from base.css; the home page adds nothing above it. The chapter index starts `clamp(24px, 6vh, 96px)` below the hero (`.home-sec:first-of-type`).
- `ChapterIndex` is the only place besides `ChapterHeader` that sets `view-transition-name: chapter-NN`; do not add those names elsewhere or the transition is skipped for duplicate names.
- Home JS added by these pages: none (the pages ship no client script; contact and 404 each have a tiny inline module).

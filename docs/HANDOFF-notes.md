# Handoff — notes (Chapter 02: Notes & Blog, tags, RSS, search, comments)

## What was built

| File | Purpose |
|---|---|
| `src/pages/notes/index.astro` | Chapter 02 landing. `<ChapterHeader slug="notes">` with tabs **Notes · Blog** (client-side; URL mirrors as `?tab=blog`, arrow keys move between tabs, both panels render without JS). `<section id="graph">` wraps `<Graph2D />`; the note list (recently updated first, **A–Z** toggle with `aria-pressed`) is the accessible equivalent; tag cloud with counts (tags used once folded into a native `<details>`); essays grouped by year in the Blog panel. |
| `src/pages/notes/[id].astro` | Note page: `02 Notes` eyebrow, title (`--t-2`), `thai` subtitle, mono `Note · updated YYYY-MM-DD · by Noah` via `<Byline>`, tag chips, body in `.prose`, then `<Backlinks>` (Linked from with context sentence · Links to · Related by tag, top 5 by shared-tag weight), `<LocalGraph nodeId="notes/<id>">`, "Open in graph →" (`/notes?focus=notes/<id>#graph`), `<Comments />` only when `comments: true`. JSON-LD `Article` (author Noah) + `BreadcrumbList`; og:image from the cover via `getImage` 1200×630 when present, else `/og/notes.png`. |
| `src/pages/blog/index.astro` | Essays grouped by year with summary, cover thumbnail, tags, reading time, RSS chip; same tab strip as `/notes` (links). |
| `src/pages/blog/[id].astro` | Essay page: mono `Essay 02 · Sep 2026` eyebrow, byline `Essay · date · by Noah · N min read (· updated …)`, cover through `<Mosaic>` when present, share row (copy link + `navigator.share`), Links to / Related notes / LocalGraph, prev/next essay, `<Comments />` by default, JSON-LD `BlogPosting` (author Noah, wordCount, timeRequired) + breadcrumbs, og:image via `getImage`. |
| `src/pages/tags/[tag].astro` | One tag page per tag from `allTags()` over published notes, posts and achievements (`category/*` skipped). Notes, essays and achievements in one list with kind labels; counts in the header; all-tags cloud at the bottom with the current tag marked. |
| `src/pages/rss.xml.ts` | `@astrojs/rss` feed of essays: title, pubDate, description = summary, link, author "Noah", categories = tags, `<language>en</language>`. |
| `src/components/SearchDialog.astro` + `src/scripts/search.ts` | Native `<dialog>`; delegated click on `[data-search-open]` / `[data-search-close]` / backdrop; loads `/pagefind/pagefind-ui.css` + `pagefind-ui.js` on first open only; `--pagefind-ui-*` mapped to tokens plus dark overrides for the UI classes; `processResult` strips `.html` (build.format `file`); friendly status line when the index is missing (dev). Page scroll is locked while open. |
| `src/components/Comments.astro` | giscus section "Discussion" + mono "Sign in with GitHub to comment" + "Open on GitHub →"; script injected by IntersectionObserver at 800 px with the exact attribute set from spec §9.4 (`data-theme` = `SITE_URL/giscus.css`). With `GISCUS.repoId` empty: heading + "Comments open once discussions are enabled" + link to the repo's discussions, no script. |
| `src/components/Backlinks.astro` | Connections block for a graph node id (`relatedKinds`, `relatedTitle`, `limit` props). Weight = Σ 1/(members−1) over shared tags (rarer tags count more, same as the graph's tag-edge weight). |
| `src/components/TagList.astro` | Chips → `/tags/<tag>`; optional `counts` and `active`. |
| `src/components/NoteCard.astro` | List row (`<li>`) for notes, essays and achievements: kind label, mono meta, title, `thai`, summary, tags, optional cover thumbnail (`.photo`), `data-title`/`data-date` for client sorting. |
| `src/styles/notes.css` | Page layout for the chapter (tabs, graph panel 40vh/60vh, lists, year groups, entry header/body/links, pager, share row, tag fold). |
| `public/giscus.css` | giscus theme on the dark tokens as literal hex (`#0a0a0b`, `#121214`, `#1a1a1d`, `#f2f0ea`, `#a8a59d`, `#7c7a74`, `#3a3a40`, `#e8b84a`, `#f6d36b`, `#8a6d2b`), variable names from giscus `dark.css`; `rounded-*` utilities zeroed. |

Pagefind markup: `<article data-pagefind-body data-pagefind-filter="type:Note|Essay" data-pagefind-meta="date:YYYY-MM-DD" data-pagefind-sort="date:YYYY-MM-DD">` on note and essay pages; the eyebrow, byline and tag chips inside the header, the connections block, share row and comments carry `data-pagefind-ignore` so excerpts start with the prose (the `<h1>` stays indexed and becomes the result title). Nav and footer are outside the body element so they are never indexed. The dialog's search scope reads "notes · essays · achievements".

## How to verify

```
VAULT_DIR="$PWD/content" npx astro build --outDir /tmp/dist-notes   # see "Coordinator actions" 1 for why VAULT_DIR
npx astro preview --port 4323 --host 127.0.0.1 --outDir /tmp/dist-notes
```
Then open `/notes`, `/notes?tab=blog`, `/notes?focus=notes/bubble-intensity-score#graph`, `/notes/bubble-intensity-score`, `/blog`, `/blog/what-replicating-a-bubble-indicator-taught-me-about-data`, `/tags/archery`, `/rss.xml`; press `/` and type "bubble" (results + a **type** filter appear).

Checked on this machine with Playwright (Chromium) at 1280×800 and 375×812: HTTP 200, no horizontal scroll, no console errors other than `/_vercel/insights/script.js` 404 (Vercel Analytics, only exists on Vercel); tabs, sort toggle, dialog open/close, search results, `?focus=` propagation all pass. `astro check` reports no errors in the files above. `xmllint` confirms `/rss.xml` is well-formed with 2 items. Pagefind indexed 14 pages (12 notes + 2 essays; achievements join once they carry `data-pagefind-body`, see below).

Note: Astro 7 allows one dev server per checkout; `astro dev --port 4313` refused to start while another builder's dev server was up, so verification used `astro preview` of the build output (which is also the only way to exercise the real Pagefind index).

## Coordinator actions

1. **`src/lib/vault.ts` (shared, not mine) — required for any prerendered page that calls `getVault()`/`getGraph()`.** `CONTENT_DIR` is resolved from `import.meta.url`, which inside the prerender bundle is `.astro/.prerender/chunks/…`, so `../../content/` points at `.astro/content/`, the vault is empty and `graph.ts → layout()` throws `Cannot read properties of undefined (reading 'map')` on the first note/essay page. Dev is unaffected (vite-node keeps the source URL). Fix:
   ```diff
   -export const CONTENT_DIR = process.env.VAULT_DIR ? resolve(process.env.VAULT_DIR) + sep : fileURLToPath(new URL('../../content/', import.meta.url));
   +export const CONTENT_DIR = process.env.VAULT_DIR ? resolve(process.env.VAULT_DIR) + sep : resolve(process.cwd(), 'content') + sep;
   ```
   (`fileURLToPath` import becomes unused.) Until it lands, build with `VAULT_DIR="$PWD/content"`.
2. **`src/lib/graph.ts` (hero) — defensive:** `layout()` should early-return when `nodes.length === 0` so an empty vault produces an empty graph instead of a crash.
3. **`Graph2D` (hero):** the page is static, so `focus` cannot be passed as a prop from `?focus=`. `notes/index.astro` runs an inline script before any module script that copies `?focus=` onto `data-focus` of both the wrapper `[data-graph-panel]` and the component's root element (`[data-graph-panel] > *`). Read either, or read `location.search` directly. The wrapper `.graph-panel` provides the 40vh / 60vh minimum height.
4. **Achievements pages (achievements builder):** to appear in search add `data-pagefind-body data-pagefind-filter="type:Achievement" data-pagefind-meta="date:YYYY-MM-DD" data-pagefind-sort="date:YYYY-MM-DD"` to the detail page's `<article>` (inline `key:value` syntax is what the notes pages use), and `data-pagefind-ignore` on any gallery/lightbox/comments regions. `<Comments />` is not used on achievements per spec.
5. **`vercel.json` (spec §5/§9.4):** add the `Access-Control-Allow-Origin: https://giscus.app` header for `/giscus.css`; without it giscus silently falls back to its built-in theme.
6. **`site.config.ts`:** fill `GISCUS.repoId` / `categoryId` after enabling Discussions (the spec suggests a separate public repo; the placeholder link currently points at `huachxng/sasipat-tejahempinyo/discussions` as briefed — update `GISCUS.repo` if the comments repo differs).
7. **Content conventions worth telling the author:** both essays repeat the title as a `# Heading` on the first body line; the pages detect and hide that duplicate (`has-dup-h1`), but removing it from the Markdown is cleaner. No note has a `thai` field yet (the subtitle slot is wired). Nested tags (`a/b`) would need `[...tag].astro`; none exist today.
8. Sitemap already excludes `/tags/*`; tag pages stay indexable.

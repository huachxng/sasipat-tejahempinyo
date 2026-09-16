# Build brief for parallel builders (read fully before writing code)

Repo: `~/Sites/sasipat-tejahempinyo` (Astro 7.3.2, Node 24, static output, Vercel). Design spec: `docs/superpowers/specs/2026-09-16-portfolio-site-design.md` (read the sections for your area). Content lives in `content/` (Obsidian vault) and is already populated: 44 achievements, 12 notes, 2 essays, `profile.md`, 88 images in `content/media/`.

## Ground rules
- You share one checkout with five other builders. **Only create or edit the files you own** (table below). If you need a change to a shared file, append the exact diff you want to `docs/HANDOFF-<your-area>.md` and work around it locally; the coordinator applies it.
- Never edit anything under `content/` (author-owned), `src/site.config.ts`, `src/schemas/`, `src/content.config.ts`, `src/lib/{vault,wikilinks,tags,media,published,dates,redirects}.ts`, `src/plugins/`, `src/layouts/Base.astro`, `src/components/{Nav,Footer,Seo,ChapterHeader,ChapterNext,Byline,NowIndicator}.astro`, `src/styles/{tokens,base,motion,print}.css`, `astro.config.mjs`, `package.json` (unless your brief says you may add a dependency; then run `npm install <pkg>@<exact>` and note it in your handoff).
- Build with your own output dir so concurrent builds do not clobber each other: `npx astro build --outDir /tmp/dist-<area>`; dev server on your own port: `npx astro dev --port <port>` (hero 4311, achievements 4312, notes 4313, resume 4314, quality 4315, pages 4316). If the content store throws a transient error because another build is syncing, wait 10 s and retry once.
- Read collections ONLY through `getPublished()` / `getProfile()` in `src/lib/published.ts`. Never call `getCollection` directly.
- TypeScript: strict, `verbatimModuleSyntax`, erasable syntax only (no enums, no parameter properties). Import local TS with the `.ts` extension. Client scripts go in `src/scripts/*.ts` and are referenced with `<script src="../scripts/x.ts"></script>` from components (Astro bundles them) or inline `<script>` in a component.
- Vanilla TS only on the client: no React/GSAP/Lenis/Three. Budgets: home JS ≤ 60 KB gz; any single client chunk ≤ 30 KB gz.
- Accessibility: keyboard reachable, visible focus (`:focus-visible` is global), `aria-pressed` on toggle chips, native `<dialog>` for modals, canvases `aria-hidden` with a text equivalent, contrast on dark.
- Motion: honour `prefers-reduced-motion` AND `html[data-motion="off"]` (footer toggle; a `motionchange` event fires on `window` when it flips). Helper: `const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'`.
- Styling: use the tokens in `src/styles/tokens.css` (`--bg --bg-2 --bg-3 --fg --fg-2 --fg-3 --rule --rule-strong --edge --gold --gold-2 --gold-dim --gold-ink`, type scale `--t-hero --t-1 --t-2 --t-3 --t-body --t-small --t-label --t-numeral`, fonts `--font-display` (Inter Tight) `--font-text` (Inter) `--font-mono` (JetBrains Mono), easings/durations). Utility classes in `base.css`: `.container .grid .section .section--tight .ruled .rule .label .mono .chip .badge .marker .thai .prose .display .t-1 .t-2 .t-3 .numeral .small .muted .photo .reveal .fade .stagger .sr-only`. No border radius anywhere. Photos are monochrome via `.photo` until hover; certificates always colour (`.is-certificate`).
- Layout: wrap pages in `<Base title=... active=<chapter slug> description=... image=... jsonLd=...>` (see `src/layouts/Base.astro` props). Chapter pages start with `<ChapterHeader slug="achievements" />` and end with `<ChapterNext current="achievements" />`.
- Images: `entryMedia(entry.data, entry.body)` in `src/lib/media.ts` returns `{ cover, certificates, gallery }` with `ImageMetadata` for `<Image>`/`<Picture>` from `astro:assets`. Body Markdown renders with `const { Content } = await render(entry)` from `astro:content`; images inside are already optimised and wrapped by `rehype-gallery` into `<div class="gallery">` figures.
- Graph data: `getGraph()` in `src/lib/graph.ts` → `{ nodes, edges, hubs, tags, backlinks: Map<nodeId, Backlink[]>, outgoing, tagsOf, neighbors }`; node ids look like `notes/<id>`, `blog/<id>`, `achievements/<id>`, `tag:<name>`.
- Dates: `dateRange(date, endDate, dateText)`, `monthYear`, `isoDate`, `longDate`, `readingTime` in `src/lib/dates.ts`.
- Names: bylines from `BYLINE` in `site.config.ts` (notes/blog → "Noah"; achievements/resume/about → legal name). Categories → labels via `CATEGORIES`.
- Every builder finishes with: `npx astro build --outDir /tmp/dist-<area>` passing with zero errors, `npx astro check` showing no new errors in your files, and a short `docs/HANDOFF-<area>.md` (what you built, how to verify, anything the coordinator must do).

## Ownership
| Area | Owns |
|---|---|
| hero | `src/lib/graph.ts` (keep existing exports/shapes; may add), `src/pages/graph.json.ts`, `src/components/{HeroGraph,HeroGraphSvg,Graph2D,LocalGraph}.astro`, `src/scripts/{hero-graph,graph-render,graph-2d}.ts`, `src/styles/hero.css` |
| achievements | `src/pages/achievements/**`, `src/components/{Timeline,Entry,Filters,Countdown,Mosaic,Gallery,Lightbox}.astro`, `src/scripts/{countdown,filters,lightbox,mosaic}.ts`, `src/styles/achievements.css` |
| notes | `src/pages/notes/**`, `src/pages/blog/**`, `src/pages/tags/**`, `src/pages/rss.xml.ts`, `src/components/{Backlinks,TagList,SearchDialog,Comments,NoteCard}.astro`, `src/scripts/search.ts`, `public/giscus.css`, `src/styles/notes.css` |
| resume | `src/pages/resume.astro`, `src/pages/resume.json.ts`, `src/lib/resume.ts`, `scripts/resume-pdf.mjs`, `src/assets/fonts/**`, `src/styles/resume.css`, `tests/unit/resume.test.ts` |
| quality | `scripts/{check-content,check-dist,shrink-images}.ts`, `tests/**` (except resume.test.ts), `vitest.config.ts`, `playwright.config.ts`, `.size-limit.json`, `lighthouserc.json`, `.github/workflows/**`, `mac/**` |
| pages | `src/pages/{index,about,contact,404}.astro`, `src/components/{ChapterIndex,FeaturedStrip,Latest}.astro`, `src/lib/jsonld.ts`, `src/styles/home.css` |

Component interfaces that cross areas (stubs exist now; the owner replaces the file, keeping the props):
- `<HeroGraph />` (hero) — no props; full-height home hero including the wordmark.
- `<Mosaic src alt widths? sizes? class? loading? aspect? />` (achievements) — optimised image with pixel-mosaic reveal.
- `<Graph2D focus? />` (hero) — the 2D interactive graph panel for `/notes`.
- `<LocalGraph nodeId />` (hero) — static SVG of a node and its neighbours for note/achievement pages.
- `<Comments />` (notes) — giscus section; reads `Astro.url.pathname`.

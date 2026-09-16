# Portfolio site design (approved base + overrides)

**Overrides applied after the design pass (client decisions on 2026-09-16 evening):**
- Repository is **public**: `huachxng/sasipat-tejahempinyo`. Giscus therefore uses this repo's own Discussions (no separate comments repo). Because the repo is public, truly private text lives in `content/_private/` (git-ignored) and `publish: false` remains the site-level switch.
- Project name / URL: `sasipat-tejahempinyo` → https://sasipat-tejahempinyo.vercel.app. Local checkout: `~/Sites/sasipat-tejahempinyo`.
- Public email: s.tejahempinyo@gmail.com. Contact shows email, LinkedIn (when live) and GitHub only.
- No headshot exists (the file thought to be one is a certificate). Hero is purely typographic + graph; About has no portrait until the client adds one.
- Client approved: seeding all content from their documents, building overnight, deploying to Vercel via the CLI login on this Mac.
- Photo policy: official group/ceremony photos OK; candid close-ups of children skipped; anything with ID data excluded; four photos with drawn-on arrows and three certificates needing redaction are held back (listed in `content/_inbox/Review checklist.md`).
- Resume shows GPA 3.98 and "13 APs, five 5s", no SAT/TOEFL scores.

The original synthesized design follows.

---

# Final Design — Sasipat "Hua" Tejahempinyo portfolio + notes site

Provenance: base = Proposal A (winner, 2 of 3 judges). Grafted from B: hero choreography (poster→canvas crossfade, time-based damping, idle tour, scroll recede), entry-count countdown numeral + gold rail, year tabs with query-string state, cross-document view transitions, static local-graph SVG + backlink context sentences, size-limit + Lighthouse CI, GitHub Desktop as the publish tool, allow-list ingest with auto-orient, resting "Now" line. Grafted from C: committed `.obsidian/types.json` with flat frontmatter, tag hub nodes (≥7 members), math + Obsidian line-break parity, `previousSlugs` redirects, NFC/lowercase link lookup with exact-case image checks, `check-dist` post-build scan, content-check GitHub Issue, footer motion toggle, certificate/cover by filename convention. Fixed from A: Obsidian Git dropped (stages the whole parent repo), resume PDF moved into the Vercel build (no bot commits, no double deploy), math rendering added, hash filter state replaced, tag-clique hairball removed, phone hero legibility, unbalanced `%%` detection, cross-collection name collisions. All package versions below were re-checked against the npm registry on 2026-09-16; the client's Mac was inspected the same day. Fact-check pass applied 2026-09-16 (eight claims run against package sources, registry and vendor docs): web fonts moved from the network Fontsource provider to Astro's local provider over pinned `@fontsource-variable` packages; `image.layout: 'constrained'` made explicit so Markdown/wikilink embeds get srcset; the in-repo vault plugin renamed `remark-vault` (the unrelated npm package `remark-obsidian` does not handle image embeds and is not used); CORS header added for the giscus theme; hero frame-time figures restated as week-2 hypotheses; Vercel build-cache and Hobby-deploy preconditions pinned; react-pdf guardrails (absolute font paths, explicit Letter) written down.

---

## 1. Goals & non-goals

**Goals (in priority order)**
1. Live at `https://<project>.vercel.app` with polished core by **Oct 20, 2026**; buffer to Nov 1 is content and hotfixes only.
2. The first 90 seconds of an admissions reader on a laptop: giant grotesk wordmark + a live 3D graph of the client's real notes (visible as a server-rendered SVG before any JS), a numbered chapter index, then an Achievements timeline that conveys volume and recency by scrolling alone.
3. Content-only authoring: the client writes Markdown in Obsidian (vault = `content/` inside the repo), drops images, ticks `publish`, and pushes with GitHub Desktop. Every author convention fits on one page (`content/README.md`).
4. Drafts never leak: opt-in `publish: true`, a single `getPublished()` accessor enforced by a test, a post-build scan of the real `dist/`, and a **private** site repo.
5. One source of truth for achievements → timeline, detail pages, graph nodes, resume page and resume PDF.
6. Hard constraints honoured: static-only, free tier, no server/DB; LCP < 2.5 s on 4G; home-page JS ≤ 250 KB gz (target ≤ 60 KB; hero renderer is ~8 KB and needs no WebGL); keyboard + AA on dark; WebGL-free and reduced-motion paths are the same server-rendered page.

**Non-goals (deferred to the post-launch backlog, §16)**
Three.js/WebGL renderer, bloom or post-processing; free pan/zoom in the 2D graph; note transclusion (`![[Note]]`); per-page generated OG cards; notes RSS; contact form; light theme; Thai localisation; podcast video hosting (always linked out); Obsidian Git one-key publishing; real HTTP 301s via the Vercel adapter.

---

## 2. Stack (with versions, pinned exact in package.json, lockfile committed)

| Package | Version (checked 2026-09-16) | Role |
|---|---|---|
| Node.js | 24.16.0 on the client's Mac (nvm, default `lts/*`); `engines.node` `24.x`; `.nvmrc` = `24` | Runtime; Vercel default 24.x; native TypeScript stripping runs `scripts/*.ts` without a build step. Verified: Node 24 type stripping is stable and warning-free since 24.12; `.ts` specifiers are mandatory; erasable syntax only |
| astro | 7.3.2 (requires Node ≥ 22.12) | Static generator: content collections (glob loader), Sharp image pipeline, stable Fonts API, static endpoints, static redirects. `image: { layout: 'constrained' }` is set in `astro.config.mjs` — Caveat: Astro's default `image.layout` is `none`, which gives Markdown/wikilink embeds a single WebP with **no srcset**; the responsive guarantee depends on this one config line |
| @astrojs/markdown-remark | 7.3.1 | `markdown.processor = unified({...})` — the `unified` helper is imported from `@astrojs/markdown-remark` (not the `unified` npm package) so our remark plugins run (Astro 7's default Sätteri engine is not used). Verified in the shipped dist: user remark plugins run **before** `remarkCollectImages`, so mdast `image` nodes we create with relative urls are imported and transformed by Sharp |
| @astrojs/sitemap | 3.7.4 | `sitemap-index.xml` |
| @astrojs/rss | 4.0.19 | `/rss.xml` (blog) |
| @astrojs/check + typescript | 0.9.10 + **5.9.3** (peer range is `^5 \|\| ^6`; npm `latest` TS 7.0.2 would fail) | `astro check` in CI |
| sharp | 0.35.4 | Astro image service (WebP, EXIF stripped — Verified: Astro's Sharp service calls no `withMetadata()/keepMetadata()`, so metadata is dropped by Sharp's default) + import/shrink scripts |
| d3-force-3d | 3.0.6 | Build-time 3D and 2D force layouts (`numDimensions`), deterministic default LCG |
| yaml | 2.9.1 | Frontmatter parsing in `src/lib/vault.ts` and scripts |
| github-slugger | 2.0.0 | Entry ids and `[[Note#Heading]]` anchors identical to Astro's heading ids |
| unist-util-visit | 5.1.0 | Tree walking in `remark-vault` |
| remark-math + rehype-katex + katex | 6.0.0 + 7.0.1 + **0.16.47** (rehype-katex depends on `katex ^0.16`; pin 0.16.x so one copy serves both render and CSS) | `$…$` / `$$…$$` for the quant/econ notes |
| remark-breaks | 4.0.0 | Obsidian "Strict line breaks OFF" parity (single newline = `<br>`) |
| remark-obsidian-callout | 1.5.1 | `> [!note]` callouts (deps `unist-util-visit ^5`, `mdast-util-to-string ^4`) |
| tinyglobby | 0.2.x | File discovery in scripts (same globber Astro uses) |
| node-html-parser | 9.0.4 | `check-dist.ts` internal link crawl |
| astro-pagefind + pagefind | 2.0.1 + 1.5.2 (peer `astro ^7` confirmed) | Static full-text search, index built at `astro:build:done` |
| photoswipe | 5.4.4 | Lightbox (keyboard, pinch, focus trap), dynamic import on first click |
| @vercel/analytics | 2.0.1 | `<Analytics/>` from `@vercel/analytics/astro` |
| @react-pdf/renderer + react | 4.9.0 + 19.3.0 (pure JS: pdfkit 0.20.1, fontkit, yoga-layout 3.2.1 wasm — Verified: no native modules anywhere in the tree) | `scripts/resume-pdf.mjs` in `postbuild` renders `dist/resume.pdf`; React is used only in that Node script. ESM-only since 4.0 (`React.createElement`, no JSX); `Font.register` takes **absolute** paths; `<Page size="LETTER">` must be explicit (default is A4). Caveat: react-pdf's own compatibility matrix lists Node 18/20/21 only; the one live regression (pdfkit 0.20.1 export map, PR #3550) affects only nft-traced serverless bundles, never a plain `node script.mjs` in the build step — so the PDF must stay in `postbuild`, never in a Vercel Function |
| vitest | 5.0.1 | Unit tests |
| @playwright/test + @axe-core/playwright | 1.63.0 + 4.13.0 | E2E smoke, fallback modes, keyboard, axe AA (CI only) |
| size-limit + @size-limit/file | 14.0.0 | JS/CSS budgets (CI) |
| @lhci/cli | 0.15.1 | Lighthouse budgets on `/`, `/achievements`, `/notes` (CI) |
| Fonts | Astro Fonts API with **`fontProviders.local()`** over the pinned packages `@fontsource-variable/{inter-tight,inter,jetbrains-mono}` 5.3.0 (variable woff2, latin, `weight: '100 900'`; JetBrains Mono `'100 800'`): Astro copies them to `_astro/fonts/` (self-hosted), emits `<link rel=preload>` for `<Font preload />`, and generates capsize size-adjusted fallbacks. No network at build time. Static `Inter-Regular.ttf` + `Inter-SemiBold.ttf` (OFL) in `src/assets/fonts/` for react-pdf, which supports TTF/WOFF only, not variable fonts. Caveat: the network `fontProviders.fontsource()` was dropped — its default `weights: ['400']` yields static 400 normal + italic files (variable files only when weights are range strings), `preload` is opt-in and preloads every file of the family, unifont's metadata cache expires after one week, and a cold cache plus a Fontsource/jsDelivr outage fails the build hard (`CannotFetchFontFile`) with no built-in fallback | |
| giscus | hosted `client.js` (no npm) | Comments via GitHub Discussions in a separate public repo; theme served from `/giscus.css` with an `Access-Control-Allow-Origin: https://giscus.app` header (§5, §9.4) |
| GitHub Desktop | current (`brew install --cask github`; not yet installed) | The author's publish tool |
| Obsidian + community plugin Image Converter | plugin id `image-converter` 1.4.6 (manifest verified) | Shrink/rename images on drop |
| GitHub Actions | `actions/checkout@v7`, `actions/setup-node@v7` | Two workflows (§11, §14) |
| Vercel Hobby | Git integration, framework preset Astro, no adapter, default Install Command (`npm install`, never `npm ci`), Build Command `npm run build` | Hosting, Web Analytics (50k events/month) |

Not used, deliberately: Three.js (backlog), GSAP, Lenis, force-graph, satori/resvg, the Vercel adapter, Obsidian Git, gray-matter, tsx, the npm package `remark-obsidian` (1.12.1 — Verified by running it: `![[img.jpg]]` becomes an `html` node reading "Note not found" and `![[cert.png|300]]` a bogus `<a href="/cert.png">`; it never creates an mdast `image` node, so nothing would reach Sharp — our in-repo `src/plugins/remark-vault.ts` handles all vault syntax instead), the network `fontProviders.fontsource()`.

---

## 3. Repo layout

```
hua-site/                              # PRIVATE GitHub repo (huachxng/hua-site); Vercel builds main
├─ content/                            # THE OBSIDIAN VAULT — the only folder the author touches
│  ├─ .obsidian/                       # committed: app.json, appearance.json, core-plugins.json,
│  │                                   #   community-plugins.json, templates.json, types.json, hotkeys.json,
│  │                                   #   plugins/image-converter/data.json
│  │                                   # gitignored: workspace*.json, cache/
│  ├─ _templates/                      # Note.md, Essay.md, Achievement.md (publish: false prefilled) — never built
│  ├─ _inbox/                          # scratch — never built
│  ├─ notes/                           # evergreen notes (subfolders allowed; URLs stay flat)
│  ├─ blog/                            # dated essays, byline "Noah"
│  ├─ achievements/                    # one .md per achievement (~35)
│  ├─ media/                           # every image (Obsidian's attachment folder); referenced by filename
│  ├─ profile.md                       # frontmatter = names/school/links/skills/now; body = About prose
│  └─ README.md                        # the one-page authoring guide
├─ public/
│  ├─ og/ default.png achievements.png notes.png about.png resume.png   # 1200×630, hand-made once
│  ├─ grain.png                        # 256×256 mono noise tile (~10 KB)
│  ├─ giscus.css                       # giscus theme mapped to site tokens (literal hex values; served with CORS header from vercel.json)
│  ├─ robots.txt  favicon.svg  favicon.ico  site.webmanifest
├─ src/
│  ├─ content.config.ts                # 4 collections (glob loader) using src/schemas
│  ├─ schemas/ common.ts note.ts post.ts achievement.ts profile.ts   # zod v4 (astro/zod), erasable TS only, shared with scripts
│  ├─ site.config.ts                   # site URL, names/bylines, chapters[], category labels, resume section map, giscus ids
│  ├─ lib/
│  │  ├─ vault.ts                      # scans content/**: NFC+lowercase basename index → {collection,id,publish,path}; media index
│  │  ├─ wikilinks.ts                  # parse/resolve [[..]], [[..|alias]], [[..#h]], [[folder/Name]], ![[img|300]]
│  │  ├─ tags.ts                       # frontmatter + inline tag union, normalisation
│  │  ├─ graph.ts                      # nodes/edges/hubs/backlinks (+ context sentences) + d3-force-3d layouts; memoised per build
│  │  ├─ published.ts                  # getPublished(collection) — the ONLY collection accessor pages may use
│  │  ├─ media.ts                      # import.meta.glob('/content/media/**') → ImageMetadata by filename; cover/certificate resolution
│  │  ├─ resume.ts                     # buildResumeModel(achievements, profile)
│  │  ├─ redirects.ts                  # previousSlugs scan used by astro.config.mjs
│  │  └─ dates.ts
│  ├─ plugins/
│  │  ├─ remark-vault.ts               # IN-REPO plugin (not the npm `remark-obsidian`): comments %%..%%, wikilinks, ![[img]] → mdast image nodes, inline #tags, ==highlight==
│  │  └─ rehype-gallery.ts             # wraps runs of image-only paragraphs in <div class="gallery">, lifts the certificate
│  ├─ components/ Nav ChapterHeader ChapterNext GridRules Grain NowIndicator MotionToggle Seo Byline
│  │              HeroGraph (canvas island) HeroGraphSvg (server-rendered poster) Graph2D LocalGraph
│  │              Timeline Entry Filters Countdown Mosaic Gallery Lightbox Backlinks TagList
│  │              SearchDialog Comments Footer
│  ├─ layouts/ Base.astro Chapter.astro Article.astro
│  ├─ pages/
│  │  ├─ index.astro  about.astro  resume.astro  contact.astro  404.astro
│  │  ├─ achievements/index.astro  achievements/[id].astro
│  │  ├─ notes/index.astro  notes/[id].astro  blog/index.astro  blog/[id].astro  tags/[tag].astro
│  │  ├─ graph.json.ts  resume.json.ts  rss.xml.ts
│  ├─ scripts/ hero-graph.ts graph-render.ts mosaic.ts countdown.ts filters.ts lightbox.ts nav.ts search.ts motion.ts
│  ├─ styles/ tokens.css base.css type.css grid.css motion.css print.css katex.css(re-export)
│  └─ assets/fonts/ Inter-Regular.ttf Inter-SemiBold.ttf         # PDF only (web fonts come from the pinned @fontsource-variable packages)
├─ scripts/                            # run by npm lifecycle, CI or the assistant — never by the author
│  ├─ check-content.ts                 # prebuild: validation + privacy + plain-English report
│  ├─ resume-pdf.mjs                   # postbuild: dist/resume.json → dist/resume.pdf (react-pdf)
│  ├─ check-dist.ts                    # postbuild: leak/PII/link/budget scan of dist/
│  ├─ import-media.ts                  # ONE-TIME migration from the Mac folders
│  └─ shrink-images.ts                 # ad hoc: downsize anything > 2 MB in content/media in place
├─ tests/ unit/*.test.ts  fixtures/vault/**  e2e/*.spec.ts
├─ mac/ Preview Site.command  Check Content.command             # double-clickable for the author
├─ .github/workflows/ content-check.yml  quality.yml
├─ astro.config.mjs  vercel.json  package.json  package-lock.json  tsconfig.json
├─ vitest.config.ts  playwright.config.ts  lighthouserc.json  .size-limit.json
├─ .nvmrc  .gitignore  .gitattributes  .editorconfig  CLAUDE.md (for future assistant sessions)
```

`.gitignore`: `node_modules dist .astro .vercel .DS_Store content/.obsidian/workspace*.json content/.obsidian/cache content/**/*.{pdf,docx,doc,mp4,mov,m4v,heic,zip}`.

The AI assistant never works in the author's checkout. Day 0: `git worktree add ../hua-site-dev -b dev` — code changes happen in `~/Sites/hua-site-dev` on branches; the author's `~/Sites/hua-site` stays on `main` and only ever contains content changes, so GitHub Desktop can never sweep up half-finished code.

---

## 4. Content model & author conventions

### 4.1 Collections (`src/content.config.ts`, glob loader, `base: './content'`)

| Collection | pattern | id |
|---|---|---|
| notes | `['notes/**/*.md', '!**/_*', '!**/_*/**']` | `slugger.slug(data.slug ?? basename)` |
| blog | `['blog/**/*.md', '!**/_*', '!**/_*/**']` | same |
| achievements | `['achievements/**/*.md', '!**/_*', '!**/_*/**']` | same |
| profile | `'profile.md'` | `profile` |

Verified in the loader source: `pattern` is `string | string[]`, `!` negations are supported (tinyglobby set-subtraction), there is **no** built-in underscore skipping outside `src/content` (hence the explicit negations), and the default `generateId` honours `data.slug` — our custom `generateId` replicates that and slugifies it. Ids are unique **per collection** (check-content errors on a duplicate, naming both files). Subfolders inside `notes/` are allowed for the author's organisation; URLs stay flat.

### 4.2 Frontmatter (flat only — Obsidian's Properties UI cannot edit nested YAML)

`content/.obsidian/types.json` is committed so the Properties panel shows checkboxes, date pickers and tag chips:

```json
{"types":{"publish":"checkbox","comments":"checkbox","resume":"checkbox","featured":"checkbox",
"date":"date","endDate":"date","updated":"date","tags":"tags","aliases":"aliases",
"links":"multitext","previousSlugs":"multitext","skills":"multitext","languages":"multitext","now":"multitext","coursework":"multitext",
"title":"text","slug":"text","summary":"text","thai":"text","category":"text","dateText":"text","result":"text","org":"text",
"location":"text","cover":"text","certificate":"text","resumeLine":"text","resumeSection":"text"}}
```

Schemas live in `src/schemas/*.ts` (import `{ z } from 'astro/zod'`, erasable syntax only) and are imported by both `content.config.ts` and `scripts/check-content.ts`, so the author sees one wording everywhere. Verified (Node 24.16 + astro 7.3.2, run locally): the same schema file loads in `defineCollection()`, in `node scripts/check-content.ts` with no flags or warnings, and passes `tsc --noEmit` under `astro/tsconfigs/base`. Two rules keep the "one wording" promise true: (a) **every field carries an explicit author-facing message** (`z.string().min(1, 'Add a title')`, `z.coerce.date({ message: 'Add a date like 2026-09-16' })`), because Astro reformats zod's *default* messages differently from what the script prints (custom messages come through identically in both); (b) `astro/zod` on Astro 7 is **zod v4** (`zod/v4`), so schemas use the v4 API, and type-only imports are written `import type` (`verbatimModuleSyntax` and Node's stripping both require it).

**Common (all three content collections)** — every field optional except where marked:
- `publish: boolean` default **false** — the switch. Without `publish: true` a note appears nowhere (pages, lists, graph, backlinks, search, RSS, sitemap, link targets).
- `title: string` default = file name. `slug: string` pins the URL. `previousSlugs: string[]` — old slugs, each becomes a redirect (§5).
- `tags: string[]` (merged with inline `#tags`). `aliases: string[]` (extra wikilink targets, Obsidian-native).
- `summary: string` — card text, meta description; falls back to the first 160 characters of the body. Length is a warning, never an error.
- `thai: string` — small secondary Thai text.

**notes**: `date` (shown as "updated" if `updated` absent), `updated`, `comments` default false, `cover` (filename in `media/`).
**blog**: `date` **required** (YYYY-MM-DD), `updated`, `cover`, `comments` default true.
**achievements**: `date` **required** (use the 1st when the day is unknown), `endDate`, `dateText` (display override, e.g. `2023–2025`), `category` **required** — one of `academics research ventures leadership athletics arts mathematics camps` (accepted case-insensitively, trimmed; labels in `site.config.ts`: Academics, Research, Ventures, Leadership & Service, Athletics / Archery, Arts & Music, Mathematics, Camps & Summer Programs), `org`, `location`, `result` (short badge: "Bronze", "2× runner-up", "Winner U15W"), `cover`, `certificate`, `links: string[]` written as `Label | https://…` (bare URL → label = domain), `resume` default **true**, `resumeLine`, `resumeSection` (override), `featured` (home strip).
**profile.md**: `name`, `nickname` ("Hua"), `penName` ("Noah"), `stanfordAlias` ("Landa Tejahempinyo"), `school`, `classOf` (2027), `location`, `email`, `links` (`GitHub | url` …), `skills`, `languages`, `coursework` (`AP Calculus BC — 5` …), `tests` (optional, client's choice), `now` (list; drives the Now indicator), `resumeHeadline`. Body = About page prose.

Dates: Obsidian's date picker writes unquoted `2025-08-18`; `z.coerce.date()` accepts quoted strings too.

### 4.3 Drafts — defence in depth
(a) `publish` defaults false; (b) `src/lib/published.ts` is the only accessor — a vitest test greps `src/pages` and `src/components` for `getCollection(` and fails if found; (c) graph.json, poster SVG, backlinks, local graphs, tags pages, RSS, sitemap, resume and Pagefind (indexes built HTML only) all derive from `getPublished()`; (d) a wikilink to an unpublished or unknown note renders as plain text with class `wl-missing` (no href, no title leak); (e) `_`-prefixed files/folders are excluded by glob negation; (f) `scripts/check-dist.ts` greps the real `dist/` for every unpublished title and id after every build; (g) the repo is private, so raw drafts are not on the public internet either; (h) `npm run dev` (`SHOW_DRAFTS=1`) shows unpublished notes with a red DRAFT ribbon locally — Vercel never sets that variable.

### 4.4 Wikilinks
`src/plugins/remark-vault.ts` (in-repo; **not** the npm package `remark-obsidian`, which has no image-embed support) visits **text nodes only** (code, inline code and math are separate mdast nodes, so they are skipped by construction) with `/(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g`.
- Target normalisation: NFC, trim, strip `.md`, lowercase. Lookup order (mirrors Obsidian "shortest path when possible"): exact vault path (`achievements/Navy Archer Open 2024`) → vault-unique basename → alias. A bare basename that exists in two collections is a check-content **error** with the fix "write `[[achievements/Name]]` — Obsidian writes this form for you when the name is ambiguous".
- Route = `/notes/<id>`, `/blog/<id>`, `/achievements/<id>`; `#Heading` → `#` + `githubSlugger.slug(heading)`; `^block` refs drop the hash with a warning; `|alias` is the link text.
- `![[img.jpg]]` / `![[img.jpg|480]]` → a real mdast `{ type: 'image', url, alt }` node whose `url` is the **relative** path from the .md file (`vfile.path`) to `content/media/img.jpg` (+ width attribute) so Astro's Markdown image optimisation processes it. Verified against the Astro 7.3.2 dist: `remarkCollectImages` runs after user remark plugins and collects every `image` node whose url is relative and not `/`-prefixed; `rehypeImages` then routes it through `getImage()`/Sharp (WebP, EXIF stripped). Caveat: srcset/`sizes` are generated **only** because `image: { layout: 'constrained' }` is set in `astro.config.mjs` — with Astro's default `layout: 'none'` each embed would be a single WebP. `remark-vault` must stay ordered before any plugin that converts paragraphs to `html` nodes (callouts). `![[Note]]` renders as a link (transclusion deferred). `![[x.pdf]]` is an error.
- Renames: Obsidian rewrites links ("Automatically update internal links" on). The URL changes unless `slug:` is set; rule in README: "if the note was already public, add the old name to `previousSlugs`".

### 4.5 Comments `%% … %%`, tags, highlights
- `%%inline%%` is removed inside a text node; a block comment (`%%` opening a root-level paragraph … `%%` closing a later root-level paragraph) removes the whole range. `check-content` **errors** on unbalanced `%%` ("everything after line 41 would be hidden") and warns on `%%` inside lists/blockquotes (unsupported; move it to top level).
- Tags: frontmatter `tags` ∪ inline `(^|\s)#([\p{L}\p{N}_/-]+)` (at least one non-digit, not inside code/URLs/headings), lowercased, `/` kept (nested tags stay whole). Achievements get an implicit graph-only tag `category/<category>` (not shown as a chip).
- `==text==` → `<mark>`.

### 4.6 Images
- Obsidian setting: attachments → `media/`. The Image Converter plugin converts drops to JPG q80, longest edge 2000 px, output `media/`, renamed `<note name>-<timestamp>.jpg`.
- **Certificate** = frontmatter `certificate:` if set, else the first embedded image whose filename contains `certificate` (case-insensitive; the import script names them `<slug>-certificate.jpg`; for new ones the author renames the file in Obsidian). **Cover** = `cover:` if set, else the first embedded non-certificate image. **Gallery** = all body embeds in order.
- Size rules (check-content): warn > 2 MB, error > 8 MB with the fix line; the assistant runs `npm run shrink` monthly to downsize anything > 2 MB in place (filenames unchanged, links stay valid). Exact-case existence check for every `cover`/`certificate`/embed filename (macOS is case-insensitive, Vercel's Linux is not).

### 4.7 The complete author convention list (`content/README.md`)
1. Open `content/` as the vault. Notes → `notes/`, essays → `blog/`, achievements → `achievements/`. New notes land in `notes/` (Obsidian default); `_inbox/` is scratch and never published.
2. Start from a template (⌘T): Note / Essay / Achievement. File name = title. A name may repeat across folders, but then link with `[[achievements/Name]]` (Obsidian offers it).
3. **`publish` is the switch.** Tick it in the Properties panel when the note is ready.
4. Drag images into the note; they go to `media/` and become `![[…]]`. The first image is the cover; name the certificate file `…certificate.jpg`.
5. Dates use the date picker (YYYY-MM-DD). `category` is one of the 8 words listed in the template.
6. `%% private notes %%` never render. Never paste ID numbers, passport data, addresses. No PDFs, videos or Office files in the vault — link out (YouTube, SSRN, Drive) via `links`.
7. If you rename a note that is already public, add the old name to `previousSlugs`.
8. Publish = GitHub Desktop → check the Changes list (this is what becomes public) → Summary → **Commit to main** → **Push origin**. The site updates in 2–4 minutes; if the build fails you get an email and a GitHub Issue naming the file and the fix.

---

## 5. Information architecture & routes

Chapters are one array in `site.config.ts`; nav, headers, footer "next chapter" and OG defaults read from it.

| № | Chapter | Route(s) |
|---|---|---|
| — | Home (index) | `/` |
| 01 | Achievements | `/achievements`, `/achievements/[id]` |
| 02 | Notes & Blog | `/notes` (landing: 2D graph + list, tabs Notes · Blog), `/notes/[id]`, `/blog`, `/blog/[id]`, `/tags/[tag]` |
| 03 | About | `/about` |
| 04 | Resume | `/resume`, `/resume.pdf` |
| 05 | Contact | `/contact` |

Also: `/rss.xml`, `/sitemap-index.xml`, `/graph.json`, `/robots.txt`, `/404`. `/resume.json` exists only during the build (deleted by postbuild). Chapter numbers are labels, not URL segments (semantic URLs for SEO); the Pasticcino feel comes from numbered headers, the full-width "Next chapter → 02 Notes & Blog" display link and the view-transition numeral morph.

URL form: Astro `trailingSlash: 'never'`, `build.format: 'file'`; `vercel.json` = `{ "cleanUrls": true, "trailingSlash": false, "headers": [{ "source": "/giscus.css", "headers": [{ "key": "Access-Control-Allow-Origin", "value": "https://giscus.app" }] }] }` so exactly one URL form exists and the other redirects, and the giscus theme stylesheet passes the CORS check (§9.4). Redirects: `astro.config.mjs` calls `previousSlugsRedirects()` (a 50 ms frontmatter scan of `content/**`) and passes `redirects: { '/notes/old': '/notes/new' }`; in static output Astro emits an HTML page with a meta refresh at the old path (verified in the routing docs; no adapter needed). Real 301s via `@astrojs/vercel` are backlog.

Nav (all pages): wordmark `HUA` left; right: `01 Achievements · 02 Notes & Blog · 03 About · 04 Resume · 05 Contact · Search` (numbers 11 px mono gold, labels in text face; active chapter gold with 1 px underline). Bar is transparent until `scrollY > 40`, then `rgba(10,10,11,.72)` + `backdrop-filter: blur(12px)`. < 1024 px: a `Menu` button opens a native `<dialog>` listing chapters at display size with 60 ms stagger; Esc/backdrop closes. Search opens the Pagefind dialog (`/` or ⌘K). Bottom-left **Now indicator** (mono 12 px, the Kalkbrenner "Now playing" slot): resting state = first `profile.now` line ("Now — senior year at BASIS Bangkok · recurve training"); on `/achievements` it shows `01 / Achievements / 2025`; on the home page it shows the hovered graph node's kind while hovering.

Bylines: achievements, resume, about → legal name; notes and blog → "Noah" (one `BYLINE` constant per collection). About contains the Names block: Sasipat "Hua" Tejahempinyo · writes as Noah · enrolled at Stanford Summer Session as Landa Tejahempinyo.

---

## 6. Visual system & design tokens

### 6.1 Colour (`src/styles/tokens.css`, `:root`; dark is the only theme, print overrides to light)
```
--bg: #0A0A0B;        --bg-2: #121214 (cards, dialogs);   --bg-3: #1A1A1D (row hover)
--fg: #F2F0EA (17:1); --fg-2: #A8A59D (8:1, secondary);    --fg-3: #7C7A74 (4.6:1 — only for ≥ 32 px numerals and decorative marks)
--rule: rgba(242,240,234,.12);  --rule-strong: rgba(242,240,234,.28);  --edge: #3A3A40 (graph edges at rest)
--gold: #E8B84A (10.7:1 on --bg; links, hovers, active nodes, markers, focus ring)
--gold-2: #F6D36B (hover);  --gold-dim: #8A6D2B (tag hubs, inactive markers);  --gold-ink: #0A0A0B (text on gold chips)
--focus: 2px solid var(--gold); outline-offset: 3px (every focusable element)
--grain-opacity: .06
print: --paper #FFFFFF, --ink #111111, gold kept only for 1 px section rules
```
Gold is the WA 10-ring yellow warmed toward amber so it stays AAA on near-black at text sizes; it is never used as a background under white text.

### 6.2 Type
Astro Fonts API with **`fontProviders.local()`**: each family is declared with `variants: [{ src: ['./node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' }]` (Inter and JetBrains Mono likewise; JetBrains Mono `weight: '100 800'`; the week-0 spike decides whether the `src` points into the pinned package or at a one-time copy in `src/assets/fonts/`), latin subset, woff2, `display: swap`, `optimizedFallbacks: true` → Astro-generated size-adjusted fallbacks (`size-adjust`, `ascent-override`, `descent-override` from capsize metrics against `sans-serif` / `monospace`). Astro copies the files to `_astro/fonts/` (self-hosted, hashed). `<Font cssVariable="--font-display" preload />` in `Base.astro`; only the `normal` style is declared for the display family, so `preload` emits exactly **one** `<link rel="preload" as="font">` for the LCP face (Verified: `preload` defaults to `false`, and `preload={true}` preloads every file of the family, which is why italics are not declared). The other two families load without preload. Caveat: the network `fontProviders.fontsource()` is deliberately not used — see §2 Fonts row; the build has no font-related network dependency.
- Display: **Inter Tight** variable 500–700 — wordmark, chapter titles, entry titles. Uppercase for wordmark and chapter titles.
- Text: **Inter** variable 400/500 — body, max 68ch, `text-wrap: pretty`.
- Mono: **JetBrains Mono** variable 400/500 — chapter numbers, dates, countdown numeral, filter chips, labels; `font-variant-numeric: tabular-nums`.
- Thai secondary text: `--font-thai: 'Thonburi', 'Sukhumvit Set', sans-serif` (system).

Fluid scale:
```
--t-hero:    clamp(3.25rem, 11.5vw, 13rem)   lh .88  ls -.045em   (wordmark)
--t-1:       clamp(2.5rem, 6.5vw, 6rem)      lh .95  ls -.03em    (chapter titles)
--t-2:       clamp(1.75rem, 3.5vw, 3rem)     lh 1.05 ls -.02em    (entry/note titles)
--t-3:       1.375rem                        lh 1.25
--t-body:    1.0625rem (1.125rem ≥ 1024)     lh 1.6
--t-small:   .875rem;   --t-label: .75rem uppercase ls +.08em (mono)
--t-numeral: clamp(6rem, 16vw, 15rem)        mono 300 tabular     (countdown)
```
Headings `text-wrap: balance`; long words `overflow-wrap: anywhere`; the wordmark wraps to two lines below 640 px and never causes horizontal scroll (tested at 320/375/390/768/1280/1920).

### 6.3 Grid & rules
12 columns ≥ 1024, 6 at 640–1023, 4 below; gutters 24/20/16 px; outer margin `clamp(16px, 5vw, 96px)`; max width 1440 px; 8 px vertical rhythm; section padding `clamp(96px, 14vh, 200px)`. `.ruled` sections draw thin vertical rules at column edges with `background-image: repeating-linear-gradient(90deg, var(--rule) 0 1px, transparent 1px calc(100%/12))` (opacity .6, ≥ 768 px only) plus a 1 px top border; 1 px horizontal rules between rows. No border radius anywhere; 6 px square markers.

Numbered chapters: `<h1><span class="num" aria-hidden="true">01</span><span class="sr-only">Chapter 1: </span>Achievements</h1>` — numeral in `--fg-3` at `--t-1`×1.6, title overlapping it by −.25em on desktop, mono dek beneath, a right-aligned mono `01 / 05` progress mark. Each numeral carries `view-transition-name: chapter-01` (also on the home index row) so it visibly travels on navigation in Chrome/Safari.

### 6.4 Photography & grain
Every photo is monochrome by default: `.photo { filter: grayscale(1) contrast(1.06) }` → `filter: none` on hover/focus-within over 600 ms (`pointer: fine` only); certificates and lightbox images are always in colour. Grain: one 256² PNG tile as a fixed, `pointer-events: none` overlay, `mix-blend-mode: overlay`, opacity .06 (.04 on phones), **static** (animated blended grain forces whole-viewport recomposition; not used). The wordmark has a small inline grainy B&W archery portrait between "SASIPAT" and "TEJAHEMPINYO" (0.62em tall).

### 6.5 Motion tokens
```
--ease-out-expo: cubic-bezier(.16,1,.3,1)     reveals, numeral roll, hero entrance
--ease-out-quint: cubic-bezier(.22,1,.36,1)   hover, colour, scale
--ease-in-out-quart: cubic-bezier(.76,0,.24,1) page transition out, filter reflow
durations: micro 150 ms · small 280 · medium 650 · large 900 · page 220 out / 320 in · stagger 60 ms capped at 6 items
```
- Cross-document view transitions, zero JS: `@view-transition { navigation: auto }`; `::view-transition-old(root)` 220 ms fade + translateY −8 px; `::view-transition-new(root)` 320 ms fade + translateY 12→0; nav and grain carry their own `view-transition-name` so they stay put; chapter numerals morph. Firefox/older browsers simply navigate.
- Headline reveals: chapter titles wrapped in `overflow: hidden`, `translateY(100%) → 0` over 900 ms `--ease-out-expo`, triggered once by IntersectionObserver (`.in` class). No per-line splitting library.
- Pixel-mosaic reveal (`<Mosaic>` around Astro `<Image>`): the real `<img>` is always in the DOM. `mosaic.ts` waits for ≥ 30 % visibility and `img.decode()`, overlays a same-size canvas (device pixels capped at 1×), `imageSmoothingEnabled = false`, draws the image at 1/64, 1/32, 1/16, 1/8, 1/4 then full display size at 110 ms steps (660 ms), fades the canvas out in 240 ms and removes it. Used on the About portrait, achievement covers, blog covers, home featured strip; never on thumbnails or in notes.
- Reduced motion (`prefers-reduced-motion: reduce` **or** `html[data-motion="off"]` from the footer toggle, persisted in `localStorage`, read once in `motion.ts`): hero canvas never mounts (SVG stays, hover/focus gold via CSS), no mosaic, no headline slide (300 ms opacity only), no idle spin/tour, countdown numeral switches instantly, view transitions 0.01 ms, hover colour-in stays (user-initiated), PhotoSwipe `showHideAnimationType: 'none'`, `scroll-behavior: auto`. Nothing loops anywhere on the site except the hero's slow spin when motion is allowed.
- Accessibility: landmarks, skip link "Skip to content", visible gold focus ring, filter chips `<button aria-pressed>`, dialogs are native `<dialog>`, canvases `aria-hidden` with text equivalents, axe pass on six pages.

---

## 7. Home & 3D note-graph hero

### 7.1 Markup (`HeroGraph.astro`, server-rendered)
`<section class="hero">` at `100svh`: (1) the wordmark, line 1 `SASIPAT` + inline portrait + mono superscript `(Hua · writes as Noah)`, line 2 `TEJAHEMPINYO`, `pointer-events: none` so the cursor reaches the canvas; (2) `<HeroGraphSvg/>` — an **inline** `<svg viewBox="0 0 1600 1000">` poster of the graph projected with the exact camera the canvas starts with (yaw .35 rad, pitch −.18 rad, perspective `d = 2.8`): edges as `<line>` (`--edge`, opacity .55), nodes as `<a href={u}><circle r/><title>{t}</title></a>` with opacity .35–1 by depth, the 6 highest-degree nodes gold; the 12 hubs are in the tab order, the rest `tabindex="-1"`; ≈ 33 KB HTML / 7 KB compressed; (3) `<canvas class="hero-gl" aria-hidden hidden>`; (4) `<div class="hg-label" hidden>` label chip; (5) visually hidden `<h2>Most connected notes</h2><ul>` of the 12 hub links and a visible mono link "Explore the 2D map →". Desktop: graph fills the right ~55 %, offset behind the type. **Phones: the graph occupies the top 55 % of the hero on its own, the wordmark sits below on solid `--bg`** — nothing moves behind display type.

LCP is the wordmark text (fallback font paints immediately with `swap`) or the inline portrait; nothing here blocks first paint.

### 7.2 Loading gates (`src/scripts/hero-graph.ts`, ≈ 8 KB gz including the shared renderer)
After `window.load` → `requestIdleCallback(cb, { timeout: 1500 })` (fallback `setTimeout 200`). `cb` mounts only if: motion allowed (no reduced-motion, no `data-motion=off`); `!navigator.connection?.saveData`; hero still ≥ 25 % in viewport. Then `fetch('/graph.json')`, build sprite atlas, render one frame, crossfade (§7.4). DPR = `min(devicePixelRatio, pointer:coarse ? 1.5 : 2)` — an **imposed cap**, not a device default (an iPhone SE 2/3 is natively DPR 2, so its canvas backing store is rendered at 1.5× and upscaled); the fallback if the week-2 measurement misses budget is a second cap of 1. `hardwareConcurrency ≤ 4` or coarse pointer → 30 fps cap. Power behaviour (WebKit guidance: continuous canvas painting keeps CPU + GPU active, so the loop must idle, not just be cheap): IntersectionObserver pauses the loop when < 5 % visible; `visibilitychange` pauses; `pagehide` releases; after 20 s without pointer/touch input the loop drops to 30 fps (the idle tour and slow spin still run at that rate); at scroll-recede `p ≥ 1` the loop stops entirely. Caveat: a rAF loop at 2–4 ms/frame is a small but nonzero, measurable energy cost, and Safari's Low Power Mode will throttle it to 30 fps on its own — the design accepts this on the home hero only.

### 7.3 Renderer (Canvas 2D, `graph-render.ts`, shared with the 2D view)
Per frame: rotate each `p3` by `Ry(yaw)·Rx(pitch)`, perspective scale `s = 2.8 / (2.8 + z)`, screen = centre + `[x, y]·s·R`. Depth-sort back to front. Draw order: tag-spoke edges (`--edge` at α .10·depth), link edges (α .28·depth), small-clique tag edges (α .14), then nodes via `drawImage` from a pre-rendered sprite atlas (a soft-edged disc with a subtle radial highlight — the "instanced sphere" look — in off-white, warm grey for achievements, gold, gold-dim ring for tag hubs) at radius `(1.6 + .9·log2(1 + degree))·s`, alpha .35–1 by depth (the fog). Edges are **batched**: depth alpha is quantised to 8 bins per edge kind and every edge in a bin goes into one path, so the ~460 edges cost ≈ 24 `beginPath`/`stroke` calls rather than 460 per-edge `strokeStyle`/`globalAlpha` state changes (the per-call state change, not the sprites, is the expected dominant cost). No `shadowBlur` anywhere. Glow = one additive sprite (`globalCompositeOperation: 'lighter'`) at 3× radius under the highlighted node. About 110 nodes and 460 edges per frame. Frame budget — **hypothesis, not yet measured**: ≤ 2 ms on a 2020 laptop, ≤ 4 ms on an iPhone SE 2/3 at the 1.5× cap. Caveat: no published benchmark matches this workload; the week-2 gate measures real frame durations with Safari Web Inspector Timeline and Chrome DevTools Performance (GPU + commit time included — `performance.now()` around the draw calls understates Chrome's deferred-canvas cost). Decision rule: if p95 frame time on the SE-class device exceeds 6 ms at the 1.5× cap, drop the cap to 1; if still over, hold 30 fps at all times on coarse pointers; if the laptop misses 2 ms, Three.js moves up the backlog (it reuses `graph.json`).

### 7.4 Choreography (all time-based, frame-rate independent: `v += (target − v)·(1 − e^(−λ·dt))`)
- **Entrance**: first canvas frame uses the poster's camera; canvas opacity 0→1 and SVG 1→0 over 500 ms `--ease-out-expo`; simultaneously group scale .97→1 over 900 ms and edge alpha ×.6→×1. No scale-from-zero: the poster already shows the finished object, so nothing may flicker.
- **Cursor follow** (Locomotive feel): `pointermove` on `window` → `target = ((x/w)·2−1, (y/h)·2−1)`; `yaw → target.x·.45 + spin` and `pitch → −target.y·.30` with λ = 5/s; camera x parallax `target.x·.04·R` with λ = 4/s; leaving the hero eases back to 0. Idle spin .04 rad/s (one revolution ≈ 2.6 min).
- **Hover / pick**: nearest projected node within 14 px (24 px touch): node gold `--gold` + glow, scale ×1.6 over 200 ms; incident edges gold at full alpha; neighbours `--gold-2` at .8; all other nodes dim to .45 and edges to .35 (150 ms). Label chip (real HTML: mono kind line "NOTE · 7 LINKS", 16 px title, optional date) positioned from the projected point, 14 px up-right, flipping left within 220 px of the right edge; `cursor: pointer`; the Now indicator shows the kind. Click (pointer-up within 6 px / 400 ms) → `location.assign(u)`. Drag beyond 6 px rotates with velocity; release decays with λ = 2.
- **Idle tour**: after 4 s without pointer activity, every 3.2 s take the next entry of a seeded shuffle of `hubs` (top 12 non-tag nodes), apply the exact hover state for 2.4 s, release over 400 ms. Any pointer input cancels; resumes after 4 s. A reader who never moves the mouse still sees "AI Bubble: Bubble Intensity Score → World Archery Youth Championships → ECONBRIEF101" by name.
- **Scroll recede**: `p = clamp(scrollY / (.8·innerHeight))`; scale `1 − .15p`, canvas opacity `1 − p`, pitch `+ .25p` (it tips back and falls away); at `p ≥ 1` the loop stops.
- **Touch**: `touch-action: pan-y` (vertical swipes scroll the page); horizontal drags rotate; first tap selects and shows the label with an "Open →" chip, second tap on the same node opens.
- **Keyboard / AT**: focusing a hub in the hidden list applies the hover state on the canvas (or gold on the SVG); Enter follows the link.

### 7.5 Fallback matrix
No JS / reduced motion / motion toggle off / saveData → inline SVG poster (static, hover gold, links work). Phones → canvas at a DPR cap of 1.5 (cap 1 if the week-2 measurement requires it), 30 fps, top-of-hero layout. Any exception in the module → SVG stays (the canvas is only revealed after the first successful frame). There is no WebGL branch to test because nothing uses WebGL.

### 7.6 Rest of the home page
Chapter index: five rows at `--t-1` (`01 Achievements — 34 entries`, `02 Notes & Blog — 58 notes · 7 essays` …) with a one-line dek each; row hover turns the numeral gold and slides the arrow 8 px. Featured strip: up to 4 `featured: true` achievement covers with mosaic reveal. Latest: 3 most recent posts/notes. Footer: email, links, RSS, motion toggle, "Built from Markdown · updated <build date>".

Budget: home JS ≈ 14 KB gz (nav 1, motion .3, hero 8, mosaic 1.5, now .5, Vercel analytics 2 async); `graph.json` ≈ 8 KB br. Hard ceiling in `check-dist`: 60 KB.

---

## 8. Achievements chapter

### 8.1 Timeline (`/achievements`)
Header `01 / Achievements`, one paragraph, then the filter row: **year tabs** `All · 2026 · 2025 · 2024 · 2023 · Earlier` (Kalkbrenner device) and **8 category chips** with counts, all `<button aria-pressed>`. State lives in the query string `?year=2024&cat=athletics` via `history.replaceState`, so `/achievements?cat=athletics` is a shareable deep link for the application. All ~35 `<article>`s are in the DOM; `filters.ts` (≈ 60 lines vanilla) toggles `hidden` inside `document.startViewTransition()` where available (each article has `view-transition-name: ach-<id>`, 300 ms `--ease-in-out-quart` reflow) and instantly elsewhere; without JS every entry shows. After each change the countdown recomputes N and the rail re-spaces.

Entries newest → oldest, grouped by year with a mono year rule. Entry grid (≥ 1024: columns 5–12): mono date (`AUG 2025`, ranges `JUN–AUG 2025`, `dateText` wins), `h2` title at `--t-2`, result badge (gold outline mono), `org · location`, summary, category label, `thai` line in `--fg-2` 14 px when set, media block (cover 3:2 with mosaic + up to 3 square thumbs + certificate tile 1:1.4 labelled "Certificate"), link row (external links as mono chips, "Details →"), "Connected" chips when wikilinks/backlinks exist. Entries are separated by 1 px rules, `min-height: 40vh` on desktop so the numeral has rhythm; a small mono `Nº 23` inside each entry exposes the index to AT.

### 8.2 The countdown number (zero.university device)
Sticky left column (`top: 56px`, `height: calc(100svh − 56px)`): a numeral at `--t-numeral` showing the **index of the entry nearest the viewport centre, counting down from N (newest) to 01 (oldest)** — the origin story lands on 01. Implemented with IntersectionObserver (`rootMargin: '-50% 0px -50% 0px'`) per entry; digits roll as two stacked spans (incoming `translateY(.35em)→0` + opacity over 280 ms `--ease-out-expo`, direction flips when scrolling up). Beneath it: the year (mono, changes on year boundaries) and the **gold rail**: a 1 px `--rule` track in the gutter whose gold fill `scaleY` follows chapter scroll progress (passive scroll listener, rAF-throttled), with 6 px square markers per entry rotating 45° when active. Phones: the numeral becomes a fixed 48 px mono badge bottom-right with a 2 px top progress bar. Reduced motion: numeral swaps instantly, rail still fills (it is a progress indicator under user control). No GSAP, no CSS scroll-timeline (Firefox coverage uncertain).

### 8.3 Detail page (`/achievements/[id]`)
Cover (mosaic), metadata block (date range, org, location, result, category link, external links), body, gallery grid (`rehype-gallery` wraps runs of image paragraphs; `<Picture formats={['webp']} widths={[480,960,1440]} sizes="(min-width:1024px) 46vw, 100vw" quality={72} layout="constrained">`), certificate in its own labelled slot (widths `[800,1600]`, quality 80, always colour), "Connected notes" (backlinks + graph neighbours), prev/next in time. Lightbox: PhotoSwipe 5 dynamically imported on first click, one gallery per entry including the certificate (caption "Certificate — <title>"), arrows/Esc/focus return, pinch zoom; sources are the 1600 w (photos) / 2000 w (certificates) variants from `getImage()`.

### 8.4 Media pipeline
- Build: Astro `<Image>/<Picture>` + Markdown embeds through Sharp; **WebP only** (AVIF doubles transforms for little gain on a text-led dark site); `loading="lazy" decoding="async"` except the first two covers; Sharp strips EXIF/GPS from every output. Cost ≈ 250 images × 3 widths: expect **several minutes cold** on Vercel's Hobby Basic build machine (2 vCPU, 8 GB; far below the 45-minute limit at this media size, but tracked as the set grows). Warm builds reuse Astro's transform cache in `node_modules/.astro` (cache hits are `copyFile`s, no re-encode; the cache key embeds source + transform options, so only changed images re-encode). Caveat: that reuse is an **inference**, not a documented Vercel guarantee for Astro — Vercel restores `node_modules/**` for every framework preset on every plan, and Astro's default `cacheDir` sits inside it; the Astro preset has no extra cache pattern. Preconditions pinned in the repo so the inference holds: `cacheDir` left at its default, Vercel's default Install Command (never overridden to `npm ci`, which deletes `node_modules`), no `@astrojs/vercel` `imageService: true`, framework preset Astro, Node major unchanged. The cache is per-branch (new branches seed from production), capped at 1.5 GB, expires after one month idle, is not updated by failed builds, and is bypassed by "Redeploy without cache" / `VERCEL_FORCE_NO_BUILD_CACHE=1`. **Acceptance test (week 1, after the second production push)**: the build log shows `Restored build cache from previous deployment (dpl_…)` **and** the image-generation step reports near-zero transforms; cold and warm durations are recorded in `CLAUDE.md`. Fallback if the log does not show reuse: build in GitHub Actions with `actions/cache` on `node_modules/.astro` and `vercel deploy --prebuilt`.
- One-time import (`scripts/import-media.ts <sourceFolder> <slug>`, run by the assistant with the client in week 0): **allow-list** `jpg/jpeg/png/webp` (PDF, MOV/MP4, DOCX, HEIC are skipped and listed), `sharp().rotate()` **before** stripping metadata (otherwise EXIF-oriented LINE/phone photos bake sideways), longest edge 2400 px, JPEG q82, de-duplicate by content hash, prefer the "(Only) Certificate" clean copies, rename to `<slug>-01.jpg …` and `<slug>-certificate.jpg` (no legal names or registration numbers survive in filenames; the colon-named folder disappears), write to `content/media/`, print a manifest the client curates (3–6 photos per achievement). Certificate PDFs are rasterised once with `sips -s format jpeg` before import.

### 8.5 Privacy guardrails (enforced)
(1) Private repo. (2) `.gitignore` blocks `pdf docx doc mp4 mov m4v heic zip` under `content/`. (3) `check-content` **fails** the build on: those extensions anywhere in `content/`; filenames matching `/\d{10,}|passport|id[-_ ]?card|บัตร|transcript|score[-_ ]?report/i` or containing `tejahempinyo`; images > 8 MB; it **warns** on GPS EXIF still present and images > 2 MB. (4) `check-dist` greps `dist/` text for 13-digit sequences and the same keywords and fails on any PDF other than `resume.pdf`, any video, any asset > 2 MB. (5) The 6.5 GB podcast video and ID-bearing PDFs physically cannot enter via the import script; achievements link out. (6) Registration numbers on certificate scans are checked visually during curation; the README asks the author to blur ID/DOB in Preview before adding a new certificate. (7) `content/.obsidian/workspace*.json` (recent file names) is gitignored. (8) The legal name appears only where intended (achievements, resume, About, JSON-LD); notes/blog use "Noah". (9) Only the public email is shown; no phone or address anywhere.

---

## 9. Notes & Blog chapter

### 9.1 Markdown pipeline (`astro.config.mjs`)
`import { unified } from '@astrojs/markdown-remark'`; `image: { layout: 'constrained' }`; `markdown.processor = unified({ remarkPlugins: [remarkMath, remarkVault, remarkObsidianCallout, remarkBreaks], rehypePlugins: [rehypeKatex, rehypeGallery], shikiConfig: { theme: 'vesper' } })` — GFM and heading ids are Astro defaults. Order matters: math first (so `$…$` is not text when tags are scanned), `remarkVault` before callouts (callouts turn paragraphs into `html` nodes, which would hide embeds from the image collector), callouts before breaks (the callout title line must stay one paragraph). Verified: Astro appends `remarkCollectImages` after all user remark plugins, so `remarkVault`'s image nodes are collected. KaTeX CSS (0.16.47, self-hosted fonts) is linked only on pages whose rendered HTML contains `class="katex"` (a flag set by the render step).

### 9.2 Pages
- `/notes/[id]`: title (`--t-2`), `thai` subtitle, mono meta `Note · updated 2026-09-02 · by Noah`, tag chips → `/tags/x`, body (68ch; wikilinks gold-underlined, missing links dotted `--fg-2`), then **Linked from** (each backlink with the sentence containing the link, ≤ 140 chars, computed at build), **Links to**, **Related by tag** (top 5 by shared-tag weight), a static **LocalGraph SVG** (centre node + up to 12 neighbours on a 90 px ring, each an `<a>` with `<title>`, gold on hover, ~2 KB, zero JS), comments only if `comments: true`.
- `/blog/[id]`: same plus date, reading time (words/230), cover with mosaic, mono `Essay 03 · Nov 2026`, prev/next essay, related notes, Giscus on by default, JSON-LD `BlogPosting` author "Noah".
- `/notes` (chapter 02 landing): tabs Notes · Blog; 2D graph panel (60vh desktop / 40vh phones) with checkboxes Notes · Blog · Achievements · Tag links, a text box that highlights matching titles, a legend, and `?focus=<id>` (each note page has "Open in graph →"); beneath it the note list (recently updated first, alphabetical toggle) which is the accessible equivalent; tag cloud. `/blog`: essays grouped by year with summary, cover thumbnail, tags, RSS link. `/tags/[tag]`: notes, posts and achievements under one heading with kind labels and counts.
- 2D graph = the shared `graph-render.ts` in mode `2d` using `p2`, fit-to-viewport with 24 px padding, node radius by degree, same hover/click/touch semantics as the hero, labels for hubs (degree ≥ 4) and the hovered node. Pan/zoom is backlog.

### 9.3 Graph data (`src/lib/graph.ts` → `/graph.json`, computed once per build, memoised on entry digests)
Nodes = every published note, post, achievement, plus tag hubs. Edges:
- **Link**: each resolved wikilink A→B (both published) → one undirected edge `{k:'link'}`; direction kept in memory for backlinks.
- **Tags**: per tag with m members (frontmatter ∪ inline ∪ implicit `category/*`): m = 1 → nothing; **2 ≤ m ≤ 6 → all pairs, weight 1/(m−1)**; **m ≥ 7 → a hub node `tag:<name>`** (kind `tag`, url `/tags/<name>`, drawn as a small gold-dim ring) with m spokes of weight .5. Edge count stays O(N) for `#archery` and the eight categories, and the categories form visible clusters.
Layout: `forceSimulation(nodes, 3)` with nodes sorted by id (deterministic with d3's default seeded LCG): `forceLink(edges).id(d=>d.id).distance(e => e.k==='link' ? 14 : 20).strength(e => e.k==='link' ? .7 : .3)`, `forceManyBody().strength(d => d.k==='tag' ? -30 : -60).distanceMax(150)`, `forceCollide(d => d.r*1.6 + 1.5)`, `forceRadial(d => d.deg===0 ? 48 : 30).strength(d => d.deg===0 ? .35 : .04)` (orphans become an outer shell; the object stays spherical so it tilts well), `forceCenter()`; `.stop()`; `tick(300)`; centroid to origin; scale so the 95th-percentile radius = 1; clamp at 1.5; round to 3 decimals. Same forces with `numDimensions(2)` for `p2`. ≈ 60 ms in Node.

Schema v1: `{ v:1, built, nodes:[{ i, id:'notes/ai-bubble-intensity-score', t, k:'note'|'post'|'ach'|'tag', u, c:'research'(ach only), y:2025(ach only), deg, p3:[x,y,z], p2:[x,y] }], edges:[{ s, t, k:'link'|'tag', w }], hubs:[i…12], tags:{ archery: 9 } }`. Launch size ≈ 110 nodes + 460 edges ≈ 30 KB raw / 8 KB br; at 400 nodes still < 25 KB compressed.

### 9.4 Search, RSS, comments
- **Search**: `astro-pagefind` indexes `dist/` at `astro:build:done`; `<main data-pagefind-body>` on notes, posts and achievements, `data-pagefind-filter="type"` and `data-pagefind-meta="date"`, nav/footer/comments `data-pagefind-ignore`. The `SearchDialog` (native `<dialog>`, opened by the nav button, `/` or ⌘K) mounts the Pagefind UI on first open (~15 KB + index chunks only when used); dark styling via `--pagefind-ui-*` variables.
- **RSS**: `/rss.xml` for blog posts (title, pubDate, description = summary, link, author "Noah", categories = tags); autodiscovery `<link>` in `Base.astro`. Notes RSS is backlog.
- **Comments — evaluation**: Giscus (GitHub Discussions): free, no tracking cookies, threaded replies + reactions, moderation and email notifications through GitHub, spam-resistant (GitHub sign-in), lazy iframe, custom CSS theme, actively maintained → **chosen**. utterances: GitHub Issues, unthreaded, effectively unmaintained. Disqus: ads/tracking, needs a consent banner. Cusdis: free tier with unclear durability. Waline/Remark42/Isso: need a server. Trade-off stated to the client: readers without GitHub accounts can read but not post.
- **Setup (10 min, once)**: because the site repo is private, create a second **public** repo `huachxng/hua-site-comments` with Discussions enabled, category `Comments` of type Announcement (only giscus creates threads), install the giscus GitHub App on that repo only, copy `data-repo-id` / `data-category-id` from giscus.app into `site.config.ts`, add `giscus.json` `{ "origins": ["https://<project>.vercel.app"] }` (exact `window.origin` match; previews show a blocked message, acceptable). Add the `vercel.json` headers rule `{ "source": "/giscus.css", "headers": [{ "key": "Access-Control-Allow-Origin", "value": "https://giscus.app" }] }` and verify after the first deploy with `curl -I -H "Origin: https://giscus.app" https://<project>.vercel.app/giscus.css`.
- **Embed (`Comments.astro`)**: a `<section id="comments" data-pagefind-ignore>` with heading "Discussion", mono note "Sign in with GitHub to comment", a plain "Open on GitHub →" link, and the giscus `<script>` injected by an IntersectionObserver when the section is within 800 px (belt: `data-loading="lazy"` — Verified: giscus sets the iframe's native `loading="lazy"`): `data-mapping="pathname" data-strict="1" data-reactions-enabled="1" data-emit-metadata="0" data-input-position="top" data-theme="https://<project>.vercel.app/giscus.css" data-lang="en" crossorigin="anonymous" async`. Caveat (Verified in giscus source): giscus injects the custom theme as `<link rel="stylesheet" crossorigin="anonymous">` from origin `https://giscus.app`, so the stylesheet is a **CORS fetch**; a `*.vercel.app` project sends no `Access-Control-Allow-Origin` by default, and without the `vercel.json` header above the browser rejects the CSS and giscus silently falls back to its built-in theme. `public/giscus.css` maps giscus variables to the dark tokens using **literal hex values** (bg `#0A0A0B`, cards `#121214`, text `#F2F0EA`, accent `#E8B84A`) — the iframe is cross-origin and cannot read the parent page's `var(--gold)`. Strict mode matches by a SHA-1 of the pathname stored in the discussion body (`<!-- sha1: … -->`); if a public post is ever renamed, the assistant edits that comment to the SHA-1 of the **exact new pathname string** (leading slash, no trailing slash under `trailingSlash: false` — a trailing slash changes the hash) (2-minute procedure in `CLAUDE.md`) — `previousSlugs` keeps the old URL working meanwhile. Verified: `data-strict` + `data-mapping="pathname"` re-attach by editing the body hash is documented and matches the giscus source. Defaults: blog on, notes off, achievements and resume never. Moderation: GitHub notifications → lock/delete in the GitHub UI.

---

## 10. Resume page & PDF

**Single source**: `src/lib/resume.ts` `buildResumeModel(achievements, profile)` → `{ header, education, sections:[{ title, items:[{ line, org, dateText }] }], skills, tests? }`. Input = `getPublished('achievements')` with `resume !== false` + `profile.md`. Section = `resumeSection ?? map[category]` (academics → Honors & Awards, mathematics → Honors & Awards, research → Research, leadership → Leadership & Service, athletics → Athletics, ventures → Ventures & Media, arts → Arts & Music, camps → Programs; fixed order Education · Research · Honors & Awards · Athletics · Leadership & Service · Ventures & Media · Arts & Music · Programs · Skills). Line = `resumeLine ?? "{title} — {org}{result ? ', ' + result : ''}"` + `dateText` or `MMM YYYY[–MMM YYYY]`; date desc within a section; per-section cap 8 (configurable) — overflow is hidden in the PDF and shown under "more" on the web. Legal name in the header; no pen name.

**Web page (`/resume`, chapter 04)**: the dark chrome frames an off-white "paper" panel (max 820 px) so the visitor sees what prints; buttons **Download PDF** (`href="/resume.pdf" download="Sasipat-Tejahempinyo-Resume.pdf"`) and **Print** (`window.print()`). `print.css`: `@page { size: Letter; margin: .6in }`, white background, `#111` text, gold only for 1 px section rules, nav/grain/buttons hidden, 10.5 pt Inter, 9 pt mono uppercase section heads, `break-inside: avoid` on items; one page target, two max.

**PDF file (in the Vercel build, no browser, no bot commits)**:
1. `src/pages/resume.json.ts` — a static endpoint that serialises the same `buildResumeModel()` output (so the PDF cannot drift from the page or the timeline).
2. `scripts/resume-pdf.mjs` runs in `postbuild` (ESM — react-pdf 4.x ships no CJS build): reads `dist/resume.json`, builds the document with `React.createElement` (no JSX, no framework integration), `Font.register({ family: 'Inter', fonts: [{ src: path.resolve(process.cwd(), 'src/assets/fonts/Inter-Regular.ttf'), fontWeight: 400 }, { src: path.resolve(process.cwd(), 'src/assets/fonts/Inter-SemiBold.ttf'), fontWeight: 600 }] })` (react-pdf supports TTF/WOFF only; variable fonts do not work; on Node the `src` must be an **absolute** path), `<Page size="LETTER">` set explicitly (react-pdf's default is A4), same section order, `renderToFile(doc, 'dist/resume.pdf')`, sets PDF metadata (title, author), then deletes `dist/resume.json`. Output ≈ 60–90 KB, deterministic, pure JS (pdfkit + fontkit + yoga-layout wasm). Verified: pdfkit embeds a TrueType subset with a ToUnicode CMap, so the text is real and searchable; `renderToFile` is the Node entry (`fs.createWriteStream`); Vercel runs npm's `postbuild` hook when the Build Command is `npm run build` (it must not be overridden to a bare framework command). Caveat: the PDF stays in the build step — never in a Vercel Function or route handler — because react-pdf 4.9.0 pins pdfkit 0.20.1, whose standard-font export map breaks under nft tracing (PR #3550) but not under plain `node` with a full `node_modules`. If it throws, the build fails naming the offending entry — the previous deployment stays live.
3. `npm run resume:pdf` runs the same script locally for the assistant; the week-0 spike runs it once on the Mac (Node 24.16) and once in a Vercel preview.
Fallback if the week-0 spike finds react-pdf unusable on Vercel's image: the identical script runs in `quality.yml` on `ubuntu-latest` via Playwright `page.pdf('/resume')`, committing `public/resume.pdf` with the owner's name/email as commit author (Hobby only deploys owner-authored commits) and `paths: ['content/achievements/**', '!public/resume.pdf']` to prevent loops. Print remains the universal fallback.

Tests: `resume.test.ts` snapshots the model from fixtures; e2e asserts `/resume.pdf` is `application/pdf`, ≥ 1 page, contains the legal name, and that every `resume: true` title appears on `/resume`.

---

## 11. Build pipeline

`npm run build` = `prebuild` → `astro build` → `postbuild` (npm lifecycle; Vercel runs `npm run build`).

1. **`prebuild: node scripts/check-content.ts`** (Node 24 native type stripping; imports the shared zod schemas via `.ts` specifiers; erasable syntax only):
   - Filesystem: forbidden extensions; PII filename patterns; duplicate ids per collection (case-insensitive); notes outside any collection folder ("this note is in a folder that is never published — move it to notes/, blog/ or achievements/"); images > 8 MB error / > 2 MB warn; exact-case existence of every `cover`/`certificate`/embed; GPS EXIF warning.
   - Frontmatter: the shared schemas with per-field fix lines (every field has an explicit message in the schema itself, so `astro build` prints the same wording), e.g.
     `✖ content/achievements/Navy Archer Open 2024.md — "category" is missing. Choose one of: academics, research, ventures, leadership, athletics, arts, mathematics, camps`
     `✖ content/blog/On bubbles.md — "date" is missing. Add: date: 2026-09-16`
     unknown property → warning with "did you mean summary?" (Levenshtein ≤ 2); future date > 1 year → warning; `endDate ≥ date`.
   - Links: every `[[wikilink]]`, `![[embed]]` resolved with `file:line`; unresolved → warning with the three closest names (fails only in CI with `STRICT_LINKS=1`, so a typo never blocks the author's deploy); ambiguous basename → error with the `[[folder/Name]]` fix; link to an unpublished note → warning "will render as plain text".
   - Syntax: unbalanced `%%` → error; `%%` inside lists → warning; unbalanced `$$` → warning.
   - Summary: `3 errors in 2 files, 5 warnings — fix in Obsidian and push again` + the list of unpublished notes; `--report md` writes the same as Markdown (for the GitHub Issue and `$GITHUB_STEP_SUMMARY`); writes `node_modules/.cache/hua/unpublished.json` for check-dist. Exit 1 on any error; Astro's own zod messages (file + field) are the second net.
2. **`astro build`**: collections → pages; `graph.json` and `resume.json` endpoints; static redirect pages from `previousSlugs`; Sharp images (`image.layout: 'constrained'` → srcset for Markdown embeds); sitemap; RSS; Pagefind index at `astro:build:done`. Warnings from `remark-vault` (unresolved links) print with file paths.
3. **`postbuild: node scripts/resume-pdf.mjs && node scripts/check-dist.ts`**: PDF (§10); then `check-dist` fails the build if `dist/` contains any unpublished title/id, any PII pattern, any PDF other than `resume.pdf`, any video, any asset > 2 MB, any internal `href`/`src` that does not resolve to a file in `dist/` (node-html-parser crawl — this also catches template bugs), or if the home page's referenced JS exceeds 60 KB gz.

Dev: `npm run dev` = `SHOW_DRAFTS=1 astro dev` (drafts visible with a DRAFT ribbon; `graph.json` and `resume.json` served live; Pagefind works after one build). Every error message starts with the file path and ends with a fix line; the author never needs to read a stack trace.

---

## 12. Deployment & publish flow

### 12.1 macOS environment (inspected on the client's Mac on 2026-09-16)
Present: macOS 26.6.2; Node **v24.16.0** via nvm (default alias `lts/*`), npm 12.0.2; Apple Git 2.50.1 at `/usr/bin/git`; GitHub CLI 2.96.0 logged in as **huachxng** (keyring); Homebrew at `/opt/homebrew`; Obsidian.app; Visual Studio Code.app. Missing: GitHub Desktop; Playwright browsers (assistant only). Note the home folder is `/Users/huachengt.` (trailing dot) and the media folder path contains a space — the repo lives at `~/Sites/hua-site` (no spaces) and scripts quote all paths.

Setup (assistant with the client present, ~40 min, day 0):
1. `brew install --cask github` → open GitHub Desktop → sign in (this stores credentials in the keychain). Then `git config --global user.email` → an address **verified on the huachxng GitHub account** (or that account's GitHub noreply address) and confirm GitHub Desktop uses the same identity. Verified in Vercel's docs: on Hobby, only commits whose author email matches the team owner's Git-provider identity trigger deployments; an unverified, plus-addressed or work email in local git config silently blocks deploys. `Co-Authored-By` trailers added by AI tooling do not change the author and are not a factor.
2. `gh repo create hua-site --private` (owner huachxng); GitHub Desktop → Clone → `~/Sites/hua-site`. Verified: Vercel Hobby's private-repo restriction applies only to repos owned by a GitHub **organization**; a private repo on a personal account, imported by its owner, deploys.
3. Assistant: `git worktree add ../hua-site-dev -b dev`; scaffold Astro 7.3.2 there, pinned deps, `npm install` (sharp downloads a prebuilt arm64 binary), first commit to `main`.
4. `gh repo create hua-site-comments --public`, enable Discussions, install the giscus app, capture ids.
5. Vercel dashboard → Add New Project → import `hua-site` (Hobby, personal account; private personal repos are allowed) → framework preset Astro (auto), Build Command `npm run build` (so `prebuild`/`postbuild` run), Install Command left at the default (**not** `npm ci`, which would defeat the build cache), output `dist`, Node 24.x (also pinned via `engines.node: "24.x"` so a project-level setting can never fall back to 22.x), no environment variables → **project name chosen deliberately** (proposal: `hua-tejahempinyo`; it is the permanent URL) → Deploy. Set `site` in `astro.config.mjs` to the URL. Enable Web Analytics. Keep Deployment Protection "Standard" (previews stay private; Vercel adds `noindex` to previews). Verified: a self-built student portfolio with no ads, affiliate links, payment widgets or paid developer falls outside every enumerated "commercial usage" criterion in Vercel's fair-use guidelines; using an AI assistant is not a paid consultant writing the code.
6. Obsidian → Open folder as vault → `~/Sites/hua-site/content`. Trust the committed settings.
7. Author dry run: create a note from the template, tick `publish`, GitHub Desktop → Commit → Push → watch Vercel go green → open the URL. The assistant reads this second build's log for `Restored build cache from previous deployment` (§8.4 acceptance test) and `curl`s `/giscus.css` for the CORS header (§9.4).

### 12.2 Obsidian vault settings (committed in `content/.obsidian`)
Files & links: Use [[Wikilinks]] on; New link format: shortest path; Automatically update internal links on; Default location for new notes: `notes/`; Default location for new attachments: `media/`; Detect all file extensions off; Excluded files: `_templates`. Editor: Properties in document: visible; Strict line breaks off (default; the site matches via remark-breaks). Core plugins: Templates (`_templates`, hotkey ⌘T), Properties view, Backlinks, Outgoing links, Tags, Graph view (the author's local graph ≈ the public one), File recovery. Community plugin: **Image Converter 1.4.6** (JPG q80, longest edge 2000 px, output `media/`, rename `<note name>-<timestamp>`). **Obsidian Git is deliberately not installed**: with the vault as a subfolder it stages the entire repository and hides git errors behind a plugin UI; GitHub Desktop shows exactly which files will become public.

### 12.3 Publish flow (author, ~1 minute)
Write in Obsidian → tick `publish` → GitHub Desktop → read the Changes list (privacy review) → Summary ("Add note: AI bubble score") → **Commit to main** → **Push origin** → Vercel builds (2–4 min warm; longer when the build cache is cold, §8.4) → live. On failure: Vercel email + a GitHub Issue "Content problems in latest push" with file, field and fix (§14); the previous deployment stays live. Optional before pushing: double-click `mac/Check Content.command` (runs `check-content` and prints the report) or `mac/Preview Site.command` (opens `http://localhost:4321` with drafts visible).

Code changes: only the assistant, in `hua-site-dev` on a branch → PR → CI green + Vercel preview URL → the client clicks Merge. GitHub Desktop's Fetch/Pull brings merged code into the author's checkout; conflicts cannot occur because the author touches only `content/` and the assistant never edits `content/` (media migration is done once, on `main`, before the author starts).

---

## 13. SEO / OG / analytics

- `Seo.astro`: `<title>` = `{Page} — Sasipat (Hua) Tejahempinyo` (notes/blog: `{Title} — Noah`; home: `Sasipat "Hua" Tejahempinyo — Achievements, Notes & Essays`), meta description, canonical = `Astro.site + pathname` (also neutralises `*-git-main-*.vercel.app` duplicates), `theme-color #0A0A0B`, RSS autodiscovery, robots `index,follow` (404 `noindex`).
- Open Graph / Twitter: `og:type` article for notes/posts/achievements, profile for About, website elsewhere; `summary_large_image`; `article:published_time/modified_time`; `og:image` = the entry's cover cropped to 1200×630 at build via `getImage({ width: 1200, height: 630, fit: 'cover', format: 'jpeg' })`, else the chapter's static PNG in `public/og/`. Per-page generated cards are backlog.
- JSON-LD: `Person` on `/` and `/about` (name Sasipat Tejahempinyo, `alternateName` ["Hua", "Noah", "Landa Tejahempinyo"], affiliation BASIS International School Bangkok, `sameAs` from `profile.links`); `BlogPosting` on posts (author Person "Noah" → `/about`); `ItemList` on `/achievements`; `BreadcrumbList` on detail pages.
- Sitemap via `@astrojs/sitemap` (filter out `/tags/*`, `/404`); `robots.txt` allows all and points to `/sitemap-index.xml`; submit the sitemap in Google Search Console (meta-tag verification). The current production `*.vercel.app` deployment is indexable; previews and outdated deployments get `noindex` from Vercel.
- Analytics: `<Analytics/>` from `@vercel/analytics/astro` in `Base.astro` (cookieless, no banner; Hobby 50,000 events/month, collection pauses rather than bills). No Speed Insights (paid beyond a small quota); Lighthouse runs in CI instead.
- Sharing: copy-link + `navigator.share` row on posts and achievements; filter states are shareable URLs; `/resume.pdf` is the stable link for the Common App additional-information section.

---

## 14. Testing strategy

- **Unit (vitest)**: `wikilinks` (all syntaxes, alias, heading → slug, block ref, path-style target, NFC/case, ambiguous → error, unknown → text, `![[img.jpg|480]]` → mdast `image` node with a relative url), `tags` (union, code/URL/heading exclusion, nested), `comments` (inline, multi-paragraph, unbalanced detection), `graph` against `tests/fixtures/vault` (published-only nodes, link dedupe, 2–6 pairwise weights, ≥ 7 hub, implicit category tag, backlink direction + context sentence, byte-identical JSON across two runs), `resume` (mapping, overrides, caps), `redirects` (previousSlugs → map), the **getCollection guard** (no raw `getCollection(` outside `published.ts`), `check-content` rules against five broken fixture vaults (each must produce its exact error text).
- **Week-0 spike pass criteria (recorded, not assumed)**: (a) the built HTML for a fixture note containing `![[fixture.jpg]]` contains `<img srcset="… .webp …">` with ≥ 2 widths, and `sharp(output).metadata()` (or `exiftool`) shows no EXIF on the output — this is the check that would have caught a plugin that emits `html` nodes instead of `image` nodes; (b) `node scripts/resume-pdf.mjs` produces `dist/resume.pdf` on the Mac and in a Vercel preview, `pdftotext` finds the legal name; (c) a page built with the local font provider contains exactly one `<link rel="preload" as="font">` and a generated `… fallback` `@font-face` with `size-adjust`.
- **Build-time**: `check-content` (prebuild) and `check-dist` (postbuild) run on every Vercel build — production is protected even when CI is skipped.
- **Types**: `astro check` (TS 5.9.3) in CI.
- **E2E (Playwright, Chromium + WebKit, against `astro preview`)**: every sitemap route 200 with no console errors; home: SVG poster visible before JS, canvas appears after load and the SVG fades; `emulateMedia({ reducedMotion: 'reduce' })` → canvas never mounts, no mosaic canvases; `data-motion=off` → same; hero exception injected → SVG remains; keyboard order nav → skip link → hub list → chapter index; `/achievements` year tab + chip update the query string and the countdown N; lightbox arrows/Esc/focus return; a note shows backlinks and the local graph; a post contains the giscus section with the configured repo and no iframe before scrolling; search dialog opens with ⌘K; `/resume.pdf` is `application/pdf` with the legal name; privacy: `dist/` contains no fixture-draft title/id and no PII pattern; 375 px viewport: no horizontal scroll on `/`, `/achievements`, a note.
- **Axe**: `@axe-core/playwright` on `/`, `/achievements`, an achievement, `/notes`, a post, `/resume` — zero serious/critical (contrast checked against the dark tokens).
- **Budgets**: `.size-limit.json`: home JS ≤ 60 KB gz (hard constraint 250), CSS ≤ 40 KB gz, any single client chunk ≤ 30 KB gz; `lighthouserc.json` (mobile, simulated 4G) on `/`, `/achievements`, `/notes`: LCP ≤ 2500 ms, CLS ≤ .05, TBT ≤ 200 ms, performance ≥ 90.
- **CI split** (private repo, 2,000 free minutes/month): `content-check.yml` on `paths: ['content/**']` → `npm ci` (cached) → `check-content --report md` → on failure create/update the Issue "Content problems in latest push" via `gh` (`permissions: issues: write`) and write the step summary (~1 min/push). `quality.yml` on `paths-ignore: ['content/**']`, PRs, `workflow_dispatch` and a weekly cron → unit, `astro check`, full build, size-limit, Playwright + axe, LHCI (~8 min). Expected usage ≈ 300 min/month. CI never gates Vercel: a red check is the assistant's to-do list, never a block on the author.
- **Deployed-only checks (against the Vercel URL, since `vercel.json` headers do not exist under `astro preview`)**: `curl -I -H "Origin: https://giscus.app" https://<project>.vercel.app/giscus.css` returns `Access-Control-Allow-Origin: https://giscus.app`; the second production build log contains `Restored build cache from previous deployment`.
- **Manual, each milestone**: iPhone Safari (touch rotate, scroll, tap-to-open), Firefox (no view transitions, hero works), a 1280×720 laptop on DevTools 4G; WebPageTest once from Singapore and once from the US in week 4. **Week-2 hero performance gate**: record p50/p95 frame durations from Safari Web Inspector Timeline on an iPhone SE 2/3 (or the oldest available iPhone) at the 1.5× cap and from Chrome DevTools Performance on a 2020-class laptop, with the idle tour running; apply the §7.3 decision rule and write the numbers into `CLAUDE.md`.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Astro 7 is three months old; unified() is the opt-in path and a minor could change Markdown/Fonts behaviour | Exact pins + lockfile, no upgrades before Nov 1; the week-0 spike proves `unified()` (from `@astrojs/markdown-remark`) + `remark-vault` + relative-image optimisation with `image.layout: 'constrained'` on 7.3.2 before anything else is built, with the pass criterion "built HTML contains `<img srcset=… .webp>` for a wikilink embed and the output has no EXIF"; fallback is a hast-level `<img>` rewrite pointing at media copied to `public/` (loses responsive variants only) |
| Drafts or private material leak | Opt-in `publish`, accessor guard test, glob negations, plain-text rendering of unpublished links, `check-dist` on the real build, private repo, PII denylist, EXIF stripping, allow-list ingest, workspace.json ignored |
| `%%` hides content unexpectedly / renders differently from Obsidian | Balanced-`%%` error, remark-breaks parity, local preview with DRAFT ribbon |
| react-pdf fails on Vercel's build image | Week-0 spike (`npm run resume:pdf` locally on Node 24 and in a Vercel preview); absolute font paths, ESM, explicit `LETTER`, PDF kept in `postbuild` (never a Function — pdfkit 0.20.1 export-map issue under nft tracing); fallback = Playwright in GitHub Actions with owner-authored commit; Print button always works |
| Author pushes a raw 6 MB camera JPEG | Image Converter on drop; > 8 MB fails with a fix line, > 2 MB warns; monthly `npm run shrink`; WebP outputs regardless |
| Hero reads as a hairball or looks flat with real data | Hub nodes bound tag edges; forceRadial shell; depth alpha, sprite shading, gold hover, idle tour; one tunable config object; two client look reviews (Oct 3, Oct 10); Three.js upgrade path reuses `graph.json` |
| Canvas 2D too slow on old phones, or the loop costs battery | The ≤ 4 ms / ≤ 2 ms figures are hypotheses; DPR cap 1.5 (iPhone SE is natively 2×), 30 fps cap on coarse pointers and after 20 s idle, batched edge strokes, loop pauses off-screen/hidden and stops after scroll recede; measured in week 2 with Web Inspector/DevTools frame timings on an iPhone SE-class device; decision rule in §7.3 (cap 1 → 30 fps always → Three.js) |
| Vercel build cache does not restore Astro's image cache, or the cache goes cold (new branch, month idle, Node bump) | Preconditions pinned (default `cacheDir`, default Install Command, no `imageService`, preset Astro); second-build log is the acceptance test; cold builds budgeted at several minutes on the 2 vCPU Basic machine (< 45-min limit); fallback GitHub Actions + `actions/cache` + `vercel deploy --prebuilt` |
| Renaming a public note breaks links/comments | `previousSlugs` redirects, `slug:` pin, strict-hash re-attach procedure for giscus (SHA-1 of the exact pathname), README rule 7 |
| Giscus custom theme silently falls back to the built-in theme | Caveat verified in giscus source: theme `<link>` is `crossorigin="anonymous"`; `vercel.json` sends `Access-Control-Allow-Origin: https://giscus.app` on `/giscus.css`; `curl` check after the first deploy; literal colours in the CSS |
| Vercel Hobby is non-commercial only; deploys silently stop | Self-built with AI assistance, no paid developer; MEEKVEGGIES/ECONBRIEF101 described, never sold (no payment/affiliate links, no ads); git author email verified on the huachxng account (Hobby deploys only owner-authored commits); migration to Cloudflare/GitHub Pages is a config change if ever needed |
| Giscus needs GitHub login; empty comment sections look sad | Comments only on posts (and opted-in notes), below the fold, reactions on; seed each essay with one reply from a friend/teacher; none on achievements |
| Font download fails during a Vercel build | Not possible by design: fonts come from the pinned `@fontsource-variable/*@5.3.0` packages via `fontProviders.local()`; there is no font network fetch at build. Caveat: the network Fontsource provider was rejected because a cold cache plus a Fontsource/jsDelivr outage throws `CannotFetchFontFile` with no fallback |
| Content entry is the real schedule risk (35 achievements, 15 notes, 3 essays) | Templates + import manifest delivered week 0 so the client writes in parallel; the timeline looks complete at 20 entries; core content freeze Oct 18 |
| GitHub Desktop credential/pull confusion | Sign-in on day 0 stores keychain credentials; the author never has conflicts (content-only edits); the assistant fixes anything in 5 minutes via `gh` |
| Vercel project name is permanent for application links | Chosen deliberately on day 0; canonical tags point to it; never renamed |
| macOS/Linux case and NFC differences | NFC + lowercase lookup, exact-case image check, ASCII-safe renames in the import script |

---

## 16. Five-week milestone plan (Sep 17 → Oct 20) + backlog

| Week | Dates | Deliverable (each week ends deployed) |
|---|---|---|
| 0 | Sep 17–19 (Wed–Fri) | Environment (§12.1, incl. verified git author email), private repo + worktree, comments repo, Vercel project live with a placeholder home at the final URL (default Install Command, `npm run build`, `engines.node 24.x`); Astro 7.3.2 scaffold with pinned deps, tokens, Fonts API via `fontProviders.local()` over `@fontsource-variable` 5.3.0, `image.layout: 'constrained'`, `vercel.json` with the giscus CORS header; vault skeleton with `.obsidian` settings, `types.json`, templates, README v1; **spikes closed against the §14 pass criteria**: `unified()` + `remark-vault` → optimised `![[img]]` with srcset and no EXIF; react-pdf postbuild PDF on the Mac and on a Vercel preview; single preload + capsize fallback from the local font provider; `import-media.ts` run on all ~35 folders, manifest handed to the client |
| 1 | Sep 20–26 | Content model complete (zod-v4 schemas with explicit messages, `getPublished`, vault index, `remark-vault`, math/breaks/callouts, unit tests, `check-content` v1, `content-check.yml` with Issues); design system (type, grid rules, grain, nav + menu dialog, chapter headers, footer, Now indicator, motion toggle, view transitions); About + Contact; `graph.ts` + `graph.json` + **poster SVG hero live on the home page**; second-build log checked for `Restored build cache` (§8.4). Client: first 10 achievements + profile.md |
| 2 | Sep 27–Oct 3 | **Interactive hero** (canvas, entrance, cursor follow, hover/label, tour, recede, touch, keyboard, all gates, batched edges, idle 30 fps); **hero performance gate measured** (§14) and the §7.3 decision rule applied; **Chapter 01**: timeline entries, year tabs + chips with query state, countdown numeral + rail, detail pages, gallery + certificate slot, PhotoSwipe, mosaic, image widths tuned; `check-dist` v1. **Client look review #1 (Oct 3): hero + timeline on laptop and phone.** Client: 25 achievements |
| 3 | Oct 4–10 | **Chapter 02**: note/post pages, backlinks with context, local graph SVG, tags pages, 2D graph view, Pagefind dialog, RSS, Giscus + theme (CORS header `curl`-verified on production); home chapter index, featured strip, latest; `previousSlugs` redirects. **Client look review #2 (Oct 10)** with hero tuning from review #1. Client: all achievements, 15 notes, 3 essays |
| 4 | Oct 11–17 | **Chapter 04** resume page + print CSS + PDF in the build; SEO (Seo.astro, JSON-LD, OG crops, sitemap, robots, Search Console), analytics; `quality.yml` green (unit, check, e2e + axe on Chromium/WebKit, size-limit, LHCI ≥ 90 / LCP ≤ 2.5 s on `/` and `/achievements`); cross-browser + iPhone pass; README + `.command` files final; **author dry run alone** (write → publish → deliberately break a date → read the Issue → fix) |
| 5 | Oct 18–20 | Core content freeze Oct 18; copy edit of About/Contact/summaries; unresolved-link and broken-link sweep; 404 page; performance re-check with real content; `CLAUDE.md` for future assistant sessions (incl. measured hero frame times, cold/warm build durations, giscus re-attach procedure); 30-min handover. **Oct 20: polished core live** |
| Buffer | Oct 21–Nov 1 | Content-only changes by the client; hotfixes only; no new features or dependency upgrades; final Lighthouse/axe run Oct 30; URL and `/resume.pdf` placed in the REA application before Nov 1 |

Ordered cut list if a week slips (cut from the bottom first): 2D graph title-search → local graph SVG → view-transition numeral morph → idle tour → year tabs (keep category chips) → mosaic reveal. Never cut: opt-in publish, check-content/check-dist, poster hero, timeline, resume + PDF.

**Post-launch backlog (after Nov 1)**: Three.js hero renderer reusing `graph.json`; 2D graph pan/zoom and drag; note transclusion; per-page OG cards (satori); notes RSS; contact form via a free form service; real 301s via `@astrojs/vercel`; Obsidian Git one-key publish (after verifying it in the subfolder layout with the worktree separation); migration of `remark-vault` to Sätteri mdast plugins; light theme; tag-hub toggle in the hero; move the resume PDF to a Vercel Function only once react-pdf ships pdfkit ≥ 0.20.2.

---

## 17. Open questions for the client

1. **Permanent URL**: confirm the Vercel project name — proposed `hua-tejahempinyo` (→ `https://hua-tejahempinyo.vercel.app`). It cannot be changed later without breaking application links.
2. **Public email**: which address goes on Contact, the resume and `mailto:` (it becomes visible to anyone).
3. **Resume specifics**: should the resume show individual AP scores and any standardised test scores (`profile.tests`), or only "13 APs · AP Scholar with Distinction"? Both the page and the PDF follow whatever is in `profile.md`.
# Handoff — quality (check-content, check-dist, tests, CI, mac scripts)

Owner: quality builder · Date: 2026-09-16/17 · Status: all deliverables in place; unit tests 106/106 green; e2e 26/34 Chromium, 24/34 WebKit (remaining failures are other areas' spec deviations, listed below) · Spec: §4.3–4.5, §8.5, §11, §12.3, §14

## What was built

| File | Purpose |
|---|---|
| `scripts/check-content.ts` | prebuild. Filesystem, frontmatter (shared zod schemas), links, syntax and privacy checks over `content/` (or `$VAULT_DIR`). Every message = `file[:line] — problem` + `fix:` line. `--report md [--out f]`, `--cache f`, `--strict`/`STRICT_LINKS=1`. Writes `node_modules/.cache/hua/unpublished.json`. Exit 1 on any error. |
| `scripts/check-dist.ts` | postbuild. `--dist <dir>` (default `dist`), `--cache`, `--site`. Unpublished title/id leak, 13-digit numbers + PII keywords in text, PII/legal-surname file names, PDFs other than resume.pdf, videos, files > 2 MB, every internal href/src/srcset/og:image resolved with `build.format: 'file'` rules (aggregated per missing target), home JS ≤ 60 KB gz (external `<script src>` + modulepreloads + inline module scripts of index.html), any `_astro/*.js` chunk ≤ 30 KB gz, home CSS ≤ 40 KB gz (warning). `resume.pdf` missing → warning only. |
| `scripts/shrink-images.ts` | `npm run shrink`: rotate, longest edge 2400, JPEG q82 mozjpeg, PNG stays PNG (lossless, palette-quantised only if still > 2 MB), metadata (EXIF/GPS) dropped, atomic in-place write, before/after table. `--dry-run`, `--all`, `--limit <MB>`, `--dir`. |
| `vitest.config.ts`, `tests/unit/*.test.ts` | 8 files / 106 tests, all green (see below). |
| `tests/fixtures/{vault,broken-frontmatter,broken-links,broken-files}` | fixture vaults (49 small files, 196 KB). |
| `playwright.config.ts`, `tests/e2e/*.spec.ts` | Chromium + WebKit, `npx astro preview --port 4321` as webServer, `E2E_BASE_URL` / `E2E_SERVER_CMD` overrides for local runs. |
| `.size-limit.json`, `lighthouserc.json` | budgets (see caveats). |
| `.github/workflows/content-check.yml`, `quality.yml` — **now parked by the coordinator in `.github/workflows-pending/`** (local token lacks the `workflow` scope; its README has the two-command activation) | CI split per §14. `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7` — verified via the GitHub API on 2026-09-16 that the `v7` tags exist (latest releases 7.0.1 / 7.0.0 / 7.0.1). |
| `mac/Check Content.command`, `mac/Preview Site.command` | double-clickable zsh, `chmod +x` done. |

Nothing outside the quality row was edited. No git commands were run. `content/` untouched (shrink was only run with `--dry-run`).

## check-content report against the real vault

Run 1 (2026-09-16 22:54, before the coordinator's overnight content pass) — `1 error in 1 file, 58 warnings — fix in Obsidian and push again`, exit 1:

- ✖ `content/achievements/Thailand Youth National Archery Team — …Winnipeg….md:20` — an HTML comment `<!-- … -->` mentions "passport"; HTML comments are shipped in the page source and check-dist refuses to publish this word. (Verified in the built HTML: `dist/**/*.html` contained every `<!-- TODO (review): … -->` note verbatim.)
- ⚠ 51 files — import-generated `<!-- TODO (review): … -->` comments would ship in View Source (one warning per file, lines listed).
- ⚠ 6 images over 2 MB in `content/media` (5.0, 2.1, 2.0, 2.5, 3.6, 3.2 MB PNGs).
- ⚠ `content/notes/Quant Career Pathway.md:16` — "transcript" used as an ordinary word.

Run 2 (2026-09-17 06:50, current content — someone converted the HTML comments to `%% %%` and ran the shrinker at 06:48; I did not touch `content/`):

```
check-content · content/ · 44 achievements · 12 notes · 2 essays · 88 images

⚠ content/notes/Quant Career Pathway.md:16 — the text contains "transcript"; make sure no school transcript or score report is being described or attached
  fix: nothing to do if this is an ordinary use of the word

Unpublished (never appear on the site): none

0 errors, 1 warning — content is ready to publish
```

Exit 0. Frontmatter, links, ids, cover/certificate case, duplicate ids, GPS EXIF: all clean. 0 unpublished entries. `node scripts/check-content.ts --report md --out r.md` produces the Markdown variant used by the GitHub Issue.

## check-dist report against tonight's build (`/tmp/dist-quality`)

```
check-dist · /tmp/dist-quality
  1509 files, 226 pages, 147497.3 KB total
  0 unpublished entries to keep out (../../../../tmp/hua-cache/unpublished.json)
  37354 internal references checked across 226 pages
  home JS: 5.9 KB gzipped across 7 scripts (limit 60.0 KB)
       1.9 KB  _astro/HeroGraph.astro_astro_type_script_index_0_lang.D_70yBXG.js
       0.1 KB  index.html <script> #1
       0.5 KB  index.html <script> #2
       0.9 KB  index.html <script> #3
       0.3 KB  index.html <script> #4
       0.8 KB  index.html <script> #5
       1.3 KB  index.html <script> #6
  home CSS: 7.9 KB gzipped (limit 40.0 KB)

⚠ dist-quality/notes/quant-career-pathway.html:11 — contains "transcript": "…after Calc BC, linear algebra through a transcripted source” as a lever for a quant application, whi…"
  fix: fine if it is an ordinary use of the word; never attach a school transcript
⚠ dist-quality/notes/quant-career-pathway.html:16 — contains "transcript": "…it, so that goes below once I have the transcript in front of me. What the project brief already ma…"
  fix: fine if it is an ordinary use of the word; never attach a school transcript
⚠ dist-quality/resume.pdf — resume.pdf is missing from the build output
  fix: scripts/resume-pdf.mjs should write it in postbuild before check-dist runs
⚠ dist-quality/resume.json — resume.json is still in the build output (it exists only to feed the PDF script)
  fix: scripts/resume-pdf.mjs deletes it after writing resume.pdf; run the full `npm run build`
⚠ dist-quality/resume.pdf — is linked from 2 pages (contact.html, resume.html) but is not in the build output yet
  fix: scripts/resume-pdf.mjs writes it in postbuild

0 errors, 5 warnings — build output is clean
```

## Unit tests

```
 RUN  v5.0.1 /Users/huachengt./Sites/sasipat-tejahempinyo
 Test Files  8 passed (8)
      Tests  106 passed (106)
   Start at  06:50:11
   Duration  1.32s (import 49%, tests 34%, transform 16%, worker 1%)
```

`npx tsc --noEmit` and `npx astro check`: no diagnostics in `scripts/**`, `tests/**`, `vitest.config.ts`, `playwright.config.ts`. (`astro check` reports 5 pre-existing errors in shared files: `src/plugins/remark-vault.ts:78` ts(2352) and four in `astro.config.mjs` (font family typing, `unified` processor typing) — not mine, listed for the coordinator.)

## E2E

Run against `/tmp/dist-quality` (built 2026-09-17 06:52 with `npx astro build` only, so no postbuild: no `resume.pdf`, `resume.json` still present), served on :4325 by a static server with `format: 'file'` rules (see "astro preview in an agent shell" below). WebKit installed with `npx playwright install webkit`.

**Chromium: 26 passed, 8 failed · WebKit: 24 passed, 1 skipped, 9 failed** (34 specs each).

| Spec | Today | Why / what must land |
|---|---|---|
| routes: every sitemap route 200, no console errors (65 URLs) | ✅ both | |
| routes: `/graph.json`, `/rss.xml`, `/robots.txt`, `/sitemap-index.xml` types; 404 page noindex | ✅ both | |
| home: canvas mounts after load, poster fades, hidden hub list present | ✅ both | |
| home: poster reveals gold hubs, label chip present | ✅ both | |
| home: keyboard order skip → nav → hub → chapter index | ✅ Chromium, skipped WebKit | WebKit/Safari does not Tab to links |
| home: poster visible before JS, canvas hidden | ❌ both | `base.css:16` `canvas { display: block }` defeats the `hidden` attribute → fix `[hidden] { display: none !important }` (coordinator, shared file) |
| home: reduced motion → no canvas | ❌ both | same root cause (the canvas element is rendered, not "never mounted") |
| home: `data-motion=off` → no canvas | ❌ both | same |
| achievements: year tab + chip update `?year=&cat=`, hide entries, All resets | ✅ both | |
| achievements: deep link `?cat=athletics` pre-applies | ✅ both | |
| achievements: `Nº n` index, legal name | ✅ both | |
| achievements: detail page h1, JSON-LD, pagefind body, "Connected" | ✅ both | |
| lightbox: opens, ArrowRight/Left, Escape, focus return | ❌ both | opens fine (`1 / 6`) but **ArrowRight does not advance** (`.pswp__counter` stays `1 / 6`) → achievements builder: check PhotoSwipe `arrowKeys` / keydown wiring (§8.3 "arrows/Esc/focus return") |
| lightbox: certificate slot labelled, stays in colour | ✅ both | |
| notes: backlinks "Linked from" with links, local-graph SVG, pagefind body, "Noah" | ✅ both | |
| notes: `.wl` links, `.wl-missing` never has href | ✅ both | |
| notes: `/notes` tabs, graph panel, list | ✅ both | |
| notes: post has `#comments` (pagefind-ignore, Discussion, GitHub link), no iframe, BlogPosting JSON-LD | ✅ both | giscus script-injection part is skipped until `GISCUS.repoId/categoryId` are filled in `site.config.ts` |
| notes: search dialog opens with ⌘K, `/`, nav button; input appears | ✅ both | |
| notes: `/tags/archery` | ✅ both | |
| resume: `/resume` legal name, Download/Print, section heads | ✅ both | |
| resume: `/resume.pdf` is `application/pdf` | ❌ both | needs `npm run build` (postbuild `resume-pdf.mjs`); expected to pass once the resume builder's script works |
| resume: `/resume.json` not shipped | ❌ both | same (deleted by `resume-pdf.mjs`) |
| mobile 375 px: no horizontal scroll on `/`, `/achievements`, a note; menu dialog | ✅ both | |
| axe: `/`, `/notes`, `/resume` | ✅ both | |
| axe: `/achievements`, a post (and an achievement on WebKit) | ❌ | `color-contrast` serious: `#716f6a` on `#0a0a0b` at 12 px = 3.94:1; posts also `link-in-text-block` → tokens/prose owner (see item 7 below) |

Expected to go green without any change on my side once the shared fixes land: the three home tests (`[hidden]` rule), the two resume tests (postbuild), the axe tests (token contrast), and the lightbox test (arrow keys). CI runs the full `npm run build` first, so the resume ones are only red in this partial local run.

Commands used: `E2E_BASE_URL=http://localhost:4325 npx playwright test --project=chromium` / `--project=webkit`. Reports: `/tmp/e2e-chromium.txt`, `/tmp/e2e-webkit.txt` on this Mac.

## Design decisions the coordinator should know about

- **HTML comments.** Not in the spec, but they are the biggest privacy hole in the current vault. check-content warns per file; an HTML comment containing a hard PII keyword is an error (check-dist would fail anyway).
- **PII keywords in page text.** check-dist errors on `passport | id card | บัตร | score report | 13 digits`; **`transcript` is downgraded to a warning** in both scripts because it is an ordinary word in a podcast/education context (it already appears in a published note). File names still error on `transcript` exactly as the spec says.
- **Unpublished-title matching in check-dist** skips text inside `<span class="wl-missing">…</span>`: that text is the author's own link text in a published note, which by design renders as plain text; otherwise any `[[Draft]]` link would fail the build. Word-boundary matching (Unicode) is used for titles ≥ 3 chars; ids are matched as `/collection/id` and `collection/id` (graph node ids), never as bare words.
- **`_private/` and `.obsidian/`** are skipped by the forbidden-extension scan (gitignored, never leave the Mac). `_inbox/` and `_templates/` are scanned.
- **Home JS measurement** includes inline `<script type="module">` blocks: Astro inlines chunks below `assetsInlineLimit`, so counting only `<script src>` would under-report (tonight all home JS is inline: 2.3 KB gz).
- **Per-chunk 30 KB budget** is enforced by check-dist (size-limit cannot express a per-file max). `.size-limit.json` therefore has: all `_astro/*.js` ≤ 60 KB (an upper bound for home JS), all `_astro/*.css` ≤ 40 KB, `dist/index.html` ≤ 60 KB gz. If total JS across all pages legitimately exceeds 60 KB once every area lands, tighten the first entry to the actual home chunk names (they are visible in check-dist's per-file list).
- **`astro preview` in an agent shell.** Astro 7 detects agent environments and forces a background preview with a project-wide lock; a second builder's preview (port 4330) held the lock tonight, so I served `/tmp/dist-quality` with a 40-line static server that mimics `format: 'file'` rules for the e2e run. `playwright.config.ts` still uses `npx astro preview --port 4321` as required; CI is unaffected.

## Things I found that need changes in files I do not own

1. **Originals are shipped.** Astro copies every image imported through `import.meta.glob` in `src/lib/media.ts` into `dist/_astro/` **unmodified** (67 MB dist tonight, six files > 2 MB, EXIF intact — the "Sharp strips EXIF/GPS from every output" guarantee in §8.4 does not hold for these copies). check-dist fails on the > 2 MB ones. Short term: `npm run shrink` (also strips EXIF for those files); medium term: avoid eager-importing the whole folder (e.g. resolve only the names an entry actually uses, or `inlineStylesheets`-style `build.assets` filtering), or accept and run `shrink --all` once.
2. **Blank optional dates fail the build.** `content/_templates/Achievement.md` ships `endDate:` (null). `optionalDate()` in `src/schemas/common.ts` coerces `null` to 1970-01-01, so every achievement created from the template with `endDate` left blank fails with "endDate must be on or after date" in both check-content and `astro build`. Suggested diff:
   ```ts
   // src/schemas/common.ts
   const blankToUndefined = (v: unknown) => (v === null || v === '' ? undefined : v);
   export const optionalDate = (label: string) => z.preprocess(blankToUndefined, dateField(label).optional());
   // and for optional strings if desired: z.preprocess(blankToUndefined, z.string().trim().optional())
   ```
   check-content already prints `"endDate" is empty, and an empty property fails the build` with the fix line, so the author is not left guessing.
3. **Thai tags lose their vowel/tone marks.** `src/lib/tags.ts` and `src/plugins/remark-vault.ts` match `[\p{L}\p{N}_/-]`; Thai combining marks are `\p{M}`, so `#ธนู` becomes `#ธน`. Suggested change in both regexes: `[\p{L}\p{M}\p{N}_/-]` (and `[\p{L}\p{M}_]` for the "has a letter" test). Covered by a comment in `tests/unit/tags.test.ts`.
4. **Image Converter timestamps vs the PII filename rule.** §4.6 says drops are renamed `<note name>-<timestamp>.jpg`; a millisecond or `YYYYMMDDHHmmss` timestamp is ≥ 10 digits and trips the spec's own `\d{10,}` filename rule in check-content. Set the plugin's timestamp format to something short/separated (e.g. `YYYY-MM-DD-HHmm`) in `content/.obsidian`, or the author will see an error on every new image.
6. **`hidden` is defeated by the reset.** `src/styles/base.css:16` has `img, svg, video, canvas { display: block; … }`. An author-origin `display: block` overrides the UA rule for the `hidden` attribute, so `<canvas class="hero-gl" aria-hidden="true" hidden>` (HeroGraph.astro:15) is *rendered* even without JavaScript and under reduced motion: an invisible, `position: absolute; inset: 0` canvas sits on top of the SVG poster and intercepts clicks on its links. Three home e2e tests fail on exactly this. One-line fix for `src/styles/base.css`:
   ```css
   [hidden] { display: none !important; }
   ```
7. **Contrast token.** axe reports `color-contrast` (serious) on `/achievements`, achievement pages and posts: `#716f6a` on `#0a0a0b` at 12 px normal weight = 3.94:1 (needs 4.5:1). That is the `--fg-3`-style muted mono text (labels, dates, "Nº 23"). Lift the token to about `#8a8782` (≈ 5.0:1) or use `--fg-2` for 12 px text. Also `link-in-text-block` (serious) on posts: prose links are distinguished by colour only in some component; add an underline or a 3:1 contrast against surrounding text. The axe specs will stay red until the tokens owner changes this.
8. **Pagefind body attribute** lives on `<article data-pagefind-body>` rather than `<main>` (§9.4); the e2e specs accept either.
9. `astro check` errors in `src/plugins/remark-vault.ts` and `astro.config.mjs` (see above) — pre-existing, will make the `Types` step of `quality.yml` red until fixed.

## How to verify

```bash
node scripts/check-content.ts                     # real vault, exit 1 tonight (1 error)
node scripts/check-content.ts --report md --out /tmp/r.md
VAULT_DIR=tests/fixtures/broken-links node scripts/check-content.ts --cache /tmp/c.json
node scripts/check-dist.ts --dist /tmp/dist-quality
node scripts/shrink-images.ts --dry-run
npx vitest run
npx playwright test --project=chromium            # needs a build in dist/ (astro preview)
npx size-limit                                    # needs dist/
```

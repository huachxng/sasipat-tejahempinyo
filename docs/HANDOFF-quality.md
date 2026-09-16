# Handoff — quality (check-content, check-dist, tests, CI, mac scripts)

Owner: quality builder · Date: 2026-09-16/17 · Spec: §4.3–4.5, §8.5, §11, §12.3, §14

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
| `.github/workflows/content-check.yml`, `quality.yml` | CI split per §14. `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7` — verified via the GitHub API on 2026-09-16 that the `v7` tags exist (latest releases 7.0.1 / 7.0.0 / 7.0.1). |
| `mac/Check Content.command`, `mac/Preview Site.command` | double-clickable zsh, `chmod +x` done. |

Nothing outside the quality row was edited. No git commands were run. `content/` untouched (shrink was only run with `--dry-run`).

## check-content report against the real vault (2026-09-16 23:0x)

```
REPORT_PLACEHOLDER
```

What this means for the coordinator/author:

1. **1 error (blocks `npm run build` at prebuild):** `content/achievements/Thailand Youth National Archery Team — …Winnipeg….md:20` has an HTML comment that says the folder's letters "contain passport and date-of-birth data". HTML comments are shipped verbatim in the built HTML (verified: `dist/notes/*.html` from the coordinator's build contain the `<!-- TODO … -->` comments), and `check-dist` refuses the word "passport" in page text (§8.5 (4)). The author must delete that comment (or turn it into `%% … %%`). I did not touch content.
2. **51 HTML-comment warnings** (one per file, listing the lines): all the import-generated `<!-- TODO (review): … -->` notes leak into View Source. Not build-blocking, but they are private review notes ("do not publish a placing until confirmed", teammate names, etc.). Recommend a one-off pass converting them to `%% %%` before the first public deploy.
3. **6 images over 2 MB** (warnings in check-content, but **errors in check-dist**, see below). `npm run shrink` fixes them in place; dry run predicts 5.00 → 1.99 MB, 2.05 → 0.90, 2.02 → 0.97, 2.50 → 1.25, 3.60 → 1.64, 3.25 → 1.61 (all PNG, lossless). Run it once (it edits `content/media`, which is author-owned, so it is the coordinator's/author's call).
4. `transcript` appears twice as an ordinary word in `notes/Quant Career Pathway.md` — warning only (see design decision below).
5. Frontmatter, links, ids, cover/certificate case, duplicate ids, GPS EXIF: all clean. 0 unpublished entries today.

## check-dist report against tonight's build (`/tmp/dist-quality`)

```
CHECKDIST_PLACEHOLDER
```

## Unit tests

```
VITEST_PLACEHOLDER
```

`npx tsc --noEmit` and `npx astro check`: no diagnostics in `scripts/**`, `tests/**`, `vitest.config.ts`, `playwright.config.ts`. (`astro check` reports 5 pre-existing errors in shared files: `src/plugins/remark-vault.ts:78` ts(2352) and four in `astro.config.mjs` (font family typing, `unified` processor typing) — not mine, listed for the coordinator.)

## E2E

E2E_PLACEHOLDER

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
5. `astro check` errors in `src/plugins/remark-vault.ts` and `astro.config.mjs` (see above) — pre-existing, will make the `Types` step of `quality.yml` red until fixed.

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

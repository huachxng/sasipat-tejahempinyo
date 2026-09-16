# Handoff — resume (chapter 04)

## What was built (all inside the resume row of the ownership table)

| File | Purpose |
|---|---|
| `src/lib/resume.ts` | `buildResumeModel(achievements, profile, { cap? })` → `{ header, education, sections: [{ title, items, more }], skills, languages, coursework, tests, count, fileName, siteUrl }`. Plain TS (imports only `site.config.ts` and `lib/dates.ts`, no `astro:*`), so Node and vitest import it directly. Also exports `legalName`, `parseLink`, `prettyUrl`, `sectionOf`, `toResumeItem`. |
| `src/pages/resume.json.ts` | Static endpoint serialising the model from `getPublished('achievements')` + `getProfile()`. Exists only in the build; the PDF script deletes it. |
| `src/pages/resume.astro` | Chapter 04. `<ChapterHeader slug="resume">` carries the actions row (**Download PDF** `href="/resume.pdf" download="Sasipat-Tejahempinyo-Resume.pdf"`, **Print** → `window.print()`, revealed by a 4-line inline script so it never shows without JS). Then the off-white paper panel (max 820 px) that mirrors the print layout, then `<ChapterNext current="resume" />`. |
| `src/styles/resume.css` | Paper + print rules. Global `print.css` is untouched; page rules hide the chapter header/next, the actions and the "more" disclosures when printing and set 10.5 pt Inter, 9 pt mono uppercase section heads, gold 1 px rules, `break-inside: avoid` on items. |
| `scripts/resume-pdf.mjs` | postbuild: reads `<dist>/resume.json`, renders `<dist>/resume.pdf` with react-pdf 4.9.0 (`React.createElement`, `Page size="LETTER"`, same section order as the page, title/author/subject/keywords/language metadata), then deletes `resume.json`. Exits 1 with a readable message when the JSON is missing, unparsable, not a resume model, or a font file is absent. |
| `tests/unit/resume.test.ts` | 12 vitest cases: category → section mapping, default line + `dateRange`, `resumeLine`/`resumeSection` overrides, `resume: false` exclusion, cap + overflow (`more`), date-desc ordering, fixed section order, legal-name header (no "Noah" anywhere in the JSON), education lines, JSON round trip, helpers. |

### Model rules (spec §10)
- Input: published achievements with `resume !== false`. Section = `resumeSection ?? RESUME_SECTION_BY_CATEGORY[category]`; order = `RESUME_SECTIONS`; empty sections omitted.
- Line = `resumeLine ?? "{title} — {org}, {result}"` (falls back to `"{title} — {result}"` when there is no org). Date text = `dateRange(date, endDate, dateText)`. Items sort date desc (tie: endDate desc, then title). `href = /achievements/<id>`.
- Cap = `RESUME_SECTION_CAP` (8); `items` holds the newest `cap`, `more` the rest. The page shows `more` under a `<details class="more no-print">` disclosure; the PDF and print omit it. Today no section exceeds the cap (largest: Honors & Awards and Athletics with 6 each).
- Header: **legal name** ("Sasipat Tejahempinyo": `profile.name` with the parenthesised nickname stripped, falling back to `PERSON.legalName`), headline (`resumeHeadline ?? headline`), then one contact line: "Goes by Hua · Bangkok, Thailand · email · github.com/huachxng" (+ any other `profile.links`). The nickname is kept out of the name so the e2e "contains the legal name" substring check works on both the page and the PDF. No pen name anywhere on the paper or in the JSON.
- Education: a generated school line (`"BASIS International School Bangkok — Class of 2027"`) first, then `profile.education` with empty `()` placeholders removed (`"Stanford University ()"` → `"Stanford University"`). If the author writes a fuller school line in `profile.education` themselves, that line wins and the generated one is dropped. Achievements with `resumeSection: Education` are listed under Education after those lines (the "High Honors track / GPA" entry is `category: academics`, so it sits under Honors & Awards unless the author sets `resumeSection: Education` on it).
- Skills block: `profile.skills` joined with " · ", then Languages / Coursework / Tests rows when non-empty.

## Dependency added
`@fontsource/inter@5.3.0` (exact, `dependencies`, OFL-1.1; latest 5.x — the brief's 5.2.8 is older). Used only by `scripts/resume-pdf.mjs`, which registers `node_modules/@fontsource/inter/files/inter-latin-{400,600}-normal.woff` by **absolute path** (`path.resolve(<repo root>, ...)`). react-pdf/fontkit read the WOFF files without complaint, so no TTFs were copied into `src/assets/fonts/` (the folder stays empty).

## postbuild expectation (exact)
`package.json` already has `"postbuild": "node scripts/resume-pdf.mjs && node scripts/check-dist.ts"`. The script runs **from the repo root** with the default `dist/`:
1. `astro build` writes `dist/resume.json` (from `src/pages/resume.json.ts`) and `dist/resume.html`.
2. `node scripts/resume-pdf.mjs` reads `dist/resume.json`, writes `dist/resume.pdf`, deletes `dist/resume.json`, prints `✔ resume-pdf: dist/resume.pdf — N pages, NN KB, 29 entries (Sasipat Tejahempinyo)`. `DIST_DIR=<path>` overrides `dist` (relative to cwd). It warns (does not fail) above two pages with a fix line pointing at `resume: false` / `RESUME_SECTION_CAP`. Set `SOURCE_DATE_EPOCH` for byte-identical output (creation/modification dates); without it only the two date strings differ between runs.
3. `check-dist` then sees `resume.pdf` (the only PDF) and no `resume.json`.
Vercel's Build Command must stay `npm run build` so the lifecycle hooks run (spec §10/§12).

## How to verify
```
npx vitest run tests/unit/resume.test.ts                      # 12 passing
npx astro build --outDir /tmp/dist-resume
DIST_DIR=/tmp/dist-resume node scripts/resume-pdf.mjs         # → /tmp/dist-resume/resume.pdf, resume.json removed
DIST_DIR=/tmp/nowhere node scripts/resume-pdf.mjs; echo $?    # readable "resume.json is missing" message, exit 1
```
Then open `/resume` (chapter header, actions row, paper) and `/resume.pdf`. Print preview of `/resume` shows only the paper on Letter with .6 in margins.

### Verified on this machine (2026-09-16)
- Unit test: 12/12. `astro check`: zero errors or warnings in resume-owned files.
- The full `astro build` of the shared checkout could not complete during my run **because of other builders' in-progress files**, not the resume: attempts died in turn on `/graph.json` and `/achievements/<id>` (`getGraph()` in `src/lib/graph.ts`: "Cannot read properties of undefined (reading 'map')") and once in Vite on a syntax error in `src/scripts/graph-render.ts:35`. Neither file is in the resume row, and Astro aborts before it reaches `/resume`.
- So the resume routes were built in isolation with the real pipeline: a scratch copy of the repo containing only `src/pages/resume.astro` + `resume.json.ts` (shared layout, components, config, `content/`, `public/` and `node_modules` unchanged) → `npx astro build` → **Complete**, `dist/resume.html` + `dist/resume.json`; then `DIST_DIR=<that dist> node scripts/resume-pdf.mjs` → `✔ resume-pdf: …/resume.pdf — 2 pages, 40 KB, 29 entries (Sasipat Tejahempinyo)`, `resume.json` removed. The built HTML has the legal name in the `<h2>`, 9 section heads in the fixed order, 29 item links each carrying the entry title in `title=""`, and `href="/resume.pdf" download="Sasipat-Tejahempinyo-Resume.pdf"`; no "Noah" inside the paper.
- The same page was also checked on the live dev server (same `getPublished()` + `buildResumeModel()` path): `/resume` → 200 with identical markup.
- PDF: Inter 400/600 subset-embedded (searchable text), metadata Title "Sasipat Tejahempinyo — Resume", Author, Subject = headline, Language en; byte-identical across two runs with `SOURCE_DATE_EPOCH`. Missing-JSON path exits 1 with the fix line. Visual check of both pages: header, Education, Research, Honors & Awards, Athletics, Leadership & Service (page 1), Ventures & Media, Arts & Music, Programs, Skills (page 2, ~70 % full). One page is not reachable with 29 entries at a legible size (≈1.7 pages of content); it drops to one page once the author trims to roughly 17–18 entries with `resume: false`.
- Playwright screenshots of `/resume` at 1280×800, 1024×768, full page and 390 px: paper centred, actions visible, no horizontal scroll; browser print-to-PDF of `/resume` gives the same two-page layout as the generated PDF with the chrome hidden.
- Please re-run `npx astro build --outDir /tmp/dist-resume && DIST_DIR=/tmp/dist-resume node scripts/resume-pdf.mjs` once the hero files compile; nothing on the resume side should need changing.

## Notes for the coordinator (no shared-file diffs required)
- `src/styles/resume.css` ends with `.page-resume .now-indicator { mix-blend-mode: difference; }`: the fixed Now indicator (shared `NowIndicator.astro`, z-index 70, `--fg-2` text) crosses the light paper between roughly 640 and 1400 px viewport width and was unreadable there; the blend inverts it over the paper only on this page (verified at 1280 and 1024). Caveat: between ~641 and ~900 px the gold dot can sit over the paper's left edge and blend to blue; drop the rule if you would rather move or hide the indicator there.
- Astro 7 runs one managed `astro dev` per project ("Dev server already running at http://127.0.0.1:4316"); a second builder needs `npx astro dev --port <port> --ignore-lock`. `astro preview` has the same manager (`astro preview stop`). Nothing in the resume row starts or stops servers; my only preview ran from a scratch copy and was stopped.
- Author-facing (content is author-owned, not changed): `profile.md` `education` entries still have empty `()` placeholders ("Stanford University ()"); the model strips them, but the author will want to add years/programmes. The `headline` doubles as the resume headline until `resumeHeadline` is set.
- e2e hooks for the quality builder: `/resume` contains every `resume: true` entry's `title` in the item link's `title` attribute (visible text is the `resumeLine`); `/resume.pdf` is `application/pdf`, contains "Sasipat Tejahempinyo"; the model JSON never contains the pen name.

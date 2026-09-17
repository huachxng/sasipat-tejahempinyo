# Handoff — research (chapter 03, BIS chart)

Plan: `docs/superpowers/plans/2026-09-17-research-openers.md` §4, §5, §7 and the research parts of §9. Sections 2, 3 and 6 (scroll scenes, openers) belong to the openers builder; nothing here touches `scroll-scene.ts`, `scene.css` or the opener components.

## What was built

| File | Role |
|---|---|
| `src/lib/bis.ts` | Plain TS (no `astro:*`). CSV parser + validator (`parseBisCsv`, `validateBisCsv`, `BisCsvError` with `line`/`fix`), memoised `loadBis(): BisData`, constants `BIS_DANGER`, `BIS_EPISODES`, `BIS_SIGNATURES`, `BIS_WARNINGS`, lookups `rowAt`, `episodeRange`, `signatureRows`, `threeWay`, geometry `pathD`, `niceDomain`, `yOf`, `fmtZ`, `monthName`, and `bisChartHtml(data, opts)` (the whole figure as a string; used by `BisChart.astro` via `set:html`). Also `buildBis(rows)` / `resetBis()` for tests. |
| `src/pages/research/index.astro` | `<ResearchOpener />`, `<BisChart />` in `section.bis-section.ruled`, method (4 × h2+p, `data-pagefind-body`, `data-pagefind-filter="type:Research"`), three-way table with a Latest row (`▲` + `.is-hot` at ≥ +1.5, L for 2007-12 underlined via `.is-l`), Paper block (SSRN badge only when an achievement `links` host contains `ssrn`, else the muted "SSRN working paper: October 2026" line), note links via `resolveWikilink` (unpublished → plain text), Sources list, Download CSV, `dataset()` JSON-LD, `<ChapterNext current="research" />`. Imports `scene.css` (openers) and `research.css`. |
| `src/components/BisChart.astro` | Thin: `bisChartHtml(loadBis(), props)` + `<script src="../scripts/bis-chart.ts">`. Props = `BisChartOptions` (`id`, `zoom`, `pillars`, `csvHref`, `title`, `dek`) so a future `bis-chart` remark fence can reuse it. |
| `src/scripts/bis-chart.ts` | 2.8 KB gz. Zoom = viewBox writes (280 ms tween unless `motionOff()`), pillar toggles (`hidden` on the path, y domain switch), pointer/touch cursor + tooltip (DOM built with `textContent`), keyboard cursor on the focusable frame (←/→ ±1, Shift ±12, PageUp/Down ±60, Home/End, Esc), debounced `aria-live` output, signature buttons jump + focus the frame, URL state `?zoom=dotcom&pillars=v,l` (`replaceState`, other params preserved), bfcache `pageshow` relayout. Initialises every `[data-bis]`; URL state only for the first. |
| `src/styles/research.css` | Chart colours (`--bis-v #7fb3d5` solid, `--bis-l #e07a5f` dashed 6 3, `--bis-s #8fbf8f` dotted 1.5 3, `--bis-c #b39ddb` dash-dot 6 3 1.5 3), composite `--fg` 1.5 px, danger line + cursor + markers `--gold`, bands `--fg` at 4.5 % alpha, HTML axes in mono `--t-label`; `aspect-ratio: 12/5` desktop, `4/3` ≤ 639 px (signature text hidden there, dots stay; tooltip anchored to the plot corner). Method, table, sidebar styles. `--bis-*` also defined on `.page-research` so the opener can reuse them. |
| `src/pages/data/bis_panel_monthly.csv.ts` | Static endpoint, `text/csv; charset=utf-8`; calls `loadBis()` first so a broken CSV fails here too. |
| `src/lib/jsonld.ts` | `dataset({ first, last, sameAs?, license? })` appended (default licence CC BY 4.0). Nothing else in the file changed. |
| `scripts/check-content.ts` | New rule after profile.md: CSV absent → **warning** ("the Research chart has no data yet…", fix: copy from the R project); present → `validateBisCsv` problems with line numbers as errors/warnings. One import added (`../src/lib/bis.ts`). |
| `tests/unit/bis.test.ts` | 26 tests: parser (BOM/CRLF/NA/extra columns/order), every validation failure with its line, `buildBis` on the fixture, geometry (`pathD` gaps, `niceDomain`, `fmtZ`), `bisChartHtml` output, and the real file (signatures 2000-02 ≈ 2.201, 2007-12 ≈ 0.345 with L ≈ 2.107, 2020-12 ≈ 1.625; skipped with `describe.skipIf` when the CSV is absent). |
| `tests/unit/check-content.test.ts` | Two cases appended: `broken-data` fixture → `✖ content/data/bis_panel_monthly.csv:<line> — 1 month is missing between 1995-06 and 1995-08`, exit 1; clean fixture still exits 0 and now prints the "no data yet" warning. |
| `tests/fixtures/data/bis_small.csv`, `tests/fixtures/broken-data/**` | 160-row synthetic panel (1990-01…2003-04, NA head on S/BIS, NA tail on C, forced peak 2.5 at 2000-02, CRLF); a vault fixture with the same CSV minus 1995-07. |
| `tests/e2e/research.spec.ts` | 7 tests × 2 browsers: no-JS render (paths, hidden pillars, 3 signature buttons, 4 method h2, table rows, legal name, CSV 200 `text/csv`, `"Dataset"` in ld+json), hover tooltip, keyboard cursor + live region + Home/End, chips/zoom/URL round-trip, deep link, signature jump, phone overflow + tap. |
| `.size-limit.json` | Entry `dist/_astro/BisChart*.js ≤ 8 KB` gz. |

## Numbers

- Real panel: 500 rows 1985-01 → 2026-08, plot N = 380 from 1995-01, `lastScored` 2026-08, `yDomains.composite = [-3, 3]`, `yDomains.all = [-7, 6]`; the real file validates with zero problems.
- `/research.html`: 79 KB raw / 27 KB gz (5 paths + 16.5 KB inline JSON payload). Chart chunk `BisChart.astro_astro_type_script_*.js`: **2 860 B gz** (limit 8 KB). `/data/bis_panel_monthly.csv`: 136 KB.
- `npx vitest run`: 14 files, 196 tests green. `npx astro check`: 0 errors, 0 warnings (4 pre-existing hints, none in these files). `npx astro build --outDir /tmp/dist-research`: passes.
- Dataviz validator on the four pillar hexes (dark surface `#0a0a0b`): contrast PASS (all ≥ 3:1), normal-vision separation PASS (worst 17.3), CVD separation WARN (L↔S ΔE 7.4, in the 6–8 band, legal with the dash-pattern secondary encoding the plan mandates), lightness-band and chroma-floor FAIL against the skill's reference bands (the hexes are the plan's; they are deliberately muted so the white composite stays dominant). Kept as specified; flagging in case the coordinator wants brighter pillar tones.

## How to verify

```
npx vitest run tests/unit/bis.test.ts tests/unit/check-content.test.ts
npx astro build --outDir /tmp/dist-research
npx astro preview --outDir /tmp/dist-research --port 4313      # or ASTRO_DEV_BACKGROUND=1 npx astro dev --port 4313 --ignore-lock
E2E_BASE_URL=http://localhost:4313 E2E_SERVER_CMD='sleep 1' npx playwright test tests/e2e/research.spec.ts
```
Manual: open `/research`, hover the plot (tooltip flips past 65 %), Tab to the frame and press → / Shift+→ / End, click "V Valuation" and "Dot-com" (URL becomes `?pillars=v&zoom=dotcom`), reload (state restored), toggle the footer motion switch (zoom stops tweening), load with JS off (static SVG, bands, danger line, table, CSV link).

## Notes for the coordinator

- The preview slot was held by another builder (port 4316), so verification ran on `astro dev --port 4313 --ignore-lock` against the same source as the `/tmp/dist-research` build; the build itself is green.
- `validateBisCsv` does **not** warn about extra columns (the R export ships `z_cape`, `s_vix_adj`, … alongside `month,V,L,S,C,BIS`); a warning on every push would be noise. The plan's "extra columns warn" was dropped deliberately.
- Interior-NA runs are a warning (line-numbered), never an error; the real file has none.
- Table `sr-only` spans are absolutely positioned; `.bis-table-wrap` is `position: relative` so they cannot widen the page (this was the phone overflow found during verification).
- Openers contract honoured: `loadBis`, `pathD`, `BIS_*`, `rowAt`, `episodeRange`, `signatureRows`, `threeWay`, `niceDomain`, `bisChartHtml` exported from `src/lib/bis.ts`; plot rows carry `index` = x coordinate; `pathD` uses array position as x and starts a new `M` after nulls.
- No shared files edited beyond the allowed ones (`src/lib/jsonld.ts` append, `scripts/check-content.ts` rule, `.size-limit.json` entry, `tests/unit/check-content.test.ts` append). `content/README.md` already documents `data/`; untouched.
- Backlog unchanged from the plan: `bis-chart` fence in notes, author-owned method copy, `ScholarlyArticle` JSON-LD once the SSRN URL lands in the achievement's `links` (the page and `dataset().sameAs` pick it up automatically).

# Handoff — archery (v0.2)

Design: `docs/superpowers/plans/2026-09-17-archery.md`. Everything below is implemented in the plan's task order. No git commands were run.

## What was built

| File | Change |
|---|---|
| `src/lib/archery.ts` (new) | Tolerant parser for `scores` lines (`Round \| score \| details`), derivations (`maxOf`, `averagePerArrow`, `bestScore`), readout formatters, `ordinal`, `ringFor` / `radiusFor` (mapping documented in the file header), `shortTitle`, `scoreProblems`, and `archeryPresentation()` — the single place that decides target / compact badge / nothing. Plain TS, no `astro:*`. |
| `tests/unit/archery.test.ts` (new) | Grammar (six examples + garbage cases), variants (`of`, `pts`, metres, colon, sets), derivations, formatting, `bestScore` tie rule, presentation for the six real frontmatters and a non-athletics entry, and the schema cases (Kasetsart block accepted; blank → absent; `[560]` → `['560']`; `placing` 0 / 4 / 2.5 / "second" rejected with the one message). |
| `src/schemas/common.ts` | New `emptyAsAbsent(schema)`; `optionalDate` now uses it. |
| `src/schemas/achievement.ts` | Four flat optional fields: `scores` (numbers coerced to text, default `[]`), `placing` (integer 1–3, author-facing message), `division`, `distance` (blank → absent). |
| `scripts/check-content.ts` (score rules only) | Achievements: unparseable `scores` line → warning with the expected form in the fix; total > max / total > arrows × 10 / max ≠ arrows × 10 → warning; `scores`/`placing` on a non-athletics entry → warning. `placing` out of range arrives from zod as an error through the existing generic branch. |
| `tests/fixtures/broken-frontmatter/achievements/Bad Score.md`, `…/Scores Elsewhere.md` (new); `tests/fixtures/vault/achievements/Ach 1.md` (fields added, no new file) | Fixtures for the three rules; the clean vault still reports `0 errors` and no `scores:` warning. `graph.test.ts` node counts unchanged. |
| `tests/unit/check-content.test.ts` | Four new assertions (exact lines). |
| `content/.obsidian/types.json` | `scores: multitext`, `placing: number`, `division: text`, `distance: text`. |
| `content/_templates/Achievement.md` | `scores: []` after `links: []`, preceded by two YAML comment lines with the form and an example. |
| `content/README.md` | New line 9 "Archery scores"; later items renumbered 10–12. |
| Six archery entries | Frontmatter only, see "Exact frontmatter added" below. WAYC untouched. |
| `src/components/ArcheryTarget.astro` (new) | Zero-JS SVG target (`role="img"`, `<title>`/`<desc>`), ten stroked rings lit outside-in on `:hover` / `:focus-within` (45 ms stagger, instant under reduced motion or `html[data-motion="off"]`), gold band wash + 1 px `--gold-2` average circle + rotated square marker, mono readout, placing badge, division/distance chips, "Archery record ↓" link (the focusable child). Compact variant = 44 px placing badge + chips. Renders nothing for WAYC. |
| `src/components/ArcheryRecord.astro` (new) | `#archery-record` panel: heading + "6 competitions · 2023–2025 · 5 podiums", decorative SVG (avg band with 7/8/9 rules, placing rows, "competed" row, current mark outlined in `--gold-2`), year labels, accessible `<ol>` with `aria-current="page"`. `data-pagefind-ignore`. |
| `src/pages/achievements/[id].astro` (mount only) | `getStaticPaths` passes `athletics` (all published athletics entries, oldest first) to athletics pages; `<ArcheryTarget>` sits between the `<dl>` and `.ach-share` in `.ach-meta`; `<ArcheryRecord>` renders below `.ach-detail-body` when there are ≥ 2 athletics entries. |
| `src/styles/achievements.css` | Appended block `/* ---------- Archery: target face, placing badge, record panel … */` (see the race note below). No new JS. |
| `src/lib/resume.ts` (score fallback only) + `tests/unit/resume.test.ts` | `scores?: string[]` on the input; when `resumeLine` is absent and `result` does not already quote the total, ` (560/720, 72 arrows, 70 m)` is appended. All six entries have `resumeLine`, so `/resume` and the PDF are unchanged today. |
| `tests/e2e/achievements.spec.ts`, `tests/e2e/axe.spec.ts`, `tests/e2e/helpers.ts` | `describe('archery')` (Kasetsart target + record, Nonthaburi badge, WAYC none + "competed" row); Kasetsart page added to the axe list; `KNOWN.archery`. |

## Exact frontmatter added (all inserted directly after the `certificate:` line)

`content/achievements/23rd Kasetsart Open Archery Competition — 1st Runner-Up, Recurve Women Under-25 70 m.md`
```yaml
scores: ["Ranking round | 560/720 | 72 arrows | 70 m"]
placing: 2
division: "Recurve Women Under-25"
distance: "70 m"
```
`content/achievements/Nonthaburi Cup Archery Competition 2023 — Winner, Recurve U15 Women.md`
```yaml
placing: 1
division: "Recurve U15 Women"
```
`content/achievements/Ratchaburi Championship 2024 — 2nd Runner-Up, Recurve Under-18 Women 18 m.md`
```yaml
placing: 3
division: "Recurve Under-18 Women"
distance: "18 m"
```
`content/achievements/49th National Games Region 5 Qualifier ('Ozaburi Games') — 2nd Runner-Up, Women's Recurve 18 m.md`
```yaml
placing: 3
division: "Women's Recurve"
distance: "18 m"
```
`content/achievements/11th Navy Archer Open 2024 — Two Podiums (Recurve Women U15; Recurve Open Women).md`
```yaml
placing: 2
division: "Recurve Women U15 / Open Women"
```
`content/achievements/Thailand Youth National Archery Team — 2025 World Archery Youth Championships, Winnipeg (Recurve Under-18 Women).md` — **nothing added** (open TODO on placing and youth distance).

These are author-owned files: the client should see this list (CLAUDE.md rule). The four `placing` lines are the "recommended" set from plan §7; the e2e "Nonthaburi shows a placing badge" case depends on the first one.

## Verification (all run on this checkout)

- `npx vitest run` — 14 files, 196 tests green (archery 24, check-content +4, resume +3).
- `node scripts/check-content.ts` on the real vault — `0 errors, 1 warning` (the warning is pre-existing and unrelated to scores).
- `npx astro check` — 0 errors; no new diagnostics in the archery files (`emptyAsAbsent` uses `z.ZodType`, not the deprecated `ZodTypeAny`).
- `npx astro build --outDir /tmp/dist-archery` — 223 pages, exit 0.
- Screenshots at 1280×800 and 375×812 of Kasetsart (rest + hover), Nonthaburi and WAYC: target face in the metadata column with ring 8 highlighted, readout `560 / 720 · 72 arrows · 70 m · avg 7.8`, `2ND` badge and division chip; Nonthaburi `1ST` badge with no SVG; WAYC no target/badge, record panel with WAYC on the "competed" row and its row in gold.
- E2E against the built output on port 4312: `npx playwright test tests/e2e/achievements.spec.ts tests/e2e/axe.spec.ts -g "archery|kasetsart" --project=chromium --project=webkit` — 8 passed (3 archery cases × 2 browsers + the Kasetsart axe page × 2).

To reproduce: build, serve the dist (the `astro preview` slot on 4312 may be taken; any static server with `path → path.html` routing works), then run the command above with `E2E_BASE_URL=http://localhost:<port> E2E_SERVER_CMD='sleep 1'`.

## For the coordinator

1. **`src/styles/achievements.css` race.** The OPENERS builder appended their "Opener" block from a copy that predated my append, which dropped my "Archery" block once; I re-appended it after theirs. Before merging, confirm the file ends with the block whose header is `/* ---------- Archery: target face, placing badge, record panel (ArcheryTarget / ArcheryRecord) ---------- */` and that the "Opener" block is still present (both should be: `grep -c "Archery: target face\|Opener (scroll scene" src/styles/achievements.css` → 2). If the Archery block is missing again, the full block is in the appendix below; it is append-only and self-contained.
2. `scripts/check-content.ts` now also carries the research builder's `validateBisCsv` import; my change is the `parseScore, scoreProblems` import plus the "archery scores" block just before `// future dates`.
3. Two extra fixture files live in `tests/fixtures/broken-frontmatter/achievements/` (`Bad Score.md`, `Scores Elsewhere.md`); nothing was added to `tests/fixtures/vault`.
4. Suggest to the client: trim Kasetsart's `result` to `1st runner-up, Recurve Women Under-25 70 m` now that the target readout carries the 560 (plan §11, cosmetic duplication only).
5. The record panel's summary says "5 podiums" (the plan's example said 4 before Kasetsart's own `placing: 2` was added).

## Appendix — the Archery CSS block (append to the end of `src/styles/achievements.css` if missing)

```css
/* ---------- Archery: target face, placing badge, record panel (ArcheryTarget / ArcheryRecord) ---------- */
.ach-archery { margin: 1.25rem 0 0; padding-top: 1rem; border-top: 1px solid var(--rule); --size: 260px; }
.ach-archery svg { display: block; width: min(100%, var(--size)); height: auto; overflow: visible; }
/* Stroked rings: one element per ring so each can be lit on its own. Rest/lit opacities per ring value; colour by ring family. */
.ach-archery .ring { fill: none; stroke: currentColor; stroke-width: 9.4; opacity: var(--rest); transition: opacity var(--d-small) var(--ease-out-expo); transition-delay: calc(var(--i, 0) * 45ms); }
.ach-archery .ring[data-v='10'] { fill: currentColor; stroke: none; color: var(--gold-2); --rest: 0.5; --lit: 1; }
.ach-archery .ring[data-v='9'] { color: var(--gold-dim); --rest: 0.75; --lit: 1; }
.ach-archery .ring[data-v='8'] { color: var(--fg-2); --rest: 0.26; --lit: 0.55; }
.ach-archery .ring[data-v='7'] { color: var(--fg-2); --rest: 0.2; --lit: 0.45; }
.ach-archery .ring[data-v='6'] { color: var(--fg-3); --rest: 0.22; --lit: 0.48; }
.ach-archery .ring[data-v='5'] { color: var(--fg-3); --rest: 0.16; --lit: 0.4; }
.ach-archery .ring[data-v='4'] { color: var(--edge); --rest: 0.55; --lit: 1; }
.ach-archery .ring[data-v='3'] { color: var(--edge); --rest: 0.45; --lit: 0.8; }
.ach-archery .ring[data-v='2'] { color: var(--fg); --rest: 0.14; --lit: 0.3; }
.ach-archery .ring[data-v='1'] { color: var(--fg); --rest: 0.1; --lit: 0.24; }
.ach-archery .ring.is-avg { opacity: calc(var(--rest) + 0.14); }
.ach-archery:hover .ring, .ach-archery:focus-within .ring { opacity: var(--lit); }
.ach-archery .x-ring { fill: none; stroke: var(--gold-ink); stroke-width: 0.75; opacity: 0.5; }
.ach-archery .avg-band { fill: none; stroke: var(--gold); stroke-width: 9.4; opacity: 0.12; }
.ach-archery .avg-circle { fill: none; stroke: var(--gold-2); stroke-width: 1; }
.ach-archery .avg-mark { fill: var(--gold-2); }
@media (prefers-reduced-motion: reduce) { .ach-archery .ring { transition: none; } }
html[data-motion='off'] .ach-archery .ring { transition: none; }
.ach-archery figcaption { margin-top: 0.9rem; display: grid; gap: 0.65rem; }
.ach-archery-readout { margin: 0; display: flex; flex-wrap: wrap; gap: 0.2em 0.5em; font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums; font-size: 13px; letter-spacing: 0.02em; color: var(--fg); }
.ach-archery-readout .grp { display: inline-flex; gap: 0.35em; }
.ach-archery-readout .n { font-weight: 500; }
.ach-archery-readout .u, .ach-archery-readout .sep { color: var(--fg-3); }
.ach-archery-tags { margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.ach-placing { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--gold); color: var(--gold); font-family: var(--font-mono), monospace; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; }
.ach-archery--compact { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.ach-archery-link { margin-left: auto; font-family: var(--font-mono), monospace; font-size: var(--t-label); text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-2); }
.ach-archery-link:hover { color: var(--gold); text-decoration: none; }

.ach-record { margin-top: clamp(40px, 8vh, 96px); padding-top: 1.5rem; border-top: 1px solid var(--rule); }
.ach-record-inner { max-width: 62rem; }
.ach-record-head { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: baseline; margin: 0 0 1rem; }
.ach-record-head h2 { margin: 0; }
.ach-record-sum { margin: 0; font-size: 12px; letter-spacing: 0.04em; color: var(--fg-3); }
.ach-record-chart { display: block; width: 100%; height: auto; overflow: visible; }
.ach-record-chart .rec-rule { stroke: var(--rule); stroke-width: 1; }
.ach-record-chart .rec-rule--dotted { stroke-dasharray: 1 4; }
.ach-record-chart .rec-base { stroke: var(--rule-strong); stroke-width: 1; }
.ach-record-chart .rec-tick { stroke: var(--rule); stroke-width: 1; }
.ach-record-chart .rec-square { fill: none; stroke-width: 1; }
.ach-record-chart .rec-mark--avg .rec-square { fill: var(--gold); stroke: none; }
.ach-record-chart .rec-mark--placing .rec-square { stroke: var(--gold); }
.ach-record-chart .rec-mark--competed .rec-square { stroke: var(--fg-3); }
.ach-record-chart .rec-current { fill: none; stroke: var(--gold-2); stroke-width: 1; }
.ach-record-chart .is-current .rec-tick { stroke: var(--gold-dim); }
.ach-record-years { display: flex; justify-content: space-between; margin-top: 0.4rem; font-size: 11px; letter-spacing: 0.08em; color: var(--fg-3); }
.ach-record-list { list-style: none; margin: 1.25rem 0 0; padding: 0; font-size: 13px; }
.ach-record-list li { display: grid; grid-template-columns: 9em minmax(0, 1fr) auto; gap: 0.35rem 1rem; align-items: baseline; padding: 0.6rem 0; border-top: 1px solid var(--rule); }
.ach-record-list li:last-child { border-bottom: 1px solid var(--rule); }
.ach-record-list time { color: var(--fg-3); font-size: 12px; letter-spacing: 0.04em; }
.ach-record-list a { color: var(--fg); }
.ach-record-list a:hover { color: var(--gold); }
.ach-record-list a[aria-current='page'] { color: var(--gold); }
.ach-record-result { color: var(--fg-2); text-align: right; white-space: nowrap; }
@media (max-width: 640px) { .ach-record-list li { grid-template-columns: minmax(0, 1fr) auto; } .ach-record-list time { grid-column: 1 / -1; } }
```

# CLAUDE.md — sasipat-tejahempinyo

Personal portfolio + notes site for Sasipat "Hua" Tejahempinyo (writes as Noah). Astro 7 static site, content is an Obsidian vault in `content/`, deployed on Vercel at https://sasipat-tejahempinyo.vercel.app. Design spec: `docs/superpowers/specs/2026-09-16-portfolio-site-design.md`. Build conventions and file ownership: `docs/BUILD-BRIEF.md`.

## Rules that protect the author
- The author is content-only. They edit `content/**` in Obsidian and push with GitHub Desktop. Never restructure `content/` or rename their notes without asking; never edit their prose to "improve" it.
- `publish: true` is the only switch that makes a note public. Read collections only through `src/lib/published.ts` (a unit test enforces this). `content/_private/` is git-ignored; `_inbox/` and `_templates/` are never built.
- Privacy: no ID numbers, passport data, phone numbers, addresses. `scripts/check-content.ts` (prebuild) and `scripts/check-dist.ts` (postbuild) fail the build on leaks. Held-back images and open questions live in `content/_inbox/Review checklist.md`.
- Names: legal name on achievements, resume, About and JSON-LD; "Noah" on notes and blog; "Landa Tejahempinyo" only as the Stanford alias in About. Public email: s.tejahempinyo@gmail.com. Never publish the school email.
- Exact dependency pins; no upgrades before 2026-11-01 (Stanford REA deadline). Node 24.

## Commands
- `npm run dev` — dev server with drafts visible (SHOW_DRAFTS=1)
- `npm run build` — prebuild check-content → astro build → postbuild resume PDF + check-dist
- `npm test` — vitest unit tests · `npm run test:e2e` — Playwright (needs a build + preview)
- `npm run content:check` — the author-facing content report · `npm run shrink` — downsize images > 2 MB

## Architecture in one paragraph
`src/lib/vault.ts` indexes the vault synchronously (NFC + lowercase lookups). `src/plugins/remark-vault.ts` turns Obsidian syntax into mdast (`![[img]]` → real image nodes so Astro's Sharp pipeline optimises them; `image.layout: 'constrained'` gives srcset). `src/lib/graph.ts` builds nodes/edges/backlinks and deterministic d3-force-3d layouts once per build; `/graph.json` feeds the Canvas 2D hero and the 2D map. Achievements are the single source for the timeline, detail pages, `/resume` and `dist/resume.pdf` (react-pdf in postbuild). Fonts are self-hosted via Astro's local font provider over pinned `@fontsource-variable` packages.

## v0.2 additions (2026-09-17)
- Hero: `src/scripts/graph-gl.ts` (WebGL2, lazy) with Canvas 2D fallback; `data-renderer` on `[data-hero]`. Sound: `src/scripts/sound.ts`, localStorage `sound=on`, `sfx` CustomEvent bus (`tap | release | drone:on | drone:off`), forced off when motion is off.
- Chapters: `CHAPTERS` in `src/site.config.ts` is the only source of numbers (01–06); OG cards regenerate with `node scripts/og-cards.mjs`.
- Research: `src/lib/bis.ts` reads `content/data/bis_panel_monthly.csv` (author-owned; columns month,V,L,S,C,BIS); `/research`, `/data/bis_panel_monthly.csv`; check-content validates the CSV.
- Openers: `src/scripts/scroll-scene.ts` + `src/styles/scene.css`; never arm under reduced motion or `data-motion=off`.
- Archery: `src/lib/archery.ts` parses flat frontmatter `scores` lines; `ArcheryTarget`/`ArcheryRecord` on athletics pages.
- Detailed designs: `docs/superpowers/plans/2026-09-17-*.md`; handoffs: `docs/HANDOFF-{hero-gl,research,openers,archery}.md`.

## Infra
- GitHub: `huachxng/sasipat-tejahempinyo` (public). Discussions enabled: repo id `R_kgDOUdpVhQ`, "Announcements" category id `DIC_kwDOUdpVhc4DFvw9` (for giscus once the giscus GitHub App is installed on the repo).
- Vercel: project `sasipat-tejahempinyo` (`prj_WnHXLJYt5In7twpGWwrG9GeCn3it`, scope `siertang`). Build command `npm run build`, install command default. Git integration must be connected in the dashboard (Settings → Git) for push-to-deploy; until then deploy with `npx vercel@59.19.0 deploy --prod`.
- Vercel Hobby only auto-deploys commits whose author email is verified on the GitHub account; local git author is `sch00ls.n.w0rks@gmail.com`.

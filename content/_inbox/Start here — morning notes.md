# Good morning — what happened overnight (2026-09-17)

**Live site:** https://sasipat-tejahempinyo.vercel.app  ·  **Code:** https://github.com/huachxng/sasipat-tejahempinyo  ·  **Your vault:** `~/Sites/sasipat-tejahempinyo/content`

## What exists now
- Home with the giant wordmark and a live 3D graph of your real notes (cursor-follow, hover, click; static SVG when motion is off).
- 01 Achievements: 44 entries on a timeline with year tabs, category filters, the countdown numeral and gold rail, detail pages with photos, certificates and a lightbox. 88 curated images.
- 02 Notes & Blog: 12 connected notes, 2 essays (byline Noah), 2D map, backlinks with context, tags, search, RSS. Comments are wired but off until step 2 below.
- 03 About (names block, your bio), 04 Resume (page + `resume.pdf`, 29 entries, 2 pages), 05 Contact (s.tejahempinyo@gmail.com, GitHub).
- Safety rails: nothing publishes without `publish: true`; the build refuses ID numbers, passport data, PDFs and videos; `content/_private/` never leaves your Mac.

## Five things only you can do (about 10 minutes)
1. **Vercel push-to-deploy**: vercel.com → project `sasipat-tejahempinyo` → Settings → Git → Connect `huachxng/sasipat-tejahempinyo` (installs the Vercel GitHub app). Until then I deploy from the terminal.
2. **Comments**: install https://github.com/apps/giscus on *only* this repository, then tell me. Discussions are already enabled and the ids are recorded; I flip one flag.
3. **CI**: in the prompt type `! gh auth refresh -h github.com -s workflow` and approve in the browser. Then I move `.github/workflows-pending` back and the content checks + tests run on every push.
4. **Publish button**: `! brew install --cask github`, open GitHub Desktop, sign in as huachxng, File → Add Local Repository → `~/Sites/sasipat-tejahempinyo`.
5. **Obsidian**: File → Open folder as vault → `~/Sites/sasipat-tejahempinyo/content`. Trust the settings. Settings → Community plugins → Browse → install and enable **Image Converter** (its settings are already in place). `content/README.md` is the one-page guide; `⌘T` inserts a template.

## Please review (in Obsidian)
- `_inbox/Review checklist.md` — every fact I could not verify, every held-back image, and the photo questions. Fix directly in the notes; anything with `%% … %%` around it is a private comment that never renders.
- Highest-value confirmations: internship firm + mentor (currently unnamed), World Archery Youth Championships results, NHS presidency dates, ECONBRIEF101 vs "1-Minute Econ" channel name and URL, podcast EP1 release date/link, MEEKVEGGIES current status, whether the AP Economics TA role should appear (the August brag sheet says it was cancelled, so it is out).
- Held back on purpose: 4 photos with arrows drawn on them (band ×2, FE Bootcamp line-up, TEO exam hall) — send clean originals; 3 certificates showing ID numbers (both AMO certificates, the World Archery accreditation card) — say yes and I crop the numbers out; the NAAT selection letter (contains a signature and office phone).
- No usable headshot exists in your folder (the file named as one is your TEO certificate). Drop a portrait into `content/media/` and tell me; About and the hero have a slot for it.

## How you publish a change (after step 4)
Write in Obsidian → tick `publish` → GitHub Desktop → check the Changes list → Summary → Commit to main → Push origin → live in a few minutes.

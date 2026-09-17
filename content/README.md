# How to publish (one page)

This folder is your Obsidian vault. Everything on the website is built from it.

1. **Open `content/` as a vault** in Obsidian (File → Open folder as vault). Trust the settings that come with it.
2. **Where things go**
   - `notes/` short connected notes · `blog/` longer dated essays (byline "Noah") · `achievements/` one file per achievement
   - `media/` every image (drag a picture into a note and it lands here automatically)
   - `_inbox/` scratch that is never published · `_private/` never even uploaded to GitHub · `_templates/` the three templates
3. **Start from a template**: press ⌘T and pick Note, Essay or Achievement. The file name is the title.
4. **`publish` is the switch.** Nothing appears on the site until you tick `publish` in the Properties panel. Unticked notes are invisible everywhere on the site.
5. **Link notes with `[[Note Name]]`.** Links and shared `#tags` draw the graph. If two files share a name, write `[[achievements/Name]]`.
6. **Images**: drag them in; they become `![[picture.jpg]]`. The first picture is the cover. Name a certificate file so it contains the word `certificate` (for example `navy-archer-open-2024-certificate.jpg`) and it gets its own slot.
7. **Dates** use the date picker (2026-09-16). `category` must be one of: academics, research, ventures, leadership, athletics, arts, mathematics, camps.
8. **Private text**: anything between `%%` and `%%` never renders. Never paste ID numbers, passport data, phone numbers or addresses. No PDFs or videos in the vault: link out with `links`.
9. **Archery scores** (athletics only): add a `scores` list, one line per round in the form `Round | score | details`, e.g. `Ranking round | 560/720 | 72 arrows | 70 m` or `Elimination | 6-4 | vs seed 3`; include the arrow count if you want the target face drawn. Optional `placing` (1, 2 or 3), `division` (`U18 Women`) and `distance` (`70 m`). Anything the site cannot read is skipped and listed by Check Content.
10. **Renaming a public note?** Add the old name to `previousSlugs` so old links keep working.
11. **Publish** = GitHub Desktop → look at the Changes list (this is exactly what becomes public) → write a one-line summary → **Commit to main** → **Push origin**. The site updates in 2–4 minutes. If something is wrong you get an email and a GitHub issue that names the file and the fix.

12. **`data/`** holds `bis_panel_monthly.csv`, the file behind the Research chart. To update it, copy the new `output/bis_panel_monthly.csv` from the R project over it and keep the same columns (`month,V,L,S,C,BIS`).

Optional before pushing: double-click `mac/Check Content.command` to see problems, or `mac/Preview Site.command` to see the site (drafts included) on your own computer.

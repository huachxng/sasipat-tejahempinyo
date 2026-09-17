#!/usr/bin/env node
/**
 * scripts/check-content.ts — runs before every build (npm `prebuild`) and from `mac/Check Content.command`.
 *
 * Checks the Obsidian vault in content/ (or $VAULT_DIR) and prints author-facing problems.
 * Every message starts with the file (and line when known) and ends with a fix line.
 * Exit code 1 on any error. Design: docs/superpowers/specs/2026-09-16-portfolio-site-design.md §11 step 1.
 *
 * Flags
 *   --report md          print Markdown instead of plain text (for the GitHub Issue / step summary)
 *   --out <file>         write the report to a file instead of stdout (summary line still goes to stdout)
 *   --cache <file>       where to write unpublished.json (default node_modules/.cache/hua/unpublished.json)
 *   --strict             unresolved wikilinks are errors (same as STRICT_LINKS=1; CI uses it, the author's deploy does not)
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'tinyglobby';
import { parse as parseYaml } from 'yaml';
import sharp from 'sharp';
import { CONTENT_DIR, IMAGE_EXT, buildVaultIndex, norm, splitFrontmatter, hrefFor, type Collection, type VaultEntry, type VaultIndex } from '../src/lib/vault.ts';
import { parseWikilinks, resolveWikilink, isImageTarget, isDocumentTarget, closest } from '../src/lib/wikilinks.ts';
import { noteSchema } from '../src/schemas/note.ts';
import { postSchema } from '../src/schemas/post.ts';
import { achievementSchema } from '../src/schemas/achievement.ts';
import { profileSchema } from '../src/schemas/profile.ts';
import { parseScore, scoreProblems } from '../src/lib/archery.ts';
import { CATEGORY_KEYS } from '../src/site.config.ts';
import { validateBisCsv } from '../src/lib/bis.ts';

// ---------------------------------------------------------------------------------------------- setup

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPORT_MD = flagValue('--report') === 'md';
const OUT_FILE = flagValue('--out');
const STRICT = process.env.STRICT_LINKS === '1' || args.includes('--strict');
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE_FILE = resolve(flagValue('--cache') ?? join(REPO_ROOT, 'node_modules/.cache/hua/unpublished.json'));
const VAULT_ROOT = CONTENT_DIR.replace(/[\\/]+$/, '');
const TODAY = new Date().toISOString().slice(0, 10);
const MB = 1024 * 1024;

const FORBIDDEN_EXT = /\.(pdf|docx?|xlsx?|pptx?|mp4|mov|m4v|webm|avi|mkv|heic|zip|rar|7z)$/i;
const PII_FILENAME = /\d{10,}|passport|id[-_ ]?card|บัตร|transcript|score[-_ ]?report/i;
const LEGAL_SURNAME = /tejahempinyo/i;
/** Words that check-dist refuses to ship inside page text; the same list minus "transcript" (a common word) which only warns. */
const PII_TEXT_HARD = /passport|id[-_ ]?card|บัตร|score[-_ ]?report|(?<!\d)\d{13}(?!\d)/i;
const PII_TEXT_SOFT = /transcript/i;
const COLLECTION_FOLDERS = ['notes', 'blog', 'achievements'];
const SCHEMAS = { notes: noteSchema, blog: postSchema, achievements: achievementSchema } as const;

interface Problem {
  level: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
  fix: string;
}
const problems: Problem[] = [];
const show = (abs: string) => 'content/' + relative(VAULT_ROOT, abs).split(sep).join('/');
const error = (file: string, message: string, fix: string, line?: number) => problems.push({ level: 'error', file: show(file), line, message, fix });
const warning = (file: string, message: string, fix: string, line?: number) => problems.push({ level: 'warning', file: show(file), line, message, fix });
const fmtMB = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Line-number helper for a body string. */
function lineIndex(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset: number) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Replace a region with spaces but keep the newlines, so offsets and line numbers stay valid. */
const blankKeepNewlines = (s: string) => s.replace(/[^\n]/g, ' ');
/** Blank code fences and inline code (Obsidian syntax inside code is literal). */
const blankCode = (s: string) => s.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, blankKeepNewlines).replace(/`[^`\n]*`/g, blankKeepNewlines);
/** Blank %% comments %% (balanced pairs only) and HTML comments. */
const blankComments = (s: string) => s.replace(/%%[\s\S]*?%%/g, blankKeepNewlines).replace(/<!--[\s\S]*?-->/g, blankKeepNewlines);

/** True when the EXIF blob has a GPS IFD pointer (tag 0x8825 in IFD0). */
function hasGpsExif(exif: Buffer): boolean {
  try {
    const hdr = exif.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? 6 : 0;
    const bom = exif.toString('latin1', hdr, hdr + 2);
    if (bom !== 'II' && bom !== 'MM') return false;
    const le = bom === 'II';
    const u16 = (o: number) => (le ? exif.readUInt16LE(o) : exif.readUInt16BE(o));
    const u32 = (o: number) => (le ? exif.readUInt32LE(o) : exif.readUInt32BE(o));
    const ifd0 = hdr + u32(hdr + 4);
    const count = u16(ifd0);
    for (let i = 0; i < count; i++) if (u16(ifd0 + 2 + i * 12) === 0x8825) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------- checks

if (!existsSync(VAULT_ROOT)) {
  console.error(`content/ — the vault folder ${VAULT_ROOT} does not exist.\n  fix: run this from the repository (or set VAULT_DIR to the vault)`);
  process.exit(1);
}

const allFiles = globSync(['**/*'], { cwd: VAULT_ROOT, absolute: true, ignore: ['.obsidian/**', '_private/**', 'node_modules/**', '**/.*'] }).sort();
const vault: VaultIndex = buildVaultIndex(VAULT_ROOT);
const mediaDirName = 'media';

// 1. Filesystem --------------------------------------------------------------------------------
const imageFiles: string[] = [];
for (const file of allFiles) {
  const rel = relative(VAULT_ROOT, file).split(sep).join('/');
  const name = basename(file);
  const ext = extname(file).toLowerCase();
  const inMedia = rel.startsWith(`${mediaDirName}/`);

  if (FORBIDDEN_EXT.test(name)) {
    error(file, `a ${ext.slice(1).toUpperCase()} file is inside the vault; documents and videos are never published from here`, 'delete it from the vault and link out instead (YouTube, SSRN, Google Drive) via the links property');
    continue;
  }
  const isImage = IMAGE_EXT.test(name);
  if (inMedia || isImage) {
    const pii = PII_FILENAME.exec(name);
    if (pii) error(file, `the file name contains "${pii[0]}", which looks like an ID number or a personal document`, 'rename the file in Obsidian to something like <note-name>-01.jpg (links update automatically)');
    else if (LEGAL_SURNAME.test(name)) error(file, 'the file name contains the legal surname', 'rename the file in Obsidian to something like <note-name>-01.jpg (links update automatically)');
  }
  if (isImage) {
    imageFiles.push(file);
    if (!inMedia) warning(file, 'this image is outside media/, so notes cannot embed it', 'move it into content/media/ (Obsidian keeps the links working)');
  }
}

for (const file of imageFiles) {
  const size = statSync(file).size;
  if (size > 8 * MB) error(file, `image is ${fmtMB(size)} (limit 8 MB)`, 'run `npm run shrink`, or export it smaller (longest edge 2400 px, JPEG quality 80) and replace the file');
  else if (size > 2 * MB) warning(file, `image is ${fmtMB(size)} (over 2 MB; the site still builds but the page loads slowly)`, 'run `npm run shrink` to downsize it in place');
  if (/\.(svg|gif)$/i.test(file)) continue;
  try {
    const meta = await sharp(file).metadata();
    if (meta.exif && hasGpsExif(meta.exif)) warning(file, 'the photo still carries GPS location data (EXIF). The site strips it on build, but the original stays in the repository', 'remove it from the file: `npm run shrink -- --all`, or in Preview → Tools → Show Inspector → GPS → Remove Location Info');
  } catch (e) {
    warning(file, `the image could not be read (${(e as Error).message.split('\n')[0]})`, 're-export it as JPEG or PNG and replace the file');
  }
}

// notes outside any collection folder
for (const file of allFiles) {
  if (extname(file).toLowerCase() !== '.md') continue;
  const rel = relative(VAULT_ROOT, file).split(sep).join('/');
  const top = rel.split('/')[0];
  if (COLLECTION_FOLDERS.includes(top) && rel.includes('/')) continue;
  if (!rel.includes('/') && (rel === 'README.md' || rel === 'profile.md')) continue;
  if (top.startsWith('_') || top.startsWith('.')) continue;
  error(file, 'this note is in a folder that is never published', 'move it to notes/, blog/ or achievements/');
}

// duplicate ids per collection (case-insensitive; Vercel's Linux is case-sensitive, macOS is not)
{
  const seen = new Map<string, VaultEntry>();
  for (const e of vault.entries) {
    const key = `${e.collection}:${e.id.toLowerCase()}`;
    const first = seen.get(key);
    if (first) error(e.path, `its web address ${hrefFor(e.collection, e.id)} is already used by ${show(first.path)}`, 'rename one of the two files, or give one a different slug property');
    else seen.set(key, e);
  }
}

// 2. Frontmatter -------------------------------------------------------------------------------
const cleanMediaName = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
  return s ? s.split('/').pop()! : undefined;
};
/** exact-case existence of a media file; returns a message when it is wrong */
function mediaProblem(name: string): { message: string; fix: string } | null {
  const nfc = name.normalize('NFC');
  if (vault.mediaExact.has(nfc)) return null;
  const loose = vault.media.get(norm(name));
  if (loose) return { message: `"${name}" is written with different capitalisation than the file on disk ("${basename(loose)}"); it works on this Mac but not on the server`, fix: `rename the file or the link so the two match exactly` };
  return { message: `"${name}" is not in content/media`, fix: 'drag the image into the note again, or fix the file name (check the extension: .jpg vs .jpeg vs .png)' };
}

const unpublished: VaultEntry[] = [];
for (const e of vault.entries) {
  if (!e.publish) unpublished.push(e);
  const src = readFileSync(e.path, 'utf8');
  const { data, raw, body } = splitFrontmatter(src);
  const bodyOffsetLines = (src.slice(0, src.length - body.length).match(/\n/g) ?? []).length;
  const fmLine = (field: string): number | undefined => {
    const lines = raw.split(/\r?\n/);
    const i = lines.findIndex((l) => new RegExp(`^${escapeRe(field)}\\s*:`).test(l));
    return i >= 0 ? i + 2 : undefined;
  };

  // YAML syntax
  if (/^﻿?---\r?\n/.test(src) && !raw && !/^﻿?---\r?\n---/.test(src)) {
    error(e.path, 'the properties block at the top is not closed', 'add a line with only --- after the last property', 1);
    continue;
  }
  if (raw) {
    try {
      const parsed = parseYaml(raw);
      if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
        error(e.path, 'the properties block is not a list of "name: value" lines', 'open the Properties panel, or copy the top of a template from content/_templates', 2);
        continue;
      }
    } catch (err) {
      const msg = (err as Error).message.split('\n')[0];
      error(e.path, `the properties block is not valid YAML (${msg})`, 'open the Properties panel; if it will not open, compare the top of the file with a template in content/_templates', 2);
      continue;
    }
  } else {
    warning(e.path, 'the note has no properties block, so it can never be published', 'start from a template (⌘T) or add the properties from content/_templates', 1);
  }

  // schema
  const schema = SCHEMAS[e.collection];
  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? '');
      const absent = field !== '' && !(field in data);
      const blank = field !== '' && !absent && (data[field] === null || data[field] === '');
      const missing = absent || blank;
      const message = issue.message;
      let text: string;
      let fix: string;
      if (missing && field === 'date') {
        text = `"date" is ${absent ? 'missing' : 'empty'}`;
        fix = `add: date: ${TODAY}`;
      } else if (missing && field === 'category') {
        text = `"category" is ${absent ? 'missing' : 'empty'}. Choose one of: ${CATEGORY_KEYS.join(', ')}`;
        fix = 'set category in the Properties panel';
      } else if (absent) {
        text = `"${field}" is missing`;
        fix = `add ${field} in the Properties panel (${message})`;
      } else if (blank) {
        text = `"${field}" is empty, and an empty property fails the build (${message})`;
        fix = `pick a value in the Properties panel or delete the empty ${field} line`;
      } else if (field === 'category') {
        text = message;
        fix = 'set category to one of the eight words in the Properties panel';
      } else if (field === 'publish') {
        text = message;
        fix = 'tick or untick publish in the Properties panel';
      } else if (field === 'endDate') {
        text = message.startsWith('endDate') ? message : `"endDate" — ${message}`;
        fix = 'use the date picker; endDate is the end of a range and may be left out';
      } else {
        const named = field && new RegExp(`^"?${escapeRe(field)}"?\\b`).test(message);
        text = named || !field ? message : `"${field}" — ${message}`;
        fix = `correct the ${field ? `"${field}" ` : ''}property in the Properties panel (compare with content/_templates)`;
      }
      error(e.path, text, fix, fmLine(field));
    }
  }

  // unknown properties with "did you mean"
  const known = Object.keys(schema.shape);
  for (const key of Object.keys(data)) {
    if (known.includes(key)) continue;
    const suggestion = known.find((k) => k.toLowerCase() === key.toLowerCase()) ?? known.filter((k) => levenshtein(k.toLowerCase(), key.toLowerCase()) <= 2).sort((a, b) => levenshtein(a, key) - levenshtein(b, key))[0];
    warning(e.path, `unknown property "${key}" is ignored by the site`, suggestion ? `did you mean "${suggestion}"? Rename it in the Properties panel` : 'remove it, or check content/_templates for the supported properties', fmLine(key));
  }

  // archery scores (achievements only): a line the site cannot read is skipped on the page, never a build error
  if (e.collection === 'achievements') {
    const category = typeof data.category === 'string' ? data.category.trim().toLowerCase() : undefined;
    const rawLines = raw.split(/\r?\n/);
    const lineOfItem = (item: string) => {
      const i = rawLines.findIndex((l) => l.includes(item));
      return i >= 0 ? i + 2 : fmLine('scores');
    };
    const scoreItems = Array.isArray(data.scores) ? data.scores.map((s) => (typeof s === 'number' ? String(s) : s)).filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
    for (const item of scoreItems) {
      const line = lineOfItem(item);
      if (parseScore(item) === null) {
        warning(e.path, `scores: "${item}" is not a score the site can read, so this line is skipped`, 'write it as "Round | score | details", for example "Ranking round | 560/720 | 72 arrows | 70 m" or "Elimination | 6-4 | vs seed 3"', line);
        continue;
      }
      for (const problem of scoreProblems(item)) warning(e.path, `scores: "${item}" — ${problem}`, 'check the numbers; the maximum is arrows × 10 (72 arrows → 720)', line);
    }
    if (category && category !== 'athletics') {
      for (const field of ['scores', 'placing']) {
        const v = data[field];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
        warning(e.path, `"${field}" is only shown on Athletics / Archery entries and is ignored here`, 'set category to athletics, or remove the property', fmLine(field));
      }
    }
  }

  // future dates
  for (const field of ['date', 'endDate', 'updated']) {
    const v = data[field];
    if (v === undefined || v === null || v === '') continue;
    const d = v instanceof Date ? v : new Date(String(v));
    if (!isNaN(d.getTime()) && d.getTime() > Date.now() + 365 * 86400_000) warning(e.path, `"${field}" is more than a year in the future (${d.toISOString().slice(0, 10)})`, 'check the year in the date picker', fmLine(field));
  }

  // cover / certificate exact-case existence
  for (const field of ['cover', 'certificate']) {
    const name = cleanMediaName(data[field]);
    if (!name) continue;
    const p = mediaProblem(name);
    if (p) error(e.path, `${field}: ${p.message}`, p.fix, fmLine(field));
  }

  // 3. Links --------------------------------------------------------------------------------------
  const lineOf = lineIndex(body);
  const at = (offset: number) => bodyOffsetLines + lineOf(offset);
  const scan = blankComments(blankCode(body));
  for (const link of parseWikilinks(scan)) {
    const line = at(link.index);
    const t = link.target;
    if (isDocumentTarget(t)) {
      error(e.path, `${link.raw} — documents cannot be embedded or linked from the vault`, 'upload it elsewhere (Google Drive, SSRN, YouTube) and put the URL in the links property', line);
      continue;
    }
    if (isImageTarget(t)) {
      const name = t.split('/').pop()!;
      const p = mediaProblem(name);
      if (p) error(e.path, `${link.raw} — ${p.message}`, p.fix, line);
      else if (!link.embed) warning(e.path, `${link.raw} links to an image without showing it`, `write ![[${t}]] (with the exclamation mark) to show the picture`, line);
      continue;
    }
    if (!t) {
      if (link.heading) warning(e.path, `${link.raw} links to a heading in this same note, which the site does not support; it renders as plain text`, 'remove the brackets, or link to another note', line);
      else warning(e.path, `${link.raw} is an empty link and renders as plain text`, 'put a note name between the brackets or remove them', line);
      continue;
    }
    const res = resolveWikilink(t, vault);
    if (res.ok) {
      if (link.block) warning(e.path, `${link.raw} — block references (^) are not supported; the link opens the note instead`, 'link to a heading with [[Note#Heading]] or to the note itself', line);
      if (link.heading) {
        const re = new RegExp(`^#{1,6}\\s+${escapeRe(link.heading.trim())}\\s*#*\\s*$`, 'mi');
        if (!re.test(res.entry.body)) warning(e.path, `${link.raw} — "${res.entry.title}" has no heading "${link.heading}"; the link opens the top of the note`, 'copy the heading text exactly, or drop the #part', line);
      }
      continue;
    }
    if (res.reason === 'ambiguous') {
      const names = res.candidates.map((c) => c.rel).join(', ');
      error(e.path, `${link.raw} matches ${res.candidates.length} files (${names})`, `write [[${res.candidates[0].collection}/${t}]] — Obsidian writes this form for you when the name is ambiguous`, line);
    } else if (res.reason === 'unpublished') {
      const c = res.candidates[0];
      warning(e.path, `${link.raw} points to an unpublished note (${show(c.path)}) and will render as plain text`, 'tick publish on that note, or leave it — it is not a broken link', line);
    } else {
      const near = closest(norm(t), vault);
      const byDistance = [...vault.entries].filter((x) => !near.includes(x)).sort((a, b) => levenshtein(norm(a.title), norm(t)) - levenshtein(norm(b.title), norm(t)));
      const suggestions = [...near, ...byDistance].slice(0, 3).map((x) => `[[${x.basename}]]`);
      const fix = suggestions.length ? `did you mean ${suggestions.join(', ')}? Otherwise create the note or remove the brackets` : 'create the note or remove the brackets';
      if (STRICT) error(e.path, `${link.raw} does not match any note`, fix, line);
      else warning(e.path, `${link.raw} does not match any note and will render as plain text`, fix, line);
    }
  }

  // 4. Syntax -------------------------------------------------------------------------------------
  const noCode = blankCode(body);
  const pct = [...noCode.matchAll(/%%/g)];
  if (pct.length % 2 === 1) {
    const last = pct[pct.length - 1].index ?? 0;
    error(e.path, `a %% comment opened on line ${at(last)} is never closed, so everything after that line would be hidden`, 'add the closing %% (or delete the stray one)', at(last));
  }
  {
    const lines = noCode.split('\n');
    const idx = lines.findIndex((l) => /%%/.test(l) && /^\s*(?:[-*+]|\d+[.)]|>)\s/.test(l));
    if (idx >= 0) warning(e.path, '%% comments inside lists or quotes are not supported and may show on the page', 'move the comment to its own paragraph at the top level', bodyOffsetLines + idx + 1);
  }
  const math = [...noCode.matchAll(/\$\$/g)];
  if (math.length % 2 === 1) warning(e.path, `a $$ math block opened on line ${at(math[math.length - 1].index ?? 0)} is never closed`, 'add the closing $$', at(math[math.length - 1].index ?? 0));

  // HTML comments are published in the page source; %% %% are not. One warning per file, one error per leaked word.
  const plainCommentLines: number[] = [];
  for (const m of noCode.matchAll(/<!--([\s\S]*?)-->/g)) {
    const line = at(m.index ?? 0);
    const hard = PII_TEXT_HARD.exec(m[1]);
    if (hard) error(e.path, `an HTML comment <!-- … --> mentions "${hard[0]}"; HTML comments are shipped in the page source and check-dist refuses to publish this word`, 'delete the comment, or move the text into a %% private comment %%', line);
    else plainCommentLines.push(line);
  }
  if (plainCommentLines.length) {
    const n = plainCommentLines.length;
    warning(e.path, `${n} HTML comment${n === 1 ? '' : 's'} <!-- … --> (line${n === 1 ? '' : 's'} ${plainCommentLines.join(', ')}) will be shipped in the page source, where anyone can read ${n === 1 ? 'it' : 'them'} with View Source`, 'use %% … %% for private notes, or delete the comments', plainCommentLines[0]);
  }
  // PII words in visible text
  const visible = blankComments(noCode);
  const hard = PII_TEXT_HARD.exec(visible);
  if (hard) error(e.path, `the text contains "${hard[0]}", which check-dist refuses to publish (ID numbers and personal documents)`, 'reword the sentence or move it into a %% private comment %%', at(hard.index));
  const soft = PII_TEXT_SOFT.exec(visible);
  if (soft) warning(e.path, `the text contains "${soft[0]}"; make sure no school transcript or score report is being described or attached`, 'nothing to do if this is an ordinary use of the word', at(soft.index));
}

// profile.md
{
  const profilePath = join(VAULT_ROOT, 'profile.md');
  if (!existsSync(profilePath)) error(profilePath, 'profile.md is missing; the About page, resume and footer read it', 'create content/profile.md from the template in content/README.md');
  else {
    const { data, raw } = splitFrontmatter(readFileSync(profilePath, 'utf8'));
    if (!raw) error(profilePath, 'profile.md has no properties block', 'add name, headline, email and the other profile properties', 1);
    else {
      const r = profileSchema.safeParse(data);
      if (!r.success) for (const issue of r.error.issues) error(profilePath, `"${String(issue.path[0] ?? '')}" — ${issue.message}`, 'correct the property in the Properties panel');
      const known = Object.keys(profileSchema.shape);
      for (const key of Object.keys(data)) {
        if (known.includes(key)) continue;
        const suggestion = known.filter((k) => levenshtein(k.toLowerCase(), key.toLowerCase()) <= 2)[0];
        warning(profilePath, `unknown property "${key}" is ignored by the site`, suggestion ? `did you mean "${suggestion}"?` : 'remove it');
      }
    }
  }
}

// data/bis_panel_monthly.csv (the Research chart). Missing is only a warning so fixture vaults and unrelated pushes
// are not blocked; the real build still fails on /research with a one-line fix.
{
  const csvPath = join(VAULT_ROOT, 'data', 'bis_panel_monthly.csv');
  if (!existsSync(csvPath)) {
    warning(csvPath, 'the Research chart has no data yet; the site build will fail on /research until the file is added', 'copy output/bis_panel_monthly.csv from the R project into content/data/');
  } else {
    for (const p of validateBisCsv(readFileSync(csvPath, 'utf8'))) {
      (p.level === 'error' ? error : warning)(csvPath, p.message, p.fix, p.line);
    }
  }
}

// ---------------------------------------------------------------------------------------------- report

const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');
const filesWithErrors = new Set(errors.map((p) => p.file)).size;
const order = (a: Problem, b: Problem) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);
errors.sort(order);
warnings.sort(order);
const loc = (p: Problem) => `${p.file}${p.line ? `:${p.line}` : ''}`;
const summary = errors.length
  ? `${errors.length} error${errors.length === 1 ? '' : 's'} in ${filesWithErrors} file${filesWithErrors === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} — fix in Obsidian and push again`
  : `0 errors, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} — content is ready to publish`;
const unpublishedSorted = [...unpublished].sort((a, b) => a.rel.localeCompare(b.rel));
const counts = { notes: 0, blog: 0, achievements: 0 } as Record<Collection, number>;
for (const e of vault.entries) counts[e.collection]++;

let report: string;
if (REPORT_MD) {
  const lines: string[] = [];
  lines.push(`## Content check — ${summary}`, '');
  lines.push(`Vault: \`content/\` · ${counts.achievements} achievements · ${counts.notes} notes · ${counts.blog} essays · ${imageFiles.length} images · ${unpublishedSorted.length} unpublished`, '');
  if (errors.length) {
    lines.push('### Errors', '');
    for (const p of errors) lines.push(`- **\`${loc(p)}\`** — ${p.message}  `, `  Fix: ${p.fix}`);
    lines.push('');
  }
  if (warnings.length) {
    lines.push('### Warnings', '');
    for (const p of warnings) lines.push(`- \`${loc(p)}\` — ${p.message}  `, `  Fix: ${p.fix}`);
    lines.push('');
  }
  lines.push('### Unpublished (never appear on the site)', '');
  if (!unpublishedSorted.length) lines.push('- none');
  for (const e of unpublishedSorted) lines.push(`- \`${e.rel}\` — ${e.title}`);
  lines.push('', `_${summary}_`, '');
  report = lines.join('\n');
} else {
  const lines: string[] = [];
  lines.push(`check-content · ${show(VAULT_ROOT + sep).replace(/\/$/, '')}/ · ${counts.achievements} achievements · ${counts.notes} notes · ${counts.blog} essays · ${imageFiles.length} images${STRICT ? ' · strict links' : ''}`, '');
  for (const p of errors) lines.push(`✖ ${loc(p)} — ${p.message}`, `  fix: ${p.fix}`);
  for (const p of warnings) lines.push(`⚠ ${loc(p)} — ${p.message}`, `  fix: ${p.fix}`);
  if (problems.length) lines.push('');
  lines.push(`Unpublished (never appear on the site): ${unpublishedSorted.length ? '' : 'none'}`);
  for (const e of unpublishedSorted) lines.push(`  · ${e.rel} — ${e.title}`);
  lines.push('', summary);
  report = lines.join('\n');
}

if (OUT_FILE) {
  mkdirSync(dirname(resolve(OUT_FILE)), { recursive: true });
  writeFileSync(OUT_FILE, report + '\n');
  console.log(`${summary} (report written to ${OUT_FILE})`);
} else {
  console.log(report);
}

// cache for check-dist
try {
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(
    CACHE_FILE,
    JSON.stringify(
      {
        built: new Date().toISOString(),
        vault: VAULT_ROOT,
        unpublished: unpublishedSorted.map((e) => ({ collection: e.collection, id: e.id, title: e.title, rel: e.rel, href: hrefFor(e.collection, e.id) })),
      },
      null,
      2,
    ) + '\n',
  );
} catch (e) {
  console.error(`could not write ${CACHE_FILE}: ${(e as Error).message}`);
}

process.exitCode = errors.length ? 1 : 0;

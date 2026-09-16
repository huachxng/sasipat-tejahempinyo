#!/usr/bin/env node
/**
 * scripts/check-dist.ts — runs after every build (npm `postbuild`, after resume-pdf.mjs).
 *
 * Refuses to ship a dist/ that contains:
 *   - the title or id of any unpublished entry (from node_modules/.cache/hua/unpublished.json written by check-content)
 *   - a 13-digit number or a personal-document keyword in page text; a PII pattern or the legal surname in a file name
 *   - any PDF other than resume.pdf, any video, any file over 2 MB
 *   - an internal href/src that does not resolve to a file in dist (build.format 'file': /notes/x → notes/x.html)
 *   - home-page JavaScript over 60 KB gzipped, or any single client chunk over 30 KB gzipped
 *
 * Flags: --dist <dir> (default dist) · --cache <file> · --site <url>
 * Exit 1 on any error. Design: spec §11 step 3 and §8.5 (4).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse as parseHtml } from 'node-html-parser';
import { SITE_URL } from '../src/site.config.ts';

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = resolve(flagValue('--dist') ?? 'dist');
const CACHE_FILE = resolve(flagValue('--cache') ?? join(REPO_ROOT, 'node_modules/.cache/hua/unpublished.json'));
const SITE = (flagValue('--site') ?? SITE_URL).replace(/\/+$/, '');
const KB = 1024;
const MB = 1024 * KB;
const HOME_JS_LIMIT = 60 * KB;
const CHUNK_LIMIT = 30 * KB;
const CSS_LIMIT = 40 * KB;
const ASSET_LIMIT = 2 * MB;

const TEXT_EXT = new Set(['.html', '.json', '.xml', '.txt', '.webmanifest']);
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|ogv)$/i;
const PII_FILENAME = /\d{10,}|passport|id[-_ ]?card|บัตร|transcript|score[-_ ]?report|tejahempinyo/i;
const PII_TEXT_HARD = /passport|id[-_ ]?card|บัตร|score[-_ ]?report/gi;
const THIRTEEN_DIGITS = /(?<!\d)\d{13}(?!\d)/g;
const PII_TEXT_SOFT = /transcript/gi;

interface Problem { level: 'error' | 'warning'; file: string; message: string; fix: string }
const problems: Problem[] = [];
const error = (file: string, message: string, fix: string) => problems.push({ level: 'error', file, message, fix });
const warning = (file: string, message: string, fix: string) => problems.push({ level: 'warning', file, message, fix });
const info: string[] = [];
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;

if (!existsSync(DIST)) {
  console.error(`check-dist: ${DIST} does not exist.\n  fix: run \`npm run build\` first (or pass --dist <dir>)`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------- inventory
interface DistFile { abs: string; rel: string; size: number; ext: string }
const files: DistFile[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs);
    else files.push({ abs, rel: relative(DIST, abs).split(sep).join('/'), size: st.size, ext: extname(name).toLowerCase() });
  }
})(DIST);
const fileSet = new Set(files.map((f) => f.rel));
const relName = (f: string) => `${posix.basename(DIST)}/${f}`;
const html = files.filter((f) => f.ext === '.html');
const textFiles = files.filter((f) => TEXT_EXT.has(f.ext));
info.push(`${files.length} files, ${html.length} pages, ${kb(files.reduce((s, f) => s + f.size, 0))} total`);

// ---------------------------------------------------------------------------------------------- 1. unpublished leaks
interface Unpublished { collection: string; id: string; title: string; rel: string; href: string }
let unpublished: Unpublished[] = [];
if (existsSync(CACHE_FILE)) {
  try {
    unpublished = (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as { unpublished: Unpublished[] }).unpublished ?? [];
    info.push(`${unpublished.length} unpublished entr${unpublished.length === 1 ? 'y' : 'ies'} to keep out (${relative(REPO_ROOT, CACHE_FILE)})`);
  } catch (e) {
    warning(relative(REPO_ROOT, CACHE_FILE), `could not read the unpublished list (${(e as Error).message})`, 'run `node scripts/check-content.ts` before the build');
  }
} else {
  warning(relative(REPO_ROOT, CACHE_FILE), 'the unpublished list from check-content is missing, so draft titles were not checked', 'run `npm run build` (prebuild writes it) instead of `astro build` alone');
}
const stripMissingSpans = (s: string) => s.replace(/<span class="wl-missing"[^>]*>[\s\S]*?<\/span>/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const f of textFiles) {
  const raw = readFileSync(f.abs, 'utf8');
  const text = f.ext === '.html' ? stripMissingSpans(raw) : raw;
  for (const u of unpublished) {
    const needles: [string, string][] = [
      [u.href, 'address'],
      [`${u.collection}/${u.id}`, 'graph id'],
    ];
    if (u.title.trim().length >= 3) needles.push([u.title, 'title']);
    for (const [needle, what] of needles) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}_-])${escapeRe(needle)}(?![\\p{L}\\p{N}_-])`, 'u');
      if (re.test(text)) error(relName(f.rel), `contains the ${what} of the unpublished ${u.collection.replace(/s$/, '')} "${u.title}" (${needle})`, 'find which page or component prints it; only getPublished() output may reach a page');
    }
  }
}

// ---------------------------------------------------------------------------------------------- 2. PII in text and file names
const snippet = (s: string, at: number) => s.slice(Math.max(0, at - 40), at + 60).replace(/\s+/g, ' ').trim();
const lineAt = (s: string, at: number) => s.slice(0, at).split('\n').length;
for (const f of textFiles) {
  const text = readFileSync(f.abs, 'utf8');
  for (const m of text.matchAll(THIRTEEN_DIGITS)) error(`${relName(f.rel)}:${lineAt(text, m.index ?? 0)}`, `contains a 13-digit number (${m[0]}) — Thai ID numbers are 13 digits: "…${snippet(text, m.index ?? 0)}…"`, 'remove the number from the source note (or from the component that prints it)');
  for (const m of text.matchAll(PII_TEXT_HARD)) error(`${relName(f.rel)}:${lineAt(text, m.index ?? 0)}`, `contains "${m[0]}": "…${snippet(text, m.index ?? 0)}…"`, 'remove the sentence or HTML comment from the source note; run `node scripts/check-content.ts` to find the line');
  for (const m of text.matchAll(PII_TEXT_SOFT)) warning(`${relName(f.rel)}:${lineAt(text, m.index ?? 0)}`, `contains "${m[0]}": "…${snippet(text, m.index ?? 0)}…"`, 'fine if it is an ordinary use of the word; never attach a school transcript');
}
for (const f of files) {
  const base = posix.basename(f.rel);
  const hit = PII_FILENAME.exec(base);
  if (hit) error(relName(f.rel), `the file name contains "${hit[0]}"`, 'rename the source file in content/media (or public/)');
}

// ---------------------------------------------------------------------------------------------- 3. forbidden files and sizes
for (const f of files) {
  if (f.ext === '.pdf' && f.rel !== 'resume.pdf') error(relName(f.rel), 'a PDF other than resume.pdf is in the build output', 'remove it from public/ or content/ and link out instead');
  if (VIDEO_EXT.test(f.rel)) error(relName(f.rel), 'a video file is in the build output', 'remove it and embed from YouTube instead');
  if (f.size > ASSET_LIMIT) error(relName(f.rel), `is ${(f.size / MB).toFixed(1)} MB (limit 2 MB)`, f.rel.startsWith('_astro/') ? 'lower the image widths/quality in the component that emits it, or `npm run shrink` the source' : 'shrink or remove the file');
}
if (!fileSet.has('resume.pdf')) warning(relName('resume.pdf'), 'resume.pdf is missing from the build output', 'scripts/resume-pdf.mjs should write it in postbuild before check-dist runs');

// ---------------------------------------------------------------------------------------------- 4. internal links resolve
const stripHashQuery = (u: string) => u.split('#')[0].split('?')[0];
function resolveInternal(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    p = pathname;
  }
  p = p.replace(/^\/+/, '');
  const cands: string[] = [];
  if (p === '') cands.push('index.html');
  else if (p.endsWith('/')) cands.push(`${p}index.html`, `${p.slice(0, -1)}.html`);
  else {
    cands.push(p);
    if (!/\.[a-z0-9]{1,8}$/i.test(p)) cands.push(`${p}.html`, `${p}/index.html`);
  }
  return cands.find((c) => fileSet.has(c)) ?? null;
}
const SKIP_HREF = /^(mailto:|tel:|sms:|javascript:|data:|blob:|#|about:)/i;
const REF_ATTRS: [string, string][] = [
  ['a[href]', 'href'],
  ['link[href]', 'href'],
  ['script[src]', 'src'],
  ['img[src]', 'src'],
  ['img[srcset]', 'srcset'],
  ['source[src]', 'src'],
  ['source[srcset]', 'srcset'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['iframe[src]', 'src'],
  ['use[href]', 'href'],
  ['image[href]', 'href'],
  ['meta[property="og:image"]', 'content'],
  ['meta[name="twitter:image"]', 'content'],
];
let refsChecked = 0;
const missingTargets = new Map<string, { ref: string; pages: string[] }>();
for (const page of html) {
  const root = parseHtml(readFileSync(page.abs, 'utf8'));
  const pageUrl = new URL(`/${page.rel}`, 'http://dist.local');
  const refs: string[] = [];
  for (const [selector, attr] of REF_ATTRS) {
    for (const el of root.querySelectorAll(selector)) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      if (attr === 'srcset') for (const part of v.split(',')) refs.push(part.trim().split(/\s+/)[0]);
      else refs.push(v.trim());
    }
  }
  for (const ref of refs) {
    if (!ref || SKIP_HREF.test(ref)) continue;
    let target = ref;
    if (/^https?:\/\//i.test(ref) || ref.startsWith('//')) {
      if (!ref.startsWith(SITE + '/') && ref !== SITE) continue; // external
      target = ref.slice(SITE.length) || '/';
    }
    const pathname = stripHashQuery(new URL(target, pageUrl).pathname);
    refsChecked++;
    const hit = resolveInternal(pathname);
    if (hit) continue;
    const entry = missingTargets.get(pathname) ?? { ref, pages: [] };
    if (!entry.pages.includes(page.rel)) entry.pages.push(page.rel);
    missingTargets.set(pathname, entry);
  }
}
for (const [pathname, { ref, pages }] of [...missingTargets.entries()].sort()) {
  const from = pages.length === 1 ? pages[0] : `${pages.length} pages (${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ', …' : ''})`;
  if (pathname === '/resume.pdf') warning(relName(pathname.slice(1)), `is linked from ${from} but is not in the build output yet`, 'scripts/resume-pdf.mjs writes it in postbuild');
  else error(relName(pathname.slice(1) || 'index.html'), `is linked from ${from} (${ref}) but does not resolve to a file in dist`, 'fix the href/src in the component or page that renders it; with build.format "file" /notes/x must be notes/x.html');
}
info.push(`${refsChecked} internal references checked across ${html.length} pages`);

// ---------------------------------------------------------------------------------------------- 5. budgets
const gz = (buf: Buffer | string) => gzipSync(buf).length;
if (fileSet.has('index.html')) {
  const root = parseHtml(readFileSync(join(DIST, 'index.html'), 'utf8'));
  const rows: [string, number][] = [];
  const seen = new Set<string>();
  const addFile = (src: string) => {
    const pathname = stripHashQuery(new URL(src.startsWith(SITE) ? src.slice(SITE.length) : src, 'http://dist.local/index.html').pathname);
    const hit = resolveInternal(pathname);
    if (!hit || seen.has(hit)) return;
    seen.add(hit);
    rows.push([hit, gz(readFileSync(join(DIST, hit)))]);
  };
  for (const el of root.querySelectorAll('script[src]')) addFile(el.getAttribute('src')!);
  for (const el of root.querySelectorAll('link[rel="modulepreload"][href]')) addFile(el.getAttribute('href')!);
  let inlineIdx = 0;
  for (const el of root.querySelectorAll('script:not([src])')) {
    const type = el.getAttribute('type');
    if (type && type !== 'module' && type !== 'text/javascript') continue; // JSON-LD, speculation rules…
    const code = el.innerHTML;
    if (!code.trim()) continue;
    rows.push([`index.html <script> #${++inlineIdx}`, gz(code)]);
  }
  const total = rows.reduce((s, [, n]) => s + n, 0);
  info.push(`home JS: ${kb(total)} gzipped across ${rows.length} script${rows.length === 1 ? '' : 's'} (limit ${kb(HOME_JS_LIMIT)})`);
  for (const [name, n] of rows) info.push(`  ${kb(n).padStart(9)}  ${name}`);
  if (total > HOME_JS_LIMIT) error(relName('index.html'), `home page JavaScript is ${kb(total)} gzipped (limit ${kb(HOME_JS_LIMIT)})`, 'defer or dynamic-import non-critical scripts; see the per-file list above');

  const css: [string, number][] = [];
  for (const el of root.querySelectorAll('link[rel="stylesheet"][href]')) {
    const hit = resolveInternal(stripHashQuery(new URL(el.getAttribute('href')!, 'http://dist.local/index.html').pathname));
    if (hit) css.push([hit, gz(readFileSync(join(DIST, hit)))]);
  }
  for (const el of root.querySelectorAll('style')) css.push(['index.html <style>', gz(el.innerHTML)]);
  const cssTotal = css.reduce((s, [, n]) => s + n, 0);
  info.push(`home CSS: ${kb(cssTotal)} gzipped (limit ${kb(CSS_LIMIT)})`);
  if (cssTotal > CSS_LIMIT) warning(relName('index.html'), `home page CSS is ${kb(cssTotal)} gzipped (limit ${kb(CSS_LIMIT)})`, 'trim unused styles; .size-limit.json enforces the same budget in CI');
} else {
  error(relName('index.html'), 'the home page is missing from the build output', 'src/pages/index.astro must exist and build');
}
for (const f of files) {
  if (f.ext !== '.js' || !f.rel.startsWith('_astro/')) continue;
  const n = gz(readFileSync(f.abs));
  if (n > CHUNK_LIMIT) error(relName(f.rel), `client chunk is ${kb(n)} gzipped (limit ${kb(CHUNK_LIMIT)})`, 'split the module or drop the dependency that inflates it');
}

// ---------------------------------------------------------------------------------------------- report
const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');
const distLabel = relative(process.cwd(), DIST);
console.log(`check-dist · ${!distLabel ? '.' : distLabel.startsWith('..') ? DIST : distLabel}`);
for (const line of info) console.log(`  ${line}`);
console.log('');
for (const p of errors) console.log(`✖ ${p.file} — ${p.message}\n  fix: ${p.fix}`);
for (const p of warnings) console.log(`⚠ ${p.file} — ${p.message}\n  fix: ${p.fix}`);
if (problems.length) console.log('');
console.log(errors.length ? `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} — the build output must not be published` : `0 errors, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} — build output is clean`);
process.exitCode = errors.length ? 1 : 0;

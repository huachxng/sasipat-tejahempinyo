import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const SCRIPT = resolve('scripts/check-content.ts');
const FIXTURES = resolve('tests/fixtures');
const TMP = mkdtempSync(join(tmpdir(), 'hua-check-content-'));

function run(vault: string, extra: { args?: string[]; env?: Record<string, string> } = {}) {
  const cache = join(TMP, `${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(process.execPath, [SCRIPT, '--cache', cache, ...(extra.args ?? [])], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: { ...process.env, VAULT_DIR: vault, STRICT_LINKS: '', ...(extra.env ?? {}) },
  });
  return { status: r.status, out: r.stdout + r.stderr, cache };
}

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe('clean fixture vault', () => {
  const r = run(join(FIXTURES, 'vault'));
  it('exits 0 with warnings only', () => {
    expect(r.out).toContain('0 errors, ');
    expect(r.out).toContain('content is ready to publish');
    expect(r.status).toBe(0);
  });
  it('accepts well-formed archery scores and placing without a warning', () => {
    expect(r.out).not.toMatch(/scores:/);
    expect(r.out).not.toMatch(/placing/);
    expect(r.out).not.toContain('Ach 1.md');
  });
  it('warns about the missing link with suggestions, the unpublished target and the block ref', () => {
    expect(r.out).toMatch(/⚠ content\/notes\/Alpha\.md:\d+ — \[\[Nowhere To Be Found\]\] does not match any note and will render as plain text/);
    expect(r.out).toMatch(/fix: did you mean \[\[[^\]]+\]\]/);
    expect(r.out).toMatch(/⚠ content\/notes\/Alpha\.md:\d+ — \[\[Gamma\]\] points to an unpublished note \(content\/notes\/Gamma\.md\) and will render as plain text/);
    expect(r.out).toMatch(/⚠ content\/notes\/Beta\.md:\d+ — \[\[Alpha#\^blk1\]\] — block references \(\^\) are not supported/);
  });
  it('lists the unpublished notes and writes the cache for check-dist', () => {
    expect(r.out).toContain('Unpublished (never appear on the site):');
    expect(r.out).toContain('blog/Draft Post — Draft Post Unfinished');
    expect(r.out).toContain('notes/Gamma — Gamma Secret Draft');
    const cache = JSON.parse(readFileSync(r.cache, 'utf8'));
    expect(cache.unpublished.map((u: { id: string }) => u.id).sort()).toEqual(['draft-post', 'gamma']);
    expect(cache.unpublished.find((u: { id: string }) => u.id === 'gamma')).toMatchObject({ collection: 'notes', title: 'Gamma Secret Draft', href: '/notes/gamma' });
  });
  it('turns unresolved links into errors under STRICT_LINKS=1', () => {
    const s = run(join(FIXTURES, 'vault'), { env: { STRICT_LINKS: '1' } });
    expect(s.status).toBe(1);
    expect(s.out).toMatch(/✖ content\/notes\/Alpha\.md:\d+ — \[\[Nowhere To Be Found\]\] does not match any note/);
  });
  it('writes a Markdown report with --report md --out', () => {
    const out = join(TMP, 'report.md');
    const m = run(join(FIXTURES, 'vault'), { args: ['--report', 'md', '--out', out] });
    expect(m.status).toBe(0);
    const md = readFileSync(out, 'utf8');
    expect(md).toMatch(/^## Content check — 0 errors, \d+ warnings? — content is ready to publish/m);
    expect(md).toContain('### Warnings');
    expect(md).toContain('### Unpublished (never appear on the site)');
    expect(md).toContain('- `notes/Gamma` — Gamma Secret Draft');
    expect(m.out).toContain(`report written to ${out}`);
  });
});

describe('broken-frontmatter fixture', () => {
  const r = run(join(FIXTURES, 'broken-frontmatter'));
  it('fails with the summary line', () => {
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/^\d+ errors in \d+ files, \d+ warnings? — fix in Obsidian and push again$/m);
  });
  it('reports a missing category with the allowed words', () => {
    expect(r.out).toContain('✖ content/achievements/No Category.md — "category" is missing. Choose one of: academics, research, ventures, leadership, athletics, arts, mathematics, camps');
  });
  it('reports a missing date with an add-line fix', () => {
    expect(r.out).toContain('✖ content/blog/No Date.md — "date" is missing');
    expect(r.out).toMatch(/fix: add: date: \d{4}-\d{2}-\d{2}/);
  });
  it('suggests the closest property name for a typo', () => {
    expect(r.out).toContain('⚠ content/notes/Typo Prop.md:5 — unknown property "sumary" is ignored by the site');
    expect(r.out).toContain('fix: did you mean "summary"?');
  });
  it('checks endDate against date and accepts a blank endDate as absent', () => {
    expect(r.out).toContain('✖ content/achievements/Bad Dates.md:5 — endDate must be on or after date');
    expect(r.out).not.toContain('Blank End Date.md');
  });
  it('warns about dates more than a year ahead', () => {
    expect(r.out).toContain('⚠ content/notes/Far Future.md:4 — "date" is more than a year in the future (2099-01-01)');
  });
  it('reports broken YAML, a non-boolean publish and a misspelled category', () => {
    expect(r.out).toContain('✖ content/achievements/Bad Yaml.md:2 — the properties block is not valid YAML');
    expect(r.out).toContain('✖ content/notes/Bad Publish.md:2 — publish must be true or false (tick the checkbox)');
    expect(r.out).toContain('✖ content/achievements/Wrong Category.md:5 — category is missing or misspelled. Choose one of: academics');
  });
  it('warns about an unreadable scores line with the expected form and about impossible numbers', () => {
    expect(r.out).toContain('⚠ content/achievements/Bad Score.md:6 — scores: "personal best" is not a score the site can read, so this line is skipped');
    expect(r.out).toContain('fix: write it as "Round | score | details", for example "Ranking round | 560/720 | 72 arrows | 70 m" or "Elimination | 6-4 | vs seed 3"');
    expect(r.out).toContain('⚠ content/achievements/Bad Score.md:6 — scores: "Ranking round | 560/500 | 50 arrows" — the total (560) is higher than the maximum (500)');
    expect(r.out).toContain('fix: check the numbers; the maximum is arrows × 10 (72 arrows → 720)');
  });
  it('makes a placing outside 1–3 an error with the 1–3 message', () => {
    expect(r.out).toContain('✖ content/achievements/Bad Score.md:7 — placing must be a whole number from 1 to 3 (1 = winner). Leave it out for anything below the podium');
  });
  it('warns when scores or placing sit on a non-athletics entry', () => {
    expect(r.out).toContain('⚠ content/achievements/Scores Elsewhere.md:6 — "scores" is only shown on Athletics / Archery entries and is ignored here');
    expect(r.out).toContain('⚠ content/achievements/Scores Elsewhere.md:7 — "placing" is only shown on Athletics / Archery entries and is ignored here');
    expect(r.out).toContain('fix: set category to athletics, or remove the property');
  });
  it('ends every problem with a fix line', () => {
    const lines = r.out.split('\n');
    lines.forEach((line, i) => {
      if (/^[✖⚠] /.test(line)) expect(lines[i + 1], `after: ${line}`).toMatch(/^  fix: /);
    });
  });
});

describe('broken-links fixture', () => {
  const r = run(join(FIXTURES, 'broken-links'));
  it('fails because of the ambiguous link, the image problems and the unclosed comment', () => {
    expect(r.status).toBe(1);
  });
  it('lists the unresolved link with file:line and three closest names', () => {
    expect(r.out).toContain('⚠ content/notes/Home.md:6 — [[Nope Note]] does not match any note and will render as plain text');
    expect(r.out).toMatch(/fix: did you mean \[\[Nearby One\]\], \[\[[^\]]+\]\], \[\[[^\]]+\]\]\?/);
  });
  it('makes an ambiguous basename an error with the folder fix', () => {
    expect(r.out).toContain('✖ content/notes/Home.md:6 — [[Dup]] matches 2 files (notes/Dup, achievements/Dup)');
    expect(r.out).toContain('fix: write [[notes/Dup]] — Obsidian writes this form for you when the name is ambiguous');
  });
  it('warns about a link to an unpublished note', () => {
    expect(r.out).toContain('⚠ content/notes/Home.md:6 — [[Hidden]] points to an unpublished note (content/notes/Hidden.md) and will render as plain text');
  });
  it('checks embeds for existence, exact case and document types', () => {
    expect(r.out).toContain('✖ content/notes/Home.md:8 — ![[missing.jpg]] — "missing.jpg" is not in content/media');
    expect(r.out).toContain('✖ content/notes/Home.md:8 — ![[Cover.JPG]] — "Cover.JPG" is written with different capitalisation than the file on disk ("cover.jpg")');
    expect(r.out).toContain('✖ content/notes/Home.md:8 — ![[deck.pdf]] — documents cannot be embedded or linked from the vault');
  });
  it('flags %% in lists and unbalanced $$ as warnings', () => {
    expect(r.out).toContain('⚠ content/notes/Home.md:10 — %% comments inside lists or quotes are not supported and may show on the page');
    expect(r.out).toContain('⚠ content/notes/Home.md:12 — a $$ math block opened on line 12 is never closed');
  });
  it('makes an unbalanced %% an error naming the line', () => {
    expect(r.out).toContain('✖ content/notes/Unclosed.md:8 — a %% comment opened on line 8 is never closed, so everything after that line would be hidden');
    expect(r.out).toContain('fix: add the closing %% (or delete the stray one)');
  });
});

describe('broken-files fixture', () => {
  const r = run(join(FIXTURES, 'broken-files'));
  it('fails', () => {
    expect(r.status).toBe(1);
  });
  it('rejects forbidden extensions anywhere in the vault', () => {
    expect(r.out).toContain('✖ content/secret.pdf — a PDF file is inside the vault');
    expect(r.out).toContain('✖ content/notes/clip.mp4 — a MP4 file is inside the vault');
    expect(r.out).toContain('fix: delete it from the vault and link out instead');
  });
  it('rejects PII-looking media file names and the legal surname', () => {
    expect(r.out).toContain('✖ content/media/passport-scan.jpg — the file name contains "passport"');
    expect(r.out).toContain('✖ content/media/1234567890.jpg — the file name contains "1234567890"');
    expect(r.out).toContain('✖ content/media/Tejahempinyo-photo.jpg — the file name contains the legal surname');
  });
  it('rejects duplicate ids case-insensitively', () => {
    expect(r.out).toMatch(/✖ content\/notes\/(Same|Other)\.md — its web address \/notes\/twin is already used by content\/notes\/(Other|Same)\.md/);
  });
  it('rejects notes outside the collection folders', () => {
    expect(r.out).toContain('✖ content/Stray.md — this note is in a folder that is never published');
    expect(r.out).toContain('✖ content/drafts/Stray Two.md — this note is in a folder that is never published');
    expect(r.out).toContain('fix: move it to notes/, blog/ or achievements/');
  });
  it('checks cover existence and HTML comments', () => {
    expect(r.out).toContain('✖ content/notes/Files.md:4 — cover: "nope.jpg" is not in content/media');
    expect(r.out).toContain('✖ content/notes/Files.md:8 — an HTML comment <!-- … --> mentions "passport"');
    expect(r.out).toContain('⚠ content/notes/Files.md:10 — 1 HTML comment <!-- … --> (line 10) will be shipped in the page source');
  });
});

describe('generated image problems', () => {
  const vault = join(TMP, 'images-vault');
  beforeAll(async () => {
    cpSync(join(FIXTURES, 'vault'), vault, { recursive: true });
    const sharp = (await import('sharp')).default;
    const w = 2000, h = 1400;
    await sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 0 }).toFile(join(vault, 'media', 'huge.png'));
    await sharp({ create: { width: 16, height: 16, channels: 3, background: '#333' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'Test' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 45/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '100/1 30/1 0/1' } })
      .toFile(join(vault, 'media', 'gps.jpg'));
    writeFileSync(join(vault, 'notes', 'Images.md'), '---\npublish: true\ntitle: "Images"\n---\n![[huge.png]] and ![[gps.jpg]]\n');
  });
  it('errors on images over 8 MB and warns on GPS EXIF', () => {
    expect(existsSync(join(vault, 'media', 'huge.png'))).toBe(true);
    const r = run(vault);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/✖ content\/media\/huge\.png — image is 8\.\d MB \(limit 8 MB\)/);
    expect(r.out).toContain('fix: run `npm run shrink`');
    expect(r.out).toContain('⚠ content/media/gps.jpg — the photo still carries GPS location data (EXIF)');
  });
});

describe('data/bis_panel_monthly.csv', () => {
  it('reports an invalid CSV with the line number and exits 1', () => {
    const r = run(join(FIXTURES, 'broken-data'));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/✖ content\/data\/bis_panel_monthly\.csv:\d+ — 1 month is missing between 1995-06 and 1995-08/);
    expect(r.out).toContain('fix: the panel must have one row for every month');
  });
  it('only warns when the file is absent, so the clean fixture still exits 0', () => {
    const r = run(join(FIXTURES, 'vault'));
    expect(r.status).toBe(0);
    expect(r.out).toContain('0 errors, ');
    expect(r.out).toMatch(/⚠ content\/data\/bis_panel_monthly\.csv — the Research chart has no data yet/);
  });
});

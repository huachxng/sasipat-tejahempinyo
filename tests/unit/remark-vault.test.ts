import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import type { Root, Image } from 'mdast';

const FIXTURE = resolve('tests/fixtures/vault');
process.env.VAULT_DIR = FIXTURE;
const { unified } = await import('unified');
const { VFile } = await import('vfile');
const remarkParse = (await import('remark-parse')).default;
const remarkRehype = (await import('remark-rehype')).default;
const rehypeStringify = (await import('rehype-stringify')).default;
const { resetVaultCache } = await import('../../src/lib/vault.ts');
const { remarkVault } = await import('../../src/plugins/remark-vault.ts');
resetVaultCache();

const ALPHA = join(FIXTURE, 'notes', 'Alpha.md');
interface Warning { file: string; message: string }

async function render(md: string, path = ALPHA) {
  const file = new VFile({ value: md, path });
  await unified().use(remarkParse).use(remarkVault).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true }).process(file);
  return { html: String(file), warnings: (file.data as { vaultWarnings?: Warning[] }).vaultWarnings ?? [] };
}
async function tree(md: string, path = ALPHA): Promise<Root> {
  const file = new VFile({ value: md, path });
  const processor = unified().use(remarkParse).use(remarkVault);
  return (await processor.run(processor.parse(file), file)) as Root;
}
const collect = <T extends { type: string }>(node: unknown, type: string, out: T[] = []): T[] => {
  const n = node as { type: string; children?: unknown[] };
  if (n.type === type) out.push(n as unknown as T);
  for (const c of n.children ?? []) collect(c, type, out);
  return out;
};

describe('comments', () => {
  it('removes an inline %% comment %% and keeps the surrounding text', async () => {
    const { html } = await render('Visible before %% an inline secret %% and visible after.');
    expect(html).not.toContain('inline secret');
    expect(html).toContain('Visible before');
    expect(html).toContain('and visible after.');
  });
  it('removes a block comment spanning several paragraphs', async () => {
    const { html, warnings } = await render('Keep me.\n\n%% start of block\n\nmiddle paragraph\n\nend of block %%\n\nAlso keep me.');
    expect(html).not.toContain('middle paragraph');
    expect(html).not.toContain('start of block');
    expect(html).toContain('Keep me.');
    expect(html).toContain('Also keep me.');
    expect(warnings).toEqual([]);
  });
  it('warns on an unbalanced %% and hides everything after it', async () => {
    const { html, warnings } = await render('Intro paragraph.\n\n%% never closed\n\nThis would be hidden.');
    expect(warnings.some((w) => /unbalanced %% comment/.test(w.message))).toBe(true);
    expect(html).toContain('Intro paragraph.');
    expect(html).not.toContain('This would be hidden.');
  });
});

describe('image embeds', () => {
  it('turns ![[img.jpg|480]] into an mdast image node with a relative url and width', async () => {
    const t = await tree('Picture: ![[fixture.jpg|480]]');
    const [img] = collect<Image>(t, 'image');
    expect(img).toBeDefined();
    expect(img.url).toBe('../media/fixture.jpg');
    expect(img.alt).toBe('');
    expect((img.data as { hProperties: Record<string, unknown> }).hProperties).toMatchObject({ class: 'vault-img', width: 480 });
  });
  it('renders the image with src, width and class', async () => {
    const { html } = await render('![[fixture.jpg|480]]');
    expect(html).toMatch(/<img[^>]*src="\.\.\/media\/fixture\.jpg"/);
    expect(html).toMatch(/<img[^>]*width="480"/);
    expect(html).toMatch(/<img[^>]*class="vault-img"/);
  });
  it('uses a non-numeric alias as alt text', async () => {
    const t = await tree('![[fixture.jpg|A caption]]');
    expect(collect<Image>(t, 'image')[0].alt).toBe('A caption');
  });
  it('marks a missing image and warns', async () => {
    const { html, warnings } = await render('![[not-there.png]]');
    expect(html).toContain('<span class="wl-missing">[image missing: not-there.png]</span>');
    expect(warnings.some((w) => w.message.includes('not found in content/media'))).toBe(true);
  });
  it('refuses documents', async () => {
    const { html, warnings } = await render('![[deck.pdf]]');
    expect(html).toContain('class="wl-missing"');
    expect(warnings.some((w) => w.message.includes('is a document'))).toBe(true);
  });
});

describe('note links', () => {
  it('renders [[Note]] as a link with class wl and the note title', async () => {
    const { html } = await render('See [[Beta]].');
    expect(html).toMatch(/<a[^>]*href="\/notes\/beta"[^>]*>Beta<\/a>/);
    expect(html).toMatch(/<a[^>]*class="wl"[^>]*data-kind="notes"/);
  });
  it('uses the alias as link text and appends heading anchors', async () => {
    const { html } = await render('[[Alpha#Heading Two|a heading]] and [[Alpha#Heading Two]]');
    expect(html).toContain('href="/notes/alpha#heading-two"');
    expect(html).toContain('>a heading</a>');
    expect(html).toContain('>Alpha › Heading Two</a>');
  });
  it('renders an unpublished target as a wl-missing span with no href', async () => {
    const { html, warnings } = await render('Draft: [[Gamma]]');
    expect(html).toContain('<span class="wl-missing" title="not published yet">Gamma</span>');
    expect(html).not.toContain('href="/notes/gamma"');
    expect(html).not.toContain('Gamma Secret Draft');
    expect(warnings.some((w) => w.message.includes('unpublished'))).toBe(true);
  });
  it('renders an unknown target as plain text with a warning', async () => {
    const { html, warnings } = await render('[[Nowhere To Be Found]]');
    expect(html).toContain('<span class="wl-missing" title="not published yet">Nowhere To Be Found</span>');
    expect(warnings.some((w) => w.message.includes('not found'))).toBe(true);
  });
  it('flags an ambiguous basename and suggests the folder form', async () => {
    const { html, warnings } = await render('[[Dup Name]]');
    expect(html).toContain('class="wl-missing"');
    expect(warnings.some((w) => /matches 2 files; write \[\[notes\/Dup Name\]\]/.test(w.message))).toBe(true);
  });
  it('drops block references with a warning but keeps the link', async () => {
    const { html, warnings } = await render('[[Alpha#^blk1]]');
    expect(html).toContain('href="/notes/alpha"');
    expect(warnings.some((w) => w.message.includes('block reference'))).toBe(true);
  });
});

describe('tags and highlights', () => {
  it('turns an inline #tag into a tag link', async () => {
    const { html } = await render('About #inline-tag and #Topic/Sub.');
    expect(html).toMatch(/<a[^>]*href="\/tags\/inline-tag"[^>]*>#inline-tag<\/a>/);
    expect(html).toMatch(/<a[^>]*class="tag-inline"[^>]*rel="tag"/);
    expect(html).toContain('href="/tags/topic%2Fsub"');
  });
  it('renders ==text== as <mark>', async () => {
    const { html } = await render('a ==highlighted phrase== b');
    expect(html).toContain('<mark>highlighted phrase</mark>');
  });
  it('leaves tags inside code and headings untouched', async () => {
    const { html } = await render('# Heading #headtag\n\nCode `#notatag` and\n\n```\n#fenced\n```');
    expect(html).toContain('<code>#notatag</code>');
    expect(html).toContain('#fenced');
    expect(html).not.toContain('/tags/notatag');
    expect(html).not.toContain('/tags/fenced');
    expect(html).not.toContain('/tags/headtag');
  });
  it('does not treat a number as a tag', async () => {
    const { html } = await render('Year #2026 only.');
    expect(html).not.toContain('/tags/2026');
  });
});

describe('the fixture note end to end', () => {
  it('renders Alpha.md with every construct handled', async () => {
    const { readFileSync } = await import('node:fs');
    const body = readFileSync(ALPHA, 'utf8').replace(/^---[\s\S]*?---\n/, '');
    const { html } = await render(body);
    expect(html).not.toContain('inline secret');
    expect(html).not.toContain('must disappear');
    expect(html).toContain('href="/notes/beta"');
    expect(html).toContain('<mark>highlighted phrase</mark>');
    expect(html).toContain('href="/tags/inline-tag"');
    expect(html).toContain('<code>#notatag</code>');
    expect(html).toMatch(/<img[^>]*src="\.\.\/media\/fixture\.jpg"/);
    expect(html).not.toContain('Gamma Secret Draft');
  });
});

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

const FIXTURE = resolve('tests/fixtures/vault');
process.env.VAULT_DIR = FIXTURE;
const { buildVaultIndex, resetVaultCache } = await import('../../src/lib/vault.ts');
const { parseWikilinks, resolveWikilink, headingAnchor, imageEmbeds, outgoingLinks, stripComments, hasUnbalancedComments, isImageTarget, isDocumentTarget } = await import('../../src/lib/wikilinks.ts');
resetVaultCache();
const vault = buildVaultIndex(FIXTURE);

describe('parseWikilinks', () => {
  it('parses every syntax', () => {
    const text = '[[A]] [[B|alias]] [[C#Head ing]] [[D#^blk]] ![[img.jpg|480]] [[achievements/Name]] [[E.md]]';
    const links = parseWikilinks(text);
    expect(links.map((l) => l.target)).toEqual(['A', 'B', 'C', 'D', 'img.jpg', 'achievements/Name', 'E.md']);
    expect(links[1].alias).toBe('alias');
    expect(links[2].heading).toBe('Head ing');
    expect(links[3].block).toBe('blk');
    expect(links[4].embed).toBe(true);
    expect(links[4].alias).toBe('480');
    expect(links[0].embed).toBe(false);
    let cursor = 0;
    for (const l of links) {
      expect(l.index).toBe(text.indexOf(l.raw, cursor));
      cursor = l.index + l.raw.length;
    }
  });
  it('keeps raw text and trims the target', () => {
    const [l] = parseWikilinks('see [[ Alpha ]] now');
    expect(l.raw).toBe('[[ Alpha ]]');
    expect(l.target).toBe('Alpha');
  });
  it('ignores unbalanced or empty brackets sensibly', () => {
    expect(parseWikilinks('[[not closed')).toEqual([]);
    expect(parseWikilinks('[[]]')[0].target).toBe('');
  });
});

describe('resolveWikilink', () => {
  it('resolves a vault-unique basename to its route', () => {
    const r = resolveWikilink('Beta', vault);
    expect(r.ok && r.href).toBe('/notes/beta');
  });
  it('ignores case and a .md suffix', () => {
    expect(resolveWikilink('alpha', vault).ok).toBe(true);
    expect(resolveWikilink('Beta.md', vault).ok).toBe(true);
  });
  it('matches NFD input against an NFC file name', () => {
    const r = resolveWikilink('Café note', vault);
    expect(r.ok && r.entry.title).toBe('Café Note');
  });
  it('resolves aliases', () => {
    const r = resolveWikilink('First Note', vault);
    expect(r.ok && r.entry.title).toBe('Alpha');
  });
  it('resolves folder-style targets and prefers them over the ambiguous basename', () => {
    const a = resolveWikilink('achievements/Dup Name', vault);
    expect(a.ok && a.href).toBe('/achievements/dup-name-award');
    const n = resolveWikilink('notes/Dup Name', vault);
    expect(n.ok && n.href).toBe('/notes/dup-name');
  });
  it('reports an ambiguous basename with both candidates', () => {
    const r = resolveWikilink('Dup Name', vault);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('ambiguous');
      expect(r.candidates.map((c) => c.rel).sort()).toEqual(['achievements/Dup Name', 'notes/Dup Name']);
    }
  });
  it('reports unknown targets as missing with closest names', () => {
    const r = resolveWikilink('Alpha Beta Nowhere', vault);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('missing');
      expect(r.candidates.length).toBeGreaterThan(0);
      expect(r.candidates.length).toBeLessThanOrEqual(3);
    }
  });
  it('reports unpublished targets so they render as plain text', () => {
    const r = resolveWikilink('Gamma', vault);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unpublished');
  });
  it('treats an empty target as empty', () => {
    const r = resolveWikilink('', vault);
    expect(!r.ok && r.reason).toBe('empty');
  });
});

describe('anchors and embeds', () => {
  it('turns a heading into a GitHub-style slug anchor', () => {
    expect(headingAnchor('Heading Two')).toBe('#heading-two');
    expect(headingAnchor('  Why it exists? ')).toBe('#why-it-exists');
  });
  it('parses image embeds with width or alt', () => {
    const embeds = imageEmbeds('![[fixture.jpg|480]] ![[media/pic.PNG|My alt]] [[notlink.jpg]] ![[Note]]');
    expect(embeds).toEqual([
      { name: 'fixture.jpg', width: 480, alt: undefined, raw: '![[fixture.jpg|480]]' },
      { name: 'pic.PNG', width: undefined, alt: 'My alt', raw: '![[media/pic.PNG|My alt]]' },
    ]);
  });
  it('classifies targets', () => {
    expect(isImageTarget('a.webp')).toBe(true);
    expect(isImageTarget('a.pdf')).toBe(false);
    expect(isDocumentTarget('deck.pdf')).toBe(true);
    expect(isDocumentTarget('clip.MOV')).toBe(true);
  });
});

describe('outgoingLinks and comments', () => {
  it('lists note links only, skipping images, documents and commented links', () => {
    const body = '[[Beta]] ![[fixture.jpg]] [[deck.pdf]] %% [[Alpha]] %% [[Gamma]]';
    const out = outgoingLinks(body, vault);
    expect(out.map((o) => o.link.target)).toEqual(['Beta', 'Gamma']);
    expect(out[0].res.ok).toBe(true);
    expect(out[1].res.ok).toBe(false);
  });
  it('strips inline and multi-line comments', () => {
    expect(stripComments('a %% b %% c')).toBe('a  c');
    expect(stripComments('a\n%%\nline\n%%\nc')).toBe('a\n\nc');
  });
  it('detects unbalanced comments', () => {
    expect(hasUnbalancedComments('a %% b')).toBe(true);
    expect(hasUnbalancedComments('a %% b %%')).toBe(false);
  });
});

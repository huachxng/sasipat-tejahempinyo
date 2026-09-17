import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterBySlug } from '../../src/site.config.ts';

describe('chapters', () => {
  it('are numbered sequentially from 01', () => {
    CHAPTERS.forEach((c, i) => expect(c.num).toBe(String(i + 1).padStart(2, '0')));
  });
  it('have unique slugs and root-relative hrefs', () => {
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
    for (const c of CHAPTERS) expect(c.href.startsWith('/')).toBe(true);
  });
  it('include research as chapter 03', () => {
    expect(chapterBySlug('research').num).toBe('03');
  });
});

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

process.env.VAULT_DIR = resolve('tests/fixtures/vault');
const { previousSlugsRedirects } = await import('../../src/lib/redirects.ts');

describe('previousSlugsRedirects', () => {
  const map = previousSlugsRedirects();
  it('maps every previous slug of a published entry to its current route', () => {
    expect(map['/blog/old-post-name']).toBe('/blog/post-one');
  });
  it('slugifies the old name the same way ids are made', () => {
    expect(Object.keys(map).every((k) => k === k.toLowerCase() && !/\s/.test(k))).toBe(true);
  });
  it('skips a previous slug equal to the current id', () => {
    expect(map).not.toHaveProperty('/blog/post-one');
  });
  it('ignores unpublished entries', () => {
    expect(map).not.toHaveProperty('/blog/ghost-post');
    expect(Object.values(map)).not.toContain('/blog/draft-post');
  });
  it('produces exactly the expected map for the fixture vault', () => {
    expect(map).toEqual({ '/blog/old-post-name': '/blog/post-one' });
  });
});
